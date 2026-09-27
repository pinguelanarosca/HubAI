import React, { useState } from 'react';
import { HubAccount, AIProvider } from '../types.js';
import { getAccountIcon, ExternalLink, Copy, Check, Terminal, Play, Shield } from '../utils/icons.js';

interface AccountCardProps {
  account: HubAccount;
  activeProvider: AIProvider;
  onLaunch: (accountId: string, dryRun?: boolean) => void;
  onEdit: (account: HubAccount) => void;
  isLaunching?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  activeProvider,
  onLaunch,
  onEdit,
  isLaunching = false
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

  return (
    <div
      onClick={() => onLaunch(account.id, false)}
      className="group relative bg-neutral-900/60 hover:bg-neutral-850/90 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md"
    >
      {/* Top Header: Visual Avatar & Account Info */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: account.color }}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-100 group-hover:text-white truncate transition-colors">
                {account.name}
              </h2>
              <span className="text-[11px] text-neutral-400 truncate block font-mono">
                {account.email || `Perfil Chrome: ${account.chromeProfileDir}`}
              </span>
            </div>
          </div>

          {/* Profile directory badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-300 shrink-0"
            title={`Sessão isolada no diretório ~/.config/google-chrome/${account.chromeProfileDir}`}
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>{account.chromeProfileDir}</span>
          </div>
        </div>

        {/* Account Description / Notes */}
        {account.notes && (
          <p className="text-xs text-neutral-400 line-clamp-1 mb-3">
            {account.notes}
          </p>
        )}

        {/* Action Callout Bar */}
        <div className="bg-neutral-950/80 rounded-lg p-2.5 border border-neutral-800/80 flex items-center justify-between mt-2">
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

      {/* Card Footer: Quick Actions */}
      <div className="mt-4 pt-3 border-t border-neutral-800/70 flex items-center justify-between text-xs text-neutral-400">
        <span className="text-[11px] text-neutral-500 font-mono">
          Conta #{account.order}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDryRun}
            className="px-2 py-1 rounded hover:bg-neutral-800 hover:text-neutral-200 text-[11px] text-neutral-400 flex items-center gap-1 transition-colors"
            title="Validar comando e perfil sem iniciar janela"
          >
            <Play className="w-3 h-3 text-neutral-400" />
            <span>Validar</span>
          </button>

          <button
            onClick={handleCopyCommand}
            className="px-2 py-1 rounded hover:bg-neutral-800 hover:text-neutral-200 text-[11px] text-neutral-400 flex items-center gap-1 transition-colors"
            title="Copiar comando de terminal Linux"
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
