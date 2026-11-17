// Ryciny Strefy Wiedzy PRO: miejsca w tekście i „Ćwiczenia z rycin” (spec Strefy Wiedzy, rozdz. 10).

export function figurePool(materials, materialId = null) {
  const out = [];
  for (const m of materials) {
    if (materialId && m.id !== materialId) continue;
    for (const p of m.pages) for (const f of p.figures || []) {
      if (f.exercise !== false) out.push({ ...f, materialId: m.id, materialTitle: m.title, page: p.n });
    }
  }
  return out;
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Seria: najpierw ryciny z błędną odpowiedzią, potem pozostałe, losowo.
export function pickSession(pool, wrongIds = [], n = 10, rng = Math.random) {
  const wrong = new Set(wrongIds);
  const first = shuffle(pool.filter((f) => wrong.has(f.id)), rng);
  const rest = shuffle(pool.filter((f) => !wrong.has(f.id)), rng);
  return [...first, ...rest].slice(0, n);
}

// Podpis ryciny i do 3 innych podpisów (najpierw z tego samego materiału); bez powtórzeń.
export function buildOptions(item, pool, rng = Math.random) {
  const used = new Set([item.label]);
  const pickFrom = (list) => {
    const out = [];
    for (const f of shuffle(list, rng)) {
      if (used.size >= 4) break;
      if (used.has(f.label)) continue;
      used.add(f.label);
      out.push(f.label);
    }
    return out;
  };
  const same = pickFrom(pool.filter((f) => f.materialId === item.materialId && f.id !== item.id));
  const other = pickFrom(pool.filter((f) => f.materialId !== item.materialId));
  const options = shuffle([item.label, ...same, ...other], rng);
  return { options, correct: options.indexOf(item.label) };
}

// Ryciny strony według miejsca: klucz = numer akapitu, po którym stoją (−1: przed pierwszym).
export function figuresByPlace(figures, paragraphCount) {
  const map = new Map();
  for (const f of figures || []) {
    const at = Math.min(Math.max(-1, f.after), paragraphCount - 1);
    if (!map.has(at)) map.set(at, []);
    map.get(at).push(f);
  }
  return map;
}
