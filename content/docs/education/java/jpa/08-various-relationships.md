---
title: "Chapter 08. 다양한 연관관계 매핑"
weight: 8
---

## 연관관계 매핑의 3요소

엔티티 연관관계를 매핑할 때는 항상 세 가지를 결정한다.

```
 ┌─────────────┐ ┌──────────┐ ┌──────────────┐
 │   다중성     │ │  방향    │ │ 연관관계 주인│
 │ @ManyToOne  │ │ 단방향   │ │  외래 키를   │
 │ @OneToMany  │ │   ↓      │ │  관리하는 쪽  │
 │ @OneToOne   │ │ 양방향   │ │    = 주인    │
 │ @ManyToMany │ │   ↕      │ │              │
 └─────────────┘ └──────────┘ └──────────────┘
```

### 핵심 개념

| 구분 | 테이블 | 객체 |
|:-----|:-------|:-----|
| 방향 | FK 하나로 양방향 JOIN | 참조 있어야 탐색 |
| 연관관계 | FK 1개 | 양방향 시 참조 2개 |
| 주인 | 해당 없음 | FK 관리자 지정 필요 |

**연관관계 주인 규칙**
- 주인: FK 관리 (INSERT, UPDATE)
- 주인 아닌 쪽: `mappedBy` 로 지정, **읽기 전용**

{{< callout type="info" >}}
객체는 참조가 "단방향" 이지만 DB 는 FK 하나로 자동 "양방향 조인" 이 된다. 이 불일치를 메우기 위해 JPA 는 "둘 중 누가 FK 를 들고 있을지" 를 선언하게 만들고, 그 역할을 **연관관계 주인** 이라 부른다.
{{< /callout >}}

---

## 1. 다대일 [N:1]

> 가장 많이 쓰는 관계. **외래 키는 항상 N 쪽에** 존재한다.

```
  Member (N) ─────────► Team (1)
     │
     │ TEAM_ID (FK)
     ▼
  ┌──────────────┐   ┌──────────────┐
  │   MEMBER     │   │     TEAM     │
  │──────────────│   │──────────────│
  │ MEMBER_ID PK │   │ TEAM_ID   PK │
  │ TEAM_ID   FK │──►│ NAME         │
  │ USERNAME     │   └──────────────┘
  └──────────────┘
```

### 1.1 다대일 단방향

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    private String username;

    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    private Team team;
}

@Entity
public class Team {
    @Id @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;

    private String name;
    // Member 를 참조하지 않음 → 단방향
}
```

### 1.2 다대일 양방향

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    private String username;

    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    private Team team;   // ⭐ 연관관계 주인

    // 연관관계 편의 메서드
    public void setTeam(Team team) {
        this.team = team;
        if (!team.getMembers().contains(this)) {
            team.getMembers().add(this);
        }
    }
}

@Entity
public class Team {
    @Id @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;

    private String name;

    @OneToMany(mappedBy = "team")   // 주인 X (읽기 전용)
    private List<Member> members = new ArrayList<>();

    public void addMember(Member member) {
        this.members.add(member);
        if (member.getTeam() != this) {
            member.setTeam(this);
        }
    }
}
```

**양방향 매핑 규칙**

- 외래 키가 있는 쪽이 연관관계 주인
- 양쪽 모두 서로 참조
- 연관관계 편의 메서드로 동기화
- 편의 메서드는 무한 루프 방지 로직 필수

---

## 2. 일대다 [1:N]

> 일(1)쪽이 주인. **권장하지 않는 방식**이다.

### 2.1 일대다 단방향

```
  Team (1) ─────────► Member (N)
     │                  │
     │ members (관리)    │
     ▼                  ▼
  ┌──────────┐      ┌──────────────┐
  │   TEAM   │      │    MEMBER    │
  │──────────│      │──────────────│
  │TEAM_ID PK│◄─────│ TEAM_ID   FK │
  │ NAME     │      │ MEMBER_ID PK │
  └──────────┘      └──────────────┘
       ▲                   ▲
    주인                  FK 가 여기에!
```

FK 가 **반대 테이블**(MEMBER)에 있지만, 주인은 **이쪽 테이블(Team)** 이 되는 구조다.

```java
@Entity
public class Team {
    @Id @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;

    private String name;

    @OneToMany
    @JoinColumn(name = "TEAM_ID")   // MEMBER 테이블의 FK
    private List<Member> members = new ArrayList<>();
}

@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    private String username;
    // Team 참조 없음
}
```

**일대다 단방향의 문제점**

- FK 가 다른 테이블에 있어 관리가 어색
- INSERT 후 추가 UPDATE SQL 실행
- 연관관계 처리 로직 복잡

```sql
-- 일대다 단방향 저장 시
INSERT INTO MEMBER (MEMBER_ID, USERNAME)
  VALUES (1, '홍길동');
UPDATE MEMBER SET TEAM_ID = 1
  WHERE MEMBER_ID = 1;   -- 추가 UPDATE!
```

{{< callout type="warning" >}}
**일대다 단방향은 피하자**. 실무에서는 **다대일 양방향**으로 풀어 Member 가 FK 를 들고 관리하게 한다. 추가 UPDATE 가 없고 의도가 분명하다.
{{< /callout >}}

### 2.2 일대다 양방향?

공식 스펙에는 없다. `@OneToMany` 는 **주인이 될 수 없다** (DB 구조상 FK 가 N 쪽에 있기 때문). **다대일 양방향** 으로 설계하자.

---

## 3. 일대일 [1:1]

> 양쪽 모두 하나의 관계. **외래 키 위치를 선택**할 수 있다.

```
 [주 테이블 FK]           [대상 테이블 FK]

  MEMBER                   MEMBER
  ┌────────────┐           ┌────────────┐
  │ MEMBER_ID  │           │ MEMBER_ID  │
  │ LOCKER_ID  │──┐        │ USERNAME   │
  │ USERNAME   │  │        └────────────┘
  └────────────┘  │              ▲
                  ▼              │
  LOCKER          │        LOCKER│
  ┌────────────┐  │        ┌────────────┐
  │ LOCKER_ID  │◄─┘        │ LOCKER_ID  │
  │ NAME       │           │ MEMBER_ID  │
  └────────────┘           │ NAME       │
                           └────────────┘
```

| 선택 | 장점 | 단점 |
|:-----|:-----|:-----|
| 주 테이블 FK | 주 테이블만 조회해도 연관 확인 | 값 없으면 FK NULL |
| 대상 테이블 FK | 1:N 으로 변경 시 구조 유지 | 프록시 지연 로딩 한계 |

### 3.1 주 테이블 FK — 단방향

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;
    private String username;

    @OneToOne
    @JoinColumn(name = "LOCKER_ID")
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

### 3.2 주 테이블 FK — 양방향

```java
@Entity
public class Member {
    @OneToOne
    @JoinColumn(name = "LOCKER_ID")
    private Locker locker;   // ⭐ 주인
}

@Entity
public class Locker {
    @OneToOne(mappedBy = "locker")   // 주인 X
    private Member member;
}
```

### 3.3 대상 테이블 FK

- **단방향**: JPA 미지원
- **양방향**: 지원. 대상 테이블 쪽을 주인으로

```java
@Entity
public class Member {
    @OneToOne(mappedBy = "member")
    private Locker locker;
}

@Entity
public class Locker {
    @OneToOne
    @JoinColumn(name = "MEMBER_ID")
    private Member member;   // ⭐ 주인
}
```

{{< callout type="warning" >}}
주 테이블에 FK 가 없으면 **프록시 지연 로딩이 즉시 로딩으로 바뀐다**. Member 를 조회한 시점에 Locker 가 있는지 없는지를 판단하려면 어차피 Locker 테이블을 조회해야 하기 때문이다. 프록시 한계를 피하려면 **주 테이블 FK + 양방향** 을 선호하자.
{{< /callout >}}

---

## 4. 다대다 [N:N]

> 관계형 DB 는 다대다를 직접 표현할 수 없다. **연결 테이블**이 필요하다.

```
 객체 모델              DB 모델
 ┌──────┐┌──────┐    ┌──────┐ ┌────┐ ┌──────┐
 │Member││Prod. │    │MEMBER│─│M_P │─│PROD. │
 └──────┘└──────┘    └──────┘ └────┘ └──────┘
   N : N                     연결 테이블
```

### 4.1 다대다 단방향

```java
@Entity
public class Member {
    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;
    private String username;

    @ManyToMany
    @JoinTable(
        name = "MEMBER_PRODUCT",
        joinColumns =
            @JoinColumn(name = "MEMBER_ID"),
        inverseJoinColumns =
            @JoinColumn(name = "PRODUCT_ID")
    )
    private List<Product> products = new ArrayList<>();
}

@Entity
public class Product {
    @Id @GeneratedValue
    @Column(name = "PRODUCT_ID")
    private Long id;
    private String name;
}
```

### 4.2 다대다 양방향

```java
@Entity
public class Member {
    @ManyToMany
    @JoinTable(
        name = "MEMBER_PRODUCT",
        joinColumns =
            @JoinColumn(name = "MEMBER_ID"),
        inverseJoinColumns =
            @JoinColumn(name = "PRODUCT_ID")
    )
    private List<Product> products = new ArrayList<>();

    public void addProduct(Product p) {
        products.add(p);
        p.getMembers().add(this);
    }
}

@Entity
public class Product {
    @ManyToMany(mappedBy = "products")
    private List<Member> members = new ArrayList<>();
}
```

### 4.3 다대다의 한계

- 연결 테이블에 **추가 컬럼을 넣을 수 없다** (주문 수량·날짜 등)
- 연결 테이블이 숨겨져 **의도치 않은 쿼리** 발생
- 중간 테이블에 **비즈니스 로직 확장 불가**

{{< callout type="warning" >}}
**실무에서 `@ManyToMany` 는 쓰지 않는다**. 반드시 **연결 엔티티**를 만들어 `1:N + N:1` 로 분해하자. 초기에는 깨끗해 보여도 "주문 수량 추가 요청" 한 줄이 오는 순간 전체 구조가 깨진다.
{{< /callout >}}

### 4.4 다대다 → 일대다 + 다대일

```
  Member (1) ──< Order >── (1) Product
                  │
                  │ 주문 수량, 주문 일자 등
                  │ 추가 컬럼 가능!
                  ▼
            ┌──────────────┐
            │    ORDER     │
            │──────────────│
            │ ORDER_ID  PK │ ← 대리 키 권장
            │ MEMBER_ID FK │
            │ PRODUCT_ID FK│
            │ ORDER_AMOUNT │
            │ ORDER_DATE   │
            └──────────────┘
```

#### 방법 1: 복합 기본 키 (식별 관계)

```java
@Entity
public class Member {
    @Id @Column(name = "MEMBER_ID")
    private String id;
    private String username;

    @OneToMany(mappedBy = "member")
    private List<MemberProduct> memberProducts = new ArrayList<>();
}

@Entity
public class Product {
    @Id @Column(name = "PRODUCT_ID")
    private String id;
    private String name;
}

@Entity
@IdClass(MemberProductId.class)
public class MemberProduct {

    @Id
    @ManyToOne
    @JoinColumn(name = "MEMBER_ID")
    private Member member;

    @Id
    @ManyToOne
    @JoinColumn(name = "PRODUCT_ID")
    private Product product;

    private int orderAmount;
    private LocalDateTime orderDate;
}

public class MemberProductId implements Serializable {
    private String member;    // MemberProduct.member
    private String product;   // MemberProduct.product

    public MemberProductId() {}

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MemberProductId)) return false;
        MemberProductId that = (MemberProductId) o;
        return Objects.equals(member, that.member)
            && Objects.equals(product, that.product);
    }

    @Override
    public int hashCode() {
        return Objects.hash(member, product);
    }
}
```

**@IdClass 복합 키 요구사항**

- `Serializable` 구현 필수
- `equals()`, `hashCode()` 오버라이드
- 기본 생성자 필수
- `public` 클래스
- 필드명이 엔티티 필드명과 일치

#### 방법 2: 새로운 대리 키 (비식별 관계) — 권장

```java
@Entity
@Table(name = "ORDERS")
public class Order {

    @Id @GeneratedValue
    @Column(name = "ORDER_ID")
    private Long id;    // ⭐ 대리 키

    @ManyToOne
    @JoinColumn(name = "MEMBER_ID")
    private Member member;

    @ManyToOne
    @JoinColumn(name = "PRODUCT_ID")
    private Product product;

    private int orderAmount;
    private LocalDateTime orderDate;
}
```

**사용 예시**

```java
Member member = new Member();
member.setUsername("홍길동");
em.persist(member);

Product product = new Product();
product.setName("노트북");
em.persist(product);

Order order = new Order();
order.setMember(member);
order.setProduct(product);
order.setOrderAmount(2);
order.setOrderDate(LocalDateTime.now());
em.persist(order);

// 조회
Order found = em.find(Order.class, orderId);
Member m = found.getMember();
Product p = found.getProduct();
```

### 식별 vs 비식별 관계

| 구분 | 식별 관계 | 비식별 관계 |
|:-----|:---------|:-----------|
| 정의 | 부모 PK = 자식 PK+FK | 부모 PK = 자식 FK 만 |
| 기본 키 | 복합 키 | 대리 키 |
| 장점 | 부모-자식 관계 명확 | 단순·유연 |
| 단점 | 복잡, 식별자 클래스 | 조인 한 번 더 |
| 권장 | ❌ | ✅ 비식별 + 대리 키 |

---

## 5. @EmbeddedId 방식 (대안)

`@IdClass` 대신 `@EmbeddedId` 를 써서 복합 키를 **하나의 객체** 로 감쌀 수 있다.

```java
@Embeddable
public class MemberProductId implements Serializable {

    @Column(name = "MEMBER_ID")
    private String memberId;

    @Column(name = "PRODUCT_ID")
    private String productId;

    // 기본 생성자, equals, hashCode
}

@Entity
public class MemberProduct {

    @EmbeddedId
    private MemberProductId id;

    @ManyToOne
    @MapsId("memberId")
    @JoinColumn(name = "MEMBER_ID")
    private Member member;

    @ManyToOne
    @MapsId("productId")
    @JoinColumn(name = "PRODUCT_ID")
    private Product product;

    private int orderAmount;
}
```

**@IdClass vs @EmbeddedId**

| 비교 | @IdClass | @EmbeddedId |
|:-----|:---------|:------------|
| 식별자 접근 | 엔티티 필드 직접 | `getId().getMemberId()` |
| JPQL | `SELECT m.member` | `SELECT m.id.memberId` |
| 복잡도 | 단순 | 객체지향적 |

---

## 요약

### 연관관계 선택 가이드

1. **다중성** 결정
   - `1:N` / `N:1` → 다대일 양방향 (가장 일반적)
   - `1:1` → 주 테이블 FK + 양방향
   - `N:N` → 연결 엔티티로 `1:N + N:1` 분해
2. **방향** 결정
   - 단방향으로 시작
   - 필요 시 양방향 추가 (JPQL·객체 그래프 탐색용)
3. **연관관계 주인**
   - 외래 키 가진 쪽 = 주인 (무조건)

### 실무 권장사항

| 관계 | 권장 | 비권장 |
|:-----|:-----|:-------|
| N:1 | 다대일 양방향 | — |
| 1:N | 다대일 양방향으로 대체 | 일대다 단방향 ❌ |
| 1:1 | 주 테이블 FK + 양방향 | 대상 테이블 FK 단방향 |
| N:N | 연결 엔티티 + 비식별 | `@ManyToMany` ❌ |

### 핵심 체크리스트

- 연관관계 주인 = 외래 키 가진 쪽
- 양방향 시 연관관계 편의 메서드 필수
- 일대다 단방향 대신 다대일 양방향
- `@ManyToMany` 대신 연결 엔티티
- 복합 키보다 대리 키 (`Long`) + 비식별 관계
- `mappedBy` 는 주인이 아닌 쪽에

### 주의사항

**절대 금지**
- 일대다 단방향 (UPDATE 쿼리 추가)
- `@ManyToMany` 실무 사용
- 양방향 편의 메서드 무한 루프
- 주인 아닌 쪽에서 FK 수정

**권장**
- 단방향으로 시작, 필요 시 양방향 추가
- 연결 엔티티 = 비식별 관계 + 대리 키
- toString·JSON 직렬화에서 양방향 순환 참조 주의
- `cascade`, `orphanRemoval` 은 신중히
