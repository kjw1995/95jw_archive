---
title: "02. 리소스 설계"
weight: 2
---

## 1. REST 리소스 패턴

클라이언트와 서버는 HTTP 메시지로 **표현(Representation)** 을 주고받는다. 요청에는 메서드·MIME 타입·URI가, 응답에는 상태 코드·MIME 타입·표현이 실린다.

```text
  Client                  Server
┌─────────┐             ┌─────────┐
│ Method  │             │         │
│ MIME    │── Request ─▶│ 처리    │
│ URI     │             │         │
│         │             │         │
│ Status  │◀─ Response ─│ Status  │
│ MIME    │             │ MIME    │
└─────────┘             └─────────┘
```

| 요소 | 요청 | 응답 |
|:---|:---|:---|
| 동작 | HTTP 메서드 | - |
| 위치 | 타깃 URI | Location (생성 시) |
| 형식 | MIME 타입 | MIME 타입 |
| 결과 | - | HTTP 상태 코드 |

## 2. 콘텐츠 협상 (Content Negotiation)

동일한 URI의 리소스를 **여러 표현형으로 제공**하고 클라이언트가 원하는 형식을 고르게 하는 메커니즘이다. 크게 두 가지 방식이 있다.

```text
[HTTP 헤더 방식]        [URL 패턴 방식]
Accept: app/json        /books.json
Accept: app/xml         /books.xml
Accept-Language: ko     /books.html
      │                      │
      ▼                      ▼
  표준 · 권장           URL만 보고 구분
```

### HTTP 헤더를 이용한 협상

```http
# 요청
GET /api/v1/books/123 HTTP/1.1
Host: api.example.com
Accept: application/json
Accept-Language: ko-KR

# 응답
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 123,
  "title": "REST API 설계"
}
```

### 주요 HTTP 헤더

| 헤더 | 방향 | 설명 |
|:---|:---|:---|
| Accept | 요청 | 클라이언트가 처리 가능한 MIME 타입과 우선순위 |
| Accept-Language | 요청 | 원하는 언어 |
| Content-Type | 응답 | 서버가 보낸 엔티티의 MIME 타입 |

### 주요 MIME 타입

| MIME 타입 | 용도 |
|:---|:---|
| application/json | JSON 데이터 (가장 많이 사용) |
| application/xml | XML 데이터 |
| text/html | HTML 문서 |
| text/plain | 일반 텍스트 |
| image/jpeg | JPEG 이미지 |
| image/png | PNG 이미지 |
| multipart/form-data | 파일 업로드 |

### URL 패턴을 이용한 협상

```http
# JSON 요청
GET /api/v2/library/books.json HTTP/1.1

# XML 요청
GET /api/v2/library/books.xml HTTP/1.1
```

{{< callout type="info" >}}
URL 패턴 방식은 서버에서 **확장자별로 별도 메서드**를 준비해야 한다. 표준 접근은 `Accept` 헤더를 사용하는 쪽이며, URL 확장자는 브라우저 직접 접근용 보조 경로로 쓰는 편이 좋다.
{{< /callout >}}

## 3. POJO 기반 JSON 바인딩

자바 객체(POJO)를 JSON으로 매핑하는 표준 방식이며, 스프링 생태계에서는 **Jackson**(ObjectMapper)이 담당한다.

```text
 Java Object              JSON String
┌──────────┐             ┌──────────┐
│ Coffee   │             │ {        │
│  name    │─serialize──▶│ "name":..│
│  price   │             │ "price": │
│  origin  │◀deserialize│ "origin":│
└──────────┘             │ }        │
                         └──────────┘
    ObjectMapper가 양방향 변환
```

### Jackson 사용 예제

```java
// 의존성: com.fasterxml.jackson.core
ObjectMapper objectMapper = new ObjectMapper();

// JSON → Java Object (역직렬화)
String jsonData = "{\"name\":\"Espresso\",\"price\":4500}";
Coffee coffee = objectMapper.readValue(jsonData, Coffee.class);

// Java Object → JSON (직렬화)
Coffee latte = new Coffee("Latte", 5000);
String json = objectMapper.writeValueAsString(latte);
// 결과: {"name":"Latte","price":5000}
```

### Spring Boot에서의 자동 바인딩

```java
@RestController
@RequestMapping("/api/coffees")
public class CoffeeController {

    @PostMapping
    public ResponseEntity<Coffee> create(@RequestBody Coffee coffee) {
        Coffee saved = coffeeService.save(coffee);
        return ResponseEntity
            .created(URI.create("/api/coffees/" + saved.getId()))
            .body(saved);
    }
}
```

`@RequestBody`·`@ResponseBody`가 내부적으로 Jackson을 호출해 JSON ↔ POJO 변환을 자동으로 처리한다.

## 4. API 버저닝

애플리케이션이 점진적으로 진화할 수 있도록 **URI 설계 단계부터 버전을 명확히 구분**한다. 기존 클라이언트가 깨지지 않도록 보호하는 것이 핵심이다.

```text
 v1.0        v2.0        v3.0
┌────┐      ┌────┐      ┌────┐
│API │─────▶│API │─────▶│API │
└────┘ 기능  └────┘ 구조  └────┘
       추가         변경
  │            │            │
  ▼            ▼            ▼
 기존         신규         최신
 클라         클라         클라
```

### 버전 지정 방법 비교

| 방법 | 예시 | 장점 | 단점 |
|:---|:---|:---|:---|
| URI 지정 | `/v2/coffees/123` | 명확, 캐시 가능 | URL이 길어짐 |
| 쿼리 파라미터 | `/coffees?version=v2` | 구현 간단 | 캐시 불가 |
| Accept 헤더 | `Accept: app/vnd.foo-v2+json` | URL 깔끔 | 테스트 어려움 |

### URI에 버전 지정 (권장)

```http
# 명시적 버전
GET /api/v2/coffees/1234 HTTP/1.1

# 버전 생략 → 최신 버전으로
GET /api/coffees/1234 HTTP/1.1
```

#### 구버전 접근 시 리다이렉트 흐름

```text
Client                     Server
  │                          │
  │─ GET /api/v1/coffees ───▶│
  │                          │
  │◀─ 301 Moved Permanently ─│
  │  Location: /api/v2/...   │
  │                          │
  │─ GET /api/v2/coffees ───▶│
  │                          │
  │◀──────── 200 OK ─────────│
```

#### 리다이렉션 응답 코드

| 코드 | 의미 | 용도 |
|:---|:---|:---|
| 301 Moved Permanently | 영구 이동 | 구버전이 새 버전으로 완전히 대체됨 |
| 302 Found | 임시 이동 | URI는 유효하지만 리소스가 일시적으로 다른 곳에 있음 |

### 쿼리 파라미터에 버전 지정

```http
GET /api/coffees/1234?version=v2 HTTP/1.1
```

응답이 **캐시 키로 구분되지 않을 수 있어** 프록시 캐시 친화도가 낮다.

### Accept 헤더에 버전 지정

```http
GET /api/coffees/1234 HTTP/1.1
Accept: application/vnd.foo-v2+json
```

- `vnd`: vendor-specific (벤더 고유) MIME 타입 접두사
- GitHub API 등에서 사용하는 방식

{{< callout type="warning" >}}
버전 전략은 프로젝트 초기에 결정해 **한 가지 방식으로 통일**한다. 방식을 혼용하면 클라이언트가 헤더·경로·쿼리를 모두 확인해야 해서 디버깅이 급격히 어려워진다.
{{< /callout >}}

## 5. HTTP 응답 코드

REST API에서 자주 사용하는 상태 코드 분류.

```text
2XX 성공         3XX 리다이렉션
┌──────────┐    ┌───────────┐
│ 200 OK   │    │ 301 Moved │
│ 201 Cre  │    │ 302 Found │
│ 202 Acc  │    │ 304 NotMod│
│ 204 No   │    └───────────┘
└──────────┘

4XX 클라이언트 에러
┌─────────────────┐
│ 400 Bad Request │
│ 401 Unauthorized│
│ 404 Not Found   │
│ 406 Not Accept  │
└─────────────────┘

5XX 서버 에러
┌─────────────────┐
│ 500 Internal    │
│ 503 Unavailable │
└─────────────────┘
```

### 성공 응답 (2XX)

| 코드 | 이름 | 설명 | 사용 예시 |
|:---|:---|:---|:---|
| 200 | OK | 요청 성공, 데이터 포함 | GET, PUT, DELETE 성공 |
| 201 | Created | 리소스 생성됨 | POST 성공, Location 헤더 필수 |
| 202 | Accepted | 비동기 처리 수락 | 오래 걸리는 작업 요청 |
| 204 | No Content | 성공, 응답 본문 없음 | DELETE 성공 (데이터 불필요) |

```http
# 201 Created
POST /api/v1/users HTTP/1.1
Content-Type: application/json

{"name": "John", "email": "john@example.com"}

---
HTTP/1.1 201 Created
Location: /api/v1/users/456
Content-Type: application/json

{"id": 456, "name": "John", "email": "john@example.com"}
```

```http
# 202 Accepted (비동기 처리)
POST /api/v1/reports/generate HTTP/1.1

---
HTTP/1.1 202 Accepted
Location: /api/v1/reports/jobs/789

{"message": "Report generation started", "jobId": 789}
```

### 리다이렉션 응답 (3XX)

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 301 | Moved Permanently | 리소스가 영구적으로 다른 URI로 이동 |
| 302 | Found | 리소스가 임시로 다른 위치에 있음 |
| 304 | Not Modified | 조건부 요청에서 변경 없음 (캐시 재사용) |

### 클라이언트 에러 (4XX)

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 400 | Bad Request | 잘못된 요청 구문, 유효하지 않은 데이터 |
| 401 | Unauthorized | 인증 필요 (로그인 안 됨) |
| 403 | Forbidden | 권한 없음 (인증은 됐지만 접근 불가) |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 406 | Not Acceptable | 요청한 MIME 타입으로 응답 불가 |
| 415 | Unsupported Media Type | 지원하지 않는 미디어 타입 |

#### 401 vs 403

```text
401 Unauthorized      403 Forbidden
┌───────────────┐    ┌───────────────┐
│"누구세요?"    │    │"신분은 확인됨 │
│               │    │ 권한 없음"    │
│ 토큰 없음     │    │               │
│ 토큰 만료     │    │ 관리자 페이지 │
│ 토큰 유효X    │    │ 타 유저 데이터│
└───────────────┘    └───────────────┘
  → 로그인/재로그인    → 권한 상승 필요
```

### 서버 에러 (5XX)

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 500 | Internal Server Error | 서버 내부 에러 (일반적) |
| 503 | Service Unavailable | 서버 점검 중 또는 과부하 |

## 6. HTTP 메서드별 응답 코드 선택

| 메서드 | 주요 응답 코드 |
|:---|:---|
| GET | 200 OK / 404 Not Found |
| POST | 201 Created (Location 헤더 포함) / 202 Accepted / 400 Bad Request |
| PUT | 200 OK / 201 Created / 204 No Content |
| PATCH | 200 OK / 204 No Content |
| DELETE | 200 OK / 204 No Content / 404 Not Found |

### Spring Boot 응답 코드 예시

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<User> get(@PathVariable Long id) {
        return userService.find(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());  // 404
    }

    @PostMapping
    public ResponseEntity<User> create(@RequestBody User req) {
        User saved = userService.save(req);
        return ResponseEntity
            .created(URI.create("/api/users/" + saved.getId()))  // 201
            .body(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();  // 204
    }
}
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 콘텐츠 협상 | Accept / Content-Type으로 표현형 선택 |
| MIME 타입 | 콘텐츠 형식 표준 (application/json 등) |
| POJO 바인딩 | Jackson ObjectMapper가 Java ↔ JSON 변환 |
| API 버저닝 | URI 지정 권장 (명확·캐시 가능) |
| 201 Created | POST 성공 시 Location 헤더 필수 |
| 204 No Content | 본문 없이 성공 응답 |
| 301 vs 302 | 영구 이동 / 임시 이동 |
| 401 vs 403 | 인증 필요 / 권한 부족 |

{{< callout type="info" >}}
**용어 정리**
- **콘텐츠 협상 (Content Negotiation)**: 클라이언트가 원하는 표현형(JSON, XML 등)을 선택하는 메커니즘
- **페이로드 (Payload)**: 헤더·체크섬을 제외한 실제 전송 목적 데이터
- **퍼머링크 (Permalink)**: permanent + link, 리소스의 영구 불변 URL
- **크리덴셜 (Credential)**: 인증에 사용되는 암호학적 개인 정보 (토큰·인증서 등)
- **MIME 타입**: 콘텐츠 형식을 나타내는 표준 (application/json 등)
- **vnd**: vendor-specific, 벤더 고유 MIME 타입 접두사
- **POJO**: Plain Old Java Object, 프레임워크 의존성이 없는 순수 자바 객체
- **ObjectMapper**: Jackson 라이브러리의 JSON ↔ POJO 변환기
{{< /callout >}}
