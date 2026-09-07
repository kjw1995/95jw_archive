---
title: "Chapter 07. 객체지향 프로그래밍 II"
date: 2026-01-26
weight: 7
---

[Chapter 06](../06-oop-basics)이 책임 단위 하나를 만드는 법이었다면, 이 장은 단위들 **사이의 관계**다. 상속, 오버라이딩, 다형성, 추상 클래스, 인터페이스, 내부 클래스가 전부 나오지만, 규칙의 대부분은 두 원리에서 나온다. 첫째, **자손은 조상의 자리에 들어갈 수 있어야 한다.** 오버라이딩에서 접근 범위를 좁힐 수 없는 것도, 예외를 늘릴 수 없는 것도, 조상 타입 변수에 자손 인스턴스를 넣을 수 있는 것도 이 원리다. 둘째, **참조 변수의 타입은 컴파일 때 정해지고 인스턴스의 타입은 실행 때 드러난다.** 같은 `p.x`와 `p.method()`가 다른 기준으로 결정되는 이유가 여기 있다. 이 둘을 붙들고 읽으면 외울 것이 절반으로 준다.

---

## 1. 상속: 조상의 것을 물려받되 조상의 자리에 설 수 있게

### 1.1 무엇을 물려받는가

```java
class Parent     { int age; }
class Child      extends Parent { void play() { } }
class GrandChild extends Child  { void study() { } }
```

```
Parent (age)
  │
  └─ Child (age, play)
       │
       └─ GrandChild (age, play, study)
```

`extends`로 조상을 지정하면 조상의 **멤버**(변수와 메서드)를 자손이 그대로 갖는다. 자손은 조상보다 멤버가 적을 수 없고, 조상을 고치면 자손 전부에 반영된다. 공통 부분을 조상 한 곳에 두고 차이만 자손에 쓰는 것이 상속의 쓸모다.

| 용어 | 다른 이름 |
|:-----|:----------|
| 조상 클래스 | 부모, 상위, 슈퍼, 기반 클래스 |
| 자손 클래스 | 자식, 하위, 서브, 파생 클래스 |

물려받지 않는 것이 둘 있다. **생성자와 초기화 블록**이다. 생성자는 6장에서 본 대로 "이 클래스의 인스턴스를 초기화하는 것"이라 이름이 클래스 이름과 같은데, 자손이 물려받으면 이름부터 맞지 않는다. 대신 자손 생성자가 조상 생성자를 **호출**한다(2.4절). `private` 멤버도 자손 코드에서 직접 접근할 수 없다. 캡슐화의 경계는 클래스이고, 자손도 그 클래스의 바깥이기 때문이다. 다만 자손 인스턴스 안에 그 공간은 있다.

```
new GrandChild()
┌───────────────────┐
│ age      (Parent) │
│ play()   (Child)  │  한 인스턴스에
│ study()  (Grand)  │  조상 멤버도 함께
└───────────────────┘
```

`new GrandChild()`는 세 인스턴스를 만드는 것이 아니다. 조상들의 멤버까지 전부 담은 **인스턴스 하나**가 힙에 만들어진다. 이 사실이 뒤에서 볼 다형성의 바탕이다. 자손 인스턴스 안에는 조상 부분이 통째로 들어 있으니, 조상 타입으로 다뤄도 아무것도 빠지지 않는다.

### 1.2 포함이 기본, 상속은 "~은 ~이다"일 때만

```java
class Point { int x, y; }

class Circle extends Point { int r; }        // 원은 점이다? 어색하다

class Circle {                               // 원은 중심점을 가진다
    Point center = new Point();
    int r;
}
```

클래스를 재사용하는 방법은 상속 말고도 있다. 다른 클래스의 인스턴스를 **멤버로 갖는** 포함이다. 둘을 고르는 기준은 문장으로 읽어 보는 것이다. "원은 점이다"는 어색하고 "원은 점을 가진다"는 자연스러우니 포함이다. "자동차는 탈것이다"는 자연스러우니 상속이다.

| 관계 | 읽는 법 | 수단 |
|:-----|:--------|:-----|
| is-a | ~은 ~이다 | 상속 |
| has-a | ~은 ~을 가진다 | 포함 |

기본값은 포함이다. 상속은 조상의 변경이 자손 전부에 퍼지는 강한 결합을 만들고, 자손이 조상의 내부 동작에 기대게 되면 조상을 고칠 때마다 자손이 깨진다. 코드를 재사용하고 싶을 뿐이라면 포함이 안전하고, 상속은 이 장의 첫 원리, 즉 **자손이 조상의 자리에 서도 되는 관계**에서만 쓴다.

### 1.3 단일 상속과 Object

```java
class Child extends Parent { }          // 된다
class Child extends P1, P2 { }          // 컴파일 오류
```

자바에서 클래스는 조상을 하나만 가질 수 있다. C++처럼 여럿을 허용하면 두 조상에 같은 이름의 변수나 메서드가 있을 때 어느 쪽을 물려받은 것인지 정할 수 없고, 두 조상이 다시 같은 조상을 공유하면 그 조상의 변수가 한 인스턴스 안에 두 벌 생기는 문제(다이아몬드 문제)가 있다. 자바는 이 복잡함을 언어에서 없앴다. 여러 타입이 필요하면 7절의 인터페이스로, 여러 기능이 필요하면 포함으로 해결한다.

조상을 적지 않은 클래스는 컴파일러가 `extends Object`를 붙인다. 그래서 모든 클래스는 `Object`의 자손이고, `toString()`, `equals()`, `hashCode()`, `getClass()`처럼 `Object`가 가진 메서드를 어떤 인스턴스에서든 쓸 수 있다. 6장에서 `println(tv)`가 이상한 문자열을 찍은 것은 `Object`의 `toString()`이 실행됐기 때문이다. 이 메서드들을 언제 어떻게 재정의하는지는 [Chapter 09](../09-java-lang-package)에서 다룬다.

---

## 2. 오버라이딩: 조상의 약속은 지키고 내용만 바꾼다

### 2.1 정의

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

물려받은 메서드의 내용을 자손에서 다시 정의하는 것이 **오버라이딩**이다. `@Override`는 없어도 동작하지만 붙이는 것이 규칙이다. 이 표시가 있으면 컴파일러가 "정말 조상에 그런 메서드가 있는가"를 검사해 준다. 메서드 이름을 한 글자 틀리면 오버라이딩이 아니라 새 메서드가 되어 조용히 다른 동작을 하는데, `@Override`가 있으면 그 자리에서 컴파일 오류다.

### 2.2 규칙은 전부 "자손이 조상 자리에 설 수 있는가"에서 나온다

| 규칙 | 이유 |
|:-----|:-----|
| 이름, 매개변수가 같아야 한다 | 그래야 같은 메서드다. 다르면 오버로딩이다 |
| 반환 타입이 같거나 자손 타입이어야 한다 | 조상 타입으로 받기로 한 호출자는 자손 타입도 받을 수 있다 |
| 접근 범위를 좁힐 수 없다 (`public` → `protected` 불가) | 조상에서 부를 수 있던 호출자가 자손에서는 못 부르게 된다 |
| 조상보다 많은 검사 예외를 선언할 수 없다 | 조상 기준으로 `catch`를 쓴 호출자가 새 예외를 처리하지 못한다 |
| `static`과 인스턴스 메서드는 서로 바꿀 수 없다 | `static` 메서드는 오버라이딩이 아니라 가려지는 것이다(5.3절) |

```java
class Parent { protected void method() { } }

class Child extends Parent {
    @Override public void method() { }       // 된다. 범위가 넓어졌다
    @Override private void method() { }      // 컴파일 오류. 범위가 좁아졌다
}
```

`Parent p = new Child()`로 자손을 조상 자리에 세운 호출자는 `Parent`의 선언만 보고 `p.method()`를 부른다. 그 호출이 실제로는 `Child`의 메서드로 가므로, `Child`가 접근을 막거나 새 예외를 던지면 호출자의 코드가 깨진다. 오버라이딩의 규칙은 전부 **조상을 보고 쓴 코드가 자손에서도 그대로 동작하게** 하려는 제약이다. 반환 타입을 자손 타입으로 좁히는 것(공변 반환, Java 5)이 허용되는 이유도 같다. 조상 타입을 기대한 호출자에게 자손 타입을 주는 것은 문제가 없다.

| 구분 | 오버로딩 | 오버라이딩 |
|:-----|:---------|:-----------|
| 뜻 | 같은 이름의 메서드를 추가한다 | 물려받은 메서드의 내용을 바꾼다 |
| 매개변수 | 달라야 한다 | 같아야 한다 |
| 반환 타입 | 관계없다 | 같거나 자손 타입 |
| 관계 | 한 클래스 안 | 조상과 자손 사이 |

### 2.3 super: 가려진 조상의 것

```java
class Parent { int x = 10; }

class Child extends Parent {
    int x = 20;
    void method() {
        x;          // 20. 가까운 자손의 x
        this.x;     // 20
        super.x;    // 10. 조상의 x
    }
}
```

```java
class Point3D extends Point {
    @Override
    String getLocation() {
        return super.getLocation() + ", z: " + z;   // 조상의 구현을 재사용하고 덧붙인다
    }
}
```

`this`가 인스턴스 자신이라면 `super`는 **그 인스턴스의 조상 부분**이다. 별개의 인스턴스가 아니라 1.1절의 한 인스턴스 안에서 조상이 정의한 멤버를 가리킨다. 자손이 같은 이름의 변수나 메서드를 정의해 조상의 것이 가려졌을 때 조상 쪽을 부르는 수단이며, 오버라이딩한 메서드에서 조상의 구현을 재사용할 때 가장 자주 쓴다.

### 2.4 super(): 조상부터 초기화한다

```java
class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}

class Point3D extends Point {
    int z;
    Point3D(int x, int y, int z) {
        super(x, y);          // 조상 부분을 먼저 초기화한다
        this.z = z;
    }
}
```

자손 생성자는 첫 문장에서 `super(...)`로 조상 생성자를 부른다. 적지 않으면 컴파일러가 `super()`를 넣어 주는데, 조상에 매개변수 없는 생성자가 없으면 여기서 컴파일 오류가 난다. 6장에서 본 "생성자를 쓰면 기본 생성자가 사라진다"가 상속과 만나는 지점이다. 사슬은 `Object`의 생성자까지 올라가므로 어떤 인스턴스든 `Object`부터 자손 순서로 초기화된다.

왜 조상이 먼저인가. 자손의 초기화가 조상의 변수에 기댈 수 있기 때문이다. 조상이 아직 초기화되지 않았는데 자손이 그 값을 읽으면 기본값을 보게 된다. 이 순서에서 실무의 함정 하나가 나온다.

```java
class Parent {
    Parent() { init(); }                 // 자손이 오버라이딩한 init()이 실행된다
    void init() { }
}

class Child extends Parent {
    int value = 10;
    @Override void init() { System.out.println(value); }   // 0이 찍힌다
}
```

조상 생성자가 오버라이딩된 메서드를 부르면, 그 메서드는 자손의 것이 실행되는데 자손의 변수는 아직 초기화 전이다. 생성자에서는 오버라이딩될 수 있는 메서드를 부르지 않는 것이 규칙인 이유다. `this()`와 `super()`는 둘 다 첫 문장이어야 하므로 한 생성자에 함께 쓸 수 없고, Java 25부터는 6장에서 본 대로 인스턴스를 참조하지 않는 문장에 한해 그 앞에 둘 수 있다.

---

## 3. 패키지와 import

```java
package com.company.project;          // 소스 파일의 첫 문장

import java.util.ArrayList;           // 클래스 하나
import java.util.*;                   // 패키지 전체
import static java.lang.Math.*;       // static 멤버. random()처럼 클래스 이름 없이

public class MyClass { }
```

패키지는 관련 클래스를 묶는 이름 공간이다. 필요한 이유는 두 가지다. 이름 충돌을 막고, 4절에서 볼 접근 제어의 경계를 만든다. 서로 다른 라이브러리가 `List`라는 이름을 각자 써도 `java.util.List`와 `java.awt.List`로 구분된다.

패키지 이름을 도메인 역순(`com.google...`)으로 짓는 관례는 전 세계 어디서도 겹치지 않는 이름을 만들기 위해서다. 패키지 구조가 디렉터리 구조와 같아야 하는 이유는 [Chapter 01](../01-java-intro)의 규칙 그대로다. 컴파일러와 클래스 로더가 `com.company.project.MyClass`를 `com/company/project/MyClass.class`라는 경로로 바꿔 찾는다. `import`는 이 긴 이름을 매번 적지 않게 해 주는 것이고, `String`, `System`이 있는 `java.lang`은 늘 쓰이므로 컴파일러가 자동으로 import한다.

---

## 4. 제어자

| 종류 | 제어자 |
|:-----|:-------|
| 접근 제어자 (하나만) | `public`, `protected`, (default), `private` |
| 그 외 | `static`, `final`, `abstract`, `synchronized`, `transient`, `volatile`, `native` |

### 4.1 static과 final

`static`은 6장에서 봤다. 인스턴스가 아니라 클래스에 속하므로 인스턴스 없이 쓸 수 있고, 그래서 `static` 메서드 안에서는 인스턴스 변수를 쓸 수 없다.

```java
final class FinalClass { }              // 상속할 수 없다
class Sub extends FinalClass { }        // 컴파일 오류

class Card {
    final int NUMBER;                   // 한 번만 넣을 수 있다
    static final int MAX = 10;          // 클래스 상수
    final void method() { }             // 오버라이딩할 수 없다

    Card(int number) { NUMBER = number; }   // final 변수는 생성자에서 초기화할 수 있다
}
```

| `final`을 붙인 곳 | 뜻 | 왜 붙이나 |
|:------------------|:---|:----------|
| 클래스 | 자손을 만들 수 없다 | `String`처럼 동작이 바뀌면 안 되는 타입. 자손이 약속을 깨는 것을 막는다 |
| 메서드 | 오버라이딩할 수 없다 | 조상의 핵심 로직을 자손이 바꾸지 못하게 |
| 변수 | 값을 바꿀 수 없다 | 상수, 그리고 만들어진 뒤 바뀌지 않는 불변 객체의 바탕 |

### 4.2 접근 제어자와 캡슐화

| 제어자 | 같은 클래스 | 같은 패키지 | 자손 클래스 | 그 외 |
|:-------|:-----------:|:-----------:|:-----------:|:-----:|
| `public` | O | O | O | O |
| `protected` | O | O | O | X |
| (default) | O | O | X | X |
| `private` | O | X | X | X |

```java
class Account {
    private int balance;                          // 바깥에서 직접 못 만진다

    public void deposit(int amount) {
        if (amount <= 0) throw new IllegalArgumentException();
        balance += amount;                        // 규칙을 거쳐야만 바뀐다
    }
    public int getBalance() { return balance; }
}
```

접근 제어자의 목적은 **캡슐화**다. 데이터를 `private`으로 숨기고 정해진 메서드로만 다루게 하면, 6장에서 말한 "규칙이 클래스 안에만 있다"가 실제로 보장된다. 잔액을 음수로 만드는 길이 코드 어디에도 없다. 부수 효과로 내부 구현을 바꾸는 것이 자유로워진다. `balance`를 `long`으로 바꾸든 다른 객체에 위임하든 메서드의 모양만 같으면 바깥은 모른다.

| 대상 | 관례 |
|:-----|:-----|
| 클래스 | 바깥에서 쓰면 `public`, 패키지 안에서만 쓰면 default |
| 변수 | `private`. 필요한 것만 getter, setter로 |
| 메서드 | 바깥에 제공하는 것만 `public`, 나머지는 `private` |

{{< callout type="info" >}}
생성자를 `private`으로 두면 바깥에서 `new`를 할 수 없다. 인스턴스를 하나만 두는 싱글톤, 인스턴스가 필요 없는 유틸리티 클래스, 그리고 `new` 대신 이름 있는 `static` 메서드로 인스턴스를 만들어 주는 정적 팩토리 메서드가 이 방법을 쓴다.
{{< /callout >}}

---

## 5. 다형성: 참조 타입은 보이는 범위, 인스턴스 타입은 실제 동작

### 5.1 조상 타입 변수에 자손 인스턴스를

```java
class Tv      { void power() { } void channelUp() { } }
class SmartTv extends Tv { void caption() { } }

Tv t = new SmartTv();   // 된다
t.power();              // 된다
t.caption();            // 컴파일 오류. Tv에는 없다
```

```
Tv t = new SmartTv();
t ──▶ ┌────────────────┐
      │ power()        │ ◀ Tv 타입으로
      │ channelUp()    │   보이는 범위
      │ caption()      │ ◀ 안 보인다
      └────────────────┘
```

이 대입이 허용되는 근거가 1.1절이다. `SmartTv` 인스턴스 안에는 `Tv`의 멤버가 전부 들어 있으므로 `Tv` 타입으로 다뤄도 빠지는 것이 없다. 반대로 `SmartTv s = new Tv()`는 안 된다. `Tv` 인스턴스에는 `caption()`이 없는데 `s.caption()`을 부를 수 있게 되기 때문이다.

참조 변수의 타입은 **그 변수로 접근할 수 있는 멤버의 범위**를 정한다. 인스턴스에 `caption()`이 있어도 `Tv` 타입 변수로는 부를 수 없다. 컴파일러는 변수의 타입만 알고, 실행 중에 무엇이 들어 있을지는 모르기 때문이다.

### 5.2 형변환과 instanceof

```java
class Car { }
class FireEngine extends Car { }
class Ambulance  extends Car { }

FireEngine f = new FireEngine();
Car c = f;                           // 업캐스팅. 자동
FireEngine f2 = (FireEngine) c;      // 다운캐스팅. 명시해야 한다

Car c2 = new Car();
FireEngine f3 = (FireEngine) c2;     // 컴파일은 되지만 실행 중 ClassCastException
Ambulance a = (Ambulance) f;         // 컴파일 오류. 형제 사이에는 관계가 없다
```

자손을 조상 타입으로 바꾸는 것은 늘 안전하니 자동이고, 조상을 자손 타입으로 바꾸는 것은 실제 인스턴스가 그 자손이 아닐 수 있으니 `(타입)`으로 "알고 있다"는 표시를 요구한다. [Chapter 03](../03-java-operator)의 기본형 형변환과 같은 논리다. 표시를 했어도 실제 인스턴스가 맞지 않으면 실행 중에 `ClassCastException`이 난다. 그래서 다운캐스팅 앞에는 `instanceof`로 확인하고, Java 16의 패턴 매칭은 확인과 변환을 한 번에 한다.

```java
void doWork(Car c) {
    if (c instanceof FireEngine f) {
        f.water();
    } else if (c instanceof Ambulance a) {
        a.siren();
    }
}
```

### 5.3 메서드는 인스턴스 타입, 변수는 참조 타입

```java
class Parent {
    int x = 100;
    void method() { System.out.println("Parent"); }
}
class Child extends Parent {
    int x = 200;
    @Override void method() { System.out.println("Child"); }
}

Parent p = new Child();
p.x;          // 100. 참조 타입 Parent의 x
p.method();   // "Child". 실제 인스턴스의 method
```

| 접근 대상 | 무엇을 기준으로 | 언제 정해지나 |
|:----------|:----------------|:--------------|
| 인스턴스 변수 | 참조 변수의 타입 | 컴파일 때 |
| 인스턴스 메서드 | 실제 인스턴스의 타입 | 실행 때 |
| `static` 멤버 | 참조 변수의 타입 | 컴파일 때 |

이것이 이 장의 두 번째 원리다. 메서드 호출은 실행 중에 인스턴스의 실제 클래스를 보고 그 클래스의 메서드를 찾는다. 이를 **동적 디스패치**라 하고, JVM은 클래스마다 메서드 표를 두어 이 조회를 빠르게 처리한다. 조상 타입으로 다뤄도 자손이 오버라이딩한 동작이 실행되는 것, 즉 다형성이 여기서 나온다.

변수는 그렇지 않다. 변수는 오버라이딩되지 않고 **가려질** 뿐이며, 어느 변수인지는 컴파일러가 참조 타입을 보고 정한다. 자손에서 조상과 같은 이름의 변수를 선언하면 인스턴스 안에 변수가 두 개 생기고, `p.x`는 `Parent` 타입이 아는 쪽을 가리킨다. `static` 메서드도 같은 이유로 다형성이 없다. 인스턴스 없이 불리는 메서드에 인스턴스의 실제 타입을 물을 수 없으니, 참조 타입으로 컴파일 때 정해진다. 2.2절에서 `static` 메서드는 오버라이딩이 아니라 가려진다고 한 것이 이 뜻이다.

### 5.4 매개변수와 배열에서의 다형성

```java
class Product { int price; Product(int price) { this.price = price; } }
class Tv       extends Product { Tv()       { super(100); } }
class Computer extends Product { Computer() { super(200); } }

class Buyer {
    int money = 1000;
    void buy(Product p) { money -= p.price; }   // Product의 어떤 자손이든 받는다
}

Buyer b = new Buyer();
b.buy(new Tv());
b.buy(new Computer());

Product[] cart = { new Tv(), new Computer() };  // 서로 다른 자손을 한 배열에
for (Product p : cart) System.out.println(p.price);
```

다형성이 실제로 힘을 쓰는 자리다. `buy(Product p)` 하나로 앞으로 만들어질 모든 상품을 받을 수 있고, 상품 종류가 늘어도 `Buyer`는 바뀌지 않는다. [Chapter 04](../04-control-statements)에서 "타입으로 분기하는 `switch`를 보면 다형성을 떠올리라"고 한 것이 이 구조다. 종류별 동작은 각 자손의 메서드에 두고, 호출하는 쪽은 조상 타입으로 부르기만 하면 실행 때 알아서 갈라진다. [Chapter 05](../05-array)에서 본 배열의 공변성도 같은 원리 위에 있다.

---

## 6. 추상 클래스: 미완성이라 스스로는 못 만든다

```java
abstract class Unit {
    int x, y;
    abstract void move(int x, int y);      // 선언만. 자손마다 다르다
    void stop() { /* 공통 동작 */ }        // 구현이 있는 메서드도 가질 수 있다
}

class Marine extends Unit {
    @Override void move(int x, int y) { /* 걸어서 */ }
}
class Tank extends Unit {
    @Override void move(int x, int y) { /* 굴러서 */ }
}

Unit[] units = { new Marine(), new Tank() };
for (Unit u : units) u.move(100, 200);       // 각자의 방식으로

new Unit();                                  // 컴파일 오류
```

몸통이 없는 메서드를 **추상 메서드**, 그것을 하나라도 가진 클래스를 **추상 클래스**라 한다. 추상 클래스로 인스턴스를 만들 수 없는 이유는 단순하다. `move()`를 불렀을 때 실행할 것이 없다. 자손이 모든 추상 메서드를 구현해야 비로소 인스턴스를 만들 수 있고, 일부만 구현한 자손은 여전히 추상 클래스다.

쓸모는 "공통 부분은 조상에, 다른 부분은 자손에"를 강제하는 데 있다. 모든 유닛이 멈추는 방법은 같으니 `stop()`은 조상에 구현하고, 움직이는 방법은 유닛마다 다르니 `move()`는 이름만 정해 두고 자손에게 맡긴다. 자손이 `move()`를 빠뜨리면 컴파일이 실패하므로, 조상은 "모든 유닛은 움직일 수 있다"를 믿고 코드를 쓸 수 있다. 여러 클래스의 공통점을 뽑아 조상을 만드는 작업을 **추상화**, 그것을 상속받아 채우는 작업을 **구체화**라 한다. 추상 클래스에도 생성자는 있다. 자손 생성자가 `super()`로 부르며, 조상 부분의 변수를 초기화하는 데 쓴다.

---

## 7. 인터페이스: 구현 없이 약속만

### 7.1 왜 클래스와 별도의 것이 필요한가

```java
interface PlayingCard {
    int SPADE = 4;                  // 자동으로 public static final
    String getCardNumber();         // 자동으로 public abstract
    String getCardKind();
}
```

인터페이스는 추상 메서드와 상수만 가진, 구현이 없는 타입이다. 추상 클래스와 무엇이 다른가. 결정적으로 **상태(인스턴스 변수)가 없다.** 1.3절에서 다중 상속을 막은 이유가 상태의 충돌이었는데, 상태가 없는 인터페이스는 여러 개를 구현해도 충돌할 것이 없다. 그래서 클래스는 조상이 하나지만 인터페이스는 몇 개든 구현할 수 있다.

멤버의 제어자가 자동으로 붙는 이유도 이 성격에서 온다. 인터페이스는 바깥에 내놓는 약속이므로 메서드는 당연히 `public`이고, 구현이 없으니 `abstract`다. 변수는 인스턴스가 없으니 `static`이어야 하고, 약속의 일부이니 바뀌면 안 되므로 `final`이다.

### 7.2 상속과 구현

```java
interface Movable    { void move(int x, int y); }
interface Attackable { void attack(Unit u); }
interface Fightable extends Movable, Attackable { }    // 인터페이스끼리는 다중 상속

class Fighter extends Unit implements Fightable {       // 클래스 하나를 상속하고
    @Override public void move(int x, int y) { }        // 인터페이스를 구현한다
    @Override public void attack(Unit u) { }            // public을 빼면 범위가 좁아져 오류
}

abstract class PartialFighter implements Fightable {    // 일부만 구현하면 추상 클래스
    @Override public void move(int x, int y) { }
}
```

`implements`는 "이 약속을 지키겠다"는 선언이고, 약속한 메서드를 전부 구현해야 인스턴스를 만들 수 있다. 구현 메서드에 `public`을 빼먹으면 오류가 나는 이유는 2.2절이다. 인터페이스의 메서드는 `public`인데 구현에서 범위를 좁힐 수 없다.

### 7.3 인터페이스가 만드는 다형성

```java
Fightable f = new Fighter();                 // 인터페이스 타입 변수에

void attackTwice(Fightable f) {              // 인터페이스 타입 매개변수에
    f.attack(target);
    f.attack(target);
}

Fightable create() { return new Fighter(); } // 인터페이스 타입 반환에
```

인터페이스도 타입이다. 5절의 다형성이 그대로 적용되어, `Fightable` 타입 변수는 `Fightable`을 구현한 어떤 인스턴스든 가리킬 수 있다. 클래스 상속과 다른 점은 관계가 없는 클래스들에도 같은 타입을 줄 수 있다는 것이다. `Fighter`와 전혀 다른 계층의 `Robot`이 `Fightable`을 구현하면 `attackTwice()`는 둘 다 받는다.

```java
class A { void use(B b) { b.work(); } }                      // A가 B에 직접 의존

interface Worker { void work(); }
class B implements Worker { @Override public void work() { } }
class A { void use(Worker w) { w.work(); } }                 // A는 약속에만 의존
```

이 성질이 인터페이스의 진짜 쓸모다. `A`가 `B`를 직접 쓰면 `B`가 바뀔 때 `A`도 바뀐다. `A`가 `Worker`라는 약속만 알면 `B`를 `C`로 갈아 끼워도 `A`는 그대로다. 약속이 먼저 정해지면 `A`와 `B`를 서로 다른 사람이 동시에 만들 수도 있다. 큰 프로그램에서 인터페이스가 클래스보다 먼저 설계되는 이유가 이것이다.

### 7.4 default 메서드: 약속을 나중에 늘리기

```java
interface MyInterface {
    void method();
    default void newMethod() { System.out.println("기본 구현"); }   // Java 8
    static void util() { }                                        // 인터페이스 이름으로 호출
}
```

인터페이스에 메서드를 추가하면 그것을 구현한 모든 클래스가 깨진다. 약속이 늘었는데 지키지 않은 셈이 되기 때문이다. Java 8에서 컬렉션 인터페이스에 `forEach()` 같은 메서드를 넣으려 했을 때 이 문제에 부딪혔고, 그 답이 **구현을 가진 인터페이스 메서드**인 `default` 메서드다. 기본 구현이 있으니 기존 구현 클래스는 고치지 않아도 되고, 필요한 클래스만 오버라이딩한다.

구현이 생기자 1.3절의 다이아몬드 문제가 인터페이스에도 돌아왔다. 자바는 규칙 두 개로 정리했다.

```java
interface A { default void m() { System.out.println("A"); } }
interface B { default void m() { System.out.println("B"); } }

class C implements A, B {
    @Override public void m() { A.super.m(); }   // 둘이 충돌하면 직접 정해야 한다
}
```

| 충돌 | 규칙 | 이유 |
|:-----|:-----|:-----|
| 조상 클래스의 메서드와 `default` 메서드 | 클래스가 이긴다 | 클래스의 구현이 더 구체적인 약속이다 |
| 두 인터페이스의 `default` 메서드 | 구현 클래스가 오버라이딩해야 한다 | 어느 쪽인지 컴파일러가 정할 수 없다 |

### 7.5 추상 클래스와 인터페이스 고르기

| 구분 | 추상 클래스 | 인터페이스 |
|:-----|:------------|:-----------|
| 상태(인스턴스 변수) | 가질 수 있다 | 없다. 상수만 |
| 생성자 | 있다 | 없다 |
| 구현 | 자유롭게 | `default`, `static`, `private` 메서드만 |
| 개수 | 하나만 상속 | 여러 개 구현 |
| 뜻 | "~의 일종이다" | "~할 수 있다" |

공통 상태와 구현을 나눠 갖는 가족 관계면 추상 클래스, 관계없는 것들에게 같은 능력을 약속하면 인터페이스다. 실무에서는 둘을 겹쳐 쓴다. `List`가 약속을 정하고 `AbstractList`가 공통 구현을 제공하며 `ArrayList`가 나머지를 채우는 식이다.

{{< callout type="info" >}}
Java 17부터는 `sealed interface Shape permits Circle, Square`처럼 구현할 수 있는 클래스를 **미리 열거**할 수 있다. 약속을 지키는 쪽이 정해져 있으면 [Chapter 04](../04-control-statements)의 `switch`가 모든 경우를 다뤘는지 컴파일러가 검사할 수 있다. 인터페이스가 "누구든 구현하라"에서 "이들만 구현한다"로도 쓰이게 된 것이다.
{{< /callout >}}

---

## 8. 내부 클래스

### 8.1 네 종류

```java
class Outer {
    class InstanceInner { }          // 인스턴스 내부 클래스
    static class StaticInner { }     // 정적 내부 클래스

    void method() {
        class LocalInner { }         // 지역 클래스. 이 메서드 안에서만
    }
}

Outer outer = new Outer();
Outer.InstanceInner ii = outer.new InstanceInner();   // 바깥 인스턴스가 있어야 만든다
Outer.StaticInner   si = new Outer.StaticInner();     // 바깥 인스턴스 없이 만든다
```

| 종류 | 선언 위치 | 바깥 인스턴스 | 언제 쓰나 |
|:-----|:----------|:--------------|:----------|
| 인스턴스 내부 클래스 | 멤버 자리 | 필요하다 | 바깥 인스턴스의 상태를 직접 다루는 부품 |
| 정적 내부 클래스 | 멤버 자리, `static` | 필요 없다 | 바깥과 이름만 묶고 싶은 독립적인 클래스 |
| 지역 클래스 | 메서드 안 | 필요하다 | 그 메서드 안에서만 쓰는 타입 |
| 익명 클래스 | 식 안 | 상황에 따라 | 한 번 쓰고 버리는 구현 |

클래스 안에 클래스를 두는 이유는 둘이다. 바깥 클래스의 `private` 멤버까지 접근할 수 있어 긴밀한 부품을 만들기 좋고, 바깥에 노출할 필요가 없는 타입을 숨길 수 있다.

### 8.2 숨겨진 바깥 참조

```
Outer 인스턴스 ◀─ Outer.this ─ Inner
(인스턴스 내부 클래스는
 바깥 인스턴스를 숨겨 갖는다)
```

```java
class Outer {
    int iv = 0;
    static int cv = 0;

    class InstanceInner {
        void m() { iv++; cv++; }         // 둘 다 된다
    }
    static class StaticInner {
        void m() { cv++; iv++; }         // iv는 컴파일 오류. 어느 인스턴스의 iv인가
    }
}
```

인스턴스 내부 클래스가 바깥의 인스턴스 변수를 쓸 수 있는 이유는 컴파일러가 **바깥 인스턴스의 참조를 숨겨 넣어 주기** 때문이다. `outer.new InstanceInner()`에서 `outer`가 그 참조이고, 안에서 `Outer.this`로 꺼낼 수 있다. 정적 내부 클래스에는 그 참조가 없으니 바깥의 인스턴스 변수를 쓸 수 없다. 6장에서 `static` 메서드에 `this`가 없는 것과 같은 이유다.

이 숨겨진 참조에는 대가가 있다. 내부 클래스 인스턴스가 살아 있는 동안 바깥 인스턴스도 회수되지 않는다. 바깥 인스턴스가 필요 없는 내부 클래스는 `static`으로 선언하는 것이 규칙인 이유다. Java 16부터는 인스턴스 내부 클래스도 `static` 멤버를 선언할 수 있다. 그 전에는 상수를 제외한 `static` 멤버가 금지되어 있었다.

### 8.3 익명 클래스와 캡처

```java
Runnable r = new Runnable() {            // 인터페이스를 구현한 이름 없는 클래스의 인스턴스
    @Override public void run() { System.out.println("anon"); }
};

Runnable r2 = () -> System.out.println("lambda");   // 메서드가 하나면 람다로 (14장)
```

```java
void method() {
    int count = 10;                      // 사실상 final이어야 한다
    Runnable r = () -> System.out.println(count);
    count++;                             // 이 줄이 있으면 위 줄이 컴파일 오류
}
```

익명 클래스는 선언과 인스턴스 생성을 한 번에 하는 일회용 클래스다. 이름이 없으니 생성자를 쓸 수 없고 한 번만 만들 수 있으며, 클래스 하나를 상속하거나 인터페이스 하나를 구현하는 것만 된다. 메서드가 하나뿐인 인터페이스라면 [Chapter 14](../14-lambda-stream)의 람다가 같은 일을 훨씬 짧게 한다.

지역 클래스와 익명 클래스, 람다가 메서드의 지역 변수를 쓸 때는 그 변수가 **바뀌지 않아야** 한다는 조건이 붙는다. 지역 변수는 6장에서 본 대로 메서드가 끝나면 프레임과 함께 사라지는데, 내부 클래스의 인스턴스는 그보다 오래 살 수 있다. 그래서 컴파일러는 변수의 값을 인스턴스 안에 **복사**해 둔다. 복사한 뒤에 원본이 바뀌면 둘이 어긋나므로, 애초에 바뀌지 않는 변수만 허용한다.

---

## 9. 요약

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 상속 | 멤버를 물려받는다. 생성자는 아니다 | 생성자는 그 클래스의 이름을 가진 초기화 코드다 |
| 자손 인스턴스 | 조상 멤버까지 담은 인스턴스 하나 | 조상 타입으로 다뤄도 빠지는 것이 없다 |
| 포함 우선 | is-a일 때만 상속 | 상속은 조상의 변경이 자손에 퍼지는 강한 결합이다 |
| 단일 상속 | 조상은 하나 | 상태가 충돌하는 다이아몬드 문제를 없앴다 |
| 오버라이딩 규칙 | 범위를 좁히거나 예외를 늘릴 수 없다 | 조상을 보고 쓴 코드가 자손에서도 동작해야 한다 |
| `super()` | 조상부터 초기화 | 자손의 초기화가 조상의 값에 기댄다 |
| 캡슐화 | `private` 변수, 정해진 메서드로만 | 규칙을 우회할 길을 없앤다 |
| 다형성 | 조상 타입 변수에 자손 인스턴스 | 인스턴스 안에 조상 부분이 있다 |
| 메서드와 변수 | 메서드는 인스턴스 타입, 변수는 참조 타입 | 메서드만 실행 때 동적으로 찾는다 |
| 추상 클래스 | 미완성. 인스턴스 불가 | 실행할 몸통이 없다 |
| 인터페이스 | 상태 없는 약속. 다중 구현 | 상태가 없어 충돌할 것이 없다 |
| `default` 메서드 | 구현 있는 인터페이스 메서드 | 기존 구현을 깨지 않고 약속을 늘린다 |
| 내부 클래스 | 바깥 참조를 숨겨 갖는다 | 정적이 아니면 바깥 인스턴스 없이 못 만든다 |
| 캡처 | 지역 변수는 사실상 final | 프레임보다 오래 사는 인스턴스에 값을 복사한다 |
