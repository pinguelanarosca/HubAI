import React, { useState } from 'react';
import { AIProvider } from '../types.js';
import { getProviderIcon, Plus, Search } from '../utils/icons.js';
import { getProviderTheme } from '../utils/theme.js';

interface SidebarProps {
  providers: AIProvider[];
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
  onAddProvider: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  providers,
  selectedProviderId,
  onSelectProvider,
  onAddProvider
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const enabledProviders = providers
    .filter(p => p.enabled)
    .sort((a, b) => a.order - b.order);

  const filteredProviders = enabledProviders.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col h-[calc(100vh-4rem)] shrink-0">
      {/* Sidebar Header & Search */}
      <div className="p-4 border-b border-neutral-900 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase">
            Provedores de IA
          </span>
          <span className="text-xs font-mono text-neutral-500 tabular-nums">
            {enabledProviders.length} ativos
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar plataformas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-md text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>
      </div>

      {/* Provider List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredProviders.map((provider) => {
          const Icon = getProviderIcon(provider.icon);
          const isSelected = provider.id === selectedProviderId;
          const theme = getProviderTheme(provider.id);

          return (
            <button
              key={provider.id}
              onClick={() => onSelectProvider(provider.id)}
              className={`relative overflow-hidden w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-left transition-all duration-300 border group hover:translate-x-1.5 hover:shadow-md ${
                isSelected
                  ? `backdrop-blur-md ${theme.sidebarSelected}`
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/30 hover:bg-neutral-900/40 backdrop-blur-xs border-transparent hover:border-neutral-800/40'
              }`}
            >
              {/* Dynamic Sliding Colorful Light Bar */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-md transition-all duration-300 ${
                isSelected 
                  ? 'opacity-100 scale-y-100' 
                  : 'opacity-0 scale-y-50 group-hover:opacity-40 group-hover:scale-y-75'
              } ${theme.accentText} bg-current`} />
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all shrink-0 ${
                  isSelected
                    ? `${theme.iconAccent}`
                    : 'bg-neutral-900 text-neutral-400 group-hover:text-neutral-200 group-hover:bg-neutral-850'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs truncate block font-medium ${isSelected ? 'font-semibold' : ''}`}>
                    {provider.name}
                  </span>
                  {provider.badge && (
                    <span className={`text-[10px] px-1 py-0.2 rounded font-mono border ml-1.5 shrink-0 ${
                      isSelected ? theme.badgeStyle : 'bg-neutral-900 text-neutral-500 border-neutral-800/80'
                    }`}>
                      {provider.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-500 truncate block mt-0.5 font-mono">
                  {provider.defaultUrl.replace('https://', '')}
                </span>
              </div>
            </button>
          );
        })}

        {filteredProviders.length === 0 && (
          <div className="p-4 text-center text-xs text-neutral-500">
            Nenhum provedor encontrado com &quot;{searchTerm}&quot;
          </div>
        )}
      </div>

      {/* Sidebar Footer / Add Provider */}
      <div className="p-3 border-t border-neutral-900 bg-neutral-950">
        <button
          onClick={onAddProvider}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Novo Provedor</span>
        </button>
      </div>
    </aside>
  );
};
