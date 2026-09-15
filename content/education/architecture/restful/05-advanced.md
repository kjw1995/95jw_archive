---
title: "05. 고급 설계 원칙"
date: 2026-04-23
weight: 5
---

[04. 성능을 고려한 설계](../04-performance)에서 넘치는 요청은 429로 거절하고 목록은 쪽으로 나눈다고 했고, [01](../01-basics)장은 응답이 다음 주소를 담는 3단계를 이 장으로 미뤘다. 이 장은 API를 오래 운영할 때 필요한 것들이다. 원리는 셋이다. 첫째, **얼마나, 어디부터, 어떤 말로는 전부 협상이다.** 한도는 남은 수를 헤더로, 쪽은 다음 쪽의 주소로, 언어는 `Content-Language`로 답한다. 클라이언트가 바라는 것을 말하고 서버가 정한 결과를 돌려주는 [02](../02-resource-design)장의 협상이 셋 다에 있다. 둘째, **다음 행동은 응답이 알려 준다.** 목록의 `next` 링크가 이미 그것이고, 자원마다 관련 자원의 주소를 실어 보내면 클라이언트는 주소를 조립하지 않는다. 셋째, **계약은 문서와 테스트로 고정된다.** 앞 장들의 메서드, 코드, 헤더, 링크는 전부 약속이고, OpenAPI가 그것을 적고 테스트가 지켜지는지 확인한다. 이 PC에서 GitHub, PokeAPI, 위키백과 API에 보낸 요청과 JDK의 언어 협상 함수를 돌린 결과, 한도 알고리즘 셋의 모의실험을 실었다.

---

## 1. 고급 설계 개요

| 주제 | 핵심 | 왜 필요한가 |
|:-----|:-----|:----------|
| Rate Limiting | 한도를 넘으면 429 | 한 손님이 서버를 독차지하지 못하게 |
| Pagination | 목록을 쪽으로 | 목록은 끝이 없고 메모리는 끝이 있다 |
| HATEOAS | 응답에 다음 주소를 | 클라이언트가 주소 규칙을 외우지 않게 |
| i18n / L10n | 언어와 지역의 협상 | 같은 자원, 다른 말 |
| Testing | 계약을 자동으로 확인 | 사람은 매번 못 누른다 |
| Documentation | 계약을 기계가 읽게 적는다 | 문서가 곧 클라이언트 코드가 된다 |

---

## 2. 사용량 제한 (Rate Limiting)

```text
Client              Limiter       Server
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

첫째 원리의 첫 예다. 서버 앞의 제한기가 손님마다 한도를 세고, 답마다 남은 수를 알려 주며, 넘으면 서버에 보내지 않고 429로 돌려보낸다. [04](../04-performance)장에서 본 대로 거절은 처리보다 수백 배 싸다.

| 헤더 | 뜻 | 이 PC에서 본 값 |
|:-----|:---|:--------------|
| X-RateLimit-Limit | 창 안의 최대 요청 수 | GitHub `60` |
| X-RateLimit-Remaining | 남은 수 | `53` |
| X-RateLimit-Reset | 초기화 시각(Unix) | `1789438799` |
| Retry-After | 이만큼 기다렸다 다시(초) | 429와 503에 |

```json
{
  "resources": {
    "core": {
      "limit": 60,
      "remaining": 53,
      "reset": 1789438799,
      "used": 7
    }
  }
}
```

GitHub API의 `/rate_limit`을 부르면 자원 종류별로 한도, 남은 수, 초기화 시각, 쓴 수가 온다. 이 끝점 자체는 한도에 세지 않는다. 이 장의 실측만으로 일곱 번을 썼고, 다음 초기화까지 53번 남았다.

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1789438799
Retry-After: 3600
Content-Type: application/problem+json

{
  "title": "Too Many Requests",
  "status": 429,
  "detail": "1시간 뒤에 다시"
}
```

| 알고리즘 | 뜻 | 장점 | 단점 |
|:--------|:---|:-----|:-----|
| Fixed Window | 매 분 N개 | 카운터 하나 | 경계에서 2N이 몰린다 |
| Sliding Window | 지난 60초 동안 N개 | 정확하다 | 시각을 기억해야 한다 |
| Token Bucket | 토큰을 채우고 쓴다 | 잠깐의 몰림은 허용 | 구현이 조금 복잡 |
| Leaky Bucket | 일정 속도로 흘려보낸다 | 속도가 고르다 | 몰림을 못 받아 준다 |

```text
[Fixed Window]
┌─────────────┬─────────────┐
│ 00:00-01:00 │ 01:00-02:00 │
│ 100 req OK  │ 100 req OK  │
└─────────────┴─────────────┘

[Token Bucket]
┌────────────┐
│ o o o o o  │ ← 일정 속도 추가
│  (버킷)    │ ← 요청 시 소비
└────────────┘

[Leaky Bucket]
┌────────────┐
│ ~요청 누적~│ ← 버킷에 쌓임
│    │       │ ← 일정 속도 처리
└────┼───────┘
     ▼
```

```text
경계 앞뒤 0.2초에 요청 200개
한도 100개/60초
Fixed Window   → 200개 통과
Sliding Window → 100개 통과
Token Bucket   → 100개 통과
```

넷의 차이를 이 PC에서 모의실험했다. 59.9초에 100개, 60.1초에 100개를 보내면 고정 창은 두 창에 100개씩이라 0.2초 사이에 200개를 통과시킨다. 미끄러지는 창은 "지난 60초"를 보므로 100개에서 멈추고, 토큰 버킷은 버킷이 100개뿐이라 역시 100개다. 고정 창이 나쁜 것은 아니다. 카운터 하나로 되고 GitHub의 시간당 한도가 이것이다. 경계의 몰림을 견딜 수 있느냐가 선택의 기준이다.

```java
Bandwidth limit = Bandwidth.builder()
    .capacity(100)
    .refillIntervally(100,
        Duration.ofHours(1))
    .build();
Bucket bucket = Bucket.builder()
    .addLimit(limit).build();

ConsumptionProbe probe = bucket
    .tryConsumeAndReturnRemaining(1);
res.addHeader("X-RateLimit-Limit",
    "100");
res.addHeader("X-RateLimit-Remaining",
    String.valueOf(
        probe.getRemainingTokens()));
if (probe.isConsumed()) return true;
res.addHeader("Retry-After",
    String.valueOf(
        probe.getNanosToWaitForRefill()
            / 1_000_000_000));
res.sendError(429);
return false;
```

Bucket4j의 토큰 버킷이다. 인터셉터에서 손님(API 키나 IP)마다 버킷을 하나씩 두고, 요청마다 토큰 하나를 꺼낸다. 남은 토큰이 헤더가 되고, 없으면 다음 토큰까지의 시간이 `Retry-After`가 된다. 서버가 여럿이면 버킷을 Redis 같은 공용 저장소에 두어야 손님이 어느 서버로 가든 한 버킷을 본다.

```java
RateLimiterConfig cfg =
    RateLimiterConfig.custom()
    .limitForPeriod(100)
    .limitRefreshPeriod(
        Duration.ofHours(1))
    .timeoutDuration(Duration.ZERO)
    .build();
RateLimiter limiter =
    RateLimiter.of("api", cfg);
```

Resilience4j는 고정 창이고, 원래 남의 API를 부를 때 내 쪽에서 속도를 지키는 용도로 많이 쓴다. 429를 주는 쪽이 아니라 429를 받지 않으려는 쪽이다.

{{< callout type="warning" >}}
429를 받고 **바로 다시** 보내면 계속 429다. 한도는 시간이 지나야 돌아온다. `Retry-After`를 지키고, 값이 없으면 1초, 2초, 4초로 늘리는 지수 백오프를 쓴다. 더 앞선 설계는 호출 자체를 줄이는 것이다. [04](../04-performance)장의 캐시와 조건부 요청, 여러 건을 한 번에 보내는 배치 API, 서버가 바뀔 때 알려 주는 웹훅([06](../06-realtime)장)이 그것이다.
{{< /callout >}}

---

## 3. 응답 페이지네이션

| 항목 | 안 나누면 | 나누면 | 왜 |
|:-----|:---------|:------|:---|
| 건수 | 100,000건 | 20건 | 화면에 보이는 것은 스무 줄 |
| 크기 | 50MB | 10KB | [04](../04-performance)장의 바이트 |
| 시간 | 30초 | 50ms | DB도 직렬화도 전송도 스무 건 |
| 위험 | 메모리 부족, 타임아웃 | 없음 | 서버 하나가 목록 하나에 죽지 않는다 |

첫째 원리의 둘째 예다. 목록은 끝이 없고 메모리는 끝이 있으므로 한 번에 얼마나, 어디부터 줄지를 정해야 한다. "어디부터"를 세는 방법이 셋이다.

### 오프셋 기반

```http
GET /users?page=2&size=20 HTTP/1.1
```

```json
{
  "content": [
    { "id": 41, "name": "User 41" },
    { "id": 42, "name": "User 42" }
  ],
  "number": 2,
  "size": 20,
  "totalElements": 1000,
  "totalPages": 50,
  "first": false,
  "last": false
}
```

```java
@GetMapping
Page<User> users(
        @RequestParam(defaultValue="0")
        int page,
        @RequestParam(defaultValue="20")
        int size,
        @RequestParam(defaultValue="id")
        String sort) {
    return repo.findAll(
        PageRequest.of(page, size,
            Sort.by(sort)));
}
```

쪽 번호와 크기로 "앞에서 몇 건 건너뛰고 몇 건"을 말한다. Spring Data의 `Page`가 전체 건수와 쪽 수까지 돌려준다. 이 PC에서 PokeAPI에 `?limit=3&offset=3`을 물으니 전체 1,351건 중 4~6번째 셋과 함께 앞뒤 쪽의 주소가 왔다.

```json
{
  "count": 1351,
  "next": ".../?offset=6&limit=3",
  "previous": ".../?offset=0&limit=3",
  "results": [
    { "name": "charmander",
      "url": ".../pokemon/4/" },
    { "name": "charmeleon",
      "url": ".../pokemon/5/" }
  ]
}
```

| 장점 | 단점 | 왜 |
|:-----|:-----|:---|
| 구현이 쉽다 | 뒤로 갈수록 느리다 | DB가 앞의 만 건을 읽고 버린다 |
| 아무 쪽으로나 간다 | 사이에 끼어들면 밀린다 | 새 글이 들어오면 다음 쪽에 방금 본 글이 또 |
| 전체 쪽 수를 안다 | `count(*)`가 비싸다 | 큰 표에서는 세는 것도 일 |

### 커서 기반

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
GET /users?size=20&cursor=MTAw HTTP/1.1
```

```json
{
  "data": [
    { "id": 101, "name": "User 101" },
    { "id": 102, "name": "User 102" }
  ],
  "cursors": {
    "next": "MTIw",
    "hasNext": true
  }
}
```

"몇 건 건너뛰고"가 아니라 "이것 다음부터"다. 마지막으로 본 행의 키(여기서는 ID 100을 Base64로 적은 `MTAw`)를 커서로 주면 서버는 `WHERE id > 100 ORDER BY id LIMIT 21`로 다음 스무 건을 바로 찾는다. 앞을 읽고 버리는 일이 없어 백만 번째 쪽도 첫 쪽만큼 빠르고, 사이에 끼어든 행이 있어도 밀리지 않는다. 위키백과 API의 목록도 이 방식이다. 이 PC에서 전체 문서 목록을 세 건씩 물으니 답 끝에 `"continue": {"apcontinue": "!!!!!!!"}`가 왔다. 다음 요청에 그대로 붙이면 그 제목부터 이어진다.

```java
@GetMapping
CursorPage<User> users(
        @RequestParam(required=false)
        String cursor,
        @RequestParam(defaultValue="20")
        int size) {
    long lastId = decode(cursor);
    List<User> rows = repo
        .findByIdGreaterThanOrderById(
            lastId, Limit.of(size + 1));
    boolean more = rows.size() > size;
    if (more)
        rows = rows.subList(0, size);
    String next = more
        ? encode(rows.getLast().id())
        : null;
    return new CursorPage<>(
        rows, next, more);
}

long decode(String c) {
    if (c == null) return 0L;
    return Long.parseLong(new String(
        Base64.getUrlDecoder()
            .decode(c)));
}

String encode(long id) {
    return Base64.getUrlEncoder()
        .encodeToString(
            Long.toString(id)
                .getBytes());
}
```

한 건을 더 읽어(`size + 1`) 다음 쪽이 있는지를 안다. 커서를 Base64로 감싸는 것은 클라이언트가 그 값을 만들어 내거나 뜻을 해석하지 못하게 하려는 것이다. 커서는 서버가 준 것을 그대로 돌려주는 불투명한 표다.

| 장점 | 단점 | 왜 |
|:-----|:-----|:---|
| 어디서나 같은 속도 | 아무 쪽으로 못 간다 | "이것 다음"만 안다 |
| 끼어들어도 안 밀린다 | 전체 쪽 수를 모른다 | 세지 않으니까 |
| 실시간 피드에 맞다 | 정렬 키가 고유해야 한다 | 같은 값이 여럿이면 어디서 이을지 모른다 |

### 기간 기반

```text
GET /events?since=1789430000
           &until=1789516400
           &limit=50
```

| 파라미터 | 뜻 | 왜 |
|:--------|:---|:---|
| since | 이 시각부터 | 로그와 이벤트는 시간이 곧 키 |
| until | 이 시각까지 | 범위를 닫는다 |
| limit | 최대 건수 | 범위 안이 백만 건일 수 있다 |

| 데이터 | 방식 | 왜 |
|:------|:-----|:---|
| 안 바뀌는 목록, 쪽 번호 UI | 오프셋 | "3쪽으로"가 되어야 |
| 계속 늘어나는 피드 | 커서 | 밀리지 않고 빠르게 |
| 시간이 키인 이벤트 | 기간 | 그 시간에 무슨 일이 |

---

## 4. 국제화와 지역화 (i18n / L10n)

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

첫째 원리의 셋째 예이고, [02](../02-resource-design)장의 협상 그대로다. 같은 상품이라는 자원의 한국어 표현과 영어 표현이 있고, `Accept-Language`가 바라는 순서를, `Content-Language`가 고른 결과를 말한다. 이 PC에서 위키백과의 같은 문서를 ko와 en 서버에 물으니 각각 `content-language: ko`, `en`이 왔다.

| 방법 | 예 | 장점 | 왜 |
|:-----|:---|:-----|:---|
| HTTP 헤더 | `Accept-Language: ko-KR` | 표준. 브라우저가 알아서 보낸다 | 사용자가 설정한 언어가 그대로 |
| 쿼리 파라미터 | `?lang=ko` | 눈에 보이고 테스트가 쉽다 | 링크로 줄 수 있다 |
| URL 경로 | `/ko/products` | 검색 엔진이 언어판을 따로 색인 | MDN이 `/ko/`로 보낸 이유 |
| 쿠키 | `lang=ko` | 사용자의 선택을 기억 | 브라우저 설정과 다르게 고를 때 |

```text
Accept-Language          → 선택
ko-KR,ko;q=0.9,en;q=0.7  → ko
ja, en;q=0.5             → en
en-US,en;q=0.8           → en
fr                       → (없음)
```

협상 알고리즘은 RFC 4647이고 JDK에 그대로 들어 있다. 이 PC에서 서버가 한국어와 영어만 가졌다고 두고 `Locale.lookup`에 네 가지 헤더를 넣은 결과가 위다. ko-KR을 바라면 ko로 맞춰 주고, 일본어를 바라면 두 번째 후보 영어를, 프랑스어만 바라면 맞는 것이 없다. 없을 때 무엇을 줄지는 서버가 정한다.

```http
GET /api/v1/products HTTP/1.1
Accept-Language: ko-KR,ko;q=0.9,en;q=0.7
```

```http
HTTP/1.1 200 OK
Content-Language: ko
Content-Type: application/json
Vary: Accept-Language

{ "products": [ { "name": "노트북" } ] }
```

`Vary: Accept-Language`가 빠지면 [HTTP 05](../../../network/http/05-http-headers)장에서 본 대로 CDN이 한국어 답을 영어 손님에게 준다.

```java
var resolver =
    new AcceptHeaderLocaleResolver();
resolver.setDefaultLocale(
    Locale.KOREAN);
resolver.setSupportedLocales(List.of(
    Locale.KOREAN, Locale.ENGLISH));

var messages =
    new ResourceBundleMessageSource();
messages.setBasename("messages");
messages.setDefaultEncoding("UTF-8");
messages.setFallbackToSystemLocale(
    false);
```

```properties
# messages_ko.properties
product.name=상품명
error.not_found=상품이 없습니다

# messages_en.properties
product.name=Product name
error.not_found=Product not found
```

마지막 줄 `setFallbackToSystemLocale(false)`에 이유가 있다. 이 PC에서 JDK의 `ResourceBundle`에 프랑스어를 요청하니 프랑스어 파일이 없어 **서버의 기본 로케일**인 ko 파일이 돌아왔다. 서버가 한국에 있다는 사정이 프랑스 손님의 응답에 새는 것이고, Spring은 이 설정으로 그 대신 `messages.properties`나 `setDefaultLocale`의 언어를 쓴다. 없을 때 무엇을 줄지를 서버의 운영체제가 아니라 설계가 정해야 한다.

---

## 5. HATEOAS

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

둘째 원리다. Hypermedia As The Engine Of Application State, 응답의 링크가 다음 행동을 이끈다. 3절의 `next`가 이미 그것이었다. PokeAPI의 답에는 다음 쪽과 이전 쪽의 주소, 그리고 결과마다 그 항목의 주소가 실려 있었고, [01](../01-basics)장에서 GitHub API의 사용자 응답에 저장소 목록의 주소가 실려 있었다. 클라이언트는 `/users/{login}/repos`라는 규칙을 외우는 대신 받은 링크를 따라간다.

| 관점 | 일반 REST | HATEOAS | 왜 |
|:-----|:---------|:--------|:---|
| 주소 | 클라이언트가 조립 | 서버가 준다 | 규칙이 바뀌면 클라이언트를 고쳐야 / 안 고쳐도 |
| 다음 행동 | 문서를 읽고 안다 | 응답을 보고 안다 | 지금 할 수 있는 것만 링크로 온다 |
| 상태 | 클라이언트가 추측 | 링크의 유무가 상태 | 취소 링크가 없으면 취소가 안 되는 주문 |

| rel | 뜻 | 왜 표준인가 |
|:----|:---|:----------|
| self | 이 자원 자신 | 어디서 받았든 원래 주소를 안다 |
| next / prev | 다음 / 이전 쪽 | 3절. GitHub의 `Link` 헤더도 이 이름 |
| first / last | 첫 / 마지막 쪽 | |
| collection | 이 항목이 속한 목록 | 하나에서 전체로 |
| item | 목록 안의 항목 | 전체에서 하나로 |

```json
{
  "id": 123,
  "title": "REST API Design",
  "_links": {
    "self": { "href": "/books/123" },
    "author": {
      "href": "/authors/456" },
    "reviews": {
      "href": "/books/123/reviews" },
    "purchase": {
      "href": "/orders",
      "method": "POST" }
  },
  "_embedded": {
    "author": {
      "id": 456, "name": "John Doe",
      "_links": {
        "self": {
          "href": "/authors/456" } }
    }
  }
}
```

HAL(Hypertext Application Language)이 링크를 적는 가장 흔한 형식이다. `_links`에 관계 이름마다 주소를, `_embedded`에 같이 보내는 관련 자원을 둔다. 저자를 `_embedded`에 넣으면 클라이언트가 저자를 보러 한 번 더 가지 않아도 된다. 왕복 하나를 아끼는 [04](../04-performance)장의 논리다.

```java
Link self(Book b) {
    var api = methodOn(BookApi.class);
    return linkTo(api.book(b.id()))
        .withSelfRel();
}

@GetMapping("/{id}")
EntityModel<Book> book(
        @PathVariable Long id) {
    Book b = books.find(id);
    return EntityModel.of(b, self(b),
        linkTo(methodOn(BookApi.class)
            .all())
            .withRel("collection"),
        linkTo(methodOn(AuthorApi.class)
            .author(b.authorId()))
            .withRel("author"));
}

@GetMapping
CollectionModel<EntityModel<Book>>
        all() {
    var items = books.findAll().stream()
        .map(b -> EntityModel.of(
            b, self(b)))
        .toList();
    return CollectionModel.of(items,
        linkTo(methodOn(BookApi.class)
            .all()).withSelfRel());
}
```

Spring HATEOAS의 `linkTo(methodOn(...))`은 컨트롤러 메서드에서 주소를 거꾸로 만든다. 주소를 문자열로 적지 않으므로 매핑을 바꾸면 링크가 따라 바뀐다. 링크를 만드는 코드가 주소를 아는 유일한 곳이 되는 것이 요점이다.

```java
@GetMapping
PagedModel<EntityModel<Book>> page(
        Pageable pageable,
        PagedResourcesAssembler<Book>
            asm) {
    return asm.toModel(
        books.findAll(pageable),
        b -> EntityModel.of(
            b, self(b)));
}
```

```json
{
  "_embedded": { "books": [ ... ] },
  "_links": {
    "first": {
      "href": "/books?page=0" },
    "prev": {
      "href": "/books?page=0" },
    "self": {
      "href": "/books?page=1" },
    "next": {
      "href": "/books?page=2" },
    "last": {
      "href": "/books?page=9" }
  },
  "page": { "size": 20, "number": 1,
            "totalPages": 10 }
}
```

3절의 오프셋 쪽에 링크를 붙인 것이다. 클라이언트는 `page=2`를 계산하지 않고 `next`를 따라간다. 첫 쪽에는 `prev`가 없고 마지막 쪽에는 `next`가 없으므로, 링크의 유무가 곧 "더 있는가"의 답이다.

{{< callout type="info" >}}
HATEOAS는 [01](../01-basics)장 리처드슨 모델의 3단계이고, 그만큼 비용도 든다. 서버는 링크를 만들어야 하고 클라이언트는 링크를 따라가도록 짜야 한다. 내가 서버와 클라이언트를 다 만드는 서비스라면 주소 규칙을 공유하는 편이 싸다. 외부 파트너가 쓰는 API, 오래 살아남아야 하는 공용 플랫폼처럼 **주소가 바뀌어도 클라이언트를 못 고치는** 곳에서 값을 한다.
{{< /callout >}}

---

## 6. API 테스팅

```java
@SpringBootTest(webEnvironment =
    WebEnvironment.RANDOM_PORT)
class BookApiTest {

    @LocalServerPort int port;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.basePath =
            "/api/v1";
    }

    @Test
    void getBook() {
        given()
            .pathParam("id", 123)
        .when()
            .get("/books/{id}")
        .then()
            .statusCode(200)
            .contentType(
                ContentType.JSON)
            .body("id", equalTo(123))
            .body("_links.self.href",
                containsString(
                    "/books/123"));
    }

    @Test
    void createBook() {
        given()
            .contentType(
                ContentType.JSON)
            .body("""
                {"title": "New Book",
                 "authorId": 456}
                """)
        .when()
            .post("/books")
        .then()
            .statusCode(201)
            .header("Location",
                containsString(
                    "/books/"))
            .body("title",
                equalTo("New Book"));
    }

    @Test
    void rateLimited() {
        for (int i = 0; i < 100; i++) {
            get("/books");
        }
        get("/books").then()
            .statusCode(429)
            .header("Retry-After",
                notNullValue());
    }
}
```

셋째 원리의 앞부분이다. REST Assured는 요청과 기대를 `given`, `when`, `then`으로 적는 자바 DSL이고, 실제 포트로 서버를 띄워 HTTP를 보낸다. 세 테스트가 앞 장들의 약속을 하나씩 확인한다. 조회는 200에 JSON이고 `self` 링크가 있는가(5절), 생성은 201에 `Location`이 있는가([02](../02-resource-design)장), 101번째 요청은 429에 `Retry-After`가 있는가(2절). 컨트롤러 메서드를 직접 부르는 단위 테스트로는 이 셋을 확인할 수 없다. 상태 코드와 헤더와 직렬화는 전부 HTTP 층에서 생기기 때문이다.

---

## 7. API 문서화

```java
@Bean
OpenAPI api() {
    return new OpenAPI().info(new Info()
        .title("Book API")
        .version("1.0.0")
        .description("Books REST API"));
}
```

```java
@Tag(name = "Books")
@RestController
@RequestMapping("/api/v1/books")
class BookApi {

    @Operation(summary = "Get a book")
    @ApiResponse(responseCode = "200",
        description = "found")
    @ApiResponse(responseCode = "404",
        description = "not found")
    @GetMapping("/{id}")
    EntityModel<Book> book(
            @PathVariable Long id) {
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
      summary: Get a book
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200": { description: found }
        "404": { description: missing }
```

셋째 원리의 뒷부분이다. OpenAPI(옛 이름 Swagger)는 API의 주소, 메서드, 파라미터, 응답 코드, 본문 스키마를 기계가 읽는 형식으로 적는 표준이다. springdoc-openapi를 넣으면 컨트롤러의 매핑과 `@Operation` 같은 주석에서 위의 YAML을 만들고, `/swagger-ui.html`에 사람이 눌러 볼 수 있는 화면을 띄운다. 이 PC에서 Swagger의 공식 예제 서버에 문서를 요청하니 `"openapi": "3.0.4"`로 시작하는 JSON에 `/pet`, `/pet/findByStatus` 같은 경로 13개가 들어 있었다.

```json
{
  "openapi": "3.0.4",
  "info": {
    "title": "Swagger Petstore...",
    "version": "1.0.27"
  },
  "paths": {
    "/pet": { "put": { ... },
              "post": { ... } },
    "/pet/findByStatus": { "get": ... }
  }
}
```

문서가 기계가 읽는 형식인 이유는 문서에서 **코드가 나오기** 때문이다. 클라이언트 SDK, 서버 스텁, 목 서버, 계약 테스트가 전부 이 문서에서 생성된다. 손으로 쓴 위키는 코드와 어긋나도 아무도 모르지만, 코드에서 만든 OpenAPI는 코드와 같이 바뀐다. 그래서 문서는 따로 쓰는 것이 아니라 코드의 주석에서 나오게 둔다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Rate Limiting | 손님마다 한도, 넘으면 429 | 거절은 처리보다 싸다 |
| 남은 수 헤더 | Limit, Remaining, Reset | 클라이언트가 스스로 속도를 맞추게 |
| 고정 창 | 카운터 하나 | 경계에서 두 배가 몰린다 |
| 미끄러지는 창, 토큰 버킷 | 지난 60초, 버킷의 토큰 | 경계가 없다. 잠깐의 몰림은 허용 |
| 오프셋 | 몇 건 건너뛰고 | 쉽지만 뒤로 갈수록 느리고 밀린다 |
| 커서 | 이것 다음부터 | 어디서나 같은 속도. 위키백과의 continue |
| 기간 | 이 시각부터 이 시각까지 | 이벤트는 시간이 키 |
| Accept-Language | 바라는 언어의 순서 | RFC 4647. JDK의 Locale.lookup |
| 기본 언어 | 설계가 정한다 | 서버의 운영체제가 새지 않게 |
| HATEOAS | 응답이 다음 주소를 준다 | 클라이언트가 규칙을 외우지 않는다 |
| HAL | `_links`와 `_embedded` | 관계 이름과 동봉 |
| REST Assured | given, when, then | 코드·헤더·링크는 HTTP 층에서 생긴다 |
| OpenAPI | 기계가 읽는 계약 | 문서에서 코드가 나온다 |

{{< callout type="info" >}}
**용어 정리**
- **Rate Limiting / Throttling**: 한도를 넘으면 거절 / 속도를 늦춘다
- **Fixed / Sliding Window**: 고정된 창 / 지난 N초의 창
- **Token / Leaky Bucket**: 채워 두고 쓰는 버킷 / 일정 속도로 새는 버킷
- **Offset / Cursor**: 건너뛸 건수 / 마지막으로 본 위치의 표
- **i18n / L10n**: 여러 언어를 담을 수 있게 / 한 언어와 지역에 맞게
- **Accept-Language / Content-Language**: 바라는 언어 / 고른 언어
- **HATEOAS**: 응답의 링크가 다음 행동을 이끄는 제약
- **HAL**: 링크와 동봉 자원을 적는 JSON 형식
- **rel**: 링크의 관계 이름. self, next, collection
- **REST Assured**: HTTP를 실제로 보내는 자바 테스트 DSL
- **OpenAPI**: API 계약의 기계 판독 표준. 옛 이름 Swagger
{{< /callout >}}
