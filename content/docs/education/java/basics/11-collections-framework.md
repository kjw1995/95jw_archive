---
title: "Chapter 11. 컬렉션 프레임웍 (Collections Framework)"
weight: 11
---

# 컬렉션 프레임웍 (Collections Framework)

컬렉션 프레임웍의 핵심 인터페이스(List, Set, Map), 주요 구현 클래스, 정렬과 검색, 해싱의 원리를 다룬다.

---

## 1. 컬렉션 프레임웍이란?

데이터 그룹을 저장하는 클래스들을 **표준화한 설계(아키텍처)** 이다. JDK 1.2부터 도입되어 다양한 컬렉션 클래스를 통일된 방식으로 다룰 수 있게 되었다.

### 1.1 핵심 인터페이스

```
         Collection
        ┌─────┴─────┐
       List         Set          Map
    (순서 O,       (순서 X,     (키-값 쌍,
     중복 O)       중복 X)      키 중복 X)
```

| 인터페이스 | 특징 | 구현 클래스 |
|:---------|:-----|:----------|
| `List` | 순서 유지, 중복 허용 | `ArrayList`, `LinkedList`, `Vector` |
| `Set` | 순서 미유지, 중복 불허 | `HashSet`, `TreeSet`, `LinkedHashSet` |
| `Map` | 키-값 쌍, 키 중복 불허 | `HashMap`, `TreeMap`, `LinkedHashMap` |

### 1.2 Collection 인터페이스의 주요 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `boolean add(Object o)` | 객체를 추가 |
| `boolean contains(Object o)` | 포함 여부 확인 |
| `boolean remove(Object o)` | 객체 삭제 |
| `int size()` | 저장된 객체 수 반환 |
| `boolean isEmpty()` | 비어있는지 확인 |
| `Iterator iterator()` | Iterator를 반환 |
| `void clear()` | 모든 객체 삭제 |
| `Object[] toArray()` | 객체 배열로 반환 |
| `boolean retainAll(Collection c)` | 교집합만 남김 |
| `boolean removeAll(Collection c)` | 차집합 (c에 포함된 것 삭제) |

### 1.3 Map 인터페이스의 주요 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `Object put(Object key, Object value)` | 키-값 쌍 저장 |
| `Object get(Object key)` | 키에 해당하는 값 반환 |
| `boolean containsKey(Object key)` | 키 존재 여부 |
| `boolean containsValue(Object value)` | 값 존재 여부 |
| `Set keySet()` | 모든 키를 Set으로 반환 |
| `Collection values()` | 모든 값을 Collection으로 반환 |
| `Set entrySet()` | 모든 키-값 쌍을 Set으로 반환 |

{{< callout type="info" >}}
**keySet()은 Set, values()는 Collection을 반환한다.** 키는 중복 불가이므로 Set, 값은 중복 가능이므로 Collection 타입이다.
{{< /callout >}}

---

## 2. ArrayList

`List` 인터페이스를 구현한 가장 많이 사용되는 컬렉션 클래스이다. 내부적으로 `Object[]` 배열을 사용한다.

### 2.1 특징

```
ArrayList 내부 구조 (capacity=5)

[0]  [1]  [2]  [3]  [4]
 A    B    C   null null
         ↑
      size=3, capacity=5
```

- 저장 순서가 유지되고 중복을 허용한다
- 기존 `Vector`의 개선 버전이다
- 배열 기반이므로 **인덱스로 빠르게 접근** 가능하다 (O(1))
- 용량이 부족하면 더 큰 배열을 생성하고 복사한다

### 2.2 기본 사용법

```java
import java.util.ArrayList;
import java.util.Collections;

ArrayList<String> list = new ArrayList<>();  // 기본 용량 10

// 추가
list.add("Java");
list.add("Python");
list.add("C++");
list.add(1, "Kotlin");  // 인덱스 1에 삽입

// 조회
String lang = list.get(0);               // "Java"
int idx = list.indexOf("Python");         // 2
boolean has = list.contains("C++");       // true

// 수정
list.set(0, "Java 17");

// 삭제
list.remove(0);             // 인덱스로 삭제
list.remove("C++");         // 객체로 삭제

// 크기
int size = list.size();

// 정렬
Collections.sort(list);
```

### 2.3 중간 삽입/삭제 시 배열 복사

```
인덱스 2에 "X" 삽입하는 과정:

[A][B][C][D][ ]   원본 (size=4)
      ↓
[A][B][ ][C][D]   C,D를 한 칸씩 뒤로 복사
      ↓
[A][B][X][C][D]   빈자리에 X 삽입
```

- 중간 삽입/삭제 시 `System.arraycopy()`로 데이터를 이동시킨다
- 데이터가 많을수록 성능이 저하된다

### 2.4 용량 관리

```java
ArrayList<Integer> list = new ArrayList<>(100);  // 초기 용량 지정

list.trimToSize();          // 빈 공간 제거 (size == capacity)
list.ensureCapacity(200);   // 최소 용량 200 확보
```

{{< callout type="warning" >}}
**초기 용량을 여유 있게 설정하라.** 용량이 부족하면 새 배열 생성 + 복사가 발생하여 성능이 저하된다. 저장할 데이터 수를 예측할 수 있다면 초기 용량을 지정하는 것이 좋다.
{{< /callout >}}

---

## 3. LinkedList

불연속적인 데이터를 노드(Node)로 연결한 자료구조이다.

### 3.1 노드의 구조

```
단방향 링크드 리스트:
[A|→] → [B|→] → [C|→] → null

더블 링크드 리스트 (실제 Java LinkedList):
null ← [←|A|→] ⇄ [←|B|→] ⇄ [←|C|→] → null
```

```java
// 단방향 노드
class Node {
    Object data;
    Node next;       // 다음 노드 참조
}

// 양방향 노드 (실제 LinkedList)
class Node {
    Object data;
    Node next;       // 다음 노드 참조
    Node previous;   // 이전 노드 참조
}
```

실제 자바의 `LinkedList` 클래스는 **더블 링크드 리스트**로 구현되어 있다.

### 3.2 삽입과 삭제

```
삭제 (B 제거):
[A|→] → [B|→] → [C|→]
   └──────────────┘     A의 next를 C로 변경

삽입 (A와 C 사이에 X 추가):
[A|→] → [C|→]
   └→ [X|→] ┘             참조만 변경
```

- 참조(주소)만 변경하므로 배열처럼 데이터를 이동시킬 필요가 없다
- 삽입/삭제가 O(1)로 매우 빠르다 (위치를 알고 있는 경우)

### 3.3 ArrayList vs LinkedList

| 항목 | ArrayList | LinkedList |
|:-----|:----------|:-----------|
| 읽기 (접근) | **빠르다** O(1) | 느리다 O(n) |
| 순차 추가/삭제 | **빠르다** | 빠르다 |
| 중간 추가/삭제 | 느리다 O(n) | **빠르다** O(1) |
| 메모리 | 효율적 | 노드마다 참조 변수 추가 |
| 내부 구조 | 배열 | 노드 + 참조 |

```java
// 상황별 선택 가이드
// 데이터 조회가 빈번 → ArrayList
ArrayList<String> readHeavy = new ArrayList<>();

// 데이터 삽입/삭제가 빈번 → LinkedList
LinkedList<String> writeHeavy = new LinkedList<>();
```

---

## 4. Stack과 Queue

### 4.1 Stack (LIFO)

마지막에 넣은 데이터를 가장 먼저 꺼내는 구조이다.

```
push(1) → push(2) → push(3)

  ┌───┐
  │ 3 │ ← top (pop하면 3이 나옴)
  ├───┤
  │ 2 │
  ├───┤
  │ 1 │
  └───┘
```

| 메서드 | 설명 |
|:-------|:-----|
| `push(Object item)` | 객체를 스택에 저장 |
| `Object pop()` | 맨 위 객체를 꺼내서 반환 |
| `Object peek()` | 맨 위 객체를 반환 (제거하지 않음) |
| `boolean empty()` | 비어있는지 확인 |
| `int search(Object o)` | 객체의 위치 반환 (1부터 시작) |

```java
Stack<String> stack = new Stack<>();
stack.push("A");
stack.push("B");
stack.push("C");

stack.peek();   // "C" (제거 안 함)
stack.pop();    // "C" (제거)
stack.pop();    // "B"
```

**활용 예:** 수식 괄호 검사, undo/redo, 웹 브라우저 뒤로/앞으로

### 4.2 Queue (FIFO)

처음에 넣은 데이터를 가장 먼저 꺼내는 구조이다.

```
offer(1) → offer(2) → offer(3)

  입구 → [1][2][3] → 출구
         poll하면 1이 나옴
```

| 메서드 | 설명 |
|:-------|:-----|
| `boolean offer(Object o)` | 객체를 큐에 저장 |
| `Object poll()` | 첫 번째 객체를 꺼내서 반환 (비어있으면 null) |
| `Object peek()` | 첫 번째 객체를 반환 (제거하지 않음) |
| `Object remove()` | 첫 번째 객체를 꺼냄 (비어있으면 예외) |
| `boolean add(Object o)` | 객체 저장 (실패 시 예외) |

```java
// Queue는 인터페이스 → LinkedList로 구현
Queue<String> queue = new LinkedList<>();
queue.offer("A");
queue.offer("B");
queue.offer("C");

queue.peek();    // "A" (제거 안 함)
queue.poll();    // "A" (제거)
queue.poll();    // "B"
```

**활용 예:** 인쇄 대기열, 버퍼, 최근 사용 문서

{{< callout type="info" >}}
**자료구조와 컬렉션의 대응:** Stack은 `ArrayList` 같은 배열 기반이 적합하고 (순차 추가/삭제), Queue는 `LinkedList`가 적합하다 (앞에서 삭제가 빈번).
{{< /callout >}}

### 4.3 PriorityQueue

저장 순서와 관계없이 **우선순위가 높은 것부터** 꺼낸다. 내부적으로 힙(heap) 자료구조를 사용한다.

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(3);
pq.offer(1);
pq.offer(2);

pq.poll();   // 1 (가장 작은 값)
pq.poll();   // 2
pq.poll();   // 3
```

### 4.4 Deque (Double-Ended Queue)

양쪽 끝에서 추가/삭제가 가능하다. 스택으로도 큐로도 사용할 수 있다.

| Deque | Queue | Stack |
|:------|:------|:------|
| `offerLast()` | `offer()` | `push()` |
| `pollFirst()` | `poll()` | - |
| `pollLast()` | - | `pop()` |
| `peekFirst()` | `peek()` | - |
| `peekLast()` | - | `peek()` |

```java
Deque<String> deque = new ArrayDeque<>();
deque.offerFirst("A");  // 앞에 추가
deque.offerLast("B");   // 뒤에 추가
deque.pollFirst();      // 앞에서 꺼냄 → "A"
deque.pollLast();       // 뒤에서 꺼냄 → "B"
```

---

## 5. Iterator

컬렉션에 저장된 요소를 읽어오는 방법을 표준화한 인터페이스이다.

### 5.1 Iterator 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `boolean hasNext()` | 읽어올 요소가 남아있는지 확인 |
| `Object next()` | 다음 요소를 반환 |
| `void remove()` | `next()`로 읽은 요소를 삭제 |

```java
List<String> list = new ArrayList<>();
list.add("A");
list.add("B");
list.add("C");

Iterator<String> it = list.iterator();
while (it.hasNext()) {
    String s = it.next();
    System.out.println(s);
}
```

### 5.2 Map에서 Iterator 사용

Map은 `iterator()`를 직접 호출할 수 없다. `keySet()`, `entrySet()` 등을 통해 Set을 얻은 후 사용한다.

```java
Map<String, Integer> map = new HashMap<>();
map.put("Java", 1);
map.put("Python", 2);

// 방법 1: keySet()
Iterator<String> it = map.keySet().iterator();
while (it.hasNext()) {
    String key = it.next();
    System.out.println(key + "=" + map.get(key));
}

// 방법 2: entrySet()
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + "=" + entry.getValue());
}
```

### 5.3 ListIterator

Iterator에 **양방향 이동** 기능을 추가한 인터페이스이다. `List` 구현체에서만 사용 가능하다.

| 메서드 | 설명 |
|:-------|:-----|
| `boolean hasPrevious()` | 이전 요소 존재 여부 |
| `Object previous()` | 이전 요소 반환 |
| `int nextIndex()` | 다음 요소의 인덱스 |
| `int previousIndex()` | 이전 요소의 인덱스 |
| `void set(Object o)` | 읽어온 요소를 변경 |
| `void add(Object o)` | 요소 추가 |

```java
ListIterator<String> li = list.listIterator();

// 정방향
while (li.hasNext()) {
    System.out.println(li.next());
}
// 역방향
while (li.hasPrevious()) {
    System.out.println(li.previous());
}
```

---

## 6. Arrays

배열을 다루는 유틸리티 클래스이다. 모든 메서드가 `static`이다.

### 6.1 주요 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `copyOf(arr, length)` | 배열 전체 복사 |
| `copyOfRange(arr, from, to)` | 범위 복사 |
| `fill(arr, value)` | 모든 요소를 지정 값으로 채움 |
| `sort(arr)` | 정렬 |
| `binarySearch(arr, key)` | 이진 검색 (정렬 필수) |
| `equals(arr1, arr2)` | 1차원 배열 비교 |
| `deepEquals(arr1, arr2)` | 다차원 배열 비교 |
| `toString(arr)` | 배열을 문자열로 출력 |
| `deepToString(arr)` | 다차원 배열 문자열 출력 |
| `asList(arr)` | 배열을 List로 변환 |

```java
int[] arr = {3, 1, 4, 1, 5};

// 정렬
Arrays.sort(arr);                     // [1, 1, 3, 4, 5]

// 이진 검색 (정렬 후 사용)
int idx = Arrays.binarySearch(arr, 3); // 2

// 출력
System.out.println(Arrays.toString(arr));  // [1, 1, 3, 4, 5]

// 복사
int[] copy = Arrays.copyOf(arr, 3);   // [1, 1, 3]

// 채우기
Arrays.fill(arr, 0);                  // [0, 0, 0, 0, 0]
```

### 6.2 asList 주의점

```java
// asList()가 반환한 List는 크기 변경 불가
List<Integer> fixed = Arrays.asList(1, 2, 3);
// fixed.add(4);  // UnsupportedOperationException!
fixed.set(0, 10); // 값 변경은 가능

// 크기 변경 가능한 List가 필요하면 새 ArrayList로 감싸기
List<Integer> mutable = new ArrayList<>(Arrays.asList(1, 2, 3));
mutable.add(4);  // OK
```

### 6.3 이진 검색의 원리

```
정렬된 배열: [1, 3, 5, 7, 9, 11, 13]

7을 찾는 과정:
1회차: 중간값 7 == 7 → 찾음!

2를 찾는 과정:
1회차: 중간값 7 > 2 → 왼쪽 절반
2회차: 중간값 3 > 2 → 왼쪽 절반
3회차: 중간값 1 < 2 → 오른쪽 → 없음
```

- 매 비교마다 검색 범위가 절반으로 줄어든다
- 배열 길이가 10배 늘어나도 비교 횟수는 3~4회만 증가

{{< callout type="warning" >}}
**binarySearch()는 반드시 정렬된 배열에만 사용해야 한다.** 정렬되지 않은 배열에서는 올바른 결과를 얻을 수 없다.
{{< /callout >}}

---

## 7. Comparator와 Comparable

컬렉션의 정렬 기준을 정의하는 인터페이스이다.

### 7.1 두 인터페이스의 차이

| 항목 | Comparable | Comparator |
|:-----|:-----------|:-----------|
| 패키지 | `java.lang` | `java.util` |
| 메서드 | `compareTo(Object o)` | `compare(Object o1, Object o2)` |
| 용도 | **기본** 정렬 기준 정의 | **다른** 정렬 기준 정의 |
| 구현 위치 | 정렬 대상 클래스 내부 | 별도의 Comparator 클래스 |

### 7.2 Comparable 구현

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
        // 점수 오름차순 (작은 것이 앞)
        return this.score - other.score;
    }
}

List<Student> students = new ArrayList<>();
students.add(new Student("Kim", 85));
students.add(new Student("Lee", 92));
students.add(new Student("Park", 78));

Collections.sort(students);  // 78, 85, 92 순
```

### 7.3 Comparator 활용

기본 정렬 기준이 아닌 다른 기준으로 정렬하고 싶을 때 사용한다.

```java
// 이름 기준 정렬
Comparator<Student> byName = (s1, s2) ->
    s1.name.compareTo(s2.name);

// 점수 내림차순 정렬
Comparator<Student> byScoreDesc = (s1, s2) ->
    s2.score - s1.score;

Collections.sort(students, byName);       // 이름 순
Collections.sort(students, byScoreDesc);  // 점수 역순
```

### 7.4 String 정렬

```java
String[] arr = {"cat", "Dog", "lion", "tiger"};

// 기본 정렬: 유니코드 순서 (대문자 < 소문자)
Arrays.sort(arr);
// [Dog, cat, lion, tiger]

// 대소문자 무시 정렬
Arrays.sort(arr, String.CASE_INSENSITIVE_ORDER);
// [cat, Dog, lion, tiger]

// 역순 정렬
Arrays.sort(arr, Collections.reverseOrder());
// [tiger, lion, cat, Dog]
```

{{< callout type="info" >}}
**반환값의 의미:** `compareTo()`, `compare()` 모두 음수(작다), 0(같다), 양수(크다)를 반환한다. 내림차순은 결과에 -1을 곱하거나 비교 순서를 바꾸면 된다.
{{< /callout >}}

---

## 8. HashSet

`Set` 인터페이스를 구현한 대표적인 컬렉션이다. 내부적으로 `HashMap`을 사용한다.

### 8.1 특징

- **중복을 허용하지 않는다**
- **저장 순서를 유지하지 않는다** (순서 유지가 필요하면 `LinkedHashSet`)
- `null`을 저장할 수 있다

```java
Set<String> set = new HashSet<>();
set.add("Java");
set.add("Python");
set.add("Java");      // 중복 → false 반환, 추가 안 됨
set.add(null);        // null 저장 가능

System.out.println(set.size());  // 3
System.out.println(set);         // 순서 보장 안 됨
```

### 8.2 중복 판단: equals()와 hashCode()

HashSet은 `add()` 시 `hashCode()` → `equals()` 순서로 중복을 판단한다.

```
새 객체 추가 시:
1. hashCode() 호출 → 해시코드 비교
2. 같은 해시코드가 있으면
   → equals() 호출 → true면 중복
3. 해시코드가 다르면 → 새 객체로 저장
```

```java
class Person {
    String name;
    int age;

    Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    // equals()와 hashCode() 반드시 오버라이딩
    @Override
    public boolean equals(Object obj) {
        if (obj instanceof Person) {
            Person p = (Person) obj;
            return name.equals(p.name) && age == p.age;
        }
        return false;
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, age);
    }
}

Set<Person> set = new HashSet<>();
set.add(new Person("Kim", 25));
set.add(new Person("Kim", 25));  // 중복 → 추가 안 됨
System.out.println(set.size());   // 1
```

{{< callout type="warning" >}}
**equals()와 hashCode()는 반드시 함께 오버라이딩해야 한다.** `equals()`가 true인 두 객체는 반드시 같은 `hashCode()`를 반환해야 한다. 그렇지 않으면 HashSet에서 같은 객체를 중복 저장할 수 있다.
{{< /callout >}}

### 8.3 집합 연산

```java
Set<Integer> setA = new HashSet<>(Arrays.asList(1, 2, 3, 4));
Set<Integer> setB = new HashSet<>(Arrays.asList(3, 4, 5, 6));

// 교집합
Set<Integer> intersection = new HashSet<>(setA);
intersection.retainAll(setB);     // [3, 4]

// 합집합
Set<Integer> union = new HashSet<>(setA);
union.addAll(setB);               // [1, 2, 3, 4, 5, 6]

// 차집합
Set<Integer> diff = new HashSet<>(setA);
diff.removeAll(setB);             // [1, 2]
```

---

## 9. TreeSet

**이진 검색 트리(레드-블랙 트리)** 로 데이터를 저장하는 Set이다. 정렬, 검색, 범위 검색에 뛰어나다.

### 9.1 이진 검색 트리의 구조

```
        7
      /   \
    3       9
   / \     / \
  1   5   8   11

저장 규칙:
- 왼쪽 자식 < 부모 < 오른쪽 자식
- 중위순회(inorder)하면 정렬된 결과
  → 1, 3, 5, 7, 8, 9, 11
```

### 9.2 특징

- 저장 시 자동으로 정렬 위치에 삽입된다
- 중복을 허용하지 않는다
- 저장되는 객체는 `Comparable`을 구현하거나 `Comparator`를 제공해야 한다

### 9.3 범위 검색

| 메서드 | 설명 |
|:-------|:-----|
| `headSet(Object o)` | 지정 값보다 작은 객체들 반환 |
| `tailSet(Object o)` | 지정 값보다 크거나 같은 객체들 반환 |
| `subSet(Object from, Object to)` | 범위 내 객체들 반환 |
| `first()` / `last()` | 가장 작은 / 큰 값 |
| `ceiling(Object o)` | 지정 값 이상인 가장 가까운 값 |
| `floor(Object o)` | 지정 값 이하인 가장 가까운 값 |

```java
TreeSet<Integer> set = new TreeSet<>();
set.add(10); set.add(30); set.add(50);
set.add(20); set.add(40);

System.out.println(set);             // [10, 20, 30, 40, 50]
System.out.println(set.headSet(30)); // [10, 20]
System.out.println(set.tailSet(30)); // [30, 40, 50]
System.out.println(set.subSet(20, 40)); // [20, 30]
System.out.println(set.first());     // 10
System.out.println(set.last());      // 50
```

| 항목 | HashSet | TreeSet |
|:-----|:--------|:--------|
| 정렬 | 안 됨 | 자동 정렬 |
| 검색 속도 | O(1) | O(log n) |
| 범위 검색 | 불가 | 가능 |
| 내부 구조 | 해시 테이블 | 레드-블랙 트리 |

---

## 10. HashMap

**키(key)와 값(value)의 쌍**으로 데이터를 저장한다. 해싱을 사용하여 검색 성능이 뛰어나다.

### 10.1 특징

- 키는 중복 불가, 값은 중복 허용
- 중복 키로 `put()` 하면 기존 값을 덮어쓴다
- `null` 키와 `null` 값 모두 허용한다 (`Hashtable`은 불허)
- 저장 순서를 유지하지 않는다 (순서 유지가 필요하면 `LinkedHashMap`)

```java
Map<String, Integer> map = new HashMap<>();

// 저장
map.put("Java", 1);
map.put("Python", 2);
map.put("Java", 10);     // 기존 값 1 → 10으로 덮어쓰기

// 조회
int val = map.get("Java");            // 10
boolean hasKey = map.containsKey("Java");   // true
boolean hasVal = map.containsValue(2);      // true

// 기본값 지정 조회
int score = map.getOrDefault("C++", 0);     // 0

// 삭제
map.remove("Python");

// 전체 순회
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + " = " + entry.getValue());
}
```

### 10.2 해싱의 원리

```
키 "Java"
    │
    ▼
hashCode() → 해시코드 → 배열 인덱스
                            │
    ┌───────────────────────┘
    ▼
배열: [0][ ][ ][3][ ][ ][ ]
                │
                ▼
          [Java=10] → [Go=3]  ← 링크드 리스트
```

1. 키의 `hashCode()`로 해시코드를 생성한다
2. 해시코드를 배열의 인덱스로 변환한다
3. 해당 인덱스의 링크드 리스트에 저장한다
4. 검색 시 같은 과정으로 위치를 찾아 `equals()`로 비교한다

{{< callout type="info" >}}
**해시 충돌:** 서로 다른 키가 같은 해시코드를 가지면 같은 링크드 리스트에 저장된다. 링크드 리스트가 길어질수록 검색 성능이 저하되므로 좋은 해시함수가 중요하다. Java 8부터는 링크드 리스트가 일정 크기(8)를 넘으면 트리로 변환하여 성능을 개선한다.
{{< /callout >}}

### 10.3 HashMap vs TreeMap

| 항목 | HashMap | TreeMap |
|:-----|:--------|:--------|
| 검색 속도 | **O(1)** | O(log n) |
| 정렬 | 안 됨 | 키 기준 자동 정렬 |
| 범위 검색 | 불가 | 가능 |
| 대부분의 경우 | **권장** | 정렬/범위 검색 필요 시 |

---

## 11. Properties

`(String, String)` 형태로 저장하는 단순화된 Map이다. 주로 **환경 설정 파일** 읽기/쓰기에 사용한다.

```java
// 설정 파일 읽기
Properties prop = new Properties();
prop.load(new FileInputStream("config.properties"));

String host = prop.getProperty("db.host");
String port = prop.getProperty("db.port", "3306");  // 기본값

// 설정 파일 쓰기
prop.setProperty("db.host", "localhost");
prop.store(new FileOutputStream("config.properties"),
           "DB Configuration");

// 시스템 속성 읽기
Properties sysProp = System.getProperties();
System.out.println(sysProp.getProperty("java.version"));
System.out.println(sysProp.getProperty("os.name"));
```

---

## 12. Collections 유틸리티

`java.util.Collections` 클래스는 컬렉션 관련 유틸리티 메서드를 제공한다.

### 12.1 정렬과 검색

```java
List<Integer> list = new ArrayList<>(Arrays.asList(3, 1, 4, 1, 5));

Collections.sort(list);                    // 오름차순 정렬
Collections.sort(list, Collections.reverseOrder()); // 내림차순
Collections.shuffle(list);                 // 무작위 섞기
Collections.reverse(list);                 // 순서 뒤집기
Collections.swap(list, 0, 1);             // 위치 교환

int max = Collections.max(list);
int min = Collections.min(list);
int freq = Collections.frequency(list, 1); // 1의 등장 횟수
```

### 12.2 동기화 컬렉션

멀티 쓰레드 환경에서 안전하게 사용할 수 있도록 동기화된 컬렉션을 반환한다.

```java
List<String> syncList = Collections.synchronizedList(new ArrayList<>());
Map<String, Integer> syncMap = Collections.synchronizedMap(new HashMap<>());
Set<String> syncSet = Collections.synchronizedSet(new HashSet<>());
```

### 12.3 불변 컬렉션

읽기 전용으로 만들어 데이터를 보호한다.

```java
List<String> unmodList = Collections.unmodifiableList(list);
// unmodList.add("X");  // UnsupportedOperationException!

// Java 9+ 팩토리 메서드
List<String> immutable = List.of("A", "B", "C");
Map<String, Integer> immutableMap = Map.of("A", 1, "B", 2);
Set<Integer> immutableSet = Set.of(1, 2, 3);
```

### 12.4 타입 제한 컬렉션

```java
List<String> checked = Collections.checkedList(
    new ArrayList<>(), String.class);
checked.add("OK");
// checked.add(123);  // ClassCastException!
```

---

## 13. 요약

### 컬렉션 선택 가이드

```
순서 유지 + 중복 허용 + 빠른 조회
  └→ ArrayList

순서 유지 + 중복 허용 + 잦은 삽입/삭제
  └→ LinkedList

중복 제거
  └→ HashSet (순서 불필요)
  └→ LinkedHashSet (순서 유지)
  └→ TreeSet (정렬 필요)

키-값 매핑 + 빠른 검색
  └→ HashMap (대부분의 경우)
  └→ LinkedHashMap (순서 유지)
  └→ TreeMap (정렬/범위 검색)

LIFO 구조
  └→ Stack 또는 Deque

FIFO 구조
  └→ Queue (LinkedList)

우선순위 처리
  └→ PriorityQueue
```

### 컬렉션 클래스 특성 비교

| 컬렉션 | 기반 | 장점 | 단점 |
|:-------|:-----|:-----|:-----|
| `ArrayList` | 배열 | 조회 빠름, 순차 추가/삭제 빠름 | 중간 추가/삭제 느림 |
| `LinkedList` | 노드 연결 | 중간 추가/삭제 빠름 | 조회 느림 |
| `HashMap` | 배열+링크드 리스트 | 추가/삭제/검색 모두 빠름 | 순서 없음 |
| `TreeMap` | 레드-블랙 트리 | 정렬/범위 검색 유리 | HashMap보다 검색 느림 |
| `HashSet` | HashMap 이용 | 중복 제거, 빠른 검색 | 순서 없음 |
| `TreeSet` | TreeMap 이용 | 정렬/범위 검색 유리 | HashSet보다 느림 |
| `Stack` | Vector 상속 | LIFO | Vector 기반 (레거시) |
| `Properties` | Hashtable 상속 | 설정 파일 읽기/쓰기 편리 | String만 저장 |

### 컬렉션 클래스 전체 상속 도식도

```
Iterable
  └── Collection
        ├── List
        │     ├── ArrayList
        │     ├── LinkedList ──┐
        │     └── Vector       │
        │           └── Stack  │
        │                      │
        ├── Set                │
        │     ├── HashSet      │
        │     │    └── LinkedHashSet
        │     └── TreeSet      │
        │                      │
        └── Queue ◀────────────┘
              │      (LinkedList가
              │       Queue도 구현)
              ├── PriorityQueue
              └── Deque
                    └── ArrayDeque


Map (Collection과 별도 계층)
  ├── HashMap
  │     └── LinkedHashMap
  ├── TreeMap
  └── Hashtable
        └── Properties
```

```
구현 관계 정리:

HashSet  ── 내부에서 ──▶ HashMap 사용
TreeSet  ── 내부에서 ──▶ TreeMap 사용
Stack    ── 상속 ──────▶ Vector
Properties ─ 상속 ─────▶ Hashtable
```

```
인터페이스별 핵심 구현 클래스:

┌─────────┬──────────────────────┐
│  List   │ ArrayList LinkedList │
├─────────┼──────────────────────┤
│  Set    │ HashSet   TreeSet    │
├─────────┼──────────────────────┤
│  Map    │ HashMap   TreeMap    │
├─────────┼──────────────────────┤
│  Queue  │ LinkedList           │
│         │ PriorityQueue        │
├─────────┼──────────────────────┤
│  Deque  │ ArrayDeque           │
│         │ LinkedList           │
└─────────┴──────────────────────┘
```
