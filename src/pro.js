// Strefa Wiedzy PRO: szyfrowanie materiałów (Web Crypto, wbudowane i darmowe). Wspólne dla aplikacji i skryptu budującego.
// Kod PRO → PBKDF2-SHA-256 (210 000 iteracji, sól 16 B) → klucz, którym zaszyfrowany jest klucz treści (AES-GCM 256).
const ITERATIONS = 210000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const subtle = () => globalThis.crypto.subtle;
const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[\s-]+/g, '');
}

export function generateCode(rng = () => randomBytes(1)[0] / 256) {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]).join('');
  return `PT-${part()}-${part()}`;
}

export async function newContentKey() {
  return randomBytes(32);
}

async function keyFromCode(code, salt) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function wrapContentKey(code, contentKey) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await keyFromCode(code, salt);
  const wrapped = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, kek, contentKey));
  return { salt: toB64(salt), iv: toB64(iv), wrapped: toB64(wrapped) };
}

// Klucz treści albo null, gdy kod nie pasuje do żadnego wpisu.
export async function unwrapContentKey(code, keys) {
  for (const k of keys || []) {
    try {
      const kek = await keyFromCode(code, fromB64(k.salt));
      return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(k.iv) }, kek, fromB64(k.wrapped)));
    } catch { /* inny kod */ }
  }
  return null;
}

async function aesKey(contentKey) {
  return subtle().importKey('raw', contentKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function encryptJson(contentKey, obj) {
  return encryptBytes(contentKey, new TextEncoder().encode(JSON.stringify(obj)));
}

// Plik = IV (12 B) + szyfrogram AES-GCM. Nagrania audiobooka szyfrowane bez base64.
export async function encryptBytes(contentKey, data) {
  const iv = randomBytes(12);
  const enc = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await aesKey(contentKey), data));
  const out = new Uint8Array(iv.length + enc.length);
  out.set(iv, 0);
  out.set(enc, iv.length);
  return out;
}

export async function decryptBytes(contentKey, bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await aesKey(contentKey), b.slice(12)));
}

export async function decryptJson(contentKey, bytes) {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(contentKey, bytes)));
}
