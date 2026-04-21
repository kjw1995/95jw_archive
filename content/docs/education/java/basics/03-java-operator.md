---
title: "Chapter 03. 연산자 (Operator)"
weight: 3
---

연산자의 종류와 우선순위, 산술 변환, 단항·비트·논리·대입 연산자의 동작과 실전 주의점을 다룬다.

---

## 1. 연산자와 피연산자

### 1.1 기본 개념

| 용어 | 설명 | 예시 |
|:-----|:-----|:-----|
| 연산자 (Operator) | 연산을 수행하는 기호 | `+`, `-`, `*`, `/`, `%` |
| 피연산자 (Operand) | 연산자의 작업 대상 | 변수, 상수, 리터럴, 수식 |

```java
int result = 10 + 20;
//           ↑    ↑  ↑
//        피연산자 연산자 피연산자
```

> 연산자는 피연산자로 연산을 수행하고 나면 **항상 결과값을 반환한다**. 이 "결과값이 있다"는 성질 덕분에 연산자를 중첩하거나 다른 식의 일부로 사용할 수 있다.

### 1.2 식(Expression)과 평가(Evaluation)

```java
// 식(Expression): 연산자와 피연산자의 조합
int x = 10;
int y = 20;
int result = x + y * 2;   // 식

// 평가(Evaluation): 식을 계산해 값을 얻는 과정
// x + y * 2 → 10 + 20 * 2 → 10 + 40 → 50
```

---

## 2. 연산자의 종류

### 2.1 기능별 분류

| 종류 | 연산자 | 설명 |
|:-----|:-------|:-----|
| 산술 | `+` `-` `*` `/` `%` | 사칙 연산과 나머지 |
| 비교 | `<` `>` `<=` `>=` `==` `!=` | 크기·동등 비교 |
| 논리 | `&&` `\|\|` `!` | AND, OR, NOT |
| 비트 | `&` `\|` `^` `~` `<<` `>>` | 비트 단위 연산 |
| 대입 | `=` `+=` `-=` `*=` `/=` | 값 저장 |
| 증감 | `++` `--` | 1 증가/감소 |
| 조건 | `? :` | 삼항 연산자 |
| 기타 | `(type)` `instanceof` | 형변환, 타입 확인 |

### 2.2 피연산자 개수별 분류

| 분류 | 피연산자 수 | 예시 |
|:-----|:-----------|:-----|
| 단항 연산자 | 1개 | `++i`, `-x`, `!flag` |
| 이항 연산자 | 2개 | `a + b`, `x > y` |
| 삼항 연산자 | 3개 | `a ? b : c` |

```java
int a = 5;
int b = -a;         // 단항 (부호)
int c = ++a;        // 단항 (증감)
boolean d = !true;  // 단항 (논리 부정)

int sum = 10 + 20;           // 이항
boolean r = 10 > 5;          // 이항

int max = (a > b) ? a : b;   // 삼항
```

---

## 3. 연산자 우선순위와 결합규칙

### 3.1 우선순위 표 (높음 → 낮음)

| 우선순위 | 연산자 | 결합방향 |
|:---:|:---|:---:|
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

### 3.2 핵심 규칙

```
1. 산술 > 비교 > 논리 > 대입 (대입은 가장 마지막)
2. 단항 > 이항 > 삼항
3. 단항과 대입을 제외하면
   모두 왼쪽 → 오른쪽 결합
```

### 3.3 예제

```java
int x = 10, y = 5, z = 2;

int r1 = x + y * z;            // 10 + 10 = 20
boolean r2 = x > y && y > z;   // true && true = true

// 대입 연산자는 오른쪽 → 왼쪽
int a, b, c;
a = b = c = 100;               // c=100 → b=100 → a=100
```

{{< callout type="warning" >}}
**같은 변수에 증감 연산자를 여러 번 사용하지 말 것.** `++i + i++ + ++i`처럼 작성하면 결과 예측이 어렵고 가독성이 크게 떨어진다.
{{< /callout >}}

---

## 4. 산술 변환 (Usual Arithmetic Conversion)

### 4.1 개념

이항 연산자는 두 피연산자의 타입이 같아야 연산할 수 있다. 타입이 다르면 컴파일러가 **자동으로 형변환**하여 타입을 맞춘다.

### 4.2 규칙

```
규칙 1: 두 피연산자의 타입을
        더 큰 타입으로 일치시킨다
규칙 2: int보다 작은 타입은
        모두 int로 변환된다
```

### 4.3 예제

```java
// 규칙 1: 큰 타입으로
long + int     → long + long     → long
float + int    → float + float   → float
double + float → double + double → double

// 규칙 2: int보다 작으면 int로
byte + short   → int + int       → int
char + short   → int + int       → int

// 실제 코드
byte a = 10;
byte b = 20;
// byte c = a + b;  // 컴파일 에러! (a + b는 int)
int c = a + b;      // OK

char ch = 'A';
int num = ch + 1;            // 'A'(65) + 1 = 66
char ch2 = (char)(ch + 1);   // 'B'
```

{{< callout type="info" >}}
**`byte`, `short`를 `int`로 올리는 이유**는 JVM이 피연산자 스택에서 32비트(int) 단위로 연산하도록 설계되었기 때문이다. 작은 타입을 매번 확장한 뒤 연산하는 편이 JVM 구현이 단순하고 실제 CPU 처리에도 효율적이다.
{{< /callout >}}

### 4.4 산술 변환이 일어나지 않는 경우

```java
// 쉬프트 연산자와 증감 연산자는 예외
byte b = 10;
b++;        // OK, byte 유지

int x = 8;
x >>= 2;    // OK, int 유지
```

---

## 5. 단항 연산자

### 5.1 증감 연산자 (`++`, `--`)

| 구분 | 설명 | 예시 |
|:-----|:-----|:-----|
| 전위형 (prefix) | 값 참조 **전에** 증가/감소 | `++i`, `--i` |
| 후위형 (postfix) | 값 참조 **후에** 증가/감소 | `i++`, `i--` |

```java
int i = 5;
int j;

// 전위형: 증가 후 참조
j = ++i;
// i=6, j=6

i = 5;
// 후위형: 참조 후 증가
j = i++;
// i=6, j=5
```

**내부 동작:**

```java
// 전위형 j = ++i; 는 아래와 동일
++i;
j = i;

// 후위형 j = i++; 는 아래와 동일
j = i;
i++;
```

### 5.2 부호 연산자 (`+`, `-`)

```java
int x = 10;
int y = -x;   // -10
int z = +x;   // 10 (변화 없음)

// boolean과 char에는 사용 불가
// boolean b = -true;   // 컴파일 에러
// char c = -'A';       // 컴파일 에러
```

---

## 6. 산술 연산자

### 6.1 사칙 연산자

```java
int a = 10, b = 3;

System.out.println(a + b);  // 13
System.out.println(a - b);  // 7
System.out.println(a * b);  // 30
System.out.println(a / b);  // 3 (정수 나눗셈, 소수점 버림)

double c = 10.0 / 3;          // 3.333...
double d = (double) a / b;    // 3.333... (형변환 후 실수 연산)
```

### 6.2 0으로 나누기

```java
// 정수 / 0 → ArithmeticException
int x = 10;
// int result = x / 0;   // 런타임 예외

// 실수 / 0.0 → Infinity 또는 NaN
double y = 10.0;
System.out.println(y / 0.0);     // Infinity
System.out.println(0.0 / 0.0);   // NaN
```

### 6.3 특수 값 연산 결과

| x | y | x / y | x % y |
|:--|:--|:------|:------|
| 유한수 | ±0.0 | ±Infinity | NaN |
| 유한수 | ±Infinity | ±0.0 | x |
| ±0.0 | ±0.0 | NaN | NaN |
| ±Infinity | ±Infinity | NaN | NaN |

### 6.4 나머지 연산자 (`%`)

```java
int a = 10, b = 3;
System.out.println(a % b);  // 1 (10 = 3*3 + 1)

// 홀수/짝수 판별
if (num % 2 == 0) { /* 짝수 */ }

// 순환 인덱스
int[] arr = {1, 2, 3, 4, 5};
for (int i = 0; i < 10; i++) {
    System.out.println(arr[i % arr.length]);
}
```

### 6.5 문자 연산

```java
// 문자는 유니코드 정수로 변환되어 연산된다
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

### 7.1 대소 비교

```java
int a = 10, b = 20;

System.out.println(a > b);    // false
System.out.println(a < b);    // true
System.out.println(a >= 10);  // true

// boolean과 참조형에는 대소 비교 불가
// boolean x = true > false;  // 컴파일 에러
```

### 7.2 등가 비교 (`==`, `!=`)

```java
// 기본형은 값 비교
int a = 10, b = 10;
System.out.println(a == b);  // true

// 실수 비교는 오차에 주의
double d1 = 0.1 + 0.2;
double d2 = 0.3;
System.out.println(d1 == d2);   // false!

// 오차 허용 범위로 비교
double eps = 1e-9;
System.out.println(Math.abs(d1 - d2) < eps);   // true
```

### 7.3 문자열 비교

```java
String s1 = "hello";
String s2 = "hello";
String s3 = new String("hello");

// == 는 참조(주소) 비교
System.out.println(s1 == s2);   // true (String Pool 공유)
System.out.println(s1 == s3);   // false (다른 객체)

// equals()는 내용 비교
System.out.println(s1.equals(s2));  // true
System.out.println(s1.equals(s3));  // true

// 대소문자 무시
System.out.println("Hello".equalsIgnoreCase("hello"));  // true
```

{{< callout type="warning" >}}
**문자열 비교는 반드시 `equals()`를 사용한다.** `==`는 참조 비교이므로 같은 내용이라도 다른 객체라면 `false`가 된다. `s1.equals(s2)`에서 `s1`이 `null`일 수 있다면 `Objects.equals(s1, s2)`나 `"hello".equals(s1)`처럼 NPE를 피하는 패턴을 쓴다.
{{< /callout >}}

---

## 8. 논리 연산자

### 8.1 기본 사용

| 연산자 | 이름 | 설명 |
|:-------|:-----|:-----|
| `&&` | AND | 둘 다 true여야 true |
| `\|\|` | OR | 하나라도 true면 true |
| `!` | NOT | true↔false 반전 |

```java
boolean a = true, b = false;
System.out.println(a && b);  // false
System.out.println(a || b);  // true
System.out.println(!a);      // false
```

### 8.2 진리표

| x | y | x && y | x \|\| y | !x |
|:--|:--|:-------|:---------|:---|
| T | T | T | T | F |
| T | F | F | T | F |
| F | T | F | T | T |
| F | F | F | F | T |

### 8.3 단락 평가 (Short-circuit Evaluation)

왼쪽 피연산자만으로 결과가 결정되면 오른쪽은 **평가하지 않는다**. 이 특성은 NPE 방지와 성능 최적화에 유용하다.

```java
// OR: 왼쪽이 true면 오른쪽 평가 생략
int x = 10;
if (true || (++x > 10)) { /* ++x 실행 안 됨 */ }
System.out.println(x);  // 10

// AND: 왼쪽이 false면 오른쪽 평가 생략
int y = 10;
if (false && (++y > 10)) { /* ++y 실행 안 됨 */ }
System.out.println(y);  // 10

// NPE 방지에 자주 사용되는 패턴
String str = null;
if (str != null && str.length() > 0) {
    // str이 null이면 str.length() 호출 안 함
}
```

---

## 9. 비트 연산자

### 9.1 비트 논리 연산자

| 연산자 | 이름 | 설명 |
|:-------|:-----|:-----|
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

### 9.2 비트 연산 진리표

| x | y | x & y | x \| y | x ^ y |
|:--|:--|:------|:-------|:------|
| 1 | 1 | 1 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 |
| 0 | 1 | 0 | 1 | 1 |
| 0 | 0 | 0 | 0 | 0 |

### 9.3 실용적인 활용

```java
// 특정 비트 설정 (OR)
int flags = 0b0000;
flags |= 0b0100;   // 3번째 비트 켜기

// 특정 비트 확인 (AND)
boolean isSet = (flags & 0b0100) != 0;

// 특정 비트 토글 (XOR)
flags ^= 0b0100;

// 짝수/홀수 판별
if ((num & 1) == 0) { /* 짝수 */ }
```

### 9.4 시프트 연산자 (`<<`, `>>`, `>>>`)

| 연산자 | 이름 | 설명 |
|:-------|:-----|:-----|
| `<<` | 왼쪽 시프트 | 비트를 왼쪽으로 이동 (× 2^n) |
| `>>` | 오른쪽 시프트 | 비트를 오른쪽으로 이동 (÷ 2^n), 부호 유지 |
| `>>>` | 부호 없는 오른쪽 시프트 | 부호 무시, 빈자리는 0 |

```java
int x = 8;  // 0b1000

System.out.println(x << 1);   // 16
System.out.println(x << 2);   // 32
System.out.println(x >> 1);   // 4
System.out.println(x >> 2);   // 2
```

{{< callout type="info" >}}
**`>>`와 `>>>`의 차이**는 음수를 다룰 때 드러난다. `-1 >> 1`은 부호 비트를 유지해 `-1`이지만, `-1 >>> 1`은 부호 비트를 0으로 채워 양의 거대한 값이 된다.
{{< /callout >}}

---

## 10. 조건 연산자 (`? :`)

### 10.1 문법

```java
조건식 ? 참일_때_값 : 거짓일_때_값
```

### 10.2 예제

```java
int a = 10, b = 20;
int max = (a > b) ? a : b;   // 20

// 중첩 (가독성 주의)
int x = 5;
String sign = (x > 0) ? "양수"
            : (x < 0) ? "음수"
            : "영";

// 절대값
int n = -10;
int abs = (n >= 0) ? n : -n;  // 10
```

---

## 11. 대입 연산자

### 11.1 기본 대입 연산자

```java
int x = 10;
int y = x;
int z = x + y;

// 연속 대입 (오른쪽 → 왼쪽)
int a, b, c;
a = b = c = 100;
```

### 11.2 lvalue와 rvalue

```java
// lvalue: 대입 연산자의 왼쪽 (값을 저장할 수 있어야 함)
// rvalue: 대입 연산자의 오른쪽 (값, 변수, 식 모두 가능)

// 3 = x;   // 컴파일 에러! 리터럴은 lvalue가 될 수 없음
```

### 11.3 복합 대입 연산자

| 복합 대입 | 풀어쓴 형태 |
|:----------|:-----------|
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
// 복합 대입은 형변환을 자동으로 포함한다
byte b = 10;
b += 5;        // OK — (byte)(b + 5)와 동일
// b = b + 5;  // 컴파일 에러 (int를 byte에 대입)
```

---

## 12. 형변환 연산자 `(type)`

### 12.1 명시적 형변환

```java
double d = 3.14;
int i = (int) d;    // 3 (소수점 버림)

long l = 100L;
int j = (int) l;    // 100

// 데이터 손실 주의
int big = 300;
byte b = (byte) big;  // 44 (오버플로우)
```

### 12.2 자동 형변환

```
byte → short → int → long → float → double
         char ↗
```

```java
int i = 100;
long l = i;        // 자동 확장
double d = l;      // 자동 확장

// 축소는 명시적 형변환 필요
double x = 3.14;
// int n = x;       // 컴파일 에러
int n = (int) x;    // OK
```

---

## 13. instanceof 연산자

```java
String str = "Hello";
System.out.println(str instanceof String);  // true
System.out.println(str instanceof Object);  // true

// null은 항상 false
String nullStr = null;
System.out.println(nullStr instanceof String);  // false

// 안전한 형변환
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

{{< callout type="info" >}}
**Java 16부터 패턴 매칭이 도입되어** `instanceof` 검사와 형변환을 한 줄에 쓸 수 있다. 별도의 캐스트 변수를 선언하지 않아도 되어 보일러플레이트가 줄어든다.
{{< /callout >}}

---

## 14. 요약

| 분류 | 연산자 | 특징 |
|:-----|:-------|:-----|
| 산술 | `+` `-` `*` `/` `%` | 사칙연산, 나머지 |
| 비교 | `==` `!=` `<` `>` `<=` `>=` | 결과는 boolean |
| 논리 | `&&` `\|\|` `!` | 단락 평가 |
| 비트 | `&` `\|` `^` `~` `<<` `>>` | 정수만 가능 |
| 대입 | `=` `+=` `-=` 등 | 가장 낮은 우선순위 |
| 증감 | `++` `--` | 전위/후위 구분 |
| 조건 | `? :` | 유일한 삼항 연산자 |

**핵심 규칙**

- 산술 변환: 피연산자 타입을 큰 쪽으로 맞추고, `int`보다 작으면 `int`로 변환
- 우선순위: 산술 > 비교 > 논리 > 대입
- 결합 방향: 대부분 왼쪽 → 오른쪽, 단항과 대입은 오른쪽 → 왼쪽
- 문자열 비교는 `==` 대신 `equals()`
- 실수 동등 비교는 `==` 대신 오차 범위(`Math.abs(a - b) < eps`)
