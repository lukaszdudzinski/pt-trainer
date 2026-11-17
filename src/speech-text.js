// Przygotowanie tekstu dla lektora (spec 5). Czyste funkcje.
const L = 'ABCDE';
const NB = '(^|[^\\p{L}])';
const RULES = [
  [/m\.in\./gu, 'między innymi'],
  [new RegExp(`${NB}np\\.`, 'gu'), '$1na przykład'],
  [new RegExp(`${NB}tzw\\.`, 'gu'), '$1tak zwany'],
  [new RegExp(`${NB}mm\\.`, 'gu'), '$1mięśnie'],
  [new RegExp(`${NB}m\\.(?=\\s)`, 'gu'), '$1mięsień'],
  [new RegExp(`${NB}kr\\.`, 'gu'), '$1kręgi'],
  [new RegExp(`${NB}kcal(?![\\p{L}])`, 'gu'), '$1kilokalorii'],
  [/mg\/dl/gu, 'miligramów na decylitr'],
  [new RegExp(`${NB}EQF(?![\\p{L}])`, 'gu'), '$1E Q F'],
  [new RegExp(`${NB}HR(?![\\p{L}])`, 'gu'), '$1H R'],
  [new RegExp(`${NB}RPE(?![\\p{L}])`, 'gu'), '$1R P E'],
  [/\(\s*[a-eA-E]\s*\)/gu, ''],
];

export function toSpeech(text) {
  let s = String(text || '');
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

const sentence = (s) => (/[.?!:]$/.test(s) ? s : `${s}.`);

export function questionToSpeech(p) {
  const head = p.image ? 'Pytanie ze zdjęciem.' : 'Pytanie.';
  const opts = p.options.map((o, i) => `${L[i]}: ${sentence(toSpeech(o))}`).join(' ');
  return `${head} ${sentence(toSpeech(p.question))} ${opts}`;
}

export function feedbackToSpeech(p, chosen, withExplanation) {
  const base = chosen === p.correct ? 'Dobrze.' : `Źle. Poprawna odpowiedź to ${L[p.correct]}: ${sentence(toSpeech(p.options[p.correct]))}`;
  return withExplanation && p.explanation ? `${base} ${toSpeech(p.explanation)}` : base;
}
