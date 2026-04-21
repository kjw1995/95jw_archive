---
title: "Chapter 09. 고급 매핑"
weight: 9
---

상속 관계 매핑, `@MappedSuperclass`, 복합 키와 식별/비식별 관계, 조인 테이블 매핑을 다룬다.

---

## 1. 상속 관계 매핑

관계형 DB 에는 상속 개념이 없지만 **슈퍼타입-서브타입** 모델링으로 유사하게 구현할 수 있다. JPA 는 객체의 상속 구조와 DB 의 슈퍼/서브 타입을 매핑해주는 전략을 제공한다.

```
 [객체 상속]            [DB 슈퍼/서브]

      Item                 ITEM
       △                 ┌──────┐
    ┌──┼──┐              │ PK   │
    ▼  ▼  ▼              │ NAME │
  Album Movie Book       │ PRICE│
                         │ DTYPE│
                         └──┬───┘
                            │
                         ┌──┼──┐
                         ▼  ▼  ▼
                       ALBUM MOV BOOK
```

### 1.1 상속 매핑 전략 비교

| 전략 | 어노테이션 | 특징 |
|:-----|:-----------|:-----|
| 조인 전략 | `InheritanceType.JOINED` | 정규화, 조인 사용 |
| 단일 테이블 | `InheritanceType.SINGLE_TABLE` | 하나의 테이블 |
| 구현 클래스별 | `InheritanceType.TABLE_PER_CLASS` | 자식별 별도 테이블 |

---

### 1.2 조인 전략 (JOINED)

각 엔티티를 별도 테이블로 만들고 조회 시 조인한다. DB 관점에서 가장 **정규화된 형태**다.

```
      ┌──────────────┐
      │    ITEM      │
      │──────────────│
      │ ITEM_ID   PK │
      │ NAME         │
      │ PRICE        │
      │ DTYPE        │ ← A/M/B
      └──────┬───────┘
             │
      ┌──────┼──────┐
      ▼      ▼      ▼
   ┌─────┐┌─────┐┌─────┐
   │ALBUM││MOVIE││BOOK │
   │─────││─────││─────│
   │ID FK││ID FK││ID FK│
   │ARTIST│DIREC││AUTHR│
   └─────┘└─────┘└─────┘
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
@PrimaryKeyJoinColumn(name = "BOOK_ID")   // 자식 PK 이름 변경
public class Book extends Item {
    private String author;
    private String isbn;
}
```

| 구분 | 내용 |
|:-----|:-----|
| 장점 | 정규화, FK 무결성, 저장공간 효율 |
| 단점 | 조회 시 조인 필요, INSERT 2회, 쿼리 복잡 |

---

### 1.3 단일 테이블 전략 (SINGLE_TABLE)

하나의 테이블에 모든 컬럼을 몰아넣는다. **JPA 기본 전략**이며 조회 성능이 가장 빠르다.

```
  ┌──────────────────────────┐
  │          ITEM            │
  │──────────────────────────│
  │ ITEM_ID   PK             │
  │ NAME                     │
  │ PRICE                    │
  │ DTYPE     (필수)          │
  │──────────────────────────│
  │ ARTIST    ← Album 만 사용 │
  │ DIRECTOR  ← Movie 만     │
  │ ACTOR     ← Movie 만     │
  │ AUTHOR    ← Book 만      │
  │ ISBN      ← Book 만      │
  └──────────────────────────┘
    사용하지 않는 컬럼 = NULL
```

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
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
```

| 구분 | 내용 |
|:-----|:-----|
| 장점 | 조인 불필요, 조회 빠름, 단순 쿼리 |
| 단점 | 자식 컬럼 NULL 허용, 테이블 비대화 |

---

### 1.4 구현 클래스별 테이블 (TABLE_PER_CLASS)

서브타입마다 **독립 테이블**을 둔다. **권장하지 않는다**.

```
 (부모 테이블 없음)

 ┌────────┐ ┌────────┐ ┌────────┐
 │ ALBUM  │ │ MOVIE  │ │  BOOK  │
 │────────│ │────────│ │────────│
 │ID   PK │ │ID   PK │ │ID   PK │
 │NAME    │ │NAME    │ │NAME    │
 │PRICE   │ │PRICE   │ │PRICE   │
 │ARTIST  │ │DIRECTOR│ │AUTHOR  │
 │        │ │ACTOR   │ │ISBN    │
 └────────┘ └────────┘ └────────┘
   부모 속성이 중복 저장됨
```

```java
@Entity
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Item { ... }

@Entity
public class Album extends Item {
    private String artist;
}
// @DiscriminatorValue 불필요
```

| 구분 | 내용 |
|:-----|:-----|
| 장점 | 자식 구분 명확, NOT NULL 사용 가능 |
| 단점 | 부모로 조회 시 UNION 필요 (성능↓), 통합 쿼리 어려움 |

---

### 1.5 상속 매핑 전략 비교

| 항목 | 조인 | 단일 테이블 | 클래스별 |
|:-----|:-----|:-----------|:--------|
| 테이블 수 | 부모+자식 | 1개 | 자식 수 |
| 조인 | 필요 | 불필요 | UNION 필요 |
| NULL 컬럼 | 없음 | 많음 | 없음 |
| 구분 컬럼 | 선택 | 필수 | 불필요 |
| 정규화 | O | X | O |
| 추천 | O | O | X |

{{< callout type="info" >}}
**실무 선택**: 성능·단순성이 중요하고 자식 속성이 많지 않다면 **SINGLE_TABLE**. 정규화가 중요하거나 자식마다 속성이 많이 다르면 **JOINED** 가 낫다. `TABLE_PER_CLASS` 는 피하자.
{{< /callout >}}

---

## 2. @MappedSuperclass

테이블과 매핑하지 않고, **공통 매핑 정보만 상속**하게 해주는 어노테이션이다. 객체지향의 "공통 속성 추출" 과 JPA 매핑을 연결해준다.

```
  [객체]                  [테이블]

 BaseEntity
 (@MappedSuperclass,          (매핑 없음)
  테이블 매핑 X)
 ┌──────────────┐
 │ id           │
 │ createdDate  │
 │ modifiedDate │
 └──────┬───────┘
        │ extends
   ┌────┴────┐
   ▼         ▼
 Member    Seller       MEMBER      SELLER
 ┌──────┐  ┌──────┐    ┌────────┐  ┌────────┐
 │email │  │shop..│    │id      │  │id      │
 └──────┘  └──────┘    │created │  │created │
                       │modified│  │modified│
                       │email   │  │shop    │
                       └────────┘  └────────┘
```

```java
@MappedSuperclass
public abstract class BaseEntity {
    @Id @GeneratedValue
    private Long id;

    @Column(name = "CREATED_DATE")
    private LocalDateTime createdDate;

    @Column(name = "MODIFIED_DATE")
    private LocalDateTime modifiedDate;
}

@Entity
public class Member extends BaseEntity {
    private String email;
}

@Entity
public class Seller extends BaseEntity {
    private String shopName;
}
```

### 속성 재정의

```java
@Entity
@AttributeOverrides({
    @AttributeOverride(
        name = "id",
        column = @Column(name = "MEMBER_ID")),
    @AttributeOverride(
        name = "createdDate",
        column = @Column(name = "REG_DATE"))
})
public class Member extends BaseEntity {
    private String email;
}
```

### @MappedSuperclass 특징

| 특징 | 설명 |
|:-----|:-----|
| 테이블 매핑 | X (자식 테이블에만 매핑) |
| `em.find()` | 사용 불가 |
| JPQL | 사용 불가 |
| 권장 | 추상 클래스로 선언 |

스프링 데이터 JPA 의 `@EntityListeners(AuditingEntityListener.class)` 와 함께 쓰면 생성/수정 시간을 자동으로 채우는 공통 **BaseEntity** 패턴을 만들 수 있다.

---

## 3. 복합 키와 식별 관계 매핑

### 3.1 식별 관계 vs 비식별 관계

```
 [식별 관계]
 부모 PK 를 자식의 PK + FK 로

  PARENT            CHILD
  ┌───────────┐     ┌─────────────────┐
  │PARENT_ID  │────►│PARENT_ID (PK,FK)│
  │ PK        │     │CHILD_ID  (PK)   │
  │NAME       │     │NAME             │
  └───────────┘     └─────────────────┘

 [비식별 관계]
 부모 PK 를 자식의 FK 로만

  PARENT            CHILD
  ┌───────────┐     ┌─────────────────┐
  │PARENT_ID  │────►│CHILD_ID  (PK)   │
  │ PK        │     │PARENT_ID (FK)   │
  │NAME       │     │NAME             │
  └───────────┘     └─────────────────┘

 • 필수적 비식별: FK NOT NULL (내부 조인)
 • 선택적 비식별: FK NULL 가능 (외부 조인)
```

### 3.2 복합 키 매핑 방법

| 방법 | 특징 |
|:-----|:-----|
| `@IdClass` | DB 중심, 식별자 클래스 속성명 = 엔티티 속성명 |
| `@EmbeddedId` | 객체지향 중심, `@Embeddable` 을 직접 매핑 |

#### 복합 키 클래스 요구사항

공통
- `Serializable` 구현
- `equals()`, `hashCode()` (모든 필드 사용)
- 기본 생성자
- `public` 클래스

`@IdClass` 전용
- 식별자 클래스 속성명 = 엔티티 식별자 속성명

`@EmbeddedId` 전용
- `@Embeddable` 어노테이션 필수

#### @IdClass 예제

```java
public class ParentId implements Serializable {
    private String id1;   // Parent.id1
    private String id2;   // Parent.id2

    public ParentId() {}

    @Override public boolean equals(Object o) { ... }
    @Override public int hashCode() { ... }
}

@Entity
@IdClass(ParentId.class)
public class Parent {
    @Id
    @Column(name = "PARENT_ID1")
    private String id1;

    @Id
    @Column(name = "PARENT_ID2")
    private String id2;

    private String name;
}

// 사용
Parent parent = new Parent();
parent.setId1("id1");
parent.setId2("id2");
em.persist(parent);

// 조회
ParentId parentId = new ParentId("id1", "id2");
Parent found = em.find(Parent.class, parentId);
```

#### @EmbeddedId 예제

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
    private ParentId id;

    private String name;
}

// 사용
Parent parent = new Parent();
ParentId parentId = new ParentId("id1", "id2");
parent.setId(parentId);
em.persist(parent);

Parent found = em.find(Parent.class, parentId);
```

### 3.3 @MapsId 식별 관계 매핑

```java
@Entity
public class Parent {
    @Id @Column(name = "PARENT_ID")
    private String id;
    private String name;
}

@Entity
public class Child {
    @EmbeddedId
    private ChildId id;

    @MapsId("parentId")   // ChildId.parentId 와 매핑
    @ManyToOne
    @JoinColumn(name = "PARENT_ID")
    private Parent parent;

    private String name;
}

@Embeddable
public class ChildId implements Serializable {
    private String parentId;   // @MapsId 매핑 대상

    @Column(name = "CHILD_ID")
    private String id;
    // equals, hashCode
}
```

### 3.4 식별 vs 비식별 관계 권장사항

| 구분 | 식별 관계 | 비식별 관계 |
|:-----|:---------|:-----------|
| 기본 키 | 복합 키 (점점 증가) | 단일 대리 키 |
| 유연성 | 낮음 | 높음 |
| 의존 | 자연 키 사용 경향 | 대리 키 |
| JPA 매핑 | 복잡 (IdClass/EmbeddedId) | 간단 (`@GeneratedValue`) |
| 조인 없이 조회 | 가능 | 불가 |

{{< callout type="info" >}}
**권장**: 비식별 관계 + `Long` 대리 키 + **필수적** 관계 (`nullable=false`). 구조가 단순하고, 관계가 바뀌거나 PK 가 변해도 영향 범위가 좁다.
{{< /callout >}}

---

## 4. 조인 테이블

연관관계를 **외래 키 컬럼** 대신 **별도 테이블**로 관리한다.

```
 [조인 컬럼]              [조인 테이블]

 MEMBER    LOCKER       MEMBER M_LOCKER  LOCKER
 ┌─────┐   ┌─────┐      ┌───┐ ┌───────┐ ┌────┐
 │ ID  │   │ ID  │      │ID │ │MEM_ID │ │ ID │
 │LOCK │──►│NAME │      │NAM│ │LOCK_ID│ │NAME│
 │_ID  │   └─────┘      └───┘ └───────┘ └────┘
 │(FK) │                         │ │
 └─────┘                         └─┴──── 연결
  FK 에 NULL 가능                 테이블 추가 필요
```

조인 테이블 방식은 **FK NULL 을 피하고 싶을 때**(선택적 관계이면서 NULL 대신 "행이 없음" 으로 표현하고 싶을 때) 유용하다.

### 4.1 @JoinTable 사용법

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    @Column(name = "PARENT_ID")
    private Long id;
    private String name;

    @OneToOne
    @JoinTable(
        name = "PARENT_CHILD",
        joinColumns =
            @JoinColumn(name = "PARENT_ID"),
        inverseJoinColumns =
            @JoinColumn(name = "CHILD_ID")
    )
    private Child child;
}

@Entity
public class Child {
    @Id @GeneratedValue
    @Column(name = "CHILD_ID")
    private Long id;
    private String name;

    @OneToOne(mappedBy = "child")
    private Parent parent;
}
```

### 4.2 관계별 조인 테이블 제약

| 관계 | 유니크 제약 |
|:-----|:-----------|
| 1:1 | 양쪽 FK 각각 유니크 |
| 1:N | N 쪽 FK 유니크 |
| N:N | 두 FK 묶어 복합 유니크 |

```java
// 다대다 조인 테이블
@Entity
public class Parent {
    @ManyToMany
    @JoinTable(
        name = "PARENT_CHILD",
        joinColumns =
            @JoinColumn(name = "PARENT_ID"),
        inverseJoinColumns =
            @JoinColumn(name = "CHILD_ID")
    )
    private List<Child> children = new ArrayList<>();
}
```

---

## 5. 엔티티 하나에 여러 테이블 매핑

`@SecondaryTable` 로 엔티티 하나를 여러 테이블에 매핑할 수 있다.

```java
@Entity
@Table(name = "BOARD")
@SecondaryTable(
    name = "BOARD_DETAIL",
    pkJoinColumns =
        @PrimaryKeyJoinColumn(name = "BOARD_DETAIL_ID")
)
public class Board {
    @Id @GeneratedValue
    private Long id;

    private String title;

    @Column(table = "BOARD_DETAIL")   // 두 번째 테이블로
    private String content;
}
```

{{< callout type="warning" >}}
`@SecondaryTable` 보다 **테이블당 엔티티를 만들어 1:1 매핑**하는 편이 낫다. 두 테이블을 항상 조인하게 되어 쿼리 최적화가 어렵기 때문이다.
{{< /callout >}}

---

## 6. 핵심 요약

### 상속 관계 매핑

- `@Inheritance`: 전략 선택 (JOINED / SINGLE_TABLE / TABLE_PER_CLASS)
- `@DiscriminatorColumn`: 부모에 구분 컬럼
- `@DiscriminatorValue`: 자식에 구분 값

### @MappedSuperclass

- 테이블 매핑 없이 공통 속성 상속
- `em.find()`, JPQL 사용 불가
- 추상 클래스 권장 (`BaseEntity` 패턴)

### 복합 키

- `@IdClass`: DB 중심 (속성명 일치)
- `@EmbeddedId`: 객체지향 중심 (`@Embeddable` 필요)
- `@MapsId`: 식별 관계에서 FK 를 PK 로
- 필수: `Serializable`, `equals()`, `hashCode()`

### 관계 매핑 권장사항

- 비식별 관계 + `Long` 대리 키
- 필수적 비식별 관계 (`nullable=false`)

### 조인 테이블

- `@JoinTable`: 연관관계를 별도 테이블로
- 다대다 풀어낼 때 주로 사용
