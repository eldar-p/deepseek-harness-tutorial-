# Requires: gh auth login (repo scope)
# Usage: powershell -File .\scripts\upload-cdn-release.ps1
param(
  [string]$Tag = "v1.0.0",
  [string]$ZipName = "deep-cli-1.0.0.zip"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }

& $gh auth status
if ($LASTEXITCODE -ne 0) { throw "Run: gh auth login  (then re-run this script)" }

$zip = Join-Path $Root "dist\$ZipName"
$side = "$zip.sha256"
if (-not (Test-Path $zip)) { throw "missing $zip — run: node scripts/pack-release.mjs --version=1.0.0" }
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
Set-Content -Path $side -Value "$sha  $ZipName`n" -NoNewline:$false -Encoding ascii
Write-Host "Uploading $ZipName (sha256=$sha) → $Tag"

$view = & $gh release view $Tag 2>$null
if ($LASTEXITCODE -ne 0) {
  & $gh release create $Tag $zip $side `
    --title "Deep CLI $Tag" `
    --notes "CC BY-NC-SA 4.0. CDN artifact for ``deep update``. See RELEASE.md / CHANGELOG.md." `
    --target main
} else {
  & $gh release upload $Tag $zip $side --clobber
}

Write-Host "[OK] https://github.com/eldar-p/deepseek-harness-tutorial-/releases/tag/$Tag"
& $gh release view $Tag
