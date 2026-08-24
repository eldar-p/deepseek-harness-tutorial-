# Upload dist/deep-cli-*.zip to GitHub Release v0.2.0-alpha (requires gh auth).
# Usage: powershell -File .\scripts\publish-release.ps1 [-Tag v0.2.0-alpha]
param(
  [string]$Tag = "v0.2.0-alpha"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "Packing…"
npm run pack:release
$zip = Get-ChildItem dist\deep-cli-*.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) { throw "no zip in dist/" }
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
  Write-Host ""
  Write-Host "Update manifests/cli-releases.json sha256 to: $sha"
  exit 2
}

$exists = gh release view $Tag 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating release $Tag…"
  gh release create $Tag --title "Deep CLI $Tag" --notes "CC BY-NC-SA 4.0. See CHANGELOG.md / ALPHA.md." --target main
}
gh release upload $Tag $zip.FullName --clobber
Write-Host "[OK] uploaded $($zip.Name) to $Tag"
Write-Host "Verify: gh release view $Tag"
Write-Host "Remember: sha256 in cli-releases.json must be $sha"
