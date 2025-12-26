---
title: "02. HTTP 기본"
weight: 2
---

## HTTP란?

**HTTP (HyperText Transfer Protocol)**는 HTML, TEXT, IMAGE, 파일, JSON, XML 등 거의 모든 형태의 데이터를 전송하는 인터넷 통신의 핵심 프로토콜입니다.

---

## HTTP 버전 역사

| 버전 | 연도 | 특징 | 기반 프로토콜 |
|------|------|------|--------------|
| HTTP/0.9 | 1991 | GET만 지원, 헤더 없음 | TCP |
| HTTP/1.0 | 1996 | 헤더 도입, POST/HEAD 추가 | TCP |
| **HTTP/1.1** | 1997 | **가장 많이 사용**, 지속 연결, 파이프라이닝 | TCP |
| HTTP/2 | 2015 | 멀티플렉싱, 헤더 압축, 서버 푸시 | TCP |
| HTTP/3 | 진행 중 | QUIC 기반, 연결 설정 최적화 | **UDP** |

---

## HTTP의 핵심 특징

### 1. 클라이언트-서버 구조

```
┌──────────────┐         Request           ┌──────────────┐
│              │ ───────────────────────→ │              │
│   Client     │                          │   Server     │
│   (요청)     │ ←─────────────────────── │   (응답)     │
└──────────────┘         Response          └──────────────┘
```

- 클라이언트가 **요청(Request)**을 보내면 서버가 **응답(Response)**
- 역할 분리로 독립적인 발전 가능

### 2. 무상태 프로토콜 (Stateless)

서버가 클라이언트의 상태를 보존하지 않습니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Stateless vs Stateful                                   │
├───────────────────────────────────────┬─────────────────────────────────────┤
│              Stateful                 │            Stateless                │
├───────────────────────────────────────┼─────────────────────────────────────┤
│  고객: 아메리카노 한 잔 주세요         │  고객: 아메리카노 한 잔, 카드결제요   │
│  점원A: 카드결제? 현금결제?            │  점원A: 네, 5000원입니다              │
│  고객: 카드요                          │                                     │
│  (점원A가 점원B로 변경됨...)           │  (점원A가 점원B로 변경되어도          │
│  점원B: 어떤 음료 말씀이셨죠?          │   모든 정보가 포함되어 있어 OK!)     │
└───────────────────────────────────────┴─────────────────────────────────────┘
```

**장점:**
- **스케일 아웃 용이**: 어떤 서버로 요청해도 동일하게 처리 가능
- **서버 증설 간편**: 상태 공유 불필요

**단점:**
- 클라이언트가 필요한 데이터를 매 요청마다 전송해야 함
- 로그인 등 상태 유지가 필요한 경우 **쿠키와 세션**으로 보완

### 3. 비연결성 (Connectionless)

기본적으로 요청-응답 후 TCP/IP 연결을 끊습니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     비연결 모델 (초기 HTTP)                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────┐                                               ┌────────┐
│ Client │                                               │ Server │
└───┬────┘                                               └───┬────┘
    │                                                        │
    │ ──── TCP 연결 (3-way handshake) ────                  │
    │ ──── HTTP 요청 (index.html) ────→                     │
    │ ←─── HTTP 응답 ─────────────────                      │
    │ ──── TCP 종료 ──────────────────                      │
    │                                                        │
    │ ──── TCP 연결 (3-way handshake) ────                  │
    │ ──── HTTP 요청 (style.css) ────→                      │
    │ ←─── HTTP 응답 ─────────────────                      │
    │ ──── TCP 종료 ──────────────────                      │
    │                                                        │
    │ ──── TCP 연결 (3-way handshake) ────                  │
    │ ──── HTTP 요청 (image.png) ────→                      │
    │ ←─── HTTP 응답 ─────────────────                      │
    │ ──── TCP 종료 ──────────────────                      │
```

**한계:**
- 매 요청마다 TCP 3-way handshake 오버헤드
- 자원(HTML, CSS, JS, 이미지) 다운로드 시 비효율

### 4. HTTP 지속 연결 (Persistent Connections)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        지속 연결 (HTTP/1.1+)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────┐                                               ┌────────┐
│ Client │                                               │ Server │
└───┬────┘                                               └───┬────┘
    │                                                        │
    │ ════ TCP 연결 (3-way handshake) ════                  │
    │                                                        │
    │ ──── HTTP 요청 (index.html) ────→                     │
    │ ←─── HTTP 응답 ─────────────────                      │
    │                                                        │
    │ ──── HTTP 요청 (style.css) ────→                      │
    │ ←─── HTTP 응답 ─────────────────                      │
    │                                                        │
    │ ──── HTTP 요청 (image.png) ────→                      │
    │ ←─── HTTP 응답 ─────────────────                      │
    │                                                        │
    │ ════ TCP 종료 ══════════════════                      │
```

**Connection: keep-alive** 헤더로 연결 유지

```http
GET /index.html HTTP/1.1
Host: www.example.com
Connection: keep-alive
```

---

## HTTP 메시지 구조

HTTP 통신에서 교환되는 데이터 형식입니다.

### 전체 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HTTP 메시지 구조                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Start-line (시작 라인)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Header (헤더)                                                              │
│  field-name: field-value                                                    │
│  field-name: field-value                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  (empty line - CRLF)                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Message Body (본문)                                                        │
│  실제 전송 데이터                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 요청 메시지 (Request)

```http
GET /search?q=hello&hl=ko HTTP/1.1      ← Start-line (request-line)
Host: www.google.com                     ← Header
User-Agent: Mozilla/5.0                  ← Header
Accept: text/html                        ← Header
                                         ← Empty line (CRLF)
                                         ← Body (GET은 보통 없음)
```

**Start-line (Request-line) 구조:**
```
[HTTP 메서드] [요청 대상] [HTTP 버전]
GET /search?q=hello HTTP/1.1
```

| 구성 요소 | 설명 | 예시 |
|-----------|------|------|
| HTTP 메서드 | 수행할 동작 | GET, POST, PUT, DELETE |
| 요청 대상 | 리소스 경로 + 쿼리 | /search?q=hello |
| HTTP 버전 | 사용 버전 | HTTP/1.1 |

### 응답 메시지 (Response)

```http
HTTP/1.1 200 OK                          ← Start-line (status-line)
Content-Type: text/html;charset=UTF-8    ← Header
Content-Length: 3423                     ← Header
Date: Mon, 27 Dec 2024 12:00:00 GMT      ← Header
                                         ← Empty line (CRLF)
<html>                                   ← Body
  <body>...</body>
</html>
```

**Start-line (Status-line) 구조:**
```
[HTTP 버전] [상태 코드] [이유 문구]
HTTP/1.1 200 OK
```

| 구성 요소 | 설명 | 예시 |
|-----------|------|------|
| HTTP 버전 | 사용 버전 | HTTP/1.1 |
| 상태 코드 | 요청 처리 결과 | 200, 404, 500 |
| 이유 문구 | 상태 코드 설명 | OK, Not Found |

---

## HTTP 헤더

HTTP 전송에 필요한 모든 부가 정보를 담습니다.

### 헤더 형식

```
field-name: field-value
```

- field-name은 **대소문자 구분 없음**
- field-value 앞뒤 공백은 무시됨

### 대표적인 헤더

| 헤더 | 용도 | 예시 |
|------|------|------|
| Host | 요청 호스트 | www.example.com |
| Content-Type | 본문 타입 | application/json |
| Content-Length | 본문 길이 | 3423 |
| Accept | 선호 미디어 타입 | text/html |
| Authorization | 인증 정보 | Bearer token |
| Cache-Control | 캐시 지시자 | max-age=3600 |

---

## 실제 HTTP 통신 예제

### Spring Boot Controller

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(user);  // 200 OK + JSON body
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User created = userService.save(user);
        return ResponseEntity
            .created(URI.create("/api/users/" + created.getId()))  // 201 Created
            .body(created);
    }
}
```

### 요청/응답 예시

**요청:**
```http
GET /api/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**응답:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 82

{
  "id": 123,
  "name": "홍길동",
  "email": "hong@example.com"
}
```

---

## HTTP/2와 HTTP/3

### HTTP/2 개선 사항

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HTTP/1.1 vs HTTP/2                                   │
├──────────────────────────────────┬──────────────────────────────────────────┤
│           HTTP/1.1               │              HTTP/2                      │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  요청1 → 응답1                   │     ┌─→ 요청1                            │
│  요청2 → 응답2                   │     │   요청2  ═══(동시)═══              │
│  요청3 → 응답3                   │     └─→ 요청3                            │
│  (순차 처리, HOL Blocking)      │     (멀티플렉싱, 병렬 처리)             │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

| 기능 | 설명 |
|------|------|
| **바이너리 프레이밍** | 텍스트 → 바이너리 전송 |
| **멀티플렉싱** | 하나의 연결로 여러 요청/응답 병렬 처리 |
| **헤더 압축** | HPACK으로 헤더 크기 감소 |
| **서버 푸시** | 클라이언트 요청 없이 리소스 전송 |

### HTTP/3 (QUIC)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HTTP/2 vs HTTP/3                                     │
├──────────────────────────────────┬──────────────────────────────────────────┤
│           HTTP/2 (TCP)           │           HTTP/3 (QUIC/UDP)              │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  - 3-way handshake 필요          │  - 0-RTT 또는 1-RTT 연결                │
│  - TCP HOL Blocking              │  - 스트림별 독립 전송                   │
│  - TLS 별도 handshake            │  - TLS 1.3 내장                         │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **Stateless** | 서버가 클라이언트 상태를 보존하지 않는 특성 |
| **Connectionless** | 요청-응답 후 연결을 끊는 특성 |
| **Persistent Connection** | 연결을 유지하여 여러 요청 처리 |
| **Request** | 클라이언트가 서버에 보내는 메시지 |
| **Response** | 서버가 클라이언트에 보내는 메시지 |
| **Start-line** | HTTP 메시지의 첫 번째 줄 |
| **Header** | 메시지의 부가 정보 |
| **Body** | 실제 전송되는 데이터 |
| **Multiplexing** | HTTP/2에서 하나의 연결로 여러 요청 병렬 처리 |
