// 카카오 인가코드(code) → 리프레시 토큰 발급(최초 1회).
// 사용법: node --env-file-if-exists=.env scripts/kakao-token.mjs <인가코드>
//   KAKAO_REST_KEY, KAKAO_REDIRECT_URI 를 .env에 먼저 넣어두세요.
import { fetchT } from '../lib/fetchT.js';

const code = process.argv[2];
const key = process.env.KAKAO_REST_KEY;
const redirect = process.env.KAKAO_REDIRECT_URI || 'https://localhost';
if (!code) { console.error('인가코드를 인자로 주세요: node scripts/kakao-token.mjs <code>'); process.exit(1); }
if (!key) { console.error('.env에 KAKAO_REST_KEY 를 먼저 넣으세요'); process.exit(1); }

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: key,
  redirect_uri: redirect,
  code,
});
// 앱의 '클라이언트 시크릿'(카카오 로그인)이 활성화된 경우 필수
if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
const res = await fetchT('https://kauth.kakao.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
  body,
}, 10000);
const data = await res.json();
if (!res.ok || !data.refresh_token) {
  console.error('발급 실패:', JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log('\n✅ 발급 성공! 아래 값을 .env에 넣으세요:\n');
console.log('KAKAO_REFRESH_TOKEN=' + data.refresh_token);
console.log('\n(access_token은 자동 갱신되므로 저장 불필요. scope:', data.scope || '-', ')');
