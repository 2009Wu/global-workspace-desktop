param([Parameter(Mandatory)][string]$Install,[Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$client=Get-Process Client | Where-Object { $_.Path -and $_.Path.StartsWith($Install+'\',[StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
if(!$client){throw 'Isolated test process not found'}
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TestSaveWindow {
 public delegate bool Visit(IntPtr hwnd,IntPtr unused);
 [DllImport("user32.dll")] static extern bool EnumWindows(Visit call,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,Visit call,IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int length);
 [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr hwnd,int id);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd,int msg,IntPtr param,string text);
 [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd,int msg,IntPtr param,IntPtr data);
 public static IntPtr Find(int pid){IntPtr d=IntPtr.Zero;EnumWindows(delegate(IntPtr h,IntPtr dummy){uint p;GetWindowThreadProcessId(h,out p);if(p==pid&&Class(h)=="#32770"){d=h;return false;}return true;},IntPtr.Zero);return d;}
 static string Class(IntPtr h){var b=new StringBuilder(150);GetClassName(h,b,b.Capacity);return b.ToString();}
 public static bool Write(IntPtr d,string path){
 IntPtr edit=IntPtr.Zero;EnumChildWindows(d,delegate(IntPtr h,IntPtr dummy){if(Class(h)=="Edit"&&(GetDlgCtrlID(h)==1001||GetDlgCtrlID(h)==0x480)){edit=h;return false;}return true;},IntPtr.Zero);
 IntPtr ok=GetDlgItem(d,1);if(edit==IntPtr.Zero||ok==IntPtr.Zero)return false;
 PostMessage(ok,245,IntPtr.Zero,IntPtr.Zero);return true;}
}
"@
$deadline=(Get-Date).AddSeconds(8)
do{$handle=[TestSaveWindow]::Find($client.Id);if($handle -ne [IntPtr]::Zero -and [TestSaveWindow]::Write($handle,$Destination)){exit 0};Start-Sleep -Milliseconds 150}while((Get-Date) -lt $deadline)
$pc=New-Object System.Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,$client.Id)
$root=[Windows.Automation.AutomationElement]::RootElement
foreach($win in $root.FindAll([Windows.Automation.TreeScope]::Children,$pc)){
 if($win.Current.ClassName -ne '#32770'){continue}
 $controls=$win.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
 $edit=$controls | Where-Object {$_.Current.ControlType -eq [Windows.Automation.ControlType]::Edit -and $_.Current.AutomationId -eq '1001'} | Select-Object -First 1
 $ok=$controls | Where-Object {$_.Current.ControlType -eq [Windows.Automation.ControlType]::Button -and $_.Current.AutomationId -eq '1'} | Select-Object -First 1
 if($edit -and $ok){$ok.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke();exit 0}
}
throw 'The test Save As dialog was not ready'

