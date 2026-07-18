// 발송 없이 '현재 뜬 기사들'을 이미 보낸 것으로 표시(seed).
// 지금 실행해 두면, 다음 자동 발송부터는 이 시점 이후 새로 뜬 기사만 나간다.
// (요약은 불필요하므로 건너뛰어 빠르게 수집)
import { collectNews, keyOf } from '../lib/news.js';
import { loadSeen, markSeen, saveSeen } from '../lib/seen.js';

const keywords = (process.env.NEWS_KEYWORDS || '농구,KBL,WKBL,NBA')
  .split(',').map((s) => s.trim()).filter(Boolean);

// 넓게 훑어 최근 기사를 최대한 이력에 담아둔다(72시간, 키워드당 50건).
const news = await collectNews({ keywords, hours: 72, maxPerKeyword: 50, summary: false });
const keys = news.groups.flatMap((g) => g.items).map(keyOf);

const store = loadSeen();
markSeen(store, keys);
const kept = saveSeen(store);
console.log(`현재 기사 ${keys.length}건을 발송완료로 표시 · 이력 총 ${kept}건`);
console.log('→ 다음 발송부터 이 기사들은 제외되고, 이후 새 기사만 나갑니다.');
