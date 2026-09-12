#!/usr/bin/env bash
# Build and install StudyOS Desktop on Linux (AppImage + desktop icon)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== StudyOS Desktop Linux installer ==="
echo "Project root: $ROOT"

# 1) Safe removal of previous installs (will not kill this script)
bash "$ROOT/scripts/uninstall-studyos-linux.sh"

# 2) Prerequisites
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required. Install LTS from https://nodejs.org then re-run."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found."
  exit 1
fi

echo "Node: $(node -v)  npm: $(npm -v)"

# 3) Install deps + build
echo ">>> npm install (this can take several minutes)..."
npm install --no-audit --no-fund

echo ">>> Building desktop app (electron-builder Linux)..."
npm run electron:build:linux

RELEASE="$ROOT/release"
mkdir -p "$RELEASE"

APPIMAGE=$(ls "$RELEASE"/StudyOS*.AppImage 2>/dev/null | head -1 || true)
DEB=$(ls "$RELEASE"/StudyOS*.deb "$RELEASE"/studyos*.deb 2>/dev/null | head -1 || true)

if [ -z "${APPIMAGE:-}" ] && [ -z "${DEB:-}" ]; then
  echo "ERROR: No AppImage or .deb found in $RELEASE"
  echo "Contents of release/:"
  ls -la "$RELEASE" || true
  exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons" "$HOME/Desktop"

if [ -n "${APPIMAGE:-}" ]; then
  chmod +x "$APPIMAGE"
  cp -f "$APPIMAGE" "$HOME/.local/bin/StudyOS-Desktop.AppImage"
  chmod +x "$HOME/.local/bin/StudyOS-Desktop.AppImage"

  ICON_SRC="$ROOT/build/icon.png"
  ICON_DST="$HOME/.local/share/icons/studyos-desktop.png"
  if [ -f "$ICON_SRC" ]; then
    cp -f "$ICON_SRC" "$ICON_DST"
  fi

  DESKTOP_FILE="$HOME/.local/share/applications/studyos-desktop.desktop"
  cat > "$DESKTOP_FILE" << EOD
[Desktop Entry]
Version=1.0
Name=StudyOS Desktop
Comment=Local-first study and exam preparation desktop app
Exec=$HOME/.local/bin/StudyOS-Desktop.AppImage
Icon=$ICON_DST
Terminal=false
Type=Application
Categories=Education;Office;
StartupWMClass=StudyOS Desktop
EOD
  chmod +x "$DESKTOP_FILE"
  cp -f "$DESKTOP_FILE" "$HOME/Desktop/StudyOS Desktop.desktop"
  chmod +x "$HOME/Desktop/StudyOS Desktop.desktop"
  # Mark trusted on some desktops (GNOME)
  command -v gio >/dev/null 2>&1 && gio set "$HOME/Desktop/StudyOS Desktop.desktop" metadata::trusted true 2>/dev/null || true
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  echo "Installed AppImage + Desktop icon: StudyOS Desktop"
  echo "  App:  $HOME/.local/bin/StudyOS-Desktop.AppImage"
  echo "  Icon: $HOME/Desktop/StudyOS Desktop.desktop"
fi

if [ -n "${DEB:-}" ]; then
  echo "Optional .deb available: $DEB"
  echo "  To install system-wide: sudo dpkg -i \"$DEB\" || sudo apt-get install -f -y"
fi

echo "=== Done. Launch StudyOS Desktop from your Desktop icon or Applications menu. ==="
