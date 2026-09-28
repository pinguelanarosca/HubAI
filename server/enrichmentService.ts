import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  HubAccount,
  AccountStatus,
  ProjectSummary,
  ChatSummary,
  UsageStatus,
  HistoryLogItem
} from '../src/types.js';
import { configManager } from './configManager.js';

export interface BridgePlatformData {
  accountName?: string;
  accountEmail?: string;
  profilePictureUrl?: string;
  planName?: string;
  hasProjectsConcept?: boolean;
  projects?: ProjectSummary[];
  recentChats?: ChatSummary[];
  usage?: Partial<UsageStatus>;
}

export interface BridgeSyncReport {
  providerId: string;
  accountId: string;
  chromeProfileDir?: string;
  url?: string;
  title?: string;
  extractedAt: string;
  platformData: BridgePlatformData;
}

export class EnrichmentService {
  private cacheFile: string;
  private cache: Record<string, AccountStatus> = {}; // key: `${accountId}:${providerId}`
  private pendingSyncs: Map<string, number> = new Map(); // key: `${accountId}:${providerId}`, value: timestamp
  private historyFile: string;
  private historyCache: Record<string, HistoryLogItem[]> = {}; // key: `${accountId}:${providerId}`

  constructor() {
    const configDir = process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
    fs.mkdirSync(configDir, { recursive: true });
    this.cacheFile = path.join(configDir, 'enrichment-cache.json');
    this.historyFile = path.join(configDir, 'history-cache.json');
    this.loadCache();
    this.loadHistory();
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

  private loadHistory() {
    if (fs.existsSync(this.historyFile)) {
      try {
        const raw = fs.readFileSync(this.historyFile, 'utf-8');
        this.historyCache = JSON.parse(raw);
      } catch (err) {
        console.warn('[EnrichmentService] Erro ao carregar cache de histórico:', err);
        this.historyCache = {};
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

  private saveHistory() {
    try {
      const dir = path.dirname(this.historyFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.historyFile, JSON.stringify(this.historyCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[EnrichmentService] Erro ao salvar cache de histórico:', err);
    }
  }

  public normalizeProviderId(providerId: string): string {
    if (!providerId) return providerId;
    const lower = providerId.toLowerCase();
    if (lower === 'chatgpt') return 'openai';
    if (lower === 'meta_ai') return 'meta';
    return lower;
  }

  /**
   * Registers a sync request for a given account and provider.
   * Sets syncState to 'syncing' and registers pending sync for bridge polling.
   */
  public requestSync(accountId: string, providerId: string): AccountStatus {
    const normProviderId = this.normalizeProviderId(providerId);
    const config = configManager.getConfig();
    const account = config.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error(`Conta com ID "${accountId}" não encontrada.`);
    }

    const syncKey = `${accountId}:${normProviderId}`;
    this.pendingSyncs.set(syncKey, Date.now());

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(normProviderId);
    const existing = this.cache[syncKey];

    const syncingStatus: AccountStatus = {
      accountId: account.id,
      providerId: normProviderId,
      accountName: existing?.accountName || account.name || '--',
      accountEmail: existing?.accountEmail || account.email || '--',
      profilePictureUrl: existing?.profilePictureUrl,
      planName: existing?.planName || '--',
      hasProjectsConcept,
      projects: existing?.projects || [],
      recentChats: existing?.recentChats || [],
      usage: existing?.usage || {
        limitStatus: 'unknown',
        limitLabel: '--',
        resetTime: '--',
        details: 'Aguardando coleta na aba do Chrome...'
      },
      lastSyncAt: existing?.lastSyncAt || '--',
      syncState: 'syncing',
      syncMessage: 'Sincronizando... Solicitação enviada à aba aberta do Chrome'
    };

    this.cache[syncKey] = syncingStatus;
    this.saveCache();

    return syncingStatus;
  }

  /**
   * Checks if a sync request is pending for the given account and provider.
   */
  public isSyncPending(accountId: string, providerId: string): boolean {
    const normProviderId = this.normalizeProviderId(providerId);
    const syncKey = `${accountId}:${normProviderId}`;
    const timestamp = this.pendingSyncs.get(syncKey);
    if (!timestamp) return false;

    // Expire sync requests after 60 seconds
    if (Date.now() - timestamp > 60000) {
      this.pendingSyncs.delete(syncKey);
      return false;
    }
    return true;
  }

  public clearPendingSync(accountId: string, providerId: string) {
    const normProviderId = this.normalizeProviderId(providerId);
    const syncKey = `${accountId}:${normProviderId}`;
    this.pendingSyncs.delete(syncKey);
  }

  /**
   * Processes a real DOM payload sent from the Chrome Extension / Web Bridge
   * attached to the authenticated tab of an AI platform.
   *
   * STRICT SECURITY: Rejects any report without a valid matching accountId.
   */
  public processBridgeReport(report: BridgeSyncReport): { success: boolean; accountId?: string; status?: AccountStatus; error?: string } {
    if (!report || !report.accountId || typeof report.accountId !== 'string') {
      return {
        success: false,
        error: 'Relatório rejeitado: accountId ausente ou inválido.'
      };
    }

    const config = configManager.getConfig();
    const account = config.accounts.find(a => a.id === report.accountId);

    if (!account) {
      return {
        success: false,
        error: `Relatório rejeitado: conta com ID "${report.accountId}" não foi encontrada no HubAI.`
      };
    }

    const rawProviderId = report.providerId;
    const providerId = this.normalizeProviderId(rawProviderId);
    const key = `${account.id}:${providerId}`;
    const pData = report.platformData || {};
    const now = report.extractedAt || new Date().toISOString();

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(providerId);

    const updatedStatus: AccountStatus = {
      accountId: account.id,
      providerId: providerId,
      accountName: pData.accountName || account.name || '--',
      accountEmail: pData.accountEmail || account.email || '--',
      profilePictureUrl: pData.profilePictureUrl || undefined,
      planName: pData.planName || '--',
      hasProjectsConcept: hasProjectsConcept,
      projects: pData.projects || [],
      recentChats: pData.recentChats || [],
      usage: {
        limitStatus: pData.usage?.limitStatus || 'unknown',
        limitLabel: pData.usage?.limitLabel || '--',
        resetTime: pData.usage?.resetTime || '--',
        details: pData.usage?.details || 'Coletado da interface web da plataforma'
      },
      lastSyncAt: now,
      syncState: 'synced',
      syncMessage: `Sincronizado em tempo real da página (${new Date(now).toLocaleTimeString()})`
    };

    this.clearPendingSync(account.id, providerId);
    this.cache[key] = updatedStatus;
    this.saveCache();

    // Capture accessed URL/title history if it matches the active provider criteria
    const url = report.url;
    const title = report.title || '';
    if (url && this.urlMatchesProvider(url, providerId)) {
      const historyKey = `${account.id}:${providerId}`;
      const logs = this.historyCache[historyKey] || [];
      const lastLog = logs[logs.length - 1];
      
      // Append a new log item only if the URL or title changed
      if (!lastLog || lastLog.url !== url || lastLog.title !== title) {
        logs.push({
          timestamp: new Date().toISOString(),
          url,
          title
        });
        this.historyCache[historyKey] = logs;
        this.saveHistory();
        console.log(`[EnrichmentService] Histórico registrado para ${historyKey}:`, { url, title });
      }
    }

    console.log(`[EnrichmentService] Relatório DOM verificado para conta "${account.name}" (${providerId}):`, updatedStatus);

    return {
      success: true,
      accountId: account.id,
      status: updatedStatus
    };
  }

  /**
   * Returns AccountStatus for a given account and provider.
   */
  public async getAccountStatus(account: HubAccount, providerId: string, forceSync: boolean = false): Promise<AccountStatus> {
    const normProviderId = this.normalizeProviderId(providerId);
    const key = `${account.id}:${normProviderId}`;
    let cached = this.cache[key];

    if (forceSync) {
      return this.requestSync(account.id, normProviderId);
    }

    if (cached) {
      if (cached.syncState === 'syncing') {
        const syncKey = `${account.id}:${normProviderId}`;
        const timestamp = this.pendingSyncs.get(syncKey);
        if (!timestamp || (Date.now() - timestamp > 15000)) {
          this.pendingSyncs.delete(syncKey);
          cached.syncState = 'unavailable';
          cached.syncMessage = 'Tempo limite esgotado. A aba da plataforma não respondeu.';
          cached.usage = {
            limitStatus: 'unknown',
            limitLabel: '--',
            resetTime: '--',
            details: 'Certifique-se de que a aba da plataforma está aberta e ativa.'
          };
          this.cache[key] = cached;
          this.saveCache();
        }
      }
      return cached;
    }

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(normProviderId);

    // Default status when no DOM payload has been received yet
    const fallback: AccountStatus = {
      accountId: account.id,
      providerId: normProviderId,
      accountName: account.name || '--',
      accountEmail: account.email || '--',
      profilePictureUrl: undefined,
      planName: '--',
      hasProjectsConcept,
      projects: [],
      recentChats: [],
      usage: {
        limitStatus: 'unknown',
        limitLabel: '--',
        resetTime: '--',
        details: 'Aba da plataforma não aberta'
      },
      lastSyncAt: '--',
      syncState: 'unavailable',
      syncMessage: 'Abra a janela para sincronizar os dados reais da interface'
    };

    return fallback;
  }

  public async getAllAccountsStatus(providerId: string = 'chatgpt', forceSync: boolean = false): Promise<Record<string, AccountStatus>> {
    const normProviderId = this.normalizeProviderId(providerId);
    const config = configManager.getConfig();
    const result: Record<string, AccountStatus> = {};

    for (const account of config.accounts) {
      result[account.id] = await this.getAccountStatus(account, normProviderId, forceSync);
    }

    return result;
  }

  public urlMatchesProvider(url: string, providerId: string): boolean {
    if (!url) return false;
    const normProviderId = this.normalizeProviderId(providerId);
    const normalizedUrl = url.toLowerCase();
    
    switch (normProviderId) {
      case 'gemini':
        return normalizedUrl.includes('gemini') || normalizedUrl.includes('google');
      case 'openai':
        return normalizedUrl.includes('chatgpt') || normalizedUrl.includes('openai');
      case 'claude':
        return normalizedUrl.includes('claude') || normalizedUrl.includes('anthropic');
      case 'meta':
        return normalizedUrl.includes('meta') || normalizedUrl.includes('llama');
      case 'grok':
        return normalizedUrl.includes('grok') || normalizedUrl.includes('spacex') || normalizedUrl.includes('x.com') || normalizedUrl.includes('x.ai') || normalizedUrl.includes('twitter');
      case 'ai_studios':
        return normalizedUrl.includes('aistudio') || normalizedUrl.includes('google');
      default:
        return normalizedUrl.includes(normProviderId.toLowerCase());
    }
  }

  public getHistory(accountId: string, providerId: string): HistoryLogItem[] {
    const normProviderId = this.normalizeProviderId(providerId);
    const key = `${accountId}:${normProviderId}`;
    return this.historyCache[key] || [];
  }

  public clearHistory(accountId: string, providerId: string) {
    const normProviderId = this.normalizeProviderId(providerId);
    const key = `${accountId}:${normProviderId}`;
    this.historyCache[key] = [];
    this.saveHistory();
  }

  public resolvePath(filePath: string): string {
    if (!filePath) return path.join(os.homedir(), '.config', 'google-chrome');
    if (filePath.startsWith('~/') || filePath === '~') {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return path.resolve(filePath);
  }

  public getKeywordsForProvider(providerId: string): string[] {
    const norm = this.normalizeProviderId(providerId);
    switch (norm) {
      case 'gemini':
        return ['gemini.google.com', 'gemini', 'gemini-live', 'google'];
      case 'openai':
        return ['chatgpt.com', 'chatgpt', 'openai'];
      case 'claude':
        return ['claude.ai', 'claude', 'anthropic'];
      case 'meta':
        return ['meta.ai', 'meta', 'llama'];
      case 'grok':
        return ['grok.com', 'grok', 'spacex', 'x.com', 'x.ai', 'twitter'];
      case 'ai_studios':
        return ['aistudio.google.com', 'aistudio', 'google'];
      default:
        return [norm];
    }
  }

  public async refreshHistory(accountId: string, providerId: string): Promise<HistoryLogItem[]> {
    const normProviderId = this.normalizeProviderId(providerId);
    const config = configManager.getConfig();
    const account = config.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error(`Conta com ID "${accountId}" não encontrada.`);
    }

    const defaultDir = path.join(os.homedir(), '.config', 'google-chrome');
    const userDir = account.userDataDir ? this.resolvePath(account.userDataDir) : defaultDir;
    const historyPath = path.join(userDir, account.chromeProfileDir, 'History');

    if (!fs.existsSync(historyPath)) {
      console.warn(`[EnrichmentService] Arquivo de histórico não existe em: ${historyPath}`);
      return this.getHistory(accountId, normProviderId);
    }

    const keywords = this.getKeywordsForProvider(normProviderId);
    
    try {
      const { execFileSync } = await import('child_process');
      const scriptPath = path.resolve(process.cwd(), 'server', 'readHistory.py');
      const output = execFileSync('python3', [scriptPath, historyPath, JSON.stringify(keywords)], { encoding: 'utf-8' });
      const data = JSON.parse(output.trim());
      
      if (data.success && Array.isArray(data.history)) {
        const key = `${accountId}:${normProviderId}`;
        this.historyCache[key] = data.history;
        this.saveHistory();
        return data.history;
      } else if (data.error) {
        console.error('[EnrichmentService] Erro do script Python de histórico:', data.error);
      }
    } catch (err: any) {
      console.error('[EnrichmentService] Erro ao executar script Python de histórico:', err.message);
    }

    return this.getHistory(accountId, normProviderId);
  }
}

export const enrichmentService = new EnrichmentService();
