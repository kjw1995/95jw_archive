---
title: "Chapter 01-02. 자바 8과 동작 파라미터화"
weight: 1
---

## 1. 자바 8의 핵심 변화

자바 역사상 **가장 큰 변화**가 자바 8에서 일어났다. 그 배경에는 **멀티코어 CPU의 대중화**가 있다. 클럭 속도 경쟁이 한계에 부딪히면서 CPU는 코어 수를 늘리는 방향으로 진화했고, 자바는 이 코어들을 쉽게 활용할 수 있는 언어 기능이 필요했다.

### 두 가지 핵심 목표

| 목표 | 해결책 |
|:-----|:-----|
| **간결한 코드** | 람다, 메서드 참조 |
| **멀티코어 활용** | 스트림 API, 병렬 처리 |

{{< callout type="info" >}}
자바 8의 모든 기능(람다, 스트림, 디폴트 메서드)은 결국 **"멀티코어를 안전하고 간결하게 활용한다"** 는 하나의 목표로 수렴한다. 이 관점에서 보면 개별 기능들이 왜 함께 등장했는지 이해하기 쉽다.
{{< /callout >}}

---

## 2. 자바 8의 세 가지 핵심 개념

### 2.1 스트림 처리 (Stream Processing)

```
기존:    한 번에 한 항목 처리 (외부 반복)
Java 8:  고수준 추상화로 스트림 처리 (내부 반복)
```

**핵심 장점:**
- 파이프라인 방식으로 데이터 처리
- 멀티코어 병렬 처리 자동화
- `synchronized` 없이 안전한 병렬 처리

### 2.2 동작 파라미터화 (Behavior Parameterization)

> 코드를 메서드의 인수로 전달하는 기법

```java
// 메서드 참조로 동작 전달
filterApples(inventory, Apple::isGreenApple);

// 람다로 동작 전달
filterApples(inventory, (Apple a) -> a.getWeight() > 150);
```

### 2.3 병렬성과 공유 가변 데이터

스트림을 병렬로 처리하려면 전달하는 동작이 **안전하게 동시 실행**될 수 있어야 한다.

**안전한 병렬 처리 조건:**
- 공유된 가변 데이터(shared mutable data)에 접근하지 않기
- **순수 함수(pure function)**: 부작용(side effect) 없는 함수
- **상태 없는 함수(stateless function)**

{{< callout type="warning" >}}
여러 스레드가 **공유된 가변 데이터**를 동시에 수정하면 데이터가 손상된다. 함수형 프로그래밍이 강조하는 "부작용 없음"은 단순한 코딩 취향이 아니라 **병렬 안전성을 보장하기 위한 전제 조건**이다.
{{< /callout >}}

---

## 3. 함수를 값으로 (일급 시민)

### 일급 시민 vs 이급 시민

| 구분 | 설명 | 예시 |
|:-----|:-----|:-----|
| **일급 시민** | 자유롭게 전달 가능 | 기본값, 객체 |
| **이급 시민** | 전달 불가 | 메서드, 클래스 (Java 7 이전) |

> **Java 8**: 메서드와 람다를 **일급 시민**으로 승격 → 함수를 값처럼 전달

### 메서드 참조 (Method Reference)

```java
// Java 7: 익명 클래스
File[] hiddenFiles = new File(".").listFiles(new FileFilter() {
    public boolean accept(File file) {
        return file.isHidden();
    }
});

// Java 8: 메서드 참조
File[] hiddenFiles = new File(".").listFiles(File::isHidden);
```

`::` = "이 메서드를 값으로 사용하라"

### 람다 (익명 함수)

```java
// 한 번만 사용할 동작은 람다로 간결하게
filterApples(inventory, (Apple a) -> GREEN.equals(a.getColor()));
filterApples(inventory, (Apple a) -> a.getWeight() > 150);
filterApples(inventory, (Apple a) ->
    a.getWeight() < 80 || RED.equals(a.getColor()));
```

{{< callout type="info" >}}
**메서드 참조 vs 람다 선택 기준:** 이미 이름 붙은 메서드가 있다면 메서드 참조(`Apple::isGreenApple`)가 의도를 더 잘 드러낸다. 반대로 한 곳에서만 쓰는 간단한 동작이라면 별도 메서드를 만들지 말고 람다로 인라인 처리하는 편이 낫다.
{{< /callout >}}

---

## 4. 스트림 API

### 외부 반복 vs 내부 반복

```java
// 외부 반복 (for-each)
for (Apple apple : inventory) {
    if (apple.getColor() == GREEN) {
        result.add(apple);
    }
}

// 내부 반복 (스트림)
inventory.stream()
         .filter(a -> a.getColor() == GREEN)
         .collect(toList());
```

### 컬렉션 vs 스트림

| 구분 | 중점 |
|:-----|:-----|
| **컬렉션** | 데이터 저장/접근 방법 |
| **스트림** | 데이터 계산/처리 방법 |

### 포킹(Forking) — 병렬 처리

스트림은 데이터를 여러 청크로 나눠 각 코어에 분배한 뒤 결과를 다시 합친다.

```
        원본 데이터
            │
      ┌─────┴─────┐
      ▼           ▼
  [ CPU 1 ]   [ CPU 2 ]   ← 앞부분 / 뒷부분
      │           │          병렬 처리
      └─────┬─────┘
            ▼
         결과 병합
```

> 사용자는 데이터를 어떻게 나누고 합칠지 신경 쓸 필요 없이 `parallelStream()`만 호출하면 된다. **분할-처리-병합**은 라이브러리가 담당한다.

---

## 5. 디폴트 메서드

인터페이스에 **구현부가 있는 메서드**를 추가할 수 있다.

```java
public interface List<E> {
    // 기존 추상 메서드들...

    // 디폴트 메서드 (Java 8+)
    default void sort(Comparator<? super E> c) {
        Collections.sort(this, c);
    }
}
```

**왜 필요했나?** 자바 8은 컬렉션에 `stream()`, `sort()` 같은 새 메서드를 추가해야 했다. 하지만 인터페이스에 추상 메서드를 추가하면 **기존 구현 클래스가 모두 컴파일 에러**가 난다. 디폴트 메서드는 인터페이스에 기본 구현을 제공해 이 문제를 해결한다.

{{< callout type="warning" >}}
두 인터페이스가 같은 시그니처의 디폴트 메서드를 제공하면 **다이아몬드 문제**가 발생한다. 이때 구현 클래스는 반드시 해당 메서드를 오버라이드해 어느 쪽을 쓸지(`InterfaceName.super.method()`) 명시해야 컴파일된다.
{{< /callout >}}

---

## 6. 동작 파라미터화 상세

### 문제: 변화하는 요구사항

```java
// 1차: 녹색 사과 필터링
filterGreenApples(inventory);

// 2차: 빨간 사과도 필터링 → 메서드 복붙? DRY 위반!
filterRedApples(inventory);

// 3차: 무게로 필터링 → 또 복붙?
filterHeavyApples(inventory);
```

### 해결: 동작 파라미터화

조건(동작)을 인터페이스로 추상화하고, 구체적인 판단 로직을 구현체로 분리한다.

```
┌────────────────────────┐
│   ApplePredicate        │  ← 인터페이스
│   boolean test(Apple)   │
└────────────────────────┘
            △ 구현
   ┌────────┼────────┐
   │        │        │
GreenColor Heavy   Custom
Predicate  Weight  Predicate
           Predicate
```

> **전략 패턴(Strategy Pattern):** 알고리즘(동작)을 캡슐화하고 런타임에 선택해 교체한다. 동작 파라미터화는 이 패턴을 언어 차원에서 자연스럽게 표현한 것이다.

### 진화 과정

| 단계 | 방식 | 한계 |
|:-----|:-----|:-----|
| 1 | 값 파라미터화 | 메서드 중복 |
| 2 | 인터페이스 + 구현 클래스 | 클래스 파일 증가 |
| 3 | 익명 클래스 | 여전히 장황함 |
| 4 | **람다** | 간결함 |
| 5 | **람다 + 제네릭** | 재사용성 극대화 |

### 최종 형태: 제네릭 + 람다

```java
// 제네릭 Predicate 인터페이스
public interface Predicate<T> {
    boolean test(T t);
}

// 제네릭 filter 메서드 — 어떤 타입이든 처리
public static <T> List<T> filter(List<T> list, Predicate<T> p) {
    List<T> result = new ArrayList<>();
    for (T e : list) {
        if (p.test(e)) {
            result.add(e);
        }
    }
    return result;
}

// 사용: 타입에 상관없이 동작만 바꿔 재사용
filter(apples, (Apple a) -> RED.equals(a.getColor()));
filter(numbers, (Integer n) -> n % 2 == 0);
filter(strings, (String s) -> s.length() > 5);
```

{{< callout type="info" >}}
**동작 파라미터화의 가치:** 요구사항이 바뀔 때 새 메서드를 추가하는 대신 **전달하는 동작만 교체**하면 된다. 변경에 닫혀 있고 확장에 열려 있는(OCP) 코드가 자연스럽게 만들어진다.
{{< /callout >}}

---

## 7. 프레디케이트(Predicate)

> 인수를 받아 **boolean을 반환**하는 함수

```java
@FunctionalInterface
public interface Predicate<T> {
    boolean test(T t);
}
```

**사용 예:**

```java
Predicate<Apple> greenApple = a -> GREEN.equals(a.getColor());
Predicate<Apple> heavyApple = a -> a.getWeight() > 150;
Predicate<Integer> isEven  = n -> n % 2 == 0;
```

---

## 8. 요약

| 개념 | 핵심 |
|:-----|:-----|
| **스트림** | 내부 반복, 병렬 처리 자동화 |
| **동작 파라미터화** | 코드를 메서드 인수로 전달 |
| **람다** | 익명 함수, 간결한 코드 |
| **메서드 참조** | `클래스::메서드`로 메서드를 값처럼 전달 |
| **일급 시민** | 함수도 값처럼 전달 가능 |
| **디폴트 메서드** | 인터페이스에 구현 추가 가능 |
| **함수형 프로그래밍** | 순수 함수, 부작용 없음, 상태 없음 |

### Java 8 이전 vs 이후

```java
// Before: 익명 클래스 (장황함)
Collections.sort(inventory, new Comparator<Apple>() {
    public int compare(Apple a1, Apple a2) {
        return a1.getWeight().compareTo(a2.getWeight());
    }
});

// After: 람다 + 메서드 참조 (간결함)
inventory.sort(comparing(Apple::getWeight));
```

{{< callout type="info" >}}
**핵심 포인트:**
- 자바 8의 변화는 **멀티코어 활용**과 **코드 간결성**이라는 두 축에서 출발한다
- 동작 파라미터화는 **변화하는 요구사항**에 코드 중복 없이 대응하는 기법이다
- 람다는 동작 파라미터화를 **장황한 익명 클래스 없이** 표현하게 해준다
- 병렬 처리의 전제는 **공유 가변 데이터를 건드리지 않는 것**이다
{{< /callout >}}
