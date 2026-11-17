// „Co nowego”: lista zmian po aktualizacji (AGENTS.md 7). Logika bez DOM jest testowana w Node.
const LAST_VERSION_KEY = 'ukis.pt-trainer.last-version';
const UPDATED_FROM_KEY = 'ukis.pt-trainer.updated-from';
export const AUTO_SHOW_DELAY_MS = 800;

export function parseVersion(v) {
  const p = String(v || '').replace(/^v\.?/, '').split('.').map((n) => parseInt(n, 10) || 0);
  return (p[0] || 0) * 1e10 + (p[1] || 0) * 1e8 + (p[2] || 0) * 1e6 + (p[3] || 0);
}

// 'all' to wszystko, 'latest_only' to najnowszy wpis, wersja to wpisy nowsze od niej (albo najnowszy).
export function selectEntries(data, compareVersion) {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (compareVersion === 'all') return data;
  if (compareVersion === 'latest_only' || !compareVersion) return [data[0]];
  const score = parseVersion(compareVersion);
  const newer = data.filter((e) => parseVersion(e.version) > score);
  return newer.length > 0 ? newer : [data[0]];
}

// Wersja, od której pokazać zmiany ('latest_only' przy pierwszym uruchomieniu), albo null.
export function changelogSinceAfterUpdate(storage, current) {
  if (!current) return null;
  let from = null;
  let last = null;
  try {
    from = storage.getItem(UPDATED_FROM_KEY);
    last = storage.getItem(LAST_VERSION_KEY);
    storage.removeItem(UPDATED_FROM_KEY);
    storage.setItem(LAST_VERSION_KEY, current);
  } catch { return null; }
  const since = from || last;
  if (!since) return 'latest_only';
  return since !== current ? since : null;
}

export function rememberUpdatedFrom(storage, current) {
  try { if (current) storage.setItem(UPDATED_FROM_KEY, current); } catch { /* brak pamięci */ }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderEntries(entries) {
  if (!entries.length) return '<p class="muted">Brak danych o zmianach.</p>';
  return entries.map((e) => `<section class="changelog-entry"><h3>Wersja ${escapeHtml(e.version)} <span class="muted">(${escapeHtml(e.date)})</span></h3><ul>${(e.changes || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></section>`).join('');
}

export async function showChangelog(compareVersion) {
  const modal = document.getElementById('changelogModal');
  const body = document.getElementById('changelogBody');
  if (!modal || !body) return;
  body.innerHTML = '<p class="muted">Wczytywanie…</p>';
  modal.hidden = false;
  try {
    const res = await fetch('changelog.json', { cache: 'no-cache' });
    body.innerHTML = renderEntries(selectEntries(await res.json(), compareVersion));
  } catch {
    body.innerHTML = '<p class="muted">Nie udało się wczytać listy zmian.</p>';
  }
}

export function maybeShowAfterUpdate(storage, current) {
  const since = changelogSinceAfterUpdate(storage, current);
  if (since) setTimeout(() => showChangelog(since), AUTO_SHOW_DELAY_MS);
  return since;
}
