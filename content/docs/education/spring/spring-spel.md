---
title: Spring Expression Language (SpEL)
weight: 10
---

SpEL(Spring Expression Language)은 런타임에 객체 그래프를 쿼리하고 조작할 수 있는 강력한 표현 언어입니다.

## SpEL 개요

### SpEL이란?

SpEL은 Spring Framework에서 제공하는 표현 언어로, Jakarta Expression Language(EL)와 유사하지만 메서드 호출과 문자열 템플릿 기능을 추가로 제공합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      SpEL 활용 영역                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   @Value        │  │  Spring Security│  │   Bean 정의      │ │
│  │   어노테이션     │  │  @PreAuthorize  │  │   XML/Java      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                │
│                    ┌─────────────────────┐                      │
│                    │   SpEL Engine       │                      │
│                    │   - ExpressionParser│                      │
│                    │   - EvaluationContext│                     │
│                    └─────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 주요 특징

| 특징 | 설명 |
|------|------|
| **독립적 사용** | Spring 없이도 단독 사용 가능 |
| **런타임 평가** | 실행 시점에 표현식 평가 |
| **타입 안전** | 타입 변환 및 검증 지원 |
| **확장 가능** | 커스텀 함수 및 변수 등록 |

### 표현식 구문

```java
// SpEL 표현식: #{ } 사용
@Value("#{systemProperties['os.name']}")
private String osName;

// 프로퍼티 플레이스홀더: ${ } 사용
@Value("${app.name}")
private String appName;

// 혼합 사용
@Value("#{'${app.name}'.toUpperCase()}")
private String upperAppName;
```

## 핵심 아키텍처

### 주요 구성요소

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpEL 아키텍처                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Expression String                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────┐                                        │
│  │  ExpressionParser   │  표현식 문자열 파싱                      │
│  │  (SpelExpressionParser)                                      │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │    Expression       │  파싱된 표현식 객체                      │
│  │  (SpelExpression)   │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ EvaluationContext   │  평가 컨텍스트 (변수, 함수, 빈)          │
│  │(StandardEvaluationContext)                                   │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│        Result (Object)                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 기본 사용법

```java
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

public class SpelBasicExample {

    public static void main(String[] args) {
        // 1. ExpressionParser 생성
        ExpressionParser parser = new SpelExpressionParser();

        // 2. 간단한 리터럴 평가
        Expression exp = parser.parseExpression("'Hello World'");
        String message = exp.getValue(String.class);
        System.out.println(message); // "Hello World"

        // 3. 메서드 호출
        exp = parser.parseExpression("'Hello World'.concat('!')");
        message = exp.getValue(String.class);
        System.out.println(message); // "Hello World!"

        // 4. 프로퍼티 접근
        exp = parser.parseExpression("'Hello World'.bytes.length");
        int length = exp.getValue(Integer.class);
        System.out.println(length); // 11
    }
}
```

### EvaluationContext 활용

```java
public class EvaluationContextExample {

    public static void main(String[] args) {
        // 루트 객체 설정
        Person person = new Person("John", 30);

        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext(person);

        // 루트 객체의 프로퍼티 접근
        Expression exp = parser.parseExpression("name");
        String name = exp.getValue(context, String.class);
        System.out.println(name); // "John"

        // 루트 객체의 메서드 호출
        exp = parser.parseExpression("getName().toUpperCase()");
        String upperName = exp.getValue(context, String.class);
        System.out.println(upperName); // "JOHN"

        // 값 설정
        exp = parser.parseExpression("name");
        exp.setValue(context, "Jane");
        System.out.println(person.getName()); // "Jane"
    }
}

class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    // getters and setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getAge() { return age; }
    public void setAge(int age) { this.age = age; }
}
```

## 리터럴 표현식

### 지원하는 리터럴 타입

```java
ExpressionParser parser = new SpelExpressionParser();

// 문자열 (작은따옴표)
parser.parseExpression("'Hello World'").getValue(String.class);

// 숫자
parser.parseExpression("42").getValue(Integer.class);
parser.parseExpression("3.14").getValue(Double.class);
parser.parseExpression("1e4").getValue(Double.class);  // 10000.0
parser.parseExpression("0xFFFF").getValue(Integer.class);  // 16진수

// 불리언
parser.parseExpression("true").getValue(Boolean.class);
parser.parseExpression("false").getValue(Boolean.class);

// null
parser.parseExpression("null").getValue();
```

## 연산자

### 산술 연산자

```java
ExpressionParser parser = new SpelExpressionParser();

// 덧셈
parser.parseExpression("2 + 3").getValue(Integer.class);  // 5

// 뺄셈
parser.parseExpression("10 - 4").getValue(Integer.class);  // 6

// 곱셈
parser.parseExpression("3 * 4").getValue(Integer.class);  // 12

// 나눗셈
parser.parseExpression("10 / 3").getValue(Integer.class);  // 3
parser.parseExpression("10.0 / 3").getValue(Double.class);  // 3.333...

// 나머지
parser.parseExpression("10 % 3").getValue(Integer.class);  // 1

// 거듭제곱
parser.parseExpression("2 ^ 10").getValue(Integer.class);  // 1024

// 문자열 연결
parser.parseExpression("'Hello' + ' ' + 'World'").getValue(String.class);
```

### 비교 연산자

```java
// 동등 비교
parser.parseExpression("2 == 2").getValue(Boolean.class);  // true
parser.parseExpression("2 eq 2").getValue(Boolean.class);  // true (텍스트)

// 부등 비교
parser.parseExpression("2 != 3").getValue(Boolean.class);  // true
parser.parseExpression("2 ne 3").getValue(Boolean.class);  // true

// 크기 비교
parser.parseExpression("5 > 3").getValue(Boolean.class);   // true
parser.parseExpression("5 gt 3").getValue(Boolean.class);  // true

parser.parseExpression("3 < 5").getValue(Boolean.class);   // true
parser.parseExpression("3 lt 5").getValue(Boolean.class);  // true

parser.parseExpression("5 >= 5").getValue(Boolean.class);  // true
parser.parseExpression("5 ge 5").getValue(Boolean.class);  // true

parser.parseExpression("3 <= 5").getValue(Boolean.class);  // true
parser.parseExpression("3 le 5").getValue(Boolean.class);  // true

// instanceof
parser.parseExpression("'hello' instanceof T(String)").getValue(Boolean.class);  // true

// 정규표현식 매칭
parser.parseExpression("'5.00' matches '^-?\\d+(\\.\\d{2})?$'").getValue(Boolean.class);  // true
```

### 논리 연산자

```java
// AND
parser.parseExpression("true and false").getValue(Boolean.class);  // false
parser.parseExpression("true && false").getValue(Boolean.class);   // false

// OR
parser.parseExpression("true or false").getValue(Boolean.class);   // true
parser.parseExpression("true || false").getValue(Boolean.class);   // true

// NOT
parser.parseExpression("not true").getValue(Boolean.class);  // false
parser.parseExpression("!true").getValue(Boolean.class);     // false

// 복합 조건
parser.parseExpression("(2 > 1) and (3 < 5)").getValue(Boolean.class);  // true
```

### 연산자 정리

| 연산자 타입 | 기호 | 텍스트 대체 |
|------------|------|------------|
| 동등 | `==` | `eq` |
| 부등 | `!=` | `ne` |
| 작음 | `<` | `lt` |
| 작거나 같음 | `<=` | `le` |
| 큼 | `>` | `gt` |
| 크거나 같음 | `>=` | `ge` |
| AND | `&&` | `and` |
| OR | `||` | `or` |
| NOT | `!` | `not` |

## 프로퍼티와 메서드

### 프로퍼티 접근

```java
public class PropertyAccessExample {

    public static void main(String[] args) {
        Person person = new Person("John", 30);
        Address address = new Address("Seoul", "Gangnam");
        person.setAddress(address);

        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext(person);

        // 단순 프로퍼티
        String name = parser.parseExpression("name")
            .getValue(context, String.class);  // "John"

        // 중첩 프로퍼티
        String city = parser.parseExpression("address.city")
            .getValue(context, String.class);  // "Seoul"

        // 프로퍼티 설정
        parser.parseExpression("age").setValue(context, 35);
        System.out.println(person.getAge());  // 35
    }
}

class Address {
    private String city;
    private String district;

    public Address(String city, String district) {
        this.city = city;
        this.district = district;
    }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
}
```

### 메서드 호출

```java
ExpressionParser parser = new SpelExpressionParser();

// 문자열 메서드
parser.parseExpression("'hello'.toUpperCase()").getValue(String.class);  // "HELLO"
parser.parseExpression("'hello'.substring(0, 3)").getValue(String.class);  // "hel"
parser.parseExpression("'hello world'.split(' ')").getValue(String[].class);  // ["hello", "world"]

// 컨텍스트 객체의 메서드
StandardEvaluationContext context = new StandardEvaluationContext(new Person("John", 30));
parser.parseExpression("getName()").getValue(context, String.class);  // "John"
parser.parseExpression("getFullInfo('Developer')").getValue(context, String.class);

// 체이닝
parser.parseExpression("getName().toLowerCase().concat('!')").getValue(context, String.class);
```

## 타입 표현식

### T() 연산자

`T()` 연산자를 사용하여 클래스 타입에 접근합니다.

```java
ExpressionParser parser = new SpelExpressionParser();

// java.lang 패키지는 생략 가능
Class<?> stringClass = parser.parseExpression("T(String)")
    .getValue(Class.class);

// 정적 필드 접근
Double pi = parser.parseExpression("T(java.lang.Math).PI")
    .getValue(Double.class);  // 3.141592...

Double e = parser.parseExpression("T(Math).E")
    .getValue(Double.class);  // 2.718281...

// 정적 메서드 호출
Double random = parser.parseExpression("T(Math).random()")
    .getValue(Double.class);

Integer max = parser.parseExpression("T(Math).max(10, 20)")
    .getValue(Integer.class);  // 20

Double sqrt = parser.parseExpression("T(Math).sqrt(16)")
    .getValue(Double.class);  // 4.0

// 시스템 프로퍼티
String osName = parser.parseExpression("T(System).getProperty('os.name')")
    .getValue(String.class);

// 환경 변수
String path = parser.parseExpression("T(System).getenv('PATH')")
    .getValue(String.class);
```

### 생성자 호출

```java
ExpressionParser parser = new SpelExpressionParser();

// 기본 생성자
List<?> list = parser.parseExpression("new java.util.ArrayList()")
    .getValue(List.class);

// 인자가 있는 생성자
String str = parser.parseExpression("new String('Hello')")
    .getValue(String.class);

// 초기 용량 지정
ArrayList<?> arrayList = parser.parseExpression("new java.util.ArrayList(100)")
    .getValue(ArrayList.class);

// Date 생성
Date date = parser.parseExpression("new java.util.Date()")
    .getValue(Date.class);
```

## 변수와 함수

### 변수 정의 및 사용

```java
ExpressionParser parser = new SpelExpressionParser();
StandardEvaluationContext context = new StandardEvaluationContext();

// 변수 설정
context.setVariable("greeting", "Hello");
context.setVariable("name", "John");
context.setVariable("age", 30);

// 변수 사용 (#변수명)
String message = parser.parseExpression("#greeting + ', ' + #name + '!'")
    .getValue(context, String.class);  // "Hello, John!"

Boolean isAdult = parser.parseExpression("#age >= 18")
    .getValue(context, Boolean.class);  // true

// #this (현재 평가 객체)
context.setRootObject(Arrays.asList(1, 2, 3, 4, 5));
List<?> evenNumbers = parser.parseExpression("#this.?[#this % 2 == 0]")
    .getValue(context, List.class);  // [2, 4]

// #root (루트 객체)
parser.parseExpression("#root").getValue(context);  // 루트 객체 반환
```

### 사용자 정의 함수

```java
public class CustomFunctionExample {

    // 커스텀 함수로 등록할 정적 메서드
    public static String reverseString(String input) {
        return new StringBuilder(input).reverse().toString();
    }

    public static int add(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) throws NoSuchMethodException {
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();

        // 함수 등록
        context.registerFunction("reverse",
            CustomFunctionExample.class.getMethod("reverseString", String.class));
        context.registerFunction("add",
            CustomFunctionExample.class.getMethod("add", int.class, int.class));

        // 함수 호출
        String reversed = parser.parseExpression("#reverse('hello')")
            .getValue(context, String.class);  // "olleh"

        Integer sum = parser.parseExpression("#add(10, 20)")
            .getValue(context, Integer.class);  // 30
    }
}
```

## 컬렉션 처리

### 인라인 컬렉션

```java
ExpressionParser parser = new SpelExpressionParser();

// 인라인 리스트
List<?> numbers = parser.parseExpression("{1, 2, 3, 4, 5}")
    .getValue(List.class);

List<?> strings = parser.parseExpression("{'apple', 'banana', 'cherry'}")
    .getValue(List.class);

// 중첩 리스트
List<?> matrix = parser.parseExpression("{{1, 2}, {3, 4}, {5, 6}}")
    .getValue(List.class);

// 인라인 맵
Map<?, ?> map = parser.parseExpression("{name: 'John', age: 30}")
    .getValue(Map.class);

Map<?, ?> mapWithQuotes = parser.parseExpression("{'name': 'John', 'age': 30}")
    .getValue(Map.class);
```

### 컬렉션 접근

```java
StandardEvaluationContext context = new StandardEvaluationContext();

// 리스트 설정
List<String> fruits = Arrays.asList("apple", "banana", "cherry", "date");
context.setVariable("fruits", fruits);

// 인덱스 접근
String first = parser.parseExpression("#fruits[0]")
    .getValue(context, String.class);  // "apple"

String last = parser.parseExpression("#fruits[3]")
    .getValue(context, String.class);  // "date"

// 맵 설정
Map<String, Integer> scores = new HashMap<>();
scores.put("math", 95);
scores.put("english", 88);
context.setVariable("scores", scores);

// 맵 접근
Integer mathScore = parser.parseExpression("#scores['math']")
    .getValue(context, Integer.class);  // 95
```

### 컬렉션 선택 (Selection)

특정 조건을 만족하는 요소들을 필터링합니다.

```java
public class CollectionSelectionExample {

    public static void main(String[] args) {
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();

        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        context.setVariable("numbers", numbers);

        // .?[조건] - 조건을 만족하는 모든 요소
        List<?> evenNumbers = parser.parseExpression("#numbers.?[#this > 5]")
            .getValue(context, List.class);  // [6, 7, 8, 9, 10]

        // .^[조건] - 조건을 만족하는 첫 번째 요소
        Integer first = parser.parseExpression("#numbers.^[#this > 5]")
            .getValue(context, Integer.class);  // 6

        // .$[조건] - 조건을 만족하는 마지막 요소
        Integer last = parser.parseExpression("#numbers.$[#this > 5]")
            .getValue(context, Integer.class);  // 10

        // 객체 컬렉션 필터링
        List<Product> products = Arrays.asList(
            new Product("Phone", 1000),
            new Product("Laptop", 2000),
            new Product("Tablet", 500),
            new Product("Watch", 300)
        );
        context.setVariable("products", products);

        // 가격이 500 이상인 상품
        List<?> expensiveProducts = parser
            .parseExpression("#products.?[price >= 500]")
            .getValue(context, List.class);
    }
}

class Product {
    private String name;
    private int price;

    public Product(String name, int price) {
        this.name = name;
        this.price = price;
    }

    public String getName() { return name; }
    public int getPrice() { return price; }
}
```

### 컬렉션 투영 (Projection)

컬렉션의 특정 속성만 추출합니다.

```java
public class CollectionProjectionExample {

    public static void main(String[] args) {
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();

        List<Product> products = Arrays.asList(
            new Product("Phone", 1000),
            new Product("Laptop", 2000),
            new Product("Tablet", 500)
        );
        context.setVariable("products", products);

        // .![속성] - 모든 요소에서 특정 속성 추출
        List<?> names = parser.parseExpression("#products.![name]")
            .getValue(context, List.class);  // ["Phone", "Laptop", "Tablet"]

        List<?> prices = parser.parseExpression("#products.![price]")
            .getValue(context, List.class);  // [1000, 2000, 500]

        // 선택 + 투영 조합
        List<?> expensiveNames = parser
            .parseExpression("#products.?[price >= 1000].![name]")
            .getValue(context, List.class);  // ["Phone", "Laptop"]

        // 맵 투영
        Map<String, Integer> scores = new HashMap<>();
        scores.put("math", 95);
        scores.put("english", 88);
        scores.put("science", 92);
        context.setVariable("scores", scores);

        // 맵의 값들만 추출
        List<?> values = parser.parseExpression("#scores.![value]")
            .getValue(context, List.class);
    }
}
```

## 조건 연산자

### 삼항 연산자

```java
ExpressionParser parser = new SpelExpressionParser();
StandardEvaluationContext context = new StandardEvaluationContext();

context.setVariable("age", 25);

// 기본 삼항 연산자
String status = parser.parseExpression("#age >= 18 ? 'adult' : 'minor'")
    .getValue(context, String.class);  // "adult"

// 중첩 삼항 연산자
context.setVariable("score", 85);
String grade = parser.parseExpression(
    "#score >= 90 ? 'A' : " +
    "#score >= 80 ? 'B' : " +
    "#score >= 70 ? 'C' : " +
    "#score >= 60 ? 'D' : 'F'"
).getValue(context, String.class);  // "B"
```

### Elvis 연산자

null 또는 빈 값에 대한 기본값을 제공합니다.

```java
ExpressionParser parser = new SpelExpressionParser();
StandardEvaluationContext context = new StandardEvaluationContext();

// Elvis 연산자: ?: (null이면 기본값)
context.setVariable("name", null);
String result = parser.parseExpression("#name ?: 'Unknown'")
    .getValue(context, String.class);  // "Unknown"

context.setVariable("name", "John");
result = parser.parseExpression("#name ?: 'Unknown'")
    .getValue(context, String.class);  // "John"

// 빈 문자열도 기본값으로 대체
context.setVariable("name", "");
result = parser.parseExpression("#name ?: 'Unknown'")
    .getValue(context, String.class);  // "Unknown"

// 체이닝
context.setVariable("first", null);
context.setVariable("second", null);
context.setVariable("third", "Found");
result = parser.parseExpression("#first ?: #second ?: #third ?: 'Default'")
    .getValue(context, String.class);  // "Found"
```

### Safe Navigation 연산자

NullPointerException을 방지합니다.

```java
public class SafeNavigationExample {

    public static void main(String[] args) {
        ExpressionParser parser = new SpelExpressionParser();

        Person person = new Person("John", 30);
        person.setAddress(null);  // address가 null

        StandardEvaluationContext context = new StandardEvaluationContext(person);

        // 일반 접근 - NullPointerException 발생
        // parser.parseExpression("address.city").getValue(context);  // 에러!

        // Safe Navigation 사용 - null 반환
        String city = parser.parseExpression("address?.city")
            .getValue(context, String.class);  // null (예외 없음)

        // 메서드 호출에도 적용
        String upperCity = parser.parseExpression("address?.getCity()?.toUpperCase()")
            .getValue(context, String.class);  // null (예외 없음)

        // address가 있는 경우
        person.setAddress(new Address("Seoul", "Gangnam"));
        city = parser.parseExpression("address?.city")
            .getValue(context, String.class);  // "Seoul"

        // Elvis와 조합
        String safeCity = parser.parseExpression("address?.city ?: 'Unknown'")
            .getValue(context, String.class);  // "Seoul"
    }
}
```

## 빈 참조

### @빈이름으로 빈 참조

```java
@Configuration
public class AppConfig {

    @Bean
    public ConfigService configService() {
        return new ConfigService();
    }

    @Bean
    public MyService myService() {
        return new MyService();
    }
}

@Component
public class MyComponent {

    // 빈의 프로퍼티 참조
    @Value("#{@configService.timeout}")
    private int timeout;

    // 빈의 메서드 호출
    @Value("#{@configService.getServerUrl()}")
    private String serverUrl;

    // 빈 메서드 결과에 연산 적용
    @Value("#{@configService.getMaxConnections() * 2}")
    private int doubledConnections;

    // 조건부 빈 참조
    @Value("#{@configService.isProduction() ? @prodDataSource : @devDataSource}")
    private DataSource dataSource;
}
```

### 프로그래매틱 빈 참조

```java
@Component
public class SpelBeanReferenceExample {

    @Autowired
    private ApplicationContext applicationContext;

    public void evaluate() {
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();

        // BeanResolver 설정
        context.setBeanResolver(new BeanFactoryResolver(applicationContext));

        // 빈 참조
        Object result = parser.parseExpression("@myService.process()")
            .getValue(context);
    }
}
```

## @Value 어노테이션 활용

### 기본 사용법

```java
@Component
public class ValueAnnotationExamples {

    // 리터럴 값
    @Value("#{100}")
    private int defaultValue;

    // 시스템 프로퍼티
    @Value("#{systemProperties['java.home']}")
    private String javaHome;

    @Value("#{systemProperties['os.name']}")
    private String osName;

    // 환경 변수
    @Value("#{systemEnvironment['PATH']}")
    private String path;

    // 정적 필드
    @Value("#{T(java.lang.Math).PI}")
    private double pi;

    @Value("#{T(java.lang.Integer).MAX_VALUE}")
    private int maxInt;

    // 정적 메서드
    @Value("#{T(java.util.UUID).randomUUID().toString()}")
    private String uuid;

    // 현재 시간
    @Value("#{T(System).currentTimeMillis()}")
    private long currentTime;
}
```

### 프로퍼티와 SpEL 조합

```java
@Component
public class PropertySpelCombination {

    // application.properties: app.name=MyApp
    @Value("${app.name}")
    private String appName;

    // 프로퍼티를 SpEL로 변환
    @Value("#{'${app.name}'.toUpperCase()}")
    private String upperAppName;

    // 프로퍼티 + 기본값
    @Value("${app.timeout:30}")
    private int timeout;

    // SpEL로 기본값 처리
    @Value("#{${app.maxRetries:3} * 2}")
    private int doubledRetries;

    // 조건부 값
    @Value("#{'${spring.profiles.active}' == 'prod' ? 100 : 10}")
    private int connectionPoolSize;

    // 리스트 변환
    // application.properties: app.servers=server1,server2,server3
    @Value("#{'${app.servers}'.split(',')}")
    private List<String> servers;
}
```

### 컬렉션 주입

```java
@Component
public class CollectionInjection {

    // 인라인 리스트
    @Value("#{{'admin', 'user', 'guest'}}")
    private List<String> roles;

    // 인라인 맵
    @Value("#{{1: 'one', 2: 'two', 3: 'three'}}")
    private Map<Integer, String> numberMap;

    // 빈의 컬렉션 프로퍼티
    @Value("#{@configService.allowedOrigins}")
    private List<String> allowedOrigins;

    // 필터링된 컬렉션
    @Value("#{@userService.users.?[active == true]}")
    private List<User> activeUsers;

    // 투영된 컬렉션
    @Value("#{@userService.users.![username]}")
    private List<String> usernames;
}
```

## Spring Security와 SpEL

### @PreAuthorize / @PostAuthorize

```java
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
}

@Service
public class SecuredService {

    // 역할 기반 접근 제어
    @PreAuthorize("hasRole('ADMIN')")
    public void adminOnly() {
        // 관리자만 접근 가능
    }

    // 권한 기반 접근 제어
    @PreAuthorize("hasAuthority('READ_PRIVILEGE')")
    public void readData() {
        // READ_PRIVILEGE 권한 필요
    }

    // 복합 조건
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public void manageResources() {
        // ADMIN 또는 MANAGER 역할 필요
    }

    // 인증 여부 확인
    @PreAuthorize("isAuthenticated()")
    public void authenticatedOnly() {
        // 로그인한 사용자만 접근
    }

    // 메서드 파라미터 사용
    @PreAuthorize("#username == authentication.principal.username")
    public User getUser(String username) {
        // 자신의 정보만 조회 가능
    }

    // 객체 프로퍼티 접근
    @PreAuthorize("#user.username == authentication.principal.username")
    public void updateUser(User user) {
        // 자신의 정보만 수정 가능
    }

    // 복잡한 조건
    @PreAuthorize("hasRole('ADMIN') or (#user.department == authentication.principal.department)")
    public void departmentAccess(User user) {
        // 관리자이거나 같은 부서인 경우만 접근
    }

    // 결과 기반 필터링 (@PostAuthorize)
    @PostAuthorize("returnObject.owner == authentication.principal.username")
    public Document getDocument(Long id) {
        // 반환된 문서의 소유자만 결과 확인 가능
        return documentRepository.findById(id);
    }
}
```

### @PreFilter / @PostFilter

```java
@Service
public class FilteredService {

    // 입력 컬렉션 필터링
    @PreFilter("filterObject.owner == authentication.principal.username")
    public void processDocuments(List<Document> documents) {
        // 자신의 문서만 처리
    }

    // 결과 컬렉션 필터링
    @PostFilter("filterObject.visible == true or filterObject.owner == authentication.principal.username")
    public List<Document> getAllDocuments() {
        // 공개 문서 또는 자신의 문서만 반환
        return documentRepository.findAll();
    }

    // 권한 기반 필터링
    @PostFilter("hasPermission(filterObject, 'READ')")
    public List<Resource> getResources() {
        return resourceRepository.findAll();
    }
}
```

### 커스텀 Security Expression

```java
@Component("securityService")
public class CustomSecurityService {

    public boolean isOwner(Long resourceId, String username) {
        Resource resource = resourceRepository.findById(resourceId);
        return resource != null && resource.getOwner().equals(username);
    }

    public boolean canAccessDepartment(String department) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = (User) auth.getPrincipal();
        return user.getDepartment().equals(department) || user.hasRole("ADMIN");
    }
}

@Service
public class ResourceService {

    // 커스텀 보안 서비스 사용
    @PreAuthorize("@securityService.isOwner(#resourceId, authentication.principal.username)")
    public Resource getResource(Long resourceId) {
        return resourceRepository.findById(resourceId);
    }

    @PreAuthorize("@securityService.canAccessDepartment(#department)")
    public List<Employee> getDepartmentEmployees(String department) {
        return employeeRepository.findByDepartment(department);
    }
}
```

## 템플릿 표현식

문자열 템플릿 내에서 SpEL을 사용합니다.

```java
public class TemplateExpressionExample {

    public static void main(String[] args) {
        ExpressionParser parser = new SpelExpressionParser();

        // TemplateParserContext 사용
        ParserContext templateContext = new TemplateParserContext();

        StandardEvaluationContext context = new StandardEvaluationContext();
        context.setVariable("user", "John");
        context.setVariable("count", 5);
        context.setVariable("product", "iPhone");

        // 템플릿 표현식 (기본 구분자: #{ })
        String template = "Hello #{#user}! You have #{#count} new messages.";
        String result = parser.parseExpression(template, templateContext)
            .getValue(context, String.class);
        // "Hello John! You have 5 new messages."

        // 복잡한 템플릿
        String orderTemplate = "Order for #{#product}: Price is #{T(String).format('$%.2f', #price)}";
        context.setVariable("price", 999.99);
        result = parser.parseExpression(orderTemplate, templateContext)
            .getValue(context, String.class);
        // "Order for iPhone: Price is $999.99"

        // 커스텀 구분자
        ParserContext customContext = new ParserContext() {
            @Override
            public boolean isTemplate() { return true; }
            @Override
            public String getExpressionPrefix() { return "{{"; }
            @Override
            public String getExpressionSuffix() { return "}}"; }
        };

        String customTemplate = "Welcome {{#user}}!";
        result = parser.parseExpression(customTemplate, customContext)
            .getValue(context, String.class);
        // "Welcome John!"
    }
}
```

## 실전 예제

### 동적 설정 관리

```java
@Component
public class DynamicConfigExample {

    // 환경에 따른 동적 설정
    @Value("#{systemProperties['env'] == 'prod' ? 100 : 10}")
    private int maxConnections;

    // 시간 기반 설정
    @Value("#{T(java.time.LocalTime).now().hour >= 9 and T(java.time.LocalTime).now().hour < 18 ? 'business' : 'maintenance'}")
    private String operationMode;

    // 조건부 URL
    @Value("#{'${server.ssl.enabled:false}' == 'true' ? 'https' : 'http'}://${server.host}:${server.port}")
    private String serverUrl;
}
```

### 조건부 Bean 생성

```java
@Configuration
public class ConditionalBeanConfig {

    @Bean
    @ConditionalOnExpression("#{${feature.cache.enabled:true}}")
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager();
    }

    @Bean
    @ConditionalOnExpression("#{${app.mode} == 'cluster'}")
    public ClusterManager clusterManager() {
        return new ClusterManager();
    }

    @Bean
    @ConditionalOnExpression("#{T(java.lang.Runtime).getRuntime().availableProcessors() > 4}")
    public ExecutorService highPerformanceExecutor() {
        return Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors() * 2
        );
    }
}
```

### 데이터 검증

```java
@Component
public class SpelValidator {

    private final ExpressionParser parser = new SpelExpressionParser();

    public boolean validate(Object target, String expression) {
        StandardEvaluationContext context = new StandardEvaluationContext(target);
        return parser.parseExpression(expression).getValue(context, Boolean.class);
    }

    public void validateOrder(Order order) {
        // 주문 검증 규칙
        boolean valid = validate(order,
            "items != null and !items.isEmpty() and " +
            "customer != null and " +
            "totalAmount > 0 and " +
            "items.![quantity].stream().allMatch(q -> q > 0)"
        );

        if (!valid) {
            throw new ValidationException("Invalid order");
        }
    }
}
```

### 동적 쿼리 조건

```java
@Repository
public class DynamicQueryRepository {

    @PersistenceContext
    private EntityManager em;

    private final ExpressionParser parser = new SpelExpressionParser();

    public List<Product> findByDynamicCondition(Map<String, Object> params) {
        StandardEvaluationContext context = new StandardEvaluationContext();
        params.forEach(context::setVariable);

        StringBuilder jpql = new StringBuilder("SELECT p FROM Product p WHERE 1=1");

        // 조건부 쿼리 구성
        String condition = "#minPrice != null ? ' AND p.price >= :minPrice' : ''";
        jpql.append(parser.parseExpression(condition).getValue(context, String.class));

        condition = "#maxPrice != null ? ' AND p.price <= :maxPrice' : ''";
        jpql.append(parser.parseExpression(condition).getValue(context, String.class));

        condition = "#category != null ? ' AND p.category = :category' : ''";
        jpql.append(parser.parseExpression(condition).getValue(context, String.class));

        Query query = em.createQuery(jpql.toString());

        // 파라미터 바인딩
        if (params.get("minPrice") != null) {
            query.setParameter("minPrice", params.get("minPrice"));
        }
        if (params.get("maxPrice") != null) {
            query.setParameter("maxPrice", params.get("maxPrice"));
        }
        if (params.get("category") != null) {
            query.setParameter("category", params.get("category"));
        }

        return query.getResultList();
    }
}
```

## SpEL 성능 고려사항

### 표현식 캐싱

```java
@Component
public class CachedSpelEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> expressionCache = new ConcurrentHashMap<>();

    public Object evaluate(String expressionString, EvaluationContext context) {
        // 파싱된 표현식 캐싱
        Expression expression = expressionCache.computeIfAbsent(
            expressionString,
            parser::parseExpression
        );
        return expression.getValue(context);
    }

    public <T> T evaluate(String expressionString, EvaluationContext context, Class<T> type) {
        Expression expression = expressionCache.computeIfAbsent(
            expressionString,
            parser::parseExpression
        );
        return expression.getValue(context, type);
    }
}
```

### 컴파일 모드

```java
// SpelCompilerMode 설정
SpelParserConfiguration config = new SpelParserConfiguration(
    SpelCompilerMode.IMMEDIATE,  // 즉시 컴파일
    this.getClass().getClassLoader()
);

ExpressionParser parser = new SpelExpressionParser(config);

// 컴파일 모드 옵션
// OFF: 컴파일 비활성화 (기본값)
// IMMEDIATE: 첫 평가 시 즉시 컴파일
// MIXED: 일정 횟수 인터프리터 실행 후 컴파일
```

## 참고 자료

- [Spring Framework Official Docs - SpEL](https://docs.spring.io/spring-framework/reference/core/expressions.html)
- [Baeldung - Spring Expression Language Guide](https://www.baeldung.com/spring-expression-language)
- [GeeksforGeeks - Spring Expression Language](https://www.geeksforgeeks.org/spring-expression-languagespel/)
- [Baeldung - Spring Method Security](https://www.baeldung.com/spring-security-method-security)
