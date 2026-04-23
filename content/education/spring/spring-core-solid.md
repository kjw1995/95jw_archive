---
title: "스프링 핵심 개념과 SOLID 원칙"
description: "스프링의 탄생 배경, 핵심 철학, 그리고 객체 지향 설계의 SOLID 원칙을 상세히 알아본다"
summary: "EJB의 한계를 극복하고 등장한 스프링의 역사와 좋은 객체 지향 설계를 위한 SOLID 원칙의 이해"
date: 2025-01-06
weight: 1
draft: false
toc: true
---

## 자바 진영의 변화와 스프링의 탄생

### EJB의 문제점과 새로운 대안

과거 Enterprise Java Beans(EJB)는 복잡성과 불편함 때문에 "EJB 지옥"이라 불렸다. EJB는 다음과 같은 문제점을 가졌다.

- **복잡한 설정**: XML 기반의 방대한 설정이 필요하다.
- **무거운 컨테이너 의존**: EJB 컨테이너 없이 테스트가 불가능하다.
- **침습적 API**: 애플리케이션 코드가 EJB 인터페이스를 구현해야 한다.
- **생산성 저하**: 단순한 기능을 만들기 위해서도 복잡한 코드가 필요하다.

```java
// EJB 2.x 시절의 복잡한 코드 예시
public class OrderServiceBean implements SessionBean {
    private SessionContext context;

    public void setSessionContext(SessionContext ctx) {
        this.context = ctx;
    }

    public void ejbCreate() { }
    public void ejbRemove() { }
    public void ejbActivate() { }
    public void ejbPassivate() { }

    // 실제 비즈니스 로직
    public void createOrder(Order order) {
        // 주문 생성 로직
    }
}
```

이에 대한 대안으로 **스프링**과 **하이버네이트**가 등장했다.

- 하이버네이트는 EJB 엔티티빈을 대체하고 JPA 표준 정의에 기여했다.
- 스프링은 EJB 컨테이너를 대체하며 "단순함의 승리"를 이끌었다.

### 스프링의 역사

| 연도 | 이벤트 |
|:-----|:-------|
| 2002년 | 로드 존슨의 책 출간, EJB 문제점 지적 |
| 2003년 | 스프링 프레임워크 1.0 출시 (XML 기반 설정) |
| 2009년 | 스프링 3.0 출시 (자바 코드 설정 지원) |
| 2014년 | 스프링 부트 1.0 출시 |
| 2017년 | 스프링 5.0 출시 (리액티브 프로그래밍 지원) |
| 2022년 | 스프링 부트 3.0 출시 (Java 17 필수, Jakarta EE 9+) |

### 스프링이 제시한 핵심 개념

```java
// POJO (Plain Old Java Object) - 순수 자바 객체
public class OrderService {
    private final OrderRepository orderRepository;

    // 의존성 주입을 통해 외부에서 주입받음
    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public void createOrder(Order order) {
        orderRepository.save(order);
    }
}
```

**스프링의 핵심 철학**:
- **POJO 기반 개발**: 순수 자바 객체로 비즈니스 로직을 구현한다.
- **제어의 역전(IoC)**: 객체의 생성과 생명주기 관리를 프레임워크에 위임한다.
- **의존관계 주입(DI)**: 외부에서 의존 객체를 주입한다.

{{< callout type="info" >}}
스프링은 특정 API에 종속되지 않는 POJO를 전제로 한다. 이 덕분에 프레임워크 버전이 바뀌어도 비즈니스 로직 코드를 거의 수정하지 않고 유지할 수 있다.
{{< /callout >}}

---

## 스프링 생태계

### 스프링 프레임워크 구조

```
┌────────────────────────────────┐
│        Spring Boot             │
├────────────────────────────────┤
│ Data │ Security │ Cloud │ ...  │
├────────────────────────────────┤
│      Spring Framework          │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ Core │ │ Web  │ │ Data │    │
│  │DI/IoC│ │ MVC  │ │Access│    │
│  └──────┘ └──────┘ └──────┘    │
└────────────────────────────────┘
```

### 핵심 모듈별 기능

| 모듈 | 주요 기능 |
|:-----|:---------|
| Core | DI 컨테이너, AOP, 이벤트, 리소스 관리 |
| Web | Spring MVC, WebFlux (리액티브), REST API |
| Data Access | JDBC, 트랜잭션, ORM 지원 (JPA, Hibernate) |
| Test | 통합 테스트, 모킹 지원 |

### 스프링 부트의 특징

```java
@SpringBootApplication  // 핵심 애노테이션
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

`@SpringBootApplication`은 다음 애노테이션을 포함한다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootConfiguration
@EnableAutoConfiguration  // 자동 구성
@ComponentScan            // 컴포넌트 스캔
public @interface SpringBootApplication {
}
```

**스프링 부트의 장점**:
- 단독 실행 가능한 애플리케이션을 만들 수 있다 (내장 톰캣 포함).
- 자동 구성(Auto Configuration)을 통해 설정을 최소화한다.
- 외부 설정이 간소화되어 있다(`application.properties`).
- 프로덕션 준비 기능(메트릭, 헬스 체크 등)을 제공한다.

---

## 좋은 객체 지향 설계의 원칙

### 객체 지향 프로그래밍의 핵심

> "객체 지향 프로그래밍은 프로그램을 유연하고 변경 용이하게 만든다."

```java
// 역할(인터페이스)과 구현(클래스)의 분리
public interface DiscountPolicy {
    int discount(Member member, int price);
}

// 구현 클래스 1: 정액 할인
public class FixDiscountPolicy implements DiscountPolicy {
    private int discountFixAmount = 1000;

    @Override
    public int discount(Member member, int price) {
        if (member.getGrade() == Grade.VIP) {
            return discountFixAmount;
        }
        return 0;
    }
}

// 구현 클래스 2: 정률 할인
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

**다형성의 핵심**: 클라이언트는 역할(인터페이스)에만 의존하므로 구현이 변경되어도 영향받지 않는다.

---

## SOLID 원칙

SOLID는 로버트 C. 마틴이 정리한 객체 지향 설계의 다섯 가지 원칙이다. 각 원칙은 "변경에 강한 코드"를 만들기 위한 서로 다른 관점을 제공한다.

### 한눈에 보기

| 원칙 | 핵심 한 줄 | 위반의 결과 |
|:-----|:-----------|:------------|
| SRP | 한 클래스는 하나의 책임 | 변경 파급 효과 증가 |
| OCP | 확장에는 열리고 변경에는 닫힘 | 기능 추가마다 기존 코드 수정 |
| LSP | 하위 타입은 상위 타입을 대체 가능 | 다형성 호출이 예기치 않게 동작 |
| ISP | 클라이언트별로 인터페이스 분리 | 불필요한 구현 강제, 빈 메서드 양산 |
| DIP | 추상에 의존, 구체에 의존하지 않기 | 구현 변경 시 상위 모듈까지 수정 |

### 1. SRP (Single Responsibility Principle) — 단일 책임 원칙

> "한 클래스는 하나의 책임만 가져야 한다."

**왜 필요한가**: 여러 책임이 한 클래스에 몰리면 한쪽의 변경이 다른 쪽에 영향을 준다. 책임을 분리하면 변경 파급이 한 클래스 안에 갇힌다.

```java
// ❌ 잘못된 예: 여러 책임을 가진 클래스
public class UserService {
    public void createUser(User user) { /* 사용자 생성 */ }
    public void sendEmail(String email, String content) { /* 이메일 발송 */ }
    public void generateReport() { /* 보고서 생성 */ }
}

// ✅ 올바른 예: 책임 분리
public class UserService {
    public void createUser(User user) { /* 사용자 생성 */ }
}

public class EmailService {
    public void sendEmail(String email, String content) { /* 이메일 발송 */ }
}

public class ReportService {
    public void generateReport() { /* 보고서 생성 */ }
}
```

**핵심**: 변경이 있을 때 파급 효과가 적어야 한다. 하나의 클래스는 하나의 이유로만 변경되어야 한다.

### 2. OCP (Open/Closed Principle) — 개방-폐쇄 원칙

> "소프트웨어 요소는 확장에는 열려 있으나 변경에는 닫혀 있어야 한다."

**왜 필요한가**: 요구사항이 변해도 기존 코드를 건드리지 않고 새 코드를 추가하는 것만으로 대응할 수 있어야 한다. 이는 인터페이스 기반 설계와 다형성으로 달성한다.

```java
// 인터페이스 (역할)
public interface MemberRepository {
    void save(Member member);
    Member findById(Long id);
}

// 구현 1: 메모리 저장소
public class MemoryMemberRepository implements MemberRepository {
    private static Map<Long, Member> store = new HashMap<>();

    @Override
    public void save(Member member) {
        store.put(member.getId(), member);
    }

    @Override
    public Member findById(Long id) {
        return store.get(id);
    }
}

// 구현 2: JDBC 저장소 (확장)
public class JdbcMemberRepository implements MemberRepository {
    private final DataSource dataSource;

    @Override
    public void save(Member member) {
        // JDBC로 저장
    }

    @Override
    public Member findById(Long id) {
        // JDBC로 조회
    }
}
```

```java
// 클라이언트 코드는 변경 없이 동작
public class MemberService {
    private final MemberRepository memberRepository;  // 인터페이스에 의존

    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    public void join(Member member) {
        memberRepository.save(member);  // 구현이 바뀌어도 이 코드는 변경 없음
    }
}
```

{{< callout type="warning" >}}
클라이언트 코드가 구체 클래스를 직접 `new`로 생성하면 OCP는 즉시 깨진다. "확장 포인트"는 반드시 외부 설정(예: `AppConfig`)에서 결정되어야 한다.
{{< /callout >}}

### 3. LSP (Liskov Substitution Principle) — 리스코프 치환 원칙

> "프로그램의 객체는 정확성을 깨뜨리지 않으면서 하위 타입의 인스턴스로 바꿀 수 있어야 한다."

**왜 필요한가**: 다형성을 보장하려면 하위 타입이 상위 타입의 규약(behavioral contract)을 지켜야 한다. 컴파일러는 타입만 검사하지만 LSP는 "의미"까지 요구한다.

```java
// ❌ LSP 위반 예시
public class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width) { this.width = width; }
    public void setHeight(int height) { this.height = height; }
    public int getArea() { return width * height; }
}

public class Square extends Rectangle {
    @Override
    public void setWidth(int width) {
        this.width = width;
        this.height = width;  // 정사각형이므로 높이도 변경
    }

    @Override
    public void setHeight(int height) {
        this.height = height;
        this.width = height;  // 정사각형이므로 너비도 변경
    }
}

// 문제 발생!
Rectangle rect = new Square();
rect.setWidth(5);
rect.setHeight(4);
System.out.println(rect.getArea());  // 예상: 20, 실제: 16
```

```java
// ✅ LSP 준수: 인터페이스 규약을 지킴
public interface Car {
    void accelerate();  // 엑셀을 밟으면 앞으로 가야 함
}

public class NormalCar implements Car {
    @Override
    public void accelerate() {
        // 앞으로 이동 (규약 준수)
    }
}

// 뒤로 가는 자동차는 LSP 위반!
public class BackwardCar implements Car {
    @Override
    public void accelerate() {
        // 뒤로 이동 (규약 위반!)
    }
}
```

### 4. ISP (Interface Segregation Principle) — 인터페이스 분리 원칙

> "특정 클라이언트를 위한 인터페이스 여러 개가 범용 인터페이스 하나보다 낫다."

**왜 필요한가**: 크고 두꺼운 인터페이스는 구현체에게 쓰지도 않는 메서드까지 강제한다. 클라이언트 관점에서 필요한 만큼만 노출하면 결합도가 낮아지고 변경 범위도 좁아진다.

```java
// ❌ 잘못된 예: 범용 인터페이스
public interface SmartDevice {
    void print();
    void scan();
    void fax();
    void copy();
}

// 프린터는 fax 기능이 필요 없음
public class SimplePrinter implements SmartDevice {
    @Override
    public void print() { /* 구현 */ }

    @Override
    public void scan() { throw new UnsupportedOperationException(); }

    @Override
    public void fax() { throw new UnsupportedOperationException(); }

    @Override
    public void copy() { throw new UnsupportedOperationException(); }
}
```

```java
// ✅ 올바른 예: 분리된 인터페이스
public interface Printer {
    void print();
}

public interface Scanner {
    void scan();
}

public interface Fax {
    void fax();
}

// 필요한 인터페이스만 구현
public class SimplePrinter implements Printer {
    @Override
    public void print() { /* 구현 */ }
}

public class AllInOnePrinter implements Printer, Scanner, Fax {
    @Override
    public void print() { /* 구현 */ }

    @Override
    public void scan() { /* 구현 */ }

    @Override
    public void fax() { /* 구현 */ }
}
```

### 5. DIP (Dependency Inversion Principle) — 의존관계 역전 원칙

> "프로그래머는 추상화에 의존해야지, 구체화에 의존하면 안 된다."

**왜 필요한가**: 상위 정책(비즈니스 로직)이 하위 구현(인프라·기술 세부사항)에 직접 의존하면 기술이 바뀔 때마다 정책이 흔들린다. 상위와 하위가 공통된 추상(인터페이스)에 의존하면 방향이 "역전"되어 구현 교체가 자유로워진다.

```java
// ❌ DIP 위반: 구체 클래스에 의존
public class OrderServiceImpl implements OrderService {
    // 구체 클래스에 직접 의존
    private DiscountPolicy discountPolicy = new FixDiscountPolicy();

    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        int discountPrice = discountPolicy.discount(member, itemPrice);
        return new Order(memberId, itemName, itemPrice, discountPrice);
    }
}
```

```java
// ✅ DIP 준수: 추상화(인터페이스)에 의존
public class OrderServiceImpl implements OrderService {
    // 인터페이스에만 의존 (구체 클래스를 모름)
    private final DiscountPolicy discountPolicy;

    // 외부에서 주입받음 (DI)
    public OrderServiceImpl(DiscountPolicy discountPolicy) {
        this.discountPolicy = discountPolicy;
    }

    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        int discountPrice = discountPolicy.discount(member, itemPrice);
        return new Order(memberId, itemName, itemPrice, discountPrice);
    }
}
```

{{< callout type="info" >}}
**DIP → IoC → DI 의 연결고리**

DIP는 "무엇을 해야 하는가(원칙)"이고, IoC는 "누가 제어를 갖는가(흐름)"이며, DI는 "어떻게 구현하는가(기법)"이다. 스프링 컨테이너는 이 세 개념을 한꺼번에 실현한다. DIP를 지키려면 구현 선택권을 외부로 넘겨야 하고(IoC), 그 선택을 실제로 주입해 주는 장치가 DI이다.
{{< /callout >}}

---

## OCP와 DIP 위반 문제 해결

### 문제 상황

역할과 구현을 분리하더라도 클라이언트 코드가 구체 클래스를 직접 선택하면 OCP와 DIP를 위반한다.

```java
public class OrderServiceImpl implements OrderService {
    // 인터페이스에 의존하지만...
    // private DiscountPolicy discountPolicy = new FixDiscountPolicy();

    // 구현체 변경 시 클라이언트 코드를 수정해야 함 → OCP 위반!
    private DiscountPolicy discountPolicy = new RateDiscountPolicy();
}
```

### 해결: 관심사의 분리

객체 생성 및 연관관계 설정을 담당하는 별도의 설정 클래스가 필요하다.

```java
// 설정 클래스: "공연 기획자" 역할
@Configuration
public class AppConfig {

    @Bean
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        // 할인 정책 변경 시 이곳만 수정하면 됨
        return new RateDiscountPolicy();
    }
}
```

```java
// 클라이언트 코드: 구체 클래스를 전혀 모름
public class OrderServiceImpl implements OrderService {
    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    // 생성자를 통해 주입받음 (무엇이 주입될지 모름)
    public OrderServiceImpl(MemberRepository memberRepository,
                           DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

### 의존관계 다이어그램

**변경 전 (DIP 위반)**

```
┌──────────────┐
│ OrderService │
│    Impl      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│DiscountPolicy│  (인터페이스)
└──────────────┘
       ▲
       │ new
┌──────────────┐
│ FixDiscount  │  (구체 생성)
│   Policy     │
└──────────────┘
```

**변경 후 (DIP 준수)**

```
┌──────────────┐      ┌──────────────┐
│ OrderService │─────▶│DiscountPolicy│
│    Impl      │      │ (인터페이스)  │
└──────▲───────┘      └──────────────┘
       │ 주입
┌──────┴───────┐
│  AppConfig   │  구현 선택·주입
└──────────────┘
```

---

## 정리

### 스프링과 객체 지향

- 스프링은 **좋은 객체 지향 애플리케이션**을 개발할 수 있게 도와주는 프레임워크다.
- **DI 컨테이너**를 통해 OCP, DIP를 지키면서 개발할 수 있다.
- 클라이언트 코드 변경 없이 기능을 확장할 수 있다.

### SOLID 원칙 요약

| 원칙 | 핵심 내용 | 스프링 지원 |
|:-----|:---------|:------------|
| SRP | 한 클래스는 하나의 책임 | - |
| OCP | 확장에 열림, 변경에 닫힘 | DI로 구현체 교체 용이 |
| LSP | 하위 타입 대체 가능 | 인터페이스 기반 설계 권장 |
| ISP | 인터페이스 분리 | - |
| DIP | 추상화에 의존 | DI 컨테이너로 자동 주입 |

### 핵심 인용구

> "스프링은 다음 기술로 다형성 + OCP, DIP를 가능하게 지원한다."
> - DI (Dependency Injection): 의존관계 주입
> - DI 컨테이너 제공

---

## 참고 자료

- [스프링 공식 문서](https://docs.spring.io/spring-framework/reference/)
- [SOLID 원칙 - Wikipedia](https://en.wikipedia.org/wiki/SOLID)
- 인프런 - 스프링 핵심 원리 기본편 (김영한)
