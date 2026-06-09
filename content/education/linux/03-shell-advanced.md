---
title: "03. 셸을 능숙하게 다루는 방법"
weight: 3
---

## 1. 커맨드 라인의 구조

> 프롬프트 뒤에 명령어를 입력하는 영역

```bash
$ echo Hello World
│ │    │     │
│ │    │     └ 인자(argument) 2
│ │    └ 인자(argument) 1
│ └ 명령어(command)
└ 프롬프트(prompt)
```

### 명령어 구성 요소

```bash
$ ls -la /home/user
  │  │   │
  │  │   └ 인자: 명령의 대상
  │  └ 옵션: 동작 방식 변경
  └ 명령어: 실행할 프로그램

# 옵션 형식
-a              # 짧은 옵션 (한 글자)
-la             # 짧은 옵션 결합
--all           # 긴 옵션 (GNU 스타일)
--color=auto    # 긴 옵션 + 값
```

---

## 2. 커서 이동 단축키

bash의 행 편집은 Emacs 키 바인딩을 따른다. 화살표 키 없이도 손을 홈 포지션에 둔 채 빠르게 이동할 수 있다.

### 문자 / 줄 / 단어 단위 이동

```
$ echo Hello World
  ▲              ▲
  Ctrl+a       Ctrl+e
 (맨 앞)        (맨 끝)

Ctrl+b ← 한 문자 뒤   Ctrl+f → 한 문자 앞
Alt+b  ← 한 단어 뒤   Alt+f  → 한 단어 앞
```

| 단축키 | 동작 | 기억법 |
|:-----|:-----|:-----|
| `Ctrl + a` | 줄 맨 앞으로 | 알파벳 **a** (시작) |
| `Ctrl + e` | 줄 맨 뒤로 | **e**nd |
| `Ctrl + b` | 한 문자 뒤로 (←) | **b**ackward |
| `Ctrl + f` | 한 문자 앞으로 (→) | **f**orward |
| `Alt + b` | 한 단어 뒤로 | **b**ackward word |
| `Alt + f` | 한 단어 앞으로 | **f**orward word |
| `Home` / `End` | 줄 처음 / 끝 | - |

{{< callout type="info" >}}
**Meta 키**는 보통 `Alt`다. Alt가 동작하지 않는 터미널에서는 `Esc`를 누르고 뗀 뒤 `b`/`f`를 눌러도 같은 효과를 낸다.
{{< /callout >}}

---

## 3. 문자 삭제

```
$ echo Hello World
            ▲ 커서

Backspace / Ctrl+h → 커서 앞 문자 삭제
Delete    / Ctrl+d → 커서 위치 문자 삭제
```

| 단축키 | 동작 | 설명 |
|:-----|:-----|:-----|
| `Backspace` / `Ctrl + h` | 커서 앞 문자 삭제 | 가장 일반적 |
| `Delete` / `Ctrl + d` | 커서 위치 문자 삭제 | 커서 뒤 문자 |
| `Ctrl + w` | 커서 앞 단어 삭제 | 공백까지 |
| `Alt + d` | 커서 뒤 단어 삭제 | 다음 공백까지 |

{{< callout type="warning" >}}
`Ctrl + d`는 입력 줄이 **비어 있을 때** 누르면 문자 삭제가 아니라 EOF로 해석되어 **셸이 종료**된다. 빈 프롬프트에서 실수로 누르면 터미널이 닫히니 주의하자.
{{< /callout >}}

---

## 4. 자르기와 붙여넣기 (Kill & Yank)

> bash는 삭제한 텍스트를 **kill ring**(킬 링)에 저장해 나중에 붙여넣을 수 있다.

```
$ echo Hello World
            ▲

Ctrl+k → 커서부터 끝까지 자르기 → "lo World" 저장
Ctrl+u → 처음부터 커서까지 자르기 → "echo Hel" 저장
Ctrl+y → kill ring 내용 붙여넣기 (yank)
```

| 단축키 | 동작 | 기억법 |
|:-----|:-----|:-----|
| `Ctrl + k` | 커서 → 끝까지 자르기 | **k**ill to end |
| `Ctrl + u` | 처음 → 커서까지 자르기 | 줄 비우기 |
| `Ctrl + w` | 커서 앞 단어 자르기 | kill **w**ord |
| `Ctrl + y` | 붙여넣기 | **y**ank |
| `Alt + y` | 이전 kill ring 항목 순환 | yank rotation |

### 실전 예시

```bash
# 긴 명령어 뒤쪽을 잘라 보관했다가 다시 붙이기
$ find /var/log -name "*.log" -mtime +7 -delete
                              ▲
# Ctrl+k → " -mtime +7 -delete" 가 kill ring에 저장
$ find /var/log -name "*.log"
# 이후 Ctrl+y 로 잘라둔 부분을 다시 붙여넣기
```

---

## 5. 화면 제어와 문제 해결

### 화면 잠금/해제

{{< callout type="warning" >}}
키보드를 눌러도 반응이 없다면 실수로 `Ctrl + s`를 눌러 **화면 출력이 잠긴(XOFF)** 경우가 많다. `Ctrl + q`를 누르면 잠금이 해제(XON)된다. 프로세스가 멈춘 게 아니므로 당황하지 말자.
{{< /callout >}}

| 단축키 | 동작 |
|:-----|:-----|
| `Ctrl + s` | 화면 출력 일시정지 (XOFF) |
| `Ctrl + q` | 화면 출력 재개 (XON) |

### 명령어 강제 종료 / 작업 제어

```bash
$ ping google.com
...
^C   # Ctrl+C → 강제 종료

$ ping google.com
^Z   # Ctrl+Z → 일시정지 + 백그라운드
[1]+  Stopped   ping google.com
$ bg    # 백그라운드에서 계속 실행
$ fg    # 포그라운드로 복귀
```

| 단축키 | 동작 | 신호 |
|:-----|:-----|:-----|
| `Ctrl + c` | 프로세스 강제 종료 | SIGINT |
| `Ctrl + z` | 프로세스 일시정지 | SIGTSTP |
| `Ctrl + d` | EOF 전송 / 셸 종료 | - |
| `Ctrl + \` | 강제 종료 (코어 덤프) | SIGQUIT |

### 화면 정리

| 명령/단축키 | 동작 | 용도 |
|:-----|:-----|:-----|
| `Ctrl + l` | 화면 지우고 커서 상단 | 일반적 정리 |
| `clear` | 화면 지움 | Ctrl+l과 동일 |
| `reset` | 터미널 완전 초기화 | 문자 깨짐 심할 때 |

---

## 6. 자동 완성 (Tab Completion)

```bash
$ syste<Tab>         # 명령어 완성 → systemctl
$ sys<Tab><Tab>      # 후보 여러 개면 목록 표시
$ cd /ho<Tab>        # 경로 완성 → /home/
$ echo $HO<Tab>      # 변수 완성 → $HOME
```

### 자동 완성 종류

| 대상 | 예시 |
|:-----|:-----|
| 명령어 | `git<Tab>` → git, gitk … |
| 파일/디렉터리 | `cat /etc/hos<Tab>` → /etc/hosts |
| 옵션 | `git --<Tab>` (bash-completion 필요) |
| 변수 | `echo $PA<Tab>` → $PATH |
| 사용자 | `su ~ro<Tab>` → ~root |
| 호스트 | `ssh serv<Tab>` (known_hosts 기반) |

### bash-completion 설치

```bash
# Ubuntu/Debian
$ sudo apt install bash-completion

# CentOS/RHEL
$ sudo yum install bash-completion
```

---

## 7. 명령어 이력 (History)

### 이력 탐색

```
최근 ┌─────────┐ ← Ctrl+p / ↑ (이전)
     │ 명령어 3 │
     │ 명령어 2 │
오래 │ 명령어 1 │ ← Ctrl+n / ↓ (다음)
     └─────────┘
```

| 단축키 | 동작 | 기억법 |
|:-----|:-----|:-----|
| `Ctrl + p` / `↑` | 이전 명령어 | **p**revious |
| `Ctrl + n` / `↓` | 다음 명령어 | **n**ext |
| `Ctrl + r` | 이력 역방향 검색 | **r**everse search |

### history 명령어

```bash
$ history            # 전체 이력
$ history 10         # 최근 10개
$ history | grep git # 검색

$ !503               # 503번 명령어 실행
$ !!                 # 마지막 명령어 재실행
$ !-2                # 2번째 전 명령어
$ !git               # git으로 시작하는 마지막 명령어
$ !?commit           # commit 포함하는 마지막 명령어

$ history -c         # 현재 세션 이력 삭제
$ history -d 503     # 특정 번호 삭제
```

### 증분 검색 (Ctrl + r)

`Ctrl + r`을 누르고 검색어를 입력하면 한 글자마다 실시간으로 이력을 검색한다.

| 검색 중 키 | 동작 |
|:-----|:-----|
| 문자 입력 | 실시간 검색 |
| `Ctrl + r` | 더 이전 결과로 이동 |
| `Enter` | 현재 결과 실행 |
| `Esc` / `←` `→` | 결과를 커맨드 라인에 남기고 종료 |
| `Ctrl + g` | 검색 취소 |

### 이력 설정 (~/.bashrc)

```bash
export HISTSIZE=10000           # 메모리 이력 개수
export HISTFILESIZE=20000       # 파일 이력 개수
export HISTCONTROL=ignoreboth   # 중복 + 공백시작 무시
export HISTIGNORE="ls:cd:pwd:exit:history"
export HISTTIMEFORMAT="%F %T  " # 이력에 시간 기록
shopt -s histappend             # 이어쓰기
```

---

## 8. 특수 문자와 이스케이프

### 셸 특수 문자

| 문자 | 의미 |
|:----:|:-----|
| `*` | 0개 이상의 모든 문자 (와일드카드) |
| `?` | 정확히 1개의 문자 |
| `[ ]` | 괄호 안의 문자 중 하나 |
| `~` | 홈 디렉터리 |
| `$` | 변수 참조 |
| `&` | 백그라운드 실행 |
| `\|` | 파이프 |
| `>` `<` | 출력 / 입력 리다이렉션 |
| `;` | 명령어 구분 |
| `#` | 주석 |
| `\` | 이스케이프 문자 |
| `' '` | 강한 인용 (모든 특수문자 무력화) |
| `" "` | 약한 인용 (`$`, `` ` ``, `\` 해석) |
| `` ` ` `` | 명령어 치환 |

### 와일드카드 (Globbing)

```bash
$ ls *.txt          # 모든 .txt 파일
$ ls file?.txt      # file1.txt, fileA.txt 등
$ ls file[123].txt  # file1/2/3.txt
$ ls file[a-z].txt  # filea ~ filez
$ ls file[!0-9].txt # 숫자가 아닌 것 (부정)

# 중괄호 확장 (Brace Expansion)
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

# 공백 포함 파일명
$ cat "file name.txt"
$ cat file\ name.txt
```

---

## 9. 명령어 치환과 변수

### 명령어 치환

```bash
# $() 형식 (권장)
$ echo "Today is $(date +%Y-%m-%d)"
Today is 2024-12-28

$ files=$(ls *.txt)

# 백틱 형식 (레거시)
$ echo "Dir: `pwd`"
```

{{< callout type="info" >}}
명령어 치환은 백틱 `` `cmd` ``보다 `$(cmd)` 형식을 권장한다. `$()`는 **중첩이 가능**하고(`$(dirname $(which ls))`), 가독성이 높으며 따옴표 처리가 명확하기 때문이다.
{{< /callout >}}

### 변수 사용

```bash
# 변수 할당 (= 주위에 공백 없음!)
$ name="John"
$ count=10

# 변수 참조
$ echo $name
$ echo ${name}       # 권장 (경계 명확)

# 기본값
$ echo ${VAR:-default}    # VAR 없으면 default 출력
$ echo ${VAR:=default}    # VAR 없으면 default 할당

# 문자열 조작
$ path="/home/user/file.txt"
$ echo ${path##*/}        # file.txt (앞에서 최대 제거)
$ echo ${path%.txt}       # /home/user/file (뒤에서 제거)
$ echo ${path%/*}         # /home/user (디렉터리만)
$ echo ${#path}           # 20 (길이)
```

{{< callout type="warning" >}}
변수 할당에서 `=` 양쪽에 **공백을 넣으면 안 된다**. `name = "John"`은 셸이 `name`을 명령어로, `=`를 인자로 해석해 에러가 난다. 반드시 `name="John"`처럼 붙여 쓴다.
{{< /callout >}}

---

## 10. 멀티라인 입력

### 줄 계속 (Line Continuation)

```bash
# 백슬래시로 줄 연결
$ echo "This is a very long \
> command that spans \
> multiple lines"

# 파이프/논리 연산자 뒤에서 자동 계속
$ cat file.txt |
> grep "error" |
> wc -l
```

### Here Document

```bash
# 여러 줄 입력 (변수 해석됨)
$ cat << EOF
This is line 1
Variable: $HOME
EOF

# 변수 해석 없이 (따옴표로 감싸기)
$ cat << 'EOF'
This shows $HOME literally
EOF
```

---

## 요약

### 커서 이동

| 단축키 | 동작 |
|:-----|:-----|
| `Ctrl + a/e` | 줄 처음/끝 |
| `Ctrl + b/f` | 한 문자 뒤/앞 |
| `Alt + b/f` | 한 단어 뒤/앞 |

### 편집

| 단축키 | 동작 |
|:-----|:-----|
| `Ctrl + u/k` | 처음까지/끝까지 자르기 |
| `Ctrl + w` | 단어 자르기 |
| `Ctrl + y` | 붙여넣기 |

### 제어

| 단축키 | 동작 |
|:-----|:-----|
| `Ctrl + c` | 강제 종료 |
| `Ctrl + z` | 일시정지 |
| `Ctrl + l` | 화면 지우기 |
| `Ctrl + s/q` | 출력 잠금/해제 |

### 이력 / 자동 완성

| 단축키 | 동작 |
|:-----|:-----|
| `Ctrl + p/n` / `↑↓` | 이전/다음 명령 |
| `Ctrl + r` | 이력 검색 |
| `!!` / `!숫자` | 마지막 / N번 명령 실행 |
| `Tab` / `Tab Tab` | 자동 완성 / 후보 목록 |
