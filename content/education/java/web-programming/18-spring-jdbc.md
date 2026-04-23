---
title: "18. 스프링 JDBC 기능"
weight: 18
---

스프링 프레임워크가 제공하는 JDBC 추상화 계층과 `JdbcTemplate` 사용법을 다룬다.

---

## 1. 기존 JDBC의 문제점

순수 JDBC는 이해하기 쉽고 직관적이지만, 코드가 반복적이고 리소스 관리가 번거롭다.

```java
Connection conn = null;
PreparedStatement pstmt = null;
ResultSet rs = null;
try {
    conn = dataSource.getConnection();
    pstmt = conn.prepareStatement(
        "SELECT * FROM member WHERE id = ?");
    pstmt.setString(1, id);
    rs = pstmt.executeQuery();
    // 결과 처리
} catch (SQLException e) {
    e.printStackTrace();
} finally {
    // 리소스 해제 (역순)
    if (rs != null) rs.close();
    if (pstmt != null) pstmt.close();
    if (conn != null) conn.close();
}
```

| 문제 | 설명 |
|:-----|:-----|
| 반복 코드 | Connection 획득 → Statement 생성 → 실행 → 해제가 매번 반복 |
| 리소스 누수 | `close()` 누락 시 커넥션 풀 고갈 |
| 예외 처리 복잡 | `SQLException`이 모든 상황에 사용되어 원인 파악이 어려움 |
| SQL 혼재 | 비즈니스 로직과 데이터 접근 코드가 뒤섞임 |

---

## 2. 스프링 JDBC의 개선점

스프링 JDBC는 기존 JDBC의 장점은 유지하면서 반복적인 저수준 코드를 제거한다.

```
  기존 JDBC vs 스프링 JDBC

  [기존 JDBC]
  Connection 획득
       │
       ▼
  Statement 생성
       │
       ▼
  파라미터 바인딩
       │
       ▼
  SQL 실행 ← 개발자 관심 영역
       │
       ▼
  결과 매핑 ← 개발자 관심 영역
       │
       ▼
  예외 처리
       │
       ▼
  리소스 해제

  [스프링 JDBC]
  SQL 작성   ← 개발자
  결과 매핑  ← 개발자
  나머지     ← 프레임워크
```

| 구분 | 기존 JDBC | 스프링 JDBC |
|:-----|:-----|:-----|
| 커넥션 관리 | 직접 획득/해제 | 자동 처리 |
| 예외 처리 | `SQLException` 직접 처리 | `DataAccessException`으로 변환 |
| 리소스 해제 | finally에서 직접 | 자동 해제 |
| 코드량 | 많음 | SQL과 매핑만 작성 |

---

## 3. 스프링 JDBC 설정

### 설정 파일 구성

| 파일 | 역할 |
|:-----|:-----|
| `web.xml` | `ContextLoaderListener`로 빈 설정 파일을 로드 |
| `jdbc.properties` | DB 연결 정보(URL, 드라이버, 계정) 저장 |
| `action-dataSource.xml` | DataSource 빈 설정 |
| `action-service.xml` | Service 빈 설정 |

### jdbc.properties

```properties
jdbc.driverClass=oracle.jdbc.driver.OracleDriver
jdbc.url=jdbc:oracle:thin:@localhost:1521:XE
jdbc.username=scott
jdbc.password=tiger
```

### DataSource 빈 설정

```xml
<beans ...>
    <!-- properties 파일 로드 -->
    <context:property-placeholder
        location="classpath:jdbc.properties" />

    <!-- DataSource 설정 -->
    <bean id="dataSource"
      class="org.apache.commons.dbcp
             .BasicDataSource"
      destroy-method="close">
        <property name="driverClassName"
            value="${jdbc.driverClass}" />
        <property name="url"
            value="${jdbc.url}" />
        <property name="username"
            value="${jdbc.username}" />
        <property name="password"
            value="${jdbc.password}" />
    </bean>
</beans>
```

### web.xml — ContextLoaderListener 설정

```xml
<web-app ...>
    <listener>
        <listener-class>
            org.springframework.web
            .context.ContextLoaderListener
        </listener-class>
    </listener>

    <context-param>
        <param-name>
            contextConfigLocation
        </param-name>
        <param-value>
            /WEB-INF/config/action-*.xml
        </param-value>
    </context-param>
</web-app>
```

{{< callout type="info" >}}
`ContextLoaderListener`는 서블릿 컨텍스트가 초기화될 때 스프링의 `ApplicationContext`를 생성한다. 와일드카드(`action-*.xml`)를 사용하면 여러 설정 파일을 한 번에 로드할 수 있다.
{{< /callout >}}

---

## 4. JdbcTemplate 클래스

스프링 JDBC의 핵심 클래스로, SQL 실행과 결과 매핑을 간결하게 처리한다.

### 주요 메서드

| 기능 | 메서드 | 설명 |
|:-----|:-----|:-----|
| INSERT/UPDATE/DELETE | `update(String sql)` | SQL 실행, 영향받은 행 수 반환 |
| INSERT/UPDATE/DELETE | `update(String sql, Object[] args)` | 파라미터 바인딩 후 실행 |
| 단건 조회 | `queryForObject(String sql, RowMapper, args)` | 결과를 객체로 매핑 |
| 목록 조회 | `query(String sql, RowMapper)` | 결과를 리스트로 매핑 |
| 단일 값 조회 | `queryForObject(String sql, Class)` | 단일 값(int, String 등) 반환 |

### DAO 클래스 작성

```java
@Repository("memberDAO")
public class MemberDAOImpl implements MemberDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // 전체 회원 조회
    @Override
    public List<MemberVO> listMembers() {
        String sql = "SELECT * FROM t_member"
            + " ORDER BY joinDate DESC";

        List<MemberVO> list =
            jdbcTemplate.query(sql,
                new RowMapper<MemberVO>() {
            @Override
            public MemberVO mapRow(
                    ResultSet rs, int rowNum)
                    throws SQLException {
                MemberVO vo = new MemberVO();
                vo.setId(rs.getString("id"));
                vo.setPwd(rs.getString("pwd"));
                vo.setName(rs.getString("name"));
                vo.setEmail(rs.getString("email"));
                vo.setJoinDate(
                    rs.getDate("joinDate"));
                return vo;
            }
        });
        return list;
    }

    // 회원 추가
    @Override
    public int addMember(MemberVO vo) {
        String sql = "INSERT INTO t_member"
            + " (id, pwd, name, email)"
            + " VALUES (?, ?, ?, ?)";

        return jdbcTemplate.update(sql,
            vo.getId(),
            vo.getPwd(),
            vo.getName(),
            vo.getEmail());
    }

    // 회원 삭제
    @Override
    public int delMember(String id) {
        String sql = "DELETE FROM t_member"
            + " WHERE id = ?";

        return jdbcTemplate.update(sql, id);
    }
}
```

---

## 5. RowMapper를 이용한 결과 매핑

`RowMapper`는 `ResultSet`의 각 행을 자바 객체로 변환하는 콜백 인터페이스다.

```
  query() 실행 흐름

  jdbcTemplate.query()
       │
       ▼
  SQL 실행 → ResultSet
       │
       ▼
  ┌──────────────┐
  │  RowMapper   │
  │  mapRow() 호출│
  │  (행마다 반복) │
  └──────┬───────┘
         │
         ▼
  List<MemberVO> 반환
```

### 람다식으로 간결하게 작성

```java
public List<MemberVO> listMembers() {
    String sql =
        "SELECT * FROM t_member";

    return jdbcTemplate.query(sql,
        (rs, rowNum) -> {
            MemberVO vo = new MemberVO();
            vo.setId(rs.getString("id"));
            vo.setPwd(rs.getString("pwd"));
            vo.setName(rs.getString("name"));
            vo.setEmail(rs.getString("email"));
            return vo;
        });
}
```

{{< callout type="info" >}}
`RowMapper`는 함수형 인터페이스이므로 **람다식**으로 간결하게 작성할 수 있다. Java 8 이상이라면 람다식 사용을 권장한다.
{{< /callout >}}

---

## 6. JdbcTemplate을 빈으로 주입하기

### XML 설정 방식

```xml
<!-- JdbcTemplate 빈 등록 -->
<bean id="jdbcTemplate"
  class="org.springframework.jdbc
         .core.JdbcTemplate">
    <property name="dataSource"
        ref="dataSource" />
</bean>

<!-- DAO에 JdbcTemplate 주입 -->
<bean id="memberDAO"
    class="com.spring.dao.MemberDAOImpl">
    <property name="jdbcTemplate"
        ref="jdbcTemplate" />
</bean>
```

### 어노테이션 방식

```java
@Repository("memberDAO")
public class MemberDAOImpl
        implements MemberDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ...
}
```

| 방식 | 장점 | 단점 |
|:-----|:-----|:-----|
| XML | 설정이 한 곳에 모임 | 코드와 설정이 분리되어 추적 어려움 |
| 어노테이션 | 코드에서 바로 확인 가능 | 설정 변경 시 재컴파일 필요 |

---

## 7. DataAccessException 계층 구조

스프링은 JDBC의 `SQLException`을 의미 있는 예외 계층으로 변환한다.

| 스프링 예외 | 원인 |
|:-----|:-----|
| `BadSqlGrammarException` | SQL 문법 오류 |
| `DuplicateKeyException` | 중복 키 위반 |
| `DataIntegrityViolationException` | 무결성 제약 위반 |
| `DataAccessResourceFailureException` | DB 연결 실패 |
| `EmptyResultDataAccessException` | 결과가 없는데 단건 조회 시도 |

{{< callout type="warning" >}}
`DataAccessException`은 **Unchecked Exception**(RuntimeException)이다. 기존 JDBC의 `SQLException`(Checked)과 달리 try-catch를 강제하지 않으므로, 필요한 곳에서만 선택적으로 처리할 수 있다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 스프링 JDBC | 기존 JDBC의 반복 코드를 제거한 추상화 계층 |
| `JdbcTemplate` | SQL 실행과 결과 매핑을 담당하는 핵심 클래스 |
| `RowMapper` | ResultSet → 자바 객체 변환 콜백 |
| `DataSource` | DB 연결 정보를 관리하는 빈 |
| `DataAccessException` | JDBC 예외를 의미 있는 Unchecked 예외로 변환 |

### 기존 JDBC vs 스프링 JDBC 비교

| 구분 | 기존 JDBC | 스프링 JDBC |
|:-----|:-----|:-----|
| 커넥션 관리 | `DriverManager` 직접 사용 | `DataSource` 빈으로 주입 |
| SQL 실행 | `PreparedStatement` 직접 생성 | `JdbcTemplate` 메서드 호출 |
| 결과 매핑 | `ResultSet` 수동 순회 | `RowMapper` 콜백 |
| 예외 처리 | `SQLException` (Checked) | `DataAccessException` (Unchecked) |
| 리소스 해제 | finally에서 직접 close | 프레임워크가 자동 처리 |
