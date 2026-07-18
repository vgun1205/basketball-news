// GitHub Actions(클라우드)용 하루 1회 파이프라인:
//   수집(증분) → docs/index.html 웹 게시 → 이메일 발송 → 본인 카톡 발송(요약+링크)
// 상태(data/seen.json·weekly.json·kakao.enc)는 워크플로가 저장소에 커밋해 다음 실행에 이어짐.
// 환경변수는 GitHub Secrets/env로 주입(.env 불필요). PC가 꺼져 있어도 무관.
import { collectNews, keyOf } from '../lib/news.js';
import { sendNewsEmail, buildNewsEmail } from '../lib/mailer.js';
import { loadSeen, seenKeys, markSeen, saveSeen } from '../lib/seen.js';
import { loadWeekly, dueWeekly, markWeekly, saveWeekly } from '../lib/weekly.js';
import { sendKakaoMemo, buildKakaoText } from '../lib/kakao.js';
import { loadStoredRefresh, saveStoredRefresh } from '../lib/stateCrypto.js';
import { appendArchive } from '../lib/archive.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const watchdog = setTimeout(() => { console.error('전체 타임아웃(300s)'); process.exit(1); }, 300000);
process.on('unhandledRejection', (e) => { console.error('미처리 거부:', e?.message || e); process.exit(1); });

const split = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const allKeywords = split(process.env.NEWS_KEYWORDS || '농구,KBL,WKBL,NBA');
const weeklyKeywords = split(process.env.NEWS_WEEKLY_KEYWORDS);
const yongsanKeywords = split(process.env.NEWS_YONGSAN_KEYWORDS);
const weeklyDays = Number(process.env.NEWS_WEEKLY_DAYS || 7);
const yongsanDays = Number(process.env.NEWS_YONGSAN_DAYS || 7);
const hours = Number(process.env.NEWS_HOURS || 24);
const maxPerKeyword = Number(process.env.NEWS_MAX_PER_KEYWORD || 6);

const wstore = loadWeekly();
const dueW = dueWeekly(wstore, weeklyKeywords, weeklyDays);
const dailyKeywords = allKeywords.filter((k) => !weeklyKeywords.includes(k));
const keywords = [...new Set([...dailyKeywords, ...dueW, ...yongsanKeywords])];
const hoursByKeyword = {
  ...Object.fromEntries(dueW.map((k) => [k, weeklyDays * 24])),
  ...Object.fromEntries(yongsanKeywords.map((k) => [k, yongsanDays * 24])),
};

const store = loadSeen();
console.log('키워드:', keywords.join(', '), '· 발송이력:', seenKeys(store).length, '건');
const news = await collectNews({ keywords, hours, maxPerKeyword, seenKeys: seenKeys(store), hoursByKeyword, strictKeywords: yongsanKeywords });
console.log('신규 기사:', news.total, '건');

if (news.total === 0) {
  if (news.attempted > 0 && news.fetchFailed >= news.attempted) { console.error('전 키워드 수집 실패'); process.exit(1); }
  console.log('새 기사 없음 — 발송 생략');
  clearTimeout(watchdog);
  process.exit(0);
}

// 1) 웹 게시용 HTML (GitHub Pages: docs/index.html)
//    이메일 HTML에 모바일 viewport·제목·가독성 스타일을 주입(폰에서 글씨 작아지는 문제 방지).
const { subject, html } = buildNewsEmail(news, { yongsanKeywords });
const HEAD = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>오늘의 농구 뉴스</title>
<style>
  @media (max-width: 600px) {
    body { padding: 6px !important; }
    a { font-size: 17px !important; }              /* 기사 제목 */
    div[style*="font-size:13px"] { font-size: 15px !important; } /* 요약 */
    div[style*="font-size:12px"] { font-size: 13px !important; } /* 출처·시간 */
  }
</style></head>`;
// 헤더 부제 옆에 아카이브 링크 노출
const ARCHIVE_LINK = `<div style="margin-top:6px"><a href="archive/" style="color:#FFD9A0;font-size:12px;text-decoration:none">🔍 지난 뉴스 검색 (아카이브) →</a></div>`;
const pageHtml = html
  .replace('<html>', `<html lang="ko">${HEAD}<!-- ${subject} -->`)
  .replace('· 매일 자동 발송</div>', `· 매일 자동 발송</div>${ARCHIVE_LINK}`);
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'index.html'), pageHtml, 'utf-8');
console.log('웹 게시 준비: docs/index.html');

// 2) 이메일 발송(재시도 3회)
let mailed = false;
for (let i = 1; i <= 3 && !mailed; i++) {
  try {
    const r = await sendNewsEmail(news, { yongsanKeywords });
    console.log('이메일 발송:', r.subject, '→', r.count, '명');
    mailed = true;
  } catch (e) {
    console.error(`이메일 실패(${i}/3):`, e?.message || e);
    if (i < 3) await new Promise((r2) => setTimeout(r2, 10000));
  }
}

// 3) 카톡 발송(본인) — 저장된(암호화) 리프레시 토큰이 있으면 그걸 우선 사용
const stateKey = process.env.KAKAO_STATE_KEY;
const stored = loadStoredRefresh(stateKey);
if (stored) process.env.KAKAO_REFRESH_TOKEN = stored;
let kakaoOk = false;
if (process.env.KAKAO_REFRESH_TOKEN && process.env.KAKAO_REST_KEY) {
  try {
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
    const r = await sendKakaoMemo({ text: buildKakaoText(news, dateStr), webUrl: process.env.NEWS_WEB_URL || '' });
    kakaoOk = r.ok;
    console.log('카톡 발송: 성공');
    if (r.newRefreshToken && saveStoredRefresh(r.newRefreshToken, stateKey)) console.log('카카오 리프레시 토큰 갱신 저장(암호화)');
  } catch (e) {
    console.error('카톡 실패(무시하고 계속):', e?.message || e);
  }
} else {
  console.log('카톡 미설정 — 건너뜀');
}

// 4) 발송 이력 저장 + 아카이브 누적(이메일 또는 카톡 중 하나라도 성공 시)
if (mailed || kakaoOk) {
  markSeen(store, news.groups.flatMap((g) => g.items).map(keyOf));
  console.log('발송이력 저장:', saveSeen(store), '건');
  if (dueW.length) { markWeekly(wstore, dueW); saveWeekly(wstore); }
  const kstA = new Date(Date.now() + 9 * 3600 * 1000);
  const dateA = `${kstA.getUTCFullYear()}-${String(kstA.getUTCMonth() + 1).padStart(2, '0')}-${String(kstA.getUTCDate()).padStart(2, '0')}`;
  const arc = appendArchive(news, dateA);
  console.log('아카이브 누적:', arc.added, '건 추가 · 총', arc.total, '건');
} else {
  console.error('이메일·카톡 모두 실패 — 이력 미기록(다음 실행 재시도)');
  process.exit(1);
}
clearTimeout(watchdog);
