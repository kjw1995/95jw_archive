---
title: "메일 서버의 구조 (SMTP와 POP3)"
weight: 31
---

# 31. 메일 서버의 구조 (SMTP와 POP3)

메일을 송수신하려면 클라이언트 측의 메일 프로그램과 서버 측의 메일 서버 프로그램 간에 통신을 해야 합니다. 이때 사용되는 프로토콜에는 두 가지 종류가 있습니다.

## 31-1. 이메일 시스템 개요

### 이메일 송수신 프로토콜

이메일 통신에는 목적에 따라 다른 프로토콜을 사용합니다:

```
메일 송신 (보내기):
┌─────────────┐
│    SMTP     │ → Simple Mail Transfer Protocol
│  Port 25    │ → 메일을 보내는 데 사용
└─────────────┘

메일 수신 (받기):
┌─────────────┐
│    POP3     │ → Post Office Protocol version 3
│  Port 110   │ → 메일을 받는 데 사용
└─────────────┘

또는

┌─────────────┐
│    IMAP     │ → Internet Message Access Protocol
│  Port 143   │ → 메일을 관리하는 데 사용 (서버에 보관)
└─────────────┘
```

### 전체 메일 전송 과정

```
[컴퓨터 1]            [메일 서버 1]         [메일 서버 2]            [컴퓨터 2]
(송신자)              (송신자 ISP)          (수신자 ISP)             (수신자)
    │                      │                     │                      │
    │─────① SMTP ─────────→│                     │                      │
    │   (메일 송신)         │                     │                      │
    │                      │                     │                      │
    │                      │──────② SMTP ────────→│                      │
    │                      │  (메일 전송)         │                      │
    │                      │                     │                      │
    │                      │                     │←────③ POP3/IMAP ─────│
    │                      │                     │   (메일 수신)         │
    │                      │                     │                      │
```

**단계별 설명:**

1. **SMTP 송신** (컴퓨터 1 → 메일 서버 1)
   - 사용자가 메일 클라이언트에서 메일 작성
   - SMTP를 사용하여 자신의 메일 서버로 전송

2. **SMTP 전송** (메일 서버 1 → 메일 서버 2)
   - 송신자의 메일 서버가 수신자의 메일 서버로 전송
   - DNS MX 레코드를 조회하여 목적지 메일 서버 확인

3. **POP3/IMAP 수신** (메일 서버 2 ← 컴퓨터 2)
   - 수신자가 자신의 메일 서버에서 메일 다운로드
   - POP3 또는 IMAP 프로토콜 사용

---

## 31-2. SMTP (Simple Mail Transfer Protocol)

### SMTP 개요

SMTP는 이메일을 전송하기 위한 프로토콜입니다:

```
┌────────────────────────────────────────┐
│         SMTP 특징                      │
├────────────────────────────────────────┤
│ • 포트 번호: 25 (기본), 587 (제출)      │
│ • 프로토콜: TCP 기반                    │
│ • 연결 방식: 클라이언트-서버            │
│ • 데이터 형식: 7비트 ASCII 텍스트       │
│ • 보안: STARTTLS, SMTPS (포트 465)     │
└────────────────────────────────────────┘
```

### SMTP 포트 번호

```
포트 25  → SMTP (일반 메일 전송)
         ├─ 서버 간 메일 전송
         └─ 일부 ISP가 스팸 방지를 위해 차단

포트 587 → 제출 (Submission)
         ├─ 클라이언트가 메일 서버로 송신
         ├─ 인증 필수
         └─ STARTTLS로 암호화 권장

포트 465 → SMTPS (SMTP over SSL)
         ├─ 암호화된 SMTP 연결
         └─ 초기부터 SSL/TLS 사용
```

### SMTP 세션 과정

컴퓨터 1에서 메일 서버 1로 메일을 보내는 과정:

```
클라이언트                                메일 서버
    │                                        │
    │────────① 연결 수립 (TCP 3-way)─────────→│
    │                                        │
    │←───────② 220 서버 준비 완료 ────────────│
    │                                        │
    │────────③ HELO/EHLO client.com ─────────→│
    │                                        │
    │←───────④ 250 OK ───────────────────────│
    │                                        │
    │────────⑤ MAIL FROM:<sender@ex.com>────→│
    │                                        │
    │←───────⑥ 250 OK ───────────────────────│
    │                                        │
    │────────⑦ RCPT TO:<recv@ex.com> ───────→│
    │                                        │
    │←───────⑧ 250 OK ───────────────────────│
    │                                        │
    │────────⑨ DATA ─────────────────────────→│
    │                                        │
    │←───────⑩ 354 메일 내용 입력 ────────────│
    │                                        │
    │────────⑪ Subject: Hello                │
    │           (메일 본문)                   │
    │           .                             │
    │           ──────────────────────────────→│
    │                                        │
    │←───────⑫ 250 메일 수락 ─────────────────│
    │                                        │
    │────────⑬ QUIT ─────────────────────────→│
    │                                        │
    │←───────⑭ 221 연결 종료 ─────────────────│
    │                                        │
```

### SMTP 명령어

주요 SMTP 명령어:

```
HELO/EHLO   → 세션 시작, 클라이언트 식별
            ├─ HELO: 기본 SMTP
            └─ EHLO: 확장 SMTP (ESMTP)

MAIL FROM   → 송신자 메일 주소 지정
            └─ 예: MAIL FROM:<sender@example.com>

RCPT TO     → 수신자 메일 주소 지정
            ├─ 여러 수신자 가능 (여러 번 사용)
            └─ 예: RCPT TO:<recipient@example.com>

DATA        → 메일 본문 전송 시작
            ├─ 헤더와 본문 전송
            └─ 마침표(.) 한 줄로 종료

QUIT        → 세션 종료
            └─ 연결 닫기

RSET        → 현재 트랜잭션 취소
            └─ 초기 상태로 되돌림

VRFY        → 사용자 주소 확인
            └─ 보안상 대부분 비활성화

NOOP        → 아무 작업도 하지 않음
            └─ 연결 유지 확인용
```

### SMTP 응답 코드

```
2xx → 성공
    ├─ 220: 서비스 준비됨
    ├─ 250: 요청된 작업 완료
    ├─ 251: 사용자가 로컬이 아님, 전달됨
    └─ 252: 확인할 수 없지만 시도해볼 것

3xx → 추가 정보 필요
    └─ 354: 메일 데이터 입력 시작

4xx → 일시적 오류 (재시도 가능)
    ├─ 421: 서비스를 사용할 수 없음
    ├─ 450: 요청된 작업 수행 안 됨 (메일박스 사용 불가)
    └─ 451: 요청된 작업 중단됨 (로컬 오류)

5xx → 영구적 오류 (재시도 불가)
    ├─ 500: 명령 오류
    ├─ 501: 매개변수 오류
    ├─ 502: 명령 구현되지 않음
    ├─ 550: 요청된 작업 수행 안 됨 (메일박스 없음)
    ├─ 551: 사용자가 로컬이 아님
    ├─ 552: 저장 공간 초과
    └─ 553: 메일박스 이름이 허용되지 않음
```

### 실제 SMTP 통신 예제

telnet으로 SMTP 서버에 직접 연결하여 메일 보내기:

```bash
# SMTP 서버 연결
telnet smtp.example.com 25

# 서버 응답
220 smtp.example.com ESMTP Postfix

# 클라이언트 인사
EHLO client.example.com

# 서버 응답
250-smtp.example.com
250-PIPELINING
250-SIZE 10240000
250-VRFY
250-ETRN
250-STARTTLS
250-ENHANCEDSTATUSCODES
250-8BITMIME
250 DSN

# 송신자 지정
MAIL FROM:<alice@example.com>

# 서버 응답
250 2.1.0 Ok

# 수신자 지정
RCPT TO:<bob@example.com>

# 서버 응답
250 2.1.5 Ok

# 메일 본문 입력 시작
DATA

# 서버 응답
354 End data with <CR><LF>.<CR><LF>

# 메일 헤더와 본문 입력
From: alice@example.com
To: bob@example.com
Subject: Test Email
Date: Mon, 7 Jan 2025 10:00:00 +0900

Hello Bob,
This is a test email.

Best regards,
Alice
.

# 서버 응답
250 2.0.0 Ok: queued as 12345ABCDE

# 세션 종료
QUIT

# 서버 응답
221 2.0.0 Bye
```

---

## 31-3. POP3 (Post Office Protocol version 3)

### POP3 개요

POP3는 메일 서버에서 이메일을 다운로드하기 위한 프로토콜입니다:

```
┌────────────────────────────────────────┐
│         POP3 특징                      │
├────────────────────────────────────────┤
│ • 포트 번호: 110 (기본), 995 (SSL)      │
│ • 프로토콜: TCP 기반                    │
│ • 동작 방식: 다운로드 후 삭제           │
│ • 메일 보관: 로컬 컴퓨터에 저장         │
│ • 보안: POP3S (포트 995)               │
└────────────────────────────────────────┘
```

### POP3 포트 번호

```
포트 110 → POP3 (일반 연결)
         ├─ 평문 통신
         └─ 보안 취약

포트 995 → POP3S (POP3 over SSL)
         ├─ 암호화된 POP3 연결
         └─ SSL/TLS 사용
```

### 메일 박스 (Mailbox)

메일 서버에는 메일 박스라고 하는 메일을 보관해 주는 기능이 있습니다:

```
메일 서버
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   사용자: alice@example.com     │   │
│  │   메일박스                       │   │
│  ├─────────────────────────────────┤   │
│  │  ✉ 메일 1 (읽지 않음)           │   │
│  │  ✉ 메일 2 (읽지 않음)           │   │
│  │  ✉ 메일 3 (읽음)                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   사용자: bob@example.com       │   │
│  │   메일박스                       │   │
│  ├─────────────────────────────────┤   │
│  │  ✉ 메일 1 (읽지 않음)           │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### POP3 세션 과정

메일 서버에서 컴퓨터로 메일을 받는 과정:

```
클라이언트                                메일 서버
    │                                        │
    │────────① 연결 수립 (TCP 3-way)─────────→│
    │                                        │
    │←───────② +OK 서버 준비 완료 ────────────│
    │                                        │
    │────────③ USER alice ───────────────────→│
    │                                        │
    │←───────④ +OK 사용자 확인 ───────────────│
    │                                        │
    │────────⑤ PASS secret123 ───────────────→│
    │                                        │
    │←───────⑥ +OK 로그인 성공 ───────────────│
    │                                        │
    │────────⑦ STAT ─────────────────────────→│
    │           (메일 개수 확인)              │
    │                                        │
    │←───────⑧ +OK 3 12345 ──────────────────│
    │           (3개 메일, 총 12345바이트)   │
    │                                        │
    │────────⑨ LIST ─────────────────────────→│
    │           (메일 목록 요청)              │
    │                                        │
    │←───────⑩ +OK                           │
    │           1 2048                        │
    │           2 3072                        │
    │           3 7225                        │
    │           .                             │
    │                                        │
    │────────⑪ RETR 1 ────────────────────────→│
    │           (메일 1 가져오기)             │
    │                                        │
    │←───────⑫ +OK                           │
    │           (메일 내용 전송)              │
    │           .                             │
    │                                        │
    │────────⑬ DELE 1 ────────────────────────→│
    │           (메일 1 삭제 표시)            │
    │                                        │
    │←───────⑭ +OK 삭제 표시됨 ───────────────│
    │                                        │
    │────────⑮ QUIT ─────────────────────────→│
    │                                        │
    │←───────⑯ +OK 연결 종료 (삭제 실행) ─────│
    │                                        │
```

### POP3 명령어

주요 POP3 명령어:

```
USER        → 사용자 이름 지정
            └─ 예: USER alice

PASS        → 비밀번호 지정
            └─ 예: PASS secret123

STAT        → 메일박스 상태 확인
            ├─ 메일 개수와 총 크기 반환
            └─ 예: +OK 3 12345

LIST        → 메일 목록 조회
            ├─ 각 메일의 번호와 크기
            └─ 인자 없으면 전체, 있으면 특정 메일

RETR        → 메일 내용 가져오기
            ├─ 메일 번호를 인자로 받음
            └─ 예: RETR 1

DELE        → 메일 삭제 표시
            ├─ 실제 삭제는 QUIT 시 수행
            └─ 예: DELE 1

RSET        → 삭제 표시 취소
            └─ DELE로 표시된 메일 복구

TOP         → 메일 헤더와 본문 일부 가져오기
            ├─ TOP [메일번호] [줄수]
            └─ 예: TOP 1 10 (메일 1의 상위 10줄)

UIDL        → 메일 고유 ID 조회
            ├─ 메일의 고유 식별자 반환
            └─ 중복 다운로드 방지용

NOOP        → 아무 작업도 하지 않음
            └─ 연결 유지 확인용

QUIT        → 세션 종료
            ├─ 삭제 표시된 메일 실제 삭제
            └─ 연결 닫기
```

### POP3 상태

POP3 세션은 3가지 상태를 가집니다:

```
1. AUTHORIZATION 상태
   ├─ 연결 직후 상태
   ├─ 사용자 인증 진행
   └─ 명령어: USER, PASS, QUIT

2. TRANSACTION 상태
   ├─ 인증 성공 후 상태
   ├─ 메일 조회 및 관리
   └─ 명령어: STAT, LIST, RETR, DELE, RSET, TOP, UIDL, NOOP, QUIT

3. UPDATE 상태
   ├─ QUIT 명령 후 상태
   ├─ 삭제 표시된 메일 실제 삭제
   └─ 연결 종료
```

### POP3 응답

POP3 응답은 두 가지 형식:

```
+OK   → 성공 응답
      └─ 예: +OK Logged in.

-ERR  → 오류 응답
      └─ 예: -ERR Invalid password.
```

### 실제 POP3 통신 예제

telnet으로 POP3 서버에 직접 연결하여 메일 받기:

```bash
# POP3 서버 연결
telnet pop.example.com 110

# 서버 응답
+OK POP3 server ready

# 사용자 이름 입력
USER alice

# 서버 응답
+OK User accepted

# 비밀번호 입력
PASS secret123

# 서버 응답
+OK Logged in.

# 메일 개수 확인
STAT

# 서버 응답
+OK 3 12345

# 메일 목록 조회
LIST

# 서버 응답
+OK
1 2048
2 3072
3 7225
.

# 첫 번째 메일의 헤더만 확인 (상위 0줄)
TOP 1 0

# 서버 응답
+OK
From: bob@example.com
To: alice@example.com
Subject: Hello
Date: Mon, 7 Jan 2025 10:00:00 +0900
.

# 첫 번째 메일 전체 가져오기
RETR 1

# 서버 응답
+OK 2048 octets
From: bob@example.com
To: alice@example.com
Subject: Hello
Date: Mon, 7 Jan 2025 10:00:00 +0900

Hi Alice,

How are you?

Best,
Bob
.

# 첫 번째 메일 삭제 표시
DELE 1

# 서버 응답
+OK Marked for deletion

# 세션 종료 (실제 삭제 수행)
QUIT

# 서버 응답
+OK Logging out.
```

---

## 31-4. IMAP (Internet Message Access Protocol)

### IMAP vs POP3

POP3의 대안으로 IMAP이 많이 사용됩니다:

```
┌──────────────────────────────────────────────────────────┐
│                   POP3 vs IMAP 비교                       │
├───────────────┬──────────────────┬──────────────────────┤
│ 특성          │ POP3             │ IMAP                 │
├───────────────┼──────────────────┼──────────────────────┤
│ 메일 보관     │ 로컬에 다운로드   │ 서버에 보관          │
│ 삭제          │ 서버에서 삭제     │ 서버에서 관리        │
│ 폴더 관리     │ 불가능           │ 가능 (받은편지함 등) │
│ 동기화        │ 없음             │ 모든 기기 동기화     │
│ 읽음 상태     │ 로컬만           │ 서버에서 동기화      │
│ 일부 다운로드 │ 불가능           │ 가능 (첨부파일만 등) │
│ 네트워크 사용 │ 적음             │ 많음                 │
│ 포트 번호     │ 110, 995         │ 143, 993             │
└───────────────┴──────────────────┴──────────────────────┘
```

### IMAP 특징

```
┌────────────────────────────────────────┐
│         IMAP 특징                      │
├────────────────────────────────────────┤
│ • 포트 번호: 143 (기본), 993 (SSL)      │
│ • 프로토콜: TCP 기반                    │
│ • 동작 방식: 서버에 메일 보관           │
│ • 메일 관리: 폴더, 플래그, 검색 지원    │
│ • 동기화: 여러 기기 간 상태 동기화      │
│ • 보안: IMAPS (포트 993)               │
└────────────────────────────────────────┘
```

### IMAP 사용 시나리오

```
시나리오 1: 여러 기기 사용
┌─────────────┐
│  스마트폰   │
└──────┬──────┘
       │
       ├──────→ IMAP 서버 (메일 보관)
       │              ↑
┌──────┴──────┐       │
│  노트북     │───────┘
└─────────────┘
(모든 기기에서 동일한 메일 상태)

시나리오 2: 대용량 첨부파일
┌─────────────────────────────────┐
│ 메일 1: 제목, 본문만 다운로드    │
│ 메일 2: 제목만 다운로드          │
│ 메일 3: 첨부파일만 나중에 다운로드│
└─────────────────────────────────┘
(선택적 다운로드로 대역폭 절약)
```

### 주요 IMAP 명령어

```
LOGIN       → 사용자 인증
            └─ 예: LOGIN alice secret123

SELECT      → 메일박스 선택
            └─ 예: SELECT INBOX

EXAMINE     → 메일박스 읽기 전용 선택
            └─ 예: EXAMINE INBOX

LIST        → 메일박스 목록 조회
            └─ 예: LIST "" "*"

CREATE      → 메일박스 생성
            └─ 예: CREATE Work

DELETE      → 메일박스 삭제
            └─ 예: DELETE Trash

RENAME      → 메일박스 이름 변경
            └─ 예: RENAME OldName NewName

SUBSCRIBE   → 메일박스 구독
            └─ 예: SUBSCRIBE INBOX

FETCH       → 메일 내용 가져오기
            └─ 예: FETCH 1 BODY[]

STORE       → 메일 플래그 변경
            └─ 예: STORE 1 +FLAGS (\Seen)

SEARCH      → 메일 검색
            └─ 예: SEARCH FROM "bob@example.com"

LOGOUT      → 로그아웃
            └─ 연결 종료
```

---

## 31-5. 메일 헤더 구조

### RFC 822 메일 형식

이메일은 헤더와 본문으로 구성됩니다:

```
┌─────────────────────────────────────────┐
│              메일 헤더                  │ ← 메타데이터
├─────────────────────────────────────────┤
│ From: sender@example.com                │
│ To: recipient@example.com               │
│ Subject: 메일 제목                      │
│ Date: Mon, 7 Jan 2025 10:00:00 +0900    │
│ Message-ID: <unique@example.com>        │
│ Content-Type: text/plain; charset=UTF-8 │
├─────────────────────────────────────────┤
│              (빈 줄)                    │ ← 헤더와 본문 구분
├─────────────────────────────────────────┤
│              메일 본문                  │ ← 실제 내용
├─────────────────────────────────────────┤
│ 안녕하세요,                             │
│                                         │
│ 이것은 테스트 메일입니다.                │
│                                         │
│ 감사합니다.                             │
└─────────────────────────────────────────┘
```

### 주요 메일 헤더

```
필수 헤더:
From:           → 송신자 주소
To:             → 수신자 주소
Date:           → 발송 일시

일반 헤더:
Subject:        → 메일 제목
Cc:             → 참조 (Carbon Copy)
Bcc:            → 숨은 참조 (Blind Carbon Copy)
Reply-To:       → 답장 주소
Message-ID:     → 메일 고유 ID

내용 헤더:
Content-Type:   → 콘텐츠 유형
                  ├─ text/plain (일반 텍스트)
                  ├─ text/html (HTML 메일)
                  └─ multipart/mixed (첨부파일 포함)
Content-Transfer-Encoding: → 인코딩 방식
                  ├─ 7bit (기본 ASCII)
                  ├─ 8bit (8비트 문자)
                  ├─ base64 (바이너리 인코딩)
                  └─ quoted-printable (특수문자 인코딩)

전송 헤더:
Received:       → 메일 경유 서버 정보
                  ├─ 여러 개 존재 가능
                  └─ 메일 경로 추적에 사용
Return-Path:    → 반송 주소
X-Mailer:       → 메일 클라이언트 정보
```

### MIME (Multipurpose Internet Mail Extensions)

SMTP는 원래 7비트 ASCII만 지원하므로, 첨부파일이나 한글 등을 보내려면 MIME을 사용합니다:

```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=UTF-8

메일 본문입니다.

--boundary123
Content-Type: application/pdf; name="document.pdf"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="document.pdf"

JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbn...
(base64로 인코딩된 PDF 데이터)

--boundary123--
```

---

## 31-6. 메일 서버 보안

### SMTP 인증 (SMTP AUTH)

스팸 메일 방지를 위해 SMTP 인증이 필요합니다:

```
EHLO client.example.com
250-smtp.example.com
250-AUTH LOGIN PLAIN
250 STARTTLS

AUTH LOGIN
334 VXNlcm5hbWU6
(base64로 인코딩된 사용자 이름 전송)
334 UGFzc3dvcmQ6
(base64로 인코딩된 비밀번호 전송)
235 2.7.0 Authentication successful
```

### TLS/SSL 암호화

평문 통신을 방지하기 위해 TLS/SSL을 사용합니다:

```
방법 1: STARTTLS (명시적 TLS)
┌──────────────────────────────────┐
│ 1. 평문으로 연결                  │
│ 2. STARTTLS 명령 전송             │
│ 3. TLS 핸드셰이크                 │
│ 4. 암호화된 통신 시작             │
└──────────────────────────────────┘

포트:
SMTP: 587 (제출)
POP3: 110 → STARTTLS → 암호화
IMAP: 143 → STARTTLS → 암호화

방법 2: SSL/TLS (암묵적 TLS)
┌──────────────────────────────────┐
│ 1. 처음부터 TLS 연결              │
│ 2. 모든 통신 암호화               │
└──────────────────────────────────┘

포트:
SMTPS: 465
POP3S: 995
IMAPS: 993
```

### SPF, DKIM, DMARC

메일 위조 방지를 위한 인증 기술:

```
SPF (Sender Policy Framework)
├─ DNS TXT 레코드에 허용된 메일 서버 IP 목록 등록
├─ 예: example.com. IN TXT "v=spf1 ip4:203.0.113.0/24 -all"
└─ 수신 서버가 발신 서버 IP 확인

DKIM (DomainKeys Identified Mail)
├─ 메일에 디지털 서명 추가
├─ DNS에 공개키 등록
└─ 수신 서버가 서명 검증

DMARC (Domain-based Message Authentication, Reporting & Conformance)
├─ SPF와 DKIM 결과를 기반으로 정책 적용
├─ 예: _dmarc.example.com. IN TXT "v=DMARC1; p=reject; rua=mailto:admin@example.com"
└─ 인증 실패 시 처리 방법 지정 (none, quarantine, reject)
```

---

## 31-7. 메일 서버 소프트웨어

### 주요 메일 서버

```
Postfix
├─ SMTP 서버
├─ 높은 보안성과 성능
└─ Linux 표준 메일 서버

Sendmail
├─ 전통적인 SMTP 서버
├─ 복잡한 설정
└─ 유연성 높음

Exim
├─ 유연한 설정
└─ Debian/Ubuntu 기본

Microsoft Exchange
├─ 기업용 메일 서버
├─ SMTP, POP3, IMAP 지원
└─ Active Directory 통합

Dovecot
├─ POP3/IMAP 서버
├─ 높은 성능
└─ Postfix와 함께 사용
```

---

## 31-8. 실습: 메일 서버 테스트

### telnet으로 SMTP 테스트

```bash
# SMTP 서버 연결
telnet smtp.gmail.com 587

# 응답 확인
220 smtp.gmail.com ESMTP

# EHLO 명령
EHLO test.com

# 응답 확인
250-smtp.gmail.com at your service
250-SIZE 35882577
250-8BITMIME
250-STARTTLS
250 ENHANCEDSTATUSCODES

# TLS 시작
STARTTLS

# 응답 확인
220 2.0.0 Ready to start TLS

# 이후 openssl s_client로 연결 필요
```

### openssl로 SMTPS 테스트

```bash
# SMTPS 서버 연결 (포트 465)
openssl s_client -connect smtp.gmail.com:465 -crlf

# 또는 STARTTLS 사용 (포트 587)
openssl s_client -connect smtp.gmail.com:587 -starttls smtp -crlf

# EHLO 명령
EHLO test.com

# AUTH LOGIN (base64 인코딩 필요)
AUTH LOGIN
334 VXNlcm5hbWU6
dXNlcm5hbWVAZXhhbXBsZS5jb20=  # username@example.com을 base64 인코딩
334 UGFzc3dvcmQ6
cGFzc3dvcmQ=  # password를 base64 인코딩

# 메일 전송
MAIL FROM:<sender@example.com>
RCPT TO:<recipient@example.com>
DATA
Subject: Test
From: sender@example.com
To: recipient@example.com

Test email body
.
QUIT
```

### telnet으로 POP3 테스트

```bash
# POP3 서버 연결
telnet pop.gmail.com 110

# 응답 확인 (대부분의 서버는 평문 POP3 비활성화)
# POP3S 사용 필요
```

### openssl로 POP3S 테스트

```bash
# POP3S 서버 연결 (포트 995)
openssl s_client -connect pop.gmail.com:995 -crlf

# 응답 확인
+OK Gpop ready

# 로그인
USER username@example.com
+OK send PASS

PASS yourpassword
+OK Welcome

# 메일 확인
STAT
+OK 3 12345

LIST
+OK
1 2048
2 3072
3 7225
.

# 메일 가져오기
RETR 1
+OK
(메일 내용)
.

QUIT
+OK Farewell
```

### openssl로 IMAPS 테스트

```bash
# IMAPS 서버 연결 (포트 993)
openssl s_client -connect imap.gmail.com:993 -crlf

# 응답 확인
* OK Gimap ready

# 로그인
a001 LOGIN username@example.com yourpassword
a001 OK authenticated

# 메일박스 선택
a002 SELECT INBOX
* 150 EXISTS
* 0 RECENT
* OK [UIDVALIDITY 1] UIDs valid
a002 OK [READ-WRITE] INBOX selected

# 최근 메일 가져오기
a003 FETCH 1:10 (FLAGS BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)])
(메일 헤더 정보)
a003 OK FETCH completed

# 로그아웃
a004 LOGOUT
* BYE LOGOUT Requested
a004 OK 73 good day
```

---

## 31-9. 메일 전송 문제 해결

### 포트 연결 테스트

```bash
# SMTP 포트 테스트
telnet smtp.example.com 25
telnet smtp.example.com 587
telnet smtp.example.com 465

# POP3 포트 테스트
telnet pop.example.com 110
telnet pop.example.com 995

# IMAP 포트 테스트
telnet imap.example.com 143
telnet imap.example.com 993

# 또는 nc (netcat) 사용
nc -zv smtp.example.com 25
nc -zv smtp.example.com 587
```

### DNS MX 레코드 조회

메일 서버의 주소를 찾기 위해 MX 레코드를 조회합니다:

```bash
# nslookup 사용
nslookup -type=MX example.com

# dig 사용
dig example.com MX

# host 사용
host -t MX example.com

# 예시 출력
example.com.    3600    IN      MX      10 mail1.example.com.
example.com.    3600    IN      MX      20 mail2.example.com.
# 숫자가 작을수록 우선순위가 높음
```

### 메일 서버 연결 로그 확인

```bash
# Postfix 로그 확인 (Linux)
tail -f /var/log/mail.log
tail -f /var/log/maillog

# 특정 메일 추적
grep "Message-ID" /var/log/mail.log

# 에러 메시지 확인
grep "error" /var/log/mail.log
grep "reject" /var/log/mail.log

# Windows Exchange 로그
이벤트 뷰어 → 응용 프로그램 및 서비스 로그 → Microsoft → Exchange
```

### 일반적인 오류와 해결

```
오류 1: Connection refused (연결 거부)
원인: 메일 서버가 실행되지 않음 또는 방화벽 차단
해결:
- 메일 서버 상태 확인: systemctl status postfix
- 방화벽 규칙 확인: iptables -L
- 포트 리스닝 확인: netstat -tuln | grep :25

오류 2: 550 Relay access denied (릴레이 거부)
원인: 인증되지 않은 메일 릴레이 시도
해결:
- SMTP 인증 설정 확인
- 허용된 IP 범위 확인
- mynetworks 설정 확인 (Postfix)

오류 3: 553 Authentication required (인증 필요)
원인: SMTP AUTH 필요하지만 인증하지 않음
해결:
- 메일 클라이언트에서 SMTP 인증 활성화
- 사용자 이름과 비밀번호 확인

오류 4: 554 Transaction failed (트랜잭션 실패)
원인: 스팸 필터에 의한 차단 또는 메일 형식 오류
해결:
- SPF, DKIM, DMARC 설정 확인
- 역방향 DNS 설정 확인
- 메일 헤더 형식 확인

오류 5: Timeout (시간 초과)
원인: 네트워크 문제 또는 서버 과부하
해결:
- 네트워크 연결 확인
- 서버 리소스 확인 (CPU, 메모리)
- DNS 설정 확인
```

---

## 31-10. 관련 명령어 및 도구

### 메일 전송 테스트 도구

```bash
# sendmail 명령 (Linux)
echo "Test email body" | sendmail recipient@example.com

# mail 명령 (Linux)
echo "Test email body" | mail -s "Subject" recipient@example.com

# mailx 명령 (Linux, 더 많은 옵션)
echo "Test email body" | mailx -s "Subject" -r sender@example.com recipient@example.com

# swaks (SMTP 테스트 도구)
swaks --to recipient@example.com --from sender@example.com --server smtp.example.com

# swaks로 TLS 테스트
swaks --to recipient@example.com --from sender@example.com --server smtp.example.com:587 --tls

# swaks로 인증 테스트
swaks --to recipient@example.com --from sender@example.com --server smtp.example.com --auth LOGIN --auth-user username --auth-password password
```

### 메일 큐 관리

```bash
# Postfix 큐 확인
mailq
postqueue -p

# 메일 큐 비우기 (재전송 시도)
postqueue -f

# 특정 메일 삭제
postsuper -d [메일ID]

# 모든 메일 삭제
postsuper -d ALL

# 큐 상태 확인
qshape active
qshape deferred
```

### base64 인코딩/디코딩

SMTP AUTH에서 사용자 이름과 비밀번호를 인코딩할 때 사용:

```bash
# 인코딩
echo -n "username@example.com" | base64
# 출력: dXNlcm5hbWVAZXhhbXBsZS5jb20=

echo -n "password" | base64
# 출력: cGFzc3dvcmQ=

# 디코딩
echo "dXNlcm5hbWVAZXhhbXBsZS5jb20=" | base64 -d
# 출력: username@example.com

# Windows PowerShell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("username@example.com"))
```

---

## 31-11. ping 명령과 ICMP

>[!TIP] ping 명령
>목적지 컴퓨터와의 통신을 확인하려면 ping 명령을 이용합니다. ping 명령은 ICMP(Internet Control Message Protocol)이라는 프로토콜을 사용하여 목적지 컴퓨터에 ICMP 패킷을 전송하고 패킷에 대한 응답이 제대로 오는지 확인하는 명령입니다.
>
>ping 명령이 정상으로 실행되면 네트워크 연결이 정상이라고 판단할 수 있으므로 문제를 확인할 때 자주 사용합니다.

### ICMP 개요

```
┌────────────────────────────────────────┐
│         ICMP 특징                      │
├────────────────────────────────────────┤
│ • 계층: 네트워크 계층 (Layer 3)         │
│ • 프로토콜 번호: 1                      │
│ • 용도: 오류 보고, 네트워크 진단        │
│ • 포트: 없음 (네트워크 계층 프로토콜)   │
│ • 대표 도구: ping, traceroute          │
└────────────────────────────────────────┘
```

### ping 명령 사용법

```bash
# 기본 사용법
ping example.com
ping 8.8.8.8

# Windows
ping example.com
# 기본 4번 전송 후 종료

# Linux/Mac
ping example.com
# 계속 전송 (Ctrl+C로 중지)

# 전송 횟수 지정
ping -c 4 example.com  # Linux/Mac
ping -n 4 example.com  # Windows

# 인터벌 지정 (1초 간격)
ping -i 1 example.com  # Linux/Mac
ping -w 1000 example.com  # Windows (밀리초)

# 패킷 크기 지정
ping -s 100 example.com  # Linux/Mac
ping -l 100 example.com  # Windows
```

### ping 출력 해석

```bash
$ ping google.com
PING google.com (142.250.185.46) 56(84) bytes of data.
64 bytes from nrt20s21-in-f14.1e100.net (142.250.185.46): icmp_seq=1 ttl=116 time=2.34 ms
64 bytes from nrt20s21-in-f14.1e100.net (142.250.185.46): icmp_seq=2 ttl=116 time=2.41 ms
64 bytes from nrt20s21-in-f14.1e100.net (142.250.185.46): icmp_seq=3 ttl=116 time=2.38 ms
64 bytes from nrt20s21-in-f14.1e100.net (142.250.185.46): icmp_seq=4 ttl=116 time=2.45 ms

--- google.com ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 2.340/2.395/2.450/0.041 ms
```

**각 필드 설명:**
- `64 bytes`: ICMP 패킷 크기
- `icmp_seq=1`: 시퀀스 번호
- `ttl=116`: Time To Live (홉 수 제한)
- `time=2.34 ms`: 왕복 시간 (Round Trip Time)

**통계:**
- `4 packets transmitted`: 전송된 패킷 수
- `4 received`: 수신된 패킷 수
- `0% packet loss`: 손실률
- `rtt min/avg/max/mdev`: 최소/평균/최대/표준편차 시간

### ping 오류 메시지

```
Destination Host Unreachable
→ 대상 호스트에 도달할 수 없음
  원인: 라우팅 문제, 호스트 다운, 방화벽 차단

Request Timeout
→ 응답 시간 초과
  원인: 네트워크 혼잡, 패킷 손실, 방화벽

Unknown Host
→ 알 수 없는 호스트
  원인: DNS 해석 실패, 잘못된 도메인 이름

Network Unreachable
→ 네트워크에 도달할 수 없음
  원인: 라우팅 테이블 문제, 네트워크 다운
```

### traceroute/tracert

경로 추적을 통해 패킷이 거치는 라우터를 확인합니다:

```bash
# Linux/Mac
traceroute google.com

# Windows
tracert google.com

# 예시 출력
traceroute to google.com (142.250.185.46), 30 hops max, 60 byte packets
 1  gateway (192.168.0.1)  1.234 ms  1.123 ms  1.098 ms
 2  10.0.0.1 (10.0.0.1)  5.432 ms  5.321 ms  5.234 ms
 3  isp-router.net (203.0.113.1)  10.123 ms  10.234 ms  10.345 ms
 4  * * *  (방화벽 또는 ICMP 차단)
 5  google-router.net (142.250.185.46)  15.234 ms  15.123 ms  15.098 ms
```

---

## 정리

### 메일 프로토콜 요약

```
┌──────────────────────────────────────────────────────────────┐
│                  메일 프로토콜 요약                           │
├─────────┬──────────┬──────────┬─────────────────────────────┤
│ 프로토콜 │ 용도     │ 포트     │ 특징                        │
├─────────┼──────────┼──────────┼─────────────────────────────┤
│ SMTP    │ 메일 송신│ 25, 587  │ 메일 전송, 서버 간 통신      │
│ SMTPS   │ 메일 송신│ 465      │ SSL/TLS 암호화              │
│ POP3    │ 메일 수신│ 110      │ 다운로드 후 삭제            │
│ POP3S   │ 메일 수신│ 995      │ SSL/TLS 암호화              │
│ IMAP    │ 메일 관리│ 143      │ 서버에 보관, 동기화         │
│ IMAPS   │ 메일 관리│ 993      │ SSL/TLS 암호화              │
└─────────┴──────────┴──────────┴─────────────────────────────┘
```

### 메일 전송 흐름

```
1단계: 메일 작성
[클라이언트] → 메일 작성

2단계: SMTP 송신
[클라이언트] ─ SMTP (포트 587) → [송신 메일 서버]
              (SMTP AUTH 인증 필요)

3단계: DNS MX 조회
[송신 메일 서버] → DNS: "recipient@example.com의 메일 서버는?"
                 ← DNS: "mail.example.com (203.0.113.10)"

4단계: 서버 간 SMTP 전송
[송신 메일 서버] ─ SMTP (포트 25) → [수신 메일 서버]
                 (SPF, DKIM 검증)

5단계: 메일 보관
[수신 메일 서버] → 메일박스에 저장

6단계: 메일 수신
[수신 메일 서버] ← POP3/IMAP ─ [클라이언트]
```

### 핵심 개념

```yaml
SMTP:
  - 메일 송신 및 서버 간 전송에 사용
  - 포트 25 (서버 간), 587 (제출)
  - SMTP AUTH로 인증 필요
  - STARTTLS 또는 SMTPS로 암호화

POP3:
  - 메일을 로컬로 다운로드
  - 포트 110 (평문), 995 (암호화)
  - 다운로드 후 서버에서 삭제
  - 단일 기기 사용에 적합

IMAP:
  - 서버에 메일 보관
  - 포트 143 (평문), 993 (암호화)
  - 여러 기기 동기화 가능
  - 폴더 관리 및 검색 지원

보안:
  - SMTP AUTH: 인증을 통한 릴레이 방지
  - TLS/SSL: 통신 암호화
  - SPF/DKIM/DMARC: 메일 위조 방지
```

---

**관련 문서:**
- [28. 응용 계층의 역할](../28-application-layer-role) - HTTP, DNS, FTP 등 응용 계층 프로토콜
- [26. 포트 번호의 구조](../26-port-number-structure) - SMTP(25), POP3(110), IMAP(143) 포트
- [30. DNS 서버의 구조](../30-dns-server-structure) - MX 레코드를 통한 메일 서버 조회
