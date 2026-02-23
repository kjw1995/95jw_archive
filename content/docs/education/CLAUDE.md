# Education 콘텐츠 작업 가이드

## 작업 지시 형식

### 기본 형식
```
{옵시디언_파일_경로} → education\{대상_디렉토리}
```

### 축약 형식
```
"모던자바 6장 추가"     → java/modern-java-in-action
"JPA 12장 추가"        → java/jpa
"네트워크 37장 추가"    → network
"DB 14장 추가"         → database
"리눅스 7장 추가"       → linux
"HTTP 6장 추가"        → network/http
"스프링 시큐리티 3장"   → spring/security
"CKA 추가"             → devops/k8s-basics
"코틀린 3장"           → kotlin/basics
```

축약어만으로 대상 디렉토리를 식별하고, 해당 디렉토리의 CLAUDE.md를 읽어 네이밍/스타일을 따른다.

## 작업 워크플로우

1. 옵시디언 원본 파일 읽기
2. 대상 디렉토리의 **CLAUDE.md** 읽기 → 소스, 네이밍, 스타일 확인
3. 대상 디렉토리의 **마지막 파일** 읽기 → 다음 번호/weight 결정, 문체 참고
4. 원본 요약 + 부족한 예제/개념/원리 보강하여 새 파일 작성
5. 루트 CLAUDE.md의 Git 규칙에 따라 커밋 → 푸시

## 보강 기준

원본 대비 아래를 추가한다:
- **코드 예제**: 동작 원리를 보여주는 추가 예시
- **비교 표/다이어그램**: 개념 간 차이를 명확히
- **callout 주의사항**: 실무 팁, 흔한 실수 (`{{</* callout type="info|warning" */>}}`)
- **단계별 동작 흐름**: 시각화 (코드 블록 다이어그램 규칙 준수)

## 공통 스타일 규칙

- 섹션: `## 번호. 제목` 형식
- 코드 블록: 언어 지정 (java, kotlin, sql, bash 등)
- 테이블: 좌측 정렬 (`|:---|:---|`)
- callout: Hextra 문법 사용
- 코드 블록 다이어그램: 루트 CLAUDE.md 규칙 준수 (40자 이내)

## 디렉토리 등록부

| 축약어 | 경로 | 소스 | 네이밍 |
|:------|:-----|:-----|:------|
| 자바기초 | java/basics | 자바의 정석 | `{nn}-kebab.md` |
| 자바동시성 | java/concurrency | 자바 병렬 프로그래밍 | `{nn}-kebab.md` |
| JPA | java/jpa | 자바 ORM 표준 JPA 프로그래밍 | `{nn}-kebab.md` |
| JVM | java/jvm | - | `kebab.md` |
| 모던자바 | java/modern-java-in-action | 모던 자바 인 액션 | `{nn}-kebab.md` |
| 웹프로그래밍 | java/web-programming | 자바 웹을 다루는 기술 | `{nn}-kebab.md` |
| 코틀린 | kotlin/basics | - | `{nn}-kebab.md` |
| DB | database | 데이터베이스 개론 | `kebab.md` |
| 네트워크 | network | 모두의 네트워크 | `{nn}-kebab.md` |
| HTTP | network/http | HTTP 웹 기본 지식 | `{nn}-kebab.md` |
| 리눅스 | linux | - | `{nn}-kebab.md` |
| 스프링 | spring | 스프링 핵심 원리 | `spring-kebab.md` |
| 시큐리티 | spring/security | Spring Security in Action | `{nn}-kebab.md` |
| 쿠버네티스 | devops | - | `kubernetes-kebab.md` |
| CKA | devops/k8s-basics | CKA 학습 노트 | `kebab.md` |
| 아키텍처 | architecture | REST API 설계 | `restful-kebab.md` |
| 동시성 | concurrency | - | `{nn}-kebab.md` |

## 새 디렉토리 추가 시

1. `content/docs/education/{새_디렉토리}/` 생성
2. `_index.md` 생성 (title, sidebar: open: true)
3. `CLAUDE.md` 생성 (아래 템플릿 사용)
4. 상위 `_index.md`에 카드/링크 추가
5. 이 파일의 **디렉토리 등록부**에 행 추가

### CLAUDE.md 템플릿

```
source: "책 제목"
naming: {nn}-kebab-case.md
title_format: "Chapter {NN}. 제목"
style_ref: 참고할_기존_파일.md
```
