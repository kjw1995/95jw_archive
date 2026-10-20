---
title: "08. 배시 설정"
date: 2026-10-20
weight: 8
---

[07장](../07-text-editor)에서 Vim을 익혔으니 이제 그 에디터로 가장 먼저 고치게 될 파일, 셸 자신의 설정을 다룰 차례다. [02장](../02-shell)과 [03장](../03-shell-advanced)에서 프롬프트, alias, 환경 변수, 이력 설정을 맛보기로 지나쳤는데, 이 장은 그것들이 **왜 그렇게 동작하는지**를 한 번에 꿴다. alias를 붙이고, `set`과 `shopt`으로 셸의 동작을 바꾸고, 변수로 프롬프트·명령어 경로·언어를 정하고, 마지막으로 그 모든 것을 설정 파일에 적어 로그인할 때마다 되살린다. 원리는 셋이다. 첫째, **배시의 설정은 전부 지금 실행 중인 셸 프로세스의 메모리에 있다.** 그래서 터미널을 닫으면 사라지고, 새로 연 터미널에는 처음부터 없으며, 오래 쓰려면 설정 파일에 적어 셸이 뜰 때마다 다시 실행하게 해야 한다. 둘째, **자식 프로세스에게 넘어가는 것은 환경 변수의 복사본뿐이다.** `ls` 같은 외부 명령어가 셸 변수를 못 보는 이유, `export`가 필요한 이유, `cd`가 내장 명령어일 수밖에 없는 이유, 설정 파일을 `bash`가 아니라 `source`로 읽어야 하는 이유가 전부 여기서 나온다. 셋째, **명령어 이름은 alias → 함수 → 내장 명령어 → PATH 순서로 해석된다.** `type`이 보여 주는 것, alias를 피해 가는 세 가지 방법, PATH에서 앞에 둔 디렉터리가 이기는 이유가 이 순서에 있다.

---

## 1. alias: 명령어에 별명 붙이기

### 1.1 정의하기

자주 치는 긴 명령어에 짧은 이름을 붙이는 기능이다.

```bash
alias <이름>='<명령어>'
```

```bash
$ alias ll='ls -alF'
$ alias rm='rm -i'
$ alias ..='cd ..'

$ ll          # ls -alF 가 실행된다
$ rm memo.txt # 지우기 전에 묻는다
rm: remove regular file 'memo.txt'? n
```

규칙은 두 가지다. 먼저 **`=` 양옆에 공백을 넣으면 안 된다.** 셸은 공백으로 단어를 나누기 때문에 `alias ll = 'ls -alF'`는 `ll`, `=`, `ls -alF`라는 인자 세 개로 읽히고, `alias`는 셋 다 "그런 alias는 없다"고 답한다.

```bash
$ alias ll = 'ls -alF'
bash: alias: ll: not found
bash: alias: =: not found
bash: alias: ls -alF: not found
```

다음으로 **명령어는 작은따옴표로 감싼다.** 공백이 든 명령어를 한 단어로 묶어야 하고, 큰따옴표를 쓰면 안의 변수가 정의하는 순간 펼쳐져 버린다.

```bash
# 정의할 때의 디렉터리로 굳어 버린다
$ alias here="echo $PWD"
# 실행할 때마다 현재 디렉터리를 읽는다
$ alias here='echo $PWD'
```

### 1.2 확인과 삭제

| 명령 | 하는 일 |
|:-----|:-----|
| `alias` | 정의된 alias 전체 출력 |
| `alias ll` | `ll`의 정의만 출력 |
| `type ll` | `ll`이 무엇인지 (alias, 내장, 파일 …) |
| `unalias ll` | `ll` 삭제 |
| `unalias -a` | 전부 삭제 |

```bash
$ type ll
ll is aliased to `ls -alF'
$ type cd
cd is a shell builtin
$ type -a ls
ls is aliased to `ls --color=auto'
ls is /usr/bin/ls
ls is /bin/ls
```

`type -a`는 그 이름으로 찾을 수 있는 후보를 **해석되는 순서대로** 전부 보여 준다. 우분투에서 `ls`가 이미 컬러 옵션 alias로 잡혀 있는 것도 여기서 드러난다(같은 파일이 두 번 나오는 건 `/bin`이 `/usr/bin`을 가리키는 링크라서다). 종류만 짧게 보고 싶으면 `type -t`를 쓴다.

| `type -t` 결과 | 뜻 | 예 |
|:-----|:-----|:-----|
| `alias` | alias | `ll` |
| `keyword` | 셸 문법의 예약어 | `if`, `for` |
| `function` | 셸 함수 | 1.4절의 `mkcd` |
| `builtin` | 셸에 내장된 명령어 | `cd`, `export` |
| `file` | 디스크의 실행 파일 | `ls`, `date` |

### 1.3 명령어 해석 순서와 alias 피해 가기

`type -a`의 순서가 곧 배시가 명령어 이름을 해석하는 순서다. 셋째 원리다.

```
$ ls -l
   │
   ▼
1) alias인가?   ── 예 → 펼친 뒤 계속
   │ 아니오
   ▼
2) 함수인가?    ── 예 → 함수 실행
   │ 아니오
   ▼
3) 내장인가?    ── 예 → 셸이 직접 실행
   │ 아니오
   ▼
4) PATH 탐색    ── 찾음 → 파일 실행
   │ 못 찾음
   ▼
command not found
```

`rm`을 `rm -i`로 alias해 두었는데 확인 없이 지우고 싶을 때처럼, alias를 잠깐 무시해야 할 때가 있다. 방법은 셋이고, 왜 통하는지는 모두 이 순서에서 나온다.

| 방법 | 예 | 왜 alias를 건너뛰나 |
|:-----|:-----|:-----|
| 역슬래시 | `\rm a.txt` | alias는 따옴표나 `\`가 붙지 않은 단어에만 펼쳐진다. `'rm'`도 같다 |
| `command` | `command rm a.txt` | 명령어 자리의 첫 단어가 `command`라서 `rm`은 alias 검사 대상이 아니다. 함수도 건너뛴다 |
| 전체 경로 | `/usr/bin/rm a.txt` | 이름에 `/`가 있으면 1~4단계 없이 그 파일을 바로 실행한다 |

{{< callout type="warning" >}}
**스크립트 안에서는 alias가 동작하지 않는다.** 비대화형 셸은 기본적으로 alias를 펼치지 않는다(`shopt expand_aliases`가 꺼져 있다). 또 alias는 한 줄을 다 읽은 뒤 펼쳐지므로, 같은 줄에서 정의하고 바로 쓰면 그 줄에서는 아직 없는 것으로 취급된다.

```bash
$ cat t.sh
alias hi='echo hello'
hi
$ bash t.sh
t.sh: line 2: hi: command not found
```
스크립트에서는 alias 대신 함수를 쓰자.
{{< /callout >}}

### 1.4 인자가 필요하면 함수로

alias는 이름을 문자열로 바꿔치기할 뿐이라, 인자를 명령어 **중간**에 끼워 넣을 수 없다. "디렉터리를 만들고 바로 들어가기"처럼 인자를 두 번 써야 하면 함수를 정의한다.

```bash
$ mkcd() { mkdir -p "$1" && cd "$1"; }
$ mkcd project/src
$ pwd
/home/kim/project/src
```

같은 내용을 `mkcd.sh` 스크립트로 만들어 실행하면 `cd`가 먹히지 않는다. 스크립트는 자식 프로세스에서 돌기 때문에 바뀌는 건 자식의 현재 디렉터리뿐이다. 함수는 지금 셸 안에서 실행되니 셸의 디렉터리가 바뀐다. 둘째 원리의 예고편이고, 4.1절에서 다시 만난다.

---

## 2. 셸 옵션: set과 shopt

배시의 동작을 켜고 끄는 스위치가 옵션이다. 명령이 둘로 나뉜 데는 역사적 이유가 있다. `set`은 배시의 조상인 본 셸(sh) 시절부터 있던, POSIX 표준이 정한 옵션을 다룬다. `shopt`(shell options)는 배시가 자기만의 옵션을 따로 담으려고 나중에 만든 명령이다. 그래서 둘은 이름 공간이 다르고, 서로의 옵션을 모른다. `shopt` 옵션을 `set`에 주면 아래처럼 오류가 나고, 반대도 마찬가지다.

```bash
$ set -o autocd
bash: set: autocd: invalid option name
```

### 2.1 set

```bash
set -o <옵션>   # 켜기
set +o <옵션>   # 끄기
set -o          # 전체 상태 보기
```

`-`가 켜기, `+`가 끄기라 직관과 반대다. 유닉스 명령어에서 옵션을 줄 때 `-`를 붙이는 관례를 따랐고(`bash -o noclobber`처럼 셸을 띄울 때도 같은 형식이다), 그것을 되돌리는 표시로 `+`를 쓴 것이다. "마이너스가 켜기"로 외워 두자.

| 옵션 | 짧은 형태 | 하는 일 | 왜 쓰나 |
|:-----|:--:|:-----|:-----|
| `ignoreeof` | - | `Ctrl+D`로 셸이 닫히지 않게 한다 | 원격 세션이 실수로 끊기는 것을 막는다 |
| `noclobber` | `-C` | `>`로 기존 파일을 덮어쓰지 못하게 한다 | 리다이렉트 오타 한 번에 파일이 날아가는 사고를 막는다 |
| `noglob` | `-f` | `*`, `?` 같은 경로 확장을 끈다 | 별표가 든 문자열을 셸이 건드리지 않고 그대로 넘긴다 |

**ignoreeof**: `Ctrl+D`는 "입력 끝(EOF)" 신호다. 셸 입장에서는 더 읽을 명령이 없다는 뜻이라 종료한다. 이 옵션을 켜면 경고만 하고 버틴다. 기본으로 10번 연속 받아야 종료하며, 횟수는 `IGNOREEOF` 변수로 바꾼다.

```bash
$ set -o ignoreeof
$                   # Ctrl+D
Use "exit" to leave the shell.
```

**noclobber**: 덮어쓰기만 막고, `>>`로 이어 붙이는 것은 그대로 된다. 정말 덮어써야 할 때는 `>|`를 쓴다.

```bash
$ set -o noclobber
$ echo hi > a
$ echo bye > a
bash: a: cannot overwrite existing file
$ echo bye >> a   # 추가는 된다
$ echo bye >| a   # 강제 덮어쓰기
```

**noglob**: 경로 확장은 명령어가 아니라 **셸**이 실행 전에 하는 일이다. 그래서 이 옵션을 켜면 `echo`는 별표를 글자 그대로 받는다.

```bash
$ echo *.txt
a.txt memo.txt
$ set -f
$ echo *.txt
*.txt
```

### 2.2 스크립트 첫머리의 set

셸 스크립트를 읽다 보면 첫 줄 근처에서 `set -euo pipefail`을 자주 보게 된다. 배시가 기본으로 너그럽게 넘어가는 실패들을 오류로 바꾸는 안전장치다.

| 옵션 | 하는 일 | 왜 필요한가 |
|:-----|:-----|:-----|
| `-e` | 명령이 실패하면 즉시 종료 | 기본은 실패해도 다음 줄로 넘어간다 |
| `-u` | 정의 안 된 변수를 쓰면 오류 | 오타 난 변수는 조용히 빈 문자열이 된다. `rm -rf "$DIR"/*`에서 `DIR`이 비면 끔찍하다 |
| `-o pipefail` | 파이프 중간 실패도 실패로 | 파이프의 결과는 기본이 마지막 명령의 결과다 |
| `-x` | 실행하는 명령을 펼친 모습으로 출력 | 디버깅 |

```bash
#!/bin/bash
set -euo pipefail
```

### 2.3 shopt

```bash
shopt -s <옵션>   # 켜기 (set)
shopt -u <옵션>   # 끄기 (unset)
shopt             # 전체 상태 보기
shopt <옵션>      # 하나만 보기
```

`-s`와 `-u`는 set과 unset의 머리글자다. 자주 쓰는 다섯 개는 모두 기본이 꺼져 있다.

| 옵션 | 하는 일 |
|:-----|:-----|
| `autocd` | 디렉터리 이름만 입력해도 그 디렉터리로 이동 |
| `cdspell` | `cd`의 디렉터리 이름 오타를 자동 교정 |
| `dotglob` | `*`, `?` 확장 결과에 `.`으로 시작하는 파일도 포함 |
| `globstar` | `**`가 하위 디렉터리까지 모든 경로에 매치 |
| `histappend` | 종료할 때 이력 파일을 덮어쓰지 않고 이어 붙임 |

**autocd, cdspell**: 대화형 셸에서만 동작한다. `autocd`는 실제로 `cd`를 대신 실행했다는 표시로 `cd -- 경로`를 찍고, `cdspell`은 글자가 뒤바뀌거나 하나 빠지거나 하나 더 들어간 정도의 오타를 고친 뒤 고친 경로를 보여 준다.

```bash
$ shopt -s autocd
$ /etc
cd -- /etc
$ shopt -s cdspell
$ cd /ect
/etc
```

**dotglob**: `.`으로 시작하는 파일은 관례상 설정 파일이라, 실수로 건드리지 않도록 와일드카드에서 빠져 있다. `dotglob`은 이 보호를 푼다. 켜더라도 `.`과 `..`는 끝까지 매치되지 않는다.

```bash
$ ls -a
.  ..  .bashrc  memo.txt
$ echo *
memo.txt
$ shopt -s dotglob
$ echo *
.bashrc memo.txt
```

**globstar**: 꺼져 있을 때 `**`는 `*`와 똑같아서 `**/*.md`는 "한 단계 아래의 `.md`"일 뿐이다. 켜면 `**/`가 "0개 이상의 디렉터리"를 뜻하게 되어 현재 디렉터리부터 모든 깊이를 훑는다.

```bash
$ echo **/*.md      # 꺼진 상태
docs/b.md
$ shopt -s globstar
$ echo **/*.md
a.md docs/api/c.md docs/b.md
```

**histappend**: 첫째 원리가 그대로 드러나는 옵션이다. 이력은 셸마다 **자기 메모리**에 쌓이다가 종료할 때 파일에 기록된다. 기본 동작은 덮어쓰기라서, 터미널 두 개를 열고 일하다 닫으면 나중에 닫힌 쪽의 이력만 남는다.

```
터미널 A ─┐ 각자 메모리에 이력
터미널 B ─┘
    │ 종료할 때 파일에 기록
    ▼
~/.bash_history
 꺼짐: 나중에 닫힌 쪽만 남는다
 켜짐: 둘 다 이어 붙는다
```

---

## 3. 셸 변수

### 3.1 만들고, 읽고, 지우기

셸 변수에는 숫자나 문자열을 담을 수 있다.

```bash
$ name=kim
$ greeting='hello world'
$ echo "$greeting, $name"
hello world, kim
$ echo "${name}_backup"
kim_backup
$ unset name
```

| 규칙 | 예 | 왜 |
|:-----|:-----|:-----|
| `=` 양옆에 공백 금지 | `name=kim` | `name = kim`은 `name`이라는 명령에 인자 `=`, `kim`을 준 것으로 읽힌다 |
| 값에 공백이 있으면 따옴표 | `msg='hello world'` | `msg=hello world`는 다른 뜻이 된다 (4.3절) |
| 읽을 때는 `$` | `echo $name` | `$`가 "이 이름을 값으로 바꿔라"는 표시다 |
| 경계가 모호하면 `${}` | `${name}_backup` | `$name_backup`은 `name_backup`이라는 다른 변수다 |
| 대소문자 구분 | `PS1` ≠ `Ps1` | 오타를 내도 오류 없이 새 변수가 생길 뿐이다 |

```bash
$ name = kim
bash: name: command not found
$ msg=hello world
bash: world: command not found
```

인자 없이 `set`을 실행하면 지금 셸의 변수가 (함수까지) 전부 나온다.

### 3.2 PS1: 프롬프트

프롬프트는 셸 변수 `PS1`의 값이다. 값을 바꾸면 바로 프롬프트가 바뀐다.

```bash
$ echo "$PS1"
\u@\h:\w\$
$ PS1='bash> '
bash> PS1='[\u@\h \W]\$ '
[kim@web01 ~]$
```

마지막에 공백을 하나 넣어 두는 이유는 입력하는 명령이 프롬프트에 붙지 않게 하기 위해서다. `\`로 시작하는 기호는 프롬프트를 **표시할 때마다** 배시가 해석한다. 아래 예시는 사용자 `kim`, 호스트 `web01.example.com`, 현재 디렉터리 `/var/log` 기준이다.

| 기호 | 내용 | 예 |
|:--:|:-----|:-----|
| `\u` | 사용자 이름 | `kim` |
| `\h` | 호스트 이름 (첫 `.` 앞까지) | `web01` |
| `\H` | 호스트 이름 전체 | `web01.example.com` |
| `\w` | 현재 디렉터리 전체 경로 (홈은 `~`) | `/var/log` |
| `\W` | 현재 디렉터리의 마지막 이름만 | `log` |
| `\d` | 날짜 (요일 월 일) | `Tue Oct 20` |
| `\t` | 24시간제 시각 HH:MM:SS | `22:34:56` |
| `\n` | 줄바꿈 | |
| `\$` | root면 `#`, 아니면 `$` | `$` |
| `\\` | 역슬래시 자체 | `\` |

{{< callout type="warning" >}}
**PS1은 작은따옴표로 감싼다.** 큰따옴표 안에서 `\$`는 셸이 대입하는 순간 `$`로 바꿔 버린다. 그러면 프롬프트에 남는 건 그냥 `$`라서 root가 되어도 `#`로 바뀌지 않는다. `$PWD` 같은 변수도 큰따옴표면 대입 시점의 값으로 굳는다.

```bash
$ PS1="\u \$ "; echo "$PS1"
\u $
$ PS1='\u \$ '; echo "$PS1"
\u \$
```
{{< /callout >}}

색을 넣을 때는 색 코드를 `\[`와 `\]`로 감싼다.

```bash
PS1='\[\e[32m\]\u@\h\[\e[0m\]:\w\$ '
```

`\e[32m`은 초록색 시작, `\e[0m`은 원래 색으로 복귀하라는 터미널 제어 문자다. 화면에 글자로 찍히지는 않는데, 배시는 그걸 모르고 글자 수에 포함해 프롬프트 길이를 계산한다. `\[ \]`는 "이 사이는 자리를 차지하지 않는다"고 알려 주는 표시이고, 빠뜨리면 긴 명령을 칠 때 줄이 엉뚱한 곳에서 꺾인다.

덧붙여 따옴표를 닫지 않고 Enter를 치면 나오는 `> `는 `PS2`, 이어지는 줄의 프롬프트다.

### 3.3 PATH: 명령어를 찾는 경로

`PATH`에는 명령어를 찾을 디렉터리가 `:`로 이어져 있다.

```bash
$ echo $PATH
/usr/local/bin:/usr/bin:/bin
```

배시는 1.3절의 4단계에서 이 디렉터리들을 **앞에서부터** 뒤지고, 처음 찾은 파일을 실행한 뒤 멈춘다.

```
$ python3
   │
   ▼
/usr/local/bin ── 없음
   │
   ▼
/usr/bin       ── 있음 → 실행
   │
   ▼  (여기서 멈춘다)
/bin           ── 보지 않음
```

그래서 디렉터리를 추가할 때는 위치가 의미를 가진다.

| 형태 | 효과 |
|:-----|:-----|
| `PATH="$HOME/bin:$PATH"` | 내 디렉터리가 먼저. 이름이 같으면 내 것이 이긴다 |
| `PATH="$PATH:$HOME/bin"` | 시스템이 먼저. 내 것은 시스템에 없을 때만 쓰인다 |

같은 이름의 후보가 어디 어디 있는지는 `type -a python3`이나 `which -a python3`으로 확인한다.

**현재 디렉터리는 PATH에 없다.** 보안 때문이다. 누군가 `/tmp`에 `ls`라는 이름의 악성 스크립트를 놓아두었는데 PATH 맨 앞에 `.`이 있다면, `/tmp`에서 `ls`를 치는 순간 그 스크립트가 실행된다. 그래서 현재 디렉터리의 프로그램은 `./script.sh`처럼 실행한다. 이름에 `/`가 들어가면 PATH 탐색 자체를 건너뛰기 때문이다.

**배시는 찾은 위치를 기억한다.** 명령을 실행할 때마다 PATH를 다 뒤지면 느리니, 한 번 찾은 경로를 해시 테이블에 넣어 둔다. 그래서 같은 이름의 새 버전을 PATH 앞쪽에 설치했는데도 옛 버전이 실행되거나, 옮긴 프로그램을 옛 경로에서 찾다가 `No such file or directory`가 나는 일이 생긴다. 이때는 `hash -r`로 기억을 비운다. `PATH`에 새 값을 대입하면 자동으로 비워진다.

```bash
$ hash
hits    command
   3    /usr/bin/ls
$ hash -r
```

{{< callout type="warning" >}}
`PATH="/home/kim/bin"`처럼 기존 값을 빼고 덮어쓰면 `ls`조차 찾지 못한다([02장](../02-shell) 10절). 이미 저질렀다면 `export PATH=/usr/bin:/bin`으로 되돌리거나, `/usr/bin/vim`처럼 전체 경로로 명령을 실행해 설정 파일을 고친다.
{{< /callout >}}

### 3.4 LANG: 로케일

언어, 날짜 형식, 정렬 순서 같은 지역별 규칙의 묶음을 **로케일**이라 한다. 지금 로케일은 `LANG`에 들어 있고, 형식은 `언어_지역.인코딩`이다.

```bash
$ echo $LANG
ko_KR.UTF-8
$ locale -a       # 설치된 로케일
C
C.utf8
en_US.utf8
ko_KR.utf8
POSIX
```

`locale -a`는 `utf8`로, `LANG`에는 `UTF-8`로 적혀 있어도 같은 것으로 취급된다. 목록에 없는 로케일은 우분투라면 `sudo locale-gen ko_KR.UTF-8`로 만든다. 로케일에 따라 같은 명령의 출력이 달라진다.

```bash
$ LANG=ko_KR.UTF-8 date
2026. 10. 20. (화) 22:34:56 KST
$ LANG=C date
Tue Oct 20 22:34:56 KST 2026
```

| 변수 | 범위 | 우선순위 |
|:-----|:-----|:--:|
| `LC_ALL` | 모든 항목을 강제로 | 1 |
| `LC_TIME`, `LC_MESSAGES` 등 | 해당 항목 하나 | 2 |
| `LANG` | 나머지 전부의 기본값 | 3 |

`LANG`을 바꿨는데 반영이 안 되면 `LC_ALL`이 설정돼 있지 않은지 `locale` 명령으로 확인한다.

{{< callout type="info" >}}
**실무 팁 두 가지.** 오류 메시지를 검색할 때는 `LANG=C <명령>`으로 영어 메시지를 받아 검색하면 자료가 훨씬 많다. 또 `sort`나 `ls`의 정렬 순서는 로케일에 따라 다르다(C는 바이트 순서, 그 외는 대소문자·기호를 무시하는 사전 순서). 서버마다 스크립트 결과 순서가 다르면 로케일을 의심하고 `LC_ALL=C sort`처럼 고정한다.
{{< /callout >}}

### 3.5 그 외의 셸 변수

**이력 관련**

| 변수 | 내용 | 기본값 |
|:-----|:-----|:-----|
| `HISTFILE` | 이력을 저장할 파일 | `~/.bash_history` |
| `HISTSIZE` | 메모리에 둘 이력 개수 | 500 (우분투 `.bashrc`는 1000) |
| `HISTFILESIZE` | 파일에 남길 줄 수 | 500 (우분투 `.bashrc`는 2000) |

두 크기 변수가 따로 있는 이유는 이력이 두 곳에 있기 때문이다.

```
 셸 시작
   │ ~/.bash_history 읽기
   ▼
┌────────────────────┐
│ 메모리 이력        │ ← HISTSIZE개
└─────────┬──────────┘
          │ 셸 종료 시 기록
          ▼
┌────────────────────┐
│ ~/.bash_history    │ ← HISTFILESIZE줄
└────────────────────┘
```

비밀번호가 들어간 명령을 쳤다면 `unset HISTFILE`로 이번 세션의 이력을 아예 저장하지 않게 할 수 있다. 중복 제거나 시간 기록 같은 설정은 [03장](../03-shell-advanced) 7절에 정리해 두었다.

**셸 상태 관련**

| 변수 | 내용 | 예 |
|:-----|:-----|:-----|
| `HOME` | 홈 디렉터리. `~`와 인자 없는 `cd`가 여기로 간다 | `/home/kim` |
| `SHELL` | **로그인 셸**의 경로 | `/bin/bash` |
| `PWD` | 현재 디렉터리. `cd`할 때마다 바뀐다 | `/var/log` |
| `OLDPWD` | 직전 디렉터리. `cd -`가 여기로 간다 | `/home/kim` |

`SHELL`은 지금 쓰고 있는 셸이 아니다. 배시에서 `zsh`를 실행해도 `$SHELL`은 여전히 `/bin/bash`다. 지금 셸은 `echo $0`으로 확인한다.

---

## 4. 환경 변수

### 4.1 외부 명령어는 셸 변수를 못 본다

명령어에는 셸 자체에 들어 있는 **내장 명령어**와 파일 시스템에 실행 파일로 존재하는 **외부 명령어**가 있다. `type`으로 구분한다.

```bash
$ type cd
cd is a shell builtin
$ type date
date is /usr/bin/date
```

외부 명령어를 실행하면 셸은 자기를 복제해 자식 프로세스를 만들고(fork), 그 자리에 프로그램을 올린다(exec). exec하는 순간 메모리는 새 프로그램으로 통째로 바뀌고, 넘어가는 것은 인자와 **환경**이라는 문자열 목록뿐이다. 셸 변수는 배시 내부의 자료라 넘어가지 못한다. 외부 명령어도 참고할 수 있도록 환경에 올린 변수가 **환경 변수**다. 둘째 원리다.

```
┌──────────────────────┐
│ bash (부모)          │
│  셸 변수   MSG=hi    │
│  환경 변수 LANG=...  │
└──────────┬───────────┘
           │ fork + exec
           │ 환경 변수만 복사
           ▼
┌──────────────────────┐
│ date (자식)          │
│  환경 변수 LANG=...  │
│  MSG는 모른다        │
└──────────────────────┘
```

같은 이유로 **셸 자신의 상태를 바꾸는 명령은 모두 내장일 수밖에 없다.** 외부 프로그램은 자식 프로세스라 자기 상태만 바꾸고 사라지니까.

| 내장이어야 하는 명령 | 바꾸는 것 |
|:-----|:-----|
| `cd` | 셸의 현재 디렉터리 |
| `export`, `unset` | 셸의 변수 |
| `alias`, `unalias` | 셸의 alias 목록 |
| `set`, `shopt` | 셸의 옵션 |
| `source` | 셸 안에서 파일 실행 (5.4절) |
| `exit` | 셸 자신 |

### 4.2 export: 환경 변수로 만들기

```bash
export NAME        # 셸 변수 → 환경 변수
export NAME=value  # 만들면서 바로
export -n NAME     # 표시만 해제
unset NAME         # 변수 자체를 삭제
```

`bash -c`로 새 배시를 자식으로 띄워 보면 차이가 바로 보인다. 작은따옴표를 쓴 이유는 부모가 아니라 자식이 `$MSG`를 펼치게 하려는 것이다.

```bash
$ MSG=hello
$ bash -c 'echo "[$MSG]"'
[]
$ export MSG
$ bash -c 'echo "[$MSG]"'
[hello]
```

자식이 받는 것은 **복사본**이라, 자식이 값을 바꿔도 부모는 그대로다.

```bash
$ bash -c 'MSG=changed'
$ echo $MSG
hello
```

`export`는 값을 어딘가로 보내는 명령이 아니라 변수에 "자식에게 넘길 것"이라는 **표시**를 다는 명령이다. 그래서 한 번 export한 뒤 값을 바꾸면 자식은 바뀐 값을 받는다.

```bash
$ export MSG=hello
$ MSG=bye
$ bash -c 'echo $MSG'
bye
```

`declare -p`로 보면 이 표시가 `-x` 속성으로 드러난다.

```bash
$ city=seoul
$ declare -p city
declare -- city="seoul"
$ export city
$ declare -p city
declare -x city="seoul"
```

### 4.3 한 명령에만 환경 변수 주기

명령 앞에 `변수=값`을 붙이면 **그 명령의 환경에만** 변수가 들어가고, 셸에는 남지 않는다.

```bash
$ TZ=UTC date
Tue Oct 20 13:34:56 UTC 2026
$ TZ=Asia/Seoul date
Tue Oct 20 22:34:56 KST 2026
$ echo "[$TZ]"
[]
```

3.1절의 `msg=hello world`가 `world: command not found`를 낸 이유가 이것이다. 배시는 이 줄을 "`msg=hello`를 환경에 넣고 `world`를 실행하라"로 읽었다. 3.4절의 `LANG=C date`도 같은 형태다.

### 4.4 확인: printenv, env, set

| 명령 | 보여 주는 것 |
|:-----|:-----|
| `printenv` | 환경 변수 전체 |
| `printenv HOME` | 환경 변수 하나 (`$` 없이 이름만) |
| `env` | 환경 변수 전체. 본래 용도는 환경을 바꿔 명령을 실행하는 것 |
| `set` | 셸 변수, 환경 변수, 함수 전부 |
| `declare -p 이름` | 변수 하나의 값과 속성 |

```bash
$ fruit=apple
$ set | grep ^fruit
fruit=apple
$ printenv fruit     # 출력 없음
$ export fruit
$ printenv fruit
apple
```

| 구분 | 셸 변수 | 환경 변수 |
|:-----|:-----|:-----|
| 보이는 범위 | 지금 셸 안 | 지금 셸 + 이후 실행하는 모든 자식 |
| 만드는 법 | `NAME=value` | `export NAME=value` |
| 확인 | `set`, `echo $NAME` | `printenv`, `env` |
| 대표 예 | `PS1`, `HISTSIZE` | `PATH`, `HOME`, `LANG` |
| 왜 이쪽인가 | 배시만 읽는 설정이다 | 다른 프로그램도 읽어야 한다 |

`PS1`이 셸 변수로 충분한 이유도 여기 있다. 프롬프트를 읽는 건 배시뿐이고, 자식 배시는 어차피 자기 `.bashrc`에서 `PS1`을 다시 정한다.

{{< callout type="info" >}}
**내 변수는 소문자로.** 환경 변수와 배시의 특수 변수는 대문자가 관례다. 스크립트에서 만드는 변수를 소문자로 지으면 `PATH`, `HOME` 같은 중요한 변수를 실수로 덮어쓸 일이 없다.
{{< /callout >}}

---

## 5. 배시 설정 파일

지금까지 만든 alias, 옵션, 변수는 전부 지금 셸의 메모리에만 있다. 셸이 끝나면 사라지고, 새 터미널에는 처음부터 없다. 첫째 원리다. 다음에도 쓰려면 **셸이 시작할 때 자동으로 실행되는 파일**에 적어 두어야 한다.

### 5.1 어떤 파일이 언제 읽히나

로그인 셸과 비로그인 셸의 구분은 [02장](../02-shell) 4절에서 봤다. 어떤 셸로 시작하느냐에 따라 읽는 파일이 다르다.

```
로그인 셸 (SSH 접속, 콘솔 로그인)
  /etc/profile
     │
     ▼
  ~/.bash_profile ┐ 셋 중
  ~/.bash_login   ├ 처음 찾은
  ~/.profile      ┘ 하나만
     │ (보통 그 안에서 호출)
     ▼
  ~/.bashrc

비로그인 셸 (터미널 창, bash 실행)
  ~/.bashrc

스크립트 (bash a.sh)
  아무것도 읽지 않는다
```

| 파일 | 범위 | 읽히는 때 |
|:-----|:-----|:-----|
| `/etc/profile` | 시스템 전체 | 로그인할 때 |
| `~/.profile` (또는 `~/.bash_profile`) | 사용자별 | 로그인할 때 |
| `~/.bashrc` | 사용자별 | 대화형 배시가 뜰 때마다 |

데스크톱 리눅스의 터미널 창은 대부분 비로그인 셸로, SSH 접속은 로그인 셸로 뜬다. 데비안·우분투는 비로그인 셸에서 `~/.bashrc`보다 먼저 `/etc/bash.bashrc`도 읽는다.

로그인 셸에서도 `~/.bashrc`가 적용되는 건 배포판이 `~/.profile` 안에 호출 코드를 넣어 두었기 때문이다. 우분투의 기본 `~/.profile`에는 이런 부분이 있다.

```bash
# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi
```

{{< callout type="warning" >}}
**우분투에서 `~/.bash_profile`을 새로 만들면 `~/.profile`이 읽히지 않는다.** 셋 중 처음 찾은 하나만 읽기 때문이다. 그러면 `~/.profile`에 있던 `~/.bashrc` 호출도 사라져, 터미널 창에서는 되던 alias가 SSH로 접속하면 안 되는 이상한 상황이 된다. `~/.bash_profile`을 만들어야 한다면 첫 줄에 `. ~/.profile`을 넣어 둔다.
{{< /callout >}}

### 5.2 무엇을 어디에 적나

`~/.profile`은 로그인할 때 한 번, `~/.bashrc`는 배시가 뜰 때마다 읽힌다. 이 차이와 둘째 원리를 합치면 나눌 기준이 나온다.

| 설정 | 파일 | 왜 |
|:-----|:-----|:-----|
| 환경 변수 (`PATH`, `EDITOR`) | `~/.profile` | 자식에게 상속되므로 로그인할 때 한 번이면 된다 |
| alias, 함수 | `~/.bashrc` | 상속되지 않으므로 셸마다 새로 정의해야 한다 |
| `PS1`, `set`, `shopt` | `~/.bashrc` | 셸 변수와 옵션도 상속되지 않는다 |
| 모든 사용자 공통 | `/etc/profile.d/*.sh` | `/etc/profile`은 배포판이 관리하는 파일이라 업데이트 때 충돌한다. `/etc/profile`이 이 디렉터리의 파일을 읽어 준다 |

실제로는 전부 `~/.bashrc`에 적어도 대개 잘 돌아간다. 로그인 셸도 `~/.profile`을 거쳐 `~/.bashrc`를 읽기 때문이다. 다만 `PATH="$HOME/bin:$PATH"`처럼 **기존 값에 덧붙이는** 설정은 `~/.bashrc`가 읽힐 때마다 같은 경로가 또 붙는다(5.4절).

### 5.3 수정 전 안전장치

설정 파일을 잘못 고치면 셸이 아예 뜨지 않을 수 있다. 수정 전에 세 가지를 해 둔다.

**1. 백업한다.**

```bash
$ cp ~/.bashrc ~/.bashrc.bak
```

우분투라면 처음 상태의 원본이 `/etc/skel/.bashrc`에 있다. 백업을 잊었어도 여기서 복사해 오면 된다.

**2. 터미널을 하나 더 열어 둔 채로 고친다.** 이미 떠 있는 셸은 설정 파일을 다시 읽지 않는다. 첫째 원리 덕분에 열어 둔 셸은 망가진 설정의 영향을 받지 않는 구조대가 된다. 수정 후 **새 터미널**을 열어 확인하고, 문제가 있으면 열어 둔 셸에서 백업을 되돌린다.

**3. 문법을 먼저 검사한다.**

```bash
$ bash -n ~/.bashrc   # 실행 없이 문법만
```

| 실수 | 증상 | 복구 |
|:-----|:-----|:-----|
| `exit`를 적음 | 터미널이 열리자마자 닫힌다 | 열어 둔 셸에서 백업 복원 |
| `PATH`를 덮어씀 | `ls: command not found` | `/usr/bin/cp`처럼 전체 경로로 복원 |
| 안에서 `bash`를 실행 | 새 셸이 또 `.bashrc`를 읽어 끝없이 셸을 띄운다 | `bash --norc`로 설정 없이 띄워서 수정 |

### 5.4 source: 지금 셸에 반영하기

Vim으로 `~/.bashrc`를 열어 마지막 줄에 프롬프트 설정을 추가해 보자.

```bash
PS1='[\u@\h] \w \t \$ '
```

변수 이름의 대소문자를 틀려 `Ps1`이라고 적으면 오류 없이 `Ps1`이라는 엉뚱한 변수가 생길 뿐이니 주의하자(3.1절). 저장한 뒤 다시 로그인하면 반영되지만, `source`를 쓰면 바로 반영된다.

```bash
$ source ~/.bashrc
[kim@web01] ~ 22:34:56 $
```

`source`는 파일을 읽어 **지금 셸에서** 한 줄씩 실행한다. 그 내용을 커맨드 라인에 직접 친 것과 같다. `.`은 같은 명령의 POSIX 이름이라 `. ~/.bashrc`도 같다.

`bash ~/.bashrc`로 실행하면 안 되는 이유는 둘째 원리 그대로다.

```bash
$ echo "alias hi='echo hello'" > a.sh
$ bash a.sh
$ hi
bash: hi: command not found
$ source a.sh
$ hi
hello
```

| 실행 방법 | 어디서 실행되나 | 결과 |
|:-----|:-----|:-----|
| `bash a.sh`, `./a.sh` | 새 자식 배시 | 자식이 끝나면 설정도 같이 사라진다 |
| `source a.sh`, `. a.sh` | 지금 셸 | 지금 셸에 그대로 남는다 |

1.4절의 `mkcd`를 스크립트가 아닌 함수로 만든 것, `cd`가 내장 명령어인 것과 같은 이야기다.

{{< callout type="info" >}}
`source`는 파일 전체를 **다시** 실행하므로, 기존 값에 덧붙이는 설정은 할 때마다 쌓인다.

```bash
$ echo $PATH
/home/kim/bin:/usr/bin
$ source ~/.bashrc
$ echo $PATH
/home/kim/bin:/home/kim/bin:/usr/bin
```
중복 자체는 해가 없지만 지저분하다. 신경 쓰인다면 이미 들어 있을 때는 건너뛰게 한다.

```bash
case ":$PATH:" in
  *":$HOME/bin:"*) ;;
  *) PATH="$HOME/bin:$PATH" ;;
esac
```
{{< /callout >}}

### 5.5 주석

배시에서는 `#`부터 줄 끝까지가 주석이다. 단, `#`이 **단어의 맨 앞**에 있을 때만이다. 단어 중간이나 따옴표 안의 `#`은 그냥 글자다.

```bash
$ echo a #b
a
$ echo a#b
a#b
$ echo 'a #b'
a #b
```

설정 파일에는 나중의 나를 위해 "왜 이렇게 했는지"를 주석으로 남겨 두자. 이 장의 내용을 모으면 이런 모양이 된다.

```bash
# ~/.bashrc 끝에 추가
# ── alias ──
alias ll='ls -alF'
alias rm='rm -i'   # 지우기 전에 확인

# ── 옵션 ──
set -o noclobber   # > 덮어쓰기 방지
shopt -s autocd cdspell globstar
shopt -s histappend  # 이력 이어 붙이기

# ── 이력 ──
HISTSIZE=10000
HISTFILESIZE=20000

# ── 프롬프트 ──
PS1='[\u@\h \W]\$ '

# ── 함수 ──
mkcd() { mkdir -p "$1" && cd "$1"; }
```

```bash
# ~/.profile 끝에 추가
export EDITOR=vim
export PATH="$HOME/tools:$PATH"
```

---

## 핵심 정리

| 항목 | 핵심 | 왜 |
|:-----|:-----|:-----|
| alias | `alias 이름='명령'`, `=` 양옆 공백 금지 | 셸은 공백으로 인자를 나눈다 |
| 해석 순서 | alias → 함수 → 내장 → PATH | `type -a`가 이 순서로 보여 준다 |
| alias 피하기 | `\rm`, `command rm`, `/usr/bin/rm` | 따옴표, 첫 단어 아님, `/` 포함은 각각 앞 단계를 건너뛴다 |
| 함수 | 인자가 필요하면 alias 대신 | 지금 셸에서 실행되어 `cd`도 반영된다 |
| set / shopt | POSIX 옵션 / 배시 전용 옵션 | 출신이 달라 이름 공간이 다르다 |
| 셸 변수 | `name=value`, 지금 셸에만 | 배시 내부 자료라 자식에게 넘어가지 않는다 |
| PS1 | 작은따옴표로 | 표시할 때마다 해석되어야 한다 |
| PATH | 앞에서부터 탐색, 처음 찾은 것 실행 | 앞에 둔 디렉터리가 이긴다. 현재 디렉터리는 보안상 없다 |
| LANG | 로케일. `LC_ALL`이 가장 강하다 | 날짜, 메시지, 정렬 순서가 바뀐다 |
| 환경 변수 | `export`로 자식에게 넘길 표시 | 외부 명령어는 환경만 물려받는다 |
| `VAR=값 명령` | 그 명령에만 환경 변수 | 셸에는 남지 않는다 |
| 설정 파일 | 환경 변수는 `~/.profile`, 나머지는 `~/.bashrc` | 상속되는 것은 한 번, 안 되는 것은 셸마다 |
| source | 지금 셸에서 파일 실행 | `bash`로 실행하면 자식에서 끝나고 사라진다 |

{{< callout type="info" >}}
**용어 정리**
- **alias**: 명령어에 붙인 별명. 대화형 셸에서만 펼쳐진다
- **내장 명령어 / 외부 명령어**: 셸 안에 들어 있는 명령 / 디스크의 실행 파일로 존재해 자식 프로세스로 실행되는 명령
- **셸 옵션**: 셸의 동작을 켜고 끄는 스위치. `set -o`(POSIX)와 `shopt -s`(배시 전용)로 다룬다
- **셸 변수**: 지금 셸 안에서만 보이는 변수
- **환경 변수**: `export` 표시가 붙어 자식 프로세스에 복사본으로 넘어가는 변수
- **PATH**: 외부 명령어를 찾을 디렉터리 목록. 앞에서부터 탐색한다
- **로케일**: 언어, 날짜 형식, 정렬 순서 같은 지역별 규칙의 묶음. `LANG`, `LC_*`로 정한다
- **로그인 셸 / 비로그인 셸**: 로그인할 때 뜨는 첫 셸 / 그 뒤에 여는 셸. 읽는 설정 파일이 다르다
- **source (`.`)**: 파일을 지금 셸에서 실행하는 내장 명령어
{{< /callout >}}
