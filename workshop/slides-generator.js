const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE";           // 13.3 × 7.5
p.author = "위험관리 워크샵";
p.title = "Claude 활용 — 추가 시연 슬라이드";

/* ── 팔레트 ─────────────────────────────────────────── */
const INK = "0E1F26";   // 딥 틸-블랙 (어두운 슬라이드 배경)
const TEAL = "0F5F6B";  // 주색
const TEAL_L = "E3EFF0";// 주색 연한 면
const GOLD = "A97C22";  // 강조 (숫자·번호)
const BODY = "2B3A42";  // 본문
const MUTE = "6C7C85";  // 보조
const LINE = "D7DEDE";
const W = 13.3, M = 0.75;               // 캔버스 폭, 좌우 여백
const CW = W - M * 2;                   // 콘텐츠 폭 11.8

const F = "맑은 고딕";

/* ── 공통 조각 ──────────────────────────────────────── */
function titleLight(s, t, sub) {
  s.addText(t, { x: M, y: 0.52, w: CW, h: 0.62, fontFace: F, fontSize: 32, bold: true, color: INK });
  if (sub) s.addText(sub, { x: M, y: 1.16, w: CW, h: 0.36, fontFace: F, fontSize: 14.5, color: MUTE });
}
/* 영상 자리 — 촬영본을 끼워 넣을 프레임 */
function videoSlot(s, label, dur, x, y, w, h) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06, fill: { color: TEAL_L }, line: { color: TEAL, width: 1, dashType: "dash" },
  });
  s.addText(label, { x, y: y + h / 2 - 0.52, w, h: 0.4, align: "center", fontFace: F, fontSize: 19, bold: true, color: TEAL });
  s.addText(dur + "  ·  이 자리에 영상 삽입 (자동 실행 · 반복 재생)", {
    x, y: y + h / 2 - 0.08, w, h: 0.34, align: "center", fontFace: F, fontSize: 12, color: TEAL,
  });
}
/* 한 줄 결론 — 영상 아래 붙는 문장 */
function punch(s, t, x, y, w) {
  s.addText(t, { x, y, w, h: 0.58, fontFace: F, fontSize: 16, bold: true, color: TEAL, margin: 0 });
}

/* ══ 1. 전환 (어두운) ═══════════════════════════════ */
{
  const s = p.addSlide();
  s.background = { color: INK };
  s.addText("그런데,", { x: M, y: 1.72, w: CW, h: 0.88, fontFace: F, fontSize: 40, color: "8FB3B8" });
  s.addText("이런 것도 됩니다", { x: M, y: 2.44, w: CW, h: 1.2, fontFace: F, fontSize: 54, bold: true, color: "FFFFFF" });
  s.addText("앞의 두 시스템은 몇 달짜리였습니다.  지금부터 보실 것은 대부분 하루 안에 만든 것들입니다.", {
    x: M, y: 3.62, w: 10.6, h: 0.5, fontFace: F, fontSize: 16, color: "B9CCD0",
  });
  const items = [["4편", "시연 영상"], ["3분 10초", "총 재생시간"], ["하루 이내", "각각의 제작 기간"]];
  items.forEach(([big, cap], i) => {
    const x = M + i * 3.5;
    s.addText(big, { x, y: 4.75, w: 3.2, h: 0.6, fontFace: F, fontSize: 30, bold: true, color: GOLD, margin: 0 });
    s.addText(cap, { x, y: 5.35, w: 3.2, h: 0.35, fontFace: F, fontSize: 13, color: "8FB3B8", margin: 0 });
  });
  s.addNotes("전환 장표. 앞의 BCM 시뮬레이터·MI 뉴스는 '완성된 시스템'이라 청중이 '저 사람이니까 되는 것'으로 받아들이기 쉽다. 여기서부터는 작고, 오늘 당장, 나도 할 수 있는 크기로 내려온다는 신호를 준다.");
}

/* ══ 2. 오늘 보실 네 가지 ═══════════════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "오늘 보실 네 가지", "전부 위험관리 업무에서 매일 반복되던 것들입니다");
  const rows = [
    ["01", "엑셀을 그대로 붙여넣으면 표가 스스로 정리된다", "머리글을 읽고 지표를 판별 — 옮겨 적기 자체가 사라짐", "35초"],
    ["02", "내 보고서 양식이 그대로 나온다", "글꼴·여백·줄간격·문단 기호까지 규칙으로 고정", "50초"],
    ["03", "쌓인 자료에 말로 묻는다", "검색이 아니라 질문 — 답에 근거 자료가 붙는다", "45초"],
    ["04", "말 한마디로 기능이 붙는다", "요구사항을 말하면 화면이 바뀐다 (실황)", "60초"],
  ];
  rows.forEach(([no, t, d, dur], i) => {
    const y = 1.78 + i * 1.28;
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: CW, h: 1.08, rectRadius: 0.06, fill: { color: "F5F8F8" }, line: { color: LINE, width: 0.75 } });
    s.addShape(p.ShapeType.ellipse, { x: M + 0.28, y: y + 0.24, w: 0.6, h: 0.6, fill: { color: TEAL } });
    s.addText(no, { x: M + 0.28, y: y + 0.33, w: 0.6, h: 0.42, align: "center", fontFace: F, fontSize: 15, bold: true, color: "FFFFFF", margin: 0 });
    s.addText(t, { x: M + 1.08, y: y + 0.2, w: 8.6, h: 0.42, fontFace: F, fontSize: 17, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: M + 1.08, y: y + 0.62, w: 8.6, h: 0.34, fontFace: F, fontSize: 12.5, color: MUTE, margin: 0 });
    s.addText(dur, { x: M + CW - 1.5, y: y + 0.36, w: 1.2, h: 0.4, align: "right", fontFace: F, fontSize: 16, bold: true, color: GOLD, margin: 0 });
  });
  s.addNotes("네 편을 한 장에 미리 보여주고 시작한다. 각 편의 '길이'를 같이 띄우는 이유 — 짧다는 걸 먼저 알려야 집중해서 본다.");
}

/* ══ 3. 엑셀 붙여넣기 ══════════════════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "엑셀을 그대로 붙여넣으면", "평가사 포털 화면 복사 → 붙여넣기 → 끝");
  videoSlot(s, "영상 ①", "35초", M, 1.72, 7.5, 4.2);
  const steps = [
    ["복사", "포털 표를 있는 그대로 Ctrl+C"],
    ["붙여넣기", "머리글이 2~3줄로 쪼개져 있어도 그대로"],
    ["자동 판별", "‘채권 종류 + 만기’를 읽어 지표를 맞춤"],
    ["저장", "전일·전월·전분기·전년 비교 즉시 갱신"],
  ];
  steps.forEach(([t, d], i) => {
    const y = 1.72 + i * 1.06;
    s.addText(String(i + 1), { x: 8.55, y, w: 0.34, h: 0.34, fontFace: F, fontSize: 15, bold: true, color: GOLD, margin: 0 });
    s.addText(t, { x: 8.95, y, w: 3.6, h: 0.34, fontFace: F, fontSize: 15.5, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: 8.95, y: y + 0.34, w: 3.6, h: 0.56, fontFace: F, fontSize: 12, color: MUTE, margin: 0 });
  });
  punch(s, "사람이 하던 눈치를, 규칙으로 적어 준 것뿐입니다.", M, 6.16, CW);
  s.addNotes("말할 것 — 머리글이 두세 줄로 쪼개져 있어도 세로로 이어붙여서 '채권 종류 + 만기'를 찾아내게 해뒀습니다. 사람이 하던 눈치를 규칙으로 적어 준 것뿐입니다. / 실제 시스템이 안 뜨면 workshop/demo/paste-to-table.html 로 대체.");
}

/* ══ 4. 워드 양식 ══════════════════════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "내 보고서 양식이 그대로 나온다", "바탕체 · 여백 상하 2.5cm 좌우 2cm · 줄간격 1.3 · 문단 기호 □ / - / *");
  videoSlot(s, "영상 ②", "50초", M, 1.72, 7.5, 4.2);
  const cmp = [
    ["작성 시간", "1건당 30~60분", "1초"],
    ["서식 오류", "검토 때마다 지적", "발생 불가"],
    ["갱신 방법", "이전 파일 복사·수정", "명령 한 줄"],
  ];
  s.addText("이전", { x: 10.0, y: 1.78, w: 1.2, h: 0.3, fontFace: F, fontSize: 11, color: MUTE, margin: 0 });
  s.addText("이후", { x: 11.4, y: 1.78, w: 1.15, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: TEAL, margin: 0 });
  cmp.forEach(([k, a, b], i) => {
    const y = 2.2 + i * 1.15;
    s.addText(k, { x: 8.55, y, w: 1.5, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
    s.addText(a, { x: 8.55, y: y + 0.36, w: 2.0, h: 0.6, fontFace: F, fontSize: 12, color: MUTE, margin: 0 });
    s.addText(b, { x: 10.7, y: y + 0.3, w: 1.85, h: 0.5, fontFace: F, fontSize: 17, bold: true, color: GOLD, margin: 0 });
  });
  punch(s, "서식은 판단이 아니라 규칙입니다. 규칙은 한 번만 적어 두면 됩니다.", M, 6.16, CW);
  s.addNotes("말할 것 — 서식은 판단이 아니라 규칙입니다. 규칙은 한 번만 적어 두면 됩니다. 내용을 바꿔도 서식 지적이 다시 나올 일이 없습니다. / 사내 문서를 띄우기 곤란하면 workshop/demo/make-docx.mjs 백업본으로 대체.");
}

/* ══ 5. 말로 묻기 ══════════════════════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "쌓인 자료에 말로 묻는다", "매일 자동으로 쌓인 감독·규제 자료가 곧 팀의 지식베이스가 됩니다");
  videoSlot(s, "영상 ③", "45초", M, 1.72, 7.5, 4.2);
  const pts = [
    ["우리 자료 안에서만", "일반 챗봇과 다른 지점 — 바깥에서 지어내지 않습니다"],
    ["답에 출처가 붙는다", "기관·제목·날짜까지. 근거 없는 문장이 보고서에 못 들어갑니다"],
    ["초안이지 결론이 아니다", "최종 책임은 작성자에게 있다는 걸 문서에도 적어 뒀습니다"],
  ];
  pts.forEach(([t, d], i) => {
    const y = 1.9 + i * 1.4;
    s.addShape(p.ShapeType.ellipse, { x: 8.55, y: y + 0.04, w: 0.26, h: 0.26, fill: { color: GOLD } });
    s.addText(t, { x: 8.95, y, w: 3.6, h: 0.36, fontFace: F, fontSize: 15.5, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: 8.95, y: y + 0.38, w: 3.6, h: 0.8, fontFace: F, fontSize: 12, color: MUTE, margin: 0 });
  });
  punch(s, "검색이 아니라 질문입니다. 그리고 답에는 근거가 같이 옵니다.", M, 6.16, CW);
  s.addNotes("말할 것 — 일반 챗봇과 다른 점은 우리가 쌓은 자료 안에서만 답한다는 것, 그리고 출처를 붙인다는 것입니다. 근거 없는 문장이 보고서에 들어가는 게 제일 위험하니까요. / 촬영 직전 같은 질문을 한 번 돌려 예열할 것.");
}

/* ══ 6. 말 한마디로 기능이 붙는다 ═════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "말 한마디로 기능이 붙는다", "요구사항을 말로 하면 화면이 바뀝니다 — 요청서도 회의도 없이");
  videoSlot(s, "영상 ④", "60초", M, 1.72, 7.5, 4.2);
  s.addText("화면에서 제가 한 것", { x: 8.55, y: 1.78, w: 4.0, h: 0.34, fontFace: F, fontSize: 12, color: MUTE, margin: 0 });
  s.addShape(p.ShapeType.roundRect, { x: 8.55, y: 2.16, w: 4.0, h: 1.5, rectRadius: 0.05, fill: { color: INK } });
  s.addText("“‘국고채 2년’도 인식되게 해줘.\n코드는 ktb2y로.”", {
    x: 8.75, y: 2.34, w: 3.6, h: 1.14, fontFace: F, fontSize: 14, color: "DCE9EA", margin: 0, lineSpacingMultiple: 1.25,
  });
  const after = [["도구가 한 것", "고칠 파일을 스스로 찾음"], ["", "수정안을 보여주고 승인을 받음"], ["", "바뀐 코드는 3줄"]];
  after.forEach(([k, d], i) => {
    const y = 3.95 + i * 0.62;
    if (k) s.addText(k, { x: 8.55, y: y - 0.36, w: 4.0, h: 0.32, fontFace: F, fontSize: 12, color: MUTE, margin: 0 });
    s.addText("· " + d, { x: 8.55, y, w: 4.0, h: 0.36, fontFace: F, fontSize: 13.5, color: BODY, margin: 0 });
  });
  punch(s, "제가 코드를 짠 게 아니라, 요구사항을 말한 것입니다.", M, 6.16, CW);
  s.addNotes("말할 것 — 중요한 건 제가 코드를 짠 게 아니라 요구사항을 말했다는 겁니다. 담당자가 원하는 항목 하나 늘리는 데 개발 요청서가 필요 없어집니다. / 시연 전용 브랜치에서 촬영하고 끝나면 git checkout . 으로 되돌릴 것.");
}

/* ══ 7. 공통점 (어두운) ════════════════════════════ */
{
  const s = p.addSlide();
  s.background = { color: INK };
  s.addText("네 가지의 공통점", { x: M, y: 0.72, w: CW, h: 0.72, fontFace: F, fontSize: 34, bold: true, color: "FFFFFF" });
  const three = [
    ["어려운 걸 만든 게 아니라,\n반복되는 걸 없앴다", "붙여넣기 · 서식 맞추기 · 자료 찾기 · 옮겨 적기"],
    ["말로 시작해서\n말로 고쳤다", "기획서도 요청서도 회의도 없이, 쓰면서 고쳤습니다"],
    ["실패를 전제로 짰다", "키가 없으면 에러가 아니라 기능만 줄고, 다음날 다시 시도합니다"],
  ];
  three.forEach(([t, d], i) => {
    const x = M + i * 4.03;
    s.addText(String(i + 1), { x, y: 1.86, w: 0.8, h: 0.74, fontFace: F, fontSize: 34, bold: true, color: GOLD, margin: 0 });
    s.addText(t, { x, y: 2.68, w: 3.6, h: 1.5, fontFace: F, fontSize: 21, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.2 });
    s.addText(d, { x, y: 4.32, w: 3.6, h: 1.0, fontFace: F, fontSize: 13, color: "9FBABF", margin: 0 });
  });
  s.addNotes("발표의 핵심 메시지 장표. 여기서 청중이 '나도 하나쯤 있다'고 떠올리게 만드는 게 목적이다.");
}

/* ══ 8. 무엇부터 하면 되나 ═════════════════════════ */
{
  const s = p.addSlide();
  titleLight(s, "무엇부터 하면 되나", "세 개 다 하실 필요 없습니다 — 하나만 고르시면 됩니다");
  const cards = [
    ["매주 똑같이 만드는\n문서 한 개", "서식부터 자동화", "영상 ②"],
    ["손으로 옮겨 적는\n표 한 개", "붙여넣기 자동 인식", "영상 ①"],
    ["매일 찾아보는\n자료 한 곳", "자동 수집 + 검색", "영상 ③⑤"],
  ];
  cards.forEach(([t, d, ref], i) => {
    const x = M + i * 4.03;
    s.addShape(p.ShapeType.roundRect, { x, y: 1.9, w: 3.74, h: 3.0, rectRadius: 0.07, fill: { color: "F5F8F8" }, line: { color: LINE, width: 0.75 } });
    s.addText(String(i + 1), { x: x + 0.32, y: 2.16, w: 0.6, h: 0.5, fontFace: F, fontSize: 26, bold: true, color: GOLD, margin: 0 });
    s.addText(t, { x: x + 0.32, y: 2.78, w: 3.1, h: 1.0, fontFace: F, fontSize: 18, bold: true, color: INK, margin: 0, lineSpacingMultiple: 1.2 });
    s.addText(d, { x: x + 0.32, y: 3.86, w: 3.1, h: 0.4, fontFace: F, fontSize: 13.5, color: TEAL, margin: 0 });
    s.addText(ref, { x: x + 0.32, y: 4.32, w: 3.1, h: 0.34, fontFace: F, fontSize: 11.5, color: MUTE, margin: 0 });
  });
  s.addText("“하나만 고르시고, 그걸 말로 설명하는 것부터 시작하시면 됩니다.”", {
    x: M, y: 5.35, w: CW, h: 0.6, fontFace: F, fontSize: 20, bold: true, color: TEAL, margin: 0,
  });
  s.addNotes("마무리. 청중이 자리에서 일어나 바로 할 수 있는 크기로 세 개만 남긴다. 질문이 나오면 예상 질문표(03-발표-촬영-가이드.md) 참고.");
}

p.writeFile({ fileName: process.argv[2] || "위험관리_추가슬라이드.pptx" }).then((f) => console.log("saved:", f));
