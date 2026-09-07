---
title: "Chapter 09. 고급 매핑"
date: 2025-12-25
weight: 9
---

[Chapter 07](../07-entity-mapping)과 [Chapter 08](../08-various-relationships)에서 매핑의 기본 도구를 익혔다. 이 장은 그 도구만으로는 매끄럽게 풀리지 않는 네 가지 상황을 다룬다. 객체에는 있는데 테이블에는 없는 **상속**, 매핑 정보는 물려받되 테이블은 만들고 싶지 않은 **공통 속성**, 기본 키가 여러 컬럼인 **복합 키**, 그리고 외래 키 대신 별도 테이블로 관계를 표현하는 **조인 테이블**이다. 넷을 관통하는 질문은 하나다. 객체 모델과 테이블 모델이 어긋나는 지점을 어느 쪽에 맞춰 풀 것인가.

---

## 1. 상속 관계 매핑

### 1.1 왜 전략이 셋이나 필요한가

[Chapter 01](../01-jpa-intro)에서 봤듯 관계형 DB에는 상속이 없다. 가장 비슷한 것이 슈퍼타입-서브타입 모델링인데, 이것은 하나의 정답이 아니라 **흉내 내는 방법의 묶음**이다. 부모와 자식을 각각 테이블로 만들어 조인할 수도 있고, 전부 한 테이블에 넣을 수도 있고, 자식마다 부모 컬럼을 복사해 독립 테이블을 만들 수도 있다. 세 방법은 정규화, 조회 성능, 단순함 가운데 무엇을 우선하느냐가 다르다. JPA는 셋을 모두 지원하고 선택을 개발자에게 맡긴다.

| 전략 | `@Inheritance(strategy = ...)` | 테이블 | 우선하는 것 |
|:-----|:-------------------------------|:-------|:------------|
| 조인 | `JOINED` | 부모 1 + 자식 N | 정규화 |
| 단일 테이블 | `SINGLE_TABLE` (기본값) | 1 | 조회 성능, 단순함 |
| 구현 클래스별 테이블 | `TABLE_PER_CLASS` | 자식 N | 자식 테이블의 독립성 |

세 전략은 어노테이션 세 개를 공유한다. 부모 클래스에 `@Inheritance`로 전략을 정하고, `@DiscriminatorColumn`으로 **구분 컬럼**을 두고, 자식 클래스에 `@DiscriminatorValue`로 그 컬럼에 들어갈 값을 정한다. 구분 컬럼이 필요한 이유는 조회 때문이다. `em.find(Item.class, 1L)`처럼 부모 타입으로 조회하면 JPA는 1번 행이 앨범인지 영화인지 알아야 그에 맞는 객체를 만들 수 있다. 행에 적힌 구분 값이 그 답이다.

### 1.2 조인 전략 (JOINED)

```
        ┌──────────────┐
        │     ITEM     │
        │ ITEM_ID  PK  │
        │ NAME, PRICE  │
        │ DTYPE        │
        └──────┬───────┘
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 ┌────────┐┌────────┐┌────────┐
 │ ALBUM  ││ MOVIE  ││  BOOK  │
 │ ID  FK ││ ID  FK ││ ID  FK │
 │ ARTIST ││DIRECTOR││ AUTHOR │
 └────────┘└────────┘└────────┘
```

```java
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "DTYPE")
public abstract class Item {
    @Id @GeneratedValue
    @Column(name = "ITEM_ID")
    private Long id;

    private String name;
    private int price;
}

@Entity
@DiscriminatorValue("A")
public class Album extends Item {
    private String artist;
}

@Entity
@DiscriminatorValue("M")
public class Movie extends Item {
    private String director;
    private String actor;
}

@Entity
@DiscriminatorValue("B")
@PrimaryKeyJoinColumn(name = "BOOK_ID")   // 자식 테이블의 키 컬럼 이름을 바꿀 때
public class Book extends Item {
    private String author;
    private String isbn;
}
```

공통 컬럼은 `ITEM`에, 자식 고유 컬럼은 각 자식 테이블에 들어간다. 자식 테이블의 기본 키는 부모의 기본 키를 그대로 쓰면서 동시에 외래 키다. 그래서 앨범 하나를 저장하면 `ITEM`과 `ALBUM`에 INSERT가 한 번씩 나가고, 앨범 하나를 조회하면 두 테이블을 조인한다. 부모 타입으로 조회하면 어느 자식인지 모르므로 자식 테이블 전부를 외부 조인한다.

```sql
-- em.persist(album)
INSERT INTO ITEM (ITEM_ID, NAME, PRICE, DTYPE) VALUES (?, ?, ?, 'A');
INSERT INTO ALBUM (ITEM_ID, ARTIST) VALUES (?, ?);

-- em.find(Album.class, 1L)
SELECT ... FROM ALBUM A JOIN ITEM I ON A.ITEM_ID = I.ITEM_ID WHERE I.ITEM_ID = ?;

-- em.find(Item.class, 1L): 어느 자식인지 모른다
SELECT ... FROM ITEM I
  LEFT OUTER JOIN ALBUM A ON ...
  LEFT OUTER JOIN MOVIE M ON ...
  LEFT OUTER JOIN BOOK  B ON ...
 WHERE I.ITEM_ID = ?;
```

| 장점 | 단점 |
|:-----|:-----|
| 테이블이 정규화되어 있다 | 조회에 조인이 따라온다 |
| 외래 키 참조 무결성을 쓸 수 있다 | 저장할 때 INSERT가 두 번 나간다 |
| 자식 컬럼에 NOT NULL을 걸 수 있다 | 자식이 많으면 부모 타입 조회의 조인이 길어진다 |

조인 전략에서 구분 컬럼은 선택이다. Hibernate는 조인 결과에서 어느 자식 테이블에 행이 있는지를 보고 타입을 알아낼 수 있다. 그래도 `DTYPE`을 두는 것이 좋다. SQL로 테이블을 직접 볼 때 한눈에 타입을 알 수 있고, 다른 도구가 데이터를 읽을 때도 그렇다.

### 1.3 단일 테이블 전략 (SINGLE_TABLE)

```
 ┌────────────────────────────┐
 │            ITEM            │
 │ ITEM_ID PK  NAME  PRICE    │
 │ DTYPE                      │
 │ ARTIST    ← Album만 사용   │
 │ DIRECTOR  ← Movie만        │
 │ AUTHOR    ← Book만         │
 └────────────────────────────┘
   다른 타입의 행에서는 NULL
```

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "DTYPE")
public abstract class Item { ... }

@Entity
@DiscriminatorValue("A")
public class Album extends Item {
    private String artist;
}
```

부모와 모든 자식의 컬럼을 테이블 하나에 몰아넣는다. 저장은 INSERT 한 번, 조회는 조인 없이 끝난다. JPA가 이 전략을 **기본값**으로 둔 이유가 그것이다. 조인이 없으니 가장 빠르고 SQL도 단순하다.

대가는 두 가지다. 첫째, **자식 고유 컬럼은 전부 NULL을 허용해야 한다.** `ARTIST`는 앨범 행에만 값이 있고 영화 행에서는 비어 있어야 하니, DB 수준에서 `ARTIST NOT NULL`을 걸 방법이 없다. 둘째, 자식 종류와 컬럼이 늘수록 테이블이 넓어지고 대부분의 칸이 비게 된다. 넓은 테이블은 그 자체로 조회 성능을 갉아먹으므로, 자식이 많고 서로 다른 컬럼이 많다면 이 전략의 장점이 사라진다.

이 전략에서 구분 컬럼은 **필수**다. 테이블이 하나뿐이라 행이 어느 타입인지 알려 줄 다른 단서가 없다. `@DiscriminatorColumn`을 생략해도 Hibernate가 `DTYPE`이라는 이름으로 만들어 준다.

### 1.4 구현 클래스별 테이블 전략 (TABLE_PER_CLASS)

```
 (부모 테이블 없음)

 ┌────────┐ ┌────────┐ ┌────────┐
 │ ALBUM  │ │ MOVIE  │ │  BOOK  │
 │ ID  PK │ │ ID  PK │ │ ID  PK │
 │ NAME   │ │ NAME   │ │ NAME   │
 │ PRICE  │ │ PRICE  │ │ PRICE  │
 │ ARTIST │ │DIRECTOR│ │ AUTHOR │
 └────────┘ └────────┘ └────────┘
   부모 컬럼이 테이블마다 반복된다
```

```java
@Entity
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Item { ... }

@Entity
public class Album extends Item {   // 구분 값이 필요 없다. 테이블이 곧 타입이다
    private String artist;
}
```

자식마다 부모 컬럼을 포함한 완전한 테이블을 만든다. 부모 테이블은 없다. 자식만 놓고 보면 각 테이블이 독립적이고 NOT NULL도 자유롭게 쓸 수 있어 깔끔해 보인다.

문제는 부모 타입으로 다룰 때 터진다. `em.find(Item.class, 1L)`은 1번이 어느 테이블에 있는지 모르므로 세 테이블을 **UNION**으로 전부 뒤져야 한다. JPQL로 `select i from Item i`를 실행해도 마찬가지다. 자식이 늘수록 UNION이 길어지고, 통합 조회가 느려진다.

더 근본적인 제약도 있다. 세 테이블에 흩어진 행이 모두 "아이템"이므로 기본 키가 테이블 사이에서도 겹치지 않아야 한다. 앨범 1번과 영화 1번이 동시에 있으면 `Item` 1번이 둘이 된다. 그래서 테이블마다 따로 번호를 매기는 IDENTITY 전략은 이 방식과 함께 쓸 수 없고, 시퀀스처럼 테이블 밖에서 번호를 만드는 전략이 필요하다. DB 설계자와 ORM 개발자 모두 권하지 않는 전략이다.

### 1.5 어느 전략을 고를 것인가

| 기준 | 조인 | 단일 테이블 | 클래스별 테이블 |
|:-----|:-----|:------------|:----------------|
| 테이블 수 | 부모 + 자식 | 1 | 자식 수 |
| 조회 | 조인 | 없음 | UNION |
| 저장 | INSERT 2회 | INSERT 1회 | INSERT 1회 |
| 자식 컬럼 NOT NULL | 가능 | 불가 | 가능 |
| 구분 컬럼 | 선택 | 필수 | 불필요 |
| IDENTITY 키 | 가능 | 가능 | 불가 |

기준은 자식 고유 컬럼의 양이다. 자식마다 컬럼이 몇 개 안 되고 조회가 잦다면 단일 테이블이 단순하고 빠르다. 자식이 서로 크게 다르고 NULL로 뒤덮인 넓은 테이블이 걱정된다면 조인 전략이 낫다. 클래스별 테이블은 부모 타입으로 다룰 일이 전혀 없다는 확신이 있을 때만 고려할 수 있는데, 그런 경우라면 애초에 상속으로 매핑할 이유도 약하다.

{{< callout type="info" >}}
전략은 부모 클래스에서 한 번 정하고 계층 전체에 적용된다. 처음에 단일 테이블로 시작했다가 조인 전략으로 바꾸는 것은 테이블 구조를 뒤집는 마이그레이션이다. 자식이 몇 개나 될지, 각 자식에 어떤 컬럼이 붙을지를 먼저 그려 보고 고르는 것이 좋다.
{{< /callout >}}

---

## 2. @MappedSuperclass: 매핑만 물려주기

### 2.1 상속은 하고 싶은데 테이블은 만들고 싶지 않다

모든 엔티티에 `id`, `createdAt`, `updatedAt`이 들어간다고 해 보자. 부모 클래스로 뽑아내고 싶지만, 그 부모는 개념적인 "아이템"이 아니다. `BaseEntity`라는 테이블이 있을 이유도, 부모 타입으로 조회할 이유도 없다. 1절의 상속 매핑은 이런 용도에 맞지 않는다. 부모도 엔티티로 취급해 테이블이나 구분 컬럼을 만들기 때문이다.

`@MappedSuperclass`는 이 간극을 위한 것이다. 부모 클래스는 테이블과 매핑되지 않고, 자식 엔티티가 부모의 **필드와 매핑 정보**만 물려받아 자기 테이블에 컬럼으로 갖는다.

```
  BaseEntity (@MappedSuperclass)
  id, createdAt, updatedAt
  → 대응하는 테이블이 없다
        │ extends
   ┌────┴────┐
   ▼         ▼
 Member    Seller
 MEMBER    SELLER
 (공통 컬럼이 각 테이블에 들어간다)
```

```java
@MappedSuperclass
public abstract class BaseEntity {
    @Id @GeneratedValue
    private Long id;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

@Entity
public class Member extends BaseEntity {   // MEMBER: id, created_at, updated_at, email
    private String email;
}

@Entity
public class Seller extends BaseEntity {   // SELLER: id, created_at, updated_at, shop_name
    private String shopName;
}
```

### 2.2 왜 조회 대상이 될 수 없는가

`BaseEntity`는 엔티티가 아니다. 테이블이 없으니 `em.find(BaseEntity.class, 1L)`은 어느 테이블을 볼지 정할 수 없고, `select b from BaseEntity b`도 FROM에 놓을 테이블이 없다. 연관관계의 대상이 될 수도 없다. `@ManyToOne BaseEntity`처럼 참조하면 외래 키가 가리킬 테이블이 없기 때문이다. 반대로 `BaseEntity` 안에서 다른 엔티티를 참조하는 것은 가능하다. 그 참조는 자식 테이블의 외래 키 컬럼이 된다.

이 제약이 곧 1절 상속 매핑과의 차이다. 1절의 부모는 엔티티라서 부모 타입으로 다형적 조회가 되고, 2절의 부모는 매핑 정보의 묶음일 뿐이라 조회가 안 된다. "부모 타입으로 조회할 일이 있는가"가 둘을 가르는 질문이다.

물려받은 컬럼 이름을 자식에서 바꾸고 싶으면 `@AttributeOverride`를 쓴다.

```java
@Entity
@AttributeOverride(name = "id", column = @Column(name = "MEMBER_ID"))
public class Member extends BaseEntity { ... }
```

{{< callout type="info" >}}
스프링 데이터 JPA의 감사(Auditing) 기능과 함께 쓰는 `BaseEntity` 패턴이 이 어노테이션의 가장 흔한 용례다. `@EntityListeners(AuditingEntityListener.class)`를 붙이고 필드에 `@CreatedDate`, `@LastModifiedDate`를 달면 생성·수정 시각이 자동으로 채워진다. 이 클래스는 직접 인스턴스를 만들 일이 없으므로 `abstract`로 선언하는 것이 관례다.
{{< /callout >}}

---

## 3. 복합 키와 식별 관계

### 3.1 식별 관계와 비식별 관계

부모 테이블의 기본 키를 자식 테이블이 받아 쓰는 방식은 두 가지다.

```
[식별 관계]  부모 PK가 자식의 PK 겸 FK
  PARENT.PARENT_ID(PK)
        │
        ▼
  CHILD.PARENT_ID(PK,FK), CHILD_ID(PK)

[비식별 관계]  부모 PK가 자식의 FK만
  PARENT.PARENT_ID(PK)
        │
        ▼
  CHILD.CHILD_ID(PK), PARENT_ID(FK)
```

**식별 관계**는 부모의 기본 키를 자식의 기본 키에 포함시킨다. 자식은 부모 없이 식별되지 않는다는 뜻이 구조에 새겨진다. 자식의 기본 키는 자연히 두 컬럼 이상의 **복합 키**가 된다. **비식별 관계**는 부모의 기본 키를 외래 키로만 받고, 자식은 자기만의 기본 키를 따로 갖는다. 비식별 관계는 다시 외래 키에 NULL을 허용하지 않는 **필수적** 관계와 허용하는 **선택적** 관계로 나뉜다. 전자는 내부 조인, 후자는 외부 조인을 써야 하므로 이 차이가 JPQL에도 영향을 준다.

### 3.2 복합 키에는 왜 별도의 클래스가 필요한가

JPA는 식별자를 **값 하나**로 다룬다. `em.find(Member.class, 1L)`의 두 번째 인자가 그렇고, [Chapter 03](../03-persistence-context)에서 본 1차 캐시가 식별자를 키로 쓰는 맵이라는 것도 그렇다. 기본 키가 두 컬럼이면 두 값을 하나로 묶은 객체가 필요하다. 그것이 식별자 클래스다.

식별자 클래스에 붙는 요구사항은 전부 이 역할에서 나온다.

| 요구사항 | 이유 |
|:---------|:-----|
| `equals()`, `hashCode()` 재정의 | 1차 캐시는 맵이다. 같은 키를 같은 키로 알아보지 못하면 동일성 보장이 깨진다 |
| `Serializable` 구현 | 식별자는 직렬화되어 전달·캐시될 수 있어야 한다는 것이 명세의 요구다 |
| 기본 생성자 | JPA가 조회 결과로 식별자 객체를 리플렉션으로 만든다 |
| `public` 클래스 | JPA가 접근할 수 있어야 한다 |

첫 줄이 가장 중요하다. `equals()`를 재정의하지 않으면 `new ParentId("a", "b")` 두 개는 서로 다른 객체이고, 맵은 둘을 다른 키로 본다. 같은 행을 두 번 조회하면 1차 캐시에 두 번 들어가고, 3장에서 본 "식별자당 인스턴스 하나"가 무너진다. 두 값을 모두 사용해서 정의해야 한다.

복합 키를 매핑하는 방법은 두 가지다.

| 방법 | 식별자 클래스 | 엔티티 쪽 | 관점 |
|:-----|:--------------|:----------|:-----|
| `@IdClass` | 평범한 클래스. 필드 이름이 엔티티의 `@Id` 필드와 같아야 한다 | `@Id`를 여러 필드에 붙인다 | 테이블 중심 |
| `@EmbeddedId` | `@Embeddable` 클래스. 컬럼 매핑을 여기서 한다 | `@EmbeddedId` 필드 하나 | 객체 중심 |

### 3.3 @IdClass

```java
public class ParentId implements Serializable {
    private String id1;   // Parent.id1 과 이름이 같아야 한다
    private String id2;   // Parent.id2

    public ParentId() {}
    public ParentId(String id1, String id2) { ... }

    @Override public boolean equals(Object o) { ... }   // id1, id2 모두 비교
    @Override public int hashCode() { ... }
}

@Entity
@IdClass(ParentId.class)
public class Parent {
    @Id @Column(name = "PARENT_ID1")
    private String id1;

    @Id @Column(name = "PARENT_ID2")
    private String id2;

    private String name;
}
```

```java
Parent parent = new Parent();
parent.setId1("a");
parent.setId2("b");
em.persist(parent);                       // 엔티티에는 필드 두 개로 넣고

Parent found = em.find(Parent.class, new ParentId("a", "b"));   // 조회할 때만 식별자 객체를 쓴다
```

엔티티에는 키 컬럼이 낱개 필드로 그대로 드러나고, 식별자 클래스는 조회할 때만 등장한다. 테이블 구조가 그대로 보이는 방식이라 레거시 테이블을 옮길 때 편하다. 대신 같은 두 필드를 엔티티와 식별자 클래스에 중복해서 선언해야 하고, 이름까지 맞춰야 하는 제약이 있다.

### 3.4 @EmbeddedId

```java
@Embeddable
public class ParentId implements Serializable {
    @Column(name = "PARENT_ID1")
    private String id1;

    @Column(name = "PARENT_ID2")
    private String id2;

    // 기본 생성자, equals, hashCode
}

@Entity
public class Parent {
    @EmbeddedId
    private ParentId id;   // 식별자가 객체 하나로 드러난다

    private String name;
}
```

```java
Parent parent = new Parent();
parent.setId(new ParentId("a", "b"));
em.persist(parent);

Parent found = em.find(Parent.class, new ParentId("a", "b"));
```

식별자가 엔티티 안에서도 객체 하나로 다뤄진다. 컬럼 매핑이 식별자 클래스 한 곳에 모이고 중복 선언이 없다. JPQL에서는 `p.id.id1`처럼 한 단계 더 들어가야 한다는 점이 `@IdClass`의 `p.id1`과 다르다. 둘 중 무엇이 낫다고 말하기는 어렵고, 객체를 중심에 두는 설계라면 `@EmbeddedId`가 자연스럽다.

### 3.5 @MapsId: 식별 관계에서 외래 키가 기본 키의 일부일 때

식별 관계를 매핑하면 한 컬럼이 두 역할을 한다. `CHILD.PARENT_ID`는 부모를 가리키는 외래 키이면서 자식 기본 키의 일부다. 연관관계 필드(`@ManyToOne Parent parent`)도 이 컬럼을 원하고, 식별자 클래스도 이 컬럼을 원한다. 컬럼 하나를 두 번 매핑하는 셈이라 JPA 1.0에서는 한쪽을 읽기 전용으로 만드는 우회가 필요했다.

`@MapsId`는 이 중복을 푼다. "이 연관관계의 외래 키 값이 식별자 클래스의 이 필드를 채운다"는 선언이다.

```java
@Entity
public class Parent {
    @Id @Column(name = "PARENT_ID")
    private String id;
}

@Embeddable
public class ChildId implements Serializable {
    private String parentId;          // @MapsId가 채운다. 컬럼 매핑은 연관관계 쪽에

    @Column(name = "CHILD_ID")
    private String id;
    // equals, hashCode
}

@Entity
public class Child {
    @EmbeddedId
    private ChildId id;

    @MapsId("parentId")               // ChildId.parentId ← parent의 기본 키
    @ManyToOne
    @JoinColumn(name = "PARENT_ID")
    private Parent parent;

    private String name;
}
```

```java
Child child = new Child();
child.setParent(parent);                          // 연관관계만 설정하면
child.setId(new ChildId(null, "c1"));             // parentId는 비워 둬도
em.persist(child);                                // 저장 시점에 JPA가 채운다
```

연관관계를 설정하면 JPA가 부모의 기본 키를 식별자의 `parentId`에 넣어 준다. 개발자가 같은 값을 두 곳에 넣는 실수를 구조적으로 막는 장치다.

### 3.6 그래도 비식별 관계와 대리 키를 권한다

식별 관계는 부모 없이 자식이 존재할 수 없다는 규칙을 구조로 강제하고, 자식 테이블에 부모 키가 있으니 조인 없이 부모 기준으로 조회하기도 좋다. 그런데도 실무에서는 대체로 비식별 관계를 택한다. 이유를 정리하면 이렇다.

| 관점 | 식별 관계 | 비식별 관계 |
|:-----|:----------|:------------|
| 기본 키 | 세대가 내려갈수록 컬럼이 늘어난다 (자식 2개, 손자 3개) | 어디서나 컬럼 하나 |
| 키의 성격 | 부모 키가 업무 의미를 갖는 자연 키인 경우가 많다 | 의미 없는 대리 키 |
| 요구사항 변화 | 부모-자식 규칙이 바뀌면 기본 키가 바뀐다 | 외래 키만 바뀐다 |
| JPA 매핑 | 식별자 클래스, `@MapsId`, `equals`·`hashCode` | `@Id @GeneratedValue Long` |
| 조인 | 부모 키 조건은 조인 없이 가능 | 조인 한 번 더 |

[Chapter 07](../07-entity-mapping)에서 대리 키를 권한 이유가 여기서 그대로 커진다. 복합 키는 자연 키를 끌어들이고, 자연 키는 바뀌고, 식별자가 바뀌는 것은 JPA가 가장 다루기 어려운 일이다. 조인 한 번을 아끼는 것보다 구조가 단순하고 변화에 견디는 편이 오래 간다.

{{< callout type="info" >}}
권장 조합은 **비식별 관계 + `Long` 대리 키 + 필수적 관계**다. 외래 키에 `nullable = false`를 걸어 선택적 관계를 피하면 NULL 처리와 외부 조인이 사라지고, JPA가 내부 조인으로 더 단순한 SQL을 만든다. 복합 키가 꼭 필요한 레거시 테이블에서만 3.3~3.5절의 도구를 꺼내면 된다.
{{< /callout >}}

---

## 4. 조인 테이블

### 4.1 외래 키 대신 테이블로 관계를 표현한다

연관관계를 표현하는 방법은 둘이다. 한쪽 테이블에 외래 키 컬럼을 두는 **조인 컬럼**, 그리고 관계만 담는 별도 테이블을 두는 **조인 테이블**이다. [Chapter 08](../08-various-relationships)의 다대다에서 연결 테이블이 필수였던 것과 달리, 일대일과 일대다에서는 선택이다.

```
[조인 컬럼]
  MEMBER(LOCKER_ID FK) ──▶ LOCKER
  사물함이 없으면 LOCKER_ID = NULL

[조인 테이블]
  MEMBER ◀── MEMBER_LOCKER ──▶ LOCKER
  사물함이 없으면 행이 없다
```

조인 테이블을 고르는 이유는 대부분 **NULL을 피하기 위해서**다. 사물함이 없는 회원이 대다수라면 `MEMBER.LOCKER_ID`는 거의 비어 있는 컬럼이 되고, 조회할 때마다 NULL을 신경 써야 한다. 조인 테이블에서는 관계가 있을 때만 행이 생기므로 "없음"이 NULL이 아니라 "행 없음"으로 표현된다. 대가는 테이블이 하나 늘고, 관계를 따라갈 때마다 조인이 한 번 더 붙는다는 것이다. 그래서 기본은 조인 컬럼이고, 조인 테이블은 선택적 관계가 드물게 성립하는 경우에 고려한다.

### 4.2 @JoinTable

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    @Column(name = "PARENT_ID")
    private Long id;

    @OneToOne
    @JoinTable(
        name = "PARENT_CHILD",                                // 관계를 담는 테이블
        joinColumns = @JoinColumn(name = "PARENT_ID"),        // 이 엔티티를 가리키는 외래 키
        inverseJoinColumns = @JoinColumn(name = "CHILD_ID")   // 상대를 가리키는 외래 키
    )
    private Child child;
}

@Entity
public class Child {
    @Id @GeneratedValue
    @Column(name = "CHILD_ID")
    private Long id;

    @OneToOne(mappedBy = "child")
    private Parent parent;
}
```

`@JoinColumn` 자리에 `@JoinTable`을 쓰면 나머지는 같다. 주인과 `mappedBy`의 규칙도 그대로다. 다중성에 따라 조인 테이블에 걸어야 할 유니크 제약이 다르고, DDL을 자동 생성하면 JPA가 이를 만들어 준다.

| 관계 | 조인 테이블의 유니크 제약 | 이유 |
|:-----|:--------------------------|:-----|
| 1:1 | 두 외래 키 각각 | 양쪽 모두 한 번씩만 등장해야 한다 |
| 1:N | N 쪽 외래 키 | 자식 하나는 부모 하나에만 속한다 |
| N:N | 두 외래 키를 묶어서 | 같은 쌍이 두 번 들어가지 않게 |

---

## 5. 엔티티 하나를 여러 테이블에

```java
@Entity
@Table(name = "BOARD")
@SecondaryTable(
    name = "BOARD_DETAIL",
    pkJoinColumns = @PrimaryKeyJoinColumn(name = "BOARD_DETAIL_ID")
)
public class Board {
    @Id @GeneratedValue
    private Long id;

    private String title;                  // BOARD

    @Column(table = "BOARD_DETAIL")        // BOARD_DETAIL
    private String content;
}
```

`@SecondaryTable`은 엔티티 하나의 필드를 두 테이블에 나눠 담는다. 게시글 목록에는 제목만 필요하고 본문은 상세 화면에서만 쓰이는 식으로, 테이블은 나누고 싶지만 객체는 하나로 두고 싶을 때 쓰라고 만든 것이다.

그런데 이 목적은 잘 달성되지 않는다. 엔티티가 하나이므로 JPA는 조회할 때 **두 테이블을 항상 조인**한다. 목록 화면에서 제목만 필요해도 본문 테이블까지 읽는다. 테이블을 나눈 이유가 사라지는 것이다. 같은 구조를 `Board`와 `BoardDetail` 두 엔티티의 일대일 관계로 매핑하면 필요할 때만 상세를 조회할 수 있고 지연 로딩도 쓸 수 있다.

{{< callout type="warning" >}}
`@SecondaryTable`보다 **테이블마다 엔티티를 두고 일대일로 매핑**하는 편이 낫다. 두 테이블을 항상 조인하는 구조는 나중에 최적화할 여지를 남기지 않는다.
{{< /callout >}}

---

## 요약

| 상황 | 도구 | 핵심 | 왜 |
|:-----|:-----|:-----|:---|
| 객체 상속 | `@Inheritance` | 단일 테이블이 기본, 자식이 크게 다르면 조인 전략 | 테이블에는 상속이 없어 흉내 내는 방법이 여럿이다 |
| 클래스별 테이블 | `TABLE_PER_CLASS` | 피한다 | 부모 타입 조회가 UNION, IDENTITY 불가 |
| 공통 속성 | `@MappedSuperclass` | 매핑만 물려주고 테이블은 없음 | 부모 타입으로 조회할 일이 없다 |
| 복합 키 | `@IdClass`, `@EmbeddedId` | 식별자 클래스에 `equals`·`hashCode`·`Serializable` | 1차 캐시가 식별자를 키로 쓰는 맵이다 |
| 식별 관계 | `@MapsId` | 외래 키가 식별자를 채운다 | 한 컬럼을 두 번 매핑하지 않기 위해 |
| 관계 설계 | 비식별 + `Long` 대리 키 + 필수적 | 기본 선택 | 단순하고 변화에 견딘다 |
| 조인 테이블 | `@JoinTable` | 선택적 관계에서 NULL을 피할 때 | 관계가 있을 때만 행이 생긴다 |
| 여러 테이블 | `@SecondaryTable` | 대신 일대일 엔티티 둘 | 항상 조인하게 된다 |

### 핵심 코드

```java
// 상속: 부모에 전략과 구분 컬럼, 자식에 구분 값
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "DTYPE")
public abstract class Item { ... }

@Entity
@DiscriminatorValue("A")
public class Album extends Item { ... }

// 공통 속성: 테이블 없이 매핑만 상속
@MappedSuperclass
public abstract class BaseEntity { ... }

// 복합 키: 식별자 객체 하나로 다룬다
@Entity
public class Parent {
    @EmbeddedId
    private ParentId id;
}

// 식별 관계: 연관관계가 식별자를 채운다
@MapsId("parentId")
@ManyToOne
@JoinColumn(name = "PARENT_ID")
private Parent parent;
```
