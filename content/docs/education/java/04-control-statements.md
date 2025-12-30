---
title: "Chapter 04. 조건문과 반복문"
weight: 4
---

# 조건문과 반복문 (Control Statements)

프로그램의 흐름(flow)을 바꾸는 역할을 하는 문장들을 **제어문(control statement)**이라고 한다. 제어문에는 **조건문**과 **반복문**이 있으며, 조건문은 조건에 따라 다른 문장이 수행되도록 하고, 반복문은 특정 문장들을 반복해서 수행한다.

---

## 1. 조건문 (Conditional Statements)

조건문은 조건식과 문장을 포함하는 블럭`{}`으로 구성되어 있으며, 조건식의 결과에 따라 실행할 문장이 달라져서 프로그램의 실행흐름을 변경할 수 있다.

### 1.1 if문

if문은 가장 기본적인 조건문이며, '조건식'과 '괄호{}'로 이루어져 있다.

```java
if (조건식) {
    // 조건식이 참(true)일 때 수행될 문장들
}
```

{{< callout type="info" >}}
**조건식의 결과는 반드시 boolean 타입**이어야 한다. Java는 C/C++과 달리 정수를 조건식에 직접 사용할 수 없다.
```java
int num = 1;
if (num) { }      // 컴파일 에러! Java에서는 불가
if (num != 0) { } // 올바른 방법
```
{{< /callout >}}

#### 블럭(Block)

괄호`{}`를 이용해서 여러 문장을 하나의 단위로 묶을 수 있는데, 이것을 **블럭(block)**이라고 한다.

```java
if (score >= 90) {
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다.");
}  // 블럭 끝에는 세미콜론(;)을 붙이지 않음
```

**블럭 생략 주의사항:**

```java
// 블럭 생략 시 - 한 문장만 조건에 영향받음
if (score >= 90)
    System.out.println("A등급입니다.");
    System.out.println("장학금 대상자입니다."); // 항상 실행됨!

// 권장 방식 - 항상 블럭 사용
if (score >= 90) {
    System.out.println("A등급입니다.");
}
```

### 1.2 if-else문

조건식의 결과가 참이 아닐 때, else 블럭의 문장을 수행한다.

```java
if (조건식) {
    // 조건식이 참(true)일 때 수행될 문장
} else {
    // 조건식이 거짓(false)일 때 수행될 문장
}
```

**실용적인 예제:**

```java
public String getPassOrFail(int score) {
    if (score >= 60) {
        return "합격";
    } else {
        return "불합격";
    }
}

// 삼항 연산자로 간단히 표현
public String getPassOrFail(int score) {
    return score >= 60 ? "합격" : "불합격";
}
```

### 1.3 if-else if문

세 가지 이상의 경우를 처리할 때 사용한다.

```java
if (조건식1) {
    // 조건식1이 참일 때
} else if (조건식2) {
    // 조건식2가 참일 때
} else if (조건식3) {
    // 조건식3이 참일 때
} else {
    // 위의 모든 조건이 거짓일 때
}
```

**성적 등급 판정 예제:**

```java
public char getGrade(int score) {
    char grade;

    if (score >= 90) {
        grade = 'A';
    } else if (score >= 80) {
        grade = 'B';
    } else if (score >= 70) {
        grade = 'C';
    } else if (score >= 60) {
        grade = 'D';
    } else {
        grade = 'F';
    }

    return grade;
}
```

{{< callout type="warning" >}}
**조건 순서가 중요하다!** 조건식은 위에서부터 순서대로 평가되므로, 범위가 좁은 조건을 먼저 검사해야 한다.
```java
// 잘못된 예 - 모든 양수가 첫 번째 조건에 걸림
if (score >= 60) {
    grade = 'D';
} else if (score >= 90) {  // 도달 불가
    grade = 'A';
}

// 올바른 예
if (score >= 90) {
    grade = 'A';
} else if (score >= 60) {
    grade = 'D';
}
```
{{< /callout >}}

### 1.4 중첩 if문

if문의 블럭 내에 또 다른 if문을 포함시키는 것이 가능하다.

```java
if (score >= 90) {
    if (score >= 95) {
        System.out.println("A+");
    } else {
        System.out.println("A");
    }
} else if (score >= 80) {
    if (score >= 85) {
        System.out.println("B+");
    } else {
        System.out.println("B");
    }
}
```

**Guard Clause 패턴 (Early Return):**

중첩을 줄이기 위한 권장 패턴이다.

```java
// 중첩된 if문 (피해야 할 패턴)
public void processOrder(Order order) {
    if (order != null) {
        if (order.isValid()) {
            if (order.hasStock()) {
                // 실제 처리 로직
                order.process();
            }
        }
    }
}

// Guard Clause 적용 (권장 패턴)
public void processOrder(Order order) {
    if (order == null) return;
    if (!order.isValid()) return;
    if (!order.hasStock()) return;

    // 실제 처리 로직
    order.process();
}
```

### 1.5 switch문

단 하나의 조건식으로 많은 경우의 수를 처리할 수 있다.

```java
switch (조건식) {
    case 값1:
        // 조건식의 결과가 값1과 같은 경우
        break;
    case 값2:
        // 조건식의 결과가 값2와 같은 경우
        break;
    default:
        // 일치하는 case가 없을 때
}
```

**switch문 동작 순서:**
1. 조건식을 계산한다
2. 조건식의 결과와 일치하는 case문으로 이동한다
3. 이후의 문장들을 수행한다
4. break문이나 switch문의 끝을 만나면 빠져나간다

#### switch문의 제약조건

{{< callout type="info" >}}
**switch문 제약 조건:**
1. 조건식의 결과는 **정수, 문자열, enum**이어야 한다
2. case문의 값은 **상수(리터럴 또는 final 변수)**만 가능하며, 중복되지 않아야 한다
3. case문의 값은 조건식의 결과와 같은 타입이어야 한다
{{< /callout >}}

```java
final int OPTION_A = 1;
int variable = 2;

switch (choice) {
    case 1:         // 리터럴 상수 - 가능
        break;
    case OPTION_A:  // 컴파일 에러! 값 1과 중복
        break;
    case variable:  // 컴파일 에러! 변수는 불가
        break;
}
```

#### break문 생략 (Fall-through)

break문을 생략하면 다음 case로 계속 실행된다. 의도적으로 사용할 수 있다.

```java
// 권한 시스템 예제 - Fall-through 활용
switch (userLevel) {
    case 3:
        grantDelete();  // 삭제 권한
        // fall through
    case 2:
        grantWrite();   // 쓰기 권한
        // fall through
    case 1:
        grantRead();    // 읽기 권한
        break;
    default:
        denyAll();
}

// 월별 일수 계산 - 여러 case 그룹화
int days;
switch (month) {
    case 1: case 3: case 5: case 7:
    case 8: case 10: case 12:
        days = 31;
        break;
    case 4: case 6: case 9: case 11:
        days = 30;
        break;
    case 2:
        days = isLeapYear ? 29 : 28;
        break;
    default:
        days = -1;
}
```

### 1.6 Switch 표현식 (Java 14+)

Java 14부터 switch를 표현식(expression)으로 사용할 수 있다.

```java
// 기존 switch문
String dayType;
switch (day) {
    case MONDAY:
    case TUESDAY:
    case WEDNESDAY:
    case THURSDAY:
    case FRIDAY:
        dayType = "평일";
        break;
    case SATURDAY:
    case SUNDAY:
        dayType = "주말";
        break;
    default:
        dayType = "알 수 없음";
}

// Java 14+ switch 표현식
String dayType = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "평일";
    case SATURDAY, SUNDAY -> "주말";
};
```

**화살표 레이블(`->`) 특징:**
- break문 불필요
- fall-through 없음
- 여러 값을 쉼표로 그룹화 가능

**yield 키워드:**

블럭이 필요한 경우 `yield`로 값을 반환한다.

```java
int numLetters = switch (day) {
    case MONDAY, FRIDAY, SUNDAY -> 6;
    case TUESDAY -> 7;
    case THURSDAY, SATURDAY -> 8;
    case WEDNESDAY -> {
        System.out.println("수요일입니다.");
        yield 9;  // 블럭에서 값 반환
    }
};
```

---

## 2. 반복문 (Loop Statements)

반복문은 어떤 작업이 반복적으로 수행되도록 할 때 사용된다.

| 반복문 | 특징 | 적합한 상황 |
|--------|------|-------------|
| for | 반복 횟수가 명확 | 카운터 기반 반복 |
| while | 조건 기반 반복 | 횟수 불명확, 조건 중심 |
| do-while | 최소 1회 실행 보장 | 입력 검증, 메뉴 시스템 |

### 2.1 for문

반복 횟수를 알고 있을 때 적합하다.

```java
for (초기화; 조건식; 증감식) {
    // 반복할 문장
}
```

**실행 순서:**
```
1. 초기화 (최초 1회만)
     ↓
2. 조건식 평가 → false면 종료
     ↓
3. 블럭 내 문장 수행
     ↓
4. 증감식 실행 → 2번으로 돌아감
```

**다양한 for문 예제:**

```java
// 기본 for문
for (int i = 0; i < 10; i++) {
    System.out.println(i);
}

// 감소 카운터
for (int i = 10; i > 0; i--) {
    System.out.println(i);
}

// 2씩 증가
for (int i = 0; i < 10; i += 2) {
    System.out.println(i);  // 0, 2, 4, 6, 8
}

// 다중 변수
for (int i = 0, j = 10; i < j; i++, j--) {
    System.out.println("i=" + i + ", j=" + j);
}

// 무한 루프
for (;;) {
    // 내부에서 break로 탈출
}
```

#### 향상된 for문 (Enhanced for / for-each)

배열이나 컬렉션을 순회할 때 사용한다.

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

// 컬렉션에서의 사용
List<String> names = Arrays.asList("Alice", "Bob", "Charlie");
for (String name : names) {
    System.out.println(name);
}
```

{{< callout type="warning" >}}
**향상된 for문의 제약:**
1. 인덱스 접근 불가 - 현재 위치를 알 수 없음
2. 읽기 전용 - 요소 수정 시 원본에 영향 없음
3. 역순 순회 불가
```java
for (int num : numbers) {
    num = num * 2;  // 원본 배열은 변경되지 않음!
}
```
{{< /callout >}}

### 2.2 while문

조건식이 참인 동안 반복한다.

```java
while (조건식) {
    // 반복할 문장
}
```

**for문과 while문 비교:**

```java
// 같은 동작을 하는 두 반복문
// for문 - 반복 횟수가 명확할 때
for (int i = 0; i < 10; i++) {
    System.out.println(i);
}

// while문 - 동일 동작
int i = 0;
while (i < 10) {
    System.out.println(i);
    i++;
}
```

**while문이 적합한 경우:**

```java
// 사용자 입력 처리
Scanner scanner = new Scanner(System.in);
String input = "";

while (!input.equals("quit")) {
    System.out.print("명령어 입력: ");
    input = scanner.nextLine();
    processCommand(input);
}

// 파일 읽기
BufferedReader reader = new BufferedReader(new FileReader("file.txt"));
String line;
while ((line = reader.readLine()) != null) {
    System.out.println(line);
}
```

{{< callout type="info" >}}
**주의:** for문과 달리 while문의 조건식은 생략할 수 없다.
```java
while () { }  // 컴파일 에러!
while (true) { }  // 무한 루프 - 올바른 방법
```
{{< /callout >}}

### 2.3 do-while문

블럭을 먼저 수행한 후 조건식을 평가한다. **최소 1회 실행이 보장**된다.

```java
do {
    // 조건식 평가 전에 먼저 실행됨
} while (조건식);  // 세미콜론 필수!
```

**메뉴 시스템 예제:**

```java
Scanner scanner = new Scanner(System.in);
int choice;

do {
    System.out.println("=== 메뉴 ===");
    System.out.println("1. 조회");
    System.out.println("2. 등록");
    System.out.println("3. 삭제");
    System.out.println("0. 종료");
    System.out.print("선택: ");

    choice = scanner.nextInt();

    switch (choice) {
        case 1 -> search();
        case 2 -> register();
        case 3 -> delete();
        case 0 -> System.out.println("프로그램을 종료합니다.");
        default -> System.out.println("잘못된 선택입니다.");
    }
} while (choice != 0);
```

**입력 검증:**

```java
int number;
do {
    System.out.print("1~10 사이의 숫자를 입력하세요: ");
    number = scanner.nextInt();
} while (number < 1 || number > 10);

System.out.println("입력한 숫자: " + number);
```

### 2.4 break문

자신이 포함된 **가장 가까운 반복문**을 벗어난다.

```java
for (int i = 0; i < 100; i++) {
    if (i == 10) {
        break;  // i가 10이면 반복문 종료
    }
    System.out.println(i);
}
// break 후 이곳으로 이동
```

**검색에서의 활용:**

```java
int[] numbers = {5, 12, 7, 23, 9, 15};
int target = 23;
int index = -1;

for (int i = 0; i < numbers.length; i++) {
    if (numbers[i] == target) {
        index = i;
        break;  // 찾으면 더 이상 반복할 필요 없음
    }
}

if (index != -1) {
    System.out.println("찾은 위치: " + index);
}
```

### 2.5 continue문

반복문의 끝으로 이동하여 **다음 반복**으로 넘어간다.

```java
for (int i = 1; i <= 10; i++) {
    if (i % 2 == 0) {
        continue;  // 짝수는 건너뜀
    }
    System.out.println(i);  // 홀수만 출력: 1, 3, 5, 7, 9
}
```

**for문 vs while문에서의 continue:**

```java
// for문 - continue 시 증감식으로 이동
for (int i = 0; i < 5; i++) {
    if (i == 2) continue;
    System.out.println(i);  // 0, 1, 3, 4
}

// while문 - continue 시 조건식으로 이동 (주의!)
int i = 0;
while (i < 5) {
    if (i == 2) {
        i++;       // 증감 먼저 해야 함!
        continue;
    }
    System.out.println(i);
    i++;
}
```

{{< callout type="warning" >}}
**while문에서 continue 사용 시 주의:**
증감식이 continue 아래에 있으면 무한 루프에 빠질 수 있다.
```java
int i = 0;
while (i < 5) {
    if (i == 2) {
        continue;  // 무한 루프! i가 증가하지 않음
    }
    System.out.println(i);
    i++;
}
```
{{< /callout >}}

### 2.6 이름 붙은 반복문 (Labeled Loop)

중첩 반복문에서 특정 반복문을 지정하여 break/continue할 수 있다.

```java
outer:  // 반복문에 이름 부여
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (i == 1 && j == 1) {
            break outer;  // outer 반복문 전체를 벗어남
        }
        System.out.println("i=" + i + ", j=" + j);
    }
}
// 출력: i=0,j=0 / i=0,j=1 / i=0,j=2 / i=1,j=0
```

**구구단 출력 예제:**

```java
Loop1:
for (int i = 2; i <= 9; i++) {
    for (int j = 1; j <= 9; j++) {
        if (j == 5) {
            break Loop1;  // 2단 4까지만 출력하고 전체 종료
            // break;     // 이 경우 각 단의 4까지만 출력
            // continue Loop1;  // 각 단의 4까지만 출력 후 다음 단
        }
        System.out.println(i + " x " + j + " = " + (i * j));
    }
}
```

---

## 3. 실전 활용 패턴

### 3.1 무한 루프와 탈출 조건

```java
// 서버 메인 루프 패턴
while (true) {
    Request request = server.accept();

    if (request.isShutdown()) {
        break;  // 종료 요청 시 탈출
    }

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
// 비효율적 - 바깥 루프에서 동일한 계산 반복
for (int i = 0; i < 1000; i++) {
    for (int j = 0; j < 1000; j++) {
        int result = expensiveCalculation(i) + j;  // 매번 계산
    }
}

// 효율적 - 바깥 루프 계산 결과 재사용
for (int i = 0; i < 1000; i++) {
    int cached = expensiveCalculation(i);  // 한 번만 계산
    for (int j = 0; j < 1000; j++) {
        int result = cached + j;
    }
}
```

### 3.3 조건문 리팩토링

**복잡한 조건을 메서드로 추출:**

```java
// Before: 복잡한 조건
if (user != null && user.isActive() && user.hasPermission("admin")
    && !user.isLocked() && user.getLoginAttempts() < 5) {
    // 처리
}

// After: 조건을 의미 있는 메서드로 추출
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

**다형성으로 조건문 대체:**

```java
// Before: 타입에 따른 switch문
public double calculatePay(Employee e) {
    switch (e.getType()) {
        case HOURLY:
            return e.getHours() * e.getHourlyRate();
        case SALARIED:
            return e.getMonthlySalary();
        case COMMISSION:
            return e.getBaseSalary() + e.getSalesAmount() * 0.1;
        default:
            throw new IllegalArgumentException();
    }
}

// After: 다형성 활용
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

```java
// 단축 평가(Short-circuit evaluation) 활용
// 비용이 낮은 조건을 앞에 배치

// Before: 비용 높은 조건이 앞에
if (expensiveDatabaseCheck() && simpleNullCheck(obj)) { }

// After: 비용 낮은 조건을 앞에
if (simpleNullCheck(obj) && expensiveDatabaseCheck()) { }
// obj가 null이면 DB 체크 하지 않음
```

### 4.2 switch vs if-else 성능

```java
// 많은 분기가 있을 때 switch가 유리할 수 있음
// - switch: 점프 테이블 사용 가능 (O(1))
// - if-else: 순차적 비교 (O(n))

// 하지만 현대 JIT 컴파일러는 둘 다 최적화함
// 가독성과 유지보수성을 우선시할 것
```

---

## 5. 요약

| 제어문 | 용도 | 주의사항 |
|--------|------|----------|
| if | 조건 분기 | 블럭 항상 사용 권장 |
| if-else if | 다중 조건 | 조건 순서 중요 |
| switch | 값 기반 분기 | 상수만 사용, break 주의 |
| for | 횟수 기반 반복 | 인덱스 범위 주의 |
| for-each | 컬렉션 순회 | 읽기 전용 |
| while | 조건 기반 반복 | 무한루프 주의 |
| do-while | 최소 1회 실행 | 세미콜론 필수 |
| break | 반복문 탈출 | 가장 가까운 반복문만 |
| continue | 다음 반복 | while에서 증감 위치 주의 |

{{< callout type="info" >}}
**핵심 포인트:**
- Guard Clause 패턴으로 중첩 줄이기
- 복잡한 조건은 메서드로 추출
- Java 14+ switch 표현식 활용
- 단축 평가 활용한 성능 최적화
{{< /callout >}}
