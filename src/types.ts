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
  userDataDir?: string; // Optional custom user data directory for this account
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
  userDataDir: string;
  fullPath: string;
  displayName?: string;
  email?: string;
  avatarIcon?: string;
  gaiaId?: string;
  exists: boolean;
  isLocked?: boolean;
  lockPid?: number;
  browserType?: string; // e.g. "Google Chrome", "Chromium", "Google Chrome Beta"
}

export interface BrowserVariant {
  name: string;
  id: string;
  userDataDir: string;
  binaryCommand: string;
  detectedBinary?: string;
  alternativeBinaries?: string[];
  exists: boolean;
  profileCount: number;
}

export interface ProfileSyncMatch {
  detectedProfile: DetectedProfile;
  matchedAccountId?: string;
  suggestedAccountId?: string;
  matchType: 'email' | 'name' | 'directory' | 'manual' | 'none';
  confidence: 'high' | 'medium' | 'low';
  currentAccount?: HubAccount;
}

export interface ProfileSyncResult {
  userDataDir: string;
  detectedProfiles: DetectedProfile[];
  currentAccounts: HubAccount[];
  matches: ProfileSyncMatch[];
  unmatchedProfiles: DetectedProfile[];
  unmatchedAccounts: HubAccount[];
  browserVariants: BrowserVariant[];
  stats: {
    totalDetected: number;
    totalConfigured: number;
    matchedCount: number;
    unmatchedDetectedCount: number;
    unmatchedAccountsCount: number;
  };
}

export interface ProfileImportBinding {
  accountId: string;
  profileDir: string;
  userDataDir?: string;
  name?: string;
  email?: string;
  color?: string;
  avatarIcon?: string;
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
    userDataDir?: string;
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
  summary: {
    discoveredProfilesCount: number;
    linkedAccountsCount: number;
    unlinkedProfilesCount: number;
    unlinkedAccountsCount: number;
    duplicateProfiles: string[];
    lockedProfiles: string[];
    userDataDirUsed: string;
  };
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
  userDataDir?: string;
  targetUrl: string;
  timestamp: string;
  mode: 'executed' | 'command_generated' | 'dry_run';
  message: string;
  warning?: string;
}

export interface UpdateStatus {
  installedCommit: string;
  installedCommitDate?: string;
  latestCommit: string;
  latestCommitDate?: string;
  hasUpdate: boolean;
  lastChecked: string;
  currentVersion: string;
  remoteVersion?: string;
  repoUrl: string;
  commitMessage?: string;
  releaseNotes?: string;
  error?: string;
}

export interface UpdateApplyResult {
  success: boolean;
  message: string;
  backupPath?: string;
  previousCommit?: string;
  newCommit?: string;
  logs?: string[];
  error?: string;
}
