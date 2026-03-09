---
title: "15. 스프링 AOP 기능"
weight: 16
---

관점 지향 프로그래밍(AOP)의 개념과 스프링에서 AOP를 구현하는 방법을 다룬다.

---

## 1. 관점 지향 프로그래밍의 등장

애플리케이션에는 **주기능**(비즈니스 로직)과 **보조 기능**(로깅, 트랜잭션, 보안 등)이 함께 존재한다. 보조 기능은 여러 클래스에 걸쳐 반복되므로 코드 중복이 생기고, 수정 시 여러 곳을 함께 고쳐야 한다.

**AOP(Aspect-Oriented Programming)** 는 주기능과 보조 기능을 분리한 뒤, 보조 기능을 원하는 주기능에 선택적으로 적용하는 프로그래밍 방식이다.

```
  AOP 적용 전       AOP 적용 후

  ┌──────────┐    ┌──────────┐
  │ ServiceA │    │ ServiceA │
  │ 로깅      │    │ 주기능만  │
  │ 트랜잭션   │    └──────────┘
  │ 주기능    │
  └──────────┘    ┌──────────┐
  ┌──────────┐    │ ServiceB │
  │ ServiceB │    │ 주기능만  │
  │ 로깅      │    └──────────┘
  │ 트랜잭션   │
  │ 주기능    │    ┌──────────┐
  └──────────┘    │ Aspect   │
                  │ 로깅      │
                  │ 트랜잭션   │
                  └──────────┘
```

### AOP의 장점

| 장점 | 설명 |
|:-----|:-----|
| 코드 중복 제거 | 보조 기능을 한 곳에서 관리 |
| 가독성 향상 | 주기능 코드에만 집중 가능 |
| 유지보수 용이 | 보조 기능 변경 시 Aspect만 수정 |
| 선택적 적용 | 원하는 메서드에만 보조 기능 적용 |

---

## 2. AOP 관련 용어

| 용어 | 설명 |
|:-----|:-----|
| Aspect | 구현하고자 하는 보조 기능 |
| Advice | Aspect의 실제 구현체(클래스) |
| JoinPoint | Advice를 적용하는 지점 (스프링은 메서드 결합점만 제공) |
| Pointcut | Advice가 적용되는 대상을 패키지·클래스·메서드 패턴으로 지정 |
| Target | Advice가 적용되는 클래스 |
| Weaving | Advice를 주기능에 적용하는 과정 |

```
  AOP 용어 관계도

  ┌───────────────────┐
  │ Aspect (보조 기능) │
  │ ┌───────────────┐ │
  │ │ Advice (구현)  │ │
  │ └──────┬────────┘ │
  └────────┼──────────┘
           │ weaving
           ▼
  ┌───────────────────┐
  │ Target (주기능)    │
  │                   │
  │ method()←JoinPoint│
  │ ↑                 │
  │ Pointcut으로 지정  │
  └───────────────────┘
```

---

## 3. 스프링 API를 이용한 AOP 구현

스프링에서 AOP를 구현하는 방법은 **스프링 API**를 이용하는 방법과 **애너테이션**을 이용하는 방법이 있다. 먼저 스프링 API 방식의 구현 과정을 살펴본다.

```
  ① Target 클래스 지정
        │
        ▼
  ② Advice 클래스 작성
        │
        ▼
  ③ XML에 Pointcut 설정
        │
        ▼
  ④ Advisor 설정
  (Advice + Pointcut 결합)
        │
        ▼
  ⑤ ProxyFactoryBean으로
  Target에 Advice 적용
        │
        ▼
  ⑥ getBean()으로 사용
```

---

## 4. Advice 인터페이스

스프링 API에서 제공하는 Advice 인터페이스는 메서드 실행 시점에 따라 네 가지로 나뉜다.

| 인터페이스 | 실행 시점 | 설명 |
|:-----|:-----|:-----|
| `MethodBeforeAdvice` | 메서드 실행 **전** | 사전 검증, 로깅 등 |
| `AfterReturningAdvice` | 메서드 실행 **후** | 결과 로깅, 후처리 등 |
| `ThrowsAdvice` | 예외 발생 시 | 예외 로깅, 알림 등 |
| `MethodInterceptor` | 전/후 + 예외 **모두** | 가장 범용적 |

### MethodBeforeAdvice

```java
public class LoggingAdvice
        implements MethodBeforeAdvice {

    @Override
    public void before(
            Method method,    // 실행된 메서드
            Object[] args,    // 메서드 인자
            Object target     // 대상 객체
    ) throws Throwable {
        System.out.println(
            "[LOG] " + method.getName() + " 호출"
        );
    }
}
```

### AfterReturningAdvice

```java
public class AfterLogAdvice
        implements AfterReturningAdvice {

    @Override
    public void afterReturning(
            Object returnValue, // 반환값
            Method method,      // 실행된 메서드
            Object[] args,      // 메서드 인자
            Object target       // 대상 객체
    ) throws Throwable {
        System.out.println(
            "[LOG] " + method.getName() + " 완료"
        );
    }
}
```

### ThrowsAdvice

```java
public class ExceptionAdvice
        implements ThrowsAdvice {

    public void afterThrowing(
            Method method,     // 실행된 메서드
            Object[] args,     // 메서드 인자
            Object target,     // 대상 객체
            Exception ex       // 발생한 예외
    ) {
        System.out.println(
            "[예외] " + ex.getMessage()
        );
    }
}
```

### MethodInterceptor

`invoke()` 메서드 하나로 **before, after, throws** 기능을 모두 수행할 수 있다.

```java
public class AroundAdvice
        implements MethodInterceptor {

    @Override
    public Object invoke(
            MethodInvocation invocation)
            throws Throwable {

        // ── before ──
        System.out.println("[전처리] 시작");

        Object result;
        try {
            // 주기능 실행
            result = invocation.proceed();
        } catch (Exception e) {
            // ── throws ──
            System.out.println("[예외] " + e);
            throw e;
        }

        // ── after ──
        System.out.println("[후처리] 완료");
        return result;
    }
}
```

```
  MethodInterceptor 흐름

  invoke() 호출
       │
       ▼
  [전처리 로직]
       │
       ▼
  proceed()→ 주기능 실행
       │
       ├─ 정상 → [후처리 로직]
       │              │
       │              ▼
       │          결과 반환
       │
       └─ 예외 → [예외 처리]
                     │
                     ▼
                 예외 전파
```

{{< callout type="info" >}}
`MethodInterceptor`는 나머지 세 인터페이스의 기능을 모두 포함한다. 여러 시점에 로직이 필요할 때는 `MethodInterceptor`를 사용하면 하나의 클래스로 처리할 수 있다.
{{< /callout >}}

---

## 5. XML 설정을 이용한 AOP 적용

### Target 클래스 작성

```java
// 인터페이스
public interface Calculator {
    int add(int a, int b);
    int sub(int a, int b);
}

// 구현체 (Target)
public class CalculatorImpl
        implements Calculator {

    @Override
    public int add(int a, int b) {
        return a + b;
    }

    @Override
    public int sub(int a, int b) {
        return a - b;
    }
}
```

### XML 설정

```xml
<beans ...>
    <!-- 1. Target 빈 -->
    <bean id="calcTarget"
        class="com.aop.CalculatorImpl" />

    <!-- 2. Advice 빈 -->
    <bean id="loggingAdvice"
        class="com.aop.LoggingAdvice" />

    <!-- 3. Pointcut 설정 (정규식) -->
    <bean id="calcPointcut"
      class="org.springframework.aop.support
             .JdkRegexpMethodPointcut">
        <property name="pattern"
            value=".*add.*" />
    </bean>

    <!-- 4. Advisor = Advice + Pointcut -->
    <bean id="calcAdvisor"
      class="org.springframework.aop.support
             .DefaultPointcutAdvisor">
        <property name="pointcut"
            ref="calcPointcut" />
        <property name="advice"
            ref="loggingAdvice" />
    </bean>

    <!-- 5. ProxyFactoryBean -->
    <bean id="calculator"
      class="org.springframework.aop.framework
             .ProxyFactoryBean">
        <property name="target"
            ref="calcTarget" />
        <property name="interceptorNames">
            <list>
                <value>calcAdvisor</value>
            </list>
        </property>
    </bean>
</beans>
```

### 실행

```java
ApplicationContext ctx =
    new ClassPathXmlApplicationContext(
        "aop.xml"
    );

Calculator calc =
    (Calculator) ctx.getBean("calculator");

// add → Pointcut 매칭 → Advice 실행
calc.add(10, 20);
// [LOG] add 호출
// 30

// sub → Pointcut 미매칭 → Advice 미실행
calc.sub(20, 5);
// 15
```

```
  AOP 프록시 동작 흐름

  클라이언트
      │
      │ getBean("calculator")
      ▼
  ┌────────────────┐
  │ Proxy 객체     │
  │                │
  │ Pointcut 확인  │
  │ 패턴 매칭?     │
  │  │      │     │
  │ Yes     No    │
  │  │      └→Target
  │  ▼            │
  │ Advice 실행   │
  │  │            │
  │  ▼            │
  │ Target 실행   │
  └────────────────┘
```

{{< callout type="warning" >}}
Pointcut의 `pattern`은 **정규식**이다. `.*add.*`는 메서드 이름에 "add"가 포함된 모든 메서드에 Advice를 적용한다. 패턴을 너무 넓게 잡으면 의도하지 않은 메서드에도 적용되므로 주의하자.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| AOP | 주기능과 보조 기능을 분리하여 선택적으로 적용 |
| Aspect | 구현하고자 하는 보조 기능 |
| Advice | Aspect의 실제 구현 클래스 |
| JoinPoint | Advice를 적용할 수 있는 지점 |
| Pointcut | Advice 적용 대상을 정규식으로 지정 |
| Weaving | Advice를 Target에 적용하는 과정 |
| `MethodInterceptor` | before/after/throws 모두 처리 |
| `ProxyFactoryBean` | Target에 Advice를 적용하는 프록시 생성기 |

### Advice 인터페이스 선택 가이드

| 상황 | 권장 인터페이스 |
|:-----|:-----|
| 메서드 실행 전 로직만 필요 | `MethodBeforeAdvice` |
| 메서드 실행 후 로직만 필요 | `AfterReturningAdvice` |
| 예외 처리만 필요 | `ThrowsAdvice` |
| 전/후/예외 모두 처리 | `MethodInterceptor` |
