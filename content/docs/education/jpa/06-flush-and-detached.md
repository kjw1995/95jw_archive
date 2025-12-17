---
title: "Chapter 06. 플러시와 준영속"
weight: 6
---

## 1. 플러시 (Flush)

> 영속성 컨텍스트의 **변경 내용을 데이터베이스에 동기화**

### 플러시 실행 시 동작

```
┌─────────────────────────────────────────────────────────────┐
│                       flush() 호출                          │
│                            │                                │
│         ┌──────────────────┼──────────────────┐             │
│         ▼                  ▼                  ▼             │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│   │ 변경 감지 │      │  SQL 생성 │      │  SQL 전송 │         │
│   │(스냅샷비교)│  →   │(쓰기지연) │  →   │  (DB)    │         │
│   └──────────┘      └──────────┘      └──────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

1. **변경 감지** 동작 → 수정된 엔티티 찾기
2. 수정된 엔티티의 **UPDATE SQL** 생성 → 쓰기 지연 저장소 등록
3. 쓰기 지연 저장소의 SQL을 **DB에 전송** (INSERT, UPDATE, DELETE)

> 플러시는 영속성 컨텍스트를 **비우는 게 아님!** DB와 **동기화**하는 것

---

### 플러시 호출 방법

| 방법 | 설명 |
|------|------|
| `em.flush()` | 직접 호출 (거의 사용 안 함) |
| `tx.commit()` | 트랜잭션 커밋 시 자동 호출 |
| JPQL 실행 | 쿼리 실행 전 자동 호출 |

### 1) 직접 호출

```java
em.persist(memberA);
em.persist(memberB);

em.flush();  // 강제로 플러시 → DB에 INSERT 전송

System.out.println("=== flush 후 ===");

tx.commit();
```

### 2) 트랜잭션 커밋 시 자동 호출

```java
em.persist(memberA);
em.persist(memberB);
// 여기까지 DB에 INSERT 안 됨

tx.commit();  // 커밋 전에 자동으로 flush() 호출
```

### 3) JPQL 실행 시 자동 호출

```java
em.persist(memberA);
em.persist(memberB);
em.persist(memberC);
// 아직 DB에 없음!

// JPQL 실행 전에 자동 플러시
TypedQuery<Member> query = em.createQuery(
    "SELECT m FROM Member m", Member.class);
List<Member> members = query.getResultList();
// memberA, B, C도 조회됨!
```

> **왜?** JPQL은 SQL로 변환되어 DB를 직접 조회
> → 플러시 없이 실행하면 persist한 엔티티가 조회 안 됨

```
em.persist(A)  → 영속성 컨텍스트에만 존재
em.persist(B)  → 영속성 컨텍스트에만 존재
em.persist(C)  → 영속성 컨텍스트에만 존재
     │
     │ JPQL 실행 전 자동 flush()
     ▼
DB에 INSERT 실행 → JPQL 조회 시 A, B, C 포함!
```

> `em.find()`는 1차 캐시를 먼저 확인하므로 **플러시 안 함**

---

### 플러시 모드 옵션

```java
em.setFlushMode(FlushModeType.AUTO);    // 기본값
em.setFlushMode(FlushModeType.COMMIT);  // 커밋할 때만
```

| 모드 | 동작 |
|------|------|
| **AUTO** (기본) | 커밋, JPQL 실행 시 플러시 |
| **COMMIT** | 커밋할 때만 플러시 |

---

## 2. 준영속 상태

> 영속성 컨텍스트가 관리하던 **영속 엔티티가 분리**된 상태

### 준영속 상태로 만드는 방법

```java
// 1. 특정 엔티티만 분리
em.detach(entity);

// 2. 영속성 컨텍스트 초기화
em.clear();

// 3. 영속성 컨텍스트 종료
em.close();
```

### 2.1 detach() - 특정 엔티티 분리

```java
Member member = new Member();
member.setId("memberA");
member.setUsername("회원A");

// 영속 상태
em.persist(member);

// 준영속 상태로 전환
em.detach(member);

tx.commit();  // INSERT 실행 안 됨!
```

```
┌─────────────────────────────────────────────────────────┐
│                    영속성 컨텍스트                       │
│                                                         │
│  ┌──────────────┐         ┌───────────────────────┐    │
│  │   1차 캐시    │         │  쓰기 지연 SQL 저장소   │    │
│  │              │         │                       │    │
│  │  memberA ──┼─ detach ─┼─→ INSERT SQL          │    │
│  │    ↓ 제거   │         │      ↓ 제거            │    │
│  │              │         │                       │    │
│  └──────────────┘         └───────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
         해당 엔티티를 관리하기 위한 모든 정보 제거
```

### 2.2 clear() - 영속성 컨텍스트 초기화

```java
Member member = em.find(Member.class, "memberA");

em.clear();  // 영속성 컨텍스트 초기화

// 준영속 상태 → 변경 감지 안 됨
member.setUsername("변경됨");

tx.commit();  // UPDATE 실행 안 됨!
```

### 2.3 close() - 영속성 컨텍스트 종료

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();

Member memberA = em.find(Member.class, "memberA");
Member memberB = em.find(Member.class, "memberB");

tx.commit();

em.close();  // 영속성 컨텍스트 종료 → 모든 엔티티 준영속

// memberA, memberB 모두 준영속 상태
```

---

### 준영속 상태의 특징

| 특징 | 설명 |
|------|------|
| **비영속과 유사** | 영속성 컨텍스트 기능 사용 불가 |
| **식별자 값 있음** | 한 번 영속 상태였으므로 @Id 값 존재 |
| **지연 로딩 불가** | 프록시 초기화 시 예외 발생 |

```java
// 준영속 상태에서는...
member.setUsername("변경");  // 변경 감지 X
em.persist(member);          // 영속화 불가
em.find(...);                // 캐시 조회 불가
```

> 준영속 상태에서 **지연 로딩** 시 `LazyInitializationException` 발생!

---

## 3. 병합 (merge)

> **준영속/비영속 엔티티**를 **영속 상태**로 변경

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
        em1.close();  // 영속성 컨텍스트 종료 → 준영속

        return member;  // 준영속 상태 반환
    }

    static void mergeMember(Member member) {
        EntityManager em2 = emf.createEntityManager();
        EntityTransaction tx2 = em2.getTransaction();

        tx2.begin();

        // 병합: 준영속 → 새로운 영속 엔티티 반환
        Member mergeMember = em2.merge(member);

        tx2.commit();

        System.out.println("member = " + member.getUsername());
        System.out.println("mergeMember = " + mergeMember.getUsername());

        System.out.println("em2 contains member = " + em2.contains(member));
        // false! member는 여전히 준영속

        System.out.println("em2 contains mergeMember = " + em2.contains(mergeMember));
        // true! mergeMember가 영속 상태

        em2.close();
    }
}
```

### merge() 동작 방식

```
1. merge() 호출
        │
        ▼
2. 1차 캐시에서 식별자로 엔티티 조회
        │
        │ 없으면
        ▼
3. DB에서 조회 → 1차 캐시에 저장
        │
        ▼
4. 조회한 영속 엔티티에 파라미터 엔티티 값 복사
        │
        ▼
5. 영속 엔티티 반환 (새로운 인스턴스!)
```

```java
// 파라미터: 준영속 엔티티
Member mergeMember = em.merge(member);

// member ≠ mergeMember (다른 인스턴스!)
// member: 여전히 준영속
// mergeMember: 영속 상태
```

### 비영속 병합

```java
Member newMember = new Member();
newMember.setId("newMember");
newMember.setUsername("신규회원");

// 비영속 엔티티도 병합 가능!
Member merged = em.merge(newMember);
// DB에 없으면 → INSERT
// DB에 있으면 → UPDATE
```

> `merge()`는 **save or update** 기능 수행

---

## 요약

### 플러시

| 항목 | 내용 |
|------|------|
| **정의** | 영속성 컨텍스트 변경 내용을 DB에 동기화 |
| **호출 시점** | 직접 호출, 커밋 시, JPQL 실행 시 |
| **주의** | 영속성 컨텍스트를 비우지 않음 |
| **가능한 이유** | 트랜잭션 작업 단위가 있기 때문 |

### 준영속

| 항목 | 내용 |
|------|------|
| **만드는 방법** | detach, clear, close |
| **특징** | 1차 캐시/변경 감지/쓰기 지연 불가 |
| **식별자** | 있음 (한 번 영속이었으므로) |
| **복구** | merge()로 다시 영속 상태로 |

### 핵심 코드

```java
// 플러시
em.flush();                    // 직접 호출
tx.commit();                   // 자동 호출
em.createQuery("...");         // 자동 호출

// 준영속
em.detach(entity);             // 특정 엔티티
em.clear();                    // 전체 초기화
em.close();                    // 종료

// 병합 (준영속 → 영속)
Member merged = em.merge(detachedMember);
// 주의: 반환된 merged가 영속 상태!
```
