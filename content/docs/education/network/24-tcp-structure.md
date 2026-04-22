---
title: "24. TCP의 구조"
weight: 24
---

## 1. TCP의 개념

TCP(Transmission Control Protocol)는 전송 계층의 연결 지향형 프로토콜로, 신뢰성 있는 바이트 스트림 전송을 보장한다.

핵심 특징은 다음과 같다.

- **연결 지향**: 통신 전에 3-way handshake로 연결 수립
- **양방향 (Full-Duplex)**: 한 연결에서 양측이 동시에 송수신 가능
- **바이트 스트림**: 애플리케이션 데이터 경계가 아닌 바이트 단위로 전송
- **신뢰성 보장**: 순서 번호, ACK, 재전송, 체크섬
- **흐름·혼잡 제어**: 수신측 버퍼, 네트워크 상황에 따라 속도 조절

### 세그먼트

TCP 헤더가 붙은 데이터 단위를 세그먼트라 한다.

```text
애플리케이션 데이터
   ↓ TCP 헤더 추가
[TCP 헤더 | 데이터]           ← TCP 세그먼트
   ↓ IP 헤더 추가
[IP 헤더 | TCP 헤더 | 데이터]  ← IP 패킷
```

## 2. TCP 헤더 구조

```text
 0        16        31
 │         │         │
 ├─────────┼─────────┤
 │ src port│ dst port│    4B
 ├─────────┴─────────┤
 │  sequence number  │    4B
 ├───────────────────┤
 │     ack number    │    4B
 ├───┬───┬───────────┤
 │hl │rsv│   flags   │
 ├───┴───┴───────────┤
 │     window size   │    4B (헤더 포함)
 ├─────────┬─────────┤
 │checksum │ urg ptr │    4B
 ├─────────┴─────────┤
 │   options (0~40)  │
 ├───────────────────┤
 │       data        │
 └───────────────────┘
```

### 주요 필드

| 필드 | 크기 | 설명 |
|:---|:---|:---|
| Source / Destination Port | 각 16b | 송수신 애플리케이션 포트 |
| Sequence Number | 32b | 전송 데이터의 첫 바이트 번호 |
| Acknowledgment Number | 32b | 다음에 받기 기대하는 번호 |
| Data Offset | 4b | 헤더 길이 (4B 단위) |
| Flags | 6b | URG, ACK, PSH, RST, SYN, FIN |
| Window | 16b | 수신 가능한 바이트 수 |
| Checksum | 16b | 헤더·데이터 오류 검출 |
| Urgent Pointer | 16b | URG 플래그 유효 시 긴급 데이터 위치 |
| Options | 0~40B | MSS, Window Scale, Timestamp 등 |

## 3. 제어 비트 (Flags)

| 플래그 | 이름 | 의미 |
|:---|:---|:---|
| URG | Urgent | 긴급 데이터 포함 |
| ACK | Acknowledgment | 확인 응답 번호 유효 |
| PSH | Push | 버퍼링 없이 즉시 전달 |
| RST | Reset | 연결 강제 종료 |
| SYN | Synchronize | 연결 수립 요청, 순서 번호 동기화 |
| FIN | Finish | 연결 종료 요청 |

### 주요 조합

| 상황 | 플래그 |
|:---|:---|
| 연결 요청 | SYN |
| 연결 응답 | SYN + ACK |
| 연결 확인 | ACK |
| 데이터 전송 | ACK + PSH |
| 정상 종료 요청 | FIN + ACK |
| 강제 리셋 | RST |

## 4. 3-way Handshake (연결 수립)

```text
 Client                        Server
(CLOSED)                      (LISTEN)
   │                             │
   │── SYN, Seq=1000 ──────────→│
(SYN_SENT)              (SYN_RECEIVED)
   │                             │
   │←── SYN+ACK, Seq=2000 ──────│
   │     Ack=1001               │
   │                             │
   │── ACK, Seq=1001 ──────────→│
   │     Ack=2001               │
(ESTABLISHED)          (ESTABLISHED)
   │                             │
   │════  데이터 교환 가능  ════ │
```

### 왜 3단계인가?

- 양방향 통신을 확인하려면 각 방향의 "연결 요청"과 "수락"이 필요하다.
- 서버의 SYN과 ACK는 하나의 패킷(SYN+ACK)으로 합쳐질 수 있어 총 3단계가 된다.
- 마지막 ACK가 없으면 서버는 클라이언트가 실제로 연결 준비되었는지 알 수 없다.

## 5. 4-way Handshake (연결 해제)

```text
 Client                        Server
(ESTAB.)                      (ESTAB.)
   │── FIN ───────────────────→│
(FIN_WAIT_1)            (CLOSE_WAIT)
   │←── ACK ──────────────────│
(FIN_WAIT_2)                   │
   │        (남은 데이터 송신)  │
   │←── FIN ──────────────────│
(TIME_WAIT)              (LAST_ACK)
   │── ACK ───────────────────→│
   │   (2MSL 대기)             │
(CLOSED)                    (CLOSED)
```

### 왜 4단계인가?

연결은 양방향이므로 각 방향을 따로 닫아야 한다. 서버는 FIN을 받은 즉시 ACK만 돌려주고, 남은 송신 데이터를 마저 보낸 뒤 자신의 FIN을 전송한다. 이 때문에 서버 측의 ACK와 FIN이 분리된다.

### Half-Close

클라이언트가 FIN을 보내고 서버가 ACK만 응답한 상태에서 서버는 아직 데이터를 보낼 수 있다. 이를 반종료 상태라고 한다.

## 6. TCP 상태 전이

```text
          CLOSED
        ┌───┴───┐
     active   passive
        │       │
    SYN_SENT  LISTEN
        │       │
        │    SYN_RECEIVED
        │       │
        └───────┴──→ ESTABLISHED
                        │
              ┌─────────┴─────────┐
          send FIN            recv FIN
              │                   │
        FIN_WAIT_1           CLOSE_WAIT
              │                   │
        FIN_WAIT_2            LAST_ACK
              │                   │
        TIME_WAIT              CLOSED
              │
           CLOSED
```

### 주요 상태 요약

| 상태 | 의미 |
|:---|:---|
| LISTEN | 서버가 연결 대기 |
| SYN_SENT | 클라이언트가 SYN 보낸 후 대기 |
| SYN_RECEIVED | 서버가 SYN 받고 ACK 대기 |
| ESTABLISHED | 연결 완료, 송수신 가능 |
| FIN_WAIT_1/2 | 종료 요청 후 ACK/FIN 대기 |
| CLOSE_WAIT | 종료 요청 수신, 애플리케이션 종료 대기 |
| LAST_ACK | 마지막 ACK 대기 |
| TIME_WAIT | 2MSL 동안 지연 패킷 처리 대기 |

### TIME_WAIT

마지막 ACK 전송 후 2MSL(보통 60~240초) 동안 유지되는 상태다. 두 가지 역할을 한다.

1. **지연 패킷 처리**: 이전 연결의 지연된 패킷이 새 연결에 섞이지 않게 한다.
2. **ACK 재전송 대응**: 상대방이 ACK를 못 받아 FIN을 재전송하면 다시 ACK를 보낼 수 있다.

{{< callout type="warning" >}}
서버를 자주 재시작할 때 "Address already in use" 오류가 나는 원인이 TIME_WAIT다. `SO_REUSEADDR` 소켓 옵션이나 `net.ipv4.tcp_tw_reuse` 커널 파라미터로 완화할 수 있다.
{{< /callout >}}

## 7. 순서 번호와 확인 응답 (재전송 메커니즘)

### 번호 증가 규칙

```text
다음 Seq = 현재 Seq + 전송한 바이트 수
ACK     = 받은 Seq + 받은 바이트 수 (다음 기대 번호)
```

### 정상 흐름

```text
Client ─ Seq=1001, Len=200 ─→ Server
Client ←─── ACK=1201 ──────── Server
Client ─ Seq=1201, Len=300 ─→ Server
Client ←─── ACK=1501 ──────── Server
```

### 손실 감지와 재전송

두 가지 재전송 방식이 있다.

| 방식 | 트리거 | 속도 |
|:---|:---|:---|
| RTO 재전송 | 일정 시간 내 ACK 없음 | 느리지만 확실 |
| Fast Retransmit | 중복 ACK 3개 수신 | 빠름 |

```text
Seq=1001 ─→ OK
Seq=1101 ─→ 손실!
Seq=1201 ─→ OK (순서 어긋남, ACK=1101 재전송)
Seq=1301 ─→ OK (ACK=1101 중복 2)
Seq=1401 ─→ OK (ACK=1101 중복 3 → Fast Retransmit 발동)
Seq=1101 ─→ 재전송
```

상세 내용은 [25. 일련번호와 확인 응답 번호의 구조](25-sequence-ack-number)에서 다룬다.

## 8. 흐름 제어와 윈도우

### 슬라이딩 윈도우

ACK를 기다리지 않고 윈도우 크기만큼 연속 전송하는 기법이다. ACK가 도착할 때마다 윈도우가 오른쪽으로 슬라이딩하며 새로운 전송이 가능해진다.

```text
[✓][✓][●][●][●][●][5][6][7][8]
 ACK됨 │전송됨, 대기│← 전송 가능 →│
        └── 윈도우 크기: 4 ──┘
```

### 윈도우 크기 조절

수신 측은 버퍼 여유에 따라 윈도우 값을 조정한다.

| 상황 | 광고 윈도우 |
|:---|:---|
| 버퍼 여유 많음 | 크게 (빠른 전송) |
| 버퍼 부족 | 작게 |
| 버퍼 가득 | 0 (전송 중단) |

### Zero Window Probe

수신측이 Window=0을 보낸 뒤 Window Update가 손실되면 교착 상태가 될 수 있다. 송신측은 주기적으로 1바이트 Probe를 보내 현재 윈도우 크기를 다시 확인한다.

### Window Scaling

헤더의 윈도우 필드는 16비트(최대 64KB)다. 고속 회선에서는 작기 때문에 옵션으로 Scale Factor를 교환해 `윈도우 × 2^factor`로 확장한다. 최대 1GB까지 늘릴 수 있다.

## 9. 실무 활용

### 연결 상태 확인

```bash
# Windows
netstat -an
netstat -ano | findstr "ESTABLISHED"

# Linux
ss -tan
ss -tanp          # 프로세스 포함
netstat -tnp
```

### Wireshark 필터

```text
tcp.flags.syn == 1
tcp.flags.syn == 1 && tcp.flags.ack == 1
tcp.flags.fin == 1
tcp.flags.reset == 1
tcp.analysis.retransmission
tcp.analysis.duplicate_ack
tcp.port == 443
```

### 자주 보이는 문제와 대응

| 증상 | 원인 | 대응 |
|:---|:---|:---|
| CLOSE_WAIT 누적 | 애플리케이션이 close() 누락 | 소켓 닫기 보장 |
| TIME_WAIT 과다 | 짧은 연결이 많음 | Keep-Alive, SO_REUSEADDR |
| RST 수신 | 포트 닫힘, 방화벽 차단 | 서비스·방화벽 점검 |
| 연결 지연 | DNS, RTT, 재전송 | ping, tracert로 경로 확인 |

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| TCP 세그먼트 | TCP 헤더가 붙은 데이터 단위 |
| Sequence Number | 전송 바이트의 시작 번호 |
| Acknowledgment Number | 다음에 기대하는 번호 |
| SYN / ACK / FIN / RST | 연결 수립·확인·종료·리셋 |
| 3-way / 4-way | 연결 수립(3) / 해제(4) 절차 |
| TIME_WAIT | 2MSL 대기 상태 |
| 윈도우 | 흐름 제어를 위한 수신 가능 크기 |
| 슬라이딩 윈도우 | 연속 전송을 위한 윈도우 관리 |
| Fast Retransmit | 중복 ACK 3회 시 즉시 재전송 |

{{< callout type="info" >}}
**용어 정리**
- **TCP**: 연결 지향, 신뢰성 있는 전송 프로토콜
- **세그먼트 (Segment)**: TCP 헤더가 붙은 데이터 단위
- **순서 번호 / 확인 응답 번호**: 바이트 순서와 수신 확인을 표현하는 32비트 필드
- **제어 비트**: URG, ACK, PSH, RST, SYN, FIN
- **3-way / 4-way Handshake**: 연결 수립 / 해제 절차
- **TIME_WAIT**: 마지막 ACK 후 2MSL 동안 유지되는 상태
- **MSL**: 패킷의 네트워크 최대 생존 시간
- **윈도우 크기**: 수신 가능한 바이트 수
- **슬라이딩 윈도우**: 연속 전송을 허용하는 윈도우 관리 기법
- **Fast Retransmit**: 중복 ACK 3회 기반 재전송
- **ISN**: 초기 순서 번호
{{< /callout >}}
