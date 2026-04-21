---
title: "Chapter 16. 네트워킹 (Networking)"
weight: 16
---

자바의 네트워크 프로그래밍 기초, IP 주소, URL, TCP/UDP 소켓, 블로킹 I/O의 한계와 NIO·Netty로의 확장을 다룬다.

---

## 1. 네트워킹이란?

네트워킹은 두 대 이상의 컴퓨터를 연결해 데이터를 주고받거나 자원을 공유하는 것을 말한다. 자바는 `java.net` 패키지를 통해 수십 줄의 코드로 클라이언트/서버 애플리케이션을 작성할 수 있다.

### 1.1 클라이언트/서버

```
┌──────────┐  요청   ┌──────────┐
│ Client   │ ──────▶ │ Server   │
│          │ ◀────── │          │
└──────────┘  응답   └──────────┘
```

| 항목 | 서버 기반 | P2P |
|:---|:---|:---|
| 구조 | 전용 서버 + 클라이언트 | 각 노드가 양쪽 역할 |
| 장점 | 안정성·보안 | 서버 비용 절감 |
| 단점 | 구축·운영 비용 | 자원 관리 난이도 |
| 예시 | 웹 서비스, 메일 | 토렌트, 블록체인 |

---

## 2. IP 주소 (IP Address)

IP 주소는 네트워크에 연결된 호스트를 식별하는 고유 값이다. IPv4는 4 byte(32 bit)이고 `a.b.c.d`로 표기한다.

### 2.1 구조와 서브넷

```
IP 주소       192.168.10.100
서브넷 마스크  255.255.255.0
────────── & ──────────────
네트워크 주소  192.168.10.0
```

- 네트워크 주소가 같으면 같은 네트워크
- 호스트 부분 `0`: 네트워크 자체
- 호스트 부분 `255`: 브로드캐스트
- 사용 가능 호스트: `2^n - 2` (n = 호스트 비트)

### 2.2 InetAddress

IP 주소를 다루는 자바 클래스다.

| 메서드 | 설명 |
|:---|:---|
| `getByName(host)` | 도메인 → IP |
| `getAllByName(host)` | 도메인의 모든 IP |
| `getLocalHost()` | 로컬 호스트 정보 |
| `getHostAddress()` | IP 문자열 |
| `getHostName()` | 호스트 이름 |
| `isLoopbackAddress()` | 127.0.0.1 여부 |

```java
InetAddress local = InetAddress.getLocalHost();
System.out.println(local.getHostName());
System.out.println(local.getHostAddress());

InetAddress addr = InetAddress.getByName("www.google.com");
System.out.println(addr.getHostAddress());
```

---

## 3. URL (Uniform Resource Locator)

### 3.1 URL의 구조

```
https://www.example.com:443/path/page?k=v#sec

 프로토콜   https
 호스트명   www.example.com
 포트      443
 경로      /path/page
 쿼리      k=v
 참조      sec
```

### 3.2 URL 클래스

| 메서드 | 설명 |
|:---|:---|
| `getProtocol()` | 프로토콜 |
| `getHost()` | 호스트 |
| `getPort()` | 포트 (미지정 -1) |
| `getPath()` | 경로 |
| `getQuery()` | 쿼리 |
| `openStream()` | 연결된 InputStream |
| `openConnection()` | URLConnection |

```java
URL url = new URL("https://example.com:8080/api?t=json#r");
System.out.println(url.getProtocol()); // https
System.out.println(url.getHost());     // example.com
System.out.println(url.getPort());     // 8080
System.out.println(url.getPath());     // /api
System.out.println(url.getQuery());    // t=json
```

### 3.3 URLConnection / HttpURLConnection

`openConnection()`은 프로토콜에 맞는 `URLConnection` 구현체를 반환한다. HTTP면 `HttpURLConnection`이다.

```java
URL url = new URL("https://www.example.com");
HttpURLConnection conn = (HttpURLConnection) url.openConnection();

System.out.println(conn.getResponseCode());    // 200
System.out.println(conn.getContentType());     // text/html

try (BufferedReader br = new BufferedReader(
        new InputStreamReader(conn.getInputStream()))) {
    br.lines().forEach(System.out::println);
}
conn.disconnect();
```

{{< callout type="info" >}}
**모던한 대안: `java.net.http.HttpClient`** — Java 11부터는 공식 표준 HTTP 클라이언트가 제공된다. 동기·비동기 API, HTTP/2, WebSocket을 지원한다.

```java
HttpClient client = HttpClient.newHttpClient();
HttpRequest req = HttpRequest.newBuilder(
        URI.create("https://example.com")).build();
HttpResponse<String> res = client.send(
        req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());
```

새 코드에서는 `HttpURLConnection` 대신 `HttpClient`를 선택하라.
{{< /callout >}}

---

## 4. 소켓 프로그래밍

소켓(Socket)은 프로세스 간 통신의 양쪽 끝단(endpoint)이다. 자바는 `java.net` 패키지로 TCP와 UDP 소켓을 모두 지원한다.

### 4.1 TCP vs UDP

| 항목 | TCP | UDP |
|:---|:---|:---|
| 연결 | 연결 기반 | 비연결 |
| 통신 | 1:1 | 1:1, 1:n, n:n |
| 경계 | 없음 (byte stream) | 있음 (datagram) |
| 순서 | 보장 | 미보장 |
| 신뢰성 | 높음 (재전송) | 낮음 |
| 속도 | 느림 | 빠름 |
| 클래스 | `Socket`, `ServerSocket` | `DatagramSocket`, `DatagramPacket` |
| 용도 | HTTP, FTP, 메일 | DNS, 스트리밍, 게임 |

### 4.2 TCP 3-Way Handshake

TCP는 연결 수립 시 3단계 핸드셰이크로 양방향 통신을 보장한다.

```
Client                    Server
   │                        │
   │── SYN ────────────────▶│  1. 연결 요청
   │                        │
   │◀── SYN + ACK ──────────│  2. 요청 수락
   │                        │
   │── ACK ────────────────▶│  3. 확인
   │                        │
   │═══ 데이터 통신 ═══════▶│
```

이 단계가 끝나야 데이터 전송이 시작되므로 UDP보다 지연(latency)이 크다. 반면 전송 후에도 ACK·윈도우 제어·재전송이 동작해 신뢰성을 보장한다.

---

## 5. TCP 소켓 프로그래밍

### 5.1 Socket과 ServerSocket

- `ServerSocket`: 포트에 바인딩되어 **연결 요청을 대기**한다. 요청이 오면 새 `Socket`을 생성해 연결을 수립한다.
- `Socket`: 연결된 상대와 **데이터를 송수신**하는 endpoint. `InputStream`과 `OutputStream`을 제공한다.

### 5.2 연결 과정

```
Server                    Client
  │                         │
  │ 1. ServerSocket(port)   │
  │    포트 바인딩            │
  │                         │
  │ 2. accept() 대기         │
  │                         │
  │◀── new Socket(h, p) ────│ 3. 연결 요청
  │                         │
  │ 4. 새 Socket 반환         │
  │                         │
  │◀═══ 양방향 통신 ═══════▶│
  │ (In/OutputStream)       │
```

### 5.3 스트림 구조

소켓은 입력·출력 스트림 쌍을 가지고, 상대 소켓과 **교차 연결**된다.

```
┌───────────┐        ┌───────────┐
│ Socket A  │        │ Socket B  │
│           │        │           │
│ OutStream │──────▶ │ InStream  │
│           │        │           │
│ InStream  │ ◀──────│ OutStream │
└───────────┘        └───────────┘
```

### 5.4 포트

호스트 내 프로세스를 구별하는 번호다.

| 범위 | 용도 |
|:---|:---|
| 0 ~ 1023 | Well-Known (HTTP, FTP, SSH 등) |
| 1024 ~ 49151 | 등록 포트 |
| 49152 ~ 65535 | 동적/사설 포트 |

{{< callout type="info" >}}
**포트 공유:** `ServerSocket`은 특정 포트를 독점한다. 다만 TCP와 UDP는 서로 다른 프로토콜이므로 같은 포트 번호에 각각 서버를 띄울 수 있다. `Socket`(클라이언트 측)은 OS가 임시 포트(ephemeral port)를 자동 할당한다.
{{< /callout >}}

### 5.5 서버/클라이언트 예제

```java
// 서버
try (ServerSocket server = new ServerSocket(9000)) {
    System.out.println("[서버] 대기 중...");
    Socket socket = server.accept();   // 블로킹

    BufferedReader in = new BufferedReader(
        new InputStreamReader(socket.getInputStream()));
    PrintWriter out = new PrintWriter(
        socket.getOutputStream(), true);

    String msg = in.readLine();
    System.out.println("[서버] 수신: " + msg);
    out.println("Hello from Server!");
    socket.close();
}
```

```java
// 클라이언트
try (Socket socket = new Socket("localhost", 9000)) {
    PrintWriter out = new PrintWriter(
        socket.getOutputStream(), true);
    BufferedReader in = new BufferedReader(
        new InputStreamReader(socket.getInputStream()));

    out.println("Hello from Client!");
    System.out.println("[클라이언트] 수신: " + in.readLine());
}
```

### 5.6 다중 클라이언트 — 쓰레드 방식

```java
ServerSocket server = new ServerSocket(9000);
while (true) {
    Socket socket = server.accept();
    new Thread(() -> handle(socket)).start();
}
```

```
┌────┐
│ C1 │─┐
└────┘ │   ┌──────────────┐
       ├──▶│ ServerSocket │
┌────┐ │   │   accept()   │
│ C2 │─┤   │   ↓          │
└────┘ │   │ Thread 생성   │
       │   │ → Socket     │
┌────┐ │   └──────────────┘
│ C3 │─┘
└────┘
```

{{< callout type="warning" >}}
**블로킹 I/O의 한계 — "Thread-per-connection" 문제**

위 방식은 클라이언트 하나당 쓰레드 하나를 띄운다. `accept()`와 `read()`가 **블로킹**이기 때문이다. 이 모델의 한계:

- 쓰레드 하나당 수 MB의 스택 메모리 — 수천 접속 시 메모리 폭발
- 컨텍스트 스위칭 오버헤드가 실제 작업을 압도
- 대부분의 쓰레드가 I/O 대기(WAITING)로 놀고 있음 — CPU 낭비

**대안 1: 쓰레드 풀** — `ExecutorService`로 쓰레드 수 상한을 둔다. 단, 접속이 풀 크기를 초과하면 대기 큐에 쌓이거나 거부된다.

**대안 2: NIO (Non-blocking I/O)** — `java.nio` 패키지의 `Selector`를 사용해 **하나의 쓰레드가 수천 개의 소켓을 감시**한다. 이벤트가 준비된 채널만 처리하므로 쓰레드 수가 연결 수와 분리된다.

**대안 3: Netty·Vert.x** — NIO를 직접 다루는 것은 까다롭다. 프로덕션에서는 `Netty` 같은 비동기 네트워크 프레임워크를 사용하는 것이 표준이다. Spring WebFlux, gRPC, 대다수의 고성능 서버가 내부적으로 Netty 기반이다.

**대안 4: Java 21 가상 쓰레드(Virtual Thread)** — Project Loom으로 "thread-per-connection" 모델을 **가상 쓰레드 위에 올려** 수백만 동시 연결도 감당할 수 있게 되었다.
{{< /callout >}}

### 5.7 쓰레드 풀 서버

```java
ServerSocket server = new ServerSocket(9000);
ExecutorService pool = Executors.newFixedThreadPool(10);

while (true) {
    Socket socket = server.accept();
    pool.execute(() -> handle(socket));
}
```

---

## 6. UDP 소켓 프로그래밍

UDP는 비연결 기반이어서 `ServerSocket`이 필요 없다. `DatagramSocket`과 `DatagramPacket`으로 패킷을 주고받는다.

### 6.1 DatagramPacket

```
┌─────────────────────────┐
│     DatagramPacket      │
│ ┌─────────────────────┐ │
│ │ Header              │ │
│ │  - 수신 주소/포트    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Data (byte[])       │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### 6.2 송신/수신 예제

```java
// 수신 측
DatagramSocket socket = new DatagramSocket(9000);
byte[] buf = new byte[1024];
DatagramPacket packet = new DatagramPacket(buf, buf.length);
socket.receive(packet);          // 블로킹

String received = new String(
    packet.getData(), 0, packet.getLength());
System.out.println(received);
System.out.println(packet.getAddress() + ":" + packet.getPort());
```

```java
// 송신 측
DatagramSocket socket = new DatagramSocket();
byte[] data = "Hello UDP!".getBytes();
DatagramPacket packet = new DatagramPacket(
    data, data.length,
    InetAddress.getByName("localhost"), 9000);
socket.send(packet);
```

### 6.3 TCP vs UDP 코드 비교

| 구분 | TCP | UDP |
|:---|:---|:---|
| 서버 바인딩 | `new ServerSocket(p)` | `new DatagramSocket(p)` |
| 클라이언트 | `new Socket(h, p)` | `new DatagramSocket()` |
| 연결 | `accept()` | 없음 |
| 전송 단위 | 스트림 | 패킷 |
| 송신 | `OutputStream.write()` | `socket.send(packet)` |
| 수신 | `InputStream.read()` | `socket.receive(packet)` |

{{< callout type="info" >}}
**UDP를 언제 쓰나?** 패킷 유실이 일부 허용되지만 **지연이 민감한** 환경에서 쓴다. 대표 예: DNS 질의, VoIP, 실시간 게임, 영상 스트리밍, DHCP, SNMP. 신뢰성이 필요하면 애플리케이션 레벨에서 재전송·순서 제어를 직접 구현해야 한다(예: QUIC).
{{< /callout >}}

---

## 7. 요약

### 네트워크 프로그래밍 흐름

```
          네트워크 프로그래밍
     ┌──────────┴──────────┐
   URL 기반              소켓 기반
   (고수준)              (저수준)
      │              ┌─────┴─────┐
    URL            TCP          UDP
    HttpClient   Socket      DatagramSocket
                 ServerSocket  DatagramPacket
```

### 핵심 개념

| 개념 | 설명 |
|:---|:---|
| IP 주소 | 호스트 식별 32 bit(IPv4) |
| 포트 | 프로세스 식별 (0~65535) |
| InetAddress | IP 조회 클래스 |
| URL | 인터넷 자원 위치 |
| HttpURLConnection | 전통 HTTP 클라이언트 |
| HttpClient (11+) | 모던 표준 HTTP 클라이언트 |
| Socket / ServerSocket | TCP 엔드포인트 |
| DatagramSocket / Packet | UDP 엔드포인트 |
| 3-way handshake | TCP 연결 수립 절차 |

### 선택 가이드

```
신뢰성이 중요 (파일·HTTP)
  └▶ TCP: ServerSocket + Socket

속도가 중요 (스트리밍·게임)
  └▶ UDP: DatagramSocket + Packet

웹 자원 접근 (고수준)
  └▶ HttpClient (Java 11+)

다수 클라이언트 (프로토타입)
  └▶ 쓰레드 풀 ExecutorService

다수 클라이언트 (프로덕션)
  └▶ NIO / Netty / 가상 쓰레드
```

{{< callout type="info" >}}
**핵심 원칙**

- 블로킹 I/O + 쓰레드 모델은 작은 규모에만 유효
- 수천 접속 이상은 NIO·Netty·가상 쓰레드 검토
- 새 HTTP 코드는 `HttpClient`로 시작
- 소켓 자원은 `try-with-resources`로 반드시 해제
- UDP는 신뢰성·순서를 애플리케이션이 책임진다
{{< /callout >}}
