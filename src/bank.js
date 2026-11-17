// Wybór pytań i przygotowanie pytania do wyświetlenia (mieszanie odpowiedzi).
export function questionsFor(questions, subjectId, sectionKey = 'all') {
  return questions.filter((q) => q.subject === subjectId && (sectionKey === 'all' || !sectionKey || q.section === sectionKey));
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Presented: { id, question, options, correct, explanation, image, section, source }
export function present(q, rng = Math.random) {
  const order = q.fixedOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i), rng);
  return {
    id: q.id,
    question: q.question,
    options: order.map((i) => q.options[i]),
    correct: order.indexOf(q.answer),
    explanation: q.explanation,
    image: q.image,
    section: q.section,
    source: q,
  };
}
