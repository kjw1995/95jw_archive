---
title: "02. HTTP 기본"
weight: 2
---

## 1. HTTP의 개념

**HTTP (HyperText Transfer Protocol)** 는 웹에서 HTML, JSON, 이미지, 파일 등 거의 모든 형태의 데이터를 주고받는 애플리케이션 계층 프로토콜이다. 브라우저 ↔ 서버뿐 아니라 서버 ↔ 서버, 모바일 앱 ↔ API까지 대부분의 통신이 HTTP 위에서 동작한다.

## 2. HTTP 버전 역사

| 버전 | 연도 | 특징 | 하부 프로토콜 |
|:---|:---|:---|:---|
| HTTP/0.9 | 1991 | GET만 지원, 헤더 없음 | TCP |
| HTTP/1.0 | 1996 | 헤더, POST/HEAD 추가 | TCP |
| HTTP/1.1 | 1997 | Keep-Alive, 파이프라이닝 | TCP |
| HTTP/2 | 2015 | 멀티플렉싱, 헤더 압축 | TCP |
| HTTP/3 | 2022 | 0-RTT, 스트림 독립 | UDP (QUIC) |

실무에서는 HTTP/1.1과 HTTP/2가 가장 널리 쓰이고, 최신 브라우저와 CDN은 HTTP/3도 지원한다.

## 3. 핵심 특징

### 클라이언트-서버 구조

```text
┌────────┐   Request    ┌────────┐
│ Client │ ───────────→ │ Server │
│        │ ←─────────── │        │
└────────┘   Response   └────────┘
```

역할이 분리되어 있어 각자 독립적으로 발전할 수 있다. 서버는 데이터와 비즈니스 로직에 집중하고, 클라이언트는 UI/UX에 집중한다.

### 무상태 (Stateless)

서버가 클라이언트의 상태를 저장하지 않는다. 모든 요청은 그 자체로 완결되어야 한다.

```text
[Stateful]                [Stateless]
A서버: "뭘 시켰죠?"       A서버: "아메리카노"
필요 → A서버로 고정        요청에 모든 정보
       (확장 제약)              (확장 자유)
```

| 관점 | Stateful | Stateless |
|:---|:---|:---|
| 확장 | 어렵다 (세션 공유) | 쉽다 (아무 서버로 분산) |
| 장애 복구 | 상태 유실 위험 | 무관 |
| 요청 크기 | 작음 | 큼 (매번 정보 포함) |

{{< callout type="info" >}}
로그인 같은 상태가 꼭 필요하면 쿠키·세션·토큰으로 **클라이언트가 상태를 들고 다니도록** 한다. 서버는 여전히 무상태를 유지한다.
{{< /callout >}}

### 비연결성과 지속 연결

HTTP/1.0은 요청·응답 후 TCP 연결을 끊었다. 리소스마다 새로운 3-way handshake가 필요해 비효율적이었다.

```text
[HTTP/1.0 비연결]
연결 → 요청 → 응답 → 종료    (index.html)
연결 → 요청 → 응답 → 종료    (style.css)
연결 → 요청 → 응답 → 종료    (image.png)

[HTTP/1.1 Keep-Alive]
연결 ─┬─ 요청 → 응답 (html)
      ├─ 요청 → 응답 (css)
      └─ 요청 → 응답 (png)  → 종료
```

```http
GET /index.html HTTP/1.1
Host: example.com
Connection: keep-alive
```

### HOL Blocking과 HTTP/2 멀티플렉싱

HTTP/1.1 파이프라이닝은 같은 연결에서 순차 전송만 허용해 **앞 요청이 느리면 뒤 요청이 막힌다**(Head-of-Line Blocking). HTTP/2는 하나의 TCP 연결 위에서 **여러 스트림을 병렬로** 주고받는다.

```text
[HTTP/1.1]            [HTTP/2]
req1 ─── res1         ┌─ stream1 (req/res)
req2 ─── res2         ├─ stream2 (req/res)
req3 ─── res3         └─ stream3 (req/res)
(순차, HOL blocking)   (병렬, 프레임 인터리빙)
```

## 4. HTTP 메시지 구조

모든 HTTP 메시지는 **시작 라인 → 헤더 → 빈 줄(CRLF) → 본문** 순서로 구성된다.

```text
┌─────────────────────┐
│ Start-line          │
├─────────────────────┤
│ Header-name: value  │
│ Header-name: value  │
├─────────────────────┤
│  (CRLF, 빈 줄)       │
├─────────────────────┤
│  Message Body        │
└─────────────────────┘
```

### 요청 메시지

```http
GET /search?q=hello HTTP/1.1
Host: www.google.com
User-Agent: Mozilla/5.0
Accept: text/html

```

**요청 라인**: `[메서드] [경로+쿼리] [버전]`

| 구성 | 설명 | 예시 |
|:---|:---|:---|
| 메서드 | 수행할 동작 | GET, POST |
| 요청 대상 | 경로와 쿼리 | `/search?q=hello` |
| 버전 | HTTP 버전 | HTTP/1.1 |

### 응답 메시지

```http
HTTP/1.1 200 OK
Content-Type: text/html;charset=UTF-8
Content-Length: 3423

<html>...</html>
```

**상태 라인**: `[버전] [상태코드] [이유문구]`

| 구성 | 설명 | 예시 |
|:---|:---|:---|
| 버전 | HTTP 버전 | HTTP/1.1 |
| 상태 코드 | 처리 결과 | 200, 404 |
| 이유 문구 | 설명 | OK, Not Found |

### 본문 (Body)

본문은 요청·응답 모두 가질 수 있고, 실제 표현 데이터가 담긴다. 타입과 길이는 `Content-Type`, `Content-Length` 또는 `Transfer-Encoding: chunked`로 식별한다.

## 5. HTTP 헤더 개요

```text
field-name: field-value
```

- 필드명은 **대소문자 구분 없음**
- 값 앞뒤 공백은 무시
- 표준에 없어도 커스텀 헤더 추가 가능 (`X-Request-Id` 등)

자세한 분류와 캐시 관련 헤더는 [05. HTTP 헤더와 캐시](05-http-headers)에서 다룬다.

### 자주 등장하는 헤더

| 헤더 | 방향 | 용도 |
|:---|:---|:---|
| Host | 요청 | 가상 호스팅에서 필수 |
| User-Agent | 요청 | 클라이언트 정보 |
| Accept | 요청 | 원하는 표현 타입 |
| Authorization | 요청 | 인증 자격 증명 |
| Content-Type | 양방향 | 본문 미디어 타입 |
| Content-Length | 양방향 | 본문 바이트 수 |
| Cache-Control | 양방향 | 캐시 동작 지시 |
| Set-Cookie | 응답 | 쿠키 저장 지시 |

## 6. HTTP 통신 예시

### Spring Boot 컨트롤러

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User created = userService.save(user);
        return ResponseEntity
            .created(URI.create("/api/users/" + created.getId()))
            .body(created);
    }
}
```

### 요청

```http
GET /api/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

```

### 응답

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 82

{"id":123,"name":"홍길동","email":"hong@example.com"}
```

## 7. HTTP/2 개선

| 기능 | 설명 |
|:---|:---|
| 바이너리 프레이밍 | 텍스트 → 바이너리, 파싱 안정성 |
| 멀티플렉싱 | 한 연결 안에서 요청·응답 병렬 |
| 헤더 압축 (HPACK) | 반복 헤더를 테이블로 참조 |
| 스트림 우선순위 | 중요한 리소스 먼저 |
| 서버 푸시 | 요청 없이 미리 전송 (현재 비권장) |

### HTTP/2 프레임 구조

```text
┌─────────────────────────┐
│ Length (24)             │
├──┬──┬───────────────────┤
│Type│Flg│ Stream ID (31)  │
├──┴──┴───────────────────┤
│       Frame Payload     │
└─────────────────────────┘
```

여러 스트림의 프레임을 같은 연결에 섞어 보내므로(**인터리빙**), 느린 응답이 다른 응답을 막지 않는다.

## 8. HTTP/3와 QUIC

HTTP/3는 TCP 대신 **UDP 기반 QUIC**을 사용한다. TCP의 연결 수립 지연과 패킷 손실 시의 HOL Blocking을 피하기 위함이다.

| 항목 | HTTP/2 (TCP) | HTTP/3 (QUIC/UDP) |
|:---|:---|:---|
| 연결 수립 | TCP + TLS (2 RTT) | QUIC에 TLS 내장 (1 RTT, 재접속 0-RTT) |
| HOL Blocking | TCP 레이어에서 발생 | 스트림별 독립 |
| 이동성 | IP 바뀌면 재연결 | 연결 ID로 전환 가능 |
| 배포 | 방화벽 친화적 | UDP 차단 환경 주의 |

```text
[HTTP/2]
TCP SYN/ACK → TLS Hello → HTTP 요청
  1 RTT         1~2 RTT       1 RTT

[HTTP/3]
QUIC + TLS 동시 → HTTP 요청
      1 RTT          바로
(재접속 0-RTT 가능)
```

{{< callout type="warning" >}}
모바일처럼 Wi-Fi ↔ LTE가 자주 바뀌는 환경에서 HTTP/3의 **연결 이동(Connection Migration)** 이득이 크다. 반면 사내 방화벽이 UDP를 막는 경우 fallback 경로를 준비해야 한다.
{{< /callout >}}

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| HTTP | 웹의 요청·응답 규약, 모든 포맷 전송 |
| Stateless | 서버가 상태 보관 X, 확장 용이 |
| Persistent Connection | Keep-Alive로 TCP 재사용 |
| 시작 라인 | 요청은 메서드·경로·버전, 응답은 버전·코드·이유 |
| 헤더 | 부가 정보, 대소문자 구분 없음 |
| 본문 | 표현 데이터, Content-Type으로 식별 |
| 멀티플렉싱 | 한 연결에서 요청·응답 병렬 (HTTP/2+) |
| QUIC | UDP 기반, HTTP/3의 전송 계층 |

{{< callout type="info" >}}
**용어 정리**
- **HTTP**: 웹의 애플리케이션 계층 프로토콜
- **Stateless**: 서버가 이전 요청의 상태를 저장하지 않는 특성
- **Keep-Alive**: 요청·응답 후에도 TCP 연결을 유지하는 방식
- **Request / Response**: 클라이언트 요청 메시지 / 서버 응답 메시지
- **Start-line**: 요청 라인 또는 상태 라인 (메시지 첫 줄)
- **Header / Body**: 부가 정보 / 표현 데이터
- **Multiplexing**: 하나의 연결로 여러 요청·응답을 병렬 처리
- **HPACK**: HTTP/2의 헤더 압축 알고리즘
- **QUIC**: UDP 기반 전송 계층, HTTP/3의 하부
- **HOL Blocking**: 앞 요청이 뒤 요청을 막는 현상
{{< /callout >}}
