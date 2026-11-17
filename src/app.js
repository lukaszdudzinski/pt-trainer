// Uki's PT Trainer: start aplikacji i połączenie ekranów.
import { maybeShowAfterUpdate, showChangelog } from './changelog.js';
import { registerUpdater, applyUpdate } from './updater.js';
import { hydrateIcons } from './icons.js';
import { createStore } from './storage.js';
import { createAppState } from './state.js';
import { showScreen, goBack, goHome } from './nav.js';
import { QUESTIONS } from '../data/questions.js';
import { initHome } from './ui/home.js';
import { initQuiz } from './ui/quiz.js';
import { initSettings } from './ui/settings.js';
import { initFlashcards } from './ui/flashcards.js';
import { initExam } from './ui/exam.js';
import { initStats } from './ui/stats.js';
import { initVoice } from './ui/voice.js';
import { createErrorLog } from './errors.js';
import { initVoiceHelp } from './ui/voice-help.js';
import { initKnowledge } from './ui/knowledge.js';

export const APP_VERSION = 'v2026.11.17.01';

function initUpdates() {
  const toast = document.getElementById('updateToast');
  let waitingReg = null;
  registerUpdater({
    version: APP_VERSION,
    onUpdateReady(reg) { waitingReg = reg; toast.hidden = false; document.getElementById('updateCard').hidden = false; },
  });
  for (const id of ['btnUpdate', 'btnUpdateNow']) document.getElementById(id).addEventListener('click', () => applyUpdate(waitingReg, APP_VERSION));
  for (const id of ['btnUpdateChangelog', 'btnUpdateNotes']) document.getElementById(id).addEventListener('click', () => showChangelog('latest_only'));
  document.getElementById('changelogLink').addEventListener('click', () => showChangelog('all'));
  document.getElementById('btnCloseChangelog').addEventListener('click', () => { document.getElementById('changelogModal').hidden = true; });
  document.getElementById('changelogModal').addEventListener('click', (e) => { if (e.target.id === 'changelogModal') e.currentTarget.hidden = true; });
  maybeShowAfterUpdate(window.localStorage, APP_VERSION);
}

function init() {
  const errors = createErrorLog({ version: APP_VERSION });
  errors.install(window);
  document.getElementById('appVersion').textContent = APP_VERSION;
  document.getElementById('settingsVersion').textContent = APP_VERSION;
  hydrateIcons();
  const store = createStore();
  const state = createAppState(store);
  const ctx = { state, store, questions: QUESTIONS, errors };
  state.onSaveError(() => {
    const t = document.getElementById('saveError');
    t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 6000);
  });
  initSettings(ctx);
  const help = initVoiceHelp(ctx);
  const quiz = initQuiz(ctx);
  const flash = initFlashcards(ctx);
  const exam = initExam(ctx, { startReview: () => quiz.startQuiz({ mode: 'review' }), withHelp: help.withHelp });
  const stats = initStats(ctx);
  const voice = initVoice(ctx, { quiz, flash, exam });
  const knowledge = initKnowledge(ctx, { speech: voice.speech });
  ctx.knowledge = knowledge;
  ctx.materialLinks = {};
  knowledge.linksFor().then((l) => { ctx.materialLinks = l || {}; });
  const home = initHome(ctx, {
    startQuiz: (o) => help.withHelp(() => quiz.startQuiz(o)),
    startFlashcards: (o) => help.withHelp(() => flash.startFlashcards(o)),
    openExamSetup: () => exam.openSetup(),
    openStats: () => stats.open(),
  });
  document.getElementById('btnBack').addEventListener('click', goBack);
  document.getElementById('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'screenHome') goHome();
    else if (b.dataset.tab === 'screenLearnSetup') home.openSetup('learn');
    else if (b.dataset.tab === 'screenExamSetup') exam.openSetup();
    else if (b.dataset.tab === 'screenStats') stats.open();
    else showScreen(b.dataset.tab);
  });
  document.getElementById('tabHome').setAttribute('aria-current', 'page');
  initUpdates();
  window.__ptTrainer = { ctx, quiz, flash, exam, voice, knowledge };
}

init();
