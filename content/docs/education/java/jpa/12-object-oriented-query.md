---
title: "Chapter 10. 객체지향 쿼리 언어"
weight: 12
---

## 1. 객체지향 쿼리 소개

JPA는 복잡한 검색 조건으로 엔티티를 조회할 수 있는 다양한 쿼리 기술을 지원한다.

```
┌──────────────────────────────┐
│    JPA 쿼리 기술 분류          │
├──────────────────────────────┤
│ JPQL (핵심, 필수)             │
│  ├── Criteria (빌더)          │
│  └── QueryDSL (빌더)          │
│ 네이티브 SQL                   │
│ JDBC 직접 사용 / MyBatis       │
└──────────────────────────────┘
```

| 기술 | 특징 | 권장도 |
|:-----|:-----|:-------|
| **JPQL** | 표준 객체지향 쿼리, SQL과 유사 문법 | 필수 |
| **Criteria** | 코드 기반 JPQL 빌더, 컴파일 시점 오류 감지 | 낮음 (복잡) |
| **QueryDSL** | 코드 기반 JPQL 빌더, 직관적이고 간결 | 높음 |
| **네이티브 SQL** | DB 종속 SQL 직접 작성 | 최후 수단 |

{{< callout type="info" >}}
Criteria와 QueryDSL은 결국 JPQL을 만들어주는 빌더일 뿐이다. **JPQL을 먼저 확실히 이해해야** 나머지도 활용할 수 있다.
{{< /callout >}}

---

## 2. JPQL 기본 문법

JPQL(Java Persistence Query Language)은 **엔티티 객체를 대상**으로 쿼리하는 객체지향 쿼리 언어다.

### 2.1 SQL과 JPQL 비교

```
┌──────────────────────────────┐
│     SQL vs JPQL 대상          │
├──────────────────────────────┤
│ SQL  → 테이블 대상 쿼리        │
│ JPQL → 엔티티 대상 쿼리        │
│                              │
│ SQL :                        │
│  SELECT * FROM member        │
│  WHERE name = 'kim'          │
│                              │
│ JPQL:                        │
│  SELECT m FROM Member m      │
│  WHERE m.username = 'kim'    │
└──────────────────────────────┘
```

### 2.2 기본 규칙

```java
SELECT m FROM Member AS m WHERE m.username = 'Hello'
```

| 규칙 | 설명 |
|:-----|:-----|
| 대소문자 구분 | 엔티티명(`Member`), 속성명(`username`)은 구분. JPQL 키워드(`SELECT`, `FROM`)는 구분 안 함 |
| 엔티티 이름 사용 | 테이블명이 아닌 `@Entity(name="..")`에 지정된 이름 사용 |
| 별칭 필수 | `Member m` 처럼 별칭을 반드시 지정해야 한다 |
| INSERT 없음 | 저장은 `em.persist()` 사용 |

### 2.3 TypedQuery vs Query

```java
// 반환 타입이 명확할 때 → TypedQuery
TypedQuery<Member> query =
    em.createQuery(
        "SELECT m FROM Member m",
        Member.class);
List<Member> list = query.getResultList();

// 반환 타입이 불명확할 때 → Query
Query query =
    em.createQuery(
        "SELECT m.username, m.age FROM Member m");
List resultList = query.getResultList();

for (Object o : resultList) {
    Object[] row = (Object[]) o;
    String username = (String) row[0];
    Integer age = (Integer) row[1];
}
```

### 2.4 결과 조회 메서드

| 메서드 | 설명 | 결과 없을 때 |
|:-------|:-----|:-------------|
| `getResultList()` | 결과를 리스트로 반환 | 빈 컬렉션 |
| `getSingleResult()` | 결과가 정확히 1건일 때 | `NoResultException` |

{{< callout type="warning" >}}
`getSingleResult()`는 결과가 0건이면 `NoResultException`, 2건 이상이면 `NonUniqueResultException`이 발생한다. Spring Data JPA의 `Optional` 반환이 더 안전하다.
{{< /callout >}}

### 2.5 파라미터 바인딩

```java
// 이름 기준 (권장)
em.createQuery(
    "SELECT m FROM Member m WHERE m.username = :name",
    Member.class)
  .setParameter("name", "kim")
  .getResultList();

// 위치 기준
em.createQuery(
    "SELECT m FROM Member m WHERE m.username = ?1",
    Member.class)
  .setParameter(1, "kim")
  .getResultList();
```

{{< callout type="warning" >}}
파라미터 바인딩 없이 문자열을 직접 연결하면 **SQL 인젝션** 공격에 취약해진다. 반드시 파라미터 바인딩을 사용하자.
{{< /callout >}}

---

## 3. 프로젝션

SELECT 절에 조회할 대상을 지정하는 것을 프로젝션(projection)이라 한다.

### 3.1 프로젝션 종류

| 종류 | 예시 | 영속성 관리 |
|:-----|:-----|:-----------|
| 엔티티 | `SELECT m FROM Member m` | O |
| 임베디드 타입 | `SELECT m.address FROM Member m` | X |
| 스칼라 타입 | `SELECT m.username FROM Member m` | X |

### 3.2 여러 값 조회와 NEW 명령어

```java
// Object[] 로 조회 (번거로움)
List<Object[]> list = em.createQuery(
    "SELECT m.username, m.age FROM Member m")
    .getResultList();

for (Object[] row : list) {
    String username = (String) row[0];
    Integer age = (Integer) row[1];
}
```

```java
// NEW 명령어로 DTO 직접 매핑 (권장)
List<MemberDTO> list = em.createQuery(
    "SELECT new jpabook.dto.MemberDTO(m.username, m.age) " +
    "FROM Member m", MemberDTO.class)
    .getResultList();
```

{{< callout type="info" >}}
NEW 명령어 사용 조건:
1. **패키지명을 포함한 전체 클래스명**을 입력해야 한다
2. 순서와 타입이 일치하는 **생성자**가 필요하다
{{< /callout >}}

---

## 4. 페이징, 집합, 정렬

### 4.1 페이징 API

```java
em.createQuery("SELECT m FROM Member m ORDER BY m.age DESC",
    Member.class)
  .setFirstResult(10)  // 시작 위치 (0부터)
  .setMaxResults(20)   // 조회할 데이터 수
  .getResultList();
```

JPA가 데이터베이스 방언(Dialect)에 따라 적절한 SQL로 변환한다.

### 4.2 집합 함수

| 함수 | 반환 타입 | 설명 |
|:-----|:---------|:-----|
| `COUNT` | Long | 결과 수 |
| `MAX`, `MIN` | 해당 타입 | 최대, 최소 |
| `AVG` | Double | 평균 (숫자만) |
| `SUM` | Long/Double | 합계 (숫자만) |

```java
// 통계 쿼리 예시
Long count = em.createQuery(
    "SELECT COUNT(m) FROM Member m", Long.class)
    .getSingleResult();

Double avgAge = em.createQuery(
    "SELECT AVG(m.age) FROM Member m", Double.class)
    .getSingleResult();
```

---

## 5. JPQL 조인

### 5.1 조인 종류

```java
// 내부 조인
SELECT m FROM Member m
  INNER JOIN m.team t
  WHERE t.name = '팀A'

// 외부 조인
SELECT m FROM Member m
  LEFT JOIN m.team t

// 세타 조인 (WHERE 절, 내부 조인만)
SELECT COUNT(m) FROM Member m, Team t
  WHERE m.username = t.name
```

{{< callout type="info" >}}
JPQL 조인은 SQL과 달리 **연관 필드**를 사용한다. `m.team`처럼 연관관계로 정의된 필드를 통해 조인한다. `FROM Member m JOIN Team t ON m.team_id = t.id` 같은 SQL 스타일 조인은 문법 오류가 발생한다.
{{< /callout >}}

### 5.2 페치 조인 (가장 중요)

페치 조인은 SQL 한 번으로 **연관 엔티티를 함께 조회**하는 JPQL 전용 기능이다. 성능 최적화에 핵심적인 역할을 한다.

```
┌──────────────────────────────┐
│    일반 조인 vs 페치 조인      │
├──────────────────────────────┤
│ 일반 조인:                    │
│  Member만 조회               │
│  Team은 프록시 (LAZY)         │
│  Team 접근 시 추가 SQL 발생    │
│                              │
│ 페치 조인:                    │
│  Member + Team 함께 조회      │
│  Team은 실제 엔티티            │
│  추가 SQL 없음                │
└──────────────────────────────┘
```

```java
// 페치 조인 문법
SELECT m FROM Member m JOIN FETCH m.team
```

```java
// N+1 문제 발생 (LAZY 로딩)
List<Member> members = em.createQuery(
    "SELECT m FROM Member m", Member.class)
    .getResultList();

// 회원마다 팀 접근 시 SQL 추가 실행 → N+1 문제!
for (Member m : members) {
    System.out.println(m.getTeam().getName());
}
```

```java
// 페치 조인으로 해결 (SQL 1번)
List<Member> members = em.createQuery(
    "SELECT m FROM Member m JOIN FETCH m.team",
    Member.class)
    .getResultList();

// 이미 실제 엔티티가 로딩됨 → 추가 SQL 없음
for (Member m : members) {
    System.out.println(m.getTeam().getName());
}
```

#### 실행 SQL 비교

```sql
-- 페치 조인 실행 SQL
SELECT M.*, T.*
FROM MEMBER M
INNER JOIN TEAM T ON M.TEAM_ID = T.ID
```

#### 컬렉션 페치 조인과 DISTINCT

```java
// 일대다 페치 조인 시 데이터 중복 발생
SELECT t FROM Team t JOIN FETCH t.members

// DISTINCT로 중복 제거
SELECT DISTINCT t FROM Team t JOIN FETCH t.members
```

{{< callout type="info" >}}
JPQL의 `DISTINCT`는 두 가지 역할을 한다:
1. SQL에 `DISTINCT`를 추가한다
2. **애플리케이션에서** 같은 엔티티의 중복을 한 번 더 제거한다
{{< /callout >}}

#### 페치 조인의 한계

| 제약 | 설명 |
|:-----|:-----|
| 별칭 사용 불가 | 페치 조인 대상에 별칭을 줄 수 없다 (표준) |
| 컬렉션 2개 이상 페치 불가 | 카테시안 곱 발생, `MultipleBagFetchException` |
| 컬렉션 페치 + 페이징 불가 | 메모리에서 페이징 → OOM 위험 |

```
┌──────────────────────────────┐
│   페치 조인 vs 글로벌 전략     │
├──────────────────────────────┤
│ 글로벌 로딩 전략:              │
│  @ManyToOne(fetch=LAZY)      │
│  → 애플리케이션 전체에 영향     │
│                              │
│ 페치 조인:                    │
│  JOIN FETCH                  │
│  → 해당 쿼리에만 적용          │
│  → 글로벌 전략보다 우선        │
├──────────────────────────────┤
│ 권장: 글로벌 LAZY +           │
│       필요 시 페치 조인        │
└──────────────────────────────┘
```

{{< callout type="warning" >}}
**실무 권장**: 모든 연관관계를 `LAZY`로 설정하고, 필요한 곳에서만 페치 조인을 사용하자. 모든 것을 페치 조인으로 해결할 수 없다면, 여러 테이블에서 필요한 필드만 조회해서 **DTO로 반환**하는 것이 더 효과적이다.
{{< /callout >}}

---

## 6. 경로 표현식

`.`(점)을 찍어 객체 그래프를 탐색하는 것이다.

### 6.1 경로 표현식 분류

```java
SELECT m.username   // 상태 필드
  FROM Member m
  JOIN m.team t     // 단일 값 연관 필드
  JOIN m.orders o   // 컬렉션 값 연관 필드
```

| 종류 | 예시 | 탐색 가능 | 묵시적 조인 |
|:-----|:-----|:---------|:-----------|
| 상태 필드 | `m.username` | 탐색 끝 | X |
| 단일 값 연관 | `m.team` | 계속 가능 | O (내부 조인) |
| 컬렉션 값 연관 | `t.members` | 탐색 끝 | O (내부 조인) |

### 6.2 묵시적 조인 주의

```java
// 묵시적 조인 발생 (SQL에서 INNER JOIN)
SELECT m.team.name FROM Member m

// 명시적 조인 권장 (제어 가능)
SELECT t.name FROM Member m JOIN m.team t
```

{{< callout type="warning" >}}
묵시적 조인은 **항상 내부 조인**이고, SQL의 FROM 절에 영향을 주므로 파악하기 어렵다. **명시적 조인을 사용**하는 것이 유지보수에 좋다.
{{< /callout >}}

### 6.3 컬렉션 경로 탐색

```java
// 컬렉션에서 바로 경로 탐색 → 오류!
SELECT t.members.username FROM Team t

// 조인으로 별칭을 얻어서 탐색 → 정상
SELECT m.username FROM Team t JOIN t.members m
```

---

## 7. 서브 쿼리

```java
// 나이가 평균보다 많은 회원
SELECT m FROM Member m
WHERE m.age > (SELECT AVG(m2.age) FROM Member m2)

// 팀A 소속인 회원 (EXISTS)
SELECT m FROM Member m
WHERE EXISTS (
    SELECT t FROM m.team t WHERE t.name = '팀A'
)
```

### 서브 쿼리 함수

| 함수 | 설명 |
|:-----|:-----|
| `EXISTS` | 서브쿼리에 결과가 존재하면 참 |
| `ALL` | 모든 조건을 만족하면 참 |
| `ANY` / `SOME` | 하나라도 만족하면 참 |
| `IN` | 결과 중 하나라도 같으면 참 |

{{< callout type="info" >}}
JPQL 서브 쿼리는 **WHERE, HAVING 절**에서만 사용 가능하다. SELECT, FROM 절에서는 사용할 수 없다. (하이버네이트 HQL은 SELECT 절도 허용)
{{< /callout >}}

---

## 8. 조건식과 함수

### 8.1 CASE 식

```sql
-- 기본 CASE
SELECT
    CASE WHEN m.age <= 10 THEN '학생요금'
         WHEN m.age >= 60 THEN '경로요금'
         ELSE '일반요금'
    END
FROM Member m

-- COALESCE (null이 아닌 첫 번째 값)
SELECT COALESCE(m.username, '이름 없음')
FROM Member m

-- NULLIF (두 값이 같으면 null)
SELECT NULLIF(m.username, '관리자')
FROM Member m
```

### 8.2 주요 함수

| 분류 | 함수 |
|:-----|:-----|
| 문자 | `CONCAT`, `SUBSTRING`, `TRIM`, `LOWER`, `UPPER`, `LENGTH`, `LOCATE` |
| 수학 | `ABS`, `SQRT`, `MOD`, `SIZE`, `INDEX` |
| 날짜 | `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP` |

---

## 9. 다형성 쿼리

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "DTYPE")
public abstract class Item { ... }

@Entity @DiscriminatorValue("B")
public class Book extends Item { ... }
```

```sql
-- TYPE: 특정 자식 타입만 조회
SELECT i FROM Item i
WHERE TYPE(i) IN (Book, Movie)

-- TREAT: 부모를 자식 타입으로 캐스팅 (JPA 2.1)
SELECT i FROM Item i
WHERE TREAT(i AS Book).author = 'kim'
```

---

## 10. Named 쿼리 (정적 쿼리)

미리 정의한 쿼리에 이름을 부여해서 재사용한다. 애플리케이션 로딩 시점에 **문법 체크 + 파싱**이 이루어진다.

```java
@Entity
@NamedQuery(
    name = "Member.findByUsername",
    query = "SELECT m FROM Member m " +
            "WHERE m.username = :username")
public class Member { ... }

// 사용
List<Member> members = em.createNamedQuery(
    "Member.findByUsername", Member.class)
    .setParameter("username", "kim")
    .getResultList();
```

{{< callout type="info" >}}
Named 쿼리 이름에 `Member.findByUsername`처럼 엔티티 이름을 접두사로 붙이면 충돌을 방지할 수 있고 관리하기 쉽다.
{{< /callout >}}

---

## 11. 엔티티 직접 사용

JPQL에서 엔티티를 직접 사용하면 SQL에서는 **기본 키 값**을 사용한다.

```java
// 엔티티 직접 사용 (둘 다 같은 SQL)
SELECT COUNT(m) FROM Member m
SELECT COUNT(m.id) FROM Member m
```

```sql
-- 실행 SQL (동일)
SELECT COUNT(m.id) FROM MEMBER m
```

---

## 12. Criteria

JPQL을 **자바 코드**로 작성하는 빌더 API다. 컴파일 시점에 오류를 잡을 수 있지만, 코드가 복잡하다.

### 12.1 기본 사용

```java
// JPQL: SELECT m FROM Member m
//       WHERE m.username = '회원1'
//       ORDER BY m.age DESC

CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<Member> cq = cb.createQuery(Member.class);

Root<Member> m = cq.from(Member.class);

cq.select(m)
  .where(cb.equal(m.get("username"), "회원1"))
  .orderBy(cb.desc(m.get("age")));

List<Member> result = em.createQuery(cq).getResultList();
```

### 12.2 Criteria 장단점

| 장점 | 단점 |
|:-----|:-----|
| 컴파일 시점 오류 감지 | 코드가 복잡하고 장황 |
| IDE 자동완성 지원 | 직관적이지 않음 |
| 동적 쿼리 안전하게 생성 | JPQL 파악이 어려움 |

---

## 13. QueryDSL

JPQL을 **직관적인 코드**로 작성하는 빌더 프레임워크다. Criteria의 장점은 유지하면서 단순하고 사용하기 쉽다.

### 13.1 기본 사용

```java
JPAQuery query = new JPAQuery(em);
QMember m = QMember.member;

List<Member> members = query
    .from(m)
    .where(m.name.eq("회원1"))
    .orderBy(m.name.desc())
    .list(m);
```

### 13.2 검색 조건

```java
QItem item = QItem.item;

List<Item> list = query
    .from(item)
    .where(item.name.eq("좋은상품")
        .and(item.price.gt(20000)))
    .list(item);
```

### 13.3 조인과 페치 조인

```java
QOrder order = QOrder.order;
QMember member = QMember.member;

// 페치 조인
query.from(order)
     .innerJoin(order.member, member).fetch()
     .list(order);
```

### 13.4 동적 쿼리

```java
BooleanBuilder builder = new BooleanBuilder();

if (name != null) {
    builder.and(item.name.contains(name));
}
if (price != null) {
    builder.and(item.price.gt(price));
}

query.from(item)
     .where(builder)
     .list(item);
```

### 13.5 DTO 프로젝션

```java
// 프로퍼티 접근 (Setter)
List<ItemDTO> result = query.from(item)
    .list(Projections.bean(ItemDTO.class,
        item.name.as("username"),
        item.price));

// 생성자 사용
List<ItemDTO> result = query.from(item)
    .list(Projections.constructor(ItemDTO.class,
        item.name, item.price));
```

### Criteria vs QueryDSL 비교

```java
// Criteria - 복잡하고 장황
CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<Member> cq = cb.createQuery(Member.class);
Root<Member> m = cq.from(Member.class);
cq.select(m)
  .where(cb.equal(m.get("username"), "kim"))
  .orderBy(cb.desc(m.get("age")));

// QueryDSL - 직관적이고 간결
QMember m = QMember.member;
query.from(m)
     .where(m.username.eq("kim"))
     .orderBy(m.age.desc())
     .list(m);
```

---

## 14. 네이티브 SQL

JPA에서 **SQL을 직접 작성**할 수 있는 기능이다. JPQL로 해결할 수 없는 특정 DB 종속 기능이 필요할 때 사용한다.

```java
// 엔티티 조회 (영속성 컨텍스트에서 관리됨)
List<Member> members = em.createNativeQuery(
    "SELECT ID, AGE, NAME, TEAM_ID " +
    "FROM MEMBER WHERE AGE > ?",
    Member.class)
    .setParameter(1, 20)
    .getResultList();
```

{{< callout type="warning" >}}
네이티브 SQL로 조회한 엔티티도 **영속성 컨텍스트에서 관리**된다. 하지만 특정 DB에 종속되므로 최대한 JPQL을 사용하고, 그래도 안 되면 네이티브 SQL을 사용하자.
{{< /callout >}}

---

## 15. 벌크 연산

수백 건 이상의 엔티티를 **한 번에 수정/삭제**할 때 사용한다.

```java
// 재고 10개 미만인 상품 가격 10% 인상
int count = em.createQuery(
    "UPDATE Product p " +
    "SET p.price = p.price * 1.1 " +
    "WHERE p.stockAmount < :stock")
    .setParameter("stock", 10)
    .executeUpdate();
```

### 벌크 연산의 주의점

벌크 연산은 **영속성 컨텍스트를 무시**하고 DB에 직접 쿼리한다.

```
┌──────────────────────────────┐
│   벌크 연산 주의사항           │
├──────────────────────────────┤
│ 영속성 컨텍스트               │
│  └─ price = 1000 (옛 값)     │
│                              │
│ DB (벌크 연산 후)             │
│  └─ price = 1100 (새 값)     │
│                              │
│ → 데이터 불일치 발생!          │
└──────────────────────────────┘
```

### 해결 방법

| 방법 | 설명 |
|:-----|:-----|
| 벌크 연산을 먼저 실행 | 영속성 컨텍스트에 데이터가 없는 상태에서 실행 |
| 벌크 연산 후 `em.clear()` | 영속성 컨텍스트를 초기화하여 이후 DB에서 재조회 |
| `em.refresh()` 사용 | 특정 엔티티를 DB에서 다시 조회 |

```java
// 가장 실용적인 패턴
int count = em.createQuery(
    "UPDATE Product p SET p.price = p.price * 1.1")
    .executeUpdate();

em.clear();  // 영속성 컨텍스트 초기화

// 이후 조회 시 DB에서 새로운 값을 가져옴
Product product = em.find(Product.class, productId);
```

---

## 16. 영속성 컨텍스트와 JPQL

### 16.1 JPQL 조회 결과와 영속성 컨텍스트

JPQL로 조회한 엔티티가 영속성 컨텍스트에 **이미 존재하면**, DB에서 조회한 결과를 버리고 **기존 엔티티를 반환**한다.

```
┌──────────────────────────────┐
│ JPQL 조회 동작 흐름            │
├──────────────────────────────┤
│  1. JPQL → SQL 변환           │
│  2. DB에서 데이터 조회         │
│  3. 영속성 컨텍스트에           │
│     같은 PK의 엔티티 존재?     │
│     ├─ NO  → 새로 등록        │
│     └─ YES → DB 결과 버림     │
│              기존 엔티티 반환   │
└──────────────────────────────┘
```

{{< callout type="info" >}}
**왜 기존 엔티티를 반환할까?** 영속성 컨텍스트에 수정 중인 데이터가 있을 수 있다. 새로운 데이터로 대체하면 수정 중인 내용이 사라져 위험하다. **엔티티 동일성(identity)** 보장이 더 중요하기 때문이다.
{{< /callout >}}

### 16.2 find() vs JPQL

| 항목 | `em.find()` | JPQL |
|:-----|:-----------|:-----|
| 1차 캐시 조회 | O (먼저 확인) | X (항상 DB 먼저) |
| DB 조회 | 1차 캐시에 없을 때만 | 항상 |
| 동일성 보장 | O | O |

```java
// em.find() - 두 번째는 1차 캐시에서 반환
Member m1 = em.find(Member.class, 1L);  // DB 조회
Member m2 = em.find(Member.class, 1L);  // 1차 캐시

// JPQL - 매번 DB 조회, 하지만 같은 인스턴스 반환
Member m1 = em.createQuery(
    "SELECT m FROM Member m WHERE m.id = :id",
    Member.class)
    .setParameter("id", 1L)
    .getSingleResult();  // DB 조회

Member m2 = em.createQuery(
    "SELECT m FROM Member m WHERE m.id = :id",
    Member.class)
    .setParameter("id", 1L)
    .getSingleResult();  // DB 조회 (항상)

// m1 == m2 → true (동일성 보장)
```

---

## 17. 플러시 모드

```java
// AUTO (기본값) - 커밋 또는 쿼리 실행 직전에 플러시
em.setFlushMode(FlushModeType.AUTO);

// COMMIT - 커밋 시에만 플러시
em.setFlushMode(FlushModeType.COMMIT);
```

| 모드 | 플러시 시점 | 용도 |
|:-----|:-----------|:-----|
| `AUTO` | 커밋 전 + 쿼리 전 | 기본값, 안전 |
| `COMMIT` | 커밋 전에만 | 성능 최적화 (주의 필요) |

{{< callout type="warning" >}}
`COMMIT` 모드는 쿼리 전에 플러시하지 않으므로, 영속성 컨텍스트의 변경 사항이 **쿼리 결과에 반영되지 않을 수 있다**. 데이터 무결성을 위해 기본값(`AUTO`)을 사용하는 것이 안전하다.
{{< /callout >}}

---

## 18. JDBC/MyBatis와 함께 사용

JPA를 우회해서 SQL을 직접 실행할 때는 **영속성 컨텍스트와 DB의 동기화**에 주의해야 한다.

```java
// JPA를 우회하기 전에 수동 플러시
em.flush();

// JDBC 직접 사용
Session session = em.unwrap(Session.class);
session.doWork(connection -> {
    // JDBC 작업 ...
});
```

---

## 19. 핵심 요약

| 개념 | 핵심 |
|:-----|:-----|
| JPQL | 엔티티 대상 객체지향 쿼리, SQL로 변환됨 |
| 페치 조인 | N+1 문제 해결, 성능 최적화의 핵심 |
| 경로 표현식 | 묵시적 조인 주의, 명시적 조인 권장 |
| QueryDSL | Criteria 대안, 직관적이고 동적 쿼리에 강함 |
| 네이티브 SQL | 최후 수단, 영속성 컨텍스트 관리됨 |
| 벌크 연산 | 영속성 컨텍스트 무시, 실행 후 `em.clear()` |
| 플러시 모드 | AUTO가 기본, COMMIT은 최적화용 |

```
┌──────────────────────────────┐
│     쿼리 기술 선택 가이드       │
├──────────────────────────────┤
│ 1. JPQL로 가능?               │
│    └─ YES → JPQL 사용         │
│                              │
│ 2. 동적 쿼리 필요?            │
│    └─ YES → QueryDSL 사용    │
│                              │
│ 3. DB 종속 기능 필요?         │
│    └─ YES → 네이티브 SQL      │
│                              │
│ 4. 그래도 부족?               │
│    └─ JDBC / MyBatis 병행     │
└──────────────────────────────┘
```
