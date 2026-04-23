---
title: "10. JSP 스크립트 요소 기능"
weight: 11
---

JSP 페이지에서 동적 처리를 담당하는 스크립트 요소(선언문, 스크립트릿, 표현식)의 문법과 변환 원리, 내장 객체, 예외 처리를 다룬다.

---

## 1. JSP 스크립트 요소

HTML 태그만으로는 조건에 따라 화면을 동적으로 구성할 수 없다. JSP 스크립트 요소는 `<% %>` 기호 안에 자바 코드를 작성하여 **동적 처리**를 가능하게 하는 기능이다.

### 스크립트 요소의 종류

| 요소 | 문법 | 용도 | 변환 위치 |
|:-----|:-----|:-----|:-----|
| 선언문 | `<%! %>` | 멤버 변수·메서드 선언 | 클래스 멤버 영역 |
| 스크립트릿 | `<% %>` | 자바 코드 실행 | `_jspService()` 내부 |
| 표현식 | `<%= %>` | 값 출력 | `out.print()` 인자 |

```
  스크립트 요소의 변환 흐름

  JSP 페이지
  ┌──────────────────┐
  │ <%! 선언문 %>     │
  │ <% 스크립트릿 %>  │
  │ <%= 표현식 %>     │
  └────────┬─────────┘
           │ 변환
           ▼
  서블릿 클래스
  ┌──────────────────┐
  │ class hello_jsp  │
  │   ┌────────────┐ │
  │   │ 선언문 멤버 │ │
  │   └────────────┘ │
  │   _jspService(){ │
  │     스크립트릿    │
  │     out.print(   │
  │       표현식     │
  │     );           │
  │   }              │
  └──────────────────┘
```

---

## 2. 선언문

선언문(declaration tag)은 JSP 페이지에서 **멤버 변수**나 **멤버 메서드**를 선언할 때 사용한다. 선언문 안의 코드는 서블릿 클래스의 멤버로 변환된다.

### 기본 형식

```jsp
<%! 멤버 변수 또는 멤버 메서드 %>
```

### 멤버 변수 선언

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<%!
    // 클래스의 멤버 변수로 변환
    String name = "JSP";
    int count = 0;
%>
<html>
<body>
    <p>이름: <%= name %></p>
    <p>방문 횟수: <%= ++count %></p>
</body>
</html>
```

### 멤버 메서드 선언

```jsp
<%!
    // 클래스의 멤버 메서드로 변환
    int add(int a, int b) {
        return a + b;
    }

    String greet(String name) {
        return "안녕하세요, " + name + "님!";
    }
%>
<html>
<body>
    <p>합계: <%= add(10, 20) %></p>
    <p><%= greet("홍길동") %></p>
</body>
</html>
```

### 변환 결과 확인

```
  JSP 선언문 → 서블릿 변환

  <%! int count = 0; %>
         │
         ▼
  public class hello_jsp
      extends HttpJspBase {

      int count = 0;  ← 멤버 변수

      void _jspService(...) {
          // 요청 처리 코드
      }
  }
```

{{< callout type="warning" >}}
선언문의 멤버 변수는 서블릿 인스턴스에 속하므로 **모든 요청이 같은 값을 공유**한다. 위 예제에서 `count`는 요청마다 증가하여 누적된다. 멀티스레드 환경에서 동시성 문제가 발생할 수 있으므로 주의해야 한다.
{{< /callout >}}

---

## 3. 스크립트릿

스크립트릿(scriptlet)은 JSP 페이지에서 자바 코드를 실행하는 요소다. 서블릿 변환 시 `_jspService()` 메서드 내부의 **지역 변수**나 **실행 코드**로 변환된다.

### 기본 형식

```jsp
<% 자바 코드 %>
```

### 조건문으로 동적 화면 구성

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<%
    // 지역 변수로 변환
    int hour = java.util.Calendar
        .getInstance()
        .get(java.util.Calendar.HOUR_OF_DAY);
%>
<html>
<body>
    <% if (hour < 12) { %>
        <h2>오전입니다. 좋은 아침!</h2>
    <% } else if (hour < 18) { %>
        <h2>오후입니다. 힘내세요!</h2>
    <% } else { %>
        <h2>저녁입니다. 수고하셨습니다!</h2>
    <% } %>
</body>
</html>
```

### 반복문으로 목록 출력

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<%@ page import="java.util.List,
    java.util.Arrays" %>
<%
    List<String> fruits = Arrays.asList(
        "사과", "바나나", "포도");
%>
<html>
<body>
    <ul>
    <% for (String fruit : fruits) { %>
        <li><%= fruit %></li>
    <% } %>
    </ul>
</body>
</html>
```

### 선언문 vs 스크립트릿 변수 비교

| 구분 | 선언문 `<%! %>` | 스크립트릿 `<% %>` |
|:-----|:-----|:-----|
| 변환 위치 | 클래스 멤버 영역 | `_jspService()` 내부 |
| 변수 종류 | 멤버 변수 (인스턴스) | 지역 변수 |
| 생존 범위 | 서블릿 인스턴스와 동일 | 요청(메서드 호출)마다 생성·소멸 |
| 공유 여부 | 모든 요청이 공유 | 요청마다 독립 |
| 초기값 유지 | 서블릿이 파괴될 때까지 유지 | 매 요청마다 초기화 |

```jsp
<%-- 선언문: 멤버 변수 (누적됨) --%>
<%! int memberCount = 0; %>

<%-- 스크립트릿: 지역 변수 (매번 0) --%>
<% int localCount = 0; %>

<p>멤버: <%= ++memberCount %></p>
<p>지역: <%= ++localCount %></p>
```

위 페이지를 3번 요청하면 결과는 다음과 같다.

| 요청 | memberCount | localCount |
|:-----|:-----|:-----|
| 1회 | 1 | 1 |
| 2회 | 2 | 1 |
| 3회 | 3 | 1 |

---

## 4. 표현식

표현식(expression tag)은 JSP 페이지에서 **값을 문자열로 출력**하는 기능이다. 서블릿 변환 시 `out.print()`의 인자로 변환된다.

### 기본 형식

```jsp
<%= 값 또는 자바 변수 또는 자바 식 %>
```

{{< callout type="warning" >}}
표현식 내부에는 **세미콜론(`;`)을 쓰면 안 된다**. `out.print(값;)`이 되어 컴파일 에러가 발생한다.
{{< /callout >}}

### 다양한 사용 예시

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<%@ page import="java.time.LocalDate" %>
<%!
    String getName() {
        return "홍길동";
    }
%>
<%
    int price = 15000;
    double tax = 0.1;
%>
<html>
<body>
    <%-- 변수 출력 --%>
    <p>가격: <%= price %>원</p>

    <%-- 자바 식 출력 --%>
    <p>세후: <%= (int)(price * (1 + tax)) %>원</p>

    <%-- 메서드 호출 --%>
    <p>이름: <%= getName() %></p>

    <%-- API 호출 --%>
    <p>오늘: <%= LocalDate.now() %></p>

    <%-- 삼항 연산자 --%>
    <p><%= price > 10000 ? "고가" : "저가" %></p>
</body>
</html>
```

### 표현식의 변환 원리

```
  JSP              서블릿

  <%= name %>
       │
       ▼
  out.print(name);

  <%= add(1,2) %>
       │
       ▼
  out.print(add(1,2));

  <%= "금액:" + price %>
       │
       ▼
  out.print("금액:" + price);
```

### 스크립트릿 출력 vs 표현식 비교

두 방식 모두 같은 결과를 출력하지만, 표현식이 더 간결하다.

```jsp
<%-- 스크립트릿으로 출력 --%>
<% out.println("이름: " + name); %>

<%-- 표현식으로 출력 (간결) --%>
이름: <%= name %>
```

---

## 5. JSP 주석문

JSP 페이지에서는 세 종류의 주석을 사용할 수 있다.

### 주석 종류별 비교

| 주석 | 문법 | 브라우저 전송 | 서블릿 변환 |
|:-----|:-----|:-----|:-----|
| HTML 주석 | `<!-- -->` | O (소스 보기에 노출) | O |
| 자바 주석 | `//`, `/* */` | X | O |
| JSP 주석 | `<%-- --%>` | X | X |

```
  주석별 처리 단계

  JSP 파일
  ┌──────────────────┐
  │ <%-- JSP 주석 --%>│ → 여기서 제거
  │ <!-- HTML 주석 --> │
  │ <% // 자바 주석 %> │
  └────────┬─────────┘
           ▼ 변환
  서블릿 (.java)
  ┌──────────────────┐
  │ <!-- HTML 주석 --> │
  │ // 자바 주석       │
  └────────┬─────────┘
           ▼ 실행
  브라우저
  ┌──────────────────┐
  │ <!-- HTML 주석 --> │ → 소스에 노출
  └──────────────────┘
```

### 사용 예시

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <!-- HTML 주석: 브라우저 소스에 보임 -->

    <%-- JSP 주석: 어디에도 보이지 않음 --%>

    <%
        // 자바 한 줄 주석
        /* 자바
           여러 줄 주석 */
        String msg = "Hello";
    %>

    <%= msg %>
</body>
</html>
```

{{< callout type="info" >}}
보안이 중요한 주석(DB 정보, 로직 설명 등)은 반드시 **JSP 주석** `<%-- --%>`을 사용해야 한다. HTML 주석은 브라우저에서 소스 보기로 그대로 노출된다.
{{< /callout >}}

### JSP 프리컴파일

JSP 최초 요청 시 변환·컴파일 과정 때문에 응답이 느려진다. 톰캣은 **JSP Precompile** 기능을 제공하여, 서버 시작 시 미리 JSP를 컴파일해 둘 수 있다.

```xml
<!-- web.xml에서 프리컴파일 설정 -->
<servlet>
    <servlet-name>hello</servlet-name>
    <jsp-file>/hello.jsp</jsp-file>
    <load-on-startup>1</load-on-startup>
</servlet>
```

```
  프리컴파일 vs 일반 요청

  [프리컴파일]
  서버 시작 → 변환 → 컴파일 → 대기
  첫 요청   → 바로 실행 → 응답

  [일반]
  서버 시작 → 대기
  첫 요청   → 변환 → 컴파일 → 실행
             → 응답 (느림)
```

---

## 6. 내장 객체

JSP 내장 객체(implicit object)는 JSP가 서블릿으로 변환될 때 **컨테이너가 자동으로 생성**하는 객체다. 개발자가 직접 선언하지 않고 바로 사용할 수 있다.

### 내장 객체 목록

| 내장 객체 | 타입 | 설명 |
|:-----|:-----|:-----|
| `request` | `HttpServletRequest` | 클라이언트 요청 정보 |
| `response` | `HttpServletResponse` | 응답 정보 |
| `out` | `JspWriter` | 출력 스트림 |
| `session` | `HttpSession` | 세션 정보 |
| `application` | `ServletContext` | 애플리케이션 전역 정보 |
| `pageContext` | `PageContext` | 현재 JSP 페이지 정보 |
| `page` | `Object` | 현재 서블릿 인스턴스 (`this`) |
| `config` | `ServletConfig` | 서블릿 설정 정보 |
| `exception` | `Exception` | 예외 객체 (`isErrorPage=true`일 때만) |

### 변환 원리

내장 객체는 `_jspService()` 메서드 시작 부분에서 자동 생성된다.

```java
// 컨테이너가 자동 생성하는 코드
public void _jspService(
    HttpServletRequest request,
    HttpServletResponse response) {

    PageContext pageContext;
    HttpSession session;
    ServletContext application;
    ServletConfig config;
    JspWriter out;
    Object page = this;

    // 초기화
    pageContext = _jspxFactory
        .getPageContext(this, request,
            response, null, true, 8192, true);
    application = pageContext
        .getServletContext();
    config = pageContext.getServletConfig();
    session = pageContext.getSession();
    out = pageContext.getOut();

    // 여기부터 JSP 코드가 변환됨
}
```

### 주요 내장 객체 사용 예시

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <%-- request: 요청 정보 --%>
    <p>요청 방식: <%= request.getMethod() %></p>
    <p>요청 URI: <%= request.getRequestURI() %></p>
    <p>클라이언트 IP: <%= request.getRemoteAddr() %></p>

    <%-- session: 세션 정보 --%>
    <p>세션 ID: <%= session.getId() %></p>

    <%-- application: 서버 정보 --%>
    <p>서버 정보: <%= application.getServerInfo() %></p>
    <p>컨텍스트 경로: <%= application.getContextPath() %></p>

    <%-- out: 직접 출력 --%>
    <% out.println("<p>out으로 출력</p>"); %>
</body>
</html>
```

### 내장 객체의 스코프

내장 객체는 데이터를 저장할 수 있는 범위(scope)가 서로 다르다.

| 스코프 | 내장 객체 | 범위 | `setAttribute()` 유지 기간 |
|:-----|:-----|:-----|:-----|
| page | `pageContext` | 현재 JSP 페이지 | 해당 페이지 내에서만 |
| request | `request` | 같은 요청을 공유하는 페이지 | forward 포함 같은 요청 동안 |
| session | `session` | 같은 브라우저 | 세션 유지 동안 |
| application | `application` | 같은 웹 애플리케이션 | 서버 재시작 전까지 |

```
  스코프 범위 (좁은 → 넓은)

  page      ┌──────┐
            │ A.jsp │
            └──────┘

  request   ┌──────┐ forward ┌──────┐
            │ A.jsp │ ──────► │ B.jsp │
            └──────┘         └──────┘

  session   ┌──────────────────┐
            │ 같은 브라우저의    │
            │ 모든 JSP 페이지   │
            └──────────────────┘

  application
            ┌──────────────────┐
            │ 모든 사용자의     │
            │ 모든 JSP 페이지   │
            └──────────────────┘
```

### 스코프별 데이터 저장·조회

```jsp
<%
    // page 스코프: 현재 페이지에서만
    pageContext.setAttribute("pageData",
        "페이지 범위");

    // request 스코프: forward까지
    request.setAttribute("reqData",
        "요청 범위");

    // session 스코프: 브라우저 유지 동안
    session.setAttribute("sessData",
        "세션 범위");

    // application 스코프: 서버 전체
    application.setAttribute("appData",
        "앱 범위");
%>

<%-- 조회 --%>
<p><%= pageContext.getAttribute("pageData") %></p>
<p><%= request.getAttribute("reqData") %></p>
<p><%= session.getAttribute("sessData") %></p>
<p><%= application.getAttribute("appData") %></p>
```

---

## 7. JSP 페이지 예외 처리

### 예외 처리 구조

JSP 페이지에서 오류가 발생하면 **예외 처리 전용 페이지**로 이동시킬 수 있다.

```
  JSP 예외 처리 흐름

  main.jsp (errorPage="error.jsp")
      │
      │ 예외 발생!
      ▼
  error.jsp (isErrorPage="true")
      │
      │ exception 내장 객체 사용
      ▼
  사용자에게 오류 안내 화면
```

### 설정 방법

**일반 페이지 - errorPage 지정**

```jsp
<%@ page contentType="text/html;charset=UTF-8"
    errorPage="error.jsp" %>
<html>
<body>
    <%
        // 의도적으로 예외 발생
        int result = 100 / 0;
    %>
</body>
</html>
```

**에러 페이지 - isErrorPage 설정**

```jsp
<%@ page contentType="text/html;charset=UTF-8"
    isErrorPage="true" %>
<html>
<body>
    <h3>오류가 발생했습니다.</h3>
    <p>종류: <%= exception.getClass().getName() %></p>
    <p>메시지: <%= exception.getMessage() %></p>
    <p><a href="index.jsp">메인으로 돌아가기</a></p>
</body>
</html>
```

{{< callout type="info" >}}
`isErrorPage="true"`로 설정된 페이지에서만 `exception` 내장 객체를 사용할 수 있다. 일반 페이지에서 `exception`을 사용하면 컴파일 에러가 발생한다.
{{< /callout >}}

### web.xml을 이용한 에러 처리

개별 JSP마다 `errorPage`를 지정하는 대신, web.xml에서 **에러 코드별로 일괄 처리**할 수 있다.

```xml
<error-page>
    <error-code>404</error-code>
    <location>/error/404.jsp</location>
</error-page>

<error-page>
    <error-code>500</error-code>
    <location>/error/500.jsp</location>
</error-page>

<error-page>
    <exception-type>
        java.lang.NullPointerException
    </exception-type>
    <location>/error/null-error.jsp</location>
</error-page>
```

### 자주 발생하는 오류 코드

| 코드 | 이름 | 원인 |
|:-----|:-----|:-----|
| 404 | Not Found | 요청한 JSP 페이지가 존재하지 않음 |
| 405 | Method Not Allowed | 지원하지 않는 HTTP 메서드 요청 |
| 500 | Internal Server Error | JSP/서블릿 내부에서 예외 발생 |

---

## 8. JSP welcome 파일

웹 애플리케이션의 첫 화면(홈페이지)을 web.xml에 등록하면, 브라우저에서 **컨텍스트 이름만으로** 접근할 수 있다.

### 설정 방법

```xml
<welcome-file-list>
    <welcome-file>index.jsp</welcome-file>
    <welcome-file>index.html</welcome-file>
    <welcome-file>default.jsp</welcome-file>
</welcome-file-list>
```

### 동작 원리

```
  요청: http://localhost:8080/myapp/

  welcome-file-list 순서대로 탐색
      │
      ├── index.jsp  → 있으면 실행
      ├── index.html → 있으면 반환
      └── default.jsp → 있으면 실행
                         없으면 404
```

> welcome-file-list는 위에서 아래로 순서대로 탐색하며, **가장 먼저 발견된 파일**을 응답한다.

---

## 요약

### 스크립트 요소 비교

| 요소 | 문법 | 변환 위치 | 용도 |
|:-----|:-----|:-----|:-----|
| 선언문 | `<%! %>` | 클래스 멤버 | 멤버 변수·메서드 선언 |
| 스크립트릿 | `<% %>` | `_jspService()` | 자바 로직 실행 |
| 표현식 | `<%= %>` | `out.print()` | 값 출력 (세미콜론 금지) |
| 주석 | `<%-- --%>` | 변환되지 않음 | 주석 (브라우저 미전송) |

### 내장 객체 스코프

| 스코프 | 객체 | 범위 |
|:-----|:-----|:-----|
| page | `pageContext` | 현재 페이지 |
| request | `request` | 같은 요청 (forward 포함) |
| session | `session` | 같은 브라우저 |
| application | `application` | 웹 애플리케이션 전체 |

### 예외 처리

| 방법 | 설정 위치 | 특징 |
|:-----|:-----|:-----|
| `errorPage` 속성 | 개별 JSP | 페이지 단위 에러 처리 |
| `<error-page>` | web.xml | 에러 코드·예외 타입별 일괄 처리 |
