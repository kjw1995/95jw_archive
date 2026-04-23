---
title: "11. 자바 코드를 없애는 액션 태그"
weight: 12
---

JSP에서 자바 코드를 줄이기 위한 액션 태그(인클루드, 포워드, useBean, setProperty, getProperty)의 문법과 동작 원리를 다룬다.

---

## 1. JSP 액션 태그란

JSP 페이지에서 자바 코드를 직접 작성하면 화면이 복잡해지고 유지보수가 어려워진다. **액션 태그**는 자바 코드를 XML 형태의 태그로 대체하여 JSP 페이지를 깔끔하게 유지하는 기능이다.

### 액션 태그의 종류

| 액션 태그 | 형식 | 용도 |
|:-----|:-----|:-----|
| 인클루드 | `<jsp:include>` | 다른 JSP를 현재 페이지에 포함 |
| 포워드 | `<jsp:forward>` | 다른 JSP로 요청 전달 |
| 유즈빈 | `<jsp:useBean>` | 자바 빈 객체 생성 |
| 셋프로퍼티 | `<jsp:setProperty>` | 빈 속성에 값 설정 (setter) |
| 겟프로퍼티 | `<jsp:getProperty>` | 빈 속성 값 조회 (getter) |

```
  액션 태그의 역할

  [기존 방식]
  JSP 페이지
  ┌──────────────────┐
  │ <% Java 코드 %>   │
  │ HTML + Java 혼재  │
  │ 유지보수 어려움     │
  └──────────────────┘

  [액션 태그 방식]
  JSP 페이지
  ┌──────────────────┐
  │ <jsp:xxx> 태그    │
  │ HTML + 태그 분리   │
  │ 유지보수 용이       │
  └──────────────────┘
```

---

## 2. 인클루드 액션 태그

인클루드 액션 태그(`<jsp:include>`)는 화면을 여러 JSP로 분할하여 관리할 때 사용한다. 인클루드 **디렉티브** 태그(`<%@ include %>`)와 비슷하지만 동작 방식이 다르다.

### 기본 형식

```jsp
<jsp:include page="포함할 JSP 페이지"
    flush="true 또는 false">
</jsp:include>
```

- `page`: 포함할 JSP 파일 경로
- `flush`: 포함 전 출력 버퍼 비움 여부

### 처리 과정

```
  인클루드 액션 태그 처리 흐름

  브라우저 → main.jsp 요청
      │
      ▼
  main.jsp 컴파일
      │
      │ <jsp:include page="header.jsp">
      ▼
  header.jsp 별도 컴파일
      │
      │ 실행 결과 반환
      ▼
  main.jsp가 결과를 포함하여
      │
      │ 최종 응답 전송
      ▼
  브라우저
```

### 사용 예시

```jsp
<%-- main.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <jsp:include page="header.jsp" flush="false">
        <jsp:param name="title"
            value="메인 페이지" />
    </jsp:include>

    <h2>본문 내용</h2>
    <p>여기에 메인 콘텐츠가 들어갑니다.</p>

    <jsp:include page="footer.jsp"
        flush="false" />
</body>
</html>
```

```jsp
<%-- header.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<%
    String title = request.getParameter("title");
%>
<header>
    <h1><%= title %></h1>
    <nav>메뉴 영역</nav>
</header>
<hr>
```

### 인클루드 액션 태그 vs 디렉티브 태그

| 구분 | 인클루드 액션 태그 | 인클루드 디렉티브 태그 |
|:-----|:-----|:-----|
| 문법 | `<jsp:include>` | `<%@ include %>` |
| 처리 시점 | 요청 시 (런타임) | 변환 시 (컴파일 타임) |
| 자바 파일 | 각각 별도 생성 | 하나로 합쳐서 생성 |
| 데이터 전달 | `<jsp:param>`으로 동적 전달 | 정적 포함만 가능 |
| 변수 공유 | 불가 (별도 서블릿) | 가능 (같은 서블릿) |
| 적합 용도 | 독립적인 모듈 포함 | 공통 코드 삽입 |

```
  변환 방식 비교

  [디렉티브 태그]
  A.jsp + B.jsp
       │ 합쳐서 변환
       ▼
  A_jsp.java (하나의 파일)

  [액션 태그]
  A.jsp    B.jsp
    │        │ 각각 변환
    ▼        ▼
  A_jsp.java B_jsp.java
    │        │
    └───┬────┘
        │ 실행 시 결과 합침
        ▼
    최종 응답
```

{{< callout type="info" >}}
**레이아웃 모듈화**(헤더, 푸터, 사이드바)에는 인클루드 액션 태그가 적합하다. 각 모듈이 독립적으로 컴파일되므로 수정 시 해당 파일만 재컴파일하면 된다.
{{< /callout >}}

---

## 3. 포워드 액션 태그

포워드 액션 태그(`<jsp:forward>`)는 서블릿의 `RequestDispatcher.forward()`를 태그로 대체한 것이다. 자바 코드 없이 다른 JSP로 요청을 전달할 수 있다.

### 기본 형식

```jsp
<jsp:forward page="포워딩할 JSP 페이지">
    <jsp:param name="파라미터명"
        value="값" />
</jsp:forward>
```

### 사용 예시

```jsp
<%-- login.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <form action="loginProcess.jsp" method="post">
        <input type="text" name="id"
            placeholder="아이디">
        <input type="password" name="pwd"
            placeholder="비밀번호">
        <button type="submit">로그인</button>
    </form>
</body>
</html>
```

```jsp
<%-- loginProcess.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<%
    String id = request.getParameter("id");
    String pwd = request.getParameter("pwd");
%>
<% if ("admin".equals(id)
        && "1234".equals(pwd)) { %>
    <jsp:forward page="main.jsp">
        <jsp:param name="userName"
            value="관리자" />
    </jsp:forward>
<% } else { %>
    <jsp:forward page="login.jsp">
        <jsp:param name="error"
            value="로그인 실패" />
    </jsp:forward>
<% } %>
```

### 포워드 동작 원리

```
  포워드 액션 태그 흐름

  브라우저
      │ loginProcess.jsp 요청
      ▼
  loginProcess.jsp
      │ 로직 처리
      │ <jsp:forward page="main.jsp">
      ▼
  main.jsp
      │ 화면 출력
      ▼
  브라우저 (URL은 loginProcess.jsp)
```

{{< callout type="warning" >}}
포워드 액션 태그를 사용하면 **현재 페이지의 출력 내용은 모두 무시**되고 포워딩된 페이지의 출력만 브라우저에 전송된다. 브라우저 URL은 변경되지 않는다.
{{< /callout >}}

---

## 4. 자바 빈과 useBean 액션 태그

### 자바 빈이란

자바 빈(JavaBean)은 웹 프로그래밍에서 데이터를 저장하고 전달하는 객체다. DTO(Data Transfer Object)·VO(Value Object)와 같은 개념이다.

### 자바 빈 작성 규칙

| 규칙 | 설명 |
|:-----|:-----|
| 접근 제한자 | 속성은 `private`으로 선언 |
| getter/setter | 각 속성마다 제공, 첫 글자 소문자 |
| 기본 생성자 | 인자 없는 생성자 필수 |
| 직렬화 | `Serializable` 구현 (선택) |

```java
// MemberBean.java
public class MemberBean
        implements java.io.Serializable {
    private String id;
    private String name;
    private String email;

    // 기본 생성자 (필수)
    public MemberBean() {}

    public String getId() { return id; }
    public void setId(String id) {
        this.id = id;
    }

    public String getName() { return name; }
    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() { return email; }
    public void setEmail(String email) {
        this.email = email;
    }
}
```

### useBean 액션 태그

`<jsp:useBean>` 태그는 `new` 연산자를 대신하여 자바 빈 객체를 생성한다.

```jsp
<jsp:useBean id="빈 이름"
    class="패키지.클래스명"
    scope="접근 범위" />
```

| 속성 | 설명 |
|:-----|:-----|
| `id` | JSP에서 빈을 참조할 이름 |
| `class` | 패키지를 포함한 전체 클래스명 |
| `scope` | 접근 범위 (page, request, session, application). 기본값: page |

### useBean vs 자바 코드 비교

```jsp
<%-- 자바 코드 방식 --%>
<%
    MemberBean member = new MemberBean();
    member.setId("hong");
    member.setName("홍길동");
%>

<%-- useBean 액션 태그 방식 --%>
<jsp:useBean id="member"
    class="com.bean.MemberBean"
    scope="page" />
<jsp:setProperty name="member"
    property="id" value="hong" />
<jsp:setProperty name="member"
    property="name" value="홍길동" />
```

---

## 5. setProperty와 getProperty 액션 태그

### setProperty - 값 설정

`<jsp:setProperty>`는 자바 빈의 setter 메서드를 대체한다.

```jsp
<jsp:setProperty name="빈 이름"
    property="속성명" value="값" />
```

| 속성 | 설명 |
|:-----|:-----|
| `name` | useBean의 `id`에 지정한 이름 |
| `property` | 값을 설정할 속성 이름 |
| `value` | 설정할 값 |

### getProperty - 값 조회

`<jsp:getProperty>`는 자바 빈의 getter 메서드를 대체한다.

```jsp
<jsp:getProperty name="빈 이름"
    property="속성명" />
```

### 전체 사용 예시

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>

<%-- 자바 빈 생성 --%>
<jsp:useBean id="member"
    class="com.bean.MemberBean"
    scope="page" />

<%-- 속성 설정 --%>
<jsp:setProperty name="member"
    property="id" value="hong" />
<jsp:setProperty name="member"
    property="name" value="홍길동" />
<jsp:setProperty name="member"
    property="email"
    value="hong@example.com" />

<html>
<body>
    <h2>회원 정보</h2>
    <p>아이디:
        <jsp:getProperty name="member"
            property="id" /></p>
    <p>이름:
        <jsp:getProperty name="member"
            property="name" /></p>
    <p>이메일:
        <jsp:getProperty name="member"
            property="email" /></p>
</body>
</html>
```

### property="*" 자동 바인딩

form 파라미터 이름과 빈 속성 이름이 같으면 `property="*"`로 한 번에 설정할 수 있다.

```jsp
<%-- form에서 id, name, email 전송 시 --%>
<jsp:useBean id="member"
    class="com.bean.MemberBean"
    scope="page" />
<jsp:setProperty name="member"
    property="*" />
```

```
  property="*" 동작 원리

  form 전송 파라미터
  ┌──────────────────┐
  │ id=hong          │
  │ name=홍길동       │
  │ email=hong@..    │
  └────────┬─────────┘
           │ property="*"
           ▼
  MemberBean
  ┌──────────────────┐
  │ setId("hong")    │
  │ setName("홍길동") │
  │ setEmail("hong") │
  └──────────────────┘
```

{{< callout type="warning" >}}
`property="*"`를 사용할 때는 **form 파라미터 이름과 빈 속성 이름이 정확히 일치**해야 한다. 이름이 다르면 해당 속성은 설정되지 않는다.
{{< /callout >}}

---

## 6. useBean의 scope 속성

useBean으로 생성한 빈의 scope에 따라 접근 가능한 범위가 달라진다.

| scope | 접근 범위 | 유지 기간 |
|:-----|:-----|:-----|
| page | 현재 JSP 페이지 | 페이지 요청 동안 |
| request | forward/include된 페이지 | 같은 요청 동안 |
| session | 같은 브라우저 | 세션 유지 동안 |
| application | 모든 사용자 | 서버 재시작 전까지 |

### scope별 동작 예시

```jsp
<%-- page: 현재 페이지에서만 --%>
<jsp:useBean id="pageBean"
    class="com.bean.MemberBean"
    scope="page" />

<%-- request: forward된 곳에서도 사용 --%>
<jsp:useBean id="reqBean"
    class="com.bean.MemberBean"
    scope="request" />

<%-- session: 로그인 정보 등 --%>
<jsp:useBean id="loginUser"
    class="com.bean.MemberBean"
    scope="session" />
```

```
  scope별 빈 접근 범위

  page     현재 JSP만
           ┌──────┐
           │ A.jsp │
           └──────┘

  request  forward 포함
           ┌──────┐    ┌──────┐
           │ A.jsp │ ─► │ B.jsp │
           └──────┘    └──────┘

  session  같은 브라우저의 모든 JSP
           ┌──────────────────┐
           │ 로그인~로그아웃    │
           │ 동안 모든 페이지   │
           └──────────────────┘
```

---

## 요약

### 액션 태그 비교

| 액션 태그 | 대체하는 자바 코드 | 용도 |
|:-----|:-----|:-----|
| `<jsp:include>` | `RequestDispatcher.include()` | 페이지 포함 |
| `<jsp:forward>` | `RequestDispatcher.forward()` | 페이지 이동 |
| `<jsp:useBean>` | `new 클래스()` | 빈 객체 생성 |
| `<jsp:setProperty>` | `bean.setXxx()` | 속성 설정 |
| `<jsp:getProperty>` | `bean.getXxx()` | 속성 조회 |

### 인클루드 방식 비교

| 구분 | 액션 태그 | 디렉티브 태그 |
|:-----|:-----|:-----|
| 처리 시점 | 요청 시 | 변환 시 |
| 파일 생성 | 각각 별도 | 하나로 합침 |
| 데이터 전달 | `<jsp:param>` 가능 | 불가 |
| 적합 용도 | 레이아웃 모듈화 | 공통 코드 삽입 |
