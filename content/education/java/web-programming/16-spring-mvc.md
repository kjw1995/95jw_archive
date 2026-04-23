---
title: "16. 스프링 MVC 기능"
weight: 17
---

스프링 프레임워크 MVC의 구성 요소와 요청 처리 흐름을 다룬다.

---

## 1. 스프링 MVC의 특징

스프링 프레임워크에서 지원하는 MVC 기능의 주요 특징은 다음과 같다.

| 특징 | 설명 |
|:-----|:-----|
| 모델2 아키텍처 | 요청 처리·비즈니스 로직·화면을 분리 |
| 모듈 연계 용이 | 스프링의 DI, AOP 등 다른 모듈과 자연스럽게 통합 |
| 태그 라이브러리 | 메시지 출력, 테마 적용, 입력 폼 구현을 간편하게 지원 |

---

## 2. MVC 구성 요소

| 구성 요소 | 역할 |
|:-----|:-----|
| `DispatcherServlet` | 모든 요청을 받아 적절한 컨트롤러에 전달하고, 결과를 View에 전달 |
| `HandlerMapping` | 요청 URL에 매핑되는 컨트롤러를 찾아 반환 |
| `Controller` | 요청을 처리하고 결과를 `ModelAndView`로 반환 |
| `ModelAndView` | 처리 결과 데이터와 View 이름을 함께 저장 |
| `ViewResolver` | View 이름을 실제 View 객체(JSP 등)로 변환 |
| `View` | 최종 화면을 생성하여 클라이언트에 응답 |

```
  스프링 MVC 구성 요소 관계

  ┌─────────────────┐
  │DispatcherServlet│
  └──┬──┬──┬──┬─────┘
     │  │  │  │
     │  │  │  └→ View
     │  │  └→ ViewResolver
     │  └→ Controller
     └→ HandlerMapping
```

---

## 3. MVC 요청 처리 흐름

```
  ① 브라우저 요청
        │
        ▼
  ┌─────────────────┐
  │DispatcherServlet│
  └───────┬─────────┘
          │ ② 컨트롤러 조회
          ▼
  ┌─────────────────┐
  │ HandlerMapping  │
  └───────┬─────────┘
          │ ③ 처리 위임
          ▼
  ┌─────────────────┐
  │   Controller    │
  │ (비즈니스 로직)  │
  └───────┬─────────┘
          │ ④ ModelAndView
          ▼
  ┌─────────────────┐
  │DispatcherServlet│
  └───────┬─────────┘
          │ ⑤ View 이름 전달
          ▼
  ┌─────────────────┐
  │  ViewResolver   │
  └───────┬─────────┘
          │ ⑥ View 반환
          ▼
  ┌─────────────────┐
  │      View       │
  │ (JSP 등 화면)    │
  └───────┬─────────┘
          │ ⑦ 응답 생성
          ▼
  ┌─────────────────┐
  │DispatcherServlet│
  └───────┬─────────┘
          │ ⑧ 최종 응답
          ▼
      브라우저
```

### 단계별 설명

| 단계 | 동작 |
|:-----|:-----|
| ① | 브라우저가 URL로 `DispatcherServlet`에 요청 |
| ② | `HandlerMapping`에서 매핑된 컨트롤러 조회 |
| ③ | 매핑된 `Controller`에 처리 위임 |
| ④ | `Controller`가 결과와 View 이름을 `ModelAndView`에 담아 반환 |
| ⑤ | `DispatcherServlet`이 View 이름을 `ViewResolver`에 전달 |
| ⑥ | `ViewResolver`가 해당 `View` 객체를 반환 |
| ⑦ | `View`가 화면을 생성하여 `DispatcherServlet`에 전달 |
| ⑧ | `DispatcherServlet`이 최종 응답을 브라우저에 전송 |

{{< callout type="info" >}}
`DispatcherServlet`은 **프론트 컨트롤러(Front Controller)** 패턴의 구현체다. 모든 요청이 하나의 진입점을 거치므로 공통 처리(인코딩, 로깅, 인증 등)를 한 곳에서 관리할 수 있다.
{{< /callout >}}

---

## 4. 간단한 스프링 MVC 예제

### web.xml — DispatcherServlet 등록

```xml
<web-app ...>
    <servlet>
        <servlet-name>dispatcher</servlet-name>
        <servlet-class>
            org.springframework.web
            .servlet.DispatcherServlet
        </servlet-class>
        <load-on-startup>1</load-on-startup>
    </servlet>

    <servlet-mapping>
        <servlet-name>dispatcher</servlet-name>
        <url-pattern>*.do</url-pattern>
    </servlet-mapping>
</web-app>
```

### dispatcher-servlet.xml — 빈 설정

```xml
<beans ...>
    <!-- HandlerMapping -->
    <bean id="handlerMapping"
      class="org.springframework.web.servlet
             .handler.BeanNameUrlHandlerMapping"/>

    <!-- Controller -->
    <bean name="/hello.do"
        class="com.spring.HelloController" />

    <!-- ViewResolver -->
    <bean id="viewResolver"
      class="org.springframework.web.servlet
             .view.InternalResourceViewResolver">
        <property name="prefix"
            value="/WEB-INF/views/" />
        <property name="suffix"
            value=".jsp" />
    </bean>
</beans>
```

### Controller 작성

```java
public class HelloController
    extends AbstractController {

    @Override
    protected ModelAndView handleRequestInternal(
            HttpServletRequest request,
            HttpServletResponse response)
            throws Exception {

        ModelAndView mav = new ModelAndView();

        // View 이름 설정
        mav.setViewName("hello");

        // 모델 데이터 추가
        mav.addObject("message", "스프링 MVC!");

        return mav;
    }
}
```

### hello.jsp — View

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <h1>${message}</h1>
</body>
</html>
```

### 요청 흐름 추적

```
  /hello.do 요청 시

  DispatcherServlet
       │
       ▼
  BeanNameUrlHandler
  Mapping
  → "/hello.do" 매핑
       │
       ▼
  HelloController
  → ModelAndView
    viewName: "hello"
    model: {message: ...}
       │
       ▼
  InternalResource
  ViewResolver
  → /WEB-INF/views/
    hello.jsp
       │
       ▼
  hello.jsp 렌더링
  → 브라우저 응답
```

{{< callout type="warning" >}}
`DispatcherServlet`의 설정 파일 이름은 기본적으로 `{servlet-name}-servlet.xml`이다. 위 예제에서 servlet-name이 `dispatcher`이므로 `dispatcher-servlet.xml`을 자동으로 찾는다. 이름이 다르면 `contextConfigLocation` 파라미터로 명시해야 한다.
{{< /callout >}}

---

## 5. ViewResolver의 prefix/suffix 동작

`InternalResourceViewResolver`는 Controller가 반환한 View 이름에 **prefix**와 **suffix**를 붙여 실제 JSP 경로를 만든다.

| 설정 | 값 |
|:-----|:-----|
| prefix | `/WEB-INF/views/` |
| suffix | `.jsp` |
| View 이름 | `hello` |
| **실제 경로** | `/WEB-INF/views/hello.jsp` |

```
  ViewResolver 경로 조합

  prefix    + viewName + suffix
  /WEB-INF/   hello      .jsp
  views/

  → /WEB-INF/views/hello.jsp
```

{{< callout type="info" >}}
JSP를 `/WEB-INF/` 아래에 두면 브라우저에서 직접 접근할 수 없다. 반드시 Controller를 거쳐야만 화면이 보이므로 보안상 권장되는 구조다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| `DispatcherServlet` | 모든 요청의 진입점 (프론트 컨트롤러) |
| `HandlerMapping` | URL → Controller 매핑 |
| `Controller` | 비즈니스 로직 처리, `ModelAndView` 반환 |
| `ModelAndView` | 처리 결과 + View 이름 저장 |
| `ViewResolver` | View 이름 → 실제 JSP 경로 변환 |
| `View` | 최종 화면 생성 |

### 모델2 vs 스프링 MVC 비교

| 구분 | 모델2 | 스프링 MVC |
|:-----|:-----|:-----|
| 프론트 컨트롤러 | 직접 서블릿 작성 | `DispatcherServlet` 제공 |
| URL 매핑 | web.xml에 직접 설정 | `HandlerMapping`이 자동 처리 |
| 뷰 연결 | `RequestDispatcher`로 직접 포워드 | `ViewResolver`가 자동 처리 |
| 데이터 전달 | `request.setAttribute()` | `ModelAndView.addObject()` |
