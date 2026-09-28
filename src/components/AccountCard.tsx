import React, { useState } from 'react';
import { HubAccount, AIProvider, AccountStatus } from '../types.js';
import {
  getAccountIcon,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Play,
  Shield,
  RotateCw,
  Folder,
  MessageSquare
} from '../utils/icons.js';

interface AccountCardProps {
  account: HubAccount;
  activeProvider: AIProvider;
  status?: AccountStatus;
  onLaunch: (accountId: string, dryRun?: boolean) => void;
  onEdit: (account: HubAccount) => void;
  onSyncAccount?: (accountId: string) => void;
  isLaunching?: boolean;
  isSyncing?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  activeProvider,
  status,
  onLaunch,
  onEdit,
  onSyncAccount,
  isLaunching = false,
  isSyncing = false
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const Icon = getAccountIcon(account.avatarIcon);

  // Target URL (check for account-specific override)
  const targetUrl = account.customUrls?.[activeProvider.id] || activeProvider.defaultUrl;
  const userDir = account.userDataDir || '~/.config/google-chrome';
  const linuxCmd = `google-chrome --user-data-dir="${userDir}" --profile-directory="${account.chromeProfileDir}" --new-window "${targetUrl}"`;

  const handleCopyCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(linuxCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleDryRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLaunch(account.id, true);
  };

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSyncAccount) {
      onSyncAccount(account.id);
    }
  };

  // Sync state indicator
  let syncDot = '🟢';
  let syncStateLabel = 'Sincronizado';
  if (status?.syncState === 'cached') {
    syncDot = '🟡';
    syncStateLabel = 'Em cache';
  } else if (status?.syncState === 'unavailable') {
    syncDot = '⚪';
    syncStateLabel = 'Indisponível';
  } else if (status?.syncState === 'error') {
    syncDot = '🔴';
    syncStateLabel = 'Erro de Coleta';
  } else if (status?.syncState === 'syncing') {
    syncDot = '🔄';
    syncStateLabel = 'Sincronizando...';
  }
  if (isSyncing) {
    syncDot = '🔄';
    syncStateLabel = 'Sincronizando...';
  }

  const planLabel = status?.planName && status.planName !== '' ? status.planName : '--';
  const hasPhoto = Boolean(status?.profilePictureUrl && status.profilePictureUrl !== '--');

  const projectsList = status?.projects || [];
  const chatsList = status?.recentChats || [];

  return (
    <div
      onClick={() => onLaunch(account.id, false)}
      className="group relative bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3 transition-all duration-150 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md text-xs"
    >
      <div className="space-y-2">
        {/* Compact Header: Real Photo / Fallback, Name, Email, Plan & Profile Dir */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              {hasPhoto ? (
                <img
                  src={status!.profilePictureUrl}
                  alt={account.name}
                  className="w-8 h-8 rounded-full object-cover border border-neutral-700 shadow-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: account.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <span className="absolute -top-1 -left-1 text-[9px] leading-none" title={`Estado de Sincronização: ${syncStateLabel} (${status?.lastSyncAt || 'Não sincronizado'})`}>
                {syncDot}
              </span>
            </div>

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-neutral-100 group-hover:text-white truncate text-xs">
                  {activeProvider.name}
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 shrink-0 font-medium">
                  {planLabel}
                </span>
              </div>
              <span className="text-[11px] text-neutral-300 font-medium truncate block">
                {status?.accountName || account.name}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono truncate block">
                {status?.accountEmail && status.accountEmail !== '--' ? status.accountEmail : (account.email || '--')}
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-300 shrink-0"
            title={`Perfil Chrome: ${account.chromeProfileDir}`}
          >
            <Shield className="w-2.5 h-2.5 text-emerald-400" />
            <span>{account.chromeProfileDir}</span>
          </div>
        </div>

        {/* Compact Grid: Projects, Chats, Limits & Info */}
        <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono">
          {/* Projects */}
          <div className="flex items-center justify-between gap-1 bg-neutral-950/80 px-2 py-1 rounded border border-neutral-800/80">
            <span className="text-neutral-400 shrink-0 flex items-center gap-1 font-sans">
              <Folder className="w-2.5 h-2.5 text-indigo-400" />
              <span>Projetos:</span>
            </span>
            <div className="truncate text-right">
              {status?.hasProjectsConcept ? (
                projectsList.length > 0 ? (
                  <span className="text-neutral-200 truncate">{projectsList.map(p => p.name).join(', ')}</span>
                ) : (
                  <span className="text-neutral-500">--</span>
                )
              ) : (
                <span className="text-neutral-500">--</span>
              )}
            </div>
          </div>

          {/* Chats */}
          <div className="flex items-center justify-between gap-1 bg-neutral-950/80 px-2 py-1 rounded border border-neutral-800/80">
            <span className="text-neutral-400 shrink-0 flex items-center gap-1 font-sans">
              <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
              <span>Chats recentes:</span>
            </span>
            <div className="truncate text-right">
              {chatsList.length > 0 ? (
                <span className="text-neutral-200 truncate">
                  {chatsList.map(c => `${c.title}${c.timeOrDate ? ` (${c.timeOrDate})` : ''}`).join(' • ')}
                </span>
              ) : (
                <span className="text-neutral-500">--</span>
              )}
            </div>
          </div>

          {/* Limits & Reset */}
          <div className="flex items-center justify-between gap-2 bg-neutral-950/80 px-2 py-1 rounded border border-neutral-800/80 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-neutral-400 font-sans">Limite:</span>
              <span className="text-emerald-400 font-semibold">{status?.usage?.limitLabel || '--'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-neutral-400 font-sans">Reset:</span>
              <span className="text-neutral-300">{status?.usage?.resetTime || '--'}</span>
            </div>
          </div>

          {/* Extra Sync Details */}
          <div className="flex items-center justify-between gap-1 px-1 text-[10px] text-neutral-500">
            <span>Mais informações:</span>
            <span className="text-neutral-400 truncate max-w-[180px]" title={status?.syncMessage || '--'}>
              {status?.syncMessage || '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Controls: Iniciar Janela / Validar / Comando / Sincronizar */}
      <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
        <button
          onClick={() => onLaunch(account.id, false)}
          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded shadow-sm transition-colors shrink-0"
          title="Iniciar janela do Chrome com este perfil"
        >
          <span>{isLaunching ? 'Abrindo...' : 'Iniciar Janela'}</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-1 text-neutral-400">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-1.5 py-0.5 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors flex items-center gap-1"
            title="Sincronizar sessão real da conta"
          >
            <RotateCw className={`w-3 h-3 text-neutral-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>

          <button
            onClick={handleDryRun}
            className="px-1.5 py-0.5 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors flex items-center gap-1"
            title="Validar comando do perfil"
          >
            <Play className="w-3 h-3 text-neutral-400" />
            <span>Validar</span>
          </button>

          <button
            onClick={handleCopyCommand}
            className="px-1.5 py-0.5 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors flex items-center gap-1"
            title="Copiar comando de terminal Linux"
          >
            {copiedCmd ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Terminal className="w-3 h-3 text-neutral-400" />
            )}
            <span>{copiedCmd ? 'Copiado' : 'Comando'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
