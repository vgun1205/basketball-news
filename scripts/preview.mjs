// 발송 없이 수집 결과를 콘솔에 미리보기 + HTML을 data/preview.html로 저장.
// 실제 발송과 동일하게 '이미 보낸 기사'는 제외하고 보여줌(이력은 건드리지 않음).
import { collectNews, mergeGroups } from '../lib/news.js';
import { buildNewsEmail } from '../lib/mailer.js';
import { loadSeen, seenKeys } from '../lib/seen.js';
import { loadWeekly, dueWeekly } from '../lib/weekly.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allKeywords = (process.env.NEWS_KEYWORDS || '농구,KBL,WKBL,NBA')
  .split(',').map((s) => s.trim()).filter(Boolean);
const weeklyKeywords = (process.env.NEWS_WEEKLY_KEYWORDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const weeklyDays = Number(process.env.NEWS_WEEKLY_DAYS || 7);
const yongsanKeywords = (process.env.NEWS_YONGSAN_KEYWORDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const yongsanDays = Number(process.env.NEWS_YONGSAN_DAYS || 7);
const hours = Number(process.env.NEWS_HOURS || 24);
const maxPerKeyword = Number(process.env.NEWS_MAX_PER_KEYWORD || 6);

const dueW = dueWeekly(loadWeekly(), weeklyKeywords, weeklyDays);
const keywords = [...new Set([...allKeywords.filter((k) => !weeklyKeywords.includes(k)), ...dueW, ...yongsanKeywords])];
const hoursByKeyword = {
  ...Object.fromEntries(dueW.map((k) => [k, weeklyDays * 24])),
  ...Object.fromEntries(yongsanKeywords.map((k) => [k, yongsanDays * 24])),
};
const strictKeywords = yongsanKeywords;

const store = loadSeen();
console.log('발송이력', seenKeys(store).length, `건 제외 · 용산챕터(${yongsanDays}일 이내):`, yongsanKeywords.join(',') || '없음');
const news = await collectNews({ keywords, hours, maxPerKeyword, seenKeys: seenKeys(store), hoursByKeyword, strictKeywords: keywords });
news.groups = mergeGroups(news.groups,
  (process.env.NEWS_MERGE_KEYWORDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  process.env.NEWS_MERGE_LABEL || '중고 농구');
for (const g of news.groups) {
  const tag = yongsanKeywords.includes(g.keyword) ? '[용산]' : '';
  console.log(`\n[#${g.keyword}]${tag} ${g.items.length}건`);
  for (const it of g.items) console.log(`  - ${it.title} (${it.source})`);
}
console.log(`\n총 ${news.total}건`);

const { subject, html } = buildNewsEmail(news, { yongsanKeywords });
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data', 'preview.html'), html, 'utf-8');
console.log('\n제목:', subject);
console.log('HTML 미리보기 저장: data/preview.html');
