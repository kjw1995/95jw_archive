---
title: "01. 인터넷 네트워크"
weight: 1
---

## 1. 인터넷 통신

인터넷은 수많은 중간 노드(라우터)를 거쳐 데이터를 전달하는 **패킷 교환 망**이다. 통신의 기본 모델은 **클라이언트-서버**이며, 한쪽이 요청(Request)하면 다른 쪽이 응답(Response)한다.

```text
┌────────┐   ┌────┐  ┌────┐   ┌────────┐
│ Client │──→│ R1 │→ │ R2 │──→│ Server │
└────────┘   └────┘  └────┘   └────────┘
              (수많은 중간 노드 = 라우터)
```

- 노드마다 라우팅 테이블을 보고 다음 홉(next hop)을 결정한다
- 경로가 고정되지 않으므로 패킷마다 다른 경로를 탈 수 있다

## 2. IP (Internet Protocol)

IP는 호스트에 주소를 부여하고, **패킷 단위**로 데이터를 목적지까지 전달하는 네트워크 계층 프로토콜이다.

### IP 패킷 구조

```text
┌──────────────────────┐
│  출발지 IP │ 목적지 IP│
├──────────────────────┤
│       데이터         │
└──────────────────────┘
```

### IP의 한계

| 한계 | 설명 |
|:---|:---|
| 비연결성 | 대상이 죽어도 패킷 전송 |
| 비신뢰성 | 손실·순서 바뀜·중복 가능 |
| 포트 부재 | 한 호스트의 여러 앱을 구분 못 함 |

이 한계를 보완하기 위해 전송 계층의 **TCP / UDP**가 존재한다.

### IPv4 vs IPv6

| 구분 | IPv4 | IPv6 |
|:---|:---|:---|
| 주소 길이 | 32비트 (약 43억) | 128비트 |
| 표기 | `192.168.0.1` | `2001:db8::1` |
| 주소 고갈 | 발생 | 해소 |
| 헤더 | 가변 (20~60B) | 고정 40B |
| 보안 | 선택 (IPsec) | 기본 지원 |

### 사설 IP와 NAT

공인 IP 부족 문제를 해결하기 위해 내부망에서는 **사설 IP**를 쓰고, 외부로 나갈 때만 NAT(Network Address Translation)로 변환한다.

| 대역 | 범위 |
|:---|:---|
| 10.0.0.0/8 | 10.0.0.0 ~ 10.255.255.255 |
| 172.16.0.0/12 | 172.16.0.0 ~ 172.31.255.255 |
| 192.168.0.0/16 | 192.168.0.0 ~ 192.168.255.255 |

{{< callout type="info" >}}
공유기 뒷면에서 본 `192.168.0.1` 같은 주소가 바로 사설 IP다. 외부에서 직접 접근할 수 없어 포트 포워딩이나 VPN이 필요하다.
{{< /callout >}}

## 3. TCP (Transmission Control Protocol)

TCP는 IP의 한계를 보완하는 **연결 지향·신뢰성** 프로토콜이다.

### TCP/IP 패킷

```text
┌──────────────────────────┐
│ IP Header                │
│  src IP / dst IP         │
├──────────────────────────┤
│ TCP Header               │
│  src port / dst port     │
│  seq / ack / flags       │
├──────────────────────────┤
│  데이터                   │
└──────────────────────────┘
```

### TCP 핵심 특징

| 특징 | 설명 |
|:---|:---|
| 연결 지향 | 3-way handshake로 연결 수립 |
| 신뢰성 | ACK, 재전송, 체크섬 |
| 순서 보장 | 시퀀스 번호로 재조립 |
| 흐름 제어 | 수신 측 버퍼 크기 고려 |

자세한 헤더 구조와 상태 전이는 [네트워크 24. TCP의 구조](../../24-tcp-structure)에서 다룬다.

## 4. UDP (User Datagram Protocol)

UDP는 IP에 **포트와 체크섬**만 추가한 단순한 전송 계층 프로토콜이다. 신뢰성은 없지만 오버헤드가 작고 빠르다.

### TCP vs UDP

| 항목 | TCP | UDP |
|:---|:---|:---|
| 연결 | 연결 지향 | 비연결 |
| 신뢰성 | 보장 | 없음 |
| 순서 | 보장 | 없음 |
| 헤더 | 20B+ | 8B |
| 속도 | 상대적 느림 | 빠름 |
| 용도 | 웹, 이메일, SSH | DNS, 스트리밍, 게임, QUIC |

### UDP 예시 (Java)

```java
DatagramSocket socket = new DatagramSocket();
byte[] data = "hello".getBytes();
InetAddress addr = InetAddress.getByName("localhost");
DatagramPacket pkt = new DatagramPacket(data, data.length, addr, 9876);
socket.send(pkt);   // ACK 확인 없이 반환
socket.close();
```

{{< callout type="info" >}}
HTTP/3가 UDP 기반 QUIC를 쓰는 이유는 TCP의 연결·재전송 오버헤드를 피하고 애플리케이션 계층에서 신뢰성을 직접 구현하기 위해서다.
{{< /callout >}}

## 5. 포트 (Port)

같은 IP 안의 여러 애플리케이션을 구분하기 위해 **16비트(0~65535)** 식별자를 사용한다.

### 포트 범위

| 범위 | 이름 | 용도 |
|:---|:---|:---|
| 0 ~ 1023 | Well-known | 시스템 예약 (HTTP, SSH 등) |
| 1024 ~ 49151 | Registered | 애플리케이션 등록 |
| 49152 ~ 65535 | Dynamic | 클라이언트 임시 할당 |

### 주요 Well-known 포트

| 포트 | 프로토콜 | 용도 |
|:---|:---|:---|
| 20 / 21 | FTP | 파일 전송 (데이터/제어) |
| 22 | SSH | 보안 셸 |
| 23 | Telnet | 원격 접속 (평문) |
| 25 | SMTP | 메일 송신 |
| 53 | DNS | 이름 해석 (UDP/TCP) |
| 80 | HTTP | 웹 |
| 443 | HTTPS | 보안 웹 |
| 3306 | MySQL | 데이터베이스 |
| 6379 | Redis | 캐시 |

## 6. DNS (Domain Name System)

DNS는 사람이 읽는 도메인 이름을 IP 주소로 변환하는 **분산 계층형 디렉터리 서비스**다.

### 조회 흐름

```text
① Browser ─ google.com? ─→ Local DNS
                            │
② Local DNS ── Root ──→ "com은 TLD로"
③ Local DNS ── .com TLD ─→ "google.com은 AuthNS로"
④ Local DNS ─ google AuthNS ─→ 142.250.196.110
                            │
⑤ Browser ←── 142.250.196.110 ──
```

### DNS 계층

| 계층 | 역할 |
|:---|:---|
| Root | `.` 최상위, 13개 루트 |
| TLD | `.com`, `.kr`, `.org` |
| Authoritative | 도메인 보유자가 운영 |
| Local (Resolver) | 클라이언트가 질의, 캐시 |

### DNS 레코드 타입

| 타입 | 의미 |
|:---|:---|
| A | 도메인 → IPv4 |
| AAAA | 도메인 → IPv6 |
| CNAME | 별칭 → 도메인 |
| MX | 메일 서버 |
| NS | 도메인의 네임서버 |
| TXT | 텍스트 (SPF, 인증 등) |

### DNS를 쓰는 이유

1. **기억 용이성**: IP보다 이름이 외우기 쉽다
2. **주소 변경 유연**: IP가 바뀌어도 도메인은 유지
3. **부하 분산**: 하나의 이름에 여러 IP (DNS Round Robin, GSLB)

## 7. URI / URL / URN

URI는 자원을 식별하는 통일된 표기법이고, URL과 URN이 하위 개념이다.

```text
          ┌──── URI ────┐
          │             │
       ┌──┴──┐       ┌──┴──┐
       │ URL │       │ URN │
       │위치 │       │ 이름 │
       └─────┘       └─────┘
```

- **URL**: 자원의 **위치**를 지정 (실무에서 대부분)
- **URN**: 자원에 영구적 **이름** 부여 (거의 사용 안 함)

### URL 구조

```text
https://www.example.com:443/search?q=x&hl=ko#s1
└─┬─┘ └──────┬────────┘└┬┘└──┬──┘└────┬───┘└┬┘
scheme    host        port path    query  frag
```

| 구성 | 설명 |
|:---|:---|
| scheme | 프로토콜 (http, https, ftp, ws) |
| userinfo | `user:pass@` (거의 안 씀) |
| host | 도메인 또는 IP |
| port | 생략 시 스킴 기본값 (80/443) |
| path | 계층형 리소스 경로 |
| query | `?key=value&...` |
| fragment | `#앵커` (서버 전송 X) |

{{< callout type="warning" >}}
`fragment`(`#` 뒷부분)는 서버로 전송되지 않고 브라우저가 내부 앵커 이동에만 쓴다. SPA에서 라우팅을 `#`로 구현하던 이유이기도 하다.
{{< /callout >}}

## 8. 브라우저 요청 전체 흐름

사용자가 URL을 입력하고 화면이 그려질 때까지의 단계.

```text
① DNS 조회
   Browser ── google.com? ──→ DNS
   Browser ←── 142.250.x.x ───

② 소켓 연결 (TCP 3-way)
   SYN → SYN+ACK → ACK

③ (HTTPS면) TLS handshake
   ClientHello → ServerHello → ...

④ HTTP 요청 메시지 생성
   GET /search?q=hello HTTP/1.1
   Host: google.com

⑤ TCP 세그먼트·IP 패킷으로 캡슐화 후 전송

⑥ 서버 처리 및 응답
   HTTP/1.1 200 OK
   Content-Type: text/html

⑦ 브라우저 렌더링
   HTML 파싱 → CSSOM/DOM → Layout → Paint
```

### 관련 단계별 지연 요소

| 단계 | 지연 원인 |
|:---|:---|
| DNS | 캐시 미스, 원격 DNS 응답 시간 |
| TCP | RTT × 1.5 (handshake) |
| TLS | RTT × 1~2 (버전에 따라) |
| HTTP | 서버 처리 시간 + 다운로드 |
| 렌더링 | 리소스 블로킹, JS 실행 |

{{< callout type="info" >}}
첫 요청의 대부분은 네트워크 지연이다. **Keep-Alive, HTTP/2, DNS prefetch, CDN**으로 단계별 왕복 횟수를 줄이는 것이 웹 성능 최적화의 핵심이다.
{{< /callout >}}

## 9. 실무 진단 명령어

```bash
# DNS 조회
nslookup google.com
dig google.com +short

# 경로 추적
tracert google.com      # Windows
traceroute google.com   # Linux/Mac

# 연결 상태
netstat -ano | findstr ESTABLISHED   # Windows
ss -tan                              # Linux

# 포트 열림 확인
telnet google.com 443
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| IP | 호스트 주소를 부여하고 패킷 단위로 전송 |
| TCP | 연결 지향·신뢰성, ACK·재전송 |
| UDP | 비연결·단순·빠름, DNS·실시간 |
| Port | 같은 IP 내 프로세스 구분 (16비트) |
| DNS | 이름 → IP 변환, 계층형 분산 시스템 |
| URI | 자원 식별자, URL·URN 포함 |
| NAT | 사설 IP ↔ 공인 IP 변환 |
| 3-way | TCP 연결 수립 절차 |

{{< callout type="info" >}}
**용어 정리**
- **IP**: 호스트 주소 체계와 패킷 전달 규약
- **TCP / UDP**: 전송 계층 프로토콜. 신뢰성 보장(TCP) vs 단순·속도(UDP)
- **Port**: 한 호스트 안의 프로세스 식별자 (16비트)
- **DNS**: 도메인 이름을 IP로 매핑하는 분산 디렉터리
- **URI / URL / URN**: 자원 식별자 / 위치 / 이름
- **NAT**: 사설 IP를 공인 IP로 바꾸는 변환
- **RTT**: 왕복 지연 시간 (Round Trip Time)
- **Well-known Port**: IANA가 예약한 0~1023 포트
{{< /callout >}}
