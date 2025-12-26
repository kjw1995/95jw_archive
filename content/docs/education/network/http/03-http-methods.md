---
title: "03. HTTP 메서드"
weight: 3
---

## 리소스와 행위의 분리

좋은 URI 설계는 **리소스 자체를 식별**하는 데 집중하고, **행위는 HTTP 메서드**로 구분합니다.

```
❌ 잘못된 설계                    ✅ 올바른 설계
────────────────────────────────────────────────────────────
/read-member-list               GET    /members
/read-member-by-id              GET    /members/{id}
/create-member                  POST   /members
/update-member                  PUT    /members/{id}
/delete-member                  DELETE /members/{id}
```

---

## 주요 HTTP 메서드

### 메서드 요약

| 메서드 | 역할 | 요청 Body | 안전 | 멱등 | 캐시 |
|--------|------|-----------|------|------|------|
| **GET** | 리소스 조회 | 권장 안함 | O | O | O |
| **POST** | 요청 데이터 처리, 등록 | O | X | X | △ |
| **PUT** | 리소스 **완전** 대체 | O | X | O | X |
| **PATCH** | 리소스 **부분** 수정 | O | X | X | X |
| **DELETE** | 리소스 삭제 | 권장 안함 | X | O | X |

---

## GET

**리소스 조회**에 사용됩니다. 서버에 전달할 데이터는 주로 **쿼리 파라미터**로 전달합니다.

### 요청/응답 예시

```http
GET /members/100?fields=name,age HTTP/1.1
Host: api.example.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 100,
  "name": "홍길동",
  "age": 30
}
```

### Spring Boot 예제

```java
@RestController
@RequestMapping("/api/members")
public class MemberController {

    @GetMapping
    public List<Member> getMembers(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return memberService.findAll(name, page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Member> getMember(@PathVariable Long id) {
        return memberService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

---

## POST

**요청 데이터 처리**에 사용됩니다. 주로 신규 리소스 등록, 프로세스 처리에 활용됩니다.

### 요청/응답 예시

```http
POST /members HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "name": "홍길동",
  "age": 30
}
```

```http
HTTP/1.1 201 Created
Location: /members/100
Content-Type: application/json

{
  "id": 100,
  "name": "홍길동",
  "age": 30
}
```

### Spring Boot 예제

```java
@PostMapping
public ResponseEntity<Member> createMember(@RequestBody @Valid MemberRequest request) {
    Member member = memberService.save(request.toEntity());

    URI location = URI.create("/api/members/" + member.getId());
    return ResponseEntity.created(location).body(member);
}
```

### POST의 다양한 활용

| 용도 | 설명 | 예시 |
|------|------|------|
| 리소스 등록 | 새로운 리소스 생성 | POST /members |
| 프로세스 처리 | 복잡한 비즈니스 로직 | POST /orders/{id}/payment |
| 다른 메서드로 처리 어려운 경우 | 긴 데이터 전송 등 | POST /search (body에 검색 조건) |

---

## PUT

**리소스를 완전히 대체**합니다. 리소스가 있으면 대체하고, 없으면 생성합니다.

### PUT의 특징

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PUT - 완전 대체                                     │
├──────────────────────────────────┬──────────────────────────────────────────┤
│              Before              │              After PUT                   │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  {                               │  PUT /members/100                        │
│    "id": 100,                    │  { "name": "김철수" }                    │
│    "name": "홍길동",             │                                          │
│    "age": 30                     │  결과:                                   │
│  }                               │  {                                       │
│                                  │    "id": 100,                            │
│                                  │    "name": "김철수"                      │
│                                  │  }                                       │
│                                  │  ← age 필드가 사라짐!                   │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### Spring Boot 예제

```java
@PutMapping("/{id}")
public ResponseEntity<Member> replaceMember(
        @PathVariable Long id,
        @RequestBody @Valid MemberRequest request) {

    Member member = request.toEntity();
    member.setId(id);

    Member saved = memberService.save(member);  // 완전 대체
    return ResponseEntity.ok(saved);
}
```

---

## PATCH

**리소스의 부분만 변경**합니다.

### PATCH의 특징

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PATCH - 부분 수정                                   │
├──────────────────────────────────┬──────────────────────────────────────────┤
│              Before              │              After PATCH                 │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  {                               │  PATCH /members/100                      │
│    "id": 100,                    │  { "name": "김철수" }                    │
│    "name": "홍길동",             │                                          │
│    "age": 30                     │  결과:                                   │
│  }                               │  {                                       │
│                                  │    "id": 100,                            │
│                                  │    "name": "김철수",                     │
│                                  │    "age": 30                             │
│                                  │  }                                       │
│                                  │  ← age 유지!                            │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### Spring Boot 예제

```java
@PatchMapping("/{id}")
public ResponseEntity<Member> updateMember(
        @PathVariable Long id,
        @RequestBody Map<String, Object> updates) {

    return memberService.findById(id)
        .map(member -> {
            updates.forEach((key, value) -> {
                switch (key) {
                    case "name" -> member.setName((String) value);
                    case "age" -> member.setAge((Integer) value);
                }
            });
            return ResponseEntity.ok(memberService.save(member));
        })
        .orElse(ResponseEntity.notFound().build());
}
```

---

## DELETE

**리소스를 삭제**합니다.

### 요청/응답 예시

```http
DELETE /members/100 HTTP/1.1
Host: api.example.com
```

```http
HTTP/1.1 204 No Content
```

### Spring Boot 예제

```java
@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteMember(@PathVariable Long id) {
    if (!memberService.existsById(id)) {
        return ResponseEntity.notFound().build();
    }
    memberService.deleteById(id);
    return ResponseEntity.noContent().build();
}
```

---

## HTTP 메서드 속성

### 1. 안전 (Safe)

호출해도 **리소스를 변경하지 않습니다**.

```
안전한 메서드: GET, HEAD, OPTIONS, TRACE
안전하지 않은 메서드: POST, PUT, PATCH, DELETE
```

### 2. 멱등 (Idempotent)

**몇 번을 호출해도 결과가 동일**합니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           멱등성 비교                                        │
├───────────────┬─────────────────────────────────────────────────────────────┤
│    GET        │  GET /members/100 → 항상 같은 결과                         │
│    PUT        │  PUT /members/100 → 항상 같은 상태로 대체                  │
│    DELETE     │  DELETE /members/100 → 삭제 후 재요청해도 삭제된 상태      │
├───────────────┼─────────────────────────────────────────────────────────────┤
│    POST       │  POST /members → 호출할 때마다 새 리소스 생성 (멱등 X)     │
│    PATCH      │  PATCH /members/100 → 구현에 따라 다름 (보통 멱등 X)       │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

**활용**: 타임아웃으로 응답을 못 받았을 때 **재요청 가능 여부** 판단

### 3. 캐시 가능 (Cacheable)

응답 결과를 **캐시해서 재사용**할 수 있습니다.

```
캐시 가능: GET, HEAD (실무에서 주로 사용)
이론적 가능: POST, PATCH (구현 복잡으로 잘 사용 안함)
```

---

## 클라이언트 → 서버 데이터 전송

### 전송 방식

| 방식 | 메서드 | 사용 시점 |
|------|--------|-----------|
| 쿼리 파라미터 | GET | 검색, 정렬, 필터링 |
| 메시지 바디 | POST, PUT, PATCH | 리소스 등록/변경 |

### 4가지 상황별 전송

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       데이터 전송 4가지 상황                                  │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  1. 정적 데이터 조회 │ GET /static/image.jpg                               │
│                      │ 쿼리 파라미터 없이 리소스 경로로 단순 조회           │
├──────────────────────┼──────────────────────────────────────────────────────┤
│  2. 동적 데이터 조회 │ GET /search?q=hello&sort=date                       │
│                      │ 쿼리 파라미터로 검색 조건 전달                       │
├──────────────────────┼──────────────────────────────────────────────────────┤
│  3. HTML Form 전송   │ POST /members (x-www-form-urlencoded)               │
│                      │ POST /upload (multipart/form-data)                  │
├──────────────────────┼──────────────────────────────────────────────────────┤
│  4. HTTP API 전송    │ POST /api/members (application/json)                │
│                      │ 서버 간 통신, 앱/웹 클라이언트                       │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

---

## HTTP API 설계 패턴

### 1. 컬렉션 (Collection) - POST 기반

서버가 리소스 URI를 생성합니다.

```http
POST /members
→ 서버가 /members/100 생성 (Location 헤더로 알려줌)
```

```java
// 서버가 ID 생성
@PostMapping("/members")
public ResponseEntity<Member> create(@RequestBody Member member) {
    Member saved = repository.save(member);  // ID 자동 생성
    return ResponseEntity
        .created(URI.create("/members/" + saved.getId()))
        .body(saved);
}
```

### 2. 스토어 (Store) - PUT 기반

클라이언트가 리소스 URI를 알고 지정합니다.

```http
PUT /files/star.jpg
→ 클라이언트가 URI 직접 지정
```

```java
// 클라이언트가 URI 지정
@PutMapping("/files/{filename}")
public ResponseEntity<Void> uploadFile(
        @PathVariable String filename,
        @RequestBody byte[] content) {
    fileService.save(filename, content);
    return ResponseEntity.ok().build();
}
```

### 3. 컨트롤 URI

HTTP 메서드로 해결하기 어려운 경우 **동사**를 사용합니다.

```
POST /orders/{orderId}/cancel    ← 주문 취소 프로세스
POST /members/{id}/delete        ← HTML Form에서 DELETE 사용 불가 시
```

---

## RESTful API 설계 예시

### 회원 관리 API

| 기능 | HTTP 메서드 | URI |
|------|-------------|-----|
| 회원 목록 | GET | /members |
| 회원 등록 | POST | /members |
| 회원 조회 | GET | /members/{id} |
| 회원 수정 | PATCH | /members/{id} |
| 회원 삭제 | DELETE | /members/{id} |

### Spring Boot 전체 예제

```java
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    // 목록 조회
    @GetMapping
    public ResponseEntity<Page<Member>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(memberService.findAll(PageRequest.of(page, size)));
    }

    // 단건 조회
    @GetMapping("/{id}")
    public ResponseEntity<Member> get(@PathVariable Long id) {
        return memberService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // 등록
    @PostMapping
    public ResponseEntity<Member> create(@RequestBody @Valid MemberRequest request) {
        Member member = memberService.save(request.toEntity());
        return ResponseEntity
            .created(URI.create("/api/members/" + member.getId()))
            .body(member);
    }

    // 수정
    @PatchMapping("/{id}")
    public ResponseEntity<Member> update(
            @PathVariable Long id,
            @RequestBody MemberUpdateRequest request) {
        return memberService.update(id, request)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        memberService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **GET** | 리소스 조회, 안전하고 멱등함 |
| **POST** | 요청 데이터 처리, 리소스 등록 |
| **PUT** | 리소스 완전 대체, 멱등함 |
| **PATCH** | 리소스 부분 수정 |
| **DELETE** | 리소스 삭제, 멱등함 |
| **Safe** | 리소스를 변경하지 않는 특성 |
| **Idempotent** | 여러 번 호출해도 결과가 같은 특성 |
| **Collection** | 서버가 관리하는 리소스 디렉토리 (POST 등록) |
| **Store** | 클라이언트가 관리하는 저장소 (PUT 등록) |
| **Control URI** | 메서드로 표현 어려운 동작을 동사로 표현 |
