---
title: "07. 쿠키와 세션 알아보기"
weight: 8
---

HTTP의 stateless 특성을 극복하기 위한 세션 트래킹 기법과, 쿠키·세션의 동작 원리 및 활용법을 다룬다.

---

## 1. 세션 트래킹 (Session Tracking)

### HTTP의 stateless 문제

HTTP 프로토콜은 **stateless** 방식으로 통신한다. 브라우저에서 새 웹 페이지를 열면 기존 페이지의 상태나 정보를 알 수 없다. 따라서 웹 페이지 간 상태를 공유하려면 별도의 연결 기능이 필요하다.

```
  stateless 통신

  요청1: 로그인 ──► 서버 (인증 성공)
  요청2: 마이페이지 ──► 서버 (누구?)
  → 이전 요청 정보를 기억하지 못함
```

### 웹 페이지 연동 방법

| 방법 | 저장 위치 | 특징 |
|:-----|:-----|:-----|
| `<hidden>` 태그 | HTML 폼 | 간단하지만 소스에 노출 |
| URL Rewriting | URL 쿼리 스트링 | GET 방식, URL에 노출 |
| 쿠키 (Cookie) | **클라이언트 PC** | 파일/메모리 저장, 용량 제한 |
| 세션 (Session) | **서버 메모리** | 보안 우수, 서버 부하 |

```
  각 방법의 저장 위치

┌──────────────┐    ┌──────────────┐
│  클라이언트    │    │    서버       │
│              │    │              │
│ hidden: 폼   │    │ 세션: 메모리   │
│ URL: 주소창   │    │              │
│ 쿠키: 파일    │    │              │
└──────────────┘    └──────────────┘
```

---

## 2. 쿠키 (Cookie)

### 쿠키의 개념

웹 페이지들 사이의 공유 정보를 **클라이언트 PC**에 저장해 놓고 필요할 때 여러 웹 페이지가 공유하는 방법이다.

**쿠키의 특징**
- 정보가 클라이언트 PC에 저장된다
- 저장 용량에 제한이 있다 (파일당 4KB)
- 보안에 취약하다 (클라이언트에서 조회·수정 가능)
- 브라우저 설정에서 쿠키 사용 여부를 제어할 수 있다
- 도메인당 쿠키가 만들어진다

> 보안과 무관한 정보(팝업 표시 여부, 최근 검색어 등)에 주로 사용한다.

### 쿠키의 종류

| 구분 | Persistence 쿠키 | Session 쿠키 |
|:-----|:-----|:-----|
| 저장 위치 | 파일 | 브라우저 메모리 |
| 소멸 시점 | 만료 시간 도달 또는 수동 삭제 | 브라우저 종료 시 |
| 최초 접속 | 서버로 전송됨 | 서버로 전송되지 않음 |
| 용도 | 로그인 유지, 팝업 제한 | 세션 인증 정보 유지 |
| `setMaxAge()` | 양수 지정 | 음수 또는 미호출 |

```
  쿠키 종류별 생명주기

  Persistence 쿠키
  ├─ setMaxAge(3600) → 1시간 유지
  ├─ 브라우저 종료해도 파일로 남음
  └─ 만료 시간 도달 시 자동 삭제

  Session 쿠키
  ├─ setMaxAge(-1) 또는 미호출
  ├─ 브라우저 메모리에만 존재
  └─ 브라우저 종료 시 소멸
```

---

## 3. 쿠키 API

### 쿠키 관련 클래스와 메서드

쿠키는 `javax.servlet.http.Cookie` 클래스를 사용한다.

| 메서드 | 기능 |
|:-----|:-----|
| `Cookie(name, value)` | 쿠키 객체 생성 |
| `setMaxAge(int)` | 유효 기간 설정 (초 단위) |
| `setValue(String)` | 쿠키 값 변경 |
| `setDomain(String)` | 유효 도메인 설정 |
| `setPath(String)` | 유효 경로 설정 |
| `getName()` | 쿠키 이름 반환 |
| `getValue()` | 쿠키 값 반환 |
| `getMaxAge()` | 유효 기간 반환 |

**쿠키 전송/수신 메서드**

| 메서드 | 소속 | 기능 |
|:-----|:-----|:-----|
| `addCookie(cookie)` | `HttpServletResponse` | 클라이언트에 쿠키 전송 |
| `getCookies()` | `HttpServletRequest` | 클라이언트 쿠키 배열 수신 |

### 쿠키 동작 과정

```
  ① 쿠키 생성 및 전송

  브라우저 ──요청──► SetCookieServlet
                   Cookie c = new Cookie()
                   response.addCookie(c)
  브라우저 ◄─응답── Set-Cookie 헤더
  쿠키 저장 완료

  ② 쿠키 재전송

  브라우저 ──요청──► GetCookieServlet
  (Cookie 헤더)    Cookie[] = getCookies()
  브라우저 ◄─응답── 쿠키 값 활용
```

### 쿠키 생성 및 전송 예제

```java
@WebServlet("/set-cookie")
public class SetCookieServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        // 쿠키 생성
        Cookie userCookie =
            new Cookie("userId", "hong123");

        // 유효 기간 설정 (24시간)
        userCookie.setMaxAge(60 * 60 * 24);

        // 쿠키 경로 설정
        userCookie.setPath("/");

        // 클라이언트에 전송
        response.addCookie(userCookie);

        response.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out =
            response.getWriter();
        out.println("쿠키가 설정되었습니다.");
    }
}
```

### 쿠키 수신 및 조회 예제

```java
@WebServlet("/get-cookie")
public class GetCookieServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        response.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out =
            response.getWriter();

        // 클라이언트 쿠키 가져오기
        Cookie[] cookies =
            request.getCookies();

        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("userId".equals(
                        c.getName())) {
                    out.println(
                        "사용자: "
                        + c.getValue());
                }
            }
        } else {
            out.println("쿠키가 없습니다.");
        }
    }
}
```

### 쿠키 삭제

쿠키를 삭제하려면 **동일한 이름의 쿠키**를 생성한 뒤 `setMaxAge(0)`으로 설정하여 전송한다.

```java
Cookie delCookie =
    new Cookie("userId", "");
delCookie.setMaxAge(0);
delCookie.setPath("/");
response.addCookie(delCookie);
```

> 쿠키에는 별도의 삭제 API가 없다.
> 유효 기간을 0으로 설정하면 브라우저가 즉시 삭제한다.

---

## 4. 쿠키를 이용한 팝업 제한 예제

"오늘 하루 보지 않기" 같은 기능에 쿠키를 활용할 수 있다.

```java
// 팝업 제한 쿠키 설정
Cookie popup =
    new Cookie("noPopup", "true");
popup.setMaxAge(60 * 60 * 24); // 24시간
popup.setPath("/");
response.addCookie(popup);
```

```java
// 팝업 표시 여부 확인
boolean showPopup = true;
Cookie[] cookies = request.getCookies();

if (cookies != null) {
    for (Cookie c : cookies) {
        if ("noPopup".equals(c.getName())
            && "true".equals(c.getValue())) {
            showPopup = false;
            break;
        }
    }
}
```

---

## 5. 세션 (Session)

### 세션의 개념

세션은 웹 페이지 간 공유 정보를 **서버 메모리**에 저장하는 방법이다. 쿠키와 달리 정보가 서버에 있으므로 보안에 유리하다.

**세션의 특징**
- 정보가 서버 메모리에 저장된다
- 브라우저와의 연동에 세션 쿠키를 이용한다
- 쿠키보다 보안에 유리하다
- 서버에 부하를 줄 수 있다
- 브라우저(사용자)당 한 개의 세션이 생성된다
- 기본 유효 시간은 30분이다

### 쿠키 vs 세션

| 구분 | 쿠키 | 세션 |
|:-----|:-----|:-----|
| 저장 위치 | 클라이언트 PC | 서버 메모리 |
| 보안 | 취약 (노출·변조 가능) | 우수 (서버에서 관리) |
| 용량 제한 | 4KB | 서버 메모리 한도 |
| 서버 부하 | 없음 | 사용자 수에 비례 |
| 생명주기 | 만료 시간 또는 브라우저 종료 | 유효 시간 또는 `invalidate()` |
| 속도 | 빠름 (로컬 읽기) | 상대적으로 느림 (서버 접근) |

---

## 6. 세션 동작 원리

### 세션 실행 과정

```
  ① 최초 접속

  브라우저 ──요청──► 서버
                   세션 객체 생성
                   세션 ID 발급
  브라우저 ◄─응답── Set-Cookie:
  세션 쿠키 저장      JSESSIONID=ABC123

  ② 재접속

  브라우저 ──요청──► 서버
  Cookie:           JSESSIONID로
  JSESSIONID=ABC123  세션 객체 조회
  브라우저 ◄─응답── 세션 데이터 활용
```

**핵심 포인트**
- 서버가 세션을 생성하면 고유한 **세션 ID**를 발급한다
- 세션 ID는 **JSESSIONID**라는 이름의 세션 쿠키로 브라우저에 전달된다
- 이후 요청마다 브라우저가 JSESSIONID를 서버에 전송한다
- 서버는 JSESSIONID로 해당 사용자의 세션 객체를 찾아 사용한다

> 세션 자체는 서버에 저장되지만,
> 세션을 식별하는 수단으로 **쿠키(JSESSIONID)**를 사용한다.

---

## 7. 세션 API

### HttpSession 객체 생성

`HttpServletRequest`의 `getSession()` 메서드로 세션 객체를 얻는다.

| 메서드 | 세션 있을 때 | 세션 없을 때 |
|:-----|:-----|:-----|
| `getSession()` | 기존 반환 | 새로 생성 |
| `getSession(true)` | 기존 반환 | 새로 생성 |
| `getSession(false)` | 기존 반환 | null 반환 |

> `getSession(false)`는 세션 존재 여부만 확인할 때 유용하다.
> 불필요한 세션 생성을 방지할 수 있다.

### HttpSession 주요 메서드

| 반환 타입 | 메서드 | 기능 |
|:-----|:-----|:-----|
| `void` | `setAttribute(name, obj)` | 세션에 데이터 바인딩 |
| `Object` | `getAttribute(name)` | 바인딩된 데이터 조회 |
| `void` | `removeAttribute(name)` | 바인딩된 데이터 제거 |
| `String` | `getId()` | 세션 ID 반환 |
| `boolean` | `isNew()` | 새로 생성된 세션인지 판별 |
| `long` | `getCreationTime()` | 세션 생성 시각 (ms) |
| `int` | `getMaxInactiveInterval()` | 세션 유효 시간 반환 (초) |
| `void` | `setMaxInactiveInterval(int)` | 세션 유효 시간 설정 (초) |
| `void` | `invalidate()` | 세션 소멸 |

---

## 8. 세션을 이용한 로그인 예제

### 로그인 처리 서블릿

```java
@WebServlet("/login")
public class LoginServlet
    extends HttpServlet {

    protected void doPost(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        String userId =
            request.getParameter("userId");
        String userPw =
            request.getParameter("userPw");

        // DB 조회 (간략화)
        if ("hong".equals(userId)
            && "1234".equals(userPw)) {

            // 세션 생성 및 데이터 바인딩
            HttpSession session =
                request.getSession();
            session.setAttribute(
                "userId", userId);

            response.sendRedirect("main");
        } else {
            response.sendRedirect(
                "login?error=true");
        }
    }
}
```

### 로그인 상태 확인

```java
@WebServlet("/main")
public class MainServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        response.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out =
            response.getWriter();

        // 기존 세션 조회 (생성 안 함)
        HttpSession session =
            request.getSession(false);

        if (session != null
            && session.getAttribute(
                "userId") != null) {
            String userId = (String)
                session.getAttribute("userId");
            out.println(userId + "님 환영합니다.");
        } else {
            response.sendRedirect("login");
        }
    }
}
```

### 로그아웃 처리

```java
@WebServlet("/logout")
public class LogoutServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        HttpSession session =
            request.getSession(false);

        if (session != null) {
            // 세션 소멸
            session.invalidate();
        }

        response.sendRedirect("login");
    }
}
```

```
  로그인/로그아웃 흐름

  로그인 요청
  ──► 인증 확인
  ──► session.setAttribute("userId")
  ──► 메인 페이지 redirect

  메인 페이지
  ──► session.getAttribute("userId")
  ──► null이면 로그인 페이지로

  로그아웃 요청
  ──► session.invalidate()
  ──► 로그인 페이지 redirect
```

---

## 9. 세션 유효 시간 설정

세션은 마지막 접근 이후 **유효 시간이 지나면 자동 소멸**된다. 기본값은 30분이다.

### 설정 방법 3가지

**1. web.xml (애플리케이션 전체)**

```xml
<web-app>
    <session-config>
        <!-- 분 단위 -->
        <session-timeout>60</session-timeout>
    </session-config>
</web-app>
```

**2. 코드에서 개별 설정**

```java
HttpSession session =
    request.getSession();
// 초 단위: 1800초 = 30분
session.setMaxInactiveInterval(1800);
```

**3. setMaxAge와의 차이**

| 구분 | `Cookie.setMaxAge()` | `session.setMaxInactiveInterval()` |
|:-----|:-----|:-----|
| 대상 | 쿠키 | 세션 |
| 단위 | 초 | 초 |
| 설정 위치 | 클라이언트 | 서버 |

---

## 10. 세션과 바인딩 범위

06장에서 다룬 바인딩 객체 중 `HttpSession`은 **사용자별** 범위를 가진다.

```
  바인딩 객체별 범위 비교

┌──────────────────────┐
│  ServletContext       │
│  (앱 전체, 모든 사용자)│
│                      │
│ ┌──────────────────┐ │
│ │  HttpSession     │ │
│ │  (사용자 A 전용)  │ │
│ │                  │ │
│ │ ┌─────────────┐  │ │
│ │ │ Request     │  │ │
│ │ │ (요청 1건)  │  │ │
│ │ └─────────────┘  │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │  HttpSession     │ │
│ │  (사용자 B 전용)  │ │
│ └──────────────────┘ │
└──────────────────────┘
```

| 객체 | 범위 | 활용 예시 |
|:-----|:-----|:-----|
| `HttpServletRequest` | 요청 1건 | 폼 데이터, 포워드 전달 |
| `HttpSession` | 사용자별 | 로그인 정보, 장바구니 |
| `ServletContext` | 앱 전체 | 공지사항, 설정값 |

---

## 요약

### 세션 트래킹 방법 비교

| 방법 | 저장 위치 | 보안 | 용도 |
|:-----|:-----|:-----|:-----|
| hidden | HTML 폼 | 낮음 | 폼 데이터 전달 |
| URL Rewriting | URL | 낮음 | 간단한 값 전달 |
| 쿠키 | 클라이언트 | 보통 | 팝업 제한, 검색어 |
| 세션 | 서버 | 높음 | 로그인, 인증 |

### 쿠키 핵심

| 항목 | 설명 |
|:-----|:-----|
| 저장 위치 | 클라이언트 PC (파일 또는 메모리) |
| 생성 | `new Cookie(name, value)` |
| 전송 | `response.addCookie(cookie)` |
| 수신 | `request.getCookies()` |
| 삭제 | `setMaxAge(0)` 후 재전송 |
| 종류 | Persistence (파일), Session (메모리) |

### 세션 핵심

| 항목 | 설명 |
|:-----|:-----|
| 저장 위치 | 서버 메모리 |
| 식별 | JSESSIONID 쿠키 |
| 생성 | `request.getSession()` |
| 바인딩 | `session.setAttribute(name, obj)` |
| 소멸 | `session.invalidate()` |
| 기본 유효 시간 | 30분 |
