---
title: "Chapter 14. 람다와 스트림"
date: 2026-01-20
weight: 14
---

앞 장들은 "14장의 람다"라는 말로 여러 자리를 비워 두었다. [Chapter 07](../07-oop-advanced)의 익명 클래스와 캡처, [Chapter 10](../10-date-time-formatting)의 `TemporalAdjuster`와 `datesUntil()`, [Chapter 11](../11-collections-framework)의 `Comparator`와 `removeIf()`, [Chapter 12](../12-generics-enum-annotation)의 `@FunctionalInterface`, [Chapter 13](../13-thread)의 `Runnable`과 Fork/Join 위의 병렬 스트림이 그것이다. Java 8(2014년)의 람다와 스트림은 자바가 함수형 언어의 도구를 들여온 사건이고, 이 장의 규칙은 세 원리에서 나온다. 첫째, **람다는 메서드 하나짜리 객체를 만드는 문법이지 익명 클래스의 줄임말이 아니다.** `this`의 뜻, 변수 캡처의 조건, 실행 방식이 전부 다르다. 둘째, **스트림은 "무엇을"을 적는 것이지 "어떻게"를 적는 것이 아니다.** 반복문을 스트림이 대신 돌려 주기 때문에 지연 연산도, 일회용이라는 제약도, 병렬화도 가능해진다. 셋째, **병렬은 공짜가 아니다.** `.parallel()` 한 줄이 언제 여섯 배를 벌고 언제 오히려 느려지는지는 13장의 스레드 원리로 설명된다. 이 장의 수치는 필자의 PC(JDK 25, 12코어)에서 나온 경향이다.

---

## 1. 람다: 메서드 하나짜리 객체를 만드는 문법

### 1.1 왜 필요했나

```java
// Java 8 이전. 동작 하나를 넘기려면 클래스 하나를 만들어야 했다
Collections.sort(names, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.length() - b.length();
    }
});

// Java 8
names.sort((a, b) -> a.length() - b.length());
```

자바에서는 메서드를 값처럼 넘길 수 없다. 넘길 수 있는 것은 객체뿐이라, "이 기준으로 비교해라"라는 동작 하나를 전달하려면 그 동작을 메서드로 가진 클래스를 만들고 인스턴스를 만들어야 했다. 7장의 익명 클래스가 그 포장을 줄여 주었지만 여전히 다섯 줄이고, 진짜 내용은 `a.length() - b.length()` 한 줄이다. 람다는 그 포장을 컴파일러에게 맡긴다. 매개변수와 본문만 적으면 컴파일러가 "이 자리에 필요한 인터페이스가 무엇인지"를 보고 그 인터페이스를 구현한 객체를 만들어 준다.

그래서 람다는 아무 데나 쓸 수 없다. **추상 메서드가 하나뿐인 인터페이스**(함수형 인터페이스)가 필요한 자리에서만 의미가 있다. 메서드가 하나라야 람다의 본문이 어느 메서드의 구현인지 정해지기 때문이다. `Object o = () -> {}`는 "Object is not a functional interface"라는 오류다. 12장에서 본 `@FunctionalInterface`는 이 조건이 깨지지 않게 지키는 표시다.

### 1.2 문법

```java
(int a, int b) -> { return a > b ? a : b; }   // 전체 형태
(int a, int b) -> a > b ? a : b               // 식 하나면 return과 중괄호 생략
(a, b) -> a > b ? a : b                       // 타입은 추론된다
a -> a * a                                    // 매개변수가 하나면 괄호 생략
() -> System.out.println("hi")                // 매개변수가 없으면 빈 괄호
x -> { System.out.println(x); }               // 문장이면 중괄호
```

매개변수 타입을 적지 않아도 되는 것은 그 자리에 오는 함수형 인터페이스의 메서드 시그니처에서 컴파일러가 읽어 내기 때문이다. 이것을 **목표 타입 추론**이라 하고, 같은 람다 `(a, b) -> a + b`가 `BinaryOperator<Integer>` 자리에서는 정수 덧셈이, `BinaryOperator<String>` 자리에서는 문자열 연결이 된다. 타입을 적으려면 전부 적어야 하고, `(int a, b) -> a + b`는 "cannot mix implicitly-typed and explicitly-typed parameters"로 거부된다.

### 1.3 익명 클래스와 무엇이 다른가

```java
class Outer {
    String name = "outer";

    Runnable lambda() {
        return () -> System.out.println(this.name);   // this = Outer. "outer"
    }
    Runnable anon() {
        return new Runnable() {
            String name = "anon";
            public void run() { System.out.println(this.name); }   // this = 익명 클래스. "anon"
        };
    }
}
```

| | 익명 클래스 | 람다 |
|:--|:-----------|:-----|
| `this` | 익명 클래스 자신 | 바깥 클래스의 인스턴스 |
| 클래스 파일 | `Outer$1.class`가 컴파일 시 생긴다 | 없다. 실행 중에 만든다 |
| 본문 | 익명 클래스의 메서드 | 바깥 클래스의 `private` 메서드(`lambda$anon$0`) |
| 인스턴스 | 평가할 때마다 새로 만든다 | 캡처가 없으면 같은 인스턴스를 재사용한다 |
| 쓸 수 있는 곳 | 클래스 상속, 메서드 여러 개 | 함수형 인터페이스만 |

`this`의 차이가 핵심이다. 익명 클래스는 클래스이므로 `this`가 자기 자신이고, 바깥 인스턴스는 `Outer.this`로 따로 부른다. 람다는 클래스가 아니라 **바깥 메서드의 한 조각**이라 `this`가 바깥 인스턴스다. 이 차이는 구현 방식에서 온다. 컴파일러는 람다 본문을 바깥 클래스의 `private` 메서드로 옮기고, 람다가 쓰이는 자리에는 `new` 대신 `invokedynamic` 명령을 둔다. 실행 중에 처음 그 자리를 지날 때 JVM이 그 메서드를 부르는 작은 클래스를 만들어(`Outer$$Lambda/0x...` 같은 이름의 숨은 클래스) 이후에는 재사용한다. 그래서 람다는 클래스 파일을 만들지 않고, 바깥 변수를 캡처하지 않는 람다는 몇 번 평가해도 같은 객체다. `javap -c`로 보면 익명 클래스 자리에는 `new Outer$1`이, 람다 자리에는 `invokedynamic`이 있다.

### 1.4 캡처: 왜 사실상 final인가

```java
int count = 0;
Runnable r = () -> System.out.println(count);   // 오류
count++;
// local variables referenced from a lambda expression must be final or effectively final

int sum = 0;
list.forEach(n -> sum += n);                     // 같은 오류. 4절의 reduce로 푼다
```

7장에서 본 조건이 람다에도 그대로 붙는다. 지역 변수는 [Chapter 06](../06-oop-basics)의 호출 스택 프레임에 있고 메서드가 끝나면 사라지는데, 람다 객체는 그 뒤에도 살아서 다른 스레드에서 실행될 수 있다. 그래서 람다는 변수를 참조하는 것이 아니라 그 순간의 **값을 복사**해 간다. 복사본과 원본이 따로 바뀌면 같은 이름이 두 값을 가리키게 되므로, 언어는 아예 바뀌지 않는 변수만 허용한다. `final`을 붙이지 않아도 한 번만 대입되면 "사실상 final"로 인정한다.

인스턴스 변수와 배열 요소에는 이 제약이 없다. 힙에 있어서 복사가 아니라 참조로 잡히기 때문인데, 그렇다고 람다 안에서 바꾸는 것이 안전하지는 않다. 13장의 가시성과 원자성 문제가 그대로 따라온다. 람다 안에서 바깥 상태를 바꾸는 코드는 대개 스트림의 `reduce`나 `collect`로 바꿔 쓸 수 있고, 그편이 병렬로 돌려도 맞는다.

### 1.5 검사 예외

```java
Function<String, String> read =
    path -> Files.readString(Path.of(path));
// unreported exception IOException; must be caught or declared to be thrown
```

`Function.apply()`는 검사 예외를 선언하지 않았으므로 람다 본문도 던질 수 없다. [Chapter 08](../08-exception-handling)에서 검사 예외의 비용으로 꼽은 것이 이것이다. 함수형 인터페이스는 대부분 검사 예외를 모르기 때문에, 람다 안에서 `try-catch`로 감싸 비검사 예외로 바꾸거나 `throws`를 선언한 전용 인터페이스를 따로 만들어야 한다.

---

## 2. 함수형 인터페이스와 메서드 참조

### 2.1 표준 인터페이스: 왜 넷이면 되나

동작을 넘길 때마다 인터페이스를 새로 만들 필요는 없다. `java.util.function`이 준비해 둔 것들은 **입력이 있는가, 출력이 있는가**의 조합이다.

| | 출력 없음 | 출력 있음 |
|:--|:----------|:----------|
| **입력 없음** | `Runnable` (`void run()`) | `Supplier<T>` (`T get()`) |
| **입력 있음** | `Consumer<T>` (`void accept(T)`) | `Function<T, R>` (`R apply(T)`) |

여기에 출력이 `boolean`인 `Function`을 따로 이름 붙인 것이 `Predicate<T>`(`boolean test(T)`)다. 조건은 워낙 자주 쓰여서 `and`, `or`, `negate` 같은 결합 메서드를 가질 자격이 있기 때문이다. 입력이 둘이면 `Bi`가 붙고(`BiFunction<T, U, R>`, `BiConsumer`, `BiPredicate`), 입력과 출력이 같은 타입이면 `Operator`다(`UnaryOperator<T>`, `BinaryOperator<T>`).

```java
Supplier<Integer> rand = () -> (int) (Math.random() * 100);
Consumer<String> print = s -> System.out.println(s);
Function<String, Integer> len = s -> s.length();
Predicate<Integer> positive = n -> n > 0;
BinaryOperator<Integer> max = (a, b) -> a > b ? a : b;
```

기본형 특화 버전(`IntPredicate`, `IntFunction<R>`, `ToIntFunction<T>`, `IntBinaryOperator` 등)이 따로 있는 이유는 [Chapter 09](../09-java-lang-package)의 오토박싱이다. `Function<Integer, Integer>`로 `int`를 다루면 호출마다 박싱과 언박싱이 일어나고, 그 비용은 4절의 스트림에서 수십 배 차이로 나타난다. 지네릭스가 참조형만 받는다는 12장의 제약이 여기서 인터페이스를 늘렸다.

### 2.2 합성

```java
Function<String, Integer> parse = Integer::parseInt;
Function<Integer, String> toBinary = Integer::toBinaryString;
parse.andThen(toBinary).apply("8");     // "1000". parse 다음 toBinary
toBinary.compose(parse).apply("8");     // "1000". 같은 뜻

Predicate<Integer> positive = n -> n > 0;
Predicate<Integer> even = n -> n % 2 == 0;
positive.and(even).test(4);             // true
positive.or(even).test(-2);             // true
positive.negate().test(-1);             // true
Predicate.not(positive).test(-1);       // true. Java 11
```

함수를 값으로 다루면 함수끼리 조합할 수 있다. `andThen`과 `compose`는 순서만 반대이고, `Predicate`의 결합 메서드는 11장의 `Comparator.thenComparing()`과 같은 발상이다. 작은 조각을 만들어 두고 이어 붙이는 것이 함수형 스타일의 핵심이다.

### 2.3 메서드 참조

람다 본문이 메서드 하나를 그대로 부르기만 한다면 그 메서드의 이름만 적을 수 있다. 네 종류가 있고, 구분 기준은 "메서드를 누가 받는가"다.

| 종류 | 람다 | 메서드 참조 | 예 |
|:-----|:-----|:-----------|:---|
| `static` 메서드 | `s -> Integer.parseInt(s)` | `Integer::parseInt` | |
| 특정 객체의 메서드 | `s -> greeting.length()` | `greeting::length` | 그 객체가 잡힌다 |
| 타입의 인스턴스 메서드 | `(s, i) -> s.charAt(i)` | `String::charAt` | 첫 인자가 수신자가 된다 |
| 생성자 | `() -> new ArrayList<>()` | `ArrayList::new` | `int[]::new`도 된다 |

```java
Function<String, Integer> parse = Integer::parseInt;
Supplier<Integer> len = greeting::length;                // greeting은 캡처된 변수
BiFunction<String, Integer, Character> charAt = String::charAt;
charAt.apply("hello", 1);                                // 'e'
Supplier<List<String>> newList = ArrayList::new;
Function<Integer, int[]> newArr = int[]::new;
```

셋째 줄이 헷갈리기 쉽다. `String::charAt`는 `charAt`이 인스턴스 메서드인데 앞에 객체가 없다. 그래서 람다의 **첫 번째 매개변수가 수신자**가 되고 나머지가 인자가 된다. 어느 형태인지는 늘 목표 타입이 정한다.

---

## 3. 스트림: 무엇을이지 어떻게가 아니다

### 3.1 반복문을 넘겨준다

```java
// 80점 이상인 학생의 이름을 점수 내림차순으로
List<String> top = new ArrayList<>();
List<Student> passed = new ArrayList<>();
for (Student s : students) {
    if (s.score() >= 80) passed.add(s);
}
passed.sort(Comparator.comparingInt(Student::score).reversed());
for (Student s : passed) {
    top.add(s.name());
}
```

```java
// 같은 일을 스트림으로
List<String> top = students.stream()
    .filter(s -> s.score() >= 80)
    .sorted(Comparator.comparingInt(Student::score).reversed())
    .map(Student::name)
    .toList();
```

위의 반복문은 "어떻게" 할지를 적는다. 임시 리스트를 만들고, 돌면서 넣고, 정렬하고, 다시 돌면서 옮긴다. 아래의 스트림은 "무엇을" 원하는지만 적는다. 걸러서, 정렬해서, 이름만. 반복은 스트림이 안에서 돌린다. 이것을 외부 반복에서 **내부 반복**으로의 전환이라 하고, 이 장의 둘째 원리이자 스트림의 성질 넷이 여기서 나온다.

- **소스를 바꾸지 않는다.** `students`는 그대로이고 결과는 새 리스트다. 11장의 `Iterator`처럼 소스를 순회할 뿐이다.
- **일회용이다.** 한 번 최종 연산을 거친 스트림을 다시 쓰면 "stream has already been operated upon or closed"다. 스트림은 데이터가 아니라 **한 번 흐르는 파이프라인**이기 때문이다.
- **지연된다.** 어떻게 돌릴지를 스트림이 정하므로, 필요할 때까지 아무것도 하지 않을 수 있다(3.2절).
- **병렬화할 수 있다.** 반복을 스트림이 맡았으니 그것을 여러 스레드로 나누는 것도 스트림이 할 수 있다(5절).

### 3.2 파이프라인과 지연 연산

```
list.stream()
  filter ─▶ map ─▶ sorted ─▶ toList
  └─ 중간 연산: 지연 ─┘    최종 연산
```

중간 연산은 스트림을 돌려주고, 최종 연산은 결과를 돌려주며 스트림을 소모한다. 중간 연산은 **최종 연산이 불릴 때까지 아무것도 하지 않는다.** 그저 "할 일"을 이어 붙일 뿐이다.

```java
Stream.of(1, 2, 3)
    .peek(n -> System.out.println("filter <- " + n))
    .filter(n -> n != 2)
    .peek(n -> System.out.println("map <- " + n))
    .map(n -> n * 10)
    .forEach(n -> System.out.println("forEach " + n));
// filter <- 1
// map <- 1
// forEach 10
// filter <- 2
// filter <- 3
// map <- 3
// forEach 30
```

출력 순서가 말해 주는 것이 있다. 요소 전체가 `filter`를 거친 뒤 전체가 `map`을 거치는 것이 아니라, **요소 하나가 파이프라인 끝까지 간 뒤에 다음 요소가 출발한다.** 최종 연산이 첫 요소를 요구하면 그 요소가 앞의 연산들을 차례로 통과한다. 이 방식이라 세 가지가 가능해진다.

```java
Stream.of(1, 2, 3).peek(n -> System.out.println(n)).map(n -> n * 2);
// 아무것도 출력되지 않는다. 최종 연산이 없다

Stream.of(1, 2, 3, 4, 5)
    .peek(n -> count++)
    .filter(n -> n > 2)
    .findFirst();                  // 3. 세 요소만 처리하고 멈춘다

Stream.iterate(0, n -> n + 2).limit(5).toList();   // [0, 2, 4, 6, 8]. 무한 스트림
```

첫째, 최종 연산이 없으면 아무 일도 일어나지 않는다. 둘째, `findFirst()`나 `anyMatch()`처럼 답을 얻는 순간 멈추는 연산은 필요한 만큼만 처리한다. 셋째, 끝이 없는 스트림도 `limit()`이 있으면 쓸 수 있다. 요소를 미리 다 만들어 두는 것이 아니라 요구될 때 하나씩 만들기 때문이다.

```
3 ─▶ filter ─▶ ┐
1 ─▶ filter ─▶ ┼ sorted ─▶ 1,2,3 ─▶ map
2 ─▶ filter ─▶ ┘  (전부 모아야 한다)
```

예외는 `sorted()`, `distinct()`처럼 **앞의 요소를 전부 봐야 하는** 연산이다. 정렬은 마지막 요소를 보기 전에는 첫 요소를 내보낼 수 없으므로 여기서 흐름이 한 번 멈추고 모인다. 그래서 무한 스트림에 `sorted()`를 걸면 끝나지 않는다. 하나 더 알아 둘 것은 Java 9부터 `count()`가 요소 수를 소스에서 바로 알 수 있으면(`List.of(1, 2, 3).stream().count()`) 파이프라인을 **아예 실행하지 않는다**는 점이다. 중간의 `peek()`는 불리지 않는다. `peek()`를 디버깅 이상의 용도, 즉 부수 효과를 내는 자리로 쓰면 안 되는 이유다.

### 3.3 스트림 만들기

```java
list.stream();                              // 컬렉션
Arrays.stream(arr);                         // 배열. 5장
Stream.of("a", "b", "c");
IntStream.range(1, 5);                      // 1, 2, 3, 4
IntStream.rangeClosed(1, 5);                // 1, 2, 3, 4, 5
Stream.iterate(0, n -> n + 2).limit(5);     // 무한. limit 필수
Stream.iterate(1, n -> n < 50, n -> n * 3); // Java 9. 조건이 있으면 유한. 1, 3, 9, 27
Stream.generate(Math::random).limit(3);
LocalDate.of(2024, 1, 1).datesUntil(LocalDate.of(2024, 2, 1));   // 10장

try (Stream<String> lines = Files.lines(Path.of("data.txt"))) {   // 파일. 닫아야 한다
    lines.filter(l -> !l.isBlank()).forEach(System.out::println);
}
```

파일에서 만든 스트림은 [Chapter 15](../15-io)의 파일 핸들을 쥐고 있으므로 `try-with-resources`로 닫는다. 컬렉션 스트림에는 닫을 자원이 없어 그냥 쓴다.

---

## 4. 연산: 중간, 최종, 수집

### 4.1 중간 연산

| 연산 | 하는 일 | 상태 |
|:-----|:--------|:-----|
| `filter(Predicate)` | 조건에 맞는 것만 | 없음 |
| `map(Function)` | 하나를 하나로 바꾼다 | 없음 |
| `flatMap(Function)` | 하나를 스트림으로 바꾸고 펼친다 | 없음 |
| `mapToInt`, `mapToLong`, `mapToDouble` | 기본형 스트림으로 | 없음 |
| `peek(Consumer)` | 지나가는 요소를 본다. 디버깅용 | 없음 |
| `takeWhile`, `dropWhile` (Java 9) | 조건이 참인 동안 취하거나 버린다 | 없음 |
| `distinct()` | 중복 제거. `equals`와 `hashCode` 기준 | **있음** |
| `sorted()`, `sorted(Comparator)` | 정렬 | **있음**. 장벽 |
| `skip(n)`, `limit(n)` | 앞을 건너뛰거나 개수를 자른다 | 있음 |

```java
IntStream.range(1, 10).filter(n -> n % 2 == 0).skip(1).limit(2);   // 4, 6
Stream.of("apple", "banana").map(String::length);                  // 5, 6
Stream.of(3, 1, 2).sorted(Comparator.reverseOrder());               // 3, 2, 1

List.of("Hello World", "Java Stream").stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))       // Hello, World, Java, Stream
    .toList();

IntSummaryStatistics stats = students.stream()
    .mapToInt(Student::score)
    .summaryStatistics();
// IntSummaryStatistics{count=3, sum=245, min=70, average=81.67, max=90}
```

`map`은 요소 하나를 다른 것 하나로 바꾼다. 문장을 단어들로 쪼개면 하나가 여럿이 되어 `Stream<Stream<String>>`이 되는데, 그것을 한 층으로 펴는 것이 `flatMap`이다. `mapToInt`는 `Stream<Integer>`를 `IntStream`으로 바꿔 박싱을 없애고, `sum()`, `average()`, `summaryStatistics()` 같은 숫자 전용 연산을 열어 준다.

### 4.2 최종 연산과 reduce

```java
stream.allMatch(p);  stream.anyMatch(p);  stream.noneMatch(p);   // boolean. 답이 나오면 멈춘다
stream.findFirst();  stream.findAny();                           // Optional. 병렬이면 findAny
intStream.sum();  intStream.average();  intStream.max();         // 숫자 전용
stream.forEach(action);  stream.count();

Stream.of(1, 2, 3).reduce(Integer::sum);          // Optional[6]. 초기값이 없으면 비어 있을 수 있다
Stream.of(1, 2, 3).reduce(0, Integer::sum);       // 6
Stream.of("aa", "bbb", "c").parallel()
    .reduce(0, (acc, s) -> acc + s.length(), Integer::sum);   // 6. 병렬용 세 인자
```

`reduce`는 요소들을 하나로 접는다. 1.4절에서 막힌 `sum += n`의 올바른 모습이 `reduce(0, Integer::sum)`이다. 세 인자 형태의 마지막 인자는 병렬로 나눠 접은 부분 결과들을 합치는 함수인데, 여기에 조건이 있다. 접는 연산은 **결합법칙**을 만족해야 한다.

```java
IntStream.rangeClosed(1, 100).reduce(0, (a, b) -> a - b);              // -5050
IntStream.rangeClosed(1, 100).parallel().reduce(0, (a, b) -> a - b);   // 0
```

뺄셈은 `(a - b) - c`와 `a - (b - c)`가 다르다. 순차로는 왼쪽부터 접으니 한 가지 답이 나오지만, 병렬은 조각별로 접은 뒤 합치므로 답이 달라진다. 스트림이 어떻게 돌릴지를 자기가 정한다는 것은, 넘긴 함수가 순서에 기대면 안 된다는 뜻이기도 하다.

### 4.3 Optional: 없음을 타입으로

```java
Optional<String> a = Optional.of("v");         // null이면 NullPointerException
Optional<String> b = Optional.ofNullable(s);   // null이면 empty
Optional<String> c = Optional.empty();

a.orElse("기본값");                   // 값이 있어도 "기본값" 식은 평가된다
a.orElseGet(() -> compute());        // 값이 없을 때만 실행된다
c.orElseThrow();                     // NoSuchElementException: No value present
c.get();                             // 같다. 쓰지 않는다
a.ifPresent(System.out::println);
a.map(String::length);               // Optional[1]
a.filter(v -> v.length() > 3);       // Optional.empty
```

`findFirst()`, `max()`, 초기값 없는 `reduce()`는 결과가 없을 수 있다. Java 8 이전이라면 `null`을 돌려줬을 것이고, 호출자가 확인을 잊으면 엉뚱한 자리에서 `NullPointerException`이 났다. `Optional`은 "없을 수 있다"를 **반환 타입에 적는** 장치다. 받는 쪽은 상자를 열어야만 값을 얻으므로 없는 경우를 생각하지 않을 수 없다.

`orElse`와 `orElseGet`의 차이는 인자가 언제 평가되느냐다. `orElse(compute())`는 값이 있어도 `compute()`를 먼저 실행한다. 메서드 인자는 호출 전에 평가된다는 6장의 규칙 그대로다. 기본값을 만드는 비용이 크면 `orElseGet`으로 람다를 넘겨 필요할 때만 실행되게 한다. 이것이 1.1절에서 말한 "동작을 넘긴다"의 실용적인 쓰임이다.

JDK 문서는 `Optional`이 **메서드 반환 타입**으로 쓰이도록 만들어졌다고 못박는다. 필드, 매개변수, 컬렉션의 요소로 쓰면 상자를 열고 닫는 비용과 `null`인 `Optional`이라는 새로운 문제만 생긴다. 기본형은 `OptionalInt`, `OptionalLong`, `OptionalDouble`이 따로 있다.

### 4.4 collect와 Collectors

```java
List<String> names = students.stream().map(Student::name).toList();              // Java 16. 불변
List<String> mutable = students.stream().map(Student::name).collect(Collectors.toList());
Set<String> set = students.stream().map(Student::name).collect(Collectors.toSet());

Map<String, Integer> scores = students.stream()
    .collect(Collectors.toMap(Student::name, Student::score));
```

| 방법 | 돌려주는 것 | 바꿀 수 있나 | `null` 요소 |
|:-----|:-----------|:------------|:------------|
| `Stream.toList()` (Java 16) | 불변 리스트 | 불가 | 허용 |
| `Collectors.toList()` | 보통 `ArrayList` | 가능 | 허용 |
| `Collectors.toUnmodifiableList()` (Java 10) | 불변 리스트 | 불가 | 거부 |

기본 선택은 `toList()`다. 짧고 불변이라 결과를 돌려주기에 안전하다. 나중에 요소를 넣고 빼야 하면 `Collectors.toCollection(ArrayList::new)`처럼 의도를 적는다. `toMap()`은 키가 겹치면 "Duplicate key 1 (attempted merging values Kim and Park)" 같은 `IllegalStateException`을 던지므로, 겹칠 수 있으면 세 번째 인자로 병합 함수를 준다.

```java
Map<Integer, List<Student>> byGrade = students.stream()
    .collect(Collectors.groupingBy(Student::grade));          // {1=[Kim, Park, Jung], 2=[Lee, Choi]}

Map<Integer, Double> avgByGrade = students.stream()
    .collect(Collectors.groupingBy(Student::grade,
                                   Collectors.averagingInt(Student::score)));   // {1=72.67, 2=76.0}

Map<Integer, String> namesByGrade = students.stream()
    .collect(Collectors.groupingBy(Student::grade, TreeMap::new,
                                   Collectors.mapping(Student::name, Collectors.joining("/"))));

Map<Boolean, List<Student>> pass = students.stream()
    .collect(Collectors.partitioningBy(s -> s.score() >= 60));   // {false=[...], true=[...]}

students.stream().collect(Collectors.counting());                          // 5
students.stream().collect(Collectors.summingInt(Student::score));          // 370
students.stream().map(Student::name).collect(Collectors.joining(", ", "[", "]"));
```

`groupingBy`는 SQL의 `GROUP BY`다. 키를 뽑는 함수 하나만 주면 키마다 `List`로 모으고, 둘째 인자로 **다운스트림 수집기**를 주면 그 그룹을 다시 어떻게 접을지 정한다. 평균을 내거나, 이름만 뽑아 이어 붙이거나, 다시 그룹으로 나누는 식으로 얼마든지 겹친다. 결과 `Map`은 기본이 `HashMap`이고, 정렬이 필요하면 셋째 자리에 `TreeMap::new`를 준다(11장). `partitioningBy`는 키가 `boolean`인 특수한 그룹인데, 해당하는 요소가 없어도 `true`와 `false` 두 키가 항상 있다는 점이 `groupingBy`와 다르다.

---

## 5. 병렬 스트림: 공짜가 아니다

```java
long evens = LongStream.rangeClosed(1, 500_000_000)
    .parallel()
    .filter(n -> n % 2 == 0)
    .count();
// 순차 약 450ms, 병렬 약 50~80ms (12코어)
```

```
list.parallelStream()
   ┌─ 조각 1 ─▶ 워커 1 ─┐
   ├─ 조각 2 ─▶ 워커 2 ─┼▶ 결합 ─▶ 결과
   └─ 조각 3 ─▶ 호출 스레드 ─┘
```

`.parallel()` 한 줄로 스트림은 소스를 조각내 13장의 `ForkJoinPool.commonPool()`에 나눠 준다. 코어 수 빼기 하나의 워커와 호출한 스레드가 함께 일하고, 조각별 결과를 4.2절의 결합 함수로 합친다. 위 예제처럼 요소가 많고 요소당 계산이 있는 작업이라면 이득이 크다. 그러나 다음 경우에는 이득이 없거나 손해다.

- **작업이 싸면** 나누고 합치는 비용이 더 크다. 500만 개 정수의 합은 순차 20~30ms였고 병렬은 회차에 따라 3ms에서 45ms까지 오갔다.
- **소스가 잘 나뉘지 않으면** 병렬화가 안 된다. `ArrayList`와 배열은 절반씩 자를 수 있지만 `LinkedList`는 노드를 세어 가며 잘라야 해서, 같은 합을 `LinkedList`로 병렬 처리하면 순차와 비슷했다.
- **박싱이 있으면** 그 비용이 병렬 이득을 삼킨다. 천만 개의 합을 `Stream<Long>`으로 접으면 150~400ms, `LongStream`이면 2~40ms였다.
- **순서에 기대면** 답이 틀린다. 4.2절의 뺄셈 `reduce`가 그것이고, `forEach`는 순서를 보장하지 않으므로 순서가 필요하면 `forEachOrdered`다.
- **공유 상태를 바꾸면** 13장의 경쟁 상태다. `parallel().forEach(list::add)`로 10만 개를 넣으면 3만여 개만 남거나 예외가 난다. 모으는 것은 `collect`에 맡기면 스트림이 조각별로 모아 합쳐 준다.

마지막으로 `commonPool()`은 JVM 전체가 공유한다. 웹 서버에서 한 요청이 병렬 스트림으로 풀을 다 쓰면 다른 요청의 병렬 작업이 기다린다. 병렬은 측정한 뒤에 켜는 것이지 기본값이 아니다.

---

## 6. 실전 예제

### 6.1 학생 성적

```java
record Student(String name, int score, int grade) {}

List<Student> students = List.of(
    new Student("Kim", 85, 1), new Student("Lee", 92, 2),
    new Student("Park", 78, 1), new Student("Choi", 60, 2), new Student("Jung", 55, 1));

students.stream()
    .filter(s -> s.score() >= 80)
    .sorted(Comparator.comparingInt(Student::score).reversed())
    .map(Student::name)
    .toList();                                          // [Lee, Kim]

students.stream()
    .collect(Collectors.groupingBy(Student::grade,
             Collectors.averagingInt(Student::score))); // {1=72.67, 2=76.0}

students.stream()
    .collect(Collectors.teeing(                         // Java 12. 두 수집기를 하나로
        Collectors.counting(),
        Collectors.averagingInt(Student::score),
        (n, avg) -> n + "명, 평균 " + avg));              // 5명, 평균 74.0
```

### 6.2 파일 처리

```java
try (Stream<String> lines = Files.lines(Path.of("data.txt"))) {
    Map<String, Long> wordCount = lines
        .flatMap(line -> Arrays.stream(line.split("\\s+")))
        .filter(w -> !w.isBlank())
        .collect(Collectors.groupingBy(String::toLowerCase, Collectors.counting()));
}
```

줄을 단어로 펴고, 빈 것을 거르고, 소문자로 묶어 세는 일이 네 연산이다. 11장에서 `merge()`로 짜던 단어 세기가 `groupingBy`와 `counting()`의 조합으로 바뀌었고, 파일이 아무리 커도 한 줄씩 흐르므로 전체를 메모리에 올리지 않는다.

---

## 7. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 람다 | 함수형 인터페이스 자리에 동작을 적는다 | 자바는 객체만 넘길 수 있어 포장을 컴파일러가 대신한다 |
| 목표 타입 | 매개변수 타입은 자리에서 추론 | 메서드가 하나라야 어느 구현인지 정해진다 |
| `this` | 바깥 인스턴스 | 람다는 클래스가 아니라 바깥 메서드의 조각이다 |
| 실행 방식 | `invokedynamic`, 숨은 클래스 | 클래스 파일이 없고 캡처 없는 람다는 재사용된다 |
| 사실상 final | 캡처한 지역 변수는 못 바꾼다 | 값을 복사해 가므로 원본과 어긋나면 안 된다 |
| 검사 예외 | 람다 안에서 못 던진다 | 표준 인터페이스가 선언하지 않았다 |
| 표준 인터페이스 | 입력과 출력의 유무 조합 | `Supplier`, `Consumer`, `Function`, `Runnable` + `Predicate` |
| 기본형 특화 | `IntPredicate` 등 | 박싱 비용. 스트림에서 수십 배 차이 |
| 메서드 참조 | 메서드 이름만 | 본문이 호출 하나뿐일 때. 첫 인자가 수신자일 수 있다 |
| 스트림 | 무엇을만 적는다 | 반복을 스트림이 맡아 지연, 일회용, 병렬이 된다 |
| 지연 연산 | 최종 연산이 끌어당긴다 | 요소 하나가 끝까지 간 뒤 다음 요소 |
| 짧게 끝내기 | `findFirst`, `limit` | 필요한 만큼만 처리하므로 무한 스트림도 된다 |
| 장벽 | `sorted`, `distinct` | 전부 봐야 하나를 내보낼 수 있다 |
| `count()` | 파이프라인을 건너뛸 수 있다 | `peek`에 부수 효과를 두지 않는 이유 |
| `reduce` | 결합법칙이 필요 | 병렬은 조각별로 접어 합친다 |
| `Optional` | 없음을 반환 타입에 | 호출자가 없는 경우를 무시할 수 없다. 반환 전용 |
| `orElseGet` | 없을 때만 평가 | 메서드 인자는 호출 전에 평가된다 |
| `toList()` | 불변, 기본 선택 | 돌려주기에 안전하다 |
| `groupingBy` | 키 함수 + 다운스트림 | `GROUP BY`. 그룹을 다시 접는다 |
| 병렬 | 측정 뒤에 | 싼 작업, 나쁜 분할, 박싱, 순서 의존, 공유 상태에서 손해 |
