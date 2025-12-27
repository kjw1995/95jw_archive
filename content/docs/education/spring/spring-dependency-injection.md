---
title: "의존관계 자동 주입"
description: "스프링의 다양한 의존관계 주입 방법과 조회 빈이 2개 이상일 때의 해결 방법을 상세히 알아본다"
summary: "생성자 주입, @Autowired, @Qualifier, @Primary, 롬복을 활용한 의존관계 주입"
date: 2025-01-06
weight: 5
draft: false
toc: true
---

## 다양한 의존관계 주입 방법

스프링의 의존관계 주입은 크게 4가지 방법이 있다.

### 1. 생성자 주입 (권장)

생성자를 통해 의존관계를 주입받는 방법이다.

```java
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

**특징**:
- 생성자 호출 시점에 **딱 1번만** 호출됨
- **불변**, **필수** 의존관계에 사용
- 생성자가 1개면 `@Autowired` **생략 가능** (스프링 4.3+)

```java
// @Autowired 생략 가능 (생성자가 1개인 경우)
@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    // @Autowired 생략
    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

### 2. 수정자 주입 (Setter 주입)

setter 메서드를 통해 의존관계를 주입받는 방법이다.

```java
@Component
public class OrderServiceImpl implements OrderService {

    private MemberRepository memberRepository;
    private DiscountPolicy discountPolicy;

    @Autowired
    public void setMemberRepository(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Autowired
    public void setDiscountPolicy(DiscountPolicy discountPolicy) {
        this.discountPolicy = discountPolicy;
    }
}
```

**특징**:
- **선택**, **변경** 가능성이 있는 의존관계에 사용
- 자바빈 프로퍼티 규약의 수정자 메서드 방식

```java
// 선택적 주입 (주입 대상이 없어도 오류 발생하지 않음)
@Autowired(required = false)
public void setDiscountPolicy(DiscountPolicy discountPolicy) {
    this.discountPolicy = discountPolicy;
}
```

### 3. 필드 주입 (비권장)

필드에 바로 주입하는 방법이다.

```java
@Component
public class OrderServiceImpl implements OrderService {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private DiscountPolicy discountPolicy;
}
```

**특징**:
- 코드가 간결하지만 **외부에서 변경 불가능**
- **테스트하기 어려움** (DI 컨테이너 없이 테스트 불가)
- **사용하지 않는 것이 권장됨**

```java
// ❌ 테스트 시 문제 발생
@Test
void test() {
    OrderServiceImpl orderService = new OrderServiceImpl();
    // memberRepository, discountPolicy가 null!
    orderService.createOrder(...);  // NullPointerException
}
```

> **예외적 사용**: 테스트 코드나 `@Configuration` 같은 설정용 클래스에서는 사용할 수 있다.

### 4. 일반 메서드 주입

일반 메서드를 통해 주입받는 방법이다.

```java
@Component
public class OrderServiceImpl implements OrderService {

    private MemberRepository memberRepository;
    private DiscountPolicy discountPolicy;

    @Autowired
    public void init(MemberRepository memberRepository,
                    DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

**특징**:
- 한 번에 여러 필드를 주입받을 수 있음
- 일반적으로 잘 사용하지 않음

---

## 생성자 주입을 선택해야 하는 이유

### 1. 불변성 (Immutability)

대부분의 의존관계는 애플리케이션 종료 시점까지 변하면 안 된다.

```java
// 생성자 주입: 불변 보장
@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;    // final 키워드!
    private final DiscountPolicy discountPolicy;        // final 키워드!

    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
    // setter가 없으므로 변경 불가능
}
```

### 2. 누락 방지

수정자 주입을 사용하면 필수 의존관계 누락 시 런타임 오류가 발생한다.

```java
// 수정자 주입: 누락 가능
@Component
public class OrderServiceImpl implements OrderService {

    private MemberRepository memberRepository;
    private DiscountPolicy discountPolicy;

    @Autowired
    public void setMemberRepository(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }
    // setDiscountPolicy 누락해도 컴파일 성공!
}

// 테스트
@Test
void createOrder() {
    OrderServiceImpl orderService = new OrderServiceImpl();
    orderService.setMemberRepository(new MemoryMemberRepository());
    // setDiscountPolicy() 호출 안 함 → NullPointerException
    orderService.createOrder(1L, "itemA", 10000);
}
```

```java
// 생성자 주입: 컴파일 오류로 누락 방지
@Test
void createOrder() {
    // 컴파일 오류! 필수 파라미터 누락
    OrderServiceImpl orderService = new OrderServiceImpl();
}
```

### 3. final 키워드 사용

생성자 주입만 `final` 키워드를 사용할 수 있다.

```java
@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        // discountPolicy 초기화 누락 시 컴파일 오류!
    }
}
```

> **"컴파일 오류는 세상에서 가장 빠르고, 좋은 오류다!"**

---

## 롬복과 최신 트렌드

### @RequiredArgsConstructor

롬복의 `@RequiredArgsConstructor`를 사용하면 `final`이 붙은 필드의 생성자를 자동 생성한다.

```java
// 기존 코드
@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

```java
// 롬복 적용
@Component
@RequiredArgsConstructor  // final 필드의 생성자 자동 생성
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    // 생성자 자동 생성됨!
}
```

### 롬복 설정

```groovy
// build.gradle
dependencies {
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    testCompileOnly 'org.projectlombok:lombok'
    testAnnotationProcessor 'org.projectlombok:lombok'
}
```

### 자주 사용하는 롬복 애노테이션

| 애노테이션 | 설명 |
|-----------|------|
| `@Getter` | getter 메서드 생성 |
| `@Setter` | setter 메서드 생성 |
| `@ToString` | toString() 메서드 생성 |
| `@EqualsAndHashCode` | equals(), hashCode() 생성 |
| `@NoArgsConstructor` | 기본 생성자 생성 |
| `@AllArgsConstructor` | 모든 필드 생성자 생성 |
| `@RequiredArgsConstructor` | final 필드 생성자 생성 |
| `@Data` | Getter, Setter, ToString, Equals, HashCode 모두 생성 |
| `@Builder` | 빌더 패턴 생성 |

```java
// 실무에서 자주 사용하는 조합
@Component
@RequiredArgsConstructor
@Slf4j  // 로깅을 위한 log 필드 자동 생성
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    @Override
    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        log.info("주문 생성: memberId={}, itemName={}", memberId, itemName);
        // ...
    }
}
```

---

## 조회 빈이 2개 이상일 때

### 문제 상황

`@Autowired`는 타입으로 조회하므로, 같은 타입의 빈이 2개 이상이면 문제가 발생한다.

```java
@Component
public class FixDiscountPolicy implements DiscountPolicy { }

@Component
public class RateDiscountPolicy implements DiscountPolicy { }
```

```java
@Component
public class OrderServiceImpl implements OrderService {

    @Autowired
    private DiscountPolicy discountPolicy;  // 어떤 빈을 주입해야 할까?
}
```

```
NoUniqueBeanDefinitionException: No qualifying bean of type
'hello.core.discount.DiscountPolicy' available: expected single matching bean
but found 2: fixDiscountPolicy, rateDiscountPolicy
```

### 해결 방법 1: @Autowired 필드명 매칭

`@Autowired`는 타입 매칭 후 결과가 2개 이상이면 필드명(또는 파라미터명)으로 빈 이름을 추가 매칭한다.

```java
// 필드명을 빈 이름으로 변경
@Autowired
private DiscountPolicy rateDiscountPolicy;  // rateDiscountPolicy 빈 주입
```

```java
// 파라미터명으로 매칭
@Autowired
public OrderServiceImpl(MemberRepository memberRepository,
                       DiscountPolicy rateDiscountPolicy) {  // rateDiscountPolicy 빈 주입
    this.memberRepository = memberRepository;
    this.discountPolicy = rateDiscountPolicy;
}
```

**@Autowired 매칭 순서**:
1. 타입 매칭
2. 타입 매칭 결과가 2개 이상이면 필드명/파라미터명으로 빈 이름 매칭

### 해결 방법 2: @Qualifier

`@Qualifier`는 추가 구분자를 붙여주는 방법이다.

```java
@Component
@Qualifier("mainDiscountPolicy")
public class RateDiscountPolicy implements DiscountPolicy { }

@Component
@Qualifier("fixDiscountPolicy")
public class FixDiscountPolicy implements DiscountPolicy { }
```

```java
@Component
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    @Autowired
    public OrderServiceImpl(MemberRepository memberRepository,
                           @Qualifier("mainDiscountPolicy") DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

**@Qualifier 매칭 순서**:
1. @Qualifier끼리 매칭
2. 빈 이름 매칭
3. `NoSuchBeanDefinitionException` 예외 발생

### 해결 방법 3: @Primary

`@Primary`는 우선순위를 부여하는 방법이다.

```java
@Component
@Primary  // 우선 선택됨
public class RateDiscountPolicy implements DiscountPolicy { }

@Component
public class FixDiscountPolicy implements DiscountPolicy { }
```

```java
@Component
public class OrderServiceImpl implements OrderService {

    @Autowired  // RateDiscountPolicy 자동 주입 (@Primary)
    private DiscountPolicy discountPolicy;
}
```

### @Primary vs @Qualifier

| 비교 | @Primary | @Qualifier |
|------|----------|------------|
| **사용법** | 빈에 표시 | 주입 지점에 표시 |
| **적합한 상황** | 메인으로 사용할 빈 | 서브로 사용할 빈 |
| **우선순위** | 낮음 | 높음 |

```java
// 실무 활용 예시
// 메인 데이터베이스: @Primary
@Component
@Primary
public class MainDataSource implements DataSource { }

// 서브 데이터베이스: @Qualifier
@Component
@Qualifier("subDataSource")
public class SubDataSource implements DataSource { }

// 사용
@Service
public class MemberService {

    @Autowired
    private DataSource mainDataSource;  // MainDataSource (@Primary)

    @Autowired
    @Qualifier("subDataSource")
    private DataSource subDataSource;  // SubDataSource
}
```

---

## 커스텀 애노테이션 만들기

`@Qualifier("문자열")`은 컴파일 시 타입 체크가 되지 않는다. 애노테이션을 직접 만들어 해결할 수 있다.

```java
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER,
         ElementType.TYPE, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
@Qualifier("mainDiscountPolicy")
public @interface MainDiscountPolicy {
}
```

```java
@Component
@MainDiscountPolicy
public class RateDiscountPolicy implements DiscountPolicy { }
```

```java
@Component
public class OrderServiceImpl implements OrderService {

    @Autowired
    public OrderServiceImpl(MemberRepository memberRepository,
                           @MainDiscountPolicy DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

---

## 조회한 빈이 모두 필요할 때 (List, Map)

의도적으로 해당 타입의 스프링 빈이 모두 필요한 경우가 있다.

### 전략 패턴 구현

```java
@Component
public class DiscountService {

    private final Map<String, DiscountPolicy> policyMap;
    private final List<DiscountPolicy> policies;

    @Autowired
    public DiscountService(Map<String, DiscountPolicy> policyMap,
                          List<DiscountPolicy> policies) {
        this.policyMap = policyMap;
        this.policies = policies;

        System.out.println("policyMap = " + policyMap);
        System.out.println("policies = " + policies);
    }

    public int discount(Member member, int price, String discountCode) {
        DiscountPolicy discountPolicy = policyMap.get(discountCode);
        return discountPolicy.discount(member, price);
    }
}
```

```java
// 테스트
@Test
void findAllBean() {
    ApplicationContext ac = new AnnotationConfigApplicationContext(
        AutoAppConfig.class, DiscountService.class);

    DiscountService discountService = ac.getBean(DiscountService.class);
    Member member = new Member(1L, "userA", Grade.VIP);

    // 동적으로 할인 정책 선택
    int fixDiscountPrice = discountService.discount(member, 10000, "fixDiscountPolicy");
    assertThat(fixDiscountPrice).isEqualTo(1000);

    int rateDiscountPrice = discountService.discount(member, 20000, "rateDiscountPolicy");
    assertThat(rateDiscountPrice).isEqualTo(2000);
}
```

```
출력:
policyMap = {fixDiscountPolicy=FixDiscountPolicy@xxx, rateDiscountPolicy=RateDiscountPolicy@xxx}
policies = [FixDiscountPolicy@xxx, RateDiscountPolicy@xxx]
```

### Map, List 주입 정리

| 타입 | 설명 |
|------|------|
| `Map<String, Type>` | key: 빈 이름, value: 빈 객체 |
| `List<Type>` | 해당 타입의 모든 빈을 리스트로 |

---

## 자동, 수동의 올바른 실무 운영 기준

### 편리한 자동 기능을 기본으로 사용

```java
// 자동 빈 등록 (권장)
@Controller
public class MemberController { }

@Service
public class MemberServiceImpl implements MemberService { }

@Repository
public class MemoryMemberRepository implements MemberRepository { }
```

**자동 등록의 장점**:
- 스프링 부트가 기본으로 제공
- 빈의 갯수가 많아져도 관리가 편함
- `@Component`만 붙이면 끝

### 수동 등록이 적합한 경우

**1. 기술 지원 객체**

```java
// 기술 지원 빈은 수동 등록 권장
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public PlatformTransactionManager transactionManager() {
        return new JpaTransactionManager();
    }
}
```

**기술 지원 빈의 특징**:
- 애플리케이션 전반에 광범위하게 영향
- 문제 발생 시 어디서 발생했는지 파악 어려움
- 설정 정보에 명시적으로 드러나는 것이 유지보수에 유리

> "애플리케이션에 광범위하게 영향을 미치는 기술 지원 객체는 수동 빈으로 등록해서 딱! 설정 정보에 바로 나타나게 하는 것이 유지보수하기 좋다."

**2. 다형성을 적극 활용하는 비즈니스 로직**

```java
// 여러 할인 정책을 Map으로 관리할 때
// 수동 등록으로 한눈에 보이게 하는 것도 고려
@Configuration
public class DiscountPolicyConfig {

    @Bean
    public DiscountPolicy fixDiscountPolicy() {
        return new FixDiscountPolicy();
    }

    @Bean
    public DiscountPolicy rateDiscountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

또는 자동 등록을 사용하되 **특정 패키지에 모아두기**:

```
discount
├── DiscountPolicy.java           ← 인터페이스
├── FixDiscountPolicy.java        ← @Component
└── RateDiscountPolicy.java       ← @Component
```

### 정리

| 구분 | 권장 방식 | 이유 |
|------|----------|------|
| **비즈니스 로직 빈** | 자동 등록 | 갯수가 많고 유사한 패턴 |
| **기술 지원 빈** | 수동 등록 | 명확하게 드러내기 위함 |
| **다형성 활용 빈** | 수동 등록 또는 패키지 묶기 | 한눈에 파악하기 위함 |

---

## 정리

### 의존관계 주입 방법 비교

| 방법 | 사용 시점 | 특징 |
|------|----------|------|
| **생성자 주입** | 필수, 불변 | final 사용 가능, **권장** |
| **수정자 주입** | 선택, 변경 가능 | 런타임에 변경 가능 |
| **필드 주입** | - | **비권장** (테스트 어려움) |
| **메서드 주입** | 특수한 경우 | 거의 사용 안 함 |

### 조회 빈이 2개 이상일 때

| 방법 | 사용법 | 우선순위 |
|------|--------|---------|
| **필드명 매칭** | 필드명을 빈 이름으로 | - |
| **@Qualifier** | 추가 구분자 | 높음 |
| **@Primary** | 우선 빈 지정 | 낮음 |

### 핵심 권장 사항

1. **생성자 주입**을 기본으로 사용
2. **롬복 @RequiredArgsConstructor** 활용
3. 조회 빈 충돌 시 **@Primary**, **@Qualifier** 활용
4. 기술 지원 빈은 **수동 등록** 고려

---

## 참고 자료

- [Spring Framework - Dependency Injection](https://docs.spring.io/spring-framework/reference/core/beans/dependencies.html)
- [Project Lombok](https://projectlombok.org/)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
