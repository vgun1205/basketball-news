// 농구 전문매체 네이티브 RSS 직접 수집(점프볼·바스켓코리아).
// Google 뉴스와 달리 링크가 원문 직행이고 요약(description)도 피드에서 바로 온다.
// 반환 항목은 collectNews의 item과 동일 형태: {title, link, realLink, source, summary, ts, keyword}
import { fetchT } from './fetchT.js';

const FEEDS = [
  { name: '점프볼', url: 'https://jumpball.co.kr/news/rss.php' },
  { name: '바스켓코리아', url: 'https://www.basketkorea.com/news/rss.php' },
];

function decode(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decode(m[1]) : '';
};

async function fetchFeed({ name, url }) {
  const items = [];
  try {
    const res = await fetchT(url, {}, 9000);
    if (!res.ok) return items;
    const xml = await res.text();
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml))) {
      const b = m[1];
      const title = pick(b, 'title');
      const link = pick(b, 'link');
      if (!title || !link) continue;
      const ts = Date.parse(pick(b, 'pubDate') || pick(b, 'dc:date') || pick(b, 'date')) || 0;
      let summary = pick(b, 'description');
      if (summary.length > 320) summary = summary.slice(0, 320).replace(/\s+\S*$/, '') + '…';
      items.push({ title, link, realLink: link, source: name, summary, ts, keyword: '전문매체' });
    }
  } catch (e) {
    console.error(`  [${name}] RSS 실패:`, e.message);
  }
  return items;
}

// 전문매체 기사 수집(최근 hours시간). yongsanTerms에 걸리는 기사는 keyword를 '용산'으로 표시해
// 상위(용산 소식 챕터)에서 우선 배치되도록 하고, 나머지는 '전문매체'로 둔다.
export async function collectSources({ hours = 24, yongsanTerms = ['용산', '신석', '이정석'] } = {}) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  const recent = all.filter((it) => it.ts && it.ts >= cutoff);
  for (const it of recent) {
    if (yongsanTerms.some((t) => it.title.includes(t))) it.keyword = '용산 전문매체';
  }
  return recent;
}
