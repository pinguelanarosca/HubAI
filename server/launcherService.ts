import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configManager, ConfigManager } from './configManager.js';
import { profileScanner } from './profileScanner.js';
import { LaunchRequest, LaunchResult } from '../src/types.js';

export class LauncherService {
  private configManager: ConfigManager;

  constructor(cfgManager?: ConfigManager) {
    this.configManager = cfgManager || configManager;
  }

  /**
   * Validates that the configured browser executable actually exists and can be executed on Linux.
   * Throws an explicit error if the binary is missing or not executable.
   * NEVER silently falls back to another executable.
   */
  public validateBrowserExecutable(browserCommand: string): string {
    const cleanCmd = browserCommand.trim();
    if (!cleanCmd) {
      throw new Error('Comando do navegador não configurado ou vazio.');
    }

    // Direct path (e.g. /usr/bin/google-chrome or ./bin/chrome)
    if (cleanCmd.includes('/')) {
      const resolved = path.resolve(cleanCmd);
      if (!fs.existsSync(resolved)) {
        throw new Error(`O executável configurado do navegador não foi encontrado em: "${resolved}".`);
      }
      try {
        fs.accessSync(resolved, fs.constants.X_OK);
      } catch {
        throw new Error(`O arquivo "${resolved}" existe mas não possui permissão de execução.`);
      }
      return resolved;
    }

    // PATH lookup
    try {
      const whichOut = execSync(`which ${cleanCmd} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (!whichOut) {
        throw new Error(`Executável do navegador "${cleanCmd}" não foi encontrado no PATH do sistema.`);
      }
      return whichOut;
    } catch {
      throw new Error(
        `O executável do navegador configurado ("${cleanCmd}") não foi encontrado no PATH do sistema. ` +
        `Instale o Google Chrome ou configure um executável compatível nas configurações do Hub.`
      );
    }
  }

  /**
   * Validates the existence and accessibility of the real Chrome profile on disk.
   * Throws an explicit error if the profile does not exist.
   * NEVER substitutes a missing profile with another profile.
   */
  public validateRealProfile(userDataDir: string, profileDir: string): {
    resolvedUserDataDir: string;
    profileFullPath: string;
    singletonLockActive: boolean;
  } {
    const resolvedUserDataDir = profileScanner.resolvePath(userDataDir);

    if (!fs.existsSync(resolvedUserDataDir)) {
      throw new Error(
        `Diretório base do Chrome não encontrado em "${resolvedUserDataDir}". ` +
        `Verifique se o Google Chrome está instalado e configurado no caminho correto.`
      );
    }

    const statUserDir = fs.statSync(resolvedUserDataDir);
    if (!statUserDir.isDirectory()) {
      throw new Error(`O caminho base configurado "${resolvedUserDataDir}" não é um diretório.`);
    }

    const cleanProfileDir = profileDir.trim();
    if (!cleanProfileDir || cleanProfileDir.includes('..') || cleanProfileDir.includes('/') || cleanProfileDir.includes('\\')) {
      throw new Error(`Nome de diretório de perfil inválido ou inseguro: "${profileDir}".`);
    }

    const profileFullPath = path.join(resolvedUserDataDir, cleanProfileDir);

    if (!fs.existsSync(profileFullPath)) {
      throw new Error(
        `O perfil do Chrome "${cleanProfileDir}" NÃO existe no disco em: ${profileFullPath}. ` +
        `O Hub não inventa perfis inexistentes. Crie a sessão no Chrome antes de iniciar.`
      );
    }

    const statProfile = fs.statSync(profileFullPath);
    if (!statProfile.isDirectory()) {
      throw new Error(`O caminho do perfil "${profileFullPath}" existe mas não é um diretório.`);
    }

    try {
      fs.accessSync(profileFullPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Sem permissão de leitura no diretório do perfil: ${profileFullPath}`);
    }

    // Check SingletonLock presence (indicates chrome may be running)
    const lockPath = path.join(resolvedUserDataDir, 'SingletonLock');
    const singletonLockActive = fs.existsSync(lockPath);

    return {
      resolvedUserDataDir,
      profileFullPath,
      singletonLockActive
    };
  }

  /**
   * Builds the Linux command to launch Chrome with explicit --user-data-dir and --profile-directory.
   * Used identically across dry-run, live launch, desktop shortcuts, and scripts.
   */
  public buildCommand(
    browserCommand: string,
    resolvedUserDataDir: string,
    profileDir: string,
    targetUrl: string,
    openInNewWindow: boolean = true,
    extraFlags: string[] = []
  ): { binary: string; args: string[]; fullCommandStr: string } {
    const args: string[] = [];

    // Explicit and deterministic user-data-dir and profile-directory
    args.push(`--user-data-dir=${resolvedUserDataDir}`);
    args.push(`--profile-directory=${profileDir}`);

    if (openInNewWindow) {
      args.push('--new-window');
    }

    for (const flag of extraFlags) {
      if (flag && !args.includes(flag)) {
        args.push(flag);
      }
    }

    args.push(targetUrl);

    // Format for shell display
    const escapedArgs = args.map(a => {
      if (a.startsWith('--profile-directory=')) {
        const val = a.replace('--profile-directory=', '');
        return `--profile-directory="${val}"`;
      }
      if (a.startsWith('--user-data-dir=')) {
        const val = a.replace('--user-data-dir=', '');
        return `--user-data-dir="${val}"`;
      }
      return (a.includes(' ') || a.includes('&') || a.includes('?')) ? `"${a}"` : a;
    });

    const fullCommandStr = `${browserCommand} ${escapedArgs.join(' ')}`;

    return {
      binary: browserCommand,
      args,
      fullCommandStr
    };
  }

  public async launch(req: LaunchRequest): Promise<LaunchResult> {
    const config = this.configManager.getConfig();
    const account = config.accounts.find(a => a.id === req.accountId);
    const provider = config.providers.find(p => p.id === req.providerId);

    if (!account) {
      throw new Error(`Conta não encontrada: ${req.accountId}`);
    }
    if (!provider) {
      throw new Error(`Provedor não encontrado: ${req.providerId}`);
    }

    // Determine target URL
    const targetUrl = req.targetUrl || account.customUrls?.[provider.id] || provider.defaultUrl;
    const profileDir = account.chromeProfileDir;
    const effectiveUserDataDir = account.userDataDir || config.system.chromeUserDataDir;
    const browserCommand = config.system.browserCommand || 'google-chrome';
    const openInNewWindow = config.system.openInNewWindow !== false;
    const extraFlags = config.system.additionalFlags || ['--no-first-run'];

    // 1. STRICT VALIDATION: Check that the configured browser executable actually exists!
    const validatedBinary = this.validateBrowserExecutable(browserCommand);

    // 2. STRICT VALIDATION: Check real profile on disk first with explicit userDataDir!
    const { resolvedUserDataDir } = this.validateRealProfile(
      effectiveUserDataDir,
      profileDir
    );

    // 3. Build deterministic command (identical for dryRun and live execution)
    const { args, fullCommandStr } = this.buildCommand(
      browserCommand,
      resolvedUserDataDir,
      profileDir,
      targetUrl,
      openInNewWindow,
      extraFlags
    );

    // Update account last used timestamp
    this.configManager.updateAccountLastUsed(account.id);
    const timestamp = new Date().toISOString();

    if (req.dryRun) {
      return {
        success: true,
        command: fullCommandStr,
        providerName: provider.name,
        accountName: account.name,
        profileDir,
        userDataDir: resolvedUserDataDir,
        targetUrl,
        timestamp,
        mode: 'dry_run',
        message: `Executável e perfil real "${profileDir}" validados com sucesso em "${resolvedUserDataDir}". Comando idêntico ao de execução.`
      };
    }

    // Check if graphical display is available on Linux
    const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

    try {
      if (hasDisplay) {
        const child = spawn(validatedBinary, args, {
          detached: true,
          stdio: 'ignore'
        });
        child.on('error', (err) => {
          console.error('[LauncherService] Erro ao iniciar processo do navegador:', err);
        });
        child.unref();

        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          userDataDir: resolvedUserDataDir,
          targetUrl,
          timestamp,
          mode: 'executed',
          message: `Navegador iniciado com sucesso no perfil "${profileDir}" em "${resolvedUserDataDir}".`
        };
      } else {
        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          userDataDir: resolvedUserDataDir,
          targetUrl,
          timestamp,
          mode: 'command_generated',
          message: `Comando Linux validado e gerado com isolamento estrito de perfil.`,
          warning: `Ambiente sem servidor gráfico X11/Wayland detectado no container. Execute o comando validado no seu terminal Linux.`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        command: fullCommandStr,
        providerName: provider.name,
        accountName: account.name,
        profileDir,
        userDataDir: resolvedUserDataDir,
        targetUrl,
        timestamp,
        mode: 'command_generated',
        message: `Falha ao iniciar processo do Chrome: ${err.message}.`
      };
    }
  }

  /**
   * Generates a Freedesktop .desktop entry file for Linux application menus.
   * Only generates shortcuts for profiles that actually exist on disk, using the exact command parameters.
   */
  public generateDesktopShortcuts(): { path: string; content: string }[] {
    const config = this.configManager.getConfig();
    const shortcuts: { path: string; content: string }[] = [];
    const desktopDir = path.join(os.homedir(), '.local', 'share', 'applications');

    for (const acc of config.accounts) {
      const userDir = acc.userDataDir || config.system.chromeUserDataDir;
      try {
        this.validateRealProfile(userDir, acc.chromeProfileDir);
      } catch {
        // Skip profiles that do not exist on disk
        continue;
      }

      const resolvedUserDataDir = profileScanner.resolvePath(userDir);

      for (const prov of config.providers.filter(p => p.enabled)) {
        const targetUrl = acc.customUrls?.[prov.id] || prov.defaultUrl;
        const { fullCommandStr } = this.buildCommand(
          config.system.browserCommand,
          resolvedUserDataDir,
          acc.chromeProfileDir,
          targetUrl,
          config.system.openInNewWindow !== false,
          config.system.additionalFlags || ['--no-first-run']
        );

        const filename = `ai-hub-${acc.id}-${prov.id}.desktop`;
        const content = `[Desktop Entry]
Version=1.0
Type=Application
Name=AI Hub - ${acc.name} (${prov.shortName})
Comment=Abrir ${prov.name} na conta ${acc.name} (Perfil ${acc.chromeProfileDir})
Exec=${fullCommandStr}
Icon=google-chrome
Terminal=false
Categories=Network;WebBrowser;Office;
Keywords=AI;${prov.name};${acc.name};
`;
        shortcuts.push({
          path: path.join(desktopDir, filename),
          content
        });
      }
    }

    return shortcuts;
  }

  /**
   * Generates a standalone interactive bash script for Linux terminal with exact parameter consistency and validations.
   */
  public generateBashScript(): string {
    const config = this.configManager.getConfig();
    const defaultResolvedDir = profileScanner.resolvePath(config.system.chromeUserDataDir);
    const extraFlagsStr = (config.system.additionalFlags || ['--no-first-run']).join(' ');
    const newWindowFlag = config.system.openInNewWindow !== false ? '--new-window ' : '';

    return `#!/usr/bin/env bash
# ==============================================================================
# AI Account Hub - Linux CLI Launcher
# ==============================================================================
set -e

BROWSER="${config.system.browserCommand}"
DEFAULT_USER_DATA_DIR="${defaultResolvedDir}"

# 1. Validar executável do navegador
if ! command -v "$BROWSER" &> /dev/null; then
  echo "ERRO: O executável do navegador '$BROWSER' não foi encontrado no PATH do sistema."
  echo "Instale o navegador ou ajuste o comando nas configurações do Hub."
  exit 1
fi

echo "=========================================="
echo "          AI ACCOUNT HUB - LINUX          "
echo "=========================================="
echo "Selecione o Provedor de IA:"
echo ""

${config.providers.map((p, idx) => `echo "${idx + 1}) ${p.name} (${p.shortName})"`).join('\n')}
echo ""
read -p "Digite o número do Provedor [1-${config.providers.length}]: " PROV_CHOICE

case $PROV_CHOICE in
${config.providers.map((p, idx) => `  ${idx + 1}) TARGET_URL="${p.defaultUrl}"; PROV_NAME="${p.name}" ;;`).join('\n')}
  *) echo "Opção inválida"; exit 1 ;;
esac

echo ""
echo "Selecione a Conta / Perfil Chrome:"
echo ""

${config.accounts.map((a, idx) => `echo "${idx + 1}) ${a.name} [Perfil: ${a.chromeProfileDir}]"`).join('\n')}
echo ""
read -p "Digite o número da Conta [1-${config.accounts.length}]: " ACC_CHOICE

case $ACC_CHOICE in
${config.accounts.map((a, idx) => {
  const accDir = a.userDataDir ? profileScanner.resolvePath(a.userDataDir) : defaultResolvedDir;
  return `  ${idx + 1}) PROFILE_DIR="${a.chromeProfileDir}"; ACC_NAME="${a.name}"; USER_DATA_DIR="${accDir}" ;;`;
}).join('\n')}
  *) echo "Opção inválida"; exit 1 ;;
esac

echo ""
if [ ! -d "$USER_DATA_DIR" ]; then
  echo "ERRO: O diretório base '$USER_DATA_DIR' não existe no disco."
  exit 1
fi

PROFILE_PATH="$USER_DATA_DIR/$PROFILE_DIR"
if [ ! -d "$PROFILE_PATH" ]; then
  echo "ERRO: O perfil '$PROFILE_DIR' não existe em '$USER_DATA_DIR'."
  echo "O Hub não cria perfis fictícios. Crie a sessão no Chrome antes de iniciar."
  exit 1
fi

echo "-> Abrindo $PROV_NAME na conta $ACC_NAME (Perfil: $PROFILE_DIR em $USER_DATA_DIR)..."
$BROWSER --user-data-dir="$USER_DATA_DIR" --profile-directory="$PROFILE_DIR" ${newWindowFlag}${extraFlagsStr} "$TARGET_URL" &
echo "Sucesso!"
`;
  }
}

export const launcherService = new LauncherService();
