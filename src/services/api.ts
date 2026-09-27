import { HubConfig, LaunchRequest, LaunchResult, DiagnosticReport, DetectedProfile } from '../types.js';

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

export async function fetchSystemProfiles(userDataDir?: string): Promise<{
  availableBinaries: string[];
  recommendedBinary: string;
  defaultUserDataDir: string;
  userDataDirExists: boolean;
  detectedProfiles: DetectedProfile[];
}> {
  const url = userDataDir
    ? `/api/system/profiles?userDataDir=${encodeURIComponent(userDataDir)}`
    : '/api/system/profiles';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Erro ao escanear perfis do Chrome');
  }
  const data = await res.json();
  return data.data;
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
