using System;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;
using System.Web.Script.Serialization;
internal static class Build { public const string Product="io.littlewang.globalworkspace"; public const bool Test=false; }
class PackageChecks {
 static int count;static void Reject(string name,Action run){try{run();}catch(InvalidDataException){Console.WriteLine("PASS "+name);count++;return;}throw new Exception("Accepted: "+name);}
 static void Main(string[] args){string root=Path.Combine(Path.GetTempPath(),"gw-package-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
 try{string d=Path.Combine(root,"good");Package.Unpack(args[0],d);Package.Verify(d,args[1]);var mp=Path.Combine(d,"manifest.json");string orig=File.ReadAllText(mp);
 var m=C.Obj(orig);m["product"]="another.product";File.WriteAllText(mp,C.Json.Serialize(m));Reject("foreign product",()=>Package.Verify(d,args[1]));
 File.WriteAllText(mp,orig);Reject("wrong version",()=>Package.Verify(d,"999.0.0"));
 var p=Path.Combine(d,"payload","ui","app.js");File.AppendAllText(p," ");Reject("per-file hash",()=>Package.Verify(d,args[1]));File.WriteAllText(p,File.ReadAllText(p).TrimEnd(' '),new System.Text.UTF8Encoding(false));
 var extra=Path.Combine(d,"payload","extra.dll");File.WriteAllText(extra,"extra");Reject("unlisted file",()=>Package.Verify(d,args[1]));File.Delete(extra);
 foreach(string bad in new[]{"../escape.txt","payload/../../outside.txt","C:/outside.txt","payload/CON.txt","payload/a\\b.txt","payload/a.txt:stream","payload/test. "}){string temp=Path.Combine(root,Guid.NewGuid()+".zip");
 using(var z=ZipFile.Open(temp,ZipArchiveMode.Create)){z.CreateEntry(bad);}Reject("unsafe path "+bad,()=>Package.Unpack(temp,Path.Combine(root,Guid.NewGuid().ToString("N"))));}
 string dup=Path.Combine(root,"dup.zip");using(var z=ZipFile.Open(dup,ZipArchiveMode.Create)){z.CreateEntry("payload/A.dll");z.CreateEntry("payload/a.dll");}
 Reject("duplicate Windows path",()=>Package.Unpack(dup,Path.Combine(root,"duplicate")));Console.WriteLine(count+" negative cases passed");
 }finally{Directory.Delete(root,true);}}
}

