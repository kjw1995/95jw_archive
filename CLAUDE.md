# 95JW Archive 프로젝트 가이드

## 프로젝트 개요

- Hugo 기반 기술 블로그 (Hextra 테마)
- GitHub Pages 배포: https://kjw1995.github.io/95jw_archive/

## 디렉터리 구조

```
content/
├── _index.md          # 메인 페이지
├── about.md           # 소개 페이지
└── docs/
    ├── _index.md      # Archive 메인
    ├── education/     # 학습 노트
    │   ├── java/      # Java, JVM, JPA, 동시성
    │   ├── spring/    # Spring Core, Batch
    │   ├── database/  # DB 개론, SQL
    │   ├── network/   # OSI, TCP/IP, HTTP
    │   ├── devops/    # Kubernetes, CI/CD
    │   ├── linux/     # 셸, 파일 시스템
    │   └── architecture/  # REST API 설계
    └── blog/          # 경험 기록
        ├── retrospective/    # 회고
        ├── troubleshooting/  # 트러블슈팅
        └── tech-review/      # 기술 리뷰
```

## 문서 작성 규칙

### _index.md 작성 기준

1. frontmatter에 `title`과 `sidebar: open: true` 포함
2. 소개 문구는 한 문장으로 간결하게 ("~를 다룹니다.")
3. 하위 항목은 테이블 형식으로 정리
4. 본문에 `# 제목` 중복 금지 (frontmatter title만 사용)
5. "직접 접근: URL", "~ 정리입니다" 같은 딱딱한 문구 사용 금지

### 테이블 형식

```markdown
| 주제 | 설명 |
|:-----|:-----|
| [링크](path) | 간단한 설명 |
```

### 카드 형식 (메인 페이지)

```markdown
{{</* cards */>}}
  {{</* card link="path" title="제목" subtitle="설명" */>}}
{{</* /cards */>}}
```

### 코드 블록 다이어그램 규칙

모바일/PC 모두 깨지지 않도록 다음을 지킨다.

1. **전체 폭을 40자 이내**로 유지 (모바일 가로 스크롤 방지)
2. 박스(`┌─┐│└─┘`) 사용 시 **좌우 테두리 길이를 동일**하게 맞춘다
3. 흐름선(`│▼`)은 박스 중앙에 정렬한다
4. 한글은 2칸 차지하므로 **영문·한글 혼용 시 패딩을 확인**한다
5. 들여쓰기는 **스페이스만** 사용 (탭 금지)

**올바른 예시:**
```
    클라이언트
        │
        ▼
┌────────────────┐
│  톰캣 컨테이너   │
│  ┌──────────┐  │
│  │ Servlet  │  │
│  └──────────┘  │
└───────┬────────┘
        │
        ▼
    클라이언트
```

---

## Git 규칙

### Commit 메시지 형식

```
한 줄 요약 (영문 또는 한글)

생성
- 추가된 항목 설명
- 추가된 항목 설명

수정
- 수정된 항목 설명
- 수정된 항목 설명

삭제
- 삭제된 항목 설명
```

**규칙:**
- 각 항목은 `-`로 시작
- 한글로 작성
- 해당 없는 섹션(생성/수정/삭제)은 생략

**예시:**
```
인덱스 페이지 개선

수정
- education 메인 페이지 소개 문구 간결하게 변경
- linux, concurrency 제목 중복 제거
- 딱딱한 문구 자연스럽게 수정

삭제
- 불필요한 URL 안내 문구 제거
```

### Push 규칙

- commit 후 바로 push
- `git push origin main`

### Tag 규칙

- **명시적으로 tag 생성 요청이 있을 때만 생성**
- 형식: `yyyymmdd.job{sequence}`
- 예시: `20260107.job1`, `20260107.job2`

```bash
# tag 생성 (요청 시에만)
git tag 20260107.job1
git push origin 20260107.job1
```

---

## 자주 사용하는 명령어

```bash
# 로컬 서버 실행
hugo server

# 빌드
hugo

# 상태 확인
git status

# 커밋 및 푸시
git add .
git commit -m "메시지"
git push origin main
```
