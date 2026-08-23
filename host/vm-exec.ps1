# Run bash inside the Debian VM over SSH (never on the Windows host).
# Usage:
#   powershell -File host\vm-exec.ps1 -Command 'uname -a'
#   powershell -File host\vm-exec.ps1 -- ls -la /mnt/hostshare
#
# Env (optional): VM_SSH_HOST VM_SSH_PORT VM_SSH_USER VM_SSH_KEY
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandParts,
  [string]$Command = "",
  [int]$TimeoutSec = 7200
)
$ErrorActionPreference = "Stop"

$hostName = if ($env:VM_SSH_HOST) { $env:VM_SSH_HOST } else { "127.0.0.1" }
$port = if ($env:VM_SSH_PORT) { $env:VM_SSH_PORT } else { "2222" }
$user = if ($env:VM_SSH_USER) { $env:VM_SSH_USER } else { "kodachi" }
$key = if ($env:VM_SSH_KEY) { $env:VM_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_ed25519" }
if (-not (Test-Path $key)) { throw "SSH key missing: $key" }

$cmd = if ($Command) { $Command } else { ($CommandParts -join " ").Trim() }
if (-not $cmd) { throw "Empty command. Pass -Command '...' or args after --" }
if ($cmd.StartsWith("-- ")) { $cmd = $cmd.Substring(3).Trim() }

$sshArgs = @(
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=NUL",
  "-o", "LogLevel=ERROR",
  "-o", "ConnectTimeout=8",
  "-o", "ServerAliveInterval=30",
  "-o", "ServerAliveCountMax=120",
  "-i", $key,
  "-p", $port,
  "${user}@${hostName}",
  "bash -lc " + ("'" + ($cmd -replace "'", "'\''") + "'")
)

$outFile = "$env:TEMP\vm-exec-out.txt"
$errFile = "$env:TEMP\vm-exec-err.txt"
$p = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -NoNewWindow -PassThru `
  -RedirectStandardOutput $outFile `
  -RedirectStandardError $errFile

if ($TimeoutSec -le 0) {
  Wait-Process -Id $p.Id
} else {
  $ok = $p.WaitForExit($TimeoutSec * 1000)
  if (-not $ok) {
    try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
    Write-Error "vm-exec timed out after ${TimeoutSec}s. Use -TimeoutSec 0 for unlimited."
    exit 124
  }
}

$out = Get-Content $outFile -Raw -ErrorAction SilentlyContinue
$err = Get-Content $errFile -Raw -ErrorAction SilentlyContinue
if ($out) { Write-Output $out.TrimEnd() }
if ($err) { Write-Output $err.TrimEnd() }
exit $p.ExitCode
