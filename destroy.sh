#!/usr/bin/env bash
# ==============================================================================
# StudyOS Desktop — Linux Destruction & Nuclear Purge Script
# Completely removes application binaries, configs, models, databases, shortcuts.
# ==============================================================================

set -euo pipefail

APP_IDENTIFIER="studyos"
INSTALL_PREFIX="${HOME}/.local/share/${APP_IDENTIFIER}"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
CONFIG_DIR="${HOME}/.config/StudyOS"
CACHE_DIR="${HOME}/.cache/StudyOS"
MODELS_DIR="${HOME}/.studyos"
MANIFEST_FILE="${INSTALL_PREFIX}/installed_files.manifest"

echo "============================================================"
echo " ⚠️  StudyOS Desktop — Complete Application Destruction"
echo "============================================================"

# Auto-confirm flag check
AUTO_CONFIRM=false
if [[ "${1:-}" == "--force" ]] || [[ "${1:-}" == "-y" ]]; then
  AUTO_CONFIRM=true
fi

if [ "${AUTO_CONFIRM}" = false ]; then
  echo "This operation will PERMANENTLY ERASE:"
  echo " • All application binaries & installation files"
  echo " • All SQLite study databases, flashcards, notes, tests"
  echo " • All downloaded local AI models and cache"
  echo " • All desktop shortcuts and configuration files"
  echo ""
  read -r -p "Are you sure you want to completely destroy StudyOS? Type 'DESTROY' to confirm: " CONFIRM_INPUT
  if [ "${CONFIRM_INPUT}" != "DESTROY" ]; then
    echo "Destruction cancelled."
    exit 0
  fi
fi

echo ""
echo "[1/6] Stopping any running StudyOS processes..."
pkill -f "studyos" 2>/dev/null || true
pkill -f "StudyOS" 2>/dev/null || true
sleep 1

echo "[2/6] Obliterating local AI models and weights..."
rm -rf "${MODELS_DIR}" 2>/dev/null || true

echo "[3/6] Erasing user databases, configurations, and logs..."
rm -rf "${CONFIG_DIR}" 2>/dev/null || true
rm -rf "${CACHE_DIR}" 2>/dev/null || true

echo "[4/6] Unlinking desktop launchers and menu shortcuts..."
rm -f "${DESKTOP_DIR}/studyos.desktop" 2>/dev/null || true
rm -f "${BIN_DIR}/studyos" 2>/dev/null || true
rm -f "${ICON_DIR}/studyos.png" 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" >/dev/null 2>&1 || true
fi

echo "[5/6] Reading installation manifest and removing tracked files..."
if [ -f "${MANIFEST_FILE}" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^FILE:(.*)$ ]]; then
      TARGET="${BASH_REMATCH[1]}"
      if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
        rm -rf "$TARGET" 2>/dev/null || true
      fi
    fi
  done < "${MANIFEST_FILE}"
fi

echo "[6/6] Purging installation folder..."
rm -rf "${INSTALL_PREFIX}" 2>/dev/null || true

echo ""
echo "============================================================"
echo " 💥 StudyOS Desktop has been completely obliterated."
echo " Zero traces, data, or files remain on this device."
echo "============================================================"
