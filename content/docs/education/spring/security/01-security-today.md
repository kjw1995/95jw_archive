---
title: 오늘날의 보안
weight: 1
---

## Spring Security 개요

Spring Security는 스프링 애플리케이션에서 **인증(Authentication)**, **권한 부여(Authorization)**, **일반적인 공격 방어**를 구현하는 프레임워크다.

### 핵심 특징

- 서블릿 기반 웹 애플리케이션과 리액티브 애플리케이션 모두 지원
- 어노테이션, 빈, SpEL 기반의 선언적 보안 구성
- CSRF, XSS, 세션 고정 등 일반적인 공격에 대한 기본 방어 제공
- OAuth2, JWT, LDAP 등 다양한 인증 메커니즘 지원

### 의존성 설정

```xml
<!-- Maven -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

```groovy
// Gradle
implementation 'org.springframework.boot:spring-boot-starter-security'
```

### 기본 보안 설정 예제

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutSuccessUrl("/")
            );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## 소프트웨어 보안의 개념

### 보안의 계층 구조

보안은 **계층별로 적용**해야 하며 각 계층에 다른 접근 방식이 필요하다.

```
┌─────────────────────────────────────┐
│         애플리케이션 계층           │  ← Spring Security
├─────────────────────────────────────┤
│           전송 계층 (TLS)           │  ← HTTPS
├─────────────────────────────────────┤
│           네트워크 계층             │  ← 방화벽, VPN
├─────────────────────────────────────┤
│           물리적 계층               │  ← 데이터센터 보안
└─────────────────────────────────────┘
```

### 데이터 분류

| 구분 | 설명 | 보호 방법 |
|:-----|:-----|:----------|
| **저장 데이터 (Data at Rest)** | DB, 파일 시스템에 저장된 데이터 | 암호화, 접근 제어 |
| **전송 중 데이터 (Data in Transit)** | 네트워크를 통해 이동 중인 데이터 | TLS/SSL, 암호화 |
| **사용 중 데이터 (Data in Use)** | 메모리에서 처리 중인 데이터 | 메모리 보호, 최소 권한 |

### 인증과 권한 부여

```
┌──────────────────────────────────────────────────────────┐
│                         요청                              │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  인증 (Authentication): "당신은 누구인가?"               │
│  - 사용자 ID/패스워드 검증                               │
│  - 토큰 검증                                             │
│  - 인증서 검증                                           │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  권한 부여 (Authorization): "무엇을 할 수 있는가?"       │
│  - 역할 기반 접근 제어 (RBAC)                           │
│  - 권한 기반 접근 제어                                   │
│  - 리소스 소유권 확인                                    │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│                     리소스 접근                           │
└──────────────────────────────────────────────────────────┘
```

---

## 웹 애플리케이션의 보안 취약성

OWASP(Open Web Application Security Project)에서 정의한 주요 취약성을 살펴본다.

### 1. 인증 취약성

취약한 인증 구현은 공격자가 다른 사용자로 가장할 수 있게 한다.

**취약한 예제:**
```java
// 절대 이렇게 하지 말 것!
@PostMapping("/login")
public String login(@RequestParam String password) {
    if (password.equals("admin123")) {  // 하드코딩된 비밀번호
        return "success";
    }
    return "fail";
}
```

**안전한 예제:**
```java
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return org.springframework.security.core.userdetails.User.builder()
            .username(user.getUsername())
            .password(user.getPassword())  // BCrypt로 암호화된 비밀번호
            .roles(user.getRoles().toArray(new String[0]))
            .build();
    }
}
```

### 2. 세션 고정 (Session Fixation)

공격자가 미리 생성한 세션 ID를 피해자에게 사용하도록 유도하여 세션을 탈취하는 공격이다.

**공격 시나리오:**
```
1. 공격자가 서버에 접속하여 세션 ID 획득 (JSESSIONID=ABC123)
2. 피해자에게 해당 세션 ID가 포함된 링크 전송
3. 피해자가 로그인하면 공격자도 같은 세션으로 접근 가능
```

**Spring Security 방어 설정:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .sessionManagement(session -> session
            // 인증 시 새 세션 생성 (기본값)
            .sessionFixation().newSession()
            // 또는 세션 ID만 변경
            // .sessionFixation().changeSessionId()
            // 동시 세션 제한
            .maximumSessions(1)
            .maxSessionsPreventsLogin(true)
        );
    return http.build();
}
```

### 3. XSS (Cross-Site Scripting)

악의적인 스크립트를 웹 페이지에 주입하여 다른 사용자의 브라우저에서 실행되게 하는 공격이다.

**XSS 유형:**

| 유형 | 설명 | 예시 |
|:-----|:-----|:-----|
| Stored XSS | 서버에 저장되어 다른 사용자에게 전달 | 게시판 댓글에 스크립트 삽입 |
| Reflected XSS | 요청 파라미터가 응답에 반영 | URL 파라미터 조작 |
| DOM-based XSS | 클라이언트 측 JavaScript에서 발생 | innerHTML 조작 |

**취약한 예제:**
```java
// 절대 이렇게 하지 말 것!
@GetMapping("/search")
public String search(@RequestParam String query, Model model) {
    model.addAttribute("query", query);  // 이스케이프 없이 그대로 전달
    return "search";
}
```

```html
<!-- 취약한 템플릿 -->
<p>검색어: ${query}</p>  <!-- 스크립트가 실행될 수 있음 -->
```

**안전한 예제:**
```java
@GetMapping("/search")
public String search(@RequestParam String query, Model model) {
    String sanitized = HtmlUtils.htmlEscape(query);
    model.addAttribute("query", sanitized);
    return "search";
}
```

```html
<!-- Thymeleaf 자동 이스케이프 -->
<p>검색어: <span th:text="${query}"></span></p>

<!-- 안전하지 않은 방식 (필요시에만 사용) -->
<p th:utext="${trustedHtml}"></p>
```

**Content Security Policy 헤더 설정:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .headers(headers -> headers
            .contentSecurityPolicy(csp -> csp
                .policyDirectives("default-src 'self'; script-src 'self'")
            )
            .xssProtection(xss -> xss
                .headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK)
            )
        );
    return http.build();
}
```

### 4. CSRF (Cross-Site Request Forgery)

인증된 사용자가 자신의 의지와 무관하게 공격자가 의도한 행위를 수행하게 하는 공격이다.

**공격 시나리오:**
```html
<!-- 공격자의 악성 페이지 -->
<img src="https://bank.com/transfer?to=attacker&amount=1000000" />

<!-- 또는 자동 제출 폼 -->
<form action="https://bank.com/transfer" method="POST" id="attack">
    <input type="hidden" name="to" value="attacker" />
    <input type="hidden" name="amount" value="1000000" />
</form>
<script>document.getElementById('attack').submit();</script>
```

**Spring Security CSRF 방어:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        // CSRF 보호 기본 활성화 (POST, PUT, DELETE 등에 적용)
        .csrf(csrf -> csrf
            .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            // 특정 경로 제외 (API 등)
            .ignoringRequestMatchers("/api/public/**")
        );
    return http.build();
}
```

**Thymeleaf에서 CSRF 토큰 사용:**
```html
<form th:action="@{/transfer}" method="post">
    <!-- Thymeleaf가 자동으로 CSRF 토큰 추가 -->
    <input type="text" name="to" />
    <input type="number" name="amount" />
    <button type="submit">전송</button>
</form>

<!-- 수동으로 추가할 경우 -->
<form action="/transfer" method="post">
    <input type="hidden" th:name="${_csrf.parameterName}" th:value="${_csrf.token}" />
    ...
</form>
```

**JavaScript에서 CSRF 토큰 사용:**
```javascript
// 메타 태그에서 토큰 읽기
const token = document.querySelector('meta[name="_csrf"]').content;
const header = document.querySelector('meta[name="_csrf_header"]').content;

fetch('/api/transfer', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        [header]: token
    },
    body: JSON.stringify({ to: 'receiver', amount: 1000 })
});
```

### 5. SQL Injection

사용자 입력을 통해 악의적인 SQL 쿼리를 실행하는 공격이다.

**취약한 예제:**
```java
// 절대 이렇게 하지 말 것!
@Repository
public class UnsafeUserRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public User findByUsername(String username) {
        // SQL Injection 취약점!
        String sql = "SELECT * FROM users WHERE username = '" + username + "'";
        return jdbcTemplate.queryForObject(sql, new UserRowMapper());
    }
}
```

**공격 예시:**
```
입력값: ' OR '1'='1' --
실행되는 쿼리: SELECT * FROM users WHERE username = '' OR '1'='1' --'
결과: 모든 사용자 정보 노출
```

**안전한 예제 - PreparedStatement:**
```java
@Repository
public class SafeUserRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public User findByUsername(String username) {
        String sql = "SELECT * FROM users WHERE username = ?";
        return jdbcTemplate.queryForObject(sql, new UserRowMapper(), username);
    }
}
```

**안전한 예제 - JPA:**
```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // 메서드 이름 기반 쿼리 (안전)
    Optional<User> findByUsername(String username);

    // JPQL 파라미터 바인딩 (안전)
    @Query("SELECT u FROM User u WHERE u.email = :email")
    Optional<User> findByEmail(@Param("email") String email);

    // Native Query도 파라미터 바인딩 사용 (안전)
    @Query(value = "SELECT * FROM users WHERE status = ?1", nativeQuery = true)
    List<User> findByStatus(String status);
}
```

### 6. 민감한 데이터 노출

자격 증명, API 키 등의 민감 정보가 소스 코드나 로그에 노출되는 취약성이다.

**취약한 예제:**
```yaml
# 절대 이렇게 하지 말 것! - application.yml
spring:
  datasource:
    password: super_secret_password_123  # 소스 코드에 비밀번호 노출

api:
  secret-key: sk-1234567890abcdef  # API 키 노출
```

**환경 변수 사용:**
```yaml
# application.yml
spring:
  datasource:
    password: ${DB_PASSWORD}

api:
  secret-key: ${API_SECRET_KEY}
```

**Spring Cloud Config 또는 Vault 사용:**
```java
@Configuration
public class VaultConfig {

    @Value("${vault.database.password}")
    private String dbPassword;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setPassword(dbPassword);  // Vault에서 가져온 비밀번호
        return new HikariDataSource(config);
    }
}
```

**로그 마스킹:**
```java
@Slf4j
@Service
public class PaymentService {

    public void processPayment(String cardNumber, BigDecimal amount) {
        // 카드 번호 마스킹
        String masked = cardNumber.replaceAll("\\d(?=\\d{4})", "*");
        log.info("Processing payment: card={}, amount={}", masked, amount);
        // 출력: Processing payment: card=************1234, amount=100.00
    }
}
```

### 7. 메서드 접근 제어

웹 계층뿐만 아니라 서비스 계층에서도 보안을 적용해야 한다.

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig {
}

@Service
public class AdminService {

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(Long userId) {
        // 관리자만 호출 가능
    }

    @PreAuthorize("hasRole('USER') and #userId == authentication.principal.id")
    public UserProfile getProfile(Long userId) {
        // 본인만 조회 가능
    }

    @PostAuthorize("returnObject.owner == authentication.name")
    public Document getDocument(Long docId) {
        // 반환 후 소유자 확인
    }

    @PreFilter("filterObject.status != 'DELETED'")
    public void processItems(List<Item> items) {
        // 삭제된 항목 필터링
    }
}
```

### 8. 알려진 취약성이 있는 종속성

사용 중인 라이브러리에 보안 취약성이 있을 수 있다.

**취약성 검사 도구:**

```xml
<!-- Maven - OWASP Dependency Check -->
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>9.0.7</version>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

```groovy
// Gradle - OWASP Dependency Check
plugins {
    id 'org.owasp.dependencycheck' version '9.0.7'
}

dependencyCheck {
    failBuildOnCVSS = 7  // CVSS 7점 이상이면 빌드 실패
}
```

```bash
# 실행
mvn dependency-check:check
# 또는
./gradlew dependencyCheckAnalyze
```

---

## 아키텍처별 보안 설계

### 1. 일체형 웹 애플리케이션 (Monolithic)

서버에서 HTML을 렌더링하고 세션 기반 인증을 사용하는 전통적인 구조다.

```
┌─────────────┐     ┌─────────────────────────────────────┐
│   Browser   │────▶│         Spring Application          │
│             │◀────│  ┌─────────┐  ┌─────────────────┐  │
│  - Cookie   │     │  │ Security│  │    Service      │  │
│  - Session  │     │  │ Filter  │──│    Layer        │  │
└─────────────┘     │  └─────────┘  └─────────────────┘  │
                    │        │              │            │
                    │  ┌─────▼──────────────▼──────┐     │
                    │  │      Session Store        │     │
                    │  └───────────────────────────┘     │
                    └─────────────────────────────────────┘
```

**설정 예제:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/login", "/css/**", "/js/**").permitAll()
            .anyRequest().authenticated()
        )
        .formLogin(form -> form
            .loginPage("/login")
            .defaultSuccessUrl("/dashboard")
            .failureUrl("/login?error")
        )
        .logout(logout -> logout
            .logoutSuccessUrl("/")
            .invalidateHttpSession(true)
            .deleteCookies("JSESSIONID")
        )
        .sessionManagement(session -> session
            .sessionFixation().newSession()
            .maximumSessions(1)
        )
        // CSRF 기본 활성화
        .csrf(Customizer.withDefaults());

    return http.build();
}
```

### 2. 백엔드/프론트엔드 분리 구조

REST API 서버와 SPA(Single Page Application)가 분리된 구조다.

```
┌─────────────┐     ┌─────────────────────────────────────┐
│   SPA       │     │         Spring API Server           │
│ (React/Vue) │────▶│  ┌─────────┐  ┌─────────────────┐  │
│             │◀────│  │  JWT    │  │   REST API      │  │
│  - Token    │     │  │ Filter  │──│   Controller    │  │
└─────────────┘     │  └─────────┘  └─────────────────┘  │
                    └─────────────────────────────────────┘
```

**Stateless 설정 예제:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        // 세션 사용 안 함
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        )
        // CSRF 비활성화 (토큰 기반 인증 사용 시)
        .csrf(csrf -> csrf.disable())
        // CORS 설정
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        // JWT 필터 추가
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

    return http.build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://frontend.example.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setExposedHeaders(List.of("Authorization"));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

### 3. OAuth 2.0 / OpenID Connect

외부 인증 서버를 통한 인증 위임 구조다.

```
┌─────────────┐                    ┌─────────────────────┐
│   Client    │───── 1. 로그인 ───▶│  Authorization      │
│ Application │                    │  Server (Google,    │
│             │◀── 2. 토큰 발급 ───│  Keycloak, etc.)    │
└──────┬──────┘                    └─────────────────────┘
       │
       │ 3. 토큰과 함께 요청
       ▼
┌─────────────────────────────────────┐
│         Resource Server             │
│  (Spring Security Resource Server)  │
│                                     │
│  4. 토큰 검증 후 리소스 제공        │
└─────────────────────────────────────┘
```

**OAuth2 Client 설정:**
```yaml
# application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            scope: openid, profile, email
          github:
            client-id: ${GITHUB_CLIENT_ID}
            client-secret: ${GITHUB_CLIENT_SECRET}
            scope: user:email, read:user
```

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/login/**").permitAll()
            .anyRequest().authenticated()
        )
        .oauth2Login(oauth2 -> oauth2
            .loginPage("/login")
            .userInfoEndpoint(userInfo -> userInfo
                .userService(customOAuth2UserService)
            )
            .successHandler(oAuth2SuccessHandler)
        );

    return http.build();
}
```

**Resource Server 설정 (JWT 검증):**
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com
          # 또는 jwk-set-uri: https://auth.example.com/.well-known/jwks.json
```

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
        )
        .oauth2ResourceServer(oauth2 -> oauth2
            .jwt(jwt -> jwt
                .jwtAuthenticationConverter(jwtAuthenticationConverter())
            )
        );

    return http.build();
}

@Bean
public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter authoritiesConverter =
        new JwtGrantedAuthoritiesConverter();
    authoritiesConverter.setAuthorityPrefix("ROLE_");
    authoritiesConverter.setAuthoritiesClaimName("roles");

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
    return converter;
}
```

### 4. API 키와 암호화 서명

서비스 간 통신에서 사용하는 인증 방식이다.

**API 키 필터:**
```java
@Component
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    @Value("${api.key}")
    private String validApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String apiKey = request.getHeader("X-API-KEY");

        if (apiKey == null || !apiKey.equals(validApiKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Invalid API Key");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
```

**HMAC 서명 검증:**
```java
@Component
public class HmacSignatureFilter extends OncePerRequestFilter {

    @Value("${api.secret}")
    private String secretKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String signature = request.getHeader("X-Signature");
        String timestamp = request.getHeader("X-Timestamp");
        String body = readBody(request);

        String expectedSignature = calculateHmac(timestamp + body, secretKey);

        if (!MessageDigest.isEqual(
                signature.getBytes(),
                expectedSignature.getBytes())) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        // 타임스탬프 검증 (5분 이내)
        long requestTime = Long.parseLong(timestamp);
        if (System.currentTimeMillis() - requestTime > 300000) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String calculateHmac(String data, String key) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKeySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC calculation failed", e);
        }
    }
}
```

---

## 보안 체크리스트

| 항목 | 확인 사항 |
|:-----|:----------|
| 인증 | BCrypt 등 안전한 해시 알고리즘 사용 |
| 세션 | 로그인 시 새 세션 ID 발급, 타임아웃 설정 |
| CSRF | 상태 변경 요청에 CSRF 토큰 적용 |
| XSS | 출력 이스케이프, CSP 헤더 설정 |
| SQL Injection | 파라미터 바인딩, ORM 사용 |
| 민감 데이터 | 환경 변수, Vault 사용, 로그 마스킹 |
| HTTPS | 프로덕션에서 TLS 필수 적용 |
| 종속성 | 정기적인 취약성 스캔 |
| 헤더 | X-Content-Type-Options, X-Frame-Options 설정 |
