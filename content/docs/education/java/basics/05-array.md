---
title: "Chapter 05. 배열 (Array)"
weight: 5
---

# 배열 (Array)

**배열(array)**은 같은 타입의 여러 변수를 하나의 묶음으로 다루는 자료구조다. 서로 다른 타입의 변수들로 구성된 배열은 만들 수 없다.

---

## 1. 배열의 선언과 생성

### 1.1 배열 선언

대괄호`[]`는 타입 뒤에 붙여도 되고, 변수 이름 뒤에 붙여도 된다.

| 선언 방법 | 예시 |
|:----------|:-----|
| 타입[] 변수이름 | `int[] score;` `String[] names;` |
| 타입 변수이름[] | `int score[];` `String names[];` |

{{< callout type="info" >}}
**권장:** `타입[] 변수이름` 형식을 사용하자. 타입과 배열 표시가 함께 있어 가독성이 좋다.
{{< /callout >}}

### 1.2 배열 생성

배열을 선언하면 참조변수만 생성되고, 실제 저장공간은 `new` 연산자로 생성해야 한다.

```java
int[] score;              // 배열 선언 (참조변수 생성)
score = new int[5];       // 배열 생성 (저장공간 할당)

// 선언과 생성을 동시에
int[] score = new int[5]; // 5개의 int 값을 저장할 수 있는 배열
```

**배열 생성 시 메모리 구조:**

```
score (참조변수)
   │
   └──→ [0][1][2][3][4]  (연속된 메모리 공간)
         0  0  0  0  0   (int 기본값으로 초기화)
```

---

## 2. 배열의 인덱스와 길이

### 2.1 인덱스 (Index)

배열의 각 요소는 **0부터 시작하는 인덱스**로 접근한다.

```java
int[] arr = new int[5];

arr[0] = 10;  // 첫 번째 요소
arr[4] = 50;  // 마지막 요소 (길이 - 1)

// 인덱스로 변수나 수식 사용 가능
for (int i = 0; i < 5; i++) {
    arr[i] = (i + 1) * 10;  // 10, 20, 30, 40, 50
}
```

{{< callout type="warning" >}}
**ArrayIndexOutOfBoundsException:** 유효하지 않은 인덱스 접근 시 런타임 에러가 발생한다. 컴파일러는 이 오류를 잡지 못하므로 주의해야 한다.
{{< /callout >}}

```java
int[] arr = new int[5];
arr[5] = 100;   // 런타임 에러! 유효 인덱스는 0~4
arr[-1] = 100;  // 런타임 에러! 음수 인덱스 불가
```

### 2.2 배열의 길이 (length)

JVM이 모든 배열의 길이를 관리하며, `배열이름.length`로 접근할 수 있다.

```java
int[] arr = new int[5];
System.out.println(arr.length);  // 5

// 배열 순회 시 length 활용 (권장)
for (int i = 0; i < arr.length; i++) {
    System.out.println(arr[i]);
}
```

{{< callout type="info" >}}
**length는 상수다.** 배열은 한번 생성하면 길이를 변경할 수 없으므로, `arr.length = 10;` 같은 코드는 컴파일 에러가 발생한다.
{{< /callout >}}

**배열 길이의 범위:**
- 최소: 0 (길이가 0인 배열도 생성 가능)
- 최대: int의 최대값 (약 21억)

```java
int[] empty = new int[0];  // 길이가 0인 배열 (합법적)
System.out.println(empty.length);  // 0
```

---

## 3. 배열의 초기화

### 3.1 기본값 초기화

배열은 생성 시 자동으로 타입별 기본값으로 초기화된다.

| 자료형 | 기본값 |
|:-------|:-------|
| boolean | false |
| char | '\u0000' (공백) |
| byte, short, int | 0 |
| long | 0L |
| float | 0.0f |
| double | 0.0d |
| 참조형 (String, Object 등) | null |

### 3.2 선언과 동시에 초기화

```java
// 방법 1: new 연산자 사용
int[] arr = new int[]{10, 20, 30, 40, 50};

// 방법 2: new 연산자 생략 (선언과 동시에만 가능)
int[] arr = {10, 20, 30, 40, 50};

// 주의: 선언과 초기화를 분리할 때는 new 필수
int[] arr;
arr = new int[]{10, 20, 30, 40, 50};  // OK
arr = {10, 20, 30, 40, 50};           // 컴파일 에러!
```

### 3.3 메서드 매개변수로 전달

```java
// 메서드 호출 시에는 new 생략 불가
public int sum(int[] arr) { ... }

sum(new int[]{1, 2, 3});  // OK
sum({1, 2, 3});           // 컴파일 에러!
```

---

## 4. 배열의 출력

### 4.1 Arrays.toString()

```java
import java.util.Arrays;

int[] arr = {1, 2, 3, 4, 5};
System.out.println(Arrays.toString(arr));  // [1, 2, 3, 4, 5]
```

### 4.2 배열 참조변수 직접 출력

```java
int[] arr = {1, 2, 3};
System.out.println(arr);  // [I@15db9742 (타입@해시코드)
```

- `[I`: 1차원 int 배열
- `@` 뒤: 해시코드(16진수)

{{< callout type="info" >}}
**예외:** char 배열은 직접 출력해도 문자열처럼 출력된다.
```java
char[] ch = {'H', 'e', 'l', 'l', 'o'};
System.out.println(ch);  // Hello
```
{{< /callout >}}

---

## 5. 배열의 복사

배열은 길이 변경이 불가능하므로, 더 큰 저장공간이 필요하면 새 배열을 만들어 복사해야 한다.

### 5.1 반복문을 이용한 복사

```java
int[] original = {1, 2, 3, 4, 5};
int[] copy = new int[10];

for (int i = 0; i < original.length; i++) {
    copy[i] = original[i];
}
```

### 5.2 System.arraycopy()

**가장 빠른 방법.** 네이티브 코드로 구현되어 있다.

```java
System.arraycopy(src, srcPos, dest, destPos, length);
// src: 원본 배열
// srcPos: 원본 시작 위치
// dest: 대상 배열
// destPos: 대상 시작 위치
// length: 복사할 요소 개수
```

```java
int[] original = {1, 2, 3, 4, 5};
int[] copy = new int[10];

System.arraycopy(original, 0, copy, 0, original.length);
// copy: [1, 2, 3, 4, 5, 0, 0, 0, 0, 0]

// 중간에 삽입
int[] arr = {1, 2, 3, 4, 5};
int[] result = new int[7];
System.arraycopy(arr, 0, result, 0, 2);    // [1, 2, 0, 0, 0, 0, 0]
result[2] = 99;                             // [1, 2, 99, 0, 0, 0, 0]
System.arraycopy(arr, 2, result, 3, 3);    // [1, 2, 99, 3, 4, 5, 0]
```

### 5.3 Arrays.copyOf()

새 배열을 생성하여 반환한다.

```java
import java.util.Arrays;

int[] original = {1, 2, 3, 4, 5};

// 같은 크기로 복사
int[] copy1 = Arrays.copyOf(original, original.length);
// [1, 2, 3, 4, 5]

// 더 큰 크기로 복사 (나머지는 0으로 채움)
int[] copy2 = Arrays.copyOf(original, 10);
// [1, 2, 3, 4, 5, 0, 0, 0, 0, 0]

// 일부만 복사
int[] copy3 = Arrays.copyOfRange(original, 1, 4);  // 인덱스 1~3
// [2, 3, 4]
```

### 5.4 clone()

배열 객체를 복제한다.

```java
int[] original = {1, 2, 3, 4, 5};
int[] copy = original.clone();
```

{{< callout type="warning" >}}
**얕은 복사(Shallow Copy):** 참조형 배열에서 `clone()`, `arraycopy()`, `copyOf()`는 객체의 주소만 복사한다. 원본과 복사본이 같은 객체를 참조하게 된다.
{{< /callout >}}

```java
String[] original = {"A", "B", "C"};
String[] copy = original.clone();

copy[0] = "X";  // String은 불변이므로 새 객체 할당
System.out.println(original[0]);  // "A" (영향 없음)

// 하지만 가변 객체 배열의 경우
Person[] people = {new Person("Kim"), new Person("Lee")};
Person[] copy2 = people.clone();
copy2[0].setName("Park");  // 원본도 변경됨!
```

---

## 6. String 배열

### 6.1 선언과 생성

```java
String[] names = new String[3];  // [null, null, null]
names[0] = "Kim";
names[1] = "Lee";
names[2] = "Park";

// 초기화와 동시에
String[] names = {"Kim", "Lee", "Park"};
```

### 6.2 String 배열의 메모리 구조

```
names (참조변수)
   │
   └──→ [0]────→ "Kim"
        [1]────→ "Lee"
        [2]────→ "Park"
```

참조형 배열은 **객체의 주소**를 저장한다.

---

## 7. char 배열과 String

### 7.1 차이점

```java
// char 배열
char[] charArr = {'H', 'e', 'l', 'l', 'o'};

// String
String str = "Hello";
```

| 특성 | char[] | String |
|:-----|:-------|:-------|
| 변경 가능 | O (mutable) | X (immutable) |
| 메서드 | 없음 | 다양한 편의 메서드 제공 |
| 용도 | 문자 단위 조작 필요 시 | 일반적인 문자열 처리 |

### 7.2 상호 변환

```java
// String → char[]
String str = "Hello";
char[] charArr = str.toCharArray();

// char[] → String
char[] charArr = {'H', 'e', 'l', 'l', 'o'};
String str = new String(charArr);
```

### 7.3 String의 주요 메서드

| 메서드 | 설명 | 예시 |
|:-------|:-----|:-----|
| `charAt(int index)` | 특정 위치의 문자 반환 | `"Hello".charAt(1)` → `'e'` |
| `length()` | 문자열 길이 반환 | `"Hello".length()` → `5` |
| `substring(int from, int to)` | 부분 문자열 추출 (to 미포함) | `"Hello".substring(1, 4)` → `"ell"` |
| `equals(Object obj)` | 문자열 내용 비교 | `"Hi".equals("Hi")` → `true` |
| `toCharArray()` | char 배열로 변환 | `"Hi".toCharArray()` → `{'H', 'i'}` |

---

## 8. 다차원 배열

### 8.1 2차원 배열 선언과 생성

```java
int[][] arr = new int[3][4];  // 3행 4열의 2차원 배열
```

| 선언 방법 | 예시 |
|:----------|:-----|
| 타입[][] 변수이름 | `int[][] score;` (권장) |
| 타입 변수이름[][] | `int score[][];` |
| 타입[] 변수이름[] | `int[] score[];` |

**메모리 구조:**

```
arr (참조변수)
  │
  └──→ arr[0] ──→ [0][1][2][3]
       arr[1] ──→ [0][1][2][3]
       arr[2] ──→ [0][1][2][3]
```

### 8.2 인덱스

```java
int[][] arr = new int[3][4];

arr[0][0] = 1;    // 첫 번째 행, 첫 번째 열
arr[2][3] = 12;   // 마지막 행, 마지막 열

// 행의 개수
System.out.println(arr.length);       // 3

// 열의 개수 (각 행의 길이)
System.out.println(arr[0].length);    // 4
```

### 8.3 초기화

```java
int[][] arr = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};

// 순회
for (int i = 0; i < arr.length; i++) {
    for (int j = 0; j < arr[i].length; j++) {
        System.out.print(arr[i][j] + " ");
    }
    System.out.println();
}

// 향상된 for문으로 순회
for (int[] row : arr) {
    for (int value : row) {
        System.out.print(value + " ");
    }
    System.out.println();
}
```

### 8.4 가변 배열 (Ragged Array)

Java의 2차원 배열은 **배열의 배열**이므로 각 행의 길이가 달라도 된다.

```java
int[][] arr = new int[3][];  // 열 크기 미지정
arr[0] = new int[2];         // 1행은 2개
arr[1] = new int[4];         // 2행은 4개
arr[2] = new int[3];         // 3행은 3개

// 초기화로 가변 배열 생성
int[][] arr = {
    {1, 2},
    {3, 4, 5, 6},
    {7, 8, 9}
};
```

**가변 배열 메모리 구조:**

```
arr
  │
  └──→ arr[0] ──→ [0][1]
       arr[1] ──→ [0][1][2][3]
       arr[2] ──→ [0][1][2]
```

---

## 9. 배열 유틸리티 (Arrays 클래스)

### 9.1 정렬 (sort)

```java
import java.util.Arrays;

int[] arr = {5, 2, 8, 1, 9};
Arrays.sort(arr);
System.out.println(Arrays.toString(arr));  // [1, 2, 5, 8, 9]

// 부분 정렬
int[] arr2 = {5, 2, 8, 1, 9};
Arrays.sort(arr2, 1, 4);  // 인덱스 1~3만 정렬
System.out.println(Arrays.toString(arr2));  // [5, 1, 2, 8, 9]

// 역순 정렬 (Integer 배열 필요)
Integer[] arr3 = {5, 2, 8, 1, 9};
Arrays.sort(arr3, Collections.reverseOrder());
System.out.println(Arrays.toString(arr3));  // [9, 8, 5, 2, 1]
```

### 9.2 검색 (binarySearch)

**이진 검색**은 정렬된 배열에서만 사용 가능하다.

```java
int[] arr = {1, 2, 5, 8, 9};  // 정렬 필수!

int index = Arrays.binarySearch(arr, 5);
System.out.println(index);  // 2

int notFound = Arrays.binarySearch(arr, 3);
System.out.println(notFound);  // -3 (음수: 삽입 위치의 음수 - 1)
```

### 9.3 비교 (equals, deepEquals)

```java
int[] arr1 = {1, 2, 3};
int[] arr2 = {1, 2, 3};
int[] arr3 = {1, 2, 4};

System.out.println(arr1 == arr2);             // false (주소 비교)
System.out.println(Arrays.equals(arr1, arr2)); // true (내용 비교)
System.out.println(Arrays.equals(arr1, arr3)); // false

// 다차원 배열은 deepEquals 사용
int[][] arr2d1 = {{1, 2}, {3, 4}};
int[][] arr2d2 = {{1, 2}, {3, 4}};
System.out.println(Arrays.equals(arr2d1, arr2d2));     // false
System.out.println(Arrays.deepEquals(arr2d1, arr2d2)); // true
```

### 9.4 채우기 (fill)

```java
int[] arr = new int[5];
Arrays.fill(arr, 7);
System.out.println(Arrays.toString(arr));  // [7, 7, 7, 7, 7]

// 부분 채우기
int[] arr2 = new int[5];
Arrays.fill(arr2, 1, 4, 9);  // 인덱스 1~3만
System.out.println(Arrays.toString(arr2));  // [0, 9, 9, 9, 0]
```

---

## 10. 실전 활용 패턴

### 10.1 배열 요소 합계/평균

```java
int[] scores = {85, 90, 78, 92, 88};

// 합계
int sum = 0;
for (int score : scores) {
    sum += score;
}

// 평균
double average = (double) sum / scores.length;
System.out.println("합계: " + sum + ", 평균: " + average);
```

### 10.2 최대값/최소값 찾기

```java
int[] arr = {5, 2, 8, 1, 9, 3};

int max = arr[0];
int min = arr[0];

for (int i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
    if (arr[i] < min) min = arr[i];
}

System.out.println("최대: " + max + ", 최소: " + min);

// Arrays와 Stream 활용 (Java 8+)
int max2 = Arrays.stream(arr).max().getAsInt();
int min2 = Arrays.stream(arr).min().getAsInt();
```

### 10.3 배열 뒤집기

```java
int[] arr = {1, 2, 3, 4, 5};

for (int i = 0; i < arr.length / 2; i++) {
    int temp = arr[i];
    arr[i] = arr[arr.length - 1 - i];
    arr[arr.length - 1 - i] = temp;
}

System.out.println(Arrays.toString(arr));  // [5, 4, 3, 2, 1]
```

### 10.4 배열 요소 이동 (회전)

```java
// 왼쪽 회전 (첫 요소가 마지막으로)
int[] arr = {1, 2, 3, 4, 5};
int first = arr[0];
System.arraycopy(arr, 1, arr, 0, arr.length - 1);
arr[arr.length - 1] = first;
System.out.println(Arrays.toString(arr));  // [2, 3, 4, 5, 1]
```

### 10.5 2차원 배열 전치 (행과 열 교환)

```java
int[][] matrix = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};

// 정방행렬 전치 (제자리)
for (int i = 0; i < matrix.length; i++) {
    for (int j = i + 1; j < matrix[i].length; j++) {
        int temp = matrix[i][j];
        matrix[i][j] = matrix[j][i];
        matrix[j][i] = temp;
    }
}
```

---

## 11. 요약

| 항목 | 내용 |
|:-----|:-----|
| 선언 | `타입[] 변수이름;` 권장 |
| 생성 | `new 타입[길이]` |
| 인덱스 | 0 ~ length-1 |
| 길이 | `배열.length` (상수) |
| 초기화 | `{값1, 값2, ...}` |
| 출력 | `Arrays.toString(배열)` |
| 복사 | `System.arraycopy()` (가장 빠름) |
| 정렬 | `Arrays.sort()` |
| 검색 | `Arrays.binarySearch()` (정렬 필수) |
| 비교 | `Arrays.equals()` / `deepEquals()` |

{{< callout type="info" >}}
**핵심 포인트:**
- 배열은 같은 타입의 데이터를 연속된 메모리에 저장
- 인덱스는 0부터 시작, 범위 초과 시 런타임 에러
- 길이 변경 불가, 필요 시 새 배열로 복사
- 참조형 배열 복사 시 얕은 복사 주의
- Arrays 유틸리티 클래스 적극 활용
{{< /callout >}}
