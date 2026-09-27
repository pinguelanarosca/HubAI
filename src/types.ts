export interface AIProvider {
  id: string;
  name: string;
  shortName: string;
  defaultUrl: string;
  category: 'general' | 'reasoning' | 'code' | 'multimodal';
  icon: string; // icon identifier or logo key
  description: string;
  badge?: string;
  enabled: boolean;
  order: number;
}

export interface HubAccount {
  id: string;
  name: string;
  email: string;
  chromeProfileDir: string; // e.g. "Default", "Profile 1", "Profile 2"
  color: string; // Hex color for visual distinction
  avatarIcon: string; // e.g. "User", "Briefcase", "Code", "Brain", "Sparkles", "Layers", "Cpu", "Globe", "Shield"
  customUrls?: Record<string, string>; // providerId -> custom URL override
  notes?: string;
  order: number;
  lastUsedAt?: string;
}

export interface SystemConfig {
  browserCommand: string; // e.g. "google-chrome", "google-chrome-stable", "chromium", "brave-browser"
  chromeUserDataDir: string; // e.g. "~/.config/google-chrome"
  openInNewWindow: boolean;
  additionalFlags: string[];
  theme: 'dark';
}

export interface HubConfig {
  version: number;
  system: SystemConfig;
  providers: AIProvider[];
  accounts: HubAccount[];
}

export interface DetectedProfile {
  dirName: string; // "Default", "Profile 1", etc.
  fullPath: string;
  displayName?: string;
  email?: string;
  avatarIcon?: string;
  exists: boolean;
  isLocked?: boolean;
}

export interface DiagnosticCheckItem {
  id: string;
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'pending';
  message: string;
  details?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallStatus: 'passed' | 'warning' | 'failed';
  browserCheck: DiagnosticCheckItem;
  userDataDirCheck: DiagnosticCheckItem;
  accountsProfileCheck: {
    accountId: string;
    accountName: string;
    profileDir: string;
    status: 'passed' | 'warning' | 'failed';
    message: string;
    path: string;
  }[];
  urlCheck: {
    providerId: string;
    providerName: string;
    url: string;
    status: 'passed' | 'warning' | 'failed';
    message: string;
  }[];
  isolationCheck: DiagnosticCheckItem;
  logs: string[];
}

export interface LaunchRequest {
  accountId: string;
  providerId: string;
  targetUrl?: string;
  dryRun?: boolean;
}

export interface LaunchResult {
  success: boolean;
  command: string;
  providerName: string;
  accountName: string;
  profileDir: string;
  targetUrl: string;
  timestamp: string;
  mode: 'executed' | 'command_generated' | 'dry_run';
  message: string;
  warning?: string;
}
