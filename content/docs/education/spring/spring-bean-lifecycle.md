---
title: "빈 생명주기 콜백"
description: "스프링 빈의 생명주기와 초기화/소멸 콜백 설정 방법을 상세히 알아본다"
summary: "@PostConstruct, @PreDestroy, InitializingBean, DisposableBean, @Bean initMethod/destroyMethod"
date: 2025-01-06
weight: 6
draft: false
toc: true
---

## 빈 생명주기 콜백이란?

### 초기화와 소멸 작업의 필요성

데이터베이스 커넥션 풀, 네트워크 소켓 등은 애플리케이션 시작 시점에 연결을 미리 맺어두고, 종료 시점에 연결을 안전하게 종료해야 한다.

```java
// 네트워크 클라이언트 예시
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

    // 서비스 시작 시 호출
    public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("call: " + url + ", message = " + message);
    }

    // 서비스 종료 시 호출
    public void disconnect() {
        System.out.println("close: " + url);
    }
}
```

```java
@Test
void lifeCycleTest() {
    ConfigurableApplicationContext ac =
        new AnnotationConfigApplicationContext(LifeCycleConfig.class);
    NetworkClient client = ac.getBean(NetworkClient.class);
    ac.close();  // 컨테이너 종료
}

@Configuration
static class LifeCycleConfig {
    @Bean
    public NetworkClient networkClient() {
        NetworkClient networkClient = new NetworkClient();
        networkClient.setUrl("http://hello-spring.dev");
        return networkClient;
    }
}
```

```
출력:
생성자 호출, url = null
connect: null
call: null, message = 초기화 연결 메시지
```

**문제**: 생성자 호출 시점에는 아직 URL이 설정되지 않았다!

---

## 스프링 빈의 생명주기

### 빈 생명주기 이벤트

```
스프링 컨테이너 생성
        ↓
    스프링 빈 생성
        ↓
    의존관계 주입
        ↓
    초기화 콜백      ← 빈이 생성되고 의존관계 주입 완료 후
        ↓
       사용
        ↓
    소멸전 콜백      ← 빈이 소멸되기 직전
        ↓
   스프링 종료
```

### 생성과 초기화의 분리

> **객체의 생성과 초기화를 분리하자!**

- **생성자**: 필수 정보(파라미터)를 받고, 메모리 할당, 객체 생성
- **초기화**: 생성된 값을 활용하여 외부 커넥션 연결 등 무거운 동작 수행

```java
// 분리하면 유지보수 관점에서 좋음
public class NetworkClient {

    private String url;

    // 생성자: 객체 생성만 담당
    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

    // 초기화: 외부 연결 담당
    public void init() {
        System.out.println("NetworkClient.init");
        connect();
        call("초기화 연결 메시지");
    }

    // 소멸: 연결 종료 담당
    public void close() {
        System.out.println("NetworkClient.close");
        disconnect();
    }

    // ...
}
```

---

## 빈 생명주기 콜백 지원 방법

스프링은 3가지 방법으로 빈 생명주기 콜백을 지원한다.

### 1. 인터페이스 (InitializingBean, DisposableBean)

스프링 초창기에 나온 방법으로, 현재는 거의 사용하지 않는다.

```java
public class NetworkClient implements InitializingBean, DisposableBean {

    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("call: " + url + ", message = " + message);
    }

    public void disconnect() {
        System.out.println("close: " + url);
    }

    // 의존관계 주입이 끝나면 호출
    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("NetworkClient.afterPropertiesSet");
        connect();
        call("초기화 연결 메시지");
    }

    // 빈이 소멸될 때 호출
    @Override
    public void destroy() throws Exception {
        System.out.println("NetworkClient.destroy");
        disconnect();
    }
}
```

```
출력:
생성자 호출, url = null
NetworkClient.afterPropertiesSet
connect: http://hello-spring.dev
call: http://hello-spring.dev, message = 초기화 연결 메시지
NetworkClient.destroy
close: http://hello-spring.dev
```

**단점**:
- 스프링 전용 인터페이스에 의존
- 초기화/소멸 메서드 이름 변경 불가
- 외부 라이브러리에 적용 불가 (코드 수정 불가)

### 2. 빈 등록 초기화, 소멸 메서드 지정

`@Bean` 애노테이션에서 `initMethod`, `destroyMethod`를 지정한다.

```java
public class NetworkClient {

    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("call: " + url + ", message = " + message);
    }

    public void disconnect() {
        System.out.println("close: " + url);
    }

    // 커스텀 초기화 메서드
    public void init() {
        System.out.println("NetworkClient.init");
        connect();
        call("초기화 연결 메시지");
    }

    // 커스텀 소멸 메서드
    public void close() {
        System.out.println("NetworkClient.close");
        disconnect();
    }
}
```

```java
@Configuration
static class LifeCycleConfig {

    @Bean(initMethod = "init", destroyMethod = "close")
    public NetworkClient networkClient() {
        NetworkClient networkClient = new NetworkClient();
        networkClient.setUrl("http://hello-spring.dev");
        return networkClient;
    }
}
```

**장점**:
- 메서드 이름 자유롭게 지정 가능
- 스프링 코드에 의존하지 않음
- 설정 정보를 사용하므로 **외부 라이브러리에도 적용 가능**

#### destroyMethod의 추론 기능

`@Bean`의 `destroyMethod`는 기본값이 `(inferred)`로 설정되어 있다.

```java
@Bean  // destroyMethod 기본값: "(inferred)"
public NetworkClient networkClient() {
    NetworkClient networkClient = new NetworkClient();
    networkClient.setUrl("http://hello-spring.dev");
    return networkClient;
}
```

이 추론 기능은 `close`, `shutdown` 이라는 이름의 메서드를 자동으로 호출한다.

```java
// 라이브러리 대부분이 close, shutdown 메서드를 제공
public class HikariDataSource {
    public void close() { ... }  // 자동 호출됨!
}
```

추론 기능을 사용하지 않으려면:

```java
@Bean(destroyMethod = "")  // 빈 문자열로 비활성화
public NetworkClient networkClient() {
    // ...
}
```

### 3. @PostConstruct, @PreDestroy (권장)

최신 스프링에서 **가장 권장**하는 방법이다.

```java
public class NetworkClient {

    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url = " + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("call: " + url + ", message = " + message);
    }

    public void disconnect() {
        System.out.println("close: " + url);
    }

    @PostConstruct  // 초기화 콜백
    public void init() {
        System.out.println("NetworkClient.init");
        connect();
        call("초기화 연결 메시지");
    }

    @PreDestroy  // 소멸전 콜백
    public void close() {
        System.out.println("NetworkClient.close");
        disconnect();
    }
}
```

```java
@Configuration
static class LifeCycleConfig {

    @Bean  // initMethod, destroyMethod 지정 불필요
    public NetworkClient networkClient() {
        NetworkClient networkClient = new NetworkClient();
        networkClient.setUrl("http://hello-spring.dev");
        return networkClient;
    }
}
```

**특징**:
- **JSR-250** 자바 표준 (스프링이 아닌 다른 컨테이너에서도 동작)
- 컴포넌트 스캔과 잘 어울림
- 외부 라이브러리에는 적용 불가 (이 경우 `@Bean`의 `initMethod`, `destroyMethod` 사용)

#### 스프링 부트 3.0 이상 패키지 변경

| 버전 | 패키지 |
|------|--------|
| 스프링 부트 2.x | `javax.annotation.PostConstruct` |
| 스프링 부트 3.0+ | `jakarta.annotation.PostConstruct` |

```java
// 스프링 부트 3.0 이상
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

public class NetworkClient {

    @PostConstruct
    public void init() { }

    @PreDestroy
    public void close() { }
}
```

---

## 실전 예제

### 데이터베이스 커넥션 풀

```java
@Component
public class DatabaseConnectionPool {

    private List<Connection> pool = new ArrayList<>();
    private int poolSize = 10;

    @PostConstruct
    public void init() throws SQLException {
        System.out.println("커넥션 풀 초기화");
        for (int i = 0; i < poolSize; i++) {
            Connection conn = DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/mydb", "user", "password");
            pool.add(conn);
        }
        System.out.println("커넥션 풀 준비 완료: " + pool.size() + "개");
    }

    public Connection getConnection() {
        // 풀에서 커넥션 반환
        return pool.remove(0);
    }

    public void releaseConnection(Connection conn) {
        pool.add(conn);
    }

    @PreDestroy
    public void close() throws SQLException {
        System.out.println("커넥션 풀 종료");
        for (Connection conn : pool) {
            conn.close();
        }
        System.out.println("모든 커넥션 종료 완료");
    }
}
```

### 캐시 관리

```java
@Component
public class CacheManager {

    private Map<String, Object> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        System.out.println("캐시 초기화");
        // 자주 사용되는 데이터 미리 로드
        loadFrequentData();
    }

    private void loadFrequentData() {
        // 설정 정보 등을 캐시에 로드
        cache.put("config.maxUsers", 1000);
        cache.put("config.timeout", 30000);
    }

    public Object get(String key) {
        return cache.get(key);
    }

    public void put(String key, Object value) {
        cache.put(key, value);
    }

    @PreDestroy
    public void close() {
        System.out.println("캐시 정리");
        // 필요시 캐시 데이터 저장
        saveCache();
        cache.clear();
    }

    private void saveCache() {
        // 캐시 데이터를 파일이나 DB에 저장
    }
}
```

### 외부 라이브러리 연동

외부 라이브러리는 `@PostConstruct`, `@PreDestroy`를 붙일 수 없으므로 `@Bean`의 속성을 사용한다.

```java
@Configuration
public class DataSourceConfig {

    @Bean(destroyMethod = "close")  // HikariDataSource의 close 메서드 호출
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        config.setUsername("user");
        config.setPassword("password");
        config.setMaximumPoolSize(10);
        return new HikariDataSource(config);
    }
}
```

```java
@Configuration
public class RedisConfig {

    @Bean(initMethod = "start", destroyMethod = "shutdown")
    public RedisClient redisClient() {
        return new RedisClient("localhost", 6379);
    }
}
```

---

## 생명주기 콜백 방법 비교

| 방법 | 장점 | 단점 | 사용 시점 |
|------|------|------|----------|
| **인터페이스** | - | 스프링 의존, 이름 고정 | 사용하지 않음 |
| **@Bean 속성** | 메서드명 자유, 외부 라이브러리 적용 | 설정 분리됨 | 외부 라이브러리 |
| **@PostConstruct/@PreDestroy** | 표준, 간편, 컴포넌트 스캔 호환 | 외부 라이브러리 불가 | **일반적 상황 (권장)** |

### 권장 사용법

```java
// 1. 일반적인 경우: @PostConstruct, @PreDestroy 사용
@Component
public class MyService {

    @PostConstruct
    public void init() { }

    @PreDestroy
    public void close() { }
}

// 2. 외부 라이브러리: @Bean의 initMethod, destroyMethod 사용
@Configuration
public class LibraryConfig {

    @Bean(initMethod = "init", destroyMethod = "close")
    public ExternalLibrary externalLibrary() {
        return new ExternalLibrary();
    }
}
```

---

## 정리

### 빈 생명주기 요약

```
1. 스프링 컨테이너 생성
2. 스프링 빈 생성
3. 의존관계 주입
4. 초기화 콜백 (@PostConstruct)
5. 사용
6. 소멸전 콜백 (@PreDestroy)
7. 스프링 종료
```

### 핵심 권장 사항

> **@PostConstruct, @PreDestroy 애노테이션을 사용하자**

- 가장 간편하고 권장되는 방법
- 자바 표준이므로 스프링 외 컨테이너에서도 동작
- 외부 라이브러리의 경우 `@Bean`의 `initMethod`, `destroyMethod` 사용

### 체크리스트

- [ ] 초기화 로직이 생성자에 있지 않은가?
- [ ] 외부 리소스 연결은 초기화 콜백에서 처리하는가?
- [ ] 외부 리소스 해제는 소멸 콜백에서 처리하는가?
- [ ] 외부 라이브러리는 `@Bean` 속성으로 콜백을 지정했는가?

---

## 참고 자료

- [Spring Framework - Bean Lifecycle](https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html)
- [JSR-250: Common Annotations](https://jcp.org/en/jsr/detail?id=250)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
