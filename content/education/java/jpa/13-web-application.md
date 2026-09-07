---
title: "Chapter 13. 웹 애플리케이션 제작"
date: 2026-04-02
weight: 13
---

[Chapter 02](../02-jpa-start)에서는 엔티티 매니저 팩토리를 만들고, 엔티티 매니저를 얻고, 트랜잭션을 시작하고 커밋하는 코드를 전부 직접 썼다. [Chapter 03](../03-persistence-context)에서는 "스프링에서는 트랜잭션이 영속성 컨텍스트의 범위"라고만 하고 넘어갔다. 이 장은 그 사이를 메운다. 스프링이 JPA를 위해 대신 해 주는 일이 정확히 무엇인지, 원서가 XML로 하나씩 등록한 설정이 각각 왜 필요한지, 그리고 스프링 부트가 그 설정을 어떻게 자동화하는지를 본다. 부트의 `application.yml` 몇 줄이 무엇을 대신하고 있는지 알면, 그 몇 줄이 왜 그렇게 생겼는지도 보인다.

---

## 1. 스프링과 JPA를 함께 쓴다는 것

2장의 코드를 다시 보자.

```java
EntityManagerFactory emf = Persistence.createEntityManagerFactory("jpabook");
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();
try {
    tx.begin();
    logic(em);
    tx.commit();
} catch (Exception e) {
    tx.rollback();
} finally {
    em.close();
}
```

업무 로직은 `logic(em)` 한 줄이고 나머지는 전부 준비와 뒷정리다. 이 뼈대는 서비스 메서드마다 반복된다. 스프링에서 같은 코드는 이렇게 된다.

```java
@Service
public class MemberService {

    @PersistenceContext
    private EntityManager em;      // 스프링이 넣어 준다

    @Transactional                 // 시작·커밋·롤백·close를 스프링이 한다
    public Long join(Member member) {
        em.persist(member);
        return member.getId();
    }
}
```

사라진 코드가 곧 스프링이 대신 하는 일이다.

```
스프링 컨테이너가 대신 하는 것
 ├ 커넥션 풀 관리 (DataSource)
 ├ 트랜잭션 시작·커밋 (@Transactional)
 ├ 예외 변환 (DataAccessException)
 └ 엔티티 매니저 주입 (프록시)
        │
        ▼
 JPA는 매핑과 SQL 생성에만 집중한다
```

JPA 명세는 원래 두 가지 실행 환경을 상정한다. 개발자가 엔티티 매니저를 직접 관리하는 **애플리케이션 관리** 방식(2장)과, Java EE 컨테이너가 트랜잭션에 맞춰 엔티티 매니저를 만들고 닫아 주는 **컨테이너 관리** 방식이다. 스프링은 Java EE 서버가 아니면서도 후자를 흉내 낸다. 톰캣 같은 서블릿 컨테이너 위에서 스프링 컨테이너가 JPA 컨테이너 노릇을 하는 것이다. 이 장의 설정은 전부 "스프링이 JPA 컨테이너가 되기 위해 필요한 부품"으로 읽으면 된다.

---

## 2. 계층과 트랜잭션 경계

```
 src/main/java/jpabook/jpashop
 ├── domain      엔티티
 ├── repository  EntityManager 사용
 ├── service     @Transactional 경계
 └── web         컨트롤러, DTO
```

```
컨트롤러 ─▶ 서비스 ─▶ 리포지토리 ─▶ DB
            ├── @Transactional ─┤
            트랜잭션 = 작업 단위
            = 영속성 컨텍스트의 범위
```

트랜잭션 경계를 **서비스**에 두는 이유는 3장의 원리에서 곧장 나온다. 스프링에서 영속성 컨텍스트는 트랜잭션과 함께 생기고 사라진다. 그러니 "회원 가입"이라는 작업 단위 안에서 조회한 엔티티가 영속 상태로 유지되고 지연 로딩이 동작하려면, 그 작업 단위 전체가 하나의 트랜잭션이어야 한다. 서비스 메서드 하나가 곧 사용자의 요청 하나이자 작업 단위 하나다. 리포지토리에 트랜잭션을 두면 리포지토리 메서드마다 컨텍스트가 만들어졌다 사라져 서비스로 돌아온 엔티티가 전부 준영속이 된다.

같은 이유로 컨트롤러는 엔티티가 아니라 **DTO**를 주고받는다. 서비스를 벗어난 엔티티는 준영속이라 지연 로딩이 예외를 내고([Chapter 06](../06-flush-and-detached)), 양방향 연관관계를 그대로 직렬화하면 순환 참조에 빠진다([Chapter 08](../08-various-relationships)). 엔티티는 트랜잭션 안에서만 다루고, 밖으로는 필요한 값만 담은 DTO를 내보낸다.

리포지토리는 엔티티 매니저를 직접 쓴다.

```java
@Repository
public class MemberRepository {

    @PersistenceContext
    private EntityManager em;

    public void save(Member member) { em.persist(member); }

    public Member findOne(Long id) { return em.find(Member.class, id); }

    public List<Member> findByName(String name) {
        return em.createQuery("select m from Member m where m.name = :name", Member.class)
                 .setParameter("name", name)
                 .getResultList();
    }
}
```

이 반복적인 코드를 인터페이스 선언만으로 대신 만들어 주는 것이 스프링 데이터 JPA이고, 이 시리즈의 다음 단계다. 그 편리함이 어디서 오는지는 이 장까지 읽었다면 이미 알고 있다. 밑에는 똑같은 엔티티 매니저가 있다.

---

## 3. 설정이 하는 일

원서는 이 부품들을 XML로 하나씩 등록한다. 부트를 쓰더라도 각 부품이 왜 있는지는 알아야 하므로 순서대로 본다.

```
DataSource
   │  커넥션 풀
   ▼
EntityManagerFactory
   │  LocalContainer-
   │  EntityManagerFactoryBean
   ├──────────▶ EntityManager 프록시
   │            (@PersistenceContext)
   ▼
JpaTransactionManager
      @Transactional
```

### 3.1 데이터소스: 커넥션은 풀에서 빌린다

```xml
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="jdbcUrl" value="jdbc:h2:mem:test"/>
    <property name="username" value="sa"/>
    <property name="maximumPoolSize" value="10"/>
</bean>
```

DB 커넥션을 맺는 비용은 크다. 그래서 미리 몇 개를 맺어 두고 빌려 쓰는 **커넥션 풀**을 두고, JPA는 커넥션이 필요할 때 풀에서 얻어 트랜잭션이 끝나면 돌려준다. 3장에서 "커넥션은 트랜잭션 시작 때 빌리고 끝날 때 반환한다"고 한 그 풀이 이것이다. 2장의 `persistence.xml`에 적었던 JDBC 접속 정보는 이제 데이터소스 빈으로 옮겨 가고, JPA는 접속 정보 대신 데이터소스를 받는다.

### 3.2 엔티티 매니저 팩토리: persistence.xml 없이

```xml
<bean id="entityManagerFactory"
      class="org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean">
    <property name="dataSource" ref="dataSource"/>
    <property name="packagesToScan" value="jpabook.jpashop.domain"/>
    <property name="jpaVendorAdapter">
        <bean class="org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter"/>
    </property>
    <property name="jpaProperties">
        <props>
            <prop key="hibernate.show_sql">true</prop>
            <prop key="hibernate.hbm2ddl.auto">create</prop>
        </props>
    </property>
</bean>
```

2장에서는 `Persistence.createEntityManagerFactory("jpabook")`가 `persistence.xml`을 읽어 팩토리를 만들었다. 스프링에서는 `LocalContainerEntityManagerFactoryBean`이 그 역할을 한다. 이름에 "Container"가 붙은 이유가 1절의 컨테이너 관리 방식이다. 이 빈은 `persistence.xml`이 없어도 동작한다. 접속 정보는 `dataSource`로 받고, 엔티티는 `packagesToScan` 아래에서 `@Entity`를 찾아 모으고, 구현체는 `jpaVendorAdapter`로 정하고, Hibernate 속성은 `jpaProperties`로 넘긴다. `persistence.xml`에 있던 모든 항목이 스프링 설정으로 옮겨 온 셈이다.

{{< callout type="info" >}}
스프링에는 `LocalEntityManagerFactoryBean`도 있다. 이쪽은 `persistence.xml`을 그대로 읽는 단순한 방식이라 데이터소스를 주입할 수도, 패키지를 스캔할 수도 없다. 실무와 부트는 예외 없이 `LocalContainerEntityManagerFactoryBean`을 쓴다.
{{< /callout >}}

### 3.3 트랜잭션 관리자: 왜 JPA 전용이어야 하는가

```xml
<tx:annotation-driven/>

<bean id="transactionManager" class="org.springframework.orm.jpa.JpaTransactionManager">
    <property name="entityManagerFactory" ref="entityManagerFactory"/>
</bean>
```

`<tx:annotation-driven/>`은 `@Transactional`을 해석하게 하고, 트랜잭션 관리자는 실제로 트랜잭션을 시작하고 끝낸다. JDBC나 MyBatis만 쓸 때는 `DataSourceTransactionManager`로 충분하지만 JPA에는 **`JpaTransactionManager`**가 필요하다. 이유는 JPA의 커밋이 단순히 JDBC 커밋이 아니기 때문이다. 커밋 직전에 영속성 컨텍스트를 **플러시**해야 하고([Chapter 06](../06-flush-and-detached)), 트랜잭션이 끝나면 컨텍스트를 **닫아야** 한다. 데이터소스 트랜잭션 관리자는 엔티티 매니저의 존재를 모르므로 커밋을 해도 플러시가 일어나지 않는다. `JpaTransactionManager`는 엔티티 매니저 팩토리를 알고 있어 트랜잭션마다 엔티티 매니저를 만들고, 커밋 전에 플러시하고, 끝나면 닫는다. 3장의 트랜잭션 범위 영속성 컨텍스트를 실제로 구현하는 부품이 이것이다.

이 관리자는 자기가 쓰는 JDBC 커넥션을 스프링에 노출한다. 그래서 같은 트랜잭션 안에서 `JdbcTemplate`이나 MyBatis가 JPA와 **같은 커넥션**을 공유할 수 있다. 단, 12장에서 본 것처럼 JPA 밖에서 SQL을 실행하기 전에는 플러시해야 컨텍스트의 변경이 보인다.

{{< callout type="warning" >}}
`@Transactional`은 스프링이 만든 **프록시**가 메서드 호출을 가로채서 동작한다. 그래서 같은 클래스 안에서 `this.join(member)`처럼 직접 부르면 프록시를 거치지 않아 트랜잭션이 시작되지 않는다. "분명히 붙였는데 트랜잭션이 없다"는 문제의 단골 원인이다. 트랜잭션이 필요한 메서드는 다른 빈에서 호출되어야 한다.
{{< /callout >}}

### 3.4 예외 변환: 서비스가 JPA 예외를 몰라도 되게

```xml
<bean class="org.springframework.dao.annotation.PersistenceExceptionTranslationPostProcessor"/>
```

```
Hibernate 예외
  (ConstraintViolationException)
        │  변환 (AOP)
        ▼
스프링 예외
  (DataIntegrityViolationException)
```

JPA와 Hibernate가 던지는 예외는 구현체마다 다르다. 서비스 계층이 그 예외를 직접 잡으면 서비스가 Hibernate에 묶인다. 이 빈은 `@Repository`가 붙은 빈을 프록시로 감싸, 거기서 나오는 JPA 예외를 스프링의 `DataAccessException` 계층으로 바꾼다. 유니크 제약 위반은 `DataIntegrityViolationException`, 낙관적 락 실패는 `OptimisticLockingFailureException`처럼 **의미 있는 이름**으로 통일되므로, 서비스는 어떤 기술이 아래에 있든 같은 예외를 다룰 수 있다.

한 가지 더 알아 둘 것이 있다. JPA에서는 SQL이 커밋 시점에 나가므로 예외도 리포지토리 메서드가 아니라 **커밋 시점**에 터지는 경우가 많다. 이때는 리포지토리 프록시가 아니라 `JpaTransactionManager`가 예외를 변환한다. 어느 쪽이든 서비스 밖으로 나오는 것은 스프링 예외다.

### 3.5 엔티티 매니저 주입: 프록시 하나를 모두가 공유한다

```java
@PersistenceContext
private EntityManager em;
```

원래 JPA 명세에서 `@PersistenceContext`는 컨테이너가 관리하는 엔티티 매니저를 주입받는 어노테이션이고, 스프링이 그 역할을 이어받았다. 주입되는 것은 진짜 엔티티 매니저가 아니라 **공유 프록시**다. 3장에서 봤듯 이 프록시는 호출이 들어올 때마다 현재 트랜잭션에 묶인 진짜 엔티티 매니저를 찾아 위임한다. 엔티티 매니저는 스레드 안전하지 않은데 싱글톤 빈의 필드 하나로 모든 요청이 공유해도 안전한 이유가 이것이다. 부트에서는 `@Autowired`로 주입해도 같은 프록시가 들어온다.

---

## 4. 스프링 부트는 이것을 어떻게 자동화하는가

부트에서는 위의 XML이 전부 사라진다. 사라진 것이 아니라 **자동 설정 클래스가 같은 빈을 대신 등록**한다. 조건은 단순하다. 클래스패스에 JPA와 Hibernate가 있고, 개발자가 같은 타입의 빈을 직접 만들지 않았으면 부트가 만든다.

| 원서의 XML 빈 | 부트의 자동 설정 | 개발자가 적는 것 |
|:--------------|:-----------------|:-----------------|
| 데이터소스 | `DataSourceAutoConfiguration`. HikariCP가 기본 | `spring.datasource.*` |
| `LocalContainerEntityManagerFactoryBean` | `HibernateJpaAutoConfiguration` | `spring.jpa.*`. 엔티티 스캔은 `@SpringBootApplication` 패키지 아래 |
| `JpaTransactionManager`, `<tx:annotation-driven/>` | 같은 자동 설정 | 없음. `@Transactional`만 붙인다 |
| `PersistenceExceptionTranslationPostProcessor` | `PersistenceExceptionTranslationAutoConfiguration` | 없음 |
| `web.xml`, 뷰 리졸버, 컴포넌트 스캔 | 내장 톰캣, `WebMvcAutoConfiguration`, `@SpringBootApplication` | `spring.mvc.*` |
| Hibernate 속성 | `jpaProperties`로 전달 | `spring.jpa.properties.hibernate.*` |

의존성도 하나로 줄어든다. `spring-boot-starter-data-jpa`가 Hibernate, JPA API, 스프링 ORM, 스프링 데이터 JPA, HikariCP를 함께 가져온다. 개발자가 따로 넣는 것은 JDBC 드라이버뿐이다.

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:test
    username: sa
  jpa:
    hibernate:
      ddl-auto: create-drop        # 운영은 validate 또는 none (7장)
    properties:
      hibernate:
        format_sql: true
        default_batch_fetch_size: 100   # 12장의 배치 사이즈
    open-in-view: false            # 3장의 OSIV
logging:
  level:
    org.hibernate.SQL: debug
    org.hibernate.orm.jdbc.bind: trace
```

이 파일의 각 줄이 앞 장 어딘가의 결정이다. 부트의 기본값도 그 결정들과 이어진다. 내장 DB를 쓰면 `ddl-auto`가 `create-drop`이고 외부 DB면 `none`인 것([Chapter 07](../07-entity-mapping)), 방언을 자동 감지하는 것([Chapter 02](../02-jpa-start)), 컬럼 이름을 snake_case로 바꾸는 것(7장), 그리고 OSIV가 켜져 있는 것(3장)이 그렇다.

{{< callout type="warning" >}}
`spring.jpa.open-in-view`의 기본값은 `true`다. 부트는 시작할 때 이 사실을 경고 로그로 알려 준다. 영속성 컨텍스트가 응답이 나갈 때까지 살아 있어 컨트롤러에서도 지연 로딩이 되지만, 그만큼 커넥션을 오래 붙든다. 3장에서 링크한 트러블슈팅 글이 그 결과다. API 서버라면 `false`로 두고 필요한 데이터를 서비스 안에서 로딩하는 편이 안전하다.
{{< /callout >}}

---

## 5. Hibernate 속성과 SQL 로그

| 속성 | 뜻 | 비고 |
|:-----|:---|:-----|
| `hibernate.dialect` | DB 방언 | Hibernate 6부터는 자동 감지. 보통 생략 |
| `hibernate.hbm2ddl.auto` | DDL 자동 생성 | 부트에서는 `spring.jpa.hibernate.ddl-auto` |
| `hibernate.show_sql` | SQL을 표준 출력으로 | 로거를 쓰면 끈다 |
| `hibernate.format_sql` | SQL 줄바꿈 | 로거와 함께 |
| `hibernate.use_sql_comments` | SQL 앞에 JPQL 주석 | 어느 JPQL이 이 SQL이 됐는지 추적 |
| `hibernate.default_batch_fetch_size` | 지연 로딩 IN 절 크기 | 12장 |
| `hibernate.jdbc.batch_size` | INSERT·UPDATE 배치 크기 | 5장 |

원서에 나오는 `hibernate.id.new_generator_mappings`는 Hibernate 5에서 옛 키 생성 방식과 새 방식을 고르는 스위치였다. Hibernate 6에서는 옛 방식 자체가 제거되어 설정도 사라졌다. 부트 3의 `spring.jpa.hibernate.use-new-id-generator-mappings` 속성도 함께 없어졌으므로, 이 설정을 보면 Hibernate 5 시절 자료라고 보면 된다.

SQL은 `show_sql` 대신 로거로 본다. 표준 출력은 로그 파일에도 남지 않고 레벨도 조절할 수 없기 때문이다.

```yaml
logging:
  level:
    org.hibernate.SQL: debug              # 실행되는 SQL
    org.hibernate.orm.jdbc.bind: trace    # 바인딩된 파라미터 값 (Hibernate 6)
```

Hibernate 5까지는 파라미터 로거가 `org.hibernate.type.descriptor.sql`이었다. 6에서 `org.hibernate.orm.jdbc.bind`로 바뀌었고, 바인딩 값만 깔끔하게 찍힌다. `show_sql`을 켠 채 로거까지 켜면 같은 SQL이 두 번 출력되니 하나만 쓴다.

{{< callout type="info" >}}
SQL 로그를 켜 두는 습관은 이 시리즈 전체의 결론이기도 하다. 1장에서 "JPA를 쓴다고 SQL을 몰라도 되는 것은 아니다"라고 했다. 내 코드가 어떤 SQL이 됐는지 매번 확인하는 것이, 이 시리즈에서 본 N+1과 쓰기 지연과 준영속의 모든 문제를 가장 빨리 찾는 방법이다.
{{< /callout >}}

---

## 요약

| 부품 | 하는 일 | 왜 필요한가 |
|:-----|:--------|:------------|
| 스프링 컨테이너 | JPA 컨테이너 역할 | Java EE 서버 없이 컨테이너 관리 방식을 쓴다 |
| 서비스의 `@Transactional` | 작업 단위 = 트랜잭션 = 영속성 컨텍스트 | 엔티티가 영속 상태로 유지되는 범위 |
| DTO | 컨트롤러와 주고받는 값 | 서비스 밖의 엔티티는 준영속이다 |
| 데이터소스 | 커넥션 풀 | 커넥션은 비싸다. 빌려 쓰고 돌려준다 |
| `LocalContainerEntityManagerFactoryBean` | `persistence.xml` 없이 팩토리 생성 | 접속 정보와 엔티티 스캔을 스프링이 맡는다 |
| `JpaTransactionManager` | 커밋 전 플러시, 종료 시 컨텍스트 닫기 | JDBC 커밋만으로는 JPA가 동작하지 않는다 |
| 예외 변환 | Hibernate 예외 → 스프링 예외 | 서비스가 구현체에 묶이지 않는다 |
| `@PersistenceContext` | 공유 프록시 주입 | 싱글톤 빈에서 스레드 안전하게 쓴다 |
| 스프링 부트 | 위 빈들을 자동 등록 | `application.yml`의 각 줄이 앞 장의 결정이다 |

```
스프링 + JPA 한 장 정리

 요청 ─▶ 컨트롤러 (DTO)
          │
          ▼ @Transactional 시작
        서비스 ─▶ 리포지토리 ─▶ EM
          │      (EM은 3장의 프록시)
          ▼ 커밋: 플러시 → 컨텍스트 종료
        응답 (DTO)
```
