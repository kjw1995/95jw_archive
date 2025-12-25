---
title: 고급 매핑
weight: 7
---

# 고급 매핑

JPA의 상속 관계 매핑, 복합 키, 식별/비식별 관계, 조인 테이블 매핑을 다룬다.

---

## 1. 상속 관계 매핑

관계형 DB에는 상속 개념이 없지만, **슈퍼타입-서브타입 관계** 모델링으로 유사하게 구현할 수 있다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    객체 상속 vs 테이블 슈퍼타입-서브타입                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [객체 상속]                        [테이블 슈퍼타입-서브타입]              │
│                                                                             │
│        ┌──────────┐                       ┌──────────┐                      │
│        │   Item   │                       │   ITEM   │                      │
│        │──────────│                       │──────────│                      │
│        │ id       │                       │ ITEM_ID  │ (PK)                 │
│        │ name     │                       │ NAME     │                      │
│        │ price    │                       │ PRICE    │                      │
│        └────┬─────┘                       │ DTYPE    │ (구분 컬럼)          │
│             │                             └──────────┘                      │
│    ┌────────┼────────┐                         │                            │
│    │        │        │                    ┌────┼────┐                       │
│    ▼        ▼        ▼                    ▼    ▼    ▼                       │
│ ┌──────┐┌──────┐┌──────┐             ┌──────┐┌──────┐┌──────┐              │
│ │Album ││Movie ││Book  │             │ALBUM ││MOVIE ││BOOK  │              │
│ └──────┘└──────┘└──────┘             └──────┘└──────┘└──────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 상속 매핑 전략 비교

| 전략 | 어노테이션 | 특징 |
|------|-----------|------|
| **조인 전략** | `InheritanceType.JOINED` | 각 테이블로 분리, 조인 사용 |
| **단일 테이블 전략** | `InheritanceType.SINGLE_TABLE` | 하나의 테이블에 통합 |
| **구현 클래스마다 테이블** | `InheritanceType.TABLE_PER_CLASS` | 서브타입마다 별도 테이블 |

---

### 1.2 조인 전략 (JOINED)

각 엔티티를 별도 테이블로 만들고, 조회 시 조인을 사용한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          조인 전략 테이블 구조                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────┐                                                 │
│   │        ITEM           │                                                 │
│   │───────────────────────│                                                 │
│   │ ITEM_ID (PK)          │                                                 │
│   │ NAME                  │                                                 │
│   │ PRICE                 │                                                 │
│   │ DTYPE                 │ ← 구분 컬럼 (A, M, B)                           │
│   └───────────┬───────────┘                                                 │
│               │                                                             │
│       ┌───────┼───────┐                                                     │
│       │       │       │                                                     │
│       ▼       ▼       ▼                                                     │
│   ┌───────┐┌───────┐┌───────┐                                               │
│   │ ALBUM ││ MOVIE ││ BOOK  │                                               │
│   │───────││───────││───────│                                               │
│   │ITEM_ID││ITEM_ID││ITEM_ID│ ← PK + FK                                     │
│   │ARTIST ││DIRECTOR│AUTHOR│                                               │
│   └───────┘└───────┘└───────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "DTYPE")  // 구분 컬럼
public abstract class Item {
    @Id @GeneratedValue
    @Column(name = "ITEM_ID")
    private Long id;

    private String name;
    private int price;
}

@Entity
@DiscriminatorValue("A")  // DTYPE에 저장될 값
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
@PrimaryKeyJoinColumn(name = "BOOK_ID")  // 자식 테이블 PK 컬럼명 변경
public class Book extends Item {
    private String author;
    private String isbn;
}
```

#### 조인 전략 장단점

| 구분 | 내용 |
|------|------|
| **장점** | 정규화, 외래키 무결성, 저장공간 효율적 |
| **단점** | 조회 시 조인 필요, INSERT 2회 실행, 쿼리 복잡 |

---

### 1.3 단일 테이블 전략 (SINGLE_TABLE)

하나의 테이블에 모든 컬럼을 통합한다. **기본 전략**이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        단일 테이블 전략 구조                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────┐               │
│   │                         ITEM                            │               │
│   │─────────────────────────────────────────────────────────│               │
│   │ ITEM_ID (PK)                                            │               │
│   │ NAME                                                    │               │
│   │ PRICE                                                   │               │
│   │ DTYPE (필수)         ← 구분 컬럼                         │               │
│   │─────────────────────────────────────────────────────────│               │
│   │ ARTIST              ← Album 전용 (nullable)             │               │
│   │─────────────────────────────────────────────────────────│               │
│   │ DIRECTOR            ← Movie 전용 (nullable)             │               │
│   │ ACTOR               ← Movie 전용 (nullable)             │               │
│   │─────────────────────────────────────────────────────────│               │
│   │ AUTHOR              ← Book 전용 (nullable)              │               │
│   │ ISBN                ← Book 전용 (nullable)              │               │
│   └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│   ※ 사용하지 않는 컬럼은 NULL                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "DTYPE")  // 필수
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
    private String artist;  // Album일 때만 값 존재
}

@Entity
@DiscriminatorValue("M")
public class Movie extends Item {
    private String director;
    private String actor;
}
```

#### 단일 테이블 전략 장단점

| 구분 | 내용 |
|------|------|
| **장점** | 조인 불필요, 조회 성능 빠름, 쿼리 단순 |
| **단점** | 자식 컬럼 모두 NULL 허용 필요, 테이블 비대화 가능 |

---

### 1.4 구현 클래스마다 테이블 전략 (TABLE_PER_CLASS)

서브타입마다 독립적인 테이블을 생성한다. **권장하지 않는 전략**이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   구현 클래스마다 테이블 전략                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   (부모 테이블 없음)                                                        │
│                                                                             │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│   │     ALBUM     │   │     MOVIE     │   │     BOOK      │                 │
│   │───────────────│   │───────────────│   │───────────────│                 │
│   │ ITEM_ID (PK)  │   │ ITEM_ID (PK)  │   │ ITEM_ID (PK)  │                 │
│   │ NAME          │   │ NAME          │   │ NAME          │                 │
│   │ PRICE         │   │ PRICE         │   │ PRICE         │                 │
│   │ ARTIST        │   │ DIRECTOR      │   │ AUTHOR        │                 │
│   │               │   │ ACTOR         │   │ ISBN          │                 │
│   └───────────────┘   └───────────────┘   └───────────────┘                 │
│                                                                             │
│   ※ 부모 속성이 각 테이블에 중복 저장됨                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Item {
    @Id @GeneratedValue
    @Column(name = "ITEM_ID")
    private Long id;

    private String name;
    private int price;
}

@Entity
public class Album extends Item {
    private String artist;
}
// @DiscriminatorValue 불필요 (구분 컬럼 사용 안함)
```

#### 구현 클래스마다 테이블 전략 장단점

| 구분 | 내용 |
|------|------|
| **장점** | 서브타입 구분 명확, NOT NULL 사용 가능 |
| **단점** | 여러 자식 조회 시 UNION 필요 (성능 저하), 통합 쿼리 어려움 |

---

### 1.5 상속 매핑 전략 비교 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      상속 매핑 전략 비교표                                   │
├──────────────────┬──────────────┬──────────────┬────────────────────────────┤
│       구분       │  조인 전략   │ 단일 테이블  │  구현 클래스마다 테이블    │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ 테이블 수        │ 부모 + 자식  │     1개      │      자식 개수만큼         │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ 조인             │     필요     │   불필요     │    UNION 필요 (부모 조회)  │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ NULL 컬럼        │    없음      │     많음     │         없음               │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ 구분 컬럼        │   선택적     │     필수     │        불필요              │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ 정규화           │      O       │      X       │          O                 │
├──────────────────┼──────────────┼──────────────┼────────────────────────────┤
│ 추천 여부        │      O       │      O       │          X                 │
└──────────────────┴──────────────┴──────────────┴────────────────────────────┘
```

---

## 2. @MappedSuperclass

테이블과 매핑하지 않고, **공통 매핑 정보만 상속**하고 싶을 때 사용한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     @MappedSuperclass 개념                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [객체]                              [테이블]                              │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  BaseEntity     │ ← @MappedSuperclass                                   │
│   │─────────────────│   (테이블 매핑 X)                                     │
│   │ id              │                                                       │
│   │ createdDate     │                                                       │
│   │ modifiedDate    │                                                       │
│   └────────┬────────┘                                                       │
│            │ extends                                                        │
│     ┌──────┴──────┐                                                         │
│     ▼             ▼                                                         │
│ ┌─────────┐  ┌─────────┐         ┌─────────────┐  ┌─────────────┐          │
│ │ Member  │  │ Seller  │   →     │   MEMBER    │  │   SELLER    │          │
│ │─────────│  │─────────│         │─────────────│  │─────────────│          │
│ │ email   │  │ shopName│         │ ID          │  │ ID          │          │
│ └─────────┘  └─────────┘         │ CREATED_DATE│  │ CREATED_DATE│          │
│                                  │ MODIFIED_DATE│ │ MODIFIED_DATE│         │
│                                  │ EMAIL       │  │ SHOP_NAME   │          │
│                                  └─────────────┘  └─────────────┘          │
│                                                                             │
│   BaseEntity의 필드가 각 자식 테이블에 포함됨                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
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
    // id, createdDate, modifiedDate 상속
}

@Entity
public class Seller extends BaseEntity {
    private String shopName;
    // id, createdDate, modifiedDate 상속
}
```

#### 속성 재정의

```java
@Entity
@AttributeOverrides({
    @AttributeOverride(name = "id", column = @Column(name = "MEMBER_ID")),
    @AttributeOverride(name = "createdDate", column = @Column(name = "REG_DATE"))
})
public class Member extends BaseEntity {
    private String email;
}
```

#### @MappedSuperclass 특징

| 특징 | 설명 |
|------|------|
| 테이블 매핑 | X (자식 테이블에만 매핑) |
| em.find() | 사용 불가 |
| JPQL | 사용 불가 |
| 권장 | 추상 클래스로 선언 |

---

## 3. 복합 키와 식별 관계 매핑

### 3.1 식별 관계 vs 비식별 관계

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    식별 관계 vs 비식별 관계                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [식별 관계]                                                               │
│   부모 PK를 자식의 PK + FK로 사용                                           │
│                                                                             │
│   PARENT                    CHILD                                           │
│   ┌──────────────┐          ┌────────────────────────┐                      │
│   │ PARENT_ID(PK)│─────────►│ PARENT_ID (PK, FK)     │                      │
│   │ NAME         │          │ CHILD_ID  (PK)         │                      │
│   └──────────────┘          │ NAME                   │                      │
│                             └────────────────────────┘                      │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   [비식별 관계]                                                             │
│   부모 PK를 자식의 FK로만 사용                                              │
│                                                                             │
│   PARENT                    CHILD                                           │
│   ┌──────────────┐          ┌────────────────────────┐                      │
│   │ PARENT_ID(PK)│─────────►│ CHILD_ID  (PK)         │                      │
│   │ NAME         │          │ PARENT_ID (FK)         │ ← NULL 허용 여부     │
│   └──────────────┘          │ NAME                   │                      │
│                             └────────────────────────┘                      │
│                                                                             │
│   • 필수적 비식별: FK NOT NULL (내부 조인 가능)                             │
│   • 선택적 비식별: FK NULL 허용 (외부 조인 필요)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 복합 키 매핑 방법

JPA에서 복합 키를 매핑하는 두 가지 방법이 있다.

| 방법 | 특징 |
|------|------|
| **@IdClass** | DB 중심, 식별자 클래스 속성명 = 엔티티 속성명 |
| **@EmbeddedId** | 객체지향 중심, 식별자 클래스에 직접 매핑 |

#### 복합 키 클래스 요구사항

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      복합 키 클래스 요구사항                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   공통 요구사항:                                                            │
│   ✓ Serializable 구현                                                       │
│   ✓ equals(), hashCode() 구현 (모든 필드 사용)                              │
│   ✓ 기본 생성자                                                             │
│   ✓ public 클래스                                                           │
│                                                                             │
│   @IdClass:                                                                 │
│   ✓ 식별자 클래스 속성명 = 엔티티 식별자 속성명                             │
│                                                                             │
│   @EmbeddedId:                                                              │
│   ✓ @Embeddable 어노테이션 필수                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### @IdClass 예제

```java
// 복합 키 클래스
public class ParentId implements Serializable {
    private String id1;  // Parent.id1과 동일
    private String id2;  // Parent.id2와 동일

    // 기본 생성자, equals, hashCode
    @Override
    public boolean equals(Object o) { ... }
    @Override
    public int hashCode() { ... }
}

// 엔티티
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
Parent findParent = em.find(Parent.class, parentId);
```

#### @EmbeddedId 예제

```java
// 복합 키 클래스
@Embeddable
public class ParentId implements Serializable {
    @Column(name = "PARENT_ID1")
    private String id1;

    @Column(name = "PARENT_ID2")
    private String id2;

    // 기본 생성자, equals, hashCode
}

// 엔티티
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

// 조회
Parent findParent = em.find(Parent.class, parentId);
```

### 3.3 @MapsId를 사용한 식별 관계 매핑

```java
// 부모
@Entity
public class Parent {
    @Id @Column(name = "PARENT_ID")
    private String id;
    private String name;
}

// 자식
@Entity
public class Child {
    @EmbeddedId
    private ChildId id;

    @MapsId("parentId")  // ChildId.parentId와 매핑
    @ManyToOne
    @JoinColumn(name = "PARENT_ID")
    private Parent parent;

    private String name;
}

// 자식 ID
@Embeddable
public class ChildId implements Serializable {
    private String parentId;  // @MapsId("parentId")로 매핑

    @Column(name = "CHILD_ID")
    private String id;

    // equals, hashCode
}
```

### 3.4 식별 vs 비식별 관계 권장사항

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    식별 vs 비식별 관계 비교                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        식별 관계              비식별 관계                   │
│   ───────────────────────────────────────────────────────────────────────   │
│   기본 키            복합 키 (점점 증가)       단일 대리 키                  │
│   유연성             낮음 (구조 변경 어려움)   높음                          │
│   비즈니스 의존      자연 키 사용 경향        대리 키 사용                   │
│   JPA 매핑           복잡 (IdClass/EmbeddedId) 간단 (@GeneratedValue)       │
│   조인 없이 조회     가능 (하위 테이블만)     불가                          │
│   ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│   ★ 권장: 비식별 관계 + Long 타입 대리 키 + 필수적 관계                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 조인 테이블

연관관계를 **외래 키 컬럼** 대신 **별도 테이블**로 관리한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 조인 컬럼 vs 조인 테이블                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [조인 컬럼 방식]                     [조인 테이블 방식]                    │
│                                                                             │
│   MEMBER        LOCKER               MEMBER      MEMBER_LOCKER    LOCKER   │
│   ┌──────┐      ┌──────┐             ┌──────┐    ┌───────────┐   ┌──────┐  │
│   │ ID   │      │ ID   │             │ ID   │    │ MEMBER_ID │   │ ID   │  │
│   │LOCKER├─────►│ NAME │             │ NAME │    │ LOCKER_ID │   │ NAME │  │
│   │ _ID  │      └──────┘             └──────┘    └───────────┘   └──────┘  │
│   │(FK)  │                                              │              │    │
│   └──────┘                                              └──────────────┘    │
│                                                                             │
│   외래 키에 NULL 발생 가능            테이블 추가 필요                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
        name = "PARENT_CHILD",                           // 조인 테이블 이름
        joinColumns = @JoinColumn(name = "PARENT_ID"),   // 현재 엔티티 FK
        inverseJoinColumns = @JoinColumn(name = "CHILD_ID")  // 반대 엔티티 FK
    )
    private Child child;
}

@Entity
public class Child {
    @Id @GeneratedValue
    @Column(name = "CHILD_ID")
    private Long id;

    private String name;

    // 양방향 시
    @OneToOne(mappedBy = "child")
    private Parent parent;
}
```

### 4.2 관계별 조인 테이블

| 관계 | 유니크 제약 조건 |
|------|-----------------|
| **일대일** | 양쪽 FK 각각에 유니크 |
| **일대다** | 다(N) 쪽 FK에 유니크 |
| **다대다** | 두 FK를 묶어서 복합 유니크 |

```java
// 다대다 조인 테이블
@Entity
public class Parent {
    @Id @GeneratedValue
    private Long id;

    @ManyToMany
    @JoinTable(
        name = "PARENT_CHILD",
        joinColumns = @JoinColumn(name = "PARENT_ID"),
        inverseJoinColumns = @JoinColumn(name = "CHILD_ID")
    )
    private List<Child> children = new ArrayList<>();
}
```

---

## 5. 엔티티 하나에 여러 테이블 매핑

@SecondaryTable을 사용하면 하나의 엔티티를 여러 테이블에 매핑할 수 있다.

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

    private String title;

    @Column(table = "BOARD_DETAIL")  // BOARD_DETAIL 테이블에 매핑
    private String content;
}
```

> **권장**: @SecondaryTable보다 테이블당 엔티티를 만들어 일대일 매핑하는 것이 좋다. @SecondaryTable은 항상 두 테이블을 조회하므로 최적화가 어렵다.

---

## 6. 핵심 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          고급 매핑 요약                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   상속 관계 매핑                                                            │
│   ├── @Inheritance: 전략 선택 (JOINED, SINGLE_TABLE, TABLE_PER_CLASS)       │
│   ├── @DiscriminatorColumn: 부모에 구분 컬럼 지정                           │
│   └── @DiscriminatorValue: 자식에 구분 값 지정                              │
│                                                                             │
│   @MappedSuperclass                                                         │
│   ├── 테이블 매핑 없이 공통 속성 상속                                       │
│   ├── em.find(), JPQL 사용 불가                                             │
│   └── 추상 클래스 권장                                                      │
│                                                                             │
│   복합 키                                                                   │
│   ├── @IdClass: DB 중심 (속성명 일치 필요)                                  │
│   ├── @EmbeddedId: 객체지향 중심 (@Embeddable 필요)                         │
│   ├── @MapsId: 식별 관계에서 FK를 PK로 매핑                                 │
│   └── 필수: Serializable, equals(), hashCode()                              │
│                                                                             │
│   관계 매핑 권장사항                                                        │
│   ├── 비식별 관계 선호                                                      │
│   ├── Long 타입 대리 키 사용                                                │
│   └── 필수적 비식별 관계 (NOT NULL FK)                                      │
│                                                                             │
│   조인 테이블                                                               │
│   ├── @JoinTable: 연관관계를 별도 테이블로 관리                             │
│   └── 다대다 풀어내기에 주로 사용                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
