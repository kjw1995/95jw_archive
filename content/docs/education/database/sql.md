---
title: "데이터베이스 언어 SQL"
weight: 8
---

# 데이터베이스 언어 SQL

SQL(Structured Query Language)은 **관계 데이터베이스를 위한 표준 질의어**로, 비절차적 데이터 언어의 특성을 갖는다.

---

## 1. SQL의 분류

| 분류 | 명칭 | 기능 | 주요 명령어 |
|------|------|------|-----------|
| **DDL** | 데이터 정의어 | 테이블 생성/변경/삭제 | CREATE, ALTER, DROP |
| **DML** | 데이터 조작어 | 데이터 검색/삽입/수정/삭제 | SELECT, INSERT, UPDATE, DELETE |
| **DCL** | 데이터 제어어 | 권한 부여/취소 | GRANT, REVOKE |

---

## 2. DDL - 데이터 정의어

### 2.1 CREATE TABLE - 테이블 생성

```sql
CREATE TABLE 테이블_이름 (
    속성_이름 데이터_타입 [NOT NULL] [DEFAULT 기본값],
    ...
    [PRIMARY KEY (속성_리스트)],
    [UNIQUE (속성_리스트)],
    [FOREIGN KEY (속성_리스트) REFERENCES 테이블(속성)]
        [ON DELETE 옵션] [ON UPDATE 옵션],
    [CONSTRAINT 이름 CHECK(조건)]
);
```

### 주요 데이터 타입

| 데이터 타입 | 의미 | 예시 |
|------------|------|------|
| `INT`, `INTEGER` | 정수 | 나이, 수량 |
| `CHAR(n)` | 고정 길이 문자열 | 우편번호 `CHAR(5)` |
| `VARCHAR(n)` | 가변 길이 문자열 | 이름 `VARCHAR(50)` |
| `NUMERIC(p,s)` | 고정 소수점 | 가격 `NUMERIC(10,2)` |
| `DATE` | 날짜 (년-월-일) | 생년월일 |
| `TIME` | 시간 (시:분:초) | 출근시간 |
| `DATETIME` | 날짜 + 시간 | 주문일시 |

### 키 정의

```sql
-- 기본키 (NULL 불가, 유일)
PRIMARY KEY (고객번호)

-- 대체키 (NULL 가능, 유일)
UNIQUE (주민번호)

-- 외래키 (참조 무결성)
FOREIGN KEY (학과코드) REFERENCES 학과(학과코드)
    ON DELETE SET NULL
    ON UPDATE CASCADE
```

### 외래키 옵션

| 옵션 | ON DELETE | ON UPDATE |
|------|----------|-----------|
| `NO ACTION` | 삭제 거부 (기본) | 수정 거부 (기본) |
| `CASCADE` | 함께 삭제 | 함께 수정 |
| `SET NULL` | NULL로 변경 | NULL로 변경 |
| `SET DEFAULT` | 기본값으로 변경 | 기본값으로 변경 |

### 예제: 테이블 생성

```sql
-- 고객 테이블
CREATE TABLE 고객 (
    고객번호    VARCHAR(10)  NOT NULL,
    이름       VARCHAR(50)  NOT NULL,
    연락처     VARCHAR(20),
    등급       VARCHAR(10)  DEFAULT 'Silver',
    가입일     DATE         DEFAULT CURRENT_DATE,
    PRIMARY KEY (고객번호),
    CONSTRAINT chk_등급 CHECK (등급 IN ('VIP', 'Gold', 'Silver'))
);

-- 주문 테이블
CREATE TABLE 주문 (
    주문번호    VARCHAR(20)  NOT NULL,
    주문일     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    총금액     INT          CHECK (총금액 > 0),
    고객번호   VARCHAR(10)  NOT NULL,
    PRIMARY KEY (주문번호),
    FOREIGN KEY (고객번호) REFERENCES 고객(고객번호)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
```

### 2.2 ALTER TABLE - 테이블 변경

```sql
-- 속성 추가
ALTER TABLE 고객 ADD 이메일 VARCHAR(100);

-- 속성 삭제
ALTER TABLE 고객 DROP COLUMN 이메일;

-- 제약조건 추가
ALTER TABLE 고객 ADD CONSTRAINT chk_나이 CHECK (나이 >= 0);

-- 제약조건 삭제
ALTER TABLE 고객 DROP CONSTRAINT chk_나이;
```

### 2.3 DROP TABLE - 테이블 삭제

```sql
DROP TABLE 주문;  -- 참조하는 테이블 먼저 삭제
DROP TABLE 고객;
```

> **주의**: 다른 테이블이 참조하고 있으면 삭제 불가. 외래키 제약조건을 먼저 삭제해야 함.

---

## 3. DML - 데이터 조작어

### 3.1 SELECT - 데이터 검색

#### 기본 구조

```sql
SELECT [ALL | DISTINCT] 속성_리스트
FROM 테이블_리스트
[WHERE 조건]
[GROUP BY 속성_리스트 [HAVING 조건]]
[ORDER BY 속성_리스트 [ASC | DESC]];
```

#### 기본 검색

```sql
-- 모든 속성 검색
SELECT * FROM 고객;

-- 특정 속성만 검색
SELECT 이름, 등급 FROM 고객;

-- 중복 제거
SELECT DISTINCT 등급 FROM 고객;

-- 별칭 사용
SELECT 이름 AS 고객명, 등급 AS 회원등급 FROM 고객;

-- 산술식
SELECT 상품명, 가격, 가격 * 0.9 AS 할인가 FROM 상품;
```

#### 조건 검색 (WHERE)

```sql
-- 비교 연산자
SELECT * FROM 상품 WHERE 가격 >= 10000;
SELECT * FROM 고객 WHERE 등급 = 'VIP';
SELECT * FROM 주문 WHERE 주문일 > '2024-01-01';

-- 논리 연산자 (AND, OR, NOT)
SELECT * FROM 상품 WHERE 가격 >= 10000 AND 재고 > 0;
SELECT * FROM 고객 WHERE 등급 = 'VIP' OR 등급 = 'Gold';
SELECT * FROM 상품 WHERE NOT 카테고리 = '전자제품';

-- BETWEEN
SELECT * FROM 상품 WHERE 가격 BETWEEN 10000 AND 50000;

-- IN
SELECT * FROM 고객 WHERE 등급 IN ('VIP', 'Gold');
```

#### LIKE - 패턴 검색

| 기호 | 의미 | 예시 |
|------|------|------|
| `%` | 0개 이상의 문자 | `'김%'` → 김, 김철수, 김영희 |
| `_` | 정확히 1개의 문자 | `'김__'` → 김철수, 김영희 (3글자) |

```sql
-- '김'으로 시작하는 이름
SELECT * FROM 고객 WHERE 이름 LIKE '김%';

-- '동'으로 끝나는 이름
SELECT * FROM 고객 WHERE 이름 LIKE '%동';

-- '영'이 포함된 이름
SELECT * FROM 고객 WHERE 이름 LIKE '%영%';

-- 두 번째 글자가 '길'인 이름
SELECT * FROM 고객 WHERE 이름 LIKE '_길%';
```

#### NULL 검색

```sql
-- NULL인 데이터 검색
SELECT * FROM 고객 WHERE 연락처 IS NULL;

-- NULL이 아닌 데이터 검색
SELECT * FROM 고객 WHERE 연락처 IS NOT NULL;
```

> **주의**: `= NULL`은 사용 불가. 반드시 `IS NULL` 사용

#### ORDER BY - 정렬

```sql
-- 오름차순 (기본값)
SELECT * FROM 상품 ORDER BY 가격 ASC;

-- 내림차순
SELECT * FROM 상품 ORDER BY 가격 DESC;

-- 다중 정렬
SELECT * FROM 고객 ORDER BY 등급 ASC, 가입일 DESC;
```

> **참고**: NULL은 오름차순에서 맨 마지막, 내림차순에서 맨 처음

#### 집계 함수

| 함수 | 의미 | 사용 가능 타입 |
|------|------|--------------|
| `COUNT` | 개수 | 모든 타입 |
| `SUM` | 합계 | 숫자 |
| `AVG` | 평균 | 숫자 |
| `MAX` | 최댓값 | 모든 타입 |
| `MIN` | 최솟값 | 모든 타입 |

```sql
-- 전체 고객 수
SELECT COUNT(*) FROM 고객;

-- 등급별 고객 수 (중복 제거)
SELECT COUNT(DISTINCT 등급) FROM 고객;

-- 상품 가격 통계
SELECT
    COUNT(*) AS 상품수,
    SUM(가격) AS 가격합계,
    AVG(가격) AS 평균가격,
    MAX(가격) AS 최고가,
    MIN(가격) AS 최저가
FROM 상품;
```

> **주의**: 집계 함수는 NULL 값을 제외하고 계산. WHERE 절에서 사용 불가.

#### GROUP BY - 그룹별 검색

```sql
-- 등급별 고객 수
SELECT 등급, COUNT(*) AS 고객수
FROM 고객
GROUP BY 등급;

-- 고객별 주문 총액
SELECT 고객번호, SUM(총금액) AS 주문총액
FROM 주문
GROUP BY 고객번호;

-- HAVING: 그룹 조건
SELECT 고객번호, COUNT(*) AS 주문횟수
FROM 주문
GROUP BY 고객번호
HAVING COUNT(*) >= 5;  -- 5회 이상 주문한 고객
```

> **WHERE vs HAVING**
> - WHERE: 그룹화 전 개별 투플 조건
> - HAVING: 그룹화 후 그룹 조건 (집계 함수 사용 가능)

#### JOIN - 조인 검색

```sql
-- 암시적 조인 (WHERE 절)
SELECT 고객.이름, 주문.주문번호, 주문.총금액
FROM 고객, 주문
WHERE 고객.고객번호 = 주문.고객번호;

-- 명시적 조인 (INNER JOIN)
SELECT 고객.이름, 주문.주문번호, 주문.총금액
FROM 고객 INNER JOIN 주문 ON 고객.고객번호 = 주문.고객번호;

-- 별칭 사용
SELECT c.이름, o.주문번호, o.총금액
FROM 고객 c INNER JOIN 주문 o ON c.고객번호 = o.고객번호;
```

##### 외부 조인

```sql
-- LEFT OUTER JOIN: 왼쪽 테이블 모든 행 포함
SELECT c.이름, o.주문번호
FROM 고객 c LEFT OUTER JOIN 주문 o ON c.고객번호 = o.고객번호;

-- RIGHT OUTER JOIN: 오른쪽 테이블 모든 행 포함
SELECT c.이름, o.주문번호
FROM 고객 c RIGHT OUTER JOIN 주문 o ON c.고객번호 = o.고객번호;

-- FULL OUTER JOIN: 양쪽 모든 행 포함
SELECT c.이름, o.주문번호
FROM 고객 c FULL OUTER JOIN 주문 o ON c.고객번호 = o.고객번호;
```

#### 서브쿼리 (부속 질의문)

```sql
-- 단일 행 서브쿼리 (=, <, > 등 사용)
SELECT * FROM 상품
WHERE 가격 > (SELECT AVG(가격) FROM 상품);

-- 다중 행 서브쿼리 (IN, EXISTS, ALL, ANY 사용)
SELECT * FROM 고객
WHERE 고객번호 IN (SELECT 고객번호 FROM 주문);
```

##### 다중 행 연산자

| 연산자 | 의미 |
|--------|------|
| `IN` | 결과 중 하나라도 일치하면 참 |
| `NOT IN` | 결과 중 일치하는 것이 없으면 참 |
| `EXISTS` | 결과가 하나라도 있으면 참 |
| `NOT EXISTS` | 결과가 하나도 없으면 참 |
| `ALL` | 결과 모두와 비교해 모두 참이면 참 |
| `ANY`, `SOME` | 결과 중 하나라도 참이면 참 |

```sql
-- EXISTS 예제
SELECT * FROM 고객 c
WHERE EXISTS (
    SELECT 1 FROM 주문 o WHERE o.고객번호 = c.고객번호
);

-- ALL 예제: 모든 VIP 고객보다 많이 주문한 고객
SELECT 고객번호, SUM(총금액) AS 총액
FROM 주문
GROUP BY 고객번호
HAVING SUM(총금액) > ALL (
    SELECT SUM(총금액)
    FROM 주문
    WHERE 고객번호 IN (SELECT 고객번호 FROM 고객 WHERE 등급 = 'VIP')
    GROUP BY 고객번호
);
```

### 3.2 INSERT - 데이터 삽입

```sql
-- 전체 속성 삽입
INSERT INTO 고객 VALUES ('C001', '홍길동', '010-1234-5678', 'VIP', '2024-01-01');

-- 특정 속성만 삽입 (나머지는 NULL 또는 DEFAULT)
INSERT INTO 고객 (고객번호, 이름) VALUES ('C002', '김철수');

-- 다른 테이블에서 데이터 복사
INSERT INTO VIP고객 (고객번호, 이름)
SELECT 고객번호, 이름 FROM 고객 WHERE 등급 = 'VIP';
```

### 3.3 UPDATE - 데이터 수정

```sql
-- 조건에 맞는 데이터 수정
UPDATE 상품 SET 가격 = 가격 * 1.1 WHERE 카테고리 = '식품';

-- 여러 속성 수정
UPDATE 고객 SET 등급 = 'VIP', 연락처 = '010-9999-9999' WHERE 고객번호 = 'C001';

-- 서브쿼리 활용
UPDATE 고객 SET 등급 = 'VIP'
WHERE 고객번호 IN (
    SELECT 고객번호 FROM 주문 GROUP BY 고객번호 HAVING SUM(총금액) > 1000000
);
```

> **주의**: WHERE 절 생략 시 모든 투플 수정됨

### 3.4 DELETE - 데이터 삭제

```sql
-- 조건에 맞는 데이터 삭제
DELETE FROM 주문 WHERE 주문일 < '2023-01-01';

-- 모든 데이터 삭제
DELETE FROM 주문;  -- 테이블 구조는 유지

-- 서브쿼리 활용
DELETE FROM 고객
WHERE 고객번호 NOT IN (SELECT DISTINCT 고객번호 FROM 주문);
```

---

## 4. 뷰 (View)

뷰는 **다른 테이블을 기반으로 만든 가상 테이블**이다. 실제 데이터를 저장하지 않고 논리적으로만 존재한다.

### 4.1 뷰 생성

```sql
CREATE VIEW 뷰_이름 [(속성_리스트)]
AS SELECT 문
[WITH CHECK OPTION];
```

```sql
-- VIP 고객 뷰
CREATE VIEW VIP고객뷰 AS
SELECT 고객번호, 이름, 연락처
FROM 고객
WHERE 등급 = 'VIP';

-- 주문 통계 뷰
CREATE VIEW 고객별주문통계 AS
SELECT c.고객번호, c.이름, COUNT(o.주문번호) AS 주문수, SUM(o.총금액) AS 총주문액
FROM 고객 c LEFT JOIN 주문 o ON c.고객번호 = o.고객번호
GROUP BY c.고객번호, c.이름;

-- WITH CHECK OPTION: 뷰 정의 조건 강제
CREATE VIEW VIP고객뷰 AS
SELECT * FROM 고객 WHERE 등급 = 'VIP'
WITH CHECK OPTION;  -- VIP가 아닌 데이터 삽입/수정 불가
```

### 4.2 뷰 활용

```sql
-- 뷰 조회 (일반 테이블처럼 사용)
SELECT * FROM VIP고객뷰;
SELECT * FROM 고객별주문통계 WHERE 총주문액 > 1000000;
```

### 4.3 뷰 변경 제한

**변경 불가능한 뷰:**
- 기본키가 포함되지 않은 뷰
- 집계 함수를 포함한 뷰
- DISTINCT가 포함된 뷰
- GROUP BY가 포함된 뷰
- 여러 테이블을 조인한 뷰 (대부분)

### 4.4 뷰 삭제

```sql
DROP VIEW VIP고객뷰;
```

### 4.5 뷰의 장점

| 장점 | 설명 |
|------|------|
| **질의 간소화** | 복잡한 조인/집계를 뷰로 정의해두면 간단히 조회 가능 |
| **보안 강화** | 민감한 컬럼을 제외한 뷰만 제공 |
| **논리적 독립성** | 기본 테이블 구조 변경 시 뷰만 수정하면 됨 |

---

## 5. SQL 실행 순서

```
FROM     → 테이블 선택
WHERE    → 행 필터링 (그룹화 전)
GROUP BY → 그룹화
HAVING   → 그룹 필터링
SELECT   → 컬럼 선택, 집계 함수 계산
ORDER BY → 정렬
LIMIT    → 결과 행 수 제한
```

---

## 6. 정리

### DDL 명령어

| 명령어 | 기능 |
|--------|------|
| `CREATE TABLE` | 테이블 생성 |
| `ALTER TABLE` | 테이블 구조 변경 |
| `DROP TABLE` | 테이블 삭제 |
| `CREATE VIEW` | 뷰 생성 |
| `DROP VIEW` | 뷰 삭제 |

### DML 명령어

| 명령어 | 기능 | 기본 형식 |
|--------|------|----------|
| `SELECT` | 검색 | SELECT ... FROM ... WHERE ... |
| `INSERT` | 삽입 | INSERT INTO ... VALUES ... |
| `UPDATE` | 수정 | UPDATE ... SET ... WHERE ... |
| `DELETE` | 삭제 | DELETE FROM ... WHERE ... |

### 주요 키워드

| 키워드 | 용도 |
|--------|------|
| `DISTINCT` | 중복 제거 |
| `AS` | 별칭 지정 |
| `LIKE` | 패턴 검색 |
| `IS NULL` | NULL 검사 |
| `BETWEEN` | 범위 검색 |
| `IN` | 목록 검색 |
| `ORDER BY` | 정렬 |
| `GROUP BY` | 그룹화 |
| `HAVING` | 그룹 조건 |
| `JOIN` | 테이블 연결 |
