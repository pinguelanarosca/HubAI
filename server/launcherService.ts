import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configManager } from './configManager.js';
import { LaunchRequest, LaunchResult } from '../src/types.js';

export class LauncherService {
  /**
   * Builds the Linux command to launch Chrome with the exact profile directory and target URL.
   */
  public buildCommand(
    browserCommand: string,
    profileDir: string,
    targetUrl: string,
    userDataDir?: string,
    openInNewWindow: boolean = true,
    extraFlags: string[] = []
  ): { binary: string; args: string[]; fullCommandStr: string } {
    const args: string[] = [];

    // Profile specification (the core isolation mechanism)
    args.push(`--profile-directory=${profileDir}`);

    const isStandardChromePath = !userDataDir ||
      userDataDir === '~/.config/google-chrome' ||
      userDataDir === path.join(os.homedir(), '.config', 'google-chrome') ||
      userDataDir.endsWith('/.config/google-chrome');

    if (!isStandardChromePath && userDataDir) {
      const resolved = userDataDir.startsWith('~/')
        ? path.join(os.homedir(), userDataDir.slice(1))
        : path.resolve(userDataDir);
      args.push(`--user-data-dir=${resolved}`);
    }

    if (openInNewWindow) {
      args.push('--new-window');
    }

    for (const flag of extraFlags) {
      if (flag && !args.includes(flag)) {
        args.push(flag);
      }
    }

    args.push(targetUrl);

    // Escape args for shell display
    const escapedArgs = args.map(a => {
      if (a.startsWith('--profile-directory=')) {
        const val = a.replace('--profile-directory=', '');
        return `--profile-directory="${val}"`;
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

    // Determine target URL (account override or provider default)
    const targetUrl = req.targetUrl || account.customUrls?.[provider.id] || provider.defaultUrl;
    const profileDir = account.chromeProfileDir;
    const browserCommand = config.system.browserCommand || 'google-chrome';
    const openInNewWindow = config.system.openInNewWindow !== false;
    const extraFlags = config.system.additionalFlags || ['--no-first-run'];

    const { binary, args, fullCommandStr } = this.buildCommand(
      browserCommand,
      profileDir,
      targetUrl,
      config.system.chromeUserDataDir,
      openInNewWindow,
      extraFlags
    );

    // Record last used timestamp
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
        message: `Comando validado com sucesso para "${account.name}" no perfil "${profileDir}".`
      };
    }

    // Check if graphical display is available on Linux
    const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

    try {
      if (hasDisplay) {
        // Spawn browser process detached so it survives even if app closes
        const child = spawn(binary, args, {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          targetUrl,
          timestamp,
          mode: 'executed',
          message: `Navegador iniciado com sucesso no perfil "${profileDir}"!`
        };
      } else {
        // In container / cloud / headless environment
        return {
          success: true,
          command: fullCommandStr,
          providerName: provider.name,
          accountName: account.name,
          profileDir,
          targetUrl,
          timestamp,
          mode: 'command_generated',
          message: `Comando Linux gerado com isolamento estrito de perfil.`,
          warning: `Ambiente sem servidor X11/Wayland detectado. Execute o comando no seu terminal Linux ou utilize os atalhos .desktop gerados.`
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
        message: `Falha ao executar diretamente: ${err.message}. Utilize o comando gerado.`
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

    for (const acc of config.accounts) {
      for (const prov of config.providers.filter(p => p.enabled)) {
        const targetUrl = acc.customUrls?.[prov.id] || prov.defaultUrl;
        const cmd = `${config.system.browserCommand} --profile-directory="${acc.chromeProfileDir}" --new-window "${targetUrl}"`;

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
    return `#!/usr/bin/env bash
# ==============================================================================
# AI Account Hub - Linux CLI Launcher
# ==============================================================================
set -e

BROWSER="${config.system.browserCommand}"

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
echo "-> Abrindo $PROV_NAME na conta $ACC_NAME (Perfil: $PROFILE_DIR)..."
$BROWSER --profile-directory="$PROFILE_DIR" --new-window "$TARGET_URL" &
echo "Sucesso!"
`;
  }
}

export const launcherService = new LauncherService();
