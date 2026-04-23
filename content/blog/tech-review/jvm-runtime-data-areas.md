---
title: "JVM 런타임 데이터 영역 정리"
weight: 1
---

JVM이 자바 프로그램 실행 중 메모리를 어떻게 나누어 관리하는지 정리한다.

---

## 개요

JVM은 프로그램 실행에 필요한 메모리를 여러 영역으로 나누어 관리한다. 각 영역은 고유한 목적과 생명주기를 가진다.

```
┌─────────────────────────────────────────────────────────────┐
│                  JVM 런타임 데이터 영역                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [스레드 공유 영역]                                         │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  힙 (Heap)              │  메서드 영역 (Method Area) │   │
│   │  - 객체 인스턴스 저장    │  - 클래스 메타데이터       │   │
│   │  - GC 대상              │  - 상수, 정적 변수         │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   [스레드 프라이빗 영역]                                      │
│   ┌─────────────┬─────────────┬─────────────────────────┐   │
│   │ PC Register │  JVM Stack  │  Native Method Stack    │   │
│   │ (명령어 주소)│ (스택 프레임)│  (JNI 코드 실행)        │   │
│   └─────────────┴─────────────┴─────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| 구분 | 영역 | 특징 |
|:----|:----|:----|
| 스레드 공유 | Heap, Method Area | JVM 시작 시 생성, 모든 스레드가 공유 |
| 스레드 프라이빗 | PC, JVM Stack, Native Stack | 스레드 생성/종료와 함께 생성/소멸 |

---

## 1. 프로그램 카운터 (PC Register)

현재 실행 중인 바이트코드 명령어의 주소를 저장하는 작은 메모리 영역이다.

### 왜 필요한가?

CPU는 한 번에 하나의 스레드만 실행할 수 있다. 멀티스레드 환경에서 스레드가 전환될 때, **이전에 어디까지 실행했는지** 기억해야 다시 이어서 실행할 수 있다. PC가 그 역할을 한다.

### 특징

| 항목 | 설명 |
|:----|:----|
| 스레드 프라이빗 | 각 스레드마다 독립적으로 존재 |
| Java 메서드 실행 시 | 현재 바이트코드 명령어 주소 저장 |
| Native 메서드 실행 시 | Undefined (정의되지 않음) |
| 예외 | **OOM이 발생하지 않는 유일한 영역** |

```
Thread 1: PC → 0x0012 (invokevirtual)
Thread 2: PC → 0x0045 (istore_2)

스레드 전환 시 각자의 PC 값으로 실행 위치 복원
```

---

## 2. JVM 스택 (Java Virtual Machine Stack)

자바 메서드 실행을 위한 메모리 영역이다. 메서드 호출마다 **스택 프레임**이 생성되어 push되고, 메서드 종료 시 pop된다.

### 스택 프레임 구성

```
┌───────────────────────────────────────────┐
│           스택 프레임 (Stack Frame)         │
├───────────────────────────────────────────┤
│  1. 지역 변수 테이블 (Local Variable Table) │
│     - 기본 타입, 객체 참조, 반환 주소       │
│     - 컴파일 타임에 크기 결정               │
├───────────────────────────────────────────┤
│  2. 피연산자 스택 (Operand Stack)          │
│     - 연산 중간 결과 임시 저장              │
├───────────────────────────────────────────┤
│  3. 동적 링크 (Dynamic Linking)            │
│     - 런타임 상수 풀의 메서드 참조 연결     │
├───────────────────────────────────────────┤
│  4. 반환 주소 (Return Address)             │
│     - 메서드 종료 후 돌아갈 위치            │
└───────────────────────────────────────────┘
```

### 지역 변수 슬롯

지역 변수 테이블은 **슬롯(Slot)** 단위로 데이터를 저장한다.

```java
public void method(int a, long b, Object c) {
    double d = 3.14;
}

// 슬롯 배치:
// [0] this  - 인스턴스 메서드는 0번에 this
// [1] a     - int (1슬롯)
// [2-3] b   - long (2슬롯)
// [4] c     - Object 참조 (1슬롯)
// [5-6] d   - double (2슬롯)
```

| 타입 | 슬롯 수 |
|:----|:-------|
| int, float, reference | 1 |
| long, double | 2 |

### 관련 예외

| 예외 | 발생 조건 |
|:----|:---------|
| **StackOverflowError** | 스택 깊이가 허용 한계 초과 (무한 재귀 등) |
| **OutOfMemoryError** | 스택 확장 시 메모리 부족 |

```java
// StackOverflowError 예시
public void recursive() {
    recursive();  // 무한 재귀 → StackOverflowError
}
```

---

## 3. 네이티브 메서드 스택 (Native Method Stack)

JNI(Java Native Interface)를 통해 호출되는 **C/C++ 네이티브 코드**를 실행하기 위한 스택이다.

| 항목 | 설명 |
|:----|:----|
| 용도 | 네이티브 메서드 실행 |
| HotSpot JVM | JVM 스택과 통합하여 관리 |
| 예외 | StackOverflowError, OutOfMemoryError |

---

## 4. 힙 (Heap)

**거의 모든 객체 인스턴스**가 할당되는 영역이다. GC(Garbage Collection)의 주요 대상이다.

### 세대별 구조

힙은 **세대별 수집 이론(Generational Collection)**에 따라 영역을 나눈다.

```
┌─────────────────────────────────────────────────────────────┐
│                           Heap                              │
├──────────────────────────────┬──────────────────────────────┤
│       Young Generation       │       Old Generation         │
│           (1/3)              │           (2/3)              │
│  ┌─────────────────────────┐ │                              │
│  │         Eden (8)        │ │                              │
│  ├────────────┬────────────┤ │         Tenured              │
│  │  S0 (1)    │   S1 (1)   │ │    (장기 생존 객체)          │
│  └────────────┴────────────┘ │                              │
└──────────────────────────────┴──────────────────────────────┘
```

| 영역 | 설명 |
|:----|:----|
| **Eden** | 새 객체가 생성되는 곳 |
| **Survivor (S0, S1)** | Minor GC에서 살아남은 객체가 이동 |
| **Old (Tenured)** | 여러 번 GC를 견딘 객체가 승격(Promotion) |

### TLAB (Thread Local Allocation Buffer)

멀티스레드 환경에서 **동기화 오버헤드 없이** 객체를 빠르게 할당하기 위한 기법이다.

```
각 스레드가 Eden 내에 자신만의 할당 버퍼를 가짐
→ TLAB 내에서는 동기화 없이 할당
→ TLAB이 차면 새 TLAB 할당 (이때만 동기화)
```

### 주요 JVM 옵션

```bash
-Xms512m          # 초기 힙 크기
-Xmx1024m         # 최대 힙 크기
-XX:NewRatio=2    # Young:Old = 1:2
-XX:SurvivorRatio=8  # Eden:Survivor = 8:1
```

---

## 5. 메서드 영역 (Method Area)

**클래스 메타데이터, 상수, 정적 변수, JIT 컴파일 코드**를 저장한다. Non-Heap 영역이라고도 부른다.

### PermGen → Metaspace 변화

| 구분 | PermGen (JDK 7 이전) | Metaspace (JDK 8 이후) |
|:----|:-------------------|:---------------------|
| 위치 | JVM 힙 내부 | 네이티브 메모리 |
| 크기 | 고정 (MaxPermSize) | 기본 무제한 |
| String Pool | PermGen 내부 | Heap으로 이동 |
| OOM 메시지 | PermGen space | Metaspace |

{{< callout type="info" >}}
**JDK 8에서 PermGen이 제거된 이유**
- 고정 크기로 인한 OOM 빈번 발생
- 클래스 메타데이터 크기 예측 어려움
- Metaspace는 네이티브 메모리를 사용하여 유연하게 확장
{{< /callout >}}

### 주요 JVM 옵션 (JDK 8+)

```bash
-XX:MetaspaceSize=128m      # 초기 크기
-XX:MaxMetaspaceSize=256m   # 최대 크기 (기본: 무제한)
```

---

## 6. 런타임 상수 풀 (Runtime Constant Pool)

메서드 영역의 일부로, 클래스 파일의 **상수 풀(Constant Pool)**이 런타임에 로드되는 영역이다.

### 저장 내용

- **리터럴**: 숫자, 문자열 상수
- **심벌 참조**: 클래스, 필드, 메서드의 이름과 디스크립터

### 동적 특성

컴파일타임 상수만 저장하는 클래스 파일의 상수 풀과 달리, **런타임에 새로운 상수를 추가**할 수 있다.

```java
String s = new StringBuilder("Hello").append("World").toString();
s.intern();  // 런타임에 "HelloWorld"를 상수 풀에 추가
```

---

## 정리

| 영역 | 스레드 공유 | 주요 저장 내용 | 발생 가능 예외 |
|:----|:----------|:-------------|:-------------|
| PC Register | X | 현재 명령어 주소 | 없음 |
| JVM Stack | X | 스택 프레임 (지역변수, 피연산자) | SOF, OOM |
| Native Method Stack | X | 네이티브 메서드 프레임 | SOF, OOM |
| Heap | O | 객체 인스턴스 | OOM |
| Method Area | O | 클래스 메타데이터, 상수, 정적 변수 | OOM |
| Runtime Constant Pool | O | 리터럴, 심벌 참조 | OOM |

{{< callout type="warning" >}}
**OOM 발생 시 확인 사항**
- Heap OOM: 메모리 누수 또는 힙 크기 부족
- Metaspace OOM: 동적 클래스 생성 과다 (프록시, CGLib 등)
- Stack Overflow: 재귀 호출 깊이 또는 스택 프레임 크기
{{< /callout >}}

---

## 참고

- [Oracle JVM Specification - Runtime Data Areas](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.5)
- [Understanding JVM Memory Model](https://www.baeldung.com/java-jvm-memory-model)
