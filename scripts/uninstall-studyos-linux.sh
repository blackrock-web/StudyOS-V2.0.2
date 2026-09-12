#!/usr/bin/env bash
# Remove existing StudyOS Desktop installs without killing this script.
set -uo pipefail

echo "=== Removing existing StudyOS Desktop installations ==="

# Stop StudyOS *app* processes only — never match this uninstall/install script.
# Exclude the current shell and any *install*/*uninstall* script path.
if command -v pgrep >/dev/null 2>&1; then
  while read -r pid; do
    [ -z "$pid" ] && continue
    # Skip our own process tree
    if [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ]; then
      continue
    fi
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
    case "$cmd" in
      *install-studyos*|*uninstall-studyos*|*scripts/install*|*scripts/uninstall*) continue ;;
    esac
    # Only kill real app binaries / electron app instances
    if echo "$cmd" | grep -Eqi 'StudyOS-Desktop\.AppImage|/StudyOS|studyos-desktop\.|electron.*studyos'; then
      echo "Stopping PID $pid: $cmd"
      kill "$pid" 2>/dev/null || true
    fi
  done < <(pgrep -f -i 'StudyOS|studyos-desktop' 2>/dev/null || true)
fi

# Remove common install locations (user-writable)
rm -rf \
  "$HOME/.local/share/StudyOS Desktop" \
  "$HOME/.local/share/StudyOS" \
  "$HOME/.local/share/studyos-desktop" \
  "$HOME/.config/StudyOS Desktop" \
  "$HOME/.config/StudyOS" \
  "$HOME/.config/studyos-desktop" \
  "$HOME/Applications/StudyOS Desktop" \
  "$HOME/Applications/StudyOS" \
  "$HOME/.local/bin/StudyOS-Desktop.AppImage" \
  2>/dev/null || true

# System paths (best-effort; may need sudo — do not fail the script)
rm -rf /opt/StudyOS /opt/StudyOS\ Desktop /usr/local/bin/studyos 2>/dev/null || true

# Remove desktop launchers / menu entries
rm -f \
  "$HOME/.local/share/applications/studyos-desktop.desktop" \
  "$HOME/.local/share/applications/studyos"*.desktop \
  "$HOME/Desktop/StudyOS Desktop.desktop" \
  "$HOME/Desktop/StudyOS"*.desktop \
  2>/dev/null || true

# Remove user AppImages named StudyOS (limited depth)
find "$HOME/Downloads" "$HOME/Desktop" "$HOME/Applications" "$HOME/.local/bin" \
  -maxdepth 1 -iname 'StudyOS*.AppImage' -print -delete 2>/dev/null || true

# Optional deb removal (non-fatal)
if command -v dpkg >/dev/null 2>&1; then
  pkgs=$(dpkg -l 2>/dev/null | awk '/studyos/ {print $2}' || true)
  if [ -n "${pkgs:-}" ]; then
    echo "Found deb packages: $pkgs (run: sudo dpkg -r $pkgs  if you want them removed)"
  fi
fi

echo "=== Existing StudyOS Desktop removal complete ==="
exit 0
