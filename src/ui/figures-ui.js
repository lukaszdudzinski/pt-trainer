// Ryciny Strefy Wiedzy PRO: obrazki w czytniku, powiększenie i „Ćwiczenia z rycin” (spec Strefy Wiedzy, rozdz. 10).
// Ryciny są zaszyfrowane i pobierane dopiero przy wyświetleniu; w pamięci najwyżej kilkadziesiąt ostatnich.
import { figurePool, pickSession, buildOptions } from '../figures.js';
import { renderAnswers, markAnswers, escapeHtml } from './answers.js';
import { showScreen } from '../nav.js';

const KEEP = 40;
const SESSION = 10;
const ZOOMS = [1, 2, 3];

export function initFigures({ el, store, loadIndex, loadMaterial, fetchFigure, openAt }) {
  const urls = new Map(); // file → Promise<url>, kolejność = ostatnie użycie

  function urlFor(file) {
    if (urls.has(file)) { const p = urls.get(file); urls.delete(file); urls.set(file, p); return p; }
    const p = fetchFigure(file).then((bytes) => URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })));
    p.catch(() => urls.delete(file));
    urls.set(file, p);
    while (urls.size > KEEP) {
      const [old, op] = urls.entries().next().value;
      urls.delete(old);
      op.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    }
    return p;
  }

  function setImg(img, file) {
    img.dataset.file = file;
    urlFor(file).then((u) => { if (img.dataset.file === file) img.src = u; }).catch(() => { img.alt = 'Nie udało się wczytać ryciny. Sprawdź internet.'; });
  }

  function figureHtml(f) {
    const label = escapeHtml(f.label || 'Rycina');
    return `<figure class="fig" data-fig="${escapeHtml(f.id)}"><button type="button" class="fig-btn" aria-label="Powiększ rycinę: ${label}"><img data-fig-file="${escapeHtml(f.file)}" alt="${label}" width="${f.w}" height="${f.h}"></button><figcaption>${label}</figcaption></figure>`;
  }

  function hydrate(container) {
    for (const img of container.querySelectorAll('img[data-fig-file]')) if (!img.dataset.file) setImg(img, img.dataset.figFile);
  }

  // ---------- powiększenie ----------
  let zoom = 1;
  function setZoom(z) {
    zoom = z;
    el('figViewerImg').style.setProperty('--zoom', String(z));
    el('btnFigZoom').textContent = `${z}×`;
    el('btnFigZoom').setAttribute('aria-label', z < 3 ? `Przybliż (teraz ${z}×)` : 'Oddal');
  }
  function openViewer(file, caption) {
    el('figViewerImg').removeAttribute('src');
    el('figViewerImg').alt = caption;
    el('figViewerCaption').textContent = caption;
    setZoom(1);
    setImg(el('figViewerImg'), file);
    el('figViewer').hidden = false;
    el('btnFigClose').focus();
  }
  function closeViewer() { el('figViewer').hidden = true; }
  el('btnFigZoom').addEventListener('click', () => setZoom(ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length]));
  el('btnFigClose').addEventListener('click', closeViewer);
  el('figViewer').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeViewer(); });
  document.addEventListener('screenchange', closeViewer);

  el('readerText').addEventListener('click', (e) => {
    const b = e.target.closest('.fig-btn');
    if (!b) return;
    e.stopPropagation();
    const img = b.querySelector('img');
    openViewer(img.dataset.figFile, img.alt);
  }, true);

  // ---------- ćwiczenia ----------
  const q = { all: [], pool: [], items: [], i: 0, score: 0, wrongNow: [], current: null };
  const wrongIds = () => store.get('fig-wrong', []) || [];
  const setWrong = (ids) => store.set('fig-wrong', [...new Set(ids)]);

  function show(part) {
    for (const id of ['figSetup', 'figQuestion', 'figResult']) el(id).hidden = id !== part;
  }

  function renderSetup() {
    const sel = el('figMaterial');
    const cur = sel.value;
    const byMat = new Map();
    for (const f of q.all) byMat.set(f.materialId, { title: f.materialTitle, n: (byMat.get(f.materialId)?.n || 0) + 1 });
    sel.innerHTML = `<option value="">Wszystkie (${q.all.length})</option>` + [...byMat].map(([id, v]) => `<option value="${id}">${escapeHtml(v.title)} (${v.n})</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
    const ids = new Set(q.all.map((f) => f.id));
    const wrong = wrongIds().filter((id) => ids.has(id));
    el('btnFigWrong').hidden = !wrong.length;
    el('btnFigWrong').textContent = `Powtórz błędne (${wrong.length})`;
    el('figSetupInfo').textContent = wrong.length ? `Do powtórki: ${wrong.length}. Seria zaczyna się od nich.` : 'Seria 10 rycin z wybranego materiału.';
    show('figSetup');
  }

  async function open() {
    showScreen('screenFigQuiz');
    show('figSetup');
    el('figSetupInfo').textContent = 'Wczytuję ryciny…';
    el('btnFigStart').disabled = true;
    try {
      const idx = await loadIndex();
      const mats = [];
      for (const m of idx.materials) mats.push(await loadMaterial(m.id));
      q.all = figurePool(mats);
    } catch {
      el('figSetupInfo').textContent = 'Nie udało się wczytać rycin. Sprawdź internet i spróbuj ponownie.';
      return;
    } finally { el('btnFigStart').disabled = false; }
    renderSetup();
  }

  function start(onlyWrong = false) {
    const mat = el('figMaterial').value || null;
    const pool = q.all.filter((f) => !mat || f.materialId === mat);
    const wrong = wrongIds();
    const src = onlyWrong ? q.all.filter((f) => wrong.includes(f.id)) : pool;
    q.pool = pool.length >= 4 ? pool : q.all;
    q.items = pickSession(src, wrong, SESSION);
    q.i = 0; q.score = 0; q.wrongNow = [];
    if (!q.items.length) { el('figSetupInfo').textContent = 'Brak rycin do ćwiczeń.'; return; }
    ask();
  }

  function ask() {
    const item = q.items[q.i];
    q.current = { item, ...buildOptions(item, q.pool.length >= 4 ? q.pool : q.all) };
    el('figProgress').textContent = `${q.i + 1} / ${q.items.length}`;
    el('figImage').removeAttribute('src');
    el('figImage').alt = 'Rycina do rozpoznania';
    setImg(el('figImage'), item.file);
    renderAnswers(el('figAnswers'), q.current);
    el('figFeedback').hidden = true;
    show('figQuestion');
  }

  function answer(i) {
    const c = q.current;
    if (!c || c.done) return;
    c.done = true;
    markAnswers(el('figAnswers'), c, i);
    const ok = i === c.correct;
    let wrong = wrongIds();
    if (ok) { q.score++; wrong = wrong.filter((id) => id !== c.item.id); } else { wrong.push(c.item.id); q.wrongNow.push(c.item.id); }
    setWrong(wrong);
    el('figFeedback').dataset.result = ok ? 'correct' : 'wrong';
    el('figFeedbackText').textContent = ok ? 'Dobrze!' : `Źle. To: ${c.item.label}`;
    el('figFeedbackSource').textContent = `${c.item.materialTitle}, strona ${c.item.page}`;
    el('btnFigNext').textContent = q.i + 1 < q.items.length ? 'Dalej' : 'Wynik';
    el('figFeedback').hidden = false;
    el('btnFigNext').focus();
  }

  function next() {
    q.i++;
    if (q.i < q.items.length) { ask(); return; }
    el('figResultText').textContent = `Wynik: ${q.score} / ${q.items.length}`;
    el('btnFigRepeatWrong').hidden = !q.wrongNow.length;
    show('figResult');
  }

  el('btnFigExercises').addEventListener('click', open);
  el('btnFigStart').addEventListener('click', () => start(false));
  el('btnFigWrong').addEventListener('click', () => start(true));
  el('btnFigAgain').addEventListener('click', renderSetup);
  el('btnFigRepeatWrong').addEventListener('click', () => start(true));
  el('figMaterial').addEventListener('change', renderSetup);
  el('figAnswers').addEventListener('click', (e) => { const b = e.target.closest('.answer-btn'); if (b) answer(Number(b.dataset.index)); });
  el('btnFigNext').addEventListener('click', next);
  el('btnFigReadMore').addEventListener('click', () => { const c = q.current; if (c) openAt(c.item.materialId, c.item.page); });
  el('figImageBtn').addEventListener('click', () => { const c = q.current; if (c) openViewer(c.item.file, c.done ? c.item.label : 'Rycina'); });

  return { figureHtml, hydrate, clear: () => { for (const p of urls.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => {}); urls.clear(); } };
}
