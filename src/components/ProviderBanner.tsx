import React, { useState } from 'react';
import { AIProvider } from '../types.js';
import { getProviderIcon, ExternalLink, Copy, Check, Info } from '../utils/icons.js';

interface ProviderBannerProps {
  provider: AIProvider;
  accountCount: number;
}

export const ProviderBanner: React.FC<ProviderBannerProps> = ({ provider, accountCount }) => {
  const [copied, setCopied] = useState(false);
  const Icon = getProviderIcon(provider.icon);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(provider.defaultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-neutral-100 shrink-0 shadow-inner">
            <Icon className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-neutral-100 tracking-tight">
                {provider.name}
              </h1>
              {provider.badge && (
                <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700/60">
                  {provider.badge}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              {provider.description}
            </p>

            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
              <span className="text-neutral-500">Destino:</span>
              <code className="text-neutral-300 font-mono text-[11px] bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                {provider.defaultUrl}
              </code>

              <button
                onClick={handleCopyUrl}
                className="hover:text-neutral-200 transition-colors inline-flex items-center gap-1 text-[11px] text-neutral-400"
                title="Copiar URL de destino"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar URL'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Info Box */}
        <div className="bg-neutral-950/70 border border-neutral-800/70 rounded-lg p-3 text-xs text-neutral-400 max-w-sm">
          <div className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Isolamento Estrito Garantido</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-normal">
            Clique no card da conta desejada. O Chrome abrirá com a flag{' '}
            <code className="text-neutral-300 bg-neutral-900 px-1 py-0.5 rounded text-[10px]">
              --profile-directory
            </code>{' '}
            preservando a sessão exata daquela conta Google.
          </p>
        </div>
      </div>
    </div>
  );
};
