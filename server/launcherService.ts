import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configManager } from './configManager.js';
import { profileScanner } from './profileScanner.js';
import { LaunchRequest, LaunchResult } from '../src/types.js';

export class LauncherService {
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

    // Check SingletonLock
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
   * Consistent for all Linux environments (Ubuntu, Debian, Fedora, Arch, Mint).
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
    const config = configManager.getConfig();
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
    const browserCommand = config.system.browserCommand || 'google-chrome';
    const openInNewWindow = config.system.openInNewWindow !== false;
    const extraFlags = config.system.additionalFlags || ['--no-first-run'];

    // 1. STRICT VALIDATION: Check real profile on disk first!
    const { resolvedUserDataDir, singletonLockActive } = this.validateRealProfile(
      config.system.chromeUserDataDir,
      profileDir
    );

    // 2. Build deterministic command
    const { binary, args, fullCommandStr } = this.buildCommand(
      browserCommand,
      resolvedUserDataDir,
      profileDir,
      targetUrl,
      openInNewWindow,
      extraFlags
    );

    // Update account last used timestamp
    configManager.updateAccountLastUsed(account.id);
    const timestamp = new Date().toISOString();

    if (req.dryRun) {
      return {
        success: true,
        command: fullCommandStr,
        providerName: provider.name,
        accountName: account.name,
        profileDir,
        targetUrl,
        timestamp,
        mode: 'dry_run',
        message: `Perfil real "${profileDir}" validado com sucesso. Comando pronto para execução.`
      };
    }

    // Check if graphical display is available on Linux
    const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

    try {
      if (hasDisplay) {
        const child = spawn(binary, args, {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        const lockMsg = singletonLockActive
          ? ' (Chrome já em execução: janela enviada para o perfil ativo via IPC)'
          : '';

        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          targetUrl,
          timestamp,
          mode: 'executed',
          message: `Navegador iniciado com sucesso no perfil "${profileDir}"!${lockMsg}`
        };
      } else {
        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          targetUrl,
          timestamp,
          mode: 'command_generated',
          message: `Comando Linux gerado com isolamento estrito verificado.`,
          warning: `Ambiente sem servidor X11/Wayland detectado. Execute o comando validado no terminal desktop do seu computador.`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        command: fullCommandStr,
        providerName: provider.name,
        accountName: account.name,
        profileDir,
        targetUrl,
        timestamp,
        mode: 'command_generated',
        message: `Falha ao iniciar processo do Chrome: ${err.message}. Utilize o comando validado.`
      };
    }
  }

  /**
   * Generates a Freedesktop .desktop entry file for Linux application menus.
   */
  public generateDesktopShortcuts(): { path: string; content: string }[] {
    const config = configManager.getConfig();
    const shortcuts: { path: string; content: string }[] = [];
    const desktopDir = path.join(os.homedir(), '.local', 'share', 'applications');
    const resolvedUserDataDir = profileScanner.resolvePath(config.system.chromeUserDataDir);

    for (const acc of config.accounts) {
      for (const prov of config.providers.filter(p => p.enabled)) {
        const targetUrl = acc.customUrls?.[prov.id] || prov.defaultUrl;
        const cmd = `${config.system.browserCommand} --user-data-dir="${resolvedUserDataDir}" --profile-directory="${acc.chromeProfileDir}" --new-window "${targetUrl}"`;

        const filename = `ai-hub-${acc.id}-${prov.id}.desktop`;
        const content = `[Desktop Entry]
Version=1.0
Type=Application
Name=AI Hub - ${acc.name} (${prov.shortName})
Comment=Abrir ${prov.name} na conta ${acc.name} (Perfil ${acc.chromeProfileDir})
Exec=${cmd}
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
   * Generates a standalone interactive bash script for Linux terminal.
   */
  public generateBashScript(): string {
    const config = configManager.getConfig();
    const resolvedUserDataDir = profileScanner.resolvePath(config.system.chromeUserDataDir);

    return `#!/usr/bin/env bash
# ==============================================================================
# AI Account Hub - Linux CLI Launcher
# ==============================================================================
set -e

BROWSER="${config.system.browserCommand}"
USER_DATA_DIR="${resolvedUserDataDir}"

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
${config.accounts.map((a, idx) => `  ${idx + 1}) PROFILE_DIR="${a.chromeProfileDir}"; ACC_NAME="${a.name}" ;;`).join('\n')}
  *) echo "Opção inválida"; exit 1 ;;
esac

echo ""
PROFILE_PATH="$USER_DATA_DIR/$PROFILE_DIR"
if [ ! -d "$PROFILE_PATH" ]; then
  echo "ERRO: O perfil '$PROFILE_DIR' não existe em '$USER_DATA_DIR'."
  echo "Crie o perfil no Chrome antes de iniciar."
  exit 1
fi

echo "-> Abrindo $PROV_NAME na conta $ACC_NAME (Perfil: $PROFILE_DIR)..."
$BROWSER --user-data-dir="$USER_DATA_DIR" --profile-directory="$PROFILE_DIR" --new-window "$TARGET_URL" &
echo "Sucesso!"
`;
  }
}

export const launcherService = new LauncherService();
