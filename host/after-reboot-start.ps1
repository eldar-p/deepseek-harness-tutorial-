# After reboot: VM → LM Studio coder → DSH
$ErrorActionPreference = "Continue"
$here = $PSScriptRoot
foreach ($cand in @(
  (Join-Path $here "env.ps1"),
  (Join-Path $here "..\env.ps1")
)) { if (Test-Path $cand) { . $cand; break } }

$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
$vmName = if ($env:VM_NAME) { $env:VM_NAME } else { "debian-agent" }

function Wait-Port([int]$Port, [int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $true }
    Start-Sleep 2
  }
  return $false
}

Write-Host "=== 1) VM $vmName ==="
if (Test-Path $vbox) {
  $running = & $vbox list runningvms 2>$null
  if ($running -match [regex]::Escape("`"$vmName`"")) {
    Write-Host "[OK] VM already running"
  } else {
    & $vbox startvm $vmName --type headless
    Start-Sleep 8
  }
  if (Wait-Port 2222 120) { Write-Host "[OK] SSH :2222" } else { Write-Host "[FAIL] SSH :2222" }
  if (Wait-Port 9050 30) { Write-Host "[OK] Tor :9050" } else { Write-Host "[WARN] Tor :9050 not up yet" }
}

Write-Host "=== 2) LM Studio model ==="
& (Join-Path $here "start-solo-max.ps1")

Write-Host "=== 3) DSH ==="
if (Wait-Port 3080 5) {
  Write-Host "[OK] DSH already on :3080"
} else {
  Start-Process powershell -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $here "start-dsh.ps1")
  ) -WindowStyle Hidden
  if (Wait-Port 3080 60) { Write-Host "[OK] http://127.0.0.1:3080" } else { Write-Host "[FAIL] DSH" }
}

Write-Host "Open a NEW chat in the UI."
