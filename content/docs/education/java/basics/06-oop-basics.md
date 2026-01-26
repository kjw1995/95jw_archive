---
title: "Chapter 06. 객체지향 프로그래밍 I"
weight: 6
---

# 객체지향 프로그래밍 I

객체지향 프로그래밍(OOP)의 기본 개념인 클래스, 객체, 메서드, 생성자를 다룬다.

---

## 1. 객체지향 언어

### 1.1 객체지향 언어의 특징

**객체지향 이론의 기본 개념:** "실제 세계는 사물(객체)로 이루어져 있으며, 발생하는 모든 사건들은 사물간의 상호작용이다."

**객체지향 언어의 장점**

1. **코드의 재사용성이 높다.**
   - 새로운 코드를 작성할 때 기존의 코드를 이용하여 쉽게 작성할 수 있다.
2. **코드의 관리가 용이하다.**
   - 코드간의 관계를 이용해서 적은 노력으로 쉽게 코드를 변경할 수 있다.
3. **신뢰성이 높은 프로그래밍을 가능하게 한다.**
   - 제어자와 메서드를 이용해서 데이터를 보호하고 올바른 값을 유지하도록 하며, 코드의 중복을 제거하여 코드의 불일치로 인한 오동작을 방지할 수 있다.

{{< callout type="info" >}}
**객체지향 학습의 관점:** 재사용성, 유지보수, 중복 코드 제거 이 세 가지 관점에서 보면 이해가 쉽다.
{{< /callout >}}

---

## 2. 클래스와 객체

### 2.1 클래스와 객체의 정의

| 용어 | 정의 | 용도 |
|:-----|:-----|:-----|
| **클래스 (Class)** | 객체를 정의해 놓은 것 (설계도, 틀) | 객체를 생성하는데 사용 |
| **객체 (Object)** | 실제로 존재하는 것 (사물, 개념) | 객체가 가진 기능과 속성에 따라 다름 |

**객체의 종류**
- 유형의 객체: 책상, 의자, 자동차, TV
- 무형의 객체: 수학공식, 프로그램 에러와 같은 논리나 개념

{{< callout type="warning" >}}
클래스는 단지 객체를 생성하는 설계도일 뿐, 객체 그 자체가 아니다. 객체를 사용하려면 **반드시 생성 과정이 선행**되어야 한다.
{{< /callout >}}

---

### 2.2 객체와 인스턴스

```
         인스턴스화 (instantiate)
클래스 ────────────────────────> 인스턴스 (객체)
```

- **인스턴스화**: 클래스로부터 객체를 만드는 과정
- **인스턴스**: 어떤 클래스로부터 만들어진 객체 (특정 클래스의 객체임을 강조)

```java
Tv t = new Tv();  // Tv 클래스의 인스턴스 t를 생성
```

---

### 2.3 객체의 구성요소

객체는 **속성(attribute)**과 **기능(function)** 두 종류의 구성요소로 이루어진다.

| 구성요소 | 다른 용어 | 설명 |
|:--------|:---------|:-----|
| **속성 (Property)** | 멤버변수, 특성, 필드, 상태 | 객체의 데이터 |
| **기능 (Function)** | 메서드, 함수, 행위 | 객체의 동작 |

```java
public class Tv {
    // 속성 (멤버변수)
    String color;       // 색상
    boolean power;      // 전원 상태 (on/off)
    int channel;        // 채널

    // 기능 (메서드)
    void power() {
        power = !power;
    }
    void channelUp() {
        ++channel;
    }
    void channelDown() {
        --channel;
    }
}
```

{{< callout type="info" >}}
**코딩 컨벤션:** 일반적으로 멤버변수를 먼저 선언하고, 그 다음 메서드를 선언한다.
{{< /callout >}}

---

### 2.4 인스턴스의 생성과 사용

```java
public class TvTest {
    public static void main(String[] args) {
        Tv t;                 // 1. Tv 참조변수 선언
        t = new Tv();         // 2. Tv 인스턴스 생성
        t.channel = 7;        // 3. 인스턴스 멤버변수 접근
        t.channelDown();      // 4. 인스턴스 메서드 호출
        System.out.println("현재 채널은 " + t.channel + "입니다.");
    }
}
```

**실행 과정 상세 분석:**

1. `Tv t;`
   - 참조변수 `t`를 위한 메모리 공간 마련
   - 아직 인스턴스가 없으므로 사용 불가

2. `t = new Tv();`
   - `new` 연산자가 힙(heap) 메모리에 Tv 인스턴스 생성
   - 멤버변수는 자료형의 기본값으로 초기화
   - 생성된 인스턴스의 주소가 참조변수 `t`에 저장

3. `t.channel = 7;`
   - 참조변수 `t`를 통해 인스턴스의 멤버변수에 접근
   - 형식: `참조변수.멤버변수`

4. `t.channelDown();`
   - 참조변수 `t`를 통해 메서드 호출
   - 형식: `참조변수.메서드명()`

**여러 인스턴스와 참조:**

```java
// 두 개의 독립적인 인스턴스
Tv t1 = new Tv();
Tv t2 = new Tv();
t1.channel = 7;
System.out.println(t2.channel);  // 0 (서로 다른 인스턴스)

// 참조 복사
Tv t3 = new Tv();
Tv t4 = t3;  // t3와 t4는 같은 인스턴스를 가리킴
t3.channel = 7;
System.out.println(t4.channel);  // 7 (같은 인스턴스 참조)
```

{{< callout type="warning" >}}
**중요 원칙:**
- 인스턴스는 참조변수를 통해서만 다룰 수 있다.
- 참조변수의 타입은 인스턴스의 타입과 일치해야 한다.
- 하나의 참조변수는 하나의 인스턴스만 가리킬 수 있다.
- 여러 참조변수가 하나의 인스턴스를 가리키는 것은 가능하다.
{{< /callout >}}

---

### 2.5 객체 배열

객체 배열은 **객체의 주소를 저장하는 참조변수 배열**이다.

```java
Tv[] tvArr = new Tv[3];  // 참조변수 배열만 생성됨

// 각 요소에 인스턴스를 생성해야 사용 가능
for (int i = 0; i < tvArr.length; i++) {
    tvArr[i] = new Tv();         // 인스턴스 생성
    tvArr[i].channel = i + 10;   // 초기화
}

// 사용
for (int i = 0; i < tvArr.length; i++) {
    tvArr[i].channelUp();
    System.out.printf("tvArr[%d].channel=%d%n", i, tvArr[i].channel);
}
```

**객체 배열 메모리 구조:**

```
tvArr (참조변수 배열)
  │
  ├──→ [0] ──→ Tv 인스턴스1 (channel=10)
  ├──→ [1] ──→ Tv 인스턴스2 (channel=11)
  └──→ [2] ──→ Tv 인스턴스3 (channel=12)
```

---

### 2.6 클래스의 또 다른 정의

#### 클래스 = 데이터 + 함수

**프로그래밍 데이터 저장의 발전 과정:**

```
변수 → 배열 → 구조체 → 클래스
```

| 단계 | 설명 |
|:-----|:-----|
| 변수 | 하나의 데이터 |
| 배열 | 같은 종류의 여러 데이터 |
| 구조체 | 서로 다른 종류의 데이터 |
| 클래스 | 데이터 + 관련 함수 |

#### 클래스 = 사용자정의 타입

```java
// 기본형 사용
int hour1, minute1, second1;
int hour2, minute2, second2;

// 클래스 (사용자정의 타입) 사용
class Time {
    int hour;
    int minute;
    int second;
}

Time t1 = new Time();
Time t2 = new Time();
```

---

## 3. 변수와 메서드

### 3.1 선언위치에 따른 변수의 종류

```java
class Variables {
    int iv;           // 인스턴스 변수
    static int cv;    // 클래스 변수 (static 변수, 공유 변수)

    void method() {
        int lv = 0;   // 지역 변수
    }
}
```

| 변수 종류 | 선언 위치 | 생성 시기 | 소멸 시기 |
|:---------|:---------|:---------|:---------|
| **클래스 변수** | 클래스 영역 | 클래스가 메모리에 로딩될 때 | 프로그램 종료 시 |
| **인스턴스 변수** | 클래스 영역 | 인스턴스 생성 시 | 인스턴스가 GC에 의해 제거될 때 |
| **지역 변수** | 메서드, 생성자, 블록 내부 | 변수 선언문 수행 시 | 블록을 벗어날 때 |

---

### 3.2 인스턴스 변수 vs 클래스 변수

**1. 인스턴스 변수**
- 각 인스턴스마다 독립적인 저장공간
- 인스턴스마다 다른 값 유지 가능

**2. 클래스 변수**
- 모든 인스턴스가 공유하는 저장공간
- 인스턴스 생성 없이도 사용 가능
- 형식: `클래스이름.클래스변수`

```java
public class Card {
    // 인스턴스 변수 (카드마다 다른 값)
    String kind;
    int number;

    // 클래스 변수 (모든 카드가 공유)
    static int width = 100;
    static int height = 250;
}

public class CardTest {
    public static void main(String[] args) {
        // 클래스 변수는 인스턴스 생성 없이 사용 가능
        System.out.println("Card.width = " + Card.width);
        System.out.println("Card.height = " + Card.height);

        Card c1 = new Card();
        c1.kind = "Heart";
        c1.number = 7;

        Card c2 = new Card();
        c2.kind = "Spade";
        c2.number = 4;

        System.out.println("c1은 " + c1.kind + ", " + c1.number);
        System.out.println("c2는 " + c2.kind + ", " + c2.number);

        // 클래스 변수 변경 (모든 인스턴스에 영향)
        c1.width = 50;
        c1.height = 80;

        System.out.println("c1 크기: (" + c1.width + ", " + c1.height + ")");
        System.out.println("c2 크기: (" + c2.width + ", " + c2.height + ")");
        // 둘 다 (50, 80) 출력 - 클래스 변수이므로 공유됨
    }
}
```

{{< callout type="warning" >}}
**클래스 변수 접근 권장 방법:**
인스턴스 참조변수 대신 **클래스 이름**으로 접근하자.
- 권장: `Card.width = 50;`
- 비권장: `c1.width = 50;` (컴파일은 되지만 혼란 가능)
{{< /callout >}}

---

### 3.3 메서드

메서드는 **특정 작업을 수행하는 일련의 문장들을 하나로 묶은 것**이다.

**메서드를 사용하는 이유**

1. **높은 재사용성 (Reusability)**
   - 한 번 작성한 메서드를 여러 곳에서 반복 사용 가능

2. **중복된 코드의 제거**
   - 반복되는 코드를 메서드로 만들어 중복 제거
   - 수정 시 메서드만 수정하면 되므로 유지보수 용이

3. **프로그램의 구조화**
   - 복잡한 작업을 작은 단위로 분할
   - 가독성 향상, 디버깅 쉬워짐

{{< callout type="info" >}}
**블랙박스(Black Box) 개념:**
메서드는 내부 구현을 몰라도 입력과 출력만 알면 사용 가능하다.
{{< /callout >}}

---

### 3.4 메서드의 선언과 구현

```
반환타입 메서드이름 (매개변수 선언) {  // 선언부 (header)
    // 구현부 (body)
    문장들
    return 반환값;  // 반환타입이 void가 아닌 경우
}
```

#### 메서드 선언부 구성 요소

| 구성 요소 | 설명 |
|:---------|:-----|
| **반환타입** | 메서드 작업 결과의 타입. 없으면 `void` |
| **메서드 이름** | 변수 명명규칙과 동일. 동사 사용 권장 |
| **매개변수 선언** | 입력값을 받을 변수. `타입 변수명, 타입 변수명, ...` |

```java
// 예시
int add(int x, int y) {          // 반환타입: int
    int result = x + y;          // 지역변수
    return result;               // 반환값
}

void power() {                   // 반환타입: void (반환값 없음)
    power = !power;
}

long multiply(long a, long b) {  // 매개변수 2개
    long result = a * b;
    return result;
}
```

#### return문

- **역할:** 현재 실행중인 메서드를 종료하고 호출한 곳으로 되돌아간다.
- 모든 메서드에는 최소 하나의 `return`문이 필요 (void는 컴파일러가 자동 추가)

```java
// 단일 반환값
int max(int a, int b) {
    return a > b ? a : b;
}

// 조건부 반환
int abs(int x) {
    if (x >= 0) {
        return x;
    } else {
        return -x;
    }
}

// void 메서드에서의 return (조기 종료)
void printGugudan(int dan) {
    if (dan < 2 || dan > 9) {
        return;  // 메서드 종료
    }
    for (int i = 1; i <= 9; i++) {
        System.out.printf("%d * %d = %d%n", dan, i, dan * i);
    }
}
```

{{< callout type="warning" >}}
**return의 제약:**
- 한 번에 하나의 값만 반환 가능
- 여러 값이 필요하면 배열이나 객체 사용
{{< /callout >}}

---

### 3.5 메서드의 호출

```java
메서드이름(값1, 값2, ...);  // 메서드 호출
```

#### 인자(Argument)와 매개변수(Parameter)

```java
public static void main(String[] args) {
    int result = add(3, 5);  // 3, 5는 인자(argument)
}

int add(int x, int y) {      // x, y는 매개변수(parameter)
    return x + y;
}
```

| 용어 | 설명 |
|:-----|:-----|
| **인자 (Argument)** | 메서드 호출 시 전달하는 값 (원본) |
| **매개변수 (Parameter)** | 메서드 선언부에 정의된 변수 (복사본) |

**규칙:**
- 인자의 개수와 순서는 매개변수와 일치해야 함
- 인자의 타입은 매개변수의 타입과 일치하거나 자동 형변환 가능해야 함

```java
long add(int a, long b) {
    return a + b;
}

// 호출
add(3, 5L);      // OK
add(3L, 5);      // OK (int → long 자동 형변환)
add(3, 5);       // OK (int → long 자동 형변환)
```

---

### 3.6 JVM의 메모리 구조

JVM은 메모리를 용도에 따라 여러 영역으로 나누어 관리한다.

```
┌─────────────────────────────┐
│    Method Area              │ ← 클래스 정보, 클래스 변수
├─────────────────────────────┤
│    Call Stack (호출스택)     │ ← 메서드 수행, 지역 변수
├─────────────────────────────┤
│    Heap                     │ ← 인스턴스, 인스턴스 변수
└─────────────────────────────┘
```

| 영역 | 저장 내용 | 생성/소멸 시점 |
|:-----|:---------|:--------------|
| **Method Area** | 클래스 데이터, static 변수 | 클래스 로딩 시 / 프로그램 종료 시 |
| **Heap** | 인스턴스, 인스턴스 변수 | new 연산자 실행 시 / GC에 의해 |
| **Call Stack** | 메서드 호출 정보, 지역 변수 | 메서드 호출 시 / 메서드 종료 시 |

#### 호출스택 (Call Stack)

**특징:**
- 메서드가 호출되면 수행에 필요한 메모리를 스택에 할당
- 메서드 수행을 마치면 메모리를 반환하고 스택에서 제거
- 제일 위에 있는 메서드가 현재 실행 중인 메서드
- 아래에 있는 메서드가 바로 위의 메서드를 호출한 메서드

```java
public class CallStackTest {
    public static void main(String[] args) {
        System.out.println("main 시작");
        firstMethod();
        System.out.println("main 끝");
    }

    static void firstMethod() {
        System.out.println("firstMethod 시작");
        secondMethod();
        System.out.println("firstMethod 끝");
    }

    static void secondMethod() {
        System.out.println("secondMethod 시작");
        System.out.println("secondMethod 끝");
    }
}
```

**실행 순서와 Call Stack 변화:**

```
1. [main]                    // main 시작
2. [main, firstMethod]       // firstMethod 시작
3. [main, firstMethod, secondMethod]  // secondMethod 시작, 끝
4. [main, firstMethod]       // firstMethod 끝
5. [main]                    // main 끝
6. []                        // 프로그램 종료
```

---

### 3.7 기본형 매개변수와 참조형 매개변수

Java는 메서드 호출 시 매개변수로 **값을 복사**해서 전달한다.

| 매개변수 타입 | 전달되는 것 | 변경 가능 여부 |
|:------------|:----------|:-------------|
| **기본형 (Primitive)** | 값 (value) | 읽기만 가능 (read only) |
| **참조형 (Reference)** | 주소 (address) | 읽기/쓰기 가능 (read & write) |

#### 기본형 매개변수

```java
public class PrimitiveParam {
    public static void main(String[] args) {
        int x = 10;
        change(x);
        System.out.println("x = " + x);  // 10 (변경 안됨)
    }

    static void change(int x) {
        x = 100;  // 복사본만 변경
    }
}
```

**메모리 동작:**

```
main의 x: 10 ──(값 복사)──> change의 x: 10 → 100
                             ↑
                        복사본만 변경, 원본 영향 없음
```

#### 참조형 매개변수

```java
class Data {
    int x;
}

public class ReferenceParam {
    public static void main(String[] args) {
        Data d = new Data();
        d.x = 10;
        change(d);
        System.out.println("d.x = " + d.x);  // 100 (변경됨)
    }

    static void change(Data d) {
        d.x = 100;  // 같은 인스턴스를 가리키므로 원본 변경
    }
}
```

**메모리 동작:**

```
main의 d ──(주소 복사)──> change의 d
   │                        │
   └────→  Data 인스턴스  ←─┘
           x: 10 → 100
```

#### 배열도 참조형

```java
public class ArrayParam {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3, 4, 5};
        change(arr);
        System.out.println(Arrays.toString(arr));  // [10, 2, 3, 4, 5]
    }

    static void change(int[] arr) {
        arr[0] = 10;  // 같은 배열을 참조하므로 원본 변경
    }
}
```

{{< callout type="info" >}}
**참조형 반환:**
메서드는 참조형 값(주소)도 반환할 수 있다.
```java
Data createData() {
    Data d = new Data();
    d.x = 100;
    return d;  // 인스턴스의 주소 반환
}
```
{{< /callout >}}

---

## 4. 오버로딩 (Overloading)

### 4.1 오버로딩이란?

**오버로딩(Overloading):** 한 클래스 내에 같은 이름의 메서드를 여러 개 정의하는 것

```java
// println 메서드의 오버로딩 예시
void println()
void println(boolean x)
void println(char x)
void println(double x)
void println(String x)
```

---

### 4.2 오버로딩의 조건

1. **메서드 이름이 같아야 한다.**
2. **매개변수의 개수 또는 타입이 달라야 한다.**
3. 반환 타입은 오버로딩에 영향을 주지 않는다.

```java
// 올바른 오버로딩
int add(int a, int b) { return a + b; }
long add(long a, long b) { return a + b; }
int add(int a, int b, int c) { return a + b + c; }

// 잘못된 오버로딩 (컴파일 에러)
int add(int a, int b) { return a + b; }
long add(int x, int y) { return (long)(x + y); }  // 에러!
// 매개변수는 같고 반환타입만 다름
```

**오버로딩 구분 원칙:**

| 항목 | 오버로딩 구분 여부 |
|:-----|:-----------------|
| 메서드 이름 | 반드시 같아야 함 |
| 매개변수 개수 | ✓ 다르면 오버로딩 |
| 매개변수 타입 | ✓ 다르면 오버로딩 |
| 매개변수 순서 | ✓ 다르면 오버로딩 |
| 매개변수 이름 | ✗ 관계없음 |
| 반환 타입 | ✗ 관계없음 |

---

### 4.3 오버로딩의 장점

```java
// 오버로딩 없이
int addInt(int a, int b) { ... }
long addLong(long a, long b) { ... }
double addDouble(double a, double b) { ... }

// 오버로딩 사용
int add(int a, int b) { ... }
long add(long a, long b) { ... }
double add(double a, double b) { ... }
```

**장점:**
1. 메서드 이름을 절약할 수 있다.
2. 메서드 이름만 보고도 기능을 유추할 수 있다.
3. 사용자가 메서드를 선택하는 수고를 덜 수 있다.

---

### 4.4 가변인자 (Varargs)와 오버로딩

JDK 1.5부터 **가변인자(variable arguments)**를 지원한다.

```java
// 형식: 타입... 변수명
public String concatenate(String... args) {
    // args는 배열처럼 사용
}

// 호출
concatenate("a");
concatenate("a", "b");
concatenate("a", "b", "c");
concatenate();  // 인자 없이도 가능
```

**가변인자의 특징:**
- 내부적으로 배열을 이용
- 호출할 때마다 배열 생성 (성능 고려 필요)
- 가변인자는 매개변수 중 **제일 마지막**에만 선언 가능

```java
// 올바른 선언
void method(String s, int... args) { }

// 잘못된 선언
void method(int... args, String s) { }  // 에러!
```

**오버로딩과 가변인자 주의사항:**

```java
void method(int... args) { }
void method(int a, int b) { }

// 호출 시 모호함 발생 가능
method(1, 2);  // 어느 메서드를 호출해야 하는가?
```

{{< callout type="warning" >}}
가변인자를 사용한 메서드는 오버로딩하지 않는 것이 좋다.
{{< /callout >}}

---

## 5. 생성자 (Constructor)

### 5.1 생성자란?

**생성자는 인스턴스가 생성될 때 호출되는 '인스턴스 초기화 메서드'다.**

**생성자의 조건:**
1. 생성자의 이름은 클래스 이름과 같아야 한다.
2. 생성자는 리턴 값이 없다. (`void`도 쓰지 않음)

```java
// 생성자 정의 형식
클래스이름(타입 변수명, 타입 변수명, ...) {
    // 인스턴스 생성 시 수행될 코드
    // 주로 인스턴스 변수의 초기화 코드
}

class Card {
    Card() {  // 매개변수가 없는 생성자
        // 초기화 작업
    }

    Card(String kind, int number) {  // 매개변수가 있는 생성자
        this.kind = kind;
        this.number = number;
    }
}
```

{{< callout type="warning" >}}
**중요:** 생성자는 인스턴스를 생성하는 것이 아니다. `new` 연산자가 인스턴스를 생성하고, 생성자는 초기화만 담당한다.
{{< /callout >}}

**인스턴스 생성 과정:**

```java
Card c = new Card();
```

1. `new` 연산자에 의해 힙(heap)에 `Card` 인스턴스가 생성된다.
2. 생성자 `Card()`가 호출되어 초기화 작업을 수행한다.
3. `new` 연산자의 결과로 생성된 인스턴스의 주소가 참조변수 `c`에 저장된다.

---

### 5.2 기본 생성자 (Default Constructor)

모든 클래스에는 **반드시 하나 이상의 생성자가 정의**되어 있어야 한다.

**기본 생성자 자동 추가 규칙:**
- 클래스에 생성자가 **하나도 없을 때만** 컴파일러가 자동으로 추가

```java
// 소스 코드
class Card {
    String kind;
    int number;
}

// 컴파일 후 (컴파일러가 자동 추가)
class Card {
    String kind;
    int number;

    Card() { }  // 기본 생성자 자동 추가
}
```

{{< callout type="danger" >}}
**주의:** 생성자를 하나라도 정의하면 기본 생성자는 추가되지 않는다!
```java
class Card {
    Card(String kind, int number) { ... }
}

Card c = new Card();  // 에러! 기본 생성자가 없음
```
{{< /callout >}}

---

### 5.3 매개변수가 있는 생성자

```java
class Car {
    String color;
    String gearType;
    int door;

    // 매개변수가 없는 생성자
    Car() {
        color = "white";
        gearType = "auto";
        door = 4;
    }

    // 매개변수가 있는 생성자
    Car(String c, String g, int d) {
        color = c;
        gearType = g;
        door = d;
    }
}

// 사용
Car c1 = new Car();                       // 기본값으로 초기화
Car c2 = new Car("blue", "manual", 2);    // 지정한 값으로 초기화
```

**장점:**
- 인스턴스 생성과 동시에 원하는 값으로 초기화 가능
- 코드 간결화

```java
// 매개변수 없는 생성자 사용
Car c = new Car();
c.color = "blue";
c.gearType = "manual";
c.door = 2;

// 매개변수 있는 생성자 사용 (더 간결)
Car c = new Car("blue", "manual", 2);
```

---

### 5.4 생성자에서 다른 생성자 호출하기 - `this()`, `this`

#### this() - 같은 클래스의 다른 생성자 호출

**규칙:**
1. 생성자의 이름으로 클래스이름 대신 `this`를 사용
2. 한 생성자에서 다른 생성자를 호출할 때는 **반드시 첫 줄에서만** 호출 가능

```java
class Car {
    String color;
    String gearType;
    int door;

    // 매개변수 3개인 생성자
    Car(String color, String gearType, int door) {
        this.color = color;
        this.gearType = gearType;
        this.door = door;
    }

    // 매개변수 2개인 생성자
    Car(String color, String gearType) {
        this(color, gearType, 4);  // 다른 생성자 호출
    }

    // 기본 생성자
    Car() {
        this("white", "auto", 4);  // 다른 생성자 호출
    }
}
```

{{< callout type="danger" >}}
**잘못된 예:**
```java
Car(String color) {
    door = 5;                    // 첫 번째 줄
    this(color, "auto", 4);      // 에러! 첫 줄이 아님
}
```
{{< /callout >}}

**첫 줄 제약 이유:**
- 생성자 중간에 다른 생성자를 호출하면 이전 초기화 작업이 무의미해질 수 있음

---

#### this - 인스턴스 자신을 가리키는 참조변수

```java
class Car {
    String color;

    // 매개변수와 인스턴스 변수 이름이 같을 때
    Car(String color) {
        this.color = color;  // this.color는 인스턴스 변수
                             // color는 매개변수
    }
}
```

**this의 특징:**
- 모든 인스턴스 메서드에 지역변수로 숨겨진 채 존재
- 인스턴스 자신의 주소가 저장되어 있음
- `static` 메서드에서는 사용 불가 (인스턴스와 무관하므로)

| 용어 | 설명 |
|:-----|:-----|
| `this` | 인스턴스 자신을 가리키는 참조변수 |
| `this()` | 같은 클래스의 다른 생성자를 호출하는 생성자 |

---

### 5.5 생성자를 이용한 인스턴스 복사

```java
class Car {
    String color;
    String gearType;
    int door;

    Car(String color, String gearType, int door) {
        this.color = color;
        this.gearType = gearType;
        this.door = door;
    }

    // 복사 생성자
    Car(Car c) {
        this(c.color, c.gearType, c.door);
        // 또는
        // this.color = c.color;
        // this.gearType = c.gearType;
        // this.door = c.door;
    }
}

// 사용
Car c1 = new Car("blue", "manual", 2);
Car c2 = new Car(c1);  // c1의 복사본 c2 생성
```

{{< callout type="info" >}}
**Object.clone() 메서드:**
Java는 `Object` 클래스에 정의된 `clone()` 메서드를 통해 인스턴스를 간단히 복사할 수 있다.
{{< /callout >}}

---

## 6. 변수의 초기화

### 6.1 변수의 초기화

**변수의 초기화:** 변수를 선언하고 처음으로 값을 저장하는 것

| 변수 종류 | 초기화 필수 여부 | 기본값 자동 할당 |
|:---------|:----------------|:---------------|
| 지역 변수 | **필수** | ✗ (사용 전 반드시 초기화) |
| 멤버 변수 | 선택 | ✓ (자동으로 기본값 할당) |

**멤버 변수의 기본값:**

| 타입 | 기본값 |
|:-----|:------|
| boolean | false |
| char | '\u0000' |
| byte, short, int | 0 |
| long | 0L |
| float | 0.0f |
| double | 0.0d |
| 참조형 | null |

---

### 6.2 멤버변수의 초기화 방법

1. **명시적 초기화 (Explicit Initialization)**
2. **생성자 (Constructor)**
3. **초기화 블럭 (Initialization Block)**
   - 인스턴스 초기화 블럭
   - 클래스 초기화 블럭

---

### 6.3 명시적 초기화

가장 기본적인 초기화 방법. 변수 선언과 동시에 초기화.

```java
class Car {
    int door = 4;                    // 기본형 초기화
    String color = "white";          // 참조형 초기화
    Engine engine = new Engine();    // 객체 생성
}
```

---

### 6.4 초기화 블럭

복잡한 초기화 작업이 필요할 때 사용.

```java
class InitBlock {
    static int cv;     // 클래스 변수
    int iv;            // 인스턴스 변수

    // 클래스 초기화 블럭 (static 블럭)
    static {
        cv = 10;
        System.out.println("클래스 초기화 블럭 실행");
    }

    // 인스턴스 초기화 블럭
    {
        iv = 20;
        System.out.println("인스턴스 초기화 블럭 실행");
    }

    // 생성자
    InitBlock() {
        System.out.println("생성자 실행");
    }
}
```

**특징:**
- 클래스 초기화 블럭: 클래스가 메모리에 로딩될 때 **한 번만** 실행
- 인스턴스 초기화 블럭: 인스턴스 생성 시마다 실행, **생성자보다 먼저** 실행

**사용 시점:**
- 인스턴스 초기화 블럭: 모든 생성자에서 공통으로 수행해야 할 코드

```java
class Car {
    static int count = 0;  // 생성된 Car의 개수

    String color;
    String gearType;

    // 인스턴스 초기화 블럭 (모든 생성자에서 공통 수행)
    {
        count++;  // 인스턴스 생성 시마다 증가
        System.out.println("Car 생성됨. 총 " + count + "대");
    }

    Car() {
        this("white", "auto");
    }

    Car(String color, String gearType) {
        this.color = color;
        this.gearType = gearType;
    }
}
```

---

### 6.5 멤버변수의 초기화 시기와 순서

#### 초기화 시점

- **클래스 변수**: 클래스가 처음 메모리에 로딩될 때 **단 한 번**
- **인스턴스 변수**: 인스턴스가 생성될 때마다

#### 초기화 순서

```
클래스 변수: 기본값 → 명시적 초기화 → 클래스 초기화 블럭

인스턴스 변수: 기본값 → 명시적 초기화 → 인스턴스 초기화 블럭 → 생성자
```

**예제:**

```java
class InitTest {
    static int cv = 1;   // 명시적 초기화
    int iv = 1;          // 명시적 초기화

    static { cv = 2; }   // 클래스 초기화 블럭
    { iv = 2; }          // 인스턴스 초기화 블럭

    InitTest() {         // 생성자
        iv = 3;
    }
}
```

**실행 순서:**

```
[클래스 로딩 시 - 한 번만]
1. cv = 0     (기본값)
2. cv = 1     (명시적 초기화)
3. cv = 2     (클래스 초기화 블럭)

[인스턴스 생성 시 - 매번]
4. iv = 0     (기본값)
5. iv = 1     (명시적 초기화)
6. iv = 2     (인스턴스 초기화 블럭)
7. iv = 3     (생성자)

최종 결과: cv = 2, iv = 3
```

---

## 7. 요약

### 핵심 개념 정리

| 개념 | 핵심 내용 |
|:-----|:---------|
| **클래스** | 객체의 설계도 |
| **객체/인스턴스** | 클래스로부터 생성된 실체 |
| **속성** | 멤버변수로 표현 |
| **기능** | 메서드로 표현 |
| **인스턴스 변수** | 각 인스턴스마다 독립적인 저장공간 |
| **클래스 변수** | 모든 인스턴스가 공유하는 변수 (static) |
| **지역 변수** | 메서드 내에서만 유효한 변수 |
| **메서드** | 특정 작업을 수행하는 코드 묶음 |
| **오버로딩** | 같은 이름, 다른 매개변수의 메서드 여러 개 |
| **생성자** | 인스턴스 초기화 메서드 |
| **this** | 인스턴스 자신을 가리키는 참조변수 |
| **this()** | 같은 클래스의 다른 생성자 호출 |

{{< callout type="info" >}}
**객체지향의 핵심:**
- **재사용성**: 코드를 재사용하여 생산성 향상
- **유지보수**: 코드 관리가 용이하고 수정이 간편
- **중복 제거**: 중복 코드를 줄여 일관성 유지
{{< /callout >}}
