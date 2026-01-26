---
title: "순차 실행과 병렬 실행"
weight: 2
---

# 순차 실행과 병렬 실행

순차 컴퓨팅과 병렬 컴퓨팅의 차이를 이해하고, 병렬 처리를 통한 성능 향상의 이론적 한계를 알아본다.

---

## 1. 작업과 순차 실행

### 1.1 작업(Task)이란?

> **작업(Task):** 논리적으로 독립적인 어떤 일의 일부

모든 문제는 애플리케이션 형태로 형식화하면 **일련의 작업**으로 나뉜다.

```
전체 문제
    ↓
[작업1] → [작업2] → [작업3] → [작업4]
```

**작업의 예시:**

| 프로그램 | 작업 분해 |
|:--------|:---------|
| 웹 서버 | HTTP 요청 파싱 → 비즈니스 로직 → DB 조회 → 응답 생성 |
| 이미지 처리 | 파일 읽기 → 필터 적용 → 크기 조정 → 저장 |
| 데이터 분석 | 데이터 로드 → 전처리 → 분석 → 시각화 |

---

### 1.2 순차 컴퓨팅 (Sequential Computing)

> **순차 컴퓨팅:** 프로그램을 구성하는 각 작업이 코드에 배치된 순서에서 자신보다 이전인 작업 실행에 의존하는 것

```java
public class SequentialComputing {

    public static void main(String[] args) {
        // 작업1: 데이터 준비
        int[] data = prepareData();

        // 작업2: 데이터 처리 (작업1의 결과 필요)
        int sum = processData(data);

        // 작업3: 결과 출력 (작업2의 결과 필요)
        printResult(sum);
    }

    static int[] prepareData() {
        System.out.println("작업1: 데이터 준비 중...");
        return new int[]{1, 2, 3, 4, 5};
    }

    static int processData(int[] data) {
        System.out.println("작업2: 데이터 처리 중...");
        int sum = 0;
        for (int num : data) {
            sum += num;
        }
        return sum;
    }

    static void printResult(int sum) {
        System.out.println("작업3: 결과 = " + sum);
    }
}
```

**실행 흐름:**

```
시간 →  [작업1]────→[작업2]────→[작업3]────→

각 작업은 이전 작업이 완료될 때까지 대기
```

---

### 1.3 순차 실행 (Sequential Execution)

> **순차 실행:** 순서를 가진 일련의 명령이 하나의 처리 단위에서 한 번에 하나씩 순서대로 실행되는 것

**특징:**
- 한 번에 하나의 명령만 실행
- 이전 명령이 완료되어야 다음 명령 실행
- 예측 가능하고 이해하기 쉬움

```java
import java.util.List;

public class SequentialExecution {

    static void processTask(int taskId) {
        System.out.println("작업 " + taskId + " 시작");
        try {
            Thread.sleep(1000);  // 1초 소요
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("작업 " + taskId + " 완료");
    }

    public static void main(String[] args) {
        long start = System.currentTimeMillis();

        List<Integer> tasks = List.of(1, 2, 3, 4, 5);

        // 순차 실행
        for (int taskId : tasks) {
            processTask(taskId);
        }

        long duration = System.currentTimeMillis() - start;
        System.out.println("\n총 소요시간: " + duration + "ms");
        // 출력: 약 5000ms (5초)
    }
}
```

**실행 결과:**

```
작업 1 시작
작업 1 완료
작업 2 시작
작업 2 완료
작업 3 시작
작업 3 완료
작업 4 시작
작업 4 완료
작업 5 시작
작업 5 완료

총 소요시간: 5000ms
```

---

### 1.4 순차 실행이 필수적인 경우

**각 작업을 실행하는 데 이전 작업의 출력이 필요한 경우, 순차 실행이 필수적이다.**

```java
public class DependentTasks {

    static int step1() {
        System.out.println("Step 1: 원본 데이터 생성");
        return 10;
    }

    static int step2(int input) {
        System.out.println("Step 2: 데이터 변환 (입력: " + input + ")");
        return input * 2;
    }

    static int step3(int input) {
        System.out.println("Step 3: 최종 처리 (입력: " + input + ")");
        return input + 5;
    }

    public static void main(String[] args) {
        // 각 단계가 이전 단계의 결과에 의존
        int result1 = step1();          // 10
        int result2 = step2(result1);   // 20
        int result3 = step3(result2);   // 25

        System.out.println("최종 결과: " + result3);
    }
}
```

**의존성 그래프:**

```
step1() → result1 → step2(result1) → result2 → step3(result2) → result3
   ↑                  ↑                           ↑
   필수 순서        의존 관계                   의존 관계
```

{{< callout type="warning" >}}
**데이터 의존성이 있는 작업은 병렬화할 수 없다.**
이전 작업의 결과가 필요한 경우 반드시 순차 실행해야 한다.
{{< /callout >}}

---

## 2. 병렬 실행

### 2.1 병렬 실행 (Parallel Execution)

> **병렬 실행:** 계산 여러 개가 동시에 실행되는 것

**조건:**
- 동시 실행되는 작업이 **서로 독립적**이어야 함
- 멀티 코어 또는 다중 프로세서 필요

```java
import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class ParallelExecution {

    static void processTask(int taskId) {
        System.out.println("작업 " + taskId + " 시작 (스레드: "
            + Thread.currentThread().getName() + ")");
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("작업 " + taskId + " 완료");
    }

    public static void main(String[] args) throws Exception {
        long start = System.currentTimeMillis();

        ExecutorService executor = Executors.newFixedThreadPool(5);
        List<Future<?>> futures = new ArrayList<>();

        // 병렬 실행
        for (int i = 1; i <= 5; i++) {
            final int taskId = i;
            futures.add(executor.submit(() -> processTask(taskId)));
        }

        // 모든 작업 완료 대기
        for (Future<?> future : futures) {
            future.get();
        }

        executor.shutdown();

        long duration = System.currentTimeMillis() - start;
        System.out.println("\n총 소요시간: " + duration + "ms");
        // 출력: 약 1000ms (1초)
    }
}
```

**실행 결과:**

```
작업 1 시작 (스레드: pool-1-thread-1)
작업 2 시작 (스레드: pool-1-thread-2)
작업 3 시작 (스레드: pool-1-thread-3)
작업 4 시작 (스레드: pool-1-thread-4)
작업 5 시작 (스레드: pool-1-thread-5)
작업 1 완료
작업 2 완료
작업 3 완료
작업 4 완료
작업 5 완료

총 소요시간: 1000ms
```

**시각적 비교:**

```
[순차 실행]
스레드:  [작업1][작업2][작업3][작업4][작업5]
시간:    0─────1─────2─────3─────4─────5초

[병렬 실행]
스레드1: [작업1]
스레드2: [작업2]
스레드3: [작업3]
스레드4: [작업4]
스레드5: [작업5]
시간:    0─────1초
```

---

### 2.2 병렬 컴퓨팅 (Parallel Computing)

> **병렬 컴퓨팅:** 여러 처리 요소가 동시에 하나의 문제를 해결하는 것

**병렬 컴퓨팅 적용 단계:**

1. **문제의 분해 (Decomposition)**
   - 전체 문제를 독립적인 하위 작업으로 분할

2. **알고리즘 개발과 적용**
   - 병렬로 실행 가능한 알고리즘 설계

3. **동기화 지점 추가**
   - 작업 간 조율이 필요한 지점 식별 및 구현

```java
import java.util.concurrent.*;
import java.util.stream.IntStream;

public class ParallelComputing {

    // 1억 개 숫자의 합계 계산
    static long sequentialSum(int[] numbers) {
        long sum = 0;
        for (int num : numbers) {
            sum += num;
        }
        return sum;
    }

    // 병렬 합계 계산 (분할 정복)
    static long parallelSum(int[] numbers) throws Exception {
        int cores = Runtime.getRuntime().availableProcessors();
        ExecutorService executor = Executors.newFixedThreadPool(cores);

        int chunkSize = numbers.length / cores;
        List<Future<Long>> futures = new ArrayList<>();

        // 1. 문제 분해: 데이터를 코어 수만큼 분할
        for (int i = 0; i < cores; i++) {
            final int start = i * chunkSize;
            final int end = (i == cores - 1) ? numbers.length : (i + 1) * chunkSize;

            // 2. 알고리즘 적용: 각 청크를 병렬로 처리
            futures.add(executor.submit(() -> {
                long partialSum = 0;
                for (int j = start; j < end; j++) {
                    partialSum += numbers[j];
                }
                return partialSum;
            }));
        }

        // 3. 동기화: 모든 부분 결과를 합산
        long totalSum = 0;
        for (Future<Long> future : futures) {
            totalSum += future.get();
        }

        executor.shutdown();
        return totalSum;
    }

    public static void main(String[] args) throws Exception {
        int size = 100_000_000;
        int[] numbers = IntStream.range(1, size + 1).toArray();

        System.out.println("데이터 크기: " + size + "개");
        System.out.println("사용 가능한 프로세서: "
            + Runtime.getRuntime().availableProcessors() + "개\n");

        // 순차 처리
        long start = System.currentTimeMillis();
        long seqSum = sequentialSum(numbers);
        long seqTime = System.currentTimeMillis() - start;
        System.out.println("순차 처리:");
        System.out.println("  합계: " + seqSum);
        System.out.println("  시간: " + seqTime + "ms\n");

        // 병렬 처리
        start = System.currentTimeMillis();
        long parSum = parallelSum(numbers);
        long parTime = System.currentTimeMillis() - start;
        System.out.println("병렬 처리:");
        System.out.println("  합계: " + parSum);
        System.out.println("  시간: " + parTime + "ms");
        System.out.println("  속도 향상: " + String.format("%.2f", (double)seqTime/parTime) + "배");
    }
}
```

**병렬 컴퓨팅의 과제:**

```
┌────────────────────────────────────────────────┐
│          병렬 컴퓨팅 설계 시 고려사항           │
├────────────────────────────────────────────────┤
│ 1. 작업 분할 오버헤드                          │
│    - 작업을 나누고 할당하는 비용               │
│                                                │
│ 2. 동기화 비용                                 │
│    - 작업 간 조율 및 결과 수집 비용            │
│                                                │
│ 3. 부하 불균형                                 │
│    - 일부 작업이 다른 작업보다 오래 걸림       │
│                                                │
│ 4. 통신 오버헤드                               │
│    - 스레드/프로세스 간 데이터 교환 비용       │
└────────────────────────────────────────────────┘
```

---

## 3. 동시성 vs 병렬성

### 3.1 핵심 차이점

> **동시성(Concurrency):** 작업 여러 개를 동시에 진행하는 것 (프로그램 설계)
>
> **병렬성(Parallelism):** 작업 여러 개를 실제로 동시에 실행하는 것 (실행 환경)

| 구분 | 동시성 (Concurrency) | 병렬성 (Parallelism) |
|:-----|:-------------------|:--------------------|
| **결정 요소** | 프로그래밍 언어, 프로그램 설계 | 실행 환경 (하드웨어) |
| **필요 조건** | 작업의 독립성 | 여러 처리 자원 + 작업의 독립성 |
| **하드웨어** | 단일 코어에서도 가능 | 멀티 코어/프로세서 필수 |
| **목적** | 응답성, 자원 효율성 | 처리 속도, 처리량 |
| **구현** | 비동기, 이벤트 루프, 스레드 | 멀티스레딩, 분산 시스템 |

---

### 3.2 시각적 비교

```
┌───────────────────────────────────────────────────────────────┐
│                    동시성 (Concurrency)                        │
│                     단일 코어에서 가능                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   시간축 →  |작업A|작업B|작업A|작업C|작업B|작업A|작업C|        │
│             컨텍스트 스위칭으로 빠르게 전환                    │
│                                                               │
│   효과: 사용자에게는 동시에 실행되는 것처럼 보임               │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    병렬성 (Parallelism)                        │
│                   멀티 코어에서만 가능                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   코어1:  |============= 작업A =============|                 │
│   코어2:  |============= 작업B =============|                 │
│   코어3:  |============= 작업C =============|                 │
│           실제로 동시에 실행됨                                │
│                                                               │
│   효과: 실제 실행 시간 단축                                   │
└───────────────────────────────────────────────────────────────┘
```

---

### 3.3 동시성과 병렬성의 관계

```java
import java.util.concurrent.*;

public class ConcurrencyVsParallelism {

    static void simulateWork(String taskName, int duration) {
        System.out.println(taskName + " 시작 ["
            + Thread.currentThread().getName() + "]");
        try {
            Thread.sleep(duration);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println(taskName + " 완료 ["
            + Thread.currentThread().getName() + "]");
    }

    public static void main(String[] args) throws Exception {
        System.out.println("사용 가능한 프로세서: "
            + Runtime.getRuntime().availableProcessors() + "개\n");

        // 동시성 프로그래밍 (설계)
        System.out.println("=== 동시성 프로그래밍 ===");
        System.out.println("스레드 풀 크기: 2개 (프로세서보다 적음)");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        long start = System.currentTimeMillis();

        Future<?> f1 = executor.submit(() -> simulateWork("작업A", 1000));
        Future<?> f2 = executor.submit(() -> simulateWork("작업B", 1000));
        Future<?> f3 = executor.submit(() -> simulateWork("작업C", 1000));
        Future<?> f4 = executor.submit(() -> simulateWork("작업D", 1000));

        f1.get(); f2.get(); f3.get(); f4.get();

        long concurrentTime = System.currentTimeMillis() - start;
        System.out.println("소요 시간: " + concurrentTime + "ms");
        System.out.println("→ 동시성은 있지만 병렬성은 제한적 (2개만 동시 실행)\n");

        // 병렬성 실현 (실행)
        System.out.println("=== 병렬 실행 ===");
        System.out.println("스레드 풀 크기: 4개 (충분한 병렬 처리)");

        executor = Executors.newFixedThreadPool(4);
        start = System.currentTimeMillis();

        f1 = executor.submit(() -> simulateWork("작업A", 1000));
        f2 = executor.submit(() -> simulateWork("작업B", 1000));
        f3 = executor.submit(() -> simulateWork("작업C", 1000));
        f4 = executor.submit(() -> simulateWork("작업D", 1000));

        f1.get(); f2.get(); f3.get(); f4.get();

        long parallelTime = System.currentTimeMillis() - start;
        System.out.println("소요 시간: " + parallelTime + "ms");
        System.out.println("→ 동시성 + 병렬성 모두 달성 (4개 동시 실행)");

        executor.shutdown();
    }
}
```

{{< callout type="info" >}}
**핵심 정리:**
- **동시성**은 프로그램을 어떻게 **설계**하느냐의 문제
- **병렬성**은 프로그램이 어떻게 **실행**되느냐의 문제
- 동시성 프로그래밍을 해도 실행 환경에 따라 병렬성이 달성되지 않을 수 있음
{{< /callout >}}

---

## 4. 암달의 법칙 (Amdahl's Law)

### 4.1 암달의 법칙이란?

> **암달의 법칙:** 프로그램의 병렬화 여부를 판단하는 의사 결정에서 병렬화를 통해 얻을 수 있는 이익이 어느 정도인지 가늠해볼 수 있는 도구

**공식:**

```
속도 향상 = 1 / [(1 - P) + (P / N)]

P: 병렬화 가능한 부분의 비율 (0 ~ 1)
N: 프로세서 수
```

---

### 4.2 암달의 법칙 시뮬레이션

```java
public class AmdahlsLaw {

    static double calculateSpeedup(double parallelPortion, int processors) {
        double serialPortion = 1 - parallelPortion;
        return 1.0 / (serialPortion + (parallelPortion / processors));
    }

    public static void main(String[] args) {
        System.out.println("=== 암달의 법칙: 병렬화 비율별 속도 향상 ===\n");

        int[] processorCounts = {2, 4, 8, 16, 32, 64};
        double[] parallelPortions = {0.5, 0.75, 0.9, 0.95, 0.99};

        System.out.printf("%-15s", "병렬화 비율");
        for (int p : processorCounts) {
            System.out.printf("%8s", p + "코어");
        }
        System.out.println("\n" + "-".repeat(70));

        for (double portion : parallelPortions) {
            System.out.printf("%-15s", (int)(portion * 100) + "%");
            for (int processors : processorCounts) {
                double speedup = calculateSpeedup(portion, processors);
                System.out.printf("%8.2fx", speedup);
            }
            System.out.println();
        }

        System.out.println("\n=== 병렬화 비율별 최대 속도 향상 (무한 코어) ===");
        for (double portion : parallelPortions) {
            double maxSpeedup = 1.0 / (1 - portion);
            System.out.printf("%d%% 병렬화 → 최대 %.2f배 향상\n",
                (int)(portion * 100), maxSpeedup);
        }
    }
}
```

**출력 결과:**

```
=== 암달의 법칙: 병렬화 비율별 속도 향상 ===

병렬화 비율       2코어    4코어    8코어   16코어   32코어   64코어
----------------------------------------------------------------------
50%             1.33x   1.60x   1.78x   1.88x   1.94x   1.97x
75%             1.60x   2.29x   2.91x   3.37x   3.64x   3.80x
90%             1.82x   3.08x   4.71x   6.40x   7.80x   8.71x
95%             1.90x   3.48x   5.93x   9.14x  12.31x  15.03x
99%             1.98x   3.88x   7.48x  13.91x  24.84x  44.93x

=== 병렬화 비율별 최대 속도 향상 (무한 코어) ===
50% 병렬화 → 최대 2.00배 향상
75% 병렬화 → 최대 4.00배 향상
90% 병렬화 → 최대 10.00배 향상
95% 병렬화 → 최대 20.00배 향상
99% 병렬화 → 최대 100.00배 향상
```

---

### 4.3 암달의 법칙의 시사점

**그래프로 보는 속도 향상:**

```
속도향상
   ↑
20x│                                        . (99%)
   │                                    .
15x│                                 .
   │                              .
10x│                           .      ──── (95%)
   │                        .
 5x│                     .        ────────── (90%)
   │                  .      ──────────────── (75%)
 2x│               . ───────────────────────── (50%)
   │            .
 1x└──────────────────────────────────────────→ 프로세서 수
    1   2   4   8  16  32  64  128  256  512
```

{{< callout type="warning" >}}
**암달의 법칙이 말하는 것:**
1. **순차 부분이 병목이 된다** - 10%만 순차적이어도 최대 10배까지만 빨라짐
2. **무한정 코어를 추가해도 속도 향상에는 한계가 있다**
3. **병렬화 비율을 높이는 것이 코어를 늘리는 것보다 중요하다**
{{< /callout >}}

---

### 4.4 실전 예제: 병렬화의 한계 체험

```java
import java.util.concurrent.*;
import java.util.stream.IntStream;

public class AmdahlsLawDemo {

    // 순차 부분 (병렬화 불가)
    static void serialWork(int duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // 병렬 가능 부분
    static int parallelWork(int start, int end) {
        return IntStream.range(start, end)
            .map(i -> i * i)
            .sum();
    }

    public static void main(String[] args) throws Exception {
        int serialDuration = 500;      // 순차 부분: 500ms
        int parallelWorkSize = 10000;  // 병렬 부분의 작업량

        System.out.println("=== 병렬화 비율: 50% ===");
        System.out.println("(순차 500ms + 병렬 500ms = 총 1000ms)\n");

        for (int threads : new int[]{1, 2, 4, 8}) {
            long start = System.currentTimeMillis();

            // 순차 부분 (병렬화 불가)
            serialWork(serialDuration);

            // 병렬 부분
            ExecutorService executor = Executors.newFixedThreadPool(threads);
            int chunkSize = parallelWorkSize / threads;

            Future<Integer>[] futures = new Future[threads];
            for (int i = 0; i < threads; i++) {
                final int chunkStart = i * chunkSize;
                final int chunkEnd = (i == threads - 1)
                    ? parallelWorkSize
                    : (i + 1) * chunkSize;

                futures[i] = executor.submit(() -> {
                    Thread.sleep(500 / threads);  // 병렬 처리 시뮬레이션
                    return parallelWork(chunkStart, chunkEnd);
                });
            }

            // 결과 수집
            int total = 0;
            for (Future<Integer> future : futures) {
                total += future.get();
            }

            executor.shutdown();

            long duration = System.currentTimeMillis() - start;
            double speedup = 1000.0 / duration;
            double theoretical = 1.0 / (0.5 + (0.5 / threads));

            System.out.printf("%d 스레드: %dms (%.2fx 향상, 이론값: %.2fx)\n",
                threads, duration, speedup, theoretical);
        }
    }
}
```

---

## 5. 구스타프슨의 법칙 (Gustafson's Law)

### 5.1 구스타프슨의 법칙이란?

> **구스타프슨의 법칙:** 문제의 크기를 증가시키면 암달의 법칙의 한계를 극복할 수 있다는 의미

**핵심 아이디어:**
- 프로세서가 많아지면 **더 큰 문제**를 풀 수 있다
- 문제 크기를 키우면 병렬 부분도 비례해서 증가
- 순차 부분의 비율이 상대적으로 감소

**공식:**

```
속도 향상 = N + (1 - N) × S

N: 프로세서 수
S: 순차 부분의 비율
```

---

### 5.2 암달 vs 구스타프슨

| 구분 | 암달의 법칙 | 구스타프슨의 법칙 |
|:-----|:----------|:----------------|
| **전제** | 문제 크기 고정 | 문제 크기 증가 |
| **관점** | 실행 시간 단축 | 처리량 증가 |
| **순차 부분** | 병목으로 작용 | 상대적으로 감소 |
| **적용 분야** | 고정된 작업의 최적화 | 빅데이터, 과학 계산 |

```
[암달의 법칙 - 고정된 문제 크기]
프로세서 1개:  [순차 10%][======= 병렬 90% =======]
프로세서 2개:  [순차 10%][== 병렬 45% ==]
프로세서 4개:  [순차 10%][병렬 22.5%]
→ 순차 부분이 병목

[구스타프슨의 법칙 - 증가하는 문제 크기]
프로세서 1개:  [순차 10%][======= 병렬 90% =======]
프로세서 2개:  [순차 10%][============ 병렬 180% ============]
프로세서 4개:  [순차 10%][==================== 병렬 360% ====================]
→ 병렬 부분이 증가하여 순차 부분의 영향 감소
```

---

### 5.3 실전 예제: 문제 크기 확장

```java
import java.util.concurrent.*;
import java.util.stream.LongStream;

public class GustafsonsLaw {

    static long calculateSum(long start, long end) {
        return LongStream.range(start, end).sum();
    }

    static void runExperiment(int processors, long problemSize) throws Exception {
        long serialWork = problemSize / 10;  // 10%는 순차
        long parallelWork = problemSize - serialWork;

        long startTime = System.currentTimeMillis();

        // 순차 부분
        long serialResult = calculateSum(0, serialWork);

        // 병렬 부분
        ExecutorService executor = Executors.newFixedThreadPool(processors);
        long chunkSize = parallelWork / processors;

        Future<Long>[] futures = new Future[processors];
        for (int i = 0; i < processors; i++) {
            final long chunkStart = serialWork + (i * chunkSize);
            final long chunkEnd = (i == processors - 1)
                ? problemSize
                : chunkStart + chunkSize;

            futures[i] = executor.submit(() -> calculateSum(chunkStart, chunkEnd));
        }

        long parallelResult = 0;
        for (Future<Long> future : futures) {
            parallelResult += future.get();
        }

        executor.shutdown();

        long duration = System.currentTimeMillis() - startTime;
        System.out.printf("프로세서 %d개, 문제크기 %,d: %dms\n",
            processors, problemSize, duration);
    }

    public static void main(String[] args) throws Exception {
        System.out.println("=== 구스타프슨의 법칙: 문제 크기 확장 ===\n");

        long baseProblemSize = 10_000_000L;

        for (int processors : new int[]{1, 2, 4, 8}) {
            // 프로세서 수에 비례하여 문제 크기 증가
            long scaledProblemSize = baseProblemSize * processors;
            runExperiment(processors, scaledProblemSize);
        }

        System.out.println("\n→ 프로세서를 늘리면서 문제 크기도 비례하여 증가");
        System.out.println("→ 실행 시간이 크게 증가하지 않음 (처리량 선형 증가)");
    }
}
```

---

## 6. 정리

### 핵심 개념 요약

| 개념 | 설명 | 핵심 포인트 |
|:-----|:-----|:----------|
| **순차 실행** | 한 번에 하나씩 순서대로 실행 | 예측 가능, 이해 쉬움 |
| **병렬 실행** | 여러 작업을 동시에 실행 | 독립성 필수, 성능 향상 |
| **동시성** | 프로그램 설계 관점 | 언어, 설계가 결정 |
| **병렬성** | 실행 환경 관점 | 하드웨어가 결정 |
| **암달의 법칙** | 고정 문제 크기에서의 한계 | 순차 부분이 병목 |
| **구스타프슨의 법칙** | 문제 크기 확장으로 한계 극복 | 처리량 증가 |

---

### 병렬 처리 적용 시 고려사항

```
┌────────────────────────────────────────────────────────────┐
│              병렬 처리를 적용해야 하는 경우                 │
├────────────────────────────────────────────────────────────┤
│ ✓ 작업들이 독립적이고 의존성이 없음                        │
│ ✓ 계산 집약적인 작업 (CPU-bound)                           │
│ ✓ 문제 크기가 충분히 큼 (오버헤드 상쇄 가능)               │
│ ✓ 멀티 코어 환경에서 실행                                  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              순차 처리가 더 적합한 경우                     │
├────────────────────────────────────────────────────────────┤
│ ✓ 작업 간 의존성이 높음                                    │
│ ✓ 문제 크기가 작음 (병렬화 오버헤드가 더 큼)               │
│ ✓ I/O 집약적인 작업 (디스크, 네트워크)                     │
│ ✓ 동기화 비용이 높음                                       │
└────────────────────────────────────────────────────────────┘
```

{{< callout type="info" >}}
**실전 조언:**
1. **측정하라**: 추측하지 말고 실제로 성능을 측정
2. **병렬화 비율을 높여라**: 코어 수를 늘리는 것보다 중요
3. **문제 크기를 고려하라**: 작은 문제는 병렬화 오버헤드가 더 클 수 있음
4. **프로파일링하라**: 어느 부분이 병목인지 파악
{{< /callout >}}

---

## 참고 자료

- "Grokking Concurrency" by Kirill Bobrov
- Amdahl, Gene M. (1967). "Validity of the single processor approach to achieving large scale computing capabilities"
- Gustafson, John L. (1988). "Reevaluating Amdahl's Law"
