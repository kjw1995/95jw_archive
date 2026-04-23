---
title: "06. 실시간 API와 REST의 미래"
weight: 6
---

## 1. 실시간 API 개요

전통적인 요청-응답 방식의 REST API는 클라이언트가 필요할 때만 데이터를 가져오는 **Pull 모델**이다. 실시간 API는 서버에서 이벤트가 발생하면 즉시 클라이언트에게 전달하는 **Push 모델**을 지원한다.

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

## 2. 폴링의 한계

폴링(Polling)은 클라이언트가 주기적으로 서버에 요청을 보내 데이터 변경을 확인하는 방식이다.

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

| 문제점 | 설명 |
|:---|:---|
| 대역폭 낭비 | 빈 응답에도 네트워크 비용 발생 |
| 서버 부하 | 불필요한 요청 처리 누적 |
| 실시간성 부족 | 폴링 간격만큼 지연 |
| 확장성 저하 | 클라이언트 증가 시 부하 급증 |

### 폴링의 대안

| 기술 | 방식 | 방향 | 실시간성 |
|:---|:---|:---|:---|
| Long Polling | 응답 대기 연장 | 단방향 | 중간 |
| SSE | 이벤트 스트리밍 | 단방향 (서버→클) | 높음 |
| WebSocket | 양방향 소켓 | 양방향 | 높음 |
| WebHook | HTTP 콜백 | 단방향 (서버→서버) | 높음 |

## 3. SSE (Server-Sent Events)

HTML5 표준 기술로, 서버에서 클라이언트로 이벤트를 실시간 푸시하는 **단방향 통신** 방식이다.

### SSE 동작 흐름

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

### SSE 메시지 형식

```text
# 기본 메시지
data: Hello World\n\n

# 여러 줄 메시지
data: Line 1\n
data: Line 2\n\n

# 이벤트 ID + 타입 지정
id: 12345\n
event: user-update\n
data: {"userId":123,"status":"online"}\n\n

# 재연결 간격 설정 (밀리초)
retry: 5000\n
data: Connection settings updated\n\n
```

### SSE 필드

| 필드 | 설명 |
|:---|:---|
| data | 이벤트 데이터 (필수) |
| event | 이벤트 타입 (기본: message) |
| id | 이벤트 ID (재연결 시 Last-Event-ID로 전송) |
| retry | 재연결 대기 시간 (ms) |

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

## 4. WebSocket

단일 TCP 연결에서 **전이중(Full-Duplex) 양방향 통신**을 제공하는 프로토콜이다.

### WebSocket vs HTTP

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
한 번 연결, 2B 프레임
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

## 5. WebHook

서버 간 이벤트 알림을 위한 **HTTP 콜백 메커니즘**이다.

### WebHook 동작 흐름

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

{{< callout type="warning" >}}
WebHook 수신 엔드포인트는 **반드시 시그니처를 검증**해야 한다. 공개 URL로 노출되기 때문에 HMAC 서명 확인 없이는 누구든 위조 요청을 보낼 수 있다.
{{< /callout >}}

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

## 6. 실시간 통신 기술 비교

```text
[SSE]         서버 → 클라이언트
              단방향

[WebSocket]   ◄── 양방향 ──►

[WebHook]     서버 → 서버
              단방향
```

| 특성 | SSE | WebSocket | WebHook |
|:---|:---|:---|:---|
| 통신 방향 | 단방향 (S→C) | 양방향 | 단방향 (S→S) |
| 프로토콜 | HTTP | ws://, wss:// | HTTP |
| 연결 유지 | O | O | X (요청 시) |
| 자동 재연결 | O (내장) | X (직접 구현) | N/A |
| 바이너리 | X | O | O |
| 사용 사례 | 알림, 피드 | 채팅, 게임 | 서비스 통합 |

### 기술 선택 가이드

| 질문 | 권장 기술 |
|:---|:---|
| 서버→클라이언트 단방향 실시간? (알림, 주식 시세, 피드) | SSE |
| 클라이언트↔서버 양방향 실시간? (채팅, 협업, 게임) | WebSocket |
| 서버 간 이벤트 알림? (CI/CD, 결제 알림) | WebHook |
| 방화벽/프록시 제약이 심한 환경? | SSE (HTTP 기반) |
| 바이너리 데이터 전송 필요? | WebSocket |

{{< callout type="info" >}}
SSE는 **HTTP 위에서 동작**하므로 기존 인프라(로드밸런서, 방화벽)와 호환성이 좋고, 브라우저가 끊어진 연결을 자동 복구한다. 양방향이 꼭 필요하지 않다면 WebSocket보다 먼저 고려한다.
{{< /callout >}}

## 7. REST의 대안과 미래

### GraphQL

Facebook이 개발한 쿼리 언어로, 클라이언트가 **필요한 데이터만 정확히** 요청할 수 있다.

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

| 특성 | REST | GraphQL |
|:---|:---|:---|
| 엔드포인트 | 리소스별 여러 개 | 단일 엔드포인트 |
| 데이터 페칭 | Over/Under-fetching 가능 | 필요한 것만 |
| 버저닝 | URL 버전 (/v1, /v2) | 스키마 진화 |
| 캐싱 | HTTP 캐싱 활용 | 별도 구현 |
| 학습 곡선 | 낮음 | 높음 |

### gRPC

Google이 개발한 고성능 RPC 프레임워크로, **Protocol Buffers**를 사용해 바이너리 직렬화한다.

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

| 특성 | REST | gRPC |
|:---|:---|:---|
| 프로토콜 | HTTP/1.1 | HTTP/2 |
| 포맷 | JSON (텍스트) | Protobuf (바이너리) |
| 스트리밍 | 제한적 | 네이티브 지원 |
| 코드 생성 | 선택적 | 필수 (IDL) |
| 브라우저 | 네이티브 지원 | gRPC-Web 필요 |
| 사용 사례 | 공개 API | 마이크로서비스 간 통신 |

## 8. 마이크로서비스와 REST

### 모노리스 vs 마이크로서비스

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

| 관점 | 모노리스 | 마이크로서비스 |
|:---|:---|:---|
| 배포 단위 | 전체 | 서비스별 |
| 확장 | 전체 복제 | 필요한 서비스만 |
| 장애 | 전체 영향 | 해당 서비스만 |
| 기술 | 단일 스택 | 서비스별 선택 |

### 마이크로서비스 장점

| 장점 | 설명 |
|:---|:---|
| 단순성 | 각 서비스가 단일 책임, 이해하기 쉬움 |
| 독립 배포 | 다른 서비스 영향 없이 배포 |
| 확장성 | 필요한 서비스만 선택적 확장 |
| 기술 자유 | 서비스별 최적 기술 스택 |
| 장애 격리 | 한 서비스 장애가 전체로 전파 안 됨 |
| 팀 자율성 | 서비스별 독립 팀 운영 |

### API Gateway 패턴

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

## 9. 핵심 정리

| 용어 | 설명 |
|:---|:---|
| Polling | 클라이언트가 주기적으로 서버에 요청 |
| Long Polling | 응답이 있을 때까지 연결 유지 |
| SSE | 서버→클라이언트 단방향 스트리밍 |
| WebSocket | 전이중 양방향 실시간 프로토콜 |
| WebHook | 이벤트 발생 시 등록 URL로 HTTP 콜백 |
| STOMP | Simple Text Oriented Messaging Protocol |
| PubSub | 발행-구독 메시징 패턴 |
| GraphQL | 클라이언트 주도 쿼리 언어 |
| gRPC | Google의 고성능 RPC 프레임워크 |
| Protocol Buffers | 구조화된 데이터 바이너리 직렬화 포맷 |
| 마이크로서비스 | 독립 배포 가능한 소규모 서비스 아키텍처 |
| API Gateway | 마이크로서비스 단일 진입점 |
| QoS | Quality of Service, 서비스 품질 |
