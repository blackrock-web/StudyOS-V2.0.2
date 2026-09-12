# Build + install StudyOS Desktop on Windows (creates Desktop + Start Menu icons)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$Root\package.json")) { $Root = Get-Location }

Write-Host "=== StudyOS Desktop installer ===" -ForegroundColor Cyan
Write-Host "Project: $Root"

# 1) Remove old installs
& "$PSScriptRoot\uninstall-studyos-windows.ps1"

# 2) Require Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required. Install from https://nodejs.org (LTS) and re-run." -ForegroundColor Red
  exit 1
}

Set-Location $Root
Write-Host "Installing dependencies..."
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Building desktop application (NSIS installer + portable)..."
npm run electron:build:win
if ($LASTEXITCODE -ne 0) { throw "electron build failed" }

$release = Join-Path $Root 'release'
$setup = Get-ChildItem $release -Filter '*Setup*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $setup) {
  $setup = Get-ChildItem $release -Filter '*.exe' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'portable' } | Select-Object -First 1
}

if ($setup) {
  Write-Host "Running installer: $($setup.FullName)" -ForegroundColor Green
  Start-Process -FilePath $setup.FullName -Wait
  Write-Host "Installation finished. Look for 'StudyOS Desktop' on your Desktop and Start Menu." -ForegroundColor Green
} else {
  Write-Host "Build completed. Open the 'release' folder and run the Setup .exe to install." -ForegroundColor Yellow
  if (Test-Path $release) { Start-Process explorer.exe $release }
}
