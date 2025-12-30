---
title: "Chapter 04. 스트림 소개"
weight: 4
---

## 1. 스트림이란 무엇인가?

> **스트림(Stream)**: 데이터 처리 연산을 지원하도록 소스에서 추출된 연속된 요소

Java 8에서 추가된 스트림을 이용하면 **선언형**으로 컬렉션 데이터를 처리할 수 있다. 또한 멀티스레드 코드를 구현하지 않아도 데이터를 **투명하게 병렬로 처리**할 수 있다.

### 기존 방식 vs 스트림

**기존 방식 (Java 7 이전):**

```java
// 400칼로리 이하 요리를 칼로리순 정렬 후 이름 추출
List<Dish> lowCaloricDishes = new ArrayList<>();
for (Dish dish : menu) {
    if (dish.getCalories() < 400) {
        lowCaloricDishes.add(dish);
    }
}
Collections.sort(lowCaloricDishes, new Comparator<Dish>() {
    public int compare(Dish d1, Dish d2) {
        return Integer.compare(d1.getCalories(), d2.getCalories());
    }
});
List<String> lowCaloricDishNames = new ArrayList<>();
for (Dish dish : lowCaloricDishes) {
    lowCaloricDishNames.add(dish.getName());
}
```

- `lowCaloricDishes`는 **가비지 변수** (컨테이너 역할만 하는 중간 변수)
- 코드가 장황하고 의도 파악이 어려움

**스트림 방식 (Java 8+):**

```java
import static java.util.Comparator.comparing;
import static java.util.stream.Collectors.toList;

List<String> lowCaloricDishNames =
    menu.stream()
        .filter(d -> d.getCalories() < 400)    // 400칼로리 이하 필터링
        .sorted(comparing(Dish::getCalories))  // 칼로리순 정렬
        .map(Dish::getName)                    // 요리명 추출
        .collect(toList());                    // 리스트로 수집
```

- 선언형으로 **무엇을** 할지 표현
- 가비지 변수 불필요
- 파이프라인으로 연결

### 병렬 처리

```java
// stream()을 parallelStream()으로 변경하면 자동 병렬화
List<String> lowCaloricDishNames =
    menu.parallelStream()
        .filter(d -> d.getCalories() < 400)
        .sorted(comparing(Dish::getCalories))
        .map(Dish::getName)
        .collect(toList());
```

### 스트림 API의 장점

| 장점 | 설명 |
|------|------|
| **선언형** | 루프/조건문 없이 동작을 선언적으로 표현 → 간결하고 가독성 향상 |
| **조립 가능** | 빌딩 블록 연산을 연결해 복잡한 파이프라인 구성 → 유연성 향상 |
| **병렬화** | `parallelStream()`으로 쉽게 병렬 처리 → 성능 향상 |

---

## 2. 스트림의 정의와 특징

### 스트림의 구성 요소

| 요소 | 설명 |
|------|------|
| **연속된 요소** | 특정 요소 형식으로 이루어진 연속된 값 집합 인터페이스 |
| **소스** | 컬렉션, 배열, I/O 자원 등 데이터 제공 소스 |
| **데이터 처리 연산** | filter, map, reduce, find, match, sort 등 |

### 컬렉션 vs 스트림

| 구분 | 컬렉션 | 스트림 |
|------|--------|--------|
| **주제** | 데이터 (자료구조) | 계산 (표현 계산식) |
| **주요 관심사** | 요소 저장 및 접근 | filter, sorted, map 등 연산 |
| **계산 시점** | 모든 요소가 미리 계산됨 | 요청할 때 계산 (지연 계산) |

### 스트림의 두 가지 중요 특징

**1. 파이프라이닝 (Pipelining)**

```java
List<String> names = menu.stream()
    .filter(d -> d.getCalories() > 300)  // Stream<Dish> 반환
    .map(Dish::getName)                   // Stream<String> 반환
    .limit(3)                             // Stream<String> 반환
    .collect(toList());                   // List<String> 반환
```

- 스트림 연산은 스트림을 반환 → 연산끼리 연결 가능
- **게으름(Laziness)**, **쇼트서킷(Short-circuiting)** 최적화 가능

**2. 내부 반복 (Internal Iteration)**

- 컬렉션: 사용자가 직접 반복 (외부 반복)
- 스트림: 라이브러리가 반복 처리 (내부 반복)

---

## 3. 스트림 연산 메서드

### 주요 연산

| 연산 | 역할 |
|------|------|
| `filter` | 람다를 인수로 받아 특정 요소를 제외 |
| `map` | 요소를 다른 요소로 변환하거나 정보를 추출 |
| `limit` | 스트림 크기를 지정된 개수로 축소 |
| `collect` | 스트림을 다른 형식으로 변환 |

```java
List<String> threeHighCaloricDishNames =
    menu.stream()                              // 스트림 얻기
        .filter(dish -> dish.getCalories() > 300)  // 고칼로리 필터링
        .map(Dish::getName)                    // 요리명 추출
        .limit(3)                              // 3개만 선택
        .collect(toList());                    // 리스트로 수집
```

---

## 4. 스트림과 컬렉션의 차이

### 계산 시점의 차이

| 구분 | 컬렉션 | 스트림 |
|------|--------|--------|
| **계산 방식** | 적극적 생성 (Eager) | 게으른 생성 (Lazy) |
| **메모리** | 모든 값을 메모리에 저장 | 요청할 때만 계산 |
| **생성 시점** | 추가 전 모든 요소 계산 필요 | 요청 시 요소 계산 |

```
컬렉션: 특정 시간에 모든 것이 존재하는 공간 (DVD)
스트림: 시간적으로 흩어진 값의 집합 (인터넷 스트리밍)
```

### 단 한 번만 탐색

```java
List<String> title = Arrays.asList("Java8", "In", "Action");
Stream<String> s = title.stream();
s.forEach(System.out::println);  // 정상 실행
s.forEach(System.out::println);  // IllegalStateException 발생!
```

{{< callout type="warning" >}}
**스트림은 단 한 번만 소비**할 수 있다. 다시 탐색하려면 새로운 스트림을 생성해야 한다.
{{< /callout >}}

### 외부 반복 vs 내부 반복

**외부 반복 (컬렉션):**

```java
// for-each 사용
List<String> names = new ArrayList<>();
for (Dish dish : menu) {
    names.add(dish.getName());
}

// Iterator 사용
List<String> names = new ArrayList<>();
Iterator<Dish> iterator = menu.iterator();
while (iterator.hasNext()) {
    Dish dish = iterator.next();
    names.add(dish.getName());
}
```

**내부 반복 (스트림):**

```java
List<String> names = menu.stream()
    .map(Dish::getName)
    .collect(toList());
```

| 구분 | 외부 반복 | 내부 반복 |
|------|----------|----------|
| **제어** | 사용자가 직접 반복 제어 | 라이브러리가 반복 처리 |
| **병렬화** | 직접 구현 필요 | 자동 최적화 가능 |
| **최적화** | 제한적 | 데이터 표현과 하드웨어 활용 자동 선택 |

---

## 5. 스트림 연산의 종류

### 중간 연산과 최종 연산

```java
List<String> names = menu.stream()
    .filter(dish -> dish.getCalories() > 300)  // 중간 연산
    .map(Dish::getName)                         // 중간 연산
    .limit(3)                                   // 중간 연산
    .collect(toList());                         // 최종 연산
```

| 구분 | 중간 연산 | 최종 연산 |
|------|----------|----------|
| **반환 타입** | Stream | Stream 이외 (List, Integer, void 등) |
| **역할** | 파이프라인 구성 | 파이프라인 실행 및 결과 도출 |
| **실행 시점** | 최종 연산 호출 전까지 실행 안 함 | 호출 시 전체 파이프라인 실행 |
| **특성** | 게으름 (Lazy) | 즉시 실행 (Eager) |

### 중간 연산의 게으른 특성

```java
List<String> names = menu.stream()
    .filter(dish -> {
        System.out.println("filtering: " + dish.getName());
        return dish.getCalories() > 300;
    })
    .map(dish -> {
        System.out.println("mapping: " + dish.getName());
        return dish.getName();
    })
    .limit(3)
    .collect(toList());

// 출력:
// filtering: pork
// mapping: pork
// filtering: beef
// mapping: beef
// filtering: chicken
// mapping: chicken
```

**최적화 기법:**

| 기법 | 설명 |
|------|------|
| **쇼트서킷** | limit(3)으로 인해 처음 3개만 처리하고 중단 |
| **루프 퓨전** | filter와 map이 한 과정으로 병합되어 처리 |

### 중간 연산 목록

| 연산 | 반환 타입 | 인수 | 함수 디스크립터 |
|------|----------|------|----------------|
| `filter` | `Stream<T>` | `Predicate<T>` | `T -> boolean` |
| `map` | `Stream<R>` | `Function<T, R>` | `T -> R` |
| `limit` | `Stream<T>` | | |
| `sorted` | `Stream<T>` | `Comparator<T>` | `(T, T) -> int` |
| `distinct` | `Stream<T>` | | |
| `skip` | `Stream<T>` | `long` | |
| `flatMap` | `Stream<R>` | `Function<T, Stream<R>>` | `T -> Stream<R>` |

### 최종 연산 목록

| 연산 | 반환 타입 | 목적 |
|------|----------|------|
| `forEach` | `void` | 각 요소를 소비하며 람다 적용 |
| `count` | `long` | 요소 개수 반환 |
| `collect` | `Collection` | 스트림을 컬렉션으로 변환 |
| `reduce` | `Optional<T>` | 모든 요소를 하나로 리듀스 |
| `anyMatch` | `boolean` | 하나라도 일치하는지 검사 |
| `allMatch` | `boolean` | 모두 일치하는지 검사 |
| `noneMatch` | `boolean` | 모두 일치하지 않는지 검사 |
| `findFirst` | `Optional<T>` | 첫 번째 요소 반환 |
| `findAny` | `Optional<T>` | 임의의 요소 반환 |

---

## 6. 스트림 이용 과정

### 3단계 프로세스

```
1. 데이터 소스 (질의를 수행할 컬렉션)
       ↓
2. 중간 연산 체인 (파이프라인 구성)
       ↓
3. 최종 연산 (파이프라인 실행 및 결과 생성)
```

```java
List<String> result = menu.stream()          // 1. 데이터 소스
    .filter(d -> d.getCalories() > 300)      // 2. 중간 연산
    .map(Dish::getName)                       // 2. 중간 연산
    .limit(3)                                 // 2. 중간 연산
    .collect(toList());                       // 3. 최종 연산
```

### 빌더 패턴과의 유사성

| 빌더 패턴 | 스트림 |
|----------|--------|
| 설정 메서드 체이닝 | 중간 연산 체이닝 |
| `build()` 호출 | 최종 연산 호출 |

```java
// 빌더 패턴
Pizza pizza = Pizza.builder()
    .size("large")
    .topping("cheese")
    .topping("pepperoni")
    .build();  // 최종 생성

// 스트림
List<String> names = menu.stream()
    .filter(d -> d.getCalories() > 300)
    .map(Dish::getName)
    .collect(toList());  // 최종 실행
```

---

## 7. 정리

| 개념 | 설명 |
|------|------|
| **스트림** | 소스에서 추출된 연속 요소로, 데이터 처리 연산 지원 |
| **내부 반복** | filter, map, sorted 등으로 반복을 추상화 |
| **중간 연산** | 스트림을 반환하며 파이프라인 구성 (filter, map, sorted) |
| **최종 연산** | 스트림이 아닌 결과 반환 (forEach, count, collect) |
| **게으른 계산** | 최종 연산 호출 전까지 중간 연산 실행 안 함 |

{{< callout type="info" >}}
**핵심 포인트:**
- 스트림은 **선언형**으로 데이터를 처리하는 파이프라인
- **중간 연산**은 게으르게 실행되고, **최종 연산**이 파이프라인을 실행
- 내부 반복으로 **병렬화**와 **최적화**를 자동으로 처리
- 스트림은 **단 한 번만 소비** 가능
{{< /callout >}}
