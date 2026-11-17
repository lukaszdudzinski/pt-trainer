// Ustawienia (spec 4.8).
import { clampExamMinutes } from '../state.js';

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#eef2f7' : '#18212c';
}

export function initSettings(ctx) {
  const el = (id) => document.getElementById(id);
  const s = () => ctx.state.settings;

  function render() {
    el('setRate').value = s().rate;
    el('setVolume').value = s().volume;
    el('setAutoRead').checked = s().autoRead;
    el('setExplainAloud').checked = s().explainAloud;
    el('setStt').checked = s().stt;
    el('setCarMode').checked = s().carMode;
    el('setExamMinutes').value = s().examMinutes;
    el('setTheme').checked = s().theme === 'light';
  }

  const bindCheck = (id, key) => el(id).addEventListener('change', () => ctx.state.saveSettings({ [key]: el(id).checked }));
  bindCheck('setAutoRead', 'autoRead');
  bindCheck('setExplainAloud', 'explainAloud');
  bindCheck('setStt', 'stt');
  bindCheck('setCarMode', 'carMode');
  el('setRate').addEventListener('change', () => ctx.state.saveSettings({ rate: Number(el('setRate').value) }));
  el('setVolume').addEventListener('change', () => ctx.state.saveSettings({ volume: Number(el('setVolume').value) }));
  el('setVoice').addEventListener('change', () => ctx.state.saveSettings({ voiceURI: el('setVoice').value || null }));
  el('setExamMinutes').addEventListener('change', () => {
    const v = clampExamMinutes(el('setExamMinutes').value);
    el('setExamMinutes').value = v;
    ctx.state.saveSettings({ examMinutes: v });
  });
  el('setTheme').addEventListener('change', () => {
    const theme = el('setTheme').checked ? 'light' : 'dark';
    ctx.state.saveSettings({ theme });
    applyTheme(theme);
  });
  document.addEventListener('screenchange', (e) => { if (e.detail.id === 'screenSettings') render(); });
  applyTheme(s().theme);
  render();
  return { render };
}
