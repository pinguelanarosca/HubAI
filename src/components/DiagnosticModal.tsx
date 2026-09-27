import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Terminal,
  ExternalLink,
  Layers,
  Folder,
  User
} from '../utils/icons.js';
import { DiagnosticReport } from '../types.js';
import { runDiagnostics } from '../services/api.js';

interface DiagnosticModalProps {
  report: DiagnosticReport | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  report: initialReport,
  onClose,
  onRefresh
}) => {
  const [report, setReport] = useState<DiagnosticReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const handleRunDiagnostic = async () => {
    setLoading(true);
    try {
      const newReport = await runDiagnostics();
      setReport(newReport);
      onRefresh();
    } catch (err) {
      console.error('Erro ao executar diagnóstico:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: 'passed' | 'warning' | 'failed' | 'pending') => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'pending':
        return <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Diagnóstico de Integridade do Sistema Linux
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Auditoria em tempo real de perfis reais do Chrome, executáveis e integridade de isolamento
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDiagnostic}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Testando...' : 'Re-executar Testes'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {report ? (
            <>
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report.overallStatus === 'passed'
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : report.overallStatus === 'warning'
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(report.overallStatus)}
                  <div>
                    <h3 className="text-sm font-semibold">
                      {report.overallStatus === 'passed' && 'Perfis e Sistema Validados com Sucesso'}
                      {report.overallStatus === 'warning' && 'Sistema Operacional com Alertas / Avisos'}
                      {report.overallStatus === 'failed' && 'Falhas Detectadas no Ambiente ou Perfis'}
                    </h3>
                    <p className="text-xs opacity-80 mt-0.5 font-mono">
                      Verificado em {new Date(report.timestamp).toLocaleTimeString()} · Base: {report.summary?.userDataDirUsed || '~/.config/google-chrome'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-700/60 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showLogs ? 'Ocultar Log' : 'Ver Log Técnico'}</span>
                </button>
              </div>

              {/* Summary Stats Grid */}
              {report.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3">
                    <span className="text-[11px] text-neutral-400 block font-medium">Perfis no Disco</span>
                    <span className="text-lg font-bold text-neutral-100 font-mono">
                      {report.summary.discoveredProfilesCount}
                    </span>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">descobertos em tempo real</span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3">
                    <span className="text-[11px] text-neutral-400 block font-medium">Contas Vinculadas</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {report.summary.linkedAccountsCount}
                    </span>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">com perfil real existente</span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3">
                    <span className="text-[11px] text-neutral-400 block font-medium">Contas Incompletas</span>
                    <span className={`text-lg font-bold font-mono ${report.summary.unlinkedAccountsCount > 0 ? 'text-rose-400' : 'text-neutral-300'}`}>
                      {report.summary.unlinkedAccountsCount}
                    </span>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">perfil ausente no disco</span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3">
                    <span className="text-[11px] text-neutral-400 block font-medium">Perfis Livres</span>
                    <span className="text-lg font-bold text-neutral-200 font-mono">
                      {report.summary.unlinkedProfilesCount}
                    </span>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">disponíveis para vincular</span>
                  </div>
                </div>
              )}

              {/* Execution Logs Drawer */}
              {showLogs && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 font-mono text-[11px] text-neutral-300 max-h-48 overflow-y-auto">
                  <div className="text-neutral-500 mb-2">// LOGS DE VERIFICAÇÃO DO SISTEMA</div>
                  {report.logs.map((log, index) => (
                    <div key={index} className="py-0.5 leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Core Verification Cards */}
              <div className="space-y-4">
                {/* Browser & Chrome Directory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Browser Binary */}
                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.browserCheck.status)}
                        <span className="text-xs font-semibold text-neutral-200">
                          1. Executável do Navegador
                        </span>
                      </div>
                      <span className="text-[11px] font-mono uppercase text-neutral-500">
                        {report.browserCheck.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-2 font-medium">
                      {report.browserCheck.message}
                    </p>
                    {report.browserCheck.details && (
                      <p className="text-[11px] text-neutral-500 mt-1 leading-normal">
                        {report.browserCheck.details}
                      </p>
                    )}
                  </div>

                  {/* Chrome User Data Directory */}
                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.userDataDirCheck.status)}
                        <span className="text-xs font-semibold text-neutral-200">
                          2. Diretório Base de Perfis
                        </span>
                      </div>
                      <span className="text-[11px] font-mono uppercase text-neutral-500">
                        {report.userDataDirCheck.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-2 font-medium">
                      {report.userDataDirCheck.message}
                    </p>
                    {report.userDataDirCheck.details && (
                      <p className="text-[11px] text-neutral-500 mt-1 leading-normal">
                        {report.userDataDirCheck.details}
                      </p>
                    )}
                  </div>
                </div>

                {/* Isolation & Mapping Integrity */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.isolationCheck.status)}
                      <span className="text-xs font-semibold text-neutral-200">
                        3. Integridade do Isolamento (Conta → Perfil Chrome)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono uppercase text-neutral-500">
                      {report.isolationCheck.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 mt-1 font-medium">
                    {report.isolationCheck.message}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                    {report.isolationCheck.details}
                  </p>
                </div>

                {/* Accounts & Chrome Profiles Table */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span>4. Auditoria Individual das Contas Configuradas ({report.accountsProfileCheck.length})</span>
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Validação estrita no sistema de arquivos
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-800/60 max-h-60 overflow-y-auto">
                    {report.accountsProfileCheck.map(acc => (
                      <div key={acc.accountId} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5">{getStatusIcon(acc.status)}</div>
                          <div className="min-w-0">
                            <span className="font-semibold text-neutral-200 block truncate">
                              {acc.accountName}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-mono block">
                              Perfil: {acc.profileDir} {acc.userDataDir ? `(${acc.userDataDir})` : ''}
                            </span>
                            <span className="text-[10px] text-neutral-500 mt-0.5 block leading-tight">
                              {acc.message}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                            acc.status === 'passed'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : acc.status === 'warning'
                              ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                              : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                          }`}
                        >
                          {acc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Provider URLs */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                      <span>5. Validação de URLs dos Provedores ({report.urlCheck.length})</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {report.urlCheck.map(u => (
                      <div
                        key={u.providerId}
                        className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-neutral-200 block truncate">
                            {u.providerName}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono truncate block">
                            {u.url}
                          </span>
                        </div>
                        {getStatusIcon(u.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-neutral-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-neutral-400">Executando diagnósticos do sistema Linux...</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 flex items-center justify-between bg-neutral-950 text-xs text-neutral-500">
          <span>O HubAI nunca copia cookies, senhas ou tokens secretos.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
