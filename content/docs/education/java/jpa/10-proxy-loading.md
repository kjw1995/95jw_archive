---
title: 프록시와 연관관계 관리
weight: 10
---

# 프록시와 연관관계 관리

JPA의 프록시, 즉시/지연 로딩, 영속성 전이(CASCADE), 고아 객체 제거를 다룬다.

---

## 1. 프록시

### 1.1 프록시 기초

**프록시**는 실제 엔티티 대신 데이터베이스 조회를 지연할 수 있는 가짜 객체이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    em.find() vs em.getReference()                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   em.find(Member.class, id)          em.getReference(Member.class, id)      │
│           │                                     │                           │
│           ▼                                     ▼                           │
│   ┌───────────────────┐              ┌───────────────────┐                  │
│   │  데이터베이스 조회 │              │  프록시 객체 반환  │                  │
│   │   (즉시 조회)      │              │  (조회 지연)       │                  │
│   └─────────┬─────────┘              └─────────┬─────────┘                  │
│             ▼                                  │                            │
│   ┌───────────────────┐                        │ 실제 사용 시               │
│   │   실제 Member     │                        ▼                            │
│   │   엔티티 반환     │              ┌───────────────────┐                  │
│   └───────────────────┘              │  초기화 후        │                  │
│                                      │  실제 엔티티 접근 │                  │
│                                      └───────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
// 즉시 조회 - DB 조회 발생
Member member = em.find(Member.class, "member1");

// 지연 조회 - 프록시 반환, DB 조회 X
Member member = em.getReference(Member.class, "member1");
```

### 1.2 프록시 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          프록시 클래스 구조                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐                                                   │
│   │       Member        │  ← 실제 엔티티 클래스                             │
│   │─────────────────────│                                                   │
│   │ id                  │                                                   │
│   │ name                │                                                   │
│   │─────────────────────│                                                   │
│   │ getId()             │                                                   │
│   │ getName()           │                                                   │
│   └──────────▲──────────┘                                                   │
│              │ extends                                                      │
│   ┌──────────┴──────────┐                                                   │
│   │    MemberProxy      │  ← 프록시 클래스 (상속)                           │
│   │─────────────────────│                                                   │
│   │ Member target       │  ← 실제 엔티티 참조                               │
│   │─────────────────────│                                                   │
│   │ getId()             │  → target.getId()                                 │
│   │ getName()           │  → 초기화 후 target.getName()                     │
│   └─────────────────────┘                                                   │
│                                                                             │
│   ※ 프록시는 실제 클래스를 상속받아 겉모양이 같음                           │
│   ※ 사용자는 프록시인지 실제 객체인지 구분 없이 사용                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 프록시 초기화 과정

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         프록시 초기화 과정                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   클라이언트              MemberProxy           영속성 컨텍스트      DB     │
│       │                       │                       │            │       │
│       │  1. getName()         │                       │            │       │
│       │─────────────────────► │                       │            │       │
│       │                       │                       │            │       │
│       │                       │  2. 초기화 요청        │            │       │
│       │                       │ (target == null)      │            │       │
│       │                       │─────────────────────► │            │       │
│       │                       │                       │  3. DB조회 │       │
│       │                       │                       │──────────► │       │
│       │                       │                       │ ◄──────────│       │
│       │                       │  4. 실제 엔티티 생성   │            │       │
│       │                       │ ◄─────────────────────│            │       │
│       │                       │                       │            │       │
│       │                       │ target = realMember   │            │       │
│       │                       │                       │            │       │
│       │  5. target.getName()  │                       │            │       │
│       │ ◄─────────────────────│                       │            │       │
│       │                       │                       │            │       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
class MemberProxy extends Member {
    Member target = null;  // 실제 엔티티 참조

    public String getName() {
        if (target == null) {
            // 초기화 요청 → 영속성 컨텍스트 → DB 조회 → 실제 엔티티 생성
            this.target = /* 실제 Member 엔티티 */;
        }
        return target.getName();  // 실제 엔티티의 메서드 호출
    }
}
```

### 1.4 프록시 특징

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           프록시 특징 정리                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. 한 번만 초기화                                                         │
│      └─ 처음 사용할 때 한 번만 초기화됨                                     │
│                                                                             │
│   2. 프록시 ≠ 실제 엔티티                                                   │
│      └─ 초기화해도 프록시 객체가 실제 엔티티로 바뀌지 않음                  │
│      └─ 프록시를 통해 실제 엔티티에 접근하는 것                             │
│                                                                             │
│   3. 타입 체크 주의                                                         │
│      └─ == 비교 대신 instanceof 사용                                        │
│      └─ member.getClass() == Member.class  (X)                              │
│      └─ member instanceof Member           (O)                              │
│                                                                             │
│   4. 영속성 컨텍스트에 엔티티 존재 시                                        │
│      └─ getReference()도 실제 엔티티 반환                                   │
│                                                                             │
│   5. 준영속 상태에서 초기화 불가                                            │
│      └─ LazyInitializationException 발생                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
// 준영속 상태에서 초기화 시도 → 예외 발생
Member member = em.getReference(Member.class, "id1");
em.close();  // 영속성 컨텍스트 종료

member.getName();  // LazyInitializationException 발생!
```

### 1.5 프록시와 식별자

```java
// 프록시는 식별자(PK)를 보관
Team team = em.getReference(Team.class, "team1");
team.getId();  // 초기화 안됨 (이미 식별자 보유)

// 연관관계 설정 시 프록시 활용 (DB 접근 감소)
Member member = em.find(Member.class, "member1");
Team team = em.getReference(Team.class, "team1");  // SQL 실행 X
member.setTeam(team);  // 식별자만 사용하므로 초기화 X
```

### 1.6 프록시 확인 유틸리티

```java
// 초기화 여부 확인
boolean isLoaded = emf.getPersistenceUnitUtil().isLoaded(entity);

// 프록시 클래스 확인
System.out.println(member.getClass().getName());
// 출력: jpabook.Member$HibernateProxy$...

// 프록시 강제 초기화 (Hibernate)
Hibernate.initialize(member);

// 또는 메서드 호출로 초기화
member.getName();
```

---

## 2. 즉시 로딩과 지연 로딩

### 2.1 개념 비교

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     즉시 로딩 vs 지연 로딩                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [즉시 로딩 - FetchType.EAGER]                                             │
│                                                                             │
│   Member member = em.find(Member.class, id);                                │
│                                                                             │
│   실행 SQL:                                                                 │
│   SELECT M.*, T.*                                                           │
│   FROM MEMBER M                                                             │
│   LEFT JOIN TEAM T ON M.TEAM_ID = T.ID                                      │
│   WHERE M.ID = ?                                                            │
│                                                                             │
│   결과: Member + Team 함께 조회                                             │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   [지연 로딩 - FetchType.LAZY]                                              │
│                                                                             │
│   Member member = em.find(Member.class, id);                                │
│                                                                             │
│   실행 SQL (1차):                                                           │
│   SELECT * FROM MEMBER WHERE ID = ?                                         │
│                                                                             │
│   member.getTeam().getName();  // 팀 실제 사용 시                           │
│                                                                             │
│   실행 SQL (2차):                                                           │
│   SELECT * FROM TEAM WHERE ID = ?                                           │
│                                                                             │
│   결과: Member 먼저, Team은 프록시 → 실제 사용 시 조회                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 설정 방법

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;

    private String username;

    // 즉시 로딩 - 회원 조회 시 팀도 함께 조회
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "TEAM_ID")
    private Team team;

    // 지연 로딩 - 주문 조회 시점까지 로딩 지연
    @OneToMany(mappedBy = "member", fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();
}
```

### 2.3 JPA 기본 페치 전략

| 연관관계 | 기본 페치 전략 | 이유 |
|----------|---------------|------|
| **@ManyToOne** | EAGER | 연관 엔티티 하나 |
| **@OneToOne** | EAGER | 연관 엔티티 하나 |
| **@OneToMany** | LAZY | 컬렉션 (데이터 많음) |
| **@ManyToMany** | LAZY | 컬렉션 (데이터 많음) |

> **권장**: 모든 연관관계에 **지연 로딩(LAZY)** 사용 후 필요한 곳만 즉시 로딩 적용

### 2.4 즉시 로딩과 조인 전략

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    즉시 로딩 시 조인 전략                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   nullable 설정에 따른 조인 전략:                                           │
│                                                                             │
│   @JoinColumn(nullable = true)   →  LEFT OUTER JOIN (기본값)                │
│   @JoinColumn(nullable = false)  →  INNER JOIN                              │
│                                                                             │
│   또는                                                                      │
│                                                                             │
│   @ManyToOne(optional = true)    →  LEFT OUTER JOIN (기본값)                │
│   @ManyToOne(optional = false)   →  INNER JOIN                              │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   이유:                                                                     │
│   • nullable = true: 외래키 NULL 가능 → 외부 조인 필요                      │
│   • nullable = false: 외래키 NOT NULL 보장 → 내부 조인 가능                 │
│                                                                             │
│   ※ 내부 조인이 성능상 유리                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
public class Member {
    // 내부 조인 사용 (TEAM_ID가 항상 존재)
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "TEAM_ID", nullable = false)
    private Team team;
}
```

### 2.5 컬렉션에 EAGER 사용 시 주의점

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 컬렉션 즉시 로딩 주의사항                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. 컬렉션 2개 이상 즉시 로딩 권장하지 않음                                │
│                                                                             │
│      A 테이블 ─┬─ 1:N ─ B 테이블 (N개)                                      │
│                └─ 1:N ─ C 테이블 (M개)                                      │
│                                                                             │
│      결과 행 수: N × M (카테시안 곱)                                        │
│      → 애플리케이션 성능 저하                                               │
│                                                                             │
│   2. 컬렉션 즉시 로딩은 항상 OUTER JOIN                                     │
│                                                                             │
│      • 1:N 관계에서 자식이 없는 부모 조회 가능해야 함                       │
│      • DB 제약조건으로 막을 수 없음                                         │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   FetchType.EAGER 조인 전략 정리:                                           │
│                                                                             │
│   @ManyToOne, @OneToOne                                                     │
│     optional = false  →  INNER JOIN                                         │
│     optional = true   →  OUTER JOIN                                         │
│                                                                             │
│   @OneToMany, @ManyToMany                                                   │
│     항상 OUTER JOIN (optional 무관)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 컬렉션 래퍼

하이버네이트는 컬렉션을 추적/관리하기 위해 내장 컬렉션으로 변경한다.

```java
Member member = em.find(Member.class, id);

// 하이버네이트 내장 컬렉션으로 래핑됨
System.out.println(member.getOrders().getClass().getName());
// 출력: org.hibernate.collection.internal.PersistentBag

// 컬렉션 래퍼가 지연 로딩 처리
member.getOrders().get(0);  // 이 시점에 SQL 실행
```

---

## 3. 영속성 전이 (CASCADE)

부모 엔티티 저장/삭제 시 연관된 자식 엔티티도 함께 저장/삭제한다.

### 3.1 CASCADE 옵션 종류

| 옵션 | 설명 |
|------|------|
| **ALL** | 모든 옵션 적용 |
| **PERSIST** | 영속 (저장) |
| **REMOVE** | 삭제 |
| **MERGE** | 병합 |
| **REFRESH** | 새로고침 |
| **DETACH** | 준영속 |

### 3.2 영속성 전이: 저장 (PERSIST)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CASCADE.PERSIST 동작                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [CASCADE 없음]                      [CASCADE.PERSIST]                     │
│                                                                             │
│   Parent parent = new Parent();       Parent parent = new Parent();         │
│   Child child1 = new Child();         Child child1 = new Child();           │
│   Child child2 = new Child();         Child child2 = new Child();           │
│                                                                             │
│   parent.addChild(child1);            parent.addChild(child1);              │
│   parent.addChild(child2);            parent.addChild(child2);              │
│                                                                             │
│   em.persist(parent);                 em.persist(parent);                   │
│   em.persist(child1);  // 필요        // child1, child2 자동 영속           │
│   em.persist(child2);  // 필요                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.PERSIST)
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
Child child1 = new Child();
Child child2 = new Child();

parent.addChild(child1);
parent.addChild(child2);

em.persist(parent);  // child1, child2도 함께 영속화
```

### 3.3 영속성 전이: 삭제 (REMOVE)

```java
@Entity
public class Parent {
    @OneToMany(mappedBy = "parent", cascade = CascadeType.REMOVE)
    private List<Child> children = new ArrayList<>();
}

// 사용
Parent parent = em.find(Parent.class, parentId);
em.remove(parent);  // 자식 엔티티도 함께 삭제

// 실행 SQL (삭제 순서: 자식 → 부모)
// DELETE FROM CHILD WHERE ID = ?
// DELETE FROM CHILD WHERE ID = ?
// DELETE FROM PARENT WHERE ID = ?
```

> **주의**: CASCADE.REMOVE가 없으면 외래키 무결성 예외 발생

---

## 4. 고아 객체 (orphanRemoval)

부모 엔티티와 연관관계가 끊어진 자식 엔티티를 자동으로 삭제한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        고아 객체 제거 동작                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Parent                                                                    │
│   ┌─────────────────────┐                                                   │
│   │ children:           │                                                   │
│   │   [Child1, Child2]  │                                                   │
│   └─────────────────────┘                                                   │
│                                                                             │
│   parent.getChildren().remove(0);  // Child1 제거                           │
│                                                                             │
│   Parent                           DB                                       │
│   ┌─────────────────────┐          DELETE FROM CHILD                        │
│   │ children:           │    →     WHERE ID = ? (Child1)                    │
│   │   [Child2]          │                                                   │
│   └─────────────────────┘                                                   │
│                                                                             │
│   컬렉션에서 제거 → 고아 객체로 인식 → 자동 DELETE                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "parent", orphanRemoval = true)
    private List<Child> children = new ArrayList<>();
}

// 사용
Parent parent = em.find(Parent.class, parentId);
parent.getChildren().remove(0);  // 첫 번째 자식 제거 → DELETE SQL 실행

// 모든 자식 제거
parent.getChildren().clear();  // 모든 자식 DELETE
```

### 4.1 고아 객체 주의사항

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       고아 객체 주의사항                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. 참조하는 곳이 하나일 때만 사용                                         │
│      └─ 특정 엔티티가 개인 소유하는 경우에만 사용                           │
│      └─ 다른 곳에서도 참조하면 문제 발생                                    │
│                                                                             │
│   2. @OneToOne, @OneToMany에서만 사용 가능                                  │
│                                                                             │
│   3. 부모 제거 시 자식도 함께 제거됨                                        │
│      └─ CascadeType.REMOVE와 동일한 효과                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 영속성 전이 + 고아 객체 = 생명주기 관리

`CascadeType.ALL` + `orphanRemoval = true`를 함께 사용하면 **부모 엔티티를 통해 자식의 생명주기를 관리**할 수 있다.

```java
@Entity
public class Parent {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "parent",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Child> children = new ArrayList<>();

    public void addChild(Child child) {
        children.add(child);
        child.setParent(this);
    }
}

// 자식 저장 - 부모에 추가만 하면 됨
Parent parent = em.find(Parent.class, parentId);
parent.addChild(new Child());  // INSERT 발생

// 자식 삭제 - 부모에서 제거만 하면 됨
parent.getChildren().remove(child);  // DELETE 발생

// 부모 삭제 - 자식도 함께 삭제
em.remove(parent);  // 부모 + 모든 자식 DELETE
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        생명주기 관리 비교                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [일반적인 엔티티]                                                         │
│   • em.persist()로 영속화                                                   │
│   • em.remove()로 제거                                                      │
│   • 엔티티 스스로 생명주기 관리                                             │
│                                                                             │
│   [CascadeType.ALL + orphanRemoval = true]                                  │
│   • 부모.addChild()로 영속화                                                │
│   • 부모.getChildren().remove()로 제거                                      │
│   • 부모 엔티티가 자식의 생명주기 관리                                      │
│                                                                             │
│   → DDD의 Aggregate Root 개념 구현에 유용                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 핵심 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    프록시와 연관관계 관리 요약                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   프록시                                                                    │
│   ├── em.getReference(): 프록시 반환 (DB 조회 지연)                         │
│   ├── 초기화: 실제 사용 시 영속성 컨텍스트 통해 DB 조회                     │
│   ├── 준영속 상태에서 초기화 → LazyInitializationException                  │
│   └── 확인: PersistenceUnitUtil.isLoaded(), Hibernate.initialize()          │
│                                                                             │
│   즉시/지연 로딩                                                            │
│   ├── EAGER: 엔티티 조회 시 연관 엔티티 함께 조회 (JOIN)                    │
│   ├── LAZY: 연관 엔티티 실제 사용 시 조회 (프록시)                          │
│   ├── 기본값: @xToOne → EAGER, @xToMany → LAZY                              │
│   └── 권장: 모든 연관관계에 LAZY 사용                                       │
│                                                                             │
│   영속성 전이 (CASCADE)                                                     │
│   ├── PERSIST: 부모 저장 시 자식도 저장                                     │
│   ├── REMOVE: 부모 삭제 시 자식도 삭제                                      │
│   └── ALL: 모든 옵션 적용                                                   │
│                                                                             │
│   고아 객체 (orphanRemoval)                                                 │
│   ├── 연관관계 끊어진 자식 자동 삭제                                        │
│   ├── @OneToOne, @OneToMany만 사용 가능                                     │
│   └── 참조하는 곳이 하나일 때만 사용                                        │
│                                                                             │
│   생명주기 관리                                                             │
│   └── CascadeType.ALL + orphanRemoval = true                                │
│       → 부모를 통해 자식 생명주기 완전 관리                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 기능 | 설정 | 용도 |
|------|------|------|
| 지연 로딩 | `fetch = FetchType.LAZY` | 연관 엔티티 조회 지연 |
| 즉시 로딩 | `fetch = FetchType.EAGER` | 연관 엔티티 함께 조회 |
| 저장 전이 | `cascade = CascadeType.PERSIST` | 부모와 함께 저장 |
| 삭제 전이 | `cascade = CascadeType.REMOVE` | 부모와 함께 삭제 |
| 고아 객체 | `orphanRemoval = true` | 연관 끊기면 삭제 |
