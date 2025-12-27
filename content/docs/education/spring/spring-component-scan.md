---
title: "컴포넌트 스캔"
description: "스프링의 컴포넌트 스캔 기능과 자동 빈 등록 메커니즘을 상세히 알아본다"
summary: "@ComponentScan의 동작 원리, 탐색 위치, 필터, 빈 충돌 처리 방법"
date: 2025-01-06
weight: 4
draft: false
toc: true
---

## 컴포넌트 스캔이란?

### 수동 빈 등록의 한계

`@Bean`을 통해 설정 정보에 빈을 일일이 등록하는 방식은 등록할 빈이 많아지면 관리가 어려워진다.

```java
@Configuration
public class AppConfig {
    @Bean
    public MemberService memberService() { ... }

    @Bean
    public MemberRepository memberRepository() { ... }

    @Bean
    public OrderService orderService() { ... }

    @Bean
    public DiscountPolicy discountPolicy() { ... }

    // 빈이 수십, 수백 개가 되면?
    // 누락, 오타 위험 증가
}
```

### 컴포넌트 스캔의 등장

스프링은 설정 정보 없이도 자동으로 스프링 빈을 등록하는 **컴포넌트 스캔** 기능을 제공한다.

```java
@Configuration
@ComponentScan(
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ANNOTATION,
        classes = Configuration.class
    )  // 예제를 위해 기존 AppConfig 제외
)
public class AutoAppConfig {
    // @Bean 없이 자동으로 빈 등록!
}
```

---

## @Component와 @Autowired

### @Component 애노테이션

`@Component`가 붙은 클래스는 스프링 빈으로 자동 등록된다.

```java
@Component
public class MemoryMemberRepository implements MemberRepository {

    private static Map<Long, Member> store = new HashMap<>();

    @Override
    public void save(Member member) {
        store.put(member.getId(), member);
    }

    @Override
    public Member findById(Long memberId) {
        return store.get(memberId);
    }
}

@Component
public class RateDiscountPolicy implements DiscountPolicy {

    private int discountPercent = 10;

    @Override
    public int discount(Member member, int price) {
        if (member.getGrade() == Grade.VIP) {
            return price * discountPercent / 100;
        }
        return 0;
    }
}
```

### @Autowired 의존관계 자동 주입

`@Autowired`를 사용하면 스프링 컨테이너가 자동으로 해당 타입의 빈을 찾아서 주입한다.

```java
@Component
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;

    @Autowired  // 자동으로 MemberRepository 타입의 빈 주입
    public MemberServiceImpl(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    // ...
}

@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    @Autowired  // 여러 파라미터도 자동 주입
    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }

    // ...
}
```

---

## 컴포넌트 스캔 동작 과정

### 1단계: @ComponentScan

```
┌─────────────────────────────────────────────────────────────────┐
│                    @ComponentScan                                │
│                                                                  │
│    패키지 탐색 → @Component 발견 → 빈 등록                        │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │@Component   │    │@Component   │    │@Component   │
   │MemoryMember │    │ MemberService│    │ OrderService│
   │ Repository  │    │    Impl     │    │    Impl     │
   └─────────────┘    └─────────────┘    └─────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      스프링 컨테이너                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  memoryMemberRepository: MemoryMemberRepository          │  │
│  │  memberServiceImpl: MemberServiceImpl                    │  │
│  │  orderServiceImpl: OrderServiceImpl                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**빈 이름 규칙**:
- 기본값: 클래스명의 첫 글자를 소문자로 변환
  - `MemberServiceImpl` → `memberServiceImpl`
- 직접 지정: `@Component("customName")`

### 2단계: @Autowired 의존관계 자동 주입

```
┌─────────────────────────────────────────────────────────────────┐
│                      스프링 컨테이너                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  memoryMemberRepository: MemoryMemberRepository          │  │
│  │  memberServiceImpl: MemberServiceImpl                    │  │
│  │  orderServiceImpl: OrderServiceImpl                      │  │
│  │  rateDiscountPolicy: RateDiscountPolicy                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 타입으로 빈 조회
┌─────────────────────────────────────────────────────────────────┐
│  OrderServiceImpl 생성자                                         │
│  @Autowired                                                      │
│  public OrderServiceImpl(                                        │
│      MemberRepository memberRepository,    ← MemoryMemberRepository │
│      DiscountPolicy discountPolicy         ← RateDiscountPolicy  │
│  )                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 탐색 위치와 기본 스캔 대상

### 탐색 시작 위치 지정

```java
@ComponentScan(
    basePackages = "hello.core"  // 이 패키지를 포함한 하위 패키지 모두 탐색
)

@ComponentScan(
    basePackages = {"hello.core", "hello.service"}  // 여러 시작 위치 지정
)

@ComponentScan(
    basePackageClasses = AutoAppConfig.class  // 이 클래스의 패키지가 시작 위치
)
```

### 권장 방법: 패키지 위치를 지정하지 않음

프로젝트 최상단에 설정 클래스를 두고 `@ComponentScan`을 붙인다.

```
hello.core
├── AutoAppConfig.java    ← 여기에 @ComponentScan (basePackages 지정 안 함)
├── member
│   ├── Member.java
│   ├── MemberRepository.java
│   └── MemberServiceImpl.java
├── order
│   ├── Order.java
│   └── OrderServiceImpl.java
└── discount
    ├── DiscountPolicy.java
    └── RateDiscountPolicy.java
```

```java
// 프로젝트 최상단에 위치
@Configuration
@ComponentScan
public class AutoAppConfig {
    // basePackages 지정 없음 → 이 클래스의 패키지(hello.core)부터 탐색
}
```

> **참고**: 스프링 부트의 `@SpringBootApplication` 안에 `@ComponentScan`이 포함되어 있다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = {
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication {
    // ...
}
```

### 기본 스캔 대상

컴포넌트 스캔은 `@Component`뿐만 아니라 다음 애노테이션도 스캔 대상에 포함한다:

| 애노테이션 | 설명 | 부가 기능 |
|-----------|------|----------|
| `@Component` | 컴포넌트 스캔의 기본 대상 | - |
| `@Controller` | 스프링 MVC 컨트롤러 | MVC 컨트롤러로 인식 |
| `@Service` | 비즈니스 서비스 계층 | 특별한 처리 없음 (비즈니스 계층 표시) |
| `@Repository` | 데이터 접근 계층 | 데이터 계층 예외를 스프링 예외로 변환 |
| `@Configuration` | 스프링 설정 정보 | 스프링 빈 싱글톤 유지 보장 |

```java
// @Controller 내부
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component  // @Component 포함!
public @interface Controller {
}

// @Service 내부
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component  // @Component 포함!
public @interface Service {
}

// @Repository 내부
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component  // @Component 포함!
public @interface Repository {
}
```

---

## 필터

### includeFilters와 excludeFilters

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface MyIncludeComponent {
    // 스캔 대상에 추가할 애노테이션
}

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface MyExcludeComponent {
    // 스캔 대상에서 제외할 애노테이션
}
```

```java
@MyIncludeComponent
public class BeanA {
}

@MyExcludeComponent
public class BeanB {
}
```

```java
@Configuration
@ComponentScan(
    includeFilters = @Filter(type = FilterType.ANNOTATION, classes = MyIncludeComponent.class),
    excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = MyExcludeComponent.class)
)
public class ComponentFilterAppConfig {
}
```

```java
@Test
void filterScan() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(ComponentFilterAppConfig.class);

    BeanA beanA = ac.getBean("beanA", BeanA.class);
    assertThat(beanA).isNotNull();  // 등록됨

    assertThrows(NoSuchBeanDefinitionException.class,
        () -> ac.getBean("beanB", BeanB.class));  // 제외됨
}
```

### FilterType 옵션

| FilterType | 설명 | 예시 |
|------------|------|------|
| `ANNOTATION` | 애노테이션 기반 (기본값) | `@MyAnnotation` |
| `ASSIGNABLE_TYPE` | 지정한 타입과 자식 타입 | `BeanA.class` |
| `ASPECTJ` | AspectJ 패턴 | `org.example..*Service+` |
| `REGEX` | 정규 표현식 | `.*Stub.*Repository` |
| `CUSTOM` | `TypeFilter` 인터페이스 구현 | 커스텀 필터 |

```java
// ASSIGNABLE_TYPE 예시
@ComponentScan(
    excludeFilters = @Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = BeanA.class
    )
)

// REGEX 예시
@ComponentScan(
    excludeFilters = @Filter(
        type = FilterType.REGEX,
        pattern = ".*Stub.*"
    )
)

// CUSTOM 예시
public class MyTypeFilter implements TypeFilter {
    @Override
    public boolean match(MetadataReader metadataReader,
                        MetadataReaderFactory metadataReaderFactory) {
        // true 반환 시 스캔 대상
        String className = metadataReader.getClassMetadata().getClassName();
        return className.contains("Exclude");
    }
}

@ComponentScan(
    excludeFilters = @Filter(
        type = FilterType.CUSTOM,
        classes = MyTypeFilter.class
    )
)
```

---

## 중복 등록과 충돌

### 자동 빈 등록 vs 자동 빈 등록

같은 이름의 빈이 자동으로 등록되면 `ConflictingBeanDefinitionException` 예외가 발생한다.

```java
@Component("service")
public class MemberServiceImpl implements MemberService {
}

@Component("service")  // 같은 이름!
public class OrderServiceImpl implements OrderService {
}
```

```
Caused by: org.springframework.context.annotation.ConflictingBeanDefinitionException:
Annotation-specified bean name 'service' for bean class [hello.core.order.OrderServiceImpl]
conflicts with existing, non-compatible bean definition of same name and class
[hello.core.member.MemberServiceImpl]
```

### 수동 빈 등록 vs 자동 빈 등록

수동 빈 등록과 자동 빈 등록이 충돌하면 어떻게 될까?

```java
@Component
public class MemoryMemberRepository implements MemberRepository {
}

@Configuration
@ComponentScan
public class AutoAppConfig {

    @Bean(name = "memoryMemberRepository")  // 같은 이름으로 수동 등록
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }
}
```

**과거 스프링 동작** (스프링 5.0 이전):
- 수동 빈 등록이 우선권을 가져 자동 빈을 오버라이딩

```
Overriding bean definition for bean 'memoryMemberRepository' with a different definition:
replacing [Generic bean: class [hello.core.member.MemoryMemberRepository]; ...]
```

**현재 스프링 부트 동작** (스프링 부트 2.1+):
- 기본적으로 **오류 발생**

```
Consider renaming one of the beans or enabling overriding by setting
spring.main.allow-bean-definition-overriding=true
```

> **이유**: 여러 설정이 얽히면서 의도치 않은 오버라이딩이 발생하면 버그를 잡기 매우 어렵기 때문

### 오버라이딩 허용 설정 (비권장)

```properties
# application.properties
spring.main.allow-bean-definition-overriding=true
```

```yaml
# application.yml
spring:
  main:
    allow-bean-definition-overriding: true
```

---

## 실전 패키지 구조

### 계층형 구조 (권장)

```
com.example.myapp
├── MyAppApplication.java           ← @SpringBootApplication
├── controller
│   ├── MemberController.java       ← @Controller
│   └── OrderController.java
├── service
│   ├── MemberService.java          ← 인터페이스
│   ├── MemberServiceImpl.java      ← @Service
│   ├── OrderService.java
│   └── OrderServiceImpl.java
├── repository
│   ├── MemberRepository.java       ← 인터페이스
│   ├── MemoryMemberRepository.java ← @Repository
│   ├── JpaMemberRepository.java
│   └── OrderRepository.java
├── domain
│   ├── Member.java
│   └── Order.java
└── config
    └── AppConfig.java              ← @Configuration (필요시)
```

### 도메인형 구조 (대규모 프로젝트)

```
com.example.myapp
├── MyAppApplication.java
├── member
│   ├── controller
│   │   └── MemberController.java
│   ├── service
│   │   ├── MemberService.java
│   │   └── MemberServiceImpl.java
│   ├── repository
│   │   └── MemberRepository.java
│   └── domain
│       └── Member.java
└── order
    ├── controller
    │   └── OrderController.java
    ├── service
    │   ├── OrderService.java
    │   └── OrderServiceImpl.java
    ├── repository
    │   └── OrderRepository.java
    └── domain
        └── Order.java
```

---

## 컴포넌트 스캔과 스프링 부트

### 스프링 부트의 기본 설정

```java
@SpringBootApplication  // @ComponentScan 포함
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

스프링 부트는 `@SpringBootApplication`이 있는 패키지부터 하위 패키지를 모두 스캔한다.

### 스캔 대상 확인하기

```java
@SpringBootApplication
public class MyApplication implements CommandLineRunner {

    @Autowired
    private ApplicationContext applicationContext;

    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }

    @Override
    public void run(String... args) {
        String[] beanNames = applicationContext.getBeanDefinitionNames();
        for (String beanName : beanNames) {
            System.out.println("Bean: " + beanName);
        }
    }
}
```

### 스캔 범위 커스터마이징

```java
@SpringBootApplication(
    scanBasePackages = {"com.example.myapp", "com.example.common"}
)
public class MyApplication {
    // ...
}
```

---

## 정리

### 컴포넌트 스캔 핵심

| 항목 | 설명 |
|------|------|
| **@ComponentScan** | 자동으로 스프링 빈 등록 |
| **@Component** | 스캔 대상 표시 |
| **@Autowired** | 의존관계 자동 주입 |
| **탐색 위치** | 설정 클래스 패키지 기준 |
| **기본 스캔 대상** | @Controller, @Service, @Repository, @Configuration |

### 빈 등록 우선순위

```
1. 수동 빈 등록 (@Bean)
2. 자동 빈 등록 (@Component)
→ 스프링 부트는 충돌 시 오류 발생 (안전한 기본값)
```

### 권장 사항

- 프로젝트 최상단에 메인 설정 클래스 배치
- `basePackages` 명시적 지정보다 기본값 사용 권장
- 스프링 부트의 `@SpringBootApplication` 활용
- 빈 이름 충돌에 주의

---

## 참고 자료

- [Spring Framework - Component Scanning](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
