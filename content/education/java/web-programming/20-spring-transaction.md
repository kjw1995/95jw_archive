---
title: "20. 스프링 트랜잭션"
weight: 20
---

스프링의 트랜잭션 개념과 속성, 애너테이션 기반 트랜잭션 적용 방법을 다룬다.

---

## 1. 트랜잭션이란?

트랜잭션(Transaction)은 여러 DML 명령문을 **하나의 논리적 작업 단위**로 묶어 관리하는 것이다. **All or Nothing** 원칙에 따라 모든 SQL이 성공하면 커밋(commit)하고, 하나라도 실패하면 전체를 롤백(rollback)한다.

```
  트랜잭션 처리 흐름

  SQL-1 실행
       │
       ▼
  SQL-2 실행
       │
       ▼
  SQL-3 실행
       │
       ▼
  ┌──────────────┐
  │ 모두 성공?    │
  └──────┬───────┘
    Yes  │  No
     │   │   │
     ▼   │   ▼
  COMMIT │ ROLLBACK
```

### 대표적인 예시: 계좌 이체

```java
// 1. A 계좌에서 출금
updateBalance(accountA, -10000);
// 2. B 계좌에 입금
updateBalance(accountB, +10000);
```

1번은 성공했는데 2번에서 오류가 발생하면? 트랜잭션이 없으면 A의 돈만 빠져나간다. 트랜잭션으로 묶으면 **두 작업 모두 롤백**되어 데이터 정합성을 지킨다.

{{< callout type="warning" >}}
트랜잭션은 주로 **Service 계층**에서 적용한다. DAO 단위로 걸면 여러 DAO 호출을 하나의 작업 단위로 묶을 수 없다.
{{< /callout >}}

---

## 2. 스프링 트랜잭션 설정 방법

스프링에서 트랜잭션을 적용하는 방법은 두 가지다.

| 방식 | 특징 |
|:-----|:-----|
| XML 설정 | `<tx:advice>`, `<aop:config>`으로 선언 |
| 애너테이션 | `@Transactional`을 메서드/클래스에 부착 |

XML 방식은 설정이 복잡해지면 관리가 어려워 현재는 **애너테이션 방식이 표준**이다.

### 애너테이션 방식 설정

```xml
<!-- 트랜잭션 매니저 등록 -->
<bean id="transactionManager"
  class="org.springframework.jdbc
         .datasource
         .DataSourceTransactionManager">
    <property name="dataSource"
        ref="dataSource" />
</bean>

<!-- 애너테이션 기반 트랜잭션 활성화 -->
<tx:annotation-driven
    transaction-manager="transactionManager" />
```

### Service에서 사용

```java
@Service("orderService")
@Transactional
public class OrderServiceImpl
        implements OrderService {

    @Autowired
    private OrderDAO orderDAO;

    @Autowired
    private StockDAO stockDAO;

    @Override
    public void placeOrder(OrderVO order) {
        // 두 작업이 하나의 트랜잭션으로 묶임
        orderDAO.insertOrder(order);
        stockDAO.decreaseStock(
            order.getProductId(),
            order.getQuantity());
    }
}
```

{{< callout type="info" >}}
`@Transactional`을 **클래스**에 붙이면 모든 public 메서드에 트랜잭션이 적용된다. **메서드**에 붙이면 해당 메서드에만 적용된다.
{{< /callout >}}

---

## 3. 트랜잭션 속성

`@Transactional`에 설정할 수 있는 속성은 다음과 같다.

| 속성 | 기능 |
|:-----|:-----|
| `propagation` | 트랜잭션 전파 규칙 설정 |
| `isolation` | 트랜잭션 격리 레벨 설정 |
| `readOnly` | 읽기 전용 여부 설정 |
| `rollbackFor` | 롤백할 예외 타입 설정 |
| `noRollbackFor` | 롤백하지 않을 예외 타입 설정 |
| `timeout` | 타임아웃 시간(초) 설정 |

---

## 4. propagation — 전파 규칙

트랜잭션이 이미 진행 중일 때 새로운 트랜잭션 요청을 어떻게 처리할지 결정한다.

| 값 | 동작 |
|:-----|:-----|
| `REQUIRED` | 기존 트랜잭션 사용, 없으면 새로 생성 **(기본값)** |
| `MANDATORY` | 기존 트랜잭션 필수, 없으면 예외 발생 |
| `REQUIRES_NEW` | 항상 새 트랜잭션 생성 (기존은 일시 중지) |
| `SUPPORTS` | 트랜잭션 불필요, 있으면 참여 |
| `NOT_SUPPORTED` | 트랜잭션 불필요, 있으면 일시 중지 |
| `NEVER` | 트랜잭션 불필요, 있으면 예외 발생 |
| `NESTED` | 기존 트랜잭션 안에 중첩 트랜잭션 생성 |

### 자주 쓰는 전파 규칙 비교

```
  REQUIRED (기본값)

  ServiceA.method()
  ┌──── TX-1 ─────────┐
  │ ServiceB.method()  │
  │ (TX-1에 참여)       │
  └────────────────────┘

  REQUIRES_NEW

  ServiceA.method()
  ┌──── TX-1 ──────┐
  │  (일시 중지)     │
  └────────────────┘
  ┌──── TX-2 ──────┐
  │ ServiceB       │
  │  .method()     │
  └────────────────┘
  ┌──── TX-1 재개 ──┐
  └────────────────┘
```

```java
// 로그는 별도 트랜잭션으로 저장
@Transactional(
    propagation = Propagation.REQUIRES_NEW)
public void saveLog(LogVO log) {
    logDAO.insertLog(log);
}
```

{{< callout type="info" >}}
`REQUIRES_NEW`는 **로그 저장**, **알림 발송**처럼 메인 트랜잭션 실패와 무관하게 반드시 기록해야 하는 작업에 사용한다.
{{< /callout >}}

---

## 5. isolation — 격리 레벨

동시에 여러 트랜잭션이 실행될 때 데이터 접근을 어느 수준까지 허용할지 결정한다.

| 레벨 | 설명 | Dirty Read | Non-Repeatable Read | Phantom Read |
|:-----|:-----|:----:|:----:|:----:|
| `DEFAULT` | DB 기본값 사용 | — | — | — |
| `READ_UNCOMMITTED` | 커밋 안 된 데이터 읽기 허용 | O | O | O |
| `READ_COMMITTED` | 커밋된 데이터만 읽기 | X | O | O |
| `REPEATABLE_READ` | 같은 데이터를 반복 읽기 시 동일 보장 | X | X | O |
| `SERIALIZABLE` | 완전 직렬화 (성능 최저) | X | X | X |

{{< callout type="warning" >}}
격리 레벨이 높을수록 데이터 정합성은 좋아지지만 **동시 처리 성능이 떨어진다**. 대부분의 실무에서는 DB 기본값(`DEFAULT`)을 사용한다.
{{< /callout >}}

---

## 6. rollbackFor와 readOnly

### rollbackFor

스프링은 기본적으로 **RuntimeException(Unchecked)**에서만 롤백한다. Checked Exception에서도 롤백하려면 명시해야 한다.

```java
@Transactional(
    rollbackFor = Exception.class)
public void transferMoney(
        String from, String to, int amount)
        throws Exception {
    accountDAO.withdraw(from, amount);
    accountDAO.deposit(to, amount);
}
```

| 설정 | 롤백 대상 |
|:-----|:-----|
| 기본값 | `RuntimeException` 및 하위 클래스 |
| `rollbackFor = Exception.class` | 모든 예외에서 롤백 |
| `noRollbackFor = SomeException.class` | 해당 예외는 롤백하지 않음 |

### readOnly

조회 전용 메서드에 `readOnly = true`를 설정하면 **불필요한 스냅샷 저장을 건너뛰어** 성능이 향상된다.

```java
@Transactional(readOnly = true)
public List<MemberVO> getAllMembers() {
    return memberDAO.selectAllMembers();
}
```

{{< callout type="info" >}}
`readOnly = true`인 트랜잭션에서 INSERT/UPDATE/DELETE를 실행하면 DB에 따라 예외가 발생하거나 무시될 수 있다. 조회 메서드에만 사용하자.
{{< /callout >}}

---

## 7. 트랜잭션 적용 시 주의사항

### 같은 클래스 내부 호출 문제

스프링 `@Transactional`은 **프록시 기반**으로 동작한다. 같은 클래스 내부에서 메서드를 호출하면 프록시를 거치지 않아 트랜잭션이 적용되지 않는다.

```java
@Service
public class MemberServiceImpl
        implements MemberService {

    // 트랜잭션 적용됨
    @Transactional
    public void methodA() {
        // 내부 호출 → 트랜잭션 미적용!
        methodB();
    }

    @Transactional(
        propagation = Propagation.REQUIRES_NEW)
    public void methodB() {
        // 새 트랜잭션이 시작되지 않는다
    }
}
```

```
  프록시 기반 트랜잭션

  외부 호출
       │
       ▼
  ┌──────────────┐
  │   Proxy      │
  │  (TX 시작)   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  실제 객체    │
  │  methodA()   │
  │    ↓         │
  │  methodB()   │ ← 프록시 안 거침
  └──────────────┘
```

{{< callout type="warning" >}}
내부 호출 시 트랜잭션이 필요하면 **별도의 빈으로 분리**하거나, `AopContext.currentProxy()`를 사용해야 한다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 트랜잭션 | 여러 SQL을 하나의 작업 단위로 묶어 All or Nothing 처리 |
| `@Transactional` | 스프링에서 트랜잭션을 선언적으로 적용하는 애너테이션 |
| `propagation` | 기존 트랜잭션과의 관계를 결정 (기본값: `REQUIRED`) |
| `isolation` | 동시 트랜잭션 간 데이터 접근 수준 설정 |
| `rollbackFor` | Checked Exception에서도 롤백하도록 지정 |
| `readOnly` | 조회 전용 트랜잭션으로 성능 최적화 |

### XML 방식 vs 애너테이션 방식

| 구분 | XML 방식 | 애너테이션 방식 |
|:-----|:-----|:-----|
| 설정 위치 | 스프링 설정 파일 | 자바 클래스/메서드 |
| 가독성 | 설정이 많아지면 복잡 | 코드와 가까워 직관적 |
| 유연성 | AOP 패턴으로 일괄 적용 가능 | 메서드별 세밀한 제어 가능 |
| 현재 추세 | 레거시 프로젝트 | **표준 (권장)** |
