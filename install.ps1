# Install this repo into DSH_HOME + HOST_SHARE.
#   copy env.example → env.ps1, edit paths
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$EnvFile = Join-Path $Root "env.ps1"
if (-not (Test-Path $EnvFile)) {
  Copy-Item (Join-Path $Root "env.example") $EnvFile
  Write-Host "Created env.ps1 — edit paths, then re-run install.ps1"
  exit 1
}
. $EnvFile

if (-not $env:DSH_HOME) { throw "DSH_HOME not set in env.ps1" }
if (-not $env:HOST_SHARE) { throw "HOST_SHARE not set in env.ps1" }

$profileName = if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { "web" }
$profileDir = Join-Path $env:DSH_HOME "profiles\$profileName"
$pluginDst = Join-Path $profileDir "dsh-plugins"
$skillsDst = Join-Path $env:DSH_HOME "skills"
$guestDst = Join-Path $env:HOST_SHARE "guest-toolkit"
$aiDst = Join-Path $env:HOST_SHARE "ai"
$vmMount = if ($env:VM_MOUNT) { $env:VM_MOUNT } else { "/mnt/hostshare" }

New-Item -ItemType Directory -Force -Path $env:DSH_HOME, $profileDir, $pluginDst, $skillsDst, $env:HOST_SHARE, $guestDst, $aiDst | Out-Null

robocopy (Join-Path $Root "dsh-plugins") $pluginDst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy (Join-Path $Root "skills") $skillsDst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy (Join-Path $Root "guest") $guestDst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy (Join-Path $Root "host") $aiDst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Copy-Item $EnvFile (Join-Path $aiDst "env.ps1") -Force

if (Test-Path (Join-Path $Root "config\.clinerules")) {
  Copy-Item (Join-Path $Root "config\.clinerules") (Join-Path $env:DSH_HOME ".clinerules") -Force
  Copy-Item (Join-Path $Root "config\.clinerules") (Join-Path $env:HOST_SHARE ".clinerules") -Force
}

$settingsDst = Join-Path $env:DSH_HOME "settings.yaml"
if (-not (Test-Path $settingsDst)) {
  Copy-Item (Join-Path $Root "config\settings.yaml") $settingsDst -Force
}

$agents = Get-Content (Join-Path $Root "config\AGENTS.md") -Raw
$agents = $agents.Replace("<HOST_SHARE>", $env:HOST_SHARE).Replace("<VM_MOUNT>", $vmMount)
Set-Content -Path (Join-Path $env:DSH_HOME "AGENTS.md") -Value $agents -Encoding utf8
Set-Content -Path (Join-Path $env:HOST_SHARE "AGENTS.md") -Value $agents -Encoding utf8
Set-Content -Path (Join-Path $guestDst "AGENTS.md") -Value $agents -Encoding utf8

$pluginBase = $pluginDst.Replace('\', '/')
$patch = Get-Content (Join-Path $Root "config\cordis.patch.yml") -Raw
$patch = $patch.Replace("__PLUGIN_DIR__", $pluginBase)
$patch = $patch.Replace("__HOST_SHARE__", $env:HOST_SHARE)
$patch = $patch.Replace("__VM_MOUNT__", $vmMount)
Set-Content -Path (Join-Path $profileDir "cordis.patch.yml") -Value $patch -Encoding utf8

$env:VM_EXEC = Join-Path $aiDst "vm-exec.ps1"

Write-Host "[OK] DSH_HOME=$($env:DSH_HOME)"
Write-Host "     plugins = $pluginDst"
Write-Host "     skills  = $skillsDst"
Write-Host "     guest   = $guestDst"
Write-Host "     host ai = $aiDst"
Write-Host "Next: host\start-solo-max.ps1 then host\start-dsh.ps1"
