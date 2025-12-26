---
title: "실시간 API와 REST의 미래"
weight: 6
---

## 실시간 API 개요

전통적인 요청-응답 방식의 REST API는 클라이언트가 필요할 때만 데이터를 가져오는 Pull 모델이다. 실시간 API는 서버에서 이벤트가 발생하면 즉시 클라이언트에게 전달하는 Push 모델을 지원한다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    실시간 API 통신 모델                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   전통적 REST (Pull)              실시간 API (Push)              │
│  ┌─────────────────────┐       ┌─────────────────────┐         │
│  │  Client    Server   │       │  Client    Server   │         │
│  │    │         │      │       │    │         │      │         │
│  │    │──요청──►│      │       │    │◄──이벤트──│      │         │
│  │    │◄─응답──│      │       │    │◄──이벤트──│      │         │
│  │    │         │      │       │    │◄──이벤트──│      │         │
│  │    │──요청──►│      │       │    │         │      │         │
│  │    │◄─응답──│      │       │                      │         │
│  └─────────────────────┘       └─────────────────────┘         │
│                                                                 │
│   클라이언트가 주기적 요청        서버가 변경 시 즉시 푸시          │
│   → 지연 발생, 리소스 낭비       → 실시간, 효율적                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 폴링의 한계

폴링(Polling)은 클라이언트가 주기적으로 서버에 요청을 보내 데이터 변경을 확인하는 방식이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      폴링의 문제점                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client                                         Server         │
│     │                                              │            │
│     │──── 데이터 있나요? ───────────────────────►│            │
│     │◄─── 없어요 (빈 응답) ─────────────────────│   낭비 #1   │
│     │                                              │            │
│     │──── 데이터 있나요? ───────────────────────►│            │
│     │◄─── 없어요 (빈 응답) ─────────────────────│   낭비 #2   │
│     │                                              │            │
│     │──── 데이터 있나요? ───────────────────────►│            │
│     │◄─── 있어요! {data} ──────────────────────│   성공!     │
│     │                                              │            │
│     │     ... (반복) ...                           │            │
│                                                                 │
│   문제점:                                                       │
│   • 대역폭 낭비 (빈 응답도 네트워크 비용)                         │
│   • 서버 부하 (불필요한 요청 처리)                                │
│   • 실시간성 부족 (폴링 간격만큼 지연)                            │
│   • 확장성 저하 (클라이언트 증가 시 부하 급증)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 폴링의 대안

| 기술 | 방식 | 방향 | 실시간성 |
|------|------|------|----------|
| **Long Polling** | 응답 대기 연장 | 단방향 | 중간 |
| **SSE** | 이벤트 스트리밍 | 단방향 (서버→클라이언트) | 높음 |
| **WebSocket** | 양방향 소켓 | 양방향 | 높음 |
| **WebHook** | HTTP 콜백 | 단방향 (서버→서버) | 높음 |

---

## SSE (Server-Sent Events)

HTML5 표준 기술로, 서버에서 클라이언트로 이벤트를 실시간 푸시하는 단방향 통신 방식

### SSE 동작 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                       SSE 동작 흐름                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Client (Browser)                               Server         │
│     │                                              │            │
│     │──── GET /events ────────────────────────────►│            │
│     │     Accept: text/event-stream               │            │
│     │                                              │            │
│     │◄─── HTTP/1.1 200 OK ────────────────────────│            │
│     │     Content-Type: text/event-stream         │            │
│     │     Connection: keep-alive                  │            │
│     │                                              │            │
│     │         ┌── 연결 유지 (Open) ──┐             │            │
│     │         │                      │             │            │
│     │◄────────│── event: message ────│─────────────│  이벤트 1  │
│     │         │   data: {"id":1}     │             │            │
│     │         │                      │             │            │
│     │◄────────│── event: update ─────│─────────────│  이벤트 2  │
│     │         │   data: {"id":2}     │             │            │
│     │         │                      │             │            │
│     │◄────────│── event: message ────│─────────────│  이벤트 3  │
│     │         │   data: {"id":3}     │             │            │
│     │         └──────────────────────┘             │            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SSE 메시지 형식

```
# 기본 메시지
data: Hello World\n\n

# 여러 줄 메시지
data: Line 1\n
data: Line 2\n\n

# 이벤트 ID + 타입 지정
id: 12345\n
event: user-update\n
data: {"userId": 123, "status": "online"}\n\n

# 재연결 간격 설정 (밀리초)
retry: 5000\n
data: Connection settings updated\n\n
```

### SSE 필드

| 필드 | 설명 |
|------|------|
| `data` | 이벤트 데이터 (필수) |
| `event` | 이벤트 타입 (기본: message) |
| `id` | 이벤트 ID (재연결 시 Last-Event-ID로 전송) |
| `retry` | 재연결 대기 시간 (ms) |

### Spring WebFlux SSE 구현

```java
@RestController
@RequestMapping("/api/v1/events")
public class SSEController {

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamEvents() {
        return Flux.interval(Duration.ofSeconds(1))
                .map(sequence -> ServerSentEvent.<String>builder()
                        .id(String.valueOf(sequence))
                        .event("heartbeat")
                        .data("Ping " + LocalDateTime.now())
                        .build());
    }

    @GetMapping(value = "/notifications", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Notification>> streamNotifications() {
        return notificationService.getNotificationStream()
                .map(notification -> ServerSentEvent.<Notification>builder()
                        .id(notification.getId())
                        .event(notification.getType())
                        .data(notification)
                        .retry(Duration.ofSeconds(5))
                        .build());
    }
}
```

### Spring MVC SSE (SseEmitter)

```java
@RestController
@RequestMapping("/api/v1/sse")
public class SseController {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @GetMapping("/subscribe")
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        emitters.add(emitter);
        return emitter;
    }

    public void sendToAll(String eventName, Object data) {
        List<SseEmitter> deadEmitters = new ArrayList<>();

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        });

        emitters.removeAll(deadEmitters);
    }
}
```

### JavaScript EventSource API

```javascript
// SSE 연결
const eventSource = new EventSource('/api/v1/events');

// 기본 메시지 핸들러
eventSource.onmessage = (event) => {
    console.log('Message:', event.data);
};

// 특정 이벤트 타입 핸들러
eventSource.addEventListener('user-update', (event) => {
    const data = JSON.parse(event.data);
    console.log('User update:', data);
});

// 연결 상태 핸들러
eventSource.onopen = () => console.log('Connected');
eventSource.onerror = (error) => console.error('Error:', error);

// 연결 종료
eventSource.close();
```

---

## WebSocket

단일 TCP 연결에서 전이중(Full-Duplex) 양방향 통신을 제공하는 프로토콜

### WebSocket vs HTTP

```
┌─────────────────────────────────────────────────────────────────┐
│                   WebSocket vs HTTP 비교                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   HTTP                              WebSocket                   │
│  ┌─────────────────────┐          ┌─────────────────────┐      │
│  │                     │          │                     │      │
│  │  요청 → 응답 → 종료  │          │  핸드셰이크 → 연결 유지│      │
│  │  요청 → 응답 → 종료  │          │      ↕ 양방향 통신    │      │
│  │  요청 → 응답 → 종료  │          │      ↕ 양방향 통신    │      │
│  │                     │          │         ...          │      │
│  │  매번 연결/해제      │          │  한 번 연결, 계속 사용│      │
│  │  헤더 오버헤드 큼    │          │  2바이트 프레임       │      │
│  │                     │          │                     │      │
│  └─────────────────────┘          └─────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket 핸드셰이크

```http
# 클라이언트 요청
GET /chat HTTP/1.1
Host: server.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

# 서버 응답
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### Spring WebSocket 구현

```java
// WebSocket 설정
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler(), "/ws/chat")
                .setAllowedOrigins("*");
    }

    @Bean
    public WebSocketHandler chatHandler() {
        return new ChatWebSocketHandler();
    }
}
```

```java
// WebSocket 핸들러
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("New connection: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        log.info("Received: {}", payload);

        // 모든 클라이언트에게 브로드캐스트
        sessions.forEach(s -> {
            try {
                s.sendMessage(new TextMessage("Echo: " + payload));
            } catch (IOException e) {
                log.error("Send failed", e);
            }
        });
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("Connection closed: {}", session.getId());
    }
}
```

### STOMP over WebSocket

```java
// STOMP 설정 (메시지 브로커 패턴)
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketStompConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("*")
                .withSockJS();
    }
}
```

```java
// STOMP 컨트롤러
@Controller
public class ChatController {

    @MessageMapping("/chat.send")
    @SendTo("/topic/messages")
    public ChatMessage sendMessage(ChatMessage message) {
        return message;
    }

    @MessageMapping("/chat.join")
    @SendTo("/topic/users")
    public ChatMessage addUser(@Payload ChatMessage message,
                               SimpMessageHeaderAccessor headerAccessor) {
        headerAccessor.getSessionAttributes().put("username", message.getSender());
        return message;
    }
}
```

### JavaScript WebSocket API

```javascript
// WebSocket 연결
const socket = new WebSocket('ws://localhost:8080/ws/chat');

// 연결 성공
socket.onopen = () => {
    console.log('Connected to WebSocket');
    socket.send(JSON.stringify({ type: 'join', user: 'John' }));
};

// 메시지 수신
socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
};

// 에러 처리
socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
};

// 연결 종료
socket.onclose = (event) => {
    console.log('Disconnected:', event.code, event.reason);
};

// 메시지 전송
socket.send(JSON.stringify({ type: 'message', content: 'Hello!' }));

// 연결 닫기
socket.close();
```

---

## WebHook

서버 간 이벤트 알림을 위한 HTTP 콜백 메커니즘

### WebHook 동작 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                      WebHook 동작 흐름                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. 웹훅 등록                                                   │
│   ┌──────────────┐                    ┌──────────────┐         │
│   │  Subscriber  │─── POST /webhooks ─►│   Provider   │         │
│   │  (구독자 서버) │  {url: callback}    │ (이벤트 발생) │         │
│   └──────────────┘◄─── 201 Created ───└──────────────┘         │
│                                                                 │
│   2. 이벤트 발생 시                                               │
│   ┌──────────────┐                    ┌──────────────┐         │
│   │  Subscriber  │◄── POST /callback ──│   Provider   │         │
│   │              │   {event: "..."}    │  이벤트 발생! │         │
│   │              │                     │              │         │
│   │ 이벤트 처리   │─── 200 OK ─────────►│ 전송 완료 확인│         │
│   └──────────────┘                    └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### WebHook 페이로드 예시

```json
// GitHub WebHook 예시
{
    "action": "opened",
    "number": 123,
    "pull_request": {
        "id": 456,
        "title": "Fix bug",
        "user": {
            "login": "developer"
        }
    },
    "repository": {
        "full_name": "org/repo"
    }
}
```

### WebHook 수신 구현

```java
@RestController
@RequestMapping("/api/v1/webhooks")
public class WebhookController {

    @PostMapping("/github")
    public ResponseEntity<Void> handleGithubWebhook(
            @RequestHeader("X-GitHub-Event") String eventType,
            @RequestHeader("X-Hub-Signature-256") String signature,
            @RequestBody String payload) {

        // 시그니처 검증
        if (!verifySignature(payload, signature)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // 이벤트 타입별 처리
        switch (eventType) {
            case "push":
                handlePushEvent(payload);
                break;
            case "pull_request":
                handlePullRequestEvent(payload);
                break;
            default:
                log.info("Unhandled event: {}", eventType);
        }

        return ResponseEntity.ok().build();
    }

    private boolean verifySignature(String payload, String signature) {
        String expected = "sha256=" + HmacUtils.hmacSha256Hex(webhookSecret, payload);
        return MessageDigest.isEqual(expected.getBytes(), signature.getBytes());
    }
}
```

### WebHook 발신 구현

```java
@Service
public class WebhookService {

    private final WebClient webClient;
    private final WebhookRepository webhookRepository;

    public void sendWebhook(String eventType, Object payload) {
        List<Webhook> subscribers = webhookRepository.findByEventType(eventType);

        subscribers.forEach(webhook -> {
            sendWithRetry(webhook, eventType, payload);
        });
    }

    private void sendWithRetry(Webhook webhook, String eventType, Object payload) {
        int maxRetries = 3;
        int retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                webClient.post()
                        .uri(webhook.getCallbackUrl())
                        .header("X-Webhook-Event", eventType)
                        .header("X-Webhook-Signature", generateSignature(payload))
                        .bodyValue(payload)
                        .retrieve()
                        .toBodilessEntity()
                        .block(Duration.ofSeconds(10));

                log.info("Webhook sent successfully to {}", webhook.getCallbackUrl());
                return;

            } catch (Exception e) {
                retryCount++;
                log.warn("Webhook failed (attempt {}): {}", retryCount, e.getMessage());

                if (retryCount < maxRetries) {
                    try {
                        Thread.sleep(1000L * retryCount); // Exponential backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }

        log.error("Webhook failed after {} attempts: {}", maxRetries, webhook.getCallbackUrl());
    }
}
```

---

## 실시간 통신 기술 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                   실시간 통신 기술 비교                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              SSE              WebSocket           WebHook       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   서버 → 클라이언트│  │   ◄── 양방향 ──►│  │   서버 → 서버   │ │
│  │      단방향      │  │                 │  │     단방향      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  • HTTP 기반         • TCP 기반          • HTTP POST 콜백      │
│  • 자동 재연결       • 직접 재연결 구현   • 재시도 로직 필요    │
│  • 텍스트만 전송     • 바이너리 지원      • JSON 페이로드       │
│  • 브라우저 지원     • 브라우저 + 서버    • 서버 간 통신        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 특성 | SSE | WebSocket | WebHook |
|------|-----|-----------|---------|
| **통신 방향** | 단방향 (서버→클라이언트) | 양방향 | 단방향 (서버→서버) |
| **프로토콜** | HTTP | WebSocket (ws://, wss://) | HTTP |
| **연결 유지** | O | O | X (요청 시에만) |
| **자동 재연결** | O (브라우저 내장) | X (직접 구현) | N/A |
| **바이너리 지원** | X (텍스트만) | O | O |
| **사용 사례** | 알림, 피드 | 채팅, 게임 | 서비스 통합 |

### 기술 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                     기술 선택 가이드                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   질문                                      권장 기술            │
│  ┌────────────────────────────────────┬───────────────────┐    │
│  │ 서버→클라이언트 단방향 실시간?       │ SSE               │    │
│  │ 예: 알림, 주식 시세, 뉴스 피드       │                   │    │
│  ├────────────────────────────────────┼───────────────────┤    │
│  │ 클라이언트↔서버 양방향 실시간?       │ WebSocket         │    │
│  │ 예: 채팅, 협업 도구, 게임            │                   │    │
│  ├────────────────────────────────────┼───────────────────┤    │
│  │ 서버 간 이벤트 알림?                 │ WebHook           │    │
│  │ 예: CI/CD 트리거, 결제 알림          │                   │    │
│  ├────────────────────────────────────┼───────────────────┤    │
│  │ 방화벽/프록시 제약이 심한 환경?      │ SSE (HTTP 기반)   │    │
│  ├────────────────────────────────────┼───────────────────┤    │
│  │ 바이너리 데이터 전송 필요?           │ WebSocket         │    │
│  └────────────────────────────────────┴───────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## REST의 대안과 미래

### GraphQL

Facebook이 개발한 쿼리 언어로, 클라이언트가 필요한 데이터만 정확히 요청할 수 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST vs GraphQL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   REST                               GraphQL                    │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ GET /users/1            │       │ query {                 │ │
│  │ GET /users/1/posts      │       │   user(id: 1) {         │ │
│  │ GET /users/1/followers  │       │     name                │ │
│  │                         │       │     posts { title }     │ │
│  │ → 3번의 요청            │       │     followers { name }  │ │
│  │ → Over-fetching 가능    │       │   }                     │ │
│  │                         │       │ }                       │ │
│  │                         │       │ → 1번의 요청, 필요한것만│ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 특성 | REST | GraphQL |
|------|------|---------|
| **엔드포인트** | 리소스별 여러 개 | 단일 엔드포인트 |
| **데이터 페칭** | Over/Under-fetching 가능 | 필요한 것만 정확히 |
| **버저닝** | URL 버전 (/v1/, /v2/) | 스키마 진화 |
| **캐싱** | HTTP 캐싱 활용 | 별도 구현 필요 |
| **학습 곡선** | 낮음 | 높음 |

### gRPC

Google이 개발한 고성능 RPC 프레임워크로, Protocol Buffers를 사용해 바이너리 직렬화

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST vs gRPC                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   REST/JSON                          gRPC/Protobuf              │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ {                       │       │ message User {          │ │
│  │   "id": 123,            │       │   int32 id = 1;         │ │
│  │   "name": "John",       │       │   string name = 2;      │ │
│  │   "email": "j@mail.com" │       │   string email = 3;     │ │
│  │ }                       │       │ }                       │ │
│  │                         │       │                         │ │
│  │ → 텍스트 기반, 사람 가독│       │ → 바이너리, 더 빠름     │ │
│  │ → HTTP/1.1             │       │ → HTTP/2, 스트리밍      │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 특성 | REST | gRPC |
|------|------|------|
| **프로토콜** | HTTP/1.1 | HTTP/2 |
| **포맷** | JSON (텍스트) | Protobuf (바이너리) |
| **스트리밍** | 제한적 | 네이티브 지원 |
| **코드 생성** | 선택적 | 필수 (IDL) |
| **브라우저** | 네이티브 지원 | gRPC-Web 필요 |
| **사용 사례** | 공개 API | 마이크로서비스 간 통신 |

---

## 마이크로서비스와 REST

### 모노리스 vs 마이크로서비스

```
┌─────────────────────────────────────────────────────────────────┐
│              모노리스 vs 마이크로서비스 아키텍처                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Monolithic                         Microservices              │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ ┌─────────────────────┐ │       │ ┌───┐ ┌───┐ ┌───┐ ┌───┐│ │
│  │ │   User Service      │ │       │ │ U │ │ O │ │ P │ │ N ││ │
│  │ ├─────────────────────┤ │       │ │ s │ │ r │ │ a │ │ o ││ │
│  │ │   Order Service     │ │       │ │ e │ │ d │ │ y │ │ t ││ │
│  │ ├─────────────────────┤ │       │ │ r │ │ e │ │ m │ │ i ││ │
│  │ │   Payment Service   │ │       │ │   │ │ r │ │ e │ │ f ││ │
│  │ ├─────────────────────┤ │       │ │   │ │   │ │ n │ │ y ││ │
│  │ │   Notification      │ │       │ │   │ │   │ │ t │ │   ││ │
│  │ └─────────────────────┘ │       │ └───┘ └───┘ └───┘ └───┘│ │
│  │                         │       │   ↕     ↕     ↕     ↕  │ │
│  │     Single Deployment   │       │      REST / gRPC       │ │
│  │     Single Database     │       │   각자 독립 DB 가능     │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│   • 배포 단위: 전체          • 배포 단위: 서비스별              │
│   • 확장: 전체 복제          • 확장: 필요한 서비스만            │
│   • 장애: 전체 영향          • 장애: 해당 서비스만              │
│   • 기술: 단일 스택          • 기술: 서비스별 선택 가능         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 마이크로서비스 장점

| 장점 | 설명 |
|------|------|
| **단순성** | 각 서비스가 단일 책임, 이해하기 쉬움 |
| **독립 배포** | 다른 서비스 영향 없이 배포 가능 |
| **확장성** | 필요한 서비스만 선택적 확장 |
| **기술 자유** | 서비스별 최적 기술 스택 선택 |
| **장애 격리** | 한 서비스 장애가 전체로 전파 안 됨 |
| **팀 자율성** | 서비스별 독립 팀 운영 가능 |

### API Gateway 패턴

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway 패턴                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Clients                  API Gateway            Services      │
│  ┌──────────┐            ┌──────────────┐      ┌──────────┐   │
│  │  Web     │────────────│              │──────│  User    │   │
│  └──────────┘            │              │      └──────────┘   │
│  ┌──────────┐            │   • 라우팅    │      ┌──────────┐   │
│  │  Mobile  │────────────│   • 인증     │──────│  Order   │   │
│  └──────────┘            │   • Rate Limit│      └──────────┘   │
│  ┌──────────┐            │   • 로깅     │      ┌──────────┐   │
│  │  Partner │────────────│   • 캐싱     │──────│  Payment │   │
│  └──────────┘            │              │      └──────────┘   │
│                          └──────────────┘                      │
│                                                                 │
│   단일 진입점, 횡단 관심사 처리, 서비스 추상화                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| **Polling** | 클라이언트가 주기적으로 서버에 요청하는 방식 |
| **Long Polling** | 응답이 있을 때까지 연결 유지하는 폴링 |
| **SSE** | Server-Sent Events, 서버→클라이언트 단방향 스트리밍 |
| **WebSocket** | 전이중 양방향 실시간 통신 프로토콜 |
| **WebHook** | 이벤트 발생 시 등록된 URL로 HTTP 콜백 |
| **STOMP** | Simple Text Oriented Messaging Protocol |
| **PubSub** | 발행-구독 메시징 패턴 |
| **GraphQL** | 클라이언트 주도 쿼리 언어 |
| **gRPC** | Google의 고성능 RPC 프레임워크 |
| **Protocol Buffers** | 구조화된 데이터 바이너리 직렬화 포맷 |
| **마이크로서비스** | 독립 배포 가능한 소규모 서비스 아키텍처 |
| **API Gateway** | 마이크로서비스 단일 진입점 |
| **QoS** | Quality of Service, 서비스 품질 |
