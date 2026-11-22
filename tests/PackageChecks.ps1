param([string]$Archive)
$ErrorActionPreference='Stop';$project=Split-Path $PSScriptRoot -Parent
$config=Get-Content "$project/product.json" -Raw | ConvertFrom-Json
if(!$Archive){$Archive=Join-Path "$project/release" $config.asset}
$exe=Join-Path ([IO.Path]::GetTempPath()) ('gw-package-test-'+[guid]::NewGuid().ToString('N')+'.exe')
try{
 & "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /codepage:65001 "/out:$exe" /r:System.Web.Extensions.dll /r:Microsoft.CSharp.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll (Join-Path $project "src\Common.cs") (Join-Path $project "src\Package.cs") (Join-Path $PSScriptRoot "PackageChecks.cs")
 if($LASTEXITCODE){throw 'Compile failed'};& $exe $Archive $config.version;if($LASTEXITCODE){throw 'Package verification tests failed'}
}finally{if(Test-Path -LiteralPath $exe){Remove-Item -LiteralPath $exe}}

