---
title: "Chapter 08. 예외처리 (Exception Handling)"
date: 2026-02-01
weight: 8
---

프로그램은 실패한다. 파일이 없고, 네트워크가 끊기고, 인자가 잘못 들어온다. 실패 자체는 막을 수 없으니 문제는 **실패를 어떻게 알리고 누가 책임질 것인가**다. 자바의 답이 예외이고, 이 장의 규칙들은 두 원리에서 나온다. 첫째, **실패는 반환값이 아니라 흐름을 끊는 사건으로 다룬다.** `try-catch`, 전파, `finally`가 모두 이 결정의 결과다. 둘째, **컴파일러가 강제할 실패와 하지 않을 실패를 나눈다.** checked와 unchecked의 구분이 그것이고, 이 구분은 지금도 논쟁거리다. 이 장은 문법과 함께 JVM이 예외를 실제로 어떻게 전파하는지까지 본다. 그것을 알면 `finally`가 왜 항상 실행되는지, 왜 예외를 흐름 제어에 쓰면 안 되는지가 규칙이 아니라 결과가 된다.

---

## 1. 오류의 세 종류

| 종류 | 언제 드러나나 | 예 | 누가 잡나 |
|:-----|:--------------|:---|:----------|
| 컴파일 오류 | 컴파일 때 | 세미콜론 누락, 타입 불일치 | 컴파일러 |
| 실행 오류 | 실행 중 | 배열 범위 초과, 0으로 나누기 | 이 장의 예외 처리 |
| 논리 오류 | 실행은 되지만 결과가 틀림 | 1~10을 더하려다 1~9만 더함 | 테스트와 사람 |

```java
int[] arr = new int[5];
arr[10] = 1;                      // 실행 오류. ArrayIndexOutOfBoundsException

int sum = 0;
for (int i = 1; i < 10; i++) sum += i;   // 논리 오류. 오류 없이 틀린 값
```

컴파일 오류는 실행 전에 잡히고 논리 오류는 언어가 잡아 줄 수 없다. 언어가 장치를 마련해 둔 것은 가운데, 실행 중에 드러나는 오류다. 자바는 이것을 다시 둘로 나눈다.

| 구분 | 뜻 | 복구 |
|:-----|:---|:-----|
| 에러 (`Error`) | 메모리 부족, 스택 넘침처럼 JVM 수준의 문제 | 할 수 없다. 프로그램이 손쓸 방법이 없다 |
| 예외 (`Exception`) | 코드가 대응할 수 있는 비정상 상황 | 할 수 있다. 이 장의 대상 |

---

## 2. 왜 반환값이 아니라 예외인가

C에서는 실패를 반환값으로 알린다. 파일을 못 열면 `-1`을 돌려주는 식이다. 이 방식에는 세 가지 문제가 있다. 호출자가 반환값을 확인하지 않으면 실패가 **조용히 묻힌다.** 정상 결과와 오류 코드가 **같은 자리**를 두고 다투어, 모든 값이 정상일 수 있는 함수는 오류를 알릴 방법이 없다. 그리고 깊은 곳에서 난 실패를 위로 올리려면 **모든 단계가 손으로** 검사하고 다시 돌려줘야 한다.

```java
public int divide(int a, int b) {
    if (b == 0) throw new ArithmeticException("0으로 나눌 수 없다");
    return a / b;
}
```

예외는 실패를 값이 아니라 **사건**으로 다룬다. 던져진 예외는 처리될 때까지 정상 흐름을 멈추고 호출 스택을 거슬러 올라가므로 무시할 수 없고, 반환값은 온전히 결과에 쓸 수 있으며, 중간 메서드는 아무것도 하지 않아도 예외가 지나간다. 이 세 가지가 1절의 표에서 "실행 오류"를 다루는 방식이 된다.

대가도 있다. 예외 객체를 만들 때 JVM은 그 시점의 **호출 스택 전체를 기록**한다. 어디서 실패했는지 알려 주는 이 스택 트레이스가 예외의 가장 큰 가치이지만, 만드는 비용이 메서드 호출 수백 번에 맞먹는다. 9절에서 예외를 정상 흐름에 쓰지 말라고 하는 이유가 여기 있다.

---

## 3. 계층과 checked, unchecked

```
Throwable
 ├─ Error: 복구 불가, JVM 수준
 │    OutOfMemoryError
 │    StackOverflowError
 └─ Exception: 처리 대상
      ├─ checked: IOException 등
      └─ RuntimeException: unchecked
           NullPointerException
           IllegalArgumentException
```

모든 예외와 에러는 `Throwable`의 자손이다. `Throwable`이 메시지, 원인, 스택 트레이스를 갖고 `throw`할 수 있는 유일한 타입이라, 예외 클래스를 만들려면 이 계층 어딘가를 상속해야 한다. 계층이 [Chapter 07](../07-oop-advanced)의 상속이라는 점은 뒤의 `catch` 순서 규칙에서 중요해진다.

### 3.1 컴파일러가 강제하는 것과 하지 않는 것

| 그룹 | 어디에 속하나 | 컴파일러 | 뜻 |
|:-----|:--------------|:---------|:---|
| checked | `Exception`의 자손 중 `RuntimeException` 계열이 아닌 것 | 처리하거나 `throws`로 선언하지 않으면 컴파일 오류 | "이 실패는 일어날 수 있으니 대비하라" |
| unchecked | `RuntimeException`과 그 자손, 그리고 `Error` | 강제하지 않는다 | "대개 버그이거나 어디서든 날 수 있다" |

```java
public void readFile() throws IOException {      // checked. 처리하거나 선언해야 한다
    FileReader r = new FileReader("test.txt");
}

String s = null;
s.length();                                       // unchecked. 선언 없이 그냥 난다
```

왜 나누었는가. 파일이 없거나 네트워크가 끊기는 것은 코드가 옳아도 일어나는 일이다. 호출자가 미리 알고 대비할 수 있고, 대비하는 것이 맞다. 컴파일러가 그것을 강제하면 "파일이 없을 때"를 잊고 짠 코드가 컴파일되지 않는다. 이것이 **checked** 예외의 취지다.

반면 `NullPointerException`은 모든 참조 접근에서, `ArithmeticException`은 모든 나눗셈에서 날 수 있다. 이것까지 강제하면 코드의 거의 모든 줄에 처리가 붙어야 한다. 게다가 이들은 대개 코드의 **버그**라서, 잡아서 복구할 것이 아니라 고쳐야 할 것이다. 그래서 `RuntimeException` 계열은 강제하지 않는 **unchecked**로 두었다. `Error`도 unchecked인데, 메모리 부족을 `catch`해 봐야 할 수 있는 일이 없기 때문이다.

{{< callout type="info" >}}
checked 예외는 자바에만 있는 실험이고, 그 평가는 갈린다. 취지는 좋지만 `throws` 선언이 호출 사슬을 타고 퍼져 설계를 경직시키고, 처리할 수 없는 곳에서 억지로 `catch`해 삼키는 코드를 낳는다. [Chapter 14](../14-lambda-stream)의 람다는 checked 예외를 선언하지 못해 문제가 더 커졌다. 그래서 요즘은 **복구 전략이 분명한 경우에만 checked**, 나머지는 unchecked로 두는 것이 대세다. 스프링 같은 프레임워크가 자기 예외를 전부 unchecked로 만든 것도 같은 판단이다.
{{< /callout >}}

---

## 4. try-catch: 예외를 받아 내는 자리

```java
try {
    // 예외가 날 수 있는 문장들
} catch (ArithmeticException e) {
    // ArithmeticException이 났을 때
} catch (Exception e) {
    // 그 외 Exception 계열이 났을 때
}
```

```java
System.out.println("시작");
try {
    System.out.println("try 진입");
    int r = 10 / 0;                              // 여기서 예외
    System.out.println("실행되지 않는다");
} catch (ArithmeticException e) {
    System.out.println("처리: " + e.getMessage());
}
System.out.println("계속");
```

```
시작
try 진입
처리: / by zero
계속
```

예외가 나면 `try` 블록의 나머지는 건너뛰고, 예외 타입에 맞는 `catch`로 간다. `catch`가 끝나면 `try-catch` 다음 문장부터 **정상 흐름이 재개**된다. 예외가 나지 않으면 `catch`는 실행되지 않는다. 2절의 원리대로 실패는 흐름을 끊지만, `catch`가 그 흐름을 다시 잇는다. [Chapter 04](../04-control-statements)의 `if`와 달리 `try`와 `catch`는 문장이 하나여도 중괄호를 뺄 수 없다.

### 4.1 catch는 위에서부터, 구체적인 것이 먼저

```java
try {
    ...
} catch (Exception e) {              // 모든 예외가 여기서 잡힌다
    ...
} catch (ArithmeticException e) {    // 컴파일 오류. 도달할 수 없다
    ...
}
```

`catch`는 위에서부터 차례로 "이 예외가 이 타입인가"를 묻고, 처음 맞는 곳에서 멈춘다. 7장의 다형성 때문에 `ArithmeticException`은 `Exception`이기도 하므로, `Exception`을 먼저 두면 아래의 `catch`에는 아무것도 도달하지 못한다. 컴파일러는 이것을 오류로 잡는다. 4장의 `else if`에서 좁은 조건을 먼저 두던 것과 같은 논리다.

### 4.2 멀티 catch

```java
try {
    ...
} catch (IOException | SQLException e) {   // Java 7. 두 예외를 같은 방법으로 처리
    e.printStackTrace();
}
```

| 제약 | 이유 |
|:-----|:-----|
| `\|`로 묶은 타입끼리 조상-자손이면 안 된다 | 조상만 쓰면 되는데 굳이 둘을 적는 것은 실수다 |
| `e`로는 공통 조상의 멤버만 쓸 수 있다 | 실행 전에는 둘 중 어느 쪽이 올지 모른다 |
| `e`는 다시 대입할 수 없다 | 타입이 둘 중 하나인 변수에 무엇을 넣어야 할지 정할 수 없다 |

### 4.3 예외가 들고 있는 정보

| 메서드 | 돌려주는 것 |
|:-------|:------------|
| `getMessage()` | 예외를 만들 때 넣은 메시지 |
| `printStackTrace()` | 예외가 난 위치부터 호출 스택을 표준 오류로 출력 |
| `getStackTrace()` | 그 스택을 배열로 |
| `getCause()` | 이 예외를 일으킨 원인 예외 (8절) |

```
java.lang.ArithmeticException: / by zero
    at Calc.divide(Calc.java:12)
    at Calc.run(Calc.java:7)
    at Calc.main(Calc.java:3)
```

스택 트레이스는 위가 예외가 난 곳, 아래로 갈수록 호출한 쪽이다. [Chapter 06](../06-oop-basics)의 호출 스택을 위에서 아래로 찍은 것이다. 2절에서 말한 "예외 생성이 비싼" 이유가 이 기록이고, 디버깅할 때 가장 먼저 봐야 할 것도 이것이다.

---

## 5. 전파: 예외는 스택을 거슬러 올라간다

### 5.1 throw와 throws

```java
public void withdraw(int amount) {
    if (amount <= 0) {
        throw new IllegalArgumentException("출금액은 0보다 커야 한다: " + amount);
    }
    if (balance < amount) {
        throw new IllegalStateException("잔액 부족. balance=" + balance + ", 요청=" + amount);
    }
    balance -= amount;
}

public void readFile(String path) throws IOException {   // 여기서 처리하지 않고 호출자에게 넘긴다
    ...
}
```

`throw`는 예외를 **던지는** 문장이고, `throws`는 메서드가 어떤 예외를 던질 수 있는지 **선언**하는 것이다. `throws`에 적은 예외는 이 메서드가 책임지지 않고 호출자에게 넘긴다는 뜻이며, checked 예외는 처리하지 않을 거라면 반드시 이렇게 선언해야 한다.

### 5.2 JVM은 예외를 어떻게 전파하는가

```
throw
  │ 현재 메서드의 예외 표에서
  │ 이 위치를 덮는 catch를 찾는다
  ├─ 있다 ─▶ 그 catch로 점프
  └─ 없다 ─▶ 프레임을 걷고
            호출한 메서드에서 반복
```

컴파일러는 메서드마다 **예외 표**를 만든다. "이 범위의 코드에서 이 타입의 예외가 나면 저 위치로 가라"는 항목들의 목록이다. 예외가 던져지면 JVM은 지금 실행 중인 메서드의 표에서 현재 위치를 덮는 항목을 찾는다. 있으면 그 `catch`로 뛴다. 없으면 이 메서드의 프레임을 걷어 내고, 호출한 메서드로 돌아가 같은 일을 반복한다. 이 과정을 **스택 되감기**라 한다.

```java
static void main(String[] args) {
    try { method1(); }
    catch (Exception e) { System.out.println("main에서 처리"); }
}
static void method1() throws Exception { method2(); }
static void method2() throws Exception { throw new Exception("원인"); }
```

```
   예외 발생
        │
   ┌─────────┐
   │ method2 │  catch 없음. 프레임 제거
   └────┬────┘
        ▼
   ┌─────────┐
   │ method1 │  catch 없음. 프레임 제거
   └────┬────┘
        ▼
   ┌─────────┐
   │  main   │  catch 있음. 여기서 처리
   └─────────┘
```

`method1`은 예외에 관한 코드가 한 줄도 없지만 예외는 그것을 지나 `main`에 닿는다. 2절에서 말한 "중간 메서드는 아무것도 하지 않아도 된다"가 이 동작이다. `main`까지 아무도 잡지 않으면 스레드가 종료되고, JVM의 기본 처리기가 스택 트레이스를 찍는다. `main` 스레드였다면 프로그램이 끝나고 [Chapter 01](../01-java-intro)에서 본 종료 코드 1이 운영체제에 전달된다.

{{< callout type="info" >}}
checked 예외는 이 전파를 **선언으로 드러내게** 한다. `method2`가 checked 예외를 던지면 `method1`도 처리하거나 선언해야 하고, 그것이 `main`까지 이어진다. 오버라이딩할 때 자손이 조상보다 많은 checked 예외를 선언할 수 없다는 7장의 규칙도 같은 이유다. 조상 타입으로 부르는 호출자는 조상의 `throws`만 보고 대비했기 때문이다.
{{< /callout >}}

### 5.3 어디서 처리할 것인가

```java
public void load() {                              // 1. 여기서 복구할 수 있다면 잡는다
    try { readFile("data.txt"); }
    catch (IOException e) { useDefaults(); }
}

public void load() throws IOException {           // 2. 결정권이 호출자에게 있다면 넘긴다
    readFile("data.txt");
}

public void load() throws IOException {           // 3. 기록만 하고 다시 던진다
    try { readFile("data.txt"); }
    catch (IOException e) {
        log.error("읽기 실패", e);
        throw e;
    }
}
```

기준은 하나다. **이 예외에 대해 무엇을 할 수 있는가.** 기본값으로 대체하거나 재시도하는 것처럼 복구할 수 있으면 그 자리에서 잡는다. 할 수 있는 것이 없으면 잡지 않고 넘긴다. 처리할 수 없는 곳에서 잡는 것이 9절의 안티 패턴 대부분의 원인이다.

---

## 6. finally: 무슨 일이 있어도 실행된다

```java
try {
    ...
} catch (Exception e) {
    ...
} finally {
    // 예외가 났든 안 났든, catch에서 잡혔든 아니든 실행된다
}
```

| 상황 | 실행 순서 |
|:-----|:----------|
| 예외 없음 | `try` 전부 → `finally` → 다음 문장 |
| 예외 발생, `catch` 일치 | `try` 일부 → `catch` → `finally` → 다음 문장 |
| 예외 발생, `catch` 없음 | `try` 일부 → `finally` → 호출자로 전파 |
| `try`나 `catch`에 `return` | 반환값 계산 → `finally` → 반환 |

`finally`가 "항상" 실행되는 것은 컴파일러가 그렇게 만들기 때문이다. 컴파일러는 `try`와 `catch`가 끝나는 모든 경로, 즉 정상 종료, `return`, 잡히지 않은 예외 각각에 `finally`의 코드를 **복사해 넣는다.** 예외가 잡히지 않은 경로에는 5.2절의 예외 표에 "어떤 예외든 잡아서 `finally`를 실행한 뒤 다시 던지라"는 항목을 추가한다. 그래서 어느 경로로 나가든 `finally`를 거친다. 유일한 예외는 `System.exit()`처럼 JVM 자체를 멈추는 경우다.

```java
static int test() {
    try { return 1; }
    finally { System.out.println("finally"); }    // 1을 돌려주기 전에 실행된다
}
```

{{< callout type="warning" >}}
`finally` 안에서 `return`이나 `throw`를 쓰지 않는다. `try`에서 계산한 반환값이나 던진 예외를 `finally`의 것이 **덮어쓴다.** `try`에서 `return 1`을 했는데 `finally`가 `return 2`를 하면 2가 돌아가고, `try`의 예외는 흔적도 없이 사라진다. 원인을 잃어버리는 가장 찾기 어려운 버그 중 하나다.
{{< /callout >}}

### 6.1 finally의 본래 용도와 그 한계

```java
FileReader reader = null;
try {
    reader = new FileReader(path);
    ...
} catch (IOException e) {
    ...
} finally {
    if (reader != null) {
        try { reader.close(); }
        catch (IOException ignore) { }   // close의 예외는 어디에도 못 넘긴다
    }
}
```

`finally`가 있는 이유는 **자원 정리**다. 파일, 소켓, DB 연결처럼 다 쓰면 반드시 닫아야 하는 자원은 예외가 나도 닫혀야 한다. 그런데 위 코드가 보여 주듯 이 패턴은 무겁다. `null` 검사가 필요하고, `close()` 자체가 예외를 던질 수 있으며, `try`와 `close()`에서 모두 예외가 나면 하나는 버려야 한다. 이 문제를 문법으로 푼 것이 다음 절이다.

---

## 7. try-with-resources: 닫는 일을 문법에 맡긴다

```java
try (FileInputStream fis = new FileInputStream("in.txt");
     FileOutputStream fos = new FileOutputStream("out.txt")) {
    int d;
    while ((d = fis.read()) != -1) fos.write(d);
}   // 본문이 끝나면 fos.close(), fis.close()가 자동으로 불린다
```

```
try (A a = ...; B b = ...) {
  본문
}
→ 본문 종료 → b.close() → a.close()
  (선언의 역순. 나중 것이 먼저 닫힌다)
```

Java 7의 `try-with-resources`는 괄호 안에 선언한 자원을 본문이 끝날 때 **자동으로 닫는다.** 예외가 나도 닫고, `null` 검사도 필요 없다. 조건은 자원의 타입이 `AutoCloseable`을 구현하는 것뿐이다. 이 인터페이스는 `close()` 하나를 약속하고, 자바의 입출력 클래스들은 전부 이것을 구현한다.

```java
class MyResource implements AutoCloseable {
    @Override public void close() { System.out.println("해제"); }
}
```

닫는 순서가 선언의 **역순**인 이유는 나중에 만든 자원이 먼저 만든 자원에 기대는 경우가 많기 때문이다. 파일 스트림 위에 버퍼 스트림을 얹었다면 버퍼를 먼저 닫아 남은 내용을 파일에 쓰고, 그다음 파일을 닫아야 한다.

### 7.1 억제된 예외

```
본문에서 예외 X 발생
  └─ close()에서 예외 Y 발생
     X가 전파되고, Y는 X에 첨부된다
```

```java
try (MyResource r = new MyResource()) {
    throw new RuntimeException("본문 예외");
} catch (Exception e) {
    e.getMessage();                       // 본문 예외
    for (Throwable s : e.getSuppressed()) {
        s.getMessage();                   // close에서 난 예외
    }
}
```

본문과 `close()`에서 모두 예외가 나면 어느 쪽을 전파해야 하는가. 6.1절의 `finally` 패턴에서는 나중에 난 `close()`의 예외가 본문의 예외를 덮어써 버렸다. 그러나 정말 알아야 할 것은 먼저 난 본문의 예외다. 그래서 `try-with-resources`는 본문의 예외를 전파하고 `close()`의 예외는 거기에 **억제된 예외**로 붙여 둔다. 둘 다 잃지 않으면서 중요한 쪽을 앞에 세운 것이다.

{{< callout type="info" >}}
자원을 다루는 코드는 `finally` 대신 `try-with-resources`를 쓴다. 짧고, `null` 검사가 없고, 예외를 잃지 않는다. Java 9부터는 이미 만들어 둔 변수도 사실상 `final`이면 `try (reader)`처럼 괄호에 바로 넣을 수 있다. 자원의 종류와 입출력 스트림은 [Chapter 15](../15-io)에서 다룬다.
{{< /callout >}}

---

## 8. 사용자 정의 예외와 원인 연결

### 8.1 예외 클래스 만들기

```java
public class InsufficientBalanceException extends Exception {        // checked
    private final int balance;
    private final int amount;

    public InsufficientBalanceException(String message, int balance, int amount) {
        super(message);
        this.balance = balance;
        this.amount = amount;
    }
    public int getBalance() { return balance; }
    public int getAmount() { return amount; }
}

public class InvalidOrderException extends RuntimeException {        // unchecked
    public InvalidOrderException(String message) { super(message); }
    public InvalidOrderException(String message, Throwable cause) { super(message, cause); }
}
```

표준 예외로 부족한 때는 실패에 **도메인의 이름**을 붙이고 싶을 때, 그리고 실패에 관한 **정보를 실어 보내고** 싶을 때다. `IllegalStateException`보다 `InsufficientBalanceException`이 무슨 일인지 말해 주고, 잔액과 요청액을 필드로 담으면 호출자가 메시지를 파싱하지 않고도 값을 쓸 수 있다. `Exception`을 상속하면 checked, `RuntimeException`을 상속하면 unchecked이며, 3.1절의 기준대로 복구 전략이 분명하지 않으면 unchecked로 둔다.

원인을 받는 생성자 `(String, Throwable)`는 반드시 둔다. 이유가 다음 절이다.

### 8.2 원인을 잃지 않기: 연결된 예외

```java
class DataLoadException extends RuntimeException {
    DataLoadException(String message, Throwable cause) { super(message, cause); }
}

public Config load(String path) {
    try {
        return parse(readFile(path));
    } catch (IOException e) {
        throw new DataLoadException("설정을 읽지 못했다: " + path, e);   // e를 원인으로 넣는다
    }
}
```

낮은 계층의 예외를 그대로 올려 보내면 호출자는 `IOException`을 보고 "설정 로딩"이 실패한 것인지 알기 어렵고, 호출자가 파일이라는 구현 세부에 묶인다. 그래서 자기 계층의 예외로 **감싸서** 던진다. 이때 원래 예외를 `cause`로 넣지 않으면 진짜 원인, 즉 어느 파일이 왜 안 열렸는지가 사라진다. `cause`를 넣으면 스택 트레이스에 `Caused by:`로 원인이 이어져 찍히고 `getCause()`로 꺼낼 수 있다.

같은 방법으로 checked 예외를 unchecked로 바꿀 수 있다. 처리할 방법이 없는 `IOException`을 `throws`로 계속 올리는 대신 `RuntimeException`으로 감싸면 호출 사슬의 `throws` 선언이 사라진다. 3.1절의 논쟁에서 unchecked 쪽이 택한 실무적 타협이다.

```java
public Order process(Order o) {
    try {
        validate(o);
        return repository.save(o);
    } catch (ValidationException e) {
        log.warn("검증 실패: {}", o.getId(), e);
        throw new OrderProcessingException("주문 처리 실패", e);   // 기록하고, 감싸서, 원인과 함께
    }
}
```

---

## 9. 안티 패턴과 그 이유

```java
try { doSomething(); }
catch (Exception e) { }                              // 1. 삼킨다

try { doSomething(); }
catch (Exception e) { e.printStackTrace(); }         // 2. 너무 넓게 잡는다

try { doSomething(); }
catch (IOException e) { throw new RuntimeException("실패"); }   // 3. 원인을 버린다

try { value = Integer.parseInt(str); }
catch (NumberFormatException e) { value = 0; }       // 4. 정상 흐름에 예외를 쓴다
```

| 안티 패턴 | 왜 문제인가 |
|:----------|:------------|
| 빈 `catch` | 2절에서 예외를 택한 이유가 "무시할 수 없다"였는데 그것을 스스로 무너뜨린다. 실패가 조용히 묻힌다 |
| `Exception`으로 넓게 잡기 | 예상한 실패와 예상 못 한 버그를 같이 잡는다. 버그가 "처리됐다"고 표시된 채 숨는다 |
| `cause` 없이 감싸기 | 스택 트레이스의 `Caused by:`가 사라져 원인을 추적할 수 없다 |
| 흐름 제어에 예외 | 예외 생성마다 스택을 기록하니 느리고, 읽는 사람은 실패인지 분기인지 구분할 수 없다 |

```java
if (str != null && str.matches("\\d+")) {          // 예외 대신 검증
    value = Integer.parseInt(str);
}
```

| 원칙 | 이유 |
|:-----|:-----|
| 구체적인 예외를 잡는다 | 무엇을 예상했는지 코드가 말한다 |
| 메시지에 값과 상태를 담는다 | 로그만 보고 재현할 수 있어야 한다 |
| 감쌀 때는 `cause`를 넘긴다 | 원인은 한 번 잃으면 되찾을 수 없다 |
| 처리할 수 있는 곳에서만 잡는다 | 할 수 있는 것이 없으면 넘기는 것이 맞다 |
| 예외는 예외적인 상황에만 | 예상되는 값의 분기는 `if`의 일이다 |

---

## 10. 요약

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 예외 | 실패를 흐름을 끊는 사건으로 | 반환값은 무시되고, 결과와 자리를 다투고, 손으로 올려야 한다 |
| 비용 | 생성 시 스택을 기록한다 | 어디서 났는지가 예외의 가치다. 그래서 흐름 제어에는 안 쓴다 |
| checked | 처리하거나 선언해야 컴파일된다 | 코드가 옳아도 나는 실패는 대비를 강제한다 |
| unchecked | 강제하지 않는다 | 어디서든 날 수 있고 대개 버그다 |
| `catch` 순서 | 구체적인 것이 먼저 | 위에서부터 처음 맞는 곳에서 멈춘다 |
| 전파 | 예외 표에 없으면 프레임을 걷고 위로 | 중간 메서드는 아무것도 안 해도 지나간다 |
| 처리 위치 | 할 수 있는 것이 있는 곳 | 없는 곳에서 잡으면 삼키게 된다 |
| `finally` | 모든 경로에 복사되어 항상 실행 | `return`, `throw`로 덮어쓰지 않는다 |
| `try-with-resources` | 역순으로 자동 `close()`, 본문 예외 우선 | 나중 자원이 먼저 자원에 기댄다. 먼저 난 예외가 중요하다 |
| 사용자 정의 | 도메인 이름과 정보. `cause` 생성자 필수 | 감쌀 때 원인을 잃지 않는다 |
