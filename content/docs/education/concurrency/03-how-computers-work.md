---
title: "컴퓨터의 동작 원리"
weight: 3
---

# 컴퓨터의 동작 원리

프로그램의 실행은 하드웨어에 의존한다. 현대 컴퓨터 구조와 병렬 처리 장치의 특성을 이해하면 동시성 프로그래밍을 더 효과적으로 설계할 수 있다.

---

## 1. 하드웨어와 프로그램 실행

### 1.1 현대 컴퓨터의 처리 자원

> 현대 하드웨어는 여러 처리 자원을 갖추고 있으며, 이들은 실행하는 프로그램에 최적화된다.

**처리 자원의 종류:**

| 자원 유형 | 설명 | 병렬 처리 특성 |
|:---------|:-----|:-------------|
| **멀티코어** | 하나의 CPU 칩에 여러 코어 | 공유 메모리, 빠른 통신 |
| **멀티 프로세서** | 여러 개의 독립 CPU | 각자의 캐시, 메모리 접근 조율 필요 |
| **컴퓨터 클러스터** | 네트워크로 연결된 여러 컴퓨터 | 분산 처리, 네트워크 지연 |

```
┌──────────────────────────────────────────────────────────────────┐
│                        현대 컴퓨터 아키텍처                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ 컴퓨터1     │ │ 컴퓨터2     │ │ 컴퓨터3     │  ← 클러스터     │
│  │ ┌───┬───┐  │ │ ┌───┬───┐  │ │ ┌───┬───┐  │                 │
│  │ │CPU│CPU│  │ │ │CPU│CPU│  │ │ │CPU│CPU│  │  ← 멀티 프로세서 │
│  │ ├───┼───┤  │ │ ├───┼───┤  │ │ ├───┼───┤  │                 │
│  │ │C1 │C2 │  │ │ │C1 │C2 │  │ │ │C1 │C2 │  │  ← 멀티코어     │
│  │ │C3 │C4 │  │ │ │C3 │C4 │  │ │ │C3 │C4 │  │                 │
│  │ └───┴───┘  │ │ └───┴───┘  │ │ └───┴───┘  │                 │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                │
│         └───────────────┴───────────────┘                        │
│                  네트워크로 연결                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 계층별 병렬 처리 예제

```java
import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class ParallelismLevels {

    // 1. 멀티코어 활용: 단일 JVM 내 스레드 풀
    static void multiCoreExample() throws Exception {
        int cores = Runtime.getRuntime().availableProcessors();
        System.out.println("=== 멀티코어 병렬 처리 ===");
        System.out.println("사용 가능한 코어: " + cores + "개");

        ExecutorService executor = Executors.newFixedThreadPool(cores);
        List<Future<Long>> futures = new ArrayList<>();

        long start = System.currentTimeMillis();

        for (int i = 0; i < cores; i++) {
            final int coreId = i;
            futures.add(executor.submit(() -> {
                long sum = 0;
                for (int j = 0; j < 100_000_000; j++) {
                    sum += j;
                }
                System.out.println("코어 " + coreId + " 작업 완료");
                return sum;
            }));
        }

        long total = 0;
        for (Future<Long> future : futures) {
            total += future.get();
        }

        executor.shutdown();
        System.out.println("총 합계: " + total);
        System.out.println("소요 시간: " + (System.currentTimeMillis() - start) + "ms\n");
    }

    public static void main(String[] args) throws Exception {
        multiCoreExample();
    }
}
```

---

## 2. 플린 분류 (Flynn's Taxonomy)

### 2.1 플린 분류란?

> **플린 분류(Flynn's Taxonomy):** 시스템이 동시에 실행할 수 있는 **인스트럭션의 수(SI/MI)**와 **데이터 블록의 수(SD/MD)**를 기준으로 컴퓨터 구조를 네 가지로 분류하는 체계

**분류 기준:**
- **SI (Single Instruction)**: 한 번에 하나의 명령어 실행
- **MI (Multiple Instruction)**: 한 번에 여러 명령어 실행
- **SD (Single Data)**: 한 번에 하나의 데이터 처리
- **MD (Multiple Data)**: 한 번에 여러 데이터 처리

### 2.2 네 가지 분류

```
              │ Single Data (SD)  │ Multiple Data (MD)
──────────────┼───────────────────┼────────────────────
Single        │      SISD         │       SIMD
Instruction   │ 전통적인 단일CPU   │    벡터 프로세서
(SI)          │                   │       GPU
──────────────┼───────────────────┼────────────────────
Multiple      │      MISD         │       MIMD
Instruction   │    (거의 없음)     │   멀티코어/멀티CPU
(MI)          │   장애 허용 시스템  │    분산 시스템
```

| 분류 | 설명 | 예시 |
|:-----|:-----|:-----|
| **SISD** | 하나의 명령어가 하나의 데이터 처리 | 전통적인 단일 코어 CPU |
| **SIMD** | 하나의 명령어가 여러 데이터 동시 처리 | GPU, 벡터 프로세서 |
| **MISD** | 여러 명령어가 하나의 데이터 처리 | 장애 허용 시스템 (드묾) |
| **MIMD** | 여러 명령어가 여러 데이터 동시 처리 | 멀티코어, 분산 시스템 |

---

### 2.3 SISD (Single Instruction, Single Data)

> 한 번에 하나의 명령어로 하나의 데이터를 처리하는 전통적인 방식

```
┌─────────────────────────────────────────────────┐
│                    SISD                          │
├─────────────────────────────────────────────────┤
│                                                 │
│    명령어 ──→ ┌──────────┐                      │
│              │ 처리 장치 │ ──→ 결과             │
│    데이터 ──→ └──────────┘                      │
│                                                 │
│  시간: t1  │  t2  │  t3  │  t4  │              │
│       [A+1] [B+2] [C+3] [D+4]                   │
│       순차적으로 하나씩 처리                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Java 예제 - SISD 스타일의 순차 처리:**

```java
public class SISDExample {

    public static void main(String[] args) {
        int[] data = {1, 2, 3, 4, 5, 6, 7, 8};
        int[] result = new int[data.length];

        // SISD: 하나의 명령이 하나의 데이터를 순차 처리
        long start = System.nanoTime();

        for (int i = 0; i < data.length; i++) {
            result[i] = data[i] * 2;  // 하나씩 순차적으로 처리
        }

        long duration = System.nanoTime() - start;

        System.out.println("SISD 방식 (순차 처리):");
        System.out.print("결과: ");
        for (int r : result) {
            System.out.print(r + " ");
        }
        System.out.println("\n처리 시간: " + duration + "ns");
    }
}
```

---

### 2.4 SIMD (Single Instruction, Multiple Data)

> 하나의 명령어로 여러 데이터를 동시에 처리하는 방식. **GPU**가 대표적인 SIMD 구조이다.

```
┌─────────────────────────────────────────────────┐
│                    SIMD                          │
├─────────────────────────────────────────────────┤
│                                                 │
│              하나의 명령어                       │
│                   ↓                             │
│    데이터A ──→ ┌──────┐                         │
│    데이터B ──→ │ 처리 │ ──→ 결과A, 결과B, ...    │
│    데이터C ──→ │ 장치 │                         │
│    데이터D ──→ └──────┘                         │
│                                                 │
│  시간: t1                                       │
│       [A+1, B+1, C+1, D+1] 동시 처리            │
│       모든 데이터에 같은 연산 적용               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**GPU의 SIMD 특성:**

| 특성 | CPU | GPU |
|:-----|:----|:----|
| **코어 수** | 4~32개 | 수천 개 |
| **클록 속도** | 높음 (3~5 GHz) | 낮음 (1~2 GHz) |
| **명령어 처리** | 다양한 명령어 | 동일 명령어 동시 실행 |
| **최적 용도** | 복잡한 분기 처리 | 대규모 병렬 연산 |

**Java 예제 - SIMD 스타일의 병렬 스트림:**

```java
import java.util.Arrays;
import java.util.stream.IntStream;

public class SIMDExample {

    public static void main(String[] args) {
        int size = 10_000_000;
        int[] data = IntStream.range(0, size).toArray();

        // SISD 방식 (순차)
        long start = System.currentTimeMillis();
        int[] result1 = new int[size];
        for (int i = 0; i < size; i++) {
            result1[i] = data[i] * 2;
        }
        long sequentialTime = System.currentTimeMillis() - start;

        // SIMD 방식 (병렬 스트림 - 같은 연산을 모든 데이터에 적용)
        start = System.currentTimeMillis();
        int[] result2 = Arrays.stream(data)
            .parallel()               // 병렬 처리 활성화
            .map(x -> x * 2)          // 동일한 연산을 모든 요소에 적용
            .toArray();
        long parallelTime = System.currentTimeMillis() - start;

        System.out.println("SISD (순차): " + sequentialTime + "ms");
        System.out.println("SIMD 스타일 (병렬): " + parallelTime + "ms");
        System.out.println("속도 향상: " + String.format("%.2f",
            (double)sequentialTime / parallelTime) + "배");
    }
}
```

**SIMD가 효과적인 경우:**

```
┌────────────────────────────────────────────────────────────┐
│              SIMD에 적합한 작업                             │
├────────────────────────────────────────────────────────────┤
│ ✓ 이미지 처리 (모든 픽셀에 같은 필터 적용)                  │
│ ✓ 행렬 연산 (모든 요소에 같은 수학 연산)                    │
│ ✓ 물리 시뮬레이션 (모든 입자에 같은 물리 법칙)              │
│ ✓ 암호화/복호화 (모든 블록에 같은 변환)                     │
│ ✓ 머신러닝 (대규모 텐서 연산)                              │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              SIMD에 부적합한 작업                           │
├────────────────────────────────────────────────────────────┤
│ ✗ 조건 분기가 많은 로직                                    │
│ ✗ 데이터별로 다른 연산이 필요한 경우                        │
│ ✗ 순차적 의존성이 있는 작업                                │
└────────────────────────────────────────────────────────────┘
```

---

### 2.5 MIMD (Multiple Instruction, Multiple Data)

> 여러 명령어가 여러 데이터를 동시에 처리하는 방식. **멀티코어 프로세서**와 **분산 시스템**이 대표적이다.

```
┌─────────────────────────────────────────────────┐
│                    MIMD                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  명령어A ──→ ┌────────┐ ←── 데이터A             │
│             │ 코어 1 │ ──→ 결과A               │
│             └────────┘                          │
│  명령어B ──→ ┌────────┐ ←── 데이터B             │
│             │ 코어 2 │ ──→ 결과B               │
│             └────────┘                          │
│  명령어C ──→ ┌────────┐ ←── 데이터C             │
│             │ 코어 3 │ ──→ 결과C               │
│             └────────┘                          │
│                                                 │
│  각 코어가 독립적인 명령을 실행                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Java 예제 - MIMD 방식의 다양한 작업 병렬 처리:**

```java
import java.util.concurrent.*;

public class MIMDExample {

    // 각기 다른 작업을 수행하는 메서드들
    static int calculateSum(int n) {
        int sum = 0;
        for (int i = 1; i <= n; i++) {
            sum += i;
        }
        return sum;
    }

    static int calculateFactorial(int n) {
        int result = 1;
        for (int i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    static int calculateFibonacci(int n) {
        if (n <= 1) return n;
        int a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            int temp = a + b;
            a = b;
            b = temp;
        }
        return b;
    }

    static boolean isPrime(int n) {
        if (n < 2) return false;
        for (int i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(4);

        System.out.println("=== MIMD: 각 코어가 다른 작업 수행 ===\n");

        // 4개의 다른 작업을 4개의 코어에서 동시 실행
        Future<Integer> sumFuture = executor.submit(() -> {
            System.out.println("코어1: 1~10000 합계 계산 중...");
            return calculateSum(10000);
        });

        Future<Integer> factorialFuture = executor.submit(() -> {
            System.out.println("코어2: 12! 계산 중...");
            return calculateFactorial(12);
        });

        Future<Integer> fibFuture = executor.submit(() -> {
            System.out.println("코어3: 피보나치(40) 계산 중...");
            return calculateFibonacci(40);
        });

        Future<Boolean> primeFuture = executor.submit(() -> {
            System.out.println("코어4: 104729 소수 판별 중...");
            return isPrime(104729);
        });

        // 결과 수집
        System.out.println("\n=== 결과 ===");
        System.out.println("합계(1~10000): " + sumFuture.get());
        System.out.println("12!: " + factorialFuture.get());
        System.out.println("피보나치(40): " + fibFuture.get());
        System.out.println("104729는 소수? " + primeFuture.get());

        executor.shutdown();
    }
}
```

**SIMD vs MIMD 비교:**

```
┌──────────────────────────────────────────────────────────────┐
│                    SIMD vs MIMD 비교                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SIMD (GPU 스타일)              MIMD (멀티코어 CPU 스타일)    │
│  ─────────────────              ──────────────────────────   │
│                                                              │
│  명령어: x * 2                  코어1: sum()                 │
│           ↓                     코어2: factorial()           │
│  ┌───┬───┬───┬───┐             코어3: fibonacci()           │
│  │ 1 │ 2 │ 3 │ 4 │             코어4: isPrime()             │
│  └───┴───┴───┴───┘                    ↓                     │
│           ↓                     각자 다른 작업               │
│  ┌───┬───┬───┬───┐                                          │
│  │ 2 │ 4 │ 6 │ 8 │                                          │
│  └───┴───┴───┴───┘                                          │
│  같은 연산, 다른 데이터         다른 연산, 다른 데이터         │
│                                                              │
│  장점: 대량 데이터 처리         장점: 다양한 작업 병렬화       │
│  단점: 동일 연산만 가능         단점: 코어 수 제한             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. CPU와 GPU

### 3.1 CPU와 GPU의 차이

> **CPU**는 클록 속도가 빠르고 다양한 명령을 실행할 수 있다. **GPU**는 비교적 느린 클록 속도로 모든 코어에서 동일한 명령만 실행하지만, 대규모 병렬성으로 특정 작업에서는 훨씬 빠르다.

**비교표:**

| 특성 | CPU | GPU |
|:-----|:----|:----|
| **코어 수** | 4~64개 | 수천 개 |
| **클록 속도** | 3~5 GHz | 1~2 GHz |
| **코어당 성능** | 높음 | 낮음 |
| **명령어 다양성** | 복잡한 분기 처리 가능 | 단순 연산에 최적화 |
| **메모리 접근** | 큰 캐시, 낮은 지연 | 높은 대역폭, 높은 지연 |
| **최적 용도** | 일반 연산, 복잡한 로직 | 대규모 병렬 연산 |

```
┌────────────────────────────────────────────────────────────────┐
│                    CPU vs GPU 아키텍처                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CPU (소수의 강력한 코어)           GPU (다수의 간단한 코어)     │
│  ┌───────────────────┐            ┌──────────────────────┐     │
│  │ ┌───────┐ ┌─────┐ │            │ ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐  │     │
│  │ │ 코어1 │ │캐시 │ │            │ ├─┤├─┤├─┤├─┤├─┤├─┤  │     │
│  │ │(복잡) │ │(대)  │ │            │ ├─┤├─┤├─┤├─┤├─┤├─┤  │     │
│  │ └───────┘ └─────┘ │            │ ├─┤├─┤├─┤├─┤├─┤├─┤  │     │
│  │ ┌───────┐         │            │ ├─┤├─┤├─┤├─┤├─┤├─┤  │     │
│  │ │ 코어2 │ 제어    │            │ └─┘└─┘└─┘└─┘└─┘└─┘  │     │
│  │ │(복잡) │ 유닛    │            │ 수천 개의 작은 코어     │     │
│  │ └───────┘         │            │                      │     │
│  └───────────────────┘            └──────────────────────┘     │
│                                                                │
│  용도: 다양한 복잡한 작업          용도: 동일 연산 대량 처리    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 작업에 맞는 처리 장치 선택

```java
public class CPUvsGPUWorkloads {

    public static void main(String[] args) {
        System.out.println("=== 작업 유형별 최적 처리 장치 ===\n");

        // CPU에 적합한 작업 예시
        System.out.println("[CPU에 적합한 작업]");
        System.out.println("- 복잡한 조건 분기가 많은 비즈니스 로직");
        System.out.println("- 순차적 의존성이 있는 작업");
        System.out.println("- 운영체제, 웹 서버, 데이터베이스");

        cpuOptimalWork();

        // GPU에 적합한 작업 예시
        System.out.println("\n[GPU에 적합한 작업]");
        System.out.println("- 대규모 행렬 연산 (머신러닝)");
        System.out.println("- 이미지/비디오 처리");
        System.out.println("- 물리 시뮬레이션");

        gpuStyleWork();
    }

    // CPU에 적합: 복잡한 분기 처리
    static void cpuOptimalWork() {
        System.out.println("\n예제: 복잡한 분기 처리");

        int[] data = {15, 8, 23, 4, 16, 42, 7, 11};

        for (int num : data) {
            String result;

            // 복잡한 조건 분기 - CPU가 더 효율적
            if (num < 10) {
                result = num + " → 작은 수: " + (num * 2);
            } else if (num < 20) {
                result = num + " → 중간 수: " + (num + 100);
            } else if (num % 2 == 0) {
                result = num + " → 큰 짝수: " + (num / 2);
            } else {
                result = num + " → 큰 홀수: " + (num * 3 + 1);
            }

            System.out.println("  " + result);
        }
    }

    // GPU에 적합: 동일 연산 대량 처리
    static void gpuStyleWork() {
        System.out.println("\n예제: 동일 연산 대량 처리 (행렬 곱셈)");

        int size = 3;
        int[][] matrixA = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        int[][] matrixB = {{9, 8, 7}, {6, 5, 4}, {3, 2, 1}};
        int[][] result = new int[size][size];

        // 모든 원소에 동일한 연산 적용 - GPU가 더 효율적
        for (int i = 0; i < size; i++) {
            for (int j = 0; j < size; j++) {
                for (int k = 0; k < size; k++) {
                    result[i][j] += matrixA[i][k] * matrixB[k][j];
                }
            }
        }

        System.out.println("  결과 행렬:");
        for (int[] row : result) {
            System.out.print("  ");
            for (int val : row) {
                System.out.printf("%4d", val);
            }
            System.out.println();
        }
    }
}
```

---

## 4. 런타임 시스템

### 4.1 런타임 시스템이란?

> **런타임 시스템(Runtime System):** 애플리케이션과 하드웨어 사이의 **추상화 계층**. 프로그래머가 하드웨어를 직접 다루지 않고도 프로그램을 작성할 수 있게 해준다.

```
┌─────────────────────────────────────────────────────────────┐
│                      시스템 구조                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              애플리케이션 (Java 코드)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              런타임 시스템 (JVM)                      │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌───────────────┐  │   │
│  │  │ 스레드 관리 │ │ 메모리 관리   │ │ 가비지 컬렉션  │  │   │
│  │  └────────────┘ └──────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              운영체제 (OS)                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │   │
│  │  │ 프로세스 관리 │ │ 스케줄링     │ │ 시스템 호출  │  │   │
│  │  └──────────────┘ └──────────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              하드웨어 (CPU, 메모리, 디스크)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 JVM의 역할

**Java에서의 런타임 시스템 = JVM (Java Virtual Machine)**

| JVM 기능 | 설명 | 병렬 처리 관련 |
|:--------|:-----|:-------------|
| **스레드 관리** | Java 스레드를 OS 스레드에 매핑 | 멀티코어 활용 가능 |
| **메모리 관리** | 힙 메모리 할당 및 관리 | 스레드 간 메모리 공유 |
| **JIT 컴파일** | 바이트코드를 네이티브 코드로 변환 | 성능 최적화 |
| **가비지 컬렉션** | 사용하지 않는 메모리 자동 회수 | STW(Stop-The-World) 고려 필요 |

```java
public class RuntimeSystemInfo {

    public static void main(String[] args) {
        Runtime runtime = Runtime.getRuntime();

        System.out.println("=== JVM 런타임 정보 ===\n");

        // 프로세서 정보
        System.out.println("[프로세서]");
        System.out.println("  사용 가능한 프로세서: " + runtime.availableProcessors() + "개");

        // 메모리 정보
        System.out.println("\n[메모리]");
        System.out.println("  최대 메모리: " + toMB(runtime.maxMemory()) + " MB");
        System.out.println("  할당된 메모리: " + toMB(runtime.totalMemory()) + " MB");
        System.out.println("  사용 가능한 메모리: " + toMB(runtime.freeMemory()) + " MB");

        // 시스템 속성
        System.out.println("\n[시스템]");
        System.out.println("  OS: " + System.getProperty("os.name"));
        System.out.println("  아키텍처: " + System.getProperty("os.arch"));
        System.out.println("  Java 버전: " + System.getProperty("java.version"));

        // 스레드 정보
        System.out.println("\n[스레드]");
        System.out.println("  현재 스레드: " + Thread.currentThread().getName());
        System.out.println("  활성 스레드 수: " + Thread.activeCount());
    }

    static long toMB(long bytes) {
        return bytes / (1024 * 1024);
    }
}
```

### 4.3 런타임 시스템이 제공하는 추상화

```java
import java.util.concurrent.*;

public class RuntimeAbstraction {

    public static void main(String[] args) throws Exception {
        System.out.println("=== 런타임 시스템의 추상화 ===\n");

        // 1. 스레드 추상화: 프로그래머는 Thread 객체만 다룸
        System.out.println("[1] 스레드 추상화");
        System.out.println("    코드: new Thread(() -> work()).start()");
        System.out.println("    실제: JVM이 OS 스레드 생성, CPU 코어에 할당");

        Thread thread = new Thread(() -> {
            System.out.println("    → 실행 중: " + Thread.currentThread().getName());
        });
        thread.start();
        thread.join();

        // 2. 메모리 추상화: 객체 생성만 하면 됨
        System.out.println("\n[2] 메모리 추상화");
        System.out.println("    코드: new int[1000]");
        System.out.println("    실제: JVM이 힙에서 메모리 할당, 정렬, 초기화");

        int[] array = new int[1000];
        System.out.println("    → 배열 생성 완료 (자동 0으로 초기화)");

        // 3. 동기화 추상화: synchronized 키워드만 사용
        System.out.println("\n[3] 동기화 추상화");
        System.out.println("    코드: synchronized(lock) { ... }");
        System.out.println("    실제: JVM이 모니터 락, 메모리 배리어 처리");

        Object lock = new Object();
        synchronized (lock) {
            System.out.println("    → 임계 영역 실행 중");
        }

        // 4. 스레드 풀 추상화
        System.out.println("\n[4] 스레드 풀 추상화");
        System.out.println("    코드: ExecutorService executor = ...");
        System.out.println("    실제: 스레드 재사용, 작업 큐 관리, 생명주기 관리");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        executor.submit(() -> System.out.println("    → 작업 실행"));
        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.SECONDS);
    }
}
```

---

## 5. 병렬 처리에 적합한 장치 선택

### 5.1 문제 유형별 최적 장치

> 병렬 실행의 이점을 살리려면 해결하려는 문제에 **적합한 처리 장치**를 선택해야 한다.

```
┌────────────────────────────────────────────────────────────────┐
│                  문제 유형별 처리 장치 선택                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  문제 유형             최적 장치      이유                      │
│  ─────────            ──────────    ─────                      │
│                                                                │
│  웹 서버              CPU           다양한 요청 처리, 분기 많음  │
│  데이터베이스         CPU           복잡한 쿼리, 트랜잭션 관리   │
│  머신러닝 훈련        GPU           대규모 행렬 연산             │
│  비디오 인코딩        GPU           픽셀 단위 병렬 처리          │
│  게임 물리 엔진       GPU           수천 개 객체 동시 계산       │
│  비즈니스 로직        CPU           복잡한 조건 분기             │
│  이미지 필터          GPU           모든 픽셀에 동일 연산        │
│  암호화               CPU/GPU       알고리즘에 따라 다름         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 하이브리드 접근법

```java
import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class HybridProcessing {

    public static void main(String[] args) throws Exception {
        System.out.println("=== 하이브리드 처리: CPU + 병렬 스트림 ===\n");

        // 시나리오: 이미지 처리 파이프라인
        // 1. 파일 읽기 (I/O, 순차)
        // 2. 이미지 변환 (계산, 병렬 가능)
        // 3. 메타데이터 추출 (분기, CPU)
        // 4. 결과 저장 (I/O, 순차)

        List<String> images = List.of(
            "image1.jpg", "image2.jpg", "image3.jpg",
            "image4.jpg", "image5.jpg", "image6.jpg"
        );

        long start = System.currentTimeMillis();

        // CPU 작업: 복잡한 로직 (메인 스레드)
        System.out.println("1. 설정 로드 및 검증 (CPU)");
        Thread.sleep(100);  // 설정 로드 시뮬레이션

        // 병렬 작업: 이미지 변환 (GPU 스타일 - 동일 연산)
        System.out.println("2. 이미지 병렬 변환");
        List<String> processed = images.parallelStream()
            .map(img -> {
                // 모든 이미지에 동일한 변환 적용
                try {
                    Thread.sleep(200);  // 이미지 처리 시뮬레이션
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                System.out.println("   → " + img + " 처리 완료 ["
                    + Thread.currentThread().getName() + "]");
                return img.replace(".jpg", "_processed.jpg");
            })
            .toList();

        // CPU 작업: 결과 분석
        System.out.println("3. 결과 분석 (CPU)");
        int successCount = 0;
        for (String result : processed) {
            if (result.contains("processed")) {
                successCount++;
            }
        }

        long duration = System.currentTimeMillis() - start;

        System.out.println("\n=== 결과 ===");
        System.out.println("처리된 이미지: " + successCount + "/" + images.size());
        System.out.println("총 소요 시간: " + duration + "ms");
        System.out.println("(순차 처리 시 예상: " + (100 + 200 * images.size()) + "ms)");
    }
}
```

---

## 6. 정리

### 핵심 개념 요약

| 개념 | 설명 | 핵심 포인트 |
|:-----|:-----|:----------|
| **플린 분류** | 명령어/데이터 수 기준 분류 | SISD, SIMD, MISD, MIMD |
| **SIMD** | 하나의 명령, 여러 데이터 | GPU, 벡터 연산에 적합 |
| **MIMD** | 여러 명령, 여러 데이터 | 멀티코어 CPU, 범용적 |
| **CPU vs GPU** | 복잡성 vs 병렬성 | 작업 특성에 맞게 선택 |
| **런타임 시스템** | 하드웨어 추상화 계층 | JVM이 스레드/메모리 관리 |

### 처리 장치 선택 가이드

```
┌────────────────────────────────────────────────────────────────┐
│                    처리 장치 선택 기준                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CPU를 선택하세요:                                             │
│  ├── 분기 로직이 복잡할 때                                     │
│  ├── 작업 간 의존성이 있을 때                                  │
│  ├── 순차적 처리가 필요할 때                                   │
│  └── 다양한 종류의 작업을 처리할 때                            │
│                                                                │
│  GPU (또는 SIMD 스타일)를 선택하세요:                          │
│  ├── 대량의 데이터에 동일 연산 적용할 때                       │
│  ├── 행렬/벡터 연산이 많을 때                                  │
│  ├── 데이터 간 의존성이 없을 때                                │
│  └── 높은 처리량이 필요할 때                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

{{< callout type="info" >}}
**핵심 정리:**
1. **플린 분류**를 이해하면 하드웨어 특성을 파악할 수 있다
2. **SIMD**(GPU)는 동일 연산의 대규모 병렬 처리에 최적화
3. **MIMD**(멀티코어 CPU)는 다양한 작업의 병렬 처리에 적합
4. **런타임 시스템**이 하드웨어 복잡성을 추상화해준다
5. 문제에 맞는 **적절한 처리 장치 선택**이 성능의 핵심
{{< /callout >}}

---

## 참고 자료

- "Grokking Concurrency" by Kirill Bobrov
- Flynn, M.J. (1972). "Some Computer Organizations and Their Effectiveness"
- NVIDIA CUDA Programming Guide
