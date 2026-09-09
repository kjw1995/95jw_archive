---
title: "Chapter 11. 컬렉션 프레임웍 (Collections Framework)"
date: 2026-01-06
weight: 11
---

앞 장들이 이 장으로 미뤄 둔 질문이 셋 있다. `for-each`로 돌면서 요소를 지우면 왜 `ConcurrentModificationException`이 나는가([Chapter 04](../04-control-statements)). 길이를 바꿀 수 없는 배열을 `ArrayList`는 어떻게 "늘어나는 배열"로 보이게 하는가([Chapter 05](../05-array)). `equals()`를 재정의하면 `hashCode()`도 재정의해야 한다는 규칙은 `HashMap` 안에서 정확히 무엇 때문인가([Chapter 09](../09-java-lang-package)). 세 질문의 답은 모두 컬렉션 클래스의 **안쪽 구조**에 있다. 그래서 이 장은 API 목록보다 구조를 먼저 본다. 원리는 셋이다. 첫째, **자료구조는 "어떤 연산을 자주 하는가"에 대한 답이다.** 자바의 컬렉션은 배열, 연결 리스트, 해시 테이블, 트리 네 가지 물리 구조 중 하나 위에 서 있고, 클래스 선택은 자주 하는 연산의 비용을 보는 일이다. 둘째, **약속은 인터페이스로 하고 구현은 바꿀 수 있게 둔다.** [Chapter 07](../07-oop-advanced)에서 본 인터페이스의 원리를 가장 크게 적용한 사례가 이 프레임웍이다. 셋째, **같음과 순서는 누가 정하는가.** 9장의 `equals()`와 `hashCode()`가 해시 구조를 움직이고, 이 장의 `Comparable`과 `Comparator`가 정렬 구조를 움직인다. 이 셋을 잡으면 "중복 제거는 `HashSet`, 정렬은 `TreeSet`" 같은 선택 규칙이 암기가 아니라 결과가 된다.

---

## 1. 컬렉션 프레임웍: 약속과 구현의 분리

### 1.1 왜 프레임웍인가

JDK 1.0에도 데이터를 담는 클래스는 있었다. `Vector`, `Hashtable`, `Stack`이 그것인데, 서로 아무 관계가 없었다. 순회 방법이 각자 달랐고 메서드 이름도 제각각이라, 담는 자료구조를 바꾸면 그것을 쓰는 코드를 전부 고쳐야 했다. JDK 1.2(1998년)가 이것을 정리했다. **"데이터 그룹을 다루는 방법"을 인터페이스로 표준화**하고, 기존 클래스들을 그 인터페이스에 맞춰 고치고, 새 구현 클래스를 그 아래에 채웠다. 그것이 컬렉션 프레임웍이다.

```
 Collection ─┬─ List   순서 O, 중복 O
             ├─ Set    순서 X, 중복 X
             └─ Queue  꺼내는 순서
 Map ────────── 키-값 쌍, 키 중복 X
```

프레임웍이 인터페이스 계층으로 시작하는 이유는 7장에서 본 그대로다. 코드는 `List`라는 약속에만 의존하고, 그 약속을 배열로 지킬지 연결 리스트로 지킬지는 구현이 정한다. 그래서 변수는 인터페이스 타입으로 선언한다.

```java
List<String> names = new ArrayList<>();   // 약속은 List, 구현은 ArrayList
names = new LinkedList<>();               // 구현을 바꿔도 쓰는 코드는 그대로
```

`ArrayList<String> names = new ArrayList<>()`로 선언하면 나중에 구현을 바꿀 때 선언부와 매개변수 타입까지 전부 따라 바뀐다. 인터페이스로 선언하는 습관은 취향이 아니라 프레임웍이 만들어진 목적을 따르는 것이다.

### 1.2 핵심 인터페이스

| 인터페이스 | 약속 | 대표 구현 |
|:-----------|:-----|:----------|
| `List` | 넣은 순서를 기억하고, 인덱스로 접근하며, 중복을 허용한다 | `ArrayList`, `LinkedList` |
| `Set` | 같은 요소를 두 번 담지 않는다. 순서는 약속하지 않는다 | `HashSet`, `LinkedHashSet`, `TreeSet` |
| `Queue` | 한쪽으로 넣고 정해진 순서로 꺼낸다 | `ArrayDeque`, `LinkedList`, `PriorityQueue` |
| `Deque` | 양쪽 끝에서 넣고 뺀다. 스택과 큐를 겸한다 | `ArrayDeque`, `LinkedList` |
| `Map` | 키로 값을 찾는다. 키는 중복될 수 없다 | `HashMap`, `LinkedHashMap`, `TreeMap` |

`Map`이 `Collection`의 자손이 아닌 것은 실수가 아니다. `Collection`의 약속은 `add(요소)`, `contains(요소)`처럼 요소 하나를 다루는데, `Map`이 다루는 것은 키와 값의 쌍이라 그 약속이 맞지 않는다. 대신 `Map`은 `keySet()`, `values()`, `entrySet()`으로 자신을 `Collection`의 모습으로 **보여 준다.** 키는 중복이 없으니 `Set`이고, 값은 중복될 수 있으니 `Collection`이다. 이 셋은 복사본이 아니라 `Map`을 들여다보는 뷰라서, 뷰에서 요소를 지우면 `Map`에서도 지워진다.

`Collection`이 약속하는 메서드는 이름만 봐도 뜻이 통한다.

| 메서드 | 약속 |
|:-------|:-----|
| `add(e)`, `addAll(c)` | 요소를 넣는다. 넣었으면 `true` |
| `remove(o)`, `removeAll(c)`, `retainAll(c)` | 지운다. `retainAll`은 `c`에 있는 것만 남긴다 |
| `contains(o)`, `containsAll(c)` | 들어 있는가 |
| `size()`, `isEmpty()`, `clear()` | 개수, 비었는가, 전부 지운다 |
| `iterator()` | 순회할 `Iterator`를 준다(5절) |
| `toArray()`, `stream()` | 배열로, 스트림으로([Chapter 14](../14-lambda-stream)) |

`Map`은 `put(k, v)`, `get(k)`, `remove(k)`, `containsKey(k)`, `containsValue(v)`에 Java 8이 더한 `getOrDefault`, `putIfAbsent`, `computeIfAbsent`, `merge`가 핵심이다(8.4절).

### 1.3 네 가지 물리 구조

인터페이스가 약속이라면 구현은 물리 구조다. 자바 컬렉션의 구현은 넷 중 하나 위에 서 있고, 어느 것인지를 알면 그 클래스의 장단점은 외울 필요가 없다.

| 구조 | 인덱스 접근 | 값으로 검색 | 끝에 넣고 빼기 | 중간에 넣고 빼기 | 순서 |
|:-----|:-----------|:-----------|:--------------|:----------------|:-----|
| 배열 | O(1) | O(n) | O(1) | O(n). 뒤를 밀어야 한다 | 넣은 순서 |
| 연결 리스트 | O(n) | O(n) | O(1) | 참조 변경은 O(1), 위치 찾기가 O(n) | 넣은 순서 |
| 해시 테이블 | 없음 | O(1) | O(1) | O(1) | 없음 |
| 트리 | 없음 | O(log n) | O(log n) | O(log n) | 정렬 순서 |

| 물리 구조 | 클래스 |
|:----------|:-------|
| 배열 | `ArrayList`, `ArrayDeque`, `Vector`, `Stack`, `PriorityQueue`(힙) |
| 연결 리스트 | `LinkedList` |
| 해시 테이블 | `HashMap`, `HashSet`, `LinkedHashMap`, `LinkedHashSet`, `Hashtable`, `Properties` |
| 트리 | `TreeMap`, `TreeSet` |

"조회가 많으면 `ArrayList`, 중복을 없애려면 `HashSet`, 정렬된 채로 두려면 `TreeSet`" 같은 규칙은 전부 이 두 표에서 나온다. 이제 구조를 하나씩 안에서 본다.

---

## 2. ArrayList: 교체되는 배열

### 2.1 안에는 배열 하나와 개수 하나

5장에서 배열은 힙의 연속된 블록이라 길이를 바꿀 수 없다고 했다. `ArrayList`는 그 배열을 안에 감추고, 실제로 채운 개수를 따로 센다.

```
ArrayList (size=3, capacity=5)
elementData
┌───┬───┬───┬────┬────┐
│ A │ B │ C │null│null│
└───┴───┴───┴────┴────┘
  0   1   2   3    4
```

`size()`가 돌려주는 것은 배열의 길이가 아니라 채운 개수다. 배열 길이(용량)가 개수보다 크게 잡혀 있어서 끝에 하나 더 넣는 일은 그냥 칸 하나를 채우는 것이고, 용량이 꽉 찼을 때만 **1.5배 큰 배열을 새로 만들어 복사**한다. 길이가 늘어나는 것이 아니라 배열이 교체되는 것이다. JDK 25에서 직접 확인하면 빈 `ArrayList`의 배열 길이는 0이고, 첫 `add()`에서 10이 되며, 그 뒤로 15, 22, 33으로 늘어난다. 배열을 첫 요소가 들어올 때까지 만들지 않는 것은 비어 있는 채로 끝나는 리스트가 많아서다.

```java
List<String> list = new ArrayList<>();       // 첫 add()에서 용량 10
List<String> big = new ArrayList<>(10_000);  // 처음부터 10,000

list.add("Java");
list.add("Python");
list.add(1, "Kotlin");         // 인덱스 1에 끼워 넣기
list.get(0);                   // "Java". 배열 인덱스 접근
list.set(0, "Java 21");
list.indexOf("Python");        // 2. 앞에서부터 equals()로 찾는다
list.contains("C++");          // false
list.remove(0);                // 인덱스로
list.remove("C++");            // 객체로. equals()가 true인 첫 요소
```

개수를 미리 알면 초기 용량을 주는 것이 좋다. 백만 개를 하나씩 넣으면 배열 교체가 서른 번 가까이 일어나고 그때마다 전체를 복사하는데, 처음부터 백만으로 잡으면 한 번도 일어나지 않는다. `trimToSize()`는 반대로 남는 칸을 잘라 낸다.

### 2.2 중간에 넣으면 뒤가 밀린다

```
add(2, X)  size=4
[A][B][C][D][ ]
       └──┴──▶ 한 칸씩 뒤로 복사
[A][B][ ][C][D]
[A][B][X][C][D]
```

배열은 연속된 칸이므로 중간에 넣으려면 그 뒤를 전부 한 칸씩 밀어야 한다. `System.arraycopy()`가 그 일을 하고, 중간에서 지울 때는 반대로 당긴다. 비용이 뒤에 남은 개수에 비례하므로, 앞쪽에 넣고 빼는 일이 잦은 리스트에는 배열이 맞지 않는다. 다만 이 복사가 얼마나 빠른지는 3절의 실측에서 다시 본다.

`List<Integer>`에서는 `remove()`가 두 개라는 점도 알아 둘 만하다. `remove(int index)`와 `remove(Object o)`가 있어서, `list.remove(1)`은 인덱스 1을 지우고 값 1을 지우려면 `list.remove(Integer.valueOf(1))`로 써야 한다. 9장의 오토박싱은 `int`가 그대로 맞는 오버로딩이 있으면 박싱을 하지 않기 때문이다.

---

## 3. LinkedList: 참조로 이어진 노드

### 3.1 노드는 흩어져 있고 참조로 이어진다

```
 null ◀─ [A] ◀─▶ [B] ◀─▶ [C] ─▶ null
          ▲               ▲
        first           last

노드 하나 = 값 + prev 참조 + next 참조
```

```java
class Node<E> {          // LinkedList 안의 실제 구조
    E item;
    Node<E> next;
    Node<E> prev;
}
```

배열이 연속된 칸이라면 연결 리스트는 흩어진 노드다. 각 노드가 다음 노드와 이전 노드의 주소를 들고 있어서, 자바의 `LinkedList`는 양쪽으로 오갈 수 있는 **더블 링크드 리스트**다. 연속될 필요가 없으니 크기 제한도 배열 교체도 없고, 중간에 넣고 빼는 것은 참조 두 개를 바꾸는 일이다.

```
삭제 (B)
 [A] ─▶ [B] ─▶ [C]
 [A] ───────▶ [C]      A.next = C

삽입 (X)
 [A] ─▶ [C]
 [A] ─▶ [X] ─▶ [C]     참조만 바꾼다
```

### 3.2 그런데 그 위치까지 가는 비용

참조를 바꾸는 것은 O(1)이지만, **바꿀 위치까지 가는 것**은 그렇지 않다. 배열은 `[i]`로 바로 가지만 노드에는 번호가 없어서 처음부터 하나씩 따라가야 한다. JDK의 `LinkedList.get(i)`는 `i`가 앞쪽 절반이면 `first`부터, 뒤쪽 절반이면 `last`부터 걷는다. 절반으로 줄여도 평균 n/4번의 참조 추적이고, 그 노드들은 메모리 여기저기에 흩어져 있어 캐시에도 불리하다. 원서의 표는 "중간 추가·삭제는 `LinkedList`가 빠르다"고 하지만, 실제로 재 보면 그렇지 않다. 필자의 PC에서 JDK 25로 요소 10만 개짜리 두 리스트에 같은 작업을 시킨 결과다.

| 작업(각 1만 번) | `ArrayList` | `LinkedList` |
|:----------------|------------:|-------------:|
| 중간에 `add(size/2, x)` | 약 40 ms | 약 800 ms |
| 맨 앞에 `add(0, x)` | 약 85 ms | 0.2 ms 미만 |
| 임의 위치 `get(i)` | 약 1 ms | 약 400 ms |
| 맨 앞 `remove(0)` | 약 87 ms | 0.1 ms 미만 |
| 끝에 `add(x)` 10만 번 | 약 1 ms | 약 1 ms |

중간 삽입에서 `ArrayList`가 20배 빠른 이유는 `arraycopy`가 연속된 메모리를 통째로 옮기는 명령이라 요소 5만 개를 미는 데 몇 마이크로초면 되는 반면, `LinkedList`는 2만 5천 개의 노드를 하나씩 따라가야 하기 때문이다. `LinkedList`가 이기는 것은 **양 끝**이다. `first`와 `last`를 들고 있으니 앞뒤에 넣고 빼는 것은 걷지 않아도 된다. 그런데 그 용도라면 4절의 `ArrayDeque`가 맞다. JDK 문서도 큐로 쓸 때 `LinkedList`보다 빠를 것이라고 적어 두었고, 노드 객체를 만들지 않아 메모리도 적게 쓴다. 메모리도 살펴볼 만하다. `ArrayList`는 요소당 참조 하나(4바이트)에 여유 칸이 조금 붙는 정도지만, `LinkedList`는 요소마다 노드 객체를 하나씩 만들어 헤더와 참조 셋에 24바이트를 더 쓴다.

그래서 현실의 선택 규칙은 원서의 표보다 단순하다. **리스트는 `ArrayList`로 시작하고**, `LinkedList`는 `ListIterator`로 순회하면서 그 자리에 넣고 빼는 특수한 경우(5.3절)에만 고려한다.

---

## 4. Stack, Queue, Deque

### 4.1 Stack은 왜 쓰지 말라고 하나

스택은 마지막에 넣은 것을 먼저 꺼내는(LIFO) 구조다. 메서드 호출 스택(6장), 괄호 짝 검사, 실행 취소가 전부 이것이다.

```
push(1) → push(2) → push(3)
  ┌───┐
  │ 3 │ ← top. pop()하면 3
  ├───┤
  │ 2 │
  ├───┤
  │ 1 │
  └───┘
```

`java.util.Stack` 클래스가 있지만 JDK 문서 자체가 "더 완전하고 일관된 LIFO 연산은 `Deque`가 제공한다"고 적어 두었다. 이유는 `Stack`이 JDK 1.0의 `Vector`를 **상속**했기 때문이다. `Vector`는 모든 메서드가 동기화되어 있어 한 스레드만 써도 비용이 들고(9장의 `StringBuffer`와 같은 사정), 상속했으니 `stack.get(0)`처럼 바닥을 직접 들여다보는 메서드가 다 열려 있어 LIFO라는 약속을 깰 수 있다. 7장에서 "포함이 기본, 상속은 ~은 ~이다일 때만"이라고 했는데, 스택은 벡터가 아니다. 1.0 시절의 설계 실수가 호환성 때문에 남아 있는 것이다.

```java
Deque<String> stack = new ArrayDeque<>();
stack.push("A");
stack.push("B");
stack.push("C");
stack.peek();   // "C". 보기만
stack.pop();    // "C". 꺼내기
stack.pop();    // "B"
```

### 4.2 Queue: 두 벌의 메서드

큐는 먼저 넣은 것을 먼저 꺼내는(FIFO) 구조다. 인쇄 대기열, 요청 처리 순서, 너비 우선 탐색이 이것이다.

```
offer(1) → offer(2) → offer(3)
 입구 → [1][2][3] → 출구
        poll()하면 1
```

| 하는 일 | 실패하면 예외 | 실패하면 특별한 값 |
|:--------|:-------------|:------------------|
| 넣기 | `add(e)` | `offer(e)` → `false` |
| 꺼내기 | `remove()` | `poll()` → `null` |
| 보기 | `element()` | `peek()` → `null` |

같은 일을 하는 메서드가 두 벌인 이유는 큐의 쓰임 때문이다. 큐가 비는 것은 오류가 아니라 흔한 상태라서, 매번 `try-catch`를 쓰는 대신 `null`을 돌려받는 쪽이 자연스럽다. 반대로 비어 있으면 안 되는 상황에서는 예외가 맞다. 8장에서 실패를 반환값으로 알릴지 예외로 알릴지의 기준을 봤는데, 큐는 호출자가 고르게 두었다.

```java
Queue<String> queue = new ArrayDeque<>();
queue.offer("A");
queue.offer("B");
queue.peek();    // "A"
queue.poll();    // "A"
queue.poll();    // "B"
queue.poll();    // null. 비었다
queue.remove();  // NoSuchElementException
```

### 4.3 Deque와 ArrayDeque

`Deque`는 양쪽 끝에서 넣고 빼는 큐다. 앞에서만 빼면 큐, 넣은 쪽에서 빼면 스택이므로 둘을 겸한다.

| `Deque` | 큐로 쓸 때 | 스택으로 쓸 때 |
|:--------|:-----------|:---------------|
| `offerLast(e)` / `addLast(e)` | `offer(e)` | |
| `offerFirst(e)` / `addFirst(e)` | | `push(e)` |
| `pollFirst()` | `poll()` | `pop()` |
| `peekFirst()` | `peek()` | `peek()` |
| `pollLast()`, `peekLast()` | | |

`ArrayDeque`는 배열을 **원형으로** 쓴다. 머리와 꼬리 인덱스를 따로 두고 배열 끝에 닿으면 처음으로 감아서, 앞에서 빼도 나머지를 당길 필요가 없다. 그래서 양 끝 작업이 `LinkedList`처럼 O(1)이면서 노드 객체를 만들지 않는다. 요소마다 24바이트짜리 노드를 만드는 `LinkedList`와 달리 참조 하나에 여유 칸이 조금 붙을 뿐이라 메모리 사용이 몇 배 적다. `null`을 넣을 수 없다는 제약이 있는데, 4.2절에서 `poll()`과 `peek()`가 "비었다"는 뜻으로 `null`을 쓰기 때문이다. `null`을 요소로 허용하면 그 신호가 모호해진다.

### 4.4 PriorityQueue: 넣은 순서가 아니라 우선순위

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(3);
pq.offer(1);
pq.offer(2);
System.out.println(pq);   // [1, 3, 2]. 정렬된 것이 아니다
pq.poll();                // 1
pq.poll();                // 2
pq.poll();                // 3
```

```
PriorityQueue 내부 (힙)
       1
     /   \
    3     2
배열: [1, 3, 2]
```

`PriorityQueue`는 배열로 표현한 **힙**이다. 부모가 자식보다 작다는 규칙만 지키므로 배열 전체가 정렬되어 있지는 않고, 가장 작은 것이 항상 맨 앞에 있다는 것만 보장한다. 그래서 `toString()`은 정렬되지 않은 순서를 찍지만 `poll()`은 항상 가장 작은 것을 준다. 넣고 빼는 비용이 O(log n)이라, 전체를 정렬하지 않고 "다음으로 급한 것"만 계속 꺼내는 작업(작업 스케줄링, 다익스트라 알고리즘)에 맞는다. 순서는 요소의 `Comparable` 또는 생성자에 넘긴 `Comparator`가 정한다(7절).

---

## 5. Iterator: 순회를 표준화하고 변경을 감지한다

### 5.1 왜 Iterator인가

배열은 인덱스로 돌고, 연결 리스트는 `next`를 따라가고, 해시 테이블은 칸을 차례로 훑는다. 구조마다 순회 방법이 다른데 그것을 쓰는 코드가 구조를 알아야 한다면 1절의 약속이 깨진다. `Iterator`는 "다음 것이 있는가, 다음 것을 달라"는 두 질문으로 순회를 표준화한 인터페이스이고, 각 컬렉션이 자기 구조에 맞는 구현을 `iterator()`로 돌려준다.

```java
List<String> list = new ArrayList<>(List.of("A", "B", "C"));

Iterator<String> it = list.iterator();
while (it.hasNext()) {
    String s = it.next();
    System.out.println(s);
}

for (String s : list) {           // 컴파일러가 위 코드로 바꾼다
    System.out.println(s);
}
```

4장에서 본 `for-each`는 이 코드의 줄임이다. `Iterable`을 구현한 모든 것이 `for-each`에 들어갈 수 있고, `Collection`이 `Iterable`의 자손이라 모든 컬렉션이 그렇다. `Map`은 `Iterable`이 아니므로 직접은 안 되고, 1.2절의 뷰를 통해 돈다.

```java
Map<String, Integer> map = new HashMap<>();
map.put("Java", 1);
map.put("Python", 2);

for (String key : map.keySet()) {
    System.out.println(key + "=" + map.get(key));     // 키마다 다시 검색
}
for (Map.Entry<String, Integer> e : map.entrySet()) {
    System.out.println(e.getKey() + "=" + e.getValue());   // 한 번에
}
map.forEach((k, v) -> System.out.println(k + "=" + v));    // Java 8
```

키와 값이 둘 다 필요하면 `entrySet()`이다. `keySet()`으로 돌면서 `get()`을 부르면 키마다 해시 검색을 한 번씩 더 하게 된다.

### 5.2 fail-fast: 4장의 예외가 나는 이유

```
list.iterator()  modCount 5, expected 5
list.remove(x)   modCount 6, expected 5
it.next()        5 != 6 → CME
it.remove()      modCount 6, expected 6
```

`ArrayList`를 비롯한 `java.util`의 컬렉션은 구조가 바뀔 때마다(넣기, 빼기) `modCount`라는 정수를 하나 올린다. `Iterator`는 만들어질 때 그 값을 기억해 두고, `next()`를 부를 때마다 지금 값과 비교한다. 다르면 누군가 순회 도중에 컬렉션을 바꿨다는 뜻이므로 `ConcurrentModificationException`을 던진다. 이것이 4장에서 `for-each` 안의 `remove()`가 예외를 내던 이유다. `Iterator`가 위치를 기억하는 기준이 흔들렸는데 계속 돌면 요소를 건너뛰거나 두 번 읽을 수 있으니, 잘못된 결과를 내느니 빨리 실패(fail-fast)하는 쪽을 택했다.

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));

for (String s : list) {
    if (s.equals("a")) list.remove(s);   // ConcurrentModificationException
}

for (String s : list) {
    if (s.equals("b")) list.remove(s);   // 예외가 없다. 결과 [a, c]
}

for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
    if (it.next().equals("b")) it.remove();   // 올바른 방법
}
list.removeIf(s -> s.equals("c"));            // Java 8. 더 짧다
```

두 번째 반복문이 예외 없이 끝나는 것이 오히려 위험하다. 뒤에서 두 번째 요소를 지우면 개수가 하나 줄어 `hasNext()`가 곧바로 `false`가 되고, 마지막 요소는 검사도 받지 않은 채 반복이 끝난다. 예외가 나는지 안 나는지가 지우는 위치에 따라 달라지므로, 규칙은 "반복 중 변경은 `Iterator.remove()`나 `removeIf()`로"다. `it.remove()`는 컬렉션을 바꾼 뒤 자기가 기억한 값도 같이 맞추므로 안전하다. 참고로 이 검사는 최선의 노력일 뿐 보장이 아니다. 여러 스레드가 동시에 바꾸는 경우까지 막으려면 [Chapter 13](../13-thread)의 동기화나 `java.util.concurrent`의 컬렉션이 필요하다.

### 5.3 ListIterator

`List`에서만 얻을 수 있는 `ListIterator`는 양방향으로 움직이고, 지금 위치에서 바꾸거나 끼워 넣을 수 있다.

```java
ListIterator<String> li = list.listIterator();
while (li.hasNext()) {
    String s = li.next();
    if (s.equals("B")) {
        li.set("b");       // 방금 읽은 것을 교체
        li.add("B2");      // 그 뒤에 끼워 넣기
    }
}
while (li.hasPrevious()) {
    System.out.print(li.previous());   // 역방향
}
```

3.2절에서 미뤄 둔 `LinkedList`의 유일한 강점이 여기 있다. 순회하면서 그 자리에 넣고 빼면 위치를 다시 찾을 필요가 없어 진짜 O(1)이다. 10만 개짜리 리스트를 돌면서 요소마다 하나씩 끼워 넣는 데 몇 밀리초면 된다.

---

## 6. Arrays와 Collections: 도구 상자

### 6.1 배열과 컬렉션 사이

`Arrays`의 정렬, 검색, 비교, 채우기는 5장에서 봤다. 이 장에서 볼 것은 배열과 컬렉션을 오가는 방법인데, 비슷해 보이는 넷이 서로 다르다.

```java
Integer[] arr = {1, 2, 3};

List<Integer> view = Arrays.asList(arr);      // 배열을 감싼 뷰
view.set(0, 10);        // arr[0]도 10이 된다
view.add(4);            // UnsupportedOperationException. 크기 고정

List<Integer> imm = List.of(1, 2, 3);         // Java 9. 불변
imm.set(0, 10);         // UnsupportedOperationException
imm.contains(null);     // NullPointerException. null 자체를 거부

List<Integer> copy = new ArrayList<>(Arrays.asList(arr));   // 독립된 복사본
List<Integer> copy2 = List.copyOf(view);                    // Java 10. 불변 복사본
```

| 만드는 방법 | 원본과의 관계 | 크기 변경 | 요소 변경 | `null` |
|:------------|:-------------|:---------|:---------|:-------|
| `Arrays.asList(arr)` | 배열의 뷰 | 불가 | 가능. 배열에 반영 | 허용 |
| `List.of(...)` | 새 객체 | 불가 | 불가 | 거부 |
| `List.copyOf(c)` | 복사본 | 불가 | 불가 | 거부 |
| `new ArrayList<>(c)` | 복사본 | 가능 | 가능 | 허용 |
| `Collections.unmodifiableList(l)` | `l`의 읽기 전용 뷰 | 불가 | 불가. `l`이 바뀌면 같이 보인다 | `l`을 따른다 |

`Arrays.asList()`가 뷰인 이유는 복사 비용 없이 배열을 `List`가 필요한 자리에 넘기려는 것이고, 5장에서 본 대로 `int[]`를 넘기면 요소가 하나인 `List<int[]>`가 되는 함정이 있다. `List.of()`가 `null`을 거부하는 것은 설계 결정이다. 불변 컬렉션에 `null`이 들어갈 수 있으면 `contains(null)` 같은 검사가 늘 필요해지므로 처음부터 막았다. `Collections.unmodifiableList()`는 복사가 아니라 뷰라서, 원본을 들고 있는 쪽이 바꾸면 읽기 전용이라던 리스트의 내용이 바뀐다. 진짜 불변이 필요하면 `List.copyOf()`다.

### 6.2 Collections 유틸리티

`Collections`는 `Arrays`의 컬렉션판이다. 전부 `static`이고 인스턴스가 없다(9장 `Math`와 같은 이유).

```java
List<Integer> list = new ArrayList<>(List.of(3, 1, 4, 1, 5));

Collections.sort(list);                     // [1, 1, 3, 4, 5]
Collections.sort(list, Collections.reverseOrder());
Collections.shuffle(list);
Collections.reverse(list);
Collections.max(list);
Collections.min(list);
Collections.frequency(list, 1);             // 2
Collections.binarySearch(list, 4);          // 정렬된 상태에서만
```

`Collections.sort(list)`는 안에서 `list.sort(null)`을 부르고, `ArrayList`는 자기 배열을 `Arrays.sort()`에 넘긴다. 5장에서 객체 배열의 정렬이 안정 정렬(팀 정렬)이라고 했는데, 리스트 정렬도 결국 같은 코드라 안정적이다. 그 의미는 7절에서 본다.

동기화 래퍼와 타입 검사 래퍼도 여기 있다.

```java
List<String> sync = Collections.synchronizedList(new ArrayList<>());
Map<String, Integer> syncMap = Collections.synchronizedMap(new HashMap<>());

List<String> checked = Collections.checkedList(new ArrayList<>(), String.class);
```

`synchronizedList()`는 모든 메서드를 `synchronized`로 감싼 뷰를 돌려준다. `Vector`와 같은 방식이라 같은 한계가 있다. 메서드 하나하나는 안전하지만 "있는지 확인하고 넣기"처럼 두 메서드를 잇는 순간 틈이 생기고, 순회할 때는 문서에 적힌 대로 직접 `synchronized` 블록으로 감싸야 한다. 13장과 동시성 시리즈의 [구성 단위](../../concurrency/05-building-blocks)에서 보듯 실무에서는 `ConcurrentHashMap`, `CopyOnWriteArrayList` 같은 병렬 컬렉션을 쓴다. `checkedList()`는 [Chapter 12](../12-generics-enum-annotation)의 지네릭스가 실행 시점에 지워진다는 사실 때문에 있다. 원시 타입(raw type)으로 받은 `List`에 `Integer`를 넣으면 컴파일도 실행도 통과하고, 나중에 `String`으로 꺼내는 자리에서야 `ClassCastException`이 난다. `checkedList()`는 넣는 순간 검사해서 문제를 발생한 자리에서 잡는다.

---

## 7. Comparable과 Comparator: 순서는 누가 정하는가

### 7.1 두 인터페이스

정렬하려면 두 요소 중 무엇이 앞인지 정할 수 있어야 한다. 그 기준을 두는 자리가 둘이다.

| | `Comparable<T>` | `Comparator<T>` |
|:--|:----------------|:----------------|
| 패키지 | `java.lang` | `java.util` |
| 메서드 | `int compareTo(T other)` | `int compare(T a, T b)` |
| 누가 정하나 | 타입 자신. **기본 순서** | 바깥. **그때그때의 순서** |
| 예 | `String`, `Integer`, `LocalDate`의 사전순, 크기순, 시간순 | 이름순, 점수 역순 |

`String`, 래퍼 클래스, 10장의 `LocalDate`는 전부 `Comparable`이라 `Collections.sort()`와 `TreeSet`에 그냥 넣을 수 있다. 직접 만든 클래스는 둘 중 하나를 골라야 한다. 그 클래스에 자연스러운 순서가 하나 있으면 `Comparable`을 구현하고, 상황마다 다른 순서가 필요하거나 클래스를 고칠 수 없으면 `Comparator`를 밖에서 만든다.

```java
public class Student implements Comparable<Student> {
    String name;
    int score;

    public Student(String name, int score) {
        this.name = name;
        this.score = score;
    }

    @Override
    public int compareTo(Student other) {
        return Integer.compare(this.score, other.score);   // 점수 오름차순
    }
}

List<Student> students = new ArrayList<>(List.of(
    new Student("Kim", 85), new Student("Lee", 92), new Student("Park", 78)));
Collections.sort(students);                       // 78, 85, 92
```

반환값의 약속은 음수면 `this`가 앞, 0이면 같은 순위, 양수면 뒤다. 그래서 `this.score - other.score`로 쓰는 코드를 자주 보는데, 함정이 있다. 두 값의 차이가 `int` 범위를 넘으면 부호가 뒤집힌다. 3장에서 본 오버플로우인데, `Integer.MIN_VALUE - 1`은 양수다. 점수처럼 범위가 좁으면 문제없지만 습관이 되면 언젠가 틀리므로 `Integer.compare()`를 쓴다.

### 7.2 Comparator 만들기

```java
Comparator<Student> byName = (a, b) -> a.name.compareTo(b.name);
Comparator<Student> byScoreDesc = (a, b) -> Integer.compare(b.score, a.score);

students.sort(byName);
students.sort(byScoreDesc);

students.sort(Comparator.comparingInt((Student s) -> s.score)
                        .reversed()
                        .thenComparing(s -> s.name));     // 점수 역순, 같으면 이름순
```

`Comparator`는 메서드가 하나인 함수형 인터페이스라 14장의 람다로 만든다. Java 8이 더한 `comparing()`, `thenComparing()`, `reversed()`를 이으면 "무엇으로, 같으면 무엇으로"를 읽히는 대로 쓸 수 있다.

6.2절에서 미뤄 둔 안정 정렬의 의미가 `thenComparing`이 없던 시절의 이야기다. 점수로 먼저 정렬한 뒤 이름으로 다시 정렬하면, 안정 정렬은 이름이 같은 사람들의 점수 순서를 유지하지만 불안정 정렬은 뒤섞는다. 자바가 객체 정렬에 팀 정렬을 고른 이유이고, 기본형 배열에는 "같은 값의 원래 순서"라는 개념이 없어 더 빠른 퀵 정렬 계열을 쓴다.

### 7.3 문자열의 순서

```java
String[] arr = {"cat", "Dog", "lion", "tiger"};

Arrays.sort(arr);                                  // [Dog, cat, lion, tiger]
Arrays.sort(arr, String.CASE_INSENSITIVE_ORDER);   // [cat, Dog, lion, tiger]
Arrays.sort(arr, Collections.reverseOrder());      // [tiger, lion, cat, Dog]
```

`Dog`가 `cat`보다 앞에 오는 것은 `String.compareTo()`가 문자를 유니코드 값으로 비교하기 때문이다. 2장에서 본 대로 대문자(`D`는 68)가 소문자(`c`는 99)보다 작다. 사람이 기대하는 사전순은 `CASE_INSENSITIVE_ORDER`이고, 언어별 규칙까지 따르려면 `Collator`를 쓴다.

### 7.4 같음과 순서가 어긋날 때

`Comparable`의 문서는 `compareTo()`가 0인 두 객체는 `equals()`도 참이기를 권한다. 어기면 어떻게 되는지 `BigDecimal`이 보여 준다.

```java
BigDecimal a = new BigDecimal("1.0"), b = new BigDecimal("1.00");
a.equals(b);       // false. 소수 자릿수까지 비교
a.compareTo(b);    // 0. 수치는 같다

new HashSet<>(List.of(a, b)).size();   // 2. equals 기준
new TreeSet<>(List.of(a, b)).size();   // 1. compareTo 기준
```

`HashSet`은 9장의 `equals()`와 `hashCode()`로 같음을 판단하고, `TreeSet`은 `compareTo()`가 0이면 같다고 본다. 둘이 어긋나면 어느 `Set`에 넣느냐에 따라 개수가 달라진다. `TreeSet`에 대소문자를 무시하는 `Comparator`를 주면 `"Java"`와 `"JAVA"`가 하나로 합쳐지는 것도 같은 이유다. 이 장의 셋째 원리다. **같음은 `equals`와 `hashCode`가, 순서는 `compareTo`와 `compare`가 정하며, 자료구조는 둘 중 하나만 믿는다.**

---

## 8. HashSet과 HashMap: 같음을 칸 번호로 바꾸다

### 8.1 해싱의 원리

`ArrayList.contains()`는 앞에서부터 `equals()`로 하나씩 비교한다. 요소가 10만 개면 최악의 경우 10만 번이다. 해시 테이블은 이 검색을 **계산**으로 바꾼다. 객체의 `hashCode()`로 정수를 얻고, 그 정수로 배열의 칸 번호를 정해 거기에 넣는다. 찾을 때도 같은 계산으로 칸을 정하니 그 칸만 보면 된다.

```
Integer 17.hashCode() = 17
17 & (16 - 1) = 1        ← 칸 번호

table (n = 16)
[0]  null
[1]  [1] → [17]      같은 칸 (충돌)
[2]  null
[3]  [3]
[5]  [5]
[9]  [9]
```

JDK의 `HashMap`은 길이가 2의 거듭제곱인 배열을 쓰고, 칸 번호는 해시코드에 `길이 - 1`을 비트 AND해서 얻는다. 나눗셈보다 빠르고, 길이가 16이면 아래 4비트만 남는다. 그런데 아래 4비트만 쓰면 해시코드의 윗부분이 아무리 좋아도 버려지므로, 그 전에 `h ^ (h >>> 16)`으로 윗비트를 아래로 섞어 넣는다. 서로 다른 키가 같은 칸에 오는 것이 **충돌**이고, 정수는 유한하니 피할 수 없다(9장). 충돌한 항목은 그 칸에 연결 리스트로 매달리고, 찾을 때는 그 리스트를 따라가며 `equals()`로 확인한다. 이것이 9장에서 미뤄 둔 규칙의 정체다. `equals()`가 참인데 `hashCode()`가 다르면 다른 칸에 들어가 서로를 영영 못 찾는다.

```java
class Person {
    String name;
    int age;

    @Override
    public boolean equals(Object o) {
        return o instanceof Person p
            && name.equals(p.name) && age == p.age;
    }
    @Override
    public int hashCode() {
        return Objects.hash(name, age);     // 같은 필드로
    }
}

Set<Person> set = new HashSet<>();
set.add(new Person("Kim", 25));
set.add(new Person("Kim", 25));   // false. 같은 칸에서 equals()가 참
set.size();                       // 1
```

`hashCode()`만 재정의하지 않으면 두 `Person`은 `Object`의 기본 해시코드(9장에서 본 난수)로 다른 칸에 들어가 `size()`가 2가 된다. 반대로 키로 쓴 객체의 내용을 **넣은 뒤에 바꾸면** 해시코드가 달라져 찾을 수 없게 된다. 9장에서 `StringBuilder`가 `equals()`를 재정의하지 않은 이유이자, `Map`의 키와 `Set`의 요소는 불변이어야 한다는 규칙의 이유다.

### 8.2 용량, 적재율, 트리화

칸이 16개인데 항목이 1만 개면 칸마다 600개씩 매달려 검색이 다시 O(n)이 된다. 그래서 `HashMap`은 항목 수가 `용량 × 0.75`를 넘으면 배열을 두 배로 늘리고 전부 다시 배치한다. 기본 용량 16에서는 13번째 항목을 넣을 때 32가 된다. 0.75라는 적재율은 공간과 충돌 확률의 절충점이고, 항목 수를 미리 알면 `new HashMap<>(예상 개수 / 0.75 + 1)`로 재배치를 피할 수 있다. `new HashMap<>(100)`은 100 이상의 2의 거듭제곱인 128을 잡는다.

Java 8은 방어선을 하나 더 두었다. 한 칸의 리스트가 8개를 넘으면(배열이 64 이상일 때) 그 칸을 레드-블랙 트리로 바꿔 최악의 경우도 O(log n)으로 막는다. 해시코드가 전부 같은 키를 일부러 보내 서버를 느리게 만드는 공격이 있었기 때문이다. 6개 이하로 줄면 다시 리스트로 돌아간다.

### 8.3 HashSet은 HashMap이다

```java
public class HashSet<E> {
    private HashMap<E, Object> map;
    private static final Object PRESENT = new Object();

    public boolean add(E e) {
        return map.put(e, PRESENT) == null;   // 새 키였으면 true
    }
}
```

JDK의 `HashSet`은 실제로 이렇게 생겼다. 요소를 키로 넣고 값에는 의미 없는 상수를 채운다. 그래서 `HashSet`의 성질은 전부 `HashMap`의 성질이다. 중복을 거르는 기준은 `equals()`와 `hashCode()`이고, 순서는 칸 번호 순이라 넣은 순서와 무관하다.

```java
Set<Integer> nums = new HashSet<>(List.of(5, 3, 9, 1, 17));
System.out.println(nums);          // [1, 17, 3, 5, 9]

Set<String> langs = new HashSet<>(List.of("Java", "Python", "C++"));
System.out.println(langs);         // [Java, C++, Python]. 실행 환경에 따라 다를 수 있다
```

정수를 담은 `HashSet`이 정렬된 것처럼 보이는 것은 착시다. `Integer.hashCode()`가 값 자체라 작은 수는 칸 번호가 곧 값이고, 17은 `17 & 15 = 1`이라 1의 칸에 뒤이어 매달린다. 배열이 커지면 순서가 또 바뀐다. 넣은 순서가 필요하면 `LinkedHashSet`, 정렬이 필요하면 `TreeSet`이다. 집합 연산은 `Collection`의 메서드 셋으로 한다.

```java
Set<Integer> a = new HashSet<>(List.of(1, 2, 3, 4));
Set<Integer> b = new HashSet<>(List.of(3, 4, 5, 6));

Set<Integer> union = new HashSet<>(a);  union.addAll(b);        // [1, 2, 3, 4, 5, 6]
Set<Integer> inter = new HashSet<>(a);  inter.retainAll(b);     // [3, 4]
Set<Integer> diff  = new HashSet<>(a);  diff.removeAll(b);      // [1, 2]
```

### 8.4 HashMap 사용

```java
Map<String, Integer> map = new HashMap<>();
map.put("Java", 1);            // null. 이전 값이 없었다
map.put("Java", 10);           // 1. 덮어쓰고 이전 값을 돌려준다
map.get("Java");               // 10
map.get("C++");                // null
map.getOrDefault("C++", 0);    // 0
map.containsKey("Java");       // true
map.remove("Java");

Map<String, Integer> count = new HashMap<>();
for (String w : "a b a c b a".split(" ")) {
    count.merge(w, 1, Integer::sum);          // {a=3, b=2, c=1}
}
Map<String, List<Integer>> groups = new HashMap<>();
groups.computeIfAbsent("even", k -> new ArrayList<>()).add(2);
```

`merge()`와 `computeIfAbsent()`는 "있으면 갱신, 없으면 만들기"를 한 번의 해시 검색으로 끝낸다. Java 8 이전에는 `get()`으로 확인하고 `put()`으로 넣는 두 번의 검색이 필요했고, 그 사이에 다른 스레드가 끼어들 틈도 있었다.

`null`에 대한 태도가 클래스마다 다르다. `HashMap`은 `null` 키 하나와 `null` 값을 허용하고, 1.0의 `Hashtable`은 둘 다 `NullPointerException`이며, Java 9의 `Map.of()`도 거부한다. `get()`이 `null`을 돌려줄 때 "키가 없다"인지 "값이 `null`이다"인지 구분할 수 없다는 것이 `null` 값의 대가이고, 그래서 `containsKey()`가 따로 있다.

### 8.5 LinkedHashMap: 순서를 기억하는 해시

`LinkedHashMap`은 `HashMap`의 각 항목을 연결 리스트로 한 번 더 꿰어 넣은 순서를 기억한다. 검색은 여전히 O(1)이고 순회만 넣은 순서다. 생성자에 `accessOrder`를 `true`로 주면 최근에 접근한 순서로 바뀌는데, 여기에 `removeEldestEntry()`를 재정의하면 몇 줄로 LRU 캐시가 된다.

```java
Map<String, Integer> lru = new LinkedHashMap<>(16, 0.75f, true) {
    protected boolean removeEldestEntry(Map.Entry<String, Integer> e) {
        return size() > 3;
    }
};
lru.put("a", 1); lru.put("b", 2); lru.put("c", 3);
lru.get("a");                  // a를 최근으로
lru.put("d", 4);               // 가장 오래된 b가 밀려난다
lru.keySet();                  // [c, a, d]
```

---

## 9. TreeSet과 TreeMap: 순서를 유지하는 트리

### 9.1 이진 검색 트리

```
        7
      /   \
    3       9
   / \     / \
  1   5   8   11

왼쪽 < 부모 < 오른쪽
중위 순회: 1 3 5 7 8 9 11
```

해시 테이블은 빠르지만 순서가 없다. "30 이상인 것", "가장 작은 것", "정렬된 순서로 전부"를 물으면 전체를 뒤져야 한다. 트리는 이 질문에 답하려고 순서를 구조에 넣은 것이다. 각 노드의 왼쪽 자식은 작고 오른쪽 자식은 크다는 규칙만 지키면, 검색은 루트에서 시작해 매번 절반을 버리는 이진 검색이 되고(5장), 왼쪽부터 순회하면 정렬된 순서가 나온다.

한쪽으로만 자라면 연결 리스트가 되어 버리므로 `TreeMap`은 **레드-블랙 트리**로 균형을 유지한다. 넣고 뺄 때마다 회전으로 높이를 log n 안에 묶어 두는 자기 균형 트리이고, 그래서 검색, 삽입, 삭제가 전부 O(log n)이다. `TreeSet`이 `TreeMap`을 쓰는 관계는 `HashSet`과 `HashMap`의 관계와 같다.

### 9.2 순서가 있어야 들어간다

```java
TreeSet<Integer> set = new TreeSet<>(List.of(10, 30, 50, 20, 40));
System.out.println(set);      // [10, 20, 30, 40, 50]

set.first();                  // 10
set.last();                   // 50
set.headSet(30);              // [10, 20]. 30 미만
set.tailSet(30);              // [30, 40, 50]. 30 이상
set.subSet(20, 40);           // [20, 30]. 20 이상 40 미만
set.ceiling(25);              // 30. 25 이상 중 가장 가까운
set.floor(25);                // 20. 25 이하 중 가장 가까운

new TreeSet<>().add(new Object());   // ClassCastException. Comparable이 아니다
new TreeSet<String>().add(null);     // NullPointerException. 비교할 수 없다
```

트리는 넣는 순간 비교해야 하므로 요소가 `Comparable`이거나 생성자에 `Comparator`를 줘야 하고, `null`은 비교할 수 없어 거부한다. 같음의 기준이 `compareTo()`라는 점은 7.4절에서 봤다. 범위 검색 메서드의 경계는 시작은 포함, 끝은 제외가 기본이고, `headSet(30, true)`처럼 포함 여부를 지정하는 오버로딩이 있다.

`TreeMap`도 같은 메서드를 키에 대해 제공한다. `firstKey()`, `headMap()`, `ceilingKey()`, `floorEntry()`처럼 이름이 조금 다를 뿐이다.

### 9.3 해시와 트리 고르기

| | `HashMap` / `HashSet` | `TreeMap` / `TreeSet` |
|:--|:----------------------|:----------------------|
| 검색, 삽입, 삭제 | O(1) | O(log n) |
| 순서 | 없음 | 정렬 순서 |
| 범위 검색, 최소·최대 | 불가 | `headSet`, `first` 등 |
| 같음의 기준 | `equals` + `hashCode` | `compareTo` / `compare` |
| 요구 사항 | `hashCode` 재정의 | `Comparable` 또는 `Comparator` |

필자의 PC에서 백만 개를 넣고 백만 번 검색하면 `HashMap`이 약 0.2초, `TreeMap`이 약 1초였다. 다섯 배 차이이므로 순서가 필요 없으면 해시이고, 정렬이나 범위 검색이 필요할 때만 트리다. "정렬된 결과가 한 번 필요할 뿐"이라면 `HashMap`에 넣고 마지막에 한 번 정렬하는 편이 매번 트리를 유지하는 것보다 싸다.

---

## 10. Properties

`Properties`는 키와 값이 모두 `String`인 `Map`으로, 설정 파일을 읽고 쓰는 용도다. 1.0의 `Hashtable<Object, Object>`를 상속했지만 `getProperty()`와 `setProperty()`만 쓰는 것이 관례다. `put()`으로 `String`이 아닌 것을 넣을 수 있는 것은 1.0 설계의 흔적이다.

```java
Properties prop = new Properties();
prop.load(new FileInputStream("config.properties"));   // 15장의 스트림
String host = prop.getProperty("db.host");
String port = prop.getProperty("db.port", "3306");     // 없으면 기본값

prop.setProperty("db.host", "localhost");
prop.store(new FileOutputStream("config.properties"), "DB 설정");

System.getProperty("java.version");   // "25.0.2"
System.getProperty("os.name");        // "Windows 11"
```

`load(InputStream)`은 파일을 ISO 8859-1로 읽는다. 한글을 직접 적으면 깨지므로 `load(Reader)`에 UTF-8 `Reader`를 넘기거나([Chapter 15](../15-io)) 유니코드 이스케이프로 적어야 한다. 시스템 속성 `System.getProperties()`도 같은 클래스이며, JVM 버전과 운영체제, `-D` 옵션으로 넘긴 값이 여기 들어 있다.

---

## 11. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 프레임웍 | 인터페이스로 약속, 구현은 교체 가능 | 1.0의 클래스들은 서로 무관해 구조를 바꾸면 코드를 다 고쳤다 |
| 네 가지 구조 | 배열, 연결 리스트, 해시, 트리 | 클래스의 장단점은 물리 구조에서 나온다 |
| `ArrayList` | 1.5배로 교체되는 배열 | 배열 길이는 못 바꾸니 새로 만들어 복사한다 |
| 중간 삽입 | 뒤를 밀어야 한다 | 연속된 칸이라 빈자리를 만들어야 한다 |
| `LinkedList` | 참조로 이은 노드 | 위치까지 걷는 비용이 커서 실측은 `ArrayList`가 대부분 빠르다 |
| `Stack` | `ArrayDeque`로 대체 | `Vector`를 상속해 동기화 비용과 열린 인덱스 접근을 물려받았다 |
| `Queue` 메서드 두 벌 | 예외 / 특별한 값 | 큐가 비는 것은 흔한 상태라 호출자가 고르게 했다 |
| `ArrayDeque` | 원형 배열, `null` 금지 | `poll()`의 `null`이 "비었다"는 신호다 |
| `PriorityQueue` | 힙. 전체 정렬이 아니다 | 가장 급한 것만 O(log n)에 꺼내면 된다 |
| `Iterator` | 순회의 표준화 | 구조마다 다른 순회 방법을 쓰는 코드에서 숨긴다 |
| fail-fast | `modCount` 비교 | 순회 기준이 흔들리면 건너뛰거나 두 번 읽으니 빨리 실패한다 |
| `Arrays.asList` | 배열의 뷰 | 복사 없이 넘기려는 것. 크기 변경 불가 |
| `List.of` | 불변, `null` 거부 | 불변 컬렉션에 `null` 검사를 늘 붙이지 않으려고 |
| `Comparable` / `Comparator` | 기본 순서 / 그때의 순서 | 순서의 주인이 타입인지 호출자인지 |
| 뺄셈 비교 | `Integer.compare` | 차이가 `int`를 넘으면 부호가 뒤집힌다 |
| 안정 정렬 | 객체는 팀 정렬 | 같은 키의 원래 순서가 의미를 가진다 |
| 해싱 | `hashCode` → 칸 → `equals` | 검색을 계산으로 바꾼다. 둘을 같이 재정의하는 이유 |
| 적재율 0.75 | 넘으면 두 배로 재배치 | 칸당 항목이 늘면 다시 O(n)이 된다 |
| 트리화 | 한 칸 8개 초과 시 트리 | 해시 충돌 공격에 대한 방어 |
| `HashSet` | 값이 상수인 `HashMap` | 성질이 전부 `HashMap`의 것이다 |
| 키는 불변 | 넣은 뒤 바꾸면 못 찾는다 | 해시코드가 달라져 다른 칸을 본다 |
| `TreeSet` / `TreeMap` | 레드-블랙 트리, O(log n) | 순서와 범위 검색을 구조에 넣었다 |
| 같음의 기준 | 해시는 `equals`, 트리는 `compareTo` | 어긋나면 `Set`에 따라 개수가 달라진다 |
| `Properties` | `String` 전용 `Hashtable` | 설정 파일. `load(InputStream)`은 ISO 8859-1 |

| 필요한 것 | 선택 |
|:----------|:-----|
| 순서 있는 목록. 인덱스 접근 | `ArrayList` |
| 양 끝에서 넣고 빼기. 스택, 큐 | `ArrayDeque` |
| 우선순위대로 꺼내기 | `PriorityQueue` |
| 중복 제거 | `HashSet`. 넣은 순서면 `LinkedHashSet`, 정렬이면 `TreeSet` |
| 키로 값 찾기 | `HashMap`. 넣은 순서면 `LinkedHashMap`, 정렬·범위면 `TreeMap` |
| 순회하며 그 자리에 넣고 빼기 | `LinkedList` + `ListIterator` |
| 여러 스레드가 함께 쓰기 | `ConcurrentHashMap` 등 `java.util.concurrent`(13장) |

```
Iterable
  └── Collection
        ├── List
        │     ├── ArrayList
        │     ├── LinkedList ──┐
        │     └── Vector       │
        │           └── Stack  │
        ├── Set                │
        │     ├── HashSet      │
        │     │    └── LinkedHashSet
        │     └── TreeSet      │
        └── Queue ◀────────────┘
              ├── PriorityQueue
              └── Deque
                    ├── ArrayDeque
                    └── (LinkedList)

Map
  ├── HashMap
  │     └── LinkedHashMap
  ├── TreeMap
  └── Hashtable
        └── Properties
```
