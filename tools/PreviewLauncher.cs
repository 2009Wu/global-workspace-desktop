using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal static class PreviewLauncher {
    const string Title = "世界情报收集处（Qwen 14B 体验版）";
    const string Product = "io.littlewang.globalworkspace.preview.qwen14";
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);

    static void RepairShortcut(string root) {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var exe = Application.ExecutablePath;
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        string path = null;
        foreach (var file in Directory.EnumerateFiles(desktop, "*.lnk")) {
            try {
                dynamic existing = shell.CreateShortcut(file);
                if ((string)existing.Description == Product ||
                    String.Equals((string)existing.TargetPath, exe, StringComparison.OrdinalIgnoreCase)) {
                    path = file;
                    break;
                }
            } catch (COMException) { }
        }
        if (path == null) {
            path = Path.Combine(desktop, Title + ".lnk");
            for (int suffix = 2; File.Exists(path); suffix++)
                path = Path.Combine(desktop, Title + " (" + suffix + ").lnk");
        }
        dynamic link = shell.CreateShortcut(path);
        string icon = exe + ",0";
        if ((string)link.TargetPath == exe && (string)link.Arguments == "" &&
            (string)link.WorkingDirectory == root && (string)link.IconLocation == icon &&
            (string)link.Description == Product) return;
        link.TargetPath = exe;
        link.Arguments = "";
        link.WorkingDirectory = root;
        link.IconLocation = icon;
        link.Description = Product;
        link.Save();
    }

    static bool ActivateExisting(string client) {
        foreach (var item in Process.GetProcessesByName("Client")) {
            using (item) {
                try {
                    if (!String.Equals(item.MainModule.FileName, client, StringComparison.OrdinalIgnoreCase)) continue;
                    var window = item.MainWindowHandle;
                    if (window == IntPtr.Zero) continue;
                    if (IsIconic(window)) ShowWindowAsync(window, 9);
                    SetForegroundWindow(window);
                    return true;
                } catch (InvalidOperationException) { } catch (System.ComponentModel.Win32Exception) { }
            }
        }
        return false;
    }

    [STAThread] static void Main() {
        try {
            var root = Path.GetDirectoryName(Application.ExecutablePath);
            var client = Path.Combine(root, "app", "Client.exe");
            if (!File.Exists(client)) throw new FileNotFoundException("请先解压整个体验版文件夹。", client);
            using (var gate = new Mutex(false, @"Local\" + Product + ".launcher")) {
                try { if (!gate.WaitOne(5000)) return; } catch (AbandonedMutexException) { }
                try {
                    try { RepairShortcut(root); }
                    catch (Exception e) { MessageBox.Show("创建桌面快捷方式失败：" + e.Message, Title); }
                    if (ActivateExisting(client)) return;
                    var start = new ProcessStartInfo(client) {
                        WorkingDirectory = Path.GetDirectoryName(client), UseShellExecute = false
                    };
                    var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    start.EnvironmentVariables["ATLAS_TEST_HOME"] = Path.Combine(local, "LittleWang", "ReadingPreview040");
                    start.EnvironmentVariables.Remove("ATLAS_TEST_PORT");
                    start.EnvironmentVariables["DESK_QWEN_MODELS"] = Path.Combine(root, "models");
                    start.EnvironmentVariables["DESK_SMALL_MODELS"] = Path.Combine(local, "LittleWang", "GlobalWorkspace", "user", "models");
                    start.EnvironmentVariables["DESK_FAST_MODELS"] = Path.GetFullPath(Path.Combine(root, "..", "..", "work", "offline-quality-hymt2"));
                    start.EnvironmentVariables["DESK_REVIEW_MODELS"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "LocalModels", "qwen3.8-27b-q4km");
                    using (var process = Process.Start(start)) { }
                } finally { gate.ReleaseMutex(); }
            }
        } catch (Exception e) { MessageBox.Show(e.Message, Title); }
    }
}
