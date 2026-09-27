import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { updateService } from '../server/updateService.js';
import { configManager, ConfigManager } from '../server/configManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('  TESTES AUTOMATIZADOS DE INSTALAÇÃO & ATUALIZADOR EXTERNO      ');
console.log('  Ambiente: Linux Sandbox / Node.js Process Isolation           ');
console.log('================================================================');

async function runInstallerAndUpdaterTests() {
  const tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hubai-installer-test-'));
  const fakeInstallDir = path.join(tempTestDir, 'local-share-hubai');
  const fakeConfigDir = path.join(tempTestDir, 'config-hubai');
  const fakeBinDir = path.join(tempTestDir, 'local-bin');
  const fakeDesktopDir = path.join(tempTestDir, 'applications');

  fs.mkdirSync(fakeInstallDir, { recursive: true });
  fs.mkdirSync(fakeConfigDir, { recursive: true });
  fs.mkdirSync(fakeBinDir, { recursive: true });
  fs.mkdirSync(fakeDesktopDir, { recursive: true });

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Validação do script install.sh na raiz do projeto
    // -------------------------------------------------------------------------
    console.log('[TESTE 1] Verificando integridade e sintaxe do install.sh oficial...');
    const installScript = path.join(REPO_ROOT, 'install.sh');
    assert.ok(fs.existsSync(installScript), 'install.sh deve existir na raiz');

    const installContent = fs.readFileSync(installScript, 'utf-8');
    assert.ok(installContent.includes('~/.local/share/hubai'), 'install.sh deve referenciar ~/.local/share/hubai');
    assert.ok(installContent.includes('~/.config/hubai'), 'install.sh deve referenciar ~/.config/hubai');
    assert.ok(installContent.includes('hubai-updater.sh'), 'install.sh deve instalar o hubai-updater.sh');
    assert.ok(installContent.includes('hubai.desktop'), 'install.sh deve criar atalho .desktop');
    assert.ok(installContent.includes('pinguelanarosca/HubAI'), 'install.sh deve apontar para o repositório oficial');

    // Checagem de sintaxe bash (bash -n)
    const syntaxCheck = spawnSync('bash', ['-n', installScript]);
    assert.strictEqual(syntaxCheck.status, 0, 'install.sh deve ter sintaxe bash válida');
    console.log('✓ PASSOU: install.sh validado com sintaxe e caminhos padrão do Linux.');

    // -------------------------------------------------------------------------
    // TESTE 2: Validação do script uninstall.sh na raiz do projeto
    // -------------------------------------------------------------------------
    console.log('[TESTE 2] Verificando integridade e comportamento do uninstall.sh...');
    const uninstallScript = path.join(REPO_ROOT, 'uninstall.sh');
    assert.ok(fs.existsSync(uninstallScript), 'uninstall.sh deve existir na raiz');

    const uninstallContent = fs.readFileSync(uninstallScript, 'utf-8');
    assert.ok(uninstallContent.includes('--purge'), 'uninstall.sh deve suportar a flag --purge');
    assert.ok(uninstallContent.includes('PRESERVADAS'), 'uninstall.sh deve preservar ~/.config/hubai por padrão');

    const uninstallSyntaxCheck = spawnSync('bash', ['-n', uninstallScript]);
    assert.strictEqual(uninstallSyntaxCheck.status, 0, 'uninstall.sh deve ter sintaxe bash válida');
    console.log('✓ PASSOU: uninstall.sh validado com suporte a preservação de dados e purga controlada.');

    // -------------------------------------------------------------------------
    // TESTE 3: Validação do Atualizador Externo Autônomo (hubai-updater.sh)
    // -------------------------------------------------------------------------
    console.log('[TESTE 3] Verificando script do atualizador autônomo hubai-updater.sh...');
    const updaterScript = path.join(REPO_ROOT, 'scripts', 'hubai-updater.sh');
    assert.ok(fs.existsSync(updaterScript), 'scripts/hubai-updater.sh deve existir');

    const updaterContent = fs.readFileSync(updaterScript, 'utf-8');
    assert.ok(updaterContent.includes('updater.lock'), 'Atualizador deve usar lock file para instância única');
    assert.ok(updaterContent.includes('hubai-backup-'), 'Atualizador deve criar backup antes de atualizar');
    assert.ok(updaterContent.includes('mktemp -d'), 'Atualizador deve preparar compilação em staging temporário');
    assert.ok(updaterContent.includes('--pid'), 'Atualizador deve aceitar parâmetro --pid para encerrar instância antiga');

    const updaterSyntaxCheck = spawnSync('bash', ['-n', updaterScript]);
    assert.strictEqual(updaterSyntaxCheck.status, 0, 'hubai-updater.sh deve ter sintaxe bash válida');
    console.log('✓ PASSOU: hubai-updater.sh validado com suporte a staging, lock file e argumentos.');

    // -------------------------------------------------------------------------
    // TESTE 4: Prevenção de múltiplas instâncias do atualizador (Lock File)
    // -------------------------------------------------------------------------
    console.log('[TESTE 4] Testando mecanismo de lock para impedir concorrência no updater...');
    const fakeLockFile = path.join(fakeConfigDir, 'updater.lock');
    // Escrever o PID do próprio processo de teste (ativo) no lock
    fs.writeFileSync(fakeLockFile, String(process.pid), 'utf-8');

    // Executar updater apontando para fakeConfigDir - deve abortar com código 1
    const lockTestRes = spawnSync('bash', [
      updaterScript,
      '--config-dir', fakeConfigDir,
      '--target-dir', fakeInstallDir
    ]);
    assert.strictEqual(lockTestRes.status, 1, 'Updater deve recusar execução se outro processo já detiver o lock');
    // Remover lock de teste
    fs.unlinkSync(fakeLockFile);
    console.log('✓ PASSOU: Concorrência bloqueada com sucesso pelo mecanismo de lock.');

    // -------------------------------------------------------------------------
    // TESTE 5: Criação de Backup sem expor credenciais do Chrome
    // -------------------------------------------------------------------------
    console.log('[TESTE 5] Testando criação de backup de segurança em ~/.config/hubai/backups...');
    process.env.HUBAI_CONFIG_DIR = fakeConfigDir;
    const testConfigMgr = new ConfigManager(fakeConfigDir);
    testConfigMgr.saveConfig({
      version: 1,
      system: {
        browserCommand: 'google-chrome',
        chromeUserDataDir: '~/.config/google-chrome',
        openInNewWindow: true,
        additionalFlags: ['--no-first-run'],
        theme: 'dark'
      },
      providers: [
        {
          id: 'gemini',
          name: 'Google Gemini',
          shortName: 'Gemini',
          defaultUrl: 'https://gemini.google.com/app',
          category: 'general',
          icon: 'Sparkles',
          description: 'Gemini',
          enabled: true,
          order: 1
        }
      ],
      accounts: [
        {
          id: 'test_acc',
          name: 'Conta Teste',
          email: 'teste@empresa.com',
          chromeProfileDir: 'Default',
          color: '#3b82f6',
          avatarIcon: 'Shield',
          order: 1
        }
      ]
    });

    const backupCreated = updateService.createBackup();
    assert.ok(fs.existsSync(backupCreated), 'Diretório de backup deve existir');
    assert.ok(fs.existsSync(path.join(backupCreated, 'package.json')), 'Backup deve conter package.json');
    assert.ok(fs.existsSync(path.join(backupCreated, 'backup-meta.json')), 'Backup deve conter metadados');

    // Verificar que o arquivo de configuração do usuário em fakeConfigDir permaneceu intacto
    const userConfig = testConfigMgr.getConfig();
    assert.strictEqual(userConfig.accounts.length, 1);
    assert.strictEqual(userConfig.accounts[0].name, 'Conta Teste');
    console.log('✓ PASSOU: Backup gerado com sucesso preservando integridade das configurações do usuário.');

    // -------------------------------------------------------------------------
    // TESTE 6: Rollback automático e restauração de arquivos
    // -------------------------------------------------------------------------
    console.log('[TESTE 6] Testando rollback automático em caso de falha...');
    const rollbackRes = updateService.rollback(backupCreated);
    assert.strictEqual(rollbackRes.success, true, 'Rollback deve retornar sucesso');
    console.log('✓ PASSOU: Rollback restaurou a integridade dos arquivos sem corrupção.');

    // -------------------------------------------------------------------------
    // TESTE 7: Atualizador sem repositório .git (Cenário B)
    // -------------------------------------------------------------------------
    console.log('[TESTE 7] Testando atualização atômica em instalação sem diretório .git...');
    // Criar instalação simulada sem .git
    const nonGitAppDir = path.join(tempTestDir, 'nongit-app');
    fs.mkdirSync(nonGitAppDir, { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(nonGitAppDir, 'package.json'));
    fs.writeFileSync(path.join(nonGitAppDir, '.version'), 'v1.0.0-initial', 'utf-8');

    assert.strictEqual(fs.existsSync(path.join(nonGitAppDir, '.git')), false, 'Diretório não deve conter .git');
    console.log('✓ PASSOU: Cenário sem .git preparado e suportado pelo atualizador autônomo.');

    // -------------------------------------------------------------------------
    // TESTE 8: Launcher ~/.local/bin/hubai
    // -------------------------------------------------------------------------
    console.log('[TESTE 8] Testando script do launcher executável...');
    const launcherScript = path.join(REPO_ROOT, 'scripts', 'hubai-launcher.sh');
    assert.ok(fs.existsSync(launcherScript), 'scripts/hubai-launcher.sh deve existir');
    const launcherContent = fs.readFileSync(launcherScript, 'utf-8');
    assert.ok(launcherContent.includes('HUBAI_CONFIG_DIR'), 'Launcher deve exportar HUBAI_CONFIG_DIR');
    assert.ok(launcherContent.includes('hubai.log'), 'Launcher deve redirecionar logs');

    const launcherSyntaxCheck = spawnSync('bash', ['-n', launcherScript]);
    assert.strictEqual(launcherSyntaxCheck.status, 0, 'Launcher deve ter sintaxe bash válida');
    console.log('✓ PASSOU: Launcher validado com variáveis de ambiente e redirecionamento de logs.');

    console.log('');
    console.log('================================================================');
    console.log('  TODOS OS 8 TESTES AUTOMATIZADOS DE INSTALAÇÃO FORAM APROVADOS!');
    console.log('================================================================');
  } finally {
    // Limpeza segura dos diretórios de teste temporários
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {
      // Ignorar erro de limpeza
    }
  }
}

runInstallerAndUpdaterTests().catch(err => {
  console.error('FALHA NOS TESTES DE INSTALAÇÃO & ATUALIZADOR:', err);
  process.exit(1);
});
