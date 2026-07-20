// 수집한 뉴스 → HTML 이메일 작성 및 Gmail SMTP 발송.
//  buildNewsEmail(news) : 순수 함수. {subject, html, text} 반환(발송 없음·테스트 가능)
//  sendNewsEmail(news)  : nodemailer로 SMTP 발송.

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function kstDateStr(ts) {
  const kst = new Date(ts + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

// "3시간 전" 같은 상대 시간
function ago(ts, now) {
  if (!ts) return '';
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.round(hr / 24)}일 전`;
}

function itemRow(it, generatedAt) {
  const meta = [it.source, ago(it.ts, generatedAt)].filter(Boolean).join(' · ');
  const href = it.realLink || it.link;
  const summaryHtml = it.summary
    ? `<div style="font-size:13px;color:#555;margin-top:5px;line-height:1.55">${esc(it.summary)}</div>`
    : '';
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
    <a href="${esc(href)}" style="font-size:15px;font-weight:600;color:#1F3864;text-decoration:none;line-height:1.4">${esc(it.title)}</a>
    ${summaryHtml}
    ${meta ? `<div style="font-size:12px;color:#888;margin-top:4px">${esc(meta)}</div>` : ''}
  </td></tr>`;
}

export function buildNewsEmail(news, opts = {}) {
  const { groups, total, generatedAt } = news;
  const yongsanKeywords = opts.yongsanKeywords || [];
  const isYongsan = (kw) => yongsanKeywords.includes(kw);
  const dateStr = kstDateStr(generatedAt);
  const subject = `[농구 뉴스] ${dateStr} · ${total}건`;

  // 일반 키워드 섹션(#칩) — 용산 관련 키워드는 제외하고 별도 챕터로.
  const sections = groups
    .filter((g) => g.items.length && !isYongsan(g.keyword))
    .map((g) => {
      const rows = g.items.map((it) => itemRow(it, generatedAt)).join('');
      return `<div style="margin:18px 0 4px">
        <div style="display:inline-block;background:#EE6730;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:14px">#${esc(g.keyword)}</div>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>`;
    })
    .join('');

  // 하단 '용산 소식' 챕터 — 용산중·용산고·신석·이정석 기사를 한데 모음(있을 때만).
  const yongsanItems = groups.filter((g) => isYongsan(g.keyword)).flatMap((g) => g.items);
  const yongsanSection = yongsanItems.length
    ? `<div style="margin-top:26px;border-top:2px solid #1F3864;padding-top:14px">
        <div style="font-size:16px;font-weight:800;color:#1F3864">🏫 용산 소식 <span style="font-size:12px;font-weight:600;color:#888">· 용산중·용산고·신석 감독·이정석 코치</span></div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px">
          ${yongsanItems.map((it) => itemRow(it, generatedAt)).join('')}
        </table>
      </div>`
    : '';

  const body = (sections || yongsanSection)
    ? sections + yongsanSection
    : `<div style="color:#888;font-size:14px;padding:20px 0">오늘 새로 올라온 농구 기사를 찾지 못했습니다.</div>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:18px;font-family:'Malgun Gothic','맑은 고딕',Apple SD Gothic Neo,sans-serif;color:#222">
  <div style="max-width:980px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#1F3864;color:#fff;padding:16px 20px">
      <div style="font-size:19px;font-weight:800">🏀 오늘의 농구 뉴스</div>
      <div style="font-size:12px;opacity:.85;margin-top:2px">${dateStr} · 총 ${total}건 · 매일 자동 발송</div>
    </div>
    <div style="padding:8px 20px 18px">
      ${body}
      <div style="font-size:11px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:10px">
        Google 뉴스 검색 기반 자동 수집 · 제목 클릭 시 원문으로 이동합니다.
      </div>
    </div>
  </div></body></html>`;

  const textLines = [`🏀 오늘의 농구 뉴스 (${dateStr}) · 총 ${total}건`, ''];
  const pushItem = (it) => {
    textLines.push(`- ${it.title}${it.source ? ` (${it.source})` : ''}`);
    if (it.summary) textLines.push(`  ${it.summary}`);
    textLines.push(`  ${it.realLink || it.link}`);
  };
  for (const g of groups.filter((x) => x.items.length && !isYongsan(x.keyword))) {
    textLines.push(`[#${g.keyword}]`);
    for (const it of g.items) pushItem(it);
    textLines.push('');
  }
  if (yongsanItems.length) {
    textLines.push('=== 🏫 용산 소식 (용산중·용산고·신석 감독·이정석 코치) ===');
    for (const it of yongsanItems) pushItem(it);
    textLines.push('');
  }
  const text = textLines.join('\n');

  return { subject, html, text };
}

function resolveRecipients() {
  const raw = process.env.NEWS_MAIL_TO || process.env.SMTP_USER || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function sendNewsEmail(news, opts = {}) {
  const nodemailer = (await import('nodemailer')).default;
  const { subject, html, text } = buildNewsEmail(news, opts);
  const recipients = resolveRecipients();
  if (!recipients.length) throw new Error('수신자 미설정 (NEWS_MAIL_TO)');

  // nodemailer는 자체 DNS(resolve/c-ares, UDP 직접조회)를 쓰는데 일부 공유기/망에서 차단돼
  // queryA ETIMEOUT이 남. OS 리졸버(lookup=getaddrinfo)로 IP를 먼저 구해 접속하고,
  // TLS 인증서 검증은 servername으로 원래 호스트명을 유지한다. 실패 시 호스트명 그대로 폴백.
  const smtpHost = process.env.SMTP_HOST;
  let hostForConn = smtpHost, tlsOpts;
  try {
    const { lookup } = await import('node:dns/promises');
    const { address } = await lookup(smtpHost, { family: 4 });
    hostForConn = address;
    tlsOpts = { servername: smtpHost };
  } catch { /* lookup 실패 시 호스트명으로 시도 */ }

  const transport = nodemailer.createTransport({
    host: hostForConn,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    tls: tlsOpts,
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 25000,
  });

  const fromAddr = process.env.NEWS_MAIL_FROM || process.env.SMTP_USER || '';
  const email = fromAddr.includes('<') ? fromAddr.replace(/.*<([^>]+)>.*/, '$1') : fromAddr;
  const from = `농구 뉴스 <${email}>`;
  const info = await transport.sendMail({ from, to: recipients, subject, text, html });
  return { messageId: info.messageId, count: recipients.length, subject };
}
