---
title: "Chapter 05. 영속성 컨텍스트 특징"
weight: 5
---

## 1. 1차 캐시

> 영속성 컨텍스트 내부에 존재하는 **Map 형태의 캐시**

```
┌─────────────────────────────────────────┐
│          영속성 컨텍스트                 │
│   ┌───────────────────────────────┐     │
│   │           1차 캐시             │     │
│   │  ┌─────────┬───────────────┐  │     │
│   │  │   @Id   │    Entity     │  │     │
│   │  ├─────────┼───────────────┤  │     │
│   │  │"member1"│   Member 객체  │  │     │
│   │  │"member2"│   Member 객체  │  │     │
│   │  └─────────┴───────────────┘  │     │
│   └───────────────────────────────┘     │
└─────────────────────────────────────────┘
         Key: 식별자 (@Id)
         Value: 엔티티 인스턴스
```

### 1차 캐시에서 조회

```java
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");

// 1차 캐시에 저장
em.persist(member);

// 1차 캐시에서 조회 (DB 조회 X)
Member findMember = em.find(Member.class, "member1");
```

### 데이터베이스에서 조회

```java
// 1차 캐시에 없으면...
Member findMember = em.find(Member.class, "member2");

// 1. 1차 캐시 조회 → 없음
// 2. DB에서 SELECT
// 3. 결과를 1차 캐시에 저장
// 4. 영속 상태의 엔티티 반환
```

```
┌─────────────────┐
│  em.find()      │
└────────┬────────┘
         │ 1. 1차 캐시 조회
         ▼
┌─────────────────┐     없음     ┌─────────────┐
│    1차 캐시      │ ──────────→ │   Database  │
│   (member1만)   │              │   SELECT    │
└─────────────────┘              └──────┬──────┘
         ▲                              │
         │ 3. 캐시에 저장               │ 2. 조회
         └──────────────────────────────┘
```

---

## 2. 동일성 보장 (Identity)

> 같은 트랜잭션 내에서 **같은 엔티티는 같은 인스턴스** 반환

```java
Member a = em.find(Member.class, "member1");
Member b = em.find(Member.class, "member1");

System.out.println(a == b);  // true! 같은 인스턴스
```

### 동일성 vs 동등성

| 비교 | 연산자 | 의미 |
|------|--------|------|
| **동일성** (identity) | `==` | 같은 참조(주소) |
| **동등성** (equality) | `equals()` | 같은 값 |

> JPA는 1차 캐시를 통해 **REPEATABLE READ** 등급의 트랜잭션 격리 수준을
> **애플리케이션 레벨**에서 제공

---

## 3. 트랜잭션을 지원하는 쓰기 지연

> SQL을 바로 보내지 않고 **모아서 한 번에 전송**

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();

em.persist(memberA);  // INSERT SQL → 쓰기 지연 저장소
em.persist(memberB);  // INSERT SQL → 쓰기 지연 저장소
// 아직 DB에 전송 안 함!

tx.commit();  // 커밋 순간 DB에 SQL 전송
```

### 동작 흐름

```
┌────────────────────────────────────────────────────────────────┐
│                    영속성 컨텍스트                               │
│                                                                │
│  ┌─────────────────┐        ┌─────────────────────────────┐   │
│  │     1차 캐시     │        │     쓰기 지연 SQL 저장소      │   │
│  │  ┌─────┬──────┐ │        │                             │   │
│  │  │ id  │entity│ │        │  INSERT INTO MEMBER ...     │   │
│  │  ├─────┼──────┤ │ ────→  │  INSERT INTO MEMBER ...     │   │
│  │  │ id1 │ memA │ │persist │                             │   │
│  │  │ id2 │ memB │ │        │                             │   │
│  │  └─────┴──────┘ │        └─────────────┬───────────────┘   │
│  └─────────────────┘                      │                   │
│                                           │ commit()          │
└───────────────────────────────────────────┼───────────────────┘
                                            ▼
                                    ┌───────────────┐
                                    │   Database    │
                                    │  (SQL 실행)   │
                                    └───────────────┘
```

### 쓰기 지연이 가능한 이유

```java
begin();   // 트랜잭션 시작

save(A);   // SQL 저장
save(B);   // SQL 저장
save(C);   // SQL 저장

commit();  // 이 시점에 SQL 전송해도 결과는 같음!
```

> 어차피 **커밋하기 전까지는 DB 반영 안 됨** → 커밋 직전에만 SQL 전송하면 됨

---

## 4. 변경 감지 (Dirty Checking)

> 엔티티 수정 시 **별도의 update() 호출 없이** 자동으로 UPDATE SQL 생성

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();

// 엔티티 조회
Member memberA = em.find(Member.class, "memberA");

// 엔티티 데이터 수정
memberA.setUsername("hi");
memberA.setAge(10);

// em.update(memberA); ← 이런 코드 필요 없음!

tx.commit();  // 자동으로 UPDATE SQL 실행
```

### 동작 원리: 스냅샷

```
┌─────────────────────────────────────────────────────────────────┐
│                      영속성 컨텍스트                              │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                      1차 캐시                           │    │
│  │  ┌──────────┬──────────┬──────────────┐               │    │
│  │  │   @Id    │  Entity  │   스냅샷     │               │    │
│  │  ├──────────┼──────────┼──────────────┤               │    │
│  │  │ "memberA"│ {hi, 10} │ {회원A, 20}  │ ← 최초 상태    │    │
│  │  └──────────┴──────────┴──────────────┘               │    │
│  │                  │              │                      │    │
│  │                  └──────┬───────┘                      │    │
│  │                         │ 비교                         │    │
│  │                         ▼                              │    │
│  │                    [변경 감지!]                         │    │
│  │                         │                              │    │
│  │                         ▼                              │    │
│  │              ┌─────────────────────┐                   │    │
│  │              │ UPDATE SQL 자동 생성 │                   │    │
│  │              └─────────────────────┘                   │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 변경 감지 흐름

1. 트랜잭션 커밋 → 엔티티 매니저 내부에서 `flush()` 호출
2. 엔티티와 스냅샷 비교
3. 변경된 엔티티 발견 → UPDATE SQL 생성 → 쓰기 지연 저장소
4. SQL을 DB에 전송
5. DB 트랜잭션 커밋

### 주의: 영속 상태의 엔티티만!

```java
// 영속 상태 → 변경 감지 동작
Member member = em.find(Member.class, "member1");
member.setUsername("변경됨");  // 반영 O

// 준영속 상태 → 변경 감지 동작 안 함
em.detach(member);
member.setUsername("다시변경");  // 반영 X
```

### 모든 필드 UPDATE (기본 전략)

```java
// JPA 기본: 모든 필드 UPDATE
UPDATE MEMBER SET
    ID = ?,
    USERNAME = ?,
    AGE = ?
WHERE ID = ?

// 장점
// 1. 수정 쿼리가 항상 동일 → 앱 로딩 시 미리 생성 가능
// 2. DB가 쿼리 파싱 재사용 가능
```

### 동적 UPDATE (@DynamicUpdate)

```java
@Entity
@org.hibernate.annotations.DynamicUpdate  // 변경된 필드만 UPDATE
@Table(name = "Member")
public class Member { ... }
```

> 필드가 30개 이상이거나 저장되는 내용이 큰 경우 고려

---

## 5. 엔티티 삭제

```java
// 삭제 대상 조회
Member memberA = em.find(Member.class, "memberA");

// 엔티티 삭제
em.remove(memberA);

// 커밋 시 DELETE SQL 실행
tx.commit();
```

> `remove()` 호출 시:
> - 영속성 컨텍스트에서 **즉시 제거**
> - DELETE SQL은 **쓰기 지연 저장소**에 등록
> - **커밋 시** DB에 DELETE 전송

---

## 요약

| 특징 | 동작 | 이점 |
|------|------|------|
| **1차 캐시** | 엔티티를 메모리에 캐시 | DB 조회 감소 |
| **동일성 보장** | 같은 PK는 같은 인스턴스 | REPEATABLE READ |
| **쓰기 지연** | SQL 모아서 전송 | 네트워크 비용 감소 |
| **변경 감지** | 스냅샷 비교 후 자동 UPDATE | update() 호출 불필요 |
| **삭제** | remove() 시 삭제 예약 | 쓰기 지연 적용 |

### 핵심 코드

```java
tx.begin();

// 조회 → 1차 캐시 저장
Member m = em.find(Member.class, 1L);

// 같은 조회 → 캐시 반환
Member m2 = em.find(Member.class, 1L);
System.out.println(m == m2);  // true (동일성)

// 수정 → 변경 감지
m.setName("변경");

// 삭제
em.remove(m);

tx.commit();  // INSERT/UPDATE/DELETE SQL 전송
```
