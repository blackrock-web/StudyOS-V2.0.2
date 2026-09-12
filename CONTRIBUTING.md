# Contributing to StudyOS Desktop

Thank you for interest in improving StudyOS Desktop.

## Development setup

```bash
git clone https://github.com/blackrock-web/StudyOS-V2.0.0.git
cd StudyOS-V2.0.0
npm install
npm run dev          # Vite UI on port 3000
npm run electron:dev # Electron + Vite (if available)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Web UI development server |
| `npm run build` | Production Vite build → `dist/` |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Security tests |
| `npm run electron:build:win` | Windows NSIS + portable |
| `npm run electron:build:linux` | Linux AppImage + deb |
| `npm run electron:build:mac` | macOS DMG |

## Pull requests

1. Branch from `main`
2. Keep changes focused; do not commit `node_modules/`, `dist/`, or `release/`
3. Update `CHANGELOG.md` under `[Unreleased]` when relevant
4. Ensure `npm run lint` and `npm test` pass when possible

## Releases

Maintainers cut Git tags `vX.Y.Z`. GitHub Actions builds installers and attaches them to the GitHub Release. See [docs/INSTALL_AND_UPGRADE.md](docs/INSTALL_AND_UPGRADE.md).
