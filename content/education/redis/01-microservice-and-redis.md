---
title: "01. 마이크로서비스 아키텍처와 레디스"
weight: 1
---

## 1. NoSQL의 등장 배경

소프트웨어의 핵심은 데이터다. 어떤 저장소를 고르느냐가 곧 애플리케이션의 **성능·확장성·가용성·신뢰성**을 결정한다. 디지털 산업이 팽창하면서 시스템은 중앙 집약적 **모놀리틱**에서 **마이크로서비스(MSA)** 로 옮겨가고, 저장소 역시 획일적인 관계형 일변도에서 용도별로 세분화되는 방향으로 발전해왔다.

### 모놀리틱 vs 마이크로서비스

```text
  Monolithic           Microservices
┌────────────┐      ┌───┐┌───┐┌───┐
│  User      │      │ U ││ O ││ P │
├────────────┤      └─┬─┘└─┬─┘└─┬─┘
│  Order     │        │    │    │
├────────────┤      ┌─▼────▼────▼─┐
│  Payment   │      │  REST/gRPC  │
└─────┬──────┘      └─────────────┘
      │              각 서비스가
 단일 DB 공유         독립 DB 선택
```

| 구분 | 모놀리틱 | 마이크로서비스 |
|:---|:---|:---|
| 배포 단위 | 애플리케이션 전체 | 서비스 단위 |
| 데이터 저장소 | 단일 RDB 집약형 | 서비스별 최적 저장소 |
| 확장 | 전체 복제 | 필요한 서비스만 |
| 장애 전파 | 전체로 확산 | 서비스 단위 격리 |
| 기술 선택 | 단일 스택 | 서비스별 자유 선택 |

### 데이터 저장소 요구 사항의 변화

관계형 데이터베이스는 고정된 스키마에 행·열로 데이터를 저장하고, 테이블 간 관계를 엄격히 규정한다. 모놀리틱 시대에는 **하나의 RDB가 모든 데이터**를 책임졌기 때문에 표준으로 자리잡았다.

하지만 최근에는 정해진 형태가 없고 크기·구조를 예측할 수 없는 **비정형 데이터**가 급증하고 있다. 다차원·계층적 구조 데이터는 정형화된 테이블에 담기 어렵고, MSA에서는 서비스별로 요구하는 저장소 특성도 제각각이다.

{{< callout type="info" >}}
MSA의 핵심 원칙 중 하나는 **서비스마다 데이터 소유권을 갖는다(Database per Service)**. 다른 서비스의 테이블을 직접 조인하지 않고, API 호출·이벤트로만 상호 참조해야 느슨한 결합이 유지된다.
{{< /callout >}}

---

## 2. NoSQL이란?

**NoSQL**은 *No SQL* 혹은 *Not Only SQL*의 약자로, 관계형 데이터베이스에서 사용하는 SQL에 의존하지 않는 데이터 저장소를 통칭한다. 관계가 엄격히 정의되지 않은 데이터를 저장한다는 점이 공통 특징이다.

NoSQL이 요구받는 핵심 품질은 다섯 가지로 요약된다.

| 요구 사항 | 설명 |
|:---|:---|
| 실시간 응답 | 사람은 100ms 지연부터 느리다고 인지 — 저장소는 0~1ms 수준 지향 |
| 확장성 | 이벤트·세일 트래픽 폭증에 유연하게 확장 가능 |
| 고가용성 | 장애 상황에서 신속 복구·무중단 운영 |
| 클라우드 네이티브 | DBaaS 형태로 설치·운영 부담 최소화 |
| 단순성 | 서비스가 세분화될수록 관리 포인트 증가 → 쉬운 사용성 요구 |
| 유연성 | 비정형 데이터를 원형 그대로 저장 |

{{< callout type="warning" >}}
NoSQL은 만능이 아니다. **강한 일관성·트랜잭션·복잡한 조인**이 중요한 도메인(회계, 결제 원장)은 여전히 RDB가 더 적합하다. NoSQL은 "RDB를 대체"가 아니라 "RDB로 풀기 어려운 영역을 보완"하는 도구로 봐야 한다.
{{< /callout >}}

---

## 3. NoSQL 데이터 저장소 유형

NoSQL은 저장 구조에 따라 크게 네 가지로 나뉜다.

### 3-1. 그래프 유형

엔티티 간의 **관계 자체**를 일급 시민으로 저장하는 모델이다. 데이터는 노드(node)·에지(edges)·속성(properties)으로 표현되며, 에지는 **시작 노드·끝 노드·유형·방향**을 갖는다. 상-하위 관계, 동작, 소유권 등 복잡한 네트워크성 데이터를 효율적으로 질의한다.

```text
 (Alice) ──FOLLOWS──▶ (Bob)
    │                   │
    │LIKES           FOLLOWS
    ▼                   ▼
 (Post#1) ◄─AUTHORED─ (Carol)
```

- 대표 제품: Neo4j, Amazon Neptune
- 활용 사례: 소셜 그래프, 추천 엔진, 사기 탐지

### 3-2. 칼럼 유형

테이블을 **행이 아닌 열 기준**으로 저장한다. *칼럼 지향*(column-oriented), *와이드 칼럼*(wide column)이라고도 부른다. 대량의 시계열·분석 워크로드에서 특정 칼럼만 스캔하면 되므로 I/O가 효율적이다.

- 대표 제품: Apache Cassandra, HBase, ScyllaDB
- 활용 사례: IoT 시계열, 로그 분석, 대규모 집계

### 3-3. 문서 유형

**JSON 형태**로 데이터를 저장해 애플리케이션 객체와 그대로 매핑된다. 스키마가 강제되지 않아 유연성이 크고, 모든 값은 키에 연결되는 **계층적 트리** 구조를 갖는다.

```json
{
  "_id": "user:123",
  "name": "Alice",
  "orders": [
    { "id": 1, "total": 50000 },
    { "id": 2, "total": 12000 }
  ]
}
```

- 대표 제품: MongoDB, Couchbase
- 활용 사례: 상품 카탈로그, CMS, 이벤트 로깅

### 3-4. 키-값 유형

가장 단순하고 가장 빠른 모델. 키는 RDB의 **PK에 해당**하며, 키를 사용해 값을 조회하고 키가 삭제되면 값도 함께 사라진다.

```text
┌──────────┬──────────────────┐
│   Key    │      Value       │
├──────────┼──────────────────┤
│ user:1   │ "Alice"          │
│ cart:42  │ [item1,item2,..] │
│ sess:abc │ {uid:1,exp:...}  │
└──────────┴──────────────────┘
```

- 대표 제품: **Redis**, Amazon DynamoDB, Memcached
- 활용 사례: 캐시, 세션 저장소, 레이트 리미팅

### 유형별 한눈에 비교

| 유형 | 데이터 모델 | 강점 | 대표 제품 |
|:---|:---|:---|:---|
| 그래프 | 노드/에지 | 관계 탐색 | Neo4j |
| 칼럼 | 와이드 칼럼 | 대량 분석 | Cassandra |
| 문서 | JSON 트리 | 객체 매핑 | MongoDB |
| 키-값 | K/V 맵 | 초저지연 | Redis |

---

## 4. 레디스란?

**Redis**(Remote Dictionary Server)는 고성능 키-값 유형의 **인메모리 NoSQL 데이터베이스**이며, 오픈소스 라이선스로 배포된다. 2009년 Salvatore Sanfilippo가 공개한 이래 캐시·세션·메시지 브로커 등 MSA 전반의 "스위스 아미 나이프"로 자리잡았다.

### 레디스 전체 조감

```text
┌──────────────────────────────┐
│        Redis Server          │
│  ┌────────────────────────┐  │
│  │   In-Memory Dataset    │  │
│  │  String/Hash/List/Set  │  │
│  │  SortedSet/Stream 등   │  │
│  └──────────┬─────────────┘  │
│             │ (주기적 저장)   │
│  ┌──────────▼─────────────┐  │
│  │   RDB / AOF Snapshot   │  │
│  └────────────────────────┘  │
└────────┬─────────┬───────────┘
         │         │
   Replication  Sentinel
         │         │
   ┌─────▼───┐ 자동 페일오버
   │ Replica │
   └─────────┘
```

---

## 5. 레디스의 특징

### 5-1. 실시간 응답 (빠른 성능)

대부분의 DBMS는 **온디스크(disk-based)** 형태다. HDD·SSD 접근은 RAM 접근보다 수십~수천 배 느리다. 레디스는 모든 데이터를 메모리에서 다루기 때문에 디스크 I/O가 경로에서 빠진다.

```text
  RDB(온디스크)       Redis(인메모리)
  ┌──────────┐        ┌──────────┐
  │ Memory   │        │ Memory   │
  │  ↕ I/O   │        │   ✔      │
  │ Disk     │        │ (저장만  │
  │ (원본)   │        │  디스크) │
  └──────────┘        └──────────┘
   ≈ 수 ms              < 1 ms
```

### 5-2. 단순성 — 풍부한 자료 구조

키에 매핑되는 값으로 **String·Hash·List·Set·Sorted Set·Stream** 등 프로그래밍 기본 자료 구조를 바로 제공한다. 애플리케이션에서 추가 가공 없이 그대로 활용 가능하다.

**임피던스 불일치(Impedance Mismatch)**: 관계형 테이블과 프로그래밍 언어의 자료 구조 차이로 발생하는 충돌. 레디스는 언어와 동일한 자료 구조를 그대로 노출해 이 문제를 줄여준다.

```bash
# 문자열
SET user:1:name "Alice"
GET user:1:name

# 해시(객체)
HSET user:1 name "Alice" age 30
HGETALL user:1

# 리스트(큐)
LPUSH queue:tasks "job-123"
BRPOP queue:tasks 0       # 블로킹 팝

# 셋(집합)
SADD online:users 1 2 3
SISMEMBER online:users 1

# 정렬 셋(랭킹)
ZADD leaderboard 1500 "alice" 1800 "bob"
ZREVRANGE leaderboard 0 9 WITHSCORES
```

{{< callout type="warning" >}}
레디스는 **싱글 스레드**로 커맨드를 처리한다(메인 1 + 보조 3, 총 4 스레드). 이벤트 루프 기반이기 때문에 `KEYS *`, `SMEMBERS` on huge set, 거대한 Lua 스크립트 같이 오래 걸리는 커맨드 하나가 **전체 클라이언트를 블로킹**한다. 운영에서는 `SCAN`, `SSCAN` 등 반복형 커맨드로 대체하자.
{{< /callout >}}

### 5-3. 고가용성 (HA)

레디스는 **복제(Replication) + 센티넬(Sentinel)** 조합으로 자체 HA를 제공한다. 센티넬은 마스터·레플리카 상태를 감시하다가 마스터 장애 시 자동으로 **페일오버**를 수행한다.

```text
   ┌────────────┐
   │  Sentinel  │◄── 상태 감시 ──┐
   └──────┬─────┘                │
          │ quorum 합의          │
  ┌───────▼─────┐    복제    ┌───┴────────┐
  │   Master    │───────────▶│  Replica   │
  └─────────────┘            └────────────┘
         × 장애                    ▲
          └─────── 자동 승격 ──────┘
```

### 5-4. 확장성 (Cluster Mode)

**클러스터 모드**에서 레디스는 데이터를 16384개의 **해시 슬롯**으로 나눠 여러 마스터에 분산한다. 노드 간에는 **클러스터 버스** 프로토콜로 서로 감시하며, 마스터 장애 시 해당 슬롯의 레플리카가 자동 승격된다.

```text
┌─────────────────────────────┐
│    Redis Cluster (3 Master) │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ M1   │ │ M2   │ │ M3   │ │
│  │0─5460│ │5461─ │ │10923 │ │
│  │      │ │10922 │ │─16383│ │
│  └──┬───┘ └──┬───┘ └──┬───┘ │
│     │        │        │     │
│  ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ │
│  │ R1   │ │ R2   │ │ R3   │ │
│  └──────┘ └──────┘ └──────┘ │
└─────────────────────────────┘
```

### 5-5. 클라우드 네이티브 — 멀티 클라우드

클라우드 네이티브는 **마이크로서비스·컨테이너·오케스트레이션·DevOps**를 품은 개발 운영 패러다임이다. 멀티 클라우드는 여러 CSP를 혼합 운용해 **벤더 락인·단일 장애점**을 줄이는 전략이다. 레디스는 AWS ElastiCache, Azure Cache for Redis, GCP Memorystore 등 주요 클라우드마다 관리형 서비스로 제공되어 클라우드 간 이식성이 높다.

---

## 6. 마이크로서비스 아키텍처와 레디스

레디스는 MSA 환경에서 단일 용도가 아닌 **여러 역할**을 동시에 담당한다.

### 6-1. 데이터 저장소로서의 레디스

메모리 데이터는 프로세스 종료 시 휘발된다. 레디스는 이를 보완하기 위해 두 가지 영속화 옵션을 제공한다.

| 방식 | 설명 | 장점 | 단점 |
|:---|:---|:---|:---|
| **RDB** (Redis DataBase) | 시점 스냅샷을 바이너리로 저장 | 복구 빠름, 파일 작음 | 마지막 저장 이후 데이터 유실 가능 |
| **AOF** (Append Only File) | 모든 쓰기 커맨드를 로그로 기록 | 데이터 유실 최소화 | 파일 크고 복구 느림 |

```text
[Client WRITE]
      │
      ▼
┌─────────────┐
│ Redis (RAM) │──┬── RDB: 주기적 스냅샷
└─────────────┘  │
                 └── AOF: 모든 쓰기 append
```

{{< callout type="info" >}}
운영에서는 **RDB + AOF를 함께** 쓰는 경우가 많다. 재시작 시 AOF가 있으면 AOF를 우선 사용해 최신성을 확보하고, RDB는 백업·빠른 복구용으로 활용한다.
{{< /callout >}}

### 6-2. 메시지 브로커로서의 레디스

| 기능 | 자료 구조 | 특징 | 적합 용도 |
|:---|:---|:---|:---|
| Pub/Sub | — | Fire-and-forget, 일회성 | 간단한 알림 |
| List Queue | List | LPUSH/BRPOP, 블로킹 지원 | 작업 큐 |
| Stream | Stream | Append-only, Consumer Group | 카프카 스타일 이벤트 스트림 |

```text
 Pub/Sub (일회성)
 ┌───────┐ PUBLISH ┌─────────┐
 │ Pub A │────────▶│ Channel │──┬─▶ Sub 1
 └───────┘         └─────────┘  ├─▶ Sub 2
                                 └─▶ Sub 3
  ※ 구독자가 없을 때 발행된 메시지는 사라짐

 Stream (영속, 재소비 가능)
 ┌───────┐ XADD   ┌──────────────┐ XREADGROUP
 │ Prod  │───────▶│ Stream (log) │──────────▶ Group:A
 └───────┘        │ [e1][e2]...  │──────────▶ Group:B
                  └──────────────┘
  ※ 각 그룹이 독립적으로 오프셋 관리
```

### 6-3. 실무에서 자주 쓰는 레디스 패턴

| 패턴 | 설명 | 관련 커맨드 |
|:---|:---|:---|
| **캐시 (Look-aside)** | 앱이 먼저 Redis 조회, 미스 시 DB → Redis 적재 | `GET`, `SET EX` |
| **세션 스토어** | JWT가 아닌 서버 세션을 Redis에 저장해 수평 확장 | `HSET`, `EXPIRE` |
| **레이트 리미터** | 키당 카운터로 호출량 제한 | `INCR`, `EXPIRE` |
| **분산 락** | SET NX 기반, Redlock 알고리즘 | `SET NX PX` |
| **랭킹 보드** | 실시간 점수 정렬 | `ZADD`, `ZREVRANGE` |

```java
// Spring Data Redis — Look-aside 캐시 예시
@Service
@RequiredArgsConstructor
public class ProductService {

    private final StringRedisTemplate redis;
    private final ProductRepository repo;

    public Product findById(Long id) {
        String key = "product:" + id;
        String cached = redis.opsForValue().get(key);
        if (cached != null) {
            return deserialize(cached);
        }

        Product product = repo.findById(id)
                .orElseThrow(() -> new NotFoundException(id));
        redis.opsForValue().set(key, serialize(product), Duration.ofMinutes(10));
        return product;
    }
}
```

{{< callout type="warning" >}}
캐시 전략에서 가장 흔한 사고는 **캐시 스탬피드(Cache Stampede)**. TTL 만료 순간 동일 키에 대한 요청이 모두 DB로 몰리는 현상이다. `SET NX` 락, 사전 갱신(probabilistic early expiration), request coalescing 같은 방어 장치를 함께 적용해야 한다.
{{< /callout >}}

---

## 7. 핵심 용어 정리

| 용어 | 설명 |
|:---|:---|
| NoSQL | 관계형 DB의 SQL에 의존하지 않는 저장소 총칭 |
| 임피던스 불일치 | RDB 테이블과 프로그래밍 자료 구조 간 변환 비용 |
| 인메모리 | 데이터를 RAM 상에 보관해 초저지연 달성 |
| DBaaS | DataBase-as-a-Service, 관리형 DB 서비스 |
| HA | High Availability, 고가용성 |
| Sentinel | 레디스 상태 감시·자동 페일오버 컴포넌트 |
| Cluster Bus | 클러스터 노드 간 감시·메타데이터 전파 프로토콜 |
| RDB | 레디스 시점 스냅샷 영속화 방식 |
| AOF | Append Only File, 레디스 쓰기 로그 영속화 방식 |
| Pub/Sub | 발행-구독 일회성 메시징 |
| Stream | Append-only, Consumer Group을 지원하는 영속 스트림 자료 구조 |
