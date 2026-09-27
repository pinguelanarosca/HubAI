#!/usr/bin/env bash
# ==============================================================================
# HubAI - Instalador Oficial para Linux
# Repositório: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

REPO_URL="https://github.com/pinguelanarosca/HubAI.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/hubai}" # ~/.local/share/hubai
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/hubai}"        # ~/.config/hubai
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"

echo "=========================================="
echo "         INSTALADOR HUBAI - LINUX         "
echo "=========================================="

# 1. Checagem de Pré-requisitos
echo "[1/6] Verificando pré-requisitos do sistema..."

if ! command -v bash &>/dev/null; then
  echo "ERRO: bash é obrigatório."
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERRO: Node.js não foi encontrado no PATH. Instale o Node.js v18 ou superior."
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

if ! command -v git &>/dev/null; then
  echo "AVISO: git não foi encontrado no PATH. A instalação utilizará os arquivos locais."
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
mkdir -p "$ICON_DIR"

# 3. Baixar ou Copiar Código-Fonte
echo "[3/6] Configurando arquivos da aplicação em $INSTALL_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ]; then
  echo "Instalando a partir do diretório local: $SCRIPT_DIR"
  cp -r "$SCRIPT_DIR/"* "$INSTALL_DIR/" 2>/dev/null || true
  cp -r "$SCRIPT_DIR/".[!.]* "$INSTALL_DIR/" 2>/dev/null || true
elif command -v git &>/dev/null; then
  echo "Clonando do repositório $REPO_URL..."
  if [ -d "$INSTALL_DIR/.git" ]; then
    cd "$INSTALL_DIR"
    git pull origin main || git pull origin master
  else
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
else
  echo "ERRO: Não foi possível localizar o código-fonte local nem clonar do GitHub."
  exit 1
fi

# 4. Instalar Dependências e Compilar
echo "[4/6] Instalando dependências e compilando aplicação..."
cd "$INSTALL_DIR"
npm install
npm run build

# 5. Criar Executável Launcher no PATH (~/.local/bin/hubai)
echo "[5/6] Criando comando executável em $BIN_DIR/hubai..."
cat << 'EOF' > "$BIN_DIR/hubai"
#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/hubai"
export HUBAI_CONFIG_DIR="$HOME/.config/hubai"
mkdir -p "$HUBAI_CONFIG_DIR/logs"

cd "$INSTALL_DIR"
exec npm start >> "$HUBAI_CONFIG_DIR/logs/hubai.log" 2>&1
EOF

chmod +x "$BIN_DIR/hubai"

# 6. Criar Atalho no Menu de Aplicativos Linux (~/.local/share/applications/hubai.desktop)
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
echo "=========================================="
echo "      HUBAI INSTALADO COM SUCESSO!        "
echo "=========================================="
echo "Diretório da aplicação: $INSTALL_DIR"
echo "Configuração do usuário: $CONFIG_DIR"
echo "Comando no terminal:     hubai"
echo "Atalho no menu:          HubAI no menu de aplicativos"
echo ""
echo "Para iniciar agora, execute: hubai"
echo "Ou abra 'HubAI' pelo menu do seu ambiente gráfico (GNOME, KDE, XFCE)."
