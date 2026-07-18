// 이미 발송한 기사 이력 저장(증분 발송용). data/seen.json에 { 키: 발송시각(ms) }.
// 다음 발송 때 이 키들을 제외해, 지난 발송 이후 새로 뜬 기사만 보낸다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'data', 'seen.json');
const MAX_AGE_DAYS = 30; // 이보다 오래된 이력은 정리(파일 무한증가 방지)

export function loadSeen() {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, 'utf-8')) || {};
  } catch { return {}; }
}

export const seenKeys = (store) => Object.keys(store);

export function markSeen(store, keys, ts = Date.now()) {
  for (const k of keys) if (k) store[k] = ts;
  return store;
}

export function saveSeen(store) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400 * 1000;
  for (const k of Object.keys(store)) if (store[k] < cutoff) delete store[k];
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store), 'utf-8');
  return Object.keys(store).length;
}
