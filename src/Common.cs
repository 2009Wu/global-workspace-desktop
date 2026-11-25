using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Threading;

internal static class C {
    public const string DisplayName="世界情报收集处";
    public static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 24 * 1024 * 1024, RecursionLimit = 150 };
    public static readonly string Root = Build.Test ? Environment.GetEnvironmentVariable("ATLAS_TEST_HOME") : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LittleWang", "GlobalWorkspace");
    public static string User { get { return Path.Combine(Root, "user"); } }
    public static string Active {get {return Path.Combine(Root,"active.txt");}}
    public static string Pending {get {return Path.Combine(Root,"pending.json");}}
    public static string Versions {get {return Path.Combine(Root,"versions");}}
    public static string Lock(string name) {return @"Local\"+Build.Product+"."+name;}
    public static string Hash(string file) { using(var h=SHA256.Create()) using(var f=File.OpenRead(file)) return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant(); }
    public static string Str(Dictionary<string,object> d,string k){object v;return d.TryGetValue(k,out v) && v!=null ? Convert.ToString(v):"";}
    public static Dictionary<string,object> Obj(string text){return Json.Deserialize<Dictionary<string,object>>(text);}
    public static void Atomic(string path,string data){
        Directory.CreateDirectory(Path.GetDirectoryName(path)); string tmp=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        using(var f=new FileStream(tmp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){var b=new UTF8Encoding(false).GetBytes(data);f.Write(b,0,b.Length);f.Flush(true);}
        if(File.Exists(path)) File.Replace(tmp,path,null); else File.Move(tmp,path);
    }
    public static string VersionText(string value){Version v;if(!System.Text.RegularExpressions.Regex.IsMatch(value??"",@"^\d+\.\d+\.\d+$")||!Version.TryParse(value,out v)||v.ToString()!=value)throw new InvalidDataException("版本号无效");return value;}
    public static string VersionDir(string v){return Path.Combine(Versions,VersionText(v));}
    public static bool InstallFromExtractedPayload(){
        var payload=new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
        if(payload.Parent==null||!payload.Name.Equals("payload",StringComparison.OrdinalIgnoreCase))return false;
        string package=payload.Parent.FullName,installer=Path.Combine(package,"Install.exe");
        if(!File.Exists(Path.Combine(package,"manifest.json"))||!File.Exists(installer))return false;
        Run(installer);return true;
    }
    public static string Arg(string a){return "\""+a.Replace("\"","")+"\"";}
    public static Process Run(string exe,params string[] args){return Process.Start(new ProcessStartInfo(exe,String.Join(" ",args.Select(Arg))){UseShellExecute=false,WorkingDirectory=Path.GetDirectoryName(exe)});}
    public static void Init(){ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;Directory.CreateDirectory(User);}
    public static void Log(string msg){try{File.AppendAllText(Path.Combine(User,"activity.log"),DateTime.UtcNow.ToString("s")+" "+msg+Environment.NewLine);}catch{}}
    public static string Read(string file,string fallback){return File.Exists(file)?File.ReadAllText(file).Trim():fallback;}
    public static void Shortcut(){
        string desktop=Build.Test?Path.Combine(Root,"test-desktop"):Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        Directory.CreateDirectory(desktop);string exe=Path.Combine(Root,"GlobalWorkspace.exe"),dest=null;
        // Older installers create the stable launcher once. Refresh its Windows product name too.
        string activeVersion=Read(Active,"");
        if(activeVersion==Build.Version && File.Exists(exe)){
            string versionLauncher=Path.Combine(VersionDir(activeVersion),"GlobalWorkspace.exe");
            if(File.Exists(versionLauncher) && Hash(versionLauncher)!=Hash(exe)){
                string temp=exe+"."+Guid.NewGuid().ToString("N")+".tmp";
                try{File.Copy(versionLauncher,temp);File.Replace(temp,exe,null);}
                catch(IOException e){Log("Launcher refresh: "+e.Message);}
                finally{if(File.Exists(temp))File.Delete(temp);}
            }
        }
        dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        foreach(string f in Directory.GetFiles(desktop,"*.lnk"))try{dynamic link=shell.CreateShortcut(f);if(String.Equals((string)link.TargetPath,exe,StringComparison.OrdinalIgnoreCase)||(string)link.Description==Build.Product){dest=f;break;}}catch{}
        string defaultLink=Path.Combine(desktop,DisplayName+".lnk");
        if(dest==null || LegacyShortcut(Path.GetFileNameWithoutExtension(dest))){
            string available=defaultLink;
            int suffix=2;
            while(File.Exists(available))available=Path.Combine(desktop,DisplayName+" ("+(suffix++)+").lnk");
            if(dest!=null)File.Move(dest,available);
            dest=available;
        }
        dynamic s=shell.CreateShortcut(dest);string current=Read(Active,"");string iconExe=current==""?exe:Path.Combine(VersionDir(current),"Client.exe");string icon=(File.Exists(iconExe)?iconExe:exe)+",0";
        if((string)s.TargetPath!=exe||(string)s.IconLocation!=icon||(string)s.WorkingDirectory!=Root||(string)s.Description!=Build.Product||(string)s.Arguments!=""){s.TargetPath=exe;s.IconLocation=icon;s.WorkingDirectory=Root;s.Description=Build.Product;s.Arguments="";s.Save();}
    }
    static bool LegacyShortcut(string name){
        const string oldName="全球情报工作台";
        return name==oldName || name==oldName+" ("+Build.Product+")";
    }
    public static void ShortcutSafe(){try{Shortcut();}catch(Exception e){Log("shortcut: "+e.Message);}}
    public static bool Own(Mutex m,int ms){try{return m.WaitOne(ms);}catch(AbandonedMutexException){return true;}}
    public static void FailPoint(string stage){if(Build.Test && Read(Path.Combine(Root,"test-stop.txt"),"")==stage) Environment.Exit(79);}
}

