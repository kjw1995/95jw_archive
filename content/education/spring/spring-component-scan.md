---
title: "컴포넌트 스캔"
description: "스프링의 컴포넌트 스캔 기능과 자동 빈 등록 메커니즘을 상세히 알아본다"
summary: "@ComponentScan의 동작 원리, 탐색 위치, 필터, 빈 충돌 처리 방법"
date: 2025-01-06
weight: 4
draft: false
toc: true
---

## 1. 컴포넌트 스캔이란?

### 수동 빈 등록의 한계

설정 클래스에 `@Bean` 으로 빈을 일일이 등록하면 애플리케이션이 커질수록 관리 비용이 커진다. 수십, 수백 개의 빈을 하나하나 선언해야 하고 누락이나 오타의 위험도 높아진다.

```java
@Configuration
public class AppConfig {
    @Bean public MemberService memberService() { return new MemberServiceImpl(memberRepository()); }
    @Bean public MemberRepository memberRepository() { return new MemoryMemberRepository(); }
    @Bean public OrderService orderService() { return new OrderServiceImpl(memberRepository(), discountPolicy()); }
    @Bean public DiscountPolicy discountPolicy() { return new RateDiscountPolicy(); }
    // 빈이 수십, 수백 개가 되면 관리가 어려워진다
}
```

### 자동 빈 등록 도입

스프링은 설정 코드 없이 클래스패스를 뒤져 빈으로 등록할 클래스를 찾아내는 **컴포넌트 스캔** 기능을 제공한다.

```java
@Configuration
@ComponentScan(
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ANNOTATION,
        classes = Configuration.class
    )
)
public class AutoAppConfig {
    // @Bean 선언 없이 자동으로 빈 등록
}
```

{{< callout type="info" >}}
스프링 부트의 `@SpringBootApplication` 에는 이미 `@ComponentScan` 이 포함되어 있다. 따라서 대부분의 스프링 부트 애플리케이션은 별도 설정 없이 컴포넌트 스캔이 동작한다.
{{< /callout >}}

---

## 2. @Component 와 @Autowired

### @Component: 스캔 대상 표시

`@Component` 가 붙은 클래스는 컴포넌트 스캔 과정에서 자동으로 스프링 빈으로 등록된다.

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

### @Autowired: 의존관계 자동 주입

설정 정보가 없는데 의존관계는 어떻게 주입할까? `@Autowired` 를 붙이면 스프링 컨테이너가 해당 타입의 빈을 찾아서 자동으로 주입한다.

```java
@Component
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;

    @Autowired
    public MemberServiceImpl(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }
}

@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    @Autowired
    public OrderServiceImpl(MemberRepository memberRepository,
                            DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

{{< callout type="info" >}}
생성자가 1개만 있으면 `@Autowired` 를 생략해도 스프링이 자동으로 주입한다. 스프링 4.3 부터 지원되는 기능이다.
{{< /callout >}}

---

## 3. 컴포넌트 스캔 동작 과정

### 1단계: 클래스 탐색 후 빈 등록

```
  @ComponentScan
        │
        ▼
┌──────────────────────┐
│ 클래스패스 탐색        │
│ @Component 발견 수집  │
└──────────┬───────────┘
           │
  ┌────────┼────────┐
  ▼        ▼        ▼
@Comp.   @Comp.   @Comp.
Member   Member   Order
Repo     Service  Service
  │        │        │
  ▼        ▼        ▼
┌──────────────────────┐
│   스프링 컨테이너     │
│  빈 이름 : 빈 객체     │
└──────────────────────┘
```

빈 이름 규칙:

- 기본값: 클래스명의 **첫 글자를 소문자로** 변환 (`MemberServiceImpl` → `memberServiceImpl`)
- 직접 지정: `@Component("customName")`

### 2단계: 의존관계 자동 주입

```
┌──────────────────────┐
│   스프링 컨테이너      │
│  memberRepository     │
│  discountPolicy       │
│  orderServiceImpl     │
└──────────┬───────────┘
           │ 타입으로 빈 조회
           ▼
┌──────────────────────┐
│  OrderServiceImpl    │
│   생성자 주입          │
│  - MemberRepository  │
│  - DiscountPolicy    │
└──────────────────────┘
```

---

## 4. 탐색 위치와 기본 스캔 대상

### basePackages 옵션

```java
@ComponentScan(basePackages = "hello.core")
// 해당 패키지 이하를 재귀적으로 탐색

@ComponentScan(basePackages = {"hello.core", "hello.service"})
// 여러 시작 위치 지정

@ComponentScan(basePackageClasses = AutoAppConfig.class)
// 이 클래스가 속한 패키지가 시작 위치
```

### 기본값: 설정 클래스의 패키지

`basePackages` 를 지정하지 않으면 **`@ComponentScan` 이 붙은 설정 클래스의 패키지** 가 시작 위치가 된다. 따라서 프로젝트 최상단 패키지에 메인 설정 클래스를 두는 것이 권장된다.

```
hello.core
├── AutoAppConfig.java    ← @ComponentScan
├── member/
├── order/
└── discount/
```

```java
@Configuration
@ComponentScan
public class AutoAppConfig {
    // basePackages 생략 → hello.core 부터 탐색
}
```

{{< callout type="info" >}}
스프링 부트의 `@SpringBootApplication` 내부에도 `@ComponentScan` 이 포함되어 있다. 메인 클래스를 루트 패키지에 두면 그 아래 모든 하위 패키지가 자동으로 스캔된다.
{{< /callout >}}

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = {
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication { }
```

### 기본 스캔 대상 애노테이션

컴포넌트 스캔은 `@Component` 뿐 아니라 아래 애노테이션도 함께 인식한다. 각 애노테이션은 내부에 `@Component` 를 포함하고 있으며, 계층별로 특화된 부가 기능을 제공한다.

| 애노테이션 | 용도 | 부가 기능 |
|:---|:---|:---|
| `@Component` | 일반 컴포넌트 | - |
| `@Controller` | 스프링 MVC 컨트롤러 | MVC 에서 컨트롤러로 인식 |
| `@Service` | 비즈니스 계층 표시 | 없음 (의미 전달 용도) |
| `@Repository` | 데이터 접근 계층 | 예외 변환 AOP 적용 |
| `@Configuration` | 설정 클래스 | `@Bean` 싱글톤 보장 (CGLIB) |

{{< callout type="info" >}}
`@Repository` 가 붙은 빈은 스프링 AOP 가 감싸서, 하위 기술 (JDBC, JPA 등) 이 던지는 예외를 `DataAccessException` 계열의 스프링 추상 예외로 변환해준다. 그래서 서비스 계층은 특정 퍼시스턴스 기술의 예외에 결합되지 않는다.
{{< /callout >}}

```java
// @Service 내부
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component  // 메타 애노테이션으로 포함됨
public @interface Service {
    @AliasFor(annotation = Component.class)
    String value() default "";
}
```

---

## 5. 필터

### includeFilters / excludeFilters

`@ComponentScan` 은 스캔 대상을 세밀하게 조정할 수 있는 필터 옵션을 제공한다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface MyIncludeComponent { }

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface MyExcludeComponent { }
```

```java
@MyIncludeComponent
public class BeanA { }

@MyExcludeComponent
public class BeanB { }
```

```java
@Configuration
@ComponentScan(
    includeFilters = @Filter(
        type = FilterType.ANNOTATION,
        classes = MyIncludeComponent.class),
    excludeFilters = @Filter(
        type = FilterType.ANNOTATION,
        classes = MyExcludeComponent.class)
)
public class ComponentFilterAppConfig { }
```

```java
@Test
void filterScan() {
    ApplicationContext ac =
        new AnnotationConfigApplicationContext(
            ComponentFilterAppConfig.class);

    BeanA beanA = ac.getBean("beanA", BeanA.class);
    assertThat(beanA).isNotNull();

    assertThrows(NoSuchBeanDefinitionException.class,
        () -> ac.getBean("beanB", BeanB.class));
}
```

### FilterType 종류

| FilterType | 설명 | 예시 |
|:---|:---|:---|
| `ANNOTATION` | 애노테이션 기반 (기본값) | `@MyAnnotation` |
| `ASSIGNABLE_TYPE` | 지정 타입 및 하위 타입 | `BeanA.class` |
| `ASPECTJ` | AspectJ 패턴 | `org.example..*Service+` |
| `REGEX` | 정규 표현식 | `.*Stub.*Repository` |
| `CUSTOM` | `TypeFilter` 구현체 | 커스텀 필터 |

```java
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
                         MetadataReaderFactory factory) {
        String name = metadataReader.getClassMetadata().getClassName();
        return name.contains("Exclude");
    }
}
```

{{< callout type="info" >}}
실무에서는 `@Component` 표시만으로 충분한 경우가 대부분이다. `includeFilters` 를 직접 커스터마이징할 필요는 많지 않고, 오히려 예외적인 클래스만 `excludeFilters` 로 제외하는 방식이 널리 쓰인다.
{{< /callout >}}

---

## 6. 중복 등록과 충돌

### 자동 빈 vs 자동 빈: 예외 발생

같은 이름의 빈이 자동 등록으로 두 번 올라오면 `ConflictingBeanDefinitionException` 이 발생한다.

```java
@Component("service")
public class MemberServiceImpl implements MemberService { }

@Component("service") // 같은 이름
public class OrderServiceImpl implements OrderService { }
```

```
ConflictingBeanDefinitionException:
  Annotation-specified bean name 'service' for bean class
  [OrderServiceImpl] conflicts with existing bean definition
  of same name and class [MemberServiceImpl]
```

### 수동 빈 vs 자동 빈

수동 등록과 자동 등록이 충돌하는 상황이다.

```java
@Component
public class MemoryMemberRepository implements MemberRepository { }

@Configuration
@ComponentScan
public class AutoAppConfig {

    @Bean(name = "memoryMemberRepository")
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }
}
```

| 버전 | 기본 동작 |
|:---|:---|
| 과거 스프링 | 수동 빈이 자동 빈을 **오버라이딩** (경고 로그) |
| 스프링 부트 2.1+ | **오류 발생** (안전한 기본값) |

```
Consider renaming one of the beans or enabling overriding by setting
spring.main.allow-bean-definition-overriding=true
```

{{< callout type="warning" >}}
여러 설정이 얽히면서 의도치 않게 다른 빈이 오버라이딩되면 추적이 매우 어려운 버그를 만든다. 스프링 부트는 이를 기본적으로 에러로 처리한다. 정말 필요한 경우에만 `spring.main.allow-bean-definition-overriding=true` 를 쓰자.
{{< /callout >}}

---

## 7. 실전 패키지 구조

### 계층형 구조

```
com.example.myapp
├── MyAppApplication.java
├── controller/
├── service/
├── repository/
├── domain/
└── config/
```

### 도메인형 구조

```
com.example.myapp
├── MyAppApplication.java
├── member
│   ├── controller/
│   ├── service/
│   ├── repository/
│   └── domain/
└── order
    ├── controller/
    ├── service/
    ├── repository/
    └── domain/
```

### 스캔 범위 커스터마이징

```java
@SpringBootApplication(
    scanBasePackages = {"com.example.myapp", "com.example.common"}
)
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

---

## 8. 정리

| 항목 | 설명 |
|:---|:---|
| `@ComponentScan` | `@Component` 계열 클래스를 자동 빈 등록 |
| `@Component` | 스캔 대상 표시 |
| `@Autowired` | 의존관계 자동 주입 |
| 스캔 범위 기본값 | 설정 클래스의 패키지 이하 |
| 기본 스캔 대상 | `@Controller`, `@Service`, `@Repository`, `@Configuration` |
| `@Repository` 특화 | 예외 변환 AOP 적용 |

### 권장 사항

- 프로젝트 최상단 패키지에 메인 설정 (또는 `@SpringBootApplication`) 배치
- `basePackages` 를 명시하기보다 기본값 활용
- 빈 이름 충돌에 주의, 필요시 명시적 이름 지정

### 체크리스트

- [ ] 메인 설정 클래스가 최상단 패키지에 있는가?
- [ ] 같은 이름으로 빈이 중복 등록되어 있지 않은가?
- [ ] 데이터 접근 계층 빈에는 `@Repository` 를 사용했는가?
- [ ] 필요 없는 클래스가 `@Component` 로 노출되어 있지는 않은가?

---

## 참고 자료

- [Spring Framework - Component Scanning](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
