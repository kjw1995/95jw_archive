---
title: "Chapter 07. 객체지향 프로그래밍 II"
weight: 7
---

# 객체지향 프로그래밍 II

상속, 다형성, 추상클래스, 인터페이스 등 객체지향 프로그래밍의 고급 개념을 다룬다.

---

## 1. 상속 (Inheritance)

### 1.1 상속의 정의와 장점

**상속(inheritance):** 기존의 클래스를 재사용하여 새로운 클래스를 작성하는 것

```java
class Parent {
    int age;
}

class Child extends Parent {
    // age를 상속받음
}
```

**상속의 장점**

1. **코드의 재사용성 증가**
   - 기존 코드를 재사용하여 새로운 클래스를 빠르게 작성
2. **코드의 중복 제거**
   - 공통 부분을 조상 클래스에 작성하여 중복 제거
3. **유지보수 용이**
   - 공통 코드의 변경 시 조상 클래스만 수정하면 됨
4. **프로그램 생산성 향상**
   - 적은 코드로 더 많은 기능 구현 가능

**상속 관련 용어**

| 용어 | 다른 표현 |
|:-----|:---------|
| **조상 클래스** | 부모(parent), 상위(super), 기반(base) 클래스 |
| **자손 클래스** | 자식(child), 하위(sub), 파생(derived) 클래스 |

---

### 1.2 상속의 특징

```java
class Parent {
    int age;
}

class Child extends Parent {
    void play() {
        System.out.println("놀기");
    }
}

class GrandChild extends Child {
    void study() {
        System.out.println("공부하기");
    }
}
```

**상속 계층 구조:**

```
Parent (age)
  │
  └─ Child (age, play)
       │
       └─ GrandChild (age, play, study)
```

**중요 원칙:**

1. **생성자와 초기화 블럭은 상속되지 않는다. 멤버만 상속된다.**
2. **자손 클래스의 멤버 개수는 조상 클래스보다 항상 같거나 많다.**
3. **조상 클래스 변경 시 자손 클래스는 자동으로 영향을 받지만, 반대는 아니다.**

{{< callout type="info" >}}
**접근 제어자와 상속:**
`private` 또는 `default` 멤버들은 상속은 받지만 자손 클래스에서의 **접근이 제한**된다.
{{< /callout >}}

**인스턴스 생성 시 메모리 구조:**

```java
GrandChild gc = new GrandChild();
```

자손 클래스의 인스턴스를 생성하면 **조상 클래스의 멤버와 자손 클래스의 멤버가 합쳐진 하나의 인스턴스**로 생성된다.

---

### 1.3 클래스간의 관계 - 포함관계

상속 외에 클래스를 재사용하는 방법: **포함(Composite) 관계**

**포함관계:** 한 클래스의 멤버변수로 다른 클래스 타입의 참조변수를 선언하는 것

```java
// 상속 없이 중복 코드
class Circle {
    int x;      // 원점의 x좌표
    int y;      // 원점의 y좌표
    int r;      // 반지름
}

// 포함관계 사용
class Point {
    int x;
    int y;
}

class Circle {
    Point center = new Point();  // 포함관계
    int r;
}

// 사용
Circle c = new Circle();
c.center.x = 10;
c.center.y = 20;
c.r = 5;
```

**장점:**
- 코드 재사용
- 클래스 간의 관계가 명확
- 단위별로 코드 작성 가능

---

### 1.4 클래스간의 관계 결정하기

**상속 vs 포함 결정 방법:**

| 관계 | 표현 | 예시 |
|:-----|:-----|:-----|
| **상속 (is-a)** | ~은 ~이다 | Circle **is a** Point (X) |
| **포함 (has-a)** | ~은 ~을 가지고 있다 | Circle **has a** Point (O) |

```java
// 잘못된 예: 원은 점이다? (X)
class Circle extends Point {
    int r;
}

// 올바른 예: 원은 점을 가지고 있다 (O)
class Circle {
    Point center = new Point();
    int r;
}

// 상속이 맞는 예: 자동차는 차이다 (O)
class Vehicle {
    String name;
    void move() { }
}

class Car extends Vehicle {
    int wheels = 4;
}
```

{{< callout type="warning" >}}
**원칙:** 대부분의 경우 **포함관계**가 적합하다. 상속은 진정한 "is-a" 관계일 때만 사용하자.
{{< /callout >}}

---

### 1.5 단일 상속 (Single Inheritance)

Java는 **단일 상속만 허용**한다. (C++은 다중상속 허용)

```java
// 가능
class Child extends Parent { }

// 불가능 (컴파일 에러)
class Child extends Parent1, Parent2 { }  // 에러!
```

**단일 상속의 이유:**

| 다중상속 | 단일상속 |
|:--------|:--------|
| 복합적인 기능 구현 용이 | 클래스 관계가 명확 |
| 클래스 관계 복잡 | 신뢰성 높은 코드 |
| 멤버 이름 충돌 가능 | 유지보수 용이 |

**다중상속이 필요한 경우 해결법:**
- 인터페이스를 사용 (7장 후반부 참조)
- 포함관계 활용

```java
// 다중상속 대신 포함관계 사용
class Tv {
    void power() { }
    void channelUp() { }
}

class VCR {
    void play() { }
    void stop() { }
}

class TvWithVCR extends Tv {
    VCR vcr = new VCR();  // 포함관계

    void play() {
        vcr.play();
    }
    void stop() {
        vcr.stop();
    }
}
```

---

### 1.6 Object 클래스 - 모든 클래스의 조상

**Object 클래스는 모든 클래스의 최상위 조상이다.**

```java
// 작성한 코드
class MyClass {
    // ...
}

// 컴파일러가 자동으로 변환
class MyClass extends Object {
    // ...
}
```

**상속 계층도:**

```
Object
  │
  ├─ String
  ├─ Integer
  ├─ ArrayList
  └─ 모든 사용자 정의 클래스
```

**Object 클래스의 주요 메서드:**

| 메서드 | 설명 |
|:-------|:-----|
| `toString()` | 객체의 문자열 표현 반환 |
| `equals(Object obj)` | 두 객체의 내용 비교 |
| `hashCode()` | 객체의 해시코드 반환 |
| `getClass()` | 객체의 클래스 정보 반환 |
| `clone()` | 객체를 복제하여 반환 |

---

## 2. 오버라이딩 (Overriding)

### 2.1 오버라이딩이란?

**오버라이딩(overriding):** 조상 클래스로부터 상속받은 메서드의 내용을 변경하는 것

```java
class Point {
    int x, y;

    String getLocation() {
        return "x: " + x + ", y: " + y;
    }
}

class Point3D extends Point {
    int z;

    // 오버라이딩: 조상의 메서드를 재정의
    String getLocation() {
        return "x: " + x + ", y: " + y + ", z: " + z;
    }
}
```

---

### 2.2 오버라이딩의 조건

조상 클래스의 메서드와 **선언부가 일치**해야 한다.

**필수 조건:**

1. **이름이 같아야 한다.**
2. **매개변수가 같아야 한다.**
3. **반환타입이 같아야 한다.**

**추가 규칙:**

1. **접근 제어자는 조상 클래스의 메서드보다 좁은 범위로 변경할 수 없다.**
   - 접근 범위: `public` > `protected` > `(default)` > `private`

```java
class Parent {
    protected void method() { }
}

class Child extends Parent {
    // OK
    public void method() { }

    // 에러! 접근 범위가 좁아짐
    // private void method() { }
}
```

2. **조상 클래스의 메서드보다 많은 수의 예외를 선언할 수 없다.**

```java
class Parent {
    void method() throws IOException { }
}

class Child extends Parent {
    // OK: 같거나 적은 예외
    void method() throws IOException { }
    void method() { }  // 예외 없음도 가능

    // 에러! Exception은 IOException의 조상
    // void method() throws Exception { }
}
```

3. **인스턴스 메서드를 static 메서드로 또는 그 반대로 변경할 수 없다.**

{{< callout type="info" >}}
**공변 반환타입 (Covariant Return Type):**
JDK 1.5부터 오버라이딩 시 반환타입을 **자손 클래스의 타입**으로 변경 가능
```java
class Parent {
    Parent method() { return this; }
}
class Child extends Parent {
    Child method() { return this; }  // OK (JDK 1.5+)
}
```
{{< /callout >}}

---

### 2.3 오버로딩 vs 오버라이딩

| 구분 | 오버로딩 (Overloading) | 오버라이딩 (Overriding) |
|:-----|:---------------------|:----------------------|
| **의미** | 기존에 없는 새로운 메서드 정의 | 상속받은 메서드의 내용 변경 |
| **영문** | new | change, modify |
| **조건** | 같은 이름, 다른 매개변수 | 선언부 일치 (이름, 매개변수, 반환타입) |
| **발생 시점** | 같은 클래스 내 | 상속 관계 |

```java
class Parent {
    void parentMethod() { }
}

class Child extends Parent {
    // 오버라이딩: 조상의 메서드를 재정의
    void parentMethod() { }

    // 오버로딩: 새로운 메서드 추가
    void parentMethod(int x) { }
}
```

---

### 2.4 super - 조상의 멤버 참조

**`super`:** 자손 클래스에서 조상 클래스로부터 상속받은 멤버를 참조하는데 사용되는 참조변수

```java
class Point {
    int x, y;

    String getLocation() {
        return "x: " + x + ", y: " + y;
    }
}

class Point3D extends Point {
    int z;

    String getLocation() {
        // 조상의 메서드 호출 후 추가 작업
        return super.getLocation() + ", z: " + z;
    }
}
```

**super vs this:**

| 참조변수 | 의미 | 사용 가능 위치 |
|:--------|:-----|:-------------|
| `this` | 자신(인스턴스)을 가리킴 | 인스턴스 메서드 |
| `super` | 조상 클래스의 멤버를 가리킴 | 자손 클래스의 인스턴스 메서드 |

**조상과 자손에 같은 이름의 멤버가 있을 때:**

```java
class Parent {
    int x = 10;
}

class Child extends Parent {
    int x = 20;

    void method() {
        System.out.println("x = " + x);          // 20 (자손의 x)
        System.out.println("this.x = " + this.x);  // 20 (자손의 x)
        System.out.println("super.x = " + super.x); // 10 (조상의 x)
    }
}
```

{{< callout type="warning" >}}
**static 메서드에서는 사용 불가:**
`super`와 `this`는 인스턴스 메서드에서만 사용 가능하다.
{{< /callout >}}

---

### 2.5 super() - 조상의 생성자

**`super()`:** 조상 클래스의 생성자를 호출하는데 사용

```java
class Point {
    int x, y;

    Point(int x, int y) {
        this.x = x;
        this.y = y;
    }
}

class Point3D extends Point {
    int z;

    Point3D(int x, int y, int z) {
        super(x, y);  // 조상의 생성자 호출
        this.z = z;
    }
}
```

**중요 규칙:**

1. **생성자의 첫 줄에서 조상 클래스의 생성자를 호출해야 한다.**
2. **생성자의 첫 줄에 `this()` 또는 `super()`를 명시하지 않으면 컴파일러가 자동으로 `super();`를 추가**

```java
class Point3D extends Point {
    int z;

    Point3D() {
        // 컴파일러가 자동으로 추가: super();
        // 하지만 Point()가 없으면 에러!
    }
}
```

**인스턴스 생성 과정:**

```java
Point3D p = new Point3D(1, 2, 3);
```

1. `Point3D` 생성자 호출
2. `Point3D` 생성자의 첫 줄에서 `super(x, y)` 호출
3. `Point` 생성자 실행 (조상의 멤버 초기화)
4. `Point3D` 생성자의 나머지 실행 (자손의 멤버 초기화)

{{< callout type="info" >}}
**Object 클래스를 제외한 모든 클래스의 생성자는 첫 줄에 반드시 자신의 다른 생성자 또는 조상의 생성자를 호출해야 한다.**
{{< /callout >}}

---

## 3. package와 import

### 3.1 패키지 (package)

**패키지(package):** 서로 관련된 클래스들을 그룹 단위로 묶어 놓은 것

**패키지의 역할:**
1. 클래스를 체계적으로 관리
2. 클래스 이름의 충돌 방지
3. 접근 제어

```java
package com.company.project;

public class MyClass {
    // ...
}
```

**패키지 선언 규칙:**
- 패키지명은 소문자로 작성
- 도메인을 역순으로 사용 (예: `com.google`, `org.apache`)
- 소스파일의 첫 번째 문장 (주석 제외)

**패키지와 디렉터리:**

```
com/company/project/MyClass.java
```

---

### 3.2 import문

**import문:** 다른 패키지의 클래스를 사용하기 위해 패키지명을 생략할 수 있게 해주는 것

```java
// import 없이 사용
java.util.ArrayList list = new java.util.ArrayList();

// import 사용
import java.util.ArrayList;
ArrayList list = new ArrayList();

// 패키지의 모든 클래스 import
import java.util.*;
```

**import문의 선언 위치:**
- package문과 클래스 선언 사이

**static import문:**
- static 멤버를 호출할 때 클래스 이름 생략 가능 (JDK 1.5+)

```java
import static java.lang.Math.*;

// Math.random() → random()
double value = random();
```

---

## 4. 제어자 (Modifier)

### 4.1 제어자란?

**제어자(modifier):** 클래스, 변수, 메서드의 선언부에 사용되어 부가적인 의미를 부여하는 키워드

**제어자의 종류:**

| 종류 | 제어자 |
|:-----|:-------|
| **접근 제어자** | `public`, `protected`, `(default)`, `private` |
| **기타 제어자** | `static`, `final`, `abstract`, `native`, `transient`, `synchronized`, `volatile`, `strictfp` |

**사용 규칙:**
- 하나의 대상에 여러 제어자 조합 가능
- 접근 제어자는 **하나만** 사용 가능

```java
public static final int MAX_VALUE = 100;
```

---

### 4.2 static - 클래스의, 공통적인

| 대상 | 의미 |
|:-----|:-----|
| **멤버변수** | 모든 인스턴스가 공유하는 클래스 변수 |
| **메서드** | 인스턴스 생성 없이 호출 가능한 클래스 메서드 |

```java
class StaticTest {
    static int cv = 0;     // 클래스 변수
    int iv = 0;            // 인스턴스 변수

    static void staticMethod() {   // 클래스 메서드
        // static 메서드에서는 인스턴스 멤버 직접 사용 불가
        // iv = 10;  // 에러!
        cv = 10;     // OK
    }

    void instanceMethod() {  // 인스턴스 메서드
        cv = 20;    // OK
        iv = 20;    // OK
    }
}
```

---

### 4.3 final - 마지막의, 변경될 수 없는

| 대상 | 의미 |
|:-----|:-----|
| **클래스** | 확장(상속)될 수 없는 클래스 |
| **메서드** | 오버라이딩될 수 없는 메서드 |
| **변수** | 값을 변경할 수 없는 상수 |

```java
final class FinalClass {  // 상속 불가
    final int MAX = 100;  // 상수

    final void method() {  // 오버라이딩 불가
        // MAX = 200;  // 에러! 상수는 변경 불가
    }
}

// class Child extends FinalClass { }  // 에러!
```

**final 변수 초기화:**

```java
class Card {
    final int NUMBER;          // 인스턴스 상수
    final String KIND;
    static final int MAX = 10; // 클래스 상수

    Card(String kind, int num) {
        KIND = kind;    // 생성자에서 단 한 번만 초기화 가능
        NUMBER = num;
    }
}
```

---

### 4.4 abstract - 추상의, 미완성의

| 대상 | 의미 |
|:-----|:-----|
| **클래스** | 추상 메서드를 포함하는 클래스 (인스턴스 생성 불가) |
| **메서드** | 선언부만 있고 구현부가 없는 메서드 |

```java
abstract class AbstractClass {
    abstract void abstractMethod();  // 추상 메서드

    void concreteMethod() {  // 일반 메서드
        System.out.println("구현된 메서드");
    }
}

// AbstractClass ac = new AbstractClass();  // 에러! 추상 클래스는 인스턴스 생성 불가

class ConcreteClass extends AbstractClass {
    void abstractMethod() {  // 추상 메서드 구현
        System.out.println("추상 메서드 구현");
    }
}
```

---

### 4.5 접근 제어자 (Access Modifier)

**접근 제어자:** 멤버 또는 클래스에 사용되어 외부에서의 접근을 제한하는 제어자

| 제어자 | 같은 클래스 | 같은 패키지 | 자손 클래스 | 전체 |
|:------|:--------:|:--------:|:--------:|:---:|
| `public` | O | O | O | O |
| `protected` | O | O | O | X |
| `(default)` | O | O | X | X |
| `private` | O | X | X | X |

**접근 범위:** `public` > `protected` > `(default)` > `private`

```java
public class AccessTest {
    public int pub = 1;        // 어디서나 접근 가능
    protected int pro = 2;     // 같은 패키지 + 자손 클래스
    int def = 3;               // 같은 패키지
    private int pri = 4;       // 같은 클래스

    public void publicMethod() { }
    protected void protectedMethod() { }
    void defaultMethod() { }
    private void privateMethod() { }
}
```

**접근 제어자 사용 이유:**

1. **캡슐화 (Encapsulation)**
   - 외부로부터 데이터 보호
   - 내부 구현의 은닉

```java
public class Time {
    private int hour;

    public int getHour() {
        return hour;
    }

    public void setHour(int hour) {
        if (hour < 0 || hour > 23) return;
        this.hour = hour;
    }
}
```

**접근 제어자 사용 지침:**

| 대상 | 권장 제어자 |
|:-----|:----------|
| **클래스** | `public` (외부 사용) 또는 `(default)` (패키지 내부) |
| **생성자** | 보통 클래스와 같음 |
| **멤버변수** | `private` (getter/setter 제공) |
| **메서드** | `public` (외부 인터페이스) 또는 `private` (내부 구현) |

{{< callout type="warning" >}}
**생성자의 접근 제어자:**
생성자를 `private`으로 하면 외부에서 인스턴스 생성 불가 (싱글톤 패턴 등에 사용)
{{< /callout >}}

---

## 5. 다형성 (Polymorphism)

### 5.1 다형성이란?

**다형성(polymorphism):** 여러 가지 형태를 가질 수 있는 능력

**객체지향에서의 다형성:** 조상 클래스 타입의 참조변수로 자손 클래스의 인스턴스를 참조할 수 있는 것

```java
class Tv {
    void power() { }
    void channelUp() { }
}

class SmartTv extends Tv {
    void caption() { }
}

// 다형성
Tv t = new SmartTv();  // OK! 조상 타입 참조변수로 자손 인스턴스 참조
t.power();      // OK
t.channelUp();  // OK
// t.caption();  // 에러! Tv 타입으로는 caption() 호출 불가
```

**메모리 구조:**

```
t (참조변수: Tv 타입)
  │
  └──→ SmartTv 인스턴스
       ├─ power()
       ├─ channelUp()
       └─ caption()

       실제 인스턴스: SmartTv의 모든 멤버 존재
       사용 가능: Tv 타입의 멤버만
```

---

### 5.2 참조변수의 형변환

**참조변수의 형변환:** 사용할 수 있는 멤버의 개수를 조절하는 것

**규칙:**
1. 서로 상속관계에 있는 클래스 사이에서만 가능
2. 자손 타입 → 조상 타입: 형변환 생략 가능 (Up-casting)
3. 조상 타입 → 자손 타입: 형변환 생략 불가 (Down-casting)

```java
class Car { }
class FireEngine extends Car { }
class Ambulance extends Car { }

FireEngine f = new FireEngine();

// Up-casting (형변환 생략 가능)
Car c = f;
Car c = (Car)f;  // 명시 가능하지만 생략 가능

// Down-casting (형변환 생략 불가)
FireEngine f2 = (FireEngine)c;  // 명시 필수

// 형제 관계는 형변환 불가
// Ambulance a = (Ambulance)f;  // 에러!
```

{{< callout type="danger" >}}
**ClassCastException:**
형변환 가능 여부는 **참조변수가 가리키는 인스턴스의 실제 타입**에 의해 결정된다.
```java
Car c = new Car();
FireEngine f = (FireEngine)c;  // 컴파일 OK, 실행 시 에러!
```
{{< /callout >}}

---

### 5.3 instanceof 연산자

**`instanceof` 연산자:** 참조변수가 참조하는 인스턴스의 실제 타입을 확인하는데 사용

```java
참조변수 instanceof 타입  // true 또는 false 반환
```

```java
class Car { }
class FireEngine extends Car { }

FireEngine f = new FireEngine();

if (f instanceof FireEngine) {
    System.out.println("FireEngine 인스턴스");  // 출력됨
}

if (f instanceof Car) {
    System.out.println("Car 인스턴스");  // 출력됨 (조상도 true)
}

if (f instanceof Object) {
    System.out.println("Object 인스턴스");  // 출력됨
}
```

**형변환 전 확인:**

```java
void doWork(Car c) {
    if (c instanceof FireEngine) {
        FireEngine f = (FireEngine)c;
        f.water();  // FireEngine의 메서드 호출
    } else if (c instanceof Ambulance) {
        Ambulance a = (Ambulance)c;
        a.siren();  // Ambulance의 메서드 호출
    }
}
```

---

### 5.4 참조변수와 인스턴스의 연결

**멤버변수 접근:** 참조변수의 타입에 따라 결정
**메서드 호출:** 인스턴스의 실제 타입에 따라 결정 (오버라이딩된 메서드)

```java
class Parent {
    int x = 100;

    void method() {
        System.out.println("Parent method");
    }
}

class Child extends Parent {
    int x = 200;

    void method() {
        System.out.println("Child method");
    }
}

Parent p = new Child();
System.out.println(p.x);  // 100 (Parent의 x)
p.method();               // "Child method" (오버라이딩된 메서드)
```

---

### 5.5 매개변수의 다형성

**다형성의 장점:** 하나의 메서드로 여러 타입의 객체를 처리할 수 있다.

```java
class Product {
    int price;
    Product(int price) {
        this.price = price;
    }
}

class Tv extends Product {
    Tv() { super(100); }
}

class Computer extends Product {
    Computer() { super(200); }
}

class Buyer {
    int money = 1000;

    // 다형성: Product 타입으로 모든 제품 구매 가능
    void buy(Product p) {
        money -= p.price;
        System.out.println(p + " 구매");
    }
}

Buyer b = new Buyer();
b.buy(new Tv());       // OK
b.buy(new Computer()); // OK
```

**다형성 없이 구현하면:**

```java
// 제품마다 메서드가 필요
void buyTv(Tv t) { ... }
void buyComputer(Computer c) { ... }
void buyAudio(Audio a) { ... }
// 새 제품 추가 시마다 메서드 추가 필요
```

---

### 5.6 여러 종류의 객체를 배열로 다루기

```java
Product[] products = new Product[3];
products[0] = new Tv();
products[1] = new Computer();
products[2] = new Audio();

// 다형성으로 간단히 처리
for (Product p : products) {
    System.out.println(p.price);
}
```

---

## 6. 추상클래스 (Abstract Class)

### 6.1 추상클래스란?

**추상클래스(abstract class):** 미완성 설계도, 추상 메서드를 포함하는 클래스

**추상 메서드(abstract method):** 선언부만 있고 구현부(몸통)가 없는 메서드

```java
abstract class Player {
    abstract void play(int pos);  // 추상 메서드
    abstract void stop();         // 추상 메서드

    void pause() {  // 일반 메서드
        System.out.println("일시정지");
    }
}
```

**추상클래스의 특징:**
1. 인스턴스를 생성할 수 없다.
2. 추상 메서드를 하나라도 가지면 반드시 추상클래스로 선언
3. 추상 메서드가 없어도 추상클래스로 선언 가능

```java
// Player p = new Player();  // 에러! 추상클래스는 인스턴스 생성 불가

// 추상클래스를 상속받아 구현
class AudioPlayer extends Player {
    void play(int pos) {
        System.out.println(pos + "위치부터 재생");
    }
    void stop() {
        System.out.println("재생 중지");
    }
}

AudioPlayer ap = new AudioPlayer();  // OK
```

---

### 6.2 추상클래스의 작성

**추상화(abstraction):** 클래스간의 공통점을 찾아내서 공통의 조상을 만드는 작업

**구체화(realization):** 추상클래스를 상속받아 완전한 클래스를 만드는 작업

```java
// 구체적인 클래스들
class Marine {
    void move(int x, int y) { }
    void stop() { }
    void stimPack() { }
}

class Tank {
    void move(int x, int y) { }
    void stop() { }
    void changeMode() { }
}

// 추상화: 공통 부분을 뽑아냄
abstract class Unit {
    int x, y;
    abstract void move(int x, int y);
    void stop() {
        System.out.println("정지");
    }
}

// 구체화: 추상클래스를 상속받아 완성
class Marine extends Unit {
    void move(int x, int y) {
        System.out.println("걸어서 이동");
    }
    void stimPack() { }
}

class Tank extends Unit {
    void move(int x, int y) {
        System.out.println("굴러서 이동");
    }
    void changeMode() { }
}
```

**추상클래스의 장점:**

```java
// 다형성 활용
Unit[] units = new Unit[2];
units[0] = new Marine();
units[1] = new Tank();

for (Unit u : units) {
    u.move(100, 200);  // 각자의 방식으로 이동
}
```

---

## 7. 인터페이스 (Interface)

### 7.1 인터페이스란?

**인터페이스(interface):** 일종의 추상클래스. 추상메서드와 상수만을 멤버로 가질 수 있다.

**추상클래스 vs 인터페이스:**

| 구분 | 추상클래스 | 인터페이스 |
|:-----|:----------|:----------|
| **멤버** | 모든 멤버 가능 | 추상메서드, 상수, default/static 메서드 |
| **생성자** | 가질 수 있음 | 가질 수 없음 |
| **다중 상속** | 불가 | 가능 (다중 구현) |
| **용도** | 공통 기능 제공 | 인터페이스(규약) 정의 |

---

### 7.2 인터페이스의 작성

```java
interface 인터페이스이름 {
    public static final 타입 상수이름 = 값;
    public abstract 메서드이름(매개변수);
}
```

**인터페이스의 규칙:**
1. 모든 멤버변수는 `public static final` (생략 가능)
2. 모든 메서드는 `public abstract` (생략 가능, JDK 1.8부터 예외 있음)

```java
interface PlayingCard {
    public static final int SPADE = 4;
    final int DIAMOND = 3;  // public static 생략
    static int HEART = 2;   // public final 생략
    int CLOVER = 1;         // public static final 생략

    public abstract String getCardNumber();
    String getCardKind();   // public abstract 생략
}
```

---

### 7.3 인터페이스의 상속

- 인터페이스는 인터페이스로부터만 상속 가능
- 클래스와 달리 **다중상속 가능**

```java
interface Movable {
    void move(int x, int y);
}

interface Attackable {
    void attack(Unit u);
}

// 다중 상속
interface Fightable extends Movable, Attackable {
}
```

---

### 7.4 인터페이스의 구현

**키워드:** `implements`

```java
class 클래스이름 implements 인터페이스이름 {
    // 인터페이스에 정의된 추상메서드 구현
}

interface Fightable {
    void move(int x, int y);
    void attack(Unit u);
}

class Fighter implements Fightable {
    public void move(int x, int y) {
        // 구현
    }

    public void attack(Unit u) {
        // 구현
    }
}
```

**일부만 구현:**

```java
abstract class Fighter implements Fightable {
    public void move(int x, int y) {
        // 구현
    }
    // attack()은 구현 안 함 → 추상클래스로 선언
}
```

**상속과 구현 동시:**

```java
class Fighter extends Unit implements Fightable {
    // ...
}
```

---

### 7.5 인터페이스를 이용한 다형성

**인터페이스 타입의 참조변수:**

```java
Fightable f = new Fighter();
f.move(100, 200);
f.attack(new Unit());
```

**매개변수로 사용:**

```java
void attack(Fightable f) {
    f.attack(target);
}

attack(new Fighter());  // OK
```

**리턴타입으로 사용:**

```java
Fightable method() {
    return new Fighter();  // Fighter 인스턴스 반환
}
```

{{< callout type="info" >}}
**인터페이스 타입의 매개변수/반환타입:**
- 매개변수: 해당 인터페이스를 구현한 클래스의 인스턴스
- 반환타입: 해당 인터페이스를 구현한 클래스의 인스턴스를 반환
{{< /callout >}}

---

### 7.6 인터페이스의 장점

1. **개발시간 단축**
   - 인터페이스가 작성되면 양쪽에서 동시 개발 가능

2. **표준화 가능**
   - 프로젝트의 기본 틀을 인터페이스로 작성
   - 일관되고 정형화된 개발 가능

3. **서로 관계없는 클래스들에게 관계 맺어줌**
   - 하나의 인터페이스를 공통으로 구현

4. **독립적인 프로그래밍 가능**
   - 클래스 간의 직접적인 관계를 간접적인 관계로 변경
   - 한 클래스의 변경이 다른 클래스에 영향을 주지 않음

**예제: 직접 관계 → 간접 관계**

```java
// 직접 관계 (A가 B에 의존)
class A {
    public void methodA(B b) {
        b.methodB();
    }
}

class B {
    public void methodB() {
        System.out.println("methodB");
    }
}

// 간접 관계 (A가 I에 의존, B의 변경에 영향 없음)
interface I {
    void methodB();
}

class B implements I {
    public void methodB() {
        System.out.println("methodB in B");
    }
}

class A {
    public void methodA(I i) {  // B가 아닌 I에 의존
        i.methodB();
    }
}
```

---

### 7.7 디폴트 메서드와 static 메서드

**JDK 1.8부터 추가:** 인터페이스에 `default` 메서드와 `static` 메서드 추가 가능

#### 디폴트 메서드 (Default Method)

**목적:** 인터페이스에 새로운 메서드 추가 시 기존 구현 클래스들의 변경 방지

```java
interface MyInterface {
    void method();

    // 디폴트 메서드 (구현체 제공)
    default void newMethod() {
        System.out.println("기본 구현");
    }
}

class MyClass implements MyInterface {
    public void method() {
        // 구현
    }
    // newMethod()는 구현 안 해도 됨
}
```

**디폴트 메서드 충돌 규칙:**

1. **여러 인터페이스의 디폴트 메서드 충돌**
   - 구현 클래스에서 오버라이딩 필수

2. **디폴트 메서드와 조상 클래스의 메서드 충돌**
   - 조상 클래스의 메서드가 상속됨, 디폴트 메서드는 무시됨

```java
interface A {
    default void method() {
        System.out.println("A");
    }
}

interface B {
    default void method() {
        System.out.println("B");
    }
}

// 충돌 해결: 오버라이딩 필수
class C implements A, B {
    public void method() {
        A.super.method();  // A의 메서드 호출
    }
}
```

#### static 메서드

```java
interface MyInterface {
    static void staticMethod() {
        System.out.println("인터페이스의 static 메서드");
    }
}

// 호출
MyInterface.staticMethod();
```

---

## 8. 내부 클래스 (Inner Class)

### 8.1 내부 클래스란?

**내부 클래스(inner class):** 클래스 내에 선언된 클래스

**장점:**
1. 내부 클래스에서 외부 클래스의 멤버들을 쉽게 접근 가능
2. 코드의 복잡성 감소 (캡슐화)

```java
class Outer {
    int outerValue = 10;

    class Inner {
        void method() {
            System.out.println(outerValue);  // 외부 클래스 멤버 접근
        }
    }
}
```

---

### 8.2 내부 클래스의 종류

| 내부 클래스 | 선언 위치 | 특징 |
|:----------|:---------|:-----|
| **인스턴스 클래스** | 멤버변수 선언위치 | 외부 클래스의 인스턴스 멤버처럼 다뤄짐 |
| **스태틱 클래스** | 멤버변수 선언위치 | 외부 클래스의 static 멤버처럼 다뤄짐 |
| **지역 클래스** | 메서드 내부 | 선언된 영역 내부에서만 사용 가능 |
| **익명 클래스** | - | 이름 없는 일회용 클래스 |

```java
class Outer {
    // 인스턴스 클래스
    class InstanceInner {
        int iv = 100;
    }

    // 스태틱 클래스
    static class StaticInner {
        int iv = 200;
        static int cv = 300;  // static 멤버 가질 수 있음
    }

    void method() {
        // 지역 클래스
        class LocalInner {
            int iv = 400;
        }
    }
}
```

---

### 8.3 내부 클래스의 제어자와 접근성

**스태틱 클래스만 static 멤버를 가질 수 있다.**

```java
class Outer {
    class InstanceInner {
        // static int cv = 100;  // 에러!
        final static int CONST = 100;  // OK (상수는 허용)
    }

    static class StaticInner {
        static int cv = 200;  // OK
    }
}
```

**외부 클래스 멤버 접근:**

```java
class Outer {
    int outerIv = 0;
    static int outerCv = 0;

    class InstanceInner {
        void method() {
            System.out.println(outerIv);   // OK
            System.out.println(outerCv);   // OK
        }
    }

    static class StaticInner {
        void method() {
            // System.out.println(outerIv);  // 에러!
            System.out.println(outerCv);     // OK
        }
    }
}
```

**내부 클래스 생성:**

```java
Outer outer = new Outer();

// 인스턴스 클래스
Outer.InstanceInner ii = outer.new InstanceInner();

// 스태틱 클래스
Outer.StaticInner si = new Outer.StaticInner();
```

---

### 8.4 익명 클래스 (Anonymous Class)

**익명 클래스:** 이름이 없는 일회용 클래스

```java
// 형식
new 조상클래스이름() {
    // 멤버 선언
}

// 또는
new 구현인터페이스이름() {
    // 멤버 선언
}
```

**예제:**

```java
interface Runnable {
    void run();
}

// 익명 클래스 사용
Runnable r = new Runnable() {
    public void run() {
        System.out.println("익명 클래스");
    }
};

r.run();

// 람다식으로 대체 가능 (JDK 1.8+)
Runnable r2 = () -> System.out.println("람다식");
```

**익명 클래스의 특징:**
1. 이름이 없으므로 생성자를 가질 수 없음
2. 단 하나의 클래스 상속 또는 단 하나의 인터페이스 구현만 가능
3. 일회용이므로 재사용 불가

---

## 9. 요약

### 핵심 개념 정리

| 개념 | 핵심 내용 |
|:-----|:---------|
| **상속** | 기존 클래스를 재사용하여 새로운 클래스 작성 (extends) |
| **오버라이딩** | 조상의 메서드를 재정의 (선언부 일치) |
| **super** | 조상의 멤버 참조 |
| **super()** | 조상의 생성자 호출 (생성자 첫 줄) |
| **package** | 관련된 클래스들을 그룹화 |
| **import** | 다른 패키지의 클래스 사용 |
| **제어자** | 클래스/멤버의 의미 부여 (static, final, abstract 등) |
| **다형성** | 조상 타입으로 자손 인스턴스 참조 |
| **추상클래스** | 미완성 클래스 (추상 메서드 포함) |
| **인터페이스** | 추상메서드와 상수만 가진 일종의 추상클래스 |
| **내부클래스** | 클래스 내에 선언된 클래스 |

{{< callout type="info" >}}
**객체지향의 핵심 원리:**
- **상속:** 코드 재사용
- **다형성:** 유연한 설계
- **캡슐화:** 정보 은닉 (접근 제어자)
- **추상화:** 공통점 추출 (추상클래스, 인터페이스)
{{< /callout >}}
