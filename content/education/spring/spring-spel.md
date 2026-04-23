---
title: "Spring Expression Language (SpEL)"
description: "런타임에 객체 그래프를 조회하고 조작하는 Spring 표현 언어의 구조와 사용법을 정리한다"
summary: "#{}와 ${}의 차이, 리터럴과 연산자, EvaluationContext, @Value, Spring Security 연동, 보안 고려사항"
date: 2025-01-20
weight: 10
draft: false
toc: true
---

## 1. SpEL 개요

### SpEL이란?

SpEL(Spring Expression Language)은 런타임에 객체 그래프를 조회하고 조작할 수 있는 표현 언어이다. Jakarta Expression Language(EL)와 유사하지만 메서드 호출, 문자열 템플릿, 컬렉션 선택/투영 같은 기능을 추가로 제공한다.

{{< callout type="info" >}}
SpEL은 Spring Framework에 포함되어 있지만 Spring 컨테이너 없이도 독립적으로 사용할 수 있다. `spring-expression` 모듈만 있으면 된다.
{{< /callout >}}

### SpEL이 쓰이는 자리

```
   @Value    @PreAuthorize    XML/Java 설정
     │            │                │
     └────────────┼────────────────┘
                  ▼
          ┌──────────────┐
          │  SpEL Engine │
          │  Parser +    │
          │  Context     │
          └──────────────┘
```

| 활용 영역 | 예시 |
|:---|:---|
| `@Value` | 프로퍼티 주입, 동적 값 계산 |
| Spring Security | `@PreAuthorize`, `@PostFilter` |
| Bean 정의 | XML/Java 설정의 조건부 빈 |
| Spring Integration | 메시지 라우팅 규칙 |
| Spring Data | `@Query` 파라미터 바인딩 |

---

## 2. `#{}`와 `${}`의 차이

두 구문은 비슷해 보이지만 처리 주체와 시점이 완전히 다르다.

```
${...}   PropertySourcesPlaceholderConfigurer
          → application.properties,
            환경 변수, 시스템 프로퍼티
          → 빈 정의 시점에 문자열 치환

#{...}   SpEL 엔진
          → 런타임 표현식 평가
          → 메서드 호출, 연산, 빈 참조
```

```java
// ${...} : 프로퍼티 플레이스홀더
@Value("${app.name}")
private String appName;

// #{...} : SpEL 표현식
@Value("#{systemProperties['os.name']}")
private String osName;

// 혼합 : SpEL 내부에서 프로퍼티 참조
@Value("#{'${app.name}'.toUpperCase()}")
private String upperAppName;
```

{{< callout type="warning" >}}
`${}`는 PropertySources에서 값을 찾지 못하면 기본값이 없을 때 예외가 발생한다. `${app.name:default}` 형태로 기본값을 지정할 수 있다. `#{}`는 표현식 자체가 잘못되면 `SpelParseException`, 평가 시점에 문제가 있으면 `SpelEvaluationException`이 발생한다.
{{< /callout >}}

### 동작 순서

```
1. ${...} 치환    application.properties 읽음
                       │
                       ▼
2. #{...} 평가    SpEL 엔진이 결과를 계산
                       │
                       ▼
3. 최종 값 주입    필드/파라미터에 대입
```

---

## 3. SpEL 핵심 아키텍처

### 구성 요소

```
 Expression String
        │
        ▼
┌──────────────────┐
│ ExpressionParser │  문자열 파싱
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Expression    │  파싱 결과
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│EvaluationContext │  변수, 빈, 루트
└────────┬─────────┘
         │
         ▼
     Result
```

| 구성 요소 | 역할 |
|:---|:---|
| `ExpressionParser` | 표현식 문자열을 `Expression`으로 변환 |
| `Expression` | 파싱된 표현식, `getValue()`로 평가 |
| `EvaluationContext` | 변수, 함수, 루트 객체, 빈 리졸버 보관 |

### 기본 사용법

```java
ExpressionParser parser = new SpelExpressionParser();

// 리터럴
Expression exp = parser.parseExpression("'Hello World'");
String msg = exp.getValue(String.class);

// 메서드 호출
exp = parser.parseExpression("'Hello'.concat(' World')");
msg = exp.getValue(String.class);

// 프로퍼티 접근
exp = parser.parseExpression("'Hello'.bytes.length");
int length = exp.getValue(Integer.class);
```

### EvaluationContext 활용

```java
Person person = new Person("John", 30);

ExpressionParser parser = new SpelExpressionParser();
StandardEvaluationContext context =
    new StandardEvaluationContext(person);

// 루트 객체 프로퍼티 접근
String name = parser.parseExpression("name")
    .getValue(context, String.class); // "John"

// 메서드 호출 체이닝
String upper = parser
    .parseExpression("getName().toUpperCase()")
    .getValue(context, String.class); // "JOHN"

// 값 설정
parser.parseExpression("name")
    .setValue(context, "Jane");
```

---

## 4. 리터럴과 연산자

### 지원 리터럴

```java
parser.parseExpression("'Hello'").getValue();       // 문자열
parser.parseExpression("42").getValue();            // 정수
parser.parseExpression("3.14").getValue();          // 실수
parser.parseExpression("1e4").getValue();           // 지수
parser.parseExpression("0xFFFF").getValue();        // 16진수
parser.parseExpression("true").getValue();          // 불리언
parser.parseExpression("null").getValue();          // null
```

### 산술 연산

```java
parser.parseExpression("2 + 3").getValue();     // 5
parser.parseExpression("10 / 3").getValue();    // 3
parser.parseExpression("10 % 3").getValue();    // 1
parser.parseExpression("2 ^ 10").getValue();    // 1024
parser.parseExpression("'Hi' + ' ' + 'You'")
      .getValue();                              // "Hi You"
```

### 비교 · 논리 연산자

| 연산 | 기호 | 텍스트 |
|:---|:---|:---|
| 같음 | `==` | `eq` |
| 다름 | `!=` | `ne` |
| 작음 | `<` | `lt` |
| 작거나 같음 | `<=` | `le` |
| 큼 | `>` | `gt` |
| 크거나 같음 | `>=` | `ge` |
| AND | `&&` | `and` |
| OR | `||` | `or` |
| NOT | `!` | `not` |

```java
parser.parseExpression("5 gt 3").getValue(Boolean.class);
parser.parseExpression("(2 > 1) and (3 < 5)")
      .getValue(Boolean.class);

// 정규식 매칭
parser.parseExpression("'5.00' matches '^\\d+\\.\\d{2}$'")
      .getValue(Boolean.class);
```

---

## 5. 프로퍼티와 메서드 접근

### 프로퍼티 체이닝

```java
Person person = new Person("John", 30);
person.setAddress(new Address("Seoul", "Gangnam"));

StandardEvaluationContext ctx =
    new StandardEvaluationContext(person);

// 단순 프로퍼티
parser.parseExpression("name")
      .getValue(ctx, String.class);     // "John"

// 중첩 프로퍼티
parser.parseExpression("address.city")
      .getValue(ctx, String.class);     // "Seoul"

// 값 변경
parser.parseExpression("age").setValue(ctx, 35);
```

### 메서드 호출

```java
parser.parseExpression("'hello'.toUpperCase()")
      .getValue(String.class);                    // "HELLO"

parser.parseExpression("'hello'.substring(0, 3)")
      .getValue(String.class);                    // "hel"

// 체이닝
parser.parseExpression("getName().toLowerCase()")
      .getValue(ctx, String.class);
```

### T() 연산자로 타입 접근

```java
// 정적 필드
Double pi = parser.parseExpression("T(Math).PI")
    .getValue(Double.class);

// 정적 메서드
Integer max = parser.parseExpression("T(Math).max(10, 20)")
    .getValue(Integer.class);

// 시스템 프로퍼티
String os = parser
    .parseExpression("T(System).getProperty('os.name')")
    .getValue(String.class);
```

### 생성자 호출

```java
parser.parseExpression("new java.util.ArrayList()")
      .getValue(List.class);

parser.parseExpression("new String('Hello')")
      .getValue(String.class);
```

---

## 6. 변수와 사용자 정의 함수

### 변수 정의

```java
StandardEvaluationContext ctx =
    new StandardEvaluationContext();
ctx.setVariable("greeting", "Hello");
ctx.setVariable("name", "John");
ctx.setVariable("age", 30);

// #변수명으로 참조
parser.parseExpression("#greeting + ', ' + #name + '!'")
      .getValue(ctx, String.class); // "Hello, John!"

parser.parseExpression("#age >= 18")
      .getValue(ctx, Boolean.class); // true

// #this (현재 평가 중인 객체), #root (루트 객체)
ctx.setRootObject(Arrays.asList(1, 2, 3, 4, 5));
parser.parseExpression("#this.?[#this % 2 == 0]")
      .getValue(ctx, List.class); // [2, 4]
```

### 커스텀 함수 등록

```java
public class StringUtils {
    public static String reverse(String in) {
        return new StringBuilder(in).reverse().toString();
    }
}

ctx.registerFunction("reverse",
    StringUtils.class.getMethod("reverse", String.class));

parser.parseExpression("#reverse('hello')")
      .getValue(ctx, String.class); // "olleh"
```

---

## 7. 컬렉션 선택과 투영

SpEL은 컬렉션에 대한 필터링·매핑 연산자를 제공한다.

| 연산자 | 의미 | 예시 |
|:---|:---|:---|
| `.?[조건]` | 조건을 만족하는 모든 요소 | `#list.?[price > 100]` |
| `.^[조건]` | 조건을 만족하는 첫 요소 | `#list.^[active]` |
| `.$[조건]` | 조건을 만족하는 마지막 요소 | `#list.$[active]` |
| `.![속성]` | 각 요소의 속성만 추출 | `#list.![name]` |

### 선택(Selection) 예시

```java
List<Integer> numbers =
    Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
ctx.setVariable("nums", numbers);

// 5 초과인 요소
parser.parseExpression("#nums.?[#this > 5]")
      .getValue(ctx, List.class); // [6, 7, 8, 9, 10]

// 첫 번째 / 마지막
parser.parseExpression("#nums.^[#this > 5]")
      .getValue(ctx, Integer.class); // 6
parser.parseExpression("#nums.$[#this > 5]")
      .getValue(ctx, Integer.class); // 10
```

### 투영(Projection) 예시

```java
// 속성만 추출
parser.parseExpression("#products.![name]")
      .getValue(ctx, List.class);

// 필터 + 투영
parser.parseExpression("#products.?[price >= 1000].![name]")
      .getValue(ctx, List.class);
```

### 인라인 컬렉션

```java
// 리스트
parser.parseExpression("{1, 2, 3, 4, 5}")
      .getValue(List.class);

// 맵
parser.parseExpression("{name: 'John', age: 30}")
      .getValue(Map.class);

// 중첩
parser.parseExpression("{{1, 2}, {3, 4}}")
      .getValue(List.class);
```

---

## 8. 조건 · 안전 연산자

### 삼항 연산자와 Elvis 연산자

```java
// 삼항
parser.parseExpression("#age >= 18 ? 'adult' : 'minor'")
      .getValue(ctx, String.class);

// Elvis: null이면 기본값
ctx.setVariable("name", null);
parser.parseExpression("#name ?: 'Unknown'")
      .getValue(ctx, String.class); // "Unknown"
```

### Safe Navigation (`?.`)

```java
Person person = new Person("John", 30);
person.setAddress(null);
StandardEvaluationContext ctx =
    new StandardEvaluationContext(person);

// address가 null이어도 예외 없이 null 반환
parser.parseExpression("address?.city")
      .getValue(ctx, String.class); // null

// Elvis와 조합
parser.parseExpression("address?.city ?: 'Unknown'")
      .getValue(ctx, String.class); // "Unknown"
```

---

## 9. EvaluationContext와 보안

`EvaluationContext`는 SpEL 실행 환경을 제공한다. 어떤 구현체를 쓰느냐가 보안에 직결된다.

| 구현체 | 기능 | 보안 |
|:---|:---|:---|
| `StandardEvaluationContext` | 리플렉션, 타입 참조, 생성자, 빈 리졸버 모두 허용 | 위험 |
| `SimpleEvaluationContext` | 프로퍼티 접근, 사용자 정의 함수 일부만 허용 | 안전 |

{{< callout type="warning" >}}
사용자 입력을 그대로 SpEL 표현식으로 평가하면 원격 코드 실행(RCE)으로 이어질 수 있다. CVE-2022-22963, CVE-2022-22947 등이 대표 사례다. 외부 입력을 평가해야 한다면 반드시 `SimpleEvaluationContext`를 사용하고, `T()`·생성자·빈 참조가 금지되는지 확인한다.
{{< /callout >}}

```java
// 신뢰된 내부 표현식
StandardEvaluationContext trusted =
    new StandardEvaluationContext();

// 외부 입력을 평가할 때
SimpleEvaluationContext safe = SimpleEvaluationContext
    .forReadOnlyDataBinding()
    .build();

Expression exp = parser.parseExpression(userInput);
Object result = exp.getValue(safe); // T(), new 불가
```

---

## 10. @Value와 SpEL

### 기본 활용

```java
@Component
public class ValueExamples {

    @Value("#{100}")
    private int defaultValue;

    @Value("#{systemProperties['os.name']}")
    private String osName;

    @Value("#{T(java.lang.Math).PI}")
    private double pi;

    @Value("#{T(java.util.UUID).randomUUID().toString()}")
    private String uuid;
}
```

### 프로퍼티와 결합

```java
@Component
public class CombinedConfig {

    // ${}로 치환한 결과에 SpEL 적용
    @Value("#{'${app.name}'.toUpperCase()}")
    private String upperAppName;

    // 기본값
    @Value("${app.timeout:30}")
    private int timeout;

    // 조건부
    @Value(
        "#{'${spring.profiles.active}' == 'prod' ? 100 : 10}"
    )
    private int poolSize;

    // 콤마 분리 리스트
    @Value("#{'${app.servers}'.split(',')}")
    private List<String> servers;
}
```

### 빈 참조 (`@빈이름`)

```java
@Component
public class BeanRefExamples {

    @Value("#{@configService.timeout}")
    private int timeout;

    @Value("#{@configService.getServerUrl()}")
    private String url;

    @Value("#{@userService.users.?[active]}")
    private List<User> activeUsers;
}
```

---

## 11. Spring Security와 SpEL

Method Security 애너테이션은 SpEL로 조건을 표현한다.

```java
@Service
public class SecuredService {

    @PreAuthorize("hasRole('ADMIN')")
    public void adminOnly() { }

    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public void manageResources() { }

    // 메서드 파라미터 바인딩
    @PreAuthorize(
        "#username == authentication.principal.username"
    )
    public User getUser(String username) { return null; }

    // 반환값 기반
    @PostAuthorize(
        "returnObject.owner " +
        "== authentication.principal.username"
    )
    public Document getDocument(Long id) { return null; }

    // 컬렉션 필터링
    @PostFilter(
        "filterObject.visible or " +
        "filterObject.owner == authentication.principal.username"
    )
    public List<Document> listAll() { return null; }
}
```

### 커스텀 보안 빈 활용

```java
@Component("securityService")
public class CustomSecurity {
    public boolean isOwner(Long id, String username) {
        return resourceRepo.findById(id)
            .map(r -> r.getOwner().equals(username))
            .orElse(false);
    }
}

@Service
public class ResourceService {
    @PreAuthorize(
        "@securityService.isOwner(" +
        "#id, authentication.principal.username)"
    )
    public Resource get(Long id) { return null; }
}
```

---

## 12. 템플릿 표현식

문자열 안의 `#{...}` 구간만 평가하고 싶을 때 `TemplateParserContext`를 사용한다.

```java
ExpressionParser parser = new SpelExpressionParser();
ParserContext tpl = new TemplateParserContext();

StandardEvaluationContext ctx =
    new StandardEvaluationContext();
ctx.setVariable("user", "John");
ctx.setVariable("count", 5);

String msg = parser.parseExpression(
        "Hello #{#user}! #{#count} messages.", tpl)
    .getValue(ctx, String.class);
// "Hello John! 5 messages."
```

---

## 13. 성능 고려사항

### 표현식 캐싱

`parseExpression()`은 비싸다. 동일한 표현식을 반복 평가한다면 `Expression` 객체를 캐시한다.

```java
@Component
public class CachedEvaluator {

    private final ExpressionParser parser =
        new SpelExpressionParser();
    private final Map<String, Expression> cache =
        new ConcurrentHashMap<>();

    public Object eval(String exp, EvaluationContext ctx) {
        return cache
            .computeIfAbsent(exp, parser::parseExpression)
            .getValue(ctx);
    }
}
```

### 컴파일 모드

```java
SpelParserConfiguration config = new SpelParserConfiguration(
    SpelCompilerMode.IMMEDIATE,
    getClass().getClassLoader()
);
ExpressionParser parser = new SpelExpressionParser(config);
```

| 모드 | 동작 |
|:---|:---|
| `OFF` | 기본값, 항상 인터프리터로 실행 |
| `IMMEDIATE` | 첫 평가 시 바로 컴파일 |
| `MIXED` | 일정 횟수 인터프리터 실행 후 컴파일 |

{{< callout type="info" >}}
컴파일 모드는 반복 호출되는 표현식에서 큰 성능 향상을 보인다. 다만 컴파일은 특정 제약(예: 타입이 확정된 경우)에만 동작하므로, 표현식이 충분히 단순한지 확인해야 한다.
{{< /callout >}}

---

## 14. 정리

| 항목 | 핵심 |
|:---|:---|
| `${}` vs `#{}` | 프로퍼티 치환 vs 런타임 표현식 |
| Parser | `SpelExpressionParser` |
| Context | `StandardEvaluationContext`(내부), `SimpleEvaluationContext`(외부 입력) |
| 주요 연산자 | 산술·비교·논리, Elvis(`?:`), Safe(`?.`), T(), `@빈` |
| 컬렉션 | `.?[]`, `.^[]`, `.$[]`, `.![]` |
| 성능 | `Expression` 캐싱, 컴파일 모드 |

---

## 참고 자료

- [Spring Framework Reference - SpEL](https://docs.spring.io/spring-framework/reference/core/expressions.html)
- [Baeldung - Spring Expression Language Guide](https://www.baeldung.com/spring-expression-language)
- [Spring Security Method Security](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)
