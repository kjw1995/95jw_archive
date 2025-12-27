---
title: "스프링 컨테이너와 스프링 빈"
description: "스프링 컨테이너의 구조와 스프링 빈 등록, 조회 방법을 상세히 알아본다"
summary: "ApplicationContext, BeanFactory, BeanDefinition의 이해와 스프링 빈 등록 및 조회 방법"
date: 2025-01-06
weight: 2
draft: false
toc: true
---

## DI 컨테이너란?

### IoC와 DI의 개념

**IoC (Inversion of Control, 제어의 역전)**
- 프로그램의 제어 흐름을 개발자가 아닌 프레임워크가 담당
- 객체의 생성, 생명주기 관리를 외부에 위임

**DI (Dependency Injection, 의존관계 주입)**
- 객체가 필요로 하는 의존 객체를 외부에서 주입
- IoC를 구현하는 구체적인 방법 중 하나

```java
// DI 없이 직접 생성
public class OrderServiceImpl {
    private DiscountPolicy discountPolicy = new FixDiscountPolicy();  // 직접 생성
}

// DI를 통한 주입
public class OrderServiceImpl {
    private final DiscountPolicy discountPolicy;

    public OrderServiceImpl(DiscountPolicy discountPolicy) {  // 외부에서 주입
        this.discountPolicy = discountPolicy;
    }
}
```

### AppConfig: 수동 DI 컨테이너

```java
// 순수 자바 코드로 구현한 DI 컨테이너
public class AppConfig {

    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    public OrderService orderService() {
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }

    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}

// 사용
public class MainApp {
    public static void main(String[] args) {
        AppConfig appConfig = new AppConfig();
        MemberService memberService = appConfig.memberService();
        OrderService orderService = appConfig.orderService();
    }
}
```

**AppConfig의 역할**:
- 객체 생성 담당
- 의존관계 연결 담당
- 구현 객체 선택 담당

---

## 스프링 컨테이너

### ApplicationContext

`ApplicationContext`는 스프링 컨테이너의 핵심 인터페이스이다.

```java
// 스프링 컨테이너 생성
ApplicationContext applicationContext =
    new AnnotationConfigApplicationContext(AppConfig.class);

// 빈 조회
MemberService memberService = applicationContext.getBean("memberService", MemberService.class);
```

### 스프링 컨테이너 생성 과정

```
1단계: 스프링 컨테이너 생성
┌─────────────────────────────────────────┐
│         스프링 컨테이너                   │
│  ┌─────────────────────────────────┐    │
│  │        스프링 빈 저장소           │    │
│  │  빈 이름      │  빈 객체          │    │
│  │  ─────────────────────────────  │    │
│  │              │                  │    │
│  │              │                  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↓ AppConfig.class 정보 전달

2단계: 스프링 빈 등록
┌─────────────────────────────────────────┐
│         스프링 컨테이너                   │
│  ┌─────────────────────────────────┐    │
│  │        스프링 빈 저장소           │    │
│  │  빈 이름          │  빈 객체      │    │
│  │  ─────────────────────────────  │    │
│  │  memberService   │  MemberServiceImpl  │
│  │  orderService    │  OrderServiceImpl   │
│  │  memberRepository│  MemoryMemberRepository│
│  │  discountPolicy  │  RateDiscountPolicy │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

3단계: 의존관계 주입 (DI)
- memberService → memberRepository 연결
- orderService → memberRepository, discountPolicy 연결
```

### 설정 클래스와 @Bean

```java
@Configuration
public class AppConfig {

    @Bean
    public MemberService memberService() {
        System.out.println("call AppConfig.memberService");
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
        System.out.println("call AppConfig.orderService");
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
        System.out.println("call AppConfig.memberRepository");
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

**빈 등록 규칙**:
- `@Bean` 애노테이션이 붙은 메서드의 이름이 기본 빈 이름
- 빈 이름 직접 지정: `@Bean(name = "customName")`
- **주의**: 빈 이름은 항상 고유해야 함 (중복 시 오류 또는 덮어씀)

---

## 스프링 빈 조회

### 기본 조회 방법

```java
@Test
void findBeanByName() {
    // 빈 이름으로 조회
    MemberService memberService = ac.getBean("memberService", MemberService.class);
    assertThat(memberService).isInstanceOf(MemberServiceImpl.class);
}

@Test
void findBeanByType() {
    // 타입으로 조회
    MemberService memberService = ac.getBean(MemberService.class);
    assertThat(memberService).isInstanceOf(MemberServiceImpl.class);
}

@Test
void findBeanByName_NotFound() {
    // 존재하지 않는 빈 조회 시 예외 발생
    assertThrows(NoSuchBeanDefinitionException.class,
        () -> ac.getBean("xxxxx", MemberService.class));
}
```

### 동일 타입 빈이 여러 개인 경우

```java
@Configuration
static class SameBeanConfig {
    @Bean
    public MemberRepository memberRepository1() {
        return new MemoryMemberRepository();
    }

    @Bean
    public MemberRepository memberRepository2() {
        return new MemoryMemberRepository();
    }
}

@Test
void findBeanByTypeDuplicate() {
    // 타입으로 조회 시 동일 타입이 둘 이상이면 예외 발생
    assertThrows(NoUniqueBeanDefinitionException.class,
        () -> ac.getBean(MemberRepository.class));
}

@Test
void findBeanByName_Duplicate() {
    // 빈 이름을 지정하면 해결
    MemberRepository memberRepository = ac.getBean("memberRepository1", MemberRepository.class);
    assertThat(memberRepository).isInstanceOf(MemberRepository.class);
}

@Test
void findAllBeanByType() {
    // 해당 타입의 모든 빈 조회
    Map<String, MemberRepository> beansOfType = ac.getBeansOfType(MemberRepository.class);
    assertThat(beansOfType.size()).isEqualTo(2);
}
```

### 상속 관계에서의 빈 조회

부모 타입으로 조회하면 자식 타입도 함께 조회된다.

```java
@Configuration
static class TestConfig {
    @Bean
    public DiscountPolicy rateDiscountPolicy() {
        return new RateDiscountPolicy();
    }

    @Bean
    public DiscountPolicy fixDiscountPolicy() {
        return new FixDiscountPolicy();
    }
}

@Test
void findBeanByParentType() {
    // 부모 타입으로 조회 시 자식이 둘 이상이면 예외
    assertThrows(NoUniqueBeanDefinitionException.class,
        () -> ac.getBean(DiscountPolicy.class));
}

@Test
void findBeanByParentTypeBeanName() {
    // 빈 이름을 지정하여 해결
    DiscountPolicy rateDiscountPolicy = ac.getBean("rateDiscountPolicy", DiscountPolicy.class);
    assertThat(rateDiscountPolicy).isInstanceOf(RateDiscountPolicy.class);
}

@Test
void findAllBeanByParentType() {
    // 부모 타입으로 모든 빈 조회
    Map<String, DiscountPolicy> beansOfType = ac.getBeansOfType(DiscountPolicy.class);
    assertThat(beansOfType.size()).isEqualTo(2);
}

@Test
void findAllBeanByObjectType() {
    // Object 타입으로 조회하면 모든 빈 조회
    Map<String, Object> beansOfType = ac.getBeansOfType(Object.class);
    for (String key : beansOfType.keySet()) {
        System.out.println("key = " + key + ", value = " + beansOfType.get(key));
    }
}
```

### 스프링 빈 목록 출력

```java
@Test
void findAllBean() {
    String[] beanDefinitionNames = ac.getBeanDefinitionNames();
    for (String beanDefinitionName : beanDefinitionNames) {
        Object bean = ac.getBean(beanDefinitionName);
        System.out.println("name = " + beanDefinitionName + ", object = " + bean);
    }
}

@Test
void findApplicationBean() {
    String[] beanDefinitionNames = ac.getBeanDefinitionNames();
    for (String beanDefinitionName : beanDefinitionNames) {
        BeanDefinition beanDefinition = ac.getBeanDefinition(beanDefinitionName);

        // ROLE_APPLICATION: 사용자가 정의한 빈
        // ROLE_INFRASTRUCTURE: 스프링 내부에서 사용하는 빈
        if (beanDefinition.getRole() == BeanDefinition.ROLE_APPLICATION) {
            Object bean = ac.getBean(beanDefinitionName);
            System.out.println("name = " + beanDefinitionName + ", object = " + bean);
        }
    }
}
```

---

## BeanFactory vs ApplicationContext

### 인터페이스 계층 구조

```
                    ┌─────────────────────┐
                    │     BeanFactory     │  ← 최상위 인터페이스
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────────┐
│MessageSource  │    │ApplicationEvent │    │EnvironmentCapable│
│(국제화)        │    │Publisher(이벤트)│    │(환경변수)         │
└───────────────┘    └─────────────────┘    └───────────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ ApplicationContext  │  ← 실제 사용하는 인터페이스
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────────┐
│AnnotationConfig│   │GenericXml       │    │GenericGroovy      │
│ApplicationContext│  │ApplicationContext│   │ApplicationContext │
└───────────────┘    └─────────────────┘    └───────────────────┘
```

### BeanFactory

```java
public interface BeanFactory {
    Object getBean(String name) throws BeansException;
    <T> T getBean(String name, Class<T> requiredType) throws BeansException;
    <T> T getBean(Class<T> requiredType) throws BeansException;
    boolean containsBean(String name);
    boolean isSingleton(String name) throws NoSuchBeanDefinitionException;
    boolean isPrototype(String name) throws NoSuchBeanDefinitionException;
    // ...
}
```

- 스프링 컨테이너의 최상위 인터페이스
- 스프링 빈을 관리하고 조회하는 역할
- `getBean()` 제공
- 직접 사용할 일은 거의 없음

### ApplicationContext

```java
public interface ApplicationContext extends
    EnvironmentCapable,       // 환경변수 (로컬, 개발, 운영 구분)
    ListableBeanFactory,      // BeanFactory 기능
    HierarchicalBeanFactory,  // BeanFactory 기능
    MessageSource,            // 국제화 기능
    ApplicationEventPublisher,// 이벤트 발행/구독
    ResourcePatternResolver { // 리소스 조회
    // ...
}
```

**ApplicationContext가 제공하는 부가 기능**:

| 기능 | 설명 |
|------|------|
| **MessageSource** | 국제화 기능 (다국어 지원) |
| **EnvironmentCapable** | 환경변수 처리 (로컬/개발/운영 분리) |
| **ApplicationEventPublisher** | 애플리케이션 이벤트 발행/구독 |
| **ResourceLoader** | 파일, 클래스패스 등 리소스 조회 |

```java
// MessageSource 사용 예
@Autowired
MessageSource messageSource;

public void example() {
    // messages_ko.properties: hello=안녕
    // messages_en.properties: hello=Hello
    String message = messageSource.getMessage("hello", null, Locale.KOREA);
    System.out.println(message);  // "안녕"
}

// ApplicationEventPublisher 사용 예
@Autowired
ApplicationEventPublisher publisher;

public void createMember(Member member) {
    // 비즈니스 로직
    memberRepository.save(member);

    // 이벤트 발행
    publisher.publishEvent(new MemberCreatedEvent(member));
}
```

---

## 다양한 설정 형식 지원

### 자바 코드 기반 설정 (가장 많이 사용)

```java
@Configuration
public class AppConfig {
    @Bean
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }
}

// 사용
ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);
```

### XML 기반 설정 (레거시)

```xml
<!-- appConfig.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd">

    <bean id="memberService" class="hello.core.member.MemberServiceImpl">
        <constructor-arg name="memberRepository" ref="memberRepository"/>
    </bean>

    <bean id="memberRepository" class="hello.core.member.MemoryMemberRepository"/>

    <bean id="orderService" class="hello.core.order.OrderServiceImpl">
        <constructor-arg name="memberRepository" ref="memberRepository"/>
        <constructor-arg name="discountPolicy" ref="discountPolicy"/>
    </bean>

    <bean id="discountPolicy" class="hello.core.discount.RateDiscountPolicy"/>
</beans>
```

```java
// XML 설정 사용
ApplicationContext ac = new GenericXmlApplicationContext("appConfig.xml");
```

---

## BeanDefinition

스프링은 다양한 설정 형식을 `BeanDefinition`으로 추상화한다.

### BeanDefinition 구조

```
┌──────────────────────────┐
│      BeanDefinition      │  ← 빈 설정 메타 정보 (추상화)
└────────────┬─────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐     ┌─────────┐
│ Java 설정│     │ XML 설정 │
│ Reader  │     │ Reader  │
└─────────┘     └─────────┘
    │                 │
    ▼                 ▼
┌─────────┐     ┌─────────┐
│AppConfig│     │appConfig│
│ .class  │     │  .xml   │
└─────────┘     └─────────┘
```

### BeanDefinition 정보 확인

```java
@Test
void findBeanDefinition() {
    String[] beanDefinitionNames = ac.getBeanDefinitionNames();
    for (String beanDefinitionName : beanDefinitionNames) {
        BeanDefinition beanDefinition = ac.getBeanDefinition(beanDefinitionName);

        if (beanDefinition.getRole() == BeanDefinition.ROLE_APPLICATION) {
            System.out.println("beanDefinitionName = " + beanDefinitionName);
            System.out.println("beanDefinition = " + beanDefinition);
        }
    }
}
```

**BeanDefinition의 주요 속성**:

| 속성 | 설명 |
|------|------|
| `BeanClassName` | 빈의 클래스명 |
| `Scope` | 싱글톤(기본값), 프로토타입 등 |
| `LazyInit` | 지연 초기화 여부 |
| `InitMethodName` | 초기화 메서드 이름 |
| `DestroyMethodName` | 소멸 메서드 이름 |
| `ConstructorArgumentValues` | 생성자 인자 정보 |
| `PropertyValues` | 프로퍼티 정보 |

```
// BeanDefinition 출력 예시
beanDefinitionName = memberService
beanDefinition = Root bean: class [null]; scope=; abstract=false; lazyInit=null;
  autowireMode=3; dependencyCheck=0; autowireCandidate=true; primary=false;
  factoryBeanName=appConfig; factoryMethodName=memberService;
  initMethodNames=null; destroyMethodNames=[(inferred)];
```

---

## 실전 예제: 주문 도메인

### 인터페이스 설계

```java
// 회원 저장소 인터페이스
public interface MemberRepository {
    void save(Member member);
    Member findById(Long memberId);
}

// 할인 정책 인터페이스
public interface DiscountPolicy {
    /**
     * @return 할인 대상 금액
     */
    int discount(Member member, int price);
}

// 주문 서비스 인터페이스
public interface OrderService {
    Order createOrder(Long memberId, String itemName, int itemPrice);
}
```

### 구현 클래스

```java
// 회원 저장소 구현
@Repository
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

// 할인 정책 구현
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

// 주문 서비스 구현
@Service
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    @Autowired
    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }

    @Override
    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        Member member = memberRepository.findById(memberId);
        int discountPrice = discountPolicy.discount(member, itemPrice);
        return new Order(memberId, itemName, itemPrice, discountPrice);
    }
}
```

### 테스트

```java
@SpringBootTest
class OrderServiceTest {

    @Autowired
    MemberService memberService;

    @Autowired
    OrderService orderService;

    @Test
    void createOrder() {
        // given
        Long memberId = 1L;
        Member member = new Member(memberId, "memberA", Grade.VIP);
        memberService.join(member);

        // when
        Order order = orderService.createOrder(memberId, "itemA", 10000);

        // then
        assertThat(order.getDiscountPrice()).isEqualTo(1000);
        assertThat(order.calculatePrice()).isEqualTo(9000);
    }
}
```

---

## 정리

### 스프링 컨테이너의 역할

1. **객체 생성과 관리**: 스프링 빈의 생성, 초기화, 소멸 관리
2. **의존관계 주입**: 빈 간의 의존관계 설정
3. **설정 정보 처리**: 다양한 형식의 설정 정보 지원

### 핵심 개념

| 개념 | 설명 |
|------|------|
| **IoC** | 제어의 역전 - 프레임워크가 제어 |
| **DI** | 의존관계 주입 - 외부에서 주입 |
| **BeanFactory** | 스프링 빈 관리/조회 기본 기능 |
| **ApplicationContext** | BeanFactory + 부가 기능 |
| **BeanDefinition** | 빈 설정 메타 정보 추상화 |

### 자주 사용하는 빈 조회 메서드

```java
// 이름으로 조회
ac.getBean("beanName", Type.class);

// 타입으로 조회
ac.getBean(Type.class);

// 해당 타입의 모든 빈 조회
ac.getBeansOfType(Type.class);

// 모든 빈 이름 조회
ac.getBeanDefinitionNames();
```

---

## 참고 자료

- [Spring Framework Reference - Container](https://docs.spring.io/spring-framework/reference/core/beans.html)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
