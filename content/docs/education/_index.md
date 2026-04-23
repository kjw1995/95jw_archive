---
title: Education
sidebar:
  open: true
---

개발하면서 배운 것들을 기록하는 공간입니다. 언어, 프레임워크, 인프라까지 다양한 주제를 다룹니다.

---

## 둘러보기

{{< cards >}}
  {{< card link="java" title="Java" icon="code" subtitle="언어 기초부터 JVM, JPA, 동시성까지" >}}
  {{< card link="kotlin" title="Kotlin" icon="code" subtitle="코틀린 기초 문법과 핵심 원리" >}}
  {{< card link="spring" title="Spring" icon="cube" subtitle="스프링 핵심 원리와 배치 처리" >}}
  {{< card link="database" title="Database" icon="database" subtitle="데이터베이스 이론과 SQL" >}}
  {{< card link="redis" title="Redis" icon="lightning-bolt" subtitle="인메모리 키-값 저장소" >}}
  {{< card link="network" title="Network" icon="globe-alt" subtitle="네트워크 기초와 HTTP" >}}
  {{< card link="devops" title="DevOps" icon="server" subtitle="Kubernetes와 CI/CD" >}}
  {{< card link="linux" title="Linux" icon="terminal" subtitle="리눅스 기초와 셸 활용" >}}
  {{< card link="architecture" title="Architecture" icon="document-text" subtitle="REST API 설계" >}}
  {{< card link="concurrency" title="동시성 프로그래밍" icon="refresh" subtitle="동시성과 병렬 프로그래밍 개념" >}}
{{< /cards >}}

---

## 주제별 바로가기

### Java

| 주제 | 설명 |
|:-----|:-----|
| [Java 기초](java/basics) | 변수, 타입, 객체지향, 컬렉션 |
| [Modern Java](java/modern-java-in-action/) | 람다, 스트림, 함수형 프로그래밍 |
| [동시성](java/concurrency/) | 스레드 안전성과 동기화 |
| [JVM](java/jvm/) | 메모리 구조와 가비지 컬렉션 |
| [JPA](java/jpa/) | ORM과 영속성 컨텍스트 |
| [웹 프로그래밍](java/web-programming/) | JSP, Servlet, 스프링 기초 |

### Kotlin

| 주제 | 설명 |
|:-----|:-----|
| [Kotlin 기초](kotlin/basics/) | 변수, 자료형, Null 안전성 |

### Spring

| 주제 | 설명 |
|:-----|:-----|
| [핵심 원리](spring/spring-core-solid) | SOLID와 객체 지향 설계 |
| [컨테이너와 빈](spring/spring-container-bean) | ApplicationContext 이해하기 |
| [싱글톤](spring/spring-singleton-container) | 싱글톤 패턴과 CGLIB |
| [컴포넌트 스캔](spring/spring-component-scan) | 자동 빈 등록 |
| [의존관계 주입](spring/spring-dependency-injection) | 생성자 주입과 @Autowired |
| [빈 생명주기](spring/spring-bean-lifecycle) | 초기화와 소멸 콜백 |
| [빈 스코프](spring/spring-bean-scope) | 싱글톤, 프로토타입, 프록시 |
| [SpEL](spring/spring-spel) | 표현식 언어 |
| [Spring Batch](spring/batch/) | 배치 처리 기초 |
| [Spring Security](spring/security/) | 보안 개념과 구현 |

### Database

| 주제 | 설명 |
|:-----|:-----|
| [기본 개념](database/db-fundamentals) | 데이터베이스란? |
| [DBMS](database/dbms-overview) | DBMS의 역할과 기능 |
| [시스템 구조](database/db-system) | 스키마와 3단계 구조 |
| [데이터 모델링](database/data-modeling) | E-R 다이어그램 |
| [관계 모델](database/relational-model) | 릴레이션과 키 |
| [SQL](database/sql) | DDL, DML, 조인 |
| [정규화](database/normalization) | 이상 현상과 정규형 |
| [트랜잭션](database/recovery-concurrency) | ACID와 동시성 제어 |
| [보안](database/security-authorization) | 권한 관리와 암호화 |

### Redis

| 주제 | 설명 |
|:-----|:-----|
| [마이크로서비스와 레디스](redis/01-microservice-and-redis) | NoSQL, MSA, 레디스의 특징 |

### Network

| 주제 | 설명 |
|:-----|:-----|
| [기초](network/01-network-basics) | 네트워크 개념 잡기 |
| [OSI 모델](network/07-osi-tcpip-model) | 7계층과 4계층 |
| [데이터 링크 계층](network/12-datalink-layer-ethernet) | 이더넷, MAC, 스위치 |
| [네트워크 계층](network/17-network-layer-role) | IP, 라우팅, 서브넷 |
| [전송 계층](network/23-transport-layer-role) | TCP, UDP, 포트 |
| [응용 계층](network/28-application-layer-role) | DNS, HTTP, SMTP |
| [HTTP](network/http/) | HTTP 프로토콜 |

### DevOps

| 주제 | 설명 |
|:-----|:-----|
| [K8s 입문](devops/kubernetes/01-introduction) | 컨테이너와 쿠버네티스 |
| [핵심 개념](devops/kubernetes/02-core-concepts) | 컴포넌트, 파드, 워크로드 |
| [클러스터 구성](devops/kubernetes/03-cluster-setup) | kubeadm, HA, etcd |
| [워크로드 관리](devops/kubernetes/04-workloads) | Deployment, ConfigMap, Secret |
| [스케줄링](devops/kubernetes/05-scheduling) | Affinity, Taints, DaemonSet |
| [스토리지](devops/kubernetes/06-storage) | PV/PVC, StorageClass, CSI |
| [네트워킹](devops/kubernetes/07-networking) | Service, Ingress, CNI, Gateway API |
| [보안](devops/kubernetes/08-security) | RBAC, ServiceAccount, Network Policy |
| [관측성](devops/kubernetes/09-observability) | Metrics, HPA/VPA, 로깅 |
| [클러스터 유지보수](devops/kubernetes/10-cluster-maintenance) | 업그레이드, etcd 백업 |
| [Helm](devops/kubernetes/11-helm) | 패키지 매니저, Chart |
| [Kustomize](devops/kubernetes/12-kustomize) | Base/Overlay, Patches |
| [CI/CD](devops/kubernetes/13-cicd) | Jenkins, ArgoCD, GitOps |
| [트러블슈팅](devops/kubernetes/14-troubleshooting) | 장애 진단 |
| [JSONPath](devops/kubernetes/15-jsonpath) | kubectl 쿼리 |
| [시작하세요! 도커/쿠버네티스](devops/docker-k8s/) | 도커와 쿠버네티스 실전 |

### Linux

| 주제 | 설명 |
|:-----|:-----|
| [첫걸음](linux/01-linux-first-step) | 리눅스 시작하기 |
| [셸](linux/02-shell) | 셸의 역할과 종류 |
| [셸 활용](linux/03-shell-advanced) | 단축키와 히스토리 |
| [파일 시스템](linux/04-files-and-directories) | 경로와 파일 조작 |
| [파일 조작의 기본](linux/05-file-manipulation-basics) | 파일 조작 기본 명령어 |
| [파일 검색과 명령어](linux/06-file-search-and-commands) | find, locate, man |

### Architecture

| 주제 | 설명 |
|:-----|:-----|
| [REST 기초](architecture/restful/01-basics) | REST의 기원과 원칙 |
| [리소스 설계](architecture/restful/02-resource-design) | 콘텐츠 협상, 버저닝 |
| [보안과 추적성](architecture/restful/03-security) | 로깅, 인증, OAuth |
| [성능을 고려한 설계](architecture/restful/04-performance) | 캐싱, 비동기, PATCH |
| [고급 설계 원칙](architecture/restful/05-advanced) | Rate Limiting, HATEOAS |
| [실시간 API](architecture/restful/06-realtime) | SSE, WebSocket, GraphQL |

### 동시성 프로그래밍

| 주제 | 설명 |
|:-----|:-----|
| [동시성이란](concurrency/01-what-is-concurrency) | 동시성의 정의와 필요성 |
| [순차/병렬 실행](concurrency/02-sequential-and-parallel-execution) | 암달의 법칙, 구스타프슨의 법칙 |
| [컴퓨터 동작 원리](concurrency/03-how-computers-work) | 플린 분류, CPU vs GPU |
| [동시성 재료](concurrency/04-concurrency-ingredients) | 프로세스, 스레드, 컨텍스트 스위칭 |
