---
title: "Chapter 08. 예외처리 (Exception Handling)"
date: 2026-02-01
weight: 8
---

프로그램은 실패한다. 파일이 없고, 네트워크가 끊기고, 인자가 잘못 들어온다. 실패 자체는 막을 수 없으니 문제는 실패를 어떻게 알리고 누가 책임질 것인가다. 자바의 답이 예외이고, 이 장의 규칙들은 세 원리에서 나온다. 원리는 셋이다. 첫째, **실패는 반환값이 아니라 흐름을 끊는 사건으로 다룬다.** 던져진 예외는 처리될 때까지 호출 스택을 거슬러 올라가니 무시할 수 없고, `try-catch`가 그 흐름을 다시 잇고, `finally`는 어느 경로로 나가든 거친다. 둘째, **컴파일러가 강제할 실패와 하지 않을 실패를 나눈다.** 코드가 옳아도 나는 실패는 대비를 강제하고(checked), 어디서든 날 수 있는 버그는 강제하지 않는다(unchecked). 이 구분은 지금도 논쟁거리다. 셋째, **예외는 어디서 났는지와 왜 났는지를 들고 다니고, 처리는 그것을 보존하면서 할 수 있는 곳에서만 한다.** 스택 트레이스와 `cause`가 그 정보이고, 처리할 수 없는 곳에서 잡아 삼키는 것, `finally`에서 덮어쓰는 것, 원인 없이 감싸는 것이 전부 그 정보를 잃는 길이다. 이 장은 문법과 함께 JVM이 예외를 실제로 어떻게 전파하는지까지 본다. 그것을 알면 `finally`가 왜 항상 실행되는지, 왜 예외를 흐름 제어에 쓰면 안 되는지가 규칙이 아니라 결과가 된다.

---

## 1. 오류의 세 종류

| 종류 | 언제 드러나나 | 예 | 누가 잡나 | 왜 셋인가 |
|:-----|:---------|:---|:-------|:-------|
| 컴파일 오류 | 컴파일 때 | 세미콜론 누락, 타입 불일치 | 컴파일러 | 소스만 보고 알 수 있는 것은 실행 전에 잡는다 |
| 실행 오류 | 실행 중 | 배열 범위 초과, 0으로 나누기 | 이 장의 예외 처리 | 값이 들어와야 드러난다. 언어가 장치를 마련한 유일한 종류 |
| 논리 오류 | 실행은 되지만 결과가 틀림 | 1~10을 더하려다 1~9만 더함 | 테스트와 사람 | 프로그램은 자기가 틀린 줄 모른다 |

```java
int[] arr = new int[5];
arr[10] = 1;   // 실행 오류
// ArrayIndexOutOfBoundsException

int sum = 0;
for (int i = 1; i < 10; i++) sum += i;
// 논리 오류. 오류 없이 틀린 값
```

컴파일 오류는 실행 전에 잡히고 논리 오류는 언어가 잡아 줄 수 없다. 언어가 장치를 마련해 둔 것은 가운데, 실행 중에 드러나는 오류다. 자바는 이것을 다시 둘로 나눈다.

| 구분 | 뜻 | 복구 | 왜 나누나 |
|:-----|:---|:-----|:-------|
| 에러 (`Error`) | 메모리 부족, 스택 넘침처럼 JVM 수준의 문제 | 할 수 없다 | 프로그램이 손쓸 방법이 없다. 잡아 봐야 할 일이 없다 |
| 예외 (`Exception`) | 코드가 대응할 수 있는 비정상 상황 | 할 수 있다 | 이 장의 대상 |

---

## 2. 왜 반환값이 아니라 예외인가

| 문제 | 반환값으로 알리면 | 예외로 알리면 | 왜 |
|:-----|:------------|:----------|:---|
| 무시 | 호출자가 확인하지 않으면 조용히 묻힌다 | 처리될 때까지 흐름을 멈춘다 | 사건은 지나칠 수 없다 |
| 자리 | 정상 결과와 오류 코드가 같은 자리를 다툰다 | 반환값은 결과에만 쓴다 | 모든 값이 정상일 수 있는 함수도 실패를 알린다 |
| 전파 | 모든 단계가 손으로 검사하고 다시 돌려준다 | 중간 메서드는 아무것도 안 해도 지나간다 | 스택을 거슬러 오른다 (5절) |
| 비용 | 거의 없다 | 생성 시 호출 스택 전체를 기록한다 | 어디서 났는지가 예외의 가치다. 그래서 흐름 제어에는 안 쓴다 (9절) |

```java
int divide(int a, int b) {
    if (b == 0) {
        throw new ArithmeticException(
            "0으로 나눌 수 없다");
    }
    return a / b;
}
```

첫째 원리다. C에서는 실패를 반환값으로 알린다. 파일을 못 열면 `-1`을 돌려주는 식이다. 이 방식에는 세 가지 문제가 있다. 호출자가 반환값을 확인하지 않으면 실패가 조용히 묻힌다. 정상 결과와 오류 코드가 같은 자리를 두고 다투어, 모든 값이 정상일 수 있는 함수는 오류를 알릴 방법이 없다. 그리고 깊은 곳에서 난 실패를 위로 올리려면 모든 단계가 손으로 검사하고 다시 돌려줘야 한다. 예외는 실패를 값이 아니라 사건으로 다룬다. 던져진 예외는 처리될 때까지 정상 흐름을 멈추고 호출 스택을 거슬러 올라가므로 무시할 수 없고, 반환값은 온전히 결과에 쓸 수 있으며, 중간 메서드는 아무것도 하지 않아도 예외가 지나간다. 대가도 있다. 예외 객체를 만들 때 JVM은 그 시점의 호출 스택 전체를 기록한다. 어디서 실패했는지 알려 주는 이 스택 트레이스가 예외의 가장 큰 가치이지만, 만드는 비용이 메서드 호출 수백 번에 맞먹는다. 9절에서 예외를 정상 흐름에 쓰지 말라고 하는 이유가 여기 있다.

---

## 3. 계층과 checked, unchecked

```text
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

모든 예외와 에러는 `Throwable`의 자손이다. `Throwable`이 메시지, 원인, 스택 트레이스를 갖고 `throw`할 수 있는 유일한 타입이라, 예외 클래스를 만들려면 이 계층 어딘가를 상속해야 한다. `throw "오류"`처럼 문자열을 던지면 "String cannot be converted to Throwable"로 거절된다. 계층이 [Chapter 07](../07-oop-advanced)의 상속이라는 점은 뒤의 `catch` 순서 규칙에서 중요해진다.

### 3.1 컴파일러가 강제하는 것과 하지 않는 것

| 그룹 | 어디에 속하나 | 컴파일러 | 왜 |
|:-----|:---------|:------|:---|
| checked | `Exception`의 자손 중 `RuntimeException` 계열이 아닌 것 | 처리하거나 `throws`로 선언하지 않으면 컴파일 오류 | 코드가 옳아도 나는 실패다. 호출자가 미리 알고 대비할 수 있고, 대비하는 것이 맞다 |
| unchecked | `RuntimeException`과 그 자손, 그리고 `Error` | 강제하지 않는다 | 모든 참조 접근, 모든 나눗셈에서 날 수 있어 강제하면 모든 줄에 처리가 붙는다. 대개 버그라 고칠 것이지 잡을 것이 아니다 |

```java
// checked. 처리하거나 선언해야 한다
void readFile() throws IOException {
    var r = new FileReader("test.txt");
}

String s = null;
s.length();   // unchecked. 그냥 난다
```

둘째 원리다. 왜 나누었는가. 파일이 없거나 네트워크가 끊기는 것은 코드가 옳아도 일어나는 일이다. 호출자가 미리 알고 대비할 수 있고, 대비하는 것이 맞다. 컴파일러가 그것을 강제하면 "파일이 없을 때"를 잊고 짠 코드가 컴파일되지 않는다. 오류 메시지가 그대로 말한다. "unreported exception FileNotFoundException; must be caught or declared to be thrown". 이것이 checked 예외의 취지다. 반면 `NullPointerException`은 모든 참조 접근에서, `ArithmeticException`은 모든 나눗셈에서 날 수 있다. 이것까지 강제하면 코드의 거의 모든 줄에 처리가 붙어야 한다. 게다가 이들은 대개 코드의 버그라서, 잡아서 복구할 것이 아니라 고쳐야 할 것이다. 그래서 `RuntimeException` 계열은 강제하지 않는 unchecked로 두었다. `Error`도 unchecked인데, 메모리 부족을 `catch`해 봐야 할 수 있는 일이 없기 때문이다. 컴파일러는 반대 방향도 검사한다. 날 수 없는 checked 예외를 `catch`하면 "exception IOException is never thrown in body of corresponding try statement"다.

{{< callout type="info" >}}
checked 예외는 자바에만 있는 실험이고, 그 평가는 갈린다. 취지는 좋지만 `throws` 선언이 호출 사슬을 타고 퍼져 설계를 경직시키고, 처리할 수 없는 곳에서 억지로 `catch`해 삼키는 코드를 낳는다. [Chapter 14](../14-lambda-stream)의 람다는 checked 예외를 선언하지 못해 문제가 더 커졌다. 그래서 요즘은 **복구 전략이 분명한 경우에만 checked**, 나머지는 unchecked로 두는 것이 대세다. 스프링 같은 프레임워크가 자기 예외를 전부 unchecked로 만든 것도 같은 판단이다. [Chapter 10](../10-date-time-formatting)의 `ParseException`이 checked인 것은 그 실험의 흔적이다.
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
    int r = 10 / 0;   // 여기서 예외
    System.out.println("안 실행된다");
} catch (ArithmeticException e) {
    System.out.println(
        "처리: " + e.getMessage());
}
System.out.println("계속");
```

```text
시작
try 진입
처리: / by zero
계속
```

| 경우 | 흐름 | 왜 |
|:-----|:-----|:---|
| 예외 없음 | `try` 전부 → 다음 문장 | `catch`는 실행되지 않는다 |
| 예외 발생, 맞는 `catch` 있음 | `try` 나머지를 건너뛰고 → `catch` → 다음 문장 | 사건이 흐름을 끊고, `catch`가 다시 잇는다 |
| 예외 발생, 맞는 `catch` 없음 | 호출자로 전파 | 5절 |
| `try`와 `catch`의 중괄호 | 문장이 하나여도 생략 불가 | 블록이 예외 표의 범위다 (5.2절). [Chapter 04](../04-control-statements)의 `if`와 다르다 |

예외가 나면 `try` 블록의 나머지는 건너뛰고, 예외 타입에 맞는 `catch`로 간다. `catch`가 끝나면 `try-catch` 다음 문장부터 정상 흐름이 재개된다. 예외가 나지 않으면 `catch`는 실행되지 않는다. 첫째 원리대로 실패는 흐름을 끊지만, `catch`가 그 흐름을 다시 잇는다.

### 4.1 catch는 위에서부터, 구체적인 것이 먼저

```java
try {
    ...
} catch (Exception e) {
    // 모든 예외가 여기서 잡힌다
} catch (ArithmeticException e) {
    // 컴파일 오류. 도달할 수 없다
}
```

`catch`는 위에서부터 차례로 "이 예외가 이 타입인가"를 묻고, 처음 맞는 곳에서 멈춘다. [Chapter 07](../07-oop-advanced)의 다형성 때문에 `ArithmeticException`은 `Exception`이기도 하므로, `Exception`을 먼저 두면 아래의 `catch`에는 아무것도 도달하지 못한다. 컴파일러는 이것을 "exception ArithmeticException has already been caught"로 잡는다. [Chapter 04](../04-control-statements)의 `else if`에서 좁은 조건을 먼저 두던 것과 같은 논리다.

### 4.2 멀티 catch

```java
try {
    ...
} catch (IOException | SQLException e) {
    // Java 7. 둘을 같은 방법으로 처리
    e.printStackTrace();
}
```

| 제약 | 왜 |
|:-----|:---|
| `\|`로 묶은 타입끼리 조상-자손이면 안 된다 | 조상만 쓰면 되는데 굳이 둘을 적는 것은 실수다. "cannot be related by subclassing" |
| `e`로는 공통 조상의 멤버만 쓸 수 있다 | 실행 전에는 둘 중 어느 쪽이 올지 모른다 |
| `e`는 다시 대입할 수 없다 | 타입이 둘 중 하나인 변수에 무엇을 넣어야 할지 정할 수 없다 |

### 4.3 예외가 들고 있는 정보

| 메서드 | 돌려주는 것 | 왜 필요한가 |
|:-----|:--------|:--------|
| `getMessage()` | 예외를 만들 때 넣은 메시지 | 무엇이 잘못됐는지. 값과 상태를 담는 자리 |
| `printStackTrace()` | 예외가 난 위치부터 호출 스택을 표준 오류로 출력 | 어디서 났는지. 디버깅의 첫 단서 |
| `getStackTrace()` | 그 스택을 배열로 | 로그에 담거나 분석할 때 |
| `getCause()` | 이 예외를 일으킨 원인 예외 (8절) | 왜 났는지. 감쌀 때 잃지 말아야 할 것 |
| `getSuppressed()` | 전파 중 억제된 예외들 (7.1절) | `close()`의 실패도 잃지 않는다 |

```text
java.lang.ArithmeticException: / by zero
    at Calc.divide(Calc.java:12)
    at Calc.run(Calc.java:7)
    at Calc.main(Calc.java:3)
```

셋째 원리의 첫 반쪽이다. 스택 트레이스는 위가 예외가 난 곳, 아래로 갈수록 호출한 쪽이다. [Chapter 06](../06-oop-basics)의 호출 스택을 위에서 아래로 찍은 것이다. 2절에서 말한 "예외 생성이 비싼" 이유가 이 기록이고, 디버깅할 때 가장 먼저 봐야 할 것도 이것이다.

---

## 5. 전파: 예외는 스택을 거슬러 올라간다

### 5.1 throw와 throws

```java
void withdraw(int amount) {
    if (amount <= 0) {
        throw new
            IllegalArgumentException(
                "출금액: " + amount);
    }
    if (balance < amount) {
        throw new IllegalStateException(
            "잔액 부족: " + balance
            + " < " + amount);
    }
    balance -= amount;
}

// 처리하지 않고 호출자에게 넘긴다
void readFile(String path)
        throws IOException {
    ...
}
```

| 키워드 | 자리 | 뜻 | 왜 둘인가 |
|:-----|:-----|:---|:-------|
| `throw` | 문장 | 예외 객체를 던진다 | 사건을 일으키는 쪽 |
| `throws` | 메서드 선언부 | 이 메서드가 던질 수 있는 예외를 알린다 | 책임지지 않고 호출자에게 넘긴다는 선언. checked는 처리하지 않으면 필수 |

`throw`는 예외를 던지는 문장이고, `throws`는 메서드가 어떤 예외를 던질 수 있는지 선언하는 것이다. `throws`에 적은 예외는 이 메서드가 책임지지 않고 호출자에게 넘긴다는 뜻이며, checked 예외는 처리하지 않을 거라면 반드시 이렇게 선언해야 한다. 메시지에 값과 상태를 담는 것은 셋째 원리다. "잔액 부족"만으로는 재현할 수 없고, `balance`와 `amount`가 있으면 로그만 보고 재현할 수 있다.

### 5.2 JVM은 예외를 어떻게 전파하는가

```text
throw
  │ 현재 메서드의 예외 표에서
  │ 이 위치를 덮는 catch를 찾는다
  ├─ 있다 ─▶ 그 catch로 점프
  └─ 없다 ─▶ 프레임을 걷고
            호출한 메서드에서 반복
```

컴파일러는 메서드마다 예외 표를 만든다. "이 범위의 코드에서 이 타입의 예외가 나면 저 위치로 가라"는 항목들의 목록이다. 예외가 던져지면 JVM은 지금 실행 중인 메서드의 표에서 현재 위치를 덮는 항목을 찾는다. 있으면 그 `catch`로 뛴다. 없으면 이 메서드의 프레임을 걷어 내고, 호출한 메서드로 돌아가 같은 일을 반복한다. 이 과정을 스택 되감기라 한다.

```java
static void main(String[] args) {
    try {
        method1();
    } catch (Exception e) {
        System.out.println("main 처리");
    }
}
static void method1() throws Exception {
    method2();
}
static void method2() throws Exception {
    throw new Exception("원인");
}
```

```text
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

| 아무도 잡지 않으면 | 결과 | 왜 |
|:------------|:-----|:---|
| 그 스레드 | 종료된다. JVM의 기본 처리기가 스택 트레이스를 찍는다 | 스택을 다 걷었는데 받을 곳이 없다 |
| `main` 스레드였다면 | 프로그램이 끝나고 종료 코드 1 | [Chapter 01](../01-java-intro)의 `void main`. 결과는 종료 코드로 |
| 다른 스레드였다면 | 그 스레드만 끝난다. `main`은 모른다 | 전파는 스택을 오르는 것이고 스레드마다 스택이 따로다 ([Chapter 13](../13-thread)) |

`method1`은 예외에 관한 코드가 한 줄도 없지만 예외는 그것을 지나 `main`에 닿는다. 2절에서 말한 "중간 메서드는 아무것도 하지 않아도 된다"가 이 동작이다. `main`까지 아무도 잡지 않으면 스레드가 종료되고, JVM의 기본 처리기가 스택 트레이스를 찍는다. `main` 스레드였다면 프로그램이 끝나고 [Chapter 01](../01-java-intro)에서 본 종료 코드 1이 운영체제에 전달된다.

{{< callout type="info" >}}
checked 예외는 이 전파를 **선언으로 드러내게** 한다. `method2`가 checked 예외를 던지면 `method1`도 처리하거나 선언해야 하고, 그것이 `main`까지 이어진다. 오버라이딩할 때 자손이 조상보다 많은 checked 예외를 선언할 수 없다는 [Chapter 07](../07-oop-advanced)의 규칙도 같은 이유다. 조상 타입으로 부르는 호출자는 조상의 `throws`만 보고 대비했기 때문이다.
{{< /callout >}}

### 5.3 어디서 처리할 것인가

```java
// 1. 여기서 복구할 수 있다면 잡는다
void load() {
    try {
        readFile("data.txt");
    } catch (IOException e) {
        useDefaults();
    }
}

// 2. 결정권이 호출자에게 있다면 넘긴다
void load() throws IOException {
    readFile("data.txt");
}

// 3. 기록만 하고 다시 던진다
void load() throws IOException {
    try {
        readFile("data.txt");
    } catch (IOException e) {
        log.error("읽기 실패", e);
        throw e;
    }
}
```

| 할 수 있는 것 | 선택 | 왜 |
|:---------|:-----|:---|
| 기본값으로 대체, 재시도처럼 복구할 수 있다 | 그 자리에서 잡는다 | 여기가 결정할 수 있는 곳이다 |
| 복구는 호출자가 정해야 한다 | 잡지 않고 `throws`로 넘긴다 | 결정권이 없는 곳에서 잡으면 삼키게 된다 |
| 기록은 남기되 결정은 못 한다 | 기록하고 다시 던진다 | 정보는 남기고 흐름은 끊긴 채로 둔다 |

셋째 원리의 둘째 반쪽이다. 기준은 하나다. 이 예외에 대해 무엇을 할 수 있는가. 기본값으로 대체하거나 재시도하는 것처럼 복구할 수 있으면 그 자리에서 잡는다. 할 수 있는 것이 없으면 잡지 않고 넘긴다. 처리할 수 없는 곳에서 잡는 것이 9절의 안티 패턴 대부분의 원인이다.

---

## 6. finally: 무슨 일이 있어도 실행된다

```java
try {
    ...
} catch (Exception e) {
    ...
} finally {
    // 예외가 났든 안 났든 실행된다
}
```

| 상황 | 실행 순서 | 왜 |
|:-----|:-------|:---|
| 예외 없음 | `try` 전부 → `finally` → 다음 문장 | 정상 종료 경로에 `finally`가 복사되어 있다 |
| 예외 발생, `catch` 일치 | `try` 일부 → `catch` → `finally` → 다음 문장 | `catch` 끝에도 복사되어 있다 |
| 예외 발생, `catch` 없음 | `try` 일부 → `finally` → 호출자로 전파 | 예외 표에 "어떤 예외든 잡아 `finally`를 돌린 뒤 다시 던지라"는 항목이 있다 |
| `try`나 `catch`에 `return` | 반환값 계산 → `finally` → 반환 | `return` 앞에도 복사되어 있다 |
| `System.exit()` | `finally`가 실행되지 않는다 | JVM 자체가 멈춘다. 유일한 예외 |

`finally`가 "항상" 실행되는 것은 컴파일러가 그렇게 만들기 때문이다. 컴파일러는 `try`와 `catch`가 끝나는 모든 경로, 즉 정상 종료, `return`, 잡히지 않은 예외 각각에 `finally`의 코드를 복사해 넣는다. 예외가 잡히지 않은 경로에는 5.2절의 예외 표에 "어떤 예외든 잡아서 `finally`를 실행한 뒤 다시 던지라"는 항목을 추가한다. 그래서 어느 경로로 나가든 `finally`를 거친다. 유일한 예외는 `System.exit()`처럼 JVM 자체를 멈추는 경우다.

```java
static int test() {
    try {
        return 1;
    } finally {
        // 1을 돌려주기 전에 실행된다
        System.out.println("finally");
    }
}
```

{{< callout type="warning" >}}
`finally` 안에서 `return`이나 `throw`를 쓰지 않는다. `try`에서 계산한 반환값이나 던진 예외를 `finally`의 것이 **덮어쓴다.** `try`에서 `return 1`을 했는데 `finally`가 `return 2`를 하면 2가 돌아가고, `try`의 예외는 흔적도 없이 사라진다. 셋째 원리를 어기는 가장 찾기 어려운 버그 중 하나다.
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
        try {
            reader.close();
        } catch (IOException ignore) {
            // close 예외는 갈 곳이 없다
        }
    }
}
```

| 이 패턴의 짐 | 왜 생기나 |
|:---------|:-------|
| `null` 검사 | 여는 데 실패했으면 닫을 것이 없다 |
| `close()`의 `try-catch` | `close()` 자체가 checked 예외를 던진다 |
| 예외 하나를 버린다 | 본문과 `close()`에서 둘 다 나면 나중 것이 앞 것을 덮는다 |

`finally`가 있는 이유는 자원 정리다. 파일, 소켓, DB 연결처럼 다 쓰면 반드시 닫아야 하는 자원은 예외가 나도 닫혀야 한다. 그런데 위 코드가 보여 주듯 이 패턴은 무겁다. `null` 검사가 필요하고, `close()` 자체가 예외를 던질 수 있으며, `try`와 `close()`에서 모두 예외가 나면 하나는 버려야 한다. 이 문제를 문법으로 푼 것이 다음 절이다.

---

## 7. try-with-resources: 닫는 일을 문법에 맡긴다

```java
try (
    var in = new FileInputStream("a");
    var out = new FileOutputStream("b")
) {
    int d;
    while ((d = in.read()) != -1) {
        out.write(d);
    }
}   // 끝나면 out.close(), in.close()
```

```text
try (A a = ...; B b = ...) {
  본문
}
→ 본문 종료 → b.close() → a.close()
  (선언의 역순. 나중 것이 먼저 닫힌다)
```

| 구분 | `finally`로 닫기 | `try-with-resources` | 왜 |
|:-----|:-------------|:------------------|:---|
| 닫는 코드 | 직접 쓴다 | 컴파일러가 넣는다 | 조건은 `AutoCloseable` 하나 |
| `null` 검사 | 필요 | 불필요 | 여는 데 실패하면 그 자원은 닫지 않는다 |
| 닫는 순서 | 내가 정한다 | 선언의 역순 | 나중 자원이 먼저 자원에 기댄다 |
| 두 예외가 나면 | 하나를 잃는다 | 본문 예외를 전파하고 `close()` 예외는 첨부한다 (7.1절) | 먼저 난 것이 진짜 원인이다 |

Java 7의 `try-with-resources`는 괄호 안에 선언한 자원을 본문이 끝날 때 자동으로 닫는다. 예외가 나도 닫고, `null` 검사도 필요 없다. 조건은 자원의 타입이 `AutoCloseable`을 구현하는 것뿐이다. 이 인터페이스는 `close()` 하나를 약속하고, 자바의 입출력 클래스들은 전부 이것을 구현한다.

```java
class MyResource
        implements AutoCloseable {
    @Override
    public void close() {
        System.out.println("해제");
    }
}
```

닫는 순서가 선언의 역순인 이유는 나중에 만든 자원이 먼저 만든 자원에 기대는 경우가 많기 때문이다. 파일 스트림 위에 버퍼 스트림을 얹었다면 버퍼를 먼저 닫아 남은 내용을 파일에 쓰고, 그다음 파일을 닫아야 한다.

### 7.1 억제된 예외

```text
본문에서 예외 X 발생
  └─ close()에서 예외 Y 발생
     X가 전파되고, Y는 X에 첨부된다
```

```java
try (MyResource r = new MyResource()) {
    throw new RuntimeException("본문");
} catch (Exception e) {
    e.getMessage();   // 본문 예외
    for (var s : e.getSuppressed()) {
        s.getMessage();  // close의 예외
    }
}
```

본문과 `close()`에서 모두 예외가 나면 어느 쪽을 전파해야 하는가. 6.1절의 `finally` 패턴에서는 나중에 난 `close()`의 예외가 본문의 예외를 덮어써 버렸다. 그러나 정말 알아야 할 것은 먼저 난 본문의 예외다. 그래서 `try-with-resources`는 본문의 예외를 전파하고 `close()`의 예외는 거기에 억제된 예외로 붙여 둔다. 둘 다 잃지 않으면서 중요한 쪽을 앞에 세운 것이다. 셋째 원리를 문법이 지켜 주는 자리다.

{{< callout type="info" >}}
자원을 다루는 코드는 `finally` 대신 `try-with-resources`를 쓴다. 짧고, `null` 검사가 없고, 예외를 잃지 않는다. Java 9부터는 이미 만들어 둔 변수도 사실상 `final`이면 `try (reader)`처럼 괄호에 바로 넣을 수 있다. 자원의 종류와 입출력 스트림은 [Chapter 15](../15-io)에서 다룬다.
{{< /callout >}}

---

## 8. 사용자 정의 예외와 원인 연결

### 8.1 예외 클래스 만들기

```java
// checked
class InsufficientBalanceException
        extends Exception {
    private final int balance;
    private final int amount;

    InsufficientBalanceException(
            String message,
            int balance, int amount) {
        super(message);
        this.balance = balance;
        this.amount = amount;
    }
    int getBalance() { return balance; }
    int getAmount() { return amount; }
}

// unchecked
class InvalidOrderException
        extends RuntimeException {
    InvalidOrderException(String msg) {
        super(msg);
    }
    InvalidOrderException(String msg,
            Throwable cause) {
        super(msg, cause);
    }
}
```

| 표준 예외로 부족할 때 | 사용자 정의 예외가 주는 것 | 왜 |
|:---------------|:---------------|:---|
| 실패에 도메인의 이름을 붙이고 싶다 | `InsufficientBalanceException` | `IllegalStateException`보다 무슨 일인지 말해 준다 |
| 실패에 관한 정보를 실어 보내고 싶다 | `balance`, `amount` 필드 | 호출자가 메시지를 파싱하지 않고 값을 쓴다 |
| checked로 할까 unchecked로 할까 | `Exception` / `RuntimeException` 상속 | 3.1절의 기준. 복구 전략이 분명하지 않으면 unchecked |
| 생성자 | `(String)`과 `(String, Throwable)` 둘 | 감쌀 때 원인을 넘길 자리가 있어야 한다 (8.2절) |

표준 예외로 부족한 때는 실패에 도메인의 이름을 붙이고 싶을 때, 그리고 실패에 관한 정보를 실어 보내고 싶을 때다. `IllegalStateException`보다 `InsufficientBalanceException`이 무슨 일인지 말해 주고, 잔액과 요청액을 필드로 담으면 호출자가 메시지를 파싱하지 않고도 값을 쓸 수 있다. `Exception`을 상속하면 checked, `RuntimeException`을 상속하면 unchecked이며, 3.1절의 기준대로 복구 전략이 분명하지 않으면 unchecked로 둔다. 원인을 받는 생성자 `(String, Throwable)`는 반드시 둔다. 이유가 다음 절이다.

### 8.2 원인을 잃지 않기: 연결된 예외

```java
class DataLoadException
        extends RuntimeException {
    DataLoadException(String msg,
            Throwable cause) {
        super(msg, cause);
    }
}

Config load(String path) {
    try {
        return parse(readFile(path));
    } catch (IOException e) {
        // e를 원인으로 넣는다
        throw new DataLoadException(
            "설정 실패: " + path, e);
    }
}
```

| 왜 감싸나 | 왜 `cause`를 넣나 |
|:-------|:-------------|
| 호출자가 `IOException`을 보고 "설정 로딩"이 실패한 줄 알기 어렵다 | 어느 파일이 왜 안 열렸는지가 사라진다 |
| 호출자가 파일이라는 구현 세부에 묶인다 | 스택 트레이스에 `Caused by:`로 이어져 찍히고 `getCause()`로 꺼낸다 |
| checked를 unchecked로 바꿔 `throws` 사슬을 끊는다 | 바꾸는 과정에서 원인을 잃지 않는다 |

셋째 원리의 셋째 반쪽이다. 낮은 계층의 예외를 그대로 올려 보내면 호출자는 `IOException`을 보고 "설정 로딩"이 실패한 것인지 알기 어렵고, 호출자가 파일이라는 구현 세부에 묶인다. 그래서 자기 계층의 예외로 감싸서 던진다. 이때 원래 예외를 `cause`로 넣지 않으면 진짜 원인, 즉 어느 파일이 왜 안 열렸는지가 사라진다. `cause`를 넣으면 스택 트레이스에 `Caused by:`로 원인이 이어져 찍히고 `getCause()`로 꺼낼 수 있다. 같은 방법으로 checked 예외를 unchecked로 바꿀 수 있다. 처리할 방법이 없는 `IOException`을 `throws`로 계속 올리는 대신 `RuntimeException`으로 감싸면 호출 사슬의 `throws` 선언이 사라진다. 3.1절의 논쟁에서 unchecked 쪽이 택한 실무적 타협이다.

```java
Order process(Order o) {
    try {
        validate(o);
        return repository.save(o);
    } catch (ValidationException e) {
        log.warn("검증 실패: {}",
            o.getId(), e);
        // 기록하고, 감싸서, 원인과 함께
        throw new
            OrderProcessingException(
                "주문 처리 실패", e);
    }
}
```

---

## 9. 안티 패턴과 그 이유

```java
try { doSomething(); }
catch (Exception e) { }   // 1. 삼킨다

try { doSomething(); }
catch (Exception e) {    // 2. 너무 넓게
    e.printStackTrace();
}

try { doSomething(); }
catch (IOException e) {  // 3. 원인 버림
    throw new RuntimeException("실패");
}

try {                    // 4. 흐름 제어
    value = Integer.parseInt(str);
} catch (NumberFormatException e) {
    value = 0;
}
```

| 안티 패턴 | 왜 문제인가 | 어느 원리를 어기나 |
|:-------|:--------|:------------|
| 빈 `catch` | 2절에서 예외를 택한 이유가 "무시할 수 없다"였는데 그것을 스스로 무너뜨린다. 실패가 조용히 묻힌다 | 첫째, 셋째 |
| `Exception`으로 넓게 잡기 | 예상한 실패와 예상 못 한 버그를 같이 잡는다. 버그가 "처리됐다"고 표시된 채 숨는다 | 둘째 |
| `cause` 없이 감싸기 | 스택 트레이스의 `Caused by:`가 사라져 원인을 추적할 수 없다 | 셋째 |
| 흐름 제어에 예외 | 예외 생성마다 스택을 기록하니 느리고, 읽는 사람은 실패인지 분기인지 구분할 수 없다 | 첫째. 사건이 아닌 것을 사건으로 |

```java
// 예외 대신 검증
if (str != null
        && str.matches("\\d+")) {
    value = Integer.parseInt(str);
}
```

| 원칙 | 왜 |
|:-----|:---|
| 구체적인 예외를 잡는다 | 무엇을 예상했는지 코드가 말한다 |
| 메시지에 값과 상태를 담는다 | 로그만 보고 재현할 수 있어야 한다 |
| 감쌀 때는 `cause`를 넘긴다 | 원인은 한 번 잃으면 되찾을 수 없다 |
| 처리할 수 있는 곳에서만 잡는다 | 할 수 있는 것이 없으면 넘기는 것이 맞다 |
| 예외는 예외적인 상황에만 | 예상되는 값의 분기는 `if`의 일이다 |

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 예외 | 실패를 흐름을 끊는 사건으로 | 반환값은 무시되고, 결과와 자리를 다투고, 손으로 올려야 한다 |
| 비용 | 생성 시 스택을 기록한다 | 어디서 났는지가 예외의 가치다. 그래서 흐름 제어에는 안 쓴다 |
| checked | 처리하거나 선언해야 컴파일된다 | 코드가 옳아도 나는 실패는 대비를 강제한다 |
| unchecked | 강제하지 않는다 | 어디서든 날 수 있고 대개 버그다 |
| `catch` 순서 | 구체적인 것이 먼저 | 위에서부터 처음 맞는 곳에서 멈춘다 |
| 전파 | 예외 표에 없으면 프레임을 걷고 위로 | 중간 메서드는 아무것도 안 해도 지나간다. 스레드 경계는 넘지 않는다 |
| 처리 위치 | 할 수 있는 것이 있는 곳 | 없는 곳에서 잡으면 삼키게 된다 |
| `finally` | 모든 경로에 복사되어 항상 실행 | `return`, `throw`로 덮어쓰지 않는다 |
| `try-with-resources` | 역순으로 자동 `close()`, 본문 예외 우선 | 나중 자원이 먼저 자원에 기댄다. 먼저 난 예외가 중요하다 |
| 사용자 정의 | 도메인 이름과 정보. `cause` 생성자 필수 | 감쌀 때 원인을 잃지 않는다 |
| 원인 연결 | 감싸되 `cause`를 넘긴다 | `Caused by:`가 진짜 원인을 보존한다 |

{{< callout type="info" >}}
**용어 정리**
- **예외 (Exception)**: 실행 중 드러난, 코드가 대응할 수 있는 비정상 상황. `Throwable`의 자손
- **에러 (Error)**: JVM 수준의 문제. 복구 대상이 아니다
- **checked / unchecked**: 처리나 선언을 컴파일러가 강제하는 예외 / 강제하지 않는 `RuntimeException` 계열과 `Error`
- **`throw` / `throws`**: 예외를 던지는 문장 / 메서드가 던질 수 있는 예외를 알리는 선언
- **`try-catch`**: 예외가 날 수 있는 범위와 그것을 받아 내는 자리. 구체적인 타입을 먼저
- **멀티 catch**: `A | B`로 여러 타입을 한 `catch`에서 같은 방법으로 처리하는 것 (Java 7)
- **스택 트레이스**: 예외가 만들어진 시점의 호출 스택 기록. 위가 난 곳, 아래가 부른 곳
- **예외 표**: 컴파일러가 메서드마다 만드는 "이 범위에서 이 예외면 저기로" 목록
- **스택 되감기**: 받을 `catch`가 없는 프레임을 걷어 내며 호출자로 올라가는 것
- **`finally`**: 모든 종료 경로에 복사되어 항상 실행되는 블록. 자원 정리가 본래 용도
- **`try-with-resources`**: `AutoCloseable` 자원을 역순으로 자동으로 닫는 문법 (Java 7)
- **억제된 예외**: `close()`에서 난 예외를 본문 예외에 첨부한 것. `getSuppressed()`
- **원인 (`cause`)**: 이 예외를 일으킨 예외. 감쌀 때 넘겨야 `Caused by:`로 이어진다
- **연결된 예외**: 낮은 계층의 예외를 자기 계층의 예외로 감싸되 원인을 잇는 것
{{< /callout >}}
