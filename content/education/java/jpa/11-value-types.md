---
title: "Chapter 11. 값 타입"
weight: 11
---

JPA 의 데이터 타입은 크게 **엔티티 타입**과 **값 타입**으로 나뉜다. 엔티티 타입은 식별자로 추적 가능한 "살아있는" 객체이고, 값 타입은 이름 그대로 "값" 이기 때문에 식별자 없이 엔티티에 종속돼 존재한다.

## 엔티티 타입 vs 값 타입

```
         JPA 데이터 타입

  ┌──────────────┐ ┌──────────────┐
  │ 엔티티 타입    │ │   값 타입      │
  │ Entity Type  │ │ Value Type   │
  │──────────────│ │──────────────│
  │ @Entity 로 정의│ │ 기본값 타입    │
  │ @Id 로 추적    │ │ (int, String)│
  │ 독립 생명주기  │ │ 임베디드 타입  │
  │ 변경 이력 추적  │ │ 컬렉션 값 타입 │
  │               │ │ 식별자 없음    │
  │               │ │ 엔티티에 의존  │
  └──────────────┘ └──────────────┘
```

| 구분 | 엔티티 타입 | 값 타입 |
|:-----|:-----------|:--------|
| 정의 | `@Entity` | 자바 기본 타입·객체 |
| 식별자 | 있음 (`@Id`) | 없음 |
| 생명주기 | 독립적 | 엔티티에 의존 |
| 추적 | 가능 | 불가능 |
| 비유 | 살아있는 개체 | 단순한 수치 정보 |

---

## 1. 기본값 타입 (Basic Value Type)

자바가 제공하는 기본 데이터 타입.

```
 ┌──────────┬──────────┬──────────┐
 │ 기본 타입  │ 래퍼 클래스│ 문자열    │
 │──────────│──────────│──────────│
 │ int,long │ Integer, │ String   │
 │ double,  │ Long,    │          │
 │ float    │ Double,  │          │
 │ boolean  │ Boolean  │          │
 └──────────┴──────────┴──────────┘
```

### 예제

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;         // 식별자 (엔티티 타입 속성)

    private String name;     // 값 타입
    private int age;         // 값 타입
}
```

### 특징

```
 Member 엔티티
  id (식별자)
   ├── 엔티티 추적에 사용
   └── 독립적 의미

  name, age (값 타입)
   ├── 식별자 없음
   ├── Member 에 생명주기 의존
   └── Member 삭제 시 함께 삭제
```

{{< callout type="info" >}}
자바 기본 타입(primitive)은 절대 공유되지 않는다. `a = b` 는 b 의 값을 **복사**해서 a 에 입력한다.
{{< /callout >}}

```java
int a = 10;
int b = a;     // 값 복사 (공유 X)

b = 20;        // a 는 여전히 10
```

---

## 2. 임베디드 타입 (Embedded Type)

사용자가 직접 정의한 새로운 값 타입. **복합 값 타입**이라고도 한다. 논리적으로 묶이는 속성 집합을 하나의 객체로 추출해 **응집도를 높이는** 기법이다.

### 임베디드 타입 적용 전/후 비교

```
 [적용 전 - 플랫 구조]
  Member
   ├── id
   ├── name
   ├── startDate ─┐
   ├── endDate   ─┘ 근무 기간
   ├── city      ─┐
   ├── street    ─┤ 집 주소
   └── zipcode   ─┘

              │
              ▼
 [적용 후 - 임베디드]
  Member
   ├── id
   ├── name
   ├── workPeriod  → Period
   └── homeAddress → Address
```

### 코드 예제

```java
// 적용 전 - 플랫
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;
    private String name;

    @Temporal(TemporalType.DATE)
    private java.util.Date startDate;
    @Temporal(TemporalType.DATE)
    private java.util.Date endDate;

    private String city;
    private String street;
    private String zipcode;
}
```

```java
// 적용 후 - 임베디드
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;
    private String name;

    @Embedded
    private Period workPeriod;

    @Embedded
    private Address homeAddress;
}

@Embeddable
public class Period {
    @Temporal(TemporalType.DATE)
    private java.util.Date startDate;
    @Temporal(TemporalType.DATE)
    private java.util.Date endDate;

    // 값 타입 전용 메서드
    public boolean isWork(Date date) {
        return startDate.before(date)
            && endDate.after(date);
    }
}

@Embeddable
public class Address {

    @Column(name = "city")
    private String city;
    private String street;
    private String zipcode;

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
|:-----------|:-----|:-----|
| `@Embeddable` | 값 타입 클래스 | 임베디드 타입 정의 |
| `@Embedded` | 값 타입 필드 | 임베디드 타입 사용 |

{{< callout type="info" >}}
둘 중 하나는 생략할 수 있지만 **명확성을 위해 둘 다 붙이는 것을 권장**한다. 자동 완성·리팩토링 도구에서도 의도가 분명해진다.
{{< /callout >}}

### 임베디드 타입의 장점

- **재사용성** — `Address` 를 여러 엔티티에서 재사용
- **높은 응집도** — 관련 속성을 논리적으로 그룹화
- **의미 있는 메서드** — `Period.isWork()` 같은 값 타입 전용 로직
- **객체지향적 설계** — 도메인 모델을 풍부하게 표현

---

## 3. 임베디드 타입과 테이블 매핑

임베디드 타입은 엔티티의 값일 뿐이다. **테이블에는 동일하게 매핑**된다 (컬럼이 플랫하게 풀린다).

```
 [객체 모델]          [테이블 구조]

 ┌──────────────┐   MEMBER
 │   Member     │   ┌────────────┐
 │──────────────│   │ ID         │
 │ id           │──►│ NAME       │
 │ name         │   │ START_DATE │
 │ workPeriod ──┼──►│ END_DATE   │
 │ homeAddress ─┼──►│ CITY       │
 └──────────────┘   │ STREET     │
                    │ ZIPCODE    │
                    └────────────┘
   객체는 임베디드    테이블은 그대로
   로 분리
```

---

## 4. 임베디드 타입과 연관관계

임베디드 타입은 **다른 값 타입**과 **엔티티 참조**를 모두 포함할 수 있다.

```
 Member
  ├── address ──► Address  (임베디드)
  │                 ├── street
  │                 ├── city
  │                 └── zipcode ──► Zipcode
  │                                  (중첩 임베디드)
  │
  └── phoneNumber ─► PhoneNumber  (임베디드)
                       ├── areaCode
                       ├── localNumber
                       └── provider ──► Provider
                                        (엔티티 참조!)
```

### 코드 예제

```java
@Entity
public class Member {
    @Embedded
    private Address address;

    @Embedded
    private PhoneNumber phoneNumber;
}

@Embeddable
public class Address {
    private String street;
    private String city;
    private String state;

    @Embedded
    private Zipcode zipcode;   // 임베디드 중첩
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
    private PhoneServiceProvider provider;   // 엔티티 참조
}

@Entity
public class PhoneServiceProvider {
    @Id private String name;
}
```

---

## 5. @AttributeOverride: 속성 재정의

같은 임베디드 타입을 한 엔티티에서 **여러 번 사용**할 때, 컬럼명 충돌을 해결한다.

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
    private Address companyAddress;   // city, street, zipcode ← 충돌!
}
```

```
  MEMBER 테이블 (충돌!)
  ┌────────────────────────┐
  │ ID                     │
  │ NAME                   │
  │ CITY   ← homeAddress   │
  │ CITY   ← companyAddress│ ← 중복!
  │ STREET ← homeAddress   │
  │ STREET ← companyAddress│ ← 중복!
  │ ZIPCODE ← ...          │ ← 중복!
  └────────────────────────┘
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
            column = @Column(name = "COMPANY_CITY")),
        @AttributeOverride(
            name = "street",
            column = @Column(name = "COMPANY_STREET")),
        @AttributeOverride(
            name = "zipcode",
            column = @Column(name = "COMPANY_ZIPCODE"))
    })
    private Address companyAddress;
}
```

```
  MEMBER 테이블 (해결)
  ┌─────────────────────────────┐
  │ ID                          │
  │ NAME                        │
  │ CITY            ← home      │
  │ STREET          ← home      │
  │ ZIPCODE         ← home      │
  │ COMPANY_CITY    ← company   │
  │ COMPANY_STREET  ← company   │
  │ COMPANY_ZIPCODE ← company   │
  └─────────────────────────────┘
```

{{< callout type="warning" >}}
`@AttributeOverrides` 는 반드시 **엔티티에** 설정해야 한다. 임베디드 타입이 다른 임베디드 타입을 중첩 포함해도, 최종 엔티티에서 오버라이드한다.
{{< /callout >}}

---

## 6. 임베디드 타입과 null

임베디드 타입이 `null` 이면 **매핑된 컬럼이 모두 null**이 된다.

```java
member.setHomeAddress(null);
em.persist(member);
```

```
  MEMBER
  ┌──────────────────┐
  │ ID      │ 1      │
  │ NAME    │ 홍길동  │
  │ CITY    │ NULL   │ homeAddress 가
  │ STREET  │ NULL   │ null 이므로
  │ ZIPCODE │ NULL   │ 모두 NULL
  └──────────────────┘
```

---

## 7. 값 타입과 불변 객체

값 타입은 단순하고 **안전**하게 다룰 수 있어야 한다.

### 7.1 값 타입 공유 참조 문제

임베디드 타입 같은 값 타입을 여러 엔티티가 **공유하면 위험**하다.

```java
member1.setHomeAddress(new Address("OldCity"));
Address address = member1.getHomeAddress();

address.setCity("NewCity");       // 참조 공유
member2.setHomeAddress(address);
```

```
  member1             member2
  ┌─────────┐         ┌─────────┐
  │homeAddr │──┐   ┌──│homeAddr │
  └─────────┘  │   │  └─────────┘
               ▼   ▼
        ┌─────────────┐
        │   Address   │
        │city="NewCit"│ ← 변경!
        └─────────────┘

  기대: member2 만 NewCity
  실제: member1, member2 둘 다 NewCity
  → 영속성 컨텍스트가 두 엔티티 모두
    변경된 것으로 인식 → UPDATE 2개!
```

이런 현상을 **부작용(Side Effect)** 이라 한다.

---

### 7.2 값 타입 복사

공유 참조 문제를 피하려면 값을 **복사**해서 사용해야 한다.

```java
member1.setHomeAddress(new Address("OldCity"));
Address address = member1.getHomeAddress();

// 새 인스턴스 생성하여 복사
Address newAddress = new Address(address.getCity());
newAddress.setCity("NewCity");

member2.setHomeAddress(newAddress);
```

```
  member1             member2
  ┌─────────┐         ┌─────────┐
  │homeAddr │──┐      │homeAddr │──┐
  └─────────┘  │      └─────────┘  │
               ▼                   ▼
         ┌──────────┐         ┌──────────┐
         │ Address  │         │ Address  │
         │"OldCity" │         │"NewCity" │
         └──────────┘         └──────────┘
          별도 인스턴스         별도 인스턴스
```

### 7.3 불변 객체 (Immutable Object)

근본적 해결책은 값 타입을 **불변 객체**로 설계하는 것. Setter 를 없애고 **생성자로만 상태를 지정**하면, 공유해도 변경이 불가능하므로 안전하다.

```java
@Embeddable
public class Address {

    private String city;
    private String street;
    private String zipcode;

    // 기본 생성자 (JPA 스펙)
    protected Address() {}

    public Address(String city, String street, String zipcode) {
        this.city = city;
        this.street = street;
        this.zipcode = zipcode;
    }

    // Getter 만 제공, Setter 없음
    public String getCity()    { return city; }
    public String getStreet()  { return street; }
    public String getZipcode() { return zipcode; }

    // 수정이 필요하면 새 인스턴스 생성
    public Address withCity(String newCity) {
        return new Address(newCity, street, zipcode);
    }
}
```

```java
// 잘못된 방법
address.setCity("NewCity");   // 컴파일 에러! Setter 없음

// 올바른 방법 ①
Address newAddress =
    new Address("NewCity", "street", "zip");
member.setHomeAddress(newAddress);

// 올바른 방법 ②
Address newAddress = address.withCity("NewCity");
member.setHomeAddress(newAddress);
```

---

## 8. 값 타입 비교

값 타입은 **값이 같으면 같다** 로 봐야 한다. `equals()` / `hashCode()` 재정의가 필수다.

```java
@Embeddable
public class Address {
    private String city;
    private String street;
    private String zipcode;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass())
            return false;
        Address a = (Address) o;
        return Objects.equals(city, a.city)
            && Objects.equals(street, a.street)
            && Objects.equals(zipcode, a.zipcode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(city, street, zipcode);
    }
}
```

{{< callout type="info" >}}
값 타입 비교 규칙:
- **동일성(identity)**: `==` — 인스턴스 같음
- **동등성(equality)**: `equals()` — 값 같음
값 타입은 항상 **동등성** 이 관심사다.
{{< /callout >}}

---

## 9. 값 타입 컬렉션

값 타입을 하나가 아니라 **여러 개** 저장할 때 사용한다. 값 타입은 식별자가 없어 한 컬럼에 담을 수 없으므로, `@ElementCollection` 과 `@CollectionTable` 로 **별도 테이블**에 매핑한다.

```
 MEMBER            FAVORITE_FOOD
 ┌────────────┐    ┌──────────────┐
 │ MEMBER_ID  │◄───│ MEMBER_ID FK │
 │ HOME_CITY  │    │ FOOD_NAME    │
 │ ...        │    └──────────────┘
 └────────────┘    PK = 전체 컬럼

                   ADDRESS
                   ┌──────────────┐
                   │ MEMBER_ID FK │
                   │ CITY         │
                   │ STREET       │
                   │ ZIPCODE      │
                   └──────────────┘
```

### 9.1 값 타입 컬렉션 매핑

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;

    @Embedded
    private Address homeAddress;

    // 기본값 타입 컬렉션
    @ElementCollection
    @CollectionTable(
        name = "FAVORITE_FOOD",
        joinColumns = @JoinColumn(name = "MEMBER_ID")
    )
    @Column(name = "FOOD_NAME")   // 값이 하나면 컬럼명 지정 가능
    private Set<String> favoriteFoods = new HashSet<>();

    // 임베디드 값 타입 컬렉션
    @ElementCollection
    @CollectionTable(
        name = "ADDRESS",
        joinColumns = @JoinColumn(name = "MEMBER_ID")
    )
    private List<Address> addressHistory = new ArrayList<>();
}
```

- `@ElementCollection` — 값 타입 컬렉션임을 선언
- `@CollectionTable` — 저장할 테이블·조인 컬럼 지정 (생략 시 `엔티티_필드명`)
- 값이 하나(기본값 타입)면 `@Column` 으로 컬럼명 지정 가능

### 9.2 저장과 조회

```java
Member member = new Member();
member.getFavoriteFoods().add("치킨");
member.getFavoriteFoods().add("피자");
member.getAddressHistory().add(
    new Address("서울", "종로", "11111"));

em.persist(member);   // member 저장 시 컬렉션도 함께 INSERT
```

값 타입 컬렉션은 소속 엔티티에 **생명주기를 의존**한다. 별도로 `persist` 하지 않아도 부모와 함께 저장·삭제되며, **지연 로딩**이 기본이다 (영속성 전이 + 고아 객체를 항상 켠 것과 유사).

### 9.3 값 타입 컬렉션의 제약

값 타입은 `@Id` 가 없어 **어떤 행이 바뀌었는지 추적할 수 없다**. 그래서 값을 하나만 수정해도 하이버네이트는 안전하게 처리하기 위해:

```
 member.getAddressHistory()
        .remove(oldAddress);       // 하나만 제거해도

 SQL:
   DELETE FROM ADDRESS
   WHERE  MEMBER_ID = ?           // 연관 데이터 전부 삭제
   INSERT INTO ADDRESS ...        // 남은 것 다시 INSERT
   INSERT INTO ADDRESS ...
```

연관된 **모든 데이터를 DELETE 후 다시 INSERT** 한다. 또한 추적 불가능하므로 컬렉션 테이블은 **모든 컬럼을 묶어 기본 키**를 구성해야 한다 (`null`·중복 저장 불가).

{{< callout type="warning" >}}
값 타입 컬렉션은 **정말 단순하고 변경이 거의 없을 때**(예: 셀렉트 박스 다중 선택값)만 쓴다. 데이터가 많거나 변경·추적이 필요하면 대안이 정석이다.
{{< /callout >}}

### 9.4 대안: 일대다 엔티티

값 타입 컬렉션 대신 **값 타입을 감싼 엔티티**를 만들어 일대다로 매핑하면 위 제약이 모두 사라진다.

```java
@Entity
public class AddressEntity {
    @Id @GeneratedValue
    private Long id;

    @Embedded
    private Address address;
}

@Entity
public class Member {
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "MEMBER_ID")
    private List<AddressEntity> addressHistory = new ArrayList<>();
}
```

식별자(`@Id`)가 생겨 **개별 행 추적·수정**이 가능하고, `cascade` + `orphanRemoval` 로 값 타입 컬렉션과 같은 편의성을 그대로 얻는다. **실무에서는 대부분 이 방식을 쓴다.**

| 구분 | 값 타입 컬렉션 | 일대다 엔티티 (권장) |
|:-----|:--------------|:--------------------|
| 식별자 | 없음 | `@Id` 있음 |
| 수정 | 전체 삭제 후 재삽입 | 해당 행만 UPDATE |
| 추적 | 불가 | 가능 |
| 용도 | 단순·불변 값 목록 | 대부분의 실무 상황 |

---

## 정리

### 값 타입 분류

- **기본값 타입**: `int`, `String` 등
- **임베디드 타입**: `@Embeddable`, `@Embedded`
- **컬렉션 값 타입**: `@ElementCollection` / `@CollectionTable` — 제약이 크므로 실무에선 **일대다 엔티티**로 대체 권장

### 임베디드 타입

- 재사용성 · 응집도 향상
- 테이블 매핑은 동일
- 기본 생성자 필수

### 속성 재정의

- `@AttributeOverrides` 로 컬럼명 충돌 해결

### 값 타입 공유 주의

- 공유 참조 시 **부작용(Side Effect)** 발생
- **불변 객체로 설계** 권장
- Setter 제거, 생성자로만 값 설정

### 동등성 비교

- `equals()`, `hashCode()` 재정의 필수

> **Hibernate 용어**: 임베디드 타입을 **컴포넌트(Components)** 라고도 부른다.
