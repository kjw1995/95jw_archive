---
title: "Chapter 10. 날짜와 시간 & 형식화"
date: 2026-01-06
weight: 10
---

[Chapter 09](../09-java-lang-package)에서 자바가 문자열을 왜 불변 값으로 만들었는지 봤다. 날짜와 시간은 그 반대의 역사를 밟았다. 자바 1.0은 시각을 `Date`라는 **가변 객체**로 만들었고, 그 설계는 20년 가까이 버그의 단골 원인이었다. Java 8의 `java.time`은 시각을 `String`처럼 불변 값으로 다시 정의한 결과물이다. 그래서 이 장은 두 API를 나란히 놓고 무엇이 왜 잘못됐고 어떻게 고쳐졌는지를 본다. 규칙은 두 원리에서 나온다. 첫째, **시간축 위의 한 점과 달력의 표기는 다른 것이다.** "2024년 1월 15일 14시 30분"은 서울과 뉴욕에서 서로 다른 순간이고, `java.time`의 클래스가 여럿인 이유가 여기 있다. 둘째, **값은 불변으로 두고, 값과 그 표현을 분리한다.** 1234567.89라는 값은 하나지만 문자열 표현은 나라마다 다르며, 그 변환을 맡는 것이 형식화 클래스다. 이 두 원리를 잡으면 `Calendar.MONTH`가 왜 0부터 시작하는지, `SimpleDateFormat`은 왜 공유하면 안 되고 `DateTimeFormatter`는 왜 공유해도 되는지가 규칙이 아니라 결과가 된다.

---

## 1. Date와 Calendar: 무엇이 잘못됐나

레거시 API로 새 코드를 쓸 일은 없다. 그래도 읽을 줄은 알아야 한다. 오래된 코드와 라이브러리가 아직 `Date`를 주고받고, 무엇이 잘못됐는지를 알아야 `java.time`이 왜 그런 모양인지 이해되기 때문이다.

### 1.1 Date: 이름은 날짜, 실체는 밀리초

`java.util.Date`는 JDK 1.0부터 있었다. 이름은 날짜지만 안에 든 것은 **1970년 1월 1일 0시(UTC)부터 흐른 밀리초** 하나다. 즉 `Date`는 달력의 날짜가 아니라 시간축 위의 한 점이고, 그 점을 어느 시간대의 몇 년 몇 월 며칠로 읽을지는 별개의 문제다. 1.0 시절에는 이 둘을 `Date` 하나가 다 맡았다.

```java
Date d = new Date(124, 0, 15);   // 2024년 1월 15일
d.getYear();    // 124
d.getMonth();   // 0
```

연도는 1900을 뺀 값이고 월은 0부터 센다. 자바가 일부러 어렵게 만든 것이 아니라 C의 `struct tm`을 그대로 옮겨 왔기 때문이다. C에서 `tm_year`는 1900년 이후의 햇수이고 `tm_mon`은 0부터 11까지다. 1990년대 중반의 언어가 시스템 프로그래머에게 익숙한 관례를 따른 것인데, 그 관례가 자바 코드 전체로 퍼지면서 "1월이 0"이라는 함정이 30년째 남아 있다.

JDK 1.1이 국제화를 위해 `Calendar`와 `java.text`의 형식화 클래스를 들여오면서 `Date`의 날짜 관련 생성자와 메서드는 거의 전부 `@Deprecated`가 됐다. 그 뒤로 `Date`에 남은 쓸모는 밀리초를 담아 나르는 것뿐이다.

```java
Date now = new Date();
long millis = now.getTime();     // epoch 밀리초
System.out.println(now);
// Mon Jan 15 14:30:45 KST 2024  (기본 시간대로 읽어서 출력)
```

`toString()`이 시스템의 기본 시간대로 읽어 찍기 때문에 같은 `Date`가 서버마다 다르게 보인다. 시각은 하나인데 표기는 여럿이라는, 이 장의 첫 원리가 벌써 등장한다.

### 1.2 Calendar: 달력 계산을 맡았지만

`Calendar`는 밀리초 시각을 연·월·일 필드로 바꾸고 되돌리는 계산을 맡는다. [Chapter 07](../07-oop-advanced)에서 본 추상 클래스라 직접 만들 수 없고, `getInstance()`가 로케일에 맞는 구현을 골라 준다. 한국을 포함한 대부분은 `GregorianCalendar`, 태국(`th-TH`)은 불기를 쓰는 `BuddhistCalendar`, 일본 달력을 지정한 로케일은 `JapaneseImperialCalendar`다.

```java
Calendar cal = Calendar.getInstance();             // 현재 시각
Calendar g = new GregorianCalendar(2024, 0, 15);   // 월은 0부터

int year  = cal.get(Calendar.YEAR);
int month = cal.get(Calendar.MONTH);          // 0~11
int day   = cal.get(Calendar.DATE);           // 1~31
int dow   = cal.get(Calendar.DAY_OF_WEEK);    // 1=일요일
int hour  = cal.get(Calendar.HOUR_OF_DAY);    // 0~23
int last  = cal.getActualMaximum(Calendar.DATE);   // 이 달의 말일

cal.set(Calendar.YEAR, 2024);
cal.set(2024, 5, 15);               // 2024년 6월 15일
cal.set(2024, 5, 15, 14, 30, 0);
```

필드가 전부 `int` 상수와 `int` 값이다. `get(Calendar.MONTH)`의 결과가 0부터 11까지라는 것도, `DAY_OF_WEEK`의 1이 일요일이라는 것도 타입이 말해 주지 않아서 문서를 봐야 안다. 컴파일러는 `cal.set(Calendar.MONTH, 13)`을 막지 못한다. 막지 못하는 정도가 아니라 실행 시에도 **조용히 넘어간다.**

```java
Calendar cal = Calendar.getInstance();
cal.set(2024, 0, 32);      // 1월 32일
cal.getTime();             // 2024-02-01. 예외 없이 넘어간다

cal.setLenient(false);
cal.set(2024, 0, 32);
cal.getTime();             // IllegalArgumentException: DAY_OF_MONTH
```

`Calendar`는 기본이 관대(lenient) 모드라 범위를 벗어난 값을 다음 달로 넘겨 버린다. 편리해 보이지만 잘못된 입력이 어디서 들어왔는지 추적할 길이 없어진다. 또 하나, `set(년, 월, 일)`은 시·분·초를 건드리지 않는다. `getInstance()`로 만든 순간의 시각이 그대로 남아 있어서, "2024년 1월 1일"이라고 만든 객체가 실제로는 그날 16시 58분 54초를 가리키는 일이 흔하다. 날짜만 필요하면 `clear()`를 먼저 불러야 한다.

날짜를 옮기는 메서드는 둘이다.

```java
cal.set(2024, 0, 31);
cal.add(Calendar.DATE, 1);      // 2024-02-01. 월이 넘어간다
cal.add(Calendar.MONTH, -2);    // 2023-12-01. 년이 넘어간다

cal.set(2024, 0, 31);
cal.roll(Calendar.DATE, 1);     // 2024-01-01. 월은 그대로
```

| 메서드 | 다른 필드 | 1월 31일 + 1일 |
|:-------|:----------|:---------------|
| `add()` | 넘친 만큼 바뀐다 | 2월 1일 |
| `roll()` | 건드리지 않는다 | 1월 1일 |

`Date`와는 서로 오간다. `getTime()`이 밀리초를 `Date`에 담아 주고, `setTime()`이 `Date`의 밀리초를 받아 필드를 다시 계산한다. 두 날짜의 차이는 이 밀리초를 빼서 구하는 수밖에 없었다.

```java
Calendar c1 = Calendar.getInstance();
c1.clear();  c1.set(2024, 0, 1);
Calendar c2 = Calendar.getInstance();
c2.clear();  c2.set(2024, 11, 31);

long diff = c2.getTimeInMillis() - c1.getTimeInMillis();
long days = diff / (24 * 60 * 60 * 1000);   // 365
boolean before = c1.before(c2);             // true
```

`clear()`를 빼먹으면 시·분·초 차이가 섞여 하루가 어긋나고, 서머타임이 있는 시간대에서는 하루가 23시간이나 25시간인 날이 있어 나눗셈이 틀린다. "두 날짜 사이의 일수"라는 흔한 계산에 API가 없어서 밀리초 산수를 손으로 해야 했다는 것 자체가 문제였다.

{{< callout type="warning" >}}
**레거시 API의 문제를 정리하면 다섯 가지다.**
- **가변 객체**다. `set()`과 `add()`가 자신을 바꾸므로 공유하면 누가 언제 바꿨는지 알 수 없다. `SimpleDateFormat`이 스레드 안전하지 않은 것도 같은 뿌리다(4.3절)
- **월이 0부터** 시작하고 연도는 1900 기준이다. C에서 물려받은 관례다
- **관대 모드**가 기본이라 잘못된 날짜가 예외 없이 다음 달로 넘어간다
- **타입이 하나**다. 날짜만, 시간만, 시간대 포함을 전부 `Date`와 `Calendar`로 표현하고 필드는 전부 `int`다
- 일수 차이 같은 흔한 계산에 **API가 없다**

새 코드에서는 `java.time`만 쓴다. 레거시 API를 요구하는 라이브러리와는 경계에서만 변환한다(2.4절).
{{< /callout >}}

---

## 2. java.time: 시각을 값으로 다시 정의하다

### 2.1 왜 새 API인가

`Calendar`의 문제는 처음부터 알려져 있었고, 그 불편을 견디다 못해 나온 외부 라이브러리가 Joda-Time이다. 자바 진영이 오랫동안 `Calendar` 대신 Joda-Time을 썼고, 그 저자 스티븐 콜번(Stephen Colebourne)이 주도한 JSR 310이 Java 8(2014년)에 `java.time` 패키지로 들어왔다. 실패한 API를 고치는 대신 **처음부터 다시 설계**한 것이고, 설계 결정은 네 가지로 요약된다.

첫째, **모든 클래스가 불변이다.** 9장에서 `String`을 불변으로 만든 이유가 그대로 적용된다. 공유해도 안전하고, `Map`의 키로 쓸 수 있고, 스레드 사이에서 동기화가 필요 없다. `plusDays(1)`은 자신을 바꾸지 않고 새 객체를 돌려주므로 결과를 받지 않으면 아무 일도 일어나지 않는다. `String.trim()`에서 하던 실수를 여기서도 하게 되니 기억해 둘 것.

둘째, **의미가 다르면 타입도 다르다.** 날짜만(`LocalDate`), 시간만(`LocalTime`), 둘 다(`LocalDateTime`), 시간대까지(`ZonedDateTime`), 시간축 위의 점(`Instant`)이 별도 클래스다. `LocalDate`에는 `getHour()`가 아예 없어서 날짜에서 시각을 읽으려는 실수는 컴파일 단계에서 잡힌다. 9장에서 "같음의 기준은 클래스가 정한다"고 했는데, 여기서는 **어떤 질문에 답할 수 있는가**를 클래스가 정한다.

셋째, **사람의 직관을 따른다.** 월은 1부터 12까지이고 `Month.JANUARY`, `DayOfWeek.MONDAY` 같은 열거형([Chapter 12](../12-generics-enum-annotation))이 있다. 요일은 ISO 8601을 따라 월요일이 1이다. 메서드 이름은 `plusDays`, `isBefore`, `withDayOfMonth`처럼 읽는 그대로 동작한다.

넷째, **잘못된 값은 만들어지는 순간 거부한다.** `Calendar`의 관대 모드와 정반대다.

```java
LocalDate.of(2024, 1, 32);
// DateTimeException: Invalid value for DayOfMonth
//   (valid values 1 - 28/31): 32
LocalDate.of(2023, 2, 29);
// DateTimeException: Invalid date 'February 29'
//   as '2023' is not a leap year
```

생성자가 없고 `of()`, `now()`, `parse()` 같은 정적 팩토리 메서드만 있는 것도 이 결정의 일부다. 생성자는 호출될 때마다 새 객체를 만들어야 하지만, 팩토리는 검증을 거친 뒤 캐시된 객체를 돌려줄 수도 있고 이름으로 의도를 말할 수도 있다. 9장의 `Integer.valueOf()`와 같은 발상이다.

### 2.2 시간축 위의 점과 달력의 표기

이 장의 첫 원리를 `java.time`은 클래스 구조로 표현한다.

```
 시간축 위의 한 점      달력의 표기
 (UTC 기준 나노초)      (연월일 시분초)
     Instant           LocalDateTime
        │                    ▲
        └────── ZoneId ──────┘
              시간대 규칙
```

`Instant`는 시간축 위의 한 점이다. 1970년 1월 1일 0시 UTC부터의 초와 나노초로 표현하며 시간대 개념이 없다. 지구 어디서든 같은 순간은 같은 `Instant`다. `LocalDateTime`은 "2024년 1월 15일 14시 30분"이라는 달력 표기다. 이것만으로는 시간축 위의 어느 점인지 정해지지 않는다. 서울의 14시 30분과 뉴욕의 14시 30분은 14시간 떨어진 다른 순간이기 때문이다. 둘을 잇는 것이 시간대 규칙 `ZoneId`이고, 표기와 규칙을 함께 들고 있는 것이 `ZonedDateTime`이다.

```
 LocalDate  +  LocalTime
   (날짜)        (시간)
     └──────┬──────┘
            ▼
      LocalDateTime
      (날짜 + 시간)
            │ + ZoneId
            ▼
      ZonedDateTime
  (날짜 + 시간 + 시간대)
            │ 규칙으로 변환
            ▼
         Instant
   (시간축 위의 한 점)
```

`Local`이라는 접두어는 "어느 시간대인지 모른다"는 뜻이다. 결함이 아니라 의도다. 생일, 기념일, 마감일, "매일 아침 9시"는 시간대와 무관한 개념이라 `LocalDate`와 `LocalTime`으로 표현하는 것이 정확하다. 반대로 "이 주문이 들어온 순간"은 시간축 위의 점이므로 `Instant`가 맞다.

| 클래스 | 무엇을 표현하나 | 예 |
|:-------|:----------------|:---|
| `LocalDate` | 날짜 | `2024-01-15` |
| `LocalTime` | 시간 | `14:30:45.123` |
| `LocalDateTime` | 날짜 + 시간 | `2024-01-15T14:30:45` |
| `ZonedDateTime` | + 시간대 규칙 | `...+09:00[Asia/Seoul]` |
| `OffsetDateTime` | + 고정 오프셋 | `...+09:00` |
| `Instant` | 시간축 위의 점 | `2024-01-15T05:30:45Z` |
| `Period` | 달력 단위 간격 | 1년 2개월 14일 |
| `Duration` | 시간축 단위 간격 | 8시간 30분 |
| `Year`, `YearMonth`, `MonthDay` | 부분 날짜 | `2024-02`, `--12-25` |

패키지는 다섯이다. 핵심 클래스와 `ZoneId`는 `java.time`에, 형식화는 `java.time.format`에, `ChronoUnit`과 `TemporalAdjusters` 같은 단위·조정 도구는 `java.time.temporal`에, 시간대 규칙 데이터(`ZoneRules`)는 `java.time.zone`에, ISO 외의 달력은 `java.time.chrono`에 있다.

### 2.3 LocalDate, LocalTime, LocalDateTime

만드는 방법은 셋이다. `now()`는 시스템 시계와 기본 시간대로 현재를, `of()`는 값으로, `parse()`는 ISO 문자열로 만든다.

```java
LocalDate today = LocalDate.now();
LocalDate d1 = LocalDate.of(2024, 1, 15);
LocalDate d2 = LocalDate.of(2024, Month.JANUARY, 15);
LocalDate d3 = LocalDate.parse("2024-01-15");

int year  = d1.getYear();
int month = d1.getMonthValue();       // 1~12
Month m   = d1.getMonth();            // JANUARY
DayOfWeek dow = d1.getDayOfWeek();    // MONDAY
int len   = d1.lengthOfMonth();       // 31
boolean leap = d1.isLeapYear();       // true
```

`now()`가 기본 시간대에 의존한다는 점은 기억해 둘 만하다. 서버의 시간대 설정이 바뀌면 `LocalDate.now()`의 결과도 바뀐다. 시간대를 명시하려면 `LocalDate.now(ZoneId.of("Asia/Seoul"))`처럼 쓴다.

연산은 전부 새 객체를 돌려준다. `plus`와 `minus`는 더하고 빼고, `with`는 특정 필드만 바꾼 복사본을 만든다.

```java
LocalDate tomorrow = d1.plusDays(1);
LocalDate nextMonth = d1.plusMonths(1);
LocalDate jun1 = d1.withMonth(6).withDayOfMonth(1);

LocalDate.of(2024, 1, 31).plusMonths(1);   // 2024-02-29
LocalDate.of(2024, 1, 31).plusMonths(1)
                         .plusMonths(1);   // 2024-03-29
LocalDate.of(2024, 1, 31).plusMonths(2);   // 2024-03-31
```

1월 31일에 한 달을 더하면 2월 31일이 없으므로 그 달의 말일로 맞춘다. 그래서 한 달씩 두 번 더한 결과와 두 달을 한 번에 더한 결과가 다르다. 달력 단위 연산에는 결합법칙이 성립하지 않는다는 뜻이고, `java.time`의 결함이 아니라 달력 자체의 성질이다. "매월 31일 결제" 같은 요구사항을 구현할 때 어느 쪽 의미인지 먼저 정해야 한다.

`LocalTime`은 하루 안의 시각이다. 날짜가 없으니 자정을 넘으면 그냥 감긴다.

```java
LocalTime t1 = LocalTime.of(14, 30);
LocalTime t2 = LocalTime.of(14, 30, 45, 123_456_789);
LocalTime t3 = LocalTime.parse("14:30:45");

t1.getHour();  t1.getMinute();  t2.getNano();
LocalTime.of(23, 0).plusHours(2);           // 01:00
t2.truncatedTo(ChronoUnit.MINUTES);         // 14:30
```

`LocalDateTime`은 둘을 합친 것이고, 합치고 나누는 메서드가 양쪽에 다 있다.

```java
LocalDateTime dt1 = LocalDateTime.of(2024, 1, 15, 14, 30);
LocalDateTime dt2 = LocalDateTime.parse("2024-01-15T14:30:45");

LocalDate date = LocalDate.of(2024, 1, 15);
LocalTime time = LocalTime.of(14, 30);
LocalDateTime dt3 = LocalDateTime.of(date, time);
LocalDateTime dt4 = date.atTime(time);
LocalDateTime dt5 = date.atStartOfDay();    // 00:00
LocalDateTime dt6 = time.atDate(date);

LocalDate onlyDate = dt1.toLocalDate();
LocalTime onlyTime = dt1.toLocalTime();
LocalDateTime later = dt1.plusDays(7).plusHours(3);
```

### 2.4 Instant: 시간축 위의 점

```java
Instant now = Instant.now();          // 2024-01-15T05:30:45.123Z
Instant epoch = Instant.EPOCH;        // 1970-01-01T00:00:00Z
Instant i = Instant.ofEpochSecond(1_000_000_000);
                                      // 2001-09-09T01:46:40Z
long sec = now.getEpochSecond();
long ms  = now.toEpochMilli();        // Date, DB, 로그와 호환
```

`Instant`의 문자열 끝에 붙는 `Z`는 UTC라는 뜻이다. 시간대가 없으니 서버 사이에서 주고받거나 저장하기에 가장 안전한 형태다. 어느 서버가 읽어도 같은 순간이고, 시간대 설정이 달라도 값이 어긋나지 않는다. `LocalDateTime`으로 저장하면 서버와 DB의 시간대가 다를 때 값이 조용히 밀리는데, JPA 시리즈의 [Chapter 07. 엔티티 매핑](../../jpa/07-entity-mapping)에서 그 이유로 `Instant`나 `OffsetDateTime`을 권했다.

레거시 API와의 경계가 바로 여기다. Java 8부터 `Date`에 `toInstant()`와 `from(Instant)`가 생겼고, `Date`가 어차피 밀리초 하나이므로 변환에서 잃는 것이 없다. `Instant`를 사람이 읽는 표기로 바꾸려면 시간대가 필요하고, 반대 방향도 마찬가지다.

```java
Date legacy = Date.from(now);
Instant back = legacy.toInstant();

LocalDateTime ldt =
    LocalDateTime.ofInstant(now, ZoneId.of("Asia/Seoul"));
Instant fromLdt = ldt.toInstant(ZoneOffset.of("+09:00"));
```

### 2.5 시간대: ZoneId와 ZoneOffset

같은 순간을 세 도시에서 읽으면 이렇게 된다.

```
Instant  2024-01-15T05:30:00Z
   │
   ├─ Asia/Seoul        14:30 +09:00
   ├─ America/New_York  00:30 -05:00
   └─ UTC               05:30 Z
```

```java
LocalDateTime ldt = LocalDateTime.of(2024, 1, 15, 14, 30);
ZonedDateTime seoul = ldt.atZone(ZoneId.of("Asia/Seoul"));
// 2024-01-15T14:30+09:00[Asia/Seoul]

ZonedDateTime ny =
    seoul.withZoneSameInstant(ZoneId.of("America/New_York"));
// 2024-01-15T00:30-05:00[America/New_York]. 같은 순간

ZonedDateTime wrong =
    seoul.withZoneSameLocal(ZoneId.of("America/New_York"));
// 2024-01-15T14:30-05:00[America/New_York]. 다른 순간

seoul.toInstant();   // 2024-01-15T05:30:00Z
```

`withZoneSameInstant()`는 시간축 위의 점을 고정한 채 표기를 바꾸고, `withZoneSameLocal()`은 표기를 고정한 채 점을 옮긴다. 시간대 변환은 거의 언제나 전자다.

`ZoneId`와 `ZoneOffset`은 다른 것이다. `ZoneOffset`은 `+09:00` 같은 **UTC와의 고정 차이**이고, `ZoneId`는 `Asia/Seoul` 같은 **지역의 규칙**이다. 규칙에는 서머타임처럼 오프셋이 때에 따라 바뀌는 역사가 들어 있다. 한국은 지금 서머타임이 없지만 1987년과 1988년에는 있었고, `Asia/Seoul` 규칙은 그것을 기억한다.

```java
ZoneId seoul = ZoneId.of("Asia/Seoul");

// 1988-05-08 02:00에 시계가 03:00으로 건너뛰었다
ZonedDateTime.of(LocalDateTime.of(1988, 5, 8, 2, 30), seoul);
// 1988-05-08T03:30+10:00[Asia/Seoul]. 없는 시각은 뒤로 민다

// 1988-10-09 03:00에 시계가 02:00으로 되돌아갔다
ZonedDateTime.of(LocalDateTime.of(1988, 10, 9, 2, 30), seoul);
// 1988-10-09T02:30+10:00[Asia/Seoul]. 두 번 있는 시각은 앞쪽

ZonedDateTime noon = ZonedDateTime.of(
    LocalDateTime.of(1988, 5, 7, 12, 0), seoul);
noon.plusDays(1);    // 05-08T12:00+10:00. 달력으로 하루
noon.plusHours(24);  // 05-08T13:00+10:00. 시간축으로 24시간
```

서머타임이 시작되는 날은 23시간이고 끝나는 날은 25시간이다. 그래서 `plusDays(1)`과 `plusHours(24)`가 다른 결과를 낸다. 전자는 달력을 하루 넘기고 후자는 시간축을 24시간 옮긴다. 1.2절에서 밀리초를 하루 길이로 나누던 계산이 틀리는 이유가 정확히 이것이다.

{{< callout type="info" >}}
**`ZonedDateTime`과 `OffsetDateTime` 고르기**
- `OffsetDateTime`은 고정 오프셋(`+09:00`)만 안다. 규칙이 없으니 해석이 하나뿐이라 저장과 전송에 적합하다
- `ZonedDateTime`은 지역 규칙(`Asia/Seoul`)을 안다. 서머타임을 자동으로 처리하므로 사용자에게 보여 주거나 "현지 시각으로 매일 9시" 같은 계산에 적합하다
- `equals()`는 오프셋과 시간대까지 같아야 참이고, 같은 순간인지만 물으려면 `isEqual()`을 쓴다. 서울 14:30과 UTC 05:30은 `equals()`가 `false`, `isEqual()`이 `true`다
{{< /callout >}}

### 2.6 Period와 Duration: 왜 둘인가

"1개월은 몇 초인가"에 답이 없다는 것이 두 클래스가 나뉜 이유다. 달력 단위(년·월·일)는 길이가 일정하지 않고, 시간축 단위(초·나노초)는 달력을 모른다. 그래서 `Period`는 달력 위의 간격을, `Duration`은 시간축 위의 간격을 표현한다.

```java
Period p = Period.between(LocalDate.of(2024, 1, 1),
                          LocalDate.of(2025, 3, 15));
// P1Y2M14D. 1년 2개월 14일
p.getYears();  p.getMonths();  p.getDays();
LocalDate.now().plus(Period.ofMonths(6));

Duration d = Duration.between(LocalTime.of(9, 0),
                              LocalTime.of(17, 30));
// PT8H30M
d.toHours();         // 8
d.toMinutesPart();   // 30 (Java 9+)
d.toMinutes();       // 510

Duration.between(LocalDate.of(2024, 1, 1),
                 LocalDate.of(2024, 1, 2));
// UnsupportedTemporalTypeException: Unsupported unit: Seconds
```

`LocalDate`에는 초가 없으므로 `Duration.between()`에 넣으면 예외다. 반대로 `Period.ofDays(30)`과 `Period.ofMonths(1)`은 다른 값이고, `Duration.ofDays(1)`은 달력의 하루가 아니라 정확히 24시간(`PT24H`)이다. 이 구분을 문서가 아니라 타입이 강제한다는 것이 두 클래스를 나눈 이유다.

| | `Period` | `Duration` |
|:--|:---------|:-----------|
| 단위 | 년, 월, 일 | 초, 나노초 |
| 대상 | `LocalDate` | `LocalTime`, `LocalDateTime`, `Instant` |
| 서머타임 | 달력을 따른다 | 시간축을 따른다 |
| 예 | `P1Y2M14D` | `PT8H30M` |

두 날짜 사이의 일수처럼 단위 하나만 필요하면 `ChronoUnit`이 간단하다.

```java
ChronoUnit.DAYS.between(LocalDate.of(2024, 1, 1),
                        LocalDate.of(2024, 12, 31));   // 365
ChronoUnit.HOURS.between(LocalTime.of(9, 0),
                         LocalTime.of(17, 30));        // 8
```

### 2.7 비교

```java
LocalDate d1 = LocalDate.of(2024, 1, 15);
LocalDate d2 = LocalDate.of(2024, 6, 20);

d1.isBefore(d2);    // true
d1.isAfter(d2);     // false
d1.isEqual(d2);     // false
d1.compareTo(d2);   // 음수
d1.equals(LocalDate.parse("2024-01-15"));   // true
```

모든 `java.time` 클래스가 `equals()`와 `hashCode()`를 값 기준으로 재정의했다. 9장에서 값처럼 다루려는 클래스는 그래야 한다고 했고, 그 덕분에 `Map<LocalDate, ...>`의 키로 쓸 수 있다.

---

## 3. TemporalAdjusters: 날짜 계산에 이름을 붙이다

"이번 달 마지막 날", "다음 금요일", "이달의 셋째 금요일" 같은 계산은 어디서나 필요한데 매번 손으로 짜면 틀리기 쉽다. `TemporalAdjusters`는 그 계산에 이름을 붙여 둔 정적 메서드 모음이다. `with()`에 넘기면 조정된 새 날짜를 돌려준다.

```java
LocalDate today = LocalDate.of(2024, 1, 15);   // 월요일

today.with(TemporalAdjusters.firstDayOfMonth());       // 01-01
today.with(TemporalAdjusters.lastDayOfMonth());        // 01-31
today.with(TemporalAdjusters.firstDayOfNextMonth());   // 02-01
today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));  // 01-22
today.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
                                                       // 01-15
today.with(TemporalAdjusters.previous(DayOfWeek.FRIDAY));
                                                       // 01-12
today.with(TemporalAdjusters.dayOfWeekInMonth(3, DayOfWeek.FRIDAY));
                                                       // 01-19
```

| 메서드 | 결과 |
|:-------|:-----|
| `firstDayOfMonth()`, `lastDayOfMonth()` | 이번 달 첫 날, 마지막 날 |
| `firstDayOfNextMonth()`, `firstDayOfNextYear()` | 다음 달, 다음 해 첫 날 |
| `firstDayOfYear()`, `lastDayOfYear()` | 올해 첫 날, 마지막 날 |
| `next(요일)`, `previous(요일)` | 다음, 지난 그 요일. 당일 제외 |
| `nextOrSame(요일)`, `previousOrSame(요일)` | 당일 포함 |
| `firstInMonth(요일)`, `lastInMonth(요일)` | 이번 달 첫, 마지막 그 요일 |
| `dayOfWeekInMonth(n, 요일)` | 이번 달 n번째 그 요일 |

`with()`가 받는 것은 `TemporalAdjuster`라는 인터페이스다. 메서드가 하나뿐인 함수형 인터페이스라 [Chapter 14](../14-lambda-stream)에서 볼 람다로 직접 만들 수도 있다. 미리 정의된 것에 없는 "다음 근무일"은 이렇게 쓴다.

```java
TemporalAdjuster nextWorkday = t -> {
    LocalDate d = LocalDate.from(t);
    int add = switch (d.getDayOfWeek()) {
        case FRIDAY -> 3;
        case SATURDAY -> 2;
        default -> 1;
    };
    return d.plusDays(add);
};
today.with(nextWorkday);                     // 2024-01-16
LocalDate.of(2024, 1, 19).with(nextWorkday); // 금요일 → 01-22
```

---

## 4. 형식화: 값과 표현을 나누다

### 4.1 왜 형식화 클래스가 따로 있나

1234567.89라는 값은 하나다. 그런데 미국은 `1,234,567.89`, 독일은 `1.234.567,89`, 프랑스는 `1 234 567,89`로 쓴다. 날짜도 마찬가지라 2024년 1월 15일을 미국은 `Jan 15, 2024`, 한국은 `2024. 1. 15.`로 읽는다. 값과 표현이 일대다이므로, 표현을 만드는 일을 값 클래스의 `toString()`에 맡길 수 없다. `toString()`은 표현 하나만 돌려줄 수 있고, 로케일과 패턴이라는 **설정**을 받을 자리가 없기 때문이다.

그래서 JDK 1.1은 형식화를 별도의 객체로 떼어 냈다. `java.text.Format`을 조상으로 두는 이 클래스들은 패턴과 로케일을 상태로 갖고, `format()`으로 값을 문자열로, `parse()`로 문자열을 값으로 바꾼다. 형식화와 파싱이 한 객체에 있는 이유는 둘이 같은 패턴을 공유해야 하기 때문이다. 어떤 패턴으로 찍었으면 같은 패턴으로 읽어야 원래 값이 나온다.

| 클래스 | 값 | 표현 |
|:-------|:---|:-----|
| `DecimalFormat` | 숫자 | `1,234.5`, `75.6%`, `1.23E3` |
| `SimpleDateFormat` | `Date` | `2024-01-15`, `오후 2:30` |
| `MessageFormat` | 인자 여러 개 | `{0}년 {1}월` 틀에 채운 문장 |
| `ChoiceFormat` | 숫자 범위 | `A`, `B`, `없음`, `1개` |

`java.time`은 자기 포맷터를 `java.time.format.DateTimeFormatter`로 따로 가져왔다(5절). 왜 기존 것을 쓰지 않았는지는 4.3절에서 드러난다.

### 4.2 DecimalFormat: 숫자 패턴

```java
double num = 1234567.89;
new DecimalFormat("#,###.##").format(num);        // 1,234,567.89
new DecimalFormat("0000000000.0000").format(num); // 0001234567.8900
new DecimalFormat("#.###E0").format(num);         // 1.235E6
new DecimalFormat("##.#%").format(0.756);         // 75.6%
```

패턴 문자는 몇 개 안 된다. `0`은 자리가 비어도 0을 찍고, `#`은 비면 생략한다. 그래서 `0000000000.0000`은 앞뒤를 0으로 채우고 `#,###.##`은 있는 만큼만 찍는다.

| 기호 | 의미 | 패턴 | `1234.5` |
|:-----|:-----|:-----|:---------|
| `0` | 자릿수. 비면 0 | `00000.00` | `01234.50` |
| `#` | 자릿수. 비면 생략 | `#####.##` | `1234.5` |
| `.` | 소수점 | `#.#` | `1234.5` |
| `,` | 그룹 구분 | `#,###` | `1,234` |
| `%` | 100을 곱해 백분율 | `#%` | `123450%` |
| `E` | 지수 표기 | `#.##E0` | `1.23E3` |

`#,###`으로 `1234.5`를 찍으면 `1,235`가 아니라 **`1,234`**다. `DecimalFormat`의 기본 반올림이 `HALF_EVEN`, 즉 정확히 절반일 때 짝수 쪽으로 가는 은행가 반올림이기 때문이다. 절반을 늘 올리면 많은 수를 더할 때 합이 위로 치우치는데, 짝수로 보내면 그 편향이 상쇄된다. IEEE 754 부동소수점의 기본 반올림도 이것이다. 반면 `Math.round(1234.5)`는 `1235`다. 학교에서 배운 반올림을 원하면 `setRoundingMode(RoundingMode.HALF_UP)`으로 바꾼다.

파싱은 문자열을 `Number`로 돌려준다.

```java
DecimalFormat df = new DecimalFormat("#,###.##");
Number n = df.parse("1,234,567.89");   // 1234567.89
df.parse("1,234abc");                  // 1234. 뒤는 무시한다
df.parse("abc");                       // ParseException
```

두 가지가 눈에 띈다. 읽을 수 있는 데까지만 읽고 나머지는 조용히 무시하므로, 문자열 전체가 숫자인지 확인하려면 `ParsePosition`으로 어디까지 읽었는지 봐야 한다. 그리고 `ParseException`은 [Chapter 08](../08-exception-handling)에서 본 checked 예외라 `try-catch`가 강제된다. `java.time`은 이 두 결정을 모두 뒤집는데, 5.5절에서 그 이유를 본다.

### 4.3 SimpleDateFormat: 왜 스레드 안전하지 않나

```java
Date now = new Date();
new SimpleDateFormat("yyyy-MM-dd").format(now);
// 2024-01-15
new SimpleDateFormat("yyyy년 MM월 dd일 E요일").format(now);
// 2024년 01월 15일 월요일
new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(now);
// 2024-01-15 14:30:45

Date parsed =
    new SimpleDateFormat("yyyy-MM-dd").parse("2024-01-15");
```

패턴 문자는 5.3절의 표에 `DateTimeFormatter`와 함께 정리했다. 대부분 같다. 여기서 볼 것은 이 클래스를 왜 공유하면 안 되는지다.

```
공유된 SimpleDateFormat 하나
  ┌───────────────────┐
  │ Calendar calendar │ ← 가변 필드
  └───────────────────┘
 스레드 A  calendar.setTime(dateA)
 스레드 B  calendar.setTime(dateB)
 스레드 A  calendar.get(YEAR) …
           → dateB의 값을 읽는다
```

`SimpleDateFormat`은 안에 `Calendar` 필드 하나를 두고 모든 작업을 그 위에서 한다. `format(date)`는 먼저 `calendar.setTime(date)`로 필드를 채운 뒤 하나씩 읽어 문자열을 만들고, `parse()`는 읽은 값을 그 `Calendar`에 써 넣은 뒤 `getTime()`으로 꺼낸다. 1.2절에서 본 `Calendar`의 가변성이 그대로 포맷터의 가변성이 된 것이다. 두 스레드가 같은 인스턴스를 쓰면 한쪽이 채운 필드를 다른 쪽이 덮어쓰고, 결과는 엉뚱한 날짜이거나 예외다. JDK 25에서 스레드 넷이 각자 다른 날짜를 2만 번씩 파싱하고 다시 찍어 보면, 8만 번 중 6만 번 가까이가 다른 날짜로 돌아오고 7천 번 넘게 예외가 났다. 문서에도 "Date formats are not synchronized"라고 적혀 있다.

해결은 셋이다. 호출할 때마다 새로 만들거나, 스레드마다 하나씩 갖거나(`ThreadLocal`, 동시성 시리즈의 [객체 공유](../../concurrency/03-object-sharing) 참고), 처음부터 상태가 없는 `DateTimeFormatter`를 쓰거나. 새 코드라면 세 번째다. 스레드가 무엇이고 왜 공유가 문제인지는 [Chapter 13](../13-thread)에서 다룬다.

관대함도 `Calendar`에서 물려받았다. `parse("2024-02-30")`은 예외 없이 3월 1일을 돌려주고, `parse("2024-01-15abc")`는 뒤의 쓰레기를 무시한다.

### 4.4 MessageFormat: 문장 틀에 값을 채우기

```java
String p = "이름: {0}, 나이: {1}, 주소: {2}";
MessageFormat.format(p, "홍길동", 25, "서울");
// 이름: 홍길동, 나이: 25, 주소: 서울

MessageFormat.format("오늘은 {0}년 {1}월 {2}일입니다.", 2024, 1, 15);
// 오늘은 2,024년 1월 15일입니다.
```

두 번째 결과의 `2,024`는 오타가 아니다. `{0}`처럼 형식을 지정하지 않으면 `MessageFormat`은 인자의 **타입만 보고** 포맷터를 고르는데, `Integer`는 숫자이니 로케일의 기본 숫자 포맷터를 쓰고, 그 포맷터는 세 자리마다 구분 기호를 넣는다. 연도를 금액처럼 본 셈이다. 구분 기호가 없어야 하는 숫자는 형식을 지정하거나 문자열로 넘긴다.

```java
MessageFormat.format("오늘은 {0,number,#}년입니다.", 2024);
// 오늘은 2024년입니다.

String p3 = "금액: {0,number,#,###}원, 날짜: {1,date,yyyy-MM-dd}";
MessageFormat.format(p3, 1000000, new Date());
// 금액: 1,000,000원, 날짜: 2024-01-15

MessageFormat.format("It's {0}", "x");    // Its {0}
MessageFormat.format("It''s {0}", "x");   // It's x
```

`{1,date,...}`가 받는 것은 `java.util.Date`뿐이다. `LocalDate`를 넣으면 `IllegalArgumentException`이 난다. `MessageFormat`이 `java.time`보다 스무 해 가까이 앞서기 때문이고, 이 경계에서는 `Date.from()`으로 바꾸거나 `DateTimeFormatter`로 먼저 문자열을 만들어 넘긴다. 작은따옴표가 특수 문자라는 것도 자주 걸리는 함정이다. `'`는 그 안의 내용을 그대로 두라는 뜻이라 `It's {0}`에서는 `{0}`이 치환되지 않고, 따옴표 자체를 쓰려면 두 번 쓴다.

### 4.5 ChoiceFormat: 숫자 범위를 문자열로

```java
double[] limits = {0, 60, 70, 80, 90};
String[] grades = {"F", "D", "C", "B", "A"};
ChoiceFormat cf = new ChoiceFormat(limits, grades);

for (int s : new int[]{95, 82, 75, 63, 45, 60}) {
    System.out.print(s + "=" + cf.format(s) + " ");
}
// 95=A 82=B 75=C 63=D 45=F 60=D

new ChoiceFormat("0#F|60#D|70#C|80#B|90#A").format(60);   // D
new ChoiceFormat("0#F|60<D|70#C|80#B|90#A").format(60);   // F
```

`limits`는 오름차순이어야 하고, 값은 자기보다 작거나 같은 경계 중 가장 큰 것의 문자열을 받는다. 패턴 문자열에서 `#`는 경계를 포함하고 `<`는 제외한다는 뜻이라, `60<D`로 쓰면 60은 아직 `F`다. 첫 경계보다 작으면 첫 문자열, 마지막 경계보다 크면 마지막 문자열이다. 단수와 복수처럼 개수에 따라 문장이 달라질 때 `MessageFormat` 안에 넣어 쓰는 것이 본래 용도다.

```java
MessageFormat.format("파일 {0,choice,0#없음|1#1개|1<{0}개}", 3);
// 파일 3개
```

---

## 5. DateTimeFormatter: 상태가 없는 포맷터

### 5.1 왜 공유해도 되나

`DateTimeFormatter`는 패턴, 로케일, 해석 규칙 같은 **설정**만 갖고 작업 중인 값을 필드에 두지 않는다. `format(temporal)`은 인자로 받은 값만 읽어 문자열을 만들고, `parse()`는 새 결과 객체를 만들어 돌려준다. 설정을 바꾸는 `withLocale()` 같은 메서드는 자신을 고치지 않고 새 포맷터를 돌려준다. 즉 `java.time`의 다른 클래스처럼 불변이다. 그래서 `static final` 상수로 하나 만들어 두고 모든 스레드가 공유하는 것이 권장되는 사용법이고, JDK가 제공하는 `ISO_LOCAL_DATE` 같은 상수 자체가 그렇게 쓰인다. `SimpleDateFormat`의 문제를 동기화로 막은 것이 아니라 **문제가 생길 상태를 없앤** 것이다.

### 5.2 미리 정의된 포맷터

```java
LocalDateTime now = LocalDateTime.of(2024, 1, 15, 14, 30, 45,
                                     123_000_000);
ZonedDateTime z = now.atZone(ZoneId.of("Asia/Seoul"));

now.format(DateTimeFormatter.ISO_LOCAL_DATE);   // 2024-01-15
now.format(DateTimeFormatter.ISO_LOCAL_TIME);   // 14:30:45.123
now.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
// 2024-01-15T14:30:45.123
now.format(DateTimeFormatter.BASIC_ISO_DATE);   // 20240115
z.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
// 2024-01-15T14:30:45.123+09:00
z.format(DateTimeFormatter.ISO_INSTANT);
// 2024-01-15T05:30:45.123Z
```

`java.time` 클래스의 `toString()`이 이 ISO 8601 형식이다. 그래서 로그나 JSON에 `toString()` 결과를 그대로 써도 `parse()`로 되돌릴 수 있다. 연, 월, 일 순서로 큰 단위가 앞에 오므로 문자열 정렬이 시간 순서와 같다는 것도 이 형식을 택한 이유다.

### 5.3 패턴 포맷터

```java
DateTimeFormatter f1 =
    DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
DateTimeFormatter f2 =
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
DateTimeFormatter f3 =
    DateTimeFormatter.ofPattern("yy/M/d a h:mm");

now.format(f1);   // 2024년 01월 15일
now.format(f2);   // 2024-01-15 14:30:45
now.format(f3);   // 24/1/15 오후 2:30
```

패턴 문자는 `SimpleDateFormat`과 거의 같아서 한 표로 정리한다. 글자 수가 자릿수나 길이를 정한다. `M`은 `1`, `MM`은 `01`, `MMM`은 `1월`(영어는 `Jan`), `MMMM`은 `1월`(`January`)이다.

| 기호 | 의미 | 예 | 비고 |
|:-----|:-----|:---|:-----|
| `y` | 연도(연호 기준) | `2024`, `24` | 5.5절 참고 |
| `u` | 연도 | `2024` | `DateTimeFormatter`만. `SimpleDateFormat`의 `u`는 요일 번호 |
| `M` | 월 | `1`, `01`, `1월`, `Jan` | |
| `d` | 일 | `5`, `05` | |
| `E` | 요일 | `월`, `월요일`, `Mon` | |
| `a` | 오전/오후 | `오후`, `PM` | |
| `H` | 시(0~23) | `14` | |
| `h` | 시(1~12) | `2` | `a`와 함께 쓴다 |
| `m` | 분 | `30` | |
| `s` | 초 | `45` | |
| `S` | 초의 소수부 | `SSS` → `123` | `SimpleDateFormat`에서는 밀리초 |
| `n` | 나노초 | `123000000` | `DateTimeFormatter`만 |
| `VV` | 시간대 ID | `Asia/Seoul` | `DateTimeFormatter`만. 반드시 두 글자 |
| `z` | 시간대 이름 | `KST` | |
| `Z` | 오프셋 | `+0900` | `ZZZZZ`는 `+09:00` |
| `X` | 오프셋. UTC는 `Z` | `+09`, `XXX` → `+09:00` | |
| `O` | 지역화 오프셋 | `GMT+9` | `DateTimeFormatter`만 |
| `G` | 연호 | `AD`, `서기` | |

`DateTimeFormatter`는 값에 없는 필드를 찍으라고 하면 예외를 던진다. `LocalDate`를 `HH:mm`이 든 패턴으로 찍으면 `UnsupportedTemporalTypeException`, `LocalDateTime`을 `VV`로 찍으면 시간대를 꺼낼 수 없다는 `DateTimeException`이다. 타입이 "무엇에 답할 수 있는가"를 정한다는 2.1절의 결정이 포맷터까지 이어진다.

`Y`는 함정이다. 소문자 `y`가 연도인데 대문자 `Y`는 **주 기준 연도**라서, 2024년 12월 29일을 `YYYY-MM-dd`로 찍으면 한국 로케일에서 `2025-12-29`가 나온다. 그 날이 속한 주가 2025년의 첫째 주로 계산되기 때문이다. 연말마다 반복되는 버그이고, 연도는 항상 소문자 `y` 아니면 `u`다.

### 5.4 로케일 포맷터

```java
DateTimeFormatter ko = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL).withLocale(Locale.KOREA);
DateTimeFormatter us = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL).withLocale(Locale.US);

LocalDate d = LocalDate.of(2024, 1, 15);
d.format(ko);   // 2024년 1월 15일 월요일
d.format(us);   // Monday, January 15, 2024
```

| `FormatStyle` | 한국 | 미국 |
|:--------------|:-----|:-----|
| `FULL` | `2024년 1월 15일 월요일` | `Monday, January 15, 2024` |
| `LONG` | `2024년 1월 15일` | `January 15, 2024` |
| `MEDIUM` | `2024. 1. 15.` | `Jan 15, 2024` |
| `SHORT` | `24. 1. 15.` | `1/15/24` |

패턴 포맷터는 텍스트(`E`, `MMM`, `a`)만 로케일을 따르지만, 로케일 포맷터는 순서와 구분 기호까지 로케일의 규칙을 따른다. 사용자에게 보여 줄 날짜는 후자가 맞고, 기계가 읽을 날짜는 ISO다. Java 9부터는 이 규칙이 유니코드 CLDR 데이터에서 오므로 Java 8과는 출력이 조금 다를 수 있다. 참고로 날짜와 시간을 함께 찍는 `FULL`과 `LONG` 스타일은 시간대 이름을 포함하므로 `LocalDateTime`에는 쓸 수 없고 `ZonedDateTime`이 필요하다.

### 5.5 파싱과 해석 규칙

```java
LocalDate.parse("2024-01-15");                   // ISO
LocalDateTime.parse("2024-01-15T14:30:45");     // T가 필수
LocalDate.parse("2024년 01월 15일",
    DateTimeFormatter.ofPattern("yyyy년 MM월 dd일"));

LocalDate.parse("2024-13-45");
// DateTimeParseException: Invalid value for MonthOfYear
LocalDate.parse("2024-01-15abc");
// DateTimeParseException: unparsed text found at index 10
LocalDate.parse("2024-1-5",
    DateTimeFormatter.ofPattern("yyyy-MM-dd"));
// DateTimeParseException: could not be parsed at index 5
```

`SimpleDateFormat`과 정반대다. 문자열 끝까지 패턴과 정확히 맞아야 하고, 남는 글자가 있으면 실패하며, `MM`은 정확히 두 자리를 요구한다. 그리고 `DateTimeParseException`은 `RuntimeException`의 자손인 unchecked 예외다. 8장의 구분으로 말하면, JSR 310 설계자들은 잘못된 날짜 문자열을 "호출자가 미리 검증할 수 있고, 잡는다고 복구 방법이 정해지는 것도 아닌" 오류로 봤다. 모든 파싱에 `try-catch`를 강제하던 `ParseException`에 대한 반성이다.

파싱이 얼마나 엄격한지는 `ResolverStyle`이 정하는데, 여기에 함정이 하나 있다.

```java
DateTimeFormatter f = DateTimeFormatter.ofPattern("yyyy-MM-dd");
LocalDate.parse("2024-02-30", f);      // 2024-02-29 !
LocalDate.parse("2024-02-30");         // DateTimeParseException

DateTimeFormatter strict = DateTimeFormatter
    .ofPattern("uuuu-MM-dd")
    .withResolverStyle(ResolverStyle.STRICT);
LocalDate.parse("2024-02-30", strict); // DateTimeParseException
LocalDate.parse("2024-01-15", strict); // 2024-01-15
```

ISO 상수 포맷터는 `STRICT`인데 `ofPattern()`으로 만든 포맷터는 기본이 `SMART`다. `SMART`는 월 13처럼 아예 불가능한 값은 거부하지만, 2월 30일처럼 "그 달에는 없는 날"은 말일로 조용히 맞춘다. 입력 검증이 목적이면 `STRICT`로 바꿔야 하는데, 이때 패턴의 연도를 `yyyy`에서 `uuuu`로 바꿔야 한다. `y`는 연호(`G`) 기준의 연도라서 `STRICT`에서는 연호 없이 해석하기를 거부하고, `u`는 연호와 무관한 연도이기 때문이다. `SMART`에서는 연호가 없으면 서기로 가정해 주므로 이 차이가 드러나지 않는다.

---

## 6. 실전 활용

각 예제는 어느 클래스가 그 질문에 답하는 타입인지를 고르는 연습이다.

### 6.1 나이와 D-Day

```java
int age(LocalDate birth) {
    return Period.between(birth, LocalDate.now()).getYears();
}
age(LocalDate.of(1990, 5, 15));     // 2024-01-15 기준 33

long dDay(LocalDate target) {
    return ChronoUnit.DAYS.between(LocalDate.now(), target);
}
dDay(LocalDate.of(2024, 12, 25));   // 2024-01-15 기준 345
```

나이는 달력 단위이므로 `Period`, 남은 일수는 단위 하나이므로 `ChronoUnit.DAYS`다.

### 6.2 근무 시간

```java
Duration worked(LocalTime start, LocalTime end, Duration lunch) {
    return Duration.between(start, end).minus(lunch);
}
worked(LocalTime.of(9, 0), LocalTime.of(18, 0),
       Duration.ofHours(1)).toHours();   // 8
```

시각과 시각 사이의 길이는 `Duration`이다.

### 6.3 다음 특정 요일까지

```java
long daysUntil(DayOfWeek target) {
    LocalDate today = LocalDate.now();
    LocalDate next =
        today.with(TemporalAdjusters.nextOrSame(target));
    return ChronoUnit.DAYS.between(today, next);
}
```

### 6.4 시간대 변환과 저장

```java
ZonedDateTime toZone(ZonedDateTime src, String zone) {
    return src.withZoneSameInstant(ZoneId.of(zone));
}
ZonedDateTime seoul = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
ZonedDateTime ny = toZone(seoul, "America/New_York");

// 저장은 Instant, 표시는 사용자의 시간대로
Instant stored = seoul.toInstant();
ZonedDateTime shown = stored.atZone(ZoneId.of("Europe/London"));
```

저장과 전송은 시간대가 없는 `Instant`로 하고, 화면에 보일 때만 사용자의 `ZoneId`로 바꾼다. 이 규칙 하나가 시간대 버그의 대부분을 막는다.

### 6.5 기간 안의 날짜 순회

```java
LocalDate from = LocalDate.of(2024, 1, 1);
LocalDate to = LocalDate.of(2024, 2, 1);
from.datesUntil(to).count();   // 31 (Java 9+)
```

`datesUntil()`은 14장에서 볼 스트림을 돌려준다. 반복문에서 `plusDays(1)`을 부르며 돌던 코드가 한 줄이 된다.

---

## 7. 요약

| 항목 | 핵심 | 왜 |
|:-----|:-----|:---|
| `Date` | 이름과 달리 밀리초 시각 하나 | 1.0 시절 시각과 달력 표기를 한 클래스가 맡았다 |
| 월 0, 연도 1900 기준 | `Date`, `Calendar`의 관례 | C의 `struct tm`을 옮겨 왔다 |
| `Calendar` | 가변, 관대, 전부 `int` | 잘못된 값이 조용히 넘어가고 공유가 위험하다 |
| `java.time` | 불변 값, 정적 팩토리 | 공유, 해시 키, 스레드에 안전. 검증 뒤 캐시 가능 |
| `Instant` | 시간축 위의 점(UTC) | 어디서 읽어도 같은 순간. 저장과 전송용 |
| `Local*` | 시간대를 모르는 달력 표기 | 생일, 마감처럼 시간대와 무관한 개념이 있다 |
| `ZonedDateTime` | 표기 + 지역 규칙 | 서머타임처럼 오프셋이 바뀌는 역사를 규칙이 안다 |
| `OffsetDateTime` | 표기 + 고정 오프셋 | 해석이 하나뿐이라 저장과 전송에 안전 |
| `Period` / `Duration` | 달력 간격 / 시간축 간격 | 1개월이 몇 초인지는 정해져 있지 않다 |
| `plusDays(1)` ≠ `plusHours(24)` | 서머타임 날은 23, 25시간 | 달력 단위와 시간축 단위는 다르다 |
| 형식화 클래스 | 값과 표현의 분리 | 값은 하나, 표현은 로케일마다 다르다 |
| `DecimalFormat` 반올림 | 기본 `HALF_EVEN` | 절반을 늘 올리면 합이 위로 치우친다 |
| `SimpleDateFormat` | 공유 금지 | 내부 `Calendar` 하나 위에서 모든 작업을 한다 |
| `MessageFormat`의 `{0}` | 정수가 `2,024`로 | 타입만 보고 로케일 숫자 포맷터를 고른다 |
| `DateTimeFormatter` | 공유 권장 | 설정만 있고 작업 상태가 없다 |
| `ofPattern` 파싱 | 기본 `SMART`. 2월 30일 → 29일 | 검증이 목적이면 `STRICT` + `uuuu` |
| `YYYY` | 주 기준 연도 | 연말에 다음 해가 찍힌다. 연도는 `y` 또는 `u` |

| 상황 | 타입 |
|:-----|:-----|
| 날짜만, 시간만, 둘 다 | `LocalDate`, `LocalTime`, `LocalDateTime` |
| 사용자에게 보일 현지 시각 | `ZonedDateTime` |
| 저장, 전송, 로그 | `Instant`, `OffsetDateTime` |
| 날짜 간격, 시간 간격 | `Period`, `Duration`, `ChronoUnit` |
| 문자열 변환 | `DateTimeFormatter`. ISO 상수 또는 `static final` 하나 |
| 레거시 API 경계 | `Date.from(Instant)`, `date.toInstant()` |
