---
title: "Chapter 05. 영속성 컨텍스트 특징"
weight: 5
---

## 1. 1차 캐시

> 영속성 컨텍스트 내부의 **Map 형태 캐시**

Key 는 `@Id` 식별자, Value 는 엔티티 인스턴스다. 같은 트랜잭션 안에서만 유효하므로, 커밋·close 시 사라지는 **짧은 수명의 캐시**다.

```
 ┌────────────────────────┐
 │    영속성 컨텍스트       │
 │ ┌────────────────────┐ │
 │ │      1차 캐시       │ │
 │ │ ┌─────┬──────────┐ │ │
 │ │ │ @Id │  Entity  │ │ │
 │ │ │─────┼──────────│ │ │
 │ │ │ "1" │ Member   │ │ │
 │ │ │ "2" │ Member   │ │ │
 │ │ └─────┴──────────┘ │ │
 │ └────────────────────┘ │
 └────────────────────────┘
   Key: 식별자(@Id)
   Value: 엔티티 인스턴스
```

### 1차 캐시에서 조회

```java
Member member = new Member();
member.setId("member1");
member.setUsername("회원1");

em.persist(member);   // 1차 캐시에 저장

// 같은 트랜잭션 내 조회 → DB 조회 X
Member findMember = em.find(Member.class, "member1");
```

### 데이터베이스에서 조회

1차 캐시에 없는 경우의 흐름:

```
  em.find()
     │
     ▼
  1차 캐시 조회
     │
     │ 없음
     ▼
  ┌──────────┐
  │ Database │
  │  SELECT  │
  └─────┬────┘
        │
        ▼
  1차 캐시에 저장
        │
        ▼
  영속 엔티티 반환
```

```java
Member m = em.find(Member.class, "member2");

// 1. 1차 캐시 조회 → 없음
// 2. DB SELECT
// 3. 결과를 1차 캐시에 저장
// 4. 영속 상태의 엔티티 반환
```

---

## 2. 동일성 보장 (Identity)

> 같은 트랜잭션 내에서 **같은 엔티티는 같은 인스턴스** 반환

```java
Member a = em.find(Member.class, "member1");
Member b = em.find(Member.class, "member1");

System.out.println(a == b);   // true
```

### 동일성 vs 동등성

| 비교 | 연산자 | 의미 |
|:-----|:-------|:-----|
| 동일성 (identity) | `==` | 참조(주소) 비교 |
| 동등성 (equality) | `equals()` | 값 비교 |

{{< callout type="info" >}}
JPA 는 1차 캐시로 **REPEATABLE READ** 수준의 격리를 **애플리케이션 레벨**에서 흉내낸다. DB 격리 수준이 READ COMMITTED 여도, 같은 트랜잭션에서 같은 엔티티를 두 번 조회했을 때 같은 인스턴스가 반환된다.
{{< /callout >}}

---

## 3. 트랜잭션을 지원하는 쓰기 지연 (Write-behind)

> SQL 을 바로 보내지 않고 **모아서 한 번에 전송**

```java
tx.begin();

em.persist(memberA);   // INSERT → 쓰기 지연 저장소
em.persist(memberB);   // INSERT → 쓰기 지연 저장소
// 아직 DB 전송 X

tx.commit();           // flush → 쌓인 SQL 을 DB 로 전송
```

### 동작 흐름

```
  영속성 컨텍스트
 ┌────────────────────┐
 │  ┌──────────────┐  │
 │  │  1차 캐시     │  │
 │  │ id1 │ memA   │  │
 │  │ id2 │ memB   │  │
 │  └──────────────┘  │
 │        │           │
 │        │ persist   │
 │        ▼           │
 │  ┌──────────────┐  │
 │  │ 쓰기 지연     │  │
 │  │ SQL 저장소    │  │
 │  │ INSERT ...   │  │
 │  │ INSERT ...   │  │
 │  └──────┬───────┘  │
 └─────────┼──────────┘
           │ commit()
           ▼
      ┌─────────┐
      │Database │
      └─────────┘
```

### 쓰기 지연이 가능한 이유

```java
begin();     // 트랜잭션 시작
save(A);     // SQL 저장
save(B);     // SQL 저장
save(C);     // SQL 저장
commit();    // 이때 한 번에 전송해도 결과는 동일
```

어차피 **커밋 전까지는 DB 에 반영되지 않으므로**, 커밋 직전까지 SQL 을 모아놔도 트랜잭션 관점에서는 아무 문제가 없다. 오히려 네트워크 왕복 횟수가 줄어 성능이 향상된다.

{{< callout type="info" >}}
`hibernate.jdbc.batch_size` 옵션을 설정하면 쌓인 INSERT 를 **JDBC 배치**로 묶어 전송해 더 큰 성능 향상을 얻을 수 있다 (단, IDENTITY 전략은 배치 불가).
{{< /callout >}}

---

## 4. 변경 감지 (Dirty Checking)

> 엔티티 수정 시 **별도의 `update()` 호출 없이** 자동으로 UPDATE SQL 생성

```java
tx.begin();

Member m = em.find(Member.class, "memberA");
m.setUsername("hi");
m.setAge(10);

// em.update(m);  ← 이런 코드 필요 없음!

tx.commit();    // 자동으로 UPDATE SQL 실행
```

### 동작 원리: 스냅샷

영속성 컨텍스트는 엔티티를 처음 영속 상태로 만들 때, **최초 상태의 복사본(스냅샷)** 을 따로 저장해둔다. 플러시 시점에 **현재 엔티티 vs 스냅샷** 을 필드 단위로 비교해 차이가 있으면 UPDATE SQL 을 만든다.

```
   영속성 컨텍스트
 ┌──────────────────────┐
 │     1차 캐시          │
 │ ┌──────────────────┐ │
 │ │ @Id │Entity│스냅샷│ │
 │ │─────┼──────┼─────│ │
 │ │ "A" │{hi,10│회원A,│ │
 │ │     │  }   │ 20} │ │
 │ └──────────────────┘ │
 │         │      │     │
 │         └──┬───┘     │
 │         비교          │
 │            ▼          │
 │       [변경 감지]     │
 │            │          │
 │            ▼          │
 │    UPDATE SQL 생성    │
 └──────────────────────┘
```

### 변경 감지 흐름

1. 트랜잭션 커밋 → EM 이 `flush()` 호출
2. 엔티티와 스냅샷 비교
3. 변경된 엔티티 발견 → UPDATE SQL 생성 → 쓰기 지연 저장소
4. SQL 을 DB 로 전송
5. DB 트랜잭션 커밋

### 주의: 영속 상태의 엔티티만!

```java
// 영속 → 변경 감지 O
Member member = em.find(Member.class, "m1");
member.setUsername("변경됨");   // 반영 O

// 준영속 → 변경 감지 X
em.detach(member);
member.setUsername("다시변경");  // 반영 X
```

### 모든 필드 UPDATE (기본 전략)

```sql
UPDATE MEMBER SET
    ID       = ?,
    USERNAME = ?,
    AGE      = ?
WHERE ID = ?
```

기본값이 전체 필드를 UPDATE 하는 이유:

1. 수정 쿼리가 항상 동일 → 앱 로딩 시 미리 생성해 재사용
2. DB 도 같은 SQL 은 **파싱 결과를 캐시** 해 재사용

### 동적 UPDATE (`@DynamicUpdate`)

필드 수가 많거나(30개 이상), 저장되는 데이터가 큰 경우:

```java
@Entity
@org.hibernate.annotations.DynamicUpdate
public class Member { ... }
```

변경된 필드만 UPDATE 한다. 다만 매번 SQL 을 새로 만들어야 하므로 **작은 엔티티에는 오히려 손해**다.

---

## 5. 엔티티 삭제

```java
Member m = em.find(Member.class, "memberA");
em.remove(m);
tx.commit();   // DELETE SQL 실행
```

`remove()` 호출 시:

- 영속성 컨텍스트에서 **즉시 제거**
- DELETE SQL 은 **쓰기 지연 저장소**에 등록
- **커밋(플러시) 시** DB 에 DELETE 전송
- 삭제된 엔티티는 재사용하지 말 것 (비영속에 가까운 상태)

---

## 요약

| 특징 | 동작 | 이점 |
|:-----|:-----|:-----|
| 1차 캐시 | 엔티티를 메모리에 캐시 | DB 조회 감소 |
| 동일성 보장 | 같은 PK = 같은 인스턴스 | REPEATABLE READ |
| 쓰기 지연 | SQL 모아 전송 | 네트워크 비용 감소 |
| 변경 감지 | 스냅샷 비교 후 자동 UPDATE | update() 호출 불필요 |
| 삭제 | remove() 시 삭제 예약 | 쓰기 지연 적용 |

### 핵심 코드

```java
tx.begin();

// 조회 → 1차 캐시 저장
Member m = em.find(Member.class, 1L);

// 같은 조회 → 캐시 반환
Member m2 = em.find(Member.class, 1L);
System.out.println(m == m2);   // true

// 수정 → 변경 감지
m.setName("변경");

// 삭제
em.remove(m);

tx.commit();   // INSERT/UPDATE/DELETE 한 번에 전송
```
