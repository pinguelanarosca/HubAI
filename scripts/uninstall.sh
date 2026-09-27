#!/usr/bin/env bash
# ==============================================================================
# HubAI - Script de Desinstalação Limpa para Linux
# ==============================================================================
set -e

INSTALL_DIR="$HOME/.local/share/hubai"
CONFIG_DIR="$HOME/.config/hubai"
BIN_FILE="$HOME/.local/bin/hubai"
DESKTOP_FILE="$HOME/.local/share/applications/hubai.desktop"

echo "=========================================="
echo "        DESINSTALADOR DO HUBAI            "
echo "=========================================="

PURGE=false
if [ "$1" = "--purge" ]; then
  PURGE=true
fi

echo "Removendo atalhos e executáveis..."
rm -f "$BIN_FILE"
rm -f "$DESKTOP_FILE"

echo "Removendo diretório de instalação..."
rm -rf "$INSTALL_DIR"

if [ "$PURGE" = true ]; then
  echo "Opção --purge detectada: removendo configurações em $CONFIG_DIR..."
  rm -rf "$CONFIG_DIR"
else
  echo "As configurações do usuário foram preservadas em: $CONFIG_DIR"
  echo "(Use './uninstall.sh --purge' se desejar apagar também as configurações)."
fi

echo ""
echo "✓ HubAI desinstalado com sucesso do seu usuário."
