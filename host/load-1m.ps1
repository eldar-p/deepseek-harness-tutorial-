# Load Unsloth Qwen3-Coder 30B 1M YaRN GGUF. Weights on GPU, KV on CPU (16GB VRAM cannot hold 1M KV).
$ErrorActionPreference = "Stop"
$lms = Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"
$gguf = "F:\LMstudio_Models\unsloth\Qwen3-Coder-30B-A3B-Instruct-1M-GGUF\Qwen3-Coder-30B-A3B-Instruct-1M-Q3_K_M.gguf"
if (-not (Test-Path $gguf)) { throw "GGUF missing: $gguf" }
& $lms server start | Out-Null
& $lms import $gguf --user-repo "unsloth/Qwen3-Coder-30B-A3B-Instruct-1M-GGUF" -L -y
& $lms unload --all -y 2>$null | Out-Null
# 1M tokens of Qwen3-30B-A3B KV is ~24GB q4 / ~48GB q8. This box has 64GB RAM + 8GB VM.
# Start at 1M; if the process dies, edit -c down to 262144.
& $lms load "qwen3-coder-30b-a3b-instruct-1m" --gpu max -c 1048576 --parallel 1 --identifier "qwen3-coder-30b-a3b-instruct-1m" -y
Write-Host "API http://127.0.0.1:1234/v1  model=qwen3-coder-30b-a3b-instruct-1m  context=1048576 (KV should stay on CPU; if CUDA OOM, reload from LM Studio with Offload KV cache to GPU = OFF)"
