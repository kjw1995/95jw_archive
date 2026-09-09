---
title: "Chapter 12. 지네릭스, 열거형, 애너테이션"
date: 2026-01-08
weight: 12
---

Java 5(2004년)는 자바 문법이 가장 크게 바뀐 판이다. 지네릭스, 열거형, 애너테이션이 한꺼번에 들어왔고, [Chapter 04](../04-control-statements)의 `for-each`와 [Chapter 09](../09-java-lang-package)의 오토박싱도 이때 생겼다. 세 기능은 겉모습이 다르지만 한 방향을 가리킨다. **프로그래머가 이미 알고 있는 사실을 코드에 적게 하고, 컴파일러가 그것을 대신 검사한다.** 지네릭스는 "이 리스트에는 `String`만 들어간다"를, 열거형은 "이 값은 넷 중 하나다"를, 애너테이션은 "이 메서드는 조상의 것을 재정의한 것이다"를 적는 문법이고, 예전에는 실행해 봐야 알던 실수가 컴파일 오류가 된다. 앞 장들이 미뤄 둔 질문도 여기서 답한다. 배열의 공변이 낸 구멍을 지네릭스는 어떻게 피하는가([Chapter 05](../05-array)), 타입 인자에는 왜 `int`를 못 쓰는가(9장), 원시 타입으로 받은 리스트는 왜 엉뚱한 자리에서 터지는가([Chapter 11](../11-collections-framework)). 답은 하나로 모인다. **자바의 지네릭스는 컴파일러만 알고 JVM은 모른다.** 그 결정이 왜 내려졌고 무엇을 낳았는지가 이 장의 절반이다.

---

## 1. 지네릭스: 타입을 매개변수로

### 1.1 왜 필요한가

```java
// Java 5 이전
List list = new ArrayList();
list.add("hello");
list.add(42);                         // 컴파일러는 모른다
String s = (String) list.get(1);      // 실행 중 ClassCastException

// Java 5 이후
List<String> list = new ArrayList<>();
list.add("hello");
list.add(42);                         // 컴파일 오류
String s = list.get(0);               // 형변환 없이
```

Java 5 이전의 컬렉션은 `Object`를 담았다. 무엇이든 넣을 수 있다는 것은 무엇을 넣었는지 컴파일러가 모른다는 뜻이고, 꺼낼 때마다 프로그래머가 형변환으로 "이건 `String`이다"라고 선언해야 했다. 그 선언이 틀리면 실행 중에야 `ClassCastException`이 났고, 잘못 넣은 자리가 아니라 꺼내는 자리에서 났다. 지네릭스는 이 지식을 선언으로 옮긴다. `List<String>`이라고 적으면 넣는 자리에서 컴파일러가 막고, 꺼내는 자리의 형변환은 컴파일러가 대신 넣는다.

메서드가 값을 매개변수로 받듯 클래스가 타입을 매개변수로 받는다고 보면 된다. 그래서 `T`를 **타입 매개변수**라고 부른다. 얻는 것은 셋이다. 오류가 실행 시점에서 컴파일 시점으로 앞당겨지고, 형변환이 사라져 코드가 읽기 쉬워지며, 한 번 짠 클래스를 여러 타입에 재사용할 수 있다.

### 1.2 선언, 용어, 제한

```java
class Box<T> {
    private T item;
    void set(T item) { this.item = item; }
    T get() { return item; }
}

Box<String> sb = new Box<>();     // Java 7의 다이아몬드. 타입 인자를 추론한다
sb.set("Hello");
String s = sb.get();

Box<Integer> ib = new Box<>();
ib.set(100);
int n = ib.get();                 // 언박싱(9장)
```

| 용어 | 예 | 뜻 |
|:-----|:---|:---|
| 지네릭 클래스 | `Box<T>` | 타입 매개변수를 가진 클래스 |
| 타입 매개변수 | `T` | 나중에 채워질 타입의 자리 |
| 타입 인자 | `String` | 그 자리에 실제로 넣은 타입 |
| 매개변수화된 타입 | `Box<String>` | 타입 인자를 채운 타입 |
| 원시 타입(raw type) | `Box` | 타입 인자를 뺀 채 쓴 것. Java 5 이전 코드와의 호환용 |

타입 매개변수 이름은 관례가 있다. `T`(Type), `E`(Element, 컬렉션), `K`와 `V`(Key, Value), `R`(Result, 반환)이다. 한 글자로 쓰는 것은 일반 클래스 이름과 한눈에 구별하기 위해서다.

타입 매개변수에는 **상한**을 둘 수 있다. `<T extends Fruit>`라고 쓰면 `Fruit`와 그 자손만 타입 인자가 될 수 있고, 클래스 안에서 `T`를 `Fruit`로 취급할 수 있다. 상한이 없으면 `T`에 대해 할 수 있는 일은 `Object`의 메서드뿐이다.

```java
class FruitBox<T extends Fruit> {          // Fruit의 자손만
    List<T> list = new ArrayList<>();
    void add(T item) { list.add(item); }
}
class SaladBox<T extends Fruit & Eatable> { }   // 인터페이스도 extends. 여러 개는 &

FruitBox<Apple> apples = new FruitBox<>();
FruitBox<Toy> toys = new FruitBox<>();     // 컴파일 오류
```

인터페이스 제약에도 `implements`가 아니라 `extends`를 쓴다. 상한이 말하는 것은 "구현한다"가 아니라 "이 타입의 하위 타입이다"이고, [Chapter 07](../07-oop-advanced)에서 본 대로 인터페이스도 타입이기 때문이다.

메서드도 자기만의 타입 매개변수를 가질 수 있다. 반환 타입 앞의 `<T>`가 선언이고, 클래스의 `T`와는 이름만 같을 뿐 별개다.

```java
static <T> List<T> toList(T[] arr) {      // 지네릭 메서드
    return new ArrayList<>(Arrays.asList(arr));
}
static <T extends Comparable<? super T>> T max(T a, T b) {
    return a.compareTo(b) > 0 ? a : b;
}

List<String> list = toList(new String[]{"A", "B"});   // T = String으로 추론
max("apple", "banana");                                 // "banana"
max(10, 20);                                            // 20
Collections.<String>sort(list);                         // 추론이 안 될 때만 명시
```

호출할 때 타입 인자를 적지 않아도 인자에서 추론한다. `max`의 상한이 `Comparable<T>`가 아니라 `Comparable<? super T>`인 이유는 1.5절에서 와일드카드를 본 뒤에 밝힌다.

### 1.3 타입 소거: 하위 호환이 결정한 설계

```
소스        List<String> list
   │  컴파일러가 검사하고, 지우고,
   │  형변환을 끼워 넣는다
   ▼
클래스 파일  List list
            (String) list.get(0)
   │
   ▼
JVM         지네릭스를 모른다
```

Java 5의 설계자들에게는 선택지가 둘 있었다. 하나는 JVM이 `List<String>`과 `List<Integer>`를 실제로 다른 타입으로 알게 만드는 것이고(C#이 2005년에 택한 길), 다른 하나는 컴파일러만 알고 JVM은 예전 그대로 두는 것이다. 자바는 후자를 골랐다. 이미 세상에 깔린 수많은 클래스 파일과 라이브러리, 그리고 그것을 돌리는 JVM을 하나도 바꾸지 않고 지네릭스를 얹어야 했기 때문이다. 그래서 `java.util`의 컬렉션은 옛 코드와 새 코드가 섞여 돌 수 있었고, 같은 결정이 이 절 뒤의 모든 제약을 낳았다.

컴파일러가 하는 일은 셋이다. 타입 인자에 맞는지 **검사**하고, 타입 매개변수를 상한(없으면 `Object`)으로 **바꿔 지우고**, 값을 꺼내는 자리에 **형변환을 끼워 넣는다.** 이것을 타입 소거라고 한다.

```java
// 컴파일 전
class Box<T> {
    private T item;
    void set(T item) { this.item = item; }
    T get() { return item; }
}
class FruitBox<T extends Fruit> { private T item; }

// 컴파일 후. 실제로는 이렇게 생긴 클래스 파일이 만들어진다
class Box {
    private Object item;
    void set(Object item) { this.item = item; }
    Object get() { return item; }
}
class FruitBox { private Fruit item; }
```

그래서 실행 중에는 `new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()`가 `true`다. 둘은 같은 클래스의 인스턴스이고, 객체는 자기가 무엇을 담기로 했는지 모른다. 소거가 남긴 흔적이 둘 있다. `Comparable<Student>`를 구현하면 클래스 파일에는 `compareTo(Student)`와 함께 컴파일러가 만든 `compareTo(Object)`가 들어 있는데, 지워진 뒤에도 인터페이스의 약속을 지키기 위한 **브리지 메서드**다. 그리고 선언에 적은 타입 인자는 클래스 파일의 `Signature` 속성에 남아서 리플렉션으로 읽을 수 있다. 객체는 모르지만 선언은 안다는 이 차이를 이용하는 것이 JSON 라이브러리의 `TypeReference<List<String>>` 같은 장치다.

### 1.4 소거가 낳은 제약

지네릭스의 제약은 외울 것이 아니라 "지워진 뒤에도 말이 되는가"로 판정할 수 있다.

| 안 되는 것 | javac 메시지 | 이유 |
|:-----------|:-------------|:-----|
| `List<int>` | unexpected type, required: reference | 지우면 `Object` 자리라 기본형이 들어갈 수 없다. 9장 래퍼의 존재 이유 |
| `new T[n]` | generic array creation | 배열은 만들 때 요소 타입을 알아야 하는데(5장) `T`는 지워진다 |
| `T.class` | cannot select from a type variable | 실행 중에 없는 정보 |
| `o instanceof List<String>` | Object cannot be safely cast to List\<String\> | 객체는 타입 인자를 모른다 |
| `static T item` | non-static type variable T cannot be referenced from a static context | `T`는 인스턴스마다 정해지는데 `static`은 클래스에 하나 |
| `m(List<String>)`와 `m(List<Integer>)` 오버로딩 | have the same erasure | 지우면 시그니처가 같다 |

원시 타입은 이 제약이 뚫리는 통로다. 11장에서 본 것이 이것이다.

```java
List<String> strings = new ArrayList<>();
List raw = strings;                  // 경고만 난다. Java 5 이전 코드 호환용
raw.add(42);                         // 통과
String s = strings.get(0);           // 여기서 ClassCastException
```

넣는 자리에서는 검사할 정보가 없고, 꺼내는 자리에는 컴파일러가 끼워 넣은 `(String)` 형변환이 있어서 거기서 터진다. 잘못된 타입이 들어간 상태를 **힙 오염**이라 하고, 11장의 `Collections.checkedList()`가 넣는 순간 잡아 주는 것이 이 문제다. 원시 타입은 옛 코드와 잇는 자리에서만 쓰고 새 코드에는 쓰지 않는다.

지네릭 배열이 필요할 때는 우회한다. 안에서만 쓰는 배열은 `Object[]`로 만들어 `T[]`로 형변환하면 되지만, 그 배열을 밖으로 내보내면 안 된다.

```java
class Box<T> {
    @SuppressWarnings("unchecked")
    private T[] arr = (T[]) new Object[3];     // 안에서는 문제없다
    T[] getArr() { return arr; }
}
String[] s = new Box<String>().getArr();
// ClassCastException: [Ljava.lang.Object; cannot be cast to [Ljava.lang.String;
```

호출한 쪽에서는 `T[]`가 `String[]`이므로 컴파일러가 `String[]`로의 형변환을 끼워 넣는데, 실제 배열은 `Object[]`다. 진짜 `T[]`가 필요하면 타입을 실행 시점까지 들고 갈 방법이 하나뿐이다. `Class<T>` 객체를 인자로 받는 것이고, 이것을 타입 토큰이라 부른다.

```java
@SuppressWarnings("unchecked")
static <T> T[] create(Class<T> type, int n) {
    return (T[]) Array.newInstance(type, n);   // 진짜 String[]
}
String[] arr = create(String.class, 2);
```

가변 인자도 배열이라 같은 함정을 안고 있다. `<T> T[] pick(T a, T b)`처럼 지네릭 가변 인자를 만들어 돌려주면 안에서 만들어지는 배열은 `Object[]`이고, 받는 쪽에서 `String[]`로 받는 순간 예외가 난다. 그래서 컴파일러가 경고를 내고, 안전함을 작성자가 보증할 때만 3.2절의 `@SafeVarargs`로 경고를 끈다.

### 1.5 불공변과 와일드카드: 5장의 답

```java
Object[] objs = new String[1];
objs[0] = 1;                        // 실행 중 ArrayStoreException. 배열은 자기 타입을 안다

List<Number> nums = new ArrayList<Integer>();
// 컴파일 오류: ArrayList<Integer> cannot be converted to List<Number>
```

5장에서 배열은 공변이라 `String[]`을 `Object[]`로 볼 수 있고, 그 구멍을 JVM이 저장할 때마다 실제 요소 타입을 검사해서 막는다고 했다. 지네릭스는 그 검사를 할 수 없다. 소거된 `List`는 자기가 `Integer`용인지 모르므로, `List<Number>`로 보고 `1.5`를 넣어도 막을 사람이 없다. 실행 중에 못 막으면 컴파일 시점에 막는 수밖에 없고, 그래서 `List<Integer>`는 `List<Number>`의 하위 타입이 **아니다.** 이것이 불공변이며, 배열의 공변이 낸 구멍에 대한 지네릭스의 답이다. 실행 중 예외 대신 컴파일 오류를 택했다.

대신 불편이 생긴다. `Fruit` 상자를 받는 메서드에 `Apple` 상자를 못 넘긴다.

```java
static Juice makeJuice(FruitBox<Fruit> box) { ... }

makeJuice(new FruitBox<Fruit>());   // OK
makeJuice(new FruitBox<Apple>());   // 컴파일 오류. 다른 타입이다
```

와일드카드 `?`가 이 불편을 안전한 범위에서 푼다. `FruitBox<? extends Fruit>`는 "`Fruit`이거나 그 자손을 담은 상자 중 하나"라는 뜻이고, 어느 것인지는 모른다.

```
 <? extends Number>   Number와 그 자손
        Number
       /   |   \
  Integer Long Double

 <? super Integer>    Integer와 그 조상
        Object
          │
        Number
          │
        Integer
```

```java
static Juice makeJuice(FruitBox<? extends Fruit> box) {
    for (Fruit f : box.getList()) { ... }   // 꺼낸 것은 Fruit로 볼 수 있다
    // box.add(new Apple());                // 컴파일 오류
}
makeJuice(new FruitBox<Apple>());           // OK
makeJuice(new FruitBox<Grape>());           // OK
```

`? extends Fruit`에서 꺼낸 것은 무엇이든 `Fruit`이므로 읽을 수 있다. 그러나 넣을 수는 없다. 그 상자가 `FruitBox<Grape>`일지도 모르는데 `Apple`을 넣으면 안 되기 때문이고, 컴파일러는 "무엇을 넣어야 안전한지 모른다"는 뜻으로 `int cannot be converted to CAP#1` 같은 메시지를 낸다. 반대로 `? super Integer`는 "`Integer`이거나 그 조상을 담은 것"이라 `Integer`를 넣는 것은 항상 안전하지만, 꺼낸 것은 `Object`로만 받을 수 있다. 그 안에 `Number`가 들어 있을지 모르기 때문이다.

```java
static double sum(Collection<? extends Number> c) {    // 꺼내 쓴다
    double s = 0;
    for (Number n : c) s += n.doubleValue();
    return s;
}
static void fill(List<? super Integer> list) {         // 넣는다
    list.add(1);
    list.add(2);
}

sum(List.of(1, 2.5, 3L));         // 6.5
List<Number> nums = new ArrayList<>();
fill(nums);                       // Number는 Integer의 조상
```

이 규칙을 조슈아 블로크는 **PECS**로 줄였다. Producer는 `extends`, Consumer는 `super`. 꺼내 쓰기만 하면 `? extends T`, 넣기만 하면 `? super T`, 둘 다 하면 와일드카드 없이 `T`다. `Collections.copy(List<? super T> dest, List<? extends T> src)`가 교과서적인 예다. 11장에서 본 `sort(List<T> list, Comparator<? super T> c)`도 같은 이유다. `Student`를 비교할 때 `Comparator<Object>`를 넘겨도 되어야 하니 `super`다. 1.2절에서 미뤄 둔 `<T extends Comparable<? super T>>`도 마찬가지다. `Freshman`이 `Student`를 상속하며 `Comparable<Student>`를 물려받았을 때, `Comparable<T>`로 상한을 두면 `Freshman`은 `Comparable<Freshman>`이 아니라서 `max()`에 들어가지 못한다. `? super T`가 그 길을 열어 준다.

---

## 2. 열거형: 상수를 타입으로

### 2.1 int 상수의 세 가지 문제

```java
class Card {
    static final int CLOVER = 0, HEART = 1, DIAMOND = 2, SPADE = 3;   // 무늬
    static final int TWO = 0, THREE = 1, FOUR = 2;                     // 숫자
}
new Card(Card.TWO, Card.CLOVER);     // 인자 순서가 바뀌었는데 컴파일된다
Card.CLOVER == Card.TWO;             // 무늬와 숫자를 비교했는데 true
```

Java 5 이전에는 상수 집합을 `int`로 만들었다. 문제가 셋이다. 첫째, **타입이 없다.** 무늬 자리에 숫자를 넣어도, 아무 정수나 넣어도 컴파일러가 모른다. 둘째, **이름이 없다.** 출력하면 `0`이라 디버깅할 때 무늬인지 숫자인지 알 수 없다. 셋째, **값이 사용하는 쪽에 박힌다.** `static final int`는 컴파일 시점 상수라 컴파일러가 `Card.HEART`를 그 자리에서 `1`로 바꿔 버린다. 바이트코드를 열어 보면 `Card`를 참조하는 흔적조차 없다. 상수를 하나 끼워 넣거나 값을 바꾸면 그것을 쓰는 클래스를 전부 다시 컴파일해야 하고, 빠뜨린 클래스는 조용히 옛 값으로 돈다.

조슈아 블로크가 이 문제를 피하려고 클래스와 `private` 생성자, `public static final` 인스턴스로 상수를 만드는 **타입 안전 열거 패턴**을 정리했고(2001년), Java 5가 그것을 문법으로 만든 것이 `enum`이다.

### 2.2 enum의 정체: 컴파일러가 만드는 클래스

```java
enum Kind { CLOVER, HEART, DIAMOND, SPADE }

// 컴파일러가 실제로 만드는 것 (javap -p로 볼 수 있다)
final class Kind extends Enum<Kind> {
    public static final Kind CLOVER  = new Kind("CLOVER", 0);
    public static final Kind HEART   = new Kind("HEART", 1);
    // ...
    private static final Kind[] $VALUES = { CLOVER, HEART, DIAMOND, SPADE };

    private Kind(String name, int ordinal) { super(name, ordinal); }
    public static Kind[] values()          { return $VALUES.clone(); }
    public static Kind valueOf(String name) { ... }
}
```

열거형은 `java.lang.Enum`을 상속한 클래스이고, 상수 하나하나가 그 클래스의 **인스턴스**다. 이 한 가지에서 성질이 전부 나온다.

- **타입이다.** `Kind` 자리에 `int`도 다른 열거형도 들어갈 수 없다. `switch`에 상수를 빠뜨리면 Java 14의 `switch` 식은 "does not cover all possible input values"라는 컴파일 오류를 낸다.
- **인라이닝되지 않는다.** 상수는 객체 참조라 사용하는 쪽에 값이 박히지 않고, 상수를 추가해도 다시 컴파일할 필요가 없다.
- **인스턴스가 상수마다 하나뿐이다.** 생성자는 `private`로 강제되고(`public`을 붙이면 "modifier public not allowed here"), `clone()`은 예외를 던지며, 직렬화는 이름으로 한다. 그래서 `==` 비교가 안전하고 `equals()`도 `==`로 구현되어 있다.
- **이름과 순번을 안다.** `Enum`이 `name()`과 `ordinal()`을 갖고, `toString()`은 기본으로 이름을, `compareTo()`는 순번의 차이를 돌려준다.

```java
enum Direction { EAST, SOUTH, WEST, NORTH }

Direction d = Direction.EAST;
d == Direction.EAST;                    // true. 같은 인스턴스
d.name();                               // "EAST"
d.ordinal();                            // 0
Direction.WEST.compareTo(Direction.EAST);   // 2. 순번의 차이
Direction.valueOf("EAST");              // EAST
Direction.valueOf("east");
// IllegalArgumentException: No enum constant Direction.east

for (Direction dir : Direction.values()) { ... }   // 선언 순서대로

String arrow = switch (d) {             // 네 상수를 다 다루면 default가 필요 없다
    case EAST  -> "→";
    case SOUTH -> "↓";
    case WEST  -> "←";
    case NORTH -> "↑";
};
```

`values()`가 배열의 복사본을 돌려준다는 점은 알아 둘 만하다. 원본을 내주면 누군가 바꿀 수 있기 때문인데, 그래서 반복문 조건에서 매번 부르면 배열이 매번 만들어진다. [Chapter 10](../10-date-time-formatting)의 `Month`와 `DayOfWeek`가 이 열거형이고, `Calendar.MONTH`의 `int` 상수가 가진 문제 세 가지를 정확히 피한 것이다.

### 2.3 필드, 생성자, 상수별 동작

인스턴스이므로 필드와 메서드를 가질 수 있다. 상수 뒤의 괄호가 생성자 인자다.

```java
enum Direction {
    EAST(1, "→"), SOUTH(2, "↓"), WEST(3, "←"), NORTH(4, "↑");   // 세미콜론

    private final int value;
    private final String symbol;

    Direction(int value, String symbol) {      // private가 기본이자 유일한 선택
        this.value = value;
        this.symbol = symbol;
    }
    public int getValue()     { return value; }
    public String getSymbol() { return symbol; }

    public Direction turnRight() {
        return values()[(ordinal() + 1) % values().length];   // NORTH → EAST
    }
}
```

상수마다 동작이 달라야 하면 추상 메서드를 두고 상수마다 몸체를 붙인다. 이때 컴파일러는 상수마다 **익명 자손 클래스**를 만든다. `Op.PLUS.getClass()`가 `Op$1`인 이유이고, 그래서 이런 열거형은 `final`이 아니다. 상수의 진짜 열거형 클래스가 필요하면 `getDeclaringClass()`를 쓴다.

```java
enum Op {
    PLUS("+")  { double apply(double x, double y) { return x + y; } },
    MINUS("-") { double apply(double x, double y) { return x - y; } };

    private final String symbol;
    Op(String symbol) { this.symbol = symbol; }
    abstract double apply(double x, double y);
}
Op.PLUS.apply(10, 3);    // 13.0
```

7장의 다형성이 그대로 쓰인다. `switch`로 상수를 분기하는 대신 상수가 자기 동작을 들고 있으니, 상수를 추가할 때 빠뜨릴 `case`가 없다.

### 2.4 ordinal에 기대지 말라

`ordinal()`은 선언 순서다. 편해 보여서 의미를 실어 쓰기 쉬운데, 상수를 하나 끼워 넣는 순간 뒤의 번호가 전부 밀린다. 원서의 예제도 주문 상태의 전이를 "순번이 커지면 진행"으로 판정하는데, `CANCELLED`를 중간에 넣거나 `RETURNED`를 추가하면 규칙이 조용히 깨진다. 전이는 순번이 아니라 상수 자신이 말하게 한다.

```java
enum OrderStatus {
    PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED;

    public boolean canTransitionTo(OrderStatus next) {
        return switch (this) {
            case PENDING   -> next == CONFIRMED || next == CANCELLED;
            case CONFIRMED -> next == SHIPPED || next == CANCELLED;
            case SHIPPED   -> next == DELIVERED;
            case DELIVERED, CANCELLED -> false;    // 최종 상태
        };
    }
}
OrderStatus.PENDING.canTransitionTo(OrderStatus.CONFIRMED);     // true
OrderStatus.DELIVERED.canTransitionTo(OrderStatus.CANCELLED);   // false
```

`switch` 식이라 상수를 추가하면 컴파일러가 이 메서드를 고치라고 알려 준다. 순번을 저장하는 것은 더 위험하다. JPA 시리즈 [Chapter 07. 엔티티 매핑](../../jpa/07-entity-mapping)에서 `@Enumerated`의 기본값 `ORDINAL`이 왜 위험한지 봤는데, DB에 순번이 저장된 뒤 상수 순서가 바뀌면 운영 데이터의 뜻이 바뀐다. 저장하고 전송하는 것은 언제나 `name()`이다.

### 2.5 EnumSet과 EnumMap

열거형은 상수가 몇 개인지, 각각이 몇 번째인지를 컴파일 시점에 안다. 이 사실을 이용하면 해시보다 훨씬 싼 컬렉션을 만들 수 있다.

```
EnumSet.of(MON, WED, FRI)
 ordinal  6 5 4 3 2 1 0
 long     0 0 1 0 1 0 1
          SUN     FRI WED MON
 비트 하나가 상수 하나
```

`EnumSet`은 상수가 64개 이하면 `long` 하나의 비트로, 그보다 많으면 `long` 배열로 집합을 표현한다. 포함 여부는 비트 검사이고 합집합은 OR 한 번이다. `EnumMap`은 `ordinal()`을 인덱스로 쓰는 배열이라 해시 계산도 충돌도 없다. 둘 다 순회 순서가 선언 순서로 고정되는데, `HashMap`에 열거형을 키로 넣으면 순서가 해시코드(열거형은 `Object`의 기본 해시코드를 쓴다) 순이라 실행마다 달라질 수 있다.

```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

EnumSet<Day> weekdays = EnumSet.range(Day.MON, Day.FRI);   // [MON, TUE, WED, THU, FRI]
EnumSet<Day> weekend  = EnumSet.complementOf(weekdays);     // [SAT, SUN]
EnumSet<Day> all      = EnumSet.allOf(Day.class);

EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.FRI, "코드 리뷰");
schedule.put(Day.MON, "회의");
System.out.println(schedule);          // {MON=회의, FRI=코드 리뷰}. 선언 순서
```

2.4절에서 순번에 기대지 말라고 했는데 `EnumSet`과 `EnumMap`은 순번을 쓴다. 모순이 아니다. 순번을 저장하지 않고 실행 중에만 쓰므로 상수 순서가 바뀌어도 다음 실행에서 다시 계산된다. 위험한 것은 순번이 **프로세스 밖으로** 나가는 것이다.

---

## 3. 애너테이션: 코드에 붙이는 메타데이터

### 3.1 왜 필요한가

Java 5 이전에도 "이 코드에 대한 정보"를 적을 자리는 있었다. Javadoc 주석의 `@deprecated` 태그가 그것인데, 컴파일러가 경고를 내려고 **주석을 읽어야** 하는 기형이었다. 프레임워크 설정은 XML에 있었다. EJB 2와 초기 스프링은 어느 클래스가 어떤 빈인지를 XML에 적었고, 클래스 이름 오타는 실행해 봐야 알았다. XDoclet은 주석 태그로 XML을 생성하는 도구였고, JUnit 3는 메서드 이름이 `test`로 시작하면 테스트라는 **명명 관례**를 썼다. 방법은 달라도 문제는 같다. 정보가 코드 밖(주석, XML, 이름)에 있어서 컴파일러가 검사할 수 없고, 코드와 따로 놀다 어긋난다.

애너테이션은 그 정보를 선언 바로 옆에 **구조화된 형태**로 붙인다. 애너테이션 자체는 아무 일도 하지 않는다. 읽는 쪽이 있어야 의미가 생기고, 읽는 쪽은 셋이다.

| 읽는 쪽 | 예 | 언제 |
|:--------|:---|:-----|
| 컴파일러 | `@Override`, `@SuppressWarnings` | 컴파일 중 검사, 경고 제어 |
| 빌드 도구(애너테이션 프로세서) | Lombok의 `@Getter`, MapStruct | 컴파일 중 코드 생성 |
| 실행 중인 프레임워크(리플렉션) | JUnit의 `@Test`, JPA의 `@Entity`, 스프링의 `@Autowired` | 실행 중 동작 결정 |

### 3.2 표준 애너테이션

```java
class Parent { void method() {} }
class Child extends Parent {
    @Override void method() {}     // OK
    @Override void methd() {}      // 컴파일 오류: method does not override
                                   // or implement a method from a supertype
}
```

`@Override`는 "재정의할 의도"를 컴파일러에게 알린다. 없어도 재정의는 되지만, 이름이나 매개변수를 잘못 적으면 재정의가 아니라 **새 메서드**가 되어 조용히 넘어간다. 7장에서 본 대로 재정의는 시그니처가 정확히 같아야 하는데, 그 실수를 컴파일러가 잡게 하는 것이 이 애너테이션의 전부다.

`@Deprecated`는 쓰지 말라는 표시다. Java 9부터 언제부터인지(`since`)와 제거될 예정인지(`forRemoval`)를 적을 수 있고, `Thread.stop()`에는 `@Deprecated(since="1.2", forRemoval=true)`가 붙어 있다. `@SuppressWarnings`는 컴파일러 경고를 끈다. 1.4절의 `(T[]) new Object[n]`처럼 작성자가 안전을 확인한 자리에 범위를 최소로 붙인다.

| 경고 이름 | 뜻 |
|:----------|:---|
| `unchecked` | 검사되지 않은 형변환. 지네릭스 |
| `rawtypes` | 원시 타입 사용 |
| `deprecation` | `@Deprecated` 요소 사용 |
| `removal` | 제거 예정 요소 사용 |

`@FunctionalInterface`는 추상 메서드가 하나뿐임을 선언한다. 하나 더 추가하면 "multiple non-overriding abstract methods found"로 컴파일이 실패하므로, [Chapter 14](../14-lambda-stream)의 람다가 들어갈 자리를 누군가 실수로 깨는 일을 막는다. `@SafeVarargs`는 1.4절의 지네릭 가변 인자 경고를 작성자 책임으로 끄는 것이고, 재정의될 수 없는 `static`, `final`, `private` 메서드와 생성자에만 붙일 수 있다. 자손이 안전하지 않은 구현으로 바꿀 수 있으면 보증이 무의미하기 때문이다.

### 3.3 애너테이션의 정체와 메타 애너테이션

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface TestInfo {
    String author() default "unknown";
    String date();                       // 기본값이 없으면 필수
    int version() default 1;
    String[] tags() default {};
}

@TestInfo(author = "홍길동", date = "2024-01-15", tags = {"service", "api"})
public void testMethod() {}
```

`@interface`로 선언하는 애너테이션은 실제로 `java.lang.annotation.Annotation`을 상속한 **인터페이스**다. 요소는 매개변수 없는 추상 메서드이고, 실행 중에 `getAnnotation()`으로 받는 객체는 JVM이 만든 동적 프록시다. 요소 타입은 기본형, `String`, `Class`, 열거형, 다른 애너테이션, 그리고 이들의 배열로 제한된다. 클래스 파일의 상수 풀에 들어갈 수 있는 것들이기 때문이고, 같은 이유로 `null`은 값이 될 수 없다. 요소가 `value` 하나뿐이면 `@Test("이름")`처럼 이름을 생략할 수 있다.

애너테이션을 정의할 때 붙이는 애너테이션을 메타 애너테이션이라 한다. 둘이 중요하다.

`@Target`은 붙일 수 있는 자리다. `TYPE`(클래스, 인터페이스, 열거형), `FIELD`, `METHOD`, `PARAMETER`, `CONSTRUCTOR`, `LOCAL_VARIABLE`, `ANNOTATION_TYPE`, `PACKAGE`가 있고, Java 8이 `TYPE_PARAMETER`와 `TYPE_USE`를 더해 `List<@NonNull String>`처럼 타입이 쓰이는 모든 자리에 붙일 수 있게 했다.

`@Retention`은 애너테이션이 **어디까지 살아남는가**다.

```
소스 ──▶ 클래스 파일 ──▶ JVM 메모리
 SOURCE     CLASS         RUNTIME
 @Override  기본값        @Deprecated
            (도구용)      리플렉션 가능
```

| 정책 | 남는 곳 | 예 |
|:-----|:--------|:---|
| `SOURCE` | 소스에만. 컴파일러가 읽고 버린다 | `@Override`, `@SuppressWarnings` |
| `CLASS` | 클래스 파일까지. JVM은 읽지 않는다. **기본값** | 바이트코드 도구용 |
| `RUNTIME` | 실행 중 리플렉션으로 읽는다 | `@Deprecated`, `@FunctionalInterface`, 프레임워크 애너테이션 |

`@Override`가 실행 중에 남아 있을 이유가 없고, 프레임워크가 읽어야 하는 것은 남아 있어야 한다. 직접 만든 애너테이션에서 가장 흔한 실수가 `@Retention`을 빼먹는 것이다. 기본값이 `CLASS`라서 클래스 파일에는 들어가지만 `isAnnotationPresent()`는 `false`를 돌려주고, 프레임워크는 아무 일도 하지 않는다. 컴파일 오류도 실행 오류도 없다.

나머지 셋은 쓰임이 좁다. `@Documented`는 Javadoc에 포함시키고, `@Inherited`는 클래스에 붙인 애너테이션을 자손 클래스가 물려받게 한다. 클래스 애너테이션에만 적용되고 메서드에는 적용되지 않는다. `@Repeatable`(Java 8)은 같은 애너테이션을 여러 번 붙일 수 있게 하는데, 실제로는 컴파일러가 배열을 가진 컨테이너 애너테이션 하나로 감싸므로 컨테이너 타입을 함께 정의해야 한다.

```java
@Repeatable(ToDos.class)
@interface ToDo { String value(); }
@interface ToDos { ToDo[] value(); }       // 컨테이너

@ToDo("기능 구현")
@ToDo("테스트 작성")
class MyClass {}
// 실제로는 @ToDos({@ToDo("기능 구현"), @ToDo("테스트 작성")})
```

### 3.4 직접 만들고 리플렉션으로 읽기

```
소스의 @Test
   │ RUNTIME이면 클래스 파일에 남는다
   ▼
Class 객체
   │ getDeclaredMethods()
   │ isAnnotationPresent(Test.class)
   ▼
invoke()  ← 애너테이션이 붙은 것만 실행
```

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@interface Test { String value() default ""; }

class TestRunner {
    @Test("첫 번째") public void t1() { System.out.println("t1 실행"); }
    @Test           public void t2() { System.out.println("t2 실행"); }
    public void normal()             { System.out.println("일반"); }

    public static void main(String[] args) throws Exception {
        TestRunner runner = new TestRunner();
        for (Method m : TestRunner.class.getDeclaredMethods()) {
            if (m.isAnnotationPresent(Test.class)) {
                Test t = m.getAnnotation(Test.class);
                System.out.println("실행: " + m.getName() + " " + t.value());
                m.invoke(runner);
            }
        }
    }
}
// 실행: t1 첫 번째
// t1 실행
// 실행: t2
// t2 실행
```

이 스무 줄이 JUnit의 뼈대다. `Class` 객체로 메서드 목록을 얻고, 애너테이션이 붙은 것만 골라 부른다. JPA가 `@Entity`와 `@Id`를 보고 테이블 매핑을 만드는 것도, 스프링이 [컴포넌트 스캔](../../../spring/spring-component-scan)으로 `@Component`가 붙은 클래스를 찾아 빈으로 등록하는 것도 같은 구조다. 프레임워크가 "설정 없이" 동작하는 것처럼 보이는 이유는 설정이 없어서가 아니라 설정이 코드 옆에 애너테이션으로 붙어 있고, 프레임워크가 시작할 때 그것을 리플렉션으로 읽기 때문이다.

리플렉션은 비싸다. 메서드를 이름으로 찾고 검사하는 일이 일반 호출보다 훨씬 느려서, 프레임워크는 시작할 때 한 번 읽어 결과를 캐시한다. 컴파일 시점에 처리하는 쪽을 택한 것이 애너테이션 프로세서다. Lombok의 `@Getter`는 실행 중에 읽히는 것이 아니라 컴파일러 안에서 getter 코드를 만들어 넣고, 그래서 `RUNTIME`이 아니라 `SOURCE`로 충분하다.

---

## 4. 실전 예제

### 4.1 지네릭 유틸리티

```java
public class GenericUtils {
    public static <T> T defaultIfNull(T value, T defaultValue) {
        return value != null ? value : defaultValue;
    }

    public static <T> List<T> filter(List<T> list, Predicate<? super T> test) {
        List<T> result = new ArrayList<>();
        for (T item : list) {
            if (test.test(item)) result.add(item);
        }
        return result;
    }

    public static <T extends Comparable<? super T>> T max(T a, T b) {
        return a.compareTo(b) > 0 ? a : b;
    }
}

GenericUtils.defaultIfNull(null, "기본값");            // "기본값"
GenericUtils.filter(List.of(1, 2, 3, 4), n -> n % 2 == 0);   // [2, 4]

Predicate<Object> notNull = Objects::nonNull;
GenericUtils.filter(Arrays.asList("a", null, "b"), notNull);   // [a, b]. super 덕분
```

`filter`의 `Predicate<? super T>`가 PECS의 Consumer다. `T`를 받아 소비하는 자리이므로 `Predicate<Object>`처럼 더 넓은 것을 넘겨도 된다.

### 4.2 열거형으로 상태 관리

```java
enum OrderStatus {
    PENDING("주문 접수"), CONFIRMED("주문 확인"), SHIPPED("배송 중"),
    DELIVERED("배송 완료"), CANCELLED("주문 취소");

    private final String description;
    OrderStatus(String description) { this.description = description; }
    public String getDescription() { return description; }

    public boolean isFinal() {
        return this == DELIVERED || this == CANCELLED;
    }

    public boolean canTransitionTo(OrderStatus next) {
        return switch (this) {
            case PENDING   -> next == CONFIRMED || next == CANCELLED;
            case CONFIRMED -> next == SHIPPED || next == CANCELLED;
            case SHIPPED   -> next == DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };
    }
}

OrderStatus status = OrderStatus.PENDING;
status.getDescription();                                  // 주문 접수
status.canTransitionTo(OrderStatus.CONFIRMED);            // true
OrderStatus.SHIPPED.canTransitionTo(OrderStatus.CANCELLED);   // false. 배송 중엔 취소 불가
```

상태의 이름, 설명, 전이 규칙이 한 타입 안에 있고, 잘못된 상태는 컴파일 오류이며, 상태를 추가하면 `switch` 식이 빠진 자리를 알려 준다. 이 장의 원리 그대로다.

---

## 5. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| Java 5의 세 기능 | 아는 것을 코드에 적고 컴파일러가 검사 | 실행 시점 오류를 컴파일 시점으로 |
| 지네릭스 | 타입을 매개변수로 | 형변환과 그 실수를 컴파일러에게 넘긴다 |
| 타입 소거 | JVM은 지네릭스를 모른다 | 기존 클래스 파일, 라이브러리, JVM과의 호환 |
| 컴파일러의 일 | 검사, 소거, 형변환 삽입 | 실행 코드는 Java 5 이전과 같다 |
| 제약들 | `List<int>`, `new T[]`, `T.class`, `static T` 불가 | 지워진 뒤에 말이 되지 않는다 |
| 원시 타입 | 힙 오염. 꺼내는 자리에서 예외 | 넣는 자리에는 검사할 정보가 없다 |
| 타입 토큰 | `Class<T>`를 인자로 | 타입을 실행 시점까지 들고 가는 유일한 길 |
| 불공변 | `List<Integer>`는 `List<Number>`가 아니다 | 배열과 달리 실행 중 검사가 불가능하다 |
| 와일드카드 | `? extends`는 읽기, `? super`는 쓰기 | 무엇이 들었는지 모르는 채로 안전한 연산만 |
| PECS | Producer extends, Consumer super | 꺼내면 상한, 넣으면 하한 |
| 열거형 | `Enum`의 자손 클래스, 상수는 인스턴스 | 타입 안전, 이름, 인라이닝 없음 |
| `==` 비교 | 안전하다 | 생성자가 `private`라 인스턴스가 하나뿐 |
| `ordinal()` | 저장·전송에 쓰지 않는다 | 상수를 끼워 넣으면 뒤가 밀린다. `name()`을 쓴다 |
| `EnumSet` / `EnumMap` | 비트 벡터 / 배열 | 상수 개수와 순번을 컴파일 시점에 안다 |
| 상수별 몸체 | 익명 자손 클래스 | `switch` 대신 다형성. 빠뜨릴 `case`가 없다 |
| 애너테이션 | 선언 옆의 구조화된 메타데이터 | 주석, XML, 명명 관례는 컴파일러가 검사 못 한다 |
| 읽는 쪽 셋 | 컴파일러, 프로세서, 리플렉션 | 애너테이션 자체는 아무 일도 하지 않는다 |
| `@Retention` | 기본 `CLASS`. 프레임워크용은 `RUNTIME` | 빼먹으면 조용히 무시된다 |
| `@Override` | 재정의 의도를 검사 | 시그니처 오타는 새 메서드가 되어 조용히 넘어간다 |
| 리플렉션 처리 | `getDeclaredMethods` → `isAnnotationPresent` → `invoke` | JUnit, JPA, 스프링의 뼈대 |
