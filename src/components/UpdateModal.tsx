import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  Terminal,
  Shield,
  ExternalLink,
  X,
  GitCommit,
  FileText,
  FileCode,
  ChevronDown,
  ChevronUp,
  Clock
} from '../utils/icons.js';
import { UpdateStatus, UpdateApplyResult } from '../types.js';
import { fetchUpdateStatus, applyHubUpdate } from '../services/api.js';

interface UpdateModalProps {
  onClose: () => void;
}

type UpdatePhase = 'idle' | 'checking' | 'available' | 'updating' | 'restarting' | 'updated' | 'error';

export const UpdateModal: React.FC<UpdateModalProps> = ({ onClose }) => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [updateResult, setUpdateResult] = useState<UpdateApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showFilesList, setShowFilesList] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef<number | null>(null);

  const loadStatus = async (force: boolean = false) => {
    setPhase('checking');
    setError(null);
    try {
      const data = await fetchUpdateStatus(force);
      setStatus(data);
      if (data.hasUpdate) {
        setPhase('available');
      } else {
        setPhase('idle');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao verificar atualizações no repositório.');
      setPhase('error');
    }
  };

  useEffect(() => {
    loadStatus(false);
    return () => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
      }
    };
  }, []);

  const pollServerRestart = (attempt: number = 0) => {
    setPollCount(attempt);
    if (attempt > 40) {
      setError('O servidor demorou mais do que o esperado para reiniciar. Verifique os logs em ~/.config/hubai/logs/updater.log.');
      setPhase('error');
      return;
    }

    pollingRef.current = window.setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/config', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const freshStatus = await fetchUpdateStatus(true).catch(() => null);
          if (freshStatus) setStatus(freshStatus);
          setPhase('updated');
          // Auto reload page to reflect new application build
          window.setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          pollServerRestart(attempt + 1);
        }
      } catch {
        pollServerRestart(attempt + 1);
      }
    }, 2000);
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm('Deseja iniciar a atualização autônoma? Um backup completo da versão atual será criado em ~/.config/hubai/backups/ antes de compilar a nova versão.')) {
      return;
    }

    setPhase('updating');
    setError(null);
    setUpdateResult(null);

    try {
      const res = await applyHubUpdate();
      setUpdateResult(res);
      if (res.success) {
        // External updater has taken over the update lifecycle and will restart the server
        setPhase('restarting');
        pollServerRestart(1);
      } else {
        setError(res.error || res.message);
        setPhase('error');
      }
    } catch (err: any) {
      // If connection was severed because server is restarting right away, also begin polling
      setPhase('restarting');
      pollServerRestart(1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <RefreshCw className={`w-4 h-4 ${phase === 'checking' || phase === 'updating' || phase === 'restarting' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span>Atualizador Autônomo do HubAI</span>
                <span className="text-[10px] bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded text-neutral-400 font-mono">
                  Linux
                </span>
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Atualização externa independente com backup automático e rollback
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
          {/* Phase: Checking */}
          {phase === 'checking' && (
            <div className="py-12 text-center">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-neutral-300 font-medium">Verificando atualizações...</p>
              <p className="text-[11px] text-neutral-500 mt-1">Consultando commits no GitHub (pinguelanarosca/HubAI)...</p>
            </div>
          )}

          {/* Phase: Updating / Compiling */}
          {phase === 'updating' && (
            <div className="py-10 text-center space-y-3 bg-neutral-950/50 border border-neutral-800 rounded-xl p-6">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <h3 className="text-sm font-semibold text-neutral-200">Atualizando HubAI...</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                O atualizador externo autônomo está criando backup em <code className="text-neutral-300">~/.config/hubai/backups/</code>, obtendo a versão recente e compilando a nova instalação em diretório temporário isolado.
              </p>
            </div>
          )}

          {/* Phase: Restarting & Polling */}
          {phase === 'restarting' && (
            <div className="py-10 text-center space-y-3 bg-neutral-950/50 border border-indigo-900/50 rounded-xl p-6">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <h3 className="text-sm font-semibold text-indigo-300">Reiniciando HubAI...</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                A nova versão foi compilada com sucesso. O processo antigo foi finalizado e a nova instância do HubAI está iniciando.
              </p>
              <div className="text-[11px] font-mono text-neutral-500">
                Aguardando reconexão (tentativa {pollCount}/40)...
              </div>
            </div>
          )}

          {/* Phase: Updated Success */}
          {phase === 'updated' && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Atualizado com sucesso!</span>
              </div>
              <p className="text-emerald-400/90 leading-relaxed">
                O HubAI foi atualizado para a versão mais recente e reiniciado automaticamente. Suas configurações em <code className="text-neutral-200">~/.config/hubai/</code> foram preservadas intactas.
              </p>
              <div className="pt-2 border-t border-emerald-900/40 flex items-center justify-between font-mono text-[11px] text-neutral-400">
                <span>Commit ativo: <strong className="text-neutral-200">{status?.latestCommit?.slice(0, 10) || 'recente'}</strong></span>
                <button
                  onClick={() => window.location.reload()}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-sans font-medium transition-colors"
                >
                  Recarregar Interface
                </button>
              </div>
            </div>
          )}

          {/* Phase: Error / Rollback */}
          {error && phase !== 'updating' && phase !== 'restarting' && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-1">Falha / Rollback Realizado:</span>
                <p className="leading-relaxed opacity-90">{error}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => loadStatus(true)}
                    className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 border border-rose-700 rounded text-[11px] text-white transition-colors"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version Details when idle or available */}
          {status && phase !== 'updating' && phase !== 'restarting' && (
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
                        ? 'Atualização disponível no GitHub!'
                        : 'HubAI sincronizado com o repositório.'}
                    </h3>
                    <p className="text-xs opacity-80 mt-1 leading-normal">
                      {status.hasUpdate
                        ? 'Uma nova versão está disponível no repositório oficial. A atualização será executada de forma atômica por um processo externo com backup prévio.'
                        : 'Sua instalação está idêntica ou atualizada com o repositório GitHub.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => loadStatus(true)}
                    disabled={phase === 'checking'}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-700/80 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${phase === 'checking' ? 'animate-spin' : ''}`} />
                    <span>Verificar</span>
                  </button>

                  <button
                    onClick={handleApplyUpdate}
                    disabled={phase === 'checking'}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium shadow-md transition-colors flex items-center gap-1.5 ${
                      status.hasUpdate
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{status.hasUpdate ? 'Atualizar Agora' : 'Forçar Atualização'}</span>
                  </button>
                </div>
              </div>

              {/* Version Comparison Table */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 divide-y divide-neutral-800/80 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-neutral-400">Versão Local:</span>
                  <span className="font-mono text-neutral-200">{status.currentVersion}</span>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-neutral-400 shrink-0">Commit Instalado:</span>
                  <div className="text-right">
                    <span className="font-mono text-neutral-300 block" title={status.installedCommit}>
                      {status.installedCommit.slice(0, 10)}
                    </span>
                    {status.installedCommitDate && (
                      <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                        {new Date(status.installedCommitDate).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-neutral-400 shrink-0">Último Commit no GitHub:</span>
                  <div className="text-right">
                    <span className="font-mono text-indigo-300 block" title={status.latestCommit}>
                      {status.latestCommit.slice(0, 10)}
                    </span>
                    {status.latestCommitDate && (
                      <span className="text-[10px] text-indigo-400/80 font-mono block mt-0.5">
                        {new Date(status.latestCommitDate).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {status.commitMessage && (
                  <div className="py-2 flex items-start justify-between gap-2">
                    <span className="text-neutral-400 shrink-0">Mensagem do Commit:</span>
                    <span className="font-mono text-neutral-300 text-right truncate max-w-[320px]">
                      {status.commitMessage}
                    </span>
                  </div>
                )}

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

              {/* GitHub vs Machine Difference Summary */}
              {status.hasUpdate && status.diffSummary && (
                <div className="p-4 bg-indigo-950/20 border border-indigo-900/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                      <GitCommit className="w-4 h-4 text-indigo-400" />
                      <span>Resumo de Diferenças (GitHub vs Sua Máquina)</span>
                    </span>
                    <span className="text-[11px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/80">
                      {status.diffSummary.commitsCount} commit(s) à frente
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {status.diffSummary.description}
                  </p>

                  {/* Commit Log List */}
                  {status.diffSummary.commits && status.diffSummary.commits.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-indigo-900/40">
                      <span className="text-[11px] font-medium text-neutral-400 block">Commits novos a serem aplicados:</span>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {status.diffSummary.commits.map((c, idx) => (
                          <div key={idx} className="p-1.5 bg-neutral-950/80 rounded border border-neutral-800 flex items-center justify-between text-[11px] gap-2 font-mono">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-indigo-400 font-bold shrink-0">{c.sha}</span>
                              <span className="text-neutral-300 truncate">{c.message}</span>
                            </div>
                            {c.date && (
                              <span className="text-[10px] text-neutral-500 shrink-0">
                                {new Date(c.date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Changed Files Description */}
              {status.changedFiles && status.changedFiles.length > 0 && (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <button
                    onClick={() => setShowFilesList(!showFilesList)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-neutral-200">
                        Descrição dos Arquivos Alterados ({status.changedFiles.length})
                      </span>
                    </div>
                    {showFilesList ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {showFilesList && (
                    <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1 text-xs">
                      {status.changedFiles.map((file, idx) => {
                        let statusColor = 'text-amber-400 bg-amber-950/50 border-amber-900/60';
                        let statusLabel = 'Modificado';
                        if (file.status === 'added') {
                          statusColor = 'text-emerald-400 bg-emerald-950/50 border-emerald-900/60';
                          statusLabel = 'Adicionado';
                        } else if (file.status === 'removed') {
                          statusColor = 'text-rose-400 bg-rose-950/50 border-rose-900/60';
                          statusLabel = 'Removido';
                        } else if (file.status === 'renamed') {
                          statusColor = 'text-purple-400 bg-purple-950/50 border-purple-900/60';
                          statusLabel = 'Renomeado';
                        }

                        return (
                          <div
                            key={idx}
                            className="p-2 bg-neutral-900/80 rounded-lg border border-neutral-800 flex items-center justify-between gap-2 font-mono text-[11px]"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-1.5 py-0.5 text-[10px] rounded border font-sans font-medium ${statusColor}`}>
                                {statusLabel}
                              </span>
                              <span className="text-neutral-200 truncate" title={file.filename}>
                                {file.filename}
                              </span>
                            </div>

                            {(file.additions > 0 || file.deletions > 0) && (
                              <div className="flex items-center gap-1.5 text-[10px] shrink-0 font-bold">
                                {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                                {file.deletions > 0 && <span className="text-rose-400">-{file.deletions}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Update Result Logs Banner */}
              {updateResult && updateResult.logs && updateResult.logs.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-[11px] text-neutral-400 hover:text-white underline"
                  >
                    {showLogs ? 'Ocultar detalhes da operação' : 'Ver detalhes da operação'}
                  </button>

                  {showLogs && (
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 max-h-36 overflow-y-auto space-y-1">
                      {updateResult.logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Safety Assurances */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Segurança e Isolamento:</span>
                </div>
                <p>• Suas configurações em <code className="text-neutral-200">~/.config/hubai/</code> são preservadas intactas.</p>
                <p>• O atualizador autônomo compila a nova versão em área isolada antes de aplicar qualquer alteração.</p>
                <p>• Se houver falha de compilação ou rede, o rollback automático restaura a versão anterior sem intervenção manual.</p>
                <p>• Nenhum dado, cookie ou perfil do Chrome é modificado ou exposto.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
          <button
            onClick={onClose}
            disabled={phase === 'updating' || phase === 'restarting'}
            className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Fechar
          </button>

          {status && phase !== 'updating' && phase !== 'restarting' && (
            <button
              onClick={handleApplyUpdate}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg shadow-lg transition-colors ${
                status.hasUpdate
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50 font-semibold'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{status.hasUpdate ? 'Atualizar Hub Agora' : 'Forçar Atualização do Hub'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
