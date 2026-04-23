Education 디렉터리 현황을 한눈에 보여주는 명령어입니다.

## 입력

$ARGUMENTS

(비어있으면 전체 조회, 축약어 입력 시 해당 디렉터리만 상세 조회)

## 전체 조회 모드

`content/education/` 하위 모든 디렉터리를 스캔하여 아래 형식으로 출력합니다:

```
📂 Education 디렉터리 현황

| 디렉터리 | 파일 수 | 최근 파일 | CLAUDE.md |
|:---------|:--------|:----------|:----------|
| java/basics | 5 | 05-collections.md | ✅ |
| java/modern-java-in-action | 5 | 05-stream-api.md | ✅ |
| spring | 9 | spring-bean-scope.md | ✅ |
| database | 9 | security-authorization.md | ✅ |
| network | 10 | 10-cable-types.md | ✅ |
```

## 상세 조회 모드

특정 디렉터리를 지정하면:

1. CLAUDE.md 내용 (source, naming, style_ref)
2. 전체 파일 목록 (번호, 제목, weight)
3. _index.md 등록 여부
4. 다음 파일 번호 안내

```
📂 java/web-programming (12 files)

source: 자바 웹을 다루는 기술
naming: {nn}-kebab-case.md
다음 번호: 11

| # | 파일 | 제목 | _index |
|:--|:-----|:-----|:-------|
| 01 | 01-web-programming-jsp.md | 웹 프로그래밍과 JSP | ✅ |
| 02 | 02-web-application.md | 웹 애플리케이션 | ✅ |
| ... | ... | ... | ... |
```