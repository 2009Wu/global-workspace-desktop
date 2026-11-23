using System;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// This view only occupies the map rectangle. It has no bridge to desktop commands.
internal sealed class CitySurface : IDisposable {
 readonly Control owner;
 WebView2 surface;
 public CitySurface(Control owner){this.owner=owner;}
 public void Dispose(){if(surface!=null){surface.Dispose();surface=null;}}
 public async Task<double[]> CloseAtCamera(){
  var web=surface;surface=null;
  if(web==null)return null;
  try{
   if(web.CoreWebView2==null || web.Source==null)return null;
   double[] result=null;
   if(web.Source.Host=="citymodel.local"){
    var json=await web.CoreWebView2.ExecuteScriptAsync("window.cityCenter?.()");
    if(json.StartsWith("["))result=Values(json.Trim('[',']'),2);
   }else if(web.Source.Host=="earth.google.com"){
    var match=System.Text.RegularExpressions.Regex.Match(web.Source.AbsolutePath,@"/@(-?[\d.]+),(-?[\d.]+),");
    if(match.Success)result=Values(match.Groups[2].Value+","+match.Groups[1].Value,2);
   }
   return result!=null&&Math.Abs(result[0])<=180&&Math.Abs(result[1])<=90?result:null;
  }catch{return null;}finally{web.Dispose();}
 }
 double[] Values(string value,int count){
  string[] fields=value.Split(',');if(fields.Length!=count)throw new ArgumentException("Invalid camera");
  var result=Array.ConvertAll(fields,v=>double.Parse(v,CultureInfo.InvariantCulture));
  foreach(double n in result)if(double.IsNaN(n)||double.IsInfinity(n))throw new ArgumentException("Invalid camera");
  return result;
 }
 public void Layout(string bounds){
  if(surface==null)return;
  if(bounds==""){surface.Visible=false;return;}
  var p=Values(bounds,4);
  var rect=Rectangle.FromLTRB((int)Math.Round(owner.ClientSize.Width*p[0]),(int)Math.Round(owner.ClientSize.Height*p[1]),
    (int)Math.Round(owner.ClientSize.Width*p[2]),(int)Math.Round(owner.ClientSize.Height*p[3]));
  surface.Bounds=Rectangle.Intersect(owner.ClientRectangle,rect);surface.Visible=!surface.Bounds.IsEmpty;
 }
 public async Task Open(CoreWebView2Environment env,string camera,string bounds){
  var p=Values(camera,4);
  if(Math.Abs(p[0])>90||Math.Abs(p[1])>180||p[2]<100||p[2]>20000000)throw new ArgumentException("Invalid coordinates");
  Dispose();var web=new WebView2();surface=web;owner.Controls.Add(web);web.BringToFront();Layout(bounds);
  try{
   await web.EnsureCoreWebView2Async(env);if(surface!=web)return;
   var core=web.CoreWebView2;core.Settings.IsWebMessageEnabled=false;core.Settings.AreHostObjectsAllowed=false;
   core.Settings.IsStatusBarEnabled=false;core.Settings.AreDevToolsEnabled=Build.Test;
   core.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
   core.NewWindowRequested+=(s,e)=>e.Handled=true;
   core.NavigationStarting+=(s,e)=>{Uri u;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out u)||u.Scheme!="https"||
     !(u.Host=="citymodel.local"||u.Host=="earth.google.com"||u.Host=="consent.google.com"))e.Cancel=true;};
   // Taipei publishes several textured meshes for direct, key-free application use.
   bool taipei=(p[0]>=25.0065&&p[0]<=25.0182&&p[1]>=121.5253&&p[1]<=121.5421)||
    (p[0]>=25.0543&&p[0]<=25.0645&&p[1]>=121.6063&&p[1]<=121.6231)||
    (p[0]>=25.0414&&p[0]<=25.0515&&p[1]>=121.5326&&p[1]<=121.5786);
   if(taipei){
    core.SetVirtualHostNameToFolderMapping("citymodel.local",Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"ui","citymodel"),CoreWebView2HostResourceAccessKind.DenyCors);
    core.Navigate("https://citymodel.local/index.html#"+camera);
   }else{
    string url=string.Format(CultureInfo.InvariantCulture,"https://earth.google.com/web/@{0:F6},{1:F6},0a,{2:F0}d,35y,{3:F1}h,58t,0r",p[0],p[1],p[2],p[3]);
    core.Navigate(url);
   }
  }catch{if(surface!=web)return;Dispose();throw;}
 }
}
