---
title: Education
sidebar:
  open: true
---

개발 언어, 프레임워크, 개념을 정리한 학습 노트입니다.

> **직접 접근**: https://kjw1995.github.io/95jw_archive/docs/education/

---

## 전체 카테고리

{{< cards >}}
  {{< card link="java" title="Java" icon="code" subtitle="Java 언어, JVM, JPA, 동시성" >}}
  {{< card link="spring" title="Spring" icon="cube" subtitle="Spring Framework & Boot" >}}
  {{< card link="database" title="Database" icon="database" subtitle="DB 개론, SQL, 정규화" >}}
  {{< card link="network" title="Network" icon="globe-alt" subtitle="OSI 7계층, TCP/IP, HTTP" >}}
  {{< card link="devops" title="DevOps" icon="server" subtitle="Kubernetes, CI/CD" >}}
  {{< card link="linux" title="Linux" icon="terminal" subtitle="셸, 파일 시스템" >}}
  {{< card link="architecture" title="Architecture" icon="document-text" subtitle="REST API, 설계 패턴" >}}
{{< /cards >}}

---

## 카테고리별 상세

### Java
Java 언어 및 JVM 관련 핵심 개념

| 주제 | 내용 |
|:-----|:-----|
| [Java 기초](java/01-java-intro) | 자바 시작하기, 변수, 타입 |
| [Modern Java](java/modern-java-in-action/) | 람다, 스트림, 함수형 프로그래밍 |
| [동시성](java/concurrency/) | 스레드 안전성, 동기화, 가시성 |
| [JVM](java/jvm/) | 메모리 관리, 가비지 컬렉션 |
| [JPA](java/jpa/) | 엔티티 매핑, 연관관계, 영속성 |
| [웹 프로그래밍](java/web-programming/) | JSP, Servlet, JNDI |

### Spring
Spring Framework 및 Spring Boot 핵심 원리

| 주제 | 내용 |
|:-----|:-----|
| [스프링 핵심 원리](spring/spring-core-solid) | SOLID 원칙, 객체 지향 설계 |
| [컨테이너와 빈](spring/spring-container-bean) | ApplicationContext, 빈 등록/조회 |
| [싱글톤](spring/spring-singleton-container) | 싱글톤 패턴, CGLIB |
| [컴포넌트 스캔](spring/spring-component-scan) | 자동 빈 등록, 필터 |
| [의존관계 주입](spring/spring-dependency-injection) | 생성자 주입, @Autowired |
| [빈 생명주기](spring/spring-bean-lifecycle) | @PostConstruct, 초기화/소멸 |
| [빈 스코프](spring/spring-bean-scope) | 싱글톤, 프로토타입, 프록시 |
| [SpEL](spring/spring-spel) | 표현식, 연산자, Security 연동 |
| [Spring Batch](spring/spring-batch-intro) | 배치 처리, Job, Step |

### Database
데이터베이스 개론 및 실무 지식

| 주제 | 내용 |
|:-----|:-----|
| [DB 기본 개념](database/db-fundamentals) | 정의, 특징, 데이터 분류 |
| [DBMS 개요](database/dbms-overview) | DBMS 정의, 기능, 장단점 |
| [데이터베이스 시스템](database/db-system) | 스키마, 3단계 구조, 독립성 |
| [데이터 모델링](database/data-modeling) | E-R 모델, 개체, 관계 |
| [관계 데이터 모델](database/relational-model) | 릴레이션, 키, 무결성 |
| [SQL](database/sql) | DDL, DML, 뷰, 조인 |
| [정규화](database/normalization) | 이상 현상, 1NF~BCNF |
| [트랜잭션](database/recovery-concurrency) | ACID, 로킹, 2PL |
| [보안](database/security-authorization) | GRANT, REVOKE, 암호화 |

### Network
컴퓨터 네트워크 기초부터 프로토콜까지

| 주제 | 내용 |
|:-----|:-----|
| [네트워크 기초](network/01-network-basics) | 네트워크 개념, 패킷, 프로토콜 |
| [비트와 바이트](network/02-bit-and-byte) | 정보 단위, 데이터 전송 |
| [LAN과 WAN](network/03-lan-and-wan) | 근거리/광역 통신망 |
| [가정 LAN 구성](network/04-home-lan-configuration) | 공유기, NAT, DHCP |
| [회사 LAN 구성](network/05-office-lan-configuration) | DMZ, 온프레미스, 클라우드 |
| [프로토콜](network/06-network-protocol) | TCP, UDP, IP, HTTP |
| [OSI/TCP-IP 모델](network/07-osi-tcpip-model) | 7계층, 4계층 모델 |
| [캡슐화](network/08-encapsulation-decapsulation) | 헤더, PDU, VPN |
| [물리 계층](network/09-physical-layer-nic) | 랜 카드, MAC 주소 |
| [케이블](network/10-cable-types-structure) | UTP, STP, 광케이블 |
| [HTTP](network/http/) | HTTP 프로토콜 심화 |

### DevOps
인프라 및 CI/CD 실무

| 주제 | 내용 |
|:-----|:-----|
| [Kubernetes 입문](devops/kubernetes-intro) | 컨테이너, 도커, 핵심 오브젝트 |
| [Kubernetes 기본](devops/kubernetes-concepts) | 컴포넌트, 서비스, 네트워크 |
| [Kubernetes 설치](devops/kubernetes-setup) | 경량 버전, 클라우드 서비스 |
| [Kubernetes 사용](devops/kubernetes-usage) | YAML, 배포 전략, 크론잡 |
| [영구 볼륨](devops/kubernetes-volumes) | PV/PVC, StorageClass |
| [서비스와 보안](devops/kubernetes-service-security) | Ingress, RBAC |
| [CI/CD](devops/kubernetes-cicd) | Jenkins, ArgoCD, GitOps |
| [리소스 관리](devops/kubernetes-resources) | 모니터링, 오토스케일링 |

### Linux
리눅스 운영체제 기초

| 주제 | 내용 |
|:-----|:-----|
| [리눅스 첫걸음](linux/01-linux-first-step) | 리눅스 소개, 배포판, 명령어 |
| [셸](linux/02-shell) | 셸의 역할, 종류, 환경변수 |
| [셸 고급](linux/03-shell-advanced) | 단축키, 자동완성, 히스토리 |
| [파일과 디렉터리](linux/04-files-and-directories) | 경로, ls, 파일 조작, 링크 |

### Architecture
소프트웨어 아키텍처 설계

| 주제 | 내용 |
|:-----|:-----|
| [REST API 기초](architecture/restful-api-basics) | REST의 기원, 설계 원칙 |
| [리소스 설계](architecture/restful-resource-design) | 콘텐츠 협상, API 버저닝 |
| [보안과 추적성](architecture/restful-security) | 로깅, OAuth, JWT |
| [성능 설계](architecture/restful-performance) | 캐싱, 비동기 처리 |
| [고급 설계](architecture/restful-advanced) | Rate Limiting, HATEOAS |
| [실시간 API](architecture/restful-realtime) | SSE, WebSocket |
