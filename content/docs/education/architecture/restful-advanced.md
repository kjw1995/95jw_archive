---
title: "고급 설계 원칙"
weight: 5
---

## REST API 고급 설계

API의 안정성, 확장성, 사용성을 높이기 위한 고급 설계 원칙들을 다룬다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST API 고급 설계 원칙                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│   │ Rate Limiting │  │  Pagination   │  │   HATEOAS     │      │
│   │  (사용량 제한) │  │ (페이지네이션) │  │ (하이퍼미디어) │      │
│   ├───────────────┤  ├───────────────┤  ├───────────────┤      │
│   │ • 과부하 방지  │  │ • 대량 데이터  │  │ • 자기 기술적  │      │
│   │ • 공정한 사용  │  │ • 점진적 로딩  │  │ • 탐색 가능   │      │
│   │ • 429 응답    │  │ • 커서/오프셋  │  │ • 링크 제공   │      │
│   └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│   │     i18n      │  │   Testing     │  │Documentation  │      │
│   │  (국제화)      │  │   (테스팅)     │  │   (문서화)     │      │
│   ├───────────────┤  ├───────────────┤  ├───────────────┤      │
│   │ • 다국어 지원  │  │ • REST Assured│  │ • Swagger     │      │
│   │ • 로케일 협상  │  │ • 자동화 테스트│  │ • OpenAPI     │      │
│   └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 사용량 제한 (Rate Limiting)

클라이언트의 요청 개수를 제한하여 서버 과부하를 방지하는 기법

### Rate Limiting 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rate Limiting 동작                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                      Rate Limiter              Server  │
│     │                              │                       │    │
│     │──── Request #1 ────────────►│──────────────────────►│    │
│     │◄─── 200 OK ─────────────────│◄──────────────────────│    │
│     │     X-RateLimit-Remaining: 99                        │    │
│     │                              │                       │    │
│     │──── Request #2 ────────────►│──────────────────────►│    │
│     │◄─── 200 OK ─────────────────│◄──────────────────────│    │
│     │     X-RateLimit-Remaining: 98                        │    │
│     │                              │                       │    │
│     │        ... (반복) ...        │                       │    │
│     │                              │                       │    │
│     │──── Request #101 ──────────►│         X             │    │
│     │◄─── 429 Too Many Requests ──│      (차단됨)          │    │
│     │     Retry-After: 3600       │                       │    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rate Limiting 헤더

| 헤더 | 설명 | 예시 |
|------|------|------|
| **X-RateLimit-Limit** | 시간 윈도우 내 최대 요청 수 | `X-RateLimit-Limit: 1000` |
| **X-RateLimit-Remaining** | 남은 요청 수 | `X-RateLimit-Remaining: 950` |
| **X-RateLimit-Reset** | 제한 리셋 시간 (Unix timestamp) | `X-RateLimit-Reset: 1609459200` |
| **Retry-After** | 재시도까지 대기 시간 (초) | `Retry-After: 3600` |

### 429 Too Many Requests 응답

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1609459200
Retry-After: 3600

{
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Maximum 100 requests per hour allowed.",
    "retryAfter": 3600
}
```

### Rate Limiting 알고리즘

```
┌─────────────────────────────────────────────────────────────────┐
│                 Rate Limiting 알고리즘 비교                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fixed Window (고정 윈도우)                                   │
│     ┌──────────────────┬──────────────────┐                    │
│     │ 00:00 - 01:00    │ 01:00 - 02:00    │                    │
│     │ 100 requests OK  │ 100 requests OK  │                    │
│     └──────────────────┴──────────────────┘                    │
│     → 간단하지만 경계에서 버스트 가능                             │
│                                                                 │
│  2. Sliding Window (슬라이딩 윈도우)                              │
│     ────────────────────────────────────────                   │
│          ◄─────── 1시간 윈도우 ───────►                         │
│     → 더 정확하지만 메모리 사용 증가                               │
│                                                                 │
│  3. Token Bucket (토큰 버킷)                                     │
│     ┌─────────────┐                                            │
│     │ 🪙🪙🪙🪙🪙    │  ← 토큰이 일정 속도로 추가                   │
│     │  (버킷)     │  ← 요청 시 토큰 소비                         │
│     └─────────────┘  → 버스트 허용, 평균 속도 제한                │
│                                                                 │
│  4. Leaky Bucket (누출 버킷)                                     │
│     ┌─────────────┐                                            │
│     │ ~~~요청~~~  │  ← 요청이 버킷에 쌓임                        │
│     │     │       │  ← 일정 속도로 처리                         │
│     └─────┼───────┘  → 균일한 처리 속도 보장                     │
│           ▼                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 알고리즘 | 장점 | 단점 | 사용 사례 |
|----------|------|------|----------|
| **Fixed Window** | 구현 간단, 메모리 효율 | 경계에서 2배 버스트 가능 | 간단한 API |
| **Sliding Window** | 정확한 제한 | 메모리/연산 증가 | 정밀한 제어 필요 |
| **Token Bucket** | 버스트 허용, 유연함 | 구현 복잡 | AWS API Gateway |
| **Leaky Bucket** | 균일한 처리 속도 | 버스트 불가 | 네트워크 트래픽 |

### Spring Boot Rate Limiter 구현

#### Bucket4j 사용

```java
// 의존성: com.bucket4j:bucket4j-core

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    private Bucket createNewBucket() {
        Bandwidth limit = Bandwidth.classic(100, Refill.intervally(100, Duration.ofHours(1)));
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String clientId = getClientId(request);
        Bucket bucket = buckets.computeIfAbsent(clientId, k -> createNewBucket());

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        response.addHeader("X-RateLimit-Limit", "100");
        response.addHeader("X-RateLimit-Remaining",
            String.valueOf(probe.getRemainingTokens()));

        if (probe.isConsumed()) {
            return true;
        }

        response.addHeader("Retry-After",
            String.valueOf(probe.getNanosToWaitForRefill() / 1_000_000_000));
        response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(),
            "Rate limit exceeded");
        return false;
    }

    private String getClientId(HttpServletRequest request) {
        // API 키 또는 IP 기반 식별
        String apiKey = request.getHeader("X-API-Key");
        return apiKey != null ? apiKey : request.getRemoteAddr();
    }
}
```

#### Resilience4j 사용

```java
// 의존성: io.github.resilience4j:resilience4j-ratelimiter

@Configuration
public class RateLimiterConfig {

    @Bean
    public RateLimiter rateLimiter() {
        RateLimiterConfig config = RateLimiterConfig.custom()
                .limitForPeriod(100)                    // 시간당 100 요청
                .limitRefreshPeriod(Duration.ofHours(1))
                .timeoutDuration(Duration.ZERO)         // 대기 없이 즉시 거부
                .build();

        return RateLimiter.of("api-rate-limiter", config);
    }
}
```

```java
@RestController
@RequestMapping("/api/v1")
public class ApiController {

    private final RateLimiter rateLimiter;

    @GetMapping("/data")
    public ResponseEntity<Data> getData() {
        return RateLimiter.decorateSupplier(rateLimiter, () -> {
            // 비즈니스 로직
            return ResponseEntity.ok(dataService.getData());
        }).get();
    }
}
```

### Rate Limiting 베스트 프랙티스

```
┌─────────────────────────────────────────────────────────────────┐
│              사용량 한도 초과 방지 베스트 프랙티스                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 캐싱 활용                                                    │
│     └─ 동일 요청은 캐시에서 응답, API 호출 횟수 감소               │
│                                                                 │
│  ✅ 반복 호출 방지                                               │
│     └─ 루프 내 API 호출 지양, 배치 API 활용                       │
│                                                                 │
│  ✅ 요청 로깅                                                    │
│     └─ 클라이언트 측에서 요청 개수 추적                           │
│                                                                 │
│  ✅ 폴링 대신 웹훅/SSE 사용                                       │
│     └─ 리소스 변경 시 서버가 푸시                                 │
│                                                                 │
│  ✅ 응답 최적화                                                  │
│     └─ 필요한 모든 정보를 한 번에 응답                            │
│                                                                 │
│  ✅ Exponential Backoff 적용                                     │
│     └─ 429 응답 시 점진적으로 재시도 간격 증가                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 응답 페이지네이션

대량 데이터를 페이지 단위로 나누어 전송하는 기법

### 페이지네이션의 필요성

```
┌─────────────────────────────────────────────────────────────────┐
│                   페이지네이션 필요성                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ❌ 페이지네이션 없이                 ✅ 페이지네이션 적용         │
│  ┌────────────────────┐            ┌────────────────────┐      │
│  │ GET /users         │            │ GET /users?page=1  │      │
│  │                    │            │      &size=20      │      │
│  │ 응답: 100,000건    │            │                    │      │
│  │ 용량: 50MB         │            │ 응답: 20건          │      │
│  │ 시간: 30초         │            │ 용량: 10KB          │      │
│  │                    │            │ 시간: 50ms          │      │
│  │ → 메모리 부족      │            │                    │      │
│  │ → 타임아웃         │            │ → 빠른 응답         │      │
│  │ → 느린 렌더링      │            │ → 점진적 로딩       │      │
│  └────────────────────┘            └────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 페이지네이션 유형

#### 1. 오프셋 기반 페이지네이션

가장 일반적인 방식으로, 페이지 번호와 크기로 조회

```http
GET /api/v1/users?page=2&size=20 HTTP/1.1

# 응답
HTTP/1.1 200 OK
Content-Type: application/json

{
    "content": [
        {"id": 21, "name": "User 21"},
        {"id": 22, "name": "User 22"},
        ...
    ],
    "page": 2,
    "size": 20,
    "totalElements": 1000,
    "totalPages": 50,
    "first": false,
    "last": false
}
```

```java
// Spring Data JPA 구현
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping
    public Page<User> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sort) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(sort));
        return userRepository.findAll(pageable);
    }
}
```

| 장점 | 단점 |
|------|------|
| 구현 간단 | 대량 데이터에서 성능 저하 |
| 임의 페이지 접근 가능 | 데이터 추가/삭제 시 중복/누락 |
| 총 페이지 수 제공 | `OFFSET` 쿼리 비효율 |

#### 2. 커서 기반 페이지네이션

마지막 조회 항목을 기준으로 다음 데이터 조회

```
┌─────────────────────────────────────────────────────────────────┐
│                  커서 페이지네이션 동작                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1차 요청: GET /users?size=3                                   │
│   ┌─────────────────────────────────────────┐                  │
│   │  ID:1  │  ID:2  │  ID:3  │  ID:4  │ ... │  데이터          │
│   └────────┴────────┴────────┴────────┴─────┘                  │
│   ◄──── 반환 ────►    ↑                                        │
│                       │                                         │
│                    nextCursor = "ID:3"                         │
│                                                                 │
│   2차 요청: GET /users?size=3&cursor=ID:3                       │
│   ┌─────────────────────────────────────────┐                  │
│   │  ID:1  │  ID:2  │  ID:3  │  ID:4  │ ... │                  │
│   └────────┴────────┴────────┴────────┴─────┘                  │
│                       ↑       ◄── 반환 ──►                      │
│                    시작점                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```http
# 요청
GET /api/v1/users?size=20&cursor=eyJpZCI6MTAwfQ== HTTP/1.1

# 응답
HTTP/1.1 200 OK

{
    "data": [
        {"id": 101, "name": "User 101"},
        {"id": 102, "name": "User 102"},
        ...
    ],
    "cursors": {
        "next": "eyJpZCI6MTIwfQ==",
        "previous": "eyJpZCI6MTAxfQ==",
        "hasNext": true,
        "hasPrevious": true
    }
}
```

```java
// 커서 페이지네이션 구현
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping
    public CursorPage<User> getUsers(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int size) {

        Long lastId = decodeCursor(cursor);

        List<User> users = userRepository.findByIdGreaterThan(lastId,
                PageRequest.of(0, size + 1, Sort.by("id")));

        boolean hasNext = users.size() > size;
        if (hasNext) {
            users = users.subList(0, size);
        }

        String nextCursor = hasNext ? encodeCursor(users.get(size - 1).getId()) : null;

        return new CursorPage<>(users, nextCursor, hasNext);
    }

    private Long decodeCursor(String cursor) {
        if (cursor == null) return 0L;
        return Long.parseLong(new String(Base64.getDecoder().decode(cursor)));
    }

    private String encodeCursor(Long id) {
        return Base64.getEncoder().encodeToString(String.valueOf(id).getBytes());
    }
}
```

| 장점 | 단점 |
|------|------|
| 대량 데이터에서도 일정한 성능 | 임의 페이지 접근 불가 |
| 데이터 추가/삭제에 안전 | 총 페이지 수 알 수 없음 |
| 실시간 피드에 적합 | 구현이 복잡함 |

#### 3. 기간 기반 페이지네이션

특정 시간 범위의 데이터 조회

```http
GET /api/v1/events?since=1609459200&until=1612137600&limit=50 HTTP/1.1
```

| 파라미터 | 설명 |
|----------|------|
| `since` | 시작 시점 (Unix timestamp) |
| `until` | 종료 시점 (Unix timestamp) |
| `limit` | 최대 결과 수 |

### 페이지네이션 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                페이지네이션 방식 선택 가이드                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   데이터 특성                          권장 방식                  │
│  ┌────────────────────────────────┬───────────────────────┐    │
│  │ 정적 데이터, 임의 페이지 접근    │ 오프셋 기반            │    │
│  │ 예: 상품 목록, 검색 결과         │                       │    │
│  ├────────────────────────────────┼───────────────────────┤    │
│  │ 대량 데이터, 실시간 피드         │ 커서 기반              │    │
│  │ 예: 타임라인, 채팅 기록          │                       │    │
│  ├────────────────────────────────┼───────────────────────┤    │
│  │ 시간 범위 조회                   │ 기간 기반              │    │
│  │ 예: 로그, 이벤트 히스토리        │                       │    │
│  └────────────────────────────────┴───────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 국제화와 지역화 (i18n & L10n)

### 언어 협상 (Language Negotiation)

```
┌─────────────────────────────────────────────────────────────────┐
│                      언어 협상 흐름                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                                         Server         │
│     │                                              │            │
│     │─────── GET /api/products ──────────────────►│            │
│     │        Accept-Language: ko-KR, en;q=0.9     │            │
│     │                                              │            │
│     │                                 언어 협상 수행│            │
│     │                                 ko-KR 선택   │            │
│     │                                              │            │
│     │◄──────── 200 OK ────────────────────────────│            │
│     │          Content-Language: ko-KR            │            │
│     │          {"name": "노트북", "price": ...}    │            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 지역화 파라미터 지정 방법

| 방법 | 예시 | 장점 |
|------|------|------|
| **HTTP 헤더** | `Accept-Language: ko-KR` | 표준 방식, 브라우저 자동 설정 |
| **쿼리 파라미터** | `?lang=ko` | 명시적, 테스트 용이 |
| **URL 경로** | `/ko/products` | SEO 친화적 |
| **쿠키** | `lang=ko` | 사용자 설정 유지 |

### 주요 HTTP 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `Accept-Language` | 요청 | 클라이언트 선호 언어 (ISO-639 + ISO-3166) |
| `Content-Language` | 응답 | 응답 콘텐츠의 언어 |

```http
# 요청
GET /api/v1/products HTTP/1.1
Accept-Language: ko-KR, ko;q=0.9, en-US;q=0.8, en;q=0.7

# 응답
HTTP/1.1 200 OK
Content-Language: ko-KR
Content-Type: application/json

{
    "products": [
        {"name": "노트북", "description": "고성능 노트북"},
        {"name": "키보드", "description": "무선 키보드"}
    ]
}
```

### Spring Boot i18n 구현

```java
@Configuration
public class LocaleConfig implements WebMvcConfigurer {

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.KOREAN);
        return resolver;
    }

    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("messages");
        source.setDefaultEncoding("UTF-8");
        return source;
    }
}
```

```properties
# messages_ko.properties
product.name=상품명
product.price=가격
error.not_found=해당 상품을 찾을 수 없습니다

# messages_en.properties
product.name=Product Name
product.price=Price
error.not_found=Product not found
```

---

## HATEOAS

Hypermedia as the Engine of Application State - 응답에 관련 리소스 링크를 포함하여 클라이언트가 API를 탐색할 수 있게 하는 아키텍처 제약

### HATEOAS 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                   HATEOAS 전후 비교                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   일반 REST 응답                      HATEOAS 응답               │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ {                       │       │ {                       │ │
│  │   "id": 123,            │       │   "id": 123,            │ │
│  │   "title": "REST Book", │       │   "title": "REST Book", │ │
│  │   "author": "John"      │       │   "author": "John",     │ │
│  │ }                       │       │   "_links": {           │ │
│  │                         │       │     "self": {...},      │ │
│  │                         │       │     "author": {...},    │ │
│  │                         │       │     "reviews": {...}    │ │
│  │                         │       │   }                     │ │
│  │                         │       │ }                       │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│   클라이언트가 URL 하드코딩         클라이언트가 링크 따라 탐색     │
│   API 변경 시 클라이언트 수정       API 변경에 유연하게 대응       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 링크 관계 (rel)

| rel | 설명 |
|-----|------|
| `self` | 현재 리소스 자신 |
| `next` | 다음 페이지 |
| `prev` | 이전 페이지 |
| `first` | 첫 번째 페이지 |
| `last` | 마지막 페이지 |
| `collection` | 컬렉션 리소스 |
| `item` | 컬렉션 내 개별 항목 |

### HAL (Hypertext Application Language) 형식

가장 널리 사용되는 HATEOAS 표현 형식

```json
{
    "id": 123,
    "title": "REST API Design",
    "isbn": "978-1234567890",
    "_links": {
        "self": {
            "href": "/api/books/123"
        },
        "author": {
            "href": "/api/authors/456"
        },
        "reviews": {
            "href": "/api/books/123/reviews"
        },
        "purchase": {
            "href": "/api/orders",
            "method": "POST"
        }
    },
    "_embedded": {
        "author": {
            "id": 456,
            "name": "John Doe",
            "_links": {
                "self": {"href": "/api/authors/456"}
            }
        }
    }
}
```

### Spring HATEOAS 구현

```java
// 의존성: org.springframework.boot:spring-boot-starter-hateoas

@RestController
@RequestMapping("/api/v1/books")
public class BookController {

    @GetMapping("/{id}")
    public EntityModel<Book> getBook(@PathVariable Long id) {
        Book book = bookService.findById(id);

        return EntityModel.of(book,
            linkTo(methodOn(BookController.class).getBook(id)).withSelfRel(),
            linkTo(methodOn(BookController.class).getAllBooks()).withRel("collection"),
            linkTo(methodOn(AuthorController.class).getAuthor(book.getAuthorId()))
                .withRel("author"),
            linkTo(methodOn(ReviewController.class).getReviewsForBook(id))
                .withRel("reviews")
        );
    }

    @GetMapping
    public CollectionModel<EntityModel<Book>> getAllBooks() {
        List<EntityModel<Book>> books = bookService.findAll().stream()
            .map(book -> EntityModel.of(book,
                linkTo(methodOn(BookController.class).getBook(book.getId())).withSelfRel()
            ))
            .collect(Collectors.toList());

        return CollectionModel.of(books,
            linkTo(methodOn(BookController.class).getAllBooks()).withSelfRel()
        );
    }
}
```

```json
// 응답 예시
{
    "id": 123,
    "title": "REST API Design",
    "isbn": "978-1234567890",
    "_links": {
        "self": {"href": "http://api.example.com/api/v1/books/123"},
        "collection": {"href": "http://api.example.com/api/v1/books"},
        "author": {"href": "http://api.example.com/api/v1/authors/456"},
        "reviews": {"href": "http://api.example.com/api/v1/books/123/reviews"}
    }
}
```

### 페이지네이션과 HATEOAS

```java
@GetMapping
public PagedModel<EntityModel<Book>> getBooks(Pageable pageable) {
    Page<Book> page = bookService.findAll(pageable);

    return pagedResourcesAssembler.toModel(page,
        book -> EntityModel.of(book,
            linkTo(methodOn(BookController.class).getBook(book.getId())).withSelfRel()
        )
    );
}
```

```json
{
    "_embedded": {
        "books": [
            {"id": 1, "title": "Book 1", "_links": {...}},
            {"id": 2, "title": "Book 2", "_links": {...}}
        ]
    },
    "_links": {
        "self": {"href": "/api/v1/books?page=1&size=20"},
        "first": {"href": "/api/v1/books?page=0&size=20"},
        "prev": {"href": "/api/v1/books?page=0&size=20"},
        "next": {"href": "/api/v1/books?page=2&size=20"},
        "last": {"href": "/api/v1/books?page=9&size=20"}
    },
    "page": {
        "size": 20,
        "totalElements": 200,
        "totalPages": 10,
        "number": 1
    }
}
```

> **참고**: Richardson Maturity Model에서 HATEOAS는 Level 3으로, REST의 최고 성숙도 단계이다.

---

## API 테스팅

### REST Assured

Java DSL 기반 REST API 테스트 프레임워크

```java
// 의존성: io.rest-assured:rest-assured

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
public class BookApiTest {

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.basePath = "/api/v1";
    }

    @Test
    void shouldGetBookById() {
        given()
            .pathParam("id", 123)
        .when()
            .get("/books/{id}")
        .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("id", equalTo(123))
            .body("title", notNullValue())
            .body("_links.self.href", containsString("/books/123"));
    }

    @Test
    void shouldCreateBook() {
        String requestBody = """
            {
                "title": "New Book",
                "isbn": "978-1234567890",
                "authorId": 456
            }
            """;

        given()
            .contentType(ContentType.JSON)
            .body(requestBody)
        .when()
            .post("/books")
        .then()
            .statusCode(201)
            .header("Location", containsString("/books/"))
            .body("id", notNullValue())
            .body("title", equalTo("New Book"));
    }

    @Test
    void shouldReturnNotFoundForMissingBook() {
        given()
            .pathParam("id", 99999)
        .when()
            .get("/books/{id}")
        .then()
            .statusCode(404)
            .body("error", equalTo("Not Found"));
    }

    @Test
    void shouldReturnTooManyRequestsWhenRateLimited() {
        // 100번 초과 요청
        for (int i = 0; i < 101; i++) {
            get("/books");
        }

        given()
        .when()
            .get("/books")
        .then()
            .statusCode(429)
            .header("Retry-After", notNullValue());
    }
}
```

---

## API 문서화

### OpenAPI 3.0 (Swagger)

```java
// 의존성: org.springdoc:springdoc-openapi-starter-webmvc-ui

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Book API")
                        .version("1.0.0")
                        .description("RESTful API for Book Management")
                        .contact(new Contact()
                                .name("API Support")
                                .email("support@example.com")))
                .externalDocs(new ExternalDocumentation()
                        .description("Wiki Documentation")
                        .url("https://wiki.example.com/docs"));
    }
}
```

```java
@RestController
@RequestMapping("/api/v1/books")
@Tag(name = "Books", description = "Book management API")
public class BookController {

    @Operation(
        summary = "Get a book by ID",
        description = "Returns a single book with HATEOAS links"
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Successfully retrieved book"),
        @ApiResponse(responseCode = "404", description = "Book not found"),
        @ApiResponse(responseCode = "429", description = "Rate limit exceeded")
    })
    @GetMapping("/{id}")
    public EntityModel<Book> getBook(
            @Parameter(description = "Book ID", required = true)
            @PathVariable Long id) {
        // ...
    }

    @Operation(summary = "Create a new book")
    @ApiResponse(responseCode = "201", description = "Book created successfully")
    @PostMapping
    public ResponseEntity<EntityModel<Book>> createBook(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                description = "Book to create",
                required = true,
                content = @Content(schema = @Schema(implementation = BookRequest.class))
            )
            @RequestBody @Valid BookRequest request) {
        // ...
    }
}
```

```yaml
# 생성된 OpenAPI 스펙 (일부)
openapi: 3.0.1
info:
  title: Book API
  version: 1.0.0
paths:
  /api/v1/books/{id}:
    get:
      tags:
        - Books
      summary: Get a book by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: Successfully retrieved book
        '404':
          description: Book not found
        '429':
          description: Rate limit exceeded
```

Swagger UI 접속: `http://localhost:8080/swagger-ui.html`

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **Rate Limiting** | API 요청 횟수 제한 기법 |
| **Throttling** | 요청 속도 조절 장치 |
| **429 Too Many Requests** | 요청 한도 초과 응답 코드 |
| **Token Bucket** | 토큰 기반 Rate Limiting 알고리즘 |
| **Pagination** | 대량 데이터 페이지 분할 |
| **Cursor** | 결과 셋의 위치를 가리키는 포인터 |
| **Offset** | 건너뛸 레코드 수 |
| **i18n** | Internationalization, 국제화 |
| **L10n** | Localization, 지역화 |
| **HATEOAS** | 하이퍼미디어 기반 상태 전이 엔진 |
| **HAL** | Hypertext Application Language |
| **REST Assured** | Java REST API 테스트 DSL |
| **OpenAPI** | REST API 명세 표준 (구 Swagger Spec) |
