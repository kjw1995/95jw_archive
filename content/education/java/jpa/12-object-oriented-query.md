---
title: "Chapter 12. 객체지향 쿼리 언어"
date: 2026-03-03
weight: 12
---

[Chapter 02](../02-jpa-start)에서 JPQL을 잠깐 봤고, [Chapter 10](../10-proxy-loading)에서는 "연관관계는 전부 지연 로딩으로 두고 필요한 곳에서 페치 조인하라"고 했다. 이 장은 그 페치 조인을 포함해 JPA에서 데이터를 **찾는** 모든 방법을 다룬다. JPQL이 왜 필요하고 SQL과 어디가 다른지, 페치 조인이 왜 성능의 핵심이며 그 한계는 왜 생기는지, JPQL을 코드로 쓰는 도구가 왜 나왔는지, 그리고 쿼리가 영속성 컨텍스트와 어떻게 얽히는지. `find()`로는 기본 키 하나만 찾을 수 있으니, 나머지 모든 조회는 결국 이 장의 이야기다.

---

## 1. 쿼리 기술 한눈에

```
JPQL (표준, 문자열로 쓴다)
 ├── Criteria  (표준, 코드로 JPQL 생성)
 └── QueryDSL  (외부, 코드로 JPQL 생성)
네이티브 SQL (JPA 안에서 SQL 직접)
JDBC · MyBatis (JPA 밖에서 SQL 직접)
```

| 기술 | 무엇인가 | 언제 |
|:-----|:---------|:-----|
| JPQL | 엔티티를 대상으로 하는 표준 쿼리 언어 | 기본. 대부분의 조회 |
| Criteria | JPQL을 자바 코드로 만드는 표준 API | 동적 쿼리. 그러나 장황하다 |
| QueryDSL | JPQL을 자바 코드로 만드는 외부 라이브러리 | 동적 쿼리. 실무의 선택 |
| 네이티브 SQL | JPA를 통해 SQL을 직접 실행 | DB 고유 기능이 필요할 때 |
| JDBC, MyBatis | JPA 밖에서 SQL 실행 | JPA로 풀기 어려운 복잡한 조회 |

가운데 있는 것은 JPQL이다. Criteria와 QueryDSL은 결국 **JPQL 문자열을 만들어 주는 도구**이고, 네이티브 SQL은 JPQL로 안 될 때의 탈출구다. JPQL을 모르면 나머지도 쓸 수 없다.

---

## 2. JPQL: 엔티티에게 묻는 SQL

### 2.1 SQL과 무엇이 같고 다른가

```sql
-- SQL: 테이블과 컬럼에게 묻는다
SELECT * FROM MEMBER WHERE NAME = 'kim'
```

```java
// JPQL: 엔티티와 필드에게 묻는다
select m from Member m where m.username = 'kim'
```

문법은 SQL과 거의 같다. 다른 것은 **대상**이다. [Chapter 01](../01-jpa-intro)에서 봤듯 JPQL은 테이블 이름과 컬럼 이름을 모른다. 엔티티 이름과 필드 이름만 알고, 매핑 정보를 통해 SQL로 번역된다. 그래서 테이블 이름이 바뀌어도 JPQL은 그대로다.

| 규칙 | 내용 | 이유 |
|:-----|:-----|:-----|
| 대소문자 | `Member`, `m.username`은 구분. `select`, `from`은 구분하지 않음 | 엔티티와 필드는 자바 식별자고, 키워드는 SQL 관례를 따른다 |
| 엔티티 이름 | `@Entity(name = ...)`, 기본은 클래스 이름 | 테이블 이름이 아니다. 7장의 이름 분리 |
| 별칭 | `Member m`처럼 반드시 붙인다 | 엔티티를 변수처럼 다루어 `m.username`으로 필드에 접근한다 |
| INSERT | 없다 | 저장은 `persist()`의 일이다. JPQL은 조회와 8절의 벌크 연산만 한다 |

### 2.2 실행하고 결과 받기

```java
// 반환 타입이 분명하면 TypedQuery
TypedQuery<Member> query = em.createQuery("select m from Member m", Member.class);
List<Member> members = query.getResultList();

// 여러 값을 섞어 조회하면 Query. 결과는 Object[]
Query query2 = em.createQuery("select m.username, m.age from Member m");
for (Object row : query2.getResultList()) {
    Object[] cols = (Object[]) row;
    String username = (String) cols[0];
    Integer age = (Integer) cols[1];
}
```

| 메서드 | 결과 | 0건이면 | 2건 이상이면 |
|:-------|:-----|:--------|:-------------|
| `getResultList()` | 목록 | 빈 목록 | 목록 |
| `getSingleResult()` | 한 건 | `NoResultException` | `NonUniqueResultException` |
| `getSingleResultOrNull()` | 한 건 또는 `null` | `null` | `NonUniqueResultException` |

`getSingleResult()`가 0건에 예외를 던지는 것은 "정확히 한 건이 있어야 한다"는 뜻을 강제하기 위해서인데, 실무에서는 없을 수도 있는 한 건을 찾는 경우가 더 많아 늘 불편했다. Jakarta Persistence 3.2가 `getSingleResultOrNull()`을 추가해 이 불편을 해소했다. 스프링 데이터 JPA의 `Optional` 반환도 같은 문제에 대한 답이다.

```java
// 이름 기준 바인딩. 이쪽을 쓴다
em.createQuery("select m from Member m where m.username = :name", Member.class)
  .setParameter("name", "kim")
  .getResultList();

// 위치 기준 바인딩
em.createQuery("select m from Member m where m.username = ?1", Member.class)
  .setParameter(1, "kim")
  .getResultList();
```

파라미터는 반드시 바인딩한다. `"... where m.username = '" + name + "'"`처럼 문자열을 이어 붙이면 SQL 인젝션에 열리고, 값이 바뀔 때마다 다른 SQL이 만들어져 DB가 실행 계획을 재사용하지 못한다. [Chapter 05](../05-persistence-features)에서 UPDATE 문을 고정해 재사용하던 것과 같은 논리다.

### 2.3 프로젝션: 무엇을 돌려받는가

SELECT 절에 무엇을 적느냐를 **프로젝션**이라 한다.

| 프로젝션 | 예 | 결과의 상태 |
|:---------|:---|:------------|
| 엔티티 | `select m from Member m` | 영속. 컨텍스트가 관리한다 |
| 임베디드 타입 | `select m.address from Member m` | 값. 관리되지 않는다 |
| 스칼라 | `select m.username from Member m` | 값. 관리되지 않는다 |

엔티티만 영속 상태로 돌아온다. 이유는 [Chapter 11](../11-value-types)에서 본 그대로다. 식별자가 있는 것만 영속성 컨텍스트에 들어갈 수 있고, 임베디드 타입과 스칼라 값에는 식별자가 없다. 조회한 주소 객체의 값을 바꿔도 UPDATE가 나가지 않는 이유가 이것이다.

여러 값을 조회할 때 `Object[]`를 캐스팅하는 대신 DTO로 바로 받을 수 있다.

```java
List<MemberDTO> result = em.createQuery(
        "select new jpabook.dto.MemberDTO(m.username, m.age) from Member m",
        MemberDTO.class)
    .getResultList();
```

`new` 뒤에는 **패키지를 포함한 전체 클래스 이름**을 적고, 그 순서와 타입에 맞는 생성자가 있어야 한다. JPQL은 자바 파일이 아니라 문자열이라 import를 모르기 때문이다. 화면에 필요한 값만 골라 담는 이 방식은 4.4절에서 페치 조인의 대안으로 다시 나온다.

### 2.4 페이징, 정렬, 집합

```java
em.createQuery("select m from Member m order by m.age desc", Member.class)
  .setFirstResult(10)    // 0부터 센다
  .setMaxResults(20)
  .getResultList();
```

페이징 SQL은 DB마다 다르다는 것을 [Chapter 01](../01-jpa-intro)에서 봤다. JPQL에서는 두 메서드로 의도만 말하고, 방언이 `LIMIT`이든 `OFFSET ... FETCH`든 알아서 만든다.

| 함수 | 반환 | 비고 |
|:-----|:-----|:-----|
| `count(m)` | `Long` | 결과 수 |
| `max(m.age)`, `min(m.age)` | 필드 타입 | |
| `avg(m.age)` | `Double` | 숫자만 |
| `sum(m.age)` | 정수면 `Long`, 실수면 `Double` | 숫자만 |

---

## 3. 조인

### 3.1 연관 필드로 조인한다

```java
// 내부 조인
select m from Member m join m.team t where t.name = '팀A'

// 외부 조인
select m from Member m left join m.team t

// 세타 조인: 연관관계가 없는 엔티티를 WHERE로 묶는다
select count(m) from Member m, Team t where m.username = t.name
```

SQL 조인에는 `ON M.TEAM_ID = T.ID`가 필요하지만 JPQL에는 없다. `join m.team`이라고 쓰면 끝이다. JPQL은 `Member.team`이 어떤 외래 키로 매핑되어 있는지 이미 알고 있으므로 조인 조건을 다시 말할 이유가 없다. 이것이 JPQL 조인이 **연관 필드**를 대상으로 하는 이유다. 연관관계가 없는 두 엔티티를 임의의 조건으로 묶어야 할 때만 세타 조인이나 `join Team t on m.username = t.name` 같은 `ON` 절 조인을 쓴다.

### 3.2 경로 표현식과 묵시적 조인

`.`으로 객체 그래프를 따라가는 것을 **경로 표현식**이라 한다. 어디까지 갈 수 있는지는 필드의 종류가 정한다.

| 종류 | 예 | 더 탐색할 수 있나 | SQL |
|:-----|:---|:------------------|:----|
| 상태 필드 | `m.username` | 끝 | 컬럼 |
| 단일 값 연관 필드 | `m.team` | `m.team.name`처럼 계속 | 묵시적 내부 조인 |
| 컬렉션 값 연관 필드 | `t.members` | 끝. 별칭을 얻어야 계속 | 묵시적 내부 조인 |

```java
select m.team.name from Member m          // 묵시적 조인. SQL에는 JOIN TEAM이 숨어 있다
select t.name from Member m join m.team t // 명시적 조인. 같은 SQL이지만 눈에 보인다

select t.members.username from Team t     // 오류. 컬렉션에서 바로 필드로 못 간다
select m.username from Team t join t.members m   // 별칭을 얻으면 된다
```

`m.team.name`처럼 연관 필드를 지나가면 JPQL은 조인을 **몰래** 만든다. 편해 보이지만 두 가지 이유로 명시적 조인이 낫다. 묵시적 조인은 언제나 내부 조인이라 팀이 없는 회원이 결과에서 조용히 빠지고, JPQL만 봐서는 SQL에 조인이 몇 개 붙는지 알기 어렵다. 컬렉션 경로에서 탐색이 막히는 것도 같은 맥락이다. `t.members`는 행 여러 개인데 그중 누구의 `username`인지 정할 수 없으니, 조인으로 별칭을 얻어 행 하나를 가리키게 해야 한다.

---

## 4. 페치 조인

### 4.1 일반 조인과 무엇이 다른가

```
[일반 조인] join m.team t
  SQL: SELECT M.* ... JOIN TEAM T
  결과: Member만. team은 프록시

[페치 조인] join fetch m.team
  SQL: SELECT M.*, T.* ... JOIN TEAM T
  결과: Member + Team. 추가 SQL 없음
```

`select m from Member m join m.team t`는 팀과 조인하지만 SELECT 절에는 `m`만 있다. SQL도 `MEMBER` 컬럼만 가져오고, 돌아온 회원의 `team`에는 여전히 프록시가 들어 있다. 조인은 **어느 행을 고를지**에만 관여했을 뿐 **무엇을 채울지**에는 관여하지 않은 것이다.

`join fetch`는 그 두 번째 역할을 추가한다. "조인하고, 조인한 상대도 결과에 채워라." SQL의 SELECT 절에 `TEAM` 컬럼이 함께 들어가고, 돌아온 회원의 `team`은 실제 엔티티다. JPQL에만 있고 SQL에는 없는 기능이며, 10장에서 미뤄 둔 "필요한 곳에서만 즉시 로딩"을 실현하는 도구다.

### 4.2 N+1을 없앤다

```
select m from Member m
  → SELECT 1번: 회원 N명
for (Member m : members)
    m.getTeam().getName()
  → SELECT N번: 팀 하나씩
합계 N + 1
```

```java
// 지연 로딩만 있을 때: 회원 100명이면 SQL 101개
List<Member> members = em.createQuery("select m from Member m", Member.class)
                         .getResultList();
for (Member m : members) {
    m.getTeam().getName();   // 회원마다 팀 SELECT
}

// 페치 조인: SQL 1개
List<Member> members = em.createQuery(
        "select m from Member m join fetch m.team", Member.class)
    .getResultList();
for (Member m : members) {
    m.getTeam().getName();   // 이미 채워져 있다
}
```

10장에서 본 N+1의 해법이 이것이다. 이 화면에서 회원과 팀이 함께 필요하다는 사실을 아는 것은 JPQL을 쓰는 그 코드뿐이므로, 그 자리에서 페치 조인으로 함께 가져온다. 엔티티의 페치 전략은 건드리지 않는다.

### 4.3 컬렉션 페치 조인과 중복

```java
select t from Team t join fetch t.members
```

```
TEAM JOIN MEMBER (팀A에 회원 2명)
┌────────┬──────────┐
│ 팀A    │ 회원1    │
│ 팀A    │ 회원2    │
└────────┴──────────┘
→ SQL 결과는 2행, Team은 같은 인스턴스
```

일대다를 페치 조인하면 SQL 결과가 **회원 수만큼** 늘어난다. 조인의 결과 행은 팀과 회원의 쌍이므로 회원이 둘인 팀은 두 행이다. JPA는 이 두 행에서 같은 식별자의 팀을 보고 1차 캐시의 같은 인스턴스를 쓰지만, 목록에는 그 인스턴스가 두 번 들어간다.

Hibernate 5까지는 이 중복을 개발자가 `select distinct t ...`로 걸러야 했다. JPQL의 `distinct`가 SQL에 `DISTINCT`를 붙이는 것과 별개로 애플리케이션에서 같은 엔티티를 한 번만 남기는 일까지 했다. Hibernate 6부터는 **페치 조인으로 생긴 부모 엔티티의 중복을 항상 자동으로 제거**하므로 이 용도의 `distinct`는 필요 없어졌고, `distinct`를 쓰면 SQL로 그대로 전달된다. 예전 코드의 `distinct`를 지워도 결과는 같다.

### 4.4 한계와 그 이유

| 제약 | 이유 |
|:-----|:-----|
| 페치 조인 대상에 별칭을 주고 조건을 걸지 않는다 | 페치 조인은 객체 그래프를 **완성**하는 것이지 걸러내는 것이 아니다. `join fetch t.members m where m.age > 20`처럼 걸러 담으면 팀의 회원 컬렉션이 실제와 다른 불완전한 상태가 되고, 그 컬렉션을 기준으로 동작하는 변경 감지와 고아 객체 제거가 잘못된 SQL을 만든다 |
| 컬렉션 페치 조인은 하나까지 | 컬렉션 둘을 함께 조인하면 결과가 카테시안 곱이 된다. 10장에서 본 `MultipleBagFetchException`이 여기서도 난다 |
| 컬렉션 페치 조인에 페이징을 걸지 않는다 | SQL의 페이징은 행 단위인데 행은 회원 단위로 늘어나 있다. 팀 10개를 원해도 SQL은 회원 10행을 자른다. Hibernate는 이를 알고 페이징을 포기한 채 전부 읽어 메모리에서 자른다. 데이터가 많으면 그대로 메모리 부족이다 |

세 번째 제약은 실무에서 자주 부딪힌다. "팀 목록을 페이징하면서 각 팀의 회원도 보여 준다"는 요구는 흔하다. 이때의 대안이 **배치 사이즈**다.

```java
@BatchSize(size = 100)
@OneToMany(mappedBy = "team")
private List<Member> members = new ArrayList<>();
```

```properties
# 전역으로 켜는 편이 낫다
spring.jpa.properties.hibernate.default_batch_fetch_size=100
```

```sql
-- 팀 10개를 페이징으로 읽은 뒤 첫 팀의 members를 건드리면
SELECT * FROM MEMBER WHERE TEAM_ID IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

배치 사이즈는 지연 로딩을 그대로 두되, 프록시 컬렉션 하나를 초기화할 때 **컨텍스트에 있는 같은 종류의 다른 프록시들까지** IN 절 하나로 함께 채운다. 팀은 팀대로 페이징해 읽고(SQL 1개), 회원은 IN 절로 묶어 읽으니(SQL 1개) 합쳐서 두 개다. 페치 조인의 "한 방 쿼리"는 아니지만 N+1이 1+1이 되고 페이징도 그대로 동작한다.

{{< callout type="info" >}}
페치 조인으로도 배치 사이즈로도 부족하면 방법은 **DTO 프로젝션**이다. 엔티티 그래프를 통째로 가져오는 대신 화면에 필요한 컬럼만 `select new ...`로 뽑는다. 엔티티가 아니므로 페치 조인의 제약을 받지 않고, 조인과 페이징을 SQL처럼 자유롭게 쓸 수 있다. 대신 결과가 영속 상태가 아니니 조회 전용이다.
{{< /callout >}}

### 4.5 전역 전략과 페치 조인의 역할 분담

10장의 결론을 여기서 완성할 수 있다. 엔티티의 `fetch` 설정은 애플리케이션 **전체**에 적용되는 전역 전략이고, 페치 조인은 **그 쿼리 하나**에만 적용되며 전역 전략보다 우선한다. 전역은 전부 지연 로딩으로 두어 아무것도 불필요하게 읽지 않게 하고, 함께 써야 하는 화면의 JPQL에서만 페치 조인으로 가져온다. 어느 화면이 무엇을 함께 쓰는지는 엔티티가 아니라 그 화면의 쿼리가 안다.

---

## 5. 그 밖의 JPQL 문법

**서브쿼리.** WHERE와 HAVING 절에서 쓸 수 있다. JPQL 표준은 SELECT와 FROM 절의 서브쿼리를 허용하지 않지만 Hibernate의 HQL은 허용한다.

```java
select m from Member m where m.age > (select avg(m2.age) from Member m2)
select m from Member m where exists (select t from m.team t where t.name = '팀A')
```

**조건식.** SQL과 같은 `case`, `coalesce`, `nullif`를 쓴다.

```java
select case when m.age <= 10 then '학생요금'
            when m.age >= 60 then '경로요금'
            else '일반요금' end
from Member m

select coalesce(m.username, '이름 없음') from Member m
```

**함수.** 표준 함수는 방언이 DB에 맞게 번역한다.

| 분류 | 함수 |
|:-----|:-----|
| 문자 | `concat`, `substring`, `trim`, `lower`, `upper`, `length`, `locate` |
| 수학 | `abs`, `sqrt`, `mod`, `size`(컬렉션 크기) |
| 날짜 | `current_date`, `current_time`, `current_timestamp` |

**다형성 쿼리.** [Chapter 09](../09-advanced-mapping)의 상속 매핑과 짝을 이룬다. 부모 타입으로 조회하면 자식이 모두 나오고, `type()`으로 특정 자식만 고르거나 `treat()`로 자식 타입의 필드에 접근할 수 있다.

```java
select i from Item i where type(i) in (Book, Movie)
select i from Item i where treat(i as Book).author = 'kim'
```

**Named 쿼리.** 자주 쓰는 JPQL에 이름을 붙여 엔티티에 미리 정의한다. 문자열이 흩어지지 않는 것 외에 실질적인 이점이 하나 있다. 애플리케이션이 시작될 때 전부 **파싱해서 검증**하므로, 오타가 있으면 실행 시점이 아니라 시작 시점에 실패한다.

```java
@Entity
@NamedQuery(name = "Member.findByUsername",
            query = "select m from Member m where m.username = :username")
public class Member { ... }

em.createNamedQuery("Member.findByUsername", Member.class)
  .setParameter("username", "kim")
  .getResultList();
```

**엔티티 직접 사용.** JPQL에서 엔티티를 값처럼 쓰면 SQL에서는 그 엔티티의 **기본 키**가 쓰인다. `count(m)`은 `count(m.id)`가 되고, 파라미터로 엔티티를 넘기면 그 식별자로 비교한다.

```java
select count(m) from Member m                     // SQL: count(m.id)
select m from Member m where m.team = :team       // SQL: where m.team_id = ?
```

---

## 6. JPQL을 코드로 쓰기: Criteria와 QueryDSL

### 6.1 왜 문자열로는 부족한가

검색 화면에는 조건이 열 개쯤 있고 사용자는 그중 몇 개만 채운다. 채워진 조건만으로 JPQL을 만들려면 문자열을 조립해야 한다.

```java
String jpql = "select m from Member m where 1 = 1";
if (name != null) jpql += " and m.username = :name";
if (age != null)  jpql += " and m.age > :age";
// 파라미터도 같은 조건으로 나눠 바인딩해야 한다
```

이 코드는 오타를 실행해 봐야 알고, 조건이 늘수록 공백 하나에 무너진다. JPQL을 **자바 코드로 조립**하면 컴파일러와 IDE가 문법을 검사해 준다. 그것이 Criteria와 QueryDSL이 존재하는 이유이고, 둘 다 결국 JPQL을 만들어 실행한다.

### 6.2 Criteria: 표준이지만 장황하다

```java
// select m from Member m where m.username = '회원1' order by m.age desc
CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<Member> cq = cb.createQuery(Member.class);
Root<Member> m = cq.from(Member.class);

cq.select(m)
  .where(cb.equal(m.get("username"), "회원1"))
  .orderBy(cb.desc(m.get("age")));

List<Member> result = em.createQuery(cq).getResultList();
```

JPA 표준이라는 것이 유일한 장점이다. 한 줄짜리 JPQL이 여섯 줄이 되고, `m.get("username")`의 문자열은 여전히 컴파일러가 검사하지 못한다. 메타모델 클래스를 생성하면 `Member_.username`으로 바꿀 수 있지만, 그래도 만들어진 코드에서 원래 JPQL을 읽어 내기가 어렵다. 표준을 고집해야 하는 사정이 없다면 고를 이유가 적다.

### 6.3 QueryDSL: 실무의 선택

```java
JPAQueryFactory query = new JPAQueryFactory(em);
QMember m = QMember.member;

List<Member> members = query
    .selectFrom(m)
    .where(m.username.eq("회원1"))
    .orderBy(m.age.desc())
    .fetch();
```

JPQL과 거의 같은 순서로 읽히면서 전부 코드다. `m.username`은 `QMember`라는 **쿼리 타입** 클래스의 필드라서 이름을 틀리면 컴파일이 실패하고, 필드 타입에 맞는 조건 메서드만 자동 완성된다. 쿼리 타입은 어노테이션 프로세서가 엔티티에서 만들어 준다.

```java
// 동적 조건: 채워진 것만 붙인다
BooleanBuilder where = new BooleanBuilder();
if (name != null) where.and(m.username.contains(name));
if (age != null)  where.and(m.age.gt(age));

query.selectFrom(m).where(where).fetch();

// 페치 조인
query.selectFrom(m).join(m.team, t).fetchJoin().fetch();

// DTO 프로젝션
query.select(Projections.constructor(MemberDTO.class, m.username, m.age))
     .from(m)
     .fetch();
```

6.1절의 문자열 조립이 `BooleanBuilder` 몇 줄로 바뀐다. 이것이 QueryDSL이 동적 쿼리에서 사실상의 표준이 된 이유다.

{{< callout type="warning" >}}
원조 QueryDSL(`com.querydsl`)은 2021년 릴리스를 끝으로 사실상 멈춰 있고, 오래된 의존성 때문에 스프링 부트 3 이상과 함께 쓰기 어렵다. 현재는 OpenFeign이 이어받은 포크(`io.github.openfeign.querydsl`)가 활발히 유지되며 새 프로젝트는 이쪽을 쓴다. API는 같으므로 그룹 ID만 바뀐다. 옛 자료의 `new JPAQuery(em)`과 `.list()`는 구버전 API이고, 지금은 `JPAQueryFactory`와 `.fetch()`다.
{{< /callout >}}

---

## 7. 네이티브 SQL

```java
List<Member> members = em.createNativeQuery(
        "SELECT ID, AGE, NAME, TEAM_ID FROM MEMBER WHERE AGE > ?", Member.class)
    .setParameter(1, 20)
    .getResultList();
```

JPQL로 표현할 수 없는 것이 있다. DB 고유의 힌트, 윈도우 함수, 특정 DB에만 있는 함수 같은 것들이다. 이때 JPA를 버리지 않고 SQL을 직접 쓰는 것이 네이티브 SQL이다. 결과를 엔티티로 받으면 JPQL과 똑같이 **영속 상태**로 관리된다. JPA 입장에서는 SQL을 누가 썼느냐가 아니라 결과에 식별자가 있느냐가 중요하기 때문이다.

대가는 1장에서 벗어나려 했던 DB 종속이 그 쿼리에 그대로 박힌다는 것이다. 그래서 순서는 정해져 있다. JPQL로 되는지 먼저 보고, 안 되면 네이티브 SQL이다.

---

## 8. 벌크 연산

```java
int updated = em.createQuery(
        "update Product p set p.price = p.price * 1.1 where p.stockAmount < :stock")
    .setParameter("stock", 10)
    .executeUpdate();   // 영향받은 행 수
```

상품 만 개의 가격을 올리는 데 변경 감지를 쓰면 만 개를 조회해서 만 개의 UPDATE를 보낸다. 벌크 연산은 JPQL의 UPDATE와 DELETE를 SQL 한 문장으로 바로 실행한다.

빠른 대신 **영속성 컨텍스트를 거치지 않는다**는 점이 문제를 만든다.

```
컨텍스트: price = 1000 (조회 때 값)
     │
     │  UPDATE Product ... 실행
     │  (컨텍스트를 거치지 않는다)
     ▼
DB:       price = 1100
→ 둘이 어긋난다 → em.clear()
```

벌크 연산 전에 조회해 둔 상품이 컨텍스트에 있으면, 그 객체의 가격은 여전히 1000이다. DB는 1100이다. 이 상태에서 `find()`하면 1차 캐시가 먼저 답하므로 1000이 돌아온다. JPA가 틀린 것이 아니다. 벌크 연산은 컨텍스트가 모르는 곳에서 일어난 변경이고, [Chapter 05](../05-persistence-features)에서 본 대로 컨텍스트는 자기가 아는 것만 안다.

| 방법 | 설명 |
|:-----|:-----|
| 벌크 연산을 먼저 실행 | 컨텍스트에 아무것도 없을 때 실행하면 어긋날 것도 없다 |
| 벌크 연산 뒤 `em.clear()` | 컨텍스트를 비워 다음 조회가 DB를 보게 한다. 가장 실용적이다 |
| `em.refresh(entity)` | 특정 엔티티만 DB에서 다시 읽는다 |

```java
em.createQuery("update Product p set p.price = p.price * 1.1").executeUpdate();
em.clear();                                         // 컨텍스트 초기화
Product product = em.find(Product.class, 1L);       // DB에서 새 값
```

---

## 9. JPQL과 영속성 컨텍스트

JPQL은 항상 DB에 묻는다. 그래서 앞 장들에서 본 세 가지 규칙이 JPQL에 적용된다.

- **결과가 이미 컨텍스트에 있으면 컨텍스트의 인스턴스가 돌아온다.** DB에서 읽은 값은 버려진다. 식별자당 인스턴스 하나를 지키기 위해서이고, 그래서 JPQL로 같은 회원을 두 번 조회해도 `==`가 `true`다. [Chapter 05](../05-persistence-features) 1.3절.
- **JPQL 직전에 플러시가 일어난다.** 방금 `persist()`한 엔티티가 결과에서 빠지지 않게 하기 위해서다. 플러시 모드를 `COMMIT`으로 바꾸면 이 보장이 사라진다. [Chapter 06](../06-flush-and-detached) 1.4절.
- **JPA 밖에서 SQL을 실행할 때는 먼저 플러시한다.** JDBC나 MyBatis는 컨텍스트를 모르므로, 아직 안 나간 변경을 내보내지 않으면 옛 데이터를 읽는다.

```java
em.flush();                                   // 컨텍스트의 변경을 먼저 DB로
Session session = em.unwrap(Session.class);   // Hibernate API로 내려간다
session.doWork(connection -> {
    // JDBC로 직접 작업
});
```

---

## 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| JPQL | 엔티티와 필드를 대상으로 하는 SQL | 테이블 이름이 코드에서 사라진다 |
| 프로젝션 | 엔티티만 영속, 나머지는 값 | 식별자가 있어야 관리된다 |
| 조인 | 연관 필드로, `ON` 없이 | 매핑이 조인 조건을 이미 안다 |
| 묵시적 조인 | 피한다 | 항상 내부 조인이고 SQL이 숨는다 |
| 페치 조인 | 조인한 상대를 결과에 채운다 | 일반 조인은 행 선택에만 관여한다 |
| N+1 | 페치 조인으로 SQL 1개 | 함께 쓸지는 화면의 쿼리가 안다 |
| 컬렉션 페치 조인 | 중복은 Hibernate 6가 자동 제거. 페이징 금지 | 행이 자식 단위로 늘어난다 |
| 배치 사이즈 | 지연 로딩을 IN 절로 묶는다 | 컬렉션과 페이징을 함께 쓸 때 |
| Criteria, QueryDSL | JPQL을 코드로 조립 | 동적 쿼리의 문자열 조립을 컴파일 시점으로 |
| 네이티브 SQL | JPQL로 안 될 때의 탈출구 | 결과 엔티티는 똑같이 영속 |
| 벌크 연산 | SQL 한 문장, 실행 후 `clear()` | 컨텍스트를 거치지 않는다 |

```
JPQL로 되는가?      → JPQL
동적 조건이 많은가? → QueryDSL
DB 고유 기능인가?   → 네이티브 SQL
그래도 안 되는가?   → JDBC·MyBatis 병행
```
