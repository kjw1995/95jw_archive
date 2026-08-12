---
title: "이벤트 기반 동시성"
date: 2026-07-30
weight: 11
---

10장의 논블로킹 I/O와 이벤트 루프를 하나의 **아키텍처 스타일**로 끌어올린 것이 **이벤트 기반 동시성(event-driven concurrency)** 이다. 스레드를 늘리는 대신 "일이 생겼을 때만 반응"하도록 설계해, 단일 스레드로 수천~수만 개의 연결을 적은 메모리로 처리한다. 이 장에서는 그 토대가 되는 **동기·비동기 통신**의 차이, 이벤트 기반 시스템의 **구성 요소**, 그리고 가장 널리 쓰이는 구현 패턴인 **리액터 패턴(reactor pattern)** 을 살펴본다.

---

## 1. 이벤트 기반 동시성이란

> **이벤트 기반 동시성**이란 작업을 미리 스레드에 할당해 두는 대신, **이벤트가 발생했을 때만** 등록된 처리 코드를 실행하는 방식이다.

10장에서 본 것처럼 "연결 하나에 스레드 하나"는 커넥션 수가 커지면 무너진다(C10K). 이벤트 기반 모델은 이 문제를 **접근 방식 자체를 바꿔서** 푼다. 연결마다 스레드를 두는 대신, 연결마다 **상태와 콜백만** 남기고 실행은 하나의 루프가 담당한다.

```
스레드 기반 (연결 = 스레드)
 C1─[T1]  C2─[T2]  C3─[T3]
 연결 1만 개 → 스레드 1만 개
 스택 메모리 수 GB, 전환 비용 폭증

이벤트 기반 (연결 = 상태 + 콜백)
 C1┐
 C2┼─▶[이벤트 루프]─▶콜백 실행
 C3┘  단일 스레드
 연결 1만 개 → 스레드 1개
```

| 구분 | 스레드 기반 | 이벤트 기반 |
|:-----|:-----|:-----|
| 동시성 단위 | OS 스레드 | 이벤트 + 콜백 |
| 연결당 비용 | 스택 수백 KB~1MB | 소켓 상태 수 KB |
| 문맥 전환 | OS가 수행(비쌈) | 없음(같은 스레드) |
| 대기 처리 | 스레드를 멈춤 | 다른 이벤트 처리 |
| 코드 흐름 | 위에서 아래로 직관적 | 콜백으로 쪼개짐 |
| 잘 맞는 작업 | CPU 바운드, 소수 장기 작업 | **I/O 바운드, 다수 연결** |

{{< callout type="info" >}}
이벤트 기반 모델의 이득은 **연산을 빨리 하는 데** 있지 않고 **기다림을 없애는 데** 있다. 그래서 I/O 바운드 애플리케이션(웹 서버, 프록시, 채팅, 게이트웨이)에서 극적인 효과가 나고, CPU 바운드 작업에는 오히려 불리하다 — 코어를 더 쓰는 병렬화가 답이다.
{{< /callout >}}

---

## 2. 동기 통신과 비동기 통신

이벤트 기반 동시성을 이해하려면 먼저 두 작업이 **어떻게 정보를 주고받는지**를 구분해야 한다.

### 2.1 동기 통신

> **동기(synchronous) 통신**은 정상적인 결과를 얻기 위해 **특정한 순서로** 실행해야 하는 작업들 사이에서 일어난다. 송신 측과 수신 측이 **모두 준비된 상태**에서 동시에 데이터를 교환하며, 교환이 끝날 때까지 프로그램의 진행이 **차단된다**.

핵심은 두 가지다. 첫째, **순서에 의존**한다 — B는 A의 결과가 있어야 시작할 수 있다. 둘째, 교환하는 동안 **시스템 자원이 다른 일을 하지 못한다**.

```
동기 통신
──────────────────────────
요청자 ─────▶ 처리자
   ⏸ 블로킹    (처리 중)
요청자 ◀───── 결과
   대기 동안 아무 일도 못 함
```

```java
// 동기: 결과가 올 때까지 이 스레드는 멈춰 있다
String user = userApi.find(id);       // 200ms 대기
String order = orderApi.find(user);   // 앞 결과 필요 → 또 300ms 대기
render(user, order);                  // 총 500ms, 그동안 CPU는 유휴
```

### 2.2 비동기 통신

> **비동기(asynchronous) 통신**은 요청하는 측에서 시작하지만 **완료를 기다리지 않고** 작업을 재개하는 통신이다. 송신 측과 수신 측이 **동기화할 필요가 없으므로**, 수신 측이 준비될 때까지 송신 측이 블로킹되지 않는다.

애플리케이션은 원하는 시점에 **이벤트 발생 여부를 확인**하고, 작업의 **시작 시점과 완료 시점은 동기화되지 않는다**. 동기 통신에서 상대를 기다리느라 낭비되던 시간을 **다른 작업에 쓸 수 있다**는 것이 이 방식의 전부다.

```
비동기 통신
──────────────────────────
요청자 ─────▶ 처리자
   ▼ 다른 일 수행 (처리 중)
요청자 ◀─통지─ 완료 이벤트
   대기 시간을 일에 사용
```

```java
// 비동기: 요청만 걸어 두고 곧바로 다음 일을 한다
userApi.findAsync(id, user -> {       // 완료되면 이 콜백이 실행
    orderApi.findAsync(user, order -> render(user, order));
});
doSomethingElse();                    // 응답을 기다리지 않고 즉시 진행
```

### 2.3 동기 vs 비동기 비교

| 구분 | 동기 통신 | 비동기 통신 |
|:-----|:-----|:-----|
| 실행 순서 | 정해진 순서로 실행 | 순서 제약 없음 |
| 양쪽 준비 | 송·수신 모두 준비돼야 교환 | 준비 상태 무관 |
| 진행 차단 | 교환 동안 차단됨 | 차단되지 않음 |
| 완료 확인 | 반환값으로 즉시 확인 | 이벤트·콜백으로 통지 |
| 자원 활용 | 대기 시간 낭비 | 대기 시간 재사용 |
| 코드 난이도 | 낮음 | 높음(흐름이 쪼개짐) |

{{< callout type="warning" >}}
**동기/비동기와 블로킹/논블로킹은 다른 축이다.** [10장](../10-nonblocking-io)에서 정리했듯 블로킹/논블로킹은 *제어를 언제 돌려주는가*, 동기/비동기는 *완료를 어떻게 알게 되는가*의 문제다. 이벤트 기반 동시성은 **논블로킹 연산 + 비동기 통지**를 함께 쓰는 조합이다 — 호출은 즉시 반환하고(논블로킹), 완료는 이벤트로 통지받는다(비동기).
{{< /callout >}}

---

## 3. 이벤트 기반 시스템의 구성 요소

이벤트 기반 시스템은 다음 조각들로 이루어진다. 이름은 프레임워크마다 다르지만 역할은 같다.

```
 소켓·타이머·시그널 (이벤트 소스)
          │ 이벤트 발생
          ▼
┌──────────────────────────┐
│   이벤트 디멀티플렉서    │
│   (select/epoll/kqueue)  │
└────────────┬─────────────┘
             │ 준비된 것만 통지
             ▼
┌──────────────────────────┐
│   이벤트 루프·디스패처   │
└────────────┬─────────────┘
             │ 이벤트 → 짝지어진 콜백
             ▼
┌──────────────────────────┐
│  핸들러 A   B   C (콜백) │
└──────────────────────────┘
```

| 구성 요소 | 역할 |
|:-----|:-----|
| **이벤트** | "무슨 일이 생겼다"는 사실 (연결 도착, 읽기 가능) |
| **이벤트 소스** | 이벤트를 만들어 내는 주체 (소켓, 파일, 타이머) |
| **이벤트 디멀티플렉서** | 여러 소스를 한꺼번에 감시하다 준비된 것만 통지 |
| **이벤트 큐** | 발생한 이벤트를 순서대로 보관 |
| **이벤트 루프** | 큐에서 이벤트를 꺼내 도는 무한 루프 |
| **디스패처** | 이벤트를 알맞은 핸들러에 배정 |
| **핸들러(콜백)** | 이벤트별 실제 처리 코드 |

{{< callout type="info" >}}
**디멀티플렉서(demultiplexer)** 라는 이름은 신호 처리에서 왔다. 여러 입력선을 하나로 모으는 것이 멀티플렉싱이라면, 그 하나를 다시 원래의 여러 갈래로 되돌리는 것이 디멀티플렉싱이다. 여기서는 "여러 소켓을 한 번의 `select()` 호출로 감시하고, 준비된 소켓을 각자의 핸들러로 되돌려 보낸다"는 뜻이다.
{{< /callout >}}

---

## 4. 리액터 패턴

> **리액터 패턴(reactor pattern)** 은 **단일 스레드로 동작하는 이벤트 루프**와 **논블로킹 이벤트**로 구성되며, 발생한 이벤트의 처리를 **적합한 콜백에 맡기는** 형태로 동작한다.

입출력 중심 애플리케이션에서 이벤트 기반 동시성을 구현할 때 가장 널리 쓰이는 패턴이다. 이름 그대로 스스로 일을 찾아 나서지 않고 **들어온 이벤트에 반응(react)** 만 한다.

### 4.1 동작 흐름

```
① 핸들러 등록
   채널 + 관심 이벤트 + 콜백
       ▼
② select()
   준비된 이벤트 생길 때까지 대기
       ▼
③ 이벤트 수신
   준비된 채널 목록을 받음
       ▼
④ 디스패치
   각 이벤트를 짝 콜백에 위임
       ▼
⑤ 콜백 실행
   짧고 논블로킹하게 처리
       └──▶ ②로 복귀 (무한 반복)
```

{{< callout type="info" >}}
③에서 ⑤까지가 **한 바퀴(tick)** 다. 리액터의 성능은 "한 바퀴를 얼마나 빨리 도느냐"로 결정되며, 이는 곧 **모든 콜백이 짧아야 한다**는 제약으로 이어진다(4.3절).
{{< /callout >}}

### 4.2 Java NIO로 구현한 리액터

`Selector`가 디멀티플렉서, `run()`의 무한 루프가 이벤트 루프, `SelectionKey`의 **attachment**가 이벤트와 핸들러를 이어 주는 고리다.

```java
// 리액터 — 이벤트 루프 + 디스패처
public class Reactor implements Runnable {
    private final Selector selector;
    private final ServerSocketChannel server;

    public Reactor(int port) throws IOException {
        selector = Selector.open();
        server = ServerSocketChannel.open();
        server.bind(new InetSocketAddress(port));
        server.configureBlocking(false);

        // 관심 이벤트(OP_ACCEPT)에 핸들러를 붙여 둔다
        SelectionKey key =
            server.register(selector, SelectionKey.OP_ACCEPT);
        key.attach(new Acceptor(selector, server));
    }

    @Override
    public void run() {                  // ② ~ ⑤ 무한 반복
        try {
            while (!Thread.interrupted()) {
                selector.select();       // ② 이벤트 생길 때까지 대기
                Set<SelectionKey> keys = selector.selectedKeys();
                for (SelectionKey k : keys) {
                    dispatch(k);         // ④ 콜백에 위임
                }
                keys.clear();            // 처리한 이벤트 비우기
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void dispatch(SelectionKey k) {
        Runnable handler = (Runnable) k.attachment();
        if (handler != null) {
            handler.run();               // ⑤ 콜백 실행
        }
    }
}
```

```java
// 연결 수락 핸들러 — 새 연결마다 읽기 핸들러를 등록한다
class Acceptor implements Runnable {
    private final Selector selector;
    private final ServerSocketChannel server;

    Acceptor(Selector selector, ServerSocketChannel server) {
        this.selector = selector;
        this.server = server;
    }

    @Override
    public void run() {
        try {
            SocketChannel client = server.accept();
            if (client != null) {
                new EchoHandler(selector, client);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
```

```java
// 읽기/쓰기 핸들러 — 연결 하나의 상태를 들고 있는다
class EchoHandler implements Runnable {
    private final SocketChannel channel;
    private final SelectionKey key;
    private final ByteBuffer buf = ByteBuffer.allocate(1024);

    EchoHandler(Selector selector, SocketChannel channel)
            throws IOException {
        this.channel = channel;
        channel.configureBlocking(false);
        this.key = channel.register(selector, SelectionKey.OP_READ);
        key.attach(this);                // 이벤트 ↔ 콜백 연결
        selector.wakeup();               // 대기 중인 select()를 깨움
    }

    @Override
    public void run() {
        try {
            buf.clear();
            int n = channel.read(buf);
            if (n == -1) {
                key.cancel();
                channel.close();         // 연결 종료
            } else if (n > 0) {
                buf.flip();
                channel.write(buf);      // 받은 그대로 되돌려줌
            }
        } catch (IOException e) {
            key.cancel();
        }
    }
}
```

{{< callout type="info" >}}
**연결 상태는 스레드가 아니라 객체가 들고 있다.** 스레드 기반 서버에서는 "어디까지 읽었는가"가 스레드의 **스택**에 자연스럽게 남는다. 이벤트 기반에서는 콜백이 매번 반환되므로 스택이 사라진다. 그래서 진행 상태를 `EchoHandler`의 **필드**에 명시적으로 보관해야 한다. 이것이 이벤트 기반 코드가 스레드 기반보다 까다로운 근본 이유다.
{{< /callout >}}

### 4.3 리액터의 절대 규칙 — 콜백은 블로킹하면 안 된다

리액터는 **모든 콜백을 같은 스레드에서** 실행한다. 콜백 하나가 멈추면 **이벤트 루프 전체가 멈추고**, 그 순간 서버의 모든 연결이 응답을 잃는다.

```
정상 — 콜백이 짧다
루프 │▪▪▪│▪▪▪│▪▪▪│▪▪▪│  촘촘히 처리

블로킹 — 콜백 하나가 3초를 잡음
루프 │▪▪▪│■■■■■■■■■■■│▪▪▪│
              ▲
      이 구간 모든 연결이 멈춤
```

| 하면 안 되는 것 | 대신 이렇게 |
|:-----|:-----|
| 블로킹 DB 드라이버 호출 | 논블로킹(R2DBC) 또는 워커 풀에 위임 |
| `Thread.sleep()`, 동기 `read()` | 타이머 이벤트, 논블로킹 채널 |
| 무거운 CPU 연산(암호화, 압축) | 별도 스레드 풀로 오프로딩 |
| 콜백 안에서 락 대기 | 락 없는 자료구조, 단일 스레드 소유 |

{{< callout type="warning" >}}
**이벤트 루프 블로킹은 이벤트 기반 서버에서 가장 흔한 장애 원인이다.** 스레드 기반 서버에서 느린 쿼리 하나는 그 요청 하나만 느리게 만들지만, 이벤트 기반에서는 **서버 전체를 정지**시킨다. Node.js에서 동기 `fs.readFileSync()`를 요청 경로에 쓰거나, WebFlux에서 블로킹 JDBC를 그대로 호출하는 것이 대표적인 사고 사례다.
{{< /callout >}}

---

## 5. 프로액터 패턴 — 준비 통지 vs 완료 통지

리액터와 자주 짝지어 언급되는 것이 **프로액터 패턴(proactor pattern)** 이다. 둘의 차이는 **커널이 무엇을 통지하느냐**에 있다.

```
리액터 — "이제 읽을 수 있다"
 커널 ─준비 통지─▶ 콜백
 콜백이 직접 read() 수행

프로액터 — "다 읽어 놨다"
 커널이 미리 버퍼까지 채움
 커널 ─완료 통지─▶ 콜백
 콜백은 결과만 사용
```

| 구분 | 리액터 | 프로액터 |
|:-----|:-----|:-----|
| 통지 시점 | I/O **준비** 완료 | I/O **수행** 완료 |
| 실제 read/write | 콜백이 직접 수행 | 커널·런타임이 대신 수행 |
| 기반 기술 | select, poll, epoll, kqueue | IOCP, io_uring, POSIX AIO |
| 자바 API | `Selector` (NIO) | `AsynchronousChannel` (NIO.2) |
| 구현 난이도 | 상대적으로 단순 | 버퍼 수명 관리가 까다로움 |

```java
// 프로액터 방식 — 읽기가 "끝난 뒤" 콜백이 불린다
AsynchronousSocketChannel ch = ...;
ByteBuffer buf = ByteBuffer.allocate(1024);

ch.read(buf, null, new CompletionHandler<Integer, Void>() {
    @Override
    public void completed(Integer bytes, Void attach) {
        buf.flip();                  // 이미 데이터가 채워져 있다
        handle(buf);
    }
    @Override
    public void failed(Throwable t, Void attach) {
        log.error("읽기 실패", t);
    }
});
// read() 호출은 즉시 반환 — 완료는 커널이 알려준다
```

{{< callout type="info" >}}
리눅스는 오랫동안 제대로 된 완료 기반 I/O가 없어 `epoll` 기반 **리액터**가 사실상 표준이 되었다. 자바의 `AsynchronousChannel`도 리눅스에서는 내부적으로 스레드 풀 + `epoll`로 프로액터를 흉내 낸다. 반면 윈도의 **IOCP**는 처음부터 완료 기반이라 프로액터가 자연스럽다. 최근 리눅스의 **io_uring**이 진짜 완료 기반 인터페이스를 제공하면서 이 구도가 바뀌고 있다.
{{< /callout >}}

---

## 6. 멀티 리액터 — 단일 스레드의 한계를 넘기

리액터는 단일 스레드가 원칙이지만, 그러면 **코어 하나만** 쓰게 된다. 실무 프레임워크는 리액터를 여러 개 두어 코어를 모두 활용한다.

```
      클라이언트 연결들
            │
     ┌──────▼──────┐
     │ 메인 리액터 │ accept 전담
     └──────┬──────┘
     ┌──────┼──────┐
     ▼      ▼      ▼
  [서브1] [서브2] [서브3]  read/write
   코어1   코어2   코어3
     └──────┼──────┘
            ▼
      워커 스레드 풀
    (블로킹·CPU 작업 격리)
```

| 계층 | 스레드 수 | 담당 |
|:-----|:-----|:-----|
| 메인 리액터 | 1개 | 연결 수락(accept)만 |
| 서브 리액터 | 코어 수만큼 | 각자 맡은 연결의 read/write |
| 워커 풀 | 별도 | 블로킹·CPU 바운드 작업 |

{{< callout type="info" >}}
Netty의 `bossGroup`(메인 리액터)과 `workerGroup`(서브 리액터)이 정확히 이 구조다. 핵심 원칙은 **한 연결은 언제나 같은 서브 리액터 스레드가 처리한다**는 것 — 그래서 연결 상태를 다루는 코드에는 락이 필요 없다. 동기화 비용([8장](../08-race-conditions-and-synchronization))을 아예 없애 버리는 설계다.
{{< /callout >}}

---

## 7. 콜백 지옥과 그 해법

이벤트 기반 코드의 대가는 **가독성**이다. 순차적으로 읽히던 코드가 콜백 단위로 쪼개지고, 의존하는 작업이 이어지면 중첩이 깊어진다.

```java
// 콜백 지옥 — 흐름이 오른쪽으로 계속 밀린다
findUser(id, user -> {
    findOrders(user, orders -> {
        findItems(orders, items -> {
            calcPrice(items, price -> {
                render(price);           // 에러 처리는 어디에?
            });
        });
    });
});
```

해법은 **콜백을 값으로 다루는 것**이다. 자바에서는 `CompletableFuture`가 이 역할을 맡는다.

```java
// CompletableFuture — 중첩을 평평한 파이프라인으로
findUserAsync(id)
    .thenCompose(user -> findOrdersAsync(user))
    .thenCompose(orders -> findItemsAsync(orders))
    .thenCompose(items -> calcPriceAsync(items))
    .thenAccept(price -> render(price))
    .exceptionally(e -> {                // 에러 처리를 한곳에
        log.error("조회 실패", e);
        return null;
    });
```

| 세대 | 방식 | 특징 |
|:-----|:-----|:-----|
| 1세대 | 콜백 | 가장 단순, 중첩·에러 처리 취약 |
| 2세대 | Future·Promise | 결과를 값으로 다뤄 중첩 완화 |
| 3세대 | 리액티브 스트림 | 스트림 + 배압(backpressure) 지원 |
| 4세대 | 코루틴·async/await | 비동기를 동기처럼 읽히게 작성 |
| 4세대 | 가상 스레드 | 블로킹 코드를 그대로 쓰되 값싸게 |

{{< callout type="info" >}}
**자바 21의 가상 스레드(virtual thread)** 는 이 문제를 다른 방향에서 푼다. 이벤트 루프로 코드를 비틀지 않고, **스레드 자체를 싸게 만들어** 블로킹 스타일 코드를 그대로 쓰게 한다. 블로킹 호출이 일어나면 런타임이 캐리어 스레드에서 가상 스레드를 걷어내므로, 겉보기엔 동기 코드지만 내부 동작은 이벤트 기반에 가깝다. "읽기 쉬운 코드 + 높은 동시성"을 함께 얻는 접근이다.
{{< /callout >}}

---

## 8. 실전에서의 이벤트 기반 시스템

| 시스템 | 구조 | 비고 |
|:-----|:-----|:-----|
| **Node.js** | libuv 이벤트 루프 + 콜백 | I/O는 논블로킹, CPU 작업은 취약 |
| **Nginx** | 워커 프로세스마다 이벤트 루프 | 코어 수만큼 워커 배치 |
| **Redis** | 단일 스레드 이벤트 루프 | 락이 없어 명령이 원자적 |
| **Netty** | 메인·서브 리액터 + 워커 풀 | 자바 비동기 서버의 사실상 표준 |
| **Spring WebFlux** | Netty 위의 리액티브 스택 | 블로킹 드라이버 혼용 시 위험 |

{{< callout type="warning" >}}
**이벤트 기반이 항상 빠른 것은 아니다.** 연결 수가 적고 요청마다 무거운 연산을 하는 서비스라면, 스레드 기반 + 스레드 풀이 더 단순하고 더 빠르다. 이벤트 기반의 이점은 **연결이 많고 각 연결이 대부분 기다리는** 상황에서 나온다. 구조를 고르기 전에 워크로드가 I/O 바운드인지부터 확인해야 한다.
{{< /callout >}}

---

## 9. 정리

```
 이벤트 기반 동시성 한눈에 보기
 ──────────────────────────────
 왜?  스레드 = 비싸다 (C10K)
      연결마다 상태+콜백만 남긴다

 무엇으로?
  논블로킹 연산 + 비동기 통지
   ├ 동기 : 순서 의존, 진행 차단
   └ 비동기: 완료를 이벤트로 통지

 어떻게?  리액터 패턴
  디멀티플렉서 → 이벤트 루프
   → 디스패치 → 콜백

 대가는?
   콜백으로 흐름이 쪼개짐
   콜백 하나 막히면 전체 정지
```

### 한 줄 정리

| 개념 | 한 줄 |
|:-----|:------|
| **이벤트 기반 동시성** | "일이 생겼을 때만 반응, 연결 수천 개를 적은 메모리로" |
| **동기 통신** | "정해진 순서로, 양쪽이 준비돼야, 그동안 멈춘 채" |
| **비동기 통신** | "완료를 안 기다리고 진행, 끝나면 이벤트로 통지" |
| **이벤트 디멀티플렉서** | "여러 소스를 한 번에 감시해 준비된 것만 통지" |
| **이벤트 루프** | "이벤트를 꺼내 콜백에 넘기는 단일 스레드 무한 루프" |
| **리액터 패턴** | "단일 스레드 이벤트 루프 + 논블로킹 + 콜백 위임" |
| **프로액터 패턴** | "준비가 아니라 완료를 통지받는다" |
| **멀티 리액터** | "메인은 accept, 서브는 read/write, 워커는 블로킹 작업" |
| **콜백 지옥** | "중첩된 콜백 → Future·코루틴·가상 스레드로 편다" |

{{< callout type="info" >}}
**핵심 정리:**
1. **이벤트 기반 동시성**은 연결마다 스레드를 두는 대신 **상태와 콜백**만 남겨, 수천 이상의 연결을 훨씬 적은 메모리로 처리한다 — I/O 부하가 큰 애플리케이션에 적합하다
2. **동기 통신**은 정해진 순서로 양쪽이 준비된 상태에서 교환하며 그동안 진행이 **차단**되고, **비동기 통신**은 완료를 기다리지 않고 진행한 뒤 **이벤트로 통지**받아 대기 시간을 다른 일에 쓴다
3. **리액터 패턴**은 **단일 스레드 이벤트 루프 + 논블로킹 이벤트**로 구성되며, 발생한 이벤트를 **적합한 콜백에 위임**한다 — 자바에서는 `Selector` + `SelectionKey` attachment로 구현한다
4. 리액터의 절대 규칙은 **콜백이 블로킹하지 않는 것**이다. 콜백 하나가 멈추면 그 순간 서버의 모든 연결이 멈춘다
5. **프로액터**는 준비가 아니라 **완료**를 통지받는 방식이고(IOCP·io_uring), **멀티 리액터**는 서브 리액터를 코어 수만큼 두어 단일 스레드의 한계를 넘는다
6. 대가는 **쪼개진 코드 흐름**이며, `CompletableFuture`·리액티브 스트림·코루틴·**가상 스레드**가 이를 완화한다
{{< /callout >}}

---

## 참고 자료

- "Grokking Concurrency" by Kirill Bobrov, Chapter 11 — Event-Based Concurrency
- Douglas C. Schmidt (1995) — "Reactor: An Object Behavioral Pattern for Demultiplexing and Dispatching Handles for Synchronous Events"
- "Pattern-Oriented Software Architecture, Volume 2" — Reactor·Proactor 패턴 원전
- Java Platform: `java.nio.channels.Selector`, `SelectionKey`, `AsynchronousSocketChannel`, `java.util.concurrent.CompletableFuture`
- Netty in Action — 메인·서브 리액터(bossGroup·workerGroup) 구조
- JEP 444: Virtual Threads — 블로킹 스타일로 쓰는 고동시성 접근
