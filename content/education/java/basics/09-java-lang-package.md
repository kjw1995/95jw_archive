---
title: "Chapter 09. java.lang 패키지와 유용한 클래스"
date: 2026-02-07
weight: 9
---

앞 장들은 몇 가지 질문을 이 장으로 미뤄 두었다. `"hello" == "hello"`는 왜 `true`인데 `new String("hello")`끼리는 `false`인가([Chapter 03](../03-java-operator)). `String`은 왜 바꿀 수 없게 만들어졌나([Chapter 05](../05-array)). `println(tv)`는 왜 이상한 문자열을 찍고, `Object`의 메서드는 언제 재정의해야 하나([Chapter 07](../07-oop-advanced)). `Integer` 127은 `==`가 되는데 128은 왜 안 되나. 이 질문들의 답은 전부 `java.lang` 패키지에 있고, 원리는 셋이다. 첫째, **"같다"는 것은 클래스가 정의하고, 정의했으면 해시도 같은 기준이어야 한다.** `Object`의 기본은 `==`이고, `String`이 내용으로 비교되는 것은 재정의했기 때문이며, `equals()`와 `hashCode()`가 어긋나면 해시 자료구조가 틀린다. 둘째, **값처럼 쓰이는 객체는 불변으로 만들고, 불변이라서 공유할 수 있다. 그래도 `==`가 맞는 것은 우연이니 비교는 언제나 `equals()`다.** 문자열 풀과 `Integer` 캐시가 그 공유이고, 그 둘이 3장의 질문에 대한 답이다. 셋째, **고쳐야 하는 문자열은 가변 버퍼로, 계산은 기본형으로 한다. 컴파일러가 대신 넣어 주는 변환에는 보이지 않는 객체가 있다.** `StringBuilder`가 `+=`를 대신하고, 오토박싱이 만드는 `null`과 객체 백만 개가 그 그림자다. `Object`, `String`, `StringBuilder`, `Math`, 래퍼 클래스 다섯을 이 세 원리로 본다.

---

## 1. Object: 모든 객체의 공통 약속

| 메서드 | 약속 | 기본 구현 | 왜 기본이 그런가 |
|:-----|:-----|:-------|:-----------|
| `equals(Object)` | 다른 객체와 같은지 | `==`. 같은 인스턴스인가 | 클래스가 정하기 전까지는 "다른 인스턴스는 다르다"가 가장 안전하다 |
| `hashCode()` | 해시 기반 자료구조에서 쓸 정수 | 인스턴스마다 다르려고 하는 값 | `equals`가 `==`이니 해시도 인스턴스 단위 |
| `toString()` | 자신을 설명하는 문자열 | `클래스이름@해시코드` | 내용을 모르니 정체만 적는다 |
| `clone()` | 자신의 복사본 | 필드를 그대로 복사한 새 인스턴스 | 가장 단순한 복사. 깊은 복사는 클래스만 안다 |
| `getClass()` | 자신의 클래스 정보 | 실행 중의 실제 클래스 | 재정의 불가. 거짓말할 수 없어야 한다 |
| `wait()`, `notify()`, `notifyAll()` | 스레드 사이의 대기와 신호 | [Chapter 13](../13-thread) | 모든 객체가 모니터가 될 수 있다 |
| `finalize()` | 회수 직전에 호출 | 사용하지 않는다. 제거 예정 | 언제 불릴지 보장이 없다 |

[Chapter 07](../07-oop-advanced)에서 모든 클래스는 `Object`의 자손이라고 했다. `Object`에는 인스턴스 변수가 없고 메서드만 열한 개 있는데, 그 메서드들은 "자바의 모든 객체는 최소한 이것은 할 수 있다"는 약속이다. 기본 구현은 "인스턴스가 다르면 다른 객체"라는 가장 보수적인 정의다. 그것으로 충분한 클래스도 있지만, 값으로 비교되어야 하는 클래스는 앞의 셋을 재정의한다. 이 절은 그 셋이 핵심이고, 첫째 원리의 자리다.

### 1.1 equals: 같음의 기준을 정한다

```java
public boolean equals(Object obj) {
    return this == obj;   // Object
}
```

```java
Object a = new Object();
Object b = new Object();
a.equals(b);     // false. 다른 인스턴스

String s1 = new String("hello");
String s2 = new String("hello");
s1 == s2;        // false. 다른 인스턴스
s1.equals(s2);   // true. 재정의된 비교
```

`Object`의 `equals()`는 `==`와 같다. [Chapter 03](../03-java-operator)에서 본 대로 참조형의 `==`는 주소 비교이므로, 재정의하지 않은 클래스에서 `equals()`는 "같은 인스턴스인가"를 묻는다. `String`이 내용으로 비교되는 것은 `String`이 이 메서드를 재정의했기 때문이지 언어의 규칙이 아니다.

```java
public class Person {
    private final long id;
    private final String name;

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null) return false;
        var c = obj.getClass();
        if (c != getClass())
            return false;
        Person other = (Person) obj;
        // 같음의 기준: id
        return id == other.id;
    }

    @Override
    public int hashCode() {
        // 같은 기준으로
        return Long.hashCode(id);
    }
}
```

| 약속 | 뜻 | 왜 지켜야 하나 |
|:-----|:---|:----------|
| 반사성 | `a.equals(a)`는 참 | 자기 자신을 못 찾으면 컬렉션에서 꺼낼 수 없다 |
| 대칭성 | `a.equals(b)`면 `b.equals(a)` | 누가 묻느냐에 따라 답이 다르면 `contains`가 흔들린다 |
| 일관성 | 여러 번 불러도 같다 | 넣을 때와 찾을 때의 답이 같아야 한다 |
| `null`과 다름 | `a.equals(null)`은 거짓 | `null`은 객체가 아니다 |

`equals()`를 재정의한다는 것은 이 클래스에서 무엇이 같음인가를 정하는 일이다. 회원은 이름이 같아도 다른 사람일 수 있으니 `id`로 정했다. 재정의에는 지켜야 할 약속이 있다. 이 약속을 어기면 컬렉션이 이상하게 동작하는데, 이유는 컬렉션이 이 메서드를 믿고 짜여 있기 때문이다.

{{< callout type="info" >}}
`instanceof` 대신 `getClass()`로 비교하는 이유는 대칭성이다. 자손 클래스가 필드를 추가하고 `equals()`를 재정의하면, 조상 쪽 `equals()`는 자손을 같다고 하는데 자손 쪽은 조상을 다르다고 하는 상황이 생긴다. `getClass()`는 정확히 같은 클래스만 같다고 보아 이 문제를 피하지만, 대신 자손 인스턴스가 조상과 절대 같을 수 없게 된다. 둘 중 무엇이 맞는지는 클래스의 의미에 달렸다. `null`을 안전하게 비교하려면 [Chapter 03](../03-java-operator)에서 본 `Objects.equals(a, b)`를 쓴다.
{{< /callout >}}

### 1.2 hashCode: equals와 반드시 함께

```text
equals가 true  ─▶ hashCode 반드시 같다
hashCode 같다  ─▶ equals는 모른다
                 (충돌이 가능하다)
```

| 방향 | 성립하나 | 왜 |
|:-----|:------|:---|
| `equals` 참 → 해시 같다 | 반드시 | 해시로 칸을 고르고 그 칸에서 `equals`로 확인한다. 칸이 다르면 "없다"가 된다 |
| 해시 같다 → `equals` 참 | 아니다 | 정수는 유한하니 다른 객체가 같은 해시를 가질 수 있다. 충돌은 `equals`가 거른다 |

`hashCode()`는 객체를 정수 하나로 요약한 값이고, `HashMap`이나 `HashSet`이 객체를 어느 칸에 넣을지 정할 때 쓴다. 찾을 때도 먼저 해시코드로 칸을 고른 뒤 그 칸 안에서 `equals()`로 확인한다. 그래서 `equals()`가 참인 두 객체의 해시코드가 다르면, 같은 객체인데 다른 칸을 뒤져 "없다"는 답이 나온다. `equals()`를 재정의하면 `hashCode()`도 같은 기준으로 재정의해야 한다는 규칙이 여기서 나온다. 첫째 원리의 뒷반쪽이다. 반대 방향은 성립하지 않아도 된다. 정수는 유한하니 다른 객체가 같은 해시코드를 가질 수 있고, 그 충돌은 `equals()`가 걸러 낸다. 이 구조는 [Chapter 11](../11-collections-framework)에서 `HashMap`의 안을 볼 때 다시 나온다.

```java
String s1 = new String("abc");
String s2 = new String("abc");
s1.hashCode() == s2.hashCode();
// true. 내용으로 계산한다
System.identityHashCode(s1)
    == System.identityHashCode(s2);
// false. 재정의 전의 값
```

기본 구현의 해시코드는 흔히 "주소"라고 설명되지만 정확하지 않다. 객체는 가비지 컬렉션 중에 옮겨질 수 있어 주소가 바뀌는데 해시코드는 바뀌면 안 되므로, HotSpot은 처음 요청될 때 난수를 만들어 객체 헤더에 저장해 두고 그 값을 돌려준다. 그래서 다른 인스턴스가 같은 값을 가질 수도 있다. 재정의하지 않은 클래스의 해시코드는 "인스턴스마다 다르려고 노력하는 값"이지 유일함을 보장하는 값이 아니다.

{{< callout type="info" >}}
`equals()`와 `hashCode()`를 직접 쓰는 일은 줄어들고 있다. 여러 필드를 묶을 때는 `Objects.hash(id, name)`이 편하고, Java 16의 `record`는 모든 필드를 기준으로 `equals()`, `hashCode()`, `toString()`을 자동으로 만들어 준다. JPA 시리즈의 값 타입처럼 "값이 같으면 같은 것"인 클래스라면 `record`가 첫 번째 선택이다.
{{< /callout >}}

### 1.3 toString: 자신을 설명한다

```java
public String toString() { // Object
    return getClass().getName() + "@"
        + Integer.toHexString(
            hashCode());
}
```

```java
public class Card {
    private final String suit;
    private final int number;

    @Override
    public String toString() {
        return suit + " " + number;
    }
}

var c = new Card("SPADE", 1);
System.out.println(c);   // SPADE 1
```

[Chapter 06](../06-oop-basics)의 `println(tv)`가 `Tv@1b6d3586`을 찍은 이유가 이 기본 구현이다. 클래스 이름과 해시코드뿐이라 무엇이 들어 있는지는 알 수 없다. `println`, 문자열 연결, 로그, 디버거가 전부 `toString()`을 부르므로, 값을 가진 클래스는 재정의해 두면 그 값이 어디서든 보인다. 재정의하지 않은 클래스의 로그를 뒤지는 것만큼 답답한 일도 없다.

### 1.4 clone: 복사본을 만든다

```java
// 표시 인터페이스. 메서드가 없다
public class Deck implements Cloneable {
    int[] cards;

    @Override
    public Deck clone() {
        // public으로 열고 타입을 좁힌다
        try {
            var copy =
                (Deck) super.clone();
            // 얕은 복사본
            copy.cards = cards.clone();
            // 참조 필드는 따로 복사한다
            return copy;
        } catch (Exception e) {
            // 복제 불가 예외
            throw new AssertionError();
        }
    }
}
```

| `clone()`의 이상한 점 | 왜 그렇게 됐나 | 대가 |
|:----------------|:----------|:-----|
| `Cloneable`에 메서드가 없는데 구현 안 하면 예외 | "복사해도 되는 클래스"를 클래스가 표시하게 하려 했다 | 인터페이스가 약속이 아니라 표시로 쓰인다 |
| `protected`라 재정의해 `public`으로 열어야 한다 | 표시한 클래스만 바깥에 복사를 허용한다 | 보일러플레이트 |
| 생성자를 거치지 않는다 | 필드를 비트 단위로 복사한다 | `final` 필드와 어울리지 않고 불변식을 못 지킨다 |

`Object.clone()`은 인스턴스의 필드를 그대로 복사한 새 인스턴스를 만든다. [Chapter 05](../05-array)의 배열 복사와 같은 얕은 복사라서, 참조 필드는 같은 객체를 가리킨다. 깊은 복사가 필요하면 참조 필드를 직접 복사해야 한다. 이 설계는 "복사 가능한 클래스인지를 클래스가 표시하게" 하려는 의도였지만, 생성자를 거치지 않고 인스턴스를 만드는 방식이라 `final` 필드와 어울리지 않고 예외 처리도 번거롭다. 그래서 요즘은 [Chapter 06](../06-oop-basics)의 복사 생성자나 `static` 복사 메서드를 더 권한다.

### 1.5 getClass: 실행 중의 클래스 정보

```java
Card card = new Card("HEART", 3);
var c1 = card.getClass();  // 인스턴스
var c2 = Card.class;       // 리터럴
var c3 = Class.forName("Card");
// 이름으로. 실행 중에 문자열로 찾는다

c1.getName();         // "Card"
c1.getSuperclass();   // Object
```

| 얻는 법 | 언제 | 왜 셋인가 |
|:------|:-----|:-------|
| `card.getClass()` | 인스턴스가 있을 때 | 변수의 타입이 아니라 실제 클래스를 알아야 할 때 |
| `Card.class` | 클래스 이름을 코드에 적을 수 있을 때 | 컴파일 때 정해진다 |
| `Class.forName("Card")` | 이름이 실행 중에 정해질 때 | 설정 파일의 클래스 이름으로 드라이버를 고르는 식 |

`getClass()`는 참조 변수의 타입이 아니라 실제 인스턴스의 클래스를 돌려준다. [Chapter 07](../07-oop-advanced)의 다형성에서 `Parent p = new Child()`일 때 `p.getClass()`는 `Child`다. 돌려주는 `Class` 객체는 클래스마다 하나뿐이며, [Chapter 01](../01-java-intro)에서 본 클래스 로더가 `.class` 파일을 읽어 올릴 때 만든다. 이 객체를 통해 클래스의 필드, 메서드, 생성자를 실행 중에 조사하고 호출하는 것이 리플렉션이고, 프레임워크가 애너테이션을 읽어 동작하는 바탕이다.

---

## 2. String: 값처럼 쓰이는 객체

### 2.1 왜 바꿀 수 없게 만들었나

```java
String a = "hello";
String b = a + " world";   // 새 String
a;                         // "hello"
```

| 불변이라서 얻는 것 | 설명 | 왜 불변이어야 가능한가 |
|:-------------|:-----|:---------------|
| 안전 | 파일 경로, URL, 접속 정보가 넘겨진 뒤에 바뀌지 않는다 | 검사한 뒤에 바뀌면 검사가 무의미하다 |
| 공유 | 여러 스레드가 동기화 없이 나눠 쓴다 | 바뀌지 않으니 경쟁이 없다 |
| 해시 캐시 | 해시코드를 한 번 계산해 저장해 둔다 | 내용이 고정이라 값이 안 바뀐다. `HashMap`의 키로 빠르다 |
| 풀 | 같은 내용의 문자열을 하나의 객체로 공유한다 (2.2절) | 한쪽이 바꾸면 다른 쪽도 바뀌는 일이 없다 |

둘째 원리다. `String`은 객체이지만 자바는 이것을 값처럼 다루고 싶어 했다. 그래서 만들어진 뒤 내용을 바꿀 수 없는 불변 객체로 설계했고, `final` 클래스라 자손이 그 성질을 깨지도 못한다. JPA 시리즈 [Chapter 11. 값 타입](../../jpa/11-value-types)에서 값 타입은 불변으로 만들라고 했는데, `String`은 자바가 언어 차원에서 그 원칙을 적용한 첫 사례다. 안에는 문자 배열이 있지만 밖으로는 절대 새지 않는다. [Chapter 02](../02-java-variable)에서 본 Compact Strings 이후 그 배열은 `byte[]`이고, Latin-1 범위면 문자당 1바이트를 쓴다. [Chapter 10](../10-date-time-formatting)의 날짜 API가 `Date`의 가변성 때문에 20년을 돌아 불변으로 돌아온 것과 대조된다.

### 2.2 리터럴과 문자열 풀

```java
String s1 = "hello";
String s2 = "hello";
String s3 = new String("hello");
String s4 = new String("hello");

s1 == s2;        // true. 풀의 같은 객체
s3 == s4;        // false. 힙에 각각
s3.equals(s4);   // true. 내용은 같다
```

```text
String Pool           Heap
┌──────────┐     ┌──────────┐
│ "hello"  │     │ "hello"  │◀─ s3
└────▲─────┘     └──────────┘
  ┌──┴──┐        ┌──────────┐
  s1    s2       │ "hello"  │◀─ s4
                 └──────────┘
```

| 식 | `== s1` | 왜 |
|:---|:-------:|:---|
| `"hello"` | `true` | 리터럴은 클래스가 로드될 때 풀에 등록되고 같은 내용은 같은 객체다 |
| `"hel" + "lo"` | `true` | 상수끼리의 연결은 컴파일 때 `"hello"`로 접힌다 |
| `new String("hello")` | `false` | 풀을 거치지 않고 힙에 새 객체를 만든다 |
| `s1 + ""`, 입력값, 연결 결과 | `false` | 실행 중에 만들어진 문자열은 풀에 없다 |
| `d.intern()` | `true` | 풀에 같은 내용이 있으면 그 객체를 돌려준다 |

불변이기 때문에 가능한 최적화가 문자열 풀이다. 소스에 적힌 리터럴은 클래스가 로드될 때 풀에 등록되고, 같은 내용의 리터럴은 같은 객체를 가리킨다. 바뀔 수 없으니 공유해도 안전하다. [Chapter 03](../03-java-operator)에서 `"hello" == "hello"`가 `true`였던 이유이며, 동시에 그 결과를 믿으면 안 되는 이유이기도 하다. `new String("hello")`는 풀을 거치지 않고 힙에 새 객체를 만들고, 실행 중에 만들어진 문자열(입력값, 연결 결과)도 풀에 없다. 같은 내용인데 `==`가 `false`인 경우가 얼마든지 있으므로 문자열 비교는 언제나 `equals()`다.

```java
String c = "hel" + "lo"; // 접힌다
// c == s1 은 true
String d = s1 + "";     // 실행 중 생성
// d == s1 은 false
String e = d.intern();   // 풀의 객체
// e == s1 은 true
```

### 2.3 자주 쓰는 메서드

| 메서드 | 하는 일 | 예 | 왜 알아 둘 것 |
|:-----|:------|:---|:---------|
| `length()` | 길이 (`char` 단위) | `"hello".length()` → `5` | 이모지처럼 서로게이트 쌍은 2로 센다 ([Chapter 02](../02-java-variable)) |
| `charAt(i)` | i번째 문자 | `"abc".charAt(0)` → `'a'` | 배열처럼 0부터 |
| `substring(a, b)` | a부터 b 앞까지 | `"hello".substring(0, 3)` → `"hel"` | 끝 인덱스는 빼고. `copyOfRange`와 같다 |
| `indexOf(s)` | 처음 나오는 위치. 없으면 -1 | `"hello".indexOf("ll")` → `2` | 없음을 예외가 아니라 -1로 |
| `contains(s)` | 포함 여부 | `"hello".contains("ell")` → `true` | `indexOf(s) >= 0`의 이름 |
| `replace(a, b)` | 바꾼 새 문자열 | `"aabb".replace('a', 'c')` → `"ccbb"` | 원본은 그대로. 반환값을 받아야 한다 |
| `trim()`, `strip()` | 양끝 공백 제거 | `" hi ".trim()` → `"hi"` | `strip`은 유니코드 공백까지 (Java 11) |
| `toUpperCase()`, `toLowerCase()` | 대소문자 | `"abc".toUpperCase()` → `"ABC"` | 로케일에 따라 다를 수 있다 |
| `split(regex)` | 정규식으로 나눠 배열로 | `"a,b".split(",")` → `["a", "b"]` | 인자가 정규식이라 `.`은 `"\\."` |
| `String.join(d, ...)` | 구분자로 잇기 | `String.join("-", "a", "b")` → `"a-b"` | 반복문 없이 |
| `compareTo(s)` | 사전순 비교 | `"a".compareTo("b")` → 음수 | 정렬의 기준 ([Chapter 11](../11-collections-framework)) |
| `equalsIgnoreCase(s)` | 대소문자 무시 비교 | `"Hi".equalsIgnoreCase("hi")` → `true` | 둘 다 소문자로 바꿔 비교하는 것보다 싸다 |

```java
String email = "  USER@example.COM  ";
String normalized =
    email.trim().toLowerCase();
// 각 호출이 새 String을 돌려준다
String[] parts = normalized.split("@");
// ["user", "example.com"]
```

모든 메서드가 새 문자열을 돌려준다는 점을 다시 강조해 둔다. `email.trim()`을 부르고 결과를 받지 않으면 아무 일도 일어나지 않는다. 불변이니 당연하지만 가장 흔한 실수다.

```java
String empty = "";   // 길이 0. 된다
char c = '';         // 컴파일 오류
// 문자는 반드시 하나여야 한다
```

빈 문자열은 있어도 빈 문자는 없다. 컴파일러는 "empty character literal"로 거절한다. [Chapter 02](../02-java-variable)에서 본 대로 `char`는 유니코드 번호 하나를 담는 정수라 "없음"을 표현할 수 없다.

### 2.4 기본형과의 변환

```java
String s = String.valueOf(100); // "100"
String t = 100 + "";             // 같다

int i = Integer.parseInt("100");  // 100
double d = Double.parseDouble("3.14");
int hex = Integer.parseInt("FF", 16);
// 255. 진법을 줄 수 있다
```

문자열을 숫자로 바꾸는 메서드는 5절의 래퍼 클래스에 있다. 형식이 맞지 않으면 `NumberFormatException`이 나는데, [Chapter 08](../08-exception-handling)에서 본 대로 이것을 흐름 제어에 쓰지 말고 먼저 검증한다.

---

## 3. StringBuilder: 문자열을 고칠 때

### 3.1 += 반복이 느린 이유

```java
String s = "";
for (int i = 0; i < 10000; i++) {
    s += i;   // 반복마다 새 String
}

StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i);   // 버퍼에 이어 쓴다
}
String result = sb.toString();
```

```text
s += i  (반복마다)
  "0" → "01" → "012" → "0123" …
  매번 새 String. 복사량이 누적된다
```

| 방법 | 반복마다 | 총 복사량 | 왜 |
|:-----|:------|:-------|:---|
| `s += i` | 새 `String` | 길이의 제곱에 비례 | 불변이라 기존 내용을 통째로 복사해 새 객체를 만든다 |
| `sb.append(i)` | 버퍼에 쓰기 | 길이에 비례 | 복사는 버퍼가 꽉 찼을 때만 (3.2절) |
| 한 식의 `a + b + c` | 한 번에 | 걱정 없음 | Java 9부터 컴파일러가 `invokedynamic`으로 한 번에 처리한다 |

셋째 원리다. `String`이 불변이므로 `s += i`는 기존 문자열과 새 조각을 복사해 합친 새 객체를 만든다. 반복이 만 번이면 문자열이 만 번 새로 만들어지고, 매번 지금까지의 길이만큼 복사하니 총 복사량은 길이의 제곱에 비례한다. `StringBuilder`는 내부에 바꿀 수 있는 문자 배열을 두고 거기에 이어 쓴다. 복사는 배열이 꽉 찼을 때만 일어난다. 한 식 안의 `a + b + c`는 걱정할 필요가 없다. Java 9부터 컴파일러가 이런 연결을 한 번에 처리하는 코드로 바꾼다. 문제는 반복문 안에서 누적하는 경우이고, 그때만 `StringBuilder`를 쓰면 된다.

### 3.2 버퍼와 용량

```java
var a = new StringBuilder();    // 16
var b = new StringBuilder(100); // 100
var c = new StringBuilder("hello");
// 용량 16 + 5
```

```text
용량 16 ─▶ 꽉 참 ─▶ 새 배열 34로 교체
            (기존 용량 × 2 + 2)
```

버퍼가 차면 [Chapter 05](../05-array)의 `ArrayList`처럼 더 큰 배열을 만들어 복사한다. 새 용량은 기존 용량의 두 배에 2를 더한 크기다. 두 배씩 키우면 복사 횟수가 로그 규모로 줄어, 만 번을 이어 붙여도 복사는 열 번 남짓이다. 최종 길이를 짐작할 수 있으면 처음부터 그 용량을 주어 복사를 없앨 수 있다.

### 3.3 이어 쓰기와 비교

```java
var sb = new StringBuilder("Hello");
sb.append(" World!")
  .insert(5, ",")
  .replace(7, 12, "Java")
  .reverse();
```

`append()`를 비롯한 편집 메서드는 자기 자신을 돌려준다. 그래서 점으로 이어 쓸 수 있는데, 이 반환값은 새 객체가 아니라 같은 객체다. `String`과 정반대다.

```java
var x = new StringBuilder("abc");
var y = new StringBuilder("abc");
x.equals(y);               // false
x.toString().equals(y.toString());
// true
x.compareTo(y) == 0;   // true. Java 11
```

| 클래스 | `equals()` | 왜 |
|:-----|:----------|:---|
| `String` | 내용 비교 | 불변이라 넣을 때와 찾을 때의 해시가 같다 |
| `StringBuilder` | 재정의 안 함 (`==`) | 내용이 바뀌는 객체를 해시 키로 쓰면 넣은 뒤 못 찾는다. 일부러 막았다 |

`StringBuilder`는 `equals()`를 재정의하지 않았다. 일부러 그랬다. 1.2절에서 본 대로 `equals()`와 `hashCode()`는 해시 자료구조의 키로 쓰이는데, 내용이 바뀌는 객체를 키로 쓰면 넣을 때와 찾을 때의 해시코드가 달라진다. 가변 객체에 내용 기반 `equals()`를 주지 않은 것은 그 함정을 막으려는 선택이고, 첫째 원리와 셋째 원리가 만나는 자리다. 내용을 비교하려면 `String`으로 바꾸거나 `compareTo()`를 쓴다.

### 3.4 StringBuffer와 StringBuilder

| 클래스 | 동기화 | 언제 | 왜 둘인가 |
|:-----|:-----|:-----|:-------|
| `StringBuffer` | 메서드마다 `synchronized` | 여러 스레드가 같은 인스턴스에 이어 쓸 때 | 먼저 있었다. 안전하지만 모든 호출이 값을 치른다 |
| `StringBuilder` | 없음 | 그 외 전부. 실무의 대부분 | 한 스레드만 쓰는 흔한 경우에 동기화는 낭비라 Java 5에 추가됐다 |

둘은 기능이 같고 동기화 여부만 다르다. `StringBuffer`가 먼저 있었고, 모든 메서드에 붙은 동기화 비용이 한 스레드만 쓰는 흔한 경우에도 들어가는 것이 낭비라서 Java 5에 `StringBuilder`가 추가됐다. 동기화가 무엇이고 왜 비용인지는 [Chapter 13](../13-thread)에서 본다. 한 메서드 안에서 만들어 쓰고 버리는 빌더는 다른 스레드가 볼 수 없으니 `StringBuilder`면 된다.

---

## 4. Math

```java
Math.abs(-10);      // 10
Math.max(3, 7);     // 7
Math.pow(2, 10);    // 1024.0
Math.sqrt(16);      // 4.0
Math.random();      // 0.0 이상 1.0 미만
(int) (Math.random() * 6) + 1;   // 1~6
```

`Math`는 인스턴스가 없다. 생성자가 `private`이고 메서드가 전부 `static`이다. [Chapter 07](../07-oop-advanced)의 유틸리티 클래스 그대로인데, 계산에 인스턴스의 상태가 필요 없으니 만들 이유도 없기 때문이다. 셋째 원리의 "계산은 기본형으로"가 가장 분명한 자리다. 인자도 반환값도 전부 기본형이다.

### 4.1 반올림 네 가지

| 메서드 | 하는 일 | `1.5` | `-1.5` | `2.5` | 왜 |
|:-----|:------|:-----|:------|:-----|:---|
| `round()` | 가장 가까운 정수. 정확히 중간이면 큰 쪽 | `2` | `-1` | `3` | `floor(x + 0.5)`로 정의돼 있다. 유일하게 `long`을 돌려준다 |
| `rint()` | 가장 가까운 정수. 중간이면 짝수 쪽 | `2.0` | `-2.0` | `2.0` | 통계에서 반올림이 한쪽으로 치우치지 않게 하는 관례 |
| `floor()` | 작은 쪽 정수 | `1.0` | `-2.0` | `2.0` | 내림 |
| `ceil()` | 큰 쪽 정수 | `2.0` | `-1.0` | `3.0` | 올림 |

`round()`만 정수 타입(`long`)을 돌려주고 나머지는 `double`이다. `round(-1.5)`가 `-1`인 것은 `floor(x + 0.5)`로 정의되어 있어 중간값이 항상 큰 쪽으로 가기 때문이다. `rint()`가 짝수 쪽으로 가는 것은 통계에서 반올림이 한쪽으로 치우치지 않게 하는 관례다.

```java
double val = 90.7552;
Math.round(val * 100) / 100.0;  // 90.76
Math.round(val * 100) / 100;     // 90
// 정수 나눗셈이 되어 버린다
```

소수 둘째 자리에서 반올림하려면 100을 곱해 정수로 반올림한 뒤 다시 나눈다. 나눌 때 `100.0`이어야 하는 이유는 [Chapter 03](../03-java-operator)이다. `round()`가 돌려준 `long`을 정수 100으로 나누면 정수 나눗셈이다.

### 4.2 오버플로우를 잡아 주는 메서드

```java
int a = Integer.MAX_VALUE;
a + 1;                 // -2147483648
Math.addExact(a, 1);   // 예외
```

| 메서드 | 넘치면 | 왜 따로 있나 |
|:-----|:-----|:---------|
| `+`, `-`, `*` | 반대쪽 끝으로 돌아간다 | 모든 연산에 검사를 넣으면 전부 느려진다 ([Chapter 02](../02-java-variable)) |
| `addExact()`, `subtractExact()`, `multiplyExact()`, `toIntExact()` | `ArithmeticException` | 검사 비용을 원하는 곳에서만 치른다 (Java 8) |

[Chapter 02](../02-java-variable)에서 정수 연산은 넘쳐도 예외를 내지 않는다고 했다. 검사 비용을 매번 치르지 않기 위해서였다. 그 검사를 원할 때만 하려고 Java 8이 이 메서드들을 두었다. 넘치면 `ArithmeticException`을 던지므로 금액 계산처럼 틀리면 안 되는 곳에 쓴다. `StrictMath`라는 쌍둥이 클래스가 있다. `Math`는 속도를 위해 CPU의 명령어를 직접 쓸 수 있어 기계마다 마지막 자리가 다를 수 있는데, `StrictMath`는 정해진 알고리즘으로만 계산해 어디서나 같은 비트를 낸다. [Chapter 01](../01-java-intro)의 "어디서나 같은 결과"를 실수 계산에서까지 원할 때 쓴다.

---

## 5. 래퍼 클래스: 기본형을 객체로

### 5.1 왜 필요한가

| 기본형 | 래퍼 | 기본형 | 래퍼 | 왜 이름이 다른 둘 |
|:-----|:-----|:-----|:-----|:------------|
| `boolean` | `Boolean` | `int` | `Integer` | `int`와 `char`는 축약어라 풀어 썼다 |
| `char` | `Character` | `long` | `Long` | |
| `byte` | `Byte` | `float` | `Float` | |
| `short` | `Short` | `double` | `Double` | |

| 래퍼가 하는 일 | 예 | 왜 |
|:----------|:---|:---|
| 기본형을 객체 자리에 넣는다 | `ArrayList<Integer>` | 컬렉션과 지네릭스는 참조형만 받는다 ([Chapter 12](../12-generics-enum-annotation)) |
| 그 타입의 도구를 모아 둔다 | `Integer.MAX_VALUE`, `parseInt()`, `toBinaryString()`, `Character.isDigit()` | 기본형에는 메서드를 붙일 곳이 없다 |

[Chapter 02](../02-java-variable)에서 자바의 값은 기본형과 참조형으로 나뉜다고 했다. 이 구분은 성능에는 좋지만 한 가지 문제를 낳는다. 객체만 받는 자리에 기본형을 넣을 수 없다. `ArrayList`는 `Object`의 자손만 담을 수 있고, [Chapter 12](../12-generics-enum-annotation)의 지네릭스는 타입 인자로 참조형만 받는다. `ArrayList<int>`는 안 되고 `ArrayList<Integer>`여야 한다. 래퍼 클래스는 기본형 하나를 감싼 불변 객체로, 기본형을 객체가 필요한 자리에 넣기 위해 존재한다. 래퍼 클래스는 값을 담는 것 말고도 그 타입에 관한 도구를 모아 두는 자리다. 2절에서 문자열을 숫자로 바꾸는 메서드가 여기 있었던 이유다.

### 5.2 캐시와 ==

```text
Integer.valueOf(127) ─▶ 캐시의 같은 객체
Integer.valueOf(128) ─▶ 매번 새 객체
```

```java
Integer a = Integer.valueOf(127);
Integer b = Integer.valueOf(127);
a == b;        // true
Integer c = Integer.valueOf(128);
Integer d = Integer.valueOf(128);
c == d;        // false
c.equals(d);   // true
```

| 래퍼 | 캐시 범위 | 왜 |
|:-----|:-------|:---|
| `Byte`, `Short`, `Integer`, `Long` | -128 ~ 127 | 작은 정수는 워낙 자주 쓰여 매번 만드는 낭비를 줄인다 |
| `Character` | 0 ~ 127 | ASCII 범위 |
| `Boolean` | `TRUE`, `FALSE` 둘뿐 | 값이 둘뿐이다 |
| `Float`, `Double` | 없음 | 자주 겹치는 값이 없다 |

[Chapter 03](../03-java-operator)에서 미뤄 둔 질문의 답이다. `Integer.valueOf()`는 -128부터 127까지의 값을 미리 만들어 두고 같은 객체를 돌려준다. 작은 정수는 워낙 자주 쓰여서 매번 객체를 만드는 낭비를 줄이려는 최적화다. 그 범위 밖은 매번 새 객체이므로 `==`가 `false`다. 둘째 원리다. 래퍼가 불변이라 공유할 수 있고, 문자열 풀과 같은 교훈이 따른다. 최적화 때문에 `==`가 우연히 맞는 경우가 있을 뿐, 래퍼의 비교는 `equals()`다. `new Integer(100)`처럼 생성자로 만드는 방식은 Java 9부터 폐기됐고 제거 예정이다. 캐시를 우회해 항상 새 객체를 만들기 때문이다.

### 5.3 Number와 변환

```text
           Number (abstract)
  ┌─────┬────┬─────┬─────┬─────┐
  │     │    │     │     │     │
 Byte Short Integer Long Float Double
                      │
             BigInteger, BigDecimal
```

```java
Integer i = Integer.valueOf("100");
// 문자열 → 래퍼
int n = Integer.parseInt("100");
// 문자열 → 기본형
double d = i.doubleValue();
// 래퍼 → 다른 기본형
```

| 메서드 | 돌려주는 것 | 왜 둘 다 있나 |
|:-----|:--------|:----------|
| `parseXxx(String)` | 기본형 | 계산에 쓸 값 |
| `valueOf(String)`, `valueOf(기본형)` | 래퍼 | 객체 자리에 넣을 값. 캐시를 거친다 |
| `xxxValue()` | 다른 기본형 | `Number`의 약속. 어떤 숫자든 어떤 기본형으로든 꺼낸다 |

숫자 래퍼는 모두 `Number`의 자손이고, `intValue()`, `doubleValue()`처럼 어떤 기본형으로든 꺼내는 메서드를 약속한다. [Chapter 02](../02-java-variable)에서 본 `BigInteger`와 `BigDecimal`도 `Number`의 자손이라 같은 방식으로 다룰 수 있다. `parseXxx()`는 기본형을, `valueOf()`는 래퍼를 돌려준다는 것만 구분하면 된다.

### 5.4 오토박싱과 언박싱

```java
Integer num = 100;   // 박싱. valueOf
int n = num;         // num.intValue()

Integer a = 10, b = 20;
int sum = a + b;     // 언박싱해 더함

List<Integer> list = new ArrayList<>();
list.add(100);       // valueOf(100)
int first = list.get(0);   // intValue()
```

Java 5부터 기본형과 래퍼 사이의 변환을 컴파일러가 대신 넣어 준다. 코드는 기본형만 쓰는 것처럼 보이지만 실제로는 객체가 만들어지고 풀린다. 셋째 원리의 그림자다. 편리한 만큼 두 가지를 알고 있어야 한다.

```java
Integer count = null;
int c = count;   // NullPointerException
// null.intValue()

Long total = 0L;
for (long i = 0; i < 1_000_000; i++) {
    total += i;
    // 반복마다 언박싱, 덧셈, 박싱
}
```

| 함정 | 무슨 일이 생기나 | 왜 |
|:-----|:-----------|:---|
| `null` 언박싱 | `NullPointerException` | 래퍼는 `null`일 수 있는데 기본형은 아니다. `null.intValue()`가 된다 |
| 누적 변수를 래퍼로 | 반복마다 객체가 새로 만들어진다 | 래퍼는 불변이라 `+=`마다 새 객체. 백만 번이면 객체 백만 개 |
| 기본형 특화 함수형 인터페이스 | `IntFunction`, `IntPredicate` 등이 따로 있다 | 박싱을 피하려고 ([Chapter 14](../14-lambda-stream)) |

래퍼는 `null`일 수 있는데 기본형은 아니므로, `null`인 래퍼를 언박싱하면 `NullPointerException`이다. `Integer`를 돌려주는 메서드의 결과를 `int`에 받을 때 자주 난다. 두 번째는 성능이다. 누적 변수를 래퍼로 두면 반복마다 객체가 새로 만들어진다. 계산은 기본형으로 하고, 객체가 꼭 필요한 자리에서만 래퍼를 쓴다.

---

## 핵심 정리

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| `Object.equals` | 기본은 `==`. 값 비교는 재정의 | 같음의 기준은 클래스가 정한다 |
| `hashCode` | `equals`와 반드시 함께 | 해시 자료구조는 해시코드로 칸을 고른 뒤 `equals`로 확인한다 |
| 기본 해시코드 | 유일하지 않다 | GC로 옮겨져도 바뀌지 않게 난수를 헤더에 둔다 |
| `toString` | 재정의하면 어디서든 값이 보인다 | 출력, 연결, 로그가 전부 이 메서드를 부른다 |
| `clone` | 얕은 복사. 설계가 어색하다 | 생성자를 거치지 않는다. 복사 생성자를 권한다 |
| `getClass` | 실제 인스턴스의 클래스 | 리플렉션과 프레임워크의 바탕 |
| `String` 불변 | 바꿀 수 없고 `final` | 안전, 공유, 해시 캐시, 풀 |
| 문자열 풀 | 리터럴은 같은 객체 | 불변이라 공유해도 안전하다. 그래도 비교는 `equals` |
| `StringBuilder` | 반복 누적에 쓴다 | `+=`는 매번 복사해 제곱으로 느리다 |
| `StringBuilder.equals` | 재정의하지 않았다 | 가변 객체는 해시 키로 쓰면 안 된다 |
| `StringBuffer` | 동기화 버전 | 한 스레드만 쓰면 비용만 든다 |
| `Math` | 인스턴스 없는 `static` 도구 | 계산에 상태가 필요 없다 |
| 래퍼 | 기본형을 객체 자리에. 불변 | 지네릭스와 컬렉션은 참조형만 받는다 |
| `Integer` 캐시 | -128~127은 같은 객체 | 작은 정수의 생성 낭비를 줄인다. 비교는 `equals` |
| 오토박싱 | 컴파일러가 변환을 넣는다 | `null` 언박싱과 반복문 박싱 비용에 주의 |

{{< callout type="info" >}}
**용어 정리**
- **`Object`**: 모든 클래스의 조상. 열한 개 메서드가 모든 객체의 공통 약속
- **`equals` / `hashCode` 계약**: `equals`가 참이면 `hashCode`도 같아야 한다. 역은 성립하지 않아도 된다
- **식별 해시코드**: 재정의 전의 해시. 주소가 아니라 처음 요청될 때 만든 난수
- **`record`**: 모든 필드 기준의 `equals`, `hashCode`, `toString`을 자동으로 갖는 클래스 (Java 16)
- **얕은 복사 / 깊은 복사**: 참조 필드가 같은 객체를 가리킴 / 참조 필드까지 새로 만듦
- **리플렉션**: `Class` 객체로 실행 중에 클래스의 구조를 조사하고 호출하는 것
- **불변 객체**: 만들어진 뒤 내용이 바뀌지 않는 객체. `String`, 래퍼. 공유와 캐시의 바탕
- **문자열 풀**: 리터럴을 모아 같은 내용이면 같은 객체를 쓰게 하는 곳. `intern()`으로 넣는다
- **`StringBuilder` / `StringBuffer`**: 가변 문자 버퍼. 후자는 동기화 버전
- **용량**: 버퍼 배열의 크기. 꽉 차면 두 배 + 2로 교체
- **`Exact` 메서드**: 넘치면 `ArithmeticException`을 던지는 산술 (Java 8)
- **래퍼 클래스**: 기본형 하나를 감싼 불변 객체와 그 타입의 도구 모음
- **`Integer` 캐시**: `valueOf`가 -128~127을 같은 객체로 돌려주는 것
- **오토박싱 / 언박싱**: 컴파일러가 `valueOf()` / `xxxValue()`를 대신 넣는 것 (Java 5)
{{< /callout >}}
