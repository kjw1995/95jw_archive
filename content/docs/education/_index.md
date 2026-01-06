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
  {{< card link="spring" title="Spring" icon="cube" subtitle="스프링 핵심 원리와 배치 처리" >}}
  {{< card link="database" title="Database" icon="database" subtitle="데이터베이스 이론과 SQL" >}}
  {{< card link="network" title="Network" icon="globe-alt" subtitle="네트워크 기초와 HTTP" >}}
  {{< card link="devops" title="DevOps" icon="server" subtitle="Kubernetes와 CI/CD" >}}
  {{< card link="linux" title="Linux" icon="terminal" subtitle="리눅스 기초와 셸 활용" >}}
  {{< card link="architecture" title="Architecture" icon="document-text" subtitle="REST API 설계" >}}
{{< /cards >}}

---

## 주제별 바로가기

### Java

| 주제 | 설명 |
|:-----|:-----|
| [Java 기초](java/01-java-intro) | 자바 시작하기 |
| [Modern Java](java/modern-java-in-action/) | 람다, 스트림, 함수형 프로그래밍 |
| [동시성](java/concurrency/) | 스레드 안전성과 동기화 |
| [JVM](java/jvm/) | 메모리 구조와 가비지 컬렉션 |
| [JPA](java/jpa/) | ORM과 영속성 컨텍스트 |
| [웹 프로그래밍](java/web-programming/) | JSP, Servlet 기초 |

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
| [Spring Batch](spring/spring-batch-intro) | 배치 처리 기초 |

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

### Network

| 주제 | 설명 |
|:-----|:-----|
| [기초](network/01-network-basics) | 네트워크 개념 잡기 |
| [비트와 바이트](network/02-bit-and-byte) | 정보의 단위 |
| [LAN과 WAN](network/03-lan-and-wan) | 네트워크 범위 |
| [가정 LAN](network/04-home-lan-configuration) | 공유기와 NAT |
| [회사 LAN](network/05-office-lan-configuration) | DMZ와 VLAN |
| [프로토콜](network/06-network-protocol) | TCP, UDP, IP |
| [OSI 모델](network/07-osi-tcpip-model) | 7계층과 4계층 |
| [캡슐화](network/08-encapsulation-decapsulation) | 헤더와 PDU |
| [물리 계층](network/09-physical-layer-nic) | NIC와 MAC 주소 |
| [케이블](network/10-cable-types-structure) | UTP, 광케이블 |
| [HTTP](network/http/) | HTTP 프로토콜 |

### DevOps

| 주제 | 설명 |
|:-----|:-----|
| [K8s 입문](devops/kubernetes-intro) | 컨테이너와 쿠버네티스 |
| [K8s 개념](devops/kubernetes-concepts) | 컴포넌트와 네트워크 |
| [K8s 설치](devops/kubernetes-setup) | 환경 구성 |
| [K8s 사용](devops/kubernetes-usage) | YAML과 배포 전략 |
| [볼륨](devops/kubernetes-volumes) | PV/PVC |
| [서비스와 보안](devops/kubernetes-service-security) | Ingress, RBAC |
| [CI/CD](devops/kubernetes-cicd) | Jenkins, ArgoCD |
| [리소스 관리](devops/kubernetes-resources) | 모니터링과 스케일링 |

### Linux

| 주제 | 설명 |
|:-----|:-----|
| [첫걸음](linux/01-linux-first-step) | 리눅스 시작하기 |
| [셸](linux/02-shell) | 셸의 역할과 종류 |
| [셸 활용](linux/03-shell-advanced) | 단축키와 히스토리 |
| [파일 시스템](linux/04-files-and-directories) | 경로와 파일 조작 |

### Architecture

| 주제 | 설명 |
|:-----|:-----|
| [REST 기초](architecture/restful-api-basics) | REST의 기원과 원칙 |
| [리소스 설계](architecture/restful-resource-design) | 콘텐츠 협상, 버저닝 |
| [보안](architecture/restful-security) | 인증과 로깅 |
| [성능](architecture/restful-performance) | 캐싱과 비동기 처리 |
| [고급 설계](architecture/restful-advanced) | Rate Limiting, HATEOAS |
| [실시간 API](architecture/restful-realtime) | SSE, WebSocket |
