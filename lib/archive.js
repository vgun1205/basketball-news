// 발송한 기사를 날짜별로 누적하는 아카이브(docs/archive/news.json).
// GitHub Pages에서 정적 JSON으로 서빙 → 아카이브 페이지가 클라이언트에서 검색.
// 항목: { d:날짜(KST), k:키워드, t:제목, s:언론사, u:원문링크, m:요약, ts:기사시각 }
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'docs', 'archive', 'news.json');

const norm = (t) => String(t || '').toLowerCase().replace(/[\s\W]+/g, '');

export function loadArchive() {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, 'utf-8')) || [];
  } catch { return []; }
}

// news(collectNews 결과)를 dateStr(KST YYYY-MM-DD)로 누적. 제목 기준 중복 제외.
export function appendArchive(news, dateStr) {
  const arc = loadArchive();
  const seen = new Set(arc.map((a) => norm(a.t)));
  let added = 0;
  for (const g of news.groups) {
    for (const it of g.items) {
      const key = norm(it.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      arc.push({ d: dateStr, k: g.keyword, t: it.title, s: it.source || '', u: it.realLink || it.link, m: it.summary || '', ts: it.ts || 0 });
      added++;
    }
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(arc), 'utf-8');
  return { added, total: arc.length };
}
