---
title: "Chapter 11. 컬렉션 프레임웍 (Collections Framework)"
weight: 11
---

# 컬렉션 프레임웍 (Collections Framework)

컬렉션 프레임웍(Collections Framework)은 **데이터 군(群)을 저장하는 클래스들을 표준화한 설계**를 의미한다.

- **컬렉션(Collection)**: 다수의 데이터, 데이터 그룹
- **프레임웍(Framework)**: 표준화된 프로그래밍 방식

JDK 1.2 이전에는 `Vector`, `Hashtable`, `Properties` 등을 각자 다른 방식으로 처리해야 했지만, JDK 1.2부터 컬렉션 프레임웍이 도입되면서 **표준화된 방식**으로 다룰 수 있게 되었다.

---

## 1. 컬렉션 프레임웍의 핵심 인터페이스

컬렉션 프레임웍은 데이터 그룹을 **3가지 타입**으로 분류한다.

```
                    Iterable
                       │
                  Collection
                   ┌───┴───┐
                 List     Set

                  Map (별도 계층)
```

### 핵심 인터페이스 비교

| 인터페이스 | 특징 | 순서 유지 | 중복 허용 | 구현 클래스 |
|-----------|------|:--------:|:--------:|------------|
| **List** | 순서가 있는 데이터 집합 | O | O | ArrayList, LinkedList, Vector, Stack |
| **Set** | 순서가 없는 데이터 집합 | X | X | HashSet, TreeSet, LinkedHashSet |
| **Map** | 키-값 쌍으로 저장 | X | Key: X, Value: O | HashMap, TreeMap, Hashtable, Properties |

{{< callout type="info" >}}
**Map 인터페이스**의 `keySet()`은 **Set**을 반환하고 (키는 중복 불가), `values()`는 **Collection**을 반환한다 (값은 중복 가능).
{{< /callout >}}

---

## 2. Collection 인터페이스

Collection 인터페이스는 List와 Set의 공통 조상으로, 컬렉션을 다루는 **기본적인 메서드**를 정의한다.

### 주요 메서드

| 메서드 | 설명 |
|-------|------|
| `boolean add(Object o)` | 객체 추가 |
| `boolean addAll(Collection c)` | 컬렉션의 모든 객체 추가 |
| `void clear()` | 모든 객체 삭제 |
| `boolean contains(Object o)` | 객체 포함 여부 확인 |
| `boolean containsAll(Collection c)` | 컬렉션의 모든 객체 포함 여부 |
| `boolean isEmpty()` | 비어있는지 확인 |
| `Iterator iterator()` | Iterator 반환 |
| `boolean remove(Object o)` | 지정 객체 삭제 |
| `boolean removeAll(Collection c)` | 컬렉션에 포함된 객체들 삭제 |
| `boolean retainAll(Collection c)` | 컬렉션에 포함된 객체만 남김 |
| `int size()` | 저장된 객체 수 반환 |
| `Object[] toArray()` | 객체 배열로 반환 |

---

## 3. List 인터페이스

**순서를 유지**하고 **중복을 허용**하는 컬렉션.

### List 구현 클래스 계층도

```
         List
           │
    ┌──────┼──────┐
    │      │      │
ArrayList Vector LinkedList
           │
         Stack
```

### List 인터페이스 추가 메서드

| 메서드 | 설명 |
|-------|------|
| `void add(int index, Object element)` | 지정 위치에 객체 저장 |
| `Object get(int index)` | 지정 위치의 객체 반환 |
| `int indexOf(Object o)` | 객체 위치 반환 (앞에서부터) |
| `int lastIndexOf(Object o)` | 객체 위치 반환 (뒤에서부터) |
| `Object set(int index, Object element)` | 지정 위치의 객체 변경 |
| `List subList(int from, int to)` | 일부를 List로 반환 |
| `ListIterator listIterator()` | ListIterator 반환 |

---

## 4. ArrayList

**배열 기반**의 List 구현체로, 가장 많이 사용되는 컬렉션 클래스이다.

### 특징

- **Object 배열**을 이용하여 데이터를 순차적으로 저장
- 배열이 가득 차면 **더 큰 새 배열을 생성**하여 복사
- **Vector**를 개선한 클래스 (동기화 제거)

### ArrayList 생성자와 주요 메서드

```java
// 생성자
ArrayList()                          // 기본 크기 10
ArrayList(int initialCapacity)       // 지정된 초기 용량
ArrayList(Collection c)              // 컬렉션으로 초기화

// 주요 메서드
list.add(element)                    // 마지막에 추가
list.add(index, element)             // 지정 위치에 추가
list.get(index)                      // 요소 조회
list.set(index, element)             // 요소 변경
list.remove(index)                   // 인덱스로 삭제
list.remove(object)                  // 객체로 삭제
list.size()                          // 크기 반환
list.contains(object)                // 포함 여부
list.indexOf(object)                 // 위치 검색
list.clear()                         // 전체 삭제
list.isEmpty()                       // 비어있는지 확인
list.toArray()                       // 배열로 변환
```

### ArrayList 기본 사용 예제

```java
import java.util.*;

public class ArrayListExample {
    public static void main(String[] args) {
        // ArrayList 생성
        ArrayList<String> list = new ArrayList<>();

        // 요소 추가
        list.add("Java");
        list.add("Python");
        list.add("JavaScript");
        list.add(1, "C++");  // 인덱스 1에 삽입

        System.out.println("List: " + list);
        // 출력: List: [Java, C++, Python, JavaScript]

        // 요소 접근
        String first = list.get(0);
        System.out.println("First: " + first);  // Java

        // 요소 변경
        list.set(2, "Kotlin");
        System.out.println("After set: " + list);
        // 출력: After set: [Java, C++, Kotlin, JavaScript]

        // 요소 삭제
        list.remove("C++");
        list.remove(0);  // 인덱스로 삭제
        System.out.println("After remove: " + list);
        // 출력: After remove: [Kotlin, JavaScript]

        // 크기와 포함 여부
        System.out.println("Size: " + list.size());        // 2
        System.out.println("Contains Java: " + list.contains("Java"));  // false
    }
}
```

### 용량(capacity)과 크기(size)

```java
import java.util.*;

public class CapacityExample {
    public static void main(String[] args) {
        // Vector로 용량 확인 (ArrayList는 capacity() 메서드 없음)
        Vector<String> v = new Vector<>(5);
        v.add("1");
        v.add("2");
        v.add("3");

        System.out.println("Size: " + v.size());         // 3
        System.out.println("Capacity: " + v.capacity()); // 5

        // 빈 공간 제거
        v.trimToSize();
        System.out.println("After trimToSize - Capacity: " + v.capacity()); // 3

        // 최소 용량 확보
        v.ensureCapacity(10);
        System.out.println("After ensureCapacity(10) - Capacity: " + v.capacity()); // 10

        // 크기 설정 (용량 자동 증가)
        v.setSize(15);
        System.out.println("After setSize(15) - Size: " + v.size());        // 15
        System.out.println("After setSize(15) - Capacity: " + v.capacity()); // 20 (2배 증가)
    }
}
```

{{< callout type="warning" >}}
**성능 팁**: ArrayList 생성 시 저장할 요소 개수를 예상하여 **충분한 초기 용량**을 지정하면 배열 복사 비용을 줄일 수 있다.
{{< /callout >}}

### 삭제 시 주의사항

```java
// 잘못된 방법 - 인덱스 변화로 일부 요소 건너뜀
for (int i = 0; i < list.size(); i++) {
    if (condition) {
        list.remove(i);  // 삭제 후 뒤 요소들이 앞으로 이동
    }
}

// 올바른 방법 1 - 뒤에서부터 삭제
for (int i = list.size() - 1; i >= 0; i--) {
    if (condition) {
        list.remove(i);
    }
}

// 올바른 방법 2 - Iterator 사용
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (condition) {
        it.remove();
    }
}

// 올바른 방법 3 - removeIf (Java 8+)
list.removeIf(element -> condition);
```

---

## 5. LinkedList

**연결 리스트** 기반의 List 구현체이다.

### 연결 리스트의 종류

```
1. 단방향 연결 리스트 (Singly Linked List)
   ┌───┬───┐   ┌───┬───┐   ┌───┬───┐
   │ A │ ──┼──>│ B │ ──┼──>│ C │null│
   └───┴───┘   └───┴───┘   └───┴───┘

2. 양방향 연결 리스트 (Doubly Linked List) - Java의 LinkedList
   ┌───┬───┬───┐   ┌───┬───┬───┐   ┌───┬───┬───┐
   │nul│ A │ ──┼──>│<──│ B │ ──┼──>│<──│ C │nul│
   └───┴───┴───┘   └───┴───┴───┘   └───┴───┴───┘

3. 원형 연결 리스트 (Circular Linked List)
   ┌───┬───┬───┐   ┌───┬───┬───┐   ┌───┬───┬───┐
   │<──│ A │ ──┼──>│<──│ B │ ──┼──>│<──│ C │ ──┼──┐
   └───┴───┴───┘   └───┴───┴───┘   └───┴───┴───┘  │
     ↑                                             │
     └─────────────────────────────────────────────┘
```

### LinkedList 노드 구조

```java
class Node {
    Node next;      // 다음 요소의 참조
    Node previous;  // 이전 요소의 참조 (doubly linked)
    Object item;    // 데이터
}
```

### LinkedList 추가 메서드 (Deque 인터페이스)

```java
// 맨 앞/뒤 조작
void addFirst(Object o)      // 맨 앞에 추가
void addLast(Object o)       // 맨 뒤에 추가
Object getFirst()            // 첫 번째 요소 반환
Object getLast()             // 마지막 요소 반환
Object removeFirst()         // 첫 번째 요소 제거 및 반환
Object removeLast()          // 마지막 요소 제거 및 반환

// Stack처럼 사용
void push(Object o)          // = addFirst()
Object pop()                 // = removeFirst()
Object peek()                // = getFirst()

// Queue처럼 사용
boolean offer(Object o)      // = addLast()
Object poll()                // = removeFirst()
```

### ArrayList vs LinkedList 성능 비교

```java
import java.util.*;

public class ListPerformanceTest {
    public static void main(String[] args) {
        ArrayList<Integer> arrayList = new ArrayList<>(1000000);
        LinkedList<Integer> linkedList = new LinkedList<>();

        // 순차적 추가 테스트
        System.out.println("=== 순차적 추가 ===");
        System.out.println("ArrayList: " + addSequential(arrayList) + "ms");
        System.out.println("LinkedList: " + addSequential(linkedList) + "ms");

        // 중간 삽입 테스트
        System.out.println("\n=== 중간 삽입 ===");
        System.out.println("ArrayList: " + addMiddle(new ArrayList<>(arrayList)) + "ms");
        System.out.println("LinkedList: " + addMiddle(new LinkedList<>(linkedList)) + "ms");

        // 접근 테스트
        System.out.println("\n=== 접근 (get) ===");
        System.out.println("ArrayList: " + access(arrayList) + "ms");
        System.out.println("LinkedList: " + access(linkedList) + "ms");
    }

    static long addSequential(List<Integer> list) {
        long start = System.currentTimeMillis();
        for (int i = 0; i < 100000; i++) {
            list.add(i);
        }
        return System.currentTimeMillis() - start;
    }

    static long addMiddle(List<Integer> list) {
        long start = System.currentTimeMillis();
        for (int i = 0; i < 10000; i++) {
            list.add(list.size() / 2, i);
        }
        return System.currentTimeMillis() - start;
    }

    static long access(List<Integer> list) {
        long start = System.currentTimeMillis();
        for (int i = 0; i < 10000; i++) {
            list.get(i);
        }
        return System.currentTimeMillis() - start;
    }
}
```

### 성능 비교 요약

| 작업 | ArrayList | LinkedList |
|-----|:---------:|:----------:|
| **순차적 추가/삭제** | 빠름 | 느림 |
| **중간 추가/삭제** | 느림 | 빠름 |
| **접근 (get)** | **O(1)** - 매우 빠름 | **O(n)** - 느림 |
| **메모리 효율** | 좋음 | 나쁨 (노드당 참조 2개) |

{{< callout type="info" >}}
**인덱스 접근 공식** (배열)
```
인덱스 n의 주소 = 배열 시작 주소 + n × 데이터 타입 크기
```
배열은 이 공식으로 **O(1)**에 접근 가능하지만, LinkedList는 처음부터 순회해야 해서 **O(n)**이 걸린다.
{{< /callout >}}

---

## 6. Stack과 Queue

### Stack (LIFO: Last In First Out)

**후입선출** 구조 - 마지막에 넣은 데이터를 가장 먼저 꺼냄

```
        push ↓   ↑ pop
              ─────
             │  C  │  ← top
             │  B  │
             │  A  │
              ─────
```

#### Stack 메서드

| 메서드 | 설명 |
|-------|------|
| `Object push(Object item)` | 객체 저장 |
| `Object pop()` | 맨 위 객체 꺼내기 (제거) |
| `Object peek()` | 맨 위 객체 보기 (제거 X) |
| `boolean empty()` | 비어있는지 확인 |
| `int search(Object o)` | 위치 반환 (1부터 시작, 없으면 -1) |

#### Stack 사용 예제

```java
import java.util.*;

public class StackExample {
    public static void main(String[] args) {
        Stack<String> stack = new Stack<>();

        // push
        stack.push("1");
        stack.push("2");
        stack.push("3");
        System.out.println("Stack: " + stack);  // [1, 2, 3]

        // peek (제거 없이 확인)
        System.out.println("Peek: " + stack.peek());  // 3

        // pop (제거하면서 반환)
        while (!stack.empty()) {
            System.out.println("Pop: " + stack.pop());
        }
        // Pop: 3, Pop: 2, Pop: 1
    }
}
```

### Queue (FIFO: First In First Out)

**선입선출** 구조 - 먼저 넣은 데이터를 가장 먼저 꺼냄

```
  offer →  ─────────────────  → poll
          │ A │ B │ C │ D │
           ─────────────────
           front          rear
```

#### Queue 메서드

| 메서드 | 예외 발생 | null 반환 | 설명 |
|-------|:--------:|:--------:|------|
| `add(Object o)` | O | - | 객체 추가 |
| `offer(Object o)` | - | false | 객체 추가 |
| `remove()` | O | - | 객체 꺼내기 |
| `poll()` | - | null | 객체 꺼내기 |
| `element()` | O | - | 객체 확인 |
| `peek()` | - | null | 객체 확인 |

#### Queue 사용 예제

```java
import java.util.*;

public class QueueExample {
    public static void main(String[] args) {
        // Queue는 인터페이스이므로 LinkedList로 구현
        Queue<String> queue = new LinkedList<>();

        // offer
        queue.offer("1");
        queue.offer("2");
        queue.offer("3");
        System.out.println("Queue: " + queue);  // [1, 2, 3]

        // peek (제거 없이 확인)
        System.out.println("Peek: " + queue.peek());  // 1

        // poll (제거하면서 반환)
        while (!queue.isEmpty()) {
            System.out.println("Poll: " + queue.poll());
        }
        // Poll: 1, Poll: 2, Poll: 3
    }
}
```

### Stack과 Queue의 활용

| 자료구조 | 활용 예 |
|---------|--------|
| **Stack** | 수식 계산, 괄호 검사, undo/redo, 뒤로가기/앞으로가기 |
| **Queue** | 작업 대기열, 인쇄 대기열, 버퍼, BFS 탐색 |

### 괄호 검사 예제 (Stack 활용)

```java
import java.util.*;

public class BracketChecker {
    public static boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        Map<Character, Character> pairs = Map.of(')', '(', '}', '{', ']', '[');

        for (char c : s.toCharArray()) {
            if (c == '(' || c == '{' || c == '[') {
                stack.push(c);
            } else if (pairs.containsKey(c)) {
                if (stack.isEmpty() || stack.pop() != pairs.get(c)) {
                    return false;
                }
            }
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        System.out.println(isValid("(){}[]"));      // true
        System.out.println(isValid("([{}])"));      // true
        System.out.println(isValid("([)]"));        // false
        System.out.println(isValid("{[}]"));        // false
    }
}
```

### PriorityQueue (우선순위 큐)

저장 순서와 관계없이 **우선순위가 높은 것**부터 꺼낸다.

```java
import java.util.*;

public class PriorityQueueExample {
    public static void main(String[] args) {
        // 기본: 작은 값이 우선순위 높음 (최소 힙)
        PriorityQueue<Integer> pq = new PriorityQueue<>();
        pq.offer(3);
        pq.offer(1);
        pq.offer(4);
        pq.offer(1);
        pq.offer(5);

        System.out.print("MinHeap: ");
        while (!pq.isEmpty()) {
            System.out.print(pq.poll() + " ");  // 1 1 3 4 5
        }

        // 최대 힙
        PriorityQueue<Integer> maxPq = new PriorityQueue<>(Collections.reverseOrder());
        maxPq.offer(3);
        maxPq.offer(1);
        maxPq.offer(4);

        System.out.print("\nMaxHeap: ");
        while (!maxPq.isEmpty()) {
            System.out.print(maxPq.poll() + " ");  // 4 3 1
        }
    }
}
```

### Deque (Double-Ended Queue)

**양쪽 끝**에서 추가/삭제가 가능한 큐

```java
import java.util.*;

public class DequeExample {
    public static void main(String[] args) {
        Deque<String> deque = new ArrayDeque<>();

        // 양쪽에서 추가
        deque.addFirst("A");
        deque.addLast("B");
        deque.offerFirst("C");
        deque.offerLast("D");
        System.out.println("Deque: " + deque);  // [C, A, B, D]

        // 양쪽에서 제거
        System.out.println("First: " + deque.pollFirst());  // C
        System.out.println("Last: " + deque.pollLast());    // D
        System.out.println("Deque: " + deque);  // [A, B]

        // Stack처럼 사용
        deque.push("E");  // = addFirst
        System.out.println("Pop: " + deque.pop());  // E = removeFirst
    }
}
```

#### Deque 메서드 대응표

| Deque | Queue | Stack |
|-------|-------|-------|
| `offerLast()` | `offer()` | - |
| `pollFirst()` | `poll()` | - |
| `offerFirst()` | - | `push()` |
| `pollFirst()` | - | `pop()` |
| `peekFirst()` | `peek()` | - |
| `peekLast()` | - | `peek()` |

---

## 7. Set 인터페이스

**중복을 허용하지 않고** 저장 **순서를 유지하지 않는** 컬렉션.

### Set 구현 클래스

| 클래스 | 특징 |
|-------|------|
| **HashSet** | 해시 테이블 기반, 가장 빠름 |
| **LinkedHashSet** | 해시 테이블 + 연결 리스트, 순서 유지 |
| **TreeSet** | 레드-블랙 트리 기반, 정렬된 순서 |

### HashSet 사용 예제

```java
import java.util.*;

public class HashSetExample {
    public static void main(String[] args) {
        Set<String> set = new HashSet<>();

        // 추가
        set.add("Java");
        set.add("Python");
        set.add("Java");  // 중복 - 추가되지 않음
        set.add("C++");

        System.out.println("Set: " + set);  // 순서 보장 안됨
        System.out.println("Size: " + set.size());  // 3

        // 포함 여부
        System.out.println("Contains Java: " + set.contains("Java"));  // true

        // 삭제
        set.remove("Python");
        System.out.println("After remove: " + set);
    }
}
```

### TreeSet 사용 예제 (정렬)

```java
import java.util.*;

public class TreeSetExample {
    public static void main(String[] args) {
        TreeSet<Integer> set = new TreeSet<>();
        set.add(5);
        set.add(1);
        set.add(3);
        set.add(2);
        set.add(4);

        System.out.println("TreeSet: " + set);  // [1, 2, 3, 4, 5] - 자동 정렬

        // 범위 검색
        System.out.println("First: " + set.first());       // 1
        System.out.println("Last: " + set.last());         // 5
        System.out.println("HeadSet(3): " + set.headSet(3));  // [1, 2]
        System.out.println("TailSet(3): " + set.tailSet(3));  // [3, 4, 5]
        System.out.println("SubSet(2,4): " + set.subSet(2, 4));  // [2, 3]

        // 가장 가까운 값 찾기
        System.out.println("Floor(3): " + set.floor(3));    // 3 (이하 중 최대)
        System.out.println("Ceiling(3): " + set.ceiling(3)); // 3 (이상 중 최소)
        System.out.println("Higher(3): " + set.higher(3));   // 4 (초과 중 최소)
        System.out.println("Lower(3): " + set.lower(3));     // 2 (미만 중 최대)
    }
}
```

### 객체의 중복 판단 (equals & hashCode)

```java
import java.util.*;

class Person {
    String name;
    int age;

    Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    // equals와 hashCode를 오버라이드해야 중복 판단 가능
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Person)) return false;
        Person p = (Person) o;
        return age == p.age && Objects.equals(name, p.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, age);
    }

    @Override
    public String toString() {
        return name + "(" + age + ")";
    }
}

public class SetEqualsExample {
    public static void main(String[] args) {
        Set<Person> set = new HashSet<>();
        set.add(new Person("Kim", 20));
        set.add(new Person("Lee", 25));
        set.add(new Person("Kim", 20));  // 중복

        System.out.println("Set: " + set);  // [Kim(20), Lee(25)]
    }
}
```

---

## 8. Map 인터페이스

**키(Key)와 값(Value)의 쌍**으로 데이터를 저장하는 컬렉션.

### Map 구현 클래스

| 클래스 | 특징 |
|-------|------|
| **HashMap** | 해시 테이블 기반, 가장 빠름 |
| **LinkedHashMap** | 해시 테이블 + 연결 리스트, 순서 유지 |
| **TreeMap** | 레드-블랙 트리 기반, 키 정렬 |
| **Hashtable** | 동기화 지원 (레거시) |

### Map 주요 메서드

| 메서드 | 설명 |
|-------|------|
| `V put(K key, V value)` | 키-값 쌍 저장 |
| `V get(Object key)` | 키에 해당하는 값 반환 |
| `V remove(Object key)` | 키에 해당하는 쌍 제거 |
| `boolean containsKey(Object key)` | 키 존재 여부 |
| `boolean containsValue(Object value)` | 값 존재 여부 |
| `Set<K> keySet()` | 모든 키를 Set으로 반환 |
| `Collection<V> values()` | 모든 값을 Collection으로 반환 |
| `Set<Map.Entry<K,V>> entrySet()` | 모든 키-값 쌍을 Set으로 반환 |

### HashMap 사용 예제

```java
import java.util.*;

public class HashMapExample {
    public static void main(String[] args) {
        Map<String, Integer> map = new HashMap<>();

        // 추가
        map.put("Java", 100);
        map.put("Python", 90);
        map.put("C++", 80);
        map.put("Java", 95);  // 키 중복 - 값 덮어쓰기

        System.out.println("Map: " + map);
        // {Java=95, C++=80, Python=90}

        // 조회
        System.out.println("Java: " + map.get("Java"));  // 95
        System.out.println("Go: " + map.get("Go"));      // null
        System.out.println("Go (default): " + map.getOrDefault("Go", 0));  // 0

        // 키/값 존재 확인
        System.out.println("Contains Key 'Java': " + map.containsKey("Java"));  // true
        System.out.println("Contains Value 90: " + map.containsValue(90));      // true

        // 삭제
        map.remove("C++");
        System.out.println("After remove: " + map);
    }
}
```

### Map 순회 방법

```java
import java.util.*;

public class MapIterationExample {
    public static void main(String[] args) {
        Map<String, Integer> map = new HashMap<>();
        map.put("A", 1);
        map.put("B", 2);
        map.put("C", 3);

        // 1. keySet() 사용
        System.out.println("=== keySet ===");
        for (String key : map.keySet()) {
            System.out.println(key + " = " + map.get(key));
        }

        // 2. entrySet() 사용 (더 효율적)
        System.out.println("\n=== entrySet ===");
        for (Map.Entry<String, Integer> entry : map.entrySet()) {
            System.out.println(entry.getKey() + " = " + entry.getValue());
        }

        // 3. forEach (Java 8+)
        System.out.println("\n=== forEach ===");
        map.forEach((key, value) -> System.out.println(key + " = " + value));

        // 4. Iterator 사용
        System.out.println("\n=== Iterator ===");
        Iterator<Map.Entry<String, Integer>> it = map.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Integer> entry = it.next();
            System.out.println(entry.getKey() + " = " + entry.getValue());
        }
    }
}
```

### TreeMap 사용 예제 (정렬된 Map)

```java
import java.util.*;

public class TreeMapExample {
    public static void main(String[] args) {
        TreeMap<String, Integer> map = new TreeMap<>();
        map.put("C", 3);
        map.put("A", 1);
        map.put("B", 2);
        map.put("D", 4);

        System.out.println("TreeMap: " + map);  // {A=1, B=2, C=3, D=4}

        // 범위 검색
        System.out.println("First Key: " + map.firstKey());     // A
        System.out.println("Last Key: " + map.lastKey());       // D
        System.out.println("HeadMap(C): " + map.headMap("C"));  // {A=1, B=2}
        System.out.println("TailMap(C): " + map.tailMap("C"));  // {C=3, D=4}
    }
}
```

---

## 9. Iterator와 ListIterator

### Iterator

컬렉션의 요소를 **읽어오는 방법을 표준화**한 인터페이스.

```java
import java.util.*;

public class IteratorExample {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>(Arrays.asList("A", "B", "C", "D"));

        // Iterator 얻기
        Iterator<String> it = list.iterator();

        // 순회
        while (it.hasNext()) {
            String element = it.next();
            System.out.println(element);

            // 순회 중 삭제
            if (element.equals("B")) {
                it.remove();
            }
        }

        System.out.println("After remove: " + list);  // [A, C, D]
    }
}
```

### Iterator 메서드

| 메서드 | 설명 |
|-------|------|
| `boolean hasNext()` | 다음 요소가 있는지 확인 |
| `E next()` | 다음 요소 반환 |
| `void remove()` | 마지막으로 반환된 요소 삭제 |
| `void forEachRemaining(Consumer)` | 남은 요소에 대해 작업 수행 (Java 8+) |

### ListIterator

**양방향 이동**이 가능한 Iterator (List 전용)

```java
import java.util.*;

public class ListIteratorExample {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>(Arrays.asList("A", "B", "C"));

        // 끝에서 시작하는 ListIterator
        ListIterator<String> it = list.listIterator(list.size());

        // 역방향 순회
        System.out.println("=== Reverse ===");
        while (it.hasPrevious()) {
            int idx = it.previousIndex();
            String element = it.previous();
            System.out.println(idx + ": " + element);
        }
        // 2: C, 1: B, 0: A

        // 정방향으로 다시 이동하면서 수정
        System.out.println("\n=== Forward with modify ===");
        while (it.hasNext()) {
            String element = it.next();
            it.set(element + "!");  // 요소 변경
        }
        System.out.println("Modified: " + list);  // [A!, B!, C!]
    }
}
```

### ListIterator 추가 메서드

| 메서드 | 설명 |
|-------|------|
| `boolean hasPrevious()` | 이전 요소가 있는지 확인 |
| `E previous()` | 이전 요소 반환 |
| `int nextIndex()` | 다음 요소의 인덱스 |
| `int previousIndex()` | 이전 요소의 인덱스 |
| `void set(E e)` | 마지막 요소를 지정 값으로 변경 |
| `void add(E e)` | 현재 위치에 요소 추가 |

---

## 10. Arrays 클래스

배열을 다루는 **유틸리티 메서드**들을 제공하는 클래스 (모든 메서드가 static).

### 주요 메서드

```java
import java.util.*;

public class ArraysExample {
    public static void main(String[] args) {
        int[] arr = {3, 1, 4, 1, 5, 9, 2, 6};

        // 출력
        System.out.println(Arrays.toString(arr));  // [3, 1, 4, 1, 5, 9, 2, 6]

        // 정렬
        Arrays.sort(arr);
        System.out.println(Arrays.toString(arr));  // [1, 1, 2, 3, 4, 5, 6, 9]

        // 이진 검색 (정렬 후에만 사용)
        int idx = Arrays.binarySearch(arr, 4);
        System.out.println("Index of 4: " + idx);  // 4

        // 복사
        int[] copy1 = Arrays.copyOf(arr, 5);       // 앞에서 5개
        int[] copy2 = Arrays.copyOfRange(arr, 2, 5);  // 인덱스 2~4
        System.out.println("copyOf: " + Arrays.toString(copy1));      // [1, 1, 2, 3, 4]
        System.out.println("copyOfRange: " + Arrays.toString(copy2)); // [2, 3, 4]

        // 채우기
        int[] filled = new int[5];
        Arrays.fill(filled, 7);
        System.out.println("fill: " + Arrays.toString(filled));  // [7, 7, 7, 7, 7]

        // 비교
        int[] arr1 = {1, 2, 3};
        int[] arr2 = {1, 2, 3};
        System.out.println("equals: " + Arrays.equals(arr1, arr2));  // true

        // List로 변환
        String[] strArr = {"A", "B", "C"};
        List<String> list = Arrays.asList(strArr);
        System.out.println("asList: " + list);  // [A, B, C]
        // 주의: 이 List는 크기 변경 불가 (add/remove 불가)

        // 크기 변경 가능한 List로 변환
        List<String> mutableList = new ArrayList<>(Arrays.asList(strArr));
        mutableList.add("D");
        System.out.println("mutableList: " + mutableList);  // [A, B, C, D]
    }
}
```

### 다차원 배열 처리

```java
import java.util.*;

public class MultiDimensionalArrays {
    public static void main(String[] args) {
        int[][] arr2D = {{1, 2}, {3, 4}, {5, 6}};

        // toString vs deepToString
        System.out.println(Arrays.toString(arr2D));      // 주소값 출력
        System.out.println(Arrays.deepToString(arr2D));  // [[1, 2], [3, 4], [5, 6]]

        // equals vs deepEquals
        int[][] arr2D_2 = {{1, 2}, {3, 4}, {5, 6}};
        System.out.println(Arrays.equals(arr2D, arr2D_2));      // false (주소 비교)
        System.out.println(Arrays.deepEquals(arr2D, arr2D_2));  // true (내용 비교)
    }
}
```

---

## 11. Comparator와 Comparable

객체를 **정렬**하기 위해 사용하는 인터페이스.

### Comparable (자기 자신과 비교)

클래스가 **기본 정렬 기준**을 정의할 때 사용.

```java
public interface Comparable<T> {
    int compareTo(T o);  // 음수: 작음, 0: 같음, 양수: 큼
}
```

```java
import java.util.*;

class Student implements Comparable<Student> {
    String name;
    int score;

    Student(String name, int score) {
        this.name = name;
        this.score = score;
    }

    // 점수 기준 오름차순 정렬 (기본 정렬 기준)
    @Override
    public int compareTo(Student o) {
        return this.score - o.score;  // 또는 Integer.compare(this.score, o.score)
    }

    @Override
    public String toString() {
        return name + "(" + score + ")";
    }
}

public class ComparableExample {
    public static void main(String[] args) {
        List<Student> students = new ArrayList<>();
        students.add(new Student("Kim", 85));
        students.add(new Student("Lee", 90));
        students.add(new Student("Park", 80));

        Collections.sort(students);  // Comparable의 compareTo 사용
        System.out.println(students);  // [Park(80), Kim(85), Lee(90)]
    }
}
```

### Comparator (다른 객체와 비교)

**다양한 정렬 기준**을 정의할 때 사용.

```java
public interface Comparator<T> {
    int compare(T o1, T o2);  // 음수: o1 < o2, 0: 같음, 양수: o1 > o2
}
```

```java
import java.util.*;

public class ComparatorExample {
    public static void main(String[] args) {
        List<Student> students = new ArrayList<>();
        students.add(new Student("Kim", 85));
        students.add(new Student("Lee", 90));
        students.add(new Student("Park", 80));

        // 점수 내림차순 정렬
        Collections.sort(students, (s1, s2) -> s2.score - s1.score);
        System.out.println("점수 내림차순: " + students);
        // [Lee(90), Kim(85), Park(80)]

        // 이름 오름차순 정렬
        Collections.sort(students, (s1, s2) -> s1.name.compareTo(s2.name));
        System.out.println("이름 오름차순: " + students);
        // [Kim(85), Lee(90), Park(80)]

        // Comparator의 static 메서드 활용 (Java 8+)
        students.sort(Comparator.comparing(s -> s.score));  // 점수 오름차순
        students.sort(Comparator.comparing((Student s) -> s.score).reversed());  // 점수 내림차순
        students.sort(Comparator.comparing((Student s) -> s.name)
                                .thenComparing(s -> s.score));  // 이름 → 점수 순
    }
}
```

### Comparator 유틸리티 메서드 (Java 8+)

```java
import java.util.*;

public class ComparatorUtilsExample {
    public static void main(String[] args) {
        List<String> list = Arrays.asList("banana", "Apple", "cherry", null, "date");

        // 대소문자 무시 정렬
        list.sort(String.CASE_INSENSITIVE_ORDER);

        // null을 맨 뒤로
        list.sort(Comparator.nullsLast(String::compareTo));

        // null을 맨 앞으로
        list.sort(Comparator.nullsFirst(String::compareTo));

        // 역순
        list.sort(Comparator.reverseOrder());

        // 자연 순서
        list.sort(Comparator.naturalOrder());
    }
}
```

---

## 12. Collections 클래스

컬렉션을 다루는 **유틸리티 메서드**들을 제공 (모든 메서드가 static).

### 주요 메서드

```java
import java.util.*;

public class CollectionsExample {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(Arrays.asList(3, 1, 4, 1, 5, 9, 2, 6));

        // 정렬
        Collections.sort(list);
        System.out.println("Sorted: " + list);  // [1, 1, 2, 3, 4, 5, 6, 9]

        // 역순 정렬
        Collections.sort(list, Collections.reverseOrder());
        System.out.println("Reversed: " + list);  // [9, 6, 5, 4, 3, 2, 1, 1]

        // 이진 검색
        Collections.sort(list);
        int idx = Collections.binarySearch(list, 4);
        System.out.println("Index of 4: " + idx);  // 4

        // 최대/최소
        System.out.println("Max: " + Collections.max(list));  // 9
        System.out.println("Min: " + Collections.min(list));  // 1

        // 뒤집기
        Collections.reverse(list);
        System.out.println("Reverse: " + list);  // [9, 6, 5, 4, 3, 2, 1, 1]

        // 섞기
        Collections.shuffle(list);
        System.out.println("Shuffle: " + list);  // 무작위 순서

        // 회전
        list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5));
        Collections.rotate(list, 2);  // 오른쪽으로 2칸
        System.out.println("Rotate: " + list);  // [4, 5, 1, 2, 3]

        // 교체
        Collections.swap(list, 0, 4);
        System.out.println("Swap: " + list);

        // 모든 요소 교체
        Collections.fill(list, 0);
        System.out.println("Fill: " + list);  // [0, 0, 0, 0, 0]

        // 빈도수
        list = new ArrayList<>(Arrays.asList(1, 2, 2, 3, 3, 3));
        System.out.println("Frequency of 3: " + Collections.frequency(list, 3));  // 3
    }
}
```

### 동기화된 컬렉션

```java
import java.util.*;

public class SynchronizedCollections {
    public static void main(String[] args) {
        // 동기화된 컬렉션 생성
        List<String> syncList = Collections.synchronizedList(new ArrayList<>());
        Set<String> syncSet = Collections.synchronizedSet(new HashSet<>());
        Map<String, Integer> syncMap = Collections.synchronizedMap(new HashMap<>());

        // 순회 시 동기화 블록 필요
        synchronized (syncList) {
            for (String s : syncList) {
                // 안전한 순회
            }
        }
    }
}
```

### 불변 컬렉션

```java
import java.util.*;

public class UnmodifiableCollections {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>(Arrays.asList("A", "B", "C"));

        // 불변 컬렉션으로 변환
        List<String> unmodifiableList = Collections.unmodifiableList(list);

        // unmodifiableList.add("D");  // UnsupportedOperationException

        // Java 9+ 불변 컬렉션 생성
        List<String> immutableList = List.of("A", "B", "C");
        Set<String> immutableSet = Set.of("A", "B", "C");
        Map<String, Integer> immutableMap = Map.of("A", 1, "B", 2);
    }
}
```

### 싱글톤/빈 컬렉션

```java
import java.util.*;

public class SingletonEmptyCollections {
    public static void main(String[] args) {
        // 싱글톤 (요소 1개만 포함)
        List<String> singletonList = Collections.singletonList("only");
        Set<String> singletonSet = Collections.singleton("only");
        Map<String, Integer> singletonMap = Collections.singletonMap("key", 1);

        // 빈 컬렉션 (불변)
        List<String> emptyList = Collections.emptyList();
        Set<String> emptySet = Collections.emptySet();
        Map<String, Integer> emptyMap = Collections.emptyMap();
    }
}
```

---

## 13. 컬렉션 선택 가이드

### 상황별 추천 컬렉션

| 상황 | 추천 컬렉션 |
|-----|-----------|
| 순서 있는 데이터, 빠른 접근 | **ArrayList** |
| 순서 있는 데이터, 빈번한 삽입/삭제 | **LinkedList** |
| 중복 없는 데이터, 빠른 검색 | **HashSet** |
| 중복 없는 데이터, 정렬 필요 | **TreeSet** |
| 중복 없는 데이터, 순서 유지 | **LinkedHashSet** |
| 키-값 쌍, 빠른 검색 | **HashMap** |
| 키-값 쌍, 키 정렬 | **TreeMap** |
| 키-값 쌍, 순서 유지 | **LinkedHashMap** |
| LIFO 구조 | **ArrayDeque** (Stack 대신) |
| FIFO 구조 | **ArrayDeque** 또는 **LinkedList** |
| 우선순위 처리 | **PriorityQueue** |
| 멀티스레드 환경 | **ConcurrentHashMap**, **CopyOnWriteArrayList** |

### 시간 복잡도 비교

| 연산 | ArrayList | LinkedList | HashSet | TreeSet | HashMap | TreeMap |
|-----|:---------:|:----------:|:-------:|:-------:|:-------:|:-------:|
| **접근** | O(1) | O(n) | - | - | O(1) | O(log n) |
| **검색** | O(n) | O(n) | O(1) | O(log n) | O(1) | O(log n) |
| **삽입** | O(n) | O(1) | O(1) | O(log n) | O(1) | O(log n) |
| **삭제** | O(n) | O(1) | O(1) | O(log n) | O(1) | O(log n) |

{{< callout type="warning" >}}
**Vector와 Hashtable**은 레거시 클래스로, 새 코드에서는 **ArrayList**와 **HashMap**을 사용하는 것이 권장된다. 동기화가 필요하면 `Collections.synchronizedXXX()` 또는 `java.util.concurrent` 패키지의 클래스를 사용하자.
{{< /callout >}}

---

## 요약

| 개념 | 핵심 내용 |
|-----|----------|
| **Collection** | List, Set의 상위 인터페이스 |
| **List** | 순서 O, 중복 O (ArrayList, LinkedList) |
| **Set** | 순서 X, 중복 X (HashSet, TreeSet) |
| **Map** | 키-값 쌍 (HashMap, TreeMap) |
| **Stack/Queue** | LIFO/FIFO 자료구조 |
| **Iterator** | 컬렉션 순회를 위한 표준 인터페이스 |
| **Comparable** | 클래스의 기본 정렬 기준 정의 |
| **Comparator** | 다양한 정렬 기준 정의 |
| **Arrays** | 배열 유틸리티 (sort, binarySearch, asList) |
| **Collections** | 컬렉션 유틸리티 (sort, shuffle, synchronizedXXX) |
