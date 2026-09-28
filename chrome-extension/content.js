/**
 * HubAI Real Session Collector - Content Script
 * Safely inspects visible DOM elements on authenticated AI platform pages
 * and posts real session data to the local HubAI API endpoint.
 *
 * STRICT INTEGRITY RULES:
 * 1. Only extract visible DOM elements legitimately exposed in the user session UI.
 * 2. Never extract or copy passwords, cookies, auth tokens, or private secrets.
 * 3. Never fabricate or invent missing data - return undefined or '--' for unexposed fields.
 * 4. Never use invalid CSS selectors like pseudo-contains.
 */

(function () {
  console.log('[HubAI Collector] Inicializado na página:', window.location.href);

  let bridgeConfig = {
    accountId: null,
    serverUrl: 'http://127.0.0.1:8080'
  };

  async function loadBridgeConfig() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      try {
        const cfgUrl = chrome.runtime.getURL('bridge-config.json');
        const res = await fetch(cfgUrl);
        if (res.ok) {
          const json = await res.json();
          if (json && json.accountId) {
            bridgeConfig = json;
            console.log('[HubAI Collector] Configuração de bridge vinculada:', bridgeConfig);
          }
        }
      } catch (err) {
        console.warn('[HubAI Collector] Não foi possível ler bridge-config.json:', err.message);
      }
    }
  }

  function getProviderIdFromUrl(url) {
    if (url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('grok.com')) return 'grok';
    if (url.includes('meta.ai')) return 'meta_ai';
    if (url.includes('aistudio.google.com')) return 'ai_studios';
    return 'unknown';
  }

  // --- Safe Helper for Text Matching (Replaces invalid pseudo-contains) ---

  function findByText(selector, substringText) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el && el.textContent && el.textContent.includes(substringText)) {
          return el;
        }
      }
    } catch (e) {
      // Ignore selector syntax errors
    }
    return null;
  }

  // --- Platform Extractors ---

  function extractChatGPT() {
    let accountName = undefined;
    let accountEmail = undefined;
    let profilePictureUrl = undefined;
    let planName = undefined;
    const projects = [];
    const recentChats = [];
    let limitLabel = undefined;
    let resetTime = undefined;

    // Avatar image
    const avatarImg = document.querySelector('button[data-testid="profile-button"] img, img[alt*="profile"], img[alt*="Avatar"], img[src*="googleusercontent"], img[src*="gravatar"]');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    // Account Name/Email from UI
    const profileBtn = document.querySelector('button[data-testid="profile-button"], [aria-label*="User menu"]');
    if (profileBtn) {
      const label = profileBtn.getAttribute('aria-label') || profileBtn.innerText || '';
      if (label.includes('@')) {
        accountEmail = label.trim();
      }
    }

    // Plan
    const planEl = findByText('span, div', 'Plus') || findByText('span, div', 'Pro') || findByText('span, div', 'Team');
    if (planEl && planEl.innerText) {
      const text = planEl.innerText.trim();
      if (text.includes('Plus')) planName = 'Plus';
      else if (text.includes('Pro')) planName = 'Pro';
      else if (text.includes('Team')) planName = 'Team';
    } else {
      const pageText = document.body.innerText || '';
      if (pageText.includes('ChatGPT Plus')) planName = 'Plus';
      else if (pageText.includes('ChatGPT Team')) planName = 'Team';
      else if (pageText.includes('ChatGPT Pro')) planName = 'Pro';
      // If not explicitly found in DOM, planName stays '--'
    }

    // Projects / GPTs
    const gptLinks = document.querySelectorAll('a[href*="/g/"]');
    const seenGpts = new Set();
    gptLinks.forEach((link, idx) => {
      const name = link.innerText?.trim();
      const href = link.getAttribute('href');
      if (name && href && !seenGpts.has(href) && idx < 5) {
        seenGpts.add(href);
        projects.push({
          id: href,
          name: name.split('\n')[0]
        });
      }
    });

    // Recent Chats
    const chatLinks = document.querySelectorAll('nav a[href*="/c/"]');
    const seenChats = new Set();
    chatLinks.forEach((link, idx) => {
      const href = link.getAttribute('href');
      const title = link.innerText?.trim()?.split('\n')[0];
      if (href && title && !seenChats.has(href) && idx < 5) {
        seenChats.add(href);
        const timeEl = link.querySelector('time') || link.querySelector('span[class*="time"]');
        recentChats.push({
          id: href,
          title: title,
          timeOrDate: timeEl ? timeEl.innerText.trim() : '--',
          url: window.location.origin + href
        });
      }
    });

    // Limits & Resets
    const limitNotice = document.querySelector('div[class*="limit"], div[class*="cap"], div[class*="rate-limit"]');
    if (limitNotice && limitNotice.innerText) {
      limitLabel = limitNotice.innerText.trim().slice(0, 50);
    }

    return {
      accountName,
      accountEmail,
      profilePictureUrl,
      planName: planName || '--',
      hasProjectsConcept: true,
      projects,
      recentChats,
      usage: {
        limitStatus: limitNotice ? 'warning' : (recentChats.length > 0 ? 'available' : 'unknown'),
        limitLabel: limitLabel || '--',
        resetTime: resetTime || '--',
        details: 'Coletado da interface web do ChatGPT'
      }
    };
  }

  function extractClaude() {
    let accountName = undefined;
    let accountEmail = undefined;
    let profilePictureUrl = undefined;
    let planName = undefined;
    const projects = [];
    const recentChats = [];
    let limitLabel = undefined;
    let resetTime = undefined;

    // Avatar
    const avatarImg = document.querySelector('img[alt*="avatar"], button[aria-label*="Account"] img');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    // Plan
    const planEl = findByText('span, div', 'Pro') || findByText('span, div', 'Team');
    if (planEl && planEl.innerText) {
      const text = planEl.innerText.trim();
      if (text.includes('Pro')) planName = 'Pro';
      else if (text.includes('Team')) planName = 'Team';
    } else {
      const text = document.body.innerText || '';
      if (text.includes('Claude Pro')) planName = 'Pro';
      else if (text.includes('Claude Team')) planName = 'Team';
    }

    // Projects
    const projLinks = document.querySelectorAll('a[href*="/project/"]');
    const seenProjs = new Set();
    projLinks.forEach((link, idx) => {
      const name = link.innerText?.trim();
      const href = link.getAttribute('href');
      if (name && href && !seenProjs.has(href) && idx < 5) {
        seenProjs.add(href);
        projects.push({ id: href, name: name.split('\n')[0] });
      }
    });

    // Recent Chats
    const chatLinks = document.querySelectorAll('a[href*="/chat/"]');
    const seenChats = new Set();
    chatLinks.forEach((link, idx) => {
      const href = link.getAttribute('href');
      const title = link.innerText?.trim()?.split('\n')[0];
      if (href && title && !seenChats.has(href) && idx < 5) {
        seenChats.add(href);
        recentChats.push({
          id: href,
          title: title,
          timeOrDate: '--',
          url: window.location.origin + href
        });
      }
    });

    // Limits
    const limitBanner = document.querySelector('div[class*="message-limit"], div[class*="remaining"]');
    if (limitBanner && limitBanner.innerText) {
      limitLabel = limitBanner.innerText.trim().slice(0, 50);
    }

    return {
      accountName,
      accountEmail,
      profilePictureUrl,
      planName: planName || '--',
      hasProjectsConcept: true,
      projects,
      recentChats,
      usage: {
        limitStatus: limitBanner ? 'warning' : (recentChats.length > 0 ? 'available' : 'unknown'),
        limitLabel: limitLabel || '--',
        resetTime: resetTime || '--',
        details: 'Coletado da interface web do Claude'
      }
    };
  }

  function extractGemini() {
    let accountName = undefined;
    let accountEmail = undefined;
    let profilePictureUrl = undefined;
    let planName = undefined;
    const recentChats = [];

    const avatarImg = document.querySelector('a[aria-label*="Google"] img, img[src*="googleusercontent.com"]');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    const pageText = document.body.innerText || '';
    if (pageText.includes('Gemini Advanced')) planName = 'Advanced';

    const chatLinks = document.querySelectorAll('a[href*="/app/"], div[data-test-id*="recent-conversation"]');
    const seenChats = new Set();
    chatLinks.forEach((link, idx) => {
      const href = link.getAttribute('href') || `gemini-chat-${idx}`;
      const title = link.innerText?.trim()?.split('\n')[0];
      if (title && !seenChats.has(href) && idx < 5) {
        seenChats.add(href);
        recentChats.push({
          id: href,
          title: title,
          timeOrDate: '--'
        });
      }
    });

    return {
      accountName,
      accountEmail,
      profilePictureUrl,
      planName: planName || '--',
      hasProjectsConcept: false,
      projects: [],
      recentChats,
      usage: {
        limitStatus: recentChats.length > 0 ? 'available' : 'unknown',
        limitLabel: '--',
        resetTime: '--',
        details: 'Coletado da interface web do Gemini'
      }
    };
  }

  function extractGrok() {
    let profilePictureUrl = undefined;
    let planName = undefined;
    const recentChats = [];

    const avatarImg = document.querySelector('img[alt*="avatar"], img[src*="pbs.twimg.com"], img[src*="abs.twimg.com"]');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    const pageText = document.body.innerText || '';
    if (pageText.includes('SuperGrok') || pageText.includes('Grok Heavy')) planName = 'SuperGrok';

    const chatLinks = document.querySelectorAll('a[href*="/chat/"]');
    const seenChats = new Set();
    chatLinks.forEach((link, idx) => {
      const href = link.getAttribute('href');
      const title = link.innerText?.trim()?.split('\n')[0];
      if (href && title && !seenChats.has(href) && idx < 5) {
        seenChats.add(href);
        recentChats.push({ id: href, title: title, timeOrDate: '--' });
      }
    });

    return {
      profilePictureUrl,
      planName: planName || '--',
      hasProjectsConcept: false,
      projects: [],
      recentChats,
      usage: {
        limitStatus: recentChats.length > 0 ? 'available' : 'unknown',
        limitLabel: '--',
        resetTime: '--',
        details: 'Coletado da interface web do Grok'
      }
    };
  }

  function extractMetaAI() {
    let profilePictureUrl = undefined;
    const recentChats = [];

    const avatarImg = document.querySelector('img[alt*="Profile"], img[alt*="Avatar"], img[src*="fbcdn"]');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    const chatLinks = document.querySelectorAll('a[href*="/c/"]');
    const seenChats = new Set();
    chatLinks.forEach((link, idx) => {
      const href = link.getAttribute('href');
      const title = link.innerText?.trim()?.split('\n')[0];
      if (href && title && !seenChats.has(href) && idx < 5) {
        seenChats.add(href);
        recentChats.push({ id: href, title: title, timeOrDate: '--' });
      }
    });

    return {
      profilePictureUrl,
      planName: '--',
      hasProjectsConcept: false,
      projects: [],
      recentChats,
      usage: {
        limitStatus: recentChats.length > 0 ? 'available' : 'unknown',
        limitLabel: '--',
        resetTime: '--',
        details: 'Coletado da interface web do Meta AI'
      }
    };
  }

  // --- Main Extractor & Bridge Dispatcher ---

  async function collectAndReport() {
    if (!bridgeConfig.accountId) {
      await loadBridgeConfig();
    }
    if (!bridgeConfig.accountId) {
      console.warn('[HubAI Collector] accountId não configurado na bridge. Coleta não enviada.');
      return;
    }

    const url = window.location.href;
    const providerId = getProviderIdFromUrl(url);

    if (providerId === 'unknown') return;

    let collectedData = null;
    if (providerId === 'chatgpt') collectedData = extractChatGPT();
    else if (providerId === 'claude') collectedData = extractClaude();
    else if (providerId === 'gemini') collectedData = extractGemini();
    else if (providerId === 'grok') collectedData = extractGrok();
    else if (providerId === 'meta_ai') collectedData = extractMetaAI();
    else if (providerId === 'ai_studios') {
      collectedData = {
        accountName: document.querySelector('.user-profile-name, [class*="profile"]')?.innerText || undefined,
        accountEmail: undefined,
        planName: 'Developer',
        projects: [],
        recentChats: []
      };
    }

    if (!collectedData) return;

    const payload = {
      accountId: bridgeConfig.accountId,
      providerId: providerId,
      url: url,
      title: document.title,
      extractedAt: new Date().toISOString(),
      platformData: collectedData
    };

    const serverUrl = (bridgeConfig.serverUrl || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const endpoint = `${serverUrl}/api/bridge/sync-report`;

    console.log('[HubAI Collector] Enviando relatório DOM real:', payload, 'para:', endpoint);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log('[HubAI Collector] Resposta do Servidor HubAI:', data);
    } catch (err) {
      console.warn('[HubAI Collector] Erro ao enviar relatório ao servidor HubAI:', err.message);
    }
  }

  async function checkPendingSync() {
    if (!bridgeConfig.accountId) {
      await loadBridgeConfig();
    }
    if (!bridgeConfig.accountId) return;

    const url = window.location.href;
    const providerId = getProviderIdFromUrl(url);
    if (providerId === 'unknown') return;

    const serverUrl = (bridgeConfig.serverUrl || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const endpoint = `${serverUrl}/api/bridge/pending-sync?accountId=${encodeURIComponent(bridgeConfig.accountId)}&providerId=${encodeURIComponent(providerId)}`;

    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data && data.pending) {
          console.log('[HubAI Collector] Solicitação de sincronização pendente detectada! Coletando agora...');
          await collectAndReport();
        }
      }
    } catch (e) {
      // Silence network errors on polling
    }
  }

  // Initialize
  loadBridgeConfig().then(() => {
    setTimeout(collectAndReport, 2000);
    setInterval(checkPendingSync, 3000);
    setInterval(collectAndReport, 20000);
  });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'HUBAI_FORCE_COLLECT') {
        collectAndReport();
        sendResponse({ success: true, message: 'Coleta acionada no DOM' });
      }
    });
  }
})();
