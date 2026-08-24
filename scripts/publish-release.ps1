# Upload dist/deep-cli-*.zip (+ .sha256) to GitHub Release (requires gh auth).
# Usage: powershell -File .\scripts\publish-release.ps1 [-Tag v0.3.0-prebeta]
param(
  [string]$Tag = "v0.5.0"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "Packing…"
npm run pack:release
$zip = Get-ChildItem dist\deep-cli-*.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) { throw "no zip in dist/" }
$side = "$($zip.FullName).sha256"
Write-Host "Zip: $($zip.FullName)"
$sha = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash.ToLower()
Write-Host "sha256: $sha"

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  Write-Host ""
  Write-Host "gh CLI not found. Install: https://cli.github.com/"
  Write-Host "Then: gh auth login"
  Write-Host "Then re-run this script, or manually:"
  Write-Host "  gh release upload $Tag `"$($zip.FullName)`" --clobber"
  if (Test-Path $side) { Write-Host "  gh release upload $Tag `"$side`" --clobber" }
  Write-Host ""
  Write-Host "Update manifests/cli-releases.json sha256 to: $sha"
  exit 2
}

$exists = gh release view $Tag 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating release $Tag…"
  gh release create $Tag --title "Deep CLI $Tag" --notes "CC BY-NC-SA 4.0. See CHANGELOG.md / PRE-BETA.md." --target main
}
gh release upload $Tag $zip.FullName --clobber
if (Test-Path $side) { gh release upload $Tag $side --clobber }
Write-Host "[OK] uploaded $($zip.Name) to $Tag"
Write-Host "Verify: gh release view $Tag"
Write-Host "Remember: sha256 in cli-releases.json must be $sha"
