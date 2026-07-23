// GitHub Actions(클라우드)용 하루 1회 파이프라인:
//   수집(증분) → docs/index.html 웹 게시 → 이메일 발송 → 본인 카톡 발송(요약+링크)
// 상태(data/seen.json·weekly.json·kakao.enc)는 워크플로가 저장소에 커밋해 다음 실행에 이어짐.
// 환경변수는 GitHub Secrets/env로 주입(.env 불필요). PC가 꺼져 있어도 무관.
import { collectNews, keyOf, mergeGroups } from '../lib/news.js';
import { sendNewsEmail, buildNewsEmail } from '../lib/mailer.js';
import { loadSeen, seenKeys, markSeen, saveSeen } from '../lib/seen.js';
import { loadWeekly, dueWeekly, markWeekly, saveWeekly } from '../lib/weekly.js';
import { sendKakaoMemo, buildKakaoText } from '../lib/kakao.js';
import { loadStoredRefresh, saveStoredRefresh } from '../lib/stateCrypto.js';
import { appendArchive } from '../lib/archive.js';
import { writeDayPage } from '../lib/page.js';
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
const hours = Number(process.env.NEWS_HOURS || 24);       // 일반 뉴스: 1일(24h)
// 장기(7일) 조회 키워드 = 용산 + 중고 등. 없으면 용산 키워드만 장기로.
const longKeywords = split(process.env.NEWS_LONG_KEYWORDS).length ? split(process.env.NEWS_LONG_KEYWORDS) : yongsanKeywords;
const longDays = Number(process.env.NEWS_LONG_DAYS || 7);
const maxPerKeyword = Number(process.env.NEWS_MAX_PER_KEYWORD || 6);

const wstore = loadWeekly();
const dueW = dueWeekly(wstore, weeklyKeywords, weeklyDays);
const dailyKeywords = allKeywords.filter((k) => !weeklyKeywords.includes(k));
const keywords = [...new Set([...dailyKeywords, ...dueW, ...yongsanKeywords])];
const hoursByKeyword = {
  ...Object.fromEntries(dueW.map((k) => [k, weeklyDays * 24])),
  ...Object.fromEntries(longKeywords.map((k) => [k, longDays * 24])), // 용산·중고 = 7일, 나머지는 hours(1일)
};

// 하루 1회 가드: 크론을 여러 번 걸어두므로(지연 대비), 이미 오늘 발송했으면 스킵.
const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
const todayKst = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-${String(kstNow.getUTCDate()).padStart(2, '0')}`;
const LAST_SENT = join(root, 'data', 'last-sent.txt');
const { readFileSync, existsSync } = await import('node:fs');
if (!process.env.FORCE_SEND && existsSync(LAST_SENT) && readFileSync(LAST_SENT, 'utf-8').trim() === todayKst) {
  console.log(`오늘(${todayKst}) 이미 발송됨 — 스킵`);
  clearTimeout(watchdog);
  process.exit(0);
}

const store = loadSeen();
console.log('키워드:', keywords.join(', '), '· 발송이력:', seenKeys(store).length, '건');
// strictKeywords=전체: 기간(일반 24h·용산 7일) 밖의 오래된 기사를 절대 채워넣지 않음
const news = await collectNews({ keywords, hours, maxPerKeyword, seenKeys: seenKeys(store), hoursByKeyword, strictKeywords: keywords });
// 학교부 검색 키워드들은 표시에서 '중고 농구' 한 챕터로 병합
const mergeK = split(process.env.NEWS_MERGE_KEYWORDS);
const mergeL = process.env.NEWS_MERGE_LABEL || '중고 농구';
news.groups = mergeGroups(news.groups, mergeK, mergeL);
console.log('신규 기사:', news.total, '건');

if (news.total === 0) {
  if (news.attempted > 0 && news.fetchFailed >= news.attempted) { console.error('전 키워드 수집 실패'); process.exit(1); }
  console.log('새 기사 없음 — 발송 생략');
  clearTimeout(watchdog);
  process.exit(0);
}

// 1) 이메일 발송(재시도 3회) — 메일은 '이번에 새로 찾은 기사'만(증분)
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
  writeFileSync(LAST_SENT, dateA, 'utf-8'); // 오늘 발송 완료 표시(늦은 크론 중복발송 방지)
  // 웹페이지는 '오늘 하루치 전체'로 재생성(증분 실행이 여러 번이어도 페이지는 항상 하루 전체)
  const pageCount = writeDayPage({ yongsanKeywords, mergeKeywords: mergeK, mergeLabel: mergeL, shortDays: hours / 24, longDays, longKeywords });
  console.log('웹 게시(오늘 하루치):', pageCount, '건');
} else {
  console.error('이메일·카톡 모두 실패 — 이력 미기록(다음 실행 재시도)');
  process.exit(1);
}
clearTimeout(watchdog);
