---
title: "성능을 고려한 설계"
weight: 4
---

## REST API 성능 최적화

API 성능은 사용자 경험과 직결된다. 캐싱, 비동기 처리, 부분 업데이트 등의 기법으로 응답 속도를 높이고 서버 부하를 줄일 수 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST API 성능 최적화 전략                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│   │    Caching    │  │    Async      │  │   Partial     │      │
│   │    (캐싱)     │  │   (비동기)     │  │   Update      │      │
│   ├───────────────┤  ├───────────────┤  ├───────────────┤      │
│   │ • 응답 지연↓   │  │ • 긴 작업 처리 │  │ • 대역폭 절약  │      │
│   │ • 서버 부하↓   │  │ • 논블로킹    │  │ • PATCH 활용  │      │
│   │ • 대역폭 절약  │  │ • 폴링/SSE    │  │ • JSON Patch  │      │
│   └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│   │  Pagination   │  │  Compression  │  │ Rate Limiting │      │
│   │  (페이지네이션) │  │    (압축)     │  │  (속도 제한)   │      │
│   ├───────────────┤  ├───────────────┤  ├───────────────┤      │
│   │ • 대량 데이터  │  │ • gzip/br    │  │ • 과부하 방지  │      │
│   │ • 커서 기반   │  │ • 전송량 감소  │  │ • 공정한 사용  │      │
│   └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 캐싱의 원리

캐싱은 요청에 대한 응답을 임시 저장하여 동일한 요청에 대해 저장된 응답을 반환하는 기술이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      캐싱 동작 원리                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   최초 요청 (Cache Miss)                                        │
│   ┌────────┐         ┌────────┐         ┌────────┐            │
│   │ Client │ ──────► │ Cache  │ ──────► │ Server │            │
│   │        │ ◄────── │ (저장)  │ ◄────── │        │            │
│   └────────┘   응답   └────────┘   응답   └────────┘            │
│                                                                 │
│   재요청 (Cache Hit)                                            │
│   ┌────────┐         ┌────────┐         ┌────────┐            │
│   │ Client │ ──────► │ Cache  │    X    │ Server │            │
│   │        │ ◄────── │ (반환)  │         │ (호출X) │            │
│   └────────┘  캐시응답 └────────┘         └────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 캐싱의 장점

| 장점 | 설명 |
|------|------|
| **응답 지연 감소** | 서버 왕복 없이 즉시 응답 |
| **서버 부하 경감** | 처리해야 할 요청 수 감소 |
| **대역폭 절약** | 네트워크 전송량 감소 |
| **확장성 향상** | 더 많은 동시 요청 처리 가능 |

### 캐싱 대상

```
┌─────────────────────────────────────────────────────────────────┐
│                     캐싱 적합 리소스                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ✅ 캐싱 권장                        ❌ 캐싱 비권장              │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ • 정적 리소스             │       │ • 실시간 데이터          │ │
│  │   (이미지, JS, CSS)      │       │ • 사용자별 개인정보       │ │
│  │ • 자주 변경되지 않는 데이터 │       │ • 트랜잭션 결과          │ │
│  │ • CPU 집약적 연산 결과    │       │ • 쿼리 파라미터 요청      │ │
│  │ • 공용 참조 데이터        │       │ • 인증이 필요한 리소스    │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 캐싱 헤더

### 강한 캐싱 vs 약한 캐싱

```
┌─────────────────────────────────────────────────────────────────┐
│                    캐싱 헤더 분류                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   강한 캐싱 헤더 (Strong)              약한 캐싱 헤더 (Weak)       │
│  ┌────────────────────────┐         ┌────────────────────────┐ │
│  │                        │         │                        │ │
│  │  "언제까지 캐시 사용"    │         │  "변경되었는지 확인"    │ │
│  │                        │         │                        │ │
│  │  • Expires            │         │  • Last-Modified       │ │
│  │  • Cache-Control      │         │  • ETag                │ │
│  │    max-age            │         │                        │ │
│  │                        │         │                        │ │
│  │  → 서버 요청 없이      │         │  → 조건부 GET으로      │ │
│  │    캐시에서 직접 반환   │         │    변경 여부 확인       │ │
│  │                        │         │                        │ │
│  └────────────────────────┘         └────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Expires vs Cache-Control

| 헤더 | 설명 | 예시 |
|------|------|------|
| **Expires** | 리소스 만료 일시 (절대 시간) | `Expires: Thu, 01 Dec 2024 16:00:00 GMT` |
| **Cache-Control max-age** | 다운로드 후 유효 시간 (초) | `Cache-Control: max-age=3600` |

> **참고**: 둘 다 있으면 `Cache-Control`이 우선한다. HTTP/1.1에서는 `Cache-Control` 권장

### Cache-Control 지시자

```
┌─────────────────────────────────────────────────────────────────┐
│                  Cache-Control 지시자                            │
├──────────────┬──────────────────────────────────────────────────┤
│    지시자     │                      의미                        │
├──────────────┼──────────────────────────────────────────────────┤
│  public      │  브라우저, 프록시, CDN 모두 캐시 가능             │
│  private     │  브라우저만 캐시 가능 (프록시/CDN 불가)           │
│  no-cache    │  매번 서버에 재검증 필요 (캐시 저장은 함)          │
│  no-store    │  캐시 저장 자체를 하지 않음                       │
│  max-age=N   │  N초 동안 캐시 유효                              │
│  s-maxage=N  │  공유 캐시(프록시)에서 N초 동안 유효              │
│  must-revalidate │ 만료 후 반드시 서버 확인                     │
│  immutable   │  리소스가 절대 변경되지 않음                      │
└──────────────┴──────────────────────────────────────────────────┘
```

### 캐싱 시나리오별 설정

```http
# 1. 정적 리소스 (이미지, JS, CSS) - 장기 캐싱
Cache-Control: public, max-age=31536000, immutable

# 2. API 응답 - 짧은 캐싱
Cache-Control: private, max-age=60

# 3. 민감한 데이터 - 캐시 금지
Cache-Control: no-store

# 4. 변경 가능한 공용 데이터 - 항상 재검증
Cache-Control: public, no-cache

# 5. CDN 활용 - 브라우저와 CDN 다른 TTL
Cache-Control: public, max-age=60, s-maxage=3600
```

---

## ETag (Entity Tag)

리소스의 버전을 식별하는 고유값으로, 조건부 요청에 사용된다.

### ETag 작동 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                      ETag 동작 흐름                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                                         Server         │
│     │                                              │            │
│     │─────── 1. GET /api/users/123 ──────────────►│            │
│     │                                              │            │
│     │◄──────── 2. 200 OK ─────────────────────────│            │
│     │          ETag: "abc123"                      │            │
│     │          Body: {...}                         │            │
│     │                                              │            │
│     │  (캐시에 저장)                                │            │
│     │                                              │            │
│     │─────── 3. GET /api/users/123 ──────────────►│            │
│     │          If-None-Match: "abc123"             │            │
│     │                                              │            │
│     │                              리소스 변경 확인 │            │
│     │                                              │            │
│  ┌──┴──────────────────────────────────────────────┴──┐        │
│  │                                                    │        │
│  │  Case A: 변경 없음           Case B: 변경됨         │        │
│  │  ┌──────────────────┐       ┌──────────────────┐  │        │
│  │  │ 304 Not Modified │       │ 200 OK           │  │        │
│  │  │ (Body 없음)       │       │ ETag: "def456"   │  │        │
│  │  │ → 캐시 사용       │       │ Body: {...}      │  │        │
│  │  └──────────────────┘       │ → 캐시 갱신       │  │        │
│  │                             └──────────────────┘  │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ETag 관련 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| **ETag** | 응답 | 리소스의 버전 식별자 |
| **If-None-Match** | 요청 | 조건부 GET - 변경 시에만 응답 |
| **If-Match** | 요청 | 조건부 PUT/DELETE - 일치 시에만 수행 |

### ETag 종류

| 종류 | 표기 | 설명 |
|------|------|------|
| **강한 ETag** | `"abc123"` | 바이트 단위 완전 일치 |
| **약한 ETag** | `W/"abc123"` | 의미상 동등 (Semantic equivalence) |

### Spring에서 ETag 구현

```java
// 1. ShallowEtagHeaderFilter 사용 (간단한 방법)
@Configuration
public class WebConfig {

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration =
            new FilterRegistrationBean<>();
        registration.setFilter(new ShallowEtagHeaderFilter());
        registration.addUrlPatterns("/api/*");
        return registration;
    }
}
```

```java
// 2. 수동 ETag 처리 (세밀한 제어)
@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProduct(
            @PathVariable Long id,
            WebRequest request) {

        Product product = productService.findById(id);

        // ETag 생성 (버전 또는 해시 기반)
        String etag = "\"" + product.getVersion() + "\"";

        // 변경 여부 확인
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }

        return ResponseEntity.ok()
                .eTag(etag)
                .body(product);
    }
}
```

```java
// 3. Last-Modified와 함께 사용
@GetMapping("/{id}")
public ResponseEntity<Product> getProduct(
        @PathVariable Long id,
        WebRequest request) {

    Product product = productService.findById(id);

    long lastModified = product.getUpdatedAt().toEpochMilli();

    if (request.checkNotModified(lastModified)) {
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    return ResponseEntity.ok()
            .lastModified(lastModified)
            .body(product);
}
```

### 캐싱 헤더 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                    캐싱 헤더 조합 가이드                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  권장 조합 (중복 방지):                                          │
│                                                                 │
│   시간 기반        +        검증 기반                            │
│  ┌─────────────┐          ┌─────────────┐                      │
│  │ Cache-Control│   OR    │ ETag        │                      │
│  │ max-age      │         │     OR      │                      │
│  │     OR       │         │ Last-Modified│                      │
│  │ Expires      │         │             │                      │
│  └─────────────┘          └─────────────┘                      │
│                                                                 │
│  ✅ 좋은 예: Cache-Control: max-age=3600 + ETag: "v1"          │
│  ❌ 나쁜 예: Expires + Cache-Control (중복)                     │
│  ❌ 나쁜 예: ETag + Last-Modified (중복)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CDN과 다계층 캐싱

### 캐싱 레이어

```
┌─────────────────────────────────────────────────────────────────┐
│                    다계층 캐싱 아키텍처                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client        CDN Edge      API Gateway    Server     DB     │
│  ┌──────┐     ┌──────────┐   ┌──────────┐  ┌──────┐  ┌──────┐ │
│  │      │────►│          │──►│          │─►│      │─►│      │ │
│  │Browser│    │ CloudFront│   │  Kong    │  │Spring│  │Redis │ │
│  │ Cache │    │ Cloudflare│   │          │  │ Boot │  │ MySQL│ │
│  │      │◄───│          │◄──│          │◄─│      │◄─│      │ │
│  └──────┘     └──────────┘   └──────────┘  └──────┘  └──────┘ │
│     ↑              ↑              ↑            ↑          ↑    │
│   L1 캐시       L2 캐시       L3 캐시       L4 캐시    원본 데이터│
│  (브라우저)     (엣지)       (게이트웨이)   (앱 캐시)            │
│                                                                 │
│  가장 빠름 ◄──────────────────────────────────────► 가장 느림   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 캐시 무효화 전략

| 전략 | 설명 | 사용 시점 |
|------|------|----------|
| **TTL 기반** | 시간 경과 후 자동 만료 | 변경 빈도가 예측 가능할 때 |
| **버전 기반** | URL에 버전 포함 | 정적 리소스 배포 시 |
| **Purge API** | 수동으로 캐시 삭제 | 긴급 업데이트 시 |
| **태그 기반** | 관련 캐시 그룹 삭제 | 연관 데이터 변경 시 |

```http
# 버전 기반 캐시 무효화 (Cache Busting)
GET /static/app.v2.3.1.js HTTP/1.1

# 또는 쿼리 파라미터 사용
GET /static/app.js?v=2.3.1 HTTP/1.1
```

---

## 비동기 작업 처리

처리 시간이 긴 작업은 동기 방식으로 클라이언트를 대기시키면 안 된다.

### 비동기 처리 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│                    비동기 요청/응답 패턴                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                   Server                  Worker       │
│     │                        │                       │          │
│     │─── 1. POST /reports ──►│                       │          │
│     │       (보고서 생성 요청) │                       │          │
│     │                        │                       │          │
│     │◄── 2. 202 Accepted ───│                       │          │
│     │    Location: /jobs/123 │                       │          │
│     │                        │                       │          │
│     │                        │── 3. 작업 큐에 추가 ──►│          │
│     │                        │                       │          │
│     │                        │           (백그라운드 처리)       │
│     │                        │                       │          │
│     │─── 4. GET /jobs/123 ──►│                       │          │
│     │       (상태 확인)       │                       │          │
│     │                        │                       │          │
│     │◄── 5. 200 OK ─────────│                       │          │
│     │    {"status":"processing"}                     │          │
│     │                        │                       │          │
│     │        ... (폴링 반복) ...                      │          │
│     │                        │                       │          │
│     │◄── 6. 200 OK ─────────│◄── 완료 ──────────────│          │
│     │    {"status":"completed",                      │          │
│     │     "result":"/reports/456"}                   │          │
│     │                        │                       │          │
│     │─── 7. GET /reports/456 ►│                       │          │
│     │                        │                       │          │
│     │◄── 8. 200 OK (결과) ──│                       │          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 202 Accepted 응답

```http
# 요청
POST /api/v1/reports/generate HTTP/1.1
Content-Type: application/json

{
    "type": "sales",
    "period": "2024-Q1"
}

# 응답
HTTP/1.1 202 Accepted
Location: /api/v1/jobs/abc123
Content-Type: application/json

{
    "jobId": "abc123",
    "status": "queued",
    "message": "Report generation has been queued",
    "estimatedTime": 30,
    "statusUrl": "/api/v1/jobs/abc123"
}
```

### 작업 상태 API

```java
@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    @GetMapping("/{jobId}")
    public ResponseEntity<JobStatus> getJobStatus(@PathVariable String jobId) {

        Job job = jobService.findById(jobId);

        JobStatus status = JobStatus.builder()
                .jobId(jobId)
                .status(job.getStatus()) // QUEUED, PROCESSING, COMPLETED, FAILED
                .progress(job.getProgress())
                .createdAt(job.getCreatedAt())
                .build();

        // 완료된 경우 결과 URL 포함
        if (job.isCompleted()) {
            status.setResultUrl("/api/v1/reports/" + job.getResultId());
        }

        return ResponseEntity.ok(status);
    }
}
```

### Spring에서 비동기 처리

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.initialize();
        return executor;
    }
}
```

```java
@Service
public class ReportService {

    @Async
    public CompletableFuture<Report> generateReportAsync(ReportRequest request) {

        // 시간이 오래 걸리는 작업
        Report report = generateReport(request);

        return CompletableFuture.completedFuture(report);
    }
}
```

---

## 폴링 vs SSE vs WebSocket

실시간 업데이트를 위한 방법 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                  실시간 통신 방식 비교                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Polling (폴링)                                                 │
│  ┌──────┐     ┌──────┐                                         │
│  │Client│────►│Server│  주기적으로 요청                         │
│  │      │◄────│      │  데이터 변경 없어도 요청                  │
│  └──────┘     └──────┘  → 리소스 낭비                           │
│                                                                 │
│  SSE (Server-Sent Events)                                       │
│  ┌──────┐     ┌──────┐                                         │
│  │Client│────►│Server│  한 번 연결                              │
│  │      │◄════│      │  서버가 일방향으로 푸시                   │
│  └──────┘     └──────┘  → 서버→클라이언트만 가능                 │
│                                                                 │
│  WebSocket                                                      │
│  ┌──────┐     ┌──────┐                                         │
│  │Client│◄═══►│Server│  양방향 통신                             │
│  │      │     │      │  실시간 상호작용                         │
│  └──────┘     └──────┘  → 가장 효율적, 복잡                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 방식 | 장점 | 단점 | 사용 사례 |
|------|------|------|----------|
| **Polling** | 구현 간단, 호환성 좋음 | 리소스 낭비, 지연 | 작업 상태 확인 |
| **Long Polling** | 실시간에 가까움 | 연결 유지 필요 | 채팅 (레거시) |
| **SSE** | 자동 재연결, 간단 | 단방향만 가능 | 알림, 피드 |
| **WebSocket** | 양방향, 저지연 | 구현 복잡 | 게임, 실시간 협업 |

### SSE 구현 예시

```java
@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    @GetMapping(value = "/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<JobStatus>> streamJobStatus(@PathVariable String jobId) {

        return Flux.interval(Duration.ofSeconds(1))
                .map(i -> {
                    JobStatus status = jobService.getStatus(jobId);
                    return ServerSentEvent.<JobStatus>builder()
                            .id(String.valueOf(i))
                            .event("job-status")
                            .data(status)
                            .build();
                })
                .takeUntil(sse -> sse.data().isCompleted());
    }
}
```

---

## HTTP PATCH와 부분 업데이트

### PUT vs PATCH

```
┌─────────────────────────────────────────────────────────────────┐
│                     PUT vs PATCH 비교                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   PUT (전체 교체)                    PATCH (부분 수정)            │
│  ┌────────────────────────┐       ┌────────────────────────┐   │
│  │                        │       │                        │   │
│  │  모든 필드 전송 필요     │       │  변경할 필드만 전송      │   │
│  │                        │       │                        │   │
│  │  {                     │       │  {                     │   │
│  │    "name": "John",     │       │    "name": "John"      │   │
│  │    "email": "...",     │       │  }                     │   │
│  │    "age": 30,          │       │                        │   │
│  │    "address": "..."    │       │  → email, age, address │   │
│  │  }                     │       │    유지됨               │   │
│  │                        │       │                        │   │
│  │  멱등성: O             │       │  멱등성: X (일반적으로) │   │
│  │                        │       │                        │   │
│  └────────────────────────┘       └────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### JSON Merge Patch (RFC 7396)

가장 직관적인 부분 업데이트 방식

```http
# 요청
PATCH /api/v1/users/123 HTTP/1.1
Content-Type: application/merge-patch+json

{
    "name": "John Updated",
    "email": null
}

# 결과
# - name: "John Updated"로 변경
# - email: 삭제됨 (null)
# - 다른 필드: 유지
```

```java
// Spring에서 JSON Merge Patch 처리
@PatchMapping(value = "/{id}", consumes = "application/merge-patch+json")
public ResponseEntity<User> patchUser(
        @PathVariable Long id,
        @RequestBody JsonMergePatch patch) throws JsonPatchException {

    User user = userService.findById(id);

    // 패치 적용
    JsonNode patched = patch.apply(objectMapper.valueToTree(user));
    User patchedUser = objectMapper.treeToValue(patched, User.class);

    return ResponseEntity.ok(userService.save(patchedUser));
}
```

### JSON Patch (RFC 6902)

복잡한 변경을 명시적으로 표현

```http
# 요청
PATCH /api/v1/orders/1234 HTTP/1.1
Content-Type: application/json-patch+json

[
    {"op": "replace", "path": "/status", "value": "COMPLETED"},
    {"op": "add", "path": "/notes/-", "value": "배송 완료"},
    {"op": "remove", "path": "/tempData"},
    {"op": "copy", "path": "/billingAddress", "from": "/shippingAddress"},
    {"op": "move", "path": "/archivedAt", "from": "/completedAt"},
    {"op": "test", "path": "/version", "value": 5}
]
```

### JSON Patch 연산자

| 연산자 | 설명 | 예시 |
|--------|------|------|
| **add** | 값 추가 | `{"op":"add", "path":"/tags/-", "value":"new"}` |
| **remove** | 값 삭제 | `{"op":"remove", "path":"/temp"}` |
| **replace** | 값 교체 | `{"op":"replace", "path":"/name", "value":"New Name"}` |
| **move** | 값 이동 | `{"op":"move", "from":"/a", "path":"/b"}` |
| **copy** | 값 복사 | `{"op":"copy", "from":"/a", "path":"/b"}` |
| **test** | 값 검증 | `{"op":"test", "path":"/version", "value":5}` |

```java
// Spring에서 JSON Patch 처리
@PatchMapping(value = "/{id}", consumes = "application/json-patch+json")
public ResponseEntity<Order> patchOrder(
        @PathVariable Long id,
        @RequestBody JsonPatch patch) throws JsonPatchException {

    Order order = orderService.findById(id);

    JsonNode patched = patch.apply(objectMapper.valueToTree(order));
    Order patchedOrder = objectMapper.treeToValue(patched, Order.class);

    return ResponseEntity.ok(orderService.save(patchedOrder));
}
```

### JSON Patch 활용 분야

```
┌─────────────────────────────────────────────────────────────────┐
│                  JSON Patch 활용 사례                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  단일 페이지 애플리케이션 (SPA)                           │   │
│  │  → 대역폭 절약, 빠른 UI 반응                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  실시간 협업 시스템                                       │   │
│  │  → Google Docs 스타일 동시 편집, 충돌 해결               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  오프라인 데이터 동기화                                   │   │
│  │  → 변경사항만 전송하여 동기화 효율화                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  대용량 문서 편집                                         │   │
│  │  → 전체 문서 대신 변경된 부분만 전송                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting

API 과부하를 방지하고 공정한 사용을 보장하는 기법

### Rate Limiting 전략

| 전략 | 설명 | 특징 |
|------|------|------|
| **Fixed Window** | 고정 시간 윈도우 | 간단하지만 버스트 가능 |
| **Sliding Window** | 이동 시간 윈도우 | 더 정확한 제한 |
| **Token Bucket** | 토큰 기반 | 버스트 허용 |
| **Leaky Bucket** | 일정 속도 처리 | 안정적인 속도 |

### Rate Limit 응답 헤더

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200

# 또는 (표준화된 헤더)
RateLimit-Limit: 1000
RateLimit-Remaining: 999
RateLimit-Reset: 3600
```

### 429 Too Many Requests

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "retryAfter": 60
}
```

---

## 캐싱 베스트 프랙티스

```
┌─────────────────────────────────────────────────────────────────┐
│                  캐싱 베스트 프랙티스                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ DO                                                          │
│  ───────────────────────────────────────────────────────────── │
│  • 정적 리소스에 장기 캐시 + 버전 기반 URL 사용                   │
│  • Cache-Control과 ETag 조합 사용                               │
│  • CDN 레이어 활용                                              │
│  • GET 요청에만 캐싱 적용                                        │
│  • 공용 데이터는 public, 개인 데이터는 private 설정              │
│                                                                 │
│  ❌ DON'T                                                       │
│  ───────────────────────────────────────────────────────────── │
│  • PUT/POST 요청 결과 캐싱                                       │
│  • 쿼리 파라미터가 있는 요청 캐싱 (파라미터 값 변경 시 무효)       │
│  • 인증이 필요한 개인 데이터를 public 캐시                        │
│  • Expires와 max-age 동시 사용 (중복)                            │
│  • ETag와 Last-Modified 동시 사용 (중복)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **Cache Hit** | 캐시에서 응답을 찾음 |
| **Cache Miss** | 캐시에 없어 원본 서버 요청 |
| **TTL** | Time To Live, 캐시 유효 시간 |
| **ETag** | 리소스 버전 식별자 |
| **조건부 요청** | If-None-Match, If-Modified-Since 사용 |
| **304 Not Modified** | 리소스 변경 없음, 캐시 사용 |
| **202 Accepted** | 비동기 요청 접수됨 |
| **폴링** | 주기적으로 상태 확인 요청 |
| **SSE** | Server-Sent Events, 서버→클라이언트 푸시 |
| **JSON Patch** | RFC 6902, 부분 업데이트 표준 |
| **JSON Merge Patch** | RFC 7396, 간단한 부분 업데이트 |
| **Rate Limiting** | API 요청 속도 제한 |
