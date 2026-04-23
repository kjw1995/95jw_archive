---
title: 데이터베이스 시스템
weight: 3
---

## 1. 데이터베이스 시스템의 정의

DBS(Database System)는 데이터베이스와 DBMS, 사용자, 데이터 언어, 하드웨어를 포함한 전체 시스템을 가리킨다.

```text
 ┌────────────────────┐
 │    사용자           │
 │ DBA, 개발자, 사용자 │
 └────────┬───────────┘
          │ SQL
          ▼
 ┌────────────────────┐
 │       DBMS         │
 │ 질의 처리기        │
 │ 저장 데이터 관리자  │
 └────────┬───────────┘
          ▼
 ┌────────────────────┐
 │   데이터베이스      │
 │ 사용자 데이터       │
 │ + 데이터 사전       │
 └────────┬───────────┘
          ▼
     컴퓨터 (HW)
```

| 용어 | 정의 |
|:---|:---|
| 데이터베이스 (DB) | 저장된 데이터의 집합 |
| DBMS | DB를 관리하는 소프트웨어 |
| 데이터베이스 시스템 (DBS) | DB + DBMS + 사용자 + 언어 + HW 전체 |

## 2. 스키마와 인스턴스

스키마는 구조와 제약조건을 정의하고, 인스턴스는 특정 시점의 실제 값이다.

```text
[Schema] 정적
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  amount DECIMAL(10,2)
    CHECK(amount > 0),
  status VARCHAR(20)
    DEFAULT 'pending'
);
        │
        ▼
[Instance] 동적
 1│101│50000│completed
 2│102│30000│pending
 3│101│15000│shipped
```

| 구분 | 스키마 | 인스턴스 |
|:---|:---|:---|
| 성격 | 정적 (구조) | 동적 (값) |
| 정의 | DDL | DML |
| 변경 빈도 | 거의 변하지 않음 | 수시로 변경 |
| 저장 위치 | 데이터 사전 | 데이터베이스 |

## 3. 3단계 데이터베이스 구조 (ANSI/SPARC)

ANSI/SPARC 3단계 구조는 사용자 관점, 조직 전체 관점, 저장 장치 관점을 분리해 서로 다른 변경 축을 독립적으로 다루게 한다.

```text
 ┌──────────────────────────┐
 │ 외부 단계 (사용자 뷰)     │
 │ 외부 스키마 1..N          │
 └────────┬─────────────────┘
          │ 외부/개념 사상
          │ (논리적 독립성)
 ┌────────┴─────────────────┐
 │ 개념 단계 (조직 전체 뷰)  │
 │ 개념 스키마 (1개)         │
 └────────┬─────────────────┘
          │ 개념/내부 사상
          │ (물리적 독립성)
 ┌────────┴─────────────────┐
 │ 내부 단계 (저장 뷰)       │
 │ 내부 스키마 (1개)         │
 └────────┬─────────────────┘
          ▼
       저장 장치
```

| 단계 | 스키마 | 개수 | 관점 | 정의 내용 |
|:---|:---|:---|:---|:---|
| 외부 | 외부 스키마(서브 스키마) | 여러 개 | 개별 사용자 | 사용자별 필요 데이터 |
| 개념 | 개념 스키마 | 1개 | 조직 전체 | 전체 논리 구조·제약·보안 |
| 내부 | 내부 스키마 | 1개 | 저장 장치 | 레코드 구조·인덱스·접근 경로 |

{{< callout type="info" >}}
3단계 구조는 단순한 설계 이론이 아니라 **변경 비용을 낮추는 아키텍처 원칙**이다. 저장 장치 교체가 응용 프로그램에 영향을 주지 않도록 하고, 테이블 구조 변경이 기존 사용자 뷰를 깨지 않도록 한다.
{{< /callout >}}

### 개념 스키마 예제

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ssn VARCHAR(20),
    salary DECIMAL(12,2),
    department VARCHAR(50),
    hire_date DATE
);
```

### 외부 스키마 예제

```sql
-- 인사팀용 (전체 정보)
CREATE VIEW hr_view AS
SELECT id, name, ssn, salary, department, hire_date
FROM employees;

-- 일반 직원용 (민감 정보 숨김)
CREATE VIEW employee_view AS
SELECT id, name, department, hire_date
FROM employees;

-- 부서별 통계용
CREATE VIEW dept_stats_view AS
SELECT department,
       COUNT(*) as emp_count,
       AVG(salary) as avg_salary
FROM employees
GROUP BY department;
```

### 내부 스키마 예제

```sql
-- 인덱스
CREATE INDEX idx_emp_dept ON employees(department);
CREATE INDEX idx_emp_name ON employees(name);

-- 파티셔닝 (MySQL)
CREATE TABLE orders (
    id INT,
    order_date DATE,
    amount DECIMAL(10,2)
)
PARTITION BY RANGE (YEAR(order_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025)
);
```

## 4. 데이터 독립성

### 논리적 데이터 독립성

개념 스키마가 바뀌어도 외부 스키마는 영향을 받지 않는다. 사상(매핑)이 흡수하기 때문이다.

```sql
-- 컬럼명 변경
ALTER TABLE employees RENAME COLUMN name TO full_name;

-- 외부/개념 사상으로 기존 이름 유지
CREATE OR REPLACE VIEW employee_view AS
SELECT id, full_name AS name, department, hire_date
FROM employees;
```

```text
변경 전: employees.name
변경 후: employees.full_name

사상이 full_name → name 매핑
→ 사용자는 변경 사실을 모름
```

### 물리적 데이터 독립성

내부 스키마가 바뀌어도 개념 스키마는 그대로다.

```sql
CREATE INDEX idx_salary ON employees(salary);
DROP INDEX idx_emp_dept;

-- 테이블스페이스 이동
ALTER TABLE employees MOVE TABLESPACE new_storage;

-- 응용 쿼리는 그대로
SELECT * FROM employees;
```

### 두 독립성 비교

| 구분 | 논리적 독립성 | 물리적 독립성 |
|:---|:---|:---|
| 보호 대상 | 외부 스키마 | 개념 스키마 |
| 변경 축 | 개념 스키마 변경 | 내부 스키마 변경 |
| 흡수 사상 | 외부/개념 사상 | 개념/내부 사상 |
| 예시 상황 | 테이블 구조 변경 | 인덱스·저장 방식 변경 |
| 결과 | 앱 수정 불필요 | 논리 구조 수정 불필요 |

## 5. 데이터 사전 (시스템 카탈로그)

데이터 사전은 메타데이터(데이터에 대한 데이터)를 저장하는 시스템 DB다. 사용자 데이터와 분리돼 DBMS가 관리한다.

```text
 ┌──────────────────────────┐
 │      데이터베이스         │
 ├──────────┬───────────────┤
 │ 사용자   │ 시스템 DB     │
 │ 데이터    │ (데이터 사전) │
 │          │ (데이터 디렉터리)
 └──────────┴───────────────┘
```

사용자는 데이터 사전을 **읽기 전용으로 조회**할 수 있고, 데이터 디렉터리는 시스템 전용으로 실제 데이터 위치 정보를 관리한다.

### 데이터 사전이 저장하는 정보

| 정보 유형 | 내용 |
|:---|:---|
| 스키마 정보 | 테이블/뷰/인덱스 구조 정의 |
| 사상 정보 | 외부/개념, 개념/내부 매핑 |
| 제약조건 | PRIMARY KEY, FOREIGN KEY, CHECK |
| 사용자 정보 | 계정, 권한, 역할 |
| 통계 정보 | 테이블 크기, 행 수, 인덱스 통계 |

{{< callout type="info" >}}
통계 정보는 질의 최적화기(Query Optimizer)가 실행 계획을 세울 때 핵심적으로 사용된다. 통계가 오래되면 엉뚱한 실행 계획이 선택될 수 있어 주기적인 `ANALYZE` / 통계 수집이 필요하다.
{{< /callout >}}

### 데이터 사전 조회 예제

```sql
-- MySQL
SELECT table_name, table_rows, create_time
FROM information_schema.tables
WHERE table_schema = 'mydb';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employees';

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'employees';
```

```sql
-- PostgreSQL
SELECT tablename, tableowner FROM pg_catalog.pg_tables
WHERE schemaname = 'public';

SELECT attname, typname FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
WHERE attrelid = 'employees'::regclass;
```

```sql
-- Oracle
SELECT table_name, num_rows FROM user_tables;
SELECT column_name, data_type FROM user_tab_columns
WHERE table_name = 'EMPLOYEES';

-- DBA 전용
SELECT username, account_status FROM dba_users;
```

## 6. 데이터베이스 사용자

| 사용자 | 역할 | 주요 언어 |
|:---|:---|:---|
| DBA | 설계·운영·보안·튜닝 | DDL, DCL |
| 응용 프로그래머 | 앱 개발, SQL 임베딩 | DML, 호스트 언어 |
| 최종 사용자(캐주얼) | SQL 직접 사용 | DML |
| 최종 사용자(초보) | GUI·앱을 통한 접근 | 간접 DML |

### DBA 주요 업무

| 업무 | 설명 | SQL/도구 |
|:---|:---|:---|
| 스키마 정의 | DB 구조 설계·생성 | `CREATE TABLE/INDEX` |
| 접근 권한 관리 | 사용자별 권한 부여·회수 | `GRANT`, `REVOKE` |
| 무결성 관리 | 제약조건 정의 | `PRIMARY KEY`, `CHECK` |
| 백업/복구 | 데이터 보호 | `mysqldump`, `pg_dump` |
| 성능 튜닝 | 쿼리/인덱스 최적화 | `EXPLAIN`, 실행 계획 |
| 모니터링 | 시스템 상태 감시 | 모니터링 도구 |

```sql
-- 사용자·권한
CREATE USER 'developer'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT, INSERT, UPDATE ON mydb.* TO 'developer'@'localhost';

-- 제약조건
ALTER TABLE orders
ADD CONSTRAINT fk_customer
FOREIGN KEY (customer_id) REFERENCES customers(id);

-- 성능 분석
EXPLAIN SELECT * FROM orders WHERE customer_id = 100;
SHOW INDEX FROM orders;
```

## 7. 데이터 언어

SQL은 DDL, DML, DCL, TCL로 구성된다.

| 분류 | 역할 | 대표 명령 |
|:---|:---|:---|
| DDL | 스키마 정의/수정 | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` |
| DML | 데이터 조작 | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| DCL | 보안·권한 | `GRANT`, `REVOKE` |
| TCL | 트랜잭션 제어 | `COMMIT`, `ROLLBACK` |

### 절차적 vs 비절차적 DML

| 구분 | 절차적 DML | 비절차적 DML |
|:---|:---|:---|
| 설명 방식 | What + How | What만 |
| 사용자 | 어떻게 처리할지 직접 명시 | DBMS에 처리 방법 위임 |
| 예시 | PL/SQL, 커서 반복 | SQL `SELECT` 등 |
| 별칭 | - | 선언적(Declarative) 언어 |

```sql
-- 비절차적 (선언적)
SELECT name, salary
FROM employees
WHERE department = '개발팀'
ORDER BY salary DESC;
```

```sql
-- 절차적 (PL/SQL 커서)
DECLARE
    CURSOR emp_cursor IS
        SELECT name, salary FROM employees
        WHERE department = '개발팀';
    v_name employees.name%TYPE;
    v_salary employees.salary%TYPE;
BEGIN
    OPEN emp_cursor;
    LOOP
        FETCH emp_cursor INTO v_name, v_salary;
        EXIT WHEN emp_cursor%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_name || ': ' || v_salary);
    END LOOP;
    CLOSE emp_cursor;
END;
```

### DCL의 제어 기능

| 특성 | 설명 | 구현 방법 |
|:---|:---|:---|
| 무결성 | 정확·유효한 데이터 유지 | 제약조건, 트리거 |
| 보안 | 허가된 사용자만 접근 | GRANT, REVOKE |
| 회복 | 장애 시 일관성 유지 | 트랜잭션, 로그 |
| 동시성 | 여러 사용자 동시 접근 | 락, 격리 수준 |

```sql
-- 무결성
ALTER TABLE products
ADD CONSTRAINT chk_price CHECK (price > 0);

-- 보안
GRANT SELECT ON employees TO public_user;
REVOKE DELETE ON employees FROM public_user;

-- 회복·동시성
BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
```

## 8. DBMS 구성요소

```text
 ┌──────────────────────────┐
 │        DBMS              │
 │ ┌──────────────────────┐ │
 │ │ 질의 처리기           │ │
 │ │  DDL 컴파일러         │ │
 │ │  DML 프리컴파일러     │ │
 │ │  DML 컴파일러         │ │
 │ │         │             │ │
 │ │ 런타임 DB 처리기      │ │
 │ │         │             │ │
 │ │ 트랜잭션 관리자       │ │
 │ └─────────┬────────────┘ │
 │           ▼              │
 │ ┌──────────────────────┐ │
 │ │ 저장 데이터 관리자    │ │
 │ └─────────┬────────────┘ │
 └───────────┼──────────────┘
             ▼
       데이터베이스
     + 데이터 사전
```

| 구성요소 | 역할 |
|:---|:---|
| DDL 컴파일러 | 스키마 정의 해석 → 데이터 사전 저장 |
| DML 프리컴파일러 | 응용 프로그램에서 SQL 추출 |
| DML 컴파일러 | SQL 해석 → 실행 계획 생성 |
| 런타임 DB 처리기 | 실제 데이터 처리 실행 |
| 트랜잭션 관리자 | 권한·무결성·동시성·회복 관리 |
| 저장 데이터 관리자 | 물리 저장소 접근 (OS 연동) |

## 9. SQL 처리 흐름

```text
 SELECT * FROM employees
 WHERE salary > 50000;

 ① DML 컴파일러
    파싱·구문 검사
    데이터 사전으로 객체 확인
        │
 ② 트랜잭션 관리자
    권한·무결성 확인
        │
 ③ 쿼리 최적화
    실행 계획 수립
    (인덱스·조인 순서)
        │
 ④ 런타임 DB 처리기
    저장 데이터 관리자로
    디스크 read
        │
 ⑤ 결과 반환
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| DBS | DB + DBMS + 사용자 + 언어 + HW |
| 스키마 / 인스턴스 | 구조 정의 / 실제 값 |
| 외부 / 개념 / 내부 스키마 | 사용자 / 조직 / 저장 장치 관점 |
| 논리적 독립성 | 개념 변경 → 외부 영향 없음 |
| 물리적 독립성 | 내부 변경 → 개념 영향 없음 |
| 데이터 사전 | 메타데이터 시스템 카탈로그 |
| 데이터 디렉터리 | 실제 데이터 위치 정보 (시스템 전용) |
| DDL/DML/DCL/TCL | 정의/조작/제어/트랜잭션 제어 |
| 절차적/비절차적 DML | What+How / What |
| 질의 처리기 | SQL 해석·최적화·실행 |
| 저장 데이터 관리자 | 물리 저장소 접근 담당 |

{{< callout type="info" >}}
**용어 정리**
- **DBS**: 데이터베이스 시스템 전체
- **스키마 / 인스턴스**: 구조 정의 / 실제 데이터 값
- **외부 스키마 (서브 스키마)**: 사용자별 노출 구조
- **개념 스키마**: 전체 논리 구조 (1개)
- **내부 스키마**: 물리적 저장 구조 (1개)
- **외부/개념 사상**: 외부와 개념 스키마 사이의 매핑
- **개념/내부 사상**: 개념과 내부 스키마 사이의 매핑
- **논리적 독립성**: 개념 변경이 외부에 영향 없음
- **물리적 독립성**: 내부 변경이 개념에 영향 없음
- **데이터 사전**: 메타데이터 저장소 (시스템 카탈로그)
- **데이터 디렉터리**: 실제 데이터 위치 정보, 시스템 전용
- **DBA / 응용 프로그래머 / 최종 사용자**: DB 사용자 유형
- **DDL / DML / DCL / TCL**: 정의·조작·제어·트랜잭션 제어 언어
- **절차적 / 비절차적 DML**: 처리 방식 명시 여부
- **질의 처리기 / 저장 데이터 관리자**: DBMS 내부 핵심 모듈
- **트랜잭션 관리자**: 권한·무결성·동시성·회복을 담당
{{< /callout >}}
