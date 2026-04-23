---
title: "31. 메일 서버의 구조 (SMTP와 POP3)"
weight: 31
---

## 1. 이메일 시스템 개요

이메일은 송신과 수신에 서로 다른 프로토콜을 사용한다. 송신은 SMTP, 수신은 POP3 또는 IMAP이 담당하며, 이들 프로토콜은 서로 다른 포트를 쓰고 독립적으로 동작한다.

### 역할 분리

| 프로토콜 | 역할 | 기본 포트 | 보안 포트 |
|:---|:---|:---|:---|
| SMTP | 메일 송신, 서버 간 릴레이 | 25, 587 | 465 (SMTPS) |
| POP3 | 메일 수신 (다운로드) | 110 | 995 (POP3S) |
| IMAP | 메일 수신 (서버 보관, 동기화) | 143 | 993 (IMAPS) |

### 전체 전송 흐름

```
[발신 클라이언트]
      │ SMTP (587)
      ▼
[발신 메일 서버]
      │ DNS MX 조회
      │ SMTP (25)
      ▼
[수신 메일 서버]
      │ 메일박스 저장
      ▲
      │ POP3/IMAP
[수신 클라이언트]
```

1. 발신자가 SMTP로 자신의 메일 서버에 메시지를 보낸다.
2. 발신 서버는 수신 도메인의 MX 레코드를 조회해 수신 서버로 릴레이한다.
3. 수신 서버는 메일박스에 저장한다.
4. 수신자가 POP3 또는 IMAP으로 메일박스에서 메일을 가져간다.

---

## 2. SMTP

SMTP(Simple Mail Transfer Protocol)는 TCP 기반 텍스트 프로토콜이다. 원래 7비트 ASCII만 지원하므로 첨부파일이나 한글은 MIME으로 인코딩한다.

### 주요 포트

| 포트 | 용도 |
|:---|:---|
| 25 | 서버 간 메일 릴레이 (일부 ISP 차단) |
| 587 | 클라이언트 제출(Submission), 인증 필수 |
| 465 | SMTPS, 처음부터 TLS |

### SMTP 세션 흐름

```
클라이언트           SMTP 서버
    │ TCP 연결          │
    ├──────────────────▶│
    │ 220 Ready         │
    │◀──────────────────┤
    │ EHLO client.com   │
    ├──────────────────▶│
    │ 250-...           │
    │◀──────────────────┤
    │ MAIL FROM:<a@x>   │
    ├──────────────────▶│
    │ 250 OK            │
    │◀──────────────────┤
    │ RCPT TO:<b@y>     │
    ├──────────────────▶│
    │ 250 OK            │
    │◀──────────────────┤
    │ DATA              │
    ├──────────────────▶│
    │ 354 End with "."  │
    │◀──────────────────┤
    │ (헤더+본문)       │
    │ .                 │
    ├──────────────────▶│
    │ 250 Queued        │
    │◀──────────────────┤
    │ QUIT              │
    ├──────────────────▶│
    │ 221 Bye           │
    │◀──────────────────┤
```

### 주요 명령과 응답

| 명령 | 역할 |
|:---|:---|
| HELO / EHLO | 세션 시작, 클라이언트 식별 (EHLO는 확장) |
| MAIL FROM | 송신자 주소 |
| RCPT TO | 수신자 주소 (여러 번 가능) |
| DATA | 메일 헤더·본문 전송 시작 |
| QUIT | 세션 종료 |

| 응답 | 의미 |
|:---|:---|
| 2xx | 성공 (220, 250) |
| 3xx | 추가 정보 필요 (354) |
| 4xx | 일시 오류, 재시도 가능 |
| 5xx | 영구 오류 |

---

## 3. POP3

POP3(Post Office Protocol v3)는 서버에서 메일을 다운로드하는 단순한 프로토콜이다. 기본 동작은 "내려받은 뒤 서버에서 삭제"로, 하나의 기기에서 메일을 관리하는 용도에 적합하다.

### POP3 세션 흐름

```
클라이언트           POP3 서버
    │ TCP 연결 (110)    │
    ├──────────────────▶│
    │ +OK Ready         │
    │◀──────────────────┤
    │ USER alice        │
    ├──────────────────▶│
    │ +OK               │
    │◀──────────────────┤
    │ PASS ****         │
    ├──────────────────▶│
    │ +OK Logged in     │
    │◀──────────────────┤
    │ STAT              │
    ├──────────────────▶│
    │ +OK 3 12345       │
    │◀──────────────────┤
    │ RETR 1            │
    ├──────────────────▶│
    │ (메일 내용)       │
    │◀──────────────────┤
    │ DELE 1            │
    ├──────────────────▶│
    │ QUIT              │
    ├──────────────────▶│
```

### 세션 상태

| 상태 | 의미 |
|:---|:---|
| AUTHORIZATION | 접속 직후, USER/PASS로 인증 |
| TRANSACTION | 인증 후 LIST, RETR, DELE 등 처리 |
| UPDATE | QUIT 시 삭제 표시된 메일 실제 삭제 |

---

## 4. IMAP vs POP3

IMAP(Internet Message Access Protocol)은 메일을 서버에 두고 여러 기기에서 동기화하여 사용하는 프로토콜이다.

| 특성 | POP3 | IMAP |
|:---|:---|:---|
| 메일 보관 | 로컬로 다운로드 | 서버에 보관 |
| 다중 기기 | 동기화 없음 | 상태 동기화 |
| 폴더 관리 | 불가 | 가능 |
| 부분 다운로드 | 불가 | 가능 (헤더만, 첨부 선택) |
| 서버 저장소 | 적음 | 많음 |
| 포트 | 110 / 995 | 143 / 993 |

{{< callout type="info" >}}
오늘날 개인 메일 사용 환경은 스마트폰·노트북·PC를 오가는 경우가 많아 IMAP이 표준에 가깝다. POP3는 백업 보관용이나 저장 공간이 제한된 메일 서버에서 아직 쓰인다.
{{< /callout >}}

---

## 5. 메일 헤더와 MIME

### RFC 822 형식

```
┌───────────────────────────┐
│ From: a@example.com       │
│ To: b@example.com         │
│ Subject: 제목             │
│ Date: ...                 │
│ Content-Type: text/plain  │
├───────────────────────────┤
│ (빈 줄로 헤더/본문 구분)  │
├───────────────────────────┤
│ 메일 본문                 │
└───────────────────────────┘
```

### 주요 헤더

| 헤더 | 역할 |
|:---|:---|
| From / To / Cc / Bcc | 송·수신자 |
| Subject | 제목 |
| Date | 발송 시각 |
| Message-ID | 메일 고유 ID |
| Content-Type | 본문 타입 (text/plain, text/html, multipart/mixed) |
| Received | 경유 서버 이력 |

### MIME

SMTP는 7비트 ASCII만 안전하게 전송하므로, 한글이나 바이너리 첨부파일은 MIME(Multipurpose Internet Mail Extensions)으로 인코딩한다.

```
MIME-Version: 1.0
Content-Type: multipart/mixed;
  boundary="b123"

--b123
Content-Type: text/plain; charset=UTF-8

본문 텍스트

--b123
Content-Type: application/pdf;
  name="doc.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQK...
--b123--
```

---

## 6. 메일 보안

### 전송 암호화

| 방식 | 포트 | 특징 |
|:---|:---|:---|
| STARTTLS | 587, 143 | 평문 연결 후 TLS로 업그레이드 |
| SMTPS/POP3S/IMAPS | 465, 995, 993 | 처음부터 TLS |

### 인증·위조 방지

- **SMTP AUTH**: Submission 포트(587)에서 사용자 인증 후 릴레이 허용
- **SPF**: 도메인이 허용한 발신 서버 IP 목록을 TXT 레코드로 공개
- **DKIM**: 메일에 디지털 서명, 공개키는 DNS로 배포
- **DMARC**: SPF/DKIM 결과에 따른 정책(none/quarantine/reject) 지정

{{< callout type="warning" >}}
SPF·DKIM·DMARC를 설정하지 않으면 정상 메일도 스팸으로 분류되거나 수신 거부될 수 있다. 기업 도메인에서는 반드시 세 가지를 함께 설정한다.
{{< /callout >}}

---

## 7. 실무 도구

### 수동 테스트

```bash
# SMTP (평문)
telnet smtp.example.com 25

# STARTTLS
openssl s_client \
  -connect smtp.example.com:587 \
  -starttls smtp -crlf

# POP3S
openssl s_client \
  -connect pop.example.com:995 -crlf

# IMAPS
openssl s_client \
  -connect imap.example.com:993 -crlf
```

### MX 조회

```bash
dig example.com MX +short
nslookup -type=MX example.com
host -t MX example.com
```

### 메일 큐(Postfix)

```bash
mailq                 # 큐 확인
postqueue -f          # 재전송 시도
postsuper -d ALL      # 전체 삭제
tail -f /var/log/mail.log
```

---

## 핵심 정리

| 항목 | 내용 |
|:---|:---|
| 송신 | SMTP (25, 587), TLS: 465 |
| 수신 | POP3 (110/995), IMAP (143/993) |
| 다중 기기 | IMAP 권장 |
| 위조 방지 | SPF, DKIM, DMARC 병행 |
| 서버 간 릴레이 | MX 레코드로 수신 서버 확인 |

{{< callout type="info" >}}
**용어 정리**
- **SMTP**: 메일 송신·릴레이 프로토콜
- **POP3**: 서버에서 내려받는 수신 프로토콜
- **IMAP**: 서버에 두고 동기화하는 수신 프로토콜
- **MIME**: 이메일에서 비ASCII/첨부파일을 다루기 위한 인코딩 체계
- **STARTTLS**: 평문 연결을 TLS로 전환하는 확장 명령
{{< /callout >}}
