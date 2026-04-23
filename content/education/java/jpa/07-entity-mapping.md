---
title: "Chapter 07. 엔티티 매핑"
weight: 7
---

## 엔티티 매핑 개요

JPA 매핑 어노테이션은 "어떤 객체 구조를 어떤 테이블 구조에 대응시킬지" 선언하는 수단이다. 크게 **클래스 단위**, **기본 키**, **필드-컬럼** 세 축으로 나뉜다.

```
    Java 객체           DB 테이블
  ┌──────────────┐    ┌──────────────┐
  │  @Entity     │    │ CREATE TABLE │
  │  class Member│◄──►│   MEMBER     │
  │  { @Id Long  │    │  ( id PK ... │
  │    @Column…  │    │    ...       │
  │  }           │    │  )           │
  └──────────────┘    └──────────────┘
```

### 매핑 어노테이션 분류

| 분류 | 어노테이션 | 설명 |
|:-----|:-----------|:-----|
| 객체-테이블 | `@Entity`, `@Table` | 엔티티와 테이블 |
| 기본 키 | `@Id`, `@GeneratedValue` | PK 전략 |
| 필드-컬럼 | `@Column` | 필드 ↔ 컬럼 |
| 열거형 | `@Enumerated` | Enum 매핑 |
| 날짜 | `@Temporal` | Date/Calendar (레거시) |
| 대용량 | `@Lob` | BLOB, CLOB |
| 제외 | `@Transient` | 매핑 제외 |

---

## 1. @Entity

> JPA 가 관리하는 엔티티 클래스로 지정

```java
@Entity
public class Member {
    @Id
    private Long id;
    private String username;
}
```

### @Entity 속성

| 속성 | 기능 | 기본값 |
|:-----|:-----|:-------|
| `name` | JPQL 에서 사용할 엔티티 이름 | 클래스 이름 |

### 필수 요구사항

```
   @Entity 적용 시 주의
 ┌──────────────────────┐
 │ ✅ 기본 생성자 필수    │
 │    (public/protected)│
 │ ❌ final 클래스 불가   │
 │ ❌ enum/interface/    │
 │    inner 클래스 불가  │
 │ ❌ 저장 필드에 final X│
 └──────────────────────┘
```

```java
@Entity
public class Member {

    // 기본 생성자 필수!
    protected Member() {}

    public Member(String username) {
        this.username = username;
    }
}
```

{{< callout type="info" >}}
JPA 는 **프록시 생성 시 기본 생성자**를 호출하고, 리플렉션으로 필드를 채운다. 그래서 `final` 클래스·`final` 필드는 프록시·지연 로딩에서 문제를 일으킨다. 기본 생성자를 `protected` 로 두면 "직접 `new Member()` 하지 말고 생성자·빌더를 써라" 는 의도도 전달할 수 있다.
{{< /callout >}}

---

## 2. @Table

> 엔티티와 매핑할 테이블을 지정

```java
@Entity
@Table(
    name = "MEMBER",
    schema = "public",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "UK_MEMBER_EMAIL",
            columnNames = {"email"}
        )
    }
)
public class Member { ... }
```

### @Table 속성

| 속성 | 기능 | 기본값 |
|:-----|:-----|:-------|
| `name` | 테이블 이름 | 엔티티 이름 |
| `catalog` | 카탈로그 | - |
| `schema` | 스키마 | - |
| `uniqueConstraints` | DDL 생성 시 UK | - |

---

## 3. 기본 키 매핑

```
          @Id
           │
  ┌────────┴────────┐
  │                 │
 직접 할당     @GeneratedValue
              ┌──────┼──────┐
              ▼      ▼      ▼
          IDENTITY SEQUENCE TABLE
          (DB 위임)(시퀀스) (키 테이블)
```

### 3.1 직접 할당 전략

```java
@Entity
public class Member {
    @Id
    private String id;   // 직접 할당

    private String username;
}

Member member = new Member();
member.setId("user001");   // 직접 설정 필수
em.persist(member);
```

**적용 가능 타입**: 자바 기본형, Wrapper, String, Date, BigDecimal, BigInteger

---

### 3.2 IDENTITY 전략

> 기본 키 생성을 **DB 에 위임** (MySQL `AUTO_INCREMENT`, PostgreSQL `SERIAL`)

```java
@Entity
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
}
```

**동작 방식**

```
  em.persist(member)
         │
         ▼
  ┌──────────────┐
  │ INSERT 즉시! │ ← ID 받으려면
  └──────┬───────┘   즉시 실행
         │
         ▼
  DB 에서 ID 생성
  (AUTO_INCREMENT)
         │
         ▼
  영속성 컨텍스트 저장
```

**특징**

| 항목 | 설명 |
|:-----|:-----|
| 장점 | 간단, DB 기능 활용 |
| 단점 | 쓰기 지연·배치 INSERT 불가 |
| 적합 DB | MySQL, PostgreSQL, SQL Server |

{{< callout type="warning" >}}
IDENTITY 는 `em.persist()` 호출 **즉시** INSERT 가 실행된다. PK 를 알아야 1차 캐시에 등록할 수 있기 때문이다. 따라서 **쓰기 지연/JDBC 배치가 동작하지 않는다**.
{{< /callout >}}

---

### 3.3 SEQUENCE 전략

> DB 시퀀스를 사용하여 기본 키 생성 (Oracle, PostgreSQL, H2)

```java
@Entity
@SequenceGenerator(
    name = "MEMBER_SEQ_GENERATOR",
    sequenceName = "MEMBER_SEQ",
    initialValue = 1,
    allocationSize = 50    // 성능 최적화!
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

**동작 방식**

```
  em.persist(member)
         │
         ▼
  ┌──────────────┐
  │ 시퀀스 조회   │ ← DB 에서 값 획득
  └──────┬───────┘
         │
         ▼
  영속성 컨텍스트 저장
         │
         ▼
  commit 시 INSERT
  (쓰기 지연 O)
```

**@SequenceGenerator 속성**

| 속성 | 기능 | 기본값 |
|:-----|:-----|:-------|
| `name` | 식별자 생성기 이름 | 필수 |
| `sequenceName` | DB 시퀀스 이름 | `hibernate_sequence` |
| `initialValue` | 시작 값 | 1 |
| `allocationSize` | 한 번에 할당할 크기 | **50** |

**성능 최적화: allocationSize**

```java
// allocationSize = 50 설정 시
// 1. 첫 persist(): 시퀀스에서 1~50 확보
// 2. 메모리에서 1~50 사용 (DB 왕복 없음)
// 3. 51 번째 persist(): 51~100 확보
```

{{< callout type="info" >}}
`allocationSize` 기본값은 **50 권장**. 시퀀스 접근 횟수가 크게 줄어든다. 단, 다른 애플리케이션과 같은 시퀀스를 공유할 경우 값이 튀어서 번호가 띄엄띄엄 찍힐 수 있다 (문제는 아니지만 UX 상 주의).
{{< /callout >}}

---

### 3.4 TABLE 전략

> 키 전용 테이블로 시퀀스를 흉내

```java
@Entity
@TableGenerator(
    name = "MEMBER_SEQ_GENERATOR",
    table = "MY_SEQUENCES",
    pkColumnName = "sequence_name",
    valueColumnName = "next_val",
    pkColumnValue = "MEMBER_SEQ",
    allocationSize = 1
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
-- MEMBER_SEQ | 100
```

| 항목 | 설명 |
|:-----|:-----|
| 장점 | 모든 DB 에서 사용 가능 |
| 단점 | 테이블 조회/수정으로 성능 저하 |
| 적합 상황 | DB 종속성을 최소화하고 싶을 때 |

실무에서는 성능 이슈로 거의 쓰지 않는다.

---

### 3.5 AUTO 전략

> DB 방언에 따라 자동으로 전략을 선택

```java
@Entity
public class Member {
    @Id
    @GeneratedValue    // strategy 생략 → AUTO
    private Long id;
}
```

- MySQL → IDENTITY
- Oracle → SEQUENCE
- H2 → SEQUENCE

---

### 전략별 비교

| 전략 | 쓰기 지연 | 성능 | 호환성 | 실무 |
|:-----|:---------|:-----|:-------|:-----|
| IDENTITY | ❌ | 보통 | 중 | MySQL 표준 |
| SEQUENCE | ✅ | 우수 | 중 | Oracle 권장 |
| TABLE | ✅ | 낮음 | 최고 | 거의 X |
| AUTO | — | — | 높음 | 개발 초기 |

**실무 권장 예시**

```java
// MySQL
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

// Oracle (성능 최적화)
@SequenceGenerator(
    name = "SEQ_GEN",
    sequenceName = "MEMBER_SEQ",
    allocationSize = 50
)
@GeneratedValue(
    strategy = GenerationType.SEQUENCE,
    generator = "SEQ_GEN"
)
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

    @Column(
        name = "username",
        nullable = false,
        length = 50,
        unique = true,
        columnDefinition =
            "VARCHAR(100) DEFAULT 'EMPTY'"
    )
    private String username;

    @Column(precision = 10, scale = 2)   // DECIMAL(10,2)
    private BigDecimal salary;
}
```

**주요 속성**

| 속성 | 기능 | 기본값 |
|:-----|:-----|:-------|
| `name` | 컬럼 이름 | 필드 이름 |
| `nullable` | NULL 허용 (DDL) | true |
| `unique` | UNIQUE (DDL) | false |
| `length` | 문자 길이 (DDL) | 255 |
| `columnDefinition` | DDL 직접 지정 | - |
| `precision`, `scale` | BigDecimal 정밀도 | 19, 2 |

**@Column 생략 시**

```java
int age;        // → age integer NOT NULL  (기본형)
Integer age;    // → age integer           (null 가능)
String name;    // → name varchar(255)
```

기본형은 NULL 이 될 수 없으므로 자동으로 `NOT NULL`, 객체형은 `NULL` 허용이 붙는다.

---

### 4.2 @Enumerated

```java
public enum RoleType {
    ADMIN, USER, GUEST
}

@Entity
public class Member {
    @Enumerated(EnumType.STRING)   // 반드시 STRING!
    private RoleType roleType;
}
```

**EnumType 비교**

| 타입 | 저장 값 | 치명적 단점 | 권장 |
|:-----|:-------|:-----------|:-----|
| `ORDINAL` | 순서 (0,1,2) | Enum 순서 바뀌면 데이터 오염! | ❌ 금지 |
| `STRING` | 이름 ("ADMIN") | DB 크기 증가 (미미) | ✅ 필수 |

**ORDINAL 금지 이유**

```java
// 초기
enum RoleType { ADMIN, USER }  // ADMIN=0, USER=1
member.setRoleType(ADMIN);     // DB 에 0 저장

// 나중에 Enum 순서 변경
enum RoleType { GUEST, ADMIN, USER }
// GUEST=0, ADMIN=1, USER=2

// 기존 데이터 조회
// DB 의 0 → 이제 GUEST 로 읽힘 (원래 ADMIN) 💥
```

{{< callout type="warning" >}}
**반드시 `EnumType.STRING` 사용**. `ORDINAL` 은 Enum 상수 추가·순서 변경 한 번만에 운영 데이터를 망가뜨릴 수 있다.
{{< /callout >}}

---

### 4.3 @Temporal (레거시)

```java
@Temporal(TemporalType.DATE)
private Date birthDate;           // 날짜만

@Temporal(TemporalType.TIME)
private Date wakeUpTime;          // 시간만

@Temporal(TemporalType.TIMESTAMP)
private Date createdDate;         // 날짜+시간
```

**Java 8+ 권장 방식**

```java
@Entity
public class Member {
    private LocalDate      birthDate;         // @Temporal X
    private LocalTime      wakeUpTime;        // @Temporal X
    private LocalDateTime  createdDateTime;   // @Temporal X
    private ZonedDateTime  registeredAt;      // 타임존 포함
}
```

| 타입 | @Temporal 필요 | 권장 | 용도 |
|:-----|:--------------|:-----|:-----|
| `java.util.Date` | ✅ | ❌ | 레거시만 |
| `LocalDate` | ❌ | ✅ | 날짜 |
| `LocalTime` | ❌ | ✅ | 시간 |
| `LocalDateTime` | ❌ | ✅ | 날짜+시간 |
| `ZonedDateTime` | ❌ | ✅ | 타임존 포함 |

---

### 4.4 @Lob

```java
@Entity
public class Article {
    @Id
    private Long id;

    @Lob
    private String content;     // CLOB (문자)

    @Lob
    private byte[] thumbnail;   // BLOB (바이너리)
}
```

- 문자형 (String, char[]) → **CLOB**
- 바이너리 (byte[], Byte[]) → **BLOB**

---

### 4.5 @Transient

```java
@Entity
public class Member {
    @Id private Long id;
    private String username;

    @Transient
    private int temp;   // DB 저장 X, 메모리 전용
}
```

---

## 5. 데이터베이스 스키마 자동 생성

JPA 는 엔티티 매핑 정보를 바탕으로 DDL 을 자동 생성할 수 있다.

### hibernate.hbm2ddl.auto 옵션

```xml
<!-- persistence.xml -->
<property name="hibernate.hbm2ddl.auto" value="create" />
```

| 옵션 | 동작 | 용도 | 위험도 |
|:-----|:-----|:-----|:-------|
| `create` | DROP + CREATE | 개발 초기 | 높음 |
| `create-drop` | CREATE + 종료 시 DROP | 테스트 | 높음 |
| `update` | 변경사항 반영 (추가만) | 개발 중 | 중간 |
| `validate` | 매핑 확인만 | 테스트/운영 | 안전 |
| `none` | 사용 안 함 | 운영 | 안전 |

**환경별 권장 설정**

| 환경 | 권장 옵션 |
|:-----|:----------|
| 개발 초기 | create, update |
| 테스트 서버 | create, create-drop, validate |
| 스테이징 | validate, none |
| 운영 서버 | validate, none (필수) |

{{< callout type="warning" >}}
**운영에서 `create`·`update` 절대 금지**. 앱 재시작만으로 테이블이 날아가거나 예기치 않은 컬럼이 추가돼 장애로 이어진다. 운영 DDL 은 Flyway·Liquibase 같은 마이그레이션 도구로 관리하자.
{{< /callout >}}

### 네이밍 전략

```properties
# 카멜케이스 → 스네이크케이스 자동 변환
spring.jpa.hibernate.naming.physical-strategy=
  org.hibernate.boot.model.naming
  .SpringPhysicalNamingStrategy
```

```
  Java: private LocalDateTime createdDate;
  DB  : created_date
```

---

## 6. 실전 예제

```java
@Entity
@Table(
    name = "MEMBER",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "UK_MEMBER_EMAIL",
            columnNames = "email"
        )
    }
)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "email", nullable = false, length = 100)
    private String email;

    @Column(name = "age")
    private Integer age;    // NULL 가능

    @Enumerated(EnumType.STRING)
    @Column(name = "role_type", nullable = false, length = 20)
    private RoleType roleType;

    @Lob
    @Column(name = "description")
    private String description;

    private LocalDateTime createdDate;
    private LocalDateTime lastModifiedDate;

    @Transient
    private String tempData;

    protected Member() {}   // JPA 필수

    public Member(String username, String email, RoleType role) {
        this.username = username;
        this.email = email;
        this.roleType = role;
        this.createdDate = LocalDateTime.now();
        this.lastModifiedDate = LocalDateTime.now();
    }
}

enum RoleType { ADMIN, USER, GUEST }
```

**생성되는 DDL**

```sql
CREATE TABLE MEMBER (
    member_id          BIGINT NOT NULL AUTO_INCREMENT,
    username           VARCHAR(50)  NOT NULL,
    email              VARCHAR(100) NOT NULL,
    age                INTEGER,
    role_type          VARCHAR(20)  NOT NULL,
    description        CLOB,
    created_date       TIMESTAMP,
    last_modified_date TIMESTAMP,
    PRIMARY KEY (member_id),
    CONSTRAINT UK_MEMBER_EMAIL UNIQUE (email)
);
```

---

## 요약

### 핵심 어노테이션

| 어노테이션 | 용도 | 필수 |
|:-----------|:-----|:-----|
| `@Entity` | 엔티티 클래스 | ✅ |
| `@Table` | 테이블 이름 | 선택 |
| `@Id` | 기본 키 | ✅ |
| `@GeneratedValue` | 자동 생성 | 권장 |
| `@Column` | 컬럼 상세 | 권장 |
| `@Enumerated` | Enum 매핑 | Enum 사용 시 |
| `@Lob` | 대용량 | 필요 시 |
| `@Transient` | 매핑 제외 | 필요 시 |

### 실무 체크리스트

- 엔티티에 기본 생성자 (`protected`) 추가
- 기본 키 전략 선택: MySQL=IDENTITY, Oracle=SEQUENCE
- `@Enumerated` 는 **반드시 `STRING`**
- 날짜는 `LocalDate`/`LocalDateTime` (Temporal 불필요)
- NOT NULL 컬럼은 `nullable=false` 명시
- 운영 환경 `hbm2ddl.auto = validate` 또는 `none`
- PK 는 `Long` + 대리키 + 자동 생성 전략 권장

### 주의사항

**절대 금지**
- `@Enumerated(EnumType.ORDINAL)`
- 운영에서 `hbm2ddl.auto=create/update`
- `@Entity` 기본 생성자 누락
- 저장 필드에 `final`

**권장사항**
- 기본 키: `Long` 대리키 + 자동 생성
- SEQUENCE: `allocationSize = 50`
- `LocalDate`/`LocalDateTime` 사용
- 제약조건은 DB 레벨에도 설정
