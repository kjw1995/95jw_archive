---
title: REST API 기초
weight: 1
---

## REST의 탄생 배경

```
SOAP/WSDL (XML 기반)  →  REST (HTTP 기반)
      ↓                        ↓
  엄격한 규칙              유연한 구조
  복잡한 명세              간단한 인터페이스
```

### SOA에서 REST로의 진화

| 구분 | SOAP/WSDL | REST |
|------|-----------|------|
| 기반 | XML | HTTP |
| 규칙 | 엄격한 스키마 | 유연한 구조 |
| 학습 곡선 | 높음 | 낮음 |
| 적합 환경 | 기업 내부 시스템 | 분산 서비스, 모바일, 웹 |

---

## REST 기본 철학

```
┌─────────────────────────────────────────────────────────────┐
│                    REST 4대 원칙                             │
├─────────────────────────────────────────────────────────────┤
│  1. 모든 리소스는 URI로 식별                                  │
│  2. 리소스는 다양한 형태(JSON, XML 등)로 표현 가능             │
│  3. HTTP 표준 메소드로 리소스 조작 (GET, POST, PUT, DELETE)   │
│  4. 서버는 상태를 저장하지 않음 (Stateless)                   │
└─────────────────────────────────────────────────────────────┘
```

### 무상태성 (Statelessness)의 장점

| 특성 | 설명 | 예시 |
|------|------|------|
| **가시성** | 요청만 보고 전체 맥락 파악 가능 | 모니터링/디버깅 용이 |
| **신뢰성** | 장애 발생 시 체크포인트 불필요 | 서버 재시작해도 문제 없음 |
| **확장성** | 서버 증설만으로 처리량 증가 | 로드밸런서로 분산 처리 |

---

## 리차드슨 성숙도 모델 (RMM)

REST의 성숙도를 4단계로 구분

```
Level 3: HATEOAS        ← 하이퍼미디어 링크 포함
    ↑
Level 2: HTTP Verbs     ← GET, POST, PUT, DELETE 활용
    ↑
Level 1: Resources      ← URI로 리소스 구분
    ↑
Level 0: POX            ← 단순 HTTP 전송 (POST만 사용)
```

### 각 레벨 상세

#### Level 0: 원격 프로시저 호출
```http
POST /api HTTP/1.1
Content-Type: application/xml

<getUser><id>123</id></getUser>
```

#### Level 1: REST 리소스
```http
POST /api/users/123 HTTP/1.1
```

#### Level 2: HTTP 메소드 활용
```http
GET    /api/users/123    # 조회
POST   /api/users        # 생성
PUT    /api/users/123    # 수정
DELETE /api/users/123    # 삭제
```

#### Level 3: HATEOAS
```json
{
  "id": 123,
  "name": "John",
  "links": [
    { "rel": "self", "href": "/api/users/123" },
    { "rel": "orders", "href": "/api/users/123/orders" },
    { "rel": "delete", "href": "/api/users/123", "method": "DELETE" }
  ]
}
```

---

## HTTP 메소드 특성

### 안전성과 멱등성

```
┌──────────┬──────────┬──────────┬─────────────────────────────┐
│  메소드   │  안전성  │  멱등성  │           설명              │
├──────────┼──────────┼──────────┼─────────────────────────────┤
│  GET     │    O     │    O     │ 조회, 캐시 가능              │
│  HEAD    │    O     │    O     │ 헤더만 조회                  │
│  POST    │    X     │    X     │ 생성, 매번 새 리소스 생성 가능│
│  PUT     │    X     │    O     │ 전체 수정, 반복해도 결과 동일 │
│  PATCH   │    X     │    X     │ 부분 수정                    │
│  DELETE  │    X     │    O     │ 삭제, 반복해도 결과 동일      │
└──────────┴──────────┴──────────┴─────────────────────────────┘
```

- **안전(Safe)**: 서버 상태를 변경하지 않음
- **멱등(Idempotent)**: 여러 번 실행해도 결과가 동일

---

## RESTful URI 설계

### URI 설계 원칙

```
✅ 좋은 예시                    ❌ 나쁜 예시
────────────────────────────────────────────────────
/v1/users                      /v1/getUsers
/v1/users/123                  /v1/user?id=123
/v1/users/123/orders           /v1/getUserOrders?userId=123
/v1/users/123/orders/456       /v1/deleteOrder?id=456
```

### URI 설계 규칙

| 규칙 | 설명 | 예시 |
|------|------|------|
| **명사 사용** | 동사 대신 명사로 리소스 표현 | `/users` (O), `/getUsers` (X) |
| **복수형** | 컬렉션은 복수형으로 | `/users`, `/orders` |
| **계층 구조** | 슬래시로 계층 표현 | `/users/123/orders` |
| **소문자** | URI는 소문자로 통일 | `/api/users` |
| **하이픈** | 단어 구분은 하이픈 사용 | `/user-profiles` |

### 실제 설계 예시

```
도서관 API 설계

GET    /v1/books                    # 전체 도서 목록
GET    /v1/books/isbn/978-1234      # ISBN으로 도서 조회
POST   /v1/books                    # 새 도서 등록
PUT    /v1/books/isbn/978-1234      # 도서 정보 전체 수정
PATCH  /v1/books/isbn/978-1234      # 도서 정보 일부 수정
DELETE /v1/books/isbn/978-1234      # 도서 삭제

GET    /v1/users/123/books          # 특정 유저의 대출 도서
GET    /v1/users/123/books/count    # 대출 도서 수
```

---

## HTTP 메소드 상세

### GET - 리소스 조회

```http
GET /v1/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
```

```json
// Response: 200 OK
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### POST - 리소스 생성

```http
POST /v1/users HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

```json
// Response: 201 Created
// Location: /v1/users/124
{
  "id": 124,
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

### PUT vs POST

| 특성 | POST | PUT |
|------|------|-----|
| **URI 결정** | 서버가 결정 | 클라이언트가 지정 |
| **멱등성** | X (매번 새 리소스) | O (동일 결과) |
| **용도** | 생성 | 생성 또는 전체 교체 |

```http
# POST: 서버가 ID 생성
POST /v1/users
→ 201 Created, Location: /v1/users/124

# PUT: 클라이언트가 ID 지정
PUT /v1/users/124
→ 201 Created (없으면 생성)
→ 200 OK (있으면 교체)
```

### PUT vs PATCH

```http
# PUT: 전체 교체 (모든 필드 필요)
PUT /v1/users/123
{
  "name": "John Updated",
  "email": "john@example.com",
  "age": 30,
  "address": "Seoul"
}

# PATCH: 부분 수정 (변경할 필드만)
PATCH /v1/users/123
{
  "name": "John Updated"
}
```

---

## API 테스트

### cURL 기본 사용법

```bash
# GET 요청
curl https://api.example.com/v1/users

# 헤더 포함
curl -H "Authorization: Bearer token123" \
     https://api.example.com/v1/users

# 응답 헤더 확인
curl -i https://api.example.com/v1/users

# POST 요청 (JSON)
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"John","email":"john@example.com"}' \
     https://api.example.com/v1/users

# PUT 요청
curl -X PUT \
     -H "Content-Type: application/json" \
     -d '{"name":"John Updated","email":"john@example.com"}' \
     https://api.example.com/v1/users/123

# DELETE 요청
curl -X DELETE https://api.example.com/v1/users/123
```

### cURL 주요 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `-X` | HTTP 메소드 지정 | `-X POST` |
| `-H` | 헤더 추가 | `-H "Content-Type: application/json"` |
| `-d` | 요청 본문 | `-d '{"key":"value"}'` |
| `-i` | 응답 헤더 포함 출력 | `curl -i URL` |
| `-v` | 상세 정보 출력 | `curl -v URL` |
| `-o` | 파일로 저장 | `-o output.json` |

---

## 설계 베스트 프랙티스

### URI 설계

```
✅ 권장사항
────────────────────────────────────
- 명사 + HTTP 메소드로 행위 표현
- 서브리소스는 URI 계층으로 표현
- 필터/검색은 쿼리 파라미터 사용
- 버전은 URI에 포함 (/v1/, /v2/)
```

### 응답 설계

```
✅ 권장사항
────────────────────────────────────
- 기본 응답 포맷: JSON
- 필드명: camelCase 또는 snake_case (일관성 유지)
- 카운트 API 제공: /users/count
- 상세한 응답으로 추가 요청 최소화
- 페이지네이션: ?page=1&limit=20
- 필드 선택: ?fields=id,name,email
```

### 쿼리 파라미터 활용

```http
# 필터링
GET /v1/users?status=active&role=admin

# 정렬
GET /v1/users?sort=created_at&order=desc

# 페이지네이션
GET /v1/users?page=2&limit=20

# 필드 선택 (Sparse Fieldsets)
GET /v1/users?fields=id,name,email

# 검색
GET /v1/users?q=john

# 조합
GET /v1/users?status=active&sort=name&page=1&limit=10&fields=id,name
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **REST** | Representational State Transfer |
| **리소스** | URI로 식별되는 모든 것 |
| **표현형** | 리소스의 특정 시점 상태 (JSON, XML 등) |
| **무상태성** | 서버가 클라이언트 상태를 저장하지 않음 |
| **멱등성** | 여러 번 실행해도 결과가 동일한 특성 |
| **HATEOAS** | 응답에 다음 가능한 액션 링크 포함 |
| **RMM** | Richardson Maturity Model (성숙도 모델) |
