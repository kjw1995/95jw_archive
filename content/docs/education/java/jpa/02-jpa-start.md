---
title: "Chapter 02. JPA 시작"
weight: 2
---

## 1. 객체 매핑

엔티티 클래스와 DB 테이블을 연결하기 위해 JPA 는 **매핑 어노테이션**을 제공한다. 클래스 단위(`@Entity`, `@Table`)와 필드 단위(`@Id`, `@Column`)로 구분된다.

### 핵심 어노테이션

| 어노테이션 | 설명 |
|:-----------|:-----|
| `@Entity` | 클래스를 엔티티로 지정 |
| `@Table` | 매핑할 테이블 지정 (생략 시 클래스명) |
| `@Id` | 기본키(PK) 필드 |
| `@Column` | 필드 ↔ 컬럼 매핑 |

### 매핑 예시

```java
@Entity
@Table(name = "MEMBER")
public class Member {

    @Id
    @Column(name = "ID")
    private Long id;

    @Column(name = "NAME")
    private String username;

    private Integer age;   // 매핑 생략 → 필드명 = 컬럼명
}
```

```
      MEMBER 테이블
  ┌──────┬──────┬──────┐
  │  ID  │ NAME │ AGE  │
  │ (PK) │      │      │
  └──────┴──────┴──────┘
     │      │      │
    @Id  @Column  생략
```

{{< callout type="info" >}}
`@Column(name=...)` 을 생략하면 **필드명이 그대로 컬럼명**이 된다 (Hibernate 네이밍 전략에 따라 `camelCase` → `snake_case` 변환 가능).
{{< /callout >}}

---

## 2. persistence.xml 설정

JPA 는 `META-INF/persistence.xml` 에서 설정을 읽는다. 스프링 부트에서는 `application.yml` 이 대신하지만, 표준 JPA 동작을 이해하려면 알아둘 필요가 있다.

```xml
<persistence>
    <persistence-unit name="jpabook">
        <!-- 필수 속성 -->
        <property name="javax.persistence.jdbc.driver"
                  value="org.h2.Driver"/>
        <property name="javax.persistence.jdbc.url"
                  value="jdbc:h2:tcp://..."/>
        <property name="javax.persistence.jdbc.user"
                  value="sa"/>
        <property name="javax.persistence.jdbc.password"
                  value=""/>

        <!-- 데이터베이스 방언 -->
        <property name="hibernate.dialect"
                  value="org.hibernate.dialect.H2Dialect"/>
    </persistence-unit>
</persistence>
```

### 영속성 유닛 (Persistence Unit)

- 연결할 **데이터베이스당 1개** 등록
- 이름은 고유해야 하며 `Persistence.createEntityManagerFactory("이름")` 에 사용

### 데이터베이스 방언 (Dialect)

> SQL 표준으로 해결되지 않는 **DB 고유 기능·문법**을 추상화한 계층

Oracle 의 `ROWNUM`, MySQL 의 `LIMIT`, PostgreSQL 의 `SERIAL` 등 DB 마다 다른 부분을 Dialect 가 담당한다.

| DB | Dialect 클래스 |
|:---|:---------------|
| H2 | `H2Dialect` |
| MySQL | `MySQL8Dialect` |
| Oracle | `Oracle12cDialect` |
| PostgreSQL | `PostgreSQLDialect` |

```
    JPA 애플리케이션
          │
    ┌─────▼─────┐
    │ JPA API   │
    └─────┬─────┘
          │
   ┌──────┼──────┐
   ▼      ▼      ▼
 H2    MySQL  Oracle
 방언   방언   방언
   │      │      │
   ▼      ▼      ▼
  [H2] [MySQL] [Oracle]
```

---

## 3. 엔티티 매니저

### 구조

```
     EntityManagerFactory
     (앱당 1개, 스레드 안전)
            │
    createEntityManager()
     ┌──────┼──────┐
     ▼      ▼      ▼
    EM     EM     EM
   (req1)(req2)(req3)
  스레드별 생성·사용
```

**EntityManagerFactory** 는 내부적으로 커넥션 풀·메타데이터·캐시를 보유하므로 **생성 비용이 크다**. 반면 **EntityManager** 는 가벼워서 요청마다 만들어도 문제 없다.

### 생성과 종료

```java
// 1. 팩토리 생성 (앱 시작 시 1번)
EntityManagerFactory emf =
    Persistence.createEntityManagerFactory("jpabook");

// 2. 엔티티 매니저 생성 (요청마다)
EntityManager em = emf.createEntityManager();

// 3. 사용 후 종료
em.close();    // 엔티티 매니저 종료
emf.close();   // 앱 종료 시 팩토리 종료
```

### 주의사항

| 구분 | EntityManagerFactory | EntityManager |
|:-----|:---------------------|:--------------|
| 생성 비용 | 높음 | 낮음 |
| 생성 횟수 | 1번 (싱글톤) | 요청마다 |
| 스레드 안전 | 안전 (공유 O) | 불안전 (공유 X) |

{{< callout type="warning" >}}
EntityManager 를 스레드 간 공유하면 **1차 캐시·트랜잭션 상태가 섞여** 데이터 오류가 발생한다. 스프링에서는 `@PersistenceContext` 로 주입되는 EM 이 스레드마다 프록시로 분리되어 안전하게 동작한다.
{{< /callout >}}

---

## 4. 트랜잭션 관리

> JPA 는 **항상 트랜잭션 안에서** 데이터를 변경해야 한다.

트랜잭션 없이 `persist`/`remove`/변경 감지를 호출하면 `TransactionRequiredException` 이 발생한다. 조회는 트랜잭션 밖에서도 가능하지만, 변경 작업은 반드시 트랜잭션이 필요하다.

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();      // 트랜잭션 시작

    logic(em);       // 비즈니스 로직

    tx.commit();     // 커밋 → flush
} catch (Exception e) {
    tx.rollback();   // 예외 시 롤백
} finally {
    em.close();
}
```

---

## 5. CRUD 작업

### 등록 (Create)

```java
Member member = new Member();
member.setId(1L);
member.setUsername("홍길동");

em.persist(member);   // INSERT
```

### 조회 (Read)

```java
// 단건 (PK)
Member member = em.find(Member.class, 1L);

// JPQL
List<Member> members = em.createQuery(
        "SELECT m FROM Member m", Member.class)
    .getResultList();
```

### 수정 (Update)

```java
Member member = em.find(Member.class, 1L);
member.setUsername("김철수");   // 변경 감지 → 자동 UPDATE
// em.update() 같은 메서드는 존재하지 않는다!
```

### 삭제 (Delete)

```java
Member member = em.find(Member.class, 1L);
em.remove(member);   // DELETE
```

{{< callout type="info" >}}
JPA 에서 수정은 **"엔티티를 조회해서 값을 바꾸는 것"** 으로 끝난다. 영속성 컨텍스트가 스냅샷과 비교해 변경된 필드를 찾아 UPDATE SQL 을 만든다 ( = 변경 감지, Dirty Checking).
{{< /callout >}}

---

## 6. JPQL

> **Java Persistence Query Language** — 객체지향 쿼리 언어

### SQL vs JPQL

| 구분 | 대상 | 예시 |
|:-----|:-----|:-----|
| SQL | 테이블 | `SELECT * FROM MEMBER` |
| JPQL | 엔티티 | `SELECT m FROM Member m` |

### 특징

- **엔티티(객체)를 대상**으로 쿼리
- **테이블명·컬럼명을 전혀 모름** — 엔티티 이름·필드명만 사용
- 결국 SQL 로 변환되어 실행되지만, DB 종류가 바뀌어도 JPQL 코드는 그대로

### 사용법

```java
String jpql =
    "SELECT m FROM Member m WHERE m.username = :name";

List<Member> members = em.createQuery(jpql, Member.class)
    .setParameter("name", "홍길동")
    .getResultList();
```

### JPQL → SQL 변환

```
JPQL:
  SELECT m FROM Member m
  WHERE m.age > 18
           ↓
SQL:
  SELECT M.ID, M.NAME, M.AGE
  FROM   MEMBER M
  WHERE  M.AGE > 18
```

`find()` 는 단건 PK 조회에만 쓸 수 있지만, JPQL 은 **검색 조건이 복잡한 쿼리**를 엔티티 기준으로 작성할 때 사용한다.

---

## 요약

| 항목 | 핵심 |
|:-----|:-----|
| `@Entity` | 클래스 → 테이블 매핑 |
| `@Id` | 필드 → 기본키 |
| `@Column` | 필드 → 컬럼 |
| persistence.xml | JPA 설정 파일 |
| Dialect | DB 별 방언 추상화 |
| EntityManagerFactory | 1개, 공유 가능 |
| EntityManager | 요청마다, 공유 금지 |
| `persist()` | 엔티티 저장 |
| `find()` | 엔티티 조회 |
| `remove()` | 엔티티 삭제 |
| 변경 감지 | 수정 시 자동 UPDATE |
| JPQL | 엔티티 대상 객체지향 쿼리 |

### 기본 코드 템플릿

```java
EntityManagerFactory emf =
    Persistence.createEntityManagerFactory("jpabook");
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();

    em.persist(entity);                       // 저장
    Entity e = em.find(Entity.class, id);     // 조회
    e.setName("new");                         // 수정 (자동 감지)
    em.remove(e);                             // 삭제

    tx.commit();
} catch (Exception e) {
    tx.rollback();
} finally {
    em.close();
}
emf.close();
```
