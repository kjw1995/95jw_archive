---
title: 회복과 병행 제어
weight: 10
---

## 1. 트랜잭션

### 개념

트랜잭션(Transaction)은 하나의 작업을 수행하는 데 필요한 데이터베이스 연산들의 모임이며, 논리적인 작업의 단위다.

```text
┌────────────────────────┐
│  계좌 이체 트랜잭션      │
├────────────────────────┤
│ BEGIN TRANSACTION      │
│  1. A계좌 10,000 출금  │
│  2. B계좌 10,000 입금  │
│ COMMIT / ROLLBACK      │
└────────────────────────┘
   모두 성공 또는 모두 취소
   (All or Nothing)
```

### ACID 특성

| 특성 | 영문 | 설명 | 담당 기능 |
|:---|:---|:---|:---|
| 원자성 | Atomicity | 모두 수행되거나 아예 수행되지 않음 | 회복 |
| 일관성 | Consistency | 수행 전후 일관된 상태 유지 | 병행 제어 |
| 격리성 | Isolation | 수행 중 중간 결과를 감추어 보호 | 병행 제어 |
| 지속성 | Durability | 완료 결과는 영구 보존 | 회복 |

```text
[원자성] [일관성] [격리성] [지속성]
   │       │       │       │
   └───┬───┘       └───┬───┘
       ▼               ▼
   회복 기능        병행 제어
```

### 트랜잭션 연산

| 연산 | 설명 |
|:---|:---|
| COMMIT | 트랜잭션 성공 선언 (작업 완료) |
| ROLLBACK | 트랜잭션 실패 선언 (작업 취소) |

```sql
-- 계좌 이체 예제
BEGIN TRANSACTION;

UPDATE 계좌 SET 잔액 = 잔액 - 10000
 WHERE 계좌번호 = 'A001';
UPDATE 계좌 SET 잔액 = 잔액 + 10000
 WHERE 계좌번호 = 'B001';

-- 성공 시
COMMIT;
-- 오류 시
-- ROLLBACK;
```

### 트랜잭션의 상태

```text
        ┌──────────┐
        │  활동    │
        │ (Active) │
        └────┬─────┘
     ┌───────┴───────┐
     ▼               ▼
 ┌────────┐      ┌──────┐
 │부분완료 │      │ 실패 │
 └───┬────┘      └──┬───┘
     │ commit       │ rollback
     ▼               ▼
 ┌────────┐      ┌──────┐
 │  완료  │      │ 철회 │
 └────────┘      └──────┘
```

| 상태 | 설명 |
|:---|:---|
| 활동 | 수행 중 |
| 부분 완료 | 마지막 연산 실행 직후 (DB 반영 전) |
| 완료 | commit 완료, DB에 반영 |
| 실패 | 장애로 중단 |
| 철회 | rollback으로 이전 상태 복귀 |

## 2. 장애와 회복

### 장애 유형

| 유형 | 설명 | 원인 |
|:---|:---|:---|
| 트랜잭션 장애 | 수행 중 오류 | 논리 오류, 자원 부족 |
| 시스템 장애 | 하드웨어 결함 | 메모리 손실, 교착 상태 |
| 미디어 장애 | 디스크 결함 | 헤드 손상, 고장 |

### 저장 장치 계층

```text
┌────────────────┐
│ 휘발성 저장장치 │ 장애 시 손실
│ (메인 메모리)  │ 속도: 빠름
└───────┬────────┘
        │ input/output
        ▼
┌────────────────┐
│비휘발성 저장장치│ 장애 시에도 유지
│ (디스크·SSD)   │ 장치 고장엔 취약
└───────┬────────┘
        │ dump
        ▼
┌────────────────┐
│ 안정 저장장치   │ 다중 복사본
│ (RAID, 백업)   │ 어떤 장애에도
└────────────────┘  데이터 보존
```

### 데이터 이동 연산

```text
┌──────────┐ read(X)  ┌──────────┐
│ 프로그램 │◄─────────│ 버퍼 블록 │
│  변수    │─────────►│ (메모리)  │
└──────────┘ write(X) └────┬─────┘
                           │
                 input(X)  │  ▲ output(X)
                           ▼  │
                      ┌──────────┐
                      │  디스크   │
                      └──────────┘
```

| 연산 | 방향 |
|:---|:---|
| input(X) | 디스크 → 메모리 |
| output(X) | 메모리 → 디스크 |
| read(X) | 버퍼 → 프로그램 변수 |
| write(X) | 프로그램 변수 → 버퍼 |

### 복사본 생성 방법

| 방법 | 설명 |
|:---|:---|
| 덤프(Dump) | DB 전체를 주기적으로 별도 매체에 복사 |
| 로그(Log) | 변경 연산마다 before/after 값을 기록 |

### 회복 연산

| 연산 | 설명 | 사용 시점 |
|:---|:---|:---|
| redo | 로그로 변경을 재실행 | DB 전반 손상 시 |
| undo | 로그로 변경을 취소 | 변경 중 내용만 손상 시 |

## 3. 로그 기반 회복과 WAL

### 로그 레코드 구성

```text
<T1, start>
<T1, A, 1000, 950>
<T1, B, 2000, 2050>
<T1, commit>
<T2, start>
<T2, C, 500, 400>
<checkpoint [T2]>
<T2, D, 300, 350>
<T2, commit>
<T3, start>
<T3, E, 100, 80>
────── 장애 ──────

→ T3 commit 없음 → undo
→ T2 checkpoint 이후 commit → redo
```

| 로그 타입 | 형식 | 의미 |
|:---|:---|:---|
| 시작 | `<Ti, start>` | 트랜잭션 시작 |
| 갱신 | `<Ti, X, old, new>` | X를 old → new로 변경 |
| 완료 | `<Ti, commit>` | 트랜잭션 완료 |
| 철회 | `<Ti, abort>` | 트랜잭션 취소 |
| 검사점 | `<checkpoint [..]>` | 활성 트랜잭션 목록 |

### WAL (Write-Ahead Logging)

WAL은 "로그를 먼저 쓴 뒤에만 데이터 블록을 디스크로 내린다"는 원칙이다. 이 규칙이 지켜져야 장애가 나도 로그를 이용해 정확히 회복할 수 있다.

| WAL 규칙 | 내용 |
|:---|:---|
| Log-first | 데이터 블록보다 로그를 먼저 디스크에 기록 |
| Commit 보장 | commit 로그가 디스크에 도달해야 트랜잭션 완료로 본다 |
| Log Sequence Number | 로그마다 LSN을 부여해 순서 보장 |

```text
[메모리]         [디스크]
buffer  ─── log ──► WAL log
                       │
                       ▼
                   data pages
                   (나중에 flush)

규칙: data page LSN ≤ 이미 기록된 log LSN
```

{{< callout type="warning" >}}
WAL 규칙을 어기고 데이터 블록을 먼저 내리면, commit 로그가 손실된 상태에서 데이터만 디스크에 남을 수 있다. 이 경우 undo/redo 판단 기준 자체가 깨진다.
{{< /callout >}}

### UNDO / REDO 알고리즘

회복 관리자는 로그를 순회하며 두 개의 리스트를 만든다.

| 리스트 | 대상 | 처리 |
|:---|:---|:---|
| undo-list | start는 있는데 commit·abort 없음 | undo 실행 |
| redo-list | commit 로그가 존재 | redo 실행 |

```text
1) Analysis
   로그를 순방향 스캔해
   checkpoint 기반으로 undo/redo 목록 결정

2) Redo (순방향)
   checkpoint 이후 모든 commit 로그를
   다시 적용한다 (before 값 무시).

3) Undo (역방향)
   undo-list의 트랜잭션을 역순으로 되돌린다.
   보상 로그(CLR)를 남겨 crash-on-recovery에 대비.
```

### 즉시 갱신 vs 지연 갱신

| 구분 | 즉시 갱신 | 지연 갱신 |
|:---|:---|:---|
| DB 반영 시점 | 수행 중 즉시 | 부분 완료 후 일괄 |
| 로그 기록 | `<Ti, X, old, new>` | `<Ti, X, new>` |
| commit 전 장애 | undo 필요 | 로그 무시 |
| commit 후 장애 | redo 필요 | redo 필요 |

```text
[즉시 갱신]           [지연 갱신]
로그 기록              로그 기록
  │                     │
  ▼                     │ (DB 반영 없음)
DB 반영                 │
  │                     ▼
  ▼                   commit
commit                   │
                         ▼
                       DB 반영
장애 시: undo/redo     장애 시: redo만
```

### 검사 시점(Checkpoint)

전체 로그를 매번 분석하는 비용을 줄이기 위해 주기적으로 검사점을 설정한다.

```text
시간 ─────────────────────────────►

T1 ├───┤                  checkpoint 전 완료 (스킵)
T2 ├────────┤              checkpoint 직후 commit (redo)
T3    ├─────┼────┤         수행 중 장애 (undo)
T4           │ ├────┤      checkpoint 후 commit (redo)
T5           │     ├── 장애 (undo)
             │     │
        checkpoint 장애 발생
```

| 트랜잭션 상태 | 회복 처리 |
|:---|:---|
| checkpoint 전 완료 | 무시 |
| checkpoint 전 시작, 이후 commit | redo |
| checkpoint 시점에 수행 중 → 장애 | undo |
| checkpoint 후 시작, 이후 commit | redo |
| checkpoint 후 시작, 장애 시 수행 중 | undo |

## 4. 병행 제어

### 병행 수행의 개념

여러 트랜잭션이 인터리빙 방식으로 동시에 수행되는 것을 병행 수행이라 한다.

```text
[직렬 수행]
T1: ████████████
T2:              ████████████

[병행 수행 - 인터리빙]
T1: ████  ████  ████
T2:   ████  ████  ████
```

### 병행 수행의 문제점

**갱신 분실 (Lost Update)**

```text
초기값 X = 100

T1                T2
read(X) = 100
                  read(X) = 100
X = X - 10
                  X = X + 20
write(X) = 90
                  write(X) = 120

결과: 120
기대: 110 (T1의 -10 분실)
```

**모순성 (Inconsistency)**

```text
초기값 X = 100, Y = 100

T1 (각 2배)       T2 (X+Y 합계)
read(X)
X = X * 2 = 200
write(X)
                  read(X) = 200
                  read(Y) = 100
read(Y)           합계 = 300  ← 모순!
Y = Y * 2
write(Y)

T1 완료 후 합계: 400
T2가 읽은 합계: 300
```

**연쇄 복귀 (Cascading Rollback)**

```text
T1                T2
read(X)
X = X - 10
write(X)
                  read(X)  ← T1 변경값 사용
                  X = X + 5
                  write(X)
장애
ROLLBACK
                  ROLLBACK 필요 (연쇄)

T2가 이미 commit 했다면 복구 불가
```

### 트랜잭션 스케줄

| 유형 | 설명 | 정확성 |
|:---|:---|:---|
| 직렬 | 순차 실행 (인터리빙 없음) | 항상 정확 |
| 비직렬 | 인터리빙 수행 | 보장 없음 |
| 직렬 가능 | 직렬과 동일 결과를 내는 비직렬 | 정확 |

```text
[직렬]
T1: r(A)→w(A)→r(B)→w(B)
T2:                       r(A)→w(A)
✓ 정확  ✗ 병행성 없음

[직렬 가능]
T1: r(A)→w(A)─────────►r(B)→w(B)
T2:         r(A)→w(A)
✓ 정확  ✓ 병행성

[직렬 불가능]
T1: r(A)─────────►w(A)
T2:     r(A)→w(A)
✗ 갱신 분실 등 문제 발생
```

## 5. 로킹(Locking) 기법

### Lock 종류

| 연산 | 설명 | 공존 Lock |
|:---|:---|:---|
| 공용 Lock (S) | read만 가능, write 불가 | S만 허용 |
| 전용 Lock (X) | read·write 가능 | 모두 불허 |

```text
양립성          S       X
────────────────────────
  S             ✓       ✗
  X             ✗       ✗
```

### 로킹 단위

```text
로킹 단위  작음 ──────────────► 큼
          (속성)(튜플)(릴레이션)(DB)

병행성       높음 ◄──► 낮음
복잡도       높음 ◄──► 낮음
오버헤드     높음 ◄──► 낮음
```

### 2단계 로킹 규약 (2PL)

2PL을 지키면 직렬 가능성이 보장된다.

| 단계 | 설명 |
|:---|:---|
| 확장 | Lock 연산만 수행 |
| 축소 | Unlock 연산만 수행 |

```text
Lock 수
  ▲
  │     Lock Point
  │        ▼
  │      ┌──┐
  │     /    \
  │    /      \
  │   /        \
  └────────────────► 시간
    확장 │  축소
    Lock │  Unlock
```

**준수 vs 위반 예**

```text
[2PL 준수]             [2PL 위반]
lock(A)   ┐            lock(A)
read(A)   │ 확장       read(A)
lock(B)   │            unlock(A) ← Unlock
read(B)   ┘            lock(B)   ← 다시 Lock
write(A)               read(B)
unlock(A) ┐ 축소       unlock(B)
write(B)  │
unlock(B) ┘            ✗ 직렬 가능성 X

✓ 직렬 가능성 O
```

### 교착 상태 (Deadlock)

2PL을 써도 교착 상태가 발생할 수 있다.

```text
T1                T2
lock(A)
                  lock(B)
lock(B) 대기
                  lock(A) 대기

       A ◄── T1 lock
       │  T2 대기
       ▼
       B ◄── T2 lock
       │  T1 대기
       ▼
   서로 대기 → Deadlock
```

### Wait-For Graph (대기 그래프)

교착 상태를 탐지하기 위해 트랜잭션 간 대기 관계를 방향 그래프로 표현한다. **사이클이 존재하면 교착 상태**다.

```text
T1 ── 대기 ──► T2
 ▲             │
 │             │
 └──── 대기 ───┘

사이클 발견 → Deadlock
```

| 노드 | 간선 |
|:---|:---|
| 트랜잭션 | 다른 Ti가 보유한 Lock을 기다림 |

```text
[정상]
T1 ──► T2 ──► T3
사이클 없음 → OK

[교착]
T1 ──► T2
 ▲      │
 │      ▼
 └──── T3
사이클 → 희생자 선택 후 rollback
```

### 교착 상태 해결 방법

| 방법 | 설명 |
|:---|:---|
| 예방 | 교착 상태가 발생하지 않도록 사전 조치 (WAIT-DIE, WOUND-WAIT) |
| 탐지 | Wait-For Graph로 주기적 탐지, 희생자 rollback |
| 타임아웃 | 일정 시간 대기 후 자동 롤백 |

| 예방 기법 | 동작 |
|:---|:---|
| WAIT-DIE | 오래된 트랜잭션만 대기, 새 트랜잭션은 즉시 abort |
| WOUND-WAIT | 오래된 트랜잭션이 새 것을 abort(상처), 새 것은 대기 |

{{< callout type="info" >}}
MySQL InnoDB는 Wait-For Graph 기반 탐지기를 내부적으로 돌리며, 사이클이 감지되면 비용이 가장 낮은 트랜잭션을 골라 자동으로 rollback 한다. `SHOW ENGINE INNODB STATUS`에서 `LATEST DETECTED DEADLOCK` 으로 확인할 수 있다.
{{< /callout >}}

## 6. 격리 수준과 이상 현상

### 이상 현상 정의

| 이상 현상 | 의미 |
|:---|:---|
| Dirty Read | 커밋되지 않은 데이터를 읽음 |
| Non-Repeatable Read | 같은 트랜잭션에서 같은 행을 두 번 읽을 때 값이 달라짐 |
| Phantom Read | 조건으로 읽을 때 행 개수가 달라짐 |
| Lost Update | 두 트랜잭션의 동시 갱신으로 하나가 사라짐 |

### 격리 수준별 대응

SQL 표준이 정의한 네 가지 격리 수준이다.

| 격리 수준 | Dirty | Non-Repeatable | Phantom |
|:---|:---|:---|:---|
| READ UNCOMMITTED | 발생 | 발생 | 발생 |
| READ COMMITTED | 차단 | 발생 | 발생 |
| REPEATABLE READ | 차단 | 차단 | 발생 |
| SERIALIZABLE | 차단 | 차단 | 차단 |

```text
수준 ▲ 안전성 높음, 동시성 낮음
│ SERIALIZABLE
│ REPEATABLE READ
│ READ COMMITTED
│ READ UNCOMMITTED
▼ 안전성 낮음, 동시성 높음
```

{{< callout type="info" >}}
MySQL InnoDB의 기본값은 REPEATABLE READ지만, 갭 락(Gap Lock)을 함께 사용해 phantom까지 대부분 차단한다. PostgreSQL의 REPEATABLE READ는 스냅숏 격리(SI)로 동작한다.
{{< /callout >}}

## 7. 실무 SQL 예제

### 트랜잭션 제어

```sql
-- MySQL 트랜잭션 예제
START TRANSACTION;

-- 계좌 이체
UPDATE accounts
   SET balance = balance - 10000
 WHERE account_id = 'A001';
UPDATE accounts
   SET balance = balance + 10000
 WHERE account_id = 'B001';

-- 잔액 확인
SELECT balance FROM accounts
 WHERE account_id IN ('A001', 'B001');

COMMIT;
-- ROLLBACK;
```

### 격리 수준 설정

```sql
-- 현재 격리 수준 확인
SELECT @@transaction_isolation;

-- 격리 수준 변경
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

### Lock 확인 및 관리

```sql
-- 현재 Lock 상태 (MySQL)
SELECT * FROM performance_schema.data_locks;

-- 대기 중인 Lock
SELECT * FROM performance_schema.data_lock_waits;

-- 전용 Lock (FOR UPDATE)
SELECT * FROM accounts
 WHERE account_id = 'A001'
 FOR UPDATE;

-- 공용 Lock
SELECT * FROM accounts
 WHERE account_id = 'A001'
 FOR SHARE;
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 트랜잭션 | 논리적 작업의 단위 |
| ACID | 원자성·일관성·격리성·지속성 |
| COMMIT / ROLLBACK | 완료·취소 선언 |
| 장애 유형 | 트랜잭션·시스템·미디어 |
| WAL | 로그 먼저, 데이터 나중 |
| undo / redo | 취소·재실행 연산 |
| 즉시 vs 지연 갱신 | DB 반영 시점 차이 |
| Checkpoint | 회복 범위를 좁혀주는 기준점 |
| 직렬 가능 스케줄 | 직렬과 동일한 결과 |
| S-Lock / X-Lock | 공용·전용 로크 |
| 2PL | 확장 후 축소, 직렬 가능성 보장 |
| 교착 상태 | 서로 Lock을 기다리는 사이클 |
| Wait-For Graph | 교착 탐지용 방향 그래프 |
| 격리 수준 | READ UNCOMMITTED ~ SERIALIZABLE |
| Dirty / Non-Repeatable / Phantom | 격리 수준별 이상 현상 |

{{< callout type="info" >}}
**용어 정리**
- **트랜잭션**: 데이터베이스에서 하나의 논리적 작업 단위
- **ACID**: Atomicity, Consistency, Isolation, Durability
- **COMMIT / ROLLBACK**: 트랜잭션 완료·취소 연산
- **WAL (Write-Ahead Logging)**: 데이터 변경보다 로그를 먼저 기록하는 원칙
- **LSN**: 로그 레코드 순서 번호
- **undo / redo**: 변경을 취소·재실행하는 회복 연산
- **Checkpoint**: 회복 시 분석 범위를 좁히는 기준 시점
- **즉시 갱신 / 지연 갱신**: DB 반영 시점에 따른 회복 기법
- **스케줄**: 여러 트랜잭션 연산의 실행 순서
- **직렬 가능 (Serializable)**: 직렬 실행과 동일한 결과를 보장
- **S-Lock / X-Lock**: 공용·전용 로크
- **2PL**: Two-Phase Locking, 확장 후 축소 규약
- **Deadlock**: 서로의 로크를 기다려 진행이 멈추는 상태
- **Wait-For Graph**: 트랜잭션 간 대기 관계를 표현한 방향 그래프
- **WAIT-DIE / WOUND-WAIT**: 교착 상태 예방 기법
- **격리 수준**: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE
- **Dirty / Non-Repeatable / Phantom Read**: 격리 수준에서 정의되는 이상 현상
{{< /callout >}}
