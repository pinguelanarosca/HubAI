import React, { useState } from 'react';
import { HubAccount, AIProvider } from '../types.js';
import { AccountCard } from './AccountCard.js';
import { Search, Shield, Zap } from '../utils/icons.js';

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
      {/* Subheader & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-200">
            Contas Google Vinculadas
          </span>
          <span className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
            {accounts.length} contas / perfis isolados
          </span>
        </div>

        <div className="flex items-center gap-2">
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
            onLaunch={onLaunch}
            onEdit={onEditAccount}
            isLaunching={launchingAccountId === account.id}
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
