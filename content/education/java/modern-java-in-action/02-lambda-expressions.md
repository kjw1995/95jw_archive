---
title: "Chapter 03. 람다 표현식"
weight: 2
---

## 1. 람다(Lambda)란?

> 메서드로 전달할 수 있는 **익명 함수**를 단순화한 것

### 람다의 특징

| 특징 | 설명 |
|:-----|:-----|
| **익명** | 이름이 없음 |
| **함수** | 특정 클래스에 종속되지 않음 |
| **전달** | 메서드 인수로 전달, 변수로 저장 가능 |
| **간결성** | 익명 클래스보다 훨씬 간결 |

### 람다 vs 익명 클래스

```java
// 익명 클래스 (장황함)
Comparator<Apple> byWeight = new Comparator<Apple>() {
    public int compare(Apple a1, Apple a2) {
        return a1.getWeight().compareTo(a2.getWeight());
    }
};

// 람다 (간결함)
Comparator<Apple> byWeight = (Apple a1, Apple a2) ->
    a1.getWeight().compareTo(a2.getWeight());
```

{{< callout type="info" >}}
람다와 익명 클래스는 `this`의 의미가 다르다. 익명 클래스의 `this`는 **익명 클래스 자신**을 가리키지만, 람다의 `this`는 **람다를 감싼 바깥 클래스**를 가리킨다. 또한 익명 클래스는 바깥 변수를 가릴(shadowing) 수 있지만 람다는 그럴 수 없다.
{{< /callout >}}

---

## 2. 람다 문법

### 기본 구조

```
(파라미터) -> 표현식
(파라미터) -> { 문장; }
```

```
(Apple a)  ->  a.getWeight() > 150
─────────      ───────────────────
 파라미터            람다 바디
     │
  화살표(->)로 파라미터와 바디를 구분
```

### 문법 예시

| 형태 | 예시 |
|:-----|:-----|
| 표현식 스타일 | `(a, b) -> a + b` |
| 블록 스타일 | `(a, b) -> { return a + b; }` |
| 파라미터 없음 | `() -> "Hello"` |
| 단일 파라미터 | `s -> s.length()` |

{{< callout type="warning" >}}
표현식 스타일 `(a, b) -> a + b` 는 `return`을 쓰지 않는다. 블록 스타일 `(a, b) -> { a + b; }` 처럼 중괄호를 쓰면 **반드시 `return`** 을 명시해야 한다. `{ a + b; }` 는 값을 반환하지 않는 문장이라 컴파일 에러가 난다.
{{< /callout >}}

---

## 3. 함수형 인터페이스

> **정확히 하나의 추상 메서드**를 가진 인터페이스

```java
@FunctionalInterface
public interface Predicate<T> {
    boolean test(T t);  // 단 하나의 추상 메서드
}
```

- `@FunctionalInterface`: 함수형 인터페이스임을 명시 (컴파일러 검증)
- 디폴트 메서드가 여러 개 있어도 **추상 메서드가 하나면** 함수형 인터페이스

### 함수 디스크립터(Function Descriptor)

함수형 인터페이스의 추상 메서드 시그니처 = 람다 표현식의 시그니처

```java
Predicate<String>  →  String -> boolean
Consumer<Integer>  →  Integer -> void
Function<T, R>     →  T -> R
```

{{< callout type="info" >}}
`@FunctionalInterface`는 필수가 아니지만 붙이는 것을 권장한다. 추상 메서드를 실수로 하나 더 추가하면 **컴파일 시점에 에러**로 잡아주기 때문이다. 의도를 문서화하는 효과도 있다.
{{< /callout >}}

---

## 4. 주요 함수형 인터페이스

### 기본 인터페이스

| 인터페이스 | 시그니처 | 용도 |
|:-----|:-----|:-----|
| `Predicate<T>` | `T -> boolean` | 조건 검사 |
| `Consumer<T>` | `T -> void` | 소비 (출력 등) |
| `Function<T,R>` | `T -> R` | 변환 |
| `Supplier<T>` | `() -> T` | 공급 (생성) |
| `UnaryOperator<T>` | `T -> T` | 단항 연산 |
| `BinaryOperator<T>` | `(T,T) -> T` | 이항 연산 |

### 두 인수를 받는 변형

| 인터페이스 | 시그니처 | 용도 |
|:-----|:-----|:-----|
| `BiPredicate<T,U>` | `(T,U) -> boolean` | 두 인수 조건 검사 |
| `BiConsumer<T,U>` | `(T,U) -> void` | 두 인수 소비 |
| `BiFunction<T,U,R>` | `(T,U) -> R` | 두 인수 변환 |

### 사용 예시

```java
// Predicate: 조건 검사
Predicate<String> nonEmpty = s -> !s.isEmpty();
filter(list, nonEmpty);

// Consumer: 소비
Consumer<Integer> printer = i -> System.out.println(i);
forEach(list, printer);

// Function: 변환
Function<String, Integer> toLength = s -> s.length();
map(list, toLength);  // ["abc", "de"] -> [3, 2]

// BiFunction: 두 인수 변환
BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
add.apply(3, 4);  // 7
```

### 기본형 특화 인터페이스

오토박싱 비용을 피하기 위한 특화 버전

| 기본형 | Predicate | Consumer | Function |
|:-----|:-----|:-----|:-----|
| int | `IntPredicate` | `IntConsumer` | `IntFunction<R>` |
| long | `LongPredicate` | `LongConsumer` | `LongFunction<R>` |
| double | `DoublePredicate` | `DoubleConsumer` | `DoubleFunction<R>` |

```java
// 박싱 발생 (비효율) — int를 Integer로 감쌌다 풀어야 함
Predicate<Integer> p1 = i -> i > 0;

// 박싱 없음 (효율) — int를 그대로 처리
IntPredicate p2 = i -> i > 0;
```

{{< callout type="warning" >}}
오토박싱은 **힙에 래퍼 객체를 생성**하는 비용을 발생시킨다. 박싱된 값은 메모리를 추가로 차지하고 캐시 효율도 떨어진다. 대량의 숫자 데이터를 다룰 때는 반드시 `IntPredicate`, `IntFunction` 같은 기본형 특화 인터페이스를 사용해야 한다.
{{< /callout >}}

### 예외 처리

함수형 인터페이스의 추상 메서드는 기본적으로 **checked 예외를 던질 수 없다**. 예외를 던져야 한다면 try-catch로 감싸거나, 직접 정의한 함수형 인터페이스를 사용한다.

```java
// 직접 정의: throws를 선언한 함수형 인터페이스
@FunctionalInterface
public interface BufferedReaderProcessor {
    String process(BufferedReader br) throws IOException;
}

// 또는 람다 바디에서 try-catch
Function<BufferedReader, String> f = br -> {
    try {
        return br.readLine();
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
};
```

---

## 5. 실행 어라운드 패턴

> 설정(setup) → **실제 작업** → 정리(cleanup) 패턴

설정과 정리는 매번 동일하고, 가운데 **실제 작업만 바뀐다**. 이 가변 부분을 람다로 전달한다.

```
 [설정]  BufferedReader br = new ...(...)
   │
   ▼  ← 이 부분만 람다로 교체
 [작업]  br.readLine()
   │
   ▼
 [정리]  br.close()  (try-with-resources 자동)
```

### 람다로 동작 파라미터화

```java
// 1. 함수형 인터페이스 정의
@FunctionalInterface
public interface BufferedReaderProcessor {
    String process(BufferedReader br) throws IOException;
}

// 2. 동작을 인수로 받는 메서드
public String processFile(BufferedReaderProcessor p)
        throws IOException {
    try (BufferedReader br =
            new BufferedReader(new FileReader("data.txt"))) {
        return p.process(br);  // 전달받은 동작 실행
    }
}

// 3. 다양한 동작 전달 — 설정/정리는 재사용
String oneLine  = processFile(br -> br.readLine());
String twoLines = processFile(br -> br.readLine() + br.readLine());
```

---

## 6. 형식 검사와 형식 추론

### 대상 형식(Target Type)

람다가 사용되는 컨텍스트에서 기대되는 형식

```java
// filter의 두 번째 파라미터가 Predicate<Apple> → 대상 형식
List<Apple> result =
    filter(inventory, (Apple a) -> a.getWeight() > 150);
```

### 같은 람다, 다른 인터페이스

```java
Callable<Integer> c = () -> 42;
PrivilegedAction<Integer> p = () -> 42;
// 같은 람다지만 대상 형식이 다름
```

### 형식 추론

컴파일러가 대상 형식을 통해 파라미터 타입을 추론한다.

```java
// 형식 명시
Comparator<Apple> c =
    (Apple a1, Apple a2) -> a1.getWeight().compareTo(a2.getWeight());

// 형식 추론 (더 간결)
Comparator<Apple> c =
    (a1, a2) -> a1.getWeight().compareTo(a2.getWeight());
```

---

## 7. 지역 변수 캡처

### 람다 캡처링(Capturing Lambda)

람다에서 외부 지역 변수를 참조할 수 있다.

```java
int portNumber = 1337;
Runnable r = () -> System.out.println(portNumber);  // 외부 변수 캡처
```

### 제약: final 또는 effectively final

```java
int portNumber = 1337;
Runnable r = () -> System.out.println(portNumber);
portNumber = 31337;  // 컴파일 에러! 값 변경 불가
```

{{< callout type="info" >}}
**effectively final**이란 `final` 키워드는 없지만 **초기화 후 값이 한 번도 바뀌지 않는** 변수를 말한다. Java 8부터는 이런 변수도 람다에서 캡처할 수 있다. 즉 굳이 `final`을 붙이지 않아도, 값을 바꾸지만 않으면 된다.
{{< /callout >}}

### 왜 final이어야 하는가?

```
지역 변수  → 스택 저장 (스레드별 독립)
인스턴스   → 힙 저장 (스레드 간 공유)

람다가 다른 스레드에서 실행될 때
원래 스레드의 지역 변수는 이미 사라졌을 수 있음
            ▼
람다는 지역 변수의 "복사본"을 사용
            ▼
복사본 ≠ 원본 → 원본 변경 금지 (final 필수)
```

{{< callout type="warning" >}}
인스턴스 변수는 힙에 있어 자유롭게 캡처·변경할 수 있다. 하지만 이는 **공유 가변 상태**를 만들어 병렬 처리 시 위험하다. 람다에서 가변 상태가 필요하다면 캡처가 아니라 스트림의 리듀싱 연산으로 해결하는 것이 안전하다.
{{< /callout >}}

---

## 8. 메서드 참조

> 특정 메서드만 호출하는 람다의 **축약형**

```java
// 람다
inventory.sort((a1, a2) -> a1.getWeight().compareTo(a2.getWeight()));

// 메서드 참조
inventory.sort(comparing(Apple::getWeight));
```

### 세 가지 유형

| 유형 | 람다 | 메서드 참조 |
|:-----|:-----|:-----|
| **정적 메서드** | `(s) -> Integer.parseInt(s)` | `Integer::parseInt` |
| **임의 객체의 인스턴스 메서드** | `(s) -> s.length()` | `String::length` |
| **특정 객체의 인스턴스 메서드** | `() -> obj.getValue()` | `obj::getValue` |

### 상세 예시

```java
// 1. 정적 메서드 참조
Function<String, Integer> f = Integer::parseInt;
// 동일: s -> Integer.parseInt(s)

// 2. 임의 객체의 인스턴스 메서드
Function<String, Integer> f = String::length;
// 동일: s -> s.length()

// 3. 특정 객체의 인스턴스 메서드
Supplier<Integer> s = apple::getWeight;
// 동일: () -> apple.getWeight()
```

{{< callout type="info" >}}
2번(`String::length`)과 3번(`apple::getWeight`)은 헷갈리기 쉽다. 핵심은 **수신 객체가 누구인가**다. 2번은 람다 **파라미터가** 수신 객체(`s.length()`)가 되고, 3번은 **외부의 특정 객체**(`apple`)가 수신 객체가 된다.
{{< /callout >}}

---

## 9. 생성자 참조

```java
ClassName::new
```

### 인수 개수에 따른 인터페이스

| 생성자 | 인터페이스 | 예시 |
|:-----|:-----|:-----|
| 인수 없음 | `Supplier<T>` | `Apple::new` |
| 인수 1개 | `Function<T,R>` | `Apple::new` |
| 인수 2개 | `BiFunction<T,U,R>` | `Apple::new` |

### 예시

```java
// 인수 없는 생성자
Supplier<Apple> c1 = Apple::new;
Apple a1 = c1.get();

// 인수 1개 생성자
Function<Integer, Apple> c2 = Apple::new;  // Apple(Integer weight)
Apple a2 = c2.apply(110);

// 인수 2개 생성자
BiFunction<Color, Integer, Apple> c3 = Apple::new;  // Apple(Color, Integer)
Apple a3 = c3.apply(GREEN, 110);

// 활용: 리스트 → 객체 리스트
List<Integer> weights = Arrays.asList(7, 3, 4, 10);
List<Apple> apples = map(weights, Apple::new);
```

---

## 10. 람다 표현식 조합

함수형 인터페이스는 람다를 **조합**할 수 있는 디폴트 메서드를 제공한다.

### Predicate 조합 — and, or, negate

```java
Predicate<Apple> redApple = a -> RED.equals(a.getColor());

// negate: 빨갛지 않은 사과
Predicate<Apple> notRed = redApple.negate();

// and: 빨갛고 무거운 사과
Predicate<Apple> redAndHeavy =
    redApple.and(a -> a.getWeight() > 150);

// or: 빨갛고 무겁거나, 그냥 초록 사과
Predicate<Apple> complex = redApple
    .and(a -> a.getWeight() > 150)
    .or(a -> GREEN.equals(a.getColor()));
```

### Function 조합 — andThen, compose

```java
Function<Integer, Integer> f = x -> x + 1;
Function<Integer, Integer> g = x -> x * 2;

// andThen: f 먼저 → g 나중  =  g(f(x))
Function<Integer, Integer> h1 = f.andThen(g);
h1.apply(1);  // (1+1)*2 = 4

// compose: g 먼저 → f 나중  =  f(g(x))
Function<Integer, Integer> h2 = f.compose(g);
h2.apply(1);  // (1*2)+1 = 3
```

{{< callout type="info" >}}
`andThen`과 `compose`는 **실행 순서가 반대**다. `f.andThen(g)`는 f를 먼저 적용하고, `f.compose(g)`는 g를 먼저 적용한다. 이렇게 작은 람다들을 조합해 복잡한 변환 파이프라인을 선언적으로 만들 수 있다.
{{< /callout >}}

---

## 11. 요약

| 개념 | 핵심 |
|:-----|:-----|
| **람다** | 익명 함수, `(파라미터) -> 표현식` |
| **함수형 인터페이스** | 추상 메서드 1개, `@FunctionalInterface` |
| **Predicate** | `T -> boolean`, 조건 검사 |
| **Consumer** | `T -> void`, 소비 |
| **Function** | `T -> R`, 변환 |
| **Supplier** | `() -> T`, 공급 |
| **형식 추론** | 컴파일러가 파라미터 타입 추론 |
| **람다 캡처** | 외부 변수 참조, final/effectively final만 가능 |
| **메서드 참조** | `클래스::메서드`, 람다의 축약형 |
| **생성자 참조** | `클래스::new` |
| **람다 조합** | `and`/`or`/`negate`, `andThen`/`compose` |

### 람다 표현식 진화

```java
// 1. 익명 클래스
Comparator<Apple> c = new Comparator<Apple>() {
    public int compare(Apple a1, Apple a2) {
        return a1.getWeight().compareTo(a2.getWeight());
    }
};

// 2. 람다 (형식 명시)
Comparator<Apple> c =
    (Apple a1, Apple a2) -> a1.getWeight().compareTo(a2.getWeight());

// 3. 람다 (형식 추론)
Comparator<Apple> c =
    (a1, a2) -> a1.getWeight().compareTo(a2.getWeight());

// 4. 메서드 참조
Comparator<Apple> c = comparing(Apple::getWeight);
```

{{< callout type="info" >}}
**핵심 포인트:**
- 람다는 **함수형 인터페이스의 대상 형식**이 있어야 사용할 수 있다
- 캡처하는 지역 변수는 **final 또는 effectively final**이어야 한다
- 이미 이름 있는 메서드는 **메서드 참조**로 더 간결하게 표현한다
- 기본형 특화 인터페이스로 **오토박싱 비용**을 제거한다
- `and`/`or`/`andThen`/`compose`로 작은 람다를 **조합**해 복잡한 동작을 만든다
{{< /callout >}}
