// Przyciski odpowiedzi wspólne dla nauki i egzaminu.
const L = 'ABCDE';

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export { escapeHtml };

export function renderAnswers(container, p) {
  container.innerHTML = p.options.map((o, i) =>
    `<button type="button" class="answer-btn" data-index="${i}"><span class="letter">${L[i]}</span><span class="opt-text">${escapeHtml(o)}</span></button>`).join('');
}

export function markAnswers(container, p, chosen, { reveal = true } = {}) {
  for (const b of container.querySelectorAll('.answer-btn')) {
    const i = Number(b.dataset.index);
    b.disabled = true;
    if (!reveal) { if (i === chosen) b.classList.add('chosen'); continue; }
    if (i === p.correct) b.classList.add('correct');
    else if (i === chosen) b.classList.add('wrong');
  }
}

export const letter = (i) => L[i];
