// Ekran startowy: przedmiot, karta gotowości, menu, wybór zakresu nauki i fiszek.
import { SUBJECTS, SUBJECT_IDS } from '../../data/subjects.js';
import { questionsFor } from '../bank.js';
import { reviewIds, readiness, dailyGoal, countToday, streakDays } from '../progress.js';
import { showScreen } from '../nav.js';

export function subjectSummary(ctx, s) {
  const bank = questionsFor(ctx.questions, s);
  const ids = bank.map((q) => q.id);
  const progress = ctx.state.progress(s);
  const r = readiness(progress, ids, ctx.state.exams(s));
  const unmastered = ids.length - Math.round((r.masteredPct / 100) * ids.length);
  const daily = ctx.state.daily(s);
  const now = new Date(ctx.state.now());
  return {
    bank, ids, progress, readiness: r,
    review: reviewIds(progress, ctx.state.stars(s), ids),
    goal: dailyGoal(unmastered, daily.examDate || null, now),
    today: countToday(daily, now),
  };
}

export function daysLeft(examDate, now) {
  if (!examDate) return null;
  const [y, m, d] = examDate.split('-').map(Number);
  const n = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return n < 0 ? null : n;
}

export function readinessText(r) {
  if (r.ready) return 'Gotowy do egzaminu';
  const n = r.examsMissing;
  const word = n === 1 ? 'egzamin próbny' : (n >= 2 && n <= 4 ? 'egzaminy próbne' : 'egzaminów próbnych');
  return `Jeszcze ${n} ${word} z wynikiem ≥ 80%`;
}

export function initHome(ctx, actions) {
  const msg = document.getElementById('homeMessage');
  let setupMode = 'learn';

  function render() {
    const s = ctx.state.subject;
    for (const b of document.querySelectorAll('#subjectSwitch [data-subject]')) b.setAttribute('aria-pressed', String(b.dataset.subject === s));
    const sum = subjectSummary(ctx, s);
    const daily = ctx.state.daily(s);
    const days = daysLeft(daily.examDate, new Date(ctx.state.now()));
    const pct = sum.readiness.masteredPct;
    const circ = 2 * Math.PI * 38;
    document.getElementById('reviewCount').textContent = String(sum.review.length);
    document.getElementById('dailySub').textContent = `${sum.goal} pytań: powtórki i nowe`;
    const meta = [days === null ? '' : `Egzamin za <strong>${days === 0 ? 'dziś' : days === 1 ? '1 dzień' : `${days} dni`}</strong>`, `seria <strong>${streakDays(daily, new Date(ctx.state.now()))} dni</strong>`].filter(Boolean).join(' · ');
    document.getElementById('readyCard').innerHTML =
      `<div class="ring"><svg viewBox="0 0 92 92" aria-hidden="true"><circle class="ring-bg" cx="46" cy="46" r="38"></circle><circle class="ring-fg" cx="46" cy="46" r="38" stroke-dasharray="${(pct / 100) * circ} ${circ}"></circle></svg>` +
      `<div class="ring-label"><strong>${pct}%</strong><span>opanowane</span></div></div>` +
      '<div class="ready-info"><p class="eyebrow">Gotowość</p>' +
      `<span class="ready-text${sum.readiness.ready ? ' ready' : ''}">${readinessText(sum.readiness)}</span>` +
      `<span class="ready-meta">${meta}</span>` +
      `<span class="mini-bar"><span class="bar"><span style="width:${Math.min(100, Math.round((sum.today / sum.goal) * 100))}%"></span></span><span id="homeDailyGoal">${sum.today} / ${sum.goal}</span></span></div>`;
  }

  function say(text) { msg.textContent = text; msg.hidden = !text; }

  function openSetup(mode) {
    setupMode = mode;
    const s = ctx.state.subject;
    document.getElementById('learnSetupTitle').textContent = `${mode === 'flash' ? 'Fiszki' : 'Nauka'}: ${SUBJECTS[s].name}`;
    for (const b of document.querySelectorAll('#setupSubject [data-subject]')) b.setAttribute('aria-pressed', String(b.dataset.subject === s));
    const opts = [['all', `Cały przedmiot (${questionsFor(ctx.questions, s).length})`]];
    if (mode === 'flash') opts.push(['review', `Powtórki błędów (${subjectSummary(ctx, s).review.length})`]);
    for (const sec of SUBJECTS[s].sections) opts.push([sec.key, `${sec.name} (${questionsFor(ctx.questions, s, sec.key).length})`]);
    document.getElementById('sectionSelect').innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    if (!document.getElementById('screenLearnSetup').classList.contains('active')) showScreen('screenLearnSetup');
  }

  document.getElementById('subjectSwitch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-subject]');
    if (!b || !SUBJECT_IDS.includes(b.dataset.subject)) return;
    ctx.state.setSubject(b.dataset.subject);
    say('');
    render();
  });
  document.getElementById('setupSubject').addEventListener('click', (e) => {
    const b = e.target.closest('[data-subject]');
    if (!b || !SUBJECT_IDS.includes(b.dataset.subject)) return;
    ctx.state.setSubject(b.dataset.subject);
    openSetup(setupMode);
  });
  document.getElementById('btnDaily').addEventListener('click', () => { say(''); actions.startQuiz({ mode: 'daily' }); });
  document.getElementById('btnLearn').addEventListener('click', () => { say(''); openSetup('learn'); });
  document.getElementById('btnFlashcards').addEventListener('click', () => { say(''); openSetup('flash'); });
  document.getElementById('btnReview').addEventListener('click', () => {
    if (subjectSummary(ctx, ctx.state.subject).review.length === 0) { say('Brak pytań do powtórki. Błędne odpowiedzi i pytania z gwiazdką trafią tutaj.'); return; }
    say('');
    actions.startQuiz({ mode: 'review' });
  });
  document.getElementById('btnExam').addEventListener('click', () => { say(''); actions.openExamSetup(); });
  document.getElementById('btnStats').addEventListener('click', () => { say(''); actions.openStats(); });
  document.getElementById('btnStartLearn').addEventListener('click', () => {
    const section = document.getElementById('sectionSelect').value;
    if (setupMode === 'flash') actions.startFlashcards({ scope: section });
    else actions.startQuiz({ mode: 'learn', section });
  });
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenHome') render(); });
  ctx.state.onChange(() => { if (document.getElementById('screenHome').classList.contains('active')) render(); });
  render();
  return { render, openSetup };
}
