---
title: "Chapter 01-02. 자바 8과 동작 파라미터화"
weight: 1
---

## 1. 자바 8의 핵심 변화

자바 역사상 **가장 큰 변화**가 자바 8에서 일어났다.

### 두 가지 핵심 목표

| 목표 | 해결책 |
|------|--------|
| **간결한 코드** | 람다, 메서드 참조 |
| **멀티코어 활용** | 스트림 API |

---

## 2. 자바 8의 세 가지 핵심 개념

### 2.1 스트림 처리 (Stream Processing)

```
기존: 한 번에 한 항목 처리 (외부 반복)
Java 8: 고수준 추상화로 일련의 스트림 처리 (내부 반복)
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

**안전한 병렬 처리 조건:**
- 공유된 가변 데이터(shared mutable data)에 접근하지 않기
- **순수 함수** (pure function): 부작용 없는 함수
- **상태 없는 함수** (stateless function)

---

## 3. 함수를 값으로 (일급 시민)

### 일급 시민 vs 이급 시민

| 구분 | 설명 | 예시 |
|------|------|------|
| **일급 시민** | 자유롭게 전달 가능 | 기본값, 객체 |
| **이급 시민** | 전달 불가 | 메서드, 클래스 (Java 7 이전) |

> **Java 8**: 메서드와 람다를 **일급 시민**으로 승격

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
filterApples(inventory, (Apple a) -> a.getWeight() < 80 || RED.equals(a.getColor()));
```

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
|------|------|
| **컬렉션** | 데이터 저장/접근 방법 |
| **스트림** | 데이터 계산/처리 방법 |

### 포킹 (Forking) - 병렬 처리

```
┌──────────────────────────────────────┐
│           원본 리스트                  │
└──────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│   CPU 1       │   │   CPU 2       │
│  (앞부분)      │   │  (뒷부분)      │
└───────────────┘   └───────────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
┌──────────────────────────────────────┐
│           결과 병합                   │
└──────────────────────────────────────┘
```

---

## 5. 디폴트 메서드

인터페이스에 **구현부가 있는 메서드** 추가 가능

```java
public interface List<E> {
    // 기존 추상 메서드들...

    // 디폴트 메서드 (Java 8+)
    default void sort(Comparator<? super E> c) {
        Collections.sort(this, c);
    }
}
```

**장점**: 기존 구현 클래스를 수정하지 않고 인터페이스 확장 가능

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

```
┌─────────────────────────────────────────┐
│          ApplePredicate (인터페이스)     │
│  boolean test(Apple apple)              │
└─────────────────────────────────────────┘
                    △
        ┌───────────┼───────────┐
        │           │           │
┌───────┴───────┐ ┌─┴─┐ ┌───────┴───────┐
│ GreenColor    │ │...│ │ HeavyWeight   │
│ Predicate     │ │   │ │ Predicate     │
└───────────────┘ └───┘ └───────────────┘
```

> **전략 패턴** (Strategy Pattern): 알고리즘을 캡슐화하고 런타임에 선택

### 진화 과정

| 단계 | 방식 | 코드량 |
|------|------|--------|
| 1 | 값 파라미터화 | 메서드 중복 |
| 2 | 인터페이스 + 구현 클래스 | 클래스 파일 증가 |
| 3 | 익명 클래스 | 여전히 장황함 |
| 4 | **람다** | 간결함 |

### 최종 형태: 제네릭 + 람다

```java
// 제네릭 Predicate 인터페이스
public interface Predicate<T> {
    boolean test(T t);
}

// 제네릭 filter 메서드
public static <T> List<T> filter(List<T> list, Predicate<T> p) {
    List<T> result = new ArrayList<>();
    for (T e : list) {
        if (p.test(e)) {
            result.add(e);
        }
    }
    return result;
}

// 사용: 어떤 타입이든 필터링 가능
filter(apples, (Apple a) -> RED.equals(a.getColor()));
filter(numbers, (Integer n) -> n % 2 == 0);
filter(strings, (String s) -> s.length() > 5);
```

---

## 7. 프레디케이트 (Predicate)

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
Predicate<Integer> isEven = n -> n % 2 == 0;
```

---

## 요약

| 개념 | 핵심 |
|------|------|
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
