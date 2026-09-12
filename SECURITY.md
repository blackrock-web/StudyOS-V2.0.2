# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a vulnerability

Do **not** open a public issue for security-sensitive reports.

Please contact the repository maintainers privately (GitHub Security Advisories preferred).

## Security model (summary)

- Network is **locked by default** for the main application shell
- Temporary unlock requires a user PIN for allowlisted operations (`update`, `model-download`)
- Study Browser uses an isolated session partition
- Local student data stays on-device under the Electron `userData` path
- Official updates should only come from the **configured** public GitHub repository Releases
