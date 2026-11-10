const encoder = new TextEncoder();

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return bytesToHex(digest);
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64ToUrlSafe(bytesToBase64(bytes));
}

function base64ToUrlSafe(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 常量时间字符串比较 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 免费版 10ms CPU 限制下的实测预算（1000 次 ≈ 0.47ms） */
export const PBKDF2_ITERATIONS = 10_000;

/** 由 SECRET_KEY 派生 pepper：数据库泄露但密钥未泄露时无法离线破解 */
export async function derivePepper(secretKey: string): Promise<string> {
  return sha256Hex(`${secretKey}|password-v1`);
}

export async function hashPassword(
  password: string,
  pepper: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await pbkdf2(`${password}|${pepper}`, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}
export interface ParsedHash {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

export function parsePasswordHash(stored: string): ParsedHash | null {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return null;
  return {
    iterations: Number(iterations),
    salt: base64ToBytes(salt),
    hash: base64ToBytes(hash),
  };
}

export async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const actual = await pbkdf2(`${password}|${pepper}`, parsed.salt, parsed.iterations);
  return timingSafeEqualBytes(actual, parsed.hash);
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function deriveAesKey(secretKey: string, info: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${secretKey}|${info}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-256-GCM 加密，输出 base64(iv | ciphertext | tag) */
export async function encryptSecret(plain: string, secretKey: string): Promise<string> {
  if (!plain) return '';
  const key = await deriveAesKey(secretKey, 'bark-v1');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plain)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return bytesToBase64(combined);
}

export async function decryptSecret(cipher: string, secretKey: string): Promise<string> {
  if (!cipher) return '';
  const raw = base64ToBytes(cipher);
  if (raw.length <= 12) return '';
  const key = await deriveAesKey(secretKey, 'bark-v1');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12) as BufferSource },
    key,
    raw.slice(12) as BufferSource,
  );
  return new TextDecoder().decode(plaintext);
}
