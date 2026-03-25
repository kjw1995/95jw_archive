---
title: "25. 스프링 부트 사용하기"
weight: 25
---

스프링 부트의 개념과 특징, 타임리프, 그레이들, 마이바티스 연동 방법을 다룬다.

---

## 1. 스프링 부트란?

스프링 프레임워크로 개발하려면 톰캣 설치부터 XML 설정까지 복잡한 과정을 거쳐야 한다. **스프링 부트(Spring Boot)**는 이런 설정을 자동화하여 일반 자바 애플리케이션처럼 웹 애플리케이션을 개발할 수 있게 해준다.

### 스프링 프레임워크 vs 스프링 부트

| 항목 | 스프링 프레임워크 | 스프링 부트 |
|:-----|:-----|:-----|
| 서버 | 외부 톰캣 별도 설치 | 톰캣 내장 (별도 설치 불필요) |
| 설정 방식 | XML 기반 수동 설정 | 자동 설정 (`@SpringBootApplication`) |
| 의존성 관리 | pom.xml에 직접 명시 | 스타터(starter)로 자동 관리 |
| 실행 방식 | WAR 배포 → 톰캣 실행 | `main()` 메서드로 단독 실행 |
| 빌드 도구 | 주로 메이븐 | 메이븐 또는 그레이들 |

### 스프링 부트의 특징

- 일반 응용 프로그램을 단독 실행하는 수준으로 웹 애플리케이션을 구현할 수 있다
- 톰캣, Jetty, Undertow 같은 서버가 **내장**되어 별도 설치가 필요 없다
- XML 기반 설정 없이 **환경 설정을 자동화**할 수 있다
- 의존성 관리를 쉽고 자동으로 할 수 있다

### 스프링 부트 프로젝트 구조

```
프로젝트/
├── src/main/java/
│   └── com.example.demo/
│       ├── Application.java
│       └── ServletInitializer
│             .java
├── src/main/resources/
│   ├── application
│   │     .properties
│   ├── static/
│   └── templates/
└── pom.xml (또는 build.gradle)
```

### Application.java

스프링 부트 프로젝트는 `main()` 메서드를 시작점으로 실행한다.

```java
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(
            Application.class, args);
    }
}
```

`@SpringBootApplication`은 다음 세 가지를 합친 것이다.

| 애너테이션 | 역할 |
|:-----|:-----|
| `@SpringBootConfiguration` | 스프링 부트 설정 클래스 |
| `@EnableAutoConfiguration` | 클래스패스 기반 자동 설정 |
| `@ComponentScan` | 컴포넌트 자동 탐색 |

### 실행 흐름

```
  main() 호출
       │
       ▼
┌────────────────┐
│ SpringBoot 시작 │
│ 자동 설정 로드   │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ 내장 톰캣 시작   │
│ (포트 8080)     │
└───────┬────────┘
        │
        ▼
  웹 요청 수신 대기
```

### ServletInitializer

`ServletInitializer` 클래스는 `SpringBootServletInitializer`를 상속받아 **web.xml 없이** 톰캣에서 실행할 수 있게 해준다.

```java
public class ServletInitializer
    extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder
        configure(
            SpringApplicationBuilder app) {
        return app.sources(
            Application.class);
    }
}
```

{{< callout type="info" >}}
내장 톰캣으로 실행할 때는 `Application.main()`이 진입점이고, 외부 톰캣(WAR 배포)으로 실행할 때는 `ServletInitializer`가 진입점이 된다.
{{< /callout >}}

---

## 2. 타임리프(Thymeleaf)

JSP는 화면 기능이 복잡해지면서 문법이 난해해졌고, 스프링과의 연동도 불편해졌다. 스프링 부트에서는 **타임리프(Thymeleaf)**를 표준 템플릿 엔진으로 지정하였다.

### JSP vs 타임리프

| 항목 | JSP | 타임리프 |
|:-----|:-----|:-----|
| 위치 | `webapp/WEB-INF/views/` | `resources/templates/` |
| 확장자 | `.jsp` | `.html` |
| 브라우저 직접 열기 | 불가 (서버 필수) | 가능 (Natural Template) |
| 서버 의존성 | 서블릿 컨테이너 필요 | 독립 실행 가능 |
| 문법 | `<%= %>`, JSTL | `th:*` 속성 |

### 타임리프 기본 문법

```html
<!DOCTYPE html>
<html xmlns:th=
    "http://www.thymeleaf.org">
<head>
    <title th:text="${title}">
        기본 제목
    </title>
</head>
<body>
    <!-- 텍스트 출력 -->
    <p th:text="${message}">
        기본 메시지
    </p>

    <!-- 반복문 -->
    <tr th:each="member : ${members}">
        <td th:text="${member.name}">
            이름
        </td>
    </tr>

    <!-- 조건문 -->
    <p th:if="${user != null}">
        환영합니다!
    </p>
</body>
</html>
```

### 주요 th 속성

| 속성 | 설명 | 예시 |
|:-----|:-----|:-----|
| `th:text` | 텍스트 출력 | `th:text="${name}"` |
| `th:each` | 반복 | `th:each="item : ${list}"` |
| `th:if` | 조건부 표시 | `th:if="${condition}"` |
| `th:href` | 링크 URL | `th:href="@{/path}"` |
| `th:action` | 폼 전송 경로 | `th:action="@{/submit}"` |
| `th:value` | 입력 값 | `th:value="${data}"` |

### 의존성 추가

```xml
<dependency>
    <groupId>
        org.springframework.boot
    </groupId>
    <artifactId>
        spring-boot-starter-thymeleaf
    </artifactId>
</dependency>
```

{{< callout type="info" >}}
타임리프는 HTML 파일 자체가 유효한 HTML이므로 **서버 없이도 브라우저에서 디자인을 확인**할 수 있다. 이를 Natural Template이라 한다.
{{< /callout >}}

---

## 3. 그레이들(Gradle)

그레이들은 **메이븐의 단점을 보완**한 최신 빌드 도구다.

### 메이븐 vs 그레이들

| 항목 | 메이븐 | 그레이들 |
|:-----|:-----|:-----|
| 설정 파일 | `pom.xml` | `build.gradle` |
| 설정 언어 | XML (정적) | 그루비/코틀린 스크립트 (동적) |
| 빌드 속도 | 보통 | 빠름 (증분 빌드, 캐시) |
| 유연성 | 플러그인 의존 | 스크립트로 기능 추가 가능 |
| 가독성 | 장황함 | 간결함 |

### 설정 파일 비교

**메이븐 (pom.xml)**

```xml
<dependencies>
    <dependency>
        <groupId>
            org.springframework.boot
        </groupId>
        <artifactId>
            spring-boot-starter-web
        </artifactId>
    </dependency>
</dependencies>
```

**그레이들 (build.gradle)**

```groovy
dependencies {
    implementation
        'org.springframework.boot' +
        ':spring-boot-starter-web'
}
```

{{< callout type="info" >}}
안드로이드 스튜디오는 그레이들을 기본 빌드 도구로 사용한다. 최근 스프링 부트 프로젝트도 그레이들 기반이 표준이 되고 있다.
{{< /callout >}}

---

## 4. 스프링 부트에서 마이바티스 사용하기

스프링 부트에서는 DAO 인터페이스에 `@Mapper`를 적용해 **구현 클래스 없이** 매퍼 파일의 SQL문을 바로 사용할 수 있다.

### 기존 스프링 vs 스프링 부트 마이바티스

```
  기존 스프링
  ┌──────────┐
  │ Service  │
  └────┬─────┘
       │ 호출
       ▼
  ┌──────────┐
  │ DAO 구현  │
  │ SqlSession│
  └────┬─────┘
       │ SQL 실행
       ▼
  ┌──────────┐
  │ Mapper XML│
  └──────────┘
```

```
  스프링 부트
  ┌──────────┐
  │ Service  │
  └────┬─────┘
       │ 호출
       ▼
  ┌──────────┐
  │ DAO 인터페이스│
  │ @Mapper   │
  └────┬─────┘
       │ 자동 매핑
       ▼
  ┌──────────┐
  │ Mapper XML│
  └──────────┘
```

### DAO 인터페이스 작성

```java
@Mapper
@Repository
public interface MemberDAO {

    // 매퍼 파일의 id가
    // selectAllMemberList인
    // SQL문을 호출한다.
    public List<MemberVO>
        selectAllMemberList()
        throws DataAccessException;
}
```

### 매퍼 XML

```xml
<mapper namespace=
    "com.example.dao.MemberDAO">

    <select id="selectAllMemberList"
        resultType="memberVO">
        SELECT * FROM t_member
        ORDER BY id
    </select>
</mapper>
```

### application.properties 설정

```properties
# 데이터소스 설정
spring.datasource.driver-class-name=
    oracle.jdbc.driver.OracleDriver
spring.datasource.url=
    jdbc:oracle:thin:@localhost:1521:XE
spring.datasource.username=scott
spring.datasource.password=tiger

# 마이바티스 설정
mybatis.mapper-locations=
    classpath:mappers/**/*.xml
mybatis.type-aliases-package=
    com.example.vo
```

{{< callout type="warning" >}}
기존 스프링에서는 `SqlSession`을 주입받아 DAO 구현 클래스를 만들어야 했다. 스프링 부트에서는 `@Mapper`만 적용하면 **구현 클래스 없이** 인터페이스 메서드 이름과 매퍼 XML의 id를 자동 매핑한다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 스프링 부트 | 내장 톰캣과 자동 설정으로 독립 실행 가능한 스프링 |
| @SpringBootApplication | 설정 + 자동 설정 + 컴포넌트 스캔을 합친 애너테이션 |
| 타임리프 | 스프링 부트 표준 템플릿 엔진 (Natural Template) |
| 그레이들 | 그루비 스크립트 기반 빌드 도구 (메이븐보다 간결·빠름) |
| @Mapper | DAO 인터페이스를 매퍼 XML과 자동 매핑 |
| application.properties | 스프링 부트 설정 파일 (XML 대체) |