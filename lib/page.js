// '오늘의 뉴스' 웹페이지(docs/index.html) 생성 — 아카이브에서 오늘(KST) 기사 전체를 모아
// 하루치 다이제스트로 렌더링한다(증분 실행이 여러 번 돌아도 페이지는 항상 하루 전체).
import { buildNewsEmail } from './mailer.js';
import { loadArchive } from './archive.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const HEAD = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>오늘의 농구 뉴스</title>
<style>
  @media (max-width: 600px) {
    body { padding: 6px !important; }
    a { font-size: 17px !important; }
    div[style*="font-size:13px"] { font-size: 15px !important; }
    div[style*="font-size:12px"] { font-size: 13px !important; }
  }
</style></head>`;
const ARCHIVE_LINK = `<div style="margin-top:6px"><a href="archive/" style="color:#FFD9A0;font-size:12px;text-decoration:none">🔍 지난 뉴스 검색 (아카이브) →</a></div>`;

export const kstToday = () => {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
};

// 아카이브의 dateStr 기사 전체 → news 형태 {groups,total}. 병합 라벨 적용.
export function dayNewsFromArchive(dateStr, { mergeKeywords = [], mergeLabel = '중고 농구' } = {}) {
  const items = loadArchive().filter((a) => a.d === dateStr);
  const byK = {};
  for (const a of items) {
    const k = mergeKeywords.includes(a.k) ? mergeLabel : a.k;
    (byK[k] = byK[k] || []).push({ title: a.t, source: a.s, link: a.u, realLink: a.u, summary: a.m, ts: a.ts });
  }
  for (const k of Object.keys(byK)) byK[k].sort((x, y) => y.ts - x.ts);
  return { groups: Object.entries(byK).map(([keyword, its]) => ({ keyword, items: its })), total: items.length, generatedAt: Date.now() };
}

// 오늘 하루치 전체로 docs/index.html 작성. 렌더한 기사 수 반환.
export function writeDayPage({ yongsanKeywords = [], mergeKeywords = [], mergeLabel = '중고 농구' } = {}) {
  const today = kstToday();
  const news = dayNewsFromArchive(today, { mergeKeywords, mergeLabel });
  if (news.total === 0) return 0; // 오늘 기사가 하나도 없으면 기존 페이지 유지
  const { subject, html } = buildNewsEmail(news, { yongsanKeywords });
  const page = html
    .replace('<html>', `<html lang="ko">${HEAD}<!-- ${subject} -->`)
    .replace('· 매일 자동 발송</div>', `· 매일 자동 발송</div>${ARCHIVE_LINK}`);
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'index.html'), page, 'utf-8');
  return news.total;
}
