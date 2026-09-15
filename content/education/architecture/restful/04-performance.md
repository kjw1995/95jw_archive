---
title: "04. 성능을 고려한 설계"
date: 2026-04-23
weight: 4
---

[02. 리소스 설계](../02-resource-design)에서 304는 "가진 것을 써라"는 답이라고 했고, [01](../01-basics)장은 PUT으로 일부만 보내면 나머지가 지워지는 사고를 이 장으로 미뤘다. 이 장은 같은 API를 더 빠르고 덜 무겁게 만드는 설계다. 원리는 셋이다. 첫째, **가장 싼 요청은 보내지 않는 요청이고, 그다음은 본문 없는 요청이다.** 캐시가 요청을 없애고, 검증(ETag)이 본문을 없애고, 압축이 바이트를 줄인다. 그 캐시는 브라우저, CDN, 게이트웨이의 여러 층에 있다. 둘째, **기다리게 하지 말고 나중에 알려 준다.** 몇 분 걸리는 일은 202로 접수증을 주고, 결과는 폴링이나 SSE나 WebSocket으로 전한다. 셋째, **바뀐 것만 보내고, 넘치는 것은 막는다.** PATCH가 바뀐 필드만 실어 나르고, Rate Limiting이 한 손님이 서버를 독차지하지 못하게 한다. 이 PC에서 이 블로그와 GitHub API와 위키미디어의 이벤트 스트림에 보낸 요청, 그리고 JSON Merge Patch를 직접 돌려 본 결과를 실었다.

---

## 1. REST API 성능 최적화

```text
┌──────────────────────────────┐
│   REST API 성능 최적화 전략  │
├──────────────────────────────┤
│  Caching      응답 지연 ↓    │
│  Async        긴 작업 처리   │
│  Partial      대역폭 절약    │
│  Pagination   대량 데이터    │
│  Compression  전송량 감소    │
│  Rate Limit   과부하 방지    │
└──────────────────────────────┘
```

| 전략 | 줄이는 것 | 왜 | 어디서 |
|:-----|:---------|:---|:------|
| Caching | 요청 자체 | 안 보내면 지연도 부하도 없다 | 2~5절 |
| Compression | 바이트 | 글자는 잘 줄어든다 | 2절 |
| Async | 기다리는 시간 | 긴 일은 접수증으로 | 6~7절 |
| Partial Update | 본문 | 바뀐 것만 | 8절 |
| Pagination | 한 번의 크기 | 목록은 끝이 없다 | [05](../05-advanced)장 3절 |
| Rate Limiting | 넘치는 요청 | 한 손님이 다 쓰면 나머지가 굶는다 | 9절 |

API의 지연은 대부분 서버가 아니라 **왕복**에서 온다. [HTTP 01](../../../network/http/01-internet-network)장에서 요청 하나의 값이 왕복 몇 번이라고 했고, 이 표의 여섯 전략은 그 왕복을 없애거나 짧게 하거나 나눠 쓰는 방법이다.

---

## 2. 캐싱의 원리

```text
[최초 요청 - Cache Miss]
Client ──▶ Cache ──▶ Server
       응답        응답
Client ◀── Cache ◀── Server

[재요청 - Cache Hit]
Client ──▶ Cache   (Server 호출 X)
Client ◀── Cache
     캐시 응답
```

| 이득 | 뜻 | 왜 |
|:-----|:---|:---|
| 응답 지연 감소 | 서버까지 안 간다 | 왕복 하나가 30ms면 그 30ms가 0이 된다 |
| 서버 부하 경감 | 서버가 받는 요청이 준다 | 같은 답을 백 번 만들지 않는다 |
| 대역폭 절약 | 선을 타는 바이트가 준다 | 본문이 아예 안 오간다 |
| 확장성 | 같은 서버로 더 많은 손님 | 부하의 대부분이 반복 요청이다 |

첫째 원리의 첫 층이다. 이 PC에서 example.com을 부르면 `Age: 13300`과 `cf-cache-status: HIT`가 온다. 클라우드플레어의 캐시가 3시간 40분 전에 저장해 둔 답이고, 원 서버는 이 요청을 본 적이 없다. 이 블로그의 첫 페이지는 인천의 Fastly 캐시에서 `X-Cache: MISS`로 처음 받은 뒤 두 번째 사람부터 HIT가 된다([HTTP 05](../../../network/http/05-http-headers)장 12절).

| 캐시하는 것 | 캐시하지 않는 것 | 왜 |
|:-----------|:---------------|:---|
| 정적 파일(이미지, JS, CSS) | 실시간 데이터 | 바뀌지 않는 것과 매초 바뀌는 것 |
| 자주 안 바뀌는 데이터 | 사용자별 개인정보 | 모두의 답과 한 사람의 답 |
| 비싼 계산의 결과 | 트랜잭션 결과 | 다시 계산하면 아까운 것과 한 번뿐인 것 |
| 공용 참조 데이터 | 인증 필요 자원 | public과 private |

압축도 같은 층의 일이다. 이 블로그의 첫 페이지 212,868바이트는 gzip으로 16,408바이트가 됐고, GitHub API의 사용자 JSON 1,349바이트는 562바이트가 됐다. 선을 타는 것이 글자면 압축은 거의 공짜다.

---

## 3. 캐싱 헤더

```text
[강한 캐싱]        [약한 캐싱]
"언제까지 사용"    "변경됐는지 확인"

• Expires         • Last-Modified
• Cache-Control   • ETag
  max-age

→ 서버 요청 없이   → 조건부 GET으로
  캐시 직접 반환     변경 여부 확인
```

캐시의 질문은 둘이다. **언제까지 믿어도 되는가**(시간)와 **아직 그대로인가**(검증). 시간이 남았으면 서버에 묻지 않고 쓰고, 지났으면 4절의 검증으로 본문 없이 확인한다.

| 헤더 | 뜻 | 예 | 왜 |
|:-----|:---|:---|:---|
| Expires | 이 시각까지 유효 | `Expires: Mon, 14 Sep 2026 06:53:24 GMT` | HTTP/1.0의 방식. 시계가 어긋나면 틀린다 |
| Cache-Control: max-age | 받은 뒤 N초 유효 | `Cache-Control: max-age=600` | 상대 시간이라 시계와 무관 |

{{< callout type="info" >}}
둘 다 있으면 `Cache-Control`이 이긴다. 이 블로그의 응답에는 둘이 같이 오는데, GitHub Pages가 옛 캐시를 위해 `expires`를 함께 붙이는 것이다. 중복이지만 해롭지는 않다.
{{< /callout >}}

| 지시자 | 뜻 | 왜 |
|:-------|:---|:---|
| public | 누구의 캐시든 저장해도 된다 | 모두에게 같은 답 |
| private | 브라우저만 | 그 사람의 답 |
| no-cache | 저장하되 쓸 때마다 검증 | 최신이어야 하지만 304로 절약은 하고 싶을 때 |
| no-store | 저장 자체를 금지 | 남으면 안 되는 것 |
| max-age=N | N초 동안 신선 | 기본 |
| s-maxage=N | 공용 캐시에서만 N초 | CDN은 purge로 지울 수 있으니 길게 |
| must-revalidate | 만료 뒤엔 검증 없이 못 쓴다 | 서버가 죽었다고 옛것을 주면 안 될 때 |
| immutable | 신선한 동안 검증도 하지 마라 | 새로고침 때도 안 묻는다. 이름에 해시가 든 파일 |

| 상황 | Cache-Control | 왜 |
|:-----|:--------------|:---|
| 해시가 이름에 든 정적 파일 | `public, max-age=31536000, immutable` | 내용이 바뀌면 이름이 바뀐다. 1년 |
| API 응답 | `private, max-age=60` | 그 사람 것. 1분은 참는다 |
| 민감한 데이터 | `no-store` | 어디에도 남기지 않는다 |
| 바뀌는 공용 데이터 | `public, no-cache` | 저장은 하되 매번 검증 |
| CDN과 브라우저를 다르게 | `public, max-age=60, s-maxage=3600` | 브라우저는 1분, CDN은 1시간 |

이 PC에서 본 값으로 보면 GitHub API는 `public, max-age=60, s-maxage=60`([01](../01-basics)장), PokeAPI는 `public, max-age=86400, s-maxage=86400`([02](../02-resource-design)장), github.com의 로그인 페이지는 `max-age=0, private, must-revalidate`([HTTP 05](../../../network/http/05-http-headers)장)다. 바뀌는 속도와 누구의 것인가가 값을 정한다.

---

## 4. ETag (Entity Tag)

```text
Client                      Server
  │                           │
  │─ 1. GET /users/123 ──────▶│
  │                           │
  │◀── 2. 200 OK ─────────────│
  │    ETag: "abc123"         │
  │    Body: {...}            │
  │                           │
  │   (캐시 저장)              │
  │                           │
  │─ 3. GET /users/123 ──────▶│
  │    If-None-Match: "abc123"│
  │                           │
  │   변경 확인                │
  │                           │
  │  [A] 변경 없음            │
  │◀── 304 Not Modified ──────│
  │    (Body 없음)             │
  │                           │
  │  [B] 변경됨               │
  │◀── 200 OK ────────────────│
  │    ETag: "def456"         │
  │    Body: {...}             │
```

첫째 원리의 둘째 층이다. 시간이 지난 캐시를 버리지 않고, 판 번호를 들고 가서 "아직 이것이냐"고 묻는다. 그대로면 304 한 줄, 바뀌었으면 새 본문. 이 PC에서 GitHub API의 사용자 정보를 받으면 `ETag`가 오고, 그 값을 `If-None-Match`로 다시 보내니 `304 Not Modified`가 본문 없이 왔다. 1,349바이트가 0이 됐다. 다만 남은 호출 수는 304에도 하나 줄었다. 서버가 판 번호를 비교하는 일은 했기 때문이다. 검증이 아끼는 것은 본문이지 요청이 아니다.

| 헤더 | 방향 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| ETag | 응답 | 이 표현의 판 번호 | 바뀌면 값이 바뀐다 |
| If-None-Match | 요청 | 이 판이 아니면 달라 | 조건부 GET. 같으면 304 |
| If-Match | 요청 | 이 판일 때만 하라 | 조건부 PUT. 다르면 412. 낙관적 락 |

| 종류 | 표기 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| 강한 ETag | `"abc123"` | 바이트까지 같다 | 범위 요청을 이어 붙여도 된다 |
| 약한 ETag | `W/"abc123"` | 뜻은 같다 | 압축본처럼 바이트는 달라도 내용이 같을 때 |

이 블로그의 첫 페이지는 그냥 받으면 강한 ETag, gzip으로 받으면 같은 값에 `W/`가 붙은 약한 ETag가 온다([HTTP 05](../../../network/http/05-http-headers)장 10절). 압축한 표현은 바이트가 다르지만 같은 문서라는 표시다. GitHub API의 ETag도 `W/`가 붙어 있다. 값이 본문의 해시라 직렬화 순서가 바뀌어도 같은 데이터면 같은 판으로 치겠다는 뜻이다.

```java
@Bean
ShallowEtagHeaderFilter etagFilter() {
    return new
        ShallowEtagHeaderFilter();
}
```

```java
@GetMapping("/{id}")
ResponseEntity<Product> get(
        @PathVariable Long id,
        WebRequest req) {
    Product p = products.find(id);
    String etag = "v" + p.version();
    if (req.checkNotModified(etag)) {
        return null;  // 304가 나간다
    }
    return ResponseEntity.ok()
        .eTag(etag)
        .body(p);
}
```

```java
@GetMapping("/{id}")
ResponseEntity<Product> get(
        @PathVariable Long id,
        WebRequest req) {
    Product p = products.find(id);
    long lm = p.updatedAt()
        .toEpochMilli();
    if (req.checkNotModified(lm)) {
        return null;
    }
    return ResponseEntity.ok()
        .lastModified(lm)
        .body(p);
}
```

세 가지 방법이 있다. 필터는 본문을 다 만든 뒤 MD5로 ETag를 붙여 대역폭만 아낀다. 버전 열을 판 번호로 쓰면 DB를 한 번 읽고 직렬화와 전송을 건너뛴다. 수정 시각을 쓰면 `Last-Modified`와 `If-Modified-Since`의 짝이 되는데, 초 단위라 1초 안에 두 번 바뀐 것은 놓친다.

```text
[시간 기반]       [검증 기반]
Cache-Control     ETag
 max-age    AND   Last-Modified
```

| 조합 | 판단 | 왜 |
|:-----|:-----|:---|
| `max-age` + `ETag` | 좋다 | 신선할 땐 안 묻고, 만료되면 본문 없이 묻는다 |
| `ETag` + `Last-Modified` 둘 다 | 괜찮다 | 규격이 권한다. 클라이언트는 ETag를 우선한다 |
| `Expires` + `max-age` 둘 다 | 중복이지만 무해 | 옛 캐시용. `max-age`가 이긴다 |
| 검증자 없이 `max-age`만 | 아쉽다 | 만료되면 본문을 통째로 다시 받는다 |

---

## 5. CDN과 다계층 캐싱

```text
Client     브라우저 캐시 (L1)
   │
   ▼
CDN Edge   CloudFront/CF (L2)
   │
   ▼
API GW     Kong / Gateway (L3)
   │
   ▼
Server     Spring Boot (L4)
   │
   ▼
DB         Redis / MySQL (원본)

가장 빠름 ◀───────▶ 가장 느림
```

첫째 원리의 셋째 층이다. 캐시는 한 곳이 아니라 요청이 지나는 모든 자리에 있고, 가까운 층에서 맞을수록 싸다. 브라우저 캐시는 왕복이 0이고, CDN은 가까운 도시까지의 왕복이며, 게이트웨이는 서버 앞의 한 홉이다. 이 PC의 요청이 example.com에 닿기 전에 클라우드플레어가 답한 것과 이 블로그를 인천의 Fastly가 답한 것이 L2다.

| 전략 | 뜻 | 언제 | 왜 |
|:-----|:---|:-----|:---|
| TTL | 시간이 지나면 만료 | 바뀌는 주기를 아는 것 | 가장 단순. 3절 |
| 버전 | 주소에 버전이나 해시 | 정적 파일 배포 | 새 파일은 새 주소라 옛 캐시와 안 겹친다 |
| Purge API | 손으로 지운다 | 급한 수정 | CDN에 "이 주소 버려"를 부른다 |
| 태그 | 묶음으로 지운다 | 연관 데이터가 바뀔 때 | 상품 하나가 바뀌면 목록도 |

```http
GET /css/main.5eb6634a...css HTTP/1.1
```

```http
GET /static/app.js?v=2.3.1 HTTP/1.1
```

이 블로그의 CSS 파일 이름이 첫 줄이다. Hugo가 파일 내용의 해시를 이름에 붙였고, 글을 고쳐 CSS가 바뀌면 이름이 바뀌어 옛 캐시는 그냥 안 쓰이게 된다. 이름이 곧 판 번호라 1년을 캐시해도 되는 구조인데, GitHub Pages는 모든 파일에 `max-age=600`을 붙이므로 10분마다 다시 묻는다. 플랫폼이 헤더를 못 바꾸게 하는 대가다. 쿼리로 버전을 붙이는 둘째 방식은 옛 프록시가 쿼리를 무시하고 캐시할 수 있어 이름에 넣는 편이 안전하다.

---

## 6. 비동기 작업 처리

```text
Client                     Server
  │─ 1. POST /reports ──────▶│
  │◀─ 2. 202 Accepted ───────│
  │      Location: /jobs/123 │
  │─ 3. GET /jobs/123 ──────▶│
  │◀─ 4. 200 {processing} ───│
  │        ... 폴링 ...      │
  │─ 5. GET /jobs/123 ──────▶│
  │◀─ 6. 200 {done,          │
  │        result:/reports/9}│
  │─ 7. GET /reports/9 ─────▶│
  │◀─ 8. 200 (결과) ─────────│
```

둘째 원리다. 보고서 생성이 3분 걸리면 그 3분 동안 연결을 붙들고 기다리게 할 수 없다. 브라우저와 프록시가 먼저 끊고, 서버의 스레드는 그동안 놀며, 사용자는 새로고침을 눌러 같은 일을 두 번 시킨다. 대신 일을 **접수**하고(1, 2), 그 일을 자원으로 만들어 주소를 주고(`/jobs/123`), 서버 뒤의 워커가 처리하는 동안 클라이언트는 그 주소를 들여다본다(3~6). 끝나면 결과의 주소를 준다.

```http
POST /api/v1/reports HTTP/1.1
Content-Type: application/json

{"type": "sales", "period": "2026-Q3"}
```

```http
HTTP/1.1 202 Accepted
Location: /api/v1/jobs/abc123
Content-Type: application/json

{
  "jobId": "abc123",
  "status": "queued",
  "estimatedSeconds": 30,
  "statusUrl": "/api/v1/jobs/abc123"
}
```

[HTTP 04](../../../network/http/04-http-status-codes)장의 202가 이 접수증이다. 200이 아닌 이유는 "됐다"가 아니라 "받았다"이기 때문이고, `Location`이 확인할 주소다.

```java
@GetMapping("/{jobId}")
JobStatus status(
        @PathVariable String jobId) {
    Job job = jobs.find(jobId);
    String result = job.isDone()
        ? "/reports/" + job.resultId()
        : null;
    return new JobStatus(jobId,
        job.status(), job.progress(),
        result);
}
```

```java
@Bean
Executor taskExecutor() {
    var ex =
        new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(5);
    ex.setMaxPoolSize(10);
    ex.setQueueCapacity(100);
    ex.setThreadNamePrefix("async-");
    ex.initialize();
    return ex;
}
```

```java
@Service
class ReportService {
    @Async
    CompletableFuture<Report> generate(
            ReportRequest req) {
        Report r = render(req);
        return CompletableFuture
            .completedFuture(r);
    }
}
```

`@EnableAsync`를 켜고 `@Async`를 붙이면 그 메서드는 요청 스레드가 아니라 위 풀의 스레드에서 돌고, 컨트롤러는 바로 202를 돌려준다. 풀의 크기와 큐의 길이가 곧 동시에 받을 수 있는 일의 양이다. 큐가 차면 거절해야지 무한정 받으면 메모리가 큐가 된다. 한 서버의 풀로 부족하면 메시지 큐(Kafka, RabbitMQ)와 별도 워커로 같은 그림을 확장한다.

---

## 7. 폴링 vs SSE vs WebSocket

```text
[Polling]
Client ──▶ Server    주기적 요청
Client ◀── Server    변경 없어도 요청
                     → 리소스 낭비

[SSE - Server-Sent Events]
Client ──▶ Server    한 번 연결
Client ◀══ Server    서버 일방향 푸시
                     → 서버→클라만 가능

[WebSocket]
Client ◀═▶ Server    양방향 통신
                     실시간 상호작용
                     → 효율적, 복잡
```

| 방식 | 장점 | 단점 | 쓰는 곳 | 왜 |
|:-----|:-----|:-----|:-------|:---|
| Polling | 단순, 어디서나 된다 | 빈 요청이 대부분, 주기만큼 늦다 | 작업 상태 | 6절의 3~5. 1초마다 물으면 1초 늦다 |
| Long Polling | 거의 실시간 | 연결을 붙들고 있어야 | 옛 채팅 | 답이 생길 때까지 서버가 응답을 미룬다 |
| SSE | 자동 재연결, HTTP 그대로 | 서버에서 클라이언트로만 | 알림, 피드, 진행률 | 한 연결에 이벤트가 흘러온다 |
| WebSocket | 양방향, 낮은 지연 | 별도 프로토콜, 프록시와 인증이 번거롭다 | 게임, 협업 편집 | 양쪽이 아무 때나 말한다 |

둘째 원리의 "어떻게 알려 주는가"다. 폴링은 6절 그대로이고 가장 단순하지만, 3분짜리 일을 1초마다 물으면 180번 중 179번이 헛걸음이다. SSE는 HTTP 응답을 끝내지 않고 열어 둔 채 이벤트를 한 줄씩 흘려보내는 것이다. 이 PC에서 위키미디어의 편집 이벤트 스트림을 부르니 `Content-Type: text/event-stream`과 `Cache-Control: no-cache`로 답이 시작됐고, 본문은 끝나지 않은 채 `event:`, `id:`, `data:` 줄이 계속 왔다.

```text
event: message
id: [{"topic":"eqiad.mediawiki...
data: {"$schema":"/mediawiki/...

event: message
...
```

빈 줄이 이벤트 하나의 끝이고, `id`가 있어 끊겼다 다시 붙을 때 브라우저가 `Last-Event-ID`로 이어 받는다. WebSocket은 [HTTP 04](../../../network/http/04-http-status-codes)장에서 본 101로 규칙을 바꿔 양방향이 되는 것이고, 셋의 자세한 비교는 [06](../06-realtime)장에서 본다.

```java
@GetMapping(value = "/{jobId}/stream",
    produces = "text/event-stream")
Flux<ServerSentEvent<JobStatus>> stream(
        @PathVariable String jobId) {
    return Flux.interval(
            Duration.ofSeconds(1))
        .map(i -> ServerSentEvent
            .<JobStatus>builder()
            .id(String.valueOf(i))
            .event("job-status")
            .data(jobs.status(jobId))
            .build())
        .takeUntil(e ->
            e.data().isDone());
}
```

6절의 폴링을 SSE로 바꾼 것이다. 클라이언트는 한 번 연결하고, 서버가 1초마다 상태를 흘려보내다 끝나면 닫는다. 응답을 열어 두어야 하므로 스레드 하나가 응답 하나에 묶이는 서블릿 모델보다 WebFlux의 `Flux`나 MVC의 `SseEmitter`처럼 비동기로 쓴다.

---

## 8. HTTP PATCH와 부분 업데이트

```text
[PUT - 전체 교체]    [PATCH - 부분 수정]
모든 필드 전송       변경할 필드만 전송

{                    {
  "name":"John",       "name":"John"
  "email":"...",     }
  "age":30,
  "address":"..."    → 나머지 필드 유지

멱등성: O            멱등성: 연산에 따라
}
```

셋째 원리의 앞부분이다. [01](../01-basics)장이 미룬 사고, 이름만 고치려고 PUT에 이름만 담아 보내 나이와 주소가 지워지는 일은 PUT의 뜻이 "통째로"라서 생긴다. 바뀐 것만 보내는 메서드가 PATCH이고, 본문의 형식이 둘 있다.

### JSON Merge Patch (RFC 7396)

```http
PATCH /api/v1/users/123 HTTP/1.1

{
  "name": "John Updated",
  "email": null,
  "address": { "zip": "04524" }
}
```

```text
BEFORE name=John, email=john@…,
       age=30, address={city=Seoul}
PATCH  name=John Updated, email=null,
       address={zip=04524}
AFTER  name=John Updated, age=30,
       address={city=Seoul, zip=04524}
```

`Content-Type: application/merge-patch+json`으로 보내는 가장 단순한 형식이다. 규칙은 셋뿐이다. 보낸 필드는 덮고, `null`은 지우고, 객체는 안으로 들어가 같은 규칙을 적용한다. 이 PC에서 RFC의 알고리즘을 열 줄로 옮겨 돌린 결과가 위다. 이름은 바뀌고, 이메일은 사라지고, 나이는 남고, 주소는 도시를 지키며 우편번호가 더해졌다. 같은 패치를 두 번 적용해도 결과가 같았다. Merge Patch는 멱등이다. 대신 `null`을 "지워라"로 쓰므로 값을 null로 설정하는 것은 표현할 수 없고, 배열은 통째로만 바뀐다.

```java
@PatchMapping(value = "/{id}",
    consumes =
        "application/merge-patch+json")
User patch(@PathVariable Long id,
        @RequestBody JsonMergePatch p)
        throws JsonPatchException {
    User user = users.find(id);
    JsonNode node = p.apply(
        mapper.valueToTree(user));
    return users.save(
        mapper.treeToValue(
            node, User.class));
}
```

### JSON Patch (RFC 6902)

```http
PATCH /api/v1/orders/1234 HTTP/1.1

[
  {"op": "replace", "path": "/status",
   "value": "COMPLETED"},
  {"op": "add", "path": "/notes/-",
   "value": "배송 완료"},
  {"op": "remove", "path": "/tempData"},
  {"op": "copy", "from": "/shipping",
   "path": "/billing"},
  {"op": "test", "path": "/version",
   "value": 5}
]
```

| 연산 | 뜻 | 예 | 왜 있나 |
|:-----|:---|:---|:-------|
| add | 넣는다 | `{"op":"add","path":"/tags/-","value":"new"}` | 배열 끝에도 넣는다(`-`) |
| remove | 지운다 | `{"op":"remove","path":"/temp"}` | null과 구별된다 |
| replace | 바꾼다 | `{"op":"replace","path":"/name","value":"New"}` | 없으면 실패한다 |
| move | 옮긴다 | `{"op":"move","from":"/a","path":"/b"}` | 지우고 넣기를 한 번에 |
| copy | 복사한다 | `{"op":"copy","from":"/a","path":"/b"}` | |
| test | 확인한다 | `{"op":"test","path":"/version","value":5}` | 틀리면 전체를 안 한다. 낙관적 락 |

`Content-Type: application/json-patch+json`으로 보내는 연산 목록이다. Merge Patch가 못 하는 것, 곧 배열의 원소 하나를 넣고 빼는 것과 "이 조건일 때만"이 된다. 마지막 `test`가 핵심이다. 버전이 5일 때만 전체를 적용하므로 [HTTP 05](../../../network/http/05-http-headers)장의 `If-Match` 없이도 낙관적 락이 된다. 대신 `add`를 두 번 하면 두 번 들어가므로 멱등은 연산이 정한다([HTTP 03](../../../network/http/03-http-methods)장).

```java
@PatchMapping(value = "/{id}",
    consumes =
        "application/json-patch+json")
Order patch(@PathVariable Long id,
        @RequestBody JsonPatch p)
        throws JsonPatchException {
    Order order = orders.find(id);
    JsonNode node = p.apply(
        mapper.valueToTree(order));
    return orders.save(
        mapper.treeToValue(
            node, Order.class));
}
```

| 쓰는 곳 | 왜 PATCH인가 |
|:-------|:-----------|
| SPA | 필드 하나 바꾸는 데 객체 전체를 보내지 않는다 |
| 실시간 협업 | 문서 전체가 아니라 바뀐 연산만 오간다. 충돌도 연산 단위로 푼다 |
| 오프라인 동기화 | 끊긴 동안의 변경만 모아 보낸다 |
| 큰 문서 | 수 MB 문서의 한 줄을 고치는 데 수 MB를 안 보낸다 |

---

## 9. Rate Limiting

| 전략 | 뜻 | 특징 | 왜 |
|:-----|:---|:-----|:---|
| Fixed Window | 매 분 N개 | 단순. 경계에서 2N이 몰릴 수 있다 | 59초와 61초에 N개씩 |
| Sliding Window | 지난 60초 동안 N개 | 정확하다 | 경계가 없다 |
| Token Bucket | 토큰을 채우고 쓴다 | 잠깐의 몰림은 허용 | 모아 둔 만큼은 한 번에 써도 된다 |
| Leaky Bucket | 일정 속도로 흘려보낸다 | 속도가 고르다 | 넘치면 버린다 |

셋째 원리의 뒷부분이다. 한 클라이언트의 버그나 악의가 서버를 독차지하면 나머지 모두가 느려진다. 그래서 손님마다 한도를 두고, 넘으면 처리하지 않고 429로 돌려보낸다. 처리하지 않는 것이 핵심이다. 거절은 처리보다 수백 배 싸다.

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 53
X-RateLimit-Reset: 1789370818
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/problem+json

{
  "title": "Too Many Requests",
  "status": 429,
  "detail": "60초 뒤에 다시 보내라"
}
```

이 PC에서 GitHub API를 토큰 없이 부르면 첫 블록의 헤더가 200에도 따라온다. 한 시간에 60번, 지금 53번 남았고, 언제 초기화되는지. 이 장의 실측만으로 일곱 번을 썼다. 한도를 넘으면 둘째 블록의 429가 오고, `Retry-After`가 언제 다시 올지를 말한다. `X-RateLimit-*`는 관례이고 IETF가 `RateLimit` 헤더로 표준화하고 있다. 전략의 구현은 [05](../05-advanced)장 2절에서 본다.

---

## 10. 캐싱 베스트 프랙티스

| DO | 왜 |
|:---|:---|
| 정적 파일은 긴 캐시 + 해시 이름 | 5절. 이름이 판 번호 |
| `max-age`와 `ETag`를 같이 | 신선할 땐 안 묻고 만료되면 본문 없이 |
| CDN을 앞에 | 왕복을 가까운 도시까지로 |
| GET에만 | 03장의 약속. 답이 곧 자원의 표현 |
| 공용은 `public`, 개인은 `private` | 남의 캐시에 내 답이 남지 않게 |

| DON'T | 왜 |
|:------|:---|
| POST, PUT의 답을 캐시 | 처리의 결과이지 자원의 표현이 아니다 |
| 개인 데이터를 `public`으로 | 다음 손님이 내 잔액을 본다 |
| 검증자 없이 `max-age`만 | 만료되면 통째로 다시 |
| 쿼리가 다르면 다른 답인데 `Vary`나 키를 안 나눔 | 캐시가 A의 답을 B에게 준다 |

{{< callout type="warning" >}}
인증이 필요한 개인 데이터를 `public`으로 캐시하면 CDN이 그 답을 **다음 사람에게** 준다. 실제로 있었던 사고들이다. 개인 응답에는 반드시 `private` 아니면 `no-store`를 붙이고, `Authorization` 헤더가 있는 요청의 답은 공용 캐시가 기본으로 저장하지 않는다는 규칙에 기대지 말고 명시한다.
{{< /callout >}}

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Cache Hit / Miss | 캐시가 답했다 / 원 서버까지 갔다 | Age와 HIT가 발자국 |
| TTL, max-age | 언제까지 믿을지 | 시간 기반 |
| ETag, 304 | 아직 그대로인지 | 본문 없이 확인. 요청은 남는다 |
| 약한 ETag | 바이트는 달라도 같은 내용 | 압축본, 해시 |
| 캐시 계층 | 브라우저, CDN, 게이트웨이 | 가까울수록 싸다 |
| 해시 이름 | 내용이 바뀌면 주소가 바뀐다 | 1년 캐시가 안전해진다 |
| 202 | 접수증과 작업 자원 | 3분을 붙들지 않는다 |
| 폴링 / SSE / WebSocket | 묻는다 / 흘려보낸다 / 양쪽이 말한다 | 헛걸음, 단방향, 복잡함의 순 |
| Merge Patch | 덮고, null이면 지우고, 객체는 안으로 | 단순하고 멱등 |
| JSON Patch | 연산 목록과 test | 배열과 조건부 |
| Rate Limiting | 넘치면 429로 거절 | 거절은 처리보다 싸다 |

{{< callout type="info" >}}
**용어 정리**
- **Cache-Control**: 캐시가 얼마나 어떻게 써도 되는지의 지시
- **ETag / If-None-Match**: 표현의 판 번호 / 그 판이 아니면 달라는 조건
- **304 Not Modified**: 그대로니 가진 것을 쓰라는 본문 없는 답
- **CDN**: 가까운 도시에 둔 공용 캐시
- **Cache Busting**: 이름이나 쿼리에 판을 넣어 옛 캐시를 비켜 가는 것
- **202 Accepted**: 받았고 나중에 처리한다는 접수증
- **SSE**: 열어 둔 HTTP 응답으로 서버가 이벤트를 흘려보내는 것
- **JSON Merge Patch**: 덮어쓰기 규칙의 부분 수정(RFC 7396)
- **JSON Patch**: 연산 목록의 부분 수정(RFC 6902)
- **Rate Limiting**: 손님마다 한도를 두고 넘으면 429
- **Retry-After**: 언제 다시 와도 되는지
{{< /callout >}}
