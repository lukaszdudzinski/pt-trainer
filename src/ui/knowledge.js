// Strefa Wiedzy PRO: kod PRO, lista materiałów, czytnik z lektorem (spec Strefy Wiedzy, rozdz. 4 i 6)
// i audiobook: materiał z nagraniem gra jak muzyka (zgaszony ekran, wyciszony dzwonek), bez nagrania czyta lektor.
import { unwrapContentKey, decryptJson, decryptBytes, toB64, fromB64 } from '../pro.js';
import { createAudiobook } from './audiobook-player.js';
import { initFigures } from './figures-ui.js';
import { figuresByPlace } from '../figures.js';
import { showScreen, onLeave } from '../nav.js';
import { escapeHtml } from './answers.js';
import { icon } from '../icons.js';

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

export function initKnowledge(ctx, { speech }) {
  const el = (id) => document.getElementById(id);
  const store = ctx.store;
  let index = null;
  const cache = new Map();
  const r = { material: null, pageIdx: 0, para: 0, playing: false, token: 0, openToken: 0, audioMode: false };
  const QUIET = ['error:interrupted', 'error:canceled'];
  const SETTLE_MS = 250;
  const MAX_RETRIES = 3;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  const getKey = () => { const k = store.get('pro', null); try { return k ? fromB64(k) : null; } catch { return null; } };
  const isUnlocked = () => !!getKey();

  async function loadIndex() {
    if (index) return index;
    const res = await fetch('materials/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`index ${res.status}`);
    index = await res.json();
    return index;
  }

  function progressOf(id) { return (store.get('reading', {}) || {})[id] || null; }
  function saveProgress() {
    if (!r.material) return;
    const all = store.get('reading', {}) || {};
    all[r.material.id] = { page: r.material.pages[r.pageIdx].n, para: r.para, at: Date.now() };
    store.set('reading', all);
  }

  function renderStatus() {
    el('proStatus').textContent = isUnlocked() ? 'Strefa Wiedzy PRO: odblokowana na tym telefonie' : 'Strefa Wiedzy PRO: zablokowana';
    el('btnForgetPro').hidden = !isUnlocked();
    el('knowledgeSub').textContent = isUnlocked() ? 'Materiały czytane przez lektora' : 'Odblokuj kodem PRO';
  }

  function showLocked(message = '') {
    el('proLocked').hidden = false;
    el('proUnlocked').hidden = true;
    el('proMessage').textContent = message;
  }

  async function renderList() {
    el('proLocked').hidden = true;
    el('proUnlocked').hidden = false;
    let idx;
    try { idx = await loadIndex(); } catch { el('materialList').innerHTML = '<li class="muted">Nie udało się wczytać listy materiałów. Sprawdź internet.</li>'; return; }
    el('materialList').innerHTML = idx.materials.map((m) => {
      const p = progressOf(m.id);
      const len = m.audioMin ? ` · <span class="ab-len">${icon('headphones', 14)}${formatMinutes(m.audioMin)}</span>` : '';
      return `<li data-id="${m.id}"><button type="button">${escapeHtml(m.title)}<small>${m.pages} stron${len}${p ? ` · strona ${p.page}` : ''}</small></button></li>`;
    }).join('');
    renderContinue(idx);
  }

  // „Słuchasz”: ostatnio otwierany materiał, jednym dotknięciem od miejsca, w którym skończono.
  function renderContinue(idx) {
    const all = store.get('reading', {}) || {};
    const last = Object.entries(all).filter(([id, p]) => p && p.at && idx.materials.some((m) => m.id === id)).sort((a, b) => b[1].at - a[1].at)[0];
    el('btnContinue').hidden = !last;
    if (!last) return;
    const m = idx.materials.find((x) => x.id === last[0]);
    el('btnContinue').dataset.id = m.id;
    el('continueTitle').textContent = m.title;
    el('continueSub').textContent = `Strona ${last[1].page} z ${m.pages}${m.audioMin ? ' · audiobook' : ''}`;
  }

  async function open() {
    renderStatus();
    if (isUnlocked()) renderList(); else showLocked();
    showScreen('screenKnowledge');
  }

  async function unlock() {
    el('proMessage').textContent = 'Sprawdzam kod…';
    let idx;
    try { idx = await loadIndex(); } catch { el('proMessage').textContent = 'Nie udało się wczytać materiałów. Sprawdź internet.'; return; }
    const key = await unwrapContentKey(el('proCode').value, idx.keys);
    if (!key) { el('proMessage').textContent = 'Nieprawidłowy kod.'; return; }
    store.set('pro', toB64(key));
    el('proCode').value = '';
    renderStatus();
    renderList();
  }

  function forget() {
    stop();
    ab.unload();
    store.remove('pro');
    cache.clear();
    r.material = null;
    el('readerText').innerHTML = '';
    delete el('readerText').dataset.page;
    figs_.clear();
    el('proUnlocked').hidden = true;
    renderStatus();
  }

  // ---------- czytnik ----------
  async function loadMaterial(id) {
    if (cache.has(id)) return cache.get(id);
    const idx = await loadIndex();
    const meta = idx.materials.find((m) => m.id === id);
    const res = await fetch(`materials/${meta.file}`);
    if (!res.ok) throw Object.assign(new Error('fetch'), { kind: 'network' });
    const bytes = new Uint8Array(await res.arrayBuffer());
    let data;
    try { data = await decryptJson(getKey(), bytes); } catch { throw Object.assign(new Error('key'), { kind: 'key' }); }
    cache.set(id, data);
    return data;
  }

  function renderPage() {
    const page = r.material.pages[r.pageIdx];
    el('readerPage').value = String(page.n);
    const box = el('readerText');
    const key = `${r.material.id}:${page.n}`;
    // Ta sama strona: tylko przesunięcie podświetlenia (ryciny się nie przeładowują).
    if (box.dataset.page === key) {
      for (const p of box.querySelectorAll('p[data-i]')) p.classList.toggle('current', Number(p.dataset.i) === r.para);
    } else {
      const at = figuresByPlace(page.figures, page.paragraphs.length);
      const figs = (i) => (at.get(i) || []).map(figs_.figureHtml).join('');
      box.innerHTML = figs(-1) + page.paragraphs.map((t, i) => `<p data-i="${i}"${i === r.para ? ' class="current"' : ''}>${escapeHtml(t)}</p>${figs(i)}`).join('')
        + (!page.paragraphs.length && !(page.figures || []).length ? '<p class="muted">Ta strona zawiera tylko ryciny.</p>' : '');
      box.dataset.page = key;
      figs_.hydrate(box);
    }
    const cur = box.querySelector('p.current');
    if (cur && (r.playing || ab.isPlaying()) && cur.scrollIntoView) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function setPlaying(on) {
    r.playing = on;
    el('btnReadToggle').setAttribute('aria-pressed', String(on));
    el('btnReadToggle').querySelector('.tool-label').textContent = on ? 'Pauza' : 'Czytaj';
  }

  function stop() {
    r.token++;
    if (r.playing) speech.cancel();
    setPlaying(false);
    ab.stop();
  }

  function step(delta) {
    const pages = r.material.pages;
    let { pageIdx, para } = r;
    para += delta;
    while (pageIdx >= 0 && pageIdx < pages.length && (para < 0 || para >= pages[pageIdx].paragraphs.length)) {
      if (para < 0) { pageIdx--; if (pageIdx >= 0) para = pages[pageIdx].paragraphs.length - 1; }
      else { pageIdx++; para = 0; }
    }
    if (pageIdx < 0 || pageIdx >= pages.length) return false;
    r.pageIdx = pageIdx;
    r.para = para;
    saveProgress();
    renderPage();
    return true;
  }

  function readerError(text) {
    el('readerMessage').textContent = text;
    el('readerMessage').hidden = false;
  }

  async function playFromCurrent() {
    if (!r.material) return;
    if (!speech.supported.tts) { readerError('Ta przeglądarka nie ma lektora.'); return; }
    el('readerMessage').hidden = true;
    const my = ++r.token;
    setPlaying(true);
    let retries = 0;
    // iPhone: tuż po przerwaniu czytania nowe czytanie bywa od razu anulowane, więc chwila przerwy przed startem.
    await wait(SETTLE_MS);
    while (r.token === my) {
      const page = r.material.pages[r.pageIdx];
      if (!page.paragraphs.length) { if (!step(1)) break; continue; }
      renderPage();
      const result = await speech.speak(page.paragraphs[r.para]);
      if (r.token !== my) return;
      // Przerwane przez system, a nie przez użytkownika: przeczytaj ten sam akapit jeszcze raz, bez przeskakiwania.
      if (QUIET.includes(result) && retries < MAX_RETRIES) { retries++; await wait(SETTLE_MS); continue; }
      retries = 0;
      // Błąd lektora: zatrzymaj w miejscu, bez przewijania materiału.
      if (String(result).startsWith('error:') && !QUIET.includes(result)) {
        if (ctx.errors) ctx.errors.log('czytnik', result.slice(6));
        readerError(`Lektor nie może czytać (${result.slice(6)}). Sprawdź tryb cichy i głos w Opcjach.`);
        break;
      }
      if (!step(1)) break;
    }
    if (r.token === my) setPlaying(false);
  }

  async function openAt(id, pageN = null, { play = false } = {}) {
    stop();
    const my = ++r.openToken;
    r.material = null;
    el('readerMessage').hidden = true;
    el('readerText').innerHTML = '';
    delete el('readerText').dataset.page;
    showScreen('screenReader');
    const stale = () => my !== r.openToken || !el('screenReader').classList.contains('active');
    let m;
    try { m = await loadMaterial(id); } catch (e) {
      if (stale()) return;
      if (e.kind === 'key') { store.remove('pro'); cache.clear(); renderStatus(); showLocked('Kod wygasł albo materiały się zmieniły. Wpisz kod ponownie.'); showScreen('screenKnowledge', { push: false }); return; }
      el('readerMessage').textContent = 'Nie udało się wczytać materiału. Sprawdź internet i spróbuj ponownie.';
      el('readerMessage').hidden = false;
      return;
    }
    if (stale()) return;
    r.material = m;
    const p = progressOf(id);
    const want = pageN ?? (p ? p.page : 1);
    const idx = m.pages.findIndex((x) => x.n === want);
    r.pageIdx = idx >= 0 ? idx : 0;
    r.para = idx >= 0 && pageN === null && p && p.para < m.pages[r.pageIdx].paragraphs.length ? p.para : 0;
    el('readerTitle').textContent = m.title;
    el('readerPage').innerHTML = m.pages.map((x) => `<option value="${x.n}">${x.n}</option>`).join('');
    saveProgress();
    renderPage();
    r.audioMode = !!(m.audio && m.audio.chunks && m.audio.chunks.length);
    el('ttsControls').hidden = r.audioMode;
    el('audioPlayer').hidden = !r.audioMode;
    if (r.audioMode) {
      ab.load(m, r.pageIdx, r.para);
      ab.setPageLabel(`Strona ${m.pages[r.pageIdx].n}`);
      if (play) ab.toggle();
    } else {
      ab.unload();
      if (play) playFromCurrent();
    }
  }

  // ---------- ryciny ----------
  async function fetchFigure(file) {
    const res = await fetch(`materials/${file}`);
    if (!res.ok) throw new Error(`fig ${res.status}`);
    return decryptBytes(getKey(), new Uint8Array(await res.arrayBuffer()));
  }
  const figs_ = initFigures({ el, store, loadIndex, loadMaterial, fetchFigure, openAt: (id, page) => openAt(id, page) });

  // ---------- audiobook ----------
  async function fetchChunk(file) {
    const res = await fetch(`materials/${file}`);
    if (!res.ok) throw new Error(`audio ${res.status}`);
    return decryptBytes(getKey(), new Uint8Array(await res.arrayBuffer()));
  }

  const ab = createAudiobook({
    el,
    fetchChunk,
    onError: (text) => readerError(text),
    getRate: () => Number((store.get('audio', {}) || {}).rate) || 1,
    setRate: (rate) => store.set('audio', { ...(store.get('audio', {}) || {}), rate }),
    onLocate: ({ pageIdx, para }) => {
      if (!r.material || !r.audioMode || !r.material.pages[pageIdx]) return;
      r.pageIdx = pageIdx;
      r.para = para;
      saveProgress();
      renderPage();
      ab.setPageLabel(`Strona ${r.material.pages[pageIdx].n}`);
    },
  });

  el('btnKnowledge').addEventListener('click', open);
  el('btnUnlock').addEventListener('click', unlock);
  el('proCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
  el('materialList').addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (li) openAt(li.dataset.id); });
  // Dotknięcie „Słuchasz” to gest: odblokowanie dźwięku od razu, zanim nagranie się pobierze (iPhone).
  el('btnContinue').addEventListener('click', () => { ab.unlock(); openAt(el('btnContinue').dataset.id, null, { play: true }); });
  el('btnForgetPro').addEventListener('click', forget);
  el('btnReadToggle').addEventListener('click', () => { if (r.playing) stop(); else if (r.material) playFromCurrent(); });
  el('btnNextPara').addEventListener('click', () => { if (!r.material) return; const was = r.playing; stop(); step(1); if (was) playFromCurrent(); });
  el('btnPrevPara').addEventListener('click', () => { if (!r.material) return; const was = r.playing; stop(); step(-1); if (was) playFromCurrent(); });
  el('readerPage').addEventListener('change', () => {
    if (!r.material) return;
    const wasPlaying = ab.isPlaying();
    stop();
    const idx = r.material.pages.findIndex((x) => String(x.n) === el('readerPage').value);
    if (idx >= 0) { r.pageIdx = idx; r.para = 0; saveProgress(); renderPage(); }
    if (idx >= 0 && r.audioMode) ab.seekTo(idx, 0, wasPlaying);
  });
  el('readerText').addEventListener('click', (e) => {
    const p = e.target.closest('p[data-i]');
    if (!p || !r.material) return;
    r.para = Number(p.dataset.i);
    if (r.audioMode) { saveProgress(); renderPage(); ab.seekTo(r.pageIdx, r.para, true); return; }
    stop();
    saveProgress();
    renderPage();
    playFromCurrent();
  });
  onLeave('screenReader', stop);
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenSettings' || e.detail.id === 'screenHome') renderStatus(); });
  renderStatus();

  return { open, openAt, isUnlocked, linksFor: async () => { try { const res = await fetch('materials/links.json'); return res.ok ? res.json() : {}; } catch { return {}; } } };
}
