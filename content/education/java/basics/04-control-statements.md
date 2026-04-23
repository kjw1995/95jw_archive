---
title: "Chapter 04. 조건문과 반복문"
weight: 4
---

프로그램의 흐름을 바꾸는 조건문(if, switch)과 반복문(for, while, do-while), 그리고 break·continue·레이블을 통한 흐름 제어를 다룬다.

---

## 1. 조건문 (Conditional Statements)

조건문은 조건식의 결과에 따라 실행할 문장을 결정한다. 조건식과 문장을 블록 `{}`으로 묶어 구성한다.

### 1.1 if문

가장 기본적인 조건문이다.

```java
if (조건식) {
    // 조건식이 true일 때 수행
}
```

{{< callout type="info">}}
**조건식의 결과는 반드시 boolean이어야 한다.** C/C++과 달리 Java는 정수나 참조형을 조건식에 직접 사용할 수 없다.
{{< /callout >}}

```java
int num = 1;
// if (num) { }       // 컴파일 에러
if (num != 0) { }     // 올바른 방법
```

#### 블럭(Block)

중괄호 `{}`로 여러 문장을 묶어 하나의 단위로 다룬다.

```java
if (score >= 90) {
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다.");
}  // 블럭 끝에는 세미콜론을 붙이지 않는다
```

{{< callout type="warning" >}}
**블럭을 생략하면 조건에 영향받는 문장은 한 줄뿐이다.** 아래 예시에서 두 번째 `println`은 조건과 무관하게 항상 실행된다. 실수를 막기 위해 단일 문장이더라도 항상 블럭을 쓰는 것이 좋다.
{{< /callout >}}

```java
// 블럭 없이 작성 - 함정
if (score >= 90)
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다.");  // 항상 실행!

// 권장: 항상 블럭 사용
if (score >= 90) {
    System.out.println("A등급입니다.");
}
```

### 1.2 if-else문

```java
if (조건식) {
    // 참일 때
} else {
    // 거짓일 때
}
```

```java
public String getPassOrFail(int score) {
    if (score >= 60) {
        return "합격";
    } else {
        return "불합격";
    }
}

// 삼항 연산자로 간단히
public String getPassOrFail2(int score) {
    return score >= 60 ? "합격" : "불합격";
}
```

### 1.3 if-else if문

세 가지 이상의 분기를 처리할 때 쓴다.

```java
if (조건식1) {
    // 조건식1이 참일 때
} else if (조건식2) {
    // 조건식2가 참일 때
} else {
    // 그 외
}
```

```java
public char getGrade(int score) {
    if (score >= 90) return 'A';
    else if (score >= 80) return 'B';
    else if (score >= 70) return 'C';
    else if (score >= 60) return 'D';
    else return 'F';
}
```

{{< callout type="warning" >}}
**조건 순서가 중요하다.** 조건식은 위에서부터 순서대로 평가되므로, **범위가 좁은 조건을 먼저** 검사해야 한다.
{{< /callout >}}

```java
// 잘못된 예 - 모든 양수가 첫 번째 조건에 걸림
if (score >= 60) {
    grade = 'D';
} else if (score >= 90) {   // 도달 불가
    grade = 'A';
}

// 올바른 예
if (score >= 90) {
    grade = 'A';
} else if (score >= 60) {
    grade = 'D';
}
```

### 1.4 중첩 if문과 Guard Clause

```java
if (score >= 90) {
    if (score >= 95) {
        System.out.println("A+");
    } else {
        System.out.println("A");
    }
}
```

중첩이 깊어지면 읽기 어려워진다. **Guard Clause(조기 반환)** 패턴으로 평탄화할 수 있다.

```java
// 중첩된 if문 (피해야 할 패턴)
public void processOrder(Order order) {
    if (order != null) {
        if (order.isValid()) {
            if (order.hasStock()) {
                order.process();
            }
        }
    }
}

// Guard Clause 적용
public void processOrder(Order order) {
    if (order == null) return;
    if (!order.isValid()) return;
    if (!order.hasStock()) return;

    order.process();
}
```

### 1.5 switch문

하나의 값으로 많은 경우의 수를 나누고 싶을 때 쓴다.

```java
switch (조건식) {
    case 값1:
        // 값1과 일치
        break;
    case 값2:
        // 값2와 일치
        break;
    default:
        // 일치하는 case가 없을 때
}
```

**동작 순서:**

1. 조건식 평가
2. 일치하는 `case`로 점프
3. 이후 문장을 순차적으로 수행
4. `break` 또는 `switch`의 끝을 만나면 탈출

#### switch문 제약 조건

{{< callout type="info" >}}
**switch문의 제약:**
1. 조건식의 결과는 **정수, 문자열, enum** 중 하나여야 한다
2. `case`의 값은 **상수(리터럴 또는 `final` 변수)** 만 가능하며, 중복되지 않아야 한다
3. `case`의 값은 조건식과 같은 타입이어야 한다
{{< /callout >}}

```java
final int OPTION_A = 1;
int variable = 2;

switch (choice) {
    case 1:
        break;
    case OPTION_A:   // 컴파일 에러! 값 1과 중복
        break;
    case variable:   // 컴파일 에러! 변수는 불가
        break;
}
```

#### Fall-through (break 생략)

`break`를 생략하면 다음 `case`까지 계속 실행된다. 의도적으로 활용할 수 있다.

```java
// 권한 단계 - 상위 권한은 하위 권한을 포함
switch (userLevel) {
    case 3:
        grantDelete();
        // fall through
    case 2:
        grantWrite();
        // fall through
    case 1:
        grantRead();
        break;
    default:
        denyAll();
}

// 여러 case 그룹화
int days;
switch (month) {
    case 1: case 3: case 5: case 7:
    case 8: case 10: case 12:
        days = 31; break;
    case 4: case 6: case 9: case 11:
        days = 30; break;
    case 2:
        days = isLeapYear ? 29 : 28; break;
    default:
        days = -1;
}
```

### 1.6 Switch 표현식 (Java 14+)

Java 14부터 `switch`를 **표현식**으로 사용할 수 있다. 값을 바로 반환하며, fall-through가 없어 안전하다.

```java
// 기존 switch문
String dayType;
switch (day) {
    case MONDAY: case TUESDAY: case WEDNESDAY:
    case THURSDAY: case FRIDAY:
        dayType = "평일"; break;
    case SATURDAY: case SUNDAY:
        dayType = "주말"; break;
    default:
        dayType = "알 수 없음";
}

// Java 14+ switch 표현식
String dayType = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY,
         THURSDAY, FRIDAY          -> "평일";
    case SATURDAY, SUNDAY          -> "주말";
};
```

**화살표 레이블(`->`) 특징:**

- `break` 불필요
- fall-through 없음
- 여러 값을 쉼표로 그룹화 가능

**yield 키워드:**

블럭이 필요한 경우 `yield`로 값을 반환한다.

```java
int numLetters = switch (day) {
    case MONDAY, FRIDAY, SUNDAY -> 6;
    case TUESDAY                -> 7;
    case THURSDAY, SATURDAY     -> 8;
    case WEDNESDAY -> {
        System.out.println("수요일");
        yield 9;    // 블럭에서 값 반환
    }
};
```

---

## 2. 반복문 (Loop Statements)

| 반복문 | 특징 | 적합한 상황 |
|:-------|:-----|:-----------|
| `for` | 반복 횟수가 명확 | 카운터 기반 반복 |
| `while` | 조건 기반 반복 | 횟수 불명확, 조건 중심 |
| `do-while` | 최소 1회 실행 보장 | 입력 검증, 메뉴 시스템 |

### 2.1 for문

```java
for (초기화; 조건식; 증감식) {
    // 반복할 문장
}
```

**실행 순서:**

```
1. 초기화 (최초 1회만)
       │
       ▼
2. 조건식 평가
   false면 종료
       │
       ▼
3. 블럭 내 문장 수행
       │
       ▼
4. 증감식 실행
       │
       └─→ 2번으로 돌아감
```

**예제:**

```java
// 기본
for (int i = 0; i < 10; i++) {
    System.out.println(i);
}

// 감소
for (int i = 10; i > 0; i--) { }

// 2씩 증가
for (int i = 0; i < 10; i += 2) { }   // 0, 2, 4, 6, 8

// 다중 변수
for (int i = 0, j = 10; i < j; i++, j--) { }

// 무한 루프
for (;;) {
    // 내부에서 break
}
```

#### 향상된 for문 (for-each)

배열이나 컬렉션을 순회할 때 간결하다.

```java
for (타입 변수명 : 배열또는컬렉션) {
    // 반복할 문장
}
```

```java
int[] numbers = {1, 2, 3, 4, 5};

// 기존 for문
for (int i = 0; i < numbers.length; i++) {
    System.out.println(numbers[i]);
}

// 향상된 for문
for (int num : numbers) {
    System.out.println(num);
}

// 컬렉션
List<String> names = List.of("Alice", "Bob", "Charlie");
for (String name : names) {
    System.out.println(name);
}
```

{{< callout type="warning" >}}
**향상된 for문의 제약:**
1. 인덱스에 접근할 수 없다
2. 요소 변수에 대입해도 **원본에는 영향이 없다** (단, 참조 타입의 내부 상태 수정은 반영됨)
3. 역순 순회가 불가능하다
{{< /callout >}}

```java
for (int num : numbers) {
    num = num * 2;   // 원본 배열은 바뀌지 않는다
}
```

### 2.2 while문

조건식이 참인 동안 반복한다.

```java
while (조건식) {
    // 반복할 문장
}
```

```java
// for와 while 상호 치환 가능
for (int i = 0; i < 10; i++) {
    System.out.println(i);
}

int i = 0;
while (i < 10) {
    System.out.println(i);
    i++;
}
```

**while이 자연스러운 상황:**

```java
// 사용자 입력 처리
Scanner scanner = new Scanner(System.in);
String input = "";
while (!input.equals("quit")) {
    System.out.print("명령어: ");
    input = scanner.nextLine();
    processCommand(input);
}

// 파일 한 줄씩 읽기
try (BufferedReader reader = new BufferedReader(new FileReader("file.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}
```

{{< callout type="info" >}}
**for문과 달리 `while`의 조건식은 생략할 수 없다.** `while () { }`는 컴파일 에러이며, 무한 루프는 `while (true)`로 명시한다.
{{< /callout >}}

### 2.3 do-while문

블럭을 먼저 실행한 후 조건을 평가한다. **최소 한 번의 실행이 보장**된다.

```java
do {
    // 먼저 실행
} while (조건식);   // 세미콜론 필수
```

**메뉴 시스템 예제:**

```java
Scanner scanner = new Scanner(System.in);
int choice;

do {
    System.out.println("=== 메뉴 ===");
    System.out.println("1. 조회 / 2. 등록 / 3. 삭제 / 0. 종료");
    System.out.print("선택: ");
    choice = scanner.nextInt();

    switch (choice) {
        case 1 -> search();
        case 2 -> register();
        case 3 -> delete();
        case 0 -> System.out.println("종료");
        default -> System.out.println("잘못된 선택");
    }
} while (choice != 0);
```

**입력 검증:**

```java
int number;
do {
    System.out.print("1~10 사이의 숫자: ");
    number = scanner.nextInt();
} while (number < 1 || number > 10);
```

### 2.4 break문

가장 가까운 반복문(또는 switch)을 **즉시 벗어난다**.

```java
for (int i = 0; i < 100; i++) {
    if (i == 10) break;
    System.out.println(i);
}
// break 후 이곳으로 이동
```

**검색 패턴:**

```java
int[] numbers = {5, 12, 7, 23, 9, 15};
int target = 23;
int index = -1;

for (int i = 0; i < numbers.length; i++) {
    if (numbers[i] == target) {
        index = i;
        break;  // 찾았으니 더 이상 돌 필요 없음
    }
}
```

### 2.5 continue문

반복문의 **다음 반복**으로 넘어간다. 현재 반복의 나머지 문장은 건너뛴다.

```java
for (int i = 1; i <= 10; i++) {
    if (i % 2 == 0) continue;   // 짝수는 건너뜀
    System.out.println(i);       // 1, 3, 5, 7, 9
}
```

**for vs while에서의 continue:**

```java
// for문: continue → 증감식으로 이동
for (int i = 0; i < 5; i++) {
    if (i == 2) continue;
    System.out.println(i);   // 0, 1, 3, 4
}

// while문: continue → 조건식으로 이동
// 증감이 continue 이후에 있으면 무한 루프!
int i = 0;
while (i < 5) {
    if (i == 2) {
        i++;        // 반드시 먼저 증가
        continue;
    }
    System.out.println(i);
    i++;
}
```

{{< callout type="warning" >}}
**`while` + `continue` 조합에서 증감식 위치를 놓치면 무한 루프가 된다.** 아래 코드는 `i == 2`에서 영원히 멈춘다.
{{< /callout >}}

```java
int i = 0;
while (i < 5) {
    if (i == 2) continue;   // 무한 루프! i가 증가하지 않음
    System.out.println(i);
    i++;
}
```

### 2.6 이름 붙은 반복문 (Labeled Loop)

중첩 반복문에서 **바깥 반복문**을 지정해 `break`하거나 `continue`할 수 있다.

```java
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (i == 1 && j == 1) {
            break outer;   // outer 전체 탈출
        }
        System.out.println("i=" + i + ", j=" + j);
    }
}
// 출력: i=0,j=0 / i=0,j=1 / i=0,j=2 / i=1,j=0
```

```java
Loop1:
for (int i = 2; i <= 9; i++) {
    for (int j = 1; j <= 9; j++) {
        if (j == 5) {
            break Loop1;        // 전체 종료
            // break;            // 각 단의 4까지만
            // continue Loop1;   // 각 단 4까지, 다음 단으로
        }
        System.out.println(i + " x " + j + " = " + (i * j));
    }
}
```

---

## 3. 실전 활용 패턴

### 3.1 무한 루프와 탈출 조건

```java
// 서버 메인 루프
while (true) {
    Request request = server.accept();
    if (request.isShutdown()) break;
    processRequest(request);
}

// 재시도 패턴
int maxRetries = 3;
int attempt = 0;
boolean success = false;

while (attempt < maxRetries && !success) {
    try {
        doSomething();
        success = true;
    } catch (Exception e) {
        attempt++;
        System.out.println("재시도 " + attempt + "/" + maxRetries);
    }
}
```

### 3.2 중첩 반복문 최적화

```java
// 비효율: 바깥 루프에서 동일 계산 반복
for (int i = 0; i < 1000; i++) {
    for (int j = 0; j < 1000; j++) {
        int r = expensiveCalculation(i) + j;
    }
}

// 개선: 바깥 루프 결과를 재사용
for (int i = 0; i < 1000; i++) {
    int cached = expensiveCalculation(i);
    for (int j = 0; j < 1000; j++) {
        int r = cached + j;
    }
}
```

### 3.3 조건문 리팩토링

**복잡한 조건은 메서드로 추출한다.**

```java
// Before
if (user != null && user.isActive() && user.hasPermission("admin")
    && !user.isLocked() && user.getLoginAttempts() < 5) {
    // 처리
}

// After
if (canAccessAdminPanel(user)) {
    // 처리
}

private boolean canAccessAdminPanel(User user) {
    if (user == null) return false;
    if (!user.isActive()) return false;
    if (!user.hasPermission("admin")) return false;
    if (user.isLocked()) return false;
    if (user.getLoginAttempts() >= 5) return false;
    return true;
}
```

**타입별 분기는 다형성으로 대체한다.**

```java
// Before
public double calculatePay(Employee e) {
    switch (e.getType()) {
        case HOURLY:     return e.getHours() * e.getHourlyRate();
        case SALARIED:   return e.getMonthlySalary();
        case COMMISSION: return e.getBaseSalary() + e.getSalesAmount() * 0.1;
        default: throw new IllegalArgumentException();
    }
}

// After
public abstract class Employee {
    public abstract double calculatePay();
}

public class HourlyEmployee extends Employee {
    @Override
    public double calculatePay() {
        return hours * hourlyRate;
    }
}
```

---

## 4. 성능 고려사항

### 4.1 조건 평가 순서

단락 평가를 활용해 **비용이 낮은 조건을 앞에 배치**한다.

```java
// Before: 비용 높은 조건이 앞에
if (expensiveDatabaseCheck() && simpleNullCheck(obj)) { }

// After: 가벼운 조건을 앞으로
if (simpleNullCheck(obj) && expensiveDatabaseCheck()) { }
// obj가 null이면 DB 체크 하지 않음
```

### 4.2 switch vs if-else 성능

- `switch`: 경우의 수가 많고 값이 조밀하면 **점프 테이블**로 컴파일되어 O(1) 탐색
- `if-else`: 순차 비교로 O(n)

{{< callout type="info" >}}
**현대 JIT 컴파일러는 둘 다 잘 최적화한다.** 성능 차이는 대부분 무시할 수준이므로, **가독성과 유지보수성**을 우선한다. 분기가 타입에 따른 것이라면 다형성이 더 나은 설계다.
{{< /callout >}}

---

## 5. 요약

| 제어문 | 용도 | 주의사항 |
|:-------|:-----|:---------|
| `if` | 조건 분기 | 블럭 항상 사용 권장 |
| `if-else if` | 다중 조건 | 조건 순서 중요 |
| `switch` | 값 기반 분기 | 상수만 사용, `break` 주의 |
| `for` | 횟수 기반 반복 | 인덱스 범위 주의 |
| `for-each` | 컬렉션 순회 | 읽기 전용 |
| `while` | 조건 기반 반복 | 무한 루프 주의 |
| `do-while` | 최소 1회 실행 | 세미콜론 필수 |
| `break` | 반복문 탈출 | 가장 가까운 반복문만 |
| `continue` | 다음 반복 | `while`에서 증감 위치 주의 |

{{< callout type="info" >}}
**핵심 포인트:**
- Guard Clause 패턴으로 중첩을 줄인다
- 복잡한 조건은 의미 있는 메서드로 추출한다
- Java 14+의 switch 표현식은 fall-through 없이 안전하다
- 단락 평가를 활용해 불필요한 비용을 줄인다
{{< /callout >}}
