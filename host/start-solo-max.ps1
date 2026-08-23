# Solo coder — one LM Studio model, max GPU.
# Requires env.ps1 next to this script OR repo root env.ps1
$ErrorActionPreference = "Continue"
$here = $PSScriptRoot
foreach ($cand in @(
  (Join-Path $here "env.ps1"),
  (Join-Path $here "..\env.ps1")
)) { if (Test-Path $cand) { . $cand; break } }

if (-not $env:DSH_HOME) { $env:DSH_HOME = Join-Path $env:USERPROFILE ".dsh" }
if (-not $env:LM_STUDIO_API_KEY) { $env:LM_STUDIO_API_KEY = "lm-studio" }
$env:DSH_PERMISSION_MODE = if ($env:DSH_PERMISSION_MODE) { $env:DSH_PERMISSION_MODE } else { "danger-full-access" }

$model = if ($env:LM_STUDIO_MODEL) { $env:LM_STUDIO_MODEL } else { throw "Set LM_STUDIO_MODEL in env.ps1" }
$ctx = if ($env:LM_STUDIO_CTX) { [int]$env:LM_STUDIO_CTX } else { 98304 }
$id = if ($env:LM_STUDIO_ID) { $env:LM_STUDIO_ID } else { "coder" }

Write-Host "=== Unload all ==="
lms unload --all 2>$null
Start-Sleep 3

Write-Host "=== Load $model ctx=$ctx id=$id ==="
$ok = $false
& lms load $model -c $ctx --gpu max --parallel 1 --identifier $id --speculative-decoding-draft-model-mtp -y 2>$null
if ($LASTEXITCODE -eq 0) { $ok = $true; Write-Host "Loaded with MTP" }
else {
  & lms load $model -c $ctx --gpu max --parallel 1 --identifier $id -y
  $ok = ($LASTEXITCODE -eq 0)
}
if (-not $ok) { throw "lms load failed" }
lms ps
Write-Host "Next: start-dsh.ps1"
