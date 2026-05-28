---
title: "02. 레디스 시작하기"
weight: 2
---

레디스를 실행하기 전에 OS·네트워크·설정 파일 수준에서 손봐야 할 항목이 많다. 이 장에서는 운영 환경에서 안전하게 레디스를 띄우기 위한 **환경 구성**, 자주 만지는 **설정 파라미터**, **redis-cli** 사용법, 그리고 첫 **데이터 저장·조회**까지 다룬다.

---

## 1. 레디스 환경 구성

레디스는 메모리·네트워크에 매우 민감한 데이터베이스다. OS 기본값으로 그대로 띄우면 트래픽이 몰릴 때 커넥션 거부, 레이턴시 급증, OOM 등으로 이어질 수 있다.

### 1-1. Open files (파일 디스크립터)

레디스는 클라이언트 커넥션 하나당 **파일 디스크립터 1개**를 사용한다. 기본값 `maxclients = 10000`은 "동시 10000 커넥션"을 허용하겠다는 의미지만, OS가 허용하는 파일 디스크립터 수가 부족하면 레디스가 자동으로 값을 낮춰 실행된다.

```text
필요 FD = maxclients + 32 (내부 예약)
       = 10000 + 32 = 10032
```

`ulimit -n` 값이 이보다 작으면 레디스는 시작 로그에 경고를 남기며 `maxclients`를 강제로 조정한다.

```bash
# 현재 한도 확인
$ ulimit -n
1024

# 사용자별 영구 설정 (/etc/security/limits.conf)
redis  soft  nofile  65535
redis  hard  nofile  65535

# systemd 서비스라면 유닛 파일에
[Service]
LimitNOFILE=65535
```

{{< callout type="warning" >}}
운영 환경에서 가장 흔한 함정. 개발 머신에서는 `maxclients`가 10000으로 보이지만, 실제 서버에선 `ulimit -n`이 1024로 잡혀 있어 레디스가 조용히 `maxclients`를 990 수준으로 떨어뜨린다. 시작 직후 로그(`# You requested maxclients of ..., but ...`)를 반드시 확인하자.
{{< /callout >}}

### 1-2. THP (Transparent Huge Page) 비활성화

리눅스 메모리는 **페이지(기본 4KB)** 단위로 관리되며, 페이지 매핑 정보를 캐시하는 구조가 **TLB**(Translation Lookaside Buffer)다. 메모리가 커질수록 TLB 미스가 잦아지므로 커널은 페이지를 2MB·1GB로 확장하는 **THP**를 자동으로 적용한다.

문제는 레디스의 **fork 기반 영속화**다. RDB 스냅샷·AOF rewrite 시 `fork()`로 자식 프로세스를 만들고, COW(Copy-On-Write)로 메모리 페이지를 공유한다. THP가 켜져 있으면 페이지 단위가 4KB → 2MB로 커져, **단 1바이트만 바뀌어도 2MB 전체가 복사**된다. 결과적으로 메모리 사용량 폭증·레이턴시 스파이크가 발생한다.

```text
  THP OFF (4KB)         THP ON (2MB)
  ┌──┬──┬──┬──┐         ┌──────────┐
  │  │ ★│  │  │         │    ★     │
  └──┴──┴──┴──┘         └──────────┘
   ↑ 1페이지(4KB)만       ↑ 페이지 전체
     복사                   (2MB) 복사
```

```bash
# 즉시 비활성화
$ echo never > /sys/kernel/mm/transparent_hugepage/enabled

# 영구 적용 (/etc/rc.local 또는 systemd 유닛)
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# 확인
$ cat /sys/kernel/mm/transparent_hugepage/enabled
always madvise [never]
```

### 1-3. `vm.overcommit_memory = 1`

레디스는 영속화를 위해 `fork()`로 자식 프로세스를 만든다. 이론적으로 자식은 부모와 동일한 메모리를 갖기 때문에, OS 입장에서는 **부모 메모리 크기만큼의 추가 메모리가 더 요구**되는 것처럼 보인다. 실제로는 COW 덕분에 거의 추가 할당 없이 동작하지만, 커널의 기본 정책(`vm.overcommit_memory = 0`)은 "가용 메모리를 넘는 요청이면 거부"하기 때문에 fork 자체가 실패할 수 있다.

```text
vm.overcommit_memory 값
┌───┬──────────────────────────────────────────┐
│ 0 │ 휴리스틱 — 위험해 보이면 fork() 실패     │
│ 1 │ 항상 허용 — 레디스 권장                  │
│ 2 │ 엄격 — RAM + swap 한도 내에서만 허용     │
└───┴──────────────────────────────────────────┘
```

```bash
# 즉시 적용
$ sysctl vm.overcommit_memory=1

# 영구 적용
$ echo "vm.overcommit_memory = 1" >> /etc/sysctl.conf
$ sysctl -p
```

{{< callout type="info" >}}
"1로 두면 OOM 위험이 커지지 않나?" 라는 우려가 있는데, 레디스에서 fork된 자식은 **거의 즉시 종료**되며 COW로 실제 메모리는 조금만 추가 사용한다. 진짜 위험은 fork가 실패해서 **영속화가 멈추는 것**이다.
{{< /callout >}}

### 1-4. `somaxconn` · `tcp_max_syn_backlog`

레디스 설정의 `tcp-backlog`(기본 511)는 TCP 연결 수립 시 사용하는 **백로그 큐 크기**다. 하지만 이 값은 OS의 두 파라미터를 넘을 수 없다.

| 파라미터 | 의미 | 기본값 |
|:---|:---|:---|
| `net.core.somaxconn` | accept 완료 대기 큐 최대치 | 128 |
| `net.ipv4.tcp_max_syn_backlog` | SYN 수신 대기 큐 최대치 | 128 |

```text
   Client SYN
       │
       ▼
 ┌─────────────────┐
 │ SYN queue       │ ← tcp_max_syn_backlog
 │ (SYN_RECV)      │
 └────────┬────────┘
          │ ACK
          ▼
 ┌─────────────────┐
 │ Accept queue    │ ← somaxconn
 │ (ESTABLISHED)   │
 └────────┬────────┘
          │ accept()
          ▼
       Redis
```

```bash
# 운영 권장값
$ sysctl -w net.core.somaxconn=1024
$ sysctl -w net.ipv4.tcp_max_syn_backlog=1024

# 영구 적용 (/etc/sysctl.conf)
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
```

{{< callout type="warning" >}}
이 값이 작으면 트래픽 스파이크가 발생할 때 TCP 핸드셰이크 단계에서 패킷이 **조용히 드롭**된다. 클라이언트에서는 `connection refused`나 타임아웃으로 보이지만 레디스 로그에는 아무것도 남지 않아 원인 추적이 어렵다.
{{< /callout >}}

---

## 2. 레디스 설정 파일 (`redis.conf`)

레디스 설정 파일은 `keyword arg1 arg2` 형태의 단순한 라인 기반이다. 주석은 `#`으로 시작하며, 같은 키가 중복되면 **나중에 선언된 값**이 우선한다.

```text
# 형식
keyword  argument1  argument2 ...

# 예시
port            6379
bind            127.0.0.1 ::1
maxmemory       2gb
save            900 1
```

### 2-1. 자주 만지는 핵심 파라미터

| 파라미터 | 기본값 | 설명 |
|:---|:---|:---|
| `port` | `6379` | 레디스가 수신할 TCP 포트 |
| `bind` | `127.0.0.1 -::1` | 수신할 네트워크 인터페이스 IP |
| `protected-mode` | `yes` | 외부 접근 시 패스워드 강제 여부 |
| `requirepass` | (없음) | 클라이언트 인증 패스워드 |
| `masterauth` | (없음) | 복제 시 마스터 접속용 패스워드 |
| `daemonize` | `no` | 백그라운드 실행 여부 |
| `pidfile` | `/var/run/redis_6379.pid` | 데몬 모드 PID 파일 경로 |
| `dir` | `./` | RDB·AOF·로그 저장 디렉터리 |
| `logfile` | `""` | 로그 파일 경로 (빈 값이면 stdout) |
| `maxmemory` | `0` (무제한) | 최대 메모리 사용량 |
| `maxmemory-policy` | `noeviction` | 메모리 초과 시 키 축출 정책 |

### 2-2. `port`

레디스가 클라이언트 연결을 수신할 TCP 포트. 같은 서버에서 여러 인스턴스를 띄울 때는 포트로 구분한다.

```text
port 6379
```

### 2-3. `bind` — 외부 접근 허용

서버에는 보통 여러 NIC가 있고, NIC마다 IP가 다르다. `bind`는 그중 **어떤 IP로 들어오는 연결을 받을지** 지정한다. 기본값 `127.0.0.1`은 루프백 — 서버 내부 요청만 받는다.

```text
# 외부에서 직접 접근 가능 — 위험
bind 0.0.0.0

# 운영 권장 — 사내 IP + 루프백
bind 192.168.1.100 127.0.0.1
```

```text
   외부 클라이언트
       │
       ▼
  ┌─────────┐  bind 0.0.0.0 → ✔ 수신
  │ Server  │  bind 192.168.1.100 → ✔ 수신
  │  NIC1   │  bind 127.0.0.1 → ✘ 차단
  │ 1.100   │
  └─────────┘
```

{{< callout type="warning" >}}
`bind 0.0.0.0` + `protected-mode no` + `requirepass` 미설정 조합은 **인터넷에 무방비로 노출된 레디스**를 만든다. 채굴 봇·랜섬 봇이 즉시 들어와 데이터를 지우고 협박 키를 남기는 사고가 매우 흔하다. 외부 노출이 필요하다면 반드시 패스워드 + 방화벽 + TLS를 함께 적용하자.
{{< /callout >}}

### 2-4. `protected-mode`

레디스 3.2부터 도입된 안전장치. `yes`일 때 다음 조건 중 하나라도 어기면 **외부에서 들어오는 연결을 거부**한다.

```text
protected-mode yes 조건
├── bind가 명시되어 있다           ✔
└── requirepass가 설정되어 있다    ✔
        ↓
   둘 다 만족하지 않으면
   localhost 외 연결을 차단
```

### 2-5. `requirepass` · `masterauth`

```text
# 클라이언트 인증
requirepass StrongP@ssw0rd!

# 복제 구조에서 마스터 접속용
masterauth  StrongP@ssw0rd!
```

```bash
# CLI에서 인증
$ redis-cli
127.0.0.1:6379> PING
(error) NOAUTH Authentication required.
127.0.0.1:6379> AUTH StrongP@ssw0rd!
OK
127.0.0.1:6379> PING
PONG
```

{{< callout type="info" >}}
복제(replica)는 마스터에 접속해 데이터를 받아오므로 마스터의 패스워드를 알고 있어야 한다. `requirepass`와 `masterauth`를 **동일한 값**으로 두면 페일오버로 레플리카가 마스터로 승격될 때도 다른 노드가 무중단으로 따라붙을 수 있다.
{{< /callout >}}

### 2-6. `daemonize` · `pidfile`

`yes`로 설정하면 레디스가 백그라운드 프로세스로 분리되며 `pidfile`에 PID를 기록한다. systemd로 관리한다면 보통 `daemonize no` + `Type=notify`를 함께 사용한다.

```text
daemonize  yes
pidfile    /var/run/redis_6379.pid
```

### 2-7. `dir`

RDB 스냅샷·AOF 파일·로그가 저장될 워킹 디렉터리. 기본값 `./`(실행 디렉터리)는 위험 — 어디서 실행했느냐에 따라 파일이 흩어진다. **반드시 명시**하자.

```text
dir       /var/lib/redis
logfile   /var/log/redis/redis.log
```

---

## 3. 레디스 접속하기 (`redis-cli`)

레디스를 설치하면 함께 들어오는 CLI 클라이언트. `bin/redis-cli` 위치에 있어 PATH 등록이 편리하다.

```bash
# PATH 추가
$ export PATH=$PATH:/home/centos/redis/bin

# 기본 접속
$ redis-cli
127.0.0.1:6379>

# 옵션 형식
$ redis-cli -h <host> -p <port> -a <password> -n <db_index>
```

| 옵션 | 의미 | 기본값 |
|:---|:---|:---|
| `-h` | 호스트 IP | `127.0.0.1` |
| `-p` | 포트 | `6379` |
| `-a` | 패스워드 | 없음 |
| `-n` | DB 인덱스 (0~15) | `0` |
| `--tls` | TLS 연결 | off |

### 3-1. 대화형 모드 vs 커맨드 모드

```bash
# 대화형: 연결 유지하며 여러 커맨드 실행
$ redis-cli
127.0.0.1:6379> SET name "Alice"
OK
127.0.0.1:6379> GET name
"Alice"
127.0.0.1:6379> EXIT

# 커맨드 모드: 한 번 실행하고 종료 — 스크립트·헬스체크에 적합
$ redis-cli PING
PONG
$ redis-cli SET counter 10
OK
$ redis-cli GET counter
"10"
```

### 3-2. 운영에서 자주 쓰는 옵션

```bash
# 통계 실시간 모니터링
$ redis-cli --stat
------- data ------ --------------------- load --------------------- - child -
keys       mem      clients blocked requests            connections
1024       4.21M    12      0       1023456 (+0)        1024

# 모든 커맨드 실시간 출력 (운영에서는 위험! 짧게만)
$ redis-cli MONITOR

# 키 패턴 안전하게 스캔 (KEYS * 금지)
$ redis-cli --scan --pattern 'user:*' | head -20

# 레이턴시 측정
$ redis-cli --latency
min: 0, max: 2, avg: 0.15 (1234 samples)

# 큰 키 찾기
$ redis-cli --bigkeys
```

{{< callout type="warning" >}}
`KEYS *`, `FLUSHALL`, `MONITOR`, `DEBUG SLEEP` — 이 네 가지는 운영에서 절대 무심코 치면 안 되는 커맨드다. `KEYS *`는 전체 키스페이스를 풀스캔하면서 **싱글 스레드를 점유**해 모든 클라이언트를 멈춘다. 대신 `SCAN`으로 점진적으로 순회하자.
{{< /callout >}}

---

## 4. 데이터 저장과 조회

레디스는 가장 단순한 **키-값(key-value) 저장소**다. 키는 문자열, 값은 자료 구조(String·Hash·List·Set·Sorted Set·Stream 등)다.

### 4-1. 가장 기본: `SET` / `GET`

```bash
127.0.0.1:6379> SET user:1:name "Alice"
OK
127.0.0.1:6379> GET user:1:name
"Alice"
127.0.0.1:6379> EXISTS user:1:name
(integer) 1
127.0.0.1:6379> DEL user:1:name
(integer) 1
127.0.0.1:6379> GET user:1:name
(nil)
```

### 4-2. TTL — 키에 수명 부여

레디스가 캐시 저장소로 사랑받는 가장 큰 이유. 모든 키에 **만료 시간**을 줄 수 있다.

```bash
# 10초 후 만료
127.0.0.1:6379> SET session:abc "user-1" EX 10
OK
127.0.0.1:6379> TTL session:abc
(integer) 9
# ... 10초 후
127.0.0.1:6379> GET session:abc
(nil)

# 이미 존재하는 키에 TTL만 설정
127.0.0.1:6379> EXPIRE user:1:name 60
(integer) 1

# TTL 제거 (영구 키로 전환)
127.0.0.1:6379> PERSIST user:1:name
(integer) 1
```

| 명령 | 단위 | 용도 |
|:---|:---|:---|
| `EX seconds` | 초 | 일반적인 캐시 TTL |
| `PX milliseconds` | 밀리초 | 정밀한 분산 락 |
| `EXAT timestamp` | 유닉스초 | 특정 시각에 만료 |
| `KEEPTTL` | — | 기존 TTL 유지하며 값만 갱신 |

### 4-3. `SET`의 옵션 — NX, XX, GET

```bash
# NX: 키가 없을 때만 SET (분산 락 핵심)
127.0.0.1:6379> SET lock:order "worker-1" NX EX 30
OK
127.0.0.1:6379> SET lock:order "worker-2" NX EX 30
(nil)   ← 다른 워커는 락 획득 실패

# XX: 키가 있을 때만 SET (기존 값 갱신)
127.0.0.1:6379> SET nonexistent "v" XX
(nil)

# GET: 이전 값을 반환하며 갱신 (원자적 getset)
127.0.0.1:6379> SET counter "1"
OK
127.0.0.1:6379> SET counter "2" GET
"1"
```

### 4-4. 키 네이밍 컨벤션

레디스 키는 사실상 **문자열**이지만, 콜론(`:`)으로 네임스페이스를 나누는 것이 사실상의 표준이다. RedisInsight·Datadog 같은 GUI 도구가 이 컨벤션을 트리로 시각화한다.

```text
{도메인}:{식별자}:{속성}

user:1001:profile
user:1001:cart
order:2024-05-28:9821
session:abc123
ratelimit:ip:192.168.1.10
```

| 권장 | 비권장 |
|:---|:---|
| `user:1001:cart` | `userCart1001` (네임스페이스 없음) |
| `order:2024:9821` | `order_2024_9821` (검색 도구 호환성↓) |
| 짧고 의미 있는 이름 | `u:1:c` (의미 불명) |

{{< callout type="info" >}}
키 이름도 메모리를 차지한다. 천만 개 키에 평균 50바이트짜리 키를 쓰면 **약 500MB**가 키 이름만으로 소모된다. 운영 규모가 커질수록 키를 **읽을 수 있을 만큼만 짧게** 유지하자.
{{< /callout >}}

### 4-5. 다중 DB 인덱스

레디스는 한 인스턴스에 0~15번 DB를 갖는다. `SELECT`로 전환할 수 있다.

```bash
127.0.0.1:6379> SELECT 1
OK
127.0.0.1:6379[1]> SET foo "bar"
OK
127.0.0.1:6379[1]> SELECT 0
OK
127.0.0.1:6379> GET foo
(nil)
```

{{< callout type="warning" >}}
DB 인덱스는 **클러스터 모드에서 사용할 수 없다** (0번만 지원). 또한 같은 인스턴스의 단일 스레드를 공유하기 때문에 "DB 1은 캐시, DB 2는 세션"으로 나눠도 성능 격리 효과가 없다. 환경 분리가 목적이라면 **인스턴스를 따로 띄우는 것**이 옳다.
{{< /callout >}}

---

## 5. 첫 실행 체크리스트

| 단계 | 확인 항목 |
|:---|:---|
| ① OS 튜닝 | `ulimit -n ≥ 65535`, THP=never, `vm.overcommit_memory=1`, `somaxconn ≥ 1024` |
| ② 설정 파일 | `bind`, `protected-mode`, `requirepass`, `dir`, `logfile`, `maxmemory(-policy)` 명시 |
| ③ 보안 | 패스워드 강도, 방화벽으로 6379 차단, 필요 시 TLS |
| ④ 영속화 | RDB · AOF 정책 결정 (운영은 보통 둘 다) |
| ⑤ 모니터링 | `INFO`, `--latency`, `--stat`, slowlog 수집 |
| ⑥ 백업 | RDB 스냅샷의 외부 스토리지 복제 정책 |

---

## 6. 핵심 용어 정리

| 용어 | 설명 |
|:---|:---|
| 파일 디스크립터 | 프로세스가 파일·소켓을 가리키는 정수 핸들. 커넥션 1개 = FD 1개 |
| THP | Transparent Huge Page. 페이지를 2MB 단위로 묶어 TLB 효율을 높이는 커널 기능 — 레디스 fork와 충돌 |
| TLB | Translation Lookaside Buffer. 가상 ↔ 물리 주소 변환 캐시 |
| COW | Copy-On-Write. fork 후 메모리를 즉시 복제하지 않고, 수정될 때만 복사 |
| `vm.overcommit_memory` | 커널의 메모리 초과 할당 정책. 레디스는 `1` 권장 |
| `somaxconn` | accept 완료 대기 큐 최대 크기 |
| `tcp-backlog` | 레디스가 사용할 TCP 백로그 큐 크기 |
| `protected-mode` | bind·requirepass 미설정 시 외부 접근 차단하는 안전장치 |
| `requirepass` / `masterauth` | 클라이언트·복제 마스터 인증용 패스워드 |
| TTL | Time To Live. 키의 잔여 수명(초/밀리초) |
| `SET NX` | 키가 없을 때만 저장 — 분산 락의 기본 빌딩블록 |
