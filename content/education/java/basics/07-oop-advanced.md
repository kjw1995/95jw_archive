---
title: "Chapter 07. 객체지향 프로그래밍 II"
weight: 7
---

상속, 다형성, 추상클래스, 인터페이스, 내부 클래스 등 객체지향의 핵심 개념을 다룬다.

---

## 1. 상속 (Inheritance)

### 1.1 상속의 정의와 장점

**상속(inheritance):** 기존 클래스를 재사용하여 새로운 클래스를 작성하는 것.

```java
class Parent { int age; }
class Child extends Parent { }   // age를 상속받음
```

| 장점 | 설명 |
|:---|:---|
| 재사용성 | 기존 코드를 기반으로 새로운 클래스를 빠르게 작성 |
| 중복 제거 | 공통 부분을 조상에 두어 중복 코드 감소 |
| 유지보수 | 공통 코드의 변경이 자손에 자동 전파 |

**용어 정리**

| 용어 | 다른 표현 |
|:---|:---|
| 조상 클래스 | 부모(parent), 상위(super), 기반(base) |
| 자손 클래스 | 자식(child), 하위(sub), 파생(derived) |

### 1.2 상속의 특징

```java
class Parent     { int age; }
class Child      extends Parent { void play() {} }
class GrandChild extends Child  { void study() {} }
```

```
Parent (age)
  │
  └─ Child (age, play)
       │
       └─ GrandChild (age, play, study)
```

**핵심 규칙**

1. **생성자와 초기화 블록은 상속되지 않고, 멤버만 상속된다.**
2. **자손의 멤버 개수는 조상보다 항상 같거나 많다.**
3. **조상이 바뀌면 자손도 영향을 받지만, 반대는 아니다.**

{{< callout type="info" >}}
**`private` 멤버는 상속되는가?** 기술적으로는 자손의 인스턴스 안에 공간이 생성되지만, 자손 클래스의 코드에서 **직접 접근은 불가능**하다. 조상이 제공하는 `public`/`protected` 접근자를 통해서만 다룰 수 있다.
{{< /callout >}}

**자손 인스턴스의 메모리:** `new GrandChild()`를 호출하면 **조상의 멤버 + 자손의 멤버가 한 인스턴스에 함께** 생성된다.

### 1.3 포함 관계 (Composition)

상속 외에 클래스를 재사용하는 또 다른 방법은 **포함(has-a)**이다. 한 클래스의 멤버변수로 다른 클래스 타입의 참조를 두는 방식이다.

```java
class Point { int x, y; }

class Circle {
    Point center = new Point();   // 포함
    int r;
}
```

### 1.4 상속 vs 포함 결정하기

| 관계 | 표현 | 예시 |
|:---|:---|:---|
| 상속 (is-a) | "~은 ~이다" | `Car` is a `Vehicle` |
| 포함 (has-a) | "~은 ~을 가진다" | `Circle` has a `Point` |

```java
// 잘못된 예: "원은 점이다"는 어색함
class Circle extends Point { int r; }

// 올바른 예: "원은 중심점을 가진다"
class Circle { Point center; int r; }
```

{{< callout type="warning" >}}
**기본은 포함, 상속은 진짜 "is-a"에만.** 상속은 조상의 변경이 자손에 강하게 전파되는 결합(coupling)을 만든다. 단순히 코드를 재사용하고 싶다면 포함이 훨씬 안전하다.
{{< /callout >}}

### 1.5 단일 상속 (Single Inheritance)

Java는 클래스의 **단일 상속만 허용**한다.

```java
class Child extends Parent { }              // OK
// class Child extends P1, P2 { }           // 컴파일 에러
```

| 다중 상속 | 단일 상속 |
|:---|:---|
| 복합 기능 구현 쉬움 | 관계가 명확 |
| 이름 충돌 / 다이아몬드 문제 | 신뢰성 높음 |

다중 상속이 필요하면 **인터페이스 다중 구현** 또는 **포함**으로 해결한다.

### 1.6 `Object` — 모든 클래스의 최상위 조상

사용자가 `extends`를 명시하지 않은 모든 클래스는 컴파일 시 `extends Object`가 추가된다.

```
Object
  ├─ String
  ├─ Integer
  ├─ ArrayList
  └─ 모든 사용자 정의 클래스
```

| 메서드 | 설명 |
|:---|:---|
| `toString()` | 객체의 문자열 표현 |
| `equals(Object)` | 두 객체의 내용 비교 |
| `hashCode()` | 객체의 해시코드 |
| `getClass()` | 런타임 타입 정보 |
| `clone()` | 객체 복제 |

---

## 2. 오버라이딩 (Overriding)

### 2.1 오버라이딩이란?

조상에게 상속받은 메서드의 **내용(구현부)**을 자손에서 다시 정의하는 것이다.

```java
class Point {
    int x, y;
    String getLocation() { return "x: " + x + ", y: " + y; }
}

class Point3D extends Point {
    int z;
    @Override
    String getLocation() { return "x: " + x + ", y: " + y + ", z: " + z; }
}
```

### 2.2 오버라이딩의 조건

**필수 조건**

1. 이름이 같아야 한다
2. 매개변수가 같아야 한다
3. 반환타입이 같아야 한다 (JDK 1.5+ 공변 반환타입 허용)

**추가 규칙**

1. **접근 제어자는 조상보다 좁게 바꿀 수 없다** (`public` > `protected` > `default` > `private`)
2. **조상보다 많은 예외를 선언할 수 없다**
3. 인스턴스 메서드 ↔ `static` 메서드로는 변경 불가

```java
class Parent { protected void method() {} }
class Child extends Parent {
    @Override public void method() {}          // OK (넓어짐)
    // @Override private void method() {}      // 에러 (좁아짐)
}
```

{{< callout type="info" >}}
**공변 반환타입 (Covariant Return Type).** JDK 1.5부터 반환타입을 **자손 타입**으로 좁힐 수 있다. `Object clone()`을 자손에서 구체 타입으로 반환하도록 재정의할 때 자주 쓰인다.
{{< /callout >}}

### 2.3 오버로딩 vs 오버라이딩

| 구분 | 오버로딩 | 오버라이딩 |
|:---|:---|:---|
| 의미 | 새로운 메서드 추가 | 상속받은 메서드 재정의 |
| 이름 | 같음 | 같음 |
| 매개변수 | 다름 | 같음 |
| 반환타입 | 영향 없음 | 같거나 자손 타입 |
| 관계 | 같은 클래스 내 | 상속 관계 |

### 2.4 `super` — 조상의 멤버 참조

```java
class Point3D extends Point {
    int z;
    @Override
    String getLocation() {
        return super.getLocation() + ", z: " + z;   // 조상 메서드 호출
    }
}
```

| 참조 | 가리키는 것 | 사용 가능 위치 |
|:---|:---|:---|
| `this` | 자신(인스턴스) | 인스턴스 메서드/생성자 |
| `super` | 조상 클래스의 멤버 | 자손의 인스턴스 메서드/생성자 |

**같은 이름의 멤버가 있을 때:**

```java
class Parent { int x = 10; }
class Child extends Parent {
    int x = 20;
    void method() {
        System.out.println(x);         // 20 (자손)
        System.out.println(this.x);    // 20 (자손)
        System.out.println(super.x);   // 10 (조상)
    }
}
```

### 2.5 `super()` — 조상의 생성자 호출

- 자손 생성자의 **첫 줄**에서 `super(...)`로 조상의 생성자를 호출해야 한다
- 생략 시 컴파일러가 자동으로 `super();`를 추가한다
- `this()`와 `super()`는 동시에 쓸 수 없다 (둘 다 첫 줄 제약이므로)

```java
class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}

class Point3D extends Point {
    int z;
    Point3D(int x, int y, int z) {
        super(x, y);        // 조상 초기화
        this.z = z;         // 자손 초기화
    }
}
```

{{< callout type="info" >}}
**왜 조상 생성자가 먼저 실행되어야 할까?** 자손의 초기화 코드가 조상의 필드에 의존할 수 있는데, 조상이 초기화되지 않은 상태라면 잘못된 값을 볼 수 있기 때문이다. 모든 생성자 체인은 결국 `Object`의 생성자에서 시작한다.
{{< /callout >}}

---

## 3. package와 import

### 3.1 패키지

관련된 클래스들을 그룹화한 단위다. 이름 충돌을 막고 접근 제어의 경계를 제공한다.

```java
package com.company.project;

public class MyClass { /* ... */ }
```

- 패키지명은 소문자로, 도메인을 역순으로 (예: `com.google`)
- 소스 파일의 **첫 번째 문장**이어야 한다 (주석 제외)
- 디렉터리 구조와 일치해야 한다 (`com/company/project/MyClass.java`)

### 3.2 import문

다른 패키지의 클래스를 사용할 때 풀네임을 생략하도록 해준다.

```java
import java.util.ArrayList;
import java.util.*;                  // 패키지 전체
import static java.lang.Math.*;      // static 멤버 (JDK 1.5+)

ArrayList<String> list = new ArrayList<>();
double r = random();                 // Math.random() 대신
```

{{< callout type="info" >}}
**`java.lang`은 import 불필요.** `String`, `Object`, `System` 등은 `java.lang` 패키지에 속하며 컴파일러가 자동으로 import한다.
{{< /callout >}}

---

## 4. 제어자 (Modifier)

### 4.1 제어자의 종류

| 종류 | 제어자 |
|:---|:---|
| 접근 제어자 | `public`, `protected`, `(default)`, `private` |
| 기타 | `static`, `final`, `abstract`, `native`, `transient`, `synchronized`, `volatile`, `strictfp` |

- 하나의 대상에 여러 제어자를 조합할 수 있다
- **접근 제어자는 하나만** 사용

### 4.2 static — 클래스의, 공통의

| 대상 | 의미 |
|:---|:---|
| 멤버변수 | 모든 인스턴스가 공유하는 클래스 변수 |
| 메서드 | 인스턴스 없이 호출 가능한 클래스 메서드 |

```java
class StaticTest {
    static int cv = 0;
    int iv = 0;

    static void staticMethod() {
        // iv = 10;   // 에러 (인스턴스 없음)
        cv = 10;
    }

    void instanceMethod() {
        cv = 20;
        iv = 20;
    }
}
```

### 4.3 final — 변경 불가

| 대상 | 의미 |
|:---|:---|
| 클래스 | 상속 불가 |
| 메서드 | 오버라이딩 불가 |
| 변수 | 상수 (한 번만 할당 가능) |

```java
final class FinalClass {
    final int MAX = 100;
    final void method() { }
}
// class Sub extends FinalClass { }   // 에러

class Card {
    final int NUMBER;                  // 인스턴스 상수
    static final int MAX_CARDS = 10;   // 클래스 상수

    Card(int num) {
        NUMBER = num;   // 생성자에서 한 번 초기화 가능
    }
}
```

{{< callout type="info" >}}
**`final` 의 쓰임새**

- `final class`: `String`, `Integer`처럼 불변·보안이 필요한 타입에 사용. 상속으로 인한 계약 위반을 막는다.
- `final method`: 프레임워크에서 핵심 로직을 자손이 깨뜨리지 못하게 고정할 때 쓴다.
- `final` 필드: 생성 후 변경 불가 → 불변 객체(immutable object) 구현의 기반.
{{< /callout >}}

### 4.4 abstract — 미완성

| 대상 | 의미 |
|:---|:---|
| 클래스 | 추상 메서드를 가질 수 있음 / 인스턴스 생성 불가 |
| 메서드 | 선언부만 있고 구현부 없음 |

```java
abstract class AbstractClass {
    abstract void abstractMethod();       // 구현 없음

    void concreteMethod() {               // 일반 메서드도 가질 수 있음
        System.out.println("concrete");
    }
}

class ConcreteClass extends AbstractClass {
    @Override
    void abstractMethod() { /* ... */ }
}
```

### 4.5 접근 제어자

| 제어자 | 같은 클래스 | 같은 패키지 | 자손 클래스 | 전체 |
|:---|:---:|:---:|:---:|:---:|
| `public`    | O | O | O | O |
| `protected` | O | O | O | X |
| `(default)` | O | O | X | X |
| `private`   | O | X | X | X |

**접근 제어자 사용 지침**

| 대상 | 권장 |
|:---|:---|
| 클래스 | `public` (외부 사용) 또는 `(default)` (패키지 내부) |
| 멤버변수 | `private` + getter/setter |
| 메서드 | 외부 인터페이스는 `public`, 내부 헬퍼는 `private` |

캡슐화(Encapsulation)의 핵심은 "외부로부터 데이터를 보호하고 내부 구현을 숨기는 것"이다. `private` 필드 + `public` 접근자 패턴이 기본이 된다.

{{< callout type="warning" >}}
**`private` 생성자의 활용.** 외부에서 인스턴스 생성을 막는 용도 — 싱글톤(Singleton), 유틸리티 클래스, 정적 팩토리 메서드 패턴에 사용된다.
{{< /callout >}}

---

## 5. 다형성 (Polymorphism)

### 5.1 다형성이란?

**조상 타입 참조변수로 자손 타입 인스턴스를 가리킬 수 있는 능력**이다.

```java
class Tv { void power(){} void channelUp(){} }
class SmartTv extends Tv { void caption(){} }

Tv t = new SmartTv();   // OK
t.power();              // OK
t.channelUp();          // OK
// t.caption();         // 에러! Tv 타입엔 없음
```

```
t (Tv 타입 참조)
    │
    ▼
┌──────────────┐
│ SmartTv 인스턴스 │
│  - power()      │
│  - channelUp()  │
│  - caption()    │
└──────────────┘

실제 인스턴스엔 모든 멤버 존재
참조변수 타입이 사용 가능 범위 결정
```

### 5.2 참조변수의 형변환

- **Up-casting** (자손 → 조상): 형변환 생략 가능
- **Down-casting** (조상 → 자손): 명시 필수

```java
class Car {}
class FireEngine extends Car {}
class Ambulance   extends Car {}

FireEngine f = new FireEngine();

Car c = f;                      // Up-casting (암묵적)
FireEngine f2 = (FireEngine) c; // Down-casting (명시)

// Ambulance a = (Ambulance) f; // 에러 (형제 관계)
```

{{< callout type="warning" >}}
**`ClassCastException`.** 다운캐스팅은 컴파일은 통과해도 런타임에 실패할 수 있다. 참조변수가 **실제로 가리키는 인스턴스의 타입**이 변환 가능해야 한다.

```java
Car c = new Car();
FireEngine f = (FireEngine) c;   // 런타임 예외
```
{{< /callout >}}

### 5.3 `instanceof` 연산자

다운캐스팅 전에 실제 타입을 확인한다.

```java
void doWork(Car c) {
    if (c instanceof FireEngine f) {   // 패턴 매칭 (Java 16+)
        f.water();
    } else if (c instanceof Ambulance a) {
        a.siren();
    }
}
```

### 5.4 멤버 접근과 메서드 디스패치

**변수는 참조변수 타입, 메서드는 실제 인스턴스 타입으로 결정된다** (동적 디스패치).

```java
class Parent { int x = 100; void method() { System.out.println("Parent"); } }
class Child extends Parent {
    int x = 200;
    @Override void method() { System.out.println("Child"); }
}

Parent p = new Child();
System.out.println(p.x);   // 100 (타입 기준)
p.method();                // "Child" (런타임 타입 기준)
```

{{< callout type="info" >}}
**동적 바인딩(dynamic dispatch)이 다형성의 핵심이다.** JVM은 메서드 호출 시 객체의 실제 클래스에서 메서드 테이블을 조회해서 실행할 메서드를 결정한다. 덕분에 조상 타입으로 다뤄도 자손의 오버라이딩된 동작이 실행된다.
{{< /callout >}}

### 5.5 매개변수의 다형성

```java
class Product { int price; Product(int p){ price = p; } }
class Tv       extends Product { Tv()       { super(100); } }
class Computer extends Product { Computer() { super(200); } }

class Buyer {
    int money = 1000;
    void buy(Product p) {   // 모든 Product 자손 허용
        money -= p.price;
    }
}

Buyer b = new Buyer();
b.buy(new Tv());
b.buy(new Computer());
```

### 5.6 배열로 여러 종류의 객체 다루기

```java
Product[] products = { new Tv(), new Computer(), new Audio() };
for (Product p : products) {
    System.out.println(p.price);
}
```

---

## 6. 추상 클래스 (Abstract Class)

### 6.1 추상 클래스와 추상 메서드

- **추상 메서드:** 선언부만 있고 구현부가 없는 메서드
- **추상 클래스:** 추상 메서드를 포함하는 (또는 포함할 수 있는) 클래스. 인스턴스 생성 불가

```java
abstract class Player {
    abstract void play(int pos);
    abstract void stop();

    void pause() { System.out.println("pause"); }
}

class AudioPlayer extends Player {
    @Override void play(int pos) { /* ... */ }
    @Override void stop()        { /* ... */ }
}
```

### 6.2 추상화와 구체화

- **추상화(abstraction):** 공통점을 찾아 공통의 조상을 만드는 작업
- **구체화(realization):** 추상 클래스를 상속받아 완성하는 작업

```java
abstract class Unit {
    int x, y;
    abstract void move(int x, int y);    // 자손마다 다르게 구현
    void stop() { /* 공통 동작 */ }
}

class Marine extends Unit {
    @Override void move(int x, int y) { /* 걸어서 */ }
}
class Tank extends Unit {
    @Override void move(int x, int y) { /* 굴러서 */ }
}
```

```java
Unit[] units = { new Marine(), new Tank() };
for (Unit u : units) u.move(100, 200);   // 각자 방식으로 이동
```

---

## 7. 인터페이스 (Interface)

### 7.1 인터페이스란?

추상 메서드와 상수만 가질 수 있는 **일종의 추상 클래스**. 구현체에 대한 **규약(contract)**을 정의한다.

### 7.2 추상 클래스 vs 인터페이스

| 구분 | 추상 클래스 | 인터페이스 |
|:---|:---|:---|
| 멤버 | 모든 멤버 가능 | 추상 메서드, 상수, default/static/private 메서드 |
| 생성자 | 있음 | 없음 |
| 다중 상속 | 불가 | 가능 (다중 구현) |
| 상태(필드) | 가질 수 있음 | 상수만 |
| 용도 | 부분 구현 공유 | 타입·규약 정의 |

{{< callout type="info" >}}
**언제 인터페이스, 언제 추상 클래스?**

- **공통 구현이나 상태가 있고** 단일 상속 관계가 자연스러우면 → 추상 클래스
- **"이런 기능을 제공한다"는 계약만 정의**하고 싶으면 → 인터페이스
- **다중 타입을 한 클래스에 부여**하고 싶으면 → 인터페이스 (다중 구현)

실무에서는 인터페이스로 타입을 정의하고, 필요 시 추상 클래스로 부분 구현을 제공하는 하이브리드가 흔하다 (예: `AbstractList` + `List`).
{{< /callout >}}

### 7.3 인터페이스 작성

```java
interface PlayingCard {
    int SPADE = 4;                       // 자동으로 public static final
    String getCardNumber();              // 자동으로 public abstract
    String getCardKind();
}
```

- 멤버변수는 묵시적으로 `public static final`
- 메서드는 묵시적으로 `public abstract` (JDK 1.8부터 `default`/`static`, 1.9부터 `private` 추가)

### 7.4 인터페이스의 상속과 구현

인터페이스는 **다중 상속**이 가능하다.

```java
interface Movable   { void move(int x, int y); }
interface Attackable { void attack(Unit u); }

interface Fightable extends Movable, Attackable { }

class Fighter extends Unit implements Fightable {
    @Override public void move(int x, int y)  { /* ... */ }
    @Override public void attack(Unit u)       { /* ... */ }
}
```

**일부만 구현할 때는 추상 클래스로 선언한다.**

```java
abstract class PartialFighter implements Fightable {
    @Override public void move(int x, int y) { /* ... */ }
    // attack()은 미구현 → 이 클래스는 추상으로 유지
}
```

### 7.5 인터페이스를 이용한 다형성

```java
Fightable f = new Fighter();

void attackTwice(Fightable f) { f.attack(target); f.attack(target); }

Fightable factory() { return new Fighter(); }
```

### 7.6 인터페이스의 장점

1. 인터페이스가 먼저 정해지면 양쪽에서 **병렬 개발** 가능
2. 프로젝트의 **표준**을 강제할 수 있다
3. 서로 관계 없는 클래스들이 같은 타입을 공유 가능
4. **의존성을 줄여** 한 클래스의 변경이 다른 클래스에 번지지 않게 함

**직접 의존 → 간접 의존 (DIP):**

```java
// Before: A가 B에 직접 의존
class A { void use(B b) { b.work(); } }

// After: A는 I에 의존, B는 I를 구현
interface I { void work(); }
class B implements I { @Override public void work() { /* ... */ } }
class A { void use(I i) { i.work(); } }
```

### 7.7 default 메서드와 static 메서드 (JDK 1.8+)

**default 메서드**는 구현체 수정 없이 인터페이스에 새 메서드를 추가하기 위해 도입됐다.

```java
interface MyInterface {
    void method();

    default void newMethod() {
        System.out.println("기본 구현");
    }
}
```

**충돌 규칙**

1. 여러 인터페이스의 default 충돌 → 구현 클래스에서 오버라이딩 필수
2. default vs 조상 클래스의 일반 메서드 충돌 → **조상 클래스가 우선**

```java
interface A { default void m() { System.out.println("A"); } }
interface B { default void m() { System.out.println("B"); } }

class C implements A, B {
    @Override public void m() {
        A.super.m();   // A쪽 default 명시 호출
    }
}
```

**static 메서드**는 인터페이스 자체에 속하며 `MyInterface.method()`로 호출한다.

---

## 8. 내부 클래스 (Inner Class)

### 8.1 내부 클래스란?

클래스 안에 선언된 클래스. **외부 클래스의 멤버를 쉽게 접근**할 수 있고, 특정 목적의 타입을 외부에 노출하지 않을 수 있다.

### 8.2 종류

| 내부 클래스 | 선언 위치 | 특징 |
|:---|:---|:---|
| 인스턴스 클래스 | 멤버 위치 | 외부 인스턴스의 멤버처럼 다뤄짐 |
| 스태틱 클래스 | 멤버 위치 | `static` 멤버처럼 다뤄짐 |
| 지역 클래스 | 메서드 내부 | 선언 블록 안에서만 사용 |
| 익명 클래스 | 식 안에서 | 이름 없는 일회용 클래스 |

```java
class Outer {
    class InstanceInner { int iv = 100; }
    static class StaticInner { static int cv = 300; }

    void method() {
        class LocalInner { int iv = 400; }
    }
}
```

### 8.3 제어자와 접근성

**스태틱 클래스만 static 멤버를 가질 수 있다** (final static 상수는 인스턴스 내부 클래스에서도 허용).

```java
class Outer {
    int outerIv = 0;
    static int outerCv = 0;

    class InstanceInner {
        void m() {
            System.out.println(outerIv);   // OK
            System.out.println(outerCv);   // OK
        }
    }

    static class StaticInner {
        void m() {
            // System.out.println(outerIv);   // 에러 (인스턴스 없음)
            System.out.println(outerCv);   // OK
        }
    }
}
```

**내부 클래스 생성:**

```java
Outer outer = new Outer();
Outer.InstanceInner ii = outer.new InstanceInner();
Outer.StaticInner   si = new Outer.StaticInner();
```

### 8.4 익명 클래스 (Anonymous Class)

이름 없는 일회용 클래스. 인터페이스 구현 또는 클래스 상속을 즉석에서 한다.

```java
Runnable r = new Runnable() {
    @Override public void run() {
        System.out.println("anon");
    }
};

// 람다로 대체 (JDK 1.8+, 함수형 인터페이스만)
Runnable r2 = () -> System.out.println("lambda");
```

- 생성자를 가질 수 없다
- 단 하나의 클래스 상속 또는 단 하나의 인터페이스 구현만 가능
- 재사용 불가 (일회성)

---

## 9. 요약

| 개념 | 핵심 내용 |
|:---|:---|
| 상속 | `extends`로 조상의 멤버 재사용 |
| 포함 | 멤버로 다른 클래스 보유 (has-a) |
| 오버라이딩 | 조상 메서드의 내용 재정의 |
| `super` / `super()` | 조상 멤버 참조 / 조상 생성자 호출 |
| package / import | 클래스 그룹화 / 다른 패키지 사용 |
| `static` | 클래스 소속, 모든 인스턴스 공유 |
| `final` | 상속/오버라이딩/재할당 금지 |
| `abstract` | 미완성 — 자손이 완성 |
| 접근 제어자 | 캡슐화와 정보 은닉 |
| 다형성 | 조상 타입 참조로 자손 인스턴스 다룸 |
| 인터페이스 | 타입·규약 정의, 다중 구현 |
| 내부 클래스 | 외부 클래스와 긴밀한 타입 은닉 |

{{< callout type="info" >}}
**객체지향 4대 원칙 되짚기**

- **캡슐화:** 데이터와 행위를 묶고 외부로부터 숨긴다
- **상속:** 코드 재사용과 계층 구조
- **다형성:** 같은 타입 참조로 다양한 동작
- **추상화:** 공통점을 추출해 일반화한다 (추상 클래스/인터페이스)
{{< /callout >}}
