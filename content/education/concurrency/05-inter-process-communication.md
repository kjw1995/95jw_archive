---
title: "프로세스 간 통신"
weight: 5
---

프로세스는 운영체제에 의해 **서로 독립된 주소 공간**을 갖도록 격리된다. 격리는 안정성을 보장하지만, 동시에 "어떻게 데이터를 주고받을 것인가" 라는 문제를 만든다. 운영체제가 제공하는 **프로세스 간 통신**(IPC, Inter-Process Communication) 메커니즘은 이 문제를 해결하기 위한 도구 모음이다. 또한 다수의 작업을 효율적으로 처리하기 위해 워커 스레드를 묶어두는 **스레드 풀** 개념도 함께 살펴본다.

---

## 1. IPC가 필요한 이유

### 1.1 격리의 대가

운영체제는 한 프로세스가 다른 프로세스의 메모리를 함부로 읽거나 쓸 수 없도록 막는다. 이 격리 덕분에 한 프로세스가 죽어도 다른 프로세스가 영향을 받지 않지만, 정상적인 협업조차도 직접적인 메모리 공유로는 할 수 없다.

```
┌──────────────────────────────────────────────────────────────┐
│              왜 IPC가 필요한가                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                ┌──────────────┐           │
│  │ 프로세스 A    │  ✗ 직접 접근   │ 프로세스 B    │           │
│  │              │ ──────X─────── │              │           │
│  │ 주소 공간 A  │   운영체제가    │ 주소 공간 B  │           │
│  │              │   막는다       │              │           │
│  └──────┬───────┘                └──────┬───────┘           │
│         │                               │                   │
│         │       ┌──────────────┐        │                   │
│         └──────→│ 운영체제 IPC │←───────┘                   │
│                 │ 메커니즘      │                            │
│                 └──────────────┘                            │
│                                                              │
│  → 안전하게 데이터를 주고받으려면 운영체제의 중개가 필요하다     │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 IPC의 두 가지 큰 갈래

IPC는 본질적으로 두 부류로 나뉜다. 어느 쪽을 선택하느냐가 동기화 책임의 위치와 성능 특성을 결정한다.

| 갈래 | 대표 방식 | 데이터 위치 | 동기화 책임 |
|:-----|:---------|:-----------|:----------|
| **공유 메모리(Shared Memory)** | mmap, shm_open | 같은 물리 메모리 영역 | 사용자(개발자) |
| **메시지 전달(Message Passing)** | 파이프, 메시지 큐, 소켓 | 커널 버퍼 또는 네트워크 | 운영체제 |

```
공유 메모리          메시지 전달
─────────           ──────────
PROC A  PROC B      PROC A  PROC B
  │  │   │  │         │       │
  ▼  ▼   ▼  ▼         ▼       ▼
┌────────────┐      ┌─────────────┐
│ 같은 메모리 │      │ send/recv   │
│   영역     │      │ (커널 중개) │
└────────────┘      └─────────────┘
  빠름·동기화 필요    느림·동기화 안전
```

> **트레이드오프 한 줄 요약**: 공유 메모리는 *빠르지만 위험*하고, 메시지 전달은 *느리지만 안전*하다.

---

## 2. 공유 메모리 (Shared Memory)

### 2.1 동작 원리

두 프로세스가 같은 물리 메모리 영역을 자신의 가상 주소 공간에 **매핑**한다. 한 쪽이 메모리에 값을 쓰면 다른 쪽이 즉시 읽을 수 있다 — 커널을 거치지 않으므로 **IPC 중 가장 빠르다**.

```
┌──────────────────────────────────────────────────────────────┐
│                  공유 메모리 매핑                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   프로세스 A의 가상 주소 공간   프로세스 B의 가상 주소 공간     │
│   ┌──────────────────┐         ┌──────────────────┐         │
│   │ Code             │         │ Code             │         │
│   │ Data             │         │ Data             │         │
│   │ Heap             │         │ Heap             │         │
│   │ ┌─────────────┐  │         │ ┌─────────────┐  │         │
│   │ │ Shared Map  │──┼─────────┼→│ Shared Map  │  │         │
│   │ │ (0x7f...)   │  │   같은   │ │ (0x9b...)   │  │         │
│   │ └─────────────┘  │   물리   │ └─────────────┘  │         │
│   │ Stack            │   주소   │ Stack            │         │
│   └──────────────────┘         └──────────────────┘         │
│                                                              │
│   가상 주소는 달라도 같은 물리 페이지를 가리킨다              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 강점과 약점

| 강점 | 약점 |
|:-----|:-----|
| 커널 호출이 없어 가장 빠름 | **동기화는 전적으로 개발자 책임** |
| 대량 데이터(영상, 행렬 등) 전송에 유리 | 잘못 쓰면 경쟁 조건·데이터 오염 |
| 메모리에 직접 자료 구조 매핑 가능 | 동기화 도구(세마포어, 뮤텍스) 별도 필요 |

### 2.3 어디에 쓰이나

- **데이터베이스의 버퍼 풀**: PostgreSQL의 공유 버퍼는 여러 백엔드 프로세스가 같은 페이지 캐시를 공유한다.
- **GPU 워크로드**: 큰 텐서를 프로세스 간에 복사하지 않고 mmap으로 공유.
- **고성능 메시징**: LMAX Disruptor, Aeron 등 초저지연 시스템.
- **레디스(Redis) 자체**도 RDB 스냅샷 저장 시 `fork()` + COW로 공유 메모리 기반의 일시 격리를 활용한다.

### 2.4 Java 예제 - 메모리 매핑 파일

자바에서는 `MappedByteBuffer`로 파일을 메모리에 매핑해 여러 프로세스가 같은 파일을 공유할 수 있다.

```java
import java.io.RandomAccessFile;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;

public class SharedMemoryExample {

    public static void main(String[] args) throws Exception {
        // 같은 파일을 두 개의 JVM 프로세스가 매핑하면
        // 한쪽이 쓴 값을 다른 쪽이 즉시 읽을 수 있다.
        try (RandomAccessFile file = new RandomAccessFile("shared.dat", "rw");
             FileChannel channel = file.getChannel()) {

            MappedByteBuffer buf = channel.map(
                FileChannel.MapMode.READ_WRITE, 0, 1024);

            // 프로듀서: 카운터 증가
            int v = buf.getInt(0);
            buf.putInt(0, v + 1);
            buf.force();   // 디스크/다른 매핑에 가시화

            System.out.println("현재 카운터: " + buf.getInt(0));
        }
    }
}
```

{{< callout type="warning" >}}
공유 메모리만 매핑한다고 끝이 아니다. 두 프로세스가 동시에 같은 영역에 쓰는 순간 **데이터가 깨진다**. 실무에서는 반드시 파일 락(`FileLock`), POSIX 세마포어, 또는 atomic 연산을 함께 사용해 보호한다.
{{< /callout >}}

---

## 3. 파이프 (Pipe)

### 3.1 단방향 스트림

파이프는 한 프로세스의 출력을 다른 프로세스의 입력으로 흘려보내는 **단방향 바이트 스트림**이다. 운영체제가 커널 안에 작은 버퍼를 만들어 한쪽은 쓰기, 다른 쪽은 읽기 끝점을 사용한다.

```
┌──────────────────────────────────────────────────────────────┐
│              파이프 (Pipe)                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Producer            ┌──────────────┐           Consumer    │
│   ┌────────┐  write   │ 커널 버퍼     │   read   ┌────────┐  │
│   │ PROC A │ ───────→ │ FIFO         │ ──────→  │ PROC B │  │
│   │        │          │ (보통 64KB)  │          │        │  │
│   └────────┘          └──────────────┘          └────────┘  │
│                                                              │
│   특성:                                                      │
│   - 단방향 (양방향 통신은 파이프 2개 필요)                    │
│   - 버퍼가 가득 차면 writer는 블록                            │
│   - 버퍼가 비어 있으면 reader는 블록                          │
│   - 동기적 데이터 교환에 자연스러움                            │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 익명 파이프 vs 명명 파이프

| 구분 | 익명 파이프(Anonymous Pipe) | 명명 파이프(Named Pipe / FIFO) |
|:----|:---------------------------|:-------------------------------|
| 식별자 | 파일 디스크립터만 | 파일 시스템에 이름 존재 |
| 관계 | 보통 부모-자식 프로세스 | 무관한 프로세스 간 통신 |
| 생명 주기 | 프로세스 종료 시 사라짐 | 명시적으로 삭제할 때까지 유지 |
| 사용 예 | 셸 파이프라인 `cat \| grep` | 데몬과 클라이언트 사이의 채널 |

```bash
# 셸의 파이프라인은 익명 파이프
$ ps -ef | grep java | wc -l

# 명명 파이프 — 무관한 두 프로세스가 같은 이름을 통해 만남
$ mkfifo /tmp/mychan
$ echo "hello" > /tmp/mychan       # 터미널 1
$ cat /tmp/mychan                  # 터미널 2 → hello
```

### 3.3 Java 예제 - ProcessBuilder의 파이프

자바의 `ProcessBuilder`로 자식 프로세스를 띄우고 stdin/stdout 파이프로 통신할 수 있다.

```java
import java.io.*;

public class PipeExample {

    public static void main(String[] args) throws Exception {
        // 자식 프로세스를 띄우고 그 출력을 파이프로 받아온다
        ProcessBuilder pb = new ProcessBuilder("python3", "-c",
            "import sys; [print(line.upper(), end='') for line in sys.stdin]");
        pb.redirectErrorStream(true);

        Process child = pb.start();

        // 부모 → 자식 (stdin 파이프에 쓰기)
        try (BufferedWriter w = new BufferedWriter(
                new OutputStreamWriter(child.getOutputStream()))) {
            w.write("hello\n");
            w.write("world\n");
        }

        // 자식 → 부모 (stdout 파이프에서 읽기)
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(child.getInputStream()))) {
            r.lines().forEach(System.out::println);
        }

        child.waitFor();
    }
}
// 출력:
// HELLO
// WORLD
```

{{< callout type="info" >}}
**파이프 깨짐(SIGPIPE)** 은 흔한 함정이다. reader가 먼저 종료된 뒤 writer가 계속 쓰면 OS가 `SIGPIPE` 시그널을 보내 writer 프로세스를 죽인다. 셸에서 `yes | head` 가 정상 종료되는 이유다 — `head`가 충분히 읽고 닫는 순간 `yes`도 따라 죽는다.
{{< /callout >}}

---

## 4. 메시지 큐 (Message Queue)

### 4.1 비동기 메시지 전달

메시지 큐는 **이름 붙은 큐**에 메시지를 넣고 빼는 IPC 방식이다. 송신자와 수신자가 **동시에 살아있을 필요가 없다** — 메시지는 큐에 쌓여 기다린다. 이 비동기성이 시스템 구성 요소 간 **느슨한 결합**(loose coupling)을 가능하게 한다.

```
┌──────────────────────────────────────────────────────────────┐
│              메시지 큐                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Producer A ┐                              ┌→ Consumer X    │
│              │   ┌──────────────────┐       │                │
│   Producer B ┼──→│ [m1][m2][m3]...  │──────┼─→ Consumer Y    │
│              │   │ FIFO 메시지 큐    │       │                │
│   Producer C ┘   └──────────────────┘       └→ Consumer Z    │
│                                                              │
│   특성:                                                      │
│   - 비동기: 송신/수신 시점이 달라도 OK                         │
│   - 결합도 낮음: 양측이 서로의 존재를 몰라도 됨                │
│   - 우선순위 큐, 메시지 만료 등 부가 기능 제공                  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 파이프와의 차이

| 비교 | 파이프 | 메시지 큐 |
|:----|:------|:---------|
| 단위 | 바이트 스트림 | **메시지(레코드) 단위** |
| 동기성 | 보통 동기적 | **비동기** |
| 관계 | 보통 1:1 | **N:M 가능** |
| 결합 | 양측이 살아있어야 함 | 송신자/수신자 분리 가능 |

### 4.3 어디에 쓰이나

- **OS 레벨**: POSIX 메시지 큐(`mq_open`), System V 메시지 큐
- **애플리케이션 레벨 브로커**: Kafka, RabbitMQ, AWS SQS, Redis Streams
- **자바 내 메시지 큐**: `BlockingQueue`(같은 JVM 내 스레드 간)

### 4.4 Java 예제 - BlockingQueue

스레드 간 메시지 큐의 자바 표준 구현이다. 외부 IPC 큐를 흉내내기에 좋은 모델이다.

```java
import java.util.concurrent.*;

public class MessageQueueExample {

    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<String> queue = new ArrayBlockingQueue<>(10);

        // 생산자
        Thread producer = new Thread(() -> {
            try {
                for (int i = 1; i <= 5; i++) {
                    String msg = "order-" + i;
                    queue.put(msg);            // 가득 차면 블록
                    System.out.println("send → " + msg);
                    Thread.sleep(100);
                }
                queue.put("__END__");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "producer");

        // 소비자
        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    String msg = queue.take();  // 비어 있으면 블록
                    if ("__END__".equals(msg)) break;
                    System.out.println("recv ← " + msg);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "consumer");

        producer.start();
        consumer.start();
        producer.join();
        consumer.join();
    }
}
```

---

## 5. 소켓 (Socket)

### 5.1 네트워크를 넘나드는 IPC

소켓은 **양방향**이고 **네트워크를 경유할 수 있는** 유일한 IPC 메커니즘이다. 같은 머신의 두 프로세스든, 지구 반대편의 서버든 동일한 API로 통신한다. 그만큼 분산 시스템의 사실상 표준으로 자리잡았다.

```
┌──────────────────────────────────────────────────────────────┐
│              소켓                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   동일 머신                                                   │
│   ┌────────┐  127.0.0.1:6379  ┌────────┐                    │
│   │ PROC A │ ←──────────────→ │ PROC B │                    │
│   └────────┘                  └────────┘                    │
│                                                              │
│   네트워크 경유                                                │
│   ┌────────┐    TCP/IP     ┌────────────┐                   │
│   │ Client │ ←─── 인터넷 ──→ │   Server   │                  │
│   └────────┘                └────────────┘                  │
│                                                              │
│   - 양방향 통신                                                │
│   - 같은 API로 로컬 / 원격 모두 처리                            │
│   - 종류: TCP(스트림), UDP(데이터그램), Unix Domain(로컬 전용) │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 종류별 특성

| 종류 | 신뢰성 | 순서 보장 | 용도 |
|:----|:------|:--------|:-----|
| **TCP 스트림 소켓** | 보장 | 보장 | 웹, DB, 메시지 큐 등 대부분 |
| **UDP 데이터그램 소켓** | 없음 | 없음 | DNS, 비디오 스트림, 게임 |
| **유닉스 도메인 소켓** | 보장 | 보장 | 같은 호스트 IPC, 빠름 |

### 5.3 Java 예제 - TCP 에코 서버/클라이언트

```java
// ── 서버 ────────────────────────────────────────
import java.io.*;
import java.net.*;

public class EchoServer {
    public static void main(String[] args) throws IOException {
        try (ServerSocket server = new ServerSocket(9000)) {
            System.out.println("listening on 9000");
            try (Socket client = server.accept();
                 BufferedReader in = new BufferedReader(
                     new InputStreamReader(client.getInputStream()));
                 PrintWriter out = new PrintWriter(
                     client.getOutputStream(), true)) {

                String line;
                while ((line = in.readLine()) != null) {
                    out.println("echo: " + line);
                }
            }
        }
    }
}

// ── 클라이언트 ─────────────────────────────────
public class EchoClient {
    public static void main(String[] args) throws IOException {
        try (Socket s = new Socket("127.0.0.1", 9000);
             PrintWriter out = new PrintWriter(s.getOutputStream(), true);
             BufferedReader in = new BufferedReader(
                 new InputStreamReader(s.getInputStream()))) {

            out.println("hello");
            System.out.println(in.readLine());  // echo: hello
        }
    }
}
```

{{< callout type="info" >}}
같은 머신 안의 IPC라면 **유닉스 도메인 소켓**이 TCP 루프백보다 빠르고 가볍다. 도커 데몬, Nginx ↔ PHP-FPM, PostgreSQL의 로컬 접속 등이 이를 활용한다. 클라우드에서 `unix:///var/run/...` 로 시작하는 경로를 보면 그게 바로 유닉스 도메인 소켓이다.
{{< /callout >}}

---

## 6. IPC 방식 종합 비교

### 6.1 비교표

| 방식 | 속도 | 데이터 양 | 동기/비동기 | 네트워크 경유 | 동기화 책임 | 대표 사례 |
|:----|:----|:--------|:----------|:----------|:----------|:--------|
| **공유 메모리** | ★★★★★ | 대량 OK | 동기 | ✗ | 개발자 | PostgreSQL 버퍼 풀 |
| **파이프** | ★★★ | 스트림 | 동기 | ✗ | OS | 셸 파이프라인 |
| **명명 파이프** | ★★★ | 스트림 | 동기 | △(소켓 흉내) | OS | 데몬 ↔ CLI |
| **메시지 큐** | ★★ | 메시지 | 비동기 | ✗ | OS | 작업 큐 |
| **소켓 (TCP)** | ★★ | 스트림 | 양쪽 가능 | ✓ | OS | 웹, 마이크로서비스 |
| **유닉스 도메인 소켓** | ★★★★ | 스트림 | 양쪽 가능 | ✗ | OS | 로컬 데몬 통신 |

### 6.2 선택 가이드

```
┌──────────────────────────────────────────────────────────────┐
│              IPC 방식 선택 흐름                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   네트워크를 넘어야 하나?                                       │
│      │                                                       │
│      ├─ 예 ─→ 소켓 (TCP/UDP)                                │
│      │                                                       │
│      └─ 아니오 ─→ 대량 데이터를 자주 주고받나?                 │
│                       │                                       │
│                       ├─ 예 ─→ 공유 메모리                    │
│                       │                                       │
│                       └─ 아니오 ─→ 비동기로 분리하고 싶나?     │
│                                       │                       │
│                                       ├─ 예 ─→ 메시지 큐      │
│                                       │                       │
│                                       └─ 아니오 ─→ 파이프 /   │
│                                                  유닉스 소켓   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

> 책의 관찰: **편의성, 확장성, 성능을 종합했을 때 소켓이 가장 무난한 선택**이다. 그래서 마이크로서비스 시대의 사실상 기본값이 됐다.

---

## 7. 스레드 풀 (Thread Pool)

### 7.1 매번 스레드를 만드는 비용

스레드 생성/소멸도 공짜가 아니다. 새 스레드를 만들 때마다 OS 호출, 스택 할당(보통 512KB~1MB), 스케줄러 등록이 일어난다. 작업이 많고 빠르게 끝날수록 **생성 자체가 작업보다 비싸지는** 역전 현상이 생긴다.

```
요청이 1초에 1000개 들어오면…
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  매번 new Thread()                  Thread Pool              │
│  ─────────────────                  ───────────              │
│                                                              │
│  요청 → [생성][실행][소멸]          요청 ──┐                  │
│  요청 → [생성][실행][소멸]          요청 ──┼→ ┌──────────┐   │
│  요청 → [생성][실행][소멸]          요청 ──┘  │ Worker  │   │
│  요청 → [생성][실행][소멸]                    │  Pool   │   │
│                                              │ (재사용) │   │
│  스레드 수 폭발 → OOM 위험            ─────→  └──────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 스레드 풀의 구성

> **스레드 풀**은 프로그램의 주 스레드가 맡긴 작업을 대신 처리해주는 워커 스레드의 집합이다. 워커 스레드는 작업 완료나 실패에도 영향을 받지 않고 유지되며 재사용된다.

```
┌──────────────────────────────────────────────────────────────┐
│              스레드 풀의 동작                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              submit(task)                                    │
│   Main ──────────────────→ ┌─────────────────────┐          │
│   Thread                   │ Task Queue          │          │
│                            │ [T1][T2][T3]...     │          │
│                            └──────────┬──────────┘          │
│                                       │ take()              │
│              ┌────────────────────────┼────────────┐        │
│              ▼              ▼         ▼            ▼        │
│         ┌───────┐      ┌───────┐ ┌───────┐    ┌───────┐    │
│         │Worker1│      │Worker2│ │Worker3│    │WorkerN│    │
│         └───────┘      └───────┘ └───────┘    └───────┘    │
│              │             │         │            │         │
│              └─────────────┴─────────┴────────────┘         │
│                  작업 완료 후 다음 task로                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 스레드 풀의 이점

| 이점 | 설명 |
|:-----|:-----|
| **자원 통제** | 동시 실행 스레드 수를 상한으로 제한 — OOM·스케줄링 폭주 방지 |
| **재사용** | 스레드 생성/소멸 비용 제거 |
| **버퍼링** | 큐가 일시적 트래픽 스파이크 흡수 |
| **단순한 모델** | 호출자는 "작업을 던지면 끝" |

### 7.4 Java 예제 - ExecutorService

자바 표준 라이브러리의 `ExecutorService`가 사실상의 스레드 풀이다.

```java
import java.util.concurrent.*;
import java.util.stream.*;

public class ThreadPoolExample {

    public static void main(String[] args) throws Exception {
        // 고정 4개의 워커 스레드
        ExecutorService pool = Executors.newFixedThreadPool(4);

        // 10개의 작업 제출 → 4개씩 병렬 처리
        var futures = IntStream.rangeClosed(1, 10)
            .mapToObj(i -> pool.submit(() -> {
                String name = Thread.currentThread().getName();
                Thread.sleep(500);
                return String.format("task-%d on %s", i, name);
            }))
            .toList();

        for (var f : futures) {
            System.out.println(f.get());
        }

        pool.shutdown();
    }
}
// 출력 (4개 워커가 번갈아 처리):
// task-1 on pool-1-thread-1
// task-2 on pool-1-thread-2
// task-3 on pool-1-thread-3
// task-4 on pool-1-thread-4
// task-5 on pool-1-thread-1   ← 재사용
// ...
```

### 7.5 풀 크기는 어떻게 정하나

| 작업 종류 | 권장 풀 크기 | 이유 |
|:---------|:------------|:-----|
| **CPU 바운드** (계산 위주) | `코어 수` 또는 `코어 수 + 1` | 모든 코어를 채우는 게 목표 |
| **I/O 바운드** (DB/네트워크 대기) | `코어 수 × (1 + 대기시간/작업시간)` | 대기 중인 스레드를 보충 |

```java
int cores = Runtime.getRuntime().availableProcessors();

// CPU 바운드: 8코어 → 8 ~ 9
ExecutorService cpuPool = Executors.newFixedThreadPool(cores);

// I/O 바운드: 평균 80% 대기라면 8 × (1 + 4) = 40
ExecutorService ioPool = Executors.newFixedThreadPool(cores * 5);
```

{{< callout type="warning" >}}
`Executors.newCachedThreadPool()`은 큐 없이 무제한으로 스레드를 만들 수 있어 부하 스파이크에 매우 위험하다. 실무에서는 `ThreadPoolExecutor`를 직접 생성해 `corePoolSize`, `maximumPoolSize`, `BlockingQueue` 크기, `RejectedExecutionHandler`를 명시적으로 지정하자.
{{< /callout >}}

### 7.6 Java 21 — Virtual Thread와의 관계

Java 21의 **가상 스레드(Virtual Thread)** 가 등장하면서 "I/O 바운드 작업에 큰 스레드 풀을 만들어야 한다"는 전제가 흔들렸다. 가상 스레드는 가볍기 때문에 수십만 개를 동시에 띄워도 OK이며, OS 스레드는 가상 스레드를 운반하는 **캐리어**로만 작동한다. 즉, "I/O 바운드는 가상 스레드, CPU 바운드는 기존 스레드 풀" 이라는 새로운 분업이 자리잡고 있다.

```java
// Java 21+
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        exec.submit(() -> {
            // 블로킹 I/O — OS 스레드를 점유하지 않음
            httpClient.send(request, BodyHandlers.ofString());
        });
    }
}
```

---

## 8. 정리

### 핵심 요약

```
┌──────────────────────────────────────────────────────────────┐
│              IPC + Thread Pool 한눈에 보기                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   IPC = 격리된 프로세스가 협업하기 위한 도구                    │
│   ├── 공유 메모리: 가장 빠름, 동기화는 내 책임                  │
│   ├── 파이프: 단방향 스트림, 동기적                            │
│   ├── 메시지 큐: 비동기, 느슨한 결합                          │
│   └── 소켓: 양방향, 네트워크 가능 — 사실상의 표준              │
│                                                              │
│   스레드 풀 = 작업을 워커에 위임해 스레드 비용을 통제          │
│   ├── 생성/소멸 비용 제거                                     │
│   ├── 동시 실행 수 상한으로 자원 보호                          │
│   └── CPU/I/O 바운드에 따라 풀 크기 다르게                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 한 줄 정리

| 개념 | 한 줄 |
|:-----|:------|
| **공유 메모리** | "직접 접근, 빠르지만 내가 동기화한다" |
| **파이프** | "한 쪽이 쓰면 다른 쪽이 읽는 스트림" |
| **메시지 큐** | "큐에 던져두면 나중에 누군가 가져간다" |
| **소켓** | "주소만 알면 어디든 닿는 양방향 채널" |
| **스레드 풀** | "워커를 만들어두고 작업만 던진다" |

{{< callout type="info" >}}
**핵심 정리:**
1. **IPC**는 격리된 프로세스가 서로 협업하기 위한 운영체제 차원의 도구다
2. **공유 메모리**는 가장 빠르지만 동기화 부담을 개발자가 진다
3. **파이프**는 단방향 동기 스트림, **메시지 큐**는 비동기 메시지 단위, **소켓**은 양방향이며 네트워크를 넘는다
4. 마이크로서비스 시대의 사실상 기본 IPC는 **소켓**(HTTP/gRPC)이다
5. **스레드 풀**은 스레드 생성 비용을 제거하고 동시 실행 수를 상한으로 통제하는 패턴이다
6. 작업이 **CPU 바운드냐 I/O 바운드냐**에 따라 풀 크기 산정 공식이 다르며, Java 21의 가상 스레드는 I/O 바운드의 풀 크기 고민을 크게 줄여준다
{{< /callout >}}

---

## 참고 자료

- "Grokking Concurrency" by Kirill Bobrov, Chapter 5
- "Operating System Concepts" by Silberschatz, IPC 챕터
- Java Concurrency in Practice — ExecutorService, Thread Pool 튜닝
