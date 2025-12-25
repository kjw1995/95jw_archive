---
title: "Chapter 09. 값 타입"
weight: 11
---

# 값 타입 (Value Type)

JPA의 데이터 타입은 크게 **엔티티 타입**과 **값 타입**으로 나눌 수 있다.

## 엔티티 타입 vs 값 타입

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JPA 데이터 타입                               │
├─────────────────────────────┬───────────────────────────────────────┤
│       엔티티 타입            │              값 타입                   │
│   (Entity Type)             │          (Value Type)                 │
├─────────────────────────────┼───────────────────────────────────────┤
│ • @Entity로 정의            │ • 기본값 타입 (int, String 등)         │
│ • 식별자(@Id)로 추적 가능    │ • 임베디드 타입 (복합 값)              │
│ • 독립적인 생명주기          │ • 컬렉션 값 타입                       │
│ • 변경 이력 추적 가능        │ • 식별자 없음                          │
│                             │ • 엔티티에 의존하는 생명주기            │
└─────────────────────────────┴───────────────────────────────────────┘
```

| 구분 | 엔티티 타입 | 값 타입 |
|------|------------|---------|
| 정의 | `@Entity` | 자바 기본 타입, 객체 |
| 식별자 | 있음 (`@Id`) | 없음 |
| 생명주기 | 독립적 | 엔티티에 의존 |
| 추적 | 가능 | 불가능 |
| 비유 | 살아있는 생물 | 단순한 수치 정보 |

---

## 9.1 기본값 타입 (Basic Value Type)

자바가 제공하는 기본 데이터 타입들이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                       기본값 타입                                │
├─────────────────┬───────────────────┬───────────────────────────┤
│  자바 기본 타입  │    래퍼 클래스     │        문자열            │
├─────────────────┼───────────────────┼───────────────────────────┤
│  int, long      │  Integer, Long    │        String            │
│  double, float  │  Double, Float    │                          │
│  boolean        │  Boolean          │                          │
└─────────────────┴───────────────────┴───────────────────────────┘
```

### 예제

```java
@Entity
public class Member {

    @Id @GeneratedValue
    private Long id;           // 식별자 (엔티티 타입의 속성)

    private String name;       // 값 타입
    private int age;           // 값 타입
}
```

### 기본값 타입의 특징

```
┌─────────────────────────────────────────────────────────────────┐
│                    Member 엔티티 구조                            │
├─────────────────────────────────────────────────────────────────┤
│  id (식별자)                                                     │
│  ├── 엔티티 추적에 사용                                          │
│  └── 독립적 의미                                                 │
│                                                                 │
│  name, age (값 타입)                                             │
│  ├── 식별자 없음                                                 │
│  ├── Member 엔티티에 생명주기 의존                                │
│  └── Member 삭제 시 함께 삭제                                    │
└─────────────────────────────────────────────────────────────────┘
```

> **참고**: 자바 기본 타입(primitive type)은 절대 공유되지 않는다.
> `a = b` 코드는 b의 값을 복사해서 a에 입력한다.

```java
int a = 10;
int b = a;    // 값 복사 (공유 X)

b = 20;       // a는 여전히 10
```

---

## 9.2 임베디드 타입 (Embedded Type)

사용자가 직접 정의한 새로운 값 타입. **복합 값 타입**이라고도 한다.

### 임베디드 타입 적용 전/후 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                    적용 전 (플랫 구조)                           │
├─────────────────────────────────────────────────────────────────┤
│  Member                                                         │
│  ├── id                                                         │
│  ├── name                                                       │
│  ├── startDate    ─┐                                            │
│  ├── endDate      ─┘ 근무 기간 (논리적 그룹)                     │
│  ├── city         ─┐                                            │
│  ├── street       ─┤ 집 주소 (논리적 그룹)                       │
│  └── zipcode      ─┘                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    적용 후 (임베디드 타입)                        │
├─────────────────────────────────────────────────────────────────┤
│  Member                                                         │
│  ├── id                                                         │
│  ├── name                                                       │
│  ├── workPeriod ──────► Period (startDate, endDate)             │
│  └── homeAddress ─────► Address (city, street, zipcode)         │
└─────────────────────────────────────────────────────────────────┘
```

### 코드 예제

```java
// 적용 전 - 플랫 구조
@Entity
public class Member {

    @Id @GeneratedValue
    private Long id;
    private String name;

    // 근무 기간
    @Temporal(TemporalType.DATE)
    private java.util.Date startDate;
    @Temporal(TemporalType.DATE)
    private java.util.Date endDate;

    // 집 주소
    private String city;
    private String street;
    private String zipcode;
}
```

```java
// 적용 후 - 임베디드 타입 사용
@Entity
public class Member {

    @Id @GeneratedValue
    private Long id;
    private String name;

    @Embedded
    private Period workPeriod;      // 근무 기간

    @Embedded
    private Address homeAddress;    // 집 주소
}
```

```java
// 기간 임베디드 타입
@Embeddable
public class Period {

    @Temporal(TemporalType.DATE)
    private java.util.Date startDate;

    @Temporal(TemporalType.DATE)
    private java.util.Date endDate;

    // 값 타입을 위한 메소드 정의 가능
    public boolean isWork(Date date) {
        // 현재 근무 중인지 확인하는 로직
        return startDate.before(date) && endDate.after(date);
    }
}
```

```java
// 주소 임베디드 타입
@Embeddable
public class Address {

    @Column(name = "city")  // 매핑할 컬럼 정의 가능
    private String city;
    private String street;
    private String zipcode;

    // 기본 생성자 필수
    public Address() {}

    public Address(String city, String street, String zipcode) {
        this.city = city;
        this.street = street;
        this.zipcode = zipcode;
    }
}
```

### 필수 어노테이션

| 어노테이션 | 위치 | 설명 |
|-----------|------|------|
| `@Embeddable` | 값 타입 정의 클래스 | 이 클래스가 임베디드 타입임을 표시 |
| `@Embedded` | 값 타입 사용하는 필드 | 임베디드 타입을 사용함을 표시 |

> **참고**: 둘 중 하나는 생략 가능하지만, 명확성을 위해 둘 다 표시하는 것을 권장한다.

### 임베디드 타입의 장점

```
┌─────────────────────────────────────────────────────────────────┐
│                   임베디드 타입의 장점                           │
├─────────────────────────────────────────────────────────────────┤
│  1. 재사용성                                                     │
│     └── Address를 다른 엔티티에서도 사용 가능                    │
│                                                                 │
│  2. 높은 응집도                                                  │
│     └── 관련 있는 속성들을 논리적으로 그룹화                     │
│                                                                 │
│  3. 의미있는 메소드                                              │
│     └── Period.isWork() 처럼 해당 값 타입만을 위한 메소드 정의   │
│                                                                 │
│  4. 객체지향적 설계                                              │
│     └── 도메인 모델을 더 명확하게 표현                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9.2.1 임베디드 타입과 테이블 매핑

임베디드 타입은 엔티티의 값일 뿐이다. 테이블에는 **동일하게 매핑**된다.

```
┌─────────────────────────────────────────────────────────────────┐
│  객체 모델                           │    테이블 구조            │
├─────────────────────────────────────────────────────────────────┤
│                                      │                          │
│  ┌─────────────┐                     │   MEMBER                 │
│  │   Member    │                     │  ┌─────────────┐         │
│  ├─────────────┤                     │  │ ID          │         │
│  │ id          │──────────────────►  │  │ NAME        │         │
│  │ name        │                     │  │ START_DATE  │         │
│  │ workPeriod ─┼──► Period           │  │ END_DATE    │         │
│  │ homeAddress ┼──► Address          │  │ CITY        │         │
│  └─────────────┘                     │  │ STREET      │         │
│                                      │  │ ZIPCODE     │         │
│                                      │  └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
        객체는 임베디드로 분리            테이블은 그대로
```

---

## 9.2.2 임베디드 타입과 연관관계

임베디드 타입은 다음을 포함할 수 있다:
- **다른 값 타입** (임베디드 타입 중첩)
- **엔티티 참조** (`@ManyToOne` 등)

```
┌─────────────────────────────────────────────────────────────────┐
│                   임베디드 타입의 연관관계                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Member                                                         │
│  ├── address ─────────► Address (임베디드 타입)                  │
│  │                       ├── street                             │
│  │                       ├── city                               │
│  │                       ├── state                              │
│  │                       └── zipcode ──► Zipcode (임베디드 중첩) │
│  │                                        ├── zip               │
│  │                                        └── plusFour          │
│  │                                                              │
│  └── phoneNumber ─────► PhoneNumber (임베디드 타입)              │
│                          ├── areaCode                           │
│                          ├── localNumber                        │
│                          └── provider ──► PhoneServiceProvider  │
│                                           (엔티티 참조!)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 코드 예제

```java
@Entity
public class Member {

    @Embedded
    private Address address;           // 임베디드 타입 포함

    @Embedded
    private PhoneNumber phoneNumber;   // 임베디드 타입 포함
}

@Embeddable
public class Address {
    private String street;
    private String city;
    private String state;

    @Embedded
    private Zipcode zipcode;           // 임베디드 타입 중첩
}

@Embeddable
public class Zipcode {
    private String zip;
    private String plusFour;
}

@Embeddable
public class PhoneNumber {
    private String areaCode;
    private String localNumber;

    @ManyToOne
    private PhoneServiceProvider provider;  // 엔티티 참조
}

@Entity
public class PhoneServiceProvider {
    @Id
    private String name;
}
```

---

## 9.2.3 @AttributeOverride: 속성 재정의

같은 임베디드 타입을 한 엔티티에서 여러 번 사용할 때, 컬럼명 충돌을 해결한다.

### 문제 상황

```java
@Entity
public class Member {

    @Id @GeneratedValue
    private Long id;
    private String name;

    @Embedded
    private Address homeAddress;      // city, street, zipcode

    @Embedded
    private Address companyAddress;   // city, street, zipcode  ← 컬럼명 충돌!
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│                        컬럼명 충돌!                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   MEMBER 테이블                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │ ID                                   │                       │
│  │ NAME                                 │                       │
│  │ CITY      ←── homeAddress.city      │                       │
│  │ CITY      ←── companyAddress.city   │  ← 중복!              │
│  │ STREET    ←── homeAddress.street    │                       │
│  │ STREET    ←── companyAddress.street │  ← 중복!              │
│  │ ZIPCODE   ←── ...                   │  ← 중복!              │
│  └──────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 해결: @AttributeOverrides

```java
@Entity
public class Member {

    @Id @GeneratedValue
    private Long id;
    private String name;

    @Embedded
    private Address homeAddress;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(
            name = "city",
            column = @Column(name = "COMPANY_CITY")
        ),
        @AttributeOverride(
            name = "street",
            column = @Column(name = "COMPANY_STREET")
        ),
        @AttributeOverride(
            name = "zipcode",
            column = @Column(name = "COMPANY_ZIPCODE")
        )
    })
    private Address companyAddress;
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│                   @AttributeOverride 적용 후                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   MEMBER 테이블                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │ ID                                   │                       │
│  │ NAME                                 │                       │
│  │ CITY           ←── homeAddress      │                       │
│  │ STREET         ←── homeAddress      │                       │
│  │ ZIPCODE        ←── homeAddress      │                       │
│  │ COMPANY_CITY   ←── companyAddress   │  ← 재정의됨           │
│  │ COMPANY_STREET ←── companyAddress   │  ← 재정의됨           │
│  │ COMPANY_ZIPCODE←── companyAddress   │  ← 재정의됨           │
│  └──────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **주의**: `@AttributeOverrides`는 반드시 **엔티티에** 설정해야 한다.
> 임베디드 타입이 다른 임베디드 타입을 포함해도, 최종 엔티티에서 설정한다.

---

## 9.2.4 임베디드 타입과 null

임베디드 타입이 `null`이면 매핑한 컬럼 값은 **모두 null**이 된다.

```java
member.setHomeAddress(null);
em.persist(member);
```

```
┌─────────────────────────────────────────────────────────────────┐
│                      결과 테이블                                 │
├─────────────────────────────────────────────────────────────────┤
│  MEMBER                                                         │
│  ┌─────────────────────────────┐                                │
│  │ ID      │ 1                 │                                │
│  │ NAME    │ 홍길동            │                                │
│  │ CITY    │ NULL              │  ← homeAddress가               │
│  │ STREET  │ NULL              │     null이므로                 │
│  │ ZIPCODE │ NULL              │     모든 컬럼이 NULL           │
│  └─────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9.3 값 타입과 불변 객체

값 타입은 단순하고 **안전하게** 다룰 수 있어야 한다.

### 9.3.1 값 타입 공유 참조 문제

임베디드 타입 같은 값 타입을 여러 엔티티에서 **공유하면 위험**하다.

```java
member1.setHomeAddress(new Address("OldCity"));
Address address = member1.getHomeAddress();

address.setCity("NewCity");  // 회원1의 address를 공유해서 사용
member2.setHomeAddress(address);
```

```
┌─────────────────────────────────────────────────────────────────┐
│                     공유 참조 문제                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    member1                        member2                       │
│  ┌─────────────┐                ┌─────────────┐                │
│  │ homeAddress │────┐     ┌─────│ homeAddress │                │
│  └─────────────┘    │     │     └─────────────┘                │
│                     ▼     ▼                                     │
│                  ┌──────────────┐                               │
│                  │   Address    │                               │
│                  │ city="NewCity│  ← 변경!                      │
│                  └──────────────┘                               │
│                                                                 │
│  기대: member2의 city만 "NewCity"로 변경                        │
│  실제: member1, member2 모두 "NewCity"로 변경됨                 │
│                                                                 │
│  → 영속성 컨텍스트가 둘 다 변경되었다고 판단                     │
│  → UPDATE SQL 2개 실행!                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

이런 현상을 **부작용(Side Effect)**이라 한다.

---

### 9.3.2 값 타입 복사

공유 참조 문제를 피하려면 값을 **복사**해서 사용해야 한다.

```java
member1.setHomeAddress(new Address("OldCity"));
Address address = member1.getHomeAddress();

// 새로운 인스턴스를 생성하여 복사
Address newAddress = new Address(address.getCity());
newAddress.setCity("NewCity");

member2.setHomeAddress(newAddress);
```

```
┌─────────────────────────────────────────────────────────────────┐
│                     값 복사 (안전)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    member1                        member2                       │
│  ┌─────────────┐                ┌─────────────┐                │
│  │ homeAddress │────┐           │ homeAddress │────┐           │
│  └─────────────┘    │           └─────────────┘    │           │
│                     ▼                              ▼           │
│              ┌──────────────┐              ┌──────────────┐    │
│              │   Address    │              │   Address    │    │
│              │ city="OldCity│              │ city="NewCity│    │
│              └──────────────┘              └──────────────┘    │
│                    ↑                              ↑            │
│              별도 인스턴스                   별도 인스턴스       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 불변 객체 (Immutable Object)

근본적인 해결책: 값 타입을 **불변 객체**로 설계한다.

```java
@Embeddable
public class Address {

    private String city;
    private String street;
    private String zipcode;

    // 기본 생성자 (JPA 스펙)
    protected Address() {}

    // 생성자로만 값 설정
    public Address(String city, String street, String zipcode) {
        this.city = city;
        this.street = street;
        this.zipcode = zipcode;
    }

    // Getter만 제공, Setter 없음
    public String getCity() { return city; }
    public String getStreet() { return street; }
    public String getZipcode() { return zipcode; }

    // 수정이 필요하면 새 인스턴스 생성
    public Address withCity(String newCity) {
        return new Address(newCity, this.street, this.zipcode);
    }
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│                   불변 객체 사용 패턴                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  // 잘못된 방법 (Setter 사용)                                   │
│  address.setCity("NewCity");  // 컴파일 에러! Setter 없음       │
│                                                                 │
│  // 올바른 방법 (새 인스턴스 생성)                               │
│  Address newAddress = new Address("NewCity", "street", "zip");  │
│  member.setHomeAddress(newAddress);                             │
│                                                                 │
│  // 또는 복사 메소드 사용                                        │
│  Address newAddress = address.withCity("NewCity");              │
│  member.setHomeAddress(newAddress);                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 값 타입 비교

값 타입의 동등성 비교를 위해 `equals()`와 `hashCode()`를 재정의해야 한다.

```java
@Embeddable
public class Address {

    private String city;
    private String street;
    private String zipcode;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        Address address = (Address) o;
        return Objects.equals(city, address.city) &&
               Objects.equals(street, address.street) &&
               Objects.equals(zipcode, address.zipcode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(city, street, zipcode);
    }
}
```

---

## 정리

```
┌─────────────────────────────────────────────────────────────────┐
│                     값 타입 핵심 정리                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 값 타입 분류                                                │
│     ├── 기본값 타입: int, String 등                             │
│     ├── 임베디드 타입: @Embeddable, @Embedded                   │
│     └── 컬렉션 값 타입: @ElementCollection                      │
│                                                                 │
│  2. 임베디드 타입                                                │
│     ├── 재사용성 향상                                           │
│     ├── 높은 응집도                                             │
│     ├── 테이블 매핑은 동일                                       │
│     └── 기본 생성자 필수                                        │
│                                                                 │
│  3. 속성 재정의                                                  │
│     └── @AttributeOverrides로 컬럼명 충돌 해결                   │
│                                                                 │
│  4. 값 타입 공유 주의                                            │
│     ├── 공유 참조 시 부작용(Side Effect) 발생                   │
│     ├── 불변 객체로 설계 권장                                   │
│     └── Setter 제거, 생성자로만 값 설정                          │
│                                                                 │
│  5. 동등성 비교                                                  │
│     └── equals(), hashCode() 재정의                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Hibernate 용어**: 임베디드 타입을 **컴포넌트(Components)**라고 부른다.
