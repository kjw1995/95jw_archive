---
title: "03. 서블릿 이해하기"
weight: 3
---

## 1. 서블릿이란?

> 서버에서 실행되며 클라이언트 요청에
> **동적으로 응답**하는 자바 클래스

### 서블릿의 동작 흐름

```
클라이언트 (브라우저)
      │
      │ HTTP 요청
      ▼
┌──────────────┐
│   웹 서버     │
│  (Apache)    │
└──────┬───────┘
       │ 위임
       ▼
┌──────────────┐
│     WAS      │
│   (Tomcat)   │
│  ┌────────┐  │
│  │ Servlet │  │
│  └────────┘  │
└──────┬───────┘
       │ 응답
       ▼
클라이언트 (브라우저)
```

### 서블릿의 특징

| 특징 | 설명 |
|------|------|
| 서버 측 실행 | WAS에서 동작 |
| 동적 처리 | 요청마다 다른 결과 |
| 자바 기반 | 객체지향, 플랫폼 독립 |
| 스레드 방식 | 요청마다 스레드 생성 |
| 컨테이너 필요 | Tomcat 등에서 실행 |

### 일반 자바 vs 서블릿

| 구분 | 일반 자바 | 서블릿 |
|------|----------|--------|
| 실행 | 독자 실행 가능 | 컨테이너 필요 |
| 진입점 | `main()` | `service()` |
| 용도 | 다양함 | 웹 요청 처리 |

---

## 2. 서블릿 API 구조

### 계층 구조

```
<<interface>>
   Servlet
      │
      ├── init()
      ├── service()
      ├── destroy()
      └── getServletConfig()
         │
         ▼
<<interface>>
 ServletConfig
      │
      ├── getInitParameter()
      └── getServletContext()
         │
         ▼
<<abstract>>
 GenericServlet
      │
      │  (일반 프로토콜용)
      │
      ▼
  HttpServlet
      │
      │  (HTTP 프로토콜용)
      │
      ├── doGet()
      ├── doPost()
      ├── doPut()
      └── doDelete()
```

### 주요 인터페이스/클래스

**Servlet 인터페이스**
- 패키지: `javax.servlet`
- 모든 서블릿의 최상위
- 생명주기 메서드 정의

**ServletConfig 인터페이스**
- 패키지: `javax.servlet`
- 서블릿 설정 정보 제공

**GenericServlet 클래스**
- 패키지: `javax.servlet`
- 프로토콜 독립적 서블릿
- 추상 클래스

**HttpServlet 클래스**
- 패키지: `javax.servlet.http`
- HTTP 전용 서블릿
- 실제 개발에서 주로 상속

---

## 3. HttpServlet 메서드

### HTTP 메서드별 처리

| 메서드 | HTTP | 용도 |
|--------|------|------|
| `doGet()` | GET | 조회 |
| `doPost()` | POST | 등록 |
| `doPut()` | PUT | 수정 |
| `doDelete()` | DELETE | 삭제 |
| `doHead()` | HEAD | 헤더만 조회 |

### 메서드 시그니처

```java
protected void doGet(
    HttpServletRequest req,
    HttpServletResponse resp
) throws ServletException, IOException
```

### service() 메서드 흐름

```
클라이언트 요청
      │
      ▼
public service()
      │
      ▼
protected service()
      │
      ├── GET  → doGet()
      ├── POST → doPost()
      ├── PUT  → doPut()
      └── DELETE → doDelete()
```

---

## 4. 서블릿 생명주기

### 생명주기 단계

```
[최초 요청]
     │
     ▼
┌─────────┐
│  init() │ ← 한 번만 실행
└────┬────┘
     │
     ▼
┌──────────────┐
│   service()  │
│  ┌────────┐  │
│  │doGet() │  │ ← 요청마다 실행
│  │doPost()│  │
│  └────────┘  │
└──────┬───────┘
       │
       ▼ (서버 종료/재배포)
┌───────────┐
│ destroy() │ ← 한 번만 실행
└───────────┘
```

### 생명주기 메서드 정리

| 메서드 | 호출 시점 | 횟수 |
|--------|----------|:----:|
| `init()` | 최초 요청 | 1번 |
| `doGet/doPost` | 매 요청 | N번 |
| `destroy()` | 서블릿 종료 | 1번 |

### 각 메서드의 역할

**init()**
```java
@Override
public void init() {
    // DB 연결 초기화
    // 설정 파일 로드
    // 리소스 준비
}
```

**doGet() / doPost()**
```java
@Override
protected void doGet(
    HttpServletRequest req,
    HttpServletResponse resp) {
    // 요청 파라미터 처리
    // 비즈니스 로직 실행
    // 응답 생성
}
```

**destroy()**
```java
@Override
public void destroy() {
    // DB 연결 해제
    // 리소스 정리
    // 로그 기록
}
```

---

## 5. 서블릿 동작 과정

### 최초 요청 시

```
1. 클라이언트 요청
       │
       ▼
2. 톰캣: 서블릿 메모리 확인
       │
       │ (없음)
       ▼
3. 서블릿 클래스 로드
       │
       ▼
4. init() 호출
       │
       ▼
5. 인스턴스 생성 (메모리 로드)
       │
       ▼
6. doGet()/doPost() 호출
       │
       ▼
7. 응답 전송
```

### 이후 요청 시

```
1. 클라이언트 요청
       │
       ▼
2. 톰캣: 서블릿 메모리 확인
       │
       │ (있음!)
       ▼
3. doGet()/doPost() 호출
       │
       ▼
4. 응답 전송
```

### 효율성

- 최초 1회만 인스턴스 생성
- 이후 요청은 재사용
- **싱글톤 패턴**과 유사

---

## 6. 서블릿 매핑

### web.xml 방식 (전통적)

```xml
<!-- 서블릿 등록 -->
<servlet>
    <servlet-name>hello</servlet-name>
    <servlet-class>
        com.example.HelloServlet
    </servlet-class>
</servlet>

<!-- URL 매핑 -->
<servlet-mapping>
    <servlet-name>hello</servlet-name>
    <url-pattern>/hello</url-pattern>
</servlet-mapping>
```

### 애너테이션 방식 (권장)

```java
@WebServlet("/hello")
public class HelloServlet
    extends HttpServlet {

    @Override
    protected void doGet(
        HttpServletRequest req,
        HttpServletResponse resp) {
        // 처리 로직
    }
}
```

### @WebServlet 속성

| 속성 | 설명 |
|------|------|
| `value` | URL 패턴 |
| `urlPatterns` | 여러 URL 패턴 |
| `name` | 서블릿 이름 |
| `loadOnStartup` | 시작 시 로드 순서 |

### URL 패턴 예시

```java
// 단일 경로
@WebServlet("/hello")

// 여러 경로
@WebServlet(urlPatterns = {
    "/hello",
    "/hi"
})

// 와일드카드
@WebServlet("/api/*")

// 확장자 매핑
@WebServlet("*.do")
```

---

## 7. 서블릿 예제

### 기본 구조

```java
package com.example;

import java.io.*;
import javax.servlet.*;
import javax.servlet.http.*;
import javax.servlet.annotation.*;

@WebServlet("/hello")
public class HelloServlet
    extends HttpServlet {

    @Override
    public void init() {
        System.out.println("서블릿 초기화");
    }

    @Override
    protected void doGet(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws IOException {

        resp.setContentType(
            "text/html;charset=UTF-8");

        PrintWriter out = resp.getWriter();
        out.println("<html>");
        out.println("<body>");
        out.println("<h1>Hello Servlet!</h1>");
        out.println("</body>");
        out.println("</html>");
    }

    @Override
    public void destroy() {
        System.out.println("서블릿 종료");
    }
}
```

### 파라미터 처리

```java
@WebServlet("/login")
public class LoginServlet
    extends HttpServlet {

    @Override
    protected void doPost(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws IOException {

        // 한글 처리
        req.setCharacterEncoding("UTF-8");

        // 파라미터 받기
        String id = req.getParameter("id");
        String pw = req.getParameter("pw");

        // 응답
        resp.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();
        out.println("ID: " + id);
    }
}
```

---

## 8. Request & Response

### HttpServletRequest 주요 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `getParameter()` | String | 단일 값 |
| `getParameterValues()` | String[] | 다중 값 |
| `getAttribute()` | Object | 속성 값 |
| `getSession()` | HttpSession | 세션 |
| `getMethod()` | String | HTTP 메서드 |
| `getRequestURI()` | String | 요청 URI |

### HttpServletResponse 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `setContentType()` | MIME 타입 설정 |
| `getWriter()` | 문자 출력 스트림 |
| `getOutputStream()` | 바이트 출력 스트림 |
| `sendRedirect()` | 리다이렉트 |
| `setStatus()` | 상태 코드 설정 |

---

## 요약

### 서블릿 핵심

| 항목 | 내용 |
|------|------|
| 정의 | 동적 웹 처리 자바 클래스 |
| 상속 | `HttpServlet` |
| 실행 | WAS (Tomcat 등) |
| 매핑 | `@WebServlet` |

### 생명주기

```
init()     → 초기화 (1회)
     ↓
doXxx()    → 요청 처리 (매번)
     ↓
destroy()  → 종료 (1회)
```

### 필수 코드 패턴

```java
@WebServlet("/path")
public class MyServlet
    extends HttpServlet {

    @Override
    protected void doGet(
        HttpServletRequest req,
        HttpServletResponse resp)
        throws IOException {

        // 응답 타입 설정
        resp.setContentType(
            "text/html;charset=UTF-8");

        // 출력
        PrintWriter out = resp.getWriter();
        out.println("응답 내용");
    }
}
```
