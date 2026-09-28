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
  extractedAt: string;
  platformData: BridgePlatformData;
}

export class EnrichmentService {
  private cacheFile: string;
  private cache: Record<string, AccountStatus> = {}; // key: `${accountId}:${providerId}`
  private pendingSyncs: Map<string, number> = new Map(); // key: `${accountId}:${providerId}`, value: timestamp

  constructor() {
    const configDir = process.env.HUBAI_CONFIG_DIR || path.join(os.homedir(), '.config', 'hubai');
    fs.mkdirSync(configDir, { recursive: true });
    this.cacheFile = path.join(configDir, 'enrichment-cache.json');
    this.loadCache();
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

  /**
   * Registers a sync request for a given account and provider.
   * Sets syncState to 'syncing' and registers pending sync for bridge polling.
   */
  public requestSync(accountId: string, providerId: string): AccountStatus {
    const config = configManager.getConfig();
    const account = config.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error(`Conta com ID "${accountId}" não encontrada.`);
    }

    const syncKey = `${accountId}:${providerId}`;
    this.pendingSyncs.set(syncKey, Date.now());

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(providerId);
    const existing = this.cache[syncKey];

    const syncingStatus: AccountStatus = {
      accountId: account.id,
      providerId: providerId,
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
    const syncKey = `${accountId}:${providerId}`;
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
    const syncKey = `${accountId}:${providerId}`;
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

    const providerId = report.providerId;
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
    const key = `${account.id}:${providerId}`;
    let cached = this.cache[key];

    if (forceSync) {
      return this.requestSync(account.id, providerId);
    }

    if (cached) {
      if (cached.syncState === 'syncing') {
        const syncKey = `${account.id}:${providerId}`;
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

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(providerId);

    // Default status when no DOM payload has been received yet
    const fallback: AccountStatus = {
      accountId: account.id,
      providerId,
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
    const config = configManager.getConfig();
    const result: Record<string, AccountStatus> = {};

    for (const account of config.accounts) {
      result[account.id] = await this.getAccountStatus(account, providerId, forceSync);
    }

    return result;
  }
}

export const enrichmentService = new EnrichmentService();
