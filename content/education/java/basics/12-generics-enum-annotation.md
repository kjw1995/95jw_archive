---
title: "Chapter 12. 지네릭스, 열거형, 애너테이션"
weight: 12
---

JDK 1.5에서 도입된 세 기능을 다룬다. 타입 안정성과 코드 가독성을 끌어올리는 지네릭스, 상수 집합을 타입으로 모델링하는 열거형, 코드에 메타데이터를 부여하는 애너테이션이다.

---

## 1. 지네릭스 (Generics)

### 1.1 지네릭스란?

지네릭스는 **컴파일 시점의 타입 체크(compile-time type check)**를 제공한다. 컬렉션이나 유틸리티에 저장·전달되는 객체의 타입을 명확히 지정해 **형변환을 없애고** **런타임 오류를 컴파일 오류로 앞당긴다**.

```java
// 지네릭스 사용 전 (JDK 1.5 이전)
ArrayList list = new ArrayList();
list.add("hello");
String s = (String) list.get(0);  // 명시적 형변환 필요

// 지네릭스 사용 후
ArrayList<String> list = new ArrayList<>();
list.add("hello");
String s = list.get(0);  // 형변환 불필요
```

**장점**
1. **타입 안정성** — 의도하지 않은 타입 저장을 컴파일 시점에 차단
2. **형변환 생략** — 코드가 간결해지고 가독성 향상
3. **재사용성** — 동일 로직을 여러 타입에 적용 가능

---

### 1.2 지네릭 클래스 선언

```java
class Box<T> {
    T item;
    void setItem(T item) { this.item = item; }
    T getItem() { return item; }
}

// 사용
Box<String> stringBox = new Box<>();
stringBox.setItem("Hello");
String s = stringBox.getItem();

Box<Integer> intBox = new Box<>();
intBox.setItem(100);
int n = intBox.getItem();
```

#### 타입 변수 명명 규칙

| 타입 변수 | 의미 | 사용 예 |
|:---------|:-----|:--------|
| `T` | Type | `Box<T>`, `List<T>` |
| `E` | Element | `ArrayList<E>` |
| `K` | Key | `Map<K, V>` |
| `V` | Value | `Map<K, V>` |
| `N` | Number | `Calculator<N>` |
| `R` | Result | `Function<T, R>` |

#### 지네릭스 용어

```java
class Box<T> {}
Box<String> b = new Box<>();
```

| 용어 | 설명 |
|:-----|:-----|
| `Box<T>` | 지네릭 클래스 |
| `T` | 타입 변수(타입 매개변수) |
| `Box` | 원시 타입 (raw type) |
| `Box<String>` | 매개변수화된 타입 |

---

### 1.3 지네릭스의 제한

#### static 멤버에 타입 변수 사용 불가

```java
class Box<T> {
    static T item;                     // 에러
    static int compare(T t1, T t2) {}  // 에러
}
```

`static` 멤버는 모든 인스턴스에서 공유되므로 인스턴스마다 달라지는 타입 변수 `T`를 쓸 수 없다.

#### 지네릭 배열 생성 불가

```java
class Box<T> {
    T[] itemArr;  // OK - 참조 선언

    T[] toArray() {
        T[] tmp = new T[itemArr.length];  // 에러
        return tmp;
    }
}
```

`new` 연산자는 컴파일 시점에 실제 타입을 알아야 하는데, 타입 소거 후에는 `T`가 무엇인지 알 수 없기 때문이다.

**해결 방법**

```java
// 1) Reflection 사용
@SuppressWarnings("unchecked")
T[] create(Class<T> clazz, int size) {
    return (T[]) Array.newInstance(clazz, size);
}

// 2) Object 배열로 생성 후 캐스팅
@SuppressWarnings("unchecked")
T[] toArray() {
    return (T[]) new Object[size];
}
```

---

### 1.4 지네릭 클래스의 객체 생성

```java
Box<Apple> appleBox = new Box<Apple>();  // OK
Box<Apple> appleBox = new Box<Grape>();  // 에러

// 상속 관계여도 대입 타입이 다르면 에러
Box<Fruit> fruitBox = new Box<Apple>();  // 에러

// 지네릭 클래스 간 상속은 OK (타입이 일치할 때)
Box<Apple> appleBox = new FruitBox<Apple>();

// JDK 1.7+ 다이아몬드 연산자
Box<Apple> appleBox = new Box<>();
```

---

### 1.5 제한된 지네릭 클래스

`extends` 키워드로 타입 매개변수에 상한(upper bound)을 둘 수 있다.

```java
// Fruit의 자손만 허용
class FruitBox<T extends Fruit> {
    ArrayList<T> list = new ArrayList<>();
    void add(T item) { list.add(item); }
}

FruitBox<Apple> appleBox = new FruitBox<>();  // OK
FruitBox<Toy> toyBox = new FruitBox<>();      // 에러
```

#### 인터페이스 제약

인터페이스 구현 제약도 `implements`가 아닌 `extends`로 표현한다.

```java
interface Eatable {}

// Fruit의 자손이면서 Eatable을 구현한 타입만 허용
class FruitBox<T extends Fruit & Eatable> {
    ArrayList<T> list = new ArrayList<>();
}
```

---

### 1.6 와일드 카드

지네릭 타입의 다형성을 위해 와일드 카드(`?`)를 사용한다.

```java
class Juicer {
    static Juice makeJuice(FruitBox<Fruit> box) {
        // ...
    }
}

FruitBox<Fruit> fruitBox = new FruitBox<>();
FruitBox<Apple> appleBox = new FruitBox<>();

Juicer.makeJuice(fruitBox);  // OK
Juicer.makeJuice(appleBox);  // 에러!
// FruitBox<Apple>은 FruitBox<Fruit>과 별개의 타입
```

#### 와일드 카드 종류

| 와일드 카드 | 설명 |
|:-----------|:-----|
| `<?>` | 제한 없음 (`<? extends Object>`) |
| `<? extends T>` | 상한 제한: T와 자손 |
| `<? super T>` | 하한 제한: T와 조상 |

```
     <? extends Number>
            │
         Number
        /   │   \
     Integer Double Float     ← 허용
        ▲
        │
     <? super Integer>
        │
     Integer → Number → Object ← 허용
```

#### 와일드 카드 사용 예제

```java
class Juicer {
    // Fruit이거나 그 자손이면 모두 허용
    static Juice makeJuice(FruitBox<? extends Fruit> box) {
        StringBuilder sb = new StringBuilder();
        for (Fruit f : box.getList()) {
            sb.append(f).append(" ");
        }
        return new Juice(sb.toString());
    }
}

Juicer.makeJuice(new FruitBox<Fruit>());  // OK
Juicer.makeJuice(new FruitBox<Apple>());  // OK
Juicer.makeJuice(new FruitBox<Grape>());  // OK
```

#### PECS 원칙

**Producer Extends, Consumer Super** — Joshua Bloch가 『Effective Java』에서 정리한 지침이다.

- 컬렉션에서 **값을 꺼내서(읽어서) 사용**할 때 (Producer) → `? extends T`
- 컬렉션에 **값을 넣을(쓸) 때** (Consumer) → `? super T`

```java
// Producer: 리스트에서 Number를 "꺼내서" 출력 (읽기)
public void printAll(List<? extends Number> list) {
    for (Number n : list) {
        System.out.println(n);
    }
    // list.add(1);  // 컴파일 에러! 구체 타입을 모르므로 쓰기 불가
}

// Consumer: 리스트에 Integer를 "넣는다" (쓰기)
public void addNumbers(List<? super Integer> list) {
    list.add(1);
    list.add(2);
    // Integer n = list.get(0);  // 에러! Object로만 꺼낼 수 있음
}

List<Number> numbers = new ArrayList<>();
addNumbers(numbers);   // OK (Number는 Integer의 조상)
printAll(numbers);     // OK
```

{{< callout type="info" >}}
**PECS를 한 문장으로:** "데이터를 꺼내 쓰면 `extends`, 데이터를 넣어 쓰면 `super`". 양쪽을 모두 하는 메서드라면 와일드카드 대신 구체 타입 `T`를 써야 한다. 대표 예시가 `Collections.copy(List<? super T> dest, List<? extends T> src)` — `src`에서 꺼내(producer, `extends`) `dest`에 넣는다(consumer, `super`).
{{< /callout >}}

---

### 1.7 지네릭 메서드

메서드 선언부에 자체 타입 변수를 둔 메서드이다.

```java
class Collections {
    // 지네릭 메서드: 메서드마다 독립적인 타입 변수
    public static <T> void sort(
            List<T> list, Comparator<? super T> c) {
        // ...
    }
}
```

{{< callout type="info" >}}
지네릭 메서드의 타입 변수 `T`는 지네릭 클래스의 `T`와 **완전히 별개**이다. 같은 문자를 써도 서로 다른 타입 변수이며, 메서드 호출마다 독립적으로 바인딩된다.
{{< /callout >}}

#### 호출

```java
// 명시적 타입 지정
Collections.<Fruit>sort(list, comparator);

// 타입 추론 (대부분의 경우)
Collections.sort(list, comparator);
```

#### 예제

```java
public class GenericMethodExample {
    public static <T> List<T> arrayToList(T[] arr) {
        return new ArrayList<>(Arrays.asList(arr));
    }

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

자바의 지네릭스는 **컴파일 시점**에만 동작한다. 컴파일러는 지네릭 정보를 이용해 타입 체크와 필요한 형변환 코드를 삽입한 뒤, 바이트코드에서는 타입 변수를 제거한다.

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

상한이 지정되면 `Object` 대신 상한 타입으로 대체된다.

```java
// 컴파일 전
class FruitBox<T extends Fruit> {
    T item;
}

// 컴파일 후
class FruitBox {
    Fruit item;
}
```

{{< callout type="warning" >}}
**타입 소거의 실무적 영향**
- 런타임에는 `List<String>`과 `List<Integer>`가 **같은 클래스**로 취급된다 → `instanceof List<String>` 불가
- `new T[]`, `T.class` 같은 런타임 타입 정보가 필요한 연산은 불가능
- `Class<T>`를 인자로 넘겨 받는 토큰 패턴이 흔히 쓰이는 이유
{{< /callout >}}

---

## 2. 열거형 (Enum)

### 2.1 열거형이란?

서로 관련된 **상수들을 하나의 타입으로 묶어** 정의하는 문법이다. JDK 1.5부터 도입되었다.

```java
// 열거형 사용 전 — 단순 int 상수
class Card {
    static final int CLOVER = 0;
    static final int HEART = 1;
    static final int DIAMOND = 2;
    static final int SPADE = 3;
}

// 열거형 사용 후
enum Kind { CLOVER, HEART, DIAMOND, SPADE }
```

**장점**
1. **타입 안정성** — `Kind` 외의 값은 컴파일 오류
2. **가독성** — 이름이 의도를 드러냄
3. **switch문 직접 사용 가능**
4. **네임스페이스** — 상수가 enum에 소속됨

---

### 2.2 열거형 정의와 사용

```java
enum Direction { EAST, SOUTH, WEST, NORTH }

class EnumExample {
    public static void main(String[] args) {
        Direction d = Direction.EAST;

        // == 비교 가능 (싱글턴 보장)
        if (d == Direction.EAST) {
            System.out.println("동쪽");
        }

        switch (d) {
            case EAST:  System.out.println("→"); break;
            case SOUTH: System.out.println("↓"); break;
            case WEST:  System.out.println("←"); break;
            case NORTH: System.out.println("↑"); break;
        }
    }
}
```

#### 주요 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `values()` | 모든 상수를 배열로 반환 |
| `valueOf(String)` | 이름에 해당하는 상수 반환 |
| `ordinal()` | 정의 순서(0부터) |
| `name()` | 상수 이름(문자열) |

```java
for (Direction d : Direction.values()) {
    System.out.println(d.name() + " : " + d.ordinal());
}
// EAST : 0, SOUTH : 1, WEST : 2, NORTH : 3

Direction east = Direction.valueOf("EAST");
System.out.println(east);  // EAST

System.out.println(
    Direction.EAST.compareTo(Direction.NORTH));  // -3
```

---

### 2.3 열거형에 멤버 추가

상수에 값을 부여하고 필드·메서드를 둘 수 있다.

```java
enum Direction {
    EAST(1, "→"),
    SOUTH(2, "↓"),
    WEST(3, "←"),
    NORTH(4, "↑");  // 끝에 세미콜론 필수

    private final int value;
    private final String symbol;

    // 생성자는 private만 허용
    Direction(int value, String symbol) {
        this.value = value;
        this.symbol = symbol;
    }

    public int getValue() { return value; }
    public String getSymbol() { return symbol; }
}

for (Direction d : Direction.values()) {
    System.out.printf("%s: %d %s%n",
        d.name(), d.getValue(), d.getSymbol());
}
```

---

### 2.4 열거형에 추상 메서드

상수별로 다른 동작을 깔끔하게 표현할 수 있다.

```java
enum Operation {
    PLUS("+") {
        @Override
        public double apply(double x, double y) {
            return x + y;
        }
    },
    MINUS("-") {
        @Override
        public double apply(double x, double y) {
            return x - y;
        }
    },
    TIMES("*") {
        @Override
        public double apply(double x, double y) {
            return x * y;
        }
    },
    DIVIDE("/") {
        @Override
        public double apply(double x, double y) {
            return x / y;
        }
    };

    private final String symbol;

    Operation(String symbol) { this.symbol = symbol; }
    public String getSymbol() { return symbol; }

    public abstract double apply(double x, double y);
}

double x = 10, y = 3;
for (Operation op : Operation.values()) {
    System.out.printf("%.1f %s %.1f = %.1f%n",
        x, op.getSymbol(), y, op.apply(x, y));
}
```

---

### 2.5 EnumSet과 EnumMap

열거형 전용 Set/Map이다. 내부적으로 비트 벡터를 사용해 매우 빠르고 메모리 효율이 높다.

```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

// EnumSet
EnumSet<Day> weekdays = EnumSet.range(Day.MON, Day.FRI);
EnumSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);
EnumSet<Day> all = EnumSet.allOf(Day.class);

// EnumMap
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.MON, "회의");
schedule.put(Day.FRI, "코드 리뷰");
schedule.put(Day.SAT, "휴식");
```

{{< callout type="info" >}}
**왜 `HashSet`/`HashMap` 대신 `EnumSet`/`EnumMap`인가?** 키가 enum으로 고정되기 때문에 내부 구현이 `long` 비트 벡터나 배열이다. 해싱 오버헤드가 없고 순회 순서가 enum 선언 순서로 보장된다. enum 키라면 항상 이 쪽이 우선 선택이다.
{{< /callout >}}

---

## 3. 애너테이션 (Annotation)

### 3.1 애너테이션이란?

소스 코드에 **메타데이터를 부여**하는 수단이다. JDK 1.5부터 도입되었다.

**주요 용도**
1. **컴파일러 지시** — `@Override`, `@Deprecated`, `@SuppressWarnings`
2. **빌드/배포 처리** — 문서 생성, 코드 자동 생성 (annotation processor)
3. **런타임 처리** — 프레임워크가 리플렉션으로 읽어 동작 결정 (Spring, JPA 등)

---

### 3.2 표준 애너테이션

#### @Override

메서드가 조상 메서드를 오버라이딩함을 선언. 오타·시그니처 불일치를 컴파일 오류로 잡아낸다.

```java
class Parent {
    void method() {}
}

class Child extends Parent {
    @Override
    void method() {}  // OK

    @Override
    void methd() {}   // 컴파일 에러! (오타)
}
```

#### @Deprecated

사용 권장되지 않는 요소 표시. IDE와 컴파일러가 경고를 띄운다.

```java
class OldClass {
    @Deprecated
    public void oldMethod() { /* ... */ }

    public void newMethod() { /* ... */ }
}
```

#### @SuppressWarnings

컴파일러 경고 억제.

```java
@SuppressWarnings("unchecked")
public void method() {
    List list = new ArrayList();
}

@SuppressWarnings({"unchecked", "deprecation"})
public void method2() { /* ... */ }
```

| 경고 타입 | 설명 |
|:---------|:-----|
| `unchecked` | 지네릭 타입 미사용 경고 |
| `deprecation` | `@Deprecated` 요소 사용 경고 |
| `rawtypes` | 원시 타입 사용 경고 |
| `unused` | 사용되지 않는 변수 경고 |

#### @FunctionalInterface

추상 메서드가 정확히 하나인 **함수형 인터페이스**임을 명시한다.

```java
@FunctionalInterface
interface Calculator {
    int calculate(int a, int b);
    // int another(int x);  // 추가하면 컴파일 에러
}
```

#### @SafeVarargs

가변인자 + 제네릭 사용 시 발생하는 "heap pollution" 경고를 메서드 작성자가 안전함을 보장한다고 표시.

```java
@SafeVarargs
static <T> List<T> asList(T... elements) {
    return Arrays.asList(elements);
}
```

---

### 3.3 메타 애너테이션

애너테이션을 정의할 때 쓰는 애너테이션이다.

#### @Target

적용 가능한 대상 지정.

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@interface MyAnnotation {}
```

| ElementType | 대상 |
|:------------|:-----|
| `TYPE` | 클래스, 인터페이스, 열거형 |
| `FIELD` | 필드 |
| `METHOD` | 메서드 |
| `PARAMETER` | 매개변수 |
| `CONSTRUCTOR` | 생성자 |
| `LOCAL_VARIABLE` | 지역 변수 |
| `ANNOTATION_TYPE` | 애너테이션 |
| `PACKAGE` | 패키지 |
| `TYPE_PARAMETER` | 타입 매개변수 (1.8+) |
| `TYPE_USE` | 타입 사용 위치 (1.8+) |

#### @Retention

애너테이션 유지 기간(수명) 지정.

```java
@Retention(RetentionPolicy.RUNTIME)
@interface MyAnnotation {}
```

| RetentionPolicy | 설명 |
|:----------------|:-----|
| `SOURCE` | 소스에만 존재 (컴파일 시 제거) |
| `CLASS` | 클래스 파일까지 (런타임 접근 X, 기본값) |
| `RUNTIME` | 런타임까지 (리플렉션으로 접근 O) |

```
 SOURCE      CLASS       RUNTIME
   │           │            │
   ▼           ▼            ▼
소스코드 → 컴파일 → 클래스 → 실행
   └─ 컴파일러만 사용
       └─ 바이트코드에 기록
                └─ JVM에서 읽을 수 있음
```

#### @Documented

Javadoc에 포함.

```java
@Documented
@interface MyAnnotation {}
```

#### @Inherited

자손 클래스에 상속된다.

```java
@Inherited
@interface SuperAnnotation {}

@SuperAnnotation
class Parent {}

class Child extends Parent {}  // @SuperAnnotation 상속
```

#### @Repeatable

같은 애너테이션을 여러 번 적용 가능 (JDK 1.8+).

```java
@Repeatable(ToDos.class)
@interface ToDo {
    String value();
}

@interface ToDos {  // 컨테이너 애너테이션
    ToDo[] value();
}

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

#### 요소 규칙

1. 요소 타입: 기본형, `String`, `enum`, 애너테이션, `Class`, 이들의 배열
2. 메서드 매개변수 선언 불가
3. 예외 선언 불가
4. 요소 값으로 `null` 사용 불가 (대신 빈 문자열 또는 default 사용)

---

### 3.5 리플렉션으로 애너테이션 처리

런타임에 애너테이션 정보를 읽어 동작을 결정할 수 있다. Spring, JPA, JUnit 같은 프레임워크의 근간이다.

```
[소스] @Test                      실행 흐름:
  │
  ▼ (Retention=RUNTIME)           Class 로드
[바이트코드에 기록]                    ↓
  │                                리플렉션으로
  ▼                                애너테이션 조회
[JVM 로드]                            ↓
  │                                로직 분기
  └─ Method.getAnnotation()         (예: 메서드 실행)
```

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
    public void test1() { System.out.println("test1"); }

    @Test("테스트 2")
    public void test2() { System.out.println("test2"); }

    public void normal() { System.out.println("일반"); }

    public static void main(String[] args) throws Exception {
        TestRunner runner = new TestRunner();

        for (Method m : runner.getClass().getDeclaredMethods()) {
            if (m.isAnnotationPresent(Test.class)) {
                Test t = m.getAnnotation(Test.class);
                System.out.println("실행: " + t.value());
                m.invoke(runner);
            }
        }
    }
}
// 실행: 테스트 1
// test1
// 실행: 테스트 2
// test2
```

---

## 4. 실전 예제

### 지네릭 유틸리티 클래스

```java
public class GenericUtils {
    public static <T> boolean equals(T a, T b) {
        return (a == null) ? (b == null) : a.equals(b);
    }

    public static <T> T defaultIfNull(T value, T defaultValue) {
        return value != null ? value : defaultValue;
    }

    public static <T> List<T> filter(
            List<T> list, Predicate<T> predicate) {
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
        return this.ordinal() < next.ordinal()
            || next == CANCELLED;
    }
}

OrderStatus status = OrderStatus.PENDING;
System.out.println(status.getDescription());  // 주문 접수
System.out.println(
    status.canTransitionTo(OrderStatus.CONFIRMED));  // true

OrderStatus delivered = OrderStatus.DELIVERED;
System.out.println(
    delivered.canTransitionTo(OrderStatus.CANCELLED));
// false (이미 최종 상태)
```

---

## 5. 요약

| 개념 | 핵심 내용 |
|:-----|:---------|
| 지네릭스 | 컴파일 시 타입 체크, 형변환 생략, 재사용성 |
| 타입 변수 | `T`, `E`, `K`, `V` 등 참조형 타입 placeholder |
| 제한된 지네릭 | `<T extends X>` 형태로 상한 지정 |
| 와일드 카드 | `?`, `? extends T`, `? super T` |
| PECS | Producer `extends`, Consumer `super` |
| 타입 소거 | 컴파일 후 타입 정보 제거 → 런타임 제약 |
| 열거형 | 관련 상수 집합, 타입 안전, 멤버 추가 가능 |
| EnumSet/Map | 비트 벡터 기반의 고속 전용 컬렉션 |
| 애너테이션 | 소스에 메타데이터 부여 |
| 표준 애너테이션 | `@Override`, `@Deprecated`, `@SuppressWarnings` 등 |
| 메타 애너테이션 | `@Target`, `@Retention`, `@Inherited`, `@Repeatable` |
| 커스텀 애너테이션 | `@interface`로 정의, 요소는 기본값 지정 가능 |
