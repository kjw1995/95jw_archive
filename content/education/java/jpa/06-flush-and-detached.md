---
title: "Chapter 06. 플러시와 준영속"
weight: 6
---

## 1. 플러시 (Flush)

> 영속성 컨텍스트의 **변경 내용을 DB 와 동기화**

플러시는 영속성 컨텍스트를 비우는 것이 **아니다**. 쌓여 있는 변경을 DB 에 반영만 할 뿐이며, 엔티티는 그대로 영속 상태를 유지한다.

### 플러시 실행 시 동작

```
       flush() 호출
           │
 ┌─────────┼─────────┐
 ▼         ▼         ▼
변경 감지   SQL 생성  SQL 전송
(스냅샷)  (쓰기지연)  (DB)
```

1. **변경 감지** 동작 → 수정된 엔티티 탐색
2. 수정된 엔티티의 **UPDATE SQL** 생성 → 쓰기 지연 저장소 등록
3. 쓰기 지연 저장소의 SQL 을 **DB 로 전송** (INSERT, UPDATE, DELETE)

---

### 플러시 호출 방법

| 방법 | 설명 |
|:-----|:-----|
| `em.flush()` | 직접 호출 (거의 안 씀) |
| `tx.commit()` | 트랜잭션 커밋 시 자동 |
| JPQL 실행 | 쿼리 실행 전 자동 |

### 1) 직접 호출

```java
em.persist(memberA);
em.persist(memberB);

em.flush();   // 강제 플러시 → DB 에 INSERT 전송

tx.commit();
```

### 2) 트랜잭션 커밋 시 자동 호출

```java
em.persist(memberA);
em.persist(memberB);
// 아직 DB 반영 X

tx.commit();   // 커밋 전 자동 flush()
```

### 3) JPQL 실행 시 자동 호출

```java
em.persist(memberA);
em.persist(memberB);
em.persist(memberC);
// 아직 DB 에 없음!

// JPQL 실행 전 자동 flush
List<Member> members = em.createQuery(
        "SELECT m FROM Member m", Member.class)
    .getResultList();
// A, B, C 도 포함되어 조회됨
```

**왜?** JPQL 은 SQL 로 변환되어 DB 를 직접 조회한다. 플러시 없이 실행하면 `persist()` 한 엔티티가 아직 DB 에 없어 조회 결과에서 빠진다.

```
  persist(A) → 영속성 컨텍스트에만
  persist(B) → 영속성 컨텍스트에만
  persist(C) → 영속성 컨텍스트에만
         │
         │ JPQL 실행 전 자동 flush
         ▼
    DB 에 INSERT → JPQL 로 조회 시 포함
```

{{< callout type="info" >}}
`em.find()` 는 1차 캐시를 먼저 확인하므로 **플러시를 호출하지 않는다**. 플러시가 자동 호출되는 건 JPQL/NativeQuery 등 DB 에 직접 쿼리를 날리는 경우뿐이다.
{{< /callout >}}

---

### 플러시 모드 옵션

```java
em.setFlushMode(FlushModeType.AUTO);     // 기본
em.setFlushMode(FlushModeType.COMMIT);   // 커밋할 때만
```

| 모드 | 동작 |
|:-----|:-----|
| AUTO (기본) | 커밋 + JPQL 실행 시 플러시 |
| COMMIT | 커밋할 때만 플러시 |

`COMMIT` 모드는 쿼리 전에 플러시를 하지 않으므로, 방금 `persist` 한 엔티티가 JPQL 결과에 안 보이는 함정이 있다. 성능 최적화 용도가 아니라면 `AUTO` 를 유지하는 게 안전하다.

---

## 2. 준영속 상태

> 영속성 컨텍스트가 관리하던 **영속 엔티티가 분리**된 상태

### 준영속 상태로 만드는 방법

```java
em.detach(entity);   // 특정 엔티티
em.clear();          // 영속성 컨텍스트 초기화
em.close();          // 영속성 컨텍스트 종료
```

### 2.1 `detach()` — 특정 엔티티 분리

```java
Member member = new Member();
member.setId("memberA");
member.setUsername("회원A");

em.persist(member);   // 영속
em.detach(member);    // 준영속

tx.commit();          // INSERT 실행 안 됨!
```

```
  영속성 컨텍스트
 ┌──────────────────┐
 │ ┌──────────────┐ │
 │ │  1차 캐시     │ │
 │ │  memberA ←─┐ │ │
 │ │            │ │ │   detach
 │ └────────────┼─┘ │ ────────
 │              │   │
 │ ┌────────────▼─┐ │
 │ │쓰기지연 SQL    │ │
 │ │ INSERT   ←──┐│ │
 │ └─────────────┘│ │
 └────────────────┘
  → 해당 엔티티 관련
    정보가 모두 제거
```

### 2.2 `clear()` — 영속성 컨텍스트 초기화

```java
Member member = em.find(Member.class, "memberA");

em.clear();   // 영속성 컨텍스트 초기화

member.setUsername("변경됨");   // 준영속 → 변경 감지 X
tx.commit();                    // UPDATE 실행 안 됨
```

### 2.3 `close()` — 영속성 컨텍스트 종료

```java
tx.begin();

Member a = em.find(Member.class, "memberA");
Member b = em.find(Member.class, "memberB");

tx.commit();

em.close();   // 모든 엔티티 준영속
// a, b 모두 준영속 상태
```

---

### 준영속 상태의 특징

| 특징 | 설명 |
|:-----|:-----|
| 비영속과 유사 | 영속성 컨텍스트 기능 사용 불가 |
| 식별자 있음 | 한 번 영속이었으므로 @Id 값 보존 |
| 지연 로딩 불가 | 프록시 초기화 시 예외 |

```java
// 준영속 상태에서는...
member.setUsername("변경");   // 변경 감지 X
// em.persist(member) 호출 시점에 Id 충돌 이슈 발생 가능
// em.find(...) 는 동작 (새 영속 인스턴스 반환)
```

{{< callout type="warning" >}}
준영속 상태에서 **지연 로딩 프록시를 건드리면** `LazyInitializationException` 이 발생한다. 예: 서비스 트랜잭션이 끝난 뒤 컨트롤러/뷰에서 `member.getTeam().getName()` 을 호출하는 경우 (OSIV 가 꺼져 있으면 자주 발생).
{{< /callout >}}

---

## 3. 병합 (merge)

> **준영속/비영속 엔티티**를 **영속 상태**로 만들어 반환

```java
Member mergeMember = em.merge(member);
```

### 준영속 병합 예제

```java
public class MergeExample {

    static EntityManagerFactory emf =
        Persistence.createEntityManagerFactory("jpabook");

    public static void main(String[] args) {
        // 1. 영속 → 준영속
        Member member = createMember("memberA", "회원1");

        // 2. 준영속 상태에서 변경
        member.setUsername("회원명변경");

        // 3. 병합으로 다시 영속
        mergeMember(member);
    }

    static Member createMember(String id, String username) {
        EntityManager em1 = emf.createEntityManager();
        EntityTransaction tx1 = em1.getTransaction();

        tx1.begin();
        Member member = new Member();
        member.setId(id);
        member.setUsername(username);
        em1.persist(member);
        tx1.commit();

        em1.close();    // 영속성 컨텍스트 종료 → 준영속
        return member;
    }

    static void mergeMember(Member member) {
        EntityManager em2 = emf.createEntityManager();
        EntityTransaction tx2 = em2.getTransaction();

        tx2.begin();

        // 병합 → 새로운 영속 엔티티 반환
        Member mergeMember = em2.merge(member);

        tx2.commit();

        System.out.println(em2.contains(member));
        // false! 파라미터 member 는 여전히 준영속

        System.out.println(em2.contains(mergeMember));
        // true! 반환된 mergeMember 가 영속

        em2.close();
    }
}
```

### `merge()` 동작 방식

```
  1. merge() 호출
         │
         ▼
  2. 1차 캐시에서 식별자로 조회
         │
         │ 없으면
         ▼
  3. DB 에서 조회 → 1차 캐시 저장
         │
         ▼
  4. 영속 엔티티에 파라미터 값 복사
         │
         ▼
  5. 영속 엔티티 반환 (새 인스턴스!)
```

```java
Member mergeMember = em.merge(member);
// member       : 여전히 준영속
// mergeMember  : 영속 상태 (다른 인스턴스)
```

### 비영속 병합

```java
Member newMember = new Member();
newMember.setId("newMember");
newMember.setUsername("신규회원");

// 비영속도 merge 가능
Member merged = em.merge(newMember);
// DB 에 없으면 → INSERT
// DB 에 있으면 → UPDATE
```

`merge()` 는 **save-or-update** 로 동작한다. 편해 보이지만, **전체 필드를 덮어쓰기** 하므로 일부 필드만 null 로 보내면 **의도치 않게 null 저장** 이 될 수 있다. 실무에서는 "변경 감지 + 트랜잭션 안에서 조회 후 수정" 이 더 안전하다.

{{< callout type="warning" >}}
웹 계층에서 DTO 를 엔티티로 넘기고 `merge()` 를 호출하는 패턴은 **모든 필드를 덮어쓴다**. 수정하지 않은 필드가 null 로 저장되는 대표적 버그의 원인이다. 반드시 "조회 후 세터로 부분 수정 → 변경 감지" 패턴을 사용하자.
{{< /callout >}}

---

## 요약

### 플러시

| 항목 | 내용 |
|:-----|:-----|
| 정의 | 영속성 컨텍스트 변경을 DB 로 동기화 |
| 시점 | 직접 호출, 커밋, JPQL 실행 |
| 주의 | 컨텍스트를 비우지 않음 |
| 전제 | 트랜잭션 작업 단위 존재 |

### 준영속

| 항목 | 내용 |
|:-----|:-----|
| 만드는 법 | detach, clear, close |
| 특징 | 1차 캐시/변경 감지/쓰기 지연 X |
| 식별자 | 있음 |
| 복구 | merge() 로 다시 영속 |

### 핵심 코드

```java
// 플러시
em.flush();                    // 직접
tx.commit();                   // 자동
em.createQuery("...");         // 자동

// 준영속
em.detach(entity);             // 특정
em.clear();                    // 전체 초기화
em.close();                    // 종료

// 병합 (준영속 → 영속)
Member merged = em.merge(detachedMember);
// 반환된 merged 가 영속!
```
