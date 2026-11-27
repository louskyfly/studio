# Déploie Studio sur le compte GitHub dédié (jamais louskyfly).
# Usage : powershell -ExecutionPolicy Bypass -File .\scripts\deploy-github.ps1 -Repo studio
param(
  [string]$Repo = "studio",
  [switch]$Private
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$account = (gh api user --jq .login).Trim()
Write-Host "Compte GitHub actif : $account"
if ($account -eq "louskyfly") {
  throw "Le compte actif est le compte habituel. Lance 'gh auth login' avec le compte dédié, puis relance ce script."
}

$exists = $false
try {
  gh repo view "$account/$Repo" --json name | Out-Null
  $exists = $true
} catch {
  $exists = $false
}

if (-not $exists) {
  $visibility = if ($Private) { "--private" } else { "--public" }
  Write-Host "Création de $account/$Repo ($visibility)…"
  gh repo create $Repo --source . --remote origin --push $visibility
} else {
  Write-Host "Dépôt existant : envoi de main…"
  $remote = git remote get-url origin 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $remote) {
    git remote add origin "https://github.com/$account/$Repo.git"
  }
  git push -u origin main
}

Write-Host "Activation de GitHub Pages (source : GitHub Actions)…"
try {
  gh api --method POST "repos/$account/$Repo/pages" -f build_type=workflow | Out-Null
} catch {
  Write-Host "Pages déjà configuré ou activation manuelle nécessaire."
}

Start-Sleep -Seconds 3
Write-Host "Dernier déploiement :"
gh run list --repo "$account/$Repo" --limit 1

Write-Host ""
Write-Host "URL attendue : https://$account.github.io/$Repo/"
Write-Host "Suivre le déploiement : gh run watch --repo $account/$Repo"
