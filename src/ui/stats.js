// Statystyki, gotowość, data egzaminu, gwiazdki, wątpliwe i czyszczenie postępu (spec 4.7).
import { SUBJECTS } from '../../data/subjects.js';
import { questionsFor } from '../bank.js';
import { isMastered, localDateKey, streakDays, doubtfulReport } from '../progress.js';
import { showScreen, confirmDialog } from '../nav.js';
import { subjectSummary, readinessText } from './home.js';
import { escapeHtml } from './answers.js';

function daysLeftText(examDate, now) {
  if (!examDate) return '—';
  const [y, m, d] = examDate.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  if (n < 0) return 'egzamin minął';
  if (n === 0) return 'dzisiaj';
  return n === 1 ? '1 dzień' : `${n} dni`;
}

const fmtDate = (t) => { const d = new Date(t); return `${localDateKey(d).split('-').reverse().join('.')}`; };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function initStats(ctx) {
  const el = (id) => document.getElementById(id);

  function render() {
    const s = ctx.state.subject;
    const subj = SUBJECTS[s];
    const sum = subjectSummary(ctx, s);
    const now = new Date(ctx.state.now());
    const daily = ctx.state.daily(s);
    el('statsTitle').textContent = `Statystyki: ${subj.name}`;
    el('readyBadge').textContent = readinessText(sum.readiness);
    el('readyBadge').classList.toggle('ready', sum.readiness.ready);
    el('masteredPct').textContent = `${sum.readiness.masteredPct}%`;
    el('examDateInput').value = daily.examDate || '';
    el('daysLeft').textContent = daysLeftText(daily.examDate, now);
    el('dailyGoal').textContent = `${sum.today} / ${sum.goal}`;
    el('streakDays').textContent = String(streakDays(daily, now));

    const rows = subj.sections.map((sec) => {
      const qs = questionsFor(ctx.questions, s, sec.key);
      const m = qs.filter((q) => isMastered(sum.progress[q.id])).length;
      return { ...sec, m, n: qs.length, ratio: qs.length ? m / qs.length : 0 };
    });
    const weak = [...rows].sort((a, b) => a.ratio - b.ratio).slice(0, 3);
    const weakKeys = new Set(weak.map((r) => r.key));
    el('sectionStats').innerHTML = rows.map((r) => `<li data-section="${r.key}"${weakKeys.has(r.key) ? ' class="weak"' : ''}><div class="bar-row"><span>${escapeHtml(r.name)}</span><strong>${r.m} / ${r.n}</strong></div><div class="bar"><span style="width:${Math.round(r.ratio * 100)}%"></span></div></li>`).join('');
    el('weakSections').textContent = `Najsłabsze działy: ${weak.map((r) => r.name).join(', ')}.`;

    const exams = ctx.state.exams(s);
    el('examHistory').innerHTML = exams.length
      ? exams.map((e) => `<li>${fmtDate(e.at)}: <strong>${e.score} / ${e.total}</strong> (${Math.round((e.score / e.total) * 100)}%), ${e.score >= subj.exam.passScore ? 'zaliczony' : 'niezaliczony'}, czas ${mmss(e.durationSec)}${e.realMode ? ', jak prawdziwy' : ''}</li>`).join('')
      : '';

    const byId = new Map(ctx.questions.map((q) => [q.id, q]));
    const stars = ctx.state.stars(s).map((id) => byId.get(id)).filter(Boolean);
    el('starList').innerHTML = stars.map((q) => `<li>${escapeHtml(q.question)}</li>`).join('') || '<li class="muted">Brak. Gwiazdkę dodasz na ekranie pytania.</li>';
    const doubtful = ctx.state.doubtful(s).map((x) => byId.get(x.id)).filter(Boolean);
    el('doubtfulList').innerHTML = doubtful.map((q) => `<li>${escapeHtml(q.question)}<br><span class="muted">Przyjęta odpowiedź: ${escapeHtml(q.options[q.answer])}</span></li>`).join('');
    el('btnCopyDoubtful').hidden = doubtful.length === 0;
    el('btnCopyDoubtful').querySelector('.label').textContent = 'Kopiuj listę';
  }

  el('examDateInput').addEventListener('change', () => {
    ctx.state.setExamDate(ctx.state.subject, el('examDateInput').value || null);
    render();
  });
  el('btnCopyDoubtful').addEventListener('click', async () => {
    const text = doubtfulReport(ctx.state.doubtful(ctx.state.subject), ctx.questions);
    try {
      await navigator.clipboard.writeText(text);
      el('btnCopyDoubtful').querySelector('.label').textContent = 'Skopiowano';
    } catch {
      window.prompt('Skopiuj listę:', text);
    }
  });
  el('btnClearSubject').addEventListener('click', async () => {
    const name = SUBJECTS[ctx.state.subject].name;
    if (await confirmDialog(`Wyczyścić cały postęp przedmiotu „${name}”? Usunie to odpowiedzi, powtórki, gwiazdki, wątpliwe pytania i historię egzaminów. Nie da się tego cofnąć.`, 'Wyczyść')) {
      ctx.state.clearSubject(ctx.state.subject);
      render();
    }
  });
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenStats') render(); });

  return { open: () => showScreen('screenStats'), render };
}
