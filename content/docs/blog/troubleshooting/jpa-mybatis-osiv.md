---
title: "JPA + MyBatis 혼용 시 OSIV 커넥션 풀 고갈 문제"
weight: 1
---

JPA와 MyBatis를 함께 사용하는 환경에서 발생한 DB 커넥션 풀 고갈 문제와 해결 과정을 정리한다.

---

## 문제 상황

### 발생한 에러

```
Failed to obtain JDBC Connection; nested exception is
java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available,
request timed out after 30024ms
```

HikariCP에서 30초간 커넥션을 기다리다가 타임아웃이 발생했다.

### 환경

- Spring Boot + JPA + MyBatis 혼용
- HikariCP (기본 커넥션 풀)
- 운영 환경에서 트래픽 증가 시 간헐적 발생

---

## 원인 분석

### 1차 점검: 인프라

- DB 서버 상태 정상
- 네트워크 지연 없음
- 커넥션 풀 설정 적정 (maximum-pool-size: 10)

### 2차 점검: 애플리케이션

최근 배포된 코드를 확인한 결과, **JPA와 MyBatis를 하나의 트랜잭션에서 혼용**하는 로직이 추가되어 있었다.

```java
@Transactional
public void process() {
    mybatisMapper.selectData();    // MyBatis - 커넥션 1 사용
    // ... 비즈니스 로직 ...
    jpaRepository.save(entity);    // JPA - 커넥션 2 사용 (OSIV)
    // ... 비즈니스 로직 ...
    mybatisMapper.updateData();    // MyBatis - 커넥션 1 사용
}
```

---

## 핵심 원인: OSIV

### OSIV(Open Session In View)란?

OSIV는 영속성 컨텍스트의 생존 범위를 결정하는 설정이다.

| 설정 | 영속성 컨텍스트 범위 | DB 커넥션 반환 시점 |
|:----|:------------------|:------------------|
| `true` (기본값) | API 응답까지 | 응답 완료 후 |
| `false` | 트랜잭션 종료까지 | 트랜잭션 종료 후 |

### Spring Boot 기본 설정

```yaml
spring:
  jpa:
    open-in-view: true  # 기본값
```

{{< callout type="warning" >}}
**Spring Boot의 OSIV 기본값은 true이다.**
이 설정은 View 렌더링 시 지연 로딩을 지원하지만, 커넥션을 오래 점유하는 단점이 있다.
{{< /callout >}}

### 문제 발생 메커니즘

```
요청 시작
    │
    ├─ MyBatis: 커넥션 획득 → 쿼리 실행 → 커넥션 반환
    │
    ├─ JPA: 커넥션 획득 → 쿼리 실행 → (OSIV: 커넥션 유지)
    │                                    ↓
    ├─ MyBatis: 커넥션 획득 시도 → 풀에 여유 커넥션 없음 → 대기
    │
    └─ 30초 후 타임아웃 발생
```

OSIV가 활성화된 상태에서:

1. **MyBatis**는 쿼리 실행 후 커넥션을 즉시 반환
2. **JPA**는 커넥션을 API 응답까지 계속 점유
3. 동일 요청 내에서 **커넥션이 중복 할당**됨
4. 동시 요청이 많아지면 **커넥션 풀 고갈**

---

## 해결 방법

### 방법 1: OSIV 비활성화 (권장)

```yaml
spring:
  jpa:
    open-in-view: false
```

**장점**
- 커넥션을 빠르게 반환하여 풀 효율 증가
- 트랜잭션 범위가 명확해짐

**주의사항**
- 트랜잭션 외부에서 지연 로딩 시 `LazyInitializationException` 발생
- 필요한 데이터는 트랜잭션 내에서 미리 로딩 필요

```java
// OSIV false 환경에서 지연 로딩 처리
@Transactional(readOnly = true)
public UserDto getUser(Long id) {
    User user = userRepository.findById(id).orElseThrow();

    // 트랜잭션 내에서 필요한 연관 데이터 초기화
    user.getOrders().size();  // 강제 초기화

    return UserDto.from(user);
}

// 또는 Fetch Join 사용
@Query("SELECT u FROM User u JOIN FETCH u.orders WHERE u.id = :id")
Optional<User> findByIdWithOrders(@Param("id") Long id);
```

### 방법 2: 커넥션 풀 크기 증가 (임시 방편)

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20  # 기본값 10에서 증가
```

근본적인 해결책은 아니지만, 급한 상황에서 임시로 적용할 수 있다.

### 방법 3: ORM 분리 사용

JPA와 MyBatis를 하나의 트랜잭션에서 혼용하지 않도록 설계를 변경한다.

```java
// Before: 혼용
@Transactional
public void process() {
    mybatisMapper.selectData();
    jpaRepository.save(entity);
    mybatisMapper.updateData();
}

// After: 분리
@Transactional
public void processWithJpa() {
    jpaRepository.save(entity);
}

public void processWithMyBatis() {
    mybatisMapper.selectData();
    mybatisMapper.updateData();
}
```

---

## 검증

### OSIV 비활성화 후 확인

1. **로그 확인**: 커넥션 획득/반환 시점 로깅

```yaml
logging:
  level:
    com.zaxxer.hikari: DEBUG
```

2. **모니터링**: HikariCP 메트릭 확인

```java
@Autowired
private HikariDataSource dataSource;

public void checkPool() {
    HikariPoolMXBean pool = dataSource.getHikariPoolMXBean();
    log.info("Active: {}, Idle: {}, Waiting: {}",
        pool.getActiveConnections(),
        pool.getIdleConnections(),
        pool.getThreadsAwaitingConnection());
}
```

3. **부하 테스트**: 동시 요청 시 커넥션 풀 상태 확인

---

## 정리

| 항목 | 내용 |
|:----|:-----|
| **문제** | JPA + MyBatis 혼용 시 커넥션 풀 고갈 |
| **원인** | OSIV(true)로 인한 커넥션 중복 점유 |
| **해결** | OSIV 비활성화 (`open-in-view: false`) |
| **주의** | 지연 로딩 처리 방식 변경 필요 |

{{< callout type="info" >}}
**실무 권장 설정**
API 서버에서는 OSIV를 비활성화하고, 필요한 데이터는 트랜잭션 내에서 Fetch Join이나 DTO 프로젝션으로 조회하는 것이 좋다.
{{< /callout >}}

---

## 참고

- [Spring Boot OSIV 공식 문서](https://docs.spring.io/spring-boot/docs/current/reference/html/data.html#data.sql.jpa-and-spring-data.open-entity-manager-in-view)
- [HikariCP 설정 가이드](https://github.com/brettwooldridge/HikariCP#configuration-knobs-baby)
