---
title: "Chapter 04. 조건문과 반복문"
date: 2025-12-30
weight: 4
---

프로그램은 위에서 아래로 한 문장씩 실행되는 것이 기본이다. 그 흐름을 갈라놓거나(조건문) 되돌리는(반복문) 문장이 **제어문**이다. 자바의 제어문은 C에서 거의 그대로 물려받았지만, 한 가지 방향으로 손을 봤다. **사람이 자주 하는 실수를 컴파일러가 잡게 하자.** 조건식에 `boolean`만 허용한 것, `goto`를 없애고 레이블 `break`를 둔 것, 나중에 `switch` 표현식으로 fall-through를 없앤 것이 모두 그 방향의 결정이다. 이 장은 각 문법이 왜 그렇게 생겼는지와 그래도 남아 있는 함정을 본다.

---

## 1. 조건문

### 1.1 if: 조건은 반드시 boolean이다

```java
if (조건식) {
    // 조건식이 true일 때 실행
}
```

```java
int num = 1;
if (num) { }          // 컴파일 오류
if (num != 0) { }     // 자바는 이렇게 써야 한다
```

C에서는 0이 아닌 값이면 참이라 `if (num)`이 된다. 자바가 이를 막은 이유는 C의 유명한 버그 때문이다. `if (x == 0)`을 `if (x = 0)`으로 잘못 쓰면 C에서는 대입의 결과 0이 거짓으로 평가되어 조용히 넘어간다. 자바에서는 `x = 0`의 결과가 `int`라 조건식에 올 수 없으니 컴파일이 실패한다. [Chapter 03](../03-java-operator)에서 비교 연산자의 결과가 `boolean`이라고 한 것과 짝을 이루는 규칙이다.

```java
if (score >= 90)
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다.");   // 조건과 무관하게 항상 실행된다
```

`if`는 바로 뒤의 **문장 하나**만 거느린다. 들여쓰기는 사람 눈을 위한 것이지 문법이 아니라서, 두 번째 줄은 `if`와 아무 관계가 없다. 여러 문장을 조건에 묶으려면 중괄호 블록으로 하나의 문장으로 만들어야 한다. 2014년 애플의 SSL 검증이 통째로 무력화된 "goto fail" 버그가 정확히 이 모양이었다. 한 줄이어도 블록을 쓰는 것이 관례인 이유다.

```java
if (score >= 90) {
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다.");
}   // 블록 뒤에는 세미콜론을 붙이지 않는다
```

### 1.2 if-else와 else if

```java
public String passOrFail(int score) {
    if (score >= 60) {
        return "합격";
    } else {
        return "불합격";
    }
}

public String passOrFail2(int score) {
    return score >= 60 ? "합격" : "불합격";   // 값 하나를 고르는 것이라면 조건 연산자
}
```

```java
public char grade(int score) {
    if (score >= 90) return 'A';
    else if (score >= 80) return 'B';
    else if (score >= 70) return 'C';
    else if (score >= 60) return 'D';
    else return 'F';
}
```

`else if`는 새로운 문법이 아니라 `else` 뒤에 `if`문이 온 것이다. 그래서 조건은 **위에서부터 차례로** 검사되고 처음 참이 된 곳에서 끝난다. 이 순서 때문에 범위가 겹치는 조건은 좁은 것을 먼저 써야 한다.

```java
if (score >= 60) {
    grade = 'D';
} else if (score >= 90) {   // 90 이상도 이미 위에서 걸렸다. 절대 도달하지 않는다
    grade = 'A';
}
```

### 1.3 중첩보다 조기 반환

```java
// 중첩: 조건이 셋만 되어도 읽기 어렵다
public void processOrder(Order order) {
    if (order != null) {
        if (order.isValid()) {
            if (order.hasStock()) {
                order.process();
            }
        }
    }
}

// 조기 반환(guard clause): 안 되는 경우를 먼저 내보낸다
public void processOrder(Order order) {
    if (order == null) return;
    if (!order.isValid()) return;
    if (!order.hasStock()) return;

    order.process();
}
```

두 코드는 같은 일을 하지만 읽는 비용이 다르다. 중첩된 `if`를 읽으려면 바깥 조건을 머릿속에 쌓아 둔 채 안으로 들어가야 한다. 조기 반환은 각 줄이 독립적이다. "주문이 없으면 끝", "유효하지 않으면 끝"을 한 줄씩 읽고 잊어도 된다. 본래의 처리가 들여쓰기 없이 맨 아래에 놓이는 것도 장점이다.

### 1.4 switch: 값을 보고 점프한다

```java
switch (조건식) {
    case 값1:
        // 값1과 같을 때
        break;
    case 값2:
        // 값2와 같을 때
        break;
    default:
        // 어느 case와도 같지 않을 때
}
```

```
switch (x)      x == 값2 라면
  case 값1: A
  case 값2: B  ◀── 여기로 점프
  case 값3: C      break가 없으면
  default:  D      C, D까지 실행
```

`if-else if`는 조건을 하나씩 검사하지만 `switch`는 값을 보고 해당 `case`로 **바로 뛴다.** 컴파일러가 `case` 값들로 점프 테이블을 미리 만들어 두기 때문이다. 이 구조가 `switch`의 제약 전부를 설명한다.

| 제약 | 이유 |
|:-----|:-----|
| 조건식은 정수(`int` 이하), `char`, `String`, `enum`만 | 점프 테이블은 정수 키로 동작한다. `long`, 실수, `boolean`은 안 된다 |
| `case` 값은 상수만. 변수는 안 된다 | 테이블을 **컴파일 시점**에 만들어야 한다 |
| `case` 값은 서로 달라야 한다 | 같은 키가 둘이면 어디로 뛸지 정할 수 없다 |
| `case` 값은 조건식과 같은 타입 | 키의 타입이 하나여야 한다 |

```java
final int OPTION_A = 1;
int variable = 2;

switch (choice) {
    case 1: break;
    case OPTION_A: break;   // 컴파일 오류. 값 1과 겹친다
    case variable: break;   // 컴파일 오류. 변수는 상수가 아니다
}
```

문자열이 되는 이유는 컴파일러가 트릭을 쓰기 때문이다. `switch (s)`는 `switch (s.hashCode())`로 바뀌고, 해시가 같은 `case`에서 `equals()`로 다시 확인한다. 상수여야 컴파일 시점에 해시를 계산할 수 있다. 이 트릭의 부작용이 하나 있다. `s`가 `null`이면 `hashCode()`를 부르는 순간 `NullPointerException`이다. `enum`은 순서 값을 키로 쓰며, 상수의 순서가 바뀌어도 깨지지 않도록 컴파일러가 대응표를 따로 만든다.

**fall-through.** `case`로 뛴 뒤에는 `break`를 만날 때까지 아래로 계속 실행된다. 점프 테이블은 "어디서 시작할지"만 정하지 "어디서 멈출지"는 정하지 않기 때문이다. C에서 물려받은 이 동작은 `break`를 빠뜨리면 다음 `case`가 딸려 실행되는 버그의 원인이지만, 의도적으로 쓰면 여러 값을 묶을 수 있다.

```java
switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12:
        days = 31; break;                    // 일곱 값이 같은 문장을 공유한다
    case 4: case 6: case 9: case 11:
        days = 30; break;
    case 2:
        days = isLeapYear ? 29 : 28; break;
    default:
        days = -1;
}

switch (userLevel) {
    case 3: grantDelete();   // 3은 아래로 흘러 2, 1의 권한도 받는다
    case 2: grantWrite();
    case 1: grantRead(); break;
    default: denyAll();
}
```

### 1.5 switch 표현식: 값을 돌려주고 흘러내리지 않는다

```java
// 문장으로 쓴 switch. 변수를 밖에 두고 case마다 대입과 break
String dayType;
switch (day) {
    case MONDAY: case TUESDAY: case WEDNESDAY: case THURSDAY: case FRIDAY:
        dayType = "평일"; break;
    case SATURDAY: case SUNDAY:
        dayType = "주말"; break;
    default:
        dayType = "알 수 없음";
}

// Java 14의 switch 표현식
String dayType = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "평일";
    case SATURDAY, SUNDAY                            -> "주말";
};
```

`switch`를 쓰는 자리의 대부분은 "값에 따라 결과 하나를 정하는" 곳이었다. 그런데 문장 형태의 `switch`는 값을 돌려주지 못해 변수를 밖에 선언하고 `case`마다 대입해야 했고, `break`를 빠뜨리면 조용히 틀렸다. Java 14의 `switch` 표현식은 이 두 문제를 함께 푼다.

| 특징 | 내용 | 이유 |
|:-----|:-----|:-----|
| 값을 돌려준다 | 대입의 오른쪽에 올 수 있다 | 3장의 "연산자는 값을 돌려준다"와 같은 원리 |
| `->` 뒤는 흘러내리지 않는다 | `break`가 필요 없다 | 각 `case`가 독립된 결과다 |
| 여러 값은 쉼표로 | `case A, B ->` | fall-through로 묶던 것을 문법으로 |
| 모든 경우를 다뤄야 한다 | `default`가 없으면 컴파일 오류. `enum`은 상수 전부를 쓰면 생략 가능 | 값을 돌려줘야 하는데 빠진 경우가 있으면 안 된다 |

```java
int numLetters = switch (day) {
    case MONDAY, FRIDAY, SUNDAY -> 6;
    case TUESDAY                -> 7;
    case THURSDAY, SATURDAY     -> 8;
    case WEDNESDAY -> {
        System.out.println("수요일");
        yield 9;                            // 블록에서는 yield로 값을 낸다
    }
};
```

{{< callout type="info" >}}
Java 21부터 `switch`는 값의 **타입**으로도 분기한다. `case Integer i when i > 0 ->`처럼 타입과 조건을 함께 쓰고, `case null ->`로 `null`도 다룰 수 있다. 3장에서 본 `instanceof` 패턴 매칭이 `switch`로 확장된 것이며, 상속 구조를 다루는 [Chapter 07](../07-oop-advanced) 이후에 다시 만난다.
{{< /callout >}}

---

## 2. 반복문

| 반복문 | 언제 | 특징 |
|:-------|:-----|:-----|
| `for` | 반복 횟수가 정해져 있을 때 | 초기화, 조건, 증감이 한 줄에 모인다 |
| `while` | 조건이 유지되는 동안 | 횟수를 모른다 |
| `do-while` | 일단 한 번은 실행해야 할 때 | 본문이 조건보다 먼저 |

셋은 서로 바꿔 쓸 수 있다. 어느 것을 고르느냐는 성능이 아니라 **읽는 사람에게 무엇을 말하고 싶은가**의 문제다. `for`는 "몇 번 돈다"를, `while`은 "무엇이 참인 동안 돈다"를 첫 줄에서 말한다.

### 2.1 for

```java
for (초기화; 조건식; 증감식) {
    // 반복할 문장
}
```

```
1. 초기화 (최초 1회만)
       │
       ▼
2. 조건식 평가
   false면 종료
       │
       ▼
3. 블록 내 문장 수행
       │
       ▼
4. 증감식 실행
       │
       └─→ 2번으로 돌아감
```

```java
for (int i = 0; i < 10; i++) { }              // 0부터 9까지
for (int i = 10; i > 0; i--) { }              // 감소
for (int i = 0; i < 10; i += 2) { }           // 0, 2, 4, 6, 8
for (int i = 0, j = 10; i < j; i++, j--) { }  // 변수 둘
for (;;) { }                                  // 무한 반복. 세 부분 모두 생략 가능
```

초기화가 한 번만 실행되고 증감식이 본문 **뒤에** 온다는 순서를 알면 나머지는 따라온다. 초기화에서 선언한 변수는 `for`문 안에서만 살아서, 같은 이름 `i`를 다음 `for`문에서 다시 쓸 수 있다. 세 부분을 모두 비운 `for (;;)`가 허용되는 이유는 조건식을 생략하면 `true`로 취급한다고 정해져 있기 때문이다.

### 2.2 향상된 for: 인덱스 없이 요소만

```java
int[] numbers = {1, 2, 3, 4, 5};

for (int i = 0; i < numbers.length; i++) {    // 인덱스로 접근
    System.out.println(numbers[i]);
}

for (int num : numbers) {                      // 요소를 하나씩 받는다
    System.out.println(num);
}

List<String> names = List.of("Alice", "Bob");
for (String name : names) { }                  // 컬렉션도 같은 모양
```

Java 5의 향상된 `for`는 새로운 반복이 아니라 컴파일러가 대신 써 주는 반복이다. 배열이면 인덱스 반복문으로, 컬렉션이면 `Iterator`를 쓰는 반복문으로 바뀐다. 이 사실에서 제약이 나온다.

| 할 수 없는 것 | 이유 |
|:--------------|:-----|
| 인덱스를 쓸 수 없다 | 컴파일러가 만든 인덱스는 코드에서 보이지 않는다 |
| 요소 변수에 대입해도 원본은 안 바뀐다 | `num`은 요소를 복사한 별도 변수다. 참조형이면 객체 자체는 바꿀 수 있다 |
| 역순으로 돌 수 없다 | 항상 처음부터 끝까지 한 방향이다 |
| 돌면서 컬렉션에 요소를 넣거나 뺄 수 없다 | 내부의 `Iterator`가 변경을 감지해 `ConcurrentModificationException`을 던진다 |

```java
for (int num : numbers) {
    num = num * 2;          // 복사본이 바뀔 뿐. numbers는 그대로
}
```

마지막 줄의 예외는 실무에서 자주 만난다. 반복 도중에 요소를 지우려면 `Iterator`의 `remove()`나 `removeIf()`를 써야 하는데, 그 이유는 [Chapter 11](../11-collections-framework)에서 컬렉션의 내부를 볼 때 분명해진다.

### 2.3 while

```java
while (조건식) {
    // 조건식이 true인 동안 반복
}
```

```java
int i = 0;                     // for (int i = 0; i < 10; i++) 와 같다
while (i < 10) {
    System.out.println(i);
    i++;
}

String line;                   // 횟수를 모를 때 while이 자연스럽다
while ((line = reader.readLine()) != null) {
    System.out.println(line);
}
```

`for`가 초기화·조건·증감을 한 줄에 모은 것이라면 `while`은 조건만 남긴 것이다. 횟수가 아니라 "파일이 끝날 때까지", "사용자가 종료를 입력할 때까지"처럼 상태로 반복을 말할 때 어울린다. `for (;;)`와 달리 `while ()`은 컴파일 오류다. `for`의 조건은 생략하면 `true`라는 기본값이 있지만 `while`에는 그런 규칙이 없다. 무한 반복은 `while (true)`라고 쓴다.

### 2.4 do-while: 일단 한 번은 실행한다

```
while:     조건 ─▶ 본문 ─▶ 조건 ─▶ …
do-while:  본문 ─▶ 조건 ─▶ 본문 ─▶ …
           (본문이 최소 한 번)
```

```java
int number;
do {
    System.out.print("1~10 사이의 숫자: ");
    number = scanner.nextInt();
} while (number < 1 || number > 10);   // 세미콜론이 필요하다
```

입력을 받아 검사하는 코드는 검사할 값을 얻으려면 먼저 한 번 실행해야 한다. `while`로 쓰면 첫 입력을 반복문 밖에서 따로 받아야 하는데, `do-while`은 그 중복을 없앤다. 끝에 세미콜론이 붙는 이유는 `while (조건식)`으로 문장이 끝나기 때문이다. `while`문의 `while (조건식)` 뒤에는 블록이 오지만 여기서는 아무것도 오지 않는다.

### 2.5 break와 continue

```java
for (int i = 0; i < numbers.length; i++) {
    if (numbers[i] == target) {
        index = i;
        break;                 // 찾았으니 나머지는 볼 필요가 없다
    }
}

for (int i = 1; i <= 10; i++) {
    if (i % 2 == 0) continue;  // 짝수는 이번 회차를 건너뛴다
    System.out.println(i);     // 1, 3, 5, 7, 9
}
```

`break`는 가장 가까운 반복문(또는 `switch`)을 빠져나가고, `continue`는 이번 회차의 나머지를 건너뛰고 다음 회차로 간다. `continue`가 "어디로" 가는지가 반복문마다 달라서 함정이 생긴다.

```
for:   continue ─▶ 증감식 ─▶ 조건식
while: continue ─▶ 조건식 (증감 건너뜀)
```

```java
int i = 0;
while (i < 5) {
    if (i == 2) continue;      // i++를 건너뛴다. i는 영원히 2
    System.out.println(i);
    i++;
}
```

`for`에서는 `continue`가 증감식을 거쳐 조건식으로 가지만, `while`에는 증감식이라는 자리가 없다. 본문 안에 있는 `i++`는 그냥 문장이라 `continue`가 건너뛴다. `while`에서 `continue`를 쓸 때는 증감을 `continue` 앞에 두어야 한다.

### 2.6 레이블: goto 없이 바깥 반복문을 벗어난다

```java
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (i == 1 && j == 1) {
            break outer;           // 안쪽만이 아니라 outer 전체를 빠져나간다
        }
        System.out.println(i + "," + j);   // 0,0  0,1  0,2  1,0
    }
}
```

`break`는 가장 가까운 반복문만 벗어난다. 중첩된 반복문을 한 번에 빠져나가려면 C에서는 `goto`를 썼다. 자바는 `goto`를 예약어로만 남겨 두고 문법에서 없앴다. 아무 데로나 뛸 수 있는 `goto`는 흐름을 따라 읽을 수 없게 만들기 때문이다. 대신 반복문에 이름을 붙이고 `break 이름`, `continue 이름`으로 **그 반복문까지만** 벗어나거나 건너뛰게 했다. 뛸 수 있는 곳이 자기를 감싼 반복문으로 제한되어 있어, 흐름이 위로 올라갈 뿐 옆으로 새지 않는다.

```java
Loop1:
for (int i = 2; i <= 9; i++) {
    for (int j = 1; j <= 9; j++) {
        if (j == 5) {
            break Loop1;          // 구구단 전체 종료
            // break;             // 이 단만 4까지 출력하고 다음 단으로
            // continue Loop1;    // 위와 같은 결과. 다음 i로
        }
        System.out.println(i + " x " + j + " = " + (i * j));
    }
}
```

---

## 3. 실전 패턴

### 3.1 무한 반복과 탈출 조건

```java
while (true) {                            // 서버의 메인 반복
    Request request = server.accept();
    if (request.isShutdown()) break;      // 종료 조건은 안에서
    process(request);
}

int attempt = 0;                          // 재시도
boolean success = false;
while (attempt < maxRetries && !success) {
    try {
        doSomething();
        success = true;
    } catch (Exception e) {
        attempt++;
    }
}
```

"언제 끝날지 처음에는 모르는" 반복은 조건을 억지로 앞에 두는 것보다 `while (true)`에 `break`를 두는 편이 정직하다. 다만 `break`가 여러 곳에 흩어지면 종료 조건을 한눈에 볼 수 없으니, 재시도처럼 조건을 말로 표현할 수 있으면 조건식에 담는다.

### 3.2 안쪽 반복문에서 같은 계산을 반복하지 않는다

```java
for (int i = 0; i < 1000; i++) {
    for (int j = 0; j < 1000; j++) {
        int r = expensive(i) + j;          // i가 같은데 천 번 다시 계산한다
    }
}

for (int i = 0; i < 1000; i++) {
    int cached = expensive(i);             // 바깥에서 한 번
    for (int j = 0; j < 1000; j++) {
        int r = cached + j;
    }
}
```

안쪽 반복문의 본문은 바깥 횟수 × 안쪽 횟수만큼 실행된다. 안쪽에서 바뀌지 않는 값은 바깥으로 끌어올린다. JIT가 알아서 해 주기도 하지만, 메서드 호출에 부작용이 있을 수 있어 컴파일러가 손대지 못하는 경우가 많다.

### 3.3 조건을 이름 붙은 메서드로

```java
if (user != null && user.isActive() && user.hasPermission("admin")
    && !user.isLocked() && user.getLoginAttempts() < 5) { }

if (canAccessAdminPanel(user)) { }

private boolean canAccessAdminPanel(User user) {
    if (user == null) return false;
    if (!user.isActive()) return false;
    if (!user.hasPermission("admin")) return false;
    if (user.isLocked()) return false;
    return user.getLoginAttempts() < 5;
}
```

조건이 길어지면 무엇을 검사하는지가 아니라 어떻게 검사하는지만 보인다. 메서드 이름이 "무엇"을 말하고, 1.3절의 조기 반환이 "어떻게"를 한 줄씩 풀어 준다.

### 3.4 타입으로 분기하고 있다면 다형성을 떠올린다

```java
public double pay(Employee e) {
    switch (e.getType()) {
        case HOURLY:     return e.getHours() * e.getHourlyRate();
        case SALARIED:   return e.getMonthlySalary();
        case COMMISSION: return e.getBaseSalary() + e.getSales() * 0.1;
        default: throw new IllegalArgumentException();
    }
}
```

직원의 종류마다 급여 계산이 다르다면, 종류가 늘 때마다 이 `switch`와 비슷한 `switch`들이 코드 곳곳에서 함께 늘어난다. 종류별 계산을 각 클래스의 메서드로 옮기면 `e.pay()` 한 줄이 되고, 새 종류는 클래스 하나를 추가하는 것으로 끝난다. 이것이 [Chapter 07](../07-oop-advanced)에서 볼 다형성이고, `switch`가 타입을 나누고 있다면 그 신호로 읽으면 된다.

---

## 4. 성능에 관한 두 가지

**조건의 순서.** `&&`와 `||`는 3장에서 본 대로 왼쪽에서 결과가 정해지면 오른쪽을 보지 않는다. 그러니 값싼 조건을 앞에, 비싼 조건을 뒤에 둔다.

```java
if (expensiveDatabaseCheck() && obj != null) { }   // null이어도 DB에 먼저 간다
if (obj != null && expensiveDatabaseCheck()) { }   // null이면 DB에 가지 않는다
```

**switch와 if-else.** `case` 값이 촘촘하면 컴파일러는 `switch`를 점프 테이블로 만들어 비교 없이 한 번에 뛰고, 듬성듬성하면 정렬된 키를 탐색하는 방식을 고른다. `if-else if`는 위에서부터 하나씩 비교한다. 이론상 `switch`가 유리하지만 JIT가 둘 다 잘 최적화하므로 실제 차이는 대부분 측정되지 않는다. 고르는 기준은 성능이 아니라 의도다. 값 하나로 갈라지면 `switch`, 서로 다른 조건들이면 `if`다.

---

## 5. 요약

| 제어문 | 핵심 | 왜 |
|:-------|:-----|:---|
| `if` | 조건은 `boolean`. 블록은 항상 쓴다 | `if (x = 0)` 같은 실수를 컴파일러가 잡는다. 들여쓰기는 문법이 아니다 |
| `else if` | 좁은 조건을 먼저 | 위에서부터 차례로 검사하고 처음 참에서 끝난다 |
| 조기 반환 | 안 되는 경우를 먼저 내보낸다 | 각 조건을 독립적으로 읽을 수 있다 |
| `switch` | 상수 값으로 점프. `break`로 멈춘다 | 점프 테이블을 컴파일 시점에 만든다. 시작만 정하고 끝은 정하지 않는다 |
| 문자열 `switch` | `null`이면 NPE | `hashCode()`로 바꿔 분기한다 |
| `switch` 표현식 | 값을 돌려주고 흘러내리지 않는다. 모든 경우 필수 | 대부분의 `switch`는 값 하나를 정하는 데 쓰였다 |
| `for` | 횟수 반복. `for (;;)`는 무한 | 조건 생략 시 `true`가 기본값 |
| 향상된 `for` | 요소만. 인덱스·역순·삭제 불가 | 컴파일러가 인덱스 또는 `Iterator` 반복으로 바꾼다 |
| `while`, `do-while` | 조건 반복. `do`는 최소 한 번 | 검사할 값을 먼저 얻어야 하는 경우가 있다 |
| `continue` | `while`에서는 증감을 `continue` 앞에 | `while`에는 증감식 자리가 없다 |
| 레이블 | `break 이름`으로 바깥 반복문 탈출 | `goto`를 없애고 감싼 반복문으로만 뛰게 했다 |
