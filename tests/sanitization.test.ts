import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../server/configManager.js';
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
    const testConfigManager = new ConfigManager();

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

    // Simular reinicialização instanciando novo ConfigManager
    const freshManager = new ConfigManager();
    const reloaded = freshManager.getConfig();
    const acc1 = reloaded.accounts.find(a => a.id === 'acc_1');
    assert.strictEqual(acc1?.name, updatedName);
    console.log('✓ PASSOU: Reinicialização preserva exatamente a configuração salva.');

    console.log('\n======================================================');
    console.log('TODOS OS 7 TESTES DE SANEAMENTO PASSARAM COM SUCESSO!');
    console.log('======================================================\n');
  } finally {
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
