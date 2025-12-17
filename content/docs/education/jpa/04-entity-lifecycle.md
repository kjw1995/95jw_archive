---
title: "Chapter 04. 엔티티 생명주기"
weight: 4
---

## 엔티티의 4가지 상태

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌─────────┐        persist()         ┌─────────┐            │
│    │ 비영속   │ ────────────────────────→ │  영속   │            │
│    │  (new)  │                          │(managed)│            │
│    └─────────┘                          └────┬────┘            │
│         ↑                                    │                 │
│         │                          detach() │ remove()         │
│         │                          clear()  │                  │
│         │                          close()  ▼                  │
│         │         merge()          ┌─────────┐                 │
│         └─────────────────────────←│ 준영속  │                 │
│                                    │(detached)│                │
│                                    └─────────┘                 │
│                                         │                      │
│                                         │ remove()             │
│                                         ▼                      │
│                                    ┌─────────┐                 │
│                                    │  삭제   │                 │
│                                    │(removed)│                 │
│                                    └─────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 비영속 (new/transient)

> 영속성 컨텍스트와 **전혀 관계가 없는** 순수 객체 상태

```java
// 객체만 생성 (비영속)
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");
// 아직 영속성 컨텍스트에 저장하지 않음
```

```
┌──────────────────┐
│    new Member()  │    영속성 컨텍스트와 무관
│    ┌──────────┐  │
│    │  member  │  │    - DB와 무관
│    └──────────┘  │    - 식별자 없을 수도 있음
└──────────────────┘
```

---

## 2. 영속 (managed)

> 영속성 컨텍스트에 **저장되어 관리**되는 상태

```java
Member member = new Member();
member.setId("member1");

// 영속 상태로 전환
em.persist(member);

// 또는 조회로 영속 상태
Member findMember = em.find(Member.class, "member1");
```

```
┌───────────────────────────────────────┐
│          영속성 컨텍스트               │
│   ┌─────────────────────────────┐     │
│   │         1차 캐시            │     │
│   │  ┌──────────┬──────────┐   │     │
│   │  │   @Id    │  Entity  │   │     │
│   │  ├──────────┼──────────┤   │     │
│   │  │ "member1"│  member  │ ← │ ─── │ ─── 영속 상태!
│   │  └──────────┴──────────┘   │     │
│   └─────────────────────────────┘     │
└───────────────────────────────────────┘
```

### 영속 상태가 되는 경우

| 메서드 | 설명 |
|--------|------|
| `em.persist(entity)` | 엔티티 저장 |
| `em.find(...)` | 엔티티 조회 |
| `em.merge(entity)` | 준영속 → 영속 |
| JPQL 조회 | 결과 엔티티 |

---

## 3. 준영속 (detached)

> 영속성 컨텍스트에서 **분리**된 상태

```java
// 특정 엔티티만 분리
em.detach(member);

// 영속성 컨텍스트 초기화 (모든 엔티티 분리)
em.clear();

// 영속성 컨텍스트 종료 (모든 엔티티 분리)
em.close();
```

### 준영속 상태 만드는 3가지 방법

| 메서드 | 범위 | 설명 |
|--------|------|------|
| `em.detach(entity)` | 특정 엔티티 | 해당 엔티티만 분리 |
| `em.clear()` | 전체 | 영속성 컨텍스트 초기화 |
| `em.close()` | 전체 | 영속성 컨텍스트 종료 |

```java
// 준영속 상태에서는 변경 감지 동작 안 함!
Member member = em.find(Member.class, "member1");  // 영속

em.detach(member);  // 준영속

member.setUsername("변경됨");  // 변경해도...
tx.commit();  // DB에 반영 안 됨!
```

---

## 4. 삭제 (removed)

> 엔티티를 영속성 컨텍스트와 **데이터베이스에서 삭제**

```java
// 삭제 대상 조회
Member memberA = em.find(Member.class, "memberA");

// 삭제
em.remove(memberA);  // DELETE SQL 쓰기 지연 저장소에 등록
```

> `remove()` 호출 즉시 영속성 컨텍스트에서 제거, 커밋 시 DELETE SQL 실행

---

## 상태 전이 정리

```java
// 비영속
Member member = new Member();
member.setId("id1");

// 비영속 → 영속
em.persist(member);

// 영속 → 준영속
em.detach(member);

// 준영속 → 영속
Member merged = em.merge(member);

// 영속 → 삭제
em.remove(merged);
```

---

## 상태별 특징 비교

| 상태 | 영속성 컨텍스트 | 식별자 | 1차 캐시 | 변경 감지 | DB 연동 |
|------|----------------|--------|----------|----------|---------|
| **비영속** | X | 없을 수 있음 | X | X | X |
| **영속** | O | 필수 | O | O | 커밋 시 |
| **준영속** | X | 있음 | X | X | X |
| **삭제** | 제거됨 | 있음 | X | X | 커밋 시 DELETE |

---

## 실전 예제

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();

// 1. 비영속 상태
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");

// 2. 영속 상태 (persist)
em.persist(member);
System.out.println("=== persist 후 ===");

// 3. 1차 캐시에서 조회 (DB 조회 X)
Member findMember = em.find(Member.class, "member1");

// 4. 변경 감지 (dirty checking)
findMember.setUsername("변경된이름");

// 5. 커밋 시 INSERT, UPDATE SQL 실행
tx.commit();  // 플러시 → DB 동기화

em.close();
```

---

## 요약

| 상태 | 설명 | 특징 |
|------|------|------|
| **비영속** | 순수 객체 상태 | JPA와 무관 |
| **영속** | 영속성 컨텍스트가 관리 | 모든 기능 사용 가능 |
| **준영속** | 영속성 컨텍스트에서 분리 | 기능 사용 불가, 식별자 있음 |
| **삭제** | 삭제 예정 상태 | 커밋 시 DB에서 삭제 |

### 핵심 메서드

```java
em.persist(entity);   // 비영속 → 영속
em.find(...);         // 조회 → 영속
em.detach(entity);    // 영속 → 준영속 (특정)
em.clear();           // 영속 → 준영속 (전체)
em.close();           // 영속 → 준영속 (종료)
em.merge(entity);     // 준영속 → 영속
em.remove(entity);    // 영속 → 삭제
```
