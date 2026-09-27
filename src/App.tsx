/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HubConfig, AIProvider, HubAccount, LaunchResult, DiagnosticReport } from './types.js';
import { fetchHubConfig, saveHubConfig, launchPlatform, runDiagnostics } from './services/api.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { ProviderBanner } from './components/ProviderBanner.js';
import { AccountGrid } from './components/AccountGrid.js';
import { DiagnosticModal } from './components/DiagnosticModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { LinuxShortcutsModal } from './components/LinuxShortcutsModal.js';
import { EditAccountModal } from './components/EditAccountModal.js';
import { LaunchNotification } from './components/LaunchNotification.js';
import { RefreshCw, AlertCircle } from './utils/icons.js';

export default function App() {
  const [config, setConfig] = useState<HubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');

  // Launch state
  const [launchingAccountId, setLaunchingAccountId] = useState<string | null>(null);
  const [lastLaunchResult, setLastLaunchResult] = useState<LaunchResult | null>(null);

  // Modals
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<HubAccount | null>(null);

  // Diagnostic state
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const conf = await fetchHubConfig();
      setConfig(conf);

      // Default selected provider
      if (conf.providers.length > 0) {
        const geminiOrFirst = conf.providers.find(p => p.id === 'gemini') || conf.providers[0];
        setSelectedProviderId(geminiOrFirst.id);
      }

      // Run background initial diagnostic
      try {
        const diag = await runDiagnostics();
        setDiagnosticReport(diag);
      } catch (diagErr) {
        console.warn('Initial diagnostics background check:', diagErr);
      }
    } catch (err: any) {
      console.error('Failed to load hub:', err);
      setError(err.message || 'Falha ao inicializar o AI Account Hub');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async (accountId: string, dryRun: boolean = false) => {
    if (!config || !selectedProviderId) return;
    setLaunchingAccountId(accountId);
    try {
      const result = await launchPlatform({
        accountId,
        providerId: selectedProviderId,
        dryRun
      });
      setLastLaunchResult(result);
    } catch (err: any) {
      console.error('Falha ao abrir plataforma:', err);
      setLastLaunchResult({
        success: false,
        command: '',
        providerName: selectedProviderId,
        accountName: accountId,
        profileDir: '',
        targetUrl: '',
        timestamp: new Date().toISOString(),
        mode: 'command_generated',
        message: err.message || 'Erro ao comunicar com o servidor'
      });
    } finally {
      setLaunchingAccountId(null);
    }
  };

  const handleSaveAccount = async (updated: HubAccount) => {
    if (!config) return;
    const updatedAccounts = config.accounts.map(a => (a.id === updated.id ? updated : a));
    const newConfig: HubConfig = {
      ...config,
      accounts: updatedAccounts
    };
    try {
      const saved = await saveHubConfig(newConfig);
      setConfig(saved);
    } catch (err) {
      console.error('Falha ao salvar conta:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-500" />
        <span className="text-xs font-mono tracking-wider uppercase">
          Carregando AI Account Hub...
        </span>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-neutral-100">
          Erro de Inicialização
        </h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-md">
          {error || 'Não foi possível carregar a configuração.'}
        </p>
        <button
          onClick={loadInitialData}
          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const activeProvider =
    config.providers.find(p => p.id === selectedProviderId) || config.providers[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-neutral-800">
      {/* 3-Zone Header */}
      <Header
        activeProvider={activeProvider}
        onOpenDiagnostics={() => setIsDiagnosticOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        diagnosticStatus={diagnosticReport?.overallStatus}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: AI Providers */}
        <Sidebar
          providers={config.providers}
          selectedProviderId={selectedProviderId}
          onSelectProvider={(id) => setSelectedProviderId(id)}
          onAddProvider={() => setIsSettingsOpen(true)}
        />

        {/* Center / Main Canvas */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-neutral-950">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Active Provider Context Banner */}
            {activeProvider && (
              <ProviderBanner
                provider={activeProvider}
                accountCount={config.accounts.length}
              />
            )}

            {/* The 9 Account Cards */}
            {activeProvider && (
              <AccountGrid
                accounts={config.accounts}
                activeProvider={activeProvider}
                onLaunch={handleLaunch}
                onEditAccount={(acc) => setEditingAccount(acc)}
                launchingAccountId={launchingAccountId}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Launch Feedback / Terminal Command Toast */}
      <LaunchNotification
        result={lastLaunchResult}
        onDismiss={() => setLastLaunchResult(null)}
      />

      {/* Comprehensive 5-Point Diagnostic Modal */}
      <DiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        initialReport={diagnosticReport}
        onReportUpdated={(rep) => setDiagnosticReport(rep)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigSaved={(newConf) => setConfig(newConf)}
      />

      {/* Linux Shortcuts & Bash Script Modal */}
      <LinuxShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Quick Edit Single Account Modal */}
      <EditAccountModal
        account={editingAccount}
        isOpen={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        onSave={handleSaveAccount}
        providers={config.providers}
      />
    </div>
  );
}
