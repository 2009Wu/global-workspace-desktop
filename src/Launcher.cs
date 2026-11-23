using System;
using System.IO;
using System.Windows.Forms;
internal static class Launcher {
 [STAThread] static void Main(){try{C.Init();string version=C.Read(C.Active,"");if(File.Exists(C.Pending)){
    var journal=C.Obj(File.ReadAllText(C.Pending)); string prev=C.Str(journal,"previous"); version=prev.Length>0?prev:C.Str(journal,"next");
 }
 C.Run(Path.Combine(C.VersionDir(version),"Maintenance.exe"),"--start");
 }catch(Exception e){MessageBox.Show(e.Message,C.DisplayName);}}
}
