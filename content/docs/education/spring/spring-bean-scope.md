---
title: "빈 스코프"
description: "스프링 빈의 다양한 스코프와 프로토타입, 웹 스코프의 동작 원리를 상세히 알아본다"
summary: "싱글톤, 프로토타입, request 스코프, ObjectProvider, 프록시를 활용한 스코프 관리"
date: 2025-01-06
weight: 7
draft: false
toc: true
---

## 빈 스코프란?

빈 스코프(Bean Scope)는 **빈이 존재할 수 있는 범위**를 의미한다.

### 스프링이 지원하는 스코프

| 스코프 | 설명 |
|--------|------|
| **싱글톤** | 기본 스코프, 컨테이너 시작~종료까지 유지 |
| **프로토타입** | 요청할 때마다 새로운 인스턴스 생성, 컨테이너는 생성과 초기화까지만 관여 |
| **request** | 웹 요청이 들어오고 나갈 때까지 유지 |
| **session** | 웹 세션이 생성되고 종료될 때까지 유지 |
| **application** | 웹 서블릿 컨텍스트와 같은 범위로 유지 |
| **websocket** | 웹소켓과 동일한 생명주기로 유지 |

### 스코프 지정 방법

```java
// 컴포넌트 스캔 자동 등록
@Scope("prototype")
@Component
public class PrototypeBean { }

// 수동 등록
@Scope("prototype")
@Bean
public PrototypeBean prototypeBean() {
    return new PrototypeBean();
}
```

---

## 싱글톤 스코프

### 동작 방식

싱글톤 스코프의 빈은 스프링 컨테이너에서 **항상 같은 인스턴스**를 반환한다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      스프링 컨테이너                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              싱글톤 빈 인스턴스                          │    │
│  │              SingletonBean@x01                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                     ↑           ↑           ↑                   │
│                   반환        반환        반환                   │
└─────────────────────────────────────────────────────────────────┘
                      │           │           │
               클라이언트 A    클라이언트 B   클라이언트 C
               (같은 인스턴스)  (같은 인스턴스)  (같은 인스턴스)
```

```java
@Test
void singletonBeanFind() {
    AnnotationConfigApplicationContext ac =
        new AnnotationConfigApplicationContext(SingletonBean.class);

    SingletonBean bean1 = ac.getBean(SingletonBean.class);
    SingletonBean bean2 = ac.getBean(SingletonBean.class);

    System.out.println("bean1 = " + bean1);
    System.out.println("bean2 = " + bean2);

    assertThat(bean1).isSameAs(bean2);  // 같은 인스턴스

    ac.close();
}

@Scope("singleton")  // 기본값
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

```
출력:
SingletonBean.init
bean1 = hello.core.scope.SingletonBean@12345
bean2 = hello.core.scope.SingletonBean@12345
SingletonBean.destroy
```

---

## 프로토타입 스코프

### 동작 방식

프로토타입 스코프의 빈은 스프링 컨테이너에 요청할 때마다 **새로운 인스턴스**를 생성하여 반환한다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      스프링 컨테이너                              │
│                                                                  │
│  1. 요청 → 새로운 빈 생성 → 의존관계 주입 → 초기화 → 반환        │
│                                                                  │
│      더 이상 관리하지 않음! (소멸 콜백 호출 X)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
          ↓                   ↓                   ↓
   PrototypeBean@x01   PrototypeBean@x02   PrototypeBean@x03
          ↓                   ↓                   ↓
    클라이언트 A          클라이언트 B          클라이언트 C
    (새 인스턴스)         (새 인스턴스)         (새 인스턴스)
```

```java
@Test
void prototypeBeanFind() {
    AnnotationConfigApplicationContext ac =
        new AnnotationConfigApplicationContext(PrototypeBean.class);

    System.out.println("find prototypeBean1");
    PrototypeBean bean1 = ac.getBean(PrototypeBean.class);

    System.out.println("find prototypeBean2");
    PrototypeBean bean2 = ac.getBean(PrototypeBean.class);

    System.out.println("bean1 = " + bean1);
    System.out.println("bean2 = " + bean2);

    assertThat(bean1).isNotSameAs(bean2);  // 다른 인스턴스

    ac.close();  // 컨테이너 종료해도 destroy 호출 안 됨
}

@Scope("prototype")
@Component
static class PrototypeBean {

    @PostConstruct
    public void init() {
        System.out.println("PrototypeBean.init");
    }

    @PreDestroy
    public void destroy() {
        System.out.println("PrototypeBean.destroy");  // 호출되지 않음!
    }
}
```

```
출력:
find prototypeBean1
PrototypeBean.init
find prototypeBean2
PrototypeBean.init
bean1 = hello.core.scope.PrototypeBean@12345
bean2 = hello.core.scope.PrototypeBean@67890
(destroy 호출 없음!)
```

### 프로토타입 빈의 특징

| 항목 | 싱글톤 | 프로토타입 |
|------|--------|-----------|
| 인스턴스 | 하나만 생성 | 요청마다 생성 |
| 초기화 콜백 | O | O |
| 소멸 콜백 | O | **X** |
| 관리 주체 | 스프링 컨테이너 | **클라이언트** |

```java
// 프로토타입 빈의 소멸은 클라이언트가 직접 처리
@Test
void prototypeBeanDestroy() {
    AnnotationConfigApplicationContext ac =
        new AnnotationConfigApplicationContext(PrototypeBean.class);

    PrototypeBean bean = ac.getBean(PrototypeBean.class);

    // 클라이언트가 직접 종료 메서드 호출
    bean.destroy();

    ac.close();
}
```

---

## 프로토타입 스코프 - 싱글톤 빈과 함께 사용 시 문제점

### 문제 상황

싱글톤 빈이 프로토타입 빈을 의존관계 주입받을 경우, **의도와 다르게 동작**할 수 있다.

```java
@Scope("prototype")
@Component
static class PrototypeBean {
    private int count = 0;

    public void addCount() {
        count++;
    }

    public int getCount() {
        return count;
    }

    @PostConstruct
    public void init() {
        System.out.println("PrototypeBean.init " + this);
    }

    @PreDestroy
    public void destroy() {
        System.out.println("PrototypeBean.destroy");
    }
}

@Scope("singleton")
@Component
@RequiredArgsConstructor
static class ClientBean {
    private final PrototypeBean prototypeBean;  // 주입 시점에 1번만 생성됨

    public int logic() {
        prototypeBean.addCount();
        return prototypeBean.getCount();
    }
}
```

```java
@Test
void singletonClientUsePrototype() {
    AnnotationConfigApplicationContext ac =
        new AnnotationConfigApplicationContext(ClientBean.class, PrototypeBean.class);

    ClientBean clientBean1 = ac.getBean(ClientBean.class);
    int count1 = clientBean1.logic();
    assertThat(count1).isEqualTo(1);

    ClientBean clientBean2 = ac.getBean(ClientBean.class);
    int count2 = clientBean2.logic();
    assertThat(count2).isEqualTo(2);  // 예상: 1, 실제: 2 !!!
}
```

```
문제 상황 설명:
┌──────────────────────────────────────────────────────────────────┐
│                        싱글톤 ClientBean                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  prototypeBean (주입 시점에 1번만 생성된 인스턴스)          │   │
│  │  PrototypeBean@x01                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  clientBean1.logic() → count = 1                                │
│  clientBean2.logic() → count = 2 (같은 prototypeBean 사용!)     │
└──────────────────────────────────────────────────────────────────┘
```

### 기대하는 동작

매번 `logic()`을 호출할 때마다 새로운 프로토타입 빈을 사용하고 싶다!

---

## 프로토타입 스코프 문제 해결 - Provider

### 방법 1: ObjectFactory, ObjectProvider (스프링 제공)

```java
@Scope("singleton")
@Component
static class ClientBean {

    @Autowired
    private ObjectProvider<PrototypeBean> prototypeBeanProvider;

    public int logic() {
        // 호출할 때마다 새로운 프로토타입 빈 생성
        PrototypeBean prototypeBean = prototypeBeanProvider.getObject();
        prototypeBean.addCount();
        return prototypeBean.getCount();
    }
}
```

```java
@Test
void singletonClientUsePrototypeWithProvider() {
    AnnotationConfigApplicationContext ac =
        new AnnotationConfigApplicationContext(ClientBean.class, PrototypeBean.class);

    ClientBean clientBean1 = ac.getBean(ClientBean.class);
    int count1 = clientBean1.logic();
    assertThat(count1).isEqualTo(1);

    ClientBean clientBean2 = ac.getBean(ClientBean.class);
    int count2 = clientBean2.logic();
    assertThat(count2).isEqualTo(1);  // 새로운 프로토타입 빈 사용!
}
```

**ObjectProvider 주요 기능**:

```java
public interface ObjectProvider<T> extends ObjectFactory<T>, Iterable<T> {

    T getObject();                    // 빈 조회

    T getObject(Object... args);      // 빈 조회 (생성자 파라미터)

    T getIfAvailable();               // 빈이 없으면 null 반환

    T getIfUnique();                  // 빈이 유일하지 않으면 null 반환

    Stream<T> stream();               // 스트림으로 조회

    // ...
}
```

### 방법 2: JSR-330 Provider (자바 표준)

```java
// 스프링 부트 3.0 미만
import javax.inject.Provider;

// 스프링 부트 3.0 이상
import jakarta.inject.Provider;
```

```java
@Scope("singleton")
@Component
static class ClientBean {

    @Autowired
    private Provider<PrototypeBean> prototypeBeanProvider;

    public int logic() {
        PrototypeBean prototypeBean = prototypeBeanProvider.get();  // get() 사용
        prototypeBean.addCount();
        return prototypeBean.getCount();
    }
}
```

**의존성 추가** (스프링 부트 3.0 미만):

```groovy
// build.gradle
dependencies {
    implementation 'javax.inject:javax.inject:1'
}
```

### ObjectProvider vs JSR-330 Provider

| 항목 | ObjectProvider | JSR-330 Provider |
|------|---------------|------------------|
| **제공** | 스프링 | 자바 표준 |
| **메서드** | getObject(), getIfAvailable(), stream() 등 | get() |
| **기능** | 다양한 편의 기능 | 단순함 |
| **의존성** | 스프링 | 별도 라이브러리 필요 (부트 3.0+ 제외) |

> **권장**: 대부분의 경우 `ObjectProvider`를 사용하되, 스프링에 의존하지 않으려면 `Provider` 사용

---

## 웹 스코프

### 웹 스코프의 특징

- **웹 환경에서만** 동작
- 스프링이 **해당 스코프의 종료 시점까지 관리** → 소멸 콜백 호출됨

| 스코프 | 생명주기 |
|--------|----------|
| **request** | HTTP 요청 ~ 응답 |
| **session** | HTTP 세션 생성 ~ 종료 |
| **application** | 서블릿 컨텍스트 생성 ~ 종료 |
| **websocket** | 웹소켓 연결 ~ 종료 |

### request 스코프 예제

HTTP 요청마다 로그를 남기는 기능을 구현해보자.

```java
@Scope(value = "request")
@Component
public class MyLogger {

    private String uuid;
    private String requestURL;

    public void setRequestURL(String requestURL) {
        this.requestURL = requestURL;
    }

    public void log(String message) {
        System.out.println("[" + uuid + "]" + "[" + requestURL + "] " + message);
    }

    @PostConstruct
    public void init() {
        uuid = UUID.randomUUID().toString();
        System.out.println("[" + uuid + "] request scope bean create: " + this);
    }

    @PreDestroy
    public void close() {
        System.out.println("[" + uuid + "] request scope bean close: " + this);
    }
}
```

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final MyLogger myLogger;  // ❌ 오류 발생!

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        String requestURL = request.getRequestURL().toString();
        myLogger.setRequestURL(requestURL);

        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

### 문제: request 스코프 빈 주입 오류

```
Error creating bean with name 'myLogger': Scope 'request' is not active for the
current thread; consider defining a scoped proxy for this bean if you intend to
refer to it from a singleton;
```

**원인**: 애플리케이션 시작 시점에는 HTTP 요청이 없어서 request 스코프 빈을 생성할 수 없다.

---

## 스코프와 Provider

### ObjectProvider로 해결

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final ObjectProvider<MyLogger> myLoggerProvider;  // Provider 사용

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        MyLogger myLogger = myLoggerProvider.getObject();  // HTTP 요청 시점에 빈 생성
        String requestURL = request.getRequestURL().toString();
        myLogger.setRequestURL(requestURL);

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
        MyLogger myLogger = myLoggerProvider.getObject();  // 같은 요청이면 같은 빈
        myLogger.log("service id = " + id);
    }
}
```

```
출력 (요청 1):
[d06b992f-...] request scope bean create: hello.core.common.MyLogger@...
[d06b992f-...][http://localhost:8080/log-demo] controller test
[d06b992f-...][http://localhost:8080/log-demo] service id = testId
[d06b992f-...] request scope bean close: hello.core.common.MyLogger@...

출력 (요청 2):
[a8e5c3b2-...] request scope bean create: hello.core.common.MyLogger@...
[a8e5c3b2-...][http://localhost:8080/log-demo] controller test
[a8e5c3b2-...][http://localhost:8080/log-demo] service id = testId
[a8e5c3b2-...] request scope bean close: hello.core.common.MyLogger@...
```

---

## 스코프와 프록시

### 프록시 방식으로 해결

`proxyMode`를 설정하면 **가짜 프록시 객체**를 주입하여 마치 싱글톤처럼 사용할 수 있다.

```java
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)  // 프록시 모드
@Component
public class MyLogger {
    // ... 동일
}
```

```java
@Controller
@RequiredArgsConstructor
public class LogDemoController {

    private final LogDemoService logDemoService;
    private final MyLogger myLogger;  // 프록시 객체가 주입됨

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        String requestURL = request.getRequestURL().toString();
        myLogger.setRequestURL(requestURL);  // 프록시가 실제 빈에 위임

        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

### 프록시 동작 원리

```
┌─────────────────────────────────────────────────────────────────────┐
│                          스프링 컨테이너                              │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │     MyLogger$$SpringCGLIB$$0 (가짜 프록시 객체)              │   │
│   │     - 싱글톤으로 미리 생성                                   │   │
│   │     - 요청 시 실제 MyLogger 빈을 찾아서 위임                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼ 요청 시 위임                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │     MyLogger (실제 request 스코프 빈)                        │   │
│   │     - HTTP 요청마다 새로 생성                                │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

```java
// 주입된 객체 확인
System.out.println("myLogger = " + myLogger.getClass());
// 출력: myLogger = class hello.core.common.MyLogger$$SpringCGLIB$$0
```

### proxyMode 옵션

| 옵션 | 설명 |
|------|------|
| `ScopedProxyMode.DEFAULT` | 프록시 사용 안 함 (기본값) |
| `ScopedProxyMode.NO` | 프록시 사용 안 함 |
| `ScopedProxyMode.TARGET_CLASS` | **CGLIB** 프록시 (클래스 기반) |
| `ScopedProxyMode.INTERFACES` | **JDK 동적 프록시** (인터페이스 기반) |

```java
// 인터페이스 기반 프록시
public interface MyLogger { ... }

@Scope(value = "request", proxyMode = ScopedProxyMode.INTERFACES)
@Component
public class MyLoggerImpl implements MyLogger { ... }
```

### Provider vs 프록시

| 비교 | Provider | 프록시 |
|------|----------|--------|
| **코드** | `provider.getObject()` 호출 필요 | 직접 빈 사용 가능 |
| **가독성** | 명시적 | 투명함 (싱글톤처럼 보임) |
| **주의점** | - | 싱글톤처럼 보여서 주의 필요 |

---

## 실전 예제: 요청별 트랜잭션 ID

```java
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
@Component
@Getter
public class RequestContext {

    private final String traceId;
    private final LocalDateTime requestTime;
    private String requestURI;

    public RequestContext() {
        this.traceId = UUID.randomUUID().toString().substring(0, 8);
        this.requestTime = LocalDateTime.now();
    }

    public void setRequestURI(String requestURI) {
        this.requestURI = requestURI;
    }

    @PostConstruct
    public void init() {
        System.out.println("[" + traceId + "] RequestContext created");
    }

    @PreDestroy
    public void close() {
        System.out.println("[" + traceId + "] RequestContext destroyed");
    }
}
```

```java
@Component
@RequiredArgsConstructor
public class RequestContextFilter implements Filter {

    private final RequestContext requestContext;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                        FilterChain chain) throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        requestContext.setRequestURI(httpRequest.getRequestURI());

        System.out.println("[" + requestContext.getTraceId() + "] "
            + httpRequest.getMethod() + " " + httpRequest.getRequestURI());

        chain.doFilter(request, response);
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
    public String createOrder(@RequestBody OrderRequest request) {
        // 동일한 요청 내에서 같은 traceId 사용
        System.out.println("[" + requestContext.getTraceId() + "] Creating order...");
        orderService.createOrder(request);
        return "Order created with traceId: " + requestContext.getTraceId();
    }
}

@Service
@RequiredArgsConstructor
public class OrderService {

    private final RequestContext requestContext;

    public void createOrder(OrderRequest request) {
        // 같은 요청이면 같은 traceId
        System.out.println("[" + requestContext.getTraceId() + "] Processing order...");
    }
}
```

---

## 정리

### 스코프별 특징

| 스코프 | 생성 시점 | 소멸 시점 | 관리 주체 |
|--------|----------|----------|----------|
| **싱글톤** | 컨테이너 시작 | 컨테이너 종료 | 스프링 |
| **프로토타입** | 조회 시 | - | 클라이언트 |
| **request** | HTTP 요청 | HTTP 응답 | 스프링 |

### 프로토타입 빈 주의사항

- 싱글톤 빈에서 직접 주입받으면 의도대로 동작 안 함
- `ObjectProvider` 또는 `Provider` 사용 권장

### 웹 스코프 처리 방법

| 방법 | 설명 |
|------|------|
| **ObjectProvider** | 명시적으로 빈 조회 |
| **프록시** | 싱글톤처럼 사용, 내부에서 위임 |

### 프록시 사용 시 주의사항

> 프록시를 사용하면 마치 싱글톤을 사용하는 것 같지만, 실제로는 다르게 동작하므로 주의해야 한다. 무분별하게 사용하면 유지보수가 어려워진다.

**핵심 아이디어**: 진짜 객체 조회를 꼭 필요한 시점까지 지연 처리한다.

---

## 참고 자료

- [Spring Framework - Bean Scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)
- [JSR-330: Dependency Injection for Java](https://jcp.org/en/jsr/detail?id=330)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
