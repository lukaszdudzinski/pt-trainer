// Przedmioty, działy i zasady egzaminu REPs Polska (spec 3.2, 3.3, 4.6, 4.7).
export const SUBJECT_IDS = ['trener', 'anatomia'];

export const SUBJECTS = {
  trener: {
    id: 'trener',
    name: 'Trener personalny',
    sections: [
      { key: 'etyka', name: 'Etyka i prawo' },
      { key: 'biznes', name: 'Biznes i marketing' },
      { key: 'osobowosc', name: 'Osobowość i kompetencje miękkie' },
      { key: 'klient', name: 'Klient i konsultacja' },
      { key: 'metodyka', name: 'Metodyka i trening' },
      { key: 'styl-zycia', name: 'Zdrowy styl życia i NEAT' },
      { key: 'zywienie', name: 'Żywienie' },
    ],
    exam: { total: 72, passScore: 54, quotas: null },
  },
  anatomia: {
    id: 'anatomia',
    name: 'Anatomia i fizjologia',
    sections: [
      { key: 'chlonny', name: 'Układ chłonny' },
      { key: 'tkanki', name: 'Tkanki' },
      { key: 'powieziowy', name: 'Układ powięziowy' },
      { key: 'kostny', name: 'Układ kostny' },
      { key: 'miesniowy', name: 'Układ mięśniowy' },
      { key: 'moczowy', name: 'Układ moczowy' },
      { key: 'naczyniowy', name: 'Układ naczyniowy' },
      { key: 'nerwowy', name: 'Układ nerwowy' },
      { key: 'oddechowy', name: 'Układ oddechowy' },
      { key: 'stawowy', name: 'Układ stawowy' },
      { key: 'hormonalny', name: 'Układ hormonalny' },
    ],
    exam: {
      total: 72,
      passScore: 54,
      quotas: { chlonny: 2, tkanki: 2, powieziowy: 4, kostny: 19, miesniowy: 29, moczowy: 1, naczyniowy: 3, nerwowy: 4, oddechowy: 4, stawowy: 2, hormonalny: 2 },
    },
  },
};

export const EXAM_MINUTES = { default: 60, min: 30, max: 120, step: 5 };
export const READY = { threshold: 0.8, exams: 3 };

export function sectionName(subjectId, key) {
  const s = SUBJECTS[subjectId]?.sections.find((x) => x.key === key);
  return s ? s.name : key;
}
