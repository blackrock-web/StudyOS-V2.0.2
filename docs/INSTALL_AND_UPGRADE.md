# Installation & Upgrade Guide (GitHub Releases)

This document explains how to **install** StudyOS Desktop and how to **upgrade** using **GitHub Releases** — both manually and via the in-app updater.

---

## 1. Repository

| Item | Value |
|------|--------|
| Default GitHub repo | https://github.com/blackrock-web/StudyOS-V2.0.0 |
| Owner / name | `blackrock-web` / `StudyOS-V2.0.0` |
| Releases page | https://github.com/blackrock-web/StudyOS-V2.0.0/releases |

You may point Settings → Version at any **public** GitHub repository you control. The app never silently switches to a different repo.

---

## 2. First-time installation (from GitHub Release)

### Windows

1. Open [Releases](https://github.com/blackrock-web/StudyOS-V2.0.0/releases)
2. Download the latest **`StudyOS-Desktop-*-win-x64.exe`** (NSIS Setup) asset  
   (or the portable `.exe` if offered)
3. Run the installer
4. Leave **Create desktop shortcut** enabled
5. Launch **StudyOS Desktop** from the Desktop or Start Menu

**Do not uninstall** a previous StudyOS copy first when upgrading with a newer Setup — the installer is designed for **in-place** install over the existing app. User data under `%APPDATA%` is preserved by default.

### Linux

1. Download the latest **`.AppImage`** (or `.deb`) from Releases
2. AppImage:

   ```bash
   chmod +x StudyOS-Desktop-*.AppImage
   ./StudyOS-Desktop-*.AppImage
   ```

3. Optional desktop entry is created by `scripts/install-studyos-linux.sh` when building from source

### macOS

1. Download the **`.dmg`**
2. Open it and drag **StudyOS Desktop** to Applications

---

## 3. Build installers from source (maintainers / advanced)

```bash
git clone https://github.com/blackrock-web/StudyOS-V2.0.0.git
cd StudyOS-V2.0.0
npm install
```

| Platform | Command | Output folder |
|----------|---------|----------------|
| Windows  | `npm run electron:build:win` | `release/` |
| Linux    | `npm run electron:build:linux` | `release/` |
| macOS    | `npm run electron:build:mac` | `release/` |

Helper scripts:

- Windows: `scripts/install-studyos-windows.ps1` / `scripts/uninstall-studyos-windows.ps1`
- Linux: `scripts/install-studyos-linux.sh` / `scripts/uninstall-studyos-linux.sh`

---

## 4. Publishing a GitHub Release (maintainers)

### Option A — Tag + GitHub Actions

1. Update `VERSION`, `package.json` `"version"`, and `CHANGELOG.md`
2. Commit and push to `main`
3. Create and push a version tag:

   ```bash
   git tag -a v1.0.0 -m "StudyOS Desktop v1.0.0"
   git push origin v1.0.0
   ```

4. Workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds Windows/Linux packages and publishes assets to the Release

### Option B — Manual Release

1. Run `electron-builder` locally for each OS
2. GitHub → **Releases** → **Draft a new release**
3. Tag: `v1.0.0` (must match semver; leading `v` is fine)
4. Title: `StudyOS Desktop v1.0.0`
5. Paste notes from `CHANGELOG.md`
6. Upload assets, for example:
   - `StudyOS-Desktop-1.0.0-win-x64.exe` (NSIS)
   - `StudyOS-Desktop-1.0.0-linux-x64.AppImage`
   - `StudyOS-Desktop-1.0.0-linux-x64.deb`
   - `StudyOS-Desktop-1.0.0-mac-x64.dmg` / `arm64` as applicable
7. Publish the release (**not** draft-only if you want public in-app updates)

Asset names should include platform keywords (`win`, `setup`, `exe`, `AppImage`, `deb`, `dmg`, `mac`) so the in-app updater can pick the correct file.

---

## 5. In-app upgrade (users)

1. Open **Settings → Version / Updates**
2. Confirm **GitHub Update Source** is your repo (default `https://github.com/blackrock-web/StudyOS-V2.0.0`)
3. **Validate Public Access** (optional)
4. **Check for Updates** (enter Network PIN when prompted)
5. If a newer release exists:
   - **Download** the package
   - **Install Update (in place)** — app restarts; **no uninstall step**
6. Confirm version after restart

### Expected messages

| Situation | Message (summary) |
|-----------|-------------------|
| Already newest | You're up to date |
| Repo OK, no releases | Repository found, but no compatible desktop release is currently available |
| Wrong URL | Repository could not be found / accessed |
| No installer for OS | Newer release exists, but no compatible installer for this platform |
| Gateway locked | Enter PIN / unlock network for updates |

---

## 6. Removing old installations

**Windows (PowerShell):**

```powershell
.\scripts\uninstall-studyos-windows.ps1
```

**Linux:**

```bash
./scripts/uninstall-studyos-linux.sh
```

Study data may remain under the OS app data directory unless those folders are deleted intentionally.

---

## 7. Versioning rules

- Application version is defined in `package.json` and mirrored in `VERSION`
- GitHub release tags: `vMAJOR.MINOR.PATCH`
- Comparison is **semantic**, not string sort (`1.10.0` > `1.9.0`)
- In-app current version comes from Electron `app.getVersion()` when packaged, else `versionService` / `package.json`
