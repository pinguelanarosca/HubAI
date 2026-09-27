import React, { useState } from 'react';
import { exportDesktopShortcuts } from '../services/api.js';
import { Terminal, Download, Check, Copy, Shield, ExternalLink, Activity } from '../utils/icons.js';

interface LinuxShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LinuxShortcutsModal: React.FC<LinuxShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{
    totalShortcuts: number;
    installedCount: number;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const handleInstallDesktopShortcuts = async () => {
    setInstalling(true);
    try {
      const res = await exportDesktopShortcuts();
      setInstallResult({
        totalShortcuts: res.totalShortcuts,
        installedCount: res.installedCount
      });
    } catch (err) {
      console.error('Falha ao instalar atalhos:', err);
    } finally {
      setInstalling(false);
    }
  };

  const sampleBashCommand = `curl -sSL /api/export/bash-script -o ~/ai-hub.sh && chmod +x ~/ai-hub.sh && ~/ai-hub.sh`;

  const handleCopyBash = () => {
    navigator.clipboard.writeText(sampleBashCommand);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Integração Nativa com Linux
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Atalhos de menu (.desktop) e script CLI para terminal
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Fechar
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Desktop Shortcuts (.desktop files) */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-neutral-200">
                  Instalar Atalhos no Menu do Linux (.desktop)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Cria arquivos em <code>~/.local/share/applications/</code> para abrir diretamente
                  do menu de aplicativos do GNOME, KDE, XFCE ou Rofi.
                </p>
              </div>

              <button
                onClick={handleInstallDesktopShortcuts}
                disabled={installing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 shrink-0"
              >
                {installResult ? <Check className="w-3.5 h-3.5" /> : null}
                <span>
                  {installResult
                    ? `${installResult.installedCount} Instalados!`
                    : installing
                    ? 'Instalando...'
                    : 'Gerar Atalhos'}
                </span>
              </button>
            </div>

            {installResult && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300">
                ✓ {installResult.installedCount} atalhos .desktop gerados com sucesso para os menus do Linux.
              </div>
            )}
          </div>

          {/* Section 2: Standalone Bash Script */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-neutral-200">
                  Script Bash Interativo para Terminal
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Um script interativo em Shell para você escolher Provedor → Conta diretamente no terminal Linux.
                </p>
              </div>

              <a
                href="/api/export/bash-script"
                download="ai-account-hub.sh"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar .sh</span>
              </a>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between font-mono text-xs text-neutral-300">
              <span className="truncate pr-2">{sampleBashCommand}</span>
              <button
                onClick={handleCopyBash}
                className="hover:text-white transition-colors text-neutral-400 p-1"
                title="Copiar comando"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Section 3: Isolation Technical Reference */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs text-neutral-400">
            <div className="flex items-center gap-2 text-neutral-300 font-medium">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Como Funciona o Isolamento Estrito</span>
            </div>
            <p className="leading-relaxed">
              O aplicativo invoca o Google Chrome com o parâmetro:
            </p>
            <pre className="p-2 bg-neutral-900 rounded font-mono text-[11px] text-neutral-300 overflow-x-auto">
              google-chrome --profile-directory=&quot;Profile X&quot; --new-window &quot;https://...&quot;
            </pre>
            <p className="leading-relaxed">
              Nenhuma senha ou cookie é acessado pelo hub. O Chrome carrega exclusivamente o
              banco de dados de sessão e cookies já existente naquele perfil específico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
