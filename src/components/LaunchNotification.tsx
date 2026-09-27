import React, { useState } from 'react';
import { LaunchResult } from '../types.js';
import { Check, Copy, ExternalLink, Shield, Terminal, X, AlertTriangle } from '../utils/icons.js';

interface LaunchNotificationProps {
  result: LaunchResult | null;
  onDismiss: () => void;
}

export const LaunchNotification: React.FC<LaunchNotificationProps> = ({ result, onDismiss }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBrowserTab = () => {
    window.open(result.targetUrl, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-lg w-full bg-neutral-900 border border-neutral-700/80 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-100 flex items-center gap-2">
              <span>{result.accountName}</span>
              <span className="text-neutral-500 font-normal">→</span>
              <span className="text-emerald-400">{result.providerName}</span>
            </h4>
            <span className="text-[11px] text-neutral-400 block font-mono">
              Perfil Isolado: <strong className="text-neutral-200">{result.profileDir}</strong>
            </span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-neutral-500 hover:text-neutral-300 p-1 rounded hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {result.warning && (
        <div className="mt-2.5 p-2 bg-amber-950/40 border border-amber-800/60 rounded-md text-[11px] text-amber-300 flex items-start gap-1.5 leading-normal">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.warning}</span>
        </div>
      )}

      {/* Command Preview */}
      <div className="mt-3 bg-neutral-950 border border-neutral-800 rounded-lg p-2 font-mono text-[11px] text-neutral-300 flex items-center justify-between gap-2">
        <span className="truncate">{result.command}</span>
        <button
          onClick={handleCopy}
          className="hover:text-white transition-colors text-neutral-400 p-1 shrink-0 flex items-center gap-1 text-[11px]"
          title="Copiar comando de execução Linux"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
        <span className="text-[10px] text-neutral-500 font-mono">
          {new Date(result.timestamp).toLocaleTimeString()}
        </span>

        <button
          onClick={handleOpenBrowserTab}
          className="text-xs text-neutral-300 hover:text-white flex items-center gap-1 hover:underline"
        >
          <span>Abrir URL no Navegador</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
