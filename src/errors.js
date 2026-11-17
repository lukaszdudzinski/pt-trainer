// Dziennik błędów zgodny z modułem `errors` rdzenia UKIS (spec rdzenia v1, rozdz. 4.1):
// window.onerror, unhandledrejection, log(prefix, error); 50 wpisów w ukis.<appId>.errors z wersją i urządzeniem.
// Po przejściu PT Trainer na @ukis/core ten plik zostanie zastąpiony modułem z rdzenia.
const KEY = 'ukis.pt-trainer.errors';
const MAX = 50;

export function createErrorLog({ storage = globalThis.localStorage, version, device = globalThis.navigator ? navigator.userAgent : '', now = () => Date.now() } = {}) {
  const read = () => {
    try { const v = JSON.parse(storage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const write = (list) => { try { storage.setItem(KEY, JSON.stringify(list)); } catch { /* pełna pamięć */ } };

  function log(prefix, err) {
    const entry = { at: now(), version, device, prefix, message: err && err.message ? String(err.message) : String(err) };
    if (err && err.stack) entry.stack = String(err.stack).split('\n').slice(0, 4).join('\n');
    write([entry, ...read()].slice(0, MAX));
    return entry;
  }

  function install(win = globalThis.window) {
    win.addEventListener('error', (e) => log('błąd', e.error || e.message || 'nieznany błąd'));
    win.addEventListener('unhandledrejection', (e) => log('obietnica', e.reason || 'odrzucona obietnica'));
  }

  function report() {
    return read().map((e) => `${new Date(e.at).toLocaleString('pl-PL')} · ${e.version} · ${e.prefix}: ${e.message}`).join('\n') +
      (read().length ? `\nUrządzenie: ${read()[0].device}` : '');
  }

  return { log, list: read, clear: () => { try { storage.removeItem(KEY); } catch { /* brak */ } }, install, report };
}
