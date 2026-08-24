# Wait for Docker Desktop engine (after install/first start)
param([int]$TimeoutSec = 180)
$ErrorActionPreference = 'SilentlyContinue'
$candidates = @(
  "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
  "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
  "$env:LOCALAPPDATA\Docker\resources\bin\docker.exe"
)
$docker = $null
foreach ($c in $candidates) { if (Test-Path $c) { $docker = $c; break } }
if (-not $docker) { $docker = (Get-Command docker -ErrorAction SilentlyContinue).Source }
if (-not $docker) {
  Write-Host "FAIL: docker.exe not found. Finish Docker Desktop install and reboot if prompted."
  exit 1
}
$desktop = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (Test-Path $desktop) {
  $running = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
  if (-not $running) {
    Write-Host "Starting Docker Desktop..."
    Start-Process -FilePath $desktop
  }
}
Write-Host "Waiting for docker info (max ${TimeoutSec}s)..."
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  & $docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Docker engine ready"
    & $docker version
    exit 0
  }
  Start-Sleep -Seconds 3
}
Write-Host "FAIL: Docker not ready — open Docker Desktop manually, wait for whale icon green"
exit 1
