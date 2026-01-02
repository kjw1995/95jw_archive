---
title: "05. 파일 조작의 기본"
weight: 5
---

## 1. mkdir - 디렉터리 만들기

### 기본 사용법

```bash
mkdir [옵션] <디렉터리명>
```

```bash
# 디렉터리 생성
$ mkdir work

# 여러 디렉터리 한번에
$ mkdir dir1 dir2 dir3
```

### 이미 존재하는 경우

```bash
$ mkdir work
mkdir: 'work' 디렉터리를 만들 수 없습니다: 파일이 있습니다.
```

> 리눅스에서는 디렉터리와 파일을 동일하게 취급하므로, 같은 이름의 파일이 있어도 에러 발생

### 중첩 디렉터리 만들기 (-p)

```bash
# 에러 발생 - 중간 경로가 없음
$ mkdir a/b/c
mkdir: 'a/b/c' 디렉터리를 만들 수 없습니다: 그런 파일이나 디렉터리가 없습니다

# -p 옵션으로 해결
$ mkdir -p a/b/c
```

| 옵션 | 설명 |
|:----:|------|
| `-p` | 부모 디렉터리도 함께 생성 |
| `-v` | 생성 과정 출력 |
| `-m` | 권한 지정 |

```bash
# 자세한 출력
$ mkdir -pv project/src/main
mkdir: 'project' 디렉터리를 생성함
mkdir: 'project/src' 디렉터리를 생성함
mkdir: 'project/src/main' 디렉터리를 생성함

# 권한 지정하여 생성
$ mkdir -m 755 mydir
```

---

## 2. touch - 파일 만들기

### 기본 사용법

```bash
touch <파일명>
```

```bash
# 빈 파일 생성
$ touch file.txt

# 여러 파일 한번에
$ touch file1.txt file2.txt file3.txt
```

### touch의 본래 목적

> touch는 원래 **타임스탬프 갱신** 명령어

```bash
# 파일 시간 확인
$ ls -l file.txt
-rw-r--r-- 1 user user 100 Jan  1 10:00 file.txt

# touch로 시간 갱신
$ touch file.txt

$ ls -l file.txt
-rw-r--r-- 1 user user 100 Jan  2 15:30 file.txt
```

### 특징

- 파일이 없으면 **빈 파일 생성**
- 파일이 있으면 **시간만 갱신** (내용 유지)
- 내용이 지워지지 않아 안전

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-a` | 접근 시간만 변경 |
| `-m` | 수정 시간만 변경 |
| `-t` | 특정 시간으로 설정 |
| `-r` | 다른 파일과 같은 시간으로 |

```bash
# 특정 시간으로 설정 (YYYYMMDDhhmm)
$ touch -t 202401011200 file.txt

# 다른 파일과 같은 시간으로
$ touch -r reference.txt target.txt
```

---

## 3. rm - 파일 삭제

### 기본 사용법

```bash
rm [옵션] <파일>
```

```bash
# 단일 파일 삭제
$ rm file.txt

# 여러 파일 삭제
$ rm file1 file2 file3
```

### 와일드카드로 삭제

```bash
# 모든 .html 파일 삭제
$ rm *.html

# log로 시작하는 파일 삭제
$ rm log*

# 특정 패턴 삭제
$ rm file[1-5].txt
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-i` | 삭제 전 확인 |
| `-f` | 강제 삭제 (확인 안 함) |
| `-r` | 디렉터리 재귀 삭제 |
| `-v` | 삭제 과정 출력 |

### 확인 후 삭제 (-i)

```bash
$ rm -i file.txt
rm: 일반 파일 'file.txt'를 제거할까요? y
```

> 리눅스는 휴지통이 없어 삭제하면 복구 어려움. `-i` 옵션 권장

### 디렉터리 삭제 (-r)

```bash
# 디렉터리와 내부 모든 내용 삭제
$ rm -r mydir

# 확인하며 삭제
$ rm -ri mydir

# 강제 삭제 (매우 주의!)
$ rm -rf mydir
```

### 위험한 명령어 주의

```bash
# 절대 실행 금지!
$ rm -rf /           # 시스템 전체 삭제
$ rm -rf /*          # 루트 아래 모든 것 삭제
$ rm -rf ~           # 홈 디렉터리 전체 삭제
$ rm -rf .           # 현재 디렉터리 전체 삭제
```

---

## 4. rmdir - 빈 디렉터리 삭제

### 기본 사용법

```bash
rmdir <디렉터리>
```

```bash
# 빈 디렉터리만 삭제 가능
$ rmdir emptydir

# 비어있지 않으면 에러
$ rmdir mydir
rmdir: 'mydir' 디렉터리를 제거하지 못했습니다: 디렉터리가 비어있지 않습니다
```

### rm -r과의 차이

| 명령어 | 동작 |
|--------|------|
| `rmdir` | 빈 디렉터리만 삭제, 안전 |
| `rm -r` | 내용 포함 모두 삭제, 위험 |

```bash
# 안전하게 삭제하려면 rmdir 사용
$ rmdir old_backup    # 비어있으면 삭제, 아니면 에러

# 중첩된 빈 디렉터리 삭제
$ rmdir -p a/b/c      # c, b, a 순서로 삭제 (모두 비어있어야 함)
```

---

## 5. cat - 파일 내용 출력

### 기본 사용법

```bash
cat [옵션] <파일>
```

```bash
# 파일 내용 출력
$ cat file.txt

# 여러 파일 연결 출력
$ cat file1.txt file2.txt
```

### 명령어 이름의 유래

> **cat** = con**cat**enate (연결하다)

```bash
# 여러 파일을 하나로 연결
$ cat header.txt body.txt footer.txt > combined.txt
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-n` | 행 번호 표시 |
| `-b` | 빈 줄 제외 번호 |
| `-s` | 연속 빈 줄을 하나로 |
| `-A` | 특수문자 표시 |

```bash
# 행 번호와 함께 출력
$ cat -n file.txt
     1  Hello
     2  World
     3
     4  Linux

# 빈 줄 제외하고 번호
$ cat -b file.txt
     1  Hello
     2  World

     3  Linux
```

### 파일 미지정 시 동작

```bash
# 키보드 입력을 그대로 출력 (Ctrl+D로 종료)
$ cat
hello    # 입력
hello    # 출력
```

### 활용 예시

```bash
# 파일 생성 (간단한 내용)
$ cat > newfile.txt
내용 입력
Ctrl+D

# 파일에 추가
$ cat >> file.txt
추가할 내용
Ctrl+D

# 파일 합치기
$ cat part1.txt part2.txt > whole.txt
```

---

## 6. less - 페이지 단위로 보기

### 기본 사용법

```bash
less [옵션] <파일>
```

```bash
# 긴 파일을 페이지 단위로
$ less /var/log/syslog
```

> 긴 파일을 볼 때는 `cat`보다 `less` 권장

### 스크롤 명령어

| 키 | 동작 |
|:--:|------|
| `Space`, `f` | 한 화면 아래로 |
| `b` | 한 화면 위로 |
| `j`, `Enter` | 한 줄 아래로 |
| `k` | 한 줄 위로 |
| `g` | 파일 처음으로 |
| `G` | 파일 끝으로 |
| `q` | 종료 |

### 검색 명령어

| 키 | 동작 |
|:--:|------|
| `/문자열` | 아래 방향 검색 |
| `?문자열` | 위 방향 검색 |
| `n` | 다음 검색 결과 |
| `N` | 이전 검색 결과 |

```bash
# less 실행 중
/error    # "error" 검색
n         # 다음 결과로 이동
N         # 이전 결과로 이동
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-N` | 행 번호 표시 |
| `-S` | 긴 줄 자르기 (줄바꿈 안 함) |
| `-i` | 검색 시 대소문자 무시 |
| `+F` | tail -f 처럼 실시간 추적 |

```bash
# 행 번호와 함께
$ less -N file.txt

# 로그 실시간 추적 (Ctrl+C로 중단)
$ less +F /var/log/syslog
```

---

## 7. cp - 파일/디렉터리 복사

### 기본 사용법

```bash
cp [옵션] <원본> <대상>
cp [옵션] <원본들> <디렉터리>
```

### 파일 복사

```bash
# 파일 복사
$ cp original.txt copy.txt

# 다른 디렉터리로 복사
$ cp file.txt /tmp/

# 다른 이름으로 복사
$ cp file.txt /tmp/newname.txt

# 여러 파일을 디렉터리로
$ cp file1.txt file2.txt file3.txt /backup/
```

### 디렉터리 복사 (-r)

```bash
# 디렉터리 복사 (재귀적)
$ cp -r srcdir destdir

# srcdir이 destdir 안에 복사됨
$ cp -r project /backup/
# 결과: /backup/project/
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-r` | 디렉터리 재귀 복사 |
| `-i` | 덮어쓰기 전 확인 |
| `-f` | 강제 덮어쓰기 |
| `-p` | 권한, 시간 유지 |
| `-a` | 아카이브 (모든 속성 유지) |
| `-v` | 복사 과정 출력 |

### 덮어쓰기 주의

```bash
# 같은 이름 있으면 덮어씀 (주의!)
$ cp new.txt existing.txt

# 확인 후 덮어쓰기
$ cp -i new.txt existing.txt
cp: 'existing.txt'를 덮어쓸까요? y
```

### 속성 유지 복사

```bash
# 권한, 소유자, 시간 유지
$ cp -p source.txt dest.txt

# 모든 속성 유지 (백업용)
$ cp -a /home/user /backup/
```

---

## 8. mv - 파일 이동/이름 변경

### 기본 사용법

```bash
mv [옵션] <원본> <대상>
```

### 파일 이동

```bash
# 파일 이동
$ mv file.txt /tmp/

# 여러 파일 이동
$ mv file1.txt file2.txt /backup/

# 이동하면 원래 위치에서 사라짐
```

### 이름 변경

```bash
# 같은 위치에서 이름만 변경
$ mv oldname.txt newname.txt

# 디렉터리 이름 변경
$ mv old_project new_project
```

### 이동 + 이름 변경

```bash
# 다른 위치로 이동하면서 이름도 변경
$ mv report.txt /archive/report_2024.txt
```

### 주요 옵션

| 옵션 | 설명 |
|:----:|------|
| `-i` | 덮어쓰기 전 확인 |
| `-f` | 강제 덮어쓰기 |
| `-n` | 덮어쓰기 안 함 |
| `-v` | 이동 과정 출력 |

### cp와의 차이

| 명령어 | 원본 | 디렉터리 옵션 |
|--------|------|--------------|
| `cp` | 유지됨 | `-r` 필요 |
| `mv` | 사라짐 | 옵션 불필요 |

```bash
# mv는 디렉터리도 그냥 이동
$ mv mydir /backup/     # -r 불필요
```

---

## 9. ln - 링크 만들기

### 기본 사용법

```bash
ln [옵션] <대상파일> <링크이름>
```

### 링크란?

> 파일에 **별명(바로가기)**을 붙이는 기능

```
┌─────────────────────────────────────────────────────┐
│                     링크의 종류                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  하드 링크:  파일 ← 링크1                           │
│                  ← 링크2   (같은 데이터 참조)       │
│                                                     │
│  심볼릭 링크:  파일 ← 링크 (경로만 가리킴)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 하드 링크

```bash
# 하드 링크 생성
$ ln original.txt hardlink.txt

# 확인 - 같은 inode 번호
$ ls -li
123456 -rw-r--r-- 2 user user 100 original.txt
123456 -rw-r--r-- 2 user user 100 hardlink.txt
```

**하드 링크 특징:**
- 원본과 링크 구분 없음 (둘 다 원본)
- 하나 삭제해도 다른 것 유지
- 디렉터리는 하드 링크 불가
- 다른 파일시스템(디스크)에 불가

### 심볼릭 링크 (소프트 링크)

```bash
# 심볼릭 링크 생성 (-s 필수)
$ ln -s /var/log/syslog ~/syslog

# 확인 - 화살표로 원본 표시
$ ls -l
lrwxrwxrwx 1 user user 15 syslog -> /var/log/syslog
```

**심볼릭 링크 특징:**
- 원본 경로를 가리키는 특수 파일
- 디렉터리도 가능
- 다른 파일시스템에도 가능
- 원본 삭제하면 링크 깨짐

### 비교표

| 항목 | 하드 링크 | 심볼릭 링크 |
|------|----------|------------|
| 옵션 | (없음) | `-s` |
| 원본 삭제 시 | 유지됨 | 깨짐 |
| 디렉터리 | 불가 | 가능 |
| 다른 FS | 불가 | 가능 |
| 파일 타입 | `-` | `l` |
| 주로 사용 | 드묾 | **자주 사용** |

### 깨진 심볼릭 링크

```bash
# 원본 삭제
$ rm /var/log/syslog

# 심볼릭 링크는 남아있지만 깨짐
$ ls -l ~/syslog
lrwxrwxrwx 1 user user 15 syslog -> /var/log/syslog  # 빨간색

$ cat ~/syslog
cat: syslog: 그런 파일이나 디렉터리가 없습니다
```

### 링크 삭제

```bash
# rm으로 삭제 (원본에 영향 없음)
$ rm linkname
```

---

## 요약

### 디렉터리 명령어

```bash
mkdir dir           # 디렉터리 생성
mkdir -p a/b/c      # 중첩 생성
rmdir dir           # 빈 디렉터리 삭제
```

### 파일 명령어

```bash
touch file          # 빈 파일 생성/시간 갱신
rm file             # 파일 삭제
rm -i file          # 확인 후 삭제
rm -r dir           # 디렉터리 삭제
```

### 내용 보기

```bash
cat file            # 전체 출력
cat -n file         # 행 번호와 함께
less file           # 페이지 단위
```

### 복사/이동

```bash
cp src dst          # 파일 복사
cp -r srcdir dstdir # 디렉터리 복사
cp -i src dst       # 확인 후 복사

mv src dst          # 이동/이름변경
mv -i src dst       # 확인 후 이동
```

### 링크

```bash
ln -s target link   # 심볼릭 링크 (권장)
ln target link      # 하드 링크
```

### less 단축키

| 키 | 동작 |
|:--:|------|
| `Space` | 다음 페이지 |
| `b` | 이전 페이지 |
| `/검색어` | 검색 |
| `n` / `N` | 다음/이전 결과 |
| `q` | 종료 |

### 주의사항

```bash
# 삭제 전 확인 습관
$ rm -i file        # 파일
$ rm -ri dir        # 디렉터리

# 절대 사용 금지
$ rm -rf /          # 시스템 파괴
$ rm -rf ~          # 홈 디렉터리 삭제
```
