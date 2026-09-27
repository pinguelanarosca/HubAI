import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { configManager } from './server/configManager.js';
import { profileScanner } from './server/profileScanner.js';
import { diagnosticService } from './server/diagnosticService.js';
import { launcherService } from './server/launcherService.js';
import { HubConfig } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // 1. Config Endpoints
  app.get('/api/config', (req, res) => {
    try {
      const config = configManager.getConfig();
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/config', (req, res) => {
    try {
      const newConfig = req.body as HubConfig;
      if (!newConfig || !Array.isArray(newConfig.accounts) || !Array.isArray(newConfig.providers)) {
        return res.status(400).json({ success: false, error: 'Configuração inválida fornecida' });
      }
      const saved = configManager.saveConfig(newConfig);
      if (saved) {
        res.json({ success: true, config: configManager.getConfig() });
      } else {
        res.status(500).json({ success: false, error: 'Falha ao salvar configuração' });
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

  // 2. Profile & System Discovery Endpoints
  app.get('/api/system/profiles', (req, res) => {
    try {
      const customUserDataDir = req.query.userDataDir as string | undefined;
      const info = profileScanner.getSystemBrowserInfo(customUserDataDir);
      res.json({ success: true, data: info });
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
      res.status(500).json({ success: false, error: err.message });
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

  // 5. Script & Desktop Shortcuts Export
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

      // Try writing to user's .local/share/applications if writable
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

  // Mount Vite middleware for dev or serve dist in production
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[AI Account Hub] Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[AI Account Hub] Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
