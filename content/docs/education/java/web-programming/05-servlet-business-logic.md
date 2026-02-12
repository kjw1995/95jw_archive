---
title: "05. 서블릿 비즈니스 로직 처리"
weight: 6
---

서블릿이 클라이언트 요청을 받아 DB 연동 등 실제 작업을 수행하는 것을 **비즈니스 로직 처리**라 한다.

---

## 1. Statement vs PreparedStatement

### Statement의 문제점

Statement는 SQL문을 **문자열 그대로** DBMS에 전달한다. DBMS는 매번 SQL을 파싱하고 컴파일해야 하므로 반복 실행 시 성능이 떨어진다.

```
  Statement 실행 흐름
        │
        ▼
┌────────────────┐
│ SQL 문자열 전달  │
│ (매번 새로 전달) │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ DBMS           │
│ ① 구문 분석    │ ← 매번 반복
│ ② 컴파일      │ ← 매번 반복
│ ③ 실행        │
└────────────────┘
```

```java
// Statement 방식 - 매번 SQL을 새로 컴파일
Statement stmt = conn.createStatement();
String sql = "SELECT * FROM member"
           + " WHERE id='" + id + "'";
ResultSet rs = stmt.executeQuery(sql);
```

### PreparedStatement의 동작 원리

PreparedStatement는 SQL문을 **미리 컴파일**하여 DBMS에 캐싱한다. 이후 `?`(바인드 변수)에 값만 바꿔 넣으므로 반복 실행 시 훨씬 빠르다.

```
  PreparedStatement 실행 흐름
        │
        ▼
┌────────────────┐
│ SQL 템플릿 전달  │
│ (? 포함)       │
└───────┬────────┘
        │ 최초 1회만
        ▼
┌────────────────┐
│ DBMS           │
│ ① 구문 분석    │ ← 최초 1회
│ ② 컴파일      │ ← 최초 1회
│ ③ 캐싱        │
└───────┬────────┘
        │ 이후 실행
        ▼
┌────────────────┐
│ ? 값만 바인딩   │
│ → 바로 실행    │
└────────────────┘
```

```java
// PreparedStatement 방식 - 컴파일된 SQL 재사용
String sql = "SELECT * FROM member"
           + " WHERE id = ?";
PreparedStatement pstmt
    = conn.prepareStatement(sql);
pstmt.setString(1, id);  // ? 에 값 바인딩
ResultSet rs = pstmt.executeQuery();
```

### 비교

| 구분 | Statement | PreparedStatement |
|:-----|:----------|:------------------|
| SQL 컴파일 | 매번 수행 | 최초 1회만 수행 |
| 실행 속도 | 느림 | 빠름 (캐싱) |
| SQL Injection | 취약 | 안전 |
| 파라미터 바인딩 | 문자열 연결 | `?` + setter |
| 가독성 | 낮음 | 높음 |
| 반복 실행 | 비효율적 | 효율적 |

### PreparedStatement 주요 메서드

| 반환형 | 메서드 | 기능 |
|:-------|:-------|:-----|
| `ResultSet` | `executeQuery()` | SELECT 실행 |
| `int` | `executeUpdate()` | INSERT/UPDATE/DELETE 실행 |
| `void` | `setString(idx, val)` | 문자열 바인딩 |
| `void` | `setInt(idx, val)` | 정수 바인딩 |
| `void` | `setDate(idx, val)` | 날짜 바인딩 |
| `void` | `setTimestamp(idx, val)` | 타임스탬프 바인딩 |
| `void` | `setNull(idx, type)` | NULL 바인딩 |

> `?`의 인덱스는 **1부터** 시작한다.

### SQL Injection 방어

Statement는 문자열 결합으로 SQL을 만들기 때문에 악의적 입력에 취약하다. PreparedStatement는 `?`에 바인딩된 값을 **데이터로만** 처리하므로 SQL 구문으로 해석되지 않는다.

```java
// 위험: Statement + 문자열 결합
// 입력값: ' OR '1'='1
String sql = "SELECT * FROM member"
    + " WHERE id='" + userInput + "'"
    + " AND pw='" + pwInput + "'";
// 결과: WHERE id='' OR '1'='1' AND pw=...
// → 모든 회원 정보가 노출됨

// 안전: PreparedStatement
String sql = "SELECT * FROM member"
           + " WHERE id = ? AND pw = ?";
PreparedStatement pstmt
    = conn.prepareStatement(sql);
pstmt.setString(1, userInput);
pstmt.setString(2, pwInput);
// → ? 값은 항상 데이터로만 처리됨
```

---

## 2. 커넥션풀 (Connection Pool)

### 기존 방식의 문제

요청마다 DB 연결을 생성하고 닫는 방식은 연결 생성 비용이 크고, 동시 요청이 많으면 DB에 과부하가 걸린다.

```
  기존 방식 (요청마다 연결)

  요청1 ──── open ──── DB
              close ───┘
  요청2 ──── open ──── DB
              close ───┘
  요청3 ──── open ──── DB
              close ───┘

  → 매번 연결/해제 반복 (느림)
```

### 커넥션풀 동작 과정

커넥션풀은 애플리케이션 시작 시 미리 DB 연결을 생성해두고, 요청이 올 때 빌려주고 반납받는 방식이다.

```
  커넥션풀 방식

┌────────────────┐
│ 톰캣 시작       │
│                │
│ Pool 생성      │
│ ┌──┐┌──┐┌──┐  │
│ │C1││C2││C3│  │ ← 미리 연결
│ └──┘└──┘└──┘  │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ 요청 발생       │
│                │
│ C1 빌려줌 →    │ 사용
│ C1 반납 ←      │ 완료
│                │
│ C2 빌려줌 →    │ 사용
│ C2 반납 ←      │ 완료
└────────────────┘
```

1. 톰캣 컨테이너 실행 시 ConnectionPool 객체를 생성한다
2. 설정된 수만큼 미리 DB와 연결(Connection)을 만들어 둔다
3. 애플리케이션이 연결이 필요하면 풀에서 빌려 사용한다
4. 작업이 끝나면 연결을 풀에 **반납**한다 (close가 아님)

### 커넥션풀의 이점

| 항목 | 설명 |
|:-----|:-----|
| 성능 향상 | 미리 만든 연결을 재사용하여 연결 생성 비용 제거 |
| 자원 관리 | 최대 연결 수를 제한하여 DB 과부하 방지 |
| 안정성 | 유휴 연결 검증, 타임아웃 등 자동 관리 |
| 응답 속도 | 대기 없이 즉시 연결 획득 가능 |

---

## 3. DataSource

실제 웹 애플리케이션에서 커넥션풀을 사용할 때는 `javax.sql.DataSource` 인터페이스를 이용한다. DataSource는 커넥션풀을 관리하며, `getConnection()` 메서드로 풀에서 연결을 꺼내준다.

### DataSource 접근 흐름

```
  서블릿
    │
    │ ① JNDI lookup
    ▼
┌────────────────┐
│ JNDI           │
│ key: jdbc/myDB │
│                │
│ → DataSource   │
└───────┬────────┘
        │ ② getConnection()
        ▼
┌────────────────┐
│ ConnectionPool │
│ ┌──┐┌──┐┌──┐  │
│ │C1││C2││C3│  │
│ └──┘└──┘└──┘  │
└───────┬────────┘
        │ ③ Connection 반환
        ▼
  서블릿에서 DB 작업
```

### JNDI를 통한 DataSource 접근

JNDI(Java Naming and Directory Interface)는 필요한 자원을 **key/value** 쌍으로 저장한 후, key를 이용해 자원에 접근하는 방식이다. 톰캣이 생성한 ConnectionPool 객체에 JNDI 이름을 부여하고, 서블릿에서 이 이름으로 조회한다.

| JNDI 사용 예 | 설명 |
|:-------------|:-----|
| `getParameter(name)` | name으로 파라미터 값 조회 |
| `HashMap.get(key)` | key로 value 조회 |
| DNS 조회 | 도메인명으로 IP 주소 조회 |
| DataSource 조회 | JNDI 이름으로 커넥션풀 조회 |

### 톰캣 DataSource 설정

**context.xml**

```xml
<Context>
    <Resource
        name="jdbc/oracle"
        auth="Container"
        type="javax.sql.DataSource"
        driverClassName=
            "oracle.jdbc.OracleDriver"
        url=
            "jdbc:oracle:thin:@localhost:1521:XE"
        username="scott"
        password="tiger"
        maxTotal="20"
        maxIdle="10"
        maxWaitMillis="-1" />
</Context>
```

| 속성 | 설명 |
|:-----|:-----|
| `name` | JNDI 조회에 사용할 이름 |
| `auth` | 인증 주체 (Container: 톰캣 관리) |
| `type` | 리소스 타입 |
| `driverClassName` | JDBC 드라이버 클래스 |
| `url` | DB 접속 URL |
| `maxTotal` | 풀의 최대 연결 수 |
| `maxIdle` | 유휴 상태 최대 연결 수 |
| `maxWaitMillis` | 연결 대기 최대 시간 (-1: 무제한) |

### Java 코드에서 DataSource 사용

```java
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;
import java.sql.Connection;

public class DBUtil {

    private static DataSource ds;

    static {
        try {
            Context ctx =
                new InitialContext();
            Context envCtx =
                (Context) ctx.lookup(
                    "java:comp/env");
            ds = (DataSource) envCtx.lookup(
                    "jdbc/oracle");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static Connection getConnection()
        throws Exception {
        return ds.getConnection();
    }
}
```

---

## 4. 서블릿 DB 연동 예제

### 회원 조회 서블릿

```java
@WebServlet("/members")
public class MemberServlet
    extends HttpServlet {

    @Override
    protected void doGet(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws ServletException, IOException {

        resp.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();

        try (
            Connection conn =
                DBUtil.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(
                    "SELECT * FROM member");
            ResultSet rs =
                pstmt.executeQuery()
        ) {
            out.println("<html><body>");
            out.println("<h2>회원 목록</h2>");
            out.println("<table border='1'>");
            out.println("<tr>");
            out.println("<th>ID</th>");
            out.println("<th>이름</th>");
            out.println("<th>이메일</th>");
            out.println("</tr>");

            while (rs.next()) {
                out.println("<tr>");
                out.println("<td>"
                    + rs.getString("id")
                    + "</td>");
                out.println("<td>"
                    + rs.getString("name")
                    + "</td>");
                out.println("<td>"
                    + rs.getString("email")
                    + "</td>");
                out.println("</tr>");
            }

            out.println("</table>");
            out.println("</body></html>");

        } catch (Exception e) {
            e.printStackTrace();
            out.println("오류: "
                + e.getMessage());
        }
    }
}
```

### 회원 등록 서블릿

```java
@WebServlet("/addMember")
public class AddMemberServlet
    extends HttpServlet {

    @Override
    protected void doPost(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");

        String id =
            req.getParameter("id");
        String name =
            req.getParameter("name");
        String email =
            req.getParameter("email");

        String sql =
            "INSERT INTO member"
          + " (id, name, email)"
          + " VALUES (?, ?, ?)";

        try (
            Connection conn =
                DBUtil.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(sql)
        ) {
            pstmt.setString(1, id);
            pstmt.setString(2, name);
            pstmt.setString(3, email);

            int result =
                pstmt.executeUpdate();

            resp.setContentType(
                "text/html;charset=UTF-8");
            PrintWriter out =
                resp.getWriter();

            if (result > 0) {
                out.println("등록 성공");
            } else {
                out.println("등록 실패");
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### CRUD 패턴 요약

| 작업 | SQL | 메서드 | 반환 |
|:-----|:----|:-------|:-----|
| 조회 | `SELECT` | `executeQuery()` | `ResultSet` |
| 등록 | `INSERT` | `executeUpdate()` | `int` (영향 행 수) |
| 수정 | `UPDATE` | `executeUpdate()` | `int` (영향 행 수) |
| 삭제 | `DELETE` | `executeUpdate()` | `int` (영향 행 수) |

---

## 5. DAO 패턴

실무에서는 DB 접근 로직을 서블릿에 직접 작성하지 않고, **DAO(Data Access Object)** 클래스로 분리한다. 이렇게 하면 역할이 분리되어 유지보수가 용이하다.

```
  서블릿 → DAO → DB 구조

┌────────────────┐
│    Servlet     │
│ (요청/응답 처리) │
└───────┬────────┘
        │ 메서드 호출
        ▼
┌────────────────┐
│      DAO       │
│ (DB 접근 전담)  │
└───────┬────────┘
        │ SQL 실행
        ▼
┌────────────────┐
│   Database     │
└────────────────┘
```

### MemberDAO 예제

```java
public class MemberDAO {

    private DataSource ds;

    public MemberDAO() {
        try {
            Context ctx =
                new InitialContext();
            Context envCtx =
                (Context) ctx.lookup(
                    "java:comp/env");
            ds = (DataSource)
                envCtx.lookup(
                    "jdbc/oracle");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 전체 조회
    public List<MemberVO> selectAll() {
        List<MemberVO> list =
            new ArrayList<>();
        String sql =
            "SELECT * FROM member";

        try (
            Connection conn =
                ds.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(sql);
            ResultSet rs =
                pstmt.executeQuery()
        ) {
            while (rs.next()) {
                MemberVO vo =
                    new MemberVO();
                vo.setId(
                    rs.getString("id"));
                vo.setName(
                    rs.getString("name"));
                vo.setEmail(
                    rs.getString("email"));
                list.add(vo);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    // 등록
    public int insert(MemberVO vo) {
        int result = 0;
        String sql =
            "INSERT INTO member"
          + " (id, name, email)"
          + " VALUES (?, ?, ?)";

        try (
            Connection conn =
                ds.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(sql)
        ) {
            pstmt.setString(1,
                vo.getId());
            pstmt.setString(2,
                vo.getName());
            pstmt.setString(3,
                vo.getEmail());
            result =
                pstmt.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }

    // 수정
    public int update(MemberVO vo) {
        int result = 0;
        String sql =
            "UPDATE member"
          + " SET name = ?, email = ?"
          + " WHERE id = ?";

        try (
            Connection conn =
                ds.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(sql)
        ) {
            pstmt.setString(1,
                vo.getName());
            pstmt.setString(2,
                vo.getEmail());
            pstmt.setString(3,
                vo.getId());
            result =
                pstmt.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }

    // 삭제
    public int delete(String id) {
        int result = 0;
        String sql =
            "DELETE FROM member"
          + " WHERE id = ?";

        try (
            Connection conn =
                ds.getConnection();
            PreparedStatement pstmt =
                conn.prepareStatement(sql)
        ) {
            pstmt.setString(1, id);
            result =
                pstmt.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }
}
```

### MemberVO (Value Object)

```java
public class MemberVO {
    private String id;
    private String name;
    private String email;

    // getter / setter
    public String getId() {
        return id;
    }
    public void setId(String id) {
        this.id = id;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getEmail() {
        return email;
    }
    public void setEmail(String email) {
        this.email = email;
    }
}
```

### 서블릿에서 DAO 사용

```java
@WebServlet("/members")
public class MemberServlet
    extends HttpServlet {

    private MemberDAO dao =
        new MemberDAO();

    @Override
    protected void doGet(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws ServletException, IOException {

        resp.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();

        List<MemberVO> list =
            dao.selectAll();

        out.println("<html><body>");
        out.println("<h2>회원 목록</h2>");
        for (MemberVO vo : list) {
            out.println(
                vo.getId() + " / "
              + vo.getName() + " / "
              + vo.getEmail()
              + "<br>");
        }
        out.println("</body></html>");
    }
}
```

---

## 요약

### 핵심 개념

| 항목 | 내용 |
|:-----|:-----|
| PreparedStatement | SQL 미리 컴파일, `?` 바인딩, SQL Injection 방어 |
| ConnectionPool | 미리 DB 연결을 만들어두고 재사용 |
| DataSource | 커넥션풀을 관리하는 표준 인터페이스 |
| JNDI | key/value로 자원을 조회하는 네이밍 서비스 |
| DAO 패턴 | DB 접근 로직을 별도 클래스로 분리 |
| VO 패턴 | 데이터를 담아 전달하는 객체 |

### 서블릿 비즈니스 로직 처리 흐름

```
  클라이언트 (form)
        │
        │ HTTP 요청
        ▼
┌────────────────┐
│    Servlet     │
│ 파라미터 수신   │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│      DAO       │
│ PreparedStmt   │
└───────┬────────┘
        │ JNDI → DataSource
        ▼
┌────────────────┐
│ ConnectionPool │
│ → DB 연동      │
└───────┬────────┘
        │ 결과 반환
        ▼
  클라이언트 (응답)
```
