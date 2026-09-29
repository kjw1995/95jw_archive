#!/usr/bin/env node
// 챕터 마크다운 검사 도구 (Node 18+, 외부 의존성 없음. Windows/macOS/Linux 공통)
//
//   node tools/check-chapter.js <file.md> [--links-as <content/path.md>] [--forbid "표현" ...]
//   node tools/check-chapter.js --install <draft.md> <content/path.md>
//
// 검사 항목
//   1. 모든 코드 블록(``` 안)의 표시 폭이 40자 이하인가 (한글·전각은 2칸)
//   2. 코드 블록이 닫혔는가, callout 여닫음 짝이 맞는가, 탭이 없는가
//   3. 본문에 `# ` H1이 없는가 (frontmatter title만 사용)
//   4. `](../...)` 상대 링크의 대상 파일이 있는가 (페이지 URL 디렉터리 기준)
//   5. 표의 열 수가 헤더와 같은가
//   6. 널 바이트가 없는가, 줄 끝이 전부 CRLF인가 (설치본 기준)
//   7. 금지 표현("이 PC" 등 실측 화법)이 없는가
// --install 은 초안을 대상 경로에 복사하면서 줄 끝을 CRLF 로 맞춘다.

const fs = require("fs");
const path = require("path");

const WIDE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯　-〿]/;
const width = (s) => { let n = 0; for (const ch of s) n += WIDE.test(ch) ? 2 : 1; return n; };

function install(src, dst) {
  const text = fs.readFileSync(src, "utf8").replace(/\r?\n/g, "\n");
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, lines.map((l) => l + "\r\n").join(""));
  console.log(`installed ${dst} (${lines.length} lines, CRLF)`);
}

function check(file, opts) {
  const raw = fs.readFileSync(file, "utf8");
  const nul = (raw.match(/\0/g) || []).length;
  const crlf = (raw.match(/\r\n/g) || []).length;
  const total = (raw.match(/\n/g) || []).length;
  const lines = raw.replace(/\r/g, "").split("\n");
  const problems = [];

  // 1~3. 코드 블록 폭, 닫힘, 탭, H1
  let inBlock = false, blockStart = 0, blocks = 0;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/^```/.test(line)) {
      if (!inBlock) { inBlock = true; blockStart = n; blocks++; }
      else inBlock = false;
      return;
    }
    if (inBlock) {
      const w = width(line);
      if (w > 40) problems.push(`L${n}: 코드 블록 폭 ${w} > 40 (블록 시작 L${blockStart})`);
      if (line.includes("\t")) problems.push(`L${n}: 탭 문자`);
    } else if (/^# /.test(line)) {
      problems.push(`L${n}: 본문 H1 (frontmatter title만 사용)`);
    }
  });
  if (inBlock) problems.push(`L${blockStart}: 닫히지 않은 코드 블록`);

  const opens = (raw.match(/\{\{<\s*callout/g) || []).length;
  const closes = (raw.match(/\{\{<\s*\/callout\s*>\}\}/g) || []).length;
  if (opens !== closes) problems.push(`callout 여닫음 불일치: ${opens} / ${closes}`);

  // 4. 상대 링크 존재 (페이지 URL 디렉터리 기준: <file 이름>/ 안에서 ../ 를 푼다)
  const asPath = opts.linksAs || file;
  const pageDir = asPath.replace(/\.md$/i, "");
  const linkRe = /\]\((\.\.?\/[^)#\s]*)\)/g;
  let m;
  const seen = new Set();
  while ((m = linkRe.exec(raw)) !== null) {
    const target = m[1];
    if (seen.has(target)) continue;
    seen.add(target);
    const resolved = path.resolve(path.dirname(asPath), path.basename(pageDir), target);
    const ok = fs.existsSync(resolved + ".md") || fs.existsSync(path.join(resolved, "_index.md")) || fs.existsSync(resolved);
    if (!ok) problems.push(`링크 대상 없음: ${target} → ${resolved}`);
  }

  // 5. 표 열 수
  let inTable = false, header = 0;
  lines.forEach((line, i) => {
    if (/^\|/.test(line)) {
      const cells = (line.replace(/\\\|/g, "").match(/\|/g) || []).length;
      if (!inTable) { inTable = true; header = cells; }
      else if (cells !== header) problems.push(`L${i + 1}: 표 열 수 ${cells} ≠ 헤더 ${header}`);
    } else inTable = false;
  });

  // 6. 널 바이트, CRLF
  if (nul > 0) problems.push(`널 바이트 ${nul}개`);
  if (opts.requireCrlf && crlf !== total) problems.push(`CRLF ${crlf}/${total} 줄 (전부 CRLF여야 함)`);

  // 7. 금지 표현
  for (const word of opts.forbid) {
    const cnt = raw.split(word).length - 1;
    if (cnt > 0) problems.push(`금지 표현 "${word}" ${cnt}회`);
  }

  console.log(`${file}: blocks=${blocks} lines=${lines.length} crlf=${crlf}/${total} callouts=${opens}/${closes}`);
  for (const p of problems) console.log("  ✗ " + p);
  if (problems.length === 0) console.log("  ✓ OK");
  return problems.length === 0;
}

// --- CLI ---
const argv = process.argv.slice(2);
if (argv[0] === "--install") {
  if (argv.length < 3) { console.error("usage: --install <draft.md> <target.md>"); process.exit(2); }
  install(argv[1], argv[2]);
  process.exit(0);
}
const opts = { forbid: ["이 PC"], linksAs: null, requireCrlf: false };
const files = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--links-as") opts.linksAs = argv[++i];
  else if (a === "--forbid") opts.forbid.push(argv[++i]);
  else if (a === "--no-forbid") opts.forbid = [];
  else if (a === "--crlf") opts.requireCrlf = true;
  else files.push(a);
}
if (files.length === 0) { console.error("usage: node tools/check-chapter.js <file.md> [--links-as <content/path.md>] [--crlf] [--forbid <word>]"); process.exit(2); }
let allOk = true;
for (const f of files) if (!check(f, opts)) allOk = false;
process.exit(allOk ? 0 : 1);
