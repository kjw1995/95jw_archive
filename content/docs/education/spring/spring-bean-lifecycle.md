---
title: "빈 생명주기 콜백"
description: "스프링 빈의 생명주기와 초기화/소멸 콜백 설정 방법을 상세히 알아본다"
summary: "@PostConstruct, @PreDestroy, InitializingBean, DisposableBean, @Bean initMethod/destroyMethod"
date: 2025-01-06
weight: 6
draft: false
toc: true
---

## 1. 빈 생명주기 콜백이 필요한 이유

### 초기화와 정리 작업

데이터베이스 커넥션 풀이나 네트워크 소켓처럼 비용이 큰 리소스는 애플리케이션 시작 시점에 미리 연결을 맺어두고, 종료 시점에 안전하게 끊어주는 로직이 필요하다. 스프링은 이 시점에 개발자의 코드를 실행해주는 **생명주기 콜백**을 제공한다.

```java
public class NetworkClient {

    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
        connect();
        call("초기화 연결 메시지");
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("call: " + url + ", msg=" + message);
    }

    public void disconnect() {
        System.out.println("close: " + url);
    }
}
```

```java
@Configuration
static class LifeCycleConfig {
    @Bean
    public NetworkClient networkClient() {
        NetworkClient client = new NetworkClient();
        client.setUrl("http://hello-spring.dev");
        return client;
    }
}
```

```
생성자 호출, url = null
connect: null
call: null, msg=초기화 연결 메시지
```

{{< callout type="warning" >}}
생성자 시점에는 아직 `setUrl()` 이 호출되지 않았기 때문에 `url` 이 `null` 이다. 즉, 의존관계 주입이 끝나지 않은 상태에서 초기화 작업을 하면 정상 동작할 수 없다. 초기화는 DI 완료 이후 시점에 수행해야 한다.
{{< /callout >}}

---

## 2. 스프링 빈의 생명주기

### 전체 흐름

```
  스프링 컨테이너 생성
         │
         ▼
     빈 인스턴스 생성
         │
         ▼
     의존관계 주입 (DI)
         │
         ▼
     초기화 콜백
         │
         ▼
       사용 중
         │
         ▼
     소멸 전 콜백
         │
         ▼
    컨테이너 종료
```

### 생성과 초기화의 분리

| 단계 | 역할 |
|:---|:---|
| 생성자 | 필수 파라미터 세팅, 메모리 할당, 객체 구성 |
| 초기화 콜백 | 주입된 의존성을 활용한 외부 연결, 무거운 작업 |

{{< callout type="info" >}}
생성자에서 바로 커넥션을 열거나 외부 API 를 호출하면, (1) 아직 DI 가 끝나지 않아 필드가 `null` 일 수 있고, (2) 객체 생성과 리소스 연결이 뒤섞여 테스트가 어려워진다. **생성과 초기화는 분리**하는 것이 유지보수 관점에서 유리하다.
{{< /callout >}}

```java
public class NetworkClient {

    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
    }

    public void setUrl(String url) { this.url = url; }

    // 초기화: 외부 연결 담당
    public void init() {
        System.out.println("init");
        connect();
        call("초기화 연결 메시지");
    }

    // 소멸: 연결 종료 담당
    public void close() {
        System.out.println("close");
        disconnect();
    }
}
```

---

## 3. 생명주기 콜백의 3가지 방법

스프링은 아래 세 가지 방법을 제공한다.

### 방법 1: InitializingBean / DisposableBean 인터페이스

스프링 초창기 방식이며, 지금은 거의 쓰지 않는다.

```java
public class NetworkClient
    implements InitializingBean, DisposableBean {

    private String url;

    public NetworkClient() { }

    public void setUrl(String url) { this.url = url; }

    @Override
    public void afterPropertiesSet() throws Exception {
        // DI 완료 시점에 호출
        connect();
        call("초기화 연결 메시지");
    }

    @Override
    public void destroy() throws Exception {
        // 빈 소멸 시점에 호출
        disconnect();
    }
}
```

### 방법 2: @Bean 의 initMethod / destroyMethod

설정 정보에 초기화/소멸 메서드 이름을 지정한다.

```java
public class NetworkClient {

    public void init() {
        connect();
        call("초기화 연결 메시지");
    }

    public void close() {
        disconnect();
    }
}
```

```java
@Configuration
static class LifeCycleConfig {

    @Bean(initMethod = "init", destroyMethod = "close")
    public NetworkClient networkClient() {
        NetworkClient client = new NetworkClient();
        client.setUrl("http://hello-spring.dev");
        return client;
    }
}
```

#### destroyMethod 의 추론 기능

`@Bean` 의 `destroyMethod` 기본값은 `"(inferred)"` 이다. 스프링은 `close` 또는 `shutdown` 이라는 이름의 메서드를 자동으로 찾아 호출한다.

```java
// HikariDataSource 는 close() 를 가지고 있음 → 자동 호출됨
@Bean
public DataSource dataSource() {
    return new HikariDataSource(config);
}

// 추론 기능을 끄고 싶다면
@Bean(destroyMethod = "")
public NetworkClient networkClient() { /* ... */ }
```

### 방법 3: @PostConstruct / @PreDestroy (권장)

가장 간단하고 널리 쓰이는 방법이다. `jakarta.annotation` (또는 스프링 부트 2.x 이하는 `javax.annotation`) 패키지의 표준 애노테이션을 사용한다.

```java
public class NetworkClient {

    @PostConstruct
    public void init() {
        connect();
        call("초기화 연결 메시지");
    }

    @PreDestroy
    public void close() {
        disconnect();
    }
}
```

```java
@Configuration
static class LifeCycleConfig {

    @Bean // initMethod / destroyMethod 불필요
    public NetworkClient networkClient() {
        NetworkClient client = new NetworkClient();
        client.setUrl("http://hello-spring.dev");
        return client;
    }
}
```

| 버전 | 패키지 |
|:---|:---|
| 스프링 부트 2.x | `javax.annotation.PostConstruct` |
| 스프링 부트 3.0+ | `jakarta.annotation.PostConstruct` |

{{< callout type="info" >}}
`@PostConstruct` 와 `@PreDestroy` 는 JSR-250 자바 표준이다. 스프링이 아닌 다른 DI 컨테이너에서도 동작하며, 컴포넌트 스캔과도 자연스럽게 어울린다.
{{< /callout >}}

---

## 4. 세 가지 방법 비교

| 방법 | 장점 | 단점 | 사용 시점 |
|:---|:---|:---|:---|
| 인터페이스 구현 | 별도 설정 없이 자동 인식 | 스프링에 강결합, 메서드 이름 고정, 외부 라이브러리 적용 불가 | 거의 사용 안 함 |
| `@Bean` 속성 | 메서드명 자유, **외부 라이브러리에도 적용 가능** | 설정 파일과 구현이 분리됨 | 외부 라이브러리 초기화/정리 |
| `@PostConstruct` / `@PreDestroy` | 자바 표준, 간결, 컴포넌트 스캔과 잘 어울림 | 외부 라이브러리에 직접 적용 불가 | **일반적인 경우 (권장)** |

### 왜 생성자에서 초기화하면 안 되는가

1. **DI 가 완료되기 전일 수 있다.** 세터/필드 주입은 생성자 실행 이후에 일어난다. 따라서 생성자에서 의존성을 사용하면 `NullPointerException` 이 발생할 수 있다.
2. **생성 책임과 초기화 책임이 뒤섞인다.** 객체 생성은 저렴해야 하고, 외부 리소스 연결은 명시적인 훅에 두는 것이 테스트와 유지보수에 좋다.
3. **예외 처리 경계가 흐려진다.** 생성자가 외부 I/O 예외를 던지면, 객체 생성과 리소스 연결 실패가 같은 지점에서 뒤섞인다.

{{< callout type="warning" >}}
초기화 로직은 반드시 **DI 완료 이후**에 실행되는 `@PostConstruct` 같은 콜백에서 수행하자. 생성자에 넣으면 위 세 가지 문제 모두에 노출된다.
{{< /callout >}}

### 권장 사용 전략

```java
// 1) 일반적인 경우: @PostConstruct / @PreDestroy
@Component
public class MyService {

    @PostConstruct
    public void init() { /* ... */ }

    @PreDestroy
    public void close() { /* ... */ }
}
```

```java
// 2) 외부 라이브러리: @Bean 의 initMethod / destroyMethod
@Configuration
public class LibraryConfig {

    @Bean(initMethod = "init", destroyMethod = "close")
    public ExternalLibrary externalLibrary() {
        return new ExternalLibrary();
    }
}
```

---

## 5. 실전 예제

### 데이터베이스 커넥션 풀

```java
@Component
public class DatabaseConnectionPool {

    private final List<Connection> pool = new ArrayList<>();
    private final int poolSize = 10;

    @PostConstruct
    public void init() throws SQLException {
        for (int i = 0; i < poolSize; i++) {
            pool.add(DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/mydb", "user", "pw"));
        }
        System.out.println("pool ready: " + pool.size());
    }

    public Connection getConnection() {
        return pool.remove(0);
    }

    public void release(Connection c) {
        pool.add(c);
    }

    @PreDestroy
    public void close() throws SQLException {
        for (Connection c : pool) c.close();
        System.out.println("pool closed");
    }
}
```

### 외부 라이브러리 연동

`HikariDataSource`, `RedisClient` 처럼 소스를 수정할 수 없는 외부 라이브러리는 `@Bean` 의 속성으로 콜백을 지정한다.

```java
@Configuration
public class DataSourceConfig {

    @Bean(destroyMethod = "close")
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        config.setUsername("user");
        config.setPassword("pw");
        config.setMaximumPoolSize(10);
        return new HikariDataSource(config);
    }
}

@Configuration
public class RedisConfig {

    @Bean(initMethod = "start", destroyMethod = "shutdown")
    public RedisClient redisClient() {
        return new RedisClient("localhost", 6379);
    }
}
```

### 캐시 미리 로드

```java
@Component
public class CacheManager {

    private final Map<String, Object> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        cache.put("config.maxUsers", 1000);
        cache.put("config.timeout", 30000);
    }

    public Object get(String key) {
        return cache.get(key);
    }

    @PreDestroy
    public void close() {
        cache.clear();
    }
}
```

---

## 6. 정리

### 빈 생명주기 요약

```
1. 컨테이너 생성
2. 빈 인스턴스 생성
3. 의존관계 주입
4. 초기화 콜백 (@PostConstruct)
5. 사용
6. 소멸 전 콜백 (@PreDestroy)
7. 컨테이너 종료
```

### 핵심 권장 사항

{{< callout type="info" >}}
일반적인 스프링 빈은 **`@PostConstruct` / `@PreDestroy`** 를 사용한다. 수정할 수 없는 외부 라이브러리에 한해 `@Bean` 의 `initMethod` / `destroyMethod` 를 사용한다. `InitializingBean` / `DisposableBean` 인터페이스는 사용하지 않는다.
{{< /callout >}}

### 체크리스트

- [ ] 초기화 로직이 생성자가 아닌 콜백 메서드에 있는가?
- [ ] 외부 리소스 연결이 `@PostConstruct` 에서 이루어지는가?
- [ ] 외부 리소스 해제가 `@PreDestroy` 에서 이루어지는가?
- [ ] 외부 라이브러리의 경우 `@Bean` 속성으로 콜백을 지정했는가?

---

## 참고 자료

- [Spring Framework - Bean Lifecycle](https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html)
- [JSR-250: Common Annotations](https://jcp.org/en/jsr/detail?id=250)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
