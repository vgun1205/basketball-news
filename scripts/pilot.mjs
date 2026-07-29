// 파일럿: '현재 웹페이지와 동일한 오늘치 다이제스트'를 이메일+카톡으로 1회 발송.
// 이력/아카이브/last-sent 등 상태는 전혀 바꾸지 않음(정규 발송에 영향 없음).
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { recentNewsFromArchive } from '../lib/page.js';
import { sendNewsEmail } from '../lib/mailer.js';
import { sendKakaoMemo, buildKakaoText } from '../lib/kakao.js';
import { loadStoredRefresh } from '../lib/stateCrypto.js';

const split = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const yongsanKeywords = split(process.env.NEWS_YONGSAN_KEYWORDS);
const mergeKeywords = split(process.env.NEWS_MERGE_KEYWORDS);
const longKeywords = [...(split(process.env.NEWS_LONG_KEYWORDS).length ? split(process.env.NEWS_LONG_KEYWORDS) : yongsanKeywords), '용산 전문매체'];
const yongsanRender = [...yongsanKeywords, '용산 전문매체'];
const order = split(process.env.NEWS_CHAPTER_ORDER);

const news = recentNewsFromArchive({ shortDays: (Number(process.env.NEWS_HOURS || 24)) / 24, longDays: Number(process.env.NEWS_LONG_DAYS || 7), longKeywords, mergeKeywords, mergeLabel: process.env.NEWS_MERGE_LABEL || '중고 농구' });
console.log('파일럿 기사:', news.total, '건');
for (const g of news.groups) console.log('  #' + g.keyword + ':', g.items.length, '건');

// 이메일
let mailed = false;
for (let i = 1; i <= 4 && !mailed; i++) {
  try { const r = await sendNewsEmail(news, { yongsanKeywords: yongsanRender, order }); console.log('이메일:', r.subject, '→', r.count, '명'); mailed = true; }
  catch (e) { console.error(`이메일 실패(${i}/4):`, e.message); if (i < 4) await new Promise((r) => setTimeout(r, 12000)); }
}

// 카톡
const stored = loadStoredRefresh(process.env.KAKAO_STATE_KEY);
if (stored) process.env.KAKAO_REFRESH_TOKEN = stored;
if (process.env.KAKAO_REFRESH_TOKEN) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const d = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
  const r = await sendKakaoMemo({ text: buildKakaoText(news, d), webUrl: process.env.NEWS_WEB_URL || '' });
  console.log('카톡:', r.ok ? '성공' : '실패');
}
console.log('※ 파일럿 — 이력/상태 미변경');
