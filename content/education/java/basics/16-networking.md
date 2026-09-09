---
title: "Chapter 16. 네트워킹 (Networking)"
date: 2026-02-15
weight: 16
---

시리즈의 마지막 장이다. [Chapter 15](../15-io)의 스트림에 **상대방이 붙은 것**이 소켓이고, 그래서 이 장은 새 개념보다 앞 장들의 회수에 가깝다. 스트림을 닫아야 하고, `read()`가 블로킹이며, 바이트와 문자 사이에 인코딩이 있고, 쓰기 버퍼는 비워야 도착한다는 15장의 규칙이 네트워크에서 그대로 적용되고 더 아프게 적용된다. 상대가 언제 보낼지, 보내기는 할지 모르기 때문이다. 여러 클라이언트를 받는 서버의 구조는 [Chapter 13](../13-thread)의 "요청마다 스레드"와 가상 스레드로 이어지고, 네트워크의 모든 실패가 `IOException`인 이유는 [Chapter 08](../08-exception-handling)의 구분 그대로다. 규칙은 세 원리에서 나온다. 첫째, **이름, 주소, 포트, 자원은 다른 층이다.** DNS, `InetAddress`, 포트 번호, URL이 각각 한 층씩 맡는다. 둘째, **소켓은 스트림에 상대가 붙은 것이다.** 셋째, **TCP와 UDP의 차이는 연결, 순서, 신뢰의 유무이고, 자바의 API가 그 차이를 그대로 드러낸다.** 이 장의 실행 결과는 필자의 PC(JDK 25)에서 로컬 서버를 띄워 확인한 것이다.

---

## 1. 이름, 주소, 포트, 자원

### 1.1 네 개의 층

```
이름  www.example.com  DNS가 번역
주소  93.184.216.34    호스트를 찾는다
포트  443              프로세스 선택
자원  /path/page       URL의 나머지
```

네트워크 프로그래밍은 클라이언트가 서버에 요청을 보내고 응답을 받는 일이다. 그러려면 서버가 어느 기계인지(주소), 그 기계의 어느 프로세스인지(포트), 그 프로세스의 무엇을 원하는지(자원)를 적어야 하고, 사람은 주소 대신 이름을 쓰므로 이름을 주소로 바꾸는 층(DNS)이 하나 더 있다. 자바의 `java.net`은 이 층마다 클래스를 하나씩 둔다.

### 1.2 InetAddress: 이름을 주소로

```java
InetAddress lo = InetAddress.getByName("localhost");    // 127.0.0.1. Inet4Address
lo.isLoopbackAddress();                                  // true
InetAddress.getByName("::1");                            // 0:0:0:0:0:0:0:1. Inet6Address
InetAddress.getLocalHost();                              // 이 PC의 이름과 IP

InetAddress[] all = InetAddress.getAllByName("www.google.com");   // 여러 개일 수 있다
InetAddress.getByName("no-such-host.invalid");
// UnknownHostException: 알려진 호스트가 없습니다 (no-such-host.invalid)
```

IP 주소는 네트워크에 연결된 호스트를 식별하는 번호다. IPv4는 4바이트를 `192.168.10.100`처럼 적고, 주소가 모자라 나온 IPv6는 16바이트를 `::1`처럼 적는다. 어느 주소가 같은 네트워크에 속하는지를 정하는 서브넷과 라우팅은 네트워크 시리즈의 [IP 주소의 구조](../../../network/18-ip-address-structure)와 [서브넷의 구조와 서브넷팅](../../../network/21-subnet-structure)에서 다룬다. `InetAddress.getByName()`은 이름을 주소로 바꾸는데, 이 한 줄이 **네트워크를 탄다.** 운영체제의 캐시에 없으면 [DNS 서버](../../../network/30-dns-server-structure)에 물어보고 그 응답을 기다리며, 이름이 없으면 `UnknownHostException`이다. `www.google.com`처럼 큰 서비스는 주소가 여럿 돌아오고, 그중 어느 것에 붙어도 같은 서비스다.

### 1.3 포트: 주소 안의 프로세스

| 범위 | 이름 | 예 |
|:-----|:-----|:---|
| 0 ~ 1023 | 잘 알려진 포트 | HTTP 80, HTTPS 443, SSH 22, DNS 53 |
| 1024 ~ 49151 | 등록된 포트 | MySQL 3306, PostgreSQL 5432, Redis 6379 |
| 49152 ~ 65535 | 동적 포트 | 클라이언트가 임시로 받는 번호 |

한 호스트에서 여러 프로그램이 동시에 네트워크를 쓰므로 주소만으로는 부족하다. 포트는 호스트 안에서 프로세스를 가리키는 16비트 번호다. 서버는 정해진 포트에서 기다리고(그래야 클라이언트가 찾아온다), 클라이언트는 연결할 때 운영체제가 동적 범위에서 빈 번호를 하나 준다. 로컬에서 실험하면 `63510`, `63511`처럼 나온다. 잘 알려진 포트는 운영체제에 따라 관리자 권한이 필요하고, TCP와 UDP는 별개의 번호 공간이라 같은 번호에 TCP 서버와 UDP 서버가 함께 있을 수 있다. 포트 번호의 구조는 [포트 번호의 구조](../../../network/26-port-number-structure)에 있다.

### 1.4 URL과 URI

```
https://example.com:8080/api?t=json#r
 스킴   https        어떤 프로토콜로
 호스트 example.com  어느 기계에서
 포트   8080         어느 프로세스에게
 경로   /api         무엇을
 쿼리   t=json       어떤 조건으로
 조각   r            그 안의 어디
```

```java
URI uri = URI.create("https://example.com:8080/api?t=json#r");
uri.getScheme();    // https
uri.getHost();      // example.com
uri.getPort();      // 8080. 없으면 -1
uri.getPath();      // /api
uri.getQuery();     // t=json
uri.getFragment();  // r

URI.create("https://example.com/").toURL().getDefaultPort();   // 443
new URI("http", "example.com", "/a b", "q=한글", null).toASCIIString();
// http://example.com/a%20b?q=%ED%95%9C%EA%B8%80
```

URL은 자원의 위치를 한 줄로 적는 표기이고, 위 여섯 조각으로 나뉜다. 자바에는 `URL`과 `URI` 두 클래스가 있는데, 새 코드는 **`URI`로 만들고 필요할 때만 `toURL()`로 바꾼다.** `new URL(String)`은 Java 20에서 사용 금지가 됐다. 이유가 둘 있다. `URL`은 공백이나 한글을 `%20`, `%ED...`로 바꾸는 인코딩을 하지 않고, `URI`는 규칙대로 해 준다. 그리고 `URL.equals()`는 두 호스트 이름을 **DNS로 풀어 IP가 같은지** 비교한다. `new URL("http://localhost/")`와 `new URL("http://127.0.0.1/")`가 `equals()`로 `true`이고, 같은 비교를 `URI`로 하면 `false`다. 문자열 비교여야 할 `equals()`가 네트워크를 타는 것은 [Chapter 09](../09-java-lang-package)의 `equals()` 약속과 어긋나며, `HashMap`의 키로 쓰면 해시 계산마다 DNS 조회가 일어난다. `URL`이 남아 있는 것은 `openConnection()`처럼 그것을 받는 API 때문이다(5절).

---

## 2. 소켓: 스트림에 상대가 붙은 것

### 2.1 TCP와 UDP

| | TCP | UDP |
|:--|:----|:----|
| 연결 | 먼저 맺는다 | 없다 |
| 순서와 신뢰 | 보장. 잃으면 다시 보낸다 | 없다. 잃거나 뒤바뀔 수 있다 |
| 단위 | 경계 없는 바이트 스트림 | 경계 있는 데이터그램 |
| 비용 | 연결 수립과 확인 응답 | 거의 없다 |
| 자바 클래스 | `Socket`, `ServerSocket` | `DatagramSocket`, `DatagramPacket` |
| 쓰임 | HTTP, 메일, 파일, DB | DNS, 영상, 게임, VoIP |

전송 계층에는 두 프로토콜이 있고 둘 다 필요하다. TCP는 데이터가 순서대로 빠짐없이 도착한다고 약속하는 대신, 연결을 맺고 받았다는 응답을 주고받고 잃은 것을 다시 보내는 비용을 치른다. UDP는 그 약속을 하지 않는 대신 싸고 빠르다. 영상 통화에서 0.1초 전의 조각을 다시 받는 것은 의미가 없으므로 UDP가 맞고, 파일은 한 바이트라도 빠지면 안 되므로 TCP가 맞다. 자바는 이 차이를 클래스로 드러낸다. TCP는 연결이 있으니 **연결을 받는 클래스**(`ServerSocket`)가 따로 있고 데이터는 15장의 스트림으로 흐른다. UDP는 연결이 없으니 소켓 하나로 보내고 받으며 데이터는 봉투(`DatagramPacket`) 단위다. 두 프로토콜의 헤더와 동작은 [TCP의 구조](../../../network/24-tcp-structure)와 [UDP의 구조](../../../network/27-udp-structure)에서 본다.

```
클라이언트            서버
   │── SYN ─────────▶│  1. 연결 요청
   │◀── SYN+ACK ─────│  2. 수락
   │── ACK ─────────▶│  3. 확인
   │═══ 데이터 ═════▶│
```

TCP의 연결은 세 번의 패킷 교환(3-way handshake)으로 맺어진다. 이 왕복이 끝나야 데이터가 흐르므로 첫 바이트까지의 지연이 UDP보다 길고, `new Socket(host, port)`가 돌아오는 데 걸리는 시간이 바로 이것이다.

### 2.2 연결 과정

```
서버                     클라이언트
ServerSocket(port)  바인딩
accept() 대기 ◀── new Socket(host,port)
새 Socket 반환 ═══▶ 양방향 스트림
```

```
┌───────────┐        ┌───────────┐
│ Socket A  │        │ Socket B  │
│ OutStream │──────▶ │ InStream  │
│ InStream  │ ◀──────│ OutStream │
└───────────┘        └───────────┘
```

서버는 `ServerSocket`으로 포트를 차지하고 `accept()`에서 기다린다. 클라이언트가 `new Socket(host, port)`로 연결하면 `accept()`가 **그 클라이언트 전용의 새 `Socket`**을 돌려주고, 그 소켓의 입력 스트림은 상대의 출력 스트림과, 출력 스트림은 상대의 입력 스트림과 이어진다. `ServerSocket` 자체는 데이터를 나르지 않는다. 문을 열어 주는 역할만 하고 다시 `accept()`로 돌아가 다음 손님을 기다린다. 클라이언트 둘이 붙으면 서버에는 소켓이 둘 생기고, 각각 상대의 포트가 다르다(`63511`, `63512`).

### 2.3 에코 서버와 클라이언트

```java
// 서버
try (ServerSocket server = new ServerSocket(9000)) {
    Socket socket = server.accept();                       // 연결이 올 때까지 블로킹
    try (socket;
         BufferedReader in = new BufferedReader(
             new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
         PrintWriter out = new PrintWriter(
             new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true)) {
        String line = in.readLine();                       // 상대가 보낼 때까지 블로킹
        System.out.println(socket.getInetAddress() + ":" + socket.getPort() + " → " + line);
        out.println("echo:" + line);
        System.out.println(in.readLine());                 // 상대가 닫으면 null
    }
}

// 클라이언트
try (Socket socket = new Socket("localhost", 9000);
     PrintWriter out = new PrintWriter(
         new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true);
     BufferedReader in = new BufferedReader(
         new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {
    out.println("안녕");
    System.out.println(in.readLine());                     // echo:안녕
}
```

소켓에서 꺼낸 것은 15장의 `InputStream`과 `OutputStream` 그대로다. 그 위에 문자셋을 붙인 다리를 놓고, 줄 단위로 읽으려고 `BufferedReader`를 씌우는 것까지 파일과 같다. 다른 점은 상대가 있다는 것뿐이고, 그 상대가 연결을 닫으면 `read()`는 `-1`, `readLine()`은 `null`을 돌려준다. 파일의 끝과 같은 신호다.

### 2.4 15장의 규칙이 더 아프게 적용된다

```java
PrintWriter out = new PrintWriter(socket.getOutputStream());   // autoflush 없이
out.println("never arrives");
// 상대: readLine()에서 영원히 기다린다. setSoTimeout(500)을 걸었다면
// SocketTimeoutException: Read timed out
```

첫째, **버퍼는 비워야 도착한다.** 15장에서 쓰기 버퍼는 닫기 전에는 파일에 없다고 했는데, 소켓에서는 상대가 그 데이터를 기다리고 있으므로 양쪽이 서로를 영원히 기다리는 교착이 된다. 문자셋과 함께 `PrintWriter`의 둘째 인자 `true`(자동 flush)를 주거나 `flush()`를 직접 부른다. 둘째, **인코딩을 명시한다.** 파일은 한 PC 안에서 적고 읽지만 소켓의 상대는 다른 운영체제, 다른 언어일 수 있다. 셋째, **기다림에 기한을 둔다.** 파일의 `read()`는 곧 돌아오지만 소켓의 `read()`는 상대가 보내지 않으면 돌아오지 않는다. `setSoTimeout()`은 읽기에, `connect(addr, timeout)`은 연결에 기한을 두고, 넘으면 `SocketTimeoutException`이다.

| 예외 | 언제 | 메시지 |
|:-----|:-----|:-------|
| `ConnectException` | 그 포트에 아무도 없다 | Connection refused |
| `SocketTimeoutException` | 연결이나 읽기가 기한을 넘겼다 | Connect timed out, Read timed out |
| `BindException` | 서버 포트를 이미 누가 쓴다 | Address already in use |
| `UnknownHostException` | 이름을 주소로 못 바꿨다 | 호스트 이름 |
| `SocketException` | 통신 중 연결이 끊겼다 | Connection reset |

전부 `IOException`의 자손인 검사 예외다. 8장의 기준으로 네트워크 실패는 프로그램의 잘못이 아니라 **환경에서 오는, 예상해야 하는 실패**이기 때문이다. 네트워크 코드에 `throws IOException`이 늘 붙어 있는 이유다.

### 2.5 TCP에는 메시지 경계가 없다

```java
// 클라이언트가 두 번 보낸다
out.write("ab".getBytes()); out.flush();
out.write("cd".getBytes()); out.flush();

// 서버의 read() 한 번이 4바이트를 받는다
int n = in.read(buf);      // 4, "abcd"
```

TCP는 바이트의 흐름이지 메시지의 나열이 아니다. 보내는 쪽이 두 번 `write()`해도 받는 쪽의 `read()` 한 번에 합쳐서 오거나, 반대로 한 번 보낸 것이 여러 번에 나뉘어 올 수 있다. 어디까지가 한 메시지인지는 **응용 프로그램이 정해야 한다.** 줄바꿈으로 나누는 것(`readLine()`), 길이를 먼저 보내는 것(`DataOutputStream.writeInt` 뒤에 본문), 헤더에 길이를 적는 것(HTTP의 `Content-Length`)이 전부 그 약속이다. "가끔 메시지가 붙어서 온다"는 버그는 예외 없이 이 약속이 없어서 생긴다.

---

## 3. 여러 클라이언트: 연결마다 스레드

### 3.1 왜 스레드인가

```
C1 ─┐
C2 ─┼─▶ accept() ─▶ 연결마다 스레드
C3 ─┘              (또는 가상 스레드)
```

```java
try (ServerSocket server = new ServerSocket(9000)) {
    while (true) {
        Socket socket = server.accept();
        new Thread(() -> handle(socket)).start();     // 이 클라이언트는 이 스레드가
    }
}
```

2.3절의 서버는 한 번에 한 클라이언트만 상대한다. `readLine()`이 블로킹이라 첫 클라이언트가 보낼 때까지 두 번째 클라이언트의 `accept()`가 미뤄지기 때문이다. 13장에서 본 대로 블로킹은 스레드 하나를 세우는 것이고, 그렇다면 클라이언트마다 스레드를 하나씩 주면 된다. `accept()`가 돌려준 소켓을 새 스레드에 넘기고 `main` 스레드는 곧바로 다음 `accept()`로 돌아간다. 이 구조를 연결당 스레드(thread-per-connection)라 하고, 수십 년간 서버의 기본 모양이었다.

한계도 13장에서 본 것이다. 플랫폼 스레드는 스택이 1MB 안팎이고 만드는 데 운영체제 호출이 든다. 접속이 만 개면 스택만 수 GB이며, 그 스레드의 대부분은 `read()`에서 자고 있다. 그래서 세 갈래의 해법이 나왔다.

### 3.2 풀, NIO, 가상 스레드

```java
ExecutorService pool = Executors.newFixedThreadPool(200);   // 상한을 둔다
while (true) {
    Socket socket = server.accept();
    pool.execute(() -> handle(socket));
}

ExecutorService vexec = Executors.newVirtualThreadPerTaskExecutor();   // Java 21
while (true) {
    Socket socket = server.accept();
    vexec.submit(() -> handle(socket));                       // 연결마다 가상 스레드
}
```

첫째는 13장의 스레드 풀이다. 스레드 수에 상한을 두면 메모리는 지킬 수 있지만, 상한을 넘는 접속은 큐에서 기다리거나 거부된다. 둘째는 Java 1.4의 NIO다. `Selector` 하나가 수천 개의 소켓을 감시하다가 **읽을 준비가 된 것만** 스레드에 넘기므로 스레드 수가 접속 수와 분리된다. 대신 코드가 "다음 줄을 읽는다"가 아니라 "준비되면 불러 달라"는 이벤트 방식이 되어 훨씬 어렵고, 실무에서는 그것을 감싼 Netty 같은 프레임워크를 쓴다. 스프링 WebFlux와 gRPC의 바닥이 Netty다.

셋째가 Java 21의 가상 스레드다. 13장에서 본 대로 가상 스레드는 블로킹되면 캐리어에서 내려오므로, 연결마다 하나씩 만들어도 운영체제 스레드는 코어 수만큼만 쓴다. 필자의 PC에서 클라이언트 500개를 차례로 연결해 가상 스레드로 응답하는 데 0.3초가 걸렸고, 만 개도 같은 코드다. NIO가 코드를 뒤집어서 얻던 것을 **코드는 그대로 둔 채** 얻는다. 그래서 연결당 스레드는 다시 기본 모양이 됐다. 읽는 코드는 2.3절 그대로이고, 스레드를 어디서 얻느냐만 바뀐다.

---

## 4. UDP: 봉투를 보낸다

```
DatagramPacket
┌────────────────────┐
│ 주소 + 포트 (헤더) │
│ 데이터 byte[]      │
└────────────────────┘
```

```java
// 받는 쪽
try (DatagramSocket socket = new DatagramSocket(9000)) {
    byte[] buf = new byte[1024];
    DatagramPacket packet = new DatagramPacket(buf, buf.length);
    socket.receive(packet);                                    // 블로킹
    String msg = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
    System.out.println(packet.getAddress() + ":" + packet.getPort() + " → " + msg);
}

// 보내는 쪽
try (DatagramSocket socket = new DatagramSocket()) {
    byte[] data = "Hello UDP".getBytes(StandardCharsets.UTF_8);
    socket.send(new DatagramPacket(data, data.length,
                                   InetAddress.getByName("localhost"), 9000));
}
```

UDP에는 연결이 없다. 봉투에 주소와 포트를 적어 보내면 끝이고, 받는 쪽은 소켓 하나로 누가 보낸 것이든 받는다. 그래서 `ServerSocket`도 `accept()`도 스트림도 없다. TCP와 정반대인 성질이 셋 있다. **경계가 있다.** 2바이트짜리를 두 번 보내면 두 번 받고, 각각 2바이트다. **잘릴 수 있다.** 2,000바이트를 보내고 1,024바이트 버퍼로 받으면 `getLength()`가 1,024이고 나머지는 조용히 버려진다. 버퍼는 넉넉히 잡되 데이터그램 하나는 IPv4에서 65,507바이트를 넘을 수 없다. **잃거나 뒤바뀐다.** 도착 보장이 없으므로 응답이 없으면 `receive()`가 영원히 기다리고, `setSoTimeout()`으로 기한을 두면 `SocketTimeoutException`이다.

신뢰가 필요한데 UDP의 가벼움도 원하면 순서 번호와 재전송을 응용 프로그램이 직접 얹는다. HTTP/3의 바탕인 QUIC이 그렇게 만든 프로토콜이다.

---

## 5. HTTP 클라이언트: URL 위의 프로토콜

```java
HttpClient client = HttpClient.newHttpClient();                 // Java 11. 재사용한다
HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:8000/api?x=1"))
    .build();                                                   // 기본은 GET

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
response.statusCode();       // 200
response.version();          // HTTP_1_1. 서버가 HTTP/2를 하면 HTTP_2
response.body();             // 본문
response.headers().firstValue("content-type");   // Optional[text/plain; charset=utf-8]

client.sendAsync(request, HttpResponse.BodyHandlers.ofString())   // 14장의 CompletableFuture
      .thenApply(HttpResponse::body)
      .thenAccept(System.out::println);
```

HTTP는 TCP 위에서 요청과 응답을 주고받는 약속이고, 웹 서버가 어떻게 그 요청을 처리하는지는 [웹 애플리케이션 이해하기](../../web-programming/02-web-application)에서 본다. 클라이언트 쪽에서 소켓으로 직접 HTTP를 말할 수도 있지만, 헤더 파싱, 리다이렉트, 연결 재사용, TLS까지 손으로 하는 것은 무리다. Java 11의 `HttpClient`가 표준 클라이언트다. 요청과 응답이 불변 객체이고, 동기 `send()`와 비동기 `sendAsync()`가 있으며, 서버가 지원하면 HTTP/2로 협상한다. `HttpClient` 인스턴스는 연결 풀을 갖고 있으므로 하나 만들어 재사용한다.

```java
HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
conn.getResponseCode();        // 200
conn.getContentType();
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
    br.lines().forEach(System.out::println);
}
conn.disconnect();
```

`HttpURLConnection`은 JDK 1.1부터 있던 방식이다. 1.4절의 `URL`을 받으며, 형변환과 스트림 처리를 손으로 해야 하고 비동기와 HTTP/2가 없다. 옛 코드를 읽을 때 알아보면 되고 새 코드에는 `HttpClient`다. 로컬에서 시험할 서버가 필요하면 JDK에 든 `com.sun.net.httpserver.HttpServer`나 Java 18의 `jwebserver` 명령으로 충분하다.

---

## 6. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 네 개의 층 | 이름, 주소, 포트, 자원 | 각각 DNS, `InetAddress`, 포트 번호, URL이 맡는다 |
| `getByName()` | 네트워크를 탄다 | DNS 조회. 실패는 `UnknownHostException` |
| 포트 | 호스트 안의 프로세스 | 서버는 고정, 클라이언트는 동적 범위에서 받는다 |
| `URI`로 만든다 | `new URL()`은 Java 20 사용 금지 | 인코딩을 안 하고 `equals()`가 DNS를 탄다 |
| TCP와 UDP | 연결, 순서, 신뢰의 유무 | 약속의 대가가 비용. 둘 다 쓸 곳이 있다 |
| `ServerSocket` | 문을 열어 줄 뿐 | 데이터는 `accept()`가 돌려준 `Socket`이 나른다 |
| 소켓의 스트림 | 15장 그대로 | 상대의 출력이 나의 입력. 닫으면 `-1`, `null` |
| flush | 안 하면 서로 기다린다 | 버퍼는 비워야 도착한다 |
| 타임아웃 | `setSoTimeout`, `connect(timeout)` | 상대는 안 보낼 수도 있다 |
| 예외 | 전부 `IOException`의 검사 예외 | 환경의 실패는 예상해야 한다 |
| 경계 없음 | TCP는 바이트의 흐름 | 메시지 구분은 응용이 정한다. `readLine`, 길이, 헤더 |
| 연결마다 스레드 | `accept()` 뒤 새 스레드 | 블로킹은 스레드를 세운다 |
| 가상 스레드 | 연결마다 하나, 코드는 그대로 | 블로킹되면 캐리어에서 내려온다 |
| NIO | `Selector`가 준비된 것만 | 스레드 수와 접속 수의 분리. 대신 코드가 뒤집힌다 |
| UDP | 봉투 단위, 경계 있음 | 연결이 없다. 잘림, 유실, 순서는 응용의 몫 |
| `HttpClient` | Java 11 표준 | 불변 요청·응답, 비동기, HTTP/2. 하나를 재사용 |

| 할 일 | 도구 |
|:------|:-----|
| 신뢰가 필요한 통신 | TCP. `ServerSocket` + `Socket` |
| 지연이 중요한 통신 | UDP. `DatagramSocket` + `DatagramPacket` |
| 웹 API 호출 | `HttpClient` |
| 여러 클라이언트 | 가상 스레드로 연결마다 하나. 극한의 규모는 Netty |
| 이름과 주소 | `InetAddress`. 실패는 `UnknownHostException` |
| 자원 위치 | `URI`. 필요할 때만 `toURL()` |
