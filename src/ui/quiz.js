// Ekran pytania: nauka, dzisiejsza porcja i powtórki (spec 4.2–4.4).
import { questionsFor, shuffle, present } from '../bank.js';
import { createSession, current, answer, isDone, summary, dailyPortion } from '../session.js';
import { reviewIds } from '../progress.js';
import { sectionName } from '../../data/subjects.js';
import { showScreen, goHome } from '../nav.js';
import { renderAnswers, markAnswers, letter } from './answers.js';
import { subjectSummary } from './home.js';

// Haki dla lektora i rozpoznawania mowy (Task 12).
export const quizHooks = { onPresented: null, onAnswered: null, onFinished: null };

export function initQuiz(ctx) {
  const el = (id) => document.getElementById(id);
  let session = null;
  let subject = null;
  let p = null;
  let answered = false;
  let lastCorrect = false;
  let lastChoice = -1;

  function setPressed() {
    el('btnStar').setAttribute('aria-pressed', String(ctx.state.stars(subject).includes(p.id)));
    el('btnDoubtful').setAttribute('aria-pressed', String(ctx.state.doubtful(subject).some((x) => x.id === p.id)));
  }

  function render() {
    const q = current(session);
    p = present(q);
    answered = false;
    el('quizBody').hidden = false;
    el('sessionSummary').hidden = true;
    el('quizProgress').textContent = `${session.index + 1} / ${session.queue.length}`;
    el('quizBar').style.width = `${Math.round((session.index / session.queue.length) * 100)}%`;
    el('qSection').textContent = sectionName(subject, q.section);
    el('qText').textContent = p.question;
    renderAnswers(el('answers'), p);
    el('feedback').hidden = true;
    el('btnNext').hidden = true;
    setPressed();
    if (quizHooks.onPresented) quizHooks.onPresented(p);
  }

  function finish() {
    const s = summary(session);
    el('quizBody').hidden = true;
    el('quizProgress').textContent = '';
    el('quizBar').style.width = '100%';
    el('sessionSummary').hidden = false;
    el('sessionSummary').innerHTML =
      `<h3>Koniec sesji</h3><p>Pytań: <strong>${s.total}</strong>, dobrze za pierwszym razem: <strong>${s.correctFirstTry}</strong>, powtórzone w sesji: <strong>${s.returns}</strong>.</p>` +
      '<button type="button" class="btn btn-primary" id="btnSummaryHome">Wróć na start</button>';
    el('btnSummaryHome').addEventListener('click', goHome);
    if (quizHooks.onFinished) quizHooks.onFinished(s);
  }

  function selectAnswer(i) {
    if (!p || answered || i < 0 || i >= p.options.length) return;
    answered = true;
    lastChoice = i;
    lastCorrect = i === p.correct;
    ctx.state.recordAnswer(subject, p.id, lastCorrect);
    markAnswers(el('answers'), p, i);
    el('feedback').dataset.result = lastCorrect ? 'correct' : 'wrong';
    el('feedbackText').textContent = lastCorrect ? 'Dobrze!' : `Źle. Poprawna odpowiedź: ${letter(p.correct)}. ${p.options[p.correct]}`;
    el('explanation').textContent = p.explanation;
    const link = ctx.knowledge && ctx.knowledge.isUnlocked() ? (ctx.materialLinks || {})[p.id] : null;
    el('btnReadMore').hidden = !link;
    el('btnReadMore').dataset.target = link ? link.join(':') : '';
    el('feedback').hidden = false;
    el('btnNext').hidden = false;
    el('btnNext').focus({ preventScroll: true });
    if (quizHooks.onAnswered) quizHooks.onAnswered(p, i, lastCorrect);
  }

  function next() {
    if (!answered) return;
    session = answer(session, lastCorrect);
    if (isDone(session)) finish(); else render();
  }

  function startQuiz({ mode, section = 'all' }) {
    subject = ctx.state.subject;
    const bank = questionsFor(ctx.questions, subject);
    let list;
    if (mode === 'daily') {
      const sum = subjectSummary(ctx, subject);
      list = dailyPortion(bank, sum.progress, ctx.state.stars(subject), sum.goal);
    } else if (mode === 'review') {
      const ids = new Set(reviewIds(ctx.state.progress(subject), ctx.state.stars(subject), bank.map((q) => q.id)));
      list = shuffle(bank.filter((q) => ids.has(q.id)));
    } else {
      list = shuffle(questionsFor(ctx.questions, subject, section));
    }
    if (!list.length) return false;
    session = createSession(list);
    showScreen('screenQuiz');
    render();
    return true;
  }

  el('answers').addEventListener('click', (e) => {
    const b = e.target.closest('.answer-btn');
    if (b) selectAnswer(Number(b.dataset.index));
  });
  el('btnNext').addEventListener('click', next);
  el('btnReadMore').addEventListener('click', () => {
    const [m, n] = (el('btnReadMore').dataset.target || '').split(':');
    if (m && ctx.knowledge) ctx.knowledge.openAt(m, Number(n));
  });
  el('btnQuit').addEventListener('click', goHome);
  el('btnStar').addEventListener('click', () => { if (p) { ctx.state.toggleStar(subject, p.id); setPressed(); } });
  el('btnDoubtful').addEventListener('click', () => { if (p) { ctx.state.toggleDoubtful(subject, p.id); setPressed(); } });
  el('btnRepeat').addEventListener('click', () => { if (p && quizHooks.onPresented) quizHooks.onPresented(p, { repeat: true }); });

  return {
    startQuiz,
    selectAnswer,
    next,
    isAnswered: () => answered,
    lastChoice: () => lastChoice,
    current: () => p,
  };
}
