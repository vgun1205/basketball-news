// 카카오톡 '나에게 보내기'(메모 API)로 뉴스 요약 + 웹링크 버튼 발송.
//  - refreshAccessToken(): 리프레시 토큰으로 액세스 토큰 갱신(액세스는 ~6시간 만료).
//  - sendKakaoMemo({text, webUrl}): 텍스트 템플릿 + '자세히 보기' 버튼(HTML 페이지 링크).
// 필요한 .env: KAKAO_REST_KEY, KAKAO_REFRESH_TOKEN
import { fetchT } from './fetchT.js';

export async function refreshAccessToken() {
  const key = process.env.KAKAO_REST_KEY;
  const refresh = process.env.KAKAO_REFRESH_TOKEN;
  if (!key || !refresh) throw new Error('KAKAO_REST_KEY / KAKAO_REFRESH_TOKEN 미설정');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: key,
    refresh_token: refresh,
  });
  // 앱의 '클라이언트 시크릿'(카카오 로그인)이 활성화된 경우 필수
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  const res = await fetchT('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  }, 10000);
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('토큰 갱신 실패: ' + JSON.stringify(data));
  // 카카오는 리프레시 토큰도 이따금 새로 줌(있으면 호출측에서 저장 권장)
  return { accessToken: data.access_token, newRefreshToken: data.refresh_token || null };
}

// text 템플릿: 본문(최대 200자) + web_url 버튼. HTML 페이지로 연결.
export async function sendKakaoMemo({ text, webUrl, buttonTitle = '자세히 보기' }) {
  const { accessToken, newRefreshToken } = await refreshAccessToken();
  const template = {
    object_type: 'text',
    text: text.slice(0, 200),
    link: webUrl ? { web_url: webUrl, mobile_web_url: webUrl } : {},
    button_title: buttonTitle,
  };
  const res = await fetchT('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  }, 10000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result_code !== 0) throw new Error('카톡 발송 실패: ' + JSON.stringify(data));
  return { ok: true, newRefreshToken };
}

// 뉴스 → 카톡 본문 문자열(200자 이내). 웹페이지에서 전체를 보도록 유도.
export function buildKakaoText(news, dateStr) {
  const titles = news.groups.flatMap((g) => g.items).slice(0, 4).map((it) => `· ${it.title}`);
  let body = `🏀 오늘의 농구 뉴스 (${dateStr}) ${news.total}건\n` + titles.join('\n');
  if (body.length > 180) body = body.slice(0, 179) + '…';
  return body + '\n\n아래 버튼에서 전체 보기';
}
