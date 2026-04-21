---
title: "Chapter 01. 자바 시작하기"
weight: 1
---

자바 언어의 탄생 배경, 플랫폼 독립성의 원리, JVM/JRE/JDK의 관계, 그리고 첫 프로그램을 실행하기까지의 흐름을 다룬다.

---

## 1. 자바(Java)란?

썬 마이크로시스템즈(Sun Microsystems)가 1995년 공개하고 1996년에 정식 발표한 **객체지향 프로그래밍 언어**이다. 현재는 오라클(Oracle)이 관리하며, OpenJDK를 비롯한 다수의 구현체가 존재한다.

> **핵심 철학**: *Write Once, Run Anywhere* — 한 번 작성하면 어디서나 실행된다.

이 철학은 "컴파일 결과물이 OS마다 달라지지 않는다"는 의미이다. 즉 **`.class` 파일(바이트코드)** 하나면 Windows, Linux, macOS 어디서든 동일하게 실행할 수 있다.

---

## 2. 자바의 주요 특징

| 특징 | 설명 |
|:-----|:-----|
| 플랫폼 독립성 | JVM 위에서 실행되어 OS에 관계없이 동작한다 |
| 객체지향 | 상속, 캡슐화, 다형성을 언어 차원에서 지원 |
| 자동 메모리 관리 | Garbage Collector가 사용하지 않는 객체를 자동 해제 |
| 멀티스레드 | 언어 레벨에서 `Thread`와 동기화 문법 제공 |
| 동적 로딩 | 클래스는 필요한 시점에 로드된다 (Lazy Loading) |
| 풍부한 표준 라이브러리 | 컬렉션, IO, 네트워크, 동시성 등 기본 제공 |

### 2.1 플랫폼 독립성 원리

```
 ┌──────────────┐
 │ Java 소스코드 │ Hello.java
 └──────┬───────┘
        │ javac (컴파일)
        ▼
 ┌──────────────┐
 │  바이트코드   │ Hello.class
 └──────┬───────┘
        │ java (실행)
        ▼
 ┌──────────────┐
 │     JVM      │ OS별로 다른 JVM
 └──────┬───────┘
        ▼
 ┌──────────────┐
 │    운영체제   │ Win/Linux/mac
 └──────────────┘
```

{{< callout type="info" >}}
**자바 프로그램은 OS 독립적이지만, JVM은 OS에 종속적이다.** 개발자는 동일한 `.class` 파일을 배포하면 되지만, 각 OS에 맞는 JVM(JRE)은 반드시 설치되어 있어야 한다.
{{< /callout >}}

---

## 3. JVM (Java Virtual Machine)

자바 바이트코드를 실행하는 **가상 머신**이다. 물리적 CPU가 기계어를 해석하듯, JVM은 바이트코드를 해석해서 실제 기계어로 실행한다.

### 3.1 JVM 구성 요소

```
┌──────────────────────────────┐
│            JVM                │
├─────────┬─────────┬──────────┤
│ Class   │ Runtime │Execution │
│ Loader  │ Data    │ Engine   │
│         │ Area    │          │
│ .class  │ 메모리   │바이트코드│
│ 로드    │ 영역    │ 실행     │
└─────────┴─────────┴──────────┘
```

- **Class Loader**: `.class` 파일을 읽어 메모리에 올린다
- **Runtime Data Area**: 힙(Heap), 스택(Stack), 메서드 영역 등 런타임 메모리
- **Execution Engine**: 바이트코드를 해석하거나 기계어로 컴파일해서 실행

### 3.2 JIT 컴파일러 (Just-In-Time)

초기 자바는 인터프리터 방식만 사용해 속도가 느렸지만, **JIT 컴파일러**가 도입되어 성능이 크게 개선되었다.

```
인터프리터:
  바이트코드 → 한 줄씩 해석 → 실행 (느림)

JIT 컴파일러:
  자주 실행되는 코드 → 기계어로 컴파일
  → 캐싱 → 재사용 (빠름)
```

- **HotSpot**: Oracle JVM의 JIT 구현. 자주 실행되는 코드(Hot Code)를 감지해 네이티브 코드로 컴파일하여 캐시한다.

{{< callout type="info" >}}
**JIT 덕분에 자바는 C/C++에 근접한 성능을 낸다.** 처음 실행 시에는 인터프리터로 동작하다가 반복 호출되는 지점부터 기계어로 치환되기 때문에, 긴 시간 돌아가는 서버 애플리케이션일수록 이득이 크다.
{{< /callout >}}

---

## 4. JDK vs JRE vs JVM

세 개념은 포함 관계이다. JDK는 JRE를 포함하고, JRE는 JVM을 포함한다.

```
┌────────────────────────────┐
│           JDK               │
│  ┌──────────────────────┐  │
│  │         JRE           │  │
│  │  ┌────────────────┐  │  │
│  │  │      JVM        │  │  │
│  │  └────────────────┘  │  │
│  │  + Java API          │  │
│  └──────────────────────┘  │
│  + 개발 도구 (javac 등)     │
└────────────────────────────┘
```

| 구분 | 구성 | 용도 |
|:-----|:-----|:-----|
| JVM | 바이트코드 실행 엔진 | 실행만 |
| JRE | JVM + Java API (표준 라이브러리) | 실행 환경 |
| JDK | JRE + 개발 도구 | 개발 환경 |

### 4.1 주요 JDK 도구

| 도구 | 설명 |
|:-----|:-----|
| `javac` | 컴파일러 (`.java` → `.class`) |
| `java` | 런처 (바이트코드 실행) |
| `jar` | 아카이브 도구 (`.jar` 생성) |
| `javadoc` | API 문서 생성기 |
| `javap` | 역어셈블러 (바이트코드 확인) |
| `jshell` | REPL (Java 9+) |

{{< callout type="info" >}}
**Java 11부터 별도의 JRE 배포는 종료되었다.** 이제 JDK만 배포되며, 애플리케이션 단위로 `jlink`를 사용해 필요한 모듈만 포함한 커스텀 런타임을 만드는 것이 권장된다.
{{< /callout >}}

---

## 5. Hello World 작성

### 5.1 소스 코드

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

### 5.2 컴파일 & 실행

```bash
# 컴파일: .java → .class
javac Hello.java

# 실행: .class 파일 실행 (확장자 없이)
java Hello
```

**출력:**

```
Hello, World!
```

{{< callout type="info" >}}
**Java 11+에서는 단일 파일 소스 실행이 가능하다.** `java Hello.java`처럼 `.java` 파일을 바로 실행하면 내부적으로 컴파일 후 실행된다. 간단한 스크립트를 돌릴 때 유용하다.
{{< /callout >}}

---

## 6. main 메서드

JVM이 프로그램을 시작할 때 **가장 먼저 호출하는 메서드**이다. 시그니처가 정확히 일치해야 한다.

```java
public static void main(String[] args)
```

| 키워드 | 의미 |
|:------|:-----|
| `public` | 어디서든 접근 가능 (JVM이 외부에서 호출하므로 필요) |
| `static` | 객체 생성 없이 클래스 이름만으로 호출 가능 |
| `void` | 반환값 없음 (종료 코드는 `System.exit()`로 별도 지정) |
| `String[] args` | 커맨드라인 인자 배열 |

### 6.1 JVM은 main을 어떻게 찾는가

`java Hello` 명령을 실행하면 JVM은 다음 순서로 동작한다.

1. `Hello` 클래스를 클래스패스에서 찾아 클래스 로더가 메모리에 적재
2. 해당 클래스에 `public static void main(String[])`가 존재하는지 확인
3. 없으면 `Main method not found` 오류로 종료
4. 있으면 커맨드라인 인자를 `String[]`로 묶어 전달하며 호출

### 6.2 커맨드라인 인자 예제

```java
public class ArgsExample {
    public static void main(String[] args) {
        for (int i = 0; i < args.length; i++) {
            System.out.println("args[" + i + "]: " + args[i]);
        }
    }
}
```

```bash
java ArgsExample Hello World Java
```

**출력:**

```
args[0]: Hello
args[1]: World
args[2]: Java
```

---

## 7. 자바 프로그램 실행 과정

```
1. java Hello 실행
       │
       ▼
2. JVM 시작
       │
       ▼
3. Class Loader가
   Hello.class 로드
       │
       ▼
4. 바이트코드 검증
   (Verifier: 보안 체크)
       │
       ▼
5. main 메서드 호출
       │
       ▼
6. 프로그램 실행
       │
       ▼
7. main 종료 → JVM 종료
```

{{< callout type="info" >}}
**검증(Verifier) 단계가 왜 필요한가?** 바이트코드는 JVM 외부에서 조작될 수 있으므로, 타입 안정성·스택 균형·접근 권한 등을 사전에 검사해 잘못된 코드가 JVM을 망가뜨리지 못하도록 한다.
{{< /callout >}}

---

## 8. 클래스와 소스파일 규칙

### 8.1 규칙

1. 모든 코드는 **클래스 안에** 존재해야 한다
2. **소스파일명과 public 클래스명은 대소문자까지 일치**해야 한다
3. public 클래스는 파일당 **최대 하나**만 둘 수 있다
4. 클래스 파일(`.class`)은 **클래스마다 하나씩** 생성된다

### 8.2 하나의 파일에 여러 클래스

```java
// Example.java
public class Example {          // 파일명과 일치
    public static void main(String[] args) {
        System.out.println("Main class");
    }
}

class Helper {                  // public이 아니므로 파일명과 달라도 됨
    void help() {
        System.out.println("Helper class");
    }
}
```

**컴파일 결과:**

```
Example.class
Helper.class    ← 클래스마다 별도 파일 생성
```

{{< callout type="warning" >}}
**Java 21+에서는 간단한 스크립트라면 클래스 선언을 생략할 수 있다.** JEP 445(Unnamed Classes and Instance Main Methods) 이후 `void main() { ... }`만 있는 `.java` 파일도 실행된다. 학습이나 빠른 프로토타이핑에 유용하지만, 실무 코드에는 여전히 `public class`를 사용하는 것이 표준이다.
{{< /callout >}}

---

## 9. 요약

| 항목 | 핵심 |
|:-----|:-----|
| Java | 플랫폼 독립적 객체지향 언어 |
| JVM | 바이트코드 실행 가상 머신 |
| JRE | JVM + 표준 라이브러리 (실행 환경) |
| JDK | JRE + 개발 도구 (개발 환경) |
| 컴파일 | `javac 파일명.java` |
| 실행 | `java 클래스명` |
| `main` | `public static void main(String[])` — 프로그램 진입점 |
