---
title: "Chapter 10. 날짜와 시간 & 형식화"
weight: 10
---

자바에서 날짜와 시간을 다루는 API는 JDK 버전에 따라 발전해왔다. JDK 1.0의 `Date`, JDK 1.1의 `Calendar`를 거쳐 JDK 1.8부터 `java.time` 패키지가 추가되어 한층 안전하고 명확한 API가 제공된다.

---

## 1. Calendar와 Date (레거시 API)

### 1.1 Date 클래스의 역사

| JDK 버전 | 클래스 | 특징 |
|:---------|:-------|:-----|
| JDK 1.0 | `Date` | 최초의 날짜/시간 클래스, 기능 부족 |
| JDK 1.1 | `Calendar` | Date 보완, 하지만 여전히 설계 문제 존재 |
| JDK 1.8 | `java.time` | 기존 단점 해소, 불변 객체, 명확한 API |

{{< callout type="warning" >}}
**레거시 API를 피해야 하는 이유**
- `Date`의 대부분 메서드가 `@Deprecated`
- 월(Month)이 **0부터 시작** (0 = 1월) — 버그의 단골 원인
- **가변 객체**라 멀티쓰레드 환경에서 안전하지 않다 (`SimpleDateFormat` 포함)
- 날짜/시간 연산이 복잡하고 직관적이지 않다

**신규 프로젝트에서는 반드시 `java.time` 패키지를 사용하라.**
{{< /callout >}}

### 1.2 Calendar와 GregorianCalendar

`Calendar`는 추상 클래스이므로 직접 인스턴스를 생성할 수 없다.

```java
// Calendar cal = new Calendar();  // 컴파일 에러
Calendar cal = Calendar.getInstance();
```

`getInstance()`는 시스템의 국가/지역 설정을 확인하여 적절한 구현을 돌려준다.
- 태국: `BuddhistCalendar`
- 그 외: `GregorianCalendar` (그레고리력)

```java
// GregorianCalendar를 직접 생성
Calendar cal = new GregorianCalendar();
Calendar cal2 = new GregorianCalendar(2024, 0, 15);
// 2024년 1월 15일 (월은 0부터!)
Calendar cal3 = new GregorianCalendar(2024, 0, 15, 14, 30, 0);
```

### 1.3 Calendar 필드 상수

```java
Calendar cal = Calendar.getInstance();

// 날짜
int year = cal.get(Calendar.YEAR);
int month = cal.get(Calendar.MONTH);         // 0~11
int date = cal.get(Calendar.DATE);           // 1~31
int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);    // 1=일요일
int dayOfYear = cal.get(Calendar.DAY_OF_YEAR);
int weekOfYear = cal.get(Calendar.WEEK_OF_YEAR);

// 시간
int amPm = cal.get(Calendar.AM_PM);
int hour = cal.get(Calendar.HOUR);           // 0~11
int hourOfDay = cal.get(Calendar.HOUR_OF_DAY); // 0~23
int minute = cal.get(Calendar.MINUTE);
int second = cal.get(Calendar.SECOND);

// 이 달의 마지막 날
int lastDay = cal.getActualMaximum(Calendar.DATE);
```

{{< callout type="info" >}}
**`Calendar.MONTH`는 0부터 시작한다.** 0이 1월, 11이 12월이다. 숫자 대신 `Calendar.JANUARY`~`Calendar.DECEMBER` 상수를 쓰는 편이 안전하다.
{{< /callout >}}

### 1.4 날짜/시간 설정과 변경

```java
Calendar cal = Calendar.getInstance();

cal.set(Calendar.YEAR, 2024);
cal.set(Calendar.MONTH, 5);  // 6월 (0부터)
cal.set(Calendar.DATE, 15);

cal.set(2024, 5, 15);             // 년, 월, 일
cal.set(2024, 5, 15, 14, 30);     // + 시, 분
cal.set(2024, 5, 15, 14, 30, 0);  // + 초

cal.clear();                       // 전부 초기화
cal.clear(Calendar.HOUR_OF_DAY);   // 특정 필드만 초기화
```

### 1.5 add()와 roll()

```java
Calendar cal = Calendar.getInstance();
cal.set(2024, 0, 31);  // 2024년 1월 31일

// add(): 다른 필드에 영향
cal.add(Calendar.DATE, 1);    // 2024-02-01 (월 바뀜)
cal.add(Calendar.MONTH, -2);  // 2023-12-01 (년 바뀜)

// roll(): 다른 필드에 영향 없음
cal.set(2024, 0, 31);
cal.roll(Calendar.DATE, 1);   // 2024-01-01 (월 유지)
```

| 메서드 | 다른 필드 영향 | 1월 31일 + 1일 |
|:-------|:--------------|:---------------|
| `add()` | 있음 | 2월 1일 |
| `roll()` | 없음 | 1월 1일 |

### 1.6 Date와 Calendar 간 변환

```java
// Calendar → Date
Calendar cal = Calendar.getInstance();
Date date = cal.getTime();

// Date → Calendar
Calendar cal2 = Calendar.getInstance();
cal2.setTime(new Date());
```

### 1.7 두 날짜 간 차이 계산

```java
Calendar cal1 = Calendar.getInstance();
cal1.set(2024, 0, 1);

Calendar cal2 = Calendar.getInstance();
cal2.set(2024, 11, 31);

long diffMillis = cal2.getTimeInMillis()
                - cal1.getTimeInMillis();
long diffDays = diffMillis / (24 * 60 * 60 * 1000);
System.out.println("일 수 차이: " + diffDays);

boolean isBefore = cal1.before(cal2);  // true
boolean isAfter = cal1.after(cal2);    // false
```

---

## 2. 형식화 클래스

`java.text` 패키지의 형식화 클래스는 데이터를 원하는 형식으로 출력하거나, 형식화된 문자열에서 데이터를 추출할 수 있게 해준다.

### 2.1 DecimalFormat (숫자 형식화)

```java
double num = 1234567.89;

DecimalFormat df1 = new DecimalFormat("#,###.##");
System.out.println(df1.format(num));
// 1,234,567.89

DecimalFormat df2 = new DecimalFormat("0000000000.0000");
System.out.println(df2.format(num));
// 0001234567.8900

DecimalFormat df3 = new DecimalFormat("#.###E0");
System.out.println(df3.format(num));
// 1.235E6

double rate = 0.756;
DecimalFormat df4 = new DecimalFormat("##.#%");
System.out.println(df4.format(rate));
// 75.6%

// 문자열 → 숫자
try {
    Number parsed = df1.parse("1,234,567.89");
    double value = parsed.doubleValue();
} catch (ParseException e) {
    e.printStackTrace();
}
```

**주요 패턴 기호**

| 기호 | 의미 | 예시 패턴 | `1234.5` 결과 |
|:-----|:-----|:---------|:-------------|
| `0` | 숫자 (0으로 채움) | `00000.00` | `01234.50` |
| `#` | 숫자 (생략 가능) | `#####.##` | `1234.5` |
| `.` | 소수점 | `#.#` | `1234.5` |
| `,` | 그룹 구분자 | `#,###` | `1,235` |
| `%` | 백분율 | `#%` | `123450%` |
| `E` | 지수 | `#.##E0` | `1.23E3` |

### 2.2 SimpleDateFormat (날짜 형식화)

```java
Date now = new Date();

SimpleDateFormat sdf1 = new SimpleDateFormat("yyyy-MM-dd");
System.out.println(sdf1.format(now));
// 2024-01-15

SimpleDateFormat sdf2 =
    new SimpleDateFormat("yyyy년 MM월 dd일 E요일");
System.out.println(sdf2.format(now));
// 2024년 01월 15일 월요일

SimpleDateFormat sdf3 =
    new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
System.out.println(sdf3.format(now));
// 2024-01-15 14:30:45

// 문자열 → Date
try {
    Date date = sdf1.parse("2024-01-15");
} catch (ParseException e) {
    e.printStackTrace();
}
```

**SimpleDateFormat 패턴 기호**

| 기호 | 의미 | 예시 |
|:-----|:-----|:-----|
| `G` | 연대 | AD |
| `y` | 년도 | 2024 |
| `M` | 월 | 01, 1월 |
| `d` | 일 | 15 |
| `E` | 요일 | 월, Mon |
| `a` | 오전/오후 | AM, PM |
| `H` | 시 (0~23) | 14 |
| `h` | 시 (1~12) | 02 |
| `m` | 분 | 30 |
| `s` | 초 | 45 |
| `S` | 밀리초 | 123 |
| `z` | 타임존 | KST, GMT+9 |
| `Z` | 타임존 (RFC 822) | +0900 |

{{< callout type="warning" >}}
**`SimpleDateFormat`은 쓰레드 안전하지 않다.** 내부에 가변 상태(`Calendar` 인스턴스)를 보유하기 때문에 여러 쓰레드가 같은 인스턴스를 공유하면 파싱 결과가 깨진다. 멀티쓰레드에서는 `ThreadLocal`에 담아 쓰거나, 더 나은 선택은 `DateTimeFormatter`(불변, thread-safe) 사용이다.
{{< /callout >}}

### 2.3 MessageFormat (메시지 형식화)

```java
String pattern = "오늘은 {0}년 {1}월 {2}일입니다.";
String result = MessageFormat.format(pattern, 2024, 1, 15);
System.out.println(result);
// 오늘은 2024년 1월 15일입니다.

Object[] args = {"홍길동", 25, "서울"};
String p2 = "이름: {0}, 나이: {1}, 주소: {2}";
System.out.println(MessageFormat.format(p2, args));
// 이름: 홍길동, 나이: 25, 주소: 서울

// 형식 지정
String p3 = "금액: {0,number,#,###}원, 날짜: {1,date,yyyy-MM-dd}";
Object[] a3 = {1000000, new Date()};
System.out.println(MessageFormat.format(p3, a3));
// 금액: 1,000,000원, 날짜: 2024-01-15
```

### 2.4 ChoiceFormat (범위 형식화)

```java
double[] limits = {0, 60, 70, 80, 90};
String[] grades = {"F", "D", "C", "B", "A"};

ChoiceFormat cf = new ChoiceFormat(limits, grades);

int[] scores = {95, 82, 75, 63, 45};
for (int score : scores) {
    System.out.println(score + " → " + cf.format(score));
}
// 95 → A, 82 → B, 75 → C, 63 → D, 45 → F

// 패턴 문자열 방식
String pattern = "0#F|60#D|70#C|80#B|90#A";
ChoiceFormat cf2 = new ChoiceFormat(pattern);
```

---

## 3. java.time 패키지 (JDK 1.8+)

JDK 1.8에서 추가된 `java.time` 패키지는 기존 Date/Calendar의 문제점을 전면적으로 해결한 새로운 날짜/시간 API이다.

{{< callout type="info" >}}
**왜 새로운 API인가?**
- **불변성(immutable)**: 모든 클래스의 연산은 새 객체를 반환한다 → 멀티쓰레드에서 동기화 불필요
- **명확한 타입**: 날짜만(`LocalDate`), 시간만(`LocalTime`), 날짜+시간(`LocalDateTime`), 시간대 포함(`ZonedDateTime`)이 **별도 클래스**로 구분된다
- **월이 1부터 시작** (사람의 직관과 일치)
- **명확한 API**: `plusDays()`, `isBefore()`, `with()` 등 읽기 쉬운 메서드명
- **타임존과 오프셋의 분리**: DST 처리까지 고려된 설계
{{< /callout >}}

### 3.1 패키지 구조

| 패키지 | 설명 |
|:-------|:-----|
| `java.time` | 핵심 클래스 (`LocalDate`, `LocalTime` 등) |
| `java.time.chrono` | ISO 외 달력 시스템 |
| `java.time.format` | 형식화/파싱 (`DateTimeFormatter`) |
| `java.time.temporal` | 필드/단위 (`ChronoField`, `ChronoUnit`) |
| `java.time.zone` | 시간대 (`ZoneId`, `ZoneOffset`) |

### 3.2 핵심 클래스 관계

```
 LocalDate     LocalTime
 (날짜)    +   (시간)
      │         │
      ▼         ▼
   LocalDateTime
   (날짜 + 시간)
         │
         +  ZoneId (시간대)
         │
         ▼
   ZonedDateTime
  (날짜 + 시간 + 시간대)
```

| 클래스 | 설명 | 예시 |
|:-------|:-----|:-----|
| `LocalDate` | 날짜만 | `2024-01-15` |
| `LocalTime` | 시간만 | `14:30:45.123` |
| `LocalDateTime` | 날짜 + 시간 | `2024-01-15T14:30:45` |
| `ZonedDateTime` | + 시간대 | `...+09:00[Asia/Seoul]` |
| `Instant` | epoch 타임스탬프 | UTC 기준 초/나노초 |
| `Period` | 날짜 간격 | 1년 2개월 3일 |
| `Duration` | 시간 간격 | 2시간 30분 |

### 3.3 LocalDate

```java
LocalDate today = LocalDate.now();
LocalDate d1 = LocalDate.of(2024, 1, 15);
LocalDate d2 = LocalDate.of(2024, Month.JANUARY, 15);
LocalDate d3 = LocalDate.parse("2024-01-15");

int year = today.getYear();
int month = today.getMonthValue();    // 1~12 (0부터 아님!)
Month monthEnum = today.getMonth();   // JANUARY
int dayOfMonth = today.getDayOfMonth();
DayOfWeek dayOfWeek = today.getDayOfWeek();  // MONDAY

int lengthOfMonth = today.lengthOfMonth();
boolean isLeapYear = today.isLeapYear();

// 불변! 새 객체 반환
LocalDate tomorrow = today.plusDays(1);
LocalDate nextMonth = today.plusMonths(1);
LocalDate lastYear = today.minusYears(1);
LocalDate jun1 = today.withMonth(6).withDayOfMonth(1);
```

### 3.4 LocalTime

```java
LocalTime now = LocalTime.now();
LocalTime t1 = LocalTime.of(14, 30);
LocalTime t2 = LocalTime.of(14, 30, 45);
LocalTime t3 = LocalTime.of(14, 30, 45, 123456789);
LocalTime t4 = LocalTime.parse("14:30:45");

int hour = now.getHour();
int minute = now.getMinute();
int second = now.getSecond();
int nano = now.getNano();

LocalTime later = now.plusHours(2);
LocalTime earlier = now.minusMinutes(30);
LocalTime nine = now.withHour(9).withMinute(0);

// 초 이하 버림
LocalTime truncated = now.truncatedTo(ChronoUnit.MINUTES);
```

### 3.5 LocalDateTime

```java
LocalDateTime now = LocalDateTime.now();
LocalDateTime dt1 = LocalDateTime.of(2024, 1, 15, 14, 30);
LocalDateTime dt2 = LocalDateTime.parse("2024-01-15T14:30:45");

// LocalDate + LocalTime 조합
LocalDate date = LocalDate.of(2024, 1, 15);
LocalTime time = LocalTime.of(14, 30);
LocalDateTime dt3 = LocalDateTime.of(date, time);
LocalDateTime dt4 = date.atTime(time);
LocalDateTime dt5 = date.atTime(14, 30);
LocalDateTime dt6 = time.atDate(date);
LocalDateTime dt7 = date.atStartOfDay();  // 00:00:00

// 분리
LocalDate dateOnly = now.toLocalDate();
LocalTime timeOnly = now.toLocalTime();

// 연산 체이닝
LocalDateTime future = now.plusDays(7).plusHours(3);
```

### 3.6 ZonedDateTime과 시간대

```java
ZonedDateTime zdt1 = ZonedDateTime.now();
ZonedDateTime zdt2 =
    ZonedDateTime.now(ZoneId.of("America/New_York"));

// LocalDateTime에 시간대 추가
LocalDateTime ldt = LocalDateTime.now();
ZonedDateTime zdt3 = ldt.atZone(ZoneId.of("Asia/Seoul"));

// 같은 순간을 다른 시간대로 변환
ZonedDateTime seoul =
    ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
ZonedDateTime ny =
    seoul.withZoneSameInstant(ZoneId.of("America/New_York"));

// 사용 가능한 ZoneId
Set<String> zoneIds = ZoneId.getAvailableZoneIds();
```

시간대를 포함한 시점 계산은 다음과 같이 시각화할 수 있다.

```
서울 14:30 (+09:00)
    │ 같은 순간 (Instant)
    ▼
뉴욕 00:30 (-05:00)
    │ 같은 순간
    ▼
UTC  05:30 (±00:00)
```

```java
// ZoneOffset: UTC 기준 고정 오프셋
ZoneOffset offset = ZoneOffset.of("+09:00");
OffsetDateTime odt = OffsetDateTime.now(offset);

// ZoneId: 지역 기반 (DST 자동 처리)
ZoneId zoneId = ZoneId.of("Asia/Seoul");
ZonedDateTime zdt = ZonedDateTime.now(zoneId);
```

{{< callout type="info" >}}
**`OffsetDateTime` vs `ZonedDateTime`**
- `OffsetDateTime`: 고정 오프셋(`+09:00`). 서버 간 통신, DB 저장에 적합
- `ZonedDateTime`: 지역 기반(`Asia/Seoul`). 일광절약시간(DST)을 자동으로 처리
{{< /callout >}}

### 3.7 Instant (타임스탬프)

`Instant`는 **UTC 기준 epoch(1970-01-01T00:00:00Z)로부터의 시점**을 초/나노초 단위로 표현한다. 시간대가 없는 절대 시각이라 서버 간 교환에 이상적이다.

```java
Instant now = Instant.now();
Instant epoch = Instant.EPOCH;
Instant specific = Instant.ofEpochSecond(1000000000);

long epochSecond = now.getEpochSecond();
int nano = now.getNano();
long epochMilli = now.toEpochMilli();  // DB 타임스탬프 호환

// Date 상호 변환
Date date = Date.from(now);
Instant fromDate = date.toInstant();

// LocalDateTime 상호 변환 (시간대 필요!)
LocalDateTime ldt =
    LocalDateTime.ofInstant(now, ZoneId.systemDefault());
Instant fromLdt = ldt.toInstant(ZoneOffset.of("+09:00"));
```

### 3.8 Period와 Duration

**Period** — 날짜 단위 간격 (년/월/일)

```java
Period p1 = Period.of(1, 2, 3);  // 1년 2개월 3일
Period p2 = Period.ofDays(30);
Period p3 = Period.ofMonths(6);
Period p4 = Period.ofYears(2);

LocalDate date1 = LocalDate.of(2024, 1, 1);
LocalDate date2 = LocalDate.of(2025, 3, 15);
Period diff = Period.between(date1, date2);
System.out.println(
    diff.getYears() + "년 " +
    diff.getMonths() + "개월 " +
    diff.getDays() + "일");  // 1년 2개월 14일

LocalDate future = LocalDate.now().plus(p1);
```

**Duration** — 시간 단위 간격 (초/나노초)

```java
Duration d1 = Duration.ofHours(2);
Duration d2 = Duration.ofMinutes(30);
Duration d3 = Duration.ofSeconds(45);

LocalTime t1 = LocalTime.of(9, 0);
LocalTime t2 = LocalTime.of(17, 30);
Duration diff = Duration.between(t1, t2);
System.out.println(
    diff.toHours() + "시간 " +
    diff.toMinutesPart() + "분");  // 8시간 30분

LocalTime later = LocalTime.now().plus(d1);
```

| 특징 | `Period` | `Duration` |
|:-----|:---------|:-----------|
| 단위 | 년, 월, 일 | 초, 나노초 |
| 대상 | `LocalDate` | `LocalTime`, `LocalDateTime`, `Instant` |
| 예시 | 1년 2개월 3일 | 3600초 (1시간) |

### 3.9 날짜/시간 비교

```java
LocalDate d1 = LocalDate.of(2024, 1, 15);
LocalDate d2 = LocalDate.of(2024, 6, 20);

int result = d1.compareTo(d2);      // 음수
boolean isBefore = d1.isBefore(d2); // true
boolean isAfter = d1.isAfter(d2);   // false
boolean isEqual = d1.isEqual(d2);   // false
```

---

## 4. TemporalAdjusters

자주 사용되는 날짜 계산을 미리 정의해둔 유틸리티이다.

```java
LocalDate today = LocalDate.now();

// 이번 달 관련
LocalDate firstDay =
    today.with(TemporalAdjusters.firstDayOfMonth());
LocalDate lastDay =
    today.with(TemporalAdjusters.lastDayOfMonth());

// 다음 달/해
LocalDate firstOfNextMonth =
    today.with(TemporalAdjusters.firstDayOfNextMonth());
LocalDate firstOfNextYear =
    today.with(TemporalAdjusters.firstDayOfNextYear());

// 요일 관련
LocalDate nextMon =
    today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
LocalDate prevFri =
    today.with(TemporalAdjusters.previous(DayOfWeek.FRIDAY));

// n번째 요일
LocalDate thirdFriday = today.with(
    TemporalAdjusters.dayOfWeekInMonth(3, DayOfWeek.FRIDAY));
```

**주요 메서드**

| 메서드 | 설명 |
|:-------|:-----|
| `firstDayOfMonth()` | 이번 달 첫 날 |
| `lastDayOfMonth()` | 이번 달 마지막 날 |
| `firstDayOfNextMonth()` | 다음 달 첫 날 |
| `firstDayOfYear()` | 올해 첫 날 |
| `lastDayOfYear()` | 올해 마지막 날 |
| `next(DayOfWeek)` | 다음 ?요일 (당일 미포함) |
| `nextOrSame(DayOfWeek)` | 다음 ?요일 (당일 포함) |
| `previous(DayOfWeek)` | 지난 ?요일 (당일 미포함) |
| `firstInMonth(DayOfWeek)` | 이번 달 첫 번째 ?요일 |
| `lastInMonth(DayOfWeek)` | 이번 달 마지막 ?요일 |
| `dayOfWeekInMonth(n, DayOfWeek)` | 이번 달 n번째 ?요일 |

---

## 5. DateTimeFormatter

`java.time`의 불변·thread-safe 포맷터이다. `SimpleDateFormat`을 완전히 대체한다.

### 5.1 미리 정의된 포맷터

```java
LocalDateTime now = LocalDateTime.now();

System.out.println(
    now.format(DateTimeFormatter.ISO_LOCAL_DATE));
// 2024-01-15
System.out.println(
    now.format(DateTimeFormatter.ISO_LOCAL_TIME));
// 14:30:45.123
System.out.println(
    now.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
// 2024-01-15T14:30:45.123
System.out.println(
    now.format(DateTimeFormatter.BASIC_ISO_DATE));
// 20240115
```

### 5.2 커스텀 포맷터

```java
DateTimeFormatter f1 =
    DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
DateTimeFormatter f2 =
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
DateTimeFormatter f3 =
    DateTimeFormatter.ofPattern("yy/M/d a h:mm");

LocalDateTime now = LocalDateTime.now();
System.out.println(now.format(f1));  // 2024년 01월 15일
System.out.println(now.format(f2));  // 2024-01-15 14:30:45
System.out.println(now.format(f3));  // 24/1/15 오후 2:30
```

**DateTimeFormatter 패턴 기호**

| 기호 | 의미 | 예시 |
|:-----|:-----|:-----|
| `y` | 년도 | 2024, 24 |
| `M` | 월 | 1, 01, Jan, January |
| `d` | 일 | 5, 05 |
| `E` | 요일 | 월, Mon |
| `a` | 오전/오후 | AM, PM |
| `H` | 시 (0~23) | 0~23 |
| `h` | 시 (1~12) | 1~12 |
| `m` | 분 | 0~59 |
| `s` | 초 | 0~59 |
| `S` | 밀리초 | 0~999 |
| `n` | 나노초 | 0~999999999 |
| `V` | 타임존 ID | Asia/Seoul |
| `z` | 타임존 이름 | KST |
| `Z` | 오프셋 | +0900 |

### 5.3 로케일 기반 포맷터

```java
DateTimeFormatter ko = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL)
    .withLocale(Locale.KOREA);

DateTimeFormatter us = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL)
    .withLocale(Locale.US);

LocalDate today = LocalDate.now();
System.out.println(today.format(ko));
// 2024년 1월 15일 월요일
System.out.println(today.format(us));
// Monday, January 15, 2024
```

| FormatStyle | 한국어 예시 |
|:------------|:-----------|
| `FULL` | 2024년 1월 15일 월요일 |
| `LONG` | 2024년 1월 15일 |
| `MEDIUM` | 2024. 1. 15. |
| `SHORT` | 24. 1. 15. |

### 5.4 문자열 파싱

```java
LocalDate d1 = LocalDate.parse("2024-01-15");
LocalTime t1 = LocalTime.parse("14:30:45");
LocalDateTime dt1 =
    LocalDateTime.parse("2024-01-15T14:30:45");

DateTimeFormatter f =
    DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
LocalDate d2 = LocalDate.parse("2024년 01월 15일", f);

// 파싱 실패 시 DateTimeParseException
try {
    LocalDate bad = LocalDate.parse("2024-13-45");
} catch (DateTimeParseException e) {
    System.out.println("파싱 실패: " + e.getMessage());
}
```

---

## 6. 실전 활용 예제

### 6.1 나이 계산

```java
public int calculateAge(LocalDate birthDate) {
    return Period.between(birthDate, LocalDate.now())
                 .getYears();
}

LocalDate birthday = LocalDate.of(1990, 5, 15);
int age = calculateAge(birthday);
```

### 6.2 D-Day 계산

```java
public long getDDay(LocalDate target) {
    return ChronoUnit.DAYS.between(
        LocalDate.now(), target);
}

long dDay = getDDay(LocalDate.of(2024, 12, 25));
System.out.println("D-" + dDay);
```

### 6.3 근무 시간 계산

```java
public Duration workHours(LocalTime start,
                          LocalTime end,
                          Duration lunch) {
    return Duration.between(start, end).minus(lunch);
}

Duration worked = workHours(
    LocalTime.of(9, 0),
    LocalTime.of(18, 0),
    Duration.ofHours(1));
System.out.println(worked.toHours() + "시간");  // 8시간
```

### 6.4 특정 요일까지 남은 일수

```java
public long daysUntil(DayOfWeek target) {
    LocalDate today = LocalDate.now();
    LocalDate next = today.with(
        TemporalAdjusters.nextOrSame(target));
    return ChronoUnit.DAYS.between(today, next);
}
```

### 6.5 시간대 변환

```java
public ZonedDateTime convert(ZonedDateTime src,
                             String targetZone) {
    return src.withZoneSameInstant(ZoneId.of(targetZone));
}

ZonedDateTime seoul =
    ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
ZonedDateTime ny = convert(seoul, "America/New_York");
```

---

## 7. 핵심 정리

### 레거시 vs 신규 API

| 항목 | `Calendar`/`Date` | `java.time` |
|:-----|:------------------|:------------|
| 불변성 | 가변 | 불변 (thread-safe) |
| 월 표현 | 0~11 | 1~12 |
| 타입 안전성 | 낮음 | 높음 (별도 클래스) |
| API 명확성 | 혼란스러움 | 명확함 |
| 포맷터 | `SimpleDateFormat` (unsafe) | `DateTimeFormatter` (safe) |

### 클래스 선택 가이드

| 상황 | 추천 클래스 |
|:-----|:-----------|
| 날짜만 필요 | `LocalDate` |
| 시간만 필요 | `LocalTime` |
| 날짜 + 시간 | `LocalDateTime` |
| 시간대 포함 | `ZonedDateTime` |
| 서버 간 교환 / DB | `Instant`, `OffsetDateTime` |
| 날짜 간격 | `Period` |
| 시간 간격 | `Duration` |
| 형식화/파싱 | `DateTimeFormatter` |

{{< callout type="info" >}}
**핵심 포인트**
- 신규 프로젝트에서는 `java.time` 패키지만 사용한다
- 모든 `java.time` 클래스는 **불변** — 연산 결과는 새 객체다
- 월은 **1부터 시작** (`Calendar`와 다름)
- 문자열 변환은 `DateTimeFormatter`를 사용한다
- 복잡한 날짜 계산은 `TemporalAdjusters`로 표현력을 높인다
{{< /callout >}}
