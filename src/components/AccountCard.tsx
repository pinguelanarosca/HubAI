import React, { useState, useEffect } from 'react';
import { HubAccount, AIProvider, HistoryLogItem } from '../types.js';
import {
  getAccountIcon,
  Shield,
  Clock,
  Trash2,
  Search
} from '../utils/icons.js';
import { getProviderTheme } from '../utils/theme.js';
import { fetchAccountHistory, clearAccountHistory, refreshAccountHistory } from '../services/api.js';

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
  const [historyList, setHistoryList] = useState<HistoryLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = async () => {
    try {
      const hist = await fetchAccountHistory(account.id, activeProvider.id);
      setHistoryList(hist);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  useEffect(() => {
    setLoadingHistory(true);
    loadHistory().finally(() => setLoadingHistory(false));
  }, [account.id, activeProvider.id]);

  const handleRefreshHistory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingHistory(true);
    try {
      const hist = await refreshAccountHistory(account.id, activeProvider.id);
      setHistoryList(hist);
    } catch (err) {
      console.error('Erro ao atualizar histórico:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredHistory = historyList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.url && item.url.toLowerCase().includes(q))
    );
  });

  const handleClearHistory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja limpar todo o histórico desta conta para este provedor?')) {
      try {
        await clearAccountHistory(account.id, activeProvider.id);
        setHistoryList([]);
      } catch (err) {
        console.error('Erro ao limpar histórico:', err);
      }
    }
  };

  const Icon = getAccountIcon(account.avatarIcon);
  const theme = getProviderTheme(activeProvider.id);

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
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-md border border-neutral-700/50 transition-all duration-300 group-hover:scale-110 font-bold text-xs uppercase select-none font-sans"
                style={{ 
                  background: `linear-gradient(135deg, ${account.color}, ${account.color}dd)` 
                }}
                title="Imagem de Perfil Google"
              >
                {(account.name || account.email || 'G').charAt(0).toUpperCase()}
              </div>
              {/* Small Google indicator badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-neutral-950 flex items-center justify-center shadow-sm border border-neutral-800 pointer-events-none">
                <span className="text-[7px] font-black text-cyan-400 font-mono">G</span>
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

        {/* Expanded History List with Discrete Search */}
        <div className="space-y-1.5 flex-1 flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5 gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRefreshHistory}
                disabled={loadingHistory}
                className={`p-1 -ml-1 rounded-full hover:bg-neutral-800/60 transition-all ${loadingHistory ? 'animate-spin' : ''}`}
                title="Sincronizar com o histórico local do navegador"
              >
                <Clock className={`w-3.5 h-3.5 ${theme.accentText}`} />
              </button>
              <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                Histórico
              </span>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              {/* Discrete search with magnifying glass */}
              <div className="relative flex items-center">
                <Search className="w-2.5 h-2.5 text-neutral-500 absolute left-1.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="bg-neutral-950/70 border border-neutral-800/80 rounded pl-4 pr-1.5 py-0.5 text-[9px] text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 w-24 sm:w-28 transition-all font-mono"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {historyList.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-[9px] font-bold text-neutral-500 hover:text-rose-400 flex items-center gap-1 px-1 py-0.5 rounded transition-colors shrink-0"
                  title="Limpar todos os logs"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              )}
            </div>
          </div>

          <div className="h-56 overflow-y-auto space-y-1.5 pr-1 select-text scrollbar-thin scrollbar-thumb-neutral-900 text-left">
            {loadingHistory && historyList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                Buscando histórico...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-3 bg-neutral-950/40 rounded border border-neutral-900/60">
                <span className="text-[9px] text-neutral-500 font-mono">
                  {searchQuery ? 'Nenhum resultado para a busca.' : `Nenhum log para ${activeProvider.name}.`}
                </span>
                <span className="text-[8px] text-neutral-600 mt-1 max-w-[200px] leading-normal">
                  {searchQuery
                    ? 'Tente outro termo de busca.'
                    : 'Clique no ícone de relógio para sincronizar os dados do histórico do Chrome.'}
                </span>
              </div>
            ) : (
              filteredHistory.map((item, idx) => {
                const dateObj = new Date(item.timestamp);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = String(dateObj.getFullYear()).slice(-2);
                const dateStr = `${day}/${month}/${year}`;
                
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const seconds = String(dateObj.getSeconds()).padStart(2, '0');
                const timeStr = `${hours}:${minutes}:${seconds}`;

                return (
                  <div 
                    key={idx} 
                    className="p-1 px-1.5 rounded bg-neutral-950/50 border border-neutral-900/40 hover:bg-neutral-900/70 hover:border-neutral-800 transition-all text-left group/item relative flex flex-col min-w-0"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8px] text-neutral-400 font-mono">
                        {dateStr} <span className={theme.accentText}>{timeStr}</span>
                      </span>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`opacity-0 group-hover/item:opacity-100 text-[8px] hover:underline font-mono font-bold ${theme.accentText}`}
                      >
                        ABRIR
                      </a>
                    </div>
                    <div className="text-[10px] text-neutral-200 font-medium truncate mt-0.5" title={item.title}>
                      {item.title || 'Sem título'}
                    </div>
                    <div className="text-[8px] text-neutral-500 truncate font-mono select-all" title={item.url}>
                      {item.url}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
