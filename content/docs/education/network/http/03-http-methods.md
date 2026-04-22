---
title: "03. HTTP 메서드"
weight: 3
---

## 1. 리소스와 행위의 분리

좋은 URI 설계는 **리소스(명사)** 를 식별하는 데 집중하고, **행위는 HTTP 메서드(동사)** 로 구분한다.

```text
❌ URI에 동사 섞기          ✅ 리소스 + 메서드
────────────────────────────────────────────
/read-members              GET    /members
/read-member               GET    /members/{id}
/create-member             POST   /members
/update-member             PUT    /members/{id}
/delete-member             DELETE /members/{id}
```

## 2. 주요 메서드 요약

| 메서드 | 역할 | 본문 | 안전 | 멱등 | 캐시 |
|:---|:---|:---|:---|:---|:---|
| GET | 리소스 조회 | X | O | O | O |
| HEAD | 헤더만 조회 | X | O | O | O |
| POST | 요청 처리, 등록 | O | X | X | △ |
| PUT | 완전 대체 | O | X | O | X |
| PATCH | 부분 수정 | O | X | △ | X |
| DELETE | 삭제 | △ | X | O | X |
| OPTIONS | 지원 메서드 조회 | X | O | O | X |
| CONNECT | 터널링 (프록시) | - | - | - | X |
| TRACE | 요청 에코 (디버그) | X | O | O | X |

## 3. GET

리소스를 조회한다. 전달할 데이터는 보통 **쿼리 파라미터**로 보낸다.

```http
GET /members/100?fields=name,age HTTP/1.1
Host: api.example.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"id":100,"name":"홍길동","age":30}
```

```java
@GetMapping
public List<Member> list(
        @RequestParam(required = false) String name,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size) {
    return memberService.findAll(name, page, size);
}

@GetMapping("/{id}")
public ResponseEntity<Member> get(@PathVariable Long id) {
    return memberService.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
```

{{< callout type="warning" >}}
GET은 본문을 포함할 수 있지만 **의미를 갖지 않으며** 프록시·캐시가 무시할 수 있다. 복잡한 검색 조건이 필요하면 `POST /search`로 전환한다.
{{< /callout >}}

## 4. HEAD

GET과 동일하지만 **응답 본문 없이 헤더만** 반환한다. 파일 크기 확인, 링크 유효성 점검, 캐시 확인 용도로 쓰인다.

```http
HEAD /files/report.pdf HTTP/1.1
Host: files.example.com
```

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 1048576
Last-Modified: Mon, 01 Apr 2026 12:00:00 GMT
```

## 5. POST

요청 데이터를 서버가 **처리**하도록 지시한다. 신규 리소스 등록이 대표적이지만, 그 외에도 다양한 용도로 쓰인다.

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

```java
@PostMapping
public ResponseEntity<Member> create(
        @RequestBody @Valid MemberRequest request) {
    Member saved = memberService.save(request.toEntity());
    URI location = URI.create("/api/members/" + saved.getId());
    return ResponseEntity.created(location).body(saved);
}
```

### POST의 4가지 용법

| 용도 | 예시 |
|:---|:---|
| 신규 리소스 등록 | POST /members |
| 프로세스 실행 | POST /orders/{id}/payment |
| 상태 전이 | POST /articles/{id}/publish |
| 대안 조회 | POST /search (긴 조건) |

## 6. PUT

지정한 URI에 리소스가 있으면 **완전히 대체**하고, 없으면 생성한다. 클라이언트가 **URI를 알고 있을 때** 쓴다.

```text
Before                 PUT /members/100
{                      { "name": "김철수" }
  "id":   100,         
  "name": "홍길동",    →  Result
  "age":  30           {
}                        "id":   100,
                         "name": "김철수"
                       }   ← age 필드 사라짐
```

```java
@PutMapping("/{id}")
public ResponseEntity<Member> replace(
        @PathVariable Long id,
        @RequestBody @Valid MemberRequest request) {
    Member member = request.toEntity();
    member.setId(id);
    return ResponseEntity.ok(memberService.save(member));
}
```

{{< callout type="warning" >}}
PUT은 부분 수정이 아니다. 일부 필드만 담아 보내면 **나머지가 사라지거나 기본값으로 덮인다**. 부분 수정이 목적이면 PATCH를 쓴다.
{{< /callout >}}

## 7. PATCH

리소스의 **일부 필드만** 변경한다.

```text
Before                 PATCH /members/100
{                      { "name": "김철수" }
  "id":   100,
  "name": "홍길동",    →  Result
  "age":  30           {
}                        "id":   100,
                         "name": "김철수",
                         "age":  30    ← 유지
                       }
```

```java
@PatchMapping("/{id}")
public ResponseEntity<Member> update(
        @PathVariable Long id,
        @RequestBody Map<String, Object> updates) {
    return memberService.findById(id)
        .map(member -> {
            updates.forEach((k, v) -> {
                switch (k) {
                    case "name" -> member.setName((String) v);
                    case "age"  -> member.setAge((Integer) v);
                }
            });
            return ResponseEntity.ok(memberService.save(member));
        })
        .orElse(ResponseEntity.notFound().build());
}
```

### JSON Merge Patch vs JSON Patch

| 방식 | Content-Type | 예시 |
|:---|:---|:---|
| Merge Patch | `application/merge-patch+json` | `{"name":"김"}` |
| JSON Patch | `application/json-patch+json` | `[{"op":"replace","path":"/name","value":"김"}]` |

## 8. DELETE

리소스를 삭제한다.

```http
DELETE /members/100 HTTP/1.1
Host: api.example.com
```

```http
HTTP/1.1 204 No Content
```

```java
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable Long id) {
    if (!memberService.existsById(id)) {
        return ResponseEntity.notFound().build();
    }
    memberService.deleteById(id);
    return ResponseEntity.noContent().build();
}
```

## 9. OPTIONS / CONNECT / TRACE

| 메서드 | 용도 |
|:---|:---|
| OPTIONS | 지원 메서드 조회, CORS **preflight** 요청 |
| CONNECT | 프록시에 터널 요청 (HTTPS 프록시) |
| TRACE | 요청 경로 추적 (디버그, 보안상 비활성) |

### CORS Preflight 예시

```http
OPTIONS /api/members HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization
```

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: Authorization
Access-Control-Max-Age: 3600
```

## 10. 메서드 속성

### 안전 (Safe)

호출해도 **리소스를 변경하지 않는다**.

| 안전 | 안전하지 않음 |
|:---|:---|
| GET, HEAD, OPTIONS, TRACE | POST, PUT, PATCH, DELETE |

### 멱등 (Idempotent)

여러 번 호출해도 **최종 결과가 같다**. 네트워크 오류 시 **재시도 가능 여부**를 판단하는 기준이다.

| 메서드 | 멱등성 | 근거 |
|:---|:---|:---|
| GET | O | 상태 변경 없음 |
| PUT | O | 같은 값으로 덮어쓰기 |
| DELETE | O | 이미 삭제된 상태 |
| POST | X | 호출마다 새 리소스 |
| PATCH | △ | 연산에 따라 다름 |

```text
POST /members            → 매 호출마다 새 회원 생성 (멱등 X)
PUT  /members/100 {...}  → 어느 시점에 봐도 동일 상태 (멱등 O)
```

{{< callout type="info" >}}
결제처럼 **중복 처리가 치명적**인 POST는 **Idempotency-Key** 헤더로 보완한다. 클라이언트가 UUID를 보내면 서버는 해당 키로 이미 처리한 요청의 응답을 재사용한다.
{{< /callout >}}

### 캐시 가능 (Cacheable)

응답을 저장했다가 다음 요청에 재사용할 수 있는 성질.

| 메서드 | 캐시 |
|:---|:---|
| GET, HEAD | O (실무의 대부분) |
| POST, PATCH | 이론적으로 가능하나 거의 안 씀 |
| PUT, DELETE | X |

## 11. 클라이언트 → 서버 데이터 전송

| 방식 | 메서드 | 쓰이는 상황 |
|:---|:---|:---|
| 쿼리 파라미터 | GET | 검색·필터·정렬 |
| 메시지 바디 (JSON) | POST, PUT, PATCH | API 등록·수정 |
| 폼 (x-www-form-urlencoded) | POST | 일반 HTML 폼 |
| 멀티파트 (multipart/form-data) | POST | 파일 업로드 |

```text
① 정적 조회     GET /static/logo.png
② 검색·필터     GET /search?q=hello&sort=date
③ HTML 폼       POST /login  (x-www-form-urlencoded)
④ 파일 업로드    POST /upload (multipart/form-data)
⑤ REST API      POST /api/members (application/json)
```

## 12. API 설계 패턴

### 컬렉션 (Collection) – POST 기반

서버가 URI를 생성한다. 일반적인 REST API 패턴.

```http
POST /members
→ HTTP/1.1 201 Created
  Location: /members/100
```

### 스토어 (Store) – PUT 기반

클라이언트가 URI를 직접 지정한다.

```http
PUT /files/report.pdf
→ HTTP/1.1 200 OK
```

### 컨트롤 URI

메서드로 표현하기 어려운 동작은 동사 URI로 보완한다. 지나치게 남발하면 RPC 스타일이 되니 주의한다.

```text
POST /orders/{id}/cancel
POST /articles/{id}/publish
POST /members/{id}/delete   ← HTML 폼이 DELETE 못 보낼 때
```

## 13. 회원 관리 RESTful 예시

| 기능 | 메서드 | URI |
|:---|:---|:---|
| 목록 | GET | /members |
| 등록 | POST | /members |
| 조회 | GET | /members/{id} |
| 전체 수정 | PUT | /members/{id} |
| 부분 수정 | PATCH | /members/{id} |
| 삭제 | DELETE | /members/{id} |

```java
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public Page<Member> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return memberService.findAll(PageRequest.of(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Member> get(@PathVariable Long id) {
        return memberService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Member> create(
            @RequestBody @Valid MemberRequest request) {
        Member saved = memberService.save(request.toEntity());
        return ResponseEntity
            .created(URI.create("/api/members/" + saved.getId()))
            .body(saved);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Member> update(
            @PathVariable Long id,
            @RequestBody MemberUpdateRequest request) {
        return memberService.update(id, request)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        memberService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| GET | 조회, 안전·멱등·캐시 |
| POST | 요청 처리, 등록 |
| PUT | 완전 대체, 멱등 |
| PATCH | 부분 수정 |
| DELETE | 삭제, 멱등 |
| HEAD | 헤더만 조회 |
| OPTIONS | 메서드 조회, CORS preflight |
| Safe | 리소스 불변 |
| Idempotent | 반복 호출해도 결과 동일 |
| Collection / Store | 서버가 URI 생성 / 클라이언트가 지정 |

{{< callout type="info" >}}
**용어 정리**
- **GET / POST / PUT / PATCH / DELETE**: 주요 CRUD 메서드
- **HEAD / OPTIONS / CONNECT / TRACE**: 보조 메서드
- **Safe**: 호출해도 리소스를 변경하지 않는 성질
- **Idempotent**: 여러 번 호출해도 최종 상태가 같은 성질
- **Cacheable**: 응답을 저장·재사용할 수 있는 성질
- **Collection / Store**: 서버가 URI를 생성하는 패턴 / 클라이언트가 지정하는 패턴
- **Control URI**: 메서드로 표현하기 어려운 동작을 동사 URI로 표현
- **Idempotency-Key**: 중복 처리 방지를 위한 클라이언트 생성 식별자
- **CORS Preflight**: 크로스 오리진 요청 전 OPTIONS 사전 확인
{{< /callout >}}
