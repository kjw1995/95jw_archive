---
title: "Chapter 02. JPA 시작"
date: 2025-12-17
weight: 2
---

[Chapter 01. JPA 소개](../01-jpa-intro)에서 JPA가 왜 필요한지를 봤다면, 이 장에서는 실제로 돌려 본다. 라이브러리를 넣고, 클래스를 테이블에 매핑하고, 설정 파일을 쓰고, 엔티티 매니저로 CRUD를 실행하기까지의 최소 코스다. 각 단계에서 "이 부품은 왜 이렇게 생겼는가"를 같이 짚는다. 여기서 만든 감각이 다음 장부터 나오는 영속성 컨텍스트를 이해하는 발판이 된다.

---

## 1. 준비: 구현체와 드라이버

JPA는 인터페이스 묶음이라 그 자체로는 아무것도 실행하지 못한다. 실제로 SQL을 만드는 **구현체**와 DB에 접속하는 **JDBC 드라이버**가 있어야 한다. 학습용으로는 구현체에 Hibernate, DB에 H2를 쓰는 조합이 가장 간단하다. H2는 별도 설치 없이 jar 하나로 실행되고, 메모리 모드로 띄우면 테스트가 끝날 때 깨끗이 사라진다.

```xml
<dependencies>
    <!-- JPA 구현체. jakarta.persistence-api를 함께 가져온다 -->
    <dependency>
        <groupId>org.hibernate.orm</groupId>
        <artifactId>hibernate-core</artifactId>
        <version>6.6.4.Final</version>
    </dependency>

    <!-- JDBC 드라이버 -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <version>2.3.232</version>
    </dependency>
</dependencies>
```

`hibernate-core`를 넣으면 JPA 표준 API인 `jakarta.persistence-api`가 따라 들어온다. 애플리케이션 코드는 `jakarta.persistence` 패키지만 import하고 Hibernate 클래스는 직접 건드리지 않는 것이 원칙이다. 그래야 1장에서 말한 "표준 위에서 코딩한다"는 이점이 살아 있다.

{{< callout type="info" >}}
스프링 부트에서는 `spring-boot-starter-data-jpa` 하나가 Hibernate와 JPA API를 가져오고, 드라이버만 따로 추가한다. 이 장은 스프링 없이 순수 JPA로 진행한다. 스프링이 대신 해 주는 부분이 무엇인지 알아야 스프링 설정이 왜 그렇게 생겼는지 이해할 수 있기 때문이다. 스프링과의 통합은 [Chapter 13. 웹 애플리케이션 제작](../13-web-application)에서 다룬다.
{{< /callout >}}

---

## 2. 객체 매핑: 클래스와 테이블을 잇는다

회원 테이블이 있고, 이 테이블을 다룰 클래스가 있다.

```sql
CREATE TABLE MEMBER (
    ID   BIGINT      NOT NULL,
    NAME VARCHAR(255),
    AGE  INTEGER,
    PRIMARY KEY (ID)
);
```

```java
public class Member {
    private Long id;
    private String username;
    private Integer age;
    // getter, setter
}
```

JPA는 이 둘이 서로 대응한다는 사실을 스스로 알 수 없다. 클래스 이름과 테이블 이름이 다를 수도 있고, `username` 필드가 `NAME` 컬럼이라는 것은 더더욱 알 길이 없다. 그래서 **매핑 정보**를 어노테이션으로 알려 준다.

```java
import jakarta.persistence.*;

@Entity
@Table(name = "MEMBER")
public class Member {

    @Id
    @Column(name = "ID")
    private Long id;

    @Column(name = "NAME")
    private String username;

    private Integer age;   // 매핑 생략 → 필드명이 컬럼명
}
```

```
Member 클래스          MEMBER 테이블
┌──────────────┐      ┌──────────────┐
│ id           │ ───▶ │ ID (PK)      │
│ username     │ ───▶ │ NAME         │
│ age          │ ───▶ │ AGE          │
└──────────────┘      └──────────────┘
  @Entity               @Table
```

| 어노테이션 | 역할 | 생략하면 |
|:-----------|:-----|:---------|
| `@Entity` | 이 클래스를 JPA가 관리하는 엔티티로 등록 | 생략 불가. JPA가 이 클래스를 모른다 |
| `@Table` | 매핑할 테이블 이름 | 클래스 이름을 테이블 이름으로 사용 |
| `@Id` | 기본키 필드 | 생략 불가. 엔티티마다 반드시 하나 |
| `@Column` | 매핑할 컬럼 이름 | 필드 이름을 컬럼 이름으로 사용 |

### 2.1 왜 매핑 정보를 클래스에 붙이는가

매핑 정보는 어딘가에는 있어야 한다. JPA는 애플리케이션이 시작될 때 `@Entity`가 붙은 클래스를 모두 읽어 "이 클래스는 이 테이블, 이 필드는 이 컬럼"이라는 메타데이터 모델을 만들고, 이후 모든 SQL을 그 모델에서 생성한다. 1장에서 "필드 하나를 추가하면 SQL이 자동으로 따라 바뀐다"고 했던 것은 이 모델 덕분이다.

그 정보를 XML 파일(`orm.xml`)에 따로 둘 수도 있지만, 어노테이션으로 필드 바로 옆에 두면 필드를 고칠 때 매핑도 같은 자리에서 고치게 된다. 코드와 설정이 어긋날 틈이 줄어드는 것이다.

### 2.2 왜 `@Id`는 반드시 있어야 하는가

JPA는 엔티티를 **기본키로 식별**한다. 1장에서 본 1차 캐시가 기본키를 키로 하는 맵이고, `find(Member.class, 1L)`도 기본키로 찾는다. 기본키가 없는 클래스는 JPA 입장에서 "같은 것인지 다른 것인지" 판단할 방법이 없으므로 관리할 수 없다. 기본키를 직접 넣을지, DB가 생성하게 할지 같은 전략은 [Chapter 07. 엔티티 매핑](../07-entity-mapping)에서 다룬다.

{{< callout type="info" >}}
`@Column`을 생략하면 필드 이름이 그대로 컬럼 이름이 된다. 단, **스프링 부트는 기본 네이밍 전략이 다르다.** `orderDate` 필드를 순수 Hibernate는 `orderDate` 컬럼으로, 스프링 부트는 `order_date` 컬럼으로 매핑한다. 같은 엔티티인데 환경에 따라 다른 SQL이 나가는 흔한 원인이므로, DDL을 직접 관리한다면 `@Column(name=...)`으로 명시하는 편이 안전하다.
{{< /callout >}}

{{< callout type="warning" >}}
엔티티 클래스에는 **기본 생성자**(public 또는 protected)가 있어야 하고, `final` 클래스여서는 안 된다. JPA가 조회 결과로 객체를 만들 때 리플렉션으로 기본 생성자를 호출하고, 지연 로딩용 프록시를 엔티티 클래스를 상속해서 만들기 때문이다. 자세한 요구사항은 [Chapter 07](../07-entity-mapping)에서 정리한다.
{{< /callout >}}

---

## 3. persistence.xml: JPA에게 DB를 알려 준다

매핑 정보로 "무엇을" 저장할지는 알려 줬으니, 이제 "어디에" 저장할지를 알려 줄 차례다. JPA는 클래스패스의 `META-INF/persistence.xml`을 읽는다. 위치가 표준으로 정해져 있어서 파일 경로를 따로 설정하지 않아도 `Persistence.createEntityManagerFactory()`가 알아서 찾는다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<persistence xmlns="https://jakarta.ee/xml/ns/persistence"
             version="3.0">

    <persistence-unit name="jpabook">
        <properties>
            <!-- 필수: JDBC 접속 정보 -->
            <property name="jakarta.persistence.jdbc.driver"
                      value="org.h2.Driver"/>
            <!-- 서버 없이 쓰려면 jdbc:h2:mem:test -->
            <property name="jakarta.persistence.jdbc.url"
                      value="jdbc:h2:tcp://localhost/~/test"/>
            <property name="jakarta.persistence.jdbc.user"
                      value="sa"/>
            <property name="jakarta.persistence.jdbc.password"
                      value=""/>

            <!-- 선택: 방언. Hibernate 6부터는 자동 감지 -->
            <property name="hibernate.dialect"
                      value="org.hibernate.dialect.H2Dialect"/>

            <!-- 선택: 실행되는 SQL 확인 -->
            <property name="hibernate.show_sql" value="true"/>
            <property name="hibernate.format_sql" value="true"/>
            <property name="hibernate.use_sql_comments" value="true"/>
        </properties>
    </persistence-unit>
</persistence>
```

`jakarta.persistence.jdbc.*` 네 가지는 JPA 표준 속성이고, `hibernate.*`는 Hibernate 전용 속성이다. 접두어만 봐도 어느 층의 설정인지 구분할 수 있다. `show_sql`과 `format_sql`은 처음 배울 때 반드시 켜 두는 것이 좋다. JPA가 내 코드를 어떤 SQL로 바꾸는지 눈으로 확인하는 것이 이 시리즈 전체를 관통하는 학습법이기 때문이다.

### 3.1 영속성 유닛

`<persistence-unit>` 하나가 **영속성 유닛**이다. 연결할 데이터베이스 하나와 그 DB에 매핑되는 엔티티들을 한 묶음으로 본 것이다. 뒤에서 만들 엔티티 매니저 팩토리는 영속성 유닛 하나당 하나씩 만들어지므로, 데이터베이스가 둘이면 유닛도 둘이어야 한다. 이름(`jpabook`)은 팩토리를 만들 때 이 유닛을 가리키는 열쇠로 쓰인다.

### 3.2 방언

1장에서 봤듯 SQL은 DB마다 조금씩 다르고, 그 차이를 흡수하는 계층이 **방언**(Dialect)이다. JPA 표준에는 방언이라는 개념이 없다. Hibernate가 자기 안에서 해결하는 문제라 설정 이름도 `hibernate.dialect`다.

```
         애플리케이션
       (JPQL, JPA API)
              │
        ┌─────▼─────┐
        │ Hibernate │
        │  + 방언   │
        └─────┬─────┘
              │  DB에 맞는 SQL
        ┌─────┼──────┐
        ▼     ▼      ▼
       H2   MySQL  Oracle
```

| DB | Hibernate 6 방언 클래스 |
|:---|:------------------------|
| H2 | `org.hibernate.dialect.H2Dialect` |
| MySQL | `org.hibernate.dialect.MySQLDialect` |
| Oracle | `org.hibernate.dialect.OracleDialect` |
| PostgreSQL | `org.hibernate.dialect.PostgreSQLDialect` |
| SQL Server | `org.hibernate.dialect.SQLServerDialect` |

**왜 이제는 생략해도 되는가.** Hibernate 5까지는 `MySQL8Dialect`, `Oracle12cDialect`처럼 DB 버전마다 클래스가 따로 있어서 명시하는 것이 관례였다. Hibernate 6는 방언 하나가 여러 버전을 알고, 접속 시 JDBC 메타데이터로 DB 종류와 버전을 읽어 스스로 맞춘다. 그래서 버전별 클래스는 사용 중단됐고, `hibernate.dialect`는 자동 감지가 어긋나는 특수한 경우에만 명시하면 된다.

{{< callout type="info" >}}
JPA 2.x 기준 자료에는 속성 이름이 `javax.persistence.jdbc.*`로 나온다. 1장에서 본 패키지 이름 변경과 같은 이유로 Jakarta Persistence 3.0부터 `jakarta.persistence.jdbc.*`가 됐다. 스프링 부트에서는 이 파일 대신 `spring.datasource.*`와 `spring.jpa.*` 속성이 같은 역할을 한다.
{{< /callout >}}

---

## 4. 엔티티 매니저 팩토리와 엔티티 매니저

설정이 끝났으니 JPA를 실제로 움직이는 두 객체를 만든다.

```
    persistence.xml
           │  읽어서 만든다
           ▼
  EntityManagerFactory
   (앱에서 하나, 공유)
           │
  createEntityManager()
     ┌─────┼─────┐
     ▼     ▼     ▼
    EM    EM    EM
   요청1 요청2 요청3
   (공유 금지, 쓰고 닫기)
```

```java
// 1. 팩토리: 애플리케이션이 시작될 때 한 번
EntityManagerFactory emf =
    Persistence.createEntityManagerFactory("jpabook");

// 2. 엔티티 매니저: 요청(작업 단위)마다
EntityManager em = emf.createEntityManager();

// 3. 작업이 끝나면 반드시 닫는다
em.close();

// 4. 애플리케이션을 종료할 때
emf.close();
```

### 4.1 왜 팩토리는 하나만 만드는가

`createEntityManagerFactory()`는 persistence.xml을 읽고, `@Entity` 클래스를 전부 찾아 매핑 메타데이터를 만들고, 커넥션 풀을 준비한다. 2절에서 말한 "매핑 모델"이 이때 만들어진다. 이 작업은 무겁고, 결과물은 애플리케이션이 도는 내내 변하지 않는다. 그래서 한 번 만들어 모든 스레드가 공유한다. 팩토리는 그렇게 쓰이도록 스레드 안전하게 설계되어 있다.

### 4.2 왜 엔티티 매니저는 공유하면 안 되는가

엔티티 매니저는 만드는 비용이 거의 없는 대신 **상태**를 갖는다. 다음 장에서 자세히 볼 영속성 컨텍스트, 즉 1차 캐시와 아직 안 나간 SQL 목록이 엔티티 매니저 안에 있다. 두 요청이 하나를 나눠 쓰면 서로의 캐시와 트랜잭션 상태가 섞인다. 요청 A가 조회한 엔티티를 요청 B가 보고, A의 롤백이 B의 변경까지 지우는 식이다. 그래서 요청마다 만들고 끝나면 닫는다.

| 구분 | EntityManagerFactory | EntityManager |
|:-----|:---------------------|:--------------|
| 만드는 비용 | 크다 (설정·매핑·커넥션 풀) | 거의 없다 |
| 개수 | 영속성 유닛당 하나 | 요청(작업 단위)마다 |
| 스레드 공유 | 가능 | 금지 |
| 갖고 있는 것 | 매핑 메타데이터, 커넥션 풀 | 영속성 컨텍스트 |
| 닫는 시점 | 애플리케이션 종료 | 작업 종료 |

{{< callout type="warning" >}}
`em.close()`를 빼먹으면 영속성 컨텍스트와 그 안의 엔티티가 메모리에 남고, 커넥션 반환도 늦어질 수 있다. 스프링에서는 `@PersistenceContext`로 주입받는 `EntityManager`가 실제 객체가 아니라 **프록시**라서, 호출 시점의 트랜잭션에 묶인 진짜 엔티티 매니저로 연결해 주고 트랜잭션이 끝나면 대신 닫아 준다. 필드 하나를 여러 스레드가 써도 안전한 이유다. 엔티티 매니저와 영속성 컨텍스트의 관계는 [Chapter 03. 영속성 컨텍스트](../03-persistence-context)에서 이어진다.
{{< /callout >}}

---

## 5. 트랜잭션: 모든 변경은 트랜잭션 안에서

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();      // 트랜잭션 시작
    logic(em);       // 비즈니스 로직
    tx.commit();     // 커밋 → 모아 둔 SQL 실행
} catch (Exception e) {
    tx.rollback();   // 예외 시 되돌린다
} finally {
    em.close();      // 성공하든 실패하든 닫는다
}
```

JPA에서 데이터를 바꾸는 작업은 반드시 트랜잭션 안에서 해야 한다. 조회는 트랜잭션 없이도 되지만, 등록·수정·삭제는 트랜잭션이 없으면 DB에 아무것도 남지 않는다.

### 5.1 왜 트랜잭션이 필수인가

1장에서 본 **쓰기 지연** 때문이다. `persist()`를 호출해도 JPA는 INSERT를 바로 보내지 않고 영속성 컨텍스트에 모아 둔다. 모아 둔 SQL이 실제로 나가는 시점이 **커밋**이다. 그러니 트랜잭션이 없으면 "SQL을 내보낼 순간"이 아예 정의되지 않는다. 트랜잭션은 부가 기능이 아니라, JPA가 SQL을 언제 실행할지 정하는 기준 단위다.

```
tx.begin()
   │  커넥션 획득
   ▼
em.persist(member)   ─┐
member.setAge(20)     │ SQL은 아직
em.remove(other)     ─┘ 안 나간다
   │
   ▼
tx.commit()
   │  flush: INSERT, UPDATE, DELETE
   ▼
DB 반영
```

이 설계 덕분에 하나의 작업 단위에서 생긴 변경이 전부 반영되거나 전부 취소된다. 중간에 예외가 나면 `rollback()` 한 번으로 모아 둔 SQL을 버리면 된다. 아직 DB에 나간 것이 없으니 되돌릴 것도 적다.

{{< callout type="info" >}}
트랜잭션 없이 `persist()`를 부르면 어떻게 될까. 스프링처럼 컨테이너가 관리하는 엔티티 매니저는 그 자리에서 `TransactionRequiredException`을 던진다. 이 장처럼 직접 만든 엔티티 매니저는 예외 없이 영속성 컨텍스트에만 담아 두고, 플러시할 시점이 없으니 끝내 INSERT가 나가지 않는다. "에러도 없는데 저장이 안 된다"는 초보 시절의 미스터리가 대개 이것이다. 스프링에서는 `@Transactional`이 위의 `begin`/`commit`/`rollback` 코드를 대신한다.
{{< /callout >}}

---

## 6. CRUD: SQL 없이 네 가지 작업

모두 트랜잭션 안에서 실행한다고 가정한다.

### 6.1 등록

```java
Member member = new Member();
member.setId(1L);
member.setUsername("홍길동");
member.setAge(20);

em.persist(member);   // 영속성 컨텍스트에 등록. INSERT는 커밋 때
```

`persist`라는 이름은 "저장"이 아니라 **"영속화"**, 즉 JPA의 관리 대상으로 등록한다는 뜻이다. INSERT SQL은 이 시점에 만들어져 쓰기 지연 저장소에 들어가고, 커밋할 때 실행된다.

### 6.2 조회

```java
// 기본키로 한 건
Member member = em.find(Member.class, 1L);

// 조건 검색은 JPQL
List<Member> members = em.createQuery(
        "select m from Member m where m.age > 18", Member.class)
    .getResultList();
```

`find()`는 먼저 1차 캐시를 보고, 없을 때만 SELECT를 실행한다. 방금 `persist()`한 회원을 같은 트랜잭션에서 `find()`하면 SQL 없이 그 인스턴스가 그대로 돌아온다. 기본키가 아닌 조건으로 찾으려면 7절의 JPQL을 쓴다.

### 6.3 수정

```java
Member member = em.find(Member.class, 1L);
member.setUsername("김철수");   // 이게 전부다. 커밋 때 UPDATE
```

`em.update()` 같은 메서드는 없다. 1장에서 잠깐 본 **변경 감지** 때문이다. JPA는 엔티티를 조회한 순간의 상태를 스냅샷으로 보관하고, 커밋 시점에 현재 상태와 비교해 달라진 엔티티에 대해서만 UPDATE를 만든다. 개발자가 "수정했다"고 알릴 필요가 없다. 자바 컬렉션에서 꺼낸 객체를 바꾸면 그게 곧 컬렉션 안의 객체가 바뀐 것인데, JPA는 그 감각을 DB까지 확장한 셈이다.

### 6.4 삭제

```java
Member member = em.find(Member.class, 1L);
em.remove(member);   // 커밋 때 DELETE
```

삭제도 대상을 먼저 조회한 뒤 넘긴다. JPA는 영속성 컨텍스트가 관리하는 엔티티만 다루기 때문에, "기본키 1번을 지워라"가 아니라 "이 관리 중인 객체를 지워라"라고 말해야 한다. DELETE 역시 커밋 시점에 나간다.

| 작업 | 호출 | SQL | 실행 시점 |
|:-----|:-----|:----|:----------|
| 등록 | `em.persist(m)` | INSERT | 커밋(플러시) |
| 조회 | `em.find(Member.class, id)` | SELECT | 즉시. 단, 1차 캐시에 있으면 생략 |
| 수정 | `m.setUsername(...)` | UPDATE | 커밋(플러시), 변경된 엔티티만 |
| 삭제 | `em.remove(m)` | DELETE | 커밋(플러시) |

세 가지 변경 작업이 모두 "커밋 때"인 것이 눈에 띌 것이다. 이것이 5절에서 말한 쓰기 지연이고, 그 SQL이 실제로 나가는 순간을 **플러시**라 부른다. 플러시가 언제, 어떻게 일어나는지는 [Chapter 06. 플러시](../06-flush-and-detached)에서, 변경 감지와 1차 캐시의 동작은 [Chapter 05. 영속성 특징](../05-persistence-features)에서 다룬다.

---

## 7. JPQL: 테이블이 아니라 엔티티에게 묻는다

`find()`는 기본키로 한 건만 찾는다. "나이가 18보다 많은 회원"처럼 조건으로 검색하려면 결국 쿼리가 필요하다. 그런데 여기서 SQL을 직접 쓰면 1장에서 벗어나려 했던 "SQL에 의존적인 개발"로 그대로 돌아간다. 테이블과 컬럼 이름이 다시 코드에 박히기 때문이다.

JPQL은 이 딜레마를 **쿼리의 대상을 테이블이 아니라 엔티티로** 바꾸는 방식으로 푼다.

| 구분 | 대상 | 예시 |
|:-----|:-----|:-----|
| SQL | 테이블과 컬럼 | `SELECT * FROM MEMBER WHERE AGE > 18` |
| JPQL | 엔티티와 필드 | `select m from Member m where m.age > 18` |

```java
String jpql = "select m from Member m where m.username = :name";

List<Member> members = em.createQuery(jpql, Member.class)
    .setParameter("name", "홍길동")
    .getResultList();
```

`Member`는 클래스 이름이고 `m.username`은 필드 이름이다. 테이블 `MEMBER`와 컬럼 `NAME`은 코드 어디에도 없다. JPQL이 실행될 때 Hibernate가 2절의 매핑 정보를 참고해 SQL로 바꿔 준다.

```
JPQL  select m from Member m
      where m.age > 18
               │  Member → MEMBER
               ▼  m.age  → AGE
SQL   select ID, NAME, AGE
      from MEMBER
      where AGE > 18
```

### 7.1 왜 JPQL을 거쳐야 하는가

DB 종류가 바뀌어도 JPQL은 그대로다. 엔티티 이름과 필드 이름만 쓰니 테이블 이름이 바뀌어도, 컬럼 이름이 바뀌어도 매핑만 고치면 된다. SQL이 코드에서 사라진 것이 아니라, **코드가 아닌 매핑 정보 쪽으로 옮겨 간 것**이다. 1장의 "객체가 SQL에 종속되는 문제"를 쿼리에서도 해결하는 장치가 JPQL이다.

JPQL에서 `Member`와 `m.username`은 자바 식별자이므로 대소문자를 구분한다. `member`라고 쓰면 그런 엔티티가 없다는 오류가 난다. 반면 `select`, `from`, `where` 같은 예약어는 대소문자를 가리지 않는다.

{{< callout type="info" >}}
JPQL은 결국 SQL이 되어 DB에서 실행된다. 그래서 JPA는 JPQL을 실행하기 직전에 영속성 컨텍스트에 모아 둔 변경을 먼저 **플러시**한다. 그렇지 않으면 방금 `persist()`한 회원이 검색 결과에서 빠지는 모순이 생기기 때문이다. 이 동작은 [Chapter 06](../06-flush-and-detached)에서, JPQL 문법과 페치 조인은 [Chapter 12. 객체지향 쿼리](../12-object-oriented-query)에서 자세히 다룬다.
{{< /callout >}}

---

## 요약

| 항목 | 핵심 |
|:-----|:-----|
| 준비물 | JPA API + 구현체(Hibernate) + JDBC 드라이버 |
| `@Entity`, `@Table` | 클래스를 테이블에 매핑. 시작 시 매핑 모델로 읽힌다 |
| `@Id` | 필수. JPA는 엔티티를 기본키로 식별한다 |
| `@Column` | 생략하면 필드명. 스프링 부트는 snake_case로 바꾼다 |
| persistence.xml | `META-INF`에 두는 표준 설정. 영속성 유닛은 DB당 하나 |
| 방언 | DB별 SQL 차이 흡수. Hibernate 6부터 자동 감지 |
| EntityManagerFactory | 무겁고 요청별 상태가 없다 → 하나만 만들어 공유 |
| EntityManager | 가볍고 상태가 있다 → 요청마다 만들고 닫는다 |
| 트랜잭션 | SQL이 나가는 기준 단위. 변경 작업은 필수 |
| CRUD | `persist`, `find`, 변경 감지, `remove`. 변경은 커밋 때 반영 |
| JPQL | 엔티티 대상 쿼리. 테이블 이름이 코드에서 사라진다 |

### 기본 코드 템플릿

```java
EntityManagerFactory emf =
    Persistence.createEntityManagerFactory("jpabook");
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();

    em.persist(entity);                       // 등록
    Entity found = em.find(Entity.class, id); // 조회
    found.setName("new");                     // 수정 (변경 감지)
    em.remove(found);                         // 삭제

    tx.commit();                              // 여기서 SQL 실행
} catch (Exception e) {
    tx.rollback();
} finally {
    em.close();
}
emf.close();
```
