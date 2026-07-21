// 오늘자 아카이브 기사 전체로 이메일만 재발송(카톡/이력 무관).
// 로컬 DNS가 smtp.gmail.com 조회에 실패할 때를 대비해 공용 DNS로 우회.
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { sendNewsEmail } from '../lib/mailer.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arc = JSON.parse(readFileSync(join(root, 'docs', 'archive', 'news.json'), 'utf-8'));
const kst = new Date(Date.now() + 9 * 36e5);
const today = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
const items = arc.filter((a) => a.d === today);
const yk = (process.env.NEWS_YONGSAN_KEYWORDS || '').split(',').map((s) => s.trim()).filter(Boolean);
// 학교부 키워드는 '중고 농구' 챕터로 병합 표시
const mergeK = (process.env.NEWS_MERGE_KEYWORDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const mergeL = process.env.NEWS_MERGE_LABEL || '중고 농구';
const byK = {};
for (const a of items) {
  const k = mergeK.includes(a.k) ? mergeL : a.k;
  (byK[k] = byK[k] || []).push({ title: a.t, source: a.s, link: a.u, realLink: a.u, summary: a.m, ts: a.ts });
}
for (const k of Object.keys(byK)) byK[k].sort((x, y) => y.ts - x.ts);
const news = { groups: Object.entries(byK).map(([keyword, its]) => ({ keyword, items: its })), total: items.length, generatedAt: Date.now() };
console.log('오늘 기사:', news.total, '건');
const r = await sendNewsEmail(news, { yongsanKeywords: yk });
console.log('이메일 발송:', r.subject, '→', r.count, '명');
