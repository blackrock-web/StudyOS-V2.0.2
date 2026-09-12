# Changelog

All notable changes to **StudyOS Desktop** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-12

### Added
- Study Browser default home page set to **https://pwthor.live/**
- Trusted domains for `pwthor.live` in browser security and Electron study allowlist
- Configurable **GitHub repository URL** in Settings → Version for updates
- GitHub Releases updater (`GitHubReleaseUpdateProvider`) with public API discovery
- Repository validation, semver comparison, platform asset selection
- Download progress, in-place install path (no uninstall required for upgrades)
- Linux/Windows install & uninstall scripts with desktop shortcuts
- PDF Workspace offline selection: IndexedDB binary storage + `sourceUrl` on tabs
- RAG Studio integration from PDF Workspace using the selected document

### Changed
- Default update source: `blackrock-web/StudyOS-V2.0.0` (user-configurable; never auto-switched)
- Network update allowlist expanded for GitHub release asset hosts
- electron-builder product name: **StudyOS Desktop** with desktop/start-menu shortcuts

### Removed
- AI Planner view/mode from Planner Hub navigation
- Flashcards and Practice/Test Series entries from Study Hub navigation

### Fixed
- PDF file picker / drag-drop did not open or load the selected PDF offline
- Linux uninstall script could terminate the installer via overly broad `pkill`

### Security
- Updates remain PIN-gated through the network gateway
- Main window stays offline-locked; Study Browser uses isolated session partition

[1.0.0]: https://github.com/blackrock-web/StudyOS-V2.0.0/releases/tag/v1.0.0
