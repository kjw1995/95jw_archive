---
title: "싱글톤 컨테이너"
description: "스프링 싱글톤 컨테이너의 동작 원리와 주의사항을 상세히 알아본다"
summary: "싱글톤 패턴의 문제점 해결, @Configuration과 CGLIB를 통한 싱글톤 보장 메커니즘"
date: 2025-01-06
weight: 3
draft: false
toc: true
---

## 웹 애플리케이션과 싱글톤

### 순수 DI 컨테이너의 문제점

웹 애플리케이션은 여러 클라이언트가 동시에 요청을 보낸다. 순수한 DI 컨테이너는 요청마다 새로운 객체를 생성한다.

```java
public class AppConfig {
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());  // 매번 새 객체 생성
    }

    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();  // 매번 새 객체 생성
    }
}

// 문제 시연
@Test
void pureContainer() {
    AppConfig appConfig = new AppConfig();

    MemberService memberService1 = appConfig.memberService();
    MemberService memberService2 = appConfig.memberService();

    // 다른 객체
    System.out.println("memberService1 = " + memberService1);
    System.out.println("memberService2 = " + memberService2);

    assertThat(memberService1).isNotSameAs(memberService2);
}
```

```
출력:
memberService1 = hello.core.member.MemberServiceImpl@6a5fc7f7
memberService2 = hello.core.member.MemberServiceImpl@3b6eb2ec
```

**문제점**:
- 초당 5만 건 요청 시 초당 5만 개 객체 생성 및 소멸
- 메모리 낭비 심각
- GC 부하 증가

---

## 싱글톤 패턴

### 싱글톤 패턴이란?

클래스의 인스턴스가 딱 1개만 생성되는 것을 보장하는 디자인 패턴이다.

```java
public class SingletonService {

    // 1. static 영역에 객체를 딱 1개만 생성
    private static final SingletonService instance = new SingletonService();

    // 2. public으로 객체 인스턴스가 필요하면 이 static 메서드를 통해서만 조회하도록 허용
    public static SingletonService getInstance() {
        return instance;
    }

    // 3. 생성자를 private으로 선언해서 외부에서 new 키워드로 생성하는 것을 막음
    private SingletonService() {
    }

    public void logic() {
        System.out.println("싱글톤 객체 로직 호출");
    }
}

// 테스트
@Test
void singletonServiceTest() {
    SingletonService singletonService1 = SingletonService.getInstance();
    SingletonService singletonService2 = SingletonService.getInstance();

    // 같은 객체
    System.out.println("singletonService1 = " + singletonService1);
    System.out.println("singletonService2 = " + singletonService2);

    assertThat(singletonService1).isSameAs(singletonService2);
}
```

### 다양한 싱글톤 구현 방법

**1. Eager Initialization (즉시 초기화)**
```java
public class EagerSingleton {
    private static final EagerSingleton INSTANCE = new EagerSingleton();

    private EagerSingleton() {}

    public static EagerSingleton getInstance() {
        return INSTANCE;
    }
}
```

**2. Lazy Initialization (지연 초기화)**
```java
public class LazySingleton {
    private static LazySingleton instance;

    private LazySingleton() {}

    public static synchronized LazySingleton getInstance() {
        if (instance == null) {
            instance = new LazySingleton();
        }
        return instance;
    }
}
```

**3. Double-Checked Locking**
```java
public class DCLSingleton {
    private static volatile DCLSingleton instance;

    private DCLSingleton() {}

    public static DCLSingleton getInstance() {
        if (instance == null) {
            synchronized (DCLSingleton.class) {
                if (instance == null) {
                    instance = new DCLSingleton();
                }
            }
        }
        return instance;
    }
}
```

**4. Holder Idiom (권장)**
```java
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

**5. Enum Singleton (가장 안전)**
```java
public enum EnumSingleton {
    INSTANCE;

    public void logic() {
        System.out.println("싱글톤 로직");
    }
}

// 사용
EnumSingleton.INSTANCE.logic();
```

### 싱글톤 패턴의 문제점

```java
// 문제점 시연
public class MemberServiceImpl implements MemberService {

    // 싱글톤 패턴을 적용하면 구체 클래스에 의존해야 함 (DIP 위반)
    private final MemberRepository memberRepository = SingletonMemberRepository.getInstance();

    // 싱글톤 객체를 가져와야 함 → 유연한 테스트 불가
}
```

| 문제점 | 설명 |
|--------|------|
| **DIP 위반** | `getInstance()`를 통해 구체 클래스에 의존 |
| **OCP 위반** | 싱글톤 구현 변경 시 클라이언트 코드 변경 필요 |
| **테스트 어려움** | 싱글톤 인스턴스를 미리 정해두어 유연성 저하 |
| **내부 속성 변경 어려움** | private 생성자로 자식 클래스 만들기 곤란 |
| **코드 복잡성** | 싱글톤 패턴 구현 코드가 추가됨 |
| **안티패턴** | 유연성 저하로 객체 지향 설계에 어긋남 |

---

## 스프링 싱글톤 컨테이너

### 스프링의 싱글톤 관리

스프링 컨테이너는 싱글톤 패턴의 문제점을 해결하면서 객체 인스턴스를 싱글톤으로 관리한다.

```java
@Test
void springContainer() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);

    MemberService memberService1 = ac.getBean("memberService", MemberService.class);
    MemberService memberService2 = ac.getBean("memberService", MemberService.class);

    // 같은 객체 (싱글톤)
    System.out.println("memberService1 = " + memberService1);
    System.out.println("memberService2 = " + memberService2);

    assertThat(memberService1).isSameAs(memberService2);
}
```

```
출력:
memberService1 = hello.core.member.MemberServiceImpl@4b29d1d2
memberService2 = hello.core.member.MemberServiceImpl@4b29d1d2
```

### 싱글톤 레지스트리

스프링 컨테이너는 **싱글톤 레지스트리** 역할을 한다.

```
┌─────────────────────────────────────────────────────────┐
│               스프링 컨테이너 (싱글톤 레지스트리)          │
│  ┌──────────────────────────────────────────────────┐  │
│  │               싱글톤 빈 저장소                     │  │
│  │  key: memberService  │  value: MemberServiceImpl │  │
│  │  key: orderService   │  value: OrderServiceImpl  │  │
│  │  key: discountPolicy │  value: RateDiscountPolicy│  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            ↑                    ↑                    ↑
       클라이언트 A          클라이언트 B          클라이언트 C
       (같은 객체 사용)       (같은 객체 사용)       (같은 객체 사용)
```

**스프링 싱글톤의 장점**:
- 지저분한 싱글톤 패턴 코드 불필요
- DIP, OCP 위반 없음
- 테스트 용이
- private 생성자 불필요

---

## 싱글톤 방식의 주의점

### Stateful 문제

> **"스프링 빈의 필드에 공유 값을 설정하면 정말 큰 장애가 발생할 수 있다!!!"**

싱글톤 객체는 여러 클라이언트가 공유하므로 **무상태(stateless)**로 설계해야 한다.

```java
// ❌ 잘못된 예: 상태를 가진 서비스 (stateful)
public class StatefulService {

    private int price;  // 상태를 유지하는 필드 → 위험!

    public void order(String name, int price) {
        System.out.println("name = " + name + ", price = " + price);
        this.price = price;  // 문제 발생 지점!
    }

    public int getPrice() {
        return price;
    }
}
```

```java
// 문제 시나리오
@Test
void statefulServiceSingleton() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(TestConfig.class);
    StatefulService statefulService1 = ac.getBean(StatefulService.class);
    StatefulService statefulService2 = ac.getBean(StatefulService.class);

    // ThreadA: 사용자A 10,000원 주문
    statefulService1.order("userA", 10000);
    // ThreadB: 사용자B 20,000원 주문 (중간에 끼어듬)
    statefulService2.order("userB", 20000);

    // ThreadA: 사용자A 주문 금액 조회
    int price = statefulService1.getPrice();
    System.out.println("price = " + price);  // 기대: 10000, 실제: 20000 !!!
}
```

```
문제 발생 흐름:
┌──────────────────────────────────────────────────────────┐
│                    StatefulService (싱글톤)               │
│                    price 필드                            │
└──────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │ 1. order("userA", 10000)          │ 2. order("userB", 20000)
        │    price = 10000                  │    price = 20000 (덮어씀!)
   Thread A                              Thread B
        │
        ▼
   3. getPrice() → 20000 반환! (잘못된 결과)
```

### Stateless 설계 원칙

```java
// ✅ 올바른 예: 무상태 서비스 (stateless)
public class StatelessService {

    // 상태 필드 없음

    public int order(String name, int price) {
        System.out.println("name = " + name + ", price = " + price);
        return price;  // 결과를 바로 반환
    }
}
```

**무상태 설계 가이드라인**:

| 원칙 | 설명 |
|------|------|
| **공유 필드 사용 금지** | 특정 클라이언트에 의존적인 필드 금지 |
| **변경 가능 필드 금지** | 특정 클라이언트가 값을 변경할 수 있는 필드 금지 |
| **읽기 전용 필드만 허용** | 가급적 읽기만 허용 |
| **지역 변수 활용** | 필드 대신 지역 변수, 파라미터, ThreadLocal 사용 |

```java
// ThreadLocal 활용 예
public class ThreadLocalService {

    // ThreadLocal: 스레드별로 독립적인 저장소
    private ThreadLocal<Integer> price = new ThreadLocal<>();

    public void order(String name, int price) {
        System.out.println("name = " + name + ", price = " + price);
        this.price.set(price);  // 스레드별로 저장
    }

    public int getPrice() {
        return price.get();  // 해당 스레드의 값만 조회
    }

    public void clear() {
        price.remove();  // 사용 후 반드시 제거 (메모리 누수 방지)
    }
}
```

---

## @Configuration과 싱글톤

### 의문점: 싱글톤이 깨지는 것 아닌가?

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

자바 코드 상으로는 `memberRepository()`가 3번 호출될 것 같다:
1. `@Bean memberRepository()` 직접 호출
2. `memberService()` 내에서 호출
3. `orderService()` 내에서 호출

```java
// 테스트
@Test
void configurationTest() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);

    MemberServiceImpl memberService = ac.getBean("memberService", MemberServiceImpl.class);
    OrderServiceImpl orderService = ac.getBean("orderService", OrderServiceImpl.class);
    MemberRepository memberRepository = ac.getBean("memberRepository", MemberRepository.class);

    MemberRepository memberRepository1 = memberService.getMemberRepository();
    MemberRepository memberRepository2 = orderService.getMemberRepository();

    // 모두 같은 인스턴스!
    System.out.println("memberService -> memberRepository = " + memberRepository1);
    System.out.println("orderService -> memberRepository = " + memberRepository2);
    System.out.println("memberRepository = " + memberRepository);

    assertThat(memberRepository1).isSameAs(memberRepository);
    assertThat(memberRepository2).isSameAs(memberRepository);
}
```

```
출력:
call AppConfig.memberService
call AppConfig.memberRepository
call AppConfig.orderService
memberService -> memberRepository = hello.core.member.MemoryMemberRepository@5679c6c6
orderService -> memberRepository = hello.core.member.MemoryMemberRepository@5679c6c6
memberRepository = hello.core.member.MemoryMemberRepository@5679c6c6
```

**결과**: `memberRepository()`는 **딱 1번만** 호출된다!

### CGLIB 바이트코드 조작

스프링은 `@Configuration`이 붙은 클래스를 그대로 사용하지 않고, **CGLIB**라는 바이트코드 조작 라이브러리를 사용하여 상속받은 클래스를 생성한다.

```java
@Test
void configurationDeep() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);
    AppConfig bean = ac.getBean(AppConfig.class);

    System.out.println("bean = " + bean.getClass());
}
```

```
출력:
bean = class hello.core.AppConfig$$SpringCGLIB$$0
```

`AppConfig$$SpringCGLIB$$0`라는 이름의 클래스가 스프링 빈으로 등록된다.

### CGLIB 동작 원리

```java
// CGLIB가 생성한 클래스의 예상 코드 (실제 코드 아님)
@Configuration
public class AppConfig$$SpringCGLIB$$0 extends AppConfig {

    @Override
    public MemberRepository memberRepository() {
        // 스프링 컨테이너에 이미 등록되어 있으면 찾아서 반환
        if (스프링_컨테이너.contains("memberRepository")) {
            return 스프링_컨테이너.getBean("memberRepository", MemberRepository.class);
        }
        // 없으면 새로 생성해서 스프링 컨테이너에 등록
        else {
            MemberRepository memberRepository = super.memberRepository();
            스프링_컨테이너.register("memberRepository", memberRepository);
            return memberRepository;
        }
    }
}
```

```
CGLIB 동작 흐름:
┌──────────────────────────────────────────────────────────┐
│                      스프링 컨테이너                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  빈 저장소                                        │   │
│  │  memberRepository: MemoryMemberRepository        │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ 이미 있으면 반환
                            │ 없으면 새로 생성 후 등록
          ┌─────────────────┴─────────────────┐
          │       AppConfig$$CGLIB            │
          │       (바이트코드 조작된 클래스)     │
          └─────────────────┬─────────────────┘
                            │ extends
          ┌─────────────────┴─────────────────┐
          │            AppConfig              │
          │          (원본 클래스)             │
          └───────────────────────────────────┘
```

### @Bean만 사용하면?

`@Configuration` 없이 `@Bean`만 사용하면 싱글톤이 보장되지 않는다.

```java
// @Configuration 주석 처리
// @Configuration
public class AppConfig {

    @Bean
    public MemberService memberService() {
        System.out.println("call AppConfig.memberService");
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public MemberRepository memberRepository() {
        System.out.println("call AppConfig.memberRepository");
        return new MemoryMemberRepository();
    }
    // ...
}
```

```
출력:
bean = class hello.core.AppConfig  // CGLIB 아님!
call AppConfig.memberService
call AppConfig.memberRepository
call AppConfig.orderService
call AppConfig.memberRepository  // 다시 호출됨!
call AppConfig.memberRepository  // 또 호출됨!
```

| 설정 | CGLIB 적용 | 싱글톤 보장 |
|------|-----------|------------|
| `@Configuration` + `@Bean` | O | O |
| `@Bean`만 사용 | X | X |

> **결론**: 스프링 설정 정보에는 항상 `@Configuration`을 사용하자.

---

## 실전 예제: 싱글톤 주의사항

### 싱글톤 빈의 필드 설계

```java
// ❌ 위험한 설계
@Service
public class OrderService {

    private Order currentOrder;  // 상태를 가진 필드

    public void createOrder(Long memberId, String itemName, int price) {
        currentOrder = new Order(memberId, itemName, price);
    }

    public Order getCurrentOrder() {
        return currentOrder;  // 동시 접근 시 다른 주문이 반환될 수 있음
    }
}
```

```java
// ✅ 안전한 설계
@Service
public class OrderService {

    private final MemberRepository memberRepository;  // 불변 필드 (의존성)
    private final DiscountPolicy discountPolicy;      // 불변 필드 (의존성)

    // 생성자 주입 (불변)
    public OrderService(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }

    public Order createOrder(Long memberId, String itemName, int price) {
        Member member = memberRepository.findById(memberId);
        int discountPrice = discountPolicy.discount(member, price);
        return new Order(memberId, itemName, price, discountPrice);  // 바로 반환
    }
}
```

### 캐시 구현 시 주의사항

```java
// ❌ 위험한 캐시 구현
@Service
public class ProductService {

    private Map<Long, Product> cache = new HashMap<>();  // 동시성 문제!

    public Product getProduct(Long id) {
        if (cache.containsKey(id)) {
            return cache.get(id);
        }
        Product product = productRepository.findById(id);
        cache.put(id, product);  // 동시 접근 시 문제 발생 가능
        return product;
    }
}
```

```java
// ✅ 안전한 캐시 구현
@Service
public class ProductService {

    private final ConcurrentHashMap<Long, Product> cache = new ConcurrentHashMap<>();

    public Product getProduct(Long id) {
        return cache.computeIfAbsent(id, k -> productRepository.findById(k));
    }

    // 또는 @Cacheable 사용 권장
    @Cacheable("products")
    public Product getProductWithCache(Long id) {
        return productRepository.findById(id);
    }
}
```

---

## 정리

### 스프링 싱글톤의 핵심

| 항목 | 설명 |
|------|------|
| **싱글톤 패턴** | 인스턴스를 1개만 생성하는 디자인 패턴 |
| **싱글톤 패턴 문제점** | DIP/OCP 위반, 테스트 어려움, 유연성 저하 |
| **스프링 싱글톤 컨테이너** | 싱글톤 패턴의 문제점 해결, 빈을 싱글톤으로 관리 |
| **싱글톤 주의점** | 무상태(stateless)로 설계해야 함 |
| **@Configuration** | CGLIB로 싱글톤 보장 |

### 체크리스트

- [ ] 스프링 빈에 상태를 저장하는 필드가 있는가?
- [ ] 여러 스레드에서 동시에 접근하는 필드가 있는가?
- [ ] `@Configuration` 없이 `@Bean`만 사용하고 있지 않은가?
- [ ] 필드 대신 지역 변수, 파라미터를 사용하고 있는가?

### 핵심 인용구

> "스프링 빈의 필드에 공유 값을 설정하면 정말 큰 장애가 발생할 수 있다!!!"

---

## 참고 자료

- [Spring Framework - Singleton Scope](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)
- [CGLIB 라이브러리](https://github.com/cglib/cglib)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
