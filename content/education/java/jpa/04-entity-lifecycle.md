---
title: "Chapter 04. 엔티티 생명주기"
weight: 4
---

JPA 가 엔티티를 바라보는 관점은 "현재 **어떤 상태** 에 있느냐" 다. 상태에 따라 변경 감지·1차 캐시 같은 기능이 동작할지 말지가 결정된다.

## 엔티티의 4가지 상태

```
     ┌────────┐   persist()   ┌────────┐
     │ 비영속  │──────────────→│  영속  │
     │ (new)  │               │(managed│
     └────────┘               └───┬────┘
         ▲                        │
         │                detach()│ remove()
         │                clear() │
         │                close() │
         │                        ▼
         │      merge()       ┌────────┐
         └───────────────────│ 준영속 │
                              │detached│
                              └───┬────┘
                                  │ remove()
                                  ▼
                              ┌────────┐
                              │  삭제  │
                              │removed │
                              └────────┘
```

---

## 1. 비영속 (new / transient)

> 영속성 컨텍스트와 **전혀 관계가 없는** 순수 객체

```java
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");
// 아직 persist() 호출 전 → 비영속
```

```
 ┌──────────────────┐
 │  new Member()    │
 │  ┌──────────┐    │
 │  │  member  │    │
 │  └──────────┘    │
 └──────────────────┘
   영속성 컨텍스트 X
   DB 와 무관
```

---

## 2. 영속 (managed)

> 영속성 컨텍스트에 **저장되어 관리**되는 상태

```java
Member member = new Member();
member.setId("member1");

// 비영속 → 영속
em.persist(member);

// 조회로도 영속 상태가 된다
Member findMember = em.find(Member.class, "member1");
```

```
 ┌─────────────────────┐
 │   영속성 컨텍스트     │
 │  ┌───────────────┐  │
 │  │   1차 캐시     │  │
 │  │  @Id │ Entity │  │
 │  │──────┼────────│  │
 │  │"m1"  │member  │◄─┼── 영속!
 │  └───────────────┘  │
 └─────────────────────┘
```

### 영속 상태가 되는 경우

| 경로 | 설명 |
|:-----|:-----|
| `em.persist(entity)` | 비영속 → 영속 |
| `em.find(...)` | DB 조회로 영속 |
| `em.merge(entity)` | 준영속/비영속 → 영속 |
| JPQL 조회 | 결과 엔티티가 영속 |

{{< callout type="info" >}}
영속 상태 = **JPA 가 관리**. 1차 캐시·변경 감지·쓰기 지연 같은 모든 혜택을 받는다.
{{< /callout >}}

---

## 3. 준영속 (detached)

> 영속성 컨텍스트에서 **분리**된 상태. 한 번 관리됐기에 식별자는 있다.

```java
em.detach(member);   // 특정 엔티티만 분리
em.clear();          // 영속성 컨텍스트 초기화
em.close();          // 영속성 컨텍스트 종료
```

### 준영속 상태 만드는 3가지 방법

| 메서드 | 범위 | 설명 |
|:-------|:-----|:-----|
| `em.detach(e)` | 특정 엔티티 | 해당 엔티티만 분리 |
| `em.clear()` | 전체 | 영속성 컨텍스트 초기화 |
| `em.close()` | 전체 | 영속성 컨텍스트 종료 |

```java
// 준영속 상태에서는 변경 감지가 동작하지 않는다
Member member = em.find(Member.class, "m1");   // 영속
em.detach(member);                             // 준영속
member.setUsername("변경됨");                  // 수정해도...
tx.commit();                                   // DB 반영 X
```

{{< callout type="warning" >}}
준영속 상태에서 **지연 로딩 프록시를 초기화**하려 하면 `LazyInitializationException` 이 발생한다. 예: 컨트롤러에서 `member.getTeam().getName()` 을 호출했는데 트랜잭션이 이미 끝나 EM 이 닫힌 경우.
{{< /callout >}}

---

## 4. 삭제 (removed)

> 엔티티를 영속성 컨텍스트와 **데이터베이스에서 삭제**하도록 예약한 상태

```java
Member memberA = em.find(Member.class, "memberA");
em.remove(memberA);   // DELETE SQL 이 쓰기 지연 저장소에 등록
tx.commit();          // 이때 실제 DELETE 실행
```

`remove()` 는 즉시 DELETE 를 날리는 게 아니라, 쓰기 지연 저장소에 등록하고 **커밋(플러시) 시점에** SQL 을 실행한다.

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

// 준영속 → 영속 (새 인스턴스 반환)
Member merged = em.merge(member);

// 영속 → 삭제
em.remove(merged);
```

---

## 상태별 특징 비교

| 상태 | 영속성 컨텍스트 | 식별자 | 1차 캐시 | 변경 감지 | DB 연동 |
|:-----|:---------------|:-------|:--------|:---------|:--------|
| 비영속 | X | 없을 수 있음 | X | X | X |
| 영속 | O | 필수 | O | O | 커밋 시 |
| 준영속 | X | 있음 | X | X | X |
| 삭제 | 제거됨 | 있음 | X | X | 커밋 시 DELETE |

---

## 실전 예제

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();

// 1. 비영속
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");

// 2. 영속 (persist)
em.persist(member);

// 3. 1차 캐시에서 조회 (DB 조회 X)
Member findMember = em.find(Member.class, "member1");

// 4. 변경 감지 (Dirty Checking)
findMember.setUsername("변경된이름");

// 5. 커밋 시 INSERT + UPDATE SQL 실행
tx.commit();

em.close();
```

---

## 요약

| 상태 | 설명 | 특징 |
|:-----|:-----|:-----|
| 비영속 | 순수 객체 | JPA 와 무관 |
| 영속 | 컨텍스트가 관리 | 모든 기능 사용 가능 |
| 준영속 | 분리됨 | 식별자는 있음, 기능 불가 |
| 삭제 | 삭제 예정 | 커밋 시 DB 에서 삭제 |

### 핵심 메서드

```java
em.persist(entity);    // 비영속 → 영속
em.find(...);          // 조회 → 영속
em.detach(entity);     // 영속 → 준영속 (특정)
em.clear();            // 영속 → 준영속 (전체)
em.close();            // 영속 → 준영속 (종료)
em.merge(entity);      // 준영속 → 영속
em.remove(entity);     // 영속 → 삭제
```
