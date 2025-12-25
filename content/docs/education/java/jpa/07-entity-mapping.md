---
title: "Chapter 07. 엔티티 매핑"
weight: 7
---

## 엔티티 매핑 개요

JPA는 다양한 매핑 어노테이션을 제공하여 객체와 테이블을 정확히 연결한다.

```
┌─────────────────────────────────────────────────────────┐
│                   엔티티 매핑 구조                         │
│                                                         │
│  ┌──────────────┐         매핑         ┌──────────────┐ │
│  │  Java 객체   │ ←──────────────────→ │  DB 테이블    │ │
│  │              │                      │              │ │
│  │  @Entity     │                      │  CREATE TABLE│ │
│  │  class Member│                      │  MEMBER      │ │
│  │  {           │                      │  (           │ │
│  │    @Id       │  ← 기본 키 매핑 →     │    id PK     │ │
│  │    Long id   │                      │    ...       │ │
│  │              │                      │  )           │ │
│  │    @Column   │  ← 필드/컬럼 매핑 →   │              │ │
│  │    String... │                      │              │ │
│  │  }           │                      │              │ │
│  └──────────────┘                      └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 매핑 어노테이션 분류

| 분류 | 어노테이션 | 설명 |
|------|-----------|------|
| **객체-테이블** | `@Entity`, `@Table` | 엔티티와 테이블 매핑 |
| **기본 키** | `@Id`, `@GeneratedValue` | 기본 키 매핑 전략 |
| **필드-컬럼** | `@Column` | 필드와 컬럼 매핑 |
| **열거형** | `@Enumerated` | Enum 타입 매핑 |
| **날짜** | `@Temporal` | 날짜 타입 매핑 (레거시) |
| **대용량** | `@Lob` | BLOB, CLOB 매핑 |
| **제외** | `@Transient` | 매핑 제외 필드 |

---

## 1. @Entity

> JPA가 관리하는 엔티티 클래스로 지정

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
|------|------|--------|
| `name` | JPA에서 사용할 엔티티 이름 | 클래스 이름 |

### 필수 요구사항

```
┌────────────────────────────────────────────┐
│        @Entity 적용 시 주의사항             │
├────────────────────────────────────────────┤
│ ✅ 기본 생성자 필수 (public/protected)      │
│ ❌ final 클래스 사용 불가                   │
│ ❌ enum, interface, inner 클래스 불가       │
│ ❌ 저장할 필드에 final 사용 불가             │
└────────────────────────────────────────────┘
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

---

## 2. @Table

> 엔티티와 매핑할 테이블 지정

```java
@Entity
@Table(name = "MEMBER",
       schema = "public",
       uniqueConstraints = {
           @UniqueConstraint(
               name = "UK_MEMBER_EMAIL",
               columnNames = {"email"}
           )
       })
public class Member { ... }
```

### @Table 속성

| 속성 | 기능 | 기본값 |
|------|------|--------|
| `name` | 매핑할 테이블 이름 | 엔티티 이름 |
| `catalog` | 카탈로그 매핑 | - |
| `schema` | 스키마 매핑 | - |
| `uniqueConstraints` | DDL 생성 시 유니크 제약조건 | - |

---

## 3. 기본 키 매핑

```
┌───────────────────────────────────────────────────────────┐
│                   기본 키 생성 전략                         │
│                                                           │
│  ┌──────────┐                                            │
│  │   @Id    │                                            │
│  └────┬─────┘                                            │
│       │                                                   │
│       ├─── 직접 할당 ─→ 애플리케이션에서 직접 설정          │
│       │                                                   │
│       └─── @GeneratedValue ─┐                            │
│                             │                            │
│            ┌────────────────┼────────────────┐           │
│            ▼                ▼                ▼           │
│        IDENTITY         SEQUENCE          TABLE          │
│      (DB 위임)       (시퀀스 사용)      (키 테이블)        │
│     MySQL, PG        Oracle, PG         모든 DB          │
└───────────────────────────────────────────────────────────┘
```

### 3.1 직접 할당 전략

```java
@Entity
public class Member {
    @Id
    private String id;  // 직접 할당

    private String username;
}

// 사용
Member member = new Member();
member.setId("user001");  // 직접 설정 필수!
em.persist(member);
```

**적용 가능 타입**: 자바 기본형, Wrapper, String, Date, BigDecimal, BigInteger

---

### 3.2 IDENTITY 전략

> 기본 키 생성을 데이터베이스에 위임 (MySQL AUTO_INCREMENT)

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
┌─────────────────────────────────────────────────────────┐
│          IDENTITY 전략 동작 흐름                         │
│                                                         │
│  em.persist(member)                                     │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │ INSERT 즉시! │ ← 식별자를 얻기 위해 즉시 실행          │
│  └──────┬───────┘                                       │
│         │                                               │
│         ▼                                               │
│  DB에서 ID 생성 (AUTO_INCREMENT)                         │
│         │                                               │
│         ▼                                               │
│  영속성 컨텍스트 저장 (ID 할당 완료)                       │
└─────────────────────────────────────────────────────────┘
```

**특징**

| 항목 | 설명 |
|------|------|
| **장점** | 간단, DB 기능 활용 |
| **단점** | 쓰기 지연 불가, 배치 INSERT 불가 |
| **적합 DB** | MySQL, PostgreSQL, SQL Server |

> ⚠️ `em.persist()` 호출 즉시 INSERT SQL 실행 (쓰기 지연 동작 안 함)

---

### 3.3 SEQUENCE 전략

> 데이터베이스 시퀀스를 사용하여 기본 키 생성

```java
@Entity
@SequenceGenerator(
    name = "MEMBER_SEQ_GENERATOR",
    sequenceName = "MEMBER_SEQ",
    initialValue = 1,
    allocationSize = 50  // 성능 최적화!
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
┌─────────────────────────────────────────────────────────┐
│         SEQUENCE 전략 동작 흐름                          │
│                                                         │
│  em.persist(member)                                     │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │시퀀스 조회    │ ← DB에서 시퀀스 값 획득                 │
│  └──────┬───────┘                                       │
│         │                                               │
│         ▼                                               │
│  영속성 컨텍스트 저장 (ID 할당 완료)                       │
│         │                                               │
│         ▼                                               │
│  트랜잭션 커밋 시 INSERT 실행 (쓰기 지연 O)               │
└─────────────────────────────────────────────────────────┘
```

**@SequenceGenerator 속성**

| 속성 | 기능 | 기본값 |
|------|------|--------|
| `name` | 식별자 생성기 이름 | 필수 |
| `sequenceName` | DB 시퀀스 이름 | hibernate_sequence |
| `initialValue` | 시퀀스 시작 값 | 1 |
| `allocationSize` | 한 번에 할당할 크기 | **50** (성능 최적화) |

**성능 최적화: allocationSize**

```java
// allocationSize = 50 설정 시
// 1. 첫 persist(): DB 시퀀스에서 1~50 할당
// 2. 메모리에서 1~50 사용 (DB 조회 없음!)
// 3. 51번째 persist(): DB에서 51~100 할당
```

> 💡 **allocationSize는 기본값 50 권장** - DB 접근 횟수를 대폭 감소

---

### 3.4 TABLE 전략

> 키 생성 전용 테이블을 만들어 시퀀스 흉내

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

**생성되는 키 테이블**
```sql
CREATE TABLE MY_SEQUENCES (
    sequence_name VARCHAR(255) NOT NULL,
    next_val BIGINT,
    PRIMARY KEY (sequence_name)
);

-- 데이터
-- MEMBER_SEQ | 100
```

**특징**

| 항목 | 설명 |
|------|------|
| **장점** | 모든 DB 사용 가능 (호환성) |
| **단점** | 성능 저하 (테이블 조회/수정) |
| **적합 상황** | DB 변경 가능성 높을 때 |

> ⚠️ 성능 이슈로 실무에서는 비권장

---

### 3.5 AUTO 전략

> DB 방언에 따라 자동으로 전략 선택

```java
@Entity
public class Member {
    @Id
    @GeneratedValue  // strategy 생략 시 AUTO
    private Long id;
}
```

**전략 선택**
- MySQL → IDENTITY
- Oracle → SEQUENCE
- H2 → SEQUENCE

---

### 전략별 비교표

| 전략 | 쓰기 지연 | 성능 | 호환성 | 적합 DB | 실무 추천 |
|------|----------|------|--------|---------|----------|
| **IDENTITY** | ❌ | 보통 | 중 | MySQL, PostgreSQL | ⭐⭐⭐ |
| **SEQUENCE** | ✅ | 우수 | 중 | Oracle, PostgreSQL | ⭐⭐⭐⭐⭐ |
| **TABLE** | ✅ | 낮음 | 최고 | 모든 DB | ⭐ |
| **AUTO** | - | - | 높음 | - | ⭐⭐ (개발 초기) |

**실무 권장**
```java
// MySQL 사용 시
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

// Oracle 사용 시
@SequenceGenerator(allocationSize = 50)  // 성능 최적화!
@GeneratedValue(strategy = GenerationType.SEQUENCE)
private Long id;
```

---

## 4. 필드와 컬럼 매핑

### 4.1 @Column

> 객체 필드를 테이블 컬럼에 매핑

```java
@Entity
public class Member {
    @Id
    private Long id;

    @Column(
        name = "username",           // 컬럼명
        nullable = false,            // NOT NULL
        length = 50,                 // VARCHAR(50)
        unique = true,               // UNIQUE 제약
        columnDefinition = "VARCHAR(100) DEFAULT 'EMPTY'"  // DDL 직접 정의
    )
    private String username;

    @Column(precision = 10, scale = 2)  // DECIMAL(10,2)
    private BigDecimal salary;
}
```

**주요 속성**

| 속성 | 기능 | 기본값 |
|------|------|--------|
| `name` | 컬럼 이름 | 필드 이름 |
| `nullable` | NULL 허용 여부 (DDL) | true |
| `unique` | 유니크 제약조건 (DDL) | false |
| `length` | 문자 길이 (DDL) | 255 |
| `columnDefinition` | DDL 직접 정의 | - |
| `precision`, `scale` | BigDecimal 정밀도 | 19, 2 |

**@Column 생략 시 동작**

```java
int age;        // → age integer NOT NULL (기본형)
Integer age;    // → age integer (객체형, null 가능)
String name;    // → name varchar(255)
```

> 💡 기본형은 NOT NULL, 객체형은 NULL 허용

---

### 4.2 @Enumerated

> Java Enum 타입 매핑

```java
public enum RoleType {
    ADMIN, USER, GUEST
}

@Entity
public class Member {
    @Enumerated(EnumType.STRING)  // 반드시 STRING!
    private RoleType roleType;
}
```

**EnumType 비교**

| 타입 | 저장 값 | 장점 | 치명적 단점 | 권장 |
|------|---------|------|-----------|------|
| `ORDINAL` | 순서 (0, 1, 2) | DB 크기 작음 | **Enum 순서 변경 시 데이터 오염!** | ❌ 절대 금지 |
| `STRING` | 이름 ("ADMIN") | 안전, 명확 | DB 크기 다소 증가 | ✅ 필수 |

**ORDINAL 사용 금지 이유**

```java
// 초기 상태
enum RoleType { ADMIN, USER }  // ADMIN=0, USER=1

// DB 저장
member.setRoleType(ADMIN);  // → DB에 0 저장

// 나중에 Enum 수정
enum RoleType { GUEST, ADMIN, USER }  // GUEST=0, ADMIN=1, USER=2

// 기존 데이터 조회
// DB의 0은 이제 GUEST로 조회됨! (원래는 ADMIN) 💥
```

> ⚠️ **반드시 EnumType.STRING 사용!**

---

### 4.3 @Temporal (레거시)

> java.util.Date, Calendar 매핑 (Java 8 이전)

```java
@Temporal(TemporalType.DATE)
private Date birthDate;  // 날짜만: 2025-12-19

@Temporal(TemporalType.TIME)
private Date wakeUpTime;  // 시간만: 14:30:00

@Temporal(TemporalType.TIMESTAMP)
private Date createdDate;  // 날짜+시간: 2025-12-19 14:30:00
```

**Java 8+ 권장 방식 (최신)**

```java
@Entity
public class Member {
    private LocalDate birthDate;           // @Temporal 불필요!
    private LocalTime wakeUpTime;          // @Temporal 불필요!
    private LocalDateTime createdDateTime; // @Temporal 불필요!
    private ZonedDateTime registeredAt;    // 타임존 포함
}
```

**날짜 타입 권장사항**

| 타입 | @Temporal 필요 | 권장 | 용도 |
|------|---------------|------|------|
| `java.util.Date` | ✅ 필수 | ❌ | 레거시 코드만 |
| `LocalDate` | ❌ 불필요 | ✅ | 날짜 (2025-12-19) |
| `LocalTime` | ❌ 불필요 | ✅ | 시간 (14:30:00) |
| `LocalDateTime` | ❌ 불필요 | ✅ | 날짜+시간 |
| `ZonedDateTime` | ❌ 불필요 | ✅ | 타임존 포함 (국제화) |

---

### 4.4 @Lob

> 대용량 데이터 (BLOB, CLOB) 매핑

```java
@Entity
public class Article {
    @Id
    private Long id;

    @Lob
    private String content;  // CLOB (문자형)

    @Lob
    private byte[] thumbnail;  // BLOB (바이너리)
}
```

**매핑 규칙**
- 문자형 필드 (String, char[]) → **CLOB**
- 바이너리 필드 (byte[]) → **BLOB**

---

### 4.5 @Transient

> 매핑 제외 (메모리에서만 사용)

```java
@Entity
public class Member {
    @Id
    private Long id;

    private String username;

    @Transient
    private int temp;  // DB에 저장 안 됨, 메모리에서만 사용
}
```

---

## 5. 데이터베이스 스키마 자동 생성

JPA는 엔티티 매핑 정보를 바탕으로 DDL을 자동 생성할 수 있다.

### hibernate.hbm2ddl.auto 옵션

```xml
<!-- persistence.xml -->
<property name="hibernate.hbm2ddl.auto" value="create" />
```

| 옵션 | 동작 | 사용 환경 | 위험도 |
|------|------|-----------|--------|
| `create` | DROP + CREATE | 개발 초기 | ⚠️ 높음 |
| `create-drop` | CREATE + 종료 시 DROP | 테스트 | ⚠️ 높음 |
| `update` | 변경사항만 반영 (추가만 가능) | 개발 중 | ⚠️ 중간 |
| `validate` | 매핑 확인만 (변경 없음) | 테스트/운영 | ✅ 안전 |
| `none` | 사용 안 함 | 운영 | ✅ 안전 |

**환경별 권장 설정**

```
┌──────────────────────────────────────────────┐
│         환경별 권장 hbm2ddl.auto 설정         │
├──────────────┬───────────────────────────────┤
│ 개발 초기     │ create, update                │
│ 테스트 서버   │ create, create-drop, validate │
│ 스테이징      │ validate, none                │
│ 운영 서버     │ validate, none (필수!)        │
└──────────────┴───────────────────────────────┘
```

> ⚠️ **운영 서버에서 create, update 절대 금지!** - 데이터 유실 위험

### 네이밍 전략

```xml
<!-- 카멜케이스 → 언더스코어 자동 변환 -->
<property name="hibernate.ejb.naming_strategy"
          value="org.hibernate.cfg.ImprovedNamingStrategy"/>
```

```java
// Java
private LocalDateTime createdDate;

// DB 컬럼
created_date
```

---

## 6. 실전 예제

```java
package com.example.entity;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "MEMBER",
       uniqueConstraints = {
           @UniqueConstraint(
               name = "UK_MEMBER_EMAIL",
               columnNames = "email"
           )
       })
public class Member {

    // 기본 키 - IDENTITY 전략 (MySQL)
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long id;

    // 필수 문자열 필드
    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "email", nullable = false, length = 100)
    private String email;

    // NULL 가능 필드 (Integer 사용)
    @Column(name = "age")
    private Integer age;

    // Enum 타입 - 반드시 STRING
    @Enumerated(EnumType.STRING)
    @Column(name = "role_type", nullable = false, length = 20)
    private RoleType roleType;

    // 대용량 텍스트
    @Lob
    @Column(name = "description")
    private String description;

    // 날짜 타입 - Java 8+
    private LocalDateTime createdDate;
    private LocalDateTime lastModifiedDate;

    // 매핑 제외
    @Transient
    private String tempData;

    // 기본 생성자 (JPA 필수!)
    protected Member() {}

    // 생성자
    public Member(String username, String email, RoleType roleType) {
        this.username = username;
        this.email = email;
        this.roleType = roleType;
        this.createdDate = LocalDateTime.now();
        this.lastModifiedDate = LocalDateTime.now();
    }

    // Getter, Setter
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) {
        this.username = username;
        this.lastModifiedDate = LocalDateTime.now();
    }
    // ... 나머지 getter/setter
}

enum RoleType {
    ADMIN, USER, GUEST
}
```

**생성되는 DDL**

```sql
CREATE TABLE MEMBER (
    member_id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    age INTEGER,
    role_type VARCHAR(20) NOT NULL,
    description CLOB,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    PRIMARY KEY (member_id),
    CONSTRAINT UK_MEMBER_EMAIL UNIQUE (email)
);
```

---

## 요약

### 핵심 어노테이션

| 어노테이션 | 용도 | 필수 여부 |
|-----------|------|----------|
| `@Entity` | 엔티티 클래스 지정 | ✅ 필수 |
| `@Table` | 테이블 이름 지정 | 선택 |
| `@Id` | 기본 키 지정 | ✅ 필수 |
| `@GeneratedValue` | 기본 키 자동 생성 | 권장 |
| `@Column` | 컬럼 상세 설정 | 권장 |
| `@Enumerated` | Enum 매핑 | Enum 사용 시 필수 |
| `@Lob` | 대용량 데이터 | 필요 시 |
| `@Transient` | 매핑 제외 | 필요 시 |

### 실무 체크리스트

```
✅ @Entity 클래스에 기본 생성자 추가 (protected)
✅ 기본 키 전략 선택 (MySQL=IDENTITY, Oracle=SEQUENCE)
✅ @Enumerated는 반드시 STRING 사용
✅ 날짜는 LocalDate/LocalDateTime 사용 (@Temporal 불필요)
✅ NOT NULL 컬럼은 nullable=false 명시
✅ 운영 환경에서는 hbm2ddl.auto=validate 또는 none
✅ Long 타입 + 대리키 + 자동 생성 전략 조합 권장
```

### 기본 키 전략 선택 가이드

```java
// MySQL 환경
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

// Oracle 환경 (성능 최적화)
@SequenceGenerator(
    name = "SEQ_GEN",
    sequenceName = "MEMBER_SEQ",
    allocationSize = 50
)
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "SEQ_GEN")
private Long id;

// 개발 초기 (DB 미정)
@GeneratedValue(strategy = GenerationType.AUTO)
private Long id;
```

### 주의사항

⚠️ **절대 금지**
- `@Enumerated(EnumType.ORDINAL)` 사용
- 운영 환경에서 `hbm2ddl.auto=create/update` 사용
- @Entity 클래스에서 기본 생성자 누락
- 저장할 필드에 final 사용

💡 **권장사항**
- 기본 키는 Long + 대리키 + 자동생성 전략
- SEQUENCE 전략 시 allocationSize=50 설정
- LocalDate/LocalDateTime 사용 (java.util.Date 지양)
- 제약조건은 가급적 DB 레벨에서도 설정
