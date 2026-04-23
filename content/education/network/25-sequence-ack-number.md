---
title: "25. 일련번호와 확인 응답 번호의 구조"
weight: 25
---

## 1. 두 번호의 역할

TCP 연결이 수립되면 실제 데이터 전송은 **일련번호(Sequence Number)** 와 **확인 응답 번호(Acknowledgment Number)** 를 통해 이루어진다.

| 번호 | 주체 | 의미 |
|:---|:---|:---|
| Sequence Number | 송신 측 | 보낸 데이터의 첫 바이트 번호 |
| Acknowledgment Number | 수신 측 | 다음에 받기를 기대하는 바이트 번호 |

TCP는 대용량 데이터를 바이트 단위로 쪼개 전송한다. 이 과정에서 패킷의 순서가 뒤바뀌거나 손실될 수 있으므로, 두 번호로 순서 보장·손실 감지·재전송을 구현한다.

```text
TCP 헤더
┌─────────────────────────────┐
│ Sequence Number    (32비트) │
├─────────────────────────────┤
│ Ack Number         (32비트) │
└─────────────────────────────┘
```

## 2. 일련번호 (Sequence Number)

일련번호는 해당 세그먼트의 **첫 바이트 번호**다.

### ISN (Initial Sequence Number)

연결이 수립될 때 송수신 각자가 무작위로 선택하는 초기 값이다. 0부터 시작하지 않는 이유는 보안(세션 하이재킹 방지)과 지연 패킷 구분이다.

### 증가 규칙

```text
다음 Seq = 현재 Seq + 전송한 바이트 수
```

| 규칙 | 비고 |
|:---|:---|
| 데이터 N바이트 전송 | Seq가 N만큼 증가 |
| SYN 패킷 | 데이터가 없어도 Seq 1 소비 |
| FIN 패킷 | 데이터가 없어도 Seq 1 소비 |
| 순수 ACK 패킷 | Seq 소비 없음 |

### 예시

ISN=1000에서 1,000바이트씩 세 번 전송하면 다음과 같다.

| 전송 | Seq | Len | 바이트 범위 |
|:---|:---|:---|:---|
| 1회 | 1000 | 1000 | 1000 ~ 1999 |
| 2회 | 2000 | 1000 | 2000 ~ 2999 |
| 3회 | 3000 | 1000 | 3000 ~ 3999 |

## 3. 확인 응답 번호 (Acknowledgment Number)

확인 응답 번호는 수신 측이 "다음에 기대하는 바이트 번호"를 돌려주는 값이다. 즉 "여기까지 잘 받았으니, 이 번호부터 보내 달라"는 신호다.

### 계산 공식

```text
ACK Number = 받은 Seq + 받은 데이터 크기
```

### 누적 ACK

TCP는 누적 방식을 쓴다. `ACK=N`은 "N-1번 바이트까지 모두 수신 완료"를 의미한다. 따라서 모든 세그먼트마다 개별 ACK를 보낼 필요가 없어 효율적이다.

```text
송신 ─ Seq=1000, Len=100 ─→ 수신 (OK)
송신 ─ Seq=1100, Len=100 ─→ 수신 (OK)
송신 ─ Seq=1200, Len=100 ─→ 수신 (OK)
송신 ←─ ACK=1300 ──────── 수신
       "1300번 바이트부터 보내줘"
       (1000~1299까지 모두 받음을 의미)
```

## 4. 데이터 전송 전체 흐름

ISN: 클라이언트 100, 서버 300.

| 단계 | 방향 | 내용 | Seq/Ack 계산 |
|:---|:---|:---|:---|
| 1 | C → S | SYN | Seq=100 (SYN은 1 소비) |
| 2 | S → C | SYN+ACK | Seq=300, Ack=101 |
| 3 | C → S | ACK | Seq=101, Ack=301 |
| 4 | C → S | Data 200B | Seq=101, 다음 Seq=301 |
| 5 | S → C | ACK | Ack=301 |
| 6 | S → C | Data 1000B | Seq=301, 다음 Seq=1301 |
| 7 | C → S | ACK | Ack=1301 |

## 5. 재전송 제어

### 필요한 상황

- **패킷 손실**: 라우터 큐 오버플로우, 링크 오류 등
- **패킷 손상**: 체크섬 불일치로 수신측이 폐기
- **ACK 손실**: 수신은 정상이었으나 ACK가 유실

### 타임아웃 재전송 (RTO)

전송 후 타이머를 시작하고, 타임아웃 내 ACK가 없으면 재전송한다. RTO는 RTT(Round Trip Time)를 측정해 동적으로 계산한다.

```text
RTO = SRTT + 4 × RTTVAR

SRTT   : 평활화된 평균 RTT
RTTVAR : RTT 편차
```

재전송이 연속 실패하면 RTO를 2배씩 늘려가는 지수 백오프(exponential backoff)를 적용한다.

### 빠른 재전송 (Fast Retransmit)

타임아웃을 기다리지 않고 **중복 ACK 3개**가 수신되면 즉시 재전송한다.

```text
Seq=1000 ─→ OK (ACK=1100)
Seq=1100 ─→ 손실
Seq=1200 ─→ OK (ACK=1100 중복 1)
Seq=1300 ─→ OK (ACK=1100 중복 2)
Seq=1400 ─→ OK (ACK=1100 중복 3)
              ↓ Fast Retransmit
Seq=1100 ─→ 재전송 (ACK=1500으로 한꺼번에 확인)
```

중복 ACK 3개를 기준으로 하는 이유는 1~2개는 단순 순서 뒤바뀜일 가능성이 높지만, 3개가 쌓이면 손실이 거의 확실하기 때문이다.

## 6. 윈도우 크기와 흐름 제어

### 윈도우 크기

수신 측이 "한 번에 받을 수 있는 바이트 수"를 광고하는 16비트 필드다. 최대 65,535바이트며, Window Scaling 옵션으로 확장할 수 있다.

### 버퍼와 오버플로우

수신측은 받은 세그먼트를 애플리케이션이 읽을 때까지 버퍼에 저장한다. 버퍼가 차면 새 데이터를 받지 못하므로(오버플로우), 윈도우 크기를 낮춰 전송 속도를 조절한다.

```text
버퍼 4096B
 ▓▓▓▓▓▓▓▓░░░░░░░░  사용 2000B → Window=2096
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  사용 4000B → Window=96
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  가득 참   → Window=0 → 전송 중단
```

### 슬라이딩 윈도우

ACK를 기다리지 않고 윈도우 크기만큼 연속 전송하는 기법이다. ACK가 수신될 때마다 윈도우가 오른쪽으로 "슬라이딩"하며 새로운 세그먼트 전송이 가능해진다.

```text
초기 (윈도우=4)
[1][2][3][4][5][6][7][8]
 ├── 전송 가능 ──┤

1~2 전송 후
[●][●][3][4][5][6][7][8]
 ACK대기 │전송 가능│

ACK=3 수신 후
[✓][✓][●][●][5][6][7][8]
      ACK대기 │전송 가능│
```

{{< callout type="info" >}}
Stop-and-Wait(전송 → 대기 → 전송)과 비교하면 슬라이딩 윈도우는 파이프라인 효과로 네트워크 활용도가 비약적으로 높다.
{{< /callout >}}

### Window Scaling

16비트로는 최대 64KB까지만 표현 가능하다. 고속·고지연 네트워크에서는 너무 작으므로, 3-way handshake 시 `Window Scale` 옵션으로 Scale Factor를 교환해 `실제 윈도우 = 광고값 × 2^factor`로 확장한다. Factor는 최대 14이므로 최대 약 1GB까지 가능하다.

### BDP와 최적 버퍼 크기

최적 송수신 버퍼 크기는 BDP(Bandwidth-Delay Product)로 계산한다.

```text
BDP = 대역폭(bps) × RTT(s)
```

예시: 1Gbps, RTT=100ms → BDP = 10^9 × 0.1 = 10^8 bit = 12.5MB. 버퍼가 BDP 이하면 대역폭을 다 쓰지 못한다.

## 7. 실무 확인

### Wireshark 필터

```text
tcp.seq == 1000
tcp.ack == 2000
tcp.analysis.retransmission
tcp.analysis.duplicate_ack
tcp.analysis.out_of_order
tcp.window_size == 0
tcp.analysis.window_update
```

### 리눅스 튜닝 파라미터

```bash
sysctl net.core.rmem_max
sysctl net.core.wmem_max
sysctl net.ipv4.tcp_rmem
sysctl net.ipv4.tcp_wmem
sysctl net.ipv4.tcp_window_scaling

# 1Gbps 고지연 환경 예시
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"
```

### ss 명령어로 상태 확인

```bash
ss -ti
# wscale:7,7  cwnd:10  rtt:15.2/7.6  rto:204
```

| 지표 | 의미 |
|:---|:---|
| wscale | 송신·수신 Window Scale Factor |
| cwnd | 혼잡 윈도우 |
| rtt | 평균 RTT (ms) |
| rto | 현재 RTO (ms) |

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Sequence Number | 전송한 데이터의 첫 바이트 번호 |
| Acknowledgment Number | 다음에 기대하는 바이트 번호 |
| ISN | 초기 순서 번호 (무작위) |
| 누적 ACK | ACK=N은 N-1까지 모두 받음 |
| RTO | 재전송 타임아웃, RTT 기반 |
| Fast Retransmit | 중복 ACK 3개 시 즉시 재전송 |
| 윈도우 크기 | 수신 가능한 바이트 수 |
| 슬라이딩 윈도우 | 연속 전송을 가능하게 하는 윈도우 관리 |
| Window Scaling | 16비트 한계를 넘는 윈도우 확장 옵션 |
| BDP | 대역폭 × RTT, 최적 버퍼 기준 |

{{< callout type="info" >}}
**용어 정리**
- **Sequence Number**: 전송 바이트의 시작 번호 (32비트)
- **Acknowledgment Number**: 다음에 기대하는 바이트 번호
- **ISN**: 초기 순서 번호, 보안상 무작위
- **RTO / RTT**: 재전송 타임아웃 / 왕복 시간
- **Fast Retransmit**: 중복 ACK 기반 즉시 재전송
- **버퍼**: 수신 데이터를 애플리케이션 전달 전까지 저장하는 공간
- **오버플로우**: 버퍼 초과 상태
- **윈도우 크기**: 수신 가능한 바이트 수
- **슬라이딩 윈도우**: 연속 전송을 허용하는 윈도우 관리 기법
- **Window Scaling**: 윈도우 필드 확장 옵션
- **BDP**: Bandwidth-Delay Product
{{< /callout >}}
