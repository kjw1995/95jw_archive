---
title: "Chapter 07. 엔티티 매핑"
date: 2025-12-19
weight: 7
---

[Chapter 02](../02-jpa-start)에서 `@Entity`, `@Table`, `@Id`, `@Column`을 처음 봤다. 이 장은 그 매핑 어노테이션을 제대로 파고든다. 매핑이란 "객체 세계의 무엇을 테이블 세계의 무엇에 대응시킬지"를 JPA에게 알려 주는 선언이고, 그 선언에는 기본값과 함정이 있다. 각 어노테이션이 왜 그런 기본값을 갖는지, 어떤 선택이 왜 위험한지를 본다. 특히 기본 키 전략은 앞 장들에서 본 영속 상태와 쓰기 지연에 직접 영향을 주므로 가장 길게 다룬다.

---

## 1. 매핑의 세 축

```
  Member 클래스           MEMBER 테이블
  @Entity/@Table  ────▶  테이블 이름
  @Id             ────▶  기본 키
  @Column 등      ────▶  컬럼 이름·타입
```

| 축 | 어노테이션 | 정하는 것 |
|:---|:-----------|:----------|
| 객체 ↔ 테이블 | `@Entity`, `@Table` | 이 클래스가 어느 테이블인가 |
| 기본 키 | `@Id`, `@GeneratedValue` | 행을 무엇으로 식별하고 그 값은 누가 만드는가 |
| 필드 ↔ 컬럼 | `@Column`, `@Enumerated`, `@Lob`, `@Transient` | 각 필드가 어느 컬럼에 어떤 형태로 들어가는가 |

시작하기 전에 알아 둘 원칙이 하나 있다. JPA는 엔티티의 **모든 필드를 기본적으로 매핑한다.** `@Column`을 붙이지 않은 필드도 필드 이름을 컬럼 이름 삼아 매핑된다. 어노테이션은 매핑을 켜는 스위치가 아니라 기본 동작을 **바꾸는** 수단이고, 매핑에서 빼고 싶을 때 오히려 `@Transient`라는 어노테이션이 필요하다. 이 원칙을 알면 "어노테이션이 없는데 왜 컬럼이 생기지?"라는 의문이 사라진다.

---

## 2. @Entity와 @Table

### 2.1 @Entity: JPA가 관리하는 클래스라는 선언

```java
@Entity(name = "Member")   // name은 JPQL에서 쓰는 이름. 기본값은 클래스 이름
public class Member {
    @Id
    private Long id;
    private String username;
}
```

`@Entity`는 "이 클래스는 테이블에 대응된다"는 선언이다. 이 어노테이션이 붙은 클래스만 엔티티 매니저가 다룰 수 있고, 2장에서 본 것처럼 애플리케이션이 시작될 때 전부 읽혀 매핑 모델이 된다.

`name` 속성은 JPQL에서 부르는 이름이다. 테이블 이름이 아니다. 왜 이름이 둘로 나뉘어 있을까. JPQL은 객체를 대상으로 하는 언어이므로 객체 쪽 이름을 쓰고, 테이블 이름은 `@Table`이 따로 정한다. 덕분에 테이블 이름이 바뀌어도 JPQL은 한 줄도 고치지 않아도 된다. 같은 이름의 클래스가 다른 패키지에 둘 있을 때 충돌을 피하는 용도 말고는 `name`을 지정할 일이 거의 없다.

### 2.2 왜 기본 생성자가 필요하고 final이면 안 되는가

| 요구사항 | 이유 |
|:---------|:-----|
| 기본 생성자 (public 또는 protected) | 조회 결과로 객체를 만들 때 리플렉션으로 이 생성자를 부른다 |
| `final` 클래스 금지 | 지연 로딩 프록시는 엔티티를 상속한 하위 클래스다 |
| 저장할 필드에 `final` 금지 | 조회한 값을 리플렉션으로 채워 넣어야 한다 |
| enum, interface, inner 클래스 금지 | 인스턴스를 만들거나 상속할 수 없다 |

JPA는 SELECT 결과를 객체로 조립할 때 개발자가 만든 생성자를 알지 못한다. 그래서 인자 없는 생성자를 리플렉션으로 호출한 뒤 필드에 값을 채운다. [Chapter 10](../10-proxy-loading)에서 볼 지연 로딩 프록시는 엔티티 클래스를 상속해 만드는데, `final` 클래스는 상속할 수 없다. 두 사실이 위 표의 요구사항 전부를 설명한다.

```java
@Entity
public class Member {

    protected Member() {}   // JPA용. 외부에서 new Member()를 막는다

    public Member(String username) {
        this.username = username;
    }
}
```

기본 생성자를 `protected`로 두는 것이 관례다. JPA와 프록시는 하위 클래스나 리플렉션으로 접근하므로 `protected`면 충분하고, 애플리케이션 코드에는 "이 생성자 말고 의도가 드러나는 생성자를 써라"는 신호가 된다.

### 2.3 @Table: 테이블 쪽 정보

```java
@Entity
@Table(
    name = "MEMBER",
    uniqueConstraints = @UniqueConstraint(
        name = "UK_MEMBER_EMAIL",
        columnNames = {"email"}
    ),
    indexes = @Index(name = "IDX_MEMBER_NAME", columnList = "username")
)
public class Member { ... }
```

| 속성 | 정하는 것 | 기본값 |
|:-----|:----------|:-------|
| `name` | 테이블 이름 | 엔티티 이름 |
| `catalog`, `schema` | 카탈로그, 스키마 | DB 접속 기본값 |
| `uniqueConstraints` | 유니크 제약 (DDL 생성 시) | 없음 |
| `indexes` | 인덱스 (DDL 생성 시) | 없음 |

유니크 제약을 `@Column(unique = true)`가 아니라 `@Table`에 두는 이유는 두 가지다. 여러 컬럼을 묶는 복합 제약은 컬럼 하나에 붙일 수 없고, 제약에 **이름**을 줄 수 있어야 위반 시 어떤 제약인지 로그에서 알아볼 수 있다. 다만 이 정보는 5절에서 볼 DDL 자동 생성 때만 쓰인다. 이미 있는 테이블에는 아무 영향이 없다.

---

## 3. 기본 키 매핑

### 3.1 어떤 값을 기본 키로 쓸 것인가

기본 키 전략을 고르기 전에 더 근본적인 선택이 있다. 주민번호나 이메일처럼 업무상 의미 있는 값을 키로 쓸 것인가(자연 키), 아니면 의미 없는 번호를 따로 둘 것인가(대리 키). JPA에서는 **`Long` 타입 대리 키에 자동 생성 전략**을 쓰는 것이 정답에 가깝다.

이유는 JPA의 구조 자체에 있다. [Chapter 03](../03-persistence-context)에서 봤듯 1차 캐시는 기본키를 열쇠로 쓰는 맵이고, 동일성 보장도 기본키 위에서 성립한다. 영속 상태인 엔티티의 기본키는 바꿀 수 없다. 그런데 업무 규칙은 바뀐다. 주민번호 수집이 금지되고, 이메일은 사용자가 바꾼다. 자연 키를 썼다면 이 변화가 곧 식별자 변경이고, 식별자 변경은 JPA가 가장 다루기 어려운 일이다. 의미 없는 번호는 바뀔 이유가 없다.

```
            @Id
             │
     ┌───────┴───────┐
     │               │
 직접 할당    @GeneratedValue
              ┌──────┼──────┐
              ▼      ▼      ▼
          IDENTITY SEQUENCE TABLE
          (DB 위임)(시퀀스) (키 테이블)
```

### 3.2 직접 할당

```java
@Entity
public class Member {
    @Id
    private String id;   // 애플리케이션이 값을 넣는다
}

Member member = new Member();
member.setId("user001");   // 넣지 않으면 persist 때 예외
em.persist(member);
```

`@GeneratedValue`가 없으면 키는 개발자 책임이다. 레거시 테이블의 코드 값처럼 키가 이미 정해져 있는 경우에 쓴다. 대신 [Chapter 04](../04-entity-lifecycle)에서 본 부작용이 따라온다. JPA는 식별자가 있는 객체를 보고 "새 것인지 이미 있던 것인지" 판단하는데, 직접 할당한 키는 항상 값이 있으니 이 판단이 흐려진다. 스프링 데이터 JPA의 `save()`가 이런 엔티티에 `merge()`를 골라 INSERT 앞에 SELECT를 붙이는 것이 대표적인 결과다.

### 3.3 IDENTITY: 키 생성을 DB에 맡긴다

```java
@Entity
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
}
```

MySQL의 `AUTO_INCREMENT`처럼 DB가 행을 넣을 때 키를 만들어 주는 기능에 기댄다. 애플리케이션은 키를 모른 채 INSERT를 보내고, DB가 만든 값을 돌려받는다.

```
em.persist(member)
      │  키 없이는 영속이 될 수 없다
      ▼
INSERT 즉시 실행
      │  DB가 키를 만든다
      ▼
생성된 키를 받아 1차 캐시에 등록
```

여기서 앞 장들의 원칙과 충돌이 생긴다. 영속 상태가 되려면 키가 있어야 하는데(1차 캐시의 열쇠니까), 이 전략에서 키는 INSERT를 해 봐야 안다. 그래서 IDENTITY에서는 `persist()` 시점에 INSERT가 **즉시** 나간다. 쓰기 지연이 이 전략에서만 동작하지 않는 이유가 최적화 포기가 아니라 영속 상태의 정의 때문이라는 것은 [Chapter 04](../04-entity-lifecycle)에서 본 그대로다.

| 항목 | 내용 |
|:-----|:-----|
| INSERT 시점 | `persist()` 즉시 |
| 쓰기 지연 | INSERT에는 없음. UPDATE와 DELETE는 여전히 커밋 때 |
| JDBC 배치 | INSERT는 묶이지 않음 |
| 어울리는 DB | MySQL, MariaDB, SQL Server처럼 시퀀스가 없거나 auto increment가 표준인 DB |

### 3.4 SEQUENCE: 키를 먼저 받아 온다

```java
@Entity
@SequenceGenerator(
    name = "MEMBER_SEQ_GENERATOR",   // JPA 쪽 별칭
    sequenceName = "MEMBER_SEQ",     // DB 시퀀스 이름
    initialValue = 1,
    allocationSize = 50
)
public class Member {
    @Id
    @GeneratedValue(
        strategy = GenerationType.SEQUENCE,
        generator = "MEMBER_SEQ_GENERATOR"
    )
    private Long id;
}
```

```
em.persist(member)
      │
      ▼
시퀀스에서 키를 받는다
  (allocationSize만큼 미리)
      │
      ▼
키를 가진 채 1차 캐시에 등록
      │  INSERT는 아직
      ▼
커밋(플러시) 때 INSERT
```

시퀀스는 DB가 관리하는 번호표 기계다. INSERT와 무관하게 "다음 번호"를 물어볼 수 있으므로, JPA는 `persist()` 때 번호만 받아 두고 INSERT는 커밋까지 미룰 수 있다. IDENTITY가 잃었던 쓰기 지연과 배치가 여기서는 살아난다. 시퀀스를 지원하는 Oracle, PostgreSQL, H2에서 권장되는 이유다.

**allocationSize는 왜 50인가.** 번호를 매번 DB에 물어보면 `persist()`마다 왕복이 생겨 IDENTITY와 다를 게 없어진다. 그래서 JPA는 한 번에 50개 범위를 받아 메모리에서 나눠 쓴다. DB 시퀀스는 50씩 건너뛰며 증가하고, 애플리케이션은 그 사이 번호를 왕복 없이 사용한다.

```
DB 시퀀스: 1 ──▶ 51 ──▶ 101
            (50씩 증가)
메모리:   1~50 사용   51~100 사용
          (DB 왕복 없음)
```

이 설계에는 지켜야 할 조건과 감수할 대가가 있다. 조건은 **DB 시퀀스의 증가값이 allocationSize와 같아야 한다**는 것이다. 시퀀스가 1씩 증가하는데 애플리케이션이 50개씩 쓴다고 가정하면 번호가 겹친다. Hibernate는 시작할 때 둘을 비교해 다르면 기본적으로 예외를 던진다. 대가는 번호의 **빈틈**이다. 애플리케이션이 재시작하면 메모리에 남아 있던 범위는 버려지고, 인스턴스가 여럿이면 각자 다른 범위를 쓰므로 번호가 시간 순서와 어긋난다. 기본 키는 식별만 하면 되는 값이니 문제는 아니지만, 번호가 연속되리라 기대하는 코드가 있다면 그 기대가 틀린 것이다.

{{< callout type="info" >}}
`@SequenceGenerator`를 생략하고 `@GeneratedValue(strategy = SEQUENCE)`만 쓰면 Hibernate 6는 **엔티티마다 `엔티티명_seq`**라는 시퀀스를 기대한다. Hibernate 5까지는 모든 엔티티가 `hibernate_sequence` 하나를 공유했다. 5에서 6으로 올리면 이 차이 때문에 "시퀀스가 없다"는 오류가 나는데, `hibernate.id.db_structure_naming_strategy=legacy`로 예전 방식을 되돌릴 수 있다. 어느 쪽이든 시퀀스 이름을 명시하는 편이 안전하다.
{{< /callout >}}

### 3.5 TABLE: 시퀀스를 테이블로 흉내 낸다

```java
@Entity
@TableGenerator(
    name = "MEMBER_SEQ_GENERATOR",
    table = "MY_SEQUENCES",
    pkColumnName = "sequence_name",
    valueColumnName = "next_val",
    pkColumnValue = "MEMBER_SEQ",
    allocationSize = 50
)
public class Member {
    @Id
    @GeneratedValue(
        strategy = GenerationType.TABLE,
        generator = "MEMBER_SEQ_GENERATOR"
    )
    private Long id;
}
```

```sql
CREATE TABLE MY_SEQUENCES (
    sequence_name VARCHAR(255) NOT NULL,
    next_val      BIGINT,
    PRIMARY KEY (sequence_name)
);
```

시퀀스가 없는 DB에서도 SEQUENCE처럼 동작하게 하려고 만든 전략이다. 키 전용 테이블에 "다음 번호"를 저장해 두고, 번호가 필요할 때 그 행을 읽고 갱신한다. 모든 DB에서 동작한다는 것이 유일한 장점이다.

거의 쓰이지 않는 이유는 그 "읽고 갱신"에 있다. 번호를 받으려면 SELECT와 UPDATE가 나가고, 여러 트랜잭션이 같은 행을 갱신하려 들면 행 잠금을 두고 줄을 선다. DB가 최적화해 둔 시퀀스나 auto increment에 비해 느리고, 부하가 몰리면 키 테이블 자체가 병목이 된다. 이식성이 정말로 중요한 상황이 아니라면 고를 이유가 없다.

### 3.6 AUTO: 방언이 고른다, 그런데 무엇을

```java
@Id
@GeneratedValue   // strategy 생략 → AUTO
private Long id;
```

AUTO는 "DB에 맞는 전략을 Hibernate가 골라라"는 뜻이다. 편해 보이지만 무엇을 고르는지 알고 써야 한다. Hibernate 6는 AUTO를 **시퀀스 기반**으로 해석한다. 시퀀스가 있는 DB에서는 SEQUENCE로 동작하고, 시퀀스가 없는 MySQL에서는 IDENTITY가 아니라 **TABLE로 대체**한다. 그 결과 `member_seq` 같은 키 테이블을 찾으며, 테이블이 없으면 실행 시점에 실패한다.

스프링 부트 2에서 3으로 올릴 때 "Table 'member_seq' doesn't exist"를 만난 경험이 있다면 원인이 바로 이것이다. 예전 Hibernate는 MySQL에서 AUTO를 IDENTITY로 풀었지만 지금은 아니다. Hibernate가 시퀀스를 선호하는 이유는 배치 INSERT가 가능해서인데, MySQL에서는 그 선호가 키 테이블이라는 최악의 선택으로 이어진다. 결론은 단순하다. **전략은 명시한다.** MySQL이면 IDENTITY, 시퀀스가 있는 DB면 SEQUENCE다.

### 3.7 전략 비교

| 전략 | 키를 아는 시점 | 쓰기 지연 | 배치 INSERT | 언제 |
|:-----|:---------------|:----------|:------------|:-----|
| 직접 할당 | 코드에서 | O | O | 키가 이미 정해진 레거시 |
| IDENTITY | INSERT 후 | INSERT만 X | X | MySQL, SQL Server |
| SEQUENCE | `persist()` 때 | O | O | Oracle, PostgreSQL, H2 |
| TABLE | `persist()` 때 | O | O | 사실상 없음 |
| AUTO | 방언에 따라 | 방언에 따라 | 방언에 따라 | 쓰지 않는 편이 낫다 |

```java
// MySQL
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

// Oracle, PostgreSQL
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "MEMBER_SEQ_GEN")
@SequenceGenerator(name = "MEMBER_SEQ_GEN", sequenceName = "MEMBER_SEQ", allocationSize = 50)
private Long id;
```

---

## 4. 필드와 컬럼 매핑

### 4.1 @Column

```java
@Entity
public class Member {
    @Id
    private Long id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(precision = 10, scale = 2)          // DECIMAL(10, 2)
    private BigDecimal salary;

    @Column(updatable = false)                  // UPDATE 문에서 제외
    private LocalDateTime createdAt;
}
```

| 속성 | 정하는 것 | 기본값 | 어디에 쓰이나 |
|:-----|:----------|:-------|:--------------|
| `name` | 컬럼 이름 | 필드 이름 | SQL 전체 |
| `insertable`, `updatable` | INSERT·UPDATE 문에 포함할지 | true | SQL 생성 |
| `nullable` | NOT NULL 제약 | true | DDL |
| `unique` | 단일 컬럼 유니크 제약 | false | DDL |
| `length` | 문자열 길이 | 255 | DDL |
| `precision`, `scale` | 소수 자릿수 | 방언 기본값 | DDL |
| `columnDefinition` | 컬럼 정의를 통째로 지정 | 없음 | DDL |

표의 마지막 열이 중요하다. `nullable`, `unique`, `length` 같은 속성은 **DDL을 생성할 때만** 쓰인다. `nullable = false`를 붙였다고 JPA가 저장 전에 null을 검사해 주지는 않는다. 실행 중의 검증은 DB 제약이나 Bean Validation의 몫이고, 이 속성들은 5절의 자동 생성이 만드는 DDL에 반영될 뿐이다. 반면 `name`과 `insertable`, `updatable`은 실제 SQL을 바꾼다. 생성일처럼 한 번 쓰고 바꾸지 않을 컬럼에 `updatable = false`를 붙이면 변경 감지가 그 컬럼을 UPDATE 문에서 아예 빼 버린다.

`@Column`을 생략하면 필드 이름이 컬럼 이름이 되고, 타입은 자바 타입에서 유추된다. 기본형과 참조형의 차이 하나만 기억하면 된다.

```java
int age;        // age integer NOT NULL   기본형은 null을 담을 수 없으니 제약이 붙는다
Integer age;    // age integer            null 허용
```

`int` 필드에 DDL이 `NOT NULL`을 붙이는 이유는 DB의 null을 `int`에 담을 방법이 없기 때문이다. null이 들어올 수 있는 컬럼이라면 처음부터 래퍼 타입을 써야 조회 때 터지지 않는다.

{{< callout type="info" >}}
컬럼 이름의 기본값이 "필드 이름"이라고 했지만, 스프링 부트는 그 이름을 다시 snake_case로 바꾼다. `createdAt` 필드는 순수 Hibernate에서 `createdAt` 컬럼, 스프링 부트에서 `created_at` 컬럼이 된다. 5.3절의 네이밍 전략 이야기다. 기존 테이블에 맞춰야 한다면 `name`을 명시하는 것이 가장 확실하다.
{{< /callout >}}

### 4.2 @Enumerated

```java
public enum RoleType { ADMIN, USER, GUEST }

@Entity
public class Member {
    @Enumerated(EnumType.STRING)   // 반드시 STRING
    private RoleType roleType;
}
```

| 타입 | 저장되는 값 | 문제 |
|:-----|:------------|:-----|
| `ORDINAL` (기본값) | 선언 순서 (0, 1, 2) | 상수의 순서가 바뀌면 기존 데이터의 뜻이 바뀐다 |
| `STRING` | 상수 이름 ("ADMIN") | 저장 공간이 조금 더 든다 |

기본값이 왜 하필 위험한 `ORDINAL`일까. JPA 명세가 저장 공간이 작은 쪽을 기본으로 골랐기 때문이다. 정수 하나가 문자열보다 작은 것은 사실이지만, 그 절약이 만드는 위험에 비하면 아무것도 아니다.

```java
enum RoleType { ADMIN, USER }          // ADMIN = 0, USER = 1 로 저장됨

enum RoleType { GUEST, ADMIN, USER }   // 나중에 GUEST를 앞에 추가
// DB의 0은 이제 GUEST로 읽힌다. 원래 ADMIN이었던 사용자가 전부 GUEST가 된다
```

`ORDINAL`은 enum 상수 하나를 중간에 끼워 넣는 평범한 리팩토링 한 번으로 운영 데이터의 의미를 뒤바꾼다. 컴파일 오류도, 실행 오류도 없이 조용히 틀린 값이 읽힌다. `STRING`이면 이름이 저장되므로 순서는 아무 영향이 없다. 상수 이름을 바꾸는 경우만 마이그레이션이 필요한데, 그것은 눈에 보이는 변경이다.

{{< callout type="info" >}}
"A", "U"처럼 짧은 코드를 저장해야 하는 레거시 테이블이라면 `STRING`도 맞지 않는다. 이때는 enum과 DB 값 사이의 변환 규칙을 직접 정의하는 `AttributeConverter`를 쓴다. 순서에 의존하지 않으면서 저장 형식도 마음대로 정할 수 있어, 셋 중 가장 안전한 방법이다.
{{< /callout >}}

### 4.3 날짜와 시간

```java
@Entity
public class Member {
    private LocalDate     birthDate;      // DATE
    private LocalTime     wakeUpTime;     // TIME
    private LocalDateTime createdAt;      // TIMESTAMP
}
```

`java.time` 타입은 어노테이션 없이 매핑된다. 타입 이름이 이미 날짜인지 시간인지 둘 다인지를 말해 주기 때문이다. 옛날 코드에서 보이는 `@Temporal`은 `java.util.Date` 때문에 필요했다. `Date`는 이름과 달리 날짜와 시간을 함께 담고 있어서, DB의 `DATE`, `TIME`, `TIMESTAMP` 중 어디에 넣을지를 개발자가 따로 알려 줘야 했다.

```java
@Temporal(TemporalType.DATE)        // 이렇게 알려 줘야 했다
private Date birthDate;
```

새 코드에서 `Date`를 쓸 이유는 없다. 시간대가 문제되는 서비스라면 `LocalDateTime` 대신 `Instant`나 `OffsetDateTime`을 고려한다. `LocalDateTime`은 시간대 정보가 없어서 서버와 DB의 시간대가 다를 때 값이 어긋날 수 있다.

### 4.4 @Lob

```java
@Entity
public class Article {
    @Id
    private Long id;

    @Lob
    private String content;     // 문자 → CLOB

    @Lob
    private byte[] thumbnail;   // 바이너리 → BLOB
}
```

DB는 큰 값을 일반 컬럼과 다르게 저장한다. `VARCHAR`에는 길이 상한이 있고, 그 이상은 `CLOB`이나 `BLOB` 같은 대형 객체 타입에 넣어야 한다. `@Lob`은 "이 필드는 그런 타입이다"라는 선언이고, 문자 타입이면 CLOB, 바이너리면 BLOB으로 자바 타입을 보고 갈린다. MySQL에서는 각각 `LONGTEXT`, `LONGBLOB`이 된다.

{{< callout type="warning" >}}
PostgreSQL에서 `@Lob String`은 `TEXT`가 아니라 대형 객체(OID)로 매핑되어 조회 때마다 별도 처리가 필요하고 트랜잭션 밖에서 읽으면 오류가 난다. PostgreSQL의 `TEXT`는 길이 제한이 없으므로 `@Lob` 대신 `@Column(columnDefinition = "TEXT")`를 쓰는 편이 낫다.
{{< /callout >}}

### 4.5 @Transient

```java
@Entity
public class Member {
    @Id
    private Long id;

    @Transient
    private int loginAttempts;   // 컬럼 없음. 메모리에서만 쓴다
}
```

1절의 원칙, "모든 필드는 기본적으로 매핑된다" 때문에 존재하는 어노테이션이다. 계산 결과나 화면용 임시 값처럼 저장할 필요가 없는 필드를 매핑에서 뺀다. 자바의 `transient` 키워드로도 같은 효과가 나지만, 그 키워드는 직렬화까지 막으므로 의도를 분명히 하려면 `@Transient`를 쓴다. 당연히 이 필드는 조회로 복원되지 않는다. `find()`로 가져온 객체에서는 기본값이다.

---

## 5. 데이터베이스 스키마 자동 생성

### 5.1 매핑 정보로 DDL을 만든다

```properties
# persistence.xml 이면 hibernate.hbm2ddl.auto
spring.jpa.hibernate.ddl-auto=create
```

[Chapter 01](../01-jpa-intro)에서 JPA는 매핑 정보에서 SQL을 생성한다고 했다. 그 매핑 정보에는 테이블 이름, 컬럼 이름, 타입, 길이, 제약이 전부 들어 있으니 DDL도 만들 수 있다. 이 장에서 본 `nullable`, `length`, `uniqueConstraints`가 쓰이는 곳이 여기다.

| 옵션 | 동작 | 쓰는 곳 |
|:-----|:-----|:--------|
| `create` | 기존 테이블 DROP 후 CREATE | 개발 초기 |
| `create-drop` | `create` + 종료 시 DROP | 테스트 |
| `update` | 달라진 부분만 반영. 추가만 하고 삭제는 안 한다 | 개발 중 |
| `validate` | 매핑과 테이블이 맞는지 확인만. 다르면 시작 실패 | 운영 |
| `none` | 아무것도 안 한다 | 운영 |

스프링 부트는 H2 같은 내장 DB를 쓰면 `create-drop`, 외부 DB를 쓰면 `none`을 기본값으로 고른다. 2장에서 H2로 예제를 돌릴 때 테이블을 만든 적이 없는데도 동작했다면 이 기본값 덕분이다.

### 5.2 왜 운영에서는 쓰지 않는가

`create`가 위험한 이유는 설명이 필요 없다. 애플리케이션이 재시작할 때마다 테이블이 지워진다. 문제는 `update`다. "달라진 것만 반영"이라는 말이 안전하게 들리지만, `update`는 **추가만 할 줄 안다.** 컬럼 이름을 바꾸면 새 컬럼이 추가되고 옛 컬럼은 데이터와 함께 남는다. 타입을 줄이거나 제약을 바꾸는 변경은 반영되지 않거나 실패한다. 매핑과 테이블이 조금씩 어긋난 채로 굴러가다가 어느 날 알 수 없는 오류로 드러난다.

더 근본적인 문제는 DDL이 코드 리뷰와 배포 절차 밖에서 실행된다는 점이다. 누가 언제 어떤 DDL을 실행했는지 기록이 없고, 되돌릴 방법도 없다. 운영 스키마는 Flyway나 Liquibase 같은 마이그레이션 도구로 버전을 관리하고, JPA에는 `validate`를 줘서 매핑과 실제 테이블이 어긋나면 시작 단계에서 실패하게 만드는 것이 정석이다. 자동 생성은 개발 초기에 테이블을 빠르게 잡거나, 생성된 DDL을 참고해 마이그레이션 스크립트를 쓰는 용도로만 쓴다.

{{< callout type="warning" >}}
운영 환경의 `ddl-auto`는 `validate` 또는 `none`이어야 한다. `create`는 데이터를 지우고, `update`는 스키마를 조용히 어긋나게 한다. 둘 다 장애의 원인으로 여러 번 회자된 설정이다.
{{< /callout >}}

### 5.3 네이밍 전략

같은 엔티티가 환경에 따라 다른 컬럼 이름을 만드는 이유는 **네이밍 전략**이 다르기 때문이다. Hibernate는 매핑 정보의 이름을 그대로 쓰지만, 스프링 부트는 자기만의 전략을 기본으로 끼워 넣는다.

| 환경 | 기본 전략 | `createdAt` 필드는 |
|:-----|:----------|:-------------------|
| 순수 Hibernate | `PhysicalNamingStrategyStandardImpl` | `createdAt` |
| 스프링 부트 | `CamelCaseToUnderscoresNamingStrategy` | `created_at` |

스프링 부트가 이렇게 하는 이유는 DB 세계의 관례가 snake_case이기 때문이다. 자바 관례(camelCase)와 DB 관례를 각자 지키면서 둘을 자동으로 잇는 것이다. 다만 이 변환은 `@Column(name = ...)`으로 지정한 이름에도 적용된다. `name = "createdAt"`이라고 명시해도 `created_at`이 된다. 이름을 그대로 쓰고 싶다면 전략을 바꿔야 한다.

```properties
# 이름을 변환 없이 그대로 쓴다
spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
```

---

## 6. 실전 예제

지금까지의 결정을 한 엔티티에 모으면 이렇다. MySQL을 가정한다.

```java
@Entity
@Table(
    name = "member",
    uniqueConstraints = @UniqueConstraint(name = "UK_MEMBER_EMAIL", columnNames = "email")
)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)   // MySQL → IDENTITY 명시
    @Column(name = "member_id")
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 100)
    private String email;

    private Integer age;                                  // null 허용이므로 래퍼 타입

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoleType roleType;

    @Lob
    private String description;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime lastModifiedAt;

    @Transient
    private int loginAttempts;

    protected Member() {}

    public Member(String username, String email, RoleType roleType) {
        this.username = username;
        this.email = email;
        this.roleType = roleType;
        this.createdAt = LocalDateTime.now();
        this.lastModifiedAt = this.createdAt;
    }
}

enum RoleType { ADMIN, USER, GUEST }
```

스프링 부트의 네이밍 전략을 거쳐 생성되는 DDL이다.

```sql
create table member (
    member_id        bigint not null auto_increment,
    username         varchar(50) not null,
    email            varchar(100) not null,
    age              integer,
    role_type        varchar(20) not null,
    description      longtext,
    created_at       datetime(6),
    last_modified_at datetime(6),
    primary key (member_id)
);

alter table member
    add constraint UK_MEMBER_EMAIL unique (email);
```

`loginAttempts`는 `@Transient`라 컬럼이 없고, `roleType`은 snake_case 전략으로 `role_type`이 됐으며, `int`가 아닌 `Integer age`에는 `not null`이 붙지 않았다. 각 줄이 이 장의 어느 절에서 온 결정인지 짚어 보면 복습이 된다.

---

## 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 매핑의 원칙 | 모든 필드가 기본 매핑. `@Transient`로 뺀다 | 어노테이션은 기본 동작을 바꾸는 수단 |
| 기본 생성자, `final` 금지 | 리플렉션 생성과 프록시 상속 | JPA가 객체를 만들고 흉내 내는 방식 |
| 기본 키 | `Long` 대리 키 + 명시적 전략 | 업무 값은 바뀌고, 영속 엔티티의 키는 바꿀 수 없다 |
| IDENTITY | `persist()` 즉시 INSERT | 키 없이는 영속 상태가 될 수 없다 |
| SEQUENCE | 키를 먼저 받아 쓰기 지연 유지, allocationSize 50 | 왕복을 줄인다. 시퀀스 증가값과 일치해야 한다 |
| AUTO | MySQL에서 키 테이블로 빠진다 | Hibernate 6는 시퀀스 기반. 전략은 명시한다 |
| `@Column` 제약 속성 | DDL 생성에만 쓰인다 | 실행 중 검증은 DB와 Bean Validation의 몫 |
| `@Enumerated` | 반드시 `STRING` | `ORDINAL`은 순서 변경 한 번에 데이터가 오염된다 |
| 날짜 | `java.time` 타입, 어노테이션 없이 | 타입 이름이 날짜·시간 구분을 담고 있다 |
| `ddl-auto` | 운영은 `validate` 또는 `none` | `update`는 추가만 하고 기록도 없다 |
| 네이밍 | 스프링 부트는 snake_case 변환 | 기존 테이블이면 `name` 명시 |

### 실무 체크리스트

- 기본 생성자는 `protected`, 클래스와 저장 필드에 `final` 없음
- 기본 키는 `Long` 대리 키. MySQL은 IDENTITY, 시퀀스가 있는 DB는 SEQUENCE를 **명시**
- SEQUENCE는 `allocationSize = 50`, DB 시퀀스도 50씩 증가하도록 생성
- `@Enumerated(EnumType.STRING)`, 코드 값이 필요하면 `AttributeConverter`
- null이 올 수 있는 컬럼은 래퍼 타입, 바뀌지 않는 컬럼은 `updatable = false`
- 운영 `ddl-auto`는 `validate` 또는 `none`, 스키마 변경은 마이그레이션 도구로
