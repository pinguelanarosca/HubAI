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
  accountId?: string;
  chromeProfileDir?: string;
  url?: string;
  extractedAt: string;
  platformData: BridgePlatformData;
}

export class EnrichmentService {
  private cacheFile: string;
  private cache: Record<string, AccountStatus> = {}; // key: `${accountId}:${providerId}`

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
   * Processes a real DOM payload sent from the Chrome Extension / Web Bridge
   * attached to the authenticated tab of an AI platform.
   */
  public processBridgeReport(report: BridgeSyncReport): { success: boolean; accountId?: string; status?: AccountStatus } {
    const config = configManager.getConfig();

    // Match account by accountId OR by active provider
    let account = config.accounts.find(a => a.id === report.accountId);
    if (!account) {
      // Find account matching chromeProfileDir or first account
      if (report.chromeProfileDir) {
        account = config.accounts.find(a => a.chromeProfileDir === report.chromeProfileDir);
      }
      if (!account && config.accounts.length > 0) {
        account = config.accounts[0];
      }
    }

    if (!account) {
      return { success: false };
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

    this.cache[key] = updatedStatus;
    this.saveCache();

    console.log(`[EnrichmentService] Relatório DOM recebido para conta "${account.name}" (${providerId}):`, updatedStatus);

    return {
      success: true,
      accountId: account.id,
      status: updatedStatus
    };
  }

  /**
   * Returns AccountStatus for a given account and provider.
   * If a real bridge report has been received, returns the real collected data.
   * Otherwise returns a clean status indicating waiting for active tab connection with '--' for missing fields.
   */
  public async getAccountStatus(account: HubAccount, providerId: string, forceSync: boolean = false): Promise<AccountStatus> {
    const key = `${account.id}:${providerId}`;
    const cached = this.cache[key];

    if (cached && !forceSync) {
      return cached;
    }

    const hasProjectsConcept = ['chatgpt', 'claude', 'openai'].includes(providerId);

    if (cached && forceSync) {
      // Preserve last valid state on sync attempt if no new live bridge payload was sent yet
      cached.syncState = 'cached';
      cached.syncMessage = 'Aguardando atualização da página autenticada no Chrome';
      return cached;
    }

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
