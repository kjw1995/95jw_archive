---
title: 보안과 권한 관리
weight: 11
---

## 1. 데이터베이스 보안

### 보안의 목표

조직에서 허가한 사용자만 데이터베이스에 접근하도록 통제해 데이터를 보호하는 것이다.

### 보안의 유형

```text
┌─────────┐ ┌─────────┐ ┌─────────┐
│ 물리적  │ │ 권한    │ │ 운영    │
│ 환경    │ │ 관리    │ │ 관리    │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     ▼           ▼           ▼
  재해 방지  접근 제어   무결성 감사
```

| 유형 | 보호 대상 | 주요 방법 |
|:---|:---|:---|
| 물리적 환경 | 자연재해, 물리적 손상 | 백업, 이중화, DR 센터 |
| 권한 관리 | 권한 없는 사용자 | 접근 제어, GRANT/REVOKE |
| 운영 관리 | 권한 있는 사용자 실수 | 무결성 제약, 감사 로그 |

## 2. 권한 관리

### 접근 제어 흐름

```text
사용자 ─► 로그인 ─► 접근 제어
                      │
               실패 ──┴── 성공
                │         │
                ▼         ▼
            접근 거부  권한 확인
                          │
                          ▼
                     허용 작업 수행
```

### 객체 권한

| 권한 | 설명 | 대상 |
|:---|:---|:---|
| SELECT | 데이터 조회 | 테이블, 뷰 |
| INSERT | 데이터 삽입 | 테이블, 뷰 |
| UPDATE | 데이터 수정 | 테이블, 뷰 (속성 지정) |
| DELETE | 데이터 삭제 | 테이블, 뷰 |
| REFERENCES | 외래키 참조 | 테이블 |
| ALL | 모든 권한 | 테이블, 뷰 |

### 권한 부여 (GRANT)

```sql
GRANT 권한 ON 객체 TO 사용자 [WITH GRANT OPTION];
```

```sql
-- 단일 권한
GRANT SELECT ON 고객 TO user1;

-- 여러 권한 동시 부여
GRANT SELECT, INSERT, UPDATE ON 주문 TO user2;

-- 모든 권한
GRANT ALL ON 제품 TO user3;

-- 모든 사용자
GRANT SELECT ON 공지사항 TO PUBLIC;

-- 속성별 권한
GRANT UPDATE(전화번호, 주소) ON 고객 TO user1;
GRANT SELECT(고객명, 이메일) ON 고객 TO user2;
```

### WITH GRANT OPTION

권한을 받은 사용자가 다른 사용자에게 권한을 전파할 수 있게 해주는 옵션이다.

```sql
GRANT SELECT ON 고객 TO user1 WITH GRANT OPTION;
```

```text
    [DBA]
      │ GRANT ... WITH GRANT OPTION
      ▼
   [user1]
      │ GRANT ...
   ┌──┼──┐
   ▼  ▼  ▼
  u2 u3 u4
```

### 권한 취소 (REVOKE)

```sql
REVOKE 권한 ON 객체 FROM 사용자 CASCADE | RESTRICT;
```

| 옵션 | 설명 |
|:---|:---|
| CASCADE | 전파된 권한까지 연쇄 취소 |
| RESTRICT | 전파된 권한이 있으면 거부 |

```sql
-- 기본 취소
REVOKE SELECT ON 고객 FROM user1;

-- 여러 권한 동시 취소
REVOKE INSERT, UPDATE ON 주문 FROM user2;

-- 연쇄 취소
REVOKE SELECT ON 고객 FROM user1 CASCADE;

-- 안전 취소
REVOKE SELECT ON 고객 FROM user1 RESTRICT;
```

```text
[초기]
DBA → user1 → user2 → user3

[CASCADE]
모두 취소됨 (user2·user3 포함)

[RESTRICT]
전파된 권한 존재 → 오류 반환
→ 먼저 user2, user3 취소 후 가능
```

### 시스템 권한

DDL 작업에 대한 권한으로, DBA가 부여한다.

| 시스템 권한 | 설명 |
|:---|:---|
| CREATE TABLE | 테이블 생성 |
| CREATE VIEW | 뷰 생성 |
| CREATE INDEX | 인덱스 생성 |
| CREATE USER | 사용자 생성 |
| DROP ANY TABLE | 모든 테이블 삭제 |

```sql
GRANT CREATE TABLE TO user1;
GRANT CREATE VIEW, CREATE INDEX TO user2;
REVOKE CREATE TABLE FROM user1;
```

## 3. 역할 (Role)

### 개념

역할은 여러 권한을 묶어 놓은 그룹이다. 권한을 역할에 부여하고 역할을 사용자에게 부여하면 관리가 단순해진다.

```text
[개별 부여]           [역할 사용]
권한1 → user1         권한1 ┐
권한2 → user1         권한2 ├─► ROLE ─┬─► user1
권한3 → user1         권한3 ┘         ├─► user2
권한1 → user2                         └─► user3
...
반복 작업 多           한 번에 관리
변경 시 모두 수정      역할 수정으로 일괄 반영
```

### 역할 관리 명령어

```sql
-- 역할 생성 (DBA)
CREATE ROLE 역할이름;

-- 역할에 권한 추가 (객체 소유자)
GRANT 권한 ON 객체 TO 역할이름;

-- 사용자에게 역할 부여 (DBA)
GRANT 역할이름 TO 사용자;

-- 역할 취소
REVOKE 역할이름 FROM 사용자;

-- 역할 삭제
DROP ROLE 역할이름;
```

### 활용 예제

```sql
-- 1) 역할 생성
CREATE ROLE sales_role;
CREATE ROLE manager_role;

-- 2) 권한 부여
GRANT SELECT ON 고객 TO sales_role;
GRANT SELECT, INSERT ON 주문 TO sales_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON 고객 TO manager_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON 주문 TO manager_role;

-- 3) 역할 부여
GRANT sales_role TO kim, lee, park;
GRANT manager_role TO choi;

-- 4) 역할에 권한 추가 → 기존 사용자 전원에게 즉시 반영
GRANT SELECT ON 제품 TO sales_role;

-- 5) 취소·삭제
REVOKE sales_role FROM park;
DROP ROLE sales_role;
```

### 역할 계층

역할에 다른 역할을 부여해 계층을 만들 수 있다.

```text
        [DBA_ROLE]
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
[MANAGER][ANALYST][DEV_ROLE]
   │
   ▼
[STAFF_ROLE]
```

```sql
GRANT STAFF_ROLE TO MANAGER_ROLE;
```

## 4. 행 단위 보안 (Row-Level Security)

같은 테이블에서도 사용자에 따라 **접근 가능한 행을 다르게 제한**하는 기법이다. 열 단위 제어는 GRANT로, 행 단위 제어는 RLS 정책이나 뷰로 구현한다.

```text
[주문 테이블]
┌──┬──────┬───────┐
│ID│ 고객 │ 금액  │
├──┼──────┼───────┤
│1 │ kim  │10,000 │ ←─ kim 조회 가능
│2 │ lee  │20,000 │ ←─ lee 조회 가능
│3 │ park │30,000 │ ←─ park 조회 가능
└──┴──────┴───────┘

정책: 고객 = CURRENT_USER()
→ 각 사용자는 자신의 행만 볼 수 있음
```

### 뷰로 구현

```sql
CREATE VIEW 내_주문 AS
SELECT * FROM 주문
WHERE 고객ID = CURRENT_USER();

GRANT SELECT ON 내_주문 TO 'app_user'@'%';
```

### PostgreSQL RLS 예시

```sql
ALTER TABLE 주문 ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_rows
  ON 주문
  FOR SELECT
  USING (고객ID = current_user);
```

| 비교 | 열 단위 (GRANT) | 행 단위 (RLS) |
|:---|:---|:---|
| 단위 | 컬럼 | 행 |
| 제어 | 구문·표현 제한 | 조건식 기반 |
| 구현 | `GRANT SELECT(col)` | 정책·뷰·함수 |

## 5. 저장 시 암호화 vs 전송 시 암호화

암호화는 적용되는 단계에 따라 크게 두 가지로 나뉜다.

| 구분 | 저장 시 암호화 (At Rest) | 전송 시 암호화 (In Transit) |
|:---|:---|:---|
| 보호 대상 | 디스크·백업 파일 | 네트워크 패킷 |
| 위협 | 매체 도난, 덤프 유출 | 도청, 중간자 공격 |
| 기술 | TDE, 컬럼 암호화 | TLS/SSL |
| 위치 | DBMS·파일 시스템 | 클라이언트↔서버 구간 |
| 대표 예 | MySQL TDE, AES_ENCRYPT | JDBC `useSSL=true` |

```text
[애플리케이션]
      │  ─── TLS ───  ◄── 전송 시 암호화
      ▼
┌──────────────┐
│   DBMS       │
│   ┌───────┐  │  ◄── 저장 시 암호화
│   │ 암호화 │  │      (TDE / 컬럼)
│   │ 파일   │  │
│   └───────┘  │
└──────────────┘
```

{{< callout type="warning" >}}
두 가지는 서로를 대체하지 않는다. 전송 중에는 TLS, 저장 시에는 TDE 또는 컬럼 암호화를 병행해야 완전한 보호가 가능하다.
{{< /callout >}}

## 6. 데이터 암호화

### 기본 용어

| 용어 | 설명 |
|:---|:---|
| 평문 | 암호화되지 않은 원본 데이터 |
| 암호문 | 암호화된 데이터 |
| 암호화 | 평문 → 암호문 변환 |
| 복호화 | 암호문 → 평문 변환 |
| 키 | 암·복호화에 쓰는 비밀 값 |

```text
┌─────┐  암호화  ┌──────┐  복호화  ┌─────┐
│평문 │ ───────► │암호문│ ───────► │평문 │
│Hello│  + 키    │Xk2#p │  + 키    │Hello│
└─────┘          └──────┘          └─────┘
```

### 대칭 vs 비대칭 암호화

| 구분 | 대칭 암호화 | 비대칭 암호화 |
|:---|:---|:---|
| 키 구성 | 동일 키 | 공개키 + 개인키 |
| 속도 | 빠름 | 느림 |
| 키 관리 | 공유 필요 | 공개키 배포 가능 |
| 대표 알고리즘 | DES, AES | RSA |
| 용도 | 대용량 데이터 | 키 교환, 전자서명 |

### 주요 알고리즘

| 알고리즘 | 유형 | 키 크기 | 특징 |
|:---|:---|:---|:---|
| DES | 대칭 | 56b | 구식·취약 |
| AES | 대칭 | 128/192/256b | 현재 표준 |
| RSA | 비대칭 | 1024~4096b | 산업 표준 |

### MySQL 암호화 함수

```sql
SET @key = 'my_secret_key_123';

-- AES 양방향
INSERT INTO 사용자(아이디, 비밀번호)
VALUES ('user1', AES_ENCRYPT('password123', @key));

SELECT 아이디,
       AES_DECRYPT(비밀번호, @key) AS 비밀번호
FROM 사용자 WHERE 아이디 = 'user1';

-- SHA2 단방향 해시 (비밀번호 권장)
INSERT INTO 사용자(아이디, 비밀번호)
VALUES ('user2', SHA2('password123', 256));

SELECT * FROM 사용자
WHERE 아이디 = 'user2'
  AND 비밀번호 = SHA2('password123', 256);
```

{{< callout type="warning" >}}
비밀번호는 복호화 가능한 AES보다 단방향 해시(SHA-2, bcrypt, argon2)를 사용해야 한다. 여기에 사용자별 **salt** 를 더해야 레인보우 테이블 공격을 방지할 수 있다.
{{< /callout >}}

## 7. SQL Injection 방어 원칙

SQL Injection은 사용자 입력을 그대로 쿼리 문자열에 이어 붙였을 때 공격자가 의도한 SQL을 실행하게 되는 취약점이다.

### 공격 예시

```sql
-- 취약한 코드
String sql = "SELECT * FROM users WHERE id = '" + input + "'";

-- 공격 입력
input = "' OR '1'='1";

-- 실제 실행되는 쿼리
SELECT * FROM users WHERE id = '' OR '1'='1';
-- → 모든 레코드 반환
```

### 방어 원칙

| 원칙 | 설명 |
|:---|:---|
| 파라미터 바인딩 | PreparedStatement·바인드 변수 사용 |
| 저장 프로시저 | 파라미터 입력 프로시저로 제한 |
| 입력 검증 | 화이트리스트·타입 검사 |
| 최소 권한 | 애플리케이션 계정에 필요한 권한만 |
| ORM 사용 | JPA 등에서 자동 이스케이프 |
| 에러 숨김 | DB 예외를 클라이언트에 노출 금지 |

### 안전한 구현 (JDBC)

```java
// 파라미터 바인딩
String sql = "SELECT * FROM users WHERE id = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, input);
    try (ResultSet rs = ps.executeQuery()) {
        // ...
    }
}
```

```java
// Spring JdbcTemplate
jdbcTemplate.queryForObject(
    "SELECT * FROM users WHERE id = ?",
    User.class, input);
```

{{< callout type="info" >}}
`LIKE` 와일드카드, `ORDER BY` 컬럼명처럼 바인딩할 수 없는 자리에는 반드시 화이트리스트 검증을 적용한다. 단순 문자열 치환은 여전히 인젝션 경로가 된다.
{{< /callout >}}

## 8. 실무 예제

### 사용자·권한 관리 (MySQL)

```sql
-- 사용자 생성
CREATE USER 'app_user'@'localhost'
  IDENTIFIED BY 'secure_password';
CREATE USER 'readonly_user'@'%'
  IDENTIFIED BY 'readonly_pass';

-- DB 레벨 권한
GRANT ALL PRIVILEGES ON shop_db.* TO 'app_user'@'localhost';
GRANT SELECT ON shop_db.* TO 'readonly_user'@'%';

-- 테이블 레벨 권한
GRANT SELECT, INSERT ON shop_db.orders TO 'sales_user'@'localhost';
GRANT UPDATE(status) ON shop_db.orders TO 'sales_user'@'localhost';

-- 반영·확인
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'app_user'@'localhost';

-- 취소·삭제
REVOKE INSERT ON shop_db.orders FROM 'sales_user'@'localhost';
DROP USER 'readonly_user'@'%';
```

### 역할 관리 (MySQL 8.0+)

```sql
-- 역할 생성·권한 부여
CREATE ROLE 'app_read', 'app_write', 'app_admin';

GRANT SELECT ON shop_db.* TO 'app_read';
GRANT INSERT, UPDATE, DELETE ON shop_db.* TO 'app_write';
GRANT ALL PRIVILEGES ON shop_db.* TO 'app_admin';

-- 사용자에게 역할 부여
GRANT 'app_read' TO 'user1'@'localhost';
GRANT 'app_read', 'app_write' TO 'user2'@'localhost';
GRANT 'app_admin' TO 'admin'@'localhost';

-- 기본 역할
SET DEFAULT ROLE 'app_read' TO 'user1'@'localhost';
SET DEFAULT ROLE ALL TO 'user2'@'localhost';

-- 세션에서 활성화
SET ROLE 'app_read';
SET ROLE ALL;

-- 삭제
DROP ROLE 'app_read';
```

### 뷰를 통한 접근 제어

```sql
-- 민감 정보 제외 뷰
CREATE VIEW 고객_공개정보 AS
SELECT 고객ID, 고객명, 가입일
FROM 고객;

-- 행 단위 필터링 뷰
CREATE VIEW 내_주문 AS
SELECT * FROM 주문
WHERE 고객ID = CURRENT_USER();

GRANT SELECT ON 고객_공개정보 TO 'public_user'@'localhost';
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 보안 유형 | 물리적·권한·운영 관리 |
| GRANT / REVOKE | 권한 부여·취소 |
| WITH GRANT OPTION | 권한 전파 허용 |
| CASCADE / RESTRICT | 전파 권한 처리 방식 |
| 역할 (Role) | 권한의 묶음, 관리 단순화 |
| RLS | 행 단위 접근 제어 |
| 저장 시 암호화 | TDE·컬럼 암호화 |
| 전송 시 암호화 | TLS/SSL |
| 대칭 vs 비대칭 | AES vs RSA |
| SHA-2 / bcrypt | 단방향 해시로 비밀번호 저장 |
| SQL Injection 방어 | 바인딩·화이트리스트·최소 권한 |

{{< callout type="info" >}}
**용어 정리**
- **접근 제어**: 계정·권한 확인으로 작업을 허용/거부하는 체계
- **GRANT / REVOKE**: 권한 부여·취소 SQL 명령어
- **WITH GRANT OPTION**: 권한 전파를 허용하는 옵션
- **CASCADE / RESTRICT**: 권한 취소 시 전파된 권한 처리 방식
- **역할 (Role)**: 여러 권한을 묶어 사용자에게 일괄 부여하는 단위
- **시스템 권한**: DDL 작업을 위한 권한 (CREATE TABLE 등)
- **RLS (Row-Level Security)**: 행 단위 접근 제어
- **TDE (Transparent Data Encryption)**: DBMS 저장 파일 자동 암호화
- **TLS/SSL**: 전송 구간 암호화 프로토콜
- **대칭 / 비대칭 암호화**: 동일 키 / 공개키·개인키 방식
- **AES / RSA**: 대칭·비대칭 대표 알고리즘
- **SHA-2 / bcrypt**: 단방향 해시 알고리즘
- **Salt**: 해시에 덧붙여 레인보우 테이블을 무력화하는 난수
- **SQL Injection**: 입력값을 쿼리에 주입하는 취약점
- **PreparedStatement**: 파라미터 바인딩으로 인젝션을 방어하는 API
{{< /callout >}}
