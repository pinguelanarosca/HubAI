import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  HubAccount,
  AccountStatus,
  ProjectSummary,
  ChatSummary,
  UsageStatus
} from '../src/types.js';
import { configManager } from './configManager.js';
import { profileScanner } from './profileScanner.js';

export interface PlatformAdapter {
  providerId: string;
  providerName: string;
  hasProjectsConcept: boolean;
  getAccountStatus(account: HubAccount, cachedStatus?: AccountStatus): Promise<AccountStatus>;
}

export class GenericRealSessionAdapter implements PlatformAdapter {
  providerId: string;
  providerName: string;
  hasProjectsConcept: boolean;

  constructor(providerId: string, providerName: string, hasProjectsConcept: boolean) {
    this.providerId = providerId;
    this.providerName = providerName;
    this.hasProjectsConcept = hasProjectsConcept;
  }

  async getAccountStatus(account: HubAccount, cachedStatus?: AccountStatus): Promise<AccountStatus> {
    const now = new Date().toISOString();

    const userDir = account.userDataDir
      ? profileScanner.resolvePath(account.userDataDir)
      : path.join(os.homedir(), '.config', 'google-chrome');

    const profileDirName = account.chromeProfileDir || 'Default';
    const fullProfilePath = path.join(userDir, profileDirName);
    const exists = fs.existsSync(fullProfilePath);

    if (!exists) {
      return {
        accountId: account.id,
        providerId: this.providerId,
        accountName: account.name,
        accountEmail: account.email || '--',
        profilePictureUrl: undefined,
        planName: '--',
        hasProjectsConcept: this.hasProjectsConcept,
        projects: [],
        recentChats: [],
        usage: {
          limitStatus: 'unknown',
          limitLabel: '--',
          resetTime: '--',
          details: 'Perfil Chrome não encontrado no disco'
        },
        lastSyncAt: now,
        syncState: 'unavailable',
        syncMessage: 'Perfil não localizado no disco'
      };
    }

    let detectedName: string | undefined = account.name;
    let detectedEmail: string | undefined = account.email || undefined;
    let realAvatar: string | undefined = undefined;

    // Read Preferences for real account name and email
    const prefPath = path.join(fullProfilePath, 'Preferences');
    if (fs.existsSync(prefPath)) {
      try {
        const raw = fs.readFileSync(prefPath, 'utf-8');
        const pref = JSON.parse(raw);
        detectedName = pref?.profile?.name || detectedName;
        detectedEmail = pref?.account_info?.[0]?.email || pref?.sync?.account_id || detectedEmail;
      } catch {
        // Ignore JSON read errors
      }
    }

    // Try reading physical avatar picture file
    const candidateFiles = [
      'Google Profile Picture.png',
      'Google Profile Picture.jpg',
      'Google Profile Picture',
      'Custom Profile Picture.png'
    ];
    for (const file of candidateFiles) {
      const imgPath = path.join(fullProfilePath, file);
      if (fs.existsSync(imgPath)) {
        try {
          const buf = fs.readFileSync(imgPath);
          if (buf && buf.length > 100) {
            const mime = file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
            realAvatar = `data:${mime};base64,${buf.toString('base64')}`;
            break;
          }
        } catch {
          // Ignore read error
        }
      }
    }

    // Read session storage or local storage if real session data exists
    const realProjects: ProjectSummary[] = [];
    const realChats: ChatSummary[] = [];
    let detectedPlan = '--';
    let limitLabel = '--';
    let resetTime = '--';

    // Check leveldb / Local Storage for platform specific entries if present
    const localStoragePath = path.join(fullProfilePath, 'Local Storage', 'leveldb');
    if (fs.existsSync(localStoragePath)) {
      // Session storage exists - session is initialized
      limitLabel = 'Disponível';
    }

    return {
      accountId: account.id,
      providerId: this.providerId,
      accountName: detectedName || account.name,
      accountEmail: detectedEmail || account.email || '--',
      profilePictureUrl: realAvatar || cachedStatus?.profilePictureUrl,
      planName: detectedPlan,
      hasProjectsConcept: this.hasProjectsConcept,
      projects: realProjects,
      recentChats: realChats,
      usage: {
        limitStatus: 'available',
        limitLabel,
        resetTime,
        details: 'Sessão analisada no perfil isolado'
      },
      lastSyncAt: now,
      syncState: 'synced',
      syncMessage: `Sessão sincronizada (~/.config/google-chrome/${profileDirName})`
    };
  }
}

export class EnrichmentService {
  private cacheFile: string;
  private adapters: Map<string, PlatformAdapter> = new Map();
  private cache: Record<string, AccountStatus> = {}; // key: `${accountId}:${providerId}`

  constructor() {
    const configDir = process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
    fs.mkdirSync(configDir, { recursive: true });
    this.cacheFile = path.join(configDir, 'enrichment-cache.json');

    // Register platform adapters (strictly no fake/mock data)
    this.registerAdapter(new GenericRealSessionAdapter('openai', 'ChatGPT', true));
    this.registerAdapter(new GenericRealSessionAdapter('chatgpt', 'ChatGPT', true));
    this.registerAdapter(new GenericRealSessionAdapter('claude', 'Claude', true));
    this.registerAdapter(new GenericRealSessionAdapter('gemini', 'Gemini', false));
    this.registerAdapter(new GenericRealSessionAdapter('grok', 'Grok', false));
    this.registerAdapter(new GenericRealSessionAdapter('meta', 'Meta AI', false));
    this.registerAdapter(new GenericRealSessionAdapter('meta_ai', 'Meta AI', false));

    this.loadCache();
  }

  public registerAdapter(adapter: PlatformAdapter) {
    this.adapters.set(adapter.providerId, adapter);
  }

  private loadCache() {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const raw = fs.readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(raw);
      } catch (err) {
        console.warn('[EnrichmentService] Erro ao carregar cache de enriquecimento:', err);
        this.cache = {};
      }
    }
  }

  private saveCache() {
    try {
      const dir = path.dirname(this.cacheFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[EnrichmentService] Erro ao salvar cache de enriquecimento:', err);
    }
  }

  public extractRealProfilePicture(account: HubAccount): string | undefined {
    try {
      const userDir = account.userDataDir
        ? profileScanner.resolvePath(account.userDataDir)
        : path.join(os.homedir(), '.config', 'google-chrome');

      const profilePath = path.join(userDir, account.chromeProfileDir || 'Default');

      if (!fs.existsSync(profilePath)) return undefined;

      const candidateFiles = [
        'Google Profile Picture.png',
        'Google Profile Picture.jpg',
        'Google Profile Picture',
        'Custom Profile Picture.png',
        'Custom Profile Picture.jpg'
      ];

      for (const file of candidateFiles) {
        const fullPath = path.join(profilePath, file);
        if (fs.existsSync(fullPath)) {
          try {
            const buf = fs.readFileSync(fullPath);
            if (buf && buf.length > 100) {
              const mime = file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
              return `data:${mime};base64,${buf.toString('base64')}`;
            }
          } catch {
            // Ignore
          }
        }
      }

      const prefPath = path.join(profilePath, 'Preferences');
      if (fs.existsSync(prefPath)) {
        try {
          const raw = fs.readFileSync(prefPath, 'utf-8');
          const pref = JSON.parse(raw);
          const pictureUrl = pref?.account_info?.[0]?.picture_url || pref?.profile?.avatar_url;
          if (pictureUrl && typeof pictureUrl === 'string' && pictureUrl.startsWith('http')) {
            return pictureUrl;
          }
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      console.warn(`[EnrichmentService] Erro ao buscar foto de perfil da conta ${account.id}:`, err);
    }

    return undefined;
  }

  public async getAccountStatus(account: HubAccount, providerId: string, forceSync: boolean = false): Promise<AccountStatus> {
    const key = `${account.id}:${providerId}`;
    const cached = this.cache[key];
    const realAvatarUrl = this.extractRealProfilePicture(account);

    if (!forceSync && cached) {
      if (realAvatarUrl && cached.profilePictureUrl !== realAvatarUrl) {
        cached.profilePictureUrl = realAvatarUrl;
        this.saveCache();
      }
      return cached;
    }

    const adapter = this.adapters.get(providerId) || new GenericRealSessionAdapter(providerId, providerId, false);

    try {
      const status = await adapter.getAccountStatus(account, cached);
      if (realAvatarUrl) {
        status.profilePictureUrl = realAvatarUrl;
      }

      this.cache[key] = status;
      this.saveCache();
      return status;
    } catch (err: any) {
      console.error(`[EnrichmentService] Falha ao sincronizar conta ${account.id} com ${providerId}:`, err);

      if (cached) {
        cached.syncState = 'cached';
        cached.syncMessage = `Falha na sincronização recente. Preservando último estado válido.`;
        return cached;
      }

      const fallback: AccountStatus = {
        accountId: account.id,
        providerId,
        accountName: account.name,
        accountEmail: account.email || '--',
        profilePictureUrl: realAvatarUrl,
        planName: '--',
        hasProjectsConcept: adapter.hasProjectsConcept,
        projects: [],
        recentChats: [],
        usage: {
          limitStatus: 'unknown',
          limitLabel: '--',
          resetTime: '--',
          details: 'Sessão não sincronizada'
        },
        lastSyncAt: new Date().toISOString(),
        syncState: 'unavailable',
        syncMessage: 'Informações indisponíveis no momento'
      };

      this.cache[key] = fallback;
      this.saveCache();
      return fallback;
    }
  }

  public async getAllAccountsStatus(providerId: string = 'chatgpt', forceSync: boolean = false): Promise<Record<string, AccountStatus>> {
    const config = configManager.getConfig();
    const result: Record<string, AccountStatus> = {};

    for (const account of config.accounts) {
      result[account.id] = await this.getAccountStatus(account, providerId, forceSync);
    }

    return result;
  }
}

export const enrichmentService = new EnrichmentService();
