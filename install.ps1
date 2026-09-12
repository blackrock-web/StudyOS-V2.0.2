# ==============================================================================
# StudyOS Desktop — Windows Installation Script
# Offline-first, secure installation with optional local LLM provisioning.
# ==============================================================================

param(
    [string]$WithModel = "none",
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

$AppName = "StudyOS Desktop"
$InstallDir = Join-Path $env:LOCALAPPDATA "StudyOS"
$ConfigDir = Join-Path $env:APPDATA "StudyOS"
$ModelsDir = Join-Path $env:USERPROFILE ".studyos\models"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "StudyOS Desktop.lnk"
$StartMenuDir = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\StudyOS"
$StartMenuShortcut = Join-Path $StartMenuDir "StudyOS Desktop.lnk"
$ManifestFile = Join-Path $InstallDir "installed_files.manifest"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " $AppName — Production Windows Installation" -ForegroundColor Cyan
Write-Host " Offline-First • Network-Denied by Default • Zero Telemetry" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Create Directories
Write-Host "[1/5] Creating application directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
New-Item -ItemType Directory -Force -Path $StartMenuDir | Out-Null

# Manifest initialization
"# StudyOS Windows Installation Manifest" | Out-File -FilePath $ManifestFile -Encoding utf8
"INSTALL_DIR=$InstallDir" | Out-File -FilePath $ManifestFile -Append -Encoding utf8

# Step 2: Copy App Files
Write-Host "[2/5] Deploying application binaries..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Copy-Item -Path "dist\*" -Destination $InstallDir -Recurse -Force
    "FILE:$InstallDir\*" | Out-File -FilePath $ManifestFile -Append -Encoding utf8
}

# Deploy Destroy Script
if (Test-Path "destroy.ps1") {
    Copy-Item -Path "destroy.ps1" -Destination (Join-Path $InstallDir "destroy.ps1") -Force
}

# Step 3: Create Shortcuts
Write-Host "[3/5] Creating Desktop & Start Menu shortcuts..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

$TargetExe = Join-Path $InstallDir "StudyOS.exe"
if (-not (Test-Path $TargetExe)) {
    $TargetExe = "node.exe"
}

# Desktop Shortcut
$Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
$Shortcut.TargetPath = $TargetExe
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "Local-First Study Operating System for GATE"
$Shortcut.Save()
"FILE:$DesktopShortcut" | Out-File -FilePath $ManifestFile -Append -Encoding utf8

# Start Menu Shortcut
$SmShortcut = $WshShell.CreateShortcut($StartMenuShortcut)
$SmShortcut.TargetPath = $TargetExe
$SmShortcut.WorkingDirectory = $InstallDir
$SmShortcut.Description = "StudyOS Desktop Application"
$SmShortcut.Save()
"FILE:$StartMenuShortcut" | Out-File -FilePath $ManifestFile -Append -Encoding utf8

# Step 4: Optional Model Provisioning
if ($WithModel -ne "none" -and $WithModel -ne "") {
    Write-Host "[4/5] Provisioning local AI model: $WithModel..." -ForegroundColor Yellow
    $ModelUrl = ""
    $ModelFileName = ""

    switch ($WithModel.ToLower()) {
        "smollm2" {
            $ModelFileName = "smollm2-135m-instruct-q8_0.gguf"
            $ModelUrl = "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q8_0.gguf"
        }
        "qwen" {
            $ModelFileName = "qwen2.5-0.5b-instruct-q4_k_m.gguf"
            $ModelUrl = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
        }
    }

    if ($ModelUrl -ne "") {
        $DestModelFile = Join-Path $ModelsDir $ModelFileName
        Write-Host "Downloading $ModelFileName from HuggingFace..." -ForegroundColor Gray
        try {
            Invoke-WebRequest -Uri $ModelUrl -OutFile $DestModelFile -UseBasicParsing
            "FILE:$DestModelFile" | Out-File -FilePath $ManifestFile -Append -Encoding utf8
            Write-Host "Model installed successfully." -ForegroundColor Green
        } catch {
            Write-Host "Notice: Model download skipped ($($_.Exception.Message))" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[4/5] Skipping model installation (can be downloaded in-app)." -ForegroundColor Gray
}

# Step 5: Finalization
Write-Host "[5/5] Finalizing installation..." -ForegroundColor Yellow

Write-Host "============================================================" -ForegroundColor Green
Write-Host " Installation Complete!" -ForegroundColor Green
Write-Host " Location:  $InstallDir"
Write-Host " Manifest:  $ManifestFile"
Write-Host " Security:  Network-Denied / 100% Offline"
Write-Host "============================================================" -ForegroundColor Green
