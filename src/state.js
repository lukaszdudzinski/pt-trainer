// Stan aplikacji zapisany w localStorage (spec 6.3).
import * as P from './progress.js';
import { EXAM_MINUTES } from '../data/subjects.js';

export const DEFAULT_SETTINGS = {
  v: 2, rate: 1, volume: 1, voiceURI: null, stt: true, autoRead: true, explainAloud: true,
  carMode: false, hideVoiceHelp: false, examMinutes: EXAM_MINUTES.default, theme: 'dark', lastSubject: 'trener',
};

export function clampExamMinutes(v) {
  const n = Math.round(Number(v) / EXAM_MINUTES.step) * EXAM_MINUTES.step;
  if (!Number.isFinite(n)) return EXAM_MINUTES.default;
  return Math.min(EXAM_MINUTES.max, Math.max(EXAM_MINUTES.min, n));
}

export function createAppState(store, now = () => Date.now()) {
  const errorHandlers = [];
  const changeHandlers = [];
  const save = (key, value) => {
    if (!store.set(key, value)) errorHandlers.forEach((fn) => fn(key));
    changeHandlers.forEach((fn) => fn(key));
  };
  const saved = store.get('settings', {});
  // v2 (2026-11-14): odpowiedzi głosem domyślnie włączone, także dla wcześniej zapisanych ustawień.
  let settings = { ...DEFAULT_SETTINGS, ...saved, ...((saved.v || 1) < 2 ? { stt: true, v: 2 } : {}) };

  const state = {
    get subject() { return settings.lastSubject; },
    setSubject(id) { state.saveSettings({ lastSubject: id }); },
    get settings() { return settings; },
    saveSettings(patch) { settings = { ...settings, ...patch }; save('settings', settings); },
    progress: (s) => store.get(`progress.${s}`, {}),
    recordAnswer(s, id, correct) {
      const t = now();
      save(`progress.${s}`, P.recordAnswer(state.progress(s), id, correct, t));
      save(`daily.${s}`, P.addAnswerToday(state.daily(s), new Date(t)));
    },
    stars: (s) => store.get(`stars.${s}`, []),
    toggleStar(s, id) { save(`stars.${s}`, P.toggleStar(state.stars(s), id)); },
    doubtful: (s) => store.get(`doubtful.${s}`, []),
    toggleDoubtful(s, id) {
      const list = state.doubtful(s);
      save(`doubtful.${s}`, list.some((x) => x.id === id) ? P.removeDoubtful(list, id) : P.addDoubtful(list, id, now()));
    },
    exams: (s) => store.get(`exams.${s}`, []),
    pushExam(s, entry) { save(`exams.${s}`, P.pushExam(state.exams(s), entry)); },
    daily: (s) => store.get(`daily.${s}`, {}),
    setExamDate(s, date) { save(`daily.${s}`, { ...state.daily(s), examDate: date || null }); },
    clearSubject(s) { store.clearSubject(s); changeHandlers.forEach((fn) => fn(`*.${s}`)); },
    onSaveError(fn) { errorHandlers.push(fn); },
    onChange(fn) { changeHandlers.push(fn); },
    now,
  };
  return state;
}
