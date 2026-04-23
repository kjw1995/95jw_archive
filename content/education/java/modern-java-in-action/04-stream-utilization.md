---
title: "Chapter 05. 스트림 활용"
weight: 5
---

## 1. 필터링

### filter — 프레디케이트로 필터링

`filter`는 `Predicate<T>`(불리언 반환 함수)를 인수로 받아 조건에 일치하는 요소만 포함하는 새 스트림을 반환한다.

```java
// 채식 요리만 필터링
List<Dish> vegetarianDishes = menu.stream()
    .filter(Dish::isVegetarian)
    .collect(toList());
```

> **동작 원리:** 스트림의 각 요소에 프레디케이트를 적용해 `true`를 반환하는 요소만 통과시킨다. 내부적으로 전체 스트림을 순회한다.

### distinct — 고유 요소 필터링

`distinct`는 중복을 제거한 스트림을 반환한다. 고유 여부는 `hashCode()`와 `equals()`로 판단한다.

```java
List<Integer> numbers = Arrays.asList(1, 2, 1, 3, 3, 2, 4);
numbers.stream()
    .filter(i -> i % 2 == 0)  // 짝수 필터링
    .distinct()                // 중복 제거
    .forEach(System.out::println);  // 2, 4
```

{{< callout type="warning" >}}
**커스텀 객체에 distinct를 사용할 때는 반드시 `hashCode()`와 `equals()`를 오버라이드해야 한다.** 그렇지 않으면 객체의 참조값으로 비교하므로 논리적으로 같은 객체도 중복 제거되지 않는다.
{{< /callout >}}

---

## 2. 스트림 슬라이싱

### takeWhile — 조건이 거짓이 되면 중단 (Java 9+)

**정렬된 데이터**에서 조건을 만족하는 앞쪽 요소만 가져올 때 사용한다. `filter`와 달리 조건이 처음으로 `false`가 되는 순간 즉시 중단한다.

```java
List<Dish> specialMenu = Arrays.asList(
    new Dish("seasonal fruit", true, 120, Dish.Type.OTHER),
    new Dish("prawns", false, 300, Dish.Type.FISH),
    new Dish("rice", true, 350, Dish.Type.OTHER),
    new Dish("chicken", false, 400, Dish.Type.MEAT),
    new Dish("french fries", true, 530, Dish.Type.OTHER)
);
```

```java
// filter: 전체를 순회하며 조건 검사 (5개 요소 모두 검사)
List<Dish> filtered = specialMenu.stream()
    .filter(dish -> dish.getCalories() < 320)
    .collect(toList());  // [seasonal fruit, prawns]

// takeWhile: 조건이 거짓이 되면 즉시 중단 (3번째에서 중단)
List<Dish> sliced = specialMenu.stream()
    .takeWhile(dish -> dish.getCalories() < 320)
    .collect(toList());  // [seasonal fruit, prawns]
```

**filter vs takeWhile 동작 비교:**

```
데이터: 120, 300, 350, 400, 530
조건:   < 320

filter     → 120 ✓ 300 ✓ 350 ✗ 400 ✗ 530 ✗ → 전체 순회
takeWhile  → 120 ✓ 300 ✓ 350 ✗(중단)        → 조기 종료
```

> 두 연산의 결과가 같더라도 **큰 데이터셋에서 takeWhile이 훨씬 효율적**이다. 단, 데이터가 정렬되어 있어야 의도한 대로 동작한다.

### dropWhile — takeWhile의 반대 (Java 9+)

프레디케이트가 처음으로 `false`가 되는 지점까지 요소를 버리고, 나머지를 반환한다.

```java
// 320칼로리 이상인 요리들
List<Dish> sliced = specialMenu.stream()
    .dropWhile(dish -> dish.getCalories() < 320)
    .collect(toList());  // [rice, chicken, french fries]
```

```
takeWhile: 조건이 참인 앞쪽 요소를 가져옴
dropWhile: 조건이 참인 앞쪽 요소를 버림
→ 서로 상호 보완적
```

### limit — 스트림 축소

`limit(n)`은 최대 n개 요소를 가진 새 스트림을 반환한다.

```java
// 300칼로리 초과 요리 중 처음 3개만 선택
List<Dish> dishes = menu.stream()
    .filter(d -> d.getCalories() > 300)
    .limit(3)
    .collect(toList());
```

### skip — 요소 건너뛰기

`skip(n)`은 처음 n개 요소를 건너뛴 나머지 스트림을 반환한다.

```java
// 300칼로리 초과 요리 중 처음 2개를 건너뛰고 나머지 선택
List<Dish> dishes = menu.stream()
    .filter(d -> d.getCalories() > 300)
    .skip(2)
    .collect(toList());
```

> **limit(n)과 skip(n)은 상호 보완적 연산**이다. 페이지네이션 구현에 함께 활용된다.

```java
// 페이지네이션 예시: 페이지당 10건, 3페이지 조회
int pageSize = 10;
int page = 3;
List<Dish> pageResult = menu.stream()
    .skip((long) (page - 1) * pageSize)
    .limit(pageSize)
    .collect(toList());
```

---

## 3. 매핑

### map — 각 요소에 함수 적용

`map`은 함수를 인수로 받아 각 요소를 새로운 요소로 **변환(매핑)** 한다. 기존 값을 수정하는 것이 아니라 **새로운 값을 만드는** 개념이다.

```java
// 요리명 추출
List<String> dishNames = menu.stream()
    .map(Dish::getName)
    .collect(toList());

// 단어 길이 추출
List<String> words = Arrays.asList("Modern", "Java", "In", "Action");
List<Integer> wordLengths = words.stream()
    .map(String::length)
    .collect(toList());  // [6, 4, 2, 6]
```

**map 체이닝:**

```java
// 요리명의 글자 수 추출
List<Integer> dishNameLengths = menu.stream()
    .map(Dish::getName)      // Stream<String>
    .map(String::length)     // Stream<Integer>
    .collect(toList());
```

### flatMap — 스트림 평면화

여러 스트림을 하나의 스트림으로 합치는 연산이다.

**문제 상황:** 단어 리스트에서 고유 문자를 추출하고 싶을 때

```java
List<String> words = Arrays.asList("Hello", "World");
```

```java
// 잘못된 접근: map만 사용
words.stream()
    .map(word -> word.split(""))  // Stream<String[]>
    .distinct()
    .collect(toList());
// 결과: [["H","e","l","l","o"], ["W","o","r","l","d"]]
// String[] 단위로 비교하므로 의도와 다름
```

```java
// 올바른 접근: flatMap 사용
List<String> uniqueChars = words.stream()
    .map(word -> word.split(""))     // Stream<String[]>
    .flatMap(Arrays::stream)         // Stream<String> (평면화)
    .distinct()
    .collect(toList());
// 결과: [H, e, l, o, W, r, d]
```

**map vs flatMap 변환 과정:**

```
map(Arrays::stream):
  ["H","e","l","l","o"] → Stream<String>
  ["W","o","r","l","d"] → Stream<String>
  결과: Stream<Stream<String>>

flatMap(Arrays::stream):
  ["H","e","l","l","o"] → H, e, l, l, o
  ["W","o","r","l","d"] → W, o, r, l, d
  결과: Stream<String> (하나로 합침)
```

> **핵심:** `flatMap`은 각 배열을 스트림이 아니라 **스트림의 콘텐츠**로 매핑한다. 즉 `Stream<Stream<T>>`를 `Stream<T>`로 평면화한다.

**flatMap 활용 예시:**

```java
// 두 숫자 리스트의 모든 조합 쌍 생성
List<Integer> numbers1 = Arrays.asList(1, 2, 3);
List<Integer> numbers2 = Arrays.asList(3, 4);

List<int[]> pairs = numbers1.stream()
    .flatMap(i -> numbers2.stream()
        .map(j -> new int[]{i, j}))
    .collect(toList());
// [(1,3), (1,4), (2,3), (2,4), (3,3), (3,4)]
```

---

## 4. 검색과 매칭

### anyMatch — 하나라도 일치하는지

```java
boolean hasVegetarian = menu.stream()
    .anyMatch(Dish::isVegetarian);  // true
```

### allMatch — 모두 일치하는지

```java
boolean isHealthy = menu.stream()
    .allMatch(dish -> dish.getCalories() < 1000);
```

### noneMatch — 모두 일치하지 않는지

```java
// allMatch의 반대
boolean isHealthy = menu.stream()
    .noneMatch(d -> d.getCalories() >= 1000);
```

> 세 메서드 모두 **최종 연산**이며 불리언을 반환한다.

### 쇼트서킷 (Short-circuit)

`anyMatch`, `allMatch`, `noneMatch`, `findFirst`, `findAny`, `limit`는 **쇼트서킷** 연산이다. 전체 스트림을 처리하지 않고도 결과를 반환할 수 있다.

```
allMatch + 하나라도 false → 즉시 false 반환
anyMatch + 하나라도 true  → 즉시 true 반환
```

> Java의 `&&`, `||` 연산자와 같은 원리다. 무한 스트림을 유한한 결과로 변환할 때 필수적인 개념이다.

### findAny — 임의의 요소 검색

```java
Optional<Dish> dish = menu.stream()
    .filter(Dish::isVegetarian)
    .findAny();
```

### findFirst — 첫 번째 요소 검색

```java
// 제곱값 중 9로 나누어떨어지는 첫 번째 값
List<Integer> someNumbers = Arrays.asList(1, 2, 3, 4, 5);
Optional<Integer> result = someNumbers.stream()
    .map(n -> n * n)
    .filter(n -> n % 3 == 0)
    .findFirst();  // Optional[9]
```

{{< callout type="info" >}}
**findFirst vs findAny:** 병렬 스트림에서는 첫 번째 요소를 찾기 어렵다. 요소의 반환 순서가 상관없다면 `findAny`가 병렬 처리에서 더 효율적이다.
{{< /callout >}}

### Optional

`Optional<T>`는 값의 존재/부재를 표현하는 컨테이너 클래스로, `null` 대신 사용한다.

| 메서드 | 설명 |
|:-------|:-----|
| `isPresent()` | 값이 있으면 `true`, 없으면 `false` |
| `ifPresent(Consumer<T>)` | 값이 있을 때만 주어진 블록 실행 |
| `get()` | 값 반환 (없으면 `NoSuchElementException`) |
| `orElse(T other)` | 값이 없으면 기본값 반환 |

```java
// Optional 활용 예시
menu.stream()
    .filter(Dish::isVegetarian)
    .findAny()
    .ifPresent(dish -> System.out.println(dish.getName()));
```

---

## 5. 리듀싱

리듀스(reduce)는 스트림의 모든 요소를 반복 조합하여 하나의 값으로 도출하는 연산이다. 함수형 프로그래밍에서는 **폴드(fold)** 라고도 부른다.

### 요소의 합

`reduce`는 두 개의 인수를 갖는다.

- **초깃값**
- **두 요소를 조합하는 `BinaryOperator<T>`**

```java
// for 루프 방식
int sum = 0;
for (int x : numbers) {
    sum += x;
}

// reduce 방식
int sum = numbers.stream().reduce(0, (a, b) -> a + b);

// 메서드 참조
int sum = numbers.stream().reduce(0, Integer::sum);
```

**reduce 동작 과정:**

```
numbers = [4, 5, 3, 9]
초깃값 = 0

0 + 4 = 4
4 + 5 = 9
9 + 3 = 12
12 + 9 = 21
```

### 초깃값 없는 reduce

초깃값이 없는 오버로드 버전은 `Optional`을 반환한다. 스트림이 비어있으면 합계를 계산할 수 없기 때문이다.

```java
Optional<Integer> sum = numbers.stream()
    .reduce((a, b) -> a + b);
```

### 최댓값과 최솟값

```java
// 최댓값
Optional<Integer> max = numbers.stream()
    .reduce(Integer::max);

// 최솟값
Optional<Integer> min = numbers.stream()
    .reduce(Integer::min);
```

{{< callout type="info" >}}
**reduce의 장점 — 병렬화:** `reduce`는 내부 반복이 추상화되어 병렬 실행이 가능하다. 반면 for 루프 방식은 `sum` 변수를 공유하므로 병렬화가 어렵다. `parallelStream()`으로 바꾸기만 하면 병렬 리듀싱이 가능하다.
{{< /callout >}}

### 상태 없는 연산 vs 상태 있는 연산

| 구분 | 연산 | 내부 상태 |
|:-----|:-----|:----------|
| **Stateless** | `map`, `filter` | 없음 — 입력 요소를 받아 0 또는 1개 결과 출력 |
| **Bounded Stateful** | `reduce`, `sum`, `max` | 있음 — 크기가 한정된 내부 상태 |
| **Unbounded Stateful** | `sorted`, `distinct` | 있음 — 모든 요소를 버퍼에 저장해야 함 |

> `sorted`, `distinct`는 과거 이력을 알아야 하므로 **데이터가 크거나 무한이면 문제가 발생**할 수 있다.

---

## 6. 숫자형 스트림

### 기본형 특화 스트림

박싱 비용을 피하기 위해 세 가지 기본형 특화 스트림을 제공한다.

| 특화 스트림 | 대상 타입 | 주요 메서드 |
|:-----------|:---------|:-----------|
| `IntStream` | `int` | `sum()`, `max()`, `min()`, `average()` |
| `DoubleStream` | `double` | `sum()`, `max()`, `min()`, `average()` |
| `LongStream` | `long` | `sum()`, `max()`, `min()`, `average()` |

### 숫자 스트림으로 매핑

```java
// Stream<Dish> → IntStream
int totalCalories = menu.stream()
    .mapToInt(Dish::getCalories)  // IntStream 반환
    .sum();                       // int 반환 (기본값 0)
```

> `Stream<Integer>`의 `reduce(0, Integer::sum)`과 달리 **언박싱 비용이 없다.**

### 객체 스트림으로 복원 — boxed()

```java
IntStream intStream = menu.stream()
    .mapToInt(Dish::getCalories);
Stream<Integer> stream = intStream.boxed();  // 다시 객체 스트림으로
```

### OptionalInt / OptionalDouble / OptionalLong

기본형 특화 Optional로, 값이 없는 상황을 안전하게 처리한다.

```java
OptionalInt maxCalories = menu.stream()
    .mapToInt(Dish::getCalories)
    .max();

int max = maxCalories.orElse(0);  // 값이 없으면 0
```

> `IntStream.sum()`은 빈 스트림에서 기본값 0을 반환하지만, `max()`/`min()`은 기본값을 정할 수 없으므로 `OptionalInt`를 반환한다.

---

## 7. 스트림 만들기

### 값으로 생성 — Stream.of

```java
Stream<String> stream = Stream.of("Modern", "Java", "In", "Action");
stream.map(String::toUpperCase)
    .forEach(System.out::println);

// 빈 스트림
Stream<String> empty = Stream.empty();
```

### null이 될 수 있는 객체 — Stream.ofNullable (Java 9+)

```java
// Java 9 이전
Stream<String> stream = System.getProperty("home") == null
    ? Stream.empty()
    : Stream.of(System.getProperty("home"));

// Java 9+
Stream<String> stream =
    Stream.ofNullable(System.getProperty("home"));
```

### 배열로 생성 — Arrays.stream

```java
int[] numbers = {2, 3, 5, 7, 11, 13};
int sum = Arrays.stream(numbers).sum();  // 41
```

### 파일로 생성 — Files.lines

```java
// 파일의 고유 단어 수 세기
long uniqueWords = 0;
try (Stream<String> lines =
        Files.lines(Paths.get("data.txt"),
            Charset.defaultCharset())) {
    uniqueWords = lines
        .flatMap(line -> Arrays.stream(line.split(" ")))
        .distinct()
        .count();
} catch (IOException e) {
    // 예외 처리
}
```

> `Stream`은 `AutoCloseable`을 구현하므로 **try-with-resources**로 자원이 자동 해제된다.

### 무한 스트림 — iterate

```java
// 0부터 시작하는 짝수 스트림
Stream.iterate(0, n -> n + 2)
    .limit(10)
    .forEach(System.out::println);
// 0, 2, 4, 6, 8, 10, 12, 14, 16, 18
```

`iterate`는 초깃값과 람다를 받아 이전 결과를 기반으로 연속적인 값을 생산한다.

```java
// Java 9: Predicate를 받는 iterate (for 루프 대체)
IntStream.iterate(0, n -> n < 100, n -> n + 4)
    .forEach(System.out::println);
```

### 무한 스트림 — generate

`generate`는 `Supplier<T>`를 받아 값을 생산한다. `iterate`와 달리 이전 값에 의존하지 않는다.

```java
Stream.generate(Math::random)
    .limit(5)
    .forEach(System.out::println);
```

**iterate vs generate:**

| 구분 | iterate | generate |
|:-----|:--------|:---------|
| **값 생산 방식** | 이전 결과를 기반으로 연속 계산 | 독립적으로 값 생산 |
| **인수** | 초깃값 + `UnaryOperator<T>` | `Supplier<T>` |
| **상태** | 이전 값에 의존 (순서 보장) | 상태 없음 (독립적) |

{{< callout type="warning" >}}
**무한 스트림은 반드시 `limit`로 크기를 제한해야 한다.** 제한하지 않으면 최종 연산 시 무한히 계산이 반복되어 결과를 얻을 수 없다.
{{< /callout >}}

---

## 8. 정리

### 스트림 연산 분류

| 연산 | 타입 | 반환 | 상태 |
|:-----|:-----|:-----|:-----|
| `filter` | 중간 | `Stream<T>` | Stateless |
| `distinct` | 중간 | `Stream<T>` | Stateful |
| `takeWhile` | 중간 | `Stream<T>` | Stateless |
| `dropWhile` | 중간 | `Stream<T>` | Stateless |
| `skip` | 중간 | `Stream<T>` | Stateful |
| `limit` | 중간 | `Stream<T>` | Short-circuit |
| `map` | 중간 | `Stream<R>` | Stateless |
| `flatMap` | 중간 | `Stream<R>` | Stateless |
| `sorted` | 중간 | `Stream<T>` | Stateful |
| `anyMatch` | 최종 | `boolean` | Short-circuit |
| `allMatch` | 최종 | `boolean` | Short-circuit |
| `noneMatch` | 최종 | `boolean` | Short-circuit |
| `findAny` | 최종 | `Optional<T>` | Short-circuit |
| `findFirst` | 최종 | `Optional<T>` | Short-circuit |
| `reduce` | 최종 | `Optional<T>` | Stateful |
| `collect` | 최종 | `R` | Stateful |
| `forEach` | 최종 | `void` | — |
| `count` | 최종 | `long` | — |

### 스트림 생성 방법

| 방법 | 메서드 |
|:-----|:-------|
| 컬렉션 | `collection.stream()` |
| 값 | `Stream.of(...)` |
| null 허용 | `Stream.ofNullable(...)` (Java 9+) |
| 배열 | `Arrays.stream(array)` |
| 파일 | `Files.lines(path)` |
| 무한 (연속) | `Stream.iterate(seed, f)` |
| 무한 (독립) | `Stream.generate(supplier)` |

{{< callout type="info" >}}
**핵심 포인트:**
- `takeWhile`/`dropWhile`은 **정렬된 데이터**에서 `filter`보다 효율적이다 (Java 9+)
- `flatMap`은 중첩 스트림을 **하나로 평면화**한다
- 검색/매칭 연산은 **쇼트서킷**으로 불필요한 처리를 건너뛴다
- `reduce`는 **병렬화에 유리**한 반복 조합 연산이다
- 기본형 특화 스트림(`IntStream` 등)은 **박싱 비용을 제거**한다
- 무한 스트림은 반드시 `limit`로 크기를 제한해야 한다
{{< /callout >}}
