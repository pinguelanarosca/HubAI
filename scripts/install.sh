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

# 1. Checagem de Pré-requisitos
echo "[1/6] Verificando pré-requisitos do sistema..."

if ! command -v bash &>/dev/null; then
  echo "ERRO: bash é obrigatório."
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERRO: Node.js não foi encontrado no PATH."
  echo "Instale o Node.js v18 ou superior no seu sistema Linux antes de continuar."
  exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERRO: Node.js versão 18 ou superior é necessário. Versão detectada: $(node -v)"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "ERRO: npm não foi encontrado no PATH."
  exit 1
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

# 3. Obter Código-Fonte (Local ou do GitHub)
echo "[3/6] Configurando arquivos da aplicação em $INSTALL_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ] && [ -f "$SCRIPT_DIR/server.ts" ]; then
  echo "Instalando a partir do diretório local: $SCRIPT_DIR"
  cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/scripts" "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/public" "$INSTALL_DIR/" 2>/dev/null || true
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
else
  echo "ERRO: git não está instalado e nenhum diretório local com o código foi encontrado."
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
LOG_DIR="$HUBAI_CONFIG_DIR/logs"
LOG_FILE="$LOG_DIR/hubai.log"
PID_FILE="$HUBAI_CONFIG_DIR/hubai.pid"

ACTION="start"
PORT="${PORT:-${HUBAI_PORT:-3000}}"
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

# Iniciar HubAI desanexado do terminal
nohup npm start >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "HubAI iniciado com sucesso (PID: $NEW_PID)."
echo "Painel disponível em: http://localhost:$PORT"
echo "Logs gravados em:      $LOG_FILE"
EOF

chmod +x "$BIN_DIR/hubai"

# Instalar Desinstalador em ~/.local/share/hubai/uninstall.sh
if [ -f "$SCRIPT_DIR/uninstall.sh" ]; then
  cp "$SCRIPT_DIR/uninstall.sh" "$INSTALL_DIR/uninstall.sh"
  chmod +x "$INSTALL_DIR/uninstall.sh"
fi

# 6. Criar Atalho no Menu Desktop (~/.local/share/applications/hubai.desktop)
echo "[6/6] Criando lançador no menu desktop ($DESKTOP_DIR/hubai.desktop)..."
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
EOF

chmod +x "$DESKTOP_DIR/hubai.desktop"

echo ""
echo "=================================================="
echo "        HUBAI INSTALADO COM SUCESSO!              "
echo "=================================================="
echo "Diretório da aplicação: $INSTALL_DIR"
echo "Configuração do usuário: $CONFIG_DIR (preservada)"
echo "Comando no terminal:     hubai"
echo "Atualizador autônomo:    $UPDATER_PATH"
echo "Atalho no menu:          HubAI (.desktop)"
echo ""
echo "Para iniciar o aplicativo agora, execute: hubai"
echo "Ou abra o 'HubAI' pelo menu do seu sistema operacional."
echo ""
