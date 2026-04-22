---
title: "04. HTTP 상태 코드"
weight: 4
---

## 1. 상태 코드의 개념

**상태 코드**는 서버가 요청 처리 결과를 알려주는 3자리 숫자다. 첫 자리로 대분류를 구분한다.

```text
HTTP/1.1 200 OK
         └┬┘ └┬┘
      상태코드  이유 문구 (부가 설명)
```

## 2. 상태 코드 분류

| 범주 | 이름 | 의미 |
|:---|:---|:---|
| 1xx | Informational | 요청 수신, 처리 중 |
| 2xx | Successful | 정상 처리 |
| 3xx | Redirection | 추가 동작 필요 |
| 4xx | Client Error | 클라이언트 잘못, 재시도해도 실패 |
| 5xx | Server Error | 서버 문제, 재시도로 성공 가능 |

{{< callout type="info" >}}
인식하지 못하는 코드를 만나면 클라이언트는 **상위 범주로 해석**한다. 예: 299 → 2xx, 451 → 4xx. 그래서 새 코드를 도입해도 기존 클라이언트가 크게 깨지지 않는다.
{{< /callout >}}

## 3. 1xx – 정보

거의 사용되지 않지만 대용량 업로드 전 서버 수락을 확인할 때 쓰인다.

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 100 | Continue | 큰 본문 전송 전 계속 여부 확인 |
| 101 | Switching Protocols | WebSocket 업그레이드 등 |

```http
PUT /huge-file HTTP/1.1
Expect: 100-continue
Content-Length: 10485760

(본문 보내기 전 대기)
```

```http
HTTP/1.1 100 Continue
```

## 4. 2xx – 성공

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 200 | OK | 성공, 본문 포함 |
| 201 | Created | 리소스 생성, `Location` 포함 |
| 202 | Accepted | 접수, 처리 미완 (비동기) |
| 204 | No Content | 성공, 본문 없음 |
| 206 | Partial Content | 범위 요청 일부 응답 |

### 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"id":100,"name":"홍길동"}
```

### 201 Created

```http
POST /members HTTP/1.1
Content-Type: application/json

{"name":"홍길동"}
```

```http
HTTP/1.1 201 Created
Location: /members/100

{"id":100,"name":"홍길동"}
```

### 202 Accepted (비동기 작업)

```java
@PostMapping("/batch/reports")
public ResponseEntity<Void> submit(@RequestBody ReportRequest req) {
    String jobId = batchService.submit(req);
    return ResponseEntity
        .accepted()
        .header("Location", "/batch/reports/" + jobId)
        .build();
}
```

### 204 No Content

```http
HTTP/1.1 204 No Content
```

### 206 Partial Content (Range 요청)

```http
GET /videos/movie.mp4 HTTP/1.1
Range: bytes=1000000-1999999
```

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 1000000-1999999/52428800
Content-Length: 1000000

(해당 구간 바이트)
```

영상 스트리밍, 이어받기에서 핵심적으로 쓰인다.

## 5. 3xx – 리다이렉션

`Location` 헤더의 URL로 클라이언트가 이동한다.

### 영구 vs 일시 vs 특수

```text
영구: 301, 308   리소스 URI가 영구 이동
일시: 302, 303, 307
       일시적 이동, SEO 변경 없음
특수: 304 (Not Modified) → 캐시 재사용
```

### 메서드·본문 유지 여부

| 코드 | 의미 | 메서드·본문 유지 |
|:---|:---|:---|
| 301 | 영구 이동 | GET으로 변경 가능 |
| 302 | 일시 이동 | GET으로 변경 가능 |
| 303 | See Other | **항상 GET으로** |
| 307 | Temporary | **유지** |
| 308 | Permanent | **유지** |

{{< callout type="warning" >}}
POST를 307/308로 리다이렉트하면 원 메서드와 본문을 유지한 채 재요청된다. 결제·폼 제출을 301/302로 돌리면 브라우저가 GET으로 바꿔 **데이터 유실**이 생길 수 있다.
{{< /callout >}}

### PRG 패턴 (Post/Redirect/Get)

POST 후 새로고침으로 인한 중복 제출을 방지한다.

```text
Client                      Server
  │─ POST /orders ─────────→│
  │                         │ 주문 생성
  │←─ 302 Found ────────────│
  │  Location: /orders/100  │
  │                         │
  │─ GET /orders/100 ──────→│
  │←─ 200 OK (주문 상세) ────│
  │                         │
  (새로고침해도 GET만 재전송)
```

```java
@PostMapping("/orders")
public ResponseEntity<Void> create(@RequestBody OrderRequest req) {
    Order order = orderService.create(req);
    return ResponseEntity
        .status(HttpStatus.SEE_OTHER)  // 303
        .location(URI.create("/orders/" + order.getId()))
        .build();
}
```

### 304 Not Modified

조건부 요청에서 변경이 없을 때 본문 없이 응답한다. 상세 동작은 [05. 헤더와 캐시](05-http-headers)에서 다룬다.

```http
GET /image.png HTTP/1.1
If-None-Match: "abc123"
```

```http
HTTP/1.1 304 Not Modified
ETag: "abc123"
```

## 6. 4xx – 클라이언트 오류

요청 자체가 잘못되었으므로 **그대로 재시도해도 실패**한다.

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 400 | Bad Request | 잘못된 구문, 유효성 실패 |
| 401 | Unauthorized | 인증 필요 / 실패 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 405 | Method Not Allowed | 허용 안 된 메서드 |
| 409 | Conflict | 리소스 상태 충돌 |
| 410 | Gone | 영구 삭제 |
| 415 | Unsupported Media Type | Content-Type 미지원 |
| 422 | Unprocessable Entity | 문법은 맞으나 의미 오류 |
| 429 | Too Many Requests | 속도 제한 초과 |

### 400 Bad Request

```java
@PostMapping("/members")
public ResponseEntity<?> create(
        @RequestBody @Valid MemberRequest request,
        BindingResult result) {
    if (result.hasErrors()) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("입력값이 올바르지 않습니다",
                                    result.getAllErrors()));
    }
    return ResponseEntity.ok(memberService.save(request));
}
```

### 401 vs 403

```text
401 Unauthorized         403 Forbidden
"당신이 누구인지 모름"    "누군지 알지만 권한 없음"
  → 로그인 필요            → 인가 실패
  WWW-Authenticate 포함    Authorization은 유효
```

```java
// 401 – 인증 실패
@ExceptionHandler(AuthenticationException.class)
public ResponseEntity<ErrorResponse> auth(AuthenticationException e) {
    return ResponseEntity
        .status(HttpStatus.UNAUTHORIZED)
        .header("WWW-Authenticate", "Bearer")
        .body(new ErrorResponse(401, "인증이 필요합니다"));
}

// 403 – 권한 부족
@ExceptionHandler(AccessDeniedException.class)
public ResponseEntity<ErrorResponse> deny(AccessDeniedException e) {
    return ResponseEntity
        .status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse(403, "접근 권한이 없습니다"));
}
```

### 409 Conflict

낙관적 락 버전 불일치, 중복 데이터 등에 쓰인다.

```java
@PutMapping("/{id}")
public ResponseEntity<?> update(@PathVariable Long id,
                                @RequestBody MemberRequest req) {
    try {
        return ResponseEntity.ok(memberService.update(id, req));
    } catch (OptimisticLockException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse(409, "다른 사용자가 먼저 수정했습니다"));
    }
}
```

### 429 Too Many Requests

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1712345678
```

{{< callout type="info" >}}
`Retry-After`는 초(`60`) 또는 HTTP 날짜 형식을 쓴다. 클라이언트는 이 값만큼 대기 후 자동 재시도할 수 있다. 지수 백오프와 조합하면 서버 보호에 효과적이다.
{{< /callout >}}

## 7. 5xx – 서버 오류

서버 문제다. **재시도하면 성공할 수 있으므로** 안전 여부를 판단해 재시도한다.

| 코드 | 이름 | 설명 |
|:---|:---|:---|
| 500 | Internal Server Error | 서버 내부 오류 |
| 502 | Bad Gateway | 업스트림이 비정상 응답 |
| 503 | Service Unavailable | 일시적 과부하·점검 |
| 504 | Gateway Timeout | 업스트림 응답 지연 |

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> fallback(Exception e) {
    log.error("Unhandled", e);
    return ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse(500, "서버 오류가 발생했습니다"));
}
```

### 503에서 Retry-After 주기

```java
@GetMapping("/health")
public ResponseEntity<?> health() {
    if (isMaintenance()) {
        return ResponseEntity
            .status(HttpStatus.SERVICE_UNAVAILABLE)
            .header("Retry-After", "3600")
            .body(new ErrorResponse(503, "점검 중"));
    }
    return ResponseEntity.ok("OK");
}
```

## 8. Spring Boot 글로벌 예외 처리

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validation(
            MethodArgumentNotValidException e) {
        List<FieldError> errors = e.getBindingResult().getFieldErrors()
            .stream()
            .map(fe -> new FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(400, "입력값 오류", errors));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> notFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse(404, e.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> conflict(ConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse(409, e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> fallback(Exception e) {
        log.error("Unhandled", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse(500, "서버 오류"));
    }
}

record ErrorResponse(int status, String message, List<FieldError> errors) {
    public ErrorResponse(int s, String m) { this(s, m, null); }
}
record FieldError(String field, String message) {}
```

### Problem Details (RFC 7807)

표준화된 오류 본문 포맷. Spring 6부터 `ProblemDetail`을 기본 제공한다.

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type":   "https://api.example.com/errors/validation",
  "title":  "입력값 오류",
  "status": 400,
  "detail": "email은 이메일 형식이어야 합니다",
  "instance": "/api/members"
}
```

## 9. 상태 코드 선택 가이드

```text
처리 성공?
  └ YES ── 본문 있음?
  │         ├ YES → 200 OK
  │         └ NO ── 리소스 생성? → 201 Created
  │                  아니면       → 204 No Content
  │
  └ NO ─── 누구 잘못?
            ├ 클라 ── 인증 문제?
            │         ├ 미인증   → 401
            │         └ 권한 부족 → 403
            │         ├ 없음     → 404
            │         ├ 충돌     → 409
            │         ├ 속도 제한 → 429
            │         └ 기타     → 400
            │
            └ 서버 ── 일시적? → 503
                      기타    → 500
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 2xx | 성공 (200, 201, 204, 206) |
| 3xx | 리다이렉션 (301/302/303/307/308, 304) |
| 4xx | 클라이언트 오류, 재시도해도 실패 |
| 5xx | 서버 오류, 재시도 가능 |
| PRG | POST → Redirect(303) → GET, 중복 방지 |
| 307/308 | 메서드·본문 유지 리다이렉션 |
| 429 | 속도 제한, `Retry-After` |
| Problem Details | RFC 7807 표준 오류 포맷 |

{{< callout type="info" >}}
**용어 정리**
- **Status Code**: 요청 처리 결과를 알리는 3자리 코드
- **Reason Phrase**: 상태 코드의 사람 설명 (200 → OK)
- **Redirect**: `Location` 헤더로 다른 URL로 재요청
- **PRG 패턴**: Post/Redirect/Get, 중복 제출 방지
- **Conditional Request**: `If-*` 헤더로 조건부 응답
- **Idempotent Retry**: 멱등 메서드 위주의 안전한 재시도
- **Retry-After**: 재시도 대기 시간 (초 또는 HTTP 날짜)
- **Problem Details**: RFC 7807 표준 오류 응답 포맷
{{< /callout >}}
