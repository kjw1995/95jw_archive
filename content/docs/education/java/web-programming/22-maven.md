---
title: "22. 메이븐 사용법"
weight: 22
---

메이븐(Maven)을 이용한 프로젝트 빌드, 의존성 관리, 로깅(log4j) 설정 방법을 다룬다.

---

## 1. 메이븐이란?

지금까지는 스프링 라이브러리를 **직접 다운로드**하여 프로젝트에 추가했다. 하지만 스프링 버전이 업데이트될 때마다 관련 라이브러리를 일일이 수정해야 하는 불편함이 있었다.

**메이븐(Maven)**은 이런 문제를 해결하는 **빌드 도구**다. 프로젝트 구조와 의존성을 선언적으로 관리하며, 컴파일·테스트·패키징·배포까지 자동화한다.

```
  빌드 도구의 역할

  소스 코드
       │
       ▼
  ┌────────────────┐
  │  컴파일         │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  테스트 실행     │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  패키징 (WAR)   │
  └───────┬────────┘
          │
          ▼
     배포 / 실행
```

| 빌드 도구 | 설정 방식 | 특징 |
|:-----|:-----|:-----|
| Ant | XML (build.xml) | 절차적, 자유도 높음 |
| **Maven** | XML (pom.xml) | 선언적, 표준 구조 |
| Gradle | Groovy/Kotlin DSL | 유연함, 빌드 속도 빠름 |

{{< callout type="info" >}}
빌드란 단순히 컴파일만 의미하지 않는다. 컴파일 → 테스트 → 패키징 → 배포까지의 **전체 과정**을 빌드라고 한다. 메이븐은 이 과정을 자동으로 수행해 주는 빌드 도구이다.
{{< /callout >}}

---

## 2. 메이븐 프로젝트 구조

메이븐은 **표준 디렉터리 구조**를 사용한다. 모든 메이븐 프로젝트는 동일한 구조를 따르므로 프로젝트 간 이동 시에도 쉽게 파악할 수 있다.

```
  메이븐 프로젝트 구조

  my-project/
  ├── pom.xml
  ├── src/
  │   ├── main/
  │   │   ├── java/
  │   │   ├── resources/
  │   │   └── webapp/
  │   └── test/
  │       ├── java/
  │       └── resources/
  └── target/
```

| 구성 요소 | 설명 |
|:-----|:-----|
| `pom.xml` | 프로젝트 정보와 라이브러리 의존성을 설정하는 핵심 파일 |
| `src/main/java` | 애플리케이션 자바 소스 파일 |
| `src/main/resources` | 프로퍼티, XML 등 리소스 파일 |
| `src/main/webapp` | JSP, HTML, WEB-INF 등 웹 리소스 |
| `src/test/java` | JUnit 등 테스트 코드 |
| `src/test/resources` | 테스트용 리소스 파일 |
| `target/` | 빌드 결과물이 생성되는 디렉터리 |

---

## 3. pom.xml 구성

`pom.xml`은 **Project Object Model**의 약자로, 메이븐 프로젝트의 모든 설정이 담긴 핵심 파일이다.

### 프로젝트 정보

```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>my-web-app</artifactId>
    <version>1.0.0</version>
    <packaging>war</packaging>
</project>
```

| 태그 | 설명 |
|:-----|:-----|
| `groupId` | 프로젝트 그룹 ID (보통 도메인 역순) |
| `artifactId` | 프로젝트 이름 (패키지 이름) |
| `version` | 프로젝트 버전 |
| `packaging` | 패키징 타입 (`war`, `jar` 등) |

### 의존성(dependency) 설정

```xml
<dependencies>
    <!-- 스프링 프레임워크 -->
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-webmvc</artifactId>
        <version>4.3.30.RELEASE</version>
    </dependency>

    <!-- log4j 로깅 -->
    <dependency>
        <groupId>log4j</groupId>
        <artifactId>log4j</artifactId>
        <version>1.2.17</version>
    </dependency>
</dependencies>
```

| 태그 | 설명 |
|:-----|:-----|
| `dependency` | 의존하는 라이브러리 정보를 기술 |
| `groupId` | 라이브러리의 그룹 ID |
| `artifactId` | 라이브러리의 아티팩트 ID |
| `version` | 라이브러리 버전 |

```
  의존성 관리 흐름

  pom.xml 작성
       │
       ▼
  ┌────────────────┐
  │ 메이븐 실행      │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ 중앙 저장소에서   │
  │ 라이브러리 다운   │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ 로컬 저장소      │
  │ (~/.m2)에 캐시  │
  └───────┬────────┘
          │
          ▼
  프로젝트 빌드에 사용
```

{{< callout type="info" >}}
메이븐은 의존 라이브러리가 또 다른 라이브러리에 의존하는 **전이적 의존성(transitive dependency)**까지 자동으로 해결한다. `spring-webmvc`를 추가하면 `spring-core`, `spring-beans` 등 관련 라이브러리가 함께 다운로드된다.
{{< /callout >}}

---

## 4. log4j — 로깅 프레임워크

실제 애플리케이션에서는 사용자 접속 정보, 메서드 호출 시각 등 다양한 정보를 로그로 남겨야 한다. **log4j**는 이런 로그 기능을 제공하는 라이브러리다.

### log4j 구성 요소

```
  log4j 동작 흐름

  애플리케이션 코드
  (logger.info(...))
         │
         ▼
  ┌────────────────┐
  │  Logger        │
  │  (레벨 판단)    │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  Appender      │
  │  (출력 위치)    │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  Layout        │
  │  (출력 형식)    │
  └────────────────┘
```

| 태그 | 역할 | 설명 |
|:-----|:-----|:-----|
| `<Logger>` | 로그 전달 | 로그 레벨을 기준으로 출력 여부 결정 |
| `<Appender>` | 출력 위치 | 콘솔, 파일, DB 등 어디에 출력할지 결정 |
| `<Layout>` | 출력 형식 | 날짜, 레벨, 메시지 등 출력 포맷 결정 |

### Appender 종류

| Appender 클래스 | 출력 대상 |
|:-----|:-----|
| `ConsoleAppender` | 콘솔(터미널) |
| `FileAppender` | 지정한 파일 |
| `RollingFileAppender` | 파일 크기 초과 시 새 파일로 교체 |
| `DailyRollingFileAppender` | 날짜 단위로 새 파일 생성 |

### log4j.xml 설정 예시

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE log4j:configuration SYSTEM
    "log4j.dtd">
<log4j:configuration>

    <!-- 콘솔 출력 설정 -->
    <appender name="console"
        class="org.apache.log4j.ConsoleAppender">
        <layout
            class="org.apache.log4j.PatternLayout">
            <param name="ConversionPattern"
                value="%d{yyyy-MM-dd HH:mm:ss}
                       [%-5p] %c - %m%n" />
        </layout>
    </appender>

    <!-- 루트 로거 설정 -->
    <root>
        <priority value="info" />
        <appender-ref ref="console" />
    </root>

</log4j:configuration>
```

### PatternLayout 출력 속성

| 속성 | 설명 | 출력 예시 |
|:-----|:-----|:-----|
| `%p` | 로그 레벨 | `INFO`, `ERROR` |
| `%m` | 로그 메시지 | 개발자가 작성한 내용 |
| `%d` | 발생 시각 | `2026-03-22 10:30:00` |
| `%c` | 클래스 전체 경로 | `com.example.MyClass` |
| `%F` | 파일 이름 | `MyClass.java` |
| `%L` | 라인 번호 | `42` |
| `%M` | 메서드 이름 | `doProcess` |
| `%n` | 줄바꿈 | - |

---

## 5. log4j 로그 레벨

log4j는 **6단계 로그 레벨**을 제공한다. 설정한 레벨 이상의 메시지만 출력된다.

| 레벨 | 용도 | 설명 |
|:-----|:-----|:-----|
| `FATAL` | 치명적 오류 | 시스템이 동작 불가능한 상태 |
| `ERROR` | 오류 | 실행 중 문제 발생 |
| `WARN` | 경고 | 잠재적 문제 가능성 |
| `INFO` | 정보 | 운영 관련 상태 변경 |
| `DEBUG` | 디버그 | 개발 시 디버깅 정보 |
| `TRACE` | 추적 | DEBUG보다 상세한 정보 |

```
  로그 레벨 계층 (위로 갈수록 심각)

  FATAL  ← 가장 심각
  ERROR
  WARN
  INFO   ← 운영 환경 기본
  DEBUG  ← 개발 환경 기본
  TRACE  ← 가장 상세
```

{{< callout type="warning" >}}
로그 레벨을 `DEBUG`로 설정하면 `DEBUG` 이상(`DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`)의 메시지가 모두 출력된다. **운영 환경에서는 `INFO` 이상**으로 설정하여 불필요한 로그 출력을 방지하자.
{{< /callout >}}

### 사용 예시

```java
import org.apache.log4j.Logger;

public class MemberController {

    private static final Logger logger =
        Logger.getLogger(
            MemberController.class);

    public void login(String userId) {
        logger.debug("로그인 시도: " + userId);
        logger.info("로그인 성공: " + userId);
        logger.warn("비밀번호 3회 오류: "
            + userId);
        logger.error("DB 연결 실패");
    }
}
```

---

## 6. 메이븐 기반 스프링 프로젝트

### 기존 방식 vs 메이븐 방식 비교

| 항목 | 기존 방식 | 메이븐 방식 |
|:-----|:-----|:-----|
| 라이브러리 | 수동 다운로드·추가 | pom.xml에 선언 |
| 버전 관리 | 수동 교체 | 버전 번호만 변경 |
| 의존성 | 직접 파악·추가 | 자동 해결 |
| 프로젝트 구조 | 자유 형식 | 표준 구조 |
| 빌드 | 수동 | `mvn` 명령으로 자동화 |

### 스프링 MVC 메이븐 pom.xml 예시

```xml
<dependencies>
    <!-- Spring Web MVC -->
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-webmvc</artifactId>
        <version>4.3.30.RELEASE</version>
    </dependency>

    <!-- MyBatis-Spring -->
    <dependency>
        <groupId>org.mybatis</groupId>
        <artifactId>mybatis-spring</artifactId>
        <version>1.3.2</version>
    </dependency>

    <!-- Oracle JDBC -->
    <dependency>
        <groupId>com.oracle</groupId>
        <artifactId>ojdbc6</artifactId>
        <version>11.2.0</version>
    </dependency>

    <!-- log4j -->
    <dependency>
        <groupId>log4j</groupId>
        <artifactId>log4j</artifactId>
        <version>1.2.17</version>
    </dependency>
</dependencies>
```

{{< callout type="info" >}}
메이븐 중앙 저장소(https://mvnrepository.com)에서 필요한 라이브러리의 `groupId`, `artifactId`, `version`을 검색하여 `pom.xml`에 추가하면 된다. 한 번 다운로드된 라이브러리는 **로컬 저장소(~/.m2/repository)**에 캐시되어 재사용된다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 메이븐 | 프로젝트 빌드와 의존성을 자동 관리하는 빌드 도구 |
| `pom.xml` | 프로젝트 정보와 라이브러리 의존성을 선언하는 설정 파일 |
| 표준 구조 | `src/main/java`, `resources`, `webapp` 등 일관된 디렉터리 |
| 의존성 관리 | `dependency` 선언만으로 라이브러리 자동 다운로드 |
| log4j | Logger, Appender, Layout으로 구성된 로깅 프레임워크 |
| 로그 레벨 | TRACE → DEBUG → INFO → WARN → ERROR → FATAL 순 |
