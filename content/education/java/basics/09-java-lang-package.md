---
title: "Chapter 09. java.lang 패키지와 유용한 클래스"
date: 2026-02-07
weight: 9
---

앞 장들은 몇 가지 질문을 이 장으로 미뤄 두었다. `"hello" == "hello"`는 왜 `true`인데 `new String("hello")`끼리는 `false`인가([Chapter 03](../03-java-operator)). `String`은 왜 바꿀 수 없게 만들어졌나([Chapter 05](../05-array)). `println(tv)`는 왜 이상한 문자열을 찍고, `Object`의 메서드는 언제 재정의해야 하나([Chapter 07](../07-oop-advanced)). `Integer` 127은 `==`가 되는데 128은 왜 안 되나. 이 질문들의 답은 전부 `java.lang` 패키지에 있다. `Object`, `String`, `StringBuilder`, `Math`, 래퍼 클래스 다섯을 통해 두 가지를 본다. **"같다"는 것을 누가 어떻게 정의하는가**, 그리고 **문자열은 값인가 객체인가.**

---

## 1. Object: 모든 객체의 공통 약속

7장에서 모든 클래스는 `Object`의 자손이라고 했다. `Object`에는 인스턴스 변수가 없고 메서드만 열한 개 있는데, 그 메서드들은 "자바의 모든 객체는 최소한 이것은 할 수 있다"는 약속이다.

| 메서드 | 약속 | 기본 구현 |
|:-------|:-----|:----------|
| `equals(Object)` | 다른 객체와 같은지 | `==`. 같은 인스턴스인가 |
| `hashCode()` | 해시 기반 자료구조에서 쓸 정수 | 인스턴스마다 다른 값 |
| `toString()` | 자신을 설명하는 문자열 | `클래스이름@해시코드` |
| `clone()` | 자신의 복사본 | 필드를 그대로 복사한 새 인스턴스 |
| `getClass()` | 자신의 클래스 정보 | 실행 중의 실제 클래스 |
| `wait()`, `notify()`, `notifyAll()` | 스레드 사이의 대기와 신호 | [Chapter 13](../13-thread) |
| `finalize()` | 회수 직전에 호출 | 사용하지 않는다. 폐기 예정 |

기본 구현은 "인스턴스가 다르면 다른 객체"라는 가장 보수적인 정의다. 그것으로 충분한 클래스도 있지만, 값으로 비교되어야 하는 클래스는 앞의 셋을 재정의한다. 이 절은 그 셋이 핵심이다.

### 1.1 equals: 같음의 기준을 정한다

```java
public boolean equals(Object obj) {   // Object의 구현
    return this == obj;
}
```

```java
Object a = new Object(), b = new Object();
a.equals(b);                              // false. 다른 인스턴스

String s1 = new String("hello"), s2 = new String("hello");
s1 == s2;                                 // false. 다른 인스턴스
s1.equals(s2);                            // true. String이 내용 비교로 재정의했다
```

`Object`의 `equals()`는 `==`와 같다. 3장에서 본 대로 참조형의 `==`는 주소 비교이므로, 재정의하지 않은 클래스에서 `equals()`는 "같은 인스턴스인가"를 묻는다. `String`이 내용으로 비교되는 것은 `String`이 이 메서드를 **재정의했기** 때문이지 언어의 규칙이 아니다.

```java
public class Person {
    private final long id;
    private final String name;

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;                                  // 자기 자신
        if (obj == null || getClass() != obj.getClass()) return false; // null이거나 다른 클래스
        Person other = (Person) obj;
        return id == other.id;                                         // 같음의 기준: id
    }

    @Override
    public int hashCode() {
        return Long.hashCode(id);                                      // 같은 기준으로
    }
}
```

`equals()`를 재정의한다는 것은 이 클래스에서 **무엇이 같음인가**를 정하는 일이다. 회원은 이름이 같아도 다른 사람일 수 있으니 `id`로 정했다. 재정의에는 지켜야 할 약속이 있다. `a.equals(a)`는 참이고, `a.equals(b)`면 `b.equals(a)`이며, 여러 번 불러도 결과가 같고, `null`과는 언제나 다르다. 이 약속을 어기면 컬렉션이 이상하게 동작하는데, 이유는 컬렉션이 이 메서드를 믿고 짜여 있기 때문이다.

{{< callout type="info" >}}
`instanceof` 대신 `getClass()`로 비교하는 이유는 대칭성이다. 자손 클래스가 필드를 추가하고 `equals()`를 재정의하면, 조상 쪽 `equals()`는 자손을 같다고 하는데 자손 쪽은 조상을 다르다고 하는 상황이 생긴다. `getClass()`는 정확히 같은 클래스만 같다고 보아 이 문제를 피하지만, 대신 자손 인스턴스가 조상과 절대 같을 수 없게 된다. 둘 중 무엇이 맞는지는 클래스의 의미에 달렸다. `null`을 안전하게 비교하려면 3장에서 본 `Objects.equals(a, b)`를 쓴다.
{{< /callout >}}

### 1.2 hashCode: equals와 반드시 함께

```
equals가 true  ─▶ hashCode 반드시 같다
hashCode 같다  ─▶ equals는 모른다
                 (충돌이 가능하다)
```

`hashCode()`는 객체를 정수 하나로 요약한 값이고, `HashMap`이나 `HashSet`이 객체를 어느 칸에 넣을지 정할 때 쓴다. 찾을 때도 먼저 해시코드로 칸을 고른 뒤 그 칸 안에서 `equals()`로 확인한다. 그래서 `equals()`가 참인 두 객체의 해시코드가 다르면, 같은 객체인데 다른 칸을 뒤져 "없다"는 답이 나온다. **`equals()`를 재정의하면 `hashCode()`도 같은 기준으로 재정의해야 한다**는 규칙이 여기서 나온다. 반대 방향은 성립하지 않아도 된다. 정수는 유한하니 다른 객체가 같은 해시코드를 가질 수 있고, 그 충돌은 `equals()`가 걸러 낸다. 이 구조는 [Chapter 11](../11-collections-framework)에서 `HashMap`의 안을 볼 때 다시 나온다.

```java
String s1 = new String("abc"), s2 = new String("abc");
s1.hashCode() == s2.hashCode();                               // true. 내용으로 계산한다
System.identityHashCode(s1) == System.identityHashCode(s2);   // false. 재정의 전의 값
```

기본 구현의 해시코드는 흔히 "주소"라고 설명되지만 정확하지 않다. 객체는 가비지 컬렉션 중에 옮겨질 수 있어 주소가 바뀌는데 해시코드는 바뀌면 안 되므로, HotSpot은 처음 요청될 때 **난수**를 만들어 객체 헤더에 저장해 두고 그 값을 돌려준다. 그래서 다른 인스턴스가 같은 값을 가질 수도 있다. 재정의하지 않은 클래스의 해시코드는 "인스턴스마다 다르려고 노력하는 값"이지 유일함을 보장하는 값이 아니다.

{{< callout type="info" >}}
`equals()`와 `hashCode()`를 직접 쓰는 일은 줄어들고 있다. 여러 필드를 묶을 때는 `Objects.hash(id, name)`이 편하고, Java 16의 `record`는 모든 필드를 기준으로 `equals()`, `hashCode()`, `toString()`을 자동으로 만들어 준다. JPA 시리즈의 값 타입처럼 "값이 같으면 같은 것"인 클래스라면 `record`가 첫 번째 선택이다.
{{< /callout >}}

### 1.3 toString: 자신을 설명한다

```java
public String toString() {            // Object의 구현
    return getClass().getName() + "@" + Integer.toHexString(hashCode());
}
```

```java
public class Card {
    private final String suit;
    private final int number;

    @Override
    public String toString() { return suit + " " + number; }
}

System.out.println(new Card("SPADE", 1));   // SPADE 1
```

6장의 `println(tv)`가 `Tv@1b6d3586`을 찍은 이유가 이 기본 구현이다. 클래스 이름과 해시코드뿐이라 무엇이 들어 있는지는 알 수 없다. `println`, 문자열 연결, 로그, 디버거가 전부 `toString()`을 부르므로, 값을 가진 클래스는 재정의해 두면 그 값이 어디서든 보인다. 재정의하지 않은 클래스의 로그를 뒤지는 것만큼 답답한 일도 없다.

### 1.4 clone: 복사본을 만든다

```java
public class Deck implements Cloneable {        // 표시 인터페이스. 메서드가 없다
    int[] cards;

    @Override
    public Deck clone() {                       // protected를 public으로, 반환 타입을 좁혀서
        try {
            Deck copy = (Deck) super.clone();   // 필드를 그대로 복사한 새 인스턴스
            copy.cards = cards.clone();         // 참조 필드는 따로 복사해야 깊은 복사
            return copy;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
```

`Object.clone()`은 인스턴스의 필드를 그대로 복사한 새 인스턴스를 만든다. 5장의 배열 복사와 같은 **얕은 복사**라서, 참조 필드는 같은 객체를 가리킨다. 깊은 복사가 필요하면 참조 필드를 직접 복사해야 한다.

이 메서드에는 이상한 점이 둘 있다. `Cloneable`을 구현하지 않은 클래스에서 부르면 예외를 던지는데, `Cloneable`에는 메서드가 하나도 없다. 그리고 `protected`라서 바깥에서 쓰려면 재정의해 `public`으로 열어야 한다. 이 설계는 "복사 가능한 클래스인지를 클래스가 표시하게" 하려는 의도였지만, 생성자를 거치지 않고 인스턴스를 만드는 방식이라 `final` 필드와 어울리지 않고 예외 처리도 번거롭다. 그래서 요즘은 6장의 복사 생성자나 `static` 복사 메서드를 더 권한다.

### 1.5 getClass: 실행 중의 클래스 정보

```java
Card card = new Card("HEART", 3);
Class<?> c1 = card.getClass();          // 인스턴스에서
Class<?> c2 = Card.class;               // 클래스 리터럴
Class<?> c3 = Class.forName("Card");    // 이름으로. 실행 중에 문자열로 찾는다

c1.getName();                            // "Card"
c1.getSuperclass();                      // class java.lang.Object
```

`getClass()`는 참조 변수의 타입이 아니라 **실제 인스턴스의 클래스**를 돌려준다. 7장의 다형성에서 `Parent p = new Child()`일 때 `p.getClass()`는 `Child`다. 돌려주는 `Class` 객체는 클래스마다 하나뿐이며, 1장에서 본 클래스 로더가 `.class` 파일을 읽어 올릴 때 만든다. 이 객체를 통해 클래스의 필드, 메서드, 생성자를 실행 중에 조사하고 호출하는 것이 리플렉션이고, 프레임워크가 애너테이션을 읽어 동작하는 바탕이다.

---

## 2. String: 값처럼 쓰이는 객체

### 2.1 왜 바꿀 수 없게 만들었나

```java
String a = "hello";
String b = a + " world";   // a가 바뀌는 것이 아니라 새 String이 만들어진다
a;                         // "hello"
```

`String`은 객체이지만 자바는 이것을 **값처럼** 다루고 싶어 했다. 그래서 만들어진 뒤 내용을 바꿀 수 없는 **불변** 객체로 설계했고, `final` 클래스라 자손이 그 성질을 깨지도 못한다. 이유는 네 가지다.

| 이유 | 설명 |
|:-----|:-----|
| 안전 | 파일 경로, URL, 접속 정보가 넘겨진 뒤에 바뀌면 검사가 무의미해진다 |
| 공유 | 바뀌지 않으니 여러 스레드가 동기화 없이 나눠 써도 된다 |
| 해시 캐시 | 내용이 고정이라 해시코드를 한 번 계산해 저장해 둘 수 있다. `HashMap`의 키로 빠르다 |
| 풀 | 같은 내용의 문자열을 하나의 객체로 공유할 수 있다 (2.2절) |

JPA 시리즈 [Chapter 11. 값 타입](../../jpa/11-value-types)에서 값 타입은 불변으로 만들라고 했는데, `String`은 자바가 언어 차원에서 그 원칙을 적용한 첫 사례다. 안에는 문자 배열이 있지만 밖으로는 절대 새지 않는다. 2장에서 본 Compact Strings 이후 그 배열은 `byte[]`이고, Latin-1 범위면 문자당 1바이트를 쓴다.

### 2.2 리터럴과 문자열 풀

```java
String s1 = "hello";
String s2 = "hello";
String s3 = new String("hello");
String s4 = new String("hello");

s1 == s2;          // true. 풀의 같은 객체
s3 == s4;          // false. 힙에 각각 만들어졌다
s3.equals(s4);     // true. 내용은 같다
```

```
String Pool           Heap
┌──────────┐     ┌──────────┐
│ "hello"  │     │ "hello"  │◀─ s3
└────▲─────┘     └──────────┘
  ┌──┴──┐        ┌──────────┐
  s1    s2       │ "hello"  │◀─ s4
                 └──────────┘
```

불변이기 때문에 가능한 최적화가 **문자열 풀**이다. 소스에 적힌 리터럴은 클래스가 로드될 때 풀에 등록되고, 같은 내용의 리터럴은 같은 객체를 가리킨다. 바뀔 수 없으니 공유해도 안전하다. 3장에서 `"hello" == "hello"`가 `true`였던 이유이며, 동시에 그 결과를 믿으면 안 되는 이유이기도 하다. `new String("hello")`는 풀을 거치지 않고 힙에 새 객체를 만들고, 실행 중에 만들어진 문자열(입력값, 연결 결과)도 풀에 없다. 같은 내용인데 `==`가 `false`인 경우가 얼마든지 있으므로 문자열 비교는 언제나 `equals()`다.

```java
String c = "hel" + "lo";     // 컴파일 때 "hello"로 접힌다. c == s1 은 true
String d = s1 + "";          // 실행 중에 만들어진다. d == s1 은 false
String e = d.intern();       // 풀에 같은 내용이 있으면 그 객체를 돌려준다. e == s1 은 true
```

### 2.3 자주 쓰는 메서드

| 메서드 | 하는 일 | 예 |
|:-------|:--------|:---|
| `length()` | 길이 (`char` 단위) | `"hello".length()` → `5` |
| `charAt(i)` | i번째 문자 | `"abc".charAt(0)` → `'a'` |
| `substring(a, b)` | a부터 b 앞까지 | `"hello".substring(0, 3)` → `"hel"` |
| `indexOf(s)` | 처음 나오는 위치. 없으면 -1 | `"hello".indexOf("ll")` → `2` |
| `contains(s)` | 포함 여부 | `"hello".contains("ell")` → `true` |
| `replace(a, b)` | 바꾼 새 문자열 | `"aabb".replace('a', 'c')` → `"ccbb"` |
| `trim()`, `strip()` | 양끝 공백 제거. `strip`은 유니코드 공백까지 | `" hi ".trim()` → `"hi"` |
| `toUpperCase()`, `toLowerCase()` | 대소문자 | `"abc".toUpperCase()` → `"ABC"` |
| `split(regex)` | 정규식으로 나눠 배열로 | `"a,b".split(",")` → `["a", "b"]` |
| `String.join(d, ...)` | 구분자로 잇기 | `String.join("-", "a", "b")` → `"a-b"` |
| `compareTo(s)` | 사전순 비교 | `"a".compareTo("b")` → 음수 |
| `equalsIgnoreCase(s)` | 대소문자 무시 비교 | `"Hi".equalsIgnoreCase("hi")` → `true` |

```java
String email = "  USER@example.COM  ";
String normalized = email.trim().toLowerCase();   // 각 호출이 새 String을 돌려준다
String[] parts = normalized.split("@");           // ["user", "example.com"]
```

모든 메서드가 **새 문자열을 돌려준다**는 점을 다시 강조해 둔다. `email.trim()`을 부르고 결과를 받지 않으면 아무 일도 일어나지 않는다. 불변이니 당연하지만 가장 흔한 실수다.

```java
String empty = "";        // 길이 0인 문자열. 된다
char c = '';              // 컴파일 오류. 문자는 반드시 하나여야 한다
```

빈 문자열은 있어도 빈 문자는 없다. 2장에서 본 대로 `char`는 유니코드 번호 하나를 담는 정수라 "없음"을 표현할 수 없다.

### 2.4 기본형과의 변환

```java
String s = String.valueOf(100);        // "100"
String t = 100 + "";                   // 같은 결과. 한 번 쓰는 자리에서만

int i = Integer.parseInt("100");       // 100
double d = Double.parseDouble("3.14");
int hex = Integer.parseInt("FF", 16);  // 255. 진법을 줄 수 있다
```

문자열을 숫자로 바꾸는 메서드는 5절의 래퍼 클래스에 있다. 형식이 맞지 않으면 `NumberFormatException`이 나는데, 8장에서 본 대로 이것을 흐름 제어에 쓰지 말고 먼저 검증한다.

---

## 3. StringBuilder: 문자열을 고칠 때

### 3.1 += 반복이 느린 이유

```java
String s = "";
for (int i = 0; i < 10000; i++) {
    s += i;                    // 반복마다 새 String
}

StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i);              // 하나의 버퍼에 이어 쓴다
}
String result = sb.toString();
```

```
s += i  (반복마다)
  "0" → "01" → "012" → "0123" …
  매번 새 String. 복사량이 누적된다
```

`String`이 불변이므로 `s += i`는 기존 문자열과 새 조각을 **복사해 합친 새 객체**를 만든다. 반복이 만 번이면 문자열이 만 번 새로 만들어지고, 매번 지금까지의 길이만큼 복사하니 총 복사량은 길이의 제곱에 비례한다. `StringBuilder`는 내부에 바꿀 수 있는 문자 배열을 두고 거기에 이어 쓴다. 복사는 배열이 꽉 찼을 때만 일어난다.

한 식 안의 `a + b + c`는 걱정할 필요가 없다. Java 9부터 컴파일러가 이런 연결을 한 번에 처리하는 코드로 바꾼다. 문제는 **반복문 안에서 누적**하는 경우이고, 그때만 `StringBuilder`를 쓰면 된다.

### 3.2 버퍼와 용량

```java
StringBuilder a = new StringBuilder();          // 용량 16
StringBuilder b = new StringBuilder(100);       // 용량 100. 크기를 안다면 미리
StringBuilder c = new StringBuilder("hello");   // 용량 16 + 5
```

```
용량 16 ─▶ 꽉 참 ─▶ 새 배열 34로 교체
            (기존 용량 × 2 + 2)
```

버퍼가 차면 5장의 `ArrayList`처럼 더 큰 배열을 만들어 복사한다. 새 용량은 기존 용량의 두 배에 2를 더한 크기다. 두 배씩 키우면 복사 횟수가 로그 규모로 줄어, 만 번을 이어 붙여도 복사는 열 번 남짓이다. 최종 길이를 짐작할 수 있으면 처음부터 그 용량을 주어 복사를 없앨 수 있다.

### 3.3 이어 쓰기와 비교

```java
StringBuilder sb = new StringBuilder("Hello World");
sb.append("!").insert(5, ",").delete(6, 7).replace(6, 11, "Java").reverse();
```

`append()`를 비롯한 편집 메서드는 자기 자신을 돌려준다. 그래서 점으로 이어 쓸 수 있는데, 이 반환값은 새 객체가 아니라 **같은 객체**다. `String`과 정반대다.

```java
StringBuilder x = new StringBuilder("abc"), y = new StringBuilder("abc");
x.equals(y);                      // false. 재정의하지 않았다
x.toString().equals(y.toString()); // true
x.compareTo(y) == 0;              // true. Java 11부터
```

`StringBuilder`는 `equals()`를 재정의하지 않았다. 일부러 그랬다. 1.2절에서 본 대로 `equals()`와 `hashCode()`는 해시 자료구조의 키로 쓰이는데, 내용이 바뀌는 객체를 키로 쓰면 넣을 때와 찾을 때의 해시코드가 달라진다. 가변 객체에 내용 기반 `equals()`를 주지 않은 것은 그 함정을 막으려는 선택이다. 내용을 비교하려면 `String`으로 바꾸거나 `compareTo()`를 쓴다.

### 3.4 StringBuffer와 StringBuilder

| 클래스 | 동기화 | 언제 |
|:-------|:-------|:-----|
| `StringBuffer` | 메서드마다 `synchronized` | 여러 스레드가 같은 인스턴스에 이어 쓸 때 |
| `StringBuilder` | 없음 | 그 외 전부. 실무의 대부분 |

둘은 기능이 같고 동기화 여부만 다르다. `StringBuffer`가 먼저 있었고, 모든 메서드에 붙은 동기화 비용이 한 스레드만 쓰는 흔한 경우에도 들어가는 것이 낭비라서 Java 5에 `StringBuilder`가 추가됐다. 동기화가 무엇이고 왜 비용인지는 13장에서 본다. 한 메서드 안에서 만들어 쓰고 버리는 빌더는 다른 스레드가 볼 수 없으니 `StringBuilder`면 된다.

---

## 4. Math

```java
Math.abs(-10);           // 10
Math.max(3, 7);          // 7
Math.pow(2, 10);         // 1024.0
Math.sqrt(16);           // 4.0
Math.random();           // 0.0 이상 1.0 미만
(int) (Math.random() * 6) + 1;   // 1~6
```

`Math`는 인스턴스가 없다. 생성자가 `private`이고 메서드가 전부 `static`이다. 7장의 유틸리티 클래스 그대로인데, 계산에 인스턴스의 상태가 필요 없으니 만들 이유도 없기 때문이다.

### 4.1 반올림 네 가지

| 메서드 | 하는 일 | `1.5` | `-1.5` | `2.5` |
|:-------|:--------|:------|:-------|:------|
| `round()` | 가장 가까운 정수. 정확히 중간이면 큰 쪽 | `2` | `-1` | `3` |
| `rint()` | 가장 가까운 정수. 중간이면 짝수 쪽 | `2.0` | `-2.0` | `2.0` |
| `floor()` | 작은 쪽 정수 | `1.0` | `-2.0` | `2.0` |
| `ceil()` | 큰 쪽 정수 | `2.0` | `-1.0` | `3.0` |

`round()`만 정수 타입(`long`)을 돌려주고 나머지는 `double`이다. `round(-1.5)`가 `-1`인 것은 `floor(x + 0.5)`로 정의되어 있어 중간값이 항상 큰 쪽으로 가기 때문이다. `rint()`가 짝수 쪽으로 가는 것은 통계에서 반올림이 한쪽으로 치우치지 않게 하는 관례다.

```java
double val = 90.7552;
Math.round(val * 100) / 100.0;     // 90.76. 둘째 자리까지
Math.round(val * 100) / 100;       // 90. 정수 나눗셈이 되어 버린다
```

소수 둘째 자리에서 반올림하려면 100을 곱해 정수로 반올림한 뒤 다시 나눈다. 나눌 때 `100.0`이어야 하는 이유는 3장이다. `round()`가 돌려준 `long`을 정수 100으로 나누면 정수 나눗셈이다.

### 4.2 오버플로우를 잡아 주는 메서드

```java
int a = Integer.MAX_VALUE;
a + 1;                     // -2147483648. 조용히 넘친다 (2장)
Math.addExact(a, 1);       // ArithmeticException
```

2장에서 정수 연산은 넘쳐도 예외를 내지 않는다고 했다. 검사 비용을 매번 치르지 않기 위해서였다. 그 검사를 원할 때만 하려고 Java 8이 `addExact()`, `subtractExact()`, `multiplyExact()`, `toIntExact()`를 두었다. 넘치면 `ArithmeticException`을 던지므로 금액 계산처럼 틀리면 안 되는 곳에 쓴다.

`StrictMath`라는 쌍둥이 클래스가 있다. `Math`는 속도를 위해 CPU의 명령어를 직접 쓸 수 있어 기계마다 마지막 자리가 다를 수 있는데, `StrictMath`는 정해진 알고리즘으로만 계산해 어디서나 같은 비트를 낸다. 1장의 "어디서나 같은 결과"를 실수 계산에서까지 원할 때 쓴다.

---

## 5. 래퍼 클래스: 기본형을 객체로

### 5.1 왜 필요한가

| 기본형 | 래퍼 | 기본형 | 래퍼 |
|:-------|:-----|:-------|:-----|
| `boolean` | `Boolean` | `int` | `Integer` |
| `char` | `Character` | `long` | `Long` |
| `byte` | `Byte` | `float` | `Float` |
| `short` | `Short` | `double` | `Double` |

2장에서 자바의 값은 기본형과 참조형으로 나뉜다고 했다. 이 구분은 성능에는 좋지만 한 가지 문제를 낳는다. 객체만 받는 자리에 기본형을 넣을 수 없다. `ArrayList`는 `Object`의 자손만 담을 수 있고, [Chapter 12](../12-generics-enum-annotation)의 지네릭스는 타입 인자로 참조형만 받는다. `ArrayList<int>`는 안 되고 `ArrayList<Integer>`여야 한다. 래퍼 클래스는 기본형 하나를 감싼 객체로, 기본형을 객체가 필요한 자리에 넣기 위해 존재한다.

래퍼 클래스는 값을 담는 것 말고도 그 타입에 관한 도구를 모아 두는 자리다. `Integer.MAX_VALUE`, `Integer.parseInt()`, `Integer.toBinaryString()`, `Character.isDigit()`이 그렇다. 2절에서 문자열을 숫자로 바꾸는 메서드가 여기 있었던 이유다.

### 5.2 캐시와 ==

```
Integer.valueOf(127) ─▶ 캐시의 같은 객체
Integer.valueOf(128) ─▶ 매번 새 객체
```

```java
Integer a = Integer.valueOf(127), b = Integer.valueOf(127);
a == b;          // true
Integer c = Integer.valueOf(128), d = Integer.valueOf(128);
c == d;          // false
c.equals(d);     // true
```

3장에서 미뤄 둔 질문의 답이다. `Integer.valueOf()`는 -128부터 127까지의 값을 미리 만들어 두고 **같은 객체를 돌려준다.** 작은 정수는 워낙 자주 쓰여서 매번 객체를 만드는 낭비를 줄이려는 최적화다. 그 범위 밖은 매번 새 객체이므로 `==`가 `false`다. 문자열 풀과 같은 교훈이다. 최적화 때문에 `==`가 우연히 맞는 경우가 있을 뿐, 래퍼의 비교는 `equals()`다. `Byte`, `Short`, `Long`, `Character`(0~127)에도 같은 캐시가 있고, `Boolean`은 둘뿐이며, `Float`와 `Double`에는 없다.

`new Integer(100)`처럼 생성자로 만드는 방식은 Java 9부터 폐기됐다. 캐시를 우회해 항상 새 객체를 만들기 때문이다.

### 5.3 Number와 변환

```
           Number (abstract)
  ┌─────┬────┬─────┬─────┬─────┐
  │     │    │     │     │     │
 Byte Short Integer Long Float Double
                      │
             BigInteger, BigDecimal
```

```java
Integer i = Integer.valueOf("100");     // 문자열 → 래퍼
int n = Integer.parseInt("100");        // 문자열 → 기본형
double d = i.doubleValue();             // 래퍼 → 다른 기본형
```

숫자 래퍼는 모두 `Number`의 자손이고, `intValue()`, `doubleValue()`처럼 어떤 기본형으로든 꺼내는 메서드를 약속한다. 2장에서 본 `BigInteger`와 `BigDecimal`도 `Number`의 자손이라 같은 방식으로 다룰 수 있다. `parseXxx()`는 기본형을, `valueOf()`는 래퍼를 돌려준다는 것만 구분하면 된다.

### 5.4 오토박싱과 언박싱

```java
Integer num = 100;      // 컴파일러가 Integer.valueOf(100)으로 바꾼다. 박싱
int n = num;            // num.intValue()로 바꾼다. 언박싱

Integer a = 10, b = 20;
int sum = a + b;        // a.intValue() + b.intValue()

List<Integer> list = new ArrayList<>();
list.add(100);          // list.add(Integer.valueOf(100))
int first = list.get(0);   // list.get(0).intValue()
```

Java 5부터 기본형과 래퍼 사이의 변환을 컴파일러가 대신 넣어 준다. 코드는 기본형만 쓰는 것처럼 보이지만 실제로는 객체가 만들어지고 풀린다. 편리한 만큼 두 가지를 알고 있어야 한다.

```java
Integer count = null;
int c = count;                  // NullPointerException. null.intValue()

Long total = 0L;
for (long i = 0; i < 1_000_000; i++) {
    total += i;                 // 반복마다 언박싱, 덧셈, 박싱. 객체 백만 개
}
```

래퍼는 `null`일 수 있는데 기본형은 아니므로, `null`인 래퍼를 언박싱하면 `NullPointerException`이다. `Integer`를 돌려주는 메서드의 결과를 `int`에 받을 때 자주 난다. 두 번째는 성능이다. 누적 변수를 래퍼로 두면 반복마다 객체가 새로 만들어진다. 계산은 기본형으로 하고, 객체가 꼭 필요한 자리에서만 래퍼를 쓴다.

---

## 6. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| `Object.equals` | 기본은 `==`. 값 비교는 재정의 | 같음의 기준은 클래스가 정한다 |
| `hashCode` | `equals`와 반드시 함께 | 해시 자료구조는 해시코드로 칸을 고른 뒤 `equals`로 확인한다 |
| 기본 해시코드 | 유일하지 않다 | GC로 옮겨져도 바뀌지 않게 난수를 헤더에 둔다 |
| `toString` | 재정의하면 어디서든 값이 보인다 | 출력, 연결, 로그가 전부 이 메서드를 부른다 |
| `clone` | 얕은 복사. 설계가 어색하다 | 생성자를 거치지 않는다. 복사 생성자를 권한다 |
| `String` 불변 | 바꿀 수 없고 `final` | 안전, 공유, 해시 캐시, 풀 |
| 문자열 풀 | 리터럴은 같은 객체 | 불변이라 공유해도 안전하다. 그래도 비교는 `equals` |
| `StringBuilder` | 반복 누적에 쓴다 | `+=`는 매번 복사해 제곱으로 느리다 |
| `StringBuilder.equals` | 재정의하지 않았다 | 가변 객체는 해시 키로 쓰면 안 된다 |
| `StringBuffer` | 동기화 버전 | 한 스레드만 쓰면 비용만 든다 |
| `Math` | 인스턴스 없는 `static` 도구 | 계산에 상태가 필요 없다 |
| 래퍼 | 기본형을 객체 자리에 | 지네릭스와 컬렉션은 참조형만 받는다 |
| `Integer` 캐시 | -128~127은 같은 객체 | 작은 정수의 생성 낭비를 줄인다. 비교는 `equals` |
| 오토박싱 | 컴파일러가 변환을 넣는다 | `null` 언박싱과 반복문 박싱 비용에 주의 |
