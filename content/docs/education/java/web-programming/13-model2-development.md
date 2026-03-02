---
title: "13. 모델2 방식으로 효율적으로 개발하기"
weight: 13
---

웹 애플리케이션의 모델1·모델2 구조를 비교하고, MVC 패턴 기반의 모델2 방식으로 효율적인 웹 개발을 구현하는 방법을 다룬다.

---

## 1. 웹 애플리케이션 모델

웹 애플리케이션을 구성하는 방식은 **모델1**과 **모델2**로 나뉜다. 두 방식의 핵심 차이는 JSP가 모든 역할을 담당하느냐, 역할을 분리하느냐에 있다.

### 모델1 구조

모델1은 **JSP가 요청 처리와 화면 출력을 모두 담당**하는 방식이다. 초기 웹 개발에서 주로 사용되었다.

```
  모델1 구조

  브라우저
      │ 요청
      ▼
  ┌──────────────────┐
  │     JSP 페이지    │
  │  ┌──────────────┐│
  │  │ 비즈니스 로직 ││
  │  │ + 화면 출력   ││
  │  └──────────────┘│
  └────────┬─────────┘
           │ DB 접근
           ▼
  ┌──────────────────┐
  │    데이터베이스    │
  └──────────────────┘
```

### 모델2 구조

모델2는 **서블릿이 요청을 처리**하고, **JSP가 화면을 담당**하는 구조다. 역할이 명확히 분리되어 유지보수가 쉽다.

```
  모델2 구조

  브라우저
      │ 요청
      ▼
  서블릿 (Controller)
      │
      ├─── Model (DAO/VO)
      │       │
      │       ▼
      │    데이터베이스
      │
      │ forward
      ▼
  JSP (View) ──► 브라우저
```

### 모델1 vs 모델2 비교

| 구분 | 모델1 | 모델2 |
|:-----|:-----|:-----|
| 구조 | JSP가 모든 처리 | 서블릿 + JSP 역할 분리 |
| 장점 | 구현이 단순 | 유지보수 용이, 확장성 높음 |
| 단점 | 코드 혼재, 유지보수 어려움 | 초기 설계가 복잡 |
| 적합 대상 | 소규모 프로젝트 | 중·대규모 프로젝트 |
| 디자이너·개발자 협업 | 어려움 | 용이 |

---

## 2. MVC 디자인 패턴

모델2는 **MVC(Model-View-Controller)** 디자인 패턴을 기반으로 한다.

### 각 구성 요소의 역할

| 구성 요소 | 역할 | 웹에서의 구현체 |
|:-----|:-----|:-----|
| Model | 비즈니스 로직, 데이터 처리 | DAO, VO(DTO), Service |
| View | 화면 출력 | JSP |
| Controller | 요청 분석, 흐름 제어 | 서블릿 |

### MVC 동작 흐름

```
  MVC 패턴 동작 흐름

  브라우저
    │ ① 요청
    ▼
  Controller (서블릿)
    │ ② 비즈니스 로직 호출
    ▼
  Model (DAO)
    │ ③ DB 처리
    ▼
  Controller
    │ ④ 결과를 request에 바인딩
    │ ⑤ JSP로 forward
    ▼
  View (JSP)
    │ ⑥ 화면 출력
    ▼
  브라우저
```

{{< callout type="info" >}}
MVC에서 가장 중요한 원칙은 **View에서 비즈니스 로직을 처리하지 않는 것**이다. JSP에는 오직 화면 출력 코드만 작성한다.
{{< /callout >}}

---

## 3. 모델2 기반 회원 관리 예제

모델2 방식으로 회원 목록 조회 기능을 구현하는 전체 흐름을 살펴본다.

### VO(Value Object) 클래스

```java
// MemberVO.java - 데이터 전달 객체
public class MemberVO {
    private String id;
    private String pwd;
    private String name;
    private String email;
    private Date joinDate;

    // getter/setter 생략

    public String getId() { return id; }
    public void setId(String id) {
        this.id = id;
    }
    public String getName() { return name; }
    public void setName(String name) {
        this.name = name;
    }
    // ... 나머지 동일
}
```

### DAO(Data Access Object) 클래스

```java
// MemberDAO.java - DB 접근 객체
public class MemberDAO {
    private DataSource dataFactory;

    public MemberDAO() {
        try {
            Context ctx = new InitialContext();
            dataFactory = (DataSource)
                ctx.lookup(
                    "java:comp/env/jdbc/oracle");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public List<MemberVO> listMembers() {
        List<MemberVO> list = new ArrayList<>();
        try (Connection conn =
                 dataFactory.getConnection();
             PreparedStatement pstmt =
                 conn.prepareStatement(
                     "SELECT * FROM t_member"
                     + " ORDER BY joinDate DESC");
             ResultSet rs =
                 pstmt.executeQuery()) {

            while (rs.next()) {
                MemberVO vo = new MemberVO();
                vo.setId(rs.getString("id"));
                vo.setName(rs.getString("name"));
                vo.setEmail(rs.getString("email"));
                vo.setJoinDate(
                    rs.getDate("joinDate"));
                list.add(vo);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }
}
```

### Controller (서블릿)

```java
// MemberController.java
@WebServlet("/member/*")
public class MemberController
        extends HttpServlet {

    private MemberDAO memberDAO;

    @Override
    public void init() {
        memberDAO = new MemberDAO();
    }

    @Override
    protected void doGet(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {
        doHandle(request, response);
    }

    @Override
    protected void doPost(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {
        doHandle(request, response);
    }

    private void doHandle(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        response.setContentType(
            "text/html;charset=UTF-8");

        // 요청 URL에서 action 추출
        String action = request.getPathInfo();

        if (action == null
                || action.equals("/listMembers")) {
            // 회원 목록 조회
            List<MemberVO> membersList =
                memberDAO.listMembers();

            // request에 바인딩
            request.setAttribute(
                "membersList", membersList);

            // JSP로 forward
            RequestDispatcher rd =
                request.getRequestDispatcher(
                    "/member/listMembers.jsp");
            rd.forward(request, response);
        }
    }
}
```

### View (JSP)

```jsp
<%-- listMembers.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<%@ page import="java.util.List" %>
<%@ page import="com.member.MemberVO" %>
<%
    List<MemberVO> membersList =
        (List<MemberVO>)
        request.getAttribute("membersList");
%>
<html>
<head><title>회원 목록</title></head>
<body>
    <h2>회원 정보</h2>
    <table border="1">
        <tr>
            <th>아이디</th>
            <th>이름</th>
            <th>이메일</th>
            <th>가입일</th>
        </tr>
        <% for (MemberVO m : membersList) { %>
        <tr>
            <td><%= m.getId() %></td>
            <td><%= m.getName() %></td>
            <td><%= m.getEmail() %></td>
            <td><%= m.getJoinDate() %></td>
        </tr>
        <% } %>
    </table>
</body>
</html>
```

### 요청 처리 흐름

```
  회원 목록 조회 흐름

  /member/listMembers
      │
      ▼
  MemberController (서블릿)
      │ action = "/listMembers"
      │
      │ memberDAO.listMembers()
      ▼
  MemberDAO
      │ DB에서 회원 목록 조회
      ▼
  MemberController
      │ request.setAttribute(
      │   "membersList", list)
      │ forward → listMembers.jsp
      ▼
  listMembers.jsp
      │ membersList 꺼내서 출력
      ▼
  브라우저에 회원 목록 표시
```

---

## 4. URL 패턴을 이용한 요청 분기

하나의 서블릿에서 URL 경로에 따라 여러 기능을 처리할 수 있다.

### @WebServlet의 URL 패턴

```java
@WebServlet("/member/*")
```

이 설정은 `/member/` 이하의 모든 요청을 하나의 서블릿에서 처리한다.

### pathInfo를 이용한 분기

```java
private void doHandle(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

    String action = request.getPathInfo();
    String nextPage = null;

    if (action == null
            || action.equals("/listMembers")) {
        List<MemberVO> list =
            memberDAO.listMembers();
        request.setAttribute(
            "membersList", list);
        nextPage = "/member/listMembers.jsp";

    } else if (action.equals("/addMember")) {
        String id =
            request.getParameter("id");
        String pwd =
            request.getParameter("pwd");
        String name =
            request.getParameter("name");
        String email =
            request.getParameter("email");

        MemberVO vo = new MemberVO();
        vo.setId(id);
        vo.setPwd(pwd);
        vo.setName(name);
        vo.setEmail(email);
        memberDAO.addMember(vo);

        // 추가 후 목록으로 리다이렉트
        nextPage = "/member/listMembers";

    } else if (action.equals("/delMember")) {
        String id =
            request.getParameter("id");
        memberDAO.delMember(id);
        nextPage = "/member/listMembers";
    }

    if (action != null
            && (action.equals("/addMember")
            || action.equals("/delMember"))) {
        response.sendRedirect(
            request.getContextPath()
            + nextPage);
    } else {
        RequestDispatcher rd =
            request.getRequestDispatcher(
                nextPage);
        rd.forward(request, response);
    }
}
```

### forward vs sendRedirect 사용 기준

| 구분 | forward | sendRedirect |
|:-----|:-----|:-----|
| 용도 | 조회(데이터 전달) | 데이터 변경 후 이동 |
| request 유지 | O (같은 request) | X (새 request) |
| URL 변경 | X (원래 URL 유지) | O (새 URL로 변경) |
| 사용 시점 | 목록 조회, 상세 보기 | 등록, 수정, 삭제 후 |

```
  forward vs sendRedirect

  [forward]
  브라우저 → 서블릿 → JSP
  URL: /member/listMembers (유지)
  request 데이터: 유지됨

  [sendRedirect]
  브라우저 → 서블릿
  브라우저 ← 302 응답
  브라우저 → /member/listMembers
  URL: /member/listMembers (변경)
  request 데이터: 새로 생성
```

{{< callout type="warning" >}}
데이터를 변경(등록·수정·삭제)하는 요청 후에는 반드시 **sendRedirect**를 사용해야 한다. forward를 사용하면 새로고침 시 데이터 변경이 중복 실행되는 문제가 발생한다.
{{< /callout >}}

---

## 5. 커맨드 패턴을 이용한 확장

요청이 많아지면 서블릿의 `doHandle` 메서드에 `if-else`가 과도하게 늘어난다. **커맨드 패턴**을 적용하면 각 요청을 독립된 클래스로 분리할 수 있다.

### 커맨드 인터페이스

```java
public interface CommandHandler {
    String process(
        HttpServletRequest request,
        HttpServletResponse response)
        throws Exception;
}
```

### 커맨드 구현 클래스

```java
// ListMembersHandler.java
public class ListMembersHandler
        implements CommandHandler {

    private MemberDAO dao = new MemberDAO();

    @Override
    public String process(
            HttpServletRequest request,
            HttpServletResponse response)
            throws Exception {
        List<MemberVO> list =
            dao.listMembers();
        request.setAttribute(
            "membersList", list);
        return "/member/listMembers.jsp";
    }
}
```

```java
// AddMemberHandler.java
public class AddMemberHandler
        implements CommandHandler {

    private MemberDAO dao = new MemberDAO();

    @Override
    public String process(
            HttpServletRequest request,
            HttpServletResponse response)
            throws Exception {
        MemberVO vo = new MemberVO();
        vo.setId(
            request.getParameter("id"));
        vo.setPwd(
            request.getParameter("pwd"));
        vo.setName(
            request.getParameter("name"));
        vo.setEmail(
            request.getParameter("email"));
        dao.addMember(vo);
        return "redirect:/member/listMembers";
    }
}
```

### 커맨드 매핑 (properties 파일)

```
# command.properties
/member/listMembers=com.member.handler.ListMembersHandler
/member/addMember=com.member.handler.AddMemberHandler
/member/delMember=com.member.handler.DelMemberHandler
```

### FrontController 서블릿

```java
@WebServlet("/member/*")
public class FrontController
        extends HttpServlet {

    private Map<String, CommandHandler>
        commandMap = new HashMap<>();

    @Override
    public void init() throws ServletException {
        // properties 파일에서 매핑 로드
        Properties props = new Properties();
        String path = getServletContext()
            .getRealPath(
                "/WEB-INF/command.properties");

        try (FileInputStream fis =
                 new FileInputStream(path)) {
            props.load(fis);
        } catch (IOException e) {
            throw new ServletException(e);
        }

        for (Object key : props.keySet()) {
            String uri = (String) key;
            String className =
                props.getProperty(uri);
            try {
                Class<?> clazz =
                    Class.forName(className);
                CommandHandler handler =
                    (CommandHandler)
                    clazz.getDeclaredConstructor()
                         .newInstance();
                commandMap.put(uri, handler);
            } catch (Exception e) {
                throw new ServletException(e);
            }
        }
    }

    @Override
    protected void doGet(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {
        doHandle(request, response);
    }

    @Override
    protected void doPost(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {
        doHandle(request, response);
    }

    private void doHandle(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        String action = request.getPathInfo();
        CommandHandler handler =
            commandMap.get(action);

        if (handler == null) {
            response.sendError(
                HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        try {
            String viewPage =
                handler.process(request, response);

            if (viewPage.startsWith("redirect:")) {
                String redirectUrl =
                    viewPage.substring(9);
                response.sendRedirect(
                    request.getContextPath()
                    + redirectUrl);
            } else {
                RequestDispatcher rd =
                    request.getRequestDispatcher(
                        viewPage);
                rd.forward(request, response);
            }
        } catch (Exception e) {
            throw new ServletException(e);
        }
    }
}
```

### 커맨드 패턴 적용 전후 비교

```
  [적용 전]
  FrontController
  ┌──────────────────┐
  │ if (listMembers) │
  │   로직 A ...      │
  │ if (addMember)   │
  │   로직 B ...      │
  │ if (delMember)   │
  │   로직 C ...      │
  │ ...점점 비대해짐  │
  └──────────────────┘

  [적용 후]
  FrontController
  ┌──────────────────┐
  │ handler = map    │
  │   .get(action)   │
  │ handler.process()│
  └────────┬─────────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
   List   Add   Del
  Handler Handler Handler
```

{{< callout type="info" >}}
커맨드 패턴을 사용하면 **새로운 기능 추가 시 Handler 클래스를 만들고 properties 파일에 등록**하기만 하면 된다. 기존 코드를 수정할 필요가 없어 **OCP(개방-폐쇄 원칙)**를 준수할 수 있다.
{{< /callout >}}

---

## 6. 모델2 개발 시 실무 주의사항

### 패키지 구조

모델2 프로젝트에서는 역할에 따라 패키지를 분리한다.

| 패키지 | 역할 | 포함 클래스 |
|:-----|:-----|:-----|
| `controller` | 요청 분기 | FrontController |
| `handler` | 요청 처리 | ListMembersHandler, ... |
| `dao` | DB 접근 | MemberDAO |
| `vo` | 데이터 전달 | MemberVO |

### 흔한 실수

| 실수 | 문제점 | 해결 방법 |
|:-----|:-----|:-----|
| JSP에서 DB 직접 접근 | View와 Model 결합 | DAO를 통해서만 접근 |
| forward 후 코드 실행 | forward 이후 코드도 실행됨 | forward 후 `return` 추가 |
| 데이터 변경 후 forward | 새로고침 시 중복 실행 | sendRedirect 사용 |
| action이 null일 때 미처리 | NullPointerException | null 체크 또는 기본값 설정 |

---

## 요약

### 모델 비교

| 구분 | 모델1 | 모델2 (MVC) |
|:-----|:-----|:-----|
| 구조 | JSP 중심 | 서블릿 + JSP 분리 |
| Controller | JSP | 서블릿 |
| View | JSP | JSP |
| Model | JavaBean | DAO + VO |
| 유지보수 | 어려움 | 용이 |

### MVC 역할 분담

| 역할 | 담당 | 핵심 책임 |
|:-----|:-----|:-----|
| Controller | 서블릿 | 요청 분석, 흐름 제어 |
| Model | DAO/VO | 비즈니스 로직, DB 처리 |
| View | JSP | 화면 출력 (로직 금지) |

### forward vs sendRedirect

| 구분 | forward | sendRedirect |
|:-----|:-----|:-----|
| 조회 | O | X |
| 데이터 변경 후 | X | O |
| request 유지 | O | X |
