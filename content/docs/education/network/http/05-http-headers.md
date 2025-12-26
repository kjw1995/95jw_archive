---
title: "05. HTTP 헤더와 캐시"
weight: 5
---

## HTTP 헤더란?

HTTP 전송에 필요한 **모든 부가 정보**를 담고 있습니다.

```
field-name: field-value
```

- field-name은 **대소문자 구분 없음**
- 필요시 임의의 헤더 추가 가능 (확장성)

---

## 표현 헤더 (Representation Headers)

RFC7230 이후 **엔티티(Entity) → 표현(Representation)**으로 개념이 변경되었습니다.
메시지 본문은 표현 데이터를 전달하며, **표현 헤더**는 이를 해석하는 정보를 제공합니다.

### 주요 표현 헤더

| 헤더 | 설명 | 예시 |
|------|------|------|
| **Content-Type** | 표현 데이터의 형식 | text/html; charset=utf-8, application/json |
| **Content-Encoding** | 압축 방식 | gzip, deflate, br |
| **Content-Language** | 자연 언어 | ko, en, en-US |
| **Content-Length** | 데이터 길이 (바이트) | 3423 |

### Content-Type 예시

```http
# HTML
Content-Type: text/html; charset=UTF-8

# JSON
Content-Type: application/json

# 폼 데이터
Content-Type: application/x-www-form-urlencoded

# 파일 업로드
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
```

---

## 협상 헤더 (Content Negotiation)

클라이언트가 선호하는 표현을 요청할 때 사용합니다. **요청 시에만** 사용됩니다.

### 협상 헤더 종류

| 헤더 | 용도 |
|------|------|
| **Accept** | 선호 미디어 타입 |
| **Accept-Charset** | 선호 문자 인코딩 |
| **Accept-Encoding** | 선호 압축 방식 |
| **Accept-Language** | 선호 자연 언어 |

### Quality Values (q)

우선순위를 지정합니다. **0~1 사이 값**, 클수록 높은 우선순위 (기본값: 1)

```http
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7
```

해석:
1. ko-KR (q=1, 생략)
2. ko (q=0.9)
3. en-US (q=0.8)
4. en (q=0.7)

### Spring Boot 협상 예제

```java
@GetMapping(value = "/members/{id}",
            produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
public Member getMember(@PathVariable Long id) {
    return memberService.findById(id);
}

// Accept: application/json → JSON 응답
// Accept: application/xml → XML 응답
```

---

## 일반 정보 헤더

### 요청 헤더

| 헤더 | 설명 |
|------|------|
| **From** | 유저 에이전트 이메일 (검색 엔진 등) |
| **Referer** | 이전 웹 페이지 주소 (유입 경로 분석) |
| **User-Agent** | 클라이언트 애플리케이션 정보 |

### 응답 헤더

| 헤더 | 설명 |
|------|------|
| **Server** | 오리진 서버 소프트웨어 정보 |
| **Date** | 메시지 생성 날짜 |

### Referer 활용

```java
@GetMapping("/articles/{id}")
public String viewArticle(@PathVariable Long id,
                          @RequestHeader(value = "Referer", required = false) String referer) {
    // 유입 경로 분석
    if (referer != null) {
        analyticsService.trackReferrer(referer);
    }
    return articleService.findById(id);
}
```

---

## 특별한 정보 헤더

### Host (필수)

하나의 IP로 **여러 도메인을 처리**하는 가상 호스팅에 필수입니다.

```http
GET /search HTTP/1.1
Host: www.google.com
```

### Location

**리다이렉션** 또는 **생성된 리소스 URI**를 나타냅니다.

```http
# 리다이렉션 (3xx)
HTTP/1.1 302 Found
Location: /new-page

# 리소스 생성 (201)
HTTP/1.1 201 Created
Location: /members/100
```

### Allow

405 Method Not Allowed 응답에 **허용된 메서드**를 알려줍니다.

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, POST
```

### Retry-After

503 Service Unavailable 응답에 **재시도 시간**을 알려줍니다.

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
```

---

## 인증 헤더

| 헤더 | 용도 | 방향 |
|------|------|------|
| **Authorization** | 클라이언트 인증 정보 | 요청 |
| **WWW-Authenticate** | 인증 방법 정의 | 응답 (401과 함께) |

### Bearer 토큰 인증

```http
GET /api/members HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Spring Security 예제

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .build();
    }
}
```

---

## 쿠키 헤더

HTTP의 **무상태(Stateless)** 특성을 보완하여 상태를 유지합니다.

### 쿠키 동작 방식

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           쿠키 동작 방식                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 로그인 요청                                                             │
│  ┌────────┐     POST /login                    ┌────────┐                  │
│  │ Client │ ─────────────────────────────────→ │ Server │                  │
│  └────────┘                                    └────────┘                  │
│                                                                             │
│  2. 쿠키 설정 응답                                                          │
│  ┌────────┐     Set-Cookie: sessionId=abc123   ┌────────┐                  │
│  │ Client │ ←───────────────────────────────── │ Server │                  │
│  └────────┘     (브라우저 쿠키 저장소에 저장)   └────────┘                  │
│                                                                             │
│  3. 이후 모든 요청에 쿠키 자동 전송                                         │
│  ┌────────┐     Cookie: sessionId=abc123       ┌────────┐                  │
│  │ Client │ ─────────────────────────────────→ │ Server │                  │
│  └────────┘                                    └────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 쿠키 속성

| 속성 | 설명 | 예시 |
|------|------|------|
| **expires** | 만료 날짜 | expires=Sat, 26-Dec-2026 04:39:21 GMT |
| **max-age** | 만료 시간 (초) | max-age=3600 |
| **domain** | 쿠키 전송 도메인 | domain=example.com |
| **path** | 쿠키 전송 경로 | path=/ |
| **Secure** | HTTPS에서만 전송 | Secure |
| **HttpOnly** | JavaScript 접근 차단 | HttpOnly |
| **SameSite** | CSRF 공격 방지 | SameSite=Strict |

### Spring Boot 쿠키 설정

```java
@PostMapping("/login")
public ResponseEntity<Void> login(@RequestBody LoginRequest request,
                                   HttpServletResponse response) {
    String sessionId = authService.login(request);

    Cookie cookie = new Cookie("sessionId", sessionId);
    cookie.setMaxAge(3600);        // 1시간
    cookie.setPath("/");
    cookie.setHttpOnly(true);      // XSS 방지
    cookie.setSecure(true);        // HTTPS only

    response.addCookie(cookie);
    return ResponseEntity.ok().build();
}
```

### SameSite 옵션

| 값 | 설명 |
|----|------|
| **Strict** | 같은 사이트에서만 쿠키 전송 |
| **Lax** | GET 요청은 허용 (기본값) |
| **None** | 모든 요청에 전송 (Secure 필수) |

---

## 캐시 (Cache)

### 캐시가 필요한 이유

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      캐시 없을 때 vs 캐시 있을 때                             │
├──────────────────────────────────┬──────────────────────────────────────────┤
│          캐시 없음               │            캐시 있음                      │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  요청 → 서버에서 1MB 다운로드     │  첫 요청 → 1MB 다운로드 + 캐시 저장      │
│  요청 → 서버에서 1MB 다운로드     │  재요청 → 캐시에서 즉시 로드 (0MB)       │
│  요청 → 서버에서 1MB 다운로드     │  재요청 → 캐시에서 즉시 로드 (0MB)       │
│                                  │                                          │
│  총 3MB 전송, 느림                │  총 1MB 전송, 빠름                       │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### Cache-Control 헤더

```http
Cache-Control: max-age=3600
```

| 지시어 | 설명 |
|--------|------|
| **max-age=초** | 캐시 유효 시간 |
| **no-cache** | 캐시 가능, 사용 전 서버 검증 필수 |
| **no-store** | 캐시 저장 금지 (민감 정보) |
| **public** | 공용 캐시 저장 가능 |
| **private** | 개인 캐시만 저장 (기본값) |
| **must-revalidate** | 만료 후 반드시 서버 검증 |

---

## 조건부 요청 (Conditional Request)

캐시가 만료되었을 때, **데이터가 변경되지 않았으면** 캐시를 재사용합니다.

### 검증 헤더 (Validator)

| 헤더 | 설명 | 용도 |
|------|------|------|
| **Last-Modified** | 마지막 수정 시간 | 시간 기반 검증 |
| **ETag** | 리소스 버전 태그 | 해시 기반 검증 |

### 조건부 요청 헤더

| 요청 헤더 | 검증 헤더 | 설명 |
|-----------|-----------|------|
| **If-Modified-Since** | Last-Modified | 이 시간 이후 수정됐는지 |
| **If-None-Match** | ETag | ETag가 다른지 |

### 조건부 요청 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       조건부 요청 흐름 (ETag)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 첫 번째 요청                                                            │
│  ┌────────┐     GET /image.png                 ┌────────┐                  │
│  │ Client │ ─────────────────────────────────→ │ Server │                  │
│  │        │ ←───────────────────────────────── │        │                  │
│  └────────┘     200 OK                         └────────┘                  │
│                 ETag: "abc123"                                              │
│                 Cache-Control: max-age=60                                  │
│                 [이미지 데이터]                                             │
│                                                                             │
│  2. 캐시 만료 후 재요청                                                     │
│  ┌────────┐     GET /image.png                 ┌────────┐                  │
│  │ Client │     If-None-Match: "abc123"       │ Server │                  │
│  │        │ ─────────────────────────────────→ │        │                  │
│  │        │                                    │        │                  │
│  │        │     [ETag 비교: 같음!]             │        │                  │
│  │        │ ←───────────────────────────────── │        │                  │
│  └────────┘     304 Not Modified               └────────┘                  │
│                 (본문 없음 - 캐시 재사용)                                   │
│                                                                             │
│  3. 데이터가 변경된 경우                                                    │
│  ┌────────┐     GET /image.png                 ┌────────┐                  │
│  │ Client │     If-None-Match: "abc123"       │ Server │                  │
│  │        │ ─────────────────────────────────→ │        │                  │
│  │        │                                    │        │                  │
│  │        │     [ETag 비교: 다름!]             │        │                  │
│  │        │ ←───────────────────────────────── │        │                  │
│  └────────┘     200 OK                         └────────┘                  │
│                 ETag: "xyz789"                                              │
│                 [새 이미지 데이터]                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Spring Boot ETag 지원

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> shallowEtagHeaderFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> filterBean =
            new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        filterBean.addUrlPatterns("/api/*");
        return filterBean;
    }
}
```

### 커스텀 ETag 구현

```java
@GetMapping("/members/{id}")
public ResponseEntity<Member> getMember(@PathVariable Long id,
                                         WebRequest request) {
    Member member = memberService.findById(id);

    // ETag 생성 (버전 기반)
    String etag = "\"" + member.getVersion() + "\"";

    // 변경 여부 확인
    if (request.checkNotModified(etag)) {
        return null;  // 304 Not Modified 자동 반환
    }

    return ResponseEntity.ok()
        .eTag(etag)
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
        .body(member);
}
```

---

## 프록시 캐시

클라이언트와 원 서버 사이에서 캐시 역할을 수행합니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          프록시 캐시 구조                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [한국 클라이언트들]                                                        │
│        │                                                                    │
│        │         ┌──────────────────┐                                      │
│        └────────→│  프록시 캐시 서버  │                                      │
│        └────────→│    (한국 위치)    │                                      │
│        └────────→│                  │                                      │
│                  └────────┬─────────┘                                      │
│                           │                                                 │
│                           │  캐시 미스 시에만 요청                          │
│                           ▼                                                 │
│                  ┌──────────────────┐                                      │
│                  │    원 서버        │                                      │
│                  │   (미국 위치)     │                                      │
│                  └──────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 프록시 캐시 관련 헤더

| 헤더 | 설명 |
|------|------|
| **Cache-Control: public** | 프록시 캐시 저장 허용 |
| **Cache-Control: private** | 브라우저 캐시만 저장 (기본값) |
| **Cache-Control: s-maxage** | 프록시 캐시용 max-age |

---

## 캐시 무효화

**확실한 캐시 무효화**가 필요할 때 사용합니다.

```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
```

| 지시어 | 이유 |
|--------|------|
| no-cache | 항상 원 서버 검증 |
| no-store | 저장 금지 |
| must-revalidate | 원 서버 접근 불가 시 오류 반환 |
| Pragma: no-cache | HTTP/1.0 하위 호환 |

### no-cache vs must-revalidate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              no-cache vs must-revalidate (원 서버 접근 불가 시)             │
├──────────────────────────────────┬──────────────────────────────────────────┤
│           no-cache               │         must-revalidate                  │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  프록시 → 원서버 (연결 실패)     │  프록시 → 원서버 (연결 실패)             │
│                                  │                                          │
│  프록시가 판단:                  │  프록시가 판단:                          │
│  "오래된 캐시라도 보여주자"      │  "검증 필수, 실패하면 오류"              │
│  → 200 OK (오래된 데이터)        │  → 504 Gateway Timeout                   │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

---

## Spring Boot 캐시 설정 예제

### 정적 리소스 캐시

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS)
                .cachePublic());
    }
}
```

### API 응답 캐시

```java
@GetMapping("/products")
public ResponseEntity<List<Product>> getProducts() {
    List<Product> products = productService.findAll();

    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES)
            .mustRevalidate())
        .body(products);
}

// 민감 정보 - 캐시 금지
@GetMapping("/users/me")
public ResponseEntity<User> getCurrentUser() {
    User user = userService.getCurrentUser();

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(user);
}
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **Content-Type** | 표현 데이터의 형식 |
| **Content Negotiation** | 클라이언트-서버 간 최적의 표현 협상 |
| **Cookie** | 상태 유지를 위한 클라이언트 저장 데이터 |
| **Cache-Control** | 캐시 동작을 제어하는 헤더 |
| **ETag** | 리소스 버전을 식별하는 태그 |
| **Last-Modified** | 리소스의 마지막 수정 시간 |
| **304 Not Modified** | 캐시 재사용 가능 응답 |
| **Conditional Request** | 조건에 따라 응답을 분기하는 요청 |
| **Proxy Cache** | 클라이언트와 서버 사이의 캐시 |
| **must-revalidate** | 만료 후 반드시 서버 검증 필수 |
