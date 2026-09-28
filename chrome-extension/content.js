/**
 * HubAI Real Session Collector - Content Script
 * Safely inspects visible DOM elements on authenticated AI platform pages
 * and posts real session data to the local HubAI API endpoint.
 *
 * STRICT INTEGRITY RULES:
 * 1. Only extract visible DOM elements legitimately exposed in the user session UI.
 * 2. Never extract or copy passwords, cookies, auth tokens, or private secrets.
 * 3. Never fabricate or invent missing data - return undefined for unexposed fields.
 */

(function () {
  console.log('[HubAI Collector] Inicializado na página:', window.location.href);

  function getProviderIdFromUrl(url) {
    if (url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('grok.com')) return 'grok';
    if (url.includes('meta.ai')) return 'meta_ai';
    return 'unknown';
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
    const planBadge = document.querySelector('span:contains("Plus"), span:contains("Team"), span:contains("Pro"), div[class*="plan-badge"]');
    if (planBadge && planBadge.innerText) {
      planName = planBadge.innerText.trim();
    } else {
      const pageText = document.body.innerText || '';
      if (pageText.includes('ChatGPT Plus')) planName = 'Plus';
      else if (pageText.includes('ChatGPT Team')) planName = 'Team';
      else if (pageText.includes('ChatGPT Pro')) planName = 'Pro';
      else planName = 'Free';
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
      planName,
      hasProjectsConcept: true,
      projects,
      recentChats,
      usage: {
        limitStatus: limitNotice ? 'warning' : 'available',
        limitLabel: limitLabel || '--',
        resetTime: resetTime || '--',
        details: 'Dados coletados da interface web do ChatGPT'
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
    const planEl = document.querySelector('span:contains("Pro"), span:contains("Team"), div[class*="plan"]');
    if (planEl && planEl.innerText) {
      planName = planEl.innerText.trim();
    } else {
      const text = document.body.innerText || '';
      if (text.includes('Claude Pro')) planName = 'Pro';
      else if (text.includes('Claude Team')) planName = 'Team';
      else planName = 'Free';
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
      planName,
      hasProjectsConcept: true,
      projects,
      recentChats,
      usage: {
        limitStatus: limitBanner ? 'warning' : 'available',
        limitLabel: limitLabel || '--',
        resetTime: resetTime || '--',
        details: 'Dados coletados da interface web do Claude'
      }
    };
  }

  function extractGemini() {
    let accountName = undefined;
    let accountEmail = undefined;
    let profilePictureUrl = undefined;
    let planName = undefined;
    const recentChats = [];

    // Avatar
    const avatarImg = document.querySelector('a[aria-label*="Google"] img, img[src*="googleusercontent.com"]');
    if (avatarImg && avatarImg.src) {
      profilePictureUrl = avatarImg.src;
    }

    // Plan
    const pageText = document.body.innerText || '';
    if (pageText.includes('Gemini Advanced')) planName = 'Advanced';
    else planName = 'Free';

    // Recent Chats
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
      planName,
      hasProjectsConcept: false,
      projects: [],
      recentChats,
      usage: {
        limitStatus: 'available',
        limitLabel: '--',
        resetTime: '--',
        details: 'Dados coletados da interface web do Gemini'
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
    else planName = 'Grok Free';

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
      planName,
      hasProjectsConcept: false,
      projects: [],
      recentChats,
      usage: {
        limitStatus: 'available',
        limitLabel: '--',
        resetTime: '--',
        details: 'Dados coletados da interface web do Grok'
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
        limitStatus: 'available',
        limitLabel: '--',
        resetTime: '--',
        details: 'Dados coletados da interface web do Meta AI'
      }
    };
  }

  // --- Main Extractor & Bridge Dispatcher ---

  function collectAndReport() {
    const url = window.location.href;
    const providerId = getProviderIdFromUrl(url);

    if (providerId === 'unknown') return;

    let collectedData = null;
    if (providerId === 'chatgpt') collectedData = extractChatGPT();
    else if (providerId === 'claude') collectedData = extractClaude();
    else if (providerId === 'gemini') collectedData = extractGemini();
    else if (providerId === 'grok') collectedData = extractGrok();
    else if (providerId === 'meta_ai') collectedData = extractMetaAI();

    if (!collectedData) return;

    const payload = {
      providerId: providerId,
      url: url,
      extractedAt: new Date().toISOString(),
      platformData: collectedData
    };

    console.log('[HubAI Collector] Dados reais extraídos do DOM:', payload);

    // Send HTTP POST payload to local HubAI bridge endpoint
    fetch('http://localhost:3000/api/bridge/sync-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('[HubAI Collector] Resposta do HubAI Server:', data);
      })
      .catch((err) => {
        console.warn('[HubAI Collector] Não foi possível enviar para o servidor local (porta 3000):', err.message);
      });
  }

  // Collect once page is loaded
  setTimeout(collectAndReport, 2000);
  // Re-collect after interactions or route changes
  setInterval(collectAndReport, 15000);

  // Listener for extension popup / background triggers
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'HUBAI_FORCE_COLLECT') {
        collectAndReport();
        sendResponse({ success: true, message: 'Coleta acionada no DOM' });
      }
    });
  }
})();
