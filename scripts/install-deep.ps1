param(
  [string]$Prefix = "$env:LOCALAPPDATA\deep\bin",
  [string]$Channel = "stable",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Log = Join-Path $Root "install.log"
function Log([string]$m) {
  $line = "{0} {1}" -f (Get-Date -Format o), $m
  Add-Content -Path $Log -Value $line
  Write-Host $m
}
Log "start channel=$Channel prefix=$Prefix dry=$DryRun"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Log "FAIL node missing"; exit 1 }
$major = [int]((node -p "process.versions.node.split('.')[0]"))
if ($major -lt 22) { Log "FAIL need Node >=22"; exit 1 }
New-Item -ItemType Directory -Force -Path $Prefix | Out-Null
$src = Join-Path $Root "bin\deep.js"
$cmd = Join-Path $Prefix "deep.cmd"
$content = "@echo off`r`nnode `"$src`" %*`r`n"
if ($DryRun) { Log "dry-run would write $cmd"; exit 0 }
Set-Content -Path $cmd -Value $content -Encoding ASCII
Log "wrote $cmd"
Log "Add to PATH: $Prefix"
Log "Then: deep bootstrap && deep doctor"
