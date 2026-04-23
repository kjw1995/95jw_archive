---
title: "21. 스프링 애너테이션 기능"
weight: 21
---

스프링 애너테이션을 이용한 빈 등록, 요청 매핑, 의존성 주입 방법을 다룬다.

---

## 1. 스프링 애너테이션이란?

스프링 2.5까지는 DI, AOP 같은 기능을 **XML 파일**로 설정했다. 애플리케이션이 커지면서 XML이 복잡해지자, 스프링 3.0부터 **애너테이션**으로 직접 자바 코드에서 설정할 수 있게 되었다.

```
  설정 방식 변화

  Spring 2.x
  ┌──────────────────┐
  │  XML에 모든 빈    │
  │  설정 집중        │
  └────────┬─────────┘
           │
           ▼
  Spring 3.x+
  ┌──────────────────┐
  │  XML + 애너테이션  │
  │  혼합 사용        │
  └──────────────────┘
```

| 방식 | 장점 | 단점 |
|:-----|:-----|:-----|
| XML 설정 | 전체 구조를 한 파일에서 파악 | 설정이 길어지면 관리 어려움 |
| 애너테이션 | 코드와 가까워 직관적 | 설정이 코드에 분산됨 |

현재는 **두 가지를 혼합**하여 사용한다. 인프라 설정(DataSource 등)은 XML, 빈 등록과 DI는 애너테이션으로 처리하는 것이 일반적이다.

---

## 2. 애너테이션 관련 설정

### 핸들러 매핑 클래스

브라우저 URL 요청을 처리하기 위해 스프링이 제공하는 클래스다.

| 클래스 | 기능 |
|:-----|:-----|
| `DefaultAnnotationHandlerMapping` | 클래스 레벨 `@RequestMapping` 처리 |
| `AnnotationMethodHandlerAdapter` | 메서드 레벨 `@RequestMapping` 처리 |

### `<context:component-scan>` 태그

패키지를 지정하면 해당 패키지에서 애너테이션이 붙은 클래스를 **자동으로 빈으로 등록**한다.

```xml
<context:component-scan
    base-package="com.example" />
```

이 한 줄로 `com.example` 하위의 모든 스테레오타입 애너테이션 클래스가 빈으로 생성된다.

---

## 3. 스테레오타입 애너테이션

스프링이 `component-scan` 시 자동으로 빈을 생성하는 애너테이션이다.

| 애너테이션 | 대상 | 역할 |
|:-----|:-----|:-----|
| `@Controller` | 컨트롤러 | 요청 매핑, 뷰 반환 |
| `@Service` | 서비스 | 비즈니스 로직 |
| `@Repository` | DAO | 데이터 접근, 예외 변환 |
| `@Component` | 기타 | 범용 빈 등록 |

```
  요청 처리 계층 구조

  브라우저 요청
       │
       ▼
  @Controller
       │
       ▼
  @Service
       │
       ▼
  @Repository
       │
       ▼
     DB
```

```java
@Controller
public class MemberController {
    // 컨트롤러 빈으로 자동 등록
}

@Service
public class MemberServiceImpl
        implements MemberService {
    // 서비스 빈으로 자동 등록
}

@Repository
public class MemberDAOImpl
        implements MemberDAO {
    // DAO 빈으로 자동 등록
}
```

{{< callout type="info" >}}
`@Controller`, `@Service`, `@Repository`는 모두 `@Component`의 특수화이다. 기능적 차이보다는 **역할을 명확히 표현**하기 위해 구분한다. `@Repository`는 추가로 **DB 예외를 스프링 예외로 자동 변환**하는 기능이 있다.
{{< /callout >}}

---

## 4. `@RequestMapping`과 요청 매핑

### 클래스 레벨 + 메서드 레벨

```java
@Controller
@RequestMapping("/member")
public class MemberController {

    // /member/list 요청 처리
    @RequestMapping("/list")
    public ModelAndView listMembers() {
        // ...
    }

    // /member/detail 요청 처리
    @RequestMapping("/detail")
    public ModelAndView memberDetail() {
        // ...
    }
}
```

---

## 5. `@RequestParam` — 요청 파라미터 바인딩

`request.getParameter()` 대신 **메서드 매개변수에 직접 값을 바인딩**한다.

```java
@RequestMapping("/login")
public ModelAndView login(
        @RequestParam("userId") String userId,
        @RequestParam("userPwd") String userPwd) {
    // userId, userPwd에 값이 자동 설정됨
    // request.getParameter() 불필요
}
```

### required 속성

| 설정 | 동작 |
|:-----|:-----|
| `required = true` (기본값) | 파라미터 없으면 **400 에러** |
| `required = false` | 파라미터 없으면 **null 할당** |

```java
@RequestMapping("/search")
public ModelAndView search(
        @RequestParam("keyword") String keyword,
        @RequestParam(value = "page",
            required = false,
            defaultValue = "1") int page) {
    // keyword는 필수
    // page는 선택 (기본값 1)
}
```

{{< callout type="warning" >}}
`required = true`인데 파라미터가 전달되지 않으면 `MissingServletRequestParameterException`이 발생한다. 선택적 파라미터에는 반드시 `required = false`와 `defaultValue`를 함께 설정하자.
{{< /callout >}}

---

## 6. `@ModelAttribute` — VO에 자동 바인딩

전달되는 파라미터를 **VO 클래스의 속성에 자동으로 매핑**한다.

```java
@RequestMapping("/login")
public ModelAndView login(
        @ModelAttribute("info") LoginVO loginVO) {
    // loginVO에 파라미터가 자동 설정됨
    // JSP에서 ${info.userId}로 접근 가능
}
```

### `@RequestParam` vs `@ModelAttribute` 비교

| 항목 | `@RequestParam` | `@ModelAttribute` |
|:-----|:-----|:-----|
| 바인딩 대상 | 개별 파라미터 | VO 객체 전체 |
| 파라미터 수 | 적을 때 유리 | 많을 때 유리 |
| JSP 전달 | `addObject()` 필요 | 자동 전달 |
| 사용 예 | 검색 키워드 1~2개 | 회원가입 폼 (10개+) |

```
  파라미터 바인딩 흐름

  브라우저 폼 전송
  (userId, userPwd, name)
           │
           ▼
  ┌──────────────────┐
  │ @ModelAttribute  │
  │  ("info")        │
  └────────┬─────────┘
           │ 자동 매핑
           ▼
  ┌──────────────────┐
  │   LoginVO        │
  │  userId = "kim"  │
  │  userPwd = "123" │
  │  name = "김철수"  │
  └──────────────────┘
           │
           ▼
  JSP에서 ${info.userId}
```

---

## 7. `Model` 클래스로 값 전달

`Model` 클래스의 `addAttribute()` 메서드로 JSP에 값을 바인딩할 수 있다. `ModelAndView`의 `addObject()`와 같은 기능이다.

```java
@RequestMapping("/greeting")
public String greeting(Model model) {
    model.addAttribute("msg", "안녕하세요");
    return "greeting";  // 뷰 이름 반환
}
```

### ModelAndView vs Model 비교

| 항목 | `ModelAndView` | `Model` + `String` |
|:-----|:-----|:-----|
| 데이터 전달 | `addObject()` | `addAttribute()` |
| 뷰 지정 | `setViewName()` | 메서드 반환값 |
| 반환 타입 | `ModelAndView` | `String` |
| 코드 스타일 | 전통적 | 간결함 |

```java
// ModelAndView 방식
@RequestMapping("/list")
public ModelAndView list() {
    ModelAndView mav = new ModelAndView();
    mav.addObject("members", memberList);
    mav.setViewName("memberList");
    return mav;
}

// Model 방식 (간결)
@RequestMapping("/list")
public String list(Model model) {
    model.addAttribute("members", memberList);
    return "memberList";
}
```

{{< callout type="info" >}}
두 방식 모두 사용 가능하지만, 최근에는 **`Model` + `String` 반환** 방식이 더 많이 쓰인다. 코드가 간결하고 뷰 이름을 명확히 알 수 있기 때문이다.
{{< /callout >}}

---

## 8. `@Autowired` — 자동 의존성 주입

XML에서 `<property>` 태그로 주입하던 것을 **코드에서 자동으로 수행**한다.

### 특징

- 별도의 setter나 생성자 없이 **필드에 직접 주입** 가능
- 타입(Type) 기준으로 매칭되는 빈을 자동 주입
- `component-scan`과 함께 사용하면 XML 설정을 최소화할 수 있음

```java
@Controller
public class MemberController {

    @Autowired
    private MemberService memberService;
    // setter 없이 빈이 자동 주입됨

    @RequestMapping("/member/list")
    public String listMembers(Model model) {
        model.addAttribute("members",
            memberService.getAllMembers());
        return "memberList";
    }
}
```

### XML 설정 vs `@Autowired` 비교

```xml
<!-- XML 방식: 복잡 -->
<bean id="memberController"
    class="com.example.MemberController">
    <property name="memberService"
        ref="memberService" />
</bean>
<bean id="memberService"
    class="com.example.MemberServiceImpl">
    <property name="memberDAO"
        ref="memberDAO" />
</bean>
```

```java
// 애너테이션 방식: 간결
@Controller
public class MemberController {
    @Autowired
    private MemberService memberService;
}

@Service
public class MemberServiceImpl
        implements MemberService {
    @Autowired
    private MemberDAO memberDAO;
}
```

```
  @Autowired 동작 흐름

  스프링 컨테이너 시작
         │
         ▼
  component-scan 실행
         │
         ▼
  ┌──────────────────┐
  │ 빈 생성           │
  │ Controller       │
  │ Service          │
  │ Repository       │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ @Autowired 처리   │
  │ 타입 매칭 → 주입   │
  └──────────────────┘
```

{{< callout type="warning" >}}
같은 타입의 빈이 **2개 이상** 존재하면 `@Autowired`만으로는 어떤 빈을 주입할지 결정할 수 없다. 이 경우 `@Qualifier("빈이름")`을 함께 사용하여 특정 빈을 지정해야 한다.
{{< /callout >}}

```java
@Service
public class OrderServiceImpl
        implements OrderService {

    @Autowired
    @Qualifier("oracleDAO")
    private OrderDAO orderDAO;
    // 같은 타입의 빈이 여러 개일 때
    // "oracleDAO" 이름의 빈을 주입
}
```

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| `component-scan` | 지정 패키지에서 애너테이션 클래스를 자동으로 빈 등록 |
| 스테레오타입 | `@Controller`, `@Service`, `@Repository`, `@Component` |
| `@RequestParam` | 요청 파라미터를 메서드 매개변수에 바인딩 |
| `@ModelAttribute` | 요청 파라미터를 VO 객체에 자동 매핑 |
| `Model` | JSP에 데이터를 전달하는 경량 객체 |
| `@Autowired` | 타입 기준으로 빈을 자동 주입 |
| `@Qualifier` | 같은 타입 빈이 여러 개일 때 이름으로 지정 |
