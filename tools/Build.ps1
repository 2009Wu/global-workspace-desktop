[CmdletBinding()]
param([string]$OutputDirectory, [string]$TestVersion, [string]$TestFeed, [switch]$Release)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$config=Get-Content -LiteralPath (Join-Path $project 'product.json') -Raw | ConvertFrom-Json
$testMode=[bool]$TestVersion
$ver=if($testMode){$TestVersion}else{$config.version}
if($ver -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'){throw 'Version must be X.Y.Z'}
if($Release -and ($testMode -or $config.repository -notmatch '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$')){throw 'Set the permanent GitHub repository in product.json before making the first public release.'}
if($testMode -and $TestFeed -notmatch '^http://127\.0\.0\.1:\d+/repos/test/workspace/releases/latest$'){throw 'Only a loopback simulated release endpoint is accepted in test builds.'}
if (!$OutputDirectory){$OutputDirectory=Join-Path $project 'release'}
$out=[IO.Path]::GetFullPath($OutputDirectory);New-Item -ItemType Directory -Force $out | Out-Null
$tmp=Join-Path ([IO.Path]::GetTempPath()) ('workspace-build-'+[guid]::NewGuid().ToString('N'))
$payload=Join-Path $tmp 'package/payload';New-Item -ItemType Directory -Force $payload | Out-Null
$repo=$config.repository;$feed=if($testMode){$TestFeed}elseif($repo){"https://api.github.com/repos/$repo/releases/latest"}else{''}
$prod=if($testMode){$config.product+'.test.'+([uri]$TestFeed).Port}else{$config.product}
$cs='using System.Reflection;[assembly:AssemblyVersion("'+$ver+'.0")][assembly:AssemblyFileVersion("'+$ver+'.0")] internal static class Build { public const string Version="'+$ver+'", Product="'+$prod+'", Repo="'+$repo+'", Asset="'+$config.asset+'", Feed="'+$feed+'"; public const bool Test='+$testMode.ToString().ToLower()+'; }'
$gen=Join-Path $tmp 'Build.cs';[IO.File]::WriteAllText($gen,$cs)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
function FileSha([string]$path){
 $h=[Security.Cryptography.SHA256]::Create();$f=[IO.File]::OpenRead($path)
 try{return [BitConverter]::ToString($h.ComputeHash($f)).Replace('-','').ToLower()}finally{$f.Dispose();$h.Dispose()}
}
function Compile([string]$name,[string[]]$files,[string[]]$refs){
    $base=@('/nologo','/target:winexe','/platform:x64','/optimize+','/codepage:65001','/nowarn:0162,0429,0219',"/win32icon:$project/icon.ico","/out:$payload/$name.exe",'/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:Microsoft.CSharp.dll','/r:System.Core.dll')
    & $compiler @base @($refs|ForEach-Object {"/r:$_"}) $gen @($files|ForEach-Object {Join-Path $project "src/$_"})
    if($LASTEXITCODE){throw "Compilation failed for $name"}
}
try{
$compress=@('System.IO.Compression.dll','System.IO.Compression.FileSystem.dll')
Compile 'GlobalWorkspace' @('Common.cs','Launcher.cs') @()
Compile 'Maintenance' @('Common.cs','Package.cs','Maintenance.cs') $compress
Compile 'Client' @('Common.cs','Package.cs','Network.cs','Updates.cs','Client.cs') ($compress+@('System.Drawing.dll','System.Security.dll','System.Net.Http.dll',"$project/vendor/Microsoft.Web.WebView2.Core.dll","$project/vendor/Microsoft.Web.WebView2.WinForms.dll"))
Copy-Item "$project/vendor/*" $payload
Copy-Item -Recurse "$project/ui" $payload
Copy-Item "$payload/Maintenance.exe" "$tmp/package/Install.exe"
$files=[ordered]@{};Get-ChildItem $payload -Recurse -File | Sort-Object FullName | ForEach-Object {$n='payload/'+$_.FullName.Substring($payload.Length+1).Replace('\','/');$files[$n]=(FileSha $_.FullName)}
$utf=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText("$tmp/package/manifest.json",(@{product=$prod;version=$ver;files=$files}|ConvertTo-Json -Depth 5),$utf)
Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
$zip=Join-Path $out $config.asset;$built=Join-Path $tmp $config.asset
$archive=[IO.Compression.ZipFile]::Open($built,[IO.Compression.ZipArchiveMode]::Create)
try{
 $packageDir=(Resolve-Path "$tmp/package").Path
 foreach($file in Get-ChildItem -LiteralPath $packageDir -File -Recurse | Sort-Object FullName){
   $entry=$file.FullName.Substring($packageDir.Length+1).Replace([IO.Path]::DirectorySeparatorChar,[char]47)
   [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$entry,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
 }
}finally{$archive.Dispose()}
Copy-Item $built $zip -Force
$hash=(FileSha $zip)
[IO.File]::WriteAllText("$zip.sha256","$hash  $($config.asset)",$utf)
[IO.File]::WriteAllText("$out/update.json",(@{product=$prod;version=$ver;asset=$config.asset;bytes=(Get-Item $zip).Length;sha256=$hash}|ConvertTo-Json),$utf)
Write-Output "Built $zip ($ver)"
}finally{if(([IO.Path]::GetFullPath($tmp)).StartsWith(([IO.Path]::GetTempPath()).TrimEnd('\')+'\workspace-build-',[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $tmp -Recurse -Force}}

