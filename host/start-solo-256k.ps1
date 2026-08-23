# Solo CODER at 256K — long context, slower than start-solo-max.ps1 (96K + GPU max).
$ErrorActionPreference = "Continue"
$model = "huihui-qwen3-coder-30b-a3b-instruct-abliterated"
Write-Host "=== Unload ==="
lms unload --all 2>$null
Start-Sleep 2
Write-Host "=== CODER GPU-heavy, ctx 256K (prefer start-solo-max.ps1 for speed) ==="
lms load $model -c 262144 --gpu 0.85 --parallel 1 --identifier coder -y
lms ps
Write-Host "Single id: coder. Next: start-dsh.ps1"
