using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

internal static class LocalTranslation {
    static readonly string Server=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","ggml.llamacpp","llama-server.exe");
    static readonly string Small=ResolveModel("HY-MT1.5-1.8B-Q4_K_M.gguf");
    static readonly string Medium=ResolveModel("HY-MT2-7B-Q6_K.gguf");
    static readonly string Qwen=ResolveModel("Qwen3-4B-Instruct-2507-Q4_K_M.gguf");
    static readonly string Qwen14=ResolveModel("Qwen3-14B-Q4_K_M.gguf");
    static readonly string QwenSmall=ResolveModel("Qwen2.5-1.5B-Instruct.gguf");
    static readonly string Large=ResolveModel("Qwen3.8-27B-Q4_K_M.gguf");
    static string ResolveModel(string name){
        var primary=Path.Combine(C.User,"models",name);
        if(File.Exists(primary)||!Build.Test)return primary;
        // Standalone candidate can reuse existing weights without copying gigabytes.
        string dir=Environment.GetEnvironmentVariable(name.StartsWith("Qwen3.8")?"DESK_REVIEW_MODELS":name.StartsWith("Qwen")?"DESK_QWEN_MODELS":name.Contains("7B")?"DESK_FAST_MODELS":"DESK_SMALL_MODELS");
        return String.IsNullOrEmpty(dir)?primary:Path.Combine(dir,name);
    }
    [StructLayout(LayoutKind.Sequential)] struct MemoryStatus {
        public uint size,load;public ulong total,free,pageTotal,pageFree,virtualTotal,virtualFree,extended;
    }
    [DllImport("kernel32.dll")] static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
    static MemoryStatus Memory(){var s=new MemoryStatus();s.size=(uint)Marshal.SizeOf(typeof(MemoryStatus));GlobalMemoryStatusEx(ref s);return s;}
    static readonly Task<int> Vram=Task.Run(()=>ProbeVideoMemory());
    static int ProbeVideoMemory(){
        string exe=Path.Combine(Environment.SystemDirectory,"nvidia-smi.exe");
        if(!File.Exists(exe))return 0;
        try{using(var proc=Process.Start(new ProcessStartInfo(exe,"--query-gpu=memory.total --format=csv,noheader,nounits"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true})){
            if(!proc.WaitForExit(1500)){proc.Kill();return 0;}
            int value;return Int32.TryParse(proc.StandardOutput.ReadLine(),out value)?value:0;
        }}catch{return 0;}
    }
    public static Task<int> Detect(){return Vram;}
    public static bool Light {get{return (Build.Test&&Environment.GetEnvironmentVariable("DESK_TEST_LIGHT")=="1")||Memory().total<(12UL<<30)||Environment.ProcessorCount<=4||!Vram.IsCompleted||Vram.Result<8192;}}
    static string Fast {get{
        if(!Light&&Vram.Result>=12288&&Memory().total>=(24UL<<30)&&File.Exists(Qwen14))return Qwen14;
        if(!Light&&File.Exists(Qwen))return Qwen;
        if(File.Exists(QwenSmall))return QwenSmall;
        return !Light&&File.Exists(Medium)?Medium:Small;
    }}
    public static string EngineName {get{return Path.GetFileNameWithoutExtension(Fast);}}
    public static bool CanReview {get{return !Light&&Memory().total>=(28UL<<30)&&File.Exists(Large)&&File.Exists(Server);}}
    static DateTime quietUntil;static CancellationTokenSource current;
    static string loaded;
    public static void Interaction(){quietUntil=DateTime.UtcNow.AddMilliseconds(1050);if(current!=null)current.Cancel();}
    static void Guard(){if(DateTime.UtcNow<quietUntil)throw new IOException("Map active");}
    static readonly HttpClient Http=new HttpClient(new HttpClientHandler{UseProxy=false,AllowAutoRedirect=false}){Timeout=TimeSpan.FromMinutes(4)};
    static readonly SemaphoreSlim Gate=new SemaphoreSlim(1,1);
    static Process engine;
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long processTime,jobTime;
        public uint flags;
        public UIntPtr minMemory,maxMemory;
        public uint processLimit;
        public UIntPtr affinity;
        public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits basic;
        public ulong reads,writes,other,readBytes,writeBytes,otherBytes;
        public UIntPtr processMemory,jobMemory,peakProcess,peakJob;
    }
    [DllImport("kernel32.dll",SetLastError=true)] static extern SafeFileHandle CreateJobObject(IntPtr attributes,string name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(SafeFileHandle job,int info,ref ExtendedLimits limits,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(SafeFileHandle job,IntPtr process);
    static SafeFileHandle job;
    static void OwnEngine(){
        if(job==null){
            var handle=CreateJobObject(IntPtr.Zero,null);
            var limits=new ExtendedLimits();limits.basic.flags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if(handle.IsInvalid||!SetInformationJobObject(handle,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits)))){
                handle.Dispose();throw new IOException("Could not supervise translator");
            }
            job=handle;
        }
        if(!AssignProcessToJobObject(job,engine.Handle))throw new IOException("Could not supervise translator process");
    }
    static string endpoint,secret;
    static DateTime lastUse,cooldown;
    static readonly Timer Idle=new Timer(_=>{
        if(!Gate.Wait(0))return;
        try{if(DateTime.UtcNow-lastUse>TimeSpan.FromMinutes(3))Stop();}finally{Gate.Release();}
    },null,60000,60000);
    public static bool Available {get{return File.Exists(Server)&&File.Exists(Fast);}}
    public static void Stop(){
        var p=engine;engine=null;
        if(p!=null){try{if(!p.HasExited)p.Kill();}catch{}finally{p.Dispose();}}
    }
    static async Task EnsureReady(string model,CancellationToken ct){
        if(engine!=null&&!engine.HasExited&&loaded==model)return;
        // mmap pages for this quantization can become resident even with GPU offload.
        // Leave room for WebView, map tiles and the desktop during model startup.
        ulong reserve=model==Large?(ulong)new FileInfo(model).Length+(3UL<<30):model==Small||model==QwenSmall?(1300UL<<20):(3UL<<30);
        if(model==Large&&Memory().free<reserve)throw new IOException("Insufficient free memory");
        if(engine!=null){
            var previous=engine;engine=null;
            await Task.Run(()=>{using(previous){if(!previous.HasExited){previous.Kill();previous.WaitForExit(4000);}}});
            ct.ThrowIfCancellationRequested();
        }
        if(!File.Exists(model)||!File.Exists(Server)||DateTime.UtcNow<cooldown)throw new IOException("Local translator unavailable");
        if(Memory().free<reserve)throw new IOException("Insufficient free memory");
        var port=new TcpListener(IPAddress.Loopback,0);port.Start();
        int n=((IPEndPoint)port.LocalEndpoint).Port;port.Stop();
        endpoint="http://127.0.0.1:"+n;secret=Guid.NewGuid().ToString("N");
        var opts=new ProcessStartInfo(Server,"-m \""+model+"\" --offline --no-warmup --host 127.0.0.1 --port "+n+" --api-key "+secret+" -c 2048 -np 1 -ngl "+(Light?"0":model==Large?"14":"99")+" --threads "+(Light?"2":"4")+(model==Large||model==Qwen14?" --reasoning off":"")){
            UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(Server)};
        try{
            engine=Process.Start(opts);OwnEngine();loaded=model;engine.PriorityClass=ProcessPriorityClass.BelowNormal;
            for(int i=0;i<120&&!engine.HasExited;i++){
                ct.ThrowIfCancellationRequested();
                try{using(var r=await Http.GetAsync(endpoint+"/health",ct)){if(r.IsSuccessStatusCode)return;}}
                catch(HttpRequestException){}
                await Task.Delay(250);
            }
            throw new IOException("Local translator startup timed out");
        }catch(OperationCanceledException){Stop();throw;}catch{Stop();cooldown=DateTime.UtcNow.AddMinutes(1);throw;}
    }
    public static async Task Warm(){
        Guard();await Gate.WaitAsync();
        try{
            Guard();current=new CancellationTokenSource();
            await EnsureReady(Fast,current.Token);
        }catch(OperationCanceledException){throw new IOException("Map active");}
        finally{if(current!=null){current.Dispose();current=null;}lastUse=DateTime.UtcNow;Gate.Release();}
    }
    public static async Task<string> Translate(string lang,string text,string context="",bool review=false){
        if(String.IsNullOrWhiteSpace(text)||text.Length>1400||lang.Length>12)throw new ArgumentException("Translation input");
        Guard();await Gate.WaitAsync();
        try{
            Guard();if(review&&!CanReview)throw new IOException("Review model unavailable");
            current=new CancellationTokenSource();await EnsureReady(review?Large:Fast,current.Token);
            string target=lang=="zh-CN"?"简体中文":lang=="zh-TW"?"繁體中文":lang=="arz"?"Egyptian Arabic":lang=="pcm"?"Nigerian Pidgin":System.Globalization.CultureInfo.GetCultureInfo(lang).EnglishName;
            string instruction=lang.StartsWith("zh")?"将以下文本翻译为"+target+"，注意只需要输出翻译后的结果，不要额外解释：":
                "Translate the following segment into "+target+", without additional explanation.";
            var messages=new List<object>();
            if(review||Fast==Qwen14||Fast==Qwen||Fast==QwenSmall){
                instruction+="\nTranslate the source as a professional news editor. Preserve names, reported speech, uncertainty, negation, figures, units, and the difference between points and percent. Use idiomatic news language. Return only the translation. If the input is a JSON object, translate only its source field. The context field is for interpreting the source.";
                messages.Add(new {role="system",content=instruction});
                messages.Add(new {role="user",content=context.Length==0?text:C.Json.Serialize(new{source=text,context=context.Substring(0,Math.Min(280,context.Length))})});
            }else{
                messages.Add(new {role="user",content=instruction+"\n\n"+text});
            }
            using(var request=new HttpRequestMessage(HttpMethod.Post,endpoint+"/v1/chat/completions")){
                request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",secret);
                request.Content=new StringContent(C.Json.Serialize(new{messages=messages,temperature=0,max_tokens=1200,stream=false}),Encoding.UTF8,"application/json");
                using(var response=await Http.SendAsync(request,current.Token)){
                    response.EnsureSuccessStatusCode();var obj=(Dictionary<string,object>)C.Json.DeserializeObject(await response.Content.ReadAsStringAsync());
                    var choices=(object[])obj["choices"];var first=(Dictionary<string,object>)choices[0];
                    var result=C.Str((Dictionary<string,object>)first["message"],"content").Trim();
                    if(result.Length==0||C.Str(first,"finish_reason")=="length"||(lang.StartsWith("zh")&&text.Length>24&&!System.Text.RegularExpressions.Regex.IsMatch(result,@"[\u3400-\u9fff]")))throw new InvalidDataException("Incomplete translation");
                    return result;
                }
            }
        }catch(OperationCanceledException){if(current!=null&&current.IsCancellationRequested)throw new IOException("Map active");throw;}
        finally{if(current!=null){current.Dispose();current=null;}lastUse=DateTime.UtcNow;Gate.Release();GC.KeepAlive(Idle);}
    }
}

