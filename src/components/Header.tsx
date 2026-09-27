import React from 'react';
import { Activity, Settings, Terminal, Shield, RefreshCw } from 'lucide-react';
import { AIProvider } from '../types.js';

interface HeaderProps {
  activeProvider?: AIProvider;
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenUpdate: () => void;
  hasUpdate?: boolean;
  diagnosticStatus?: 'passed' | 'warning' | 'failed' | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeProvider,
  onOpenDiagnostics,
  onOpenSettings,
  onOpenShortcuts,
  onOpenUpdate,
  hasUpdate,
  diagnosticStatus
}) => {
  return (
    <header className="h-16 px-6 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-200">
          <Shield className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight text-neutral-100">
            HubAI
          </span>
          <span className="text-xs text-neutral-500 hidden sm:inline ml-2.5 font-normal">
            Linux Desktop Isolation
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation / Context breadcrumb */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400">
        <span className="text-neutral-500">Fluxo:</span>
        <span className="text-neutral-200 font-medium">1. Provedor ({activeProvider?.shortName || 'Selecione'})</span>
        <span className="text-neutral-600">→</span>
        <span className="text-neutral-300 font-medium">2. Conta (9 Perfis Chrome)</span>
        <span className="text-neutral-600">→</span>
        <span className="text-neutral-400">3. Sessão Isolada</span>
      </div>

      {/* Zone 3: Primary action buttons */}
      <div className="flex items-center gap-2">
        {/* Atualizar Hub Button */}
        <button
          onClick={onOpenUpdate}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap border ${
            hasUpdate
              ? 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-700 text-indigo-300 animate-pulse'
              : 'text-neutral-300 hover:text-neutral-100 bg-neutral-900 hover:bg-neutral-850 border-neutral-800'
          }`}
          title="Verificar e instalar atualizações do GitHub (pinguelanarosca/HubAI)"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Atualizar Hub</span>
          {hasUpdate && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" title="Nova versão disponível" />
          )}
        </button>

        <button
          onClick={onOpenShortcuts}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-neutral-100 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg transition-colors whitespace-nowrap"
          title="Atalhos .desktop e Script Bash para Linux"
        >
          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Linux CLI / Atalhos</span>
        </button>

        <button
          onClick={onOpenDiagnostics}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-neutral-100 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg transition-colors whitespace-nowrap"
          title="Executar verificação de perfis e requisitos"
        >
          <Activity className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Diagnóstico</span>
          {diagnosticStatus === 'passed' && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Sistema 100% validado" />
          )}
          {diagnosticStatus === 'warning' && (
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Avisos detectados" />
          )}
          {diagnosticStatus === 'failed' && (
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" title="Falhas detectadas" />
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors whitespace-nowrap"
          title="Configurar contas, provedores e perfis do Chrome"
        >
          <Settings className="w-3.5 h-3.5 text-neutral-300" />
          <span className="hidden sm:inline">Configurações</span>
        </button>
      </div>
    </header>
  );
};
