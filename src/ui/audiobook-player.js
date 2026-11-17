// Odtwarzacz audiobooka Strefy Wiedzy PRO. Element <audio> gra przy zgaszonym ekranie i przy wyciszonym dzwonku
// (jak muzyka i filmy), a sterowanie jest też na ekranie blokady (Media Session). Nagranie to zaszyfrowane kawałki
// ~12 min pobierane na bieżąco: w pamięci telefonu jest tylko bieżący i następny kawałek, nic nie zostaje na stałe.
import { makeTimeline, formatTime, nextRate, nextSleep } from '../audiobook.js';
import { icon } from '../icons.js';

const SKIP_SEC = 15;

// 0,1 s ciszy (WAV): odblokowuje element <audio> w geście użytkownika, zanim nagranie się pobierze (iPhone).
function silentWavUrl() {
  const n = 800;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const s = (o, t) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 8000, true);
  b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); s(36, 'data'); b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
}

export function createAudiobook({ el, fetchChunk, onLocate, onError, getRate, setRate, media = globalThis.navigator && navigator.mediaSession }) {
  const audio = el('abAudio');
  const s = { tl: null, title: '', cur: -1, urls: new Map(), pending: new Map(), token: 0, last: null, unlocked: false, silent: null, sleepMin: 0, sleepAt: 0, sleepTimer: null, seeking: false, pageLabel: '' };

  const playing = () => !audio.paused;

  function ensure(c) {
    if (s.urls.has(c)) return Promise.resolve(s.urls.get(c));
    if (s.pending.has(c)) return s.pending.get(c);
    const p = fetchChunk(s.tl.chunks[c].file).then((bytes) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mp4' }));
      s.urls.set(c, url);
      return url;
    }).finally(() => s.pending.delete(c));
    s.pending.set(c, p);
    return p;
  }

  // W pamięci tylko bieżący i następny kawałek.
  function release(keep) {
    for (const [c, url] of s.urls) if (!keep.includes(c)) { URL.revokeObjectURL(url); s.urls.delete(c); }
  }

  function prefetch(c) {
    if (c + 1 < s.tl.chunks.length) ensure(c + 1).catch(() => {});
  }

  function setSrc(c, url, t) {
    if (s.cur !== c || audio.src !== url) {
      s.cur = c;
      audio.src = url;
      audio.playbackRate = getRate();
    }
    if (audio.readyState >= 1) audio.currentTime = t;
    else audio.addEventListener('loadedmetadata', () => { audio.currentTime = t; audio.playbackRate = getRate(); }, { once: true });
    release([c, c + 1]);
    prefetch(c);
  }

  // Ustawia nagranie na danym miejscu; gra, jeśli play. Gdy kawałek jest gotowy, play() idzie od razu (gest na iPhonie).
  function go({ chunk, t }, play) {
    const my = ++s.token;
    if (s.urls.has(chunk)) {
      setSrc(chunk, s.urls.get(chunk), t);
      if (play) start();
      renderTimes();
      return Promise.resolve();
    }
    if (play) unlock();
    render();
    return ensure(chunk).then((url) => {
      if (my !== s.token) return;
      setSrc(chunk, url, t);
      if (play) start();
      renderTimes();
    }).catch(() => { if (my === s.token) { pause(); onError('Nie udało się pobrać nagrania. Sprawdź internet i spróbuj ponownie.'); } });
  }

  function start() {
    const p = audio.play();
    if (p && p.catch) p.catch(() => render());
    render();
  }

  // Wywoływane w geście użytkownika, zanim nagranie jest gotowe: krótka cisza odblokowuje odtwarzanie.
  function unlock() {
    if (s.unlocked && audio.src) return;
    s.unlocked = true;
    if (!audio.src) {
      if (!s.silent) s.silent = silentWavUrl();
      audio.src = s.silent;
      s.cur = -1;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function pause() { audio.pause(); render(); }

  function load(material, pageIdx, para) {
    stop();
    s.tl = makeTimeline(material.audio);
    s.title = material.title;
    s.last = { pageIdx, para, mark: -1 };
    audio.removeAttribute('src');
    s.cur = -1;
    return go(s.tl.posOf(pageIdx, para), false);
  }

  function stop() {
    s.token++;
    if (!audio.paused) audio.pause();
    clearSleep();
    render();
  }

  function unload() {
    stop();
    release([]);
    s.tl = null;
  }

  const globalNow = () => (s.cur >= 0 && s.tl ? s.tl.toGlobal(s.cur, audio.currentTime || 0) : 0);

  function seekGlobal(g, play = playing()) { if (s.tl) go(s.tl.fromGlobal(g), play); }
  function seekBy(sec) { seekGlobal(globalNow() + sec); }
  function seekTo(pageIdx, para, play = playing()) { if (s.tl) go(s.tl.posOf(pageIdx, para), play); }

  function page(delta) {
    if (!s.tl) return false;
    const here = s.last ? s.last.pageIdx : 0;
    for (let p = here + delta; p >= 0 && p < 100000; p += delta) {
      const pos = s.tl.pageStart(p);
      if (pos) { go(pos, playing()); return true; }
      if (delta > 0 && p > s.tl.maxPage) break;
    }
    return false;
  }

  function toggle() {
    if (!s.tl) return;
    if (playing()) { pause(); return; }
    if (s.cur < 0) { const pos = s.last ? s.tl.posOf(s.last.pageIdx, s.last.para) : { chunk: 0, t: 0 }; go(pos, true); return; }
    start();
  }

  // ---------- wyłącznik czasowy ----------
  function clearSleep() { clearTimeout(s.sleepTimer); s.sleepMin = 0; s.sleepAt = 0; }
  function cycleSleep() {
    const min = nextSleep(s.sleepMin);
    clearSleep();
    s.sleepMin = min;
    if (min) {
      s.sleepAt = Date.now() + min * 60000;
      s.sleepTimer = setTimeout(checkSleep, min * 60000 + 50);
    }
    render();
  }
  function checkSleep() { if (s.sleepAt && Date.now() >= s.sleepAt) { clearSleep(); pause(); } }

  function cycleRate() {
    const r = nextRate(getRate());
    setRate(r);
    audio.playbackRate = r;
    render();
  }

  // ---------- widok ----------
  function renderTimes() {
    if (!s.tl) return;
    const g = globalNow();
    if (!s.seeking) el('abSeek').value = String(Math.round((g / (s.tl.total || 1)) * 1000));
    el('abElapsed').textContent = formatTime(g);
    el('abRemain').textContent = `−${formatTime(s.tl.total - g)}`;
  }

  function render() {
    const on = playing();
    const btn = el('abPlay');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Pauza' : 'Słuchaj');
    btn.innerHTML = icon(on ? 'pause' : 'play', 32);
    el('abRate').textContent = `Tempo ${String(getRate()).replace('.', ',')}×`;
    el('abSleep').textContent = s.sleepMin ? `Wyłącz za ${s.sleepMin} min` : 'Wyłącznik: nie';
    el('abSleep').setAttribute('aria-pressed', String(!!s.sleepMin));
    renderTimes();
    updateMedia();
  }

  function updateMedia() {
    if (!media) return;
    try {
      media.playbackState = playing() ? 'playing' : 'paused';
      if (globalThis.MediaMetadata && s.tl) {
        media.metadata = new MediaMetadata({
          title: s.title,
          artist: s.pageLabel || 'Strefa Wiedzy PRO',
          album: "Uki's PT Trainer",
          artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
        });
      }
    } catch { /* brak Media Session */ }
  }

  function bindMedia() {
    if (!media || !media.setActionHandler) return;
    const set = (action, fn) => { try { media.setActionHandler(action, fn); } catch { /* nieobsługiwane */ } };
    set('play', () => toggle());
    set('pause', () => pause());
    set('seekbackward', (d) => seekBy(-((d && d.seekOffset) || SKIP_SEC)));
    set('seekforward', (d) => seekBy((d && d.seekOffset) || SKIP_SEC));
    set('previoustrack', () => page(-1));
    set('nexttrack', () => page(1));
    set('seekto', (d) => { if (d && typeof d.seekTime === 'number') audio.currentTime = d.seekTime; });
  }

  // ---------- zdarzenia elementu <audio> ----------
  audio.addEventListener('timeupdate', () => {
    if (!s.tl || s.cur < 0) return;
    checkSleep();
    const loc = s.tl.locate(s.cur, audio.currentTime || 0);
    if (!s.last || loc.mark !== s.last.mark) { s.last = loc; onLocate(loc); }
    renderTimes();
  });
  audio.addEventListener('ended', () => {
    if (!s.tl || s.cur < 0) return;
    if (s.cur + 1 < s.tl.chunks.length) go({ chunk: s.cur + 1, t: 0 }, true);
    else { s.cur = -1; s.last = null; render(); }
  });
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('error', () => { if (s.cur >= 0) { onError('Nie udało się odtworzyć nagrania.'); render(); } });

  el('abPlay').addEventListener('click', toggle);
  el('abBack').addEventListener('click', () => seekBy(-SKIP_SEC));
  el('abFwd').addEventListener('click', () => seekBy(SKIP_SEC));
  el('abPrevPage').addEventListener('click', () => page(-1));
  el('abNextPage').addEventListener('click', () => page(1));
  el('abRate').addEventListener('click', cycleRate);
  el('abSleep').addEventListener('click', cycleSleep);
  el('abSeek').addEventListener('input', () => {
    s.seeking = true;
    if (s.tl) el('abElapsed').textContent = formatTime((Number(el('abSeek').value) / 1000) * s.tl.total);
  });
  el('abSeek').addEventListener('change', () => {
    s.seeking = false;
    if (s.tl) seekGlobal((Number(el('abSeek').value) / 1000) * s.tl.total);
  });
  bindMedia();

  return {
    load, stop, unload, toggle, seekTo, unlock, page,
    setPageLabel(label) { s.pageLabel = label; updateMedia(); },
    isPlaying: playing,
    position: () => s.last,
  };
}
