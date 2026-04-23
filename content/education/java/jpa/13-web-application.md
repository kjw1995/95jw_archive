---
title: "Chapter 13. 웹 애플리케이션 제작"
weight: 13
---

스프링 프레임워크와 JPA 를 함께 사용해 웹 애플리케이션을 구성하는 방법을 다룬다.

{{< callout type="info" >}}
스프링 + JPA 는 **스프링 컨테이너 위에서 JPA 를 사용**한다는 의미다. 스프링 컨테이너가 제공하는 **DB 커넥션 관리**, **트랜잭션 관리**, **예외 추상화** 를 JPA 가 얹어 쓰는 구조다.
{{< /callout >}}

---

## 1. 프로젝트 구조

```
 jpashop (프로젝트 루트)
 ├── src
 │   ├── main
 │   │   ├── java       (소스 코드)
 │   │   ├── resources  (리소스)
 │   │   └── webapp     (웹 폴더)
 │   └── test           (테스트)
 ├── target             (빌드 결과)
 └── pom.xml            (메이븐 설정)
```

---

## 2. 메이븐과 라이브러리 관리

### 2.1 pom.xml 기본 구조

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project ...>
    <modelVersion>4.0.0</modelVersion>

    <groupId>jpabook</groupId>
    <artifactId>jpashop</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>war</packaging>

    <dependencies>
        <!-- 라이브러리 선언 -->
    </dependencies>

    <build>
        <!-- 빌드 설정 -->
    </build>
</project>
```

### 2.2 주요 태그

| 태그 | 설명 |
|:-----|:-----|
| `<groupId>` | 프로젝트 그룹 (예: `org.springframework`) |
| `<artifactId>` | 프로젝트 ID (예: `spring-core`) |
| `<version>` | 프로젝트 버전 |
| `<packaging>` | 패키징 (웹: `war`, 라이브러리: `jar`) |
| `<dependencies>` | 사용할 라이브러리 |

### 2.3 핵심 라이브러리

| 라이브러리 | artifactId | 역할 |
|:-----------|:-----------|:-----|
| 스프링 MVC | `spring-webmvc` | 웹 MVC 기능 |
| 스프링 ORM | `spring-orm` | 스프링 + JPA 연동 |
| 하이버네이트 | `hibernate-entitymanager` | JPA 구현체 |

```
  spring-webmvc
       │
       ▼ (의존성 전이)
  spring-core

  hibernate-entitymanager
       ├── hibernate-core.jar
       └── hibernate-jpa-2.1-api.jar
```

{{< callout type="info" >}}
**의존성 전이(Transitive Dependency)**: `spring-webmvc` 를 선언하면 `spring-core` 등 하위 의존성이 자동으로 내려받아진다. 메이븐이 POM 그래프를 따라 필요한 라이브러리를 추가해주는 기능이다.
{{< /callout >}}

### 2.4 dependency scope

| scope | 설명 |
|:------|:-----|
| compile | 기본값. 컴파일·실행 모두 사용 |
| runtime | 실행 시에만 사용 |
| provided | 외부(WAS)에서 제공. 빌드에 미포함 (JSP, Servlet) |
| test | 테스트 코드에서만 사용 |

---

## 3. 스프링 프레임워크 설정

### 3.1 프로젝트 계층 구조

```
 jpashop/src/main
 ├── java/jpabook/jpashop
 │   ├── domain      (도메인 계층)
 │   ├── repository  (저장 계층)
 │   ├── service     (서비스 계층)
 │   └── web         (웹 계층)
 ├── resources
 │   ├── appConfig.xml
 │   └── webAppConfig.xml
 └── webapp/WEB-INF
     └── web.xml
```

### 3.2 설정 파일 역할

```
  web.xml
  (스프링 구동 설정)
        │
        ▼
  webAppConfig.xml
  (웹 계층)
   • MVC 활성화
   • 컨트롤러 스캔
   • 뷰 리졸버
        │
        ▼
  appConfig.xml
  (비즈니스 계층)
   • 서비스·리포지토리
   • 트랜잭션
   • 데이터소스
   • JPA 설정
```

| 파일 | 담당 |
|:-----|:-----|
| `web.xml` | 스프링 구동 설정 |
| `webAppConfig.xml` | 웹 계층 (MVC, 컨트롤러, 뷰 리졸버) |
| `appConfig.xml` | 비즈니스 계층 (서비스, 리포지토리, 트랜잭션, JPA) |

---

## 4. webAppConfig.xml 설정

```xml
<!-- 스프링 MVC 활성화 -->
<mvc:annotation-driven />

<!-- 컨트롤러 자동 스캔 -->
<context:component-scan
    base-package="jpabook.jpashop.web" />

<!-- 뷰 리졸버 -->
<bean id="viewResolver"
      class="org.springframework.web.servlet
             .view.InternalResourceViewResolver">
    <property name="prefix" value="/WEB-INF/jsp/" />
    <property name="suffix" value=".jsp" />
</bean>
```

### component-scan 동작

```
  base-package: jpabook.jpashop.web
         │
         ▼  스캔 대상 어노테이션
   @Controller   → 빈 등록
   @Service      → 빈 등록
   @Repository   → 빈 등록
   @Component    → 빈 등록
```

---

## 5. appConfig.xml 설정

### 5.1 트랜잭션 관리자

```xml
<!-- 어노테이션 기반 트랜잭션 활성화 -->
<tx:annotation-driven />

<!-- JPA 트랜잭션 관리자 -->
<bean id="transactionManager"
      class="org.springframework.orm.jpa
             .JpaTransactionManager">
    <property name="dataSource" ref="dataSource" />
</bean>
```

| 트랜잭션 관리자 | 용도 |
|:----------------|:-----|
| `DataSourceTransactionManager` | JDBC, MyBatis 전용 |
| `JpaTransactionManager` | JPA 사용 시 필수 |

{{< callout type="info" >}}
`JpaTransactionManager` 는 **`DataSourceTransactionManager` 의 역할도 함께 수행**한다. 같은 트랜잭션 경계에서 JPA 와 JdbcTemplate·MyBatis 를 동시에 사용할 수 있다.
{{< /callout >}}

### 5.2 JPA 예외 변환 AOP

```xml
<bean class="org.springframework.dao.annotation
             .PersistenceExceptionTranslationPostProcessor" />
```

`@Repository` 가 붙은 빈에 예외 변환 AOP 를 적용한다.

```
 JPA 예외 발생
      │
      ▼
 PersistenceException
      │  (AOP 변환)
      ▼
 스프링 추상화 예외
 (DataAccessException)
```

이 변환 덕분에 서비스 계층이 JPA 에만 묶이지 않고, **스프링 데이터 접근 예외 체계**로 통일된다.

### 5.3 엔티티 매니저 팩토리 설정

```xml
<bean id="entityManagerFactory"
      class="org.springframework.orm.jpa
             .LocalContainerEntityManagerFactoryBean">

    <property name="dataSource" ref="dataSource" />
    <property name="packagesToScan"
              value="jpabook.jpashop.domain" />

    <property name="jpaVendorAdapter">
        <bean class="org.springframework.orm.jpa.vendor
                     .HibernateJpaVendorAdapter" />
    </property>

    <property name="jpaProperties">
        <!-- 하이버네이트 속성 -->
    </property>
</bean>
```

| 속성 | 설명 |
|:-----|:-----|
| `dataSource` | 사용할 데이터소스 |
| `packagesToScan` | `@Entity` 검색 시작점 |
| `persistenceUnitName` | 영속성 유닛 이름 (기본: default) |
| `jpaVendorAdapter` | JPA 구현체 (HibernateJpaVendorAdapter) |

{{< callout type="info" >}}
`LocalContainerEntityManagerFactoryBean` 을 사용하면 **`persistence.xml` 없이도** 필요한 설정을 자바·XML 로 모두 할 수 있다. 스프링이 J2SE 환경에서도 표준 컨테이너처럼 JPA 를 쓸 수 있게 에뮬레이션한다.
{{< /callout >}}

---

## 6. 하이버네이트 속성 설정

| 속성 | 설명 |
|:-----|:-----|
| `hibernate.dialect` | DB 방언 |
| `hibernate.show_sql` | 실행 SQL 콘솔 출력 |
| `hibernate.format_sql` | SQL 포맷팅 |
| `hibernate.use_sql_comments` | SQL 주석 출력 |
| `hibernate.id.new_generator_mappings` | 새 ID 전략 사용 |
| `hibernate.hbm2ddl.auto` | DDL 자동 생성 |

### hbm2ddl.auto 옵션

| 옵션 | 동작 |
|:-----|:-----|
| `create` | DDL 제거 후 새로 생성 |
| `create-drop` | create + 종료 시 DROP |
| `update` | 변경사항만 수정 |
| `validate` | 스키마 비교만 (변경 없음) |

{{< callout type="warning" >}}
`hibernate.id.new_generator_mappings` 는 **항상 `true` 로 설정**하자. `false` 이면 과거 버전의 키 생성 전략을 사용해 `allocationSize` 등이 기대와 다르게 동작한다.
{{< /callout >}}

### SQL 로그 설정

콘솔 대신 로거로 SQL 을 출력하려면 `logback.xml` 에 다음을 추가한다.

```xml
<!-- SQL 출력 -->
<logger name="org.hibernate.SQL"
        level="DEBUG" />

<!-- 바인딩 파라미터 출력 -->
<logger name="org.hibernate.type"
        level="TRACE" />
```

{{< callout type="info" >}}
로거를 쓸 때는 `hibernate.show_sql` 을 **꺼야** 한다. 켜두면 System.out 과 로거에 **SQL 이 중복 출력**된다.
{{< /callout >}}

---

## 정리

```
  웹 애플리케이션 구성

  1. 메이븐
    └── pom.xml 로 의존성 관리

  2. 설정 파일 분리
    ├── web.xml (구동)
    ├── webAppConfig.xml (웹)
    └── appConfig.xml (비즈니스)

  3. JPA 핵심 설정
    ├── JpaTransactionManager
    ├── EntityManagerFactory
    └── 예외 변환 AOP

  4. 하이버네이트
    ├── 방언 (dialect)
    ├── DDL 자동 생성
    └── SQL 로그
```

{{< callout type="info" >}}
현대 스프링 개발에서는 대부분 **스프링 부트**와 `application.yml` 로 이 설정이 자동화된다. 하지만 "왜 자동 설정이 이렇게 되는가" 를 이해하려면 이 장의 XML 기반 구조를 한 번은 알고 있는 편이 좋다.
{{< /callout >}}
