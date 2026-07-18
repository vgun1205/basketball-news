// Google 뉴스 RSS로 농구 관련 기사 수집.
//  - 키워드별로 검색 → 파싱 → 최근 N시간 필터 → 중복 제거
//  - 외부 라이브러리 없이 RSS(XML)를 정규식으로 파싱(구조가 단순해 충분).
import { fetchT } from './fetchT.js';
import { attachSummaries } from './summarize.js';

const RSS_BASE = 'https://news.google.com/rss/search';

// XML 엔티티 디코드(제목/언론사에 &amp; #39; 등이 섞여 옴)
function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
};

// 제목 "기사제목 - 언론사" 에서 언론사 분리
function splitTitle(rawTitle, source) {
  if (source) return { title: rawTitle, source };
  const idx = rawTitle.lastIndexOf(' - ');
  if (idx > 0) return { title: rawTitle.slice(0, idx), source: rawTitle.slice(idx + 3) };
  return { title: rawTitle, source: '' };
}

function parseRss(xml, keyword) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const rawTitle = pick(block, 'title');
    const link = pick(block, 'link');
    const pubDate = pick(block, 'pubDate');
    const source = pick(block, 'source');
    if (!rawTitle || !link) continue;
    const { title, source: src } = splitTitle(rawTitle, source);
    const ts = pubDate ? Date.parse(pubDate) : NaN;
    items.push({ title, link, source: src, pubDate, ts: Number.isNaN(ts) ? 0 : ts, keyword });
  }
  return items;
}

// 중복 판정용 제목 정규화(공백/기호 제거)
const normTitle = (t) => t.toLowerCase().replace(/[\s\W]+/g, '');
// 기사 고유키(발송 이력 저장·비교용). 제목 기준.
export const keyOf = (item) => normTitle(item.title || '');

// seenKeys: 과거에 이미 발송한 기사 키 목록 → 이번엔 제외(MI 방식 증분 발송)
// hoursByKeyword: 키워드별 조회기간 오버라이드(예: 주간 키워드는 168시간)
// RSS 1회 수집(타임아웃 8s, 실패 시 1회 재시도). {items, ok} 반환.
async function fetchRss(kw) {
  const url = `${RSS_BASE}?q=${encodeURIComponent(kw)}&hl=ko&gl=KR&ceid=KR:ko`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchT(url, {}, 8000);
      if (res.ok) return { items: parseRss(await res.text(), kw), ok: true };
    } catch { /* 재시도 */ }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  return { items: [], ok: false };
}

// strictKeywords: 기간 내 기사가 없어도 '최신 기사 대체(폴백)'를 하지 않는 키워드
//                 → 오래된 기사가 끌려오지 않음(없으면 그냥 표시 안 함).
export async function collectNews({ keywords, hours = 24, maxPerKeyword = 6, summary = true, seenKeys = [], hoursByKeyword = {}, strictKeywords = [], summaryBudgetMs = 90000 } = {}) {
  const now = Date.now();
  const seen = new Set(seenKeys); // 이미 보낸 기사 + 이번 실행 내 중복을 함께 걸러냄
  const strict = new Set(strictKeywords);
  const groups = []; // [{ keyword, items: [] }]
  let fetchFailed = 0; // 네트워크 문제 판정용(수집 시도 대비 실패 수)

  for (const kw of keywords) {
    const cutoff = now - (hoursByKeyword[kw] ?? hours) * 3600 * 1000;
    const { items: all, ok } = await fetchRss(kw);
    if (!ok) { fetchFailed++; console.error(`  [${kw}] 수집 실패: fetch failed`); }
    all.sort((a, b) => b.ts - a.ts);

    // 기간 내 기사만. 없을 때 최신으로 대체하는 폴백은 strict 키워드엔 적용하지 않음.
    let recent = all.filter((it) => it.ts >= cutoff);
    if (recent.length === 0 && !strict.has(kw)) recent = all.slice(0, maxPerKeyword);

    const items = [];
    for (const it of recent) {
      const key = normTitle(it.title);
      if (!key || seen.has(key)) continue; // 다른 키워드에서 이미 나온 기사 제외
      seen.add(key);
      items.push(it);
      if (items.length >= maxPerKeyword) break;
    }
    groups.push({ keyword: kw, items });
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // 기사별 요약 추출(원문 og:description). 시간예산 초과분은 제목만(발송이 늦지 않게).
  if (summary && total > 0) {
    const allItems = groups.flatMap((g) => g.items);
    try {
      await attachSummaries(allItems, { concurrency: 6, deadline: Date.now() + summaryBudgetMs });
    } catch (e) {
      console.error('  요약 추출 경고:', e.message);
    }
  }

  return { groups, total, generatedAt: now, fetchFailed, attempted: keywords.length };
}
