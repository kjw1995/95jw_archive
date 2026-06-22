---
title: "동시성 프로그래밍"
weight: 3
sidebar:
  open: true
---

동시성과 병렬 프로그래밍의 개념과 실전 활용을 다룹니다.

---

| 주제 | 설명 |
|:-----|:-----|
| [동시성이란 무엇인가](01-what-is-concurrency) | 동시성의 정의, 필요성, 장점, 확장성 |
| [순차 실행과 병렬 실행](02-sequential-and-parallel-execution) | 순차/병렬 실행, 동시성 vs 병렬성, 암달의 법칙, 구스타프슨의 법칙 |
| [컴퓨터의 동작 원리](03-how-computers-work) | 플린 분류, SIMD/MIMD, CPU vs GPU, 런타임 시스템 |
| [동시성을 구현하는 재료](04-concurrency-ingredients) | 프로세스, 스레드, 컨텍스트 스위칭, 스레드 위험성 |
| [프로세스 간 통신](05-inter-process-communication) | 공유 메모리, 파이프, 메시지 큐, 소켓, 스레드 풀 |
| [멀티태스킹](06-multitasking) | CPU/IO 바운드, 컨텍스트 스위칭, 협력형·선점형, 스케줄러 |
| [작업 분해하기](07-task-decomposition) | 의존 관계 그래프, 작업/데이터 분해, 파이프라인, 맵·포크조인·맵리듀스, 입도 |
| [경쟁 조건과 동기화](08-race-conditions-and-synchronization) | 경쟁 조건, 임계 구역, 원자적 연산, 락, 뮤텍스, 세마포어, 동기화 비용 |
