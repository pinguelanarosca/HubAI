import React, { useState, useEffect } from 'react';
import { HubAccount, AIProvider, AccountStatus } from '../types.js';
import { AccountCard } from './AccountCard.js';
import { Search, Shield, Zap, RotateCw } from '../utils/icons.js';
import { fetchAccountEnrichments, syncAccountStatus } from '../services/api.js';

interface AccountGridProps {
  accounts: HubAccount[];
  activeProvider: AIProvider;
  onLaunch: (accountId: string, dryRun?: boolean) => void;
  onEditAccount: (account: HubAccount) => void;
  launchingAccountId?: string | null;
}

export const AccountGrid: React.FC<AccountGridProps> = ({
  accounts,
  activeProvider,
  onLaunch,
  onEditAccount,
  launchingAccountId
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [enrichments, setEnrichments] = useState<Record<string, AccountStatus>>({});
  const [isLoadingEnrichments, setIsLoadingEnrichments] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  const loadEnrichments = async (force: boolean = false) => {
    setIsLoadingEnrichments(true);
    try {
      const data = await fetchAccountEnrichments(activeProvider.id, force);
      setEnrichments(data || {});
    } catch (err) {
      console.warn('[AccountGrid] Erro ao carregar informações enriquecidas:', err);
    } finally {
      setIsLoadingEnrichments(false);
    }
  };

  useEffect(() => {
    loadEnrichments(false);
  }, [activeProvider.id, accounts.length]);

  const handleSyncAccount = async (accountId: string) => {
    setSyncingAccountId(accountId);
    try {
      const updatedStatus = await syncAccountStatus(accountId, activeProvider.id);
      setEnrichments((prev) => ({
        ...prev,
        [accountId]: updatedStatus
      }));
    } catch (err) {
      console.error(`[AccountGrid] Falha ao sincronizar conta ${accountId}:`, err);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSyncAll = () => {
    loadEnrichments(true);
  };

  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order);
  const filteredAccounts = sortedAccounts.filter(
    acc =>
      acc.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      acc.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
      acc.chromeProfileDir.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (acc.notes && acc.notes.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Subheader, Sync All & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-neutral-200">
            Contas Vinculadas ao {activeProvider.name}
          </span>
          <span className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
            {accounts.length} perfis isolados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={isLoadingEnrichments}
            className="px-2.5 py-1.5 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
            title="Atualizar dados de sessão de todas as contas"
          >
            <RotateCw className={`w-3 h-3 text-indigo-400 ${isLoadingEnrichments ? 'animate-spin' : ''}`} />
            <span>Atualizar Sessões</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar contas..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-md text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Grid: 3 columns on desktop (3x3 = 9 accounts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            activeProvider={activeProvider}
            status={enrichments[account.id]}
            onLaunch={onLaunch}
            onEdit={onEditAccount}
            onSyncAccount={handleSyncAccount}
            isLaunching={launchingAccountId === account.id}
            isSyncing={syncingAccountId === account.id}
          />
        ))}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="p-8 text-center bg-neutral-900/30 border border-neutral-800/60 rounded-xl">
          <p className="text-xs text-neutral-400">
            Nenhuma conta encontrada para o termo &quot;{filterQuery}&quot;.
          </p>
        </div>
      )}
    </div>
  );
};
