// Google 뉴스 링크 → 실제 기사 URL 해석 → 기사 요약(og:description) 추출.
// Google 뉴스 rss/articles 링크는 실제 주소가 암호화돼 있어, 인터스티셜 페이지의
// 서명값(id/sg/ts)으로 batchexecute API를 호출해 실제 URL을 얻는다.
// 모든 단계는 best-effort: 실패하면 빈 요약('')을 반환해 제목만 표시되게 한다.
import { fetchT } from './fetchT.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const NAMED = { nbsp: ' ', middot: '·', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#039': "'" };
function decodeEntities(s = '') {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => (name.toLowerCase() in NAMED ? NAMED[name.toLowerCase()] : ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// 언론사 공통 머리말/잡음 제거(요약 앞에 붙는 안내문·섹션명 등).
function stripBoilerplate(s) {
  return s
    .replace(/^한눈에 보는 오늘[^:]*:\s*[^:]*:\s*/i, '')      // 네이트
    .replace(/^잠깐!.*?권장(?:드립니다|합니다)!?\s*/i, '')      // 구형 브라우저 안내
    .replace(/^[^]]*Internet Explorer[^]]*?\)\s*/i, '')
    .trim();
}

// Google 뉴스 링크 → 실제 기사 URL (실패 시 null)
async function resolveUrl(gnUrl) {
  const res = await fetchT(gnUrl, { headers: { 'User-Agent': UA } }, 12000);
  if (!res.ok) return null;
  const html = await res.text();
  const id = html.match(/data-n-a-id="([^"]+)"/)?.[1];
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!id || !sg || !ts) return null;

  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`;
  const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
  const r = await fetchT('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
    body,
  }, 12000);
  if (!r.ok) return null;
  const txt = await r.text();
  const line = txt.split('\n').find((l) => l.includes('garturlres'));
  if (!line) return null;
  try {
    const payload = JSON.parse(JSON.parse(line)[0][2]);
    return payload[1] || null;
  } catch { return null; }
}

// 응답을 실제 인코딩에 맞게 문자열로 변환.
// 네이트 등 EUC-KR 사이트를 UTF-8로 읽으면 글자가 깨지므로 charset을 감지해 디코딩.
function decodeBody(buf, contentType = '') {
  let charset = (contentType.match(/charset=["']?\s*([\w-]+)/i) || [])[1];
  if (!charset) {
    // 본문 앞부분에서 <meta charset> 탐색(ASCII라 latin1로 안전하게 읽음)
    const head = buf.toString('latin1', 0, 4096);
    charset = (head.match(/charset=["']?\s*([\w-]+)/i) || [])[1];
  }
  charset = (charset || 'utf-8').toLowerCase().trim();
  if (charset === 'ms949' || charset === 'cp949' || charset === 'euckr') charset = 'euc-kr';
  try { return new TextDecoder(charset).decode(buf); }
  catch { return buf.toString('utf-8'); }
}

const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, ' '));

function metaContent(html, re) {
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : '';
}

// 문장 끝(마침표·물음표·느낌표, 닫는 따옴표/괄호 포함) 위치들 중 마지막.
function lastSentenceEnd(text) {
  let last = -1;
  const re = /[.!?。][)"'”’」』]?/g;
  let m;
  while ((m = re.exec(text))) last = m.index + m[0].length;
  return last;
}

// 요약 정리: 원본이 잘라둔 말줄임 제거 + 길면 '문장 단위'로 완결되게 자름(중간에 끊지 않음).
function tidy(text, maxLen) {
  let s = decodeEntities(text);
  // 소스가 붙여둔 말줄임/미완 꼬리 제거
  s = s.replace(/\s*(\.\.\.|[…‥]+)\s*$/g, '').trim();
  if (!s) return '';
  if (s.length <= maxLen) {
    // 한도 이내: 이미 문장부호로 끝나면 그대로, 아니면 마지막 완결 문장까지만
    if (/[.!?。)"'”’」』]$/.test(s)) return s;
    const cut = lastSentenceEnd(s);
    return cut > 0 ? s.slice(0, cut).trim() : s;
  }
  // 한도 초과: 한도 이내에서 마지막 완결 문장까지
  const clip = s.slice(0, maxLen);
  const cut = lastSentenceEnd(clip);
  if (cut > 60) return clip.slice(0, cut).trim();
  // 문장 경계를 못 찾으면 단어 경계로 자르고 말줄임
  return clip.replace(/\s+\S*$/, '').trim() + '…';
}

// 문장(마침표 등으로 끝나는 서술문)처럼 보이는가 — 제목/캡션과 구별.
const looksSentence = (s) => /[.!?。]/.test(s) || /다["'”’)\]]?$/.test(s.trim());
// 비교용 정규화: 소문자 + 공백/기호 제거([기자명] 머리말 무시).
const normKey = (s) => s.replace(/^\s*\[[^\]]*\]\s*/, '').toLowerCase().replace(/[\s\W]+/g, '');

// 기사 본문 <p> 문단 배열(잡음 문단 제외).
function bodyParagraphs(html) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]).trim())
    .filter((t) => t.length >= 20 && /[가-힣]/.test(t)
      && !/^[■▶◆●▲◇☞▷◈□※]/.test(t) // 소제목/목록 마커 문단 제외
      && !/무단|재배포|저작권|ⓒ|©|Copyright|구독|다운로드|Internet Explorer|브라우저|기사제보/i.test(t));
}

// og 리드로 시작하는 본문 지점부터 문단을 이어붙여 더 풍성한 리드를 만든다.
// (앞쪽 캡션·안내 문단을 건너뛰고, og가 잘려 있어도 본문에서 끝까지 이어받음)
function enrichFromBody(base, html, limit = 1400) {
  if (!base || !looksSentence(base)) return base; // 제목류는 보강하지 않음(잡음 방지)
  const paras = bodyParagraphs(html);
  if (!paras.length) return base;
  const anchor = normKey(base).slice(0, 12);
  if (!anchor) return base;
  const start = paras.findIndex((p) => normKey(p).includes(anchor));
  if (start < 0) return base; // 본문에서 리드를 못 찾으면 og 유지(잡음 방지)
  let out = '';
  for (let i = start; i < paras.length && out.length < limit; i++) out += (out ? ' ' : '') + paras[i];
  return out.length > base.length ? out : base;
}

// 실제 기사 URL → 요약문(풍성하게, 문장 완결). 실패 시 ''
async function fetchSummary(realUrl, maxLen = 340) {
  const res = await fetchT(realUrl, { headers: { 'User-Agent': UA } }, 12000);
  if (!res.ok) return '';
  const buf = Buffer.from(await res.arrayBuffer());
  const html = decodeBody(buf, res.headers.get('content-type') || '');

  const og =
    metaContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
    metaContent(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i);
  const desc = metaContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  // 언론사 제공 요약(og:description) 우선 → 본문 리드로 풍성하게 보강(앵커 검증).
  let base = stripBoilerplate(og.length >= desc.length ? og : desc);
  if (!base) base = stripBoilerplate(bodyParagraphs(html).slice(0, 3).join(' '));
  else base = stripBoilerplate(enrichFromBody(base, html));

  return tidy(base, maxLen);
}

async function summarizeOne(gnUrl) {
  try {
    const real = await resolveUrl(gnUrl);
    if (!real) return { real: null, summary: '' };
    const summary = await fetchSummary(real);
    return { real, summary };
  } catch {
    return { real: null, summary: '' };
  }
}

// 동시성 제한 병렬 실행. items[].link(구글링크)로 summary·realLink를 채운다.
// deadline(ms epoch)을 넘기면 남은 항목은 요약 없이 두고 즉시 종료(발송 지연 방지).
export async function attachSummaries(items, { concurrency = 5, deadline = 0 } = {}) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      if (deadline && Date.now() > deadline) return; // 시간예산 초과 → 남은 건 제목만
      const idx = i++;
      const { real, summary } = await summarizeOne(items[idx].link);
      items[idx].summary = summary;
      if (real) items[idx].realLink = real; // 원문 직링크(있으면 메일에서 사용)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return items;
}
