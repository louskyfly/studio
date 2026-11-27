# Publie le build Studio sur la branche gh-pages (GitHub Pages).
# Usage : powershell -ExecutionPolicy Bypass -File .\scripts\publish-pages.ps1
param(
  [string]$Message = "Publication Studio"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Construction…"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Le build a échoué." }

$remote = (git -C $root remote get-url origin).Trim()
if (-not $remote) { throw "Aucun remote origin. Configure le dépôt GitHub d'abord." }

$tmp = Join-Path $env:TEMP ("studio-pages-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item (Join-Path $root "dist\*") $tmp -Recurse -Force
New-Item -ItemType File -Path (Join-Path $tmp ".nojekyll") -Force | Out-Null

Push-Location $tmp
try {
  git init -q -b gh-pages
  git config user.name "Studio"
  git config user.email "studio@users.noreply.github.com"
  git add -A
  git commit -q -m $Message
  git remote add origin $remote
  git push --force origin gh-pages
} finally {
  Pop-Location
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Publié. GitHub Pages reconstruit en une à deux minutes."
