---
title: "23. 스프링에서 지원하는 여러 가지 기능"
weight: 23
---

스프링의 파일 업로드, 이메일 전송, 인터셉터(다국어 지원) 기능을 다룬다.

---

## 1. 다중 파일 업로드

스프링은 `CommonsMultipartResolver`를 통해 여러 개의 파일을 한꺼번에 업로드할 수 있다.

### 동작 흐름

```
  브라우저 (multipart 요청)
         │
         ▼
  ┌────────────────┐
  │ Multipart      │
  │ Resolver       │
  │ (파일 파싱)     │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ Controller     │
  │ (파일 처리)     │
  └───────┬────────┘
          │
          ▼
    서버 디스크 저장
```

### CommonsMultipartResolver 속성

| 속성 | 설명 |
|:-----|:-----|
| `maxUploadSize` | 업로드 가능한 최대 파일 크기(바이트) |
| `maxInMemorySize` | 디스크 임시 파일 생성 전 메모리 보관 최대 크기 |
| `defaultEncoding` | 매개변수 인코딩 설정 |

### 빈 설정

```xml
<bean id="multipartResolver"
    class="org.springframework.web.multipart
    .commons.CommonsMultipartResolver">
    <property name="maxUploadSize"
        value="52428800" />
    <property name="maxInMemorySize"
        value="1048576" />
    <property name="defaultEncoding"
        value="UTF-8" />
</bean>
```

### pom.xml 의존성 추가

파일 업로드 기능을 사용하려면 Apache Commons FileUpload 라이브러리가 필요하다.

```xml
<dependency>
    <groupId>commons-fileupload</groupId>
    <artifactId>commons-fileupload</artifactId>
    <version>1.3.3</version>
</dependency>
<dependency>
    <groupId>commons-io</groupId>
    <artifactId>commons-io</artifactId>
    <version>2.6</version>
</dependency>
```

### 컨트롤러 구현

```java
@RequestMapping("/upload")
public String upload(
    MultipartHttpServletRequest request)
    throws Exception {

    // 업로드된 파일 목록 가져오기
    Iterator<String> fileNames =
        request.getFileNames();

    while (fileNames.hasNext()) {
        String fileName = fileNames.next();
        MultipartFile mFile =
            request.getFile(fileName);

        String originalName =
            mFile.getOriginalFilename();

        // 파일 저장
        mFile.transferTo(
            new File(uploadPath + "/"
                + originalName));
    }
    return "uploadResult";
}
```

{{< callout type="warning" >}}
파일 업로드 시 **파일명 중복**과 **보안**에 주의하자. 사용자가 보낸 파일명을 그대로 저장하면 기존 파일을 덮어쓰거나 경로 조작 공격(Path Traversal)에 취약해진다. UUID 등으로 파일명을 재생성하는 것이 안전하다.
{{< /callout >}}

### 썸네일 라이브러리

pom.xml에 썸네일 라이브러리를 추가하면 업로드된 이미지의 썸네일을 자동으로 생성할 수 있다.

```xml
<dependency>
    <groupId>org.imgscalr</groupId>
    <artifactId>imgscalr-lib</artifactId>
    <version>4.2</version>
</dependency>
```

---

## 2. 스프링 이메일 기능

스프링은 `JavaMailSender` 인터페이스를 통해 이메일 전송 기능을 제공한다.

### 동작 흐름

```
  Controller
  (메일 요청)
       │
       ▼
  ┌────────────────┐
  │ JavaMailSender │
  │ (메일 생성)     │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ SMTP 서버      │
  │ (gmail 등)     │
  └───────┬────────┘
          │
          ▼
    수신자 메일함
```

### mail-context.xml 설정

구글 SMTP 서버와 연동하여 메일을 전송하는 설정이다.

```xml
<bean id="mailSender"
    class="org.springframework.mail
    .javamail.JavaMailSenderImpl">
    <property name="host"
        value="smtp.gmail.com" />
    <property name="port"
        value="465" />
    <property name="username"
        value="your@gmail.com" />
    <property name="password"
        value="앱 비밀번호" />
    <property name="javaMailProperties">
        <props>
            <prop key=
                "mail.transport.protocol">
                smtp</prop>
            <prop key=
                "mail.smtp.auth">
                true</prop>
            <prop key=
                "mail.smtp.starttls.enable">
                true</prop>
            <prop key=
                "mail.smtp.socketFactory.class">
                javax.net.ssl.SSLSocketFactory
            </prop>
        </props>
    </property>
</bean>
```

| 속성 | 설명 |
|:-----|:-----|
| `host` | SMTP 서버 주소 |
| `port` | SMTP 포트 (SSL: 465, TLS: 587) |
| `username` | 발신 메일 계정 |
| `password` | 계정 비밀번호 또는 앱 비밀번호 |
| `javaMailProperties` | 프로토콜, 인증, TLS 등 세부 설정 |

### pom.xml 의존성

```xml
<dependency>
    <groupId>javax.mail</groupId>
    <artifactId>mail</artifactId>
    <version>1.4.7</version>
</dependency>
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context-support</artifactId>
    <version>4.3.30.RELEASE</version>
</dependency>
```

### 메일 전송 서비스 구현

```java
@Service
public class MailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendMail(
        String to,
        String subject,
        String body) {

        SimpleMailMessage message =
            new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);

        mailSender.send(message);
    }
}
```

{{< callout type="info" >}}
Gmail SMTP를 사용할 때는 **앱 비밀번호**를 발급받아야 한다. 2단계 인증을 활성화한 후, Google 계정 설정에서 앱 비밀번호를 생성하여 사용한다.
{{< /callout >}}

### web.xml 다중 설정 파일 로딩

설정 파일이 여러 개인 경우 톰캣이 spring 폴더의 모든 설정 파일을 읽도록 지정한다.

```xml
<context-param>
    <param-name>
        contextConfigLocation
    </param-name>
    <param-value>
        /WEB-INF/spring/*.xml
    </param-value>
</context-param>
```

---

## 3. 스프링 인터셉터

인터셉터는 컨트롤러 메서드 호출 **전후**에 원하는 기능을 수행할 수 있는 스프링의 기능이다.

### 필터 vs 인터셉터

| 항목 | 필터(Filter) | 인터셉터(Interceptor) |
|:-----|:-----|:-----|
| 소속 | 서블릿 스펙 | 스프링 MVC |
| 적용 범위 | 웹 애플리케이션 전역 | URL 패턴별 세밀한 지정 |
| 실행 시점 | DispatcherServlet 이전 | DispatcherServlet 이후 |
| 스프링 빈 접근 | 불가 (별도 처리 필요) | 가능 |
| 주요 용도 | 인코딩, XSS 방지 | 인증, 권한, 로깅, 다국어 |

```
  브라우저 요청
       │
       ▼
  ┌────────────────┐
  │  Filter        │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  Dispatcher    │
  │  Servlet       │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  preHandle()   │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  Controller    │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  postHandle()  │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  View 렌더링    │
  └───────┬────────┘
          │
          ▼
  afterCompletion()
```

### HandlerInterceptor 메서드

| 메서드 | 호출 시점 | 설명 |
|:-----|:-----|:-----|
| `preHandle()` | 컨트롤러 실행 전 | `false` 반환 시 요청 중단 |
| `postHandle()` | 컨트롤러 실행 후 | 뷰로 전달 전에 모델 데이터 조작 가능 |
| `afterCompletion()` | 뷰 렌더링 완료 후 | 리소스 정리, 로깅 등 |

### 인터셉터 구현

`HandlerInterceptorAdapter`를 상속하거나 `HandlerInterceptor` 인터페이스를 구현한다.

```java
public class LoginInterceptor
    extends HandlerInterceptorAdapter {

    @Override
    public boolean preHandle(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler)
        throws Exception {

        HttpSession session =
            request.getSession();

        if (session.getAttribute("user")
            == null) {
            response.sendRedirect("/login");
            return false;  // 요청 중단
        }
        return true;  // 다음 단계로 진행
    }
}
```

### 인터셉터 등록 (XML)

```xml
<mvc:interceptors>
    <mvc:interceptor>
        <mvc:mapping path="/member/**" />
        <mvc:exclude-mapping
            path="/member/login" />
        <bean class=
            "com.example.LoginInterceptor" />
    </mvc:interceptor>
</mvc:interceptors>
```

{{< callout type="info" >}}
필터와 인터셉터가 동시에 적용되면 **필터가 먼저 실행**된 후 인터셉터가 실행된다. 서블릿 컨테이너 레벨의 필터가 먼저 동작하고, 스프링 MVC 레벨의 인터셉터가 그 다음에 동작하는 구조이다.
{{< /callout >}}

---

## 4. 인터셉터를 이용한 다국어 기능

스프링의 `LocaleChangeInterceptor`와 메시지 소스를 조합하면 다국어(i18n) 기능을 쉽게 구현할 수 있다.

### 다국어 동작 흐름

```
  브라우저 (?locale=en)
         │
         ▼
  ┌────────────────┐
  │ LocaleChange   │
  │ Interceptor    │
  │ (locale 감지)   │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ LocaleResolver │
  │ (세션에 저장)    │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ MessageSource  │
  │ (메시지 조회)   │
  └────────────────┘
```

### message-context.xml 설정

```xml
<!-- 세션에 locale 정보 저장 -->
<bean id="localeResolver"
    class="org.springframework.web.servlet
    .i18n.SessionLocaleResolver" />

<!-- 메시지 프로퍼티 파일 로딩 -->
<bean id="messageSource"
    class="org.springframework.context
    .support
    .ReloadableResourceBundleMessageSource">
    <property name="basename">
        <list>
            <value>
                classpath:locale/messages
            </value>
        </list>
    </property>
    <property name="defaultEncoding"
        value="UTF-8" />
    <property name="cacheSeconds"
        value="60" />
</bean>
```

| 속성 | 설명 |
|:-----|:-----|
| `basename` | 메시지 프로퍼티 파일 위치 |
| `defaultEncoding` | 파일 인코딩 |
| `cacheSeconds` | 파일 변경 감지 주기(초) |

### 메시지 프로퍼티 파일

`src/main/resources/locale/` 하위에 언어별 파일을 생성한다.

**messages_ko.properties**
```properties
greeting=안녕하세요
login.title=로그인
login.button=로그인하기
```

**messages_en.properties**
```properties
greeting=Hello
login.title=Login
login.button=Sign In
```

### 인터셉터 등록

```xml
<mvc:interceptors>
    <bean class=
        "org.springframework.web.servlet
        .i18n.LocaleChangeInterceptor">
        <property name="paramName"
            value="locale" />
    </bean>
</mvc:interceptors>
```

### JSP에서 메시지 사용

```jsp
<%@ taglib prefix="spring"
    uri="http://www.springframework.org
    /tags" %>

<h1>
    <spring:message code="greeting" />
</h1>

<a href="?locale=ko">한국어</a>
<a href="?locale=en">English</a>
```

{{< callout type="warning" >}}
`LocaleResolver` 빈의 이름은 반드시 `localeResolver`여야 한다. 스프링 MVC의 `DispatcherServlet`이 이 이름으로 빈을 자동 검색하기 때문이다. 다른 이름을 사용하면 다국어 기능이 동작하지 않는다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 파일 업로드 | `CommonsMultipartResolver`로 다중 파일 업로드 처리 |
| 이메일 | `JavaMailSender`와 SMTP 서버 연동으로 메일 전송 |
| 인터셉터 | 컨트롤러 전후에 공통 기능을 삽입하는 스프링 MVC 기능 |
| 필터 vs 인터셉터 | 필터는 서블릿 레벨, 인터셉터는 스프링 MVC 레벨 |
| 다국어(i18n) | `LocaleChangeInterceptor` + 메시지 프로퍼티 파일 |
