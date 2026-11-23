using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
internal static class Maintenance {
 static string active {get{return C.Read(C.Active,"");}}
 static void Recover(){
    if(!File.Exists(C.Pending))return;
    var j=C.Obj(File.ReadAllText(C.Pending));string previous=C.Str(j,"previous"),next=C.Str(j,"next"),token=C.Str(j,"token");
    if(!System.Text.RegularExpressions.Regex.IsMatch(token,"^[0-9a-f]{32}$"))throw new InvalidDataException("状态记录错误");
    if(File.Exists(Path.Combine(C.Root,"ready-"+token))){C.Atomic(C.Active,next);}
    else if(previous.Length>0){C.Atomic(C.Active,C.VersionText(previous));C.Log("恢复至 "+previous);}
    else C.Atomic(C.Active,C.VersionText(next));
    File.Delete(C.Pending);File.Delete(Path.Combine(C.Root,"ready-"+token));
 }
 static void StartClient(string token){C.Run(Path.Combine(C.VersionDir(active),"Client.exe"),token);}
 static void Install(string source,string next){
    Package.Verify(source,next);string prior=active;
    if(prior!="" && new Version(prior)>=new Version(next)){StartClient("");return;}
    string final=C.VersionDir(next);Directory.CreateDirectory(C.Versions);
    if(!Directory.Exists(final)){
      string stage=Path.Combine(C.Versions,"stage-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(stage);
      var files=(System.Collections.Generic.Dictionary<string,object>)C.Obj(File.ReadAllText(Path.Combine(source,"manifest.json")))["files"];
      foreach(var item in files){var dest=Path.Combine(stage,item.Key.Substring(8));Directory.CreateDirectory(Path.GetDirectoryName(dest));File.Copy(Path.Combine(source,item.Key),dest);if(C.Hash(dest)!=item.Value.ToString())throw new InvalidDataException("写入校验失败");}
      Directory.Move(stage,final);
    }else{
      var files=(System.Collections.Generic.Dictionary<string,object>)C.Obj(File.ReadAllText(Path.Combine(source,"manifest.json")))["files"];
      foreach(var item in files)if(C.Hash(Path.Combine(final,item.Key.Substring(8)))!=item.Value.ToString())throw new InvalidDataException("已有的版本目录无效");
    }
    string launcher=Path.Combine(C.Root,"GlobalWorkspace.exe");if(!File.Exists(launcher))File.Copy(Path.Combine(final,"GlobalWorkspace.exe"),launcher);
    string token=Guid.NewGuid().ToString("N");C.Atomic(C.Pending,C.Json.Serialize(new {previous=prior,next=next,token=token}));
    C.FailPoint("before-switch");C.Atomic(C.Active,next);C.ShortcutSafe();C.FailPoint("after-switch");StartClient(token);
    string ready=Path.Combine(C.Root,"ready-"+token);
    for(int i=0;i<300;i++){if(File.Exists(ready)){Recover();C.Log("已安装 "+next);return;}Thread.Sleep(150);}
    C.Log("新版尚未确认启动，保留恢复记录");
 }
 [STAThread] static void Main(string[] args){C.Init();bool update=args.Length==4&&args[0]=="--apply";
 using(var mutex=new Mutex(false,C.Lock("install"))){if(!C.Own(mutex,10000))return;
 try{
    if(update){int pid=int.Parse(args[3]);try{using(var p=Process.GetProcessById(pid)){if(!p.WaitForExit(60000))throw new IOException("应用仍在运行");}}catch(ArgumentException){}}
    using(var running=new Mutex(false,C.Lock("app"))){if(!C.Own(running,0)){C.ShortcutSafe();return;}running.ReleaseMutex();}
    Recover();
    if(args.Length==1&&args[0]=="--start"){StartClient("");return;}
    if(update){string stage=Path.GetFullPath(args[1]);if(!stage.StartsWith(Path.Combine(C.Root,"incoming")+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("更新目录错误");Install(stage,C.VersionText(args[2]));try{Directory.Delete(stage,true);}catch{}}
    else if(args.Length==0)Install(AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\'),Build.Version);
 }catch(Exception e){C.Log("安装失败 "+e.Message);if(update && File.Exists(C.Active)){try{Recover();C.Atomic(Path.Combine(C.User,"update-error.txt"),e.Message);StartClient("");}catch{}}else MessageBox.Show(e.Message,C.DisplayName);}
 finally{mutex.ReleaseMutex();}}}
}
