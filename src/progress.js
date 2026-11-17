// Postęp nauki, powtórki, gotowość, dzienny cel i seria (spec 4.4, 4.7, 6.3). Czyste funkcje.
import { READY } from '../data/subjects.js';

const EMPTY = { seen: 0, correct: 0, wrong: 0, last2: [], inReview: false, reviewStreak: 0, lastAt: 0 };
const REVIEW_EXIT = 2;
const FULL_EXAM = 72;
const DAY_MIN = 10;
const KEEP_DAYS = 60;

export function recordAnswer(progress, id, correct, now) {
  const r = { ...EMPTY, ...(progress[id] || {}) };
  const next = {
    seen: r.seen + 1,
    correct: r.correct + (correct ? 1 : 0),
    wrong: r.wrong + (correct ? 0 : 1),
    last2: [...(r.last2 || []), correct].slice(-2),
    inReview: r.inReview,
    reviewStreak: r.reviewStreak,
    lastAt: now,
  };
  if (!correct) { next.inReview = true; next.reviewStreak = 0; }
  else if (r.inReview) {
    next.reviewStreak = r.reviewStreak + 1;
    if (next.reviewStreak >= REVIEW_EXIT) { next.inReview = false; next.reviewStreak = 0; }
  }
  return { ...progress, [id]: next };
}

export function isMastered(rec) {
  return !!rec && Array.isArray(rec.last2) && rec.last2.length === 2 && rec.last2.every(Boolean) && !rec.inReview;
}

export function reviewIds(progress, stars, bankIds) {
  const starred = new Set(stars);
  return bankIds.filter((id) => starred.has(id) || (progress[id] && progress[id].inReview));
}

export function masteredCount(progress, bankIds) {
  return bankIds.filter((id) => isMastered(progress[id])).length;
}

export function readiness(progress, bankIds, exams) {
  const full = exams.filter((e) => e.total === FULL_EXAM).slice(0, READY.exams);
  const lastScores = full.map((e) => e.score / e.total);
  let streak = 0;
  for (const s of lastScores) { if (s >= READY.threshold) streak++; else break; }
  return {
    masteredPct: bankIds.length ? Math.round((masteredCount(progress, bankIds) / bankIds.length) * 100) : 0,
    lastScores,
    ready: streak >= READY.exams,
    examsMissing: Math.max(0, READY.exams - streak),
  };
}

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromKey, toKey) {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000);
}

export function addAnswerToday(daily, now) {
  const today = localDateKey(now);
  const days = {};
  for (const [k, v] of Object.entries(daily.days || {})) if (daysBetween(k, today) <= KEEP_DAYS) days[k] = v;
  days[today] = (days[today] || 0) + 1;
  return { ...daily, days };
}

export function countToday(daily, now) {
  return (daily.days || {})[localDateKey(now)] || 0;
}

export function dailyGoal(unmasteredCount, examDate, now) {
  if (!examDate) return 20;
  const days = Math.max(1, daysBetween(localDateKey(now), examDate));
  return Math.min(80, Math.max(DAY_MIN, Math.ceil(unmasteredCount / days)));
}

export function streakDays(daily, now) {
  const days = daily.days || {};
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ((days[localDateKey(cursor)] || 0) < DAY_MIN) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while ((days[localDateKey(cursor)] || 0) >= DAY_MIN) { n++; cursor.setDate(cursor.getDate() - 1); }
  return n;
}

export function toggleStar(stars, id) {
  return stars.includes(id) ? stars.filter((x) => x !== id) : [...stars, id];
}

export function addDoubtful(list, id, now) {
  return list.some((x) => x.id === id) ? list : [...list, { id, at: now }];
}

export function removeDoubtful(list, id) {
  return list.filter((x) => x.id !== id);
}

export function doubtfulReport(list, questions) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return list.map((x) => byId.get(x.id)).filter(Boolean)
    .map((q, i) => `${i + 1}. ${q.question}\n   Przyjęta odpowiedź: ${q.options[q.answer]}\n   (${q.id})`)
    .join('\n\n');
}

export function pushExam(exams, entry) {
  return [entry, ...exams].slice(0, 50);
}
