[CmdletBinding()]
param([Parameter(Mandatory)][string]$NotesFile)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$config=Get-Content -LiteralPath (Join-Path $project 'product.json') -Raw|ConvertFrom-Json
$notes=(Resolve-Path -LiteralPath $NotesFile).Path
$tag='v'+$config.version;$repo=$config.repository
function Checked([string]$exe,[string[]]$arguments){& $exe @arguments;if($LASTEXITCODE){throw "$exe failed ($LASTEXITCODE)"}}
Push-Location $project
try{
 if(git status --porcelain --untracked-files=normal){throw 'Commit the intended source before publishing.'}
 $head=(git rev-parse HEAD).Trim()
 $remote=(git ls-remote origin refs/heads/main) -split '\s+'
 if($remote[0] -ne $head){throw 'Push the intended commit to origin/main first.'}
 $items=gh release list --repo $repo --limit 1000 --json tagName,isDraft
 if($LASTEXITCODE){throw 'Unable to read release history'}
 $match=@($items|ConvertFrom-Json|Where-Object {$_.tagName -ceq $tag})
 $current=if($match.Count){$match[0].isDraft.ToString().ToLower()}else{''}
 if($current -eq 'false'){throw 'Version already published. Increment product.json.'}
 $t=git ls-remote origin "refs/tags/$tag" "refs/tags/$tag^{}"
 if($t){$commits=$t | ForEach-Object {($_ -split '\s+')[0]};if($commits -notcontains $head){throw 'The existing tag points to a different commit.'}}
 & (Join-Path $PSScriptRoot 'Build.ps1') -Release
 if(!$current){Checked gh @('release','create',$tag,'--repo',$repo,'--target',$head,'--title',$tag,'--notes-file',$notes,'--draft')}
 $out=Join-Path $project 'release'
 Checked gh @('release','upload',$tag,(Join-Path $out $config.asset),(Join-Path $out ($config.asset+'.sha256')),(Join-Path $out 'update.json'),'--repo',$repo,'--clobber')
 Checked gh @('release','edit',$tag,'--repo',$repo,'--notes-file',$notes,'--draft=false','--latest')
}finally{Pop-Location}

