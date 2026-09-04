---
title: "Chapter 01. JPA 소개"
date: 2025-12-17
weight: 1
---

JPA를 처음 접하면 "SQL을 안 써도 된다"는 말부터 듣는다. 반은 맞고 반은 틀린 말이다. JPA가 정말로 풀려는 문제는 SQL 타이핑의 번거로움이 아니라, **객체와 관계형 데이터베이스가 애초에 다른 세계라는 사실**이다. 이 장에서는 JDBC로 직접 개발할 때 무엇이 힘든지, 그 어려움이 왜 생길 수밖에 없는지, 그리고 JPA가 어떤 원리로 그 문제를 풀어내는지 정리한다.

---

## 1. SQL을 직접 다룰 때 생기는 문제

### 1.1 같은 코드를 테이블 수만큼 반복한다

회원 한 명을 저장하고 다시 읽어오는 데 필요한 JDBC 코드다.

```java
// 저장: 객체 → SQL 파라미터
String sql = "INSERT INTO MEMBER (ID, NAME) VALUES (?, ?)";
PreparedStatement pstmt = conn.prepareStatement(sql);
pstmt.setLong(1, member.getId());
pstmt.setString(2, member.getName());
pstmt.executeUpdate();

// 조회: SQL 결과 → 객체
String sql = "SELECT ID, NAME FROM MEMBER WHERE ID = ?";
PreparedStatement pstmt = conn.prepareStatement(sql);
pstmt.setLong(1, id);
ResultSet rs = pstmt.executeQuery();
rs.next();
Member member = new Member();
member.setId(rs.getLong("ID"));
member.setName(rs.getString("NAME"));
```

객체를 자바 컬렉션에 넣을 때는 `list.add(member)` 한 줄이면 된다. 그런데 데이터베이스에 넣으려면 객체를 SQL로 풀어 쓰고, 꺼낼 때는 SQL 결과를 다시 객체로 조립해야 한다. 이 **번역 작업**이 매번 개발자 몫이고, 테이블이 100개면 100번 반복된다. 등록·조회·수정·삭제까지 합치면 테이블 하나에 SQL 네 벌과 매핑 코드가 따라붙는다.

### 1.2 SQL에 의존적인 개발

반복보다 더 골치 아픈 문제가 있다. `Member`에 전화번호 필드 하나를 추가한다고 해 보자.

```java
class Member {
    Long id;
    String name;
    String tel;   // 추가
}
```

필드는 한 줄 늘었지만, 손대야 할 곳은 한 곳이 아니다.

| 고쳐야 할 것 | 이유 |
|:-------------|:-----|
| INSERT SQL | `TEL` 컬럼과 `?`를 추가해야 한다 |
| SELECT SQL | `TEL`을 조회 목록에 넣어야 한다 |
| UPDATE SQL | `TEL = ?`를 추가해야 한다 |
| 파라미터 바인딩 코드 | `pstmt.setString(3, member.getTel())` |
| 결과 매핑 코드 | `member.setTel(rs.getString("TEL"))` |

왜 이렇게 되는가. SQL은 컬럼을 하나하나 이름으로 나열하는 언어라서, 객체의 모양이 바뀌면 그 객체를 다루는 모든 SQL이 함께 바뀌어야 한다. 객체가 SQL에 종속된 셈이다. 계층을 아무리 잘 나눠도 DAO 안에 SQL이 있는 한 이 의존은 사라지지 않는다.

**엔티티를 믿을 수 없다는 문제**도 여기서 나온다.

```java
Member member = memberDAO.find(memberId);
member.getTeam();     // Team이 들어 있을까?
member.getOrders();   // 주문 목록은?
```

답은 "DAO가 어떤 SQL을 실행했느냐에 따라 다르다"이다. `find()`가 `MEMBER` 테이블만 조회했다면 `getTeam()`은 `null`이다. 서비스 계층은 객체를 안심하고 쓰려면 DAO를 열어 SQL을 확인해야 한다.

```
 MemberService
      │  member.getTeam()은
      │  믿어도 될까?
      ▼
   MemberDAO
      │  SQL을 열어 봐야
      │  알 수 있다
      ▼
 SELECT M.* FROM MEMBER M
```

계층은 나누어져 있지만 서비스가 DAO의 SQL에 묶여 있는 것이다. 이를 두고 **진정한 의미의 계층 분할이 어렵다**고 말한다.

{{< callout type="info" >}}
이 문제는 SQL을 더 잘 짠다고 해결되지 않는다. 어떤 SQL을 실행하든, 그 결과로 만들어진 객체는 그 SQL이 조회한 범위를 벗어날 수 없기 때문이다. 문제의 뿌리는 SQL이 아니라 **객체와 테이블이 애초에 다르게 생겼다는 것**에 있다.
{{< /callout >}}

---

## 2. 패러다임의 불일치

### 2.1 왜 애초에 안 맞는가

관계형 데이터베이스는 1970년 에드거 코드가 제안한 관계형 모델에서 출발했다. 데이터를 **행과 열의 집합**으로 보고, 중복을 없애는 정규화와 집합끼리 결합하는 조인에 최적화되어 있다. 목적은 여러 애플리케이션이 공유하는 안전한 데이터 저장소다.

객체지향은 다른 곳을 본다. 데이터와 그 데이터를 다루는 행동을 하나로 묶고, 상속·다형성·참조로 현실 세계를 프로그램 구조에 옮긴다. 목적은 변경에 유연한 프로그램이다.

둘 다 각자의 목적에는 충실하다. 문제는 객체로 만든 것을 결국 관계형 데이터베이스에 저장해야 한다는 데 있다. 그 사이에서 **번역가 노릇을 사람이 한다**는 것, 그것이 패러다임 불일치의 실체다. 번역에 드는 시간과 코드가 곧 비용이다.

| 구분 | 객체 | 관계형 데이터베이스 |
|:-----|:-----|:--------------------|
| 목적 | 행동과 데이터를 묶어 현실을 모델링 | 데이터를 중복 없이 저장하고 집합으로 조회 |
| 상속 | 있다 | 없다 (슈퍼/서브 타입으로 흉내) |
| 관계 | 참조 (한 방향) | 외래키 (조인은 양방향) |
| 탐색 | 참조를 따라 어디든 | 실행한 SQL 범위 안에서만 |
| 식별 | 참조 주소 (`==`), 값 (`equals()`) | 기본키 |

네 가지 차이를 하나씩 뜯어 본다.

### 2.2 상속

```
  [객체 상속]          [DB 슈퍼/서브]

      Item              ITEM 테이블
       △                    │
    ┌──┼──┐             ┌───┼───┐
    ▼  ▼  ▼             ▼   ▼   ▼
  Album Movie Book    ALBUM MOVIE BOOK
```

테이블에는 상속이 없다. 관계형 모델에서 행 하나는 정확히 하나의 테이블에 속하기 때문에 "Album은 Item이다"라는 is-a 관계를 표현할 방법이 없다. 그래서 가장 비슷한 모양인 **슈퍼타입/서브타입** 구조로 흉내를 낸다. 공통 컬럼은 `ITEM`에, 고유 컬럼은 `ALBUM`에 두고 두 테이블이 같은 기본키를 공유하게 만드는 것이다.

이 구조에서 `Album` 하나를 저장하려면 SQL이 두 번 나간다. 조회는 두 테이블을 조인한 뒤 결과를 객체 하나로 다시 합쳐야 한다.

```sql
-- 저장: 부모·자식 테이블에 나눠서
INSERT INTO ITEM (ID, NAME, PRICE) VALUES (?, ?, ?);
INSERT INTO ALBUM (ID, ARTIST) VALUES (?, ?);

-- 조회: 조인하고 결과를 직접 조립
SELECT I.*, A.*
  FROM ITEM I JOIN ALBUM A ON I.ID = A.ID
 WHERE I.ID = ?;
```

`Movie`, `Book`도 각각 같은 일을 반복해야 하고, 상속 계층이 깊어질수록 SQL 수는 늘어난다. 자바 컬렉션이었다면 `list.add(album)` 한 줄이었을 일이다.

JPA는 상속 구조와 테이블 구조 사이의 대응 규칙을 미리 알고 있으므로, 개발자는 컬렉션을 다루듯 한 줄만 쓰면 된다.

```java
em.persist(album);                       // ITEM, ALBUM 두 테이블에 INSERT
Album album = em.find(Album.class, id);  // ITEM과 ALBUM을 조인해 SELECT
```

여기서 `em`은 JPA의 핵심 API인 `EntityManager`로, 만드는 방법은 [Chapter 02. JPA 시작](../02-jpa-start)에서 다룬다. 상속을 테이블에 옮기는 방법은 조인 전략 외에도 몇 가지가 더 있는데, [Chapter 09. 고급 매핑](../09-advanced-mapping)에서 비교한다.

### 2.3 연관관계

객체는 **참조**로 다른 객체와 연결되고, 테이블은 **외래키**로 다른 테이블과 연결된다. 둘 다 "연결"이라는 말을 쓰지만 성질이 다르다.

| 구분 | 객체 | 테이블 |
|:-----|:-----|:-------|
| 연결 수단 | 참조 (`Team team`) | 외래키 (`TEAM_ID`) |
| 방향 | 한 방향 | 방향 없음 (조인은 어느 쪽에서든) |
| `Member → Team` | `member.getTeam()` | `JOIN TEAM T ON M.TEAM_ID = T.ID` |
| `Team → Member` | 필드를 따로 추가해야 가능 | 같은 조인으로 가능 |

방향이 다른 이유는 이렇다. 참조는 객체 안의 필드라서, `Member`가 `Team`을 가리키는 것과 `Team`이 `Member`를 가리키는 것은 별개의 필드다. 반면 외래키는 컬럼에 저장된 값일 뿐이고, 조인은 그 값을 비교하는 집합 연산이므로 어느 테이블에서 출발하든 상관없다.

이 차이 때문에 객체를 설계할 때 두 갈래 길이 생기는데, 어느 쪽을 택해도 불편하다.

```java
// (a) 테이블에 맞춘 객체 — 외래키 값을 그대로 들고 있다
class Member {
    Long id;
    Long teamId;   // TEAM_ID 컬럼 그대로
}
// 저장은 쉽다. 하지만 member.getTeam()이 불가능하다.
// 참조로 탐색한다는 객체지향의 장점을 버린 설계다.

// (b) 객체다운 객체 — 참조를 들고 있다
class Member {
    Long id;
    Team team;     // 참조
}
// 저장할 때는 team.getId()를 꺼내 TEAM_ID에 넣어야 하고,
// 조회할 때는 MEMBER·TEAM을 조인해 Team을 만든 뒤
// member.setTeam(team)으로 다시 이어 줘야 한다.
```

(b)의 변환 작업을 JPA가 대신한다. 참조와 외래키가 어떻게 대응하는지만 어노테이션으로 알려 주면 된다.

```java
@Entity
class Member {
    @Id Long id;

    @ManyToOne
    @JoinColumn(name = "TEAM_ID")   // 참조 ↔ 외래키 대응 규칙
    Team team;
}

member.setTeam(team);   // 참조로 연결
em.persist(member);     // TEAM_ID에 team.getId()가 자동으로 들어간다

Member m = em.find(Member.class, id);
m.getTeam();            // 외래키를 다시 참조로 되돌려 준다
```

다대일·일대다·양방향처럼 관계의 모양별 매핑은 [Chapter 08. 연관관계](../08-various-relationships)에서 다룬다.

### 2.4 객체 그래프 탐색

객체는 참조를 따라 그래프를 자유롭게 돌아다닐 수 있어야 한다.

```java
member.getTeam().getName();
member.getOrder().getOrderItem().getItem().getName();
```

그런데 SQL로 객체를 만들면 **탐색 범위가 그 SQL이 조회한 범위로 고정**된다. SQL은 실행하는 순간 어떤 테이블을 조인할지가 확정되고, 그 결과로 조립된 객체 그래프는 그 이상 커질 수 없기 때문이다. 이미 만들어진 객체에 나중에 다른 객체를 붙이려면 새 SQL을 실행하는 수밖에 없다.

```
 SELECT M.*, T.*
   FROM MEMBER M JOIN TEAM T ...

  Member ──▶ Team          조회됨
    │
    └──▶ Order ──▶ Item    null!
```

1.2절의 "엔티티를 믿을 수 없다"는 문제의 정체가 이것이다. 상황마다 필요한 그래프가 다르니 DAO에 `getMember()`, `getMemberWithTeam()`, `getMemberWithOrderWithDelivery()` 같은 메서드가 끝없이 늘어난다.

JPA는 **지연 로딩**으로 이 문제를 푼다. `em.find(Member.class, 1L)`은 `MEMBER`만 조회하고, `team` 자리에는 진짜 `Team` 대신 **프록시**를 넣어 둔다. 프록시는 `Team`을 상속한 빈 껍데기 객체로, 실제 값이 필요한 메서드가 처음 호출될 때 그 시점에 SELECT를 실행해 자신을 채운다.

```java
Member member = em.find(Member.class, 1L);  // SELECT ... FROM MEMBER
Team team = member.getTeam();               // SQL 없음, 프록시 반환
team.getName();                             // 여기서 SELECT ... FROM TEAM
```

왜 굳이 프록시인가. `getTeam()`을 호출한 시점에는 아직 DB를 읽지 않았으니 돌려줄 진짜 `Team`이 없다. 그렇다고 `null`을 주면 다시 신뢰 문제로 돌아간다. 그래서 "진짜인 척하는 객체"를 먼저 주고, 필요해지는 순간 진짜로 바꿔치기하는 것이다. 덕분에 개발자는 DAO의 SQL이 아니라 **"탐색하는 시점에 JPA가 가져온다"는 약속**에 기대어 엔티티를 믿을 수 있다.

{{< callout type="warning" >}}
지연 로딩이 언제나 정답은 아니다. `Member`와 `Team`을 거의 항상 함께 쓴다면 처음부터 조인해서 한 번에 가져오는 편이 낫다. 회원 100명을 조회한 뒤 각각 `getTeam()`을 호출하면 SELECT가 최대 101번 나가는 **N+1 문제**가 대표적인 부작용이다. 프록시와 페치 전략은 [Chapter 10. 프록시](../10-proxy-loading), 페치 조인은 [Chapter 12. 객체지향 쿼리](../12-object-oriented-query)에서 다룬다.
{{< /callout >}}

### 2.5 비교

| 비교 | 연산자 | 의미 |
|:-----|:-------|:-----|
| 동일성 (identity) | `==` | 같은 인스턴스인가 (참조 주소 비교) |
| 동등성 (equality) | `equals()` | 같은 값인가 |

데이터베이스는 행을 기본키 하나로 식별한다. 자바는 동일성과 동등성 두 가지 기준을 갖는다. 이 차이는 같은 행을 두 번 조회할 때 드러난다.

```java
Member m1 = memberDAO.find(1L);
Member m2 = memberDAO.find(1L);
m1 == m2;   // false
```

같은 기본키를 조회했는데 `false`인 이유는 단순하다. JDBC는 `ResultSet`의 행을 매번 `new Member()`로 만들어 매핑하기 때문에, 같은 행이라도 조회할 때마다 새 인스턴스가 생긴다. 컬렉션이라면 `list.get(0) == list.get(0)`이 당연히 `true`인데, DB에서 꺼낸 객체는 그 당연함이 깨진다.

이게 왜 문제인가. 한 트랜잭션 안에서 같은 회원을 두 곳에서 조회해 각각 다른 필드를 수정했다고 해 보자. 서로 다른 인스턴스이므로 두 변경이 합쳐지지 않고, 두 인스턴스를 각각 UPDATE하면 나중 것이 앞선 변경을 덮어쓸 수 있다.

JPA는 같은 영속성 컨텍스트 안에서 같은 기본키를 조회하면 **같은 인스턴스**를 돌려준다. 한 번 조회한 엔티티를 기본키를 키로 하는 맵, 즉 **1차 캐시**에 보관해 두었다가 같은 요청이 오면 그대로 꺼내 주기 때문이다.

```java
Member m1 = em.find(Member.class, 1L);   // SELECT 실행
Member m2 = em.find(Member.class, 1L);   // 1차 캐시에서 반환, SQL 없음
m1 == m2;   // true
```

{{< callout type="info" >}}
동일성 보장은 **영속성 컨텍스트 하나의 범위** 안에서만 성립한다. 스프링에서는 보통 트랜잭션 하나가 그 범위다. 트랜잭션이 다르면 같은 회원이라도 다른 인스턴스이므로, 그 너머에서 비교하려면 `equals()`와 `hashCode()`를 직접 정의해야 한다. 1차 캐시의 동작은 [Chapter 05. 영속성 특징](../05-persistence-features)에서 다룬다.
{{< /callout >}}

### 2.6 네 문제의 공통점

상속, 연관관계, 그래프 탐색, 비교. 네 문제는 모두 **객체 모델과 테이블 모델 사이의 번역을 사람이 하고 있다**는 한 가지 원인에서 나온다. 번역을 더 잘하는 것이 해법이 아니다. 번역기를 두는 것이 해법이고, 그 번역기가 JPA다.

---

## 3. JPA란 무엇인가

JPA는 **Java Persistence API**의 약자로, 자바 진영의 ORM 기술 표준이다. 현재 공식 명칭은 Jakarta Persistence지만, 여전히 JPA라고 부른다.

### 3.1 ORM

ORM(Object-Relational Mapping)은 객체와 관계형 데이터베이스를 매핑해 주는 기술이다. 개발자가 "이 클래스는 이 테이블, 이 필드는 이 컬럼"이라는 매핑 정보만 알려 주면, 나머지 번역은 ORM 프레임워크가 맡는다. SQL을 만들고, 실행하고, 결과를 객체로 조립하는 일 전부다.

```
┌──────────────────────┐
│     애플리케이션     │
└──────────┬───────────┘
           │ persist(), find()
┌──────────▼───────────┐
│    JPA (Hibernate)   │
│   객체를 SQL로 번역  │
└──────────┬───────────┘
           │ JDBC API
┌──────────▼───────────┐
│          DB          │
└──────────────────────┘
```

JPA는 JDBC를 대체하지 않는다. 애플리케이션이 JPA API를 호출하면 JPA가 SQL을 만들어 **JDBC로 실행**하고, 결과를 다시 객체로 돌려준다. JDBC를 없애는 것이 아니라 JDBC를 대신 호출해 주는 번역 계층이 하나 끼어드는 것이다.

### 3.2 CRUD는 이렇게 바뀐다

```java
// 저장 — INSERT를 만들어 실행
em.persist(member);

// 조회 — SELECT를 만들어 실행하고 결과를 객체로 매핑
Member member = em.find(Member.class, id);

// 수정 — 따로 호출할 메서드가 없다. 변경을 감지해 UPDATE를 만든다
member.setName("newName");

// 삭제 — DELETE를 만들어 실행
em.remove(member);
```

수정에 `update()` 같은 메서드가 없다는 점이 낯설 수 있다. 컬렉션에서 꺼낸 객체를 바꾸면 그것이 곧 컬렉션 안의 객체가 바뀐 것이듯, JPA도 같은 감각을 목표로 한다. 조회 시점의 상태를 스냅샷으로 기억해 두었다가 트랜잭션을 커밋할 때 달라진 것이 있으면 그 엔티티에 대해서만 UPDATE를 실행한다. 이것이 **변경 감지**이고, 역시 [Chapter 05](../05-persistence-features)에서 자세히 본다.

{{< callout type="warning" >}}
**JPA를 쓴다고 SQL을 몰라도 되는 것은 아니다.** SQL을 직접 쓰지 않는 것과 SQL을 몰라도 되는 것은 다르다. JPA가 어떤 SQL을 만들지 예상하고 로그로 확인할 수 있어야 N+1 같은 성능 문제를 잡을 수 있다. 이 시리즈 내내 "이 코드가 어떤 SQL이 되는가"를 따라가는 이유다.
{{< /callout >}}

---

## 4. JPA는 어떻게 표준이 되었나

### 4.1 EJB 엔티티 빈의 실패, Hibernate의 성공

자바 진영의 첫 ORM 표준은 EJB 2.x의 **엔티티 빈**이었다. 그러나 클래스 하나를 만들려면 인터페이스를 여러 개 구현해야 했고, 무거운 J2EE 애플리케이션 서버 위에서만 동작했으며, 성능도 나빴다. 표준이 있어도 개발자들은 JDBC나 iBatis를 직접 썼다.

2001년 게빈 킹이 만든 Hibernate는 정반대 길을 갔다. 평범한 자바 객체(POJO)를 그대로 매핑하고, 매핑 정보만 XML이나 어노테이션으로 기술하며, 애플리케이션 서버 없이도 동작했다. 실용성 덕분에 Hibernate는 표준이 아니면서도 사실상의 표준이 됐다.

여기서 흥미로운 결정이 나온다. EJB 3.0 전문가 그룹은 새 기술을 만드는 대신 **이미 검증된 Hibernate의 설계를 그대로 표준화**하기로 했고, 게빈 킹도 이 작업에 참여했다. 그 결과가 2006년의 JPA 1.0이다. JPA와 Hibernate가 닮은 이유, 그리고 Hibernate가 JPA의 대표 구현체가 된 이유가 여기에 있다.

### 4.2 연표

```
2001  Hibernate 등장
  │   EJB 엔티티 빈의 대안으로 확산
  ▼
2006  JPA 1.0 (EJB 3.0)
  │   Hibernate의 설계를 표준화
  ▼
2009  JPA 2.0
  │   Criteria API, 컬렉션 매핑 강화
  ▼
2013  JPA 2.1
  │   컨버터, 엔티티 그래프
  ▼
2020  Jakarta Persistence 3.0
  │   javax → jakarta 패키지 변경
  ▼
2024  Jakarta Persistence 3.2
```

2017년의 JPA 2.2는 자바 8 날짜 API 지원처럼 작은 보강이었다. 큰 변화는 2020년의 패키지 이름 변경이다.

**왜 `javax`가 `jakarta`로 바뀌었나.** 2017년 오라클이 Java EE를 이클립스 재단에 넘기면서 `javax` 패키지 이름에 대한 권리는 넘기지 않았다. 재단은 `javax.*` 아래에서 API를 고칠 수 없었고, 결국 Jakarta EE 9에서 모든 패키지를 `jakarta.*`로 옮겼다. 기능이 바뀐 것이 아니라 이름만 바뀐 것인데, 그 이름 때문에 스프링 부트 3와 Hibernate 6로 올릴 때 프로젝트 전체의 import를 고쳐야 했다.

{{< callout type="info" >}}
스프링 부트 2.x + Hibernate 5는 `javax.persistence`, 스프링 부트 3.x + Hibernate 6는 `jakarta.persistence`를 쓴다. 이 시리즈의 예제에 `javax`로 남아 있는 부분은 구버전 기준이므로 `jakarta`로 바꿔 읽으면 된다.
{{< /callout >}}

### 4.3 JPA와 Hibernate의 관계

JPA는 "이런 API가 있어야 하고 이렇게 동작해야 한다"는 **명세**다. 실제로 SQL을 만들고 실행하는 코드는 **구현체**에 있다. `EntityManager`는 인터페이스이고, 실행 시점에 그 자리에 들어가는 것은 Hibernate의 `SessionImpl`이다.

```
 애플리케이션 코드
       │  jakarta.persistence.*
       ▼
   JPA (인터페이스)
       │  구현
   ┌───┴─────────┬────────────┐
   ▼             ▼            ▼
Hibernate   EclipseLink   DataNucleus
```

| 구분 | JPA | Hibernate |
|:-----|:----|:----------|
| 정체 | 표준 명세 (인터페이스) | 구현체 (실제 동작하는 코드) |
| 패키지 | `jakarta.persistence` (구 `javax.persistence`) | `org.hibernate` |
| 대표 타입 | `EntityManager`, `@Entity` | `Session`, `SessionFactory` |
| 대안 | – | EclipseLink, DataNucleus, OpenJPA |

인터페이스로 표준을 만든 이유는 분명하다. 구현체를 바꿔도 애플리케이션 코드는 그대로이고, 한 번 배우면 어느 구현체에서든 통한다. 다만 솔직히 말하면 실무에서는 거의 전부 Hibernate를 쓰고, `@BatchSize`나 `@DynamicUpdate` 같은 Hibernate 고유 기능에 기대는 경우도 흔하다. "구현체 교체"는 실제로 누리는 이점이라기보다 표준이 주는 안전장치에 가깝다.

{{< callout type="info" >}}
**스프링 데이터 JPA는 JPA 구현체가 아니다.** JPA 위에서 `Repository` 인터페이스만 선언하면 구현을 자동으로 만들어 주는 라이브러리다. 실제 스택은 스프링 데이터 JPA → JPA → Hibernate → JDBC 순으로 쌓인다. 스프링 데이터 JPA가 편하다고 느낀다면 그 편안함의 대부분은 아래층인 JPA와 Hibernate가 만드는 것이다.
{{< /callout >}}

---

## 5. 왜 JPA를 쓰는가

### 5.1 생산성

```java
// JDBC: SQL 작성, 파라미터 바인딩, 실행
String sql = "INSERT INTO MEMBER (ID, NAME) VALUES (?, ?)";
pstmt.setLong(1, member.getId());
pstmt.setString(2, member.getName());
pstmt.executeUpdate();

// JPA
em.persist(member);
```

1.1절에서 본 반복 코드가 사라진다. 여기에 더해 매핑 정보로부터 테이블 DDL을 자동 생성하는 기능도 있어, 프로젝트 초기에 스키마를 잡는 속도가 눈에 띄게 빨라진다.

### 5.2 유지보수

`Member`에 `tel` 필드를 추가하는 1.2절의 시나리오로 돌아가 보자.

```java
@Entity
class Member {
    @Id Long id;
    String name;
    String tel;   // 이 한 줄이면 INSERT·SELECT·UPDATE 모두 반영된다
}
```

SQL이 코드에 없으니 고칠 SQL도 없다. JPA는 SQL을 매핑 정보에서 **생성**하기 때문에, 매핑이 바뀌면 SQL도 자동으로 따라 바뀐다. 1.2절에서 "객체가 SQL에 종속된다"고 했던 문제가 방향을 뒤집어 해결된 것이다.

### 5.3 패러다임 불일치 해결

2절의 네 문제를 JPA가 어떻게 처리하는지 한 표로 모으면 이렇다.

| 문제 | 원인 | JPA의 해결 |
|:-----|:-----|:-----------|
| 상속 | 테이블에는 상속이 없다 | 여러 테이블에 나눠 저장하고 조인해서 조회 |
| 연관관계 | 참조 ↔ 외래키 | 매핑 규칙에 따라 자동 변환 |
| 그래프 탐색 | SQL 범위에 갇힌다 | 지연 로딩 (프록시) |
| 비교 | 조회마다 새 인스턴스 | 1차 캐시로 동일성 보장 |

### 5.4 성능

"한 계층이 더 끼면 느려지지 않을까"라는 걱정이 자연스럽다. 그런데 애플리케이션과 DB 사이에 계층이 하나 있다는 것은, 그 계층에서 **최적화를 시도할 기회가 한 번 더 있다**는 뜻이기도 하다. JPA는 그 기회를 세 가지 방식으로 쓴다.

**1차 캐시.** 같은 트랜잭션에서 같은 엔티티를 두 번 조회하면 SQL은 한 번만 나간다.

```java
Member m1 = em.find(Member.class, 1L);  // SELECT
Member m2 = em.find(Member.class, 1L);  // 캐시에서 반환
```

**쓰기 지연.** `persist()`를 호출해도 INSERT를 바로 보내지 않고 모아 두었다가 커밋 시점에 한 번에 보낸다. 트랜잭션 안에서는 커밋 전까지 DB에 반영되지 않아도 결과가 같기 때문에 가능한 최적화다. SQL을 모아 보내면 JDBC 배치로 네트워크 왕복을 줄일 수 있다.

```java
tx.begin();
em.persist(memberA);   // SQL 저장소에 보관
em.persist(memberB);   // SQL 저장소에 보관
em.persist(memberC);   // SQL 저장소에 보관
tx.commit();           // 이때 INSERT 3개를 한 번에 전송
```

**지연 로딩과 변경 감지.** 필요한 시점에만 조회하니 안 쓰는 데이터는 읽지 않고, 바뀐 엔티티에 대해서만 UPDATE를 만든다.

{{< callout type="info" >}}
쓰기 지연으로 모아 둔 INSERT가 실제로 하나의 배치로 나가려면 `hibernate.jdbc.batch_size` 설정이 필요하다. 또 기본키 전략이 IDENTITY면 INSERT를 실행해야 키 값을 알 수 있으므로 쓰기 지연이 동작하지 않는다. 키 전략은 [Chapter 07. 엔티티 매핑](../07-entity-mapping)에서 다룬다.
{{< /callout >}}

### 5.5 데이터베이스 독립성

SQL에는 표준이 있지만 벤더마다 조금씩 다르다. 페이징 문법만 봐도 그렇다.

| DB | 페이징 문법 |
|:---|:-----------|
| MySQL, PostgreSQL, H2 | `LIMIT 10 OFFSET 20` |
| Oracle 12c 이후 | `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` |
| Oracle 11g 이전 | `ROWNUM`을 이용한 서브쿼리 |
| SQL Server 2012 이후 | `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` |

SQL을 직접 쓰면 이 차이가 애플리케이션 코드에 그대로 박힌다. JPA는 **방언(Dialect)** 계층을 두어 DB별 차이를 흡수한다. 애플리케이션은 JPA API로 의도만 말하고, 실제 문법은 방언이 결정한다.

```java
em.createQuery("select m from Member m", Member.class)
  .setFirstResult(20)
  .setMaxResults(10)
  .getResultList();

// MySQL 방언  → ... LIMIT ?, ?
// Oracle 방언 → ... OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
```

```properties
# Hibernate 6부터는 JDBC 메타데이터로 방언을 자동 감지한다.
# 직접 지정해야 할 때만 아래처럼 쓴다.
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
```

덕분에 개발은 H2, 운영은 MySQL처럼 환경마다 다른 DB를 쓰는 것이 가능해진다. 다만 네이티브 SQL, DB 고유 함수, 시퀀스 지원 여부처럼 방언이 흡수하지 못하는 지점은 남는다. "설정 한 줄로 DB를 갈아 끼운다"기보다 "매핑과 기본 CRUD, JPQL은 DB가 바뀌어도 살아남는다"로 이해하는 편이 정확하다. 방언 설정은 [Chapter 02. JPA 시작](../02-jpa-start)에서 다시 나온다.

### 5.6 표준

JPA는 표준이므로 한 번 익히면 구현체가 무엇이든 같은 API로 일할 수 있다. 4.3절에서 말했듯 실무에서 구현체를 바꾸는 일은 드물지만, 새 프로젝트나 새 팀에서 배운 지식이 그대로 통한다는 것만으로도 표준의 가치는 충분하다.

---

## 6. 그럼에도 알아 둘 것

JPA는 만능이 아니다. 어디에 강하고 어디에 약한지 미리 알아 두면 시리즈를 읽는 동안 균형을 잡기 쉽다.

- **복잡한 조회에는 약하다.** 통계나 집계처럼 결과가 엔티티 모양이 아닌 조회는 JPQL로도 어색하다. 이런 곳은 네이티브 SQL, QueryDSL, 혹은 MyBatis 같은 SQL 매퍼를 함께 쓰는 것이 현실적인 선택이다.
- **SQL을 직접 쓸 때는 없던 문제가 생긴다.** N+1 조회, 의도치 않은 즉시 로딩, 영속성 컨텍스트 범위를 벗어난 지연 로딩 예외 같은 것들이다. 모두 JPA가 어떤 SQL을 언제 만드는지 몰라서 생기는 문제이므로, 실행되는 SQL을 로그로 읽는 습관이 필수다.
- **배울 것이 많다.** 영속성 컨텍스트, 엔티티 생명주기, 지연 로딩, 트랜잭션 범위. 이 시리즈가 다루는 것들이 곧 그 학습 비용이다.

정리하면 JPA는 SQL을 없애는 도구가 아니라, **객체 모델을 중심에 두고 SQL 생성을 맡기는 도구**다. 그러려면 JPA가 언제 어떤 SQL을 만드는지 알아야 한다. 다음 장에서 실제 코드로 JPA를 돌려 보고, [Chapter 03. 영속성 컨텍스트](../03-persistence-context)부터 그 원리를 하나씩 파고든다.

---

## 요약

| 항목 | 핵심 |
|:-----|:-----|
| SQL 중심 개발의 문제 | 반복 코드, SQL 의존, 엔티티를 믿을 수 없음 |
| 패러다임 불일치 | 객체와 테이블의 번역을 사람이 하는 데서 오는 비용 |
| 상속 | 테이블에는 없다 → 슈퍼/서브 타입 매핑을 JPA가 대신 |
| 연관관계 | 참조 ↔ 외래키 변환을 JPA가 대신 |
| 그래프 탐색 | SQL 범위에 갇힘 → 지연 로딩(프록시) |
| 비교 | 조회마다 새 인스턴스 → 1차 캐시로 동일성 보장 |
| JPA | 자바 ORM 표준 명세, 현재 이름은 Jakarta Persistence |
| Hibernate | JPA의 원형이자 대표 구현체 |
| `javax` → `jakarta` | 패키지 권리 문제로 이름만 바뀜, 스프링 부트 3부터 적용 |
| 성능 | 1차 캐시, 쓰기 지연, 지연 로딩, 변경 감지 |
| 방언 | DB별 SQL 차이를 흡수하는 계층 |

### 핵심 코드

```java
// 저장
em.persist(entity);

// 조회
Entity entity = em.find(Entity.class, id);

// 수정 — 변경 감지, 커밋 시 UPDATE
entity.setName("newName");

// 삭제
em.remove(entity);
```
