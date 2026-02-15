---
title: "안녕! 스프링 시큐리티"
weight: 2
---

# 안녕! 스프링 시큐리티

스프링 시큐리티의 기본 구성과 핵심 구성 요소(UserDetailsService, PasswordEncoder, AuthenticationProvider)의 재정의 방법을 다룬다.

---

## 1. 기본 구성이란?

스프링 부트에 스프링 시큐리티 의존성을 추가하면 **설정보다 관습(convention-over-configuration)** 원칙에 따라 기본 보안 구성이 자동으로 적용된다.

### 1.1 인증 흐름

```
클라이언트 요청
    │
    ▼
┌─────────────────┐
│ 인증 필터        │ 1. 요청을 가로챈다
│ (Auth Filter)   │
└────────┬────────┘
         │ 2. 인증 위임
         ▼
┌─────────────────┐
│ 인증 관리자      │
│ (AuthManager)   │
└────────┬────────┘
         │ 3. 인증 공급자 호출
         ▼
┌─────────────────┐
│ 인증 공급자      │ 4. 인증 논리 실행
│ (AuthProvider)  │
└───┬─────────┬───┘
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│UserDet.│ │Password  │
│Service │ │Encoder   │
└────────┘ └──────────┘
 사용자 조회   암호 검증
    │         │
    └────┬────┘
         │ 5. 인증 결과 반환
         ▼
┌─────────────────┐
│ 보안 컨텍스트    │ 6. 인증 정보 저장
│ (SecurityContext)│
└─────────────────┘
```

각 구성 요소의 역할을 정리하면 다음과 같다.

| 구성 요소 | 역할 |
|:---------|:-----|
| **인증 필터** | 요청을 가로채 인증 관리자에 위임, 응답으로 보안 컨텍스트 구성 |
| **인증 관리자** | 인증 공급자를 이용해 인증 처리 |
| **인증 공급자** | 인증 논리 구현 (UserDetailsService + PasswordEncoder 활용) |
| **UserDetailsService** | 사용자 세부 정보를 조회하는 책임 |
| **PasswordEncoder** | 암호 인코딩 및 일치 여부 검증 |
| **보안 컨텍스트** | 인증 완료 후 인증 데이터를 보관 |

### 1.2 자동 구성되는 기본 빈

스프링 부트가 자동으로 생성하는 두 가지 핵심 빈이 있다.

| 빈 | 기본 구현 | 설명 |
|:---|:---------|:-----|
| `UserDetailsService` | `InMemoryUserDetailsManager` | 사용자 이름 `user`, 암호 UUID 자동 생성 |
| `PasswordEncoder` | 없음 (내부에서 처리) | 기본 구성에서 자동으로 동작 |

```
기본 자격 증명:
- 사용자 이름: user
- 암호: 콘솔에 출력되는 UUID
  (예: Using generated security password: a1b2c3d4-...)
```

{{< callout type="info" >}}
**기본 구성은 개념 증명(PoC) 용도이다.** 자격 증명이 메모리에만 보관되므로 애플리케이션 재시작 시 암호가 변경된다. 운영 환경에서는 반드시 재정의해야 한다.
{{< /callout >}}

### 1.3 HTTP Basic 인증

스프링 부트의 기본 인증 방식이다. 클라이언트가 `Authorization` 헤더에 자격 증명을 담아 전송한다.

```
요청 구조:
Authorization: Basic dXNlcjoxMjM0NQ==
                     └─ Base64("user:12345")

인코딩 과정:
"user:12345" → Base64 인코딩 → "dXNlcjoxMjM0NQ=="
```

```bash
# cURL로 Basic 인증 요청
curl -u user:12345 http://localhost:8080/hello

# 또는 직접 헤더 지정
curl -H "Authorization: Basic dXNlcjoxMjM0NQ==" http://localhost:8080/hello
```

{{< callout type="warning" >}}
**Base64는 암호화가 아니다.** 누구나 디코딩할 수 있으므로 반드시 **HTTPS**와 함께 사용해야 한다. HTTP Basic 인증 단독으로는 자격 증명의 기밀성을 보장하지 못한다.
{{< /callout >}}

---

## 2. 기본 구성 재정의

### 2.1 UserDetailsService 재정의

기본 `UserDetailsService`를 대체하여 원하는 사용자를 등록할 수 있다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public UserDetailsService userDetailsService() {
        var userDetailsService = new InMemoryUserDetailsManager();

        var user = User.withUsername("john")
                       .password("12345")
                       .authorities("read")
                       .build();

        userDetailsService.createUser(user);
        return userDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance();
    }
}
```

{{< callout type="warning" >}}
**UserDetailsService를 재정의하면 PasswordEncoder도 반드시 함께 선언해야 한다.** 기본 `UserDetailsService`를 사용할 때는 `PasswordEncoder`가 자동 구성되지만, 재정의하면 자동 구성이 해제된다.
{{< /callout >}}

### 2.2 여러 사용자 등록

```java
@Bean
public UserDetailsService userDetailsService() {
    var manager = new InMemoryUserDetailsManager();

    var admin = User.withUsername("admin")
                    .password("admin123")
                    .authorities("read", "write", "delete")
                    .build();

    var user = User.withUsername("user")
                   .password("user123")
                   .authorities("read")
                   .build();

    manager.createUser(admin);
    manager.createUser(user);
    return manager;
}
```

{{< callout type="info" >}}
**InMemoryUserDetailsManager는 운영 환경에 적합하지 않다.** 예제, 개념 증명, 테스트 용도로만 사용하고, 운영 환경에서는 DB 기반의 `UserDetailsService`를 구현해야 한다.
{{< /callout >}}

### 2.3 엔드포인트 권한 부여 구성

모든 엔드포인트를 보호할 필요가 없거나 인증 방식을 변경하고 싶을 때 `SecurityFilterChain`을 정의한다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        http
            .httpBasic(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .anyRequest().authenticated()
            );
        return http.build();
    }
}
```

#### 권한 부여 설정 예시

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http)
        throws Exception {
    http
        .httpBasic(Customizer.withDefaults())
        .authorizeHttpRequests(auth -> auth
            // 특정 경로는 인증 없이 허용
            .requestMatchers("/public/**").permitAll()
            // 관리자 경로는 ADMIN 권한 필요
            .requestMatchers("/admin/**").hasAuthority("admin")
            // 나머지는 인증 필요
            .anyRequest().authenticated()
        );
    return http.build();
}
```

| 메서드 | 설명 |
|:-------|:-----|
| `permitAll()` | 인증 없이 누구나 접근 가능 |
| `authenticated()` | 인증된 사용자만 접근 가능 |
| `hasAuthority("권한")` | 특정 권한을 가진 사용자만 접근 |
| `hasRole("역할")` | 특정 역할을 가진 사용자만 접근 |
| `denyAll()` | 모든 접근 차단 |

### 2.4 AuthenticationProvider 재정의

인증 논리를 완전히 직접 구현하고 싶을 때 `AuthenticationProvider`를 구현한다.

```
기본 흐름:
AuthProvider → UserDetailsService + PasswordEncoder

커스텀 흐름:
AuthProvider → 직접 구현한 인증 논리
               (외부 API, LDAP, 커스텀 DB 등)
```

```java
@Component
public class CustomAuthenticationProvider
        implements AuthenticationProvider {

    @Override
    public Authentication authenticate(Authentication auth)
            throws AuthenticationException {

        String username = auth.getName();
        String password = auth.getCredentials().toString();

        // 커스텀 인증 논리 구현
        if ("john".equals(username) && "12345".equals(password)) {
            return new UsernamePasswordAuthenticationToken(
                    username, password,
                    List.of(new SimpleGrantedAuthority("read"))
            );
        }

        throw new BadCredentialsException("인증 실패");
    }

    @Override
    public boolean supports(Class<?> authenticationType) {
        return UsernamePasswordAuthenticationToken.class
                .isAssignableFrom(authenticationType);
    }
}
```

#### AuthenticationProvider 등록

```java
@Configuration
public class SecurityConfig {

    @Autowired
    private CustomAuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        http
            .httpBasic(Customizer.withDefaults())
            .authenticationProvider(authenticationProvider)
            .authorizeHttpRequests(auth -> auth
                .anyRequest().authenticated()
            );
        return http.build();
    }
}
```

| 메서드 | 설명 |
|:-------|:-----|
| `authenticate()` | 인증 논리를 구현. 성공 시 `Authentication` 반환, 실패 시 예외 |
| `supports()` | 이 공급자가 처리할 수 있는 `Authentication` 타입을 지정 |

---

## 3. PasswordEncoder

암호 인코딩과 검증을 담당하는 컴포넌트이다.

### 3.1 PasswordEncoder의 역할

```
회원가입 시:
  평문 암호 → encode() → 인코딩된 암호 → DB 저장

로그인 시:
  입력 암호 + DB 암호 → matches() → true/false
```

### 3.2 주요 구현체

| 구현체 | 특징 | 운영 적합 |
|:-------|:-----|:---------|
| `NoOpPasswordEncoder` | 인코딩 안 함 (평문) | X (테스트용) |
| `BCryptPasswordEncoder` | BCrypt 해시, 솔트 자동 생성 | **O (권장)** |
| `SCryptPasswordEncoder` | SCrypt 해시, 메모리 집약적 | O |
| `Pbkdf2PasswordEncoder` | PBKDF2 해시 | O |
| `DelegatingPasswordEncoder` | 여러 인코더를 위임 방식으로 관리 | O |

```java
// 운영 환경 권장 설정
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

```java
// BCrypt 사용 예시
PasswordEncoder encoder = new BCryptPasswordEncoder();

// 암호 인코딩 (같은 평문이라도 매번 다른 해시 생성)
String encoded = encoder.encode("myPassword");
// $2a$10$N9qo8uLOickgx2ZMRZoMye...

// 암호 검증
boolean matches = encoder.matches("myPassword", encoded);
// true
```

{{< callout type="warning" >}}
**`NoOpPasswordEncoder`는 절대 운영 환경에서 사용하지 마라.** 암호를 평문으로 저장하므로 DB가 유출되면 모든 사용자의 암호가 노출된다. 학습과 개념 증명에만 사용해야 한다.
{{< /callout >}}

---

## 4. HTTPS 구성

HTTP Basic 인증은 자격 증명이 Base64로만 인코딩되므로 **HTTPS**를 함께 사용해야 한다.

### 4.1 자체 서명 인증서 생성

```bash
# 1. 개인 키 + 공개 인증서 생성
openssl req -newkey rsa:2048 -x509 \
  -keyout key.pem -out cert.pem -days 365

# 2. PKCS12 형식으로 변환
openssl pkcs12 -export \
  -in cert.pem -inkey key.pem \
  -out certificate.p12 -name "certificate"
```

### 4.2 스프링 부트에 HTTPS 적용

`certificate.p12`를 `resources` 폴더에 넣고 설정을 추가한다.

```properties
# application.properties
server.ssl.key-store-type=PKCS12
server.ssl.key-store=classpath:certificate.p12
server.ssl.key-store-password=12345
```

```bash
# 자체 서명 인증서는 -k 옵션으로 신뢰성 검사 생략
curl -k -u user:12345 https://localhost:8080/hello
```

{{< callout type="info" >}}
**HTTPS만으로 완벽한 보안이 보장되지는 않는다.** HTTPS는 전송 중 데이터를 보호하는 한 가지 계층일 뿐이다. 인증, 권한 부여, 입력 검증 등 다른 보안 계층도 함께 적용해야 한다.
{{< /callout >}}

---

## 5. 요약

### 구성 요소 관계 전체도

```
┌──────────────────────────────────────┐
│          SecurityFilterChain         │
│  ┌────────────────────────────────┐  │
│  │      인증 필터 (Auth Filter)    │  │
│  └───────────┬────────────────────┘  │
│              │                       │
│  ┌───────────▼────────────────────┐  │
│  │  인증 관리자 (AuthManager)      │  │
│  └───────────┬────────────────────┘  │
│              │                       │
│  ┌───────────▼────────────────────┐  │
│  │  인증 공급자 (AuthProvider)     │  │
│  │  ┌──────────┐  ┌────────────┐ │  │
│  │  │UserDetail│  │ Password   │ │  │
│  │  │Service   │  │ Encoder    │ │  │
│  │  └──────────┘  └────────────┘ │  │
│  └───────────┬────────────────────┘  │
│              │                       │
│  ┌───────────▼────────────────────┐  │
│  │  보안 컨텍스트 (SecurityContext) │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| **설정보다 관습** | 스프링 부트가 기본 보안 구성을 자동 제공 |
| **UserDetailsService** | 사용자 조회 책임. 기본은 `InMemoryUserDetailsManager` |
| **PasswordEncoder** | 암호 인코딩/검증. 운영 환경에서는 `BCryptPasswordEncoder` 사용 |
| **AuthenticationProvider** | 인증 논리 구현. `UserDetailsService`와 `PasswordEncoder`에 위임 |
| **SecurityFilterChain** | 엔드포인트 권한 부여 및 인증 방식 구성 |
| **HTTP Basic** | Authorization 헤더에 Base64 인코딩된 자격 증명 전송 |
| **HTTPS** | TLS/SSL을 통한 전송 암호화. Basic 인증 시 필수 |

### 재정의 방법 선택

```
단순한 사용자 관리만 필요
  └→ UserDetailsService + PasswordEncoder 빈 등록

엔드포인트별 권한 설정 필요
  └→ SecurityFilterChain 빈 정의

인증 논리를 완전히 커스텀
  └→ AuthenticationProvider 구현
```
