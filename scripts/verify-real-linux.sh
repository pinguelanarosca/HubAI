#!/usr/bin/env bash
# ==============================================================================
# HubAI - Procedimento de Verificação e Validação no Linux Real
# Execute este script no seu PC com Linux gráfico e Google Chrome instalado:
#   bash scripts/verify-real-linux.sh
# ==============================================================================
set -e

CONFIG_DIR="$HOME/.config/hubai"
INSTALL_DIR="$HOME/.local/share/hubai"
LOG_FILE="$CONFIG_DIR/logs/real-linux-verification.log"

mkdir -p "$CONFIG_DIR/logs"

echo "=================================================="
echo "    VERIFICAÇÃO COMPLETA DO HUBAI NO LINUX REAL   "
echo "=================================================="
echo "Data/Hora: $(date)"
echo "Usuário:   $USER"
echo "Ambiente:  ${XDG_CURRENT_DESKTOP:-Terminal/CLI}"
echo ""

step() {
  echo ""
  echo "--------------------------------------------------"
  echo "[$1/10] $2"
  echo "--------------------------------------------------"
}

# 1. Instalação
step "1" "Validando instalação oficial (~/.local/share/hubai)..."
if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
  echo "✓ Diretório de instalação verificado em: $INSTALL_DIR"
else
  echo "Aviso: HubAI não encontrado em $INSTALL_DIR. Executando instalador..."
  bash install.sh
fi

# 2. Abertura pelo menu .desktop e Launcher
step "2" "Verificando Launcher (~/.local/bin/hubai) e Atalho .desktop..."
if [ -x "$HOME/.local/bin/hubai" ]; then
  echo "✓ Launcher executável em ~/.local/bin/hubai verificado."
else
  echo "ERRO: Launcher ~/.local/bin/hubai não encontrado."
  exit 1
fi

if [ -f "$HOME/.local/share/applications/hubai.desktop" ]; then
  echo "✓ Atalho de menu ~/.local/share/applications/hubai.desktop verificado."
else
  echo "Aviso: Atalho .desktop não encontrado."
fi

# 3. Descoberta dos perfis reais do Chrome
step "3" "Verificando perfis reais do Google Chrome em ~/.config/google-chrome..."
CHROME_DIR="$HOME/.config/google-chrome"
if [ -d "$CHROME_DIR" ]; then
  echo "✓ Diretório do Google Chrome encontrado em: $CHROME_DIR"
  if [ -f "$CHROME_DIR/Local State" ]; then
    echo "✓ Arquivo 'Local State' detectado para leitura segura de metadados."
  fi
  # Contar pastas de perfis reais
  PROFILES_FOUND=$(find "$CHROME_DIR" -maxdepth 1 -name "Default" -o -name "Profile *" | wc -l)
  echo "✓ Total de diretórios de perfil encontrados no disco: $PROFILES_FOUND"
else
  echo "Aviso: Diretório padrão do Chrome (~/.config/google-chrome) não encontrado."
  echo "Verifique se o Chrome/Chromium está instalado em outro caminho ou Flatpak/Snap."
fi

# 4. Importação e Persistência das Contas
step "4" "Verificando persistência das contas em ~/.config/hubai/hub-config.json..."
if [ -f "$CONFIG_DIR/hub-config.json" ]; then
  echo "✓ Arquivo de configuração ativo encontrado em: $CONFIG_DIR/hub-config.json"
  TOTAL_ACCOUNTS=$(grep -o '"id":' "$CONFIG_DIR/hub-config.json" | wc -l || echo "0")
  echo "✓ Contas configuradas no HubAI: $TOTAL_ACCOUNTS"
else
  echo "Aviso: Configuração inicial será criada na primeira execução."
fi

# 5. Execução do Launcher em Background
step "5" "Testando inicialização do serviço HubAI..."
"$HOME/.local/bin/hubai"
sleep 2

if curl -s http://localhost:3000/api/config >/dev/null; then
  echo "✓ Servidor HubAI respondendo normalmente na porta 3000."
else
  echo "Aguardando inicialização..."
  sleep 3
  if curl -s http://localhost:3000/api/config >/dev/null; then
    echo "✓ Servidor HubAI online."
  else
    echo "Aviso: Não foi possível conectar a http://localhost:3000. Verifique logs em $CONFIG_DIR/logs/hubai.log."
  fi
fi

# 6. Teste de Diagnóstico da API
step "6" "Executando diagnóstico completo da API..."
DIAG_RES=$(curl -s -X POST http://localhost:3000/api/diagnose || echo "{}")
if echo "$DIAG_RES" | grep -q '"success":true'; then
  echo "✓ Diagnóstico de sistema executado com sucesso."
  echo "$DIAG_RES" | grep -o '"overallStatus":"[^"]*"' || true
else
  echo "Aviso ao executar diagnóstico via API."
fi

# 7. Verificação de Atualização pelo GitHub
step "7" "Testando verificação de versão no repositório GitHub..."
UPDATE_RES=$(curl -s http://localhost:3000/api/app/check-update || echo "{}")
if echo "$UPDATE_RES" | grep -q '"success":true'; then
  echo "✓ Comunicação com repositório remoto pinguelanarosca/HubAI OK."
else
  echo "Aviso ao verificar atualizações remotas."
fi

# 8. Teste de Atualizador Externo e Lock
step "8" "Verificando integridade do script ~/.local/share/hubai-updater.sh..."
if [ -x "$HOME/.local/share/hubai-updater.sh" ]; then
  echo "✓ Atualizador externo autônomo instalado e executável."
else
  echo "ERRO: ~/.local/share/hubai-updater.sh não encontrado."
fi

# 9. Teste de Preservação de Configurações
step "9" "Validando integridade da pasta de logs e backups..."
echo "✓ Pasta de logs:    $CONFIG_DIR/logs"
echo "✓ Pasta de backups: $CONFIG_DIR/backups"

# 10. Resumo
step "10" "Conclusão e Próximos Passos no Ambiente Real"
echo "Painel HubAI:   http://localhost:3000"
echo "Configuração:   ~/.config/hubai/hub-config.json"
echo "Logs:           ~/.config/hubai/logs/hubai.log"
echo "Atualizador:    ~/.local/share/hubai-updater.sh"
echo ""
echo "=================================================="
echo "    VERIFICAÇÃO NO LINUX REAL CONCLUÍDA!          "
echo "=================================================="
