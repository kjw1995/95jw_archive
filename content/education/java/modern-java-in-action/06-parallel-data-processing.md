---
title: "Chapter 07. 병렬 데이터 처리와 성능"
date: 2026-10-12
weight: 6
---

[Chapter 06](../05-collecting-data-with-streams)의 컬렉터에는 병렬을 위한 장치가 이미 들어 있었다. 조각별 결과를 합치는 `combiner`, 공유 누적자를 허락하는 `CONCURRENT`, 그리고 앞선 결과에 기대는 탓에 병렬로 나눌 수 없었던 소수 컬렉터가 그것이다. Java 7 이전에는 데이터를 병렬로 처리하려면 데이터를 직접 나누고, 조각마다 스레드를 붙이고, 경쟁 상태가 생기지 않게 동기화하고, 결과를 합쳐야 했다. Java 7의 포크/조인 프레임워크와 Java 8의 병렬 스트림은 이 일을 `parallel()` 한 줄로 줄였다. 그러나 한 줄로 켤 수 있다고 공짜는 아니다. 이 장의 내용은 세 원리로 정리된다. 첫째, **병렬은 나누고 합치는 비용을 치르고 얻는 것이다.** 요소마다 하는 일이 그 비용보다 커야 이득이고, 그 판단은 추측이 아니라 측정으로 한다. 둘째, **병렬 스트림이 맞는 답을 내려면 공유 가변 상태가 없어야 한다.** 조각들은 서로 독립적이어야 하고, 합치는 연산은 어떻게 나눠도 같은 답을 내야 한다. 셋째, **얼마나 잘 나뉘는가가 성능을 정한다.** 소스를 쪼개는 `Spliterator`와 쪼갠 일을 코어들에 고르게 나눠 주는 포크/조인의 작업 훔치기가 그 바탕이다.

---

## 1. 병렬 스트림

### 1.1 순차 스트림을 병렬로 바꾸기

```java
// 1부터 n까지의 합
long sequentialSum(long n) {
    return Stream
        .iterate(1L, i -> i + 1)
        .limit(n)
        .reduce(0L, Long::sum);
}

long parallelSum(long n) {
    return Stream
        .iterate(1L, i -> i + 1)
        .limit(n)
        .parallel()
        .reduce(0L, Long::sum);
}
```

```
1 ~ 8을 병렬로 더하기
 [1 2] [3 4] [5 6] [7 8]  조각
   3     7    11    15    조각별 합
   └──┬──┘     └──┬──┘
     10          26
      └─────┬─────┘
           36             결과
```

컬렉션에서는 `parallelStream()`, 이미 만든 스트림에서는 `parallel()`을 부르면 병렬 스트림이 된다. 병렬 스트림은 요소를 여러 **조각**으로 나눠 조각마다 다른 스레드가 처리하게 한다. 위 그림처럼 각 스레드가 자기 조각을 `reduce`로 접고, 조각별 결과를 다시 `Long::sum`으로 합친다. 반복을 스트림이 맡는 내부 반복이라([Chapter 04](../03-stream-introduction)) 나누고 합치는 일도 스트림이 맡을 수 있는 것이다.

### 1.2 parallel과 sequential은 플래그다

```java
stream.parallel()
      .filter(...)
      .sequential()
      .map(...)
      .parallel()
      .reduce(...);
// 마지막 parallel()이 이긴다
// filter, map, reduce 모두 병렬
```

`parallel()`을 불러도 스트림 자체에는 아무 변화가 없다. 안쪽에 "병렬로 실행하라"는 불리언 플래그 하나를 세울 뿐이고, `sequential()`은 그 플래그를 내린다. 스트림은 최종 연산이 불릴 때 비로소 실행되므로(지연 연산), 실행 방식도 그때 플래그를 보고 **파이프라인 전체에 한 번** 정해진다. 그래서 중간에 둘을 섞어도 연산마다 다르게 실행되지 않고 마지막으로 부른 쪽이 이긴다. `isParallel()`로 지금 상태를 확인할 수 있다. 일부 연산만 병렬로 하고 싶다면 스트림을 둘로 나눠 따로 실행해야 한다.

### 1.3 누가 일하나: 공용 ForkJoinPool

```java
Runtime.getRuntime()
    .availableProcessors();
// 논리 프로세서 수

ForkJoinPool.commonPool()
    .getParallelism();
// 논리 프로세서 수 - 1 (최소 1)
```

```
병렬 스트림 하나
├─ 최종 연산을 부른 스레드
│   (main 등)도 조각을 처리한다
└─ commonPool의 워커들
    (프로세서 수 - 1개)
```

병렬 스트림은 5절에서 볼 `ForkJoinPool`, 그중 JVM 전체가 함께 쓰는 **공용 풀**(`commonPool()`) 위에서 돈다. 공용 풀의 병렬도는 `availableProcessors()`보다 하나 적은데, 남은 하나는 최종 연산을 부른 스레드 몫이다. 부른 스레드도 기다리기만 하지 않고 조각을 처리하므로 실제로 일하는 스레드 수는 프로세서 수와 같다. `availableProcessors()`는 물리 코어가 아니라 운영체제가 보여 주는 논리 프로세서 수라 하이퍼스레딩으로 생긴 가상 프로세서를 포함하고, 리눅스 컨테이너 안에서는 컨테이너에 걸린 CPU 제한을 반영한다(JDK 10 이상).

공용 풀의 크기는 `-Djava.util.concurrent.ForkJoinPool.common.parallelism=N` 시스템 속성으로 바꿀 수 있다. 하지만 이 값은 JVM 전체의 모든 병렬 스트림에 영향을 주는 전역 설정이므로, 특별한 이유가 없다면 기본값을 그대로 쓰는 편이 낫다. `new ForkJoinPool()`처럼 풀을 직접 만들면 기본 병렬도는 하나를 빼지 않은 프로세서 수다.

{{< callout type="warning" >}}
공용 풀은 JVM 전체가 함께 쓴다. `CompletableFuture.supplyAsync()`의 기본 실행기도 이 풀이다([자바 기초 Chapter 13](../../basics/13-thread)). 병렬 스트림 안에서 파일이나 네트워크 I/O처럼 스레드를 오래 붙잡는 일을 하면 공용 풀의 워커가 묶여, 같은 JVM의 다른 병렬 작업까지 줄을 선다. 웹 서버처럼 요청 여러 개가 동시에 도는 곳에서는 병렬 스트림을 더 신중하게 쓴다.
{{< /callout >}}

```java
ForkJoinPool pool =
    new ForkJoinPool(4);
long sum = pool.submit(() ->
    LongStream.rangeClosed(1, n)
        .parallel()
        .sum())
    .get();
```

특정 작업만 다른 풀에서 돌리려고 위처럼 직접 만든 풀 안에서 스트림을 실행하는 방법이 널리 쓰인다. 포크/조인 작업 안에서 `fork()`하면 그 작업이 도는 풀을 쓴다는 `ForkJoinTask`의 규칙 덕분에 병렬 스트림이 `pool`의 워커로 돈다. 다만 이것은 스트림 API가 약속한 동작이 아니라 현재 구현에 기댄 것이라는 점을 알고 쓴다.

---

## 2. 스트림 성능 측정

### 2.1 왜 그냥 재면 안 되나

병렬로 바꾸면 빨라질 것 같지만 소프트웨어 공학에서 추측은 위험하다. 성능을 최적화할 때의 규칙은 첫째도 측정, 둘째도 측정, 셋째도 측정이다. 그런데 JVM 위의 코드는 `System.nanoTime()`을 앞뒤에 찍는 식으로는 제대로 잴 수 없다.

| 함정 | 무슨 일이 일어나나 | 왜 문제인가 | JMH의 대응 |
|:-----|:-----------------|:-----------|:----------|
| 워밍업 | 처음에는 인터프리터로 돌다가 자주 실행되는 코드만 JIT가 기계어로 컴파일한다 | 첫 몇 번은 최적화 전의 시간이다 | 워밍업 반복을 돌리고 그 결과는 버린다 |
| 죽은 코드 제거 | 결과를 쓰지 않는 계산을 JIT가 통째로 지운다 | 아무것도 하지 않은 시간을 재게 된다 | 벤치마크 메서드의 반환값을 소비해 지우지 못하게 한다 |
| 가비지 컬렉션 | 측정 중에 GC가 끼어든다 | 같은 코드의 시간이 들쭉날쭉해진다 | 반복 측정과 통계, 힙 크기 고정 |
| 프로파일 오염 | 한 JVM에서 여러 코드를 재면 앞의 실행이 JIT의 판단에 영향을 준다 | 측정 순서에 따라 결과가 바뀐다 | 벤치마크마다 새 JVM을 띄운다(포크) |

그래서 OpenJDK가 만든 **JMH**(Java Microbenchmark Harness)를 쓴다. 애너테이션으로 측정 방식을 선언하면 워밍업, 반복, 포크, 통계를 JMH가 처리한다.

### 2.2 JMH 준비

| 의존성 | 역할 | 왜 필요한가 |
|:-------|:-----|:-----------|
| `org.openjdk.jmh:jmh-core:1.37` | 벤치마크 실행 엔진 | 워밍업, 반복, 포크, 결과 통계를 맡는다 |
| `org.openjdk.jmh:jmh-generator-annprocess:1.37` | 애너테이션 프로세서 | `@Benchmark` 메서드를 감싸 측정하는 코드를 컴파일할 때 생성한다 |

JMH 공식 Maven 아키타입(`jmh-java-benchmark-archetype`)으로 프로젝트를 만들면 두 의존성과, 실행 가능한 `benchmarks.jar`를 만드는 설정이 들어 있다. 한 가지 더 챙길 것이 있다. **JDK 23부터 `javac`는 클래스패스에 있는 애너테이션 프로세서를 기본으로 실행하지 않는다.** 그대로 빌드하면 측정 코드가 생성되지 않아, 실행할 때 `/META-INF/BenchmarkList`를 찾을 수 없다는 오류가 난다. 다음처럼 `-proc:full`을 주거나 `maven-compiler-plugin`의 `annotationProcessorPaths`에 프로세서를 등록한다.

```xml
<!-- maven-compiler-plugin 설정 -->
<configuration>
  <compilerArgs>
    <arg>-proc:full</arg>
  </compilerArgs>
</configuration>
```

### 2.3 벤치마크 작성

```java
@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@Fork(value = 2, jvmArgs =
      {"-Xms4G", "-Xmx4G"})
@Warmup(iterations = 3)
@Measurement(iterations = 5)
public class ParallelStreamBenchmark {

    static final long N = 10_000_000L;

    @Benchmark
    public long sequentialSum() {
        return Stream
            .iterate(1L, i -> i + 1)
            .limit(N)
            .reduce(0L, Long::sum);
    }

    @TearDown(Level.Invocation)
    public void tearDown() {
        System.gc();
    }
}
```

```bash
mvn clean package
java -jar ./target/benchmarks.jar \
    ParallelStreamBenchmark
```

| 애너테이션 | 뜻 | 왜 |
|:----------|:---|:---|
| `@BenchmarkMode(AverageTime)` | 호출 한 번의 평균 시간을 잰다 | 관심사가 "합계 한 번에 얼마나 걸리나"이다 |
| `@OutputTimeUnit(MILLISECONDS)` | 결과를 밀리초로 보인다 | 천만 개의 합은 밀리초 단위에서 차이가 보인다 |
| `@Fork(2, -Xms4G -Xmx4G)` | 새 JVM 두 개에서 따로 잰다 | JVM마다 달라지는 JIT 판단의 편차를 보고, 힙을 고정해 GC의 영향을 줄인다 |
| `@Warmup`, `@Measurement` | 버릴 반복과 잴 반복의 횟수 | JIT 컴파일이 끝난 뒤의 시간만 잰다 |
| `@State(Scope.Thread)` | 이 클래스를 스레드마다 하나인 상태 객체로 쓴다 | `@Setup`, `@TearDown` 같은 준비·정리 메서드는 상태 클래스에 둔다 |
| `@TearDown(Level.Invocation)` | 호출이 끝날 때마다 실행한다 | 다음 측정 전에 GC를 미리 돌려 측정 중에 끼어들 가능성을 줄인다 |

`Level.Invocation`은 호출마다 정리 코드를 끼워 넣으므로, 호출 하나가 마이크로초 단위로 짧은 벤치마크에서는 오히려 측정을 흐린다. 이 예제처럼 호출 하나가 밀리초 단위일 때 쓴다.

### 2.4 다섯 가지 합계 비교

```java
@Benchmark
public long iterativeSum() {
    long result = 0;
    for (long i = 1L; i <= N; i++) {
        result += i;
    }
    return result;
}

@Benchmark
public long rangedSum() {
    return LongStream.rangeClosed(1, N)
        .reduce(0L, Long::sum);
}

@Benchmark
public long parallelRangedSum() {
    return LongStream.rangeClosed(1, N)
        .parallel()
        .reduce(0L, Long::sum);
}
```

1.1절의 `sequentialSum`, `parallelSum`과 위의 세 메서드를 함께 재면 결과의 절대값은 기기마다 다르지만 순서는 대체로 다음과 같다.

| 방법 | 경향 | 왜 |
|:-----|:-----|:---|
| `iterativeSum` (`for` 루프) | 가장 빠른 축이다 | 기본형 `long` 덧셈뿐이고 JIT가 단순한 루프를 잘 최적화한다 |
| `sequentialSum` (`iterate`) | 느리다 | 요소마다 `Long` 객체를 만들고 푸는 박싱 비용이 든다 |
| `parallelSum` (`iterate` + `parallel`) | **순차보다도 느리다** | `iterate`는 앞 값으로 다음 값을 만들어 나눌 수 없다. 병렬 비용만 더해진다 |
| `rangedSum` (`rangeClosed`) | `iterate`보다 빠르다 | 기본형 특화 스트림이라 박싱이 없다 |
| `parallelRangedSum` | 스트림 중 가장 빠르다 | 박싱이 없고 범위를 반씩 쉽게 쪼갤 수 있다 |

```
iterate: 앞 값을 알아야 다음 값
  1 → 2 → 3 → 4 → ... → n
  처음부터 차례로만 만들 수 있다

rangeClosed(1, 8): 범위만 나눈다
  [1..8]
   ├─ [1..4]
   │   ├─ [1..2]
   │   └─ [3..4]
   └─ [5..8]
       ├─ [5..6]
       └─ [7..8]
```

`parallel()`을 붙인 `iterate`가 순차보다 느린 이유가 셋째 원리다. 병렬로 처리하려면 먼저 요소를 조각으로 나눠야 하는데, `iterate`는 2를 알아야 3을 만들 수 있어서 n번째 요소를 얻으려면 처음부터 차례로 만들어 가야 한다. 결국 앞에서부터 순서대로 만들면서 묶음으로 떼어 내는 수밖에 없고, 병렬화의 이득은 거의 없이 스레드에 나눠 주고 합치는 비용만 더해진다. 반면 `rangeClosed`는 범위의 중간값만 계산하면 바로 둘로 나뉜다. [Chapter 05](../04-stream-utilization)의 기본형 특화 스트림이 박싱을 없애는 것과 함께, **올바른 자료구조를 고르는 것이 병렬화보다 성능에 더 큰 영향을 줄 때가 많다.**

병렬화 자체의 비용도 기억해야 한다. 스트림을 재귀적으로 나누고, 조각을 각 스레드에 할당하고, 조각별 결과를 하나로 합쳐야 한다. 코어 사이의 데이터 이동은 생각보다 비싸서, 코어 간에 데이터를 옮기는 시간보다 훨씬 오래 걸리는 작업만 병렬로 돌리는 것이 바람직하다. 첫째 원리다.

---

## 3. 병렬 스트림을 올바르게 쓰기

### 3.1 공유 상태를 바꾸면 답이 틀린다

```java
class Accumulator {
    long total = 0;

    void add(long value) {
        total += value;
    }
}

long sideEffectSum(long n) {
    Accumulator acc = new Accumulator();
    LongStream.rangeClosed(1, n)
        .parallel()
        .forEach(acc::add);
    return acc.total;
}
// n = 10_000_000일 때
//   정답: 50000005000000
//   병렬: 실행마다 다르고 대개 작다
```

병렬 스트림이 틀린 답을 내는 원인은 대부분 **공유된 가변 상태**다. `total += value`는 읽고, 더하고, 쓰는 세 단계라 원자적이지 않다. 두 스레드가 같은 `total`을 읽어 각자 더한 뒤 쓰면 한쪽의 덧셈이 사라진다([자바 기초 Chapter 13](../../basics/13-thread)의 원자성 문제). 사라진 덧셈만큼 결과는 정답보다 작아지고, 어느 덧셈이 사라질지는 스레드의 실행 순서에 달려 있어 실행할 때마다 값이 다르다.

`add`에 `synchronized`를 붙이면 답은 맞지만, 모든 스레드가 락 하나를 두고 줄을 서므로 병렬로 돌릴 이유가 사라진다. 올바른 해법은 공유 상태를 없애는 것이다. `LongStream.rangeClosed(1, n).parallel().sum()`처럼 리듀싱에 맡기면 스트림이 조각마다 부분합을 따로 계산하고 마지막에 합친다. 둘째 원리다.

### 3.2 결합법칙과 항등값

```java
Stream.of(1, 2, 3, 4)
    .reduce(10, Integer::sum);
// 20

Stream.of(1, 2, 3, 4).parallel()
    .reduce(10, Integer::sum);
// 20이 아니다
// 조각마다 10에서 출발한다
```

공유 상태가 없어도 리듀싱에 넘기는 함수가 조건을 지키지 않으면 병렬 결과가 순차와 달라진다. `reduce`의 첫 인수를 "초깃값"으로 생각해 10을 넣으면, 병렬에서는 조각마다 10에서 출발하므로 조각 수만큼 10이 더해진다. 첫 인수는 초깃값이 아니라 **항등값**이어야 한다. 뺄셈처럼 결합법칙이 성립하지 않는 연산도 조각을 나누는 방식에 따라 답이 달라진다([자바 기초 Chapter 14](../../basics/14-lambda-stream)).

| 조건 | 뜻 | 어기면 | 왜 |
|:-----|:---|:------|:---|
| 결합법칙 | `(a op b) op c`와 `a op (b op c)`가 같다 | 병렬 결과가 순차와 다르다 | 조각을 어디서 나누든 같은 답이어야 한다 |
| 항등값 | `identity op x`가 `x`다 | 조각 수만큼 초깃값이 더해진다 | 조각마다 항등값에서 출발한다 |
| 무간섭, 무상태 | 람다가 바깥 상태나 소스를 바꾸지 않는다 | 경쟁 상태, 실행마다 다른 결과 | 조각들이 동시에 실행된다 |

### 3.3 순서에 기대는 연산

```java
IntStream.rangeClosed(1, 8)
    .parallel()
    .forEach(System.out::print);
// 63584217처럼 섞인다

IntStream.rangeClosed(1, 8)
    .parallel()
    .forEachOrdered(System.out::print);
// 12345678
```

병렬 스트림의 `forEach`는 조각을 처리하는 스레드가 끝나는 대로 요소를 내보내므로 순서를 보장하지 않는다. 순서가 필요하면 `forEachOrdered`를 쓰지만, 그러려면 앞 조각이 끝날 때까지 뒤 조각의 결과를 붙잡아 두어야 한다. 순서를 지키는 비용은 다른 연산에도 있다.

| 연산 | 병렬에서의 비용 | 대안 | 왜 |
|:-----|:-------------|:-----|:---|
| `findFirst()` | 앞쪽 조각의 결과를 기다려야 한다 | `findAny()` | 순서가 상관없으면 어느 조각이든 먼저 찾은 답을 쓴다 |
| `limit(n)` | 앞에서부터 n개를 가려내려고 조각별 결과를 모아 둔다 | `unordered().limit(n)` | 아무 n개든 된다면 순서 추적을 버린다 |
| `forEachOrdered` | 순서대로 내보내려 기다린다 | `forEach` | 출력 순서가 의미 없을 때 |
| `sorted()`, `distinct()` | 모든 요소를 모아야 하는 장벽이다 | 꼭 필요한 곳에만 | 조각 사이에 데이터를 많이 옮긴다 |

`unordered()`는 요소를 섞는 연산이 아니라 "이 스트림의 순서는 신경 쓰지 않는다"는 표시다. `HashSet`처럼 원래 순서가 없는 소스는 처음부터 이 표시를 가진다.

---

## 4. 병렬 스트림을 효과적으로 쓰기

### 4.1 판단 기준

| 기준 | 판단 | 왜 |
|:-----|:-----|:---|
| 측정했는가 | 순차와 병렬을 둘 다 잰다 | 병렬의 이득은 하드웨어와 데이터에 따라 달라 직관이 자주 틀린다 |
| 박싱 | 기본형 특화 스트림(`IntStream`, `LongStream`, `DoubleStream`)을 쓴다 | 요소마다 객체를 만들고 푸는 비용이 병렬의 이득을 삼킨다 |
| 순서 의존 연산 | `findAny()`, `unordered()`를 고려한다 | 순서를 지키려면 조각 사이에 기다림이 생긴다(3.3절) |
| 전체 비용 N x Q | 요소 수 N과 요소 하나의 처리 비용 Q의 곱이 커야 한다 | Q가 크면 요소가 적어도 이득이고, Q가 작으면 N이 아주 커야 한다 |
| 데이터 양 | 적으면 순차로 둔다 | 나누고 합치는 고정 비용을 만회할 만큼 일이 없다 |
| 소스의 분해성 | 4.2절의 표를 본다 | 잘 나뉘지 않으면 병렬화 자체가 안 된다 |
| 중간 연산 | `filter`는 남을 요소 수를 모르게 만든다 | 크기를 모르면 조각을 고르게 나누기 어렵다 |
| 최종 연산의 병합 비용 | `combiner`가 비싸면 조심한다 | 큰 `HashMap` 둘을 합치는 것처럼 병합이 비싸면 병렬로 번 시간을 다시 쓴다 |

### 4.2 소스별 분해성

| 소스 | 분해성 | 왜 |
|:-----|:------|:---|
| `ArrayList`, 배열 | 훌륭함 | 인덱스로 정확히 반씩 자르고, 나눈 양쪽의 크기도 정확히 안다 |
| `IntStream.range` | 훌륭함 | 범위의 중간값만 계산하면 된다 |
| `HashSet` | 좋음 | 내부의 버킷 배열을 반씩 자른다. 버킷마다 요소 수가 달라 양쪽 크기는 추정치다 |
| `TreeSet` | 좋음 | 트리를 루트부터 왼쪽과 오른쪽으로 나눈다 |
| `LinkedList` | 나쁨 | 노드를 따라가야 중간에 닿으므로, 앞에서부터 1024개, 2048개처럼 묶음을 배열로 복사해 떼어 낸다 |
| `Stream.iterate` | 나쁨 | 다음 값이 앞 값에 달려 있어 차례로 만들면서 묶음으로 떼어 낼 수밖에 없다 |

`LinkedList`와 `iterate`도 나뉘기는 한다. 다만 묶음을 떼어 내려면 그만큼을 처음부터 차례로 지나가며 배열에 복사해야 하므로, 분할 자체가 한 스레드에서 순서대로 일어나는 순차 작업이 된다. 떼어 낸 배열은 다시 잘 나뉘지만, 그 전에 치른 복사 비용과 기다린 시간이 병렬의 이득을 깎는다. 이 차이가 어디서 오는지는 6절의 `Spliterator`에서 본다.

---

## 5. 포크/조인 프레임워크

### 5.1 RecursiveTask로 나누고 합치기

```
if (태스크가 충분히 작다) {
    순차로 계산한다
} else {
    두 서브태스크로 나눈다
    한쪽은 fork, 다른 쪽은 compute
    fork한 쪽을 join으로 기다린다
    두 결과를 합친다
}
```

병렬 스트림의 바탕인 포크/조인 프레임워크는 Java 7에 들어왔다. 병렬화할 수 있는 작업을 재귀적으로 작은 작업으로 나누고, 작은 작업들의 결과를 합쳐 전체 결과를 만든다. **분할 정복**(divide and conquer) 알고리즘의 병렬 판이다. 작업을 실행하는 `ForkJoinPool`은 `ExecutorService`의 구현체이고, 작업은 `RecursiveTask<R>`를 상속해 추상 메서드 `compute()`를 구현한다.

| 클래스 | `compute()`의 반환 | 왜 |
|:-------|:-----------------|:---|
| `RecursiveTask<R>` | `R` | 합계나 최댓값처럼 결과를 합쳐 올라가야 할 때 |
| `RecursiveAction` | 없음 | 배열을 제자리에서 정렬하듯 결과 대신 상태를 바꿀 때 |

```java
public class SumCalculator
        extends RecursiveTask<Long> {

    static final int THRESHOLD = 10_000;
    private final long[] nums;
    private final int lo, hi;

    SumCalculator(long[] nums) {
        this(nums, 0, nums.length);
    }

    SumCalculator(long[] nums,
                  int lo, int hi) {
        this.nums = nums;
        this.lo = lo;
        this.hi = hi;
    }

    @Override
    protected Long compute() {
        int length = hi - lo;
        if (length <= THRESHOLD) {
            return sumDirectly();
        }
        int mid = lo + length / 2;
        var left = new SumCalculator(
            nums, lo, mid);
        left.fork();
        var right = new SumCalculator(
            nums, mid, hi);
        long r = right.compute();
        long l = left.join();
        return l + r;
    }

    private long sumDirectly() {
        long sum = 0;
        for (int i = lo; i < hi; i++) {
            sum += nums[i];
        }
        return sum;
    }
}
```

```
           [0, n)
       ┌──────┴──────┐
   [0, n/2)      [n/2, n)
     fork         compute
    ┌──┴──┐       ┌──┴──┐
   ...   ...     ...   ...
 길이 <= THRESHOLD → 순차 합
 결과는 join으로 합치며 올라온다
```

책의 `ForkJoinSumCalculator`를 짧은 이름으로 옮겼다. 배열의 구간 `[lo, hi)`를 맡은 태스크는 구간이 1만 개 이하면 직접 더하고, 크면 반으로 나눈다. 왼쪽 절반은 `fork()`로 풀에 넘겨 다른 워커가 가져갈 수 있게 하고, 오른쪽 절반은 지금 스레드가 `compute()`로 직접 계산한 뒤, `join()`으로 왼쪽 결과를 기다려 합친다. 이 과정이 재귀적으로 반복되어 1만 개 이하의 조각들이 여러 워커에서 동시에 계산된다.

### 5.2 실행하기

```java
long[] nums = LongStream
    .rangeClosed(1, n).toArray();
long sum = ForkJoinPool.commonPool()
    .invoke(new SumCalculator(nums));
```

`invoke()`는 순차 코드에서 병렬 계산을 시작하는 입구다. 태스크를 풀에 넣고 결과가 나올 때까지 기다렸다가 돌려준다. 책의 예제처럼 `new ForkJoinPool()`로 풀을 직접 만든다면, 책도 강조하듯 애플리케이션 전체에서 하나만 만들어 정적 필드에 두고 쓴다. 풀은 스레드를 여럿 거느리는 무거운 객체라 호출할 때마다 만들 것이 아니다. 따로 둘 이유가 없다면 위처럼 공용 풀을 써도 된다.

이 합계를 병렬 스트림과 비교하면 대체로 느리게 나온다. 계산 자체보다 `toArray()`로 `long` 배열 천만 칸을 먼저 만드는 비용이 크기 때문이다. 병렬 스트림은 범위를 직접 나누므로 배열이 필요 없다.

### 5.3 제대로 쓰는 법

| 규칙 | 왜 |
|:-----|:---|
| `join()`은 양쪽 서브태스크를 모두 시작한 뒤 부른다 | `join()`은 결과가 나올 때까지 호출자를 막는다. 한쪽을 `fork()`하자마자 `join()`하면 순차 실행에 오버헤드만 더한 꼴이 된다 |
| 태스크 안에서는 풀의 `invoke()`를 부르지 않는다 | `invoke()`는 순차 코드에서 시작할 때 쓰는 입구다. 태스크 안에서는 `fork()`와 `compute()`로 충분하다 |
| 한쪽은 `fork()`, 다른 쪽은 `compute()` | 지금 스레드가 한쪽을 직접 처리하므로 태스크 하나만큼 풀에 넣고 꺼내는 비용을 아낀다. `invokeAll(left, right)`도 같은 일을 한다 |
| 서브태스크는 `fork()` 비용보다 오래 걸리게 나눈다 | 너무 잘게 나누면 태스크를 만들고 큐에 넣는 비용이 계산보다 커진다 |
| 태스크 안에서 I/O로 막히지 않는다 | 풀의 워커 수는 프로세서 수에 맞춰져 있어, 하나가 막히면 그만큼 병렬도가 줄어든다 |
| 디버깅이 어렵다는 것을 안다 | `fork()`된 태스크는 다른 워커의 스택에서 `compute()`되므로 스택 트레이스가 호출 흐름을 보여 주지 않는다 |
| 성능은 워밍업 뒤에 잰다 | JIT 최적화 전의 실행 시간은 의미가 없다. 2절의 JMH를 쓴다. 컴파일러 최적화가 순차 판에 더 잘 먹힐 수 있다는 점도 감안한다 |

서브태스크를 얼마나 잘게 나눌지는 [동시성 시리즈의 작업 분해](../../../concurrency/07-task-decomposition)에서 말하는 입도(granularity)의 문제다. 너무 크면 코어가 놀고, 너무 작으면 관리 비용이 계산을 넘는다.

### 5.4 작업 훔치기

```
 워커 A의 덱
   base         top
  ┌─────┬─────┬─────┐
  │ T1  │ T2  │ T3  │
  └─────┴─────┴─────┘
     ▲           ▲
     │           └ A가 넣고 꺼낸다
     └ 한가한 B가 훔친다

 T1: 가장 먼저 쪼갠 큰 태스크
 T3: 방금 쪼갠 작은 태스크
```

이론적으로는 코어 수만큼 같은 크기의 태스크로 나누면 모든 코어가 동시에 끝날 것 같다. 현실에서는 분할이 고르지 않거나, 디스크 접근이 느려지거나, 외부 서비스의 응답이 늦어 태스크마다 완료 시간이 크게 달라진다. 그러면 일을 일찍 끝낸 코어가 논다. 포크/조인은 이 문제를 **작업 훔치기**(work stealing)로 푼다.

풀의 워커는 저마다 자기 태스크를 담는 **덱**(양쪽 끝에서 넣고 뺄 수 있는 큐)을 가진다. 책은 이것을 이중 연결 리스트로 설명하지만 JDK의 실제 구현은 배열 기반의 덱이다. 워커는 `fork()`한 태스크를 자기 덱의 한쪽 끝(top)에 넣고 같은 끝에서 꺼낸다. 가장 최근에 쪼갠, 즉 가장 작은 태스크부터 처리하는 셈이다. 자기 덱이 빈 워커는 놀지 않고 **다른 워커 덱의 반대쪽 끝(base)**에서 태스크를 훔쳐 온다. 거기에는 가장 먼저 쪼개진 큰 태스크가 있다. 큰 덩어리를 가져가므로 훔치는 횟수가 적고, 주인과 도둑이 서로 다른 끝을 건드리므로 둘이 부딪힐 일도 적다. 모든 덱이 빌 때까지 이 과정이 반복된다.

그래서 태스크를 코어 수보다 **훨씬 많은 작은 단위**로 나누는 것이 바람직하다. 훔칠 거리가 충분해야 늦게 끝나는 워커의 일을 다른 워커가 나눠 들 수 있다.

---

## 6. Spliterator

### 6.1 분할할 수 있는 반복자

```java
public interface Spliterator<T> {
    boolean tryAdvance(
        Consumer<? super T> action);
    Spliterator<T> trySplit();
    long estimateSize();
    int characteristics();
}
```

병렬 스트림은 소스를 어떻게 나눌까? 5절처럼 구간을 직접 나누는 코드를 쓰지 않아도 되는 것은 Java 8의 **`Spliterator`** 덕분이다. 이름은 "분할할 수 있는 반복자"(splitable iterator)라는 뜻이다. `Iterator`처럼 소스의 요소를 탐색하지만 병렬 처리를 위해 자신을 쪼갤 수 있다. Java 8은 모든 컬렉션에 쓸 수 있는 기본 `Spliterator`를 `Collection`의 디폴트 메서드 `spliterator()`로 제공하고, `ArrayList`나 `HashMap` 같은 구현체는 자기 구조에 맞는 것으로 바꿔 둔다.

| 메서드 | 하는 일 | 왜 |
|:-------|:-------|:---|
| `tryAdvance` | 요소가 남아 있으면 하나를 소비하고 `true`, 없으면 `false` | `Iterator`의 `hasNext()`와 `next()`를 호출 하나로 합쳤다 |
| `trySplit` | 요소의 일부를 떼어 새 `Spliterator`로 돌려준다. 더 나눌 수 없으면 `null` | 병렬 처리의 분할 지점이다 |
| `estimateSize` | 남은 요소 수. 정확하지 않아도 된다 | 계속 나눌지, 고르게 나뉘었는지 판단하는 데 쓴다 |
| `characteristics` | 소스의 성질을 비트 플래그로 알린다 | 스트림이 생략할 수 있는 작업을 고른다(6.3절) |

### 6.2 분할 과정

```
1단계  [==================]
2단계  [========][========]
3단계  [===][===][===][===]
4단계  모든 trySplit이 null
       → 조각마다 순차 처리
```

스트림은 처음 `Spliterator`에 `trySplit()`을 불러 둘로 나누고, 나온 두 `Spliterator`에 다시 `trySplit()`을 부르는 식으로 재귀적으로 쪼갠다. 어떤 `Spliterator`가 `null`을 돌려주면 그 조각은 더 이상 나뉘지 않는다. 모든 조각이 `null`을 돌려주거나 충분히 작아지면 분할을 멈추고, 각 조각을 한 스레드가 `tryAdvance`로 차례로 처리한다. 5절의 포크/조인이 하던 "나눌지, 직접 계산할지"의 판단을 `Spliterator`가 소스의 구조에 맞게 대신하는 것이다. 4.2절의 표에서 `ArrayList`와 `LinkedList`의 차이는 결국 두 클래스의 `trySplit()`이 얼마나 싸고 고르게 나누느냐의 차이다.

### 6.3 특성

| 특성 | 뜻 | 가진 소스 | 왜 |
|:-----|:---|:---------|:---|
| `ORDERED` | 요소에 정해진 순서가 있다 | `List`, `TreeSet`, `IntStream.range` | `findFirst`, `forEachOrdered`가 지킬 순서의 기준이다 |
| `DISTINCT` | 중복이 없다 | `Set` | `distinct()`를 건너뛸 수 있다 |
| `SORTED` | 정렬되어 있다 | `TreeSet`, `IntStream.range` | 같은 순서로 `sorted()`하는 일을 건너뛸 수 있다 |
| `SIZED` | 크기를 정확히 안다 | `ArrayList`, `HashSet`, 배열 | `count()`를 바로 내고 결과 배열을 미리 잡는다 |
| `SUBSIZED` | 나눈 조각들의 크기도 정확히 안다 | `ArrayList`, 배열, `IntStream.range` | 조각마다 결과 배열의 제자리에 바로 쓸 수 있다 |
| `NONNULL` | `null` 요소가 없다 | `ConcurrentHashMap`의 키, `IntStream.range` | `null` 검사를 생략할 수 있다 |
| `IMMUTABLE` | 소스를 바꿀 수 없다 | `IntStream.range` | 탐색 중의 변경을 걱정하지 않아도 된다 |
| `CONCURRENT` | 다른 스레드가 동시에 바꿔도 안전하다 | `ConcurrentHashMap` | 탐색 중의 동시 변경을 허용한다 |

중간 연산은 이 특성을 바꾼다. `ArrayList`의 스트림에 `filter`를 걸면 몇 개가 남을지 모르므로 `SIZED`가 사라지고, `sorted()`를 걸면 `SORTED`가 생긴다. 4.1절에서 `filter`가 분할을 어렵게 한다고 한 것이 이것이다.

### 6.4 커스텀 Spliterator: 단어 세기

```java
final String SENTENCE =
    " Nel   mezzo del cammin  di"
    + " nostra  vita mi  ritrovai"
    + " in una  selva oscura ché la"
    + "  dritta via era   smarrita ";

int countWordsIteratively(String s) {
    int counter = 0;
    boolean lastSpace = true;
    for (char c : s.toCharArray()) {
        if (Character.isWhitespace(c)) {
            lastSpace = true;
        } else {
            if (lastSpace) counter++;
            lastSpace = false;
        }
    }
    return counter;
}
// 19
```

단테의 『신곡』 첫 구절에서 단어를 센다. 공백이 여러 개 섞여 있고, 공백 다음에 글자가 나올 때마다 단어 하나를 센다. 반복문으로는 간단하다. 이것을 스트림으로 옮겨 병렬로 돌려 본다.

```java
record WordCounter(int count,
                   boolean lastSpace) {

    WordCounter accumulate(char c) {
        boolean space =
            Character.isWhitespace(c);
        if (space == lastSpace) {
            return this;
        }
        return new WordCounter(
            space ? count : count + 1,
            space);
    }

    WordCounter combine(WordCounter o) {
        return new WordCounter(
            count + o.count,
            o.lastSpace);
    }
}

int countWords(Stream<Character> s) {
    WordCounter wc = s.reduce(
        new WordCounter(0, true),
        WordCounter::accumulate,
        WordCounter::combine);
    return wc.count();
}
```

`WordCounter`는 지금까지 센 단어 수와 직전 문자가 공백이었는지를 담는 불변 레코드다. `accumulate`는 공백에서 글자로 넘어갈 때만 단어 수를 늘린 새 `WordCounter`를 돌려주고, `combine`은 두 조각의 단어 수를 더한다. 가변 상태가 없으니 둘째 원리를 지킨 것처럼 보인다.

```java
Stream<Character> chars(String s) {
    return IntStream
        .range(0, s.length())
        .mapToObj(s::charAt);
}

countWords(chars(SENTENCE));
// 19
countWords(chars(SENTENCE)
    .parallel());
// 19가 아닌 더 큰 값
```

```
"... cammin  di " | "nostra ..."
  → 공백 뒤에서 잘려 문제없다
"... me" | "zzo del ..."
  → "mezzo"가 두 조각에 걸친다
  → 둘째 조각은 lastSpace=true로
    출발해 "zzo"를 새 단어로 센다
```

병렬로 돌리면 답이 틀린다. `IntStream.range`는 문자열을 **아무 위치에서나** 반으로 자르기 때문에 단어 중간에서 잘리는 일이 생긴다. 모든 조각은 항등값 `WordCounter(0, true)`, 즉 "직전 문자는 공백"이라는 가정에서 출발하므로, 잘린 단어의 뒷부분이 새 단어로 한 번 더 세어진다. 잘리는 단어가 많을수록 결과는 커지고, 조각이 잘게 나뉠수록 정답에서 멀어진다. 가변 상태가 없어도 **조각의 경계가 알고리즘의 가정을 깨면** 병렬 결과는 틀린다.

해법은 문자열을 공백에서만 자르는 `Spliterator`를 직접 만드는 것이다.

```java
class WordSpliterator implements
        Spliterator<Character> {

    private final String text;
    private int pos;
    private final int end;

    WordSpliterator(String text) {
        this(text, 0, text.length());
    }

    private WordSpliterator(String text,
            int pos, int end) {
        this.text = text;
        this.pos = pos;
        this.end = end;
    }

    @Override
    public boolean tryAdvance(
            Consumer<? super Character>
                action) {
        if (pos >= end) return false;
        char c = text.charAt(pos++);
        action.accept(c);
        return true;
    }

    @Override
    public Spliterator<Character>
            trySplit() {
        int size = end - pos;
        if (size < 10) return null;
        int i = pos + size / 2;
        while (i < end && !spaceAt(i)) {
            i++;
        }
        if (i == end) return null;
        var head = new WordSpliterator(
            text, pos, i);
        pos = i;
        return head;
    }

    private boolean spaceAt(int i) {
        return Character.isWhitespace(
            text.charAt(i));
    }

    @Override
    public long estimateSize() {
        return end - pos;
    }

    @Override
    public int characteristics() {
        return ORDERED | SIZED
            | SUBSIZED | NONNULL
            | IMMUTABLE;
    }
}
```

| 메서드 | 구현 | 왜 |
|:-------|:-----|:---|
| `tryAdvance` | 현재 위치의 문자를 소비하고 위치를 하나 옮긴다 | 남은 문자가 없으면 아무것도 하지 않고 `false`를 돌려주는 것이 계약이다 |
| `trySplit` | 남은 구간의 가운데부터 공백을 찾아, 앞부분을 새 `Spliterator`로 떼어 준다 | 공백에서만 자르면 단어가 두 조각에 걸치지 않는다 |
| `trySplit`의 `null` | 남은 문자가 10개 미만이거나 뒤쪽에 공백이 없으면 | 너무 작은 조각은 나누는 비용이 처리 비용보다 크다 |
| `estimateSize` | 남은 문자 수 `end - pos` | 구간을 정확히 알므로 추정이 아니라 정확한 값이다 |
| `characteristics` | `ORDERED`, `SIZED`, `SUBSIZED`, `NONNULL`, `IMMUTABLE` | 문자열은 순서가 있고 바뀌지 않으며, 나눈 조각의 크기도 정확히 안다 |

`trySplit`이 **앞부분**을 떼어 돌려주는 데도 이유가 있다. `ORDERED`인 `Spliterator`는 떼어 낸 쪽이 원래 순서의 앞부분이어야 한다는 계약이 있어서, 스트림이 조각들의 순서를 원래대로 이어 붙일 수 있다. 책의 예제는 `substring`으로 문자열을 복사해 떼어 내지만, 여기서는 같은 문자열의 구간 `[pos, end)`만 나눠 가져 복사를 없앴다. 책의 `tryAdvance`는 마지막 문자를 소비하면서 `false`를 돌려주고 남은 문자가 없을 때 불리면 예외가 나는데, 이것도 계약대로 고쳤다.

```java
var spliterator =
    new WordSpliterator(SENTENCE);
Stream<Character> parallel =
    StreamSupport.stream(
        spliterator, true);
countWords(parallel);
// 19
```

`StreamSupport.stream()`의 두 번째 인수 `true`는 병렬 스트림을 만들라는 뜻이다. 이제 모든 조각이 문자열의 처음이나 공백에서 시작하므로 "직전 문자는 공백"이라는 항등값의 가정이 모든 조각에서 참이 되고, 병렬로도 19가 나온다. 셋째 원리의 다른 면이다. 잘 나뉘는 것은 빠르기 위해서만이 아니라 **맞기 위해서도** 필요하다.

손에 `Iterator`만 있다면 `Spliterator`를 처음부터 구현하기 전에 `Spliterators.spliteratorUnknownSize(iterator, ORDERED)`를 먼저 떠올린다. 이렇게 만든 스트림은 `LinkedList`처럼 묶음을 복사해 가며 나뉘지만, 순차로 쓰거나 요소당 일이 큰 병렬 처리에는 충분하다.

---

## 핵심 정리

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 병렬 스트림 | `parallelStream()`, `parallel()` | 내부 반복이라 나누고 합치는 일을 스트림이 맡는다 |
| `parallel`, `sequential` | 마지막 호출이 파이프라인 전체에 적용된다 | 플래그 하나이고 실행 방식은 최종 연산 때 정해진다 |
| 공용 풀 | 병렬도는 프로세서 수 - 1 | 최종 연산을 부른 스레드도 조각을 처리한다 |
| 공용 풀 공유 | 병렬 스트림 안에서 블로킹을 피한다 | JVM 전체의 병렬 작업이 같은 워커를 쓴다 |
| 측정 | JMH로 잰다 | JIT 워밍업, 죽은 코드 제거, GC가 단순 측정을 속인다 |
| JDK 23 이상의 JMH | `-proc:full` 또는 프로세서 경로 등록 | `javac`가 클래스패스의 애너테이션 프로세서를 기본으로 돌리지 않는다 |
| `iterate`와 병렬 | 순차보다 느려진다 | 앞 값에 기대어 나눌 수 없고 박싱까지 있다 |
| `rangeClosed` | 기본형이고 잘 나뉜다 | 박싱이 없고 중간값으로 바로 나뉜다 |
| 공유 가변 상태 | 병렬에서 답이 틀린다 | `+=`는 원자적이지 않아 덧셈이 사라진다 |
| `reduce`의 첫 인수 | 초깃값이 아니라 항등값 | 조각마다 그 값에서 출발한다 |
| 순서 의존 연산 | `findAny`, `unordered()` | 순서를 지키려면 조각 사이에 기다림이 생긴다 |
| 판단 기준 | N x Q, 박싱, 분해성, 병합 비용 | 나누고 합치는 비용을 넘는 일이 있어야 이득이다 |
| `RecursiveTask` | 작으면 직접, 크면 반으로 | 분할 정복을 풀의 워커들에 나눠 맡긴다 |
| `fork`, `compute`, `join` | 한쪽은 넘기고 한쪽은 직접, `join`은 마지막에 | 현재 스레드를 놀리지 않고 막히는 시간을 줄인다 |
| 풀 생성 | 하나만 만들거나 공용 풀 | 풀은 스레드를 거느리는 무거운 객체다 |
| 작업 훔치기 | 한가한 워커가 남의 덱 반대쪽 끝에서 가져간다 | 큰 태스크를 훔쳐 횟수와 충돌을 줄이고 코어를 놀리지 않는다 |
| `Spliterator` | 소스를 나누는 방법 | `trySplit`이 싸고 고를수록 병렬이 빠르다 |
| 특성 | `SIZED`, `SUBSIZED`, `ORDERED` 등 | 스트림이 생략할 수 있는 일을 고른다 |
| 커스텀 `Spliterator` | 알고리즘이 허용하는 경계에서만 자른다 | 조각의 경계가 가정을 깨면 병렬 결과가 틀린다 |

{{< callout type="info" >}}
**용어 정리**
- **병렬 스트림**: 요소를 조각으로 나눠 여러 스레드가 처리하고 결과를 합치는 스트림
- **공용 풀(`ForkJoinPool.commonPool()`)**: JVM 전체가 함께 쓰는 포크/조인 풀. 병렬 스트림과 `CompletableFuture`의 기본 실행기
- **JMH**: OpenJDK의 마이크로벤치마크 도구. 워밍업, 반복, 포크, 통계를 대신 처리한다
- **워밍업**: JIT 컴파일이 끝나 측정할 만한 상태가 되기까지의 실행
- **박싱 / 언박싱**: 기본형 값을 래퍼 객체로 감싸고 푸는 일. 요소마다 일어나면 병렬의 이득을 삼킨다
- **항등값**: 어떤 값과 연산해도 그 값을 그대로 돌려주는 값. `reduce`의 첫 인수
- **결합법칙**: 연산을 묶는 순서를 바꿔도 결과가 같은 성질. 병렬 리듀싱의 조건
- **포크/조인 프레임워크**: 작업을 재귀적으로 나눠(fork) 병렬로 처리하고 결과를 합치는(join) Java 7의 프레임워크
- **`RecursiveTask` / `RecursiveAction`**: 결과가 있는 / 없는 포크/조인 태스크
- **분할 정복**: 문제를 작은 문제로 나눠 풀고 그 답을 합쳐 전체 답을 만드는 방법
- **작업 훔치기(work stealing)**: 자기 덱이 빈 워커가 다른 워커 덱의 반대쪽 끝에서 태스크를 가져가는 것
- **덱(deque)**: 양쪽 끝에서 넣고 뺄 수 있는 큐
- **`Spliterator`**: 분할할 수 있는 반복자. 병렬 스트림이 소스를 나누는 방법을 정의한다
- **특성(characteristics)**: `Spliterator`가 소스의 성질을 알리는 비트 플래그. `ORDERED`, `SIZED`, `SUBSIZED` 등
{{< /callout >}}
