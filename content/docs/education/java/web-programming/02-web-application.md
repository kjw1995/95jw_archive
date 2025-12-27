---
title: "웹 애플리케이션 이해하기"
description: "웹 애플리케이션의 정의, 구조, 톰캣 컨테이너에서의 실행 방법을 상세히 알아본다"
summary: "웹 애플리케이션 디렉터리 구조, WEB-INF, 컨텍스트, server.xml 설정"
date: 2025-01-06
weight: 2
draft: false
toc: true
---

## 웹 애플리케이션이란?

### 정의

웹 애플리케이션이란 기존의 **정적인 웹**의 기능을 그대로 사용하면서 **서블릿(Servlet)**, **JSP**, **자바 클래스**들을 추가하여 사용자에게 **동적인 서비스**를 제공하는 서버 프로그램이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      웹 애플리케이션                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │    정적 웹 요소      │    │        동적 웹 요소             │ │
│  │  - HTML             │ +  │  - Servlet (자바 CGI)          │ │
│  │  - CSS              │    │  - JSP                         │ │
│  │  - JavaScript       │    │  - Java Class                  │ │
│  │  - 이미지           │    │                                 │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    웹 컨테이너에서 실행
                    (Tomcat, Jetty 등)
```

### 정적 웹 vs 동적 웹

| 구분 | 정적 웹 | 동적 웹 (웹 애플리케이션) |
|------|---------|-------------------------|
| **콘텐츠** | 고정된 HTML 파일 | 요청에 따라 변하는 콘텐츠 |
| **처리 위치** | 클라이언트 (브라우저) | 서버 (웹 컨테이너) |
| **기술** | HTML, CSS, JS | Servlet, JSP, Java |
| **예시** | 회사 소개 페이지 | 로그인, 게시판, 쇼핑몰 |
| **데이터 처리** | 불가능 | DB 연동 가능 |

### 웹 애플리케이션의 장점

```java
// 동적 웹의 예: 사용자별로 다른 응답
@WebServlet("/greeting")
public class GreetingServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request,
                        HttpServletResponse response) throws IOException {

        String userName = request.getParameter("name");
        String currentTime = new SimpleDateFormat("HH:mm:ss").format(new Date());

        response.setContentType("text/html;charset=UTF-8");
        PrintWriter out = response.getWriter();

        out.println("<html><body>");
        out.println("<h1>안녕하세요, " + userName + "님!</h1>");
        out.println("<p>현재 시간: " + currentTime + "</p>");
        out.println("</body></html>");
    }
}
```

---

## 웹 애플리케이션의 기본 구조

### 필수 디렉터리 구조

웹 컨테이너에서 실행되는 모든 웹 애플리케이션은 **정해진 디렉터리 구조**를 따라야 한다.

```
myWebApp/                          ← 웹 애플리케이션 루트 디렉터리
│
├── index.html                     ← 정적 파일 (HTML, JSP)
├── login.jsp
├── style.css
│
└── WEB-INF/                       ← 핵심 디렉터리 (외부 접근 불가!)
    │
    ├── web.xml                    ← 배치 지시자 (Deployment Descriptor)
    │
    ├── classes/                   ← 컴파일된 자바 클래스
    │   └── com/
    │       └── example/
    │           └── MyServlet.class
    │
    └── lib/                       ← JAR 라이브러리
        ├── mysql-connector.jar
        └── commons-io.jar
```

> **중요**: 이 구조를 따르지 않으면 컨테이너에서 웹 애플리케이션 실행 시 오류가 발생한다!

### 구성 요소별 상세 설명

#### 1. 루트 디렉터리

```
webShop/                    ← 웹 애플리케이션 이름 (고유해야 함)
├── index.jsp               ← 직접 접근 가능
├── product.jsp
└── images/
    └── logo.png
```

- 웹 애플리케이션의 최상위 폴더
- **이름이 중복되면 안 됨**
- HTML, JSP, 이미지 등 **클라이언트가 직접 접근**할 수 있는 파일 저장

#### 2. WEB-INF 디렉터리

```
WEB-INF/                    ← 외부에서 접근 불가능!
├── web.xml
├── classes/
└── lib/
```

**WEB-INF의 특징**:
- **보안 디렉터리**: 브라우저에서 직접 접근 불가
- 서블릿, 설정 파일 등 **서버 측 리소스** 저장
- `http://localhost:8080/myApp/WEB-INF/web.xml` → **403 Forbidden**

```java
// WEB-INF 내부의 JSP는 forward로만 접근 가능
@WebServlet("/secure")
public class SecureServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request,
                        HttpServletResponse response)
            throws ServletException, IOException {

        // WEB-INF 내부의 JSP로 forward
        RequestDispatcher dispatcher =
            request.getRequestDispatcher("/WEB-INF/views/secure.jsp");
        dispatcher.forward(request, response);
    }
}
```

#### 3. classes 디렉터리

```
WEB-INF/classes/
└── com/
    └── example/
        ├── servlet/
        │   ├── LoginServlet.class
        │   └── LogoutServlet.class
        ├── service/
        │   └── UserService.class
        └── dao/
            └── UserDAO.class
```

- 컴파일된 **서블릿**과 **자바 클래스** 저장
- **패키지 구조**를 그대로 반영
- 클래스 로더가 자동으로 로드

#### 4. lib 디렉터리

```
WEB-INF/lib/
├── mysql-connector-java-8.0.27.jar    ← DB 드라이버
├── gson-2.9.0.jar                     ← JSON 라이브러리
├── log4j-core-2.17.0.jar              ← 로깅 라이브러리
└── commons-fileupload-1.4.jar         ← 파일 업로드
```

- **JAR 파일** 저장
- **클래스패스 자동 설정** (별도 설정 불필요)
- 프레임워크, DB 드라이버, 유틸리티 라이브러리 등

#### 5. web.xml (배치 지시자)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
                             http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">

    <!-- 애플리케이션 기본 정보 -->
    <display-name>My Web Application</display-name>
    <description>웹 애플리케이션 예제</description>

    <!-- 시작 페이지 설정 -->
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
        <welcome-file>index.jsp</welcome-file>
    </welcome-file-list>

    <!-- 서블릿 등록 -->
    <servlet>
        <servlet-name>LoginServlet</servlet-name>
        <servlet-class>com.example.servlet.LoginServlet</servlet-class>
    </servlet>

    <!-- 서블릿 URL 매핑 -->
    <servlet-mapping>
        <servlet-name>LoginServlet</servlet-name>
        <url-pattern>/login</url-pattern>
    </servlet-mapping>

    <!-- 필터 설정 -->
    <filter>
        <filter-name>EncodingFilter</filter-name>
        <filter-class>com.example.filter.EncodingFilter</filter-class>
        <init-param>
            <param-name>encoding</param-name>
            <param-value>UTF-8</param-value>
        </init-param>
    </filter>

    <filter-mapping>
        <filter-name>EncodingFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- 에러 페이지 설정 -->
    <error-page>
        <error-code>404</error-code>
        <location>/error/404.jsp</location>
    </error-page>

    <error-page>
        <error-code>500</error-code>
        <location>/error/500.jsp</location>
    </error-page>

    <!-- 세션 타임아웃 설정 (분 단위) -->
    <session-config>
        <session-timeout>30</session-timeout>
    </session-config>

</web-app>
```

> **Servlet 3.0+**: 애노테이션을 사용하면 web.xml 없이도 서블릿 등록 가능

```java
// 애노테이션 기반 서블릿 등록 (web.xml 불필요)
@WebServlet(
    name = "LoginServlet",
    urlPatterns = {"/login", "/signin"},
    loadOnStartup = 1
)
public class LoginServlet extends HttpServlet {
    // ...
}
```

### 추가 디렉터리 (선택)

실무에서는 기본 구조 외에 추가 디렉터리를 만들어 사용한다.

```
myWebApp/
├── WEB-INF/
│   ├── classes/
│   ├── lib/
│   ├── web.xml
│   └── views/              ← JSP 파일 (보안)
│       ├── user/
│       └── admin/
│
├── css/                    ← 스타일시트
│   ├── common.css
│   └── main.css
│
├── js/                     ← 자바스크립트
│   ├── jquery.min.js
│   └── app.js
│
├── images/                 ← 이미지 파일
│   ├── logo.png
│   └── icons/
│
├── fonts/                  ← 웹 폰트
│
└── upload/                 ← 업로드 파일 저장
```

| 디렉터리 | 용도 |
|---------|------|
| `css/` | CSS 스타일시트 파일 |
| `js/` | JavaScript 파일 |
| `images/` | 이미지 파일 |
| `fonts/` | 웹 폰트 파일 |
| `upload/` | 사용자 업로드 파일 |
| `WEB-INF/views/` | 보안이 필요한 JSP (forward로만 접근) |

---

## 컨테이너에서 웹 애플리케이션 실행하기

### 웹 컨테이너란?

웹 컨테이너(Web Container)는 **서블릿과 JSP를 실행하고 관리**하는 환경이다.

```
┌──────────────────────────────────────────────────────────────────┐
│                         웹 서버 (Apache)                          │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    웹 컨테이너 (Tomcat)                      │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │  웹 앱 A    │  │  웹 앱 B    │  │  웹 앱 C    │        │  │
│  │  │ (컨텍스트)  │  │ (컨텍스트)  │  │ (컨텍스트)  │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  │                                                             │  │
│  │  서블릿 라이프사이클 관리, 요청/응답 처리, 세션 관리         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 톰캣에 웹 애플리케이션 등록 방법

#### 방법 1: webapps 폴더에 복사 (자동 배포)

```
CATALINA_HOME/              ← 톰캣 설치 디렉터리
├── bin/
├── conf/
├── lib/
├── logs/
├── temp/
├── webapps/                ← 여기에 웹 애플리케이션 복사
│   ├── ROOT/
│   ├── manager/
│   ├── myWebApp/           ← 복사한 웹 애플리케이션
│   │   ├── WEB-INF/
│   │   └── ...
│   └── myWebApp.war        ← 또는 WAR 파일 복사
└── work/
```

**절차**:
1. 웹 애플리케이션 폴더를 `webapps/`에 복사
2. 톰캣 재시작
3. 자동으로 인식하고 실행

**WAR 파일 배포**:
```bash
# WAR 파일 생성
cd myWebApp
jar -cvf myWebApp.war *

# webapps에 복사
cp myWebApp.war $CATALINA_HOME/webapps/

# 톰캣이 자동으로 압축 해제 후 배포
```

#### 방법 2: server.xml에 직접 등록 (수동 배포)

개발 시에는 임의의 위치에 웹 애플리케이션을 두고 `server.xml`에 등록하는 방식이 편리하다.

```xml
<!-- CATALINA_HOME/conf/server.xml -->
<Server port="8005" shutdown="SHUTDOWN">

    <Service name="Catalina">

        <Connector port="8080" protocol="HTTP/1.1" />

        <Engine name="Catalina" defaultHost="localhost">

            <Host name="localhost" appBase="webapps"
                  unpackWARs="true" autoDeploy="true">

                <!-- 여기에 컨텍스트 추가 -->
                <Context path="/myapp"
                         docBase="D:/projects/myWebApp"
                         reloadable="true" />

                <Context path="/shop"
                         docBase="D:/workspace/webShop"
                         reloadable="true" />

            </Host>
        </Engine>
    </Service>
</Server>
```

---

## 컨텍스트(Context)

### 컨텍스트란?

**컨텍스트(Context)**는 톰캣이 인식하는 **하나의 웹 애플리케이션 단위**이다.

```
┌──────────────────────────────────────────────────────────────────┐
│                      톰캣 컨테이너                                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  컨텍스트 /shop      컨텍스트 /board     컨텍스트 /admin     │ │
│  │      │                   │                   │               │ │
│  │      ▼                   ▼                   ▼               │ │
│  │  webShop 앱          boardApp 앱        adminApp 앱         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  각 컨텍스트는 독립적으로 동작하며 서로 격리됨                    │
└──────────────────────────────────────────────────────────────────┘
```

### 컨텍스트의 주요 특징

| 특징 | 설명 |
|------|------|
| **1:1 매핑** | 웹 애플리케이션당 하나의 컨텍스트 |
| **이름 유연성** | 웹 애플리케이션 폴더명과 다를 수 있음 |
| **고유성** | 컨텍스트 이름은 중복 불가 |
| **대소문자 구분** | `/MyApp`과 `/myapp`은 다름 |
| **등록 위치** | server.xml에 등록 |

### Context 태그 속성

```xml
<Context path="/myapp"
         docBase="D:/projects/myWebApp"
         reloadable="true"
         crossContext="false"
         privileged="false" />
```

| 속성 | 설명 | 예시 |
|------|------|------|
| `path` | URL에서 사용할 컨텍스트 경로 | `/myapp` |
| `docBase` | 실제 웹 애플리케이션 위치 (WEB-INF 상위 폴더) | `D:/projects/myWebApp` |
| `reloadable` | 소스 변경 시 자동 재로드 | `true` (개발), `false` (운영) |
| `crossContext` | 다른 컨텍스트 접근 허용 | 기본값: `false` |
| `privileged` | 톰캣 내부 서블릿 접근 허용 | 기본값: `false` |

### 컨텍스트 등록 예제

**프로젝트 구조**:
```
D:/workspace/
├── webShop/
│   ├── index.jsp
│   └── WEB-INF/
│       ├── web.xml
│       ├── classes/
│       └── lib/
│
└── boardApp/
    ├── main.jsp
    └── WEB-INF/
        └── ...
```

**server.xml 설정**:
```xml
<Host name="localhost" appBase="webapps">

    <!-- 쇼핑몰 애플리케이션 -->
    <Context path="/shop"
             docBase="D:/workspace/webShop"
             reloadable="true">
        <!-- 추가 설정 가능 -->
        <Resource name="jdbc/mydb"
                  auth="Container"
                  type="javax.sql.DataSource"
                  driverClassName="com.mysql.cj.jdbc.Driver"
                  url="jdbc:mysql://localhost:3306/shopdb"
                  username="root"
                  password="1234" />
    </Context>

    <!-- 게시판 애플리케이션 -->
    <Context path="/board"
             docBase="D:/workspace/boardApp"
             reloadable="true" />

</Host>
```

---

## 웹 브라우저에서 요청하기

### URL 구조

```
http://localhost:8080/shop/product/list.jsp?category=electronics&page=1
└─┬─┘ └────┬────┘└─┬─┘└─┬─┘└───────┬──────┘└──────────────┬─────────────┘
프로토콜   호스트   포트 컨텍스트   리소스 경로          쿼리 스트링
```

| 구성 요소 | 설명 | 예시 |
|----------|------|------|
| **프로토콜** | 통신 방식 | `http`, `https` |
| **호스트** | 서버 주소 | `localhost`, `192.168.0.1`, `www.example.com` |
| **포트** | 서비스 포트 (기본 80 생략 가능) | `8080`, `80` |
| **컨텍스트** | 웹 애플리케이션 식별자 | `/shop`, `/board` |
| **리소스 경로** | 요청 파일/서블릿 경로 | `/product/list.jsp` |
| **쿼리 스트링** | 요청 파라미터 | `?category=electronics&page=1` |

### 요청 예시

```
# 기본 페이지 요청
http://localhost:8080/shop/

# JSP 페이지 요청
http://localhost:8080/shop/product/list.jsp

# 서블릿 요청
http://localhost:8080/shop/login

# 정적 리소스 요청
http://localhost:8080/shop/images/logo.png
http://localhost:8080/shop/css/style.css
```

---

## 배포(Deploy)

### 배포란?

**배포(Deploy)**란 개발이 완료된 웹 애플리케이션을 **실제 서비스 환경에 설치하고 실행**하는 것이다.

```
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   개발 환경      │   빌드    │    WAR 파일     │   배포    │   운영 서버     │
│  (IDE/로컬)     │ ───────▶ │  (myapp.war)   │ ───────▶ │   (Tomcat)     │
└─────────────────┘          └─────────────────┘          └─────────────────┘
```

### WAR 파일이란?

**WAR (Web Application Archive)**: 웹 애플리케이션을 **하나의 파일로 압축**한 것

```bash
# WAR 파일 생성 (Maven)
mvn clean package

# WAR 파일 생성 (Gradle)
./gradlew war

# WAR 파일 생성 (수동)
cd myWebApp
jar -cvf myWebApp.war *
```

**WAR 파일 구조**:
```
myWebApp.war
├── index.jsp
├── META-INF/
│   └── MANIFEST.MF
└── WEB-INF/
    ├── web.xml
    ├── classes/
    └── lib/
```

### 배포 방법 비교

| 방법 | 장점 | 단점 | 용도 |
|------|------|------|------|
| **폴더 복사** | 간단함 | 대용량 시 느림 | 개발/테스트 |
| **WAR 배포** | 하나의 파일로 관리 | 압축/해제 시간 | 운영 환경 |
| **server.xml 등록** | 위치 자유로움 | 톰캣 설정 변경 필요 | 개발 환경 |
| **톰캣 매니저** | 웹 UI로 배포 | 보안 설정 필요 | 원격 배포 |

### 톰캣 매니저를 통한 배포

```xml
<!-- conf/tomcat-users.xml -->
<tomcat-users>
    <role rolename="manager-gui"/>
    <role rolename="manager-script"/>
    <user username="admin"
          password="admin123"
          roles="manager-gui,manager-script"/>
</tomcat-users>
```

```
http://localhost:8080/manager/html 에서 WAR 파일 업로드 가능
```

---

## 실습: 간단한 웹 애플리케이션 만들기

### 1. 디렉터리 구조 생성

```bash
mkdir -p myFirstApp/WEB-INF/classes
mkdir -p myFirstApp/WEB-INF/lib
mkdir -p myFirstApp/css
mkdir -p myFirstApp/js
```

### 2. web.xml 작성

```xml
<!-- myFirstApp/WEB-INF/web.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         version="4.0">

    <display-name>My First Web Application</display-name>

    <welcome-file-list>
        <welcome-file>index.jsp</welcome-file>
    </welcome-file-list>

</web-app>
```

### 3. index.jsp 작성

```jsp
<!-- myFirstApp/index.jsp -->
<%@ page language="java" contentType="text/html; charset=UTF-8"
         pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>My First Web App</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h1>환영합니다!</h1>
    <p>현재 시간: <%= new java.util.Date() %></p>

    <form action="hello" method="get">
        <label>이름: <input type="text" name="name"></label>
        <button type="submit">인사하기</button>
    </form>
</body>
</html>
```

### 4. 서블릿 작성

```java
// HelloServlet.java
package com.example;

import java.io.*;
import javax.servlet.*;
import javax.servlet.http.*;
import javax.servlet.annotation.*;

@WebServlet("/hello")
public class HelloServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request,
                        HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");

        String name = request.getParameter("name");
        if (name == null || name.isEmpty()) {
            name = "손님";
        }

        PrintWriter out = response.getWriter();
        out.println("<!DOCTYPE html>");
        out.println("<html><head>");
        out.println("<meta charset='UTF-8'>");
        out.println("<title>인사</title>");
        out.println("</head><body>");
        out.println("<h1>안녕하세요, " + name + "님!</h1>");
        out.println("<a href='index.jsp'>돌아가기</a>");
        out.println("</body></html>");
    }
}
```

### 5. 컴파일 및 배포

```bash
# 서블릿 컴파일
javac -cp $CATALINA_HOME/lib/servlet-api.jar \
      -d myFirstApp/WEB-INF/classes \
      HelloServlet.java

# 톰캣에 배포 (방법 1: 복사)
cp -r myFirstApp $CATALINA_HOME/webapps/

# 또는 server.xml에 등록 (방법 2)
```

### 6. 접속 테스트

```
http://localhost:8080/myFirstApp/
http://localhost:8080/myFirstApp/hello?name=홍길동
```

---

## 정리

### 웹 애플리케이션 핵심 개념

| 개념 | 설명 |
|------|------|
| **웹 애플리케이션** | 정적 웹 + 동적 요소 (Servlet, JSP) |
| **WEB-INF** | 보안 디렉터리 (외부 접근 불가) |
| **web.xml** | 배치 지시자 (설정 파일) |
| **컨텍스트** | 톰캣이 인식하는 웹 앱 단위 |
| **배포** | 웹 앱을 서버에 설치하고 실행 |

### 필수 디렉터리 구조

```
웹앱이름/
├── (정적 파일들)
└── WEB-INF/           ← 필수!
    ├── web.xml        ← 필수 (Servlet 3.0+ 선택)
    ├── classes/       ← 필수
    └── lib/           ← 필수
```

### 배포 방법

1. **webapps 폴더에 복사** → 자동 배포
2. **server.xml에 Context 등록** → 수동 배포
3. **WAR 파일 배포** → 운영 환경 권장

---

## 참고 자료

- [Apache Tomcat Documentation](https://tomcat.apache.org/tomcat-9.0-doc/)
- [Java Servlet Specification](https://jakarta.ee/specifications/servlet/)
- 자바 웹을 다루는 기술 (이병승)
