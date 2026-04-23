---
title: "08. 서블릿의 필터와 리스너"
weight: 9
---

서블릿 속성과 스코프의 개념, Filter API를 활용한 요청/응답 전처리, Listener API를 활용한 이벤트 처리를 다룬다.

---

## 1. 서블릿 속성과 스코프

### 속성(Attribute)이란

서블릿 속성이란 다음 세 가지 서블릿 API 객체에 `setAttribute()`로 저장되는 객체(정보)를 말한다.

| 저장 객체 | 설명 |
|:-----|:-----|
| `ServletContext` | 애플리케이션 전체에서 공유 |
| `HttpSession` | 브라우저(사용자)별로 공유 |
| `HttpServletRequest` | 하나의 요청/응답 사이클에서만 사용 |

### 스코프(Scope)란

스코프는 바인딩된 속성에 **어디까지 접근할 수 있는지**를 결정하는 범위이다.

| 스코프 | 서블릿 API | 접근 범위 |
|:-----|:-----|:-----|
| 애플리케이션 | `ServletContext` | 앱 전체, 모든 사용자 |
| 세션 | `HttpSession` | 해당 브라우저(사용자)만 |
| 리퀘스트 | `HttpServletRequest` | 해당 요청/응답만 |

```
  스코프 범위 비교

┌────────────────────┐
│ ServletContext     │
│ (앱 전체)          │
│ ┌────────────────┐ │
│ │ HttpSession    │ │
│ │ (사용자별)     │ │
│ │ ┌────────────┐ │ │
│ │ │ Request    │ │ │
│ │ │ (요청 1건) │ │ │
│ │ └────────────┘ │ │
│ └────────────────┘ │
└────────────────────┘
```

### 스코프별 활용 예시

```java
// 애플리케이션 스코프: 전체 공유
ServletContext ctx =
    getServletContext();
ctx.setAttribute("notice", "점검 안내");

// 세션 스코프: 사용자별
HttpSession session =
    request.getSession();
session.setAttribute("userId", "hong");

// 리퀘스트 스코프: 요청 1건
request.setAttribute("result", list);
RequestDispatcher rd =
    request.getRequestDispatcher("view.jsp");
rd.forward(request, response);
```

> **어떤 스코프를 선택할까?**
> - 한 번의 요청에서만 쓰이면 → 리퀘스트 스코프
> - 사용자별로 유지해야 하면 → 세션 스코프
> - 앱 전체가 공유해야 하면 → 애플리케이션 스코프

---

## 2. 서블릿의 URL 패턴

URL 패턴이란 실제 서블릿의 매핑 이름을 말한다. 클라이언트가 브라우저에서 요청할 때 사용되는 가상의 이름으로, 반드시 `/`(슬래시)로 시작해야 한다.

### URL 패턴의 종류

| 종류 | 패턴 예시 | 매칭되는 URL |
|:-----|:-----|:-----|
| 정확히 일치 | `/login` | `/login`만 |
| 디렉터리 | `/user/*` | `/user/list`, `/user/detail` 등 |
| 확장자 | `*.do` | `/login.do`, `/board.do` 등 |
| 기본(전체) | `/` | 다른 패턴에 매칭되지 않는 모든 요청 |

### URL 패턴 적용 예제

```java
// 정확히 일치
@WebServlet("/member/login")
public class LoginServlet
    extends HttpServlet { }

// 디렉터리 패턴
@WebServlet("/api/*")
public class ApiServlet
    extends HttpServlet { }

// 확장자 패턴
@WebServlet("*.do")
public class ActionServlet
    extends HttpServlet { }
```

### 우선순위

여러 패턴이 동시에 매칭될 수 있을 때, 서블릿 컨테이너는 **더 구체적인 패턴**을 우선 적용한다.

```
  URL 패턴 우선순위

  정확히 일치 (/login)
        │  ← 가장 높음
        ▼
  디렉터리 (/user/*)
        │
        ▼
  확장자 (*.do)
        │
        ▼
  기본 (/)
           ← 가장 낮음
```

---

## 3. Filter API

### 필터란

필터는 브라우저와 서블릿 사이에서 **요청이나 응답을 가로채** 사전·사후 처리를 수행하는 기능이다. 서블릿이 실행되기 전에 인코딩을 설정하거나, 인증을 검사하거나, 응답 결과를 가공하는 등의 작업을 할 수 있다.

```
  필터 동작 흐름

  브라우저
    │
    ▼
┌──────────┐
│ 필터 1   │ ← 인코딩 설정
└────┬─────┘
     │
     ▼
┌──────────┐
│ 필터 2   │ ← 인증 검사
└────┬─────┘
     │
     ▼
┌──────────┐
│  서블릿  │ ← 비즈니스 로직
└────┬─────┘
     │
     ▼
  브라우저 (응답)
```

### 필터의 용도

**요청 필터 (서블릿 실행 전)**

| 용도 | 설명 |
|:-----|:-----|
| 인코딩 설정 | 모든 요청에 UTF-8 인코딩 적용 |
| 인증/권한 검사 | 로그인 여부, 접근 권한 확인 |
| 요청 로깅 | 요청 URL, 파라미터 기록 |
| XSS 방어 | 입력값에서 스크립트 태그 제거 |

**응답 필터 (서블릿 실행 후)**

| 용도 | 설명 |
|:-----|:-----|
| 응답 암호화 | 응답 데이터 암호화 처리 |
| 응답 압축 | Gzip 압축 적용 |
| 처리 시간 측정 | 서블릿 실행 소요 시간 계산 |

### 필터 관련 API

| API | 역할 |
|:-----|:-----|
| `javax.servlet.Filter` | 필터 구현을 위한 인터페이스 |
| `javax.servlet.FilterChain` | 다음 필터 또는 서블릿으로 전달 |
| `javax.servlet.FilterConfig` | 필터 초기화 정보 제공 |

### Filter 인터페이스 메서드

| 메서드 | 기능 |
|:-----|:-----|
| `init(FilterConfig)` | 필터 초기화 시 호출 |
| `doFilter(request, response, chain)` | 필터 로직 실행 |
| `destroy()` | 필터 소멸 시 호출 |

### FilterConfig 메서드

| 메서드 | 기능 |
|:-----|:-----|
| `getFilterName()` | 필터 이름 반환 |
| `getInitParameter(name)` | 초기화 파라미터 값 반환 |
| `getServletContext()` | 서블릿 컨텍스트 객체 반환 |

---

## 4. 사용자 정의 필터 만들기

사용자 정의 필터는 반드시 `Filter` 인터페이스를 구현해야 하며, `init()`, `doFilter()`, `destroy()` 메서드를 오버라이드해야 한다.

### 필터 생명주기

```
  필터 생명주기

  컨테이너 시작
      │
      ▼
  init()     ← 1회 호출
      │
      ▼
  doFilter() ← 요청마다 호출
      │
      ▼
  destroy()  ← 컨테이너 종료 시
```

### 필터 매핑 방법

필터를 어떤 요청에 적용할지 지정하는 방법은 두 가지이다.

**1. 애너테이션 방식**

```java
@WebFilter("/*")
public class EncodingFilter
    implements Filter {

    @Override
    public void init(FilterConfig config)
        throws ServletException {
        System.out.println("필터 초기화");
    }

    @Override
    public void doFilter(
        ServletRequest request,
        ServletResponse response,
        FilterChain chain)
        throws IOException, ServletException {

        // ── 서블릿 실행 전 처리 ──
        request.setCharacterEncoding("UTF-8");

        // 다음 필터 또는 서블릿으로 전달
        chain.doFilter(request, response);

        // ── 서블릿 실행 후 처리 ──
    }

    @Override
    public void destroy() {
        System.out.println("필터 소멸");
    }
}
```

**2. web.xml 방식**

```xml
<filter>
    <filter-name>encodingFilter</filter-name>
    <filter-class>
        com.example.EncodingFilter
    </filter-class>
</filter>
<filter-mapping>
    <filter-name>encodingFilter</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

> web.xml 방식은 `<filter-mapping>`의 등록 순서대로 필터가 실행된다.
> 애너테이션 방식은 클래스 이름의 알파벳 순서로 실행된다.

### doFilter()의 핵심

`doFilter()` 메서드는 세 개의 매개변수를 받는다.

| 매개변수 | 타입 | 역할 |
|:-----|:-----|:-----|
| request | `ServletRequest` | 요청 객체 |
| response | `ServletResponse` | 응답 객체 |
| chain | `FilterChain` | 다음 필터/서블릿 호출 |

`chain.doFilter(request, response)`를 기준으로 **그 위의 코드는 요청 전처리**, **그 아래의 코드는 응답 후처리**가 된다.

```
  doFilter() 실행 구조

  doFilter() 시작
      │
      ▼
  요청 전처리 코드
  (인코딩, 인증 등)
      │
      ▼
  chain.doFilter() ──► 서블릿 실행
      │
      ▼
  응답 후처리 코드
  (로깅, 시간 측정 등)
```

---

## 5. 필터 활용 예제

### 인코딩 필터

모든 요청에 UTF-8 인코딩을 일괄 적용하는 필터이다. 각 서블릿마다 `setCharacterEncoding()`을 호출할 필요가 없어진다.

```java
@WebFilter("/*")
public class EncodingFilter
    implements Filter {

    private String encoding;

    @Override
    public void init(FilterConfig config)
        throws ServletException {
        // web.xml 초기화 파라미터에서 읽기
        encoding =
            config.getInitParameter("encoding");
        if (encoding == null) {
            encoding = "UTF-8";
        }
    }

    @Override
    public void doFilter(
        ServletRequest request,
        ServletResponse response,
        FilterChain chain)
        throws IOException, ServletException {

        request.setCharacterEncoding(encoding);
        response.setContentType(
            "text/html;charset=" + encoding);

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() { }
}
```

### 인증 필터

로그인하지 않은 사용자의 접근을 차단하는 필터이다.

```java
@WebFilter("/member/*")
public class AuthFilter
    implements Filter {

    @Override
    public void init(FilterConfig config)
        throws ServletException { }

    @Override
    public void doFilter(
        ServletRequest request,
        ServletResponse response,
        FilterChain chain)
        throws IOException, ServletException {

        HttpServletRequest httpReq =
            (HttpServletRequest) request;
        HttpServletResponse httpRes =
            (HttpServletResponse) response;

        HttpSession session =
            httpReq.getSession(false);

        if (session != null
            && session.getAttribute(
                "userId") != null) {
            // 로그인 상태 → 통과
            chain.doFilter(request, response);
        } else {
            // 미로그인 → 로그인 페이지로
            httpRes.sendRedirect(
                httpReq.getContextPath()
                + "/login");
        }
    }

    @Override
    public void destroy() { }
}
```

### 처리 시간 측정 필터

서블릿의 실행 소요 시간을 측정하여 로그에 기록하는 필터이다.

```java
@WebFilter("/*")
public class TimerFilter
    implements Filter {

    @Override
    public void init(FilterConfig config)
        throws ServletException { }

    @Override
    public void doFilter(
        ServletRequest request,
        ServletResponse response,
        FilterChain chain)
        throws IOException, ServletException {

        long start = System.currentTimeMillis();

        chain.doFilter(request, response);

        long end = System.currentTimeMillis();
        long elapsed = end - start;

        HttpServletRequest httpReq =
            (HttpServletRequest) request;
        String uri = httpReq.getRequestURI();

        System.out.println(
            uri + " 처리 시간: "
            + elapsed + "ms");
    }

    @Override
    public void destroy() { }
}
```

---

## 6. 다중 필터 체인

필터는 여러 개를 연결하여 **필터 체인**을 구성할 수 있다. 각 필터는 `chain.doFilter()`를 호출하여 다음 필터로 넘기고, 마지막 필터가 호출하면 서블릿이 실행된다.

```
  다중 필터 실행 순서

  요청 ──► 필터A(전처리)
           chain.doFilter()
           ──► 필터B(전처리)
                chain.doFilter()
                ──► 서블릿 실행
           ◄── 필터B(후처리)
      ◄── 필터A(후처리)
  응답
```

> `chain.doFilter()`를 호출하지 않으면 다음 필터나 서블릿이 실행되지 않는다.
> 인증 필터에서 미인증 사용자를 차단할 때 이 특성을 활용한다.

---

## 7. Listener API

### 리스너란

리스너는 서블릿 컨테이너에서 발생하는 **특정 이벤트를 감지**하고, 이벤트 발생 시 자동으로 호출되는 메서드를 정의하는 기능이다. 컨텍스트 생성/소멸, 세션 생성/소멸, 속성 변경 등의 이벤트를 처리할 수 있다.

### 리스너의 종류

**컨텍스트 관련 리스너**

| 리스너 | 메서드 | 기능 |
|:-----|:-----|:-----|
| `ServletContextListener` | `contextInitialized()`, `contextDestroyed()` | 컨텍스트 객체 생성/소멸 이벤트 |
| `ServletContextAttributeListener` | `attributeAdded()`, `attributeRemoved()`, `attributeReplaced()` | 컨텍스트 속성 추가/제거/수정 이벤트 |

**세션 관련 리스너**

| 리스너 | 메서드 | 기능 |
|:-----|:-----|:-----|
| `HttpSessionListener` | `sessionCreated()`, `sessionDestroyed()` | 세션 생성/소멸 이벤트 |
| `HttpSessionAttributeListener` | `attributeAdded()`, `attributeRemoved()`, `attributeReplaced()` | 세션 속성 추가/제거/수정 이벤트 |
| `HttpSessionBindingListener` | `valueBound()`, `valueUnbound()` | 객체가 세션에 바인딩/언바인딩될 때 |
| `HttpSessionActivationListener` | `sessionDidActivate()`, `sessionWillPassivate()` | 세션 활성화/비활성화 이벤트 |

**요청 관련 리스너**

| 리스너 | 메서드 | 기능 |
|:-----|:-----|:-----|
| `ServletRequestListener` | `requestInitialized()`, `requestDestroyed()` | 요청 생성/소멸 이벤트 |
| `ServletRequestAttributeListener` | `attributeAdded()`, `attributeRemoved()`, `attributeReplaced()` | 요청 속성 추가/제거/수정 이벤트 |

---

## 8. 리스너 활용 예제

### ServletContextListener — 애플리케이션 초기화

웹 애플리케이션 시작/종료 시점에 초기화·정리 작업을 수행할 때 사용한다. DB 커넥션풀 초기화, 설정 파일 로딩 등에 활용된다.

```java
@WebListener
public class AppInitListener
    implements ServletContextListener {

    @Override
    public void contextInitialized(
        ServletContextEvent sce) {

        System.out.println("앱 시작: 초기화 수행");

        ServletContext ctx =
            sce.getServletContext();

        // 설정값 로딩
        String dbUrl =
            ctx.getInitParameter("dbUrl");
        ctx.setAttribute("dbUrl", dbUrl);
    }

    @Override
    public void contextDestroyed(
        ServletContextEvent sce) {
        System.out.println("앱 종료: 자원 정리");
    }
}
```

### HttpSessionListener — 접속자 수 추적

세션이 생성/소멸될 때마다 호출되므로, 현재 접속 중인 사용자 수를 실시간으로 추적할 수 있다.

```java
@WebListener
public class SessionCountListener
    implements HttpSessionListener {

    private static int activeSessions = 0;

    @Override
    public void sessionCreated(
        HttpSessionEvent se) {
        activeSessions++;
        System.out.println(
            "세션 생성. 현재 접속자: "
            + activeSessions);

        se.getSession()
          .getServletContext()
          .setAttribute(
              "activeSessions",
              activeSessions);
    }

    @Override
    public void sessionDestroyed(
        HttpSessionEvent se) {
        if (activeSessions > 0) {
            activeSessions--;
        }
        System.out.println(
            "세션 소멸. 현재 접속자: "
            + activeSessions);

        se.getSession()
          .getServletContext()
          .setAttribute(
              "activeSessions",
              activeSessions);
    }

    public static int getActiveSessions() {
        return activeSessions;
    }
}
```

### ServletRequestListener — 요청 로깅

모든 요청의 시작과 끝을 감지하여 로그를 남길 수 있다.

```java
@WebListener
public class RequestLogListener
    implements ServletRequestListener {

    @Override
    public void requestInitialized(
        ServletRequestEvent sre) {

        HttpServletRequest request =
            (HttpServletRequest)
                sre.getServletRequest();
        String uri = request.getRequestURI();
        String method = request.getMethod();

        System.out.println(
            "요청 시작: " + method
            + " " + uri);

        // 시작 시간 기록
        request.setAttribute(
            "startTime",
            System.currentTimeMillis());
    }

    @Override
    public void requestDestroyed(
        ServletRequestEvent sre) {

        HttpServletRequest request =
            (HttpServletRequest)
                sre.getServletRequest();

        long start = (Long)
            request.getAttribute("startTime");
        long elapsed =
            System.currentTimeMillis() - start;

        System.out.println(
            "요청 종료: "
            + request.getRequestURI()
            + " (" + elapsed + "ms)");
    }
}
```

### HttpSessionBindingListener — 바인딩 감지

이 리스너는 다른 리스너와 달리 `@WebListener`를 사용하지 않는다. 리스너 인터페이스를 구현한 객체가 **세션에 바인딩/언바인딩될 때 자동 호출**된다.

```java
public class LoginUser
    implements HttpSessionBindingListener {

    private String userId;
    private String userName;

    public LoginUser(
        String userId, String userName) {
        this.userId = userId;
        this.userName = userName;
    }

    @Override
    public void valueBound(
        HttpSessionBindingEvent event) {
        System.out.println(
            userName + " 로그인 (세션 바인딩)");
    }

    @Override
    public void valueUnbound(
        HttpSessionBindingEvent event) {
        System.out.println(
            userName + " 로그아웃 (세션 언바인딩)");
    }

    // getter 생략
}
```

```java
// 사용 예: 세션에 바인딩하면 자동 호출
LoginUser user =
    new LoginUser("hong", "홍길동");

// valueBound() 자동 호출
session.setAttribute("loginUser", user);

// valueUnbound() 자동 호출
session.removeAttribute("loginUser");
```

---

## 9. 리스너 등록 방법

필터와 마찬가지로 애너테이션 또는 web.xml로 등록한다.

**1. 애너테이션 방식**

```java
@WebListener
public class MyListener
    implements ServletContextListener {
    // ...
}
```

**2. web.xml 방식**

```xml
<listener>
    <listener-class>
        com.example.MyListener
    </listener-class>
</listener>
```

> `HttpSessionBindingListener`는 등록이 필요 없다.
> 해당 인터페이스를 구현한 객체를 세션에 바인딩하면 자동으로 동작한다.

---

## 요약

### 스코프 비교

| 스코프 | 객체 | 범위 | 활용 예시 |
|:-----|:-----|:-----|:-----|
| 리퀘스트 | `HttpServletRequest` | 요청 1건 | 폼 데이터, 포워드 전달 |
| 세션 | `HttpSession` | 사용자별 | 로그인, 장바구니 |
| 애플리케이션 | `ServletContext` | 앱 전체 | 공지사항, 설정값 |

### 필터 핵심

| 항목 | 설명 |
|:-----|:-----|
| 역할 | 요청/응답을 가로채 전처리·후처리 수행 |
| 구현 | `Filter` 인터페이스 구현 |
| 핵심 메서드 | `doFilter(request, response, chain)` |
| 전처리/후처리 | `chain.doFilter()` 호출 전후로 구분 |
| 매핑 | `@WebFilter` 또는 web.xml |
| 필터 체인 | 여러 필터를 순서대로 연결 가능 |
| 대표 활용 | 인코딩, 인증, 로깅, 시간 측정 |

### 리스너 핵심

| 항목 | 설명 |
|:-----|:-----|
| 역할 | 컨테이너 이벤트 감지 및 자동 처리 |
| 등록 | `@WebListener` 또는 web.xml |
| 컨텍스트 | `ServletContextListener` |
| 세션 | `HttpSessionListener` |
| 요청 | `ServletRequestListener` |
| 바인딩 감지 | `HttpSessionBindingListener` (등록 불필요) |
| 대표 활용 | 초기화, 접속자 수 추적, 로깅 |
