---
title: "Chapter 12. 지네릭스, 열거형, 애너테이션"
weight: 12
---

# 지네릭스, 열거형, 애너테이션

JDK 1.5에서 도입된 핵심 기능들로, 타입 안정성과 코드 가독성을 크게 향상시킨다.

---

## 1. 지네릭스 (Generics)

### 1.1 지네릭스란?

지네릭스는 **컴파일 시 타입 체크(compile-time type check)**를 해주는 기능이다.

```java
// 지네릭스 사용 전 (JDK 1.5 이전)
ArrayList list = new ArrayList();
list.add("hello");
String s = (String) list.get(0);  // 형변환 필요

// 지네릭스 사용 후
ArrayList<String> list = new ArrayList<>();
list.add("hello");
String s = list.get(0);  // 형변환 불필요
```

**지네릭스의 장점**

1. **타입 안정성**: 의도하지 않은 타입의 객체 저장을 컴파일 시점에 방지
2. **형변환 생략**: 코드가 간결해짐

---

### 1.2 지네릭 클래스 선언

```java
// 지네릭 클래스 정의
class Box<T> {
    T item;

    void setItem(T item) { this.item = item; }
    T getItem() { return item; }
}

// 사용
Box<String> stringBox = new Box<>();
stringBox.setItem("Hello");
String s = stringBox.getItem();  // 형변환 불필요

Box<Integer> intBox = new Box<>();
intBox.setItem(100);
int n = intBox.getItem();
```

### 타입 변수 명명 규칙

| 타입 변수 | 의미 | 사용 예 |
|:-------:|:-----|:--------|
| `T` | Type | `Box<T>`, `List<T>` |
| `E` | Element | `ArrayList<E>` |
| `K` | Key | `Map<K, V>` |
| `V` | Value | `Map<K, V>` |
| `N` | Number | `Calculator<N>` |
| `R` | Result | `Function<T, R>` |

### 지네릭스 용어

```java
class Box<T> {}            // Box<T>: 지네릭 클래스
Box<String> b = new Box<>();  // Box<String>: 지네릭 타입
```

| 용어 | 설명 |
|:----|:-----|
| `Box<T>` | 지네릭 클래스 ('T의 Box' 또는 'T Box') |
| `T` | 타입 변수 또는 타입 매개변수 |
| `Box` | 원시 타입 (raw type) |
| `<String>` | 매개변수화된 타입 (parameterized type) |

---

### 1.3 지네릭스의 제한

#### static 멤버에 타입 변수 사용 불가

```java
class Box<T> {
    static T item;           // 에러! T는 인스턴스 변수로 간주
    static int compare(T t1, T t2) { ... }  // 에러!
}
```

static 멤버는 모든 인스턴스에서 동일해야 하므로, 인스턴스별로 다른 타입을 가질 수 없다.

#### 지네릭 배열 생성 불가

```java
class Box<T> {
    T[] itemArr;  // OK. 참조변수 선언은 가능

    T[] toArray() {
        T[] tmpArr = new T[itemArr.length];  // 에러! 배열 생성 불가
        return tmpArr;
    }
}
```

`new` 연산자는 컴파일 시점에 타입 T가 정확히 무엇인지 알아야 하기 때문이다.

**해결 방법**

```java
// 방법 1: Reflection API 사용
@SuppressWarnings("unchecked")
T[] createArray(Class<T> clazz, int size) {
    return (T[]) Array.newInstance(clazz, size);
}

// 방법 2: Object 배열 생성 후 형변환
@SuppressWarnings("unchecked")
T[] toArray() {
    return (T[]) new Object[size];
}
```

---

### 1.4 지네릭 클래스의 객체 생성

```java
// 참조변수와 생성자의 타입이 일치해야 함
Box<Apple> appleBox = new Box<Apple>();  // OK
Box<Apple> appleBox = new Box<Grape>();  // 에러!

// 상속 관계여도 대입된 타입이 다르면 에러
Box<Fruit> fruitBox = new Box<Apple>();  // 에러!

// 지네릭 클래스 간의 상속은 가능 (대입된 타입이 같을 때)
Box<Apple> appleBox = new FruitBox<Apple>();  // OK (FruitBox가 Box의 자손일 때)

// JDK 1.7부터 타입 추론 가능 (다이아몬드 연산자)
Box<Apple> appleBox = new Box<>();  // OK
```

---

### 1.5 제한된 지네릭 클래스

`extends`를 사용하여 타입 매개변수에 제한을 둘 수 있다.

```java
// Fruit의 자손만 타입으로 지정 가능
class FruitBox<T extends Fruit> {
    ArrayList<T> list = new ArrayList<>();
    void add(T item) { list.add(item); }
}

// 사용
FruitBox<Apple> appleBox = new FruitBox<>();  // OK
FruitBox<Toy> toyBox = new FruitBox<>();      // 에러! Toy는 Fruit의 자손이 아님
```

#### 인터페이스 제약 조건

인터페이스를 구현해야 한다는 제약도 `extends`를 사용한다 (`implements` 아님).

```java
interface Eatable {}

// Fruit의 자손이면서 Eatable을 구현한 클래스만 허용
class FruitBox<T extends Fruit & Eatable> {
    ArrayList<T> list = new ArrayList<>();
}
```

---

### 1.6 와일드 카드

지네릭 타입의 다형성을 위해 와일드 카드(`?`)를 사용한다.

```java
// 문제 상황: static 메서드에서 특정 지네릭 타입만 받을 수 있음
class Juicer {
    static Juice makeJuice(FruitBox<Fruit> box) { ... }
}

FruitBox<Fruit> fruitBox = new FruitBox<>();
FruitBox<Apple> appleBox = new FruitBox<>();

Juicer.makeJuice(fruitBox);  // OK
Juicer.makeJuice(appleBox);  // 에러! FruitBox<Apple>은 FruitBox<Fruit>이 아님
```

#### 와일드 카드 종류

| 와일드 카드 | 설명 |
|:-----------|:-----|
| `<?>` | 제한 없음. 모든 타입 가능 (`<? extends Object>`와 동일) |
| `<? extends T>` | 상한 제한. T와 그 자손들만 가능 |
| `<? super T>` | 하한 제한. T와 그 조상들만 가능 |

#### 와일드 카드 사용 예제

```java
class Juicer {
    // Fruit의 자손이면 모두 가능
    static Juice makeJuice(FruitBox<? extends Fruit> box) {
        StringBuilder sb = new StringBuilder();
        for (Fruit f : box.getList()) {
            sb.append(f).append(" ");
        }
        return new Juice(sb.toString());
    }
}

// 이제 다양한 FruitBox 사용 가능
Juicer.makeJuice(new FruitBox<Fruit>());   // OK
Juicer.makeJuice(new FruitBox<Apple>());   // OK
Juicer.makeJuice(new FruitBox<Grape>());   // OK
```

#### PECS 원칙 (Producer Extends, Consumer Super)

```java
// Producer(데이터 제공) - extends 사용
public void printAll(List<? extends Number> list) {
    for (Number n : list) {
        System.out.println(n);  // 읽기만 함
    }
}

// Consumer(데이터 소비) - super 사용
public void addNumbers(List<? super Integer> list) {
    list.add(1);   // 쓰기 작업
    list.add(2);
}

// 사용 예
List<Number> numbers = new ArrayList<>();
addNumbers(numbers);   // OK (Number는 Integer의 조상)
printAll(numbers);     // OK
```

---

### 1.7 지네릭 메서드

메서드 선언부에 지네릭 타입을 선언한 메서드.

```java
class FruitBox<T> {
    // 지네릭 메서드 - 메서드마다 독립적인 타입 변수
    static <T> void sort(List<T> list, Comparator<? super T> c) {
        Collections.sort(list, c);
    }
}
```

{{< callout type="info" >}}
지네릭 메서드의 타입 변수 `T`는 지네릭 클래스의 `T`와 **다른 것**이다. 같은 문자를 사용해도 별개의 타입 변수이다.
{{< /callout >}}

#### 지네릭 메서드 호출

```java
// 명시적 타입 지정
FruitBox.<Fruit>sort(list, comparator);

// 타입 추론 (컴파일러가 추론 가능하면 생략)
FruitBox.sort(list, comparator);
```

#### 지네릭 메서드 예제

```java
public class GenericMethodExample {
    // 배열을 리스트로 변환하는 지네릭 메서드
    public static <T> List<T> arrayToList(T[] arr) {
        return new ArrayList<>(Arrays.asList(arr));
    }

    // 두 값 중 큰 값 반환
    public static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) > 0 ? a : b;
    }

    public static void main(String[] args) {
        String[] strArr = {"A", "B", "C"};
        List<String> list = arrayToList(strArr);

        String maxStr = max("apple", "banana");  // "banana"
        Integer maxInt = max(10, 20);            // 20
    }
}
```

---

### 1.8 타입 소거 (Type Erasure)

컴파일러는 지네릭 타입을 이용해 타입 체크 후, 컴파일된 바이트코드에서는 지네릭 정보를 제거한다.

```java
// 컴파일 전
class Box<T> {
    T item;
    void setItem(T item) { this.item = item; }
    T getItem() { return item; }
}

// 컴파일 후 (타입 소거)
class Box {
    Object item;
    void setItem(Object item) { this.item = item; }
    Object getItem() { return item; }
}
```

**제한된 타입의 경우**

```java
// 컴파일 전
class FruitBox<T extends Fruit> {
    T item;
}

// 컴파일 후 (상한 타입으로 대체)
class FruitBox {
    Fruit item;
}
```

---

## 2. 열거형 (Enum)

### 2.1 열거형이란?

서로 관련된 **상수들을 묶어서 정의**한 타입. JDK 1.5부터 도입.

```java
// 열거형 사용 전
class Card {
    static final int CLOVER = 0;
    static final int HEART = 1;
    static final int DIAMOND = 2;
    static final int SPADE = 3;
}

// 열거형 사용 후
enum Kind { CLOVER, HEART, DIAMOND, SPADE }
```

**열거형의 장점**

1. **타입 안정성**: 잘못된 값을 컴파일 시점에 잡아냄
2. **가독성**: 의미 있는 이름 사용
3. **switch문 사용 가능**

---

### 2.2 열거형 정의와 사용

```java
enum Direction { EAST, SOUTH, WEST, NORTH }

class EnumExample {
    public static void main(String[] args) {
        Direction d = Direction.EAST;

        // 비교 - == 사용 가능
        if (d == Direction.EAST) {
            System.out.println("동쪽");
        }

        // switch문에서 사용
        switch (d) {
            case EAST:  System.out.println("→"); break;
            case SOUTH: System.out.println("↓"); break;
            case WEST:  System.out.println("←"); break;
            case NORTH: System.out.println("↑"); break;
        }
    }
}
```

### 열거형 주요 메서드

| 메서드 | 설명 |
|:------|:-----|
| `values()` | 모든 상수를 배열로 반환 |
| `valueOf(String name)` | 이름에 해당하는 상수 반환 |
| `ordinal()` | 상수의 정의 순서 반환 (0부터) |
| `name()` | 상수의 이름을 문자열로 반환 |

```java
enum Direction { EAST, SOUTH, WEST, NORTH }

public class EnumMethodExample {
    public static void main(String[] args) {
        // values() - 모든 상수 배열
        Direction[] dirs = Direction.values();
        for (Direction d : dirs) {
            System.out.println(d.name() + " : " + d.ordinal());
        }
        // EAST : 0, SOUTH : 1, WEST : 2, NORTH : 3

        // valueOf() - 이름으로 상수 찾기
        Direction east = Direction.valueOf("EAST");
        System.out.println(east);  // EAST

        // compareTo() - 순서 비교
        System.out.println(Direction.EAST.compareTo(Direction.NORTH));  // -3
    }
}
```

---

### 2.3 열거형에 멤버 추가

열거형 상수에 값을 부여하고, 필드와 메서드를 추가할 수 있다.

```java
enum Direction {
    EAST(1, "→"),
    SOUTH(2, "↓"),
    WEST(3, "←"),
    NORTH(4, "↑");  // 상수 정의 끝에 세미콜론 필수

    private final int value;
    private final String symbol;

    // 생성자 (private만 허용)
    Direction(int value, String symbol) {
        this.value = value;
        this.symbol = symbol;
    }

    public int getValue() { return value; }
    public String getSymbol() { return symbol; }
}

public class EnumWithMemberExample {
    public static void main(String[] args) {
        for (Direction d : Direction.values()) {
            System.out.printf("%s: %d %s%n", d.name(), d.getValue(), d.getSymbol());
        }
        // EAST: 1 →
        // SOUTH: 2 ↓
        // WEST: 3 ←
        // NORTH: 4 ↑
    }
}
```

---

### 2.4 열거형에 추상 메서드 추가

각 상수마다 다른 동작을 정의할 수 있다.

```java
enum Operation {
    PLUS("+") {
        @Override
        public double apply(double x, double y) { return x + y; }
    },
    MINUS("-") {
        @Override
        public double apply(double x, double y) { return x - y; }
    },
    TIMES("*") {
        @Override
        public double apply(double x, double y) { return x * y; }
    },
    DIVIDE("/") {
        @Override
        public double apply(double x, double y) { return x / y; }
    };

    private final String symbol;

    Operation(String symbol) {
        this.symbol = symbol;
    }

    public String getSymbol() { return symbol; }

    // 추상 메서드 - 각 상수에서 구현
    public abstract double apply(double x, double y);
}

public class OperationExample {
    public static void main(String[] args) {
        double x = 10, y = 3;

        for (Operation op : Operation.values()) {
            System.out.printf("%.1f %s %.1f = %.1f%n",
                x, op.getSymbol(), y, op.apply(x, y));
        }
        // 10.0 + 3.0 = 13.0
        // 10.0 - 3.0 = 7.0
        // 10.0 * 3.0 = 30.0
        // 10.0 / 3.0 = 3.3
    }
}
```

---

### 2.5 EnumSet과 EnumMap

열거형 전용 Set과 Map 구현체로, 매우 효율적이다.

```java
import java.util.*;

enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

public class EnumSetMapExample {
    public static void main(String[] args) {
        // EnumSet
        EnumSet<Day> weekdays = EnumSet.range(Day.MON, Day.FRI);
        EnumSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);
        EnumSet<Day> allDays = EnumSet.allOf(Day.class);

        System.out.println("Weekdays: " + weekdays);  // [MON, TUE, WED, THU, FRI]
        System.out.println("Weekend: " + weekend);    // [SAT, SUN]

        // EnumMap
        EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
        schedule.put(Day.MON, "회의");
        schedule.put(Day.FRI, "코드 리뷰");
        schedule.put(Day.SAT, "휴식");

        System.out.println("Schedule: " + schedule);
        // {MON=회의, FRI=코드 리뷰, SAT=휴식}
    }
}
```

---

## 3. 애너테이션 (Annotation)

### 3.1 애너테이션이란?

프로그램의 소스코드에 메타데이터를 추가하는 방법. JDK 1.5부터 도입.

**애너테이션의 용도**

1. **컴파일러 지시**: `@Override`, `@Deprecated`, `@SuppressWarnings`
2. **빌드/배포 처리**: 문서 생성, 코드 자동 생성
3. **런타임 처리**: 프레임워크에서 리플렉션으로 처리

---

### 3.2 표준 애너테이션

#### @Override

메서드가 조상의 메서드를 오버라이딩하는 것임을 컴파일러에 알림.

```java
class Parent {
    void method() {}
}

class Child extends Parent {
    @Override
    void method() {}  // OK

    @Override
    void methd() {}   // 컴파일 에러! 오타 발견
}
```

#### @Deprecated

더 이상 사용을 권장하지 않는 요소임을 표시.

```java
class OldClass {
    @Deprecated
    public void oldMethod() {
        // 이 메서드는 더 이상 사용하지 마세요
    }

    public void newMethod() {
        // 대신 이 메서드를 사용하세요
    }
}
```

#### @SuppressWarnings

컴파일러 경고를 억제.

```java
// 특정 경고 억제
@SuppressWarnings("unchecked")
public void method() {
    List list = new ArrayList();  // raw type 경고 억제
}

// 여러 경고 동시 억제
@SuppressWarnings({"unchecked", "deprecation"})
public void method2() { ... }
```

| 경고 타입 | 설명 |
|:---------|:-----|
| `unchecked` | 지네릭 타입 미사용 경고 |
| `deprecation` | @Deprecated 요소 사용 경고 |
| `rawtypes` | 원시 타입 사용 경고 |
| `unused` | 사용하지 않는 변수 경고 |

#### @FunctionalInterface

함수형 인터페이스임을 명시 (추상 메서드가 하나만 있어야 함).

```java
@FunctionalInterface
interface Calculator {
    int calculate(int a, int b);
    // int another(int x);  // 추가하면 컴파일 에러!
}
```

#### @SafeVarargs

가변인자 메서드에서 제네릭 타입 안전성을 보장함을 명시.

```java
@SafeVarargs
static <T> List<T> asList(T... elements) {
    return Arrays.asList(elements);
}
```

---

### 3.3 메타 애너테이션

애너테이션을 정의할 때 사용하는 애너테이션.

#### @Target

애너테이션 적용 대상 지정.

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@interface MyAnnotation {}
```

| ElementType | 대상 |
|:------------|:----|
| `TYPE` | 클래스, 인터페이스, 열거형 |
| `FIELD` | 필드 (멤버 변수) |
| `METHOD` | 메서드 |
| `PARAMETER` | 매개변수 |
| `CONSTRUCTOR` | 생성자 |
| `LOCAL_VARIABLE` | 지역 변수 |
| `ANNOTATION_TYPE` | 애너테이션 |
| `PACKAGE` | 패키지 |
| `TYPE_PARAMETER` | 타입 매개변수 (JDK 1.8) |
| `TYPE_USE` | 타입 사용 위치 (JDK 1.8) |

#### @Retention

애너테이션 유지 기간 지정.

```java
@Retention(RetentionPolicy.RUNTIME)
@interface MyAnnotation {}
```

| RetentionPolicy | 설명 |
|:----------------|:----|
| `SOURCE` | 소스 파일에만 존재 (컴파일 시 제거) |
| `CLASS` | 클래스 파일에 존재 (런타임에 사용 불가, 기본값) |
| `RUNTIME` | 런타임에도 존재 (리플렉션으로 접근 가능) |

#### @Documented

javadoc 문서에 포함.

```java
@Documented
@interface MyAnnotation {}
```

#### @Inherited

자손 클래스에 상속.

```java
@Inherited
@interface SuperAnnotation {}

@SuperAnnotation
class Parent {}

class Child extends Parent {}  // @SuperAnnotation 상속됨
```

#### @Repeatable

같은 애너테이션을 여러 번 적용 가능 (JDK 1.8).

```java
@Repeatable(ToDos.class)  // 컨테이너 애너테이션 지정
@interface ToDo {
    String value();
}

@interface ToDos {  // 컨테이너 애너테이션
    ToDo[] value();
}

// 사용
@ToDo("기능 구현")
@ToDo("테스트 작성")
@ToDo("문서화")
class MyClass {}
```

---

### 3.4 커스텀 애너테이션 정의

```java
import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface TestInfo {
    String author() default "unknown";
    String date();
    int version() default 1;
    String[] tags() default {};
}

// 사용
class Example {
    @TestInfo(
        author = "홍길동",
        date = "2024-01-15",
        version = 2,
        tags = {"service", "api"}
    )
    public void testMethod() {}
}
```

### 애너테이션 요소 규칙

1. 요소 타입: 기본형, String, enum, 애너테이션, Class, 이들의 배열
2. 매개변수 없음
3. 예외 선언 불가
4. 요소 값으로 `null` 사용 불가

---

### 3.5 리플렉션으로 애너테이션 처리

런타임에 애너테이션 정보를 읽어 처리할 수 있다.

```java
import java.lang.annotation.*;
import java.lang.reflect.*;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@interface Test {
    String value() default "";
}

class TestRunner {
    @Test("테스트 1")
    public void test1() { System.out.println("test1 실행"); }

    @Test("테스트 2")
    public void test2() { System.out.println("test2 실행"); }

    public void normalMethod() { System.out.println("일반 메서드"); }

    public static void main(String[] args) throws Exception {
        TestRunner runner = new TestRunner();

        for (Method m : runner.getClass().getDeclaredMethods()) {
            // @Test 애너테이션이 있는 메서드만 실행
            if (m.isAnnotationPresent(Test.class)) {
                Test test = m.getAnnotation(Test.class);
                System.out.println("실행: " + test.value());
                m.invoke(runner);
            }
        }
    }
}
// 출력:
// 실행: 테스트 1
// test1 실행
// 실행: 테스트 2
// test2 실행
```

---

## 4. 실전 예제

### 지네릭 유틸리티 클래스

```java
public class GenericUtils {
    // null 안전 비교
    public static <T> boolean equals(T a, T b) {
        return (a == null) ? (b == null) : a.equals(b);
    }

    // 기본값 반환
    public static <T> T defaultIfNull(T value, T defaultValue) {
        return value != null ? value : defaultValue;
    }

    // 리스트 필터링
    public static <T> List<T> filter(List<T> list, Predicate<T> predicate) {
        List<T> result = new ArrayList<>();
        for (T item : list) {
            if (predicate.test(item)) {
                result.add(item);
            }
        }
        return result;
    }
}
```

### 열거형을 활용한 상태 관리

```java
enum OrderStatus {
    PENDING("주문 접수", false),
    CONFIRMED("주문 확인", false),
    SHIPPED("배송 중", false),
    DELIVERED("배송 완료", true),
    CANCELLED("주문 취소", true);

    private final String description;
    private final boolean isFinal;

    OrderStatus(String description, boolean isFinal) {
        this.description = description;
        this.isFinal = isFinal;
    }

    public String getDescription() { return description; }
    public boolean isFinal() { return isFinal; }

    public boolean canTransitionTo(OrderStatus next) {
        if (this.isFinal) return false;
        return this.ordinal() < next.ordinal() || next == CANCELLED;
    }
}

public class OrderStatusExample {
    public static void main(String[] args) {
        OrderStatus status = OrderStatus.PENDING;

        System.out.println(status.getDescription());  // 주문 접수
        System.out.println(status.canTransitionTo(OrderStatus.CONFIRMED));  // true
        System.out.println(status.canTransitionTo(OrderStatus.DELIVERED));  // true

        OrderStatus delivered = OrderStatus.DELIVERED;
        System.out.println(delivered.canTransitionTo(OrderStatus.CANCELLED));  // false (이미 완료)
    }
}
```

---

## 요약

| 개념 | 핵심 내용 |
|:----|:---------|
| **지네릭스** | 컴파일 시 타입 체크, 형변환 생략, 코드 재사용성 향상 |
| **타입 변수** | T, E, K, V 등 임의의 참조형 타입을 의미 |
| **제한된 지네릭** | `<T extends Class>` 형태로 타입 제한 |
| **와일드 카드** | `?`, `? extends T`, `? super T`로 유연한 타입 처리 |
| **열거형** | 관련 상수들의 집합, 타입 안전성 보장 |
| **열거형 멤버** | 필드, 생성자, 메서드 추가 가능 |
| **애너테이션** | 소스코드에 메타데이터 추가 |
| **표준 애너테이션** | @Override, @Deprecated, @SuppressWarnings 등 |
| **메타 애너테이션** | @Target, @Retention, @Documented, @Inherited |
| **커스텀 애너테이션** | `@interface`로 정의, 요소에 default 값 지정 가능 |
