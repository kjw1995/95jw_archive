---
title: "연산자 (Operator)"
weight: 3
---

# 연산자 (Operator)

## 1. 연산자와 피연산자

### 기본 개념

| 용어 | 설명 | 예시 |
|------|------|------|
| **연산자 (Operator)** | 연산을 수행하는 기호 | `+`, `-`, `*`, `/`, `%` |
| **피연산자 (Operand)** | 연산자의 작업 대상 | 변수, 상수, 리터럴, 수식 |

```java
int result = 10 + 20;
//          ↑    ↑  ↑
//       피연산자 연산자 피연산자
```

> 연산자는 피연산자로 연산을 수행하고 나면 **항상 결과값을 반환**한다.

### 식(Expression)과 평가(Evaluation)

```java
// 식(Expression): 연산자와 피연산자를 조합하여 계산하고자 하는 바를 표현한 것
int x = 10;
int y = 20;
int result = x + y * 2;  // 식

// 평가(Evaluation): 식을 계산하여 결과를 얻는 것
// x + y * 2 → 10 + 20 * 2 → 10 + 40 → 50
```

---

## 2. 연산자의 종류

### 기능별 분류

| 종류 | 연산자 | 설명 |
|------|--------|------|
| **산술 연산자** | `+` `-` `*` `/` `%` | 사칙 연산과 나머지 연산 |
| **비교 연산자** | `<` `>` `<=` `>=` `==` `!=` | 크기 비교, 같음/다름 비교 |
| **논리 연산자** | `&&` `\|\|` `!` | AND, OR, NOT |
| **비트 연산자** | `&` `\|` `^` `~` `<<` `>>` | 비트 단위 연산 |
| **대입 연산자** | `=` `+=` `-=` `*=` `/=` | 값 저장 |
| **증감 연산자** | `++` `--` | 1 증가/감소 |
| **조건 연산자** | `? :` | 삼항 연산자 |
| **기타** | `(type)` `instanceof` | 형변환, 타입 확인 |

### 피연산자 개수에 의한 분류

| 분류 | 피연산자 수 | 예시 |
|------|------------|------|
| **단항 연산자** | 1개 | `++i`, `-x`, `!flag` |
| **이항 연산자** | 2개 | `a + b`, `x > y` |
| **삼항 연산자** | 3개 | `a ? b : c` |

```java
// 단항 연산자
int a = 5;
int b = -a;      // 부호 연산자 (단항)
int c = ++a;     // 증감 연산자 (단항)
boolean d = !true;  // 논리 부정 (단항)

// 이항 연산자
int sum = 10 + 20;  // 산술 연산자 (이항)
boolean result = 10 > 5;  // 비교 연산자 (이항)

// 삼항 연산자
int max = (a > b) ? a : b;  // 조건 연산자 (삼항)
```

---

## 3. 연산자 우선순위와 결합규칙

### 연산자 우선순위

```java
int result = 2 + 3 * 4;  // 2 + 12 = 14 (곱셈 먼저)
int result2 = (2 + 3) * 4;  // 5 * 4 = 20 (괄호 먼저)
```

### 우선순위 표 (높음 → 낮음)

| 우선순위 | 연산자 | 결합방향 |
|:--------:|--------|:--------:|
| 1 | `()` `[]` `.` | → |
| 2 | `++` `--` `+` `-` `~` `!` `(type)` | ← |
| 3 | `*` `/` `%` | → |
| 4 | `+` `-` | → |
| 5 | `<<` `>>` `>>>` | → |
| 6 | `<` `>` `<=` `>=` `instanceof` | → |
| 7 | `==` `!=` | → |
| 8 | `&` | → |
| 9 | `^` | → |
| 10 | `\|` | → |
| 11 | `&&` | → |
| 12 | `\|\|` | → |
| 13 | `? :` | ← |
| 14 | `=` `+=` `-=` `*=` `/=` 등 | ← |

### 핵심 규칙

```
1. 산술 > 비교 > 논리 > 대입 (대입은 제일 마지막)
2. 단항(1) > 이항(2) > 삼항(3)
3. 단항 연산자와 대입 연산자를 제외한 모든 연산은 왼쪽 → 오른쪽
```

### 예제: 우선순위 적용

```java
int x = 10, y = 5, z = 2;

// 복합 연산 예제
int result = x + y * z;      // 10 + (5 * 2) = 10 + 10 = 20
int result2 = x > y && y > z; // (10 > 5) && (5 > 2) = true && true = true

// 대입 연산자는 오른쪽에서 왼쪽
int a, b, c;
a = b = c = 100;  // c=100 → b=100 → a=100

// 증감 연산자 (단항)
int i = 5;
int j = ++i + i++;  // 6 + 6 = 12, i는 7이 됨
```

---

## 4. 산술 변환 (Usual Arithmetic Conversion)

### 개념
이항 연산자는 두 피연산자의 타입이 일치해야 연산 가능하므로, 타입이 다르면 **자동 형변환**이 발생한다.

### 규칙

```
규칙 1: 두 피연산자의 타입을 같게 일치시킨다 (더 큰 타입으로)
규칙 2: 피연산자의 타입이 int보다 작으면 int로 변환된다
```

### 예제

```java
// 규칙 1: 큰 타입으로 변환
long + int    → long + long    → long
float + int   → float + float  → float
double + float → double + double → double

// 규칙 2: int보다 작으면 int로 변환
byte + short  → int + int      → int
char + short  → int + int      → int

// 실제 코드
byte a = 10;
byte b = 20;
// byte c = a + b;  // 컴파일 에러! a + b는 int
int c = a + b;      // OK

char ch = 'A';
int num = ch + 1;   // 'A'(65) + 1 = 66
char ch2 = (char)(ch + 1);  // 'B'
```

### 산술 변환이 일어나지 않는 경우

```java
// 쉬프트 연산자, 증감 연산자는 예외
byte b = 10;
b++;  // OK, byte 유지 (산술 변환 없음)

int x = 8;
x >>= 2;  // OK, int 유지
```

---

## 5. 단항 연산자

### 5.1 증감 연산자 (++, --)

| 타입 | 설명 | 예시 |
|------|------|------|
| **전위형 (prefix)** | 값이 참조되기 **전에** 증가/감소 | `++i`, `--i` |
| **후위형 (postfix)** | 값이 참조된 **후에** 증가/감소 | `i++`, `i--` |

```java
int i = 5;
int j;

// 전위형: 증가 후 참조
j = ++i;  // i를 6으로 증가 → j에 6 저장
System.out.println("i=" + i + ", j=" + j);  // i=6, j=6

// 후위형: 참조 후 증가
i = 5;
j = i++;  // j에 5 저장 → i를 6으로 증가
System.out.println("i=" + i + ", j=" + j);  // i=6, j=5
```

### 전위형과 후위형의 내부 동작

```java
// 전위형 j = ++i; 는 다음과 같다
++i;       // 먼저 증가
j = i;     // 그 다음 대입

// 후위형 j = i++; 는 다음과 같다
j = i;     // 먼저 대입
i++;       // 그 다음 증가
```

### 주의사항

```java
// 하나의 식에서 같은 변수에 증감 연산자를 여러 번 사용하지 말 것
int i = 5;
int result = ++i + i++ + ++i;  // 결과 예측 어려움, 컴파일러마다 다를 수 있음
```

### 5.2 부호 연산자 (+, -)

```java
int x = 10;
int y = -x;   // y = -10 (부호 반전)
int z = +x;   // z = 10 (아무 변화 없음)

// boolean과 char에는 사용 불가
// boolean b = -true;  // 컴파일 에러
// char c = -'A';      // 컴파일 에러
```

---

## 6. 산술 연산자

### 6.1 사칙 연산자 (+, -, *, /)

```java
int a = 10, b = 3;

System.out.println(a + b);  // 13
System.out.println(a - b);  // 7
System.out.println(a * b);  // 30
System.out.println(a / b);  // 3 (정수 나눗셈, 소수점 버림)

// 실수 나눗셈
double c = 10.0 / 3;  // 3.3333...
double d = (double) a / b;  // 3.3333... (형변환 필요)
```

### 0으로 나누기

```java
// 정수를 0으로 나누면 ArithmeticException 발생
int x = 10;
// int result = x / 0;  // 런타임 에러!

// 실수를 0.0으로 나누면 Infinity 또는 NaN
double y = 10.0;
System.out.println(y / 0.0);   // Infinity
System.out.println(0.0 / 0.0); // NaN (Not a Number)
```

### 특수 값 연산 결과

| x | y | x / y | x % y |
|---|---|-------|-------|
| 유한수 | ±0.0 | ±Infinity | NaN |
| 유한수 | ±Infinity | ±0.0 | x |
| ±0.0 | ±0.0 | NaN | NaN |
| ±Infinity | ±Infinity | NaN | NaN |

### 6.2 나머지 연산자 (%)

```java
int a = 10, b = 3;
System.out.println(a % b);  // 1 (10 = 3 * 3 + 1)

// 홀수/짝수 판별
int num = 7;
if (num % 2 == 0) {
    System.out.println("짝수");
} else {
    System.out.println("홀수");
}

// 배수 판별
if (num % 3 == 0) {
    System.out.println("3의 배수");
}

// 순환 인덱스
int[] arr = {1, 2, 3, 4, 5};
for (int i = 0; i < 10; i++) {
    System.out.println(arr[i % arr.length]);  // 0,1,2,3,4,0,1,2,3,4
}
```

### 문자 연산

```java
// 문자는 유니코드(정수)로 변환되어 연산
char c1 = 'A';       // 65
char c2 = 'a';       // 97
int diff = c2 - c1;  // 32

// 대문자 → 소문자
char upper = 'A';
char lower = (char)(upper + 32);  // 'a'

// 숫자 문자 → 정수
char digit = '7';
int num = digit - '0';  // 7
```

---

## 7. 비교 연산자

### 7.1 대소 비교 연산자 (<, >, <=, >=)

```java
int a = 10, b = 20;

System.out.println(a > b);   // false
System.out.println(a < b);   // true
System.out.println(a >= 10); // true
System.out.println(a <= 10); // true

// boolean형과 참조형에는 사용 불가
// boolean x = true > false;  // 컴파일 에러
```

### 7.2 등가 비교 연산자 (==, !=)

```java
// 기본형 비교
int a = 10, b = 10;
System.out.println(a == b);  // true
System.out.println(a != b);  // false

// 실수 비교 주의
double d1 = 0.1 + 0.2;
double d2 = 0.3;
System.out.println(d1 == d2);  // false! (부동소수점 오차)

// 실수 비교는 오차 범위 사용
double epsilon = 0.0001;
System.out.println(Math.abs(d1 - d2) < epsilon);  // true
```

### 7.3 문자열 비교

```java
String str1 = "hello";
String str2 = "hello";
String str3 = new String("hello");

// == 는 참조(주소) 비교
System.out.println(str1 == str2);   // true (String Pool)
System.out.println(str1 == str3);   // false (다른 객체)

// equals()는 내용 비교
System.out.println(str1.equals(str2));  // true
System.out.println(str1.equals(str3));  // true

// 대소문자 무시 비교
System.out.println("Hello".equalsIgnoreCase("hello"));  // true
```

> **중요**: 문자열 비교는 항상 `equals()` 사용!

---

## 8. 논리 연산자

### 8.1 논리 연산자 (&&, ||, !)

| 연산자 | 이름 | 설명 |
|--------|------|------|
| `&&` | AND | 둘 다 true여야 true |
| `\|\|` | OR | 하나라도 true면 true |
| `!` | NOT | true↔false 반전 |

```java
boolean a = true, b = false;

System.out.println(a && b);  // false
System.out.println(a || b);  // true
System.out.println(!a);      // false
System.out.println(!b);      // true
```

### 진리표

| x | y | x && y | x \|\| y | !x |
|---|---|--------|----------|-----|
| true | true | true | true | false |
| true | false | false | true | false |
| false | true | false | true | true |
| false | false | false | false | true |

### 8.2 단락 평가 (Short-circuit Evaluation)

```java
// OR(||): 왼쪽이 true면 오른쪽 평가 안 함
int x = 10;
if (true || (++x > 10)) {
    // ++x 실행되지 않음
}
System.out.println(x);  // 10

// AND(&&): 왼쪽이 false면 오른쪽 평가 안 함
int y = 10;
if (false && (++y > 10)) {
    // ++y 실행되지 않음
}
System.out.println(y);  // 10

// 실용적인 활용: null 체크
String str = null;
if (str != null && str.length() > 0) {
    // str이 null이면 str.length() 호출 안 함 → NullPointerException 방지
}
```

---

## 9. 비트 연산자

### 9.1 비트 논리 연산자 (&, |, ^, ~)

| 연산자 | 이름 | 설명 |
|--------|------|------|
| `&` | AND | 둘 다 1이면 1 |
| `\|` | OR | 하나라도 1이면 1 |
| `^` | XOR | 서로 다르면 1 |
| `~` | NOT | 비트 반전 |

```java
int a = 0b1010;  // 10
int b = 0b1100;  // 12

System.out.println(Integer.toBinaryString(a & b));  // 1000 (8)
System.out.println(Integer.toBinaryString(a | b));  // 1110 (14)
System.out.println(Integer.toBinaryString(a ^ b));  // 0110 (6)
System.out.println(Integer.toBinaryString(~a));     // ...11110101 (-11)
```

### 비트 연산 진리표

| x | y | x & y | x \| y | x ^ y |
|---|---|-------|--------|-------|
| 1 | 1 | 1 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 |
| 0 | 1 | 0 | 1 | 1 |
| 0 | 0 | 0 | 0 | 0 |

### 실용적인 활용

```java
// 특정 비트 설정 (OR)
int flags = 0b0000;
flags |= 0b0100;  // 3번째 비트 켜기 → 0b0100

// 특정 비트 확인 (AND)
boolean isSet = (flags & 0b0100) != 0;  // 3번째 비트가 1인지 확인

// 특정 비트 토글 (XOR)
flags ^= 0b0100;  // 3번째 비트 반전

// 짝수/홀수 판별 (AND)
int num = 7;
if ((num & 1) == 0) {
    System.out.println("짝수");
} else {
    System.out.println("홀수");
}
```

### 9.2 시프트 연산자 (<<, >>, >>>)

| 연산자 | 이름 | 설명 |
|--------|------|------|
| `<<` | 왼쪽 시프트 | 비트를 왼쪽으로 이동 (× 2^n) |
| `>>` | 오른쪽 시프트 | 비트를 오른쪽으로 이동 (÷ 2^n, 부호 유지) |
| `>>>` | 부호 없는 오른쪽 시프트 | 부호 무시, 0으로 채움 |

```java
int x = 8;  // 0b1000

System.out.println(x << 1);   // 16 (0b10000)  8 * 2
System.out.println(x << 2);   // 32 (0b100000) 8 * 4
System.out.println(x >> 1);   // 4  (0b100)    8 / 2
System.out.println(x >> 2);   // 2  (0b10)     8 / 4

// 2의 거듭제곱 곱셈/나눗셈에 활용
int n = 5;
int multiply8 = n << 3;   // n * 8
int divide4 = n >> 2;     // n / 4
```

---

## 10. 조건 연산자 (? :)

### 문법

```java
조건식 ? 참일_때_값 : 거짓일_때_값
```

### 예제

```java
int a = 10, b = 20;

// if-else와 동일
int max = (a > b) ? a : b;  // 20

// 중첩 가능 (가독성 주의)
int x = 5;
String result = (x > 0) ? "양수" : (x < 0) ? "음수" : "영";

// 실용 예제: 절대값
int num = -10;
int abs = (num >= 0) ? num : -num;  // 10
```

---

## 11. 대입 연산자

### 11.1 기본 대입 연산자 (=)

```java
int x = 10;      // 10을 x에 저장
int y = x;       // x의 값을 y에 저장
int z = x + y;   // x + y의 결과를 z에 저장

// 연속 대입 (오른쪽 → 왼쪽)
int a, b, c;
a = b = c = 100;  // c=100, b=100, a=100
```

### lvalue와 rvalue

```java
int x = 10;
// lvalue: 대입 연산자 왼쪽 (값을 저장할 수 있어야 함)
// rvalue: 대입 연산자 오른쪽 (값, 변수, 식 모두 가능)

// 3 = x;  // 컴파일 에러! 리터럴은 lvalue가 될 수 없음
```

### 11.2 복합 대입 연산자

| 복합 대입 | 풀어쓴 형태 |
|----------|-------------|
| `i += 3` | `i = i + 3` |
| `i -= 3` | `i = i - 3` |
| `i *= 3` | `i = i * 3` |
| `i /= 3` | `i = i / 3` |
| `i %= 3` | `i = i % 3` |
| `i <<= 2` | `i = i << 2` |
| `i >>= 2` | `i = i >> 2` |
| `i &= 3` | `i = i & 3` |
| `i ^= 3` | `i = i ^ 3` |
| `i \|= 3` | `i = i \| 3` |

```java
int x = 10;
x += 5;   // x = 15
x -= 3;   // x = 12
x *= 2;   // x = 24
x /= 4;   // x = 6
x %= 4;   // x = 2

// 복합 대입에서 형변환 자동 처리
byte b = 10;
b += 5;   // OK (b = (byte)(b + 5)와 동일)
// b = b + 5;  // 컴파일 에러! (int를 byte에 대입)
```

---

## 12. 형변환 연산자 (type)

### 명시적 형변환

```java
double d = 3.14;
int i = (int) d;  // 3 (소수점 버림)

long l = 100L;
int j = (int) l;  // 100

// 데이터 손실 주의
int big = 300;
byte b = (byte) big;  // 44 (오버플로우)
```

### 자동 형변환

```java
// 작은 타입 → 큰 타입 (자동)
byte → short → int → long → float → double
         char ↗

int i = 100;
long l = i;       // 자동 형변환
double d = l;     // 자동 형변환

// 큰 타입 → 작은 타입 (명시적 필요)
double d = 3.14;
// int i = d;     // 컴파일 에러
int i = (int) d;  // OK
```

---

## 13. instanceof 연산자

```java
// 객체가 특정 클래스/인터페이스 타입인지 확인
String str = "Hello";
System.out.println(str instanceof String);  // true
System.out.println(str instanceof Object);  // true

// null은 항상 false
String nullStr = null;
System.out.println(nullStr instanceof String);  // false

// 실용 예제: 안전한 형변환
Object obj = "Hello";
if (obj instanceof String) {
    String s = (String) obj;
    System.out.println(s.length());
}

// Java 16+ 패턴 매칭
if (obj instanceof String s) {
    System.out.println(s.length());  // 바로 사용 가능
}
```

---

## 핵심 정리

| 분류 | 연산자 | 특징 |
|------|--------|------|
| 산술 | `+` `-` `*` `/` `%` | 사칙연산, 나머지 |
| 비교 | `==` `!=` `<` `>` `<=` `>=` | 결과는 boolean |
| 논리 | `&&` `\|\|` `!` | 단락 평가 |
| 비트 | `&` `\|` `^` `~` `<<` `>>` | 정수만 가능 |
| 대입 | `=` `+=` `-=` 등 | 가장 낮은 우선순위 |
| 증감 | `++` `--` | 전위/후위 구분 |
| 조건 | `? :` | 유일한 삼항 연산자 |


**핵심 규칙**
- 산술 변환: 피연산자의 타입을 큰 쪽으로 맞추고, int보다 작으면 int로 변환
- 우선순위: 산술 > 비교 > 논리 > 대입
- 결합 방향: 대부분 왼쪽→오른쪽, 단항/대입 연산자는 오른쪽→왼쪽
- 문자열 비교는 `==` 대신 `equals()` 사용

