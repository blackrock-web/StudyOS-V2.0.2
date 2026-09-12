# Version management

## Single source of truth

| Location | Role |
|----------|------|
| `package.json` → `"version"` | npm / Electron `app.getVersion()` when packaged |
| `VERSION` | Plain-text mirror for humans and scripts |
| `CHANGELOG.md` | Human-readable history |
| Git tag `vX.Y.Z` | Triggers release workflow; identifies GitHub Release |

Keep `package.json` version and `VERSION` identical before tagging.

## Bump checklist

1. Edit `package.json` `"version"`
2. Edit `VERSION`
3. Add a section to `CHANGELOG.md`
4. Commit: `chore(release): vX.Y.Z`
5. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
6. Push: `git push origin main --tags`

## Channels

- **stable**: default GitHub Releases (`prerelease: false`)
- **prerelease**: mark the GitHub Release as pre-release; the app prefers stable assets first
