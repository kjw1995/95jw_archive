---
title: "04. HTTP 상태 코드"
weight: 4
---

## 상태 코드란?

**상태 코드(Status Code)**는 클라이언트가 보낸 요청의 처리 상태를 응답에서 알려주는 **3자리 숫자**입니다.

```
HTTP/1.1 200 OK
         └┬┘ └┬┘
     상태코드  이유 문구
```

---

## 상태 코드 분류

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HTTP 상태 코드 분류                                 │
├─────────┬───────────────────────────────────────────────────────────────────┤
│   1xx   │ Informational - 요청이 수신되어 처리 중 (거의 사용 안함)          │
├─────────┼───────────────────────────────────────────────────────────────────┤
│   2xx   │ Successful - 요청 정상 처리                                       │
├─────────┼───────────────────────────────────────────────────────────────────┤
│   3xx   │ Redirection - 요청 완료를 위해 추가 행동 필요                     │
├─────────┼───────────────────────────────────────────────────────────────────┤
│   4xx   │ Client Error - 클라이언트 오류, 잘못된 요청                       │
├─────────┼───────────────────────────────────────────────────────────────────┤
│   5xx   │ Server Error - 서버 오류, 요청 처리 실패                          │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

**모르는 상태 코드**: 클라이언트는 인식할 수 없는 상태 코드를 상위 범주로 해석
- 299 → 2xx (성공)
- 451 → 4xx (클라이언트 오류)

---

## 2xx - 성공 (Successful)

요청이 성공적으로 처리되었습니다.

### 주요 2xx 상태 코드

| 코드 | 이름 | 설명 |
|------|------|------|
| **200** | OK | 요청 성공 |
| **201** | Created | 새로운 리소스 생성 |
| **202** | Accepted | 요청 접수됨 (처리 미완료) |
| **204** | No Content | 성공, 응답 본문 없음 |

### 200 OK

```http
GET /members/100 HTTP/1.1
Host: api.example.com
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 100,
  "name": "홍길동"
}
```

### 201 Created

```http
POST /members HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"name": "홍길동"}
```

```http
HTTP/1.1 201 Created
Location: /members/100      ← 생성된 리소스 URI
Content-Type: application/json

{
  "id": 100,
  "name": "홍길동"
}
```

### 202 Accepted

요청이 접수되었으나 **처리가 완료되지 않음** (배치 처리 등)

```java
@PostMapping("/batch/reports")
public ResponseEntity<Void> generateReport(@RequestBody ReportRequest request) {
    String jobId = batchService.submitJob(request);

    return ResponseEntity
        .accepted()
        .header("Location", "/batch/reports/" + jobId + "/status")
        .build();
}
```

### 204 No Content

성공했으나 **응답 본문에 보낼 데이터 없음** (저장 버튼 등)

```http
DELETE /members/100 HTTP/1.1
```

```http
HTTP/1.1 204 No Content
```

---

## 3xx - 리다이렉션 (Redirection)

요청을 완료하려면 **추가 행동이 필요**합니다. 웹 브라우저는 Location 헤더가 있으면 해당 URL로 자동 이동합니다.

### 리다이렉션 종류

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           리다이렉션 분류                                    │
├────────────────────┬────────────────────────────────────────────────────────┤
│  영구 리다이렉션   │  리소스 URI가 영구적으로 변경 (301, 308)              │
├────────────────────┼────────────────────────────────────────────────────────┤
│  일시 리다이렉션   │  일시적인 변경 (302, 303, 307)                        │
├────────────────────┼────────────────────────────────────────────────────────┤
│  특수 리다이렉션   │  캐시 활용 (304 Not Modified)                         │
└────────────────────┴────────────────────────────────────────────────────────┘
```

### 영구 리다이렉션 (301, 308)

리소스의 URI가 **영구적으로 이동**했습니다.

| 코드 | 이름 | 메서드 변경 |
|------|------|-------------|
| 301 | Moved Permanently | GET으로 변경될 수 있음 |
| 308 | Permanent Redirect | 메서드 유지 |

```http
HTTP/1.1 301 Moved Permanently
Location: /new-path/members
```

### 일시 리다이렉션 (302, 303, 307)

| 코드 | 이름 | 메서드 변경 |
|------|------|-------------|
| 302 | Found | GET으로 변경될 수 있음 (가장 많이 사용) |
| 303 | See Other | GET으로 변경 |
| 307 | Temporary Redirect | 메서드 유지 |

### PRG 패턴 (Post/Redirect/Get)

POST 후 새로고침으로 인한 **중복 주문 방지**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRG 패턴                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Client]                                        [Server]                   │
│     │                                               │                       │
│     │ ─── 1. POST /orders ────────────────────────→│                       │
│     │     { "item": "상품A", "quantity": 2 }       │                       │
│     │                                               │ 주문 생성             │
│     │ ←── 2. 302 Found ─────────────────────────── │                       │
│     │     Location: /orders/100/success            │                       │
│     │                                               │                       │
│     │ ─── 3. GET /orders/100/success ─────────────→│                       │
│     │                                               │                       │
│     │ ←── 4. 200 OK (주문 완료 페이지) ─────────── │                       │
│     │                                               │                       │
│     │     [새로고침해도 GET 요청만 재전송 = 안전!]  │                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@PostMapping("/orders")
public ResponseEntity<Void> createOrder(@RequestBody OrderRequest request) {
    Order order = orderService.create(request);

    return ResponseEntity
        .status(HttpStatus.FOUND)  // 302
        .location(URI.create("/orders/" + order.getId() + "/success"))
        .build();
}
```

### 304 Not Modified

캐시를 목적으로 사용됩니다. 리소스가 수정되지 않았음을 알려주어 **로컬 캐시를 재사용**하게 합니다.

```http
GET /image.png HTTP/1.1
If-None-Match: "abc123"
```

```http
HTTP/1.1 304 Not Modified
ETag: "abc123"
← 본문 없음 (캐시 재사용)
```

---

## 4xx - 클라이언트 오류 (Client Error)

클라이언트의 잘못된 요청으로 서버가 요청을 처리할 수 없습니다.
**재시도해도 실패** (요청 자체가 잘못됨)

### 주요 4xx 상태 코드

| 코드 | 이름 | 설명 |
|------|------|------|
| **400** | Bad Request | 잘못된 요청 구문, 유효성 검증 실패 |
| **401** | Unauthorized | 인증(Authentication) 필요 |
| **403** | Forbidden | 인가(Authorization) 실패, 접근 권한 없음 |
| **404** | Not Found | 리소스를 찾을 수 없음 |
| **405** | Method Not Allowed | 허용되지 않은 HTTP 메서드 |
| **409** | Conflict | 리소스 충돌 |

### 400 Bad Request

```java
@PostMapping("/members")
public ResponseEntity<?> createMember(@RequestBody @Valid MemberRequest request,
                                       BindingResult bindingResult) {
    if (bindingResult.hasErrors()) {
        return ResponseEntity
            .badRequest()
            .body(new ErrorResponse("잘못된 요청입니다", bindingResult.getAllErrors()));
    }
    // ...
}
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "status": 400,
  "message": "잘못된 요청입니다",
  "errors": [
    {"field": "email", "message": "이메일 형식이 올바르지 않습니다"}
  ]
}
```

### 401 Unauthorized vs 403 Forbidden

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      401 vs 403                                              │
├──────────────────────────────────┬──────────────────────────────────────────┤
│         401 Unauthorized         │          403 Forbidden                   │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  "당신이 누구인지 모르겠어요"    │  "당신이 누군지 알지만 권한이 없어요"    │
│                                  │                                          │
│  - 인증(Authentication) 필요     │  - 인가(Authorization) 거부              │
│  - 로그인이 필요한 상황          │  - 로그인은 했으나 권한 부족             │
│  - WWW-Authenticate 헤더 포함    │                                          │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

```java
// 401 - 인증 실패
@ExceptionHandler(AuthenticationException.class)
public ResponseEntity<ErrorResponse> handleAuth(AuthenticationException e) {
    return ResponseEntity
        .status(HttpStatus.UNAUTHORIZED)
        .header("WWW-Authenticate", "Bearer")
        .body(new ErrorResponse(401, "인증이 필요합니다"));
}

// 403 - 권한 없음
@ExceptionHandler(AccessDeniedException.class)
public ResponseEntity<ErrorResponse> handleAccess(AccessDeniedException e) {
    return ResponseEntity
        .status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse(403, "접근 권한이 없습니다"));
}
```

### 404 Not Found

```java
@GetMapping("/{id}")
public ResponseEntity<Member> getMember(@PathVariable Long id) {
    return memberService.findById(id)
        .map(ResponseEntity::ok)
        .orElseThrow(() -> new ResourceNotFoundException("회원을 찾을 수 없습니다: " + id));
}

@ExceptionHandler(ResourceNotFoundException.class)
public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException e) {
    return ResponseEntity
        .status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse(404, e.getMessage()));
}
```

---

## 5xx - 서버 오류 (Server Error)

서버 문제로 요청을 처리할 수 없습니다.
**재시도하면 성공할 수도 있음**

### 주요 5xx 상태 코드

| 코드 | 이름 | 설명 |
|------|------|------|
| **500** | Internal Server Error | 서버 내부 오류 (애매한 경우 사용) |
| **502** | Bad Gateway | 게이트웨이가 잘못된 응답 수신 |
| **503** | Service Unavailable | 서비스 이용 불가 (일시적 과부하/점검) |
| **504** | Gateway Timeout | 게이트웨이 타임아웃 |

### 500 Internal Server Error

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleException(Exception e) {
    log.error("서버 오류 발생", e);

    return ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse(500, "서버 내부 오류가 발생했습니다"));
}
```

### 503 Service Unavailable

```java
@GetMapping("/status")
public ResponseEntity<?> checkStatus() {
    if (isUnderMaintenance()) {
        return ResponseEntity
            .status(HttpStatus.SERVICE_UNAVAILABLE)
            .header("Retry-After", "3600")  // 1시간 후 재시도
            .body(new ErrorResponse(503, "서버 점검 중입니다"));
    }
    return ResponseEntity.ok("OK");
}
```

---

## Spring Boot 글로벌 예외 처리

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 400 - 유효성 검증 실패
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        List<FieldError> errors = e.getBindingResult().getFieldErrors()
            .stream()
            .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
            .toList();

        return ResponseEntity
            .badRequest()
            .body(new ErrorResponse(400, "입력값이 올바르지 않습니다", errors));
    }

    // 404 - 리소스 없음
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse(404, e.getMessage()));
    }

    // 409 - 충돌
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException e) {
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(new ErrorResponse(409, e.getMessage()));
    }

    // 500 - 서버 오류 (catch-all)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unhandled exception", e);

        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse(500, "서버 오류가 발생했습니다"));
    }
}

record ErrorResponse(int status, String message, List<FieldError> errors) {
    public ErrorResponse(int status, String message) {
        this(status, message, null);
    }
}

record FieldError(String field, String message) {}
```

---

## 상태 코드 선택 가이드

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         상태 코드 선택 가이드                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  요청 성공?                                                                 │
│     ├─ YES ── 데이터 반환?                                                  │
│     │           ├─ YES → 200 OK                                             │
│     │           └─ NO ── 리소스 생성?                                       │
│     │                      ├─ YES → 201 Created                             │
│     │                      └─ NO  → 204 No Content                          │
│     │                                                                       │
│     └─ NO ─── 누구 잘못?                                                    │
│                 ├─ 클라이언트 ── 인증 문제?                                  │
│                 │                  ├─ 로그인 필요 → 401 Unauthorized         │
│                 │                  └─ 권한 없음  → 403 Forbidden             │
│                 │               리소스 없음? → 404 Not Found                 │
│                 │               잘못된 요청? → 400 Bad Request               │
│                 │                                                           │
│                 └─ 서버 ─────── 일시적? → 503 Service Unavailable           │
│                                 기타   → 500 Internal Server Error          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **200 OK** | 요청 성공 |
| **201 Created** | 리소스 생성 성공 |
| **204 No Content** | 성공, 응답 본문 없음 |
| **301/308** | 영구 리다이렉션 |
| **302/303/307** | 일시 리다이렉션 |
| **304 Not Modified** | 캐시 재사용 |
| **400 Bad Request** | 잘못된 요청 |
| **401 Unauthorized** | 인증 필요 |
| **403 Forbidden** | 권한 없음 |
| **404 Not Found** | 리소스 없음 |
| **500 Internal Server Error** | 서버 내부 오류 |
| **503 Service Unavailable** | 서비스 일시 불가 |
| **PRG 패턴** | Post/Redirect/Get으로 중복 요청 방지 |
