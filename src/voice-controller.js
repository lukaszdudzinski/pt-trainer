// Sterowanie lektorem i nasłuchem (spec 5, 5.1). Nasłuch startuje dopiero po zakończeniu czytania,
// a wypowiedzi z poprzedniego pytania albo z czasu czytania są ignorowane.
import { parseVoice } from './voice-parse.js';
import { questionToSpeech, feedbackToSpeech, toSpeech } from './speech-text.js';

const L = 'ABCDE';
const AUTO_NEXT_MS = 2000;
const RELISTEN_MS = 300;
const COMMAND_LABEL = { repeat: 'Powtórz', next: 'Dalej', flip: 'Odwróć', know: 'Znam', dontKnow: 'Nie znam', quit: 'Zakończ', explain: 'Uzasadnij' };

export function createVoiceController({ speech, getSettings, onAnswer, onCommand, getContext, onStatus = () => {} }) {
  let token = 0;
  let speaking = false;
  let autoNext = null;

  const clearAuto = () => { if (autoNext) { clearTimeout(autoNext); autoNext = null; } };

  function startListening(my) {
    const s = getSettings();
    if (my !== token || !s.stt || !speech.supported.stt) return;
    const mode = getContext().mode;
    onStatus(mode === 'feedback' ? 'Słucham: „dalej”, „uzasadnij”, „powtórz”, „zakończ”' : 'Słucham…');
    speech.listen((t) => handle(t, my));
  }

  function handle(transcript, my) {
    if (my !== token || speaking) return;
    const r = parseVoice(transcript, getContext());
    if (r.type === 'answer') {
      onStatus(`Wykryto: odpowiedź ${L[r.index]}`);
      speech.stopListening();
      onAnswer(r.index);
      return;
    }
    if (r.type === 'command') {
      clearAuto();
      onStatus(`Wykryto: ${COMMAND_LABEL[r.name]}`);
      speech.stopListening();
      onCommand(r.name);
      return;
    }
    onStatus(`Nie zrozumiałem: „${transcript}”. Spróbuj ponownie.`);
    setTimeout(() => startListening(my), RELISTEN_MS);
  }

  async function say(text, my) {
    speaking = true;
    try { await speech.speak(text); } catch { /* błąd lektora nie zatrzymuje nauki */ }
    speaking = false;
    return my === token;
  }

  function begin() {
    const my = ++token;
    clearAuto();
    speech.stopListening();
    return my;
  }

  async function readText(text, { force = false, listen = true } = {}) {
    const my = begin();
    const s = getSettings();
    if (s.autoRead || s.carMode || force) {
      if (!(await say(toSpeech(text), my))) return;
    }
    if (listen) startListening(my);
  }

  async function readQuestion(p, { force = false } = {}) {
    const my = begin();
    const s = getSettings();
    if (s.autoRead || s.carMode || force) {
      if (!(await say(questionToSpeech(p), my))) return;
    }
    startListening(my);
  }

  async function readFeedback(p, chosen, correct, { force = false } = {}) {
    const my = begin();
    const s = getSettings();
    if (s.autoRead || s.carMode || force) {
      if (!(await say(feedbackToSpeech(p, chosen, s.explainAloud || s.carMode), my))) return;
    }
    if (s.carMode) {
      autoNext = setTimeout(() => { autoNext = null; if (my === token) onCommand('next'); }, AUTO_NEXT_MS);
    }
    startListening(my);
    void correct;
  }

  // Nasłuch teraz (np. po włączeniu „Mikrofon”, w geście użytkownika).
  function listenNow() {
    startListening(begin());
  }

  function stop() {
    token++;
    clearAuto();
    speech.cancel();
    speech.stopListening();
    onStatus('');
  }

  return { readQuestion, readFeedback, readText, listenNow, stop };
}
