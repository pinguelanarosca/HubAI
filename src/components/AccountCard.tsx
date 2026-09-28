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
  MessageSquare,
  Clock,
  Info
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

  // Sync indicator dot color
  let syncDot = '🟢';
  if (status?.syncState === 'cached') syncDot = '🟡';
  if (status?.syncState === 'unavailable' || status?.syncState === 'error') syncDot = '⚪';
  if (isSyncing) syncDot = '🔄';

  const planLabel = status?.planName || 'FREE';
  const hasPhoto = Boolean(status?.profilePictureUrl);

  return (
    <div
      onClick={() => onLaunch(account.id, false)}
      className="group relative bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md"
    >
      <div>
        {/* Top Header: Sync Indicator, Real Avatar / Fallback, Provider & Account Info */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Status Dot + Avatar */}
            <div className="relative shrink-0">
              {hasPhoto ? (
                <img
                  src={status!.profilePictureUrl}
                  alt={account.name}
                  className="w-11 h-11 rounded-full object-cover border border-neutral-700 shadow-sm"
                  onError={(e) => {
                    // Fallback to Icon if image fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: account.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
              )}
              {/* Sync Status Badge */}
              <span
                className="absolute -top-1 -left-1 text-[10px] leading-none"
                title={`Status da Sessão: ${status?.syncState || 'Desconhecido'}`}
              >
                {syncDot}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-100 group-hover:text-white truncate">
                  {activeProvider.name}
                </h2>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 shrink-0">
                  {planLabel}
                </span>
              </div>
              <span className="text-xs text-neutral-300 font-medium truncate block mt-0.5">
                {account.name}
              </span>
              <span className="text-[11px] text-neutral-400 truncate block font-mono">
                {status?.accountEmail || account.email || `Perfil: ${account.chromeProfileDir}`}
              </span>
            </div>
          </div>

          {/* Profile directory badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-300 shrink-0"
            title={`Sessão isolada no perfil ${account.chromeProfileDir}`}
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>{account.chromeProfileDir}</span>
          </div>
        </div>

        {/* Enrichment Section: Projects */}
        <div className="mb-3.5 space-y-1 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-300">
              <Folder className="w-3 h-3 text-indigo-400" />
              <span>Projetos:</span>
            </span>
          </div>

          {status?.hasProjectsConcept ? (
            status.projects && status.projects.length > 0 ? (
              <div className="space-y-1">
                {status.projects.slice(0, 3).map((proj) => (
                  <div key={proj.id} className="text-xs text-neutral-300 font-mono flex items-center gap-1.5 truncate">
                    <span className="text-indigo-400/80 text-[10px]">•</span>
                    <span className="truncate">{proj.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-neutral-500 italic block font-mono">Nenhum projeto cadastrado</span>
            )
          ) : (
            <span className="text-[11px] text-neutral-500 italic block font-mono">Não aplicável para {activeProvider.name}</span>
          )}
        </div>

        {/* Enrichment Section: Recent Chats */}
        <div className="mb-3.5 space-y-1 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-300">
              <MessageSquare className="w-3 h-3 text-emerald-400" />
              <span>Chats recentes:</span>
            </span>
          </div>

          {status?.recentChats && status.recentChats.length > 0 ? (
            <div className="space-y-1">
              {status.recentChats.slice(0, 3).map((chat) => (
                <div key={chat.id} className="flex items-center justify-between text-xs font-mono gap-2">
                  <span className="text-neutral-300 truncate">{chat.title}</span>
                  <span className="text-neutral-500 shrink-0 text-[10px]">{chat.timeOrDate}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-neutral-500 italic block font-mono">Nenhum chat recente registrado</span>
          )}
        </div>

        {/* Enrichment Section: Usage & Limits */}
        <div className="mb-3 space-y-1 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/80 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 text-[11px]">Limite:</span>
            <span className="text-emerald-400 font-semibold text-[11px]">
              {status?.usage?.limitLabel || 'Disponível'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400 text-[11px]">Reset:</span>
            <span className="text-neutral-300 text-[11px]">
              {status?.usage?.resetTime || '--'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px]">
            <span className="text-neutral-500">Mais informações:</span>
            <span className="text-neutral-400 truncate max-w-[160px]" title={status?.syncMessage}>
              {status?.syncMessage || 'Sessão verificada'}
            </span>
          </div>
        </div>

        {/* Action Callout Bar */}
        <div className="bg-neutral-950 rounded-lg p-2.5 border border-neutral-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold">
              Destino no Perfil
            </span>
            <span className="text-xs font-medium text-neutral-300 truncate block">
              {activeProvider.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors shrink-0">
            <span>{isLaunching ? 'Abrindo...' : 'Abrir Sessão'}</span>
            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Card Footer: Quick Actions & Sync */}
      <div className="mt-4 pt-3 border-t border-neutral-800/70 flex items-center justify-between text-xs text-neutral-400">
        <span className="text-[11px] text-neutral-500 font-mono">
          Conta #{account.order}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-2 py-1 rounded hover:bg-neutral-800 hover:text-neutral-200 text-[11px] text-neutral-400 flex items-center gap-1 transition-colors"
            title="Sincronizar dados da sessão"
          >
            <RotateCw className={`w-3 h-3 text-neutral-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>

          <button
            onClick={handleDryRun}
            className="px-2 py-1 rounded hover:bg-neutral-800 hover:text-neutral-200 text-[11px] text-neutral-400 flex items-center gap-1 transition-colors"
            title="Validar comando sem iniciar janela"
          >
            <Play className="w-3 h-3 text-neutral-400" />
            <span>Validar</span>
          </button>

          <button
            onClick={handleCopyCommand}
            className="px-2 py-1 rounded hover:bg-neutral-800 hover:text-neutral-200 text-[11px] text-neutral-400 flex items-center gap-1 transition-colors"
            title="Copiar comando Linux"
          >
            {copiedCmd ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Terminal className="w-3 h-3 text-neutral-400" />
            )}
            <span>{copiedCmd ? 'Copiado!' : 'Comando'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
