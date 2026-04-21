---
title: "Chapter 06. 객체지향 프로그래밍 I"
weight: 6
---

객체지향 프로그래밍(OOP)의 기본 개념인 클래스, 객체, 메서드, 생성자, 변수 초기화를 다룬다.

---

## 1. 객체지향 언어

### 1.1 객체지향의 관점

**객체지향 이론:** "실제 세계는 사물(객체)로 이루어져 있으며, 발생하는 모든 사건은 사물 간의 상호작용이다."

객체지향 언어는 다음 세 가지 관점에서 접근하면 이해가 쉽다.

| 관점 | 설명 |
|:---|:---|
| 재사용성 | 기존 코드를 확장해 새 기능을 빠르게 작성 |
| 관리 용이성 | 코드 간 관계를 통해 적은 노력으로 변경 전파 |
| 신뢰성 | 접근 제어와 캡슐화로 데이터 보호, 중복 제거로 불일치 방지 |

{{< callout type="info" >}}
**절차지향과의 차이.** 절차지향은 "무엇을 할지"(함수)를 중심으로 데이터를 가공한다. 객체지향은 "누가 책임질지"(객체)를 중심으로 데이터와 그에 대한 행위를 한 단위에 묶어 관리한다.
{{< /callout >}}

---

## 2. 클래스와 객체

### 2.1 클래스와 객체의 정의

| 용어 | 정의 | 용도 |
|:---|:---|:---|
| 클래스 (Class) | 객체를 정의해 놓은 것 (설계도, 틀) | 객체 생성 |
| 객체 (Object) | 실제로 존재하는 것 (사물, 개념) | 객체가 가진 속성과 기능을 사용 |

{{< callout type="warning" >}}
클래스는 설계도일 뿐 객체 자체가 아니다. 객체를 사용하려면 **반드시 `new` 로 인스턴스를 생성**해야 한다.
{{< /callout >}}

### 2.2 객체와 인스턴스

- **인스턴스화(instantiate):** 클래스로부터 객체를 만드는 과정
- **인스턴스(instance):** 어떤 클래스로부터 만들어진 객체 (특정 클래스 소속임을 강조)

```java
Tv t = new Tv();   // Tv 클래스의 인스턴스 t 생성
```

### 2.3 객체의 구성요소

객체는 **속성(attribute)**과 **기능(function)**으로 이루어진다.

| 구성요소 | 다른 용어 | 설명 |
|:---|:---|:---|
| 속성 | 멤버변수, 필드, 상태 | 객체의 데이터 |
| 기능 | 메서드, 함수, 행위 | 객체의 동작 |

```java
public class Tv {
    // 속성 (멤버변수)
    String color;
    boolean power;
    int channel;

    // 기능 (메서드)
    void power()       { power = !power; }
    void channelUp()   { ++channel; }
    void channelDown() { --channel; }
}
```

### 2.4 인스턴스의 생성과 사용

```java
public class TvTest {
    public static void main(String[] args) {
        Tv t;                // 1) 참조변수 선언
        t = new Tv();        // 2) 인스턴스 생성
        t.channel = 7;       // 3) 멤버변수 접근
        t.channelDown();     // 4) 메서드 호출
        System.out.println(t.channel);
    }
}
```

**단계별 메모리 상태:**

1. `Tv t;` — 스택에 참조변수 자리 마련, 값은 없음
2. `t = new Tv();` — 힙에 `Tv` 인스턴스 생성, 멤버변수는 기본값으로 초기화, 주소를 `t`에 저장
3. `t.channel = 7;` — `t`가 가리키는 인스턴스의 `channel`에 값 쓰기
4. `t.channelDown();` — 해당 인스턴스의 메서드 호출

**여러 참조변수와 하나의 인스턴스:**

```java
Tv t1 = new Tv();
Tv t2 = new Tv();
t1.channel = 7;
System.out.println(t2.channel);   // 0 (독립된 인스턴스)

Tv t3 = new Tv();
Tv t4 = t3;                       // 같은 인스턴스를 가리킴
t3.channel = 7;
System.out.println(t4.channel);   // 7 (공유)
```

{{< callout type="warning" >}}
**중요 원칙**

- 인스턴스는 참조변수를 통해서만 다룰 수 있다
- 참조변수의 타입은 인스턴스의 타입과 일치해야 한다 (또는 상속 관계)
- 하나의 참조변수는 한 번에 하나의 인스턴스만 가리킨다
- 여러 참조변수가 하나의 인스턴스를 공유할 수 있다
{{< /callout >}}

### 2.5 객체 배열

객체 배열은 **참조(주소)를 저장하는 배열**이다. 배열 생성만으로 인스턴스가 만들어지지 않는다.

```java
Tv[] tvArr = new Tv[3];   // [null, null, null]

for (int i = 0; i < tvArr.length; i++) {
    tvArr[i] = new Tv();        // 인스턴스 별도 생성 필요
    tvArr[i].channel = i + 10;
}
```

```
tvArr ──┐
        ▼
    ┌──────┐
    │ [0] ─┼──▶ Tv (ch=10)
    │ [1] ─┼──▶ Tv (ch=11)
    │ [2] ─┼──▶ Tv (ch=12)
    └──────┘
```

---

## 3. 변수와 메서드

### 3.1 선언 위치에 따른 변수의 종류

```java
class Variables {
    int iv;            // 인스턴스 변수
    static int cv;     // 클래스 변수 (static)

    void method() {
        int lv = 0;    // 지역 변수
    }
}
```

| 종류 | 선언 위치 | 생성 시점 | 소멸 시점 |
|:---|:---|:---|:---|
| 클래스 변수 | 클래스 영역 | 클래스 로딩 시 | 프로그램 종료 시 |
| 인스턴스 변수 | 클래스 영역 | 인스턴스 생성 시 | GC가 제거할 때 |
| 지역 변수 | 메서드/블록 | 선언문 실행 시 | 블록을 벗어날 때 |

### 3.2 인스턴스 변수 vs 클래스 변수

```java
public class Card {
    String kind;          // 인스턴스 변수 (카드마다 다름)
    int number;

    static int width  = 100;   // 클래스 변수 (모든 카드 공유)
    static int height = 250;
}
```

```java
// 클래스 변수는 인스턴스 생성 없이도 사용 가능
System.out.println(Card.width);   // 100

Card c1 = new Card();
Card c2 = new Card();

c1.width = 50;   // 공유 변수 변경
System.out.println(c2.width);   // 50 (같은 저장공간)
```

{{< callout type="info" >}}
**static 필드는 메서드 영역(method area)의 클래스 데이터에 단 하나만 존재한다.** 인스턴스마다 복사되지 않고 클래스 전체가 공유한다. 그래서 `c1.width`와 `c2.width`는 실제로는 같은 저장소를 가리킨다.
{{< /callout >}}

{{< callout type="warning" >}}
**클래스 변수는 클래스 이름으로 접근하자.** `c1.width = 50;`도 동작하지만, 인스턴스 변수로 오해하기 쉽다. `Card.width = 50;`이 의도를 명확히 드러낸다.
{{< /callout >}}

### 3.3 메서드

메서드는 **특정 작업을 수행하는 문장들의 묶음**이다.

**사용 이유**

1. 재사용성: 한 번 작성한 메서드를 여러 곳에서 사용
2. 중복 제거: 수정이 메서드 한 곳에서 끝나므로 유지보수 용이
3. 구조화: 복잡한 작업을 작은 단위로 분할해 가독성·디버깅 향상

{{< callout type="info" >}}
**블랙박스 개념.** 호출자는 내부 구현을 몰라도 입력과 출력만 알면 메서드를 사용할 수 있다. 이 원칙이 캡슐화와 정보 은닉의 기반이 된다.
{{< /callout >}}

### 3.4 메서드의 선언과 구현

```
반환타입 메서드이름(매개변수 선언) {   // 선언부
    // 구현부
    return 반환값;   // 반환타입이 void가 아닌 경우
}
```

| 구성 요소 | 설명 |
|:---|:---|
| 반환타입 | 결과의 타입. 반환값 없으면 `void` |
| 메서드 이름 | 변수 명명규칙과 동일, 동사 사용 권장 |
| 매개변수 | 입력값을 받을 변수, `타입 이름, 타입 이름, ...` |

```java
int add(int x, int y) {
    return x + y;
}

void power() {               // void: 반환값 없음
    power = !power;
}

// 조기 종료
void printGugudan(int dan) {
    if (dan < 2 || dan > 9) return;
    for (int i = 1; i <= 9; i++) {
        System.out.printf("%d * %d = %d%n", dan, i, dan * i);
    }
}
```

{{< callout type="warning" >}}
**한 번에 하나의 값만 반환할 수 있다.** 여러 값을 돌려주려면 배열/컬렉션/객체/`record`로 묶어야 한다.
{{< /callout >}}

### 3.5 메서드 호출 — 인자와 매개변수

| 용어 | 설명 |
|:---|:---|
| 인자 (Argument) | 호출 시 전달하는 값 |
| 매개변수 (Parameter) | 메서드 선언부에 정의된 변수 |

인자의 개수·순서·타입이 매개변수와 일치하거나 자동 형변환 가능해야 한다.

```java
long add(int a, long b) { return a + b; }

add(3, 5L);    // OK
add(3L, 5);    // OK (int → long 자동 형변환)
add(3, 5);     // OK
```

### 3.6 JVM의 메모리 구조

JVM은 메모리를 용도별로 나눠 관리한다.

```
┌────────────────────────┐
│ Method Area            │ ← 클래스 정보, static 변수
├────────────────────────┤
│ Heap                   │ ← 인스턴스, 인스턴스 변수
├────────────────────────┤
│ Call Stack             │ ← 메서드 프레임, 지역 변수
└────────────────────────┘
```

| 영역 | 저장 | 생성·소멸 |
|:---|:---|:---|
| Method Area | 클래스, static 필드 | 클래스 로딩 ~ 프로그램 종료 |
| Heap | 인스턴스, 배열 | `new` ~ GC |
| Call Stack | 메서드 프레임, 지역 변수 | 호출 ~ 반환 |

**호출스택의 동작:**

- 메서드가 호출되면 프레임이 스택에 쌓인다
- 제일 위 프레임이 현재 실행 중인 메서드
- 반환하면 프레임이 제거되고 아래 프레임으로 제어가 돌아간다

```java
static void main(String[] a)   { firstMethod(); }
static void firstMethod()      { secondMethod(); }
static void secondMethod()     { /* ... */ }
```

```
실행 순서별 Call Stack:
1) [main]
2) [main, firstMethod]
3) [main, firstMethod, secondMethod]
4) [main, firstMethod]
5) [main]
6) []
```

### 3.7 기본형 매개변수와 참조형 매개변수

Java는 **값에 의한 전달(pass by value)**만 지원한다. 단, 참조형은 "값"이 곧 **주소**라서 결과적으로 원본 객체를 변경할 수 있다.

| 매개변수 타입 | 전달되는 것 | 원본 변경 가능성 |
|:---|:---|:---|
| 기본형 | 값 | 불가 |
| 참조형 | 주소 (참조 사본) | 가능 (같은 객체 공유) |

**기본형:**

```java
int x = 10;
change(x);            // change는 복사본만 수정
// x == 10
static void change(int x) { x = 100; }
```

**참조형:**

```java
class Data { int x; }

Data d = new Data();
d.x = 10;
change(d);            // d가 가리키는 객체를 변경
// d.x == 100
static void change(Data d) { d.x = 100; }
```

```
main의 d  ──(주소 복사)──▶  change의 d
     │                            │
     └──▶  ┌─────────┐ ◀─────────┘
           │ x: 100  │
           └─────────┘
```

{{< callout type="info" >}}
**배열도 참조형이다.** 메서드에 배열을 전달하면 내부에서 요소를 수정한 결과가 원본에 그대로 반영된다. 불변성이 필요하다면 복사본을 넘기거나 리스트를 `List.copyOf` 등으로 감싼다.
{{< /callout >}}

---

## 4. 오버로딩 (Overloading)

### 4.1 정의

**오버로딩:** 한 클래스에 같은 이름의 메서드를 여러 개 정의하는 것.

```java
int add(int a, int b)             { return a + b; }
long add(long a, long b)          { return a + b; }
int add(int a, int b, int c)      { return a + b + c; }
```

### 4.2 조건

1. 메서드 이름이 같아야 한다
2. 매개변수의 **개수 또는 타입**이 달라야 한다
3. 반환 타입은 오버로딩 판단에 영향을 주지 않는다

| 항목 | 오버로딩 구분 |
|:---|:---|
| 이름 | 반드시 같음 |
| 매개변수 개수 | 다르면 구분 |
| 매개변수 타입 | 다르면 구분 |
| 매개변수 이름 | 관계없음 |
| 반환 타입 | 관계없음 |

```java
// 잘못된 오버로딩 (매개변수 동일, 반환만 다름)
int add(int a, int b)  { return a + b; }
// long add(int a, int b) { return a + b; }  // 컴파일 에러
```

### 4.3 장점

- 메서드 이름을 절약할 수 있다
- 같은 작업임을 이름만 보고 알 수 있다
- 호출자가 타입별 함수명을 기억할 필요가 없다

### 4.4 가변인자 (Varargs)

JDK 1.5부터 **가변인자**를 지원한다. `타입... 이름` 형태이며 **마지막 매개변수**에만 올 수 있다.

```java
public String concat(String... args) {
    // args는 내부적으로 배열
    return String.join("", args);
}

concat("a");
concat("a", "b", "c");
concat();   // 인자 0개도 가능
```

{{< callout type="warning" >}}
**가변인자 + 오버로딩은 피하자.** 모호한 호출(ambiguous call)로 컴파일 에러가 나거나 의도와 다른 메서드가 선택될 수 있다.

```java
void method(int... args) { }
void method(int a, int b) { }

method(1, 2);   // 둘 다 후보 → 모호함
```
{{< /callout >}}

---

## 5. 생성자 (Constructor)

### 5.1 생성자란?

**인스턴스가 생성될 때 호출되는 초기화 메서드**다. 조건:

1. 이름이 클래스 이름과 같다
2. 반환값이 없다 (`void`도 쓰지 않음)

```java
class Card {
    String kind;
    int number;

    Card() { }                                   // 매개변수 없는 생성자

    Card(String kind, int number) {              // 매개변수 있는 생성자
        this.kind = kind;
        this.number = number;
    }
}
```

{{< callout type="warning" >}}
**생성자는 인스턴스를 "만들지" 않는다.** 인스턴스는 `new` 연산자가 힙에 할당한다. 생성자는 할당된 그 공간을 **초기화**할 뿐이다.
{{< /callout >}}

**`new Card()` 실행 과정**

1. `new` 연산자가 힙에 `Card` 공간 할당, 멤버는 기본값으로 초기화
2. 생성자 `Card()` 호출로 추가 초기화 수행
3. 생성된 인스턴스의 주소가 호출자 쪽 참조변수에 저장

### 5.2 기본 생성자 (Default Constructor)

클래스에는 반드시 하나 이상의 생성자가 있어야 한다. **생성자를 하나도 선언하지 않은 경우에 한해** 컴파일러가 매개변수 없는 기본 생성자를 자동 추가한다.

```java
// 생성자 없음 → 컴파일러가 Card() { } 자동 추가
class Card {
    String kind;
    int number;
}
```

{{< callout type="warning" >}}
**생성자를 하나라도 직접 정의하면 기본 생성자는 자동 추가되지 않는다.**

```java
class Card {
    Card(String kind, int number) { /* ... */ }
}
// new Card();  // 에러! 기본 생성자 없음
```
{{< /callout >}}

### 5.3 생성자에서 다른 생성자 호출 — `this()`

- `this(...)`로 **같은 클래스의 다른 생성자**를 호출한다
- 반드시 **생성자의 첫 줄**에서 호출해야 한다

```java
class Car {
    String color;
    String gearType;
    int door;

    Car()                                { this("white", "auto", 4); }
    Car(String color, String gearType)   { this(color, gearType, 4); }
    Car(String color, String gearType, int door) {
        this.color = color;
        this.gearType = gearType;
        this.door = door;
    }
}
```

{{< callout type="warning" >}}
**왜 첫 줄이어야 할까?** 다른 생성자 호출 전에 어떤 초기화를 해버리면 `this()`로 호출된 생성자가 그 값을 덮어쓸 수 있다. 첫 줄 규칙은 "초기화는 반드시 가장 기본 생성자부터 위로 전파한다"는 일관성을 강제한다.
{{< /callout >}}

### 5.4 `this` — 인스턴스 자신의 참조

```java
class Car {
    String color;

    Car(String color) {
        this.color = color;   // this.color: 멤버, color: 매개변수
    }
}
```

| 키워드 | 의미 | 사용 위치 |
|:---|:---|:---|
| `this` | 인스턴스 자신의 참조 | 인스턴스 메서드, 생성자 |
| `this()` | 같은 클래스의 다른 생성자 호출 | 생성자의 첫 줄 |

{{< callout type="info" >}}
**`this` 는 인스턴스 메서드의 숨겨진 첫 번째 매개변수처럼 동작한다.** 컴파일러가 자동으로 "지금 호출된 인스턴스 주소"를 넘겨주기 때문에, `static` 메서드에는 `this`가 존재하지 않는다(인스턴스 없이 호출되기 때문).
{{< /callout >}}

### 5.5 복사 생성자

```java
class Car {
    // ...
    Car(Car c) {
        this(c.color, c.gearType, c.door);
    }
}

Car c1 = new Car("blue", "manual", 2);
Car c2 = new Car(c1);   // c1의 상태를 복사
```

---

## 6. 변수의 초기화

### 6.1 변수 초기화의 필요성

| 변수 종류 | 초기화 필수 | 기본값 자동 할당 |
|:---|:---|:---|
| 지역 변수 | 필수 | X (사용 전 반드시 초기화) |
| 멤버 변수 | 선택 | O (자료형 기본값) |

**멤버 변수 기본값**

| 타입 | 기본값 |
|:---|:---|
| `boolean` | `false` |
| `char` | `' '` |
| `byte`, `short`, `int` | `0` |
| `long` | `0L` |
| `float` / `double` | `0.0f` / `0.0d` |
| 참조형 | `null` |

### 6.2 멤버변수 초기화 방법

1. 명시적 초기화
2. 생성자
3. 초기화 블록 (인스턴스 / 클래스)

### 6.3 명시적 초기화

```java
class Car {
    int door = 4;
    String color = "white";
    Engine engine = new Engine();
}
```

### 6.4 초기화 블록

복잡한 초기화가 필요할 때 사용한다.

```java
class InitBlock {
    static int cv;
    int iv;

    // 클래스 초기화 블록: 클래스 로딩 시 1회
    static {
        cv = 10;
    }

    // 인스턴스 초기화 블록: 매 인스턴스 생성 시 (생성자보다 먼저)
    {
        iv = 20;
    }

    InitBlock() {
        // 생성자 본문
    }
}
```

**활용 예 — 모든 생성자의 공통 초기화:**

```java
class Car {
    static int count = 0;
    String color;
    String gearType;

    { count++; }   // 모든 생성자에서 공통 실행

    Car()                                      { this("white", "auto"); }
    Car(String color, String gearType)         {
        this.color = color;
        this.gearType = gearType;
    }
}
```

### 6.5 멤버변수 초기화 시기와 순서

**시점**

- 클래스 변수: 클래스가 처음 로딩될 때 한 번
- 인스턴스 변수: 인스턴스 생성 시마다

**순서**

```
클래스 변수:
  기본값 → 명시적 초기화 → 클래스 초기화 블록

인스턴스 변수:
  기본값 → 명시적 초기화
       → 인스턴스 초기화 블록 → 생성자
```

**예제 추적:**

```java
class InitTest {
    static int cv = 1;
    int iv = 1;

    static { cv = 2; }
    { iv = 2; }

    InitTest() { iv = 3; }
}
```

```
[클래스 로딩 시 (1회)]
1) cv = 0    (기본값)
2) cv = 1    (명시적)
3) cv = 2    (클래스 초기화 블록)

[new InitTest() 시 (매번)]
4) iv = 0    (기본값)
5) iv = 1    (명시적)
6) iv = 2    (인스턴스 초기화 블록)
7) iv = 3    (생성자)

결과: cv = 2, iv = 3
```

---

## 7. 요약

| 개념 | 핵심 내용 |
|:---|:---|
| 클래스 | 객체의 설계도 |
| 객체/인스턴스 | 클래스로부터 생성된 실체 |
| 속성/기능 | 멤버변수 / 메서드로 표현 |
| 인스턴스 변수 | 각 인스턴스마다 독립된 저장공간 |
| 클래스 변수 | 모든 인스턴스가 공유 (`static`) |
| 지역 변수 | 메서드 내에서만 유효 |
| 오버로딩 | 같은 이름, 다른 매개변수 |
| 생성자 | 인스턴스 초기화 메서드 |
| `this` | 인스턴스 자신의 참조 |
| `this()` | 같은 클래스의 다른 생성자 호출 |

{{< callout type="info" >}}
**OOP 학습의 뼈대**

- 메모리 관점에서 "누가 스택에 있고 누가 힙에 있는가" 구분하기
- 값/주소 전달의 차이를 항상 의식하기
- `static` 은 클래스 소속, 일반 멤버는 인스턴스 소속임을 명확히 하기
{{< /callout >}}
