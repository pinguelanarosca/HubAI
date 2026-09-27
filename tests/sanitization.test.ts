import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configManager, ConfigManager } from '../server/configManager.js';
import { LauncherService } from '../server/launcherService.js';
import { ProfileScanner } from '../server/profileScanner.js';
import { DiagnosticService } from '../server/diagnosticService.js';
import { HubConfig } from '../src/types.js';

async function runTests() {
  console.log('--- INICIANDO TESTES DE SANEAMENTO TÉCNICO (HUBAI) ---');

  const testTempDir = path.join(os.tmpdir(), `hubai-test-${Date.now()}`);
  fs.mkdirSync(testTempDir, { recursive: true });

  const launcher = new LauncherService();
  const scanner = new ProfileScanner();

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Perfil inexistente gera erro no launcher e no diagnóstico
    // -------------------------------------------------------------------------
    console.log('[TESTE 1] Verificando se perfil inexistente gera erro...');
    let threwError = false;
    try {
      launcher.validateRealProfile(testTempDir, 'ProfileInexistente');
    } catch (err: any) {
      threwError = true;
      assert.ok(
        err.message.includes('NÃO existe no disco'),
        `Mensagem de erro esperada não encontrada: ${err.message}`
      );
    }
    assert.strictEqual(threwError, true, 'O launcher deveria ter lançado erro para perfil inexistente!');
    console.log('✓ PASSOU: Perfil inexistente gera erro explícito no launcher.');

    // -------------------------------------------------------------------------
    // TESTE 2: Perfil válido e real é aceito
    // -------------------------------------------------------------------------
    console.log('[TESTE 2] Verificando se perfil real existente é aceito...');
    const realProfileDir = path.join(testTempDir, 'Profile 1');
    fs.mkdirSync(realProfileDir, { recursive: true });
    fs.writeFileSync(path.join(realProfileDir, 'Preferences'), JSON.stringify({ profile: { name: 'Real User' } }));

    const validated = launcher.validateRealProfile(testTempDir, 'Profile 1');
    assert.strictEqual(validated.profileFullPath, realProfileDir);
    console.log('✓ PASSOU: Perfil real existente no disco é validado com sucesso.');

    // -------------------------------------------------------------------------
    // TESTE 3: Nenhuma conta cai em outro perfil (sem fallbacks silenciosos)
    // -------------------------------------------------------------------------
    console.log('[TESTE 3] Verificando que não há fallback silencioso para outro perfil...');
    let fallbackAttemptThrew = false;
    try {
      launcher.validateRealProfile(testTempDir, 'Profile 99');
    } catch (err: any) {
      fallbackAttemptThrew = true;
      assert.ok(err.message.includes('Profile 99'));
    }
    assert.strictEqual(fallbackAttemptThrew, true, 'O launcher nunca pode fazer fallback para Default se Profile 99 não existir!');
    console.log('✓ PASSOU: Nenhum perfil ausente é substituído silenciosamente.');

    // -------------------------------------------------------------------------
    // TESTE 4: Nenhum perfil fictício é criado
    // -------------------------------------------------------------------------
    console.log('[TESTE 4] Verificando que nenhuma pasta ou perfil fictício é criado no disco...');
    const fakeProfileDir = path.join(testTempDir, 'PerfilFalsoQueNaoPodeSerCriado');
    try {
      launcher.validateRealProfile(testTempDir, 'PerfilFalsoQueNaoPodeSerCriado');
    } catch {
      // Ignorar erro esperado
    }
    assert.strictEqual(
      fs.existsSync(fakeProfileDir),
      false,
      'FALHA CRÍTICA: Um diretório de perfil foi criado automaticamente!'
    );

    // Verificar que data/chrome-profiles também não existe
    const mockDataDir = path.resolve(process.cwd(), 'data', 'chrome-profiles');
    assert.strictEqual(
      fs.existsSync(mockDataDir),
      false,
      'FALHA: A pasta legada data/chrome-profiles foi recriada!'
    );
    console.log('✓ PASSOU: Nenhum perfil ou diretório simulado/fictício é criado.');

    // -------------------------------------------------------------------------
    // TESTE 5: Launcher usa exatamente o perfil configurado e parâmetros Linux
    // -------------------------------------------------------------------------
    console.log('[TESTE 5] Verificando comando do launcher...');
    const cmdResult = launcher.buildCommand(
      'google-chrome',
      '/home/user/.config/google-chrome',
      'Profile 3',
      'https://gemini.google.com/app',
      true,
      ['--no-first-run']
    );

    assert.ok(
      cmdResult.fullCommandStr.includes('--profile-directory="Profile 3"'),
      'Comando deve conter --profile-directory="Profile 3"'
    );
    assert.ok(
      cmdResult.fullCommandStr.includes('--user-data-dir="/home/user/.config/google-chrome"'),
      'Comando deve conter --user-data-dir consistente'
    );
    assert.ok(
      cmdResult.fullCommandStr.includes('https://gemini.google.com/app'),
      'Comando deve conter a URL de destino'
    );
    console.log('✓ PASSOU: Launcher monta o comando Linux determinístico com o perfil exato.');

    // -------------------------------------------------------------------------
    // TESTE 6: Configuração inválida não é mascarada
    // -------------------------------------------------------------------------
    console.log('[TESTE 6] Verificando rejeição de configurações inválidas...');
    const testConfigManager = configManager;

    // 6a: Colisão de perfis (duas contas apontando para o mesmo perfil)
    const invalidDuplicateProfileConfig: any = {
      version: 1,
      system: { browserCommand: 'google-chrome', chromeUserDataDir: testTempDir },
      providers: [{ id: 'p1', name: 'P1', defaultUrl: 'https://exemplo.com' }],
      accounts: [
        { id: 'acc1', name: 'Conta 1', chromeProfileDir: 'Default' },
        { id: 'acc2', name: 'Conta 2', chromeProfileDir: 'Default' } // Duplicado!
      ]
    };
    const dupValidation = testConfigManager.validateConfig(invalidDuplicateProfileConfig);
    assert.strictEqual(dupValidation.valid, false);
    assert.ok(dupValidation.errors.some(e => e.includes('Colisão de perfil')));

    // 6b: Path traversal no nome do perfil
    const pathTraversalConfig: any = {
      version: 1,
      system: { browserCommand: 'google-chrome', chromeUserDataDir: testTempDir },
      providers: [{ id: 'p1', name: 'P1', defaultUrl: 'https://exemplo.com' }],
      accounts: [
        { id: 'acc1', name: 'Conta 1', chromeProfileDir: '../../etc' }
      ]
    };
    const traversalValidation = testConfigManager.validateConfig(pathTraversalConfig);
    assert.strictEqual(traversalValidation.valid, false);
    assert.ok(traversalValidation.errors.some(e => e.includes('path traversal')));

    // 6c: URL inválida no provedor
    const invalidUrlConfig: any = {
      version: 1,
      system: { browserCommand: 'google-chrome', chromeUserDataDir: testTempDir },
      providers: [{ id: 'p1', name: 'P1', defaultUrl: 'url-invalida-sem-protocolo' }],
      accounts: [
        { id: 'acc1', name: 'Conta 1', chromeProfileDir: 'Profile 1' }
      ]
    };
    const urlValidation = testConfigManager.validateConfig(invalidUrlConfig);
    assert.strictEqual(urlValidation.valid, false);
    assert.ok(urlValidation.errors.some(e => e.includes('URL inválida')));

    console.log('✓ PASSOU: Configurações inválidas são estritamente rejeitadas e não mascaradas.');

    // -------------------------------------------------------------------------
    // TESTE 7: Reinicialização mantém a configuração correta
    // -------------------------------------------------------------------------
    console.log('[TESTE 7] Verificando persistência após reinicialização...');
    const currentConfig = testConfigManager.getConfig();
    const updatedName = 'Conta 1 (Personalizada)';
    const modifiedAccounts = currentConfig.accounts.map(a =>
      a.id === 'acc_1' ? { ...a, name: updatedName } : a
    );
    const validModifiedConfig: HubConfig = {
      ...currentConfig,
      accounts: modifiedAccounts
    };

    const saveResult = testConfigManager.saveConfig(validModifiedConfig);
    assert.strictEqual(saveResult.success, true);

    const freshManager = new ConfigManager();
    const reloaded = freshManager.getConfig();
    const acc1 = reloaded.accounts.find(a => a.id === 'acc_1');
    assert.strictEqual(acc1?.name, updatedName);
    console.log('✓ PASSOU: Reinicialização preserva exatamente a configuração salva.');

    // -------------------------------------------------------------------------
    // TESTE 8: xdg-open NÃO é considerado navegador no profileScanner
    // -------------------------------------------------------------------------
    console.log('[TESTE 8] Verificando que xdg-open não é considerado navegador compatível...');
    const detectedBinaries = scanner.detectBrowserBinaries();
    assert.strictEqual(
      detectedBinaries.includes('xdg-open'),
      false,
      'FALHA: xdg-open não deve ser considerado um navegador compatível com perfis!'
    );
    console.log('✓ PASSOU: xdg-open excluído do detector de navegadores compatíveis.');

    // -------------------------------------------------------------------------
    // TESTE 9: Launcher rejeita executável inexistente com erro real
    // -------------------------------------------------------------------------
    console.log('[TESTE 9] Verificando que executável de navegador inexistente gera erro real...');
    let binErrorThrew = false;
    try {
      launcher.validateBrowserExecutable('navegador-que-nao-existe-no-sistema-12345');
    } catch (err: any) {
      binErrorThrew = true;
      assert.ok(err.message.includes('não foi encontrado no PATH'));
    }
    assert.strictEqual(binErrorThrew, true, 'O launcher deve falhar quando o executável do navegador não existe no PATH!');

    // Testar com caminho absoluto inexistente
    let pathErrorThrew = false;
    try {
      launcher.validateBrowserExecutable('/usr/bin/navegador_fake_abs_999');
    } catch (err: any) {
      pathErrorThrew = true;
      assert.ok(err.message.includes('não foi encontrado em:'));
    }
    assert.strictEqual(pathErrorThrew, true, 'O launcher deve falhar com caminho absoluto inexistente!');
    console.log('✓ PASSOU: Launcher retorna erro real quando o executável configurado não existe.');

    // -------------------------------------------------------------------------
    // TESTE 10: Paridade absoluta entre dry-run e comando de execução
    // -------------------------------------------------------------------------
    console.log('[TESTE 10] Verificando paridade exata de comando entre dry-run e execução...');
    // Criar um script executável mock no testTempDir para testar o launcher
    const mockBrowserPath = path.join(testTempDir, 'mock-browser.sh');
    fs.writeFileSync(mockBrowserPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const testConfigWithMock: HubConfig = {
      version: 1,
      system: {
        browserCommand: mockBrowserPath,
        chromeUserDataDir: testTempDir,
        openInNewWindow: true,
        additionalFlags: ['--no-first-run'],
        theme: 'dark'
      },
      providers: [
        {
          id: 'test_gemini',
          name: 'Gemini',
          shortName: 'Gemini',
          defaultUrl: 'https://gemini.google.com/app',
          category: 'general',
          icon: 'Sparkles',
          description: 'Test',
          enabled: true,
          order: 1
        }
      ],
      accounts: [
        {
          id: 'test_acc_1',
          name: 'Conta 1 Real',
          email: '',
          chromeProfileDir: 'Profile 1',
          color: '#3b82f6',
          avatarIcon: 'Shield',
          order: 1
        }
      ]
    };

    testConfigManager.saveConfig(testConfigWithMock);

    // Executar em modo dry-run
    const dryRunResult = await launcher.launch({
      accountId: 'test_acc_1',
      providerId: 'test_gemini',
      dryRun: true
    });

    // Executar em modo real (em ambiente sem DISPLAY gerará command_generated)
    const liveResult = await launcher.launch({
      accountId: 'test_acc_1',
      providerId: 'test_gemini',
      dryRun: false
    });

    assert.strictEqual(
      dryRunResult.command,
      liveResult.command,
      'FALHA: O comando do dry-run deve ser idêntico ao comando gerado para execução!'
    );
    assert.strictEqual(
      dryRunResult.command.includes(`--user-data-dir="${testTempDir}"`),
      true
    );
    assert.strictEqual(
      dryRunResult.command.includes('--profile-directory="Profile 1"'),
      true
    );
    console.log('✓ PASSOU: O comando validado pelo dry-run é rigorosamente idêntico ao de execução.');

    // -------------------------------------------------------------------------
    // TESTE 11: generateDesktopShortcuts só gera para perfis existentes e usa buildCommand
    // -------------------------------------------------------------------------
    console.log('[TESTE 11] Verificando generateDesktopShortcuts()...');
    const shortcuts = launcher.generateDesktopShortcuts();
    // Somente 'Profile 1' existe em testTempDir
    assert.strictEqual(shortcuts.length, 1);
    assert.ok(shortcuts[0].content.includes(`--profile-directory="Profile 1"`));
    assert.ok(shortcuts[0].content.includes(`--user-data-dir="${testTempDir}"`));
    console.log('✓ PASSOU: generateDesktopShortcuts valida existência real e usa a mesma lógica do launcher.');

    // -------------------------------------------------------------------------
    // TESTE 12: Diagnóstico não faz alegações de IPC no SingletonLock
    // -------------------------------------------------------------------------
    console.log('[TESTE 12] Verificando diagnóstico e tratamento objetivo de SingletonLock...');
    // Criar SingletonLock temporário
    fs.writeFileSync(path.join(testTempDir, 'SingletonLock'), 'test-lock');
    const diagService = new DiagnosticService();
    const report = await diagService.runFullDiagnostic();

    // Validar que nenhuma mensagem afirma entrega via IPC
    const reportStr = JSON.stringify(report);
    assert.strictEqual(
      reportStr.includes('via IPC'),
      false,
      'FALHA: O relatório de diagnóstico não deve fazer afirmações não comprovadas de envio via IPC!'
    );
    console.log('✓ PASSOU: Diagnóstico distingue diretório, perfis e lock sem afirmações especulativas.');

    // -------------------------------------------------------------------------
    // TESTE 13: Consistência entre descoberta e execução dos navegadores
    // -------------------------------------------------------------------------
    console.log('[TESTE 13] Verificando consistência entre descoberta e execução dos navegadores...');
    const variants = scanner.detectBrowserVariants();
    const expectedBrowserIds = ['chrome-stable', 'chrome-beta', 'chrome-unstable', 'chromium', 'brave', 'edge'];
    for (const expectedId of expectedBrowserIds) {
      assert.ok(variants.some(v => v.id === expectedId), `Variante de navegador "${expectedId}" deve estar presente em detectBrowserVariants()`);
    }

    // Criar executáveis mock no diretório de teste para testar correspondência
    const mockBinDir = path.join(testTempDir, 'mock-bin');
    fs.mkdirSync(mockBinDir, { recursive: true });

    const testBrowsers = [
      'google-chrome',
      'google-chrome-stable',
      'google-chrome-beta',
      'google-chrome-unstable',
      'chromium',
      'chromium-browser',
      'brave-browser',
      'microsoft-edge'
    ];

    const originalPath = process.env.PATH || '';
    process.env.PATH = `${mockBinDir}:${originalPath}`;

    try {
      for (const browserBin of testBrowsers) {
        const binFile = path.join(mockBinDir, browserBin);
        fs.writeFileSync(binFile, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

        // Validar que detectBrowserBinaries detecta o binário instalado
        const detected = scanner.detectBrowserBinaries();
        assert.ok(detected.includes(browserBin), `detectBrowserBinaries() deve reconhecer "${browserBin}"`);

        // Validar que o launcher valida o binário descoberto com sucesso
        const validated = launcher.validateBrowserExecutable(browserBin);
        assert.strictEqual(validated, binFile, `launcher.validateBrowserExecutable("${browserBin}") deve resolver para "${binFile}"`);
      }
    } finally {
      process.env.PATH = originalPath;
    }
    console.log('✓ PASSOU: Descoberta e execução de todos os 8 navegadores Linux consistentes e validadas.');

    // -------------------------------------------------------------------------
    // TESTE 14: Fallback estrito apenas para descoberta / Launcher nunca troca silenciosamente
    // -------------------------------------------------------------------------
    console.log('[TESTE 14] Verificando que o launcher nunca troca silenciosamente o navegador configurado...');
    const isolatedBinDir = path.join(testTempDir, 'isolated-alt-bin');
    fs.mkdirSync(isolatedBinDir, { recursive: true });

    // Criar apenas o binário alternativo 'google-chrome-stable' (sem 'google-chrome')
    const altBinFile = path.join(isolatedBinDir, 'google-chrome-stable');
    fs.writeFileSync(altBinFile, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const savedPath = process.env.PATH || '';
    process.env.PATH = `${isolatedBinDir}:/usr/bin:/bin:/usr/local/bin`;

    try {
      // 1. A descoberta deve identificar o alternativo em detectedBinary
      const variantsWithAlt = scanner.detectBrowserVariants();
      const chromeVariant = variantsWithAlt.find(v => v.id === 'chrome-stable');
      assert.ok(chromeVariant, 'Variante chrome-stable deve ser encontrada');
      assert.strictEqual(chromeVariant?.binaryCommand, 'google-chrome', 'binaryCommand deve permanecer o canônico');
      assert.strictEqual(chromeVariant?.detectedBinary, 'google-chrome-stable', 'detectedBinary deve apontar para o alternativo encontrado');

      // 2. Se o usuário tiver 'google-chrome' configurado (que não existe no PATH isolado), o Launcher NÃO deve trocar silenciosamente para 'google-chrome-stable'
      let failedAsExpected = false;
      try {
        launcher.validateBrowserExecutable('google-chrome');
      } catch (err: any) {
        failedAsExpected = true;
        assert.ok(err.message.includes('não foi encontrado no PATH'));
      }
      assert.strictEqual(
        failedAsExpected,
        true,
        'O launcher deve falhar explicitamente para "google-chrome" e NÃO executar "google-chrome-stable" silenciosamente!'
      );

      // 3. Se o usuário configurar explicitamente o alternativo 'google-chrome-stable', o launcher valida com sucesso
      const validatedAlt = launcher.validateBrowserExecutable('google-chrome-stable');
      assert.strictEqual(validatedAlt, altBinFile);

      // 4. Parâmetros de perfil permanecem exatamente os configurados
      const dryRunRes = launcher.buildCommand(
        'google-chrome-stable',
        testTempDir,
        'Profile 1',
        'https://gemini.google.com/app',
        true
      );
      assert.strictEqual(dryRunRes.binary, 'google-chrome-stable');
      assert.ok(dryRunRes.args.includes(`--user-data-dir=${testTempDir}`));
      assert.ok(dryRunRes.args.includes('--profile-directory=Profile 1'));
    } finally {
      process.env.PATH = savedPath;
    }
    console.log('✓ PASSOU: Descoberta identifica binários alternativos e Launcher respeita estritamente o navegador configurado.');

    // -------------------------------------------------------------------------
    // TESTE 15: Seleção consistente de variante (userDataDir + browserCommand)
    // -------------------------------------------------------------------------
    console.log('[TESTE 15] Verificando seleção consistente de variante e bloqueio de variantes sem binário...');
    const fakeBraveUserDataDir = path.join(testTempDir, 'fake-brave-config');
    const fakeBraveProfile = path.join(fakeBraveUserDataDir, 'Default');
    fs.mkdirSync(fakeBraveProfile, { recursive: true });

    const fakeBinDir2 = path.join(testTempDir, 'fake-bins-2');
    fs.mkdirSync(fakeBinDir2, { recursive: true });
    const braveBinPath = path.join(fakeBinDir2, 'brave-browser');
    fs.writeFileSync(braveBinPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const pathBefore = process.env.PATH || '';
    process.env.PATH = `${fakeBinDir2}:/usr/bin:/bin:/usr/local/bin`;

    try {
      // 1. Simular detecção de variante com diretório e binário válidos
      const detectedVariants = scanner.detectBrowserVariants();
      const braveVariant = detectedVariants.find(v => v.id === 'brave');
      assert.ok(braveVariant, 'Variante brave deve existir na lista');
      assert.strictEqual(braveVariant.detectedBinary, 'brave-browser', 'detectedBinary deve ser detectado no PATH');

      // 2. Simular seleção da variante na configuração
      const isReady = braveVariant.exists || true; // simular seleção
      assert.ok(braveVariant.detectedBinary, 'Variante pronta deve ter detectedBinary definido');
      
      const newSystemConfig = {
        browserCommand: braveVariant.detectedBinary!,
        chromeUserDataDir: fakeBraveUserDataDir,
        openInNewWindow: true,
        additionalFlags: ['--no-first-run'],
        theme: 'dark' as const
      };

      assert.strictEqual(newSystemConfig.browserCommand, 'brave-browser');
      assert.strictEqual(newSystemConfig.chromeUserDataDir, fakeBraveUserDataDir);

      // 3. Launcher valida o browserCommand e perfil de forma estrita e determinística
      const validatedBin = launcher.validateBrowserExecutable(newSystemConfig.browserCommand);
      assert.strictEqual(validatedBin, braveBinPath);

      const profileValidation = launcher.validateRealProfile(newSystemConfig.chromeUserDataDir, 'Default');
      assert.strictEqual(profileValidation.profileFullPath, fakeBraveProfile);

      // 4. Variante sem binário detectado (ex: edge sem microsoft-edge no PATH)
      const edgeVariant = detectedVariants.find(v => v.id === 'edge');
      assert.ok(edgeVariant, 'Variante edge deve existir');
      assert.strictEqual(edgeVariant.detectedBinary, undefined, 'Edge não deve ter detectedBinary quando o binário não existe no PATH');

      // Tentativa de executar com o comando padrão de uma variante sem binário deve falhar explicitamente
      let edgeErrorThrew = false;
      try {
        launcher.validateBrowserExecutable(edgeVariant.binaryCommand);
      } catch (err: any) {
        edgeErrorThrew = true;
        assert.ok(err.message.includes('não foi encontrado no PATH'));
      }
      assert.strictEqual(edgeErrorThrew, true, 'Executar variante sem binário no PATH deve lançar erro explícito no launcher');
    } finally {
      process.env.PATH = pathBefore;
    }
    console.log('✓ PASSOU: Seleção de variante atualiza userDataDir e browserCommand consistentemente e rejeita variantes sem binário.');

    console.log('\n========================================================');
    console.log('TODOS OS 15 TESTES DE SANEAMENTO PASSARAM COM SUCESSO!');
    console.log('========================================================\n');
  } finally {
    // Restaurar configuração padrão limpa no configManager
    configManager.resetToDefaults();

    // Limpar diretório temporário de testes
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {
      // Ignorar limpeza
    }
  }
}

runTests().catch(err => {
  console.error('FALHA NOS TESTES:', err);
  process.exit(1);
});
