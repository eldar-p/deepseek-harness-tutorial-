# Start DeepSeek Harness web UI (local YOLO + LM Studio).
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
foreach ($cand in @(
  (Join-Path $here "env.ps1"),
  (Join-Path $here "..\env.ps1")
)) { if (Test-Path $cand) { . $cand; break } }

if (-not $env:DSH_HOME) { throw "DSH_HOME missing — run install.ps1 / set env.ps1" }
if (-not $env:HOST_SHARE) { throw "HOST_SHARE missing — set env.ps1" }
if (-not $env:LM_STUDIO_API_KEY) { $env:LM_STUDIO_API_KEY = "lm-studio" }
$env:DSH_PERMISSION_MODE = if ($env:DSH_PERMISSION_MODE) { $env:DSH_PERMISSION_MODE } else { "danger-full-access" }
$env:VM_EXEC = Join-Path $here "vm-exec.ps1"

Get-Content (Join-Path $env:DSH_HOME ".env") -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim() }
}

New-Item -ItemType Directory -Force -Path $env:DSH_HOME | Out-Null
$j = Join-Path $here "ensure-hostshare-junction.ps1"
if (Test-Path $j) { & $j }

$dsh = if ($env:DSH_BIN) { $env:DSH_BIN } else { "dsh" }
if ($dsh -ne "dsh" -and -not (Test-Path $dsh)) { throw "dsh missing: $dsh" }

Write-Host "UI=http://127.0.0.1:3080  LM Studio=http://127.0.0.1:1234/v1"
Write-Host "HOST_SHARE=$($env:HOST_SHARE)  permission=$($env:DSH_PERMISSION_MODE)"
Set-Location $env:HOST_SHARE
& $dsh web --no-open --port 3080
