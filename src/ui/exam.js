// Egzamin próbny i wynik (spec 4.6).
import { SUBJECTS, sectionName } from '../../data/subjects.js';
import { present } from '../bank.js';
import { drawExam, scoreExam, verdict, remainingSec } from '../exam.js';
import { showScreen, goHome, confirmDialog, onLeave } from '../nav.js';
import { renderAnswers, markAnswers, letter, escapeHtml } from './answers.js';

export const examHooks = { onQuestion: null, onFinished: null };
const ADVANCE_MS = 250;

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function initExam(ctx, actions = {}) {
  const el = (id) => document.getElementById(id);
  let exam = null;

  function renderSetup() {
    const s = SUBJECTS[ctx.state.subject];
    el('examInfo').textContent = `${s.name}: ${s.exam.total} pytania, ${ctx.state.settings.examMinutes} minut, zaliczenie od ${s.exam.passScore} poprawnych (75%). W trakcie nie widać, czy odpowiedź jest dobra.`;
  }

  function openSetup() {
    renderSetup();
    showScreen('screenExamSetup');
  }

  function stopTimer() {
    if (exam && exam.timer) clearInterval(exam.timer);
    if (exam) exam.timer = null;
  }

  function tick() {
    if (!exam || exam.pausedAt) return;
    const left = remainingSec(exam, Date.now());
    el('examTimer').textContent = mmss(left);
    el('examTimer').classList.toggle('low', left < 300);
    if (left <= 0) finish();
  }

  function render() {
    const q = exam.questions[exam.index];
    exam.p = present(q);
    exam.locked = false;
    el('examCounter').textContent = `${exam.index + 1} / ${exam.questions.length}`;
    el('examBar').style.width = `${Math.round((exam.index / exam.questions.length) * 100)}%`;
    el('examSection').textContent = sectionName(exam.subject, q.section);
    el('examQText').textContent = exam.p.question;
    renderAnswers(el('examAnswers'), exam.p);
    if (examHooks.onQuestion) examHooks.onQuestion(exam.p);
  }

  function selectAnswer(i) {
    if (!exam || exam.locked || exam.pausedAt || i < 0 || i >= exam.p.options.length) return;
    exam.locked = true;
    const p = exam.p;
    exam.answers[p.id] = { chosen: p.options[i], correct: i === p.correct };
    markAnswers(el('examAnswers'), p, i, { reveal: false });
    setTimeout(() => {
      if (!exam || exam.p !== p) return;
      exam.index++;
      if (exam.index >= exam.questions.length) finish(); else render();
    }, ADVANCE_MS);
  }

  function setPaused(paused) {
    if (!exam || exam.realMode) return;
    if (paused && !exam.pausedAt) exam.pausedAt = Date.now();
    if (!paused && exam.pausedAt) { exam.pausedMs += Date.now() - exam.pausedAt; exam.pausedAt = null; tick(); }
    el('examPaused').hidden = !paused;
    el('examAnswers').hidden = paused;
    el('examQText').hidden = paused;
  }

  function start() {
    const subject = ctx.state.subject;
    const realMode = el('realModeToggle').checked;
    const drawn = drawExam(ctx.questions, SUBJECTS[subject]);
    exam = {
      subject, realMode, questions: drawn.questions, shortfall: drawn.shortfall, index: 0, answers: {},
      startedAt: Date.now(), limitMin: ctx.state.settings.examMinutes, pausedMs: 0, pausedAt: null, timer: null, p: null, locked: false,
    };
    el('btnPauseExam').hidden = realMode;
    el('btnExamRepeat').hidden = realMode;
    el('examToolbar').hidden = realMode;
    el('examPaused').hidden = true;
    el('examAnswers').hidden = false;
    el('examQText').hidden = false;
    showScreen('screenExam');
    el('btnBack').hidden = true;
    el('btnSettings').hidden = true;
    render();
    tick();
    exam.timer = setInterval(tick, 1000);
  }

  function finish() {
    if (!exam) return;
    stopTimer();
    if (exam.pausedAt) { exam.pausedMs += Date.now() - exam.pausedAt; exam.pausedAt = null; }
    const e = exam;
    exam = null;
    const results = Object.fromEntries(Object.entries(e.answers).map(([id, a]) => [id, a.correct]));
    const r = scoreExam(e.questions, results);
    const subj = SUBJECTS[e.subject];
    const v = verdict(r.score, subj.exam.passScore);
    const durationSec = Math.min(e.limitMin * 60, Math.round((Date.now() - e.startedAt - e.pausedMs) / 1000));
    for (const q of e.questions) if (e.answers[q.id]) ctx.state.recordAnswer(e.subject, q.id, e.answers[q.id].correct);
    ctx.state.pushExam(e.subject, { at: Date.now(), score: r.score, total: r.total, durationSec, timeLimitMin: e.limitMin, realMode: e.realMode, bySection: r.bySection });

    const pct = Math.round((r.score / r.total) * 100);
    const circ = 2 * Math.PI * 64;
    el('resultSubject').textContent = `Egzamin próbny · ${subj.name}`;
    el('resultRing').setAttribute('stroke-dasharray', `${(pct / 100) * circ} ${circ}`);
    el('resultRing').closest('.ring').classList.toggle('pass', v === 'pass');
    el('resultVerdict').textContent = v === 'pass' ? 'Zaliczony' : 'Niezaliczony';
    el('resultVerdict').className = `verdict ${v}`;
    el('resultScore').textContent = `${r.score} / ${r.total}`;
    el('resultPercent').textContent = `${pct}%`;
    el('resultTime').textContent = `Czas: ${mmss(durationSec)} z ${mmss(e.limitMin * 60)}. Próg zaliczenia: ${subj.exam.passScore} poprawnych.`;
    const short = Object.entries(e.shortfall);
    el('resultShortfall').hidden = short.length === 0;
    el('resultShortfall').textContent = short.length ? `Za mało pytań w działach: ${short.map(([k, n]) => `${sectionName(e.subject, k)} (brak ${n})`).join(', ')}. Brakujące pytania wylosowano z innych działów.` : '';
    const secs = subj.sections.filter((s) => r.bySection[s.key]);
    const worst = Math.min(...secs.map((s) => r.bySection[s.key].correct / r.bySection[s.key].total));
    el('resultSections').innerHTML = secs.map((s) => {
      const b = r.bySection[s.key];
      const ratio = b.correct / b.total;
      return `<li data-section="${s.key}"${ratio === worst && ratio < 1 ? ' class="weak"' : ''}><div class="bar-row"><span>${escapeHtml(s.name)}</span><strong>${b.correct} / ${b.total}</strong></div><div class="bar"><span style="width:${Math.round(ratio * 100)}%"></span></div></li>`;
    }).join('');
    el('resultMistakes').innerHTML = e.questions.filter((q) => !results[q.id]).map((q) => {
      const a = e.answers[q.id];
      const link = ctx.knowledge && ctx.knowledge.isUnlocked() ? (ctx.materialLinks || {})[q.id] : null;
      const more = link ? `<button type="button" class="btn btn-small read-more" data-target="${link.join(':')}">Doczytaj w Strefie Wiedzy</button>` : '';
      return `<li><p><strong>${escapeHtml(q.question)}</strong></p><p class="bad">${a ? `Twoja: ${escapeHtml(a.chosen)}` : 'Bez odpowiedzi'}</p><p class="ok">Poprawna: ${escapeHtml(q.options[q.answer])}</p><p class="muted">${escapeHtml(q.explanation)}</p>${more}</li>`;
    }).join('');
    el('btnSettings').hidden = false;
    showScreen('screenResults', { push: false });
    el('btnBack').hidden = true;
    if (examHooks.onFinished) examHooks.onFinished(r);
  }

  onLeave('screenExam', () => {
    // Wyjście z ekranu bez zakończenia (np. przeładowanie nawigacji) porzuca egzamin bez wpisu w historii.
    if (exam) { stopTimer(); exam = null; }
    el('btnSettings').hidden = false;
  });

  el('btnStartExam').addEventListener('click', () => (actions.withHelp ? actions.withHelp(start) : start()));
  el('examAnswers').addEventListener('click', (ev) => {
    const b = ev.target.closest('.answer-btn');
    if (b) selectAnswer(Number(b.dataset.index));
  });
  el('btnPauseExam').addEventListener('click', () => setPaused(true));
  el('btnResumeExam').addEventListener('click', () => setPaused(false));
  el('btnFinishExam').addEventListener('click', async () => {
    if (await confirmDialog('Zakończyć egzamin? Pytania bez odpowiedzi liczą się jako błędne.', 'Zakończ')) finish();
  });
  el('btnResultsHome').addEventListener('click', goHome);
  el('resultMistakes').addEventListener('click', (ev) => {
    const b = ev.target.closest('.read-more');
    if (!b || !ctx.knowledge) return;
    const [m, n] = b.dataset.target.split(':');
    ctx.knowledge.openAt(m, Number(n));
  });
  el('btnResultsReview').addEventListener('click', () => { if (!(actions.startReview && actions.startReview())) goHome(); });
  el('btnExamRepeat').addEventListener('click', () => { if (exam && exam.p && examHooks.onQuestion) examHooks.onQuestion(exam.p, { repeat: true }); });
  document.addEventListener('screenchange', (ev) => { if (ev.detail.id === 'screenExamSetup') renderSetup(); });

  return { openSetup, start, selectAnswer, isRealMode: () => !!(exam && exam.realMode), current: () => (exam ? exam.p : null), active: () => !!exam };
}
