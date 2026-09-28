import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { UpdateStatus, UpdateApplyResult, ChangedFileDetail, CommitSummary } from '../src/types.js';

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

  public getInstalledCommitDate(): string | undefined {
    try {
      const gitDate = execSync('git log -1 --format=%cd --date=iso 2>/dev/null', {
        cwd: REPO_ROOT,
        encoding: 'utf-8'
      }).trim();
      if (gitDate) return gitDate;
    } catch {
      // Not a git working tree
    }

    const versionFile = path.join(REPO_ROOT, '.version.json');
    if (fs.existsSync(versionFile)) {
      try {
        const vData = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
        if (vData.date) return vData.date;
      } catch {
        // Ignore
      }
    }

    return undefined;
  }

  public async getRemoteCommit(): Promise<{ commit: string; message?: string; date?: string }> {
    // 1. Try GitHub REST API first (provides SHA, commit message, committer date and time)
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
          message: data.commit?.message?.split('\n')?.[0],
          date: data.commit?.committer?.date || data.commit?.author?.date
        };
      }
    } catch (err: any) {
      console.warn('[UpdateService] Não foi possível verificar commit remoto via GitHub API:', err.message);
    }

    // 2. Fallback to git ls-remote or git log
    try {
      const remoteOut = execSync(`git ls-remote ${REPO_URL}.git HEAD 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim();
      const parts = remoteOut.split(/\s+/);
      if (parts[0] && parts[0].length >= 7) {
        let commitDate: string | undefined;
        try {
          commitDate = execSync('git log -1 --format=%cd --date=iso origin/main 2>/dev/null', {
            cwd: REPO_ROOT,
            encoding: 'utf-8'
          }).trim() || undefined;
        } catch {
          // Ignore
        }
        return { commit: parts[0], date: commitDate };
      }
    } catch {
      // Network or git failed
    }

    return {
      commit: this.getInstalledCommit(),
      date: this.getInstalledCommitDate()
    };
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
    const installedCommitDate = this.getInstalledCommitDate();
    let latestCommit = installedCommit;
    let latestCommitDate = installedCommitDate;
    let commitMessage: string | undefined;
    let error: string | undefined;

    try {
      const remote = await this.getRemoteCommit();
      latestCommit = remote.commit;
      latestCommitDate = remote.date || latestCommitDate;
      commitMessage = remote.message;
    } catch (err: any) {
      error = err.message || 'Falha ao conectar com o repositório remoto.';
    }

    const isDifferent = latestCommit !== installedCommit &&
      latestCommit !== 'unknown' &&
      !installedCommit.startsWith('v');

    const hasUpdate = isDifferent;

    let changedFiles: ChangedFileDetail[] | undefined;
    let diffSummary: UpdateStatus['diffSummary'] | undefined;

    if (hasUpdate) {
      try {
        const details = await this.getCompareDetails(installedCommit, latestCommit);
        changedFiles = details.changedFiles;
        diffSummary = details.diffSummary;
      } catch (compareErr) {
        console.warn('[UpdateService] Erro ao carregar detalhes de comparação:', compareErr);
      }
    }

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
      installedCommitDate,
      latestCommit,
      latestCommitDate,
      hasUpdate,
      lastChecked: now,
      currentVersion,
      repoUrl: REPO_URL,
      commitMessage,
      changedFiles,
      diffSummary,
      error
    };

    return this.cachedStatus;
  }

  public async getCompareDetails(installedCommit: string, latestCommit: string): Promise<{
    changedFiles?: ChangedFileDetail[];
    diffSummary?: {
      filesCount: number;
      additions: number;
      deletions: number;
      commitsCount: number;
      commits?: CommitSummary[];
      description?: string;
    };
  }> {
    if (!installedCommit || !latestCommit || installedCommit === latestCommit || latestCommit === 'unknown') {
      return {};
    }

    // 1. Attempt GitHub compare API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`https://api.github.com/repos/pinguelanarosca/HubAI/compare/${installedCommit}...${latestCommit}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'HubAI-Updater'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as any;
        const changedFiles: ChangedFileDetail[] = (data.files || []).map((f: any) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions || 0,
          deletions: f.deletions || 0
        }));

        let totalAdditions = 0;
        let totalDeletions = 0;
        changedFiles.forEach(f => {
          totalAdditions += f.additions;
          totalDeletions += f.deletions;
        });

        const commits: CommitSummary[] = (data.commits || []).map((c: any) => ({
          sha: (c.sha || '').slice(0, 7),
          message: c.commit?.message?.split('\n')?.[0] || '',
          author: c.commit?.author?.name || c.author?.login,
          date: c.commit?.author?.date || c.commit?.committer?.date
        }));

        const filesCount = changedFiles.length;
        const commitsCount = commits.length || data.total_commits || 0;
        const description = `${filesCount} arquivo(s) modificado(s) (${totalAdditions} inserções(+), ${totalDeletions} remoções(-)) em ${commitsCount} commit(s) no GitHub.`;

        return {
          changedFiles,
          diffSummary: {
            filesCount,
            additions: totalAdditions,
            deletions: totalDeletions,
            commitsCount,
            commits,
            description
          }
        };
      }
    } catch (err: any) {
      console.warn('[UpdateService] Não foi possível buscar diff via GitHub Compare API:', err.message);
    }

    // 2. Fallback to local git diff if available
    try {
      const gitDiffNames = execSync(`git diff --name-status ${installedCommit}..${latestCommit} 2>/dev/null`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8'
      }).trim();

      if (gitDiffNames) {
        const lines = gitDiffNames.split('\n').filter(Boolean);
        const changedFiles: ChangedFileDetail[] = lines.map(line => {
          const parts = line.split(/\s+/);
          const statusChar = parts[0] ? parts[0][0] : 'M';
          let status = 'modified';
          if (statusChar === 'A') status = 'added';
          else if (statusChar === 'D') status = 'removed';
          else if (statusChar === 'R') status = 'renamed';

          return {
            filename: parts[1] || parts[0],
            status,
            additions: 0,
            deletions: 0
          };
        });

        let commits: CommitSummary[] = [];
        try {
          const gitLog = execSync(`git log --oneline --format="%h|%s|%an|%cd" --date=iso ${installedCommit}..${latestCommit} 2>/dev/null`, {
            cwd: REPO_ROOT,
            encoding: 'utf-8'
          }).trim();
          if (gitLog) {
            commits = gitLog.split('\n').filter(Boolean).map(line => {
              const [sha, message, author, date] = line.split('|');
              return { sha, message, author, date };
            });
          }
        } catch {
          // Ignore
        }

        const filesCount = changedFiles.length;
        const commitsCount = commits.length;
        const description = `${filesCount} arquivo(s) modificado(s) localmente vs GitHub.`;

        return {
          changedFiles,
          diffSummary: {
            filesCount,
            additions: 0,
            deletions: 0,
            commitsCount,
            commits,
            description
          }
        };
      }
    } catch {
      // Local git diff failed
    }

    return {};
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
