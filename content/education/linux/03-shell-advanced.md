---
title: "03. 셸을 능숙하게 다루는 방법"
weight: 3
---

## 1. 커맨드 라인의 구조

### 커맨드 라인이란?

> 프롬프트 뒤에 명령어를 입력하는 영역

```
┌─────────────────────────────────────────────────────────────────┐
│                     커맨드 라인 구조                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   $ echo Hello World                                            │
│   │ │    │     │                                                │
│   │ │    │     └── 인자 (argument) 2                            │
│   │ │    └── 인자 (argument) 1                                  │
│   │ └── 명령어 (command)                                        │
│   └── 프롬프트 (prompt)                                          │
│                                                                  │
│   ├──┤├─────────────────┤                                       │
│   프롬프트   커맨드 라인                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 명령어 구성 요소

```bash
$ ls -la /home/user
  │  │   │
  │  │   └── 인자(argument): 명령의 대상
  │  └── 옵션(option): 명령의 동작 방식 변경
  └── 명령어(command): 실행할 프로그램

# 옵션 형식
-a              # 짧은 옵션 (한 글자)
-l -a           # 여러 옵션 나열
-la             # 짧은 옵션 결합
--all           # 긴 옵션 (GNU 스타일)
--color=auto    # 긴 옵션 + 값
```

---

## 2. 커서 이동 단축키

### 문자 단위 이동

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    $ echo Hello World                                           │
│              ▲                                                   │
│              │ 커서 위치                                          │
│                                                                  │
│    Ctrl + b (backward)  ←  커서를 한 문자 뒤로                    │
│    Ctrl + f (forward)   →  커서를 한 문자 앞으로                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 기억법 |
|--------|------|--------|
| `Ctrl + b` | 한 문자 뒤로 (←) | **b**ackward |
| `Ctrl + f` | 한 문자 앞으로 (→) | **f**orward |
| `←` / `→` | 화살표 키로도 가능 | - |

### 줄 처음/끝 이동

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    $ echo Hello World                                           │
│    ▲                   ▲                                        │
│    │                   │                                        │
│  Ctrl + a           Ctrl + e                                    │
│  (맨 앞으로)         (맨 뒤로)                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 기억법 |
|--------|------|--------|
| `Ctrl + a` | 줄 맨 앞으로 | 알파벳 **a** (시작) |
| `Ctrl + e` | 줄 맨 뒤로 | **e**nd |
| `Home` | 줄 맨 앞으로 | - |
| `End` | 줄 맨 뒤로 | - |

### 단어 단위 이동

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    $ echo Hello World                                           │
│         ◄─────┤     ├─────►                                     │
│        Meta+b │     │ Meta+f                                    │
│      (한 단어 뒤)   (한 단어 앞)                                   │
│                                                                  │
│    Meta 키:                                                      │
│    • Esc 키 (누르고 떼고 → b 또는 f)                               │
│    • Alt 키 (동시에 누름)                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 기억법 |
|--------|------|--------|
| `Meta + b` 또는 `Alt + b` | 한 단어 뒤로 | **b**ackward word |
| `Meta + f` 또는 `Alt + f` | 한 단어 앞으로 | **f**orward word |
| `Ctrl + ←` | 한 단어 뒤로 | - |
| `Ctrl + →` | 한 단어 앞으로 | - |

---

## 3. 문자 삭제

### 삭제 단축키

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    $ echo Hello World                                           │
│              ▲                                                   │
│              │ 커서                                              │
│                                                                  │
│    Backspace / Ctrl+h  →  'e' 삭제 (커서 앞 문자)                  │
│    Delete / Ctrl+d     →  'l' 삭제 (커서 위치 문자)                │
│                                                                  │
│    삭제 전: echo Hello World                                     │
│                  ▲                                               │
│    Backspace 후: echo Hllo World  (e 삭제)                       │
│    Delete 후:    echo Helo World  (l 삭제)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 설명 |
|--------|------|------|
| `Backspace` / `Ctrl + h` | 커서 앞 문자 삭제 | 가장 일반적 |
| `Delete` / `Ctrl + d` | 커서 위치 문자 삭제 | 커서 뒤 문자 |
| `Ctrl + w` | 커서 앞 단어 삭제 | 공백까지 삭제 |
| `Meta + d` / `Alt + d` | 커서 뒤 단어 삭제 | 다음 공백까지 |

### 단어 삭제 예시

```bash
# 초기 상태 (▲ = 커서 위치)
$ git commit -m "Initial commit"
                ▲

# Ctrl + w 실행 (커서 앞 단어 삭제)
$ git commit -m commit"
                ▲
# "-m" 부분이 삭제됨

# Alt + d 실행 (커서 뒤 단어 삭제)
$ git commit -m "commit"
                ▲
# "Initial" 부분이 삭제됨
```

---

## 4. 자르기와 붙여넣기 (Kill & Yank)

### Kill Ring 개념

> bash는 삭제한 텍스트를 **kill ring**(킬 링)에 저장하여 나중에 붙여넣기 가능

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kill & Yank                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    $ echo Hello World                                           │
│              ▲                                                   │
│                                                                  │
│    Ctrl + k  →  커서부터 끝까지 자르기                             │
│    결과: $ echo Hel  (kill ring: "lo World")                    │
│                                                                  │
│    Ctrl + u  →  처음부터 커서까지 자르기                           │
│    결과: $ lo World  (kill ring: "echo Hel")                    │
│                                                                  │
│    Ctrl + y  →  kill ring 내용 붙여넣기 (yank)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 자르기/붙여넣기 단축키

| 단축키 | 동작 | 기억법 |
|--------|------|--------|
| `Ctrl + k` | 커서 → 끝까지 자르기 | **k**ill to end |
| `Ctrl + u` | 처음 → 커서까지 자르기 | **u**ndo line |
| `Ctrl + w` | 커서 앞 단어 자르기 | kill **w**ord |
| `Ctrl + y` | 붙여넣기 | **y**ank |
| `Meta + y` | 이전 kill ring 항목 순환 | yank rotation |

### 실전 예시

```bash
# 1. 긴 명령어 입력 중
$ find /var/log -name "*.log" -mtime +7 -delete
                               ▲

# 2. 뒤쪽 옵션들 잘라내기 (Ctrl + k)
$ find /var/log -name "*.log"
# kill ring에 " -mtime +7 -delete" 저장됨

# 3. 다른 작업...

# 4. 잘라낸 내용 붙여넣기 (Ctrl + y)
$ find /var/log -name "*.log" -mtime +7 -delete
```

---

## 5. 화면 제어와 문제 해결

### 화면 잠금/해제

```
┌─────────────────────────────────────────────────────────────────┐
│                     화면 잠금 문제                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [문제 상황]                                                     │
│  키보드를 아무리 눌러도 반응이 없다!                                │
│                                                                  │
│  [원인]                                                          │
│  실수로 Ctrl + s를 눌러 화면 출력이 잠김 (XOFF)                    │
│                                                                  │
│  [해결]                                                          │
│  Ctrl + q를 눌러 잠금 해제 (XON)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 설명 |
|--------|------|------|
| `Ctrl + s` | 화면 출력 일시정지 (XOFF) | 실수로 누르기 쉬움 |
| `Ctrl + q` | 화면 출력 재개 (XON) | 잠금 해제 |

### 명령어 강제 종료

```bash
# 실행 중인 명령이 끝나지 않을 때
$ ping google.com
PING google.com (142.250.196.110): 56 data bytes
64 bytes from 142.250.196.110: icmp_seq=0 ttl=116 time=31.2 ms
64 bytes from 142.250.196.110: icmp_seq=1 ttl=116 time=30.8 ms
^C   # Ctrl + C 입력 → 강제 종료
--- google.com ping statistics ---
2 packets transmitted, 2 packets received

# 백그라운드로 전환하고 싶을 때
$ ping google.com
^Z   # Ctrl + Z 입력 → 일시정지 + 백그라운드
[1]+  Stopped                 ping google.com

$ bg    # 백그라운드에서 계속 실행
$ fg    # 포그라운드로 복귀
```

| 단축키 | 동작 | 신호 |
|--------|------|------|
| `Ctrl + c` | 프로세스 강제 종료 | SIGINT |
| `Ctrl + z` | 프로세스 일시정지 | SIGTSTP |
| `Ctrl + d` | EOF 전송 / 셸 종료 | - |
| `Ctrl + \` | 강제 종료 (코어 덤프) | SIGQUIT |

### 화면 정리

```bash
# 방법 1: 단축키 (권장)
Ctrl + l

# 방법 2: clear 명령어
$ clear

# 방법 3: 터미널 초기화 (심각한 깨짐)
$ reset

# 방법 4: 스크롤백 버퍼까지 삭제
$ clear && printf '\e[3J'
```

| 명령/단축키 | 동작 | 용도 |
|------------|------|------|
| `Ctrl + l` | 화면 지우고 커서 상단으로 | 일반적인 정리 |
| `clear` | 화면 지움 | Ctrl+l과 동일 |
| `reset` | 터미널 완전 초기화 | 문자 깨짐 심할 때 |

---

## 6. 자동 완성 (Tab Completion)

### 기본 자동 완성

```bash
# 명령어 완성
$ syste<Tab>
$ systemctl     # 자동 완성

# 여러 후보가 있을 때
$ sys<Tab><Tab>
syscall    sysctl    systemctl    systemd-analyze...

# 파일/디렉토리 완성
$ cd /ho<Tab>
$ cd /home/

# 변수 완성
$ echo $HO<Tab>
$ echo $HOME
```

### 자동 완성 종류

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tab 자동 완성 기능                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [명령어 완성]                                                   │
│  $ git<Tab>       → git, git-shell, gitk...                     │
│                                                                  │
│  [파일/디렉토리 완성]                                             │
│  $ cat /etc/hos<Tab>  → /etc/hosts                              │
│  $ cd ~/Doc<Tab>      → ~/Documents/                            │
│                                                                  │
│  [옵션 완성] (bash-completion 필요)                              │
│  $ git --<Tab>    → --version, --help, --git-dir...            │
│  $ ls --co<Tab>   → --color                                     │
│                                                                  │
│  [변수 완성]                                                     │
│  $ echo $PA<Tab>  → $PATH                                       │
│                                                                  │
│  [사용자 완성]                                                   │
│  $ su ~ro<Tab>    → ~root                                       │
│                                                                  │
│  [호스트 완성]                                                   │
│  $ ssh serv<Tab>  → server1 (known_hosts 기반)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### bash-completion 설치

```bash
# Ubuntu/Debian
$ sudo apt install bash-completion

# CentOS/RHEL
$ sudo yum install bash-completion

# 활성화 확인
$ type _init_completion
_init_completion is a function

# ~/.bashrc에 추가 (필요시)
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
fi
```

---

## 7. 명령어 이력 (History)

### 이력 탐색

```
┌─────────────────────────────────────────────────────────────────┐
│                     명령어 이력 탐색                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    Ctrl + p (previous) 또는 ↑                                   │
│         ▲                                                        │
│    ┌────┴────┐                                                  │
│    │ 명령어 3 │ ← 가장 최근                                       │
│    ├─────────┤                                                  │
│    │ 명령어 2 │                                                  │
│    ├─────────┤                                                  │
│    │ 명령어 1 │ ← 가장 오래됨                                      │
│    └────┬────┘                                                  │
│         ▼                                                        │
│    Ctrl + n (next) 또는 ↓                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 단축키 | 동작 | 기억법 |
|--------|------|--------|
| `Ctrl + p` 또는 `↑` | 이전 명령어 | **p**revious |
| `Ctrl + n` 또는 `↓` | 다음 명령어 | **n**ext |
| `Ctrl + r` | 이력 역방향 검색 | **r**everse search |
| `Ctrl + s` | 이력 순방향 검색 | **s**earch forward |

### history 명령어

```bash
# 전체 이력 보기
$ history
  501  ls -la
  502  cd /var/log
  503  tail -f syslog
  504  history

# 최근 N개만 보기
$ history 10

# 특정 명령어 검색
$ history | grep git

# 이력 번호로 실행
$ !503        # 503번 명령어 실행
$ !!          # 마지막 명령어 재실행
$ !-2         # 2번째 전 명령어 실행

# 문자열로 검색 실행
$ !git        # git으로 시작하는 마지막 명령어
$ !?commit    # commit 포함하는 마지막 명령어

# 이력 삭제
$ history -c          # 현재 세션 이력 삭제
$ history -d 503      # 특정 번호 삭제
$ > ~/.bash_history   # 파일 비우기
```

### 증분 검색 (Ctrl + r)

```
┌─────────────────────────────────────────────────────────────────┐
│                     증분 검색 (Reverse-i-search)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Ctrl + r 누르기                                              │
│     (reverse-i-search)`':                                       │
│                                                                  │
│  2. 검색어 입력 (한 글자씩 입력할 때마다 검색)                      │
│     (reverse-i-search)`git': git commit -m "Fix bug"            │
│                                                                  │
│  3. 조작                                                         │
│     • Ctrl + r  : 같은 검색어로 더 이전 결과                       │
│     • Enter     : 현재 결과 실행                                  │
│     • Esc       : 실행 안 하고 커맨드 라인에 복사                   │
│     • Ctrl + g  : 검색 취소하고 원래 프롬프트로                     │
│     • ← / →    : 검색 종료하고 편집 모드                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 검색 중 단축키 | 동작 |
|---------------|------|
| 문자 입력 | 실시간 검색 |
| `Ctrl + r` | 더 이전 결과로 이동 |
| `Enter` | 현재 결과 실행 |
| `Esc` | 결과를 커맨드 라인에 남기고 종료 |
| `Ctrl + g` | 검색 취소 |
| `Ctrl + j` | 결과를 커맨드 라인에 남기고 종료 |

### 이력 설정

```bash
# ~/.bashrc에 추가

# 이력 크기 설정
export HISTSIZE=10000           # 메모리 이력 개수
export HISTFILESIZE=20000       # 파일 이력 개수

# 중복 명령어 무시
export HISTCONTROL=ignoredups   # 연속 중복 무시
export HISTCONTROL=erasedups    # 모든 중복 삭제
export HISTCONTROL=ignoreboth   # 중복 + 공백시작 무시

# 특정 명령어 제외
export HISTIGNORE="ls:cd:pwd:exit:history"

# 이력에 시간 기록
export HISTTIMEFORMAT="%Y-%m-%d %H:%M:%S  "

# 즉시 파일에 저장
shopt -s histappend
export PROMPT_COMMAND="history -a"
```

---

## 8. 특수 문자와 이스케이프

### 셸 특수 문자

```
┌─────────────────────────────────────────────────────────────────┐
│                    셸에서 특별한 의미를 가지는 문자                 │
├──────┬─────────────────────────────────────────────────────────┤
│ 문자  │ 의미                                                    │
├──────┼─────────────────────────────────────────────────────────┤
│  *   │ 0개 이상의 모든 문자 (와일드카드)                          │
│  ?   │ 정확히 1개의 문자                                        │
│  [ ] │ 괄호 안의 문자 중 하나                                    │
│  ~   │ 홈 디렉토리                                              │
│  $   │ 변수 참조                                                │
│  &   │ 백그라운드 실행                                          │
│  |   │ 파이프                                                   │
│  >   │ 출력 리다이렉션                                          │
│  <   │ 입력 리다이렉션                                          │
│  ;   │ 명령어 구분                                              │
│  #   │ 주석                                                     │
│  \   │ 이스케이프 문자                                          │
│  ' ' │ 강한 인용 (모든 특수문자 무력화)                           │
│  " " │ 약한 인용 ($, `, \ 는 해석됨)                            │
│  ` ` │ 명령어 치환                                              │
└──────┴─────────────────────────────────────────────────────────┘
```

### 와일드카드 (Globbing)

```bash
# * : 0개 이상의 모든 문자
$ ls *.txt          # 모든 .txt 파일
$ ls log*           # log로 시작하는 모든 파일
$ ls *2024*         # 2024가 포함된 모든 파일

# ? : 정확히 1개의 문자
$ ls file?.txt      # file1.txt, fileA.txt 등
$ ls ???.log        # 3글자.log 파일

# [ ] : 괄호 안 문자 중 하나
$ ls file[123].txt  # file1.txt, file2.txt, file3.txt
$ ls file[a-z].txt  # filea.txt ~ filez.txt
$ ls file[0-9].txt  # file0.txt ~ file9.txt
$ ls file[!0-9].txt # 숫자가 아닌 것 (부정)

# { } : 여러 패턴 (Brace Expansion)
$ ls {*.txt,*.log}  # .txt와 .log 파일
$ echo file{1,2,3}  # file1 file2 file3
$ echo {a..z}       # a b c ... z
$ echo {1..10}      # 1 2 3 ... 10
```

### 인용과 이스케이프

```bash
# 작은따옴표 (강한 인용) - 모든 특수문자 무력화
$ echo 'Price: $100'
Price: $100

# 큰따옴표 (약한 인용) - $, `, \ 는 해석됨
$ echo "Home: $HOME"
Home: /home/user

# 백슬래시 - 다음 한 문자 이스케이프
$ echo Price: \$100
Price: $100

$ echo "She said \"Hello\""
She said "Hello"

# 공백 포함 파일명 처리
$ cat "file name with spaces.txt"
$ cat file\ name\ with\ spaces.txt
```

---

## 9. 명령어 치환과 변수

### 명령어 치환

```bash
# $() 형식 (권장)
$ echo "Today is $(date +%Y-%m-%d)"
Today is 2024-12-28

$ files=$(ls *.txt)
$ echo $files

# 백틱 형식 (레거시)
$ echo "Current dir: `pwd`"
Current dir: /home/user

# 중첩 사용
$ echo "Files: $(ls $(dirname $0))"
```

### 변수 사용

```bash
# 변수 할당 (= 주위에 공백 없음!)
$ name="John"
$ count=10

# 변수 참조
$ echo $name
$ echo ${name}       # 권장 (명확함)
$ echo "${name}!"    # John!

# 기본값 설정
$ echo ${VAR:-default}    # VAR 없으면 default 출력
$ echo ${VAR:=default}    # VAR 없으면 default 할당
$ echo ${VAR:+isset}      # VAR 있으면 isset 출력

# 문자열 조작
$ path="/home/user/file.txt"
$ echo ${path%.txt}       # /home/user/file (뒤에서 제거)
$ echo ${path##*/}        # file.txt (앞에서 제거)
$ echo ${path%/*}         # /home/user (디렉토리만)
$ echo ${#path}           # 20 (문자열 길이)
```

---

## 10. 멀티라인 입력

### 줄 계속 (Line Continuation)

```bash
# 백슬래시로 줄 연결
$ echo "This is a very long \
> command that spans \
> multiple lines"
This is a very long command that spans multiple lines

# 파이프/논리 연산자 뒤에서 자동 계속
$ cat file.txt |
> grep "error" |
> wc -l

# 따옴표 안에서 줄바꿈
$ echo "Line 1
> Line 2
> Line 3"
Line 1
Line 2
Line 3
```

### Here Document

```bash
# 여러 줄 입력
$ cat << EOF
This is line 1
This is line 2
Variable: $HOME
EOF

# 변수 해석 없이 (따옴표로 감싸기)
$ cat << 'EOF'
This will show $HOME literally
EOF

# 들여쓰기 제거 (<<- 사용, 탭만)
$ cat <<- EOF
	Indented line 1
	Indented line 2
	EOF
```

---

## 요약

### 커서 이동

| 단축키 | 동작 |
|--------|------|
| `Ctrl + a/e` | 줄 처음/끝 |
| `Ctrl + b/f` | 한 문자 뒤/앞 |
| `Alt + b/f` | 한 단어 뒤/앞 |

### 편집

| 단축키 | 동작 |
|--------|------|
| `Ctrl + u/k` | 처음까지/끝까지 자르기 |
| `Ctrl + w` | 단어 자르기 |
| `Ctrl + y` | 붙여넣기 |

### 제어

| 단축키 | 동작 |
|--------|------|
| `Ctrl + c` | 강제 종료 |
| `Ctrl + z` | 일시정지 |
| `Ctrl + l` | 화면 지우기 |
| `Ctrl + s/q` | 출력 잠금/해제 |

### 이력

| 단축키 | 동작 |
|--------|------|
| `Ctrl + p/n` 또는 `↑/↓` | 이전/다음 명령 |
| `Ctrl + r` | 이력 검색 |
| `!!` | 마지막 명령 재실행 |
| `!숫자` | N번 명령 실행 |

### 자동 완성

| 키 | 동작 |
|-----|------|
| `Tab` | 자동 완성 |
| `Tab Tab` | 후보 목록 표시 |
