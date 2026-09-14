---
title: "03. HTTP 메서드"
date: 2025-12-27
weight: 3
---

[02. HTTP 기본](../02-http-basics)에서 요청의 첫 줄은 메서드, 대상, 버전이고 서버는 첫 단어에서 읽기인지 쓰기인지를 안다고 했다. 이 장은 그 첫 단어의 이야기다. 원리는 셋이다. 첫째, **URI는 명사이고 메서드는 동사다.** 무엇에 대해서인지는 주소가, 무엇을 할지는 메서드가 말한다. 행위를 주소에서 빼면 같은 자원에 대한 여러 행위가 한 주소로 모이고, 서버와 프록시와 캐시가 첫 단어만 보고 그 요청의 성질을 안다. 둘째, **메서드의 성질은 규격이 한 약속이다.** GET은 아무것도 바꾸지 않고, PUT과 DELETE는 여러 번 해도 한 번과 같고, GET의 답은 저장해 둬도 된다. 이 약속이 있어서 브라우저는 끊긴 GET을 말없이 다시 보내고, 캐시는 답을 저장하고, 링크 미리보기 봇은 마음 놓고 GET을 뿌린다. 셋째, **약속을 지키는 것은 서버다.** 규격은 강제하지 않으므로 GET으로 삭제하는 서버를 만들 수도 있고, 그러면 둘째 원리에 기댄 모든 것이 사고가 된다. 설계 규칙과 Idempotency-Key 같은 보완이 여기서 나온다. 이 PC에서 example.com과 GitHub API와 로컬의 jwebserver에 메서드를 바꿔 가며 보내 본 답을 실었다.

---

## 1. 리소스와 행위의 분리

```text
동사를 URI에        리소스 + 메서드
/read-members       GET    /members
/read-member        GET    /members/1
/create-member      POST   /members
/update-member      PUT    /members/1
/delete-member      DELETE /members/1
```

| 설계 | 주소가 말하는 것 | 왜 나쁜가 / 좋은가 |
|:-----|:---------------|:-----------------|
| 동사를 URI에 | 행위 | 회원 하나에 주소가 넷. 캐시와 프록시는 어느 것이 읽기인지 모른다 |
| 리소스 + 메서드 | 자원 | 주소는 하나, 행위는 첫 단어. GET이면 저장해도 되고 다시 보내도 된다 |

첫째 원리다. 왼쪽처럼 만들면 `/read-member`가 읽기라는 것을 아는 것은 그 서버를 만든 사람뿐이다. 오른쪽처럼 만들면 `GET /members/1`이 읽기라는 것을 세상의 모든 브라우저와 프록시와 캐시가 안다. 규격이 GET의 뜻을 정해 두었기 때문이다. 좋은 URI 설계는 그래서 자원을 **명사**로 식별하는 데 집중하고, 행위는 메서드에 맡긴다. URI 설계 규칙 자체는 [REST API 설계 01](../../../architecture/restful/01-basics)장에서 본다.

---

## 2. 주요 메서드 요약

| 메서드 | 역할 | 본문 | 안전 | 멱등 | 캐시 | 왜 이런 성질인가 |
|:-------|:-----|:-----|:-----|:-----|:-----|:---------------|
| GET | 조회 | X | O | O | O | 읽기만 하니 바꾸지 않고, 여러 번 해도 같고, 저장해도 된다 |
| HEAD | 헤더만 조회 | X | O | O | O | 본문 없는 GET |
| POST | 처리, 등록 | O | X | X | △ | 서버가 무엇이든 할 수 있다. 두 번 하면 둘이 생긴다 |
| PUT | 통째로 대체 | O | X | O | X | 같은 것으로 두 번 덮어도 결과는 하나 |
| PATCH | 일부 수정 | O | X | △ | X | "1 더하기"면 두 번이 다르다 |
| DELETE | 삭제 | △ | X | O | X | 두 번 지워도 없는 것은 없다 |
| OPTIONS | 되는 메서드 묻기 | X | O | O | X | 묻기만 한다 |
| CONNECT | 터널 | - | - | - | X | 프록시에 "저기로 이어 달라" |
| TRACE | 요청을 되돌려 받기 | X | O | O | X | 디버그용. 보안상 대개 꺼 둔다 |

둘째 원리의 표다. 성질 셋의 뜻은 10절에서 보고, 여기서는 표의 뼈대만 잡는다. 안전하면 멱등이고, 멱등이어도 안전하지 않을 수 있으며(PUT, DELETE), 캐시는 안전한 것 중에서도 GET과 HEAD에서만 실제로 쓴다. 서버가 어느 메서드를 받는지는 서버가 정한다. 이 PC에서 example.com에 POST, DELETE, OPTIONS를 보내면 전부 `405 Method Not Allowed`가 오고, GET의 응답에는 `Allow: GET, HEAD`가 붙어 있다. 문서 하나를 주는 서버는 읽기 둘만 받는다.

---

## 3. GET

```http
GET /members/100?fields=name HTTP/1.1
Host: api.example.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"id":100,"name":"홍길동","age":30}
```

자원을 읽는다. 서버에 전할 조건은 **쿼리 파라미터**에 싣는다. 조건이 주소에 들어 있어야 "그 주소의 답"으로 캐시할 수 있고, 주소를 복사해 남에게 줄 수 있고, 브라우저 기록에 남기 때문이다. 본문에 조건을 넣은 GET은 규격상 금지는 아니지만 뜻이 없고, 프록시와 캐시가 본문을 버릴 수 있다.

```java
@GetMapping
public List<Member> list(
        @RequestParam(required=false)
        String name,
        @RequestParam(defaultValue="0")
        int page) {
    return service.find(name, page);
}

@GetMapping("/{id}")
public ResponseEntity<Member> get(
        @PathVariable Long id) {
    return service.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity
            .notFound().build());
}
```

{{< callout type="warning" >}}
GET은 본문을 실을 수는 있어도 **본문에 뜻을 두면 안 된다.** 검색 조건이 URL에 담기 어려울 만큼 길거나 비밀이면 `POST /search`로 바꾼다. 대신 그 답은 캐시되지 않고 다시 보내도 안전하다는 보장도 없어진다. 셋째 원리의 값이다.
{{< /callout >}}

---

## 4. HEAD

```http
HEAD /H2.java HTTP/1.1
Host: 127.0.0.1:8765
```

```http
HTTP/1.1 200 OK
Content-type: text/plain
Content-length: 821
```

GET과 같되 **본문을 빼고 헤더만** 준다. 이 PC의 jwebserver에 821바이트짜리 파일을 HEAD로 물으면 `Content-length: 821`까지만 오고 본문은 오지 않는다. 내려받기 전에 크기를 알고 싶을 때, 링크가 살아 있는지 확인할 때, 캐시가 아직 유효한지 볼 때 본문 값을 치르지 않기 위한 메서드다. example.com에 HEAD를 보내도 GET과 같은 머리(`Allow`, `Age`, `cf-cache-status`)가 본문 없이 온다.

---

## 5. POST

```http
POST /members HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"name":"홍길동","age":30}
```

```http
HTTP/1.1 201 Created
Location: /members/100
Content-Type: application/json

{"id":100,"name":"홍길동","age":30}
```

본문을 서버에 주고 **처리하라**고 한다. 무엇을 할지는 자원이 정하므로 규격이 POST에 준 뜻은 "이 자원에 이것을 맡긴다"뿐이다. 등록이 대표이고, 새로 생긴 자원의 주소를 `Location`으로 돌려주며 201로 답한다([04](../04-http-status-codes)장). 아무것이나 할 수 있다는 것이 POST의 힘이고, 그래서 안전하지도 멱등하지도 않다. 브라우저가 POST 결과 페이지에서 새로고침을 누르면 "다시 제출하시겠습니까"를 묻는 이유가 이것이다.

```java
@PostMapping
public ResponseEntity<Member> create(
        @RequestBody @Valid
        MemberRequest req) {
    Member saved = service.save(req);
    URI loc = URI.create(
        "/api/members/" + saved.id());
    return ResponseEntity
        .created(loc).body(saved);
}
```

| POST의 용법 | 예시 | 왜 POST인가 |
|:-----------|:-----|:----------|
| 새 자원 등록 | POST /members | 주소를 서버가 정한다 |
| 처리 실행 | POST /orders/{id}/payment | 결제는 조회도 대체도 아니다 |
| 상태 전이 | POST /articles/{id}/publish | 자원의 상태를 바꾸는 동작 |
| 대안 조회 | POST /search | 조건이 길거나 비밀이라 GET에 못 싣는다 |

---

## 6. PUT

```text
Before            PUT /members/100
{ "id": 100,      { "name": "김철수" }
  "name": "홍길동",
  "age": 30 }     After
                  { "id": 100,
                    "name": "김철수" }
                  age가 사라졌다
```

그 주소의 자원을 보낸 것으로 **통째로 바꾼다.** 없으면 만든다. POST와 다른 점은 주소를 **클라이언트가 안다**는 것이다. `PUT /members/100`은 "100번을 이것으로 하라"이고, 같은 것을 두 번 보내도 100번은 한 번 보낸 것과 같다. 그래서 멱등이다.

```java
@PutMapping("/{id}")
public Member replace(
        @PathVariable Long id,
        @RequestBody @Valid
        MemberRequest req) {
    // 보낸 것으로 통째로 덮는다
    Member m = req.toEntity(id);
    return service.save(m);
}
```

{{< callout type="warning" >}}
PUT은 부분 수정이 아니다. 이름만 담아 보내면 **나이는 사라지거나 기본값으로 덮인다.** 위 그림의 `age`가 그렇다. 일부만 고치려면 PATCH를 쓴다. 이것도 셋째 원리다. 규격은 PUT을 "통째로"로 정했고, 부분 수정처럼 구현한 서버는 클라이언트가 PUT에 기대한 것을 배신한다.
{{< /callout >}}

---

## 7. PATCH

```text
Before            PATCH /members/100
{ "id": 100,      { "name": "김철수" }
  "name": "홍길동",
  "age": 30 }     After
                  { "id": 100,
                    "name": "김철수",
                    "age": 30 }
                  age는 남는다
```

자원의 **일부만** 바꾼다. 같은 요청인데 PUT과 결과가 다른 것은 메서드가 "보낸 것으로 덮어라"가 아니라 "보낸 것만 고쳐라"이기 때문이다.

```java
@PatchMapping("/{id}")
public Member update(
        @PathVariable Long id,
        @RequestBody
        Map<String, Object> patch) {
    Member m = service.get(id);
    patch.forEach((k, v) -> {
        switch (k) {
            case "name" ->
                m.setName((String) v);
            case "age" ->
                m.setAge((Integer) v);
        }
    });
    return service.save(m);
}
```

| 방식 | Content-Type | 예시 | 왜 |
|:-----|:-------------|:-----|:---|
| Merge Patch (RFC 7396) | `application/merge-patch+json` | `{"name":"김"}` | 보낸 필드만 덮고 null이면 지운다. 단순하다 |
| JSON Patch (RFC 6902) | `application/json-patch+json` | `[{"op":"replace","path":"/name","value":"김"}]` | 연산을 나열한다. 배열 원소 하나도 고친다 |

PATCH가 멱등 △인 이유가 이 표에 있다. Merge Patch로 이름을 "김"으로 바꾸는 것은 두 번 해도 같지만, JSON Patch의 `add`로 배열에 원소를 넣는 것은 두 번 하면 둘이 들어간다. 성질은 메서드가 아니라 **보낸 연산**이 정한다.

---

## 8. DELETE

```http
DELETE /members/100 HTTP/1.1
Host: api.example.com
```

```http
HTTP/1.1 204 No Content
```

자원을 지운다. 돌려줄 것이 없으면 204로 답한다. 두 번 지워도 "100번은 없다"는 상태는 같으므로 멱등이다. 다만 두 번째의 답은 404일 수 있다. 멱등은 **자원의 최종 상태**가 같다는 뜻이지 응답이 같다는 뜻이 아니다.

```java
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(
        @PathVariable Long id) {
    if (!service.existsById(id)) {
        return ResponseEntity
            .notFound().build();
    }
    service.deleteById(id);
    return ResponseEntity
        .noContent().build();
}
```

---

## 9. OPTIONS / CONNECT / TRACE

| 메서드 | 용도 | 왜 있나 |
|:-------|:-----|:-------|
| OPTIONS | 되는 메서드 묻기, CORS **preflight** | 보내기 전에 "이 요청을 받아 주느냐"를 묻는다 |
| CONNECT | 프록시에 터널 열기 | HTTPS는 프록시가 안을 못 보므로 선만 이어 달라고 |
| TRACE | 보낸 요청을 그대로 되돌려 받기 | 중간에서 헤더가 어떻게 바뀌는지 본다. 쿠키가 새어 대개 꺼 둔다 |

이 PC에서 example.com에 TRACE를 보내면 `405 Not Allowed`가 온다. 이유 문구가 다른 메서드의 `Method Not Allowed`와 다른데, [02](../02-http-basics)장에서 본 대로 이유 문구는 사람용이라 서버 마음이다. 프로그램은 405만 본다.

### CORS Preflight 예시

```http
OPTIONS / HTTP/1.1
Host: api.github.com
Origin: https://app.example.com
Access-Control-Request-Method: POST
```

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST
Access-Control-Max-Age: 86400
```

브라우저는 다른 출처(origin)의 서버에 POST처럼 부작용이 있는 요청을 보내기 전에, OPTIONS로 "이 출처에서 이 메서드와 이 헤더를 보내도 되느냐"를 먼저 묻는다. 이 PC에서 GitHub API에 그렇게 물으니 204와 함께 허용 메서드(GET, POST, PATCH, PUT, DELETE), 허용 헤더(`Authorization` 포함), 그리고 `Max-Age: 86400`이 왔다. 하루 동안은 다시 묻지 않아도 된다는 뜻이다. 서버가 아니라 **브라우저**가 이 절차를 강제하므로 curl은 묻지 않고 바로 보낸다. 헤더의 뜻은 [05](../05-http-headers)장 14절에서 본다.

---

## 10. 메서드 속성

### 안전 (Safe)

| 안전 | 안전하지 않음 | 왜 나누나 |
|:-----|:-------------|:---------|
| GET, HEAD, OPTIONS, TRACE | POST, PUT, PATCH, DELETE | 안전한 요청은 누가 언제 몇 번 보내도 세상이 안 바뀐다 |

호출해도 **자원이 바뀌지 않는다**는 약속이다. 이 약속 위에 검색 엔진의 크롤러, 링크 미리보기, 브라우저의 미리 읽기가 서 있다. 서버 로그가 남는 것은 상관없다. 클라이언트가 책임질 부작용이 없다는 뜻이다.

### 멱등 (Idempotent)

| 메서드 | 멱등 | 왜 |
|:-------|:-----|:---|
| GET | O | 바꾸지 않는다 |
| PUT | O | 같은 값으로 덮는다 |
| DELETE | O | 없는 것은 두 번 없앨 수 없다 |
| POST | X | 부를 때마다 새로 생긴다 |
| PATCH | △ | 7절. 연산이 정한다 |

```text
POST /members
  → 매 호출마다 새 회원 생성 (멱등 X)
PUT /members/100 {...}
  → 언제 봐도 동일 상태 (멱등 O)
```

여러 번 해도 **최종 상태가 한 번과 같다.** 이 약속이 실무에서 가장 값진 이유는 **재시도**다. 요청을 보냈는데 답이 안 왔을 때, 서버가 못 받은 것인지 답만 잃은 것인지 클라이언트는 알 수 없다. 멱등한 요청이면 그냥 다시 보내면 되고, 아니면 보내면 안 된다. 브라우저와 HTTP 라이브러리가 끊긴 GET은 조용히 다시 보내고 POST는 묻는 이유다.

{{< callout type="info" >}}
결제처럼 **두 번 처리되면 안 되는 POST**는 클라이언트가 만든 고유 키를 `Idempotency-Key` 헤더에 실어 보낸다. 서버는 그 키로 이미 처리한 요청이면 저장해 둔 답을 그대로 돌려준다. 멱등하지 않은 메서드를 설계로 멱등하게 만든 것이고, 셋째 원리의 보완책이다. 결제 API들이 먼저 썼고 IETF에서 표준화하고 있다.
{{< /callout >}}

### 캐시 가능 (Cacheable)

| 메서드 | 캐시 | 왜 |
|:-------|:-----|:---|
| GET, HEAD | O | 같은 주소의 같은 답. 실무의 캐시는 사실상 전부 |
| POST, PATCH | 이론상 가능 | 답에 명시적 유효 기간이 있어야 하고, 거의 안 쓴다 |
| PUT, DELETE | X | 답을 저장할 뜻이 없다 |

답을 저장했다가 다음 같은 요청에 다시 쓸 수 있다는 약속이다. 첫째 원리와 만나는 곳이다. 조건이 주소에 있는 GET이라야 "이 주소의 답"으로 저장할 수 있다. 저장의 규칙은 [05](../05-http-headers)장에서 본다.

---

## 11. 클라이언트 → 서버 데이터 전송

| 방식 | 메서드 | 쓰이는 곳 | 왜 |
|:-----|:-------|:---------|:---|
| 쿼리 파라미터 | GET | 검색, 필터, 정렬 | 조건이 주소에 남아 캐시와 공유가 된다 |
| 본문 JSON | POST, PUT, PATCH | API | 구조 있는 데이터. `Content-Type`이 형식을 말한다 |
| 폼 (x-www-form-urlencoded) | POST | HTML 폼 | 쿼리 문자열과 같은 모양을 본문에 넣는다 |
| 멀티파트 (multipart/form-data) | POST | 파일 업로드 | 파일과 글자를 경계선으로 나눠 한 본문에 |

```text
① 정적 조회   GET  /static/logo.png
② 검색·필터   GET  /search?q=hello
③ HTML 폼     POST /login (폼 인코딩)
④ 파일 업로드  POST /upload (멀티파트)
⑤ REST API    POST /api/members (JSON)
```

HTML 폼이 GET과 POST만 보낼 수 있다는 것이 아래 12절의 컨트롤 URI가 필요한 이유 중 하나다. 본문의 형식을 어떻게 고르고 협상하는지는 [05](../05-http-headers)장 3절에서 본다.

---

## 12. API 설계 패턴

### 컬렉션 (Collection) - POST 기반

```http
POST /members
→ HTTP/1.1 201 Created
  Location: /members/100
```

서버가 주소를 만든다. 클라이언트는 `/members`에 맡기고 `Location`으로 새 주소를 받는다. 번호를 서버가 매기므로 충돌이 없고, 대부분의 REST API가 이 모양이다.

### 스토어 (Store) - PUT 기반

```http
PUT /files/report.pdf
→ HTTP/1.1 200 OK
```

클라이언트가 주소를 정한다. 파일 이름처럼 클라이언트가 이미 아는 것이 주소일 때 쓴다. 같은 것을 두 번 올려도 하나이므로 PUT의 멱등이 그대로 맞는다.

### 컨트롤 URI

```text
POST /orders/{id}/cancel
POST /articles/{id}/publish
POST /members/{id}/delete
```

메서드 넷으로 표현할 수 없는 동작은 동사를 주소에 넣어 보완한다. 취소와 발행은 조회도 대체도 삭제도 아니다. 마지막 줄은 HTML 폼이 DELETE를 못 보내서 생긴 우회다. 첫째 원리의 예외이므로 남발하면 주소마다 동사가 붙는 RPC가 되고, 둘째 원리의 약속을 아무것도 쓸 수 없게 된다. 자원 패턴은 [REST API 설계 02](../../../architecture/restful/02-resource-design)장에서 본다.

---

## 13. 회원 관리 RESTful 예시

| 기능 | 메서드 | URI | 왜 |
|:-----|:-------|:----|:---|
| 목록 | GET | /members | 읽기. 캐시된다 |
| 등록 | POST | /members | 주소는 서버가 정한다 |
| 조회 | GET | /members/{id} | 읽기 |
| 전체 수정 | PUT | /members/{id} | 클라이언트가 주소를 안다. 통째로 |
| 부분 수정 | PATCH | /members/{id} | 보낸 것만 |
| 삭제 | DELETE | /members/{id} | 두 번 해도 같다 |

주소는 `/members`와 `/members/{id}` 둘뿐이고 여섯 기능은 메서드가 가른다. 3~8절의 코드가 이 표의 행 하나씩이다. 이 PC의 jwebserver는 이 중 GET과 HEAD만 구현한 서버라, POST와 DELETE를 보내면 `405 Method Not Allowed`에 `Allow: HEAD, GET`을 붙여 돌려준다. 못 하는 것을 못 한다고 답하는 것도 둘째 원리를 지키는 방법이다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 명사와 동사 | 주소는 자원, 메서드는 행위 | 첫 단어만 보고 성질을 안다 |
| GET | 조회. 안전·멱등·캐시 | 조건은 주소에 |
| HEAD | 본문 없는 GET | 크기와 유효성만 |
| POST | 맡긴다. 등록이 대표 | 무엇이든 하니 아무 약속도 없다 |
| PUT | 통째로 대체. 멱등 | 클라이언트가 주소를 안다 |
| PATCH | 일부 수정. 멱등은 연산이 정한다 | 보낸 것만 고친다 |
| DELETE | 삭제. 멱등 | 없는 것은 두 번 없앨 수 없다 |
| OPTIONS | 되는지 묻기. CORS preflight | 브라우저가 강제한다 |
| 안전 | 세상이 안 바뀐다 | 크롤러와 미리 읽기의 근거 |
| 멱등 | 여러 번이 한 번과 같다 | 재시도의 근거 |
| Idempotency-Key | POST를 설계로 멱등하게 | 결제는 두 번이면 사고 |
| 405와 Allow | 못 하는 것을 못 한다고 | 약속을 지키는 또 다른 방법 |

{{< callout type="info" >}}
**용어 정리**
- **리소스**: 주소로 식별되는 자원. 명사
- **GET / HEAD / POST / PUT / PATCH / DELETE**: 조회 / 헤더만 / 처리 / 대체 / 부분 수정 / 삭제
- **OPTIONS / CONNECT / TRACE**: 되는 메서드 묻기 / 터널 / 요청 되돌려 받기
- **Safe**: 자원을 바꾸지 않는 성질
- **Idempotent**: 여러 번 해도 최종 상태가 같은 성질
- **Cacheable**: 답을 저장해 다시 쓸 수 있는 성질
- **Allow**: 서버가 이 자원에 받는 메서드 목록. 405와 함께 온다
- **Collection / Store**: 서버가 주소를 정하는 패턴 / 클라이언트가 정하는 패턴
- **Control URI**: 메서드로 못 담는 동작을 동사 주소로
- **Idempotency-Key**: 중복 처리를 막는 클라이언트 생성 키
- **CORS Preflight**: 다른 출처로 보내기 전 브라우저가 하는 OPTIONS 확인
{{< /callout >}}
