import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { DetectedProfile } from '../src/types.js';

export interface SystemBrowserInfo {
  availableBinaries: string[];
  recommendedBinary: string;
  defaultUserDataDir: string;
  userDataDirExists: boolean;
  detectedProfiles: DetectedProfile[];
  singletonLockActive: boolean;
  singletonLockPid?: number;
}

export class ProfileScanner {
  // Resolve tilde '~' in paths
  public resolvePath(filePath: string): string {
    if (filePath.startsWith('~/') || filePath === '~') {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return path.resolve(filePath);
  }

  public detectBrowserBinaries(): string[] {
    const candidates = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'brave-browser',
      'microsoft-edge'
    ];
    const available: string[] = [];

    for (const bin of candidates) {
      try {
        const out = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        if (out) {
          available.push(bin);
        }
      } catch {
        // Not found, ignore
      }
    }

    return available;
  }

  /**
   * Scans exclusively real Chrome/Chromium user profiles on the host filesystem.
   * NEVER creates mock directories or fake profiles.
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
        // SingletonLock on Linux is typically a symlink to "hostname-PID"
        const linkTarget = fs.readlinkSync(lockPath);
        const parts = linkTarget.split('-');
        const pidStr = parts[parts.length - 1];
        const parsedPid = parseInt(pidStr, 10);
        if (!isNaN(parsedPid) && parsedPid > 0) {
          singletonLockPid = parsedPid;
          try {
            // Check if process is alive
            process.kill(parsedPid, 0);
            singletonLockActive = true;
          } catch {
            // Stale lock file
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

    try {
      const localStatePath = path.join(targetDir, 'Local State');
      let localStateInfoCache: Record<string, any> = {};

      if (fs.existsSync(localStatePath)) {
        try {
          const raw = fs.readFileSync(localStatePath, 'utf-8');
          const data = JSON.parse(raw);
          localStateInfoCache = data?.profile?.info_cache || {};
        } catch {
          // Ignore parse error on corrupted local state
        }
      }

      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;

        // Check if this directory corresponds to a real Chrome profile
        if (name === 'Default' || name.startsWith('Profile ') || localStateInfoCache[name]) {
          const fullPath = path.join(targetDir, name);
          const cached = localStateInfoCache[name] || {};

          let email = cached.user_name || undefined;
          let displayName = cached.name || undefined;

          // Read Preferences file if available in the profile folder
          const prefPath = path.join(fullPath, 'Preferences');
          if (fs.existsSync(prefPath)) {
            try {
              const pRaw = fs.readFileSync(prefPath, 'utf-8');
              const pData = JSON.parse(pRaw);
              displayName = displayName || pData?.profile?.name;
              email = email || pData?.account_info?.[0]?.email;
            } catch {
              // Ignore preference parse errors
            }
          }

          // Check if this specific profile directory has a lock file
          const profileLock = path.join(fullPath, 'LOCK');
          const isLocked = fs.existsSync(profileLock) || singletonLockActive;

          profiles.push({
            dirName: name,
            fullPath,
            displayName: displayName || (name === 'Default' ? 'Default Profile' : name),
            email,
            exists: true,
            isLocked
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
      console.error('Error scanning real chrome profiles:', err);
    }

    return {
      targetDir,
      userDataDirExists: true,
      profiles,
      singletonLockActive,
      singletonLockPid
    };
  }

  public getSystemBrowserInfo(customUserDataDir?: string): SystemBrowserInfo {
    const available = this.detectBrowserBinaries();
    const recommended = available.find(b => b === 'google-chrome' || b === 'google-chrome-stable')
      || available[0]
      || 'google-chrome';

    const scanResult = this.scanProfiles(customUserDataDir);

    return {
      availableBinaries: available,
      recommendedBinary: recommended,
      defaultUserDataDir: scanResult.targetDir,
      userDataDirExists: scanResult.userDataDirExists,
      detectedProfiles: scanResult.profiles,
      singletonLockActive: scanResult.singletonLockActive,
      singletonLockPid: scanResult.singletonLockPid
    };
  }
}

export const profileScanner = new ProfileScanner();
