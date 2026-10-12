---
title: "Chapter 06. 스트림으로 데이터 수집"
date: 2026-05-12
weight: 5
---

[Chapter 05](../04-stream-utilization)에서는 `reduce`로 스트림을 합계나 최댓값 같은 값 하나로 접었다. 그런데 실제로 원하는 결과는 "통화별 거래 목록"이나 "타입별로 칼로리가 가장 높은 요리"처럼 **구조를 가진 값**일 때가 더 많다. 그 일을 맡는 것이 최종 연산 `collect`와 그 인수인 컬렉터다. 이 장의 내용은 세 원리로 정리된다. 첫째, **컬렉터는 "어떻게 모을지"를 담은 값이다.** 반복은 `collect`가 돌리고 무엇에 어떻게 담을지는 컬렉터가 정하므로, `Collectors`의 팩토리 메서드들은 서로 끼워 맞춰 다수준 그룹화 같은 복잡한 수집도 선언 하나로 표현한다. 둘째, **`collect`는 가변 컨테이너에 모으고 `reduce`는 불변 값을 접는다.** 둘 다 리듀싱이지만 이 구분을 어기면 병렬에서 결과가 깨진다. 셋째, **컬렉터는 함수 네 개와 특성 집합으로 이루어진 규약이다.** `supplier`, `accumulator`, `combiner`, `finisher`와 `characteristics`를 알면 미리 정의된 컬렉터가 왜 그렇게 동작하는지 설명되고, 필요하면 직접 만들 수도 있다.

---

## 1. 컬렉터란 무엇인가

### 1.1 명령형 그룹화와 비교

```java
// 명령형: 어떻게 모을지를 전부 적는다
Map<Currency, List<Transaction>>
    byCurrency = new HashMap<>();
for (Transaction t : transactions) {
    Currency c = t.getCurrency();
    List<Transaction> list =
        byCurrency.get(c);
    if (list == null) {
        list = new ArrayList<>();
        byCurrency.put(c, list);
    }
    list.add(t);
}
```

```java
// 컬렉터: 무엇으로 묶을지만 적는다
Map<Currency, List<Transaction>>
    byCurrency = transactions.stream()
        .collect(groupingBy(
            Transaction::getCurrency));
```

두 코드는 거래 목록을 통화별로 묶는다. 위의 명령형 코드는 맵을 만들고, 통화로 리스트를 찾고, 없으면 새로 만들어 넣고, 거래를 추가하는 **절차**를 적는다. 정작 하고 싶은 말인 "통화로 묶어라"는 그 절차 속에 묻힌다. Java 8의 `computeIfAbsent()`를 쓰면 몇 줄 줄어들지만, 맵을 만들고 반복을 돌리는 일은 여전히 호출하는 쪽 몫이다.

아래 코드는 그 말만 적는다. `groupingBy(Transaction::getCurrency)`는 "통화를 키로 삼아 리스트에 모아라"라는 **수집 방법을 담은 객체**이고, `collect`가 스트림을 돌면서 그 방법대로 요소를 모은다. 수집 방법이 값이므로 변수에 담을 수도, 다른 컬렉터 안에 넣을 수도 있다. 첫째 원리이고, 4절의 다수준 그룹화가 이 성질 덕분에 가능하다.

### 1.2 collect도 리듀싱이다

```
   menu.stream()
         │ 요소를 하나씩
         ▼
┌──────────────────┐
│ collect(컬렉터)  │
│ 빈 컨테이너 생성 │
│ 요소마다 누적    │
│ 최종 결과로 변환 │
└────────┬─────────┘
         ▼
  List, Map, 값 하나
```

`collect`도 스트림의 모든 요소를 결과 하나로 합치는 리듀싱이다. 다만 5장의 `reduce`가 두 값을 받아 **새 값**을 돌려주며 접는다면, `collect`는 빈 컨테이너를 하나 만들어 두고 요소를 그 안에 **계속 집어넣는다.** 어떤 컨테이너를 만들지, 요소를 어떻게 넣을지, 마지막에 무엇으로 바꿀지가 전부 컬렉터 안에 들어 있다. 그 정체인 `Collector` 인터페이스는 6절에서 본다.

### 1.3 Collectors가 제공하는 것

| 분류 | 대표 메서드 | 결과 | 왜 이렇게 나눴나 |
|:-----|:-----------|:-----|:----------------|
| 요약 | `counting`, `summingInt`, `averagingInt`, `maxBy`, `joining` | 값 하나 | `reduce`로도 되지만 자주 쓰는 접기에 이름을 붙였다 |
| 컬렉션 | `toList`, `toSet`, `toMap`, `toCollection` | 컬렉션 | 한 번 흐르고 끝나는 스트림을 다시 저장할 수 있는 자료구조로 되돌린다 |
| 그룹화 | `groupingBy` | `Map<K, ...>` | 분류 함수의 결과를 키로 요소를 나눈다 |
| 분할 | `partitioningBy` | `Map<Boolean, ...>` | 키가 참과 거짓 둘뿐이라 두 그룹이 항상 함께 있다 |
| 조합 | `mapping`, `filtering`, `collectingAndThen`, `teeing` | 다른 컬렉터를 감싼다 | 그룹 안에서 다시 수집하려면 컬렉터끼리 끼워 맞춰야 한다 |

### 1.4 이 장의 예제

이 장의 코드는 `java.util.stream.Collectors`와 `Comparator`의 정적 메서드를 `import static`으로 들여온 상태이고, [Chapter 04](../03-stream-introduction)부터 써 온 `Dish`로 다음 메뉴를 다룬다.

```java
public class Dish {
    private final String name;
    private final boolean vegetarian;
    private final int calories;
    private final Type type;
    // 생성자, getter 생략
    // toString()은 name을 돌려준다

    public enum Type {
        MEAT, FISH, OTHER
    }
}
```

```
요리          채식  칼로리  타입
pork           -     800    MEAT
beef           -     700    MEAT
chicken        -     400    MEAT
french fries   O     530    OTHER
rice           O     350    OTHER
season fruit   O     120    OTHER
pizza          O     550    OTHER
prawns         -     300    FISH
salmon         -     450    FISH
```

---

## 2. 리듀싱과 요약

### 2.1 개수와 최댓값

```java
long howMany = menu.stream()
    .collect(counting());       // 9

Comparator<Dish> byCalories =
    comparingInt(Dish::getCalories);
Optional<Dish> most = menu.stream()
    .collect(maxBy(byCalories));
// Optional[pork]
```

`counting()`은 요소 수를 `Long`으로 돌려준다. `maxBy`와 `minBy`는 `Comparator`를 받아 가장 큰 요소와 가장 작은 요소를 찾는데, 결과가 `Optional`이다. 메뉴가 비어 있으면 최댓값이라는 답 자체가 없기 때문이다. 5장의 `reduce(Integer::max)`가 `Optional`을 돌려준 것과 같은 이유다.

개수 하나만 필요하면 `menu.stream().count()`가 더 짧다. `counting()`이 쓸모를 보이는 곳은 4절처럼 **그룹마다** 개수를 셀 때다. 다른 컬렉터 안에 넣을 수 있는 것은 컬렉터뿐이기 때문이다.

### 2.2 합계, 평균, 통계

```java
int total = menu.stream().collect(
    summingInt(Dish::getCalories));
// 4200
double avg = menu.stream().collect(
    averagingInt(Dish::getCalories));
// 466.666...

IntSummaryStatistics stats = menu
    .stream()
    .collect(summarizingInt(
        Dish::getCalories));
// IntSummaryStatistics{count=9,
//   sum=4200, min=120,
//   average=466.666667, max=800}
stats.getMax();                 // 800
```

`summingInt`는 요소를 `int`로 바꾸는 함수를 받아 그 값들을 더한다. `summingLong`, `summingDouble`과 평균을 내는 `averagingInt`, `averagingLong`, `averagingDouble`도 같은 모양이다. 합계, 평균, 최솟값, 최댓값이 모두 필요할 때 스트림을 네 번 돌릴 필요는 없다. `summarizingInt`가 한 번의 순회로 다섯 값을 `IntSummaryStatistics`에 모은다(`long`, `double` 판은 `LongSummaryStatistics`, `DoubleSummaryStatistics`).

| 컬렉터 | 결과 타입 | 빈 스트림일 때 | 왜 |
|:-------|:---------|:--------------|:---|
| `summingInt` | `Integer` | `0` | 더할 것이 없으면 덧셈의 항등원이 답이다 |
| `averagingInt` | `Double` | `0.0` | 0으로 나누는 대신 0.0으로 정해 두었다 |
| `summarizingInt` | `IntSummaryStatistics` | `count=0`, `min`은 `Integer.MAX_VALUE`, `max`는 `Integer.MIN_VALUE` | 어떤 값이 와도 갱신되도록 시작값을 반대쪽 끝에 둔다 |
| `maxBy`, `minBy` | `Optional<T>` | `Optional.empty` | 비교할 요소가 없으면 답이 없다 |

{{< callout type="warning" >}}
빈 스트림에서 `averagingInt`는 `0.0`을, `summarizingInt`의 `getMin()`은 `2147483647`을 돌려준다. "평균이 0"과 "데이터가 없음"이 같은 값으로 나오는 셈이다. 둘을 구분해야 하면 `getCount()`를 먼저 보거나, 빈 경우를 `OptionalDouble`로 알려 주는 `mapToInt(...).average()`를 쓴다.
{{< /callout >}}

### 2.3 문자열 연결

```java
String names = menu.stream()
    .map(Dish::getName)
    .collect(joining(", "));
// pork, beef, chicken, ...

String list = menu.stream()
    .map(Dish::getName)
    .collect(joining(", ", "[", "]"));
// [pork, beef, ..., salmon]
```

```java
menu.stream().collect(joining());
// 컴파일 오류: no suitable method
//   found for collect(Collector<
//   CharSequence,CAP#1,String>)
```

`joining`은 요소들을 문자열 하나로 이어 붙인다. 인수가 없으면 `StringBuilder`에, 구분자가 있으면 `StringJoiner`에 모으고, 구분자만 주거나 구분자와 접두사, 접미사를 함께 줄 수 있다. 주의할 점은 `joining`의 타입이 `Collector<CharSequence, ?, String>`이라 **문자열 스트림에만 쓸 수 있다**는 것이다. 객체 스트림에 바로 `joining()`을 걸면 각 객체의 `toString()`을 이어 붙인다는 설명을 종종 보지만, 위처럼 컴파일되지 않는다. 객체는 `map(Dish::getName)`이나 `map(Object::toString)`으로 먼저 문자열로 바꾼다.

### 2.4 범용 리듀싱: reducing

```java
// 초깃값, 변환 함수, 합치는 함수
int total = menu.stream().collect(
    reducing(0, Dish::getCalories,
             Integer::sum));
// 4200

// 합치는 함수만. 결과는 Optional
BinaryOperator<Dish> bigger =
    (a, b) -> a.getCalories()
        >= b.getCalories() ? a : b;
Optional<Dish> most = menu.stream()
    .collect(reducing(bigger));
// Optional[pork]
```

| 형태 | 결과 | 왜 |
|:-----|:-----|:---|
| `reducing(초깃값, 합치기)` | `T` | 초깃값이 있으면 빈 스트림에서도 답이 있다 |
| `reducing(합치기)` | `Optional<T>` | 초깃값이 없으면 빈 스트림의 답이 없다 |
| `reducing(초깃값, 변환, 합치기)` | `U` | 요소를 먼저 다른 타입(칼로리)으로 바꾼 뒤 접는다 |

지금까지 본 컬렉터는 모두 `reducing`의 특수한 경우다. `summingInt(Dish::getCalories)`는 첫 번째 예제와 같고, `counting()`은 `reducing(0L, e -> 1L, Long::sum)`과 같다. 그래도 특화된 컬렉터를 쓰는 이유는 **읽기 쉬워서**다. `counting()`은 이름만으로 뜻이 보이지만 `reducing(0L, e -> 1L, Long::sum)`은 한 번 풀어 읽어야 한다.

### 2.5 collect와 reduce는 왜 다른가

```java
// 잘못된 사용: 가변 리스트를 reduce로
List<Integer> wrong = numbers.stream()
    .reduce(new ArrayList<>(),
        (list, e) -> {
            list.add(e);
            return list;
        },
        (l1, l2) -> {
            l1.addAll(l2);
            return l1;
        });
// 순차: 우연히 맞는 리스트
// 병렬: 요소가 중복되어 크게 불어나거나
//       예외가 난다
```

`reduce`의 첫 인수는 **항등값**이다. 병렬로 돌리면 스트림은 조각마다 이 항등값에서 출발해 접는데, 여기서 항등값은 값이 아니라 `ArrayList` **객체 하나**다. 모든 조각이 같은 리스트에 동시에 `add`하고, 결합 함수는 같은 리스트를 자기 자신에게 `addAll`한다. 그래서 요소가 중복되어 불어나거나 `ArrayList`의 내부 배열이 깨져 예외가 난다. 순차로는 맞는 답이 나오기 때문에 더 위험하다.

`collect`는 이 문제를 구조로 막는다. 조각마다 **새 컨테이너**를 만들고, 각 조각은 자기 컨테이너에만 넣고, 마지막에 컨테이너끼리 합친다. 여러 스레드가 함께 바꾸는 객체가 처음부터 없다. 둘째 원리다.

| | `reduce` | `collect` | 왜 |
|:--|:---------|:----------|:---|
| 접는 방식 | 두 값으로 **새 값**을 만든다 | 컨테이너를 **바꾼다** | 불변 값은 새로 만들고, 컨테이너는 채워 나가는 것이 자연스럽다 |
| 출발점 | 항등값 하나를 모든 조각이 함께 쓴다 | 조각마다 새 컨테이너를 만든다 | 가변 객체를 함께 쓰면 병렬에서 경쟁이 생긴다 |
| 어울리는 일 | 합계, 최댓값, 곱 | 리스트, 맵, `StringBuilder`에 모으기 | 결과가 불변 값인가 가변 컨테이너인가로 고른다 |
| 병렬 조건 | 연산의 결합법칙과 항등값 | 컨테이너를 합치는 함수 | 조각을 어떻게 나눠도 같은 답이어야 한다 |

### 2.6 같은 결과를 내는 여러 방법

```java
menu.stream().collect(counting());
menu.stream().count();
menu.stream().collect(
    reducing(0L, d -> 1L, Long::sum));

menu.stream().collect(
    summingInt(Dish::getCalories));
menu.stream()
    .mapToInt(Dish::getCalories)
    .sum();
```

같은 답을 여러 방법으로 낼 수 있을 때 고르는 기준은 **의도가 가장 잘 드러나고 가장 짧은 쪽**이다. 하나만 계산할 때는 `count()`와 `mapToInt(...).sum()`이 낫고, `mapToInt`는 5장의 기본형 특화 스트림이라 박싱도 없다. 컬렉터 판(`counting`, `summingInt`)은 그룹마다 세거나 더하는 것처럼 **다른 컬렉터 안에 넣을 때** 필요하다.

### 2.7 두 컬렉터를 한 번에: teeing

```java
String range = menu.stream()
    .collect(teeing(
        minBy(byCalories),
        maxBy(byCalories),
        (lo, hi) -> lo.get().getName()
            + " ~ "
            + hi.get().getName()));
// season fruit ~ pork
```

Java 12의 `teeing`은 요소를 두 컬렉터에 동시에 흘려보내고, 두 결과를 합치는 함수로 마무리한다. 이름은 입력을 T자로 둘로 가르는 유닉스 `tee` 명령에서 왔다. 최솟값과 최댓값을 따로 구하면 스트림을 두 번 만들어야 하지만 `teeing`은 한 번의 순회로 끝난다. 파일의 줄처럼 한 번만 읽을 수 있는 소스에서 특히 쓸모가 있다. 여기서 `get()`이 안전한 것은 메뉴가 비어 있지 않음을 알기 때문이다.

---

## 3. 컬렉션으로 모으기

### 3.1 리스트와 집합

```java
// Java 16. 불변, null 허용
List<String> a = menu.stream()
    .map(Dish::getName).toList();

// 바꿀 수 있는 리스트(보통 ArrayList)
List<String> b = menu.stream()
    .map(Dish::getName)
    .collect(toList());

// Java 10. 불변, null 거부
List<String> c = menu.stream()
    .map(Dish::getName)
    .collect(toUnmodifiableList());

// 구현을 직접 고른다
TreeSet<String> d = menu.stream()
    .map(Dish::getName)
    .collect(toCollection(
        TreeSet::new));
```

| 방법 | 결과 | 변경 | `null` 요소 | 왜 |
|:-----|:-----|:-----|:-----------|:---|
| `Stream.toList()` (Java 16) | 불변 리스트 | 불가 | 허용 | 짧고 돌려주기에 안전한 기본값이다 |
| `Collectors.toList()` | 지금은 `ArrayList` | 가능 | 허용 | Java 8부터 있던 방식이다. 명세는 어떤 `List`인지 약속하지 않는다 |
| `toUnmodifiableList()` (Java 10) | 불변 리스트 | 불가 | `NullPointerException` | `List.of()`와 같은 규칙을 따른다 |
| `toSet()` | 지금은 `HashSet` | 가능 | 허용 | 순서를 약속하지 않으므로 `UNORDERED` 특성을 가진다(6.4절) |
| `toCollection(생성자)` | 지정한 구현 | 구현에 따라 | 구현에 따라 | 정렬, 순서, 중복 규칙을 직접 고를 때 |

기본 선택은 `Stream.toList()`다. 나중에 요소를 넣고 빼야 한다면 `Collectors.toList()`의 결과가 우연히 `ArrayList`라는 데 기대지 말고 `toCollection(ArrayList::new)`로 그 의도를 적는다.

### 3.2 toMap

```java
Map<String, Integer> calories =
    menu.stream().collect(toMap(
        Dish::getName,
        Dish::getCalories));
// {pork=800, beef=700, ...}

menu.stream().collect(toMap(
    Dish::getType, Dish::getName));
// IllegalStateException:
//   Duplicate key MEAT (attempted
//   merging values pork and beef)
```

```java
Map<Dish.Type, String> namesByType =
    menu.stream().collect(toMap(
        Dish::getType,
        Dish::getName,
        (a, b) -> a + ", " + b,
        () -> new EnumMap<>(
            Dish.Type.class)));
// {MEAT=pork, beef, chicken,
//  FISH=prawns, salmon,
//  OTHER=french fries, rice, ...}
```

`toMap`은 키를 뽑는 함수와 값을 뽑는 함수를 받는다. 키가 겹치면 어느 값을 남길지 라이브러리가 대신 정할 수 없으므로 예외를 던진다. 겹칠 수 있다면 셋째 인수로 **병합 함수**를, 맵의 종류를 고르려면 넷째 인수로 맵 생성자를 준다.

| 상황 | 결과 | 왜 | 대응 |
|:-----|:-----|:---|:-----|
| 키 중복 | `IllegalStateException` | 두 값 중 무엇을 남길지는 도메인이 정할 일이다 | 셋째 인수로 병합 함수 |
| 값이 `null` | `NullPointerException` | 병합에 쓰는 `Map.merge()`가 `null`을 "값 없음"의 뜻으로 쓰므로 `null` 값을 받지 않는다 | `null`을 거르거나 기본값으로 바꾼다 |
| 맵 구현 | 기본은 `HashMap` | 키의 순서를 약속하지 않는다 | 넷째 인수로 `TreeMap::new`, `LinkedHashMap::new`, `EnumMap` |

`HashMap` 자체는 `null` 값을 받는데 `toMap`이 거부하는 것은 의외로 보인다. 병합 함수가 있는 `toMap`은 `Map.merge()`로 값을 넣는데, `merge()`는 병합 결과가 `null`이면 그 키를 지우는 규칙이라 `null`을 값으로 둘 수 없다. 두 인수 `toMap`도 같은 규칙을 지키도록 값을 미리 검사한다.

---

## 4. 그룹화

### 4.1 groupingBy와 분류 함수

```java
Map<Dish.Type, List<Dish>> byType =
    menu.stream().collect(
        groupingBy(Dish::getType));
// {MEAT=[pork, beef, chicken],
//  FISH=[prawns, salmon],
//  OTHER=[french fries, rice,
//         season fruit, pizza]}
```

`groupingBy`는 각 요소에 **분류 함수**를 적용해 나온 값을 키로, 그 키를 가진 요소들의 리스트를 값으로 하는 맵을 만든다. SQL의 `GROUP BY`와 같은 일이다. 분류 함수는 메서드 참조가 아니어도 된다. 칼로리 등급처럼 필드에 없는 기준이면 람다로 적고, [Chapter 03](../02-lambda-expressions)에서 본 것처럼 함수도 값이므로 변수에 담아 두고 쓸 수 있다.

```java
enum CaloricLevel {
    DIET, NORMAL, FAT
}

Function<Dish, CaloricLevel> level =
    d -> d.getCalories() <= 400 ? DIET
       : d.getCalories() <= 700 ? NORMAL
       : FAT;

Map<CaloricLevel, List<Dish>> byLevel =
    menu.stream().collect(
        groupingBy(level));
// {DIET=[chicken, rice,
//        season fruit, prawns],
//  NORMAL=[beef, french fries,
//          pizza, salmon],
//  FAT=[pork]}
```

{{< callout type="warning" >}}
결과 맵은 `HashMap`이라 키의 순서를 약속하지 않는다. 특히 `enum`의 `hashCode()`는 객체마다 정해지는 식별 해시라서, 같은 코드라도 실행할 때마다 키 순서가 달라질 수 있다. 이 장의 출력은 읽기 쉽게 `enum` 선언 순서로 적었다. 순서가 필요하면 4.5절처럼 맵 구현을 지정한다. 또 분류 함수가 `null`을 돌려주면 "element cannot be mapped to a null key"라는 `NullPointerException`이 난다.
{{< /callout >}}

### 4.2 그룹 안에서 거르고 바꾸기

```java
// 거른 뒤 묶기
menu.stream()
    .filter(d -> d.getCalories() > 500)
    .collect(groupingBy(Dish::getType));
// {MEAT=[pork, beef],
//  OTHER=[french fries, pizza]}
// FISH 키가 없다

// 묶은 뒤 그룹 안에서 거르기 (Java 9)
var over500 = filtering(
    (Dish d) -> d.getCalories() > 500,
    toList());
menu.stream().collect(
    groupingBy(Dish::getType, over500));
// {MEAT=[pork, beef], FISH=[],
//  OTHER=[french fries, pizza]}
```

```
filter 다음 groupingBy
  요소 ─[거름]─▶ ─[분류]─▶ 맵
  FISH 요소는 분류 전에 사라진다

groupingBy 안의 filtering
  요소 ─[분류]─▶ 키별 ─[거름]─▶ 맵
  FISH 키는 생기고 리스트만 빈다
```

500칼로리가 넘는 요리를 타입별로 묶을 때, 먼저 `filter`로 거르면 조건을 만족하는 생선 요리가 없어 `FISH` 키 자체가 사라진다. `groupingBy`는 어떤 키가 있을지 미리 모르고, **요소가 도착했을 때** 그 키를 만들기 때문이다. 거르기를 `groupingBy` 안쪽의 `filtering`으로 옮기면 모든 요소가 먼저 분류되어 키가 생기고, 거르기는 각 그룹 안에서 일어난다. "생선 요리 중에는 해당하는 것이 없다"는 정보가 `FISH=[]`로 남는다.

`groupingBy`의 두 번째 인수처럼 그룹 하나를 무엇으로 모을지 정하는 컬렉터를 **다운스트림 컬렉터**라 한다. 거르는 `filtering` 말고도 요소를 바꾸는 `mapping`, 요소 하나를 여러 개로 펼치는 `flatMapping`(Java 9)이 같은 자리에 들어간다.

```java
Map<Dish.Type, List<String>> names =
    menu.stream().collect(groupingBy(
        Dish::getType,
        mapping(Dish::getName,
                toList())));
// {MEAT=[pork, beef, chicken],
//  FISH=[prawns, salmon], ...}
```

```java
Map<String, List<String>> tags =
    new HashMap<>();
tags.put("pork",
    List.of("greasy", "salty"));
tags.put("beef",
    List.of("salty", "roasted"));
tags.put("chicken",
    List.of("fried", "crisp"));
// 나머지 요리도 같은 식으로

Map<Dish.Type, Set<String>> tagsByType =
    menu.stream().collect(groupingBy(
        Dish::getType,
        flatMapping(
            d -> tags.get(d.getName())
                     .stream(),
            toSet())));
// {MEAT=[salty, greasy, roasted,
//        fried, crisp], ...}
```

`mapping`은 그룹의 요소를 이름으로 바꿔 모은다. `flatMapping`은 요리 하나가 가진 태그 여러 개를 스트림으로 펼친 뒤 모으고, `toSet()`이 중복 태그를 없앤다. 5장의 `map`과 `flatMap`을 그룹 안쪽에서 하는 셈이다.

### 4.3 다수준 그룹화

```java
Map<Dish.Type,
    Map<CaloricLevel, List<Dish>>>
    byTypeAndLevel = menu.stream()
        .collect(groupingBy(
            Dish::getType,
            groupingBy(level)));
// {MEAT={DIET=[chicken],
//        NORMAL=[beef], FAT=[pork]},
//  FISH={DIET=[prawns],
//        NORMAL=[salmon]},
//  OTHER={DIET=[rice, season fruit],
//         NORMAL=[french fries,
//                 pizza]}}
```

```
groupingBy(타입)
├─ MEAT ── groupingBy(등급)
│   ├─ DIET   → [chicken]
│   ├─ NORMAL → [beef]
│   └─ FAT    → [pork]
├─ FISH
│   ├─ DIET   → [prawns]
│   └─ NORMAL → [salmon]
└─ OTHER
    ├─ DIET   → [rice, fruit]
    └─ NORMAL → [fries, pizza]
```

인수 하나짜리 `groupingBy(f)`는 사실 `groupingBy(f, toList())`의 줄임이다. 다운스트림 자리에 `toList()` 대신 또 다른 `groupingBy`를 주면, 각 타입 그룹이 다시 등급별로 나뉘어 두 단계 맵이 된다. 단계 수에는 제한이 없다. n단계 그룹화는 `groupingBy`를 n번 겹친 것이다. 명령형으로 짜면 맵 안의 맵을 꺼내고 없으면 만드는 코드가 단계마다 늘어나지만, 컬렉터는 값이라 그냥 안에 넣으면 된다.

### 4.4 서브그룹을 다른 컬렉터로 수집

```java
Map<Dish.Type, Long> countByType =
    menu.stream().collect(groupingBy(
        Dish::getType, counting()));
// {MEAT=3, FISH=2, OTHER=4}

Map<Dish.Type, Optional<Dish>> top =
    menu.stream().collect(groupingBy(
        Dish::getType,
        maxBy(byCalories)));
// {MEAT=Optional[pork],
//  FISH=Optional[salmon],
//  OTHER=Optional[pizza]}
```

다운스트림에는 어떤 컬렉터든 들어간다. 2절의 요약 컬렉터를 넣으면 그룹마다 세고, 더하고, 최댓값을 찾는다. 그런데 `maxBy`의 결과가 `Optional`이라 맵의 값이 전부 `Optional`로 싸여 나왔다.

```java
Map<Dish.Type, Dish> topDish =
    menu.stream().collect(groupingBy(
        Dish::getType,
        collectingAndThen(
            maxBy(byCalories),
            Optional::get)));
// {MEAT=pork, FISH=salmon,
//  OTHER=pizza}
```

```
┌──────────── groupingBy ────────────┐
│  분류 함수: Dish::getType          │
│  ┌───── collectingAndThen ─────┐   │
│  │  ┌──────── maxBy ────────┐  │   │
│  │  │ byCalories로 최댓값   │  │   │
│  │  └───────────────────────┘  │   │
│  │  변환 함수: Optional::get   │   │
│  └─────────────────────────────┘   │
└────────────────────────────────────┘
```

`collectingAndThen(컬렉터, 함수)`는 안쪽 컬렉터의 결과에 함수를 한 번 더 적용하는 컬렉터다. 여기서 `Optional::get`이 안전한 이유는 `groupingBy`의 그룹이 **요소가 하나 이상 도착해야 생기기** 때문이다. 빈 그룹이 없으니 `maxBy`의 `Optional`도 비지 않는다.

{{< callout type="warning" >}}
`Optional::get`이 안전하다는 보장은 그룹이 비지 않을 때만 성립한다. 4.2절의 `filtering`을 `maxBy` 앞에 끼우면 `FISH`처럼 빈 그룹이 생기고, 그 그룹의 `get()`은 `NoSuchElementException`이다. 5절의 `partitioningBy`도 빈 쪽 그룹을 항상 만든다. 빈 그룹이 생길 수 있으면 `Optional`을 그대로 두거나 `orElse`로 기본값을 준다.
{{< /callout >}}

```java
// 타입별 칼로리 합
menu.stream().collect(groupingBy(
    Dish::getType,
    summingInt(Dish::getCalories)));
// {MEAT=1900, FISH=750, OTHER=1550}

// 타입별로 나오는 칼로리 등급
menu.stream().collect(groupingBy(
    Dish::getType,
    mapping(level,
        toCollection(TreeSet::new))));
// {MEAT=[DIET, NORMAL, FAT],
//  FISH=[DIET, NORMAL],
//  OTHER=[DIET, NORMAL]}
```

두 번째 예제는 `mapping`으로 요리를 등급으로 바꾼 뒤 집합에 모아 타입마다 어떤 등급이 나오는지 본다. `toSet()`은 어떤 `Set`인지 약속하지 않으므로, 등급을 선언 순서로 보고 싶어 `toCollection(TreeSet::new)`로 정렬되는 집합을 골랐다.

### 4.5 결과 맵 고르기

```java
Map<Dish.Type, List<Dish>> ordered =
    menu.stream().collect(groupingBy(
        Dish::getType,
        () -> new EnumMap<>(
            Dish.Type.class),
        toList()));
// 키가 항상 MEAT, FISH, OTHER 순서
```

| 형태 | 결과 맵 | 그룹의 값 | 왜 |
|:-----|:-------|:---------|:---|
| `groupingBy(f)` | `HashMap` | `List<T>` | 가장 흔한 경우를 짧게 쓴다 |
| `groupingBy(f, 다운스트림)` | `HashMap` | 다운스트림의 결과 | 그룹을 다시 접거나 나눈다 |
| `groupingBy(f, 맵 생성자, 다운스트림)` | 지정한 맵 | 다운스트림의 결과 | 키의 순서나 정렬이 필요할 때 |
| `groupingByConcurrent(...)` | `ConcurrentHashMap` | 다운스트림의 결과 | 병렬 스트림에서 맵 하나에 동시에 넣는다(6.4절) |

키가 `enum`이면 `EnumMap`이 선언 순서를 지키면서 배열 하나로 구현되어 가볍고, 키를 정렬해야 하면 `TreeMap::new`를 준다.

---

## 5. 분할

### 5.1 partitioningBy

```java
Map<Boolean, List<Dish>> byVeg = menu
    .stream()
    .collect(partitioningBy(
        Dish::isVegetarian));
// {false=[pork, beef, chicken,
//         prawns, salmon],
//  true=[french fries, rice,
//        season fruit, pizza]}

List<Dish> veg = byVeg.get(true);
```

분할은 분류 함수가 **프레디케이트**인 특수한 그룹화다. 이 프레디케이트를 분할 함수라 부르고, 키가 `Boolean`이라 그룹은 참과 거짓 둘뿐이다. `filter(Dish::isVegetarian)`로도 채식 요리를 얻을 수 있지만 그러면 채식이 아닌 쪽은 버려진다. 분할은 한 번의 순회로 **양쪽을 모두** 남긴다.

```java
Stream.of(1, 3, 5).collect(
    partitioningBy(n -> n % 2 == 0));
// {false=[1, 3, 5], true=[]}

Stream.of(1, 3, 5).collect(
    groupingBy(n -> n % 2 == 0));
// {false=[1, 3, 5]}
```

같은 프레디케이트로 그룹화와 분할을 해 보면 차이가 보인다. `groupingBy`는 요소가 도착한 키만 만들므로 짝수가 없으면 `true` 키도 없다. `partitioningBy`는 키가 둘뿐임을 미리 알기에 처음부터 `true`와 `false` 칸을 둘 다 만들어 둔다. 그래서 분할 결과의 `get(true)`, `get(false)`는 `null`을 돌려주지 않는다.

### 5.2 다운스트림과 함께 쓰기

```java
menu.stream().collect(partitioningBy(
    Dish::isVegetarian,
    groupingBy(Dish::getType)));
// {false={MEAT=[pork, beef, chicken],
//         FISH=[prawns, salmon]},
//  true={OTHER=[french fries, rice,
//               season fruit, pizza]}}

menu.stream().collect(partitioningBy(
    Dish::isVegetarian,
    collectingAndThen(
        maxBy(byCalories),
        Optional::get)));
// {false=pork, true=pizza}

menu.stream().collect(partitioningBy(
    Dish::isVegetarian, counting()));
// {false=5, true=4}
```

`partitioningBy`도 두 번째 인수로 다운스트림 컬렉터를 받는다. 분할한 뒤 각 쪽을 다시 타입별로 묶거나, 각 쪽의 최댓값을 찾거나, 개수를 센다. 두 번째 예제의 `Optional::get`은 이 메뉴에서 채식과 비채식이 모두 있으니 안전할 뿐이다. 4.4절의 경고처럼 한쪽이 빌 수 있는 데이터라면 예외가 난다.

### 5.3 소수와 비소수로 분할

```java
boolean isPrime(int n) {
    int root = (int) Math.sqrt(n);
    return IntStream
        .rangeClosed(2, root)
        .noneMatch(i -> n % i == 0);
}

Map<Boolean, List<Integer>>
        partitionPrimes(int n) {
    return IntStream.rangeClosed(2, n)
        .boxed()
        .collect(partitioningBy(
            this::isPrime));
}
// partitionPrimes(20)
// {false=[4, 6, 8, 9, 10, 12, 14,
//         15, 16, 18, 20],
//  true=[2, 3, 5, 7, 11, 13, 17, 19]}
```

2부터 n까지의 수를 소수와 소수가 아닌 수로 나눈다. `isPrime`은 2부터 제곱근까지의 수 중 하나라도 나누어떨어지는지 본다. n이 두 수의 곱 a × b라면 둘 중 하나는 반드시 제곱근 이하이므로, 제곱근까지만 나눠 보면 충분하다. 이 판정에는 개선할 여지가 더 있다. 7절에서 커스텀 컬렉터로 다시 만든다.

---

## 6. Collector 인터페이스

### 6.1 세 형식 매개변수

```java
public interface Collector<T, A, R> {
    Supplier<A> supplier();
    BiConsumer<A, T> accumulator();
    BinaryOperator<A> combiner();
    Function<A, R> finisher();
    Set<Characteristics>
        characteristics();
}
```

| 형식 | 뜻 | `toList()`에서 | 왜 따로 두나 |
|:-----|:---|:--------------|:-----------|
| `T` | 스트림 요소의 타입 | `Dish` | 수집할 대상이다 |
| `A` | 누적자, 즉 모으는 동안 쓰는 중간 컨테이너의 타입 | `List<Dish>` | 모으기 편한 모양과 돌려줄 모양이 다를 수 있다. `joining`은 `StringBuilder`로 모으고 `averagingInt`는 합과 개수를 담은 배열로 모은다 |
| `R` | 최종 결과의 타입 | `List<Dish>` | 호출하는 쪽이 받는 타입이다. `joining`은 `String`, `averagingInt`는 `Double` |

### 6.2 네 함수

```java
// 1. 빈 누적자를 만드는 함수
public Supplier<List<T>> supplier() {
    return ArrayList::new;
}

// 2. 누적자에 요소 하나를 넣는 함수
public BiConsumer<List<T>, T>
        accumulator() {
    return List::add;
}

// 3. 두 누적자를 합치는 함수
public BinaryOperator<List<T>>
        combiner() {
    return (l1, l2) -> {
        l1.addAll(l2);
        return l1;
    };
}

// 4. 누적자를 결과로 바꾸는 함수
public Function<List<T>, List<T>>
        finisher() {
    return Function.identity();
}
```

| 메서드 | 돌려주는 함수 | 하는 일 | 왜 |
|:-------|:------------|:--------|:---|
| `supplier()` | `Supplier<A>` | 빈 누적자를 만든다 | 병렬이면 조각마다 하나씩 새로 필요하다 |
| `accumulator()` | `BiConsumer<A, T>` | 누적자에 요소를 넣는다. 반환값이 없다 | 새 값을 만드는 것이 아니라 누적자의 상태를 바꾸는 연산이다 |
| `combiner()` | `BinaryOperator<A>` | 두 누적자를 하나로 합친다 | 조각별로 모은 결과를 합칠 때 쓴다 |
| `finisher()` | `Function<A, R>` | 누적자를 최종 결과로 바꾼다 | 모으기 편한 모양에서 돌려줄 모양으로 옮긴다 |

네 메서드는 일을 직접 하지 않고 **일을 할 함수를 돌려준다.** 컬렉터는 수집 방법을 담은 값일 뿐이고, 그 함수를 언제 몇 번 부를지는 `collect`가 순차인지 병렬인지 보고 정하기 때문이다.

### 6.3 collect가 네 함수를 부르는 방식

```
순차 스트림
  supplier()     빈 리스트 하나
  accumulator()  요소마다 한 번
  finisher()     IDENTITY_FINISH면 생략
  combiner()     부르지 않는다
```

```
         [원본 스트림]
               │ 분할
        ┌──────┴──────┐
        ▼             ▼
     [조각 1]      [조각 2]
   supplier()    supplier()
   accumulator   accumulator
        │             │
        └──────┬──────┘
               ▼
          combiner()
               │
               ▼
          finisher()
               │
               ▼
            결과 R
```

순차 스트림에서는 누적자가 하나뿐이다. `supplier`로 하나 만들고 모든 요소를 `accumulator`로 넣은 뒤 `finisher`를 적용한다. 합칠 상대가 없으니 `combiner`는 불리지 않는다. 병렬 스트림에서는 소스가 조각으로 나뉘고, **조각마다** `supplier`로 새 누적자를 만들어 각자 채운 뒤 `combiner`로 둘씩 합쳐 올라간다. 2.5절에서 말한 "공유하는 가변 객체가 없다"가 바로 이 구조다.

`finisher`도 항상 불리는 것은 아니다. 컬렉터가 다음 절의 `IDENTITY_FINISH` 특성을 가지면 `collect`는 `finisher`를 아예 부르지 않고 누적자를 그대로 결과로 쓴다.

### 6.4 characteristics

| 특성 | 뜻 | 가진 컬렉터 | 왜 |
|:-----|:---|:----------|:---|
| `IDENTITY_FINISH` | `finisher`가 항등 함수다. 누적자를 그대로 결과로 쓴다 | `toList`, `toSet`, `toMap`, `groupingBy(f)` | 변환 호출을 건너뛰고 누적자를 결과 타입으로 바로 형변환한다 |
| `UNORDERED` | 결과가 요소의 순서에 영향을 받지 않는다 | `toSet`, `groupingByConcurrent`, `toConcurrentMap` | 순서를 지킬 필요가 없다고 알려 병렬 수집의 제약을 푼다 |
| `CONCURRENT` | 여러 스레드가 **하나의** 누적자에 동시에 `accumulator`를 불러도 된다 | `groupingByConcurrent`, `toConcurrentMap` | 조각별 누적자와 병합을 없애고 공유 컨테이너 하나에 바로 넣을 수 있다 |

`CONCURRENT`는 "병렬로 수집할 수 있다"는 뜻이 아니다. 특성이 없는 컬렉터도 6.3절처럼 조각별 누적자와 `combiner`로 얼마든지 병렬 수집된다. `CONCURRENT`는 그와 다른 방식, 즉 누적자 **하나**를 모든 스레드가 함께 채우는 **동시 수집**을 허락하는 표시다. `collect`가 동시 수집을 고르는 것은 다음 조건이 모두 맞을 때다.

```
동시 수집의 조건 (모두 참)
  1. 병렬 스트림이다
  2. 컬렉터가 CONCURRENT다
  3. 스트림에 순서가 없거나
     컬렉터가 UNORDERED다
하나라도 거짓 → 조각별 누적 + combiner
```

셋째 조건이 붙는 이유는 순서 때문이다. 여러 스레드가 한 리스트에 동시에 넣으면 들어간 순서는 스레드 실행 순서일 뿐이다. 스트림에 정해진 순서가 있고 컬렉터도 순서를 지켜야 한다면 동시 수집은 그 약속을 깨므로 쓸 수 없다. 이 특성들이 병렬에서 어떤 차이를 내는지는 [Chapter 07](../06-parallel-data-processing)에서 이어서 본다.

### 6.5 ToListCollector 구현

```java
public class ToListCollector<T>
    implements Collector<T, List<T>,
                         List<T>> {

    @Override
    public Supplier<List<T>>
            supplier() {
        return ArrayList::new;
    }

    @Override
    public BiConsumer<List<T>, T>
            accumulator() {
        return List::add;
    }

    @Override
    public BinaryOperator<List<T>>
            combiner() {
        return (l1, l2) -> {
            l1.addAll(l2);
            return l1;
        };
    }

    @Override
    public Function<List<T>, List<T>>
            finisher() {
        return Function.identity();
    }

    @Override
    public Set<Characteristics>
            characteristics() {
        return Set.of(IDENTITY_FINISH);
    }
}

List<Dish> dishes = menu.stream()
    .collect(new ToListCollector<>());
```

6.2절의 네 함수에 특성 집합을 더하면 `toList()`와 같은 일을 하는 컬렉터가 된다. 특성 집합은 명세상 변경할 수 없는 집합이어야 해서 `Set.of`로 만들었다. `IDENTITY_FINISH`는 `Collector.Characteristics`의 상수를 `import static`으로 들여온 것이다.

{{< callout type="warning" >}}
책의 `ToListCollector`는 `IDENTITY_FINISH`에 `CONCURRENT`까지 붙인다. 그런데 `ArrayList::add`는 여러 스레드가 동시에 부르면 깨지므로 이것은 지킬 수 없는 약속이다. 리스트처럼 순서 있는 소스에서는 6.4절의 셋째 조건이 맞지 않아 드러나지 않지만, `HashSet`처럼 순서 없는 소스를 병렬로 모으면 리스트 하나에 동시에 `add`가 일어나 `ArrayIndexOutOfBoundsException`이 나거나 요소가 사라진다. `CONCURRENT`는 누적자가 정말 동시 접근을 견딜 때(`ConcurrentHashMap` 등)만 붙인다.
{{< /callout >}}

### 6.6 클래스 없이 만들기

```java
// 세 인수 collect
List<Dish> a = menu.stream().collect(
    ArrayList::new,
    List::add,
    List::addAll);
```

```java
// Collector.of: 누적자와 결과가 다르다
Collector<Dish, int[], Double> avgCal =
    Collector.of(
        () -> new int[2],
        (acc, d) -> {
            acc[0] += d.getCalories();
            acc[1]++;
        },
        (x, y) -> {
            x[0] += y[0];
            x[1] += y[1];
            return x;
        },
        acc -> acc[1] == 0 ? 0.0
            : (double) acc[0] / acc[1]);

menu.stream().collect(avgCal);
// 466.666...
```

한 번 쓰고 말 수집이라면 클래스를 만들 필요가 없다. `collect`의 세 인수 판은 `supplier`, `accumulator`, `combiner`만 받고 누적자를 그대로 결과로 돌려준다. `finisher`와 특성이 필요하면 `Collector.of`에 네 함수와 특성을 넘긴다. 위의 `avgCal`은 합과 개수를 `int[2]`에 모았다가 마지막에 나눗셈으로 `Double`을 만드는데, 6.1절에서 말한 "누적자 `A`와 결과 `R`이 다른" 경우이고 `averagingInt`가 하는 일의 축소판이다.

| 방법 | `finisher`와 특성 | 재사용 | 왜 |
|:-----|:----------------|:------|:---|
| `Collector` 구현 클래스 | 지정 가능 | 이름 있는 타입으로 여러 곳에서 쓴다 | 상태가 복잡하거나 도우미 메서드가 필요할 때 |
| `Collector.of(...)` | 지정 가능 | 변수나 정적 메서드에 담아 쓴다 | 함수 몇 개로 충분할 때 클래스 정의를 아낀다 |
| 세 인수 `collect(...)` | 없음. 누적자가 곧 결과 | 그 자리 한 번 | 가장 짧지만 다른 컬렉터 안에 넣을 수 없다 |

---

## 7. 커스텀 컬렉터로 성능 개선하기

### 7.1 이미 찾은 소수로만 나누기

5.3절의 `isPrime`은 2부터 제곱근까지 **모든 정수**로 나눠 본다. 그런데 4나 6으로 나누어떨어지는 수는 이미 2로 나누어떨어진다. 합성수는 반드시 제곱근 이하의 **소수** 약수를 가지므로, 지금까지 찾은 소수로만 나눠 보면 충분하다.

```java
boolean isPrime(List<Integer> primes,
                int n) {
    int root = (int) Math.sqrt(n);
    return primes.stream()
        .takeWhile(p -> p <= root)
        .noneMatch(p -> n % p == 0);
}
```

소수 목록은 작은 것부터 쌓이므로 정렬되어 있다. 그래서 `filter` 대신 5장의 `takeWhile`로 제곱근을 넘는 첫 소수에서 바로 멈춘다. 문제는 `partitioningBy`에 넘기는 프레디케이트가 **지금까지 찾은 소수 목록**을 볼 방법이 없다는 것이다. 그 목록은 수집 도중의 누적자 안에 있다. 누적자에 손을 대려면 컬렉터를 직접 만들어야 한다.

### 7.2 PrimeNumbersCollector 구현

```java
public class PrimeNumbersCollector
    implements Collector<Integer,
        Map<Boolean, List<Integer>>,
        Map<Boolean, List<Integer>>> {
    // 아래 다섯 메서드
}
```

```java
public Supplier<Map<Boolean,
        List<Integer>>> supplier() {
    return () -> {
        Map<Boolean, List<Integer>> m =
            new HashMap<>();
        m.put(true, new ArrayList<>());
        m.put(false, new ArrayList<>());
        return m;
    };
}

public BiConsumer<Map<Boolean,
        List<Integer>>, Integer>
        accumulator() {
    return (acc, n) -> {
        boolean prime =
            isPrime(acc.get(true), n);
        acc.get(prime).add(n);
    };
}
```

누적자는 `partitioningBy`의 결과와 같은 모양, 즉 `true`와 `false` 키에 빈 리스트를 하나씩 담은 맵이다. `accumulator`가 핵심이다. 지금까지 모은 소수 리스트 `acc.get(true)`를 `isPrime`에 넘겨 판정하고, 결과에 따라 해당 쪽 리스트에 넣는다. 누적 중인 결과를 다음 요소의 판정에 쓰는 것, 이것이 미리 정의된 컬렉터로는 할 수 없던 일이다.

```java
public BinaryOperator<Map<Boolean,
        List<Integer>>> combiner() {
    return (m1, m2) -> {
        throw new
        UnsupportedOperationException(
            "순차 스트림 전용");
    };
}

public Function<Map<Boolean,
        List<Integer>>,
        Map<Boolean, List<Integer>>>
        finisher() {
    return Function.identity();
}

public Set<Characteristics>
        characteristics() {
    return Set.of(IDENTITY_FINISH);
}
```

```java
var collector =
    new PrimeNumbersCollector();
Map<Boolean, List<Integer>> primes =
    IntStream.rangeClosed(2, 20)
        .boxed().collect(collector);
// {false=[4, 6, 8, 9, 10, 12, 14,
//         15, 16, 18, 20],
//  true=[2, 3, 5, 7, 11, 13, 17, 19]}
```

누적자가 곧 결과이므로 `finisher`는 항등 함수이고 특성은 `IDENTITY_FINISH`다. 결과는 5.3절과 같다. 남은 것은 `combiner`가 왜 예외를 던지는가다.

### 7.3 왜 combiner를 막았나

```
순차: 2, 3, 4, 5, ... 차례로
  primes = [2, 3, 5, 7, ...]
  다음 수는 앞서 찾은 소수로 판정

병렬: [2 .. 49]  |  [50 .. 100]
  둘째 조각의 primes = []
  → 50, 51, 52 ... 전부 "소수"
```

이 컬렉터의 `accumulator`는 **앞서 누적한 결과에 기대어** 다음 요소를 판정한다. 병렬 스트림은 조각마다 `supplier`로 빈 누적자를 만들어 독립적으로 출발하는데, 50부터 시작하는 조각의 누적자에는 소수가 하나도 없다. 나눠 볼 소수가 없으니 `noneMatch`는 늘 참이 되고 그 조각의 모든 수가 소수로 분류된다. `combiner`에서 리스트를 이어 붙여도 이미 틀린 판정은 되돌릴 수 없다.

책은 학습용으로 두 맵의 리스트를 이어 붙이는 `combiner`를 보여 주고, 실제로는 불릴 일이 없으니 비워 두거나 `UnsupportedOperationException`을 던져도 된다고 덧붙인다. 여기서는 예외 쪽을 골랐다. 이어 붙이는 `combiner`는 누군가 이 컬렉터를 병렬 스트림에 쓰는 순간 불려서 예외 없이 **틀린 답**을 돌려준다. 조용히 틀리는 것보다 시끄럽게 실패하는 편이 낫다. 컬렉터를 병렬로 쓸 수 있는지는 `combiner`를 구현할 수 있느냐가 아니라 **조각을 서로 독립적으로 수집할 수 있느냐**가 정한다.

### 7.4 두 방법 비교

| 방법 | 나눠 보는 수 | 병렬 | 왜 |
|:-----|:-----------|:-----|:---|
| `partitioningBy(this::isPrime)` | 2부터 제곱근까지의 모든 정수 | 가능 | 수마다 판정이 독립적이어서 조각을 어떻게 나눠도 된다 |
| `PrimeNumbersCollector` | 제곱근 이하의 이미 찾은 소수 | 불가 | 판정이 앞선 누적 결과에 기대므로 순서대로 처리해야 한다 |

순차로 비교하면 커스텀 컬렉터가 나눗셈 횟수를 크게 줄여 일반적으로 더 빠르다. 대신 병렬화의 가능성을 내주었다. 어느 쪽이 나은지는 데이터의 크기와 코어 수, 그리고 측정이 정한다. 성능을 제대로 재는 방법은 다음 장의 주제다.

---

## 핵심 정리

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 컬렉터 | 어떻게 모을지를 담은 값 | 반복은 `collect`가 하고 수집 방법은 값이라 서로 끼워 맞출 수 있다 |
| `collect` | 가변 컨테이너에 누적하는 리듀싱 | 조각마다 새 컨테이너를 만들어 병렬에서도 안전하다 |
| `reduce`와의 구분 | 불변 값은 `reduce`, 컨테이너는 `collect` | `reduce`의 항등값은 모든 조각이 함께 쓴다 |
| 요약 컬렉터 | `counting`, `summingInt`, `averagingInt`, `summarizingInt`, `maxBy` | 자주 쓰는 `reducing`에 이름을 붙였다 |
| 빈 스트림의 평균 | `averagingInt`는 `0.0` | "평균 0"과 "데이터 없음"이 같은 값이 된다 |
| `joining` | 문자열 스트림에만 | 타입이 `Collector<CharSequence, ?, String>`이다 |
| `teeing` | 두 컬렉터를 한 번의 순회로 | 요소를 두 갈래로 흘려 결과를 합친다 |
| 리스트로 모으기 | 기본은 `Stream.toList()` | 불변이라 돌려주기에 안전하다 |
| `toMap` | 키 중복과 `null` 값에서 예외 | 남길 값은 도메인이 정하고, `merge`는 `null`을 받지 않는다 |
| `groupingBy` | 분류 함수 + 다운스트림 + 맵 생성자 | 그룹 하나를 무엇으로 모을지를 컬렉터로 정한다 |
| `filtering` | 빈 그룹의 키를 남긴다 | `filter`는 분류 전에 요소를 없애 키가 생기지 않는다 |
| 다수준 그룹화 | `groupingBy` 안에 `groupingBy` | 다운스트림 자리에 어떤 컬렉터든 들어간다 |
| `collectingAndThen` | 다운스트림 결과를 한 번 더 변환 | `groupingBy` 그룹은 비지 않아 `Optional::get`이 안전하다 |
| `partitioningBy` | 키 둘이 항상 있다 | 키가 둘뿐임을 알아 미리 만든다 |
| `Collector<T, A, R>` | 요소, 누적자, 결과 | 모으기 편한 모양과 돌려줄 모양이 다를 수 있다 |
| 네 함수 | `supplier`, `accumulator`, `combiner`, `finisher` | 언제 몇 번 부를지는 `collect`가 정한다 |
| `IDENTITY_FINISH` | `finisher`를 건너뛴다 | 누적자가 곧 결과다 |
| `CONCURRENT` | 공유 누적자 하나에 동시 수집 | 병렬이고 순서가 없을 때만 쓰인다. 누적자가 동시 접근을 견뎌야 한다 |
| 커스텀 컬렉터 | 누적 중인 결과를 판정에 쓴다 | 미리 정의된 컬렉터는 누적자를 보여 주지 않는다 |
| 병렬 가능성 | 조각을 독립적으로 수집할 수 있어야 한다 | 앞선 결과에 기대는 누적은 조각으로 나눌 수 없다 |

{{< callout type="info" >}}
**용어 정리**
- **컬렉터(`Collector`)**: `collect`에 넘기는 수집 방법. 누적자를 만들고, 채우고, 합치고, 결과로 바꾸는 함수들의 묶음
- **`Collectors`**: 자주 쓰는 컬렉터를 만들어 주는 정적 팩토리 메서드 모음
- **누적자(accumulator object)**: 수집하는 동안 요소를 담아 두는 중간 컨테이너. `Collector<T, A, R>`의 `A`
- **리듀싱**: 스트림의 모든 요소를 결과 하나로 합치는 연산. `reduce`와 `collect`가 모두 여기에 속한다
- **요약(summarization)**: 합계, 평균, 최댓값처럼 숫자 필드를 값 하나로 줄이는 리듀싱
- **분류 함수(classification function)**: `groupingBy`에서 요소마다 그룹의 키를 계산하는 함수
- **분할 함수(partitioning function)**: `partitioningBy`에서 분류 함수로 쓰는 프레디케이트
- **다운스트림 컬렉터**: `groupingBy`, `partitioningBy`, `mapping` 등의 안쪽에 넣어 그룹 하나를 다시 수집하는 컬렉터
- **다수준 그룹화**: 다운스트림에 `groupingBy`를 겹쳐 맵 안에 맵을 만드는 그룹화
- **병합 함수**: `toMap`에서 키가 겹칠 때 두 값을 하나로 합치는 함수
- **`Characteristics`**: 컬렉터가 `collect`에 주는 최적화 힌트. `IDENTITY_FINISH`, `UNORDERED`, `CONCURRENT`
- **동시 수집**: 여러 스레드가 누적자 하나를 함께 채우는 병렬 수집. `CONCURRENT` 컬렉터에서만 일어난다
{{< /callout >}}
