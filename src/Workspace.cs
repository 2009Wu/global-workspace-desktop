using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

internal partial class Desk {
    sealed class LayoutWindow {
        public string view { get; set; }
        public int x { get; set; }
        public int y { get; set; }
        public int width { get; set; }
        public int height { get; set; }
        public bool maximized { get; set; }
        public Dictionary<string,object> state { get; set; }
    }
    static bool LayoutView(string kind){return kind=="main"||kind=="map"||kind=="list"||kind=="brief";}
    bool workspaceReady,workspaceBusy;
    object pendingWorkspace;
    async Task<object> WorkspaceCommand(string cmd,string name){
        string file=Path.Combine(C.User,"workspaces.json");
        var presets=C.Json.Deserialize<Dictionary<string,List<LayoutWindow>>>(C.Read(file,"{}"));
        // A user's layout name can be "__type", a reserved JSON member in JavaScriptSerializer.
        if(cmd=="workspaceGet")return presets.Keys.Select(k=>k.Substring(1)).ToArray();
        name=name.Trim();
        if(name.Length==0||name.Length>60||workspaceBusy)throw new InvalidOperationException("Invalid or busy workspace");
        name="/"+name;workspaceBusy=true;tasks++;
        try{
            if(cmd=="workspaceSave"){
                var entries=new List<LayoutWindow>();
                foreach(var w in windows.Where(w=>LayoutView(w.view)&&!w.IsDisposed).ToArray()){
                    if(!w.workspaceReady)throw new InvalidOperationException("Window is still loading");
                    string json=await w.browser.CoreWebView2.ExecuteScriptAsync("captureWorkspace()");
                    var state=C.Obj(json);
                    if(state==null||w.IsDisposed)throw new InvalidOperationException("Window changed during save");
                    var r=w.WindowState==FormWindowState.Normal?w.Bounds:w.RestoreBounds;
                    entries.Add(new LayoutWindow{view=w.view,x=r.X,y=r.Y,width=r.Width,height=r.Height,
                        maximized=w.WindowState==FormWindowState.Maximized,state=state});
                }
                presets[name]=entries;
            }else if(cmd=="workspaceDelete")presets.Remove(name);
            else{
                var entries=presets[name];
                if(entries.Count(s=>s.view=="main")!=1||entries.Any(s=>!LayoutView(s.view)||s.state==null||s.width<=0||s.height<=0))
                    throw new InvalidDataException("Invalid workspace");
                var remaining=windows.Where(w=>LayoutView(w.view)&&!w.IsDisposed).ToList();
                foreach(var s in entries){
                    var window=remaining.FirstOrDefault(w=>w.view==s.view)??new Desk(s.view,"");
                    remaining.Remove(window);
                    var r=new Rectangle(s.x,s.y,s.width,s.height);
                    var screen=Screen.FromRectangle(r).WorkingArea;
                    r.Width=Math.Min(screen.Width,Math.Max(window.MinimumSize.Width,r.Width));
                    r.Height=Math.Min(screen.Height,Math.Max(window.MinimumSize.Height,r.Height));
                    r.X=Math.Max(screen.Left,Math.Min(screen.Right-r.Width,r.X));
                    r.Y=Math.Max(screen.Top,Math.Min(screen.Bottom-r.Height,r.Y));
                    window.WindowState=FormWindowState.Normal;window.StartPosition=FormStartPosition.Manual;window.Bounds=r;
                    if(s.maximized)window.WindowState=FormWindowState.Maximized;
                    if(window.workspaceReady)window.Send("workspaceApply",s.state);
                    else window.pendingWorkspace=s.state;
                    if(!window.Visible)window.Show();
                }
                foreach(var w in remaining)w.Close();
                Activate();
                return true;
            }
            C.Atomic(file,C.Json.Serialize(presets));
            return presets.Keys.Select(k=>k.Substring(1)).ToArray();
        }finally{workspaceBusy=false;tasks--;}
    }
}
