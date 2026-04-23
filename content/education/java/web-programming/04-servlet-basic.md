---
title: "04. 서블릿 기초"
weight: 4
---

## 1. 서블릿의 세 가지 기본 기능

서블릿은 WAS(Tomcat 등)에서 **스레드 방식**으로 클라이언트 요청을 처리하는 자바 기술이다.

### 기본 기능 수행 과정

```
  클라이언트 (브라우저)
        │
        │ ① HTTP 요청
        ▼
┌────────────────┐
│  톰캣 컨테이너   │
│                │
│  ┌──────────┐  │
│  │ Servlet  │  │ ② 비즈니스 로직 처리 (DB 연동 등)
│  └──────────┘  │
│                │
└───────┬────────┘
        │ ③ 처리 결과 응답
        ▼
  클라이언트 (브라우저)
```

| 단계 | 설명 |
|:----:|:-----|
| 1 | 클라이언트로부터 요청을 받는다 |
| 2 | DB 연동 등 비즈니스 로직을 처리한다 |
| 3 | 처리된 결과를 클라이언트에 돌려준다 |

---

## 2. 요청/응답 API

요청·응답 관련 API는 모두 `javax.servlet.http` 패키지에 있다.

### 톰캣의 객체 생성 흐름

```
    클라이언트 요청
        │
        ▼
┌────────────────┐
│  톰캣 컨테이너   │
│                │
│  Request 객체  │ ← 요청 정보
│  Response 객체 │ ← 응답 기능
│                │
└───────┬────────┘
        │ 두 객체를 전달
        ▼
  doGet() / doPost()
```

> 톰캣이 사용자 요청 정보를 `HttpServletRequest` 객체의 속성에 담아 전달하므로,
> 서블릿에서는 이 객체의 메서드를 통해 데이터를 받거나 응답할 수 있다.

### 메서드 시그니처

```java
protected void doGet(HttpServletRequest req, HttpServletResponse resp)
    throws ServletException, IOException {
    // GET 요청 처리
}

protected void doPost(HttpServletRequest req, HttpServletResponse resp)
    throws ServletException, IOException {
    // POST 요청 처리
}
```

### HttpServletRequest 주요 메서드

| 반환형 | 메서드 | 기능 |
|:-------|:-------|:-----|
| `String` | `getParameter(name)` | 단일 파라미터 값 |
| `String[]` | `getParameterValues(name)` | 같은 name의 여러 값 |
| `Enumeration` | `getParameterNames()` | 모든 파라미터 name |
| `String` | `getMethod()` | GET/POST/PUT 등 |
| `String` | `getRequestURI()` | 컨텍스트 + 파일 경로 |
| `String` | `getContextPath()` | 컨텍스트 경로 |
| `String` | `getServletPath()` | 서블릿/JSP 이름 |
| `String` | `getHeader(name)` | 특정 헤더 값 |
| `Enumeration` | `getHeaderNames()` | 모든 헤더 name |
| `Cookie[]` | `getCookies()` | 쿠키 배열 |
| `HttpSession` | `getSession()` | 세션 (없으면 생성) |
| `String` | `changeSessionId()` | 세션 ID 변경 후 반환 |

### HttpServletResponse 주요 메서드

| 반환형 | 메서드 | 기능 |
|:-------|:-------|:-----|
| `void` | `setContentType(type)` | MIME 타입 설정 |
| `PrintWriter` | `getWriter()` | 문자 출력 스트림 |
| `void` | `addCookie(cookie)` | 쿠키 추가 |
| `void` | `addHeader(name, value)` | 헤더 추가 |
| `void` | `sendRedirect(url)` | 리다이렉트 |
| `String` | `encodeURL(url)` | 세션 ID 포함 URL 인코딩 |
| `Collection` | `getHeaderNames()` | 응답 헤더 name 목록 |

---

## 3. `<form>` 태그를 이용한 요청

서블릿은 HTML/CSS/자바스크립트와 연동하여 동작하며, 사용자 요청은 주로 `<form>` 태그나 자바스크립트로 전송된다.

### `<form>` 태그 속성

| 속성 | 기능 |
|:-----|:-----|
| `name` | form 이름 (여러 form 구분용) |
| `method` | 전송 방식 - GET 또는 POST (기본 GET) |
| `action` | 전송 대상 서블릿/JSP (매핑 이름 사용) |
| `enctype` | 인코딩 타입 (파일 업로드 시 `multipart/form-data`) |

### 예제 - 로그인 폼

**login.html**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>로그인</title>
</head>
<body>
    <form name="loginForm" method="post" action="login">
        <label>아이디: <input type="text" name="id"></label><br>
        <label>비밀번호: <input type="password" name="pw"></label><br>
        <input type="submit" value="로그인">
    </form>
</body>
</html>
```

**LoginServlet.java**
```java
@WebServlet("/login")
public class LoginServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");

        String id = req.getParameter("id");
        String pw = req.getParameter("pw");

        resp.setContentType("text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();
        out.println("<html><body>");
        out.println("<h2>로그인 결과</h2>");
        out.println("아이디: " + id + "<br>");
        out.println("비밀번호: " + pw);
        out.println("</body></html>");
    }
}
```

### form → 서블릿 요청 흐름

```
   login.html (form)
        │
        │ POST /login
        │ id=test&pw=1234
        ▼
┌────────────────┐
│  톰캣 컨테이너   │
│                │
│  URL 매핑 확인  │
│  /login 탐색   │
└───────┬────────┘
        │
        ▼
  LoginServlet.doPost()
        │
        │ getParameter("id")
        │ getParameter("pw")
        ▼
   응답 생성 → 브라우저
```

---

## 4. 파라미터 수신 메서드

### 메서드 비교

| 메서드 | 용도 | 반환형 |
|:-------|:-----|:-------|
| `getParameter(name)` | name을 알고 있을 때 단일 값 | `String` |
| `getParameterValues(name)` | 같은 name으로 여러 값 전송 시 | `String[]` |
| `getParameterNames()` | name을 모를 때 전체 조회 | `Enumeration` |

### 예제 - getParameter

```java
// name=value 형태의 단일 값
String username = req.getParameter("username");
String age = req.getParameter("age");
```

### 예제 - getParameterValues (체크박스 등)

```html
<form method="post" action="hobby">
    <input type="checkbox" name="hobby" value="독서"> 독서
    <input type="checkbox" name="hobby" value="운동"> 운동
    <input type="checkbox" name="hobby" value="영화"> 영화
    <input type="submit" value="전송">
</form>
```

```java
@WebServlet("/hobby")
public class HobbyServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");
        String[] hobbies = req.getParameterValues("hobby");

        resp.setContentType("text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();
        out.println("<h2>선택한 취미</h2>");

        if (hobbies != null) {
            for (String hobby : hobbies) {
                out.println(hobby + "<br>");
            }
        }
    }
}
```

### 예제 - getParameterNames (동적 파라미터 처리)

```java
@WebServlet("/params")
public class ParamServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");
        resp.setContentType("text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();

        Enumeration<String> names = req.getParameterNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            String value = req.getParameter(name);
            out.println(name + " = " + value + "<br>");
        }
    }
}
```

---

## 5. 서블릿 응답 처리

### 응답 처리 절차

```
  doGet() / doPost()
        │
        ▼
  ① setContentType()
     MIME-TYPE 설정
        │
        ▼
  ② getWriter()
     출력 스트림 획득
        │
        ▼
  ③ println()
     데이터 출력
        │
        ▼
  브라우저가 수신
```

1. `doGet()` 또는 `doPost()` 안에서 처리
2. `HttpServletResponse` 객체 이용
3. `setContentType()`으로 MIME-TYPE 지정
4. 자바 I/O 스트림으로 클라이언트에 전송

### MIME-TYPE

서블릿이 브라우저로 데이터를 전송할 때, 전송 데이터의 종류를 미리 알려주면 브라우저가 더 빠르게 처리할 수 있다. 톰캣 컨테이너에 미리 설정된 데이터 종류를 **MIME-TYPE**이라 한다.

| MIME-TYPE | 설명 |
|:----------|:-----|
| `text/html` | HTML 문서 |
| `text/plain` | 일반 텍스트 |
| `text/xml` | XML 문서 |
| `application/json` | JSON 데이터 |
| `application/pdf` | PDF 파일 |
| `image/jpeg` | JPEG 이미지 |
| `image/png` | PNG 이미지 |

### 예제 - HTML 응답

```java
@WebServlet("/html-response")
public class HtmlResponseServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        // ① MIME-TYPE 설정
        resp.setContentType("text/html;charset=UTF-8");

        // ② 출력 스트림 획득
        PrintWriter out = resp.getWriter();

        // ③ HTML 출력
        out.println("<html>");
        out.println("<head><title>응답 예제</title></head>");
        out.println("<body>");
        out.println("<h1>서블릿 응답</h1>");
        out.println("<p>현재 시간: " + new java.util.Date() + "</p>");
        out.println("</body>");
        out.println("</html>");
    }
}
```

### 예제 - JSON 응답

```java
@WebServlet("/json-response")
public class JsonResponseServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        resp.setContentType("application/json;charset=UTF-8");
        PrintWriter out = resp.getWriter();
        out.println("{\"name\": \"홍길동\", \"age\": 25}");
    }
}
```

---

## 6. GET/POST 전송 방식

### 비교

| 구분 | GET | POST |
|:-----|:----|:-----|
| 데이터 위치 | URL 뒤 (`?name=value`) | HTTP Body |
| 보안 | 노출됨 (취약) | 숨겨짐 (유리) |
| 데이터 용량 | 제한 있음 (약 2KB~8KB) | 무제한 |
| 처리 속도 | 빠름 | 상대적으로 느림 |
| 기본값 | `<form>`의 기본 방식 | 명시적 지정 필요 |
| 서블릿 메서드 | `doGet()` | `doPost()` |
| 용도 | 조회, 검색 | 등록, 수정, 로그인 |

### GET 방식 동작

```
  브라우저 주소창
  /search?keyword=자바&page=1
  ─────────────────────────
  URL에 데이터가 노출됨
        │
        ▼
┌────────────────┐
│  doGet() 호출   │
│                │
│  "keyword"→자바 │
│  "page"  →1    │
└────────────────┘
```

### POST 방식 동작

```
  브라우저 주소창
  /login ← 데이터 보이지 않음
  ─────────────────────────
  HTTP Body에 숨겨서 전송
  id=test&pw=1234
        │
        ▼
┌────────────────┐
│ doPost() 호출   │
│                │
│  "id"→test     │
│  "pw"→1234     │
└────────────────┘
```

### 예제 - GET/POST 모두 처리

```java
@WebServlet("/member")
public class MemberServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {
        // GET: 회원 목록 조회
        doHandle(req, resp);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {
        // POST: 회원 등록
        doHandle(req, resp);
    }

    private void doHandle(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");
        resp.setContentType("text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();

        String method = req.getMethod();
        out.println("<h2>요청 방식: " + method + "</h2>");

        Enumeration<String> names = req.getParameterNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            String value = req.getParameter(name);
            out.println(name + " = " + value + "<br>");
        }
    }
}
```

---

## 요약

### 서블릿 요청/응답 핵심

| 항목 | 내용 |
|:-----|:-----|
| 요청 API | `HttpServletRequest` |
| 응답 API | `HttpServletResponse` |
| 단일 값 수신 | `getParameter(name)` |
| 다중 값 수신 | `getParameterValues(name)` |
| name 모를 때 | `getParameterNames()` |
| 응답 타입 설정 | `setContentType(MIME-TYPE)` |
| 출력 스트림 | `getWriter()` → `PrintWriter` |

### 서블릿 응답 처리 패턴

```java
@WebServlet("/path")
public class MyServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        // 1. 요청 인코딩 설정
        req.setCharacterEncoding("UTF-8");

        // 2. 파라미터 수신
        String param = req.getParameter("name");

        // 3. 응답 MIME-TYPE 설정
        resp.setContentType("text/html;charset=UTF-8");

        // 4. 출력 스트림으로 응답
        PrintWriter out = resp.getWriter();
        out.println("<html><body>");
        out.println("<h1>" + param + "</h1>");
        out.println("</body></html>");
    }
}
```

### GET vs POST 선택 기준

```
조회/검색 → GET   (데이터 노출 OK, 북마크 가능)
등록/수정 → POST  (데이터 숨김, 용량 무제한)
```
