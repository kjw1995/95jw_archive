---
title: "06. 파일 검색 및 명령어 사용법"
weight: 6
---

## 1. find - 디렉터리 트리에서 파일 찾기

### 기본 사용법

```bash
find <검색 디렉터리> <검색 조건> <액션>
```

지정한 디렉터리를 기점으로 하위 트리를 재귀 탐색하며, 조건에 맞는 파일을 찾아 액션을 실행한다.

```bash
# 현재 디렉터리 아래 모든 파일/디렉터리 출력
$ find .

# /home 아래 모든 파일/디렉터리 출력
$ find /home
```

> 검색 조건을 생략하면 모든 파일과 디렉터리가 대상이 된다

### 동작 원리

```
find /home -name '*.log'

  /home (시작)
    ├── user/
    │   ├── app.log    ← 일치
    │   ├── data/
    │   │   └── err.log ← 일치
    │   └── note.txt
    └── admin/
        └── sys.log    ← 일치
```

find는 디스크를 **직접 탐색**한다. 파일이 많을수록 시간이 오래 걸리지만, 항상 **최신 상태**를 반영한다.

### 이름으로 찾기 (-name, -iname)

```bash
# 정확한 이름으로 검색
$ find /home -name 'report.txt'

# 와일드카드 사용 (* = 임의 문자열)
$ find /home -name '*.log'

# ? = 임의의 한 문자
$ find /tmp -name 'file?.txt'
# file1.txt, fileA.txt 등 일치

# 대소문자 무시 (-iname)
$ find . -iname '*.jpg'
# Photo.JPG, image.jpg 모두 일치
```

> 와일드카드 사용 시 반드시 **작은따옴표**로 감싸야 한다. 그렇지 않으면 셸이 먼저 경로 확장을 수행해 버린다.

### 파일 형식으로 찾기 (-type)

| 지정 | 파일 형식 |
|:-----|:-----|
| `-type f` | 보통 파일 |
| `-type d` | 디렉터리 |
| `-type l` | 심볼릭 링크 |

```bash
# 디렉터리만 검색
$ find /var -type d -name 'log*'

# 보통 파일만 검색
$ find . -type f -name '*.conf'

# 심볼릭 링크만 검색
$ find /usr/bin -type l
```

### 크기로 찾기 (-size)

```bash
# 10MB 이상 파일
$ find / -type f -size +10M

# 정확히 1KB 파일
$ find . -type f -size 1k

# 100MB 이상인 로그 파일
$ find /var/log -name '*.log' -size +100M

# 빈 파일 찾기 (0바이트)
$ find . -type f -size 0
# 또는
$ find . -type f -empty
```

| 단위 | 의미 |
|:-----|:-----|
| `c` | 바이트 |
| `k` | 킬로바이트 |
| `M` | 메가바이트 |
| `G` | 기가바이트 |

> `+`는 초과, `-`는 미만, 기호 없으면 정확히 일치

### 시간으로 찾기 (-mtime, -atime, -ctime)

| 옵션 | 기준 시간 |
|:-----|:-----|
| `-mtime` | 내용 수정 시간 |
| `-atime` | 마지막 접근 시간 |
| `-ctime` | 속성 변경 시간 |

```bash
# 최근 7일 이내 수정된 파일
$ find . -type f -mtime -7

# 30일 이상 접근 안 된 파일
$ find /tmp -type f -atime +30

# 정확히 1일 전 수정된 파일
$ find . -type f -mtime 1
```

> 분 단위로 찾으려면 `-mmin`, `-amin`, `-cmin` 사용

```bash
# 60분 이내 수정된 파일
$ find . -type f -mmin -60
```

### 권한으로 찾기 (-perm)

```bash
# 정확히 755인 파일
$ find . -type f -perm 755

# 실행 권한이 있는 파일
$ find . -type f -perm /111

# 누구나 쓸 수 있는 파일 (보안 점검)
$ find / -type f -perm /002
```

### 소유자로 찾기 (-user, -group)

```bash
# 특정 사용자 소유 파일
$ find /home -user john

# 특정 그룹 소유 파일
$ find /var -group www-data

# 소유자 없는 파일 (보안 점검)
$ find / -nouser
```

### 검색 조건 조합

```bash
# AND 조건 (-a 또는 그냥 나열)
$ find . -name '*.log' -size +1M
$ find . -name '*.log' -a -size +1M

# OR 조건 (-o)
$ find . -name '*.jpg' -o -name '*.png'

# NOT 조건 (!)
$ find . -type f ! -name '*.tmp'

# 조합 예시: jpg 또는 png이면서 1MB 이상
$ find . \( -name '*.jpg' -o -name '*.png' \) -size +1M
```

> `-o` 사용 시 `\(`, `\)`로 그룹핑하지 않으면 우선순위 문제가 발생한다. AND가 OR보다 우선이기 때문이다.

### 검색 깊이 제한 (-maxdepth, -mindepth)

```bash
# 현재 디렉터리만 검색 (하위 X)
$ find . -maxdepth 1 -name '*.txt'

# 2단계 깊이까지만 검색
$ find . -maxdepth 2 -type f

# 3단계 이상 깊이의 파일만 검색
$ find . -mindepth 3 -type f
```

### 액션 (-exec, -delete, -print)

기본 액션은 `-print`(경로 출력)이다. `-exec`를 사용하면 찾은 파일에 임의의 명령을 실행할 수 있다.

```bash
# 찾은 파일의 상세 정보 출력
$ find . -name '*.log' -exec ls -lh {} \;

# 찾은 파일 삭제
$ find /tmp -name '*.tmp' -delete

# 찾은 파일의 권한 변경
$ find . -type f -name '*.sh' -exec chmod +x {} \;

# 찾은 파일 내용에서 문자열 검색
$ find . -name '*.conf' -exec grep -l 'port' {} \;
```

> `{}`는 찾은 파일 경로로 치환된다. `\;`는 명령어의 끝을 의미한다.

**`\;`와 `+`의 차이:**

```bash
# \; → 파일마다 명령 실행 (느림)
$ find . -name '*.txt' -exec wc -l {} \;
# wc -l file1.txt
# wc -l file2.txt
# wc -l file3.txt

# + → 파일을 모아서 한 번에 (빠름)
$ find . -name '*.txt' -exec wc -l {} +
# wc -l file1.txt file2.txt file3.txt
```

### 실전 활용 예시

```bash
# 7일 이상 된 로그 삭제
$ find /var/log -name '*.log' -mtime +7 -delete

# 빈 디렉터리 정리
$ find . -type d -empty -delete

# 큰 파일 Top 10 찾기
$ find / -type f -exec du -h {} + 2>/dev/null \
  | sort -rh | head -10

# 특정 확장자 파일 개수 세기
$ find . -type f -name '*.java' | wc -l
```

---

## 2. locate - 데이터베이스에서 빠르게 찾기

### find와 locate의 차이

```
  find               locate
  ─────────          ──────────
  디스크 직접 탐색    DB에서 검색
  항상 최신 결과      DB 갱신 주기 의존
  느림 (대량 파일)    매우 빠름
  조건 검색 강력      이름 검색 위주
```

### 설치

```bash
# 설치 여부 확인
$ locate --version

# Ubuntu
$ sudo apt-get install mlocate

# CentOS
$ yum install mlocate
```

설치 후 **반드시 데이터베이스를 생성**해야 한다.

```bash
$ sudo updatedb
```

> updatedb는 설치 후 자동으로 하루 한 번 실행되도록 설정된다 (cron)

### 기본 사용법

```bash
locate [옵션] <검색 패턴>
```

```bash
# 경로에 passwd가 포함된 파일
$ locate passwd
/etc/passwd
/etc/passwd-
/usr/share/doc/passwd/...

# 와일드카드 사용
$ locate '*.conf'
```

### 주요 옵션

| 옵션 | 설명 |
|:-----|:-----|
| `-i` | 대소문자 무시 |
| `-b` | 파일이름만으로 검색 (경로 제외) |
| `-c` | 일치하는 파일 개수만 출력 |
| `-n N` | 결과를 N개까지만 출력 |

```bash
# 대소문자 무시
$ locate -i readme

# 파일이름만으로 검색
$ locate -b 'passwd'

# 결과 5개까지만 출력
$ locate -n 5 '*.log'

# 일치 개수만 확인
$ locate -c '*.py'
```

### 여러 패턴 검색

```bash
# OR 조건 (기본) - 하나라도 일치
$ locate pattern1 pattern2

# AND 조건 (-A) - 모두 포함
$ locate -A etc conf
# 경로에 etc와 conf가 모두 포함된 파일
```

### locate의 한계

데이터베이스가 하루 한 번 갱신되므로 다음 문제가 발생할 수 있다.

- 검색되었지만 실제로는 **삭제된 파일**
- 검색되지 않지만 실제로는 **방금 생성한 파일**

```bash
# DB를 수동으로 즉시 갱신
$ sudo updatedb

# 최근 생성한 파일을 찾을 때는 find 사용
$ find /home -name 'newfile.txt'
```

> locate는 오래된 파일이나 시스템 파일을 빠르게 찾을 때 유용하다. 방금 만든 파일은 find로 찾자.

---

## 3. 명령어 사용법 확인하기

### --help 옵션

대부분의 리눅스 명령어는 `--help` 옵션을 지원한다.

```bash
$ ls --help
$ grep --help
$ find --help
```

> 간단한 옵션 확인에 적합하다. 자세한 설명이 필요하면 man을 사용한다.

### man - 온라인 매뉴얼

```bash
man <명령어>
```

```bash
$ man ls
$ man find
$ man grep
```

man은 `less`로 표시되므로 같은 키 조작이 적용된다.

| 키 | 동작 |
|:--:|:-----|
| `Space` | 한 화면 아래로 |
| `b` | 한 화면 위로 |
| `/문자열` | 검색 |
| `n` / `N` | 다음/이전 검색 결과 |
| `q` | 종료 |

### man 매뉴얼의 구성

| 항목 | 내용 |
|:-----|:-----|
| NAME | 명령어 이름과 간단한 설명 |
| SYNOPSIS | 옵션, 인자 지정 방법 |
| DESCRIPTION | 상세 설명 |
| OPTIONS | 사용 가능한 옵션 목록 |
| EXAMPLES | 대표적인 사용 예시 |
| SEE ALSO | 관련 명령어 |
| FILES | 관련 설정 파일 |
| BUGS | 알려진 버그 |

### 키워드로 매뉴얼 찾기

명령어 이름을 모를 때 키워드로 검색한다.

```bash
# -k 옵션으로 키워드 검색
$ man -k compress
bzip2 (1)    - a block-sorting file compressor
gzip (1)     - compress or expand files
zip (1)      - package and compress files

# apropos도 동일한 기능
$ apropos compress
```

> `man -k`와 `apropos`는 동일하다. 기억하기 쉬운 것을 사용하면 된다.

### 섹션 번호

같은 이름이 여러 섹션에 존재할 수 있다. 예를 들어 `passwd`는 명령어(1)이면서 설정 파일(5)이기도 하다.

| 섹션 | 내용 |
|:-----|:-----|
| 1 | 명령어 |
| 2 | 시스템콜 |
| 3 | 라이브러리 함수 |
| 4 | 디바이스 파일 |
| 5 | 파일 서식 |
| 6 | 게임 |
| 7 | 기타 |
| 8 | 시스템관리 명령어 |
| 9 | 커널 루틴 |

```bash
# 섹션 번호 지정
$ man 1 passwd    # passwd 명령어
$ man 5 passwd    # /etc/passwd 파일 형식

# 어떤 섹션에 있는지 확인
$ man -wa passwd
/usr/share/man/man1/passwd.1.gz
/usr/share/man/man5/passwd.5.gz

# whatis로 한 줄 설명 확인
$ whatis passwd
passwd (1)  - change user password
passwd (5)  - the password file
```

---

## 4. 명령어 검색

### which - 명령어의 전체 경로

```bash
which [옵션] <명령어>
```

```bash
$ which cat
/bin/cat

$ which python
/usr/bin/python

# 같은 이름 모두 출력 (-a)
$ which -a python
/usr/bin/python
/usr/local/bin/python
```

### $PATH의 동작 원리

```
$ echo $PATH
/usr/local/bin:/usr/bin:/bin

cat 입력
  │
  ▼
셸이 $PATH 순서대로 탐색
  │
  ├─ /usr/local/bin/cat? → 없음
  ├─ /usr/bin/cat?       → 없음
  └─ /bin/cat?           → 발견!
  │
  ▼
/bin/cat 실행
```

$PATH에 나열된 디렉터리를 **앞에서부터 순서대로** 탐색한다. 먼저 발견된 명령어가 실행된다.

```bash
# 현재 PATH 확인
$ echo $PATH

# PATH에 디렉터리 추가
$ export PATH=$PATH:/new/path
```

### whereis - 바이너리, 소스, 매뉴얼 위치

```bash
$ whereis ls
ls: /bin/ls /usr/share/man/man1/ls.1.gz

$ whereis gcc
gcc: /usr/bin/gcc /usr/lib/gcc /usr/share/man/man1/gcc.1.gz
```

> `which`는 실행 파일만, `whereis`는 소스와 매뉴얼 위치까지 출력한다

### type - 명령어의 종류 확인

```bash
$ type cd
cd is a shell builtin

$ type ls
ls is aliased to 'ls --color=auto'

$ type cat
cat is /bin/cat
```

| 종류 | 설명 |
|:-----|:-----|
| builtin | 셸 내장 명령어 |
| alias | 별칭 |
| file | 외부 실행 파일 |
| function | 셸 함수 |

> `which`는 외부 명령어만 찾는다. 셸 내장 명령어나 alias는 `type`으로 확인한다.

---

## 5. 한글/영어 전환

```bash
# 한글로 도움말 출력
$ LANG=ko_KR.UTF-8 cat --help

# 영어로 도움말 출력 (기본값)
$ LANG=C cat --help

# 현재 로케일 확인
$ locale
```

> 에러 메시지를 구글링할 때는 `LANG=C`로 영어 메시지를 얻으면 검색 결과가 훨씬 많다

---

## 요약

### 파일 검색 명령어 선택 기준

| 상황 | 명령어 |
|:-----|:-----|
| 조건이 복잡한 검색 | `find` |
| 이름으로 빠르게 검색 | `locate` |
| 명령어 위치 확인 | `which` |
| 명령어 종류 확인 | `type` |

### find 핵심 옵션

```bash
find . -name '*.log'       # 이름
find . -type f             # 파일만
find . -size +10M          # 10MB 초과
find . -mtime -7           # 7일 이내 수정
find . -perm 755           # 권한
find . -user john          # 소유자
find . -exec cmd {} \;     # 명령 실행
find . -maxdepth 2         # 깊이 제한
```

### locate 핵심 옵션

```bash
locate '*.conf'            # 패턴 검색
locate -i readme           # 대소문자 무시
locate -b 'passwd'         # 파일명만
locate -A etc conf         # AND 검색
sudo updatedb              # DB 갱신
```

### 도움말 확인

```bash
cmd --help                 # 간단한 도움말
man cmd                    # 상세 매뉴얼
man -k keyword             # 키워드로 찾기
man 5 passwd               # 섹션 지정
whatis cmd                 # 한 줄 설명
```

### 명령어 위치 확인

```bash
which cmd                  # 실행 파일 경로
which -a cmd               # 동일 이름 모두
whereis cmd                # 바이너리+매뉴얼
type cmd                   # 종류 확인
```
