---
title: "06. 실시간 API와 REST의 미래"
date: 2026-04-23
weight: 6
---

[04. 성능을 고려한 설계](../04-performance)에서 긴 일은 202로 접수하고 결과는 폴링이나 SSE로 전한다고 했고, [05](../05-advanced)장은 호출을 줄이는 방법으로 웹훅을 이 장으로 미뤘다. 시리즈의 마지막 장이다. 원리는 셋이다. 첫째, **REST는 묻는 쪽이 정하고, 실시간은 아는 쪽이 말한다.** 폴링의 낭비는 모르면서 묻는 값이고, SSE와 WebSocket과 웹훅은 이벤트를 아는 쪽이 먼저 말하는 세 갈래 길이다. 브라우저에 한 방향으로, 브라우저와 양방향으로, 서버에서 서버로. 둘째, **실시간의 값은 연결을 붙드는 것과 끊김을 다루는 것이다.** 요청 하나가 끝나면 잊는 REST와 달리 열어 둔 연결은 언젠가 끊기고, 다시 붙을 때 무엇을 놓쳤는지를 알아야 한다. 셋째, **REST의 대안은 REST의 약점을 하나씩 겨눈 것이다.** GraphQL은 과다·부족 조회를, gRPC는 텍스트와 요청·응답 한 쌍의 한계를 겨누고, 마이크로서비스는 그 선택을 서비스마다 다르게 한다. 이 PC에서 JDK 25의 WebSocket 클라이언트로 에코 서버와 나눈 대화, PokeAPI의 REST와 GraphQL 응답 크기, 프로토콜 버퍼를 손으로 부호화한 바이트를 실었다.

---

## 1. 실시간 API 개요

```text
[REST (Pull)]
Client         Server
  │── 요청 ───►│
  │◄── 응답 ───│
  │── 요청 ───►│
  │◄── 응답 ───│
주기적 요청, 지연·낭비

[실시간 (Push)]
Client         Server
  │◄── 이벤트 ──│
  │◄── 이벤트 ──│
  │◄── 이벤트 ──│
변경 시 즉시 전송
```

| 모델 | 누가 시작하나 | 언제 아나 | 왜 |
|:-----|:------------|:---------|:---|
| Pull (REST) | 클라이언트 | 물어봤을 때 | 서버는 누가 관심 있는지 모른다 |
| Push (실시간) | 서버 | 일어난 즉시 | 서버가 아는 것을 바로 말한다 |

첫째 원리다. REST의 요청과 응답은 클라이언트가 필요할 때 가져오는 모델이고, 그래서 서버에서 무언가 바뀐 것을 클라이언트는 다음에 물어볼 때까지 모른다. 실시간 API는 아는 쪽, 곧 서버가 먼저 말하는 모델이다. 문제는 HTTP가 원래 묻고 답하는 규칙이라는 것이고, 이 장의 기술들은 그 규칙 안에서, 또는 그 규칙을 바꿔서 서버가 먼저 말하게 하는 방법들이다.

---

## 2. 폴링의 한계

```text
Client              Server
  │── 있나요? ────►│
  │◄── 없어요 ─────│  낭비 #1
  │── 있나요? ────►│
  │◄── 없어요 ─────│  낭비 #2
  │── 있나요? ────►│
  │◄── {data} ────│  성공
  │    ... 반복 ...
```

| 문제 | 뜻 | 왜 |
|:-----|:---|:---|
| 대역폭 낭비 | 빈 답에도 헤더가 오간다 | 모르면서 묻는다 |
| 서버 부하 | 빈 요청도 처리다 | 인증, 조회, 직렬화가 매번 |
| 늦다 | 주기만큼 | 1초마다 물으면 평균 0.5초 늦는다 |
| 안 는다 | 손님 수 × 주기 | 만 명이 1초마다면 초당 만 건 |

폴링은 REST 그대로 실시간을 흉내 내는 방법이고, 그래서 가장 단순하고 가장 낭비가 크다. [04](../04-performance)장의 작업 상태 확인처럼 몇 번 묻고 끝나는 일에는 충분하지만, 채팅이나 시세처럼 계속 봐야 하는 것에는 세 대안이 있다.

| 기술 | 방식 | 방향 | 왜 |
|:-----|:-----|:-----|:---|
| Long Polling | 답이 생길 때까지 응답을 미룬다 | 서버 → 클라이언트 | 빈 답을 없앤다. HTTP 그대로 |
| SSE | 응답을 끝내지 않고 이벤트를 흘린다 | 서버 → 클라이언트 | 한 연결에 여러 이벤트. HTTP 그대로 |
| WebSocket | 규칙을 바꿔 양쪽이 말한다 | 양방향 | 요청·응답의 틀을 벗는다 |
| WebHook | 서버가 서버의 주소로 요청한다 | 서버 → 서버 | 받는 쪽도 서버라 주소가 있다 |

---

## 3. SSE (Server-Sent Events)

```text
Client                    Server
  │── GET /events ──────►│
  │  Accept:             │
  │  text/event-stream   │
  │                      │
  │◄── 200 OK ───────────│
  │  Content-Type:       │
  │  text/event-stream   │
  │  Connection:         │
  │  keep-alive          │
  │                      │
  │   ┌ 연결 유지 ┐      │
  │◄──│ event:msg │──────│ ①
  │   │ data:{1}  │      │
  │◄──│ event:upd │──────│ ②
  │   │ data:{2}  │      │
  │◄──│ event:msg │──────│ ③
  │   │ data:{3}  │      │
  │   └──────────┘       │
```

HTTP의 규칙을 하나만 구부린 것이다. 응답의 본문을 **끝내지 않는다.** 클라이언트가 GET을 보내면 서버는 200과 `Content-Type: text/event-stream`으로 답을 시작하고, 본문에 이벤트를 한 덩이씩 써 보내며 연결을 열어 둔다. [04](../04-performance)장에서 위키미디어의 편집 스트림을 이 PC에서 받았을 때 본 것이 이것이다. `cache-control: no-cache`로 중간 캐시가 끼어들지 못하게 하고, `:ok` 주석 한 줄 뒤에 `event:`, `id:`, `data:` 줄이 계속 왔다.

```text
data: Hello World\n\n

data: Line 1\n
data: Line 2\n\n

id: 12345\n
event: update\n
data: {"id":123,"status":"online"}\n\n

retry: 5000\n
```

| 필드 | 뜻 | 왜 |
|:-----|:---|:---|
| data | 내용 | 여러 줄이면 줄마다 `data:`. 빈 줄이 이벤트의 끝 |
| event | 이벤트 이름 | 없으면 `message`. 브라우저가 이름별로 핸들러를 부른다 |
| id | 이벤트 번호 | 끊겼다 붙을 때 `Last-Event-ID`로 보낸다. 둘째 원리 |
| retry | 재접속 간격(ms) | 서버가 클라이언트의 재접속 속도를 정한다 |

둘째 원리가 `id`와 `retry`에 있다. 연결은 끊긴다. Wi-Fi가 바뀌고 프록시가 시간을 재고 서버가 배포된다. SSE는 브라우저의 `EventSource`가 **알아서 다시 붙고**, 마지막으로 받은 `id`를 `Last-Event-ID` 헤더로 보내므로 서버는 그 다음부터 이어 줄 수 있다. 위키미디어의 `id`가 토픽별 오프셋의 JSON이었던 이유다. 이 두 가지가 WebSocket에는 없고 SSE에는 있어서, 한 방향이면 SSE를 먼저 고른다.

```java
@GetMapping(produces =
    "text/event-stream")
Flux<ServerSentEvent<String>> events() {
    return Flux.interval(
            Duration.ofSeconds(1))
        .map(i -> ServerSentEvent
            .<String>builder()
            .id(String.valueOf(i))
            .event("heartbeat")
            .data("ping " + i)
            .build());
}
```

```java
final List<SseEmitter> emitters =
    new CopyOnWriteArrayList<>();

@GetMapping("/subscribe")
SseEmitter subscribe() {
    var em =
        new SseEmitter(Long.MAX_VALUE);
    Runnable drop =
        () -> emitters.remove(em);
    em.onCompletion(drop);
    em.onTimeout(drop);
    em.onError(e -> drop.run());
    emitters.add(em);
    return em;
}

void broadcast(String name, Object d) {
    for (SseEmitter em : emitters) {
        try {
            em.send(SseEmitter.event()
                .name(name).data(d));
        } catch (IOException e) {
            emitters.remove(em);
        }
    }
}
```

WebFlux의 `Flux`는 스트림을 그대로 응답으로 쓰고, MVC의 `SseEmitter`는 열어 둔 응답을 객체로 붙들었다가 아무 때나 `send`한다. 둘 다 요점은 같다. 응답 하나가 스레드 하나를 붙들면 손님 만 명에 스레드 만 개가 되므로, 열어 둔 연결은 스레드를 놓아 주는 비동기 모델로 다뤄야 한다. 끊긴 연결을 목록에서 빼는 코드가 절반인 이유도 둘째 원리다. 안 빼면 죽은 연결에 계속 쓰다 예외가 쌓인다.

```javascript
const es = new EventSource("/sse");

es.onmessage = (e) => {
  console.log("message", e.data);
};

es.addEventListener("update", (e) => {
  const data = JSON.parse(e.data);
  console.log("update", data);
});

es.onerror = () => {
  // 브라우저가 알아서 다시 붙는다
};

es.close();
```

브라우저 쪽은 이것이 전부다. `onerror`에 재접속 코드가 없는 것이 SSE의 장점이다. 대신 `EventSource`는 헤더를 못 붙이므로 인증은 쿠키나 쿼리로 한다.

---

## 4. WebSocket

```text
[HTTP]
요청 → 응답 → 종료
요청 → 응답 → 종료
요청 → 응답 → 종료
매번 연결/해제, 헤더 큼

[WebSocket]
핸드셰이크 → 연결 유지
      ↕ 양방향
      ↕ 양방향
한 번 연결, 작은 프레임
```

첫째 원리의 셋째 길이다. HTTP로 시작해서 HTTP를 **버린다.** 첫 요청에 "이 연결을 WebSocket으로 바꾸자"고 하고, 서버가 101로 동의하면 그 TCP 연결은 그때부터 요청·응답의 규칙 없이 양쪽이 아무 때나 프레임을 보내는 통로가 된다. 프레임의 머리는 2~14바이트라 수백 바이트의 HTTP 헤더가 사라진다.

```http
GET /chat HTTP/1.1
Host: echo.websocket.org
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

```text
Sec-WebSocket-Key:
  dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Accept:
  s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
= base64(sha1(key + 고정 GUID))
```

[HTTP 04](../../../network/http/04-http-status-codes)장에서 이 PC의 curl이 echo.websocket.org에 보낸 인사가 위다. 클라이언트가 무작위 키를 보내면 서버는 키에 규격이 정한 GUID를 붙여 SHA-1로 해시한 값을 돌려준다. 이 PC에서 그 계산을 해 보니 서버가 준 값과 같았다. 비밀이 아니라 "너는 WebSocket을 아는 서버구나"를 확인하는 절차다. 캐시나 프록시가 옛 답을 돌려주면 이 값이 안 맞아 드러난다.

```text
OPEN
RECV Request served by 4d896d95b55478
SEND hello from JDK 25
SEND second frame
RECV hello from JDK 25
RECV second frame
CLOSED
```

인사 뒤의 대화를 JDK 25의 `WebSocket` 클라이언트로 해 봤다. 연결되자마자 서버가 먼저 인사말을 보냈고(서버가 먼저 말할 수 있다), 이 PC가 프레임 둘을 보내니 둘 다 그대로 돌아왔다. 요청 없이 온 첫 줄이 WebSocket과 HTTP의 차이다.

```java
@Configuration
@EnableWebSocket
class WsConfig
        implements WebSocketConfigurer {

    @Override
    public void
            registerWebSocketHandlers(
            WebSocketHandlerRegistry
                reg) {
        reg.addHandler(
                new ChatHandler(),
                "/ws/chat")
            .setAllowedOrigins(
                "https://app.io");
    }
}
```

```java
class ChatHandler
        extends TextWebSocketHandler {

    final Set<WebSocketSession> pool =
        ConcurrentHashMap.newKeySet();

    @Override
    public void
            afterConnectionEstablished(
            WebSocketSession s) {
        pool.add(s);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession s,
            TextMessage msg)
            throws IOException {
        String text = msg.getPayload();
        for (var o : pool) {
            o.sendMessage(
                new TextMessage(text));
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession s,
            CloseStatus status) {
        pool.remove(s);
    }
}
```

세션 집합을 들고 들어온 메시지를 모두에게 뿌리는 채팅의 뼈대다. `setAllowedOrigins`를 `*`로 두면 아무 사이트의 스크립트가 로그인된 사용자의 브라우저로 이 소켓을 열 수 있다. 쿠키가 자동으로 붙는 [HTTP 05](../../../network/http/05-http-headers)장의 문제가 WebSocket에도 그대로 있고, 브라우저의 CORS는 WebSocket에 적용되지 않으므로 서버가 `Origin`을 직접 본다.

```java
@Configuration
@EnableWebSocketMessageBroker
class StompConfig implements
    WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(
            MessageBrokerRegistry r) {
        r.enableSimpleBroker("/topic");
    }

    @Override
    public void registerStompEndpoints(
            StompEndpointRegistry r) {
        r.addEndpoint("/ws")
            .setAllowedOrigins(
                "https://app.io");
    }
}
```

```java
@Controller
class ChatController {

    @MessageMapping("/chat.send")
    @SendTo("/topic/messages")
    ChatMessage send(ChatMessage m) {
        return m;
    }
}
```

WebSocket은 프레임만 정하고 그 안의 뜻은 정하지 않는다. 채팅방과 구독 같은 개념을 매번 만들지 않으려고 그 위에 STOMP를 얹는다. 클라이언트가 `/topic/messages`를 구독하고 `/app/chat.send`로 보내면(앱 접두는 `setApplicationDestinationPrefixes`로 정한다) 컨트롤러가 받아 `/topic/messages`의 구독자 전부에게 보낸다. 발행과 구독의 패턴이고, 서버가 여럿이면 `enableSimpleBroker` 대신 RabbitMQ 같은 진짜 브로커를 뒤에 둔다.

```javascript
const url = "wss://app.io/ws";
const ws = new WebSocket(url);

ws.onopen = () => {
  ws.send(JSON.stringify(
    { type: "join", user: "John" }));
};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  console.log("recv", m);
};
ws.onclose = (e) => {
  console.log("closed", e.code);
  // 재접속은 내가 짠다
};
ws.close();
```

SSE와 달리 `onclose` 뒤에 다시 붙는 것은 개발자의 몫이고, 끊긴 사이에 놓친 메시지를 어떻게 메울지도 규격에 없다. 양방향이 꼭 필요할 때만 이 값을 치른다.

---

## 5. WebHook

```text
① 웹훅 등록
Subscriber          Provider
   │── POST /webhooks ─►│
   │  {url: callback}   │
   │◄── 201 Created ────│

② 이벤트 발생 시
Subscriber          Provider
   │◄── POST /callback ─│
   │  {event: "..."}    │
   │                    │
   │── 200 OK ─────────►│
   │  이벤트 처리       │
```

첫째 원리의 넷째 길이다. 받는 쪽이 브라우저가 아니라 서버라면 **주소가 있다.** 그러면 연결을 열어 둘 필요 없이, 이벤트가 생길 때 그 주소로 보통의 HTTP POST를 보내면 된다. 미리 "무슨 일이 생기면 이 주소로 알려 달라"고 등록해 두는 것이 웹훅이고, GitHub의 push 알림, 결제사의 결제 완료 알림, CI의 빌드 결과가 전부 이것이다. [05](../05-advanced)장의 한도 문제도 여기서 풀린다. 바뀌었는지 1분마다 묻는 대신 바뀔 때 한 번 받는다.

```json
{
  "action": "opened",
  "number": 123,
  "pull_request": {
    "id": 456,
    "title": "Fix bug",
    "user": { "login": "developer" }
  },
  "repository": {
    "full_name": "org/repo"
  }
}
```

```java
@PostMapping("/github")
ResponseEntity<Void> github(
        @RequestHeader HttpHeaders h,
        @RequestBody String body) {
    String event = h.getFirst(
        "X-GitHub-Event");
    String sig = h.getFirst(
        "X-Hub-Signature-256");
    if (!verify(body, sig)) {
        return ResponseEntity
            .status(401).build();
    }
    switch (event) {
        case "push" -> onPush(body);
        case "pull_request" ->
            onPullRequest(body);
        default -> ignore(event);
    }
    return ResponseEntity.ok().build();
}

boolean verify(String body, String s) {
    byte[] mac = hmac(secret, body);
    String expected = "sha256="
        + HexFormat.of().formatHex(mac);
    return MessageDigest.isEqual(
        expected.getBytes(),
        s.getBytes());
}
```

둘째 원리가 웹훅에서는 **신뢰**의 문제가 된다. 받는 주소는 공개돼 있으므로 누구나 가짜 이벤트를 POST할 수 있다. 그래서 보내는 쪽이 등록 때 나눈 비밀로 본문의 HMAC을 계산해 헤더에 싣고, 받는 쪽이 같은 계산을 해 비교한다. GitHub의 `X-Hub-Signature-256`이 그것이고, 이 PC에서 계산해 보면 `sha256=`에 16진수 64자가 붙은 71자다. 비교를 `MessageDigest.isEqual`로 하는 것은 앞에서부터 한 글자씩 비교하다 다른 곳에서 멈추는 일반 비교가 걸린 시간으로 답을 새게 하기 때문이다.

{{< callout type="warning" >}}
웹훅 수신 끝점은 **반드시 서명을 검증**한다. 검증 없는 끝점은 "누구든 결제 완료라고 말할 수 있는 끝점"이다. 그리고 빨리 답한다. 보내는 쪽은 몇 초 안에 2xx가 안 오면 실패로 보고 다시 보내므로, 받은 이벤트는 큐에 넣고 200을 먼저 돌려준 뒤 처리한다. 같은 이벤트가 두 번 올 수 있으니 이벤트 ID로 중복을 거른다.
{{< /callout >}}

```java
void deliver(Webhook hook, String event,
        String body) {
    for (int attempt = 1; attempt <= 3;
            attempt++) {
        try {
            client.post()
                .uri(hook.url())
                .header("X-Event",
                    event)
                .header("X-Signature",
                    sign(body))
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .block(TEN_SECONDS);
            return;
        } catch (Exception e) {
            sleep(1000L << attempt);
        }
    }
    deadLetter(hook, event, body);
}
```

보내는 쪽의 뼈대다. 받는 서버가 죽어 있을 수 있으므로 간격을 늘려 가며 다시 보내고, 끝내 실패하면 버리지 않고 따로 쌓아 둔다. 실제로는 요청 스레드에서 이 루프를 돌리지 않고 큐와 워커로 넘긴다. [04](../04-performance)장의 비동기 처리와 같은 그림이다.

---

## 6. 실시간 통신 기술 비교

```text
[SSE]         서버 → 클라이언트
              단방향

[WebSocket]   ◄── 양방향 ──►

[WebHook]     서버 → 서버
              단방향
```

| 특성 | SSE | WebSocket | WebHook | 왜 |
|:-----|:----|:----------|:--------|:---|
| 방향 | 서버 → 브라우저 | 양방향 | 서버 → 서버 | 누가 주소를 갖나 |
| 프로토콜 | HTTP | ws, wss | HTTP | HTTP를 구부렸나, 버렸나, 그대로 쓰나 |
| 연결 유지 | O | O | X | 웹훅은 그때그때 새 요청 |
| 자동 재접속 | O | X | 해당 없음 | 브라우저가 해 주느냐 내가 하느냐 |
| 바이너리 | X | O | O | SSE는 글자 스트림 |
| 인프라 | 그대로 | 프록시·LB 설정 필요 | 그대로 | HTTP가 아닌 것은 중간 장비가 낯설어한다 |
| 쓰는 곳 | 알림, 피드, 진행률 | 채팅, 게임, 협업 | 서비스 연동 | |

| 질문 | 답 | 왜 |
|:-----|:---|:---|
| 서버가 브라우저에 알리기만 하나 | SSE | 자동 재접속과 HTTP 호환을 공짜로 |
| 브라우저도 자주 말하나 | WebSocket | 요청·응답의 틀이 걸리적거린다 |
| 받는 쪽이 서버인가 | WebHook | 연결을 붙들 이유가 없다 |
| 방화벽과 프록시가 까다로운가 | SSE | 그냥 긴 HTTP 응답이다 |
| 바이너리를 보내나 | WebSocket | SSE는 글자 |

{{< callout type="info" >}}
SSE는 **HTTP 위에서 그대로** 돌아 로드밸런서와 방화벽이 아무것도 몰라도 되고, 브라우저가 끊긴 연결을 알아서 이어 준다. 양방향이 꼭 필요하지 않다면 WebSocket보다 먼저 고른다. 채팅조차 받는 것은 SSE로, 보내는 것은 보통의 POST로 나누면 WebSocket 없이 된다.
{{< /callout >}}

---

## 7. REST의 대안과 미래

셋째 원리다. 대안들은 REST를 부정한 것이 아니라 REST의 특정 약점을 겨눈 것이다. 무엇을 겨눴는지를 알면 언제 쓸지가 정해진다.

### GraphQL

```text
[REST]
GET /users/1
GET /users/1/posts
GET /users/1/followers
→ 3번 요청, Over-fetching

[GraphQL]
query {
  user(id: 1) {
    name
    posts { title }
    followers { name }
  }
}
→ 1번 요청, 필요한 것만
```

```text
REST     GET /pokemon/1
         → 272,094바이트
GraphQL  { pokemon(id: 1)
             { name height weight } }
         → 77바이트
```

REST가 겨눔당한 약점은 **표현의 크기를 서버가 정한다**는 것이다. 이 PC에서 PokeAPI에 1번 포켓몬을 REST로 물으니 272,094바이트가 왔다. 이름 하나가 필요해도 서버가 정한 표현 전체를 받는다(과다 조회). 반대로 화면 하나에 사용자, 글, 팔로워가 필요하면 세 번 가야 한다(부족 조회). 같은 것을 GraphQL 끝점에 이름, 키, 몸무게만 달라고 하니 77바이트가 왔다. 클라이언트가 필드를 고르고 관계를 한 질의에 엮는다.

| 특성 | REST | GraphQL | 왜 갈리나 |
|:-----|:-----|:--------|:---------|
| 끝점 | 자원마다 | 하나 | 주소가 아니라 질의가 자원을 고른다 |
| 조회량 | 서버가 정한다 | 클라이언트가 정한다 | 과다·부족 조회의 유무 |
| 버전 | 주소나 헤더 | 스키마에 필드를 더한다 | 안 쓰는 필드는 안 받으니 빼도 안 깨진다 |
| 캐시 | HTTP 캐시 그대로 | 따로 만든다 | 전부 POST 하나라 주소가 같다 |
| 배우기 | HTTP를 알면 | 스키마, 리졸버, 질의 언어 | 층이 하나 더 있다 |

캐시 행이 GraphQL의 값이다. [04](../04-performance)장의 모든 것, 곧 `max-age`, ETag, CDN이 주소를 키로 하는데 GraphQL은 주소가 하나다. 화면마다 필요한 모양이 다른 모바일 앱에는 GraphQL이, 캐시가 중요한 공개 API에는 REST가 맞는 이유다.

### gRPC

```text
[REST/JSON]
{
  "id": 123,
  "name": "John",
  "email": "j@mail.com"
}
→ 텍스트, HTTP/1.1

[gRPC/Protobuf]
message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}
→ 바이너리, HTTP/2
```

```text
JSON     45바이트
{"id":123,"name":"John",
 "email":"j@mail.com"}

Protobuf 20바이트
08 7b              id = 123
12 04 4a 6f 68 6e  name = "John"
1a 0a 6a 40 6d ..  email = ...
```

REST가 겨눔당한 둘째 약점은 **글자**와 **요청·응답 한 쌍**이다. 이 PC에서 위의 세 필드를 프로토콜 버퍼 규칙대로 손으로 부호화하니 20바이트였고, 같은 것의 JSON은 45바이트다. 필드 이름 대신 번호(`08`은 1번 필드, `12`는 2번)를 쓰고 따옴표와 쉼표가 없다. 크기보다 큰 차이는 파싱이다. 글자를 읽어 숫자로 바꾸는 대신 바이트를 그대로 읽는다. 그리고 HTTP/2 위에서 한 연결에 스트림을 섞으므로([HTTP 02](../../../network/http/02-http-basics)장) 요청 하나에 응답이 계속 흐르는 스트리밍이 기본이다.

| 특성 | REST | gRPC | 왜 갈리나 |
|:-----|:-----|:-----|:---------|
| 프로토콜 | HTTP/1.1, 2 | HTTP/2 | 스트림과 다중화가 필요해서 |
| 형식 | JSON 글자 | Protobuf 바이너리 | 크기와 파싱 |
| 스트리밍 | 제한적 | 기본. 양방향도 | HTTP/2의 스트림 |
| 계약 | 선택(OpenAPI) | 필수(.proto) | 코드가 계약에서 생성된다 |
| 브라우저 | 그대로 | gRPC-Web이 필요 | 브라우저는 HTTP/2 프레임을 직접 못 만진다 |
| 쓰는 곳 | 공개 API | 서비스끼리 | curl로 불러 볼 수 있는가가 갈림길 |

브라우저 행이 gRPC의 값이다. [01](../01-basics)장에서 REST의 힘은 curl과 브라우저로 바로 부를 수 있다는 것이라고 했다. gRPC는 그것을 포기하고 서비스 사이의 속도를 얻었다. 그래서 바깥에는 REST, 안에는 gRPC를 두는 조합이 흔하다.

---

## 8. 마이크로서비스와 REST

```text
[Monolithic]
┌─────────────────┐
│  User Service   │
├─────────────────┤
│  Order Service  │
├─────────────────┤
│ Payment Service │
├─────────────────┤
│  Notification   │
└─────────────────┘
 단일 배포, 단일 DB

[Microservices]
┌────┐ ┌────┐ ┌────┐
│User│ │Ord │ │Pay │
└─┬──┘ └─┬──┘ └─┬──┘
  ↕      ↕      ↕
  REST / gRPC
  서비스별 독립 DB
```

| 관점 | 모노리스 | 마이크로서비스 | 왜 |
|:-----|:--------|:-------------|:---|
| 배포 | 전체를 한 번에 | 서비스마다 | 결제만 고쳤는데 전부 다시 올리지 않게 |
| 확장 | 전체 복제 | 필요한 것만 | 주문만 몰리면 주문만 늘린다 |
| 장애 | 전체 | 그 서비스만 | 알림이 죽어도 결제는 된다 |
| 기술 | 하나 | 서비스마다 | 맞는 도구를 고른다 |
| 대가 | 없음 | 네트워크가 함수 호출을 대신한다 | 지연, 부분 실패, 분산 트랜잭션 |

이 시리즈가 마이크로서비스에서 끝나는 이유는 메서드 호출이 **HTTP 호출**이 되는 순간 앞 다섯 장이 전부 필요해지기 때문이다. 서비스 사이의 약속이 API의 계약이고, 실패를 코드로 알리고, 재시도는 멱등한 것만 하며, 캐시와 한도가 서비스를 지킨다. 마지막 행이 대가다. 함수 호출은 실패하지 않지만 네트워크는 실패하고, 그 실패를 다루는 것이 [03](../03-security)장의 추적과 [04](../04-performance)장의 재시도다.

| 장점 | 왜 |
|:-----|:---|
| 단순성 | 서비스 하나는 한 팀이 머리에 넣을 크기 |
| 독립 배포 | 남을 기다리지 않는다 |
| 선택적 확장 | 몰리는 곳만 |
| 기술 자유 | 검색은 이것, 결제는 저것 |
| 장애 격리 | 한 곳의 고장이 벽을 못 넘는다 |
| 팀 자율 | 서비스의 경계가 팀의 경계 |

```text
 Clients      Gateway      Services
┌──────┐     ┌────────┐   ┌──────┐
│ Web  │────►│        │──►│ User │
└──────┘     │ 라우팅 │   └──────┘
┌──────┐     │ 인증   │   ┌──────┐
│Mobile│────►│ RateLmt│──►│Order │
└──────┘     │ 로깅   │   └──────┘
┌──────┐     │ 캐싱   │   ┌──────┐
│Partnr│────►│        │──►│ Pay  │
└──────┘     └────────┘   └──────┘

단일 진입점, 횡단 관심사 처리
```

서비스가 열 개면 클라이언트가 열 주소를 알아야 하고, 인증과 한도와 로깅을 열 번 짜야 한다. 그래서 앞에 문 하나를 둔다. 게이트웨이가 주소를 나눠 주고, [03](../03-security)장의 인증과 [05](../05-advanced)장의 한도와 [04](../04-performance)장의 캐시를 한 곳에서 한다. 바깥에서 보면 API는 여전히 하나이고, 안에서는 REST와 gRPC와 이벤트가 섞인다. 첫째 원리로 돌아가면, 그 안에서도 묻는 쪽이 정할 것과 아는 쪽이 말할 것을 나누는 것이 설계다.

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Pull / Push | 묻는 쪽이 정한다 / 아는 쪽이 말한다 | 폴링의 낭비는 모르면서 묻는 값 |
| Long Polling | 답이 생길 때까지 응답을 미룬다 | 빈 답을 없앤다 |
| SSE | 끝내지 않는 HTTP 응답 | 자동 재접속과 `Last-Event-ID` |
| WebSocket | 101로 HTTP를 버린 양방향 통로 | 서버가 먼저 말한다. 재접속은 내 몫 |
| Accept 키 | sha1(key + GUID) | 프록시가 아니라 진짜 서버인지 |
| STOMP | WebSocket 위의 구독과 발행 | 프레임에는 뜻이 없다 |
| WebHook | 서버가 서버 주소로 POST | 받는 쪽에 주소가 있으니 연결이 필요 없다 |
| 서명 | HMAC과 상수 시간 비교 | 공개 주소에 가짜 이벤트가 온다 |
| GraphQL | 클라이언트가 필드를 고른다 | 272KB가 77B로. 캐시는 잃는다 |
| gRPC | Protobuf와 HTTP/2 스트림 | 45B가 20B로. 브라우저는 잃는다 |
| 마이크로서비스 | 함수 호출이 HTTP 호출이 된다 | 앞 다섯 장이 전부 필요해진다 |
| API Gateway | 문 하나에 횡단 관심사 | 바깥에서는 API가 하나 |

{{< callout type="info" >}}
**용어 정리**
- **Polling / Long Polling**: 주기적으로 묻기 / 답이 생길 때까지 응답을 미루기
- **SSE**: 서버가 열어 둔 HTTP 응답으로 이벤트를 흘려보내는 규격
- **EventSource / Last-Event-ID**: 브라우저의 SSE 객체 / 재접속 때 보내는 마지막 이벤트 번호
- **WebSocket**: 101로 HTTP에서 바꿔 타는 양방향 프레임 통로
- **STOMP**: WebSocket 위에 구독·발행을 얹은 글자 규격
- **WebHook**: 이벤트가 생기면 등록된 주소로 보내는 HTTP 콜백
- **HMAC 서명**: 나눈 비밀로 본문을 해시해 위조를 막는 것
- **GraphQL**: 클라이언트가 필드와 관계를 고르는 질의 언어. 끝점 하나
- **gRPC / Protobuf**: HTTP/2 위의 RPC 틀 / 번호로 필드를 적는 바이너리 형식
- **마이크로서비스**: 따로 배포하는 작은 서비스들. 사이는 네트워크
- **API Gateway**: 서비스들 앞의 단일 진입점
{{< /callout >}}
