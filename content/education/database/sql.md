---
title: "데이터베이스 언어 SQL"
weight: 7
---

## 1. SQL의 개념

SQL(Structured Query Language)은 관계 데이터베이스를 위한 표준 질의어로, 비절차적 데이터 언어의 특성을 가진다. 사용자는 "무엇을 얻을지"만 기술하고, "어떻게 얻을지"는 DBMS의 옵티마이저가 결정한다.

SQL은 크게 세 가지 하위 언어로 구분된다.

| 분류 | 명칭 | 기능 | 주요 명령어 |
|:---|:---|:---|:---|
| DDL | 데이터 정의어 | 테이블 생성/변경/삭제 | CREATE, ALTER, DROP |
| DML | 데이터 조작어 | 데이터 검색/삽입/수정/삭제 | SELECT, INSERT, UPDATE, DELETE |
| DCL | 데이터 제어어 | 권한 부여/취소 | GRANT, REVOKE |

## 2. DDL - 데이터 정의어

### CREATE TABLE

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
|:---|:---|:---|
| INT, INTEGER | 정수 | 나이, 수량 |
| CHAR(n) | 고정 길이 문자열 | 우편번호 CHAR(5) |
| VARCHAR(n) | 가변 길이 문자열 | 이름 VARCHAR(50) |
| NUMERIC(p,s) | 고정 소수점 | 가격 NUMERIC(10,2) |
| DATE | 날짜 (년-월-일) | 생년월일 |
| TIME | 시간 (시:분:초) | 출근시간 |
| DATETIME | 날짜 + 시간 | 주문일시 |

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
|:---|:---|:---|
| NO ACTION | 삭제 거부 (기본) | 수정 거부 (기본) |
| CASCADE | 함께 삭제 | 함께 수정 |
| SET NULL | NULL로 변경 | NULL로 변경 |
| SET DEFAULT | 기본값으로 변경 | 기본값으로 변경 |

### 테이블 생성 예제

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

### ALTER TABLE

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

### DROP TABLE

```sql
DROP TABLE 주문;   -- 참조하는 테이블 먼저 삭제
DROP TABLE 고객;
```

{{< callout type="warning" >}}
다른 테이블이 외래키로 참조하고 있으면 DROP이 거부된다. 참조 관계를 먼저 해제하거나 `CASCADE` 옵션으로 연관 객체까지 삭제해야 한다.
{{< /callout >}}

## 3. DML - 데이터 조작어

### SELECT 기본 구조

```sql
SELECT [ALL | DISTINCT] 속성_리스트
FROM 테이블_리스트
[WHERE 조건]
[GROUP BY 속성_리스트 [HAVING 조건]]
[ORDER BY 속성_리스트 [ASC | DESC]];
```

### 기본 검색

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

### 조건 검색 (WHERE)

```sql
-- 비교 연산자
SELECT * FROM 상품 WHERE 가격 >= 10000;
SELECT * FROM 고객 WHERE 등급 = 'VIP';
SELECT * FROM 주문 WHERE 주문일 > '2024-01-01';

-- 논리 연산자
SELECT * FROM 상품 WHERE 가격 >= 10000 AND 재고 > 0;
SELECT * FROM 고객 WHERE 등급 = 'VIP' OR 등급 = 'Gold';
SELECT * FROM 상품 WHERE NOT 카테고리 = '전자제품';

-- BETWEEN
SELECT * FROM 상품 WHERE 가격 BETWEEN 10000 AND 50000;

-- IN
SELECT * FROM 고객 WHERE 등급 IN ('VIP', 'Gold');
```

### LIKE - 패턴 검색

| 기호 | 의미 | 예시 |
|:---|:---|:---|
| % | 0개 이상의 문자 | '김%' → 김, 김철수, 김영희 |
| _ | 정확히 1개의 문자 | '김__' → 김철수, 김영희 |

```sql
SELECT * FROM 고객 WHERE 이름 LIKE '김%';
SELECT * FROM 고객 WHERE 이름 LIKE '%동';
SELECT * FROM 고객 WHERE 이름 LIKE '%영%';
SELECT * FROM 고객 WHERE 이름 LIKE '_길%';
```

### NULL 검색

```sql
SELECT * FROM 고객 WHERE 연락처 IS NULL;
SELECT * FROM 고객 WHERE 연락처 IS NOT NULL;
```

{{< callout type="warning" >}}
`= NULL`은 항상 UNKNOWN을 반환하므로 아무 행도 나오지 않는다. NULL 여부는 반드시 `IS NULL` / `IS NOT NULL`로 판별해야 한다.
{{< /callout >}}

### ORDER BY 정렬

```sql
SELECT * FROM 상품 ORDER BY 가격 ASC;
SELECT * FROM 상품 ORDER BY 가격 DESC;
SELECT * FROM 고객 ORDER BY 등급 ASC, 가입일 DESC;
```

NULL은 오름차순에서는 맨 뒤, 내림차순에서는 맨 앞에 위치한다 (DBMS마다 조금 다름).

### 집계 함수

| 함수 | 의미 | 사용 타입 |
|:---|:---|:---|
| COUNT | 개수 | 모든 타입 |
| SUM | 합계 | 숫자 |
| AVG | 평균 | 숫자 |
| MAX | 최댓값 | 모든 타입 |
| MIN | 최솟값 | 모든 타입 |

```sql
SELECT COUNT(*) FROM 고객;
SELECT COUNT(DISTINCT 등급) FROM 고객;

SELECT
    COUNT(*) AS 상품수,
    SUM(가격) AS 가격합계,
    AVG(가격) AS 평균가격,
    MAX(가격) AS 최고가,
    MIN(가격) AS 최저가
FROM 상품;
```

집계 함수는 NULL을 제외하고 계산한다. WHERE 절에서는 사용할 수 없고 HAVING 절에서만 가능하다.

### GROUP BY 그룹별 검색

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
HAVING COUNT(*) >= 5;
```

| 구분 | 적용 시점 | 집계 함수 |
|:---|:---|:---|
| WHERE | 그룹화 전 행 필터링 | 사용 불가 |
| HAVING | 그룹화 후 그룹 필터링 | 사용 가능 |

## 4. JOIN - 테이블 결합

### INNER JOIN

```sql
-- 암시적 조인
SELECT 고객.이름, 주문.주문번호, 주문.총금액
FROM 고객, 주문
WHERE 고객.고객번호 = 주문.고객번호;

-- 명시적 조인
SELECT 고객.이름, 주문.주문번호, 주문.총금액
FROM 고객 INNER JOIN 주문
    ON 고객.고객번호 = 주문.고객번호;

-- 별칭 사용
SELECT c.이름, o.주문번호, o.총금액
FROM 고객 c INNER JOIN 주문 o
    ON c.고객번호 = o.고객번호;
```

### OUTER JOIN

```sql
-- LEFT OUTER JOIN: 왼쪽 전체 포함
SELECT c.이름, o.주문번호
FROM 고객 c LEFT OUTER JOIN 주문 o
    ON c.고객번호 = o.고객번호;

-- RIGHT OUTER JOIN: 오른쪽 전체 포함
SELECT c.이름, o.주문번호
FROM 고객 c RIGHT OUTER JOIN 주문 o
    ON c.고객번호 = o.고객번호;

-- FULL OUTER JOIN: 양쪽 전체 포함
SELECT c.이름, o.주문번호
FROM 고객 c FULL OUTER JOIN 주문 o
    ON c.고객번호 = o.고객번호;
```

### CROSS JOIN

두 테이블의 카테시안 곱(모든 조합)을 만든다. 조인 조건이 없어 결과가 `|A| × |B|` 행으로 폭발하므로 주의해야 한다.

```sql
-- 모든 색상 × 모든 사이즈 조합 생성
SELECT 색상, 사이즈
FROM 색상테이블 CROSS JOIN 사이즈테이블;
```

### SELF JOIN

같은 테이블을 두 번 참조해 조인한다. 계층 구조나 자기 참조 관계 조회에 쓴다.

```sql
-- 직원과 상사를 한 행에 표시
SELECT e.이름 AS 직원, m.이름 AS 상사
FROM 직원 e LEFT JOIN 직원 m
    ON e.상사번호 = m.직원번호;
```

### 조인 관계 시각화

```text
 A       B        INNER    LEFT     RIGHT   FULL
┌─┐    ┌─┐      ┌──┐     ┌───┐    ┌───┐   ┌───┐
│ │    │ │  =>  │A∩B│    │A+ │    │ +B│   │A∪B│
│ │    │ │      │   │    │A∩B│    │A∩B│   │   │
└─┘    └─┘      └──┘     └───┘    └───┘   └───┘
```

## 5. 서브쿼리

### 단일 행 서브쿼리

```sql
SELECT * FROM 상품
WHERE 가격 > (SELECT AVG(가격) FROM 상품);
```

### 다중 행 서브쿼리

```sql
SELECT * FROM 고객
WHERE 고객번호 IN (SELECT 고객번호 FROM 주문);
```

### 다중 행 연산자

| 연산자 | 의미 |
|:---|:---|
| IN | 결과 중 하나라도 일치하면 참 |
| NOT IN | 결과에 없으면 참 |
| EXISTS | 결과가 하나라도 있으면 참 |
| NOT EXISTS | 결과가 하나도 없으면 참 |
| ALL | 결과 모두와 비교해 참이면 참 |
| ANY, SOME | 결과 중 하나라도 참이면 참 |

```sql
-- EXISTS
SELECT * FROM 고객 c
WHERE EXISTS (
    SELECT 1 FROM 주문 o WHERE o.고객번호 = c.고객번호
);

-- ALL
SELECT 고객번호, SUM(총금액) AS 총액
FROM 주문
GROUP BY 고객번호
HAVING SUM(총금액) > ALL (
    SELECT SUM(총금액)
    FROM 주문
    WHERE 고객번호 IN (
        SELECT 고객번호 FROM 고객 WHERE 등급 = 'VIP'
    )
    GROUP BY 고객번호
);
```

## 6. INSERT / UPDATE / DELETE

### INSERT

```sql
-- 전체 속성
INSERT INTO 고객
VALUES ('C001', '홍길동', '010-1234-5678', 'VIP', '2024-01-01');

-- 일부 속성
INSERT INTO 고객 (고객번호, 이름)
VALUES ('C002', '김철수');

-- 다른 테이블에서 복사
INSERT INTO VIP고객 (고객번호, 이름)
SELECT 고객번호, 이름 FROM 고객 WHERE 등급 = 'VIP';
```

### UPDATE

```sql
UPDATE 상품 SET 가격 = 가격 * 1.1 WHERE 카테고리 = '식품';

UPDATE 고객
SET 등급 = 'VIP', 연락처 = '010-9999-9999'
WHERE 고객번호 = 'C001';

UPDATE 고객 SET 등급 = 'VIP'
WHERE 고객번호 IN (
    SELECT 고객번호 FROM 주문
    GROUP BY 고객번호
    HAVING SUM(총금액) > 1000000
);
```

### DELETE

```sql
DELETE FROM 주문 WHERE 주문일 < '2023-01-01';
DELETE FROM 주문;   -- 테이블 구조 유지, 모든 행 삭제

DELETE FROM 고객
WHERE 고객번호 NOT IN (
    SELECT DISTINCT 고객번호 FROM 주문
);
```

{{< callout type="warning" >}}
UPDATE, DELETE에서 WHERE 절을 빠뜨리면 전체 행이 수정·삭제된다. 실수를 방지하려면 먼저 SELECT로 영향 범위를 확인한 뒤 실행하는 습관이 필요하다.
{{< /callout >}}

## 7. 인덱스 (INDEX)

인덱스는 특정 컬럼 값으로부터 행의 위치를 빠르게 찾도록 돕는 보조 자료구조다. 책의 목차처럼 조회 속도를 높이지만, INSERT/UPDATE/DELETE 시 인덱스도 갱신되므로 쓰기 비용은 증가한다.

### CREATE INDEX

```sql
-- 단일 컬럼 인덱스
CREATE INDEX idx_고객_이름 ON 고객(이름);

-- 복합 인덱스 (컬럼 순서 중요)
CREATE INDEX idx_주문_고객_주문일 ON 주문(고객번호, 주문일);

-- UNIQUE 인덱스 (중복 금지)
CREATE UNIQUE INDEX idx_고객_이메일 ON 고객(이메일);

-- 인덱스 삭제
DROP INDEX idx_고객_이름;
```

### 인덱스 설계 기준

| 상황 | 인덱스 적합성 |
|:---|:---|
| WHERE, JOIN, ORDER BY에 자주 쓰이는 컬럼 | 유리 |
| 값의 분포가 다양한 컬럼 (선택도 높음) | 유리 |
| 값이 거의 같은 컬럼 (예: 성별) | 불리 |
| 작은 테이블 | 불리 (풀 스캔이 더 빠름) |
| 쓰기가 매우 잦은 컬럼 | 불리 |

{{< callout type="info" >}}
복합 인덱스는 왼쪽 컬럼부터 순서대로 사용된다. `(A, B)` 인덱스는 `A`만 쓰는 조건에도 사용되지만, `B`만 쓰는 조건에는 사용되지 않는다.
{{< /callout >}}

## 8. 윈도우 함수

윈도우 함수는 집계 함수와 비슷하지만, **행을 그룹으로 합치지 않고** 원래 행 수를 유지하면서 그룹별 계산 결과를 각 행에 추가한다.

### 기본 문법

```sql
함수(인자) OVER (
    [PARTITION BY 컬럼]
    [ORDER BY 컬럼]
    [ROWS | RANGE ...]
)
```

### 대표 함수

| 함수 | 설명 |
|:---|:---|
| ROW_NUMBER() | 파티션 내 순번 (1, 2, 3, ...) |
| RANK() | 동점자 동일 순위, 다음 순위 건너뜀 |
| DENSE_RANK() | 동점자 동일 순위, 다음 순위 연속 |
| SUM / AVG OVER | 누적 합계, 이동 평균 |
| LAG / LEAD | 이전 / 다음 행 값 참조 |

### 예제

```sql
-- 고객별 주문을 최신순으로 번호 매기기
SELECT
    고객번호,
    주문번호,
    주문일,
    ROW_NUMBER() OVER (
        PARTITION BY 고객번호 ORDER BY 주문일 DESC
    ) AS 최근순번
FROM 주문;

-- 카테고리별 가격 순위
SELECT
    상품명,
    카테고리,
    가격,
    RANK() OVER (
        PARTITION BY 카테고리 ORDER BY 가격 DESC
    ) AS 가격순위
FROM 상품;

-- 누적 매출
SELECT
    주문일,
    총금액,
    SUM(총금액) OVER (ORDER BY 주문일) AS 누적매출
FROM 주문;
```

## 9. 뷰 (View)

뷰는 다른 테이블을 기반으로 만든 가상 테이블이다. 실제 데이터를 저장하지 않고 질의 결과를 논리적으로만 정의한다.

### 뷰 생성과 사용

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
SELECT
    c.고객번호,
    c.이름,
    COUNT(o.주문번호) AS 주문수,
    SUM(o.총금액) AS 총주문액
FROM 고객 c LEFT JOIN 주문 o
    ON c.고객번호 = o.고객번호
GROUP BY c.고객번호, c.이름;

-- 뷰 정의 조건 강제
CREATE VIEW VIP고객뷰 AS
SELECT * FROM 고객 WHERE 등급 = 'VIP'
WITH CHECK OPTION;
```

뷰는 일반 테이블처럼 조회할 수 있다.

```sql
SELECT * FROM VIP고객뷰;
SELECT * FROM 고객별주문통계 WHERE 총주문액 > 1000000;
```

### 변경 불가능한 뷰

- 기본키가 포함되지 않은 뷰
- 집계 함수가 포함된 뷰
- DISTINCT가 포함된 뷰
- GROUP BY가 포함된 뷰
- 여러 테이블을 조인한 뷰 (대부분)

### 뷰 삭제

```sql
DROP VIEW VIP고객뷰;
```

### 뷰의 장점

| 장점 | 설명 |
|:---|:---|
| 질의 간소화 | 복잡한 조인·집계를 뷰로 정의해 간단히 재사용 |
| 보안 강화 | 민감한 컬럼을 제외한 뷰만 제공 |
| 논리적 독립성 | 기본 테이블 구조 변경 시 뷰 정의만 수정 |

## 10. SQL 실행 순서

작성 순서와 실행 순서는 다르다. 옵티마이저는 다음 순서로 결과를 만든다.

```text
FROM     → 테이블 선택
WHERE    → 행 필터링
GROUP BY → 그룹화
HAVING   → 그룹 필터링
SELECT   → 컬럼 선택·집계 계산
ORDER BY → 정렬
LIMIT    → 행 수 제한
```

이 순서를 이해하면 "SELECT 별칭을 WHERE에서 쓸 수 없는 이유"처럼 자주 헷갈리는 규칙이 자연스럽게 설명된다.

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| DDL / DML / DCL | 정의 / 조작 / 제어 언어 |
| PRIMARY KEY / FOREIGN KEY | 기본키와 참조 무결성 |
| JOIN | INNER, LEFT/RIGHT/FULL OUTER, CROSS, SELF |
| 서브쿼리 | 단일 행 / 다중 행, IN·EXISTS·ALL·ANY |
| INDEX | 조회 가속, 쓰기 비용 증가 |
| 윈도우 함수 | 행 수 유지한 채 파티션별 계산 |
| VIEW | 가상 테이블, 질의 재사용과 보안 |
| 실행 순서 | FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY |

{{< callout type="info" >}}
**용어 정리**
- **SQL**: 관계 DB를 위한 표준 비절차적 질의어
- **DDL**: CREATE·ALTER·DROP 등 스키마 정의
- **DML**: SELECT·INSERT·UPDATE·DELETE 등 데이터 조작
- **DCL**: GRANT·REVOKE 등 권한 제어
- **기본키 / 외래키**: 고유 식별자 / 참조 무결성 제약
- **INNER / OUTER / CROSS / SELF JOIN**: 대표적 조인 유형
- **서브쿼리**: 질의 안에 포함된 또 다른 SELECT 문
- **인덱스**: 조회 속도를 높이는 보조 자료구조
- **윈도우 함수**: 행 수를 유지하면서 파티션별로 계산하는 함수
- **뷰**: 질의 결과로 정의한 가상 테이블
{{< /callout >}}
