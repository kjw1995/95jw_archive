---
title: "날짜와 시간 & 형식화"
weight: 5
---

# 날짜와 시간 & 형식화

Java에서 날짜와 시간을 다루는 방법은 JDK 버전에 따라 발전해왔다. JDK 1.0의 Date, JDK 1.1의 Calendar를 거쳐, JDK 1.8부터는 java.time 패키지가 추가되어 더 나은 API를 제공한다.

---

## 1. Calendar와 Date (레거시 API)

### 1.1 Date 클래스의 역사

| JDK 버전 | 클래스 | 특징 |
|----------|--------|------|
| JDK 1.0 | Date | 최초의 날짜/시간 클래스, 기능 부족 |
| JDK 1.1 | Calendar | Date 보완, 하지만 여전히 문제점 존재 |
| JDK 1.8 | java.time | 기존 단점 해소, 불변 객체, 명확한 API |

{{< callout type="warning" >}}
**Date와 Calendar의 문제점:**
- Date의 대부분 메서드가 deprecated
- 월(Month)이 0부터 시작 (0 = 1월)
- 가변 객체로 thread-safe하지 않음
- 날짜/시간 연산이 복잡함

**권장사항:** 신규 프로젝트에서는 java.time 패키지 사용
{{< /callout >}}

### 1.2 Calendar와 GregorianCalendar

Calendar는 추상클래스이므로 직접 인스턴스를 생성할 수 없다.

```java
// Calendar cal = new Calendar();  // 컴파일 에러! 추상클래스

// getInstance()로 인스턴스 생성
Calendar cal = Calendar.getInstance();
```

**getInstance()의 동작:**
- 시스템 국가/지역 설정 확인
- 태국: BuddhistCalendar 반환
- 그 외: GregorianCalendar 반환 (그레고리력)

```java
// GregorianCalendar 직접 생성도 가능
Calendar cal = new GregorianCalendar();
Calendar cal2 = new GregorianCalendar(2024, 0, 15);  // 2024년 1월 15일 (월은 0부터!)
Calendar cal3 = new GregorianCalendar(2024, 0, 15, 14, 30, 0);  // + 14:30:00
```

### 1.3 Calendar 필드 상수

```java
Calendar cal = Calendar.getInstance();

// 날짜 관련 필드
int year = cal.get(Calendar.YEAR);           // 년도: 2024
int month = cal.get(Calendar.MONTH);         // 월(0~11): 0 = 1월
int date = cal.get(Calendar.DATE);           // 일(1~31)
int dayOfMonth = cal.get(Calendar.DAY_OF_MONTH);  // DATE와 동일
int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);    // 요일(1~7): 1 = 일요일
int dayOfYear = cal.get(Calendar.DAY_OF_YEAR);    // 년의 몇 번째 일(1~366)
int weekOfYear = cal.get(Calendar.WEEK_OF_YEAR);  // 년의 몇 번째 주(1~53)
int weekOfMonth = cal.get(Calendar.WEEK_OF_MONTH);// 월의 몇 번째 주(1~5)

// 시간 관련 필드
int amPm = cal.get(Calendar.AM_PM);          // 오전/오후(0:오전, 1:오후)
int hour = cal.get(Calendar.HOUR);           // 시간(0~11)
int hourOfDay = cal.get(Calendar.HOUR_OF_DAY); // 시간(0~23)
int minute = cal.get(Calendar.MINUTE);       // 분(0~59)
int second = cal.get(Calendar.SECOND);       // 초(0~59)
int millis = cal.get(Calendar.MILLISECOND);  // 밀리초(0~999)

// 시간대
int zoneOffset = cal.get(Calendar.ZONE_OFFSET) / (60 * 60 * 1000);  // UTC 기준 시차

// 이 달의 마지막 날
int lastDay = cal.getActualMaximum(Calendar.DATE);
```

{{< callout type="info" >}}
**주의:** `Calendar.MONTH`는 0부터 시작한다!
- 0 = 1월, 1 = 2월, ... 11 = 12월
- `Calendar.JANUARY`(0) ~ `Calendar.DECEMBER`(11) 상수 사용 권장
{{< /callout >}}

### 1.4 날짜/시간 설정과 변경

```java
Calendar cal = Calendar.getInstance();

// set(): 특정 필드 값 설정
cal.set(Calendar.YEAR, 2024);
cal.set(Calendar.MONTH, 5);      // 6월 (0부터 시작!)
cal.set(Calendar.DATE, 15);

// 한 번에 설정
cal.set(2024, 5, 15);            // 년, 월, 일
cal.set(2024, 5, 15, 14, 30);    // 년, 월, 일, 시, 분
cal.set(2024, 5, 15, 14, 30, 0); // 년, 월, 일, 시, 분, 초

// clear(): 필드 초기화
cal.clear();                     // 모든 필드 초기화 (1970년 1월 1일 00:00:00)
cal.clear(Calendar.HOUR_OF_DAY); // 특정 필드만 초기화
```

### 1.5 add()와 roll()

```java
Calendar cal = Calendar.getInstance();
cal.set(2024, 0, 31);  // 2024년 1월 31일

// add(): 다른 필드에 영향을 줌
cal.add(Calendar.DATE, 1);   // 2024년 2월 1일 (월 변경됨)
cal.add(Calendar.MONTH, -2); // 2023년 12월 1일 (년 변경됨)

// roll(): 다른 필드에 영향 없음
cal.set(2024, 0, 31);  // 다시 2024년 1월 31일
cal.roll(Calendar.DATE, 1);  // 2024년 1월 1일 (월 변경 안 됨!)
```

**add()와 roll() 비교:**

| 메서드 | 다른 필드 영향 | 예시 (1월 31일 + 1일) |
|--------|----------------|----------------------|
| `add()` | 영향 있음 | 2월 1일 (월 변경) |
| `roll()` | 영향 없음 | 1월 1일 (월 유지) |

### 1.6 Date와 Calendar 간 변환

```java
// Calendar → Date
Calendar cal = Calendar.getInstance();
Date date = new Date(cal.getTimeInMillis());
// 또는
Date date2 = cal.getTime();

// Date → Calendar
Date date = new Date();
Calendar cal = Calendar.getInstance();
cal.setTime(date);
```

### 1.7 두 날짜 간 차이 계산

```java
Calendar cal1 = Calendar.getInstance();
cal1.set(2024, 0, 1);  // 2024년 1월 1일

Calendar cal2 = Calendar.getInstance();
cal2.set(2024, 11, 31); // 2024년 12월 31일

// 밀리초 단위 차이
long diffMillis = cal2.getTimeInMillis() - cal1.getTimeInMillis();

// 일 단위로 변환
long diffDays = diffMillis / (24 * 60 * 60 * 1000);
System.out.println("일 수 차이: " + diffDays);

// 전후 비교
boolean isBefore = cal1.before(cal2);  // true
boolean isAfter = cal1.after(cal2);    // false
```

---

## 2. 형식화 클래스

java.text 패키지의 형식화 클래스를 사용하면 데이터를 원하는 형식으로 출력하거나, 반대로 형식화된 문자열에서 데이터를 추출할 수 있다.

### 2.1 DecimalFormat (숫자 형식화)

```java
// 패턴 기호
// 0: 숫자 (없으면 0으로 채움)
// #: 숫자 (없으면 생략)
// .: 소수점
// ,: 그룹 구분자
// %: 백분율
// E: 지수

double num = 1234567.89;

DecimalFormat df1 = new DecimalFormat("#,###.##");
System.out.println(df1.format(num));  // 1,234,567.89

DecimalFormat df2 = new DecimalFormat("0000000000.0000");
System.out.println(df2.format(num));  // 0001234567.8900

DecimalFormat df3 = new DecimalFormat("#.###E0");
System.out.println(df3.format(num));  // 1.235E6

// 백분율
double rate = 0.756;
DecimalFormat df4 = new DecimalFormat("##.#%");
System.out.println(df4.format(rate));  // 75.6%

// 문자열 → 숫자 파싱
DecimalFormat df = new DecimalFormat("#,###.##");
try {
    Number parsed = df.parse("1,234,567.89");
    double value = parsed.doubleValue();
} catch (ParseException e) {
    e.printStackTrace();
}
```

**주요 패턴 기호:**

| 기호 | 의미 | 예시 패턴 | 1234.5 적용 결과 |
|------|------|-----------|------------------|
| `0` | 숫자 (0으로 채움) | `00000.00` | `01234.50` |
| `#` | 숫자 (생략 가능) | `#####.##` | `1234.5` |
| `.` | 소수점 | `#.#` | `1234.5` |
| `,` | 그룹 구분자 | `#,###` | `1,235` |
| `%` | 백분율 | `#%` | `123450%` |
| `E` | 지수 | `#.##E0` | `1.23E3` |

### 2.2 SimpleDateFormat (날짜 형식화)

```java
Date now = new Date();

// 날짜 → 문자열
SimpleDateFormat sdf1 = new SimpleDateFormat("yyyy-MM-dd");
System.out.println(sdf1.format(now));  // 2024-01-15

SimpleDateFormat sdf2 = new SimpleDateFormat("yyyy년 MM월 dd일 E요일");
System.out.println(sdf2.format(now));  // 2024년 01월 15일 월요일

SimpleDateFormat sdf3 = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
System.out.println(sdf3.format(now));  // 2024-01-15 14:30:45

SimpleDateFormat sdf4 = new SimpleDateFormat("yyyy-MM-dd a hh:mm:ss");
System.out.println(sdf4.format(now));  // 2024-01-15 오후 02:30:45

// 문자열 → 날짜 파싱
SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
try {
    Date date = sdf.parse("2024-01-15");
    System.out.println(date);
} catch (ParseException e) {
    e.printStackTrace();
}
```

**SimpleDateFormat 패턴 기호:**

| 기호 | 의미 | 예시 |
|------|------|------|
| `G` | 연대 (BC, AD) | AD |
| `y` | 년도 | 2024 |
| `M` | 월 (1~12) | 01, 1월 |
| `d` | 일 (1~31) | 15 |
| `E` | 요일 | 월, Mon |
| `a` | 오전/오후 | AM, PM |
| `H` | 시간 (0~23) | 14 |
| `h` | 시간 (1~12) | 02 |
| `m` | 분 (0~59) | 30 |
| `s` | 초 (0~59) | 45 |
| `S` | 밀리초 (0~999) | 123 |
| `z` | 타임존 | KST, GMT+9:00 |
| `Z` | 타임존 (RFC 822) | +0900 |

### 2.3 MessageFormat (메시지 형식화)

```java
// 기본 사용법
String pattern = "오늘은 {0}년 {1}월 {2}일입니다.";
String result = MessageFormat.format(pattern, 2024, 1, 15);
System.out.println(result);  // 오늘은 2024년 1월 15일입니다.

// 배열 사용
Object[] args = {"홍길동", 25, "서울"};
String pattern2 = "이름: {0}, 나이: {1}, 주소: {2}";
String result2 = MessageFormat.format(pattern2, args);
System.out.println(result2);  // 이름: 홍길동, 나이: 25, 주소: 서울

// 형식 지정
String pattern3 = "금액: {0,number,#,###}원, 날짜: {1,date,yyyy-MM-dd}";
Object[] args3 = {1000000, new Date()};
String result3 = MessageFormat.format(pattern3, args3);
System.out.println(result3);  // 금액: 1,000,000원, 날짜: 2024-01-15
```

### 2.4 ChoiceFormat (범위 형식화)

```java
// 점수에 따른 등급 변환
double[] limits = {0, 60, 70, 80, 90};  // 경계값
String[] grades = {"F", "D", "C", "B", "A"};  // 대응 문자열

ChoiceFormat cf = new ChoiceFormat(limits, grades);

int[] scores = {95, 82, 75, 63, 45};
for (int score : scores) {
    System.out.println(score + " → " + cf.format(score));
}
// 출력:
// 95 → A
// 82 → B
// 75 → C
// 63 → D
// 45 → F

// 패턴 문자열 사용
String pattern = "0#F|60#D|70#C|80#B|90#A";
ChoiceFormat cf2 = new ChoiceFormat(pattern);
```

---

## 3. java.time 패키지 (JDK 1.8+)

JDK 1.8에서 추가된 java.time 패키지는 기존 Date/Calendar의 문제점을 해결한 새로운 날짜/시간 API이다.

### 3.1 패키지 구조

| 패키지 | 설명 |
|--------|------|
| `java.time` | 핵심 클래스 (LocalDate, LocalTime, LocalDateTime 등) |
| `java.time.chrono` | 표준(ISO) 외 달력 시스템 |
| `java.time.format` | 형식화/파싱 (DateTimeFormatter) |
| `java.time.temporal` | 필드/단위 (ChronoField, ChronoUnit) |
| `java.time.zone` | 시간대 관련 (ZoneId, ZoneOffset) |

### 3.2 핵심 클래스 관계

```
LocalDate (날짜)  +  LocalTime (시간)  =  LocalDateTime (날짜 + 시간)
                                               +
                                            ZoneId (시간대)
                                               =
                                        ZonedDateTime (날짜 + 시간 + 시간대)
```

| 클래스 | 설명 | 예시 |
|--------|------|------|
| `LocalDate` | 날짜만 | 2024-01-15 |
| `LocalTime` | 시간만 | 14:30:45.123 |
| `LocalDateTime` | 날짜 + 시간 | 2024-01-15T14:30:45.123 |
| `ZonedDateTime` | 날짜 + 시간 + 시간대 | 2024-01-15T14:30:45.123+09:00[Asia/Seoul] |
| `Instant` | 타임스탬프 (epoch 기준) | 1970-01-01T00:00:00Z부터의 초 |
| `Period` | 날짜 간격 | 1년 2개월 3일 |
| `Duration` | 시간 간격 | 2시간 30분 |

### 3.3 LocalDate

```java
// 생성
LocalDate today = LocalDate.now();              // 오늘
LocalDate date1 = LocalDate.of(2024, 1, 15);    // 지정 날짜
LocalDate date2 = LocalDate.of(2024, Month.JANUARY, 15);  // Month enum 사용
LocalDate date3 = LocalDate.parse("2024-01-15"); // 문자열 파싱

// 필드 조회
int year = today.getYear();           // 2024
int month = today.getMonthValue();    // 1 (1~12, 0부터 아님!)
Month monthEnum = today.getMonth();   // JANUARY
int dayOfMonth = today.getDayOfMonth(); // 15
DayOfWeek dayOfWeek = today.getDayOfWeek(); // MONDAY
int dayOfYear = today.getDayOfYear(); // 15

// 유용한 메서드
int lengthOfMonth = today.lengthOfMonth();  // 이 달의 일 수
int lengthOfYear = today.lengthOfYear();    // 이 해의 일 수
boolean isLeapYear = today.isLeapYear();    // 윤년 여부

// 날짜 연산 (불변! 새 객체 반환)
LocalDate tomorrow = today.plusDays(1);
LocalDate nextMonth = today.plusMonths(1);
LocalDate lastYear = today.minusYears(1);
LocalDate specific = today.withMonth(6).withDayOfMonth(1);  // 이 해 6월 1일
```

### 3.4 LocalTime

```java
// 생성
LocalTime now = LocalTime.now();                // 현재 시간
LocalTime time1 = LocalTime.of(14, 30);         // 14:30
LocalTime time2 = LocalTime.of(14, 30, 45);     // 14:30:45
LocalTime time3 = LocalTime.of(14, 30, 45, 123456789); // 나노초까지
LocalTime time4 = LocalTime.parse("14:30:45");  // 문자열 파싱

// 필드 조회
int hour = now.getHour();       // 0~23
int minute = now.getMinute();   // 0~59
int second = now.getSecond();   // 0~59
int nano = now.getNano();       // 0~999999999

// 시간 연산 (불변! 새 객체 반환)
LocalTime later = now.plusHours(2);
LocalTime earlier = now.minusMinutes(30);
LocalTime specific = now.withHour(9).withMinute(0);  // 오전 9시 정각

// 특정 단위 이하 버림
LocalTime truncated = now.truncatedTo(ChronoUnit.MINUTES);  // 초 이하 버림
```

### 3.5 LocalDateTime

```java
// 생성
LocalDateTime now = LocalDateTime.now();
LocalDateTime dt1 = LocalDateTime.of(2024, 1, 15, 14, 30);
LocalDateTime dt2 = LocalDateTime.of(2024, 1, 15, 14, 30, 45);
LocalDateTime dt3 = LocalDateTime.parse("2024-01-15T14:30:45");

// LocalDate + LocalTime 조합
LocalDate date = LocalDate.of(2024, 1, 15);
LocalTime time = LocalTime.of(14, 30);
LocalDateTime dt4 = LocalDateTime.of(date, time);
LocalDateTime dt5 = date.atTime(time);
LocalDateTime dt6 = date.atTime(14, 30);
LocalDateTime dt7 = time.atDate(date);
LocalDateTime dt8 = date.atStartOfDay();  // 00:00:00

// 분리
LocalDate dateOnly = now.toLocalDate();
LocalTime timeOnly = now.toLocalTime();

// 연산
LocalDateTime future = now.plusDays(7).plusHours(3);
```

### 3.6 ZonedDateTime과 시간대

```java
// 현재 시간대로 생성
ZonedDateTime zdt1 = ZonedDateTime.now();
ZonedDateTime zdt2 = ZonedDateTime.now(ZoneId.of("America/New_York"));

// LocalDateTime에 시간대 추가
LocalDateTime ldt = LocalDateTime.now();
ZonedDateTime zdt3 = ldt.atZone(ZoneId.of("Asia/Seoul"));
ZonedDateTime zdt4 = ldt.atZone(ZoneId.systemDefault());

// 다른 시간대로 변환
ZonedDateTime seoulTime = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
ZonedDateTime nyTime = seoulTime.withZoneSameInstant(ZoneId.of("America/New_York"));
System.out.println("서울: " + seoulTime);  // 2024-01-15T14:30+09:00[Asia/Seoul]
System.out.println("뉴욕: " + nyTime);     // 2024-01-15T00:30-05:00[America/New_York]

// 사용 가능한 ZoneId 확인
Set<String> zoneIds = ZoneId.getAvailableZoneIds();
```

**ZoneOffset vs ZoneId:**

```java
// ZoneOffset: UTC 기준 고정 오프셋
ZoneOffset offset = ZoneOffset.of("+09:00");
OffsetDateTime odt = OffsetDateTime.now(offset);

// ZoneId: 지역 기반 (일광절약시간 자동 처리)
ZoneId zoneId = ZoneId.of("Asia/Seoul");
ZonedDateTime zdt = ZonedDateTime.now(zoneId);
```

{{< callout type="info" >}}
**OffsetDateTime vs ZonedDateTime**
- `OffsetDateTime`: 고정 오프셋 (+09:00), 서버 간 통신에 적합
- `ZonedDateTime`: 지역 기반 (Asia/Seoul), 일광절약시간 자동 처리
{{< /callout >}}

### 3.7 Instant (타임스탬프)

```java
// 생성
Instant now = Instant.now();  // UTC 기준 현재 시각
Instant epoch = Instant.EPOCH;  // 1970-01-01T00:00:00Z
Instant specific = Instant.ofEpochSecond(1000000000);

// 필드 조회
long epochSecond = now.getEpochSecond();  // 1970년 이후 초
int nano = now.getNano();  // 나노초 부분

// 밀리초 단위 (DB 타임스탬프와 호환)
long epochMilli = now.toEpochMilli();

// Date와 변환
Date date = Date.from(now);
Instant fromDate = date.toInstant();

// LocalDateTime과 변환 (시간대 필요)
LocalDateTime ldt = LocalDateTime.ofInstant(now, ZoneId.systemDefault());
Instant fromLdt = ldt.toInstant(ZoneOffset.of("+09:00"));
```

### 3.8 Period와 Duration

**Period (날짜 간격):**

```java
// 생성
Period period1 = Period.of(1, 2, 3);  // 1년 2개월 3일
Period period2 = Period.ofDays(30);
Period period3 = Period.ofMonths(6);
Period period4 = Period.ofYears(2);

// 두 날짜 간 차이
LocalDate date1 = LocalDate.of(2024, 1, 1);
LocalDate date2 = LocalDate.of(2025, 3, 15);
Period diff = Period.between(date1, date2);
System.out.println(diff.getYears() + "년 " +
                   diff.getMonths() + "개월 " +
                   diff.getDays() + "일");  // 1년 2개월 14일

// 날짜 연산에 사용
LocalDate future = LocalDate.now().plus(period1);
```

**Duration (시간 간격):**

```java
// 생성
Duration d1 = Duration.ofHours(2);
Duration d2 = Duration.ofMinutes(30);
Duration d3 = Duration.ofSeconds(45);
Duration d4 = Duration.of(100, ChronoUnit.MILLIS);  // 100밀리초

// 두 시간 간 차이
LocalTime time1 = LocalTime.of(9, 0);
LocalTime time2 = LocalTime.of(17, 30);
Duration diff = Duration.between(time1, time2);
System.out.println(diff.toHours() + "시간 " +
                   diff.toMinutesPart() + "분");  // 8시간 30분

// LocalDateTime 간 차이
LocalDateTime dt1 = LocalDateTime.of(2024, 1, 1, 9, 0);
LocalDateTime dt2 = LocalDateTime.of(2024, 1, 2, 18, 30);
Duration diff2 = Duration.between(dt1, dt2);
System.out.println(diff2.toHours() + "시간");  // 33시간

// 시간 연산에 사용
LocalTime later = LocalTime.now().plus(d1);
```

**Period vs Duration:**

| 특징 | Period | Duration |
|------|--------|----------|
| 단위 | 년, 월, 일 | 초, 나노초 |
| 대상 | LocalDate | LocalTime, LocalDateTime, Instant |
| 예시 | 1년 2개월 3일 | 3600초 (1시간) |

### 3.9 날짜/시간 비교

```java
LocalDate date1 = LocalDate.of(2024, 1, 15);
LocalDate date2 = LocalDate.of(2024, 6, 20);

// compareTo
int result = date1.compareTo(date2);  // 음수 (date1 < date2)

// 편의 메서드
boolean isBefore = date1.isBefore(date2);  // true
boolean isAfter = date1.isAfter(date2);    // false
boolean isEqual = date1.isEqual(date2);    // false

// LocalDateTime, LocalTime도 동일한 메서드 제공
```

---

## 4. TemporalAdjusters

자주 사용되는 날짜 계산을 미리 정의해둔 클래스이다.

```java
LocalDate today = LocalDate.now();

// 이번 달 관련
LocalDate firstDayOfMonth = today.with(TemporalAdjusters.firstDayOfMonth());
LocalDate lastDayOfMonth = today.with(TemporalAdjusters.lastDayOfMonth());

// 다음 달/해 관련
LocalDate firstDayOfNextMonth = today.with(TemporalAdjusters.firstDayOfNextMonth());
LocalDate firstDayOfNextYear = today.with(TemporalAdjusters.firstDayOfNextYear());

// 요일 관련
LocalDate nextMonday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
LocalDate nextOrSameMonday = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
LocalDate prevFriday = today.with(TemporalAdjusters.previous(DayOfWeek.FRIDAY));

// n번째 요일
LocalDate firstMondayOfMonth = today.with(
    TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
LocalDate thirdFridayOfMonth = today.with(
    TemporalAdjusters.dayOfWeekInMonth(3, DayOfWeek.FRIDAY));
```

**TemporalAdjusters 주요 메서드:**

| 메서드 | 설명 |
|--------|------|
| `firstDayOfMonth()` | 이번 달의 첫 날 |
| `lastDayOfMonth()` | 이번 달의 마지막 날 |
| `firstDayOfNextMonth()` | 다음 달의 첫 날 |
| `firstDayOfYear()` | 올해의 첫 날 |
| `lastDayOfYear()` | 올해의 마지막 날 |
| `next(DayOfWeek)` | 다음 ?요일 (당일 미포함) |
| `nextOrSame(DayOfWeek)` | 다음 ?요일 (당일 포함) |
| `previous(DayOfWeek)` | 지난 ?요일 (당일 미포함) |
| `previousOrSame(DayOfWeek)` | 지난 ?요일 (당일 포함) |
| `firstInMonth(DayOfWeek)` | 이번 달 첫 번째 ?요일 |
| `lastInMonth(DayOfWeek)` | 이번 달 마지막 ?요일 |
| `dayOfWeekInMonth(n, DayOfWeek)` | 이번 달 n번째 ?요일 |

---

## 5. DateTimeFormatter (파싱과 형식화)

### 5.1 미리 정의된 포맷터

```java
LocalDateTime now = LocalDateTime.now();

// ISO 형식
System.out.println(now.format(DateTimeFormatter.ISO_LOCAL_DATE));       // 2024-01-15
System.out.println(now.format(DateTimeFormatter.ISO_LOCAL_TIME));       // 14:30:45.123
System.out.println(now.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));  // 2024-01-15T14:30:45.123

// 기본 ISO
System.out.println(now.format(DateTimeFormatter.BASIC_ISO_DATE));  // 20240115
```

### 5.2 커스텀 포맷터

```java
// ofPattern() 사용
DateTimeFormatter formatter1 = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
DateTimeFormatter formatter2 = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
DateTimeFormatter formatter3 = DateTimeFormatter.ofPattern("yy/M/d a h:mm");

LocalDateTime now = LocalDateTime.now();
System.out.println(now.format(formatter1));  // 2024년 01월 15일
System.out.println(now.format(formatter2));  // 2024-01-15 14:30:45
System.out.println(now.format(formatter3));  // 24/1/15 오후 2:30
```

**DateTimeFormatter 패턴 기호:**

| 기호 | 의미 | 예시 |
|------|------|------|
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
// 로케일에 맞는 포맷
DateTimeFormatter koFormatter = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL)
    .withLocale(Locale.KOREA);

DateTimeFormatter usFormatter = DateTimeFormatter
    .ofLocalizedDate(FormatStyle.FULL)
    .withLocale(Locale.US);

LocalDate today = LocalDate.now();
System.out.println(today.format(koFormatter));  // 2024년 1월 15일 월요일
System.out.println(today.format(usFormatter));  // Monday, January 15, 2024
```

**FormatStyle 종류:**

| FormatStyle | 한국어 예시 |
|-------------|-------------|
| `FULL` | 2024년 1월 15일 월요일 |
| `LONG` | 2024년 1월 15일 |
| `MEDIUM` | 2024. 1. 15. |
| `SHORT` | 24. 1. 15. |

### 5.4 문자열 파싱

```java
// 기본 ISO 형식 파싱
LocalDate date1 = LocalDate.parse("2024-01-15");
LocalTime time1 = LocalTime.parse("14:30:45");
LocalDateTime dt1 = LocalDateTime.parse("2024-01-15T14:30:45");

// 커스텀 포맷으로 파싱
DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
LocalDate date2 = LocalDate.parse("2024년 01월 15일", formatter);

DateTimeFormatter formatter2 = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm");
LocalDateTime dt2 = LocalDateTime.parse("2024/01/15 14:30", formatter2);

// 파싱 실패 시 DateTimeParseException 발생
try {
    LocalDate date = LocalDate.parse("2024-13-45");  // 잘못된 날짜
} catch (DateTimeParseException e) {
    System.out.println("파싱 실패: " + e.getMessage());
}
```

---

## 6. 실전 활용 예제

### 6.1 나이 계산

```java
public int calculateAge(LocalDate birthDate) {
    return Period.between(birthDate, LocalDate.now()).getYears();
}

// 사용
LocalDate birthday = LocalDate.of(1990, 5, 15);
int age = calculateAge(birthday);
System.out.println("나이: " + age + "세");
```

### 6.2 D-Day 계산

```java
public long getDDay(LocalDate targetDate) {
    return ChronoUnit.DAYS.between(LocalDate.now(), targetDate);
}

// 사용
LocalDate eventDate = LocalDate.of(2024, 12, 25);
long dDay = getDDay(eventDate);
System.out.println("D-" + dDay);
```

### 6.3 근무 시간 계산

```java
public Duration calculateWorkHours(LocalTime startTime, LocalTime endTime,
                                   Duration lunchBreak) {
    Duration workTime = Duration.between(startTime, endTime);
    return workTime.minus(lunchBreak);
}

// 사용
LocalTime start = LocalTime.of(9, 0);
LocalTime end = LocalTime.of(18, 0);
Duration lunch = Duration.ofHours(1);

Duration worked = calculateWorkHours(start, end, lunch);
System.out.println("근무 시간: " + worked.toHours() + "시간");  // 8시간
```

### 6.4 특정 요일까지 남은 일수

```java
public long daysUntilNextDayOfWeek(DayOfWeek targetDay) {
    LocalDate today = LocalDate.now();
    LocalDate nextTarget = today.with(TemporalAdjusters.nextOrSame(targetDay));
    return ChronoUnit.DAYS.between(today, nextTarget);
}

// 사용
long daysUntilFriday = daysUntilNextDayOfWeek(DayOfWeek.FRIDAY);
System.out.println("금요일까지 " + daysUntilFriday + "일");
```

### 6.5 시간대 변환

```java
public ZonedDateTime convertTimeZone(ZonedDateTime sourceTime, String targetZoneId) {
    return sourceTime.withZoneSameInstant(ZoneId.of(targetZoneId));
}

// 서울 시간을 뉴욕 시간으로 변환
ZonedDateTime seoulTime = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
ZonedDateTime nyTime = convertTimeZone(seoulTime, "America/New_York");

DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z");
System.out.println("서울: " + seoulTime.format(formatter));
System.out.println("뉴욕: " + nyTime.format(formatter));
```

---

## 7. 핵심 정리

### 레거시 vs 신규 API

| 항목 | Calendar/Date | java.time |
|------|---------------|-----------|
| 불변성 | 가변 | 불변 (thread-safe) |
| 월 표현 | 0~11 | 1~12 |
| 타입 안전성 | 낮음 | 높음 (별도 클래스) |
| null 안전성 | null 허용 | Optional 패턴 |
| API 명확성 | 혼란스러움 | 명확함 |

### 클래스 선택 가이드

| 상황 | 추천 클래스 |
|------|-------------|
| 날짜만 필요 | `LocalDate` |
| 시간만 필요 | `LocalTime` |
| 날짜+시간 필요 | `LocalDateTime` |
| 시간대 포함 필요 | `ZonedDateTime` |
| 서버 간 통신 | `Instant`, `OffsetDateTime` |
| 날짜 간격 계산 | `Period` |
| 시간 간격 계산 | `Duration` |
| 형식화/파싱 | `DateTimeFormatter` |

{{< callout type="info" >}}
**핵심 포인트:**
- 신규 프로젝트에서는 **java.time 패키지** 사용
- java.time 클래스는 **불변(immutable)** → 연산 결과는 새 객체
- 월은 **1부터 시작** (Calendar와 다름!)
- 문자열 변환은 **DateTimeFormatter** 사용
- 날짜 연산은 **TemporalAdjusters** 활용
{{< /callout >}}
