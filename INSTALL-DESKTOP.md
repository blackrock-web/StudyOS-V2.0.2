# StudyOS Desktop — Install as a real desktop application

This project is an **Electron desktop app**. After install you get:

- A native windowed application (not a website)
- **Desktop icon** + Start Menu / Applications entry
- In-place updates from the GitHub repo configured in Settings
- Local data kept under the OS app data folder

## Windows (recommended)

1. Install **Node.js LTS**: https://nodejs.org  
2. Open **PowerShell** in this project folder.
3. Remove any old StudyOS install and build the new one:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\uninstall-studyos-windows.ps1
.\scripts\install-studyos-windows.ps1
```

4. When the NSIS Setup window appears, install normally.  
5. Open **StudyOS Desktop** from the Desktop shortcut or Start Menu.

Installer output is in the `release\` folder (`StudyOS-Desktop-*-Setup.exe`).

### Manual Windows steps

```powershell
npm install
npm run electron:build:win
# run the Setup .exe inside release\
```

## Linux

```bash
chmod +x scripts/*.sh
./scripts/install-studyos-linux.sh
```

This removes old StudyOS copies, builds AppImage/deb, and creates a **Desktop** launcher icon.

## macOS

```bash
npm install
npm run electron:build:mac
# open the .dmg in release/ and drag StudyOS Desktop to Applications
```

## Remove ALL existing StudyOS Desktop apps

**Windows**

```powershell
.\scripts\uninstall-studyos-windows.ps1
```

**Linux**

```bash
./scripts/uninstall-studyos-linux.sh
```

## Notes

- Building the installer requires internet once (to download Electron).
- Your study data lives in the app userData folder and is **not** deleted on normal uninstall (`deleteAppDataOnUninstall: false`).
- Default update repository: `https://github.com/blackrock-web/StudyOS-V2.0.0` (change in Settings → Version).
