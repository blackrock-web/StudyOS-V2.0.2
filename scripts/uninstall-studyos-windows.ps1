# Remove ALL existing StudyOS Desktop installations from this Windows PC
$ErrorActionPreference = 'SilentlyContinue'
Write-Host "=== Removing existing StudyOS Desktop applications ===" -ForegroundColor Yellow

# Stop running processes
Get-Process | Where-Object { $_.Name -match 'StudyOS|studyos|electron' -and $_.Path -match 'StudyOS|studyos' } | ForEach-Object {
  Write-Host "Stopping process: $($_.Name) ($($_.Id))"
  Stop-Process -Id $_.Id -Force
}

# Uninstall via registry uninstall keys
$uninstallRoots = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($root in $uninstallRoots) {
  Get-ItemProperty $root -ErrorAction SilentlyContinue | Where-Object {
    $_.DisplayName -match 'StudyOS' -or $_.Publisher -match 'StudyOS' -or $_.InstallLocation -match 'StudyOS'
  } | ForEach-Object {
    Write-Host "Found installed app: $($_.DisplayName)"
    if ($_.UninstallString) {
      $cmd = $_.UninstallString
      Write-Host "  Uninstall: $cmd"
      if ($cmd -match 'msiexec') {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/x $($_.PSChildName) /qn" -Wait
      } else {
        # NSIS silent uninstall often supports /S
        $exe = $cmd.Trim('"')
        if (Test-Path $exe) { Start-Process -FilePath $exe -ArgumentList '/S' -Wait }
      }
    }
  }
}

# Remove common install folders
$paths = @(
  "$env:LOCALAPPDATA\Programs\StudyOS*",
  "$env:LOCALAPPDATA\Programs\studyos*",
  "$env:ProgramFiles\StudyOS*",
  "${env:ProgramFiles(x86)}\StudyOS*",
  "$env:LOCALAPPDATA\studyos-desktop",
  "$env:APPDATA\studyos-desktop",
  "$env:APPDATA\StudyOS*"
)
foreach ($p in $paths) {
  Get-Item $p -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Removing folder: $($_.FullName)"
    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Remove desktop and start menu shortcuts
$shortcutRoots = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('StartMenu'),
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)
foreach ($root in $shortcutRoots) {
  Get-ChildItem -Path $root -Filter '*StudyOS*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Removing shortcut: $($_.FullName)"
    Remove-Item $_.FullName -Force
  }
}

Write-Host "=== Existing StudyOS Desktop removal complete ===" -ForegroundColor Green
Write-Host "Note: User study data under %APPDATA% may remain unless you deleted those folders." -ForegroundColor Cyan
