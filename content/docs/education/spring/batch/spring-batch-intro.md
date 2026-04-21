---
title: "Spring Batch 개요와 아키텍처"
description: "배치 처리의 개념과 Spring Batch의 레이어 구조, Job/Step/ItemReader 모델을 정리한다"
summary: "배치가 필요한 이유, 3-Layer 아키텍처, Chunk vs Tasklet, 메타 테이블 6종의 역할"
date: 2025-01-20
weight: 20
draft: false
toc: true
---

## 1. 배치 처리란?

배치 처리(batch processing)는 **사용자의 개입 없이 유한한 양의 데이터를 한 번에 처리**하는 작업 방식이다. 시작되면 스스로 완료까지 진행하며, 실시간 응답이 필요하지 않다.

### 실시간 vs 배치

| 구분 | 실시간(OLTP) | 배치 |
|:---|:---|:---|
| 사용자 상호작용 | 있음 (요청/응답) | 없음 |
| 실행 방식 | 이벤트 기반 | 스케줄 기반 |
| 데이터 양 | 소량 (건별) | 대량 (일괄) |
| 실행 시점 | 즉시 | 정해진 시간 |
| 성능 지표 | 응답 시간 | 처리량(throughput) |

{{< callout type="info" >}}
온라인 처리는 "빨리 응답"하는 것이 목표이고, 배치는 "많이 처리"하는 것이 목표다. 같은 비즈니스 로직이라도 접근 방식이 달라야 한다.
{{< /callout >}}

---

## 2. 왜 배치를 쓰는가?

### 정보 수집과 집계

실시간 처리로는 전체 데이터를 보기 어렵다. 하루치 주문을 모아 집계하거나 월말 정산을 하려면 일정 시점에 누적된 데이터를 한 번에 돌리는 배치가 적합하다.

### 비즈니스 효율성

```
[즉시 처리]
주문 → 바로 배송 → 취소 시 역물류 비용

[배치 처리]
주문 누적 → 취소 가능 구간 유지
         → 일괄 배송 → 비용 절감
```

### 자원 활용

야간의 유휴 자원을 활용하여 비싼 연산(모델 학습, 리포트 집계)을 수행할 수 있다.

---

## 3. 배치가 직면한 4가지 과제

| 과제 | 설명 | 고려 사항 |
|:---|:---|:---|
| 사용성 | 관리·디버깅 가능한 코드 | 오류 추적, 단위 테스트 |
| 확장성 | 대용량 데이터 처리 | 병렬/분산 처리 |
| 가용성 | 실패 시 복구 | 재시작, 체크포인트 |
| 보안 | 민감 데이터 보호 | 접근 제어, 암호화 |

Spring Batch는 이 네 가지를 프레임워크 차원에서 해결하려는 프로젝트다.

---

## 4. Spring Batch 3-Layer 아키텍처

Spring Batch는 관심사를 세 계층으로 분리한다.

```
┌──────────────────────────────┐
│    Application Layer         │
│  사용자 코드, 비즈니스 로직     │
│  ┌────────────────────────┐  │
│  │     Core Layer         │  │
│  │  Job, Step,            │  │
│  │  JobLauncher,          │  │
│  │  JobParameters         │  │
│  │ ┌────────────────────┐ │  │
│  │ │ Infrastructure     │ │  │
│  │ │ Reader, Writer,    │ │  │
│  │ │ Retry, Skip        │ │  │
│  │ └────────────────────┘ │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

| 레이어 | 역할 | 대표 구성 요소 |
|:---|:---|:---|
| Application | 사용자가 작성하는 배치 로직 | Job 구성, 서비스 |
| Core | 배치 도메인 정의 | `Job`, `Step`, `JobLauncher` |
| Infrastructure | 공통 인프라 | `ItemReader`, `ItemWriter`, retry/skip |

{{< callout type="info" >}}
Application Layer는 Core와 Infrastructure 모두에 의존할 수 있지만, Core는 Infrastructure에 의존하지 않도록 설계되어 있다. 덕분에 Reader/Writer 구현을 교체해도 Job 정의는 영향을 받지 않는다.
{{< /callout >}}

---

## 5. Job과 Step

### 논리 구조

```
Job
 ├── Step 1
 │    └── Tasklet  (또는
 │         Reader → Processor → Writer)
 ├── Step 2
 │    └── ...
 └── Step N
```

- `Job`은 하나 이상의 `Step`을 엮은 배치 작업 단위
- `Step`은 독립 실행 단위이며, 두 가지 방식 중 하나로 구현한다

### Tasklet vs Chunk

```
[Tasklet 방식]
  execute() 호출
       │
       ▼
  FINISHED? ─No──→ 재호출
       │
      Yes
       ▼
   Step 종료

[Chunk 방식]
  Reader → Processor → Writer
     │        │          │
   읽기     가공·검증   저장
  (chunk 크기마다 트랜잭션 커밋)
```

| 구분 | Tasklet | Chunk |
|:---|:---|:---|
| 복잡도 | 단순 | 중간 |
| 용도 | 단일 작업 (파일 삭제, API 호출) | 대량 데이터 처리 |
| 트랜잭션 | `execute()` 호출마다 | chunk 단위 |
| 구성 요소 | `Tasklet` 1개 | Reader, Processor, Writer |

```java
// Tasklet
@Bean
public Step taskletStep(StepBuilderFactory sbf) {
    return sbf.get("taskletStep")
        .tasklet((contribution, chunkContext) -> {
            System.out.println("단일 작업 실행");
            return RepeatStatus.FINISHED;
        })
        .build();
}

// Chunk
@Bean
public Step chunkStep(StepBuilderFactory sbf) {
    return sbf.get("chunkStep")
        .<String, String>chunk(100)
        .reader(reader())
        .processor(processor())
        .writer(writer())
        .build();
}
```

---

## 6. Chunk 지향 처리 흐름

```
     ItemReader          ItemWriter
         │                   ▲
         ▼                   │
    한 건 읽기 ───→ Processor ┘
         │
         ▼
    chunk-size 도달?
         │
        Yes
         ▼
     트랜잭션 커밋
```

{{< callout type="info" >}}
chunk 크기는 트랜잭션 경계를 결정한다. 크게 잡으면 커밋 횟수가 줄어 처리량이 오르지만, 실패 시 롤백되는 범위가 커지고 메모리 사용량도 증가한다. 경험적으로 100 ~ 1000 범위에서 시작해 성능 측정 결과에 따라 조정하는 것이 좋다.
{{< /callout >}}

### chunk 크기 결정 기준

| 기준 | 방향 |
|:---|:---|
| 아이템 크기가 큼 | 작은 chunk (메모리) |
| DB I/O가 병목 | 큰 chunk (커밋 비용 감소) |
| 실패 재처리 비용이 큼 | 작은 chunk (재시작 단위 축소) |
| 외부 API 호출 포함 | 작은 chunk (타임아웃 회피) |

---

## 7. 핵심 인터페이스

| 인터페이스 | 패키지 | 역할 |
|:---|:---|:---|
| `Job` | `batch.core` | 배치 작업 전체 |
| `Step` | `batch.core` | 독립 실행 단위 |
| `Tasklet` | `batch.core.step.tasklet` | 단일 작업 전략 |
| `ItemReader<T>` | `batch.item` | 입력 데이터 제공 |
| `ItemProcessor<I,O>` | `batch.item` | 변환·검증 |
| `ItemWriter<T>` | `batch.item` | 결과 저장 |

---

## 8. 메타데이터 테이블 6종

Spring Batch는 Job 실행 이력을 데이터베이스에 기록한다. 이 덕분에 재시작·재실행·모니터링이 가능해진다.

| 테이블 | 역할 |
|:---|:---|
| `BATCH_JOB_INSTANCE` | Job 이름 + 식별 파라미터 조합의 논리적 인스턴스 |
| `BATCH_JOB_EXECUTION` | Job의 실제 실행(시도)마다 한 행 |
| `BATCH_JOB_EXECUTION_PARAMS` | 해당 JobExecution에 전달된 파라미터 |
| `BATCH_JOB_EXECUTION_CONTEXT` | Job 수준 실행 컨텍스트(재시작 상태 등) |
| `BATCH_STEP_EXECUTION` | Step의 실제 실행, 읽기/쓰기/스킵 건수 |
| `BATCH_STEP_EXECUTION_CONTEXT` | Step 수준 실행 컨텍스트(커서 위치 등) |

### 테이블 관계

```
BATCH_JOB_INSTANCE
        │ 1:N
        ▼
BATCH_JOB_EXECUTION ────── PARAMS
        │ 1:1
        ▼
BATCH_JOB_EXECUTION_CONTEXT
        │ 1:N
        ▼
BATCH_STEP_EXECUTION ───── CONTEXT
```

{{< callout type="warning" >}}
메타 테이블은 운영 DB와 분리하거나 최소한 별도 스키마로 두는 것을 권장한다. 배치가 실패 후 재시작될 때 이 테이블을 참조하므로 삭제하면 복구가 불가능해진다.
{{< /callout >}}

---

## 9. Spring Batch가 스케줄러는 아니다

```
❌ Spring Batch는 스케줄러가 아니다.
✅ 정해진 시각에 Job을 실행하려면
   별도의 스케줄러가 필요하다.
```

| 선택지 | 특징 |
|:---|:---|
| Cron | 리눅스 기본, 단일 호스트 |
| Quartz | Java 기반, 클러스터 지원 |
| Jenkins | CI/CD 통합 |
| Kubernetes CronJob | 컨테이너 환경 |
| Control-M, Airflow | 워크플로 오케스트레이션 |

---

## 10. Hello Batch 예제

```java
@Configuration
@EnableBatchProcessing
public class BatchConfig {

    @Bean
    public Tasklet helloTasklet() {
        return (contribution, chunkContext) -> {
            System.out.println("Hello, Batch!");
            return RepeatStatus.FINISHED;
        };
    }

    @Bean
    public Step helloStep(StepBuilderFactory sbf) {
        return sbf.get("helloStep")
            .tasklet(helloTasklet())
            .build();
    }

    @Bean
    public Job helloJob(JobBuilderFactory jbf, Step helloStep) {
        return jbf.get("helloJob")
            .start(helloStep)
            .build();
    }
}
```

### 실행 흐름

```
Spring Boot 기동
       │
       ▼
@EnableBatchProcessing
인프라 빈 등록
       │
       ▼
Job Bean 탐지
       │
       ▼
JobLauncher가 Job 실행
       │
       ▼
Step 실행 → 결과 기록
```

---

## 11. 관련 프로젝트

### Spring Cloud Task

- 클라우드 환경에서 유한한 태스크를 실행하기 위한 모듈
- Spring Batch Job을 Task로 감싸 라이프사이클 이벤트를 발행

### Spring Cloud Data Flow

- Task와 Stream을 오케스트레이션하는 상위 플랫폼
- Cloud Foundry, Kubernetes, Local 런타임 지원

---

## 12. 핵심 용어

| 용어 | 설명 |
|:---|:---|
| Job | 하나 이상의 Step으로 구성된 배치 작업 단위 |
| Step | Job을 구성하는 독립 실행 단위 |
| Tasklet | 단일 작업 실행 인터페이스 |
| Chunk | 일정 개수의 아이템을 묶어 처리하는 단위 |
| ItemReader/Processor/Writer | Chunk 지향 Step의 세 축 |
| JobRepository | 배치 실행 상태 저장소 |
| ETL | Extract, Transform, Load |

---

## 참고 자료

- [Spring Batch Reference](https://docs.spring.io/spring-batch/reference/)
- [Spring Cloud Task](https://spring.io/projects/spring-cloud-task)
- [Spring Cloud Data Flow](https://dataflow.spring.io/)
