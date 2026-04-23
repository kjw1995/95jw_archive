---
title: "Chapter 13. 쓰레드 (Thread)"
weight: 13
---

프로세스와 쓰레드의 차이, 쓰레드 생성·제어·동기화, `wait/notify`의 원리, `java.util.concurrent` 기반의 모던 동시성 도구를 다룬다.

---

## 1. 프로세스와 쓰레드

### 1.1 기본 개념

프로세스는 실행 중인 프로그램이고, 쓰레드는 그 프로세스 안에서 실제 작업을 수행하는 실행 흐름이다. 모든 프로세스는 최소 하나의 쓰레드(main)를 가진다.

| 용어 | 설명 |
|:---|:---|
| 프로세스 | 메모리를 할당받아 실행 중인 프로그램 |
| 쓰레드 | 프로세스 내에서 작업을 수행하는 실행 단위 |
| 멀티쓰레드 프로세스 | 둘 이상의 쓰레드를 가진 프로세스 |

```
┌──────────────────────────────┐
│         프로세스              │
│ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ T1   │ │ T2   │ │ T3   │  │
│ │stack │ │stack │ │stack │  │
│ └──────┘ └──────┘ └──────┘  │
│  공유: Heap / Code / Data    │
└──────────────────────────────┘
```

각 쓰레드는 **독립적인 호출 스택(stack)** 을 가지지만, 힙(Heap)과 정적 영역은 같은 프로세스의 모든 쓰레드가 공유한다. 이 공유 때문에 동기화가 필요해진다.

### 1.2 멀티태스킹과 멀티쓰레딩

```
멀티태스킹 (프로세스 단위)
┌──────┐ ┌──────┐ ┌──────┐
│ P1   │ │ P2   │ │ P3   │
└──┬───┘ └──┬───┘ └──┬───┘
   ▼        ▼        ▼
────────── CPU ──────────

멀티쓰레딩 (프로세스 내부)
┌──────────────────────┐
│ ┌────┐ ┌────┐ ┌────┐ │
│ │ T1 │ │ T2 │ │ T3 │ │
│ └────┘ └────┘ └────┘ │
└──────────────────────┘
```

### 1.3 멀티쓰레딩의 장단점

**장점**

- CPU 사용률 향상 (I/O 대기 시간 활용)
- 자원의 효율적 사용
- 사용자 응답성 향상
- 작업 단위 분리로 코드 모듈화

**단점**

- 공유 자원 동기화 문제
- 교착상태(Deadlock) 가능성
- 디버깅 난이도 상승
- 컨텍스트 스위칭 오버헤드

{{< callout type="info" >}}
**경량 프로세스(LWP):** 쓰레드는 프로세스보다 생성·전환 비용이 훨씬 적다. 같은 메모리 공간을 공유하므로 컨텍스트 스위칭 시 교체할 정보가 적기 때문이다.
{{< /callout >}}

---

## 2. 쓰레드의 구현과 실행

### 2.1 구현 방법 비교

| 방법 | 장점 | 단점 |
|:---|:---|:---|
| `Thread` 상속 | 간결, Thread 메서드 직접 접근 | 다른 클래스 상속 불가 |
| `Runnable` 구현 | 다른 클래스 상속 가능, 재사용성 | `Thread.currentThread()` 필요 |

{{< callout type="info" >}}
**Runnable 구현을 권장한다.** Java는 단일 상속만 허용하므로 `Thread`를 상속하면 도메인 로직용 상속 슬롯을 잃는다. 또한 `Runnable`은 **작업(task)** 을 정의하는 추상화여서, 같은 작업을 `Thread`, `ExecutorService`, `CompletableFuture`에 모두 전달할 수 있다.
{{< /callout >}}

### 2.2 Thread 클래스 상속

```java
class MyThread extends Thread {
    @Override
    public void run() {
        for (int i = 0; i < 5; i++) {
            System.out.println(getName() + ": " + i);
        }
    }
}

MyThread t = new MyThread();
t.start();
```

### 2.3 Runnable 인터페이스 구현

```java
class MyRunnable implements Runnable {
    @Override
    public void run() {
        String name = Thread.currentThread().getName();
        for (int i = 0; i < 5; i++) {
            System.out.println(name + ": " + i);
        }
    }
}

Thread t = new Thread(new MyRunnable());
t.start();

// 람다 사용
Thread t2 = new Thread(() -> System.out.println("Lambda"));
t2.start();
```

{{< callout type="warning" >}}
**`start()`는 한 번만 호출할 수 있다.** 이미 실행한 쓰레드에 다시 `start()`를 호출하면 `IllegalThreadStateException`이 발생한다. 같은 작업을 재실행하려면 Runnable만 재사용하고 Thread 인스턴스는 새로 생성해야 한다.
{{< /callout >}}

---

## 3. start()와 run()의 차이

`run()`을 직접 호출하면 일반 메서드 호출일 뿐 새 쓰레드가 생기지 않는다. 반드시 `start()`를 호출해야 JVM이 **새 호출 스택을 할당**하고 해당 스택에서 `run()`을 실행한다.

```
run() 직접 호출         start() 호출
┌─────────┐            ┌─────────┐┌─────────┐
│  run()  │            │  main   ││  run()  │
├─────────┤            ├─────────┤├─────────┤
│  main   │            │ (종료)  ││ (실행)  │
└─────────┘            └─────────┘└─────────┘
 단일 스택               main 스택  새 쓰레드 스택
```

```java
class MyThread extends Thread {
    @Override
    public void run() { throw new RuntimeException(); }
}

MyThread t = new MyThread();
t.run();   // main 스택에서 실행 → 스택트레이스에 main() 포함
t = new MyThread();
t.start(); // 새 스택에서 실행 → 스택트레이스에 main() 없음
```

{{< callout type="info" >}}
**프로그램 종료 조건:** JVM은 실행 중인 **사용자 쓰레드(non-daemon)** 가 하나도 없을 때 종료된다. main 메서드가 끝나도 자식 쓰레드가 살아 있으면 JVM은 종료되지 않는다.
{{< /callout >}}

---

## 4. 싱글쓰레드와 멀티쓰레드

### 4.1 성능 비교

```java
Thread t1 = new Thread(() -> {
    for (int i = 0; i < 300; i++) System.out.print("-");
});
Thread t2 = new Thread(() -> {
    for (int i = 0; i < 300; i++) System.out.print("|");
});

long start = System.currentTimeMillis();
t1.start(); t2.start();
t1.join();  t2.join();   // 두 쓰레드 종료까지 대기
System.out.println("\n멀티 소요: "
        + (System.currentTimeMillis() - start) + "ms");
```

### 4.2 컨텍스트 스위칭

```
싱글 코어에서의 CPU 분배
T1: ████    ████    ████
T2:     ████    ████
    ↑CS  ↑CS  ↑CS  ↑CS

교체되는 정보:
  - 프로그램 카운터(PC)
  - 레지스터
  - 스택 포인터
```

### 4.3 언제 멀티쓰레드가 유리한가

| 상황 | 권장 |
|:---|:---|
| CPU 연산만 (싱글 코어) | 싱글 쓰레드 |
| CPU 연산만 (멀티 코어) | 멀티 쓰레드 |
| I/O 작업(파일, 네트워크) | 멀티 쓰레드 |
| 사용자 입력 대기 | 멀티 쓰레드 |

{{< callout type="info" >}}
**병행(Concurrent) vs 병렬(Parallel):** 병행은 여러 작업이 번갈아 진행되는 것, 병렬은 실제로 동시에 실행되는 것이다. 싱글 코어에서는 병행만 가능하고, 멀티 코어에서는 병렬도 가능하다.
{{< /callout >}}

---

## 5. 쓰레드의 우선순위

```java
Thread.MIN_PRIORITY  = 1
Thread.NORM_PRIORITY = 5   // 기본값
Thread.MAX_PRIORITY  = 10

t.setPriority(Thread.MAX_PRIORITY);  // start() 전에 호출
```

{{< callout type="warning" >}}
**우선순위는 스케줄러에 대한 힌트일 뿐이다.** OS는 이 값을 무시할 수 있으며, 멀티코어에서는 차이가 거의 드러나지 않는다. 확실한 실행 순서가 필요하면 `wait/notify`, `CountDownLatch`, `CompletableFuture` 등 **조정(coordination) 도구**를 사용해야 한다.
{{< /callout >}}

---

## 6. 쓰레드 그룹 (Thread Group)

쓰레드 그룹은 관련 쓰레드를 묶어 일괄 제어하기 위한 장치다. 쓰레드 그룹을 지정하지 않으면 생성한 쓰레드와 같은 그룹에 속한다.

```java
ThreadGroup myGroup = new ThreadGroup("MyGroup");
myGroup.setMaxPriority(7);

Thread t = new Thread(myGroup, () -> { /* ... */ }, "T1");
t.start();

System.out.println("활성 쓰레드: " + myGroup.activeCount());
myGroup.interrupt();   // 그룹 전체 인터럽트
```

{{< callout type="info" >}}
실무에서는 `ThreadGroup` 대신 `ExecutorService`로 쓰레드 묶음을 관리하는 것이 일반적이다. 수명 주기 제어, 예외 처리, 작업 큐 관리가 모두 통합되어 있다.
{{< /callout >}}

---

## 7. 데몬 쓰레드 (Daemon Thread)

데몬 쓰레드는 사용자 쓰레드의 **보조 역할**을 한다. 모든 사용자 쓰레드가 종료되면 JVM이 자동으로 데몬 쓰레드를 종료하고 프로그램을 끝낸다. GC, 화면 갱신, 자동 저장 등이 대표적인 예다.

```java
Thread daemon = new Thread(() -> {
    while (true) {
        // 백그라운드 작업
        try { Thread.sleep(1000); }
        catch (InterruptedException e) { break; }
    }
});
daemon.setDaemon(true);  // start() 전에 호출
daemon.start();
```

{{< callout type="warning" >}}
**`setDaemon()`은 `start()` 이전에만 호출할 수 있다.** 이미 실행 중인 쓰레드에 호출하면 `IllegalThreadStateException`이 발생한다. 또한 데몬 쓰레드는 언제든 강제 종료될 수 있으므로, 파일 쓰기 같은 **원자성이 필요한 작업**을 데몬에서 수행하면 안 된다.
{{< /callout >}}

---

## 8. 쓰레드의 실행 제어

### 8.1 쓰레드의 상태

`Thread.State`는 쓰레드의 현재 상태를 6가지로 구분한다.

| 상태 | 설명 |
|:---|:---|
| NEW | 생성됨, `start()` 전 |
| RUNNABLE | 실행 중 또는 실행 대기 |
| BLOCKED | 모니터 락 획득 대기 |
| WAITING | `wait()`, `join()`으로 무기한 대기 |
| TIMED_WAITING | `sleep()`, `wait(t)` 등 시간 대기 |
| TERMINATED | 종료 |

```
        start()
NEW ───────────▶ RUNNABLE ◀──────┐
                   │  ▲          │
                   │  │ notify() │
          sleep()  │  │ 시간만료  │
          wait()   │  │          │
          join()   ▼  │          │
          ┌────────────────────┐ │
          │ WAITING / BLOCKED  │─┘
          │ TIMED_WAITING      │
          └─────────┬──────────┘
                    │ run() 종료
                    ▼
               TERMINATED
```

### 8.2 sleep() — 일정 시간 대기

```java
try {
    Thread.sleep(1000);  // 1초 대기
} catch (InterruptedException e) {
    // 대기 중 인터럽트되면 예외 발생
}
```

{{< callout type="warning" >}}
**`sleep()`은 static 메서드다.** `t.sleep(1000)`으로 작성해도 `t`가 아닌 **현재 실행 중인 쓰레드**가 잠든다. 혼동을 피하려면 항상 `Thread.sleep(...)` 형태로 호출하라.
{{< /callout >}}

### 8.3 interrupt() — 작업 취소 요청

`interrupt()`는 쓰레드를 **즉시 종료시키지 않는다.** 단지 "중단해달라"는 플래그를 세워주며, 실제 종료 여부는 쓰레드 자신이 `isInterrupted()`로 확인하고 결정한다.

```java
Thread download = new Thread(() -> {
    try {
        for (int i = 0; i < 100; i++) {
            if (Thread.currentThread().isInterrupted()) {
                System.out.println("취소됨");
                return;
            }
            Thread.sleep(100);
        }
    } catch (InterruptedException e) {
        // sleep() 중 interrupt() 호출 시
    }
});
download.start();
Thread.sleep(500);
download.interrupt();
```

### 8.4 join() — 다른 쓰레드 대기

```java
Thread calc = new Thread(() -> { /* ... */ });
calc.start();
calc.join();            // calc 종료까지 대기
calc.join(3000);        // 최대 3초만 대기
```

### 8.5 yield() — 실행 양보

`yield()`는 현재 쓰레드가 실행 기회를 양보하겠다고 스케줄러에 알리는 힌트일 뿐이다. OS가 무시할 수 있으므로 정확한 제어에는 적합하지 않다.

### 8.6 deprecated된 메서드: suspend/resume/stop

`suspend()`, `resume()`, `stop()`은 락을 들고 있는 상태에서 쓰레드를 멈출 수 있어 교착상태를 유발한다. **대안은 `volatile` 플래그 + `interrupt()` 조합**이다.

```java
class SafeWorker implements Runnable {
    private volatile boolean running = true;

    public void run() {
        while (running && !Thread.currentThread().isInterrupted()) {
            // 작업 수행
        }
    }
    public void stop() { running = false; }
}
```

{{< callout type="info" >}}
**가시성(visibility)과 `volatile`:** 멀티쓰레드 환경에서는 한 쓰레드의 변경사항이 다른 쓰레드에 즉시 보이지 않을 수 있다. CPU 캐시와 JIT 최적화 때문이다. `volatile`을 붙이면 해당 변수의 읽기/쓰기가 **항상 메인 메모리**에서 일어나므로 다른 쓰레드가 변경을 곧바로 본다. 단, `volatile`은 원자성(atomicity)은 보장하지 않으므로 `count++` 같은 복합 연산에는 적합하지 않다.
{{< /callout >}}

---

## 9. 쓰레드의 동기화

### 9.1 동기화가 필요한 이유

여러 쓰레드가 공유 자원을 동시에 수정하면 **경쟁 상태(race condition)** 가 발생한다. `count++`은 "읽기 → 더하기 → 쓰기" 세 단계로 쪼개지므로, 두 쓰레드가 같은 값을 읽고 같은 결과를 쓸 수 있다.

```java
class Counter {
    private int count = 0;
    public void increment() { count++; }  // 원자적이지 않음
}

// 20000번 증가해도 실제 값은 그보다 작을 수 있음
```

### 9.2 synchronized — 모니터 락

Java의 모든 객체는 **모니터(monitor)** 라 불리는 락을 하나씩 가진다. `synchronized`는 이 락을 획득·해제하는 메커니즘이다.

```java
// 메서드 전체 동기화 — this의 락을 사용
public synchronized void increment() { count++; }

// 블록 동기화 — 임의의 객체 락 사용 (권장)
private final Object lock = new Object();
public void increment() {
    synchronized (lock) {
        count++;
    }
}
```

```
쓰레드 A            쓰레드 B
   │                   │
   │ lock 획득          │ lock 대기 (BLOCKED)
   │                   │
   │ 임계 영역 실행      │
   │                   │
   │ lock 해제          │
   │                   │ lock 획득
   │                   │ 임계 영역 실행
```

{{< callout type="warning" >}}
**임계 영역은 최소화하라.** `synchronized` 범위가 넓을수록 병렬성이 떨어진다. I/O나 `Thread.sleep()` 같은 블로킹 작업은 절대 synchronized 블록 안에서 호출하지 말아야 한다. 락을 쥔 채로 블로킹되면 다른 쓰레드가 전부 기다려야 한다.
{{< /callout >}}

### 9.3 wait() / notify()

특정 조건이 충족될 때까지 대기하고, 조건 충족 시 알림을 받는 메커니즘이다. `Object` 클래스의 메서드이며 **반드시 해당 객체의 synchronized 블록 안**에서만 호출할 수 있다.

```java
class SharedBuffer {
    private int data;
    private boolean hasData = false;

    public synchronized void produce(int value)
            throws InterruptedException {
        while (hasData) wait();   // 조건 체크는 반드시 while
        data = value;
        hasData = true;
        notifyAll();
    }

    public synchronized int consume()
            throws InterruptedException {
        while (!hasData) wait();
        hasData = false;
        notifyAll();
        return data;
    }
}
```

```
wait() 호출 시 동작
1. 현재 쓰레드가 객체의 락을 해제한다
2. 쓰레드는 해당 객체의 대기 풀(wait set)에 등록
3. notify()/notifyAll() 호출 시 깨어남
4. 락을 다시 획득한 후에만 실행 재개
```

{{< callout type="warning" >}}
**조건 체크는 `if`가 아닌 `while`로 해야 한다.** `notify()` 후 재획득한 락 아래에서 조건이 다시 거짓일 수 있기 때문이다(spurious wakeup 포함). 또한 `notify()`는 대기 쓰레드 중 하나만 깨우므로, 여러 종류의 대기가 섞여 있다면 `notifyAll()`이 안전하다.
{{< /callout >}}

### 9.4 교착상태(Deadlock)

두 쓰레드가 서로 상대방의 락을 기다리며 영원히 멈추는 상태다.

```
T1: lock A → lock B 대기
T2: lock B → lock A 대기
    → 서로 영원히 대기
```

**예방 원칙:**

1. **락 획득 순서를 전역적으로 통일한다** (A → B는 모두가 같은 순서).
2. **락 보유 시간을 최소화한다.**
3. **`tryLock(timeout)`을 사용해 실패 시 롤백한다.**
4. **`synchronized` 중첩을 피한다.**

---

## 10. Lock과 Condition

`synchronized`보다 유연한 동기화가 필요할 때 `java.util.concurrent.locks` 패키지를 사용한다.

### 10.1 ReentrantLock

```java
import java.util.concurrent.locks.ReentrantLock;

private final ReentrantLock lock = new ReentrantLock();

public void increment() {
    lock.lock();
    try {
        count++;
    } finally {
        lock.unlock();  // 반드시 finally에서 해제
    }
}
```

### 10.2 tryLock — 블로킹 없는 락 획득

```java
if (lock.tryLock(1, TimeUnit.SECONDS)) {
    try { /* 임계 영역 */ }
    finally { lock.unlock(); }
} else {
    // 타임아웃 — 다른 경로로 처리
}
```

### 10.3 Condition — 조건별 대기

`Condition`은 하나의 락에 대해 **여러 대기 큐**를 만들 수 있게 해준다. 생산자와 소비자가 서로 다른 조건에서 대기하므로 불필요하게 깨어나는 일이 줄어든다.

```java
private final Lock lock = new ReentrantLock();
private final Condition notFull = lock.newCondition();
private final Condition notEmpty = lock.newCondition();

public void put(T item) throws InterruptedException {
    lock.lock();
    try {
        while (queue.size() == capacity) notFull.await();
        queue.add(item);
        notEmpty.signal();      // 소비자만 깨움
    } finally { lock.unlock(); }
}
```

### 10.4 Lock 종류 비교

| Lock | 특징 |
|:---|:---|
| `ReentrantLock` | 가장 일반적인 배타 락 |
| `ReentrantReadWriteLock` | 읽기는 공유, 쓰기는 배타 |
| `StampedLock` | 낙관적 읽기 지원 (Java 8+) |

---

## 11. Fork/Join 프레임워크

작업을 작은 단위로 분할(fork)하여 병렬 처리한 뒤 결과를 합치는(join) 프레임워크다. Java 7에 도입되었으며 `ForkJoinPool`이 내부적으로 **작업 훔치기(work stealing)** 로 부하를 분산한다.

```
        [큰 작업]
           │
  ┌────────┼────────┐
  ▼        ▼        ▼
[작업1]  [작업2]  [작업3]
  ▼        ▼        ▼
[결과1]  [결과2]  [결과3]
  └────────┼────────┘
           ▼
       [최종 결과]
```

```java
class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 1000;
    private final long[] array;
    private final int start, end;

    public SumTask(long[] a, int s, int e) {
        this.array = a; this.start = s; this.end = e;
    }

    @Override
    protected Long compute() {
        if (end - start <= THRESHOLD) {
            long sum = 0;
            for (int i = start; i < end; i++) sum += array[i];
            return sum;
        }
        int mid = (start + end) / 2;
        SumTask left = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);
        left.fork();                 // 비동기 실행
        long r = right.compute();    // 직접 계산
        return left.join() + r;
    }
}
```

| 클래스 | 반환값 | 용도 |
|:---|:---|:---|
| `RecursiveTask<V>` | 있음 | 합계·집계 |
| `RecursiveAction` | 없음 | 정렬·변환 |

---

## 12. java.util.concurrent — 모던 동시성

{{< callout type="info" >}}
**순수 `Thread`·`synchronized`는 저수준 도구다.** 실무에서는 `java.util.concurrent`(JUC) 패키지의 **쓰레드 풀, 동시성 컬렉션, 동기화 유틸**을 사용하는 것이 표준이다. 쓰레드 관리, 예외 처리, 작업 큐가 모두 통합되어 있으며, 원자 연산·락-프리 자료구조 등 고성능 도구도 제공된다.
{{< /callout >}}

### 12.1 쓰레드 풀 — ExecutorService

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
for (int i = 0; i < 10; i++) {
    final int id = i;
    pool.submit(() -> System.out.println("Task " + id));
}
pool.shutdown();
pool.awaitTermination(60, TimeUnit.SECONDS);
```

### 12.2 Callable과 Future

`Runnable`은 반환값이 없지만 `Callable<V>`는 **값을 반환**하며 체크 예외도 던질 수 있다.

```java
Callable<Integer> task = () -> {
    Thread.sleep(2000);
    return 42;
};
Future<Integer> future = pool.submit(task);
Integer result = future.get();  // 블로킹 대기
```

### 12.3 CompletableFuture — 비동기 조합

`CompletableFuture`는 비동기 작업을 선언적으로 조합할 수 있게 해준다. `get()`으로 블로킹하지 않고 콜백 체이닝으로 결과를 처리한다.

```java
CompletableFuture
    .supplyAsync(() -> "Hello")
    .thenApply(s -> s + " World")
    .thenApply(String::toUpperCase)
    .thenAccept(System.out::println);  // "HELLO WORLD"
```

### 12.4 주요 동기화 유틸

| 클래스 | 용도 |
|:---|:---|
| `CountDownLatch` | N개 작업 완료까지 대기 (1회성) |
| `CyclicBarrier` | N개 쓰레드가 한 지점에 모일 때까지 대기 |
| `Semaphore` | 동시 접근 허용 개수 제한 |
| `ConcurrentHashMap` | 락-프리 동시성 맵 |
| `AtomicInteger` | CAS 기반 원자 연산 |

---

## 13. 요약

### 핵심 메서드

| 메서드 | 설명 |
|:---|:---|
| `start()` | 새 호출 스택 할당 + `run()` 실행 |
| `join()` | 대상 쓰레드 종료까지 대기 |
| `sleep(ms)` | 현재 쓰레드 시간 대기 |
| `interrupt()` | 중단 요청 플래그 설정 |
| `wait()` / `notify()` | 모니터 기반 조건 대기/알림 |

### 동기화 방법 비교

| 방법 | 특징 |
|:---|:---|
| `synchronized` | 간단, 자동 해제, JVM 내장 |
| `ReentrantLock` | `tryLock`, 공정성, 인터럽트 가능 |
| `Condition` | 한 락에 여러 대기 큐 |
| JUC 유틸 | 쓰레드 풀·동시성 컬렉션·원자 변수 |

{{< callout type="info" >}}
**핵심 원칙**

- 공유 자원은 반드시 동기화 — 가시성과 원자성 둘 다 고려
- `synchronized` 범위는 최소화, I/O는 락 바깥에서
- `wait/notify`는 항상 `while` 조건 체크
- 실무 코드는 `Thread` 직접 생성보다 `ExecutorService` 권장
- 교착상태 예방은 **락 순서 통일**이 최우선
{{< /callout >}}
