// Aktualizacja tylko na żądanie użytkownika (AGENTS.md 3): nowa wersja czeka, aż ktoś kliknie „Zaktualizuj”.
import { rememberUpdatedFrom } from './changelog.js';

export function registerUpdater({ version, onUpdateReady }) {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing && window.__ukisUserClickedUpdate) {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const notify = () => { if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg); };
    notify();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') notify(); });
    });
    // Sprawdzanie nowej wersji przy powrocie do aplikacji.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* bez SW aplikacja działa online */ });
  void version;
}

export function applyUpdate(reg, version) {
  window.__ukisUserClickedUpdate = true;
  rememberUpdatedFrom(window.localStorage, version);
  if (reg && reg.waiting) reg.waiting.postMessage({ action: 'skipWaiting' });
}
