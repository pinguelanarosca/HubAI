import React, { useState, useEffect } from 'react';
import { HubAccount, AIProvider } from '../types.js';
import {
  getAccountIcon,
  ExternalLink,
  Check,
  Terminal,
  Play,
  Shield
} from '../utils/icons.js';
import { getProviderTheme } from '../utils/theme.js';

interface AccountCardProps {
  account: HubAccount;
  activeProvider: AIProvider;
  onLaunch: (accountId: string, dryRun?: boolean) => void;
  onEdit: (account: HubAccount) => void;
  onUpdateNotes?: (accountId: string, notes: string) => void;
  isLaunching?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  activeProvider,
  onLaunch,
  onEdit,
  onUpdateNotes,
  isLaunching = false
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [localNotes, setLocalNotes] = useState(account.notes || '');

  useEffect(() => {
    setLocalNotes(account.notes || '');
  }, [account.notes]);

  const Icon = getAccountIcon(account.avatarIcon);
  const theme = getProviderTheme(activeProvider.id);

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

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalNotes(val);
    if (onUpdateNotes) {
      onUpdateNotes(account.id, val);
    }
  };

  return (
    <div
      onClick={() => onLaunch(account.id, false)}
      className={`group relative overflow-hidden rounded-lg p-3.5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-black/30 cursor-pointer flex flex-col justify-between border ${theme.cardBg} ${theme.cardBorder}`}
    >
      {/* Ambient Colorful Glow Blobs (Four overlapping layers for maximum glassmorphism depth) */}
      <div className={`absolute -left-10 -bottom-10 w-24 h-24 rounded-full ${theme.glowBg} filter blur-[35px] opacity-[0.05] group-hover:opacity-[0.14] group-hover:scale-125 group-hover:translate-x-4 group-hover:-translate-y-4 transition-all duration-700 pointer-events-none select-none`} />
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full ${theme.glowBg} filter blur-[45px] opacity-[0.04] group-hover:opacity-[0.11] group-hover:scale-110 group-hover:-translate-x-6 group-hover:translate-y-6 transition-all duration-700 pointer-events-none select-none`} />
      <div className={`absolute left-1/4 top-1/3 w-16 h-8 rounded-full ${theme.glowBg} filter blur-[30px] opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-150 transition-all duration-500 pointer-events-none select-none`} />
      <div className={`absolute left-2 -top-4 w-12 h-12 rounded-full ${theme.glowBg} filter blur-[25px] opacity-[0.02] group-hover:opacity-[0.07] group-hover:translate-y-3 group-hover:translate-x-2 transition-all duration-700 pointer-events-none select-none`} />

      {/* Subtle Background Technical Watermark Labels */}
      <div className="absolute left-4 bottom-14 font-mono text-[7px] uppercase tracking-[0.25em] text-white/5 group-hover:text-white/10 pointer-events-none select-none transition-colors duration-300">
        SECURE CONTAINER
      </div>
      <div className="absolute right-4 bottom-14 font-mono text-[7px] uppercase tracking-[0.25em] text-white/5 group-hover:text-white/10 pointer-events-none select-none transition-colors duration-300">
        {activeProvider.id.toUpperCase()}_NODE
      </div>

      {/* Dynamic Thematic Background Watermark Decoration */}
      <div 
        className={`absolute -right-3 -top-5 text-6xl font-black select-none pointer-events-none transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12 ${theme.decoratorColor}`}
      >
        {theme.decoratorSymbol}
      </div>

      <div className="space-y-3 relative z-10">
        {/* Compact Header: Avatar, Name, Email, Provider Display */}
        <div className={`flex items-center justify-between gap-2 pb-2.5 border-b ${theme.cardHeaderLine}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm transition-transform duration-350 group-hover:rotate-6"
                style={{ backgroundColor: account.color }}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
            </div>

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className={`font-bold group-hover:underline truncate text-xs ${theme.accentText}`}>
                  {activeProvider.name}
                </span>
              </div>
              <span className="text-[12px] text-neutral-100 font-medium truncate block mt-0.5">
                {account.name}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono truncate block">
                {account.email || '--'}
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-300 shrink-0 shadow-inner"
            title={`Perfil Chrome: ${account.chromeProfileDir}`}
          >
            <Shield className={`w-2.5 h-2.5 ${theme.accentText}`} />
            <span>{account.chromeProfileDir}</span>
          </div>
        </div>

        {/* Compact Notes Field (replaces scrap/projects/chats/limits div) */}
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">
              Anotações da Conta
            </label>
            <span className={`text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${theme.accentText}`}>
              Auto-salvamento ativo
            </span>
          </div>
          <textarea
            value={localNotes}
            onChange={handleNotesChange}
            placeholder="Clique aqui para adicionar anotações/observações..."
            rows={2}
            className={`w-full text-xs text-neutral-200 bg-neutral-950/80 hover:bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded px-2.5 py-1.5 focus:outline-none resize-none transition-all placeholder-neutral-600 font-mono ${theme.notesFocus}`}
          />
        </div>
      </div>

      {/* Footer Controls: Iniciar Janela / Validar / Comando */}
      <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] relative z-10 ${theme.cardHeaderLine}`}>
        <button
          onClick={() => onLaunch(account.id, false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded shadow-sm transition-all duration-200 shrink-0 ${theme.launchBtn}`}
          title="Iniciar janela do Chrome com este perfil"
        >
          <span>{isLaunching ? 'Abrindo...' : 'Iniciar Janela'}</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-1 text-neutral-400">
          <button
            onClick={handleDryRun}
            className={`px-2 py-1 rounded transition-all duration-200 flex items-center gap-1 text-[10px] ${theme.validBtn}`}
            title="Validar comando do perfil"
          >
            <Play className="w-2.5 h-2.5 text-neutral-400" />
            <span>Validar</span>
          </button>

          <button
            onClick={handleCopyCommand}
            className={`px-2 py-1 rounded transition-all duration-200 flex items-center gap-1 text-[10px] ${theme.cmdBtn}`}
            title="Copiar comando de terminal Linux"
          >
            {copiedCmd ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <Terminal className="w-2.5 h-2.5 text-neutral-400" />
            )}
            <span>{copiedCmd ? 'Copiado' : 'Comando'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
