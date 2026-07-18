// 카카오 '나에게 보내기' 테스트: 실제 뉴스로 요약+링크 발송 1회(이력 기록 안 함).
//   node --env-file-if-exists=.env scripts/kakao-test.mjs
import { collectNews } from '../lib/news.js';
import { sendKakaoMemo, buildKakaoText } from '../lib/kakao.js';

const kw = (process.env.NEWS_KEYWORDS || '농구,KBL,NBA').split(',').map((s) => s.trim()).filter(Boolean);
const news = await collectNews({ keywords: kw, hours: 24, maxPerKeyword: 6, summary: false });
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
const text = buildKakaoText(news, dateStr);
const webUrl = process.env.NEWS_WEB_URL || 'https://news.google.com/search?q=%EB%86%8D%EA%B5%AC';

console.log('보낼 본문:\n' + text + '\n링크:', webUrl);
const r = await sendKakaoMemo({ text, webUrl });
console.log('카톡 발송:', r.ok ? '성공 ✅ (내 카톡 확인)' : '실패');
if (r.newRefreshToken) console.log('※ 새 리프레시 토큰 발급됨 — .env의 KAKAO_REFRESH_TOKEN 교체 권장:', r.newRefreshToken);
