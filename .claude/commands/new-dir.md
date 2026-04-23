Education 하위에 새 디렉터리를 생성하는 명령어입니다.

## 입력

$ARGUMENTS

형식: `{디렉터리명} {책_제목}` (예: "java/stream 자바 스트림 완벽 가이드")

## 워크플로우

### 1단계: 디렉터리 생성

`content/education/{입력_경로}/` 디렉터리를 생성합니다.

### 2단계: _index.md 생성

```markdown
---
title: {제목}
sidebar:
  open: true
---

{한 문장 소개}를 다룹니다.

---

| 주제 | 설명 |
|:-----|:-----|
```

### 3단계: CLAUDE.md 생성

아래 템플릿을 사용합니다:

```
source: "{책_제목}"
obsidian: D:\obsidian\{관련_경로}\
naming: {nn}-kebab-case.md
title_format: "Chapter {NN}. 제목"
style_ref: {참고파일}.md
```

### 4단계: 상위 _index.md 업데이트

상위 디렉터리의 `_index.md`에 카드와 테이블 링크를 추가합니다.

### 5단계: 디렉터리 등록부 업데이트

`content/education/CLAUDE.md`의 **디렉토리 등록부** 테이블에 새 행을 추가합니다.

### 6단계: 커밋 & 푸시

루트 CLAUDE.md Git 규칙에 따라 커밋 후 푸시합니다.