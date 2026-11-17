// Lektor i rozpoznawanie mowy (Web Speech API, darmowe) w sposób sprawdzony w OWI SSI na iPhonie właściciela:
// - jedno wypowiedzenie na cały tekst, cancel() przed czytaniem, polski głos, krótka cisza WebAudio przed czytaniem;
// - bez zmiany sesji dźwięku przeglądarki (navigator.audioSession), której OWI SSI nie używa (podejrzana o uciszanie lektora);
// - jeden obiekt SpeechRecognition na całe działanie aplikacji, zatrzymywany przez stop().
const FATAL_ERRORS = ['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
const RESTART_MS = 300;

export function polishVoices(synth) {
  try { return (synth.getVoices() || []).filter((v) => /^pl(-|_|$)/i.test(v.lang)); } catch { return []; }
}

// Krótka cisza z nowego AudioContext przed czytaniem (OWI SSI: „carplayHack”, domyślnie włączony).
export function browserAudio() {
  return {
    playSilence() {
      try {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        setTimeout(() => { try { ctx.close(); } catch { /* brak */ } }, 500);
      } catch { /* brak WebAudio */ }
    },
  };
}

export function createSpeech({
  synth = globalThis.speechSynthesis,
  Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
  Utterance = globalThis.SpeechSynthesisUtterance,
  getSettings,
  onUnavailable = () => {},
  onSpeechEvent = () => {},
  audio = browserAudio(),
} = {}) {
  const supported = { tts: !!(synth && Utterance), stt: !!Recognition };
  let speakId = 0;

  // ---------- lektor ----------
  function pickVoice() {
    const s = getSettings();
    const list = polishVoices(synth);
    return list.find((v) => v.voiceURI === s.voiceURI) || list[0] || null;
  }

  function utter(text, onEvent) {
    const s = getSettings();
    const u = new Utterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = 'pl-PL';
    u.rate = Number(s.rate) || 1;
    u.volume = s.volume === undefined ? 1 : Number(s.volume);
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      // Wynik: 'end' | 'error:<kod>' | 'timeout' (czytnik Strefy Wiedzy zatrzymuje się przy błędzie).
      const finish = (result) => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
      u.onstart = () => onEvent('start');
      u.onend = () => { onEvent('end'); finish('end'); };
      u.onerror = (e) => { const ev = `error:${(e && e.error) || 'unknown'}`; onEvent(ev); finish(ev); };
      // Zabezpieczenie, gdy przeglądarka nie wyśle onend (nie zatrzymuje nauki).
      timer = setTimeout(() => finish('timeout'), Math.max(8000, text.length * 200 / (u.rate || 1)));
      synth.speak(u);
    });
  }

  function speak(text) {
    if (!supported.tts || !text) return Promise.resolve('unsupported');
    speakId++;
    try { synth.cancel(); } catch { /* brak */ }
    if (audio) audio.playSilence();
    return utter(text, onSpeechEvent);
  }

  // Diagnostyka: najprostsze czytanie, bez ciszy i bez wyboru głosu.
  function speakPlain(text, onEvent = () => {}) {
    if (!supported.tts) { onEvent('error:unsupported'); return Promise.resolve(); }
    return new Promise((resolve) => {
      const u = new Utterance(text);
      u.lang = 'pl-PL';
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onstart = () => onEvent('start');
      u.onend = () => { onEvent('end'); finish(); };
      u.onerror = (e) => { onEvent(`error:${(e && e.error) || 'unknown'}`); finish(); };
      setTimeout(() => { if (!done) onEvent('brak zdarzenia końca po 6 s'); finish(); }, 6000);
      try { synth.speak(u); } catch (err) { onEvent(`error:${err && err.name ? err.name : 'speak'}`); finish(); }
    });
  }

  function cancel() {
    speakId++;
    try { if (synth) synth.cancel(); } catch { /* brak */ }
  }

  // ---------- rozpoznawanie mowy: jeden obiekt na całe działanie ----------
  let rec = null;
  let listening = false;
  let want = false;
  let handler = null;
  let once = null; // { onEvent } dla listenOnce
  let gotResult = false;
  let fatal = null;
  let restartTimer = null;

  function ensureRec() {
    if (rec || !supported.stt) return rec;
    rec = new Recognition();
    rec.lang = 'pl-PL';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => { listening = true; if (once) once.onEvent('start'); };
    rec.onresult = (e) => {
      gotResult = true;
      const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
      const h = handler;
      want = false;
      if (h) h(t);
    };
    rec.onerror = (e) => {
      const code = (e && e.error) || 'unknown';
      if (once) once.onEvent(`error:${code}`);
      if (FATAL_ERRORS.includes(code)) fatal = code;
    };
    rec.onend = () => {
      listening = false;
      if (once) { const o = once; once = null; o.onEvent('end'); return; }
      if (fatal) { const f = fatal; fatal = null; want = false; onUnavailable(f); return; }
      // Cisza albo koniec bez wyniku: słuchaj dalej, dopóki ktoś tego chce (jak OWI SSI).
      if (want && !gotResult) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if (want && !listening) start(); }, RESTART_MS);
      }
    };
    return rec;
  }

  function start() {
    if (!ensureRec() || listening) return;
    gotResult = false;
    fatal = null;
    try { rec.start(); listening = true; } catch { /* już słucha */ }
  }

  function listen(onTranscript) {
    if (!supported.stt) return;
    handler = onTranscript;
    once = null;
    want = true;
    start();
  }

  function stopListening() {
    want = false;
    clearTimeout(restartTimer);
    if (rec && listening) { try { rec.stop(); } catch { /* brak */ } }
    listening = false;
  }

  function listenOnce(onTranscript, onEvent = () => {}) {
    if (!supported.stt) { onEvent('error:unsupported'); return; }
    stopListening();
    handler = onTranscript;
    once = { onEvent };
    start();
  }

  function diagnostics() {
    let all = [];
    try { all = synth ? synth.getVoices() || [] : []; } catch { all = []; }
    const pl = polishVoices(synth);
    return { tts: supported.tts, stt: supported.stt, voices: all.length, polishVoice: pl[0] ? pl[0].name : null };
  }

  // Zgodność z dotychczasowym interfejsem: tryb w aucie i pierwsze dotknięcie grają tylko ciszę.
  function playSilence() { if (audio) audio.playSilence(); return Promise.resolve(); }
  function unlock() { /* celowo nic: bez zmiany sesji dźwięku, jak w OWI SSI */ }

  return { supported, speak, speakPlain, cancel, listen, listenOnce, stopListening, playSilence, unlock, diagnostics, voices: () => polishVoices(synth) };
}
