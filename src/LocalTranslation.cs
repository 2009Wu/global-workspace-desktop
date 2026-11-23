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
    static readonly string Model=Path.Combine(C.User,"models","HY-MT1.5-1.8B-Q4_K_M.gguf");
    static readonly HttpClient Http=new HttpClient(new HttpClientHandler{UseProxy=false,AllowAutoRedirect=false}){Timeout=TimeSpan.FromSeconds(35)};
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
    public static bool Available {get{return File.Exists(Server)&&File.Exists(Model);}}
    public static void Stop(){
        var p=engine;engine=null;
        if(p!=null){try{if(!p.HasExited)p.Kill();}catch{}finally{p.Dispose();}}
    }
    static async Task EnsureReady(){
        if(engine!=null&&!engine.HasExited)return;
        Stop();
        if(!Available||DateTime.UtcNow<cooldown)throw new IOException("Local translator unavailable");
        var port=new TcpListener(IPAddress.Loopback,0);port.Start();
        int n=((IPEndPoint)port.LocalEndpoint).Port;port.Stop();
        endpoint="http://127.0.0.1:"+n;secret=Guid.NewGuid().ToString("N");
        var opts=new ProcessStartInfo(Server,"-m \""+Model+"\" --host 127.0.0.1 --port "+n+" --api-key "+secret+" -c 4096 -np 1 -ngl 99 --threads 4"){
            UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(Server)};
        try{
            engine=Process.Start(opts);OwnEngine();
            for(int i=0;i<120&&!engine.HasExited;i++){
                try{using(var r=await Http.GetAsync(endpoint+"/health")){if(r.IsSuccessStatusCode)return;}}
                catch(HttpRequestException){}
                await Task.Delay(250);
            }
            throw new IOException("Local translator startup timed out");
        }catch{Stop();cooldown=DateTime.UtcNow.AddMinutes(1);throw;}
    }
    public static async Task<string> Translate(string lang,string text){
        if(String.IsNullOrWhiteSpace(text)||text.Length>1400||lang.Length>12)throw new ArgumentException("Translation input");
        await Gate.WaitAsync();
        try{
            await EnsureReady();
            string target=lang=="zh-CN"?"简体中文":lang=="zh-TW"?"繁體中文":lang=="arz"?"Egyptian Arabic":lang=="pcm"?"Nigerian Pidgin":System.Globalization.CultureInfo.GetCultureInfo(lang).EnglishName;
            string instruction=lang.StartsWith("zh")?"将以下文本翻译为"+target+"，注意只需要输出翻译后的结果，不要额外解释：":
                "Translate the following segment into "+target+", without additional explanation.";
            var messages=new[]{new {role="user",content=instruction+"\n\n"+text}};
            using(var request=new HttpRequestMessage(HttpMethod.Post,endpoint+"/v1/chat/completions")){
                request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",secret);
                request.Content=new StringContent(C.Json.Serialize(new{messages=messages,temperature=0,max_tokens=1200,stream=false}),Encoding.UTF8,"application/json");
                using(var response=await Http.SendAsync(request)){
                    response.EnsureSuccessStatusCode();var obj=(Dictionary<string,object>)C.Json.DeserializeObject(await response.Content.ReadAsStringAsync());
                    var choices=(object[])obj["choices"];var first=(Dictionary<string,object>)choices[0];
                    var result=C.Str((Dictionary<string,object>)first["message"],"content").Trim();
                    if(result.Length==0||C.Str(first,"finish_reason")=="length"||(lang.StartsWith("zh")&&text.Length>24&&!System.Text.RegularExpressions.Regex.IsMatch(result,@"[\u3400-\u9fff]")))throw new InvalidDataException("Incomplete translation");
                    if(lang.StartsWith("zh"))foreach(System.Text.RegularExpressions.Match number in System.Text.RegularExpressions.Regex.Matches(text,@"(?<!\w)[0-9]+(?:\.[0-9]+)?(?!\w)")){
                        if(!System.Text.RegularExpressions.Regex.IsMatch(result,@"(?<![0-9])"+System.Text.RegularExpressions.Regex.Escape(number.Value)+@"(?![0-9])"))throw new InvalidDataException("Numeric translation needs fallback");
                    }
                    return result;
                }
            }
        }finally{lastUse=DateTime.UtcNow;Gate.Release();GC.KeepAlive(Idle);}
    }
}

