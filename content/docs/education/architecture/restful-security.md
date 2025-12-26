---
title: "보안과 추적성"
weight: 3
---

## REST API 보안 아키텍처

REST API에서 보안과 추적성은 필수 요소이다. 분산 환경에서 문제를 추적하고, 민감한 데이터를 보호하며, 적절한 인증/인가를 구현해야 한다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST API 보안 레이어                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                         Server                         │
│  ┌──────────┐                  ┌───────────────────────────┐   │
│  │ Request  │                  │ ┌─────────────────────┐   │   │
│  │          │ ───────────────► │ │   Authentication    │   │   │
│  │ + Token  │                  │ │   (인증: 누구인가?)   │   │   │
│  │ + Data   │                  │ └──────────┬──────────┘   │   │
│  │          │                  │            ▼              │   │
│  │          │                  │ ┌─────────────────────┐   │   │
│  │          │                  │ │   Authorization     │   │   │
│  │          │                  │ │   (인가: 권한 확인)   │   │   │
│  │          │                  │ └──────────┬──────────┘   │   │
│  │          │                  │            ▼              │   │
│  │          │                  │ ┌─────────────────────┐   │   │
│  │          │                  │ │   Validation        │   │   │
│  │          │                  │ │   (검증: 데이터 확인) │   │   │
│  │          │                  │ └──────────┬──────────┘   │   │
│  │          │                  │            ▼              │   │
│  │          │                  │ ┌─────────────────────┐   │   │
│  │          │                  │ │   Logging           │   │   │
│  │          │                  │ │   (로깅: 기록/추적)   │   │   │
│  │          │                  │ └─────────────────────┘   │   │
│  └──────────┘                  └───────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## REST API 로깅

### 로깅의 중요성

분산 애플리케이션에서 로깅은 문제 추적과 디버깅의 핵심이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      로깅의 역할                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐      ┌───────────────┐      ┌─────────────┐ │
│  │ 마이크로서비스 │      │ 마이크로서비스 │      │ 마이크로서비스│ │
│  │      A        │      │      B        │      │      C      │ │
│  └───────┬───────┘      └───────┬───────┘      └──────┬──────┘ │
│          │                      │                     │        │
│          ▼                      ▼                     ▼        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    중앙 로그 서버                         │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ 트랜잭션 추적 | 이벤트 연결 | 패턴 분석 | 장애 대응 │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 목적 | 설명 |
|------|------|
| **디버깅** | 마이크로서비스 환경에서 문제 발생 지점 추적 |
| **트랜잭션 추적** | 여러 컴포넌트 간 이벤트 연결 |
| **패턴 분석** | 요청 패턴 분석, 색인(index), 취합(aggregate), 분할(slice) |
| **장애 재연** | 운영 시스템에서 발생한 이벤트 시퀀스 재현 |

### 로깅 필터 구현

#### Servlet Filter 기반 (Java EE)

```java
@WebFilter(filterName = "LoggingFilter", urlPatterns = {"/*"})
public class LoggingFilter implements Filter {

    private static final Logger logger = Logger.getLogger(LoggingFilter.class);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        long startTime = System.currentTimeMillis();

        // 요청 정보 로깅
        logger.info("Request: {} {} from {}",
            httpRequest.getMethod(),
            httpRequest.getRequestURI(),
            httpRequest.getRemoteAddr());

        chain.doFilter(request, response);

        // 응답 시간 로깅
        long duration = System.currentTimeMillis() - startTime;
        logger.info("Response time: {}ms", duration);
    }
}
```

#### Spring Boot Interceptor 기반

```java
@Component
public class LoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(LoggingInterceptor.class);

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {

        String requestId = UUID.randomUUID().toString().substring(0, 8);
        request.setAttribute("requestId", requestId);
        request.setAttribute("startTime", System.currentTimeMillis());

        log.info("[{}] {} {} - Start",
            requestId,
            request.getMethod(),
            request.getRequestURI());

        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler, Exception ex) {

        String requestId = (String) request.getAttribute("requestId");
        long startTime = (Long) request.getAttribute("startTime");
        long duration = System.currentTimeMillis() - startTime;

        log.info("[{}] {} {} - {} ({}ms)",
            requestId,
            request.getMethod(),
            request.getRequestURI(),
            response.getStatus(),
            duration);
    }
}
```

```java
// Interceptor 등록
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private LoggingInterceptor loggingInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loggingInterceptor)
                .addPathPatterns("/api/**");
    }
}
```

---

## 로깅 베스트 프랙티스

### 필수 로깅 정보

| 항목 | 설명 | 예시 |
|------|------|------|
| **타임스탬프** | 현재 날짜/시각 | `2024-01-15T14:30:00.123Z` |
| **로깅 레벨** | INFO, WARN, ERROR 등 | `INFO` |
| **스레드명** | 실행 스레드 식별 | `http-nio-8080-exec-1` |
| **로거명** | 클래스명 또는 모듈명 | `c.e.a.LoggingFilter` |
| **요청 ID** | 요청 추적용 고유 ID | `abc12345` |
| **상세 메시지** | 실제 로그 내용 | `GET /api/users - 200 OK` |

### 로그 포맷 예시

```
# Logback 설정 (logback-spring.xml)
<pattern>
    %d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36}
    - [%X{requestId}] %msg%n
</pattern>

# 출력 예시
2024-01-15 14:30:00.123 [http-nio-8080-exec-1] INFO  c.e.api.LoggingFilter
- [abc12345] GET /api/users/123 - 200 OK (45ms)
```

### 민감 데이터 마스킹

```
┌─────────────────────────────────────────────────────────────────┐
│                   민감 데이터 처리 규칙                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   개인식별정보(PII)              마스킹 기법                     │
│  ┌─────────────────┐          ┌─────────────────────────────┐  │
│  │ 패스워드        │   →      │ ******** (완전 숨김)         │  │
│  │ 신용카드 번호   │   →      │ ****-****-****-1234 (부분)   │  │
│  │ 주민등록번호   │   →      │ 900101-******* (부분)        │  │
│  │ 이메일         │   →      │ j***@example.com (부분)      │  │
│  └─────────────────┘          └─────────────────────────────┘  │
│                                                                 │
│   처리 기법: 치환(substitution) | 셔플링(shuffling)             │
│             암호화(encryption) | 토큰화(tokenization)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```java
// 민감 데이터 마스킹 유틸리티
public class MaskingUtil {

    public static String maskCreditCard(String cardNumber) {
        if (cardNumber == null || cardNumber.length() < 4) return "****";
        return "****-****-****-" + cardNumber.substring(cardNumber.length() - 4);
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        int atIndex = email.indexOf("@");
        return email.charAt(0) + "***" + email.substring(atIndex);
    }

    public static String maskPassword(String password) {
        return "********";
    }
}
```

### 로깅 권장/비권장 사항

```
┌─────────────────────────────────────────────────────────────────┐
│                    로깅 DO's and DON'Ts                         │
├────────────────────────────────┬────────────────────────────────┤
│            DO                  │           DON'T                │
├────────────────────────────────┼────────────────────────────────┤
│ ✅ 최초 호출자(initiator) 기록 │ ❌ 페이로드 전체 로깅          │
│ ✅ 요청 메타정보 기록          │ ❌ 민감 데이터 평문 로깅        │
│ ✅ 실행 소요 시간 기록         │ ❌ 스택 트레이스 전체 노출      │
│ ✅ 에러 코드와 메시지 기록     │ ❌ 내부 시스템 경로 노출        │
│ ✅ 모니터링 시스템 연계        │ ❌ 과도한 DEBUG 레벨 로깅       │
└────────────────────────────────┴────────────────────────────────┘
```

> **SLA (Service Level Agreement)**: IT 서비스 수준 계약. 로그를 모니터링 시스템과 연계하면 SLA 지표를 자동으로 수집하여 서비스 품질을 측정할 수 있다.

---

## RESTful 서비스 검증

API를 공개하기 전, 데이터 형식과 비즈니스 규칙을 검증해야 한다.

### 검증 항목

| 검증 대상 | 설명 | 예시 |
|-----------|------|------|
| **형식 검증** | 데이터 포맷 준수 여부 | 이메일, 전화번호, 우편번호 |
| **필수값 검증** | 필수 필드 존재 여부 | `name`, `email` 필드 |
| **범위 검증** | 값의 허용 범위 | 나이 0~150, 가격 > 0 |
| **비즈니스 규칙** | 도메인 특화 규칙 | 중복 이메일 불가 |

### Bean Validation (JSR-380) 활용

```java
public class UserCreateRequest {

    @NotBlank(message = "이름은 필수입니다")
    @Size(min = 2, max = 50, message = "이름은 2~50자 사이여야 합니다")
    private String name;

    @NotBlank(message = "이메일은 필수입니다")
    @Email(message = "올바른 이메일 형식이 아닙니다")
    private String email;

    @NotNull(message = "나이는 필수입니다")
    @Min(value = 0, message = "나이는 0 이상이어야 합니다")
    @Max(value = 150, message = "나이는 150 이하여야 합니다")
    private Integer age;

    @Pattern(regexp = "^\\d{5}$", message = "우편번호는 5자리 숫자입니다")
    private String zipCode;
}
```

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @PostMapping
    public ResponseEntity<User> createUser(
            @Valid @RequestBody UserCreateRequest request,
            BindingResult result) {

        if (result.hasErrors()) {
            throw new ValidationException(result.getAllErrors());
        }

        User user = userService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
}
```

### 검증 에러 응답

```json
// 400 Bad Request
{
    "status": 400,
    "error": "Validation Failed",
    "timestamp": "2024-01-15T14:30:00Z",
    "errors": [
        {
            "field": "email",
            "message": "올바른 이메일 형식이 아닙니다",
            "rejectedValue": "invalid-email"
        },
        {
            "field": "age",
            "message": "나이는 0 이상이어야 합니다",
            "rejectedValue": -5
        }
    ]
}
```

---

## 인증과 인가

### 개념 구분

```
┌─────────────────────────────────────────────────────────────────┐
│                   인증 vs 인가                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Authentication (인증)              Authorization (인가)        │
│  ┌──────────────────────┐          ┌──────────────────────┐    │
│  │                      │          │                      │    │
│  │   "당신은 누구인가?"   │          │  "당신은 무엇을 할    │    │
│  │                      │          │   수 있는가?"         │    │
│  │   Who are you?       │          │   What can you do?   │    │
│  │                      │          │                      │    │
│  │   신원 확인           │          │   권한 확인           │    │
│  │                      │          │                      │    │
│  └──────────────────────┘          └──────────────────────┘    │
│          │                                  │                   │
│          ▼                                  ▼                   │
│   로그인, 토큰 발급                   리소스 접근 허용/거부        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 구분 | 인증 (Authentication) | 인가 (Authorization) |
|------|----------------------|---------------------|
| **질문** | 누구인가? | 무엇을 할 수 있는가? |
| **확인** | 신원 (Identity) | 권한 (Permission) |
| **시점** | 먼저 수행 | 인증 후 수행 |
| **실패 코드** | 401 Unauthorized | 403 Forbidden |

---

## SSO와 SAML

### SSO (Single Sign-On)

하나의 인증으로 여러 애플리케이션에 접근하는 기술

```
┌─────────────────────────────────────────────────────────────────┐
│                        SSO 개념                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────────┐                          │
│                    │   ID 저장소     │                          │
│                    │ (유저네임/패스워드)│                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                      한 번 로그인                                │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   App A     │     │   App B     │     │   App C     │       │
│  │ (이메일)     │     │ (업무시스템) │     │ (ERP)       │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│         모든 애플리케이션에 자동 로그인                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SAML (Security Assertion Markup Language)

SSO 구현을 위한 표준 명세

```
┌─────────────────────────────────────────────────────────────────┐
│                      SAML 구성 요소                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Principal            Identity Provider      Service Provider  │
│   (프린시펄)            (ID 제공자, IdP)        (서비스 제공자, SP)│
│  ┌──────────┐         ┌──────────────┐       ┌──────────────┐  │
│  │          │         │              │       │              │  │
│  │  유저    │         │  ID 확인     │       │  서비스 제공  │  │
│  │  자신    │         │  (인증 담당)  │       │  (IdP 이용)   │  │
│  │          │         │              │       │              │  │
│  └──────────┘         └──────────────┘       └──────────────┘  │
│                                                                 │
│   예시: 직원           예시: Okta, Azure AD   예시: 회사 업무 앱  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SAML 인증 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAML 인증 과정                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User         Service Provider (SP)      Identity Provider (IdP)│
│    │                   │                          │             │
│    │─── 1. 접근 요청 ──►│                          │             │
│    │                   │                          │             │
│    │◄── 2. SAML 요청 ──│                          │             │
│    │    (IdP로 리다이렉트)                         │             │
│    │                   │                          │             │
│    │───────────── 3. 인증 요청 ─────────────────►│             │
│    │                   │                          │             │
│    │◄──────────── 4. 로그인 화면 ────────────────│             │
│    │                   │                          │             │
│    │───────────── 5. 크리덴셜 제출 ──────────────►│             │
│    │                   │                          │             │
│    │◄──────────── 6. SAML 응답 (Assertion) ─────│             │
│    │                   │                          │             │
│    │─── 7. SAML 응답 ──►│                          │             │
│    │       전달         │                          │             │
│    │                   │                          │             │
│    │◄─ 8. 서비스 접근 ──│                          │             │
│    │    허용 (토큰 발급) │                          │             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## OAuth 2.0

### OAuth란?

유저가 자신의 크리덴셜(아이디/비밀번호)을 직접 입력하지 않고, 제3자 애플리케이션이 자신의 데이터에 접근하도록 허락하는 인가 프레임워크

```
┌─────────────────────────────────────────────────────────────────┐
│                     OAuth 2.0 역할                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Resource Owner          Client              Resource Server    │
│  (리소스 오너)            (클라이언트)         (리소스 서버)        │
│  ┌──────────────┐      ┌──────────────┐    ┌──────────────┐    │
│  │              │      │              │    │              │    │
│  │   실제 유저   │      │  제3자 앱    │    │  데이터 보유  │    │
│  │ (데이터 소유) │      │ (대신 접근)   │    │  서버        │    │
│  │              │      │              │    │              │    │
│  └──────────────┘      └──────────────┘    └──────────────┘    │
│                                                                 │
│                    Authorization Server                         │
│                    (인가 서버)                                   │
│                   ┌──────────────┐                              │
│                   │ 토큰 발급     │                              │
│                   │ 인증 처리     │                              │
│                   └──────────────┘                              │
│                                                                 │
│  예시: 사용자가 사진 인화 앱(Client)에게 Google Photos(Resource    │
│        Server)의 자기 사진 접근을 허락                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### OAuth 2.0 Authorization Code Flow

가장 많이 사용되는 OAuth 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│              Authorization Code Grant Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User        Client        Auth Server      Resource Server    │
│    │            │                │                  │           │
│    │── 1. 서비스 요청 ──►│                │                  │           │
│    │            │                │                  │           │
│    │◄─ 2. 인가서버 리다이렉트 ─│                │                  │           │
│    │            │                │                  │           │
│    │────────── 3. 로그인 + 권한 승인 ──────────►│                  │           │
│    │            │                │                  │           │
│    │◄───────── 4. Authorization Code ──────────│                  │           │
│    │            │                │                  │           │
│    │── 5. Auth Code 전달 ──►│                │                  │           │
│    │            │                │                  │           │
│    │            │── 6. Code + Client Secret ──►│                  │           │
│    │            │                │                  │           │
│    │            │◄── 7. Access Token + Refresh Token ──│                  │           │
│    │            │                │                  │           │
│    │            │────────────── 8. API 요청 (Bearer Token) ───────────►│           │
│    │            │                │                  │           │
│    │            │◄───────────── 9. 리소스 응답 ────────────────│           │
│    │            │                │                  │           │
│    │◄─ 10. 결과 ──│                │                  │           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### OAuth 2.0 권한 승인 유형

| 유형 | 사용 시나리오 | 설명 |
|------|-------------|------|
| **Authorization Code** | 서버 사이드 웹 앱 | 가장 안전, Code를 토큰으로 교환 |
| **Implicit** | SPA, 모바일 앱 (레거시) | 토큰 직접 발급, 보안 취약 |
| **Resource Owner Password** | 신뢰할 수 있는 앱 | 직접 크리덴셜 전달, 레거시용 |
| **Client Credentials** | 서버 to 서버 | 유저 없이 앱 자체 인증 |

> **참고**: Implicit Grant는 보안 취약점으로 인해 OAuth 2.1에서 제거될 예정. PKCE를 사용한 Authorization Code Flow 권장

---

## 액세스 토큰과 리프레시 토큰

```
┌─────────────────────────────────────────────────────────────────┐
│                  토큰 종류와 용도                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Access Token                        Refresh Token             │
│  ┌────────────────────────┐         ┌────────────────────────┐ │
│  │                        │         │                        │ │
│  │  • 리소스 접근용        │         │  • 토큰 갱신용          │ │
│  │  • 수명: 짧음 (분~시간) │         │  • 수명: 긺 (일~주)     │ │
│  │  • 리소스 서버로 전송   │         │  • 인가 서버에서만 사용 │ │
│  │  • 노출 시 피해 제한적  │         │  • 새 Access Token 발급 │ │
│  │                        │         │                        │ │
│  └────────────────────────┘         └────────────────────────┘ │
│                                                                 │
│   사용 흐름:                                                     │
│                                                                 │
│   [Access Token] ─────► API 호출                                │
│         │                                                       │
│         │ 만료                                                  │
│         ▼                                                       │
│   [Refresh Token] ─────► 새 Access Token 발급                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 토큰 갱신 흐름

```http
# 1. Access Token 만료 시

POST /oauth/token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...
&client_id=my_client_id
&client_secret=my_client_secret

# 2. 새 토큰 발급

HTTP/1.1 200 OK
Content-Type: application/json

{
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "dGhpcyBpcyBhIG5ldyByZWZyZXNoIHRva2Vu..."
}
```

---

## JWT (JSON Web Token)

현대적인 토큰 기반 인증에서 가장 많이 사용되는 형식

### JWT 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      JWT 구조                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.                         │
│   eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.               │
│   SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c                   │
│                                                                 │
│   ├─────── Header ────────┤├──── Payload ────┤├─ Signature ─┤  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Header          │  │ Payload         │  │ Signature       │ │
│  │ (알고리즘, 타입) │  │ (클레임 데이터)  │  │ (서명)          │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤ │
│  │ {               │  │ {               │  │                 │ │
│  │   "alg":"HS256",│  │   "sub":"1234", │  │  HMACSHA256(    │ │
│  │   "typ":"JWT"   │  │   "name":"John",│  │    header +     │ │
│  │ }               │  │   "exp":1234567 │  │    payload,     │ │
│  │                 │  │ }               │  │    secret)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### JWT 주요 클레임

| 클레임 | 설명 | 예시 |
|--------|------|------|
| **iss** | 발급자 (issuer) | `auth.example.com` |
| **sub** | 주체 (subject) | 유저 ID |
| **aud** | 대상 (audience) | 클라이언트 ID |
| **exp** | 만료 시간 | Unix timestamp |
| **iat** | 발급 시간 | Unix timestamp |
| **jti** | 토큰 고유 ID | 중복 사용 방지 |

### JWT 검증 예제 (Spring)

```java
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long validityInMs;

    public String createToken(String userId, List<String> roles) {
        Claims claims = Jwts.claims().setSubject(userId);
        claims.put("roles", roles);

        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInMs);

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(validity)
                .signWith(SignatureAlgorithm.HS256, secretKey)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .setSigningKey(secretKey)
                .parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String getUserId(String token) {
        return Jwts.parser()
                .setSigningKey(secretKey)
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }
}
```

---

## OAuth 1.0 vs 2.0

| 항목 | OAuth 1.0 | OAuth 2.0 |
|------|-----------|-----------|
| **암호화** | 필수 (HMAC 서명) | 선택 (HTTPS 의존) |
| **토큰 수명** | 무제한 | 제한 가능 (`expires_in`) |
| **클라이언트 유형** | 웹 애플리케이션만 | 웹, 모바일, SPA, IoT 등 |
| **복잡성** | 높음 (서명 계산 필요) | 낮음 (Bearer 토큰) |
| **보안** | 자체 서명으로 안전 | HTTPS 필수 |

### OAuth 2.0 프로파일

```
┌─────────────────────────────────────────────────────────────────┐
│                  OAuth 2.0 클라이언트 유형                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 웹 애플리케이션 (Confidential Client)                        │
│     ┌────────────────────────────────────────────────────┐     │
│     │ • 클라이언트 시크릿을 서버에 안전하게 저장           │     │
│     │ • Authorization Code Grant 사용                    │     │
│     │ • 예: 전통적인 서버 사이드 웹 앱                     │     │
│     └────────────────────────────────────────────────────┘     │
│                                                                 │
│  2. 웹 브라우저 클라이언트 (Public Client)                        │
│     ┌────────────────────────────────────────────────────┐     │
│     │ • 클라이언트 시크릿 저장 불가                        │     │
│     │ • PKCE가 포함된 Authorization Code Grant 사용       │     │
│     │ • 예: React, Vue.js 등 SPA                         │     │
│     └────────────────────────────────────────────────────┘     │
│                                                                 │
│  3. 네이티브 애플리케이션                                         │
│     ┌────────────────────────────────────────────────────┐     │
│     │ • PKCE + Authorization Code Grant 권장              │     │
│     │ • 리프레시 토큰으로 장기 세션 유지                   │     │
│     │ • 예: iOS, Android 앱                               │     │
│     └────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## SAML vs OAuth 선택 기준

| 시나리오 | 권장 기술 | 이유 |
|----------|----------|------|
| 기업 내부 SSO | **SAML** | 엔터프라이즈 표준, ID 제공자 통합 |
| 리소스 임시 접근 | **OAuth** | 범위와 시간 제한 가능 |
| 커스텀 IdP 필요 | **SAML** | ID 페더레이션 표준 |
| 모바일 앱 | **OAuth** | 경량, JSON 기반 |
| SOAP/JMS 환경 | **SAML** | XML 기반 프로토콜 호환 |
| 제3자 API 연동 | **OAuth** | API 인가에 최적화 |

---

## OAuth 베스트 프랙티스

### 보안 권장사항

```
┌─────────────────────────────────────────────────────────────────┐
│                  OAuth 보안 베스트 프랙티스                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 액세스 토큰 수명 제한                                        │
│     └─ expires_in 파라미터 사용, 보통 1시간 이내                 │
│                                                                 │
│  ✅ 리프레시 토큰 제공                                           │
│     └─ 사용자 재인증 없이 토큰 갱신                              │
│                                                                 │
│  ✅ HTTPS 필수 적용                                             │
│     └─ OAuth 2.0은 TLS에 전적으로 의존                          │
│                                                                 │
│  ✅ PKCE 사용 (Public Client)                                   │
│     └─ Authorization Code 가로채기 공격 방지                     │
│                                                                 │
│  ✅ State 파라미터 사용                                          │
│     └─ CSRF 공격 방지                                           │
│                                                                 │
│  ✅ 최소 권한 원칙 (Scope)                                       │
│     └─ 필요한 최소한의 권한만 요청                               │
│                                                                 │
│  ❌ 토큰을 URL에 포함하지 않음                                    │
│     └─ 로그에 노출될 수 있음                                     │
│                                                                 │
│  ❌ 클라이언트 시크릿을 프론트엔드에 저장하지 않음                  │
│     └─ Public Client는 시크릿 없이 PKCE 사용                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Spring Security OAuth2 설정 예시

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            );

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter converter = new JwtGrantedAuthoritiesConverter();
        converter.setAuthoritiesClaimName("roles");
        converter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(converter);

        return jwtConverter;
    }
}
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **인증 (Authentication)** | 사용자의 신원을 확인하는 과정 |
| **인가 (Authorization)** | 사용자의 권한을 확인하는 과정 |
| **SSO** | Single Sign-On, 한 번 로그인으로 여러 서비스 접근 |
| **SAML** | Security Assertion Markup Language, SSO 표준 |
| **OAuth** | 리소스 접근 권한을 위임하는 인가 프레임워크 |
| **JWT** | JSON Web Token, 클레임 기반 토큰 형식 |
| **액세스 토큰** | 리소스 접근을 위한 단기 토큰 |
| **리프레시 토큰** | 액세스 토큰 갱신을 위한 장기 토큰 |
| **PKCE** | Proof Key for Code Exchange, Public Client 보안 강화 |
| **PII** | Personally Identifiable Information, 개인식별정보 |
| **SLA** | Service Level Agreement, 서비스 수준 계약 |
