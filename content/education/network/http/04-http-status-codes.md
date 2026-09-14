---
title: "04. HTTP 상태 코드"
date: 2025-12-27
weight: 4
---

[02. HTTP 기본](../02-http-basics)에서 응답의 첫 줄은 버전, 상태 코드, 이유 문구이고 프로그램은 숫자 하나로 분기한다고 했다. [03. HTTP 메서드](../03-http-methods)에서는 요청의 첫 단어가 성질을 말한다고 했다. 이 장은 응답의 첫 숫자다. 원리는 셋이다. 첫째, **첫 자리가 뜻이고 나머지 두 자리는 세부다.** 2면 됐고, 3이면 다른 데로, 4면 네 잘못, 5면 내 잘못. 모르는 코드는 그 백 번대의 00으로 읽으라는 규칙 덕에 새 코드가 생겨도 옛 클라이언트가 깨지지 않는다. 둘째, **코드는 결과 보고가 아니라 다음 행동의 지시다.** 301은 "저기로 가라", 304는 "가진 것을 써라", 429는 "기다렸다 다시", 503도 "나중에 다시"다. 03장의 멱등이 "다시 보내도 되는가"를 정했다면, 코드는 "다시 보내야 하는가"를 정한다. 셋째, **잘못이 누구 것인지를 코드가 가른다.** 4xx는 요청을 고치기 전에는 몇 번을 보내도 실패하고, 5xx는 요청은 옳으니 서버가 나으면 된다. 이 구분이 재시도와 모니터링과 책임의 기준이라, 서버는 예외를 올바른 코드로 번역할 의무가 있다. 이 PC에서 example.com, GitHub, 그리고 이 블로그 자신에게 받은 코드들을 실었다.

---

## 1. 상태 코드의 개념

```text
HTTP/1.1 200 OK
         └┬┘ └┬┘
      상태코드  이유 문구 (부가 설명)
```

| 부분 | 누구를 위한 것 | 왜 |
|:-----|:-------------|:---|
| 상태 코드 | 프로그램 | 세 자리 숫자 하나로 분기한다 |
| 이유 문구 | 사람 | 서버 마음대로다. HTTP/2는 아예 없앴다 |

서버가 요청을 어떻게 처리했는지를 세 자리 숫자로 말한다. 이유 문구는 그 옆의 사람용 설명일 뿐이라 서버마다 다르다. [03](../03-http-methods)장에서 example.com이 TRACE에는 `405 Not Allowed`, 다른 메서드에는 `405 Method Not Allowed`로 답한 것이 그 예다. 프로그램은 405만 읽는다.

---

## 2. 상태 코드 분류

| 범주 | 이름 | 뜻 | 클라이언트가 할 일 |
|:-----|:-----|:---|:-----------------|
| 1xx | Informational | 받았다, 아직 처리 중 | 계속 기다린다 |
| 2xx | Successful | 됐다 | 본문을 쓴다 |
| 3xx | Redirection | 다른 데로, 또는 가진 것을 | Location으로 가거나 캐시를 쓴다 |
| 4xx | Client Error | 네 잘못 | 요청을 고친다. 그대로는 몇 번을 보내도 같다 |
| 5xx | Server Error | 내 잘못 | 나중에 다시. 요청은 옳다 |

첫째 원리의 표다. 첫 자리만으로 "무엇을 해야 하는가"가 정해지고, 뒤의 두 자리는 그 안의 세부다.

{{< callout type="info" >}}
모르는 코드를 받으면 클라이언트는 **그 백 번대의 00**으로 읽어야 한다(RFC 9110). 299를 받으면 200처럼, 452를 받으면 400처럼. 그래서 서버가 새 코드나 자기만의 코드를 써도 옛 클라이언트는 성공인지 실패인지 정도는 안다. 첫 자리에 뜻을 둔 설계의 값이다.
{{< /callout >}}

---

## 3. 1xx - 정보

| 코드 | 이름 | 뜻 | 왜 있나 |
|:-----|:-----|:---|:-------|
| 100 | Continue | 본문을 보내도 된다 | 큰 본문을 보내기 전에 거절당할지 먼저 묻는다 |
| 101 | Switching Protocols | 다른 규칙으로 바꾼다 | 같은 연결을 WebSocket 등으로 이어 쓴다 |
| 103 | Early Hints | 본문보다 먼저 힌트 | 서버가 생각하는 동안 브라우저가 CSS를 미리 받게 |

```http
POST / HTTP/1.1
Host: example.com
Expect: 100-continue
Content-Length: 3

```

```http
HTTP/1.1 100 Continue

HTTP/1.1 405 Method Not Allowed
```

1xx는 최종 답이 아니라 **중간 보고**다. 이 PC에서 curl로 `Expect: 100-continue`를 붙여 example.com에 POST를 보내면 서버가 먼저 `100 Continue`로 "본문을 보내라"고 하고, 본문을 받은 뒤 최종 답인 405를 준다. 본문이 수백 MB인 업로드라면 거절당할 요청에 본문부터 보내는 낭비를 100으로 막는다. curl은 큰 본문이면 이 헤더를 스스로 붙인다.

같은 PC에서 echo.websocket.org에 `Connection: Upgrade`, `Upgrade: websocket`과 키를 붙여 GET을 보내면 `101 Switching Protocols`와 `Sec-WebSocket-Accept`가 온다. 그 순간부터 그 TCP 연결은 HTTP가 아니라 WebSocket의 것이 되고, 요청과 응답의 쌍이 아니라 양쪽이 아무 때나 말하는 대화가 된다. 1xx가 "거의 안 쓰인다"고들 하지만 업로드와 WebSocket과 Early Hints가 전부 여기 있다.

---

## 4. 2xx - 성공

| 코드 | 이름 | 뜻 | 왜 따로 있나 |
|:-----|:-----|:---|:-----------|
| 200 | OK | 됐고, 본문이 답이다 | 가장 흔한 답 |
| 201 | Created | 만들었다. 주소는 `Location` | 새 자원의 주소를 알려야 한다 |
| 202 | Accepted | 받아만 뒀다 | 오래 걸리는 일은 나중에 확인하라고 |
| 204 | No Content | 됐고, 줄 것은 없다 | 본문을 기다리지 말라고 |
| 206 | Partial Content | 일부만 준다 | 범위 요청의 답 |

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

200과 201의 차이는 본문이 아니라 **주소**다. [03](../03-http-methods)장의 컬렉션 패턴에서 주소를 서버가 정하므로, 만든 뒤 그 주소를 `Location`으로 돌려주지 않으면 클라이언트는 방금 만든 것을 다시 찾을 수 없다.

### 202 Accepted (비동기 작업)

```java
@PostMapping("/reports")
public ResponseEntity<Void> submit(
        @RequestBody
        ReportRequest req) {
    String jobId = batch.submit(req);
    return ResponseEntity.accepted()
        .header("Location",
            "/reports/" + jobId)
        .build();
}
```

202는 "일은 받았고 결과는 아직"이다. 보고서 생성처럼 몇 분 걸리는 일에 연결을 붙들고 기다리게 하는 대신, 확인할 주소를 주고 바로 끊는다. 둘째 원리의 예다. 클라이언트가 할 일은 그 주소를 나중에 GET하는 것이다.

### 204 No Content

```http
HTTP/1.1 204 No Content
```

DELETE의 답이 대표다. 성공했고 돌려줄 것이 없다. 200에 빈 본문을 주는 것과 다른 점은 클라이언트가 본문을 읽으려 하지 않는다는 것이고, 브라우저는 204를 받으면 현재 페이지를 그대로 둔다.

### 206 Partial Content (Range 요청)

```http
GET / HTTP/1.1
Host: example.com
Range: bytes=0-99
```

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-99/559
Content-Length: 100
```

이 PC에서 example.com에 앞 100바이트만 달라고 하면 206과 함께 "559 중 0~99"라는 `Content-Range`가 온다. 영상을 중간부터 재생하고, 끊긴 내려받기를 이어받는 것이 전부 이 답이다. 서버가 범위를 받는지는 `Accept-Ranges: bytes`로 미리 알린다.

---

## 5. 3xx - 리다이렉션

```text
영구: 301, 308   자원의 주소가 바뀌었다
일시: 302, 303, 307   이번만 저기로
특수: 304   가진 것을 그대로 써라
```

| 코드 | 뜻 | 메서드·본문 | 왜 |
|:-----|:---|:-----------|:---|
| 301 | 영구 이동 | GET으로 바꿀 수 있다 | 옛 브라우저들이 그렇게 했고 규격이 인정했다 |
| 302 | 일시 이동 | GET으로 바꿀 수 있다 | 301과 같은 사정 |
| 303 | See Other | **반드시 GET** | "결과는 저기서 GET으로 보라" |
| 307 | Temporary | **그대로** | 302의 뜻을 정확히 하려고 새로 만들었다 |
| 308 | Permanent | **그대로** | 301의 정확한 판 |

둘째 원리가 가장 잘 보이는 범주다. 답이 "여기 없다"가 아니라 "저기로 가라"이고, 브라우저는 `Location`의 주소로 스스로 다시 요청한다. 이 PC에서 이 블로그를 끝의 슬래시 없이 `/95jw_archive`로 물으면 GitHub Pages가 `301 Moved Permanently`와 슬래시 붙은 주소를 주고, `http://`로 물으면 역시 301로 `https://`를 준다. 브라우저 주소창에 아무렇게나 쳐도 제자리를 찾는 것이 이 답들 덕이다. 영구와 일시의 차이는 **기억해도 되는가**다. 301은 브라우저와 검색 엔진이 새 주소를 기억하고 다음부터 바로 가지만, 302는 매번 옛 주소로 다시 묻는다.

{{< callout type="warning" >}}
POST를 301이나 302로 돌리면 브라우저가 GET으로 바꿔 다시 보내므로 **본문이 사라진다.** 폼이나 결제 요청을 다른 주소로 넘겨야 하면 메서드와 본문을 그대로 두는 307이나 308을 쓴다. 반대로 "처리는 끝났으니 결과 페이지를 GET으로 보라"가 뜻이면 303이 맞다.
{{< /callout >}}

### PRG 패턴 (Post/Redirect/Get)

```text
Client                      Server
  │─ POST /orders ─────────→│
  │                         │ 주문 생성
  │←─ 303 See Other ────────│
  │  Location: /orders/100  │
  │─ GET /orders/100 ──────→│
  │←─ 200 OK (주문 상세) ────│
  (새로고침해도 GET만 다시 간다)
```

```java
@PostMapping("/orders")
public ResponseEntity<Void> create(
        @RequestBody OrderRequest req) {
    Order o = orders.create(req);
    URI loc = URI.create(
        "/orders/" + o.id());
    return ResponseEntity
        .status(HttpStatus.SEE_OTHER)
        .location(loc).build();
}
```

POST의 답으로 결과 페이지를 바로 주면 사용자가 새로고침할 때 브라우저는 마지막 요청, 곧 POST를 다시 보낸다. [03](../03-http-methods)장에서 본 대로 POST는 멱등이 아니라 주문이 둘이 된다. 답을 303으로 주면 브라우저의 마지막 요청은 결과 페이지의 GET이 되고, 새로고침은 GET만 반복한다. 실무에서는 302로도 많이 쓰는데 브라우저가 POST를 GET으로 바꿔 주기 때문이고, 뜻이 정확한 것은 303이다.

### 304 Not Modified

```http
GET /95jw_archive/ HTTP/1.1
Host: kjw1995.github.io
If-None-Match: "6aa78a80-33f84"
```

```http
HTTP/1.1 304 Not Modified
ETag: "6aa78a80-33f84"
```

이 PC에서 이 블로그의 첫 페이지를 받으면 `ETag: "6aa78a80-33f84"`가 따라온다. 그 값을 `If-None-Match`에 실어 다시 물으면 서버는 본문 없이 304만 준다. 212KB짜리 페이지가 한 줄로 끝난다. "가진 것을 써라"는 지시이고, 네트워크 [29](../../29-web-server-structure)장에서 example.com에 `If-Modified-Since`로 같은 답을 받았다. 조건부 요청의 규칙은 [05](../05-http-headers)장 10절에서 본다.

---

## 6. 4xx - 클라이언트 오류

| 코드 | 이름 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| 400 | Bad Request | 요청이 잘못됐다 | 구문, 유효성. 02장에서 Host 없이 보내 받았다 |
| 401 | Unauthorized | 누군지 모른다 | 이름과 달리 "인증"이 없다는 뜻 |
| 403 | Forbidden | 알지만 안 된다 | 로그인해도 소용없다 |
| 404 | Not Found | 그런 자원이 없다 | 없는지 감추는지 서버가 고른다 |
| 405 | Method Not Allowed | 그 메서드는 안 받는다 | 03장. `Allow`가 같이 온다 |
| 409 | Conflict | 자원의 상태와 어긋난다 | 남이 먼저 고쳤다, 이미 있다 |
| 410 | Gone | 있었는데 영영 없다 | 404와 달리 다시 오지 말라고 |
| 415 | Unsupported Media Type | 그 형식은 못 읽는다 | `Content-Type`이 낯설다 |
| 422 | Unprocessable Content | 문법은 맞는데 뜻이 틀렸다 | JSON은 맞지만 값이 규칙에 어긋난다 |
| 429 | Too Many Requests | 너무 자주 보낸다 | 서버를 지키려고. `Retry-After` |

셋째 원리의 절반이다. 요청 자체가 틀렸으므로 **같은 요청을 다시 보내면 같은 답**이 온다. 재시도할 것이 아니라 고칠 것이다. 이 PC에서 GitHub API의 `/user`를 토큰 없이 물으면 401, 이 블로그의 없는 주소를 물으면 404, [02](../02-http-basics)장에서 Host 없이 보낸 요청에는 400, [03](../03-http-methods)장에서 example.com에 보낸 POST에는 405가 왔다. 넷 다 요청을 고치지 않으면 몇 번을 보내도 그대로다.

### 401 vs 403

| | 401 Unauthorized | 403 Forbidden |
|:--|:----------------|:--------------|
| 서버의 말 | "당신이 누군지 모른다" | "누군지 알지만 권한이 없다" |
| 다음 행동 | 로그인, 토큰 붙이기 | 권한을 얻기 전엔 소용없다 |
| 함께 오는 것 | `WWW-Authenticate` | 없음 |

```java
@ExceptionHandler(
    AuthenticationException.class)
ResponseEntity<ProblemDetail> unauth() {
    var p = ProblemDetail
        .forStatus(401);
    return ResponseEntity.status(401)
        .header("WWW-Authenticate",
            "Bearer")
        .body(p);
}
```

401의 이름이 Unauthorized라 권한 문제처럼 읽히지만 뜻은 "인증되지 않음"이다. 401에는 어떤 방식으로 인증하라는 `WWW-Authenticate`가 따라와야 하고, 403은 인증이 됐는데도 안 된다는 답이라 그 헤더가 없다. 둘째 원리대로 코드가 다음 행동을 가른다. 401이면 로그인 창을 띄우고, 403이면 띄워 봐야 소용없다.

### 409 Conflict

```java
@PutMapping("/{id}")
public Member update(
        @PathVariable Long id,
        @RequestBody
        MemberRequest req) {
    return members.update(id, req);
    // 낙관적 락 실패는 8절에서 409로
}
```

요청은 문법도 뜻도 맞는데 **자원의 지금 상태**와 어긋날 때다. 두 사람이 같은 회원을 동시에 고쳐 뒤의 저장이 낙관적 락에 걸리거나, 이미 있는 아이디로 가입하려 할 때. 400이 아닌 이유는 요청이 틀린 게 아니라 타이밍이 틀렸기 때문이고, 클라이언트가 할 일은 최신 상태를 다시 읽고 다시 보내는 것이다.

### 429 Too Many Requests

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1789370818
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

이 PC에서 GitHub API를 토큰 없이 부르면 200 응답에도 "한 시간에 60번, 58번 남음, 언제 초기화"가 헤더로 따라온다. 그 수가 0이 된 뒤의 답이 429다. 이름은 클라이언트 오류지만 사정은 다르다. 요청을 고칠 것이 아니라 **기다릴** 것이라서 `Retry-After`가 온다.

{{< callout type="info" >}}
`Retry-After`는 초 단위 숫자 또는 HTTP 날짜다. 클라이언트는 그만큼 기다린 뒤 다시 보내고, 값이 없으면 지수 백오프로 간격을 늘려 간다. `X-RateLimit-*` 헤더는 표준이 아니라 관례이고, IETF가 `RateLimit` 헤더로 표준화하고 있다.
{{< /callout >}}

---

## 7. 5xx - 서버 오류

| 코드 | 이름 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| 500 | Internal Server Error | 서버가 터졌다 | 잡히지 않은 예외. 원인을 밖에 말하지 않는다 |
| 502 | Bad Gateway | 뒤의 서버가 이상한 답을 줬다 | 프록시가 업스트림 대신 사과한다 |
| 503 | Service Unavailable | 지금은 못 한다 | 과부하, 점검. `Retry-After` |
| 504 | Gateway Timeout | 뒤의 서버가 답이 없다 | 프록시가 기다리다 포기했다 |

셋째 원리의 나머지 절반이다. 요청은 옳고 서버가 문제이므로 **나중에 다시 보내면 될 수 있다.** 다만 아무 요청이나 다시 보내면 안 된다. 500이 난 POST가 실제로는 처리된 뒤에 터졌을 수 있으므로, 재시도는 [03](../03-http-methods)장의 멱등한 요청이거나 Idempotency-Key가 있을 때만 한다. 502와 504는 프록시나 부하 분산기가 뒤의 서버 대신 답하는 코드라, 이 둘이 보이면 문제는 프록시가 아니라 그 뒤에 있다.

```java
@GetMapping("/health")
public ResponseEntity<String> health() {
    if (maintenance) {
        return ResponseEntity
            .status(503)
            .header("Retry-After",
                "3600")
            .body("점검 중");
    }
    return ResponseEntity.ok("OK");
}
```

503에 `Retry-After`를 주면 부하 분산기와 클라이언트가 그 시간 동안 두드리지 않는다. 점검 중에 500을 내는 것과 503을 내는 것의 차이가 여기 있다. 500은 "고장"이고 503은 "잠시 닫음"이라, 모니터링이 다르게 센다.

---

## 8. Spring Boot 글로벌 예외 처리

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(
        BindException.class)
    ProblemDetail invalid(
            BindException e) {
        var p = ProblemDetail
            .forStatus(400);
        p.setTitle("입력값 오류");
        p.setDetail(e.getFieldErrors()
            .stream()
            .map(f -> f.getField() + " "
                + f.getDefaultMessage())
            .collect(joining(", ")));
        return p;
    }

    @ExceptionHandler(
        NotFoundException.class)
    ProblemDetail notFound(
            NotFoundException e) {
        return ProblemDetail
            .forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                e.getMessage());
    }

    @ExceptionHandler(
        ConflictException.class)
    ProblemDetail conflict(
            ConflictException e) {
        return ProblemDetail
            .forStatusAndDetail(
                HttpStatus.CONFLICT,
                e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail fallback(
            Exception e) {
        log.error("Unhandled", e);
        return ProblemDetail
            .forStatus(500);
    }
}
```

셋째 원리를 코드로 옮긴 것이다. 예외의 종류가 곧 잘못의 주인이다. 검증 실패는 클라이언트의 400, 없는 자원은 404, 상태 충돌은 409, 그 밖의 모든 예외는 서버의 500. 마지막 핸들러가 중요하다. 잡히지 않은 예외를 그냥 두면 프레임워크가 500을 내긴 하지만 스택 트레이스가 새거나 본문 형식이 제각각이 된다. 500의 본문에 원인을 적지 않는 것도 의도다. 클라이언트가 고칠 수 있는 것이 없고, 내부 사정은 로그에만 남긴다.

### Problem Details (RFC 9457)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "/errors/validation",
  "title": "입력값 오류",
  "status": 400,
  "detail": "email 형식이 아니다",
  "instance": "/api/members"
}
```

오류 본문의 표준 형식이다. 2016년의 RFC 7807을 2023년 RFC 9457이 다듬었고, Spring 6부터 `ProblemDetail`로 기본 제공한다. 상태 코드가 "무엇이 잘못됐는가의 종류"라면 이 본문은 "정확히 무엇이, 어디서"다. 형식이 정해져 있으면 클라이언트가 서버마다 다른 오류 JSON을 파싱하는 코드를 안 짜도 된다. `Content-Type`이 `application/problem+json`인 것으로 이 형식임을 안다.

---

## 9. 상태 코드 선택 가이드

```text
성공했나?
├ 예 ─ 본문 있음 ─────── 200
│      새로 만듦 ─────── 201
│      받기만 함(비동기) ─ 202
│      돌려줄 것 없음 ──── 204
└ 아니오 ─ 누구 탓?
   ├ 클라이언트
   │  ├ 누군지 모름 ───── 401
   │  ├ 알지만 권한 없음 ── 403
   │  ├ 그런 자원 없음 ─── 404
   │  ├ 상태가 어긋남 ──── 409
   │  ├ 너무 자주 ─────── 429
   │  └ 그 밖의 잘못 ───── 400
   └ 서버
      ├ 잠시 못 함 ────── 503
      └ 그 밖 ────────── 500
```

세 원리를 순서대로 묻는 것이다. 됐는가(첫 자리), 클라이언트가 다음에 무엇을 해야 하는가(둘째 원리), 잘못이 누구 것인가(셋째 원리). 이 순서로 고르면 "그냥 200에 `{"success": false}`"나 "모든 오류를 500으로" 같은, 코드의 뜻을 버리는 설계를 피하게 된다. 그런 서버 앞에서는 프록시도 캐시도 브라우저도 03장의 약속에 기댈 수 없다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 첫 자리 | 1 중간, 2 됐다, 3 저기로, 4 네 탓, 5 내 탓 | 모르는 코드는 x00으로 읽는다 |
| 이유 문구 | 사람용 | 서버마다 다르다. HTTP/2는 없앴다 |
| 100 / 101 | 본문을 보내라 / 규칙을 바꾼다 | 큰 업로드, WebSocket |
| 200 / 201 / 204 | 됐다 / 만들었다, 주소는 Location / 줄 것 없다 | 컬렉션 패턴은 주소를 알려야 |
| 202 | 받아만 뒀다 | 오래 걸리는 일은 나중에 확인 |
| 206 | 일부만 | 이어받기, 영상 탐색 |
| 301 / 302 | 저기로. 기억해도 된다 / 이번만 | 검색 엔진과 브라우저가 다르게 기억 |
| 303 / 307 / 308 | 반드시 GET / 그대로 / 그대로, 영구 | 본문 유실을 막는다 |
| PRG | POST → 303 → GET | 새로고침이 POST를 반복하지 않게 |
| 304 | 가진 것을 써라 | 이 블로그 212KB가 한 줄로 |
| 4xx | 고쳐라. 다시 보내도 같다 | 401은 누군지 모름, 403은 권한 없음 |
| 429 / 503 | 기다렸다 다시 | `Retry-After` |
| 5xx | 서버가 낫기를 기다려라 | 재시도는 멱등한 요청만 |
| Problem Details | 오류 본문의 표준 형식 | RFC 9457, `application/problem+json` |

{{< callout type="info" >}}
**용어 정리**
- **Status Code**: 처리 결과를 알리는 세 자리 숫자. 첫 자리가 범주
- **Reason Phrase**: 코드 옆의 사람용 문구. 프로그램은 읽지 않는다
- **Redirect**: `Location`의 주소로 클라이언트가 스스로 다시 요청하는 것
- **PRG 패턴**: Post 뒤에 Redirect로 Get을 시켜 새로고침의 중복 제출을 막는 것
- **ETag / If-None-Match**: 자원의 판 번호 / 그 판이면 본문 없이 304를 달라는 조건
- **Retry-After**: 다시 보내기 전에 기다릴 초 또는 날짜
- **WWW-Authenticate**: 401에 실려 오는 인증 방식 안내
- **Idempotent Retry**: 멱등한 요청만 다시 보내는 안전한 재시도
- **Problem Details**: RFC 9457의 표준 오류 본문. `application/problem+json`
{{< /callout >}}
