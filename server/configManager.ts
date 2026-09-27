import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { HubConfig, HubAccount, AIProvider } from '../src/types.js';
import { defaultHubConfig } from './defaultConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigManager {
  private config: HubConfig;
  private configDir: string;
  private configFile: string;
  private legacyConfigFile: string;

  constructor(customConfigDir?: string) {
    this.configDir = customConfigDir || process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
    this.configFile = path.join(this.configDir, 'hub-config.json');
    this.legacyConfigFile = path.resolve(__dirname, '../data', 'hub-config.json');

    this.ensureConfigDir();
    this.config = this.loadConfig();
  }

  public getConfigDir(): string {
    return this.configDir;
  }

  public getConfigFile(): string {
    return this.configFile;
  }

  private ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      try {
        fs.mkdirSync(this.configDir, { recursive: true });
      } catch (err) {
        console.error('[ConfigManager] Falha ao criar diretório de configuração do usuário:', err);
      }
    }
  }

  /**
   * Strictly validates that a configuration object is complete, coherent,
   * and adheres to safety constraints (e.g. no directory traversal, non-empty IDs).
   */
  public validateConfig(candidate: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, errors: ['A configuração deve ser um objeto JSON válido.'] };
    }

    // Validate system section
    if (!candidate.system || typeof candidate.system !== 'object') {
      errors.push('Seção "system" é obrigatória e deve ser um objeto.');
    } else {
      if (!candidate.system.browserCommand || typeof candidate.system.browserCommand !== 'string' || candidate.system.browserCommand.trim() === '') {
        errors.push('system.browserCommand é obrigatório e não pode ser vazio.');
      }
      if (!candidate.system.chromeUserDataDir || typeof candidate.system.chromeUserDataDir !== 'string' || candidate.system.chromeUserDataDir.trim() === '') {
        errors.push('system.chromeUserDataDir é obrigatório e não pode ser vazio.');
      }
    }

    // Validate accounts
    if (!Array.isArray(candidate.accounts) || candidate.accounts.length === 0) {
      errors.push('A lista de contas ("accounts") deve ser um array com pelo menos 1 conta.');
    } else {
      const seenAccountIds = new Set<string>();
      const seenProfileKeys = new Set<string>();
      const defaultUserDir = candidate.system?.chromeUserDataDir || '~/.config/google-chrome';

      for (let i = 0; i < candidate.accounts.length; i++) {
        const acc = candidate.accounts[i];
        if (!acc || typeof acc !== 'object') {
          errors.push(`Conta no índice ${i} é inválida.`);
          continue;
        }

        if (!acc.id || typeof acc.id !== 'string' || acc.id.trim() === '') {
          errors.push(`Conta no índice ${i} possui "id" ausente ou inválido.`);
        } else if (seenAccountIds.has(acc.id)) {
          errors.push(`ID de conta duplicado detectado: "${acc.id}".`);
        } else {
          seenAccountIds.add(acc.id);
        }

        if (!acc.name || typeof acc.name !== 'string' || acc.name.trim() === '') {
          errors.push(`Conta "${acc.id || i}" possui nome vazio.`);
        }

        if (!acc.chromeProfileDir || typeof acc.chromeProfileDir !== 'string' || acc.chromeProfileDir.trim() === '') {
          errors.push(`Conta "${acc.id || i}" possui "chromeProfileDir" vazio.`);
        } else {
          const cleanDir = acc.chromeProfileDir.trim();
          if (cleanDir.includes('..') || cleanDir.includes('/') || cleanDir.includes('\\')) {
            errors.push(`Conta "${acc.name}": "chromeProfileDir" contém caracteres ilegais ou tentativa de path traversal ("${cleanDir}").`);
          }

          const targetUserDataDir = (acc.userDataDir && typeof acc.userDataDir === 'string')
            ? acc.userDataDir.trim()
            : defaultUserDir;

          const profileKey = `${targetUserDataDir}::${cleanDir}`;
          if (seenProfileKeys.has(profileKey)) {
            errors.push(`Colisão de perfil: O perfil "${cleanDir}" em "${targetUserDataDir}" foi atribuído a mais de uma conta. Cada conta deve ter perfil exclusivo.`);
          } else {
            seenProfileKeys.add(profileKey);
          }
        }
      }
    }

    // Validate providers
    if (!Array.isArray(candidate.providers) || candidate.providers.length === 0) {
      errors.push('A lista de provedores ("providers") deve ser um array com pelo menos 1 provedor.');
    } else {
      const seenProvIds = new Set<string>();

      for (let i = 0; i < candidate.providers.length; i++) {
        const prov = candidate.providers[i];
        if (!prov || typeof prov !== 'object') {
          errors.push(`Provedor no índice ${i} é inválido.`);
          continue;
        }

        if (!prov.id || typeof prov.id !== 'string' || prov.id.trim() === '') {
          errors.push(`Provedor no índice ${i} possui "id" ausente ou inválido.`);
        } else if (seenProvIds.has(prov.id)) {
          errors.push(`ID de provedor duplicado: "${prov.id}".`);
        } else {
          seenProvIds.add(prov.id);
        }

        if (!prov.name || typeof prov.name !== 'string' || prov.name.trim() === '') {
          errors.push(`Provedor "${prov.id || i}" possui nome vazio.`);
        }

        if (!prov.defaultUrl || typeof prov.defaultUrl !== 'string' || prov.defaultUrl.trim() === '') {
          errors.push(`Provedor "${prov.id || i}" possui defaultUrl vazia.`);
        } else {
          try {
            const parsed = new URL(prov.defaultUrl);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              errors.push(`Provedor "${prov.name}": URL deve usar protocolo http ou https.`);
            }
          } catch {
            errors.push(`Provedor "${prov.name}": URL inválida ("${prov.defaultUrl}").`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public loadConfig(): HubConfig {
    this.ensureConfigDir();

    // 1. Check user standard config directory ~/.config/hubai/hub-config.json
    if (fs.existsSync(this.configFile)) {
      try {
        const raw = fs.readFileSync(this.configFile, 'utf-8');
        const parsed = JSON.parse(raw);
        const validation = this.validateConfig(parsed);

        if (validation.valid) {
          return parsed as HubConfig;
        } else {
          console.error('[ConfigManager] Configuração em ~/.config/hubai contém erros de validação:', validation.errors);
          console.warn('[ConfigManager] Carregando configuração padrão segura.');
        }
      } catch (err) {
        console.error('[ConfigManager] Erro ao ler JSON de configuração em ~/.config/hubai:', err);
      }
    }

    // 2. Migration: If ~/.config/hubai/hub-config.json does not exist, check legacy project data/hub-config.json
    if (fs.existsSync(this.legacyConfigFile)) {
      try {
        const rawLegacy = fs.readFileSync(this.legacyConfigFile, 'utf-8');
        const parsedLegacy = JSON.parse(rawLegacy);
        const validation = this.validateConfig(parsedLegacy);

        if (validation.valid) {
          console.log('[ConfigManager] Migrando configuração existente de data/hub-config.json para ~/.config/hubai/hub-config.json...');
          this.saveConfig(parsedLegacy as HubConfig);
          return parsedLegacy as HubConfig;
        }
      } catch (legacyErr) {
        console.warn('[ConfigManager] Erro ao tentar migrar configuração legada:', legacyErr);
      }
    }

    // 3. Fallback: Save initial clean default config to ~/.config/hubai/hub-config.json
    this.saveConfig(defaultHubConfig);
    return defaultHubConfig;
  }

  public getConfig(): HubConfig {
    return this.config;
  }

  public saveConfig(newConfig: HubConfig): { success: boolean; errors?: string[] } {
    this.ensureConfigDir();
    const validation = this.validateConfig(newConfig);

    if (!validation.valid) {
      console.error('[ConfigManager] Tentativa de salvar configuração inválida rejeitada:', validation.errors);
      return { success: false, errors: validation.errors };
    }

    try {
      this.config = newConfig;
      fs.writeFileSync(this.configFile, JSON.stringify(newConfig, null, 2), 'utf-8');
      return { success: true };
    } catch (err: any) {
      console.error('[ConfigManager] Falha ao escrever configuração no disco em', this.configFile, err);
      return { success: false, errors: [err.message] };
    }
  }

  public resetToDefaults(): HubConfig {
    this.config = JSON.parse(JSON.stringify(defaultHubConfig));
    this.saveConfig(this.config);
    return this.config;
  }

  public updateAccountLastUsed(accountId: string) {
    const acc = this.config.accounts.find(a => a.id === accountId);
    if (acc) {
      acc.lastUsedAt = new Date().toISOString();
      this.saveConfig(this.config);
    }
  }
}

export const configManager = new ConfigManager();
