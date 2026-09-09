---
title: "Chapter 13. 쓰레드 (Thread)"
date: 2026-01-08
weight: 13
---

앞 장들이 이 장으로 미뤄 둔 것이 유난히 많다. `StringBuffer`의 동기화가 왜 비용인가([Chapter 09](../09-java-lang-package)), `SimpleDateFormat`은 왜 공유하면 안 되는가([Chapter 10](../10-date-time-formatting)), `synchronizedList()`는 왜 반쪽짜리이고 왜 `ConcurrentHashMap`을 쓰라는가([Chapter 11](../11-collections-framework)), 그리고 `Object`에 왜 `wait()`와 `notify()`가 있는가(9장). 전부 스레드 이야기다. 이 장의 규칙들은 세 원리에서 나온다. 첫째, **스레드는 스택만 따로 갖고 힙은 함께 쓴다.** 그래서 문제도 해법도 전부 공유된 힙 위의 객체에 있다. 둘째, **"동시에"가 만드는 문제는 원자성, 가시성, 순서 셋으로 나뉜다.** `synchronized`가 무엇을 해결하고 `volatile`이 무엇을 못 하는지는 이 구분에서 결정된다. 셋째, **스레드를 만들지 말고 작업을 넘겨라.** `Runnable`을 권하는 이유, `ExecutorService`가 표준이 된 이유, Java 21의 가상 스레드가 나온 이유가 한 줄로 이어진다. 스레드 실행은 비결정적이라 이 장의 실측 수치는 필자의 PC(JDK 25, 12코어)에서 나온 경향으로만 읽으면 된다.

---

## 1. 프로세스와 스레드: 스택은 따로, 힙은 함께

### 1.1 무엇이 다른가

프로세스는 실행 중인 프로그램이고, 운영체제가 메모리를 따로 떼어 준 단위다. 스레드는 그 프로세스 안에서 실제로 명령을 실행하는 흐름이고, 모든 프로세스는 `main` 스레드 하나로 시작한다.

```
┌──────────────────────────────┐
│ 프로세스                     │
│ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │ T1   │ │ T2   │ │ T3   │   │
│ │ 스택 │ │ 스택 │ │ 스택 │   │
│ └──────┘ └──────┘ └──────┘   │
│   공유: 힙, 메서드 영역, 코드│
└──────────────────────────────┘
```

[Chapter 06](../06-oop-basics)에서 메서드는 호출 스택의 프레임 위에서 산다고 했다. 스레드마다 그 스택이 하나씩 있다. 지역 변수와 매개변수는 스레드가 각자 갖고, 힙의 객체와 `static` 변수는 같은 프로세스의 모든 스레드가 함께 본다. 이 한 문장이 이 장의 절반이다. 지역 변수만 쓰는 메서드는 스레드가 몇 개든 안전하고, 힙의 객체를 여러 스레드가 바꾸는 순간부터 4절의 문제가 시작된다.

스레드가 "가벼운 프로세스"로 불리는 이유도 여기 있다. 프로세스를 새로 만들면 메모리 공간을 통째로 준비해야 하지만, 스레드는 스택 하나(64비트 JVM에서 기본 1MB 안팎, `-Xss`로 조정)와 레지스터 상태만 있으면 된다. 전환할 때 교체하는 것도 프로그램 카운터, 레지스터, 스택 포인터 정도라 프로세스 전환보다 훨씬 싸다. 다만 싸다는 것이 공짜라는 뜻은 아니다. 스레드 만 개면 스택만 수 GB이고, 이 비용이 8절의 가상 스레드를 낳았다.

### 1.2 병행과 병렬, 언제 이득인가

코어가 하나면 스레드가 여럿이어도 한 순간에 하나만 실행된다. 운영체제가 아주 짧은 시간 단위로 스레드를 번갈아 실행해서 동시에 도는 것처럼 보일 뿐이고, 이것이 **병행**(concurrent)이다. 코어가 여럿이면 정말 동시에 실행되는 **병렬**(parallel)이 된다. 둘의 구분이 중요한 이유는 멀티스레드가 언제 이득인지가 여기서 갈리기 때문이다.

| 작업의 성격 | 코어 | 멀티스레드 효과 |
|:------------|:-----|:----------------|
| CPU 계산만 | 1개 | 없다. 전환 비용만 든다 |
| CPU 계산만 | 여러 개 | 코어 수만큼 빨라진다 |
| 파일, 네트워크, DB 대기 | 상관없음 | 크다. 기다리는 동안 다른 일을 한다 |
| 사용자 입력 대기 | 상관없음 | 크다. 화면이 멈추지 않는다 |

CPU 계산은 코어가 여럿일 때만 이득이고, 그마저 스레드 수만큼 정비례하지는 않는다. 2억 번의 나머지 연산을 한 스레드로 돌리면 약 230ms, 12코어 PC에서 네 스레드로 나누면 약 76ms였다. 세 배쯤이지 네 배가 아닌 것은 스레드 생성과 합치는 비용, 메모리 대역폭 때문이다. 반면 대기가 대부분인 작업은 코어가 하나여도 이득이 크다. 네트워크 응답을 기다리는 동안 CPU는 놀고 있으므로 다른 스레드가 그 시간을 쓸 수 있다. 서버가 요청마다 스레드를 하나씩 쓰는 이유가 이것이다.

이득의 대가는 세 가지다. 공유하는 것을 맞춰야 하고(동기화), 서로 기다리다 영원히 멈출 수 있고(교착), 실행 순서가 매번 달라 재현되지 않는 버그가 생긴다.

---

## 2. 스레드 만들기와 시작하기

### 2.1 Thread를 상속할까, Runnable을 구현할까

```java
class MyThread extends Thread {                 // 방법 1
    @Override public void run() { System.out.println(getName()); }
}
class MyTask implements Runnable {              // 방법 2
    @Override public void run() {
        System.out.println(Thread.currentThread().getName());
    }
}

new MyThread().start();
new Thread(new MyTask()).start();
new Thread(() -> System.out.println("lambda")).start();   // 14장의 람다
```

둘 다 되지만 `Runnable`이 답이다. 이유는 둘이다. 자바는 단일 상속이라 `Thread`를 상속하면 다른 조상을 둘 수 없고([Chapter 07](../07-oop-advanced)), 더 근본적으로 **"할 일"과 "그것을 실행하는 스레드"는 다른 것**이기 때문이다. `Runnable`은 할 일만 담은 객체라서 `Thread`에 넘길 수도, 7절의 `ExecutorService`에 넘길 수도, 8절의 가상 스레드에 넘길 수도 있다. `Thread`를 상속하면 할 일이 스레드 하나에 묶인다. 이 장의 셋째 원리가 여기서 시작된다.

### 2.2 start()와 run()은 다른 것이다

```java
Thread t = new Thread(() ->
    System.out.println("run by " + Thread.currentThread().getName()), "worker");

t.run();      // run by main.   그냥 메서드 호출이다
t.start();    // run by worker. 새 스레드에서 실행된다
t.start();    // IllegalThreadStateException. 스레드는 한 번만 시작한다
```

`run()`을 직접 부르면 `main` 스레드의 스택 위에서 평범한 메서드 호출로 실행된다. 새 스레드는 `start()`가 만든다. JVM에 새 스택을 요구하고, 운영체제 스레드를 얻고, 그 위에서 `run()`을 부르는 것이 `start()`의 일이다. 한 번 끝난 스레드는 스택이 걷혀 다시 시작할 수 없으므로 두 번째 `start()`는 예외다. 같은 일을 다시 하려면 `Runnable`을 새 `Thread`에 다시 넘긴다.

스택이 다르다는 사실에서 두 가지가 따라온다. 첫째, [Chapter 08](../08-exception-handling)의 예외 전파는 스택을 거슬러 오르는 것이라 **스레드 경계를 넘지 않는다.** 자식 스레드에서 난 예외는 자식의 스택 끝에서 "Exception in thread ..." 메시지와 함께 그 스레드만 끝내고, `main`은 모른 채 계속 돈다. 스레드의 예외를 잡으려면 `run()` 안에서 잡거나 `setUncaughtExceptionHandler()`를 달아야 한다. 둘째, 프로그램은 `main()`이 끝나도 끝나지 않는다. JVM은 **사용자 스레드가 하나도 남지 않았을 때** 종료된다.

### 2.3 데몬, 우선순위, 그룹

그 종료 조건에서 제외되는 것이 데몬 스레드다. GC처럼 다른 스레드를 돕는 배경 작업은 사용자 스레드가 모두 끝나면 같이 끝나야 하므로, `setDaemon(true)`로 표시하면 JVM이 종료를 기다리지 않는다.

```java
Thread daemon = new Thread(() -> {
    while (true) {
        try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
        // 자동 저장 같은 배경 작업
    }
});
daemon.setDaemon(true);      // start() 전에. 이후에 부르면 IllegalThreadStateException
daemon.start();
```

데몬은 사용자 스레드가 끝나는 순간 하던 일 중간에 끊긴다. 파일 쓰기처럼 중간에 끊기면 안 되는 일을 데몬에 맡기면 안 되는 이유다.

우선순위는 1부터 10까지이고 기본이 5다. `setPriority()`는 언제든 부를 수 있지만 **운영체제에 주는 힌트**일 뿐이라 무시될 수 있고, 리눅스는 기본 설정에서 아예 반영하지 않는다. 실행 순서를 정해야 한다면 우선순위가 아니라 `join()`, `CountDownLatch`, `CompletableFuture` 같은 조정 도구를 쓴다. 스레드 그룹은 JDK 1.0의 장치인데 핵심 메서드 대부분이 Java 16과 17에서 제거 예정으로 표시됐다. 스레드 묶음의 관리는 7절의 `ExecutorService`가 대신한다.

---

## 3. 스레드의 상태와 제어

### 3.1 여섯 가지 상태

```
        start()
NEW ───────────▶ RUNNABLE ◀──────┐
                   │  ▲          │
                   │  │ notify() │
          sleep()  │  │ 시간 만료│
          wait()   │  │ 락 획득  │
          join()   ▼  │          │
          ┌────────────────────┐ │
          │ WAITING / BLOCKED  │─┘
          │ TIMED_WAITING      │
          └─────────┬──────────┘
                    │ run() 종료
                    ▼
               TERMINATED
```

| 상태 | 언제 | 확인한 경우 |
|:-----|:-----|:------------|
| `NEW` | 만들었지만 `start()` 전 | |
| `RUNNABLE` | 실행 중이거나 CPU를 기다리는 중 | JVM은 둘을 구분하지 않는다 |
| `BLOCKED` | 다른 스레드가 쥔 `synchronized` 락을 기다림 | 락 든 채로 다른 스레드가 진입 시도 |
| `WAITING` | `wait()`, `join()`으로 기한 없이 대기 | |
| `TIMED_WAITING` | `sleep(ms)`, `wait(ms)`, `join(ms)` | |
| `TERMINATED` | `run()`이 끝남 | 예외로 끝나도 같다 |

`RUNNABLE`이 "실행 중"과 "실행 대기"를 합친 상태인 것은 그 구분이 JVM이 아니라 운영체제 스케줄러의 몫이기 때문이다. `getState()`로 상태를 읽을 수 있지만 읽는 순간 이미 바뀌었을 수 있으므로 디버깅용이지 제어용이 아니다.

### 3.2 sleep, join, yield

```java
Thread.sleep(1000);          // 현재 스레드가 1초 대기. static이다
worker.join();               // worker가 끝날 때까지 현재 스레드가 대기
worker.join(3000);           // 최대 3초만
Thread.yield();              // CPU를 양보하겠다는 힌트. 무시될 수 있다
```

`sleep()`이 `static`이라는 점이 자주 오해를 낳는다. `worker.sleep(1000)`이라고 써도 잠드는 것은 `worker`가 아니라 **그 코드를 실행 중인 스레드**다. 다른 스레드를 재우는 방법은 없다. 스레드는 자기만 재울 수 있고, 남에게는 부탁만 할 수 있다는 것이 3.3절의 원칙이다.

### 3.3 interrupt: 멈추라고 부탁하기

```java
Thread download = new Thread(() -> {
    try {
        for (int i = 0; i < 100; i++) {
            if (Thread.currentThread().isInterrupted()) {   // 부탁이 왔는지 확인
                System.out.println("취소됨");
                return;
            }
            Thread.sleep(100);         // 자는 중이면 여기서 InterruptedException
        }
    } catch (InterruptedException e) {
        System.out.println("대기 중 취소됨");
    }
});
download.start();
Thread.sleep(500);
download.interrupt();                  // 멈추라는 부탁
```

`interrupt()`는 스레드를 멈추지 않는다. 그 스레드의 **인터럽트 플래그**를 켤 뿐이고, 멈출지는 그 스레드가 플래그를 보고 스스로 정한다. 잠들어 있거나(`sleep`, `wait`, `join`) 기다리는 중이면 `InterruptedException`으로 깨워 주는데, 이때 플래그는 지워진 채로 깨어난다. 실행 중인 스레드는 `isInterrupted()`로 직접 확인해야 하며, `Thread.interrupted()`는 확인과 동시에 플래그를 지운다. 예외를 잡고 아무것도 안 하면 부탁이 사라지므로, 처리할 수 없는 자리에서는 `Thread.currentThread().interrupt()`로 플래그를 다시 켜서 위로 전달한다.

왜 이렇게 번거로운가. JDK 1.0에는 `stop()`이 있었다. 밖에서 스레드를 즉시 죽이는 메서드인데, 그 스레드가 락을 쥔 채 객체를 반쯤 고치던 중이면 락은 풀리고 객체는 깨진 채로 남는다. 다른 스레드는 깨진 객체를 보게 되고 그것을 막을 방법이 없다. 그래서 `stop()`은 JDK 1.2에 사용 금지가 됐고, Java 20부터는 부르면 `UnsupportedOperationException`을 던지며, `suspend()`와 `resume()`은 삭제되어 Java 25에서는 컴파일조차 되지 않는다. 남은 방법은 협력뿐이다. 멈춰야 하는 스레드가 스스로 안전한 지점에서 멈춘다.

```java
class Worker implements Runnable {
    private volatile boolean running = true;   // volatile인 이유는 4.2절

    public void run() {
        while (running && !Thread.currentThread().isInterrupted()) {
            // 한 단위의 작업
        }
    }
    public void stop() { running = false; }
}
```

---

## 4. 공유의 세 가지 문제: 원자성, 가시성, 순서

### 4.1 원자성: count++는 한 번에 일어나지 않는다

```java
class Counter {
    int count = 0;
    void increment() { count++; }
}

Counter c = new Counter();
Runnable job = () -> { for (int i = 0; i < 100_000; i++) c.increment(); };
Thread a = new Thread(job), b = new Thread(job);
a.start(); b.start(); a.join(); b.join();
System.out.println(c.count);   // 200000이 아니다. 199367, 199985, 199998 ...
```

세 번 돌려 세 번 다른 값이 나왔고 한 번도 20만이 아니었다. `count++`가 바이트코드에서 세 명령이기 때문이다.

```
count++  →  getfield count    읽기
            iconst_1
            iadd              더하기
            putfield count    쓰기
```

```
count = 0
스레드 A          스레드 B
읽기  0
                  읽기  0
더하기 1
                  더하기 1
쓰기  1
                  쓰기  1  ← 손실
```

두 스레드가 같은 0을 읽으면 둘 다 1을 쓰고 한 번의 증가가 사라진다. 이렇게 결과가 실행 순서에 따라 달라지는 상태를 **경쟁 상태**라 한다. 읽고 쓰는 사이에 아무도 끼어들 수 없게 만드는 것, 즉 세 명령을 **하나의 단위(원자적)**로 만드는 것이 첫 번째 과제이고, 5절의 `synchronized`와 6절의 `AtomicInteger`가 그 답이다.

### 4.2 가시성: 바꿨는데 안 보인다

```java
static boolean stop = false;

Thread reader = new Thread(() -> {
    while (!stop) { }              // stop이 true가 되면 끝날 것 같지만
    System.out.println("멈춤");
});
reader.start();
Thread.sleep(200);
stop = true;                       // main이 바꿨는데 reader는 영원히 돈다
```

이 코드는 필자의 PC에서 끝나지 않았다. `main`이 `stop`을 `true`로 바꿨는데 `reader`는 계속 `false`를 본다. 두 가지 이유가 겹친다. 각 코어는 자기 캐시에 값을 두고 일하므로 다른 코어가 바꾼 값이 곧바로 보이지 않을 수 있고, 더 결정적으로 JIT 컴파일러가 "이 변수는 루프 안에서 바뀌지 않는다"고 판단해 읽기를 루프 밖으로 끌어내 버린다. 한 스레드만 있다면 완전히 올바른 최적화다. 컴파일러는 다른 스레드가 이 변수를 바꿀 것이라는 사실을 **알려 주지 않으면 모른다.**

알려 주는 방법이 `volatile`이다. `volatile`이 붙은 변수는 항상 메모리에서 읽고 메모리에 쓰며 JIT이 최적화로 치워 버리지 않는다. 같은 코드에 `volatile`만 붙이면 `reader`는 바로 멈춘다. 3.3절의 `running` 플래그가 `volatile`이어야 하는 이유다.

```java
static volatile int count = 0;
// 두 스레드가 10만 번씩 count++ → 198734. 여전히 손실
```

그러나 `volatile`은 원자성을 주지 않는다. 읽기와 쓰기 각각이 메모리에서 일어날 뿐, 읽고 더하고 쓰는 세 단계 사이에 끼어드는 것은 막지 못한다. `volatile`은 **"한 스레드가 쓰고 여러 스레드가 읽는 플래그"**에 맞고, 여러 스레드가 갱신하는 값에는 맞지 않는다.

### 4.3 순서: 재배치

컴파일러와 CPU는 결과가 같다면 명령 순서를 바꿔 실행한다. 한 스레드 안에서는 결과가 같다는 것이 보장되지만 다른 스레드가 보는 순서는 보장되지 않는다. 객체를 만들고 참조를 공유 변수에 넣는 두 단계가 뒤바뀌면 다른 스레드가 초기화되지 않은 객체를 볼 수 있다. 자바 메모리 모델(JMM)은 이 문제를 **happens-before** 관계로 정리한다. `synchronized` 블록의 해제는 다음 획득보다 먼저 일어나고, `volatile` 쓰기는 그 뒤의 읽기보다 먼저 일어나며, `start()`는 그 스레드의 모든 동작보다, 스레드의 모든 동작은 `join()`의 반환보다 먼저 일어난다. 이 관계로 이어진 두 동작 사이에서만 앞의 결과가 뒤에 보인다고 약속된다. 동시성 시리즈의 [객체 공유](../../concurrency/03-object-sharing)가 이 주제를 깊이 다룬다.

| 도구 | 원자성 | 가시성 | 순서 |
|:-----|:-------|:-------|:-----|
| `synchronized` | O | O | O |
| `volatile` | X | O | O |
| `AtomicInteger` 등 | O (CAS) | O | O |

---

## 5. synchronized: 모니터 락

### 5.1 모든 객체가 락을 하나씩 갖는다

```java
class Counter {
    private int count = 0;
    private final Object lock = new Object();

    public synchronized void increment() { count++; }   // this의 락

    public void incrementWithLock() {
        synchronized (lock) {                          // lock 객체의 락
            count++;
        }
    }
}
```

자바의 모든 객체는 **모니터**라 부르는 락을 하나씩 갖고 있다. `synchronized`는 그 락을 얻어야 블록에 들어가고 나올 때 돌려준다. 락을 쥔 스레드가 있으면 다른 스레드는 `BLOCKED` 상태로 기다린다. 한 순간에 한 스레드만 블록 안에 있으므로 `count++`의 세 단계 사이에 아무도 끼어들지 못하고, 락을 놓을 때 쓴 값은 다음에 락을 얻는 스레드에게 보인다. 원자성, 가시성, 순서를 한 번에 해결하는 이유다.

```
스레드 A             스레드 B
lock 획득            lock 대기(BLOCKED)
임계 영역 실행
lock 해제 ─────────▶ lock 획득
                     임계 영역 실행
```

`synchronized` 메서드는 `this`의 락을 쓴다. 간단하지만 `this`는 밖에서도 보이는 객체라 누군가 `synchronized (counter)`로 같은 락을 잡아 버릴 수 있다. 전용 `lock` 객체를 두면 락이 클래스 안에 갇힌다. 같은 스레드가 이미 쥔 락을 다시 요구하면 그냥 들어간다(**재진입**). `synchronized` 메서드가 같은 객체의 다른 `synchronized` 메서드를 부를 수 있는 이유다.

락은 병렬성을 줄이는 대가로 정확성을 산다. 그래서 잠그는 구간은 공유 상태를 만지는 최소한으로 줄이고, 파일이나 네트워크 대기나 `Thread.sleep()`을 락 안에서 하지 않는다. 락을 쥔 채 기다리면 그 시간 동안 모두가 기다린다. 9장에서 `StringBuffer`의 모든 메서드에 붙은 동기화가 한 스레드만 쓸 때도 비용이라고 한 것이 이 비용이다. 요즘 JVM은 경쟁이 없는 락을 아주 싸게 처리하지만 공짜는 아니다.

### 5.2 wait와 notify: 조건이 될 때까지 기다리기

```java
class SharedBuffer {
    private int data;
    private boolean hasData = false;

    public synchronized void produce(int value) throws InterruptedException {
        while (hasData) wait();          // 자리가 날 때까지
        data = value;
        hasData = true;
        notifyAll();                     // 소비자를 깨운다
    }

    public synchronized int consume() throws InterruptedException {
        while (!hasData) wait();         // 데이터가 올 때까지
        hasData = false;
        notifyAll();                     // 생산자를 깨운다
        return data;
    }
}
```

락은 "동시에 들어오지 마라"를 해결하지만 "어떤 조건이 될 때까지 기다려라"는 해결하지 못한다. 락을 쥔 채 루프를 돌며 조건을 확인하면 조건을 바꿔 줄 다른 스레드가 락을 못 얻는다. `wait()`는 이 문제를 **락을 놓고 잠드는 것**으로 푼다.

```
소비자          생산자
synchronized 진입
조건 거짓 → wait()
  락 해제, 대기 집합에 등록
                synchronized 진입
                데이터 넣고 notifyAll()
                락 해제
락 재획득 → 조건 다시 검사
```

9장에서 미뤄 둔 질문의 답이 여기 있다. `wait()`와 `notify()`가 `Object`의 메서드인 이유는 **모든 객체가 모니터**이기 때문이다. 어떤 객체든 락이 될 수 있으니 어떤 객체든 대기 집합을 가질 수 있다. 그리고 반드시 그 객체의 `synchronized` 안에서 불러야 하는 이유는 조건 검사와 대기 사이의 틈 때문이다. 락 없이 "데이터가 없네"라고 확인한 뒤 `wait()`를 부르기 직전에 생산자가 데이터를 넣고 `notify()`를 해 버리면, 소비자는 이미 지나간 신호를 영원히 기다린다. 락 안에서 검사하고 락을 놓는 것과 잠드는 것을 한 동작으로 처리해야 이 틈이 사라진다. 락 없이 부르면 `IllegalMonitorStateException`이다.

조건을 `if`가 아니라 `while`로 검사하는 것도 같은 맥락이다. 깨어났다는 것은 락을 다시 얻었다는 뜻일 뿐 조건이 참이라는 보장이 아니다. 다른 소비자가 먼저 가져갔을 수 있고, JVM 문서가 인정하듯 아무 이유 없이 깨어나는 **가짜 깨어남**도 있다. `notify()`는 대기 중인 스레드 하나만 깨우는데 생산자와 소비자가 한 대기 집합에 섞여 있으면 엉뚱한 쪽이 깨어날 수 있으므로, 대기하는 조건이 둘 이상이면 `notifyAll()`이 안전하다. 조건마다 대기 집합을 따로 두는 것이 6절의 `Condition`이다.

### 5.3 교착상태

```
T1: A 획득 ─▶ B 기다림
T2: B 획득 ─▶ A 기다림
    서로 영원히 기다린다
```

```java
Thread t1 = new Thread(() -> { synchronized (A) { sleep(100); synchronized (B) { } } });
Thread t2 = new Thread(() -> { synchronized (B) { sleep(100); synchronized (A) { } } });
// 잠시 후 둘 다 BLOCKED. ThreadMXBean.findDeadlockedThreads()가 2를 돌려준다
```

두 스레드가 서로가 쥔 락을 기다리면 둘 다 영원히 `BLOCKED`다. JVM은 이 상태를 감지할 수는 있어도(`jstack`이 "Found one Java-level deadlock"이라고 보고한다) 풀지는 못한다. 어느 쪽 락을 강제로 빼앗아도 5.1절의 `stop()`과 같은 문제가 생기기 때문이다. 그래서 교착은 예방만 가능하고, 원칙은 넷이다. 락을 여러 개 잡을 때는 **모든 스레드가 같은 순서로** 잡고, 락을 쥔 시간을 줄이고, 6절의 `tryLock(timeout)`으로 못 얻으면 물러나고, `synchronized`를 중첩하지 않는다.

---

## 6. Lock, Condition, Atomic: 명시적인 도구

`synchronized`는 블록을 벗어나면 자동으로 풀리고 문법이 간단하지만, 락을 얻으려다 포기할 수도 없고 대기 조건을 나눌 수도 없다. Java 5의 `java.util.concurrent.locks`가 그 자리를 채운다.

```java
private final ReentrantLock lock = new ReentrantLock();

public void increment() {
    lock.lock();
    try {
        count++;
    } finally {
        lock.unlock();             // 예외가 나도 반드시. 8장의 finally
    }
}

if (lock.tryLock(1, TimeUnit.SECONDS)) {   // 1초 안에 못 얻으면 false
    try { /* 임계 영역 */ } finally { lock.unlock(); }
} else {
    // 다른 길로. 교착에 빠지지 않는다
}
```

`ReentrantLock`은 `synchronized`와 같은 재진입 락인데 `tryLock()`으로 기다림에 기한을 둘 수 있고, 기다리는 중에 인터럽트를 받을 수 있으며, 오래 기다린 스레드에게 먼저 주는 공정 모드가 있다. 대신 풀어 주는 것이 프로그래머 책임이라 `finally`가 필수다. `Condition`은 하나의 락에 여러 대기 집합을 만든다.

```java
private final Lock lock = new ReentrantLock();
private final Condition notFull  = lock.newCondition();
private final Condition notEmpty = lock.newCondition();

public void put(T item) throws InterruptedException {
    lock.lock();
    try {
        while (queue.size() == capacity) notFull.await();
        queue.add(item);
        notEmpty.signal();             // 소비자만 깨운다
    } finally { lock.unlock(); }
}
```

5.2절에서 `notifyAll()`로 모두를 깨우던 것을 조건별로 나눠, 생산자는 `notFull`에서, 소비자는 `notEmpty`에서 기다린다. 엉뚱한 쪽이 깨어나 다시 잠드는 낭비가 없다.

| 도구 | 언제 |
|:-----|:-----|
| `synchronized` | 기본. 간단하고 자동으로 풀린다 |
| `ReentrantLock` | 기한, 인터럽트, 공정성이 필요할 때 |
| `ReentrantReadWriteLock` | 읽기는 여럿이 동시에, 쓰기만 배타로 |
| `StampedLock` (Java 8) | 읽기가 압도적으로 많을 때의 낙관적 읽기 |
| `AtomicInteger`, `AtomicLong`, `AtomicReference` | 값 하나를 락 없이 원자적으로 |

```java
AtomicInteger count = new AtomicInteger();
count.incrementAndGet();       // 두 스레드 10만 번씩 → 정확히 200000
```

`AtomicInteger`는 락 없이 원자성을 얻는다. CPU의 **CAS**(compare-and-swap) 명령을 쓰는데, "지금 값이 내가 읽은 값과 같으면 새 값으로 바꿔라"를 하드웨어가 한 번에 처리하고, 그 사이 누가 바꿨으면 실패해서 다시 읽어 시도한다. 스레드를 재우고 깨우는 락보다 경쟁이 적을 때 훨씬 싸다. 11장의 `ConcurrentHashMap`이 빠른 것도 같은 기법 덕분이다.

---

## 7. 스레드 대신 작업을 넘겨라: Executor

### 7.1 왜 풀인가

요청마다 `new Thread()`를 만들면 세 가지가 문제다. 스레드 생성은 운영체제 호출이라 비싸고, 요청이 몰리면 스레드 수가 무한히 늘어 메모리가 바닥나며, 예외 처리와 종료를 매번 손으로 해야 한다. `ExecutorService`는 정해진 수의 스레드를 미리 만들어 두고, 작업을 큐에 넣으면 놀고 있는 스레드가 꺼내 실행한다.

```
submit() ─▶ [t5][t4][t3] ─▶ T1: t1 실행
   제출        작업 큐       T2: t2 실행
                             워커 스레드
```

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
for (int i = 0; i < 10; i++) {
    final int id = i;
    pool.submit(() -> System.out.println("Task " + id));
}
pool.shutdown();                                  // 새 작업은 거부, 남은 것은 실행
pool.awaitTermination(60, TimeUnit.SECONDS);     // 끝날 때까지 대기

try (ExecutorService ex = Executors.newFixedThreadPool(4)) {   // Java 19+
    ex.submit(task);
}   // close()가 shutdown()과 awaitTermination()을 한다
```

`newFixedThreadPool(4)`의 정체는 스레드 4개와 **크기 제한 없는** `LinkedBlockingQueue`를 가진 `ThreadPoolExecutor`다. 스레드는 늘지 않지만 큐는 무한히 자라므로 작업이 처리 속도보다 빨리 들어오면 메모리가 큐에서 바닥난다. 실무에서는 큐 크기와 거부 정책을 직접 정한 `ThreadPoolExecutor`를 쓰는 이유다. 종료도 명시적이다. `shutdown()`을 부르지 않으면 워커 스레드가 사용자 스레드로 남아 2.2절의 규칙에 따라 프로그램이 끝나지 않고, 반대로 종료 절차 없이 프로세스가 죽으면 진행 중이던 작업이 사라진다. 스프링에서 그 일을 겪은 기록이 [@Async 비동기 작업의 Graceful Shutdown 문제](../../../../blog/troubleshooting/async-graceful-shutdown)에 있다.

### 7.2 Callable과 Future: 결과와 예외를 받는 법

```java
Callable<Integer> task = () -> {
    Thread.sleep(100);
    return 42;                                   // 값을 돌려주고 예외도 던질 수 있다
};
Future<Integer> future = pool.submit(task);
Integer result = future.get();                   // 끝날 때까지 기다렸다가 42

Future<?> bad = pool.submit(() -> { throw new IllegalStateException("실패"); });
// 아무것도 출력되지 않는다
bad.get();   // ExecutionException: java.lang.IllegalStateException: 실패
```

`Runnable`은 돌려줄 값이 없고 검사 예외를 던질 수 없다. `Callable<V>`는 둘 다 된다. `submit()`이 돌려주는 `Future`는 "나중에 나올 결과"의 손잡이이고, `get()`은 결과가 나올 때까지 현재 스레드를 세운다. 알아 둬야 할 것은 작업에서 난 **예외가 `Future` 안에 보관된다**는 점이다. `get()`을 부르지 않으면 예외는 어디에도 찍히지 않고 조용히 사라진다. 결과가 필요 없어 `get()`을 안 부르는 작업이라면 `execute()`로 넘기거나 작업 안에서 예외를 잡아 기록해야 한다. `execute()`로 넘긴 작업의 예외는 2.2절의 규칙대로 스레드의 처리기가 출력한다.

### 7.3 CompletableFuture: 기다리지 않고 잇기

```java
CompletableFuture
    .supplyAsync(() -> "Hello")            // 다른 스레드에서
    .thenApply(s -> s + " World")          // 결과가 나오면 이어서
    .thenApply(String::toUpperCase)
    .thenAccept(System.out::println)       // HELLO WORLD
    .join();
```

`Future.get()`은 결과가 나올 때까지 스레드를 세운다. `CompletableFuture`는 "결과가 나오면 이것을 해라"를 미리 이어 두어 아무도 기다리지 않게 한다. 마지막의 `join()`은 예제를 위한 것이다. `supplyAsync()`가 기본으로 쓰는 `ForkJoinPool.commonPool()`의 스레드는 **데몬**이라, `main`이 먼저 끝나면 결과가 찍히기 전에 프로그램이 종료된다.

### 7.4 Fork/Join: 나눠서 풀고 합친다

```java
class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 10_000;
    private final long[] array;
    private final int start, end;

    SumTask(long[] array, int start, int end) {
        this.array = array; this.start = start; this.end = end;
    }

    @Override
    protected Long compute() {
        if (end - start <= THRESHOLD) {                 // 충분히 작으면 직접
            long sum = 0;
            for (int i = start; i < end; i++) sum += array[i];
            return sum;
        }
        int mid = (start + end) / 2;
        SumTask left = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);
        left.fork();                                     // 왼쪽은 다른 스레드에
        return right.compute() + left.join();            // 오른쪽은 직접, 합친다
    }
}
long sum = ForkJoinPool.commonPool().invoke(new SumTask(array, 0, array.length));
```

Java 7의 `ForkJoinPool`은 큰 작업을 재귀적으로 쪼개 코어들에 나눠 준다. 워커마다 자기 작업 큐가 있고 자기 것이 떨어지면 남의 큐에서 **훔쳐 오므로**(work stealing) 코어가 놀지 않는다. `commonPool()`의 스레드 수는 코어 수 빼기 하나다. 하나는 그것을 부른 스레드 몫이다. [Chapter 14](../14-lambda-stream)의 병렬 스트림이 이 풀 위에서 돈다.

### 7.5 조정 도구와 병렬 컬렉션

| 도구 | 하는 일 |
|:-----|:--------|
| `CountDownLatch` | N개의 신호가 올 때까지 대기. 한 번만 쓴다 |
| `CyclicBarrier` | N개의 스레드가 모두 도착할 때까지 서로 대기. 재사용 |
| `Semaphore` | 동시에 들어갈 수 있는 수를 제한 |
| `BlockingQueue` | 비면 꺼내는 쪽이, 차면 넣는 쪽이 기다리는 큐. 생산자-소비자의 표준 |
| `ConcurrentHashMap` | 구간별 락과 CAS로 동시 갱신을 견디는 맵 |
| `CopyOnWriteArrayList` | 쓸 때 복사. 읽기가 압도적일 때 |

11장에서 `HashMap`을 여러 스레드가 갱신하면 안 된다고 했는데, 실제로 두 스레드가 `merge()`를 20만 번 하면 `ConcurrentModificationException`이 나거나 갱신이 사라진다. `ConcurrentHashMap`은 같은 코드로 정확히 센다. 이 도구들의 안쪽은 동시성 시리즈의 [구성 단위](../../concurrency/05-building-blocks)에서 본다.

---

## 8. 가상 스레드: 스레드가 싸지면 설계가 바뀐다

```java
Thread vt = Thread.ofVirtual().start(() -> { /* 작업 */ });   // Java 21

try (ExecutorService ex = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        ex.submit(() -> { Thread.sleep(100); return null; });   // 작업마다 스레드 하나
    }
}
```

지금까지의 스레드(플랫폼 스레드)는 운영체제 스레드와 1:1이다. 1.1절에서 본 대로 스택이 1MB쯤이고 만드는 데 운영체제 호출이 든다. 그래서 서버는 스레드 풀로 수를 제한했고, 스레드 하나가 DB 응답을 기다리는 동안 그 비싼 스레드는 아무것도 못 했다. Java 21의 **가상 스레드**(JEP 444)는 이 전제를 바꾼다. 스택을 힙에 작은 조각으로 두고, JVM이 직접 스케줄링하며, 운영체제 스레드(캐리어) 위에 올렸다 내렸다 한다.

```
가상 스레드  V1  V2  V3  V4 ... V10000
             │   │
      마운트 ▼   ▼
캐리어 스레드 C1  C2  ... C12 (코어 수)
             │   │
OS 스레드    OS1 OS2 ... OS12
 블로킹하면 캐리어에서 내려오고
 다른 가상 스레드가 올라간다
```

가상 스레드가 `sleep()`이나 I/O로 막히면 캐리어에서 내려오고 다른 가상 스레드가 올라간다. 캐리어는 코어 수만큼만 있으면 되므로 가상 스레드는 수십만 개를 만들어도 된다. 100ms씩 자는 스레드 만 개를 만들고 기다리는 데 플랫폼 스레드는 약 1.5초, 가상 스레드는 약 0.15초였다. 만 개를 한꺼번에 재울 수 있으니 전체가 100ms 남짓에 끝난 것이다.

성질도 다르다. 가상 스레드는 항상 데몬이라 `setDaemon(false)`가 예외이고, 우선순위는 5로 고정이며, 이름이 없다. 그리고 **풀에 넣지 않는다.** 싸게 만들고 버리는 것이 목적이라 작업마다 하나씩 만드는 것이 맞고, `newVirtualThreadPerTaskExecutor()`가 그 방식이다. 이득은 대기가 많은 작업에서만 난다. CPU 계산은 어차피 코어 수만큼만 병렬이라 가상 스레드로 빨라지지 않는다. Java 24(JEP 491)부터는 `synchronized` 안에서 블로킹해도 캐리어를 붙잡지 않으므로, 기존 코드를 고치지 않고도 대부분 그대로 쓸 수 있다.

이 장의 셋째 원리가 여기서 완성된다. 할 일을 `Runnable`로 만들어 두었다면 그것을 `Thread`에 넘기든, 풀에 넘기든, 가상 스레드에 넘기든 코드는 같다. 스레드를 어떻게 만들지는 실행 환경의 결정이지 작업의 결정이 아니다.

---

## 9. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 스레드 | 스택은 따로, 힙은 함께 | 문제도 해법도 공유된 힙의 객체에 있다 |
| 이득 | 대기가 많을 때, 코어가 여럿일 때 | 계산만 있으면 코어 수 이상 빨라지지 않는다 |
| `Runnable` | 할 일과 실행자의 분리 | 같은 작업을 스레드, 풀, 가상 스레드에 넘긴다 |
| `start()` | 새 스택을 만들고 `run()`을 부른다 | `run()` 직접 호출은 그냥 메서드다 |
| 예외 | 스레드 경계를 넘지 않는다 | 전파는 자기 스택을 거슬러 오를 뿐이다 |
| 종료 조건 | 사용자 스레드가 없을 때 | 데몬은 배경 작업이라 기다리지 않는다 |
| `interrupt()` | 멈추라는 부탁 | `stop()`은 락을 쥔 채 죽여 객체를 깨뜨렸다 |
| 원자성 | `count++`는 세 명령 | 사이에 끼어들면 갱신이 사라진다 |
| 가시성 | 바꿔도 안 보일 수 있다 | 캐시와 JIT 최적화. `volatile`이 알려 준다 |
| `volatile` | 가시성만 | 읽고 더하고 쓰는 사이는 못 막는다 |
| `synchronized` | 모니터 락. 셋 다 해결 | 한 번에 한 스레드, 해제 후 획득에 가시성 |
| `wait()`가 `Object`에 | 모든 객체가 모니터 | 어떤 객체든 대기 집합을 가질 수 있다 |
| `wait()`는 락 안에서 | 검사와 대기 사이의 틈 | 틈에 온 `notify()`는 사라진다 |
| `while`로 검사 | 깨어남은 조건 보장이 아니다 | 다른 스레드가 먼저 가져가거나 가짜 깨어남 |
| 교착 | 감지는 되지만 못 푼다 | 락을 빼앗으면 객체가 깨진다. 순서 통일로 예방 |
| `ReentrantLock` | 기한, 인터럽트, 조건 분리 | `finally`로 직접 풀어야 한다 |
| `AtomicInteger` | 락 없는 원자성 | CPU의 CAS 명령 |
| `ExecutorService` | 스레드 풀과 작업 큐 | 생성 비용, 개수 제한, 종료 절차 |
| `submit()`의 예외 | `Future` 안에 보관 | `get()`을 안 부르면 사라진다 |
| `CompletableFuture` | 결과에 다음 일을 잇는다 | 기다리는 스레드가 없다. 풀은 데몬 |
| 가상 스레드 | 싸서 작업마다 하나 | 스택을 힙에, 스케줄링을 JVM이. 대기 작업용 |

| 필요한 것 | 도구 |
|:----------|:-----|
| 스레드 여럿이 읽고 쓰는 값 하나 | `AtomicInteger`, `AtomicReference` |
| 여러 필드를 함께 바꾸는 임계 영역 | `synchronized`, 필요하면 `ReentrantLock` |
| 한 스레드가 쓰고 여럿이 읽는 플래그 | `volatile` |
| 조건이 될 때까지 대기 | `wait`/`notifyAll`, `Condition`, `BlockingQueue` |
| 작업 실행 | `ExecutorService`. 대기가 많으면 가상 스레드 |
| 여러 스레드가 쓰는 컬렉션 | `ConcurrentHashMap`, `CopyOnWriteArrayList` |
