// 주간 키워드 주기 관리. data/weekly.json에 { 키워드: 마지막 포함 시각(ms) }.
// 마지막 포함 후 intervalDays(기본 7일)가 지나야 다시 포함한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'data', 'weekly.json');

export function loadWeekly() {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, 'utf-8')) || {};
  } catch { return {}; }
}

// 이번 실행에서 포함해야 할 주간 키워드(마지막 포함 후 intervalDays 경과 or 최초).
export function dueWeekly(store, weeklyKeywords, intervalDays = 7, now = Date.now()) {
  const threshold = (intervalDays - 0.5) * 86400 * 1000; // 시각 흔들림 대비 반나절 여유
  return weeklyKeywords.filter((kw) => {
    const last = store[kw];
    return !last || (now - last) >= threshold;
  });
}

export function markWeekly(store, keywords, now = Date.now()) {
  for (const kw of keywords) store[kw] = now;
  return store;
}

export function saveWeekly(store) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store), 'utf-8');
  return store;
}
