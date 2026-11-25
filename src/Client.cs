using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal partial class Desk : Form {
 static CoreWebView2Environment env;static readonly List<Desk> windows=new List<Desk>();static Updates update;
 static string token;static bool quitting;static int tasks;
 readonly CitySurface city;
 readonly WebView2 browser=new WebView2();readonly string view;string data;
 string previousVisit="";
 void SaveVisit(){try{C.Atomic(Path.Combine(C.User,"last-visit.txt"),DateTime.UtcNow.ToString("o"));}catch(IOException ex){C.Log("Visit time: "+ex.Message);}}
 static Desk standby;static bool warming;bool parked,readerReady;Task browserSetup;
 Task EnsureBrowser(){return browserSetup??(browserSetup=InitBrowser());}
 static async void WarmReader(){
   if(warming||standby!=null||quitting||LocalTranslation.Light)return;
   warming=true;
   try{await Task.Delay(800);if(standby!=null||quitting||!windows.Any(w=>w.view=="main"&&!w.IsDisposed))return;
     var reader=new Desk("detail","");reader.parked=true;standby=reader;
     var formHandle=reader.Handle;var webHandle=reader.browser.Handle;await reader.EnsureBrowser();
   }catch(Exception ex){C.Log("reader preparation: "+ex.Message);}
   finally{warming=false;}
 }
 static void OpenReader(string story){
   var reader=standby;standby=null;
   if(reader==null||reader.IsDisposed)reader=new Desk("detail",story);
   reader.parked=false;reader.data=story;reader.Show();
   if(reader.readerReady)reader.Send("story",story);
   WarmReader();
 }
 const string Origin="https://workspace.local";
 static void Broadcast(string type,object value){foreach(var w in windows.ToArray())w.Send(type,value);}
 void Send(string type,object value){if(!IsDisposed && browser.CoreWebView2!=null)try{browser.CoreWebView2.PostWebMessageAsJson(C.Json.Serialize(new {type=type,value=value}));}catch(InvalidOperationException){}}
 static async Task Restart(string stage,string version){
   quitting=true;try{while(tasks>0)await Task.Delay(100);C.Run(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Maintenance.exe"),"--apply",stage,version,Process.GetCurrentProcess().Id.ToString());Application.Exit();}catch{quitting=false;throw;}
 }
 static void OpenUrl(string url){Uri u;if(Uri.TryCreate(url,UriKind.Absolute,out u)&&u.Scheme=="https"&&u.UserInfo=="")Process.Start(new ProcessStartInfo(u.AbsoluteUri){UseShellExecute=true});}
 async Task ShowStreet(string coordinates,string label){
   var parts=coordinates.Split(',');double lat,lon;
   var culture=System.Globalization.CultureInfo.InvariantCulture;
   if(parts.Length!=2||!double.TryParse(parts[0],System.Globalization.NumberStyles.Float,culture,out lat)||!double.TryParse(parts[1],System.Globalization.NumberStyles.Float,culture,out lon)||!(Math.Abs(lat)<=90&&Math.Abs(lon)<=180))throw new ArgumentException("Invalid coordinates");
   string url="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint="+Uri.EscapeDataString(coordinates);
   var popup=new Form{Text=label+" · Google Maps · "+coordinates,Size=new Size(790,560),MinimumSize=new Size(420,330),StartPosition=FormStartPosition.CenterParent,Icon=Icon};
   var web=new WebView2{Dock=DockStyle.Fill};
   var fallback=new LinkLabel{Text="Google Maps ↗",Dock=DockStyle.Bottom,Height=25,Padding=new Padding(8,4,0,0)};
   fallback.LinkClicked+=(s,e)=>OpenUrl(url);
   popup.Controls.Add(web);popup.Controls.Add(fallback);popup.Show(this);
   try{
     await web.EnsureCoreWebView2Async(env);
     if(popup.IsDisposed)return;
     var core=web.CoreWebView2;
     core.Settings.IsWebMessageEnabled=false;core.Settings.AreHostObjectsAllowed=false;
     core.PermissionRequested+=(s,e)=>{e.State=CoreWebView2PermissionState.Deny;};
     core.NewWindowRequested+=(s,e)=>{e.Handled=true;if(e.IsUserInitiated)OpenUrl(e.Uri);};
     core.NavigationStarting+=(s,e)=>{Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)||uri.Scheme!="https"||!(uri.Host=="www.google.com"||uri.Host=="consent.google.com"||uri.Host=="maps.google.com")){e.Cancel=true;if(e.IsUserInitiated)OpenUrl(e.Uri);}};
     core.Navigate(url);
   }catch{if(!popup.IsDisposed){popup.Close();OpenUrl(url);}}
 }
 static Size VoteWindowSize(Rectangle area){
   return new Size(Math.Min(1280,Math.Max(390,area.Width-40)),Math.Min(850,Math.Max(340,area.Height-40)));
 }
 Desk(string view,string data){city=new CitySurface(this);this.view=view;this.data=data;windows.Add(this);
   if(view=="main"){
     previousVisit=C.Read(Path.Combine(C.User,"last-visit.txt"),"");
     var heartbeat=new System.Windows.Forms.Timer{Interval=30000};
     heartbeat.Tick+=(s,e)=>SaveVisit();Shown+=(s,e)=>{SaveVisit();heartbeat.Start();};
     FormClosed+=(s,e)=>{heartbeat.Dispose();SaveVisit();};
   }
   Text=view=="main"?C.DisplayName:C.DisplayName+" · "+(view=="votes"?"联合国投票地图":view=="timeline"?"事件时间线":view=="country"?"国家概览":view=="detail"?"事件详情":view=="map"?"地图":view=="brief"?"事件简报":"事件列表");
   StartPosition=FormStartPosition.CenterScreen;Size=view=="main"?new Size(1360,860):view=="votes"?VoteWindowSize(Screen.FromPoint(Cursor.Position).WorkingArea):view=="timeline"?new Size(790,730):view=="map"?new Size(900,640):new Size(610,690);
   string geometry=Path.Combine(C.User,"window-"+view+".json");
   try{var geo=C.Obj(File.ReadAllText(geometry));var rect=new Rectangle(Convert.ToInt32(geo["x"]),Convert.ToInt32(geo["y"]),Convert.ToInt32(geo["w"]),Convert.ToInt32(geo["h"]));if(rect.Width>=390 && rect.Height>=300 && Screen.AllScreens.Any(sc=>Rectangle.Intersect(sc.WorkingArea,rect).Width>=130 && Rectangle.Intersect(sc.WorkingArea,rect).Height>=80)){if(view=="votes" && rect.Size==new Size(960,710) && !geo.ContainsKey("voteSizeVersion")){
     var area=Screen.FromRectangle(rect).WorkingArea;var size=VoteWindowSize(area);
     rect=new Rectangle(Math.Max(area.Left,Math.Min(rect.X-(size.Width-rect.Width)/2,area.Right-size.Width)),Math.Max(area.Top,Math.Min(rect.Y-(size.Height-rect.Height)/2,area.Bottom-size.Height)),size.Width,size.Height);
   }StartPosition=FormStartPosition.Manual;Bounds=rect;}}catch{}
   FormClosing+=(s,e)=>{if(parked)return;try{var r=WindowState==FormWindowState.Normal?Bounds:RestoreBounds;C.Atomic(geometry,C.Json.Serialize(new{x=r.X,y=r.Y,w=r.Width,h=r.Height,voteSizeVersion=1}));}catch{}};
   MinimumSize=view=="main"?new Size(800,540):new Size(390,340);BackColor=Color.FromArgb(14,25,33);Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
   Controls.Add(new Label{Text=C.DisplayName,AutoSize=true,ForeColor=Color.White,Location=new Point(30,35),Font=new Font("Microsoft YaHei UI",16)});
   browser.Dock=DockStyle.Fill;Controls.Add(browser);browser.BringToFront();
   FormClosed+=(s,e)=>{city.Dispose();windows.Remove(this);if(standby==this)standby=null;if(view=="main"){quitting=true;foreach(var w in windows.ToArray())w.Close();}};Shown+=async(s,e)=>await EnsureBrowser();
 }
 async Task InitBrowser(){try{
   if(env==null){var opts=new CoreWebView2EnvironmentOptions();// Local virtual-host files never need multicast DNS. Keep the existing origin
      // so saved layouts, offline feeds and translations remain available.
      opts.AdditionalBrowserArguments="--host-resolver-rules=\"MAP workspace.local 127.0.0.1\"";
      int debugPort=0;if(Build.Test && Int32.TryParse(Environment.GetEnvironmentVariable("ATLAS_TEST_PORT"),out debugPort) && debugPort>0 && debugPort<65536)opts.AdditionalBrowserArguments+=" --remote-debugging-port="+debugPort;
      if(Build.Test && File.Exists(Path.Combine(C.Root,"test-offline")))opts.AdditionalBrowserArguments+=" --proxy-server=http://127.0.0.1:1";
      env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(C.User,"webview"),opts);}
   await browser.EnsureCoreWebView2Async(env);var core=browser.CoreWebView2;
   core.SetVirtualHostNameToFolderMapping("workspace.local",Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"ui"),CoreWebView2HostResourceAccessKind.DenyCors);
   core.Settings.AreDevToolsEnabled=Build.Test;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
   core.NavigationStarting+=(s,e)=>{if(!e.Uri.StartsWith(Origin+"/",StringComparison.Ordinal)){e.Cancel=true;if(e.IsUserInitiated)OpenUrl(e.Uri);}};
   core.NewWindowRequested+=(s,e)=>{e.Handled=true;if(e.IsUserInitiated)OpenUrl(e.Uri);};
   core.PermissionRequested+=(s,e)=>{e.State=CoreWebView2PermissionState.Deny;};
   core.WebMessageReceived+=Message;core.Navigate(Origin+"/index.html?view="+view+(parked?"&warm=1":""));
 }catch(Exception e){C.Log(e.Message);if(!parked)MessageBox.Show("界面启动失败。请检查 Microsoft Edge WebView2 Runtime。\n"+e.Message,Text);Close();}}
 async void Message(object sender,CoreWebView2WebMessageReceivedEventArgs e){
    if(!e.Source.StartsWith(Origin+"/index.html?",StringComparison.Ordinal))return;int id=0;
    try{var msg=C.Obj(e.TryGetWebMessageAsString());id=Convert.ToInt32(msg["id"]);string cmd=C.Str(msg,"cmd"),arg=C.Str(msg,"arg"),val=C.Str(msg,"val");object result=true;
       switch(cmd){
       case "workspaceGet":case "workspaceSave":case "workspaceApply":case "workspaceDelete":
         if(view!="main"||quitting)throw new InvalidOperationException();
         result=await WorkspaceCommand(cmd,arg);break;
       case "workspaceReady":workspaceReady=true;result=pendingWorkspace;pendingWorkspace=null;break;
       case "ready":
         await LocalTranslation.Detect();
         result=new {localAI=LocalTranslation.Available,light=LocalTranslation.Light,engineName=LocalTranslation.EngineName,review=LocalTranslation.CanReview,version=Build.Version,view=view,data=data,previousVisit=previousVisit,state=update.State(),fr24=Net.HasKey("fr24"),x=Net.HasKey("x"),github=Net.HasKey("github"),ships=Net.HasKey("ships"),repo=Build.Repo,installError=C.Read(Path.Combine(C.User,"update-error.txt"),"")};
         if(view=="main"){var unused=update.Check();}break;
       case "readerReady":if(view=="detail"){readerReady=true;result=data;}break;
       case "healthy":if(view=="main")WarmReader();if(view=="main" && token!=null && System.Text.RegularExpressions.Regex.IsMatch(token,"^[a-f0-9]{32}$"))C.Atomic(Path.Combine(C.Root,"ready-"+token),"ready");break;
       case "article":result=await Net.Article(arg);break;
       case "mapActive":LocalTranslation.Interaction();break;
       case "warmTranslator":await LocalTranslation.Warm();break;
       case "translateAI":case "reviewText":
         var passage=C.Obj(val);result=await LocalTranslation.Translate(arg,C.Str(passage,"text"),C.Str(passage,"context"),cmd=="reviewText");break;
       case "checkFeed":{
         var request=C.Obj(val);
         string query=C.Str(request,"arg"),known=C.Str(request,"known");
         result=await Task.Run(()=>Net.CheckFeed(arg,query,known));
         break;
       }
       case "feed":result=await Net.Feed(arg,val);break;
       case "check":await update.Check();break;
       case "install":await update.Install();break;
       case "title":Text=arg.Substring(0,Math.Min(arg.Length,140));break;
       case "cityOpen":await city.Open(env,arg,val);break;
       case "cityBounds":city.Layout(arg);break;
       case "cityClose":if(arg=="camera")result=await city.CloseAtCamera();else city.Dispose();break;
       case "streetView":await ShowStreet(arg,val);break;
       case "external":OpenUrl(arg);break;
       case "countrySource":if(view!="country")throw new InvalidOperationException();result=await Task.Run(()=>Net.CountrySource(arg));break;
       case "pinCountry":if(view!="country")throw new InvalidOperationException();TopMost=val=="true";result=TopMost;break;
       case "window":if(arg=="timeline"){
         var panel=windows.FirstOrDefault(w=>!w.IsDisposed && w.view==arg)??new Desk(arg,val);
         panel.data=val;if(panel.WindowState==FormWindowState.Minimized)panel.WindowState=FormWindowState.Normal;
         panel.Show();panel.Activate();panel.Send("timelineStory",val);
       }else if(arg=="votes" || (arg=="country" && System.Text.RegularExpressions.Regex.IsMatch(val,@"^[A-Z0-9-]{3,5}$"))){
         if(arg=="votes")val="";
         var panel=windows.FirstOrDefault(w=>!w.IsDisposed && w.view==arg && w.data==val)??new Desk(arg,val);
         if(panel.WindowState==FormWindowState.Minimized)panel.WindowState=FormWindowState.Normal;
         panel.Show();panel.Activate();
       }else if(arg=="detail")OpenReader(val);else if(new[]{"map","list","brief"}.Contains(arg))new Desk(arg,val).Show();break;
       case "key":if(quitting)throw new IOException("正在重启");Net.SetKey(arg,val);break;
       case "export":
         if(quitting)throw new IOException("正在重启");tasks++;
         try{await Task.Yield();string folder=Build.Test?Path.Combine(C.Root,"test-exports"):Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);if(Build.Test)Directory.CreateDirectory(folder);using(var dlg=new SaveFileDialog{Filter="JSON (*.json)|*.json",FileName=Build.Test?Path.Combine(folder,"workspace-events.json"):"workspace-events.json",InitialDirectory=folder,RestoreDirectory=true}){if(dlg.ShowDialog(this)==DialogResult.OK){string dest=dlg.FileName;await Task.Run(()=>C.Atomic(dest,arg));}else result=false;}}finally{tasks--;}break;
       case "read":case "write":
         bool voteHistory=view=="votes" && arg=="vote-history";
         if(arg!="saved"&&arg!="settings"&&!voteHistory)throw new ArgumentException();string path=Path.Combine(C.User,arg+".json");
         if(cmd=="read")result=C.Read(path,arg=="settings"?"{}":"[]");else{if(quitting)throw new IOException("正在重启");tasks++;try{C.Atomic(path,val);if(!voteHistory)Broadcast("changed",arg);}finally{tasks--;}}break;
       case "bookmark":
         if(quitting)throw new IOException("正在重启");tasks++;
         try{var path2=Path.Combine(C.User,"saved.json");var saved=C.Json.Deserialize<List<Dictionary<string,object>>>(C.Read(path2,"[]"));var item=C.Obj(val);string key=C.Str(item,"id");saved.RemoveAll(x=>C.Str(x,"id")==key);if(arg=="add")saved.Insert(0,item);C.Atomic(path2,C.Json.Serialize(saved));Broadcast("changed","saved");}finally{tasks--;}break;
       default:throw new ArgumentException("未知操作");
       }Send("reply",new {id=id,result=result});
    }catch(Exception ex){Send("reply",new {id=id,error=ex.Message});}
 }
 [STAThread] static void Main(string[] args){if(args.Length==0&&C.InstallFromExtractedPayload())return;C.Init();if(Build.Test && File.Exists(Path.Combine(C.Root,"test-offline")))System.Net.WebRequest.DefaultWebProxy=new System.Net.WebProxy("http://127.0.0.1:1",false);using(var m=new Mutex(false,C.Lock("app"))){if(!C.Own(m,0))return;
 try{Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);token=args.FirstOrDefault();update=new Updates(()=>Broadcast("update",update.State()),Restart);Application.Run(new Desk("main",""));}finally{LocalTranslation.Stop();m.ReleaseMutex();}}}
}
