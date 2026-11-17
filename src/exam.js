// Egzamin próbny: losowanie, wynik, werdykt i zegar (spec 4.6). Czyste funkcje.
import { shuffle } from './bank.js';

export function drawExam(questions, subject, rng = Math.random) {
  const pool = questions.filter((q) => q.subject === subject.id);
  const { total, quotas } = subject.exam;
  const shortfall = {};
  if (!quotas) return { questions: shuffle(pool, rng).slice(0, total), shortfall };
  const picked = [];
  for (const [section, n] of Object.entries(quotas)) {
    const inSection = shuffle(pool.filter((q) => q.section === section), rng);
    picked.push(...inSection.slice(0, n));
    if (inSection.length < n) shortfall[section] = n - inSection.length;
  }
  if (picked.length < total) {
    const used = new Set(picked.map((q) => q.id));
    picked.push(...shuffle(pool.filter((q) => !used.has(q.id)), rng).slice(0, total - picked.length));
  }
  return { questions: shuffle(picked, rng), shortfall };
}

// results: { [id]: true|false }; brak wpisu to błędna odpowiedź.
export function scoreExam(questions, results) {
  const bySection = {};
  let score = 0;
  for (const q of questions) {
    const ok = results[q.id] === true;
    if (ok) score++;
    const s = (bySection[q.section] ||= { correct: 0, total: 0 });
    s.total++;
    if (ok) s.correct++;
  }
  return { score, total: questions.length, bySection };
}

export function verdict(score, passScore) {
  return score >= passScore ? 'pass' : 'fail';
}

// Czas zegarowy: zablokowany telefon albo aplikacja w tle nie zatrzymują odliczania.
export function remainingSec({ startedAt, limitMin, pausedMs = 0 }, now) {
  const left = limitMin * 60 - (now - startedAt - pausedMs) / 1000;
  return Math.max(0, Math.ceil(left));
}
