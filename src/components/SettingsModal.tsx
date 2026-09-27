import React, { useState, useEffect } from 'react';
import {
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Folder,
  Layers,
  Sparkles,
  Bot,
  Brain,
  Zap,
  Globe,
  Compass,
  Code,
  Cpu,
  User,
  Shield,
  Briefcase,
  Archive,
  Download,
  Check,
  Copy,
  Terminal,
  X
} from '../utils/icons.js';
import {
  HubConfig,
  HubAccount,
  AIProvider,
  DetectedProfile,
  ProfileSyncResult,
  ProfileSyncMatch,
  ProfileImportBinding,
  BrowserVariant
} from '../types.js';
import {
  saveHubConfig,
  resetHubConfig,
  syncChromeAccounts,
  importMatchedProfiles,
  fetchBrowserVariants,
  fetchUninstallInfo,
  requestSystemUninstall,
  UninstallInfo
} from '../services/api.js';

interface SettingsModalProps {
  config: HubConfig;
  onClose: () => void;
  onConfigSaved: (newConfig: HubConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onClose,
  onConfigSaved
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'providers' | 'system' | 'uninstall'>('accounts');
  const [localConfig, setLocalConfig] = useState<HubConfig>(JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronization state
  const [syncResult, setSyncResult] = useState<ProfileSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [browserVariants, setBrowserVariants] = useState<BrowserVariant[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);

  // Uninstall state
  const [uninstallInfo, setUninstallInfo] = useState<UninstallInfo | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const [uninstallResult, setUninstallResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    fetchBrowserVariants()
      .then(setBrowserVariants)
      .catch((err) => console.warn('Erro ao carregar variantes de navegadores:', err));

    fetchUninstallInfo()
      .then(setUninstallInfo)
      .catch((err) => console.warn('Erro ao carregar informações de desinstalação:', err));
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleTriggerUninstall = async (purge: boolean) => {
    const confirmMsg = purge
      ? 'ATENÇÃO: Isso irá encerrar o HubAI e apagar COMPLETAMENTE todos os arquivos, executáveis, logs, atalhos e configurações (~/.config/hubai) do seu computador.\n\nDeseja prosseguir com a LIMPEZA TOTAL?'
      : 'Isso irá desinstalar o aplicativo HubAI, mantendo suas contas salvas em ~/.config/hubai para reinstalações futuras.\n\nDeseja prosseguir com a desinstalação?';

    if (!window.confirm(confirmMsg)) return;

    setUninstalling(true);
    try {
      const res = await requestSystemUninstall(purge);
      setUninstallResult({ success: true, message: res.message });
    } catch (err: any) {
      setUninstallResult({ success: false, message: err.message || 'Erro ao solicitar desinstalação.' });
    } finally {
      setUninstalling(false);
    }
  };

  const handleSyncChromeAccounts = async (targetDir?: string) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncChromeAccounts(targetDir || localConfig.system.chromeUserDataDir);
      setSyncResult(result);
      if (result.browserVariants) {
        setBrowserVariants(result.browserVariants);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Erro ao sincronizar perfis com o Google Chrome.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyDiscoveredProfiles = () => {
    if (!syncResult || syncResult.matches.length === 0) return;

    // Build the bindings according to verified match priority ONLY (email -> name -> directory)
    // Never auto-import suggestions or unconfirmed matches
    const bindings = syncResult.matches
      .filter((m) => m.matchedAccountId && m.detectedProfile.exists && m.matchType !== 'none')
      .map((m) => {
        const currentAcc = localConfig.accounts.find((a) => a.id === m.matchedAccountId);
        return {
          accountId: m.matchedAccountId!,
          profileDir: m.detectedProfile.dirName,
          userDataDir: m.detectedProfile.userDataDir,
          name: m.detectedProfile.displayName || currentAcc?.name,
          email: m.detectedProfile.email || currentAcc?.email
        };
      });

    // Check for duplicate profile bindings in the batch
    const seenDirs = new Set<string>();
    const safeBindings: ProfileImportBinding[] = [];
    for (const b of bindings) {
      const key = `${b.userDataDir || ''}::${b.profileDir}`;
      if (!seenDirs.has(key)) {
        seenDirs.add(key);
        safeBindings.push(b);
      }
    }

    if (safeBindings.length === 0) {
      setSyncError('Nenhuma correspondência comprovada encontrada para importar automaticamente. Use a vinculação manual abaixo.');
      return;
    }

    // Apply to local config state
    const updatedAccounts = localConfig.accounts.map((acc) => {
      const matched = safeBindings.find((b) => b.accountId === acc.id);
      if (!matched) return acc;
      return {
        ...acc,
        chromeProfileDir: matched.profileDir,
        userDataDir: matched.userDataDir,
        name: matched.name || acc.name,
        email: matched.email || acc.email
      };
    });

    setLocalConfig({
      ...localConfig,
      accounts: updatedAccounts
    });

    setShowImportPreview(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExplicitLinkProfile = (detected: DetectedProfile, targetAccountId: string) => {
    if (!targetAccountId) return;
    const currentAcc = localConfig.accounts.find((a) => a.id === targetAccountId);
    if (!currentAcc) return;

    // Check collision
    const collision = localConfig.accounts.find(
      (a) =>
        a.id !== targetAccountId &&
        a.chromeProfileDir === detected.dirName &&
        (a.userDataDir || localConfig.system.chromeUserDataDir) === detected.userDataDir
    );

    if (collision) {
      setSyncError(`O perfil "${detected.dirName}" já está associado à conta "${collision.name}".`);
      return;
    }

    setSyncError(null);
    setLocalConfig((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) => {
        if (acc.id !== targetAccountId) return acc;
        return {
          ...acc,
          chromeProfileDir: detected.dirName,
          userDataDir: detected.userDataDir,
          name: detected.displayName || acc.name,
          email: detected.email || acc.email
        };
      })
    }));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveHubConfig(localConfig);
      onConfigSaved(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setSaveError(err.message || 'Erro ao validar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Tem certeza que deseja redefinir todas as configurações para o padrão de fábrica?')) {
      try {
        const reset = await resetHubConfig();
        setLocalConfig(reset);
        onConfigSaved(reset);
      } catch (err: any) {
        setSaveError(err.message);
      }
    }
  };

  const handleUpdateAccount = (id: string, updates: Partial<HubAccount>) => {
    setLocalConfig((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a))
    }));
  };

  const handleUpdateProvider = (id: string, updates: Partial<AIProvider>) => {
    setLocalConfig((prev) => ({
      ...prev,
      providers: prev.providers.map((p) => (p.id === id ? { ...p, ...updates } : p))
    }));
  };

  const handleAddProvider = () => {
    const newId = `prov_${Date.now()}`;
    const newProv: AIProvider = {
      id: newId,
      name: 'Novo Provedor',
      shortName: 'Novo',
      defaultUrl: 'https://',
      category: 'general',
      icon: 'Bot',
      description: 'Plataforma de inteligência artificial',
      enabled: true,
      order: localConfig.providers.length + 1
    };
    setLocalConfig((prev) => ({
      ...prev,
      providers: [...prev.providers, newProv]
    }));
  };

  const handleDeleteProvider = (id: string) => {
    if (localConfig.providers.length <= 1) {
      alert('É necessário manter pelo menos 1 provedor configurado.');
      return;
    }
    setLocalConfig((prev) => ({
      ...prev,
      providers: prev.providers.filter((p) => p.id !== id)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span>Configurações do AI Account Hub</span>
                <span className="text-[10px] bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded text-neutral-400 font-mono">
                  ~/.config/hubai
                </span>
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Gerencie contas do Chrome, plataformas de IA e caminhos no Linux
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : null}
              <span>{saving ? 'Validando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <span className="font-semibold block mb-0.5">Erro de Validação da Configuração:</span>
              <span>{saveError}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-6 gap-2">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sincronização & Contas Chrome ({localConfig.accounts.length})
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'providers'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Provedores de IA ({localConfig.providers.length})
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sistema Linux & Caminhos
          </button>
          <button
            onClick={() => setActiveTab('uninstall')}
            className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'uninstall'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-neutral-400 hover:text-rose-300'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Desinstalação & Limpeza</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="space-y-5">
              {/* Synchronization Banner */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>Sincronizar Contas Reais do Chrome</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Descobre perfis existentes no Linux lendo metadados locais de <code className="text-neutral-300">Local State</code> e <code className="text-neutral-300">Preferences</code> sem exigir novo login.
                    </p>
                  </div>

                  <button
                    onClick={() => handleSyncChromeAccounts()}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Descobrindo Perfis...' : 'Sincronizar Contas do Chrome'}</span>
                  </button>
                </div>

                {/* Browser Variants Quick Selector */}
                {browserVariants.length > 0 && (
                  <div className="pt-2 border-t border-neutral-850 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-neutral-500 font-medium">Navegadores no Linux:</span>
                    {browserVariants.map((b) => {
                      const isReady = b.exists && !!b.detectedBinary;
                      return (
                        <button
                          key={b.id}
                          disabled={!isReady}
                          onClick={() => {
                            if (!isReady || !b.detectedBinary) return;
                            setLocalConfig((prev) => ({
                              ...prev,
                              system: {
                                ...prev.system,
                                chromeUserDataDir: b.userDataDir,
                                browserCommand: b.detectedBinary!
                              }
                            }));
                            handleSyncChromeAccounts(b.userDataDir);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                            isReady
                              ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-neutral-500 cursor-pointer'
                              : 'bg-neutral-950 border-neutral-850 text-neutral-600 opacity-60 cursor-not-allowed'
                          }`}
                          title={
                            isReady
                              ? `${b.userDataDir} (Executável: ${b.detectedBinary})`
                              : b.exists
                              ? `${b.userDataDir} (Executável não detectado no PATH)`
                              : 'Não instalado no sistema'
                          }
                        >
                          {b.name}{' '}
                          {isReady
                            ? `(${b.profileCount} perfis)`
                            : b.exists
                            ? '(sem executável)'
                            : '(não instalado)'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sync Error */}
              {syncError && (
                <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{syncError}</span>
                </div>
              )}

              {/* Sync Results & Import Action */}
              {syncResult && (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-850 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-200">
                        Perfis Reais Descobertos ({syncResult.stats.totalDetected})
                      </h4>
                      <span className="text-[11px] text-neutral-400">
                        {syncResult.stats.matchedCount} perfis correspondem às suas contas do Hub.
                        {syncResult.stats.unmatchedDetectedCount > 0 &&
                          ` (${syncResult.stats.unmatchedDetectedCount} perfis livres encontrados no Chrome)`}
                      </span>
                    </div>

                    <button
                      onClick={handleApplyDiscoveredProfiles}
                      disabled={syncResult.matches.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Importar perfis encontrados</span>
                    </button>
                  </div>

                  {/* Discovered Profiles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {syncResult.detectedProfiles.map((p) => {
                      const match = syncResult.matches.find((m) => m.detectedProfile.dirName === p.dirName);
                      const isConfirmed = Boolean(match && match.matchedAccountId && match.matchType !== 'none');
                      const suggestedAcc = match?.suggestedAccountId
                        ? localConfig.accounts.find((a) => a.id === match.suggestedAccountId)
                        : undefined;

                      return (
                        <div
                          key={p.dirName}
                          className={`p-3 rounded-lg border space-y-2 text-xs transition-colors ${
                            isConfirmed
                              ? 'bg-neutral-900/90 border-emerald-800/60'
                              : 'bg-neutral-900/50 border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-neutral-100 truncate">
                              {p.displayName || p.dirName}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                                p.isLocked
                                  ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                              }`}
                            >
                              {p.isLocked ? 'Em uso' : 'Detectado'}
                            </span>
                          </div>

                          <div className="text-[11px] text-neutral-400 font-mono truncate">
                            {p.email || 'Email não configurado no perfil'}
                          </div>

                          <div className="text-[10px] text-neutral-500 font-mono truncate" title={p.fullPath}>
                            {p.dirName} ({p.browserType})
                          </div>

                          {/* Match State & Actions */}
                          {isConfirmed && match?.currentAccount && (
                            <div className="pt-1.5 border-t border-emerald-900/40 text-[11px] text-emerald-400 flex items-center justify-between">
                              <span className="truncate">
                                Vinculado a: <strong>{match.currentAccount.name}</strong>
                              </span>
                              <span className="text-[10px] font-mono uppercase bg-emerald-950 px-1 rounded text-emerald-300 border border-emerald-800">
                                {match.matchType}
                              </span>
                            </div>
                          )}

                          {!isConfirmed && suggestedAcc && (
                            <div className="pt-1.5 border-t border-neutral-800 space-y-1.5">
                              <div className="text-[10px] text-amber-400/90 flex items-center justify-between">
                                <span>Sugestão: {suggestedAcc.name}</span>
                                <span className="text-[9px] font-mono text-neutral-500">(Não vinculada)</span>
                              </div>
                              <button
                                onClick={() => handleExplicitLinkProfile(p, suggestedAcc.id)}
                                className="w-full py-1 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] font-medium border border-neutral-700 hover:border-neutral-600 transition-colors text-center"
                              >
                                Vincular a {suggestedAcc.name}
                              </button>
                            </div>
                          )}

                          {!isConfirmed && !suggestedAcc && (
                            <div className="pt-1.5 border-t border-neutral-800 space-y-1">
                              <div className="text-[10px] text-neutral-500">Perfil não associado:</div>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleExplicitLinkProfile(p, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded px-1.5 py-1 text-[11px] text-neutral-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="">Vincular manualmente a uma conta...</option>
                                {localConfig.accounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name} (Atual: {acc.chromeProfileDir})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accounts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-neutral-300">
                    Contas do Hub & Vinculação Determinística ({localConfig.accounts.length})
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    Isolamento por: userDataDir + profileDirectory
                  </span>
                </div>

                {localConfig.accounts.map((acc, index) => (
                  <div
                    key={acc.id}
                    className="p-4 bg-neutral-950 border border-neutral-800/90 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 font-mono text-xs font-bold"
                          style={{ backgroundColor: acc.color }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <input
                            type="text"
                            value={acc.name}
                            onChange={(e) => handleUpdateAccount(acc.id, { name: e.target.value })}
                            className="text-xs font-semibold text-neutral-100 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-52 sm:w-64 focus:outline-none focus:border-neutral-500"
                          />
                          <input
                            type="text"
                            value={acc.email}
                            onChange={(e) => handleUpdateAccount(acc.id, { email: e.target.value })}
                            placeholder="Email da Conta Google"
                            className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 w-52 sm:w-64 mt-1 block font-mono focus:outline-none focus:border-neutral-600"
                          />
                        </div>
                      </div>

                      {/* Chrome Profile Dir & custom User Data Dir assignment */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <label className="text-[10px] uppercase font-semibold text-neutral-500 block">
                            Pasta do Perfil
                          </label>
                          <input
                            type="text"
                            value={acc.chromeProfileDir}
                            onChange={(e) =>
                              handleUpdateAccount(acc.id, { chromeProfileDir: e.target.value })
                            }
                            placeholder="Default, Profile 1..."
                            className="text-xs font-mono text-emerald-400 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-32 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Color picker */}
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-neutral-500 block">
                            Cor
                          </label>
                          <input
                            type="color"
                            value={acc.color}
                            onChange={(e) => handleUpdateAccount(acc.id, { color: e.target.value })}
                            className="w-8 h-7 bg-transparent border-0 cursor-pointer rounded"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom User Data Dir (optional per account) & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={acc.userDataDir || ''}
                        onChange={(e) => handleUpdateAccount(acc.id, { userDataDir: e.target.value || undefined })}
                        placeholder="userDataDir customizado (opcional, padrão do sistema se vazio)"
                        className="text-[11px] font-mono text-neutral-400 bg-neutral-900/60 border border-neutral-800/80 rounded px-2 py-1 focus:outline-none focus:border-neutral-700"
                      />
                      <input
                        type="text"
                        value={acc.notes || ''}
                        onChange={(e) => handleUpdateAccount(acc.id, { notes: e.target.value })}
                        placeholder="Observações da conta"
                        className="text-xs text-neutral-400 bg-neutral-900/60 border border-neutral-800/80 rounded px-2 py-1 focus:outline-none focus:border-neutral-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-200">
                    Provedores de Inteligência Artificial
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Defina as plataformas disponíveis e suas URLs padrão.
                  </p>
                </div>
                <button
                  onClick={handleAddProvider}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Provedor</span>
                </button>
              </div>

              <div className="space-y-3">
                {localConfig.providers.map((prov) => (
                  <div
                    key={prov.id}
                    className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={prov.name}
                            onChange={(e) => handleUpdateProvider(prov.id, { name: e.target.value })}
                            placeholder="Nome Completo (ex: Google Gemini)"
                            className="text-xs font-semibold text-neutral-100 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-48 focus:outline-none focus:border-neutral-500"
                          />
                          <input
                            type="text"
                            value={prov.shortName}
                            onChange={(e) =>
                              handleUpdateProvider(prov.id, { shortName: e.target.value })
                            }
                            placeholder="Nome Curto (ex: Gemini)"
                            className="text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-32 focus:outline-none focus:border-neutral-600"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prov.enabled}
                              onChange={(e) =>
                                handleUpdateProvider(prov.id, { enabled: e.target.checked })
                              }
                              className="rounded bg-neutral-900 border-neutral-700 text-emerald-500"
                            />
                            <span>Habilitado</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500 w-16">URL Padrão:</span>
                          <input
                            type="text"
                            value={prov.defaultUrl}
                            onChange={(e) =>
                              handleUpdateProvider(prov.id, { defaultUrl: e.target.value })
                            }
                            placeholder="https://..."
                            className="flex-1 text-xs font-mono text-neutral-300 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 focus:outline-none focus:border-neutral-600"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500 w-16">Descrição:</span>
                          <input
                            type="text"
                            value={prov.description}
                            onChange={(e) =>
                              handleUpdateProvider(prov.id, { description: e.target.value })
                            }
                            placeholder="Descrição breve da plataforma"
                            className="flex-1 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 focus:outline-none focus:border-neutral-600"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteProvider(prov.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 rounded hover:bg-neutral-900 transition-colors"
                        title="Excluir provedor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM */}
          {activeTab === 'system' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-neutral-200">
                  Configurações do Ambiente Linux & Chrome
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Parâmetros de execução do processo e diretório de perfis no sistema operacional.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Comando do Executável do Navegador
                  </label>
                  <input
                    type="text"
                    value={localConfig.system.browserCommand}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        system: { ...prev.system, browserCommand: e.target.value }
                      }))
                    }
                    placeholder="google-chrome, google-chrome-stable, chromium..."
                    className="w-full text-xs font-mono text-neutral-200 bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 focus:outline-none focus:border-neutral-500"
                  />
                  <span className="text-[11px] text-neutral-500 block">
                    Binário que será executado pelo Linux (verificado no PATH ou caminho absoluto).
                  </span>
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Diretório Base de Perfis Chrome (chromeUserDataDir)
                  </label>
                  <input
                    type="text"
                    value={localConfig.system.chromeUserDataDir}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        system: { ...prev.system, chromeUserDataDir: e.target.value }
                      }))
                    }
                    placeholder="~/.config/google-chrome"
                    className="w-full text-xs font-mono text-neutral-200 bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 focus:outline-none focus:border-neutral-500"
                  />
                  <span className="text-[11px] text-neutral-500 block">
                    Caminho padrão no Linux: <code className="text-neutral-400">~/.config/google-chrome</code> ou <code className="text-neutral-400">~/.config/chromium</code>.
                  </span>
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.system.openInNewWindow}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          system: { ...prev.system, openInNewWindow: e.target.checked }
                        }))
                      }
                      className="rounded bg-neutral-900 border-neutral-700 text-emerald-500"
                    />
                    <span className="font-medium">Abrir sempre em uma nova janela independente (--new-window)</span>
                  </label>

                  <div className="text-[11px] text-neutral-500">
                    Garante janelas separadas para cada perfil em ambientes de desktop multimonitor ou áreas de trabalho virtuais no Linux.
                  </div>
                </div>

                {/* Reset Section */}
                <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-300 font-medium block">
                      Restaurar Padrões de Fábrica
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      Reverte as contas e provedores para as configurações padrão do HubAI.
                    </span>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 rounded-lg transition-colors"
                  >
                    Restaurar Padrões
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: UNINSTALL & COMPLETE CLEANUP */}
          {activeTab === 'uninstall' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Desinstalador & Limpeza Completa do Linux</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Remova o HubAI do seu sistema operacional com controle granular sobre dados e configurações.
                </p>
              </div>

              {uninstallResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
                    uninstallResult.success
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  {uninstallResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold block mb-0.5">
                      {uninstallResult.success ? 'Desinstalação Disparada' : 'Falha na Operação'}
                    </span>
                    <span>{uninstallResult.message}</span>
                  </div>
                </div>
              )}

              {/* Installed Components Breakdown */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-200">
                    Componentes e Arquivos Instalados no PC
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">Espaço do Usuário</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 bg-neutral-900/80 rounded-lg border border-neutral-800/80">
                    <span className="text-neutral-400">Comando Executável:</span>
                    <code className="text-neutral-300 font-mono text-[11px]">~/.local/bin/hubai</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-900/80 rounded-lg border border-neutral-800/80">
                    <span className="text-neutral-400">Atalhos no Menu Linux:</span>
                    <code className="text-neutral-300 font-mono text-[11px]">~/.local/share/applications/hubai*.desktop</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-900/80 rounded-lg border border-neutral-800/80">
                    <span className="text-neutral-400">Aplicação e Dependências:</span>
                    <code className="text-neutral-300 font-mono text-[11px]">~/.local/share/hubai</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-900/80 rounded-lg border border-neutral-800/80">
                    <span className="text-neutral-400">Atualizador Autônomo:</span>
                    <code className="text-neutral-300 font-mono text-[11px]">~/.local/share/hubai-updater.sh</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-900/80 rounded-lg border border-neutral-800/80">
                    <span className="text-neutral-400">Configurações, Logs e Backups:</span>
                    <code className="text-neutral-300 font-mono text-[11px]">~/.config/hubai</code>
                  </div>
                </div>
              </div>

              {/* Uninstaller Modes Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mode 1: Standard */}
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-neutral-400" />
                      <span className="text-xs font-semibold text-neutral-200">
                        1. Desinstalação Padrão
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Remove o executável <code className="text-neutral-300">hubai</code>, atalhos do sistema e arquivos da aplicação, mas <strong>preserva suas contas e perfis</strong> em <code className="text-neutral-300">~/.config/hubai</code> caso você decida reinstalar no futuro.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-neutral-900 rounded border border-neutral-800">
                      <code className="text-[11px] font-mono text-neutral-300 truncate">
                        hubai uninstall
                      </code>
                      <button
                        onClick={() => handleCopy('hubai uninstall', 'cmd_std')}
                        className="p-1 text-neutral-400 hover:text-white transition-colors"
                        title="Copiar comando"
                      >
                        {copiedCmd === 'cmd_std' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => handleTriggerUninstall(false)}
                      disabled={uninstalling}
                      className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs rounded-lg border border-neutral-700 transition-colors disabled:opacity-50"
                    >
                      {uninstalling ? 'Processando...' : 'Desinstalar (Preservar Contas)'}
                    </button>
                  </div>
                </div>

                {/* Mode 2: Purge Total */}
                <div className="p-4 bg-neutral-950 border border-rose-900/40 rounded-xl flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-semibold text-rose-300">
                        2. Limpeza Total (Purge)
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-300/80 leading-relaxed">
                      Apaga <strong>100% dos arquivos</strong> do projeto do seu computador: executáveis, atalhos, instaladores, logs, backups e configurações salvas em <code className="text-rose-200">~/.config/hubai</code>.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-rose-900/30">
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-neutral-900 rounded border border-rose-900/40">
                      <code className="text-[11px] font-mono text-rose-300 truncate">
                        hubai uninstall --purge
                      </code>
                      <button
                        onClick={() => handleCopy('hubai uninstall --purge', 'cmd_purge')}
                        className="p-1 text-rose-400 hover:text-white transition-colors"
                        title="Copiar comando"
                      >
                        {copiedCmd === 'cmd_purge' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => handleTriggerUninstall(true)}
                      disabled={uninstalling}
                      className="w-full py-2 px-3 bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      {uninstalling ? 'Limpando...' : 'Limpar Completamente o PC'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Terminal One-Liners */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs font-semibold text-neutral-300">
                    Comandos Rápidos no Terminal Linux
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                    <div className="truncate">
                      <span className="text-[10px] text-neutral-500 block">Via script local de desinstalação:</span>
                      <code className="text-xs font-mono text-neutral-200">bash ~/.local/share/hubai/uninstall.sh --purge</code>
                    </div>
                    <button
                      onClick={() => handleCopy('bash ~/.local/share/hubai/uninstall.sh --purge', 'cmd_script')}
                      className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copiedCmd === 'cmd_script' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                    <div className="truncate">
                      <span className="text-[10px] text-neutral-500 block">Comando de 1 linha direto do GitHub:</span>
                      <code className="text-xs font-mono text-neutral-200">curl -sSL https://raw.githubusercontent.com/pinguelanarosca/HubAI/main/uninstall.sh | bash -s -- --purge</code>
                    </div>
                    <button
                      onClick={() =>
                        handleCopy(
                          'curl -sSL https://raw.githubusercontent.com/pinguelanarosca/HubAI/main/uninstall.sh | bash -s -- --purge',
                          'cmd_curl'
                        )
                      }
                      className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copiedCmd === 'cmd_curl' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Safety Note */}
              <div className="p-3 bg-neutral-900/50 border border-neutral-800/80 rounded-lg text-xs text-neutral-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Garantia de Segurança dos Navegadores:</strong> Os perfis reais instalados nos seus navegadores (<code className="text-neutral-300 font-mono">~/.config/google-chrome</code>, <code className="text-neutral-300 font-mono">~/.config/chromium</code>, etc.) <strong>nunca são excluídos ou modificados</strong> em nenhum momento durante o processo de desinstalação.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
