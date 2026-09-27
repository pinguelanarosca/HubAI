#!/usr/bin/env bash
# ==============================================================================
# HubAI - Script de Desinstalação Limpa para Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

INSTALL_DIR="$HOME/.local/share/hubai"
UPDATER_PATH="$HOME/.local/share/hubai-updater.sh"
CONFIG_DIR="$HOME/.config/hubai"
BIN_FILE="$HOME/.local/bin/hubai"
DESKTOP_FILE="$HOME/.local/share/applications/hubai.desktop"
PID_FILE="$CONFIG_DIR/hubai.pid"

echo "=================================================="
echo "          DESINSTALADOR OFICIAL HUBAI             "
echo "=================================================="
echo ""

# Parar processo se estiver ativo
if [ -f "$PID_FILE" ]; then
  RUNNING_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$RUNNING_PID" ] && kill -0 "$RUNNING_PID" 2>/dev/null; then
    echo "Encerrando processo ativo do HubAI (PID: $RUNNING_PID)..."
    kill -15 "$RUNNING_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$RUNNING_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

PURGE=false
if [ "$1" = "--purge" ]; then
  PURGE=true
elif [ -t 0 ]; then
  # Interativo
  read -p "Deseja remover também os dados e configurações do HubAI em ~/.config/hubai? (s/N): " choice
  case "$choice" in
    [sS][iI][mM]|[sS]|[yY][eE][sS]|[yY])
      PURGE=true
      ;;
    *)
      PURGE=false
      ;;
  esac
fi

echo "Removendo executáveis e atalhos..."
rm -f "$BIN_FILE"
rm -f "$DESKTOP_FILE"
rm -f "$UPDATER_PATH"

echo "Removendo arquivos da aplicação em $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"

if [ "$PURGE" = true ]; then
  echo "Opção de purga confirmada: removendo configurações em $CONFIG_DIR..."
  rm -rf "$CONFIG_DIR"
  echo "✓ Configurações do HubAI removidas."
else
  echo "✓ Configurações do usuário PRESERVADAS em: $CONFIG_DIR"
  echo "  (Caso reinstale o HubAI no futuro, suas contas estarão salvas)."
fi

echo ""
echo "Nota: Seus perfis reais do Google Chrome (~/.config/google-chrome) NÃO foram tocados."
echo "=================================================="
echo "          DESINSTALAÇÃO CONCLUÍDA                 "
echo "=================================================="
