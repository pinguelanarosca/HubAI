import React, { useState } from 'react';
import { LaunchResult } from '../types.js';
import { Check, Copy, ExternalLink, Shield, Terminal, X, AlertTriangle, Settings } from '../utils/icons.js';

interface LaunchNotificationProps {
  result: LaunchResult | null;
  onDismiss: () => void;
  onOpenSettings?: () => void;
}

export const LaunchNotification: React.FC<LaunchNotificationProps> = ({
  result,
  onDismiss,
  onOpenSettings
}) => {
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

  const isFailure = !result.success;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-lg w-full bg-neutral-900 border rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 ${
        isFailure ? 'border-rose-800/90 bg-rose-950/20' : 'border-neutral-700/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isFailure
                ? 'bg-rose-950 border border-rose-800 text-rose-400'
                : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
            }`}
          >
            {isFailure ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-100 flex items-center gap-2">
              <span>{result.accountName}</span>
              <span className="text-neutral-500 font-normal">→</span>
              <span className={isFailure ? 'text-rose-400' : 'text-emerald-400'}>
                {result.providerName}
              </span>
            </h4>
            <span className="text-[11px] text-neutral-400 block font-mono">
              Perfil: <strong className="text-neutral-200">{result.profileDir || 'Indefinido'}</strong>
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

      {/* Error or Warning Message */}
      {isFailure ? (
        <div className="mt-3 p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-md text-xs text-rose-300 leading-normal space-y-2">
          <div>
            <span className="font-semibold block mb-0.5">Erro de Isolamento / Validação:</span>
            <span>{result.message}</span>
          </div>
          {onOpenSettings && (
            <div className="pt-1.5 border-t border-rose-900/40 flex items-center justify-between">
              <button
                onClick={() => {
                  onDismiss();
                  onOpenSettings();
                }}
                className="text-[11px] font-medium text-rose-200 hover:text-white flex items-center gap-1.5 underline underline-offset-2 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configurar Navegador / Sincronizar Perfis</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {result.warning && (
            <div className="mt-2.5 p-2 bg-amber-950/40 border border-amber-800/60 rounded-md text-[11px] text-amber-300 flex items-start gap-1.5 leading-normal">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{result.warning}</span>
            </div>
          )}

          {/* Command Preview */}
          {result.command && (
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
          )}
        </>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
        <span className="text-[10px] text-neutral-500 font-mono">
          {new Date(result.timestamp).toLocaleTimeString()}
        </span>

        {result.targetUrl && (
          <button
            onClick={handleOpenBrowserTab}
            className="text-xs text-neutral-300 hover:text-white flex items-center gap-1 hover:underline"
          >
            <span>Abrir URL no Navegador</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
