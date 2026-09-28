import {
  HubConfig,
  LaunchRequest,
  LaunchResult,
  DiagnosticReport,
  DetectedProfile,
  ProfileSyncResult,
  ProfileImportBinding,
  BrowserVariant,
  UpdateStatus,
  UpdateApplyResult,
  AccountStatus,
  HistoryLogItem
} from '../types.js';

export async function fetchHubConfig(): Promise<HubConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) {
    throw new Error(`Erro ao carregar configurações: ${res.statusText}`);
  }
  const data = await res.json();
  return data.config;
}

export async function saveHubConfig(config: HubConfig): Promise<HubConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro ao salvar configurações: ${res.statusText}`);
  }
  return data.config;
}

export async function resetHubConfig(): Promise<HubConfig> {
  const res = await fetch('/api/config/reset', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro ao redefinir configurações: ${res.statusText}`);
  }
  return data.config;
}

export async function exportConfigBackup(): Promise<HubConfig> {
  const res = await fetch('/api/config/backup');
  if (!res.ok) {
    throw new Error('Falha ao exportar backup de configuração');
  }
  return await res.json();
}

export async function restoreConfigBackup(backupData: any): Promise<HubConfig> {
  const res = await fetch('/api/config/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao restaurar backup de configuração');
  }
  return data.config;
}

export async function fetchSystemProfiles(userDataDir?: string): Promise<{
  availableBinaries: string[];
  recommendedBinary: string;
  defaultUserDataDir: string;
  userDataDirExists: boolean;
  detectedProfiles: DetectedProfile[];
}> {
  const url = userDataDir
    ? `/api/profiles/detect?userDataDir=${encodeURIComponent(userDataDir)}`
    : '/api/profiles/detect';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Erro ao escanear perfis do Chrome');
  }
  const data = await res.json();
  return data.data;
}

export async function syncChromeAccounts(userDataDir?: string): Promise<ProfileSyncResult> {
  const url = userDataDir
    ? `/api/profiles/sync?userDataDir=${encodeURIComponent(userDataDir)}`
    : '/api/profiles/sync';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Falha ao sincronizar contas do Chrome');
  }
  const data = await res.json();
  return data.sync;
}

export async function importMatchedProfiles(bindings: ProfileImportBinding[]): Promise<{
  updatedAccountsCount: number;
  config: HubConfig;
}> {
  const res = await fetch('/api/profiles/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bindings })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao importar perfis do Chrome');
  }
  return data;
}

export async function fetchBrowserVariants(): Promise<BrowserVariant[]> {
  const res = await fetch('/api/system/browser-variants');
  if (!res.ok) {
    throw new Error('Falha ao detectar variantes do navegador');
  }
  const data = await res.json();
  return data.variants;
}

export async function fetchAccountHistory(accountId: string, providerId: string): Promise<HistoryLogItem[]> {
  const res = await fetch(`/api/accounts/${accountId}/history?providerId=${encodeURIComponent(providerId)}`);
  if (!res.ok) {
    throw new Error('Falha ao buscar histórico de URLs');
  }
  const data = await res.json();
  return data.history || [];
}

export async function clearAccountHistory(accountId: string, providerId: string): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/history/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId })
  });
  if (!res.ok) {
    throw new Error('Falha ao limpar histórico de URLs');
  }
}

export async function launchPlatform(req: LaunchRequest): Promise<LaunchResult> {
  const res = await fetch('/api/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha na requisição de abertura');
  }
  return data.result;
}

export async function runDiagnostics(): Promise<DiagnosticReport> {
  const res = await fetch('/api/diagnose', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Falha ao executar diagnóstico');
  }
  const data = await res.json();
  return data.report;
}

export async function fetchUpdateStatus(force: boolean = false): Promise<UpdateStatus> {
  const res = await fetch(force ? '/api/update/check' : '/api/update/status', {
    method: force ? 'POST' : 'GET'
  });
  if (!res.ok) {
    throw new Error('Falha ao verificar atualizações do HubAI');
  }
  const data = await res.json();
  return data.status;
}

export async function applyHubUpdate(): Promise<UpdateApplyResult> {
  const res = await fetch('/api/update/apply', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Falha ao aplicar atualização');
  }
  return data.result;
}

export async function exportDesktopShortcuts(): Promise<{
  totalShortcuts: number;
  installedCount: number;
  errors?: string[];
  shortcutsPreview: { path: string; content: string }[];
}> {
  const res = await fetch('/api/export/desktop-shortcuts', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Falha ao exportar atalhos desktop');
  }
  return await res.json();
}

export interface UninstallInfo {
  paths: {
    binary: string;
    installDir: string;
    updater: string;
    desktopFile: string;
    configDir: string;
    configFile: string;
    logsDir: string;
    backupsDir: string;
  };
  commands: {
    standard: string;
    purge: string;
    cliPurge: string;
    curlPurge: string;
  };
}

export async function fetchUninstallInfo(): Promise<UninstallInfo> {
  const res = await fetch('/api/system/uninstall-info');
  if (!res.ok) {
    throw new Error('Falha ao obter informações do desinstalador');
  }
  const data = await res.json();
  return {
    paths: data.paths,
    commands: data.commands
  };
}

export async function requestSystemUninstall(purge: boolean = false): Promise<{
  success: boolean;
  message: string;
  purge: boolean;
}> {
  const res = await fetch('/api/system/uninstall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purge })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao acionar desinstalação');
  }
  return data;
}

export async function fetchAccountEnrichments(providerId: string = 'chatgpt', force: boolean = false): Promise<Record<string, AccountStatus>> {
  const url = `/api/accounts/enrichment?providerId=${encodeURIComponent(providerId)}${force ? '&force=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Falha ao carregar informações enriquecidas das contas');
  }
  const data = await res.json();
  return data.statuses;
}

export async function syncAccountStatus(accountId: string, providerId: string = 'chatgpt'): Promise<AccountStatus> {
  const res = await fetch(`/api/accounts/${accountId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao sincronizar conta');
  }
  return data.status;
}

