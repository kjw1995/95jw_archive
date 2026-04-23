---
title: "객체 구성 (Composing Objects)"
weight: 4
---

# 객체 구성 (Composing Objects)

스레드 안전한 클래스를 설계하는 패턴과 원칙을 다룬다. 인스턴스 한정, 위임, 기능 추가 전략, 동기화 정책 문서화를 살펴본다.

---

## 1. 스레드 안전한 클래스 설계

스레드 안전한 클래스를 설계할 때 고려해야 할 세 가지 핵심 요소가 있다.

| 요소 | 질문 |
|:-----|:-----|
| **상태 변수** | 객체의 상태를 보관하는 변수가 무엇인가? |
| **상태 범위** | 변수가 가질 수 있는 값의 종류와 범위는? |
| **동기화 정책** | 동시 접근을 어떻게 관리할 것인가? |

객체의 상태는 내부 변수의 값 조합으로 결정된다. n개의 변수가 있다면 상태는 n개 변수가 가질 수 있는 값의 전체 조합이다.

```java
@ThreadSafe
public final class Counter {

    @GuardedBy("this") private long value = 0;

    public synchronized long getValue() {
        return value;
    }

    public synchronized long increment() {
        if (value == Long.MAX_VALUE)
            throw new IllegalStateException("counter overflow");
        return ++value;
    }
}
```

- `value`는 0 ~ `Long.MAX_VALUE` 범위의 상태를 가진다
- 모든 접근을 `synchronized`로 보호한다
- 오버플로우를 검사하여 **상태 범위**를 벗어나지 않도록 한다

### 1.1 동기화 요구사항 정리

객체가 가질 수 있는 값의 범위를 **상태 범위(state space)** 라고 한다. 상태 범위가 좁을수록 논리적인 상태를 파악하기 쉽다.

```
상태 범위와 동기화 판단 흐름:

변수에 제약 조건이 있는가?
  ├── YES → 변수를 클래스 내부에 숨긴다
  │         (private 캡슐화)
  │
  │   연산이 잘못된 상태를 만들 수 있는가?
  │     ├── YES → 단일 연산으로 구현
  │     └── NO  → 일반 접근 허용
  │
  └── NO  → 동기화/캡슐화 불필요
            (유연성·성능 우선)
```

**핵심 규칙:**

- 현재 상태를 기반으로 다음 상태가 결정되는 연산은 반드시 **단일 연산**이어야 한다
- 서로 연관된 변수는 **같은 락**으로 보호하여 한번에 읽거나 변경해야 한다
- 변수 간 의존성이 있다면 관련 변수를 사용하는 **모든 곳**에서 동기화해야 한다

```java
// 잘못된 예: 연관된 변수를 별도 락으로 보호
synchronized(lockA) { lower = newLower; }
// 이 사이에 다른 스레드가 개입 가능!
synchronized(lockB) { upper = newUpper; }

// 올바른 예: 같은 락으로 한번에 변경
synchronized(this) {
    lower = newLower;
    upper = newUpper;
}
```

{{< callout type="info" >}}
**상태 범위를 정확하게 인식하지 못하면 스레드 안전성을 완벽하게 확보할 수 없다.** 클래스의 상태 제약 조건에 따라 적절한 동기화 기법과 캡슐화 방법을 선택해야 한다.
{{< /callout >}}

### 1.2 상태 의존 연산

현재 상태에 따라 동작 여부가 결정되는 연산을 **상태 의존(state-dependent) 연산**이라고 한다.

```
예: 큐에서 값 꺼내기

큐가 비어있는가?
  ├── YES → 값을 꺼낼 수 없다
  │         (선행 조건 불만족)
  │         → 기다린다 / 예외 발생
  │
  └── NO  → 값을 꺼낸다
            (선행 조건 만족)
```

- 단일 스레드: 선행 조건 불만족 시 **무조건 실패**
- 멀티 스레드: 다른 스레드가 상태를 바꿀 수 있으므로 **기다리면 성공 가능**

```java
// 블로킹 큐 — 선행 조건이 만족될 때까지 대기
BlockingQueue<String> queue = new LinkedBlockingQueue<>();

// 생산자 스레드
queue.put("data");   // 큐가 꽉 차면 대기

// 소비자 스레드
String data = queue.take();  // 큐가 비면 대기
```

{{< callout type="warning" >}}
**`wait`/`notify`보다 `BlockingQueue`, `Semaphore` 같은 라이브러리를 사용하라.** `wait`/`notify`는 올바르게 사용하기 어렵고 오류 가능성이 높다.
{{< /callout >}}

### 1.3 상태 소유권

객체의 상태를 정의할 때는 해당 객체가 **실제로 소유하는** 데이터만 기준으로 삼아야 한다.

```
HashMap 인스턴스의 상태 구성:

┌─────────────────────────┐
│ HashMap                 │
│  ├── Entry[] table      │
│  ├── Map.Entry 객체들    │  ← 모두 HashMap이 소유
│  └── 내부 변수들          │
└─────────────────────────┘
```

**소유권 분리** 패턴도 존재한다.

```
ServletContext의 소유권 분리:

┌───────────────────────┐
│ ServletContext         │
│ (컬렉션 구조 소유)      │
│                       │
│  ┌───┐ ┌───┐ ┌───┐   │
│  │ A │ │ B │ │ C │   │ ← 객체 A,B,C의 소유권은
│  └───┘ └───┘ └───┘   │   클라이언트에게 있음
└───────────────────────┘
```

- `ServletContext`는 컬렉션 구조의 소유권만 갖는다
- 내부에 담긴 객체의 소유권은 클라이언트에게 있다
- 따라서 담긴 객체를 사용할 때는 **클라이언트가 직접 동기화**해야 한다

---

## 2. 인스턴스 한정 (Instance Confinement)

스레드 안전하지 않은 객체도 **캡슐화**를 통해 안전하게 만들 수 있다. 객체를 클래스 내부에 완벽하게 숨기면 접근 경로를 통제할 수 있다.

### 2.1 한정의 종류

| 한정 방식 | 설명 | 예시 |
|:---------|:-----|:-----|
| **인스턴스 한정** | private 필드에 숨김 | `private final Set` |
| **블록 한정** | 로컬 변수로만 사용 | 메서드 내부 변수 |
| **스레드 한정** | 특정 스레드에서만 사용 | `ThreadLocal` |

```java
@ThreadSafe
public class PersonSet {

    @GuardedBy("this")
    private final Set<Person> mySet = new HashSet<>();

    public synchronized void addPerson(Person p) {
        mySet.add(p);
    }

    public synchronized boolean containsPerson(Person p) {
        return mySet.contains(p);
    }
}
```

- `HashSet` 자체는 스레드 안전하지 않다
- 하지만 `mySet`은 `private final`로 외부에 노출되지 않는다
- 모든 접근이 `synchronized` 메서드를 통과하므로 **스레드 안전**하다

{{< callout type="warning" >}}
**한정된 객체를 외부로 유출시키면 안 된다.** `iterator`를 반환하거나 내부 컬렉션의 참조를 공개하면 한정 조건이 깨진다. 이는 버그이다.
{{< /callout >}}

### 2.2 래퍼 클래스를 활용한 한정

자바 플랫폼은 스레드 안전하지 않은 컬렉션을 래핑하여 동기화를 추가하는 팩토리 메서드를 제공한다.

```java
// ArrayList는 스레드 안전하지 않음
List<String> list = new ArrayList<>();

// synchronized 래퍼로 감싸기
List<String> safeList = Collections.synchronizedList(list);

// 이후 원본 list를 직접 사용하면 안 됨!
// 반드시 safeList를 통해서만 접근해야 함
```

```
┌─────────────────────────┐
│ SynchronizedList (래퍼)  │
│  ┌───────────────────┐  │
│  │ synchronized 메서드 │  │
│  │  ┌─────────────┐  │  │
│  │  │  ArrayList   │  │  │ ← 내부에 한정
│  │  └─────────────┘  │  │
│  └───────────────────┘  │
└─────────────────────────┘
  외부에서는 래퍼만 사용해야 함
```

### 2.3 자바 모니터 패턴

변경 가능한 데이터를 모두 객체 내부에 숨기고, **객체의 암묵적인 락**으로 동시 접근을 막는 패턴이다.

```java
// 자바 모니터 패턴의 전형적인 구조
public class MonitorExample {

    @GuardedBy("this")
    private int state;

    public synchronized int getState() {
        return state;
    }

    public synchronized void setState(int newState) {
        this.state = newState;
    }
}
```

`Vector`, `Hashtable` 등 자바 초기 라이브러리 클래스가 이 패턴을 사용한다.

### 2.4 비공개 락 (Private Lock)

객체 자체의 암묵적인 락 대신 **전용 private 락 객체**를 사용하면 외부 간섭을 완전히 차단할 수 있다.

```java
public class PrivateLock {

    private final Object myLock = new Object();
    private Widget widget;

    void someMethod() {
        synchronized (myLock) {
            // widget 변수의 값을 읽거나 변경
        }
    }
}
```

| 방식 | 장점 | 단점 |
|:-----|:-----|:-----|
| `synchronized` 메서드 (this 락) | 간결함 | 외부에서 같은 락에 동기화 가능 |
| **private 락 객체** | 외부 간섭 차단, 락 분리 가능 | 코드 약간 복잡 |

{{< callout type="info" >}}
**private 락의 장점:** 락이 `private`이므로 외부에서 락을 건드릴 수 없다. 공개된 락은 다른 코드가 의도치 않게 같은 락에 동기화하여 성능 문제나 데드락을 일으킬 수 있다.
{{< /callout >}}

---

## 3. 스레드 안전성 위임 (Delegation)

이미 스레드 안전한 클래스를 조합하여 새 클래스를 만들 때, 스레드 안전성을 **내부 클래스에 위임**할 수 있는지를 판단해야 한다.

### 3.1 모니터 기반 차량 추적기

스레드 안전성을 직접 관리하는 방식이다. 모든 메서드에 `synchronized`를 적용하고, 외부로 데이터를 넘길 때 **깊은 복사(deep copy)** 를 한다.

```java
@ThreadSafe
public class MonitorVehicleTracker {

    @GuardedBy("this")
    private final Map<String, MutablePoint> locations;

    public MonitorVehicleTracker(Map<String, MutablePoint> locations) {
        this.locations = deepCopy(locations);
    }

    public synchronized Map<String, MutablePoint> getLocations() {
        return deepCopy(locations);  // 복사본 반환
    }

    public synchronized MutablePoint getLocation(String id) {
        MutablePoint loc = locations.get(id);
        return loc == null ? null : new MutablePoint(loc);
    }

    public synchronized void setLocation(String id, int x, int y) {
        MutablePoint loc = locations.get(id);
        if (loc == null)
            throw new IllegalArgumentException("No such ID: " + id);
        loc.x = x;
        loc.y = y;
    }

    private static Map<String, MutablePoint> deepCopy(
            Map<String, MutablePoint> m) {
        Map<String, MutablePoint> result = new HashMap<>();
        for (String id : m.keySet())
            result.put(id, new MutablePoint(m.get(id)));
        return Collections.unmodifiableMap(result);
    }
}
```

- 장점: 일관된 **스냅샷**을 제공한다
- 단점: 차량이 많으면 **복사 비용**이 크다

### 3.2 위임 기반 차량 추적기

스레드 안전한 `ConcurrentHashMap`과 불변 객체 `Point`에 안전성을 위임하는 방식이다.

```java
@Immutable
public class Point {
    public final int x, y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }
}

@ThreadSafe
public class DelegatingVehicleTracker {

    private final ConcurrentMap<String, Point> locations;

    public DelegatingVehicleTracker(Map<String, Point> points) {
        locations = new ConcurrentHashMap<>(points);
    }

    // 실시간 뷰 반환 (복사 비용 없음)
    public Map<String, Point> getLocations() {
        return Collections.unmodifiableMap(locations);
    }

    public Point getLocation(String id) {
        return locations.get(id);
    }

    public void setLocation(String id, int x, int y) {
        if (locations.replace(id, new Point(x, y)) == null)
            throw new IllegalArgumentException("No such ID: " + id);
    }
}
```

- `Point`가 **불변**이므로 깊은 복사 불필요
- `ConcurrentHashMap`이 스레드 안전성을 보장
- 결과적으로 `DelegatingVehicleTracker`에 `synchronized`가 없어도 안전

### 3.3 모니터 vs 위임 비교

| 항목 | 모니터 기반 | 위임 기반 |
|:-----|:----------|:---------|
| 동기화 | 직접 `synchronized` | 내부 클래스에 위임 |
| 데이터 반환 | 깊은 복사 (스냅샷) | 실시간 뷰 (라이브) |
| 복사 비용 | 높음 | 없음 |
| 상태 객체 | 변경 가능 (Mutable) | **불변 (Immutable)** |
| 일관성 | 호출 시점의 일관된 뷰 | 실시간 변경 반영 |

### 3.4 독립 상태 변수와 위임 조건

스레드 안전성을 내부 변수에 위임할 수 있는 **조건**이 있다.

```
위임 가능 여부 판단:

변수들이 서로 독립적인가?
  ├── YES ─ 복합 연산이 있는가?
  │          ├── YES → 위임 불가
  │          │         (락으로 단일 연산 보장)
  │          └── NO  → 위임 가능!
  │
  └── NO  → 위임 불가
            (같은 락으로 함께 보호)
```

```java
// 위임 가능한 예: 독립적인 두 변수
public class IndependentState {
    // keyListeners와 mouseListeners는 서로 독립적
    private final CopyOnWriteArrayList<KeyListener> keyListeners
        = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<MouseListener> mouseListeners
        = new CopyOnWriteArrayList<>();

    public void addKeyListener(KeyListener listener) {
        keyListeners.add(listener);
    }

    public void addMouseListener(MouseListener listener) {
        mouseListeners.add(listener);
    }
}
```

```java
// 위임 불가능한 예: 의존 관계가 있는 두 변수
public class NumberRange {
    // lower <= upper 제약 조건이 있다
    private final AtomicInteger lower = new AtomicInteger(0);
    private final AtomicInteger upper = new AtomicInteger(0);

    // 이 메서드는 스레드 안전하지 않다!
    // lower와 upper를 개별적으로 검사하므로
    // 그 사이에 다른 스레드가 값을 변경할 수 있다
    public void setLower(int i) {
        if (i > upper.get())     // check
            throw new IllegalArgumentException();
        lower.set(i);            // act → check-then-act 경쟁 조건!
    }
}
```

{{< callout type="info" >}}
**위임 가능 조건 요약:** 상태 변수가 스레드 안전하고, 변수 간 의존성이 없고, 복합 연산이 없다면 스레드 안전성을 내부 변수에 위임할 수 있다.
{{< /callout >}}

---

## 4. 기존 클래스에 기능 추가

스레드 안전한 기존 클래스에 새 기능을 추가하는 방법은 크게 세 가지이다.

### 4.1 방법별 비교

| 방법 | 설명 | 안전성 |
|:-----|:-----|:------|
| **원본 클래스 수정** | 소스 코드에 직접 추가 | 가장 안전 |
| **상속** | 하위 클래스에서 추가 | 불안정 |
| **클라이언트 측 락** | 도우미 클래스에서 추가 | 위험 |
| **조합 (Composition)** | 래퍼 클래스로 감싸기 | **안전** |

### 4.2 상속의 문제점

```java
// 상속으로 "없으면 추가" 구현 — 위험한 방법
public class BetterVector<E> extends Vector<E> {

    public synchronized boolean putIfAbsent(E x) {
        boolean absent = !contains(x);
        if (absent)
            add(x);
        return absent;
    }
}
```

- 상위 클래스가 동기화 전략을 변경하면 **하위 클래스의 동기화가 깨진다**
- 동기화 로직이 두 클래스에 분산된다

### 4.3 클라이언트 측 락의 위험

```java
// 잘못된 클라이언트 측 락 — this를 잠그지만 list는 다른 락 사용
public class ListHelper<E> {
    public List<E> list = Collections.synchronizedList(new ArrayList<>());

    // 이 메서드는 스레드 안전하지 않다!
    public synchronized boolean putIfAbsent(E x) {
        boolean absent = !list.contains(x);
        if (absent)
            list.add(x);
        return absent;
    }
    // ListHelper의 락(this)과 list의 락이 다르다!
}
```

```java
// 올바른 클라이언트 측 락 — list와 같은 락 사용
public class ListHelper<E> {
    public List<E> list = Collections.synchronizedList(new ArrayList<>());

    public boolean putIfAbsent(E x) {
        synchronized (list) {  // list 객체를 락으로 사용
            boolean absent = !list.contains(x);
            if (absent)
                list.add(x);
            return absent;
        }
    }
}
```

### 4.4 조합 (Composition) — 가장 안전한 방법

```java
@ThreadSafe
public class ImprovedList<E> implements List<E> {

    private final List<E> list;

    public ImprovedList(List<E> list) {
        this.list = list;
    }

    public synchronized boolean putIfAbsent(E x) {
        boolean absent = !list.contains(x);
        if (absent)
            list.add(x);
        return absent;
    }

    // List 인터페이스의 나머지 메서드도
    // synchronized로 위임
    public synchronized boolean add(E e) {
        return list.add(e);
    }

    public synchronized E get(int index) {
        return list.get(index);
    }

    // ... 나머지 메서드 생략
}
```

- 내부 `list`가 어떤 락을 쓰든 상관없다
- `ImprovedList` 자체의 락으로 **독립적으로** 동기화를 보장한다
- 내부 구현 변경에 영향받지 않아 가장 견고하다

---

## 5. 동기화 정책 문서화

동기화 정책을 문서로 남기는 것은 스레드 안전성을 관리하는 **가장 강력한 방법**이다.

### 5.1 문서화해야 할 내용

| 항목 | 설명 |
|:-----|:-----|
| **스레드 안전성 보장 수준** | 이 클래스가 스레드 안전한가? |
| **사용하는 락** | 어떤 락으로 어떤 변수를 보호하는가? |
| **불변 조건** | 상태 변수 간의 제약 조건은 무엇인가? |
| **한정 정책** | 어떤 데이터가 내부에 한정되어 있는가? |
| **공개 정책** | 외부에 공개되는 데이터는 무엇인가? |

### 5.2 애너테이션 활용

```java
@ThreadSafe                    // 클래스가 스레드 안전함
public class SafeCounter {

    @GuardedBy("this")         // this 락으로 보호됨
    private long count = 0;

    public synchronized long getCount() {
        return count;
    }

    public synchronized void increment() {
        count++;
    }
}
```

| 애너테이션 | 의미 |
|:---------|:-----|
| `@ThreadSafe` | 이 클래스는 스레드 안전하다 |
| `@NotThreadSafe` | 이 클래스는 스레드 안전하지 않다 |
| `@Immutable` | 이 클래스는 불변이다 (항상 스레드 안전) |
| `@GuardedBy("lock")` | 이 변수는 지정된 락으로 보호된다 |

---

## 6. 요약

### 스레드 안전한 클래스 설계 전략

```
스레드 안전한 클래스를 만들려면?

1. 상태 변수 식별
   └→ 어떤 변수가 상태를 구성하는가?

2. 불변 조건 파악
   └→ 변수 간 제약 조건이 있는가?

3. 동기화 정책 결정
   ├→ 인스턴스 한정
   │    (private + synchronized)
   ├→ 위임
   │    (스레드 안전한 내부 클래스)
   └→ 자바 모니터 패턴
        (this 락 또는 private 락)

4. 기존 클래스에 기능 추가 시
   ├→ 조합(Composition) 권장
   ├→ 상속은 주의
   └→ 클라이언트 측 락은 위험

5. 동기화 정책 문서화
```

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **인스턴스 한정** | 객체를 private에 숨기고 락으로 접근 통제 |
| **자바 모니터 패턴** | 모든 변경 가능 데이터를 this 락으로 보호 |
| **비공개 락** | private 락 객체로 외부 간섭 차단 |
| **스레드 안전성 위임** | 스레드 안전한 내부 객체에 동기화를 맡김 |
| **독립 상태 변수** | 변수 간 의존성이 없으면 위임 가능 |
| **조합(Composition)** | 기존 클래스에 기능 추가 시 가장 안전한 방법 |
| **클라이언트 측 락** | 대상 객체와 같은 락을 사용해야 안전 |
| **동기화 정책 문서화** | `@ThreadSafe`, `@GuardedBy` 등 활용 |
