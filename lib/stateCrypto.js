// 공개 저장소에 카카오 리프레시 토큰을 평문으로 둘 수 없어, 대칭키(AES-256-GCM)로
// 암호화해 data/kakao.enc 로 보관한다. 키는 GitHub Actions Secret(KAKAO_STATE_KEY).
// 카카오는 만료 임박 시 새 리프레시 토큰을 주므로, 갱신분을 여기 저장해 60일 만료를 넘긴다.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'data', 'kakao.enc');

const keyOf = (secret) => createHash('sha256').update(String(secret)).digest();

export function encryptToken(token, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const ct = Buffer.concat([cipher.update(String(token), 'utf-8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptToken(blob, secret) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyOf(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
}

// 저장된(암호화) 리프레시 토큰이 있으면 복호화해 반환, 없으면 null.
export function loadStoredRefresh(secret) {
  try {
    if (!secret || !existsSync(FILE)) return null;
    return decryptToken(readFileSync(FILE, 'utf-8').trim(), secret);
  } catch { return null; }
}

export function saveStoredRefresh(token, secret) {
  if (!secret) return false;
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, encryptToken(token, secret), 'utf-8');
  return true;
}
