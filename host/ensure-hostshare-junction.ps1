# Junction for hallucinated paths like D:\mnt\hostshare → real HOST_SHARE
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
foreach ($cand in @(
  (Join-Path $here "env.ps1"),
  (Join-Path $here "..\env.ps1")
)) { if (Test-Path $cand) { . $cand; break } }

$share = $env:HOST_SHARE
if (-not $share) { throw "HOST_SHARE not set" }
$link = if ($env:HOSTSHARE_JUNCTION) { $env:HOSTSHARE_JUNCTION } else { "D:\mnt\hostshare" }

$parent = Split-Path $link -Parent
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
if (Test-Path $link) {
  $item = Get-Item $link -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Host "[OK] junction exists: $link"
    exit 0
  }
  throw "Path exists and is not a junction: $link"
}
cmd /c mklink /J "$link" "$share"
Write-Host "[OK] $link → $share"
