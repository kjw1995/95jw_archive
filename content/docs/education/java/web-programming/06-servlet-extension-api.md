---
title: "06. 서블릿 확장 API 사용하기"
weight: 7
---

서블릿 간 요청 전달(포워드), 데이터 공유(바인딩), 그리고 컨텍스트/설정 객체의 활용법을 다룬다.

---

## 1. 포워드 (Forward)

### 포워드의 개념

하나의 서블릿에서 다른 서블릿이나 JSP와 연동하는 방법을 **포워드(forward)**라 한다.

**포워드의 용도**
- 요청에 대한 추가 작업을 다른 서블릿에게 위임
- 요청(request)에 포함된 정보를 다른 서블릿이나 JSP와 공유
- 요청에 정보를 추가하여 다른 서블릿에 전달
- Model2 개발 시 서블릿에서 JSP로 데이터 전달

### 4가지 포워드 방법

| 방법 | 사용 객체/기술 | 특징 |
|:-----|:-----|:-----|
| redirect | `HttpServletResponse.sendRedirect()` | 브라우저를 거쳐 재요청 |
| refresh | `HttpServletResponse.addHeader()` | 브라우저를 거쳐 재요청 |
| location | JavaScript `location.href` | 브라우저에서 재요청 |
| dispatch | `RequestDispatcher.forward()` | 서버에서 직접 전달 |

```
  redirect / refresh / location

  클라이언트 ──①요청──► 서블릿A
  클라이언트 ◄─②응답──  서블릿A
  클라이언트 ──③재요청─► 서블릿B
  (URL 변경됨)

  dispatch

  클라이언트 ──①요청──► 서블릿A
                       │②서버 내부
                       ▼
                     서블릿B
  클라이언트 ◄─③응답──  서블릿B
  (URL 변경 안 됨)
```

> redirect, refresh, location은 **클라이언트를 거치는** 방식이고,
> dispatch는 **서버 내부에서 직접** 전달하는 방식이다.

---

## 2. redirect 포워딩

### 수행 과정

1. 웹 브라우저에서 첫 번째 서블릿에 요청
2. 첫 번째 서블릿이 `sendRedirect()`로 두 번째 서블릿 URL을 응답
3. 웹 브라우저가 두 번째 서블릿을 다시 요청

### 기본 사용

```java
@WebServlet("/first")
public class FirstServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        response.sendRedirect("second");
    }
}
```

### 데이터 전달

redirect 방식에서는 **GET 방식의 쿼리 스트링**으로 데이터를 전달한다.

```java
// 첫 번째 서블릿 - 데이터 전달
response.sendRedirect(
    "second?name=lee&age=25");

// 두 번째 서블릿 - 데이터 수신
String name =
    request.getParameter("name");
String age =
    request.getParameter("age");
```

**redirect의 특징**

| 항목 | 설명 |
|:-----|:-----|
| URL 변경 | 브라우저 주소창이 변경됨 |
| 요청 횟수 | 총 2회 (새로운 request 객체 생성) |
| 데이터 전달 | 쿼리 스트링만 가능 (URL에 노출) |
| 바인딩 | 불가 (request 객체가 다름) |

---

## 3. refresh 포워딩

redirect와 동일하게 브라우저를 거쳐 재요청한다. `addHeader()` 메서드로 응답 헤더에 이동할 URL을 지정한다.

```java
// 1초 후 second 서블릿으로 이동
response.addHeader(
    "Refresh", "1;url=second");
```

> redirect와 동작이 유사하지만
> **지연 시간(초)**을 지정할 수 있다는 차이가 있다.

---

## 4. dispatch 포워딩

### redirect와의 핵심 차이

| 구분 | redirect | dispatch |
|:-----|:-----|:-----|
| 경유 | 클라이언트를 거침 | 서버 내부에서 직접 |
| URL 변경 | 변경됨 | 변경 안 됨 |
| request 객체 | 새로 생성 | 동일 객체 공유 |
| 바인딩 데이터 | 전달 불가 | 전달 가능 |
| 요청 횟수 | 2회 | 1회 |

### 사용 방법

`RequestDispatcher` 객체를 얻어 `forward()` 메서드를 호출한다.

```java
@WebServlet("/first")
public class FirstServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        // 바인딩 - request에 데이터 저장
        request.setAttribute(
            "name", "홍길동");

        // dispatch - 서버 내부에서 전달
        RequestDispatcher dp =
            request.getRequestDispatcher(
                "second");
        dp.forward(request, response);
    }
}
```

```java
@WebServlet("/second")
public class SecondServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        // 바인딩된 데이터 수신
        String name = (String)
            request.getAttribute("name");

        response.setContentType(
            "text/html;charset=UTF-8");
        PrintWriter out =
            response.getWriter();
        out.println("이름: " + name);
    }
}
```

> dispatch 방식은 **동일한 request 객체**를 공유하므로
> 바인딩을 통한 대량 데이터 전달이 가능하다.
> Model2 패턴에서 서블릿 → JSP 데이터 전달에 주로 사용된다.

---

## 5. 바인딩 (Binding)

### 바인딩의 개념

서블릿에서 다른 서블릿 또는 JSP로 대량의 데이터를 공유하거나 전달할 때 사용하는 기능이다. 자원(데이터)을 서블릿 관련 객체에 **이름-값 쌍**으로 저장한다.

### 바인딩 메서드

| 메서드 | 기능 |
|:-----|:-----|
| `setAttribute(name, obj)` | 데이터를 객체에 바인딩 |
| `getAttribute(name)` | 바인딩된 데이터를 조회 |
| `removeAttribute(name)` | 바인딩된 데이터를 제거 |

### 바인딩이 가능한 객체

| 객체 | 유효 범위 | 생명주기 |
|:-----|:-----|:-----|
| `HttpServletRequest` | 한 번의 요청 | 요청 ~ 응답 |
| `HttpSession` | 한 사용자의 세션 | 세션 생성 ~ 만료 |
| `ServletContext` | 웹 애플리케이션 전체 | 서버 시작 ~ 종료 |

```
  바인딩 유효 범위

┌─────────────────────┐
│   ServletContext     │
│   (애플리케이션 전체) │
│                     │
│  ┌───────────────┐  │
│  │  HttpSession  │  │
│  │  (사용자별)    │  │
│  │              │  │
│  │ ┌──────────┐ │  │
│  │ │ Request  │ │  │
│  │ │ (요청별) │ │  │
│  │ └──────────┘ │  │
│  └───────────────┘  │
└─────────────────────┘
    좁음 ───────► 넓음
```

### redirect에서 바인딩이 안 되는 이유

```
  redirect 방식

  요청1: request(A) 생성
  서블릿A: request(A)에 바인딩
  응답 → 브라우저 → 재요청
  요청2: request(B) 생성 ← 새 객체
  서블릿B: request(B)에서 조회
  → null (바인딩 데이터 없음)

  dispatch 방식

  요청1: request(A) 생성
  서블릿A: request(A)에 바인딩
  서버 내부 전달
  서블릿B: request(A)에서 조회
  → 데이터 정상 수신
```

### 바인딩 사용 예제 - 객체 리스트 전달

```java
// 서블릿A - 리스트 바인딩 후 포워드
List<MemberVO> members =
    dao.selectAll();

request.setAttribute(
    "memberList", members);

RequestDispatcher dp =
    request.getRequestDispatcher(
        "/memberList.jsp");
dp.forward(request, response);
```

```java
// memberList.jsp - 바인딩 데이터 수신
List<MemberVO> list =
    (List<MemberVO>)
    request.getAttribute("memberList");

for (MemberVO vo : list) {
    out.println(vo.getName());
}
```

---

## 6. ServletContext

### 개념

톰캣 컨테이너 실행 시 **각 웹 애플리케이션(컨텍스트)마다 하나** 생성되는 객체다. 애플리케이션 전체에서 공유할 자원이나 정보를 바인딩하는 데 사용한다.

**특징**
- 서블릿과 컨테이너 간의 연동에 사용
- 컨텍스트(웹 애플리케이션)마다 하나만 생성
- 서블릿끼리 자원(데이터)을 공유하는 데 사용
- 컨테이너 실행 시 생성, 종료 시 소멸

```
┌─────────────────────┐
│    톰캣 컨테이너      │
│                     │
│ ┌─────────────────┐ │
│ │  웹앱A          │ │
│ │ ServletContext  │ │ ← 1개
│ │ ┌────┐ ┌────┐  │ │
│ │ │ S1 │ │ S2 │  │ │ ← 공유
│ │ └────┘ └────┘  │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │  웹앱B          │ │
│ │ ServletContext  │ │ ← 별도 1개
│ │ ┌────┐ ┌────┐  │ │
│ │ │ S3 │ │ S4 │  │ │
│ │ └────┘ └────┘  │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### 제공 기능

| 기능 | 설명 |
|:-----|:-----|
| 파일 접근 | 서블릿에서 파일에 접근 |
| 자원 바인딩 | 애플리케이션 전역 데이터 공유 |
| 로그 기록 | 로그 파일에 메시지 기록 |
| 초기화 파라미터 | 컨텍스트 설정 정보 제공 |

### 주요 메서드

| 메서드 | 기능 |
|:-----|:-----|
| `getAttribute(name)` | 바인딩된 값 조회 |
| `setAttribute(name, obj)` | 값 바인딩 |
| `removeAttribute(name)` | 바인딩 제거 |
| `getInitParameter(name)` | 초기화 파라미터 값 조회 |
| `getServerInfo()` | 컨테이너 이름과 버전 반환 |
| `log(msg)` | 로그 파일에 기록 |

### 초기화 파라미터 설정 (web.xml)

```xml
<web-app>
    <context-param>
        <param-name>adminEmail</param-name>
        <param-value>admin@test.com</param-value>
    </context-param>
</web-app>
```

```java
// 서블릿에서 조회
ServletContext ctx =
    getServletContext();
String email =
    ctx.getInitParameter("adminEmail");
// → admin@test.com
```

> `context-param`은 애플리케이션 전체에서 공유되는 파라미터다.
> 모든 서블릿에서 동일한 값을 조회할 수 있다.

### ServletContext 바인딩 예제

```java
// 서블릿A - 데이터 바인딩
ServletContext ctx =
    getServletContext();
List<String> notices =
    Arrays.asList("공지1", "공지2");
ctx.setAttribute("notices", notices);

// 서블릿B - 데이터 조회 (다른 서블릿)
ServletContext ctx =
    getServletContext();
List<String> notices =
    (List<String>)
    ctx.getAttribute("notices");
```

---

## 7. ServletConfig

### 개념

**각 서블릿마다 하나씩** 생성되는 객체다. 해당 서블릿에서만 접근할 수 있으며, 다른 서블릿과 공유가 불가능하다.

### ServletContext vs ServletConfig

| 구분 | ServletContext | ServletConfig |
|:-----|:-----|:-----|
| 생성 단위 | 웹 애플리케이션당 1개 | 서블릿당 1개 |
| 공유 범위 | 모든 서블릿 | 해당 서블릿만 |
| 생명주기 | 컨테이너 시작 ~ 종료 | 서블릿 생성 ~ 소멸 |
| 설정 위치 | `<context-param>` | `<init-param>` 또는 `@WebInitParam` |

```
┌─────────────────────┐
│  웹 애플리케이션      │
│                     │
│  ServletContext (1개)│ ← 전체 공유
│                     │
│  ┌───────────────┐  │
│  │ 서블릿A       │  │
│  │ Config(A) (1개)│ │ ← A만 사용
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ 서블릿B       │  │
│  │ Config(B) (1개)│ │ ← B만 사용
│  └───────────────┘  │
└─────────────────────┘
```

### 제공 기능

| 기능 | 설명 |
|:-----|:-----|
| ServletContext 객체 획득 | `getServletContext()` |
| 서블릿 초기화 파라미터 | 서블릿별 설정값 조회 |

---

## 8. @WebServlet 애너테이션

### 주요 구성 요소

| 요소 | 설명 |
|:-----|:-----|
| `urlPatterns` | 서블릿 매핑 URL 지정 |
| `name` | 서블릿 이름 |
| `loadOnStartup` | 컨테이너 시작 시 로드 순서 |
| `initParams` | `@WebInitParam`으로 초기화 파라미터 설정 |
| `description` | 서블릿 설명 |

### @WebInitParam으로 초기화 파라미터 설정

```java
@WebServlet(
    urlPatterns = "/init-test",
    initParams = {
        @WebInitParam(
            name = "email",
            value = "admin@test.com"),
        @WebInitParam(
            name = "tel",
            value = "010-1234-5678")
    }
)
public class InitParamServlet
    extends HttpServlet {

    protected void doGet(
        HttpServletRequest request,
        HttpServletResponse response)
        throws ServletException, IOException {

        // ServletConfig로 조회
        String email =
            getInitParameter("email");
        String tel =
            getInitParameter("tel");
    }
}
```

### web.xml로 초기화 파라미터 설정

```xml
<servlet>
    <servlet-name>initServlet</servlet-name>
    <servlet-class>
        com.example.InitParamServlet
    </servlet-class>
    <init-param>
        <param-name>email</param-name>
        <param-value>admin@test.com</param-value>
    </init-param>
</servlet>
```

---

## 9. load-on-startup

### 개념

서블릿은 기본적으로 **최초 요청 시** `init()` 메서드를 실행한 후 메모리에 로드된다. 따라서 첫 번째 요청은 실행 시간이 길어진다. load-on-startup은 이 단점을 보완하여 **톰캣 시작 시 미리** 서블릿을 초기화한다.

```
  기본 동작 (load-on-startup 없음)

  톰캣 시작 → 서블릿 로드 안 됨
  첫 요청 ──► init() 실행 (느림)
  이후 요청 ──► 바로 service() (빠름)

  load-on-startup 적용

  톰캣 시작 → init() 미리 실행
  첫 요청 ──► 바로 service() (빠름)
  이후 요청 ──► 바로 service() (빠름)
```

### 특징

- 톰캣 컨테이너 실행 시 미리 서블릿을 초기화
- 지정한 숫자가 **0보다 크면** 톰캣 시작 시 초기화
- 숫자는 **우선순위**를 의미하며, 작은 숫자가 먼저 초기화

### 설정 방법

**애너테이션 방식**

```java
@WebServlet(
    name = "loadConfig",
    urlPatterns = "/config",
    loadOnStartup = 1
)
public class ConfigServlet
    extends HttpServlet {

    @Override
    public void init()
        throws ServletException {
        // 톰캣 시작 시 실행됨
        System.out.println(
            "설정 서블릿 초기화 완료");
    }
}
```

**web.xml 방식**

```xml
<servlet>
    <servlet-name>loadConfig</servlet-name>
    <servlet-class>
        com.example.ConfigServlet
    </servlet-class>
    <load-on-startup>1</load-on-startup>
</servlet>
```

### 우선순위 예시

```
  톰캣 시작 시 초기화 순서

  loadOnStartup = 1  → ① 먼저
  loadOnStartup = 2  → ② 다음
  loadOnStartup = 3  → ③ 마지막
  loadOnStartup 없음 → 요청 시 초기화
```

> 데이터베이스 연결 초기화, 설정 파일 로드 등
> 시간이 걸리는 작업을 미리 처리할 때 유용하다.

---

## 요약

### 포워드 방법 비교

| 방법 | 경유 | URL 변경 | 바인딩 전달 |
|:-----|:-----|:-----|:-----|
| redirect | 클라이언트 | O | X |
| refresh | 클라이언트 | O | X |
| location | 클라이언트 | O | X |
| dispatch | 서버 내부 | X | O |

### 바인딩 객체 범위

```
ServletContext  : 앱 전체 공유
HttpSession    : 사용자별 공유
HttpServletReq : 요청 한 건 공유
```

### 핵심 개념

| 항목 | 설명 |
|:-----|:-----|
| 포워드 | 서블릿 간 요청 전달 방법 |
| dispatch | 서버 내부에서 직접 포워딩, 바인딩 전달 가능 |
| 바인딩 | 객체에 이름-값 쌍으로 데이터를 저장/공유 |
| ServletContext | 웹앱당 1개, 전체 서블릿 공유 |
| ServletConfig | 서블릿당 1개, 해당 서블릿만 사용 |
| load-on-startup | 톰캣 시작 시 서블릿 미리 초기화 |
