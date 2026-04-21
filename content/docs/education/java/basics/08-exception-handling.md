---
title: "Chapter 08. 예외처리 (Exception Handling)"
weight: 8
---

실행 중 발생할 수 있는 예외 상황을 감지·복구·전파하는 방법과, 안전한 자원 해제 및 사용자 정의 예외 작성법을 다룬다.

---

## 1. 프로그램 오류

### 1.1 오류의 종류

| 종류 | 발생 시점 | 설명 | 예시 |
|:---|:---|:---|:---|
| 컴파일 에러 | 컴파일 시 | 문법 오류, 타입 불일치 | 세미콜론 누락 |
| 런타임 에러 | 실행 시 | 실행 중 발생 | `ArrayIndexOutOfBoundsException` |
| 논리적 에러 | 실행 시 | 의도와 다른 동작 | 잘못된 계산 결과 |

```java
// 런타임 에러
int[] arr = new int[5];
System.out.println(arr[10]);   // ArrayIndexOutOfBoundsException

// 논리적 에러
int sum = 0;
for (int i = 1; i < 10; i++) sum += i;   // 1~9만 더함 (의도: 1~10)
```

### 1.2 에러(Error)와 예외(Exception)

자바에서는 런타임 오류를 **에러**와 **예외**로 구분한다.

| 구분 | 설명 | 복구 |
|:---|:---|:---|
| 에러 (Error) | `OutOfMemoryError`, `StackOverflowError` 등 시스템 수준의 치명적 문제 | 불가능 |
| 예외 (Exception) | 코드에서 처리 가능한 비정상 상황 | 가능 |

예외 처리의 목표는 **프로그램의 비정상 종료를 막고 정상 흐름을 유지**하는 것이다.

---

## 2. 예외 클래스의 계층구조

### 2.1 계층 구조도

```
         Object
            │
        Throwable
         ┌──┴──┐
       Error  Exception
              ┌──┴────────────┐
              │               │
   (Checked)            RuntimeException
  IOException                │  (Unchecked)
  SQLException     NullPointerException
                   ArithmeticException
                   IndexOutOfBoundsException
                   ClassCastException
```

- `Throwable`: 모든 예외·에러의 최상위 조상. `getMessage()`, `printStackTrace()` 등을 정의
- `Error`: JVM 수준 문제, 처리하지 않는 것이 일반적
- `Exception`: 애플리케이션에서 처리할 수 있는 예외
- `RuntimeException`: `Exception`의 자손이지만 **Unchecked**로 분류됨

### 2.2 Checked vs Unchecked

| 그룹 | 최상위 | 컴파일러 체크 | 예외 처리 |
|:---|:---|:---|:---|
| Checked Exception | `Exception` (RuntimeException 제외) | O | 필수 (try-catch 또는 throws) |
| Unchecked Exception | `RuntimeException` | X | 선택 |

**Checked 예시**

```java
public void readFile() throws IOException {
    FileReader r = new FileReader("test.txt");   // 반드시 처리/선언
}
```

**Unchecked 예시**

```java
String s = null;
s.length();                       // NullPointerException
int x = 10 / 0;                   // ArithmeticException
int[] a = new int[5]; a[10] = 1;  // ArrayIndexOutOfBoundsException
```

{{< callout type="info" >}}
**Checked vs Unchecked 선택 기준**

- **Checked**: 호출자가 반드시 인식해야 하는, 외부 요인에 의한 예외 (파일 없음, 네트워크 장애, DB 연결 실패 등). 호출자가 복구 전략을 세울 수 있는 경우.
- **Unchecked**: 프로그래머의 버그로 간주되는 상황, 또는 모든 지점에서 강제 처리가 부담스러운 경우 (잘못된 인자, 잘못된 상태, 산술 오류 등).

최근 추세는 **Unchecked 위주**다. 체크 예외를 남발하면 `throws` 선언이 호출 체인을 타고 퍼지면서 설계가 경직된다.
{{< /callout >}}

---

## 3. try-catch문

### 3.1 기본 구조

```java
try {
    // 예외가 발생할 가능성이 있는 문장들
} catch (ExceptionType1 e1) {
    // ExceptionType1 처리
} catch (ExceptionType2 e2) {
    // ExceptionType2 처리
}
```

{{< callout type="warning" >}}
try/catch 블록은 문장이 하나뿐이어도 **`{}` 생략 불가**다.
{{< /callout >}}

### 3.2 실행 흐름

**예외 발생 시:** try 블록에서 예외 발생 지점부터 건너뛰고 일치하는 catch로 이동 → catch 실행 후 try-catch 이후 코드 진행.

```java
System.out.println("시작");
try {
    System.out.println("try 진입");
    int r = 10 / 0;                    // 예외 발생
    System.out.println("도달 X");
} catch (ArithmeticException e) {
    System.out.println("처리: " + e.getMessage());
}
System.out.println("계속");
```

```
출력:
시작
try 진입
처리: / by zero
계속
```

**예외 미발생 시:** catch 블록은 건너뛴다.

### 3.3 여러 catch 블록

```java
try {
    // ...
} catch (ArithmeticException e)             { /* 산술 */ }
catch (ArrayIndexOutOfBoundsException e)     { /* 인덱스 */ }
catch (Exception e)                          { /* 그 외 모든 예외 */ }
```

{{< callout type="warning" >}}
**catch 순서: 구체적인 예외가 먼저.** 상위(`Exception`)를 먼저 두면 그 뒤에 있는 자손 catch는 **도달 불가(unreachable)**가 되어 컴파일 에러가 발생한다.

```java
try { /* ... */ }
catch (Exception e)           { /* 모든 예외 */ }
catch (ArithmeticException e) { /* 도달 불가 — 컴파일 에러 */ }
```
{{< /callout >}}

---

## 4. 예외 정보 얻기

### 4.1 주요 메서드

| 메서드 | 반환 | 설명 |
|:---|:---|:---|
| `getMessage()` | `String` | 예외 메시지 |
| `printStackTrace()` | `void` | 스택 트레이스를 표준 에러로 출력 |
| `getStackTrace()` | `StackTraceElement[]` | 스택 트레이스 배열 |
| `getCause()` | `Throwable` | 원인 예외 |

```java
try {
    method1();
} catch (Exception e) {
    System.out.println(e.getMessage());
    e.printStackTrace();

    for (StackTraceElement el : e.getStackTrace()) {
        System.out.println("  at " + el);
    }
}
```

### 4.2 멀티 catch 블록 (JDK 1.7+)

하나의 catch에서 여러 예외를 처리한다.

```java
try {
    // ...
} catch (IOException | SQLException e) {
    e.printStackTrace();
}
```

{{< callout type="warning" >}}
**멀티 catch 제약**

1. `|`로 연결된 예외가 **조상-자손 관계면 컴파일 에러** (조상만 쓰면 됨)
2. `e`로 접근할 수 있는 것은 **공통 조상의 멤버**뿐
3. `e`는 묵시적으로 `final` — 재할당 불가
{{< /callout >}}

---

## 5. 예외 발생시키기 — throw

### 5.1 throw 키워드

예외 객체를 직접 생성해서 `throw`로 던진다.

```java
throw new IllegalArgumentException("음수는 허용되지 않습니다: " + n);
```

### 5.2 실전 예시

```java
public class Account {
    private int balance;

    public void deposit(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("입금액은 0보다 커야 합니다");
        }
        balance += amount;
    }

    public void withdraw(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("출금액은 0보다 커야 합니다");
        }
        if (balance < amount) {
            throw new IllegalStateException(
                "잔액 부족. balance=" + balance + ", 요청=" + amount);
        }
        balance -= amount;
    }
}
```

### 5.3 Checked vs Unchecked throw

```java
// Checked: 반드시 처리하거나 throws 선언
public void a() throws Exception {
    throw new Exception("checked");
}

// Unchecked: 선언 없이도 가능
public void b() {
    throw new RuntimeException("unchecked");
}
```

---

## 6. throws — 메서드에 예외 선언하기

### 6.1 문법

```java
반환타입 메서드명(매개변수) throws 예외1, 예외2 { /* ... */ }
```

`throws` 에 선언된 예외는 **메서드가 처리하지 않고 호출자에게 넘긴다**는 의미다.

### 6.2 예외 전파 (Exception Propagation)

예외는 처리되지 않으면 호출 스택을 거슬러 올라간다. 어떤 메서드도 처리하지 않으면 JVM이 최종적으로 프로그램을 종료시킨다.

```java
static void main(String[] a) {
    try { method1(); }
    catch (Exception e) { /* 최종 처리 */ }
}

static void method1() throws Exception { method2(); }
static void method2() throws Exception { throw new Exception("원인"); }
```

```
   예외 발생
        │
   ┌─────────┐
   │ method2 │  throws Exception
   └────┬────┘
        ▼ 전파
   ┌─────────┐
   │ method1 │  throws Exception
   └────┬────┘
        ▼ 전파
   ┌─────────┐
   │  main   │  try-catch로 처리
   └─────────┘
```

{{< callout type="info" >}}
**throws 전파 규칙**

- 호출 체인에서 **한 메서드라도 Checked 예외를 던질 수 있으면**, 그 윗단 메서드들은 모두 같은 예외를 선언하거나 처리해야 한다.
- 오버라이딩할 때 **자손 메서드는 조상보다 많은 Checked 예외를 선언할 수 없다.** 조상 타입으로 호출하는 코드가 깨질 수 있기 때문이다.
{{< /callout >}}

### 6.3 처리 위치 결정

```java
// 1) 여기서 복구 가능 → 직접 처리
public void processFile() {
    try { readFile("data.txt"); }
    catch (IOException e) { /* 기본값으로 대체 */ }
}

// 2) 상위에서 정책 결정 → 전파
public void processFile() throws IOException {
    readFile("data.txt");
}

// 3) 로깅 후 다시 던지기
public void processFile() throws IOException {
    try { readFile("data.txt"); }
    catch (IOException e) {
        log.error("읽기 실패", e);
        throw e;
    }
}
```

---

## 7. finally 블록

### 7.1 finally의 역할

예외 발생 여부와 무관하게 **항상 실행**되어야 하는 코드(자원 정리 등)를 넣는다.

```java
try {
    // ...
} catch (Exception e) {
    // ...
} finally {
    // 정리 코드
}
```

| 상황 | 실행 순서 |
|:---|:---|
| 예외 발생 | try(발생 시점까지) → catch → finally |
| 예외 없음 | try → finally |
| return 있음 | try/catch의 return 계산 → finally → 반환 |

### 7.2 finally와 return

```java
static int test() {
    try { return 1; }
    finally { System.out.println("finally"); }
}
// 출력: finally
// 반환: 1
```

{{< callout type="warning" >}}
**finally 에서 `return`/`throw` 는 피하자.** try/catch의 반환값이나 던진 예외를 덮어써서 디버깅이 매우 어려워진다.
{{< /callout >}}

### 7.3 전통적인 자원 정리 패턴

```java
FileReader reader = null;
try {
    reader = new FileReader(path);
    // ...
} catch (IOException e) {
    // ...
} finally {
    if (reader != null) {
        try { reader.close(); }
        catch (IOException ignore) { }
    }
}
```

---

## 8. try-with-resources

### 8.1 기존 방식의 문제점

- 코드가 길고 복잡하다
- `close()`에서도 예외가 발생할 수 있다
- `close()` 호출을 빠뜨리기 쉽다

### 8.2 try-with-resources 문법 (JDK 1.7+)

`try` 뒤 괄호 안에 선언한 자원은 **자동으로 `close()`가 호출**된다.

```java
try (FileInputStream fis = new FileInputStream("file.txt")) {
    // 작업
} catch (IOException e) {
    e.printStackTrace();
}
// fis.close()가 자동 호출됨
```

여러 자원은 세미콜론으로 구분한다.

```java
try (FileInputStream  fis = new FileInputStream("in.txt");
     FileOutputStream fos = new FileOutputStream("out.txt")) {
    int d;
    while ((d = fis.read()) != -1) fos.write(d);
}
// close 호출 순서: fos → fis (선언의 역순)
```

### 8.3 AutoCloseable 인터페이스

try-with-resources에 쓰려면 `AutoCloseable`을 구현해야 한다.

```java
public interface AutoCloseable {
    void close() throws Exception;
}

class MyResource implements AutoCloseable {
    @Override public void close() {
        System.out.println("해제");
    }
}
```

{{< callout type="info" >}}
**try-with-resources 를 우선 사용하자.** `finally` 기반 정리는 코드가 길고, close에서 예외가 발생하면 원본 예외를 삼켜버리기 쉽다. try-with-resources는 **원본 예외를 보존하고 close 예외는 "억제된 예외(suppressed)"로 첨부**한다.
{{< /callout >}}

### 8.4 억제된 예외 (Suppressed Exception)

try 블록과 `close()`에서 모두 예외가 발생하면, `close()`의 예외는 주 예외에 첨부된다.

```java
try (MyResource r = new MyResource()) {
    throw new RuntimeException("try 예외");
} catch (Exception e) {
    System.out.println("주: " + e.getMessage());
    for (Throwable s : e.getSuppressed()) {
        System.out.println("억제됨: " + s.getMessage());
    }
}
```

---

## 9. 사용자 정의 예외

### 9.1 예외 클래스 만들기

```java
// Checked
public class InsufficientBalanceException extends Exception {
    private final int balance;
    private final int amount;

    public InsufficientBalanceException(String msg, int balance, int amount) {
        super(msg);
        this.balance = balance;
        this.amount  = amount;
    }
    public int getBalance() { return balance; }
    public int getAmount()  { return amount; }
}

// Unchecked (최근 권장)
public class InvalidOrderException extends RuntimeException {
    public InvalidOrderException(String msg)                   { super(msg); }
    public InvalidOrderException(String msg, Throwable cause)  { super(msg, cause); }
}
```

### 9.2 활용

```java
public void withdraw(int amount) throws InsufficientBalanceException {
    if (amount > balance) {
        throw new InsufficientBalanceException("잔액 부족", balance, amount);
    }
    balance -= amount;
}
```

{{< callout type="info" >}}
**사용자 정의 예외의 실용 팁**

- 도메인 의미가 담긴 이름을 쓴다 (`OrderNotFoundException`, `PaymentFailedException`)
- 원인 예외를 받는 생성자를 꼭 제공한다 (`Throwable cause`)
- 꼭 필요한 정보(잔액, 주문ID 등)만 필드로 담는다
- 특별한 복구 전략이 없다면 기본 Unchecked로 설계한다
{{< /callout >}}

---

## 10. 예외 되던지기 (Re-throwing)

예외를 잡아 처리(로깅 등) 후 **다시 던져 상위에서도 대응**하게 한다.

```java
static void method1() throws Exception {
    try {
        throw new Exception("원본");
    } catch (Exception e) {
        log.error("로깅", e);
        throw e;                  // 되던지기
    }
}
```

서비스 계층에서 자주 쓰인다.

```java
public Order processOrder(Order o) throws OrderProcessingException {
    try {
        validate(o);
        return repository.save(o);
    } catch (ValidationException e) {
        log.error("검증 실패", e);
        throw new OrderProcessingException("주문 처리 실패", e);
    } catch (DatabaseException e) {
        log.error("DB 오류", e);
        throw new OrderProcessingException("주문 저장 실패", e);
    }
}
```

---

## 11. 연결된 예외 (Chained Exception)

### 11.1 원인 예외

한 예외가 다른 예외를 유발했을 때, 원래 예외를 **원인(cause)**으로 등록해서 정보를 보존한다.

```java
Throwable initCause(Throwable cause);   // 원인 설정
Throwable getCause();                   // 원인 조회
```

### 11.2 예외 감싸기 (wrapping)

```java
class ProcessException extends Exception {
    public ProcessException(String msg, Throwable cause) { super(msg, cause); }
}

static void startProcess() throws ProcessException {
    try { doSomething(); }
    catch (IOException e) {
        throw new ProcessException("프로세스 실패", e);   // 원인 포함
    }
}
```

### 11.3 Checked → Unchecked 변환

Checked 예외를 Unchecked로 감싸면 호출자의 `throws` 부담을 줄일 수 있다.

```java
public void process() {
    try { doIO(); }
    catch (IOException e) {
        throw new RuntimeException("처리 실패", e);
    }
}
```

---

## 12. 예외 처리 베스트 프랙티스

### 12.1 원칙

| 원칙 | 설명 |
|:---|:---|
| 구체적인 예외 | `Exception` 대신 구체 타입 사용 |
| 의미 있는 메시지 | 원인·상태·값을 메시지에 포함 |
| 원인 보존 | 감쌀 때 `cause`를 꼭 전달 |
| 처리 위치 | 실제로 처리할 수 있는 곳에서만 catch |
| 빈 catch 금지 | 최소한 로깅이라도 남긴다 |

### 12.2 안티 패턴

```java
// 예외 삼킴
try { doSomething(); }
catch (Exception e) { /* 아무것도 안 함 */ }

// 너무 넓은 catch
try { doSomething(); }
catch (Exception e) { e.printStackTrace(); }

// 원인 손실
try { doSomething(); }
catch (IOException e) { throw new RuntimeException("실패"); }   // cause 누락

// 정상 흐름에 예외 사용
try { value = Integer.parseInt(str); }
catch (NumberFormatException e) { value = 0; }
```

### 12.3 권장 패턴

```java
// 구체적인 예외부터
try { doSomething(); }
catch (FileNotFoundException e) { /* ... */ }
catch (IOException e)           { /* ... */ }

// 의미있는 메시지
throw new IllegalArgumentException("나이는 0 이상: 입력=" + age);

// 원인 보존
try { readFile(path); }
catch (IOException e) {
    throw new DataLoadException("로드 실패: " + path, e);
}

// 예외 전 검증
if (str != null && !str.isEmpty()) {
    value = Integer.parseInt(str);
}
```

---

## 13. 요약

| 개념 | 설명 |
|:---|:---|
| Exception / Error | 처리 가능한 오류 / 복구 불가한 치명 오류 |
| Checked / Unchecked | 컴파일러가 강제 / 선택적 처리 |
| try-catch | 예외 발생 시 분기 처리 |
| finally | 항상 실행, 자원 정리 |
| throws | 메서드가 던질 수 있는 예외 선언 |
| throw | 예외를 명시적으로 발생 |
| try-with-resources | 자원 자동 해제 (JDK 1.7+) |
| 연결된 예외 | 원인 보존, 타입 변환 |

**예외 처리 흐름**

```
예외 발생
    │
 ┌──┴────────────┐
 ▼               ▼
현재 메서드      호출자에게
try-catch       throws 전파
    │               │
    ▼               ▼
catch 실행      상위에서 처리
    │           또는 재전파
    ▼               │
finally ◀──────────┘
(있으면)
    │
    ▼
정상 흐름 재개
```

{{< callout type="info" >}}
**예외 처리의 5가지 핵심**

1. 예외는 **예측 가능한 비정상 상황**에 대비하는 도구다
2. 복구 가능하면 **try-catch**, 결정권이 호출자에게 있으면 **throws**
3. 자원은 **try-with-resources**로 안전하게 해제
4. 예외를 **감쌀 때는 원인(cause)을 반드시 보존**
5. 도메인에 의미를 주고 싶으면 **사용자 정의 예외**를 만든다
{{< /callout >}}
