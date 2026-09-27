#!/usr/bin/env bash
# ==============================================================================
# HubAI - Script de Desinstalação e Limpeza Completa para Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

INSTALL_DIR="$HOME/.local/share/hubai"
UPDATER_PATH="$HOME/.local/share/hubai-updater.sh"
CONFIG_DIR="$HOME/.config/hubai"
BIN_FILE="$HOME/.local/bin/hubai"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/hubai.desktop"
PID_FILE="$CONFIG_DIR/hubai.pid"

echo "=================================================="
echo "    DESINSTALADOR OFICIAL & LIMPEZA DO HUBAI     "
echo "=================================================="
echo ""

# 1. Parar processos ativos do HubAI
echo "[1/4] Verificando e finalizando processos em execução..."
if [ -f "$PID_FILE" ]; then
  RUNNING_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$RUNNING_PID" ] && kill -0 "$RUNNING_PID" 2>/dev/null; then
    echo "  → Encerrando processo ativo do HubAI (PID: $RUNNING_PID)..."
    kill -15 "$RUNNING_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$RUNNING_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Garantir encerramento de qualquer outro processo remanescente
pkill -f "$INSTALL_DIR" 2>/dev/null || true
pkill -f "hubai-updater.sh" 2>/dev/null || true

# 2. Avaliar nível de limpeza (--purge / --all / interativo)
PURGE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge|-p|--all|-a|--clean|-c|--force|-f|purge|clean)
      PURGE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$PURGE" = false ] && [ -t 0 ]; then
  echo "Você pode realizar a desinstalação padrão ou a limpeza total (purge):"
  echo "  [1] Desinstalação Padrão (mantém ~/.config/hubai para reinstalações futuras)"
  echo "  [2] Limpeza Completa / Purge (apaga TUDO: executáveis, configs, logs e backups)"
  echo ""
  read -p "Escolha uma opção (1 ou 2) [Padrão: 1]: " choice
  case "$choice" in
    2|[sS][iI][mM]|[sS]|[yY][eE][sS]|[yY]|purge)
      PURGE=true
      ;;
    *)
      PURGE=false
      ;;
  esac
fi

# 3. Remoção de executáveis, atalhos do sistema e atualizador
echo "[2/4] Removendo executáveis, atualizadores e atalhos .desktop..."
rm -f "$BIN_FILE"
rm -f "$UPDATER_PATH"
rm -f "$DESKTOP_FILE"
rm -f "$DESKTOP_DIR"/hubai-*.desktop 2>/dev/null || true
rm -f "$HOME/Desktop"/hubai*.desktop 2>/dev/null || true

# Atualizar base de atalhos de aplicativos do desktop Linux
if command -v update-desktop-database &>/dev/null && [ -d "$DESKTOP_DIR" ]; then
  update-desktop-database "$DESKTOP_DIR" &>/dev/null || true
fi

# 4. Remoção do diretório de instalação e arquivos temporários
echo "[3/4] Removendo arquivos do aplicativo em $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
rm -rf /tmp/hubai-* /tmp/hubai_update.lock 2>/dev/null || true

# 5. Tratamento das configurações do usuário (~/.config/hubai)
echo "[4/4] Finalizando limpeza de dados..."
if [ "$PURGE" = true ]; then
  echo "  → Limpeza total confirmada: removendo $CONFIG_DIR..."
  rm -rf "$CONFIG_DIR"
  echo "✓ Todos os dados, logs, backups e configurações do HubAI foram apagados com sucesso."
else
  echo "✓ Configurações do usuário PRESERVADAS em: $CONFIG_DIR"
  echo "  (Caso queira apagar tudo mais tarde, execute: rm -rf ~/.config/hubai)"
fi

echo ""
echo "Nota de Segurança: Os perfis reais do seu navegador (~/.config/google-chrome, ~/.config/chromium, etc.) NUNCA são alterados ou apagados."
echo "=================================================="
echo "          DESINSTALAÇÃO CONCLUÍDA                 "
echo "=================================================="
