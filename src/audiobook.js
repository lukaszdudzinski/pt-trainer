// Audiobook Strefy Wiedzy PRO: oś czasu nagrań. Nagranie materiału to kawałki ~12 min;
// znacznik akapitu = [indeks strony, akapit, kawałek, sekunda w kawałku].
export const RATES = [1, 1.25, 1.5, 0.9];
export const SLEEPS = [0, 15, 30, 45, 60];

export function nextRate(rate) {
  const i = RATES.indexOf(rate);
  return i < 0 ? 1 : RATES[(i + 1) % RATES.length];
}

export function nextSleep(min) {
  const i = SLEEPS.indexOf(min);
  return i < 0 ? 0 : SLEEPS[(i + 1) % SLEEPS.length];
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function makeTimeline(audio) {
  const { chunks, marks } = audio;
  const offsets = [];
  let acc = 0;
  for (const c of chunks) { offsets.push(acc); acc += c.duration; }
  const total = acc;

  const at = (i) => ({ chunk: marks[i][2], t: marks[i][3] });

  function locate(chunk, t) {
    let best = 0;
    for (let i = 0; i < marks.length; i++) {
      const [, , c, s] = marks[i];
      if (c < chunk || (c === chunk && s <= t)) best = i; else break;
    }
    return { pageIdx: marks[best][0], para: marks[best][1], mark: best };
  }

  function posOf(pageIdx, para) {
    let best = 0;
    for (let i = 0; i < marks.length; i++) {
      const [p, a] = marks[i];
      if (p < pageIdx || (p === pageIdx && a <= para)) best = i; else break;
    }
    return at(best);
  }

  function pageStart(pageIdx) {
    const i = marks.findIndex((m) => m[0] === pageIdx);
    return i < 0 ? null : at(i);
  }

  const toGlobal = (chunk, t) => offsets[chunk] + t;

  function fromGlobal(g) {
    const x = Math.min(Math.max(0, g), total);
    for (let c = chunks.length - 1; c >= 0; c--) if (x >= offsets[c]) return { chunk: c, t: Math.min(x - offsets[c], chunks[c].duration) };
    return { chunk: 0, t: 0 };
  }

  const maxPage = marks.length ? marks[marks.length - 1][0] : 0;
  return { total, locate, posOf, pageStart, toGlobal, fromGlobal, chunks, maxPage };
}
