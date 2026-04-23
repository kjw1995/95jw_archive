---
title: "Chapter 09. java.lang 패키지와 유용한 클래스"
weight: 9
---

자바 프로그래밍에 가장 기본이 되는 `java.lang` 패키지의 핵심 클래스들을 다룬다. `Object`, `String`, `StringBuffer`/`StringBuilder`, `Math`, 그리고 래퍼 클래스를 차례로 살펴본다.

---

## 1. Object 클래스

`Object`는 모든 클래스의 최고 조상이다. 멤버변수 없이 11개의 메서드만 가지고 있으며, 모든 자바 클래스는 이 메서드들을 상속받는다.

### 1.1 Object의 주요 메서드

| 메서드 | 설명 |
|:-------|:-----|
| `boolean equals(Object obj)` | 객체 자신과 `obj`가 같은지 비교 |
| `int hashCode()` | 객체의 해시코드 반환 |
| `String toString()` | 객체 정보를 문자열로 반환 |
| `protected Object clone()` | 객체의 복사본 반환 |
| `Class getClass()` | 객체의 `Class` 인스턴스 반환 |
| `protected void finalize()` | GC에 의해 호출 (거의 사용 안 함) |
| `void notify()` | 대기 쓰레드 하나를 깨움 |
| `void notifyAll()` | 대기 쓰레드 전부를 깨움 |
| `void wait()` | `notify()`를 받을 때까지 대기 |

### 1.2 equals(Object obj)

`Object`의 `equals()`는 기본적으로 **주소값(참조)**을 비교한다.

```java
// Object의 equals() 원본
public boolean equals(Object obj) {
    return (this == obj);  // 주소값 비교
}
```

#### 주소 비교 vs 내용 비교

```java
// 기본 equals() - 주소 비교
Object obj1 = new Object();
Object obj2 = new Object();
System.out.println(obj1.equals(obj2));  // false

// String의 equals() - 내용 비교 (오버라이딩됨)
String s1 = new String("hello");
String s2 = new String("hello");
System.out.println(s1 == s2);       // false (주소 다름)
System.out.println(s1.equals(s2));  // true  (내용 같음)
```

#### equals() 오버라이딩

```java
public class Person {
    private long id;
    private String name;

    public Person(long id, String name) {
        this.id = id;
        this.name = name;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        Person other = (Person) obj;
        return this.id == other.id;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(id);
    }
}

Person p1 = new Person(1L, "홍길동");
Person p2 = new Person(1L, "홍길동");
System.out.println(p1.equals(p2));  // true
```

{{< callout type="warning" >}}
**`equals()`를 오버라이딩하면 `hashCode()`도 반드시 함께 오버라이딩해야 한다.** `HashMap`, `HashSet` 등에서 `equals()`가 true인 두 객체는 반드시 같은 해시코드를 가져야 한다. 그렇지 않으면 같은 객체임에도 해시 기반 컬렉션에서 서로 다른 버킷에 저장되어 올바르게 동작하지 않는다.
{{< /callout >}}

### 1.3 hashCode()

해싱 기법에 사용되는 해시함수를 구현한 것이다. 기본 구현은 객체의 주소값을 이용하므로 서로 다른 두 객체는 같은 해시코드를 가질 수 없다.

```java
String s1 = new String("abc");
String s2 = new String("abc");

// String은 hashCode()도 오버라이딩되어 있다
System.out.println(s1.hashCode());  // 96354
System.out.println(s2.hashCode());  // 96354

// identityHashCode()는 Object의 원래 hashCode() (주소 기반)
System.out.println(System.identityHashCode(s1));  // 예: 366712642
System.out.println(System.identityHashCode(s2));  // 예: 1829164700
```

### 1.4 toString()

기본적으로 `클래스이름@16진수해시코드` 형태를 반환한다.

```java
// Object의 toString() 원본
public String toString() {
    return getClass().getName()
         + "@" + Integer.toHexString(hashCode());
}
```

```java
public class Card {
    private String suit;
    private int number;

    public Card(String suit, int number) {
        this.suit = suit;
        this.number = number;
    }

    @Override
    public String toString() {
        return suit + " " + number;
    }
}

Card card = new Card("SPADE", 1);
System.out.println(card);  // "SPADE 1"
```

### 1.5 clone()

객체 자신의 복사본을 반환한다. `Cloneable` 인터페이스를 구현한 클래스만 호출할 수 있다.

#### 얕은 복사 vs 깊은 복사

```java
// 얕은 복사: 참조값만 복사
public class ShallowCopy implements Cloneable {
    int[] arr;

    public ShallowCopy(int[] arr) { this.arr = arr; }

    @Override
    public ShallowCopy clone()
            throws CloneNotSupportedException {
        return (ShallowCopy) super.clone();
    }
}

ShallowCopy original = new ShallowCopy(new int[]{1, 2, 3});
ShallowCopy copy = original.clone();
copy.arr[0] = 99;
System.out.println(original.arr[0]);  // 99 — 원본도 변경됨!
```

```java
// 깊은 복사: 참조하는 객체까지 복사
public class DeepCopy implements Cloneable {
    int[] arr;

    public DeepCopy(int[] arr) { this.arr = arr; }

    @Override
    public DeepCopy clone()
            throws CloneNotSupportedException {
        DeepCopy copy = (DeepCopy) super.clone();
        copy.arr = this.arr.clone();  // 별도 복사
        return copy;
    }
}

DeepCopy original = new DeepCopy(new int[]{1, 2, 3});
DeepCopy copy = original.clone();
copy.arr[0] = 99;
System.out.println(original.arr[0]);  // 1 — 원본 영향 없음
```

### 1.6 getClass()

자신이 속한 클래스의 `Class` 객체를 반환한다. `Class` 객체는 클래스의 모든 정보를 담고 있으며 클래스당 1개만 존재한다.

```java
Card card = new Card("HEART", 3);
Class clazz = card.getClass();

System.out.println(clazz.getName());         // Card
System.out.println(clazz.getSimpleName());   // Card
System.out.println(clazz.getSuperclass());   // class java.lang.Object

// Class 객체를 얻는 3가지 방법
Class c1 = card.getClass();         // 인스턴스로부터
Class c2 = Card.class;              // 클래스 리터럴
Class c3 = Class.forName("Card");   // 문자열(FQCN)로부터
```

---

## 2. String 클래스

### 2.1 String의 불변성 (Immutability)

`String` 인스턴스가 갖고 있는 문자열은 읽어올 수만 있고 변경할 수 없다.

```java
String a = "hello";
String b = a + " world";  // 새로운 String 인스턴스 생성

System.out.println(a);  // "hello"
System.out.println(b);  // "hello world"
```

{{< callout type="info" >}}
**왜 String은 불변인가?**
- **보안**: URL, 파일 경로, DB 연결 정보 등이 도중에 변경되면 심각한 보안 문제가 발생한다
- **동기화**: 불변 객체는 멀티쓰레드 환경에서 별도 동기화 없이 안전하게 공유할 수 있다
- **해시코드 캐싱**: `HashMap`의 키로 사용 시 해시코드를 한 번만 계산하여 캐싱할 수 있다
- **String Pool 공유**: JVM이 동일한 문자열 리터럴을 하나의 객체로 재사용할 수 있다
{{< /callout >}}

### 2.2 문자열 리터럴과 String Pool

```java
// 리터럴 — String Pool에서 공유
String s1 = "hello";
String s2 = "hello";
System.out.println(s1 == s2);  // true

// new — 매번 새 객체 생성
String s3 = new String("hello");
String s4 = new String("hello");
System.out.println(s3 == s4);       // false
System.out.println(s3.equals(s4));  // true
```

```
 String Pool        Heap
┌──────────┐   ┌───────────┐
│ "hello"  │   │ "hello"   │
│  ▲   ▲   │   │   ▲       │
│  │   │   │   │   │       │
│  s1  s2  │   │   s3      │
└──────────┘   │ "hello"   │
               │   ▲       │
               │   │       │
               │   s4      │
               └───────────┘
```

`s1`과 `s2`는 Pool의 같은 객체를 참조하고, `s3`·`s4`는 Heap에 각각 생성된 별도 객체를 참조한다.

### 2.3 빈 문자열 (Empty String)

```java
String empty = "";
System.out.println(empty.length());  // 0

String s = "";    // ○ 빈 문자열로 초기화
char c = ' ';     // ○ 공백 문자로 초기화
// char c = '';   // ✕ 컴파일 에러 (char는 빈 문자 불가)
```

### 2.4 String의 주요 메서드

| 메서드 | 설명 | 예시 |
|:-------|:-----|:-----|
| `charAt(int index)` | 지정 인덱스 문자 반환 | `"abc".charAt(0)` → `'a'` |
| `length()` | 문자열 길이 | `"hello".length()` → `5` |
| `substring(int, int)` | 부분 문자열 | `"hello".substring(0,3)` → `"hel"` |
| `contains(CharSequence)` | 포함 여부 | `"hello".contains("ell")` → `true` |
| `indexOf(String)` | 위치 반환 (없으면 -1) | `"hello".indexOf("ll")` → `2` |
| `replace(char, char)` | 문자 치환 | `"aabb".replace('a','c')` → `"ccbb"` |
| `trim()` | 양쪽 공백 제거 | `" hi ".trim()` → `"hi"` |
| `toUpperCase()` | 대문자 변환 | `"abc".toUpperCase()` → `"ABC"` |
| `toLowerCase()` | 소문자 변환 | `"ABC".toLowerCase()` → `"abc"` |
| `split(String)` | 구분자로 분할 | `"a,b".split(",")` → `["a","b"]` |
| `String.join(d, ...)` | 구분자로 결합 | `String.join("-","a","b")` → `"a-b"` |
| `String.valueOf(x)` | 기본형 → 문자열 | `String.valueOf(123)` → `"123"` |
| `compareTo(String)` | 사전순 비교 | `"a".compareTo("b")` → `-1` |

```java
// 실전 활용: 이메일 정규화
String email = "  USER@example.COM  ";
String normalized = email.trim().toLowerCase();
System.out.println(normalized);  // "user@example.com"

String[] parts = normalized.split("@");
System.out.println("아이디: " + parts[0]);  // "user"
System.out.println("도메인: " + parts[1]);  // "example.com"
```

### 2.5 문자열과 기본형 간 변환

```java
// 기본형 → 문자열
String s1 = String.valueOf(100);   // "100"
String s2 = 100 + "";              // "100" (성능은 valueOf가 우수)

// 문자열 → 기본형
int i = Integer.parseInt("100");
double d = Double.parseDouble("3.14");

// 진법 변환
int hex = Integer.parseInt("FF", 16);     // 255
int bin = Integer.parseInt("1010", 2);    // 10
```

---

## 3. StringBuffer와 StringBuilder

### 3.1 StringBuffer의 특징

`String`은 불변이므로 문자열을 변경할 때마다 새 인스턴스가 생성된다. `StringBuffer`는 내부 `char` 배열 버퍼에서 직접 문자열을 편집한다.

```java
// String — 매 반복마다 새 객체 생성 (느림)
String s = "";
for (int i = 0; i < 10000; i++) {
    s += i;
}

// StringBuffer — 하나의 버퍼에서 편집 (빠름)
StringBuffer sb = new StringBuffer();
for (int i = 0; i < 10000; i++) {
    sb.append(i);
}
String result = sb.toString();
```

### 3.2 StringBuffer의 생성자

```java
StringBuffer sb1 = new StringBuffer();         // 기본: 16
StringBuffer sb2 = new StringBuffer(100);      // 용량 100
StringBuffer sb3 = new StringBuffer("hello");  // 5 + 16 = 21
```

버퍼 크기가 부족하면 내부적으로 새 배열을 생성하고 복사한다.

```java
// 버퍼 확장 시 내부 동작 (대략)
char newValue[] = new char[newCapacity];
System.arraycopy(value, 0, newValue, 0, count);
value = newValue;
```

### 3.3 StringBuffer의 변경

`append()`는 자기 자신을 반환하므로 메서드 체이닝이 가능하다.

```java
StringBuffer sb = new StringBuffer("abc");
sb.append("123").append("ZZ");
System.out.println(sb);  // "abc123ZZ"

StringBuffer sb2 = new StringBuffer("Hello World");
sb2.insert(5, ",");            // "Hello, World"
sb2.delete(5, 6);              // "Hello World"
sb2.replace(6, 11, "Java");    // "Hello Java"
sb2.reverse();                 // "avaJ olleH"

System.out.println(sb2.capacity());  // 버퍼 크기
System.out.println(sb2.length());    // 문자열 길이
```

### 3.4 StringBuffer의 비교

`StringBuffer`는 `equals()`를 오버라이딩하지 않았다. 내용 비교를 하려면 `String`으로 변환 후 비교해야 한다.

```java
StringBuffer sb1 = new StringBuffer("abc");
StringBuffer sb2 = new StringBuffer("abc");

System.out.println(sb1 == sb2);       // false
System.out.println(sb1.equals(sb2));  // false (주소 비교)

// 내용 비교: toString() 후 equals()
System.out.println(sb1.toString()
                      .equals(sb2.toString()));  // true
```

### 3.5 StringBuilder

`StringBuffer`와 기능은 동일하지만 동기화(synchronized)가 제거된 버전이다.

| 클래스 | 쓰레드 안전 | 성능 | 사용 시점 |
|:-------|:-----------|:-----|:---------|
| `StringBuffer` | O (동기화) | 상대적으로 느림 | 멀티쓰레드 환경 |
| `StringBuilder` | X | 빠름 | 싱글쓰레드 환경 |

```java
// 실무에서는 대부분 StringBuilder 사용
StringBuilder sb = new StringBuilder();
sb.append("Hello").append(" ").append("World");
System.out.println(sb.toString());  // "Hello World"
```

{{< callout type="warning" >}}
**`StringBuilder`는 쓰레드 안전하지 않다.** 여러 쓰레드가 동일한 `StringBuilder` 인스턴스에 동시에 `append()` 등을 호출하면 내부 상태가 깨져 예상치 못한 결과가 나오거나 `ArrayIndexOutOfBoundsException`이 발생할 수 있다. 공유 객체라면 `StringBuffer`를 쓰거나 명시적으로 락을 걸어야 한다.
{{< /callout >}}

{{< callout type="info" >}}
**선택 기준 정리:**
- 문자열 변경이 거의 없음 → `String`
- 싱글쓰레드에서 변경이 빈번 → `StringBuilder` (대부분의 실무 케이스)
- 멀티쓰레드에서 공유하며 변경 → `StringBuffer`
{{< /callout >}}

---

## 4. Math 클래스

수학 계산에 유용한 메서드들의 모음이다. 생성자가 `private`이므로 인스턴스를 만들 수 없고 모든 메서드가 `static`이다.

### 4.1 올림, 버림, 반올림

| 메서드 | 설명 | 예시 |
|:-------|:-----|:-----|
| `Math.ceil(double)` | 올림 | `ceil(1.1)` → `2.0` |
| `Math.floor(double)` | 버림 | `floor(1.9)` → `1.0` |
| `Math.round(double)` | 반올림 (long) | `round(1.5)` → `2` |
| `Math.rint(double)` | 짝수 쪽으로 반올림 | `rint(1.5)` → `2.0` |

#### 소수점 n째 자리 반올림

```java
// 소수점 셋째 자리에서 반올림하여 둘째 자리까지 표시
double val = 90.7552;

// 1) 100을 곱함      → 9075.52
// 2) round()         → 9076
// 3) 100.0으로 나눔  → 90.76
double result = Math.round(val * 100) / 100.0;
System.out.println(result);  // 90.76
```

{{< callout type="warning" >}}
**정수 `100`으로 나누면 정수 나눗셈이 되어 소수점이 버려진다.** 반드시 `100.0`을 사용해야 한다.
```java
9076 / 100    → 90     (정수 나눗셈)
9076 / 100.0  → 90.76  (실수 나눗셈)
```
{{< /callout >}}

#### round() vs rint()

```java
System.out.println(Math.round(1.5));   // 2   (큰 값으로)
System.out.println(Math.rint(1.5));    // 2.0 (짝수 쪽)
System.out.println(Math.rint(2.5));    // 2.0 (짝수 쪽)

System.out.println(Math.round(-1.5));  // -1   (큰 값으로)
System.out.println(Math.rint(-1.5));   // -2.0 (짝수 쪽)
System.out.println(Math.floor(-1.5));  // -2.0 (음수 방향 내림)
System.out.println(Math.ceil(-1.5));   // -1.0 (양수 방향 올림)
```

### 4.2 기타 유용한 메서드

| 메서드 | 설명 | 예시 |
|:-------|:-----|:-----|
| `abs(x)` | 절대값 | `abs(-10)` → `10` |
| `max(a, b)` | 큰 값 | `max(3, 7)` → `7` |
| `min(a, b)` | 작은 값 | `min(3, 7)` → `3` |
| `pow(a, b)` | 거듭제곱 | `pow(2, 10)` → `1024.0` |
| `sqrt(x)` | 제곱근 | `sqrt(16)` → `4.0` |
| `random()` | `0.0` 이상 `1.0` 미만 | `random()` → `0.xxx` |
| `log(x)` | 자연로그 | `log(Math.E)` → `1.0` |
| `log10(x)` | 상용로그 | `log10(100)` → `2.0` |

```java
// 랜덤 정수 생성 (1 ~ 6)
int dice = (int)(Math.random() * 6) + 1;

// 두 점 사이의 거리
double distance = Math.sqrt(
    Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
```

### 4.3 예외를 발생시키는 메서드 (JDK 1.8+)

이름에 `Exact`가 포함된 메서드는 오버플로우 시 `ArithmeticException`을 던진다.

```java
int a = Integer.MAX_VALUE;

// 일반 연산 — 오버플로우를 알 수 없음
System.out.println(a + 1);  // -2147483648 (조용히 감침)

// Exact 메서드 — 오버플로우 시 예외
try {
    Math.addExact(a, 1);
} catch (ArithmeticException e) {
    System.out.println("오버플로우: " + e.getMessage());
}
```

| 메서드 | 설명 |
|:-------|:-----|
| `addExact(x, y)` | 덧셈 |
| `subtractExact(x, y)` | 뺄셈 |
| `multiplyExact(x, y)` | 곱셈 |
| `negateExact(a)` | 부호 반전 |
| `toIntExact(long)` | long → int 변환 |

### 4.4 StrictMath 클래스

`Math`는 성능을 위해 OS에 의존적인 계산을 할 수 있다. `StrictMath`는 성능을 다소 포기하는 대신 **어떤 OS에서도 항상 같은 결과**를 보장한다.

---

## 5. 래퍼(Wrapper) 클래스

자바의 8개 기본형을 객체로 다룰 수 있게 해주는 클래스이다.

### 5.1 기본형과 래퍼 클래스

| 기본형 | 래퍼 클래스 | 생성 예시 |
|:-------|:-----------|:---------|
| `boolean` | `Boolean` | `Boolean.valueOf(true)` |
| `char` | `Character` | `Character.valueOf('a')` |
| `byte` | `Byte` | `Byte.valueOf((byte)10)` |
| `short` | `Short` | `Short.valueOf((short)10)` |
| `int` | `Integer` | `Integer.valueOf(100)` |
| `long` | `Long` | `Long.valueOf(100L)` |
| `float` | `Float` | `Float.valueOf(1.0f)` |
| `double` | `Double` | `Double.valueOf(1.0)` |

{{< callout type="info" >}}
`char` → `Character`, `int` → `Integer`만 이름이 다르고 나머지는 기본형의 첫 글자를 대문자로 바꾼 것이 래퍼 클래스 이름이다.
{{< /callout >}}

### 5.2 래퍼 클래스의 특징

```java
// equals() — 내용 비교 (오버라이딩됨)
Integer i1 = Integer.valueOf(100);
Integer i2 = Integer.valueOf(100);
System.out.println(i1.equals(i2));  // true
System.out.println(i1 == i2);       // true (캐시: -128~127)

Integer i3 = Integer.valueOf(200);
Integer i4 = Integer.valueOf(200);
System.out.println(i3 == i4);       // false (캐시 밖)
System.out.println(i3.equals(i4));  // true

// 유용한 상수
System.out.println(Integer.MAX_VALUE);  // 2147483647
System.out.println(Integer.MIN_VALUE);  // -2147483648
System.out.println(Integer.SIZE);       // 32
System.out.println(Integer.BYTES);      // 4
```

### 5.3 Number 클래스

숫자 관련 래퍼 클래스들의 공통 조상 추상 클래스이다.

```
           Number (abstract)
  ┌─────┬────┬─────┬─────┬─────┐
  │     │    │     │     │     │
 Byte Short Integer Long Float Double
                      │
             BigInteger, BigDecimal
```

```java
// Number의 추상 메서드
public abstract int intValue();
public abstract long longValue();
public abstract float floatValue();
public abstract double doubleValue();
```

### 5.4 문자열을 숫자로 변환

| 변환 방향 | 메서드 | 반환 타입 |
|:---------|:-------|:---------|
| 문자열 → 기본형 | `Integer.parseInt("100")` | `int` |
| 문자열 → 래퍼 | `Integer.valueOf("100")` | `Integer` |

```java
int i = Integer.parseInt("100");
long l = Long.parseLong("100");
double d = Double.parseDouble("3.14");

Integer iObj = Integer.valueOf("100");
Double dObj = Double.valueOf("3.14");

// 진법 변환
int hex = Integer.parseInt("FF", 16);     // 255
int oct = Integer.parseInt("77", 8);      // 63
int bin = Integer.parseInt("11001", 2);   // 25
```

### 5.5 오토박싱 & 언박싱

JDK 1.5부터 컴파일러가 기본형과 래퍼 클래스 간 자동 변환 코드를 삽입한다.

```java
// 오토박싱: 기본형 → 래퍼
Integer num = 100;   // → Integer.valueOf(100)

// 언박싱: 래퍼 → 기본형
int n = num;         // → num.intValue()

// 연산에서도 자동 적용
Integer a = 10;
Integer b = 20;
int sum = a + b;     // a.intValue() + b.intValue()
```

```java
// 작성한 코드 vs 컴파일러가 바꾼 코드
ArrayList<Integer> list = new ArrayList<>();
list.add(100);               // list.add(Integer.valueOf(100));
int val = list.get(0);       // int val = list.get(0).intValue();
```

{{< callout type="warning" >}}
**오토박싱에서 `==` 비교는 위험하다.**
```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b);  // true  (캐시 범위 내)

Integer c = 128;
Integer d = 128;
System.out.println(c == d);  // false (캐시 범위 밖)
System.out.println(c.equals(d));  // true
```
`Integer`는 `-128 ~ 127` 범위를 캐싱하므로 이 범위의 값은 `==`로 비교해도 true이지만 범위를 벗어나면 false가 된다. **래퍼 클래스 비교는 항상 `equals()`를 사용해야 한다.**
{{< /callout >}}

---

## 6. 요약

### 핵심 클래스 정리

| 클래스 | 핵심 포인트 |
|:-------|:-----------|
| `Object` | 모든 클래스의 조상. `equals`/`hashCode`/`toString`은 필요 시 오버라이딩 |
| `String` | 불변 객체. 변경마다 새 인스턴스. 리터럴은 Pool에서 공유 |
| `StringBuffer` | 가변 문자열. 동기화 지원 (쓰레드 안전) |
| `StringBuilder` | 가변 문자열. 동기화 없음 (빠름) |
| `Math` | 수학 계산 `static` 메서드. 인스턴스 생성 불가 |
| Wrapper | 기본형의 객체 버전. 오토박싱/언박싱 지원 |

### equals()와 hashCode() 계약

```
equals() true   → hashCode()는 반드시 같음
hashCode() 같음 → equals()는 true일 수도, 아닐 수도
                 (해시 충돌이 가능하므로)
```

### 문자열 처리 선택 기준

```
문자열 변경 없음
   │
   └→ String

문자열 변경 빈번
   │
   ├→ 싱글쓰레드 → StringBuilder
   │
   └→ 멀티쓰레드 → StringBuffer
```
