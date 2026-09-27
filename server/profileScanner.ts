import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  DetectedProfile,
  BrowserVariant,
  ProfileSyncResult,
  ProfileSyncMatch,
  ProfileImportBinding,
  HubAccount
} from '../src/types.js';
import { configManager, ConfigManager } from './configManager.js';

export interface SystemBrowserInfo {
  availableBinaries: string[];
  recommendedBinary: string;
  defaultUserDataDir: string;
  userDataDirExists: boolean;
  detectedProfiles: DetectedProfile[];
  singletonLockActive: boolean;
  singletonLockPid?: number;
  browserVariants: BrowserVariant[];
}

export class ProfileScanner {
  private configManager: ConfigManager;

  constructor(cfgManager?: ConfigManager) {
    this.configManager = cfgManager || configManager;
  }

  // Resolve tilde '~' in paths safely
  public resolvePath(filePath: string): string {
    if (!filePath) return path.join(os.homedir(), '.config', 'google-chrome');
    if (filePath.startsWith('~/') || filePath === '~') {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return path.resolve(filePath);
  }

  public detectBrowserBinaries(): string[] {
    const candidates = [
      'google-chrome',
      'google-chrome-stable',
      'google-chrome-beta',
      'google-chrome-unstable',
      'chromium',
      'chromium-browser',
      'brave-browser',
      'brave',
      'microsoft-edge',
      'microsoft-edge-stable',
      'microsoft-edge-beta',
      'microsoft-edge-dev'
    ];
    const available: string[] = [];

    for (const bin of candidates) {
      try {
        const out = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        if (out) {
          available.push(bin);
        }
      } catch {
        // Not found on PATH, ignore
      }
    }

    return available;
  }

  /**
   * Detects known Chromium-based browser installations and directories on Linux.
   */
  public detectBrowserVariants(): BrowserVariant[] {
    const home = os.homedir();
    const candidates: { id: string; name: string; dir: string; binary: string; alternativeBinaries?: string[] }[] = [
      {
        id: 'chrome-stable',
        name: 'Google Chrome',
        dir: path.join(home, '.config', 'google-chrome'),
        binary: 'google-chrome',
        alternativeBinaries: ['google-chrome-stable']
      },
      {
        id: 'chrome-beta',
        name: 'Google Chrome Beta',
        dir: path.join(home, '.config', 'google-chrome-beta'),
        binary: 'google-chrome-beta'
      },
      {
        id: 'chrome-unstable',
        name: 'Google Chrome Dev',
        dir: path.join(home, '.config', 'google-chrome-unstable'),
        binary: 'google-chrome-unstable'
      },
      {
        id: 'chromium',
        name: 'Chromium',
        dir: path.join(home, '.config', 'chromium'),
        binary: 'chromium',
        alternativeBinaries: ['chromium-browser']
      },
      {
        id: 'brave',
        name: 'Brave Browser',
        dir: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser'),
        binary: 'brave-browser',
        alternativeBinaries: ['brave']
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        dir: path.join(home, '.config', 'microsoft-edge'),
        binary: 'microsoft-edge',
        alternativeBinaries: ['microsoft-edge-stable', 'microsoft-edge-beta', 'microsoft-edge-dev']
      }
    ];

    const availableBins = new Set(this.detectBrowserBinaries());

    return candidates.map(c => {
      const exists = fs.existsSync(c.dir);
      let profileCount = 0;
      if (exists) {
        try {
          const entries = fs.readdirSync(c.dir, { withFileTypes: true });
          profileCount = entries.filter(e =>
            e.isDirectory() && (e.name === 'Default' || e.name.startsWith('Profile '))
          ).length;
        } catch {
          profileCount = 0;
        }
      }

      // Check which binary is actually available on PATH for assisted selection
      let detectedBinary: string | undefined = undefined;
      if (availableBins.has(c.binary)) {
        detectedBinary = c.binary;
      } else if (c.alternativeBinaries) {
        const found = c.alternativeBinaries.find(b => availableBins.has(b));
        if (found) {
          detectedBinary = found;
        }
      }

      return {
        id: c.id,
        name: c.name,
        userDataDir: c.dir,
        binaryCommand: c.binary,
        detectedBinary,
        alternativeBinaries: c.alternativeBinaries || [],
        exists,
        profileCount
      };
    });
  }

  /**
   * Scans exclusively real Chrome/Chromium user profiles on the host filesystem.
   * Reads metadata ONLY from Local State and Preferences files.
   * NEVER extracts passwords, cookies, encryption keys, tokens, or session secrets.
   */
  public scanProfiles(customUserDataDir?: string): {
    targetDir: string;
    userDataDirExists: boolean;
    profiles: DetectedProfile[];
    singletonLockActive: boolean;
    singletonLockPid?: number;
  } {
    const defaultChromeDir = path.join(os.homedir(), '.config', 'google-chrome');
    const targetDir = customUserDataDir ? this.resolvePath(customUserDataDir) : defaultChromeDir;

    if (!fs.existsSync(targetDir)) {
      return {
        targetDir,
        userDataDirExists: false,
        profiles: [],
        singletonLockActive: false
      };
    }

    // Check SingletonLock in user-data-dir
    const lockPath = path.join(targetDir, 'SingletonLock');
    let singletonLockActive = false;
    let singletonLockPid: number | undefined;

    if (fs.existsSync(lockPath)) {
      try {
        const linkTarget = fs.readlinkSync(lockPath);
        const parts = linkTarget.split('-');
        const pidStr = parts[parts.length - 1];
        const parsedPid = parseInt(pidStr, 10);
        if (!isNaN(parsedPid) && parsedPid > 0) {
          singletonLockPid = parsedPid;
          try {
            process.kill(parsedPid, 0);
            singletonLockActive = true;
          } catch {
            singletonLockActive = false;
          }
        } else {
          singletonLockActive = true;
        }
      } catch {
        singletonLockActive = true;
      }
    }

    const profiles: DetectedProfile[] = [];

    // Determine browser label based on target directory
    let browserType = 'Google Chrome';
    if (targetDir.includes('chromium')) {
      browserType = 'Chromium';
    } else if (targetDir.includes('google-chrome-beta')) {
      browserType = 'Google Chrome Beta';
    } else if (targetDir.includes('google-chrome-unstable')) {
      browserType = 'Google Chrome Dev';
    } else if (targetDir.includes('Brave')) {
      browserType = 'Brave Browser';
    }

    try {
      const localStatePath = path.join(targetDir, 'Local State');
      let localStateInfoCache: Record<string, any> = {};

      if (fs.existsSync(localStatePath)) {
        try {
          const raw = fs.readFileSync(localStatePath, 'utf-8');
          const data = JSON.parse(raw);
          localStateInfoCache = data?.profile?.info_cache || {};
        } catch {
          // Ignore parse errors on corrupt file
        }
      }

      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;

        // Verify if entry is a valid Chrome profile folder
        if (name === 'Default' || name.startsWith('Profile ') || localStateInfoCache[name]) {
          const fullPath = path.join(targetDir, name);
          const cached = localStateInfoCache[name] || {};

          let email = cached.user_name || undefined;
          let displayName = cached.name || undefined;
          let gaiaId = cached.gaia_id || undefined;
          let avatarIcon = cached.avatar_icon || undefined;

          // Read Preferences file if available in profile folder for additional display info
          const prefPath = path.join(fullPath, 'Preferences');
          if (fs.existsSync(prefPath)) {
            try {
              const pRaw = fs.readFileSync(prefPath, 'utf-8');
              const pData = JSON.parse(pRaw);
              displayName = displayName || pData?.profile?.name;
              email = email || pData?.account_info?.[0]?.email || pData?.sync?.account_id;
              gaiaId = gaiaId || pData?.account_info?.[0]?.gaia_id;
            } catch {
              // Ignore preference parse errors
            }
          }

          // Check for profile lock
          const profileLock = path.join(fullPath, 'LOCK');
          const isLocked = fs.existsSync(profileLock) || singletonLockActive;

          profiles.push({
            dirName: name,
            userDataDir: targetDir,
            fullPath,
            displayName: displayName || (name === 'Default' ? 'Default Profile' : name),
            email: email || undefined,
            avatarIcon,
            gaiaId,
            exists: true,
            isLocked,
            lockPid: singletonLockPid,
            browserType
          });
        }
      }

      // Sort profiles: Default first, then numerical Profile 1, Profile 2, etc.
      profiles.sort((a, b) => {
        if (a.dirName === 'Default') return -1;
        if (b.dirName === 'Default') return 1;
        const numA = parseInt(a.dirName.replace(/\D/g, ''), 10) || 999;
        const numB = parseInt(b.dirName.replace(/\D/g, ''), 10) || 999;
        return numA - numB;
      });
    } catch (err) {
      console.error('[ProfileScanner] Erro ao escanear perfis reais do Chrome:', err);
    }

    return {
      targetDir,
      userDataDirExists: true,
      profiles,
      singletonLockActive,
      singletonLockPid
    };
  }

  /**
   * Compares real discovered Chrome profiles with Hub accounts.
   * Matches by:
   * 1. Exact email (case-insensitive)
   * 2. Display name (case-insensitive)
   * 3. Directory name (exact)
   */
  public syncAccountsWithProfiles(customUserDataDir?: string, customAccounts?: HubAccount[], cfgMgr?: ConfigManager): ProfileSyncResult {
    const mgr = cfgMgr || this.configManager;
    const config = mgr.getConfig();
    const currentAccounts = customAccounts || config.accounts;
    const targetUserDir = customUserDataDir || config.system.chromeUserDataDir;
    const scan = this.scanProfiles(targetUserDir);
    const browserVariants = this.detectBrowserVariants();

    const detectedProfiles = scan.profiles;

    const matchedAccountIds = new Set<string>();
    const matchedProfileDirs = new Set<string>();
    const matches: ProfileSyncMatch[] = [];

    // Priority 1: Match by Email (case-insensitive)
    for (const detected of detectedProfiles) {
      if (!detected.email) continue;
      const detectedEmail = detected.email.toLowerCase().trim();

      const candidateAccount = currentAccounts.find(acc => {
        if (matchedAccountIds.has(acc.id)) return false;
        return acc.email && acc.email.toLowerCase().trim() === detectedEmail;
      });

      if (candidateAccount) {
        matchedAccountIds.add(candidateAccount.id);
        matchedProfileDirs.add(detected.dirName);
        matches.push({
          detectedProfile: detected,
          matchedAccountId: candidateAccount.id,
          matchType: 'email',
          confidence: 'high',
          currentAccount: candidateAccount
        });
      }
    }

    // Priority 2: Match by Profile Name (case-insensitive)
    for (const detected of detectedProfiles) {
      if (matchedProfileDirs.has(detected.dirName)) continue;
      if (!detected.displayName) continue;
      const detectedName = detected.displayName.toLowerCase().trim();

      const candidateAccount = currentAccounts.find(acc => {
        if (matchedAccountIds.has(acc.id)) return false;
        return acc.name && acc.name.toLowerCase().trim() === detectedName;
      });

      if (candidateAccount) {
        matchedAccountIds.add(candidateAccount.id);
        matchedProfileDirs.add(detected.dirName);
        matches.push({
          detectedProfile: detected,
          matchedAccountId: candidateAccount.id,
          matchType: 'name',
          confidence: 'medium',
          currentAccount: candidateAccount
        });
      }
    }

    // Priority 3: Match by Directory Name (e.g. "Default", "Profile 1")
    for (const detected of detectedProfiles) {
      if (matchedProfileDirs.has(detected.dirName)) continue;

      const candidateAccount = currentAccounts.find(acc => {
        if (matchedAccountIds.has(acc.id)) return false;
        const accUserDir = acc.userDataDir || config.system.chromeUserDataDir;
        const matchesUserDir = this.resolvePath(accUserDir) === scan.targetDir;
        return matchesUserDir && acc.chromeProfileDir === detected.dirName;
      });

      if (candidateAccount) {
        matchedAccountIds.add(candidateAccount.id);
        matchedProfileDirs.add(detected.dirName);
        matches.push({
          detectedProfile: detected,
          matchedAccountId: candidateAccount.id,
          matchType: 'directory',
          confidence: 'medium',
          currentAccount: candidateAccount
        });
      }
    }

    // Unmatched detected profiles
    const unmatchedProfiles = detectedProfiles.filter(p => !matchedProfileDirs.has(p.dirName));

    // For unmatched profiles: NEVER populate matchedAccountId and NEVER add to matchedAccountIds.
    // Unmatched profiles remain explicitly matchType: 'none' with matchedAccountId: undefined.
    for (const remaining of unmatchedProfiles) {
      const freeAccount = currentAccounts.find(acc => !matchedAccountIds.has(acc.id));
      matches.push({
        detectedProfile: remaining,
        matchedAccountId: undefined,
        suggestedAccountId: freeAccount ? freeAccount.id : undefined,
        matchType: 'none',
        confidence: 'low',
        currentAccount: undefined
      });
    }

    const unmatchedAccounts = currentAccounts.filter(acc => {
      const accUserDir = this.resolvePath(acc.userDataDir || config.system.chromeUserDataDir);
      const isSameBaseDir = accUserDir === scan.targetDir;
      if (!isSameBaseDir) return false;
      return !detectedProfiles.some(p => p.dirName === acc.chromeProfileDir);
    });

    return {
      userDataDir: scan.targetDir,
      detectedProfiles,
      currentAccounts,
      matches,
      unmatchedProfiles,
      unmatchedAccounts,
      browserVariants,
      stats: {
        totalDetected: detectedProfiles.length,
        totalConfigured: currentAccounts.length,
        matchedCount: matches.filter(m => m.matchedAccountId && m.matchType !== 'none').length,
        unmatchedDetectedCount: unmatchedProfiles.length,
        unmatchedAccountsCount: unmatchedAccounts.length
      }
    };
  }

  /**
   * Imports selected profile bindings into the Hub configuration.
   * Validates real profile existence, prevents duplication, and updates accounts.
   */
  public importMatchedProfiles(bindings: ProfileImportBinding[], targetConfigManager?: ConfigManager): {
    success: boolean;
    updatedAccountsCount: number;
    errors?: string[];
  } {
    const mgr = targetConfigManager || this.configManager;
    const config = mgr.getConfig();
    const errors: string[] = [];

    if (!Array.isArray(bindings) || bindings.length === 0) {
      return { success: false, updatedAccountsCount: 0, errors: ['Nenhuma associação de perfil foi enviada para importação.'] };
    }

    // Validate that each binding has a valid existing accountId and profileDir
    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i];
      if (!b || typeof b !== 'object') {
        errors.push(`Associação no índice ${i} é inválida.`);
        continue;
      }
      if (!b.accountId || typeof b.accountId !== 'string' || b.accountId.trim() === '') {
        errors.push(`Associação para o perfil "${b.profileDir || i}" não possui "accountId" explicitamente definido.`);
        continue;
      }
      const targetAcc = config.accounts.find(a => a.id === b.accountId);
      if (!targetAcc) {
        errors.push(`A conta "${b.accountId}" especificada na associação não existe nas configurações do Hub.`);
      }
      if (!b.profileDir || typeof b.profileDir !== 'string' || b.profileDir.trim() === '') {
        errors.push(`A conta "${b.accountId}" possui "profileDir" vazio na importação.`);
      }
    }

    // Check duplicate profile assignment in the incoming bindings
    const boundProfileKeys = new Set<string>();
    for (const b of bindings) {
      const targetUserDir = this.resolvePath(b.userDataDir || config.system.chromeUserDataDir);
      const profileKey = `${targetUserDir}::${b.profileDir}`;

      if (boundProfileKeys.has(profileKey)) {
        errors.push(`Perfil duplicado no lote de importação: "${b.profileDir}" em "${targetUserDir}" foi atribuído a mais de uma conta.`);
      } else {
        boundProfileKeys.add(profileKey);
      }

      // Check that the profile directory physically exists
      const fullPath = path.join(targetUserDir, b.profileDir);
      if (!fs.existsSync(fullPath)) {
        errors.push(`O perfil "${b.profileDir}" não existe fisicamente no disco em: ${fullPath}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, updatedAccountsCount: 0, errors };
    }

    const updatedAccounts = config.accounts.map(acc => {
      const binding = bindings.find(b => b.accountId === acc.id);
      if (!binding) return acc;

      return {
        ...acc,
        chromeProfileDir: binding.profileDir,
        userDataDir: binding.userDataDir ? this.resolvePath(binding.userDataDir) : undefined,
        name: binding.name || acc.name,
        email: binding.email !== undefined ? binding.email : acc.email,
        color: binding.color || acc.color,
        avatarIcon: binding.avatarIcon || acc.avatarIcon
      };
    });

    const newConfig = {
      ...config,
      accounts: updatedAccounts
    };

    const saveResult = mgr.saveConfig(newConfig);
    if (!saveResult.success) {
      return { success: false, updatedAccountsCount: 0, errors: saveResult.errors };
    }

    return {
      success: true,
      updatedAccountsCount: bindings.length
    };
  }

  public getSystemBrowserInfo(customUserDataDir?: string): SystemBrowserInfo {
    const available = this.detectBrowserBinaries();
    const recommended = available.find(b => b === 'google-chrome' || b === 'google-chrome-stable')
      || available[0]
      || 'google-chrome';

    const scanResult = this.scanProfiles(customUserDataDir);
    const browserVariants = this.detectBrowserVariants();

    return {
      availableBinaries: available,
      recommendedBinary: recommended,
      defaultUserDataDir: scanResult.targetDir,
      userDataDirExists: scanResult.userDataDirExists,
      detectedProfiles: scanResult.profiles,
      singletonLockActive: scanResult.singletonLockActive,
      singletonLockPid: scanResult.singletonLockPid,
      browserVariants
    };
  }
}

export const profileScanner = new ProfileScanner();
