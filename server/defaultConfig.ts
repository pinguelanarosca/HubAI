import { HubConfig } from '../src/types.js';
import os from 'os';
import path from 'path';

export function getDefaultChromeUserDataDir(): string {
  const home = os.homedir();
  // Standard Linux Chrome path is ~/.config/google-chrome
  return path.join(home, '.config', 'google-chrome');
}

export const defaultHubConfig: HubConfig = {
  version: 1,
  system: {
    browserCommand: 'google-chrome',
    chromeUserDataDir: getDefaultChromeUserDataDir(),
    openInNewWindow: true,
    additionalFlags: ['--no-first-run'],
    theme: 'dark'
  },
  providers: [
    {
      id: 'gemini',
      name: 'Google Gemini',
      shortName: 'Gemini',
      defaultUrl: 'https://gemini.google.com/app',
      category: 'multimodal',
      icon: 'Sparkles',
      description: 'Google AI Assistant (Gemini 2.5 Flash / Pro, Canvas & Deep Research)',
      badge: 'Google',
      enabled: true,
      order: 1
    },
    {
      id: 'openai',
      name: 'OpenAI ChatGPT',
      shortName: 'ChatGPT',
      defaultUrl: 'https://chatgpt.com',
      category: 'general',
      icon: 'Bot',
      description: 'OpenAI ChatGPT (GPT-4o, o3-mini, Canvas & Voice)',
      badge: 'OpenAI',
      enabled: true,
      order: 2
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      shortName: 'Claude',
      defaultUrl: 'https://claude.ai/new',
      category: 'reasoning',
      icon: 'Brain',
      description: 'Anthropic Claude 3.7 Sonnet & Artifacts workspace',
      badge: 'Anthropic',
      enabled: true,
      order: 3
    },
    {
      id: 'grok',
      name: 'xAI Grok',
      shortName: 'Grok',
      defaultUrl: 'https://grok.com',
      category: 'reasoning',
      icon: 'Zap',
      description: 'xAI Grok 3 with deep real-time reasoning & web search',
      badge: 'xAI',
      enabled: true,
      order: 4
    },
    {
      id: 'meta',
      name: 'Meta AI',
      shortName: 'Meta AI',
      defaultUrl: 'https://www.meta.ai',
      category: 'general',
      icon: 'Globe',
      description: 'Meta Llama 3 platform for generation and visual reasoning',
      badge: 'Meta',
      enabled: true,
      order: 5
    },
    {
      id: 'perplexity',
      name: 'Perplexity AI',
      shortName: 'Perplexity',
      defaultUrl: 'https://www.perplexity.ai',
      category: 'reasoning',
      icon: 'Compass',
      description: 'Conversational answer engine with live verified citations',
      badge: 'Perplexity',
      enabled: true,
      order: 6
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      shortName: 'DeepSeek',
      defaultUrl: 'https://chat.deepseek.com',
      category: 'code',
      icon: 'Code',
      description: 'DeepSeek-R1 reasoning & DeepSeek-V3 open weights assistant',
      badge: 'DeepSeek',
      enabled: true,
      order: 7
    },
    {
      id: 'mistral',
      name: 'Mistral Le Chat',
      shortName: 'Mistral',
      defaultUrl: 'https://chat.mistral.ai',
      category: 'general',
      icon: 'Cpu',
      description: 'European AI platform with Le Chat, Pixtral & Codestral',
      badge: 'Mistral',
      enabled: true,
      order: 8
    }
  ],
  accounts: [
    {
      id: 'acc_1',
      name: 'Conta 1 - Principal',
      email: 'conta1.principal@gmail.com',
      chromeProfileDir: 'Default',
      color: '#3b82f6', // Blue
      avatarIcon: 'Shield',
      notes: 'Perfil principal padrão do Google Chrome no computador',
      order: 1
    },
    {
      id: 'acc_2',
      name: 'Conta 2 - Trabalho',
      email: 'conta2.work@gmail.com',
      chromeProfileDir: 'Profile 1',
      color: '#10b981', // Emerald
      avatarIcon: 'Briefcase',
      notes: 'Perfil de trabalho e projetos corporativos',
      order: 2
    },
    {
      id: 'acc_3',
      name: 'Conta 3 - Dev & Engenharia',
      email: 'conta3.dev@gmail.com',
      chromeProfileDir: 'Profile 2',
      color: '#8b5cf6', // Purple
      avatarIcon: 'Code',
      notes: 'Perfil dedicado a código, repositórios e testes de API',
      order: 3
    },
    {
      id: 'acc_4',
      name: 'Conta 4 - Pesquisa & Estudo',
      email: 'conta4.research@gmail.com',
      chromeProfileDir: 'Profile 3',
      color: '#f59e0b', // Amber
      avatarIcon: 'Brain',
      notes: 'Perfil focado em pesquisa acadêmica e documentação',
      order: 4
    },
    {
      id: 'acc_5',
      name: 'Conta 5 - Projetos Especiais',
      email: 'conta5.projects@gmail.com',
      chromeProfileDir: 'Profile 4',
      color: '#ec4899', // Pink
      avatarIcon: 'Sparkles',
      notes: 'Perfil para projetos experimentais e protótipos',
      order: 5
    },
    {
      id: 'acc_6',
      name: 'Conta 6 - Criação & Conteúdo',
      email: 'conta6.media@gmail.com',
      chromeProfileDir: 'Profile 5',
      color: '#06b6d4', // Cyan
      avatarIcon: 'Layers',
      notes: 'Perfil para geração de multimídia, prompts visuais e escrita',
      order: 6
    },
    {
      id: 'acc_7',
      name: 'Conta 7 - Testes & Staging',
      email: 'conta7.staging@gmail.com',
      chromeProfileDir: 'Profile 6',
      color: '#14b8a6', // Teal
      avatarIcon: 'Cpu',
      notes: 'Perfil isolado para testar novos modelos e automações',
      order: 7
    },
    {
      id: 'acc_8',
      name: 'Conta 8 - Lab Experimental',
      email: 'conta8.lab@gmail.com',
      chromeProfileDir: 'Profile 7',
      color: '#f97316', // Orange
      avatarIcon: 'Zap',
      notes: 'Perfil laboratório de experimentação com novas features',
      order: 8
    },
    {
      id: 'acc_9',
      name: 'Conta 9 - Backup & Arquivo',
      email: 'conta9.backup@gmail.com',
      chromeProfileDir: 'Profile 8',
      color: '#6366f1', // Indigo
      avatarIcon: 'Archive',
      notes: 'Perfil reserva de segurança e histórico de sessões',
      order: 9
    }
  ]
};
