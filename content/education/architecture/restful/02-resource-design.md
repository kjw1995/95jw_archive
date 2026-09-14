---
title: "02. 리소스 설계"
date: 2026-04-23
weight: 2
---

[01. REST 기초](../01-basics)에서 주소는 자원, 메서드는 행위, 표현이 상태를 옮긴다고 했다. 이 장은 그 표현을 **어떤 모양으로 주고받을지**와 **결과를 어떻게 알릴지**의 설계다. 원리는 셋이다. 첫째, **요청은 셋으로 말하고 응답은 셋으로 답한다.** 무엇을(URI), 어떻게(메서드), 어떤 모양으로(MIME 타입)가 요청이고, 결과(상태 코드), 모양(MIME 타입), 내용(표현)이 응답이다. 설계는 이 여섯 칸을 채우는 일이다. 둘째, **같은 자원의 여러 모양은 협상으로 고른다.** JSON과 XML, 한국어와 영어, 그리고 v1과 v2까지 전부 "같은 자원의 다른 표현"이고, 클라이언트가 바라는 것을 말하면 서버가 고른다. 버전을 주소에 둘지 헤더에 둘지의 논쟁도 결국 이 협상을 어디서 하느냐다. 셋째, **상태 코드는 계약의 일부다.** 클라이언트는 코드로 분기하므로, 어느 메서드가 언제 어떤 코드를 돌려주는지를 설계 때 정하고 지킨다. 이 PC에서 GitHub API와 PokeAPI에 보낸 요청으로 협상과 버저닝의 실물을 봤다.

---

## 1. REST 리소스 패턴

```text
  Client                  Server
┌─────────┐             ┌─────────┐
│ Method  │             │         │
│ MIME    │── Request ─▶│ 처리    │
│ URI     │             │         │
│         │             │         │
│ Status  │◀─ Response ─│ Status  │
│ MIME    │             │ MIME    │
└─────────┘             └─────────┘
```

| 요소 | 요청 | 응답 | 왜 |
|:-----|:-----|:-----|:---|
| 동작 | HTTP 메서드 | - | 행위는 첫 단어에 |
| 위치 | 타깃 URI | `Location` (생성 시) | 어느 자원인지 / 새 자원이 어디 생겼는지 |
| 형식 | MIME 타입 | MIME 타입 | 본문이 무엇인지 양쪽이 이름표를 붙인다 |
| 결과 | - | 상태 코드 | 프로그램이 숫자로 분기한다 |

첫째 원리의 표다. HTTP 시리즈에서 본 요청과 응답의 부품이 REST 설계에서는 채워야 할 여섯 칸이 된다. 요청의 셋 중 메서드와 URI는 [01](../01-basics)장에서 정했고, 남은 것이 MIME 타입, 곧 표현의 모양이다. 응답의 셋 중 표현은 그 모양대로 따라오고, 남은 것이 상태 코드다. 이 장의 2~4절이 모양, 5~6절이 코드다.

---

## 2. 콘텐츠 협상 (Content Negotiation)

```text
[HTTP 헤더 방식]        [URL 패턴 방식]
Accept: app/json        /books.json
Accept: app/xml         /books.xml
Accept-Language: ko     /books.html
      │                      │
      ▼                      ▼
  표준 · 권장           URL만 보고 구분
```

같은 URI의 자원을 **여러 표현으로** 내주고 클라이언트가 고르게 하는 것이다. 둘째 원리의 본진이고, 방식은 둘이다. 헤더로 말하거나, 주소에 확장자를 붙이거나.

### HTTP 헤더를 이용한 협상

```http
GET /users/kjw1995 HTTP/1.1
Host: api.github.com
Accept: application/vnd.github+json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Vary: Accept, Accept-Encoding
```

이 PC에서 GitHub API에 GitHub가 정한 미디어 타입을 `Accept`로 보낸 요청과 답이다. 서버는 `Content-Type`으로 고른 모양을 말하고 `X-GitHub-Media-Type: github.v3; format=json`으로 자기 규칙의 어느 판인지를 덧붙이며, `Vary: Accept`로 "이 답은 Accept에 따라 달라지니 캐시는 그것도 키에 넣으라"고 덧붙인다. 같은 주소에 `Accept: application/xml`을 보내면 415와 함께 "JSON만 된다"는 메시지가 온다. 규격은 이 경우 406 Not Acceptable을 정해 두었는데 GitHub는 415로 답한다. 셋째 원리의 예이기도 하다. 코드는 서버의 계약이고, 문서에 그렇게 적혀 있다.

| 헤더 | 방향 | 뜻 | 왜 |
|:-----|:-----|:---|:---|
| Accept | 요청 | 읽을 수 있는 MIME 타입과 순서 | 서버가 가진 표현 중에서 고르게 |
| Accept-Language | 요청 | 바라는 언어 | 같은 문서의 언어판. [HTTP 05](../../../network/http/05-http-headers)장에서 MDN이 `/ko/`로 보냈다 |
| Content-Type | 양방향 | 본문의 MIME 타입 | 요청 본문에도, 응답 본문에도 이름표 |
| Vary | 응답 | 표현을 가른 요청 헤더 | 캐시가 JSON을 XML 손님에게 주지 않게 |

| MIME 타입 | 용도 | 왜 |
|:----------|:-----|:---|
| application/json | JSON | 모든 언어가 읽는다. API의 기본값 |
| application/xml | XML | 기업 연동, 옛 시스템 |
| application/vnd.github+json | GitHub의 JSON | `vnd.`는 벤더 고유. 같은 JSON에 자기 규칙을 얹은 것 |
| text/html | HTML | 브라우저가 그릴 것 |
| text/plain | 글자 | 로그, 단순 답 |
| image/png, image/jpeg | 그림 | 자원이 파일일 때 |
| multipart/form-data | 파일 업로드 | 파일과 글자를 한 본문에 |

### URL 패턴을 이용한 협상

```http
GET /.../commits/main.atom HTTP/1.1
Host: github.com
```

```http
HTTP/1.1 200 OK
Content-Type: application/atom+xml
```

주소에 확장자를 붙여 모양을 고르는 방식이다. 이 PC에서 GitHub의 커밋 목록 주소 끝에 `.atom`을 붙이면 HTML 대신 Atom 피드가 온다. 브라우저 주소창에서 바로 부를 수 있어 편하지만, 같은 자원에 주소가 여럿 생기고 캐시도 링크도 그만큼 갈라진다.

{{< callout type="info" >}}
표준은 `Accept` 헤더다. 확장자 방식은 브라우저에서 직접 열어 볼 보조 경로로만 쓴다. Spring은 `/books.json` 같은 확장자 매칭을 6.0에서 아예 없앴다. 확장자로 형식을 바꾸는 것이 다운로드 위장 공격(RFD)의 통로가 됐기 때문이다. 확장자가 꼭 필요하면 `?format=json` 같은 쿼리 파라미터로 대신한다.
{{< /callout >}}

---

## 3. POJO 기반 JSON 바인딩

```text
 Java Object              JSON String
┌──────────┐             ┌──────────┐
│ Coffee   │             │ {        │
│  name    │─serialize──▶│ "name":..│
│  price   │             │ "price": │
│  origin  │◀─deserialize│ "origin":│
└──────────┘             │ }        │
                         └──────────┘
    ObjectMapper가 양방향 변환
```

둘째 원리의 뒷면이다. 협상으로 JSON을 고르면 서버 안의 객체가 JSON 표현이 되어 나가고, 들어온 JSON은 다시 객체가 된다. 표현은 선 위의 모양이고 객체는 메모리 안의 모양이라 둘 사이의 변환이 필요하고, 스프링에서는 **Jackson**의 `ObjectMapper`가 그 일을 한다.

```java
var mapper = new ObjectMapper();

// JSON → 객체 (역직렬화)
String json = """
    {"name":"Espresso","price":4500}
    """;
Coffee coffee = mapper.readValue(
    json, Coffee.class);

// 객체 → JSON (직렬화)
String out = mapper.writeValueAsString(
    new Coffee("Latte", 5000));
// {"name":"Latte","price":5000}
```

```java
@RestController
@RequestMapping("/coffees")
public class CoffeeController {

    @PostMapping
    ResponseEntity<Coffee> create(
            @RequestBody Coffee c) {
        var saved = repo.save(c);
        URI loc = URI.create(
            "/coffees/" + saved.id());
        return ResponseEntity
            .created(loc).body(saved);
    }
}
```

`@RequestBody`가 들어온 본문을 `Content-Type`에 맞는 변환기로 객체로 바꾸고, 돌려주는 객체는 `Accept`에 맞는 변환기가 다시 표현으로 바꾼다. 2절의 협상이 프레임워크 안에서 변환기 선택으로 이어지는 것이다. `Content-Type`이 `application/xml`인데 XML 변환기가 없으면 415, `Accept`를 맞출 변환기가 없으면 406이 나간다.

---

## 4. API 버저닝

```text
 v1.0        v2.0        v3.0
┌────┐      ┌────┐      ┌────┐
│API │─────▶│API │─────▶│API │
└────┘      └────┘      └────┘
  │            │            │
  ▼            ▼            ▼
 기존         신규         최신
 클라         클라         클라
```

API는 바뀌고 클라이언트는 한꺼번에 못 바꾼다. 앱은 사용자가 업데이트할 때까지 옛 모양을 기대한다. 그래서 새 모양을 내면서 옛 모양도 한동안 살려 두어야 하고, 어느 모양을 줄지를 정하는 것이 버전이다. 둘째 원리대로 보면 v1과 v2도 같은 자원의 다른 표현이라, 문제는 그 협상을 **어디서** 하느냐다.

| 방법 | 예 | 장점 | 단점 | 실물 |
|:-----|:---|:-----|:-----|:-----|
| URI에 | `/v2/coffees/123` | 눈에 보인다. 링크로 줄 수 있다. 캐시 키가 다르다 | 주소가 바뀌니 "같은 자원"이 아니게 된다 | PokeAPI `/api/v2/` |
| 쿼리에 | `/coffees?version=2` | 구현이 쉽다 | 빼먹기 쉽고 조건과 섞인다 | |
| 헤더에 | `Accept: application/vnd.foo.v2+json` 또는 전용 헤더 | 주소가 깨끗하다. 자원은 하나 | 주소창으로 못 보고, 캐시가 `Vary`를 알아야 | GitHub `X-GitHub-Api-Version` |

### URI에 버전 지정 (권장)

```http
GET /api/v2/pokemon/1 HTTP/1.1
Host: pokeapi.co
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=86400
```

이 PC에서 PokeAPI에 물은 것이다. 버전이 주소에 있으니 그 답을 하루 동안 공용 캐시에 두어도 v1 손님과 섞일 일이 없다. 가장 많이 쓰는 이유는 단순함이다. 문서에 적기 쉽고, 링크로 주기 쉽고, 로그에 남는다.

```text
Client                     Server
  │                          │
  │─ GET /api/v1/pokemon/1 ─▶│
  │                          │
  │◀─ 301 Moved Permanently ─│
  │  Location: /api/v2/...   │
  │                          │
  │─ GET /api/v2/pokemon/1 ─▶│
  │                          │
  │◀──────── 200 OK ─────────│
```

옛 버전의 주소로 오는 손님은 어떻게 하는가. 같은 PokeAPI에 `/api/v1/pokemon/1`을 물으니 `301 Moved Permanently`와 "v2로 가라"는 답이 왔다. 옛 주소를 새 주소로 영구히 넘긴 것이고, 클라이언트는 새 주소를 기억하면 된다.

| 코드 | 뜻 | 언제 |
|:-----|:---|:-----|
| 301 Moved Permanently | 영구 이동 | 옛 버전을 새 버전이 완전히 대체했을 때 |
| 302 Found | 임시 이동 | 주소는 살아 있는데 잠시 다른 곳에서 답할 때 |
| 410 Gone | 영영 없다 | 옛 버전을 닫고 넘길 곳도 없을 때 |

### 쿼리 파라미터에 버전 지정

```http
GET /api/coffees/1234?version=2 HTTP/1.1
```

쿼리도 URL의 일부라 캐시 키에는 들어간다. 이 방식의 진짜 문제는 빼먹기 쉽다는 것이다. `?version=`을 안 붙인 요청이 무엇을 뜻하는지가 모호해지고, `?sort=`나 `?page=` 같은 조건들과 한 줄에 섞인다.

### Accept 헤더에 버전 지정

```http
GET /users/kjw1995 HTTP/1.1
Host: api.github.com
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

`vnd.`가 붙은 벤더 미디어 타입에 버전을 넣는 것이 교과서의 방식이고, GitHub가 오래 `application/vnd.github.v3+json`으로 그렇게 했다. 지금의 GitHub는 형식은 `Accept`로, 버전은 날짜를 값으로 하는 전용 헤더로 나눴다. 이 PC에서 `2022-11-28`을 보내니 `x-github-api-version-selected`에 그 값이 실려 돌아왔고, 없는 날짜 `2020-01-01`을 보내니 400과 함께 지원하는 버전 목록이 왔다. 주소는 하나로 두고 협상으로 버전을 고르는, 둘째 원리에 가장 충실한 방식이다. 대가는 주소창과 curl 한 줄로는 못 본다는 것이다.

{{< callout type="warning" >}}
버전 전략은 처음에 정해 **한 가지로 통일**한다. 주소에도 헤더에도 쿼리에도 버전이 있으면 클라이언트는 셋을 다 확인해야 하고, 어느 것이 이겼는지를 디버깅하게 된다. 그리고 버전을 올리는 것은 최후의 수단이다. 필드를 더하는 것은 옛 클라이언트가 모르는 필드를 무시하면 되므로 버전이 필요 없고, 필드를 빼거나 뜻을 바꿀 때만 필요하다.
{{< /callout >}}

---

## 5. HTTP 응답 코드

```text
2XX 성공         3XX 리다이렉션
┌──────────┐    ┌───────────┐
│ 200 OK   │    │ 301 Moved │
│ 201 Cre  │    │ 302 Found │
│ 202 Acc  │    │ 304 NotMod│
│ 204 No   │    └───────────┘
└──────────┘

4XX 클라이언트 에러
┌─────────────────┐
│ 400 Bad Request │
│ 401 Unauthorized│
│ 404 Not Found   │
│ 406 Not Accept  │
└─────────────────┘

5XX 서버 에러
┌─────────────────┐
│ 500 Internal    │
│ 503 Unavailable │
└─────────────────┘
```

셋째 원리다. 코드의 뜻과 근거는 [HTTP 04](../../../network/http/04-http-status-codes)장에서 봤고, 여기서는 API 설계자가 고를 것들만 추린다.

| 코드 | 이름 | 언제 | 왜 |
|:-----|:-----|:-----|:---|
| 200 | OK | GET, PUT, PATCH가 본문과 함께 성공 | 답이 곧 표현 |
| 201 | Created | POST로 새 자원이 생겼다 | `Location`으로 주소를 알린다. 없으면 요청 주소가 새 자원 |
| 202 | Accepted | 받아만 뒀다 | 오래 걸리는 일. 확인할 주소를 준다 |
| 204 | No Content | 성공했고 줄 것이 없다 | DELETE. 본문을 기다리지 않게 |

```http
POST /api/v1/users HTTP/1.1
Content-Type: application/json

{"name": "John", "email": "j@x.io"}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/users/456
Content-Type: application/json

{
  "id": 456,
  "name": "John",
  "email": "j@x.io"
}
```

```http
POST /api/v1/reports HTTP/1.1
```

```http
HTTP/1.1 202 Accepted
Location: /api/v1/reports/jobs/789

{"jobId": 789, "status": "queued"}
```

| 코드 | 이름 | 언제 | 왜 |
|:-----|:-----|:-----|:---|
| 301 | Moved Permanently | 주소가 영구히 바뀌었다 | 4절의 v1 → v2 |
| 302 | Found | 잠시 다른 곳에서 | 다음에는 다시 원래 주소로 |
| 304 | Not Modified | 조건부 요청에 "그대로다" | 본문 없이 캐시를 쓰게. [04](../04-performance)장 |

| 코드 | 이름 | 언제 | 왜 |
|:-----|:-----|:-----|:---|
| 400 | Bad Request | 구문이나 값이 틀렸다 | 고치기 전엔 다시 보내도 같다 |
| 401 | Unauthorized | 누군지 모른다 | 토큰이 없거나 만료. [03](../03-security)장 |
| 403 | Forbidden | 알지만 권한이 없다 | 로그인해도 소용없다 |
| 404 | Not Found | 그런 자원이 없다 | |
| 406 | Not Acceptable | `Accept`에 맞는 표현이 없다 | 2절의 협상 실패 |
| 415 | Unsupported Media Type | 요청 본문의 형식을 못 읽는다 | `Content-Type`이 낯설다 |

| | 401 | 403 |
|:--|:----|:----|
| 서버의 말 | "누구세요?" | "누군지는 알겠는데 안 됩니다" |
| 원인 | 토큰 없음, 만료, 위조 | 남의 데이터, 관리자 기능 |
| 다음 행동 | 로그인, 재발급 | 권한을 얻기 전엔 없다 |

| 코드 | 이름 | 언제 | 왜 |
|:-----|:-----|:-----|:---|
| 500 | Internal Server Error | 잡히지 않은 예외 | 원인은 로그에만 |
| 503 | Service Unavailable | 점검, 과부하 | `Retry-After`로 언제 다시 올지 |

---

## 6. HTTP 메서드별 응답 코드 선택

| 메서드 | 성공 | 실패 | 왜 |
|:-------|:-----|:-----|:---|
| GET | 200 | 404 | 있으면 표현, 없으면 없다 |
| POST | 201 + `Location`, 202 | 400, 409 | 만들었으면 어디에, 받아만 뒀으면 어디서 확인 |
| PUT | 200 또는 204, 201 | 400, 404, 412 | 바꿨으면 그 표현, 없어서 만들었으면 201 |
| PATCH | 200 또는 204 | 400, 409 | 일부 수정도 결과는 표현 |
| DELETE | 204 | 404 | 줄 것이 없다. 두 번째는 404일 수 있다 |

```java
@GetMapping("/{id}")
public ResponseEntity<User> get(
        @PathVariable Long id) {
    return users.find(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity
            .notFound().build());
}

@PostMapping
public ResponseEntity<User> create(
        @RequestBody User req) {
    var saved = users.save(req);
    URI loc = URI.create(
        "/users/" + saved.id());
    return ResponseEntity
        .created(loc).body(saved);
}

@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(
        @PathVariable Long id) {
    users.delete(id);
    return ResponseEntity
        .noContent().build();
}
```

셋째 원리를 코드로 옮긴 것이다. 조회는 있으면 200에 표현, 없으면 404. 생성은 201에 `Location`과 표현. 삭제는 204. 클라이언트는 이 표를 보고 분기 코드를 짜므로, 한 번 정한 뒤에는 "성공인데 200 대신 201", "없는데 200에 빈 본문" 같은 예외를 두지 않는다. 그 예외 하나가 클라이언트마다 특수 처리가 된다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 여섯 칸 | 요청: 메서드·URI·MIME, 응답: 코드·MIME·표현 | 설계는 이 칸을 채우는 일 |
| 콘텐츠 협상 | `Accept`로 바라고 `Content-Type`으로 답한다 | 같은 자원의 여러 모양 |
| URL 확장자 | `.json`, `.atom` | 보조 경로. Spring 6는 뺐다 |
| Vary | 표현을 가른 헤더 | 캐시가 섞지 않게 |
| vnd. | 벤더 고유 미디어 타입 | 같은 JSON에 자기 규칙 |
| JSON 바인딩 | Jackson이 객체와 표현을 오간다 | 협상이 변환기 선택으로 이어진다 |
| 버전 | 같은 자원의 다른 표현 | 협상을 어디서 하느냐 |
| URI 버전 | `/v2/`. 권장 | 보이고, 링크되고, 캐시가 갈린다 |
| 헤더 버전 | GitHub의 날짜 헤더 | 주소는 하나. 주소창으로는 못 본다 |
| 옛 버전 | 301로 넘긴다 | PokeAPI v1 → v2 |
| 코드는 계약 | 메서드마다 정해 두고 지킨다 | 클라이언트가 코드로 분기한다 |
| 406 / 415 | 답의 모양이 없다 / 요청의 모양을 못 읽는다 | 협상의 두 실패 |

{{< callout type="info" >}}
**용어 정리**
- **콘텐츠 협상**: 클라이언트의 `Accept-*`와 서버의 표현을 맞추는 것
- **MIME 타입**: 본문의 형식 이름. `application/json`
- **vnd**: vendor. 회사나 서비스가 정한 미디어 타입의 접두사
- **Vary**: 같은 주소의 표현을 가른 요청 헤더를 캐시 키에 넣으라는 응답 헤더
- **POJO**: 프레임워크에 기대지 않는 순수 자바 객체
- **ObjectMapper**: Jackson의 객체와 JSON 변환기
- **버저닝**: 옛 클라이언트를 깨지 않고 API를 바꾸기 위한 표현 구분
- **페이로드**: 헤더를 뺀 실제 내용물
- **퍼머링크**: 바뀌지 않는 영구 주소
- **크리덴셜**: 토큰, 인증서처럼 누구인지를 증명하는 것. [03](../03-security)장
{{< /callout >}}
