#!/usr/bin/env bash
# ==============================================================================
# HubAI - Instalador Oficial e Configurador de Ambiente Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Caminhos Padrão do Usuário Linux (XDG Base Directory)
# Instalação: ~/.local/share/hubai
# Configuração: ~/.config/hubai
# Repositório: https://github.com/pinguelanarosca/HubAI
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/hubai}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/hubai}"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
UPDATER_PATH="$HOME/.local/share/hubai-updater.sh"

echo "=================================================="
echo "          INSTALADOR OFICIAL DO HUBAI             "
echo "=================================================="
echo "Origem:       $SCRIPT_DIR"
echo "Instalação:   ~/.local/share/hubai ($INSTALL_DIR)"
echo "Configuração: ~/.config/hubai ($CONFIG_DIR)"
echo "=================================================="
echo ""

# 1. Verificar dependências essenciais do Linux
echo "[1/6] Verificando dependências do sistema..."
if ! command -v node &>/dev/null; then
  echo "ERRO: Node.js não foi encontrado. Por favor, instale o Node.js (v18+) antes de continuar."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "ERRO: npm não foi encontrado. Por favor, instale o npm antes de continuar."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js detectado: $NODE_VERSION"

# 2. Criar diretórios de usuário no Linux (XDG Base Directory)
echo "[2/6] Criando diretórios padrão do usuário..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$CONFIG_DIR/logs"
mkdir -p "$CONFIG_DIR/backups"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"

# 3. Copiar arquivos do HubAI para ~/.local/share/hubai
echo "[3/6] Instalando arquivos do aplicativo em $INSTALL_DIR..."
# Copiar preservando estrutura, ignorando node_modules locais se houver
if command -v rsync &>/dev/null; then
  rsync -a --delete --exclude='node_modules' --exclude='.git' --exclude='data/hub-config.json' "$SCRIPT_DIR/" "$INSTALL_DIR/"
else
  # Fallback com cp
  cp -r "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
  cp -r "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/vite.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/server.ts" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/scripts" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/index.html" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/uninstall.sh" "$INSTALL_DIR/" 2>/dev/null || true
fi

# 4. Instalar dependências npm e compilar o frontend
echo "[4/6] Instalando dependências e compilando aplicação..."
cd "$INSTALL_DIR"
npm install --no-audit --no-fund --legacy-peer-deps
npm run build

# 5. Criar Script Atualizador Autônomo e Lançador
echo "[5/6] Instalando script de atualização autônoma e executável..."

# Copiar hubai-updater.sh
if [ -f "$SCRIPT_DIR/scripts/hubai-updater.sh" ]; then
  cp "$SCRIPT_DIR/scripts/hubai-updater.sh" "$UPDATER_PATH"
else
  cp "$INSTALL_DIR/scripts/hubai-updater.sh" "$UPDATER_PATH"
fi
chmod +x "$UPDATER_PATH"

# Instalar Launcher em ~/.local/bin/hubai
cat << 'EOF' > "$BIN_DIR/hubai"
#!/usr/bin/env bash
# ==============================================================================
# HubAI - Lançador Executável Linux
# ==============================================================================
INSTALL_DIR="$HOME/.local/share/hubai"
export HUBAI_CONFIG_DIR="$HOME/.config/hubai"
LOG_DIR="$HUBAI_CONFIG_DIR/logs"
LOG_FILE="$LOG_DIR/hubai.log"
PID_FILE="$HUBAI_CONFIG_DIR/hubai.pid"

ACTION="start"
PORT="${PORT:-${HUBAI_PORT:-8080}}"
UNINSTALL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port|-p)
      PORT="$2"
      shift 2
      ;;
    --stop|stop)
      ACTION="stop"
      shift
      ;;
    --restart|restart)
      ACTION="restart"
      shift
      ;;
    --uninstall|uninstall)
      ACTION="uninstall"
      shift
      ;;
    --purge|purge|--clean|clean|--all|-a)
      ACTION="uninstall"
      UNINSTALL_ARGS+=("--purge")
      shift
      ;;
    *)
      UNINSTALL_ARGS+=("$1")
      shift
      ;;
  esac
done
export PORT="$PORT"

mkdir -p "$LOG_DIR"

if [ "$ACTION" = "uninstall" ]; then
  if [ -f "$INSTALL_DIR/uninstall.sh" ]; then
    exec bash "$INSTALL_DIR/uninstall.sh" "${UNINSTALL_ARGS[@]}"
  else
    echo "Executando desinstalação direta..."
    killall hubai 2>/dev/null || true
    pkill -f "$INSTALL_DIR" 2>/dev/null || true
    rm -f "$HOME/.local/bin/hubai" "$HOME/.local/share/hubai-updater.sh" "$HOME/.local/share/applications/hubai"*.desktop
    rm -rf "$INSTALL_DIR"
    if [[ " ${UNINSTALL_ARGS[*]} " =~ " --purge " ]]; then
      rm -rf "$HUBAI_CONFIG_DIR"
      echo "✓ HubAI e configurações completamente removidos do sistema."
    else
      echo "✓ HubAI desinstalado. Configurações mantidas em $HUBAI_CONFIG_DIR"
    fi
    exit 0
  fi
fi

if [ "$ACTION" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
      kill "$EXISTING_PID" 2>/dev/null || true
      rm -f "$PID_FILE"
      echo "✓ HubAI (PID: $EXISTING_PID) finalizado com sucesso."
    else
      rm -f "$PID_FILE"
      echo "HubAI não estava em execução."
    fi
  else
    echo "HubAI não estava em execução."
  fi
  # Garantir término de qualquer processo filho restante do HubAI
  pkill -f "$INSTALL_DIR" 2>/dev/null || true
  exit 0
fi

if [ "$ACTION" = "restart" ] || [ -f "$PID_FILE" ]; then
  EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    if [ "$ACTION" = "restart" ]; then
      kill "$EXISTING_PID" 2>/dev/null || true
      rm -f "$PID_FILE"
      sleep 1
    else
      echo "HubAI já está em execução (PID: $EXISTING_PID)."
      echo "Para trocar de porta ou reiniciar, execute: hubai --restart --port $PORT"
      echo "Ou acesse no navegador: http://localhost:$PORT"
      if command -v xdg-open &>/dev/null && [ -n "$DISPLAY$WAYLAND_DISPLAY" ]; then
        xdg-open "http://localhost:$PORT" &>/dev/null || true
      fi
      exit 0
    fi
  else
    rm -f "$PID_FILE"
  fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
  echo "ERRO: Instalação do HubAI não encontrada em $INSTALL_DIR."
  echo "Execute o instalador: bash install.sh"
  exit 1
fi

cd "$INSTALL_DIR"

# Garantir build compilado
if [ ! -d "dist" ]; then
  npm run build >> "$LOG_FILE" 2>&1
fi

# Iniciar HubAI desanexado do terminal (Background Daemon não bloqueante)
nohup npm start >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

sleep 1

echo "✓ HubAI iniciado com sucesso em segundo plano (PID: $NEW_PID)."
echo "  Painel disponível em: http://localhost:$PORT"
echo "  Logs gravados em:      $LOG_FILE"

if command -v xdg-open &>/dev/null && [ -n "$DISPLAY$WAYLAND_DISPLAY" ]; then
  xdg-open "http://localhost:$PORT" &>/dev/null &
fi

exit 0
EOF

chmod +x "$BIN_DIR/hubai"

# Instalar Desinstalador em ~/.local/share/hubai/uninstall.sh
if [ -f "$SCRIPT_DIR/uninstall.sh" ]; then
  cp "$SCRIPT_DIR/uninstall.sh" "$INSTALL_DIR/uninstall.sh"
  chmod +x "$INSTALL_DIR/uninstall.sh"
fi

# 6. Criar Atalhos no Menu, Área de Trabalho e Fixar na Dock do Ubuntu
echo "[6/6] Criando lançadores (.desktop), atalho na Área de Trabalho e fixando na Dock do Ubuntu..."
cat << EOF > "$DESKTOP_DIR/hubai.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=HubAI
GenericName=Gerenciador de Contas IA
Comment=Isolamento estrito de perfis Google Chrome para assistentes de IA
Exec=$BIN_DIR/hubai
Icon=google-chrome
Terminal=false
Categories=Network;WebBrowser;Utility;
Keywords=AI;Gemini;ChatGPT;Claude;Grok;Chrome;Profiles;
StartupNotify=true
EOF

chmod +x "$DESKTOP_DIR/hubai.desktop"

# Criar atalho na Área de Trabalho do Usuário (Desktop / Área de Trabalho)
USER_DESKTOP_DIR=""
if command -v xdg-user-dir &>/dev/null; then
  USER_DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "")"
fi
if [ -z "$USER_DESKTOP_DIR" ]; then
  if [ -d "$HOME/Área de Trabalho" ]; then
    USER_DESKTOP_DIR="$HOME/Área de Trabalho"
  else
    USER_DESKTOP_DIR="$HOME/Desktop"
  fi
fi

mkdir -p "$USER_DESKTOP_DIR"

if [ -d "$USER_DESKTOP_DIR" ]; then
  cp "$DESKTOP_DIR/hubai.desktop" "$USER_DESKTOP_DIR/hubai.desktop"
  chmod +x "$USER_DESKTOP_DIR/hubai.desktop"
  if command -v gio &>/dev/null; then
    gio set "$USER_DESKTOP_DIR/hubai.desktop" metadata::trusted true 2>/dev/null || true
  fi
  echo "✓ Atalho criado na Área de Trabalho: $USER_DESKTOP_DIR/hubai.desktop"
fi

# Fixar atalho na Dock do Ubuntu / GNOME Shell
if command -v gsettings &>/dev/null; then
  CURRENT_FAVORITES=$(gsettings get org.gnome.shell favorite-apps 2>/dev/null || echo "")
  if [ -n "$CURRENT_FAVORITES" ] && [[ "$CURRENT_FAVORITES" != *"hubai.desktop"* ]]; then
    NEW_FAVORITES=$(echo "$CURRENT_FAVORITES" | sed "s/]/, 'hubai.desktop']/" | sed "s/\\[, /\\[/")
    gsettings set org.gnome.shell favorite-apps "$NEW_FAVORITES" 2>/dev/null || true
    echo "✓ Atalho fixado automaticamente na Dock do Ubuntu/GNOME."
  fi
fi

# Atualizar base de atalhos do sistema
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "$DESKTOP_DIR" &>/dev/null || true
fi

echo ""
echo "=================================================="
echo "        HUBAI INSTALADO COM SUCESSO!              "
echo "=================================================="
echo "Diretório da aplicação: $INSTALL_DIR"
echo "Configuração do usuário: $CONFIG_DIR (preservada)"
echo "Comando no terminal:     hubai"
echo "Atalho no menu:          HubAI (.desktop)"
echo "Atalho na Área Trabalho: $USER_DESKTOP_DIR/hubai.desktop"
echo "Dock do Ubuntu:          Fixado na barra lateral"
echo "Atualizador autônomo:    $UPDATER_PATH"
echo "Desinstalador completo:  hubai uninstall --purge"
echo ""
echo "Para iniciar o aplicativo:"
echo "  • Clique no ícone do HubAI na Dock do Ubuntu ou na Área de Trabalho"
echo "  • Ou execute no terminal: hubai (inicia e libera o terminal imediatamente)"
echo ""
