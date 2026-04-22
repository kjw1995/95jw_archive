---
title: "06. 네트워크의 규칙 - 프로토콜"
weight: 6
---

## 1. 프로토콜이란?

프로토콜은 서로 다른 시스템이 데이터를 주고받기 위해 합의한 규칙이다. 사람들 사이의 언어와 같다. 같은 프로토콜을 쓰는 장비끼리만 의미 있는 통신이 가능하다.

### 프로토콜이 정의하는 것

| 요소 | 설명 | 예 |
|:---|:---|:---|
| 구문 (Syntax) | 데이터 형식·구조 | 헤더 형식, 필드 순서 |
| 의미 (Semantics) | 각 비트·필드의 뜻 | 오류 코드, 제어 정보 |
| 타이밍 (Timing) | 속도·순서 | 언제, 얼마나 보낼지 |

### 일상 비유: 전화 통화

```
1. 전화 걸기       (연결 요청)
2. "여보세요?"     (연결 수락)
3. 자기 소개       (신원 확인)
4. 대화            (데이터 전송)
5. "끊을게요"      (연결 종료)
```

---

## 2. 프로토콜이 필요한 이유

1. **호환성**: 서로 다른 제조사 장비 간 통신
2. **신뢰성**: 손상·유실 탐지
3. **순서 보장**: 올바른 순서로 재조립
4. **오류 처리**: 문제 발생 시 복구 절차
5. **흐름 제어**: 송수신 속도 조절

{{< callout type="info" >}}
프로토콜이 없다면 수신자는 받은 비트열이 어디서부터 어디까지가 무엇을 의미하는지 알 길이 없다. 프로토콜은 **공통 해석 규칙**이다.
{{< /callout >}}

---

## 3. 표준화 기관

프로토콜은 전 세계 기기가 호환되어야 하므로 국제 표준화 기관이 사양을 관리한다.

| 기관 | 정식 명칭 | 역할 |
|:---|:---|:---|
| IETF | Internet Engineering Task Force | 인터넷 표준 (RFC) |
| IEEE | Institute of Electrical and Electronics Engineers | 이더넷, Wi-Fi |
| ISO | International Organization for Standardization | OSI 모델 |
| ITU | International Telecommunication Union | 통신 표준 |
| W3C | World Wide Web Consortium | 웹 표준 (HTML, CSS) |

### RFC (Request for Comments)

IETF가 발행하는 인터넷 표준 문서. 프로토콜 사양을 상세히 정의한다.

| RFC | 프로토콜 |
|:---|:---|
| RFC 791 | IP |
| RFC 793 | TCP |
| RFC 768 | UDP |
| RFC 1035 | DNS |
| RFC 2616 / 9110 | HTTP |
| RFC 5321 | SMTP |

---

## 4. 주요 네트워크 프로토콜

### 계층별 대표 프로토콜

| 계층 | 프로토콜 |
|:---|:---|
| 응용 | HTTP, HTTPS, FTP, SMTP, POP3, IMAP, DNS, SSH |
| 전송 | TCP, UDP |
| 네트워크 | IP, ICMP, ARP |
| 데이터링크 | Ethernet, Wi-Fi (802.11), PPP |
| 물리 | 전기·광 신호 규격 |

### HTTP

웹 페이지를 주고받는 응용 계층 프로토콜. 요청-응답 방식, 무상태(stateless) 특성을 지닌다.

```http
GET /index.html HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0

HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1234

<html>...</html>
```

### TCP vs UDP

| 항목 | TCP | UDP |
|:---|:---|:---|
| 연결 | 연결 지향 | 비연결 |
| 신뢰성 | 보장 | 없음 |
| 순서 | 보장 | 보장 안 함 |
| 속도 | 상대적으로 느림 | 빠름 |
| 용도 | 웹·메일·파일 | 스트리밍·게임·DNS |

### TCP 3-Way Handshake

```
클라이언트          서버
   │  SYN          │
   ├──────────────▶│
   │  SYN + ACK    │
   ◀──────────────┤
   │  ACK          │
   ├──────────────▶│
   │ 연결 수립      │
```

### IP, ICMP, ARP

| 프로토콜 | 역할 |
|:---|:---|
| IP | 패킷을 목적지 IP로 전달 |
| ICMP | 상태 진단·오류 보고 (ping) |
| ARP | IP → MAC 변환 |

---

## 5. 프로토콜 스택과 캡슐화

여러 프로토콜이 계층적으로 쌓여 협력한다. 송신측은 위에서 아래로 헤더를 추가하고, 수신측은 아래에서 위로 헤더를 벗긴다.

```
응용    [         데이터         ]
         ▼
전송    [TCP][    데이터         ]
         ▼
네트워크 [IP][TCP][    데이터     ]
         ▼
링크    [ETH][IP][TCP][데이터][FCS]
         ▼
물리    101010101010...  (비트)
```

### 웹 요청 프로토콜 흐름

```
1. DNS    www.example.com → IP 조회
2. TCP    3-Way Handshake
3. HTTP   GET / 요청 전송
4. IP     패킷에 IP 추가
5. ETH    프레임으로 MAC 추가, 전송
```

---

## 6. 포트 번호

전송 계층은 IP 주소 위에서 **포트 번호**로 애플리케이션을 구분한다.

### 잘 알려진 포트 (0~1023)

| 포트 | 프로토콜 |
|:---|:---|
| 20, 21 | FTP |
| 22 | SSH |
| 25 / 587 | SMTP |
| 53 | DNS |
| 80 | HTTP |
| 110 | POP3 |
| 143 | IMAP |
| 443 | HTTPS |
| 3306 | MySQL |
| 3389 | RDP |

### IP 프로토콜 번호

| 번호 | 프로토콜 |
|:---|:---|
| 1 | ICMP |
| 6 | TCP |
| 17 | UDP |
| 50 | ESP (IPsec) |

---

## 7. 분석 도구

### 패킷 분석

| 도구 | 특징 |
|:---|:---|
| Wireshark | GUI, 모든 계층 상세 분석 |
| tcpdump | CLI, 서버 환경 |

### 진단 명령어

```bash
netstat -an           # 연결 상태
ss -tan               # Linux (최신)
tracert example.com   # Windows 경로 추적
traceroute example.com
nslookup example.com
ping example.com
arp -a                # ARP 테이블
```

---

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 프로토콜 | 통신 규칙·약속 |
| 구문/의미/타이밍 | 프로토콜 3요소 |
| RFC | IETF 표준 문서 |
| TCP | 연결 지향·신뢰성 |
| UDP | 비연결·빠름 |
| 프로토콜 스택 | 계층화된 프로토콜 집합 |

{{< callout type="info" >}}
**프로토콜의 핵심**
프로토콜은 서로 다른 시스템이 통신하기 위한 공통 언어다. 한국인과 미국인이 영어로 소통하듯, 서로 다른 제조사의 장비가 TCP/IP라는 공통 언어로 통신한다.
{{< /callout >}}
