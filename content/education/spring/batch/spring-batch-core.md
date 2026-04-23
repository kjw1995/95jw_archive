---
title: "Spring Batch 실행 모델과 재실행"
description: "JobRepository, JobLauncher, JobParameters와 재시작·건너뛰기·재시도의 작동 원리를 정리한다"
summary: "JobInstance와 JobExecution, 식별/실행 파라미터, restart·skip·retry, 배치 멱등성 설계"
date: 2025-01-20
weight: 21
draft: false
toc: true
---

## 1. 실행 모델 한눈에 보기

Spring Batch의 실행은 다음 4개 컴포넌트가 협력해서 이루어진다.

```
┌──────────────┐        ┌──────────────┐
│ JobLauncher  │───────▶│     Job      │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│JobRepository │◀───────│    Steps     │
│  (메타 저장) │         └──────────────┘
└──────────────┘
```

| 컴포넌트 | 역할 |
|:---|:---|
| `JobLauncher` | Job 실행의 진입점 |
| `Job` | 실행 대상 배치 정의 |
| `JobRepository` | Job/Step 실행 상태 영속화 |
| `PlatformTransactionManager` | chunk/tasklet 트랜잭션 관리 |

---

## 2. JobRepository

`JobRepository`는 배치 메타데이터를 저장하는 핵심 컴포넌트다.

```java
// JobRepository가 관리하는 정보
- JobInstance (Job 이름 + 식별 파라미터)
- JobExecution (시작/종료 시간, 상태)
- StepExecution (읽기/쓰기/스킵 건수)
- ExecutionContext (재시작에 필요한 상태)
```

### 왜 필요한가?

- 동일한 파라미터로 이미 완료된 Job이 다시 실행되는 것을 막는다
- 실패한 Job을 재시작할 때 이전 진행 위치를 복원한다
- 실행 이력을 조회하여 모니터링/리포팅에 활용한다

{{< callout type="info" >}}
`JobRepository`는 기본적으로 RDBMS에 상태를 기록한다. 테스트에서는 `ResourcelessJobRepository`(인메모리)를 쓸 수 있지만, 운영에서는 반드시 영속 저장소를 사용해야 재시작이 가능하다.
{{< /callout >}}

---

## 3. JobLauncher

`JobLauncher`는 `Job`과 `JobParameters`를 받아 실행을 시작한다.

```java
public interface JobLauncher {
    JobExecution run(Job job, JobParameters parameters)
        throws JobExecutionAlreadyRunningException,
               JobRestartException,
               JobInstanceAlreadyCompleteException,
               JobParametersInvalidException;
}
```

### 수행 단계

```
1. JobParameters 유효성 검증
        │
        ▼
2. JobInstance 조회/생성
   (Job 이름 + 식별 파라미터 기준)
        │
        ▼
3. 실행 가능 여부 확인
   (완료된 동일 Instance? 실행 중?)
        │
        ▼
4. JobExecution 생성 + 저장
        │
        ▼
5. Job.execute() 호출
   (동기 or TaskExecutor로 비동기)
```

### 동기 vs 비동기 실행

```java
// 동기 (기본) - 메인 스레드 블로킹
@Bean
public JobLauncher jobLauncher(JobRepository repo) {
    TaskExecutorJobLauncher launcher =
        new TaskExecutorJobLauncher();
    launcher.setJobRepository(repo);
    launcher.afterPropertiesSet();
    return launcher;
}

// 비동기 - REST API 등에서 유용
@Bean
public JobLauncher asyncJobLauncher(JobRepository repo) {
    TaskExecutorJobLauncher launcher =
        new TaskExecutorJobLauncher();
    launcher.setJobRepository(repo);
    launcher.setTaskExecutor(new SimpleAsyncTaskExecutor());
    launcher.afterPropertiesSet();
    return launcher;
}
```

---

## 4. JobParameters와 JobInstance

### 식별 파라미터 vs 실행 파라미터

JobParameters는 두 종류로 나뉘며, **JobInstance의 유일성을 결정하는 것은 식별 파라미터뿐**이다.

| 종류 | 의미 | 예시 |
|:---|:---|:---|
| 식별(identifying) | JobInstance 식별에 사용 | `date=2026-04-21` |
| 비식별(non-identifying) | 실행에만 전달, 식별에는 무시 | `run.id=42` |

```java
JobParameters params = new JobParametersBuilder()
    // 식별 파라미터
    .addString("date", "2026-04-21", true)
    // 비식별 파라미터 (두 번째 인자 false)
    .addLong("run.id", 42L, false)
    .toJobParameters();
```

### JobInstance를 결정하는 규칙

```
Job 이름 + 모든 식별 파라미터
        │
        ▼
   해시 키 생성
        │
        ▼
BATCH_JOB_INSTANCE 테이블에서 조회
        │
   ┌────┴────┐
  있음      없음
   │         │
   ▼         ▼
기존 재사용  신규 생성
```

{{< callout type="warning" >}}
동일한 Job 이름과 동일한 식별 파라미터로는 **완료(COMPLETED)된 JobInstance를 다시 실행할 수 없다**. 시도하면 `JobInstanceAlreadyCompleteException`이 발생한다. 매번 새 인스턴스를 원한다면 `date`나 `run.id` 같은 식별 파라미터를 매 실행마다 바꿔야 한다.
{{< /callout >}}

### 시나리오 예시

```
# 시나리오 1: 첫 실행
run(date=2026-04-21)
  → 새 JobInstance 생성
  → 새 JobExecution 생성

# 시나리오 2: 동일 파라미터로 실패 후 재실행
run(date=2026-04-21)
  → 기존 JobInstance 재사용
  → 새 JobExecution 생성 (RESTART)

# 시나리오 3: 다른 날짜로 실행
run(date=2026-04-22)
  → 새 JobInstance 생성
  → 새 JobExecution 생성

# 시나리오 4: 동일 파라미터로 이미 COMPLETED
run(date=2026-04-21)
  → JobInstanceAlreadyCompleteException
```

---

## 5. JobInstance vs JobExecution vs StepExecution

```
   JobInstance (논리)
        │  1 : N
        ▼
   JobExecution (실제 실행)
        │  1 : N
        ▼
   StepExecution (Step 실행)
```

- `JobInstance` = 논리적 실행 단위 (식별 파라미터가 같으면 동일)
- `JobExecution` = 물리적 실행 시도 (실행할 때마다 새로 생성)
- `StepExecution` = 하나의 `JobExecution` 안에서 Step이 실행된 기록

{{< callout type="info" >}}
`StepInstance`는 존재하지 않는다. Step은 항상 `JobExecution` 단위로 기록된다. 즉, 같은 JobInstance를 재시작하면 JobExecution이 새로 생기고, 그 안의 StepExecution도 모두 새로 시작된다.
{{< /callout >}}

---

## 6. Step 실행 흐름

```
Step 시작
     │
     ▼
StepExecution 생성
     │
     ▼
트랜잭션 시작
     │
     ▼
chunk-size만큼 read/process
     │
     ▼
Writer.write()
     │
     ▼
커밋 or 롤백
     │
     ▼
다음 chunk or Step 종료
```

각 chunk는 독립 트랜잭션이며, 실패 시 해당 chunk만 롤백된다. 이미 커밋된 chunk는 다시 읽지 않아야 하므로, Reader는 자신의 위치를 `ExecutionContext`에 기록한다.

---

## 7. 재시작 (Restart)

실패한 Job을 같은 식별 파라미터로 다시 실행하면 Spring Batch가 중단 지점부터 이어서 처리한다.

```
첫 실행: 1000건 중 600건 처리 후 FAILED
                │
                ▼
  StepExecutionContext에 "601" 기록
                │
                ▼
재시작: 동일 식별 파라미터
                │
                ▼
   Reader가 601번부터 재개
```

### 재시작 가능 여부 제어

```java
@Bean
public Step step(StepBuilderFactory sbf) {
    return sbf.get("step")
        .<In, Out>chunk(100)
        .reader(reader())
        .writer(writer())
        .allowStartIfComplete(false) // 기본값
        .startLimit(3)               // 최대 3번까지 시작
        .build();
}
```

| 옵션 | 기본 | 의미 |
|:---|:---|:---|
| `allowStartIfComplete` | false | COMPLETED Step을 재실행할지 |
| `startLimit` | Integer.MAX | 시작 가능한 최대 횟수 |

---

## 8. 건너뛰기 (Skip)

특정 예외가 발생한 아이템만 건너뛰고 나머지를 계속 처리하게 한다.

```java
@Bean
public Step skipStep(StepBuilderFactory sbf) {
    return sbf.get("skipStep")
        .<In, Out>chunk(100)
        .reader(reader())
        .processor(processor())
        .writer(writer())
        .faultTolerant()
        .skip(ParseException.class)
        .skip(ValidationException.class)
        .skipLimit(10)            // 최대 10건까지 skip
        .listener(new MySkipListener())
        .build();
}
```

### 동작 방식

```
아이템 읽기/처리 중 예외
        │
        ▼
skip 대상 예외인가?
   ┌────┴────┐
  Yes        No
   │          │
   ▼          ▼
skip 카운트 ↑   Step 실패
   │
   ▼
skipLimit 초과?
   ┌────┴────┐
  Yes       No
   │          │
   ▼          ▼
 실패      다음 아이템
```

{{< callout type="warning" >}}
Skip은 chunk 트랜잭션에 영향을 준다. 쓰기 도중 예외가 나면 chunk 전체를 롤백한 뒤 아이템을 한 건씩 다시 처리하며 실패 아이템만 skip한다. 이 때문에 skip이 잦으면 성능이 크게 떨어진다.
{{< /callout >}}

---

## 9. 재시도 (Retry)

일시적 장애(네트워크 끊김, 락 경합 등)에 대해 같은 아이템을 다시 시도한다.

```java
@Bean
public Step retryStep(StepBuilderFactory sbf) {
    return sbf.get("retryStep")
        .<In, Out>chunk(100)
        .reader(reader())
        .processor(processor())
        .writer(writer())
        .faultTolerant()
        .retry(DeadlockLoserDataAccessException.class)
        .retry(TransientDataAccessException.class)
        .retryLimit(3)
        .build();
}
```

### Retry와 Skip의 조합

```
아이템 처리 중 예외
        │
        ▼
retry 대상인가?
   ┌────┴────┐
  Yes        No
   │          │
   ▼          ▼
retryLimit내? skip 검사
   │          │
   ▼          ▼
재시도     (위 skip 흐름)
```

| 구분 | Skip | Retry |
|:---|:---|:---|
| 목적 | 문제 아이템 제외 | 일시 장애 재시도 |
| 대상 | 영구 오류 | 일시 오류 |
| 결과 | 해당 아이템 버림 | 같은 아이템 재처리 |

---

## 10. 배치 멱등성과 재실행 가능성

배치는 실패 후 재실행되는 것이 정상 운영의 일부다. 따라서 **몇 번을 재실행해도 결과가 같아야 한다**는 멱등성(idempotency)이 설계의 기준이 된다.

{{< callout type="warning" >}}
**배치 설계 원칙**

1. 같은 파라미터로 재실행해도 결과가 달라지지 않아야 한다.
2. 중간 실패 후 재시작했을 때 이미 처리된 데이터가 중복되지 않아야 한다.
3. 외부 시스템 호출은 재시도되어도 안전해야 한다(예: 업서트, 고유 키, 멱등 키).
4. 상태 변화는 Spring Batch가 관리하는 `ExecutionContext`에 기록하여 재시작에서 복원한다.
{{< /callout >}}

### 흔한 안티 패턴

| 상황 | 문제 | 대안 |
|:---|:---|:---|
| `INSERT`만 사용 | 재시작 시 중복 삽입 | `UPSERT` 또는 고유 키 |
| 외부 API 호출 후 재시도 | 중복 요청 | 멱등 키 헤더 |
| 커서 없이 offset 기반 | 재시작 위치 부정확 | `JdbcCursorItemReader` |
| 실행 시각에 의존 | 재실행 결과 달라짐 | 파라미터로 기준 시각 전달 |

### 재실행 가능하게 쓰기 예시

```java
// 안 좋은 예: 단순 INSERT
writer.write(items); // 재시작하면 중복

// 더 나은 예: UPSERT
// MERGE INTO ... USING ... ON ... WHEN MATCHED ...
// 또는 INSERT ... ON CONFLICT DO UPDATE

// 외부 API: 멱등 키
httpClient.post(url)
    .header("Idempotency-Key", item.getId())
    .send(item);
```

---

## 11. ExecutionContext

`ExecutionContext`는 Job/Step의 실행 상태를 키-값 형태로 보관하는 저장소다. 재시작 시 이 값을 읽어 중단 지점을 복원한다.

```java
@Component
@StepScope
public class StatefulTasklet implements Tasklet {

    @Override
    public RepeatStatus execute(
            StepContribution contribution,
            ChunkContext chunkContext) {

        ExecutionContext ctx = chunkContext
            .getStepContext()
            .getStepExecution()
            .getExecutionContext();

        int count = ctx.getInt("processedCount", 0);
        // ... 로직 ...
        ctx.putInt("processedCount", count + 1);

        return RepeatStatus.FINISHED;
    }
}
```

| 스코프 | 저장 위치 | 공유 범위 |
|:---|:---|:---|
| Job ExecutionContext | `BATCH_JOB_EXECUTION_CONTEXT` | Job 내 모든 Step |
| Step ExecutionContext | `BATCH_STEP_EXECUTION_CONTEXT` | 해당 Step 내 |

---

## 12. 실행 결과 상태

| 상태 | 의미 |
|:---|:---|
| `STARTING` | 실행 직전 준비 중 |
| `STARTED` | 실행 중 |
| `STOPPING` | 중지 요청을 받은 상태 |
| `STOPPED` | 정상 중지됨 (재시작 가능) |
| `COMPLETED` | 성공 종료 |
| `FAILED` | 실패 종료 (재시작 가능) |
| `ABANDONED` | 버림 처리 (재시작 불가) |

```
STARTED ──완료──▶ COMPLETED
   │
   ├──실패──▶ FAILED ──재시작──▶ STARTED
   │
   └──중지 요청──▶ STOPPING ──▶ STOPPED
```

---

## 13. 핵심 요약

| 항목 | 핵심 |
|:---|:---|
| `JobLauncher` | Job 실행 진입점 |
| `JobRepository` | 배치 메타 영속화 |
| 식별 파라미터 | JobInstance를 결정하는 유일한 키 |
| JobInstance | 논리적 실행(재시작의 단위) |
| JobExecution | 매 실행마다 새로 생성 |
| Restart | 동일 식별 파라미터로 중단 지점 이어서 실행 |
| Skip | 영구 오류 아이템 제외 |
| Retry | 일시 오류 재시도 |
| 멱등성 | 재실행해도 결과가 같도록 설계 |

---

## 참고 자료

- [Spring Batch Reference - Domain Language](https://docs.spring.io/spring-batch/reference/domain.html)
- [Spring Batch - Configuring and Running a Job](https://docs.spring.io/spring-batch/reference/job.html)
- [Spring Batch - Step](https://docs.spring.io/spring-batch/reference/step.html)
