# 카카오톡 '나에게 보내기' 연동 설정

전체 그림: **클라우드(GitHub Actions)에서 매일 → 뉴스 수집 → HTML 웹 게시 → 본인 카톡으로 요약+링크 발송 → (다른 분들껜) 이메일 발송.**
아래는 그 중 **1단계: 본인 카톡 발송을 로컬에서 먼저 성공**시키는 순서입니다. (이게 되면 클라우드는 이 코드를 그대로 올리기만 하면 됩니다.)

---

## STEP 1. 카카오 개발자 앱 만들기 (본인이 직접)
1. https://developers.kakao.com 로그인 → **내 애플리케이션 → 애플리케이션 추가하기** (이름/사업자명 아무거나, 무료)
2. 만든 앱 클릭 → **앱 키**에서 **REST API 키** 복사 → `.env`의 `KAKAO_REST_KEY=` 에 붙여넣기
3. 좌측 **카카오 로그인** → **활성화 설정 ON**
4. 같은 화면 아래 **Redirect URI 등록** → `https://localhost` 입력 후 저장
5. 좌측 **카카오 로그인 → 동의항목** → **"카카오톡 메시지 전송"(talk_message)** 을 **필수 동의** 또는 사용 설정

## STEP 2. 인가코드 받기 (브라우저에서 1회)
아래 주소의 `REST키` 부분만 본인 REST API 키로 바꿔 브라우저 주소창에 붙여넣고 이동:
```
https://kauth.kakao.com/oauth/authorize?client_id=REST키&redirect_uri=https://localhost&response_type=code&scope=talk_message
```
- 카카오 로그인 + 동의를 누르면 `https://localhost/?code=XXXXX...` 로 이동합니다.
- 페이지는 열리지 않아도 됩니다. **주소창의 `code=` 뒤 값**만 복사하세요.

## STEP 3. 리프레시 토큰 발급 (한 번만)
프로젝트 폴더에서:
```
npm run kakao:token -- <복사한_code값>
```
출력된 `KAKAO_REFRESH_TOKEN=...` 값을 `.env`에 붙여넣기.

## STEP 4. 카톡 발송 테스트
```
npm run kakao:test
```
→ 본인 카카오톡에 "🏀 오늘의 농구 뉴스 …" 메시지 + **자세히 보기** 버튼이 오면 성공.

---

## 이후 (2단계 · 클라우드)
- HTML을 GitHub Pages에 매일 게시 → 그 주소를 `NEWS_WEB_URL`에 넣으면 카톡 버튼이 그 페이지로 연결됩니다.
- GitHub Actions에 `.env` 값들을 **Secrets**로 등록하면 PC가 꺼져 있어도 매일 정시 발송.
- 자세한 건 STEP 4 성공 후 이어서 진행합니다.

> 참고: 카톡 '나에게 보내기'는 **본인에게만** 갑니다. 지훈/조/현대 님께는 카카오 정책상 자동 발송이 안 되므로 **이메일을 계속 사용**합니다.
