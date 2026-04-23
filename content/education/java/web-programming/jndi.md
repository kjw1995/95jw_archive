---
title: JNDI (Java Naming and Directory Interface)
weight: 5
---

JNDI는 Java 애플리케이션에서 네이밍 및 디렉터리 서비스에 접근하기 위한 표준 API입니다.

## JNDI 개요

### JNDI란?

JNDI(Java Naming and Directory Interface)는 Java 애플리케이션이 다양한 네이밍 및 디렉터리 서비스를 일관된 방식으로 접근할 수 있게 해주는 API입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Java Application                            │
├─────────────────────────────────────────────────────────────────┤
│                         JNDI API                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Context, InitialContext, DirContext, Attributes, ...  │   │
│   └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    JNDI SPI (Service Provider Interface)         │
├──────────┬──────────┬──────────┬──────────┬────────────────────┤
│   LDAP   │   DNS    │   RMI    │  CORBA   │   File System      │
│ Provider │ Provider │ Provider │ Provider │     Provider       │
└──────────┴──────────┴──────────┴──────────┴────────────────────┘
          │          │          │          │          │
          ▼          ▼          ▼          ▼          ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │  LDAP   │ │   DNS   │ │   RMI   │ │  CORBA  │ │  File   │
     │ Server  │ │ Server  │ │Registry │ │  ORB    │ │ System  │
     └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### 주요 특징

| 특징 | 설명 |
|------|------|
| **표준화된 API** | 다양한 네이밍 서비스를 동일한 방식으로 접근 |
| **플러그인 아키텍처** | SPI를 통해 다양한 서비스 프로바이더 지원 |
| **위치 투명성** | 리소스의 물리적 위치와 무관하게 접근 |
| **디커플링** | 애플리케이션과 리소스 설정의 분리 |

### 사용 사례

```
┌─────────────────────────────────────────────────────────────────┐
│                     JNDI 활용 영역                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   DataSource    │  │      EJB        │  │      JMS        │ │
│  │   데이터베이스    │  │   엔터프라이즈    │  │   메시징 서비스  │ │
│  │   연결 풀        │  │   자바 빈        │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     LDAP        │  │      DNS        │  │   환경 변수      │ │
│  │   디렉터리 서비스 │  │   도메인 조회    │  │   설정 값        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 개념

### 네이밍 서비스 (Naming Service)

이름과 객체를 연결(바인딩)하고, 이름으로 객체를 찾는(조회) 서비스입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Naming Service 개념                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   이름 (Name)              객체 (Object)                         │
│   ─────────────           ─────────────                         │
│   "jdbc/myDB"      ──▶    DataSource 객체                       │
│   "ejb/UserBean"   ──▶    EJB Home 객체                         │
│   "jms/Queue"      ──▶    JMS Queue 객체                        │
│                                                                  │
│   바인딩 (Binding): 이름과 객체를 연결                            │
│   조회 (Lookup): 이름으로 객체를 검색                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 디렉터리 서비스 (Directory Service)

네이밍 서비스를 확장하여 객체에 속성(Attributes)을 추가로 저장하고 검색할 수 있습니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                   Directory Service 개념                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LDAP Entry (DN: cn=John,ou=Users,dc=example,dc=com)           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  속성 (Attributes)                                      │   │
│   │  ─────────────────                                      │   │
│   │  cn: John                                               │   │
│   │  mail: john@example.com                                 │   │
│   │  telephoneNumber: 02-1234-5678                          │   │
│   │  department: Engineering                                │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 컨텍스트 (Context)

JNDI에서 컨텍스트는 바인딩들의 집합을 나타내며, 파일 시스템의 디렉터리와 유사합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context 계층 구조                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   InitialContext (루트)                                          │
│   │                                                              │
│   ├── java:comp/env (컴포넌트 환경)                              │
│   │   │                                                          │
│   │   ├── jdbc                                                   │
│   │   │   ├── myDB          → DataSource                        │
│   │   │   └── oracleDB      → DataSource                        │
│   │   │                                                          │
│   │   ├── jms                                                    │
│   │   │   ├── connectionFactory → ConnectionFactory             │
│   │   │   └── myQueue           → Queue                         │
│   │   │                                                          │
│   │   └── ejb                                                    │
│   │       └── UserService   → EJB Reference                     │
│   │                                                              │
│   └── java:global (글로벌 네임스페이스)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## JNDI 아키텍처

### API와 SPI

```
┌─────────────────────────────────────────────────────────────────┐
│                    JNDI Architecture                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Application                          │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              JNDI API (javax.naming.*)                  │   │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│   │  │ Context │ │  Name   │ │Binding  │ │ Reference   │   │   │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   Naming Manager                        │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │           JNDI SPI (javax.naming.spi.*)                 │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│           ┌─────────────────┼─────────────────┐                 │
│           ▼                 ▼                 ▼                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │LDAP Provider│   │ DNS Provider│   │ RMI Provider│          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 주요 패키지

| 패키지 | 설명 |
|--------|------|
| `javax.naming` | 네이밍 서비스 접근을 위한 클래스와 인터페이스 |
| `javax.naming.directory` | 디렉터리 서비스 접근을 위한 확장 |
| `javax.naming.event` | 이벤트 알림 지원 |
| `javax.naming.ldap` | LDAP v3 확장 기능 지원 |
| `javax.naming.spi` | 서비스 프로바이더 인터페이스 |

## 기본 사용법

### InitialContext 생성

```java
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import java.util.Hashtable;

public class JndiBasicExample {

    public static void main(String[] args) {
        try {
            // 1. 기본 InitialContext (애플리케이션 서버 환경)
            Context ctx = new InitialContext();

            // 2. 환경 속성을 사용한 InitialContext
            Hashtable<String, String> env = new Hashtable<>();
            env.put(Context.INITIAL_CONTEXT_FACTORY,
                "com.sun.jndi.ldap.LdapCtxFactory");
            env.put(Context.PROVIDER_URL,
                "ldap://localhost:389");

            Context ldapCtx = new InitialContext(env);

            // 3. 시스템 프로퍼티 사용
            // -Djava.naming.factory.initial=...
            // -Djava.naming.provider.url=...

        } catch (NamingException e) {
            e.printStackTrace();
        }
    }
}
```

### 환경 속성

| 속성 | 상수 | 설명 |
|------|------|------|
| `java.naming.factory.initial` | `Context.INITIAL_CONTEXT_FACTORY` | 초기 컨텍스트 팩토리 클래스 |
| `java.naming.provider.url` | `Context.PROVIDER_URL` | 서비스 프로바이더 URL |
| `java.naming.security.authentication` | `Context.SECURITY_AUTHENTICATION` | 인증 방식 |
| `java.naming.security.principal` | `Context.SECURITY_PRINCIPAL` | 사용자 이름 (DN) |
| `java.naming.security.credentials` | `Context.SECURITY_CREDENTIALS` | 비밀번호 |

## 주요 연산

### 바인딩과 조회

```java
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;

public class JndiOperationsExample {

    public void basicOperations() throws NamingException {
        Context ctx = new InitialContext();

        // 1. bind: 이름에 객체 바인딩 (이미 존재하면 예외)
        MyService service = new MyService();
        ctx.bind("myService", service);

        // 2. rebind: 이름에 객체 바인딩 (이미 존재하면 교체)
        ctx.rebind("myService", new MyService());

        // 3. lookup: 이름으로 객체 조회
        Object obj = ctx.lookup("myService");
        MyService lookedUp = (MyService) obj;

        // 4. unbind: 바인딩 제거
        ctx.unbind("myService");

        // 5. rename: 이름 변경
        ctx.rename("oldName", "newName");

        // 6. list: 컨텍스트의 바인딩 목록 조회
        javax.naming.NamingEnumeration<javax.naming.NameClassPair> list =
            ctx.list("");
        while (list.hasMore()) {
            javax.naming.NameClassPair pair = list.next();
            System.out.println(pair.getName() + " : " + pair.getClassName());
        }

        // 7. listBindings: 바인딩과 객체 함께 조회
        javax.naming.NamingEnumeration<javax.naming.Binding> bindings =
            ctx.listBindings("");
        while (bindings.hasMore()) {
            javax.naming.Binding binding = bindings.next();
            System.out.println(binding.getName() + " = " + binding.getObject());
        }

        // 리소스 해제
        ctx.close();
    }
}
```

### 서브컨텍스트 생성

```java
public class SubContextExample {

    public void createSubContext() throws NamingException {
        Context ctx = new InitialContext();

        // 서브컨텍스트 생성
        Context subCtx = ctx.createSubcontext("myApp");

        // 서브컨텍스트에 바인딩
        subCtx.bind("config", new Configuration());

        // 전체 경로로 조회
        Object obj = ctx.lookup("myApp/config");

        // 서브컨텍스트 삭제 (비어있어야 함)
        ctx.destroySubcontext("myApp");
    }
}
```

## DataSource JNDI 설정

### Tomcat에서 DataSource 설정

**context.xml (META-INF/ 또는 conf/)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Context>
    <Resource name="jdbc/myDB"
              auth="Container"
              type="javax.sql.DataSource"
              driverClassName="com.mysql.cj.jdbc.Driver"
              url="jdbc:mysql://localhost:3306/mydb"
              username="root"
              password="password"
              maxTotal="20"
              maxIdle="10"
              maxWaitMillis="10000"
              validationQuery="SELECT 1"
              testOnBorrow="true"/>
</Context>
```

**web.xml에서 리소스 참조**

```xml
<web-app>
    <resource-ref>
        <description>MySQL DataSource</description>
        <res-ref-name>jdbc/myDB</res-ref-name>
        <res-type>javax.sql.DataSource</res-type>
        <res-auth>Container</res-auth>
    </resource-ref>
</web-app>
```

**Java 코드에서 사용**

```java
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;
import java.sql.Connection;

public class DataSourceLookupExample {

    public Connection getConnection() throws Exception {
        // 1. InitialContext 생성
        Context initCtx = new InitialContext();

        // 2. 환경 네이밍 컨텍스트 조회
        Context envCtx = (Context) initCtx.lookup("java:comp/env");

        // 3. DataSource 조회
        DataSource ds = (DataSource) envCtx.lookup("jdbc/myDB");

        // 또는 한 번에 조회
        // DataSource ds = (DataSource) initCtx.lookup("java:comp/env/jdbc/myDB");

        // 4. Connection 획득
        return ds.getConnection();
    }

    public void useConnection() {
        try (Connection conn = getConnection()) {
            // 데이터베이스 작업 수행
            System.out.println("Connected: " + conn.getCatalog());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### Spring에서 JNDI DataSource 사용

**application.properties**

```properties
# JNDI DataSource 사용
spring.datasource.jndi-name=java:comp/env/jdbc/myDB
```

**Java Config 방식**

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jndi.JndiObjectFactoryBean;

import javax.naming.NamingException;
import javax.sql.DataSource;

@Configuration
public class JndiDataSourceConfig {

    @Bean
    public DataSource dataSource() throws NamingException {
        JndiObjectFactoryBean jndiFactory = new JndiObjectFactoryBean();
        jndiFactory.setJndiName("java:comp/env/jdbc/myDB");
        jndiFactory.setProxyInterface(DataSource.class);
        jndiFactory.setLookupOnStartup(true);
        jndiFactory.afterPropertiesSet();
        return (DataSource) jndiFactory.getObject();
    }
}
```

**XML Config 방식**

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:jee="http://www.springframework.org/schema/jee">

    <jee:jndi-lookup id="dataSource"
                     jndi-name="java:comp/env/jdbc/myDB"
                     expected-type="javax.sql.DataSource"/>

</beans>
```

### Spring Boot 내장 Tomcat에서 JNDI 설정

```java
import org.apache.catalina.Context;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.util.descriptor.web.ContextResource;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.embedded.tomcat.TomcatWebServer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TomcatJndiConfig {

    @Bean
    public TomcatServletWebServerFactory tomcatFactory() {
        return new TomcatServletWebServerFactory() {
            @Override
            protected TomcatWebServer getTomcatWebServer(Tomcat tomcat) {
                tomcat.enableNaming();  // JNDI 활성화
                return super.getTomcatWebServer(tomcat);
            }

            @Override
            protected void postProcessContext(Context context) {
                // DataSource 리소스 정의
                ContextResource resource = new ContextResource();
                resource.setName("jdbc/myDB");
                resource.setType(javax.sql.DataSource.class.getName());
                resource.setProperty("driverClassName", "com.mysql.cj.jdbc.Driver");
                resource.setProperty("url", "jdbc:mysql://localhost:3306/mydb");
                resource.setProperty("username", "root");
                resource.setProperty("password", "password");
                resource.setProperty("maxTotal", "20");
                resource.setProperty("maxIdle", "10");

                context.getNamingResources().addResource(resource);
            }
        };
    }
}
```

## LDAP 연동

### LDAP 연결 및 검색

```java
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.*;
import java.util.Hashtable;

public class LdapExample {

    private DirContext ctx;

    public void connect() throws NamingException {
        Hashtable<String, String> env = new Hashtable<>();

        // LDAP 서비스 프로바이더 설정
        env.put(Context.INITIAL_CONTEXT_FACTORY,
            "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL,
            "ldap://localhost:389");

        // 인증 설정
        env.put(Context.SECURITY_AUTHENTICATION, "simple");
        env.put(Context.SECURITY_PRINCIPAL, "cn=admin,dc=example,dc=com");
        env.put(Context.SECURITY_CREDENTIALS, "adminPassword");

        // 연결 타임아웃
        env.put("com.sun.jndi.ldap.connect.timeout", "5000");

        ctx = new InitialDirContext(env);
        System.out.println("LDAP Connected!");
    }

    public void searchUsers() throws NamingException {
        // 검색 컨트롤 설정
        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
        controls.setReturningAttributes(new String[]{"cn", "mail", "telephoneNumber"});

        // 검색 실행
        String searchBase = "ou=Users,dc=example,dc=com";
        String searchFilter = "(objectClass=person)";

        NamingEnumeration<SearchResult> results =
            ctx.search(searchBase, searchFilter, controls);

        while (results.hasMore()) {
            SearchResult result = results.next();
            Attributes attrs = result.getAttributes();

            System.out.println("DN: " + result.getNameInNamespace());
            System.out.println("  CN: " + attrs.get("cn").get());

            Attribute mail = attrs.get("mail");
            if (mail != null) {
                System.out.println("  Mail: " + mail.get());
            }
        }

        results.close();
    }

    public void addUser(String cn, String email) throws NamingException {
        // 속성 설정
        Attributes attrs = new BasicAttributes();
        attrs.put("objectClass", "inetOrgPerson");
        attrs.put("cn", cn);
        attrs.put("sn", cn);
        attrs.put("mail", email);

        // 엔트리 추가
        String dn = "cn=" + cn + ",ou=Users,dc=example,dc=com";
        ctx.createSubcontext(dn, attrs);
        System.out.println("User added: " + dn);
    }

    public void modifyUser(String cn, String newEmail) throws NamingException {
        String dn = "cn=" + cn + ",ou=Users,dc=example,dc=com";

        // 수정 항목 정의
        ModificationItem[] mods = new ModificationItem[1];
        mods[0] = new ModificationItem(
            DirContext.REPLACE_ATTRIBUTE,
            new BasicAttribute("mail", newEmail)
        );

        ctx.modifyAttributes(dn, mods);
        System.out.println("User modified: " + dn);
    }

    public void deleteUser(String cn) throws NamingException {
        String dn = "cn=" + cn + ",ou=Users,dc=example,dc=com";
        ctx.destroySubcontext(dn);
        System.out.println("User deleted: " + dn);
    }

    public void close() throws NamingException {
        if (ctx != null) {
            ctx.close();
        }
    }
}
```

### Spring LDAP 사용

```java
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.AttributesMapper;
import org.springframework.ldap.query.LdapQueryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ldap.core.support.LdapContextSource;

import java.util.List;

@Configuration
public class SpringLdapConfig {

    @Bean
    public LdapContextSource contextSource() {
        LdapContextSource contextSource = new LdapContextSource();
        contextSource.setUrl("ldap://localhost:389");
        contextSource.setBase("dc=example,dc=com");
        contextSource.setUserDn("cn=admin,dc=example,dc=com");
        contextSource.setPassword("adminPassword");
        return contextSource;
    }

    @Bean
    public LdapTemplate ldapTemplate() {
        return new LdapTemplate(contextSource());
    }
}

@Service
public class UserLdapService {

    @Autowired
    private LdapTemplate ldapTemplate;

    public List<String> getAllUserNames() {
        return ldapTemplate.search(
            LdapQueryBuilder.query()
                .where("objectClass").is("person"),
            (AttributesMapper<String>) attrs -> (String) attrs.get("cn").get()
        );
    }

    public List<User> findByEmail(String email) {
        return ldapTemplate.search(
            LdapQueryBuilder.query()
                .where("objectClass").is("person")
                .and("mail").is(email),
            new UserAttributesMapper()
        );
    }
}
```

## EJB와 JMS JNDI

### EJB Lookup

```java
import javax.naming.Context;
import javax.naming.InitialContext;

public class EjbLookupExample {

    public void lookupEjb() throws Exception {
        Context ctx = new InitialContext();

        // 로컬 EJB 조회 (java:comp/env 사용)
        UserServiceLocal userService =
            (UserServiceLocal) ctx.lookup("java:comp/env/ejb/UserService");

        // 글로벌 JNDI 이름으로 조회 (Java EE 6+)
        // java:global/[app-name]/[module-name]/[bean-name]
        UserServiceRemote remoteService =
            (UserServiceRemote) ctx.lookup(
                "java:global/myApp/myModule/UserServiceBean");

        // 모듈 범위 조회
        // java:module/[bean-name]
        UserServiceLocal moduleService =
            (UserServiceLocal) ctx.lookup("java:module/UserServiceBean");

        // 애플리케이션 범위 조회
        // java:app/[module-name]/[bean-name]
        UserServiceLocal appService =
            (UserServiceLocal) ctx.lookup("java:app/myModule/UserServiceBean");
    }
}
```

### JMS 리소스 Lookup

```java
import javax.jms.*;
import javax.naming.Context;
import javax.naming.InitialContext;

public class JmsLookupExample {

    public void sendMessage(String text) throws Exception {
        Context ctx = new InitialContext();

        // ConnectionFactory 조회
        ConnectionFactory cf =
            (ConnectionFactory) ctx.lookup("java:comp/env/jms/ConnectionFactory");

        // Queue 조회
        Queue queue =
            (Queue) ctx.lookup("java:comp/env/jms/MyQueue");

        // Topic 조회
        Topic topic =
            (Topic) ctx.lookup("java:comp/env/jms/MyTopic");

        // JMS 2.0 방식
        try (JMSContext jmsContext = cf.createContext()) {
            jmsContext.createProducer().send(queue, text);
            System.out.println("Message sent: " + text);
        }
    }

    public void receiveMessage() throws Exception {
        Context ctx = new InitialContext();

        ConnectionFactory cf =
            (ConnectionFactory) ctx.lookup("java:comp/env/jms/ConnectionFactory");
        Queue queue =
            (Queue) ctx.lookup("java:comp/env/jms/MyQueue");

        try (JMSContext jmsContext = cf.createContext()) {
            JMSConsumer consumer = jmsContext.createConsumer(queue);
            String message = consumer.receiveBody(String.class, 5000);
            System.out.println("Message received: " + message);
        }
    }
}
```

**web.xml에서 JMS 리소스 참조**

```xml
<web-app>
    <!-- JMS ConnectionFactory -->
    <resource-ref>
        <res-ref-name>jms/ConnectionFactory</res-ref-name>
        <res-type>javax.jms.ConnectionFactory</res-type>
        <res-auth>Container</res-auth>
    </resource-ref>

    <!-- JMS Queue -->
    <resource-env-ref>
        <resource-env-ref-name>jms/MyQueue</resource-env-ref-name>
        <resource-env-ref-type>javax.jms.Queue</resource-env-ref-type>
    </resource-env-ref>

    <!-- JMS Topic -->
    <resource-env-ref>
        <resource-env-ref-name>jms/MyTopic</resource-env-ref-name>
        <resource-env-ref-type>javax.jms.Topic</resource-env-ref-type>
    </resource-env-ref>
</web-app>
```

## Java EE 네임스페이스

### 표준 JNDI 네임스페이스

```
┌─────────────────────────────────────────────────────────────────┐
│                  Java EE JNDI Namespaces                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  java:comp/env     컴포넌트 환경 (각 컴포넌트별 private)          │
│  ├── jdbc/         JDBC DataSource                              │
│  ├── jms/          JMS 리소스                                   │
│  ├── mail/         JavaMail 세션                                │
│  ├── url/          URL 리소스                                   │
│  └── ejb/          EJB 참조                                     │
│                                                                  │
│  java:global/      글로벌 네임스페이스 (모든 애플리케이션 접근)    │
│  └── [app]/[module]/[bean]                                      │
│                                                                  │
│  java:app/         애플리케이션 범위 네임스페이스                  │
│  └── [module]/[bean]                                            │
│                                                                  │
│  java:module/      모듈 범위 네임스페이스                         │
│  └── [bean]                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 네임스페이스별 특징

| 네임스페이스 | 범위 | 접근 가능 대상 |
|-------------|------|---------------|
| `java:comp` | 컴포넌트 | 해당 컴포넌트만 |
| `java:module` | 모듈 | 같은 모듈 내 컴포넌트 |
| `java:app` | 애플리케이션 | 같은 애플리케이션 내 컴포넌트 |
| `java:global` | 글로벌 | 모든 애플리케이션 |

## @Resource 어노테이션

### 의존성 주입으로 JNDI 사용

```java
import javax.annotation.Resource;
import javax.sql.DataSource;
import javax.jms.ConnectionFactory;
import javax.jms.Queue;

@WebServlet("/example")
public class ResourceInjectionExample extends HttpServlet {

    // DataSource 주입
    @Resource(name = "jdbc/myDB")
    private DataSource dataSource;

    // JMS ConnectionFactory 주입
    @Resource(name = "jms/ConnectionFactory")
    private ConnectionFactory connectionFactory;

    // JMS Queue 주입
    @Resource(name = "jms/MyQueue")
    private Queue queue;

    // 환경 엔트리 주입
    @Resource(name = "maxRetries")
    private int maxRetries;

    // lookup 속성으로 JNDI 이름 지정
    @Resource(lookup = "java:comp/env/jdbc/myDB")
    private DataSource dsWithLookup;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        try (Connection conn = dataSource.getConnection()) {
            // 데이터베이스 작업
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
```

### EJB에서 @Resource 사용

```java
import javax.annotation.Resource;
import javax.ejb.Stateless;
import javax.ejb.SessionContext;
import javax.sql.DataSource;

@Stateless
public class MyServiceBean {

    // SessionContext 주입
    @Resource
    private SessionContext ctx;

    // DataSource 주입
    @Resource(name = "jdbc/myDB")
    private DataSource dataSource;

    // 환경 엔트리
    @Resource(name = "appConfig/timeout")
    private int timeout;

    public void doWork() {
        // EJB 컨텍스트 사용
        String caller = ctx.getCallerPrincipal().getName();

        // DataSource 사용
        try (Connection conn = dataSource.getConnection()) {
            // 작업 수행
        } catch (SQLException e) {
            ctx.setRollbackOnly();
        }
    }
}
```

## 사용자 정의 객체 바인딩

### Reference와 ObjectFactory

```java
import javax.naming.Reference;
import javax.naming.StringRefAddr;
import javax.naming.spi.ObjectFactory;
import javax.naming.Context;
import javax.naming.Name;
import java.util.Hashtable;

// 1. 바인딩할 객체
public class MyConfig {
    private String serverUrl;
    private int timeout;

    // getters, setters, constructors
    public MyConfig(String serverUrl, int timeout) {
        this.serverUrl = serverUrl;
        this.timeout = timeout;
    }

    public String getServerUrl() { return serverUrl; }
    public int getTimeout() { return timeout; }
}

// 2. ObjectFactory 구현
public class MyConfigFactory implements ObjectFactory {

    @Override
    public Object getObjectInstance(Object obj, Name name,
            Context nameCtx, Hashtable<?, ?> environment) throws Exception {

        if (obj instanceof Reference) {
            Reference ref = (Reference) obj;

            String serverUrl = (String) ref.get("serverUrl").getContent();
            int timeout = Integer.parseInt(
                (String) ref.get("timeout").getContent());

            return new MyConfig(serverUrl, timeout);
        }
        return null;
    }
}

// 3. 바인딩 예제
public class CustomObjectBindingExample {

    public void bindCustomObject() throws NamingException {
        Context ctx = new InitialContext();

        // Reference 생성
        Reference ref = new Reference(
            MyConfig.class.getName(),
            MyConfigFactory.class.getName(),
            null  // factory location (classpath면 null)
        );

        // Reference에 속성 추가
        ref.add(new StringRefAddr("serverUrl", "http://api.example.com"));
        ref.add(new StringRefAddr("timeout", "30000"));

        // 바인딩
        ctx.bind("myConfig", ref);
    }

    public void lookupCustomObject() throws NamingException {
        Context ctx = new InitialContext();

        // ObjectFactory가 자동으로 MyConfig 객체 생성
        MyConfig config = (MyConfig) ctx.lookup("myConfig");

        System.out.println("Server URL: " + config.getServerUrl());
        System.out.println("Timeout: " + config.getTimeout());
    }
}
```

## 보안 고려사항

### JNDI Injection 취약점

JNDI Injection은 신뢰할 수 없는 입력을 JNDI lookup에 사용할 때 발생하는 보안 취약점입니다.

```java
// 취약한 코드 예시 (사용 금지!)
public void vulnerableLookup(String userInput) throws NamingException {
    Context ctx = new InitialContext();
    // 사용자 입력을 직접 lookup에 사용 - 위험!
    Object obj = ctx.lookup(userInput);  // JNDI Injection 취약
}

// 안전한 코드
public void safeLookup(String resourceName) throws NamingException {
    // 화이트리스트 검증
    Set<String> allowedResources = Set.of("jdbc/myDB", "jms/queue");

    if (!allowedResources.contains(resourceName)) {
        throw new IllegalArgumentException("Invalid resource name");
    }

    Context ctx = new InitialContext();
    Object obj = ctx.lookup("java:comp/env/" + resourceName);
}
```

### 보안 모범 사례

```java
public class SecureJndiExample {

    // 1. 하드코딩된 JNDI 이름 사용
    private static final String DATASOURCE_NAME = "java:comp/env/jdbc/myDB";

    // 2. 프로퍼티 파일에서 읽되, 검증 수행
    public DataSource getDataSource() throws NamingException {
        Context ctx = new InitialContext();
        return (DataSource) ctx.lookup(DATASOURCE_NAME);
    }

    // 3. JVM 옵션으로 JNDI 제한 (Java 8u191+, 11.0.1+)
    // -Dcom.sun.jndi.ldap.object.trustURLCodebase=false
    // -Dcom.sun.jndi.rmi.object.trustURLCodebase=false

    // 4. Log4j 취약점 대응 (Log4j 2.17.0+)
    // log4j2.formatMsgNoLookups=true
}
```

## JNDI vs 직접 설정

### 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                    JNDI vs 직접 설정 비교                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  JNDI 방식                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  장점:                                                    │  │
│  │  - 설정과 코드 분리                                        │  │
│  │  - 동일 코드로 여러 환경 지원                               │  │
│  │  - 컨테이너 관리 커넥션 풀                                  │  │
│  │  - 중앙 집중식 설정 관리                                    │  │
│  │                                                           │  │
│  │  단점:                                                    │  │
│  │  - 서버 설정 필요                                          │  │
│  │  - 테스트 환경 구성 복잡                                    │  │
│  │  - 컨테이너 의존성                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  직접 설정 방식                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  장점:                                                    │  │
│  │  - 간단한 설정                                             │  │
│  │  - 컨테이너 독립적                                         │  │
│  │  - 테스트 용이                                             │  │
│  │                                                           │  │
│  │  단점:                                                    │  │
│  │  - 환경별 설정 파일 필요                                    │  │
│  │  - 민감 정보 코드/설정 파일에 포함                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 사용 시나리오

| 시나리오 | 권장 방식 |
|----------|-----------|
| 엔터프라이즈 애플리케이션 서버 배포 | JNDI |
| 마이크로서비스/클라우드 네이티브 | 직접 설정 (환경 변수) |
| 로컬 개발/테스트 | 직접 설정 |
| 여러 애플리케이션이 동일 리소스 공유 | JNDI |
| Spring Boot 단독 실행 | 직접 설정 또는 외부 설정 서버 |

## 참고 자료

- [Oracle JNDI Tutorial](https://docs.oracle.com/javase/tutorial/jndi/index.html)
- [Java SE JNDI Documentation](https://docs.oracle.com/javase/8/docs/technotes/guides/jndi/index.html)
- [Spring DataSource JNDI - DigitalOcean](https://www.digitalocean.com/community/tutorials/spring-datasource-jndi-with-tomcat-example)
- [JNDI Reference - WildFly](https://docs.jboss.org/author/display/WFLY/JNDI%20Reference.html)
- [Apache TomEE - EJB Lookup](https://tomee.apache.org/lookup-of-other-ejbs-example.html)
