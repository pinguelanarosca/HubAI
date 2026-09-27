#!/usr/bin/env bash
# ==============================================================================
# HubAI - Script de Atualização
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HOME/.local/share/hubai-updater.sh" ]; then
  exec bash "$HOME/.local/share/hubai-updater.sh" "$@"
else
  exec bash "$SCRIPT_DIR/hubai-updater.sh" "$@"
fi
