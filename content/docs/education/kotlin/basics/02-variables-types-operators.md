---
title: "Chapter 02. 변수와 자료형, 연산자"
weight: 2
---

# 변수와 자료형, 연산자

코틀린의 변수 선언 방식, 자료형 체계, Null 안전성, 그리고 연산자를 다룬다.

---

## 1. 패키지

### 1.1 프로젝트 구조

코틀린 프로젝트는 **모듈 → 패키지 → 파일** 계층으로 구성된다.

```
Project
├── Module A
│   ├── com.example.app
│   │   ├── Main.kt
│   │   └── Config.kt
│   └── com.example.util
│       └── Helper.kt
└── Module B
    └── com.example.api
        └── ApiClient.kt
```

- `.kt` 파일 맨 위에 `package` 키워드로 소속 패키지를 선언한다
- 패키지를 선언하지 않으면 **default 패키지**에 포함된다
- 하나의 파일에 여러 클래스를 정의할 수 있고, 파일 이름과 클래스 이름이 일치하지 않아도 된다

```kotlin
package com.example.app  // 패키지 선언

class User { }
class Order { }  // 한 파일에 여러 클래스 가능
```

{{< callout type="info" >}}
**Java와의 차이:** Java는 파일 이름과 public 클래스 이름이 반드시 일치해야 하지만, Kotlin은 이 제약이 없다. 파일은 단순히 클래스를 묶는 역할을 한다.
{{< /callout >}}

### 1.2 기본 패키지

코틀린에서 import 없이 바로 사용할 수 있는 기본 패키지가 있다.

| 패키지 | 설명 |
|:-------|:-----|
| `kotlin.*` | Any, Int, Double 등 핵심 함수와 자료형 |
| `kotlin.text.*` | 문자 관련 API |
| `kotlin.sequences.*` | 시퀀스(지연 평가 컬렉션) |
| `kotlin.ranges.*` | 범위 관련 요소 (`1..10`, `until`) |
| `kotlin.io.*` | 입출력 관련 API |
| `kotlin.collections.*` | List, Set, Map 등 컬렉션 |
| `kotlin.annotation.*` | 애노테이션 관련 API |

### 1.3 import와 별명(alias)

```kotlin
import com.example.util.StringHelper
import com.example.util.DateHelper as DH  // as로 별명 부여

fun main() {
    StringHelper.format("hello")
    DH.now()  // 별명으로 사용
}
```

동일한 이름의 클래스가 다른 패키지에 있을 때 `as` 키워드로 충돌을 해결한다.

---

## 2. 변수 선언

### 2.1 val과 var

코틀린에서 변수는 `val` 또는 `var` 키워드로 선언한다.

| 키워드 | 의미 | 재할당 | Java 대응 |
|:-------|:-----|:-------|:---------|
| `val` | value (읽기 전용) | 불가 | `final` 변수 |
| `var` | variable (변경 가능) | 가능 | 일반 변수 |

```kotlin
val name: String = "홍길동"  // 읽기 전용, 재할당 불가
var age: Int = 25           // 변경 가능

age = 26       // OK
// name = "김철수"  // 컴파일 에러! val은 재할당 불가
```

### 2.2 선언 문법

```kotlin
var username: String = "Kildong"
//  ^^^^^^^^  ^^^^^^   ^^^^^^^^
//  변수이름   자료형      값
```

### 2.3 자료형 추론 (Type Inference)

코틀린 컴파일러는 할당된 값을 보고 자료형을 자동으로 추론한다.

```kotlin
val name = "홍길동"    // String으로 추론
val age = 25          // Int로 추론
val pi = 3.14         // Double로 추론
val isActive = true   // Boolean으로 추론
```

{{< callout type="warning" >}}
**자료형 추론의 조건:** 자료형을 생략하려면 반드시 초기값을 함께 할당해야 한다.
```kotlin
val x = 100       // OK — 값으로부터 Int 추론
val y: Int        // OK — 자료형 명시 (나중에 초기화)
// val z           // 에러! 자료형도 없고 값도 없음
```
{{< /callout >}}

### 2.4 val은 불변이 아니라 "읽기 전용"

`val`은 참조(reference)를 바꿀 수 없을 뿐, 참조하는 객체의 내부 상태는 변경될 수 있다.

```kotlin
val list = mutableListOf(1, 2, 3)
// list = mutableListOf(4, 5)  // 에러! 참조 변경 불가
list.add(4)                     // OK — 내부 상태 변경은 가능
println(list)                   // [1, 2, 3, 4]
```

---

## 3. 자료형

### 3.1 코틀린의 자료형 체계

코틀린은 **참조형(Reference Type)만 사용**한다. 하지만 컴파일 시 코틀린 컴파일러가 자동으로 **기본형(Primitive Type)으로 최적화**한다.

```kotlin
val num: Int = 100
// 코드상으로는 참조형 Int이지만
// 컴파일 후 JVM 바이트코드에서는 기본형 int로 변환
```

{{< callout type="info" >}}
**Java와의 차이:** Java는 `int`(기본형)와 `Integer`(참조형)를 개발자가 구분해서 사용해야 한다. Kotlin은 `Int` 하나만 쓰면 컴파일러가 상황에 따라 기본형 또는 참조형으로 자동 변환한다. 따라서 기본형/참조형을 고민할 필요가 없다.
{{< /callout >}}

### 3.2 정수 자료형

#### 부호 있는 정수

| 자료형 | 크기 | 범위 |
|:-------|:-----|:-----|
| `Byte` | 1바이트 (8비트) | -128 ~ 127 |
| `Short` | 2바이트 (16비트) | -32,768 ~ 32,767 |
| `Int` | 4바이트 (32비트) | 약 -21억 ~ 21억 |
| `Long` | 8바이트 (64비트) | 약 -922경 ~ 922경 |

```kotlin
val num1 = 100             // Int로 추론
val num2 = 2147483648      // Long으로 추론 (Int 범위 초과)
val num3 = 100L            // 접미사 L → Long 명시
val num4: Byte = 127       // 자료형 명시 필요 (기본 추론은 Int)
val num5: Short = 32767    // 자료형 명시 필요

// 다른 진법 표현
val hex = 0xFF             // 16진수 → 255
val bin = 0b10110110       // 2진수 → 182
```

#### 부호 없는 정수 (Unsigned)

| 자료형 | 크기 | 범위 |
|:-------|:-----|:-----|
| `UByte` | 1바이트 | 0 ~ 255 |
| `UShort` | 2바이트 | 0 ~ 65,535 |
| `UInt` | 4바이트 | 0 ~ 약 42억 |
| `ULong` | 8바이트 | 0 ~ 약 1844경 |

```kotlin
val uByte: UByte = 255u
val uInt: UInt = 100u
val uLong: ULong = 100uL
```

#### 자릿값 구분자

큰 숫자의 가독성을 위해 언더스코어(`_`)를 사용할 수 있다.

```kotlin
val million = 1_000_000         // 1,000,000
val card = 1234_5678_9012_3456L
val hex = 0xFF_EC_DE_5E
val bytes = 0b11010010_01101001
```

### 3.3 실수 자료형

| 자료형 | 크기 | 유효 자릿수 |
|:-------|:-----|:-----------|
| `Float` | 4바이트 (32비트) | 소수점 이하 약 6~7자리 |
| `Double` | 8바이트 (64비트) | 소수점 이하 약 15~16자리 |

```kotlin
val d1 = 3.14          // Double로 추론 (기본)
val f1 = 3.14F         // 접미사 F → Float 명시

// 지수 표기법
val sci1 = 3.14e2      // 314.0 (3.14 × 10²)
val sci2 = 3.14E-2     // 0.0314 (3.14 × 10⁻²)
```

#### 부동 소수점의 원리 (IEEE 754)

실수는 메모리에 **부호 + 지수 + 가수** 형태로 저장된다.

```
Float (32비트):  [부호 1비트][지수 8비트][가수 23비트]
Double (64비트): [부호 1비트][지수 11비트][가수 52비트]
```

{{< callout type="warning" >}}
**부동 소수점 주의사항:** 실수는 근사값으로 저장되므로 정밀한 비교에 주의해야 한다.
```kotlin
val a = 0.1 + 0.2
println(a == 0.3)   // false!
println(a)           // 0.30000000000000004

// 정밀한 비교가 필요하면 오차 허용 범위를 설정
val epsilon = 1e-10
println(Math.abs(a - 0.3) < epsilon)  // true
```
{{< /callout >}}

### 3.4 논리 자료형

```kotlin
val isActive: Boolean = true
val isAdmin = false   // Boolean으로 추론

// 논리 연산에 주로 사용
if (isActive && !isAdmin) {
    println("일반 활성 사용자")
}
```

### 3.5 문자 자료형

`Char`는 2바이트(16비트)로 하나의 유니코드 문자를 저장한다.

```kotlin
val ch1: Char = 'A'
val ch2: Char = '가'
val ch3: Char = '\uAC00'  // 유니코드로 '가'

// 문자에 숫자 연산 가능
val next = ch1 + 1  // 'B'
println(next)        // B
```

{{< callout type="info" >}}
**Java와의 차이:** Java에서는 `char ch = 65;`처럼 숫자를 직접 대입할 수 있지만, Kotlin에서는 반드시 문자 리터럴(`'A'`)로 선언해야 한다. 선언 후에는 숫자를 더하는 연산이 가능하다.
{{< /callout >}}

### 3.6 문자열 자료형

#### String Pool과 참조 비교

```kotlin
val s1 = "Hello"
val s2 = "Hello"
val s3 = String("Hello".toCharArray())

println(s1 == s2)    // true  — 값(내용) 비교
println(s1 === s2)   // true  — 같은 String Pool 객체 참조
println(s1 === s3)   // false — 서로 다른 객체
```

#### 문자열 템플릿 (String Template)

```kotlin
val name = "홍길동"
val age = 25

// $ 기호로 변수 삽입
println("이름: $name")

// ${} 안에 표현식 사용
println("내년 나이: ${age + 1}")
println("이름 길이: ${name.length}")
```

#### 다중 문자열 (Raw String)

```kotlin
val json = """
    {
        "name": "홍길동",
        "age": 25
    }
""".trimIndent()

println(json)
```

`"""` 로 감싸면 이스케이프 문자 없이 여러 줄 문자열을 그대로 작성할 수 있다. `trimIndent()`로 불필요한 들여쓰기를 제거한다.

#### typealias로 자료형 별명 붙이기

```kotlin
typealias Username = String
typealias Age = Int

val user: Username = "홍길동"
val userAge: Age = 25
```

복잡한 자료형에 별명을 붙여 가독성을 높일 수 있다.

```kotlin
typealias UserMap = Map<String, List<Pair<Int, String>>>

val data: UserMap = mapOf("team1" to listOf(1 to "홍길동", 2 to "김철수"))
```

---

## 4. Null 안전성 (Null Safety)

코틀린의 가장 큰 특징 중 하나로, **컴파일 타임에 NPE를 방지**한다.

### 4.1 Nullable과 Non-null

코틀린에서 변수는 기본적으로 null을 허용하지 않는다. null을 허용하려면 자료형 뒤에 `?`를 붙여야 한다.

```kotlin
var name: String = "홍길동"
// name = null  // 컴파일 에러! String은 null 불가

var nullableName: String? = "홍길동"
nullableName = null  // OK — String?은 null 허용
```

### 4.2 세이프 콜 (Safe Call) — `?.`

null이 할당되어 있을 가능성이 있는 변수를 안전하게 호출하는 방법이다. 변수가 null이면 호출 자체를 하지 않고 null을 반환한다.

```kotlin
var str: String? = "Hello Kotlin"

println(str?.length)  // 12

str = null
println(str?.length)  // null (NPE 없이 안전하게 null 반환)
```

#### 세이프 콜 체이닝

```kotlin
data class Address(val city: String?)
data class User(val name: String, val address: Address?)

val user: User? = User("홍길동", Address("서울"))

// 중첩된 nullable 접근도 안전하게
val city = user?.address?.city
println(city)  // "서울"

val noUser: User? = null
val noCity = noUser?.address?.city
println(noCity)  // null
```

### 4.3 엘비스 연산자 (Elvis Operator) — `?:`

세이프 콜의 결과가 null일 때 **기본값을 지정**한다.

```kotlin
var str: String? = null

// str이 null이면 -1 반환
val length = str?.length ?: -1
println(length)  // -1

// 위 코드는 아래와 동일
val length2 = if (str != null) str.length else -1
```

```kotlin
// 실용적인 활용
fun getDisplayName(user: User?): String {
    return user?.name ?: "익명 사용자"
}

// 조기 반환 패턴
fun process(input: String?) {
    val value = input ?: return  // null이면 함수 즉시 종료
    println("처리: $value")
}
```

### 4.4 Non-null 단정 (Not-null Assertion) — `!!`

변수가 null이 아님을 **개발자가 단정**한다. null일 경우 NPE가 발생하므로 최후의 수단으로만 사용한다.

```kotlin
var str: String? = "Hello"

println(str!!.length)  // 5 — null이 아니므로 정상 동작

str = null
// println(str!!.length)  // NPE 발생! 가능하면 사용하지 말 것
```

{{< callout type="danger" >}}
**`!!` 사용은 최소화하라.** 세이프 콜(`?.`)과 엘비스 연산자(`?:`)로 대부분 해결할 수 있다. `!!`은 null이 절대 아닌 것이 확실한 경우에만 제한적으로 사용해야 한다.
{{< /callout >}}

### 4.5 Null 안전성 요약

| 기호 | 이름 | 동작 | 예시 |
|:-----|:-----|:-----|:-----|
| `?` | Nullable 선언 | null 허용 자료형 선언 | `var s: String?` |
| `?.` | 세이프 콜 | null이면 null 반환 | `s?.length` |
| `?:` | 엘비스 연산자 | null이면 기본값 반환 | `s?.length ?: 0` |
| `!!` | Non-null 단정 | null이면 NPE 발생 | `s!!.length` |

---

## 5. 자료형 검사와 변환

### 5.1 자료형 변환

코틀린은 **암시적 형 변환을 허용하지 않는다.** 반드시 변환 함수를 사용해야 한다.

```kotlin
val a: Int = 100

// val b: Long = a     // 컴파일 에러! 암시적 변환 불가
val b: Long = a.toLong()  // 명시적 변환 필요
```

| 변환 함수 | 반환 타입 |
|:---------|:---------|
| `toByte()` | Byte |
| `toShort()` | Short |
| `toInt()` | Int |
| `toLong()` | Long |
| `toFloat()` | Float |
| `toDouble()` | Double |
| `toChar()` | Char |

```kotlin
val intVal = 100
val doubleVal = intVal.toDouble()   // 100.0
val longVal = intVal.toLong()       // 100L

// 표현식에서는 큰 자료형으로 자동 변환
val result = 10 + 3.14   // Double로 자동 변환 → 13.14
val result2 = 10L + 3    // Long으로 자동 변환 → 13L
```

{{< callout type="info" >}}
**왜 암시적 변환을 금지하는가?** 의도하지 않은 데이터 손실이나 타입 변환을 방지하기 위해서다. Java에서 `int`를 `long`에 대입하면 자동으로 변환되지만, 이로 인한 미묘한 버그가 발생할 수 있다.
{{< /callout >}}

### 5.2 비교 연산자: `==` vs `===`

| 연산자 | 비교 대상 | 설명 |
|:-------|:---------|:-----|
| `==` | 값 (구조적 동등성) | 내용이 같으면 true |
| `===` | 참조 (참조적 동등성) | 같은 객체를 가리키면 true |

```kotlin
val a: Int = 128
val b: Int? = 128

println(a == b)    // true  — 값이 같음
println(a === b)   // false — a는 기본형(스택), b는 참조형(힙)
```

{{< callout type="warning" >}}
**캐싱 범위 주의:** -128 ~ 127 범위의 값은 캐시에 저장되어 참조가 동일할 수 있다. 이 범위를 벗어나면 참조가 달라진다.
```kotlin
val x: Int? = 127
val y: Int? = 127
println(x === y)  // true (캐시 범위 내)

val m: Int? = 128
val n: Int? = 128
println(m === n)  // false (캐시 범위 밖)
```
{{< /callout >}}

### 5.3 is를 이용한 자료형 검사와 스마트 캐스트

`is` 키워드로 자료형을 검사하면, 해당 블럭 안에서 자동으로 형 변환된다.

```kotlin
fun checkType(x: Any) {
    if (x is String) {
        // 이 블럭 안에서 x는 자동으로 String으로 캐스트됨
        println("문자열 길이: ${x.length}")  // x.length 바로 사용 가능
    }

    if (x is Int) {
        println("정수의 제곱: ${x * x}")
    }
}

checkType("Hello")   // 문자열 길이: 5
checkType(7)          // 정수의 제곱: 49
```

### 5.4 as를 이용한 명시적 캐스트

```kotlin
val obj: Any = "Hello Kotlin"

val str: String = obj as String     // 성공
println(str.length)                  // 12

// val num: Int = obj as Int         // ClassCastException!

// 안전한 캐스트: 실패하면 null 반환
val safeNum: Int? = obj as? Int
println(safeNum)                     // null (예외 없음)
```

### 5.5 Number형과 스마트 캐스트

`Number` 타입은 저장되는 값에 따라 자동으로 자료형이 변환된다.

```kotlin
var num: Number = 12.2   // Double
num = 12                  // Int로 스마트 캐스트
num = 120L                // Long으로 스마트 캐스트
num += 12.0f              // Float로 스마트 캐스트
```

### 5.6 Any — 모든 클래스의 최상위

코틀린의 `Any`는 모든 클래스의 슈퍼클래스이다. Java의 `Object`에 해당한다.

```kotlin
fun printAnything(value: Any) {
    println("값: $value, 타입: ${value::class.simpleName}")
}

printAnything(42)        // 값: 42, 타입: Int
printAnything("Hello")   // 값: Hello, 타입: String
printAnything(3.14)      // 값: 3.14, 타입: Double
```

---

## 6. 연산자

### 6.1 산술 연산자

| 연산자 | 의미 | 예시 | 결과 |
|:-------|:-----|:-----|:-----|
| `+` | 덧셈 | `3 + 2` | `5` |
| `-` | 뺄셈 | `3 - 2` | `1` |
| `*` | 곱셈 | `3 * 2` | `6` |
| `/` | 나눗셈 | `7 / 2` | `3` (정수 나눗셈) |
| `%` | 나머지 | `7 % 2` | `1` |

```kotlin
// 정수 나눗셈 주의
println(7 / 2)      // 3 (소수점 버림)
println(7.0 / 2)    // 3.5 (실수 나눗셈)
println(7 / 2.0)    // 3.5
```

### 6.2 대입 연산자

| 연산자 | 의미 | 동일 표현 |
|:-------|:-----|:---------|
| `=` | 대입 | - |
| `+=` | 더한 후 대입 | `a = a + b` |
| `-=` | 뺀 후 대입 | `a = a - b` |
| `*=` | 곱한 후 대입 | `a = a * b` |
| `/=` | 나눈 후 대입 | `a = a / b` |
| `%=` | 나머지 후 대입 | `a = a % b` |

### 6.3 증가/감소 연산자

| 연산자 | 위치 | 동작 |
|:-------|:-----|:-----|
| `++` | 앞 (`++a`) | 먼저 증가 후 값 사용 |
| `++` | 뒤 (`a++`) | 값 먼저 사용 후 증가 |
| `--` | 앞 (`--a`) | 먼저 감소 후 값 사용 |
| `--` | 뒤 (`a--`) | 값 먼저 사용 후 감소 |

```kotlin
var a = 10
val b = ++a   // a를 먼저 11로 만든 후 b에 대입
println("a=$a, b=$b")  // a=11, b=11

var c = 10
val d = c++   // d에 10을 먼저 대입한 후 c를 11로 만듦
println("c=$c, d=$d")  // c=11, d=10
```

### 6.4 비교 연산자

| 연산자 | 의미 |
|:-------|:-----|
| `>`, `<` | 크다, 작다 |
| `>=`, `<=` | 크거나 같다, 작거나 같다 |
| `==` | 값이 같다 (구조적 동등성) |
| `!=` | 값이 다르다 |
| `===` | 참조가 같다 (참조적 동등성) |
| `!==` | 참조가 다르다 |

### 6.5 논리 연산자

| 연산자 | 의미 | 설명 |
|:-------|:-----|:-----|
| `&&` | 논리곱 (AND) | 둘 다 true일 때 true |
| `\|\|` | 논리합 (OR) | 하나라도 true이면 true |
| `!` | 부정 (NOT) | true ↔ false 반전 |

```kotlin
val age = 25
val hasLicense = true

if (age >= 18 && hasLicense) {
    println("운전 가능")
}
```

{{< callout type="info" >}}
**단축 평가 (Short-circuit Evaluation):**
- `&&` — 왼쪽이 false이면 오른쪽을 평가하지 않음
- `||` — 왼쪽이 true이면 오른쪽을 평가하지 않음

이를 활용하면 안전한 조건 검사가 가능하다.
```kotlin
val str: String? = null
if (str != null && str.length > 0) {  // str이 null이면 length는 평가 안 됨
    println(str)
}
```
{{< /callout >}}

### 6.6 비트 연산자

코틀린의 비트 연산은 메서드 형태로 제공된다.

| 함수 | 의미 | Java 대응 |
|:-----|:-----|:---------|
| `shl(n)` | 왼쪽 시프트 | `<<` |
| `shr(n)` | 오른쪽 시프트 (부호 유지) | `>>` |
| `ushr(n)` | 오른쪽 시프트 (부호 무시) | `>>>` |
| `and(other)` | 비트 AND | `&` |
| `or(other)` | 비트 OR | `\|` |
| `xor(other)` | 비트 XOR | `^` |
| `inv()` | 비트 반전 | `~` |

```kotlin
val x = 0b1010  // 10
val y = 0b1100  // 12

println(x and y)     // 0b1000 = 8
println(x or y)      // 0b1110 = 14
println(x xor y)     // 0b0110 = 6
println(x.inv())     // 비트 반전

println(1 shl 3)     // 8  (1을 왼쪽으로 3칸 시프트)
println(16 shr 2)    // 4  (16을 오른쪽으로 2칸 시프트)
```

---

## 7. 요약

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **val / var** | 읽기 전용 / 변경 가능 변수 |
| **자료형 추론** | 컴파일러가 값으로부터 자료형을 자동 결정 |
| **참조형 최적화** | 코드에서는 참조형, 컴파일 후에는 기본형으로 변환 |
| **Null Safety** | `?`, `?.`, `?:`, `!!`로 NPE를 컴파일 타임에 방지 |
| **스마트 캐스트** | `is` 검사 후 자동 형 변환 |
| **명시적 변환** | 암시적 형 변환 금지, `toInt()` 등 변환 함수 사용 |
| **`==` vs `===`** | 값 비교 vs 참조 비교 |

### Java와의 주요 차이점

| 항목 | Java | Kotlin |
|:-----|:-----|:-------|
| 변수 선언 | `int a = 10;` | `val a = 10` |
| Null 허용 | 모든 참조형이 null 가능 | `?` 명시 필요 |
| 자료형 변환 | 암시적 변환 허용 (`int → long`) | 명시적 변환만 허용 |
| 기본형/참조형 | 개발자가 구분 | 컴파일러가 자동 최적화 |
| 비교 연산 | `==` (참조), `.equals()` (값) | `==` (값), `===` (참조) |
| 파일/클래스 | 파일명 = 클래스명 | 제약 없음 |
