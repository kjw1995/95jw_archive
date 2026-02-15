---
title: "객체 공유 (Sharing Objects)"
weight: 2
---

# 객체 공유 (Sharing Objects)

동기화는 **단일 연산 보장**뿐만 아니라 **메모리 가시성(memory visibility)** 문제를 해결하기 위해서도 필요하다.

---

## 1. 가시성 (Visibility)

### 가시성 문제란?

단일 스레드에서는 변수에 값을 쓰고 읽으면 당연히 쓴 값을 읽는다. 하지만 멀티스레드 환경에서는 **다른 스레드가 쓴 값을 읽지 못할 수도 있다.**

```java
public class NoVisibility {
    private static boolean ready;
    private static int number;

    private static class ReaderThread extends Thread {
        public void run() {
            while (!ready)
                Thread.yield();
            System.out.println(number);
        }
    }

    public static void main(String[] args) {
        new ReaderThread().start();
        number = 42;
        ready = true;
    }
}
```

**발생 가능한 문제:**
1. **영원히 루프** - `ready`가 `true`로 변경된 것을 읽기 스레드가 영원히 보지 못할 수 있음
2. **0 출력** - 재배치(reordering)로 `ready = true`가 `number = 42`보다 먼저 실행될 수 있음

### 재배치 (Reordering)

> 동기화 기능을 지정하지 않으면 컴파일러, 프로세서, JVM 등이 프로그램 코드가 실행되는 순서를 임의로 바꿔 실행할 수 있다.

```
// 작성한 코드
number = 42;
ready = true;

// 실제 실행 순서 (재배치 발생 시)
ready = true;
number = 42;
```

### 1.1 스테일 데이터 (Stale Data)

동기화 없이 변수를 읽으면 **최신 값이 아닌 오래된 값(stale data)**을 읽을 수 있다.

```java
@NotThreadSafe
public class MutableInteger {
    private int value;

    public int get() { return value; }
    public void set(int value) { this.value = value; }
}
```

**문제점:**
- `get()`이 다른 스레드의 `set()` 결과를 보지 못할 수 있음
- 때로는 최신 값, 때로는 스테일 값을 읽음 (비결정적 동작)

**해결:**

```java
@ThreadSafe
public class SynchronizedInteger {
    @GuardedBy("this")
    private int value;

    public synchronized int get() { return value; }
    public synchronized void set(int value) { this.value = value; }
}
```

### 1.2 64비트 연산의 비원자성

`volatile`이 아닌 `long`과 `double`은 **두 번의 32비트 연산**으로 읽기/쓰기가 수행될 수 있다.

```java
// 위험! 다른 스레드에서 이상한 값을 읽을 수 있음
private long sharedValue;

// Thread 1
sharedValue = 0xFFFFFFFF_FFFFFFFFL;

// Thread 2 - 상위 32비트와 하위 32비트가 섞일 수 있음
long read = sharedValue;  // 0xFFFFFFFF_00000000L 같은 값 가능
```

**해결:** `volatile`로 선언하거나 동기화 사용

```java
private volatile long sharedValue;  // 원자적 읽기/쓰기 보장
```

### 1.3 락과 가시성

> **락은 상호 배제(mutual exclusion)뿐만 아니라 정상적인 메모리 가시성을 확보하기 위해서도 사용한다.**

```java
// synchronized 블록 진입 시: 이전에 다른 스레드가 쓴 값을 모두 볼 수 있음
// synchronized 블록 종료 시: 변경한 값을 다른 스레드가 볼 수 있게 됨
synchronized (lock) {
    // 공유 변수 접근
}
```

### 1.4 volatile 변수

`volatile`은 **가시성만 보장**하고, **단일 연산성은 보장하지 않는다.**

```java
private volatile boolean stopped = false;

// Writer Thread
public void stop() {
    stopped = true;  // 다른 스레드에서 즉시 볼 수 있음
}

// Reader Thread
public void run() {
    while (!stopped) {
        doWork();
    }
}
```

#### volatile의 한계

```java
private volatile int count = 0;

public void increment() {
    count++;  // 여전히 경쟁 조건! (읽기-수정-쓰기)
}
```

#### volatile 사용 조건

| 조건 | 설명 |
|------|------|
| 쓰기가 현재 값과 무관 | `flag = true` (O), `count++` (X) |
| 불변조건에 포함되지 않음 | 다른 변수와 연관된 제약이 없음 |
| 락이 필요 없음 | 복합 동작이 아닌 단순 읽기/쓰기 |

---

## 2. 공개와 유출 (Publication and Escape)

### 공개 (Publication)

객체를 현재 스코프 범위 밖에서 사용할 수 있게 만드는 것

```java
// 가장 직접적인 공개 방법
public static Set<Secret> knownSecrets;

public void initialize() {
    knownSecrets = new HashSet<Secret>();
}
```

### 유출 (Escape)

의도하지 않게 객체가 외부에 공개되는 것

```java
class UnsafeStates {
    private String[] states = new String[] {"AK", "AL", ...};

    // private 배열이 유출됨!
    public String[] getStates() { return states; }
}
```

**해결: 방어적 복사**

```java
class SafeStates {
    private String[] states = new String[] {"AK", "AL", ...};

    public String[] getStates() {
        return Arrays.copyOf(states, states.length);  // 복사본 반환
    }
}
```

### 추가 예제: 컬렉션 방어적 복사

```java
public class DefensiveCopyExample {
    private final List<String> items;

    public DefensiveCopyExample(List<String> items) {
        // 생성자에서 방어적 복사
        this.items = new ArrayList<>(items);
    }

    public List<String> getItems() {
        // getter에서도 방어적 복사
        return new ArrayList<>(items);
    }

    // 불변 뷰 반환 (복사보다 효율적)
    public List<String> getItemsView() {
        return Collections.unmodifiableList(items);
    }
}
```

### 2.1 생성 메소드 안전성

> **생성 메소드를 실행하는 도중에는 this 변수가 외부에 유출되지 않게 해야 한다.**

#### this 유출의 위험

```java
// 위험! this가 생성 완료 전에 유출됨
public class ThisEscape {
    public ThisEscape(EventSource source) {
        source.registerListener(new EventListener() {
            public void onEvent(Event e) {
                doSomething(e);  // 암묵적으로 ThisEscape.this 사용
            }
        });
    }
}
```

#### 안전한 패턴: 팩토리 메소드

```java
public class SafeListener {
    private final EventListener listener;

    private SafeListener() {
        listener = new EventListener() {
            public void onEvent(Event e) {
                doSomething(e);
            }
        };
    }

    public static SafeListener newInstance(EventSource source) {
        SafeListener safe = new SafeListener();  // 생성 완료
        source.registerListener(safe.listener);  // 그 다음 등록
        return safe;
    }
}
```

#### 생성자에서 스레드 시작 금지

```java
// 위험!
public class DontDoThis {
    public DontDoThis() {
        new Thread(this::run).start();  // 생성 완료 전에 스레드 시작
    }
}

// 안전한 방법
public class DoThis {
    private final Thread thread;

    public DoThis() {
        thread = new Thread(this::run);  // 생성만
    }

    public void start() {
        thread.start();  // 별도 메소드에서 시작
    }
}
```

---

## 3. 스레드 한정 (Thread Confinement)

객체를 단일 스레드에서만 사용하도록 한정하면 동기화가 필요 없다.

### 3.1 스택 한정 (Stack Confinement)

지역 변수는 스레드의 스택에 저장되므로 다른 스레드에서 접근 불가능하다.

```java
public int loadTheArk(Collection<Animal> candidates) {
    // animals는 이 메소드의 스택에만 존재
    SortedSet<Animal> animals = new TreeSet<>();

    for (Animal a : candidates) {
        animals.add(a);  // 이 스레드에서만 접근
    }

    return animals.size();
}
```

**주의:** 지역 변수의 참조를 외부에 공개하면 한정이 깨진다.

```java
// 위험!
public Set<Animal> loadTheArkBroken(Collection<Animal> candidates) {
    SortedSet<Animal> animals = new TreeSet<>();
    // ...
    return animals;  // 지역 변수 참조 유출!
}
```

### 3.2 ThreadLocal

각 스레드가 자신만의 값을 갖도록 해주는 클래스

```java
private static ThreadLocal<Connection> connectionHolder =
    ThreadLocal.withInitial(() -> DriverManager.getConnection(DB_URL));

public static Connection getConnection() {
    return connectionHolder.get();  // 현재 스레드의 Connection 반환
}
```

#### ThreadLocal 동작 원리

```
Thread A: get() → Connection A
Thread B: get() → Connection B
Thread C: get() → Connection C

각 스레드가 독립적인 값을 가짐
```

#### 추가 예제: ThreadLocal 활용

```java
public class ThreadLocalExample {
    // 스레드별 사용자 정보
    private static final ThreadLocal<UserContext> userContext =
        new ThreadLocal<>();

    // 스레드별 DateFormat (DateFormat은 스레드 안전하지 않음!)
    private static final ThreadLocal<SimpleDateFormat> dateFormat =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

    // 스레드별 트랜잭션 ID
    private static final ThreadLocal<String> transactionId =
        ThreadLocal.withInitial(() -> UUID.randomUUID().toString());

    public static void setUser(UserContext user) {
        userContext.set(user);
    }

    public static UserContext getUser() {
        return userContext.get();
    }

    public static String formatDate(Date date) {
        return dateFormat.get().format(date);
    }

    // 중요: 스레드 풀 사용 시 반드시 정리!
    public static void cleanup() {
        userContext.remove();
        dateFormat.remove();
        transactionId.remove();
    }
}
```

#### ThreadLocal 메모리 누수 주의

```java
// 스레드 풀에서 ThreadLocal 사용 시
ExecutorService executor = Executors.newFixedThreadPool(10);

executor.submit(() -> {
    try {
        ThreadLocalExample.setUser(new UserContext("user1"));
        // 작업 수행
    } finally {
        // 반드시 정리! 스레드가 재사용되므로 이전 값이 남아있을 수 있음
        ThreadLocalExample.cleanup();
    }
});
```

---

## 4. 불변성 (Immutability)

> **불변 객체는 언제라도 스레드에 안전하다.**

### 불변 객체의 조건

| 조건 | 설명 |
|------|------|
| 상태 변경 불가 | 생성 후 객체 상태를 변경할 수 없음 |
| 모든 필드 final | 내부 필드가 모두 final로 선언 |
| 적절한 생성 | this가 생성 중에 유출되지 않음 |

### 불변 객체 예제

```java
@Immutable
public final class ImmutablePoint {
    private final int x;
    private final int y;

    public ImmutablePoint(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    // 상태 변경 대신 새 객체 반환
    public ImmutablePoint move(int dx, int dy) {
        return new ImmutablePoint(x + dx, y + dy);
    }
}
```

### 추가 예제: 불변 클래스 만들기

```java
@Immutable
public final class ImmutablePerson {
    private final String name;
    private final int age;
    private final List<String> hobbies;
    private final Address address;

    public ImmutablePerson(String name, int age, List<String> hobbies, Address address) {
        this.name = name;
        this.age = age;
        // 방어적 복사: 가변 컬렉션을 불변으로
        this.hobbies = List.copyOf(hobbies);
        // 깊은 복사: 가변 객체도 복사 (Address가 불변이면 불필요)
        this.address = new Address(address);
    }

    public String getName() { return name; }
    public int getAge() { return age; }
    public List<String> getHobbies() { return hobbies; }  // 이미 불변
    public Address getAddress() { return new Address(address); }  // 방어적 복사

    // 변경이 필요하면 새 객체 반환
    public ImmutablePerson withAge(int newAge) {
        return new ImmutablePerson(name, newAge, hobbies, address);
    }
}
```

### 4.1 final 변수

`final`은 **초기화 안전성(initialization safety)**을 보장한다.

```java
public class FinalFieldExample {
    private final int x;
    private int y;

    public FinalFieldExample() {
        x = 3;
        y = 4;
    }

    // 다른 스레드에서 이 객체를 받으면
    // x는 반드시 3으로 보임 (final 보장)
    // y는 0 또는 4일 수 있음 (가시성 미보장)
}
```

### 4.2 불변 객체 + volatile

여러 상태 변수를 단일 연산으로 갱신해야 할 때 유용한 패턴

```java
@Immutable
class OneValueCache {
    private final BigInteger lastNumber;
    private final BigInteger[] lastFactors;

    public OneValueCache(BigInteger i, BigInteger[] factors) {
        lastNumber = i;
        lastFactors = Arrays.copyOf(factors, factors.length);
    }

    public BigInteger[] getFactors(BigInteger i) {
        if (lastNumber == null || !lastNumber.equals(i))
            return null;
        return Arrays.copyOf(lastFactors, lastFactors.length);
    }
}

@ThreadSafe
public class VolatileCachedFactorizer implements Servlet {
    // 불변 객체를 volatile 변수에 저장
    private volatile OneValueCache cache = new OneValueCache(null, null);

    public void service(ServletRequest req, ServletResponse resp) {
        BigInteger i = extractFromRequest(req);
        BigInteger[] factors = cache.getFactors(i);

        if (factors == null) {
            factors = factor(i);
            // 새 불변 객체로 교체 (원자적)
            cache = new OneValueCache(i, factors);
        }

        encodeIntoResponse(resp, factors);
    }
}
```

---

## 5. 안전한 공개 (Safe Publication)

### 5.1 적절하지 않은 공개

```java
// 문제가 발생할 수 있는 클래스
public class Holder {
    private int n;

    public Holder(int n) { this.n = n; }

    public void assertSanity() {
        // n != n 이 true가 될 수 있음!
        if (n != n)
            throw new AssertionError("This statement is false.");
    }
}
```

**왜 `n != n`이 true가 될 수 있나?**
- 첫 번째 `n` 읽기: 0 (기본값)
- 생성자 실행 (다른 스레드)
- 두 번째 `n` 읽기: 생성자에서 설정한 값

### 5.2 안전한 공개 방법

> **객체를 안전하게 공개하려면 참조와 상태를 동시에 다른 스레드에서 볼 수 있어야 한다.**

| 방법 | 설명 |
|------|------|
| static 초기화 | `public static Holder holder = new Holder(42);` |
| volatile 변수 | `private volatile Holder holder;` |
| AtomicReference | `private AtomicReference<Holder> holder;` |
| final 필드 | `private final Holder holder;` |
| 락으로 보호 | `synchronized` 블록 내에서 접근 |
| 스레드 안전 컬렉션 | `ConcurrentHashMap`, `BlockingQueue` 등 |

### 추가 예제: 안전한 싱글톤 패턴들

```java
// 1. 열거형 싱글톤 (권장)
public enum SingletonEnum {
    INSTANCE;

    public void doSomething() { }
}

// 2. static 초기화
public class SingletonStatic {
    private static final SingletonStatic INSTANCE = new SingletonStatic();

    private SingletonStatic() { }

    public static SingletonStatic getInstance() {
        return INSTANCE;
    }
}

// 3. 홀더 클래스 패턴 (지연 초기화)
public class SingletonHolder {
    private SingletonHolder() { }

    private static class Holder {
        static final SingletonHolder INSTANCE = new SingletonHolder();
    }

    public static SingletonHolder getInstance() {
        return Holder.INSTANCE;
    }
}

// 4. Double-Checked Locking (volatile 필수)
public class SingletonDCL {
    private static volatile SingletonDCL instance;

    private SingletonDCL() { }

    public static SingletonDCL getInstance() {
        if (instance == null) {
            synchronized (SingletonDCL.class) {
                if (instance == null) {
                    instance = new SingletonDCL();
                }
            }
        }
        return instance;
    }
}
```

### 5.3 불변 객체와 초기화 안전성

> **불변 객체는 별다른 동기화 방법을 적용하지 않아도 어느 스레드에서건 안전하게 사용할 수 있다.**

```java
// 불변 객체는 어떻게 공개해도 안전
@Immutable
public final class SafeValue {
    private final int value;

    public SafeValue(int value) {
        this.value = value;
    }

    public int getValue() { return value; }
}
```

### 5.4 가변성에 따른 공개 요구사항

| 객체 타입 | 요구사항 |
|----------|---------|
| 불변 객체 | 어떤 방법으로 공개해도 안전 |
| 결과적 불변 객체 | 안전하게 공개해야 함 |
| 가변 객체 | 안전하게 공개 + 동기화 또는 스레드 안전하게 구현 |

---

## 6. 객체 공유 원칙 정리

### 스레드 한정 (Thread Confinement)

```java
// 해당 스레드에서만 사용
private void processLocally() {
    List<String> localList = new ArrayList<>();  // 스택 한정
    // localList를 외부에 공개하지 않음
}
```

### 읽기 전용 공유 (Shared Read-Only)

```java
// 불변 객체 또는 결과적 불변 객체
private static final List<String> CONSTANTS =
    Collections.unmodifiableList(Arrays.asList("A", "B", "C"));
```

### 스레드 안전 공유 (Shared Thread-Safe)

```java
// 스레드 안전한 객체 사용
private final ConcurrentHashMap<String, Data> cache = new ConcurrentHashMap<>();
private final AtomicInteger counter = new AtomicInteger(0);
```

### 동기화된 공유 (Shared Guarded)

```java
// 락으로 보호
@GuardedBy("this")
private List<String> items = new ArrayList<>();

public synchronized void addItem(String item) {
    items.add(item);
}

public synchronized List<String> getItems() {
    return new ArrayList<>(items);  // 방어적 복사
}
```

---

## 정리

1. **가시성 문제**를 해결하려면 동기화가 필요하다. `synchronized`는 단일 연산과 가시성 모두 보장하고, `volatile`은 가시성만 보장한다.

2. **this 유출**을 피하라. 생성자에서 스레드를 시작하거나 리스너를 등록하지 말고, 팩토리 메소드 패턴을 사용하라.

3. **스레드 한정**은 동기화 없이 스레드 안전성을 확보하는 방법이다. 스택 한정과 `ThreadLocal`을 활용하라.

4. **불변 객체**는 항상 스레드 안전하다. 상태 변경이 필요하면 새 객체를 만들어 교체하라.

5. **안전한 공개**를 위해 `static` 초기화, `volatile`, `final`, 락, 스레드 안전 컬렉션을 활용하라.

6. **가변 객체**를 공유할 때는 안전하게 공개하고, 추가로 동기화도 해야 한다.
