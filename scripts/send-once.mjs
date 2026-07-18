// 뉴스 수집 → 이메일 작성 → 발송 1회. OS 스케줄러가 매일 호출.
// 지난 발송 이후 새로 뜬 기사만 보냄(증분 발송 — data/seen.json으로 이력 관리).
import { collectNews, keyOf } from '../lib/news.js';
import { sendNewsEmail } from '../lib/mailer.js';
import { loadSeen, seenKeys, markSeen, saveSeen } from '../lib/seen.js';
import { loadWeekly, dueWeekly, markWeekly, saveWeekly } from '../lib/weekly.js';
import { waitForNetwork } from '../lib/net.js';

// 처리 못 한 오류로 프로세스가 지저분하게 크래시하지 않도록: 로그 남기고 실패코드로 종료
// (실패코드 → 작업 스케줄러가 5분 뒤 재시도). 아침 DNS 지연 등으로 나던 크래시 방지.
process.on('unhandledRejection', (e) => { console.error('미처리 거부:', e?.message || e); process.exit(1); });
process.on('uncaughtException', (e) => { console.error('미처리 예외:', e?.message || e); process.exit(1); });

// 최종 안전장치: 어떤 단계가 정체돼도 300초 후 강제 종료(스케줄러 무한대기 방지).
// 네트워크 대기(≤90s)+요약 예산(90s)+발송 재시도 여유를 감안해 넉넉히 잡음.
const watchdog = setTimeout(() => { console.error('전체 타임아웃(300s) — 강제 종료'); process.exit(1); }, 300000);

const allKeywords = (process.env.NEWS_KEYWORDS || '농구,KBL,WKBL,NBA')
  .split(',').map((s) => s.trim()).filter(Boolean);
const weeklyKeywords = (process.env.NEWS_WEEKLY_KEYWORDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const weeklyDays = Number(process.env.NEWS_WEEKLY_DAYS || 7);
const yongsanKeywords = (process.env.NEWS_YONGSAN_KEYWORDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const yongsanDays = Number(process.env.NEWS_YONGSAN_DAYS || 7); // 용산 기사 조회기간(일)
const hours = Number(process.env.NEWS_HOURS || 24);
const maxPerKeyword = Number(process.env.NEWS_MAX_PER_KEYWORD || 6);

// 주간 키워드는 이번에 '주기가 도래한 것'만 포함(지난 주기치 한 번에), 나머지는 매일.
// 용산 키워드는 매일 수집하되 최근 7일 이내 기사만(오래된 기사 폴백 금지), 메일 하단 챕터로 묶임.
const wstore = loadWeekly();
const dueW = dueWeekly(wstore, weeklyKeywords, weeklyDays);
const dailyKeywords = allKeywords.filter((k) => !weeklyKeywords.includes(k));
const keywords = [...new Set([...dailyKeywords, ...dueW, ...yongsanKeywords])];
const hoursByKeyword = {
  ...Object.fromEntries(dueW.map((k) => [k, weeklyDays * 24])),      // 주간분은 지난 7일치
  ...Object.fromEntries(yongsanKeywords.map((k) => [k, yongsanDays * 24])), // 용산은 7일 창
};
const strictKeywords = yongsanKeywords; // 용산은 기간 내 없으면 오래된 기사로 안 채움

// 아침 실행 시 네트워크가 아직 안 붙었을 수 있어, 연결될 때까지 최대 90초 대기.
const online = await waitForNetwork({ tries: 18, intervalMs: 5000, smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com' });
if (!online) {
  console.error('네트워크 미연결(90s 대기 초과) — 종료(스케줄러 재시도 유도)');
  clearTimeout(watchdog);
  process.exit(1); // 실패코드 → 작업 스케줄러가 5분 뒤 재시도
}

const store = loadSeen();
console.log('키워드:', keywords.join(', ') || '(없음)',
  '· 매일:', dailyKeywords.length, '· 주간대상:', dueW.length ? dueW.join(',') : '없음(다음 주기 대기)',
  '· 발송이력:', seenKeys(store).length, '건');

const news = keywords.length
  ? await collectNews({ keywords, hours, maxPerKeyword, seenKeys: seenKeys(store), hoursByKeyword, strictKeywords })
  : { groups: [], total: 0, fetchFailed: 0, attempted: 0 };
console.log('신규 기사:', news.total, '건');

if (news.total === 0) {
  // 모든 키워드 수집이 실패했으면 네트워크 문제 → 실패코드로 재시도 유도.
  if (news.attempted > 0 && news.fetchFailed >= news.attempted) {
    console.error('전 키워드 수집 실패(네트워크 추정) — 종료(재시도 유도)');
    clearTimeout(watchdog);
    process.exit(1);
  }
  console.log('새 기사 없음 — 발송 생략');
  // 주기는 갱신하지 않음: 일시적 수집실패로 주간분을 놓치지 않도록 다음날 재시도.
  clearTimeout(watchdog);
  process.exit(0);
}

// 발송 재시도: 아침엔 smtp.gmail.com DNS/연결이 늦게 붙어 실패할 수 있어 최대 4회(15s 간격).
async function sendWithRetry(attempts = 4, delayMs = 15000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await sendNewsEmail(news, { yongsanKeywords });
    } catch (e) {
      lastErr = e;
      console.error(`발송 실패(${i}/${attempts}): ${e?.message || e}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

let r;
try {
  r = await sendWithRetry();
} catch (e) {
  console.error('발송 최종 실패 — 종료(재시도 유도):', e?.message || e);
  clearTimeout(watchdog);
  process.exit(1); // 이력 미기록 → 다음 실행/재시도 때 다시 시도
}
console.log('발송:', r.subject, '→', r.count, '명');

// 발송 성공분을 이력에 기록(다음 발송부터 제외)
markSeen(store, news.groups.flatMap((g) => g.items).map(keyOf));
const kept = saveSeen(store);
console.log('발송이력 저장:', kept, '건');
// 이번에 포함한 주간 키워드는 주기 갱신(다음 포함은 weeklyDays 후)
if (dueW.length) { markWeekly(wstore, dueW); saveWeekly(wstore); }
clearTimeout(watchdog);
