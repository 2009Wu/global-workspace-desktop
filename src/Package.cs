using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
internal static class Package {
    static string Safe(string path){
        if(path.Length>220 || !Regex.IsMatch(path,@"^[A-Za-z0-9_. /-]+$") || path.Split('/').Any(s=>s==""||s=="."||s==".."||s.EndsWith(".")||s.EndsWith(" ")||Regex.IsMatch(s,@"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)",RegexOptions.IgnoreCase)))throw new InvalidDataException("更新包包含非法路径");
        return path;
    }
    public static void Unpack(string zip,string dest){
        Directory.CreateDirectory(dest);var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long total=0;
        using(var z=ZipFile.OpenRead(zip)){if(z.Entries.Count>1500)throw new InvalidDataException("文件数量超限");
        foreach(var entry in z.Entries){string name=Safe(entry.FullName);total+=entry.Length;
            if(!names.Add(name)||total>300000000||((entry.ExternalAttributes>>16)&0xf000)==0xa000||(!(name.StartsWith("payload/",StringComparison.Ordinal)&&name.Length>8)&&name!="manifest.json"&&name!="Install.exe"))throw new InvalidDataException("更新包目录错误");
            string p=Path.Combine(dest,name.Replace('/','\\'));Directory.CreateDirectory(Path.GetDirectoryName(p));entry.ExtractToFile(p,false);
        }}
    }
    public static void Verify(string dir,string expected){
        var manifest=C.Obj(File.ReadAllText(Path.Combine(dir,"manifest.json")));if(C.Str(manifest,"product")!=Build.Product || C.VersionText(C.Str(manifest,"version"))!=expected)throw new InvalidDataException("产品或版本不匹配");
        var list=(Dictionary<string,object>)manifest["files"];var checkedNames=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var pair in list){string n=Safe(pair.Key);if(!n.StartsWith("payload/",StringComparison.Ordinal)||!checkedNames.Add(n)||!Regex.IsMatch(pair.Value.ToString(),"^[0-9a-f]{64}$")||C.Hash(Path.Combine(dir,n))!=pair.Value.ToString())throw new InvalidDataException("文件校验失败 "+n);}
        string[] required={"Client.exe","Maintenance.exe","GlobalWorkspace.exe","ui/index.html","ui/app.js","ui/feeds.js","ui/style.css","ui/world.js","ui/vendor/leaflet.js","WebView2Loader.dll","Microsoft.Web.WebView2.WinForms.dll","Microsoft.Web.WebView2.Core.dll"};
        if(required.Any(n=>!checkedNames.Contains("payload/"+n)))throw new InvalidDataException("缺少程序文件");
        foreach(string f in Directory.GetFiles(Path.Combine(dir,"payload"),"*",SearchOption.AllDirectories)){string n=f.Substring(dir.TrimEnd('\\','/').Length+1).Replace('\\','/');if(!checkedNames.Contains(n)&&n!="manifest.json"&&n!="Install.exe")throw new InvalidDataException("发现清单外文件 "+n);}
        if(C.Hash(Path.Combine(dir,"Install.exe"))!=C.Hash(Path.Combine(dir,"payload","Maintenance.exe")))throw new InvalidDataException("安装程序校验失败");
    }
}
