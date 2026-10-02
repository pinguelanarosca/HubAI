#!/usr/bin/env bash
# ==============================================================================
# HubAI - Instalador Oficial para Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

REPO_URL="https://github.com/pinguelanarosca/HubAI.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/hubai}" # ~/.local/share/hubai
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/hubai}"        # ~/.config/hubai
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
UPDATER_PATH="$HOME/.local/share/hubai-updater.sh"

echo "=================================================="
echo "         INSTALADOR OFICIAL HUBAI - LINUX         "
echo "=================================================="
echo ""

# 1. Checagem e Auto-Instalação de Pré-requisitos
echo "[1/6] Verificando e preparando pré-requisitos do sistema..."

export PATH="$HOME/.local/bin:$INSTALL_DIR/node/bin:/usr/local/bin:$PATH"

if ! command -v bash &>/dev/null; then
  echo "ERRO: bash é obrigatório."
  exit 1
fi

check_node_ready() {
  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    local major
    major=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [ -n "$major" ] && [ "$major" -ge 18 ] 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

# Auto-instalação e provisionamento de Node.js caso ausente ou desatualizado (< v18)
if ! check_node_ready; then
  echo "Node.js v18+ não foi detectado no PATH."
  echo "Providenciando Node.js automaticamente para o HubAI..."

  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    armv7l) NODE_ARCH="armv7l" ;;
    *) NODE_ARCH="x64" ;;
  esac

  NODE_VERSION="v20.18.0"
  NODE_DIST_NAME="node-${NODE_VERSION}-linux-${NODE_ARCH}"
  NODE_INSTALL_TARGET="$INSTALL_DIR/node"
  TEMP_NODE_DIR=$(mktemp -d /tmp/hubai-node-install-XXXXXX)

  DOWNLOAD_CMD=""
  if command -v curl &>/dev/null; then
    DOWNLOAD_CMD="curl -fsSL"
  elif command -v wget &>/dev/null; then
    DOWNLOAD_CMD="wget -qO-"
  fi

  # Método 1: Download oficial de binário pré-compilado (100% isolado, sem necessidade de sudo/root)
  if [ -n "$DOWNLOAD_CMD" ]; then
    echo "Baixando Node.js LTS oficial ($NODE_VERSION para $NODE_ARCH)..."
    mkdir -p "$NODE_INSTALL_TARGET"
    mkdir -p "$BIN_DIR"

    SUCCESS_DOWNLOAD=false
    if $DOWNLOAD_CMD "https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST_NAME}.tar.xz" 2>/dev/null | tar -xJ -C "$TEMP_NODE_DIR" 2>/dev/null; then
      SUCCESS_DOWNLOAD=true
    elif $DOWNLOAD_CMD "https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST_NAME}.tar.gz" 2>/dev/null | tar -xz -C "$TEMP_NODE_DIR" 2>/dev/null; then
      SUCCESS_DOWNLOAD=true
    fi

    if [ "$SUCCESS_DOWNLOAD" = true ] && [ -d "$TEMP_NODE_DIR/$NODE_DIST_NAME" ]; then
      cp -r "$TEMP_NODE_DIR/$NODE_DIST_NAME/"* "$NODE_INSTALL_TARGET/"
      ln -sf "$NODE_INSTALL_TARGET/bin/node" "$BIN_DIR/node"
      ln -sf "$NODE_INSTALL_TARGET/bin/npm" "$BIN_DIR/npm"
      ln -sf "$NODE_INSTALL_TARGET/bin/npx" "$BIN_DIR/npx"
      export PATH="$NODE_INSTALL_TARGET/bin:$BIN_DIR:$PATH"
      echo "✓ Node.js ($NODE_VERSION) provisionado com sucesso em $NODE_INSTALL_TARGET"
    fi
    rm -rf "$TEMP_NODE_DIR"
  fi

  # Método 2: Tentativa via gerenciador de pacotes se método isolado não concluir
  if ! check_node_ready; then
    echo "Tentando instalar Node.js via gerenciador de pacotes do sistema..."
    if command -v apt-get &>/dev/null; then
      if [ "$EUID" -eq 0 ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - 2>/dev/null || true
        apt-get update && apt-get install -y nodejs || true
      elif command -v sudo &>/dev/null; then
        echo "Solicitando permissão para instalar Node.js via apt-get..."
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | sudo -E bash - 2>/dev/null || true
        sudo apt-get update && sudo apt-get install -y nodejs || true
      fi
    elif command -v dnf &>/dev/null; then
      if [ "$EUID" -eq 0 ]; then
        dnf install -y nodejs npm || true
      elif command -v sudo &>/dev/null; then
        sudo dnf install -y nodejs npm || true
      fi
    elif command -v pacman &>/dev/null; then
      if [ "$EUID" -eq 0 ]; then
        pacman -Sy --noconfirm nodejs npm || true
      elif command -v sudo &>/dev/null; then
        sudo pacman -Sy --noconfirm nodejs npm || true
      fi
    fi
  fi

  # Verificação de segurança
  if ! check_node_ready; then
    echo "ERRO: Não foi possível providenciar o Node.js automaticamente."
    echo "Por favor, instale o Node.js v18 ou superior no seu sistema Linux e execute o instalador novamente:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  Fedora: sudo dnf install -y nodejs npm"
    echo "  Arch: sudo pacman -S nodejs npm"
    exit 1
  fi
fi

echo "✓ Node.js $(node -v) e npm $(npm -v) verificados com sucesso."

# 2. Preparar Diretórios do Usuário (Sem necessidade de sudo)
echo "[2/6] Preparando diretórios do usuário..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$CONFIG_DIR/logs"
mkdir -p "$CONFIG_DIR/backups"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"

# 3. Obter Código-Fonte (Local, Git ou Download Direto)
echo "[3/6] Configurando arquivos da aplicação em $INSTALL_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ] && [ -f "$SCRIPT_DIR/server.ts" ]; then
  echo "Instalando a partir do diretório local: $SCRIPT_DIR"
  cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/scripts" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/public" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/chrome-extension" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/package-lock.json" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/vite.config.ts" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/server.ts" "$INSTALL_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/index.html" "$INSTALL_DIR/" 2>/dev/null || true
  if [ -f "$SCRIPT_DIR/.version" ]; then
    cp "$SCRIPT_DIR/.version" "$INSTALL_DIR/" 2>/dev/null || true
  fi
elif command -v git &>/dev/null; then
  echo "Clonando do repositório remoto $REPO_URL..."
  TEMP_CLONE=$(mktemp -d /tmp/hubai-install-XXXXXX)
  git clone "$REPO_URL" "$TEMP_CLONE"
  cp -r "$TEMP_CLONE/"* "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$TEMP_CLONE/".[!.]* "$INSTALL_DIR/" 2>/dev/null || true
  rm -rf "$TEMP_CLONE"
elif command -v curl &>/dev/null || command -v wget &>/dev/null; then
  echo "Baixando código-fonte oficial do repositório $REPO_URL..."
  TEMP_CLONE=$(mktemp -d /tmp/hubai-tarball-XXXXXX)
  if command -v curl &>/dev/null; then
    curl -fsSL "https://github.com/pinguelanarosca/HubAI/archive/refs/heads/main.tar.gz" | tar -xz -C "$TEMP_CLONE"
  else
    wget -qO- "https://github.com/pinguelanarosca/HubAI/archive/refs/heads/main.tar.gz" | tar -xz -C "$TEMP_CLONE"
  fi
  cp -r "$TEMP_CLONE/HubAI-main/"* "$INSTALL_DIR/" 2>/dev/null || cp -r "$TEMP_CLONE/"*/* "$INSTALL_DIR/" 2>/dev/null || true
  rm -rf "$TEMP_CLONE"
else
  echo "ERRO: Nem git, curl ou wget foram encontrados para baixar a aplicação."
  exit 1
fi

# 4. Instalar Dependências e Compilar
echo "[4/6] Instalando dependências e compilando aplicação..."
cd "$INSTALL_DIR"
npm install --legacy-peer-deps || npm install
npm run build

# 5. Instalar Atualizador Externo Autônomo (~/.local/share/hubai-updater.sh)
echo "[5/6] Instalando atualizador externo e launcher..."
if [ -f "$INSTALL_DIR/scripts/hubai-updater.sh" ]; then
  cp "$INSTALL_DIR/scripts/hubai-updater.sh" "$UPDATER_PATH"
else
  cp "$SCRIPT_DIR/scripts/hubai-updater.sh" "$UPDATER_PATH" 2>/dev/null || true
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
export PATH="$HOME/.local/bin:$INSTALL_DIR/node/bin:/usr/local/bin:$PATH"
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
