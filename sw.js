// Service worker Uki's PT Trainer. Domena jest wspólna dla aplikacji UKIS: tylko własny cache (AGENTS.md 1–2).
const CACHE_NAME = 'ukis.pt-trainer.v2026.11.17.01';
const CACHE_PREFIX = 'ukis.pt-trainer.';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './changelog.json',
  './icons/favicon-64.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/questions.js',
  './data/subjects.js',
  './materials/index.json',
  './materials/links.json',
  './materials/m01.bin',
  './materials/m02.bin',
  './materials/m03.bin',
  './materials/m04.bin',
  './materials/m05.bin',
  './materials/m06.bin',
  './materials/m07.bin',
  './materials/m08.bin',
  './materials/m09.bin',
  './materials/m10.bin',
  './materials/m11.bin',
  './materials/m12.bin',
  './src/app.js',
  './src/storage.js',
  './src/changelog.js',
  './src/updater.js',
  './src/icons.js',
  './src/bank.js',
  './src/exam.js',
  './src/progress.js',
  './src/session.js',
  './src/voice-parse.js',
  './src/speech-text.js',
  './src/nav.js',
  './src/state.js',
  './src/ui/home.js',
  './src/ui/answers.js',
  './src/ui/quiz.js',
  './src/ui/settings.js',
  './src/ui/flashcards.js',
  './src/ui/exam.js',
  './src/ui/stats.js',
  './src/speech.js',
  './src/voice-controller.js',
  './src/ui/voice.js',
  './src/errors.js',
  './src/ui/voice-help.js',
  './src/pro.js',
  './src/ui/knowledge.js',
  './src/audiobook.js',
  './src/ui/audiobook-player.js',
  './src/figures.js',
  './src/ui/figures-ui.js',
];

// Bez skipWaiting(): nowa wersja czeka, aż użytkownik kliknie „Zaktualizuj” (AGENTS.md 3).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) return caches.delete(key);
        return null;
      })))
      .then(() => self.clients.claim())
  );
});

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// Pliki aplikacji z cache (działanie offline), czcionka Outfit zapisywana przy pierwszym pobraniu, reszta z sieci.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (FONT_HOSTS.includes(new URL(e.request.url).hostname)) {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) => cache.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
        return res;
      })))
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(e.request, { ignoreSearch: true }))
      .then((hit) => hit || fetch(e.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') self.skipWaiting();
});
