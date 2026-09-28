/**
 * HubAI Real Session Collector - Background Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[HubAI Collector Service Worker] Instalado com sucesso');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'HUBAI_PING') {
    sendResponse({ status: 'active', version: '1.0.0' });
  }
});
