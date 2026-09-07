---
title: "Chapter 10. 프록시와 연관관계 관리"
date: 2025-12-25
weight: 10
---

[Chapter 01](../01-jpa-intro)에서 JPA는 연관된 객체를 "실제로 쓰는 순간" 가져오겠다고 약속했고, [Chapter 06](../06-flush-and-detached)에서 그 약속이 깨지는 순간인 `LazyInitializationException`을 봤다. 이 장은 그 약속을 실제로 지키는 장치인 **프록시**가 어떻게 생겼는지, 즉시 로딩과 지연 로딩 중 무엇을 언제 골라야 하는지, 그리고 연관된 엔티티의 생명을 부모가 함께 책임지는 **영속성 전이**와 **고아 객체 제거**를 다룬다. 셋을 관통하는 질문은 "연관된 객체를 언제 가져오고, 누가 그 생명을 책임지는가"다.

---

## 1. 프록시

### 1.1 왜 가짜 객체가 필요한가

회원을 조회할 때 팀까지 항상 함께 읽어 오면 팀이 필요 없는 화면에서도 조인이 붙는다. 그렇다고 `member.getTeam()`에 `null`을 넣어 두면 1장에서 본 "엔티티를 믿을 수 없다"는 문제로 돌아간다. 필요한 것은 **`null`이 아니면서 아직 DB를 읽지 않은 무언가**다. 진짜 `Team`처럼 생겨서 어디든 넘길 수 있고, 값이 실제로 필요해지는 순간에만 DB를 읽는 대역. 그것이 프록시다.

```java
Member member = em.find(Member.class, 1L);          // SELECT 실행. 실제 엔티티
Member member = em.getReference(Member.class, 1L);  // SQL 없음. 프록시
```

```
em.find()             em.getReference()
    │                         │
    ▼                         ▼
SELECT 실행            프록시 반환
    │                    (SQL 없음)
    ▼                         │
실제 엔티티 반환     처음 사용하는 순간
                              ▼
                    SELECT 실행 후 채움
```

`find()`는 그 자리에서 SELECT를 실행해 실제 엔티티를 돌려준다. `getReference()`는 SQL 없이 프록시를 돌려주고, 프록시는 값이 처음 요구될 때 DB를 읽는다. 개발자가 `getReference()`를 직접 부를 일은 드물지만, 지연 로딩으로 설정된 연관관계 필드에 JPA가 넣어 주는 것이 바로 이 프록시다.

### 1.2 프록시의 생김새

```
  ┌──────────────────┐
  │      Member      │ 실제 엔티티
  │ id, name         │
  │ getId(), getName │
  └────────▲─────────┘
           │ extends
  ┌────────┴─────────┐
  │   Member$Proxy   │ 프록시
  │ target ──▶ 실제  │
  │ getName():       │
  │   초기화 후 위임 │
  └──────────────────┘
```

프록시가 진짜처럼 보이려면 타입이 같아야 한다. 그래서 Hibernate는 실행 중에 엔티티 클래스를 **상속한 하위 클래스**를 만들어 프록시로 쓴다. [Chapter 07](../07-entity-mapping)에서 엔티티를 `final`로 선언하면 안 된다고 한 이유가 이것이다. 프록시 안에는 실제 엔티티를 가리킬 `target` 참조가 비어 있고, 메서드를 부르면 먼저 `target`을 채운 뒤 그쪽으로 위임한다.

```java
class Member$Proxy extends Member {
    Member target;                        // 처음에는 null

    public String getName() {
        if (target == null) {
            target = /* 영속성 컨텍스트를 통해 DB에서 가져온 실제 Member */;
        }
        return target.getName();          // 실제 엔티티에 위임
    }
}
```

"상속한 하위 클래스"라는 사실에서 주의점 셋이 나온다.

| 상황 | 결과 | 이유 |
|:-----|:-----|:-----|
| `member.getClass() == Member.class` | `false`일 수 있다 | 프록시는 하위 클래스다. `instanceof`를 쓴다 |
| `equals()`에서 `other.id` 처럼 필드에 직접 접근 | `null`을 읽는다 | 프록시의 필드는 비어 있다. 값은 `target`에 있으므로 `other.getId()`처럼 getter를 거친다 |
| `item instanceof Album` (`item`은 `Item` 프록시) | 실제로 앨범이어도 `false` | 프록시는 `Item`의 하위 클래스이지 `Album`의 하위 클래스가 아니다 |

세 번째가 상속 관계 매핑과 지연 로딩이 만나는 지점의 함정이다. `Item` 타입으로 지연 로딩된 프록시는 실제 행이 앨범이라도 `Album`으로 캐스팅되지 않는다. `Hibernate.unproxy(item)`으로 실제 엔티티를 꺼내거나, 처음부터 조인해서 가져오는 것이 해법이다.

### 1.3 초기화: 값을 처음 요구하는 순간

```
member.getName()
     │
     ▼
프록시: target이 비어 있나?
     │ 비어 있다
     ▼
영속성 컨텍스트에 조회 요청
     │ 1차 캐시에 없으면
     ▼
SELECT ... FROM MEMBER
     │
     ▼
target = 실제 엔티티
     │
     ▼
target.getName() 위임
```

프록시가 `target`을 채우는 것을 **초기화**라 한다. 초기화는 프록시가 직접 DB에 가는 것이 아니라 **영속성 컨텍스트를 통해** 이루어진다. 이 경로 때문에 앞 장들의 규칙이 그대로 적용된다.

- **초기화는 한 번이다.** 채워진 `target`은 그대로 남고, 이후 호출은 전부 위임된다. 초기화됐다고 프록시 객체가 실제 엔티티로 바뀌지는 않는다. 참조를 들고 있는 쪽은 끝까지 프록시를 들고 있다.
- **이미 1차 캐시에 있으면 프록시를 만들지 않는다.** `em.find()`로 읽어 둔 회원을 다시 `getReference()`하면 프록시가 아니라 실제 엔티티가 돌아온다. [Chapter 03](../03-persistence-context)의 "식별자당 인스턴스 하나"를 지키기 위해서다. 같은 회원이 프록시와 실제 엔티티 두 인스턴스로 존재하면 동일성이 깨진다.
- **영속성 컨텍스트가 없으면 초기화할 수 없다.** 트랜잭션이 끝나 컨텍스트가 닫힌 뒤 프록시를 건드리면 `LazyInitializationException`이다. 프록시가 조회를 부탁할 상대가 없기 때문이다. 6장에서 본 준영속 상태의 지연 로딩 예외가 정확히 이것이다.

```java
Member member = em.getReference(Member.class, 1L);
tx.commit();
em.close();          // 컨텍스트 종료

member.getName();    // LazyInitializationException
```

### 1.4 식별자는 초기화 없이 안다

프록시는 식별자로 만들어졌다. `getReference(Team.class, 1L)`의 `1L`이 프록시 안에 들어 있으므로, `getId()`는 DB를 읽지 않고 답할 수 있다. 이 성질을 활용하면 외래 키만 설정하는 작업에서 SELECT 하나를 아낄 수 있다.

```java
Member member = em.find(Member.class, 1L);
Team team = em.getReference(Team.class, 10L);   // SELECT 없음
member.setTeam(team);                           // TEAM_ID = 10. 팀을 읽을 필요가 없다
```

회원의 소속 팀을 바꾸는 데 필요한 것은 팀의 식별자뿐이다. 팀 이름이나 다른 컬럼은 UPDATE 문에 들어가지 않는다. 그런데 `em.find()`로 팀을 가져오면 쓰지도 않을 팀 행을 읽는 SELECT가 나간다. `getReference()`는 그 SELECT를 없앤다.

{{< callout type="info" >}}
Hibernate는 5.2.13부터 접근 방식(필드/프로퍼티)과 무관하게 프록시의 `getId()`를 초기화 없이 처리한다. JPA 명세는 프록시의 어떤 메서드를 불러도 초기화하라고 하지만, Hibernate는 이 부분을 일부러 따르지 않는다. 명세대로 동작시키는 `hibernate.jpa.compliance.proxy=true` 설정이 있으나 Hibernate 스스로 권하지 않는 옵션이다.
{{< /callout >}}

### 1.5 확인하고 강제하는 도구

```java
// 초기화됐는지
emf.getPersistenceUnitUtil().isLoaded(member);   // JPA 표준
Hibernate.isInitialized(member);                 // Hibernate

// 지금 초기화해 둔다 (트랜잭션이 끝나기 전에 미리 채울 때)
Hibernate.initialize(member);

// 프록시를 벗기고 실제 엔티티를 꺼낸다 (1.2절의 캐스팅 문제)
Item real = Hibernate.unproxy(item, Item.class);
```

`Hibernate.initialize()`는 6장에서 본 "트랜잭션 안에서 필요한 것을 미리 로딩한다"의 명시적 형태다. `member.getTeam().getName()`처럼 getter를 불러 초기화하는 것과 결과는 같지만, 초기화가 목적이라는 의도가 코드에 드러난다.

---

## 2. 즉시 로딩과 지연 로딩

### 2.1 두 전략이 만드는 SQL

```java
@Entity
public class Member {
    @ManyToOne(fetch = FetchType.EAGER)   // 즉시 로딩
    @JoinColumn(name = "TEAM_ID")
    private Team team;

    @OneToMany(mappedBy = "member", fetch = FetchType.LAZY)   // 지연 로딩
    private List<Order> orders = new ArrayList<>();
}
```

| 전략 | `em.find(Member.class, 1L)` | `member.getTeam().getName()` |
|:-----|:---------------------------|:-----------------------------|
| 즉시 로딩 (EAGER) | `MEMBER`와 `TEAM`을 조인해 한 번에 조회 | 이미 있으므로 SQL 없음 |
| 지연 로딩 (LAZY) | `MEMBER`만 조회. `team`에는 프록시 | 이 시점에 `TEAM` 조회 |

즉시 로딩은 "이 연관 객체는 어차피 늘 같이 쓰니 처음부터 가져와라"이고, 지연 로딩은 "쓸 때 가져와라"다. 즉시 로딩은 조인 한 번으로 끝나니 두 번 왕복하는 지연 로딩보다 SQL 수가 적다. 이것만 보면 즉시 로딩이 나아 보인다. 실제로는 그 반대의 결론이 나오는데, 이유를 보려면 기본값부터 봐야 한다.

### 2.2 왜 기본값이 관계마다 다른가

| 연관관계 | 기본 페치 전략 | 이유 |
|:---------|:---------------|:-----|
| `@ManyToOne`, `@OneToOne` | EAGER | 상대가 행 하나다. 조인 비용이 작다 |
| `@OneToMany`, `@ManyToMany` | LAZY | 상대가 컬렉션이다. 수천 행일 수 있다 |

JPA 명세는 다중성으로 기본값을 갈랐다. 상대가 하나면 조인해 오는 비용이 작으니 즉시, 여럿이면 얼마나 될지 모르니 지연이다. 합리적으로 들리지만, 이 기본값은 `em.find()` 하나만 놓고 본 판단이다.

### 2.3 그런데 왜 실무에서는 전부 지연 로딩인가

문제는 JPQL이다. JPQL은 작성한 그대로 SQL이 된다. `select m from Member m`은 `MEMBER` 테이블만 조회하는 SQL이 된다. 그런데 `team`이 즉시 로딩이면 JPA는 조회 결과를 돌려주기 전에 각 회원의 팀을 **반드시 채워 놓아야** 한다. 조인은 이미 지나갔으니 방법은 하나, 회원마다 팀을 따로 조회하는 것이다.

```
select m from Member m      (JPQL)
     │
     ▼
SELECT * FROM MEMBER      회원 100명
     │  EAGER: 팀을 지금 채워야 한다
     ▼
SELECT * FROM TEAM WHERE ID=?  ×N
```

회원 100명을 조회하는 JPQL 한 줄이 SQL 101개가 된다. 이것이 **N+1 문제**다. 즉시 로딩의 진짜 비용은 조인이 아니라, 개발자가 통제할 수 없는 시점에 터지는 추가 SELECT다. 연관관계가 여럿이고 그 연관 엔티티에도 즉시 로딩이 걸려 있으면 하나를 조회했을 뿐인데 연쇄적으로 테이블 여럿이 읽힌다.

지연 로딩이라고 N+1이 없는 것은 아니다. 회원 100명을 돌면서 `getTeam().getName()`을 부르면 똑같이 100번 SELECT가 나간다. 차이는 **통제권**이다. 지연 로딩에서는 아무것도 하지 않으면 회원만 읽고, 팀이 필요한 화면에서만 페치 조인으로 함께 가져오거나 `@BatchSize`로 팀들을 IN 절 하나에 묶어 읽을 수 있다. 즉시 로딩은 필요 없는 화면에서도 팀을 읽고, 필요한 화면에서는 N+1을 낸다. 어느 쪽에서도 개발자가 고를 수 없다.

{{< callout type="warning" >}}
**모든 연관관계를 지연 로딩으로 두는 것이 기본이다.** 기본값이 즉시 로딩인 `@ManyToOne`과 `@OneToOne`에는 `fetch = FetchType.LAZY`를 명시한다. 함께 조회해야 하는 화면에서는 JPQL의 **페치 조인**으로 그 화면에서만 즉시 가져온다. 페치 조인은 [Chapter 12. 객체지향 쿼리](../12-object-oriented-query)에서 다룬다.
{{< /callout >}}

### 2.4 즉시 로딩의 조인 종류

즉시 로딩을 쓰는 경우 조인이 내부 조인인지 외부 조인인지는 **연관 객체가 없을 수 있는가**로 정해진다.

```java
@ManyToOne(fetch = FetchType.EAGER, optional = false)   // 팀이 반드시 있다 → 내부 조인
@JoinColumn(name = "TEAM_ID", nullable = false)
private Team team;
```

| 설정 | 조인 | 이유 |
|:-----|:-----|:-----|
| `optional = true`, `nullable = true` (기본) | 외부 조인 | 팀이 없는 회원도 조회돼야 한다. 내부 조인이면 그 회원이 결과에서 사라진다 |
| `optional = false`, `nullable = false` | 내부 조인 | 팀이 없는 회원은 없으므로 빠질 행이 없다. 내부 조인이 더 빠르다 |
| 컬렉션 (`@OneToMany`, `@ManyToMany`) | 항상 외부 조인 | 자식이 없는 부모도 조회돼야 한다. 컬렉션에는 `optional`이 없다 |

컬렉션을 즉시 로딩할 때는 하나 더 조심할 것이 있다. 컬렉션 둘을 동시에 즉시 로딩하면 결과가 **카테시안 곱**이 된다. 주문 10개와 쿠폰 5개를 가진 회원 하나가 50행으로 돌아온다. `List`로 선언된 컬렉션 둘을 한 번에 페치하려 하면 Hibernate는 아예 `MultipleBagFetchException`으로 거부한다. 컬렉션 즉시 로딩은 하나까지만, 그것도 되도록 지연 로딩과 페치 조인으로 대신한다.

### 2.5 컬렉션 래퍼

```java
Member member = em.find(Member.class, 1L);
member.getOrders().getClass().getName();   // org.hibernate...PersistentBag
```

연관 엔티티가 하나면 프록시가 자리를 지키지만, 컬렉션은 다르다. Hibernate는 엔티티의 컬렉션 필드를 **자기 컬렉션 구현**으로 바꿔치기한다. `ArrayList`로 초기화해 두어도 조회한 엔티티에서는 `PersistentBag` 같은 래퍼가 들어 있다. 이 래퍼가 컬렉션의 지연 로딩을 담당한다. `size()`, `get()`, 반복처럼 내용이 필요한 호출이 처음 오면 그때 SELECT를 실행한다.

왜 굳이 바꿔치기하는가. 지연 로딩만이 아니라 **추적** 때문이다. 컬렉션에 무엇이 추가되고 제거됐는지 알아야 [Chapter 05](../05-persistence-features)의 변경 감지가 컬렉션에도 동작하고, 4절의 고아 객체 제거도 가능하다. 평범한 `ArrayList`는 자신에게 무슨 일이 있었는지 말해 주지 않는다.

---

## 3. 영속성 전이 (CASCADE)

### 3.1 왜 필요한가

부모와 자식 둘을 저장하려면 `em.persist()`를 각각 불러야 한다. 자식이 셋이면 네 번이다. 번거로움도 문제지만 더 중요한 것은 **객체 그래프를 하나의 단위로 다루고 싶다**는 요구다. 주문과 주문 상품은 함께 만들어지고 함께 사라진다. 부모를 저장하면 자식도 저장되고, 부모를 지우면 자식도 지워지는 것이 객체 모델의 자연스러운 의미다.

영속성 전이는 엔티티 매니저의 **연산**을 연관된 엔티티로 전파한다. 매핑이나 DB 구조와는 관계가 없다. 외래 키가 어디 있든, 전이는 "이 엔티티에 `persist`를 하면 저쪽에도 `persist`를 하라"는 지시일 뿐이다.

| 옵션 | 전파되는 연산 |
|:-----|:--------------|
| `PERSIST` | `persist()` |
| `REMOVE` | `remove()` |
| `MERGE` | `merge()` |
| `DETACH` | `detach()` |
| `REFRESH` | `refresh()` |
| `ALL` | 위 전부 |

### 3.2 저장 전이

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent", cascade = CascadeType.PERSIST)
    private List<Child> children = new ArrayList<>();

    public void addChild(Child child) {   // 8장의 편의 메서드
        children.add(child);
        child.setParent(this);
    }
}

Parent parent = new Parent();
parent.addChild(new Child());
parent.addChild(new Child());

em.persist(parent);   // parent, child, child 모두 영속. 커밋 때 INSERT 3개
```

전이는 저장 시점에만 일어나는 것이 아니다. 이미 영속 상태인 부모의 컬렉션에 새 자식을 넣으면 **플러시 때** 그 자식에게도 `persist`가 전파된다. 부모를 조회한 뒤 `addChild(new Child())`만 해도 커밋 때 INSERT가 나가는 이유다. 5절의 생명주기 관리가 이 동작 위에 서 있다.

### 3.3 삭제 전이

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent", cascade = CascadeType.REMOVE)
    private List<Child> children = new ArrayList<>();
}

Parent parent = em.find(Parent.class, 1L);
em.remove(parent);
tx.commit();
// DELETE FROM CHILD  WHERE ID = ?   (자식 수만큼)
// DELETE FROM PARENT WHERE ID = ?
```

자식이 먼저 지워지고 부모가 나중에 지워진다. 순서가 반대면 자식의 외래 키가 사라진 부모를 가리키게 되어 DB가 거부하기 때문이다. 삭제 전이가 없는데 자식이 있는 부모를 지우면 바로 그 외래 키 제약 위반이 난다.

DB의 `ON DELETE CASCADE`와 비슷해 보이지만 다르다. JPA의 삭제 전이는 자식을 먼저 조회해서 하나씩 DELETE를 만들고 영속성 컨텍스트에서도 제거한다. 자식이 만 개면 SELECT 뒤에 DELETE 만 개다. 컨텍스트가 일관성을 유지한다는 장점과 SQL이 많이 나간다는 단점을 함께 갖는다.

{{< callout type="warning" >}}
삭제 전이는 **`@ManyToOne`이나 `@ManyToMany`에 절대 걸지 않는다.** 주문 상품에서 상품으로 `REMOVE`를 전이하면, 주문 상품 하나를 지울 때 그 상품 자체가 지워지고, 그 상품을 담은 다른 주문들이 외래 키 위반으로 함께 무너진다. 전이는 "자식은 이 부모에게만 속한다"는 관계, 즉 `@OneToMany`와 `@OneToOne`의 부모 쪽에서만 의미가 있다.
{{< /callout >}}

### 3.4 어디에 쓰고 어디에 쓰지 않는가

기준은 하나다. **자식이 이 부모에게만 속하고, 둘의 생명주기가 같은가.** 주문과 주문 상품은 그렇다. 주문 상품은 다른 주문에 속할 수 없고 주문이 사라지면 함께 사라진다. 회원과 팀은 그렇지 않다. 팀은 여러 회원이 공유하고, 회원이 탈퇴해도 팀은 남는다. 여기에 전이를 걸면 회원 하나를 지웠는데 팀이 사라진다.

---

## 4. 고아 객체 제거 (orphanRemoval)

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent", orphanRemoval = true)
    private List<Child> children = new ArrayList<>();
}

Parent parent = em.find(Parent.class, 1L);
parent.getChildren().remove(0);   // 컬렉션에서 뺐을 뿐인데
tx.commit();                      // DELETE FROM CHILD WHERE ID = ?
```

부모와의 연결이 끊긴 자식을 **고아**라 하고, `orphanRemoval = true`는 고아가 된 자식을 플러시 때 자동으로 지운다. 컬렉션에서 제거하는 것이 곧 삭제가 된다. `clear()`를 부르면 자식 전부가 지워진다.

왜 `@OneToOne`과 `@OneToMany`에서만 쓸 수 있는가. 고아 제거는 "연결이 끊긴 자식은 더 이상 아무에게도 속하지 않는다"는 가정 위에서만 안전하다. 부모가 하나뿐인 관계에서만 그 가정이 성립한다. 다른 부모도 참조할 수 있는 자식을 한 부모의 컬렉션에서 뺐다고 지워 버리면 다른 쪽이 깨진다.

삭제 전이와의 차이도 짚어 두자. 삭제 전이는 **부모를 지울 때** 자식을 함께 지우고, 고아 제거는 **연결을 끊을 때** 자식을 지운다. 다만 고아 제거를 켜면 부모를 지울 때도 자식이 지워진다. 부모가 사라지면 자식 전부가 고아이기 때문이다. 그래서 `orphanRemoval = true`는 `CascadeType.REMOVE`를 포함한 효과를 낸다.

{{< callout type="warning" >}}
고아 제거가 켜진 컬렉션은 **참조를 통째로 바꾸면 안 된다.** `parent.setChildren(new ArrayList<>())`처럼 컬렉션 자체를 교체하면 Hibernate는 추적하던 래퍼를 잃어버리고 "A collection with cascade=all-delete-orphan was no longer referenced by the owning entity instance" 예외를 던진다. 2.5절에서 본 래퍼가 변경을 추적하는 주체이기 때문이다. 내용을 바꾸고 싶으면 `clear()`한 뒤 `addAll()`로 같은 컬렉션 안에서 바꾼다.
{{< /callout >}}

---

## 5. 부모가 자식의 생명주기를 관리한다

`CascadeType.ALL`과 `orphanRemoval = true`를 함께 쓰면 자식의 생명주기 전체를 부모를 통해 다룰 수 있다. 자식에 대해 `em.persist()`나 `em.remove()`를 직접 부를 일이 사라진다.

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Child> children = new ArrayList<>();

    public void addChild(Child child) {
        children.add(child);
        child.setParent(this);
    }
}
```

```
parent.addChild(child)
     │  cascade PERSIST
     ▼
INSERT CHILD (플러시 때)

parent.getChildren().remove(child)
     │  orphanRemoval
     ▼
DELETE CHILD (플러시 때)

em.remove(parent)
     │  cascade REMOVE
     ▼
DELETE CHILD ×N, DELETE PARENT
```

```java
Parent parent = em.find(Parent.class, 1L);
parent.addChild(new Child());            // 저장: 부모에 넣기만 한다
parent.getChildren().remove(0);          // 삭제: 부모에서 빼기만 한다
em.remove(parent);                       // 부모 삭제: 자식도 함께
```

이 조합이 어울리는 곳은 3.4절의 기준을 만족하는 관계뿐이다. 자식이 부모에게만 속하고 함께 태어나 함께 사라지는 관계, 도메인 주도 설계에서 말하는 **애그리거트 루트**와 그 구성 요소가 정확히 이 모양이다. 주문과 주문 상품, 게시글과 첨부 파일이 그렇다. 반대로 여러 곳에서 공유되는 엔티티에 이 조합을 걸면, 한 부모의 편의를 위해 다른 부모의 자식을 지우는 사고가 난다.

---

## 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 프록시 | 엔티티를 상속한 대역. 값을 처음 쓸 때 초기화 | `null`이 아니면서 아직 읽지 않은 객체가 필요하다 |
| 초기화 경로 | 영속성 컨텍스트를 통한다 | 동일성 보장과 준영속 예외가 여기서 나온다 |
| `getId()` | 초기화 없이 답한다 | 프록시는 식별자로 만들어졌다 |
| 기본 페치 전략 | 하나면 EAGER, 컬렉션이면 LAZY | 명세가 다중성으로 갈랐다 |
| 실무 페치 전략 | 전부 LAZY, 필요한 곳만 페치 조인 | EAGER는 JPQL에서 N+1을 내고 통제할 수 없다 |
| 조인 종류 | `optional = false`면 내부 조인 | 없을 수 있는 행을 내부 조인은 떨어뜨린다 |
| 컬렉션 래퍼 | Hibernate가 컬렉션을 바꿔치기한다 | 지연 로딩과 변경 추적을 위해 |
| 영속성 전이 | 엔티티 매니저 연산의 전파 | 객체 그래프를 한 단위로 다루기 위해 |
| 삭제 전이 금지 | `@ManyToOne`, `@ManyToMany` | 공유되는 상대를 지운다 |
| 고아 객체 제거 | 연결이 끊기면 삭제 | 부모가 하나뿐인 관계에서만 안전하다 |
| 생명주기 관리 | `ALL` + `orphanRemoval` | 애그리거트 루트와 구성 요소 |

### 핵심 코드

```java
// 프록시
Team team = em.getReference(Team.class, 10L);   // SQL 없음
member.setTeam(team);                           // 식별자만 쓴다
Hibernate.initialize(member.getTeam());         // 미리 초기화
Hibernate.unproxy(item, Item.class);            // 실제 엔티티 꺼내기

// 페치 전략: 전부 지연 로딩으로
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "TEAM_ID")
private Team team;

// 생명주기 관리: 부모가 자식을 책임진다
@OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Child> children = new ArrayList<>();
```
