// Okno „Sterowanie głosem” przed nauką, fiszkami i egzaminem (prośba właściciela 2026-11-15).
// Pokazuje się zawsze, dopóki ktoś nie zaznaczy „Nie pokazuj więcej”; „Przywróć” w Opcjach włącza je ponownie.
export function initVoiceHelp(ctx) {
  const el = (id) => document.getElementById(id);
  let pending = null;

  function close() { el('voiceHelp').hidden = true; }

  // fn uruchamia się w kliknięciu „Zaczynam”, więc lektor na iPhonie startuje w geście użytkownika.
  function withHelp(fn) {
    if (ctx.state.settings.hideVoiceHelp) return fn();
    pending = fn;
    el('voiceHelpHide').checked = false;
    el('voiceHelp').hidden = false;
    return true;
  }

  el('btnVoiceHelpStart').addEventListener('click', () => {
    if (el('voiceHelpHide').checked) ctx.state.saveSettings({ hideVoiceHelp: true });
    close();
    const fn = pending;
    pending = null;
    if (fn) fn();
  });
  el('btnVoiceHelpCancel').addEventListener('click', () => { pending = null; close(); });
  el('btnRestoreTips').addEventListener('click', () => {
    ctx.state.saveSettings({ hideVoiceHelp: false });
    el('btnRestoreTips').textContent = 'Przywrócono';
  });
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenSettings') el('btnRestoreTips').textContent = 'Przywróć'; });

  return { withHelp };
}
