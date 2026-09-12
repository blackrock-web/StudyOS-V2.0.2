# StudyOS Desktop

**Version:** 1.0.0  

Local-first **Electron + React + TypeScript** study and exam-preparation desktop application.

StudyOS combines exam planning, syllabus tracking, lecture management, tasks, focus sessions, PDF workspace with RAG Studio, a sandboxed Study Browser (default **[PW Thor](https://pwthor.live/)**), analytics, and offline-first data — with optional updates from **your** public GitHub Releases.

| | |
|---|---|
| **Repository** | https://github.com/blackrock-web/StudyOS-V2.0.0 |
| **License** | See [LICENSE.md](LICENSE.md) · [COPYRIGHT.md](COPYRIGHT.md) |
| **Install / upgrade** | [docs/INSTALL_AND_UPGRADE.md](docs/INSTALL_AND_UPGRADE.md) |
| **Changelog** | [CHANGELOG.md](CHANGELOG.md) |
| **Versioning** | [docs/VERSIONING.md](docs/VERSIONING.md) · file [`VERSION`](VERSION) |

---

## Features (highlights)

- **Study Browser** — isolated webview session; default home `https://pwthor.live/`
- **PDF Workspace** — local PDF open/select, tabs, annotations; **RAG Studio** on the active document
- **Planner** — month / week / day planning (AI Planner UI removed)
- **Study Hub** — syllabus, notes, scratchpad, formulas, PDF workspace (Flashcards & Test Series removed from Study Hub nav)
- **Security** — network locked by default; PIN-gated unlock for GitHub updates and model downloads
- **Updates** — configure any public GitHub repo in Settings; in-place install **without uninstalling**

---

## Quick start (development)

**Requirements:** Node.js 18+ (20 LTS recommended), npm

```bash
git clone https://github.com/blackrock-web/StudyOS-V2.0.0.git
cd StudyOS-V2.0.0
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:3000`).

### Desktop (Electron)

```bash
npm run electron:dev
```

### Production desktop installers

```bash
# Windows → release/*.exe (NSIS Setup + portable)
npm run electron:build:win

# Linux → release/*.AppImage and *.deb
npm run electron:build:linux

# macOS → release/*.dmg
npm run electron:build:mac
```

**Helper scripts**

| OS | Install (build + shortcuts) | Remove old installs |
|----|-----------------------------|---------------------|
| Windows | `scripts/install-studyos-windows.ps1` | `scripts/uninstall-studyos-windows.ps1` |
| Linux | `scripts/install-studyos-linux.sh` | `scripts/uninstall-studyos-linux.sh` |

Full guide: **[docs/INSTALL_AND_UPGRADE.md](docs/INSTALL_AND_UPGRADE.md)**

---

## Install from GitHub Releases (end users)

1. Go to [Releases](https://github.com/blackrock-web/StudyOS-V2.0.0/releases)
2. Download the asset for your OS (Setup `.exe` / `.AppImage` / `.dmg`)
3. Install or run it
4. Use the **StudyOS Desktop** icon on the Desktop / Start Menu / Applications

Upgrades: install the newer Setup/AppImage **over** the existing app, or use **Settings → Version → Check for Updates**.

---

## In-app updates

1. **Settings → Version**
2. Set **GitHub repository URL** (default `https://github.com/blackrock-web/StudyOS-V2.0.0`)
3. **Validate Public Access** → **Check for Updates** (Network PIN if configured)
4. **Download** → **Install Update (in place)**

The app uses only the repository you configure. It does **not** fall back to unrelated “StudyOS” repositories.

If the repo has no Releases yet, you will see:

> Repository found, but no compatible desktop release is currently available.

Publish a Release with platform installers to enable updates (see install guide).

---

## Project layout

```
StudyOS-V2.0.0/
├── electron/           # Main process, preload, IPC
├── src/                # React UI, services, PDF, planner, browser…
├── build/              # Icons for installers
├── scripts/            # Desktop install / uninstall helpers
├── docs/               # Architecture, install, versioning
├── .github/workflows/  # Tag-based release builds
├── package.json        # version + electron-builder config
├── VERSION             # plain version mirror
├── CHANGELOG.md
├── LICENSE.md
├── COPYRIGHT.md
└── README.md
```

---

## Scripts reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production renderer → `dist/` |
| `npm run lint` | TypeScript check |
| `npm test` | Security tests |
| `npm run electron:build` | Build current-platform desktop packages |
| `npm run dist` | Alias for electron build |

---

## Publishing a release (maintainers)

```bash
# 1. Bump version in package.json + VERSION + CHANGELOG.md
# 2. Commit
git add -A && git commit -m "chore(release): v1.0.0"

# 3. Tag and push
git tag -a v1.0.0 -m "StudyOS Desktop v1.0.0"
git push origin main --tags
```

GitHub Actions builds Windows/Linux artifacts and attaches them to the Release.

Manual option: build locally, then **Draft a Release** on GitHub and upload files from `release/`.

---

## Security

See [SECURITY.md](SECURITY.md). Network remains denied by default; updates and model downloads use an explicit PIN-gated gateway and allowlists.

---

## License & copyright

- [LICENSE.md](LICENSE.md) — StudyOS proprietary software license  
- [COPYRIGHT.md](COPYRIGHT.md) — ownership notice  

Copyright © 2026 StudyOS Project. All rights reserved.

---

## Support

- Issues: use the GitHub issue tracker on this repository  
- Install problems: [docs/INSTALL_AND_UPGRADE.md](docs/INSTALL_AND_UPGRADE.md)
