import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { configManager } from './server/configManager.js';
import { profileScanner } from './server/profileScanner.js';
import { diagnosticService } from './server/diagnosticService.js';
import { launcherService } from './server/launcherService.js';
import { updateService } from './server/updateService.js';
import { HubConfig } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || process.env.HUBAI_PORT || 8080;

  app.use(express.json());

  // 1. Config Endpoints
  app.get('/api/config', (req, res) => {
    try {
      const config = configManager.getConfig();
      res.json({
        success: true,
        config,
        configDir: configManager.getConfigDir(),
        configFile: configManager.getConfigFile()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/config', (req, res) => {
    try {
      const newConfig = req.body as HubConfig;
      const result = configManager.saveConfig(newConfig);
      if (result.success) {
        res.json({ success: true, config: configManager.getConfig() });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors,
          error: result.errors?.join(' ') || 'Configuração inválida'
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/config/reset', (req, res) => {
    try {
      const resetConfig = configManager.resetToDefaults();
      res.json({ success: true, config: resetConfig });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Profile Discovery & Synchronization Endpoints (Google Chrome / Chromium)
  const handleSync = (req: express.Request, res: express.Response) => {
    try {
      const customUserDataDir = req.query.userDataDir as string | undefined;
      const syncResult = profileScanner.syncAccountsWithProfiles(customUserDataDir);
      res.json({ success: true, sync: syncResult });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  const handleImport = (req: express.Request, res: express.Response) => {
    try {
      const { bindings } = req.body;
      const result = profileScanner.importMatchedProfiles(bindings);
      if (result.success) {
        res.json({
          success: true,
          updatedAccountsCount: result.updatedAccountsCount,
          config: configManager.getConfig()
        });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors,
          error: result.errors?.join(' ') || 'Falha ao importar perfis'
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/profiles/detect', (req, res) => {
    try {
      const customUserDataDir = req.query.userDataDir as string | undefined;
      const info = profileScanner.getSystemBrowserInfo(customUserDataDir);
      res.json({ success: true, data: info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/profiles/sync', handleSync);
  app.get('/api/chrome/sync', handleSync);

  app.post('/api/profiles/import', handleImport);
  app.post('/api/chrome/import', handleImport);

  app.get('/api/system/browser-variants', (req, res) => {
    try {
      const variants = profileScanner.detectBrowserVariants();
      res.json({ success: true, variants });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Launch Platform Endpoint
  app.post('/api/launch', async (req, res) => {
    try {
      const { accountId, providerId, targetUrl, dryRun } = req.body;
      if (!accountId || !providerId) {
        return res.status(400).json({ success: false, error: 'accountId e providerId são obrigatórios' });
      }
      const result = await launcherService.launch({ accountId, providerId, targetUrl, dryRun });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 4. Comprehensive Diagnostic Endpoint
  app.post('/api/diagnose', async (req, res) => {
    try {
      const report = await diagnosticService.runFullDiagnostic();
      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Update Endpoints (Git / GitHub verification, backup and safe rollback)
  const handleCheckUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const force = req.query.force === 'true' || req.method === 'POST';
      const status = await updateService.checkUpdate(force);
      res.json({ success: true, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  const handleApplyUpdate = async (_req: express.Request, res: express.Response) => {
    try {
      const result = await updateService.applyUpdate();
      if (result.success) {
        res.json({ success: true, result });
      } else {
        res.status(500).json({ success: false, result, error: result.error || result.message });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/update/status', handleCheckUpdate);
  app.post('/api/update/check', handleCheckUpdate);
  app.get('/api/app/check-update', handleCheckUpdate);
  app.post('/api/app/check-update', handleCheckUpdate);

  app.post('/api/update/apply', handleApplyUpdate);
  app.post('/api/app/apply-update', handleApplyUpdate);

  // 6. Script & Desktop Shortcuts Export
  app.get('/api/export/bash-script', (req, res) => {
    try {
      const script = launcherService.generateBashScript();
      res.setHeader('Content-Type', 'text/x-shellscript');
      res.setHeader('Content-Disposition', 'attachment; filename="ai-account-hub.sh"');
      res.send(script);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/export/desktop-shortcuts', (req, res) => {
    try {
      const shortcuts = launcherService.generateDesktopShortcuts();
      let installedCount = 0;
      const errors: string[] = [];

      for (const sc of shortcuts) {
        try {
          const dir = path.dirname(sc.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(sc.path, sc.content, { mode: 0o755 });
          installedCount++;
        } catch (e: any) {
          errors.push(e.message);
        }
      }

      res.json({
        success: true,
        totalShortcuts: shortcuts.length,
        installedCount,
        errors: errors.length > 0 ? errors : undefined,
        shortcutsPreview: shortcuts.slice(0, 3)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. System Uninstaller Endpoints
  app.get('/api/system/uninstall-info', (req, res) => {
    try {
      const home = process.env.HOME || '';
      res.json({
        success: true,
        paths: {
          binary: path.join(home, '.local/bin/hubai'),
          installDir: path.join(home, '.local/share/hubai'),
          updater: path.join(home, '.local/share/hubai-updater.sh'),
          desktopFile: path.join(home, '.local/share/applications/hubai.desktop'),
          configDir: configManager.getConfigDir(),
          configFile: configManager.getConfigFile(),
          logsDir: path.join(configManager.getConfigDir(), 'logs'),
          backupsDir: path.join(configManager.getConfigDir(), 'backups')
        },
        commands: {
          standard: 'bash ~/.local/share/hubai/uninstall.sh',
          purge: 'bash ~/.local/share/hubai/uninstall.sh --purge',
          cliPurge: 'hubai uninstall --purge',
          curlPurge: 'curl -sSL https://raw.githubusercontent.com/pinguelanarosca/HubAI/main/uninstall.sh | bash -s -- --purge'
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/system/uninstall', (req, res) => {
    try {
      const purge = req.body?.purge === true;
      const uninstallerPath = path.join(process.env.HOME || '', '.local/share/hubai/uninstall.sh');
      const scriptToRun = fs.existsSync(uninstallerPath) ? uninstallerPath : path.join(__dirname, 'uninstall.sh');

      res.json({
        success: true,
        message: purge
          ? 'Desinstalação completa e limpeza total de dados iniciada.'
          : 'Desinstalação da aplicação iniciada. Configurações mantidas.',
        purge
      });

      setTimeout(() => {
        try {
          const args = purge ? ['--purge'] : [];
          spawn('bash', [scriptToRun, ...args], { detached: true, stdio: 'ignore' }).unref();
        } catch (e) {
          console.error('[HubAI] Erro ao disparar script de desinstalação:', e);
        }
      }, 800);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mount Vite middleware for dev or serve dist in production
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`[HubAI] Servidor rodando na porta ${PORT}`);
    console.log(`[HubAI] Configuração do usuário: ${configManager.getConfigFile()}`);
  });
}

startServer().catch(err => {
  console.error('[HubAI] Erro fatal na inicialização do servidor:', err);
  process.exit(1);
});
