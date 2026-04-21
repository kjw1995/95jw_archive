---
title: "Chapter 10. 프록시와 연관관계 관리"
weight: 10
---

프록시, 즉시/지연 로딩, 영속성 전이(CASCADE), 고아 객체 제거를 다룬다.

---

## 1. 프록시

### 1.1 프록시 기초

**프록시**는 실제 엔티티 대신 DB 조회를 지연할 수 있는 가짜 객체다. JPA 가 지연 로딩을 구현하는 핵심 장치이며, 실제 엔티티와 **같은 인터페이스/타입**을 가진다.

```
 em.find()                em.getReference()
     │                         │
     ▼                         ▼
 ┌────────────┐           ┌────────────┐
 │  DB 조회    │           │  프록시     │
 │  (즉시)     │           │  반환       │
 └─────┬──────┘           └─────┬──────┘
       ▼                        │
 ┌────────────┐                 │ 실제 사용 시
 │ 실제 엔티티 │                 ▼
 │  반환       │           ┌────────────┐
 └────────────┘           │ 초기화 →    │
                          │ 실제 엔티티  │
                          └────────────┘
```

```java
// 즉시 조회 - DB 조회 발생
Member member = em.find(Member.class, "member1");

// 지연 조회 - 프록시 반환, DB 조회 X
Member member = em.getReference(Member.class, "member1");
```

### 1.2 프록시 구조

```
   ┌──────────────────┐
   │      Member      │ ← 실제 엔티티
   │──────────────────│
   │ id / name        │
   │ getId()/getName()│
   └─────────▲────────┘
             │ extends
   ┌─────────┴────────┐
   │   MemberProxy    │ ← 프록시
   │──────────────────│
   │ Member target    │ ← 실제 참조
   │ getId()          │
   │  → target.getId()│
   │ getName()        │
   │  → 초기화 후 호출 │
   └──────────────────┘
```

프록시는 실제 클래스를 **상속** 받아 겉모양이 같다. 따라서 **타입 비교는 `==` 대신 `instanceof` 를 사용**해야 한다.

### 1.3 프록시 초기화 과정

```
 Client  Proxy  컨텍스트   DB
   │       │        │      │
   │getName│        │      │
   ├──────►│        │      │
   │       │ 초기화  │      │
   │       │ 요청   │      │
   │       ├───────►│ 조회 │
   │       │        ├─────►│
   │       │        │◄─────┤
   │       │ 실제    │      │
   │       │ 엔티티  │      │
   │       │◄───────┤      │
   │       │target= │      │
   │       │real    │      │
   │◄──────┤        │      │
   │       │        │      │
```

```java
class MemberProxy extends Member {
    Member target = null;   // 실제 엔티티 참조

    public String getName() {
        if (target == null) {
            // 영속성 컨텍스트 → DB 조회 → 실제 엔티티
            this.target = /* 실제 Member */;
        }
        return target.getName();
    }
}
```

### 1.4 프록시 특징

1. **한 번만 초기화** — 처음 사용할 때 한 번만
2. **프록시 ≠ 실제 엔티티** — 초기화 후에도 프록시 객체가 실제로 바뀌진 않음. 프록시를 통해 실제에 접근할 뿐
3. **타입 비교 주의** — `member.getClass() == Member.class` ❌, `member instanceof Member` ✅
4. **영속성 컨텍스트에 엔티티가 이미 있으면** — `getReference()` 도 실제 엔티티 반환
5. **준영속 상태에서는 초기화 불가** — `LazyInitializationException` 발생

```java
Member member = em.getReference(Member.class, "id1");
em.close();            // 영속성 컨텍스트 종료

member.getName();      // LazyInitializationException!
```

### 1.5 프록시와 식별자

```java
// 프록시는 식별자(PK)를 이미 알고 있음
Team team = em.getReference(Team.class, "team1");
team.getId();   // 초기화 X (이미 보유)

// 연관관계 설정 시 활용 (DB 접근 감소)
Member member = em.find(Member.class, "member1");
Team    team   = em.getReference(Team.class, "team1");
// SELECT TEAM 쿼리 실행 X
member.setTeam(team);   // 식별자만 사용 → 초기화 X
```

### 1.6 프록시 확인 유틸리티

```java
// 초기화 여부 확인
boolean isLoaded =
    emf.getPersistenceUnitUtil().isLoaded(entity);

// 프록시 클래스 확인
System.out.println(member.getClass().getName());
// 예: jpabook.Member$HibernateProxy$...

// 프록시 강제 초기화 (Hibernate)
Hibernate.initialize(member);

// 또는 메서드 호출로 자연스럽게 초기화
member.getName();
```

---

## 2. 즉시 로딩과 지연 로딩

### 2.1 개념 비교

```
 [즉시 로딩 - FetchType.EAGER]

  Member m = em.find(Member.class, id);

  SQL:
   SELECT M.*, T.*
   FROM   MEMBER M
   LEFT JOIN TEAM T ON M.TEAM_ID = T.ID
   WHERE  M.ID = ?

  결과: Member + Team 함께 조회

 [지연 로딩 - FetchType.LAZY]

  Member m = em.find(Member.class, id);
  SQL(1차):
   SELECT * FROM MEMBER WHERE ID = ?

  m.getTeam().getName();   // 실제 사용 시
  SQL(2차):
   SELECT * FROM TEAM WHERE ID = ?

  결과: Team 은 프록시 → 사용 시 조회
```

### 2.2 설정 방법

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;
    private String username;

    // 즉시 로딩
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "TEAM_ID")
    private Team team;

    // 지연 로딩
    @OneToMany(mappedBy = "member", fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();
}
```

### 2.3 JPA 기본 페치 전략

| 연관관계 | 기본 | 이유 |
|:---------|:-----|:-----|
| `@ManyToOne` | EAGER | 연관 엔티티 하나 |
| `@OneToOne` | EAGER | 연관 엔티티 하나 |
| `@OneToMany` | LAZY | 컬렉션 (많을 수 있음) |
| `@ManyToMany` | LAZY | 컬렉션 (많을 수 있음) |

{{< callout type="warning" >}}
**실무 권장: 모든 연관관계를 `LAZY` 로 통일**. 기본값이 EAGER 인 `@xToOne` 에는 반드시 `fetch=LAZY` 를 명시하자. 필요할 때만 **페치 조인(`JOIN FETCH`)** 으로 즉시 로딩하자. EAGER 를 남발하면 예측 불가능한 N+1 이 터진다.
{{< /callout >}}

### 2.4 즉시 로딩과 조인 전략

```
 nullable 설정에 따른 조인 전략:

  @JoinColumn(nullable = true)
    → LEFT OUTER JOIN (기본값)
  @JoinColumn(nullable = false)
    → INNER JOIN

 또는

  @ManyToOne(optional = true)
    → LEFT OUTER JOIN
  @ManyToOne(optional = false)
    → INNER JOIN

 이유:
  • nullable=true  → FK NULL 가능 → 외부 조인
  • nullable=false → FK NOT NULL → 내부 조인
  (내부 조인이 성능상 유리)
```

```java
@Entity
public class Member {
    // 내부 조인 강제 (TEAM_ID 가 항상 존재)
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "TEAM_ID", nullable = false)
    private Team team;
}
```

### 2.5 컬렉션에 EAGER 사용 시 주의점

1. **컬렉션 2개 이상 EAGER 권장 X**

   ```
    A ─┬─ 1:N ─ B (N개)
       └─ 1:N ─ C (M개)
    결과 행 수: N × M (카테시안 곱)
   ```

2. **컬렉션 즉시 로딩은 항상 OUTER JOIN**
   - 자식이 없는 부모도 조회해야 하므로 DB 제약으로 막을 수 없음

```
 FetchType.EAGER 조인 전략:

  @ManyToOne, @OneToOne
    optional=false  →  INNER JOIN
    optional=true   →  OUTER JOIN

  @OneToMany, @ManyToMany
    항상 OUTER JOIN (optional 무관)
```

### 2.6 컬렉션 래퍼

Hibernate 는 컬렉션을 추적·관리하기 위해 자체 래퍼로 교체한다.

```java
Member member = em.find(Member.class, id);

System.out.println(member.getOrders().getClass().getName());
// org.hibernate.collection.internal.PersistentBag

// 컬렉션 래퍼가 지연 로딩 처리
member.getOrders().get(0);   // 이 시점에 SQL 실행
```

{{< callout type="info" >}}
**주의**: 엔티티 필드를 직접 `new ArrayList<>()` 로 초기화할 때도 JPA 는 값을 가져올 때 자신의 래퍼로 **바꿔 치운다**. 그래서 `member.getOrders()` 가 호출된 시점에 기대하는 컬렉션과 다를 수 있지만, 동작에는 문제가 없다.
{{< /callout >}}

---

## 3. 영속성 전이 (CASCADE)

부모 엔티티 저장/삭제 시 연관된 자식 엔티티도 **함께 처리**되게 한다.

### 3.1 CASCADE 옵션 종류

| 옵션 | 설명 |
|:-----|:-----|
| ALL | 모든 옵션 적용 |
| PERSIST | 저장 전이 |
| REMOVE | 삭제 전이 |
| MERGE | 병합 전이 |
| REFRESH | 새로고침 전이 |
| DETACH | 준영속 전이 |

### 3.2 영속성 전이: 저장 (PERSIST)

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "parent",
               cascade = CascadeType.PERSIST)
    private List<Child> children = new ArrayList<>();

    public void addChild(Child child) {
        children.add(child);
        child.setParent(this);
    }
}

@Entity
public class Child {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "PARENT_ID")
    private Parent parent;
}

// 사용
Parent parent = new Parent();
parent.addChild(new Child());
parent.addChild(new Child());

em.persist(parent);   // child 도 자동 영속화
```

### 3.3 영속성 전이: 삭제 (REMOVE)

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent",
               cascade = CascadeType.REMOVE)
    private List<Child> children = new ArrayList<>();
}

// 사용
Parent parent = em.find(Parent.class, parentId);
em.remove(parent);   // 자식도 DELETE

// 실행 순서
// DELETE FROM CHILD  WHERE ID = ?
// DELETE FROM CHILD  WHERE ID = ?
// DELETE FROM PARENT WHERE ID = ?
```

{{< callout type="warning" >}}
`CASCADE.REMOVE` 가 없고 자식이 부모를 참조하는 FK 제약이 있는데 부모를 지우면 **FK 무결성 예외**가 발생한다. "자식의 생명주기를 부모가 관리" 하는 의도가 명확할 때만 CASCADE 를 쓰자.
{{< /callout >}}

---

## 4. 고아 객체 (orphanRemoval)

부모와 **연관관계가 끊어진** 자식 엔티티를 자동으로 삭제한다.

```
 Parent                    DB
 ┌─────────────────┐    DELETE FROM CHILD
 │ children:       │    WHERE ID = ?
 │  [Child1,Child2]│    (Child1)
 └─────────────────┘

 parent.getChildren().remove(0);
              ↓
 Parent                    DB
 ┌─────────────────┐
 │ children:       │
 │  [Child2]       │
 └─────────────────┘
```

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent",
               orphanRemoval = true)
    private List<Child> children = new ArrayList<>();
}

// 사용
Parent parent = em.find(Parent.class, parentId);
parent.getChildren().remove(0);   // DELETE 실행

parent.getChildren().clear();     // 모든 자식 DELETE
```

### 4.1 고아 객체 주의사항

1. **참조하는 곳이 하나일 때만 사용** — 자식이 오직 한 부모에게만 소속될 때
2. `@OneToOne`, `@OneToMany` 에서만 사용 가능
3. 부모 제거 시 자식도 제거 (`CascadeType.REMOVE` 와 동일 효과)

---

## 5. 영속성 전이 + 고아 객체 = 생명주기 관리

`CascadeType.ALL` + `orphanRemoval = true` 를 조합하면 **부모 엔티티를 통해 자식의 생명주기를 완전히 관리**할 수 있다.

```java
@Entity
public class Parent {
    @OneToMany(
        mappedBy = "parent",
        cascade = CascadeType.ALL,
        orphanRemoval = true)
    private List<Child> children = new ArrayList<>();

    public void addChild(Child child) {
        children.add(child);
        child.setParent(this);
    }
}

// 자식 저장 - 부모에 추가만
Parent parent = em.find(Parent.class, parentId);
parent.addChild(new Child());           // INSERT

// 자식 삭제 - 부모에서 제거만
parent.getChildren().remove(child);     // DELETE

// 부모 삭제 - 자식도 함께
em.remove(parent);                      // 전체 DELETE
```

```
 [일반 엔티티]
  • em.persist()/em.remove() 로 관리
  • 엔티티 스스로 생명주기 관리

 [CascadeType.ALL + orphanRemoval=true]
  • 부모.addChild() 로 영속화
  • 부모.getChildren().remove() 로 제거
  • 부모가 자식의 생명주기 관리

 → DDD 의 Aggregate Root 구현에 적합
```

---

## 6. 핵심 요약

### 프록시

- `em.getReference()`: 프록시 반환 (DB 조회 지연)
- 초기화: 실제 사용 시 영속성 컨텍스트 통해 DB 조회
- 준영속 상태에서 초기화 → `LazyInitializationException`
- 확인: `PersistenceUnitUtil.isLoaded()`, `Hibernate.initialize()`

### 즉시/지연 로딩

- EAGER: 엔티티 조회 시 연관 엔티티 JOIN
- LAZY: 연관 엔티티는 프록시, 사용 시점에 조회
- 기본값: `@xToOne → EAGER`, `@xToMany → LAZY`
- **실무**: 모두 LAZY + 필요 시 페치 조인

### 영속성 전이 (CASCADE)

- PERSIST: 부모 저장 시 자식도 저장
- REMOVE: 부모 삭제 시 자식도 삭제
- ALL: 모든 옵션 적용

### 고아 객체 (orphanRemoval)

- 연관관계 끊어진 자식 자동 삭제
- `@OneToOne`, `@OneToMany` 만 가능
- 참조가 하나일 때만 사용

### 생명주기 관리

- `CascadeType.ALL` + `orphanRemoval = true`
- 부모로 자식 생명주기 완전 관리

| 기능 | 설정 | 용도 |
|:-----|:-----|:-----|
| 지연 로딩 | `fetch = FetchType.LAZY` | 연관 엔티티 조회 지연 |
| 즉시 로딩 | `fetch = FetchType.EAGER` | 함께 조회 |
| 저장 전이 | `cascade = CascadeType.PERSIST` | 부모와 함께 저장 |
| 삭제 전이 | `cascade = CascadeType.REMOVE` | 부모와 함께 삭제 |
| 고아 객체 | `orphanRemoval = true` | 연관 끊기면 삭제 |
