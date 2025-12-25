---
title: "스레드 안전성 (Thread Safety)"
weight: 1
---

# 스레드 안전성 (Thread Safety)

스레드에 안전한 코드를 작성하는 것은 근본적으로 **상태(state)**, 특히 **공유되고 변경 가능한 상태**에 대한 접근을 관리하는 것이다.

## 핵심 개념 요약

| 개념 | 설명 |
|------|------|
| **공유(Shared)** | 여러 스레드가 특정 변수에 접근할 수 있음 |
| **변경 가능(Mutable)** | 해당 변수 값이 변경될 수 있음 |
| **스레드 안전성** | 데이터에 제어 없이 동시 접근하는 것을 막는 것 |

## 잘못된 프로그램을 고치는 3가지 방법

1. 해당 상태 변수를 **스레드 간에 공유하지 않거나**
2. 해당 상태 변수를 **변경할 수 없도록** 만들거나
3. 해당 상태 변수에 접근할 땐 **언제나 동기화**를 사용한다

---

## 1. 스레드 안전성이란?

> **여러 스레드가 클래스에 접근할 때, 실행 환경이 해당 스레드들의 실행을 어떻게 스케줄하든 어디에 끼워 넣든, 호출하는 쪽에서 추가적인 동기화나 다른 조율 없이도 정확하게 동작하면 해당 클래스는 스레드 안전하다.**

### 정확성(Correctness)의 구성요소

- **불변조건(Invariants)**: 객체 상태를 제약하는 조건
- **후조건(Postcondition)**: 연산 수행 후 효과를 기술

### 예제: 상태 없는 서블릿 (Thread Safe)

```java
@ThreadSafe
public class StatelessFactorizer implements Servlet {

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        BigInteger[] factors = factor(i);
        encodeIntoResponse(resp, factors);
    }
}
```

**왜 스레드 안전한가?**
- 인스턴스 변수가 없음
- 지역 변수는 스레드의 스택에 저장되어 해당 스레드에서만 접근 가능
- 두 스레드가 상태를 공유하지 않음

> **상태 없는 객체는 항상 스레드 안전하다.**

---

## 2. 단일 연산 (Atomicity)

### 스레드 안전하지 않은 예제

```java
@NotThreadSafe
public class UnsafeCountingFactorizer implements Servlet {
    private long count = 0;

    public long getCount() { return count; }

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        BigInteger[] factors = factor(i);
        ++count;  // 위험! 단일 연산이 아님
        encodeIntoResponse(resp, factors);
    }
}
```

**`++count`는 왜 문제인가?**

`++count`는 실제로 3개의 연산으로 구성된다:
1. 현재 값을 읽는다 (Read)
2. 1을 더한다 (Modify)
3. 새 값을 저장한다 (Write)

```
스레드 A: count 읽기 (0) → 1 더하기 → 저장하기 (1)
스레드 B:      count 읽기 (0) → 1 더하기 → 저장하기 (1)
                     ↑
              타이밍 문제로 같은 값을 읽음!

결과: count는 2가 아니라 1이 됨
```

### 추가 예제: 경쟁 조건 시연

```java
public class RaceConditionDemo {
    private int counter = 0;

    public void increment() {
        counter++;
    }

    public static void main(String[] args) throws InterruptedException {
        RaceConditionDemo demo = new RaceConditionDemo();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) {
                demo.increment();
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) {
                demo.increment();
            }
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();

        // 예상: 20000, 실제: 20000보다 작은 값 (매번 다름)
        System.out.println("Counter: " + demo.counter);
    }
}
```

### 2.1 경쟁 조건 (Race Condition)

타이밍이 안 좋을 때 결과가 잘못될 가능성을 **경쟁 조건**이라고 한다.

#### 경쟁 조건 vs 데이터 경쟁

| 구분 | 설명 |
|------|------|
| **경쟁 조건 (Race Condition)** | 상대적인 시점이나 스레드 교차 실행에 따라 결과가 달라지는 상황 |
| **데이터 경쟁 (Data Race)** | 공유된 non-final 필드에 대한 접근을 동기화로 보호하지 않은 상황 |

둘 다 병렬 프로그램을 예측 불가능하게 실패하게 만든다.

#### 점검 후 행동 (Check-Then-Act)

```java
// 위험한 패턴!
if (instance == null) {           // 점검
    instance = new Object();      // 행동
}
```

점검 시점과 행동 시점 사이에 다른 스레드가 끼어들 수 있다.

#### 읽고-수정하고-쓰기 (Read-Modify-Write)

```java
// 위험한 패턴!
count++;  // 읽고 → 수정하고 → 쓰기
```

### 2.2 늦은 초기화의 경쟁 조건

```java
@NotThreadSafe
public class LazyInitRace {
    private ExpensiveObject instance = null;

    public ExpensiveObject getInstance() {
        if (instance == null) {
            instance = new ExpensiveObject();  // 경쟁 조건!
        }
        return instance;
    }
}
```

**문제**: 두 스레드가 동시에 `getInstance()`를 호출하면 서로 다른 인스턴스를 받을 수 있다.

### 2.3 복합 동작 (Compound Action)

여러 개의 연산이 하나의 단일 연산으로 실행되어야 하는 것을 **복합 동작**이라 한다.

### 해결책: Atomic 변수 사용

```java
@ThreadSafe
public class CountingFactorizer implements Servlet {
    private final AtomicLong count = new AtomicLong(0);

    public long getCount() { return count.get(); }

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        BigInteger[] factors = factor(i);
        count.incrementAndGet();  // 단일 연산으로 증가
        encodeIntoResponse(resp, factors);
    }
}
```

### 추가 예제: AtomicInteger 활용

```java
import java.util.concurrent.atomic.AtomicInteger;

public class AtomicCounterDemo {
    private AtomicInteger counter = new AtomicInteger(0);

    public void increment() {
        counter.incrementAndGet();
    }

    public int get() {
        return counter.get();
    }

    // compareAndSet 활용
    public boolean compareAndIncrement(int expected) {
        return counter.compareAndSet(expected, expected + 1);
    }

    // getAndUpdate 활용 (Java 8+)
    public int multiplyAndGet(int multiplier) {
        return counter.updateAndGet(x -> x * multiplier);
    }
}
```

---

## 3. 락 (Lock)

### 여러 상태 변수의 문제

```java
@NotThreadSafe
public class UnsafeCachingFactorizer implements Servlet {
    private final AtomicReference<BigInteger> lastNumber
        = new AtomicReference<>();
    private final AtomicReference<BigInteger[]> lastFactors
        = new AtomicReference<>();

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        if (i.equals(lastNumber.get())) {
            encodeIntoResponse(resp, lastFactors.get());
        } else {
            BigInteger[] factors = factor(i);
            lastNumber.set(i);      // 여기서 끊기면?
            lastFactors.set(factors);
            encodeIntoResponse(resp, factors);
        }
    }
}
```

**문제**: `lastNumber`와 `lastFactors`가 서로 일치하지 않을 수 있다.

> **상태를 일관성 있게 유지하려면 관련 있는 변수들을 하나의 단일 연산으로 갱신해야 한다.**

### 3.1 암묵적인 락 (Intrinsic Lock)

자바의 모든 객체는 락으로 사용할 수 있다. 이를 **암묵적인 락** 또는 **모니터 락**이라고 한다.

```java
synchronized (lock) {
    // lock으로 보호된 공유 상태에 접근하거나 수정한다
}
```

#### synchronized 메소드

```java
public class SynchronizedCounter {
    private int count = 0;

    // 인스턴스 메소드: this를 락으로 사용
    public synchronized void increment() {
        count++;
    }

    public synchronized int getCount() {
        return count;
    }

    // static 메소드: Class 객체를 락으로 사용
    public static synchronized void staticMethod() {
        // ...
    }
}
```

### 3.2 재진입성 (Reentrancy)

자바의 암묵적인 락은 **재진입 가능**하다. 같은 스레드가 이미 보유한 락을 다시 획득할 수 있다.

```java
public class ReentrantExample {

    public synchronized void outer() {
        System.out.println("outer");
        inner();  // 같은 락을 다시 획득 (재진입)
    }

    public synchronized void inner() {
        System.out.println("inner");
    }
}
```

#### 재진입이 없다면?

```java
public class Widget {
    public synchronized void doSomething() {
        // ...
    }
}

public class LoggingWidget extends Widget {
    public synchronized void doSomething() {
        System.out.println("Calling doSomething");
        super.doSomething();  // 재진입 불가능하면 데드락!
    }
}
```

---

## 4. 락으로 상태 보호하기

### 핵심 규칙

> **여러 스레드에서 접근할 수 있고 변경 가능한 모든 변수를 대상으로 해당 변수에 접근할 때는 항상 동일한 락을 먼저 확보한 상태여야 한다.**

> **모든 변경할 수 있는 공유 변수는 정확하게 단 하나의 락으로 보호해야 한다.**

> **여러 변수에 대한 불변조건이 있으면 해당 변수들은 모두 같은 락으로 보호해야 한다.**

### 올바른 동기화 예제

```java
@ThreadSafe
public class SafeCachingFactorizer implements Servlet {
    private BigInteger lastNumber;
    private BigInteger[] lastFactors;

    public synchronized void service(ServletRequest req,
                                     ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        if (i.equals(lastNumber)) {
            encodeIntoResponse(resp, lastFactors.clone());
        } else {
            BigInteger[] factors = factor(i);
            lastNumber = i;
            lastFactors = factors.clone();
            encodeIntoResponse(resp, factors);
        }
    }
}
```

### 추가 예제: 세밀한 락 사용

```java
@ThreadSafe
public class BetterCachingFactorizer implements Servlet {
    private BigInteger lastNumber;
    private BigInteger[] lastFactors;
    private long hits;
    private long cacheHits;

    public synchronized long getHits() { return hits; }
    public synchronized double getCacheHitRatio() {
        return (double) cacheHits / hits;
    }

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        BigInteger[] factors = null;

        // 락 범위를 최소화
        synchronized (this) {
            hits++;
            if (i.equals(lastNumber)) {
                cacheHits++;
                factors = lastFactors.clone();
            }
        }

        if (factors == null) {
            factors = factor(i);  // 비용이 큰 연산은 락 밖에서
            synchronized (this) {
                lastNumber = i;
                lastFactors = factors.clone();
            }
        }
        encodeIntoResponse(resp, factors);
    }
}
```

---

## 5. 가시성 (Visibility)

동기화는 **단일 연산 보장** 외에도 **가시성**을 보장한다.

### 가시성 문제

```java
public class NoVisibility {
    private static boolean ready;
    private static int number;

    public static void main(String[] args) {
        new Thread(() -> {
            while (!ready) {
                Thread.yield();
            }
            System.out.println(number);
        }).start();

        number = 42;
        ready = true;
    }
}
```

**문제점**:
- 영원히 루프를 돌 수 있음 (ready 변경이 안 보일 수 있음)
- 0을 출력할 수 있음 (재정렬로 ready가 먼저 true가 될 수 있음)

### volatile 키워드

`volatile`은 가시성만 보장하고, 단일 연산성은 보장하지 않는다.

```java
public class VolatileExample {
    private volatile boolean stopped = false;

    public void stop() {
        stopped = true;  // 다른 스레드에서 즉시 볼 수 있음
    }

    public void run() {
        while (!stopped) {
            doWork();
        }
    }
}
```

#### volatile 사용 조건

- 변수에 값을 저장할 때 현재 값과 무관한 경우
- 락이 필요 없는 경우
- 단일 스레드에서만 쓰기가 발생하는 경우

```java
// 올바른 volatile 사용
private volatile boolean flag;  // 상태 플래그

// 잘못된 volatile 사용
private volatile int count;
count++;  // 여전히 경쟁 조건 발생!
```

---

## 6. 안전한 늦은 초기화 패턴

### Double-Checked Locking (DCL)

```java
public class SafeLazyInit {
    private volatile ExpensiveObject instance;

    public ExpensiveObject getInstance() {
        if (instance == null) {                     // 첫 번째 체크 (락 없이)
            synchronized (this) {
                if (instance == null) {             // 두 번째 체크 (락 안에서)
                    instance = new ExpensiveObject();
                }
            }
        }
        return instance;
    }
}
```

**주의**: `volatile`이 반드시 필요하다!

### 홀더 클래스 패턴 (권장)

```java
public class SafeLazyInitHolder {

    private static class Holder {
        static final ExpensiveObject INSTANCE = new ExpensiveObject();
    }

    public static ExpensiveObject getInstance() {
        return Holder.INSTANCE;  // 클래스 로딩 시점에 초기화
    }
}
```

**장점**:
- JVM의 클래스 초기화 메커니즘을 활용
- 추가적인 동기화 불필요
- 지연 초기화 보장

---

## 7. 주요 동기화 도구 비교

| 도구 | 단일 연산 | 가시성 | 사용 사례 |
|------|----------|--------|----------|
| `synchronized` | O | O | 복합 동작, 여러 변수 보호 |
| `volatile` | X | O | 상태 플래그, 단순 읽기/쓰기 |
| `AtomicXxx` | O | O | 단일 변수의 단일 연산 |
| `Lock` (명시적 락) | O | O | 고급 락 기능 필요 시 |

---

## 정리

1. **상태 없는 객체**는 항상 스레드 안전하다.

2. **복합 동작**(점검 후 행동, 읽고 수정하고 쓰기)은 **단일 연산**으로 실행되어야 한다.

3. **여러 상태 변수**가 불변조건을 구성하면 **같은 락**으로 보호해야 한다.

4. 동기화는 **단일 연산성**과 **가시성** 두 가지를 모두 보장한다.

5. **성능보다 정확성**이 먼저다. 올바르게 동작하는 코드를 먼저 작성하고, 필요할 때만 최적화하라.

6. 락의 범위는 **필요한 만큼만** 최소화하되, **불변조건은 반드시 보호**해야 한다.
