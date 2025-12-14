---
title: "Chapter 01. 자바 시작하기"
weight: 1
---

## 1. 자바(Java)란?

썬 마이크로시스템즈에서 1996년 발표한 **객체지향 프로그래밍 언어**.

> **핵심 철학**: *"Write Once, Run Anywhere"* - 한 번 작성하면 어디서나 실행

---

## 2. 자바의 주요 특징

| 특징 | 설명 |
|------|------|
| **플랫폼 독립성** | JVM 위에서 실행되어 OS에 관계없이 동작 |
| **객체지향** | 상속, 캡슐화, 다형성 지원 |
| **자동 메모리 관리** | Garbage Collector가 메모리 자동 해제 |
| **멀티스레드** | 언어 레벨에서 멀티스레드 지원 |
| **동적 로딩** | 필요한 시점에 클래스 로드 (Lazy Loading) |

### 플랫폼 독립성 원리

```
┌─────────────────┐
│  Java 소스코드   │  Hello.java
└────────┬────────┘
         │ javac (컴파일)
         ▼
┌─────────────────┐
│   바이트코드     │  Hello.class
└────────┬────────┘
         │ java (실행)
         ▼
┌─────────────────┐
│      JVM        │  OS별로 다른 JVM
└────────┬────────┘
         ▼
┌─────────────────┐
│    운영체제      │  Windows / Linux / macOS
└─────────────────┘
```

**자바 프로그램은 OS 독립적이지만, JVM은 OS에 종속적이다.**

---

## 3. JVM (Java Virtual Machine)

자바 바이트코드를 실행하는 가상 머신.

### JVM 구성 요소

```
┌────────────────────────────────────────┐
│                 JVM                     │
├─────────────┬─────────────┬────────────┤
│ Class Loader│ Runtime     │ Execution  │
│             │ Data Area   │ Engine     │
│ .class 로드  │ 메모리 영역   │ 바이트코드  │
│             │             │ 실행        │
└─────────────┴─────────────┴────────────┘
```

### JIT 컴파일러 (Just-In-Time)

초기 자바는 인터프리터 방식으로 느렸지만, **JIT 컴파일러**가 도입되어 성능이 크게 개선됨.

```
인터프리터: 바이트코드 → 한 줄씩 해석 → 실행 (느림)
JIT 컴파일러: 바이트코드 → 기계어로 컴파일 → 캐싱 → 실행 (빠름)
```

- **HotSpot**: 자주 실행되는 코드(Hot Code)를 감지하여 네이티브 코드로 컴파일

---

## 4. JDK vs JRE vs JVM

```
┌─────────────────────────────────────────┐
│                  JDK                     │
│  ┌───────────────────────────────────┐  │
│  │              JRE                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │           JVM               │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  + Java API (클래스 라이브러리)     │  │
│  └───────────────────────────────────┘  │
│  + 개발 도구 (javac, jar, javadoc 등)    │
└─────────────────────────────────────────┘
```

| 구분 | 설명 | 용도 |
|------|------|------|
| **JVM** | 바이트코드 실행 엔진 | 실행만 |
| **JRE** | JVM + Java API | 실행 환경 |
| **JDK** | JRE + 개발 도구 | 개발 환경 |

### 주요 JDK 도구

| 도구 | 설명 |
|------|------|
| `javac` | 컴파일러 (.java → .class) |
| `java` | 인터프리터 (바이트코드 실행) |
| `jar` | 압축 도구 (.jar 생성) |
| `javadoc` | API 문서 생성기 |
| `javap` | 역어셈블러 (디컴파일) |

---

## 5. Hello World 작성

### 소스 코드

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

### 컴파일 & 실행

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

---

## 6. main 메서드

```java
public static void main(String[] args)
```

| 키워드 | 의미 |
|--------|------|
| `public` | 어디서든 접근 가능 (JVM이 호출해야 하므로) |
| `static` | 객체 생성 없이 실행 가능 |
| `void` | 반환값 없음 |
| `String[] args` | 커맨드라인 인자 |

### 커맨드라인 인자 예제

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
       ↓
2. JVM 시작
       ↓
3. 클래스 로더가 Hello.class 로드
       ↓
4. 바이트코드 검증 (보안 체크)
       ↓
5. main(String[] args) 메서드 호출
       ↓
6. 프로그램 실행
       ↓
7. main 종료 시 프로그램 종료
```

---

## 8. 클래스와 소스파일 규칙

### 규칙

1. 모든 코드는 **클래스 안에** 존재해야 함
2. **소스파일명 = public 클래스명** (대소문자 일치)
3. public 클래스는 파일당 **하나만** 가능
4. 클래스파일(.class)은 **클래스마다 하나씩** 생성

### 예제: 하나의 파일에 여러 클래스

```java
// Example.java
public class Example {  // 파일명과 일치해야 함
    public static void main(String[] args) {
        System.out.println("Main class");
    }
}

class Helper {  // public이 아니므로 파일명과 달라도 됨
    void help() {
        System.out.println("Helper class");
    }
}
```

**컴파일 결과:**
```
Example.class
Helper.class   ← 클래스마다 별도 파일 생성
```

---

## 요약

| 항목 | 핵심 |
|------|------|
| Java | 플랫폼 독립적 객체지향 언어 |
| JVM | 바이트코드 실행 가상 머신 |
| JDK | 개발 도구 (JRE + 컴파일러 등) |
| 컴파일 | `javac 파일명.java` |
| 실행 | `java 클래스명` |
| main | 프로그램 진입점 (필수) |
