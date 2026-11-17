// Pamięć aplikacji w localStorage. Domena lukaszdudzinski.github.io jest wspólna dla rodziny UKIS,
// więc każdy klucz ma prefiks aplikacji, a czyszczenie dotyczy wyłącznie własnych kluczy (AGENTS.md 1–2).
export const PREFIX = 'ukis.pt-trainer.';

const SUBJECT_KEYS = ['progress', 'stars', 'doubtful', 'exams', 'daily'];

export function createStore(backend = globalThis.localStorage) {
  return {
    get(key, fallback) {
      try {
        const raw = backend.getItem(PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        backend.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { backend.removeItem(PREFIX + key); } catch { /* brak dostępu do pamięci */ }
    },
    clearSubject(subjectId) {
      for (const k of SUBJECT_KEYS) this.remove(`${k}.${subjectId}`);
    },
  };
}
