---
title: "빈 스코프"
description: "스프링 빈의 다양한 스코프와 프로토타입, 웹 스코프의 동작 원리를 상세히 알아본다"
summary: "싱글톤, 프로토타입, request 스코프, ObjectProvider, 프록시를 활용한 스코프 관리"
date: 2025-01-06
weight: 7
draft: false
toc: true
---

## 1. 빈 스코프란?

빈 스코프 (Bean Scope) 는 **빈이 존재할 수 있는 범위**이다. 지금까지는 기본 스코프인 싱글톤만 다뤘지만, 스프링은 다양한 스코프를 제공한다.

### 스프링이 지원하는 스코프

| 스코프 | 설명 |
|:---|:---|
| 싱글톤 | 기본 스코프, 컨테이너 시작부터 종료까지 유지 |
| 프로토타입 | 조회 시점마다 새 인스턴스 생성, 초기화까지만 관여 |
| request | HTTP 요청 ~ 응답까지 유지 |
| session | HTTP 세션 생성 ~ 종료까지 유지 |
| application | 서블릿 컨텍스트 생성 ~ 종료까지 유지 |
| websocket | 웹소켓 연결 ~ 종료까지 유지 |

### 스코프 지정 방법

```java
// 컴포넌트 스캔 방식
@Scope("prototype")
@Component
public class PrototypeBean { }

// 수동 등록 방식
@Scope("prototype")
@Bean
public PrototypeBean prototypeBean() {
    return new PrototypeBean();
}
```

---

## 2. 싱글톤 스코프

### 동작 방식

싱글톤 스코프의 빈은 컨테이너 안에 **단 한 개의 인스턴스**로 존재하고 항상 같은 인스턴스가 반환된다.

```
┌──────────────────────────────┐
│      스프링 컨테이너           │
│  ┌────────────────────────┐  │
│  │  SingletonBean@x01     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
   ▲         ▲         ▲
   │         │         │
ClientA   ClientB   ClientC
 (동일 인스턴스 공유)
```

```java
@Scope("singleton") // 기본값
@Component
static class SingletonBean {

    @PostConstruct
    public void init() {
        System.out.println("SingletonBean.init");
    }

    @PreDestroy
    public void destroy() {
        System.out.println("SingletonBean.destroy");
    }
}
```

```java
@Test
void singletonBeanFind() {
    var ac = new AnnotationConfigApplicationContext(SingletonBean.class);
    SingletonBean b1 = ac.getBean(SingletonBean.class);
    SingletonBean b2 = ac.getBean(SingletonBean.class);

    assertThat(b1).isSameAs(b2);
    ac.close();
}
```

```
SingletonBean.init
SingletonBean.destroy
```

---

## 3. 프로토타입 스코프

### 동작 방식

프로토타입 스코프 빈은 조회할 때마다 **새로운 인스턴스**가 생성된다. 컨테이너는 생성과 의존관계 주입, 초기화까지만 관여하고 **그 뒤로는 관리하지 않는다**. 소멸 콜백도 호출되지 않는다.

```
   getBean() 호출
        │
        ▼
┌──────────────────────┐
│   스프링 컨테이너      │
│  빈 생성 → DI         │
│  → init → 반환         │
│  (이후 관리 안 함)     │
└──────────────────────┘
    │        │        │
    ▼        ▼        ▼
 Proto@01 Proto@02 Proto@03
    │        │        │
    ▼        ▼        ▼
 ClientA  ClientB  ClientC
  (새 인스턴스)
```

```java
@Scope("prototype")
@Component
static class PrototypeBean {

    @PostConstruct
    public void init() {
        System.out.println("PrototypeBean.init");
    }

    @PreDestroy
    public void destroy() {
        // 호출되지 않는다!
        System.out.println("PrototypeBean.destroy");
    }
}
```

```java
@Test
void prototypeBeanFind() {
    var ac = new AnnotationConfigApplicationContext(PrototypeBean.class);

    PrototypeBean b1 = ac.getBean(PrototypeBean.class);
    PrototypeBean b2 = ac.getBean(PrototypeBean.class);

    assertThat(b1).isNotSameAs(b2);
    ac.close(); // destroy 호출 안 됨
}
```

### 싱글톤 vs 프로토타입

| 항목 | 싱글톤 | 프로토타입 |
|:---|:---|:---|
| 인스턴스 | 1개 | 조회마다 생성 |
| 초기화 콜백 | O | O |
| 소멸 콜백 | O | X |
| 관리 주체 | 스프링 컨테이너 | 클라이언트 |

{{< callout type="warning" >}}
프로토타입 빈의 소멸 로직은 스프링이 대신 호출해주지 않는다. 사용이 끝난 뒤에는 **클라이언트가 직접 정리**해야 한다.
{{< /callout >}}

---

## 4. 싱글톤에 프로토타입을 주입하면?

### 문제 상황

싱글톤 빈이 프로토타입 빈을 **필드로 주입받으면**, 주입은 딱 한 번만 일어나기 때문에 매번 새 인스턴스를 얻지 못한다.

```java
@Scope("prototype")
@Component
static class PrototypeBean {
    private int count = 0;
    public void addCount() { count++; }
    public int getCount() { return count; }
}

@Scope("singleton")
@Component
@RequiredArgsConstructor
static class ClientBean {
    // 주입 시점에 1번만 생성된 프로토타입 인스턴스를 계속 재사용
    private final PrototypeBean prototypeBean;

    public int logic() {
        prototypeBean.addCount();
        return prototypeBean.getCount();
    }
}
```

```java
@Test
void singletonClientUsePrototype() {
    var ac = new AnnotationConfigApplicationContext(
        ClientBean.class, PrototypeBean.class);

    ClientBean c1 = ac.getBean(ClientBean.class);
    assertThat(c1.logic()).isEqualTo(1);

    ClientBean c2 = ac.getBean(ClientBean.class);
    assertThat(c2.logic()).isEqualTo(2); // 기대 1, 실제 2
}
```

```
문제 구조
┌──────────────────────────────┐
│     싱글톤 ClientBean          │
│  ┌────────────────────────┐  │
│  │ prototypeBean           │  │
│  │ (1번만 주입된 인스턴스)  │  │
│  └────────────────────────┘  │
│                              │
│  logic() 호출 → count 누적   │
└──────────────────────────────┘
```

사용자가 기대한 동작은 "`logic()` 호출마다 새 프로토타입을 받는 것" 이지만, 실제로는 주입 시점의 인스턴스가 계속 재사용된다.

---

## 5. 해결책: Provider

### 방법 1: ObjectProvider (스프링 제공, 권장)

`ObjectProvider` 는 스프링 컨테이너를 통해 빈을 조회하는 헬퍼이다. `getObject()` 를 호출할 때마다 컨테이너에서 프로토타입 빈을 새로 가져온다.

```java
@Scope("singleton")
@Component
static class ClientBean {

    @Autowired
    private ObjectProvider<PrototypeBean> prototypeProvider;

    public int logic() {
        PrototypeBean bean = prototypeProvider.getObject();
        bean.addCount();
        return bean.getCount();
    }
}
```

```java
@Test
void usePrototypeWithProvider() {
    var ac = new AnnotationConfigApplicationContext(
        ClientBean.class, PrototypeBean.class);

    ClientBean c1 = ac.getBean(ClientBean.class);
    assertThat(c1.logic()).isEqualTo(1);

    ClientBean c2 = ac.getBean(ClientBean.class);
    assertThat(c2.logic()).isEqualTo(1); // 새 인스턴스
}
```

```java
public interface ObjectProvider<T>
    extends ObjectFactory<T>, Iterable<T> {

    T getObject();                 // 빈 조회
    T getObject(Object... args);   // 인자 전달
    T getIfAvailable();            // 없으면 null
    T getIfUnique();               // 유일하지 않으면 null
    Stream<T> stream();            // 스트림 조회
}
```

### 방법 2: JSR-330 Provider (자바 표준)

```java
// 스프링 부트 3.0+: jakarta.inject.Provider
// 스프링 부트 2.x : javax.inject.Provider
import jakarta.inject.Provider;

@Scope("singleton")
@Component
static class ClientBean {

    @Autowired
    private Provider<PrototypeBean> prototypeProvider;

    public int logic() {
        PrototypeBean bean = prototypeProvider.get(); // get()
        bean.addCount();
        return bean.getCount();
    }
}
```

### ObjectProvider vs JSR-330 Provider

| 항목 | ObjectProvider | JSR-330 Provider |
|:---|:---|:---|
| 제공 주체 | 스프링 | 자바 표준 |
| 메서드 | `getObject()`, `getIfAvailable()`, `stream()` | `get()` |
| 부가 기능 | 다양함 | 단순함 |
| 의존성 | 스프링 | 별도 라이브러리 (부트 3.0+ 는 내장) |

{{< callout type="info" >}}
대부분의 경우 `ObjectProvider` 로 충분하다. 스프링에 종속되지 않는 코드를 원하거나 다른 DI 프레임워크와 호환이 필요할 때 `Provider` 를 고려한다.
{{< /callout >}}

---

## 6. 웹 스코프

### 웹 스코프의 특징

- **웹 환경에서만** 동작한다.
- 스프링이 해당 스코프의 종료 시점까지 관리하므로 **소멸 콜백도 호출**된다 (프로토타입과 다르다).

| 스코프 | 생명주기 |
|:---|:---|
| request | HTTP 요청 ~ 응답 |
| session | HTTP 세션 ~ 종료 |
| application | 서블릿 컨텍스트 ~ 종료 |
| websocket | 웹소켓 연결 ~ 종료 |

### 스코프별 생명주기 비교

```
싱글톤
┌─────────────────────────┐
│ 컨테이너 시작          │
│   │                     │
│   ├ Bean 생성           │
│   │                     │
│   │  ... 사용 ...         │
│   │                     │
│   └ Bean 소멸           │
│ 컨테이너 종료          │
└─────────────────────────┘

프로토타입
┌─────────────────────────┐
│ getBean() 호출          │
│   │                     │
│   └ Bean 생성           │
│      (이후 관리 X)       │
└─────────────────────────┘

request 스코프
┌─────────────────────────┐
│ HTTP 요청 도착          │
│   │                     │
│   ├ Bean 생성            │
│   │   (요청별 격리)      │
│   │                     │
│   └ Bean 소멸           │
│ HTTP 응답 전송          │
└─────────────────────────┘
```

### request 스코프 예제

HTTP 요청마다 고유한 식별자로 로그를 남기는 기능을 구현한다.

```java
@Scope(value = "request")
@Component
public class MyLogger {

    private String uuid;
    private String requestURL;

    public void setRequestURL(String url) {
        this.requestURL = url;
    }

    public void log(String message) {
        System.out.println("[" + uuid + "]["
            + requestURL + "] " + message);
    }

    @PostConstruct
    public void init() {
        uuid = UUID.randomUUID().toString();
        System.out.println("[" + uuid + "] create " + this);
    }

    @PreDestroy
    public void close() {
        System.out.println("[" + uuid + "] close " + this);
    }
}
```

### 주입 시 발생하는 문제

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final MyLogger myLogger; // 애플리케이션 시작 시 오류!
}
```

```
Scope 'request' is not active for the current thread;
consider defining a scoped proxy for this bean if you intend
to refer to it from a singleton;
```

{{< callout type="warning" >}}
애플리케이션이 기동될 때는 HTTP 요청이 아직 존재하지 않기 때문에, request 스코프 빈은 이 시점에 생성될 수 없다. 싱글톤 컨트롤러에 바로 주입하려 하면 오류가 발생한다. 해결 방법은 `ObjectProvider` 를 쓰거나 **스코프 프록시**를 사용하는 것이다.
{{< /callout >}}

---

## 7. 해결책 1: ObjectProvider

요청이 실제로 들어온 시점에 `getObject()` 로 빈을 가져오면, 이때 request 스코프가 활성화되어 있으므로 정상 동작한다.

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final ObjectProvider<MyLogger> myLoggerProvider;

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        MyLogger myLogger = myLoggerProvider.getObject();
        myLogger.setRequestURL(request.getRequestURL().toString());

        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

```java
@Service
@RequiredArgsConstructor
public class LogDemoService {

    private final ObjectProvider<MyLogger> myLoggerProvider;

    public void logic(String id) {
        MyLogger myLogger = myLoggerProvider.getObject();
        myLogger.log("service id = " + id);
    }
}
```

동일한 HTTP 요청 안에서는 `getObject()` 를 여러 번 호출해도 **같은 인스턴스**가 반환된다 (request 스코프의 성질).

---

## 8. 해결책 2: 스코프 프록시

`proxyMode` 를 지정하면, 스프링이 **가짜 프록시 객체**를 싱글톤으로 만들어 주입해준다. 실제 메서드 호출 시점에 프록시가 request 스코프의 진짜 빈을 찾아 위임한다.

```java
@Scope(value = "request",
       proxyMode = ScopedProxyMode.TARGET_CLASS)
@Component
public class MyLogger {
    // 기존과 동일
}
```

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final MyLogger myLogger; // 프록시 주입

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        myLogger.setRequestURL(request.getRequestURL().toString());
        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

### 프록시 구조

```
┌──────────────────────────────┐
│     스프링 컨테이너           │
│  ┌────────────────────────┐  │
│  │ MyLogger$$CGLIB        │  │
│  │ (가짜 프록시, 싱글톤)   │  │
│  └───────────┬────────────┘  │
│              │ 요청 시 위임    │
│              ▼                │
│  ┌────────────────────────┐  │
│  │ MyLogger (실제 빈)      │  │
│  │ (요청마다 새로 생성)     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

```java
System.out.println(myLogger.getClass());
// class ...MyLogger$$SpringCGLIB$$0
```

### proxyMode 옵션

| 옵션 | 설명 |
|:---|:---|
| `DEFAULT` / `NO` | 프록시 사용 안 함 (기본값) |
| `TARGET_CLASS` | CGLIB 프록시 (클래스 기반) |
| `INTERFACES` | JDK 동적 프록시 (인터페이스 기반) |

### Provider vs 프록시

| 비교 | Provider | 프록시 |
|:---|:---|:---|
| 사용법 | `provider.getObject()` 명시 호출 | 필드를 직접 사용 |
| 가독성 | 명시적 | 투명함 (싱글톤처럼 보임) |
| 주의점 | - | 실제 동작이 주입 시점과 다르므로 주의 |

{{< callout type="warning" >}}
프록시는 편리하지만, 겉보기에는 싱글톤처럼 보여도 실제로는 요청마다 다른 인스턴스가 뒤에서 동작한다. 남발하면 디버깅과 유지보수가 어려워지므로 **정말 필요한 경우에만** 사용하자. 핵심 아이디어는 "실제 객체의 조회를 꼭 필요한 시점까지 지연시키는 것" 이다.
{{< /callout >}}

---

## 9. 실전 예제: 요청별 트랜잭션 ID

```java
@Scope(value = "request",
       proxyMode = ScopedProxyMode.TARGET_CLASS)
@Component
@Getter
public class RequestContext {

    private final String traceId;
    private final LocalDateTime requestTime;
    private String requestURI;

    public RequestContext() {
        this.traceId = UUID.randomUUID()
            .toString().substring(0, 8);
        this.requestTime = LocalDateTime.now();
    }

    public void setRequestURI(String uri) {
        this.requestURI = uri;
    }

    @PostConstruct
    public void init() {
        System.out.println("[" + traceId + "] created");
    }

    @PreDestroy
    public void close() {
        System.out.println("[" + traceId + "] destroyed");
    }
}
```

```java
@RestController
@RequiredArgsConstructor
public class OrderController {

    private final RequestContext requestContext;
    private final OrderService orderService;

    @PostMapping("/orders")
    public String createOrder(@RequestBody OrderRequest req) {
        System.out.println("["
            + requestContext.getTraceId()
            + "] Creating order...");
        orderService.createOrder(req);
        return "Order created with traceId: "
            + requestContext.getTraceId();
    }
}

@Service
@RequiredArgsConstructor
public class OrderService {

    private final RequestContext requestContext;

    public void createOrder(OrderRequest req) {
        System.out.println("["
            + requestContext.getTraceId()
            + "] Processing order...");
    }
}
```

동일 요청 안에서는 컨트롤러와 서비스가 같은 `traceId` 를 공유하고, 다른 요청은 서로 격리된다.

---

## 10. 정리

### 스코프별 특징

| 스코프 | 생성 시점 | 소멸 시점 | 관리 주체 |
|:---|:---|:---|:---|
| 싱글톤 | 컨테이너 시작 | 컨테이너 종료 | 스프링 |
| 프로토타입 | 조회 시 | - (관리 X) | 클라이언트 |
| request | HTTP 요청 | HTTP 응답 | 스프링 |

### 핵심 정리

- 프로토타입 빈을 싱글톤 빈에 직접 주입하면 의도대로 동작하지 않는다
- 해결책은 `ObjectProvider`, JSR-330 `Provider`, 또는 스코프 프록시
- 웹 스코프는 요청/세션 등 특정 라이프사이클에 종속되는 빈에 사용
- 프록시는 편리하지만 남용 금지

### 체크리스트

- [ ] 싱글톤 빈 안에서 프로토타입을 직접 필드로 들고 있지 않은가?
- [ ] 웹 스코프 빈을 싱글톤에 주입할 때 `Provider` 나 프록시를 사용했는가?
- [ ] 프로토타입 빈의 소멸 로직은 클라이언트가 책임지고 있는가?
- [ ] 프록시가 정말 필요한 상황인지 검토했는가?

---

## 참고 자료

- [Spring Framework - Bean Scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)
- [JSR-330: Dependency Injection for Java](https://jcp.org/en/jsr/detail?id=330)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
