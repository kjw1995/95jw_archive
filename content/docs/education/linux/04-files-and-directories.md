---
title: "04. 파일과 디렉터리"
weight: 4
---

## 1. 리눅스는 파일로 구성된다

> 리눅스에서는 **모든 것이 파일**이다

### 파일로 다루는 것들

- 일반 데이터 (문서, 이미지, 코드)
- 설정 파일
- 하드웨어 장치 (디스크, 키보드)
- 프로세스 정보
- 네트워크 소켓

### 파일의 종류

| 기호 | 종류 | 예시 |
|:---:|------|------|
| `-` | 일반 파일 | text.txt |
| `d` | 디렉터리 | /home |
| `l` | 심볼릭 링크 | /bin → /usr/bin |
| `c` | 문자 장치 | /dev/tty |
| `b` | 블록 장치 | /dev/sda |
| `s` | 소켓 | /var/run/*.sock |
| `p` | 파이프 | named pipe |

---

## 2. 디렉터리란

> 파일을 담아 정리하는 **폴더** 개념

### 용어 정리

```
부모 디렉터리 (상위)
    │
    └── 현재 디렉터리
            │
            ├── 자식 디렉터리 1
            └── 자식 디렉터리 2
```

| 용어 | 설명 |
|------|------|
| 루트 디렉터리 | 최상위 `/` |
| 홈 디렉터리 | 사용자 개인 공간 |
| 현재 디렉터리 | 지금 위치한 곳 |
| 부모 디렉터리 | 한 단계 위 |
| 자식 디렉터리 | 하위 디렉터리 |

---

## 3. 디렉터리 구조 (FHS)

> **FHS**: Filesystem Hierarchy Standard

### 주요 디렉터리

```
/
├── bin/    # 기본 명령어
├── boot/   # 부팅 파일
├── dev/    # 장치 파일
├── etc/    # 설정 파일
├── home/   # 사용자 홈
├── lib/    # 라이브러리
├── opt/    # 추가 프로그램
├── proc/   # 프로세스 정보
├── root/   # root 홈
├── sbin/   # 관리자 명령어
├── tmp/    # 임시 파일
├── usr/    # 사용자 프로그램
└── var/    # 가변 데이터
```

### 디렉터리별 역할

**`/bin`** - 기본 명령어
- ls, cp, mv, cat 등
- 모든 사용자가 사용

**`/sbin`** - 시스템 명령어
- shutdown, fdisk 등
- 주로 root 사용

**`/etc`** - 설정 파일
- 시스템 전체 설정
- passwd, fstab, hosts

**`/home`** - 사용자 홈
- 각 사용자 개인 공간
- `/home/username`

**`/var`** - 가변 데이터
- 로그: `/var/log`
- 캐시: `/var/cache`
- 메일: `/var/mail`

**`/tmp`** - 임시 파일
- 누구나 쓰기 가능
- 재부팅 시 삭제될 수 있음

**`/dev`** - 장치 파일
- `/dev/sda` - 첫 번째 디스크
- `/dev/null` - 널 장치
- `/dev/tty` - 터미널

**`/proc`** - 프로세스 정보
- 가상 파일시스템
- `/proc/cpuinfo` - CPU 정보
- `/proc/meminfo` - 메모리 정보

---

## 4. 경로 (Path)

### 경로 구분자

| OS | 구분자 | 예시 |
|----|:------:|------|
| Linux | `/` | /home/user |
| Windows | `\` | C:\Users |

### 절대 경로 vs 상대 경로

**절대 경로**
- 루트(`/`)부터 시작
- 어디서든 같은 위치

```bash
/home/user/work/file.txt
/etc/passwd
/var/log/syslog
```

**상대 경로**
- 현재 위치 기준
- `.` = 현재 디렉터리
- `..` = 부모 디렉터리

```bash
# 현재 위치: /home/user

./work          # /home/user/work
../guest        # /home/guest
../../etc       # /etc
```

### 특수 디렉터리

| 표기 | 의미 | 예시 |
|:----:|------|------|
| `.` | 현재 디렉터리 | `./script.sh` |
| `..` | 부모 디렉터리 | `cd ..` |
| `~` | 홈 디렉터리 | `cd ~` |
| `~user` | 특정 사용자 홈 | `cd ~root` |
| `-` | 이전 디렉터리 | `cd -` |

---

## 5. 디렉터리 이동과 확인

### 기본 명령어

| 명령어 | 기능 |
|--------|------|
| `pwd` | 현재 위치 출력 |
| `cd` | 디렉터리 이동 |
| `ls` | 목록 출력 |

### pwd - 현재 위치

```bash
$ pwd
/home/user/Documents
```

### cd - 디렉터리 이동

```bash
# 절대 경로로 이동
$ cd /var/log

# 상대 경로로 이동
$ cd ../cache

# 홈으로 이동
$ cd
$ cd ~

# 이전 디렉터리로
$ cd -

# 상위로 이동
$ cd ..
$ cd ../..   # 2단계 위
```

### 틸드 확장

```bash
# ~ 는 홈 디렉터리로 치환
$ echo ~
/home/user

$ cd ~/Documents
# = cd /home/user/Documents

# 다른 사용자 홈
$ cd ~root
# = cd /root
```

---

## 6. ls 명령어

### 기본 사용

```bash
# 현재 디렉터리 목록
$ ls

# 특정 디렉터리 목록
$ ls /var/log

# 여러 경로
$ ls /bin /sbin
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-a` | 숨김 파일 포함 |
| `-l` | 상세 정보 |
| `-h` | 읽기 쉬운 크기 |
| `-t` | 시간순 정렬 |
| `-r` | 역순 정렬 |
| `-R` | 하위 디렉터리 포함 |
| `-S` | 크기순 정렬 |
| `-F` | 파일 종류 표시 |

### 자주 쓰는 조합

```bash
# 상세 + 숨김 파일
$ ls -la

# 상세 + 읽기 쉬운 크기
$ ls -lh

# 최신순 정렬
$ ls -lt

# 크기순 정렬 (큰 것 먼저)
$ ls -lhS
```

### -l 옵션 출력 해석

```
-rw-r--r-- 1 user group 4.0K Dec 28 file.txt
│          │ │    │     │    │     │
│          │ │    │     │    │     └ 파일명
│          │ │    │     │    └ 수정일
│          │ │    │     └ 크기
│          │ │    └ 그룹
│          │ └ 소유자
│          └ 링크 수
└ 권한 (타입+권한)
```

### -F 옵션 기호

| 기호 | 의미 |
|:----:|------|
| (없음) | 일반 파일 |
| `/` | 디렉터리 |
| `*` | 실행 파일 |
| `@` | 심볼릭 링크 |
| `\|` | 파이프 |
| `=` | 소켓 |

### 숨김 파일

- 점(`.`)으로 시작하는 파일
- 기본적으로 ls에 표시 안됨
- `-a` 옵션으로 표시

```bash
$ ls -a
.  ..  .bashrc  .profile  file.txt

# . 과 .. 제외
$ ls -A
.bashrc  .profile  file.txt
```

---

## 7. 와일드카드 (Glob)

### 기본 패턴

| 기호 | 의미 | 예시 |
|:----:|------|------|
| `*` | 0개 이상 문자 | `*.txt` |
| `?` | 정확히 1문자 | `file?.txt` |
| `[abc]` | a, b, c 중 하나 | `file[123].txt` |
| `[a-z]` | a~z 범위 | `file[a-z].txt` |
| `[!abc]` | a,b,c 제외 | `file[!0-9].txt` |

### 사용 예시

```bash
# 모든 .txt 파일
$ ls *.txt

# log로 시작하는 파일
$ ls log*

# 한 글자 숫자 파일
$ ls file?.txt

# file1, file2, file3
$ ls file[123].txt

# 숫자로 끝나는 파일
$ ls *[0-9]

# 숫자 아닌 것
$ ls file[!0-9].txt
```

---

## 8. 명령어 옵션 규칙

### 옵션 형식

**짧은 옵션** (한 글자)
```bash
-a
-l
-la      # 결합 가능
-l -a    # 분리 가능
```

**긴 옵션** (GNU 스타일)
```bash
--all
--help
--color=auto
```

### 옵션 인자

```bash
# 짧은 옵션 + 인자
$ ls -w 30
$ ls -w30     # 붙여쓰기 가능

# 긴 옵션 + 인자
$ ls --width 30
$ ls --width=30
```

### 옵션 결합 규칙

```bash
# 가능: 인자 없는 옵션 결합
$ ls -laF

# 주의: 인자 있는 옵션은 마지막에
$ ls -law 30   # -w가 인자 받음
```

---

## 9. 파일/디렉터리 조작

### 생성

```bash
# 빈 파일 생성 / 시간 갱신
$ touch file.txt

# 디렉터리 생성
$ mkdir dirname

# 중첩 디렉터리 한번에
$ mkdir -p a/b/c
```

### 복사

```bash
# 파일 복사
$ cp source dest

# 디렉터리 복사 (-r 필수)
$ cp -r srcdir destdir

# 권한/시간 유지
$ cp -p source dest

# 덮어쓰기 확인
$ cp -i source dest
```

### 이동/이름 변경

```bash
# 파일 이동
$ mv file /path/to/dest/

# 이름 변경
$ mv oldname newname

# 덮어쓰기 확인
$ mv -i source dest
```

### 삭제

```bash
# 파일 삭제
$ rm file

# 확인 후 삭제
$ rm -i file

# 디렉터리 삭제 (빈 것만)
$ rmdir dirname

# 디렉터리 + 내용 삭제
$ rm -r dirname

# 강제 삭제 (주의!)
$ rm -rf dirname
```

---

## 10. 심볼릭 링크

### 링크란?

> 파일에 대한 **바로가기/별명**

### 심볼릭 링크 vs 하드 링크

| 구분 | 심볼릭 링크 | 하드 링크 |
|------|------------|----------|
| 개념 | 경로를 가리킴 | 같은 데이터 참조 |
| 원본 삭제 시 | 깨짐 (dangling) | 유지됨 |
| 디렉터리 | 가능 | 불가 |
| 파일시스템 | 다른 FS 가능 | 같은 FS만 |
| 표시 | `l` 타입 | `-` 타입 |

### 링크 생성

```bash
# 심볼릭 링크 (자주 사용)
$ ln -s target linkname
$ ln -s /var/log/syslog ~/syslog

# 하드 링크
$ ln target linkname
```

### 링크 확인

```bash
$ ls -l
lrwxrwxrwx 1 user user 15 link -> /var/log/syslog
│                           │      │
│                           │      └ 원본 경로
│                           └ 링크 이름
└ l = 심볼릭 링크
```

---

## 요약

### 경로

| 구분 | 예시 |
|------|------|
| 절대 경로 | `/home/user/file` |
| 상대 경로 | `./file`, `../dir` |
| 홈 | `~`, `~user` |
| 현재 | `.` |
| 부모 | `..` |

### 필수 명령어

```bash
# 탐색
pwd           # 현재 위치
cd path       # 이동
ls -la        # 목록

# 생성
touch file    # 빈 파일
mkdir dir     # 디렉터리
mkdir -p a/b  # 중첩 생성

# 복사/이동
cp src dst    # 복사
cp -r dir/    # 디렉터리 복사
mv old new    # 이동/이름변경

# 삭제
rm file       # 파일 삭제
rm -r dir/    # 디렉터리 삭제

# 링크
ln -s target link  # 심볼릭 링크
```

### ls 옵션 요약

```bash
-a   # 숨김 파일
-l   # 상세 정보
-h   # 읽기 쉬운 크기
-t   # 시간순
-r   # 역순
-F   # 종류 표시
```
