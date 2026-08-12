---
title: About Me
date: 2025-11-23
type: about
---

## 김정우 · Backend Developer

결제 도메인 4년차 백엔드 개발자입니다. PG·선불전자지급 영역에서 결제·충전 API부터 정산·세금계산서·회계연동 배치, 원천사 연동, 관리전산까지 결제 시스템 전 구간을 설계·개발해왔습니다.

Spring Batch 기반 정산·회계연동 배치를 다수 단독 구축했고, 금융감독원·금융결제원 심사 대응과 개인정보 마스킹·암호화 같은 금융권 컴플라이언스 요건을 실제 운영 시스템에 반영했습니다. 장애가 없는 코드보다 **장애가 나도 복구되는 구조**를 만드는 데 집중합니다.

{{< cards >}}
  {{< card title="결제 도메인 전 구간" subtitle="실시간 결제·충전 API와 정산·증빙·회계연동 배치를 함께 설계해, 앞단과 뒷단의 정합성을 같이 고려합니다." >}}
  {{< card title="소수 인원 완주 경험" subtitle="규격 분석부터 설계·개발·연동 테스트·운영 이관까지 단독 또는 2인 규모로 마감 내 완료한 프로젝트가 다수입니다." >}}
  {{< card title="지속 가능한 코드" subtitle="레거시 전환과 버전업 절차 표준화, 공통 로깅과 재처리 설계로 운영 중에도 손댈 수 있는 구조를 지향합니다." >}}
{{< /cards >}}

---

## 경력

| 회사 | 기간 | 소속 · 직급 |
|:-----|:-----|:-----------|
| (주)티엔씨테크놀로지 | 2025.11 ~ 재직중 | 솔루션 사업부 · 핀테크 플랫폼팀 · 책임 |
| (주)헬로핀테크 | 2023.02 ~ 2025.08 | 백엔드 개발 · 사원 |

### (주)티엔씨테크놀로지

PG·선불전자지급 결제 플랫폼의 신규 구축과 운영 고도화를 담당합니다.

| 기간 | 프로젝트 | 핵심 역할 |
|:-----|:---------|:---------|
| 2025.11 ~ 2026.06 | **크림페이 선불·PG 결제 플랫폼** | 원천사 API 연동 모듈, 충전·결제·취소 연계 처리, 정산·세금계산서·현금영수증 발행 배치, 공통 응답 로깅, 관리전산 개인정보 보안 처리 |
| 2026.03 ~ 진행중 | **Kovan 선불전자지급 시스템** | 선불 API 연동규격서(Swagger/OpenAPI) 작성·대외 배포, 회원·계좌·OTC·크레딧 도메인 API, 헥토파이낸셜 연동, 영업점 정산 모듈 |
| 2026.06 ~ 진행중 | **채비 거래 중계 모듈** | 이기종 결제 모듈 간 거래 중계 계층 설계, 결제수단 발급·취소·부분취소 단일 규격화 |
| 2026.06 ~ 2026.07 | **금융결제원 영중소가맹점 정산** | 영중소가맹점 관리·조회 API, 가맹점 스키마 변경 대응, 연동 실패 건 재처리(Retry) Job 설계 |
| 2026.05 ~ 진행중 | **사내 공통 모듈 버전업** | 결제 승인·가맹점·정산·암호화 모듈 Java·Spring 버전업, 버전업 표준 절차 문서화, AI 개발환경 도입·가이드 공유 |
| 2026.04 ~ 2026.05 | **현대캐피탈 전표 회계연동 배치** | Spring Batch·Quartz 기반 전표 변환 Job, 회계시스템 연동 파일 생성·전송 배치 |
| 2026.04 ~ 2026.05 | **더존페이먼츠 운영 지원** | 결제·정산·취소·매입 전 구간 통합 테스트, 관리전산 개인정보 마스킹 |

### (주)헬로핀테크

대출 중개 서비스의 정산·결제·서류 자동화 백엔드를 담당했습니다.

| 기간 | 프로젝트 | 핵심 역할 |
|:-----|:---------|:---------|
| 2024.12 ~ 2025.02 | **정산 프로세스 전환** | MySQL 프로시저 → Java 애플리케이션 전환, 기능별 모듈화, 전환 검증 절차 수립, 통합·단위 테스트 도입 |
| 2024.11 ~ 2024.12 | **PG 수수료 자동결제 구축** | 수수료 결제 페이지 및 자동 결제 시스템, 결제 이후 업무 프로세스 전산화 |
| 2024.07 ~ 2024.11 | **비대면 대출 서류 자동화** | 정부24 중개 시스템 연동, 외부 API 연동 모듈, DB 기반 재처리 로직, 심사·서류 제출 자동화 |
| 2023.12 ~ 2024.02 | **가맹점 통합 정산 배치** | 일·주·월 단위 Spring Batch 정산 취합, 백오피스 정산 관리 페이지(검색·필터·엑셀 다운로드) |
| 2023.02 ~ 2025.08 | **레거시 리팩토링·유지보수** | MyBatis → Spring Data JPA 마이그레이션, Spring Security 인증·인가 표준화, AOP 기반 공통 로깅 |

---

## 주요 성과

| 프로젝트 | 개선 지표 |
|:-----|:-----|
| 정산 프로세스 전환 | 요구 대응시간 67% 단축 · 처리 속도 60% 단축 · 신규 기능 개발 속도 57% 향상 · 유지보수 비용 50% 절감 |
| 비대면 대출 서류 자동화 | 신청 지연시간 92% 감소 · 업무 불일치·오류 67% 감소 |
| 가맹점 통합 정산 배치 | 금액 오류·누락 60% 감소 · 상품 출시 지연 75% 감소 |
| PG 수수료 자동결제 | 외부 의존 지연 75% 감소 · 금액 누락·실수 60% 감소 |

---

## 담당 영역

| 영역 | 내용 |
|:-----|:-----|
| 결제 · 충전 흐름 설계 | 충전·결제·취소 연계, 공급가액·부가세 계산, 계좌 점유 인증과 등록·해지 프로세스 |
| 정산 · 회계연동 배치 | Batch·Quartz 정산, 세금계산서·현금영수증 발행·대사, 전표 생성·전송 |
| 대외기관 · 원천사 연동 | 금융결제원·헥토파이낸셜·KCP 연동, 연동규격서 배포, 이기종 모듈 중계 |
| 금융 컴플라이언스 | 금융감독원 실사·금융결제원 심사 대응, 개인정보 마스킹·암호화 |
| 레거시 전환 · 표준화 | 프로시저 → Java, MyBatis → JPA, 버전업 절차 문서화 |

---

## 기술 스택

| 분류 | 기술 |
|:-----|:-----|
| Backend | Java · Spring Boot · Spring MVC · Spring Framework (Legacy) · Spring Batch · Spring Quartz · Spring Data JPA · Spring Security · Spring AOP · MyBatis · JSP · Thymeleaf |
| Frontend | JavaScript · jQuery |
| Database | MySQL · Oracle · Redis |
| Infra / CI·CD | Docker · Kubernetes · GitLab · Jenkins · GitOps · ArgoCD · Gradle |
| Observability / Tools | Prometheus · Grafana · Loki · ElasticSearch(ELK) · Swagger / OpenAPI · Slack |

---

## 학력 · 자격증

| 구분 | 내용 | 기간 |
|:-----|:-----|:-----|
| 학력 | 한국방송통신대학교 컴퓨터과학과 | 2025.03 ~ 재학중 |
| 교육 | 메가스터디IT 아카데미 JAVA 개발자 양성과정 | 2022.05 ~ 2022.10 |
| 자격증 | SQLD (SQL 개발자) · 한국데이터산업진흥원 | 2024.06 |

---

## GitHub

<div align="center">
  <img height="160em" src="https://github-readme-stats.vercel.app/api?username=kjw1995&show_icons=true&theme=default&include_all_commits=true&count_private=true&hide_border=true"/>
  <img height="160em" src="https://github-readme-stats.vercel.app/api/top-langs/?username=kjw1995&layout=compact&langs_count=6&theme=default&hide_border=true"/>
</div>

---

## Contact

| 항목 | 내용 |
|:-----|:-----|
| Email | [wjddn312@naver.com](mailto:wjddn312@naver.com) |
| Phone | [010-2914-5146](tel:01029145146) |

<p>
  <a href="https://velog.io/@kjw1995"><img src="https://img.shields.io/badge/Velog-20C997?style=flat-square&logo=velog&logoColor=white" /></a>
  <a href="https://github.com/kjw1995"><img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" /></a>
  <a href="https://kjw1995.github.io/about_kjw_dev.github.io"><img src="https://img.shields.io/badge/Portfolio-000000?style=flat-square&logo=github-pages&logoColor=white" /></a>
</p>
