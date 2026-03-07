---
title: "14. 스프링 의존성 주입과 제어 역전"
weight: 15
---

의존성 주입(DI)과 제어 역전(IoC)의 동작 원리를 이해하고, XML 설정을 통해 빈을 생성·주입하는 방법을 다룬다.

---

## 1. 의존성 주입이란

객체 지향 프로그래밍에서 클래스는 특정 기능을 수행하는 **부품** 역할을 한다. 요구사항이 바뀌면 부품(클래스)을 교체해야 하는데, 클래스 간 관계를 코드에서 직접 맺으면 교체가 어렵다.

**의존성 주입(Dependency Injection)** 은 클래스 간의 연관 관계를 코드가 아닌 **외부 설정**으로 정의하는 방식이다. 코드에서 직접적인 의존이 사라지므로 각 클래스의 변경이 자유로워진다(Loosely Coupled).

```
  직접 생성 (강한 결합)

  ┌──────────┐
  │ Service  │
  │          │
  │ new DAO()│ ← 코드에 박힘
  └──────────┘

  DI (느슨한 결합)

  ┌──────────┐  주입
  │ Service  │◄──── 스프링
  │          │
  │ dao 필드  │
  └──────────┘
```

### DI의 장점

| 장점 | 설명 |
|:-----|:-----|
| 코드 단순화 | 클래스 간 의존 관계를 최소화 |
| 유지보수 용이 | 구현체 교체 시 설정만 변경 |
| 테스트 편의 | Mock 객체를 쉽게 주입 가능 |
| 제어 위임 | 객체 생성·소멸을 컨테이너가 관리 |

---

## 2. 제어 역전(IoC)

기존에는 **개발자가 직접** 객체를 생성하고 관계를 설정했다. 스프링에서는 이 제어권이 **프레임워크로 역전**된다. 이것이 IoC(Inversion of Control)다.

```java
// 기존: 개발자가 제어
MemberDAO dao = new MemberDAO();
MemberService svc = new MemberService();
svc.setDao(dao);

// IoC: 스프링이 제어
// XML 설정만 작성하면 스프링이 알아서 생성·주입
```

```
  기존 방식         IoC 방식

  개발자            스프링 컨테이너
     │                  │
     ▼                  ▼
  new 객체()       설정 파일 읽기
     │                  │
     ▼                  ▼
  관계 설정         빈 자동 생성
     │                  │
     ▼                  ▼
  사용              의존성 주입
                        │
                        ▼
                     사용
```

{{< callout type="info" >}}
DI와 IoC는 동전의 양면이다. IoC는 **제어권이 프레임워크로 넘어간다**는 개념이고, DI는 그 IoC를 **구체적으로 구현하는 방법**(의존 객체를 외부에서 주입)이다.
{{< /callout >}}

---

## 3. 빈(Bean)과 XML 설정

스프링에서 관리하는 객체를 **빈(Bean)** 이라 한다. XML 설정 파일에서 `<bean>` 태그로 빈을 정의하고, 스프링 컨테이너가 이를 읽어 객체를 생성한다.

### `<bean>` 태그 주요 속성

| 속성 | 설명 |
|:-----|:-----|
| id | 빈의 고유 이름, 이 id로 빈에 접근 |
| name | 빈의 별칭 |
| class | 생성할 클래스 (패키지 포함 전체 경로) |
| constructor-arg | 생성자를 통한 값 주입 |
| property | setter를 통한 값 주입 |

### setter 주입 예제

```java
public class PersonServiceImpl implements PersonService {
    private String name;

    public void setName(String name) {
        this.name = name;
    }

    public void sayHello() {
        System.out.println("이름: " + name);
    }
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE beans PUBLIC
  "-//SPRING//DTD BEAN//EN"
  "http://www.springframework.org/dtd/spring-beans-2.0.dtd">
<beans>
    <bean id="personService"
        class="com.spring.ex01.PersonServiceImpl">
        <property name="name">
            <value>홍길동</value>
        </property>
    </bean>
</beans>
```

```java
// 실행 클래스
XmlBeanFactory factory =
    new XmlBeanFactory(
        new FileSystemResource("person.xml")
    );

// id로 빈을 가져와 사용
PersonService person =
    (PersonService) factory.getBean("personService");
person.sayHello(); // 이름: 홍길동
```

```
  XML 설정 기반 빈 생성 흐름

  person.xml
      │ 읽기
      ▼
  ┌──────────────────┐
  │ XmlBeanFactory   │
  │ (스프링 컨테이너)  │
  └────────┬─────────┘
           │ 빈 생성
           ▼
  ┌──────────────────┐
  │ PersonServiceImpl│
  │ name = "홍길동"   │
  └──────────────────┘
```

---

## 4. 생성자 주입

setter가 아닌 **생성자**를 통해 값을 주입할 수도 있다. `<constructor-arg>` 태그를 사용한다.

```java
public class PersonServiceImpl implements PersonService {
    private String name;
    private int age;

    // 인자 1개 생성자
    public PersonServiceImpl(String name) {
        this.name = name;
    }

    // 인자 2개 생성자
    public PersonServiceImpl(String name, int age) {
        this.name = name;
        this.age = age;
    }
}
```

```xml
<beans>
    <!-- 인자 1개 생성자 -->
    <bean id="personService1"
        class="com.spring.ex01.PersonServiceImpl">
        <constructor-arg value="이순신" />
    </bean>

    <!-- 인자 2개 생성자 -->
    <bean id="personService2"
        class="com.spring.ex01.PersonServiceImpl">
        <constructor-arg value="손흥민" />
        <constructor-arg value="23" />
    </bean>
</beans>
```

### setter 주입 vs 생성자 주입

| 구분 | setter 주입 | 생성자 주입 |
|:-----|:-----|:-----|
| 태그 | `<property>` | `<constructor-arg>` |
| 시점 | 객체 생성 후 | 객체 생성 시 |
| 필수 여부 | 선택적 | 필수 의존성 강제 |
| 불변 보장 | 불가 (`final` 사용 불가) | 가능 (`final` 사용 가능) |

{{< callout type="info" >}}
스프링 공식 문서에서도 **생성자 주입을 권장**한다. `final` 키워드로 불변성을 보장하고, 의존성 누락 시 컴파일 시점에 오류를 잡을 수 있기 때문이다.
{{< /callout >}}

---

## 5. 참조형 빈 주입 (ref)

주입할 값이 기본형(String, int 등)이 아니라 **다른 빈 객체**인 경우, `value` 대신 `ref` 속성을 사용한다.

```java
public class MemberService {
    private MemberDAO dao;

    // setter 주입
    public void setDao(MemberDAO dao) {
        this.dao = dao;
    }
}
```

```xml
<beans>
    <!-- DAO 빈 생성 -->
    <bean id="memberDAO"
        class="com.spring.ex02.MemberDAO" />

    <!-- Service 빈에 DAO 빈 주입 -->
    <bean id="memberService"
        class="com.spring.ex02.MemberService">
        <property name="dao" ref="memberDAO" />
    </bean>
</beans>
```

### value vs ref 비교

| 속성 | 용도 | 예시 |
|:-----|:-----|:-----|
| value | 기본형 데이터 주입 | `<constructor-arg value="홍길동" />` |
| ref | 다른 빈 객체 주입 | `<property name="dao" ref="memberDAO" />` |

```
  ref를 이용한 빈 주입

  ┌──────────────────┐
  │ 스프링 컨테이너    │
  │                  │
  │ ① memberDAO 생성  │
  │        │         │
  │        │ ref     │
  │        ▼         │
  │ ② memberService  │
  │    dao ← 주입     │
  └──────────────────┘
```

{{< callout type="warning" >}}
`ref`로 참조하는 빈의 **id가 존재하지 않으면** 스프링 컨테이너 초기화 시점에 `NoSuchBeanDefinitionException`이 발생한다. 빈 id의 오타에 주의하자.
{{< /callout >}}

---

## 6. DI 동작 흐름 정리

전체적인 DI 동작 흐름을 단계별로 정리하면 다음과 같다.

```
  DI 동작 흐름

  ① XML 설정 작성
        │
        ▼
  ② 컨테이너 초기화
  (XmlBeanFactory 등)
        │
        ▼
  ③ 빈 객체 생성
  (class 속성 기반)
        │
        ▼
  ④ 의존성 주입
  (property /
   constructor-arg)
        │
        ▼
  ⑤ getBean()으로
     빈 사용
```

### 실무 활용 패턴

```java
// 1. 인터페이스 정의
public interface MemberDAO {
    List<MemberVO> listMembers();
}

// 2. 구현체 작성
public class MemberDAOImpl implements MemberDAO {
    @Override
    public List<MemberVO> listMembers() {
        // DB 조회 로직
    }
}

// 3. Service는 인터페이스에 의존
public class MemberService {
    private MemberDAO dao;

    public void setDao(MemberDAO dao) {
        this.dao = dao;
    }
}
```

```xml
<!-- 구현체를 교체하려면 class만 변경 -->
<bean id="memberDAO"
    class="com.spring.ex02.MemberDAOImpl" />

<bean id="memberService"
    class="com.spring.ex02.MemberService">
    <property name="dao" ref="memberDAO" />
</bean>
```

{{< callout type="info" >}}
인터페이스 기반 설계와 DI를 함께 사용하면, 구현체를 바꿀 때 **XML 설정의 class 값만 변경**하면 된다. Service 코드는 전혀 수정할 필요가 없다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| DI | 객체 간 의존 관계를 외부 설정으로 주입 |
| IoC | 객체 생성·관리 제어권을 프레임워크에 위임 |
| 빈(Bean) | 스프링 컨테이너가 관리하는 객체 |
| `<property>` | setter를 통한 주입 |
| `<constructor-arg>` | 생성자를 통한 주입 |
| value | 기본형 데이터 주입 |
| ref | 다른 빈 객체 참조 주입 |

### 주입 방식 선택 가이드

| 상황 | 권장 방식 |
|:-----|:-----|
| 필수 의존성 | 생성자 주입 |
| 선택적 의존성 | setter 주입 |
| 불변 객체 | 생성자 주입 + `final` |
| 다른 빈 주입 | `ref` 속성 사용 |