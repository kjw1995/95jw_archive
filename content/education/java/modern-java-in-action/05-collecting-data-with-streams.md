---
title: "Chapter 06. 스트림으로 데이터 수집"
weight: 6
---

## 1. 컬렉터란 무엇인가?

`Collector` 인터페이스 구현체는 스트림의 요소를 **어떤 식으로 도출할지** 결정한다. `Stream.collect(Collector)` 호출 시 스트림의 모든 요소에 컬렉터로 정의된 리듀싱 연산이 수행되어 하나의 결과로 합쳐진다.

명령형 코드와 함수형 코드의 차이를 트랜잭션을 통화별로 그룹화하는 예제로 비교해보자.

```java
// 명령형: 무엇을 어떻게 할지를 모두 직접 작성
Map<Currency, List<Transaction>> transactionsByCurrencies = new HashMap<>();
for (Transaction transaction : transactions) {
    Currency currency = transaction.getCurrency();
    List<Transaction> transactionsForCurrency =
        transactionsByCurrencies.get(currency);
    if (transactionsForCurrency == null) {
        transactionsForCurrency = new ArrayList<>();
        transactionsByCurrencies.put(currency, transactionsForCurrency);
    }
    transactionsForCurrency.add(transaction);
}
```

```java
// 함수형: '무엇'만 선언하면 '어떻게'는 라이브러리가 처리
Map<Currency, List<Transaction>> transactionsByCurrencies =
    transactions.stream()
        .collect(groupingBy(Transaction::getCurrency));
```

### 1.1 고급 리듀싱 기능을 수행하는 컬렉터

`collect`로 결과를 수집하는 과정을 **간단하면서도 유연한 방식**으로 정의할 수 있다는 점이 컬렉터의 최대 강점이다. 컬렉터는 함수를 인수로 받아 스트림의 각 요소를 방문하며 누적기에 작업을 적용한다.

### 1.2 미리 정의된 컬렉터

`Collectors`에서 제공하는 메서드는 크게 세 가지로 구분된다.

| 분류 | 대표 메서드 | 용도 |
|:-----|:-----------|:-----|
| **요약(Summarize)** | `counting`, `summingInt`, `averagingInt`, `maxBy`, `minBy` | 하나의 값으로 리듀스 |
| **그룹화(Group)** | `groupingBy` | 키별로 묶음 |
| **분할(Partition)** | `partitioningBy` | 프레디케이트 기준 두 그룹으로 |

---

## 2. 리듀싱과 요약

### 2.1 스트림값에서 최댓값과 최솟값 검색

`Collectors.maxBy`, `Collectors.minBy`는 `Comparator`를 인수로 받아 최댓값/최솟값을 계산한다.

```java
Comparator<Dish> dishCaloriesComparator =
    Comparator.comparingInt(Dish::getCalories);

Optional<Dish> mostCaloricDish = menu.stream()
    .collect(maxBy(dishCaloriesComparator));
```

> 스트림이 비어있는 경우를 위해 결과는 `Optional<Dish>`로 감싸진다.

### 2.2 요약 연산

`summingInt`는 객체를 `int`로 매핑하는 함수를 인수로 받는다. `summingLong`, `summingDouble`도 같은 방식으로 동작한다.

```java
// 모든 요리의 칼로리 총합
int totalCalories = menu.stream()
    .collect(summingInt(Dish::getCalories));

// 평균
double avgCalories = menu.stream()
    .collect(averagingInt(Dish::getCalories));
```

**`summarizingInt` — 한 번에 여러 통계 추출:**

```java
IntSummaryStatistics menuStatistics = menu.stream()
    .collect(summarizingInt(Dish::getCalories));

// IntSummaryStatistics{count=9, sum=4300, min=120,
//                     average=477.78, max=800}
menuStatistics.getCount();
menuStatistics.getSum();
menuStatistics.getMin();
menuStatistics.getMax();
menuStatistics.getAverage();
```

| 메서드 | 반환 타입 |
|:-------|:---------|
| `summarizingInt` | `IntSummaryStatistics` |
| `summarizingLong` | `LongSummaryStatistics` |
| `summarizingDouble` | `DoubleSummaryStatistics` |

### 2.3 문자열 연결

`joining` 팩토리 메서드는 각 객체에 `toString`을 호출해 추출한 모든 문자열을 하나로 연결한다. 내부적으로 `StringBuilder`를 사용한다.

```java
// 단순 연결
String shortMenu = menu.stream()
    .map(Dish::getName)
    .collect(joining());
// "porkbeefchickenfrench friesriceseason fruitpizzaprawnssalmon"

// 구분자 추가
String shortMenu = menu.stream()
    .map(Dish::getName)
    .collect(joining(", "));
// "pork, beef, chicken, ..."

// prefix/suffix 추가
String shortMenu = menu.stream()
    .map(Dish::getName)
    .collect(joining(", ", "[", "]"));
// "[pork, beef, chicken, ...]"
```

{{< callout type="info" >}}
`Dish` 클래스에 `toString`이 정의되어 있지 않다면 `joining()`은 객체 해시 형태의 의미 없는 문자열을 만들어낸다. 그래서 일반적으로 `map(Dish::getName)`처럼 문자열로 매핑한 뒤 `joining`을 호출한다.
{{< /callout >}}

### 2.4 범용 리듀싱 요약 연산

지금까지 살펴본 모든 컬렉터는 사실 `Collectors.reducing` 팩토리 메서드의 특수 케이스다.

```java
// 1. 초깃값 + 변환 함수 + 결합 함수
int totalCalories = menu.stream()
    .collect(reducing(0, Dish::getCalories, Integer::sum));

// 2. 변환 함수 + 결합 함수 (초깃값 없음 → Optional 반환)
Optional<Dish> mostCalorieDish = menu.stream()
    .collect(reducing(
        (d1, d2) -> d1.getCalories() > d2.getCalories() ? d1 : d2));
```

**`collect`와 `reduce`의 차이:**

| 구분 | `collect` | `reduce` |
|:-----|:---------|:--------|
| 의미 | **누적자(컨테이너)를 변경** | 두 값을 합쳐 **새 값** 도출 |
| 가변성 | 가변 컨테이너 | 불변 |
| 병렬 처리 | 안전 (각 스레드가 자신의 컨테이너) | 가변 컨테이너에 사용 시 위험 |

{{< callout type="warning" >}}
`reduce`로 `List`를 누적하는 것은 의미적으로 잘못되었다. 여러 스레드가 같은 리스트를 동시에 수정하면 리스트 자체가 망가져 병렬 리듀싱을 수행할 수 없다. **누적 결과를 만드는 작업은 `collect`로**, **두 값을 하나로 합치는 작업은 `reduce`로** 사용한다.
{{< /callout >}}

```java
// 잘못된 사용 — 가변 컨테이너를 reduce로 누적
Stream<Integer> stream = Arrays.asList(1, 2, 3, 4).stream();
List<Integer> numbers = stream.reduce(
    new ArrayList<>(),
    (List<Integer> l, Integer e) -> { l.add(e); return l; },
    (List<Integer> l1, List<Integer> l2) -> { l1.addAll(l2); return l1; }
);
// 동작은 하지만 의미적·성능적으로 잘못됨

// 올바른 사용
List<Integer> numbers = stream.collect(toList());
```

### 2.5 자신의 상황에 맞는 최선의 해법 선택

`counting`을 통한 메뉴 개수 계산은 다양한 방식으로 표현할 수 있다.

```java
// 1. counting 컬렉터
long howManyDishes = menu.stream().collect(counting());

// 2. count 메서드 (가장 간결)
long howManyDishes = menu.stream().count();

// 3. reducing 직접 사용
long howManyDishes = menu.stream()
    .collect(reducing(0L, e -> 1L, Long::sum));
```

> **함수형 프로그래밍의 장점:** 같은 결과를 다양한 방식으로 표현할 수 있지만, 가독성과 의도가 가장 잘 드러나는 방식을 선택해야 한다.

---

## 3. 그룹화

`Collectors.groupingBy`는 스트림 요소를 분류 함수<sup>classification function</sup>의 결과 키별로 묶는다.

```java
Map<Dish.Type, List<Dish>> dishesByType = menu.stream()
    .collect(groupingBy(Dish::getType));

// {FISH=[prawns, salmon],
//  OTHER=[french fries, rice, season fruit, pizza],
//  MEAT=[pork, beef, chicken]}
```

복잡한 분류는 람다로 직접 정의할 수 있다.

```java
public enum CaloricLevel { DIET, NORMAL, FAT }

Map<CaloricLevel, List<Dish>> dishesByCaloricLevel = menu.stream()
    .collect(groupingBy(dish -> {
        if (dish.getCalories() <= 400) return CaloricLevel.DIET;
        else if (dish.getCalories() <= 700) return CaloricLevel.NORMAL;
        else return CaloricLevel.FAT;
    }));
```

### 3.1 그룹화된 요소 조작

500칼로리가 넘는 요리만 그룹화하려고 할 때, 단순히 `filter`를 먼저 쓰면 **빈 그룹의 키가 사라진다**.

```java
// 문제: filter 후 groupingBy
Map<Dish.Type, List<Dish>> caloricDishesByType = menu.stream()
    .filter(dish -> dish.getCalories() > 500)
    .collect(groupingBy(Dish::getType));

// 결과: {OTHER=[french fries, pizza], MEAT=[pork, beef]}
// → FISH 키가 사라짐 (조건 만족 요리 없음)
```

**`filtering` 컬렉터를 그룹화 안쪽에서 사용**하면 빈 키도 유지된다.

```java
Map<Dish.Type, List<Dish>> caloricDishesByType = menu.stream()
    .collect(groupingBy(
        Dish::getType,
        filtering(dish -> dish.getCalories() > 500, toList())
    ));

// 결과: {OTHER=[french fries, pizza], MEAT=[pork, beef], FISH=[]}
```

**동작 흐름 비교:**

```
filter → groupingBy
    스트림 ─[필터]─→ ─[분류]─→ Map
    (FISH 요소 자체가 사라짐)

groupingBy(filtering)
    스트림 ─[분류]─→ 그룹마다 ─[필터]─→ Map
    (모든 키 유지)
```

`mapping` 컬렉터는 각 그룹 요소를 변환한 뒤 수집한다.

```java
Map<Dish.Type, List<String>> dishNamesByType = menu.stream()
    .collect(groupingBy(
        Dish::getType,
        mapping(Dish::getName, toList())
    ));

// {FISH=[prawns, salmon], MEAT=[pork, beef, chicken], ...}
```

`flatMapping`은 각 요소를 스트림으로 매핑한 뒤 평면화하여 수집한다.

```java
Map<String, List<String>> dishTags = new HashMap<>();
dishTags.put("pork", asList("greasy", "salty"));
dishTags.put("beef", asList("salty", "roasted"));
// ...

Map<Dish.Type, Set<String>> dishNamesByType = menu.stream()
    .collect(groupingBy(
        Dish::getType,
        flatMapping(dish -> dishTags.get(dish.getName()).stream(),
                    toSet())
    ));
// {MEAT=[salty, greasy, roasted, fried, crisp],
//  FISH=[roasted, fresh, delicious], ...}
```

### 3.2 다수준 그룹화

`groupingBy`의 두 번째 인자로 또 다른 `groupingBy`를 전달하면 다수준 그룹화가 된다.

```java
Map<Dish.Type, Map<CaloricLevel, List<Dish>>> dishesByTypeCaloricLevel =
    menu.stream().collect(
        groupingBy(Dish::getType,
            groupingBy(dish -> {
                if (dish.getCalories() <= 400) return CaloricLevel.DIET;
                else if (dish.getCalories() <= 700) return CaloricLevel.NORMAL;
                else return CaloricLevel.FAT;
            })
        )
    );

// {MEAT={DIET=[chicken], NORMAL=[beef], FAT=[pork]},
//  FISH={DIET=[prawns], NORMAL=[salmon]},
//  OTHER={DIET=[rice, seasonal fruit], NORMAL=[french fries, pizza]}}
```

**중첩 구조 시각화:**

```
┌─ MEAT ─┐
│  ├─ DIET   → [chicken]
│  ├─ NORMAL → [beef]
│  └─ FAT    → [pork]
├─ FISH ─┐
│  ├─ DIET   → [prawns]
│  └─ NORMAL → [salmon]
└─ OTHER ┐
   ├─ DIET   → [rice, fruit]
   └─ NORMAL → [fries, pizza]
```

### 3.3 서브그룹으로 데이터 수집

`groupingBy`의 두 번째 인자로 `Collector` 형식이면 무엇이든 전달할 수 있다.

```java
// 타입별 요리 수
Map<Dish.Type, Long> typesCount = menu.stream()
    .collect(groupingBy(Dish::getType, counting()));
// {MEAT=3, FISH=2, OTHER=4}

// 타입별 가장 칼로리 높은 요리
Map<Dish.Type, Optional<Dish>> mostCaloricByType = menu.stream()
    .collect(groupingBy(Dish::getType,
        maxBy(comparingInt(Dish::getCalories))));
// {FISH=Optional[salmon], OTHER=Optional[pizza], MEAT=Optional[pork]}
```

**`collectingAndThen` — 결과 변환:**

`Optional`을 벗기는 후처리에는 `collectingAndThen`을 사용한다.

```java
Map<Dish.Type, Dish> mostCaloricByType = menu.stream()
    .collect(groupingBy(
        Dish::getType,
        collectingAndThen(
            maxBy(comparingInt(Dish::getCalories)),
            Optional::get   // 후처리 함수
        )
    ));
// {FISH=salmon, OTHER=pizza, MEAT=pork}
```

> `groupingBy`는 키가 존재하는 그룹에서만 컬렉터를 적용하므로 `maxBy`의 `Optional`은 항상 값을 가진다. 따라서 `Optional::get`이 안전하다.

**중첩 컬렉터 구조 시각화:**

```
┌──────────── groupingBy ────────────┐
│  classifier: Dish::getType         │
│  ┌───── collectingAndThen ─────┐   │
│  │  ┌───── maxBy ─────────┐    │   │
│  │  │ comparator로 최댓값 │    │   │
│  │  └─────────────────────┘    │   │
│  │  finisher: Optional::get    │   │
│  └─────────────────────────────┘   │
└────────────────────────────────────┘
```

**다른 컬렉터와의 조합 예시:**

```java
// 타입별 총 칼로리
Map<Dish.Type, Integer> totalCaloriesByType = menu.stream()
    .collect(groupingBy(Dish::getType,
        summingInt(Dish::getCalories)));

// 타입별 칼로리 레벨 집합
Map<Dish.Type, Set<CaloricLevel>> caloricLevelsByType = menu.stream()
    .collect(groupingBy(Dish::getType,
        mapping(dish -> {
            if (dish.getCalories() <= 400) return CaloricLevel.DIET;
            else if (dish.getCalories() <= 700) return CaloricLevel.NORMAL;
            else return CaloricLevel.FAT;
        }, toSet())
    ));
// {OTHER=[DIET, NORMAL], MEAT=[DIET, NORMAL, FAT], FISH=[DIET, NORMAL]}
```

`toSet()` 대신 `toCollection(HashSet::new)`을 쓰면 컬렉션 구현을 직접 제어할 수 있다.

---

## 4. 분할

분할(`partitioningBy`)은 분할 함수<sup>partitioning function</sup>라 불리는 **프레디케이트**를 분류 함수로 사용하는 특수한 그룹화다. 키 형식은 항상 `Boolean`, 결과는 항상 두 그룹이다.

```java
Map<Boolean, List<Dish>> partitionedMenu = menu.stream()
    .collect(partitioningBy(Dish::isVegetarian));
// {false=[pork, beef, chicken, prawns, salmon],
//  true=[french fries, rice, season fruit, pizza]}

List<Dish> vegetarianDishes = partitionedMenu.get(true);
```

### 4.1 분할의 장점

`filter`로는 한 결과만 얻을 수 있지만, `partitioningBy`는 **참/거짓 양쪽 리스트를 모두 유지**한다.

```java
// filter 방식 — 채식 요리만 얻음
List<Dish> vegetarianDishes = menu.stream()
    .filter(Dish::isVegetarian)
    .collect(toList());

// partitioningBy 방식 — 채식/비채식 둘 다 한 번에
Map<Boolean, List<Dish>> result = menu.stream()
    .collect(partitioningBy(Dish::isVegetarian));
```

`partitioningBy`도 두 번째 컬렉터 인자를 받을 수 있다.

```java
// 채식/비채식 각각을 다시 타입별로 그룹화 (다수준 분할)
Map<Boolean, Map<Dish.Type, List<Dish>>> vegetarianDishesByType =
    menu.stream().collect(
        partitioningBy(Dish::isVegetarian, groupingBy(Dish::getType))
    );
// {false={FISH=[prawns, salmon], MEAT=[pork, beef, chicken]},
//  true={OTHER=[french fries, rice, season fruit, pizza]}}

// 채식/비채식 각각의 가장 칼로리 높은 요리
Map<Boolean, Dish> mostCaloricPartitionedByVegetarian =
    menu.stream().collect(
        partitioningBy(Dish::isVegetarian,
            collectingAndThen(
                maxBy(comparingInt(Dish::getCalories)),
                Optional::get))
    );
// {false=pork, true=pizza}
```

### 4.2 활용 예시 — 소수와 비소수 분할

```java
public boolean isPrime(int candidate) {
    int candidateRoot = (int) Math.sqrt((double) candidate);
    return IntStream.rangeClosed(2, candidateRoot)
        .noneMatch(i -> candidate % i == 0);
}

public Map<Boolean, List<Integer>> partitionPrimes(int n) {
    return IntStream.rangeClosed(2, n).boxed()
        .collect(partitioningBy(this::isPrime));
}
// partitionPrimes(10)
// → {false=[4, 6, 8, 9, 10], true=[2, 3, 5, 7]}
```

> `IntStream.rangeClosed`로 만든 소수 후보를 `partitioningBy`로 한 번에 양분한다. 명령형 코드라면 두 리스트를 따로 관리해야 했을 작업이다.

---

## 5. `Collector` 인터페이스

`Collector` 인터페이스는 리듀싱 연산을 어떻게 구현할지 명세하는 메서드 집합이다.

```java
public interface Collector<T, A, R> {
    Supplier<A> supplier();
    BiConsumer<A, T> accumulator();
    Function<A, R> finisher();
    BinaryOperator<A> combiner();
    Set<Characteristics> characteristics();
}
```

| 제네릭 | 의미 |
|:-------|:-----|
| `T` | 수집될 스트림 항목의 타입 |
| `A` | 누적자(중간 결과를 누적하는 객체) 타입 |
| `R` | 수집 연산 결과 객체 타입 |

### 5.1 컬렉터 인터페이스 메서드 살펴보기

#### supplier — 새 결과 컨테이너 만들기

수집 과정에서 사용할 **빈 누적자 인스턴스**를 만드는 함수를 반환한다.

```java
public Supplier<List<T>> supplier() {
    return ArrayList::new;
}
```

#### accumulator — 결과 컨테이너에 요소 추가하기

리듀싱 연산을 수행하는 함수를 반환한다. 누적자와 n번째 요소를 받아 누적자 상태를 변경한다(`void` 반환).

```java
public BiConsumer<List<T>, T> accumulator() {
    return List::add;
}
```

#### finisher — 최종 변환

누적자 객체를 최종 결과로 변환하는 함수를 반환한다. 누적자가 곧 결과인 경우 항등 함수를 반환하면 된다.

```java
public Function<List<T>, List<T>> finisher() {
    return Function.identity();
}
```

#### combiner — 두 결과 컨테이너 병합

병렬 처리 시 서로 다른 서브파트의 누적자를 어떻게 합칠지 정의한다.

```java
public BinaryOperator<List<T>> combiner() {
    return (list1, list2) -> {
        list1.addAll(list2);
        return list1;
    };
}
```

**병렬 리듀싱 동작 흐름:**

```
[원본 스트림]
      │
      ▼
   분할 (split)
   ┌──┴──┐
   ▼     ▼
[part1] [part2]
   │     │
   ▼     ▼
supplier()×2 → 빈 누적자 두 개
   │     │
   ▼     ▼
accumulator로 각자 누적
   │     │
   └──┬──┘
      ▼
   combiner (병합)
      │
      ▼
   finisher
      │
      ▼
   최종 결과 R
```

#### characteristics — 컬렉터 특성

`Characteristics` 열거형 집합을 반환한다. 병렬 리듀싱 가능 여부와 최적화 힌트를 제공한다.

| 특성 | 의미 |
|:-----|:-----|
| `UNORDERED` | 결과가 방문/누적 순서에 영향받지 않음 |
| `CONCURRENT` | 여러 스레드가 같은 누적자에 동시 호출 가능 |
| `IDENTITY_FINISH` | finisher가 항등 함수 — 누적자를 결과로 바로 사용 가능 |

{{< callout type="info" >}}
`CONCURRENT`만으로는 병렬 리듀싱이 보장되지 않는다. 데이터 소스가 정렬되어 있으면 순서를 보장해야 하므로, **`UNORDERED`까지 함께 설정**되어야 진짜 병렬 리듀싱이 가능하다.
{{< /callout >}}

### 5.2 커스텀 ToListCollector 구현

```java
public class ToListCollector<T> implements Collector<T, List<T>, List<T>> {

    @Override
    public Supplier<List<T>> supplier() {
        return ArrayList::new;
    }

    @Override
    public BiConsumer<List<T>, T> accumulator() {
        return List::add;
    }

    @Override
    public Function<List<T>, List<T>> finisher() {
        return Function.identity();
    }

    @Override
    public BinaryOperator<List<T>> combiner() {
        return (list1, list2) -> {
            list1.addAll(list2);
            return list1;
        };
    }

    @Override
    public Set<Characteristics> characteristics() {
        return Collections.unmodifiableSet(EnumSet.of(
            Characteristics.IDENTITY_FINISH,
            Characteristics.CONCURRENT
        ));
    }
}

// 사용
List<Dish> dishes = menu.stream().collect(new ToListCollector<>());
```

### 5.3 컬렉터를 만들지 않고 커스텀 수집

`IDENTITY_FINISH`인 단순 컬렉터는 인터페이스를 구현하지 않고 `collect`의 세 인수 오버로드로 처리할 수 있다.

```java
List<Dish> dishes = menu.stream().collect(
    ArrayList::new,   // supplier
    List::add,        // accumulator
    List::addAll      // combiner
);
```

> 더 짧지만, **재사용성이 떨어지고** `Characteristics`를 지정할 수 없다는 단점이 있다.

---

## 6. 정리

### 컬렉터 분류 요약

| 분류 | 메서드 | 반환 타입 |
|:-----|:-------|:---------|
| **요약** | `counting` | `Long` |
| | `summingInt`, `averagingInt` | `Integer`, `Double` |
| | `summarizingInt` | `IntSummaryStatistics` |
| | `maxBy`, `minBy` | `Optional<T>` |
| | `joining` | `String` |
| | `reducing` | `T` 또는 `Optional<T>` |
| **컬렉션 변환** | `toList`, `toSet` | `List<T>`, `Set<T>` |
| | `toCollection` | 지정한 컬렉션 |
| | `toMap` | `Map<K,V>` |
| **그룹화** | `groupingBy` | `Map<K, List<T>>` |
| | `groupingBy(f, downstream)` | `Map<K, R>` |
| **분할** | `partitioningBy` | `Map<Boolean, List<T>>` |
| **그룹 내 처리** | `filtering`, `mapping`, `flatMapping` | downstream에 전달 |
| **결과 후처리** | `collectingAndThen` | downstream 결과 변환 |

### Collector 인터페이스 5대 메서드

```
supplier()       → 빈 누적자 생성 (Supplier<A>)
accumulator()    → 요소 누적     (BiConsumer<A, T>)
combiner()       → 누적자 병합   (BinaryOperator<A>)
finisher()       → 최종 변환     (Function<A, R>)
characteristics()→ 특성 집합     (Set<Characteristics>)
```

{{< callout type="info" >}}
**핵심 포인트:**
- `collect`는 컬렉터 인수를 받는 **최종 연산**이다
- `collect`는 가변 컨테이너를, `reduce`는 불변 값 도출을 위해 사용한다
- 그룹화 안쪽에서 `filtering`/`mapping`/`flatMapping`을 쓰면 빈 키도 보존된다
- `partitioningBy`는 한 번의 순회로 **참/거짓 양쪽 리스트를 모두** 얻을 수 있다
- 다수준 그룹화는 `groupingBy` 두 번째 인자로 또 다른 `Collector`를 전달해 만든다
- `Optional`을 벗기는 후처리는 `collectingAndThen(컬렉터, Optional::get)`로 처리한다
- 커스텀 컬렉터는 `Collector` 인터페이스의 5개 메서드를 구현한다
- 병렬 리듀싱에는 `UNORDERED + CONCURRENT` 특성이 함께 필요하다
{{< /callout >}}
