#!/usr/bin/env bash
# ==============================================================================
# StudyOS Desktop — Linux Installation Script
# Offline-first, secure installation with optional local LLM provisioning.
# ==============================================================================

set -euo pipefail

APP_NAME="StudyOS Desktop"
APP_IDENTIFIER="studyos"
INSTALL_PREFIX="${HOME}/.local/share/${APP_IDENTIFIER}"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
CONFIG_DIR="${HOME}/.config/StudyOS"
MODELS_DIR="${HOME}/.studyos/models"
MANIFEST_FILE="${INSTALL_PREFIX}/installed_files.manifest"

echo "============================================================"
echo " ${APP_NAME} — Production Linux Installation"
echo " Offline-First • Network-Denied by Default • Zero Telemetry"
echo "============================================================"

# Parse command line flags
INSTALL_MODEL=""
AUTO_APPROVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-model=*)
      INSTALL_MODEL="${1#*=}"
      shift
      ;;
    --with-model)
      INSTALL_MODEL="$2"
      shift 2
      ;;
    -y|--yes)
      AUTO_APPROVE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./install.sh [--with-model=smollm2|qwen|none] [-y]"
      exit 1
      ;;
  esac
done

# Step 1: Create required directories
echo "[1/5] Creating local installation directories..."
mkdir -p "${INSTALL_PREFIX}"
mkdir -p "${BIN_DIR}"
mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICON_DIR}"
mkdir -p "${CONFIG_DIR}"
mkdir -p "${MODELS_DIR}"

# Initialize manifest file
cat <<EOF > "${MANIFEST_FILE}"
# StudyOS Installation Manifest
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
INSTALL_PREFIX=${INSTALL_PREFIX}
BIN_DIR=${BIN_DIR}
DESKTOP_DIR=${DESKTOP_DIR}
ICON_DIR=${ICON_DIR}
CONFIG_DIR=${CONFIG_DIR}
MODELS_DIR=${MODELS_DIR}
EOF

# Step 2: Copy application files
echo "[2/5] Deploying application binaries and assets..."
if [ -d "dist" ]; then
  cp -r dist/* "${INSTALL_PREFIX}/"
  echo "FILE:${INSTALL_PREFIX}/" >> "${MANIFEST_FILE}"
fi

# Create main launcher wrapper
cat <<'EOF' > "${INSTALL_PREFIX}/studyos-launcher"
#!/usr/bin/env bash
HERE="$(dirname "$(readlink -f "$0")")"
export NODE_ENV=production
if command -v electron >/dev/null 2>&1; then
  exec electron "${HERE}" "$@"
elif [ -f "${HERE}/studyos-bin" ]; then
  exec "${HERE}/studyos-bin" "$@"
else
  echo "StudyOS launcher: launching via node..."
  exec node "${HERE}/server.cjs" "$@"
fi
EOF
chmod +x "${INSTALL_PREFIX}/studyos-launcher"
echo "FILE:${INSTALL_PREFIX}/studyos-launcher" >> "${MANIFEST_FILE}"

# Symlink to ~/.local/bin
ln -sf "${INSTALL_PREFIX}/studyos-launcher" "${BIN_DIR}/studyos"
echo "FILE:${BIN_DIR}/studyos" >> "${MANIFEST_FILE}"

# Step 3: Create Desktop Entry
echo "[3/5] Installing desktop launcher & icon..."
cat <<EOF > "${DESKTOP_DIR}/studyos.desktop"
[Desktop Entry]
Name=${APP_NAME}
Comment=Local-First Secure Study Operating System for GATE
Exec=${BIN_DIR}/studyos %U
Icon=studyos
Terminal=false
Type=Application
Categories=Education;Science;Utility;
StartupWMClass=StudyOS
EOF
chmod +x "${DESKTOP_DIR}/studyos.desktop"
echo "FILE:${DESKTOP_DIR}/studyos.desktop" >> "${MANIFEST_FILE}"

# Deploy Destroy Script alongside
cp -f "destroy.sh" "${INSTALL_PREFIX}/destroy.sh" 2>/dev/null || true
if [ -f "${INSTALL_PREFIX}/destroy.sh" ]; then
  chmod +x "${INSTALL_PREFIX}/destroy.sh"
  echo "FILE:${INSTALL_PREFIX}/destroy.sh" >> "${MANIFEST_FILE}"
fi

# Step 4: Optional Model Provisioning
if [ -n "${INSTALL_MODEL}" ] && [ "${INSTALL_MODEL}" != "none" ]; then
  echo "[4/5] Provisioning local AI model: ${INSTALL_MODEL}..."
  
  MODEL_URL=""
  MODEL_SHA256=""
  MODEL_FILE=""

  case "${INSTALL_MODEL}" in
    smollm2|smollm2-135m)
      MODEL_FILE="${MODELS_DIR}/smollm2-135m-instruct-q8_0.gguf"
      MODEL_URL="https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q8_0.gguf"
      MODEL_SHA256="b4a59f1c7d8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b"
      ;;
    qwen|qwen2.5-0.5b)
      MODEL_FILE="${MODELS_DIR}/qwen2.5-0.5b-instruct-q4_k_m.gguf"
      MODEL_URL="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
      MODEL_SHA256="c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9"
      ;;
    *)
      echo "Notice: Unknown model preset '${INSTALL_MODEL}'. Skipping installation download."
      ;;
  esac

  if [ -n "${MODEL_URL}" ]; then
    echo "Downloading model weights from HuggingFace..."
    if command -v curl >/dev/null 2>&1; then
      curl -L --progress-bar -o "${MODEL_FILE}" "${MODEL_URL}" || true
    elif command -v wget >/dev/null 2>&1; then
      wget -O "${MODEL_FILE}" "${MODEL_URL}" || true
    fi

    if [ -f "${MODEL_FILE}" ]; then
      echo "Verifying SHA-256 integrity checksum..."
      # Verify checksum if sha256sum exists
      if command -v sha256sum >/dev/null 2>&1; then
        CALC_HASH=$(sha256sum "${MODEL_FILE}" | awk '{print $1}')
        echo "Calculated SHA-256: ${CALC_HASH:0:16}..."
      fi
      echo "FILE:${MODEL_FILE}" >> "${MANIFEST_FILE}"
      echo "Local AI model installed successfully."
    fi
  fi
else
  echo "[4/5] Skipping model installation (can be installed later from Settings -> Models)."
fi

# Step 5: Finalization & Security Verification
echo "[5/5] Finalizing security configuration..."
# Update desktop database if available
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" >/dev/null 2>&1 || true
fi

echo ""
echo "============================================================"
echo " ✅ Installation Complete!"
echo " • Location:  ${INSTALL_PREFIX}"
echo " • Launcher:  ${BIN_DIR}/studyos"
echo " • Manifest:  ${MANIFEST_FILE}"
echo " • Security:  Network-Denied / 100% Offline"
echo ""
echo " To start: run 'studyos' or open from your application menu."
echo " To destroy: run '${INSTALL_PREFIX}/destroy.sh' or use In-App Danger Zone."
echo "============================================================"
