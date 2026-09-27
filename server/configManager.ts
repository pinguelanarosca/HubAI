import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HubConfig } from '../src/types.js';
import { defaultHubConfig } from './defaultConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'hub-config.json');

export class ConfigManager {
  private config: HubConfig;

  constructor() {
    this.ensureDataDir();
    this.config = this.loadConfig();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public loadConfig(): HubConfig {
    try {
      this.ensureDataDir();
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<HubConfig>;
        // Merge with defaults to ensure all fields are present
        const merged: HubConfig = {
          version: parsed.version || defaultHubConfig.version,
          system: {
            ...defaultHubConfig.system,
            ...(parsed.system || {})
          },
          providers: parsed.providers && parsed.providers.length > 0 ? parsed.providers : defaultHubConfig.providers,
          accounts: parsed.accounts && parsed.accounts.length > 0 ? parsed.accounts : defaultHubConfig.accounts
        };
        return merged;
      }
    } catch (err) {
      console.error('Error loading config file, fallback to defaults:', err);
    }
    // If not existing or error, save default and return
    this.saveConfig(defaultHubConfig);
    return defaultHubConfig;
  }

  public getConfig(): HubConfig {
    return this.config;
  }

  public saveConfig(newConfig: HubConfig): boolean {
    try {
      this.ensureDataDir();
      this.config = newConfig;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to save hub configuration:', err);
      return false;
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
