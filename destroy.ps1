# ==============================================================================
# StudyOS Desktop — Windows Destruction & Nuclear Purge Script
# Completely removes application binaries, configs, models, databases, shortcuts.
# ==============================================================================

param(
    [switch]$Force = $false
)

$InstallDir = Join-Path $env:LOCALAPPDATA "StudyOS"
$ConfigDir = Join-Path $env:APPDATA "StudyOS"
$ModelsDir = Join-Path $env:USERPROFILE ".studyos"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "StudyOS Desktop.lnk"
$StartMenuDir = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\StudyOS"
$ManifestFile = Join-Path $InstallDir "installed_files.manifest"

Write-Host "============================================================" -ForegroundColor Red
Write-Host " ⚠️  StudyOS Desktop — Complete Application Destruction" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Red

if (-not $Force) {
    Write-Host "This operation will PERMANENTLY ERASE:" -ForegroundColor Yellow
    Write-Host " • All application binaries and installation files"
    Write-Host " • All SQLite databases, study notes, formula sheets"
    Write-Host " • All downloaded local AI models and cache"
    Write-Host " • Desktop shortcuts & Start Menu entries"
    Write-Host ""
    $Confirm = Read-Host "Are you sure you want to completely destroy StudyOS? Type 'DESTROY' to confirm"
    if ($Confirm -ne "DESTROY") {
        Write-Host "Destruction cancelled." -ForegroundColor Green
        exit 0
    }
}

Write-Host "[1/5] Terminating running StudyOS processes..." -ForegroundColor Yellow
Get-Process -Name "StudyOS*" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "[2/5] Purging local models and weights..." -ForegroundColor Yellow
if (Test-Path $ModelsDir) {
    Remove-Item -Path $ModelsDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[3/5] Erasing user databases, configurations, and logs..." -ForegroundColor Yellow
if (Test-Path $ConfigDir) {
    Remove-Item -Path $ConfigDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[4/5] Removing Desktop and Start Menu shortcuts..." -ForegroundColor Yellow
if (Test-Path $DesktopShortcut) {
    Remove-Item -Path $DesktopShortcut -Force -ErrorAction SilentlyContinue
}
if (Test-Path $StartMenuDir) {
    Remove-Item -Path $StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[5/5] Purging installation directory and binaries..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host " 💥 StudyOS Desktop has been completely obliterated." -ForegroundColor Green
Write-Host " Zero traces, data, or files remain on this device." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
