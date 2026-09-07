---
title: "Chapter 11. 값 타입"
date: 2025-12-25
weight: 11
---

지금까지는 엔티티 이야기였다. 그런데 엔티티 안의 필드들은 무엇인가. 회원의 이름은 회원에 딸린 값이지 추적할 대상이 아니다. 주소는 어떤가. `city`, `street`, `zipcode` 세 필드로 풀어 두는 것이 옳은가, 아니면 `Address`라는 하나의 값으로 묶어야 하는가. 묶는다면 그 `Address`는 엔티티인가. JPA는 이 질문에 **값 타입**이라는 답을 준다. 식별자 없이 엔티티에 딸려 사는 값이다. 이 장은 값 타입이 엔티티와 무엇이 다른지, 어떻게 매핑되는지, 그리고 왜 불변으로 만들어야 하는지를 다룬다. 관통하는 질문은 하나다. "이것은 추적해야 할 대상인가, 그냥 값인가."

---

## 1. 엔티티 타입과 값 타입

둘을 가르는 기준은 **식별자**다. 엔티티에는 `@Id`가 있어 값이 전부 바뀌어도 같은 것으로 추적된다. 회원의 이름과 나이가 바뀌어도 1번 회원은 1번 회원이다. 값 타입에는 식별자가 없다. 100이라는 숫자와 "서울"이라는 문자열은 값 자체가 전부이고, 값이 같으면 같은 것이며, 어디에 속했느냐로만 의미를 갖는다.

| 구분 | 엔티티 타입 | 값 타입 |
|:-----|:------------|:--------|
| 식별자 | 있다 | 없다 |
| 같음의 기준 | 식별자 | 값 |
| 생명주기 | 스스로 갖는다 | 소속된 엔티티를 따른다 |
| 공유 | 여러 엔티티가 참조해도 된다 | 공유하면 안 된다 (4절) |
| 변경 | 값을 바꿔도 같은 엔티티 | 바꾸는 대신 교체한다 |

이 구분이 JPA에서 특별히 중요한 이유는 [Chapter 03](../03-persistence-context)에서 봤듯 영속성 컨텍스트가 **식별자를 열쇠로** 모든 것을 관리하기 때문이다. 식별자가 없는 값은 컨텍스트에 독립적으로 들어갈 수 없다. 값 타입은 언제나 어떤 엔티티의 일부로서, 그 엔티티의 스냅샷 안에서 함께 추적된다.

```
Member (엔티티, @Id로 추적)
 ├── name: String         기본값 타입
 ├── age: int             기본값 타입
 ├── homeAddress: Address 임베디드 타입
 └── favoriteFoods: Set   값 타입 컬렉션
```

값 타입은 세 종류다. 자바가 주는 **기본값 타입**, 개발자가 정의하는 **임베디드 타입**, 값을 여럿 담는 **값 타입 컬렉션**이다.

---

## 2. 기본값 타입

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;        // 식별자

    private String name;    // 값 타입
    private int age;        // 값 타입
}
```

`int`, `Long`, `String`, `LocalDate` 같은 타입이다. 회원이 지워지면 이름과 나이도 함께 사라진다. 값 타입의 생명주기가 엔티티를 따른다는 말의 가장 단순한 형태다.

기본값 타입에는 눈여겨볼 성질이 하나 있다. **공유가 일어나지 않는다.** 기본형은 대입할 때 값이 복사되고, `String`과 래퍼 클래스는 애초에 바꿀 수 없는 불변 객체다. 회원 A의 나이를 회원 B에 대입한 뒤 B의 나이를 바꿔도 A는 영향이 없다.

```java
int a = 10;
int b = a;   // 값이 복사된다
b = 20;      // a는 여전히 10
```

당연해 보이는 이 성질이 4절에서 중요해진다. 개발자가 직접 만든 값 타입은 이 성질을 저절로 갖지 못한다.

---

## 3. 임베디드 타입

### 3.1 왜 필요한가

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;
    private String name;

    private LocalDate startDate;   // 근무 시작
    private LocalDate endDate;     // 근무 종료

    private String city;           // 집 주소
    private String street;
    private String zipcode;
}
```

이 엔티티에는 "근무 기간"과 "집 주소"가 있는데, 코드 어디에도 그 이름이 없다. 다섯 필드가 나란히 있을 뿐이다. "이 날짜에 근무 중이었는가"를 판단하는 로직은 `Member`에 두거나 서비스에 두어야 하고, 주소가 필요한 다른 엔티티는 세 필드를 또 선언해야 한다.

**임베디드 타입**은 논리적으로 한 덩어리인 필드들을 하나의 클래스로 뽑아낸 값 타입이다.

```
[적용 전]
 Member
  ├ id
  ├ name
  ├ startDate ┐
  ├ endDate   ┘ 근무 기간
  ├ city      ┐
  ├ street    ┤ 집 주소
  └ zipcode   ┘

[적용 후]
 Member
  ├ id
  ├ name
  ├ workPeriod: Period
  └ homeAddress: Address
```

```java
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
    private LocalDate startDate;
    private LocalDate endDate;

    public boolean isWorking(LocalDate date) {     // 값 타입에 어울리는 로직
        return !date.isBefore(startDate) && !date.isAfter(endDate);
    }
}

@Embeddable
public class Address {
    private String city;
    private String street;
    private String zipcode;
}
```

얻는 것은 세 가지다. 개념에 **이름**이 생기고(`Period`, `Address`), 그 개념에 속한 **로직을 둘 자리**가 생기며(`isWorking`), 다른 엔티티에서 **재사용**할 수 있다. 응집도 높은 도메인 모델을 만드는 가장 기본적인 도구다.

### 3.2 테이블에는 그대로 풀린다

```
Member 필드        MEMBER 컬럼
workPeriod  ─▶ START_DATE, END_DATE
homeAddress ─▶ CITY, STREET, ZIPCODE
```

임베디드 타입을 도입해도 테이블은 한 줄도 바뀌지 않는다. `Period`와 `Address`의 필드가 `MEMBER` 테이블의 컬럼으로 그대로 펼쳐진다. 값 타입에는 식별자가 없으니 자기 테이블을 가질 이유가 없고, 소속된 엔티티의 행 안에 값으로 들어가는 것이 자연스럽다.

이 점이 임베디드 타입을 부담 없이 쓸 수 있게 한다. 객체 모델을 얼마나 잘게 나누든 테이블 구조와 SQL은 같다. 반대로 말하면, 잘 설계된 테이블이라도 객체 쪽에서는 더 세밀하게 표현할 수 있다는 뜻이다. 매핑이 객체와 테이블을 분리해 주기 때문에 가능한 일이다.

### 3.3 요구사항과 허용 범위

| 항목 | 내용 | 이유 |
|:-----|:-----|:-----|
| `@Embeddable` | 값 타입 클래스에 붙인다 | 이 클래스가 테이블이 아니라 값이라는 선언 |
| `@Embedded` | 사용하는 필드에 붙인다 | 둘 중 하나만 있어도 되지만 둘 다 붙이면 의도가 분명하다 |
| 기본 생성자 | 필요하다 | 엔티티처럼 리플렉션으로 만들어 값을 채운다 |
| 중첩 | 임베디드 안에 임베디드 가능 | 주소 안의 우편번호처럼 값 안에 값이 있을 수 있다 |
| 엔티티 참조 | 임베디드 안에 `@ManyToOne` 가능 | 외래 키 컬럼이 소속 엔티티의 테이블에 들어갈 뿐이다 |

```java
@Embeddable
public class Address {
    private String city;
    private String street;

    @Embedded
    private Zipcode zipcode;          // 값 안의 값
}

@Embeddable
public class PhoneNumber {
    private String areaCode;
    private String localNumber;

    @ManyToOne
    private PhoneServiceProvider provider;   // 값 안의 엔티티 참조
}
```

### 3.4 같은 타입을 두 번 쓰면: @AttributeOverride

집 주소와 회사 주소를 모두 `Address`로 두면 문제가 생긴다. 두 필드가 같은 컬럼 이름(`CITY`, `STREET`, `ZIPCODE`)을 요구하기 때문이다. 테이블에 같은 이름의 컬럼이 둘 있을 수 없다.

```java
@Entity
public class Member {
    @Embedded
    private Address homeAddress;          // CITY, STREET, ZIPCODE

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "city",    column = @Column(name = "COMPANY_CITY")),
        @AttributeOverride(name = "street",  column = @Column(name = "COMPANY_STREET")),
        @AttributeOverride(name = "zipcode", column = @Column(name = "COMPANY_ZIPCODE"))
    })
    private Address companyAddress;       // COMPANY_CITY, COMPANY_STREET, COMPANY_ZIPCODE
}
```

`@AttributeOverride`는 임베디드 타입의 컬럼 이름을 **사용하는 자리에서** 바꾼다. `Address` 클래스 자체는 그대로다. 컬럼 이름이 값 타입의 성질이 아니라 "이 엔티티에서 이 용도로 쓰일 때"의 성질이기 때문에, 재정의도 사용하는 쪽에 둔다. 중첩된 임베디드 타입의 필드는 `zipcode.zip`처럼 점으로 경로를 적는다.

### 3.5 임베디드 타입과 null

```java
member.setHomeAddress(null);   // CITY, STREET, ZIPCODE 모두 NULL
```

임베디드 타입이 `null`이면 매핑된 컬럼 전부가 `null`이 된다. 반대 방향도 알아 둘 필요가 있다. 컬럼 전부가 `null`인 행을 조회하면 Hibernate는 `homeAddress`에 빈 `Address`가 아니라 **`null`**을 넣는다. "필드가 전부 비어 있는 주소"와 "주소 없음"을 테이블에서는 구분할 수 없으므로, 둘 중 후자로 해석하는 것이다. 임베디드 타입을 쓸 때는 `null` 검사를 습관처럼 넣는다.

---

## 4. 값 타입은 공유하면 안 된다

### 4.1 공유 참조가 만드는 부작용

```java
Address address = new Address("서울", "종로", "11111");
member1.setHomeAddress(address);
member2.setHomeAddress(address);         // 같은 인스턴스를 공유

member2.getHomeAddress().setCity("부산");   // 회원 2만 바꾸려 했는데
tx.commit();                                // UPDATE MEMBER ... 두 번. 회원 1도 부산
```

```
member1.homeAddress ─┐
                     ├─▶ Address 하나
member2.homeAddress ─┘
→ 한쪽을 바꾸면 양쪽이 바뀐다
```

의도는 회원 2의 주소만 바꾸는 것이었다. 그런데 두 회원이 같은 `Address` 인스턴스를 가리키므로 회원 1의 주소도 바뀐다. 이런 현상을 **부작용**(side effect)이라 한다. 순수 자바에서도 버그지만, JPA에서는 결과가 더 크다. [Chapter 05](../05-persistence-features)의 변경 감지가 두 회원 모두를 스냅샷과 다르다고 판단해 UPDATE를 두 번 보낸다. DB의 회원 1까지 부산으로 바뀐다. 컴파일러도 JPA도 이것이 실수라는 것을 알 방법이 없다.

### 4.2 복사해서 쓰면 되지 않나

```java
Address copied = new Address(address.getCity(), address.getStreet(), address.getZipcode());
member2.setHomeAddress(copied);          // 별도 인스턴스
member2.getHomeAddress().setCity("부산");   // 회원 1은 그대로
```

복사본을 넘기면 문제는 사라진다. 2절에서 본 기본값 타입이 안전한 이유가 바로 "대입하면 복사된다"였다. 그런데 객체 타입은 대입하면 **참조**가 넘어간다. 복사는 개발자가 매번 기억해서 해야 하는 일이고, 잊는 순간 4.1절이 재현된다. 누군가 `member1.getHomeAddress()`로 꺼낸 주소를 그대로 다른 곳에 넘기는 것을 막을 방법이 코드 구조에는 없다.

### 4.3 불변 객체로 만든다

근본적인 해결은 **바꿀 수 없게** 만드는 것이다. 공유되더라도 아무도 바꿀 수 없다면 부작용은 원천적으로 불가능하다.

```java
@Embeddable
public class Address {
    private String city;
    private String street;
    private String zipcode;

    protected Address() {}                   // JPA용

    public Address(String city, String street, String zipcode) {
        this.city = city;
        this.street = street;
        this.zipcode = zipcode;
    }

    public String getCity() { return city; }     // getter만. setter는 없다
    public String getStreet() { return street; }
    public String getZipcode() { return zipcode; }

    public Address withCity(String city) {       // 바꾸는 대신 새 값을 만든다
        return new Address(city, street, zipcode);
    }
}
```

```java
member2.getHomeAddress().setCity("부산");                 // 컴파일 오류. 방법이 없다
member2.setHomeAddress(member2.getHomeAddress().withCity("부산"));   // 교체한다
```

값을 바꾸는 방법이 사라지고 **교체**만 남는다. 회원 2의 주소를 교체해도 회원 1은 여전히 예전 인스턴스를 가리키므로 영향이 없다. 변경 감지 입장에서도 자연스럽다. 회원 2의 `homeAddress` 필드가 다른 값을 가리키게 됐으니 회원 2만 UPDATE된다. 1절의 표에서 값 타입의 변경을 "바꾸는 대신 교체한다"고 적은 이유가 이것이다. 값 타입은 불변으로 만드는 것이 기본이고, `Integer`나 `String`이 그런 것처럼 그것이 값이 갖춰야 할 성질이다.

{{< callout type="info" >}}
Hibernate 6.2부터는 자바 `record`를 `@Embeddable`로 쓸 수 있다. 레코드는 필드가 전부 `final`이고 setter가 없어 불변 값 타입의 조건을 언어 차원에서 만족한다. `equals()`와 `hashCode()`도 모든 필드 기준으로 자동 생성되므로 5절의 요구사항까지 함께 해결된다.
{{< /callout >}}

---

## 5. 값 타입 비교: 값이 같으면 같다

```java
Address a = new Address("서울", "종로", "11111");
Address b = new Address("서울", "종로", "11111");

a == b;        // false. 다른 인스턴스
a.equals(b);   // 재정의하지 않으면 false. 재정의해야 true
```

1절에서 값 타입은 "값이 같으면 같은 것"이라고 했다. 자바의 기본 `equals()`는 인스턴스가 같은지를 보므로, 값 타입 클래스에서는 반드시 **모든 필드를 비교하도록** 재정의해야 한다. `hashCode()`도 같은 필드로 함께 재정의한다. 그래야 `Set`이나 `Map`의 키로 썼을 때 같은 값을 같은 것으로 취급한다.

```java
@Embeddable
public class Address {
    // ...

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Address that = (Address) o;
        return Objects.equals(city, that.city)
            && Objects.equals(street, that.street)
            && Objects.equals(zipcode, that.zipcode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(city, street, zipcode);
    }
}
```

이것이 필요한 순간은 생각보다 자주 온다. 회원의 주소가 특정 주소와 같은지 비교할 때, 6절의 값 타입 컬렉션에서 `contains()`나 `remove()`로 요소를 찾을 때, [Chapter 09](../09-advanced-mapping)에서 본 `@EmbeddedId`로 식별자를 만들 때 모두 값 기준의 `equals()`가 전제다. 엔티티와 달리 임베디드 타입에는 프록시가 생기지 않으므로 `getClass()` 비교를 써도 괜찮다.

---

## 6. 값 타입 컬렉션

### 6.1 왜 별도 테이블이 필요한가

값 타입 하나는 소속 엔티티의 행 안에 컬럼으로 들어간다. 그런데 값이 **여러 개**면 어떻게 하나. 회원이 좋아하는 음식 목록, 이전에 살았던 주소 목록처럼 값이 컬렉션이면 한 행에 담을 수 없다. 컬럼 하나에는 값 하나만 들어간다는 관계형 모델의 제약 때문이다. 결국 [Chapter 08](../08-various-relationships)의 일대다처럼 별도 테이블이 필요하다.

```
MEMBER            FAVORITE_FOOD
┌───────────┐     ┌──────────────┐
│ MEMBER_ID │◀────│ MEMBER_ID FK │
│ NAME      │     │ FOOD_NAME    │
└───────────┘     └──────────────┘
                  PK = 모든 컬럼
```

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;

    @ElementCollection
    @CollectionTable(name = "FAVORITE_FOOD", joinColumns = @JoinColumn(name = "MEMBER_ID"))
    @Column(name = "FOOD_NAME")               // 값이 하나뿐이라 컬럼 이름을 여기서 준다
    private Set<String> favoriteFoods = new HashSet<>();

    @ElementCollection
    @CollectionTable(name = "ADDRESS", joinColumns = @JoinColumn(name = "MEMBER_ID"))
    private List<Address> addressHistory = new ArrayList<>();
}
```

`@ElementCollection`은 "이 컬렉션의 요소는 엔티티가 아니라 값"이라는 선언이고, `@CollectionTable`은 그 값을 담을 테이블과 외래 키를 정한다. 이 테이블의 행에는 식별자가 없다. 그래서 행을 구별하려면 **모든 컬럼을 묶어 기본 키**로 삼는 수밖에 없고, 그 결과 어떤 컬럼도 `null`일 수 없고 완전히 같은 값을 두 번 넣을 수도 없다.

### 6.2 생명주기와 로딩

```java
Member member = new Member();
member.getFavoriteFoods().add("치킨");
member.getFavoriteFoods().add("피자");
member.getAddressHistory().add(new Address("서울", "종로", "11111"));

em.persist(member);   // MEMBER 1건, FAVORITE_FOOD 2건, ADDRESS 1건 INSERT
```

값 타입 컬렉션은 따로 저장하지 않는다. 소속 엔티티가 저장될 때 함께 저장되고, 엔티티에서 빠지면 지워진다. [Chapter 10](../10-proxy-loading)에서 본 영속성 전이와 고아 객체 제거를 항상 켜 둔 것과 같다. 값에는 스스로의 생명주기가 없다는 원칙이 여기서도 그대로다. 로딩은 컬렉션이므로 기본이 지연 로딩이다.

### 6.3 변경의 비용: 어떤 행이 바뀌었는지 모른다

```java
Member member = em.find(Member.class, 1L);
member.getAddressHistory().remove(new Address("서울", "종로", "11111"));   // 하나만 뺐는데
tx.commit();
```

```sql
DELETE FROM ADDRESS WHERE MEMBER_ID = ?    -- 이 회원의 주소를 전부 지우고
INSERT INTO ADDRESS (...) VALUES (...)     -- 남은 것을 다시 넣는다
INSERT INTO ADDRESS (...) VALUES (...)
```

주소 하나를 뺐을 뿐인데 그 회원의 주소 행 전부가 지워지고 다시 들어간다. 이유는 식별자가 없기 때문이다. 엔티티라면 "3번 행을 지워라"고 할 수 있지만, 값에는 번호가 없다. Hibernate는 `List`(순서 없는 bag)로 선언된 값 타입 컬렉션에 변경이 생기면 어느 행이 어떻게 바뀌었는지 특정하기를 포기하고 전부 지운 뒤 현재 상태를 다시 쓴다.

컬렉션 타입에 따라 정도가 다르다.

| 선언 | 요소 하나를 바꾸면 | 이유 |
|:-----|:-------------------|:-----|
| `List` (bag) | 전부 DELETE 후 전부 INSERT | 행을 특정할 방법이 없다 |
| `Set` | 해당 행만 DELETE 또는 INSERT | 값 전체가 곧 행의 식별자라 `equals()`로 찾을 수 있다 |
| `List` + `@OrderColumn` | 인덱스로 해당 행만 DELETE·UPDATE | 순서 컬럼이 행의 위치를 알려 준다 |

값을 여럿 담을 때는 `Set`이 기본 선택이다. 그러려면 5절의 `equals()`와 `hashCode()`가 제대로 정의되어 있어야 한다.

### 6.4 언제 쓰고 언제 엔티티로 올리는가

값 타입 컬렉션이 어울리는 자리는 **단순하고 작고 잘 바뀌지 않는 값의 목록**이다. 셀렉트 박스에서 여러 개를 고르는 취향 정보 같은 것이다. 반대로 데이터가 많거나, 개별 항목을 수정·조회해야 하거나, 항목에 다른 정보가 붙기 시작하면 값이 아니라 **엔티티**로 올리는 것이 맞다.

```java
@Entity
public class AddressEntity {          // 값을 감싼 엔티티. 식별자가 생긴다
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

식별자가 생기면 개별 행을 추적하고 수정할 수 있고, `cascade`와 `orphanRemoval`로 값 타입 컬렉션과 같은 편의성을 그대로 얻는다. 잃는 것은 "이것은 값이다"라는 선언뿐인데, 추적이 필요한 순간 그것은 이미 값이 아니었다.

| 구분 | 값 타입 컬렉션 | 일대다 엔티티 |
|:-----|:---------------|:--------------|
| 식별자 | 없다 | 있다 |
| 요소 수정 | 전체 재작성 (bag) 또는 값 기준 (Set) | 해당 행만 UPDATE |
| 요소 조회 | 소속 엔티티를 통해서만 | JPQL로 직접 |
| 어울리는 곳 | 단순하고 작은 값 목록 | 그 외 대부분 |

---

## 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| 엔티티와 값 | 식별자가 있으면 엔티티, 없으면 값 | 영속성 컨텍스트는 식별자로 관리한다 |
| 기본값 타입 | `int`, `String` 등. 공유되지 않는다 | 복사되거나 불변이다 |
| 임베디드 타입 | 필드 묶음에 이름과 로직을 준다 | 테이블은 그대로라 비용이 없다 |
| `@AttributeOverride` | 같은 타입을 두 번 쓸 때 컬럼 이름 재정의 | 컬럼 이름은 사용처의 성질이다 |
| `null` | 전부 `null`이면 객체도 `null` | 빈 값과 없음을 테이블은 구분하지 못한다 |
| 공유 금지 | 값 타입은 참조를 공유하면 안 된다 | 변경 감지가 양쪽 모두 UPDATE한다 |
| 불변 객체 | setter 없이 생성자와 교체로 | 바꿀 수 없으면 부작용도 없다 |
| `equals`·`hashCode` | 모든 필드로 재정의 | 값은 값이 같으면 같다 |
| 값 타입 컬렉션 | 별도 테이블, 모든 컬럼이 기본 키 | 행에 식별자가 없다 |
| 컬렉션 변경 | bag은 전체 재작성, `Set`은 행 단위 | 행을 특정할 수단이 값뿐이다 |
| 엔티티로 승격 | 추적이 필요하면 엔티티 + 일대다 | 추적이 필요한 것은 값이 아니다 |
