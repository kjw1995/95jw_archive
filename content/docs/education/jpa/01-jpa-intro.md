---
title: "Chapter 01. JPA 소개"
weight: 1
---

## 1. 패러다임의 불일치

> 객체와 관계형 데이터베이스는 **지향하는 목적이 다르다**

| 구분 | 객체 | 관계형 DB |
|------|------|-----------|
| 상속 | 지원 | 미지원 (슈퍼/서브타입으로 유사 구현) |
| 연관관계 | 참조 (단방향) | 외래키 (양방향) |
| 탐색 | 객체 그래프 탐색 | SQL에 따라 제한 |
| 비교 | `==`, `equals()` | 기본키(PK) |

---

## 2. 불일치 문제 상세

### 2.1 상속

```
┌─────────────────────────────────────────┐
│              객체 상속                   │
├─────────────────────────────────────────┤
│         [ Item ]                        │
│            △                            │
│     ┌──────┼──────┐                     │
│  [Album] [Movie] [Book]                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         테이블 (슈퍼/서브타입)            │
├─────────────────────────────────────────┤
│  ITEM 테이블 ←─┬─→ ALBUM 테이블          │
│               ├─→ MOVIE 테이블          │
│               └─→ BOOK 테이블           │
└─────────────────────────────────────────┘
```

**문제**: 객체 저장 시 여러 테이블에 INSERT 필요

**JPA 해결**: 컬렉션처럼 저장
```java
jpa.persist(album);  // JPA가 알아서 INSERT 처리
```

### 2.2 연관관계

| 구분 | 객체 | 테이블 |
|------|------|--------|
| 방향 | **단방향** (참조) | **양방향** (외래키) |
| 탐색 | `member.getTeam()` | JOIN으로 양방향 |

```java
// 객체: 참조로 연관관계
class Member {
    Team team;  // Member → Team 탐색 가능
}

// 테이블: 외래키로 양방향
// MEMBER 테이블의 TEAM_ID로 양방향 JOIN 가능
```

### 2.3 객체 그래프 탐색

```java
// 이상적인 객체 탐색
member.getTeam();
member.getOrder().getOrderItem();
```

**문제**: SQL 직접 작성 시, 실행한 SQL에 따라 탐색 범위가 제한됨

```java
// SQL: SELECT M.*, T.* FROM MEMBER M JOIN TEAM T ...
member.getTeam();      // OK
member.getOrder();     // NULL! (조회 안 했음)
```

**JPA 해결**: 지연 로딩 (Lazy Loading)
```java
// 실제 사용 시점에 DB 조회
Team team = member.getTeam();      // 프록시 반환
team.getName();                    // 이 시점에 SELECT 실행
```

### 2.4 비교

| 비교 방식 | 설명 |
|-----------|------|
| **동일성** (identity) | `==`, 주소 비교 |
| **동등성** (equality) | `equals()`, 값 비교 |

**문제**: 같은 데이터를 조회해도 다른 인스턴스
```java
Member m1 = memberDAO.find(1L);
Member m2 = memberDAO.find(1L);
m1 == m2;  // false! 다른 인스턴스
```

**JPA 해결**: 같은 트랜잭션 내 동일 객체 보장
```java
Member m1 = jpa.find(Member.class, 1L);
Member m2 = jpa.find(Member.class, 1L);
m1 == m2;  // true! 같은 인스턴스
```

---

## 3. JPA란?

> **Java Persistence API** - 자바 ORM 기술 표준

### ORM (Object-Relational Mapping)

객체와 관계형 데이터베이스를 **자동 매핑**

```
┌─────────────┐                    ┌─────────────┐
│  Java App   │                    │     DB      │
│   Object    │ ←───── JPA ─────→ │   Table     │
└─────────────┘                    └─────────────┘
       │                                  │
       │         ┌─────────┐              │
       └────────→│  JDBC   │←─────────────┘
                 └─────────┘
```

### JPA 동작

```java
// 저장: INSERT SQL 자동 생성
jpa.persist(member);

// 조회: SELECT SQL 자동 생성
Member member = jpa.find(Member.class, id);

// 수정: UPDATE SQL 자동 생성 (변경 감지)
member.setName("newName");

// 삭제: DELETE SQL 자동 생성
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
```

### JPA vs Hibernate

| JPA | Hibernate |
|-----|-----------|
| **표준 인터페이스** (API 명세) | **구현체** (실제 동작) |
| `javax.persistence` | `org.hibernate` |

> JPA는 인터페이스, Hibernate는 구현체

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

필드 추가 시:
- **JDBC**: 모든 SQL 수정 필요
- **JPA**: 필드만 추가하면 끝

```java
// 필드 추가
class Member {
    Long id;
    String name;
    String email;  // 추가 → SQL 자동 반영
}
```

### 5.3 패러다임 불일치 해결

| 문제 | JPA 해결 |
|------|----------|
| 상속 | 자동 테이블 분리/병합 |
| 연관관계 | 참조 → 외래키 자동 변환 |
| 객체 그래프 탐색 | 지연 로딩 |
| 비교 | 1차 캐시로 동일성 보장 |

### 5.4 성능 최적화

**1차 캐시**
```java
Member m1 = jpa.find(Member.class, 1L);  // DB 조회
Member m2 = jpa.find(Member.class, 1L);  // 캐시 반환 (SQL 실행 X)
```

**쓰기 지연**
```java
transaction.begin();
jpa.persist(memberA);  // SQL 모음
jpa.persist(memberB);  // SQL 모음
transaction.commit();  // 한 번에 전송
```

### 5.5 데이터베이스 독립성

```java
// 설정만 변경하면 DB 교체 가능
// Oracle → MySQL → PostgreSQL
spring.jpa.database-platform=org.hibernate.dialect.MySQL8Dialect
```

---

## 요약

| 항목 | 핵심 |
|------|------|
| **패러다임 불일치** | 객체 ↔ RDB 간 구조적 차이 |
| **JPA** | 자바 ORM 표준 인터페이스 |
| **ORM** | 객체-테이블 자동 매핑 |
| **Hibernate** | JPA 구현체 (가장 많이 사용) |
| **지연 로딩** | 실제 사용 시점에 DB 조회 |
| **동일성 보장** | 같은 트랜잭션 내 같은 객체 |
| **생산성** | SQL 자동 생성, 반복 코드 제거 |
| **유지보수** | 필드 변경 시 SQL 자동 반영 |

### JPA 핵심 코드

```java
// 저장
entityManager.persist(entity);

// 조회
Entity entity = entityManager.find(Entity.class, id);

// 수정 (변경 감지)
entity.setName("newName");  // commit 시 자동 UPDATE

// 삭제
entityManager.remove(entity);
```
