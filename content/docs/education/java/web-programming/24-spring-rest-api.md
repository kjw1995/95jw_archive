---
title: "24. 스프링 REST API 사용하기"
weight: 24
---

스프링에서 REST API를 구현하는 방법과 관련 애너테이션을 다룬다.

---

## 1. REST란?

REST(Representational State Transfer)는 **하나의 URI가 고유한 리소스를 처리하는 공통 방식**이다.

기존 웹 애플리케이션은 브라우저에 HTML, CSS, JavaScript 등 화면 정보를 통째로 전송했다. 하지만 모바일 기기는 네트워크 전송량이 제한적이므로 **화면은 그대로 유지하면서 필요한 데이터만** 전송받아 결과를 표시하는 방식이 필요해졌다.

```
  기존 방식 (서버 렌더링)
  ┌──────────┐
  │ 브라우저   │
  └────┬─────┘
       │ 요청
       ▼
  ┌──────────┐
  │ 서버      │
  │ HTML 생성 │
  └────┬─────┘
       │ HTML+CSS+JS
       ▼
  ┌──────────┐
  │ 브라우저   │
  │ 전체 렌더링 │
  └──────────┘
```

```
  REST 방식 (데이터만)
  ┌──────────┐
  │ 클라이언트  │
  │ (모바일 등) │
  └────┬─────┘
       │ 요청
       ▼
  ┌──────────┐
  │ 서버      │
  │ JSON 응답 │
  └────┬─────┘
       │ JSON 데이터만
       ▼
  ┌──────────┐
  │ 클라이언트  │
  │ 화면 갱신  │
  └──────────┘
```

### REST URI 예시

| URI | 의미 |
|:-----|:-----|
| `/board/112` | 게시글 중 112번 글 |
| `/members/5` | 회원 중 5번 회원 |

REST 방식으로 제공되는 API를 **REST API**(또는 RESTful API)라고 한다.

---

## 2. @RestController 사용하기

스프링 4에서 도입된 `@RestController`는 컨트롤러의 모든 메서드가 **뷰가 아닌 데이터를 직접 반환**하도록 한다.

### @Controller vs @RestController

| 항목 | @Controller | @RestController |
|:-----|:-----|:-----|
| 반환 | 뷰 이름 (JSP 등) | 데이터 (JSON, XML 등) |
| @ResponseBody | 메서드마다 필요 | 자동 적용 |
| 도입 버전 | 스프링 2.5 | 스프링 4.0 |
| 주 용도 | 웹 페이지 렌더링 | REST API |

```java
// 스프링 3 방식: 메서드마다 @ResponseBody
@Controller
public class OldController {

    @RequestMapping("/api/data")
    @ResponseBody
    public String getData() {
        return "hello";
    }
}

// 스프링 4 방식: 클래스에 @RestController
@RestController
public class NewController {

    @RequestMapping("/api/data")
    public String getData() {
        return "hello";
    }
}
```

### pom.xml 의존성

JSON 변환을 위해 Jackson 라이브러리를 추가한다.

```xml
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.5.4</version>
</dependency>
```

{{< callout type="info" >}}
Jackson 라이브러리가 클래스패스에 있으면 스프링이 자동으로 `MappingJackson2HttpMessageConverter`를 등록한다. 객체를 반환하면 **자동으로 JSON 변환**이 이루어진다.
{{< /callout >}}

---

## 3. @PathVariable 사용하기

`@PathVariable`은 **URL 경로의 일부를 매개변수로** 가져오는 애너테이션이다.

```java
@RestController
@RequestMapping("/test")
public class TestController {

    // /test/notice/10 요청 시
    // num = 10
    @RequestMapping(
        value = "/notice/{num}",
        method = RequestMethod.GET)
    public int notice(
        @PathVariable("num") int num)
        throws Exception {
        return num;
    }
}
```

### @PathVariable 동작 흐름

```
  GET /test/notice/10
         │
         ▼
  ┌────────────────┐
  │ URL 패턴 매칭   │
  │ /notice/{num}  │
  └───────┬────────┘
          │ num = 10
          ▼
  ┌────────────────┐
  │ Controller     │
  │ notice(10)     │
  └───────┬────────┘
          │
          ▼
    응답: 10
```

### 여러 경로 변수 사용

```java
@RequestMapping("/boards/{category}/{id}")
public Board getBoard(
    @PathVariable("category") String category,
    @PathVariable("id") int id) {

    return boardService
        .findByCategoryAndId(category, id);
}
```

{{< callout type="warning" >}}
`@PathVariable`의 변수 이름과 `{}`안의 이름이 **반드시 일치**해야 한다. 불일치하면 바인딩 실패로 예외가 발생한다.
{{< /callout >}}

---

## 4. @RequestBody와 @ResponseBody 사용하기

### @RequestBody

브라우저에서 전달되는 **JSON 데이터를 자바 객체로 자동 변환**한다.

```java
@RequestMapping(
    value = "/members",
    method = RequestMethod.POST)
public String addMember(
    @RequestBody MemberVO member) {

    memberService.add(member);
    return "success";
}
```

```
  브라우저 (JSON 전송)
  {"name":"홍길동","age":25}
         │
         ▼
  ┌────────────────┐
  │ @RequestBody   │
  │ JSON → 객체     │
  │ MemberVO 변환   │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ Controller     │
  │ member.name =  │
  │   "홍길동"      │
  └────────────────┘
```

### @ResponseBody

컨트롤러 메서드가 **JSP가 아닌 데이터를 직접 브라우저로 전송**한다.

```java
@Controller
public class BoardController {

    // JSP 반환 (기본)
    @RequestMapping("/list")
    public String list(Model model) {
        model.addAttribute("boards",
            boardService.findAll());
        return "boardList";  // JSP 이름
    }

    // 데이터 직접 반환
    @RequestMapping("/api/list")
    @ResponseBody
    public List<BoardVO> apiList() {
        return boardService.findAll();
        // JSON 변환되어 전송
    }
}
```

### @ResponseEntity

`@RestController`는 뷰 없이 데이터만 전달하므로, **HTTP 상태 코드와 헤더를 세밀하게 제어**할 때 `ResponseEntity`를 사용한다.

```java
@RequestMapping("/members/{id}")
public ResponseEntity<MemberVO> getMember(
    @PathVariable("id") int id) {

    MemberVO member =
        memberService.findById(id);

    if (member == null) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(null);
    }
    return ResponseEntity
        .status(HttpStatus.OK)
        .body(member);
}
```

### 주요 HTTP 상태 코드

| 그룹 | 코드 | 상수 | 설명 |
|:-----|:-----|:-----|:-----|
| 성공 | 200 | `OK` | 요청 성공 |
| 성공 | 201 | `CREATED` | 새 리소스 생성 |
| 리다이렉션 | 301 | `MOVED_PERMANENTLY` | URI 영구 변경 |
| 리다이렉션 | 302 | `FOUND` | URI 임시 변경 |
| 클라이언트 오류 | 400 | `BAD_REQUEST` | 잘못된 요청 |
| 클라이언트 오류 | 401 | `UNAUTHORIZED` | 인증 필요 |
| 클라이언트 오류 | 404 | `NOT_FOUND` | 리소스 없음 |
| 서버 오류 | 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류 |

{{< callout type="info" >}}
`ResponseEntity`를 사용하면 JSON뿐만 아니라 **HTML이나 JavaScript도 브라우저로 전송**할 수 있어 오류 메시지 처리에 편리하다.
{{< /callout >}}

---

## 5. REST 방식으로 URI 표현하기

REST에서는 **HTTP 메서드**로 리소스에 대한 행위를 구분한다.

### HTTP 메서드와 CRUD 매핑

| HTTP 메서드 | CRUD | 설명 |
|:-----|:-----|:-----|
| `POST` | Create | 리소스 추가 |
| `GET` | Read | 리소스 조회 |
| `PUT` | Update | 리소스 수정 |
| `DELETE` | Delete | 리소스 삭제 |

### REST URI 구성

URI 형식: `/작업명/기본키` + 메서드 + 데이터

### 게시판 REST API 예시

| 메서드 | URI | 설명 |
|:-----|:-----|:-----|
| `POST` | `/boards` + 데이터 | 새 글 등록 |
| `GET` | `/boards/133` | 133번 글 조회 |
| `PUT` | `/boards/133` + 데이터 | 133번 글 수정 |
| `DELETE` | `/boards/133` | 133번 글 삭제 |

### 컨트롤러 구현 예시

```java
@RestController
@RequestMapping("/boards")
public class BoardController {

    @Autowired
    private BoardService boardService;

    // 새 글 등록
    @RequestMapping(
        method = RequestMethod.POST)
    public ResponseEntity<String> create(
        @RequestBody BoardVO board) {
        boardService.add(board);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body("등록 성공");
    }

    // 글 조회
    @RequestMapping(
        value = "/{id}",
        method = RequestMethod.GET)
    public ResponseEntity<BoardVO> read(
        @PathVariable("id") int id) {
        BoardVO board =
            boardService.findById(id);
        return ResponseEntity.ok(board);
    }

    // 글 수정
    @RequestMapping(
        value = "/{id}",
        method = RequestMethod.PUT)
    public ResponseEntity<String> update(
        @PathVariable("id") int id,
        @RequestBody BoardVO board) {
        board.setId(id);
        boardService.update(board);
        return ResponseEntity.ok("수정 성공");
    }

    // 글 삭제
    @RequestMapping(
        value = "/{id}",
        method = RequestMethod.DELETE)
    public ResponseEntity<String> delete(
        @PathVariable("id") int id) {
        boardService.delete(id);
        return ResponseEntity.ok("삭제 성공");
    }
}
```

{{< callout type="warning" >}}
HTML `<form>` 태그는 **GET과 POST만 지원**한다. PUT, DELETE를 사용하려면 Ajax(JavaScript)로 요청하거나, 스프링의 `HiddenHttpMethodFilter`를 설정해야 한다.
{{< /callout >}}

### HiddenHttpMethodFilter 설정

web.xml에 필터를 등록하면 `<input type="hidden" name="_method" value="PUT" />`으로 PUT, DELETE 요청을 보낼 수 있다.

```xml
<filter>
    <filter-name>
        httpMethodFilter
    </filter-name>
    <filter-class>
        org.springframework.web.filter
        .HiddenHttpMethodFilter
    </filter-class>
</filter>
<filter-mapping>
    <filter-name>
        httpMethodFilter
    </filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| REST | 하나의 URI가 고유한 리소스를 처리하는 방식 |
| @RestController | 모든 메서드에 @ResponseBody 자동 적용 |
| @PathVariable | URL 경로 값을 매개변수로 바인딩 |
| @RequestBody | JSON → 자바 객체 변환 |
| @ResponseBody | 자바 객체 → JSON 변환하여 응답 |
| ResponseEntity | HTTP 상태 코드와 헤더를 세밀하게 제어 |
| HTTP 메서드 | POST(생성), GET(조회), PUT(수정), DELETE(삭제) |
