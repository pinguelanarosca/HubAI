#!/usr/bin/env bash
# ==============================================================================
# HubAI - Desinstalador Oficial para Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$SCRIPT_DIR/uninstall.sh" ]; then
  exec bash "$SCRIPT_DIR/uninstall.sh" "$@"
else
  exec bash "$HOME/.local/share/hubai/uninstall.sh" "$@"
fi
