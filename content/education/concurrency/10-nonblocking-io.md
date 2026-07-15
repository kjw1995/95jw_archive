---
title: "논블로킹 I/O"
weight: 10
---

입출력 중심 애플리케이션에서 프로세서가 입출력 완료를 기다리며 놀지 않도록 만드는 기법을 다룬다. 블로킹과 논블로킹 연산의 차이, 스레드 기반 동시성의 한계, 그리고 단일 스레드로 다수의 클라이언트를 처리하는 이벤트 루프 구조를 살펴본다.

---

## 1. 입출력 바운드와 동시성의 필요성

메시지 전달 IPC를 사용하는 클라이언트-서버 애플리케이션은 여러 클라이언트와 서버가 **동시에** 메시지를 주고받으며 그 결과에 따라 동작한다. 따라서 이런 구조에서는 동시성이 선택이 아니라 필수다.

이런 애플리케이션은 대부분 **입출력 바운드(I/O-bound)** 다. 프로세서가 실제 연산을 하는 시간보다, 디스크나 네트워크의 입출력이 끝나기를 **기다리는 시간**이 훨씬 길다.

| 구분 | 병목 | 특징 | 예시 |
|:-----|:-----|:-----|:-----|
| **CPU 바운드** | CPU 속도 | 연산이 대부분 | 암호화, 이미지 처리, 정렬 |
| **I/O 바운드** | 디스크·네트워크 | 입출력 대기가 대부분 | 웹 서버, DB 프록시, 채팅 |

```
I/O 바운드 작업의 시간 구성

▓░░░░░░░▓░░░░░░░▓░░░░░░░

▓ = CPU 연산 (짧음)
░ = I/O 대기 (김)

CPU는 대기 시간 동안 논다
```

{{< callout type="info" >}}
**I/O 바운드일수록 동시성의 이득이 크다.** CPU가 노는 대기 시간에 다른 작업을 끼워 넣을 수 있기 때문이다. 반대로 CPU 바운드 작업은 이미 CPU를 꽉 채워 쓰고 있어 논블로킹만으로는 얻는 게 적고, 코어를 더 쓰는 병렬화가 답이다.
{{< /callout >}}

---

## 2. 블로킹 vs 논블로킹 I/O

두 방식의 차이는 **제어를 언제 호출 측에 돌려주는가**에 있다.

| 방식 | 제어 반환 시점 | 호출 스레드 |
|:-----|:-------------|:-----------|
| **블로킹** | 연산을 **다 마친 뒤** 반환 | 완료까지 멈춰서 대기 |
| **논블로킹** | 연산을 **시작만 하고 즉시** 반환 | 다른 일을 계속 수행 |

```
블로킹 연산
─────────────────────────
호출 ─▶ [ I/O 진행 ] ─▶ 반환
         (호출자 대기)

논블로킹 연산
─────────────────────────
호출 ─▶ 반환 (즉시)
         [ I/O 진행 ]
호출자는 그동안 다른 일 수행
```

> **CPU 연산보다 입출력 연산의 비중이 클수록 논블로킹 입출력의 이득이 더욱 커진다.**

### 2.1 블로킹 소켓 예제

블로킹 모드에서는 `accept()`와 `read()`가 데이터가 준비될 때까지 스레드를 멈춘다.

```java
// 블로킹: 연결/데이터가 올 때까지 스레드가 멈춘다
ServerSocket server = new ServerSocket(8080);
Socket socket = server.accept();          // 연결이 올 때까지 블로킹
InputStream in = socket.getInputStream();
int b = in.read();                        // 데이터가 올 때까지 블로킹
```

이 스레드는 `read()`에 묶여 있는 동안 아무 일도 하지 못한다. 클라이언트 하나를 처리하는 데 스레드 하나가 통째로 붙는다.

### 2.2 논블로킹 소켓 예제

`java.nio`의 채널을 논블로킹 모드로 설정하면, 준비된 데이터가 없을 때 스레드를 멈추지 않고 즉시 반환한다.

```java
// 논블로킹: 준비된 것이 없으면 즉시 넘어간다
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(8080));
server.configureBlocking(false);          // 논블로킹 모드

SocketChannel client = server.accept();   // 연결 없으면 즉시 null 반환
if (client != null) {
    ByteBuffer buf = ByteBuffer.allocate(1024);
    int n = client.read(buf);             // 데이터 없으면 즉시 0 반환
}
```

### 2.3 (보강) 블로킹/논블로킹 vs 동기/비동기

자주 혼동되는 두 축을 정리한다. **블로킹/논블로킹**은 *제어를 언제 돌려주는가*, **동기/비동기**는 *작업 완료를 어떻게 확인하는가*의 문제다.

| | 블로킹 | 논블로킹 |
|:-----|:-----|:-----|
| **동기** | 일반 `read()` | 논블로킹 `read()` + 폴링 |
| **비동기** | (거의 없음) | AIO·콜백 (완료 시 통지) |

- **동기**: 호출자가 완료를 **직접** 확인한다(반환값을 보거나, 계속 되물어본다).
- **비동기**: 완료되면 **커널·런타임이 알려준다**(콜백·이벤트). 호출자는 되묻지 않는다.

{{< callout type="warning" >}}
이 4분면 분류는 문헌마다 정의가 조금씩 다르다. 실무에서는 **"이 함수가 나를 멈추게 하는가(블로킹), 그리고 결과를 내가 되묻는가/통지받는가(동기·비동기)"** 정도로 구분하면 충분하다.
{{< /callout >}}

---

## 3. 스레드 기반 동시성의 한계

가장 단순한 서버 구조는 **연결마다 스레드를 하나씩** 붙이는 방식(thread-per-connection)이다. 블로킹 `read()`로 인해 스레드가 멈추더라도, 다른 연결은 다른 스레드가 처리하므로 동시성이 확보된다.

```java
// 연결마다 스레드 하나 (thread-per-connection)
ServerSocket server = new ServerSocket(8080);
while (true) {
    Socket socket = server.accept();      // 블로킹
    new Thread(() -> handle(socket)).start();  // 연결당 스레드
}
```

```
클라이언트 N개 → 스레드 N개

C1 ─▶ [Thread 1]
C2 ─▶ [Thread 2]
C3 ─▶ [Thread 3]
 ⋮         ⋮
CN ─▶ [Thread N]
```

하지만 운영체제가 제공하는 스레드(특히 프로세스)는 **비교적 적은 수로 오래 동작하는 작업**에 적합하다. 사용할 수 있는 스레드 수에는 현실적인 한계가 있기 때문이다.

| 비용 | 설명 |
|:-----|:-----|
| **스레드 스택 메모리** | 스레드마다 스택(수백 KB~1MB)을 잡는다 |
| **컨텍스트 스위칭** | 스레드가 많을수록 전환 비용이 커진다 |
| **생성·소멸 비용** | 연결마다 스레드를 만들고 없애는 오버헤드 |

{{< callout type="warning" >}}
**C10K 문제.** 동시 커넥션이 1만 개일 때, thread-per-connection이면 스레드 스택만으로도 수 GB의 메모리가 필요하고 컨텍스트 스위칭이 CPU를 잠식한다. "연결 하나에 스레드 하나"는 커넥션 수가 커지면 무너진다.
{{< /callout >}}

---

## 4. 바쁜 대기(Busy-waiting)와 단일 스레드 다중 처리

스레드나 프로세스의 **생성 비용을 절약하는 방법**으로 **바쁜 대기(busy-waiting)** 기법이 있다. 여러 클라이언트의 요청을 **논블로킹 연산**을 통해 **단일 스레드**로 처리하는 구조다.

핵심 아이디어는 이렇다. 블로킹 `read()`는 스레드를 멈추므로 여러 연결을 한 스레드로 다룰 수 없다. 하지만 **논블로킹** `read()`는 즉시 반환하므로, 한 스레드가 모든 연결을 **차례로 돌면서** "준비된 게 있나?"를 계속 확인할 수 있다.

```java
// 단일 스레드가 모든 연결을 순회하며 확인
List<SocketChannel> clients = new ArrayList<>();
ByteBuffer buf = ByteBuffer.allocate(1024);

while (true) {                            // 무한 폴링 루프
    SocketChannel c = server.accept();    // 논블로킹: 없으면 null
    if (c != null) {
        c.configureBlocking(false);
        clients.add(c);
    }
    for (SocketChannel client : clients) {
        buf.clear();
        int n = client.read(buf);         // 논블로킹: 없으면 0
        if (n > 0) {
            handle(client, buf);          // 준비된 요청만 처리
        }
    }
    // 준비된 소켓이 없어도 루프는 계속 돈다 → CPU 낭비
}
```

```
단일 스레드 폴링 루프

  ┌─▶ accept? ─▶ read C1? ─┐
  │                        │
  └── read CN? ◀─ read C2? ◀┘
        (쉬지 않고 계속 순회)
```

{{< callout type="warning" >}}
**바쁜 대기의 함정.** 준비된 소켓이 하나도 없어도 루프는 CPU를 100% 태우며 계속 확인한다(busy polling). 연결 수가 많으면 매 바퀴 모든 소켓을 훑어야 하므로 비효율이 커진다. 이 CPU 낭비를 없애는 것이 다음 절의 **I/O 멀티플렉싱**이다.
{{< /callout >}}

---

## 5. (보강) I/O 멀티플렉싱과 이벤트 루프

바쁜 대기의 문제는 "준비되지 않은 소켓까지 계속 물어본다"는 데 있다. 해결책은 확인 책임을 **커널에 넘기는** 것이다. 즉, "여러 소켓 중 **준비된 것이 생기면 깨워달라**"고 운영체제에 맡긴다. 이를 **I/O 멀티플렉싱(I/O multiplexing)** 이라 한다.

| 메커니즘 | 특징 | 확장성 |
|:-----|:-----|:-----|
| `select` | 감시 fd 수 제한(보통 1024), 매번 전체 스캔 | 낮음 |
| `poll` | fd 수 제한 없음, 여전히 O(n) 스캔 | 중간 |
| `epoll` (Linux) | 준비된 fd만 O(1)로 통지 | 높음 |

{{< callout type="info" >}}
OS별로 고성능 구현이 다르다. **Linux**는 `epoll`, **BSD·macOS**는 `kqueue`, **Windows**는 `IOCP`를 쓴다. 자바의 `Selector`는 이들을 추상화하여 플랫폼에 맞는 구현을 자동으로 선택한다.
{{< /callout >}}

준비된 이벤트만 골라 처리하는 이 단일 스레드 루프를 **이벤트 루프(event loop)** 또는 **리액터 패턴(reactor pattern)** 이라 부른다.

```
      C1   C2   C3  ...   (클라이언트)
        \   |   /
         ▼  ▼  ▼
   ┌──────────────┐
   │   Selector   │  I/O 멀티플렉싱
   └──────┬───────┘
          │ 준비된 채널만 통지
          ▼
   ┌──────────────┐
   │  Event Loop  │  단일 스레드
   └──────────────┘
```

---

## 6. (보강) Java NIO Selector 실전 예제

`Selector`는 하나의 스레드가 여러 채널을 감시하도록 해준다. 아래는 논블로킹 채널과 `Selector`로 만든 **에코 서버**다. 4절의 바쁜 대기와 달리, `select()`가 준비된 채널이 생길 때까지 **CPU를 태우지 않고 대기**한다.

```java
Selector selector = Selector.open();
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(8080));
server.configureBlocking(false);
server.register(selector, SelectionKey.OP_ACCEPT);

while (true) {
    selector.select();                    // 준비된 채널이 없으면 잠든다
    Iterator<SelectionKey> it =
        selector.selectedKeys().iterator();

    while (it.hasNext()) {
        SelectionKey key = it.next();
        it.remove();

        if (key.isAcceptable()) {         // 새 연결
            SocketChannel client = server.accept();
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ);

        } else if (key.isReadable()) {    // 읽을 데이터 있음
            SocketChannel client =
                (SocketChannel) key.channel();
            ByteBuffer buf = ByteBuffer.allocate(1024);
            int n = client.read(buf);
            if (n == -1) {
                client.close();           // 연결 종료
            } else {
                buf.flip();
                client.write(buf);        // 받은 그대로 되돌려줌
            }
        }
    }
}
```

{{< callout type="info" >}}
**폴링(바쁜 대기)과 `select()`의 결정적 차이.** 폴링은 준비된 것이 없어도 CPU를 태우며 계속 확인한다. `select()`는 준비된 채널이 하나라도 생길 때까지 **스레드를 재운다**. 커널이 이벤트가 생겼을 때 깨워주므로 CPU 낭비가 없다. 단일 스레드로 수만 개의 연결을 감당할 수 있는 이유다.
{{< /callout >}}

### 세 가지 서버 모델 비교

| 모델 | 스레드 수 | CPU 효율 | 확장성 |
|:-----|:---------|:--------|:------|
| **thread-per-connection** | 연결당 1개 | 높음 | 낮음 (스레드 한계) |
| **바쁜 대기 폴링** | 1개 | **낮음 (busy)** | 중간 |
| **이벤트 루프 (Selector)** | 1개(~코어 수) | 높음 | **높음** |

이 이벤트 루프 모델은 **Node.js, Netty, Redis, Nginx** 같은 고성능 서버의 공통된 뼈대다.

---

## 7. 정리

1. **메시지 전달 IPC 기반 클라이언트-서버**는 여러 주체가 동시에 통신하므로 동시성이 필수다.

2. 입출력 중심 코드는 **CPU가 I/O 완료를 기다리는 시간**이 길다. 이 대기 시간을 활용하는 것이 동시성의 핵심이다.

3. **블로킹**은 일을 다 마친 뒤 제어를 반환하고, **논블로킹**은 시작만 하고 즉시 반환한다. **I/O 비중이 클수록** 논블로킹의 이득이 크다.

4. OS 스레드는 **적은 수로 오래 도는 작업**에 적합하다. 컨텍스트 스위칭과 스택 메모리 탓에 연결마다 스레드를 붙이는 방식은 확장에 한계가 있다(C10K).

5. **바쁜 대기**는 논블로킹 연산으로 여러 클라이언트를 **단일 스레드**가 순회 처리해 스레드 비용을 아낀다. 다만 준비된 소켓이 없어도 CPU를 태우는 **폴링 낭비**가 있다.

6. 이 낭비는 **I/O 멀티플렉싱(select/poll/epoll)** 으로 해결한다. 준비된 채널만 커널이 통지하며, 자바에서는 **`Selector` 기반 이벤트 루프**로 구현한다.

| 개념 | 한 줄 요약 |
|:-----|:-----|
| **I/O 바운드** | 연산보다 입출력 대기가 지배적인 작업 |
| **블로킹** | 완료 후 제어 반환, 호출 스레드는 대기 |
| **논블로킹** | 즉시 제어 반환, 호출 스레드는 다른 일 수행 |
| **바쁜 대기** | 단일 스레드가 논블로킹으로 여러 연결을 순회 |
| **I/O 멀티플렉싱** | 준비된 fd만 커널이 통지 (select/poll/epoll) |
| **이벤트 루프** | 준비된 이벤트만 처리하는 단일 스레드 루프 |
