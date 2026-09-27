import React, { useState } from 'react';
import { HubAccount, AIProvider } from '../types.js';
import { Check, X, Shield, ExternalLink } from '../utils/icons.js';

interface EditAccountModalProps {
  account: HubAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAccount: HubAccount) => void;
  providers: AIProvider[];
}

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  account,
  isOpen,
  onClose,
  onSave,
  providers
}) => {
  if (!isOpen || !account) return null;

  const [form, setForm] = useState<HubAccount>({ ...account });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: form.color }}
            >
              #{form.order}
            </div>
            <h2 className="text-sm font-semibold text-neutral-100">
              Editar {account.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Nome de Exibição da Conta
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full text-xs text-neutral-200 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Email da Conta Google
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full text-xs font-mono text-neutral-200 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Diretório do Perfil Chrome
              </label>
              <input
                type="text"
                value={form.chromeProfileDir}
                onChange={(e) => setForm({ ...form, chromeProfileDir: e.target.value })}
                placeholder="Default, Profile 1, etc."
                className="w-full text-xs font-mono text-emerald-400 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Nome exato da pasta do perfil
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Cor de Identificação
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-9 bg-transparent border-0 cursor-pointer rounded"
                />
                <span className="text-xs font-mono text-neutral-400">{form.color}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Observações / Notas da Conta
            </label>
            <textarea
              rows={2}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex: Utilizada para reuniões, testes ou ambiente de staging..."
              className="w-full text-xs text-neutral-200 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
