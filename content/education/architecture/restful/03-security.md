---
title: "03. 보안과 추적성"
date: 2026-04-23
weight: 3
---

[01. REST 기초](../01-basics)에서 서버는 대화를 기억하지 않는다고 했고, 로그인 같은 상태는 클라이언트가 토큰으로 들고 다닌다고 했다. [02](../02-resource-design)장은 401과 403의 차이를 "누군지 모른다"와 "알지만 안 된다"로 갈랐다. 이 장은 그 토큰이 어떻게 생겼고 어디서 오는지, 그리고 요청 하나를 어떻게 지키고 남기는지다. 원리는 셋이다. 첫째, **요청마다 누구인지, 되는지, 맞는지를 다시 묻는다.** 무상태라 앞 요청의 답을 믿을 수 없으므로 인증, 인가, 검증이 요청마다 반복되고, 그 순서가 곧 실패 코드의 순서다. 401, 403, 400. 둘째, **추적 없는 보안은 없다.** 요청 열 대의 서버를 지나는 분산 환경에서 사고를 잇는 실은 요청 ID 하나이고, 그 로그가 두 번째 유출 경로가 되지 않게 민감한 것은 지우고 남긴다. 셋째, **비밀은 보내지 않고 증명만 보낸다.** 비밀번호 대신 토큰을, 제3자에게는 비밀번호 대신 권한만을(OAuth), 회사 안에서는 한 번의 로그인을(SSO). 토큰은 짧게 살고, 갱신은 따로 하며, 서명은 위조를 막지만 내용을 숨기지는 않는다. 이 PC에서 JDK만으로 JWT를 만들고 검증하고 위조해 본 결과와 GitHub의 401·OAuth 끝점 응답, 로컬 서버의 접근 로그를 실었다.

---

## 1. REST API 보안 아키텍처

```text
    Client              Server
  ┌────────┐     ┌──────────────┐
  │Request │     │ Authenticate │
  │ +Token │ ──► │   (누구?)    │
  │ +Data  │     └──────┬───────┘
  └────────┘            ▼
                 ┌──────────────┐
                 │  Authorize   │
                 │   (권한?)    │
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │  Validate    │
                 │  (데이터?)   │
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │   Logging    │
                 │  (기록/추적) │
                 └──────────────┘
```

| 단계 | 묻는 것 | 실패하면 | 왜 이 순서인가 |
|:-----|:-------|:--------|:-------------|
| 인증 | 누구인가 | 401 | 누군지 모르면 권한을 따질 수 없다 |
| 인가 | 이 사람이 이것을 해도 되나 | 403 | 알아야 판단한다 |
| 검증 | 보낸 데이터가 맞나 | 400 | 권한 없는 사람의 데이터는 볼 필요도 없다 |
| 로깅 | 무슨 일이 있었나 | - | 위 셋의 결과를 남긴다. 사고는 나중에 안다 |

첫째 원리의 표다. 요청 하나가 서버에 들어오면 이 순서로 문을 지나고, 어느 문에서든 막히면 거기서 끝난다. 순서가 뒤바뀌면 새는 것이 생긴다. 검증을 먼저 하면 로그인도 안 한 사람에게 "이메일 형식이 틀렸다"고 친절히 알려 주는 것이고, 인가를 건너뛰면 로그인만 하면 남의 데이터가 보인다. 각 문은 서로 모르고 자기 것만 묻되, **막히면 빨리** 끝내야 뒤의 비싼 일을 안 한다.

---

## 2. REST API 로깅

```text
┌──────┐  ┌──────┐  ┌──────┐
│ MSA  │  │ MSA  │  │ MSA  │
│  A   │  │  B   │  │  C   │
└──┬───┘  └──┬───┘  └──┬───┘
   │         │         │
   ▼         ▼         ▼
┌─────────────────────────┐
│     중앙 로그 서버      │
│  트랜잭션 추적 / 분석   │
└─────────────────────────┘
```

| 목적 | 뜻 | 왜 로그여야 하나 |
|:-----|:---|:---------------|
| 디버깅 | 어느 서비스에서 터졌나 | 디버거를 붙일 수 없는 곳이 운영이다 |
| 트랜잭션 추적 | 한 요청이 지난 서비스들을 잇는다 | 요청 ID 하나가 열 대의 로그를 꿴다 |
| 패턴 분석 | 누가 언제 무엇을 많이 부르나 | 색인하고 모으고 나눈다 |
| 장애 재연 | 그때의 순서를 다시 밟는다 | 같은 입력이면 같은 사고가 난다 |

둘째 원리다. 한 대에서 돌던 시절의 로그는 한 파일이었다. 요청이 서비스 셋을 지나는 지금은 로그가 세 곳에 남고, 그것을 하나의 이야기로 잇는 것이 **요청 ID**다. 들어오는 문에서 ID를 하나 매기고, 뒤로 부르는 모든 호출에 헤더로 넘기며, 모든 로그 줄에 찍는다. 이 PC의 jwebserver도 요청마다 `127.0.0.1 - - [15/9월/2026:10:30:03 +0900] "GET /H2.java HTTP/1.1" 200 -`처럼 한 줄을 남긴다. 누가, 언제, 무엇을, 결과가 어땠나. 1990년대 웹 서버부터 내려온 이 한 줄이 로그의 최소 단위다.

```java
@Component
class RequestLogFilter
        extends OncePerRequestFilter {

    static final Logger log =
        LoggerFactory.getLogger(
            RequestLogFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest req,
            HttpServletResponse res,
            FilterChain chain)
            throws ServletException,
                   IOException {
        String id = UUID.randomUUID()
            .toString().substring(0, 8);
        MDC.put("reqId", id);
        long start = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            long ms = (System.nanoTime()
                - start) / 1_000_000;
            log.info("{} {} {} {}ms",
                req.getMethod(),
                req.getRequestURI(),
                res.getStatus(), ms);
            MDC.clear();
        }
    }
}
```

필터 하나가 문의 역할이다. 요청이 들어올 때 ID를 만들어 MDC(스레드에 붙는 로그 문맥)에 넣으면, 이 요청을 처리하는 동안 찍히는 모든 로그 줄에 그 ID가 자동으로 붙는다. `finally`에서 지우는 것은 스레드가 풀에서 재사용되기 때문이다. 안 지우면 다음 요청의 로그에 남의 ID가 붙는다.

| 자리 | 언제 도는가 | 왜 고르나 |
|:-----|:----------|:---------|
| 서블릿 필터 | 스프링보다 앞, 모든 요청 | 정적 파일까지 전부. 요청 ID는 여기 |
| 스프링 인터셉터 | 컨트롤러 앞뒤 | 어느 핸들러가 받았는지 안다 |
| AOP | 서비스 메서드 앞뒤 | 비즈니스 단위의 시간 |

서블릿 필터의 원리는 [자바 웹 08](../../../java/web-programming/08-filter-and-listener)장에서 봤다.

---

## 3. 로깅 베스트 프랙티스

| 항목 | 뜻 | 예 | 왜 |
|:-----|:---|:---|:---|
| 타임스탬프 | 언제 | `10:30:03.123` | 순서와 간격이 사고의 절반 |
| 레벨 | 얼마나 중요한가 | `INFO`, `WARN`, `ERROR` | 운영에서는 INFO 이상만 |
| 스레드 | 어느 스레드가 | `exec-1` | 동시 요청의 줄이 섞인다 |
| 로거 | 어느 클래스가 | `c.e.api.RequestLogFilter` | 어디서 찍었나 |
| 요청 ID | 어느 요청의 | `a1b2c3d4` | 2절. 서비스 사이를 잇는다 |
| 메시지 | 무엇이 | `GET /api/users/123 200 45ms` | 메서드, 주소, 결과, 시간 |

```text
10:30:03.123 [exec-1] INFO
  c.e.api.RequestLogFilter
  [a1b2c3d4] GET /users/123 200 45ms
```

Logback의 패턴으로 쓰면 `%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} [%X{reqId}] %msg%n`이고, `%X{reqId}`가 2절의 MDC에서 요청 ID를 꺼낸다. 한 줄에 여섯 가지가 있어야 나중에 그 줄만 보고 "누가 언제 어디서 무엇을"이 재구성된다.

### 민감 데이터 마스킹

```text
  원본               마스킹 결과
┌──────────┐      ┌──────────────────┐
│ 패스워드 │  →   │ ********         │
│ 카드번호 │  →   │ ****-****-1234   │
│ 주민번호 │  →   │ 900101-*******   │
│ 이메일   │  →   │ j***@ex.com      │
└──────────┘      └──────────────────┘

기법: 치환 / 셔플링 / 암호화 / 토큰화
```

```java
static String maskCard(String n) {
    if (n == null || n.length() < 4)
        return "****";
    return "****-****-****-"
        + n.substring(n.length() - 4);
}

static String maskEmail(String e) {
    int at = e.indexOf("@");
    if (at < 1) return "***";
    return e.charAt(0) + "***"
        + e.substring(at);
}
```

이 PC에서 돌려 보면 `1234567812345678`은 `****-****-****-5678`로, `john@example.com`은 `j***@example.com`으로 나온다. 뒤 네 자리와 도메인은 남기는 이유가 있다. 고객 문의 때 "5678로 끝나는 카드"로 맞춰 볼 수 있어야 하고, 도메인은 개인을 특정하지 않는다. 마스킹은 지우는 것과 남기는 것의 균형이다.

| DO | DON'T | 왜 |
|:---|:------|:---|
| 최초 호출자 기록 | 페이로드 전체 로깅 | 본문에는 무엇이 들었는지 모른다 |
| 요청 메타정보 기록 | 민감 데이터 평문 | 로그 서버는 DB보다 허술하다 |
| 소요 시간 기록 | 스택 트레이스 전체 노출 | 내부 구조가 드러난다 |
| 에러 코드와 메시지 | 내부 경로 노출 | 공격의 지도가 된다 |
| 모니터링 연계 | DEBUG를 운영에 | 양이 곧 비용이고 노출이다 |

{{< callout type="warning" >}}
로그에 비밀번호, 토큰, 카드번호, 주민번호가 섞이는 것이 가장 흔한 사고다. 둘째 원리의 뒷면이다. **마스킹을 한 곳에 두고** 로깅 계층에서 일괄 적용해야 하고, 디버깅하려고 잠깐 푼 DEBUG 로그가 그대로 운영에 올라가 요청 본문을 통째로 남기는 일이 실제로 잦다. 로그 서버의 권한은 DB보다 느슨한 경우가 대부분이라, 로그에 들어간 비밀은 DB에 든 비밀보다 위험하다.
{{< /callout >}}

{{< callout type="info" >}}
**SLA(Service Level Agreement)**: 서비스 수준 계약. 응답 시간과 가용성의 약속이다. 로그의 소요 시간과 상태 코드를 모니터링에 연결하면 "99%의 요청이 300ms 안에 성공"이 지켜지는지 자동으로 센다.
{{< /callout >}}

---

## 4. RESTful 서비스 검증

| 검증 | 뜻 | 예 | 왜 |
|:-----|:---|:---|:---|
| 형식 | 모양이 맞나 | 이메일, 전화번호, 우편번호 | 뒤의 코드가 모양을 믿고 짜여 있다 |
| 필수값 | 있어야 할 것이 있나 | `name`, `email` | 없는 값으로 저장하면 나중에 터진다 |
| 범위 | 값이 말이 되나 | 나이 0~150, 가격 > 0 | 음수 가격은 문법상 정수다 |
| 비즈니스 규칙 | 우리 규칙에 맞나 | 이메일 중복 불가 | DB를 봐야 안다. 여기서만 409 |

첫째 원리의 셋째 문이다. 인증과 인가를 지난 요청이라도 데이터는 못 믿는다. 클라이언트는 버그가 있고, 사람은 실수하고, 공격자는 일부러 이상한 값을 보낸다. 검증의 목적은 **잘못된 데이터가 안으로 들어오기 전에** 400으로 돌려보내는 것이다.

```java
record UserCreateRequest(
    @NotBlank @Size(min = 2, max = 50)
    String name,
    @NotBlank @Email
    String email,
    @NotNull @Min(0) @Max(150)
    Integer age,
    @Pattern(regexp = "^[0-9]{5}$")
    String zipCode) {}
```

```java
@PostMapping
ResponseEntity<User> create(
        @Valid @RequestBody
        UserCreateRequest req) {
    User user = users.create(req);
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(user);
}
```

규칙을 코드가 아니라 **선언**으로 적는 것이 Bean Validation이다(JSR 380, 지금은 Jakarta Validation). `@Valid`가 붙은 인자는 컨트롤러에 들어오기 전에 검사되고, 어긋나면 예외가 나서 [HTTP 04](../../../network/http/04-http-status-codes)장의 전역 핸들러가 400으로 바꾼다. 컨트롤러 안에 `if (name == null)`을 쓰지 않는 이유는 규칙이 DTO 옆에 있어야 한눈에 보이고, 같은 DTO를 쓰는 모든 곳에서 같은 규칙이 돌기 때문이다.

```json
{
  "type": "/errors/validation",
  "title": "입력값 오류",
  "status": 400,
  "errors": [
    { "field": "email",
      "message": "형식이 아니다" },
    { "field": "age",
      "message": "0 이상이어야 한다" }
  ]
}
```

어느 필드가 왜 틀렸는지를 **전부** 돌려준다. 하나씩 알려 주면 사용자가 다섯 번 제출해야 한다. 형식은 [HTTP 04](../../../network/http/04-http-status-codes)장의 Problem Details를 따른다.

---

## 5. 인증과 인가

```text
Authentication     Authorization
┌───────────┐     ┌───────────┐
│  누구?    │     │  무엇을?  │
│ Who are   │     │ What can  │
│  you?     │     │  you do?  │
│ (신원확인)│     │ (권한확인)│
└─────┬─────┘     └─────┬─────┘
      ▼                 ▼
   토큰 발급         접근 허용/거부
```

| 구분 | 인증 (Authentication) | 인가 (Authorization) | 왜 나누나 |
|:-----|:---------------------|:--------------------|:---------|
| 질문 | 누구인가 | 무엇을 해도 되나 | 다른 질문이다 |
| 근거 | 비밀번호, 토큰, 인증서 | 역할, 소유, 정책 | 근거의 출처가 다르다 |
| 시점 | 먼저 | 인증 뒤 | 누군지 알아야 권한을 찾는다 |
| 실패 | 401 | 403 | [HTTP 04](../../../network/http/04-http-status-codes)장 |

이 PC에서 GitHub API의 `/user`를 엉터리 토큰으로 부르면 401과 "Bad credentials"가 온다. 누군지 확인이 안 됐다는 뜻이고, 토큰을 고치기 전엔 몇 번을 보내도 같다. 올바른 토큰이라도 그 토큰에 없는 권한의 자원을 부르면 403이다. 두 코드를 섞어 쓰는 API가 많은데, 클라이언트의 다음 행동(로그인 창을 띄울지, 권한 안내를 할지)이 갈리므로 첫째 원리대로 구분한다.

---

## 6. SSO와 SAML

```text
       ┌─────────────┐
       │ ID 저장소   │
       │ (계정 보관) │
       └──────┬──────┘
              │
         한 번 로그인
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐
│App A │  │App B │  │App C │
│이메일│  │업무  │  │ ERP  │
└──────┘  └──────┘  └──────┘
```

셋째 원리의 첫 모습이다. 회사에 앱이 열 개면 비밀번호를 열 곳에 두는 대신 한 곳(IdP)에만 두고, 나머지는 그곳이 써 준 **증명서**를 믿는다. 그것이 SSO이고, 그 증명서의 표준 형식이 SAML이다.

| 구성 요소 | 역할 | 예 | 왜 |
|:---------|:-----|:---|:---|
| Principal | 사용자 | 직원 계정 | 증명의 주인 |
| Identity Provider (IdP) | 비밀번호를 갖고 인증한다 | Okta, Entra ID | 비밀은 한 곳에만 |
| Service Provider (SP) | 증명서를 믿고 서비스한다 | 사내 업무 앱 | 비밀번호를 볼 일이 없다 |

```text
 User      SP        IdP
  │        │          │
  │ 1.접근 │          │
  │───────►│          │
  │◄───2.리다이렉트   │
  │        │          │
  │───3.인증 요청────►│
  │        │          │
  │◄──4.로그인 화면───│
  │        │          │
  │───5.크리덴셜─────►│
  │        │          │
  │◄──6.SAML Assert───│
  │        │          │
  │───7.전달─►│       │
  │        │          │
  │◄─8.서비스 허용───│
```

비밀번호(5)는 IdP에만 간다. SP가 받는 것은 IdP가 서명한 XML 문서(6, Assertion)이고, SP는 서명만 확인한다. 사용자가 앱 B로 가면 IdP는 이미 로그인된 세션을 보고 화면 없이 6부터 다시 준다. 한 번 로그인이 되는 이유다.

---

## 7. OAuth 2.0

```text
┌──────────┐   ┌──────────┐
│ Resource │   │  Client  │
│  Owner   │   │ (제3자)  │
│ (실 유저)│   │          │
└──────────┘   └──────────┘
      │              │
      ▼              ▼
┌──────────────────────────┐
│   Authorization Server   │
│   (토큰 발급·인증)       │
└──────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │  Resource    │
      │   Server     │
      │ (데이터 보유)│
      └──────────────┘
```

셋째 원리의 둘째 모습이다. 사진 인화 앱이 내 Google Photos의 사진을 가져가려면 예전에는 내 구글 비밀번호를 그 앱에 줘야 했다. OAuth는 비밀번호 대신 **"사진 읽기만 되는 토큰"**을 주게 한다. 앱은 비밀번호를 모르고, 권한은 사진 읽기로 한정되며, 토큰은 언제든 회수된다. 인증(누구인가)이 아니라 **인가(무엇을 해도 되나)의 위임**이 OAuth의 본질이다.

| 역할 | 누구 | 왜 따로 있나 |
|:-----|:-----|:-----------|
| Resource Owner | 사용자 | 허락하는 사람 |
| Client | 제3자 앱 | 허락받는 쪽. 비밀번호를 몰라야 한다 |
| Authorization Server | 토큰 발급자 | 허락을 확인하고 토큰으로 바꿔 준다 |
| Resource Server | API | 토큰만 보고 준다 |

### Authorization Code Flow

```text
User   Client   AuthSrv   ResSrv
 │       │        │         │
 │─1.요청►│        │         │
 │       │        │         │
 │◄─2.리다이렉트──│         │
 │       │        │         │
 │───3.로그인+승인►         │
 │       │        │         │
 │◄──4.Auth Code──│         │
 │       │        │         │
 │─5.전달►│       │         │
 │       │        │         │
 │       │─6.Code+Secret►   │
 │       │        │         │
 │       │◄─7.Access Token  │
 │       │        │         │
 │       │─────8.API 호출──►│
 │       │        │         │
 │       │◄────9.리소스─────│
 │       │        │         │
 │◄10.결과│       │         │
```

가장 많이 쓰는 흐름이고, 핵심은 토큰이 브라우저를 거치지 않는다는 것이다. 브라우저가 받는 것은 한 번만 쓰는 짧은 **코드**(4)이고, 클라이언트 서버가 그 코드와 자기 비밀을 들고 뒷문으로 토큰을 받는다(6, 7). 브라우저 기록이나 주소창에 토큰이 남지 않는다. 이 PC에서 GitHub의 인가 끝점 `/login/oauth/authorize`를 curl로 부르니 302로 로그인 페이지에 보내는 답이 왔다. 2와 3 사이, 사용자가 로그인해야 승인 화면이 나오는 단계다. 토큰 끝점 `/login/oauth/access_token`에 없는 client_id로 POST하니 JSON으로 오류가 왔다. 6의 문은 비밀을 아는 클라이언트에게만 열린다.

| 유형 | 쓰는 곳 | 왜 |
|:-----|:-------|:---|
| Authorization Code | 서버가 있는 웹 앱 | 토큰이 브라우저를 안 거친다 |
| Authorization Code + PKCE | SPA, 모바일 앱 | 비밀을 못 숨기는 클라이언트를 위해 코드 가로채기를 막는다 |
| Client Credentials | 서버 대 서버 | 사용자가 없다. 앱 자신이 주인 |
| Implicit | (쓰지 않는다) | 토큰이 주소창에 실렸다 |
| Resource Owner Password | (쓰지 않는다) | 비밀번호를 앱에 주는 것이라 OAuth의 뜻에 어긋난다 |

{{< callout type="warning" >}}
**Implicit과 Password 유형은 쓰지 않는다.** 2025년 1월의 OAuth 2.0 보안 모범 사례(RFC 9700)가 둘을 금지했고, OAuth 2.1 초안은 규격에서 아예 뺐다. SPA와 모바일 앱도 **PKCE를 붙인 Authorization Code**를 쓴다. 클라이언트가 임의의 값을 만들어 해시를 인가 요청에 싣고, 토큰을 받을 때 원래 값을 내면, 코드를 가로챈 사람은 원래 값을 몰라 토큰을 못 받는다.
{{< /callout >}}

---

## 8. 액세스 토큰과 리프레시 토큰

```text
Access Token        Refresh Token
┌────────────┐     ┌────────────┐
│리소스 접근 │     │토큰 갱신   │
│수명: 짧음  │     │수명: 긺    │
│(분~시간)   │     │(일~주)     │
│ResSrv 전송 │     │AuthSrv 전용│
│노출 시 경미│     │새 AT 발급  │
└────────────┘     └────────────┘

[Access Token] ──► API 호출
       │
       │ 만료
       ▼
[Refresh Token] ──► 새 AT 발급
```

| | 액세스 토큰 | 리프레시 토큰 | 왜 둘인가 |
|:--|:----------|:------------|:---------|
| 어디로 | 리소스 서버(API)마다 | 인가 서버에만 | 노출되는 곳이 많은 것은 짧게 |
| 수명 | 분~시간 | 일~주 | 훔쳐도 곧 죽는다 |
| 새면 | 그 시간만큼 피해 | 새 액세스 토큰을 계속 만든다 | 그래서 인가 서버에만 보내고 회수 가능하게 |

셋째 원리의 "토큰은 짧게 살고 갱신은 따로"다. 액세스 토큰은 API마다 실려 다니니 새기 쉽고, 그래서 한 시간이면 죽게 한다. 사용자를 한 시간마다 다시 로그인시킬 수는 없으니, 인가 서버에만 보내는 긴 토큰으로 새것을 받아 온다. 리프레시 토큰이 새면 크므로 한 번 쓰면 새것으로 바꿔 주고(회전), 이전 것이 다시 쓰이면 둘 다 폐기한다.

```http
POST /oauth/token HTTP/1.1
Host: auth.example.com

grant_type=refresh_token
&refresh_token=dGhpcyBpcy...
&client_id=my_client
&client_secret=my_secret
```

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcy..."
}
```

본문은 폼 인코딩이고 답은 JSON이다. `expires_in`이 초 단위 수명이고, `token_type: Bearer`는 "가진 자가 곧 권한"이라는 뜻이다. [HTTP 05](../../../network/http/05-http-headers)장의 `Authorization: Bearer ...`가 이 토큰을 싣는 자리다.

---

## 9. JWT (JSON Web Token)

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4i
 LCJleHAiOjE3ODk0MzAwMDB9
.tw5faWRn9t_qYk5ve_vdK3n2wdQDS-u0khlp
 -RKkXKg

┌──────────┐ ┌──────────┐ ┌──────────┐
│  Header  │.│ Payload  │.│Signature │
│(알고리즘)│ │ (클레임) │ │  (서명)  │
├──────────┤ ├──────────┤ ├──────────┤
│ "alg":   │ │ "sub":   │ │ HMACSHA  │
│ "HS256"  │ │ "1234",  │ │ 256(     │
│ "typ":   │ │ "name":  │ │ header+  │
│ "JWT"    │ │ "John"   │ │ payload, │
│          │ │          │ │ secret)  │
└──────────┘ └──────────┘ └──────────┘
```

이 PC에서 JDK만으로 만든 실제 토큰이다(줄바꿈은 지면 때문). 점으로 나뉜 세 부분이 각각 36, 60, 43글자이고, 앞의 둘은 JSON을 Base64URL로 적은 것뿐이라 키 없이 풀린다. 둘째 부분을 풀면 `{"sub":"1234","name":"John","exp":1789430000}`가 그대로 나온다. 셋째 원리의 마지막 문장이 이것이다. **서명은 위조를 막지만 내용을 숨기지 않는다.** 그래서 JWT에 비밀번호나 주민번호를 넣으면 안 된다.

| 실험 | 결과 | 왜 |
|:-----|:-----|:---|
| 만든 서명을 같은 키로 다시 계산 | 일치 | 정상 토큰 |
| 페이로드의 John을 Root로 바꿈 | 불일치 | 한 글자만 바뀌어도 해시가 다르다 |
| 다른 키로 계산 | 불일치 | 키 없이는 유효한 서명을 못 만든다 |

세 실험이 JWT의 전부다. 서버는 토큰을 받으면 앞 두 부분을 자기 키로 다시 서명해 셋째 부분과 비교한다. 같으면 "내가 발급했고 안 바뀌었다"는 뜻이고, DB를 보지 않아도 `sub`를 믿을 수 있다. 무상태 서버가 로그인을 기억하지 않고도 누구인지 아는 방법이 이것이다. 대가는 **회수가 안 된다**는 것이다. 발급한 토큰은 `exp`까지 유효하므로, 수명을 짧게 두고 8절의 리프레시 토큰으로 갱신한다.

| 클레임 | 뜻 | 예 | 왜 |
|:-------|:---|:---|:---|
| iss | 발급자 | `auth.example.com` | 누가 서명했나 |
| sub | 주체 | 사용자 ID | 이 토큰이 누구 것인가 |
| aud | 대상 | 클라이언트 ID | 어느 서비스용인가. 남의 것을 들고 오면 거절 |
| exp | 만료 | Unix 시각 | 회수가 안 되니 수명으로 대신 |
| iat | 발급 시각 | Unix 시각 | 얼마나 오래된 토큰인가 |
| jti | 토큰 ID | 고유값 | 같은 토큰의 재사용을 잡는다 |

```java
var enc = Base64.getUrlEncoder()
    .withoutPadding();
String h = enc.encodeToString(
    header.getBytes(UTF_8));
String p = enc.encodeToString(
    payload.getBytes(UTF_8));
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(
    secret.getBytes(UTF_8),
    "HmacSHA256"));
String sig = enc.encodeToString(
    mac.doFinal((h + "." + p)
        .getBytes(UTF_8)));
String jwt = h + "." + p + "." + sig;
```

위 실험에 쓴 코드다. 라이브러리 없이 JDK의 Base64와 HMAC만으로 열 줄이다. 실무에서는 만료와 클레임 검사를 해 주는 라이브러리를 쓴다.

```java
SecretKey key = Keys.hmacShaKeyFor(
    secret.getBytes(UTF_8));

String token = Jwts.builder()
    .subject(userId)
    .claim("roles", roles)
    .issuedAt(new Date())
    .expiration(new Date(
        System.currentTimeMillis()
            + validityMs))
    .signWith(key)
    .compact();

Claims claims = Jwts.parser()
    .verifyWith(key).build()
    .parseSignedClaims(token)
    .getPayload();
```

jjwt 0.12의 API다. `parseSignedClaims`가 서명과 만료를 함께 검사해 어긋나면 예외를 던진다. HS256은 발급자와 검증자가 같은 키를 나눠 갖는 방식이라 서비스가 여럿이면 키가 여럿에 퍼진다. 그래서 여러 서비스가 검증하는 토큰은 RS256처럼 비밀 키로 서명하고 공개 키로 검증하는 방식을 쓴다.

---

## 10. OAuth 1.0 vs 2.0

| 항목 | OAuth 1.0 | OAuth 2.0 | 왜 바뀌었나 |
|:-----|:----------|:----------|:-----------|
| 요청 보호 | 요청마다 HMAC 서명 | TLS에 맡긴다 | HTTPS가 흔해지자 서명 계산이 짐이 됐다 |
| 토큰 | 만료 없음 | `expires_in` | 8절. 짧게 살아야 |
| 클라이언트 | 웹 앱 | 웹, 모바일, SPA, 기기 | 스마트폰 시대 |
| 복잡도 | 높다 | 낮다. Bearer 한 줄 | 구현 실수가 곧 구멍이었다 |
| 대가 | 서명이 자체 보호 | TLS 없이는 무방비 | 그래서 HTTPS가 필수 |

| 클라이언트 유형 | 특징 | 예 | 왜 |
|:--------------|:-----|:---|:---|
| Confidential | 비밀을 서버에 둘 수 있다 | 서버 사이드 웹 앱 | 비밀로 자기를 증명 |
| Public | 비밀을 둘 곳이 없다 | SPA, 모바일 앱 | 코드를 열면 다 보인다. PKCE로 대신 |
| 네이티브 앱 | Public + 긴 세션 | iOS, Android | 리프레시 토큰을 기기의 안전 저장소에 |

---

## 11. SAML vs OAuth 선택 기준

| 상황 | 고르는 것 | 왜 |
|:-----|:---------|:---|
| 기업 내부 SSO | SAML | 기업 IdP의 표준. 20년의 연동 |
| 자원의 임시 접근 | OAuth | 범위와 시간을 자른다 |
| 외부 IdP 연동 | SAML 또는 OIDC | 신원 연합의 표준 |
| 모바일 앱 | OAuth + OIDC | 가볍고 JSON |
| SOAP, JMS 환경 | SAML | XML 세계끼리 |
| 제3자 API 연동 | OAuth | 권한 위임이 본업 |

둘은 답하는 질문이 다르다. SAML은 "이 사람이 누구인가"(인증)에 대한 서명된 답이고, OAuth는 "이 앱이 무엇을 해도 되는가"(인가)의 토큰이다. OAuth로 로그인을 구현하면 "토큰을 받았으니 로그인됐다"는 논리가 되는데, 그 토큰이 누구 것인지는 OAuth가 말해 주지 않는다. 그 빈자리를 메운 것이 **OIDC(OpenID Connect)**다. OAuth 2.0 위에 "누구인가"를 답하는 ID 토큰(9절의 JWT)을 얹은 것이고, 구글·카카오 로그인이 이것이다.

---

## 12. OAuth 베스트 프랙티스

| 권장 | 왜 |
|:-----|:---|
| 액세스 토큰은 짧게 | 8절. 보통 1시간 이내 |
| 리프레시 토큰은 회전 | 한 번 쓰면 바꾸고, 재사용되면 둘 다 폐기 |
| HTTPS 필수 | 10절. Bearer는 가진 자가 권한이라 선이 곧 금고 |
| PKCE는 모든 클라이언트에 | RFC 9700. Public만이 아니라 전부 |
| state 파라미터 | 인가 응답이 내가 시작한 요청의 것인지. CSRF |
| redirect_uri 정확히 일치 | 비슷한 주소로 코드를 빼돌리지 못하게 |
| 최소 범위(scope) | 사진 읽기만 필요하면 그것만 |

| 하지 말 것 | 왜 |
|:----------|:---|
| 토큰을 URL에 | 로그, 기록, Referer에 남는다 |
| 비밀을 프론트엔드에 | 코드를 열면 보인다. Public은 PKCE |
| Implicit, Password 유형 | 7절 |
| JWT에 민감 정보 | 9절. 서명은 숨기지 않는다 |

```java
@Bean
SecurityFilterChain chain(
        HttpSecurity http)
        throws Exception {
    http.authorizeHttpRequests(a -> a
        .requestMatchers("/open/**")
            .permitAll()
        .requestMatchers("/admin/**")
            .hasAuthority("SCOPE_admin")
        .anyRequest().authenticated())
        .oauth2ResourceServer(o ->
            o.jwt(withDefaults()));
    return http.build();
}
```

리소스 서버의 전부다. 요청의 `Authorization: Bearer` 토큰을 꺼내 서명과 만료를 검사하고, `scope` 클레임을 `SCOPE_` 권한으로 바꿔 인가에 쓴다. 1절의 문 둘(인증, 인가)이 이 설정 하나로 요청마다 돈다. `roles` 같은 다른 클레임을 권한으로 쓰려면 `JwtAuthenticationConverter`를 빈으로 등록한다. 기본 구성과 비밀번호 저장, HTTPS 설정은 [Spring Security 02](../../../spring/security/02-hello-spring-security)장에서 본다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 네 개의 문 | 인증 → 인가 → 검증 → 로깅 | 순서가 곧 401, 403, 400 |
| 요청 ID | 한 요청의 로그를 서비스 너머로 잇는다 | 분산 환경의 실 |
| MDC | 스레드에 붙는 로그 문맥 | 모든 줄에 ID가 자동으로 |
| 마스킹 | 뒤 넷과 도메인만 남긴다 | 로그는 두 번째 유출 경로 |
| 검증 | 선언으로, 전부 한 번에 | 잘못된 데이터를 문 앞에서 |
| 인증 / 인가 | 누구인가 / 되는가 | 401 / 403 |
| SSO, SAML | 비밀번호는 IdP에만 | 서명된 증명서를 믿는다 |
| OAuth | 비밀번호 대신 권한만 위임 | 인가 프레임워크 |
| Authorization Code | 토큰이 브라우저를 안 거친다 | 코드는 한 번, 토큰은 뒷문으로 |
| PKCE | 코드 가로채기 방어 | 이제 모든 클라이언트에 |
| 액세스 / 리프레시 | 짧게 / 길게, 인가 서버에만 | 새는 곳이 많은 것은 짧게 |
| JWT | 서명된 JSON. 숨기지는 않는다 | DB 없이 누구인지 안다. 회수는 안 된다 |
| OIDC | OAuth 위의 인증 | "누구인가"의 ID 토큰 |

{{< callout type="info" >}}
**용어 정리**
- **Authentication / Authorization**: 누구인가 / 무엇을 해도 되나
- **요청 ID / MDC**: 요청마다 매기는 추적 번호 / 그것을 로그에 자동으로 붙이는 스레드 문맥
- **SSO**: 한 번 로그인으로 여러 서비스에
- **SAML**: IdP가 서명한 XML 증명서로 SSO를 하는 표준
- **IdP / SP**: 비밀번호를 갖고 인증하는 곳 / 증명서를 믿는 서비스
- **OAuth 2.0**: 비밀번호 대신 범위가 정해진 토큰으로 권한을 위임하는 틀
- **PKCE**: 코드 교환에 증명 키를 붙여 가로채기를 막는 확장
- **Access / Refresh Token**: 짧은 접근 토큰 / 긴 갱신 토큰
- **Bearer**: 가진 자가 곧 권한인 토큰 방식
- **JWT**: 헤더, 페이로드, 서명을 점으로 이은 서명된 JSON 토큰
- **OIDC**: OAuth 2.0 위에 ID 토큰을 얹은 인증 규격
- **PII**: 개인식별정보. 로그에서 마스킹할 것
- **SLA**: 서비스 수준 계약
{{< /callout >}}
