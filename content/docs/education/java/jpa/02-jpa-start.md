---
title: "Chapter 02. JPA 시작"
weight: 2
---

## 1. 객체 매핑

### 핵심 어노테이션

| 어노테이션 | 설명 |
|------------|------|
| `@Entity` | 클래스를 테이블과 매핑 (엔티티 클래스) |
| `@Table` | 매핑할 테이블 지정 (생략 시 클래스명 사용) |
| `@Id` | 기본키(PK) 매핑 (식별자 필드) |
| `@Column` | 필드를 컬럼에 매핑 |

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

    private Integer age;  // 매핑 어노테이션 생략 → 필드명이 컬럼명
}
```

```
┌──────────────────────────────────────────┐
│           MEMBER 테이블                   │
├──────────┬──────────┬───────────────────┤
│    ID    │   NAME   │       AGE         │
│   (PK)   │          │                   │
├──────────┼──────────┼───────────────────┤
│    ↑     │    ↑     │         ↑         │
│   @Id    │ @Column  │   어노테이션 생략   │
│          │          │   (필드명 = 컬럼명) │
└──────────┴──────────┴───────────────────┘
```

---

## 2. persistence.xml 설정

JPA 설정 파일 (META-INF/persistence.xml)

```xml
<persistence>
    <persistence-unit name="jpabook">
        <!-- 필수 속성 -->
        <property name="javax.persistence.jdbc.driver" value="org.h2.Driver"/>
        <property name="javax.persistence.jdbc.url" value="jdbc:h2:tcp://..."/>
        <property name="javax.persistence.jdbc.user" value="sa"/>
        <property name="javax.persistence.jdbc.password" value=""/>

        <!-- 데이터베이스 방언 -->
        <property name="hibernate.dialect" value="org.hibernate.dialect.H2Dialect"/>
    </persistence-unit>
</persistence>
```

### 영속성 유닛 (Persistence Unit)

- 연결할 **데이터베이스당 하나** 등록
- **고유한 이름** 부여 필요

### 데이터베이스 방언 (Dialect)

> 특정 DB만의 고유 기능/문법을 처리

| DB | Dialect 클래스 |
|----|----------------|
| H2 | `H2Dialect` |
| MySQL | `MySQL8Dialect` |
| Oracle | `Oracle12cDialect` |
| PostgreSQL | `PostgreSQLDialect` |

```
┌─────────────────────────────────────────────┐
│              JPA 애플리케이션                │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   JPA (표준 API)   │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐   ┌──────────┐   ┌──────────┐
│H2Dialect│  │MySQLDialect│ │OracleDialect│
└────────┘   └──────────┘   └──────────┘
    │              │              │
    ▼              ▼              ▼
  [H2]         [MySQL]       [Oracle]
```

---

## 3. 엔티티 매니저

### 구조

```
┌─────────────────────────────────────────────────────┐
│              EntityManagerFactory                    │
│         (애플리케이션 전체에서 1개, 공유)               │
└──────────────────────┬──────────────────────────────┘
                       │ createEntityManager()
           ┌───────────┼───────────┐
           ▼           ▼           ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │EntityManager│ │EntityManager│ │EntityManager│
    │ (요청마다)   │ │ (요청마다)   │ │ (요청마다)   │
    │ (스레드별)   │ │ (스레드별)   │ │ (스레드별)   │
    └────────────┘ └────────────┘ └────────────┘
```

### 생성과 종료

```java
// 1. 엔티티 매니저 팩토리 생성 (1번만, 비용 큼)
EntityManagerFactory emf =
    Persistence.createEntityManagerFactory("jpabook");

// 2. 엔티티 매니저 생성 (요청마다)
EntityManager em = emf.createEntityManager();

// 3. 사용 후 종료
em.close();   // 엔티티 매니저 종료
emf.close();  // 앱 종료 시 팩토리 종료
```

### 주의사항

| 구분 | EntityManagerFactory | EntityManager |
|------|---------------------|---------------|
| 생성 비용 | **높음** | 낮음 |
| 생성 횟수 | **1번** (싱글톤) | 요청마다 |
| 스레드 안전 | **안전** (공유 가능) | **불안전** (공유 금지) |

---

## 4. 트랜잭션 관리

> JPA는 **항상 트랜잭션 안에서** 데이터를 변경해야 함

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();      // 트랜잭션 시작

    // 비즈니스 로직
    logic(em);

    tx.commit();     // 트랜잭션 커밋

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

em.persist(member);  // INSERT
```

### 조회 (Read)

```java
// 단건 조회 (PK로)
Member member = em.find(Member.class, 1L);

// JPQL로 조회
List<Member> members = em.createQuery("SELECT m FROM Member m", Member.class)
                         .getResultList();
```

### 수정 (Update)

```java
Member member = em.find(Member.class, 1L);
member.setUsername("김철수");  // 변경 감지 → 자동 UPDATE
// em.persist() 호출 불필요!
```

### 삭제 (Delete)

```java
Member member = em.find(Member.class, 1L);
em.remove(member);  // DELETE
```

---

## 6. JPQL

> **Java Persistence Query Language** - 객체지향 쿼리 언어

### SQL vs JPQL

| 구분 | 대상 | 예시 |
|------|------|------|
| **SQL** | 테이블 | `SELECT * FROM MEMBER` |
| **JPQL** | 엔티티 | `SELECT m FROM Member m` |

### 특징

- **테이블이 아닌 엔티티(객체)를 대상**으로 쿼리
- **DB 테이블을 전혀 알지 못함**
- SQL을 추상화 → DB 독립적

### 사용법

```java
// JPQL 작성 (엔티티 대상)
String jpql = "SELECT m FROM Member m WHERE m.username = :name";

// 쿼리 생성 및 실행
List<Member> members = em.createQuery(jpql, Member.class)
                         .setParameter("name", "홍길동")
                         .getResultList();
```

### JPQL → SQL 변환

```
JPQL: SELECT m FROM Member m WHERE m.age > 18
                    ↓
SQL:  SELECT M.ID, M.NAME, M.AGE
      FROM MEMBER M
      WHERE M.AGE > 18
```

---

## 요약

| 항목 | 핵심 |
|------|------|
| **@Entity** | 클래스 → 테이블 매핑 |
| **@Id** | 필드 → 기본키(PK) 매핑 |
| **@Column** | 필드 → 컬럼 매핑 |
| **persistence.xml** | JPA 설정 파일 |
| **Dialect** | DB별 방언 처리 |
| **EntityManagerFactory** | 1개만 생성, 공유 가능 |
| **EntityManager** | 요청마다 생성, 공유 금지 |
| **persist()** | 엔티티 저장 |
| **find()** | 엔티티 조회 |
| **remove()** | 엔티티 삭제 |
| **변경 감지** | 수정 시 자동 UPDATE |
| **JPQL** | 엔티티 대상 객체지향 쿼리 |

### 기본 코드 템플릿

```java
EntityManagerFactory emf = Persistence.createEntityManagerFactory("jpabook");
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

try {
    tx.begin();

    // CRUD 작업
    em.persist(entity);                          // 저장
    Entity e = em.find(Entity.class, id);        // 조회
    e.setName("new");                            // 수정 (자동 감지)
    em.remove(e);                                // 삭제

    tx.commit();
} catch (Exception e) {
    tx.rollback();
} finally {
    em.close();
}
emf.close();
```
