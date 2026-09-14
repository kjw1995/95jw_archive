---
title: "05. HTTP 헤더와 캐시"
date: 2025-12-27
weight: 5
---

[02. HTTP 기본](../02-http-basics)에서 헤더는 시작 줄의 "무엇"에 붙는 부가 정보이고, 이름은 대소문자를 가리지 않으며, 모르는 것은 무시하면 되니 30년간 규격을 안 바꾸고 기능을 더해 왔다고 했다. 이 장은 그 헤더들이 실제로 무슨 일을 하는지이고, 시리즈의 마지막 장이다. 원리는 셋이다. 첫째, **헤더는 본문의 이름표이자 협상의 언어다.** 같은 자원이 JSON으로도 XML로도, 한국어로도 영어로도, 압축해서도 그냥도 올 수 있다. 클라이언트가 `Accept-*`로 바라는 것을 말하면 서버가 `Content-*`로 고른 것을 말한다. 둘째, **무상태의 상태는 쿠키가 든다.** 서버는 기억하지 않으므로 기억할 것을 브라우저에 맡기고, 브라우저는 요청마다 그것을 도로 실어 보낸다. 그래서 쿠키의 속성이 곧 보안이다. 셋째, **가장 빠른 요청은 보내지 않는 요청이다.** 캐시는 답을 저장해 두고 다시 쓰는 것이고, 헤더는 얼마나 오래 써도 되는지(`Cache-Control`), 아직 유효한지 어떻게 묻는지(`ETag`), 무엇을 기준으로 저장하는지(`Vary`)를 정한다. 이 PC에서 이 블로그와 example.com과 GitHub에게 받은 헤더를 그대로 실었다.

---

## 1. 헤더의 개념

```text
field-name: field-value
```

| 규칙 | 내용 | 왜 |
|:-----|:-----|:---|
| 이름은 대소문자 구별 없음 | `Content-Type` = `content-type` | HTTP/2는 소문자로만 보낸다 |
| 값 앞뒤 공백 무시 | `Host:example.com`도 된다 | 손으로 치던 규칙의 관용 |
| 마음대로 만들어도 된다 | GitHub의 `X-RateLimit-Limit` | 모르는 헤더는 무시된다. `X-` 접두는 2012년에 권장을 거뒀다(RFC 6648) |

| 분류 | 대표 헤더 | 하는 일 |
|:-----|:---------|:-------|
| 표현 | Content-Type, Content-Encoding | 본문이 무엇인지 |
| 협상 | Accept, Accept-Language | 무엇을 바라는지 |
| 일반 정보 | User-Agent, Referer, Server, Date | 누가, 어디서, 언제 |
| 특수 정보 | Host, Location, Allow, Retry-After | 앞 장들에서 본 것들 |
| 인증 | Authorization, WWW-Authenticate | 누구인지 |
| 쿠키 | Cookie, Set-Cookie | 기억할 것 |
| 캐시 | Cache-Control, ETag, Last-Modified | 얼마나, 어떻게 다시 쓸지 |
| CORS | Origin, Access-Control-* | 브라우저의 출처 검사 |

이 장은 이 표를 위에서 아래로 내려간다. 첫째 원리가 표현과 협상, 둘째가 쿠키, 셋째가 캐시다.

---

## 2. 표현 헤더

| 헤더 | 뜻 | 이 PC에서 본 값 | 왜 |
|:-----|:---|:--------------|:---|
| Content-Type | 본문의 종류 | `text/html; charset=utf-8` | 받는 쪽이 파서를 고른다 |
| Content-Encoding | 본문의 압축 | `gzip` | 글자는 잘 줄어든다 |
| Content-Language | 본문의 언어 | | 같은 문서의 한국어 판, 영어 판 |
| Content-Length | 본문의 바이트 수 | `559` | 어디까지가 이 메시지인지 |

```http
Content-Type: text/html; charset=UTF-8
Content-Type: application/json
Content-Type: multipart/form-data
Content-Encoding: gzip
Content-Language: ko
```

첫째 원리의 절반이다. 자원(resource)은 `/members/100`이라는 하나의 것이고, 표현(representation)은 그것을 지금 이 메시지에 실어 보낸 구체적인 모양이다. 2014년 RFC 7231부터 "엔티티"라는 말을 버리고 이 개념을 썼고, 지금은 RFC 9110이다. 이 블로그의 첫 페이지는 212,868바이트인데 `Accept-Encoding: gzip`을 붙여 받으면 16,408바이트가 온다. 열세 배 작다. 같은 자원의 다른 표현이고, 응답은 `Content-Encoding: gzip`으로 "이것은 압축한 표현"임을 말한다. 파일 업로드의 `multipart/form-data`는 여기에 `boundary=` 값을 붙여 파일과 글자를 나누는 경계선을 알린다.

---

## 3. 협상 (Content Negotiation)

| 요청이 바라는 것 | 응답이 고른 것 | 왜 짝인가 |
|:---------------|:-------------|:---------|
| Accept | Content-Type | 형식 |
| Accept-Encoding | Content-Encoding | 압축 |
| Accept-Language | Content-Language | 언어 |
| Accept-Charset | (Content-Type의 charset) | UTF-8이 표준이 되어 폐기됐다 |

첫째 원리의 나머지 절반이다. 클라이언트가 "이런 것들을 읽을 수 있고 이 순서로 좋다"고 말하면 서버가 가진 표현 중에서 고른다.

### Quality Values (q)

```http
Accept-Language: ko-KR,ko;q=0.9,en;q=0.7
```

바람의 순서는 0에서 1 사이의 q값이고, 생략하면 1이다. 위 줄은 ko-KR, ko, en 순서다. 이 PC에서 MDN 문서 사이트에 `Accept-Language: ko`를 붙여 첫 페이지를 부르면 `302 Found`와 `Location: /ko/`가 오고, `ja`면 `/ja/`, `en;q=0.5, ko`면 en보다 q가 높은 ko를 골라 `/ko/`로 보낸다. 브라우저의 언어 설정이 이 헤더가 되어 나가므로, 같은 주소를 쳐도 사람마다 다른 언어의 페이지를 보는 것이다.

```java
@GetMapping(value = "/members/{id}",
    produces = {
        "application/json",
        "application/xml"
    })
public Member get(
        @PathVariable Long id) {
    return members.get(id);
}
```

`produces`가 서버가 가진 표현의 목록이다. 요청의 `Accept`와 맞춰 Spring이 JSON 변환기와 XML 변환기 중 하나를 고르고, 어느 쪽도 못 맞추면 406 Not Acceptable로 답한다.

---

## 4. 일반 정보 헤더

| 헤더 | 방향 | 뜻 | 이 PC에서 본 값 |
|:-----|:-----|:---|:--------------|
| From | 요청 | 사용자 이메일 | 검색 봇이 붙인다. 브라우저는 안 보낸다 |
| Referer | 요청 | 어느 페이지에서 왔나 | 유입 경로 통계의 근거 |
| User-Agent | 요청 | 어떤 프로그램인가 | `curl/8.18.0` |
| Server | 응답 | 어떤 서버인가 | `cloudflare`, `GitHub.com` |
| Date | 응답 | 만든 시각 | `Mon, 14 Sep 2026 04:34:51 GMT` |
| Via | 응답 | 거쳐 온 프록시 | `1.1 varnish` |

{{< callout type="warning" >}}
`Referer`는 **오타가 표준**이다. 1990년대 규격에 Referrer를 잘못 적은 채 굳었고, 고치면 세상의 모든 서버가 깨지므로 헤더 이름은 지금도 `Referer`다. 같은 뜻의 새 정책 헤더 `Referrer-Policy`는 바르게 적는다.
{{< /callout >}}

이 블로그의 응답에 붙어 온 `Via: 1.1 varnish`와 `X-Served-By: cache-icn…`은 GitHub Pages가 CDN(Fastly)을 거쳐 인천의 캐시 서버에서 답했다는 뜻이다. 12절의 프록시 캐시가 헤더에 남긴 발자국이다.

---

## 5. 특수 정보 헤더

| 헤더 | 뜻 | 어디서 봤나 |
|:-----|:---|:-----------|
| Host | 어느 도메인에 | [02](../02-http-basics)장. 빼고 보내니 400 |
| Location | 저기로 가라, 또는 여기 만들었다 | [04](../04-http-status-codes)장의 301과 201 |
| Allow | 이 자원이 받는 메서드 | [03](../03-http-methods)장. example.com은 `GET, HEAD` |
| Retry-After | 이만큼 기다렸다 다시 | [04](../04-http-status-codes)장의 429와 503 |

```http
GET / HTTP/1.1
Host: example.com
```

```http
HTTP/1.1 201 Created
Location: /members/100
```

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
```

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
```

넷 다 앞 장에서 이미 만났다. 한 IP에 도메인 여럿을 붙이는 가상 호스팅 때문에 Host가 1.1에서 필수가 됐고, 나머지 셋은 상태 코드의 "다음 행동"에 붙는 인자다. 어디로(Location), 무엇으로(Allow), 언제(Retry-After).

---

## 6. 인증 헤더

| 헤더 | 방향 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| Authorization | 요청 | 나는 누구다 | 무상태라 요청마다 들고 온다 |
| WWW-Authenticate | 응답(401) | 이런 방식으로 밝혀라 | 클라이언트가 어떤 자격을 붙일지 알아야 |

```http
GET /api/members HTTP/1.1
Authorization: Bearer eyJhbGci...
```

```java
@Bean
SecurityFilterChain chain(
        HttpSecurity http)
        throws Exception {
    return http
        .oauth2ResourceServer(o ->
            o.jwt(withDefaults()))
        .authorizeHttpRequests(a -> a
            .requestMatchers("/open/**")
                .permitAll()
            .anyRequest()
                .authenticated())
        .build();
}
```

둘째 원리의 한 형태다. 서버는 "아까 로그인한 사람"을 기억하지 않는다. 대신 로그인 때 토큰을 주고, 클라이언트가 요청마다 `Authorization`에 실어 오면 그 토큰만 보고 누구인지 판단한다. [04](../04-http-status-codes)장에서 GitHub API에 이 헤더 없이 `/user`를 부르니 401이 왔다. 값의 첫 단어 `Bearer`가 방식이고, `WWW-Authenticate`가 그 방식을 알려 주는 짝이다.

---

## 7. 쿠키

```text
① 로그인
   Client ─ POST /login ────────→ Server
② 쿠키 설정
   Client ←─ Set-Cookie: SID=a ── Server
   (브라우저가 저장한다)
③ 이후 요청마다 자동으로
   Client ─ Cookie: SID=a ──────→ Server
```

둘째 원리의 본진이다. 서버가 `Set-Cookie`로 "이것을 기억해 두라"고 하면 브라우저가 저장하고, 그 뒤 같은 사이트로 가는 **모든 요청에 스스로** `Cookie`를 붙인다. 서버는 여전히 무상태다. 요청 안의 쿠키를 보고 누구인지 알 뿐이고, 서버 열 대 중 어느 것이 받아도 같다. [02](../02-http-basics)장이 미룬 "상태의 행방"이 여기다.

| 속성 | 뜻 | 왜 |
|:-----|:---|:---|
| expires / max-age | 언제까지 | 없으면 브라우저를 닫을 때 사라진다(세션 쿠키) |
| domain | 어느 도메인에 보낼지 | `.github.com`이면 하위 도메인 전부 |
| path | 어느 경로에 보낼지 | `/`면 전부 |
| Secure | HTTPS에서만 | 평문 구간에서 새지 않게 |
| HttpOnly | 자바스크립트가 못 읽게 | XSS로 훔쳐 가지 못하게 |
| SameSite | 다른 사이트에서 온 요청에 붙일지 | CSRF를 막는다 |

| 이 PC에서 본 GitHub 쿠키 | expires | domain | HttpOnly | SameSite | 왜 이렇게 |
|:-----------------------|:--------|:-------|:---------|:---------|:---------|
| `_gh_sess` | 없음 | 없음(github.com만) | O | Lax | 세션. 브라우저 닫으면 끝. JS가 볼 이유 없다 |
| `_octo` | 1년 뒤 | `.github.com` | X | Lax | 기기 식별. 페이지의 JS가 읽어 쓴다 |
| `logged_in` | 1년 뒤 | `.github.com` | O | Lax | 로그인 여부. JS가 볼 이유 없다 |

github.com의 첫 페이지가 내려 준 세 쿠키다. 셋 다 `Secure`이고 `SameSite=Lax`이며, JS가 읽을 필요가 있는 하나만 `HttpOnly`가 빠져 있다. 속성이 곧 보안이라는 것이 이 표다.

| SameSite | 언제 붙나 | 왜 |
|:---------|:---------|:---|
| Strict | 같은 사이트에서 시작한 요청만 | 남의 사이트 링크로 들어오면 로그인이 풀려 보인다 |
| Lax | 위에 더해, 다른 사이트에서의 최상위 GET 이동 | 링크로 들어와도 로그인이 유지된다. 크롬은 2020년부터 지정이 없으면 이것으로 |
| None | 전부 | 다른 사이트에 심는 위젯용. `Secure` 필수 |

```java
@PostMapping("/login")
public ResponseEntity<Void> login(
        @RequestBody LoginRequest req) {
    String sid = auth.login(req);
    var cookie = ResponseCookie
        .from("SID", sid)
        .maxAge(Duration.ofHours(1))
        .path("/")
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .build();
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE,
            cookie.toString())
        .build();
}
```

{{< callout type="warning" >}}
세션 쿠키에는 **`HttpOnly`와 `Secure`를 반드시** 붙인다. 쿠키가 새는 두 길이 페이지에 끼어든 스크립트(XSS)와 평문 구간이고, 두 속성이 각각 그 길을 막는다. CSRF는 `SameSite`가 막는다. 쿠키는 브라우저가 **자동으로** 붙이므로, 남의 사이트가 내 브라우저를 시켜 보낸 요청에도 붙는다는 것이 문제의 뿌리다.
{{< /callout >}}

---

## 8. 캐시 개요

```text
[캐시 없음]
요청1 → 1MB 다운로드
요청2 → 1MB 다운로드
요청3 → 1MB 다운로드
합계: 3MB, 느림

[캐시]
요청1 → 1MB 다운로드 + 저장
요청2 → 0B (캐시 재사용)
요청3 → 0B (캐시 재사용)
합계: 1MB, 빠름
```

셋째 원리다. [01](../01-internet-network)장에서 요청 하나의 값은 왕복 몇 번이라고 했다. 캐시는 그 왕복을 아예 없앤다. 문제는 **언제까지 믿어도 되는가**이고, 캐시의 상태 셋이 그 답이다.

| 상태 | 뜻 | 캐시가 하는 일 |
|:-----|:---|:-------------|
| Fresh | 아직 유효 기간 안 | 서버에 묻지 않고 바로 준다 |
| Stale | 유효 기간이 지났다 | 서버에 "아직 그대로냐"고 묻는다(10절) |
| Invalidated | 버렸다 | 처음부터 다시 받는다 |

이 블로그의 응답에는 `Cache-Control: max-age=600`이 붙어 있다. 10분 동안은 신선하고, 그 뒤는 만료라 브라우저가 다시 묻는다. 10분인 이유는 글을 고쳐 올렸을 때 독자가 너무 오래 옛 글을 보지 않게 하려는 GitHub Pages의 타협이다.

---

## 9. Cache-Control

| 지시어 | 방향 | 뜻 | 왜 |
|:-------|:-----|:---|:---|
| max-age=N | 양방향 | N초 동안 신선 | 가장 기본 |
| s-maxage=N | 응답 | 공용 캐시에만 적용되는 max-age | 브라우저와 CDN의 기간을 다르게 |
| no-cache | 양방향 | 저장은 하되 쓸 때마다 검증 | 항상 최신이어야 하지만 304로 절약은 하고 싶을 때 |
| no-store | 양방향 | 저장 자체를 금지 | 남의 눈에 남으면 안 되는 것 |
| public | 응답 | 공용 캐시가 저장해도 된다 | 모두에게 같은 것 |
| private | 응답 | 브라우저만 저장 | 그 사람만의 것 |
| must-revalidate | 응답 | 만료된 것은 검증 없이 절대 쓰지 말라 | 검증에 실패하면 504 |
| immutable | 응답 | 만료 전엔 검증도 하지 말라 | 이름에 해시가 든 정적 파일 |
| stale-while-revalidate=N | 응답 | 만료 뒤 N초는 옛것을 주며 뒤에서 갱신 | 사용자를 기다리게 하지 않으려고 |

```http
Cache-Control: max-age=600
Cache-Control: no-store
Cache-Control: private, max-age=0
```

이 PC에서 본 값 셋이 셋째 원리의 스펙트럼이다. 이 블로그는 `max-age=600`(10분간 믿어라), github.com의 로그인된 첫 페이지는 `max-age=0, private, must-revalidate`(너만 저장하되 쓸 때마다 물어라), 잔액 조회 같은 API는 `no-store`(저장하지 마라)다.

### no-cache vs must-revalidate

| | no-cache | must-revalidate |
|:--|:---------|:----------------|
| 신선할 때 | 그래도 검증한다 | 검증 없이 쓴다 |
| 만료됐을 때 | 검증한다 | 검증한다 |
| 검증에 실패하면(서버 다운) | 못 쓴다 | 못 쓴다. 504 |

둘의 차이는 **신선한 동안**이다. no-cache는 신선 기간이 없는 것과 같아 매번 서버에 묻고(대신 304로 본문은 아낀다), must-revalidate는 신선한 동안은 서버 없이 쓰다가 만료되면 반드시 묻는다. "no-cache는 서버가 죽었을 때 옛것이라도 준다"는 설명이 흔한데, RFC 9111은 둘 다 검증 없이는 만료된 응답을 못 주게 한다. 옛것을 주는 것은 `stale-if-error`처럼 따로 허락했을 때다.

---

## 10. 조건부 요청 (검증)

만료된 캐시를 버리지 않고 **바뀌었는지만** 묻는다. 안 바뀌었으면 서버는 본문 없이 304만 주고, 캐시는 가진 것을 다시 신선하게 쓴다.

| 응답이 주는 검증자 | 뜻 | 이 PC에서 본 값 |
|:-----------------|:---|:--------------|
| Last-Modified | 마지막으로 바뀐 시각 | `Mon, 14 Sep 2026 06:35:43 GMT` |
| ETag | 이 표현의 판 번호 | `W/"6aa795bf-33f84"` |

| 요청이 붙이는 조건 | 짝 | 뜻 |
|:-----------------|:---|:---|
| If-Modified-Since | Last-Modified | 이 시각 뒤에 바뀌었으면 달라 |
| If-None-Match | ETag | 이 판이 아니면 달라 |
| If-Match | ETag | 이 판일 때만 처리하라 (PUT의 충돌 방지) |

```text
① 첫 요청
   Client ─ GET /95jw_archive/ ─→ Server
   Client ←─ 200 OK ─────────────
            ETag: W/"6aa795bf-33f84"
            Cache-Control: max-age=600
            [212,868바이트]
② 10분 뒤, 바뀐 게 없을 때
   Client ─ GET, If-None-Match ─→ Server
   Client ←─ 304 Not Modified ────
            (본문 없음. 가진 것을 쓴다)
③ 바뀌었을 때
   Client ←─ 200 OK, 새 ETag, 새 본문
```

이 블로그의 ETag `6aa795bf-33f84`는 수정 시각과 크기를 16진수로 붙인 것이다. 앞의 `6aa795bf`는 초로 센 시각이라 풀면 위 Last-Modified와 같은 06:35:43이고, 뒤의 `33f84`는 212,868, 곧 본문의 바이트 수다. 글을 고쳐 올리면 둘 다 바뀌므로 판 번호가 바뀐다. [04](../04-http-status-codes)장에서 이 값을 `If-None-Match`로 보내 304를 받았고, 네트워크 [29](../../29-web-server-structure)장에서는 `If-Modified-Since`로 같은 답을 받았다. `gzip`으로 받으면 앞에 `W/`가 붙는데, 압축한 표현은 바이트가 다르지만 뜻은 같다는 **약한** 판 번호 표시다.

```http
GET /95jw_archive/ HTTP/1.1
If-Match: "wrong"
```

```http
HTTP/1.1 412 Precondition Failed
```

`If-Match`는 반대 방향이다. 이 판일 때만 하라는 조건이고, 이 PC에서 엉뚱한 값을 붙이니 412가 왔다. 이것을 PUT에 쓰면 [03](../03-http-methods)장의 낙관적 락이 된다. 읽어 온 ETag를 붙여 고치면, 그 사이 남이 고쳐 판이 바뀌었을 때 서버가 412로 거절한다.

```java
@GetMapping("/members/{id}")
public ResponseEntity<Member> get(
        @PathVariable Long id,
        WebRequest req) {
    Member m = members.get(id);
    String etag = "v" + m.version();
    if (req.checkNotModified(etag)) {
        return null;  // 304가 나간다
    }
    return ResponseEntity.ok()
        .eTag(etag)
        .cacheControl(CacheControl
            .maxAge(1, TimeUnit.HOURS))
        .body(m);
}
```

`checkNotModified`가 요청의 `If-None-Match`와 비교해 같으면 304를 준비하고 true를 돌려준다. 판 번호로 엔티티의 버전 열을 쓰면 DB를 한 번 읽고 본문 직렬화와 전송을 건너뛴다. 본문을 다 만든 뒤 MD5로 ETag를 붙이는 `ShallowEtagHeaderFilter`도 있는데, 그것은 대역폭만 아끼고 서버의 일은 그대로다.

---

## 11. Vary 헤더

```http
HTTP/1.1 200 OK
Vary: Accept-Encoding
```

같은 주소라도 **요청 헤더에 따라 표현이 달라지면** 캐시는 그 헤더도 저장 키에 넣어야 한다. 이 블로그의 응답에 `Vary: Accept-Encoding`이 붙어 있는 것은, 같은 `/95jw_archive/`의 답이 gzip을 받는 브라우저에는 16,408바이트짜리, 못 받는 클라이언트에는 212,868바이트짜리로 다르기 때문이다. 이 줄이 없으면 CDN이 압축본을 압축 못 읽는 클라이언트에게 줄 수 있다.

| 상황 | Vary | 왜 |
|:-----|:-----|:---|
| gzip과 원본 | Accept-Encoding | 표현이 둘 |
| 한국어와 영어 | Accept-Language | 표현이 언어 수만큼 |
| 모바일과 PC | User-Agent | 표현이 둘인데 키는 수천 가지 |

{{< callout type="warning" >}}
`Vary: User-Agent`는 브라우저 버전마다 문자열이 달라 캐시 키가 수천 갈래로 쪼개지고 히트율이 무너진다. 이 PC에서 본 github.com의 응답은 `Vary`에 헤더 열한 개를 나열하는데, `private`이라 공용 캐시가 저장하지 않으니 괜찮은 것이다. 공용 캐시에 저장할 것이라면 URL을 나누거나 프록시에서 두어 종으로 정규화한다.
{{< /callout >}}

---

## 12. 프록시 캐시

```text
[Clients]
   │
   ├─→ ┌──────────────┐
   ├─→ │ Proxy Cache  │
   └─→ │  (CDN Edge)  │
        └──────┬───────┘
               │ 캐시 미스 시
               ▼
        ┌──────────────┐
        │Origin Server │
        └──────────────┘
```

| 헤더 | 뜻 | 이 PC에서 본 값 |
|:-----|:---|:--------------|
| Cache-Control: public | 공용 캐시가 저장해도 된다 | |
| Cache-Control: private | 브라우저만 | github.com |
| s-maxage | 공용 캐시 전용 기간 | |
| Age | 캐시에 들어온 뒤 지난 초 | example.com `13300`, 이 블로그 `0` |
| X-Cache, cf-cache-status | 캐시에서 줬는지 | Fastly `MISS`, Cloudflare `HIT` |

브라우저의 캐시가 한 사람의 것이라면 프록시 캐시는 모두의 것이다. CDN이 대표이고, 이 PC에서 받은 두 응답이 그 발자국이다. example.com의 `Age: 13300`과 `cf-cache-status: HIT`는 클라우드플레어가 3시간 40분 전에 저장해 둔 것을 준 것이고, 이 블로그의 `X-Cache: MISS`와 `Age: 0`은 인천의 Fastly 서버에 없어서 원 서버까지 다녀온 것이다. 두 번째 사람부터는 HIT가 된다. `public`과 `private`이 이 캐시에 저장해도 되는가를 가르고, `s-maxage`가 브라우저와 다른 기간을 준다.

---

## 13. 캐시 무효화

```http
Cache-Control: no-store
```

| 지시어 | 뜻 | 왜 |
|:-------|:---|:---|
| no-store | 어디에도 저장하지 마라 | 잔액, 개인정보. 이것 하나면 된다 |
| no-cache | 저장하되 매번 검증 | 최신이어야 하지만 304는 쓰고 싶을 때 |
| must-revalidate | 만료 뒤 검증 없이 쓰지 마라 | 신선 기간은 두되 그 뒤는 엄격하게 |
| Pragma: no-cache | HTTP/1.0 시절의 no-cache | RFC 9111이 폐기. 옛 프록시용 |

`no-cache, no-store, must-revalidate`에 `Pragma`와 `Expires: 0`까지 붙이는 주문이 흔히 돌아다니는데, `no-store` 하나로 나머지가 전부 뜻을 잃는다. 저장하지 않으면 검증할 것도 만료될 것도 없다. 나머지는 no-store를 모르던 HTTP/1.0 프록시를 위한 흔적이고, 오늘의 브라우저와 CDN에는 첫 줄이면 된다.

---

## 14. CORS 헤더 요약

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
```

| 헤더 | 방향 | 뜻 |
|:-----|:-----|:---|
| Origin | 요청 | 이 요청을 시작한 페이지의 출처 |
| Access-Control-Allow-Origin | 응답 | 이 출처에는 답을 보여 줘도 된다 |
| Access-Control-Allow-Methods | 응답(preflight) | 이 메서드들은 된다 |
| Access-Control-Allow-Headers | 응답(preflight) | 이 헤더들은 붙여도 된다 |
| Access-Control-Allow-Credentials | 응답 | 쿠키를 붙인 요청도 된다 |
| Access-Control-Expose-Headers | 응답 | JS가 읽어도 되는 응답 헤더 |
| Access-Control-Max-Age | 응답(preflight) | preflight 답을 기억할 초 |

서버가 아니라 **브라우저**가 강제하는 정책이다. 이 PC의 curl은 `Origin`을 붙이든 말든 답을 다 받는다. 브라우저 안의 JS가 다른 출처의 API를 부를 때, 브라우저가 이 헤더들을 보고 JS에게 답을 보여 줄지 말지를 정한다. 뿌리는 둘째 원리다. 쿠키가 자동으로 붙으므로 아무 사이트의 JS가 내 은행 API를 내 쿠키로 부를 수 있고, 그 답을 그 JS에게 보여 주지 않는 것이 이 정책의 목적이다. 이 PC에서 GitHub API에 `Origin`을 붙여 부르니 `Allow-Origin: *`와, JS가 읽어도 되는 헤더 목록(`ETag`, `Link`, `X-RateLimit-*`)이 왔다. preflight의 흐름은 [03](../03-http-methods)장 9절에서 봤다.

---

## 15. Spring Boot 캐시 설정 모음

```java
// 정적 자원: 1년, 공용 캐시
reg.addResourceHandler("/static/**")
    .addResourceLocations(
        "classpath:/static/")
    .setCacheControl(CacheControl
        .maxAge(365, TimeUnit.DAYS)
        .cachePublic());

// API: 10분, 만료 뒤엔 반드시 검증
@GetMapping("/products")
public ResponseEntity<List<Product>>
        products() {
    return ResponseEntity.ok()
        .cacheControl(
            CacheControl.maxAge(
                10, TimeUnit.MINUTES)
            .mustRevalidate())
        .body(products.findAll());
}

// 개인 정보: 저장 금지
@GetMapping("/users/me")
public ResponseEntity<User> me() {
    return ResponseEntity.ok()
        .cacheControl(
            CacheControl.noStore())
        .body(users.current());
}
```

셋째 원리를 세 등급으로 나눈 것이다. 이름에 해시가 붙는 정적 파일은 1년이고 공용 캐시에 둬도 된다. 바뀔 수 있는 목록은 짧게 믿고 그 뒤는 검증한다. 그 사람만의 것은 어디에도 남기지 않는다. 헤더 한 줄이 왕복 수천 번을 없애기도 하고, 한 줄이 빠져 남의 잔액이 CDN에 남기도 한다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 표현 | 같은 자원의 여러 모양 | JSON/XML, 언어, 압축 |
| 협상 | Accept-*로 바라고 Content-*로 답한다 | q값이 순서. MDN이 ko로 보냈다 |
| Content-Encoding | gzip | 이 블로그 212KB가 16KB로 |
| 쿠키 | Set-Cookie로 맡기고 Cookie로 도로 받는다 | 무상태의 상태 |
| 쿠키 속성 | HttpOnly, Secure, SameSite | 새는 길마다 하나씩 |
| Cache-Control | 얼마나 믿을지 | max-age, no-cache, no-store |
| 신선과 만료 | 신선하면 안 묻고, 만료면 묻는다 | 이 블로그는 10분 |
| ETag / Last-Modified | 판 번호 / 수정 시각 | 조건부 요청의 기준 |
| 304 | 본문 없이 "그대로다" | 왕복은 남고 바이트가 사라진다 |
| If-Match | 이 판일 때만 | 412. 낙관적 락 |
| Vary | 표현을 가른 헤더를 키에 | Accept-Encoding |
| 프록시 캐시 | 모두의 캐시 | Age, HIT/MISS, public/private |
| no-store | 이것 하나면 된다 | 나머지 주문은 1.0의 흔적 |
| CORS | 브라우저가 답을 보여 줄지 정한다 | 쿠키가 자동으로 붙어서 |

{{< callout type="info" >}}
**용어 정리**
- **Representation**: 자원을 메시지에 실은 구체적 모양. JSON, 한국어, gzip
- **Content Negotiation**: 클라이언트의 바람과 서버의 표현을 맞추는 것. q값으로 순서
- **Cookie / Set-Cookie**: 브라우저가 기억했다 도로 보내는 것 / 기억하라는 지시
- **SameSite**: 다른 사이트에서 시작한 요청에 쿠키를 붙일지의 정책
- **Cache-Control**: 캐시가 얼마나, 어떻게 써도 되는지의 지시
- **Fresh / Stale**: 유효 기간 안 / 지남
- **ETag / Last-Modified**: 표현의 판 번호 / 수정 시각. 검증자
- **Conditional Request**: If-* 헤더로 바뀌었는지만 묻는 요청. 답은 304 또는 200
- **Vary**: 같은 주소의 표현을 가른 요청 헤더. 캐시 키에 들어간다
- **Proxy Cache**: 클라이언트와 원 서버 사이의 공용 캐시. CDN
- **Age**: 캐시에 저장된 뒤 지난 초
- **CORS**: 다른 출처의 답을 JS에게 보여 줄지 브라우저가 정하는 정책
{{< /callout >}}
