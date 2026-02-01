---
title: "Chapter 08. 예외처리 (Exception Handling)"
weight: 8
---

# 예외처리 (Exception Handling)

프로그램 실행 중 발생할 수 있는 예외 상황에 대비하여 코드를 작성하는 방법을 다룬다.

---

## 1. 프로그램 오류

프로그램이 실행 중 어떤 원인에 의해서 오작동을 하거나 비정상적으로 종료되는 경우가 있다. 이러한 결과를 초래하는 원인을 **프로그램 에러** 또는 **오류**라고 한다.

### 1.1 오류의 종류

| 종류 | 발생 시점 | 설명 | 예시 |
|:-----|:---------|:-----|:-----|
| **컴파일 에러** | 컴파일 시 | 문법 오류, 타입 불일치 | 세미콜론 누락, 타입 오류 |
| **런타임 에러** | 실행 시 | 실행 중 발생하는 오류 | 0으로 나누기, null 참조 |
| **논리적 에러** | 실행 시 | 의도와 다른 동작 | 잘못된 계산 결과 |

```java
// 컴파일 에러 예시
int x = "hello";  // 타입 불일치

// 런타임 에러 예시
int[] arr = new int[5];
System.out.println(arr[10]);  // ArrayIndexOutOfBoundsException

// 논리적 에러 예시
int sum = 0;
for (int i = 1; i < 10; i++) {  // i <= 10이어야 함
    sum += i;
}
// 의도: 1~10 합계 (55), 실제: 1~9 합계 (45)
```

### 1.2 에러와 예외

자바에서는 실행 시(runtime) 발생할 수 있는 프로그램 오류를 **에러(Error)**와 **예외(Exception)**로 구분한다.

| 구분 | 설명 | 복구 가능 여부 |
|:-----|:-----|:-------------|
| **에러 (Error)** | 메모리 부족, 스택오버플로우 등 심각한 오류 | 복구 불가능 |
| **예외 (Exception)** | 코드에 의해 수습될 수 있는 오류 | 복구 가능 |

```java
// Error 예시 - 복구 불가능
public void infiniteRecursion() {
    infiniteRecursion();  // StackOverflowError
}

// Exception 예시 - 복구 가능
public void readFile(String path) {
    try {
        FileReader reader = new FileReader(path);
    } catch (FileNotFoundException e) {
        System.out.println("파일을 찾을 수 없습니다: " + path);
        // 대체 로직 수행 가능
    }
}
```

---

## 2. 예외 클래스의 계층구조

자바에서는 실행 시 발생할 수 있는 오류(Exception과 Error)를 클래스로 정의하였다.

### 2.1 계층 구조도

```
                      Object
                        │
                    Throwable
                   ┌────┴────┐
                Error      Exception
                  │           │
           ┌──────┴──────┐    ├─── IOException
           │             │    ├─── SQLException
    OutOfMemoryError  StackOverflowError
                              │
                              └─── RuntimeException
                                        │
                              ┌─────────┼─────────┐
                              │         │         │
               NullPointerException     │    IndexOutOfBoundsException
                       ArithmeticException
```

### 2.2 Exception 클래스의 두 그룹

| 그룹 | 상위 클래스 | 특징 | 예외 처리 |
|:-----|:-----------|:-----|:---------|
| **Checked Exception** | Exception | 외부 요인에 의해 발생 | **필수** (컴파일러 체크) |
| **Unchecked Exception** | RuntimeException | 프로그래머 실수에 의해 발생 | 선택 |

#### Checked Exception (컴파일러가 체크)

```java
// IOException - 파일 입출력 관련
public void readFile() throws IOException {
    FileReader reader = new FileReader("test.txt");  // 반드시 예외처리 필요
}

// SQLException - 데이터베이스 관련
public void queryDB() throws SQLException {
    Connection conn = DriverManager.getConnection(url);  // 반드시 예외처리 필요
}
```

#### Unchecked Exception (RuntimeException)

```java
// NullPointerException - null 참조
String str = null;
str.length();  // NullPointerException

// ArrayIndexOutOfBoundsException - 배열 인덱스 초과
int[] arr = new int[5];
arr[10] = 100;  // ArrayIndexOutOfBoundsException

// ArithmeticException - 산술 연산 오류
int result = 10 / 0;  // ArithmeticException

// ClassCastException - 잘못된 형변환
Object obj = new Integer(100);
String str = (String) obj;  // ClassCastException

// IllegalArgumentException - 잘못된 인자
Thread.sleep(-1000);  // IllegalArgumentException
```

{{< callout type="info" >}}
**Checked vs Unchecked 선택 기준:**
- **Checked Exception**: 호출자가 반드시 처리해야 하는 예외 (파일, 네트워크, DB 등)
- **Unchecked Exception**: 프로그래머의 실수로 발생하며 코드 수정으로 해결 가능한 예외
{{< /callout >}}

---

## 3. 예외처리하기 - try-catch문

### 3.1 예외처리의 정의와 목적

| 항목 | 내용 |
|:-----|:-----|
| **정의** | 프로그램 실행 시 발생할 수 있는 예외에 대비한 코드를 작성하는 것 |
| **목적** | 프로그램의 비정상 종료를 막고, 정상적인 실행 상태를 유지하는 것 |

### 3.2 try-catch문의 구조

```java
try {
    // 예외가 발생할 가능성이 있는 문장들
} catch (ExceptionType1 e1) {
    // ExceptionType1이 발생했을 경우 처리할 문장
} catch (ExceptionType2 e2) {
    // ExceptionType2가 발생했을 경우 처리할 문장
}
```

{{< callout type="warning" >}}
**주의:** if문과 달리 try블럭이나 catch블럭 내에 포함된 문장이 하나뿐이어도 괄호 `{}`를 생략할 수 없다.
{{< /callout >}}

### 3.3 실행 흐름

#### 예외가 발생한 경우

```java
public class ExceptionFlowExample {
    public static void main(String[] args) {
        System.out.println("프로그램 시작");  // 1. 실행

        try {
            System.out.println("try 블럭 시작");  // 2. 실행
            int result = 10 / 0;  // 3. 예외 발생!
            System.out.println("이 문장은 실행되지 않음");  // 건너뜀
        } catch (ArithmeticException e) {
            System.out.println("예외 처리: " + e.getMessage());  // 4. 실행
        }

        System.out.println("프로그램 계속 진행");  // 5. 실행
    }
}
```

**출력 결과:**
```
프로그램 시작
try 블럭 시작
예외 처리: / by zero
프로그램 계속 진행
```

#### 예외가 발생하지 않은 경우

```java
try {
    System.out.println("try 블럭 시작");  // 1. 실행
    int result = 10 / 2;  // 정상 실행
    System.out.println("결과: " + result);  // 2. 실행
} catch (ArithmeticException e) {
    System.out.println("이 블럭은 실행되지 않음");  // 건너뜀
}
System.out.println("프로그램 계속 진행");  // 3. 실행
```

### 3.4 여러 catch블럭 사용

```java
public class MultiCatchExample {
    public static void main(String[] args) {
        try {
            int[] arr = new int[5];
            arr[10] = 50 / 0;  // 어떤 예외가 먼저?
        } catch (ArithmeticException e) {
            System.out.println("산술 연산 예외: " + e.getMessage());
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("배열 인덱스 예외: " + e.getMessage());
        } catch (Exception e) {
            System.out.println("기타 예외: " + e.getMessage());
        }
    }
}
```

{{< callout type="danger" >}}
**catch 블럭 순서 주의:**
상위 예외 클래스가 먼저 오면 하위 예외는 도달 불가(unreachable)하여 컴파일 에러가 발생한다.
```java
// 잘못된 순서 - 컴파일 에러!
try {
    // ...
} catch (Exception e) {           // 모든 예외를 잡음
    // ...
} catch (ArithmeticException e) { // 도달 불가!
    // ...
}
```
{{< /callout >}}

---

## 4. 예외 정보 얻기

### 4.1 printStackTrace()와 getMessage()

예외가 발생하면 예외 클래스의 인스턴스가 생성되며, 이 인스턴스에는 발생한 예외에 대한 정보가 담겨 있다.

| 메서드 | 반환 타입 | 설명 |
|:-------|:---------|:-----|
| `getMessage()` | String | 예외 메시지 반환 |
| `printStackTrace()` | void | 호출스택 정보와 예외 메시지를 출력 |
| `getStackTrace()` | StackTraceElement[] | 스택 트레이스 배열 반환 |
| `getCause()` | Throwable | 원인 예외 반환 |

```java
public class ExceptionInfoExample {
    public static void main(String[] args) {
        try {
            method1();
        } catch (Exception e) {
            // 예외 메시지만 출력
            System.out.println("getMessage(): " + e.getMessage());

            System.out.println("\n--- printStackTrace() ---");
            // 전체 스택 트레이스 출력
            e.printStackTrace();

            System.out.println("\n--- getStackTrace() ---");
            // 스택 트레이스 배열로 접근
            StackTraceElement[] trace = e.getStackTrace();
            for (StackTraceElement element : trace) {
                System.out.println("  at " + element.getClassName()
                    + "." + element.getMethodName()
                    + "(" + element.getFileName()
                    + ":" + element.getLineNumber() + ")");
            }
        }
    }

    static void method1() {
        method2();
    }

    static void method2() {
        throw new RuntimeException("의도적으로 발생시킨 예외");
    }
}
```

**출력 결과:**
```
getMessage(): 의도적으로 발생시킨 예외

--- printStackTrace() ---
java.lang.RuntimeException: 의도적으로 발생시킨 예외
    at ExceptionInfoExample.method2(ExceptionInfoExample.java:30)
    at ExceptionInfoExample.method1(ExceptionInfoExample.java:26)
    at ExceptionInfoExample.main(ExceptionInfoExample.java:5)

--- getStackTrace() ---
  at ExceptionInfoExample.method2(ExceptionInfoExample.java:30)
  at ExceptionInfoExample.method1(ExceptionInfoExample.java:26)
  at ExceptionInfoExample.main(ExceptionInfoExample.java:5)
```

### 4.2 멀티 catch 블럭 (JDK 1.7+)

여러 예외를 하나의 catch 블럭에서 처리할 수 있다.

```java
// Before JDK 1.7
try {
    // ...
} catch (IOException e) {
    e.printStackTrace();
} catch (SQLException e) {
    e.printStackTrace();
}

// After JDK 1.7 - 멀티 catch
try {
    // ...
} catch (IOException | SQLException e) {
    e.printStackTrace();
}
```

{{< callout type="warning" >}}
**멀티 catch 제약사항:**
1. `|`로 연결된 예외가 조상-자손 관계면 컴파일 에러 (조상만 쓰면 됨)
2. 참조변수 `e`로는 공통 조상의 멤버만 사용 가능
3. 참조변수 `e`는 묵시적으로 `final`이므로 재할당 불가
{{< /callout >}}

```java
// 컴파일 에러 - 조상-자손 관계
try {
    // ...
} catch (Exception | RuntimeException e) {  // 에러!
    // RuntimeException은 Exception의 자손
}

// 올바른 사용
try {
    // ...
} catch (IOException | SQLException e) {
    // 공통 조상인 Exception의 메서드만 사용 가능
    e.printStackTrace();

    // e = new IOException();  // 에러! e는 final
}
```

---

## 5. 예외 발생시키기

### 5.1 throw 키워드

`throw` 키워드를 사용하여 프로그래머가 의도적으로 예외를 발생시킬 수 있다.

```java
// 방법 1: 예외 객체 생성 후 throw
Exception e = new Exception("고의로 발생시킨 예외");
throw e;

// 방법 2: 한 줄로 작성
throw new Exception("고의로 발생시킨 예외");
```

### 5.2 실용적인 예제

```java
public class Account {
    private String owner;
    private int balance;

    public Account(String owner, int balance) {
        this.owner = owner;
        this.balance = balance;
    }

    public void deposit(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("입금액은 0보다 커야 합니다: " + amount);
        }
        balance += amount;
    }

    public void withdraw(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("출금액은 0보다 커야 합니다: " + amount);
        }
        if (balance < amount) {
            throw new IllegalStateException(
                "잔액이 부족합니다. 현재 잔액: " + balance + ", 요청액: " + amount);
        }
        balance -= amount;
    }

    public int getBalance() {
        return balance;
    }
}

// 사용 예시
public class AccountTest {
    public static void main(String[] args) {
        Account account = new Account("홍길동", 10000);

        try {
            account.withdraw(50000);  // 잔액 부족
        } catch (IllegalStateException e) {
            System.out.println("출금 실패: " + e.getMessage());
        }

        try {
            account.deposit(-1000);  // 잘못된 금액
        } catch (IllegalArgumentException e) {
            System.out.println("입금 실패: " + e.getMessage());
        }
    }
}
```

### 5.3 Checked vs Unchecked 예외

```java
// Checked Exception - 반드시 예외처리 필요
public void checkedExample() {
    throw new Exception("checked");  // 컴파일 에러!
}

// 해결 방법 1: try-catch
public void checkedExample1() {
    try {
        throw new Exception("checked");
    } catch (Exception e) {
        e.printStackTrace();
    }
}

// 해결 방법 2: throws 선언
public void checkedExample2() throws Exception {
    throw new Exception("checked");
}

// Unchecked Exception - 예외처리 선택
public void uncheckedExample() {
    throw new RuntimeException("unchecked");  // 컴파일 OK
}
```

---

## 6. 메서드에 예외 선언하기 (throws)

### 6.1 throws 키워드

메서드 선언부에 `throws` 키워드를 사용하여 해당 메서드가 발생시킬 수 있는 예외를 명시한다.

```java
반환타입 메서드명(매개변수) throws 예외타입1, 예외타입2, ... {
    // 메서드 내용
}
```

### 6.2 예외 전파 (Exception Propagation)

예외를 메서드 선언부에 throws로 명시하면, 해당 메서드를 호출한 곳으로 예외가 전파된다.

```java
public class ExceptionPropagation {
    public static void main(String[] args) {
        try {
            method1();  // 3. 예외를 받아서 처리
        } catch (Exception e) {
            System.out.println("main에서 예외 처리: " + e.getMessage());
        }
    }

    static void method1() throws Exception {
        method2();  // 2. 예외가 전파됨
    }

    static void method2() throws Exception {
        throw new Exception("method2에서 발생");  // 1. 예외 발생
    }
}
```

**예외 전파 흐름:**

```
┌─────────────────────────────────────────────────┐
│  Call Stack                                      │
│                                                  │
│  ┌──────────┐                                   │
│  │ method2  │ ← 예외 발생                       │
│  └────┬─────┘                                   │
│       │ throws Exception                        │
│       ↓                                         │
│  ┌──────────┐                                   │
│  │ method1  │ ← 예외 전달받음, 다시 던짐        │
│  └────┬─────┘                                   │
│       │ throws Exception                        │
│       ↓                                         │
│  ┌──────────┐                                   │
│  │  main    │ ← catch로 예외 처리              │
│  └──────────┘                                   │
└─────────────────────────────────────────────────┘
```

### 6.3 예외 처리 위치 결정

```java
// 방법 1: 예외가 발생한 곳에서 처리
public void processFile() {
    try {
        readFile("data.txt");
    } catch (IOException e) {
        // 여기서 처리
        System.out.println("파일 읽기 실패, 기본값 사용");
    }
}

// 방법 2: 호출한 곳으로 던지기
public void processFile() throws IOException {
    readFile("data.txt");  // 호출한 곳에서 처리하도록
}

// 방법 3: 일부 처리 후 다시 던지기 (예외 되던지기)
public void processFile() throws IOException {
    try {
        readFile("data.txt");
    } catch (IOException e) {
        System.out.println("파일 읽기 실패 로그 기록");
        throw e;  // 다시 던지기
    }
}
```

{{< callout type="info" >}}
**예외 처리 위치 선택 기준:**
- 예외를 **복구**할 수 있다면 → 발생한 곳에서 처리
- 호출한 쪽에서 **결정**해야 한다면 → throws로 전파
- **로깅** 후 상위로 알려야 한다면 → 예외 되던지기
{{< /callout >}}

---

## 7. finally 블럭

### 7.1 finally의 역할

`finally` 블럭은 예외 발생 여부와 관계없이 **항상 실행**되어야 하는 코드를 넣는다.

```java
try {
    // 예외가 발생할 가능성이 있는 문장
} catch (Exception e) {
    // 예외 처리 문장
} finally {
    // 예외 발생 여부와 관계없이 항상 실행되는 문장
    // 주로 자원 정리(cleanup) 코드
}
```

### 7.2 실행 순서

| 상황 | 실행 순서 |
|:-----|:---------|
| 예외 발생 O | try → catch → finally |
| 예외 발생 X | try → finally |
| return 있음 | try/catch의 return 전에 finally 실행 |

### 7.3 finally와 return

```java
public class FinallyReturnExample {
    public static void main(String[] args) {
        System.out.println("결과: " + test());
    }

    static int test() {
        try {
            System.out.println("try 블럭");
            return 1;  // finally 실행 후 반환
        } catch (Exception e) {
            System.out.println("catch 블럭");
            return 2;
        } finally {
            System.out.println("finally 블럭 - 항상 실행");
            // return 3;  // 권장하지 않음!
        }
    }
}
```

**출력 결과:**
```
try 블럭
finally 블럭 - 항상 실행
결과: 1
```

{{< callout type="danger" >}}
**finally에서 return 사용 금지:**
finally 블럭에서 return을 사용하면 try/catch의 return 값을 덮어쓰므로 예측하기 어려운 결과가 발생한다.
{{< /callout >}}

### 7.4 자원 정리 패턴

```java
public void readFile(String path) {
    FileReader reader = null;
    try {
        reader = new FileReader(path);
        // 파일 읽기 작업
    } catch (IOException e) {
        System.out.println("파일 읽기 오류: " + e.getMessage());
    } finally {
        // 자원 정리 - 예외 여부와 관계없이 실행
        if (reader != null) {
            try {
                reader.close();
            } catch (IOException e) {
                System.out.println("파일 닫기 오류");
            }
        }
    }
}
```

---

## 8. try-with-resources (자동 자원 반환)

### 8.1 기존 방식의 문제점

```java
// 문제 1: 코드가 복잡함
// 문제 2: close()에서 예외 발생 시 처리 필요
// 문제 3: close() 호출을 잊을 수 있음
FileInputStream fis = null;
try {
    fis = new FileInputStream("file.txt");
    // 작업 수행
} catch (IOException e) {
    e.printStackTrace();
} finally {
    if (fis != null) {
        try {
            fis.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### 8.2 try-with-resources 문법 (JDK 1.7+)

```java
// 괄호 안에 선언된 자원은 자동으로 close() 호출
try (FileInputStream fis = new FileInputStream("file.txt")) {
    // 작업 수행
} catch (IOException e) {
    e.printStackTrace();
}
// fis.close()가 자동 호출됨
```

### 8.3 여러 자원 사용

```java
// 세미콜론으로 구분하여 여러 자원 선언
try (FileInputStream fis = new FileInputStream("input.txt");
     FileOutputStream fos = new FileOutputStream("output.txt")) {

    int data;
    while ((data = fis.read()) != -1) {
        fos.write(data);
    }
} catch (IOException e) {
    e.printStackTrace();
}
// fos.close() → fis.close() 순서로 자동 호출 (선언의 역순)
```

### 8.4 AutoCloseable 인터페이스

try-with-resources를 사용하려면 해당 클래스가 `AutoCloseable` 인터페이스를 구현해야 한다.

```java
public interface AutoCloseable {
    void close() throws Exception;
}

// 사용자 정의 자원 클래스
public class MyResource implements AutoCloseable {
    private String name;

    public MyResource(String name) {
        this.name = name;
        System.out.println(name + " 자원 생성");
    }

    public void doSomething() {
        System.out.println(name + " 작업 수행");
    }

    @Override
    public void close() {
        System.out.println(name + " 자원 해제");
    }
}

// 사용 예시
public class AutoCloseableExample {
    public static void main(String[] args) {
        try (MyResource resource1 = new MyResource("Resource1");
             MyResource resource2 = new MyResource("Resource2")) {

            resource1.doSomething();
            resource2.doSomething();
        }
    }
}
```

**출력 결과:**
```
Resource1 자원 생성
Resource2 자원 생성
Resource1 작업 수행
Resource2 작업 수행
Resource2 자원 해제
Resource1 자원 해제
```

### 8.5 억제된 예외 (Suppressed Exception)

try 블럭과 close()에서 모두 예외가 발생하면, close()의 예외는 억제되어 저장된다.

```java
public class SuppressedExceptionExample {
    public static void main(String[] args) {
        try (MyResource resource = new MyResource()) {
            throw new RuntimeException("try 블럭에서 예외 발생");
        } catch (Exception e) {
            System.out.println("주 예외: " + e.getMessage());

            // 억제된 예외 확인
            Throwable[] suppressed = e.getSuppressed();
            for (Throwable t : suppressed) {
                System.out.println("억제된 예외: " + t.getMessage());
            }
        }
    }
}

class MyResource implements AutoCloseable {
    @Override
    public void close() {
        throw new RuntimeException("close()에서 예외 발생");
    }
}
```

**출력 결과:**
```
주 예외: try 블럭에서 예외 발생
억제된 예외: close()에서 예외 발생
```

---

## 9. 사용자 정의 예외

### 9.1 사용자 정의 예외 만들기

필요에 따라 새로운 예외 클래스를 정의할 수 있다.

```java
// Checked Exception (Exception 상속)
public class InsufficientBalanceException extends Exception {
    private int balance;
    private int amount;

    public InsufficientBalanceException(String message, int balance, int amount) {
        super(message);
        this.balance = balance;
        this.amount = amount;
    }

    public int getBalance() { return balance; }
    public int getAmount() { return amount; }
}

// Unchecked Exception (RuntimeException 상속) - 최근 권장 방식
public class InvalidOrderException extends RuntimeException {
    private String orderId;

    public InvalidOrderException(String message) {
        super(message);
    }

    public InvalidOrderException(String message, String orderId) {
        super(message);
        this.orderId = orderId;
    }

    public InvalidOrderException(String message, Throwable cause) {
        super(message, cause);
    }

    public String getOrderId() { return orderId; }
}
```

### 9.2 사용자 정의 예외 활용

```java
public class BankAccount {
    private String accountNumber;
    private int balance;

    public BankAccount(String accountNumber, int initialBalance) {
        this.accountNumber = accountNumber;
        this.balance = initialBalance;
    }

    public void withdraw(int amount) throws InsufficientBalanceException {
        if (amount > balance) {
            throw new InsufficientBalanceException(
                "잔액이 부족합니다",
                balance,
                amount
            );
        }
        balance -= amount;
    }

    public int getBalance() { return balance; }
}

// 사용 예시
public class BankAccountTest {
    public static void main(String[] args) {
        BankAccount account = new BankAccount("123-456", 10000);

        try {
            account.withdraw(50000);
        } catch (InsufficientBalanceException e) {
            System.out.println("출금 실패: " + e.getMessage());
            System.out.println("현재 잔액: " + e.getBalance());
            System.out.println("요청 금액: " + e.getAmount());
            System.out.println("부족 금액: " + (e.getAmount() - e.getBalance()));
        }
    }
}
```

{{< callout type="info" >}}
**최근 트렌드:**
과거에는 주로 `Exception`을 상속받아 Checked Exception으로 만들었지만, 최근에는 예외 처리의 유연성을 위해 `RuntimeException`을 상속받아 Unchecked Exception으로 만드는 경우가 많다.
{{< /callout >}}

---

## 10. 예외 되던지기 (Exception Re-throwing)

### 10.1 예외 되던지기란?

예외를 처리한 후 다시 발생시켜 호출한 메서드에서도 처리할 수 있게 하는 기법이다.

```java
public class ReThrowingExample {
    public static void main(String[] args) {
        try {
            method1();
        } catch (Exception e) {
            System.out.println("main에서 최종 처리");
        }
    }

    static void method1() throws Exception {
        try {
            throw new Exception("원본 예외");
        } catch (Exception e) {
            System.out.println("method1에서 예외 로깅: " + e.getMessage());
            throw e;  // 예외 되던지기
        }
    }
}
```

### 10.2 활용 패턴

```java
public class OrderService {
    private OrderRepository repository;
    private Logger logger;

    public Order processOrder(Order order) throws OrderProcessingException {
        try {
            validateOrder(order);
            Order savedOrder = repository.save(order);
            return savedOrder;
        } catch (ValidationException e) {
            // 로깅 후 다시 던지기
            logger.error("주문 검증 실패: " + order.getId(), e);
            throw new OrderProcessingException("주문 처리 실패", e);
        } catch (DatabaseException e) {
            // 롤백 수행 후 다시 던지기
            logger.error("DB 저장 실패: " + order.getId(), e);
            throw new OrderProcessingException("주문 저장 실패", e);
        }
    }
}
```

### 10.3 반환값과 예외 되던지기

```java
// catch 블럭에서 return 또는 throw 중 하나 필요
public int divide(int a, int b) throws ArithmeticException {
    try {
        return a / b;
    } catch (ArithmeticException e) {
        System.out.println("0으로 나눌 수 없습니다");
        throw e;  // return 대신 throw
    }
}
```

---

## 11. 연결된 예외 (Chained Exception)

### 11.1 원인 예외 (Cause Exception)

한 예외가 다른 예외를 발생시켰을 때, 원래의 예외를 새 예외의 "원인"으로 등록할 수 있다.

```java
// Throwable의 메서드
Throwable initCause(Throwable cause)  // 원인 예외 등록
Throwable getCause()                   // 원인 예외 반환
```

### 11.2 예외 연결하기

```java
public class ChainedExceptionExample {
    public static void main(String[] args) {
        try {
            startProcess();
        } catch (ProcessException e) {
            System.out.println("예외: " + e.getMessage());
            System.out.println("원인: " + e.getCause().getMessage());
        }
    }

    static void startProcess() throws ProcessException {
        try {
            doSomething();
        } catch (IOException e) {
            // 원인 예외를 포함하여 새 예외 발생
            throw new ProcessException("프로세스 실패", e);
        }
    }

    static void doSomething() throws IOException {
        throw new IOException("파일 읽기 실패");
    }
}

class ProcessException extends Exception {
    public ProcessException(String message, Throwable cause) {
        super(message, cause);  // 생성자에서 원인 예외 설정
    }
}
```

### 11.3 Checked를 Unchecked로 변환

연결된 예외를 사용하면 Checked Exception을 Unchecked Exception으로 감쌀 수 있다.

```java
// 기존: Checked Exception을 반드시 처리해야 함
public void process() throws IOException {
    throw new IOException("파일 없음");
}

// 변환: Unchecked로 감싸서 처리를 선택적으로
public void process() {
    try {
        throw new IOException("파일 없음");
    } catch (IOException e) {
        throw new RuntimeException("처리 실패", e);  // Unchecked로 변환
    }
}
```

---

## 12. 예외 처리 베스트 프랙티스

### 12.1 예외 처리 원칙

| 원칙 | 설명 |
|:-----|:-----|
| **구체적인 예외 사용** | `Exception` 대신 구체적인 예외 타입 사용 |
| **의미있는 메시지** | 예외 발생 원인을 파악할 수 있는 메시지 포함 |
| **원인 예외 보존** | 예외를 변환할 때 원인 예외를 함께 전달 |
| **적절한 수준에서 처리** | 예외를 처리할 수 있는 곳에서만 catch |
| **빈 catch 블럭 금지** | 예외를 무시하지 않고 최소한 로깅 |

### 12.2 안티 패턴

```java
// ❌ 나쁜 예: 모든 예외를 무시
try {
    doSomething();
} catch (Exception e) {
    // 아무것도 안 함 - 절대 금지!
}

// ❌ 나쁜 예: 너무 넓은 예외 타입
try {
    doSomething();
} catch (Exception e) {  // 모든 예외를 잡음
    e.printStackTrace();
}

// ❌ 나쁜 예: 예외 정보 손실
try {
    doSomething();
} catch (IOException e) {
    throw new RuntimeException("실패");  // 원인 예외 누락
}

// ❌ 나쁜 예: 로직 제어에 예외 사용
try {
    int value = Integer.parseInt(str);
} catch (NumberFormatException e) {
    value = 0;  // 예외를 정상 로직처럼 사용
}
```

### 12.3 권장 패턴

```java
// ✅ 좋은 예: 구체적인 예외 타입
try {
    doSomething();
} catch (FileNotFoundException e) {
    // 파일 없음 처리
} catch (IOException e) {
    // 기타 IO 오류 처리
}

// ✅ 좋은 예: 의미있는 예외 메시지
throw new IllegalArgumentException(
    "나이는 0 이상이어야 합니다. 입력값: " + age);

// ✅ 좋은 예: 원인 예외 보존
try {
    readFile(path);
} catch (IOException e) {
    throw new DataLoadException("데이터 로드 실패: " + path, e);
}

// ✅ 좋은 예: 예외 전 검증
if (str != null && !str.isEmpty()) {
    int value = Integer.parseInt(str);
}
```

---

## 13. 요약

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **Exception** | 프로그램 코드로 수습 가능한 오류 |
| **Error** | 복구 불가능한 심각한 오류 |
| **Checked Exception** | 컴파일러가 예외 처리를 강제 |
| **Unchecked Exception** | RuntimeException 계열, 처리 선택 |
| **try-catch** | 예외 발생 시 처리하는 구문 |
| **finally** | 예외 여부와 관계없이 항상 실행 |
| **throws** | 메서드가 발생시킬 수 있는 예외 선언 |
| **throw** | 예외를 명시적으로 발생 |
| **try-with-resources** | 자원 자동 해제 구문 (JDK 1.7+) |
| **연결된 예외** | 예외의 원인을 다른 예외로 지정 |

### 예외 처리 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                    예외 발생                                  │
│                       │                                      │
│         ┌─────────────┴─────────────┐                       │
│         ↓                           ↓                       │
│   현재 메서드에서              호출한 메서드로                │
│   try-catch로 처리             throws로 전파                 │
│         │                           │                       │
│         ↓                           ↓                       │
│    catch 블럭 실행          상위 메서드에서 처리              │
│         │                    또는 다시 전파                  │
│         ↓                           │                       │
│    finally 실행 ←───────────────────┘                       │
│    (있는 경우)                                               │
│         │                                                    │
│         ↓                                                    │
│    프로그램 계속 실행                                        │
└─────────────────────────────────────────────────────────────┘
```

{{< callout type="info" >}}
**예외 처리의 핵심:**
1. 예외는 **예측 가능한 오류 상황**에 대비하는 것
2. 복구할 수 있으면 **try-catch**로 처리
3. 호출자가 결정해야 하면 **throws**로 전파
4. 자원은 **try-with-resources**로 안전하게 해제
5. 사용자 정의 예외로 **도메인 특화** 오류 표현
{{< /callout >}}
