---
title: "Chapter 08. 다양한 연관관계 매핑"
date: 2025-12-22
weight: 8
---

[Chapter 01](../01-jpa-intro)에서 객체는 참조로, 테이블은 외래 키로 관계를 맺는다고 했다. 이 차이를 메우는 것이 연관관계 매핑이다. 그런데 매핑 어노테이션을 붙이는 것만으로는 끝나지 않는다. 참조는 한 방향인데 외래 키는 방향이 없다는 사실 때문에, JPA는 개발자에게 "둘 중 누가 외래 키를 책임지느냐"를 반드시 정하게 한다. 다대일·일대다·일대일·다대다에서 어떤 선택이 권장되고 어떤 선택을 피해야 하는지는 전부 세 원리에서 나온다. 첫째, **참조는 둘일 수 있지만 외래 키는 하나다.** 객체의 양방향은 단방향 둘이고, 외래 키를 쓰는 쪽은 하나만 정해야 하며, 그 주인은 외래 키가 있는 테이블의 엔티티여야 자연스럽다. 둘째, **JPA는 주인만 보고 SQL을 만들지만, 1차 캐시 속 객체는 스스로 갱신되지 않는다.** 그래서 주인 쪽만 바꾸면 DB는 맞아도 객체 그래프가 어긋나고, 양방향에는 양쪽을 함께 맞추는 편의 메서드가 필요하다. 셋째, **외래 키의 위치가 매핑의 모양을 정한다.** 다대일은 외래 키가 N 쪽에 있어 자연스럽고, 일대다 단방향은 주인과 외래 키 테이블이 달라 UPDATE가 더 나가며, 일대일은 외래 키 위치가 지연 로딩을 좌우하고, 다대다는 테이블이 표현하지 못하므로 연결 엔티티로 풀어야 한다.

---

## 1. 연관관계 매핑의 세 가지 결정

```
연관관계를 매핑할 때 정하는 것

1. 다중성   N:1   1:N   1:1   N:N
2. 방향     단방향 ─▶    양방향 ◀─▶
3. 주인     외래 키를 관리하는 쪽
```

다중성은 업무 규칙이 정해 준다. 회원 여럿이 팀 하나에 속하면 회원 쪽에서 봐서 다대일이다. 방향과 주인은 객체 설계의 선택이고, 이 둘을 이해하는 것이 이 장의 절반이다.

### 1.1 객체는 참조 두 개, 테이블은 외래 키 하나

```
[객체]   Member ──team──▶ Team
         Team ─members─▶ Member
         → 참조 2개 (단방향 둘)

[테이블] MEMBER.TEAM_ID ─▶ TEAM.TEAM_ID
         → 외래 키 1개, 방향 없음
```

테이블에서 회원과 팀의 관계는 `MEMBER.TEAM_ID` 하나로 끝난다. 회원에서 팀을 찾는 조인도, 팀에서 회원들을 찾는 조인도 같은 컬럼을 쓴다. 외래 키에는 방향이 없다.

객체는 다르다. `member.getTeam()`이 되려면 `Member`에 `team` 필드가 있어야 하고, `team.getMembers()`가 되려면 `Team`에 `members` 필드가 따로 있어야 한다. 객체의 양방향 관계란 사실 **단방향 관계 두 개**다. 서로를 가리키는 참조 둘이 있을 뿐, 둘을 하나로 묶어 주는 장치는 언어에 없다. 첫째 원리의 앞부분이다.

### 1.2 왜 연관관계 주인이 필요한가

여기서 문제가 생긴다. 참조는 둘인데 외래 키는 하나다. `member.setTeam(teamA)`와 `teamB.getMembers().add(member)`가 서로 다른 팀을 가리키면, `MEMBER.TEAM_ID`에는 무엇이 들어가야 할까. JPA는 이 충돌을 판정할 수 없다. 그래서 규칙을 세운다. **두 참조 중 하나만 외래 키를 관리하고, 나머지 하나는 읽기만 한다.** 외래 키를 관리하는 쪽이 **연관관계 주인**이다.

| 구분 | 주인 | 주인이 아닌 쪽 | 왜 |
|:-----|:-----|:---------------|:---|
| 외래 키 | 등록·수정한다 | 건드리지 못한다 | 관리자가 둘이면 충돌을 판정할 수 없다 |
| 어노테이션 | `@JoinColumn(name = "TEAM_ID")` | `mappedBy = "team"` | 주인은 컬럼을, 반대쪽은 주인의 필드를 가리킨다 |
| 값을 바꾸면 | SQL에 반영된다 | 무시된다 | JPA는 주인 쪽 값만 보고 외래 키를 쓴다 |
| 조회 | 된다 | 된다 | 읽기는 외래 키를 바꾸지 않으니 양쪽 모두 자유다 |

주인은 **외래 키가 있는 테이블의 엔티티**로 정한다. 이유는 SQL을 생각하면 명확하다. `TEAM_ID` 컬럼은 `MEMBER` 테이블에 있다. `Member`가 주인이면 회원을 저장하는 INSERT 한 문장에 `TEAM_ID`를 함께 넣으면 끝이다. 반대로 `Team`이 주인이면 팀을 저장한 뒤 `MEMBER` 테이블을 따로 UPDATE해야 한다. 자기 테이블에 없는 컬럼을 관리하는 셈이라 어색하고 비용도 든다. 3절의 일대다 단방향이 바로 그 어색한 경우다.

`mappedBy`는 "나는 주인이 아니고, 이 관계는 저쪽 엔티티의 저 필드가 관리한다"는 선언이다. 값으로는 주인 쪽의 **필드 이름**을 쓴다. 주인이 아닌 쪽은 외래 키를 못 바꾸지만 조회는 자유롭다. `team.getMembers()`는 `mappedBy`만으로 잘 동작한다.

### 1.3 가장 흔한 실수: 주인이 아닌 쪽만 바꾸기

```java
Member member = new Member("회원1");
em.persist(member);

Team team = new Team("팀A");
team.getMembers().add(member);
// 주인이 아닌 쪽만 설정했다
em.persist(team);

tx.commit();
// MEMBER.TEAM_ID = null
```

`Team.members`는 `mappedBy`가 붙은 읽기 전용 쪽이므로, 컬렉션에 회원을 넣어도 JPA는 외래 키를 쓰지 않는다. 오류도 나지 않는다. 팀과 회원이 모두 저장되고 `TEAM_ID`만 조용히 `null`이다. 외래 키를 바꾸고 싶으면 반드시 주인인 `member.setTeam(team)`을 불러야 한다.

### 1.4 그래도 양쪽을 다 맞춰야 하는 이유

DB만 생각하면 주인 쪽만 설정하면 충분하다. 그런데 객체까지 생각하면 부족하다.

```java
member.setTeam(team);
// 주인 설정. DB에는 이것으로 충분하다
em.persist(member);

team.getMembers().size();
// 0. 컬렉션에는 아무것도 없다
```

`team`은 [Chapter 05](../05-persistence-features)에서 본 1차 캐시의 그 인스턴스다. 같은 트랜잭션 안에서 `team.getMembers()`를 불러도 DB를 다시 읽지 않고 메모리의 컬렉션을 그대로 돌려준다. 그 컬렉션에 회원을 넣은 적이 없으니 비어 있다. DB에는 관계가 있는데 객체에는 없는 상태다. 둘째 원리다. 컨텍스트를 비우고 팀을 다시 조회하면 그때는 DB에서 읽어 회원이 보이지만, 그것은 캐시가 갱신된 것이 아니라 새로 읽은 것이다. JPA 없이 순수 객체로 테스트할 때도 같은 문제가 생긴다.

그래서 양방향에서는 **한 번의 호출로 양쪽을 함께 맞추는 메서드**를 둔다. 연관관계 편의 메서드라 부른다.

```java
public class Member {
    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    private Team team;

    public void changeTeam(Team team) {
        if (this.team != null) {
            // 이전 팀에서 제거
            this.team.getMembers()
                     .remove(this);
        }
        this.team = team;
        // 새 팀에 추가
        team.getMembers().add(this);
    }
}
```

이전 팀에서 제거하는 줄이 왜 필요한지도 짚어 두자. 팀 A에서 팀 B로 옮긴 뒤 `teamA.getMembers()`를 조회하면, 그 컬렉션에 회원이 그대로 남아 있다. 1차 캐시의 컬렉션은 스스로 갱신되지 않는다. 편의 메서드는 한쪽에만 두는 것이 좋다. 양쪽에 두고 서로를 호출하면 무한 루프에 빠지기 쉽고, 두 곳을 관리하다 어긋나기도 쉽다.

{{< callout type="warning" >}}
양방향 참조는 순환 구조다. `toString()`이 서로를 호출하거나, 엔티티를 그대로 JSON으로 직렬화하면 `Member → Team → members → Member → …`로 끝없이 돌다가 `StackOverflowError`가 난다. `toString()`에 연관 필드를 넣지 않고, API 응답은 엔티티가 아닌 DTO로 만드는 것이 기본이다.
{{< /callout >}}

---

## 2. 다대일 [N:1]

가장 많이 쓰고, 가장 먼저 익혀야 하는 관계다. 외래 키는 언제나 **N 쪽 테이블**에 있다. 회원 여럿이 팀 하나에 속하려면 각 회원 행에 팀 번호가 있어야 한다. 셋째 원리가 가장 순하게 적용되는 자리다.

```
  Member (N)              Team (1)
  ┌──────────────┐   ┌──────────────┐
  │ MEMBER_ID PK │   │ TEAM_ID   PK │
  │ TEAM_ID   FK │──▶│ NAME         │
  │ USERNAME     │   └──────────────┘
  └──────────────┘
   외래 키는 N 쪽에
```

### 2.1 다대일 단방향

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    private String username;

    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    // MEMBER 테이블의 외래 키
    private Team team;
}

@Entity
public class Team {
    @Id @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;

    private String name;
    // Member를 참조하지 않는다
}
```

외래 키가 있는 `Member`에 참조를 두었으니 주인 문제가 생기지 않는다. 참조가 하나라 관리할 것도 없다. `Team`에서 회원을 찾을 일이 없다면 이것으로 충분하고, 실제로 대부분의 관계는 단방향으로 시작하는 것이 맞다.

### 2.2 다대일 양방향

```java
@Entity
public class Member {
    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    private Team team;   // 주인

    // 1.4절의 편의 메서드
    public void changeTeam(Team team) {
        ...
    }
}

@Entity
public class Team {
    // 주인이 아니다. Member.team이 관리
    @OneToMany(mappedBy = "team")
    private List<Member> members =
        new ArrayList<>();
}
```

`Team`에 `members`를 추가하면 양방향이 된다. 외래 키는 여전히 `Member`가 관리하고, `Team.members`는 `mappedBy`로 읽기 전용임을 선언한다. 언제 양방향으로 만드는가. `team.getMembers()`처럼 반대 방향의 객체 그래프 탐색이 필요할 때, 또는 JPQL에서 팀을 기준으로 회원을 조회할 일이 잦을 때다. 그 필요가 없다면 참조 하나가 늘어나는 만큼 1.4절의 관리 부담만 늘어난다.

---

## 3. 일대다 [1:N]

같은 관계를 1 쪽에서 바라본 것이다. 그런데 외래 키는 여전히 N 쪽 테이블에 있다. 여기서 1.2절의 원칙과 어긋나는 상황이 생긴다.

### 3.1 일대다 단방향: 주인과 외래 키가 다른 테이블에 있다

```
  Team.members가 관리    외래 키는 여기
        │                      │
        ▼                      ▼
  ┌──────────┐      ┌──────────────┐
  │   TEAM   │      │    MEMBER    │
  │ TEAM_ID  │◀─────│ TEAM_ID  FK  │
  │ NAME     │      │ MEMBER_ID PK │
  └──────────┘      └──────────────┘
```

```java
@Entity
public class Team {
    @Id @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;

    @OneToMany
    @JoinColumn(name = "TEAM_ID")
    // MEMBER 테이블의 외래 키를
    // 여기서 관리한다
    private List<Member> members =
        new ArrayList<>();
}

@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    private String username;
    // Team을 참조하지 않는다
}
```

`Team`이 주인인데 외래 키는 `MEMBER` 테이블에 있다. 이 어긋남이 SQL로 드러난다.

```java
Member member1 = new Member("회원1");
Member member2 = new Member("회원2");
Team team = new Team("팀A");
team.getMembers().add(member1);
team.getMembers().add(member2);

em.persist(member1);
em.persist(member2);
em.persist(team);
tx.commit();
```

```sql
-- TEAM_ID 없이 INSERT
INSERT INTO MEMBER (MEMBER_ID, USERNAME)
VALUES (1, '회원1');
INSERT INTO MEMBER (MEMBER_ID, USERNAME)
VALUES (2, '회원2');
INSERT INTO TEAM (TEAM_ID, NAME)
VALUES (1, '팀A');
-- 추가 UPDATE
UPDATE MEMBER SET TEAM_ID = 1
WHERE MEMBER_ID = 1;
UPDATE MEMBER SET TEAM_ID = 1
WHERE MEMBER_ID = 2;
```

왜 UPDATE가 따로 나가는가. 회원을 저장하는 시점에 `Member` 엔티티는 팀을 모른다. 참조가 없으니 INSERT에 `TEAM_ID`를 넣을 수 없다. 관계를 아는 것은 `Team.members`뿐이고, 그 컬렉션이 처리될 때 비로소 `MEMBER` 테이블을 UPDATE해서 외래 키를 채운다. 회원이 백 명이면 UPDATE도 백 번이다. 성능도 성능이지만, 팀을 저장했는데 회원 테이블이 바뀌는 흐름은 코드를 읽는 사람에게 예상 밖이다. [Chapter 05](../05-persistence-features)에서 본 대로 플러시 때 INSERT가 모두 나간 뒤 UPDATE가 실행되므로 순서도 위와 같다.

{{< callout type="warning" >}}
`@OneToMany` 단방향에서 `@JoinColumn`을 빼면 문제가 하나 더 생긴다. JPA는 외래 키 컬럼 대신 **연결 테이블**을 만들어 관계를 저장한다. Hibernate는 `Team_Member`처럼 두 엔티티 이름을 이은 테이블을 만든다. 일대다 단방향의 기본 전략이 조인 테이블이기 때문이다. 의도한 적 없는 테이블이 하나 생기는 것이니, 일대다 단방향을 꼭 써야 한다면 `@JoinColumn`은 필수다.
{{< /callout >}}

결론은 간단하다. 같은 테이블 구조를 **다대일 양방향**으로 매핑하면 외래 키가 있는 `Member`가 주인이 되어 추가 UPDATE가 사라진다. 일대다 단방향이 필요해 보이는 순간은 대개 "팀에서 회원을 탐색하고 싶다"는 뜻인데, 그것은 다대일 양방향의 `mappedBy` 쪽이 이미 해 준다.

### 3.2 일대다 양방향은 없다

`@ManyToOne`에는 `mappedBy` 속성이 없다. 붙이면 컴파일부터 되지 않는다. 다대일 쪽은 외래 키를 가진 테이블이라 항상 주인이어야 한다는 것이 JPA의 입장이다. 따라서 "일 쪽이 주인인 양방향"은 표준에 없다. `@ManyToOne` 쪽에 `@JoinColumn(insertable = false, updatable = false)`를 붙여 읽기 전용으로 만드는 우회로가 있지만, 결국 다대일 양방향과 같은 테이블 구조에 관리만 더 복잡해질 뿐이다. 다대일 양방향을 쓰면 된다.

---

## 4. 일대일 [1:1]

회원 하나가 사물함 하나를 쓰는 관계다. 다대일과 달리 **어느 테이블이 외래 키를 가져도 된다.** 양쪽 모두 "하나"이므로 외래 키가 어디 있든 관계를 표현할 수 있다. 그래서 일대일에서는 외래 키 위치가 설계 결정이 된다.

### 4.1 외래 키를 어디에 둘 것인가

```
[주 테이블에 FK]
  MEMBER(LOCKER_ID FK) ──▶ LOCKER
  회원을 읽으면 사물함 유무를 안다

[대상 테이블에 FK]
  MEMBER ◀── LOCKER(MEMBER_ID FK)
  회원을 읽어도 사물함 유무를 모른다
```

| 외래 키 위치 | 장점 | 단점 | 왜 |
|:-------------|:-----|:-----|:---|
| 주 테이블 (MEMBER) | 회원만 조회해도 사물함이 있는지 안다. 객체지향적이다 | 사물함이 없는 회원은 외래 키가 `null` | 외래 키 값 하나로 유무를 판정할 수 있다 |
| 대상 테이블 (LOCKER) | 나중에 회원 하나가 사물함 여럿을 쓰게 되어도 테이블은 그대로다 | 주 테이블 쪽에서 지연 로딩이 안 된다 | 유무를 알려면 LOCKER 테이블을 조회해 봐야 한다 |

어느 쪽이든 외래 키 컬럼에는 **유니크 제약**이 있어야 한다. `LOCKER_ID`에 유니크가 없으면 DB 관점에서는 회원 여럿이 같은 사물함을 가리킬 수 있는 다대일 구조다. JPA 어노테이션이 일대일이라고 선언해도 DB가 그것을 강제하지는 않는다. Hibernate가 DDL을 만들 때는 `@OneToOne`의 외래 키 컬럼에 유니크 제약을 알아서 붙이지만, 테이블을 직접 만들 때는 빠뜨리기 쉽다. `unique = true`를 적어 두면 의도도 드러난다.

### 4.2 주 테이블에 외래 키

```java
// 단방향
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    @OneToOne
    @JoinColumn(name = "LOCKER_ID",
                unique = true)
    private Locker locker;
}

@Entity
public class Locker {
    @Id @GeneratedValue
    @Column(name = "LOCKER_ID")
    private Long id;

    private String name;
}
```

```java
// 양방향: Locker에 읽기 전용 참조 추가
@Entity
public class Locker {
    // 주인은 Member.locker
    @OneToOne(mappedBy = "locker")
    private Member member;
}
```

다대일과 완전히 같은 모양이다. 외래 키가 있는 `Member`가 주인이고, 양방향이 필요하면 `Locker`에 `mappedBy`를 붙인다.

### 4.3 대상 테이블에 외래 키

외래 키가 `LOCKER` 테이블에 있는데 `Member`에서만 `Locker`를 참조하는 단방향은 JPA가 지원하지 않는다. `Member`가 주인이 되려면 자기 테이블에 없는 `LOCKER.MEMBER_ID`를 관리해야 하는데, 일대다와 달리 일대일에는 그런 매핑이 없다. 그래서 대상 테이블에 외래 키를 두려면 반드시 양방향으로 만들고 **외래 키가 있는 `Locker`를 주인**으로 삼아야 한다.

```java
@Entity
public class Member {
    // 주인이 아니다
    @OneToOne(mappedBy = "member")
    private Locker locker;
}

@Entity
public class Locker {
    @OneToOne
    @JoinColumn(name = "MEMBER_ID",
                unique = true)
    private Member member;   // 주인
}
```

이 구조의 대가가 지연 로딩 한계다. `member.getLocker()`를 지연 로딩하려면 JPA는 회원을 조회한 시점에 "사물함이 있는가"를 알아야 한다. 있으면 프록시를 넣고 없으면 `null`을 넣어야 하는데, 프록시는 `null`을 흉내 낼 수 없기 때문이다. 외래 키가 `MEMBER` 테이블에 있으면 `LOCKER_ID` 값만 보고 판단할 수 있지만, `LOCKER` 테이블에 있으면 그 테이블을 조회해 보지 않고는 알 수 없다. 어차피 조회해야 하니 JPA는 `fetch = LAZY`를 적어도 무시하고 회원을 읽을 때 사물함까지 바로 읽는다. 셋째 원리가 가장 미묘하게 드러나는 자리다.

{{< callout type="info" >}}
`mappedBy` 쪽 일대일이 즉시 로딩으로 바뀌는 이유는 "없을 수도 있다"는 가능성 때문이다. 흔히 사물함이 반드시 있는 관계에 `@OneToOne(mappedBy = "member", optional = false)`를 주면 `null` 걱정이 없으니 프록시로 지연 로딩이 된다고 설명하지만, Hibernate 6는 그 설정을 줘도 회원을 읽을 때 사물함을 함께 읽는다. 바이트코드 향상(bytecode enhancement)을 켜야만 `mappedBy` 쪽 일대일을 미룰 수 있다. 지연 로딩이 중요하다면 주 테이블에 외래 키를 두는 것이 객체 탐색까지 포함해 가장 간단한 답이다. 프록시의 동작은 [Chapter 10. 프록시](../10-proxy-loading)에서 다룬다.
{{< /callout >}}

---

## 5. 다대다 [N:N]

### 5.1 테이블은 다대다를 표현하지 못한다

회원은 여러 상품을 주문하고, 상품은 여러 회원에게 팔린다. 객체는 양쪽에 컬렉션을 두면 끝이다. 테이블은 그렇게 못 한다. 컬럼 하나에는 값 하나만 들어가므로, `MEMBER` 행에 상품 여러 개를, `PRODUCT` 행에 회원 여러 개를 외래 키로 담을 수 없다. 관계형 모델의 이 제약 때문에 다대다는 항상 **연결 테이블**로 풀어서 일대다 둘로 바꿔야 한다.

```
 객체    Member ◀──N:N──▶ Product

 테이블  MEMBER ─▶ MEMBER_PRODUCT
         PRODUCT ─▶ MEMBER_PRODUCT
         (MEMBER_ID FK, PRODUCT_ID FK)
```

### 5.2 @ManyToMany: 연결 테이블을 숨겨 준다

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    @ManyToMany
    @JoinTable(
        name = "MEMBER_PRODUCT",
        // 연결 테이블
        joinColumns =
            @JoinColumn(
                name = "MEMBER_ID"),
        // 이쪽을 가리키는 외래 키
        inverseJoinColumns =
            @JoinColumn(
                name = "PRODUCT_ID")
        // 저쪽을 가리키는 외래 키
    )
    private List<Product> products =
        new ArrayList<>();
}

@Entity
public class Product {
    @Id @GeneratedValue
    @Column(name = "PRODUCT_ID")
    private Long id;

    // 양방향이 필요할 때만
    @ManyToMany(mappedBy = "products")
    private List<Member> members =
        new ArrayList<>();
}
```

`@ManyToMany`와 `@JoinTable`을 쓰면 연결 테이블을 JPA가 대신 관리한다. `member.getProducts().add(product)` 한 줄이면 `MEMBER_PRODUCT`에 행이 들어간다. 객체 모델은 깨끗하고, 개발자는 연결 테이블의 존재를 잊을 수 있다. 바로 그 점이 문제다.

### 5.3 왜 실무에서는 쓰지 않는가

첫째, **연결 테이블에 컬럼을 추가할 수 없다.** 주문 수량, 주문 일자처럼 관계 자체에 붙는 정보는 연결 테이블에 들어가야 하는데, `@ManyToMany`가 관리하는 테이블에는 두 외래 키 말고 아무것도 넣을 수 없다. 엔티티가 아니기 때문이다. "주문 수량 컬럼 하나 추가해 주세요"라는 요청이 오는 순간 매핑을 통째로 바꿔야 한다. 그리고 그 요청은 반드시 온다.

둘째, **숨겨진 테이블이 예상 밖의 SQL을 만든다.** 컬렉션을 인덱스 없는 `List`로 선언하면 Hibernate는 그것을 중복이 허용되는 가방(bag)으로 다룬다. 가방에서 상품 하나를 제거하면 어느 행이 빠진 것인지 가리킬 방법이 없어, 그 회원의 연결 행을 전부 DELETE한 뒤 남은 것을 다시 INSERT한다. `Set`으로 바꾸면 한 행만 지우고 연결 테이블에 두 외래 키를 묶은 기본 키도 생기지만, 어느 쪽이든 연결 테이블이 보이지 않으니 상품 백 개 중 하나를 뺐는데 SQL이 백 개 넘게 나가는 것을 알아채기 어렵다.

셋째, **관계에 관한 로직을 둘 곳이 없다.** 주문은 취소되고 배송되고 환불된다. 이런 행동은 연결 테이블에 대응하는 클래스가 있어야 붙일 수 있다.

### 5.4 연결 엔티티로 분해한다

해법은 연결 테이블을 숨기지 않고 **엔티티로 드러내는** 것이다. 다대다 하나를 다대일 둘로 바꾼다.

```
  Member ──▶ ORDERS ◀── Product
  ┌──────────────┐
  │ ORDER_ID  PK │  ← 대리 키
  │ MEMBER_ID FK │
  │ PRODUCT_ID FK│
  │ ORDER_AMOUNT │  ← 추가 컬럼 가능
  │ ORDER_DATE   │
  └──────────────┘
```

```java
@Entity
@Table(name = "ORDERS")
// ORDER는 SQL 예약어
public class Order {

    @Id @GeneratedValue
    @Column(name = "ORDER_ID")
    private Long id;
    // 관계 자체의 대리 키

    @ManyToOne
    @JoinColumn(name = "MEMBER_ID")
    private Member member;

    @ManyToOne
    @JoinColumn(name = "PRODUCT_ID")
    private Product product;

    // 관계에 붙는 정보
    private int orderAmount;
    private LocalDateTime orderDate;
}
```

```java
Order order = new Order();
order.setMember(member);
order.setProduct(product);
order.setOrderAmount(2);
order.setOrderDate(LocalDateTime.now());
em.persist(order);

Order found =
    em.find(Order.class, order.getId());
found.getMember();    // 다대일 탐색
found.getProduct();
```

`Order`는 지금까지 배운 다대일 매핑 두 개로 이루어진 평범한 엔티티다. 컬럼을 얼마든지 추가할 수 있고, 메서드를 붙일 수 있고, 발생하는 SQL도 그대로 보인다. 다대다를 마주치면 "이 관계에 이름을 붙이면 무엇인가"를 먼저 묻는 습관이 유용하다. 회원과 상품 사이의 관계에는 이미 "주문"이라는 이름이 있었다.

**연결 엔티티의 기본 키는 어떻게 할 것인가.** 두 외래 키를 묶어 복합 기본 키로 쓰는 식별 관계도 가능하다. 그러나 [Chapter 07](../07-entity-mapping)에서 본 대리 키 논리가 여기서 더 강하게 적용된다. 회원이 같은 상품을 두 번 주문하는 순간 `(MEMBER_ID, PRODUCT_ID)` 복합 키는 중복되어 표현할 수 없게 된다. 복합 키는 별도의 식별자 클래스와 `equals()`, `hashCode()`가 필요해 코드도 무거워진다. 관계에 독립적인 대리 키를 주는 **비식별 관계**가 기본 선택이고, 복합 키가 필요한 경우의 매핑 방법(`@IdClass`, `@EmbeddedId`)은 [Chapter 09. 고급 매핑](../09-advanced-mapping)에서 다룬다.

---

## 핵심 정리

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 세 가지 결정 | 다중성은 업무가, 방향과 주인은 설계가 정한다 | 테이블은 외래 키 하나, 객체는 참조 둘이라 누가 관리할지 정해야 한다 |
| 주인 | 외래 키가 있는 테이블의 엔티티. 반대쪽은 `mappedBy` | INSERT 한 문장에 외래 키를 넣을 수 있다 |
| 외래 키 변경 | 주인 쪽에서만 바꾼다 | 주인이 아닌 쪽의 변경은 SQL에 반영되지 않는다 |
| 편의 메서드 | 양방향은 한 번의 호출로 양쪽을 맞춘다. 한쪽에만 둔다 | 1차 캐시의 컬렉션은 스스로 갱신되지 않는다 |
| 순환 | `toString()`과 JSON 직렬화에서 연관 필드 제외. 응답은 DTO | 양방향 참조는 순환 구조다 |
| N:1 | 다대일 단방향으로 시작, 필요하면 양방향 | 외래 키가 있는 N 쪽이 주인이라 자연스럽다 |
| 1:N | 다대일 양방향으로 대체. 단방향이 꼭 필요하면 `@JoinColumn` 필수 | 주인과 외래 키 테이블이 달라 UPDATE가 더 나가고, `@JoinColumn`이 없으면 연결 테이블이 생긴다 |
| 1:1 | 주 테이블에 외래 키 + 유니크 | 대상 테이블 쪽 `mappedBy`는 지연 로딩이 안 된다 |
| N:N | 연결 엔티티 + 대리 키 | `@ManyToMany`는 연결 테이블에 컬럼도 로직도 넣을 수 없다 |

{{< callout type="info" >}}
**용어 정리**
- **다중성 / 방향 / 주인**: 연관관계를 매핑할 때 정하는 세 가지
- **연관관계 주인**: 외래 키를 등록·수정하는 쪽. `@JoinColumn`이 붙는다
- **`mappedBy`**: 주인이 아님을 선언하고 주인 쪽 필드 이름을 가리키는 속성
- **연관관계 편의 메서드**: 양방향 참조를 한 번의 호출로 함께 맞추는 메서드
- **일대다 단방향**: 1 쪽이 주인인 매핑. 외래 키가 다른 테이블에 있어 UPDATE가 더 나간다
- **주 테이블 / 대상 테이블**: 일대일에서 외래 키를 둘 수 있는 두 자리
- **연결 테이블**: 다대다를 일대다 둘로 푸는 테이블. 외래 키 두 개를 담는다
- **`@JoinTable`**: `@ManyToMany`가 관리하는 연결 테이블을 지정하는 어노테이션
- **가방(bag)**: 인덱스 없는 `List` 컬렉션. 중복이 허용되고 특정 행을 가리킬 수 없다
- **연결 엔티티**: 연결 테이블을 엔티티로 드러낸 것. 다대일 둘로 이루어진다
- **식별 관계 / 비식별 관계**: 외래 키를 기본 키에 포함하는 복합 키 / 별도의 대리 키
{{< /callout >}}
