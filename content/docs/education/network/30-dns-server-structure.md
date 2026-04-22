---
title: "30. DNS 서버의 구조"
weight: 30
---

## 1. DNS란?

DNS(Domain Name System)는 사람이 기억하기 쉬운 도메인 이름을 컴퓨터가 사용할 수 있는 IP 주소로 변환해 주는 계층적 분산 데이터베이스다. 인터넷의 "전화번호부"라고도 불린다.

- 포트: 53 (UDP 주로 사용, 큰 응답이나 영역 전송은 TCP)
- 핵심 기능: 이름 해석(Name Resolution)

### 이름 해석이 필요한 이유

```
사람:   www.google.com  (기억 쉬움)
컴퓨터: 142.250.185.78  (IP 필요)
          ↑
       DNS가 변환
```

---

## 2. 도메인 이름 구조

### FQDN

FQDN(Fully Qualified Domain Name)은 호스트 이름과 도메인 이름을 모두 포함한 완전한 이름이다.

```
www.example.com.
└┬┘ └──┬──┘ └┬┘ │
 │    │     │  └─ 루트 (.)
 │    │     └─── TLD
 │    └───────── 2단계 도메인
 └────────────── 호스트
```

### 계층 구조

```
          루트 (.)
            │
    ┌───────┼───────┐
    │       │       │
  .com    .org    .kr
    │               │
  example           co
    │               │
   www           example
                    │
                   www
```

### TLD 분류

| 분류 | 예시 |
|:---|:---|
| gTLD (일반) | .com, .org, .net, .edu, .gov |
| ccTLD (국가) | .kr, .us, .jp, .cn, .uk |
| new gTLD | .app, .dev, .cloud, .ai |
| 한국 2단계 | .co.kr, .or.kr, .go.kr, .ac.kr |

---

## 3. DNS 서버의 종류

DNS는 역할에 따라 여러 종류의 서버가 분산 협력한다.

| 유형 | 역할 |
|:---|:---|
| 로컬 DNS (Recursive Resolver) | 클라이언트 질의를 받아 재귀적으로 해석, 캐싱 |
| 루트 DNS | 최상위. TLD 서버의 위치를 알려줌 |
| TLD DNS | .com, .kr 같은 최상위 도메인 관리 |
| 권한 있는 DNS (Authoritative) | 특정 도메인의 실제 레코드를 보유 |

대표적인 공용 Recursive Resolver: `8.8.8.8`(Google), `1.1.1.1`(Cloudflare), `9.9.9.9`(Quad9).

---

## 4. 질의 방식

### 재귀 질의(Recursive)와 반복 질의(Iterative)

```
[클라이언트] ──재귀──▶ [로컬 DNS]
                          │
                  ┌───반복──┼───반복──┐
                  ▼        ▼        ▼
             [루트] → [TLD] → [Authoritative]
                          │
[클라이언트] ◀─── 결과 ───┘
```

| 방식 | 주체 | 특징 |
|:---|:---|:---|
| 재귀 질의 | 클라이언트 → 로컬 DNS | "완성된 답을 가져와 줘" |
| 반복 질의 | 로컬 DNS → 상위 DNS | "다음에 물어볼 서버를 알려줘" |

일반적으로 클라이언트는 재귀 질의만 수행하고, 로컬 DNS가 반복 질의로 루트 → TLD → Authoritative를 거쳐 결과를 찾는다.

### 전체 해석 단계

```
1) 클라이언트: www.example.com?
      ↓
2) 로컬 DNS: 캐시 확인, 없으면 ↓
      ↓
3) 루트 DNS: ".com TLD는 어디?"
      ↓
4) .com TLD: "example.com은 어디?"
      ↓
5) example.com Authoritative:
   "www → 93.184.216.34"
      ↓
6) 로컬 DNS: 결과 캐싱 후 반환
      ↓
7) 클라이언트: IP 획득
```

---

## 5. DNS 레코드 타입

| 레코드 | 설명 | 예시 |
|:---|:---|:---|
| A | 도메인 → IPv4 | `example.com. A 93.184.216.34` |
| AAAA | 도메인 → IPv6 | `example.com. AAAA 2606:2800:...` |
| CNAME | 별칭 (Canonical Name) | `www → example.com` |
| MX | 메일 서버 (우선순위 포함) | `example.com. MX 10 mail1.example.com.` |
| NS | 권한 있는 네임서버 | `example.com. NS ns1.example.com.` |
| TXT | 자유 텍스트 (SPF, DKIM 등) | `"v=spf1 ..."` |
| PTR | IP → 도메인 (역방향) | `... PTR example.com.` |
| SOA | 영역 관리 정보 | 시리얼, 리프레시, TTL |

### 레코드 형식

```
도메인이름        TTL  클래스 타입  값
example.com.    3600  IN     A    93.184.216.34
```

---

## 6. DNS 캐시와 TTL

{{< callout type="info" >}}
TTL(Time To Live)은 DNS 응답이 캐시에 유지되는 시간(초)이다. TTL이 길면 캐시 적중률이 높아 응답이 빠르지만, 레코드를 변경해도 전 세계에 반영되기까지 시간이 걸린다. 서버 이전이나 IP 변경이 예정되어 있다면 미리 TTL을 짧게(예: 60~300초) 낮춰 두고 작업 후 다시 늘리는 방식을 쓴다.
{{< /callout >}}

### 캐시 계층

| 위치 | 특징 | 응답 속도 |
|:---|:---|:---|
| 브라우저 캐시 | 앱 내부, TTL 짧음 | 1~2ms |
| OS DNS 캐시 | systemd-resolved, nscd 등 | 5~10ms |
| 로컬 DNS 서버 캐시 | ISP/공용 DNS | 20~50ms |

### 캐시 관리

```bash
# Windows
ipconfig /displaydns
ipconfig /flushdns

# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux (systemd-resolved)
sudo resolvectl flush-caches
```

---

## 7. 실무 도구

### 조회 명령

```bash
# nslookup
nslookup www.google.com
nslookup -type=mx google.com

# dig (Linux/macOS)
dig www.google.com +short
dig google.com MX
dig @8.8.8.8 www.google.com
dig www.google.com +trace     # 루트부터 추적

# host
host www.google.com
host -t NS example.com
```

### 공용 DNS 서버

| 제공자 | IPv4 |
|:---|:---|
| Google | 8.8.8.8, 8.8.4.4 |
| Cloudflare | 1.1.1.1, 1.0.0.1 |
| Quad9 | 9.9.9.9 |
| OpenDNS | 208.67.222.222 |

---

## 핵심 정리

| 항목 | 내용 |
|:---|:---|
| 역할 | 도메인 ↔ IP 변환 |
| 전송 계층 | 주로 UDP 53, 큰 응답은 TCP |
| 서버 종류 | Local → Root → TLD → Authoritative |
| 질의 방식 | 클라이언트는 재귀, DNS 간은 반복 |
| 성능 향상 | 계층적 캐시와 TTL |

{{< callout type="info" >}}
**용어 정리**
- **FQDN**: 호스트와 도메인을 모두 포함한 완전한 도메인 이름
- **Authoritative DNS**: 특정 도메인의 실제 레코드를 관리하는 권한 있는 서버
- **Recursive Resolver**: 클라이언트 질의를 받아 대신 해석해 주는 DNS 서버
- **TTL**: 레코드가 캐시에 유지되는 시간(초)
{{< /callout >}}
