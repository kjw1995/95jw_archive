---
title: "@Async 비동기 작업의 Graceful Shutdown 문제"
weight: 2
---

클라우드 환경에서 POD 스케일인 시 비동기 작업이 강제 종료되는 문제와 해결 과정을 정리한다.

---

## 문제 상황

### 발생한 현상

- POD 스케일인 시간대에 서버가 종료되면서 **비동기 작업이 중간에 끊김**
- 중요한 후처리 로직이 실행되지 않음
- 내부 로깅 시스템에도 기록되지 않아 추적 어려움

### 환경

- Spring Boot + Kubernetes
- `server.shutdown: graceful` 설정 적용
- `@Async` 기반 비동기 처리 사용

### 기대한 동작

Graceful Shutdown 설정을 했으니 현재 처리 중인 요청이 완료된 후 종료될 것으로 예상했다.

```yaml
server:
  shutdown: graceful
```

하지만 실제로는 비동기 작업이 완료되지 않은 채 강제 종료되었다.

---

## 원인 분석

### 1차 점검: Graceful Shutdown 범위

`server.shutdown: graceful`은 **Tomcat이 처리 중인 HTTP 요청**에만 적용된다.

```
HTTP 요청 → Controller → Service → @Async 메서드 호출 → 응답 반환
                                          ↓
                                   별도 스레드에서 실행
                                          ↓
                              (Graceful Shutdown 범위 밖)
```

HTTP 요청 자체는 응답을 반환하면 완료된 것으로 간주된다. `@Async`로 실행되는 비동기 작업은 별도 스레드에서 동작하므로 **Graceful Shutdown 대상이 아니다**.

### 2차 점검: ThreadPoolTaskExecutor 동작 방식

`@Async`의 기본 Executor 설정을 확인했다.

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("async-");
        executor.initialize();
        return executor;
    }
}
```

문제는 **shutdown 관련 설정이 없다**는 것이다.

---

## 핵심 원인: ExecutorService의 종료 메커니즘

### ThreadPoolTaskExecutor의 상속 구조

```
ThreadPoolTaskExecutor
    └─ extends ExecutorConfigurationSupport
           └─ shutdown() 메서드 정의
```

### shutdown() 메서드 동작

`ExecutorConfigurationSupport`의 `shutdown()` 메서드는 다음과 같이 동작한다.

```java
// ExecutorConfigurationSupport.java (Spring 내부 코드)
public void shutdown() {
    if (this.waitForTasksToCompleteOnShutdown) {
        this.executor.shutdown();  // 대기 중인 작업 실행 후 종료
    } else {
        this.executor.shutdownNow();  // 즉시 종료
    }

    awaitTerminationIfNecessary(this.executor);
}
```

| 설정 | 호출 메서드 | 동작 |
|:----|:----------|:-----|
| `waitForTasksToCompleteOnShutdown = false` (기본값) | `shutdownNow()` | 실행 중/대기 중 작업 **즉시 중단** |
| `waitForTasksToCompleteOnShutdown = true` | `shutdown()` | 대기 중인 작업 실행 후 종료 |

### shutdown() vs shutdownNow()

```java
// ExecutorService 인터페이스
void shutdown();           // 새 작업 거부, 기존 작업은 완료까지 실행
List<Runnable> shutdownNow();  // 실행 중인 작업 중단 시도, 대기 중인 작업 반환
```

**기본값이 `shutdownNow()`를 호출**하기 때문에 비동기 작업이 강제 종료되었던 것이다.

### awaitTermination의 중요성

`shutdown()`을 호출해도 **종료 완료를 보장하지 않는다**. 실제로 모든 작업이 끝날 때까지 대기하려면 `awaitTermination()`이 필요하다.

```java
// awaitTerminationIfNecessary 내부 로직
private void awaitTerminationIfNecessary(ExecutorService executor) {
    if (this.awaitTerminationMillis > 0) {  // 기본값: 0 (비활성화)
        executor.awaitTermination(this.awaitTerminationMillis, TimeUnit.MILLISECONDS);
    }
}
```

기본값이 0이므로 **대기 없이 바로 종료**된다.

---

## 해결 방법

### 필수 설정 두 가지

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("async-");

        // 1. 종료 시 실행 중인 작업 완료까지 대기
        executor.setWaitForTasksToCompleteOnShutdown(true);

        // 2. 최대 대기 시간 설정 (초 단위)
        executor.setAwaitTerminationSeconds(30);

        executor.initialize();
        return executor;
    }
}
```

| 설정 | 역할 |
|:----|:-----|
| `setWaitForTasksToCompleteOnShutdown(true)` | `shutdownNow()` 대신 `shutdown()` 호출 |
| `setAwaitTerminationSeconds(30)` | 작업 완료까지 최대 30초 대기 |

{{< callout type="warning" >}}
**두 설정 모두 필요하다.**
`waitForTasksToCompleteOnShutdown`만 설정하면 `shutdown()`을 호출하지만, 대기 시간이 0이라 바로 종료된다.
`awaitTerminationSeconds`만 설정하면 `shutdownNow()`가 호출되어 작업이 중단된다.
{{< /callout >}}

### 대기 시간 설정 기준

```java
// 비즈니스 로직에 따라 적절히 설정
executor.setAwaitTerminationSeconds(60);  // 긴 작업이 있는 경우
executor.setAwaitTerminationSeconds(10);  // 짧은 작업만 있는 경우
```

대기 시간은 **가장 오래 걸리는 비동기 작업 시간**을 기준으로 설정한다. 너무 짧으면 작업이 중단되고, 너무 길면 배포가 지연된다.

### Kubernetes 설정과의 연계

```yaml
# Kubernetes Deployment
spec:
  terminationGracePeriodSeconds: 60  # Pod 종료 대기 시간
```

**주의:** `awaitTerminationSeconds`는 `terminationGracePeriodSeconds`보다 작아야 한다. 그렇지 않으면 Kubernetes가 강제로 Pod를 종료한다.

```
terminationGracePeriodSeconds (60초)
    └─ awaitTerminationSeconds (30초) + 여유 시간
```

---

## 검증

### 로그 확인

종료 시 로그를 확인하여 작업이 정상 완료되는지 검증한다.

```java
@Async
public void processAsync(String data) {
    log.info("비동기 작업 시작: {}", data);
    // ... 비즈니스 로직 ...
    log.info("비동기 작업 완료: {}", data);  // 이 로그가 찍혀야 함
}
```

### 종료 이벤트 로깅

```java
@Component
public class ShutdownListener {

    @PreDestroy
    public void onShutdown() {
        log.info("애플리케이션 종료 시작");
    }
}
```

### 테스트 방법

1. 비동기 작업이 실행 중인 상태에서 `kill -15` (SIGTERM) 전송
2. 작업 완료 로그가 정상 출력되는지 확인
3. `awaitTerminationSeconds` 내에 종료되는지 확인

---

## 정리

| 항목 | 내용 |
|:----|:-----|
| **문제** | 서버 종료 시 @Async 비동기 작업이 강제 중단됨 |
| **원인** | ThreadPoolTaskExecutor 기본 설정이 즉시 종료(shutdownNow) |
| **해결** | `waitForTasksToCompleteOnShutdown` + `awaitTerminationSeconds` 설정 |
| **주의** | Kubernetes terminationGracePeriodSeconds와 시간 조율 필요 |

{{< callout type="info" >}}
**실무 권장 설정**
비동기 작업을 사용하는 경우 Executor 생성 시 Graceful Shutdown 설정을 기본으로 포함하는 것이 좋다. 배포 시 데이터 유실이나 작업 중단을 방지할 수 있다.
{{< /callout >}}

---

## 참고

- [Spring TaskExecutor 공식 문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html)
- [Kubernetes Pod Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)
