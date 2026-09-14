---
title: "01. REST 기초"
date: 2026-04-23
weight: 1
---

HTTP 시리즈에서 요청의 첫 단어가 행위를, 주소가 자원을, 헤더가 표현을 말한다고 했다([HTTP 03](../../../network/http/03-http-methods)). 이 시리즈는 그 규칙을 **API를 설계하는 쪽**에서 다시 본다. 원리는 셋이다. 첫째, **REST는 HTTP를 봉투가 아니라 인터페이스로 쓴다.** SOAP는 HTTP를 XML을 나르는 봉투로만 써서 메서드도 상태 코드도 캐시도 버렸다. REST는 HTTP가 이미 정해 둔 메서드, 코드, 헤더, 캐시를 그대로 쓰므로 세상의 모든 브라우저와 프록시와 캐시가 그 API를 이해한다. 둘째, **주소는 자원이고, 메서드는 행위이며, 상태는 표현에 실려 옮겨 다닌다.** 이름의 Representational State Transfer가 그 뜻이다. 클라이언트는 자원의 표현을 받아 바꾸어 돌려주고, 서버는 그 사이를 기억하지 않는다. 셋째, **성숙도는 HTTP를 얼마나 쓰는가의 눈금이고, 그 끝은 링크다.** 주소 하나에 POST만 쓰는 0단계부터 응답이 다음 행동의 주소를 담는 3단계까지. 이 PC에서 공개 SOAP 계산기와 GitHub API에 실제로 보낸 요청으로 두 끝을 봤다.

---

## 1. REST의 탄생 배경

```text
SOAP/WSDL       →       REST
(XML 기반)          (HTTP 기반)
    │                   │
    ▼                   ▼
 엄격한 규칙         유연한 구조
 복잡한 명세         단순 인터페이스
```

| 구분 | SOAP/WSDL | REST | 왜 갈렸나 |
|:-----|:----------|:-----|:---------|
| HTTP의 자리 | 봉투. POST 하나로 다 보낸다 | 인터페이스. 메서드와 코드를 그대로 쓴다 | 첫째 원리 |
| 계약 | WSDL로 형식을 못 박는다 | 주소와 표현. 문서는 따로 | 기업 간 통합은 계약이, 웹은 유연함이 먼저였다 |
| 학습 | 규격이 두껍다 | HTTP를 알면 된다 | 브라우저에서 바로 부를 수 있다 |
| 적합한 곳 | 기업 내부, 은행 간 연동 | 웹, 모바일, 공개 API | 클라이언트가 누구인지 모를수록 REST |

2000년 로이 필딩이 박사 논문에서 웹이 왜 잘 돌아가는지를 제약 조건들로 정리하고 REST라 이름 붙였다. 같은 해 SOAP 1.1도 나왔다. 둘은 경쟁했고, 웹과 모바일이 커지면서 REST가 공개 API의 표준 모양이 됐다. 이유는 첫째 원리다. 이 PC에서 공개 SOAP 계산기 서비스에 2 더하기 3을 물었다.

```http
POST /calculator.asmx HTTP/1.1
Content-Type: text/xml
SOAPAction: http://tempuri.org/Add

<soap:Envelope ...><soap:Body>
  <Add><intA>2</intA><intB>3</intB>
  </Add></soap:Body></soap:Envelope>
```

```xml
<AddResult>5</AddResult>
```

답은 맞게 왔지만 모양을 보자. 주소는 `/calculator.asmx` 하나이고, 무엇을 하는지는 헤더의 `SOAPAction`과 본문 XML 안에 있다. 메서드는 항상 POST라 [HTTP 03](../../../network/http/03-http-methods)장의 약속(안전, 멱등, 캐시)을 하나도 쓸 수 없고, 같은 주소에 GET으로 `?intA=2&intB=3`을 붙여 부르면 "요청 형식을 알 수 없다"는 HTML이 온다. 계약은 `?WSDL`로 받는 별도의 XML 문서다. HTTP 위에 있지만 HTTP를 쓰지 않는 것이다.

---

## 2. REST 기본 철학

```text
┌──────────────────────────────┐
│       REST 4대 원칙          │
├──────────────────────────────┤
│ 1. 리소스는 URI로 식별       │
│ 2. 표현은 JSON, XML 등 다양  │
│ 3. HTTP 표준 메소드로 조작   │
│ 4. 서버는 상태 저장 안함     │
└──────────────────────────────┘
```

이 자료가 요약한 네 원칙이다. 필딩의 원문은 제약 조건 여섯이고, 위의 넷은 그중 균일 인터페이스와 무상태를 풀어 쓴 것이다.

| 제약 | 뜻 | 왜 |
|:-----|:---|:---|
| 클라이언트-서버 | 역할을 나눈다 | 서로 모른 채 따로 발전한다. [HTTP 02](../../../network/http/02-http-basics)장 |
| 무상태 | 요청 하나가 완결이다 | 아래 표 |
| 캐시 가능 | 답마다 저장해도 되는지를 밝힌다 | 요청을 없애는 가장 싼 방법. [HTTP 05](../../../network/http/05-http-headers)장 |
| 균일 인터페이스 | 자원은 주소로, 조작은 표현으로, 메시지는 자기를 설명하고, 다음 행동은 링크로 | 모든 서비스가 같은 방식이라 범용 클라이언트가 가능하다 |
| 계층화 | 사이에 프록시, 게이트웨이, CDN이 끼어도 된다 | 클라이언트는 상대가 원 서버인지 모른다 |
| 코드 온 디맨드(선택) | 서버가 코드를 내려보낼 수 있다 | 브라우저의 JS |

둘째 원리가 균일 인터페이스의 넷이다. `/users/kjw1995`라는 주소가 자원을 가리키고, 클라이언트는 그 자원 자체가 아니라 JSON이라는 **표현**을 받는다. 바꾸고 싶으면 바뀐 표현을 PUT으로 돌려보낸다. 상태(state)는 서버의 자원에 있고, 그것이 표현(representation)에 실려 양쪽을 오간다(transfer). 서버는 이 대화를 기억하지 않는다.

| 무상태의 이득 | 뜻 | 왜 |
|:------------|:---|:---|
| 가시성 | 요청 하나만 보면 맥락이 다 있다 | 로그 한 줄로 재현된다. 모니터링과 디버깅이 쉽다 |
| 신뢰성 | 서버가 죽어도 잃을 상태가 없다 | 다음 요청이 다시 다 말한다 |
| 확장성 | 서버를 늘리면 처리량이 는다 | 어느 서버가 받아도 같으니 부하 분산기가 아무 데나 던진다 |

{{< callout type="info" >}}
무상태가 REST 확장성의 뿌리다. 로그인처럼 이어져야 하는 것은 **클라이언트가 토큰이나 쿠키로 들고 다니게** 하고, 서버는 요청 안의 것만 보고 판단한다. 대가는 요청이 커지는 것이다. 그 토큰의 모양은 [03](../03-security)장에서 본다.
{{< /callout >}}

---

## 3. 리차드슨 성숙도 모델 (RMM)

```text
Level 3: HATEOAS
    ↑  (하이퍼미디어 링크)
Level 2: HTTP Verbs
    ↑  (GET/POST/PUT/DELETE)
Level 1: Resources
    ↑  (URI로 리소스 구분)
Level 0: POX
       (단순 HTTP 전송)
```

셋째 원리의 눈금이다. 레너드 리처드슨이 2008년에 제안한 이 사다리는 "HTTP를 얼마나 쓰는가"를 네 칸으로 나눈다. 한 칸 오를 때마다 HTTP의 것을 하나씩 더 쓴다.

### Level 0: 주소 하나, POST 하나

1절의 SOAP 계산기가 그대로 이것이다. 주소는 `/calculator.asmx` 하나, 메서드는 POST 하나, 무엇을 할지는 본문의 XML이 말한다. HTTP는 터널일 뿐이다. 캐시도 멱등도 상태 코드도 없이, 성공했는지조차 본문을 열어 봐야 안다.

### Level 1: 자원마다 주소

```http
POST /api/users/123 HTTP/1.1
```

자원을 주소로 가른다. 사용자 123과 124가 다른 주소를 갖는다. 그러나 행위는 여전히 POST 하나와 본문이 말하므로, 프록시는 이것이 읽기인지 쓰기인지 모른다.

### Level 2: HTTP 메서드

```http
GET    /api/users/123    # 조회
POST   /api/users        # 생성
PUT    /api/users/123    # 수정
DELETE /api/users/123    # 삭제
```

행위를 메서드로 옮긴다. 여기서부터 [HTTP 03](../../../network/http/03-http-methods)장의 약속이 전부 살아난다. GET은 캐시되고, PUT과 DELETE는 재시도해도 되고, 결과는 상태 코드로 온다. 실무의 REST API 대부분이 이 칸이다.

### Level 3: HATEOAS

```json
{
  "login": "kjw1995",
  "url": ".../users/kjw1995",
  "repos_url":
    ".../users/kjw1995/repos",
  "followers_url":
    ".../users/kjw1995/followers"
}
```

응답이 **다음에 갈 수 있는 곳의 주소**를 담는다. 이 PC에서 GitHub API에 `/users/kjw1995`를 물으면 사용자 정보와 함께 저장소 목록, 팔로워 목록의 주소가 온다. 클라이언트는 `/users/kjw1995/repos`라는 규칙을 외워 주소를 조립하는 대신 받은 링크를 따라간다. 이름의 HATEOAS(Hypermedia As The Engine Of Application State)가 "다음 행동은 하이퍼미디어가 이끈다"는 뜻이고, 웹 페이지의 링크를 API에 옮긴 것이다. GitHub API의 뿌리 주소 `https://api.github.com/`은 아예 주소 목록만 돌려준다. 저장소의 커밋 목록을 두 개씩 물으면 `Link` 헤더에 `rel="next"`와 `rel="last"`로 다음 쪽과 마지막 쪽의 주소가 온다. 자세한 것은 [05](../05-advanced)장 5절에서 본다.

---

## 4. HTTP 메소드 특성

| 메소드 | 안전 | 멱등 | 뜻 | 왜 |
|:-------|:----:|:----:|:---|:---|
| GET | O | O | 조회 | 바꾸지 않으니 캐시해도, 다시 보내도 된다 |
| HEAD | O | O | 헤더만 | 본문 없는 GET |
| POST | X | X | 생성, 처리 | 부를 때마다 새로 생긴다 |
| PUT | X | O | 통째로 바꾼다 | 같은 것으로 두 번 덮어도 하나 |
| PATCH | X | △ | 일부만 | 연산이 정한다 |
| DELETE | X | O | 지운다 | 없는 것은 두 번 없앨 수 없다 |

REST 설계가 HTTP 메서드를 그대로 쓰는 이유가 이 표다. 안전과 멱등은 규격이 한 **약속**이라, API를 이 표대로 만들면 클라이언트와 중간 장비가 그 약속에 기대 캐시하고 재시도한다. 반대로 GET으로 지우는 API를 만들면 크롤러가 지나가며 데이터를 지운다. 성질의 뜻과 근거는 [HTTP 03](../../../network/http/03-http-methods)장 10절에서 봤다.

---

## 5. RESTful URI 설계

```text
[좋은 예]
/v1/users
/v1/users/123
/v1/users/123/orders
/v1/users/123/orders/456

[나쁜 예]
/v1/getUsers
/v1/user?id=123
/v1/getUserOrders?userId=123
/v1/deleteOrder?id=456
```

| 규칙 | 예 | 왜 |
|:-----|:---|:---|
| 명사로 | `/users` | 행위는 메서드가 말한다. 주소에 동사가 있으면 같은 자원에 주소가 넷 |
| 복수형 | `/users`, `/orders` | 컬렉션과 그 안의 하나가 `/users`와 `/users/123`으로 자연히 이어진다 |
| 계층은 슬래시 | `/users/123/orders` | 소유 관계가 주소에 보인다 |
| 소문자 | `/api/users` | 주소의 경로는 대소문자를 가린다. 섞이면 404의 원인 |
| 단어 사이는 하이픈 | `/user-profiles` | 밑줄은 링크 밑줄에 가려 안 보인다 |

둘째 원리를 주소에 적용한 것이다. 나쁜 예의 `/v1/getUsers`는 주소가 행위를 말하고, `/v1/deleteOrder?id=456`은 GET으로 지우게 생겼다. 이 PC에서 부른 GitHub API가 좋은 예의 실물이다. `/users/kjw1995`, `/users/kjw1995/repos`, `/repos/kjw1995/95jw_archive/commits`. 전부 명사이고 복수형이고 계층이며, 행위는 메서드에 있다.

```text
GET    /v1/books              # 목록
GET    /v1/books/978-1234     # 하나
POST   /v1/books              # 등록
PUT    /v1/books/978-1234     # 통째로
PATCH  /v1/books/978-1234     # 일부
DELETE /v1/books/978-1234     # 삭제
GET    /v1/users/123/books    # 대출 중
```

도서관 API를 이 규칙으로 설계하면 주소는 `/books`, `/books/{isbn}`, `/users/{id}/books` 셋뿐이고 일곱 기능은 메서드가 가른다. 주소를 뭘로 할지의 패턴(컬렉션, 스토어, 컨트롤러)은 [02](../02-resource-design)장 1절에서 본다.

---

## 6. HTTP 메소드 상세

### GET - 리소스 조회

```http
GET /v1/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
```

```json
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com"
}
```

`Accept`가 바라는 표현을 말하고, 200과 함께 JSON 표현이 온다. 둘째 원리의 "표현으로 받는다"가 이것이다.

### POST - 리소스 생성

```http
POST /v1/users HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

```http
HTTP/1.1 201 Created
Location: /v1/users/124
```

컬렉션에 맡기면 서버가 번호를 정하고, 새 자원의 주소를 `Location`으로 돌려준다([HTTP 04](../../../network/http/04-http-status-codes)장). 응답 본문에 만들어진 표현을 같이 주면 클라이언트가 다시 GET하지 않아도 된다.

### PUT vs POST

| 특성 | POST | PUT | 왜 |
|:-----|:-----|:----|:---|
| 주소 | 서버가 정한다 | 클라이언트가 안다 | 번호를 누가 매기느냐 |
| 멱등 | X | O | 두 번 맡기면 둘, 두 번 덮으면 하나 |
| 용도 | 생성, 처리 | 생성 또는 통째로 교체 | 주소를 아는 쪽이 PUT |

```http
# POST: 서버가 ID 생성
POST /v1/users
→ 201 Created, Location: /v1/users/124

# PUT: 클라이언트가 ID 지정
PUT /v1/users/124
→ 201 Created (없으면 생성)
→ 200 OK     (있으면 교체)
```

### PUT vs PATCH

```http
# PUT: 전체 교체 (모든 필드 필요)
PUT /v1/users/123
{
  "name": "John Updated",
  "email": "john@example.com",
  "age": 30,
  "address": "Seoul"
}

# PATCH: 부분 수정 (변경 필드만)
PATCH /v1/users/123
{
  "name": "John Updated"
}
```

{{< callout type="warning" >}}
PUT으로 일부만 보내면 **보내지 않은 필드가 null로 덮이는** 사고가 흔하다. 규격상 PUT은 통째로 바꾸는 것이라 서버가 그렇게 구현하는 것이 맞다. 일부만 고치려면 PATCH를 쓰거나, PUT을 쓸 때는 받은 표현 전체를 고쳐 그대로 올린다. PATCH의 형식(Merge Patch, JSON Patch)은 [04](../04-performance)장 8절에서 본다.
{{< /callout >}}

---

## 7. API 테스트

```bash
# GET
curl \
  https://api.github.com/users/kjw1995

# 응답 헤더까지
curl -i https://api.github.com/

# 헤더 붙이기
curl -H "Accept: application/json" \
  https://api.github.com/

# POST (JSON 본문은 파일로)
curl -X POST \
  -H "Content-Type: application/json" \
  -d @user.json \
  https://api.example.com/v1/users

# DELETE
curl -X DELETE \
  https://api.example.com/v1/users/123
```

| 옵션 | 뜻 | 왜 쓰나 |
|:-----|:---|:-------|
| `-X` | 메서드 | 기본은 GET, `-d`가 있으면 POST |
| `-H` | 헤더 추가 | `Accept`, `Authorization`, `Content-Type` |
| `-d` | 본문 | `@파일`로 주면 따옴표 지옥을 피한다 |
| `-i` | 응답 헤더 포함 | 상태 코드와 `Location`, `Link`를 봐야 할 때 |
| `-v` | 요청과 응답 전부 | 무엇이 실제로 나갔는지 |
| `-s` | 진행 표시 끄기 | 스크립트에서 |

첫째 원리의 값이 여기서 드러난다. REST API는 브라우저 주소창이나 curl로 바로 부를 수 있다. 이 PC에서 첫 명령 그대로 GitHub API를 부르면 3절의 JSON이 오고, `-i`를 붙이면 `200 OK`, `Content-Type: application/json`, `Cache-Control: public, max-age=60`, 약한 `ETag`, 남은 호출 수 `X-RateLimit-Remaining`이 함께 온다. HTTP 시리즈에서 본 헤더 그대로다. SOAP였다면 봉투를 만들 도구부터 필요했을 것이다.

---

## 8. 설계 베스트 프랙티스

| 주소 | 권장 | 왜 |
|:-----|:-----|:---|
| 행위 | 명사 + 메서드 | 4절의 약속을 쓰려고 |
| 하위 자원 | 주소의 계층 | `/users/123/orders` |
| 필터와 검색 | 쿼리 파라미터 | 주소는 자원, 조건은 쿼리. 캐시 키에 같이 들어간다 |
| 버전 | `/v1/`처럼 주소에 | 가장 눈에 띈다. 헤더로 하는 방식과의 비교는 [02](../02-resource-design)장 4절 |

| 응답 | 권장 | 왜 |
|:-----|:-----|:---|
| 형식 | JSON | 모든 언어가 읽고, 브라우저가 바로 파싱 |
| 필드 이름 | camelCase나 snake_case 하나로 | 섞이면 클라이언트가 두 벌을 짠다 |
| 개수 | `/users/count` 같은 자원 | 목록을 다 받아 세지 않게 |
| 크기 | 필요한 것은 한 번에 | 요청 수가 곧 지연이다 |
| 페이지 | `?page=2&limit=20` | 목록은 끝이 없다. [05](../05-advanced)장 3절 |
| 필드 선택 | `?fields=id,name` | 모바일이 필요한 것만 받게 |

```http
GET /v1/users?status=active&role=admin
GET /v1/users?sort=created_at&order=desc
GET /v1/users?page=2&limit=20
GET /v1/users?fields=id,name,email
GET /v1/users?q=john
```

쿼리 파라미터는 **같은 자원을 보는 조건**이다. `/users`는 자원이고 `?status=active`는 그중 어느 것을, `?sort=`는 어떤 순서로, `?page=`는 어느 쪽을, `?fields=`는 어떤 필드만 보겠다는 말이다. 조건이 주소에 있어야 그 답을 "그 주소의 답"으로 캐시할 수 있고 남에게 링크로 줄 수 있다. 여러 조건은 `&`로 이어 붙이면 된다. GitHub API의 커밋 목록도 `?per_page=2&page=2`로 쪽을 넘긴다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| REST | HTTP를 인터페이스로 쓰는 설계 스타일 | 메서드, 코드, 캐시를 그대로 쓴다 |
| SOAP | HTTP를 봉투로 쓴다 | POST 하나, 본문이 전부. 계산기가 그랬다 |
| 여섯 제약 | 클라이언트-서버, 무상태, 캐시, 균일 인터페이스, 계층화, 코드 온 디맨드 | 웹이 잘 돌아가는 이유를 적은 것 |
| 표현 | 자원의 지금 모양. JSON 등 | 상태는 표현에 실려 옮겨 다닌다 |
| 무상태 | 요청 하나가 완결 | 가시성, 신뢰성, 확장성 |
| RMM | 0 주소 하나, 1 자원마다 주소, 2 메서드, 3 링크 | HTTP를 얼마나 쓰는가 |
| HATEOAS | 응답이 다음 주소를 담는다 | 클라이언트가 주소를 조립하지 않는다 |
| 안전과 멱등 | GET·HEAD / PUT·DELETE | 캐시와 재시도의 근거 |
| URI | 명사, 복수, 계층, 소문자, 하이픈 | 행위는 메서드가 |
| 쿼리 | 같은 자원을 보는 조건 | 캐시 키에 들어간다 |

{{< callout type="info" >}}
**용어 정리**
- **REST**: Representational State Transfer. 자원의 표현을 주고받아 상태를 옮기는 설계 스타일
- **리소스**: 주소로 식별되는 대상. 사용자, 주문, 저장소
- **표현**: 자원을 메시지에 실은 모양. JSON, XML
- **무상태**: 서버가 앞 요청을 기억하지 않는 성질
- **균일 인터페이스**: 자원은 주소로, 조작은 표현으로, 메시지는 자기 설명, 다음 행동은 링크로
- **안전 / 멱등**: 자원을 안 바꾼다 / 여러 번이 한 번과 같다
- **HATEOAS**: 응답의 링크가 다음 행동을 이끄는 제약
- **RMM**: 리처드슨 성숙도 모델. 0~3단계
- **SOAP / WSDL**: XML 봉투 규약 / 그 계약을 적는 XML 문서
{{< /callout >}}
