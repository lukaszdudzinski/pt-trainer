// Połączenie lektora i rozpoznawania mowy z ekranami (spec 5, 5.1).
import { createSpeech, polishVoices } from '../speech.js';
import { createVoiceController } from '../voice-controller.js';
import { quizHooks } from './quiz.js';
import { flashHooks } from './flashcards.js';
import { examHooks } from './exam.js';
import { escapeHtml } from './answers.js';
import { goHome } from '../nav.js';

export function initVoice(ctx, { quiz, flash, exam }) {
  const el = (id) => document.getElementById(id);
  const settings = () => ctx.state.settings;
  const UNAVAILABLE = {
    network: 'Rozpoznawanie mowy wymaga internetu. Odpowiadaj przyciskami.',
    'not-allowed': 'Brak zgody na mikrofon. Odpowiadaj przyciskami albo zezwól na mikrofon w ustawieniach telefonu.',
    'service-not-allowed': 'Rozpoznawanie mowy jest niedostępne. Odpowiadaj przyciskami.',
    'audio-capture': 'Nie wykryto mikrofonu. Odpowiadaj przyciskami.',
    'language-not-supported': 'Rozpoznawanie polskiej mowy jest niedostępne. Odpowiadaj przyciskami.',
  };
  const QUIET_ERRORS = ['interrupted', 'canceled'];
  const speech = createSpeech({
    getSettings: settings,
    onUnavailable: (reason) => { if (ctx.errors) ctx.errors.log('mikrofon', reason); status(UNAVAILABLE[reason] || UNAVAILABLE['service-not-allowed']); },
    onSpeechEvent: (e) => {
      diagLog(`lektor: ${SPEECH_EVENT[e] || e}`);
      const code = e.startsWith('error:') ? e.slice(6) : null;
      if (code && !QUIET_ERRORS.includes(code)) {
        if (ctx.errors) ctx.errors.log('lektor', code);
        status(`Lektor nie mógł czytać (${code}). Stuknij „Lektor” albo „Powtórz”.`);
      }
    },
  });
  let screen = 'screenHome';
  let wakeLock = null;

  const status = (t) => { el('voiceStatus').textContent = t; el('voiceStatus').hidden = !t; };
  const SPEECH_EVENT = { start: 'początek czytania', end: 'koniec czytania' };
  let diagOn = false;
  function diagLog(line) {
    if (!diagOn) return;
    el('voiceDiag').textContent += `\n${new Date().toLocaleTimeString('pl-PL')} ${line}`;
  }

  function context() {
    if (screen === 'screenFlash') return { options: [], mode: flash.side() === 'back' ? 'flash-back' : 'flash-front' };
    if (screen === 'screenExam') { const p = exam.current(); return { options: p ? p.options : [], mode: 'quiz' }; }
    const p = quiz.current();
    return { options: p ? p.options : [], mode: quiz.isAnswered() ? 'feedback' : 'quiz' };
  }

  function pulse(container, i) {
    const b = el(container).querySelector(`.answer-btn[data-index="${i}"]`);
    if (b) { b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 600); }
  }

  const vc = createVoiceController({
    speech,
    getSettings: settings,
    getContext: context,
    onStatus: status,
    onAnswer(i) {
      if (screen === 'screenExam') { pulse('examAnswers', i); exam.selectAnswer(i); }
      else if (screen === 'screenQuiz') { pulse('answers', i); quiz.selectAnswer(i); }
    },
    onCommand(name) {
      if (name === 'quit' && (screen === 'screenQuiz' || screen === 'screenFlash')) { vc.stop(); goHome(); return; }
      if (screen === 'screenQuiz') {
        if (name === 'next') quiz.next();
        if (name === 'explain') {
          const p = quiz.current();
          if (p) vc.readText(`Uzasadnienie. ${p.explanation}`, { force: true });
        }
        if (name === 'repeat') {
          const p = quiz.current();
          if (!p) return;
          if (quiz.isAnswered()) vc.readFeedback(p, quiz.lastChoice(), quiz.lastChoice() === p.correct, { force: true });
          else vc.readQuestion(p, { force: true });
        }
      } else if (screen === 'screenFlash') {
        if (name === 'flip') flash.flip();
        if (name === 'know') flash.know();
        if (name === 'dontKnow') flash.dontKnow();
        if (name === 'next') flash.next();
        if (name === 'repeat') readCard(flash.current(), flash.side(), true);
      } else if (screen === 'screenExam' && name === 'repeat') {
        const p = exam.current();
        if (p) vc.readQuestion(p, { force: true });
      }
    },
  });

  function readCard(q, side, force = false) {
    if (!q) return;
    if (side === 'front') vc.readText(`Pytanie. ${q.question}`, { force });
    else vc.readText(`Odpowiedź: ${q.options[q.answer]}. ${settings().explainAloud ? q.explanation : ''}`, { force });
  }

  quizHooks.onPresented = (p, o = {}) => vc.readQuestion(p, { force: !!o.repeat });
  quizHooks.onAnswered = (p, chosen, correct) => vc.readFeedback(p, chosen, correct);
  quizHooks.onFinished = () => { vc.stop(); vc.readText('Koniec sesji.', { listen: false }); };
  flashHooks.onCard = (q, side, o = {}) => readCard(q, side, !!o.repeat);
  examHooks.onQuestion = (p, o = {}) => { if (!exam.isRealMode()) vc.readQuestion(p, { force: !!o.repeat }); };
  examHooks.onFinished = () => vc.stop();

  async function updateWakeLock() {
    const want = settings().carMode && ['screenQuiz', 'screenFlash'].includes(screen);
    try {
      if (want && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { wakeLock = null; }
  }

  document.addEventListener('screenchange', (e) => {
    screen = e.detail.id;
    if (!['screenQuiz', 'screenFlash', 'screenExam'].includes(screen)) vc.stop();
    updateWakeLock();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateWakeLock(); });

  // Przyciski „Lektor” i „Mikrofon” na ekranach nauki, fiszek i egzaminu.
  function renderChips() {
    for (const b of document.querySelectorAll('[data-chip]')) {
      const on = b.dataset.chip === 'tts' ? settings().autoRead : settings().stt && speech.supported.stt;
      b.setAttribute('aria-pressed', String(!!on));
      if (b.dataset.chip === 'stt') b.disabled = !speech.supported.stt;
    }
  }
  function readCurrent() {
    if (screen === 'screenQuiz') {
      const p = quiz.current();
      if (!p) return;
      if (quiz.isAnswered()) vc.readFeedback(p, quiz.lastChoice(), quiz.lastChoice() === p.correct, { force: true });
      else vc.readQuestion(p, { force: true });
    } else if (screen === 'screenFlash') readCard(flash.current(), flash.side(), true);
    else if (screen === 'screenExam' && !exam.isRealMode() && exam.current()) vc.readQuestion(exam.current(), { force: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    if (b.dataset.chip === 'tts') {
      const on = !settings().autoRead;
      ctx.state.saveSettings({ autoRead: on });
      renderChips();
      if (on) readCurrent(); else vc.stop();
    } else {
      const on = !settings().stt;
      ctx.state.saveSettings({ stt: on });
      renderChips();
      if (on) vc.listenNow(); else { speech.stopListening(); status(''); }
    }
  });
  document.addEventListener('screenchange', renderChips);
  renderChips();

  // Opcje: sprawdzenie lektora i mikrofonu, wynik na ekranie.
  el('btnTestTts').addEventListener('click', async () => {
    diagOn = true;
    const d = speech.diagnostics();
    el('voiceDiag').textContent = `Lektor w przeglądarce: ${d.tts ? 'tak' : 'nie'}; głosów: ${d.voices}; polski głos: ${d.polishVoice || 'brak'}.\nZaraz będą dwie próby czytania.`;
    diagLog('próba 1 (prosta): „Próba pierwsza”');
    await speech.speakPlain('Próba pierwsza.', (e) => diagLog(`próba 1: ${SPEECH_EVENT[e] || e}`));
    diagLog('próba 2 (jak w nauce): „Próba druga”');
    await speech.speak('Próba druga.');
    diagLog('Widzisz „początek czytania” i „koniec czytania”, a nic nie słychać? Lektor działa, tylko iPhone go wycisza: wyłącz tryb cichy (przekreślony dzwonek przy godzinie) i podgłośnij przyciskami z boku.');
  });
  el('btnTestStt').addEventListener('click', () => {
    diagOn = true;
    const d = speech.diagnostics();
    el('voiceDiag').textContent = `Rozpoznawanie mowy w przeglądarce: ${d.stt ? 'tak' : 'nie'}. Powiedz coś, na przykład „be”.`;
    speech.listenOnce(
      (t) => diagLog(`Usłyszałem: „${t}”`),
      (e) => { diagLog(`mikrofon: ${e === 'start' ? 'słucham' : e === 'end' ? 'koniec' : e}`); if (e.startsWith('error:') && ctx.errors) ctx.errors.log('mikrofon (próba)', e.slice(6)); },
    );
  });

  // Opcje: dziennik błędów.
  function renderErrors() {
    if (!ctx.errors) return;
    const list = ctx.errors.list().slice(0, 15);
    el('errorList').innerHTML = list.map((e) => `<li>${new Date(e.at).toLocaleString('pl-PL')} · ${e.version} · ${escapeHtml(e.prefix)}: ${escapeHtml(e.message)}</li>`).join('');
    el('errorEmpty').hidden = list.length > 0;
    el('btnCopyErrors').hidden = list.length === 0;
  }
  el('btnCopyErrors').addEventListener('click', async () => {
    const text = ctx.errors.report();
    try { await navigator.clipboard.writeText(text); el('btnCopyErrors').querySelector('.label').textContent = 'Skopiowano'; } catch { window.prompt('Skopiuj dziennik:', text); }
  });
  el('btnClearErrors').addEventListener('click', () => { ctx.errors.clear(); renderErrors(); });
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenSettings') { renderErrors(); el('btnCopyErrors').querySelector('.label').textContent = 'Kopiuj dziennik'; } });
  renderErrors();

  // Ustawienia: głosy i dostępność rozpoznawania mowy.
  function renderVoiceSettings() {
    const sel = el('setVoice');
    const voices = speech.supported.tts ? polishVoices(globalThis.speechSynthesis) : [];
    sel.innerHTML = '<option value="">Domyślny polski</option>' + voices.map((v) => `<option value="${v.voiceURI}">${v.name}</option>`).join('');
    sel.value = settings().voiceURI || '';
    el('voiceInfo').textContent = !speech.supported.tts
      ? 'Ta przeglądarka nie ma lektora.'
      : (voices.length ? '' : 'Brak polskiego głosu w tej przeglądarce. Na iPhonie: Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.');
    el('setStt').disabled = !speech.supported.stt;
    if (!speech.supported.stt) {
      el('setStt').checked = false;
      el('sttInfo').textContent = 'Ta przeglądarka nie rozpoznaje mowy. Odpowiadaj przyciskami.';
    }
  }
  renderVoiceSettings();
  // Pierwsze dotknięcie odblokowuje dźwięk na iPhonie (tryb cichy, Safari w trybie aplikacji).
  for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, () => speech.unlock(), { capture: true, passive: true });
  if (speech.supported.tts && globalThis.speechSynthesis.addEventListener) globalThis.speechSynthesis.addEventListener('voiceschanged', renderVoiceSettings);
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenSettings') renderVoiceSettings(); });

  return { vc, speech };
}
