---
title: "구성 단위 (Building Blocks)"
date: 2026-08-12
weight: 4
---

# 구성 단위 (Building Blocks)

자바 플랫폼이 제공하는 동시성 구성 단위를 다룬다. 동기화된 컬렉션의 한계, 병렬 컬렉션, 블로킹 큐와 프로듀서-컨슈머 패턴, 인터럽트 처리, 동기화 클래스를 살펴본다.

---

## 1. 동기화된 컬렉션

`Vector`, `Hashtable`, 그리고 `Collections.synchronizedXxx`로 만든 래퍼가 동기화된 컬렉션이다. 모두 **자바 모니터 패턴**을 사용해 public 메서드 전체를 컬렉션 자기 자신의 락으로 감싼다.

```java
// 동기화된 컬렉션을 만드는 세 가지 방법
List<String> v = new Vector<>();                              // 레거시
Map<String, String> h = new Hashtable<>();                    // 레거시
List<String> s = Collections.synchronizedList(new ArrayList<>());
```

### 1.1 개별 연산은 안전, 복합 연산은 불안전

각 메서드는 스레드 안전하지만, **여러 연산을 묶으면 그 사이에 다른 스레드가 끼어들 수 있다.**

```java
public static Object getLast(Vector list) {
    int lastIndex = list.size() - 1;   // check
    return list.get(lastIndex);        // act  → 그 사이에 크기가 바뀔 수 있다
}

public static void deleteLast(Vector list) {
    int lastIndex = list.size() - 1;
    list.remove(lastIndex);
}
```

```
시간  스레드 A          스레드 B
 │
 │   size() → 10
 │                   size() → 10
 │                   remove(9)
 ▼   get(9)
       → ArrayIndexOutOfBounds!
```

`Vector` 내부 데이터는 깨지지 않았다. **`Vector` 관점에서는 없는 항목을 요청했으니 예외를 던진 것이 정상 동작**이다. 깨진 것은 호출하는 쪽의 불변조건이다.

### 1.2 클라이언트 측 락으로 해결

동기화된 컬렉션은 **컬렉션 객체 자체를 락으로** 사용한다. 따라서 같은 락을 잡으면 복합 연산을 단일 연산으로 만들 수 있다.

```java
public static Object getLast(Vector list) {
    synchronized (list) {              // Vector가 쓰는 락과 동일
        int lastIndex = list.size() - 1;
        return list.get(lastIndex);
    }
}

public static void deleteLast(Vector list) {
    synchronized (list) {
        int lastIndex = list.size() - 1;
        list.remove(lastIndex);
    }
}
```

{{< callout type="warning" >}}
**`Collections.synchronizedList`는 래퍼를 락으로 사용한다.** 반드시 `synchronized (safeList)`처럼 **래퍼 객체**를 잠가야 하며, 원본 `ArrayList`를 잠그면 아무 효과가 없다. 원본 참조는 래핑 후 버리는 것이 안전하다.
{{< /callout >}}

### 1.3 반복과 `ConcurrentModificationException`

`Iterator`로 순회하는 도중 다른 스레드가 컬렉션을 변경하면 **즉시 멈춤(fail-fast)** 방식으로 `ConcurrentModificationException`을 던진다.

```java
List<String> list = Collections.synchronizedList(new ArrayList<>());

// 각 add/get은 안전하지만, 반복 전체는 안전하지 않다
for (String s : list) {      // 내부적으로 Iterator 사용
    doSomething(s);          // 이 사이에 다른 스레드가 add하면 예외!
}
```

동작 원리는 단순하다. 컬렉션이 **변경 횟수(modCount)** 를 세고 있다가, `hasNext`/`next` 호출 시 반복 시작 시점의 값과 다르면 예외를 던진다.

{{< callout type="info" >}}
**fail-fast는 보장이 아니라 경고다.** modCount 비교는 동기화되어 있지 않아 스테일 값을 볼 수 있다. 즉 **변경이 있었는데도 예외가 발생하지 않을 수 있다.** 성능을 위해 의도적으로 동기화를 뺀 설계이므로, 예외가 없다고 안전하다고 믿으면 안 된다.
{{< /callout >}}

**해결 방법과 비용:**

| 방법 | 설명 | 단점 |
|:-----|:-----|:-----|
| 반복문 전체를 락으로 감싸기 | `synchronized (list) { for (...) }` | 락 유지 시간 증가, 데드락·확장성 저하 |
| 복사본을 만들어 순회 | `clone()` 또는 새 컬렉션 생성 | 복사 비용, 복사 시점 동기화 필요 |
| **병렬 컬렉션 사용** | `ConcurrentHashMap`, `CopyOnWriteArrayList` | 대부분의 경우 최선 |

```java
// 반복문 전체 동기화 — 동작은 하지만 락을 오래 잡는다
synchronized (list) {
    for (String s : list) {
        doSomething(s);     // 여기서 다른 락을 잡으면 데드락 위험
    }
}
```

{{< callout type="warning" >}}
**반복문 안에서 락을 잡은 채로 또 다른 락을 요구하면 데드락 위험이 커진다.** 컬렉션을 오래 잠글수록 대기 스레드가 쌓이고, 대기 스레드가 쌓일수록 컨텍스트 스위칭 때문에 CPU 사용률까지 올라간다.
{{< /callout >}}

**숨어 있는 반복도 조심해야 한다.** `toString`, `hashCode`, `equals`, `containsAll`, `removeAll` 등은 내부적으로 컬렉션을 순회한다.

```java
// 로그 한 줄 때문에 ConcurrentModificationException이 터질 수 있다
System.out.println("현재 상태: " + list);   // list.toString() → 내부 반복
```

---

## 2. 병렬 컬렉션 (Concurrent Collections)

동기화된 컬렉션이 "하나의 락으로 전부 막는" 방식이라면, 병렬 컬렉션은 **동시 접근을 전제로 설계**된 자료구조다.

| 기존 클래스 | 병렬 대체제 | 특징 |
|:-----|:-----|:-----|
| `HashMap` / `Hashtable` | `ConcurrentHashMap` | 세밀한 락, 높은 처리량 |
| `TreeMap` / `TreeSet` | `ConcurrentSkipListMap` / `Set` | 정렬 유지 (자바 6) |
| `ArrayList` | `CopyOnWriteArrayList` | 읽기 위주에 최적 |
| `HashSet` | `CopyOnWriteArraySet` | 읽기 위주에 최적 |
| — | `BlockingQueue` 계열 | 대기 기능 내장 |

{{< callout type="info" >}}
**동기화된 컬렉션을 병렬 컬렉션으로 바꾸는 것만으로 확장성이 크게 개선되는 경우가 많다.** 위험 부담은 거의 없고 이득은 크다.
{{< /callout >}}

### 2.1 `ConcurrentHashMap`

`HashMap`과 같은 해시 기반 `Map`이지만 **락 스트라이핑(lock striping)** 으로 락을 잘게 쪼갠다.

```
동기화된 Map — 락 1개
┌───────────────────────────┐
│ [락] 전체 해시 테이블     │
└───────────────────────────┘
  → 한 번에 한 스레드만

ConcurrentHashMap — 락 N개
┌──────┬──────┬──────┬──────┐
│ [락] │ [락] │ [락] │ [락] │
│  B0  │  B1  │  B2  │  B3  │
└──────┴──────┴──────┴──────┘
  → 서로 다른 버킷은 동시 접근
```

| 연산 | 동시성 |
|:-----|:-----|
| 읽기 (`get`, `containsKey`) | 스레드 수 제한 없이 동시 처리 |
| 읽기 + 쓰기 | 동시 처리 가능 |
| 쓰기 (`put`, `remove`) | 제한된 개수만큼 동시 처리 |

**왜 락을 쪼개야 하는가?** `HashMap.get`은 해시 테이블을 탐색해야 하고, `List.contains`는 최악의 경우 모든 원소에 `equals`를 호출한다. `hashCode`가 고르게 분포하지 않으면 해시 테이블이 사실상 연결 리스트가 되어 탐색 시간이 급격히 늘어난다. **연산 하나가 오래 걸릴수록 전역 락의 비용은 커진다.**

**미약한 일관성(weakly consistent) `Iterator`:**

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

// 락 없이 순회해도 ConcurrentModificationException이 발생하지 않는다
for (Map.Entry<String, Integer> e : map.entrySet()) {
    process(e);      // 다른 스레드가 동시에 put/remove해도 안전
}
```

| 항목 | fail-fast (동기화 컬렉션) | 미약한 일관성 (병렬 컬렉션) |
|:-----|:-----|:-----|
| 순회 중 변경 | `ConcurrentModificationException` | 예외 없음 |
| 보이는 데이터 | 반복 시작 시점 기준 | 시작 시점 기준 + 이후 변경 반영 가능 |
| 락 필요 여부 | 필요 | **불필요** |

**대신 포기해야 하는 것:**

- `size()`, `isEmpty()`는 **추정값**이다. 계산하는 사이에도 값이 바뀔 수 있다.
- 맵 전체를 독점하는 락을 걸 수 없다. `Hashtable`이나 `synchronizedMap`처럼 "여러 연산 동안 아무도 못 건드리게" 막는 것이 불가능하다.

{{< callout type="info" >}}
**자바 8 이후의 `ConcurrentHashMap`은 세그먼트 락을 버렸다.** CAS로 버킷 헤드를 추가하고, 충돌 시에만 해당 버킷 노드에 `synchronized`를 거는 방식으로 바뀌어 락 단위가 더 잘게 쪼개졌다. 또한 개수가 `int` 범위를 넘을 수 있으므로 `size()` 대신 `mappingCount()`가 권장된다.
{{< /callout >}}

### 2.2 `Map` 기반의 단일 연산

`ConcurrentHashMap`은 독점 락을 걸 수 없으므로 **클라이언트 측 락으로 복합 연산을 만들 수 없다.** 대신 자주 쓰이는 복합 연산을 인터페이스가 직접 제공한다.

```java
public interface ConcurrentMap<K, V> extends Map<K, V> {

    // 키가 없는 경우에만 추가 (put-if-absent)
    V putIfAbsent(K key, V value);

    // 키가 지정한 값을 갖고 있는 경우에만 제거 (remove-if-equal)
    boolean remove(K key, V value);

    // 키가 oldValue를 갖고 있는 경우에만 치환 (replace-if-equal)
    boolean replace(K key, V oldValue, V newValue);

    // 키가 존재하는 경우에만 치환
    V replace(K key, V newValue);
}
```

```java
// 잘못된 방법 — check-then-act 경쟁 조건
if (!map.containsKey(key)) {
    map.put(key, value);       // 그 사이 다른 스레드가 넣을 수 있다
}

// 올바른 방법 — 단일 연산
map.putIfAbsent(key, value);
```

자바 8부터는 함수형 단일 연산도 사용할 수 있다.

```java
// 키가 없으면 계산해서 넣고, 있으면 기존 값 반환 (캐시 패턴)
Value v = map.computeIfAbsent(key, k -> expensiveCompute(k));

// 값 누적 — 단일 연산으로 안전하게
map.merge(word, 1, Integer::sum);          // 단어 빈도수 카운트
map.compute(key, (k, old) -> old == null ? 1 : old + 1);
```

{{< callout type="warning" >}}
**`computeIfAbsent`의 매핑 함수 안에서 같은 맵을 다시 건드리면 안 된다.** 해당 버킷의 락을 쥔 상태로 실행되므로 데드락이나 무한 루프에 빠질 수 있다. 함수는 짧고 부수효과가 없어야 한다.
{{< /callout >}}

### 2.3 `CopyOnWriteArrayList`

**변경할 때마다 내부 배열 전체를 복사**하는 리스트다. "불변 객체를 공개하면 동기화가 필요 없다"는 원리를 활용한다.

```
초기 상태
  배열 A [x, y, z]
     ▲
     └─ Iterator, 리스트가 함께 참조

add("w") 실행 후
  배열 A [x, y, z]     ◀ Iterator
  배열 B [x, y, z, w]  ◀ 리스트
```

- 반복은 **`Iterator`를 만든 시점의 배열**을 계속 사용한다
- 따라서 순회 중 변경이 일어나도 예외가 없고, 락도 필요 없다
- 대신 `Iterator`는 **그 시점의 스냅샷**이며 이후 변경은 보이지 않는다

```java
// 이벤트 리스너 관리 — CopyOnWriteArrayList의 전형적인 용례
public class EventSource {

    private final CopyOnWriteArrayList<Listener> listeners
            = new CopyOnWriteArrayList<>();

    public void addListener(Listener l) {   // 드물게 발생
        listeners.add(l);
    }

    public void fireEvent(Event e) {        // 매우 빈번하게 발생
        for (Listener l : listeners) {      // 락 없이 안전하게 순회
            l.onEvent(e);
        }
    }
}
```

{{< callout type="warning" >}}
**쓰기가 잦거나 원소가 많으면 사용하면 안 된다.** 변경 한 번마다 배열 전체를 복사하므로 `add`가 O(n)이다. **읽기(반복) 빈도가 쓰기 빈도보다 압도적으로 높을 때만** 이득이 있다. 또한 `Iterator`는 스냅샷이므로 `remove` 같은 변경 연산을 지원하지 않는다.
{{< /callout >}}

---

## 3. 블로킹 큐와 프로듀서-컨슈머 패턴

블로킹 큐는 **큐가 비면 꺼내기를 대기시키고, 가득 차면 넣기를 대기시키는** 큐다.

```
   프로듀서          컨슈머
      │                ▲
 put()│                │take()
      ▼                │
┌─────────────────────────┐
│      BlockingQueue      │
│  [작업] [작업] [작업]   │
└─────────────────────────┘
  가득 참   → put() 대기
  비어 있음 → take() 대기
```

### 3.1 프로듀서-컨슈머 패턴

"해야 할 일" 목록을 가운데 두고 **작업을 만드는 쪽과 처리하는 쪽을 분리**하는 설계다.

| 장점 | 설명 |
|:-----|:-----|
| **결합도 분리** | 프로듀서는 컨슈머를, 컨슈머는 프로듀서를 몰라도 된다 |
| **부하 조절** | 큐 크기 제한으로 양쪽 처리 속도를 자동 조율 |
| **안정성** | 과부하 시 프로듀서가 대기하므로 메모리 폭증을 막는다 |

```java
public class ProducerConsumer {

    private final BlockingQueue<Task> queue = new LinkedBlockingQueue<>(100);

    class Producer implements Runnable {
        public void run() {
            try {
                while (true) {
                    queue.put(createTask());   // 큐가 가득 차면 대기
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();   // 상태 복구 후 종료
            }
        }
    }

    class Consumer implements Runnable {
        public void run() {
            try {
                while (true) {
                    process(queue.take());     // 큐가 비면 대기
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
```

{{< callout type="info" >}}
**"컨슈머가 항상 따라잡을 것"이라고 가정하지 마라.** 크기 제한 없는 큐를 쓰면 프로듀서가 앞서 나가는 순간 큐에 작업이 무한정 쌓여 결국 `OutOfMemoryError`로 이어진다. **설계 단계부터 큐 크기를 제한**하는 것이 자원 관리의 시작이다.
{{< /callout >}}

### 3.2 `BlockingQueue`의 네 가지 연산 형태

상황별로 동작이 다른 메서드가 준비되어 있다.

| 동작 | 예외 발생 | 특수값 반환 | 무한 대기 | 시간 제한 |
|:-----|:-----|:-----|:-----|:-----|
| 추가 | `add(e)` | `offer(e)` | `put(e)` | `offer(e, t, u)` |
| 제거 | `remove()` | `poll()` | `take()` | `poll(t, u)` |
| 조회 | `element()` | `peek()` | — | — |

```java
// 과부하 상황을 대기 대신 즉시 감지하고 싶을 때
if (!queue.offer(task)) {
    log.warn("큐 포화 — 작업 폐기");     // 대기하지 않고 바로 실패
}

// 일정 시간만 기다리고 포기
Task t = queue.poll(500, TimeUnit.MILLISECONDS);
if (t == null) {
    // 타임아웃 — 다른 작업 수행
}
```

### 3.3 구현체 비교

| 구현체 | 자료구조 | 크기 제한 | 특징 |
|:-----|:-----|:-----|:-----|
| `ArrayBlockingQueue` | 배열 | 필수 | 생성 시 크기 고정, 락 1개 |
| `LinkedBlockingQueue` | 연결 리스트 | 선택 | 넣기/꺼내기 락 분리, 처리량 높음 |
| `PriorityBlockingQueue` | 힙 | 없음 | 우선순위 순 처리, FIFO 아님 |
| `SynchronousQueue` | 없음 | 0 | 저장 공간 없이 직접 전달 |
| `DelayQueue` | 힙 | 없음 | 지연 시간이 지난 항목만 꺼냄 |

```java
// SynchronousQueue — 큐에 쌓이지 않고 프로듀서와 컨슈머가 직접 만난다
BlockingQueue<Task> direct = new SynchronousQueue<>();
// put()은 take()하는 스레드가 나타날 때까지 대기한다
```

{{< callout type="info" >}}
**`SynchronousQueue`는 `Executors.newCachedThreadPool()`의 기본 큐다.** 작업을 쌓아두지 않고 즉시 처리할 스레드를 찾거나 새로 만들기 때문에, 대기 시간이 짧고 컨슈머가 항상 충분한 환경에서 유리하다. 참고로 `ConcurrentLinkedQueue`는 이름과 달리 **블로킹 큐가 아니다** — 비어 있으면 `poll()`이 그냥 `null`을 반환한다.
{{< /callout >}}

### 3.4 직렬 스레드 한정 (Serial Thread Confinement)

블로킹 큐는 가변 객체의 **소유권을 프로듀서에서 컨슈머로 안전하게 이전**한다.

```
프로듀서: 객체 생성 → 소유
    │
    │ put()  ── 소유권 이전
    ▼
 [블로킹 큐]
    │
    │ take()
    ▼
컨슈머: 유일한 소유자
   (프로듀서는 더 이상 접근 불가)
```

- 스레드 한정 객체는 **한 번에 한 스레드만** 소유한다
- 안전한 공개를 거치면 소유권을 **이전(transfer)** 할 수 있다
- 이전 후에는 새 소유자만 객체를 사용하므로 추가 동기화가 필요 없다

**핵심은 규율이다.** 큐에 넣은 뒤에도 프로듀서가 그 객체를 계속 참조하면 한정이 깨진다. 객체 풀(object pool)이 이 기법의 대표적인 예로, 빌려준 객체는 반납 전까지 빌려간 스레드의 것이다.

### 3.5 덱과 작업 가로채기 (Work Stealing)

`Deque`(자바 6)는 앞뒤 양쪽에서 넣고 뺄 수 있는 큐다. `ArrayDeque`, `LinkedBlockingDeque`가 구현체다.

```
 스레드 A 덱      스레드 B 덱
┌───────────┐   ┌───────────┐
│ T1 T2 T3  │   │ (비었음)  │
└───────────┘   └───────────┘
      ▲               │
      │               │
   앞에서 꺼냄    뒤에서 가로챔
```

| 항목 | 프로듀서-컨슈머 | 작업 가로채기 |
|:-----|:-----|:-----|
| 자료구조 | 큐 1개 공유 | 컨슈머마다 덱 1개 |
| 경쟁 | 모든 컨슈머가 경쟁 | 평소에는 경쟁 없음 |
| 유휴 처리 | 큐가 비면 대기 | 남의 덱 뒤에서 가로챔 |
| 확장성 | 보통 | **높음** |

**자기 작업은 앞에서, 남의 작업은 뒤에서** 가져가기 때문에 소유자와 가로채는 쪽이 충돌하지 않는다.

작업 가로채기는 **컨슈머가 곧 프로듀서인 경우**에 특히 잘 맞는다. 작업 하나를 처리하다 새 작업이 생기면 자기 덱에 넣으면 되기 때문이다. 그래프 탐색, GC의 힙 마킹 작업이 대표적이다.

{{< callout type="info" >}}
**자바 7의 `ForkJoinPool`이 이 패턴을 그대로 구현했다.** 분할 정복 작업을 재귀적으로 쪼개고 유휴 스레드가 남의 작업을 가로챈다. 자바 8의 병렬 스트림(`parallelStream()`)도 내부적으로 `ForkJoinPool.commonPool()`을 사용한다.
{{< /callout >}}

---

## 4. 블로킹 메서드와 인터럽터블 메서드

### 4.1 스레드 상태

블로킹 연산은 단순히 오래 걸리는 연산과 다르다. **외부의 신호를 받아야만 계속 진행할 수 있는** 연산이다.

| 상태 | 의미 |
|:-----|:-----|
| `RUNNABLE` | 실행 중이거나 CPU를 기다리는 중 |
| `BLOCKED` | `synchronized` 락 획득 대기 |
| `WAITING` | `wait()`, `join()`, `take()` 등으로 무기한 대기 |
| `TIMED_WAITING` | `sleep(n)`, `poll(t, u)` 등으로 시간 제한 대기 |

`InterruptedException`을 던지는 메서드는 곧 **블로킹 메서드**라는 신호다. `Thread.sleep`, `BlockingQueue.put`/`take`, `Object.wait`, `Future.get` 등이 여기 속한다.

### 4.2 인터럽트는 협력이지 강제가 아니다

```java
Thread t = new Thread(task);
t.start();
t.interrupt();          // "멈춰 달라"는 요청일 뿐, 강제 종료가 아니다
```

- 모든 스레드는 **인터럽트 상태 플래그**를 갖는다
- `interrupt()`는 플래그를 `true`로 설정한다
- 블로킹 중이었다면 대기가 풀리며 `InterruptedException`이 발생하고, **플래그는 초기화된다**
- 인터럽트를 받은 스레드가 **언제 어떻게 멈출지는 스스로 정한다**

| 메서드 | 동작 | 플래그 |
|:-----|:-----|:-----|
| `Thread.interrupt()` | 인터럽트 요청 | `true`로 설정 |
| `Thread.isInterrupted()` | 상태 확인 | 변경 없음 |
| `Thread.interrupted()` | 상태 확인 (정적) | **`false`로 초기화** |

{{< callout type="warning" >}}
**`Thread.interrupted()`는 확인과 동시에 플래그를 지운다.** `true`를 받았다면 인터럽트를 직접 처리하거나 `Thread.currentThread().interrupt()`로 다시 설정해야 한다. 그러지 않으면 인터럽트 요청이 그대로 사라진다.
{{< /callout >}}

### 4.3 `InterruptedException` 처리 방법

**방법 1 — 호출한 쪽으로 전달**

```java
// 가장 단순하고 대개 옳은 방법
public Task getNextTask(BlockingQueue<Task> queue)
        throws InterruptedException {
    return queue.take();       // 예외를 그대로 위임
}
```

**방법 2 — 인터럽트 상태 복구**

```java
// Runnable.run()처럼 예외를 던질 수 없는 경우
public void run() {
    try {
        process(queue.take());
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();   // 상태 복구
        // 상위 호출부가 인터럽트를 인지할 수 있다
    }
}
```

**절대 하면 안 되는 것 — 삼키기**

```java
// 최악의 코드
try {
    queue.take();
} catch (InterruptedException e) {
    // 아무것도 하지 않음 → 인터럽트 증거 인멸
}
```

{{< callout type="warning" >}}
**`InterruptedException`을 잡고 아무 대응도 하지 않으면 인터럽트가 있었다는 사실 자체가 사라진다.** 호출 스택 상위에서 취소 요청에 대응할 기회를 빼앗는 것이며, 종료되지 않는 스레드의 흔한 원인이다. 최소한 `Thread.currentThread().interrupt()`로 상태를 복구하라.
{{< /callout >}}

---

## 5. 동기화 클래스 (Synchronizer)

**상태 정보를 이용해 스레드의 작업 흐름을 조절하는 클래스**를 동기화 클래스라고 한다. 블로킹 큐도 동기화 클래스의 일종이다.

모든 동기화 클래스는 공통 구조를 갖는다.

1. 통과시킬지 대기시킬지 결정하는 **상태 정보**
2. 상태를 **변경**하는 메서드
3. 특정 상태가 될 때까지 효율적으로 **대기**하는 메서드

### 5.1 래치 (Latch)

**터미널 상태에 도달할 때까지 스레드를 막아두는** 일회성 관문이다. 한 번 열리면 영구히 열린 상태로 유지된다.

```
CountDownLatch(3)

카운트  3 ──▶ 2 ──▶ 1 ──▶ 0
        │      │      │     │
     countDown 3회 호출     ▼
                        관문 열림
   대기 스레드 ─── await() ──▶ 통과
                       (이후 즉시 통과)
```

```java
// 여러 스레드를 동시에 출발시키고 전체 소요 시간 측정
public long timeTasks(int nThreads, Runnable task)
        throws InterruptedException {

    CountDownLatch startGate = new CountDownLatch(1);          // 출발 신호
    CountDownLatch endGate = new CountDownLatch(nThreads);     // 도착 확인

    for (int i = 0; i < nThreads; i++) {
        new Thread(() -> {
            try {
                startGate.await();        // 출발 신호를 기다린다
                try {
                    task.run();
                } finally {
                    endGate.countDown();  // 도착 보고
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }

    long start = System.nanoTime();
    startGate.countDown();        // 관문 개방 → 전원 동시 출발
    endGate.await();              // 전원 도착까지 대기
    return System.nanoTime() - start;
}
```

- **시작 게이트**: 모든 스레드가 준비될 때까지 대기 → 스레드 생성 시간 편차 제거
- **종료 게이트**: 모든 작업이 끝날 때까지 대기 → 정확한 측정

{{< callout type="warning" >}}
**`countDown()`은 반드시 `finally` 블록에 넣어야 한다.** 작업이 예외로 중단되어도 카운트가 줄지 않으면, `await()`로 기다리는 스레드가 영원히 깨어나지 못한다.
{{< /callout >}}

### 5.2 `FutureTask`

`FutureTask`도 래치처럼 동작한다. **연산의 결과를 기다리는 관문**이다.

```
시작 전 대기 ──▶ 시작됨 ──▶ 종료됨
                             │
            정상 종료 / 취소 / 예외
            (도달하면 상태 불변)
```

```java
public class Preloader {

    private final FutureTask<ProductInfo> future =
        new FutureTask<>(() -> loadProductInfo());   // Callable

    private final Thread thread = new Thread(future);

    public void start() {
        thread.start();      // 미리 로딩 시작
    }

    public ProductInfo get() throws InterruptedException {
        try {
            return future.get();     // 끝났으면 즉시, 아니면 대기
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();     // 실제 예외는 여기 담긴다
            throw launderThrowable(cause);
        }
    }
}
```

| 상태 | `get()` 동작 |
|:-----|:-----|
| 종료됨 | 결과를 즉시 반환 |
| 실행 중 | 종료될 때까지 대기 |
| 예외로 종료 | `ExecutionException`으로 감싸서 던짐 |
| 취소됨 | `CancellationException` |

{{< callout type="info" >}}
**`FutureTask`는 결과 객체를 안전하게 공개한다.** 연산을 수행한 스레드에서 만든 결과가 `get()`을 호출한 스레드에 안전하게 전달되도록 규약으로 보장한다. 시간이 오래 걸리는 작업을 실제 필요 시점보다 먼저 시작해 두는 용도로 유용하다.
{{< /callout >}}

### 5.3 세마포어 (Semaphore)

**동시에 자원을 사용할 수 있는 스레드 수를 제한**한다. 가상의 퍼밋(permit)을 나눠주고 회수하는 방식이다.

```java
// 크기가 제한된 컬렉션 — 세마포어로 용량을 통제
public class BoundedHashSet<T> {

    private final Set<T> set;
    private final Semaphore sem;

    public BoundedHashSet(int bound) {
        this.set = Collections.synchronizedSet(new HashSet<>());
        this.sem = new Semaphore(bound);      // 퍼밋 = 남은 자리
    }

    public boolean add(T o) throws InterruptedException {
        sem.acquire();                        // 자리가 없으면 대기
        boolean wasAdded = false;
        try {
            wasAdded = set.add(o);
            return wasAdded;
        } finally {
            if (!wasAdded) {
                sem.release();                // 실패 시 퍼밋 반납
            }
        }
    }

    public boolean remove(Object o) {
        boolean wasRemoved = set.remove(o);
        if (wasRemoved) {
            sem.release();                    // 자리 하나 반환
        }
        return wasRemoved;
    }
}
```

| 메서드 | 동작 |
|:-----|:-----|
| `acquire()` | 퍼밋 확보, 없으면 대기 (인터럽트 가능) |
| `tryAcquire()` | 퍼밋이 없으면 즉시 `false` 반환 |
| `tryAcquire(t, u)` | 지정 시간까지만 대기 |
| `release()` | 퍼밋 반납 |

**이진 세마포어(퍼밋 1개)** 는 뮤텍스로 쓸 수 있다. 단, `synchronized`와 달리 **재진입이 되지 않는다.**

{{< callout type="warning" >}}
**`release()`는 반드시 `finally`에서 호출하라.** 예외 경로에서 퍼밋을 반납하지 않으면 퍼밋이 하나씩 새어나가 결국 모든 스레드가 영원히 대기한다. 또한 세마포어는 획득한 스레드와 반납하는 스레드가 달라도 되므로, `synchronized`처럼 자동 해제를 기대하면 안 된다.
{{< /callout >}}

### 5.4 배리어 (Barrier)

배리어는 **여러 스레드가 모두 특정 지점에 도착할 때까지** 서로를 기다리게 한다.

```
래치 — 이벤트를 기다린다
  대기 스레드 ──▶ [카운트 0?] ──▶ 통과
  (일회성, 되돌릴 수 없음)

배리어 — 다른 스레드를 기다린다
  T1 ──▶│
  T2 ──▶│ 전원 도착 → 동시 통과
  T3 ──▶│ → 다시 사용 가능 (재사용)
```

| 항목 | `CountDownLatch` | `CyclicBarrier` |
|:-----|:-----|:-----|
| 기다리는 대상 | **이벤트** (카운트 0) | **다른 스레드** (전원 도착) |
| 재사용 | 불가 (일회성) | **가능** |
| 카운트 감소 주체 | 아무 스레드나 | 도착한 스레드 자신 |
| 완료 시 동작 | 없음 | 배리어 액션 실행 가능 |

```java
// 격자 시뮬레이션 — 각 단계가 끝날 때마다 결과를 취합
public class CellularAutomata {

    private final CyclicBarrier barrier;
    private final Worker[] workers;

    public CellularAutomata(Board board) {
        int count = Runtime.getRuntime().availableProcessors();

        // 모든 워커가 도착하면 배리어 액션이 실행된다
        this.barrier = new CyclicBarrier(count, board::commitNewValues);

        this.workers = new Worker[count];
        for (int i = 0; i < count; i++) {
            workers[i] = new Worker(board.getSubBoard(count, i));
        }
    }

    private class Worker implements Runnable {
        private final Board board;

        Worker(Board board) { this.board = board; }

        public void run() {
            while (!board.hasConverged()) {
                for (int x = 0; x < board.getMaxX(); x++) {
                    for (int y = 0; y < board.getMaxY(); y++) {
                        board.setNewValue(x, y, computeValue(x, y));
                    }
                }
                try {
                    barrier.await();     // 다른 워커를 기다린다
                } catch (InterruptedException | BrokenBarrierException e) {
                    return;
                }
            }
        }
    }
}
```

{{< callout type="warning" >}}
**배리어는 한 스레드만 실패해도 전체가 깨진다.** 대기 중인 스레드에 인터럽트가 걸리거나 타임아웃이 나면 배리어는 **파손(broken)** 상태가 되고, 나머지 스레드는 모두 `BrokenBarrierException`을 받는다. `reset()`으로 복구할 수 있지만, 애초에 워커 수와 배리어 파티 수가 일치하는지 확인하는 것이 중요하다.
{{< /callout >}}

---

## 6. 요약

### 구성 단위 선택 가이드

```
어떤 자료구조가 필요한가?

Map이 필요하다
  └▶ ConcurrentHashMap
     정렬 필요 → ConcurrentSkipListMap

List가 필요하다
  ├▶ 읽기 >>> 쓰기
  │    └▶ CopyOnWriteArrayList
  └▶ 그 외
       └▶ synchronizedList
          + 클라이언트 측 락

작업을 주고받아야 한다
  ├▶ 대기 필요 → BlockingQueue
  ├▶ 대기 불필요 → ConcurrentLinkedQueue
  └▶ 컨슈머가 작업 생성
       └▶ Deque + 작업 가로채기

스레드 흐름을 조절해야 한다
  ├▶ 이벤트 대기 → CountDownLatch
  ├▶ 서로 대기  → CyclicBarrier
  ├▶ 개수 제한  → Semaphore
  └▶ 결과 대기  → FutureTask
```

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **동기화된 컬렉션** | 개별 연산은 안전, 복합 연산은 클라이언트 락 필요 |
| **fail-fast** | 순회 중 변경을 감지해 예외 발생 (보장 아닌 경고) |
| **미약한 일관성** | 순회 중 변경을 허용, 락 없이 반복 가능 |
| **락 스트라이핑** | 락을 잘게 쪼개 동시 접근 처리량을 높이는 기법 |
| **변경 시 복사** | 쓰기마다 복사본 생성, 읽기 위주 상황에 적합 |
| **프로듀서-컨슈머** | 큐를 사이에 두고 생성·처리 주체를 분리 |
| **직렬 스레드 한정** | 객체 소유권을 한 스레드에서 다른 스레드로 이전 |
| **작업 가로채기** | 컨슈머마다 덱을 두고 유휴 시 남의 작업을 가져옴 |
| **인터럽트** | 강제 종료가 아닌 중단 '요청', 삼키면 안 됨 |
| **동기화 클래스** | 상태 정보로 스레드 흐름을 조절하는 클래스 |

### 1부 정리 — 기본 원리

지금까지 다룬 스레드 안전성의 핵심 원칙을 정리한다.

| 원칙 | 설명 |
|:-----|:-----|
| **변경 가능성을 줄여라** | 병렬성 문제는 전부 변경 가능한 상태에서 나온다 |
| **`final`을 기본값으로** | 변경할 필요가 없는 변수는 모두 `final`로 선언 |
| **불변 객체는 항상 안전** | 락도 방어적 복사도 없이 공유 가능 |
| **캡슐화로 복잡도 제어** | 데이터를 객체 안에 가두면 변경 경로가 제한된다 |
| **가변 객체는 락으로 보호** | 공유되는 변경 가능 변수는 예외 없이 |
| **연관 변수는 같은 락으로** | 불변조건에 참여하는 변수는 하나의 락으로 |
| **복합 연산은 락을 유지** | check-then-act 사이에 락을 놓지 마라 |
| **추측하지 마라** | "동기화 없어도 될 것 같다"는 판단은 대부분 틀린다 |
| **설계 단계부터 고려** | 최소한 스레드 안전하지 않다는 사실은 문서로 남겨라 |
| **동기화 정책을 문서화** | `@ThreadSafe`, `@GuardedBy`로 의도를 남긴다 |

{{< callout type="info" >}}
**병렬성 문제는 결국 하나로 수렴한다 — 공유되고 변경 가능한 상태에 대한 접근을 어떻게 조율할 것인가.** 이 장에서 살펴본 구성 단위들은 그 조율을 직접 구현하지 않고 검증된 라이브러리에 맡기기 위한 도구다. 직접 만들기 전에 이미 있는 것부터 찾아보자.
{{< /callout >}}
