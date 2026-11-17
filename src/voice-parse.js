// Rozpoznany tekst → odpowiedź albo komenda (spec 5). Porównanie całych słów, jak w OWI SSI.
// iPhone zapisuje litery różnie: „A” jako „Ą”, „B” jako „Bę” itd.
const LETTERS = { a: 0, ą: 0, aa: 0, b: 1, be: 1, bé: 1, bę: 1, bi: 1, c: 2, ce: 2, cé: 2, cę: 2, tse: 2, d: 3, de: 3, dé: 3, dę: 3, di: 3 };
const NUMBERS = [
  ['jeden', 'jedynka', 'raz', 'pierwsza', 'pierwsze', 'pierwszy', 'pierwszą', '1'],
  ['dwa', 'dwójka', 'druga', 'drugie', 'drugi', 'drugą', '2'],
  ['trzy', 'trójka', 'trzecia', 'trzecie', 'trzeci', 'trzecią', '3'],
  ['cztery', 'czwórka', 'czwarta', 'czwarte', 'czwarty', 'czwartą', '4'],
  ['pięć', 'piątka', 'piąta', 'piąte', 'piąty', 'piątą', '5'],
];
const TRUTH_WORDS = ['prawda', 'fałsz', 'tak', 'nie'];

const words = (t) => String(t || '').toLowerCase().replace(/[.,!?;:"„”'()…\-–—]/g, ' ').split(/\s+/).filter(Boolean);
const has = (w, list) => w.some((x) => list.includes(x));
const phrase = (w, p) => w.join(' ').includes(p);

const QUIT = ['zakończ', 'zakoncz', 'koniec'];
const EXPLAIN = ['uzasadnij', 'uzasadnienie', 'wyjaśnij', 'wyjasnij', 'wyjaśnienie', 'dlaczego'];

function flashCommand(w) {
  if (has(w, QUIT)) return 'quit';
  if (phrase(w, 'nie znam') || phrase(w, 'nie wiem')) return 'dontKnow';
  if (has(w, ['znam', 'wiem'])) return 'know';
  if (has(w, ['odwróć', 'odwroc', 'pokaż', 'pokaz'])) return 'flip';
  if (has(w, ['dalej', 'następne', 'następna', 'następny'])) return 'next';
  if (has(w, ['powtórz', 'powtorz']) || phrase(w, 'jeszcze raz')) return 'repeat';
  return null;
}

export function parseVoice(transcript, ctx) {
  const w = words(transcript);
  if (!w.length) return { type: 'unknown' };
  const { options = [], mode = 'quiz' } = ctx || {};

  if (mode === 'flash-front' || mode === 'flash-back') {
    const name = flashCommand(w);
    return name ? { type: 'command', name } : { type: 'unknown' };
  }
  if (has(w, ['powtórz', 'powtorz', 'czytaj']) || phrase(w, 'jeszcze raz')) return { type: 'command', name: 'repeat' };
  if (has(w, QUIT)) return { type: 'command', name: 'quit' };
  if (mode === 'feedback') {
    if (has(w, EXPLAIN)) return { type: 'command', name: 'explain' };
    if (has(w, ['dalej', 'następne', 'następna', 'następny', 'ok', 'okej'])) return { type: 'command', name: 'next' };
    return { type: 'unknown' };
  }

  const found = new Set();
  for (const x of w) {
    if (x in LETTERS) found.add(LETTERS[x]);
    NUMBERS.forEach((list, i) => { if (list.includes(x)) found.add(i); });
    if (TRUTH_WORDS.includes(x)) {
      const i = options.findIndex((o) => words(o)[0] === x);
      if (i >= 0) found.add(i);
    }
  }
  if (options.length === 5 && w.length === 1 && ['e', 'ee', 'ę'].includes(w[0])) found.add(4);
  const valid = [...found].filter((i) => i < options.length);
  if (found.size === 1 && valid.length === 1) return { type: 'answer', index: valid[0] };
  return { type: 'unknown' };
}
