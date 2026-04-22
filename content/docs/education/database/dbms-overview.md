---
title: DBMS 개요
weight: 2
---

## 1. 파일 시스템의 한계

초기 응용 프로그램은 데이터를 각자 파일에 저장했다. 이 구조에서는 같은 데이터가 여러 파일에 중복되고, 파일 구조가 바뀔 때마다 프로그램도 수정해야 한다.

```text
[파일 시스템]
앱 A ─→ 파일 A (고객)
앱 B ─→ 파일 B (고객+주문)   ← 중복
앱 C ─→ 파일 C (고객+배송)   ← 중복

[DBMS]
앱 A ─┐
앱 B ─┼─→ DBMS ─→ 통합 DB
앱 C ─┘
```

| 문제점 | 설명 | 예시 |
|:---|:---|:---|
| 데이터 중복성 | 같은 값이 여러 파일에 저장 | 고객 정보가 A·B·C에 각각 존재 |
| 데이터 종속성 | 파일 구조 변경 시 프로그램 수정 | 필드 추가 → 모든 앱 재컴파일 |
| 동시 공유 불가 | 동시 접근·갱신이 어려움 | 여러 사용자 동시 수정 실패 |
| 보안/회복 부족 | 파일 단위 권한만 제공 | 레코드 단위 권한 제어 불가 |

## 2. DBMS의 정의

DBMS(Database Management System)는 데이터베이스를 생성·관리하고, 응용 프로그램의 데이터 처리 요청을 중개하는 소프트웨어다.

```text
      사용자
 (DBA, 개발자, 최종 사용자)
        │ SQL
        ▼
 ┌────────────────┐
 │     DBMS       │
 │ 질의 처리기 +   │
 │ 저장 데이터     │
 │ 관리자         │
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 데이터베이스    │
 │ 데이터+메타     │
 └────────────────┘
```

## 3. DBMS의 3가지 핵심 기능

| 기능 | 설명 | 대표 SQL |
|:---|:---|:---|
| 정의 기능 (DDL) | 구조 정의·수정·삭제 | `CREATE`, `ALTER`, `DROP` |
| 조작 기능 (DML) | 데이터 삽입·삭제·수정·검색 | `INSERT`, `DELETE`, `UPDATE`, `SELECT` |
| 제어 기능 (DCL) | 보안·무결성·동시성·회복 | `GRANT`, `REVOKE`, `COMMIT`, `ROLLBACK` |

### DDL 예제

```sql
CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE customers ADD phone VARCHAR(20);
DROP TABLE customers;
```

### DML 예제

```sql
INSERT INTO customers (id, name, email)
VALUES (1, '홍길동', 'hong@example.com');

SELECT * FROM customers WHERE name = '홍길동';
UPDATE customers SET email = 'new@example.com' WHERE id = 1;
DELETE FROM customers WHERE id = 1;
```

### DCL 예제

```sql
GRANT SELECT, INSERT ON customers TO 'user1';
REVOKE INSERT ON customers FROM 'user1';

BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
```

## 4. 스키마와 인스턴스

스키마는 데이터베이스의 구조와 제약조건 정의이고, 인스턴스는 특정 시점에 실제 저장된 데이터 값이다.

```text
[Schema] 구조 정의
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  salary DECIMAL(10,2)
);
        │
        ▼
[Instance] 실제 데이터
 id │ name   │ salary
 1  │ 홍길동 │ 50000
 2  │ 김철수 │ 45000
```

| 구분 | 스키마 | 인스턴스 |
|:---|:---|:---|
| 성격 | 정적 (거의 변하지 않음) | 동적 (자주 변함) |
| 내용 | 구조, 제약조건 | 실제 데이터 값 |
| 정의 | DDL | DML |

## 5. 3단계 데이터베이스 구조

ANSI/SPARC가 제안한 3단계 구조는 사용자 뷰, 조직 전체 뷰, 물리적 저장을 분리한다.

```text
 ┌──────────────────────────┐
 │ 외부 단계 (사용자 뷰)     │
 │ 외부 스키마 1..N         │
 └────────┬─────────────────┘
          │ 외부/개념 사상
 ┌────────┴─────────────────┐
 │ 개념 단계 (조직 뷰)       │
 │ 개념 스키마 (1개)         │
 └────────┬─────────────────┘
          │ 개념/내부 사상
 ┌────────┴─────────────────┐
 │ 내부 단계 (저장 뷰)       │
 │ 내부 스키마 (1개)         │
 └────────┬─────────────────┘
          ▼
      저장 장치
```

| 단계 | 스키마 | 관점 | 개수 | 설명 |
|:---|:---|:---|:---|:---|
| 외부 | 외부 스키마 | 개별 사용자 | 여러 개 | 사용자별 필요 데이터만 노출 |
| 개념 | 개념 스키마 | 조직 전체 | 1개 | 전체 DB 논리 구조 정의 |
| 내부 | 내부 스키마 | 저장 장치 | 1개 | 물리적 저장 방법 정의 |

### 외부 스키마 예제 (View)

```sql
-- 개념 스키마
CREATE TABLE employees (
    id INT, name VARCHAR(50),
    salary DECIMAL, ssn VARCHAR(20)
);

-- 외부 스키마 1: 인사팀용
CREATE VIEW hr_view AS
SELECT id, name, salary, ssn FROM employees;

-- 외부 스키마 2: 일반 직원용
CREATE VIEW employee_view AS
SELECT id, name FROM employees;
```

## 6. 데이터 독립성

### 논리적 데이터 독립성

개념 스키마가 변경되어도 외부 스키마와 응용 프로그램은 영향을 받지 않는다.

```sql
ALTER TABLE employees ADD department VARCHAR(50);
SELECT * FROM employee_view;  -- 여전히 동작
```

### 물리적 데이터 독립성

내부 스키마가 변경되어도 개념 스키마는 그대로 유지된다.

```text
예) HDD → SSD 교체
    인덱스 추가/삭제
    파티셔닝 방식 변경

→ 논리 구조 그대로
→ 응용 프로그램 수정 불필요
```

## 7. DBMS 장단점

### 장점

| 장점 | 설명 |
|:---|:---|
| 데이터 중복 통제 | 통합 관리로 중복 최소화 |
| 데이터 독립성 | 구조 변경 시 앱 영향 최소화 |
| 동시 공유 | 여러 사용자 동시 접근 지원 |
| 보안 향상 | 세분화된 접근 제어 가능 |
| 무결성 유지 | 제약조건으로 정확성 보장 |
| 표준화 | SQL로 접근 방법 통일 |
| 장애 회복 | 트랜잭션 로그로 복구 |

### 단점

| 단점 | 설명 |
|:---|:---|
| 높은 비용 | 라이선스, 하드웨어, 운영 비용 |
| 복잡한 백업/회복 | 대용량 데이터 관리 복잡 |
| 단일 장애점 | DBMS 장애 시 전체 영향 |

## 8. DBMS 발전 과정

```text
 1세대 (1960s)  네트워크/계층
 2세대 (1970s)  관계형 (RDBMS)
 3세대 (1980s)  객체지향/객체관계
 4세대 (2000s)  NoSQL / NewSQL
```

| 세대 | 유형 | 데이터 모델 | 대표 제품 |
|:---|:---|:---|:---|
| 1세대 | 네트워크/계층 | 그래프/트리 | IDS, IMS |
| 2세대 | 관계형 | 테이블 | Oracle, MySQL |
| 3세대 | 객체지향/객체관계 | 객체 | ObjectStore |
| 4세대 | NoSQL | 문서·키값·컬럼·그래프 | MongoDB, Redis |
| 4세대 | NewSQL | 테이블(분산) | CockroachDB, Spanner |

### RDBMS vs NoSQL vs NewSQL

| 구분 | RDBMS | NoSQL | NewSQL |
|:---|:---|:---|:---|
| 주 용도 | 정형 데이터 | 비정형/반정형 | 정형 + 분산 |
| 일관성 | ACID | BASE | ACID |
| 확장 | 수직 | 수평 | 수평 |
| 언어 | SQL | 제품별 API | SQL |

## 9. 주요 RDBMS 비교

실무에서 자주 만나는 4개 RDBMS는 라이선스, 특장점, 주 사용처가 뚜렷하게 다르다.

| 제품 | 라이선스 | 특징 | 주 사용처 |
|:---|:---|:---|:---|
| MySQL | GPL / 상용 | 가볍고 빠름, 웹 친화 | 웹 서비스, 스타트업 |
| PostgreSQL | BSD 계열 오픈소스 | 표준 SQL 충실, 확장성 풍부 | 분석·지리정보·복잡 쿼리 |
| Oracle | 상용 | 고성능·고가용성, 풍부한 기능 | 대기업·금융·ERP |
| SQL Server | 상용 | .NET/Windows 친화, BI 통합 | 엔터프라이즈 Windows 환경 |

{{< callout type="info" >}}
PostgreSQL은 JSONB, 윈도 함수, CTE, 파티셔닝, 사용자 정의 타입 등 고급 기능이 풍부해 "오픈소스 Oracle"로 불린다. MySQL은 단순 CRUD 위주 워크로드에서 압도적인 채택률을 보인다.
{{< /callout >}}

## 10. 인덱스 기본 원리 (B-Tree)

인덱스는 책의 색인처럼 데이터 위치를 빠르게 찾기 위한 별도의 구조다. 대부분의 RDBMS는 기본 인덱스 구조로 **B-Tree(정확히는 B+Tree)** 를 사용한다.

```text
        [50]
       /    \
    [20]    [80]
    / \     / \
 [10][30][60][90]
```

B-Tree는 각 노드에 정렬된 키를 두고 트리 깊이를 낮게 유지해 탐색·삽입·삭제를 모두 `O(log n)` 시간에 수행한다. 범위 검색, 정렬, 접두사 매칭(LIKE 'abc%')에도 유리하다.

```sql
CREATE INDEX idx_emp_name ON employees(name);

-- B-Tree 인덱스가 사용되는 쿼리
SELECT * FROM employees WHERE name = '홍길동';
SELECT * FROM employees WHERE name LIKE '홍%';
SELECT * FROM employees WHERE salary BETWEEN 30000 AND 50000;
```

{{< callout type="warning" >}}
인덱스는 조회는 빠르게 하지만 삽입·수정·삭제 시 인덱스도 함께 갱신되어 쓰기 비용이 증가한다. 선택도가 낮은(카디널리티가 낮은) 컬럼이나 자주 갱신되는 컬럼에 과도하게 인덱스를 걸면 오히려 성능이 떨어진다.
{{< /callout >}}

## 11. 데이터베이스 사용자

| 사용자 | 역할 | 주요 도구 |
|:---|:---|:---|
| DBA | 설계·운영·보안·튜닝·백업 | DDL, DCL |
| 응용 프로그래머 | 앱 개발, SQL 임베딩 | DML, 호스트 언어 |
| 최종 사용자 | 조회·수정 (GUI·웹) | 간접 DML |

## 12. 데이터 사전 (시스템 카탈로그)

데이터 사전은 테이블, 컬럼, 제약조건, 사용자, 권한 같은 **메타데이터를 저장하는 시스템 DB**다.

```sql
-- MySQL
SELECT * FROM information_schema.tables
WHERE table_schema = 'mydb';

SELECT * FROM information_schema.columns
WHERE table_name = 'employees';

-- PostgreSQL
SELECT * FROM pg_catalog.pg_tables;

-- Oracle
SELECT * FROM user_tables;
SELECT * FROM user_tab_columns WHERE table_name = 'EMPLOYEES';
```

| 정보 유형 | 예시 |
|:---|:---|
| 테이블 정보 | 테이블명, 생성일, 소유자 |
| 컬럼 정보 | 컬럼명, 데이터타입, 제약조건 |
| 인덱스 정보 | 인덱스명, 대상 컬럼 |
| 사용자 정보 | 사용자명, 권한 |
| 뷰 정보 | 뷰 이름, 정의 쿼리 |

## 13. 트랜잭션과 ACID

트랜잭션은 하나의 논리 작업 단위를 구성하는 연산들의 집합이다.

```sql
BEGIN TRANSACTION;

UPDATE accounts SET balance = balance - 50000
WHERE account_id = 'A';

UPDATE accounts SET balance = balance + 50000
WHERE account_id = 'B';

COMMIT;
-- 실패 시: ROLLBACK;
```

| 특성 | 설명 | 예시 |
|:---|:---|:---|
| Atomicity (원자성) | 전부 수행 또는 전부 취소 | 이체 중 오류 → 전체 롤백 |
| Consistency (일관성) | 전후 DB 일관성 유지 | 이체 후 총액 동일 |
| Isolation (격리성) | 동시 트랜잭션 간 간섭 없음 | 다른 이체와 독립 실행 |
| Durability (지속성) | 완료 결과 영구 보존 | 장애 후에도 유지 |

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| DBMS | DB 생성·관리·중개 소프트웨어 |
| DDL/DML/DCL | 정의/조작/제어 언어 |
| 스키마/인스턴스 | 구조 정의 / 실제 데이터 값 |
| 3단계 구조 | 외부·개념·내부, 독립성 보장 |
| 데이터 독립성 | 상위 영향 없이 하위 변경 가능 |
| B-Tree 인덱스 | 정렬된 트리 기반 빠른 탐색 구조 |
| 데이터 사전 | 메타데이터 시스템 카탈로그 |
| ACID | 트랜잭션의 4가지 특성 |
| NoSQL / NewSQL | 확장성 중심 / 확장 + ACID |

{{< callout type="info" >}}
**용어 정리**
- **DBMS**: 데이터베이스 관리 시스템
- **DDL / DML / DCL / TCL**: 정의·조작·제어·트랜잭션 제어 언어
- **스키마 / 인스턴스**: 구조 정의 / 실제 데이터 값
- **3단계 구조**: 외부·개념·내부 단계 (ANSI/SPARC)
- **데이터 독립성**: 논리적(개념→외부) / 물리적(내부→개념)
- **데이터 사전**: 메타데이터를 담는 시스템 카탈로그
- **ACID**: 원자성·일관성·격리성·지속성
- **B-Tree**: 정렬된 트리 기반 인덱스 자료구조
- **RDBMS / NoSQL / NewSQL**: 관계형 / 비관계형 / 분산 관계형
- **MySQL / PostgreSQL / Oracle / SQL Server**: 대표적 RDBMS 제품
{{< /callout >}}
