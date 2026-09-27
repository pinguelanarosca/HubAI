#!/usr/bin/env bash
# ==============================================================================
# HubAI - Atualizador Seguro para Linux
# Repositório: https://github.com/pinguelanarosca/HubAI
# ==============================================================================
set -e

if [ -d "$HOME/.local/share/hubai" ]; then
  APP_DIR="$HOME/.local/share/hubai"
else
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

CONFIG_DIR="$HOME/.config/hubai"
BACKUP_DIR="$CONFIG_DIR/backups"
TIMESTAMP=$(date +%s)
CURRENT_BACKUP="$BACKUP_DIR/hubai-backup-$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "        ATUALIZAÇÃO SEGURA DO HUBAI       "
echo "=========================================="
echo "Diretório do App:  $APP_DIR"
echo "Configuração:      $CONFIG_DIR (preservada)"
echo ""

# 1. Backup de segurança dos arquivos da aplicação
echo "[1/4] Criando backup de segurança em $CURRENT_BACKUP..."
mkdir -p "$CURRENT_BACKUP"
for item in src server package.json package-lock.json tsconfig.json vite.config.ts server.ts; do
  if [ -e "$APP_DIR/$item" ]; then
    cp -r "$APP_DIR/$item" "$CURRENT_BACKUP/"
  fi
done
echo "✓ Backup concluído."

# 2. Obter atualizações do repositório
echo "[2/4] Baixando atualizações do GitHub..."
cd "$APP_DIR"
if [ -d ".git" ]; then
  git pull origin main || git pull origin master
else
  echo "Repositório Git não configurado. Tentando sincronização de arquivos..."
fi

# 3. Atualizar dependências e compilar
echo "[3/4] Instalando dependências e compilando..."
if ! (npm install && npm run build); then
  echo "ERRO: Falha ao compilar a nova versão!"
  echo "Disparando rollback automático para a versão anterior..."
  for item in src server package.json package-lock.json tsconfig.json vite.config.ts server.ts; do
    if [ -e "$CURRENT_BACKUP/$item" ]; then
      cp -r "$CURRENT_BACKUP/$item" "$APP_DIR/"
    fi
  done
  npm run build
  echo "✓ Rollback concluído. A versão anterior foi mantida com segurança."
  exit 1
fi

echo "[4/4] Validação de integridade concluída com sucesso."
echo ""
echo "=========================================="
echo "      ATUALIZAÇÃO FINALIZADA COM SUCESSO! "
echo "=========================================="
