---
title: "05. HTTP 헤더와 캐시"
weight: 5
---

## 1. 헤더의 개념

HTTP 헤더는 메시지의 부가 정보를 담는 **키-값 쌍**이다.

```text
field-name: field-value
```

- 필드명은 **대소문자 구분 없음**
- 값 앞뒤 공백은 무시
- 커스텀 헤더 정의 가능 (관례적으로 `X-` 접두)

### 헤더 분류

| 분류 | 대표 헤더 |
|:---|:---|
| 표현 (Representation) | Content-Type, Content-Encoding |
| 협상 (Negotiation) | Accept, Accept-Language |
| 일반 정보 | User-Agent, Referer, Server, Date |
| 특수 정보 | Host, Location, Allow, Retry-After |
| 인증 | Authorization, WWW-Authenticate |
| 쿠키 | Cookie, Set-Cookie |
| 캐시 | Cache-Control, ETag, Last-Modified |
| CORS | Origin, Access-Control-* |

## 2. 표현 헤더

RFC 7230 이후 개념이 **엔티티(Entity)** 에서 **표현(Representation)** 으로 바뀌었다. 하나의 리소스가 여러 표현을 가질 수 있다 (JSON/XML, ko/en 등).

| 헤더 | 설명 | 예시 |
|:---|:---|:---|
| Content-Type | 본문 미디어 타입 | `application/json; charset=utf-8` |
| Content-Encoding | 압축 방식 | `gzip`, `br`, `deflate` |
| Content-Language | 본문 언어 | `ko`, `en-US` |
| Content-Length | 본문 바이트 수 | `3423` |

```http
# HTML
Content-Type: text/html; charset=UTF-8

# JSON
Content-Type: application/json

# 폼
Content-Type: application/x-www-form-urlencoded

# 파일 업로드
Content-Type: multipart/form-data; boundary=----Boundary
```

## 3. 협상 (Content Negotiation)

클라이언트가 **선호 표현**을 요청에 담아 보내면 서버가 골라 응답한다.

| 요청 헤더 | 대응 응답 |
|:---|:---|
| Accept | Content-Type |
| Accept-Charset | Content-Type (charset) |
| Accept-Encoding | Content-Encoding |
| Accept-Language | Content-Language |

### Quality Values (q)

우선순위를 0~1 사이 값으로 지정한다. 생략 시 1.

```http
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7
```

해석 순서: ko-KR → ko → en-US → en.

### Spring Boot 협상

```java
@GetMapping(value = "/members/{id}",
    produces = {
        MediaType.APPLICATION_JSON_VALUE,
        MediaType.APPLICATION_XML_VALUE
    })
public Member get(@PathVariable Long id) {
    return memberService.findById(id);
}
```

## 4. 일반 정보 헤더

| 헤더 | 방향 | 설명 |
|:---|:---|:---|
| From | 요청 | 사용자 이메일 (검색 봇) |
| Referer | 요청 | 이전 페이지 URL (유입 경로) |
| User-Agent | 요청 | 클라이언트 정보 |
| Server | 응답 | 오리진 서버 소프트웨어 |
| Date | 응답 | 메시지 생성 시각 |

{{< callout type="warning" >}}
`Referer`는 **오타가 표준**이다(본래 Referrer). 헤더명은 항상 `Referer`로 쓴다.
{{< /callout >}}

## 5. 특수 정보 헤더

### Host (필수)

하나의 IP에 여러 도메인을 붙이는 가상 호스팅을 위해 **요청에 반드시 포함**된다.

```http
GET /search HTTP/1.1
Host: www.google.com
```

### Location

리다이렉션 또는 생성된 리소스 URI를 가리킨다.

```http
HTTP/1.1 302 Found
Location: /new-page

HTTP/1.1 201 Created
Location: /members/100
```

### Allow

405 Method Not Allowed 응답에 허용 메서드를 알린다.

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, POST
```

### Retry-After

503/429 응답에서 재시도 대기 시간을 알린다 (초 또는 HTTP 날짜).

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
```

## 6. 인증 헤더

| 헤더 | 방향 | 용도 |
|:---|:---|:---|
| Authorization | 요청 | 자격 증명 |
| WWW-Authenticate | 응답 (401) | 인증 방식 안내 |

```http
GET /api/members HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain chain(HttpSecurity http) throws Exception {
        return http
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated())
            .build();
    }
}
```

## 7. 쿠키

HTTP의 무상태 특성을 보완한다. 서버가 `Set-Cookie`로 내려주면 브라우저가 저장하고, 이후 요청마다 `Cookie` 헤더로 자동 포함한다.

### 동작 흐름

```text
① 로그인
   Client ─ POST /login ──────────→ Server

② 쿠키 설정
   Client ←─ Set-Cookie: SID=abc ── Server
   (브라우저 쿠키 저장소에 저장)

③ 이후 요청 자동 포함
   Client ─ Cookie: SID=abc ──────→ Server
```

### 쿠키 속성

| 속성 | 설명 |
|:---|:---|
| expires | 만료 날짜 (HTTP 날짜) |
| max-age | 만료까지 초 수 |
| domain | 쿠키가 전송될 도메인 |
| path | 쿠키가 전송될 경로 |
| Secure | HTTPS에서만 전송 |
| HttpOnly | JS 접근 차단 (XSS 완화) |
| SameSite | 교차 사이트 전송 정책 |

### SameSite

| 값 | 동작 |
|:---|:---|
| Strict | 같은 사이트 요청만 전송 |
| Lax | 탐색 GET만 허용 (기본값) |
| None | 모든 요청에 전송 (`Secure` 필수) |

### Spring Boot 쿠키 설정

```java
@PostMapping("/login")
public ResponseEntity<Void> login(@RequestBody LoginRequest req,
                                   HttpServletResponse res) {
    String sid = authService.login(req);

    ResponseCookie cookie = ResponseCookie.from("SID", sid)
        .maxAge(Duration.ofHours(1))
        .path("/")
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .build();

    res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    return ResponseEntity.ok().build();
}
```

{{< callout type="warning" >}}
세션 쿠키에는 **반드시 `HttpOnly`와 `Secure`** 를 붙인다. JS로 탈취(XSS)되거나 평문 통신 구간에서 유출되는 사고가 가장 흔하다.
{{< /callout >}}

## 8. 캐시 개요

### 캐시 없음 vs 캐시

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

### 캐시가 거치는 3단계

| 단계 | 동작 |
|:---|:---|
| Fresh | 만료 전, 바로 사용 |
| Stale | 만료됨, 서버에 **재검증** 필요 |
| Invalidated | 버려짐, 새로 요청 |

## 9. Cache-Control

요청·응답 양쪽에서 쓰이는 캐시 지시 헤더.

| 지시어 | 방향 | 설명 |
|:---|:---|:---|
| max-age=N | 양방향 | 신선한 기간 (초) |
| s-maxage=N | 응답 | 공용(프록시) 전용 max-age |
| no-cache | 양방향 | 저장 O, 사용 전 **재검증 필수** |
| no-store | 양방향 | 저장 금지 (민감 정보) |
| public | 응답 | 공용 캐시 저장 허용 |
| private | 응답 | 브라우저만 저장 |
| must-revalidate | 응답 | 만료 후 재검증 실패 시 오류 반환 |
| immutable | 응답 | 만료 전 재검증 금지 |

```http
Cache-Control: public, max-age=31536000, immutable
Cache-Control: no-cache
Cache-Control: no-store
```

### no-cache vs must-revalidate

```text
원 서버에 접근 불가 (네트워크 장애)

[no-cache]           [must-revalidate]
프록시 판단:         프록시 판단:
"오래된 응답이라도"   "검증 실패 → 오류"
→ 200 (stale 응답)   → 504 Gateway Timeout
```

## 10. 조건부 요청 (검증)

만료된 캐시를 **변경 여부만 확인**하고 재사용한다.

### 검증 헤더 (Validator)

| 응답 헤더 | 설명 |
|:---|:---|
| Last-Modified | 마지막 수정 시각 |
| ETag | 리소스 버전 지문 (해시 등) |

### 조건부 요청 헤더

| 요청 헤더 | 짝 | 설명 |
|:---|:---|:---|
| If-Modified-Since | Last-Modified | 이후 수정됐는가 |
| If-None-Match | ETag | 다른 버전인가 |
| If-Match | ETag | 같은 버전인가 (PUT 충돌 방지) |

### 흐름

```text
① 첫 요청
   Client ─ GET /image.png ──→ Server
   Client ←── 200 OK          ──
            ETag: "abc123"
            Cache-Control: max-age=60
            [image bytes]

② 만료 후 재요청 (변경 없음)
   Client ─ GET /image.png ──→ Server
            If-None-Match: "abc123"
   Client ←── 304 Not Modified ──
            (본문 없음, 캐시 재사용)

③ 만료 후 재요청 (변경 있음)
   Client ─ GET /image.png ──→ Server
            If-None-Match: "abc123"
   Client ←── 200 OK          ──
            ETag: "xyz789"
            [new image bytes]
```

### Spring Boot ETag

```java
// 전역 필터
@Bean
public FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
    var bean = new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
    bean.addUrlPatterns("/api/*");
    return bean;
}

// 수동 구현
@GetMapping("/members/{id}")
public ResponseEntity<Member> get(@PathVariable Long id,
                                   WebRequest request) {
    Member member = memberService.findById(id);
    String etag = "\"" + member.getVersion() + "\"";

    if (request.checkNotModified(etag)) {
        return null;   // 304 자동 반환
    }
    return ResponseEntity.ok()
        .eTag(etag)
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
        .body(member);
}
```

## 11. Vary 헤더

같은 URL이라도 **요청 헤더에 따라 표현이 달라지면** 캐시 키에 그 헤더를 포함시켜야 한다.

```http
HTTP/1.1 200 OK
Vary: Accept-Encoding, Accept-Language
```

| 시나리오 | Vary 값 |
|:---|:---|
| gzip/br 압축 분기 | Accept-Encoding |
| 한국어/영어 분기 | Accept-Language |
| 모바일/PC 분기 | User-Agent |

{{< callout type="warning" >}}
`Vary: User-Agent`는 키가 거의 무한히 분화해 캐시 히트율이 급락한다. 디바이스 분기가 필요하면 URL을 분리하거나 프록시에서 **정규화**해 서너 종만 키로 쓴다.
{{< /callout >}}

## 12. 프록시 캐시

클라이언트와 원 서버 사이에서 응답을 공유 캐시한다 (CDN이 대표적).

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
        │ Origin Server │
        └──────────────┘
```

| 헤더 | 의미 |
|:---|:---|
| Cache-Control: public | 공용(프록시) 저장 허용 |
| Cache-Control: private | 브라우저만 저장 |
| Cache-Control: s-maxage | 공용 캐시 전용 max-age |
| Age | 프록시에 캐시된 이후 경과 초 |

## 13. 캐시 무효화

사용자 잔액·개인정보처럼 **절대 캐시되면 안 되는** 경우.

```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

| 지시어 | 이유 |
|:---|:---|
| no-cache | 항상 원 서버에 재검증 |
| no-store | 디스크·메모리 저장 금지 |
| must-revalidate | 만료 후 재검증 실패 → 오류 |
| Pragma | HTTP/1.0 하위 호환 |

## 14. CORS 헤더 요약

교차 출처 자원 공유. 브라우저가 강제하는 보안 정책이다.

| 헤더 | 방향 | 설명 |
|:---|:---|:---|
| Origin | 요청 | 요청을 보낸 출처 |
| Access-Control-Allow-Origin | 응답 | 허용 출처 |
| Access-Control-Allow-Methods | 응답 | 허용 메서드 (preflight) |
| Access-Control-Allow-Headers | 응답 | 허용 헤더 (preflight) |
| Access-Control-Allow-Credentials | 응답 | 쿠키 포함 허용 |
| Access-Control-Max-Age | 응답 | preflight 캐시 초 |

CORS preflight의 OPTIONS 요청 흐름은 [03. HTTP 메서드](03-http-methods)에서 다뤘다.

## 15. Spring Boot 캐시 설정 모음

```java
// 정적 리소스 – 1년, 공용 캐시
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry r) {
        r.addResourceHandler("/static/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(
                CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic());
    }
}

// API – 10분, 재검증 필수
@GetMapping("/products")
public ResponseEntity<List<Product>> products() {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES)
            .mustRevalidate())
        .body(productService.findAll());
}

// 민감 정보 – 저장 금지
@GetMapping("/users/me")
public ResponseEntity<User> me() {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(userService.getCurrentUser());
}
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 표현 헤더 | Content-Type/Encoding/Language/Length |
| 협상 | Accept-* 로 선호 표현 요청 |
| 쿠키 | Set-Cookie / Cookie, 상태 유지 |
| Cache-Control | 캐시 동작 지시 (max-age, no-cache, no-store) |
| ETag / Last-Modified | 조건부 요청용 검증 헤더 |
| 304 Not Modified | 변경 없음, 본문 생략 |
| Vary | 요청 헤더별 캐시 키 분화 |
| 프록시 캐시 | 공용 캐시, `public`·`s-maxage`로 제어 |
| CORS | 교차 출처 정책, preflight + Allow-* |

{{< callout type="info" >}}
**용어 정리**
- **Representation**: 리소스의 구체적 표현 (JSON, XML, ko, gzip 등)
- **Content Negotiation**: 클라이언트 선호와 서버 가용 표현의 협상
- **Cookie / Set-Cookie**: 상태 유지 데이터 전송 헤더
- **SameSite**: 교차 사이트에서의 쿠키 전송 정책
- **Cache-Control**: 캐시 동작을 제어하는 지시 헤더
- **ETag / Last-Modified**: 조건부 요청의 검증자
- **Conditional Request**: `If-*` 헤더로 변경 여부를 판별하는 요청
- **Vary**: 같은 URL에서 요청 헤더별로 다른 표현을 캐시하는 키
- **Proxy Cache**: 클라이언트와 원 서버 사이의 공용 캐시
- **CORS**: 브라우저가 강제하는 교차 출처 자원 공유 정책
{{< /callout >}}
