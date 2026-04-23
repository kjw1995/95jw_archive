---
title: "05. 고급 설계 원칙"
weight: 5
---

## 1. 고급 설계 개요

API의 안정성, 확장성, 사용성을 높이기 위한 설계 원칙을 다룬다.

| 주제 | 핵심 개념 |
|:---|:---|
| Rate Limiting | 과부하 방지, 429 응답 |
| Pagination | 대량 데이터 분할 전송 |
| HATEOAS | 하이퍼미디어로 탐색 가능 |
| i18n / L10n | 다국어, 로케일 협상 |
| Testing | REST Assured 자동화 |
| Documentation | Swagger, OpenAPI |

## 2. 사용량 제한 (Rate Limiting)

클라이언트의 요청 횟수를 제한해 서버 과부하와 악성 트래픽을 차단한다.

### 동작 흐름

```text
Client              Limiter        Server
  │                   │              │
  │── Req #1 ───────→│──────────────→│
  │←─ 200 OK ────────│←──────────────│
  │   Remaining: 99  │              │
  │                   │              │
  │── Req #101 ─────→│   X 차단     │
  │←─ 429 ───────────│              │
  │   Retry-After:   │              │
  │     3600         │              │
```

### 주요 헤더

| 헤더 | 설명 |
|:---|:---|
| X-RateLimit-Limit | 윈도우 내 최대 요청 수 |
| X-RateLimit-Remaining | 남은 요청 수 |
| X-RateLimit-Reset | 리셋 시각 (Unix) |
| Retry-After | 재시도까지 대기(초) |

### 429 Too Many Requests

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1609459200
Retry-After: 3600

{
    "error": "Too Many Requests",
    "message": "Rate limit exceeded.",
    "retryAfter": 3600
}
```

### 알고리즘 비교

| 알고리즘 | 장점 | 단점 |
|:---|:---|:---|
| Fixed Window | 구현 간단 | 경계 버스트 2배 |
| Sliding Window | 정확한 제한 | 메모리·연산 증가 |
| Token Bucket | 버스트 허용 | 구현 복잡 |
| Leaky Bucket | 균일한 처리 | 버스트 불가 |

```text
[Fixed Window]
┌────────────┬────────────┐
│ 00:00-01:00 │ 01:00-02:00 │
│ 100 req OK │ 100 req OK │
└────────────┴────────────┘

[Token Bucket]
┌────────────┐
│ 🪙🪙🪙🪙🪙   │ ← 일정 속도 추가
│  (버킷)    │ ← 요청 시 소비
└────────────┘

[Leaky Bucket]
┌────────────┐
│ ~요청 누적~ │ ← 버킷에 쌓임
│    │       │ ← 일정 속도 처리
└────┼───────┘
     ▼
```

### Bucket4j 구현

```java
@Component
public class RateLimitInterceptor
        implements HandlerInterceptor {

    private final Map<String, Bucket> buckets =
        new ConcurrentHashMap<>();

    private Bucket createNewBucket() {
        Bandwidth limit = Bandwidth.classic(100,
            Refill.intervally(100, Duration.ofHours(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        String clientId = getClientId(request);
        Bucket bucket = buckets.computeIfAbsent(
            clientId, k -> createNewBucket());

        ConsumptionProbe probe =
            bucket.tryConsumeAndReturnRemaining(1);

        response.addHeader("X-RateLimit-Limit", "100");
        response.addHeader("X-RateLimit-Remaining",
            String.valueOf(probe.getRemainingTokens()));

        if (probe.isConsumed()) return true;

        response.addHeader("Retry-After",
            String.valueOf(
                probe.getNanosToWaitForRefill() / 1_000_000_000));
        response.sendError(
            HttpStatus.TOO_MANY_REQUESTS.value(),
            "Rate limit exceeded");
        return false;
    }

    private String getClientId(HttpServletRequest request) {
        String apiKey = request.getHeader("X-API-Key");
        return apiKey != null ? apiKey : request.getRemoteAddr();
    }
}
```

### Resilience4j 구현

```java
@Configuration
public class RateLimiterConfig {

    @Bean
    public RateLimiter rateLimiter() {
        RateLimiterConfig config = RateLimiterConfig.custom()
            .limitForPeriod(100)
            .limitRefreshPeriod(Duration.ofHours(1))
            .timeoutDuration(Duration.ZERO)
            .build();

        return RateLimiter.of("api-rate-limiter", config);
    }
}
```

{{< callout type="warning" >}}
429를 받았을 때 즉시 재시도하면 제한이 갱신되지 않아 계속 실패한다. **Exponential Backoff** 를 적용하고 `Retry-After` 값을 존중해야 한다. 캐싱·배치 API·웹훅으로 호출 자체를 줄이는 설계가 우선이다.
{{< /callout >}}

## 3. 응답 페이지네이션

대량 데이터를 페이지 단위로 나누어 전송한다.

### 적용 전후 비교

| 항목 | 미적용 | 적용 |
|:---|:---|:---|
| 응답 건수 | 100,000건 | 20건 |
| 용량 | 50MB | 10KB |
| 응답 시간 | 30초 | 50ms |
| 위험 | 메모리 부족, 타임아웃 | 빠른 응답 |

### 오프셋 기반

```http
GET /api/v1/users?page=2&size=20 HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json

{
    "content": [
        {"id": 21, "name": "User 21"},
        {"id": 22, "name": "User 22"}
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
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping
    public Page<User> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sort) {

        Pageable pageable = PageRequest.of(
            page, size, Sort.by(sort));
        return userRepository.findAll(pageable);
    }
}
```

| 장점 | 단점 |
|:---|:---|
| 구현 간단 | 대량 데이터에서 성능 저하 |
| 임의 페이지 접근 | 추가/삭제 시 중복·누락 |
| 총 페이지 수 제공 | OFFSET 쿼리 비효율 |

### 커서 기반

마지막 조회 ID를 기준으로 다음 데이터를 조회한다.

```text
1차: GET /users?size=3
┌────┬────┬────┬────┐
│ID:1│ID:2│ID:3│ID:4│
└────┴────┴────┴────┘
◄── 반환 ──►
          ↑
      next=ID:3

2차: GET /users?size=3
       &cursor=ID:3
┌────┬────┬────┬────┐
│ID:1│ID:2│ID:3│ID:4│
└────┴────┴────┴────┘
          ↑ 시작점
          ◄── 반환 ──►
```

```http
GET /api/v1/users?size=20&cursor=eyJpZCI6MTAwfQ==

HTTP/1.1 200 OK

{
    "data": [
        {"id": 101, "name": "User 101"},
        {"id": 102, "name": "User 102"}
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
@GetMapping
public CursorPage<User> getUsers(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {

    Long lastId = decodeCursor(cursor);

    List<User> users = userRepository.findByIdGreaterThan(
        lastId,
        PageRequest.of(0, size + 1, Sort.by("id")));

    boolean hasNext = users.size() > size;
    if (hasNext) users = users.subList(0, size);

    String nextCursor = hasNext
        ? encodeCursor(users.get(size - 1).getId())
        : null;

    return new CursorPage<>(users, nextCursor, hasNext);
}

private Long decodeCursor(String cursor) {
    if (cursor == null) return 0L;
    return Long.parseLong(new String(
        Base64.getDecoder().decode(cursor)));
}

private String encodeCursor(Long id) {
    return Base64.getEncoder().encodeToString(
        String.valueOf(id).getBytes());
}
```

| 장점 | 단점 |
|:---|:---|
| 대량에서도 성능 일정 | 임의 페이지 접근 불가 |
| 추가·삭제에 안전 | 총 페이지 수 모름 |
| 실시간 피드에 적합 | 구현이 복잡 |

### 기간 기반

```http
GET /api/v1/events?since=1609459200&until=1612137600&limit=50
```

| 파라미터 | 설명 |
|:---|:---|
| since | 시작 시점 (Unix) |
| until | 종료 시점 (Unix) |
| limit | 최대 결과 수 |

### 선택 가이드

| 데이터 특성 | 권장 방식 |
|:---|:---|
| 정적 데이터, 임의 페이지 | 오프셋 기반 |
| 대량 실시간 피드 | 커서 기반 |
| 시간 범위 조회 | 기간 기반 |

## 4. 국제화와 지역화 (i18n / L10n)

### 언어 협상 흐름

```text
Client                     Server
  │                          │
  │── GET /api/products ───→│
  │   Accept-Language:       │
  │     ko-KR, en;q=0.9      │
  │                 협상 수행 │
  │                 ko-KR    │
  │                          │
  │←── 200 OK ──────────────│
  │    Content-Language:     │
  │      ko-KR               │
  │    {"name": "노트북"}    │
```

### 로케일 지정 방법

| 방법 | 예시 | 장점 |
|:---|:---|:---|
| HTTP 헤더 | `Accept-Language: ko-KR` | 표준, 브라우저 자동 |
| 쿼리 파라미터 | `?lang=ko` | 명시적, 테스트 용이 |
| URL 경로 | `/ko/products` | SEO 친화 |
| 쿠키 | `lang=ko` | 사용자 설정 유지 |

### 관련 헤더

| 헤더 | 방향 | 설명 |
|:---|:---|:---|
| Accept-Language | 요청 | 클라이언트 선호 언어 |
| Content-Language | 응답 | 응답 콘텐츠 언어 |

```http
GET /api/v1/products HTTP/1.1
Accept-Language: ko-KR, ko;q=0.9, en-US;q=0.8, en;q=0.7

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

### Spring Boot i18n

```java
@Configuration
public class LocaleConfig implements WebMvcConfigurer {

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver =
            new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.KOREAN);
        return resolver;
    }

    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource source =
            new ResourceBundleMessageSource();
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

## 5. HATEOAS

Hypermedia as the Engine of Application State. 응답에 관련 리소스 링크를 포함해 클라이언트가 API를 **링크 따라** 탐색하게 한다.

### 일반 REST vs HATEOAS

```text
[일반 REST]
{
  "id": 123,
  "title": "REST Book",
  "author": "John"
}

[HATEOAS]
{
  "id": 123,
  "title": "REST Book",
  "author": "John",
  "_links": {
    "self":    {...},
    "author":  {...},
    "reviews": {...}
  }
}
```

| 관점 | 일반 REST | HATEOAS |
|:---|:---|:---|
| URL | 클라이언트 하드코딩 | 서버 응답으로 전달 |
| API 변경 | 클라이언트 수정 필요 | 유연하게 대응 |

### 링크 관계 (rel)

| rel | 설명 |
|:---|:---|
| self | 현재 리소스 |
| next / prev | 다음 / 이전 페이지 |
| first / last | 첫 / 마지막 페이지 |
| collection | 컬렉션 리소스 |
| item | 컬렉션 내 개별 항목 |

### HAL 형식

```json
{
    "id": 123,
    "title": "REST API Design",
    "isbn": "978-1234567890",
    "_links": {
        "self":     {"href": "/api/books/123"},
        "author":   {"href": "/api/authors/456"},
        "reviews":  {"href": "/api/books/123/reviews"},
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
@RestController
@RequestMapping("/api/v1/books")
public class BookController {

    @GetMapping("/{id}")
    public EntityModel<Book> getBook(@PathVariable Long id) {
        Book book = bookService.findById(id);

        return EntityModel.of(book,
            linkTo(methodOn(BookController.class).getBook(id))
                .withSelfRel(),
            linkTo(methodOn(BookController.class).getAllBooks())
                .withRel("collection"),
            linkTo(methodOn(AuthorController.class)
                .getAuthor(book.getAuthorId())).withRel("author"),
            linkTo(methodOn(ReviewController.class)
                .getReviewsForBook(id)).withRel("reviews")
        );
    }

    @GetMapping
    public CollectionModel<EntityModel<Book>> getAllBooks() {
        List<EntityModel<Book>> books = bookService.findAll().stream()
            .map(book -> EntityModel.of(book,
                linkTo(methodOn(BookController.class)
                    .getBook(book.getId())).withSelfRel()))
            .collect(Collectors.toList());

        return CollectionModel.of(books,
            linkTo(methodOn(BookController.class).getAllBooks())
                .withSelfRel());
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
            linkTo(methodOn(BookController.class)
                .getBook(book.getId())).withSelfRel()));
}
```

```json
{
    "_embedded": {
        "books": [
            {"id": 1, "title": "Book 1", "_links": {}},
            {"id": 2, "title": "Book 2", "_links": {}}
        ]
    },
    "_links": {
        "self":  {"href": "/api/v1/books?page=1&size=20"},
        "first": {"href": "/api/v1/books?page=0&size=20"},
        "prev":  {"href": "/api/v1/books?page=0&size=20"},
        "next":  {"href": "/api/v1/books?page=2&size=20"},
        "last":  {"href": "/api/v1/books?page=9&size=20"}
    },
    "page": {
        "size": 20,
        "totalElements": 200,
        "totalPages": 10,
        "number": 1
    }
}
```

{{< callout type="info" >}}
Richardson Maturity Model에서 HATEOAS는 **Level 3** 으로 REST의 최고 성숙도 단계이다. 완전한 HATEOAS 도입은 비용이 크므로 외부 파트너 API나 공용 플랫폼처럼 **변화에 유연해야 하는** 경우에 선택적으로 적용한다.
{{< /callout >}}

## 6. API 테스팅

### REST Assured

Java DSL 기반 REST API 테스트 프레임워크이다.

```java
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
            .body("_links.self.href",
                containsString("/books/123"));
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

## 7. API 문서화

### OpenAPI 3.0 (Swagger)

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Book API")
                .version("1.0.0")
                .description("RESTful API for Books")
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
        @ApiResponse(responseCode = "200",
            description = "Successfully retrieved book"),
        @ApiResponse(responseCode = "404",
            description = "Book not found"),
        @ApiResponse(responseCode = "429",
            description = "Rate limit exceeded")
    })
    @GetMapping("/{id}")
    public EntityModel<Book> getBook(
            @Parameter(description = "Book ID", required = true)
            @PathVariable Long id) {
        // ...
    }

    @Operation(summary = "Create a new book")
    @ApiResponse(responseCode = "201",
        description = "Book created successfully")
    @PostMapping
    public ResponseEntity<EntityModel<Book>> createBook(
            @RequestBody @Valid BookRequest request) {
        // ...
    }
}
```

```yaml
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

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Rate Limiting | 요청 횟수 제한 기법 |
| 429 Too Many Requests | 한도 초과 응답 코드 |
| Token Bucket | 버스트 허용 Rate Limiting |
| Pagination | 대량 데이터 페이지 분할 |
| Offset / Cursor | 페이지 번호 / 마지막 위치 기준 |
| i18n / L10n | 국제화 / 지역화 |
| HATEOAS | 하이퍼미디어 기반 상태 전이 |
| HAL | HATEOAS의 대표 표현 형식 |
| REST Assured | Java REST API 테스트 DSL |
| OpenAPI | REST API 명세 표준 |

{{< callout type="info" >}}
**용어 정리**
- **Rate Limiting**: 클라이언트 요청 횟수 제한
- **Throttling**: 요청 속도 조절
- **Token Bucket / Leaky Bucket**: 대표적인 Rate Limiting 알고리즘
- **Pagination**: 대량 데이터의 페이지 분할 전송
- **Cursor / Offset**: 커서 기반 / 오프셋 기반 페이지네이션 키
- **i18n / L10n**: Internationalization / Localization
- **HATEOAS**: 응답에 링크를 담아 API 탐색을 유도하는 제약
- **HAL**: Hypertext Application Language
- **REST Assured**: Java 기반 REST API 테스트 프레임워크
- **OpenAPI**: REST API 명세 표준 (구 Swagger Spec)
{{< /callout >}}
