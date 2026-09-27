# HubAI - Gerenciador de Contas IA Linux

Central desktop para organizar, isolar e alternar entre **múltiplas contas e provedores de IA** (Google Gemini, ChatGPT, Claude, Microsoft Copilot, Perplexity, DeepSeek, Grok, NotebookLM e HuggingChat) no ambiente Linux utilizando os perfis reais do Google Chrome / Chromium.

---

## 🚀 1. Instalação Oficial

O instalador oficial funciona em qualquer distribuição Linux (Ubuntu, Debian, Fedora, Arch, Pop!_OS, Linux Mint, Manjaro, openSUSE) e **não exige sudo**.

### Pré-requisitos
- **Bash**
- **Node.js** (v18 ou superior)
- **npm**
- **Git** (recomendado)

### Comando de Instalação

No diretório do projeto ou via terminal:

```bash
bash install.sh
```

### O que o instalador configura:
1. **Aplicação**: `~/.local/share/hubai/`
2. **Configuração do Usuário**: `~/.config/hubai/hub-config.json` (preservada em atualizações e reinstalações)
3. **Lançador Executável**: `~/.local/bin/hubai`
4. **Atualizador Autônomo**: `~/.local/share/hubai-updater.sh`
5. **Atalho Desktop**: `~/.local/share/applications/hubai.desktop`

---

## 🖥️ 2. Como Iniciar o HubAI

### Pelo Terminal
```bash
hubai
```

### Pelo Menu de Aplicativos
Procure por **HubAI** no menu de aplicativos do seu ambiente gráfico (GNOME, KDE Plasma, XFCE, Cinnamon, Cosmic, etc.).

A interface estará disponível em: **`http://localhost:3000`**

---

## ⚙️ 3. Localização das Configurações e Logs

- **Configurações do Usuário**: `~/.config/hubai/hub-config.json`
- **Logs do Servidor**: `~/.config/hubai/logs/hubai.log`
- **Logs do Atualizador**: `~/.config/hubai/logs/updater.log`
- **Backups Automáticos**: `~/.config/hubai/backups/`
- **Arquivo PID**: `~/.config/hubai/hubai.pid`

---

## 🔍 4. Sincronização de Perfis do Google Chrome

O HubAI descobre e vincula perfis reais do Chrome sem exigir novos logins ou exportar senhas:

1. Abra o HubAI e clique no botão **Configurações** (ou **Sincronizar Contas**).
2. Na aba **Sincronização & Contas Chrome**, clique em **"Sincronizar Contas do Chrome"**.
3. O HubAI lê os metadados locais de `~/.config/google-chrome/Local State` e `Preferences`.
4. As correspondências são categorizadas com prioridade:
   - **E-mail** (prioridade máxima, alta confiança);
   - **Nome de exibição** (confiança média);
   - **Diretório do perfil** (`Default`, `Profile 1`, etc.);
   - **Sugestão manual** (requer confirmação explícita do usuário).
5. Clique em **"Importar perfis encontrados"** para aplicar apenas as correspondências comprovadas.
6. Perfis não associados podem ser vinculados individualmente pelo seletor manual.

---

## 🔄 5. Atualização do HubAI

A atualização do HubAI é executada por um **atualizador autônomo externo** (`~/.local/share/hubai-updater.sh`) fora do processo do servidor Node:

1. Clique no botão **"Atualizar Hub"** no cabeçalho da aplicação.
2. O sistema verifica novos commits no repositório `https://github.com/pinguelanarosca/HubAI`.
3. Ao confirmar a atualização:
   - Um backup completo da versão atual é gerado em `~/.config/hubai/backups/`;
   - A nova versão é preparada e compilada em uma área temporária isolada (`/tmp/hubai-staging-XXXXXX`);
   - Se a compilação tiver sucesso, o processo antigo é encerrado e a instalação é substituída de forma atômica;
   - O HubAI é reiniciado automaticamente e a interface web se reconecta;
   - Se houver qualquer erro de build, o **rollback automático** restaura a versão anterior.

---

## 🗑️ 6. Desinstalação

Para desinstalar o HubAI preservando suas contas e configurações:
```bash
bash uninstall.sh
```

Para desinstalar e **apagar também as configurações**:
```bash
bash uninstall.sh --purge
```

> **Nota**: Seus perfis reais do Google Chrome (`~/.config/google-chrome`) **nunca são tocados ou alterados** na desinstalação.

---

## 🧪 7. Testes Automatizados vs Testes no Linux Real

### Testes Automatizados no Workspace / Sandbox (`npm test`)
Executam 100% no ambiente automatizado:
- Saneamento técnico de caminhos e parâmetros determinísticos (`tests/sanitization.test.ts`);
- Leitura de metadados de perfis em disco simulado (`tests/integration.test.ts`);
- Algoritmo de correspondência prioritária (E-mail -> Nome -> Diretório);
- Prevenção de duplicidade de perfis em contas distintas;
- Validação sintática e de caminhos do `install.sh`, `uninstall.sh` e `hubai-updater.sh`;
- Criação de backup, staging temporário e rollback em caso de falha de build;
- Mecanismo de lock contra concorrência no atualizador (`updater.lock`).

### Testes Pendentes no Linux Real
Devem ser validados diretamente no PC do usuário:
1. **Ambiente Gráfico Real**: Exibição da janela do navegador através do display X11/Wayland;
2. **Menu Desktop**: Lançamento do ícone `hubai.desktop` pelo lançador de aplicativos do sistema;
3. **Perfis Reais do Chrome**: Detecção e abertura simultânea de 9 perfis reais do Google Chrome no disco do usuário;
4. **Sessão do Navegador**: Abertura real dos links de IA mantendo o login pré-existente de cada conta.

Para rodar o script de verificação no seu Linux:
```bash
bash scripts/verify-real-linux.sh
```
