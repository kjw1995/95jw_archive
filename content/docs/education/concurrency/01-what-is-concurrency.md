---
title: "동시성이란 무엇인가"
weight: 1
---

# 동시성이란 무엇인가

## 1. 동시 시스템의 정의

> 동시 시스템이란 여러 일을 동시에 처리하는 시스템을 말한다.

### 순차 처리 vs 동시 처리

**순차 처리 (Sequential Processing)**
```
작업A 시작 → 작업A 완료 → 작업B 시작 → 작업B 완료 → 작업C 시작 → 작업C 완료
[========10초========][========10초========][========10초========]
총 소요시간: 30초
```

**동시 처리 (Concurrent Processing)**
```
작업A 시작 ─────────→ 작업A 완료
작업B 시작 ─────────→ 작업B 완료
작업C 시작 ─────────→ 작업C 완료
[=============10초=============]
총 소요시간: 10초
```

### 예제: 순차 처리 vs 동시 처리

```java
import java.util.concurrent.*;

public class SequentialVsConcurrent {

    // 시간이 걸리는 작업을 시뮬레이션
    static String fetchDataFromServer(String server) {
        try {
            Thread.sleep(1000); // 1초 대기 (네트워크 지연 시뮬레이션)
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return server + "로부터 데이터 수신 완료";
    }

    // 순차 처리 방식
    static void sequentialApproach() {
        long start = System.currentTimeMillis();

        String result1 = fetchDataFromServer("서버A");
        String result2 = fetchDataFromServer("서버B");
        String result3 = fetchDataFromServer("서버C");

        long end = System.currentTimeMillis();
        System.out.println("순차 처리 소요시간: " + (end - start) + "ms");
        // 출력: 순차 처리 소요시간: 3000ms (약 3초)
    }

    // 동시 처리 방식
    static void concurrentApproach() throws Exception {
        long start = System.currentTimeMillis();

        ExecutorService executor = Executors.newFixedThreadPool(3);

        Future<String> future1 = executor.submit(() -> fetchDataFromServer("서버A"));
        Future<String> future2 = executor.submit(() -> fetchDataFromServer("서버B"));
        Future<String> future3 = executor.submit(() -> fetchDataFromServer("서버C"));

        // 모든 결과 수집
        String result1 = future1.get();
        String result2 = future2.get();
        String result3 = future3.get();

        executor.shutdown();

        long end = System.currentTimeMillis();
        System.out.println("동시 처리 소요시간: " + (end - start) + "ms");
        // 출력: 동시 처리 소요시간: 1000ms (약 1초)
    }

    public static void main(String[] args) throws Exception {
        sequentialApproach();
        concurrentApproach();
    }
}
```

### 동시성(Concurrency) vs 병렬성(Parallelism)

| 구분 | 동시성 (Concurrency) | 병렬성 (Parallelism) |
|------|---------------------|---------------------|
| 정의 | 여러 작업을 번갈아가며 처리 | 여러 작업을 실제로 동시에 처리 |
| 하드웨어 | 단일 코어에서도 가능 | 멀티 코어 필수 |
| 비유 | 한 사람이 여러 일을 번갈아 처리 | 여러 사람이 각자 일을 처리 |
| 목적 | 응답성 향상, 자원 효율화 | 처리량 극대화 |

```
[동시성 - 단일 코어]
시간 →  |작업A|작업B|작업A|작업C|작업B|작업A|작업C|
        컨텍스트 스위칭으로 번갈아 실행

[병렬성 - 멀티 코어]
코어1:  |========= 작업A =========|
코어2:  |========= 작업B =========|
코어3:  |========= 작업C =========|
        실제로 동시에 실행
```

---

## 2. 동시성의 필요성: 현실 세계 모델링

> 현실 세계에서는 여러 일이 동시에 일어난다. 이러한 현실 세계를 모델링하려면 동시성 프로그래밍이 필요하다.

### 현실 세계의 동시성 예시

| 현실 세계 상황 | 프로그래밍 모델링 |
|---------------|------------------|
| 은행에서 여러 고객이 동시에 ATM 사용 | 다중 스레드로 각 고객 요청 처리 |
| 식당에서 여러 테이블 주문을 동시 처리 | 비동기 이벤트 처리 |
| 공장에서 여러 기계가 동시에 작동 | 병렬 작업 스케줄링 |
| 채팅방에서 여러 사용자가 동시에 메시지 전송 | 이벤트 기반 동시 처리 |

### 예제: 은행 ATM 시스템

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class BankATMSimulation {

    // 은행 계좌 (동시 접근 가능)
    static class BankAccount {
        private final String accountId;
        private final AtomicInteger balance;  // 스레드 안전한 잔액

        public BankAccount(String accountId, int initialBalance) {
            this.accountId = accountId;
            this.balance = new AtomicInteger(initialBalance);
        }

        public boolean withdraw(int amount) {
            int current = balance.get();
            if (current >= amount) {
                balance.addAndGet(-amount);
                return true;
            }
            return false;
        }

        public void deposit(int amount) {
            balance.addAndGet(amount);
        }

        public int getBalance() {
            return balance.get();
        }
    }

    // ATM 기기 시뮬레이션
    static class ATM implements Runnable {
        private final String atmId;
        private final BankAccount account;
        private final int operationCount;

        public ATM(String atmId, BankAccount account, int operationCount) {
            this.atmId = atmId;
            this.account = account;
            this.operationCount = operationCount;
        }

        @Override
        public void run() {
            for (int i = 0; i < operationCount; i++) {
                if (Math.random() > 0.5) {
                    account.deposit(100);
                    System.out.println(atmId + ": 100원 입금 완료. 잔액: " + account.getBalance());
                } else {
                    boolean success = account.withdraw(100);
                    if (success) {
                        System.out.println(atmId + ": 100원 출금 완료. 잔액: " + account.getBalance());
                    } else {
                        System.out.println(atmId + ": 잔액 부족으로 출금 실패");
                    }
                }

                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }

    public static void main(String[] args) throws InterruptedException {
        BankAccount sharedAccount = new BankAccount("ACC-001", 1000);

        // 3개의 ATM이 동시에 같은 계좌에 접근
        Thread atm1 = new Thread(new ATM("ATM-1", sharedAccount, 5));
        Thread atm2 = new Thread(new ATM("ATM-2", sharedAccount, 5));
        Thread atm3 = new Thread(new ATM("ATM-3", sharedAccount, 5));

        atm1.start();
        atm2.start();
        atm3.start();

        atm1.join();
        atm2.join();
        atm3.join();

        System.out.println("최종 잔액: " + sharedAccount.getBalance());
    }
}
```

---

## 3. 동시성의 장점

> 동시성을 적용하면 지연 시간을 드러나지 않게 하고, 기존 처리 자원의 활용도를 높여 시스템의 성능과 처리율을 크게 개선할 수 있다.

### 3.1 지연 시간(Latency) 숨기기

I/O 작업 중 CPU가 놀고 있을 때 다른 작업을 수행하여 대기 시간을 활용한다.

```
[동시성 없음 - 지연 시간 노출]
시간 →  |CPU작업|---I/O 대기---|CPU작업|---I/O 대기---|
        CPU가 I/O 대기 동안 유휴 상태

[동시성 적용 - 지연 시간 숨김]
작업1:  |CPU|---I/O 대기---|CPU작업|
작업2:      |CPU|---I/O 대기---|CPU작업|
작업3:          |CPU|---I/O 대기---|
        I/O 대기 중에 다른 작업의 CPU 처리 수행
```

### 예제: I/O 대기 시간 활용

```java
import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class LatencyHiding {

    static String readFile(String filename) {
        System.out.println(Thread.currentThread().getName() + ": " + filename + " 읽기 시작");
        try {
            Thread.sleep(500);  // I/O 대기 시뮬레이션
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println(Thread.currentThread().getName() + ": " + filename + " 읽기 완료");
        return filename + " 내용";
    }

    static String processData(String data) {
        return data.toUpperCase() + " [처리됨]";
    }

    public static void main(String[] args) throws Exception {
        List<String> files = List.of("file1.txt", "file2.txt", "file3.txt",
                                      "file4.txt", "file5.txt");

        // 순차 처리
        long start = System.currentTimeMillis();
        List<String> results1 = new ArrayList<>();
        for (String file : files) {
            String content = readFile(file);
            results1.add(processData(content));
        }
        System.out.println("순차 처리 시간: " + (System.currentTimeMillis() - start) + "ms\n");

        // 동시 처리
        ExecutorService executor = Executors.newFixedThreadPool(5);
        start = System.currentTimeMillis();

        List<Future<String>> futures = new ArrayList<>();
        for (String file : files) {
            futures.add(executor.submit(() -> {
                String content = readFile(file);
                return processData(content);
            }));
        }

        List<String> results2 = new ArrayList<>();
        for (Future<String> future : futures) {
            results2.add(future.get());
        }

        executor.shutdown();
        System.out.println("동시 처리 시간: " + (System.currentTimeMillis() - start) + "ms");
        // 순차: 약 2500ms, 동시: 약 500ms
    }
}
```

### 3.2 처리율(Throughput) 개선

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class ThroughputImprovement {

    static AtomicInteger processedCount = new AtomicInteger(0);

    static void handleRequest(int requestId) {
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        processedCount.incrementAndGet();
    }

    public static void main(String[] args) throws Exception {
        int totalRequests = 100;

        // 단일 스레드 처리
        processedCount.set(0);
        long start = System.currentTimeMillis();

        for (int i = 0; i < totalRequests; i++) {
            handleRequest(i);
        }

        long singleThreadTime = System.currentTimeMillis() - start;
        double singleThreadThroughput = (double) totalRequests / singleThreadTime * 1000;
        System.out.println("단일 스레드:");
        System.out.println("  처리 시간: " + singleThreadTime + "ms");
        System.out.println("  처리율: " + String.format("%.1f", singleThreadThroughput) + " 요청/초\n");

        // 멀티 스레드 처리
        processedCount.set(0);
        ExecutorService executor = Executors.newFixedThreadPool(10);
        start = System.currentTimeMillis();

        for (int i = 0; i < totalRequests; i++) {
            final int requestId = i;
            executor.submit(() -> handleRequest(requestId));
        }

        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.MINUTES);

        long multiThreadTime = System.currentTimeMillis() - start;
        double multiThreadThroughput = (double) totalRequests / multiThreadTime * 1000;
        System.out.println("멀티 스레드 (10개):");
        System.out.println("  처리 시간: " + multiThreadTime + "ms");
        System.out.println("  처리율: " + String.format("%.1f", multiThreadThroughput) + " 요청/초");
        System.out.println("  성능 향상: " + String.format("%.1f", (double)singleThreadTime/multiThreadTime) + "배");
    }
}
```

### 3.3 자원 활용도 향상

```
[CPU 사용률 비교]

순차 처리:
CPU 사용률: ████░░░░░░░░░░░░░░░░ 20%
           (대부분 I/O 대기)

동시 처리:
CPU 사용률: ████████████████░░░░ 80%
           (I/O 대기 중 다른 작업 수행)
```

---

## 4. 확장성: 수직 확장 vs 수평 확장

> 확장성은 수직 확장성과 수평 확장성으로 나뉜다.

### 비교 표

| 특성 | 수직 확장 (Scale Up) | 수평 확장 (Scale Out) |
|------|---------------------|----------------------|
| 방법 | 단일 서버 성능 향상 | 서버 수 증가 |
| 예시 | CPU/RAM 업그레이드 | 서버 추가 |
| 한계 | 하드웨어 물리적 한계 | 이론적으로 무한 확장 가능 |
| 비용 | 고성능일수록 기하급수적 증가 | 선형적 증가 |
| 복잡도 | 낮음 (코드 변경 불필요) | 높음 (분산 시스템 설계 필요) |
| 가용성 | 단일 장애점 존재 | 장애 허용 가능 |

### 시각적 비교

```
[수직 확장 - Scale Up]

Before:         After:
┌─────────┐     ┌─────────────────┐
│ Server  │     │   BIG Server    │
│ 4 CPU   │ →   │   16 CPU        │
│ 8GB RAM │     │   64GB RAM      │
└─────────┘     └─────────────────┘
처리량: 100/s   처리량: 400/s


[수평 확장 - Scale Out]

Before:              After:
┌─────────┐          ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Server  │          │ Server  │ │ Server  │ │ Server  │ │ Server  │
│ 4 CPU   │    →     │ 4 CPU   │ │ 4 CPU   │ │ 4 CPU   │ │ 4 CPU   │
└─────────┘          └─────────┘ └─────────┘ └─────────┘ └─────────┘
처리량: 100/s        처리량: 400/s (이론상)
```

### 예제: 수평 확장을 위한 Stateless 설계

```java
import java.util.concurrent.*;
import java.util.*;

public class HorizontalScalingExample {

    // Stateless 작업 처리기
    static class StatelessWorker {
        private final String workerId;

        public StatelessWorker(String workerId) {
            this.workerId = workerId;
        }

        public int processTask(int input) {
            System.out.println(workerId + ": 작업 처리 중 - 입력값: " + input);
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return input * 2;
        }
    }

    // 간단한 로드 밸런서
    static class LoadBalancer {
        private final List<StatelessWorker> workers;
        private int currentIndex = 0;

        public LoadBalancer(List<StatelessWorker> workers) {
            this.workers = workers;
        }

        public synchronized StatelessWorker getNextWorker() {
            StatelessWorker worker = workers.get(currentIndex);
            currentIndex = (currentIndex + 1) % workers.size();
            return worker;
        }
    }

    public static void main(String[] args) throws Exception {
        List<StatelessWorker> workers = List.of(
            new StatelessWorker("Worker-1"),
            new StatelessWorker("Worker-2"),
            new StatelessWorker("Worker-3")
        );

        LoadBalancer loadBalancer = new LoadBalancer(workers);
        ExecutorService executor = Executors.newFixedThreadPool(3);

        List<Future<Integer>> futures = new ArrayList<>();

        for (int i = 1; i <= 9; i++) {
            final int taskInput = i;
            final StatelessWorker worker = loadBalancer.getNextWorker();
            futures.add(executor.submit(() -> worker.processTask(taskInput)));
        }

        System.out.println("\n=== 결과 ===");
        for (int i = 0; i < futures.size(); i++) {
            System.out.println("작업 " + (i + 1) + " 결과: " + futures.get(i).get());
        }

        executor.shutdown();
    }
}
```

---

## 5. 복잡한 문제의 분해 전략

> 복잡한 문제를 서로 통신하는 여러 개의 더 단순한 구성 요소로 분해할 수 있다.

### 분해 패턴

```
[복잡한 문제]
┌────────────────────────────────────────────────┐
│     대용량 이미지 처리 파이프라인               │
└────────────────────────────────────────────────┘
                    ↓ 분해
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 이미지   │ → │ 필터    │ → │ 크기    │ → │ 저장    │
│ 읽기    │   │ 적용    │   │ 조정    │   │ 처리    │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
   스레드1        스레드2        스레드3        스레드4
```

### 예제: Fork-Join을 활용한 분할 정복

```java
import java.util.concurrent.*;

public class ForkJoinDecomposition extends RecursiveTask<Long> {

    private final long[] array;
    private final int start;
    private final int end;
    private static final int THRESHOLD = 10000;

    public ForkJoinDecomposition(long[] array, int start, int end) {
        this.array = array;
        this.start = start;
        this.end = end;
    }

    @Override
    protected Long compute() {
        int length = end - start;

        if (length <= THRESHOLD) {
            return computeDirectly();
        }

        int mid = start + length / 2;

        ForkJoinDecomposition leftTask = new ForkJoinDecomposition(array, start, mid);
        ForkJoinDecomposition rightTask = new ForkJoinDecomposition(array, mid, end);

        leftTask.fork();
        Long rightResult = rightTask.compute();
        Long leftResult = leftTask.join();

        return leftResult + rightResult;
    }

    private long computeDirectly() {
        long sum = 0;
        for (int i = start; i < end; i++) {
            sum += array[i];
        }
        return sum;
    }

    public static void main(String[] args) {
        int size = 100_000_000;
        long[] numbers = new long[size];
        for (int i = 0; i < size; i++) {
            numbers[i] = i + 1;
        }

        // 순차 처리
        long start = System.currentTimeMillis();
        long sequentialSum = 0;
        for (long num : numbers) {
            sequentialSum += num;
        }
        System.out.println("순차 처리:");
        System.out.println("  합계: " + sequentialSum);
        System.out.println("  시간: " + (System.currentTimeMillis() - start) + "ms\n");

        // Fork-Join 병렬 처리
        ForkJoinPool pool = ForkJoinPool.commonPool();
        start = System.currentTimeMillis();

        ForkJoinDecomposition task = new ForkJoinDecomposition(numbers, 0, numbers.length);
        long parallelSum = pool.invoke(task);

        System.out.println("Fork-Join 병렬 처리:");
        System.out.println("  합계: " + parallelSum);
        System.out.println("  시간: " + (System.currentTimeMillis() - start) + "ms");
        System.out.println("  사용된 스레드: " + pool.getParallelism() + "개");
    }
}
```

---

## 6. 정리: 동시성의 핵심 개념

| 개념 | 설명 | 장점 |
|------|------|------|
| **동시 처리** | 여러 작업을 동시에 처리 | 전체 처리 시간 단축 |
| **지연 시간 숨기기** | I/O 대기 중 다른 작업 수행 | 응답성 향상 |
| **처리율 개선** | 단위 시간당 처리량 증가 | 더 많은 요청 처리 가능 |
| **수평 확장** | 여러 서버에 부하 분산 | 무한한 확장 가능성 |
| **문제 분해** | 복잡한 문제를 작은 단위로 분할 | 유지보수성, 확장성 향상 |

### 동시성 프로그래밍의 도전 과제

```
┌─────────────────────────────────────────────────────────────┐
│                    동시성의 어려움                           │
├─────────────────────────────────────────────────────────────┤
│ 1. 경쟁 조건 (Race Condition)                               │
│    - 여러 스레드가 동시에 같은 자원에 접근                   │
│                                                             │
│ 2. 교착 상태 (Deadlock)                                     │
│    - 스레드들이 서로의 자원을 기다리며 무한 대기             │
│                                                             │
│ 3. 기아 상태 (Starvation)                                   │
│    - 특정 스레드가 영원히 자원을 얻지 못함                   │
│                                                             │
│ 4. 디버깅의 어려움                                          │
│    - 비결정적 실행으로 버그 재현이 어려움                    │
└─────────────────────────────────────────────────────────────┘
```

이러한 도전 과제들은 이후 챕터에서 자세히 다룰 예정이다.

---

## 참고 자료

- "Grokking Concurrency" by Kirill Bobrov
- Java Concurrency in Practice
- Oracle Java Documentation - Concurrency
