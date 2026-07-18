// 부팅/절전 복귀 직후 네트워크가 늦게 붙는 경우를 대비해, 실제 연결이 될 때까지 대기한다.
//  - 뉴스 수집용 HTTPS 연결 확인 + 메일 발송 서버(SMTP) DNS 해석 확인
//  (ping/HTTP만으로는 SMTP DNS 준비를 보장 못 함 — 아침 발송 크래시의 실제 원인.)
import { fetchT } from './fetchT.js';
import { lookup } from 'node:dns/promises';

async function dnsOk(host) {
  try { await lookup(host); return true; } catch { return false; }
}

export async function waitForNetwork({ tries = 18, intervalMs = 5000, url = 'https://news.google.com/rss/search?q=%EB%86%8D%EA%B5%AC&hl=ko&gl=KR&ceid=KR:ko', smtpHost = 'smtp.gmail.com' } = {}) {
  for (let i = 0; i < tries; i++) {
    let httpOk = false;
    try {
      const res = await fetchT(url, {}, 6000);
      httpOk = res.ok;
    } catch { /* 아직 준비 안 됨 */ }
    // SMTP 호스트 DNS까지 되어야 발송 가능 → 둘 다 확인
    if (httpOk && (!smtpHost || (await dnsOk(smtpHost)))) return true;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
