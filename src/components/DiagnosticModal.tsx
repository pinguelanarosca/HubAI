import React, { useState } from 'react';
import { DiagnosticReport } from '../types.js';
import { runDiagnostics } from '../services/api.js';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Terminal,
  Shield,
  ExternalLink
} from '../utils/icons.js';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReport: DiagnosticReport | null;
  onReportUpdated: (report: DiagnosticReport) => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  initialReport,
  onReportUpdated
}) => {
  const [report, setReport] = useState<DiagnosticReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  if (!isOpen) return null;

  const handleRunDiagnostic = async () => {
    setLoading(true);
    try {
      const newReport = await runDiagnostics();
      setReport(newReport);
      onReportUpdated(newReport);
    } catch (err) {
      console.error('Falha ao rodar diagnóstico:', err);
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
                Verificação ponta a ponta dos 5 requisitos de perfis Chrome, binários e isolamento
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
                      {report.overallStatus === 'passed' && 'Sistema Pronto & Perfis Validados'}
                      {report.overallStatus === 'warning' && 'Sistema Operacional com Avisos'}
                      {report.overallStatus === 'failed' && 'Falhas Detectadas no Ambiente'}
                    </h3>
                    <p className="text-xs opacity-80 mt-0.5">
                      Verificado em {new Date(report.timestamp).toLocaleTimeString()} · Isolamento de sessão ativo.
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

              {/* 5 Core Verification Cards */}
              <div className="space-y-4">
                {/* 1 & 2: Browser & Chrome Directory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Browser Binary */}
                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.browserCheck.status)}
                        <span className="text-xs font-semibold text-neutral-200">
                          3. Inicialização do Navegador
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
                          2. Diretório de Dados Chrome
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

                {/* 5: Isolation & Mapping Integrity */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.isolationCheck.status)}
                      <span className="text-xs font-semibold text-neutral-200">
                        5. Integridade do Isolamento (Conta → Perfil Chrome)
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

                {/* 1 & 2: Detailed 9 Accounts & Chrome Profiles Table */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-200">
                      1 & 2. Verificação das 9 Contas e Diretórios de Perfil
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {report.accountsProfileCheck.length} perfis validados
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-900 border border-neutral-900 rounded-lg overflow-hidden">
                    {report.accountsProfileCheck.map((item) => (
                      <div
                        key={item.accountId}
                        className="px-3 py-2 flex items-center justify-between text-xs hover:bg-neutral-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getStatusIcon(item.status)}
                          <span className="text-neutral-200 font-medium truncate">
                            {item.accountName}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-500">
                            [{item.profileDir}]
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 truncate max-w-xs text-right">
                          {item.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4: Target URLs Check */}
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-200">
                      4. Verificação de URLs dos Provedores de IA
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {report.urlCheck.length} provedores testados
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {report.urlCheck.map((item) => (
                      <div
                        key={item.providerId}
                        className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-900 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(item.status)}
                          <span className="text-neutral-300 font-medium truncate">
                            {item.providerName}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-mono truncate max-w-[140px]">
                          {item.url.replace('https://', '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-500" />
              <span>Carregando dados de diagnóstico...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
