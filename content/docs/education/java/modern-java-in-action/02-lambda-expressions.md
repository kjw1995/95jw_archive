---
title: "Chapter 03. 람다 표현식"
weight: 2
---

## 1. 람다(Lambda)란?

> 메서드로 전달할 수 있는 **익명 함수**를 단순화한 것

### 람다의 특징

| 특징 | 설명 |
|------|------|
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

---

## 2. 람다 문법

### 기본 구조

```
(파라미터) -> 표현식
(파라미터) -> { 문장; }
```

```
┌─────────────┐     ┌───┐     ┌─────────────────┐
│ 파라미터 리스트 │ --> │ -> │ --> │     람다 바디     │
│ (Apple a1,  │     │    │     │ a1.getWeight()  │
│  Apple a2)  │     │    │     │ .compareTo(...) │
└─────────────┘     └───┘     └─────────────────┘
```

### 문법 예시

| 형태 | 예시 |
|------|------|
| 표현식 스타일 | `(a, b) -> a + b` |
| 블록 스타일 | `(a, b) -> { return a + b; }` |
| 파라미터 없음 | `() -> "Hello"` |
| 단일 파라미터 | `s -> s.length()` |

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
- 디폴트 메서드가 있어도 **추상 메서드가 하나면** 함수형 인터페이스

### 함수 디스크립터 (Function Descriptor)

함수형 인터페이스의 추상 메서드 시그니처 = 람다 표현식의 시그니처

```java
Predicate<String>  →  String -> boolean
Consumer<Integer>  →  Integer -> void
Function<T, R>     →  T -> R
```

---

## 4. 주요 함수형 인터페이스

### 기본 인터페이스

| 인터페이스 | 시그니처 | 용도 |
|------------|----------|------|
| `Predicate<T>` | `T -> boolean` | 조건 검사 |
| `Consumer<T>` | `T -> void` | 소비 (출력 등) |
| `Function<T,R>` | `T -> R` | 변환 |
| `Supplier<T>` | `() -> T` | 공급 (생성) |
| `UnaryOperator<T>` | `T -> T` | 단항 연산 |
| `BinaryOperator<T>` | `(T,T) -> T` | 이항 연산 |

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
```

### 기본형 특화 인터페이스

오토박싱 비용을 피하기 위한 특화 버전

| 기본형 | Predicate | Consumer | Function |
|--------|-----------|----------|----------|
| int | `IntPredicate` | `IntConsumer` | `IntFunction<R>` |
| long | `LongPredicate` | `LongConsumer` | `LongFunction<R>` |
| double | `DoublePredicate` | `DoubleConsumer` | `DoubleFunction<R>` |

```java
// 박싱 발생 (비효율)
Predicate<Integer> p1 = i -> i > 0;

// 박싱 없음 (효율)
IntPredicate p2 = i -> i > 0;
```

---

## 5. 실행 어라운드 패턴

> 설정(setup) → **실제 작업** → 정리(cleanup) 패턴

```
┌─────────────────────────────────────┐
│           설정 (Setup)              │
│   BufferedReader br = new ...       │
├─────────────────────────────────────┤
│        ↓ 실제 작업 (동작 전달) ↓       │
│          br.readLine()              │
├─────────────────────────────────────┤
│           정리 (Cleanup)            │
│            br.close()               │
└─────────────────────────────────────┘
```

### 람다로 동작 파라미터화

```java
// 1. 함수형 인터페이스 정의
@FunctionalInterface
public interface BufferedReaderProcessor {
    String process(BufferedReader br) throws IOException;
}

// 2. 동작을 인수로 받는 메서드
public String processFile(BufferedReaderProcessor p) throws IOException {
    try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
        return p.process(br);  // 전달받은 동작 실행
    }
}

// 3. 다양한 동작 전달
String oneLine = processFile(br -> br.readLine());
String twoLines = processFile(br -> br.readLine() + br.readLine());
```

---

## 6. 형식 검사와 형식 추론

### 대상 형식 (Target Type)

람다가 사용되는 컨텍스트에서 기대되는 형식

```java
// filter의 두 번째 파라미터가 Predicate<Apple> → 대상 형식
List<Apple> result = filter(inventory, (Apple a) -> a.getWeight() > 150);
```

### 같은 람다, 다른 인터페이스

```java
Callable<Integer> c = () -> 42;
PrivilegedAction<Integer> p = () -> 42;
// 같은 람다지만 대상 형식이 다름
```

### 형식 추론

컴파일러가 대상 형식을 통해 파라미터 타입 추론

```java
// 형식 명시
Comparator<Apple> c = (Apple a1, Apple a2) -> a1.getWeight().compareTo(a2.getWeight());

// 형식 추론 (더 간결)
Comparator<Apple> c = (a1, a2) -> a1.getWeight().compareTo(a2.getWeight());
```

---

## 7. 지역 변수 캡처

### 람다 캡처링 (Capturing Lambda)

람다에서 외부 변수 참조 가능

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

### 왜 final이어야 하는가?

```
┌─────────────────────────────────────────────────┐
│ 지역 변수: 스택에 저장 (스레드별 독립)              │
│ 인스턴스 변수: 힙에 저장 (스레드 간 공유)           │
└─────────────────────────────────────────────────┘
                      ↓
  람다가 다른 스레드에서 실행될 때,
  원래 스레드의 지역 변수가 이미 해제되었을 수 있음
                      ↓
  따라서 람다는 지역 변수의 "복사본"을 사용
                      ↓
  복사본이므로 원본이 바뀌면 안 됨 → final 필수
```

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
|------|------|-------------|
| **정적 메서드** | `(s) -> Integer.parseInt(s)` | `Integer::parseInt` |
| **인스턴스 메서드** (임의 객체) | `(s) -> s.length()` | `String::length` |
| **인스턴스 메서드** (특정 객체) | `() -> obj.getValue()` | `obj::getValue` |

### 상세 예시

```java
// 1. 정적 메서드 참조
Function<String, Integer> f = Integer::parseInt;
// 동일: Function<String, Integer> f = s -> Integer.parseInt(s);

// 2. 임의 객체의 인스턴스 메서드
Function<String, Integer> f = String::length;
// 동일: Function<String, Integer> f = s -> s.length();

// 3. 특정 객체의 인스턴스 메서드
Supplier<Integer> s = apple::getWeight;
// 동일: Supplier<Integer> s = () -> apple.getWeight();
```

---

## 9. 생성자 참조

```java
ClassName::new
```

### 인수 개수에 따른 인터페이스

| 생성자 | 인터페이스 | 예시 |
|--------|------------|------|
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

## 요약

| 개념 | 핵심 |
|------|------|
| **람다** | 익명 함수, `(파라미터) -> 표현식` |
| **함수형 인터페이스** | 추상 메서드 1개, `@FunctionalInterface` |
| **Predicate** | `T -> boolean`, 조건 검사 |
| **Consumer** | `T -> void`, 소비 |
| **Function** | `T -> R`, 변환 |
| **Supplier** | `() -> T`, 공급 |
| **형식 추론** | 컴파일러가 파라미터 타입 추론 |
| **람다 캡처** | 외부 변수 참조, final만 가능 |
| **메서드 참조** | `클래스::메서드`, 람다의 축약형 |
| **생성자 참조** | `클래스::new` |

### 람다 표현식 진화

```java
// 1. 익명 클래스
Comparator<Apple> c = new Comparator<Apple>() {
    public int compare(Apple a1, Apple a2) {
        return a1.getWeight().compareTo(a2.getWeight());
    }
};

// 2. 람다 (형식 명시)
Comparator<Apple> c = (Apple a1, Apple a2) ->
    a1.getWeight().compareTo(a2.getWeight());

// 3. 람다 (형식 추론)
Comparator<Apple> c = (a1, a2) ->
    a1.getWeight().compareTo(a2.getWeight());

// 4. 메서드 참조
Comparator<Apple> c = comparing(Apple::getWeight);
```
