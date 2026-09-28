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

# Suporte a porta customizada via flag (--port / -p) ou variável de ambiente ($PORT / $HUBAI_PORT)
PORT="${PORT:-${HUBAI_PORT:-8080}}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port|-p)
      PORT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

export PORT="$PORT"

mkdir -p "$LOG_DIR"

echo "=========================================="
echo "          INICIANDO HUBAI LINUX           "
echo "=========================================="
echo "Diretório do App:  $APP_DIR"
echo "Configurações em:  $HUBAI_CONFIG_DIR"
echo "Porta do Servidor: $PORT"
echo "Arquivo de Log:    $LOG_FILE"
echo ""

cd "$APP_DIR"

# Validar compilação antes de iniciar
if [ ! -d "dist" ]; then
  echo "Primeira execução detectada: compilando aplicação..."
  npm run build >> "$LOG_FILE" 2>&1
fi

echo "Iniciando servidor HubAI na porta $PORT..."
echo "Acesse no navegador: http://localhost:$PORT"
exec npm start 2>&1 | tee -a "$LOG_FILE"
