---
title: "12. 표현 언어와 JSTL"
weight: 13
---

JSP에서 자바 코드를 완전히 제거하기 위한 표현 언어(EL)와 JSTL(JSP Standard Tag Library)의 문법과 활용법을 다룬다.

---

## 1. 표현 언어(EL)란

표현 언어(Expression Language)는 JSP 2.0부터 도입된 데이터 출력 기능이다. 기존 표현식(`<%= %>`)의 자바 코드가 복잡해지는 문제를 해결하기 위해 등장했다.

### 기본 형식

```jsp
${표현식 또는 값}
```

### 표현식 vs EL 비교

```jsp
<%-- 기존 표현식 --%>
<%= request.getAttribute("name") %>
<%= ((MemberVO)request.getAttribute("member")).getName() %>

<%-- 표현 언어 --%>
${name}
${member.name}
```

### EL의 특징

| 특징 | 설명 |
|:-----|:-----|
| 간결한 문법 | `${}` 안에 속성명만 작성 |
| 내장 객체 지원 | EL 전용 내장 객체 제공 |
| 연산자 지원 | 산술, 비교, 논리, empty 연산자 |
| 빈 속성 접근 | `.` 또는 `[]`로 프로퍼티 접근 |
| 자동 형변환 | 문자열을 숫자로 자동 변환 |

{{< callout type="info" >}}
JSP 페이지에서 EL을 사용하려면 페이지 디렉티브에 `isELIgnored="false"`를 설정해야 한다. JSP 2.0 이상에서는 기본값이 `false`이므로 별도 설정 없이 사용 가능하다.
{{< /callout >}}

---

## 2. EL의 자료형과 연산자

### 자료형

| 자료형 | 예시 | 설명 |
|:-----|:-----|:-----|
| 불리언 | `true`, `false` | 참/거짓 |
| 정수 | `42`, `-7` | 0~9, 음수는 `-` 사용 |
| 실수 | `3.14`, `1.4e5` | 소수점, 지수 표현 가능 |
| 문자열 | `'hello'`, `"hello"` | 따옴표로 감싸서 사용 |
| null | `null` | 값 없음 |

### 연산자

| 종류 | 연산자 | 문자 표현 |
|:-----|:-----|:-----|
| 산술 | `+`, `-`, `*`, `/`, `%` | `div`, `mod` |
| 비교 | `==`, `!=`, `<`, `>`, `<=`, `>=` | `eq`, `ne`, `lt`, `gt`, `le`, `ge` |
| 논리 | `&&`, `\|\|`, `!` | `and`, `or`, `not` |
| empty | `empty 값` | null이거나 빈 값이면 true |
| 조건 | `조건 ? 값1 : 값2` | 삼항 연산자 |

### 연산자 사용 예시

```jsp
<%-- 산술 연산 --%>
<p>합계: ${10 + 20}</p>
<p>나머지: ${10 mod 3}</p>

<%-- 비교 연산 --%>
<p>같은가: ${name eq "홍길동"}</p>
<p>큰가: ${score gt 90}</p>

<%-- 논리 연산 --%>
<p>${age ge 19 and age le 65}</p>

<%-- empty 연산 --%>
<p>비어있나: ${empty memberList}</p>

<%-- 삼항 연산 --%>
<p>${score ge 60 ? "합격" : "불합격"}</p>
```

{{< callout type="warning" >}}
JSP에서 `<`와 `>` 기호는 태그로 인식될 수 있다. EL에서는 비교 연산 시 **문자 표현(`lt`, `gt`, `le`, `ge`)을 사용하는 것이 안전**하다.
{{< /callout >}}

---

## 3. EL 내장 객체

EL은 JSP 내장 객체와 별도로 `${}` 안에서 사용할 수 있는 전용 내장 객체를 제공한다.

### 내장 객체 목록

| 구분 | 내장 객체 | 설명 |
|:-----|:-----|:-----|
| 스코프 | `pageScope` | page 영역 바인딩 객체 |
| | `requestScope` | request 바인딩 객체 |
| | `sessionScope` | session 바인딩 객체 |
| | `applicationScope` | application 바인딩 객체 |
| 요청 파라미터 | `param` | 단일 값 (`getParameter`) |
| | `paramValues` | 복수 값 (`getParameterValues`) |
| 헤더 | `header` | 요청 헤더 단일 값 |
| | `headerValues` | 요청 헤더 배열 값 |
| 쿠키 | `cookie` | 쿠키 이름으로 값 조회 |
| JSP | `pageContext` | pageContext 객체 참조 |
| 초기화 | `initParam` | 컨텍스트 초기화 파라미터 |

### 사용 예시

```jsp
<%-- 요청 파라미터 --%>
<p>아이디: ${param.id}</p>
<p>취미: ${paramValues.hobby[0]}</p>

<%-- 스코프별 속성 접근 --%>
<p>${requestScope.membersList}</p>
<p>${sessionScope.loginUser}</p>

<%-- 헤더 정보 --%>
<p>브라우저: ${header["User-Agent"]}</p>

<%-- 컨텍스트 경로 --%>
<p>${pageContext.request.contextPath}</p>

<%-- 쿠키 --%>
<p>${cookie.JSESSIONID.value}</p>
```

### 스코프 우선순위

같은 이름의 속성이 여러 스코프에 바인딩되어 있으면 **좁은 범위가 우선**한다.

```
  EL 속성 검색 순서

  ${name} 접근 시

  page → request → session → application
  (좁음)                        (넓음)
  우선순위 높음 ──────► 우선순위 낮음
```

```jsp
<%-- 특정 스코프를 지정하여 접근 --%>
<p>${requestScope.name}</p>
<p>${sessionScope.name}</p>
```

---

## 4. EL에서 객체 접근

### 빈 속성 접근

```jsp
<%-- . 연산자 사용 --%>
${member.name}

<%-- [] 연산자 사용 --%>
${member["name"]}
```

### Collection 접근

```jsp
<%-- List 접근 (인덱스) --%>
${memberList[0].name}
${memberList[1].email}

<%-- Map 접근 (키) --%>
${memberMap.hong}
${memberMap["admin"]}
```

### has-a 관계 접근

객체가 다른 객체를 속성으로 가지는 경우 `.`으로 체이닝한다.

```jsp
<%-- 부서 정보를 가진 회원 --%>
${member.department.name}
${member.department.location}
```

```
  has-a 관계 접근

  member
  ┌──────────────────┐
  │ name: "홍길동"    │
  │ department ──────┼──┐
  └──────────────────┘  │
                        ▼
                  department
                  ┌────────────────┐
                  │ name: "개발팀"  │
                  │ location: "3층"│
                  └────────────────┘

  ${member.department.name} → "개발팀"
```

---

## 5. 커스텀 태그와 JSTL

액션 태그와 EL을 사용해도 **조건문과 반복문**에서는 여전히 자바 코드가 필요하다. 이를 해결하기 위해 **JSTL(JSP Standard Tag Library)**이 등장했다.

### 커스텀 태그의 종류

| 종류 | 설명 |
|:-----|:-----|
| JSTL | 표준화된 태그 라이브러리 |
| 프레임워크 태그 | 스프링, 스트러츠 등에서 제공 |
| 개발자 태그 | 필요에 따라 직접 작성 |

### JSTL 라이브러리 종류

| 라이브러리 | 접두어 | 기능 |
|:-----|:-----|:-----|
| 코어 | `c` | 변수, 흐름 제어, 반복문, URL |
| 국제화 | `fmt` | 지역, 메시지, 숫자·날짜 형식 |
| XML | `x` | XML 파싱, 흐름 제어 |
| 데이터베이스 | `sql` | SQL 실행 |
| 함수 | `fn` | 문자열 처리 함수 |

---

## 6. Core 태그 라이브러리

가장 많이 사용되는 JSTL 라이브러리로, 변수 선언·조건문·반복문을 태그로 처리한다.

### taglib 선언 (필수)

```jsp
<%@ taglib prefix="c"
    uri="http://java.sun.com/jsp/jstl/core" %>
```

### Core 태그 목록

| 기능 | 태그 | 설명 |
|:-----|:-----|:-----|
| 변수 | `<c:set>` | 변수 설정 |
| | `<c:remove>` | 변수 제거 |
| 출력 | `<c:out>` | 값 출력 (XSS 방지) |
| 조건 | `<c:if>` | 단일 조건문 |
| | `<c:choose>` | 다중 조건문 (switch) |
| 반복 | `<c:forEach>` | 반복문 |
| | `<c:forTokens>` | 구분자 기반 반복 |
| URL | `<c:import>` | 외부 자원 포함 |
| | `<c:redirect>` | 리다이렉트 |
| | `<c:url>` | URL 생성 |
| 예외 | `<c:catch>` | 예외 처리 |

### `<c:set>` - 변수 설정

```jsp
<%-- 변수 선언 --%>
<c:set var="name" value="홍길동" />
<c:set var="age" value="25" />

<%-- 스코프 지정 --%>
<c:set var="loginId" value="admin"
    scope="session" />

<%-- 빈 속성에 값 설정 --%>
<c:set target="${member}" property="name"
    value="홍길동" />
```

### `<c:if>` - 조건문

```jsp
<c:if test="${score ge 90}">
    <p>A등급입니다.</p>
</c:if>

<c:if test="${empty memberList}">
    <p>등록된 회원이 없습니다.</p>
</c:if>
```

{{< callout type="warning" >}}
`<c:if>`에는 `else`가 없다. else 처리가 필요하면 `<c:choose>`를 사용해야 한다.
{{< /callout >}}

### `<c:choose>` - 다중 조건문

```jsp
<c:choose>
    <c:when test="${score ge 90}">
        <p>A등급</p>
    </c:when>
    <c:when test="${score ge 80}">
        <p>B등급</p>
    </c:when>
    <c:when test="${score ge 70}">
        <p>C등급</p>
    </c:when>
    <c:otherwise>
        <p>F등급</p>
    </c:otherwise>
</c:choose>
```

### `<c:forEach>` - 반복문

```jsp
<%-- 기본 반복 (1~10) --%>
<c:forEach var="i" begin="1" end="10" step="1">
    <p>${i}</p>
</c:forEach>

<%-- 컬렉션 반복 --%>
<c:forEach var="member" items="${memberList}">
    <tr>
        <td>${member.id}</td>
        <td>${member.name}</td>
        <td>${member.email}</td>
    </tr>
</c:forEach>

<%-- varStatus로 상태 정보 사용 --%>
<c:forEach var="member" items="${memberList}"
    varStatus="status">
    <tr class="${status.index mod 2 == 0
        ? 'even' : 'odd'}">
        <td>${status.count}</td>
        <td>${member.name}</td>
    </tr>
</c:forEach>
```

### forEach varStatus 속성

| 속성 | 설명 |
|:-----|:-----|
| `index` | 0부터 시작하는 인덱스 |
| `count` | 1부터 시작하는 반복 횟수 |
| `first` | 첫 번째 반복이면 true |
| `last` | 마지막 반복이면 true |
| `current` | 현재 항목 |

### `<c:forTokens>` - 구분자 기반 반복

```jsp
<c:forTokens var="color"
    items="빨강,주황,노랑,초록,파랑"
    delims=",">
    <p>${color}</p>
</c:forTokens>
```

### `<c:out>` - 안전한 출력

```jsp
<%-- HTML 태그를 이스케이프하여 출력 --%>
<c:out value="${userInput}"
    escapeXml="true" />

<%-- 값이 null일 때 기본값 출력 --%>
<c:out value="${name}" default="이름 없음" />
```

{{< callout type="info" >}}
사용자 입력값을 출력할 때는 반드시 `<c:out>`을 사용해야 한다. `${}`만 사용하면 **XSS(Cross-Site Scripting) 공격**에 취약하다. `<c:out>`은 HTML 특수문자를 자동으로 이스케이프한다.
{{< /callout >}}

### 자바 코드 vs JSTL 비교

```jsp
<%-- 자바 코드 방식 --%>
<%
    List<MemberVO> list = (List<MemberVO>)
        request.getAttribute("memberList");
    if (list != null) {
        for (MemberVO m : list) {
%>
    <tr>
        <td><%= m.getName() %></td>
    </tr>
<%
        }
    }
%>

<%-- EL + JSTL 방식 --%>
<c:forEach var="m" items="${memberList}">
    <tr>
        <td>${m.name}</td>
    </tr>
</c:forEach>
```

---

## 7. 포매팅 태그 라이브러리

숫자와 날짜를 원하는 형식으로 출력하는 태그 라이브러리다.

### taglib 선언

```jsp
<%@ taglib prefix="fmt"
    uri="http://java.sun.com/jsp/jstl/fmt" %>
```

### `<fmt:formatNumber>` - 숫자 포매팅

```jsp
<%-- 천 단위 구분 --%>
<fmt:formatNumber value="1234567"
    groupingUsed="true" />
<%-- 출력: 1,234,567 --%>

<%-- 통화 형식 --%>
<fmt:formatNumber value="50000"
    type="currency" currencyCode="KRW" />
<%-- 출력: ₩50,000 --%>

<%-- 퍼센트 --%>
<fmt:formatNumber value="0.85"
    type="percent" />
<%-- 출력: 85% --%>

<%-- 패턴 지정 --%>
<fmt:formatNumber value="3.14159"
    pattern="#.##" />
<%-- 출력: 3.14 --%>
```

### `<fmt:formatDate>` - 날짜 포매팅

```jsp
<%-- 날짜만 --%>
<fmt:formatDate value="${now}"
    type="date" dateStyle="long" />
<%-- 출력: 2026년 3월 2일 --%>

<%-- 시간만 --%>
<fmt:formatDate value="${now}"
    type="time" />

<%-- 날짜 + 시간 --%>
<fmt:formatDate value="${now}"
    type="both" />

<%-- 커스텀 패턴 --%>
<fmt:formatDate value="${now}"
    pattern="yyyy-MM-dd HH:mm:ss" />
<%-- 출력: 2026-03-02 14:30:00 --%>
```

### formatNumber 주요 속성

| 속성 | 설명 |
|:-----|:-----|
| `value` | 포매팅할 숫자 |
| `type` | number, currency, percent |
| `pattern` | 출력 패턴 (DecimalFormat) |
| `groupingUsed` | 천 단위 구분 여부 (기본: true) |
| `currencyCode` | 통화 코드 (KRW, USD 등) |

### formatDate 주요 속성

| 속성 | 설명 |
|:-----|:-----|
| `value` | 포매팅할 날짜 |
| `type` | date, time, both |
| `dateStyle` | full, long, medium, short |
| `pattern` | 출력 패턴 (SimpleDateFormat) |
| `timeZone` | 시간대 지정 |

---

## 8. 다국어 태그 라이브러리

다국어 기능을 구현할 때 사용하는 태그 라이브러리다.

### 주요 태그

| 태그 | 설명 |
|:-----|:-----|
| `<fmt:setLocale>` | 언어(Locale) 지정 |
| `<fmt:setBundle>` | 리소스 번들 지정 |
| `<fmt:message>` | 번들에서 메시지 조회 |
| `<fmt:requestEncoding>` | 요청 인코딩 지정 |

### 사용 예시

```jsp
<%-- 한국어 로케일 설정 --%>
<fmt:setLocale value="ko_KR" />
<fmt:setBundle basename="messages"
    var="msg" />

<%-- 메시지 출력 --%>
<fmt:message key="greeting" bundle="${msg}" />
```

리소스 번들 파일(`messages_ko.properties`)에 한글을 저장할 때는 **아스키 코드로 변환**해야 한다. JDK의 `native2ascii` 도구를 사용한다.

---

## 9. 문자열 처리 함수

JSTL은 문자열을 처리하는 함수 라이브러리도 제공한다.

### taglib 선언

```jsp
<%@ taglib prefix="fn"
    uri="http://java.sun.com/jsp/jstl/functions" %>
```

### 주요 함수

| 함수 | 반환 | 설명 |
|:-----|:-----|:-----|
| `fn:contains(A, B)` | boolean | A에 B가 포함되어 있는지 |
| `fn:endsWith(A, B)` | boolean | A가 B로 끝나는지 |
| `fn:indexOf(A, B)` | int | A에서 B의 첫 위치 |
| `fn:length(A)` | int | A의 길이 |
| `fn:replace(A, B, C)` | String | A에서 B를 C로 변환 |
| `fn:toLowerCase(A)` | String | 소문자로 변환 |
| `fn:toUpperCase(A)` | String | 대문자로 변환 |
| `fn:substring(A, B, C)` | String | A의 B~C 인덱스 부분 문자열 |
| `fn:split(A, B)` | String[] | A를 B 기준으로 분리 |
| `fn:trim(A)` | String | 앞뒤 공백 제거 |

### 사용 예시

```jsp
<c:set var="text" value="Hello JSTL World" />

<p>길이: ${fn:length(text)}</p>
<p>소문자: ${fn:toLowerCase(text)}</p>
<p>포함: ${fn:contains(text, "JSTL")}</p>
<p>부분: ${fn:substring(text, 6, 10)}</p>
<p>변환: ${fn:replace(text, "World", "JSP")}</p>
```

---

## 요약

### 표현식 → EL 전환

| 기존 (표현식) | EL |
|:-----|:-----|
| `<%= request.getAttribute("name") %>` | `${name}` |
| `<%= request.getParameter("id") %>` | `${param.id}` |
| `<%= session.getAttribute("user") %>` | `${sessionScope.user}` |
| `<%= member.getName() %>` | `${member.name}` |

### 자바 코드 → JSTL 전환

| 기존 (자바 코드) | JSTL |
|:-----|:-----|
| `if (조건) { }` | `<c:if test="${조건}">` |
| `if-else` | `<c:choose>` + `<c:when>` |
| `for (변수 : 컬렉션)` | `<c:forEach>` |
| `out.print(값)` | `<c:out value="${값}">` |
| `변수 = 값` | `<c:set var="" value="">` |

### JSTL 라이브러리 정리

| 라이브러리 | URI 접미어 | 접두어 | 주요 기능 |
|:-----|:-----|:-----|:-----|
| Core | `/core` | `c` | 변수, 조건, 반복 |
| 포매팅 | `/fmt` | `fmt` | 숫자·날짜 형식 |
| 함수 | `/functions` | `fn` | 문자열 처리 |
