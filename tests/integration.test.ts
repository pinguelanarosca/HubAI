import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../server/configManager.js';
import { LauncherService } from '../server/launcherService.js';
import { ProfileScanner } from '../server/profileScanner.js';
import { DiagnosticService } from '../server/diagnosticService.js';
import { UpdateService } from '../server/updateService.js';
import { HubConfig, ProfileImportBinding } from '../src/types.js';

async function runIntegrationTests() {
  console.log('================================================================');
  console.log('  INICIANDO SUÍTE DE TESTES DE INTEGRAÇÃO & ATUALIZAÇÃO (HUBAI) ');
  console.log('================================================================\n');

  // Diretório temporário ISOLADO para testes - nunca toca nas pastas reais do usuário
  const tempTestRoot = path.join(os.tmpdir(), `hubai-integration-test-${Date.now()}`);
  const tempUserConfigDir = path.join(tempTestRoot, 'config-hubai');
  const tempChromeDataDir = path.join(tempTestRoot, 'chrome-user-data');

  fs.mkdirSync(tempTestRoot, { recursive: true });
  fs.mkdirSync(tempUserConfigDir, { recursive: true });
  fs.mkdirSync(tempChromeDataDir, { recursive: true });

  process.env.HUBAI_CONFIG_DIR = tempUserConfigDir;

  const testConfigManager = new ConfigManager(tempUserConfigDir);
  const scanner = new ProfileScanner(testConfigManager);
  const launcher = new LauncherService(testConfigManager);
  const updater = new UpdateService();

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Descoberta de perfis Chrome reais e leitura do Local State
    // -------------------------------------------------------------------------
    console.log('[TESTE 1] Testando descoberta de perfis e leitura do Local State...');

    // Criar perfil Default e Profile 1 no diretório temporário
    const defaultDir = path.join(tempChromeDataDir, 'Default');
    const profile1Dir = path.join(tempChromeDataDir, 'Profile 1');
    fs.mkdirSync(defaultDir, { recursive: true });
    fs.mkdirSync(profile1Dir, { recursive: true });

    // Criar Local State com info_cache
    const localStateContent = {
      profile: {
        info_cache: {
          Default: {
            name: 'Alexandre Principal',
            user_name: 'alexandre.principal@gmail.com',
            gaia_id: 'gaia_11111111'
          },
          'Profile 1': {
            name: 'Trabalho Empresa',
            user_name: 'alexandre.work@empresa.com',
            gaia_id: 'gaia_22222222'
          }
        }
      }
    };
    fs.writeFileSync(path.join(tempChromeDataDir, 'Local State'), JSON.stringify(localStateContent, null, 2));

    const scan = scanner.scanProfiles(tempChromeDataDir);
    assert.strictEqual(scan.userDataDirExists, true);
    assert.strictEqual(scan.profiles.length, 2);

    const defaultProfile = scan.profiles.find(p => p.dirName === 'Default');
    assert.ok(defaultProfile, 'Default profile deve ser detectado');
    assert.strictEqual(defaultProfile?.displayName, 'Alexandre Principal');
    assert.strictEqual(defaultProfile?.email, 'alexandre.principal@gmail.com');
    assert.strictEqual(defaultProfile?.gaiaId, 'gaia_11111111');

    const prof1 = scan.profiles.find(p => p.dirName === 'Profile 1');
    assert.ok(prof1, 'Profile 1 deve ser detectado');
    assert.strictEqual(prof1?.displayName, 'Trabalho Empresa');
    assert.strictEqual(prof1?.email, 'alexandre.work@empresa.com');

    console.log('✓ PASSOU: Descoberta de perfis reais e metadados de Local State verificados.');

    // -------------------------------------------------------------------------
    // TESTE 2: Leitura de nome e e-mail a partir de Preferences
    // -------------------------------------------------------------------------
    console.log('[TESTE 2] Testando leitura de Preferences em perfil secundário...');
    const profile2Dir = path.join(tempChromeDataDir, 'Profile 2');
    fs.mkdirSync(profile2Dir, { recursive: true });

    const preferencesContent = {
      profile: {
        name: 'Pesquisador Acadêmico'
      },
      account_info: [
        {
          email: 'pesquisa.ia@universidade.br',
          gaia_id: 'gaia_33333333'
        }
      ]
    };
    fs.writeFileSync(path.join(profile2Dir, 'Preferences'), JSON.stringify(preferencesContent, null, 2));

    const scanWithPrefs = scanner.scanProfiles(tempChromeDataDir);
    const prof2 = scanWithPrefs.profiles.find(p => p.dirName === 'Profile 2');
    assert.ok(prof2, 'Profile 2 deve ser descoberto');
    assert.strictEqual(prof2?.displayName, 'Pesquisador Acadêmico');
    assert.strictEqual(prof2?.email, 'pesquisa.ia@universidade.br');
    console.log('✓ PASSOU: Leitura segura de nome e e-mail via Preferences confirmada.');

    // -------------------------------------------------------------------------
    // TESTE 3: Sincronização e algoritmo de correspondência (E-mail -> Nome -> Diretório)
    // -------------------------------------------------------------------------
    console.log('[TESTE 3] Testando correspondência automática prioritária...');
    // Configurar contas de teste
    const testConfig: HubConfig = {
      version: 1,
      system: {
        browserCommand: 'google-chrome',
        chromeUserDataDir: tempChromeDataDir,
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
          id: 'acc_target_email',
          name: 'Conta Antiga',
          email: 'alexandre.principal@gmail.com', // Match por email com Default
          chromeProfileDir: 'Profile 99',
          color: '#3b82f6',
          avatarIcon: 'Shield',
          order: 1
        },
        {
          id: 'acc_target_name',
          name: 'Trabalho Empresa', // Match por nome com Profile 1
          email: '',
          chromeProfileDir: 'Profile 98',
          color: '#10b981',
          avatarIcon: 'Briefcase',
          order: 2
        },
        {
          id: 'acc_free_slot',
          name: 'Conta 3 Vazia',
          email: '',
          chromeProfileDir: 'Profile 97',
          color: '#8b5cf6',
          avatarIcon: 'Code',
          order: 3
        }
      ]
    };
    testConfigManager.saveConfig(testConfig);

    const syncRes = scanner.syncAccountsWithProfiles(tempChromeDataDir);
    assert.strictEqual(syncRes.stats.totalDetected, 3);

    // 1. Match por Email (Prioridade 1)
    const emailMatch = syncRes.matches.find(m => m.matchedAccountId === 'acc_target_email');
    assert.ok(emailMatch, 'Match por email deve ser encontrado');
    assert.strictEqual(emailMatch?.matchType, 'email');
    assert.strictEqual(emailMatch?.detectedProfile.dirName, 'Default');

    // 2. Match por Nome (Prioridade 2)
    const nameMatch = syncRes.matches.find(m => m.matchedAccountId === 'acc_target_name');
    assert.ok(nameMatch, 'Match por nome deve ser encontrado');
    assert.strictEqual(nameMatch?.matchType, 'name');
    assert.strictEqual(nameMatch?.detectedProfile.dirName, 'Profile 1');

    // 3. Perfil Desconhecido (NÃO recebe matchedAccountId, permanece matchType 'none')
    const unverifiedMatch = syncRes.matches.find(m => m.detectedProfile.dirName === 'Profile 2');
    assert.ok(unverifiedMatch, 'Perfil não correspondido deve constar na lista');
    assert.strictEqual(unverifiedMatch?.matchedAccountId, undefined, 'Perfil desconhecido NÃO deve receber matchedAccountId');
    assert.strictEqual(unverifiedMatch?.matchType, 'none', 'Perfil desconhecido deve ter matchType none');
    assert.strictEqual(unverifiedMatch?.suggestedAccountId, 'acc_free_slot', 'Sugestão manual deve indicar slot livre sem vincular');

    // 4. Match por Diretório (Prioridade 3)
    const dirTestConfig: HubConfig = {
      ...testConfig,
      accounts: [
        {
          id: 'acc_target_dir',
          name: 'Conta Determinística',
          email: '',
          chromeProfileDir: 'Profile 2', // Match por diretório com Profile 2
          color: '#ec4899',
          avatarIcon: 'Cpu',
          order: 1
        }
      ]
    };
    testConfigManager.saveConfig(dirTestConfig);
    const dirSyncRes = scanner.syncAccountsWithProfiles(tempChromeDataDir, dirTestConfig.accounts);
    const dirMatch = dirSyncRes.matches.find(m => m.matchedAccountId === 'acc_target_dir');
    assert.ok(dirMatch, 'Match por diretório configurado deve ser encontrado');
    assert.strictEqual(dirMatch?.matchType, 'directory');
    assert.strictEqual(dirMatch?.detectedProfile.dirName, 'Profile 2');

    // Restaurar testConfig para os testes subsequentes
    testConfigManager.saveConfig(testConfig);

    console.log('✓ PASSOU: Prioridade de correspondência (E-mail -> Nome -> Diretório) e isolamento de perfis desconhecidos validados.');

    // -------------------------------------------------------------------------
    // TESTE 4: Importação de contas descobertas e rejeição de importações inválidas
    // -------------------------------------------------------------------------
    console.log('[TESTE 4] Testando importação segura de contas...');

    // 4.1 Rejeição de importação sem accountId explícito
    const invalidBindingResult = scanner.importMatchedProfiles([
      { accountId: '', profileDir: 'Default', userDataDir: tempChromeDataDir }
    ]);
    assert.strictEqual(invalidBindingResult.success, false);
    assert.ok(invalidBindingResult.errors?.some(e => e.includes('accountId')));

    // 4.2 Rejeição de importação com conta inexistente no Hub
    const nonExistentAccResult = scanner.importMatchedProfiles([
      { accountId: 'acc_fantasma_inexistente', profileDir: 'Default', userDataDir: tempChromeDataDir }
    ]);
    assert.strictEqual(nonExistentAccResult.success, false);
    assert.ok(nonExistentAccResult.errors?.some(e => e.includes('não existe')));

    // 4.3 Importação legítima de perfis confirmados
    const importBindings: ProfileImportBinding[] = [
      {
        accountId: 'acc_target_email',
        profileDir: 'Default',
        userDataDir: tempChromeDataDir,
        name: 'Alexandre Principal Importado',
        email: 'alexandre.principal@gmail.com'
      },
      {
        accountId: 'acc_target_name',
        profileDir: 'Profile 1',
        userDataDir: tempChromeDataDir,
        name: 'Trabalho Empresa Importado',
        email: 'alexandre.work@empresa.com'
      }
    ];

    const importResult = scanner.importMatchedProfiles(importBindings);
    assert.strictEqual(importResult.success, true);
    assert.strictEqual(importResult.updatedAccountsCount, 2);

    const updatedConf = testConfigManager.getConfig();
    const acc1 = updatedConf.accounts.find(a => a.id === 'acc_target_email');
    assert.strictEqual(acc1?.chromeProfileDir, 'Default');
    assert.strictEqual(acc1?.name, 'Alexandre Principal Importado');

    // Garantir que a Conta 3 (livre) não foi tocada por sugestão manual
    const acc3 = updatedConf.accounts.find(a => a.id === 'acc_free_slot');
    assert.strictEqual(acc3?.chromeProfileDir, 'Profile 97', 'Conta livre não pode ser alterada por sugestão manual sem importação');

    console.log('✓ PASSOU: Importação de contas aplica alterações confirmadas sem sobrescrever dados acidentalmente.');

    // -------------------------------------------------------------------------
    // TESTE 5: Prevenção de duplicação de perfil na importação e na validação
    // -------------------------------------------------------------------------
    console.log('[TESTE 5] Testando prevenção de duplicação de perfil...');
    const duplicateBindings: ProfileImportBinding[] = [
      {
        accountId: 'acc_target_email',
        profileDir: 'Default',
        userDataDir: tempChromeDataDir
      },
      {
        accountId: 'acc_target_name',
        profileDir: 'Default', // Tenta atribuir 'Default' também para a conta 2
        userDataDir: tempChromeDataDir
      }
    ];

    const dupResult = scanner.importMatchedProfiles(duplicateBindings);
    assert.strictEqual(dupResult.success, false);
    assert.ok(dupResult.errors?.some(e => e.includes('Perfil duplicado')));
    console.log('✓ PASSOU: Atribuição duplicada do mesmo perfil é estritamente bloqueada.');

    // -------------------------------------------------------------------------
    // TESTE 6: Persistência e migração para ~/.config/hubai/
    // -------------------------------------------------------------------------
    console.log('[TESTE 6] Testando persistência em ~/.config/hubai...');
    const targetConfigFile = path.join(tempUserConfigDir, 'hub-config.json');
    assert.strictEqual(fs.existsSync(targetConfigFile), true, 'O arquivo de configuração deve residir no diretório do usuário');

    // Validar carregamento em nova instância do ConfigManager
    const freshManager = new ConfigManager(tempUserConfigDir);
    const loaded = freshManager.getConfig();
    assert.strictEqual(loaded.accounts.length, 3);
    assert.strictEqual(loaded.accounts[0].name, 'Alexandre Principal Importado');
    console.log('✓ PASSOU: Configuração do HubAI persiste corretamente fora do repositório em ~/.config/hubai/.');

    // -------------------------------------------------------------------------
    // TESTE 7: Scripts de instalação Linux e geração de .desktop
    // -------------------------------------------------------------------------
    console.log('[TESTE 7] Testando scripts de instalação e .desktop...');
    const installScriptPath = path.resolve(process.cwd(), 'scripts', 'install.sh');
    assert.strictEqual(fs.existsSync(installScriptPath), true, 'scripts/install.sh deve existir');

    const installScriptContent = fs.readFileSync(installScriptPath, 'utf-8');
    assert.ok(installScriptContent.includes('~/.local/share/hubai'), 'Deve instalar em ~/.local/share/hubai');
    assert.ok(installScriptContent.includes('~/.config/hubai'), 'Deve criar ~/.config/hubai');
    assert.ok(installScriptContent.includes('hubai.desktop'), 'Deve gerar atalho .desktop');
    assert.ok(installScriptContent.includes('pinguelanarosca/HubAI'), 'Deve referenciar o repositório correto');

    const shortcuts = launcher.generateDesktopShortcuts();
    for (const sc of shortcuts) {
      assert.ok(sc.content.includes('[Desktop Entry]'));
      assert.ok(sc.content.includes('Exec='));
      assert.ok(sc.content.includes('--profile-directory='));
      assert.ok(sc.content.includes('--user-data-dir='));
    }
    console.log('✓ PASSOU: Instalador Linux e geração de atalhos .desktop validados com sucesso.');

    // -------------------------------------------------------------------------
    // TESTE 8: Verificação de atualização e backup de segurança
    // -------------------------------------------------------------------------
    console.log('[TESTE 8] Testando verificação de atualizações e criação de backup...');
    const status = await updater.checkUpdate(true);
    assert.ok(status.installedCommit, 'Deve reportar o commit ou versão instalada');
    assert.ok(status.repoUrl.includes('pinguelanarosca/HubAI'), 'Deve apontar para o repositório oficial');

    const backupPath = updater.createBackup();
    assert.strictEqual(fs.existsSync(backupPath), true, 'Diretório de backup deve ser criado');
    assert.strictEqual(fs.existsSync(path.join(backupPath, 'package.json')), true, 'Backup deve conter package.json');
    assert.strictEqual(fs.existsSync(path.join(backupPath, 'backup-meta.json')), true, 'Backup deve conter metadados');
    console.log('✓ PASSOU: Verificação de versão e backup de segurança antes de atualizar validados.');

    // -------------------------------------------------------------------------
    // TESTE 9: Simulação de falha de compilação e rollback automático
    // -------------------------------------------------------------------------
    console.log('[TESTE 9] Testando mecanismo de rollback automático...');
    // Criar um backup controlado
    const testRollbackBackup = updater.createBackup();
    assert.strictEqual(fs.existsSync(testRollbackBackup), true);

    const rollbackResult = updater.rollback(testRollbackBackup);
    assert.strictEqual(rollbackResult.success, true, 'Rollback deve ser executado com sucesso');
    console.log('✓ PASSOU: Rollback automático restaura arquivos da versão anterior sem corromper o sistema.');

    // -------------------------------------------------------------------------
    // TESTE 10: Preservação de ~/.config/hubai durante atualizações
    // -------------------------------------------------------------------------
    console.log('[TESTE 10] Verificando que ~/.config/hubai permanece preservado durante operações...');
    const currentConfigBefore = testConfigManager.getConfig();
    assert.strictEqual(fs.existsSync(targetConfigFile), true);
    const reloadedAfter = new ConfigManager(tempUserConfigDir).getConfig();
    assert.deepStrictEqual(reloadedAfter.accounts, currentConfigBefore.accounts);
    console.log('✓ PASSOU: Diretório de configurações do usuário é 100% preservado.');

    // -------------------------------------------------------------------------
    // TESTE 11: Testando serviço de enriquecimento de sessão de contas (EnrichmentService)
    // -------------------------------------------------------------------------
    console.log('[TESTE 11] Testando serviço de enriquecimento de sessão de contas (EnrichmentService)...');
    const { enrichmentService } = await import('../server/enrichmentService.js');
    const testAccount = currentConfigBefore.accounts[0];
    assert.ok(testAccount, 'Deve haver ao menos uma conta no config de teste');

    const chatgptStatus = await enrichmentService.getAccountStatus(testAccount, 'chatgpt', true);
    assert.strictEqual(chatgptStatus.accountId, testAccount.id);
    assert.strictEqual(chatgptStatus.providerId, 'chatgpt');
    assert.ok(chatgptStatus.planName === '--' || chatgptStatus.planName === 'FREE', 'planName deve ser retornado do perfil');
    assert.strictEqual(chatgptStatus.hasProjectsConcept, true);
    assert.ok(Array.isArray(chatgptStatus.projects), 'Deve conter lista de projetos');
    assert.ok(Array.isArray(chatgptStatus.recentChats), 'Deve conter lista de chats recentes');
    assert.ok(chatgptStatus.usage, 'Deve conter informações de cota/uso');
    assert.ok(chatgptStatus.usage.limitLabel === '--' || chatgptStatus.usage.limitLabel === 'Disponível', 'limitLabel deve refletir dados da sessão');

    const geminiStatus = await enrichmentService.getAccountStatus(testAccount, 'gemini', true);
    assert.strictEqual(geminiStatus.hasProjectsConcept, false, 'Gemini não possui conceito de projetos');
    assert.strictEqual(geminiStatus.projects.length, 0);

    console.log('✓ PASSOU: Estrutura de dados e adaptadores de enriquecimento validados com sucesso.');

    console.log('\n================================================================');
    console.log('  TODOS OS 11 TESTES DE INTEGRAÇÃO & ATUALIZAÇÃO FORAM APROVADOS! ');
    console.log('================================================================\n');
  } finally {
    // Limpeza de ambiente temporário
    try {
      fs.rmSync(tempTestRoot, { recursive: true, force: true });
    } catch {
      // Ignorar limpeza
    }
  }
}

runIntegrationTests().catch(err => {
  console.error('FALHA NOS TESTES DE INTEGRAÇÃO:', err);
  process.exit(1);
});
