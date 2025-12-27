---
title: Spring
sidebar:
  open: true
---

Spring Framework 및 Spring Boot 관련 개념 정리입니다.

## 스프링 핵심 원리

### 기본 개념
- [스프링 핵심 개념과 SOLID 원칙](spring-core-solid) - 스프링 탄생 배경, 객체 지향 설계 원칙
- [스프링 컨테이너와 빈](spring-container-bean) - ApplicationContext, BeanFactory, 빈 등록/조회

### 싱글톤과 컴포넌트 스캔
- [싱글톤 컨테이너](spring-singleton-container) - 싱글톤 패턴, @Configuration, CGLIB
- [컴포넌트 스캔](spring-component-scan) - @ComponentScan, 자동 빈 등록, 필터

### 의존관계 주입
- [의존관계 자동 주입](spring-dependency-injection) - 생성자 주입, @Autowired, @Qualifier, @Primary, 롬복

### 빈 생명주기
- [빈 생명주기 콜백](spring-bean-lifecycle) - @PostConstruct, @PreDestroy, 초기화/소멸
- [빈 스코프](spring-bean-scope) - 싱글톤, 프로토타입, request 스코프, Provider, 프록시

### 표현 언어
- [Spring Expression Language (SpEL)](spring-spel) - 표현식 문법, 연산자, 컬렉션 처리, Security 연동

---

## Spring Batch
- [배치와 스프링](spring-batch-intro) - 배치 처리 개념, Spring Batch 아키텍처
- [Spring Batch 핵심 개념](spring-batch-core) - Job, Step, 실행 메커니즘, 병렬화
