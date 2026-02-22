---
title: "09. JSP 등장 배경"
weight: 10
---

서블릿의 화면 처리 한계를 극복하기 위해 등장한 JSP의 개념과, 변환 과정, 디렉티브 태그의 종류 및 사용법을 다룬다.

---

## 1. JSP가 등장한 이유

### 서블릿의 화면 처리 문제

서블릿은 자바 코드 안에서 `PrintWriter`로 HTML을 문자열로 출력한다. 간단한 페이지라면 문제가 없지만, 화면이 복잡해지면 개발과 유지보수가 매우 어려워진다.

```java
// 서블릿에서 HTML 출력 (불편함)
out.println("<html>");
out.println("<head><title>목록</title></head>");
out.println("<body>");
out.println("<table>");
for (Member m : list) {
    out.println("<tr>");
    out.println("<td>" + m.getName() + "</td>");
    out.println("</tr>");
}
out.println("</table>");
out.println("</body></html>");
```

이 방식은 다음과 같은 문제가 있다.

| 문제 | 설명 |
|:-----|:-----|
| 가독성 | HTML이 자바 문자열 안에 있어 읽기 어려움 |
| 유지보수 | 디자인 변경 시 자바 코드를 수정해야 함 |
| 협업 | 디자이너가 자바 코드를 이해해야 함 |
| 오류 | 태그 누락, 따옴표 오류를 컴파일 전까지 발견하기 어려움 |

### JSP의 접근 방식

JSP는 서블릿과 반대로 **HTML을 기반으로 필요한 부분에만 자바 코드를 삽입**하는 방식이다.

```
  서블릿 vs JSP

  서블릿
  ┌──────────────────┐
  │ 자바 코드 기반    │
  │ out.println(     │
  │   "<html>..."    │
  │ );               │
  └──────────────────┘

  JSP
  ┌──────────────────┐
  │ HTML/CSS 기반     │
  │ <html>           │
  │   <% 자바 코드 %> │
  │ </html>          │
  └──────────────────┘
```

> JSP는 디자이너가 화면을 쉽게 구현하고, 개발 후 유지보수를 편리하게 하기 위해 도입되었다.

---

## 2. JSP의 구성 요소

JSP 페이지는 다음 요소들로 구성된다.

| 구성 요소 | 설명 |
|:-----|:-----|
| HTML, CSS, JavaScript | 화면의 구조, 스타일, 동적 기능 |
| JSP 기본 태그 | 디렉티브, 스크립트릿, 표현식, 선언식 |
| JSP 액션 태그 | `<jsp:include>`, `<jsp:forward>` 등 |
| 커스텀 태그 | 개발자 또는 프레임워크가 제공하는 태그 |

```
  JSP 페이지 구성

┌──────────────────────┐
│  JSP 페이지           │
│                      │
│  HTML / CSS / JS     │
│  ──── 화면 구조 ──── │
│                      │
│  <%@ 디렉티브 %>      │
│  ──── 페이지 설정 ─── │
│                      │
│  <% 스크립트릿 %>     │
│  ──── 자바 로직 ──── │
│                      │
│  <%= 표현식 %>        │
│  ──── 값 출력 ─────  │
│                      │
│  <jsp:액션태그 />     │
│  ──── 페이지 제어 ─── │
└──────────────────────┘
```

---

## 3. JSP의 3단계 작업 과정

JSP 파일은 브라우저가 직접 해석할 수 없다. 톰캣 컨테이너가 JSP를 서블릿으로 변환한 뒤 실행하여, 최종적으로 HTML을 브라우저에 전송한다.

### 변환 과정

| 단계 | 이름 | 동작 |
|:-----|:-----|:-----|
| 1단계 | 변환 (Translation) | JSP → `.java` 파일로 변환 |
| 2단계 | 컴파일 (Compile) | `.java` → `.class` 파일로 컴파일 |
| 3단계 | 실행 (Interpret) | `.class` 실행 → HTML 결과를 브라우저로 전송 |

```
  JSP 실행 3단계

  hello.jsp
      │
      ▼  1단계: 변환
  hello_jsp.java
      │
      ▼  2단계: 컴파일
  hello_jsp.class
      │
      ▼  3단계: 실행
  HTML/CSS/JS → 브라우저
```

### 최초 요청 vs 재요청

최초 요청 시에는 3단계를 모두 거치므로 느리지만, 이후 동일한 JSP를 요청하면 이미 컴파일된 `.class` 파일을 재사용하므로 빠르게 응답한다.

```
  최초 요청
  브라우저 ──► JSP 변환
              ──► 컴파일
              ──► 실행
  브라우저 ◄── HTML 응답

  재요청 (JSP 변경 없음)
  브라우저 ──► 기존 .class 실행
  브라우저 ◄── HTML 응답

  재요청 (JSP 변경됨)
  브라우저 ──► 다시 변환
              ──► 다시 컴파일
              ──► 실행
  브라우저 ◄── HTML 응답
```

> JSP가 수정되면 컨테이너가 변경을 감지하여 변환과 컴파일을 다시 수행한다.

### 변환된 자바 파일 확인

톰캣에서 변환된 파일은 `work` 디렉터리에서 확인할 수 있다.

```
tomcat/work/Catalina/localhost/
    프로젝트명/org/apache/jsp/
        hello_jsp.java   ← 변환된 자바 파일
        hello_jsp.class  ← 컴파일된 클래스 파일
```

---

## 4. JSP 페이지 구성 요소 상세

JSP 페이지에서 사용되는 구성 요소를 분류하면 다음과 같다.

| 구성 요소 | 문법 | 설명 |
|:-----|:-----|:-----|
| 디렉티브 태그 | `<%@ %>` | 페이지 설정 정보 지정 |
| 스크립트릿 | `<% %>` | 자바 코드 실행 |
| 표현식 | `<%= %>` | 값을 문자열로 출력 |
| 선언식 | `<%! %>` | 멤버 변수·메서드 선언 |
| 주석문 | `<%-- --%>` | JSP 주석 (브라우저에 미전송) |
| 표현 언어 (EL) | `${ }` | 간결한 값 출력 |
| 내장 객체 | `request`, `session` 등 | 선언 없이 사용 가능한 객체 |
| 액션 태그 | `<jsp:xxx />` | 페이지 제어 |
| 커스텀 태그 | `<c:xxx />` 등 | JSTL, 사용자 정의 태그 |

> 디렉티브 태그와 스크립트 요소는 JSP 초기부터 사용된 핵심 기능이다.
> 표현 언어, 액션 태그, 커스텀 태그는 이후 버전에서 추가된 기능이다.

---

## 5. 디렉티브 태그

디렉티브 태그는 JSP 페이지에 대한 **전반적인 설정 정보**를 지정할 때 사용한다.

### 디렉티브 태그의 종류

| 디렉티브 | 형식 | 기능 |
|:-----|:-----|:-----|
| 페이지 | `<%@ page ... %>` | JSP 페이지의 전반적인 정보 설정 |
| 인클루드 | `<%@ include ... %>` | 공통 JSP 페이지를 포함 |
| 태그라이브 | `<%@ taglib ... %>` | 커스텀 태그 라이브러리 선언 |

---

## 6. 페이지 디렉티브 태그

### 기본 형식

```jsp
<%@ page 속성1="값1" 속성2="값2" %>
```

### 주요 속성

| 속성 | 기본값 | 설명 |
|:-----|:-----|:-----|
| `language` | `"java"` | 사용할 스크립트 언어 |
| `contentType` | `"text/html"` | 응답의 MIME 타입과 인코딩 |
| `pageEncoding` | `"ISO-8859-1"` | JSP 파일의 문자 인코딩 |
| `import` | 없음 | 자바 패키지/클래스 임포트 |
| `session` | `"true"` | 세션 객체 사용 여부 |
| `buffer` | `"8kb"` | 출력 버퍼 크기 |
| `autoFlush` | `"true"` | 버퍼가 차면 자동 출력 여부 |
| `errorPage` | 없음 | 예외 발생 시 이동할 페이지 |
| `isErrorPage` | `"false"` | 현재 페이지가 에러 페이지인지 여부 |
| `isELIgnored` | `"true"` | EL 표현식 무시 여부 |
| `info` | 없음 | 페이지 설명 문자열 |

### 자주 사용하는 설정 예제

**기본 페이지 설정**

```jsp
<%@ page language="java"
    contentType="text/html;charset=UTF-8"
    pageEncoding="UTF-8" %>
```

**클래스 임포트**

```jsp
<%@ page import="java.util.List" %>
<%@ page import="java.util.ArrayList" %>

<!-- 여러 클래스를 한 번에 임포트 -->
<%@ page import="java.util.List,
    java.util.ArrayList,
    java.text.SimpleDateFormat" %>
```

**에러 페이지 설정**

```jsp
<!-- 일반 페이지: 에러 발생 시 이동 -->
<%@ page errorPage="error.jsp" %>

<!-- 에러 페이지: exception 내장 객체 사용 -->
<%@ page isErrorPage="true" %>
<html>
<body>
    <h3>오류가 발생했습니다.</h3>
    <p>메시지: <%= exception.getMessage() %></p>
</body>
</html>
```

### contentType vs pageEncoding

| 속성 | 대상 | 역할 |
|:-----|:-----|:-----|
| `contentType` | 응답 | 브라우저에 전달하는 MIME 타입과 인코딩 |
| `pageEncoding` | JSP 파일 | JSP 소스 파일 자체의 인코딩 |

```
  인코딩 설정의 적용 위치

  JSP 파일 (pageEncoding)
      │
      ▼  컨테이너가 읽을 때
  변환·컴파일
      │
      ▼  브라우저에 응답할 때
  HTML 응답 (contentType)
```

> 한글 깨짐을 방지하려면 두 속성 모두 `UTF-8`로 설정하는 것이 안전하다.

---

## 7. 인클루드 디렉티브 태그

### 개념

인클루드 디렉티브 태그는 여러 JSP 페이지에서 **공통으로 사용되는 부분**을 별도의 JSP로 만들어 놓고, 다른 페이지에 포함시키는 기능이다.

### 기본 형식

```jsp
<%@ include file="공통페이지.jsp" %>
```

### 활용 예시

헤더, 푸터 같은 공통 영역을 분리하여 재사용한다.

**header.jsp**

```jsp
<%@ page contentType="text/html;charset=UTF-8"
    pageEncoding="UTF-8" %>
<header>
    <h1>My Website</h1>
    <nav>
        <a href="index.jsp">홈</a>
        <a href="board.jsp">게시판</a>
    </nav>
</header>
<hr>
```

**footer.jsp**

```jsp
<%@ page contentType="text/html;charset=UTF-8"
    pageEncoding="UTF-8" %>
<hr>
<footer>
    <p>&copy; 2026 My Website</p>
</footer>
```

**main.jsp (인클루드 사용)**

```jsp
<%@ page contentType="text/html;charset=UTF-8"
    pageEncoding="UTF-8" %>
<html>
<body>
    <%@ include file="header.jsp" %>

    <main>
        <h2>메인 콘텐츠</h2>
        <p>본문 내용입니다.</p>
    </main>

    <%@ include file="footer.jsp" %>
</body>
</html>
```

```
  인클루드 디렉티브 동작

┌──────────────────────┐
│  main.jsp            │
│                      │
│  ┌────────────────┐  │
│  │  header.jsp    │  │
│  │  (공통 헤더)   │  │
│  └────────────────┘  │
│                      │
│  메인 콘텐츠          │
│                      │
│  ┌────────────────┐  │
│  │  footer.jsp    │  │
│  │  (공통 푸터)   │  │
│  └────────────────┘  │
└──────────────────────┘
    ↓ 변환 시 하나의 자바 파일
  main_jsp.java
```

### 특징

| 항목 | 설명 |
|:-----|:-----|
| 변환 시점 | JSP → 자바 변환 시 포함 (**정적 포함**) |
| 결과 | 포함된 페이지와 합쳐져 **하나의 자바 파일**로 변환 |
| 변수 공유 | 포함된 페이지의 변수를 그대로 사용 가능 |
| 용도 | 헤더, 푸터, 공통 설정 등 |

> 인클루드 디렉티브는 **변환 시점에 정적으로 합쳐진다**.
> 실행 시점에 동적으로 포함하려면 `<jsp:include>` 액션 태그를 사용한다.

---

## 8. 태그라이브 디렉티브 태그

### 개념

태그라이브 디렉티브 태그는 커스텀 태그 라이브러리를 JSP에서 사용할 수 있도록 선언하는 태그이다. JSTL이나 개발자가 직접 만든 태그를 사용할 때 필요하다.

### 기본 형식

```jsp
<%@ taglib prefix="접두사" uri="태그라이브러리URI" %>
```

### 사용 예시

```jsp
<!-- JSTL Core 라이브러리 선언 -->
<%@ taglib prefix="c"
    uri="http://java.sun.com/jsp/jstl/core" %>

<!-- JSTL 포매팅 라이브러리 선언 -->
<%@ taglib prefix="fmt"
    uri="http://java.sun.com/jsp/jstl/fmt" %>

<!-- 사용 -->
<c:forEach var="item" items="${list}">
    <p>${item.name}</p>
</c:forEach>

<fmt:formatDate value="${now}"
    pattern="yyyy-MM-dd" />
```

| 속성 | 설명 |
|:-----|:-----|
| `prefix` | 태그 사용 시 붙이는 접두사 |
| `uri` | 태그 라이브러리를 식별하는 URI |

---

## 요약

### JSP 등장 배경

| 항목 | 서블릿 | JSP |
|:-----|:-----|:-----|
| 기반 | 자바 코드 | HTML/CSS/JS |
| 화면 처리 | 문자열로 HTML 출력 | HTML에 자바 코드 삽입 |
| 장점 | 로직 처리에 강함 | 화면 구현·유지보수에 강함 |
| 대상 | 개발자 | 디자이너·개발자 |

### JSP 변환 3단계

| 단계 | 변환 | 입력 → 출력 |
|:-----|:-----|:-----|
| 1 | Translation | `.jsp` → `.java` |
| 2 | Compile | `.java` → `.class` |
| 3 | Interpret | `.class` → HTML 응답 |

### 디렉티브 태그 비교

| 디렉티브 | 형식 | 용도 |
|:-----|:-----|:-----|
| 페이지 | `<%@ page %>` | 인코딩, 임포트, 에러 페이지 설정 |
| 인클루드 | `<%@ include %>` | 공통 JSP 파일 포함 (정적) |
| 태그라이브 | `<%@ taglib %>` | 커스텀 태그 라이브러리 선언 |
