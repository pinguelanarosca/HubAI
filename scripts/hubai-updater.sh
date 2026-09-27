#!/usr/bin/env bash
# ==============================================================================
# HubAI - Atualizador Externo Autônomo para Linux
# Repositório Oficial: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

REPO_URL="https://github.com/pinguelanarosca/HubAI.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/hubai}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/hubai}"
LOG_DIR="$CONFIG_DIR/logs"
BACKUP_DIR="$CONFIG_DIR/backups"
LOCK_FILE="$CONFIG_DIR/updater.lock"
LOG_FILE="$LOG_DIR/updater.log"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# Parse CLI arguments
OLD_PID=""
TARGET_DIR="$INSTALL_DIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pid)
      OLD_PID="$2"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --config-dir)
      CONFIG_DIR="$2"
      LOG_DIR="$CONFIG_DIR/logs"
      BACKUP_DIR="$CONFIG_DIR/backups"
      LOCK_FILE="$CONFIG_DIR/updater.lock"
      LOG_FILE="$LOG_DIR/updater.log"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Logging helper
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

log "=================================================="
log "       INICIANDO ATUALIZADOR EXTERNO HUBAI        "
log "=================================================="
log "Diretório Alvo: $TARGET_DIR"
log "Configuração:   $CONFIG_DIR (preservada)"
log "PID HubAI:      ${OLD_PID:-Não informado}"

# 1. Prevenção de Múltiplas Instâncias do Updater (Lock File)
if [ -f "$LOCK_FILE" ]; then
  EXISTING_LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$EXISTING_LOCK_PID" ] && kill -0 "$EXISTING_LOCK_PID" 2>/dev/null; then
    log "ERRO: Outro processo do atualizador já está em execução (PID: $EXISTING_LOCK_PID)."
    exit 1
  else
    log "Aviso: Lock obsoleto encontrado. Removendo..."
    rm -f "$LOCK_FILE"
  fi
fi

echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT INT TERM

# 2. Criar Backup de Segurança da Versão Atual
TIMESTAMP=$(date +%s)
BACKUP_PATH="$BACKUP_DIR/hubai-backup-$TIMESTAMP"
log "[1/6] Criando backup de segurança em $BACKUP_PATH..."
mkdir -p "$BACKUP_PATH"

if [ -d "$TARGET_DIR" ]; then
  for item in src server package.json package-lock.json tsconfig.json vite.config.ts server.ts .version; do
    if [ -e "$TARGET_DIR/$item" ]; then
      cp -r "$TARGET_DIR/$item" "$BACKUP_PATH/" 2>/dev/null || true
    fi
  done
  log "✓ Backup dos arquivos da aplicação concluído."
fi

# 3. Preparar Nova Versão em Diretório Temporário (Atualização Atômica / Staging)
STAGING_DIR=$(mktemp -d /tmp/hubai-staging-XXXXXX)
log "[2/6] Preparando nova versão no diretório de staging: $STAGING_DIR..."

FETCH_SUCCESS=false

# Cenário A: Se a instalação atual contiver repositório .git
if [ -d "$TARGET_DIR/.git" ] && command -v git &>/dev/null; then
  log "Instalação git detectada. Clonando/atualizando a partir do git local e remoto..."
  if git clone "$TARGET_DIR" "$STAGING_DIR" 2>> "$LOG_FILE"; then
    cd "$STAGING_DIR"
    git remote set-url origin "$REPO_URL" 2>> "$LOG_FILE" || true
    git pull origin main 2>> "$LOG_FILE" || git pull origin master 2>> "$LOG_FILE" || true
    FETCH_SUCCESS=true
  fi
fi

# Cenário B: Instalação sem .git ou clone local não realizado
if [ "$FETCH_SUCCESS" = false ]; then
  if command -v git &>/dev/null; then
    log "Baixando código mais recente de $REPO_URL..."
    rm -rf "$STAGING_DIR"
    mkdir -p "$STAGING_DIR"
    if git clone "$REPO_URL" "$STAGING_DIR" 2>> "$LOG_FILE"; then
      FETCH_SUCCESS=true
    fi
  fi
fi

# Se não foi possível baixar via git, tentar copiar arquivos locais como fallback
if [ "$FETCH_SUCCESS" = false ]; then
  log "Aviso: Git remoto indisponível. Utilizando arquivos locais para compilação..."
  cp -r "$TARGET_DIR/"* "$STAGING_DIR/" 2>/dev/null || true
  cp -r "$TARGET_DIR/".[!.]* "$STAGING_DIR/" 2>/dev/null || true
fi

# 4. Instalar Dependências e Compilar no Diretório de Staging
log "[3/6] Instalando dependências e compilando nova versão no staging..."
cd "$STAGING_DIR"

BUILD_SUCCESS=false
if npm install >> "$LOG_FILE" 2>&1 && npm run build >> "$LOG_FILE" 2>&1; then
  BUILD_SUCCESS=true
  log "✓ Compilação no diretório temporário finalizada com sucesso."
else
  log "ERRO: Falha ao compilar a nova versão no diretório temporário!"
fi

# 5. Rollback se a compilação falhou
if [ "$BUILD_SUCCESS" = false ]; then
  log "Disparando rollback automático. A instalação funcional atual NÃO foi modificada."
  rm -rf "$STAGING_DIR"
  log "✓ Rollback concluído. O sistema foi preservado na versão estável."
  exit 1
fi

# 6. Validar Resultado da Compilação
if [ ! -f "$STAGING_DIR/dist/index.html" ]; then
  log "ERRO: O artefato dist/index.html não foi gerado corretamente."
  rm -rf "$STAGING_DIR"
  exit 1
fi

# 7. Encerrar Processo Anterior do HubAI (se informado ou ativo)
log "[4/6] Encerrando processo anterior do HubAI para substituição segura..."
if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
  log "Finalizando processo HubAI antigo (PID: $OLD_PID)..."
  kill -15 "$OLD_PID" 2>/dev/null || true
  # Aguardar até 5 segundos
  for i in {1..10}; do
    if ! kill -0 "$OLD_PID" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
fi

# Se houver PID salvo em hubai.pid
PID_FILE="$CONFIG_DIR/hubai.pid"
if [ -f "$PID_FILE" ]; then
  SAVED_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$SAVED_PID" ] && kill -0 "$SAVED_PID" 2>/dev/null; then
    kill -15 "$SAVED_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$SAVED_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# 8. Substituição Atômica da Instalação
log "[5/6] Substituindo arquivos da aplicação em $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

# Copiar arquivos do staging para o diretório alvo
cp -r "$STAGING_DIR/"* "$TARGET_DIR/" 2>/dev/null || true
cp -r "$STAGING_DIR/".[!.]* "$TARGET_DIR/" 2>/dev/null || true

# Registrar versão / commit instalado
if command -v git &>/dev/null && [ -d "$STAGING_DIR/.git" ]; then
  NEW_COMMIT=$(git -C "$STAGING_DIR" rev-parse HEAD 2>/dev/null || echo "v1.0.0-updated")
  echo "$NEW_COMMIT" > "$TARGET_DIR/.version"
  echo "{\"installedCommit\": \"$NEW_COMMIT\", \"updatedAt\": \"$(date -Iseconds)\"}" > "$CONFIG_DIR/version.json"
fi

rm -rf "$STAGING_DIR"
log "✓ Instalação atualizada com sucesso."

# 9. Reiniciar o Novo HubAI
log "[6/6] Reiniciando nova instância do HubAI..."
LAUNCHER_BIN="$HOME/.local/bin/hubai"

if [ -x "$LAUNCHER_BIN" ]; then
  nohup "$LAUNCHER_BIN" >> "$LOG_DIR/hubai.log" 2>&1 &
  log "✓ HubAI reiniciado via $LAUNCHER_BIN (PID: $!)."
else
  cd "$TARGET_DIR"
  export HUBAI_CONFIG_DIR="$CONFIG_DIR"
  nohup npm start >> "$LOG_DIR/hubai.log" 2>&1 &
  echo "$!" > "$CONFIG_DIR/hubai.pid"
  log "✓ HubAI reiniciado diretamente via npm start (PID: $!)."
fi

log "=================================================="
log "      ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!          "
log "=================================================="
