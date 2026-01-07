---
title: "Chapter 13. 쓰레드 (Thread)"
weight: 13
---

# 쓰레드 (Thread)

멀티쓰레드 프로그래밍을 통해 동시에 여러 작업을 효율적으로 처리할 수 있다.

---

## 1. 프로세스와 쓰레드

### 1.1 기본 개념

- **프로세스(Process)**: 실행 중인 프로그램. OS로부터 메모리를 할당받아 실행
- **쓰레드(Thread)**: 프로세스 내에서 실제로 작업을 수행하는 주체

```
프로세스 = 자원(메모리, CPU 등) + 쓰레드

┌─────────────────────────────────┐
│           프로세스               │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │쓰레드│ │쓰레드│ │쓰레드│ ...  │
│  └─────┘ └─────┘ └─────┘       │
│        공유 자원 (힙, 메서드 영역) │
└─────────────────────────────────┘
```

모든 프로세스에는 최소 하나 이상의 쓰레드가 존재하며, 둘 이상의 쓰레드를 가진 프로세스를 **멀티쓰레드 프로세스**라고 한다.

### 1.2 멀티태스킹 vs 멀티쓰레딩

| 구분 | 멀티태스킹 | 멀티쓰레딩 |
|:----|:---------|:---------|
| 대상 | 여러 프로세스 | 하나의 프로세스 내 여러 쓰레드 |
| 자원 | 독립적 | 공유 |
| 전환 비용 | 높음 | 낮음 |

### 1.3 멀티쓰레딩의 장단점

**장점**

- CPU 사용률 향상
- 자원의 효율적 사용
- 사용자 응답성 향상
- 작업 분리로 코드 간결화

**단점**

- **동기화(synchronization)** 문제 발생 가능
- **교착상태(deadlock)** 위험

{{< callout type="info" >}}
**교착상태(Deadlock)**: 두 쓰레드가 서로 상대방이 점유한 자원을 기다리느라 진행이 멈춘 상태
{{< /callout >}}

---

## 2. 쓰레드의 구현과 실행

### 2.1 구현 방법

쓰레드를 구현하는 두 가지 방법이 있다.

#### 방법 1: Thread 클래스 상속

```java
class MyThread extends Thread {
    @Override
    public void run() {
        // 쓰레드가 수행할 작업
        for (int i = 0; i < 5; i++) {
            System.out.println(getName() + ": " + i);
        }
    }
}

// 사용
MyThread t = new MyThread();
t.start();
```

#### 방법 2: Runnable 인터페이스 구현 (권장)

```java
class MyRunnable implements Runnable {
    @Override
    public void run() {
        // 쓰레드가 수행할 작업
        for (int i = 0; i < 5; i++) {
            System.out.println(Thread.currentThread().getName() + ": " + i);
        }
    }
}

// 사용
Runnable r = new MyRunnable();
Thread t = new Thread(r);
t.start();

// 람다식 사용 (Java 8+)
Thread t2 = new Thread(() -> {
    System.out.println("람다로 구현한 쓰레드");
});
t2.start();
```

{{< callout type="warning" >}}
**Runnable 인터페이스 구현을 권장하는 이유**
- Java는 단일 상속만 가능하므로 Thread를 상속하면 다른 클래스 상속 불가
- 인터페이스 구현은 더 유연한 설계 가능
{{< /callout >}}

### 2.2 두 방식의 차이

```java
// Thread 상속: 직접 메서드 호출 가능
class ThreadEx extends Thread {
    public void run() {
        System.out.println(getName());  // 직접 호출
    }
}

// Runnable 구현: Thread.currentThread() 필요
class RunnableEx implements Runnable {
    public void run() {
        System.out.println(Thread.currentThread().getName());  // 간접 호출
    }
}
```

---

## 3. start()와 run()

### 3.1 차이점

```java
public class StartVsRun {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            System.out.println("쓰레드: " + Thread.currentThread().getName());
        });

        // run() 직접 호출 - 새 쓰레드 생성 X, main 쓰레드에서 실행
        t.run();   // 출력: 쓰레드: main

        // start() 호출 - 새 쓰레드 생성 O, 별도 호출 스택에서 실행
        t.start(); // 출력: 쓰레드: Thread-0
    }
}
```

| 구분 | run() | start() |
|:----|:------|:--------|
| 호출 스택 | 현재 쓰레드 사용 | 새 호출 스택 생성 |
| 쓰레드 생성 | X | O |
| 동시 실행 | X | O |

### 3.2 쓰레드 생명주기

```
┌─────────┐    start()    ┌──────────┐
│   NEW   │ ───────────>  │ RUNNABLE │ <────────┐
└─────────┘               └────┬─────┘          │
                               │                │
                     실행(CPU 획득)             │
                               │                │
                               ▼                │
                         ┌──────────┐           │
                         │ RUNNING  │ ──────────┤ yield() / 시간 만료
                         └────┬─────┘           │
                               │                │
           ┌───────────────────┼────────────────┘
           │                   │
     sleep(), wait()      작업 완료/stop()
     join(), I/O block         │
           │                   │
           ▼                   ▼
    ┌────────────────┐   ┌────────────┐
    │ WAITING/BLOCKED │   │ TERMINATED │
    └────────────────┘   └────────────┘
```

### 3.3 main 쓰레드

```java
public class MainThreadExample {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                System.out.println("작업 쓰레드: " + i);
                try { Thread.sleep(500); } catch (InterruptedException e) {}
            }
        });
        t.start();

        System.out.println("main 종료");
        // main 종료 후에도 작업 쓰레드는 계속 실행됨
    }
}
// 출력:
// main 종료
// 작업 쓰레드: 0
// 작업 쓰레드: 1
// ...
```

{{< callout type="info" >}}
**실행 중인 사용자 쓰레드가 하나도 없을 때 프로그램은 종료된다.**
{{< /callout >}}

---

## 4. 싱글쓰레드 vs 멀티쓰레드

### 4.1 성능 비교

```java
public class SingleVsMultiThread {
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();

        // 싱글 쓰레드
        for (int i = 0; i < 500; i++) {
            System.out.printf("%s", "-");
        }
        for (int i = 0; i < 500; i++) {
            System.out.printf("%s", "|");
        }

        System.out.println("\n싱글 쓰레드 소요시간: " +
            (System.currentTimeMillis() - startTime) + "ms");
    }
}
```

```java
public class MultiThreadExample {
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 500; i++) {
                System.out.printf("%s", "-");
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 500; i++) {
                System.out.printf("%s", "|");
            }
        });

        t1.start();
        t2.start();

        try {
            t1.join();
            t2.join();
        } catch (InterruptedException e) {}

        System.out.println("\n멀티 쓰레드 소요시간: " +
            (System.currentTimeMillis() - startTime) + "ms");
    }
}
```

### 4.2 언제 멀티쓰레드를 사용해야 하는가?

| 상황 | 권장 |
|:----|:-----|
| 단순 CPU 연산 작업 | 싱글 쓰레드 |
| I/O 작업이 포함된 경우 | 멀티 쓰레드 |
| 사용자 입력 대기 + 다른 작업 | 멀티 쓰레드 |
| 독립적인 여러 작업 동시 수행 | 멀티 쓰레드 |

{{< callout type="info" >}}
**컨텍스트 스위칭(Context Switching)**: 쓰레드 간 작업 전환 시 현재 상태를 저장하고 다음 쓰레드 상태를 복원하는 과정. 오버헤드가 발생한다.
{{< /callout >}}

---

## 5. 쓰레드의 우선순위

### 5.1 우선순위 설정

```java
void setPriority(int newPriority)  // 우선순위 설정 (1~10)
int getPriority()                   // 우선순위 반환

// 상수
Thread.MIN_PRIORITY   = 1
Thread.NORM_PRIORITY  = 5  // 기본값
Thread.MAX_PRIORITY   = 10
```

### 5.2 우선순위 예제

```java
public class PriorityExample {
    public static void main(String[] args) {
        Thread high = new Thread(() -> {
            for (int i = 0; i < 100; i++) {
                System.out.print("H");
            }
        });

        Thread low = new Thread(() -> {
            for (int i = 0; i < 100; i++) {
                System.out.print("L");
            }
        });

        high.setPriority(Thread.MAX_PRIORITY);  // 10
        low.setPriority(Thread.MIN_PRIORITY);   // 1

        System.out.println("high 우선순위: " + high.getPriority());
        System.out.println("low 우선순위: " + low.getPriority());

        low.start();
        high.start();
    }
}
```

{{< callout type="warning" >}}
쓰레드 우선순위는 **OS 스케줄러에 종속적**이다. 멀티코어 환경에서는 우선순위에 따른 차이가 거의 없을 수 있다. 확실한 우선순위 처리가 필요하면 **PriorityQueue** 사용을 고려하자.
{{< /callout >}}

---

## 6. 쓰레드 그룹

관련된 쓰레드를 그룹으로 묶어서 관리할 수 있다.

```java
public class ThreadGroupExample {
    public static void main(String[] args) {
        ThreadGroup main = Thread.currentThread().getThreadGroup();
        ThreadGroup grp1 = new ThreadGroup("Group1");
        ThreadGroup subGrp = new ThreadGroup(grp1, "SubGroup1");

        grp1.setMaxPriority(3);  // 그룹의 최대 우선순위 설정

        Runnable r = () -> {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {}
        };

        new Thread(grp1, r, "th1").start();
        new Thread(subGrp, r, "th2").start();

        System.out.println("Main Group: " + main.getName());
        System.out.println("Active Thread Count: " + main.activeCount());
        System.out.println("Active Group Count: " + main.activeGroupCount());

        main.list();  // 쓰레드 그룹 정보 출력
    }
}
```

---

## 7. 데몬 쓰레드

### 7.1 데몬 쓰레드란?

일반 쓰레드(사용자 쓰레드)의 보조 역할을 하는 쓰레드. **모든 사용자 쓰레드가 종료되면 데몬 쓰레드도 자동 종료**된다.

**데몬 쓰레드 예시**
- 가비지 컬렉터 (GC)
- 자동 저장
- 화면 자동 갱신

### 7.2 데몬 쓰레드 설정

```java
public class DaemonThreadExample {
    public static void main(String[] args) {
        Thread daemon = new Thread(() -> {
            while (true) {
                System.out.println("데몬 쓰레드 실행 중...");
                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {}
            }
        });

        daemon.setDaemon(true);  // 반드시 start() 전에 호출
        daemon.start();

        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {}

        System.out.println("main 종료 - 데몬 쓰레드도 함께 종료됨");
    }
}
```

### 7.3 자동 저장 기능 구현 예제

```java
public class AutoSaveThread extends Thread {
    private boolean running = true;

    public AutoSaveThread() {
        setDaemon(true);  // 데몬 쓰레드로 설정
    }

    @Override
    public void run() {
        while (running) {
            try {
                Thread.sleep(3000);  // 3초마다
            } catch (InterruptedException e) {
                break;
            }
            System.out.println("자동 저장 수행...");
            // 실제 저장 로직
        }
    }

    public void stopAutoSave() {
        running = false;
        interrupt();
    }
}

// 사용
public class App {
    public static void main(String[] args) throws InterruptedException {
        AutoSaveThread autoSave = new AutoSaveThread();
        autoSave.start();

        // 메인 작업 수행
        for (int i = 0; i < 10; i++) {
            Thread.sleep(1000);
            System.out.println("작업 중: " + i);
        }
        // main 종료 시 데몬 쓰레드도 자동 종료
    }
}
```

---

## 8. 쓰레드의 실행 제어

### 8.1 주요 메서드

| 메서드 | 설명 |
|:------|:----|
| `static void sleep(long millis)` | 지정 시간 동안 일시정지 |
| `void join()` / `join(long millis)` | 다른 쓰레드의 작업 완료를 기다림 |
| `void interrupt()` | 일시정지 상태를 깨움 |
| `static void yield()` | 실행 시간을 다른 쓰레드에게 양보 |
| `void stop()` | 즉시 종료 (deprecated) |
| `void suspend()` | 일시정지 (deprecated) |
| `void resume()` | 재개 (deprecated) |

### 8.2 sleep() - 일시정지

```java
public class SleepExample {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            for (int i = 5; i > 0; i--) {
                System.out.println(i);
                try {
                    Thread.sleep(1000);  // 1초 대기
                } catch (InterruptedException e) {
                    System.out.println("인터럽트 발생!");
                    return;
                }
            }
            System.out.println("종료!");
        });

        t.start();
    }
}
```

{{< callout type="warning" >}}
`sleep()`은 **항상 현재 실행 중인 쓰레드**에 적용된다. `t.sleep(1000)`처럼 호출해도 실제로는 호출한 쓰레드가 멈춘다.
{{< /callout >}}

### 8.3 interrupt() - 작업 취소

```java
public class InterruptExample {
    public static void main(String[] args) {
        Thread download = new Thread(() -> {
            try {
                while (!Thread.currentThread().isInterrupted()) {
                    System.out.println("다운로드 중...");
                    Thread.sleep(500);
                }
            } catch (InterruptedException e) {
                System.out.println("다운로드 취소됨!");
            }
        });

        download.start();

        try {
            Thread.sleep(2000);  // 2초 후 취소
        } catch (InterruptedException e) {}

        download.interrupt();  // 다운로드 취소
        System.out.println("main 종료");
    }
}
```

### 8.4 join() - 다른 쓰레드 대기

```java
public class JoinExample {
    public static void main(String[] args) {
        Thread calculator = new Thread(() -> {
            long sum = 0;
            for (int i = 1; i <= 100; i++) {
                sum += i;
            }
            System.out.println("계산 결과: " + sum);
        });

        calculator.start();

        try {
            calculator.join();  // calculator 쓰레드가 끝날 때까지 대기
        } catch (InterruptedException e) {}

        System.out.println("모든 작업 완료!");
    }
}
```

### 8.5 yield() - 양보

```java
public class YieldExample {
    public static void main(String[] args) {
        Runnable r = () -> {
            for (int i = 0; i < 5; i++) {
                System.out.println(Thread.currentThread().getName() + ": " + i);
                Thread.yield();  // 다른 쓰레드에게 양보
            }
        };

        Thread t1 = new Thread(r, "Thread-1");
        Thread t2 = new Thread(r, "Thread-2");

        t1.start();
        t2.start();
    }
}
```

---

## 9. 쓰레드 동기화

### 9.1 동기화가 필요한 이유

```java
public class SyncProblem {
    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) counter.increment();
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) counter.increment();
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();

        // 예상: 20000, 실제: 20000보다 작은 값 (동기화 문제)
        System.out.println("결과: " + counter.getCount());
    }
}

class Counter {
    private int count = 0;

    public void increment() {
        count++;  // count = count + 1 (원자적이지 않음)
    }

    public int getCount() {
        return count;
    }
}
```

### 9.2 synchronized 키워드

#### 메서드 전체 동기화

```java
class Counter {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }

    public synchronized int getCount() {
        return count;
    }
}
```

#### 블록 동기화 (더 효율적)

```java
class Counter {
    private int count = 0;
    private final Object lock = new Object();

    public void increment() {
        synchronized (lock) {
            count++;
        }
    }

    public int getCount() {
        synchronized (lock) {
            return count;
        }
    }
}
```

### 9.3 wait()과 notify()

생산자-소비자 패턴에서 활용된다.

```java
class SharedBuffer {
    private int data;
    private boolean hasData = false;

    public synchronized void produce(int value) throws InterruptedException {
        while (hasData) {
            wait();  // 데이터가 소비될 때까지 대기
        }
        data = value;
        hasData = true;
        System.out.println("생산: " + value);
        notify();  // 소비자에게 알림
    }

    public synchronized int consume() throws InterruptedException {
        while (!hasData) {
            wait();  // 데이터가 생산될 때까지 대기
        }
        hasData = false;
        System.out.println("소비: " + data);
        notify();  // 생산자에게 알림
        return data;
    }
}

public class ProducerConsumerExample {
    public static void main(String[] args) {
        SharedBuffer buffer = new SharedBuffer();

        Thread producer = new Thread(() -> {
            try {
                for (int i = 1; i <= 5; i++) {
                    buffer.produce(i);
                    Thread.sleep(100);
                }
            } catch (InterruptedException e) {}
        });

        Thread consumer = new Thread(() -> {
            try {
                for (int i = 0; i < 5; i++) {
                    buffer.consume();
                    Thread.sleep(200);
                }
            } catch (InterruptedException e) {}
        });

        producer.start();
        consumer.start();
    }
}
```

### 9.4 Lock과 Condition (java.util.concurrent.locks)

synchronized보다 더 세밀한 제어가 가능하다.

```java
import java.util.concurrent.locks.*;

class Account {
    private int balance = 1000;
    private final Lock lock = new ReentrantLock();
    private final Condition depositCondition = lock.newCondition();

    public void withdraw(int amount) {
        lock.lock();
        try {
            while (balance < amount) {
                System.out.println("잔액 부족, 입금 대기...");
                depositCondition.await();  // 입금될 때까지 대기
            }
            balance -= amount;
            System.out.println("출금: " + amount + ", 잔액: " + balance);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            lock.unlock();
        }
    }

    public void deposit(int amount) {
        lock.lock();
        try {
            balance += amount;
            System.out.println("입금: " + amount + ", 잔액: " + balance);
            depositCondition.signalAll();  // 대기 중인 출금 쓰레드 깨움
        } finally {
            lock.unlock();
        }
    }
}
```

### 9.5 Lock 종류

| Lock 종류 | 특징 |
|:---------|:----|
| `ReentrantLock` | 가장 일반적인 배타적 lock |
| `ReentrantReadWriteLock` | 읽기/쓰기 lock 분리, 읽기는 동시 접근 허용 |
| `StampedLock` | 낙관적 읽기 lock 추가 (JDK 1.8+) |

---

## 10. Fork/Join 프레임워크

### 10.1 개념

큰 작업을 작은 단위로 **분할(fork)**하고 결과를 **합치는(join)** 병렬 처리 프레임워크.

```
            [1~100 합계]
               ↓ fork
      ┌────────┴────────┐
   [1~50]            [51~100]
      ↓ fork            ↓ fork
  ┌───┴───┐        ┌───┴───┐
[1~25] [26~50]  [51~75] [76~100]
   ↓      ↓        ↓       ↓
  join   join    join    join
      ↘   ↙          ↘   ↙
       합계           합계
          ↘       ↙
           최종 합계
```

### 10.2 RecursiveTask 예제

```java
import java.util.concurrent.*;

class SumTask extends RecursiveTask<Long> {
    private final long from;
    private final long to;

    SumTask(long from, long to) {
        this.from = from;
        this.to = to;
    }

    @Override
    protected Long compute() {
        long size = to - from + 1;

        // 크기가 작으면 직접 계산
        if (size <= 5) {
            long sum = 0;
            for (long i = from; i <= to; i++) {
                sum += i;
            }
            return sum;
        }

        // 작업 분할
        long mid = (from + to) / 2;
        SumTask left = new SumTask(from, mid);
        SumTask right = new SumTask(mid + 1, to);

        left.fork();  // 비동기 실행
        return right.compute() + left.join();  // 결과 합치기
    }
}

public class ForkJoinExample {
    public static void main(String[] args) {
        ForkJoinPool pool = new ForkJoinPool();
        SumTask task = new SumTask(1, 100);

        Long result = pool.invoke(task);
        System.out.println("1~100 합계: " + result);  // 5050
    }
}
```

### 10.3 fork()와 join()

| 메서드 | 특징 |
|:------|:----|
| `fork()` | 작업을 쓰레드 풀의 작업 큐에 넣음 (비동기) |
| `join()` | 작업 완료까지 대기 후 결과 반환 (동기) |

---

## 11. 실전 예제

### 멀티쓰레드 파일 다운로더

```java
import java.util.concurrent.*;

public class FileDownloader {
    private final ExecutorService executor = Executors.newFixedThreadPool(3);

    public Future<String> download(String url) {
        return executor.submit(() -> {
            System.out.println("다운로드 시작: " + url);
            Thread.sleep(2000);  // 다운로드 시뮬레이션
            System.out.println("다운로드 완료: " + url);
            return "파일_" + url.hashCode() + ".dat";
        });
    }

    public void shutdown() {
        executor.shutdown();
    }

    public static void main(String[] args) throws Exception {
        FileDownloader downloader = new FileDownloader();

        Future<String> file1 = downloader.download("http://example.com/file1");
        Future<String> file2 = downloader.download("http://example.com/file2");
        Future<String> file3 = downloader.download("http://example.com/file3");

        System.out.println("다운로드된 파일: " + file1.get());
        System.out.println("다운로드된 파일: " + file2.get());
        System.out.println("다운로드된 파일: " + file3.get());

        downloader.shutdown();
    }
}
```

---

## 요약

| 개념 | 핵심 내용 |
|:----|:---------|
| **쓰레드 구현** | Thread 상속 또는 Runnable 구현 (권장) |
| **start() vs run()** | start()는 새 호출 스택 생성, run()은 단순 메서드 호출 |
| **우선순위** | 1~10 (기본 5), OS 스케줄러에 종속적 |
| **데몬 쓰레드** | 보조 쓰레드, 사용자 쓰레드 종료 시 함께 종료 |
| **sleep()** | 지정 시간 동안 일시정지 |
| **join()** | 다른 쓰레드 작업 완료 대기 |
| **interrupt()** | 일시정지 상태 해제 |
| **synchronized** | 임계 영역 설정, 동기화 |
| **wait()/notify()** | 쓰레드 간 협력, 대기/통지 |
| **Lock/Condition** | synchronized보다 세밀한 동기화 제어 |
| **Fork/Join** | 작업 분할 후 병렬 처리 |
