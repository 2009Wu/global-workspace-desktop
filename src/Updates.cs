using System;
using System.IO;
using System.Net.Http;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
internal class Updates {
 public bool Busy,Checking;public string Next="",Notes="",Status="",Phase="idle",CheckResult="";public int Percent;
 readonly Action notify; readonly Func<string,string,Task> restart;
 public Updates(Action notify,Func<string,string,Task> restart){this.notify=notify;this.restart=restart;}
 public object State(){return new {next=Next,notes=Notes,status=Status,phase=Phase,check=CheckResult,percent=Percent,busy=Busy,version=Build.Version};}
 Dictionary<string,string> urls=new Dictionary<string,string>();
 async Task<HttpResponseMessage> Request(string url,bool asset){
    using(var req=new HttpRequestMessage(HttpMethod.Get,url)){if(!Build.Test && Net.HasKey("github"))req.Headers.TryAddWithoutValidation("Authorization","Bearer "+Net.Key("github"));
    req.Headers.TryAddWithoutValidation("Accept",asset?"application/octet-stream":"application/vnd.github+json");return await Net.Http.SendAsync(req,HttpCompletionOption.ResponseHeadersRead);}
 }
 async Task<string> SmallAsset(string name){using(var res=await Request(urls[name],true)){res.EnsureSuccessStatusCode();if(res.Content.Headers.ContentLength>100000)throw new IOException("清单太大");return await res.Content.ReadAsStringAsync();}}
 public async Task Check(){
    if(Busy||Checking)return;Checking=true;var repair=Task.Run((Action)C.ShortcutSafe);
    try{
     if(Build.Feed==""){Status="公开更新仓库待确定";return;}
     using(var res=await Request(Build.Feed,false)){
        if((int)res.StatusCode==404){Next="";Notes="";Phase="idle";CheckResult="empty";Status="暂无可访问的正式版";return;}
        res.EnsureSuccessStatusCode();var d=C.Obj(await res.Content.ReadAsStringAsync());string tag=C.Str(d,"tag_name");
        if(true.Equals(d["draft"])||true.Equals(d["prerelease"])||!Regex.IsMatch(tag,@"^v\d+\.\d+\.\d+$")||new Version(tag.Substring(1))<=new Version(Build.Version)){
          Next="";Notes="";Phase="idle";CheckResult="same";Status="当前已是最新正式版";return;}
        var found=new Dictionary<string,string>();foreach(Dictionary<string,object> a in (System.Collections.IEnumerable)d["assets"]){
          string name=C.Str(a,"name");if(name!=Build.Asset&&name!=Build.Asset+".sha256"&&name!="update.json")continue;
          string url=C.Str(a,"browser_download_url");var uri=new Uri(url);if(Build.Test ? uri.GetLeftPart(UriPartial.Authority)!=new Uri(Build.Feed).GetLeftPart(UriPartial.Authority) : url!="https://github.com/"+Build.Repo+"/releases/download/"+tag+"/"+name)throw new IOException("附件地址不匹配");if(!Build.Test){long number=Convert.ToInt64(a["id"]);url="https://api.github.com/repos/"+Build.Repo+"/releases/assets/"+number;}found.Add(name,url);
        }
        if(found.Count!=3)throw new IOException("正式版缺少必要附件");urls=found;Next=tag.Substring(1);Notes=C.Str(d,"body");if(Notes.Length>420)Notes=Notes.Substring(0,420)+"…";Phase="available";Status="可安装新版";
     }
    }catch(Exception){CheckResult="error";Status="更新源暂不可用，可稍后重试";}finally{Checking=false;notify();}
 }
 public async Task Install(){
    if(Busy||Checking||Next=="")return;Busy=true;Percent=0;Phase="download";Status="正在下载";notify();
    string scratch=Path.Combine(C.Root,"incoming",Guid.NewGuid().ToString("N")),staged=Path.Combine(scratch,"verified");bool handed=false;
    try{
      Directory.CreateDirectory(scratch);string zip=Path.Combine(scratch,Build.Asset);var manifest=C.Obj(await SmallAsset("update.json"));
      string sha=(await SmallAsset(Build.Asset+".sha256")).Trim();
      var m=Regex.Match(sha,@"^([a-fA-F0-9]{64})(?:\s+\*?"+Regex.Escape(Build.Asset)+")?$");
      if(!m.Success||!String.Equals(m.Groups[1].Value,C.Str(manifest,"sha256"),StringComparison.OrdinalIgnoreCase)||C.Str(manifest,"product")!=Build.Product||C.Str(manifest,"version")!=Next||C.Str(manifest,"asset")!=Build.Asset)throw new InvalidDataException("发布清单校验失败");
      long size=Convert.ToInt64(manifest["bytes"]);if(size<1||size>200000000)throw new InvalidDataException("更新包大小无效");
      using(var res=await Request(urls[Build.Asset],true)){res.EnsureSuccessStatusCode();using(var input=await res.Content.ReadAsStreamAsync())using(var output=File.Create(zip)){
        byte[] buffer=new byte[65536];int n;while((n=await Net.ReadChunk(input,buffer))>0){await output.WriteAsync(buffer,0,n);if(output.Position>size)throw new InvalidDataException("下载超出清单大小");int p=(int)(output.Position*100/size);if(p!=Percent){Percent=p;notify();}}if(output.Length!=size)throw new InvalidDataException("下载不完整");
      }}
      Status="正在校验文件";notify();await Task.Run(()=>{if(!String.Equals(C.Hash(zip),m.Groups[1].Value,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("ZIP SHA-256 校验失败");Package.Unpack(zip,staged);Package.Verify(staged,Next);});File.Delete(zip);
      Status="等待当前操作完成后重启";Phase="restart";notify();await restart(staged,Next);handed=true;
    }catch(Exception e){Status="更新失败，可重试 · "+e.Message;Phase="error";C.Log(Status);}finally{Busy=false;if(!handed){try{if(Directory.Exists(scratch))Directory.Delete(scratch,true);}catch{}notify();}}
 }
}
