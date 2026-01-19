---
title: "Chapter 14. 람다와 스트림"
weight: 14
---

# 람다와 스트림

JDK 1.8에서 도입된 람다식과 스트림 API는 Java를 함수형 프로그래밍 언어로 확장시킨 핵심 기능이다.

---

## 1. 람다식 (Lambda Expression)

### 1.1 람다식이란?

람다식은 **메서드를 하나의 식(expression)으로 표현**한 것이다. 메서드의 이름과 반환값이 없어지므로 **익명 함수(anonymous function)**라고도 한다.

```java
// 기존 방식
int max(int a, int b) {
    return a > b ? a : b;
}

// 람다식
(a, b) -> a > b ? a : b
```

**람다식의 장점**

1. **코드 간결화**: 불필요한 코드를 줄여 가독성 향상
2. **일급 객체로 취급**: 메서드를 변수처럼 전달 가능
3. **지연 실행**: 필요할 때 실행 가능

{{< callout type="info" >}}
**메서드와 함수의 차이**
객체지향에서 메서드는 클래스에 속해야 하지만, 람다식은 독립적인 기능을 수행하므로 '함수'라는 용어를 사용한다.
{{< /callout >}}

---

### 1.2 람다식 작성하기

#### 기본 문법

```java
// 메서드에서 람다식으로 변환
반환타입 메서드이름(매개변수) { 문장들 }
           ↓
(매개변수) -> { 문장들 }
```

#### 단계별 간소화

```java
// 1. 기본 형태
(int a, int b) -> { return a > b ? a : b; }

// 2. return문 생략 (expression일 때)
(int a, int b) -> a > b ? a : b

// 3. 매개변수 타입 생략 (추론 가능할 때)
(a, b) -> a > b ? a : b

// 4. 매개변수가 하나일 때 괄호 생략
a -> a * a

// 5. 문장이 하나일 때 중괄호 생략
x -> System.out.println(x)
```

#### 람다식 작성 규칙

| 규칙 | 예시 |
|:----|:-----|
| 매개변수 타입 생략 가능 | `(a, b) -> a + b` |
| 매개변수가 하나면 괄호 생략 | `a -> a * 2` |
| 실행문이 하나면 중괄호 생략 | `x -> x + 1` |
| return문만 있으면 생략 가능 | `(a, b) -> a > b ? a : b` |

{{< callout type="warning" >}}
타입을 생략하려면 **모든 매개변수**에서 생략해야 한다.
`(int a, b) -> a + b` 는 에러!
{{< /callout >}}

---

### 1.3 함수형 인터페이스 (Functional Interface)

람다식은 사실 **익명 클래스의 객체**와 동등하다.

```java
// 함수형 인터페이스 정의
@FunctionalInterface
interface MyFunction {
    int max(int a, int b);
}

// 익명 클래스 방식
MyFunction f1 = new MyFunction() {
    public int max(int a, int b) {
        return a > b ? a : b;
    }
};

// 람다식 방식
MyFunction f2 = (a, b) -> a > b ? a : b;

// 호출
f1.max(3, 5);  // 5
f2.max(3, 5);  // 5
```

#### 함수형 인터페이스의 조건

- **추상 메서드가 단 하나**만 있어야 함
- static 메서드와 default 메서드는 개수 제한 없음
- `@FunctionalInterface` 애너테이션으로 컴파일 타임 검증

```java
@FunctionalInterface
interface Calculator {
    int calculate(int a, int b);           // 추상 메서드 (1개만)

    default int add(int a, int b) {        // default 메서드 OK
        return a + b;
    }

    static void print(int result) {        // static 메서드 OK
        System.out.println(result);
    }
}
```

---

### 1.4 java.util.function 패키지

자주 사용되는 함수형 인터페이스를 표준으로 제공한다.

#### 기본 함수형 인터페이스

| 인터페이스 | 메서드 | 설명 |
|:----------|:------|:-----|
| `Runnable` | `void run()` | 매개변수 없음, 반환값 없음 |
| `Supplier<T>` | `T get()` | 매개변수 없음, 반환값 있음 |
| `Consumer<T>` | `void accept(T t)` | 매개변수 있음, 반환값 없음 |
| `Function<T, R>` | `R apply(T t)` | 매개변수를 받아서 결과 반환 |
| `Predicate<T>` | `boolean test(T t)` | 조건 검사, boolean 반환 |

```java
// Supplier - 값 공급
Supplier<Integer> random = () -> (int)(Math.random() * 100);
System.out.println(random.get());  // 랜덤 숫자

// Consumer - 값 소비
Consumer<String> printer = s -> System.out.println(s);
printer.accept("Hello");  // Hello

// Function - 변환
Function<String, Integer> length = s -> s.length();
System.out.println(length.apply("Hello"));  // 5

// Predicate - 조건 검사
Predicate<Integer> isPositive = n -> n > 0;
System.out.println(isPositive.test(5));  // true
```

#### 매개변수가 2개인 함수형 인터페이스

| 인터페이스 | 메서드 | 설명 |
|:----------|:------|:-----|
| `BiConsumer<T, U>` | `void accept(T t, U u)` | 두 개의 매개변수, 반환값 없음 |
| `BiFunction<T, U, R>` | `R apply(T t, U u)` | 두 개의 매개변수, 결과 반환 |
| `BiPredicate<T, U>` | `boolean test(T t, U u)` | 두 개의 매개변수로 조건 검사 |

```java
BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
System.out.println(add.apply(3, 5));  // 8

BiPredicate<String, String> equals = (s1, s2) -> s1.equals(s2);
System.out.println(equals.test("a", "a"));  // true
```

#### Operator 인터페이스

매개변수와 반환 타입이 같은 경우 사용한다.

| 인터페이스 | 메서드 | 설명 |
|:----------|:------|:-----|
| `UnaryOperator<T>` | `T apply(T t)` | 단항 연산 |
| `BinaryOperator<T>` | `T apply(T t1, T t2)` | 이항 연산 |

```java
UnaryOperator<Integer> square = n -> n * n;
System.out.println(square.apply(5));  // 25

BinaryOperator<Integer> max = (a, b) -> a > b ? a : b;
System.out.println(max.apply(3, 7));  // 7
```

#### 기본형 특화 인터페이스

오토박싱/언박싱 비용을 줄이기 위해 기본형 전용 인터페이스를 제공한다.

```java
// IntPredicate - int 전용 Predicate
IntPredicate isEven = n -> n % 2 == 0;
System.out.println(isEven.test(4));  // true

// IntToDoubleFunction - int → double 변환
IntToDoubleFunction half = n -> n / 2.0;
System.out.println(half.applyAsDouble(5));  // 2.5

// IntConsumer - int 전용 Consumer
IntConsumer printInt = n -> System.out.println(n);
printInt.accept(100);  // 100
```

---

### 1.5 Function의 합성과 Predicate의 결합

#### Function 합성

```java
Function<String, Integer> f = s -> Integer.parseInt(s);
Function<Integer, String> g = n -> Integer.toBinaryString(n);

// andThen: f → g 순서
Function<String, String> h1 = f.andThen(g);
System.out.println(h1.apply("8"));  // "1000"

// compose: g → f 순서 (f.compose(g)는 g 먼저 실행)
Function<Integer, Integer> h2 = f.compose(n -> String.valueOf(n * 2));
System.out.println(h2.apply(4));  // 8

// identity: 항등 함수
Function<String, String> identity = Function.identity();
System.out.println(identity.apply("Hello"));  // "Hello"
```

#### Predicate 결합

```java
Predicate<Integer> isPositive = n -> n > 0;
Predicate<Integer> isEven = n -> n % 2 == 0;

// and
Predicate<Integer> isPositiveEven = isPositive.and(isEven);
System.out.println(isPositiveEven.test(4));   // true
System.out.println(isPositiveEven.test(-2));  // false

// or
Predicate<Integer> isPositiveOrEven = isPositive.or(isEven);
System.out.println(isPositiveOrEven.test(-2));  // true

// negate
Predicate<Integer> isNegative = isPositive.negate();
System.out.println(isNegative.test(-1));  // true

// isEqual
Predicate<String> isHello = Predicate.isEqual("Hello");
System.out.println(isHello.test("Hello"));  // true
```

---

### 1.6 메서드 참조 (Method Reference)

람다식이 **하나의 메서드만 호출**하는 경우 더 간략히 표현할 수 있다.

#### 메서드 참조의 종류

| 종류 | 람다식 | 메서드 참조 |
|:----|:------|:-----------|
| static 메서드 | `x -> ClassName.method(x)` | `ClassName::method` |
| 인스턴스 메서드 | `(obj, x) -> obj.method(x)` | `ClassName::method` |
| 특정 객체의 메서드 | `x -> obj.method(x)` | `obj::method` |
| 생성자 | `() -> new ClassName()` | `ClassName::new` |

```java
// static 메서드 참조
Function<String, Integer> f1 = s -> Integer.parseInt(s);
Function<String, Integer> f2 = Integer::parseInt;

// 인스턴스 메서드 참조
BiPredicate<String, String> p1 = (s1, s2) -> s1.equals(s2);
BiPredicate<String, String> p2 = String::equals;

// 특정 객체의 메서드 참조
String str = "Hello";
Supplier<Integer> s1 = () -> str.length();
Supplier<Integer> s2 = str::length;

// 생성자 참조
Supplier<ArrayList<String>> c1 = () -> new ArrayList<>();
Supplier<ArrayList<String>> c2 = ArrayList::new;

// 배열 생성자 참조
Function<Integer, int[]> a1 = n -> new int[n];
Function<Integer, int[]> a2 = int[]::new;
```

---

### 1.7 외부 변수를 참조하는 람다식

람다식 내에서 참조하는 **지역변수는 effectively final**이어야 한다.

```java
public class LambdaScope {
    int instanceVar = 10;  // 인스턴스 변수 - 변경 가능

    void method() {
        int localVar = 20;  // 지역변수 - 변경 불가 (effectively final)

        Consumer<Integer> lambda = n -> {
            System.out.println("n: " + n);
            System.out.println("localVar: " + localVar);
            System.out.println("instanceVar: " + instanceVar);

            // localVar = 30;  // 에러! 지역변수 변경 불가
            instanceVar = 30;  // OK. 인스턴스 변수는 변경 가능
        };

        // localVar = 25;  // 에러! 람다에서 참조 중인 변수
        lambda.accept(5);
    }
}
```

{{< callout type="info" >}}
**Effectively Final**
final 키워드가 없어도 값이 변경되지 않는 변수. JDK 1.8부터 이런 변수는 람다식에서 사용 가능하다.
{{< /callout >}}

---

## 2. 스트림 (Stream)

### 2.1 스트림이란?

스트림은 **데이터 소스를 추상화**하고, 데이터를 다루는 데 자주 사용되는 메서드들을 정의해 놓은 것이다.

```java
// 기존 방식 - 컬렉션과 배열을 다르게 처리
String[] strArr = {"aaa", "bbb", "ccc"};
List<String> strList = Arrays.asList(strArr);

// 정렬
Arrays.sort(strArr);
Collections.sort(strList);

// 출력
for (String s : strArr) System.out.println(s);
for (String s : strList) System.out.println(s);

// 스트림 방식 - 동일한 방법으로 처리
Stream<String> stream1 = Arrays.stream(strArr);
Stream<String> stream2 = strList.stream();

stream1.sorted().forEach(System.out::println);
stream2.sorted().forEach(System.out::println);
```

**스트림의 특징**

1. **데이터 소스를 변경하지 않음** (읽기만 함)
2. **일회용** (한 번 사용하면 닫힘)
3. **내부 반복** (반복문이 메서드 내부에 숨겨짐)
4. **지연 연산** (최종 연산 전까지 중간 연산이 실행되지 않음)

---

### 2.2 스트림 만들기

#### 컬렉션에서 생성

```java
List<Integer> list = Arrays.asList(1, 2, 3, 4, 5);
Stream<Integer> stream = list.stream();
```

#### 배열에서 생성

```java
String[] arr = {"a", "b", "c"};

// Stream.of()
Stream<String> stream1 = Stream.of(arr);
Stream<String> stream2 = Stream.of("a", "b", "c");

// Arrays.stream()
Stream<String> stream3 = Arrays.stream(arr);
Stream<String> stream4 = Arrays.stream(arr, 0, 2);  // [0, 2) 범위
```

#### 기본형 스트림

```java
// 범위 생성
IntStream intStream1 = IntStream.range(1, 5);       // 1, 2, 3, 4
IntStream intStream2 = IntStream.rangeClosed(1, 5); // 1, 2, 3, 4, 5

// 배열에서
int[] intArr = {1, 2, 3};
IntStream intStream3 = Arrays.stream(intArr);
```

#### 난수 스트림

```java
// 무한 스트림 - limit() 필수
IntStream randomStream = new Random().ints();
randomStream.limit(5).forEach(System.out::println);

// 크기 지정
IntStream randomStream2 = new Random().ints(5);  // 5개

// 범위 지정 (begin ~ end-1)
IntStream randomStream3 = new Random().ints(5, 1, 10);  // 1~9 사이 5개
```

#### iterate(), generate()

```java
// iterate - 이전 결과를 이용해 다음 요소 생성
Stream<Integer> evenStream = Stream.iterate(0, n -> n + 2);
evenStream.limit(5).forEach(System.out::println);  // 0, 2, 4, 6, 8

// generate - 이전 결과와 무관하게 생성
Stream<Double> randomStream = Stream.generate(Math::random);
randomStream.limit(3).forEach(System.out::println);
```

#### 빈 스트림과 스트림 연결

```java
// 빈 스트림
Stream<Object> emptyStream = Stream.empty();

// 스트림 연결
Stream<String> stream1 = Stream.of("a", "b");
Stream<String> stream2 = Stream.of("c", "d");
Stream<String> combined = Stream.concat(stream1, stream2);  // a, b, c, d
```

---

### 2.3 스트림의 연산

스트림 연산은 **중간 연산**과 **최종 연산**으로 구분된다.

```java
stream.filter(...)     // 중간 연산
      .map(...)        // 중간 연산
      .sorted(...)     // 중간 연산
      .forEach(...);   // 최종 연산
```

| 구분 | 특징 | 예시 |
|:----|:-----|:-----|
| 중간 연산 | 스트림 반환, 연속 호출 가능 | filter, map, sorted, distinct |
| 최종 연산 | 스트림 소모, 한 번만 가능 | forEach, count, collect, reduce |

---

### 2.4 중간 연산

#### skip(), limit() - 스트림 자르기

```java
IntStream.range(1, 10)
    .skip(3)      // 처음 3개 건너뜀
    .limit(4)     // 4개만 선택
    .forEach(System.out::print);  // 4567
```

#### filter() - 조건에 맞는 요소 걸러내기

```java
IntStream.range(1, 10)
    .filter(n -> n % 2 == 0)      // 짝수만
    .forEach(System.out::print);  // 2468

// 여러 조건
stream.filter(n -> n > 0)
      .filter(n -> n % 2 == 0);
// 또는
stream.filter(n -> n > 0 && n % 2 == 0);
```

#### distinct() - 중복 제거

```java
IntStream.of(1, 2, 2, 3, 3, 3, 4)
    .distinct()
    .forEach(System.out::print);  // 1234
```

#### sorted() - 정렬

```java
// 기본 정렬 (Comparable)
Stream.of("c", "a", "b")
    .sorted()
    .forEach(System.out::print);  // abc

// Comparator 지정
Stream.of("cc", "aaa", "b")
    .sorted(Comparator.comparingInt(String::length))
    .forEach(System.out::println);  // b, cc, aaa

// 역순 정렬
Stream.of(3, 1, 2)
    .sorted(Comparator.reverseOrder())
    .forEach(System.out::print);  // 321

// 정렬 기준 조합
students.stream()
    .sorted(Comparator.comparing(Student::getGrade)
            .thenComparing(Student::getName))
    .forEach(System.out::println);
```

#### map() - 요소 변환

```java
// 문자열 길이로 변환
Stream.of("apple", "banana", "cherry")
    .map(String::length)
    .forEach(System.out::println);  // 5, 6, 6

// 대문자 변환
Stream.of("a", "b", "c")
    .map(String::toUpperCase)
    .forEach(System.out::print);  // ABC

// 연속 변환
fileStream.map(File::getName)           // File → String
          .map(s -> s.substring(0, 3))  // String → String
          .forEach(System.out::println);
```

#### mapToInt(), mapToLong(), mapToDouble()

기본형 스트림으로 변환하여 효율적인 처리 가능.

```java
// Student의 점수 합계
int total = students.stream()
    .mapToInt(Student::getScore)
    .sum();

// 통계 정보 한번에 얻기
IntSummaryStatistics stats = students.stream()
    .mapToInt(Student::getScore)
    .summaryStatistics();

System.out.println("개수: " + stats.getCount());
System.out.println("합계: " + stats.getSum());
System.out.println("평균: " + stats.getAverage());
System.out.println("최대: " + stats.getMax());
System.out.println("최소: " + stats.getMin());
```

#### flatMap() - 스트림 평탄화

```java
// 문자열 배열의 스트림
Stream<String[]> strArrStream = Stream.of(
    new String[]{"a", "b"},
    new String[]{"c", "d"}
);

// map() 사용 시 - Stream<Stream<String>>
Stream<Stream<String>> streamOfStream = strArrStream.map(Arrays::stream);

// flatMap() 사용 시 - Stream<String>
Stream<String> flatStream = Stream.of(
    new String[]{"a", "b"},
    new String[]{"c", "d"}
).flatMap(Arrays::stream);

flatStream.forEach(System.out::print);  // abcd
```

```java
// 실전 예제: 문장을 단어로 분리
List<String> sentences = Arrays.asList("Hello World", "Java Stream");

sentences.stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))
    .forEach(System.out::println);  // Hello, World, Java, Stream
```

#### peek() - 조회 (디버깅용)

```java
Stream.of(1, 2, 3, 4, 5)
    .peek(n -> System.out.println("원본: " + n))
    .filter(n -> n % 2 == 0)
    .peek(n -> System.out.println("필터 후: " + n))
    .map(n -> n * 10)
    .forEach(n -> System.out.println("결과: " + n));
```

---

### 2.5 Optional\<T\>

`Optional<T>`는 **null일 수 있는 값을 감싸는 래퍼 클래스**이다.

#### Optional 생성

```java
// 값이 있을 때
Optional<String> opt1 = Optional.of("Hello");

// 값이 null일 수도 있을 때
Optional<String> opt2 = Optional.ofNullable(str);

// 빈 Optional
Optional<String> opt3 = Optional.empty();
```

#### Optional 값 가져오기

```java
Optional<String> opt = Optional.of("Hello");

// get() - 값이 없으면 예외 발생
String value1 = opt.get();

// orElse() - 값이 없으면 기본값 반환
String value2 = opt.orElse("default");

// orElseGet() - 값이 없으면 람다식 실행
String value3 = opt.orElseGet(() -> "default");

// orElseThrow() - 값이 없으면 예외 발생
String value4 = opt.orElseThrow(() -> new RuntimeException("No value"));

// isPresent() - 값 존재 여부 확인
if (opt.isPresent()) {
    System.out.println(opt.get());
}

// ifPresent() - 값이 있을 때만 동작 수행
opt.ifPresent(System.out::println);
```

#### Optional과 Stream 연산

```java
Optional<String> opt = Optional.of("HELLO");

// map
Optional<Integer> length = opt.map(String::length);  // Optional[5]

// filter
Optional<String> filtered = opt.filter(s -> s.length() > 3);  // Optional[HELLO]

// flatMap
Optional<Integer> result = opt.flatMap(s -> Optional.of(s.length()));
```

#### 기본형 Optional

```java
OptionalInt optInt = OptionalInt.of(10);
OptionalLong optLong = OptionalLong.of(100L);
OptionalDouble optDouble = OptionalDouble.of(3.14);

int value = optInt.orElse(0);
```

---

### 2.6 최종 연산

#### forEach()

```java
Stream.of(1, 2, 3).forEach(System.out::println);
```

#### 조건 검사 - allMatch(), anyMatch(), noneMatch()

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);

// allMatch - 모든 요소가 조건 만족?
boolean allEven = numbers.stream().allMatch(n -> n % 2 == 0);  // false

// anyMatch - 하나라도 조건 만족?
boolean hasEven = numbers.stream().anyMatch(n -> n % 2 == 0);  // true

// noneMatch - 모든 요소가 조건 불만족?
boolean noNegative = numbers.stream().noneMatch(n -> n < 0);  // true
```

#### findFirst(), findAny()

```java
Optional<Integer> first = Stream.of(1, 2, 3)
    .filter(n -> n > 1)
    .findFirst();  // Optional[2]

// 병렬 스트림에서는 findAny() 사용
Optional<Integer> any = numbers.parallelStream()
    .filter(n -> n > 1)
    .findAny();
```

#### count(), sum(), average(), max(), min()

```java
// count
long count = Stream.of(1, 2, 3).count();  // 3

// 기본형 스트림에서 통계
IntStream intStream = IntStream.of(1, 2, 3, 4, 5);
int sum = intStream.sum();  // 15

OptionalDouble avg = IntStream.of(1, 2, 3).average();  // OptionalDouble[2.0]
OptionalInt max = IntStream.of(1, 2, 3).max();  // OptionalInt[3]
OptionalInt min = IntStream.of(1, 2, 3).min();  // OptionalInt[1]
```

#### reduce() - 리듀싱

스트림의 요소를 **줄여나가면서 연산**을 수행한다.

```java
// 초기값 없이 - Optional 반환
Optional<Integer> sum1 = Stream.of(1, 2, 3, 4, 5)
    .reduce((a, b) -> a + b);

// 초기값 있을 때 - 타입 반환
int sum2 = Stream.of(1, 2, 3, 4, 5)
    .reduce(0, (a, b) -> a + b);

// 메서드 참조
int sum3 = Stream.of(1, 2, 3, 4, 5)
    .reduce(0, Integer::sum);

// 최대값
Optional<Integer> max = Stream.of(1, 5, 3, 2, 4)
    .reduce(Integer::max);

// 문자열 결합
String concat = Stream.of("a", "b", "c")
    .reduce("", (s1, s2) -> s1 + s2);  // "abc"
```

---

### 2.7 collect()와 Collectors

`collect()`는 스트림 요소를 수집하는 가장 **강력한 최종 연산**이다.

#### 컬렉션으로 변환

```java
List<String> list = stream.collect(Collectors.toList());
Set<String> set = stream.collect(Collectors.toSet());
ArrayList<String> arrayList = stream.collect(Collectors.toCollection(ArrayList::new));
```

#### Map으로 변환

```java
// 학생의 이름을 키, 점수를 값으로
Map<String, Integer> map = students.stream()
    .collect(Collectors.toMap(
        Student::getName,      // 키 매퍼
        Student::getScore      // 값 매퍼
    ));

// 키 충돌 시 처리
Map<String, Integer> map2 = students.stream()
    .collect(Collectors.toMap(
        Student::getName,
        Student::getScore,
        (oldVal, newVal) -> newVal  // 충돌 시 새 값 사용
    ));
```

#### 배열로 변환

```java
String[] arr = stream.toArray(String[]::new);
Object[] objArr = stream.toArray();  // 타입 미지정 시 Object[]
```

#### 통계

```java
// counting
long count = students.stream()
    .collect(Collectors.counting());

// summingInt
int total = students.stream()
    .collect(Collectors.summingInt(Student::getScore));

// averagingInt
double avg = students.stream()
    .collect(Collectors.averagingInt(Student::getScore));

// maxBy, minBy
Optional<Student> top = students.stream()
    .collect(Collectors.maxBy(Comparator.comparingInt(Student::getScore)));
```

#### 문자열 결합 - joining()

```java
// 단순 결합
String names = students.stream()
    .map(Student::getName)
    .collect(Collectors.joining());  // "홍길동김철수이영희"

// 구분자 지정
String names2 = students.stream()
    .map(Student::getName)
    .collect(Collectors.joining(", "));  // "홍길동, 김철수, 이영희"

// 구분자 + 접두사/접미사
String names3 = students.stream()
    .map(Student::getName)
    .collect(Collectors.joining(", ", "[", "]"));  // "[홍길동, 김철수, 이영희]"
```

#### 그룹화 - groupingBy()

```java
// 학년별 그룹화
Map<Integer, List<Student>> byGrade = students.stream()
    .collect(Collectors.groupingBy(Student::getGrade));

// 학년별 학생 수
Map<Integer, Long> countByGrade = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.counting()
    ));

// 학년별 최고 점수 학생
Map<Integer, Optional<Student>> topByGrade = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.maxBy(Comparator.comparingInt(Student::getScore))
    ));

// 다중 그룹화 (학년 → 반)
Map<Integer, Map<Integer, List<Student>>> byGradeAndBan = students.stream()
    .collect(Collectors.groupingBy(
        Student::getGrade,
        Collectors.groupingBy(Student::getBan)
    ));
```

#### 분할 - partitioningBy()

조건에 따라 **두 그룹으로 분할**한다.

```java
// 합격/불합격 분할
Map<Boolean, List<Student>> passOrFail = students.stream()
    .collect(Collectors.partitioningBy(s -> s.getScore() >= 60));

List<Student> passed = passOrFail.get(true);
List<Student> failed = passOrFail.get(false);

// 분할 + 통계
Map<Boolean, Long> countByPass = students.stream()
    .collect(Collectors.partitioningBy(
        s -> s.getScore() >= 60,
        Collectors.counting()
    ));
```

---

### 2.8 병렬 스트림

`parallel()`로 병렬 처리가 가능하다.

```java
// 순차 스트림 → 병렬 스트림
Stream<Integer> parallelStream = stream.parallel();

// 컬렉션에서 직접 병렬 스트림 생성
Stream<String> parallelStream2 = list.parallelStream();

// 병렬 스트림 → 순차 스트림
Stream<Integer> sequentialStream = parallelStream.sequential();
```

```java
// 병렬 처리 예제
long count = LongStream.rangeClosed(1, 1_000_000_000)
    .parallel()
    .filter(n -> n % 2 == 0)
    .count();
```

{{< callout type="warning" >}}
**병렬 스트림 주의사항**
- 공유 데이터 접근 시 동기화 필요
- 작은 데이터에서는 순차가 더 빠를 수 있음
- 순서가 중요한 연산에서는 성능 저하 가능
{{< /callout >}}

---

## 3. 실전 예제

### 기본 스트림 연산

```java
public class StreamExample {
    public static void main(String[] args) {
        List<String> names = Arrays.asList("Kim", "Lee", "Park", "Choi", "Jung");

        // 필터링 + 정렬 + 출력
        names.stream()
            .filter(name -> name.length() <= 3)
            .sorted()
            .forEach(System.out::println);  // Kim, Lee

        // 변환 + 수집
        List<String> upperNames = names.stream()
            .map(String::toUpperCase)
            .collect(Collectors.toList());
    }
}
```

### 학생 성적 처리

```java
class Student {
    String name;
    int score;
    int grade;
    // 생성자, getter 생략
}

public class StudentStreamExample {
    public static void main(String[] args) {
        List<Student> students = Arrays.asList(
            new Student("홍길동", 90, 1),
            new Student("김철수", 85, 1),
            new Student("이영희", 95, 2),
            new Student("박민수", 70, 2)
        );

        // 학년별 평균 점수
        Map<Integer, Double> avgByGrade = students.stream()
            .collect(Collectors.groupingBy(
                Student::getGrade,
                Collectors.averagingInt(Student::getScore)
            ));

        // 점수 순 정렬 후 이름 목록
        List<String> rankedNames = students.stream()
            .sorted(Comparator.comparingInt(Student::getScore).reversed())
            .map(Student::getName)
            .collect(Collectors.toList());

        // 80점 이상인 학생 수
        long count = students.stream()
            .filter(s -> s.getScore() >= 80)
            .count();
    }
}
```

### 파일 처리

```java
public class FileStreamExample {
    public static void main(String[] args) throws IOException {
        // 파일의 각 라인을 스트림으로
        try (Stream<String> lines = Files.lines(Paths.get("data.txt"))) {
            lines.filter(line -> !line.isEmpty())
                 .map(String::trim)
                 .forEach(System.out::println);
        }

        // 디렉토리의 파일 목록
        try (Stream<Path> files = Files.list(Paths.get("."))) {
            files.filter(Files::isRegularFile)
                 .map(Path::getFileName)
                 .forEach(System.out::println);
        }
    }
}
```

---

## 요약

| 개념 | 핵심 내용 |
|:----|:---------|
| **람다식** | 익명 함수, `(매개변수) -> { 실행문 }` 형태 |
| **함수형 인터페이스** | 추상 메서드가 하나인 인터페이스, `@FunctionalInterface` |
| **기본 함수형 인터페이스** | Supplier, Consumer, Function, Predicate |
| **메서드 참조** | `클래스::메서드` 또는 `객체::메서드` |
| **스트림** | 데이터 소스 추상화, 선언적 데이터 처리 |
| **중간 연산** | filter, map, sorted, distinct, flatMap 등 |
| **최종 연산** | forEach, count, collect, reduce 등 |
| **Optional** | null 안전한 값 래퍼, orElse/orElseGet으로 기본값 처리 |
| **collect()** | 스트림 요소 수집, Collectors 유틸리티 활용 |
| **groupingBy** | 특정 기준으로 그룹화 |
| **partitioningBy** | 조건에 따라 두 그룹으로 분할 |
| **병렬 스트림** | parallel()로 병렬 처리, 대용량 데이터에 유용 |
