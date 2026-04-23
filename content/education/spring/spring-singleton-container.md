---
title: "싱글톤 컨테이너"
description: "스프링 싱글톤 컨테이너의 동작 원리와 주의사항을 상세히 알아본다"
summary: "싱글톤 패턴의 문제점 해결, @Configuration과 CGLIB를 통한 싱글톤 보장 메커니즘"
date: 2025-01-06
weight: 3
draft: false
toc: true
---

## 1. 웹 애플리케이션과 싱글톤

### 순수 DI 컨테이너의 문제

웹 애플리케이션은 보통 여러 고객이 동시에 요청을 보낸다. 순수한 DI 컨테이너는 요청이 들어올 때마다 새로운 객체를 생성해서 반환하므로, 트래픽이 많은 환경에서는 메모리와 GC 부하가 급격히 증가한다.

```java
public class AppConfig {
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }
}
```

```java
@Test
void pureContainer() {
    AppConfig appConfig = new AppConfig();

    MemberService memberService1 = appConfig.memberService();
    MemberService memberService2 = appConfig.memberService();

    // 서로 다른 객체
    assertThat(memberService1).isNotSameAs(memberService2);
}
```

```
memberService1 = MemberServiceImpl@6a5fc7f7
memberService2 = MemberServiceImpl@3b6eb2ec
```

{{< callout type="warning" >}}
초당 수만 건의 요청이 들어오는 환경에서 매 요청마다 새로운 객체를 만들면 메모리 낭비가 심각하고 GC 부하도 커진다. 해결책은 해당 객체가 딱 1개만 생성되고 공유되도록 설계하는 것이다.
{{< /callout >}}

---

## 2. 싱글톤 패턴

### 싱글톤 패턴의 개념

클래스의 인스턴스가 단 1개만 생성되는 것을 보장하는 디자인 패턴이다. 외부에서 `new` 키워드로 생성할 수 없도록 생성자를 `private`으로 막고, `static` 메서드를 통해서만 인스턴스를 얻도록 한다.

```java
public class SingletonService {

    // 1. static 영역에 객체를 딱 1개만 생성
    private static final SingletonService instance = new SingletonService();

    // 2. public static 메서드로만 인스턴스 조회 허용
    public static SingletonService getInstance() {
        return instance;
    }

    // 3. 생성자는 private 으로 외부 생성 차단
    private SingletonService() {
    }

    public void logic() {
        System.out.println("싱글톤 객체 로직 호출");
    }
}
```

```java
@Test
void singletonServiceTest() {
    SingletonService instance1 = SingletonService.getInstance();
    SingletonService instance2 = SingletonService.getInstance();

    assertThat(instance1).isSameAs(instance2);
}
```

### 다양한 구현 방식

| 방식 | 특징 |
|:---|:---|
| Eager Initialization | 클래스 로딩 시점에 즉시 생성 |
| Lazy Initialization | `getInstance()` 호출 시점에 생성, `synchronized` 비용 발생 |
| Double-Checked Locking | `volatile`과 이중 검사로 성능 보완 |
| Holder Idiom | 내부 정적 클래스 로딩 시점에 생성 (지연 + thread-safe) |
| Enum Singleton | 직렬화와 리플렉션까지 방지, 가장 안전 |

```java
// Holder Idiom (권장)
public class HolderSingleton {
    private HolderSingleton() {}

    private static class Holder {
        private static final HolderSingleton INSTANCE = new HolderSingleton();
    }

    public static HolderSingleton getInstance() {
        return Holder.INSTANCE;
    }
}
```

```java
// Enum Singleton (가장 안전)
public enum EnumSingleton {
    INSTANCE;

    public void logic() {
        System.out.println("싱글톤 로직");
    }
}
```

### 싱글톤 패턴의 한계

| 문제 | 설명 |
|:---|:---|
| DIP 위반 | `getInstance()` 를 통해 구체 클래스에 의존 |
| OCP 위반 | 구현체 교체가 어렵고 클라이언트 코드가 변경됨 |
| 테스트 어려움 | 인스턴스를 미리 정해두어 Mock 교체가 까다로움 |
| 유연성 저하 | 상속 어려움, 내부 속성 변경 어려움 |
| 코드 복잡도 | 싱글톤 구현 상용구 코드가 추가됨 |

```java
public class MemberServiceImpl implements MemberService {
    // 싱글톤 패턴을 쓰면 구체 클래스에 의존하게 됨 (DIP 위반)
    private final MemberRepository memberRepository
        = SingletonMemberRepository.getInstance();
}
```

---

## 3. 싱글톤 컨테이너

### 스프링이 제공하는 싱글톤

스프링 컨테이너는 위 단점을 모두 제거하면서 빈을 싱글톤으로 관리한다. 사용자는 일반 POJO 클래스만 작성하면 되고, 싱글톤 코드를 직접 작성할 필요가 없다.

```java
@Test
void springContainer() {
    ApplicationContext ac =
        new AnnotationConfigApplicationContext(AppConfig.class);

    MemberService memberService1
        = ac.getBean("memberService", MemberService.class);
    MemberService memberService2
        = ac.getBean("memberService", MemberService.class);

    // 같은 인스턴스
    assertThat(memberService1).isSameAs(memberService2);
}
```

### 싱글톤 레지스트리 구조

```
┌──────────────────────────────┐
│     스프링 컨테이너             │
│   (싱글톤 레지스트리)            │
│  ┌────────────────────────┐  │
│  │  memberService   : Impl│  │
│  │  orderService    : Impl│  │
│  │  memberRepository: Impl│  │
│  └────────────────────────┘  │
└──────────────────────────────┘
     ▲         ▲         ▲
     │         │         │
  ClientA   ClientB   ClientC
   (동일 인스턴스 공유)
```

{{< callout type="info" >}}
싱글톤 컨테이너는 싱글톤 패턴의 단점 (DIP/OCP 위반, 테스트 어려움, private 생성자) 없이 같은 효과를 낸다. 개발자는 평범한 클래스만 작성하고, 컨테이너가 인스턴스 생명주기를 관리한다.
{{< /callout >}}

---

## 4. 싱글톤 방식의 주의점

### 무상태 (stateless) 설계

싱글톤 객체는 여러 클라이언트가 하나의 인스턴스를 공유한다. 따라서 특정 클라이언트의 값을 저장하는 가변 필드가 있으면 심각한 버그로 이어진다.

```java
// 잘못된 예: stateful
public class StatefulService {

    private int price; // 공유 필드 (위험)

    public void order(String name, int price) {
        this.price = price;
    }

    public int getPrice() {
        return price;
    }
}
```

```java
@Test
void statefulServiceSingleton() {
    ApplicationContext ac =
        new AnnotationConfigApplicationContext(TestConfig.class);
    StatefulService a = ac.getBean(StatefulService.class);
    StatefulService b = ac.getBean(StatefulService.class);

    a.order("userA", 10000);
    b.order("userB", 20000); // 사이에 끼어듦

    int price = a.getPrice();
    System.out.println("price = " + price); // 기대 10000, 실제 20000
}
```

```
문제 발생 흐름
┌──────────────────────────────┐
│   StatefulService (싱글톤)     │
│   price 필드 공유               │
└──────────────────────────────┘
   ▲                      ▲
   │ ThreadA:             │ ThreadB:
   │ order("A", 10000)    │ order("B", 20000)
   │ price = 10000        │ price = 20000
   │                      │
   ▼
 getPrice() → 20000 (오염됨)
```

{{< callout type="warning" >}}
"스프링 빈의 필드에 공유 값을 설정하면 정말 큰 장애가 발생할 수 있다." 싱글톤 빈은 반드시 무상태 (stateless) 로 설계해야 한다. 특정 요청의 값은 지역 변수, 파라미터, `ThreadLocal`, 반환값으로 전달하자.
{{< /callout >}}

### Stateless 설계 가이드

```java
// 올바른 예: stateless
public class StatelessService {
    public int order(String name, int price) {
        System.out.println("name = " + name);
        return price; // 지역값 즉시 반환
    }
}
```

| 원칙 | 설명 |
|:---|:---|
| 공유 필드 금지 | 특정 클라이언트에 종속적인 필드를 두지 않음 |
| 가변 필드 금지 | 값이 바뀌는 필드는 동시성 문제 유발 |
| 읽기 전용만 허용 | 의존성 (`final`) 등 불변 필드만 유지 |
| 지역 변수 활용 | 요청별 상태는 파라미터와 지역 변수로 처리 |

```java
// 요청별 상태는 ThreadLocal 로 격리
public class ThreadLocalService {

    private final ThreadLocal<Integer> price = new ThreadLocal<>();

    public void order(String name, int price) {
        this.price.set(price);
    }

    public int getPrice() {
        return price.get();
    }

    public void clear() {
        price.remove(); // 반드시 제거 (메모리 누수 방지)
    }
}
```

---

## 5. @Configuration 과 싱글톤

### 자바 코드만 보면 싱글톤이 깨져야 하는 구조

```java
@Configuration
public class AppConfig {

    @Bean
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
        return new OrderServiceImpl(
            memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
        System.out.println("call memberRepository");
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

자바 코드만 보면 `memberRepository()` 가 세 번 호출되어야 한다.

1. `@Bean memberRepository()` 직접 등록 시
2. `memberService()` 내부 호출 시
3. `orderService()` 내부 호출 시

### 실제 실행 결과

```java
@Test
void configurationTest() {
    ApplicationContext ac =
        new AnnotationConfigApplicationContext(AppConfig.class);

    MemberServiceImpl memberService =
        ac.getBean("memberService", MemberServiceImpl.class);
    OrderServiceImpl orderService =
        ac.getBean("orderService", OrderServiceImpl.class);
    MemberRepository memberRepository =
        ac.getBean("memberRepository", MemberRepository.class);

    assertThat(memberService.getMemberRepository())
        .isSameAs(memberRepository);
    assertThat(orderService.getMemberRepository())
        .isSameAs(memberRepository);
}
```

```
call memberRepository   ← 단 1번만 출력!
```

모두 동일한 인스턴스이며, `memberRepository()` 는 **단 한 번만** 호출된다.

### CGLIB 바이트코드 조작

스프링은 `@Configuration` 이 붙은 클래스를 그대로 쓰지 않고, **CGLIB** 라이브러리로 상속받은 자식 클래스를 만들어서 빈으로 등록한다. 이 자식 클래스가 `@Bean` 메서드 호출을 가로채 컨테이너의 싱글톤을 반환한다.

```java
@Test
void configurationDeep() {
    ApplicationContext ac =
        new AnnotationConfigApplicationContext(AppConfig.class);
    AppConfig bean = ac.getBean(AppConfig.class);

    System.out.println("bean = " + bean.getClass());
}
```

```
bean = class hello.core.AppConfig$$SpringCGLIB$$0
```

```java
// CGLIB 가 만들어내는 자식 클래스의 개념적 의사 코드
public class AppConfig$$SpringCGLIB$$0 extends AppConfig {

    @Override
    public MemberRepository memberRepository() {
        if (container.contains("memberRepository")) {
            // 이미 있으면 컨테이너에서 반환
            return container.getBean("memberRepository",
                MemberRepository.class);
        } else {
            // 없으면 부모의 원래 메서드 호출 후 등록
            MemberRepository bean = super.memberRepository();
            container.register("memberRepository", bean);
            return bean;
        }
    }
}
```

### CGLIB 동작 다이어그램

```
  호출: memberRepository()
         │
         ▼
┌────────────────────────┐
│ AppConfig$$CGLIB       │
│ (바이트코드 조작 클래스)  │
│  - 빈 저장소 먼저 확인   │
│  - 있으면 반환           │
│  - 없으면 super 호출     │
└───────────┬────────────┘
            │ extends
            ▼
┌────────────────────────┐
│      AppConfig         │
│    (원본 설정 클래스)    │
│   new MemoryMember...  │
└───────────┬────────────┘
            │ 등록
            ▼
┌────────────────────────┐
│    스프링 컨테이너       │
│ memberRepository: 1개   │
└────────────────────────┘
```

### @Configuration 을 제거하면?

```java
// @Configuration 주석 처리
public class AppConfig {
    @Bean public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }
    @Bean public OrderService orderService() {
        return new OrderServiceImpl(
            memberRepository(), discountPolicy());
    }
    @Bean public MemberRepository memberRepository() {
        System.out.println("call memberRepository");
        return new MemoryMemberRepository();
    }
    // ...
}
```

```
bean = class hello.core.AppConfig   ← CGLIB 아님
call memberRepository
call memberRepository   ← 또 호출
call memberRepository   ← 또 호출
```

| 설정 | CGLIB 적용 | 싱글톤 보장 |
|:---|:---|:---|
| `@Configuration` + `@Bean` | O | O |
| `@Bean` 만 사용 | X | X |

{{< callout type="warning" >}}
`@Configuration` 이 없으면 CGLIB 프록시가 만들어지지 않기 때문에, `@Bean` 메서드는 그저 평범한 자바 메서드 호출이 되어 매번 새로운 인스턴스를 반환한다. 설정 클래스에는 반드시 `@Configuration` 을 붙이자.
{{< /callout >}}

---

## 6. 실전: 싱글톤 빈 설계

### 불변 의존성만 보관

```java
// 안전한 설계: 생성자 주입 + final
@Service
public class OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    public OrderService(MemberRepository memberRepository,
                        DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }

    public Order createOrder(Long memberId, String name, int price) {
        Member member = memberRepository.findById(memberId);
        int discount = discountPolicy.discount(member, price);
        return new Order(memberId, name, price, discount);
    }
}
```

### 동시성 안전한 캐시

```java
// 위험한 캐시: 일반 HashMap
@Service
public class UnsafeProductService {
    private Map<Long, Product> cache = new HashMap<>(); // 동시성 X
}
```

```java
// 안전한 캐시: ConcurrentHashMap 또는 @Cacheable
@Service
public class ProductService {

    private final ConcurrentHashMap<Long, Product> cache
        = new ConcurrentHashMap<>();
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public Product getProduct(Long id) {
        return cache.computeIfAbsent(id,
            productRepository::findById);
    }

    @Cacheable("products")
    public Product getProductWithCache(Long id) {
        return productRepository.findById(id);
    }
}
```

---

## 7. 정리

| 항목 | 설명 |
|:---|:---|
| 싱글톤 패턴 | 인스턴스를 1개만 만드는 디자인 패턴, 여러 단점 존재 |
| 싱글톤 컨테이너 | 스프링이 POJO 를 싱글톤으로 관리, 패턴 단점 해소 |
| 주의점 | 무상태로 설계할 것, 공유 가변 필드 금지 |
| `@Configuration` | CGLIB 프록시로 `@Bean` 호출을 가로채 싱글톤 보장 |
| `@Bean` 단독 사용 | 싱글톤 미보장, 매 호출마다 새 인스턴스 |

### 체크리스트

- [ ] 스프링 빈에 상태를 저장하는 가변 필드가 있는가?
- [ ] 여러 스레드가 동시에 접근하는 필드가 있는가?
- [ ] 설정 클래스에 `@Configuration` 이 붙어 있는가?
- [ ] 요청별 상태는 지역 변수나 `ThreadLocal` 로 처리하고 있는가?

---

## 참고 자료

- [Spring Framework - Singleton Scope](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)
- [CGLIB 라이브러리](https://github.com/cglib/cglib)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
