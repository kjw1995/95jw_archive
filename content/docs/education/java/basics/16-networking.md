---
title: "Chapter 16. 네트워킹 (Networking)"
weight: 16
---

# 네트워킹 (Networking)

자바의 네트워크 프로그래밍 기초, IP 주소, URL, 소켓 프로그래밍(TCP/UDP)을 다룬다.

---

## 1. 네트워킹이란?

네트워킹(Networking)이란 두 대 이상의 컴퓨터를 연결하여 데이터를 주고받거나 자원을 공유하는 것을 말한다.

자바는 `java.net` 패키지를 통해 네트워크 프로그래밍을 지원하며, 간단한 네트워크 어플리케이션을 몇 줄의 코드만으로 작성할 수 있다.

### 1.1 클라이언트/서버 (Client/Server)

**서버(Server)**: 서비스를 제공하는 컴퓨터
**클라이언트(Client)**: 서비스를 사용하는 컴퓨터

```
┌──────────┐  요청   ┌──────────┐
│ 클라이언트 │ ──────▶ │   서버   │
│          │ ◀────── │          │
└──────────┘  응답   └──────────┘
```

네트워크 구성 방식은 크게 두 가지로 나뉜다.

| 항목 | 서버 기반 모델 | P2P 모델 |
|:-----|:-------------|:---------|
| 구조 | 전용 서버 + 클라이언트 | 각 노드가 서버이자 클라이언트 |
| 장점 | 안정적인 서비스, 보안 용이 | 서버 비용 절감, 자원 활용 극대화 |
| 단점 | 서버 구축/관리 비용 | 자원 관리 어려움, 보안 취약 |
| 예시 | 웹 서비스, 메일 서버 | 토렌트, 블록체인 |

---

## 2. IP 주소 (IP Address)

IP 주소는 네트워크에 연결된 컴퓨터(호스트)를 식별하는 고유한 값이다.

### 2.1 IP 주소의 구조

IPv4 주소는 4 byte(32 bit)로 구성되며 `a.b.c.d` 형태로 표현한다. 각 자리는 0~255 범위의 정수이다.

```
   192  .  168  .  10   .  100
┌──────┬──────┬──────┬──────┐
│8 bit │8 bit │8 bit │8 bit │
└──────┴──────┴──────┴──────┘
│← 네트워크 주소 →│← 호스트 →│
```

### 2.2 서브넷 마스크와 네트워크 주소

IP 주소와 서브넷 마스크를 `&` 연산하면 네트워크 주소만 추출할 수 있다.

```
IP 주소        192.168.10.100
서브넷 마스크   255.255.255.0
──────────── & ──────────────
네트워크 주소   192.168.10.0
```

- 네트워크 주소가 같으면 같은 네트워크에 속한다
- 호스트 주소 0: 네트워크 자체를 나타냄
- 호스트 주소 255: 브로드캐스트 주소
- 실제 사용 가능한 호스트 수: 254개 (2^8 - 2)

### 2.3 InetAddress

자바에서 IP 주소를 다루기 위한 클래스이다.

| 메서드 | 설명 |
|:-------|:-----|
| `getByName(String host)` | 도메인명으로 IP 주소를 얻는다 |
| `getAllByName(String host)` | 도메인의 모든 IP 주소를 배열로 반환 |
| `getLocalHost()` | 로컬 호스트의 IP 주소를 반환 |
| `getHostName()` | 호스트 이름 반환 |
| `getHostAddress()` | IP 주소를 문자열로 반환 |
| `getAddress()` | IP 주소를 byte 배열로 반환 |
| `isLoopbackAddress()` | 루프백 주소(127.0.0.1)인지 확인 |

```java
import java.net.InetAddress;

public class InetAddressExample {
    public static void main(String[] args) throws Exception {
        // 로컬 호스트 정보
        InetAddress local = InetAddress.getLocalHost();
        System.out.println("호스트 이름: " + local.getHostName());
        System.out.println("IP 주소: " + local.getHostAddress());

        // 도메인으로 IP 조회
        InetAddress addr = InetAddress.getByName("www.google.com");
        System.out.println("Google IP: " + addr.getHostAddress());

        // 하나의 도메인에 여러 IP가 매핑된 경우
        InetAddress[] all = InetAddress.getAllByName("www.google.com");
        for (InetAddress a : all) {
            System.out.println("IP: " + a.getHostAddress());
        }
    }
}
```

---

## 3. URL (Uniform Resource Locator)

인터넷 자원의 위치를 나타내는 주소이다.

### 3.1 URL의 구조

```
http://www.example.com:80/path/page.html?key=value#section

프로토콜   http
호스트명   www.example.com
포트번호   80 (HTTP 기본값, 생략 가능)
경로명     /path/
파일명     page.html
쿼리       key=value
참조       section
```

### 3.2 URL 클래스

| 메서드 | 설명 |
|:-------|:-----|
| `getProtocol()` | 프로토콜 반환 |
| `getHost()` | 호스트명 반환 |
| `getPort()` | 포트 번호 반환 (-1이면 미지정) |
| `getDefaultPort()` | 기본 포트 반환 (HTTP → 80) |
| `getPath()` | 경로 반환 |
| `getQuery()` | 쿼리 스트링 반환 |
| `getFile()` | 경로 + 쿼리 반환 |
| `openStream()` | URL에 연결된 InputStream 반환 |
| `openConnection()` | URLConnection 객체 반환 |

```java
import java.net.URL;

public class URLExample {
    public static void main(String[] args) throws Exception {
        URL url = new URL("https://example.com:8080/api/data?type=json#result");

        System.out.println("프로토콜: " + url.getProtocol());   // https
        System.out.println("호스트: " + url.getHost());         // example.com
        System.out.println("포트: " + url.getPort());           // 8080
        System.out.println("경로: " + url.getPath());           // /api/data
        System.out.println("쿼리: " + url.getQuery());          // type=json
        System.out.println("참조: " + url.getRef());            // result
    }
}
```

### 3.3 URL로 웹 페이지 읽기

`openStream()`은 `openConnection().getInputStream()`의 축약형이다.

```java
import java.io.*;
import java.net.URL;

public class URLReadExample {
    public static void main(String[] args) throws Exception {
        URL url = new URL("https://www.example.com");

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(url.openStream()))) {
            String line;
            while ((line = br.readLine()) != null) {
                System.out.println(line);
            }
        }
    }
}
```

### 3.4 URLConnection

어플리케이션과 URL 간의 통신 연결을 나타내는 추상 클래스이다.

```
      URL 클래스의 메서드
URL ────openConnection()────▶ URLConnection
                                    │
                         ┌──────────┴──────────┐
                   HttpURLConnection     JarURLConnection
```

- URL의 프로토콜이 HTTP이면 `HttpURLConnection`을 반환한다
- `getInputStream()`으로 데이터를 읽고, `getOutputStream()`으로 데이터를 보낼 수 있다

```java
import java.io.*;
import java.net.*;

public class URLConnectionExample {
    public static void main(String[] args) throws Exception {
        URL url = new URL("https://www.example.com");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        // 응답 정보 확인
        System.out.println("응답 코드: " + conn.getResponseCode());      // 200
        System.out.println("콘텐츠 타입: " + conn.getContentType());     // text/html
        System.out.println("콘텐츠 길이: " + conn.getContentLength());

        // 응답 본문 읽기
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = br.readLine()) != null) {
                System.out.println(line);
            }
        }

        conn.disconnect();
    }
}
```

---

## 4. 소켓 프로그래밍

소켓(Socket)이란 프로세스 간 통신에 사용되는 양쪽 끝단(endpoint)이다. 자바는 `java.net` 패키지로 TCP/UDP 소켓 프로그래밍을 지원한다.

### 4.1 TCP와 UDP 비교

| 항목 | TCP | UDP |
|:-----|:----|:----|
| 연결 방식 | 연결 기반 (전화) | 비연결 기반 (소포) |
| 통신 방식 | 1:1 | 1:1, 1:n, n:n |
| 데이터 경계 | 구분 안 함 (byte-stream) | 구분 함 (datagram) |
| 전송 순서 | 보장됨 | 보장 안 됨 |
| 수신 확인 | 확인함 (재전송) | 확인 안 함 |
| 전송 속도 | 느림 | 빠름 |
| 신뢰성 | 높음 | 낮음 |
| 관련 클래스 | `Socket`, `ServerSocket` | `DatagramSocket`, `DatagramPacket` |
| 사용 예시 | HTTP, FTP, 이메일 | DNS, 스트리밍, 게임 |

### 4.2 TCP의 3-Way Handshake

TCP는 연결을 수립할 때 3단계 핸드셰이크를 수행한다.

```
클라이언트                  서버
    │                        │
    │──── SYN ──────────────▶│  1. 연결 요청
    │                        │
    │◀─── SYN + ACK ────────│  2. 요청 수락
    │                        │
    │──── ACK ──────────────▶│  3. 연결 확인
    │                        │
    │◀═══ 데이터 통신 ═══════▶│
```

---

## 5. TCP 소켓 프로그래밍

### 5.1 통신 과정

```
서버                        클라이언트
  │                            │
  │ 1. ServerSocket 생성       │
  │    (포트 바인딩)            │
  │                            │
  │ 2. accept()으로            │
  │    연결 요청 대기            │
  │                            │
  │◀── 3. Socket으로 연결 요청 ─│
  │                            │
  │ 4. 새 Socket 생성하여      │
  │    클라이언트와 연결         │
  │                            │
  │◀═══ 5. 소켓 간 통신 ══════▶│
  │    (InputStream/           │
  │     OutputStream)          │
```

### 5.2 Socket과 ServerSocket

```java
// Socket — 프로세스 간 통신을 담당
//   InputStream과 OutputStream을 통해 데이터 송수신

// ServerSocket — 포트에 바인딩되어 연결 요청을 대기
//   연결 요청이 오면 새로운 Socket을 생성하여 통신
//   한 포트에 하나의 ServerSocket만 연결 가능
```

### 5.3 소켓의 스트림 구조

소켓은 입력 스트림과 출력 스트림을 가지며, 상대편 소켓의 스트림과 교차 연결된다.

```
┌──────────────┐        ┌──────────────┐
│  Socket A    │        │  Socket B    │
│              │        │              │
│ OutputStream ├───────▶│ InputStream  │
│              │        │              │
│ InputStream  │◀───────┤ OutputStream │
└──────────────┘        └──────────────┘
```

### 5.4 포트 (Port)

포트는 호스트가 외부와 통신하기 위한 통로이다.

| 항목 | 설명 |
|:-----|:-----|
| 범위 | 0 ~ 65535 (총 65536개) |
| 0 ~ 1023 | Well-Known 포트 (FTP, HTTP 등) |
| 1024 ~ 49151 | 등록된 포트 |
| 49152 ~ 65535 | 동적/사설 포트 |

{{< callout type="info" >}}
**포트와 서버소켓의 관계:** 서버소켓은 포트를 독점하지만, 일반 소켓은 하나의 포트를 여러 개가 공유할 수 있다. 단, 서로 다른 프로토콜(TCP/UDP)을 사용하면 같은 포트에 각각 서버소켓을 바인딩할 수 있다.
{{< /callout >}}

### 5.5 TCP 서버/클라이언트 예제

#### 서버

```java
import java.io.*;
import java.net.*;

public class TcpServer {
    public static void main(String[] args) {
        try (ServerSocket serverSocket = new ServerSocket(9000)) {
            System.out.println("[서버] 연결 대기 중...");

            // 클라이언트 연결 요청 대기 (블로킹)
            Socket socket = serverSocket.accept();
            System.out.println("[서버] 클라이언트 연결됨: "
                    + socket.getInetAddress());

            // 스트림 생성
            BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream()));
            PrintWriter out = new PrintWriter(
                    socket.getOutputStream(), true);

            // 메시지 수신
            String received = in.readLine();
            System.out.println("[서버] 수신: " + received);

            // 응답 전송
            out.println("Hello from Server!");

            socket.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

#### 클라이언트

```java
import java.io.*;
import java.net.*;

public class TcpClient {
    public static void main(String[] args) {
        try (Socket socket = new Socket("localhost", 9000)) {
            System.out.println("[클라이언트] 서버에 연결됨");

            // 스트림 생성
            PrintWriter out = new PrintWriter(
                    socket.getOutputStream(), true);
            BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream()));

            // 메시지 전송
            out.println("Hello from Client!");

            // 응답 수신
            String response = in.readLine();
            System.out.println("[클라이언트] 수신: " + response);

        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### 5.6 다중 클라이언트 처리

서버가 여러 클라이언트를 동시에 처리하려면 **쓰레드**를 활용한다.

```java
import java.io.*;
import java.net.*;

public class MultiClientServer {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(9000);
        System.out.println("[서버] 다중 클라이언트 대기 중...");

        while (true) {
            Socket socket = serverSocket.accept();
            System.out.println("[서버] 새 클라이언트: "
                    + socket.getInetAddress());

            // 클라이언트마다 쓰레드 생성
            new Thread(() -> handleClient(socket)).start();
        }
    }

    private static void handleClient(Socket socket) {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(socket.getInputStream()));
             PrintWriter out = new PrintWriter(
                socket.getOutputStream(), true)) {

            String msg;
            while ((msg = in.readLine()) != null) {
                System.out.println("[수신] " + msg);
                out.println("에코: " + msg);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

```
┌──────────┐
│클라이언트1 │──┐
└──────────┘  │    ┌──────────────┐
              ├───▶│              │
┌──────────┐  │    │ ServerSocket │
│클라이언트2 │──┤    │   accept()   │
└──────────┘  │    │              │
              ├───▶│  쓰레드 생성   │
┌──────────┐  │    │  → Socket    │
│클라이언트3 │──┘    └──────────────┘
└──────────┘
```

{{< callout type="warning" >}}
**쓰레드 방식의 한계:** 클라이언트마다 쓰레드를 생성하면 수천 개의 동시 접속 시 성능 문제가 발생한다. 실무에서는 **쓰레드 풀(ExecutorService)** 이나 **NIO(Non-blocking I/O)** 를 사용한다.
{{< /callout >}}

### 5.7 쓰레드 풀을 활용한 서버

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

public class ThreadPoolServer {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(9000);
        ExecutorService pool = Executors.newFixedThreadPool(10);

        System.out.println("[서버] 쓰레드 풀 서버 시작 (최대 10 쓰레드)");

        while (true) {
            Socket socket = serverSocket.accept();
            pool.execute(() -> handleClient(socket));
        }
    }

    private static void handleClient(Socket socket) {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(socket.getInputStream()));
             PrintWriter out = new PrintWriter(
                socket.getOutputStream(), true)) {

            String msg;
            while ((msg = in.readLine()) != null) {
                out.println("응답: " + msg);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

---

## 6. UDP 소켓 프로그래밍

UDP는 비연결 기반이므로 `ServerSocket`이 필요 없다. `DatagramSocket`과 `DatagramPacket`을 사용한다.

### 6.1 DatagramPacket의 구조

```
┌─────────────────────────┐
│     DatagramPacket      │
│                         │
│  ┌───────────────────┐  │
│  │  헤더 (Header)     │  │
│  │  - 수신 호스트 주소  │  │
│  │  - 수신 포트 번호   │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │  데이터 (Data)     │  │
│  │  - byte[]         │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### 6.2 UDP 송신/수신 예제

#### 수신 측 (서버 역할)

```java
import java.net.*;

public class UdpReceiver {
    public static void main(String[] args) throws Exception {
        DatagramSocket socket = new DatagramSocket(9000);
        System.out.println("[수신] 데이터 대기 중...");

        byte[] buffer = new byte[1024];
        DatagramPacket packet = new DatagramPacket(buffer, buffer.length);

        // 데이터 수신 (블로킹)
        socket.receive(packet);

        String received = new String(
                packet.getData(), 0, packet.getLength());
        System.out.println("[수신] " + received);
        System.out.println("[송신자] " + packet.getAddress()
                + ":" + packet.getPort());

        socket.close();
    }
}
```

#### 송신 측 (클라이언트 역할)

```java
import java.net.*;

public class UdpSender {
    public static void main(String[] args) throws Exception {
        DatagramSocket socket = new DatagramSocket();

        String message = "Hello UDP!";
        byte[] data = message.getBytes();

        // 수신 대상 주소 지정
        InetAddress address = InetAddress.getByName("localhost");
        DatagramPacket packet = new DatagramPacket(
                data, data.length, address, 9000);

        // 데이터 전송
        socket.send(packet);
        System.out.println("[송신] " + message);

        socket.close();
    }
}
```

### 6.3 TCP vs UDP 코드 비교

| 구분 | TCP | UDP |
|:-----|:----|:----|
| 서버 소켓 | `new ServerSocket(port)` | 없음 |
| 클라이언트 소켓 | `new Socket(host, port)` | `new DatagramSocket()` |
| 데이터 전송 단위 | 스트림 (연속적) | 패킷 (개별적) |
| 연결 수립 | `accept()` 후 통신 | 바로 `send()/receive()` |
| 데이터 전송 | `OutputStream.write()` | `socket.send(packet)` |
| 데이터 수신 | `InputStream.read()` | `socket.receive(packet)` |

---

## 7. 요약

### 네트워크 프로그래밍 흐름

```
          네트워크 프로그래밍
     ┌──────────┴──────────┐
  URL 기반               소켓 기반
  (고수준)               (저수준)
     │                ┌─────┴─────┐
  URL               TCP         UDP
  URLConnection   Socket      DatagramSocket
  HttpURLConnection ServerSocket DatagramPacket
```

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **IP 주소** | 호스트를 식별하는 32 bit 고유 값 (IPv4) |
| **포트** | 호스트 내 프로세스를 식별하는 번호 (0~65535) |
| **InetAddress** | IP 주소를 다루기 위한 클래스 |
| **URL** | 인터넷 자원의 위치를 나타내는 주소 |
| **URLConnection** | URL과의 통신 연결을 나타내는 추상 클래스 |
| **소켓** | 프로세스 간 통신의 끝단 (endpoint) |
| **ServerSocket** | TCP 서버. 포트에서 연결 요청을 대기 |
| **Socket** | TCP 클라이언트. 스트림으로 데이터 송수신 |
| **DatagramSocket** | UDP 소켓. 패킷 단위로 데이터 송수신 |
| **DatagramPacket** | UDP 데이터 전송 단위. 헤더(주소) + 데이터 |

### 선택 가이드

```
신뢰성이 중요한 통신 (파일 전송, HTTP 등)
  └→ TCP: ServerSocket + Socket

속도가 중요한 통신 (스트리밍, 게임 등)
  └→ UDP: DatagramSocket + DatagramPacket

웹 자원 접근 (URL로 데이터 읽기)
  └→ URL.openStream() 또는 URLConnection

다수 클라이언트 처리
  └→ 쓰레드 풀 (ExecutorService) 활용
```
