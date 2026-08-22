// 워크샵 백업 시연 ①  "보고서 양식을 코드로 굳힌다"
// 외부 패키지 0개 · Node 18+ 면 어디서든 실행:  node make-docx.mjs
// → 같은 폴더에 '위험관리_보고서_양식샘플.docx' 생성 (바탕체 / □-* 3단 마커 / A4 여백 상하2.5·좌우2cm / 줄간격 1.3)
import { writeFileSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ── 최소 ZIP 라이터 (deflate) ───────────────────────────────────────────── */
const CRC = (buf) => (typeof crc32 === "function" ? crc32(buf) >>> 0 : crcFallback(buf));
function crcFallback(buf) {
  let t = crcFallback.t;
  if (!t) { t = crcFallback.t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const locals = [], centrals = [];
  let off = 0;
  for (const [name, content] of files) {
    const nameB = Buffer.from(name, "utf8");
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const comp = deflateRawSync(raw, { level: 9 });
    const crc = CRC(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameB, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(0, 42 - 12); ch.writeUInt32LE(off, 42);
    centrals.push(ch, nameB);
    off += lh.length + nameB.length + comp.length;
  }
  const cdBuf = Buffer.concat(centrals), lcBuf = Buffer.concat(locals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(lcBuf.length, 16);
  return Buffer.concat([lcBuf, cdBuf, eocd]);
}

/* ── OOXML 조립 ──────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const F = `<w:rFonts w:ascii="바탕체" w:hAnsi="바탕체" w:eastAsia="바탕체" w:cs="바탕체"/>`;
// 줄간격 1.3(=300) · 자간 -6 — 실제 보고서에서 쓰는 값
// ※ OOXML은 자식 요소 순서가 스키마로 고정돼 있다(rFonts→b→color→spacing→sz). 순서가 틀리면 워드가 파일을 열지 못한다.
const run = (t, o = {}) =>
  `<w:r><w:rPr>${F}${o.b ? "<w:b/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}` +
  `<w:spacing w:val="-6"/><w:sz w:val="${o.sz || 22}"/><w:szCs w:val="${o.sz || 22}"/></w:rPr>` +
  `<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
// pPr도 마찬가지(keepNext→wordWrap→spacing→ind→jc).
const para = (runs, o = {}) =>
  `<w:p><w:pPr>${o.keepNext ? "<w:keepNext/>" : ""}<w:wordWrap w:val="1"/>` +
  `<w:spacing w:line="300" w:lineRule="auto" w:before="${o.before || 0}" w:after="${o.after ?? 60}"/>` +
  `${o.ind ? `<w:ind w:left="${o.ind.left}" w:hanging="${o.ind.hanging}"/>` : ""}` +
  `${o.align ? `<w:jc w:val="${o.align}"/>` : ""}</w:pPr>${runs}</w:p>`;

const TITLE = (t) => para(run(t, { b: true, sz: 32 }), { align: "center", after: 260 });
const H = (n, t) => para(run(`${n}. ${t}`, { b: true, sz: 24 }), { before: 240, after: 100, keepNext: true });
const B = (t) => para(run("□ " + t, { b: true }), { before: 150, after: 40, ind: { left: 360, hanging: 300 }, keepNext: true });
const D = (t) => para(run("- " + t), { after: 30, ind: { left: 520, hanging: 280 } });
const S = (t) => para(run("* " + t, { sz: 20, color: "0070C0" }), { after: 30, ind: { left: 640, hanging: 220 } });

const cell = (t, w, o = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.head ? '<w:shd w:val="clear" w:fill="EDEFF3"/>' : ""}<w:vAlign w:val="center"/></w:tcPr>` +
  para(run(t, { b: !!o.head, sz: 20 }), { align: "center", after: 0 }) + `</w:tc>`;
const table = (rows, widths) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>` +
  `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((s) => `<w:${s} w:val="single" w:sz="4" w:color="777777"/>`).join("")}</w:tblBorders></w:tblPr>` +
  `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
  rows.map((r, ri) => `<w:tr>${r.map((c, ci) => cell(c, widths[ci], { head: ri === 0 })).join("")}</w:tr>`).join("") +
  `</w:tbl>` + para("", { after: 0 });

/* ── 본문(샘플 내용) ─────────────────────────────────────────────────────── */
const body = [
  TITLE("위험관리 업무 자동화 — 보고서 양식 샘플"),
  H(1, "작성 목적"),
  B("사람이 매번 맞추던 '양식'을 코드로 고정한다."),
  D("글꼴(바탕체)·여백(상하 2.5cm, 좌우 2cm)·줄간격(1.3)·마커 3단(□ / - / *)을 규칙으로 못 박음"),
  D("내용만 바뀌고 서식은 항상 동일 — 검토자가 서식을 지적할 일이 없음"),
  S("이 문서는 외부 패키지 없이 Node 하나로 생성됐습니다(생성 시간 1초 미만)."),
  H(2, "적용 대상"),
  B("정기 산출물 : 일·주·월 단위로 형식이 고정된 보고"),
  D("시장·규제 동향 보고, 지표 모니터링 결과, 점검 결과 요약"),
  B("반복 문서 : 매뉴얼·사용안내·기술 및 비용 정리"),
  D("내용이 바뀌면 스크립트만 고쳐 다시 생성 — 버전 관리가 곧 문서 이력"),
  H(3, "효과 (예시)"),
  table([
    ["구분", "이전", "이후"],
    ["작성 시간", "1건당 30~60분", "1초 (명령 1회)"],
    ["서식 오류", "검토 때마다 지적", "구조적으로 발생 불가"],
    ["갱신 방법", "이전 파일 복사·수정", "스크립트 재실행"],
  ], [2200, 3000, 3000]),
  H(4, "유의사항"),
  B("자동화 대상은 '형식'이지 '판단'이 아니다."),
  D("수치 해석·대응 방향 등 판단이 필요한 부분은 담당자가 직접 작성"),
  S("자동 생성물은 초안이며, 최종 책임은 작성자에게 있습니다."),
].join("");

const documentXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

const stylesXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${F}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

const contentTypes =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const rootRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const out = join(dirname(fileURLToPath(import.meta.url)), "위험관리_보고서_양식샘플.docx");
writeFileSync(out, zip([
  ["[Content_Types].xml", contentTypes],
  ["_rels/.rels", rootRels],
  ["word/document.xml", documentXml],
  ["word/_rels/document.xml.rels", docRels],
  ["word/styles.xml", stylesXml],
]));
console.log("생성 완료 →", out);
