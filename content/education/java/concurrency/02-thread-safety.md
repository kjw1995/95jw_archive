---
title: "스레드 안전성 (Thread Safety)"
date: 2025-12-25
weight: 1
---

자바 기초에서 스레드는 스택만 따로 갖고 힙은 함께 쓴다고 했다([자바 기초 13](../../basics/13-thread)). 이 시리즈는 그 "함께 쓰는 힙"에서 무엇이 잘못되고 어떻게 막는지를 본다. 원리는 셋이다. 첫째, **스레드 안전성은 코드가 아니라 상태의 문제다.** 여러 스레드가 닿을 수 있고(공유) 값이 바뀔 수 있는(변경 가능) 상태에 대한 접근을 관리하는 것이 전부다. 상태가 없는 객체는 아무것도 하지 않아도 안전하고, 상태가 있으면 공유하지 않거나, 못 바꾸게 하거나, 언제나 동기화하거나 셋 중 하나를 골라야 한다. 둘째, **소스 한 줄이 한 번에 실행된다는 보장은 없다.** `count++`는 바이트코드로 읽기, 더하기, 쓰기 셋이고 그 틈에 다른 스레드가 끼어들면 갱신이 사라진다. 그래서 여러 단계가 하나로 보여야 하는 복합 동작은 단일 연산으로 묶어야 하고, 도구는 원자 변수와 락이다. 셋째, **락은 변수가 아니라 불변조건을 지킨다.** 변수 하나면 원자 변수로 족하지만 변수 둘이 서로 맞아야 하면 둘을 같은 락 하나로 묶어야 한다. 그 락은 필요한 만큼만 짧게 잡되 불변조건은 통째로 감싼다. 이 PC(Apple M4 10코어, JDK 23)에서 책의 예제를 실제로 돌려 각 원리가 깨지는 순간과 고쳐지는 순간을 숫자로 봤다.

---

## 1. 스레드 안전성이란?

```text
공유되고 변경 가능한 상태가 있는가?
    │
    ├─ 공유하지 않는다 → 스레드 한정
    ├─ 변경하지 않는다 → 불변 객체
    └─ 둘 다 아니다   → 동기화 (이 장)
```

| 개념 | 뜻 | 왜 중요한가 |
|:-----|:---|:-----------|
| 공유(shared) | 여러 스레드가 그 변수에 닿을 수 있다 | 한 스레드만 쓰는 변수는 아무 문제가 없다 |
| 변경 가능(mutable) | 값이 바뀔 수 있다 | 안 바뀌는 값은 몇 스레드가 읽어도 같다 |
| 스레드 안전 | 스케줄링과 끼어드는 순서가 어떻든, 호출하는 쪽의 추가 조율 없이 정확하게 동작한다 | 호출하는 쪽이 락을 챙겨야 한다면 그 클래스는 안전하지 않은 것이다 |
| 정확성 | 명세대로 동작한다 | 명세는 불변조건과 후조건으로 적힌다 |
| 불변조건(invariant) | 상태가 항상 지켜야 하는 조건 | 예: 캐시의 숫자와 인수 목록은 항상 짝이 맞는다 |
| 후조건(postcondition) | 연산이 끝난 뒤 성립해야 하는 조건 | 예: `increment()` 뒤의 값은 이전 값 더하기 1 |

첫째 원리다. 책의 정의는 이렇다. "여러 스레드가 클래스에 접근할 때, 실행 환경이 그 스레드들의 실행을 어떻게 스케줄하든 어디에 끼워 넣든, 호출하는 쪽에서 추가적인 동기화나 다른 조율 없이도 정확하게 동작하면 그 클래스는 스레드 안전하다." 핵심은 마지막 구절이다. 스레드 안전한 클래스는 동기화를 **자기 안에 캡슐화**하므로 쓰는 쪽은 아무것도 몰라도 된다.

| 고치는 법 | 뜻 | 어디서 다루나 |
|:---------|:---|:------------|
| 공유하지 않는다 | 스레드마다 자기 것을 쓴다. 지역 변수, `ThreadLocal` | [03](../03-object-sharing)장 3절 스레드 한정 |
| 변경할 수 없게 한다 | 만든 뒤 바뀌지 않는 객체는 몇 스레드가 봐도 같다 | [03](../03-object-sharing)장 4절 불변성 |
| 언제나 동기화한다 | 접근할 때마다 같은 락을 잡는다 | 이 장 |

셋 중 무엇을 고르든 좋고, 셋 중 하나는 반드시 골라야 한다. "가끔만 동기화"는 없다. 그리고 상태를 캡슐화한 객체일수록 셋 중 하나를 고르기 쉽다. 상태가 여러 클래스에 흩어져 있으면 그 상태에 닿는 모든 코드를 찾아 검사해야 하기 때문이다. 객체지향의 캡슐화가 동시성에서도 첫 번째 도구인 이유다.

### 스레드는 어디서 오나

| 프레임워크 | 스레드를 만드는 쪽 | 내 코드에 미치는 영향 |
|:----------|:---------------|:------------------|
| 서블릿, 스프링 MVC | 컨테이너가 요청마다 스레드를 배정 | 서블릿·컨트롤러 인스턴스는 하나, 그 안의 필드는 공유 상태 |
| 타이머, 스케줄러 | 타이머 스레드가 작업을 실행 | 작업이 건드리는 객체는 메인 스레드와 공유 |
| RMI, gRPC 서버 | 원격 호출마다 스레드 | 원격 객체의 필드는 공유 상태 |
| Swing, JavaFX | 이벤트 디스패치 스레드 | 이벤트 핸들러와 백그라운드 작업이 모델을 공유 |

"나는 스레드를 만든 적이 없는데"라는 말은 자바에서 통하지 않는다. 스레드를 만드는 것은 프레임워크이고, 내 코드는 그 스레드 위에서 불린다. 이 장의 예제가 전부 서블릿인 이유다. 서블릿은 인스턴스가 하나이고 톰캣이 요청마다 다른 스레드로 `service()`를 부르므로, 필드 하나만 있어도 그것이 곧 공유되고 변경 가능한 상태가 된다.

### 상태 없는 서블릿

```java
@ThreadSafe
public class StatelessFactorizer
        implements Servlet {

    public void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        var factors = factor(i);
        encodeIntoResponse(resp,
            factors);
    }
}
```

인수분해 서블릿이다. 필드가 없고, `i`와 `factors`는 지역 변수다. 지역 변수는 스레드마다 따로 있는 JVM 스택에 놓이므로([JVM 자동 메모리 관리](../../jvm/memory-management) 1절) 다른 스레드가 닿을 길이 없다. 두 스레드가 동시에 `service()`를 돌려도 서로의 존재를 모른다. **상태 없는 객체는 항상 스레드 안전하다.** 첫째 원리의 가장 쉬운 경우이고, 서블릿 대부분이 여기서 출발한다. 문제는 여기에 필드를 하나 더하는 순간 시작된다.

{{< callout type="info" >}}
`@ThreadSafe`, `@NotThreadSafe`, `@GuardedBy`는 JDK에 없는 애노테이션이다. 책이 제안한 `net.jcip.annotations`(jcip-annotations) 또는 `javax.annotation.concurrent`(JSR-305)에 들어 있고, 컴파일러가 검사해 주지는 않는다. 그래도 붙여 둘 가치가 있다. 클래스의 **동기화 정책을 읽는 사람에게 알리는** 문서이고, SpotBugs 같은 정적 분석기는 `@GuardedBy`로 표시한 필드를 락 없이 건드리는 코드를 잡아 준다. 정책을 문서로 남기는 방법은 [04](../04-composing-objects)장 5절에서 본다.
{{< /callout >}}

---

## 2. 단일 연산 (Atomicity)

```java
@NotThreadSafe
public class UnsafeCountingFactorizer
        implements Servlet {
    private long count = 0;

    public long getCount() {
        return count;
    }

    public void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        var factors = factor(i);
        ++count;   // 단일 연산이 아니다
        encodeIntoResponse(resp,
            factors);
    }
}
```

요청 수를 세는 필드 하나를 더했다. 단일 스레드라면 완벽하고, 동시에 두 요청이 들어오면 세는 값이 틀린다. 둘째 원리다. 소스 한 줄 `++count`가 JVM에서는 한 번에 실행되지 않는다. 이 PC에서 `javap -c`로 바이트코드를 보면 이렇다.

```text
getfield  count   // 1. 현재 값을 읽고
lconst_1          // 2. 1을 준비해
ladd              //    더한 뒤
putfield  count   // 3. 다시 쓴다
```

읽고, 수정하고, 쓰는 세 단계이고, 각 단계 사이에 다른 스레드가 끼어들 수 있다.

```text
스레드 A            스레드 B
읽기 count=0
                   읽기 count=0
더하기 → 1
                   더하기 → 1
쓰기 count=1
                   쓰기 count=1
────────────────────────────
결과 1, 기대 2. 갱신 하나가 사라짐
```

두 스레드가 같은 0을 읽으면 둘 다 1을 쓰고, 한 요청은 세지지 않은 것이 된다. 이 PC에서 스레드가 각각 10만 번씩 `count++`를 돌리게 해 봤다.

| 스레드 수 | 기대값 | 실제값 (5회) | 사라진 갱신 |
|:--------|------:|:-----------|:----------|
| 2 | 200,000 | 100,522 ~ 116,526 | 42~50% |
| 10 | 1,000,000 | 135,949 ~ 268,535 | 73~86% |

절반 가까이 사라졌고, 스레드가 늘수록 더 사라졌으며, 다섯 번 돌려 다섯 번 값이 달랐다. 이 "매번 다르다"가 동시성 버그의 본성이다. 테스트 한 번 통과한 것은 아무 증거가 못 된다.

### 2.1 경쟁 조건 (Race Condition)

| 구분 | 뜻 | 왜 다른가 |
|:-----|:---|:---------|
| 경쟁 조건 | 결과가 스레드의 상대적 타이밍이나 끼어드는 순서에 따라 달라지는 상황. 맞는 답이 **운 좋은 타이밍**에 달렸다 | 논리의 문제. 동기화된 연산들을 잘못 조합해도 생긴다 |
| 데이터 경쟁 | 여러 스레드가 읽고 적어도 하나가 쓰는 변수를 동기화 없이 접근하는 상황 | 메모리 모델의 문제. 값이 안 보이거나 반쯤 보인다. [03](../03-object-sharing)장 1절 |

둘은 겹치지만 같지 않다. 위의 `count++`는 둘 다이고, 4절에서 볼 `Vector`의 넣기 예제는 데이터 경쟁 없이 경쟁 조건만 있는 경우다. 어느 쪽이든 프로그램은 예측할 수 없이, 그것도 드물게 실패한다.

**점검 후 행동 (check-then-act)**

```java
if (instance == null) {          // 점검
    instance = new Object();     // 행동
}
```

점검이 참이었다는 사실이 행동하는 순간에도 참이라는 보장이 없다. 점검과 행동 사이에 다른 스레드가 같은 점검을 통과할 수 있다.

**읽고 수정하고 쓰기 (read-modify-write)**

```java
count++;   // 읽기 → 더하기 → 쓰기
```

새 값이 이전 값에 달려 있는데, 그 이전 값이 이미 낡은 값일 수 있다.

### 2.2 늦은 초기화의 경쟁 조건

```java
@NotThreadSafe
public class LazyInitRace {
    private Expensive instance = null;

    Expensive getInstance() {
        if (instance == null)
            instance = new Expensive();
        return instance;
    }
}
```

점검 후 행동의 대표다. 만드는 데 비싼 객체 `Expensive`를 처음 필요할 때 만들려는 흔한 코드이고, 두 스레드가 동시에 `null`을 보면 객체가 둘 만들어져 서로 다른 것을 돌려받는다. 이 PC에서 스레드 10개가 동시에 `getInstance()`를 부르는 실험을 1,000번 반복했다.

| 방식 | 인스턴스가 둘 이상 만들어진 횟수 | 최대 |
|:-----|:-----------------------------|:----|
| 위 코드 그대로 | 1,000번 중 991번 | 10개 |
| `getInstance()`에 `synchronized` | 0번 | 1개 |

거의 매번 깨졌고, 스레드 10개가 각자 자기 것을 만든 경우도 있었다. 싱글톤이어야 할 객체가 열 개면 캐시는 열 벌이 되고 커넥션 풀은 열 배가 된다. 고치는 법은 7절에서 본다.

### 2.3 복합 동작 (Compound Action)

연산 A와 B가 서로에 대해 **단일 연산(atomic)**이라는 것은, A를 수행하는 스레드가 볼 때 B는 전부 실행됐거나 전혀 실행되지 않은 상태 둘 중 하나라는 뜻이다. 그 중간이 보이지 않는다. 점검 후 행동과 읽고 수정하고 쓰기처럼, 안전하려면 **여러 단계가 하나의 단일 연산으로 실행되어야 하는 묶음**을 복합 동작이라 한다. 각 단계가 각각 안전한지는 상관없다. 묶음이 안전해야 한다.

```java
@ThreadSafe
public class CountingFactorizer
        implements Servlet {
    private final AtomicLong count =
        new AtomicLong(0);

    public long getCount() {
        return count.get();
    }

    public void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        var factors = factor(i);
        // 읽고 더하고 쓰기가 한 번에
        count.incrementAndGet();
        encodeIntoResponse(resp,
            factors);
    }
}
```

`AtomicLong`은 읽고 더하고 쓰는 세 단계를 하나로 만든다. 원리는 CPU의 **비교 후 교환(CAS, compare-and-swap)** 명령이다. "값이 아직 v이면 v+1로 바꿔라"를 하드웨어가 한 번에 처리하고, 그 사이에 누가 바꿨으면 실패를 돌려준다.

```text
do {
    v   = count.get();       // 읽기
    new = v + 1;             // 수정
} while (!CAS(count, v, new)) // 쓰기
// 실패하면 새 값으로 다시 시도
```

`incrementAndGet()`은 이 루프다. 락을 잡고 기다리는 대신 실패하면 다시 시도하므로 블로킹이 없고, 스레드 하나가 멈춰도 다른 스레드가 막히지 않는다. 같은 실험에서 `AtomicLong`은 2스레드, 10스레드 모두 정확히 200,000과 1,000,000을 냈다.

```java
public class AtomicCounterDemo {
    private final AtomicInteger counter
        = new AtomicInteger(0);

    public void increment() {
        counter.incrementAndGet();
    }

    // 기대값과 같을 때만 바꾼다
    public boolean compareAndIncrement(
            int expected) {
        return counter.compareAndSet(
            expected, expected + 1);
    }

    // 아무 함수나 단일 연산으로
    public int multiplyAndGet(int m) {
        return counter.updateAndGet(
            x -> x * m);
    }
}
```

`compareAndSet`이 CAS 그 자체이고, `updateAndGet`은 CAS 루프에 내 함수를 끼운 것이다. 함수는 실패하면 다시 불리므로 부수 효과가 없어야 한다. 상태 변수가 **하나**이고 그 변수에 대한 연산이 전부 원자 클래스가 제공하는 것이라면, 여기까지가 필요한 전부다. 가능하면 이미 있는 스레드 안전 객체로 상태를 관리하는 것이 직접 락을 다루는 것보다 쉽고 안전하다.

| 스레드 | `synchronized` | `AtomicLong` | `LongAdder` |
|:------|-------------:|------------:|-----------:|
| 1 | 6 ms | 3 ms | 10 ms |
| 4 | 300 ms | 109 ms | 9 ms |
| 10 | 677 ms | 754 ms | 15 ms |

{{< callout type="warning" >}}
**원자 변수가 락보다 항상 빠른 것은 아니다.** 위 표는 이 PC에서 스레드마다 200만 번씩 증가시키는 데 걸린 시간이다. 경쟁이 없거나 적을 때는 CAS가 락보다 싸지만, 스레드 10개가 한 변수를 두고 다투면 CAS가 계속 실패해 다시 시도하느라 `synchronized`보다 느려졌다. 세는 것만 필요하고 정확한 현재값을 매번 읽을 필요가 없다면 스레드마다 칸을 나눠 더하는 `LongAdder`가 수십 배 빠르다. 도구는 경쟁 정도로 고른다.
{{< /callout >}}

---

## 3. 락 (Lock)

```java
@NotThreadSafe
public class UnsafeCachingFactorizer
        implements Servlet {
    final AtomicReference<BigInteger>
        lastNumber =
            new AtomicReference<>();
    final AtomicReference<BigInteger[]>
        lastFactors =
            new AtomicReference<>();

    public void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        var last = lastNumber.get();
        if (i.equals(last)) {
            encodeIntoResponse(resp,
                lastFactors.get());
        } else {
            var factors = factor(i);
            // 여기서 끊기면?
            lastNumber.set(i);
            lastFactors.set(factors);
            encodeIntoResponse(resp,
                factors);
        }
    }
}
```

마지막에 계산한 숫자와 그 인수를 기억해 두는 캐시다. 원자 변수를 둘 썼으니 안전할 것 같지만 아니다. 이 클래스의 불변조건은 "`lastFactors`의 곱은 `lastNumber`다"이고, 두 변수를 따로 갱신하는 동안 다른 스레드가 `lastNumber`는 새것, `lastFactors`는 헌것인 순간을 볼 수 있다. 셋째 원리다. 원자 변수 둘이 원자 연산 하나가 되지는 않는다. 이 PC에서 스레드 10개가 360과 1001을 번갈아 총 200만 번 물으면서, 돌아온 인수의 곱이 물은 숫자와 같은지 검사했다.

| 방식 | 틀린 답 (200만 번 중) |
|:-----|:-------------------|
| 위 코드 (`AtomicReference` 둘) | 70,787 / 84,022 / 97,779 (세 번 실행) |
| `synchronized`로 둘을 함께 갱신 | 0 |

3.5~4.9%가 틀린 답이었다. 360을 물었는데 1001의 인수인 7×11×13을 받은 것이다. **상태를 일관성 있게 유지하려면 관련 있는 변수들을 하나의 단일 연산으로 갱신해야 한다.** 그 도구가 락이다.

### 3.1 암묵적인 락 (Intrinsic Lock)

```java
synchronized (lock) {
    // lock으로 보호되는 공유 상태에
    // 접근하거나 수정한다
}
```

자바의 모든 객체는 락으로 쓸 수 있다. 이것을 **암묵적인 락** 또는 **모니터 락**이라 한다. `synchronized` 블록은 락으로 쓸 객체와 그 락이 보호하는 코드로 이루어지고, 블록에 들어갈 때 락을 얻고 나올 때(정상이든 예외든) 놓는다.

```text
┌──────────────────────────────┐
│ 객체 헤더의 모니터           │
│   소유자 : 스레드 A          │
│   횟수   : 2  (재진입 깊이)  │
│   대기열 : 스레드 B, C       │
└──────────────────────────────┘
```

암묵적인 락은 **상호 배제 락(mutex)**이다. 한 번에 한 스레드만 소유할 수 있고, B가 A의 락을 얻으려 하면 A가 놓을 때까지 **블록**된다. 누가 갖고 있는지와 몇 번 잡았는지는 객체 헤더에 기록된다([JVM 자동 메모리 관리](../../jvm/memory-management) 3절 Mark Word). 그래서 같은 락으로 보호되는 블록들은 언제나 한 스레드씩 순서대로 실행되고, 블록 안의 여러 단계가 다른 스레드에게 하나로 보인다.

```java
public class SynchronizedCounter {
    private int count = 0;

    // 인스턴스 메서드: this가 락
    synchronized void increment() {
        count++;
    }

    synchronized int getCount() {
        return count;
    }

    // static 메서드: Class 객체가 락
    static synchronized void reset() {
        // ...
    }
}
```

메서드에 붙인 `synchronized`는 메서드 전체를 블록으로 감싼 것이고 락은 `this`다. 정적 메서드면 `SynchronizedCounter.class`가 락이다. 둘은 서로 다른 락이므로 인스턴스 메서드와 정적 메서드는 서로를 막지 않는다.

{{< callout type="warning" >}}
**락은 객체가 갖는 것이지 변수가 갖는 것이 아니다.** 흔한 실수 셋.
- `synchronized (new Object())`처럼 매번 새 객체를 잠그면 아무도 같은 락을 잡지 않으니 아무것도 보호되지 않는다.
- `String` 리터럴이나 `Integer.valueOf(1)`처럼 JVM이 공유하는 객체를 잠그면 전혀 다른 클래스가 우연히 같은 락을 잡아 서로를 막는다. 락은 `private final Object lock = new Object()`처럼 내 것으로 둔다.
- `synchronized` 메서드는 `this`를 잠그므로 **바깥 코드도** `synchronized (obj)`로 같은 락을 잡을 수 있다. 의도한 것(4절의 `Vector`)이 아니면 락을 공개한 셈이다. [04](../04-composing-objects)장 4절.
{{< /callout >}}

### 3.2 재진입성 (Reentrancy)

```java
public class Widget {
    synchronized void doSomething() {
        // ...
    }
}

public class LoggingWidget
        extends Widget {
    synchronized void doSomething() {
        System.out.println("calling");
        // 쥔 this 락을 다시 잡는다
        super.doSomething();
    }
}
```

`LoggingWidget.doSomething()`은 `this`를 잠근 채 `super.doSomething()`을 부르고, 그 메서드도 `this`를 잠근다. 락이 **재진입 불가**라면 자기가 쥔 락을 자기가 기다리는 데드락이다. 자바의 암묵적인 락은 재진입 가능하다. 락은 **호출 단위가 아니라 스레드 단위**로 소유되기 때문이다. 이 PC에서 확인한 것은 이렇다.

| 실험 | 결과 |
|:-----|:----|
| `LoggingWidget` 안과 `Widget` 안에서 `Thread.holdsLock(this)` | 둘 다 `true`, 데드락 없음 |
| `ReentrantLock`으로 같은 구조, `getHoldCount()` | 바깥 1 → 안쪽 2 → 안쪽에서 나오며 1 → 바깥에서 나오며 0 |
| 재진입이 없는 `Semaphore(1)`로 같은 구조 | 안쪽 `tryAcquire`가 1초를 기다리고 실패. 타임아웃이 없었다면 영원히 |

원리는 위의 모니터 그림에 있는 소유자와 횟수다. 소유자가 없으면 잡고 횟수를 1로, 소유자가 나 자신이면 횟수만 올리고, 나올 때마다 하나씩 내려 0이 되면 놓는다. 재진입이 없었다면 위처럼 부모 메서드를 부르는 평범한 상속 코드가 전부 데드락이 됐을 것이다.

---

## 4. 락으로 상태 보호하기

| 규칙 | 뜻 | 왜 |
|:-----|:---|:---|
| 접근할 때마다 같은 락 | 여러 스레드가 닿는 변경 가능한 변수는 **읽든 쓰든** 항상 같은 락을 쥔 채 접근한다 | 읽기만 락 없이 하면 갱신 중간 값이나 낡은 값을 본다 |
| 변수 하나에 락 하나 | 변경 가능한 공유 변수는 정확히 하나의 락이 보호한다. 어느 락인지 문서로 남긴다 | 락이 둘이면 서로 다른 락을 쥔 두 스레드가 동시에 들어온다 |
| 불변조건이 걸린 변수는 같은 락 | 여러 변수가 하나의 불변조건을 이루면 그 변수 전부를 같은 락으로 | 3절의 캐시. 변수마다 다른 락이면 짝이 어긋나는 순간이 생긴다 |

"락으로 보호한다"는 것은 언어가 강제하는 것이 아니라 **관례**다. `synchronized (lock)`을 쓴다고 그 안의 변수에 다른 스레드가 못 닿는 것이 아니다. 락이 막는 것은 오직 **다른 스레드가 같은 락을 잡는 것**뿐이므로, 그 변수에 닿는 코드 경로 전부가 같은 락을 잡아야 비로소 보호된다. 하나라도 빠지면 그 경로가 구멍이다.

```java
@ThreadSafe
public class SynchronizedFactorizer
        implements Servlet {
    @GuardedBy("this")
    private BigInteger lastNumber;
    @GuardedBy("this")
    private BigInteger[] lastFactors;

    public synchronized void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        if (i.equals(lastNumber)) {
            encodeIntoResponse(resp,
                lastFactors.clone());
        } else {
            var factors = factor(i);
            lastNumber = i;
            lastFactors =
                factors.clone();
            encodeIntoResponse(resp,
                factors);
        }
    }
}
```

3절의 캐시를 고친 것이다. 원자 변수 대신 평범한 필드를 두고, 두 필드에 닿는 유일한 경로인 `service()` 전체를 `this`로 잠갔다. 점검(`equals`)과 행동(두 필드 갱신)이 한 락 안에 있으니 짝이 어긋나는 순간을 아무도 못 본다. 같은 실험에서 틀린 답은 0이었다. `clone()`은 배열을 그대로 내주면 밖에서 내용을 바꿀 수 있기 때문이고, 그 이야기는 [03](../03-object-sharing)장 2절 유출에서 한다.

### synchronized 메서드를 다 붙이면 안전한가

```java
Vector<Integer> v = new Vector<>();

// contains와 add는 각각 synchronized
// 이어 붙인 "없으면 넣기"는 아니다
if (!v.contains(42))
    v.add(42);
```

흔한 오해가 "메서드마다 `synchronized`를 붙이면 스레드 안전하다"이다. `Vector`의 `contains`와 `add`는 각각 `synchronized`이지만, 둘을 이어 붙인 "없으면 넣기"는 점검 후 행동이라 그 사이에 다른 스레드가 같은 값을 넣을 수 있다. 이 PC에서 스레드 10개가 동시에 이 코드를 실행하는 실험을 1,000번 반복했다.

| 방식 | 42가 둘 이상 들어간 횟수 |
|:-----|:---------------------|
| 위 코드 그대로 | 1,000번 중 1번 (크기 2) |
| `synchronized (v) { ... }`로 감싸기 | 0번 |

```java
// Vector의 락 = this
synchronized (v) {
    if (!v.contains(42))
        v.add(42);
}
```

1,000번에 한 번이다. 2절의 카운터는 절반이 깨져서 눈에 띄지만, 이런 버그는 테스트를 천 번 돌려도 안 보이다가 운영에서 하루에 한 번 나타난다. 고치는 법은 `Vector`가 자기 락으로 `this`를 쓴다는 사실에 기대어 바깥에서 같은 락을 잡는 것이고, 이 "클라이언트 측 락"의 조건은 [04](../04-composing-objects)장 4절에서 본다. 규칙을 한 줄로 줄이면 이렇다. **동기화 정책은 변수가 아니라 불변조건 단위로 세운다.** 클래스 안에서든 밖에서든, 불변조건 하나가 걸친 여러 단계는 같은 락 하나 안에 넣는다.

---

## 5. 활동성과 성능 (Liveness and Performance)

```text
[service() 전체가 synchronized]
요청 10개 ──▶ [락] ──▶ 한 번에 하나
               ▲
        나머지 9개는 줄을 선다
   factor()가 오래 걸릴수록 줄이 길다
```

4절의 `SynchronizedFactorizer`는 정확하지만 서블릿의 존재 이유를 잃었다. 요청마다 스레드를 배정하는 것은 동시에 처리하려는 것인데, `service()` 전체가 한 락 안에 있으면 인수분해가 끝날 때까지 다른 요청이 전부 기다린다. 스레드가 열 개여도 한 번에 하나만 일한다. 이것을 **직렬화(serialization)**라 하고, CPU가 아무리 많아도 처리량은 스레드 하나와 같아진다. 이 PC에서 11자리 소수 16개를 번갈아 인수분해하는 요청(하나에 약 60µs)을 스레드 수를 바꿔 가며 돌렸다.

| 방식 | 스레드 1 | 스레드 10 | 왜 |
|:-----|--------:|--------:|:---|
| 상태 없음 (캐시 없음) | 16,432 req/s | 74,458 req/s | 락이 없으니 코어만큼 는다 |
| `service()` 전체 `synchronized` | 16,134 req/s | 15,139 req/s | 열 개가 줄을 서서 하나와 같다 |
| 락 범위를 좁힌 아래 코드 | 16,644 req/s | 74,170 req/s | 인수분해는 락 밖에서 |

전체를 잠근 쪽은 스레드를 열 배로 늘려도 처리량이 그대로였다. 락 범위를 좁힌 쪽은 락이 없는 쪽과 같았다(열 배가 아닌 4.5배인 것은 M4의 성능 코어가 넷이기 때문이다). 락을 잡고 푸는 비용 자체는 작다. 문제는 **락을 쥔 채로 오래 걸리는 일을 하는 것**이다.

```java
@ThreadSafe
public class CachedFactorizer
        implements Servlet {
    @GuardedBy("this")
    private BigInteger lastNumber;
    @GuardedBy("this")
    private BigInteger[] lastFactors;
    @GuardedBy("this")
    private long hits, cacheHits;

    public synchronized long getHits() {
        return hits;
    }

    public synchronized double
            getCacheHitRatio() {
        return cacheHits
            / (double) hits;
    }

    public void service(
            ServletRequest req,
            ServletResponse resp) {
        var i = extractFromRequest(req);
        BigInteger[] factors = null;

        synchronized (this) {   // 짧게
            ++hits;
            if (i.equals(lastNumber)) {
                ++cacheHits;
                factors =
                    lastFactors.clone();
            }
        }
        if (factors == null) {
            // 무거운 계산은 락 밖에서
            factors = factor(i);
            synchronized (this) {
                lastNumber = i;
                lastFactors =
                    factors.clone();
            }
        }
        encodeIntoResponse(resp,
            factors);
    }
}
```

```text
┌ synchronized ──────────┐
│ hits++, 캐시 확인      │
└────────────┬───────────┘
             │ 락 없음
        factor(i)  ← 오래 걸리는 계산
             │
┌ synchronized ──────────┐
│ 캐시 갱신              │
└────────────────────────┘
```

락은 두 곳에서만 잡는다. 캐시를 확인할 때와 갱신할 때. 각 블록 안은 필드 몇 개를 읽고 쓰는 것뿐이라 순식간에 끝나고, 오래 걸리는 `factor(i)`와 응답 쓰기는 락 밖에 있다. 불변조건(`lastNumber`와 `lastFactors`의 짝, `hits`와 `cacheHits`의 짝)은 각각 한 블록 안에서 통째로 다뤄지므로 셋째 원리도 지켜진다. 히트 카운터에 `AtomicLong`을 쓰지 않은 것도 의도다. 어차피 락 안에서 갱신하는데 원자 변수까지 섞으면 "어느 것이 어떤 규칙으로 보호되는가"가 흐려진다. 도구는 한 가지로 통일하는 것이 읽는 사람에게 낫다.

| 원칙 | 뜻 | 왜 |
|:-----|:---|:---|
| 락은 짧게 | 공유 상태를 읽고 쓰는 부분만 감싼다 | 락을 쥔 시간이 곧 다른 스레드가 기다리는 시간 |
| 오래 걸리는 일은 락 밖에서 | 무거운 계산, 네트워크·콘솔 I/O 중에는 락을 쥐지 않는다 | I/O는 끝나는 시점을 모른다. 그동안 모두 멈춘다 |
| 그러나 불변조건은 통째로 | 짧게 나누되 한 불변조건이 두 블록에 걸치게 하지 않는다 | 나누는 순간 3절의 캐시가 된다 |
| 단순함을 먼저 | 성능 때문에 정책을 복잡하게 만들지 않는다 | 복잡한 락 정책은 틀리기 쉽고, 틀리면 성능 이전에 답이 틀린다 |

{{< callout type="info" >}}
단순성과 성능은 자주 부딪힌다. 우선순위는 **정확성, 단순함, 성능** 순이다. 락 범위를 좁히는 것은 측정으로 병목이 확인됐을 때 하고, 그때도 불변조건이 한 블록 안에 남는지부터 본다. 처음부터 락을 잘게 쪼개 놓은 코드는 대개 어딘가에 4절의 `Vector` 같은 틈이 있다.
{{< /callout >}}

---

## 6. 가시성 (Visibility)

```java
public class NoVisibility {
    private static boolean ready;
    private static int number;

    public static void main(
            String[] args) {
        new Thread(() -> {
            while (!ready) { }
            System.out.println(number);
        }).start();

        number = 42;
        ready = true;
    }
}
```

동기화가 하는 일은 단일 연산 보장 하나가 아니다. 한 스레드가 쓴 값을 **다른 스레드가 보게** 하는 것, 즉 가시성도 동기화의 일이다. 위 코드에서 읽는 스레드는 `ready`가 참이 되기를 기다렸다가 `number`를 찍는다. 단일 스레드 직관으로는 42가 나와야 하지만, 동기화가 없으면 세 가지가 다 가능하다. 42를 찍거나, 0을 찍거나(쓰기 순서가 재배치되어 `ready`가 먼저 참이 될 수 있다), 영원히 돌거나(`ready`의 새 값을 영영 못 본다). 이 PC에서 돌린 결과다.

| 루프 | 3초 안에 끝났나 | 왜 |
|:-----|:-------------|:---|
| `while (!ready) { }` | 아니오. 강제 종료 | JIT가 아무도 안 바꾸는 변수로 보고 읽기를 루프 밖으로 끌어냈다 |
| `while (!ready) Thread.yield();` | 예. 42를 찍음 | 네이티브 호출이 끼어 매번 다시 읽었을 뿐. 보장이 아니라 우연 |

빈 루프는 영원히 돌았다. 메인 스레드는 분명 `ready = true`를 썼는데, 읽는 스레드가 컴파일된 코드에는 그 변수를 다시 읽는 명령이 없다. 이것이 **스테일 데이터**이고, 두 번째 줄이 끝난 것은 운이었다. 왜 이런 일이 허용되는지(재배치, CPU 캐시, 메모리 모델)와 64비트 변수의 반쪽 읽기는 [03](../03-object-sharing)장 1절에서 자세히 본다.

```java
public class VolatileExample {
    private volatile boolean stopped;

    public void stop() {
        stopped = true;  // 바로 보인다
    }

    public void run() {
        while (!stopped) {
            doWork();
        }
    }
}
```

`volatile`은 변수 하나의 가시성만 보장하는 가벼운 도구다. 컴파일러와 JIT는 `volatile` 변수의 읽기를 루프 밖으로 끌어내거나 다른 메모리 접근과 순서를 바꾸지 않고, 쓰기는 다른 스레드에 바로 보인다. 위의 `ready`에 `volatile`을 붙이면 세 결과 중 42만 남는다. 그러나 **단일 연산성은 보장하지 않는다.**

```java
private volatile boolean flag;  // 좋다

private volatile int count;
count++;   // 여전히 경쟁 조건
```

`count++`는 `volatile`이어도 읽고 더하고 쓰는 세 단계이고, 가시성이 좋아졌을 뿐 2절의 갱신 소실이 그대로 난다. `volatile`이 맞는 자리는 쓰는 값이 현재 값에 의존하지 않고, 그 변수가 다른 변수와 불변조건으로 묶이지 않고, 접근할 때 다른 이유로 락이 필요하지 않을 때다. 상태 플래그, 설정값의 교체, 완료 신호가 그 예다.

---

## 7. 안전한 늦은 초기화 패턴

2절의 `LazyInitRace`를 고치는 방법이다. 셋을 순서대로 보면 왜 마지막 것을 권하는지가 보인다.

### synchronized 메서드

```java
public class SafeLazyInit {
    private Expensive instance;

    synchronized Expensive
            getInstance() {
        if (instance == null)
            instance = new Expensive();
        return instance;
    }
}
```

가장 단순하다. 점검과 행동이 한 락 안에 있으니 2절의 실험에서 1,000번 모두 인스턴스가 하나였다. 대가는 만들어진 뒤에도 매번 락을 잡는 것인데, 5절에서 봤듯 경쟁 없는 락은 싸다. 처음에는 이것으로 시작하고, 측정으로 병목이 확인될 때만 아래로 간다.

### 이중 점검 락 (Double-Checked Locking)

```java
public class SafeLazyInit {
    private volatile Expensive instance;

    Expensive getInstance() {
        if (instance == null) {   // 1차
            synchronized (this) {
                // 2차: 락 안에서
                if (instance == null)
                    instance =
                        new Expensive();
            }
        }
        return instance;
    }
}
```

만들어진 뒤에는 락 없이 1차 점검만으로 끝내려는 패턴이다. 락 안에서 다시 점검하는 이유는 1차 점검을 통과한 스레드가 둘일 수 있어서다. 그리고 `volatile`이 **반드시** 필요하다. `new Expensive()`는 메모리를 잡고, 생성자를 돌리고, 참조를 필드에 쓰는 세 단계인데 `volatile`이 없으면 JIT가 참조 쓰기를 생성자보다 앞당길 수 있다. 그러면 1차 점검을 통과한 다른 스레드가 **생성자가 아직 안 돈 객체**를 받는다. 6절의 재배치가 여기서 사고가 되고, 이 "안전하지 않은 공개"는 [03](../03-object-sharing)장 5절의 주제다. Java 5 이전에는 `volatile`을 붙여도 고쳐지지 않았다.

### 홀더 클래스 (권장)

```java
public class SafeLazyInitHolder {

    private static class Holder {
        static final Expensive INSTANCE
            = new Expensive();
    }

    static Expensive getInstance() {
        return Holder.INSTANCE;
    }
}
```

```text
getInstance() 첫 호출
    │
    ▼  Holder 클래스 초기화 시작
    │  JVM이 초기화 락을 잡는다
    │  INSTANCE = new Expensive()
    ▼
초기화 끝. 이후 읽기는 락 없이
다른 스레드는 끝날 때까지 기다린다
```

락도 `volatile`도 없이 JVM의 **클래스 초기화** 규칙에 기댄다. 클래스는 처음 실제로 쓰일 때(정적 필드를 읽거나 정적 메서드를 부를 때) 초기화되고, JVM은 그 초기화를 스레드 하나만 하도록 락으로 보호하며, 초기화가 끝난 뒤의 정적 필드는 모든 스레드에 안전하게 보인다. 이 PC에서 확인한 것은 이렇다. `Holder`를 로딩만 해 두고(`Class.forName(..., false, ...)`) 정적 초기화 블록이 도는지 봤더니 돌지 않았고, 스레드 10개가 동시에 `getInstance()`를 부르자 초기화 블록과 생성자가 정확히 한 번(T8 스레드에서) 실행됐으며, 열 스레드가 받은 참조는 전부 같은 객체였다. 그 뒤의 호출은 생성자를 다시 부르지 않았다.

| 방식 | 만든 뒤 비용 | 필요한 것 | 왜 |
|:-----|:----------|:--------|:---|
| `synchronized` 메서드 | 매번 락 | 없음 | 가장 단순. 먼저 이것 |
| 이중 점검 락 | `volatile` 읽기 한 번 | `volatile`, 두 번 점검 | 인스턴스 필드를 늦게 만들 때. 틀리기 쉽다 |
| 홀더 클래스 | 정적 필드 읽기 | 정적 싱글톤이어야 함 | JVM이 대신 동기화. 정적이면 이것 |

정적 싱글톤이면 홀더, 아니면 `synchronized` 메서드가 답이고, 이중 점검 락은 그 둘이 안 될 때의 마지막 수단이다. 그리고 셋 다 "정말 늦게 만들어야 하는가"를 먼저 물어야 한다. 클래스 로딩 시점에 `static final`로 바로 만드는 것이 가장 단순하고 가장 안전하다.

---

## 8. 동기화 도구 비교

| 도구 | 단일 연산 | 가시성 | 블로킹 | 사용 사례 | 왜 |
|:-----|:-------:|:-----:|:-----:|:--------|:---|
| `synchronized` | O | O | O | 복합 동작, 변수 여럿의 불변조건 | 여러 단계와 여러 변수를 한 블록에 넣을 수 있는 기본 도구 |
| `volatile` | X | O | X | 상태 플래그, 한 번 쓰고 여럿이 읽는 값 | 가장 싸다. 읽고 수정하고 쓰기에는 못 쓴다 |
| `AtomicXxx` | O | O | X | 변수 하나의 카운터, CAS | 락 없이 단일 연산. 변수 둘이 얽히면 못 쓴다 |
| `LongAdder` | O | O | X | 경쟁이 심한 카운터 | 스레드마다 칸을 나눠 CAS 실패를 피한다 |
| `Lock` (명시적 락) | O | O | O | 타임아웃, 인터럽트, 공정성, 조건 여럿 | `synchronized`로 안 되는 기능이 필요할 때 |

```text
공유 상태가 있나?
  │ 없음 → 그냥 안전
  ▼
변수 하나뿐인가?
  │ 플래그  → volatile
  │ 카운터  → AtomicXxx, LongAdder
  ▼
변수 여럿, 또는 복합 동작
  → synchronized (필요하면 Lock)
```

고르는 순서는 위에서 아래다. 상태를 없앨 수 있으면 없애고, 변수 하나면 원자 변수나 `volatile`로, 둘 이상이 얽히거나 점검 후 행동이 있으면 락이다. 셋째 원리대로 기준은 변수의 개수가 아니라 **불변조건이 몇 변수에 걸치는가**다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 스레드 안전성 | 공유되고 변경 가능한 상태에 대한 접근 관리 | 코드가 아니라 상태의 문제 |
| 상태 없는 객체 | 항상 안전 | 지역 변수는 스레드마다 있는 스택에 |
| 고치는 세 방법 | 공유 안 함, 변경 안 함, 언제나 동기화 | "가끔 동기화"는 없다 |
| 단일 연산 | 다른 스레드에게 전부 아니면 전무로 보인다 | `count++`는 바이트코드 셋. 2스레드에 절반이 사라졌다 |
| 경쟁 조건 | 맞는 답이 타이밍에 달렸다 | 점검 후 행동, 읽고 수정하고 쓰기 |
| 복합 동작 | 하나로 실행되어야 하는 여러 단계 | 각 단계가 안전해도 묶음은 아니다. `Vector`의 1/1,000 |
| 원자 변수 | CAS로 변수 하나를 단일 연산으로 | 변수 둘은 못 묶는다. 캐시의 3.5~4.9% 오답 |
| 암묵적인 락 | 모든 객체가 mutex. 소유자와 횟수 | 같은 락의 블록은 한 스레드씩 |
| 재진입 | 스레드 단위 소유, 횟수로 센다 | 아니었다면 `super` 호출이 데드락 |
| 락으로 보호 | 그 변수의 모든 경로가 같은 락 | 락은 다른 락 획득만 막는다. 관례다 |
| 불변조건 | 걸친 변수 전부를 같은 락으로 | 락은 변수가 아니라 불변조건을 지킨다 |
| 활동성과 성능 | 락은 짧게, 무거운 일은 밖에서 | 전체를 잠그면 10스레드가 1스레드. 좁히면 4.5배 |
| 가시성 | 동기화의 두 번째 역할 | 빈 루프는 3초가 지나도 안 끝났다 |
| 늦은 초기화 | `synchronized`, DCL+`volatile`, 홀더 | 정적이면 홀더. JVM이 한 번만 초기화 |

{{< callout type="info" >}}
**용어 정리**
- **공유 / 변경 가능**: 여러 스레드가 닿을 수 있다 / 값이 바뀔 수 있다. 둘 다일 때만 문제
- **스레드 안전**: 어떤 스케줄링에서도 호출하는 쪽의 조율 없이 정확하게 동작하는 성질
- **불변조건 / 후조건**: 상태가 항상 지켜야 하는 것 / 연산 뒤에 성립해야 하는 것
- **단일 연산(atomic)**: 다른 스레드에게 중간 상태가 보이지 않는 연산
- **경쟁 조건 / 데이터 경쟁**: 결과가 타이밍에 달린 것 / 동기화 없는 읽기·쓰기 겹침
- **점검 후 행동 / 읽고 수정하고 쓰기**: 복합 동작의 두 대표 모양
- **CAS**: compare-and-swap. 기대값과 같을 때만 바꾸는 CPU 명령. 원자 변수의 원리
- **암묵적인 락 / 모니터**: 모든 자바 객체가 가진 상호 배제 락
- **재진입**: 자기가 쥔 락을 다시 잡을 수 있는 성질. 횟수로 센다
- **보호(guarded by)**: 그 변수의 모든 접근이 같은 락 아래서 이루어진다는 관례
- **직렬화**: 락 때문에 스레드들이 한 줄로 서서 하나씩 실행되는 것
- **가시성 / 스테일 데이터**: 쓴 값이 다른 스레드에 보이는 것 / 못 보고 읽은 낡은 값
- **DCL / 홀더 클래스**: 이중 점검 락 / 클래스 초기화에 기댄 늦은 초기화
{{< /callout >}}
