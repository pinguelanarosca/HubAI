import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  Terminal,
  Shield,
  ExternalLink,
  X
} from '../utils/icons.js';
import { UpdateStatus, UpdateApplyResult } from '../types.js';
import { fetchUpdateStatus, applyHubUpdate } from '../services/api.js';

interface UpdateModalProps {
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ onClose }) => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const loadStatus = async (force: boolean = false) => {
    setChecking(true);
    setError(null);
    try {
      const data = await fetchUpdateStatus(force);
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao verificar atualizações.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  const handleApplyUpdate = async () => {
    if (!window.confirm('Deseja iniciar a atualização segura? Um backup automático da versão atual será criado antes da instalação.')) {
      return;
    }

    setUpdating(true);
    setError(null);
    setUpdateResult(null);

    try {
      const res = await applyHubUpdate();
      setUpdateResult(res);
      if (res.success) {
        // Refresh status after update
        loadStatus(true);
      } else {
        setError(res.error || res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Falha durante o processo de atualização.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span>Atualizador do HubAI</span>
                <span className="text-[10px] bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded text-neutral-400 font-mono">
                  Linux
                </span>
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Verificação com backup automático e rollback seguro
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Status Box */}
          {checking ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-neutral-300">Consultando repositório GitHub (pinguelanarosca/HubAI)...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Aviso ao Verificar Atualizações:</span>
                <p className="leading-relaxed opacity-90">{error}</p>
                <button
                  onClick={() => loadStatus(true)}
                  className="mt-3 px-3 py-1 bg-rose-900/60 hover:bg-rose-900 border border-rose-700 rounded text-[11px] text-white transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          ) : status ? (
            <>
              {/* Main Update State Card */}
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                  status.hasUpdate
                    ? 'bg-indigo-950/30 border-indigo-800/60 text-indigo-300'
                    : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {status.hasUpdate ? (
                    <Download className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold">
                      {status.hasUpdate
                        ? 'Nova versão do HubAI disponível no GitHub!'
                        : 'HubAI já está atualizado.'}
                    </h3>
                    <p className="text-xs opacity-80 mt-1 leading-normal">
                      {status.hasUpdate
                        ? 'Uma atualização foi encontrada no repositório. O processo criará um backup de segurança antes de aplicar a nova versão.'
                        : 'Você está utilizando a versão mais recente registrada para o seu ambiente.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => loadStatus(true)}
                  disabled={checking || updating}
                  className="px-2.5 py-1 text-xs rounded bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-700/60 text-neutral-300 hover:text-white shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                  <span>Verificar</span>
                </button>
              </div>

              {/* Version Comparison Table */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 divide-y divide-neutral-800/80 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Versão Local Instalada:</span>
                  <span className="font-mono text-neutral-200">{status.currentVersion}</span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Commit Instalado:</span>
                  <span className="font-mono text-neutral-300 truncate max-w-[280px]" title={status.installedCommit}>
                    {status.installedCommit.slice(0, 10)}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Último Commit no GitHub:</span>
                  <span className="font-mono text-indigo-300 truncate max-w-[280px]" title={status.latestCommit}>
                    {status.latestCommit.slice(0, 10)}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Última Checagem:</span>
                  <span className="text-neutral-500 font-mono">
                    {new Date(status.lastChecked).toLocaleTimeString()}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Origem:</span>
                  <a
                    href={status.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-indigo-400 flex items-center gap-1 font-mono hover:underline"
                  >
                    <span>pinguelanarosca/HubAI</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Update Result Banner (if updated) */}
              {updateResult && (
                <div
                  className={`p-4 rounded-xl border text-xs ${
                    updateResult.success
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    {updateResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{updateResult.message}</span>
                  </div>
                  {updateResult.backupPath && (
                    <div className="text-[11px] opacity-80 mt-1 font-mono">
                      Backup salvo em: {updateResult.backupPath}
                    </div>
                  )}
                  {updateResult.logs && updateResult.logs.length > 0 && (
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="mt-2 text-[11px] underline hover:text-white"
                    >
                      {showLogs ? 'Ocultar logs de atualização' : 'Ver logs de atualização'}
                    </button>
                  )}
                </div>
              )}

              {/* Logs Drawer */}
              {showLogs && updateResult?.logs && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 max-h-40 overflow-y-auto space-y-1">
                  {updateResult.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}

              {/* Safety Assurances */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Atualização Segura com Rollback Automático:</span>
                </div>
                <p>• Suas configurações e contas em <code className="text-neutral-200">~/.config/hubai/</code> são preservadas intactas.</p>
                <p>• Um backup completo da versão anterior é gerado em <code className="text-neutral-200">~/.config/hubai/backups/</code>.</p>
                <p>• Se a compilação falhar, o rollback é executado automaticamente sem interromper seu fluxo.</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Fechar
          </button>

          {status?.hasUpdate && (
            <button
              onClick={handleApplyUpdate}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-indigo-950/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
              <span>{updating ? 'Instalando Atualização...' : 'Instalar Atualização com Backup'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
