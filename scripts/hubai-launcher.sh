#!/usr/bin/env bash
# ==============================================================================
# HubAI - Script Oficial de Execução para Linux
# ==============================================================================
set -e

# Descobrir diretório da aplicação
if [ -d "$HOME/.local/share/hubai" ] && [ -f "$HOME/.local/share/hubai/package.json" ]; then
  APP_DIR="$HOME/.local/share/hubai"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  APP_DIR="$SCRIPT_DIR"
fi

export HUBAI_CONFIG_DIR="$HOME/.config/hubai"
LOG_DIR="$HUBAI_CONFIG_DIR/logs"
LOG_FILE="$LOG_DIR/hubai.log"

mkdir -p "$LOG_DIR"

echo "=========================================="
echo "          INICIANDO HUBAI LINUX           "
echo "=========================================="
echo "Diretório do App:  $APP_DIR"
echo "Configurações em:  $HUBAI_CONFIG_DIR"
echo "Arquivo de Log:    $LOG_FILE"
echo ""

cd "$APP_DIR"

# Validar compilação antes de iniciar
if [ ! -d "dist" ]; then
  echo "Primeira execução detectada: compilando aplicação..."
  npm run build >> "$LOG_FILE" 2>&1
fi

echo "Iniciando servidor HubAI na porta 3000..."
exec npm start 2>&1 | tee -a "$LOG_FILE"
