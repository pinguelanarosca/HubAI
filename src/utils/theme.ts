export interface ProviderTheme {
  id: string;
  accentText: string;
  sidebarSelected: string;
  iconAccent: string;
  cardBorder: string;
  cardHeaderLine: string;
  notesFocus: string;
  launchBtn: string;
  validBtn: string;
  cmdBtn: string;
  cardBg: string;
  decoratorSymbol: string;
  decoratorColor: string;
  badgeStyle: string;
  glowBg: string;
}

export const PROVIDER_THEMES: Record<string, ProviderTheme> = {
  gemini: {
    id: 'gemini',
    accentText: 'text-cyan-400',
    sidebarSelected: 'bg-gradient-to-r from-cyan-950/40 to-blue-950/30 text-cyan-200 border-cyan-500/50 shadow-[0_0_12px_-3px_rgba(6,182,212,0.35)] backdrop-blur-md',
    iconAccent: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30',
    cardBorder: 'hover:border-cyan-500/50 hover:shadow-[0_0_18px_-5px_rgba(6,182,212,0.45)]',
    cardHeaderLine: 'border-cyan-950/50',
    notesFocus: 'focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30',
    launchBtn: 'bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold shadow-[0_2px_8px_rgba(6,182,212,0.3)]',
    validBtn: 'hover:bg-cyan-950/40 hover:text-cyan-300 border border-transparent hover:border-cyan-900/50',
    cmdBtn: 'hover:bg-cyan-950/40 hover:text-cyan-300 border border-transparent hover:border-cyan-900/50',
    cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800/80',
    decoratorSymbol: '✦',
    decoratorColor: 'text-cyan-400/15',
    badgeStyle: 'bg-cyan-950/60 text-cyan-300 border-cyan-800',
    glowBg: 'bg-cyan-500'
  },
  openai: {
    id: 'openai',
    accentText: 'text-emerald-400',
    sidebarSelected: 'bg-gradient-to-r from-emerald-950/40 to-teal-950/30 text-emerald-200 border-emerald-500/50 shadow-[0_0_12px_-3px_rgba(16,185,129,0.35)] backdrop-blur-md',
    iconAccent: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
    cardBorder: 'hover:border-emerald-500/50 hover:shadow-[0_0_18px_-5px_rgba(16,185,129,0.45)]',
    cardHeaderLine: 'border-emerald-950/50',
    notesFocus: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
    launchBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-[0_2px_8px_rgba(16,185,129,0.3)]',
    validBtn: 'hover:bg-emerald-950/40 hover:text-emerald-300 border border-transparent hover:border-emerald-900/50',
    cmdBtn: 'hover:bg-emerald-950/40 hover:text-emerald-300 border border-transparent hover:border-emerald-900/50',
    cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800/80',
    decoratorSymbol: '◉',
    decoratorColor: 'text-emerald-500/15',
    badgeStyle: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
    glowBg: 'bg-emerald-500'
  },
  claude: {
    id: 'claude',
    accentText: 'text-amber-500',
    sidebarSelected: 'bg-gradient-to-r from-amber-950/40 to-orange-950/30 text-amber-200 border-amber-500/50 shadow-[0_0_12px_-3px_rgba(245,158,11,0.35)] backdrop-blur-md',
    iconAccent: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
    cardBorder: 'hover:border-amber-500/50 hover:shadow-[0_0_18px_-5px_rgba(245,158,11,0.45)]',
    cardHeaderLine: 'border-amber-950/50',
    notesFocus: 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30',
    launchBtn: 'bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold shadow-[0_2px_8px_rgba(245,158,11,0.3)]',
    validBtn: 'hover:bg-amber-950/40 hover:text-amber-300 border border-transparent hover:border-amber-900/50',
    cmdBtn: 'hover:bg-amber-950/40 hover:text-amber-300 border border-transparent hover:border-amber-900/50',
    cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800/80',
    decoratorSymbol: '✿',
    decoratorColor: 'text-amber-500/15',
    badgeStyle: 'bg-amber-950/60 text-amber-300 border-amber-800',
    glowBg: 'bg-amber-500'
  },
  meta: {
    id: 'meta',
    accentText: 'text-fuchsia-400',
    sidebarSelected: 'bg-gradient-to-r from-fuchsia-950/40 to-violet-950/30 text-fuchsia-200 border-fuchsia-500/50 shadow-[0_0_12px_-3px_rgba(236,72,153,0.35)] backdrop-blur-md',
    iconAccent: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30',
    cardBorder: 'hover:border-fuchsia-500/50 hover:shadow-[0_0_18px_-5px_rgba(236,72,153,0.45)]',
    cardHeaderLine: 'border-fuchsia-950/50',
    notesFocus: 'focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/30',
    launchBtn: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold shadow-[0_2px_8px_rgba(236,72,153,0.3)]',
    validBtn: 'hover:bg-fuchsia-950/40 hover:text-fuchsia-300 border border-transparent hover:border-cyan-900/50',
    cmdBtn: 'hover:bg-fuchsia-950/40 hover:text-fuchsia-300 border border-transparent hover:border-cyan-900/50',
    cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800/80',
    decoratorSymbol: '꩜',
    decoratorColor: 'text-fuchsia-500/15',
    badgeStyle: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800',
    glowBg: 'bg-fuchsia-500'
  },
  grok: {
    id: 'grok',
    accentText: 'text-neutral-100',
    sidebarSelected: 'bg-neutral-900/80 text-white border-neutral-500 shadow-[0_0_12px_-3px_rgba(255,255,255,0.15)] backdrop-blur-md',
    iconAccent: 'bg-neutral-800 text-neutral-100 border border-neutral-700',
    cardBorder: 'hover:border-neutral-400 hover:shadow-[0_0_18px_-5px_rgba(255,255,255,0.18)]',
    cardHeaderLine: 'border-neutral-800',
    notesFocus: 'focus:border-neutral-300 focus:ring-1 focus:ring-neutral-300/30',
    launchBtn: 'bg-white hover:bg-neutral-200 text-black font-bold shadow-[0_2px_8px_rgba(255,255,255,0.15)]',
    validBtn: 'hover:bg-neutral-800 hover:text-white border border-transparent hover:border-neutral-700',
    cmdBtn: 'hover:bg-neutral-800 hover:text-white border border-transparent hover:border-neutral-700',
    cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800/80',
    decoratorSymbol: '𝕏',
    decoratorColor: 'text-neutral-500/15',
    badgeStyle: 'bg-neutral-800 text-neutral-200 border-neutral-700',
    glowBg: 'bg-neutral-400'
  }
};

const DEFAULT_THEME: ProviderTheme = {
  id: 'default',
  accentText: 'text-emerald-400',
  sidebarSelected: 'bg-neutral-800/80 text-white border-neutral-700 shadow-sm backdrop-blur-md',
  iconAccent: 'bg-neutral-950 text-neutral-400',
  cardBorder: 'hover:border-neutral-700 hover:shadow-md',
  cardHeaderLine: 'border-neutral-800/70',
  notesFocus: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
  launchBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
  validBtn: 'hover:bg-neutral-800 hover:text-neutral-200 border border-transparent',
  cmdBtn: 'hover:bg-neutral-800 hover:text-neutral-200 border border-transparent',
  cardBg: 'backdrop-blur-md bg-neutral-900/60 border-neutral-800',
  decoratorSymbol: '⬡',
  decoratorColor: 'text-neutral-700/15',
  badgeStyle: 'bg-neutral-950 text-neutral-300 border-neutral-800',
  glowBg: 'bg-emerald-500'
};

export function getProviderTheme(providerId: string): ProviderTheme {
  return PROVIDER_THEMES[providerId] || DEFAULT_THEME;
}
