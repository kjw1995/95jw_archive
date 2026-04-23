---
title: "29. 웹 서버의 구조"
weight: 29
---

## 1. 웹의 기본 구조

웹(WWW)은 하이퍼텍스트로 연결된 문서들을 인터넷을 통해 공유하는 시스템이다. 웹 브라우저(클라이언트)가 웹 서버에 HTTP 요청을 보내면, 서버가 HTML과 관련 리소스를 응답으로 돌려준다.

### 3가지 핵심 기술

| 기술 | 역할 |
|:---|:---|
| HTML | 문서의 구조와 내용을 정의 |
| URL | 리소스의 위치를 지정 |
| HTTP | 클라이언트-서버 간 통신 규약 |

### 전체 흐름

```
[사용자]
   │ URL 입력
   ▼
[브라우저]
   │ DNS 조회 → IP
   │ HTTP 요청
   ▼
[웹 서버]
   │ 파일/동적 처리
   ▼
[브라우저]
   │ HTML 파싱, 렌더링
   ▼
[사용자 화면]
```

---

## 2. 클라이언트-서버 모델

웹은 전형적인 요청-응답 모델이다. 브라우저가 먼저 요청을 보내고, 서버가 대응하는 응답을 반환한다.

```
[웹 브라우저]        [웹 서버 :80]
     │  GET /index     │
     │ ───────────────▶│
     │                 │ 리소스 조회
     │  200 OK + HTML  │
     │ ◀─────────────── │
     │                 │
```

### 정적 콘텐츠 vs 동적 콘텐츠

| 구분 | 정적 콘텐츠 | 동적 콘텐츠 |
|:---|:---|:---|
| 예시 | HTML, CSS, JS, 이미지 | 검색 결과, 대시보드 |
| 처리 | 디스크의 파일을 그대로 전송 | WAS/스크립트가 실시간 생성 |
| 속도 | 빠름, 캐시 용이 | 상대적으로 느림 |
| 예 기술 | Nginx, Apache 기본 | PHP, Node.js, Spring |

{{< callout type="info" >}}
실제 서비스는 정적과 동적을 섞어 쓴다. 앞단 웹 서버가 정적 리소스를 캐싱·직접 응답하고, 동적 요청만 뒤쪽 애플리케이션 서버(WAS)로 프록시하는 구성이 일반적이다.
{{< /callout >}}

---

## 3. HTML

HTML(HyperText Markup Language)은 태그로 문서 구조를 표현하는 마크업 언어다. 하이퍼링크로 문서를 서로 연결하여 웹의 "거미줄" 구조를 만든다.

### 기본 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>예제</title>
</head>
<body>
  <h1>제목</h1>
  <p><a href="about.html">소개</a></p>
</body>
</html>
```

### 주요 태그 분류

| 분류 | 태그 |
|:---|:---|
| 구조 | html, head, body, header, footer, main, nav |
| 텍스트 | h1~h6, p, strong, em, span |
| 링크/미디어 | a, img, video, audio |
| 목록/표 | ul, ol, li, table, tr, td, th |
| 폼 | form, input, button, textarea |

---

## 4. URL

URL(Uniform Resource Locator)은 웹 리소스의 위치를 나타내는 주소 체계다.

```
https://www.example.com:443/path/page?id=1#top
└─┬─┘   └──────┬──────┘└┬┘└────┬────┘└─┬──┘└┬┘
  │           │         │      │       │    │
  스킴       호스트     포트   경로    쿼리 프래그먼트
```

| 구성 | 설명 | 예시 |
|:---|:---|:---|
| 스킴 | 프로토콜 | `https`, `http`, `ftp` |
| 호스트 | 도메인 또는 IP | `www.example.com` |
| 포트 | 서비스 포트 (생략 시 기본값) | `:443` |
| 경로 | 서버 내 리소스 위치 | `/path/page` |
| 쿼리 | 추가 파라미터 | `?id=1&name=a` |
| 프래그먼트 | 페이지 내 위치 (서버로 전송 안 됨) | `#top` |

---

## 5. HTTP 프로토콜

HTTP(HyperText Transfer Protocol)는 웹의 통신 규약이다. 텍스트 기반이며 TCP 위에서 동작한다.

- 포트: HTTP 80, HTTPS 443
- 특징: 무상태(stateless), 요청-응답 기반
- 확장성: 헤더로 다양한 정보 전달

### 요청 메시지 구조

```
GET /index.html HTTP/1.1         ← 요청 라인
Host: www.example.com            ┐
User-Agent: Mozilla/5.0          │ 헤더
Accept: text/html                ┘
                                 ← 빈 줄
(본문, POST 등에서 사용)         ← 본문
```

### 응답 메시지 구조

```
HTTP/1.1 200 OK                  ← 상태 라인
Content-Type: text/html          ┐
Content-Length: 1234             │ 헤더
Server: nginx/1.25               ┘
                                 ← 빈 줄
<html>...</html>                 ← 본문
```

### 주요 메서드

| 메서드 | 의미 |
|:---|:---|
| GET | 리소스 조회 |
| POST | 데이터 전송, 생성 |
| PUT | 리소스 전체 교체 |
| PATCH | 리소스 부분 수정 |
| DELETE | 리소스 삭제 |
| HEAD | 헤더만 조회 |
| OPTIONS | 지원 메서드 조회 (CORS preflight) |

### 주요 상태 코드

| 범위 | 의미 | 예 |
|:---|:---|:---|
| 1xx | 정보 | 100 Continue |
| 2xx | 성공 | 200 OK, 201 Created |
| 3xx | 리다이렉션 | 301, 302, 304 |
| 4xx | 클라이언트 오류 | 400, 401, 403, 404 |
| 5xx | 서버 오류 | 500, 502, 503, 504 |

---

## 6. HTTP 버전 변천사

| 버전 | 연결 | 처리 | 특징 |
|:---|:---|:---|:---|
| HTTP/1.0 | 요청마다 새 연결 | 순차 | 오버헤드 큼 |
| HTTP/1.1 | Keep-Alive 재사용 | 순차 (파이프라인) | Host 헤더 필수, HOL 문제 |
| HTTP/2 | 단일 연결 멀티플렉싱 | 병렬 스트림 | 이진 프레임, 헤더 압축(HPACK) |
| HTTP/3 | QUIC(UDP) | 병렬 | 연결 설정 단축, 패킷 손실 영향 완화 |

{{< callout type="info" >}}
HTTP/1.1의 Head-of-Line Blocking(HOL)은 같은 연결에서 앞선 요청이 지연되면 뒤의 요청도 막히는 현상이다. HTTP/2의 스트림 멀티플렉싱이 이를 TCP 수준 이외의 영역에서 해소했고, HTTP/3는 QUIC를 도입해 TCP 수준의 HOL까지 완화한다.
{{< /callout >}}

---

## 7. 실무 도구

### curl

```bash
curl -v http://www.example.com          # 상세 정보
curl -I http://www.example.com          # 헤더만
curl -X POST https://api.example.com \
     -H "Content-Type: application/json" \
     -d '{"name":"John"}'
curl -L http://short.ly/abc             # 리다이렉션 추적
```

### 브라우저 개발자 도구

- Network 탭: 요청/응답, 타이밍, 크기
- Application 탭: 쿠키, 스토리지
- Console 탭: JS 에러, 로그

### 서버 로그

```
192.168.1.10 - - [07/Jan/2026:12:34:56 +0900]
"GET /index.html HTTP/1.1" 200 1234 "-"
"Mozilla/5.0"
```

---

## 핵심 정리

| 항목 | 내용 |
|:---|:---|
| 통신 모델 | 클라이언트(브라우저) - 서버 요청/응답 |
| 콘텐츠 | 정적(파일) + 동적(WAS 생성) |
| 구성 요소 | HTML(구조), URL(주소), HTTP(통신) |
| 버전 | HTTP/1.1 기본, HTTP/2·3로 성능 개선 |

{{< callout type="info" >}}
**용어 정리**
- **WWW**: 하이퍼텍스트로 연결된 문서 공유 시스템
- **HTML**: 태그로 문서 구조를 표현하는 마크업 언어
- **URL**: 웹 리소스의 주소 체계
- **Keep-Alive**: TCP 연결을 유지해 여러 요청에 재사용하는 HTTP/1.1 기능
- **멀티플렉싱**: 하나의 연결에서 여러 요청/응답을 병렬 처리하는 HTTP/2 기능
{{< /callout >}}
