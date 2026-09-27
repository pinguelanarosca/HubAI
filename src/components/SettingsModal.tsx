import React, { useState } from 'react';
import { HubConfig, HubAccount, AIProvider, DetectedProfile } from '../types.js';
import { saveHubConfig, resetHubConfig, fetchSystemProfiles } from '../services/api.js';
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Folder,
  Shield,
  Check,
  AlertCircle,
  Download,
  Info
} from '../utils/icons.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HubConfig;
  onConfigSaved: (newConfig: HubConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigSaved
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'providers' | 'system'>('accounts');
  const [localConfig, setLocalConfig] = useState<HubConfig>(JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>([]);
  const [scanning, setScanning] = useState(false);

  // Edit account state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScanProfiles = async () => {
    setScanning(true);
    try {
      const data = await fetchSystemProfiles(localConfig.system.chromeUserDataDir);
      setDetectedProfiles(data.detectedProfiles);
    } catch (err) {
      console.error('Erro ao buscar perfis:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const saved = await saveHubConfig(localConfig);
      onConfigSaved(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Tem certeza que deseja restaurar as configurações padrão com as 9 contas e provedores?')) {
      setSaving(true);
      try {
        const reset = await resetHubConfig();
        setLocalConfig(reset);
        onConfigSaved(reset);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } finally {
        setSaving(false);
      }
    }
  };

  // Account editing handlers
  const handleUpdateAccount = (id: string, updates: Partial<HubAccount>) => {
    setLocalConfig(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => (acc.id === id ? { ...acc, ...updates } : acc))
    }));
  };

  // Provider handlers
  const handleUpdateProvider = (id: string, updates: Partial<AIProvider>) => {
    setLocalConfig(prev => ({
      ...prev,
      providers: prev.providers.map(p => (p.id === id ? { ...p, ...updates } : p))
    }));
  };

  const handleAddProvider = () => {
    const newId = `prov_${Date.now()}`;
    const newProv: AIProvider = {
      id: newId,
      name: 'Nova Plataforma de IA',
      shortName: 'Nova IA',
      defaultUrl: 'https://exemplo.ai',
      category: 'general',
      icon: 'Bot',
      description: 'Plataforma customizada de IA',
      enabled: true,
      order: localConfig.providers.length + 1
    };
    setLocalConfig(prev => ({
      ...prev,
      providers: [...prev.providers, newProv]
    }));
  };

  const handleDeleteProvider = (id: string) => {
    if (confirm('Deseja remover este provedor?')) {
      setLocalConfig(prev => ({
        ...prev,
        providers: prev.providers.filter(p => p.id !== id)
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Settings className="w-4 h-4 text-neutral-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Configurações do Hub
              </h2>
              <span className="text-xs text-neutral-400 font-normal">
                Gerenciamento de contas, perfis Chrome e provedores
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{saveSuccess ? 'Salvo com Sucesso!' : saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

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
            9 Contas & Perfis Chrome ({localConfig.accounts.length})
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
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-200">
                    Mapeamento das 9 Contas aos Perfis do Chrome
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Cada conta é vinculada com isolamento estrito ao diretório de perfil especificado.
                  </p>
                </div>
                <button
                  onClick={handleScanProfiles}
                  disabled={scanning}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                  <span>Escanear Perfis do Disco</span>
                </button>
              </div>

              {detectedProfiles.length > 0 && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs space-y-1.5">
                  <div className="text-neutral-400 font-medium">
                    Perfis detectados no sistema ({detectedProfiles.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedProfiles.map((p) => (
                      <span
                        key={p.dirName}
                        className="px-2 py-0.5 bg-neutral-900 border border-neutral-700 rounded font-mono text-[11px] text-neutral-300"
                        title={p.fullPath}
                      >
                        {p.dirName} {p.email ? `(${p.email})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Accounts List */}
              <div className="space-y-3">
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

                      {/* Chrome Profile Dir assignment */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <label className="text-[10px] uppercase font-semibold text-neutral-500 block">
                            Diretório do Perfil Chrome
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

                    {/* Notes & Custom description */}
                    <div>
                      <input
                        type="text"
                        value={acc.notes || ''}
                        onChange={(e) => handleUpdateAccount(acc.id, { notes: e.target.value })}
                        placeholder="Observações de uso (ex: Conta de trabalho principal)"
                        className="w-full text-xs text-neutral-400 bg-neutral-900/60 border border-neutral-800/80 rounded px-2.5 py-1 focus:outline-none focus:border-neutral-700"
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
                    Comando / Executável do Navegador
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    Nome ou caminho do executável no PATH (ex: <code>google-chrome</code>,{' '}
                    <code>google-chrome-stable</code>, <code>chromium</code>, <code>brave-browser</code>).
                  </p>
                  <input
                    type="text"
                    value={localConfig.system.browserCommand}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        system: { ...prev.system, browserCommand: e.target.value }
                      }))
                    }
                    className="w-full text-xs font-mono text-neutral-200 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Diretório Base de Perfis (User Data Directory)
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    No Linux padrão: <code>~/.config/google-chrome</code> ou{' '}
                    <code>~/.config/chromium</code>.
                  </p>
                  <input
                    type="text"
                    value={localConfig.system.chromeUserDataDir}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        system: { ...prev.system, chromeUserDataDir: e.target.value }
                      }))
                    }
                    className="w-full text-xs font-mono text-neutral-200 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-300 block">
                      Abrir sempre em Nova Janela (--new-window)
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Garante que cada sessão apareça claramente separada na barra de tarefas do Linux.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localConfig.system.openInNewWindow}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        system: { ...prev.system, openInNewWindow: e.target.checked }
                      }))
                    }
                    className="rounded bg-neutral-900 border-neutral-700 text-emerald-500"
                  />
                </div>

                {/* Reset to defaults */}
                <div className="p-4 bg-neutral-950 border border-rose-950/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-300 block">
                      Restaurar Padrões de Fábrica
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Restaura as 9 contas predefinidas e todos os 8 provedores de IA recomendados.
                    </span>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-lg transition-colors"
                  >
                    Restaurar Padrões
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
