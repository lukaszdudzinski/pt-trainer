// Sesja nauki, porcji, powtórek i fiszek: kolejka z powrotem błędnych pytań (spec 4.2–4.5). Czyste funkcje.
import { shuffle } from './bank.js';

export function createSession(questions, { requeueWrong = true, maxReturns = 3 } = {}) {
  return { queue: [...questions], index: 0, requeueWrong, maxReturns, returns: {}, seen: {}, answered: 0, correctFirstTry: 0, totalReturns: 0, total: questions.length };
}

export function current(s) {
  return s.index < s.queue.length ? s.queue[s.index] : null;
}

export function isDone(s) {
  return s.index >= s.queue.length;
}

export function answer(s, correct) {
  const q = current(s);
  if (!q) return s;
  const next = { ...s, index: s.index + 1, answered: s.answered + 1, seen: { ...s.seen }, returns: { ...s.returns } };
  if (!next.seen[q.id]) {
    next.seen[q.id] = true;
    if (correct) next.correctFirstTry++;
  }
  const used = next.returns[q.id] || 0;
  if (!correct && s.requeueWrong && used < s.maxReturns) {
    next.queue = [...s.queue, q];
    next.returns[q.id] = used + 1;
    next.totalReturns++;
  }
  return next;
}

export function summary(s) {
  return { answered: s.answered, correctFirstTry: s.correctFirstTry, returns: s.totalReturns, total: s.total };
}

// Porcja dnia: powtórki (i gwiazdki) → nigdy niewidziane → najdawniej widziane.
export function dailyPortion(questions, progress, stars, goal, rng = Math.random) {
  const starred = new Set(stars);
  const review = [];
  const fresh = [];
  const seen = [];
  for (const q of questions) {
    const r = progress[q.id];
    if (starred.has(q.id) || (r && r.inReview)) review.push(q);
    else if (!r || !r.seen) fresh.push(q);
    else seen.push(q);
  }
  seen.sort((x, y) => (progress[x.id].lastAt || 0) - (progress[y.id].lastAt || 0));
  return [...shuffle(review, rng), ...shuffle(fresh, rng), ...seen].slice(0, goal);
}
