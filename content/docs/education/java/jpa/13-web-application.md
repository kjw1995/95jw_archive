---
title: "Chapter 13. 웹 애플리케이션 제작"
weight: 13
---

스프링 프레임워크와 JPA를 함께 사용하여 웹 애플리케이션을 구성하는 방법을 다룬다.

{{< callout type="info" >}}
스프링 프레임워크와 JPA를 함께 사용한다는 것은 **스프링 컨테이너 위에서 JPA를 사용**한다는 의미다. 스프링 컨테이너가 제공하는 데이터베이스 커넥션과 트랜잭션 처리 기능을 활용할 수 있다.
{{< /callout >}}

---

## 1. 프로젝트 구조

```
jpashop (프로젝트 루트)
├── src
│   ├── main
│   │   ├── java        (소스 코드)
│   │   ├── resources   (리소스)
│   │   └── webapp      (웹 폴더)
│   └── test            (테스트)
├── target              (빌드 결과)
└── pom.xml             (메이븐 설정)
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

### 2.2 pom.xml 주요 태그

| 태그 | 설명 |
|:-----|:-----|
| `<groupId>` | 프로젝트 그룹 명 (예: org.springframework) |
| `<artifactId>` | 프로젝트 식별 ID (예: spring-core) |
| `<version>` | 프로젝트 버전 |
| `<packaging>` | 패키징 방식 (웹: war, 라이브러리: jar) |
| `<dependencies>` | 사용할 라이브러리 목록 |

### 2.3 핵심 라이브러리

| 라이브러리 | artifactId | 역할 |
|:-----------|:-----------|:-----|
| 스프링 MVC | spring-webmvc | 웹 MVC 기능 |
| 스프링 ORM | spring-orm | 스프링 + JPA 연동 |
| 하이버네이트 | hibernate-entitymanager | JPA 구현체 |

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
**의존성 전이(Transitive Dependency)**: `spring-webmvc`를 선언하면 `spring-core`도 자동으로 내려받는다. 메이븐이 의존관계가 있는 라이브러리를 자동으로 추가하는 기능이다.
{{< /callout >}}

### 2.4 dependency scope

| scope | 설명 |
|:------|:-----|
| compile | 기본값. 컴파일 시 사용 |
| runtime | 실행 시에만 사용 |
| provided | 외부에서 제공. 빌드에 미포함 (JSP, Servlet) |
| test | 테스트 코드에서만 사용 |

---

## 3. 스프링 프레임워크 설정

### 3.1 프로젝트 계층 구조

```
jpashop/src/main
├── java/jpabook/jpashop
│   ├── domain        (도메인 계층)
│   ├── repository    (데이터 저장 계층)
│   ├── service       (서비스 계층)
│   └── web           (웹 계층)
├── resources
│   ├── appConfig.xml
│   └── webAppConfig.xml
└── webapp/WEB-INF
    └── web.xml
```

### 3.2 설정 파일 역할

```
┌──────────────────────────┐
│       web.xml            │
│   (스프링 구동 설정)       │
├────────────┬─────────────┤
│            │             │
│            ▼             │
│  ┌────────────────────┐  │
│  │ webAppConfig.xml   │  │
│  │  웹 계층 설정        │  │
│  │  - MVC 활성화       │  │
│  │  - 컨트롤러 스캔     │  │
│  │  - 뷰 리졸버        │  │
│  └────────────────────┘  │
│            │             │
│            ▼             │
│  ┌────────────────────┐  │
│  │ appConfig.xml      │  │
│  │  비즈니스 계층 설정   │  │
│  │  - 서비스, 리포지토리 │  │
│  │  - 트랜잭션         │  │
│  │  - 데이터소스        │  │
│  │  - JPA 설정         │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

| 파일 | 담당 계층 |
|:-----|:---------|
| web.xml | 웹 애플리케이션 환경설정 (스프링 구동) |
| webAppConfig.xml | 웹 계층 (MVC, 컨트롤러, 뷰 리졸버) |
| appConfig.xml | 비즈니스 계층 (서비스, 리포지토리, 트랜잭션, JPA) |

---

## 4. webAppConfig.xml 설정

```xml
<!-- 스프링 MVC 기능 활성화 -->
<mvc:annotation-driven />

<!-- 컨트롤러 자동 스캔 -->
<context:component-scan
    base-package="jpabook.jpashop.web" />

<!-- 뷰 리졸버 등록 -->
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
   @Controller  → 스프링 빈 등록
   @Service     → 스프링 빈 등록
   @Repository  → 스프링 빈 등록
   @Component   → 스프링 빈 등록
```

---

## 5. appConfig.xml 설정

### 5.1 트랜잭션 관리자

```xml
<!-- 어노테이션 기반 트랜잭션 활성화 -->
<tx:annotation-driven />

<!-- JPA 트랜잭션 관리자 등록 -->
<bean id="transactionManager"
    class="org.springframework.orm.jpa
    .JpaTransactionManager">
    <property name="dataSource"
        ref="dataSource" />
</bean>
```

| 트랜잭션 관리자 | 용도 |
|:---------------|:-----|
| DataSourceTransactionManager | JDBC, MyBatis 전용 |
| **JpaTransactionManager** | JPA 사용 시 필수 |

{{< callout type="warning" >}}
`JpaTransactionManager`는 `DataSourceTransactionManager`의 역할도 수행한다. JPA와 JdbcTemplate, MyBatis를 함께 사용할 수 있다.
{{< /callout >}}

### 5.2 JPA 예외 변환 AOP

```xml
<bean class="org.springframework.dao
    .annotation
    .PersistenceExceptionTranslationPostProcessor" />
```

`@Repository` 어노테이션이 붙은 빈에 예외 변환 AOP를 적용한다.

```
JPA 예외 발생
    │
    ▼
PersistenceException
    │ (AOP 변환)
    ▼
스프링 추상화 예외
(DataAccessException)
```

### 5.3 엔티티 매니저 팩토리 설정

```xml
<bean id="entityManagerFactory"
    class="org.springframework.orm.jpa
    .LocalContainerEntityManagerFactoryBean">

    <property name="dataSource"
        ref="dataSource" />

    <property name="packagesToScan"
        value="jpabook.jpashop.domain" />

    <property name="jpaVendorAdapter">
        <bean class="org.springframework
            .orm.jpa.vendor
            .HibernateJpaVendorAdapter" />
    </property>

    <property name="jpaProperties">
        <!-- 하이버네이트 속성 설정 -->
    </property>
</bean>
```

| 속성 | 설명 |
|:-----|:-----|
| dataSource | 사용할 데이터소스 |
| packagesToScan | `@Entity` 클래스 검색 시작점 |
| persistenceUnitName | 영속성 유닛 이름 (기본값: default) |
| jpaVendorAdapter | JPA 구현체 지정 (HibernateJpaVendorAdapter) |

{{< callout type="info" >}}
`LocalContainerEntityManagerFactoryBean`을 사용하면 **persistence.xml 없이도** 필요한 설정을 모두 할 수 있다. 스프링이 J2SE 환경에서도 표준 컨테이너처럼 JPA를 사용할 수 있도록 에뮬레이션한다.
{{< /callout >}}

---

## 6. 하이버네이트 속성 설정

| 속성 | 설명 |
|:-----|:-----|
| `hibernate.dialect` | 데이터베이스 방언 |
| `hibernate.show_sql` | 실행 SQL 콘솔 출력 |
| `hibernate.format_sql` | SQL 보기 좋게 정리 |
| `hibernate.use_sql_comments` | SQL 코멘트 출력 |
| `hibernate.id.new_generator_mappings` | 새로운 ID 생성 전략 사용 |
| `hibernate.hbm2ddl.auto` | DDL 자동 생성 |

### hbm2ddl.auto 옵션

| 옵션 | 동작 |
|:-----|:-----|
| create | 기존 DDL 제거 후 새로 생성 |
| create-drop | create + 종료 시 DDL 제거 |
| update | 변경사항만 수정 |
| validate | 스키마 비교만 수행 (DDL 변경 없음) |

{{< callout type="warning" >}}
`hibernate.id.new_generator_mappings`는 **항상 true로 설정**해야 한다. false이면 하이버네이트 과거 버전의 키 생성 전략을 사용하게 된다.
{{< /callout >}}

### SQL 로그 설정

콘솔 대신 로거를 통해 SQL을 출력하려면 logback.xml에 다음을 설정한다.

```xml
<!-- SQL 출력 -->
<logger name="org.hibernate.SQL"
    level="DEBUG" />

<!-- 바인딩 파라미터 출력 -->
<logger name="org.hibernate.type"
    level="TRACE" />
```

{{< callout type="info" >}}
로거를 사용할 때는 `hibernate.show_sql` 옵션을 꺼야 콘솔에 로그가 중복 출력되지 않는다.
{{< /callout >}}

---

## 정리

```
┌──────────────────────────┐
│  웹 애플리케이션 구성 요약  │
├──────────────────────────┤
│                          │
│  1. 메이븐               │
│   └── pom.xml로 의존성   │
│       관리               │
│                          │
│  2. 설정 파일 분리        │
│   ├── web.xml            │
│   │   (구동 설정)         │
│   ├── webAppConfig.xml   │
│   │   (웹 계층)           │
│   └── appConfig.xml      │
│       (비즈니스 계층)      │
│                          │
│  3. JPA 핵심 설정         │
│   ├── JpaTransactionMgr  │
│   ├── EntityMgrFactory   │
│   └── 예외 변환 AOP       │
│                          │
│  4. 하이버네이트           │
│   ├── 방언(dialect)       │
│   ├── DDL 자동 생성       │
│   └── SQL 로그            │
│                          │
└──────────────────────────┘
```
