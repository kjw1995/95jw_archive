---
title: "Chapter 14. 람다와 스트림"
weight: 14
---

JDK 1.8에서 도입된 람다식과 스트림 API의 개념, 함수형 인터페이스, 메서드 참조, 스트림의 지연 연산과 `Collectors`, `Optional`, 병렬 스트림의 주의점을 다룬다.

---

## 1. 람다식 (Lambda Expression)

### 1.1 람다식이란?

람다식은 **메서드를 하나의 식(expression)으로 표현**한 것이다. 이름과 반환 타입이 사라지므로 익명 함수라고도 부른다.

```java
// 기존 방식
int max(int a, int b) {
    return a > b ? a : b;
}

// 람다식
(a, b) -> a > b ? a : b
```

**도입 배경**

1. **코드 간결화**: 익명 클래스의 보일러플레이트 제거
2. **일급 객체로서의 함수**: 메서드를 변수·인자·반환값으로 사용
3. **지연 실행**: 필요한 시점에 평가 가능

{{< callout type="info" >}}
**메서드와 함수의 차이:** 객체지향에서 메서드는 클래스에 종속되지만, 람다식은 독립적인 동작 단위이므로 '함수(function)' 라는 용어가 더 어울린다. 다만 JVM 내부에서는 여전히 익명 클래스의 객체로 구현된다(정확히는 `invokedynamic` + `LambdaMetafactory`).
{{< /callout >}}

---

### 1.2 람다식 작성

```java
// 1. 기본 형태
(int a, int b) -> { return a > b ? a : b; }

// 2. 반환만 있으면 return과 중괄호 생략
(int a, int b) -> a > b ? a : b

// 3. 타입 생략 (추론)
(a, b) -> a > b ? a : b

// 4. 매개변수 하나면 괄호 생략
a -> a * a

// 5. 실행문 하나면 중괄호 생략
x -> System.out.println(x)
```

| 규칙 | 예시 |
|:---|:---|
| 매개변수 타입 생략 | `(a, b) -> a + b` |
| 매개변수 하나면 괄호 생략 | `a -> a * 2` |
| 실행문 하나면 중괄호 생략 | `x -> x + 1` |
| return만 있으면 생략 | `(a, b) -> a > b ? a : b` |

{{< callout type="warning" >}}
**타입을 생략할 때는 모든 매개변수에서 일괄 생략해야 한다.** `(int a, b) -> a + b`처럼 일부만 생략하는 것은 컴파일 에러다.
{{< /callout >}}

---

### 1.3 함수형 인터페이스

람다식은 **추상 메서드가 하나뿐인 인터페이스**의 구현체로 매핑된다. 이를 함수형 인터페이스라 한다.

```java
@FunctionalInterface
interface MyFunction {
    int max(int a, int b);
}

MyFunction f = (a, b) -> a > b ? a : b;
f.max(3, 5);  // 5
```

**함수형 인터페이스의 조건**

- 추상 메서드가 **단 하나**
- `default`, `static` 메서드는 개수 제한 없음
- `@FunctionalInterface`로 컴파일 타임 검증

---

### 1.4 java.util.function 패키지

#### 기본 인터페이스

| 인터페이스 | 메서드 | 설명 |
|:---|:---|:---|
| `Runnable` | `void run()` | 매개변수·반환 없음 |
| `Supplier<T>` | `T get()` | 매개변수 없이 값 공급 |
| `Consumer<T>` | `void accept(T)` | 값을 소비 |
| `Function<T,R>` | `R apply(T)` | 입력을 변환 |
| `Predicate<T>` | `boolean test(T)` | 조건 검사 |

```java
Supplier<Integer>   rand = () -> (int)(Math.random() * 100);
Consumer<String>    print = s -> System.out.println(s);
Function<String, Integer> len = String::length;
Predicate<Integer>  pos = n -> n > 0;
```

#### 2-인자 / Operator

| 인터페이스 | 메서드 | 설명 |
|:---|:---|:---|
| `BiFunction<T,U,R>` | `R apply(T, U)` | 두 입력을 변환 |
| `BiPredicate<T,U>` | `boolean test(T, U)` | 두 입력으로 검사 |
| `UnaryOperator<T>` | `T apply(T)` | 단항 연산 |
| `BinaryOperator<T>` | `T apply(T, T)` | 이항 연산 |

#### 기본형 특화 인터페이스

오토박싱·언박싱 비용을 줄이기 위해 `IntPredicate`, `IntFunction`, `IntToDoubleFunction` 등 기본형 전용 버전을 제공한다.

```java
IntPredicate isEven = n -> n % 2 == 0;
IntToDoubleFunction half = n -> n / 2.0;
```

---

### 1.5 Function 합성과 Predicate 결합

```java
Function<String, Integer> f = Integer::parseInt;
Function<Integer, String> g = Integer::toBinaryString;

f.andThen(g).apply("8");   // "1000" (f → g)
f.compose(h).apply(x);     // h → f

Predicate<Integer> pos = n -> n > 0;
Predicate<Integer> even = n -> n % 2 == 0;

pos.and(even).test(4);   // true
pos.or(even).test(-2);   // true
pos.negate().test(-1);   // true
```

---

### 1.6 메서드 참조

람다식이 **하나의 메서드만 호출**할 때 `클래스::메서드` 또는 `객체::메서드` 형태로 축약할 수 있다.

| 종류 | 람다 | 메서드 참조 |
|:---|:---|:---|
| static 메서드 | `x -> C.m(x)` | `C::m` |
| 인스턴스 메서드 (타입) | `(o, x) -> o.m(x)` | `C::m` |
| 특정 객체 메서드 | `x -> obj.m(x)` | `obj::m` |
| 생성자 | `() -> new C()` | `C::new` |

```java
Function<String, Integer> f = Integer::parseInt;
Supplier<List<String>>   s = ArrayList::new;
Function<Integer, int[]> a = int[]::new;
```

---

### 1.7 람다에서 외부 변수 참조

람다가 참조하는 **지역변수는 effectively final**이어야 한다. 한 번만 할당되고 이후 수정되지 않으면 `final`을 명시하지 않아도 허용된다.

```java
int localVar = 20;  // 이후 수정하지 않음 → effectively final

Consumer<Integer> lambda = n -> {
    System.out.println(localVar);  // OK
    // localVar = 30;  // 컴파일 에러
};
// localVar = 25;  // 이후 수정해도 에러
```

{{< callout type="info" >}}
**왜 effectively final인가?** 람다는 실행 시점이 생성 시점과 다를 수 있고, 다른 쓰레드에서 실행될 수도 있다. 지역변수가 변경 가능하면 값의 가시성과 수명 문제가 생기므로, JVM은 람다가 참조한 순간의 값을 **캡처(copy)** 해 두고 이를 변경하지 못하도록 강제한다. 인스턴스 변수는 힙에 있으므로 이 제약이 없다.
{{< /callout >}}

---

## 2. 스트림 (Stream)

### 2.1 스트림이란?

스트림은 **데이터 소스를 추상화**한 표준 인터페이스다. 컬렉션·배열·파일 등을 **동일한 연산 파이프라인**으로 처리할 수 있다.

```
데이터 소스 ─▶ 중간 연산 ─▶ 중간 연산 ─▶ 최종 연산
(collection)  (filter/map)  (sorted)    (collect)
              │←── 지연 평가(lazy) ──→│  │←실제 실행│
```

**스트림의 특징**

1. **소스를 변경하지 않는다** (읽기 전용)
2. **일회용** — 한 번 소비하면 재사용 불가
3. **내부 반복** — 반복문이 내부에 숨겨짐
4. **지연 연산** — 최종 연산이 호출되기 전까지 중간 연산은 실행되지 않음

{{< callout type="info" >}}
**지연 평가(lazy evaluation)의 의미:** `filter().map()`을 체이닝해도 실제 데이터는 요소 단위로 **최종 연산 시점에만** 흐른다. 그래서 `findFirst()`처럼 조기 종료하는 연산은 전체 요소를 훑지 않고 필요한 만큼만 처리한다. 무한 스트림(`Stream.iterate`)을 `limit`과 함께 사용할 수 있는 것도 이 덕분이다.
{{< /callout >}}

---

### 2.2 스트림 생성

```java
// 컬렉션
list.stream();

// 배열
Stream.of("a", "b", "c");
Arrays.stream(arr);

// 기본형
IntStream.range(1, 5);          // 1,2,3,4
IntStream.rangeClosed(1, 5);    // 1,2,3,4,5

// 무한 스트림 — limit() 필수
Stream.iterate(0, n -> n + 2).limit(5);
Stream.generate(Math::random).limit(3);

// 파일
Files.lines(Paths.get("data.txt"));

// 빈 스트림 / 연결
Stream.empty();
Stream.concat(s1, s2);
```

---

### 2.3 중간 연산과 최종 연산

| 구분 | 특징 | 예시 |
|:---|:---|:---|
| 중간 연산 | 스트림 반환, 지연 | `filter`, `map`, `sorted`, `distinct`, `flatMap`, `peek` |
| 최종 연산 | 스트림 소모, 한 번만 | `forEach`, `count`, `collect`, `reduce`, `findFirst` |

```java
list.stream()
    .filter(n -> n > 0)
    .map(n -> n * 2)
    .sorted()
    .forEach(System.out::println);
```

---

### 2.4 주요 중간 연산

#### filter / distinct / sorted / skip / limit

```java
IntStream.range(1, 10)
    .filter(n -> n % 2 == 0)   // 2,4,6,8
    .skip(1).limit(2)           // 4,6
    .forEach(System.out::print);

Stream.of(3, 1, 2)
    .sorted(Comparator.reverseOrder());  // 3,2,1
```

#### map — 요소 변환

```java
Stream.of("apple", "banana")
    .map(String::length);     // 5, 6
```

#### mapToInt / mapToLong / mapToDouble

기본형 스트림으로 변환해 박싱 비용을 줄인다.

```java
IntSummaryStatistics stats = students.stream()
    .mapToInt(Student::getScore)
    .summaryStatistics();
// count, sum, average, max, min 한 번에
```

#### flatMap — 스트림 평탄화

`map`이 `Stream<Stream<T>>`를 만들 때 이를 한 단계로 펴준다.

```java
List<String> sentences = List.of("Hello World", "Java Stream");
sentences.stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))
    .forEach(System.out::println);  // Hello, World, Java, Stream
```

#### peek — 디버깅용 조회

```java
Stream.of(1, 2, 3)
    .peek(n -> log.debug("before: {}", n))
    .map(n -> n * 10)
    .forEach(System.out::println);
```

---

### 2.5 Optional\<T\>

`Optional<T>`는 **null일 수 있는 값의 래퍼**다. 스트림의 많은 최종 연산(`findFirst`, `reduce`, `max`)이 이를 반환한다.

```java
Optional<String> opt1 = Optional.of("Hello");      // null 금지
Optional<String> opt2 = Optional.ofNullable(s);     // null 허용
Optional<String> opt3 = Optional.empty();

opt.get();                        // 값 없으면 예외
opt.orElse("default");            // 값 없으면 기본값
opt.orElseGet(() -> compute());   // 값 없으면 람다 실행
opt.orElseThrow(() -> new X());   // 값 없으면 예외

opt.ifPresent(System.out::println);
opt.map(String::length);
opt.filter(s -> s.length() > 3);
```

{{< callout type="info" >}}
**Optional 사용 가이드라인**

- 반환 타입으로만 사용하라 — 필드·파라미터·컬렉션 요소로는 지양
- `opt.get()` 직접 호출은 피하고 `orElse`·`orElseThrow` 사용
- 기본값 생성 비용이 크면 `orElse`(항상 평가) 대신 `orElseGet`(지연 평가)
- 기본형은 `OptionalInt`, `OptionalLong`, `OptionalDouble` 사용
{{< /callout >}}

---

### 2.6 주요 최종 연산

```java
// 조건 검사
stream.allMatch(p);    // 전부 만족?
stream.anyMatch(p);    // 하나라도?
stream.noneMatch(p);   // 아무도 안?

// 검색
stream.findFirst();    // 첫 요소
stream.findAny();      // 아무 요소 (병렬 최적)

// 통계 (IntStream)
intStream.sum();
intStream.average();   // OptionalDouble
intStream.max();       // OptionalInt
```

#### reduce — 누적 연산

```java
// (1) 초기값 없음 → Optional
Optional<Integer> sum = Stream.of(1,2,3).reduce(Integer::sum);

// (2) 초기값 있음 → 해당 타입
int sum = Stream.of(1,2,3).reduce(0, Integer::sum);

// (3) 병렬용 3-인자: 식별자, 누적, 결합
int total = list.parallelStream()
    .reduce(0, (acc, x) -> acc + x.val(), Integer::sum);
```

---

### 2.7 collect와 Collectors

`collect`는 스트림 요소를 **컨테이너로 수집**하는 가장 강력한 최종 연산이다.

#### 컬렉션·맵 변환

```java
List<String>  list = stream.collect(Collectors.toList());
Set<String>   set  = stream.collect(Collectors.toSet());

Map<String, Integer> map = students.stream()
    .collect(Collectors.toMap(
        Student::getName,
        Student::getScore,
        (oldV, newV) -> newV));   // 충돌 시 병합
```

{{< callout type="info" >}}
**`Collectors.toList()` vs `Stream.toList()`:** Java 16부터 `Stream#toList()`가 추가되었다. 이는 **불변 리스트**를 반환하고 null을 허용하며, 박싱이 필요 없어 더 간결하다. 반면 `Collectors.toList()`는 보통 `ArrayList`(수정 가능)를 반환한다. 기본 선택은 `Stream.toList()`, 수정 가능한 리스트가 필요하면 `Collectors.toCollection(ArrayList::new)`를 쓴다.
{{< /callout >}}

#### 통계 / 문자열 결합

```java
long count = students.stream().collect(Collectors.counting());
int  total = students.stream()
    .collect(Collectors.summingInt(Student::getScore));

String names = students.stream()
    .map(Student::getName)
    .collect(Collectors.joining(", ", "[", "]"));
```

#### groupingBy / partitioningBy

```java
// 학년별 그룹
Map<Integer, List<Student>> byGrade = students.stream()
    .collect(Collectors.groupingBy(Student::getGrade));

// 학년별 평균 점수
Map<Integer, Double> avgByGrade = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.averagingInt(Student::getScore)));

// 다단계 그룹
Map<Integer, Map<Integer, List<Student>>> nested = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.groupingBy(Student::getBan)));

// 합격/불합격 분할 (key = true/false)
Map<Boolean, List<Student>> pass = students.stream()
    .collect(Collectors.partitioningBy(s -> s.getScore() >= 60));
```

---

### 2.8 병렬 스트림

`parallelStream()` 또는 `.parallel()`로 병렬 실행이 가능하다. 내부적으로 `ForkJoinPool.commonPool()`을 사용한다.

```java
long evens = LongStream.rangeClosed(1, 1_000_000_000)
    .parallel()
    .filter(n -> n % 2 == 0)
    .count();
```

{{< callout type="warning" >}}
**병렬 스트림은 기본 선택이 아니다.** 다음 조건을 모두 만족할 때만 성능 이득이 있다.

- **데이터 크기가 충분히 큼** (수만~수백만 단위 이상)
- **요소당 처리 비용이 높음** (I/O 없는 CPU 연산)
- **소스가 분할 친화적** (`ArrayList`, 배열 O / `LinkedList`, `Iterator` X)
- **연산이 상태 없음(stateless)·순서 무관**

또한 `parallelStream`은 **공용 ForkJoinPool을 공유**하므로 웹 서버·Spring 환경에서 남용하면 다른 작업까지 영향을 받는다. 공유 변수 접근 시 동기화 오버헤드가 병렬 이득을 상쇄할 수 있다는 점도 주의하라.
{{< /callout >}}

---

## 3. 실전 예제

### 학생 성적 처리

```java
class Student {
    String name;
    int score, grade;
    // ... getters
}

// 80점 이상인 학생 이름을 점수 내림차순으로
List<String> top = students.stream()
    .filter(s -> s.getScore() >= 80)
    .sorted(Comparator.comparingInt(Student::getScore).reversed())
    .map(Student::getName)
    .toList();

// 학년별 평균 점수
Map<Integer, Double> avg = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.averagingInt(Student::getScore)));
```

### 파일 처리

```java
try (Stream<String> lines = Files.lines(Paths.get("data.txt"))) {
    lines.filter(l -> !l.isBlank())
         .map(String::trim)
         .forEach(System.out::println);
}
```

---

## 4. 요약

| 개념 | 핵심 |
|:---|:---|
| 람다식 | 익명 함수, `(매개변수) -> 식` |
| 함수형 인터페이스 | 추상 메서드 1개, `@FunctionalInterface` |
| 기본 인터페이스 | Supplier, Consumer, Function, Predicate |
| 메서드 참조 | `클래스::메서드`, `객체::메서드` |
| 스트림 | 지연 평가되는 데이터 파이프라인 |
| 중간 연산 | filter, map, sorted, distinct, flatMap |
| 최종 연산 | forEach, count, collect, reduce |
| Optional | null 안전 래퍼, 반환 타입 전용 |
| collect | Collectors + groupingBy·partitioningBy |
| 병렬 스트림 | 대용량·CPU 연산에 한해 유효 |

{{< callout type="info" >}}
**핵심 원칙**

- 스트림은 한 번 쓰고 버린다 — 재사용 불가
- 중간 연산은 지연, 최종 연산이 전체를 기동
- `Optional`은 반환에만 사용, 남용 금지
- Java 16+에서는 `Stream.toList()`가 기본 선택
- `parallelStream`은 측정 후 도입 (기본은 순차)
{{< /callout >}}
