import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { configManager, ConfigManager } from './configManager.js';
import { profileScanner } from './profileScanner.js';
import { DiagnosticReport, DiagnosticCheckItem } from '../src/types.js';

export class DiagnosticService {
  private configManager: ConfigManager;

  constructor(cfgManager?: ConfigManager) {
    this.configManager = cfgManager || configManager;
  }

  public async runFullDiagnostic(): Promise<DiagnosticReport> {
    const config = this.configManager.getConfig();
    const logs: string[] = [];
    const timestamp = new Date().toISOString();

    logs.push(`[${timestamp}] Iniciando diagnóstico estrito do AI Account Hub...`);

    // 1. Browser Binary Check (se o executável do navegador existe no Linux)
    const browserBinary = config.system.browserCommand || 'google-chrome';
    let browserStatus: 'passed' | 'warning' | 'failed' = 'failed';
    let browserMessage = '';
    let browserDetails = '';

    try {
      const whichResult = execSync(`which ${browserBinary} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (whichResult) {
        browserStatus = 'passed';
        browserMessage = `Executável encontrado em: ${whichResult}`;
        browserDetails = `Comando configurado "${browserBinary}" está disponível no PATH do Linux.`;
        logs.push(`✓ Binário do navegador validado: ${whichResult}`);
      } else {
        throw new Error('Não encontrado no PATH');
      }
    } catch {
      // Check alternative chromium binaries on Linux (excluding non-browsers)
      const alternatives = profileScanner.detectBrowserBinaries();
      if (alternatives.length > 0) {
        browserStatus = 'warning';
        browserMessage = `"${browserBinary}" não está no PATH, mas navegadores alternativos foram encontrados: ${alternatives.join(', ')}`;
        browserDetails = `Altere nas configurações para "${alternatives[0]}" ou instale o pacote google-chrome-stable.`;
        logs.push(`⚠ Binário padrão ausente. Alternativas disponíveis: ${alternatives.join(', ')}`);
      } else {
        browserStatus = 'warning';
        browserMessage = `Nenhum navegador gráfico compatível detectado no PATH do Linux.`;
        browserDetails = `O Hub gerará os comandos de execução exatos para o seu ambiente desktop local.`;
        logs.push(`⚠ Nenhum binário gráfico de navegador encontrado no PATH.`);
      }
    }

    const browserCheck: DiagnosticCheckItem = {
      id: 'browser_binary',
      name: 'Executável do Navegador Chrome / Chromium',
      status: browserStatus,
      message: browserMessage,
      details: browserDetails
    };

    // 2. User Data Directory Check (se o diretório de dados configurado existe REALMENTE no sistema)
    const rawUserDataDir = config.system.chromeUserDataDir;
    const resolvedUserDataDir = profileScanner.resolvePath(rawUserDataDir);

    let userDataStatus: 'passed' | 'warning' | 'failed' = 'failed';
    let userDataMessage = '';
    let userDataDetails = '';
    let singletonLockDetected = false;

    if (!fs.existsSync(resolvedUserDataDir)) {
      userDataStatus = 'failed';
      userDataMessage = `Diretório base do Chrome não existe: ${resolvedUserDataDir}`;
      userDataDetails = `O caminho de perfis configurado não foi encontrado no sistema. Nenhuma pasta foi criada automaticamente. Verifique se o Google Chrome já foi iniciado pelo menos uma vez no computador.`;
      logs.push(`✗ Diretório base de perfis não encontrado: ${resolvedUserDataDir}`);
    } else {
      try {
        const stat = fs.statSync(resolvedUserDataDir);
        if (!stat.isDirectory()) {
          userDataStatus = 'failed';
          userDataMessage = `O caminho "${resolvedUserDataDir}" existe mas não é um diretório.`;
          logs.push(`✗ O caminho "${resolvedUserDataDir}" não é um diretório.`);
        } else {
          fs.accessSync(resolvedUserDataDir, fs.constants.R_OK);

          // Check SingletonLock
          const lockPath = path.join(resolvedUserDataDir, 'SingletonLock');
          if (fs.existsSync(lockPath)) {
            singletonLockDetected = true;
            userDataStatus = 'passed';
            userDataMessage = `Diretório base do Chrome validado: ${resolvedUserDataDir} (SingletonLock detectado)`;
            userDataDetails = `Diretório base existente e legível. Arquivo SingletonLock presente (Chrome aparentemente em execução ou lock remanescente). Nota: a existência do lock não garante o direcionamento de janelas nem substitui a verificação individual de cada perfil.`;
            logs.push(`✓ Diretório base verificado. SingletonLock detectado no sistema.`);
          } else {
            userDataStatus = 'passed';
            userDataMessage = `Diretório base do Chrome validado: ${resolvedUserDataDir}`;
            userDataDetails = `Diretório base existente e legível. Nenhum arquivo SingletonLock detectado (Chrome aparentemente fechado).`;
            logs.push(`✓ Diretório base verificado. Sem locks de processo ativos.`);
          }
        }
      } catch (err: any) {
        userDataStatus = 'failed';
        userDataMessage = `Erro de permissão no diretório: ${err.message}`;
        logs.push(`✗ Erro ao acessar ${resolvedUserDataDir}: ${err.message}`);
      }
    }

    const userDataDirCheck: DiagnosticCheckItem = {
      id: 'user_data_dir',
      name: 'Diretório Base de Perfis (User Data Directory)',
      status: userDataStatus,
      message: userDataMessage,
      details: userDataDetails
    };

    // 3. Scan real profiles on disk for cross-comparison
    const scan = profileScanner.scanProfiles(config.system.chromeUserDataDir);
    const discoveredProfileDirs = new Set(scan.profiles.map(p => p.dirName));

    // 4. Accounts & Profile Existence Check (NUNCA CRIA ARQUIVOS OU PASTAS)
    const accountsProfileCheck: DiagnosticReport['accountsProfileCheck'] = [];
    const lockedProfiles: string[] = [];
    let linkedAccountsCount = 0;
    let unlinkedAccountsCount = 0;

    for (const account of config.accounts) {
      let accStatus: 'passed' | 'warning' | 'failed' = 'failed';
      let accMsg = '';
      const accountUserDataDir = account.userDataDir
        ? profileScanner.resolvePath(account.userDataDir)
        : resolvedUserDataDir;

      const profilePath = path.join(accountUserDataDir, account.chromeProfileDir);

      if (!fs.existsSync(accountUserDataDir)) {
        accStatus = 'failed';
        accMsg = `Diretório base do Chrome inacessível (${accountUserDataDir}).`;
        unlinkedAccountsCount++;
        logs.push(`✗ [${account.name}] Falha: diretório base ausente.`);
      } else if (!fs.existsSync(profilePath)) {
        accStatus = 'failed';
        accMsg = `Perfil "${account.chromeProfileDir}" NÃO existe no disco em ${profilePath}. O perfil deve ser criado diretamente no Chrome.`;
        unlinkedAccountsCount++;
        logs.push(`✗ [${account.name}] Perfil "${account.chromeProfileDir}" inexistente.`);
      } else {
        try {
          const stat = fs.statSync(profilePath);
          if (!stat.isDirectory()) {
            accStatus = 'failed';
            accMsg = `O caminho "${profilePath}" existe mas não é uma pasta de perfil válida.`;
            unlinkedAccountsCount++;
            logs.push(`✗ [${account.name}] Perfil "${account.chromeProfileDir}" não é um diretório.`);
          } else {
            fs.accessSync(profilePath, fs.constants.R_OK);

            const hasPrefs = fs.existsSync(path.join(profilePath, 'Preferences'));
            const lockInProfile = fs.existsSync(path.join(profilePath, 'LOCK'));

            if (lockInProfile || (accountUserDataDir === resolvedUserDataDir && singletonLockDetected)) {
              lockedProfiles.push(`${account.name} (${account.chromeProfileDir})`);
            }

            if (hasPrefs) {
              accStatus = 'passed';
              accMsg = `Perfil real localizado e legível (${account.chromeProfileDir}) com arquivo Preferences verificado${lockInProfile ? ' [LOCK local ativo]' : ''}`;
              linkedAccountsCount++;
              logs.push(`✓ [${account.name}] Perfil real verificado em ${profilePath}.`);
            } else {
              accStatus = 'warning';
              accMsg = `Pasta do perfil existe, mas arquivo Preferences do Chrome ainda não foi gerado. Inicie este perfil no Chrome para concluir o registro.`;
              linkedAccountsCount++;
              logs.push(`⚠ [${account.name}] Pasta "${account.chromeProfileDir}" encontrada sem arquivo Preferences.`);
            }
          }
        } catch (permErr: any) {
          accStatus = 'failed';
          accMsg = `Sem permissão de acesso ao perfil: ${permErr.message}`;
          unlinkedAccountsCount++;
          logs.push(`✗ [${account.name}] Permissão negada no perfil "${account.chromeProfileDir}".`);
        }
      }

      accountsProfileCheck.push({
        accountId: account.id,
        accountName: account.name,
        profileDir: account.chromeProfileDir,
        userDataDir: account.userDataDir,
        status: accStatus,
        message: accMsg,
        path: profilePath
      });
    }

    // 5. URL Check (se a URL configurada pode ser aberta e é válida)
    const urlCheck: DiagnosticReport['urlCheck'] = [];
    for (const provider of config.providers) {
      if (!provider.enabled) continue;
      let urlStatus: 'passed' | 'warning' | 'failed' = 'passed';
      let urlMsg = 'Sintaxe HTTPS válida';

      try {
        const parsed = new URL(provider.defaultUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          urlStatus = 'warning';
          urlMsg = `Protocolo não suportado: ${parsed.protocol}`;
        } else {
          urlStatus = 'passed';
          urlMsg = `URL válida: ${parsed.hostname}`;
        }
      } catch {
        urlStatus = 'failed';
        urlMsg = 'Formato de URL inválido';
      }

      urlCheck.push({
        providerId: provider.id,
        providerName: provider.name,
        url: provider.defaultUrl,
        status: urlStatus,
        message: urlMsg
      });
    }

    // 6. Isolation Check (se a associação Conta → Perfil Chrome é única, sem colisões ou sobreposições)
    const profileCounts: Record<string, string[]> = {};
    for (const acc of config.accounts) {
      const uDir = acc.userDataDir ? profileScanner.resolvePath(acc.userDataDir) : resolvedUserDataDir;
      const key = `${uDir}::${acc.chromeProfileDir.trim()}`;
      if (!profileCounts[key]) {
        profileCounts[key] = [];
      }
      profileCounts[key].push(acc.name);
    }

    const duplicates = Object.entries(profileCounts).filter(([_, accList]) => accList.length > 1);
    const duplicateProfileDescriptions = duplicates.map(([key, list]) => {
      const parts = key.split('::');
      return `"${parts[1]}" (${parts[0]}) compartilhado por: ${list.join(' & ')}`;
    });

    let isolationStatus: 'passed' | 'warning' | 'failed' = 'passed';
    let isolationMessage = 'Isolamento estrito garantido: cada conta possui perfil exclusivo.';
    let isolationDetails = 'Nenhum risco de contaminação cruzada de cookies ou sessão entre contas.';

    if (duplicates.length > 0) {
      isolationStatus = 'warning';
      isolationMessage = `Atenção: Perfis compartilhados detectados: ${duplicateProfileDescriptions.join('; ')}`;
      isolationDetails = 'Para garantir isolamento absoluto entre contas Google, cada conta deve apontar para um perfil exclusivo.';
      logs.push(`⚠ Alerta de isolamento: ${isolationMessage}`);
    } else {
      logs.push(`✓ Isolamento verificado: cada conta associada a um diretório exclusivo.`);
    }

    const isolationCheck: DiagnosticCheckItem = {
      id: 'isolation_integrity',
      name: 'Integridade de Isolamento Conta → Perfil Chrome',
      status: isolationStatus,
      message: isolationMessage,
      details: isolationDetails
    };

    // Calculate unlinked profiles on disk (profiles in targetDir not associated with any account)
    const assignedProfileDirsInMainDir = new Set(
      config.accounts
        .filter(a => !a.userDataDir || profileScanner.resolvePath(a.userDataDir) === resolvedUserDataDir)
        .map(a => a.chromeProfileDir)
    );
    const unlinkedProfiles = scan.profiles.filter(p => !assignedProfileDirsInMainDir.has(p.dirName));

    // Summary calculation
    const summary: DiagnosticReport['summary'] = {
      discoveredProfilesCount: scan.profiles.length,
      linkedAccountsCount,
      unlinkedProfilesCount: unlinkedProfiles.length,
      unlinkedAccountsCount,
      duplicateProfiles: duplicateProfileDescriptions,
      lockedProfiles,
      userDataDirUsed: resolvedUserDataDir
    };

    // Overall Status
    const allStatuses = [
      browserStatus,
      userDataStatus,
      isolationStatus,
      ...accountsProfileCheck.map(a => a.status),
      ...urlCheck.map(u => u.status)
    ];

    let overallStatus: 'passed' | 'warning' | 'failed' = 'passed';
    if (allStatuses.includes('failed')) {
      overallStatus = 'failed';
    } else if (allStatuses.includes('warning')) {
      overallStatus = 'warning';
    }

    logs.push(`[${new Date().toISOString()}] Diagnóstico finalizado com status: ${overallStatus.toUpperCase()}`);

    return {
      timestamp,
      overallStatus,
      browserCheck,
      userDataDirCheck,
      accountsProfileCheck,
      urlCheck,
      isolationCheck,
      summary,
      logs
    };
  }
}

export const diagnosticService = new DiagnosticService();
