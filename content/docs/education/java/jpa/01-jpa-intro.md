---
title: "Chapter 01. JPA 소개"
weight: 1
---

## 1. 패러다임의 불일치

> 객체와 관계형 데이터베이스는 **지향하는 목적이 다르다**

객체지향 언어는 **추상화·캡슐화·상속·다형성**을 통해 현실 세계를 모델링한다. 반면 관계형 DB는 **데이터 정규화**와 **집합 연산**에 최적화된 2차원 테이블이다. 두 모델 사이의 구조적 간극을 **패러다임의 불일치**라 한다.

| 구분 | 객체 | 관계형 DB |
|:-----|:-----|:----------|
| 상속 | 지원 | 미지원 (슈퍼/서브 타입 흉내) |
| 연관관계 | 참조 (단방향) | 외래키 (양방향 조인) |
| 탐색 | 객체 그래프 자유롭게 | 실행한 SQL에 한정 |
| 비교 | `==`, `equals()` | 기본키(PK) |

---

## 2. 불일치 문제 상세

### 2.1 상속

```
  [객체 상속]          [DB 슈퍼/서브]

      Item              ITEM 테이블
       △                    │
    ┌──┼──┐             ┌───┼───┐
    ▼  ▼  ▼             ▼   ▼   ▼
  Album Movie Book    ALBUM MOVIE BOOK
```

**문제**: 객체 하나를 저장하려면 두 테이블(부모·자식)에 나눠 INSERT 해야 하고, 조회 시 조인 SQL을 직접 짜야 한다.

**JPA 해결**: 컬렉션에 담듯 한 줄로 처리

```java
jpa.persist(album);   // INSERT ITEM + INSERT ALBUM 자동
Album a = jpa.find(Album.class, id);  // JOIN 자동
```

### 2.2 연관관계

| 구분 | 객체 | 테이블 |
|:-----|:-----|:-------|
| 방향 | 단방향 (참조) | 양방향 (외래키) |
| 탐색 | `member.getTeam()` | JOIN 으로 양쪽 |
| 저장 | 객체 참조 | 외래키 값 |

```java
// 객체 모델 - 참조
class Member {
    Team team;   // Member → Team 탐색
}

// DB 모델 - 외래키
// MEMBER.TEAM_ID 로 양방향 JOIN
```

객체를 외래키에 맞춰 억지로 설계하거나, 관계를 잃어버리는 문제가 생긴다. JPA는 `@ManyToOne` 같은 매핑으로 참조 ↔ 외래키 변환을 자동화한다.

### 2.3 객체 그래프 탐색

```java
// 이상: 어디든 자유롭게 탐색
member.getTeam();
member.getOrder().getOrderItem();
```

**문제**: SQL 직접 작성 시, 실행된 SQL 이 조회한 범위만 탐색 가능.

```java
// SELECT M.*, T.* FROM MEMBER M JOIN TEAM T ...
member.getTeam();     // OK (조회됨)
member.getOrder();    // null! (조회 안 함)
```

**JPA 해결**: 지연 로딩(Lazy Loading). 실제 사용 시점에 SELECT 수행.

```java
Team team = member.getTeam();   // 프록시 반환
team.getName();                 // 이 시점에 SELECT
```

### 2.4 비교

| 비교 | 연산자 | 의미 |
|:-----|:-------|:-----|
| 동일성 (identity) | `==` | 참조(주소) 비교 |
| 동등성 (equality) | `equals()` | 값 비교 |

**문제**: 순수 JDBC 는 같은 PK 를 두 번 조회해도 매번 새 인스턴스.

```java
Member m1 = memberDAO.find(1L);
Member m2 = memberDAO.find(1L);
m1 == m2;   // false
```

**JPA 해결**: 같은 트랜잭션 안에서 **1차 캐시**로 동일 인스턴스 보장.

```java
Member m1 = jpa.find(Member.class, 1L);
Member m2 = jpa.find(Member.class, 1L);
m1 == m2;   // true
```

---

## 3. JPA란?

> **Java Persistence API** — 자바 ORM 기술 표준

### ORM (Object-Relational Mapping)

객체와 관계형 DB 를 **자동 매핑**해주는 기술.

```
  ┌──────────┐            ┌──────────┐
  │ Java App │ ←── JPA ──→│    DB    │
  │  Object  │            │  Table   │
  └─────┬────┘            └─────┬────┘
        │      ┌──────┐         │
        └─────→│ JDBC │←────────┘
               └──────┘
```

JPA 는 내부적으로 JDBC 를 호출한다. 개발자는 객체에 집중하고, JPA 가 SQL 을 생성·실행한다.

### JPA 동작

```java
// 저장: INSERT 자동 생성
jpa.persist(member);

// 조회: SELECT 자동 생성
Member member = jpa.find(Member.class, id);

// 수정: 변경 감지 → UPDATE 자동
member.setName("newName");

// 삭제: DELETE 자동 생성
jpa.remove(member);
```

---

## 4. JPA 역사

```
EJB 엔티티 빈 (복잡, 성능 낮음)
        ↓
Hibernate 등장 (오픈소스, 실용적)
        ↓
EJB 3.0 → JPA 표준 (Hibernate 기반)
        ↓
Jakarta Persistence (javax → jakarta)
```

### JPA vs Hibernate

| 구분 | JPA | Hibernate |
|:-----|:----|:----------|
| 역할 | 표준 인터페이스 (스펙) | 구현체 (실제 동작) |
| 패키지 | `javax.persistence` | `org.hibernate` |
| 예 | `@Entity`, `EntityManager` | `Session`, `SessionFactory` |

JPA 는 인터페이스, Hibernate·EclipseLink·DataNucleus 는 구현체다. 실무에서는 대부분 Hibernate 를 사용한다.

---

## 5. JPA 사용 이유

### 5.1 생산성

```java
// JDBC: 반복적인 SQL 작성
String sql = "INSERT INTO MEMBER (ID, NAME) VALUES (?, ?)";
pstmt.setLong(1, member.getId());
pstmt.setString(2, member.getName());
pstmt.executeUpdate();

// JPA: 한 줄
jpa.persist(member);
```

### 5.2 유지보수

필드 하나를 추가할 때:

- **JDBC**: 관련된 SELECT/INSERT/UPDATE SQL 과 매핑 코드를 모두 수정
- **JPA**: 필드만 추가하면 끝, SQL 자동 반영

```java
class Member {
    Long id;
    String name;
    String email;   // 추가 → 자동으로 SELECT/INSERT/UPDATE 반영
}
```

### 5.3 패러다임 불일치 해결

| 문제 | JPA 해결 |
|:-----|:---------|
| 상속 | 자동 테이블 분리/병합 |
| 연관관계 | 참조 → 외래키 자동 변환 |
| 객체 그래프 탐색 | 지연 로딩 (프록시) |
| 비교 | 1차 캐시로 동일성 보장 |

### 5.4 성능 최적화

**1차 캐시**

```java
Member m1 = jpa.find(Member.class, 1L);  // DB SELECT
Member m2 = jpa.find(Member.class, 1L);  // 캐시 반환 (SQL X)
```

**쓰기 지연 (Write-behind)**

```java
transaction.begin();
jpa.persist(memberA);   // SQL 모아둠
jpa.persist(memberB);   // SQL 모아둠
transaction.commit();   // 한 번에 flush
```

**지연 로딩**으로 불필요한 조회 방지, **변경 감지**로 꼭 필요한 UPDATE 만 실행.

### 5.5 데이터베이스 독립성

DB 방언(Dialect)만 바꾸면 Oracle ↔ MySQL ↔ PostgreSQL 전환이 가능하다.

```properties
# 설정만 변경하면 DB 교체 가능
spring.jpa.database-platform=org.hibernate.dialect.MySQL8Dialect
```

---

## 요약

| 항목 | 핵심 |
|:-----|:-----|
| 패러다임 불일치 | 객체 ↔ RDB 구조적 차이 |
| JPA | 자바 ORM 표준 인터페이스 |
| ORM | 객체-테이블 자동 매핑 |
| Hibernate | JPA 구현체 (실무 최다) |
| 지연 로딩 | 실제 사용 시점에 SELECT |
| 동일성 보장 | 같은 트랜잭션 내 같은 인스턴스 |
| 생산성 | SQL 자동 생성, 반복 코드 제거 |
| 유지보수 | 필드 변경 시 SQL 자동 반영 |

### JPA 핵심 코드

```java
// 저장
entityManager.persist(entity);

// 조회
Entity entity = entityManager.find(Entity.class, id);

// 수정 (변경 감지)
entity.setName("newName");   // commit 시 UPDATE 자동

// 삭제
entityManager.remove(entity);
```
