import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { UpdateStatus, UpdateApplyResult } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const REPO_URL = 'https://github.com/pinguelanarosca/HubAI';

export class UpdateService {
  private lastChecked: string | null = null;
  private cachedStatus: UpdateStatus | null = null;

  public getInstalledCommit(): string {
    try {
      const gitCommit = execSync('git rev-parse HEAD 2>/dev/null', {
        cwd: REPO_ROOT,
        encoding: 'utf-8'
      }).trim();
      if (gitCommit) return gitCommit;
    } catch {
      // Not a git working tree
    }

    const versionFile = path.join(REPO_ROOT, '.version');
    if (fs.existsSync(versionFile)) {
      try {
        return fs.readFileSync(versionFile, 'utf-8').trim();
      } catch {
        // Ignore
      }
    }

    try {
      const pkgPath = path.join(REPO_ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return `v${pkg.version || '1.0.0'}-local`;
    } catch {
      return 'v1.0.0-initial';
    }
  }

  public async getRemoteCommit(): Promise<{ commit: string; message?: string }> {
    // 1. Try git ls-remote first
    try {
      const remoteOut = execSync(`git ls-remote ${REPO_URL}.git HEAD 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim();
      const parts = remoteOut.split(/\s+/);
      if (parts[0] && parts[0].length >= 7) {
        return { commit: parts[0] };
      }
    } catch {
      // Network or git failed, try GitHub API
    }

    // 2. Fallback to GitHub REST API with fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('https://api.github.com/repos/pinguelanarosca/HubAI/commits/main', {
        headers: {
          'User-Agent': 'HubAI-Linux-Updater',
          'Accept': 'application/vnd.github.v3+json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as any;
        return {
          commit: data.sha || 'unknown',
          message: data.commit?.message?.split('\n')?.[0]
        };
      }
    } catch (err: any) {
      console.warn('[UpdateService] Não foi possível verificar commit remoto via GitHub API:', err.message);
    }

    return { commit: this.getInstalledCommit() };
  }

  public async checkUpdate(force: boolean = false): Promise<UpdateStatus> {
    const now = new Date().toISOString();

    // Cache check within 30 seconds unless forced
    if (!force && this.cachedStatus && this.lastChecked) {
      const elapsed = Date.now() - new Date(this.lastChecked).getTime();
      if (elapsed < 30000) {
        return this.cachedStatus;
      }
    }

    const installedCommit = this.getInstalledCommit();
    let latestCommit = installedCommit;
    let commitMessage: string | undefined;
    let error: string | undefined;

    try {
      const remote = await this.getRemoteCommit();
      latestCommit = remote.commit;
      commitMessage = remote.message;
    } catch (err: any) {
      error = err.message || 'Falha ao conectar com o repositório remoto.';
    }

    const isDifferent = latestCommit !== installedCommit &&
      latestCommit !== 'unknown' &&
      !installedCommit.startsWith('v');

    const hasUpdate = isDifferent;

    let currentVersion = '1.0.0';
    try {
      const pkgPath = path.join(REPO_ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      currentVersion = pkg.version || '1.0.0';
    } catch {
      // Ignore
    }

    this.lastChecked = now;
    this.cachedStatus = {
      installedCommit,
      latestCommit,
      hasUpdate,
      lastChecked: now,
      currentVersion,
      repoUrl: REPO_URL,
      commitMessage,
      error
    };

    return this.cachedStatus;
  }

  /**
   * Creates a backup of the current application files before updating.
   * Preserves user data in ~/.config/hubai/ completely separate.
   */
  public createBackup(): string {
    const userConfigDir = process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
    const backupsDir = path.join(userConfigDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const timestamp = Date.now();
    const backupPath = path.join(backupsDir, `hubai-backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    // Copy essential directories: src, server, package.json, vite.config.ts, tsconfig.json
    const itemsToBackup = ['src', 'server', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'server.ts'];

    for (const item of itemsToBackup) {
      const srcItem = path.join(REPO_ROOT, item);
      const destItem = path.join(backupPath, item);
      if (fs.existsSync(srcItem)) {
        try {
          fs.cpSync(srcItem, destItem, { recursive: true });
        } catch (copyErr) {
          console.warn(`[UpdateService] Aviso ao fazer backup de ${item}:`, copyErr);
        }
      }
    }

    const meta = {
      timestamp: new Date().toISOString(),
      installedCommit: this.getInstalledCommit(),
      backupPath
    };
    fs.writeFileSync(path.join(backupPath, 'backup-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

    return backupPath;
  }

  /**
   * Restores files from a previously created backup in case of update failure.
   */
  public rollback(backupPath: string): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Diretório de backup não encontrado em: ${backupPath}`);
      }

      const items = ['src', 'server', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'server.ts'];
      for (const item of items) {
        const backupItem = path.join(backupPath, item);
        const targetItem = path.join(REPO_ROOT, item);
        if (fs.existsSync(backupItem)) {
          fs.cpSync(backupItem, targetItem, { recursive: true, force: true });
        }
      }

      // Rebuild to restore valid compiled state
      try {
        execSync('npm run build', { cwd: REPO_ROOT, encoding: 'utf-8' });
      } catch (buildErr: any) {
        console.error('[UpdateService] Falha ao recompilar após rollback:', buildErr.message);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Applies update by delegating to the external autonomous updater script.
   * This completely decouples update compilation/replacement from the running Node.js server.
   */
  public async applyUpdate(): Promise<UpdateApplyResult> {
    const logs: string[] = [];
    const previousCommit = this.getInstalledCommit();
    logs.push(`[${new Date().toISOString()}] Iniciando delegação para o atualizador autônomo do HubAI...`);
    logs.push(`Commit instalado atual: ${previousCommit}`);

    const userUpdater = path.join(os.homedir(), '.local', 'share', 'hubai-updater.sh');
    const localUpdater = path.join(REPO_ROOT, 'scripts', 'hubai-updater.sh');
    const fallbackUpdater = path.join(REPO_ROOT, 'scripts', 'update.sh');

    let updaterScript: string;
    if (fs.existsSync(userUpdater)) {
      updaterScript = userUpdater;
    } else if (fs.existsSync(localUpdater)) {
      updaterScript = localUpdater;
    } else if (fs.existsSync(fallbackUpdater)) {
      updaterScript = fallbackUpdater;
    } else {
      return {
        success: false,
        message: 'Script do atualizador externo não encontrado.',
        error: `Não foi possível localizar o atualizador em: ${userUpdater} ou ${localUpdater}`,
        logs
      };
    }

    try {
      logs.push(`Disparando atualizador externo independente: ${updaterScript}`);

      const userConfigDir = process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
      const child = spawn(
        'bash',
        [
          updaterScript,
          '--pid', String(process.pid),
          '--target-dir', REPO_ROOT,
          '--config-dir', userConfigDir
        ],
        {
          detached: true,
          stdio: 'ignore'
        }
      );

      child.on('error', (err) => {
        console.error('[UpdateService] Erro ao disparar processo do atualizador externo:', err);
      });

      child.unref();

      logs.push(`✓ Atualizador autônomo iniciado com sucesso em segundo plano (PID: ${child.pid}).`);
      logs.push('O processo atual será substituído e o servidor será reiniciado automaticamente após a compilação.');
      logs.push(`Logs detalhados em tempo real: ${path.join(userConfigDir, 'logs', 'updater.log')}`);

      return {
        success: true,
        message: 'Atualizador autônomo iniciado com sucesso. O HubAI será atualizado e reiniciado automaticamente.',
        previousCommit,
        logs
      };
    } catch (err: any) {
      logs.push(`✗ Falha ao iniciar atualizador externo: ${err.message}`);
      return {
        success: false,
        message: 'Falha ao iniciar processo de atualização externa.',
        error: err.message,
        logs
      };
    }
  }
}

export const updateService = new UpdateService();
