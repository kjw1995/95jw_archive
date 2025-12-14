---
title: Spring Batch - 핵심 개념
weight: 11
---

## Job과 Step 개념

### Job = 상태 기계 (State Machine)

```
┌─────────────────────────────────────────────────────────────┐
│                         Job                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Step 1  │ →  │ Step 2  │ →  │ Step 3  │ →  │ Step N  │  │
│  │ (상태1) │    │ (상태2) │    │ (상태3) │    │ (완료)  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       ↓              ↓              ↓              ↓        │
│    상태 수집      상태 전환      상태 전환      최종 상태     │
└─────────────────────────────────────────────────────────────┘
```

---

## Step의 두 가지 유형

### 1. Tasklet 기반 Step

```
┌─────────────────────────────────────┐
│          Tasklet Step               │
├─────────────────────────────────────┤
│  execute() 호출                     │
│       ↓                             │
│  FINISHED 반환? ──No──→ 재호출      │
│       │                             │
│      Yes                            │
│       ↓                             │
│    Step 종료                        │
└─────────────────────────────────────┘
```

```java
@Bean
public Step taskletStep() {
    return stepBuilderFactory.get("taskletStep")
        .tasklet((contribution, chunkContext) -> {
            // 비즈니스 로직
            System.out.println("Tasklet 실행");
            return RepeatStatus.FINISHED;  // 또는 CONTINUABLE
        })
        .build();
}
```

**RepeatStatus 옵션:**
- `FINISHED`: Tasklet 완료, Step 종료
- `CONTINUABLE`: Tasklet 재호출 (무한 반복 가능)

### 2. Chunk 기반 Step

```
┌─────────────────────────────────────────────────────────────┐
│                    Chunk 기반 Step                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐   ┌────────────────┐   ┌────────────┐      │
│  │ ItemReader │ → │ ItemProcessor  │ → │ ItemWriter │      │
│  │   (필수)   │   │    (선택)      │   │   (필수)   │      │
│  └────────────┘   └────────────────┘   └────────────┘      │
│       │                   │                  │              │
│    데이터 읽기        가공/검증          결과 저장           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```java
@Bean
public Step chunkStep() {
    return stepBuilderFactory.get("chunkStep")
        .<String, String>chunk(100)  // 100개씩 처리
        .reader(itemReader())
        .processor(itemProcessor())   // 선택
        .writer(itemWriter())
        .build();
}
```

### Tasklet vs Chunk 비교

| 구분 | Tasklet | Chunk |
|------|---------|-------|
| 복잡도 | 단순 | 상대적 복잡 |
| 용도 | 단일 작업 (파일 삭제, API 호출) | 대량 데이터 처리 |
| 트랜잭션 | execute() 호출마다 | chunk 단위 |
| 구성 요소 | Tasklet 1개 | Reader, Processor, Writer |

---

## 핵심 인터페이스

| 인터페이스 | 패키지 | 설명 |
|-----------|--------|------|
| `Job` | batch.core | 배치 작업 전체를 나타내는 객체 |
| `Step` | batch.core | Job을 구성하는 독립 작업 단위 |
| `Tasklet` | batch.core.step.tasklet | 트랜잭션 내 실행 전략 인터페이스 |
| `ItemReader<T>` | batch.item | 입력 데이터 제공 |
| `ItemProcessor<I,O>` | batch.item | 비즈니스 로직, 검증 적용 |
| `ItemWriter<T>` | batch.item | 처리된 데이터 저장 |

---

## Step 분리의 4가지 장점

```
┌─────────────────────────────────────────────────────────────┐
│                    Step 분리의 장점                          │
├──────────────┬──────────────────────────────────────────────┤
│   유연성     │ 복잡한 플로우를 재사용 가능하게 구성           │
├──────────────┼──────────────────────────────────────────────┤
│  유지보수성   │ 독립적 코드로 테스트/디버그/변경 용이         │
├──────────────┼──────────────────────────────────────────────┤
│   확장성     │ 독립 Step이 다양한 확장 방법 제공             │
├──────────────┼──────────────────────────────────────────────┤
│   신뢰성     │ 강력한 오류 처리 (retry, skip)               │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Job 실행 메커니즘

### 핵심 컴포넌트

```
┌─────────────────────────────────────────────────────────────┐
│                    Job 실행 구조                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐         ┌─────────────────┐              │
│   │ JobLauncher │ ──────→ │      Job        │              │
│   └─────────────┘         └────────┬────────┘              │
│         │                          │                        │
│         ▼                          ▼                        │
│   ┌─────────────┐         ┌─────────────────┐              │
│   │JobRepository│ ←────── │     Steps       │              │
│   │  (상태 저장) │         └─────────────────┘              │
│   └─────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### JobRepository

```java
// JobRepository가 저장하는 정보
- 시작 시간
- 종료 시간
- 상태 (STARTED, COMPLETED, FAILED 등)
- 읽은 아이템 수
- 처리된 아이템 수
- 건너뛴 아이템 수
```

### JobLauncher

```java
// JobLauncher의 역할
1. Job.execute() 메서드 호출
2. Job 재실행 가능 여부 검증
3. 실행 방법 결정 (동기/비동기)
4. 파라미터 유효성 검증
```

---

## JobInstance vs JobExecution

### 개념 비교

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  JobInstance (논리적 실행)                                   │
│  ├── "Job 이름" + "고유 파라미터"로 유일하게 식별             │
│  │                                                           │
│  └── JobExecution (실제 실행) - 여러 개 가능                 │
│       ├── 첫 번째 실행 (FAILED)                              │
│       ├── 두 번째 실행 (FAILED)                              │
│       └── 세 번째 실행 (COMPLETED)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 실행 시나리오

```
# 시나리오 1: 첫 실행
Job 실행 (param: date=2024-01-01)
  → 새 JobInstance 생성
  → 새 JobExecution 생성

# 시나리오 2: 실패 후 재실행 (동일 파라미터)
Job 재실행 (param: date=2024-01-01)
  → 기존 JobInstance 사용 (동일 파라미터)
  → 새 JobExecution 생성

# 시나리오 3: 다른 파라미터로 실행
Job 실행 (param: date=2024-01-02)
  → 새 JobInstance 생성
  → 새 JobExecution 생성
```

### StepExecution

```java
// 관계도
JobExecution (1) ──── (N) StepExecution

// StepInstance는 존재하지 않음!
// Step은 JobExecution마다 새로운 StepExecution 생성
```

---

## 병렬화 5가지 방법

### 1. 다중 스레드 Step

```
┌─────────────────────────────────────────────────────────────┐
│                  다중 스레드 Step                            │
├─────────────────────────────────────────────────────────────┤
│  기존 (순차 처리):                                           │
│  [1-50] → [51-100] → [101-150] → ...                       │
│                                                              │
│  병렬 처리:                                                  │
│  Thread1: [1-50]                                            │
│  Thread2: [51-100]     (동시 실행)                          │
│  Thread3: [101-150]                                         │
└─────────────────────────────────────────────────────────────┘
```

```java
@Bean
public Step multiThreadStep() {
    return stepBuilderFactory.get("multiThreadStep")
        .<String, String>chunk(100)
        .reader(itemReader())
        .processor(itemProcessor())
        .writer(itemWriter())
        .taskExecutor(taskExecutor())  // 스레드 풀 지정
        .throttleLimit(4)               // 동시 스레드 수 제한
        .build();
}

@Bean
public TaskExecutor taskExecutor() {
    SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor();
    executor.setConcurrencyLimit(4);
    return executor;
}
```

### 2. 병렬 Step

```
┌─────────────────────────────────────────────────────────────┐
│                     병렬 Step                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│          ┌── Step A ──┐                                     │
│  Start → ├── Step B ──┼ → End   (동시 실행)                 │
│          └── Step C ──┘                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```java
@Bean
public Job parallelStepsJob() {
    Flow flow1 = new FlowBuilder<Flow>("flow1")
        .start(stepA()).build();
    Flow flow2 = new FlowBuilder<Flow>("flow2")
        .start(stepB()).build();
    Flow flow3 = new FlowBuilder<Flow>("flow3")
        .start(stepC()).build();

    return jobBuilderFactory.get("parallelJob")
        .start(flow1)
        .split(new SimpleAsyncTaskExecutor())
        .add(flow2, flow3)
        .end()
        .build();
}
```

### 3. 비동기 ItemProcessor/Writer

```
┌─────────────────────────────────────────────────────────────┐
│              비동기 ItemProcessor/Writer                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ItemReader → AsyncItemProcessor → AsyncItemWriter          │
│                      │                    │                  │
│                Future 반환           Future 처리             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. 원격 청킹 (Remote Chunking)

```
┌─────────────────────────────────────────────────────────────┐
│                    원격 청킹                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    Message     ┌──────────────┐          │
│  │    Master    │    Broker      │    Worker    │          │
│  │  ItemReader  │ ──────────────→│ ItemProcessor│          │
│  └──────────────┘   (RabbitMQ)   │  ItemWriter  │          │
│         ↑                        └──────────────┘          │
│         └──────── 결과 반환 ─────────────┘                  │
│                                                              │
│  ⚠️ 네트워크 사용량 많음 - I/O보다 처리 비용이 클 때 적합     │
└─────────────────────────────────────────────────────────────┘
```

### 5. 파티셔닝 (Partitioning)

```
┌─────────────────────────────────────────────────────────────┐
│                     파티셔닝                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                  ┌─────────────┐                            │
│                  │   Master    │                            │
│                  │ (컨트롤러)   │                            │
│                  └──────┬──────┘                            │
│           ┌─────────────┼─────────────┐                     │
│           ▼             ▼             ▼                     │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│     │ Worker 1 │ │ Worker 2 │ │ Worker 3 │                │
│     │ (1-1000) │ │(1001-2000)│ │(2001-3000)│                │
│     └──────────┘ └──────────┘ └──────────┘                │
│                                                              │
│  ✅ 내구성 있는 통신 불필요                                   │
│  ✅ JobRepository가 상태 보장                                │
└─────────────────────────────────────────────────────────────┘
```

```java
@Bean
public Step masterStep() {
    return stepBuilderFactory.get("masterStep")
        .partitioner("workerStep", partitioner())
        .step(workerStep())
        .gridSize(4)  // 파티션 수
        .taskExecutor(taskExecutor())
        .build();
}

@Bean
public Partitioner partitioner() {
    return gridSize -> {
        Map<String, ExecutionContext> partitions = new HashMap<>();
        for (int i = 0; i < gridSize; i++) {
            ExecutionContext context = new ExecutionContext();
            context.putInt("minId", i * 1000 + 1);
            context.putInt("maxId", (i + 1) * 1000);
            partitions.put("partition" + i, context);
        }
        return partitions;
    };
}
```

### 병렬화 방법 비교

| 방법 | JVM | 적합한 경우 |
|------|-----|-----------|
| 다중 스레드 Step | 단일 | 처리 병목이 있는 경우 |
| 병렬 Step | 단일 | 독립적인 Step 동시 실행 |
| 비동기 Processor | 단일 | 처리 로직이 무거운 경우 |
| 원격 청킹 | 다중 | I/O 대비 처리 비용이 높을 때 |
| 파티셔닝 | 다중 | 데이터를 분할 처리할 때 |

---

## Hello World 예제

### 전체 코드

```java
@EnableBatchProcessing
@SpringBootApplication
public class HelloWorldApplication {

    @Autowired
    private JobBuilderFactory jobBuilderFactory;

    @Autowired
    private StepBuilderFactory stepBuilderFactory;

    @Bean
    public Step step() {
        return stepBuilderFactory.get("step1")
            .tasklet((contribution, chunkContext) -> {
                System.out.println("Hello, World!");
                return RepeatStatus.FINISHED;
            })
            .build();
    }

    @Bean
    public Job job() {
        return jobBuilderFactory.get("job")
            .start(step())
            .build();
    }

    public static void main(String[] args) {
        SpringApplication.run(HelloWorldApplication.class, args);
    }
}
```

### @EnableBatchProcessing이 제공하는 빈

| Bean | 역할 |
|------|------|
| `JobRepository` | Job 상태 기록 |
| `JobLauncher` | Job 구동 |
| `JobExplorer` | JobRepository 읽기 전용 작업 |
| `JobRegistry` | Job 검색 |
| `PlatformTransactionManager` | 트랜잭션 관리 |
| `JobBuilderFactory` | Job 생성 빌더 |
| `StepBuilderFactory` | Step 생성 빌더 |

### 실행 흐름

```
1. Spring Boot 시작
       ↓
2. @EnableBatchProcessing으로 배치 인프라 구성
       ↓
3. JobLauncherCommandLineRunner 로딩
       ↓
4. ApplicationContext에서 Job Bean 발견
       ↓
5. JobLauncher가 Job 자동 실행
       ↓
6. "Hello, World!" 출력
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **JobInstance** | Job의 논리적 실행 (이름 + 파라미터로 식별) |
| **JobExecution** | Job의 실제 실행 (실행할 때마다 생성) |
| **StepExecution** | Step의 실제 실행 |
| **Chunk** | 일정 개수의 아이템을 묶어 처리하는 단위 |
| **Tasklet** | 단일 작업 수행 인터페이스 |
| **Partitioning** | 데이터를 분할하여 병렬 처리 |
| **Remote Chunking** | 메시지 브로커를 통한 원격 처리 |
