---
title: "19. 마이바티스 프레임워크"
weight: 19
---

마이바티스(MyBatis) 프레임워크의 개념과 설정, 동적 SQL 작성법을 다룬다.

---

## 1. 마이바티스란?

기존 JDBC 방식은 SQL이 자바 코드에 섞여 가독성이 떨어지고, 반복 코드가 많다. 마이바티스는 **SQL을 XML로 분리**하여 이 문제를 해결한다.

```
  기존 JDBC 흐름

  Connection 획득
       │
       ▼
  Statement 생성
       │
       ▼
  SQL문 전송
       │
       ▼
  결과 반환
       │
       ▼
  close
```

### 마이바티스의 특징

| 특징 | 설명 |
|:-----|:-----|
| SQL 분리 | SQL을 XML 파일에 작성하여 코드와 분리 |
| 자동 매핑 | 실행 결과를 자바 빈즈 또는 `Map`으로 매핑 |
| DataSource 지원 | 데이터소스와 트랜잭션 처리 기능 내장 |
| 동적 SQL | `<if>`, `<choose>`, `<foreach>` 등으로 조건부 SQL 구성 |

### 기존 JDBC vs 마이바티스

| 구분 | 기존 JDBC | 마이바티스 |
|:-----|:-----|:-----|
| SQL 위치 | 자바 코드 안에 혼재 | XML 파일에 분리 |
| 결과 매핑 | `ResultSet` 수동 순회 | 자동 매핑 (빈즈/Map) |
| 파라미터 바인딩 | `?`와 인덱스 기반 | `#{property}` 이름 기반 |
| 코드량 | Connection~close 반복 | SQL과 매핑 설정만 작성 |

---

## 2. 마이바티스 설정 파일

### 설정 파일 구성

| 파일 | 역할 |
|:-----|:-----|
| `config.xml` | DB 연결 정보, 트랜잭션, 데이터소스 등 마이바티스 전역 설정 |
| `member.xml` | SQL문을 정의하는 매퍼(mapper) 파일 |

두 파일 모두 **src 패키지 아래**에 위치해야 한다.

### config.xml 예시

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE configuration
  PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
  "http://mybatis.org/dtd/
   mybatis-3-config.dtd">
<configuration>
    <!-- VO 클래스 별칭 설정 -->
    <typeAliases>
        <typeAlias type="com.spring.vo.MemberVO"
            alias="memberVO" />
    </typeAliases>

    <!-- DB 연결 설정 -->
    <environments default="development">
        <environment id="development">
            <transactionManager
                type="JDBC" />
            <dataSource type="POOLED">
                <property name="driver"
                    value="oracle.jdbc.driver
                           .OracleDriver" />
                <property name="url"
                    value="jdbc:oracle:thin:
                           @localhost:1521:XE" />
                <property name="username"
                    value="scott" />
                <property name="password"
                    value="tiger" />
            </dataSource>
        </environment>
    </environments>

    <!-- 매퍼 파일 등록 -->
    <mappers>
        <mapper resource="member.xml" />
    </mappers>
</configuration>
```

### member.xml (매퍼 파일) 예시

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper
  PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/
   mybatis-3-mapper.dtd">
<mapper namespace="mapper.member">

    <!-- 전체 회원 조회 -->
    <select id="selectAllMembers"
        resultType="memberVO">
        <![CDATA[
            SELECT * FROM t_member
            ORDER BY joinDate DESC
        ]]>
    </select>

    <!-- 회원 추가 -->
    <insert id="insertMember"
        parameterType="memberVO">
        INSERT INTO t_member
            (id, pwd, name, email)
        VALUES
            (#{id}, #{pwd},
             #{name}, #{email})
    </insert>

    <!-- 회원 삭제 -->
    <delete id="deleteMember"
        parameterType="String">
        DELETE FROM t_member
        WHERE id = #{id}
    </delete>

</mapper>
```

{{< callout type="warning" >}}
SQL문에 `>`, `<`, `<=`, `>=` 같은 연산자를 사용할 때는 XML 특수 문자로 인식되므로 반드시 **`<![CDATA[...]]>`** 태그 안에 작성해야 한다.
{{< /callout >}}

---

## 3. SqlSession 클래스의 주요 메서드

`SqlSession`은 마이바티스에서 SQL을 실행하는 핵심 객체다.

| 메서드 | 기능 |
|:-----|:-----|
| `selectList(id)` | select 실행 후 여러 레코드를 `List`로 반환 |
| `selectList(id, 조건)` | 조건을 전달하며 select 실행 |
| `selectOne(id)` | select 실행 후 단건 결과 반환 |
| `selectOne(id, 조건)` | 조건을 전달하며 단건 조회 |
| `selectMap(id, 조건)` | select 실행 후 `Map`으로 반환 |
| `insert(id, obj)` | obj 값으로 insert 실행 |
| `update(id, obj)` | obj 값으로 update 실행 |
| `delete(id, obj)` | obj 값으로 delete 실행 |

### DAO에서 SqlSession 사용

```java
public class MemberDAO {

    private static SqlSessionFactory factory;

    // SqlSessionFactory 초기화
    static {
        String resource = "config.xml";
        try {
            Reader reader = Resources
                .getResourceAsReader(resource);
            factory = new SqlSessionFactoryBuilder()
                .build(reader);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 전체 회원 조회
    public List<MemberVO> selectAllMembers() {
        SqlSession session =
            factory.openSession();
        List<MemberVO> list =
            session.selectList(
                "mapper.member"
                + ".selectAllMembers");
        session.close();
        return list;
    }

    // 회원 추가
    public int insertMember(MemberVO vo) {
        SqlSession session =
            factory.openSession();
        int result = session.insert(
            "mapper.member.insertMember", vo);
        session.commit();
        session.close();
        return result;
    }
}
```

```
  SqlSession 동작 흐름

  SqlSessionFactory
       │
       ▼
  openSession()
       │
       ▼
  ┌──────────────────┐
  │   SqlSession     │
  │                  │
  │ selectList(id)   │
  │ insert(id, obj)  │
  │ update(id, obj)  │
  │ delete(id, obj)  │
  └───────┬──────────┘
          │
          ▼
  매퍼 XML에서 SQL 조회
          │
          ▼
  DBMS로 SQL 실행
          │
          ▼
  결과 → VO/List/Map
```

{{< callout type="info" >}}
`insert`, `update`, `delete` 실행 후에는 반드시 **`session.commit()`**을 호출해야 DB에 반영된다. `selectList`/`selectOne`은 조회만 수행하므로 commit이 필요 없다.
{{< /callout >}}

---

## 4. 동적 SQL문

마이바티스는 조건에 따라 SQL을 동적으로 구성하는 태그를 제공한다. JSTL과 XML 기반으로 작성한다.

| 태그 | 역할 | 비유 |
|:-----|:-----|:-----|
| `<if>` | 조건이 참이면 SQL 추가 | Java `if` |
| `<choose>` | 여러 조건 중 하나 선택 | Java `switch` |
| `<foreach>` | 컬렉션을 순회하며 SQL 생성 | Java `for` |
| `<where>` | 조건이 있으면 WHERE절 추가 | — |
| `<sql>` / `<include>` | SQL 조각 재사용 | 메서드 추출 |

---

## 5. `<if>` 태그

`<where>` 태그 안에서 사용하며, 조건이 참일 때 SQL 구문을 추가한다.

```xml
<select id="searchMember"
    parameterType="memberVO"
    resultType="memberVO">
    SELECT * FROM t_member
    <where>
        <if test="name != null
                  and name != ''">
            name = #{name}
        </if>
        <if test="email != null
                  and email != ''">
            AND email = #{email}
        </if>
    </where>
</select>
```

`<where>` 태그는 내부 조건이 하나라도 참이면 `WHERE`를 추가하고, 첫 번째 조건의 불필요한 `AND`/`OR`를 자동 제거한다.

### 동작 예시

| name | email | 생성되는 SQL |
|:-----|:-----|:-----|
| "홍길동" | null | `WHERE name = '홍길동'` |
| null | "a@b.com" | `WHERE email = 'a@b.com'` |
| "홍길동" | "a@b.com" | `WHERE name = '홍길동' AND email = 'a@b.com'` |
| null | null | (WHERE절 없음 — 전체 조회) |

---

## 6. `<choose>` 태그

자바의 `switch`문처럼 여러 조건 중 하나만 적용한다.

```xml
<select id="searchByCondition"
    parameterType="map"
    resultType="memberVO">
    SELECT * FROM t_member
    <where>
        <choose>
            <when test="searchType == 'name'">
                name LIKE '%'
                    || #{keyword} || '%'
            </when>
            <when test="searchType == 'email'">
                email LIKE '%'
                    || #{keyword} || '%'
            </when>
            <otherwise>
                id = #{keyword}
            </otherwise>
        </choose>
    </where>
</select>
```

{{< callout type="info" >}}
`<otherwise>`는 생략할 수 있다. 모든 `<when>` 조건이 거짓이면 아무 조건도 추가되지 않는다.
{{< /callout >}}

---

## 7. `<foreach>` 태그

컬렉션을 순회하며 SQL을 반복 생성한다. IN절이나 다중 INSERT에 활용된다.

### 속성

| 속성 | 설명 |
|:-----|:-----|
| `collection` | 전달받은 인자 (`list` 또는 `array`) |
| `item` | 반복 시 현재 요소를 참조하는 변수명 |
| `index` | 현재 반복 인덱스 (0부터 시작) |
| `open` | 구문 시작 시 추가할 기호 |
| `close` | 구문 종료 시 추가할 기호 |
| `separator` | 반복 사이에 추가할 구분자 |

### IN절 예시

```xml
<select id="selectByIds"
    parameterType="map"
    resultType="memberVO">
    SELECT * FROM t_member
    WHERE id IN
    <foreach item="item"
        collection="idList"
        open="(" close=")"
        separator=",">
        #{item}
    </foreach>
</select>
```

**생성되는 SQL:**
```sql
SELECT * FROM t_member
WHERE id IN ('kim', 'lee', 'park')
```

### 다중 INSERT (오라클)

오라클에서는 여러 INSERT를 동시에 실행하면 오류가 발생한다. `INSERT ALL ... SELECT * FROM DUAL` 형식을 사용해야 한다.

```xml
<insert id="insertMembers"
    parameterType="map">
    <foreach item="item"
        collection="list"
        open="INSERT ALL"
        separator=" "
        close="SELECT * FROM DUAL">
        INTO t_member
            (id, pwd, name, email)
        VALUES
            (#{item.id}, #{item.pwd},
             #{item.name}, #{item.email})
    </foreach>
</insert>
```

{{< callout type="warning" >}}
MySQL은 `VALUES (), (), ()` 형식으로 다중 INSERT가 가능하지만, 오라클은 `INSERT ALL ... SELECT * FROM DUAL` 패턴을 사용해야 한다. DB 벤더에 따라 구문이 다르므로 주의하자.
{{< /callout >}}

---

## 8. `<sql>` 태그와 `<include>` 태그

반복되는 SQL 조각을 `<sql>`로 정의하고, `<include>`로 재사용한다.

```xml
<!-- SQL 조각 정의 -->
<sql id="memberColumns">
    id, pwd, name, email, joinDate
</sql>

<!-- 재사용 -->
<select id="selectAllMembers"
    resultType="memberVO">
    SELECT
        <include refid="memberColumns" />
    FROM t_member
</select>

<select id="selectMember"
    parameterType="String"
    resultType="memberVO">
    SELECT
        <include refid="memberColumns" />
    FROM t_member
    WHERE id = #{id}
</select>
```

여러 매퍼 파일에서 공통 SQL 조각을 사용하려면 네임스페이스를 포함하여 참조한다.

```xml
<include
    refid="mapper.common.memberColumns" />
```

{{< callout type="info" >}}
오라클에서 마이바티스로 LIKE 검색할 때는 `%` 기호와 조건 값 사이에 **`||` (연결 연산자)**를 사용해야 한다.
```sql
name LIKE '%' || #{name} || '%'
```
{{< /callout >}}

---

## 9. 스프링과 마이바티스 연동

실무에서는 마이바티스를 단독으로 사용하기보다 **스프링과 연동**하여 사용한다.

### 연동 구조

```
  스프링 + 마이바티스 구조

  Controller
       │
       ▼
  Service
       │
       ▼
  ┌──────────────────┐
  │  DAO             │
  │  (SqlSession 주입)│
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │  매퍼 XML        │
  │  (SQL 정의)      │
  └───────┬──────────┘
          │
          ▼
      DataSource → DB
```

### 스프링 설정

```xml
<!-- SqlSessionFactory 빈 등록 -->
<bean id="sqlSessionFactory"
  class="org.mybatis.spring
         .SqlSessionFactoryBean">
    <property name="dataSource"
        ref="dataSource" />
    <property name="configLocation"
        value="classpath:config.xml" />
</bean>

<!-- SqlSessionTemplate 빈 등록 -->
<bean id="sqlSession"
  class="org.mybatis.spring
         .SqlSessionTemplate">
    <constructor-arg
        ref="sqlSessionFactory" />
</bean>
```

### DAO에서 사용

```java
@Repository("memberDAO")
public class MemberDAOImpl
        implements MemberDAO {

    @Autowired
    private SqlSession sqlSession;

    @Override
    public List<MemberVO> selectAllMembers() {
        return sqlSession.selectList(
            "mapper.member.selectAllMembers");
    }

    @Override
    public int insertMember(MemberVO vo) {
        return sqlSession.insert(
            "mapper.member.insertMember", vo);
    }
}
```

{{< callout type="info" >}}
스프링과 연동하면 `SqlSessionTemplate`이 **트랜잭션 관리**와 **세션 자동 close**를 처리해 준다. 직접 `commit()`이나 `close()`를 호출할 필요가 없다.
{{< /callout >}}

---

## 요약

| 개념 | 한 줄 정리 |
|:-----|:-----|
| 마이바티스 | SQL을 XML로 분리하여 관리하는 Persistence 프레임워크 |
| `SqlSession` | SQL 실행과 트랜잭션을 담당하는 핵심 객체 |
| `config.xml` | DB 연결, 별칭, 매퍼 등록 등 전역 설정 |
| 매퍼 XML | SQL문을 정의하는 파일 (`select`, `insert`, `update`, `delete`) |
| 동적 SQL | `<if>`, `<choose>`, `<foreach>` 등으로 조건부 SQL 구성 |
| `<sql>` / `<include>` | SQL 조각을 정의하고 재사용 |

### JdbcTemplate vs 마이바티스

| 구분 | JdbcTemplate | 마이바티스 |
|:-----|:-----|:-----|
| SQL 위치 | 자바 코드 안 (`String`) | XML 파일에 분리 |
| 파라미터 바인딩 | `?` + 순서 기반 | `#{property}` 이름 기반 |
| 결과 매핑 | `RowMapper` 직접 구현 | `resultType`으로 자동 매핑 |
| 동적 SQL | 자바 코드로 조건 분기 | XML 태그(`<if>`, `<choose>`)로 구성 |
| 학습 비용 | 낮음 | 중간 (XML 태그 학습 필요) |
| 적합한 상황 | 단순 CRUD | 복잡한 SQL, 검색 조건이 다양한 경우 |
