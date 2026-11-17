// Nawigacja między ekranami (sekcje .screen) i wspólne okno potwierdzenia.
const backStack = [];
const SESSION_SCREENS = ['screenQuiz', 'screenFlash', 'screenExam'];
const TAB_FOR = { screenHome: 'screenHome', screenLearnSetup: 'screenLearnSetup', screenExamSetup: 'screenExamSetup', screenResults: 'screenExamSetup', screenStats: 'screenStats', screenSettings: 'screenSettings' };
const leaveHandlers = new Map();

export function onLeave(screenId, fn) { leaveHandlers.set(screenId, fn); }

export function showScreen(id, { push = true } = {}) {
  const current = document.querySelector('.screen.active');
  if (current && current.id === id) return;
  if (current) {
    if (push) backStack.push(current.id);
    const leave = leaveHandlers.get(current.id);
    if (leave) leave();
  }
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
  document.getElementById('btnBack').hidden = id === 'screenHome';
  document.body.dataset.screen = id;
  document.body.classList.toggle('in-session', SESSION_SCREENS.includes(id));
  const tab = TAB_FOR[id];
  for (const b of document.querySelectorAll('#tabbar [data-tab]')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('screenchange', { detail: { id } }));
}

export function goHome() {
  backStack.length = 0;
  showScreen('screenHome', { push: false });
}

export function goBack() {
  showScreen(backStack.pop() || 'screenHome', { push: false });
}

export function confirmDialog(text, yesLabel = 'Tak') {
  const modal = document.getElementById('confirmDialog');
  document.getElementById('confirmText').textContent = text;
  const yes = document.getElementById('btnConfirmYes');
  const no = document.getElementById('btnConfirmNo');
  yes.textContent = yesLabel;
  modal.hidden = false;
  return new Promise((resolve) => {
    const done = (v) => { modal.hidden = true; yes.onclick = null; no.onclick = null; resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
  });
}
