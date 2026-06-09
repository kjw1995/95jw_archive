---
title: "01. 리눅스 첫걸음"
weight: 1
---

## 1. 리눅스란?

> **리눅스**는 오픈 소스 운영체제로, 컴퓨터 하드웨어와 소프트웨어 사이를 중재하는 기본 시스템 소프트웨어

### 리눅스의 역사

```
1991  리누스 토르발스, 첫 커널 발표
   │
1992  GPL 라이선스 채택 (오픈소스 가속)
   │
1993  Debian, Slackware 등 배포판 등장
   │
2000s 서버 시장 급성장, 안드로이드 등장
   │
현재  서버·클라우드·IoT·스마트폰 전반
```

### 리눅스 활용 분야

| 분야 | 예시 | 점유율 |
|:-----|:-----|:-----|
| **서버** | 웹·DB·클라우드 서버 | 약 96% (상위 100만 웹서버) |
| **클라우드** | AWS, GCP, Azure | 대부분 리눅스 기반 |
| **임베디드** | 라우터, 스마트TV, 자동차 | 광범위 |
| **모바일** | Android | 약 70% (모바일 OS) |
| **슈퍼컴퓨터** | TOP500 | 100% |

---

## 2. 리눅스의 구조

### 운영체제 계층 구조

사용자의 요청은 위에서 아래로 전달되고, 결과는 다시 위로 올라온다.

```
      사용자
        │
   애플리케이션     ← 브라우저, 편집기
        │
    셸 (Shell)     ← 명령어 해석·전달
        │
   커널 (Kernel)   ← 자원 관리·중재
        │
     하드웨어       ← CPU, RAM, 디스크
```

### 커널의 주요 역할

| 역할 | 설명 | 예시 |
|:-----|:-----|:-----|
| **프로세스 관리** | 실행/종료, CPU 시간 분배 | 여러 프로그램 동시 실행 |
| **메모리 관리** | RAM 할당/해제, 가상 메모리 | 프로그램별 공간 분리 |
| **파일 시스템** | 파일/디렉터리 입출력 | ext4, XFS 등 |
| **장치 드라이버** | 하드웨어 연결 | 프린터, USB, GPU |
| **네트워크** | 통신 처리 | TCP/IP 스택 |

{{< callout type="info" >}}
**셸과 커널이 분리된 이유:** 셸(껍데기)은 사용자 입력을 받아 커널(핵심)에 전달하는 중재자다. 둘이 분리되어 있어 셸을 자유롭게 교체해도 커널은 영향을 받지 않고, 셸에 오류가 나도 시스템 전체가 멈추지 않는다.
{{< /callout >}}

---

## 3. 리눅스의 장단점

### 장점

- **무료/오픈소스** — 라이선스 비용 없음, 소스 수정 가능
- **높은 안정성** — 서버 장시간 운영에 적합 (수년간 재부팅 불필요)
- **강력한 보안** — 권한 체계, SELinux, 빠른 보안 패치
- **스크립트 자동화** — 셸 스크립트로 반복 작업 자동화
- **풍부한 도구** — 개발·서버 관리 도구가 풍부
- **커뮤니티** — 전 세계 개발자 커뮤니티의 지원

### 단점

| 단점 | 설명 | 대안 |
|:-----|:-----|:-----|
| **학습 곡선** | CLI 위주로 초보자에게 어려움 | Ubuntu, Mint 등 친화적 배포판 |
| **상용 SW 부족** | MS Office, Adobe 등 | LibreOffice, GIMP, Wine |
| **게임 지원** | Windows 게임 대부분 미지원 | Steam Proton, Wine |
| **하드웨어 호환성** | 일부 최신 드라이버 부족 | 호환성 좋은 하드웨어 선택 |
| **한글 지원** | 일부 프로그램 한글 깨짐 | 로케일 설정, 폰트 설치 |

---

## 4. 배포판 (Distribution)

### 배포판이란?

> 리눅스 커널 + 셸 + 시스템 도구 + 패키지 관리자 + 응용프로그램을 묶어 바로 사용할 수 있게 만든 것

**구성 요소**

- 리눅스 커널 (공통)
- 셸 (bash 등)
- 시스템 도구 (ls, cp 등)
- 패키지 관리자 (apt, yum 등)
- 데스크톱 환경 (GNOME 등)
- 응용프로그램 (Firefox 등)

### 주요 배포판 계열

```
        리눅스 커널
            │
   ┌────────┼────────┐
 Red Hat  Debian    기타
  계열      계열     계열
 (RPM)     (DEB)    (다양)
 yum/dnf    apt
```

| 계열 | 대표 배포판 |
|:-----|:-----|
| **Red Hat** | RHEL, CentOS, Fedora, Rocky |
| **Debian** | Debian, Ubuntu, Mint, Kali |
| **기타** | Arch, Gentoo, Slackware, Alpine |

### 배포판 비교

| 배포판 | 특징 | 적합한 용도 | 패키지 |
|:-----|:-----|:-----|:-----|
| **Ubuntu** | 친화적, 큰 커뮤니티 | 데스크톱, 입문, 개발 | apt |
| **CentOS/Rocky** | RHEL 호환, 안정성 | 서버, 기업 환경 | yum/dnf |
| **Debian** | 안정성 최우선 | 서버, 안정성 중시 | apt |
| **Fedora** | 최신 기술 빠른 도입 | 개발, 신기술 테스트 | dnf |
| **Arch** | 롤링 릴리스, 미니멀 | 고급 사용자 | pacman |
| **Alpine** | 초경량 (약 5MB) | 컨테이너, 임베디드 | apk |

### 배포판 선택 가이드

| 상황 | 추천 |
|:-----|:-----|
| 리눅스 처음 | Ubuntu Desktop |
| 서버 운영 | Ubuntu Server, Rocky Linux |
| 개발 환경 | Ubuntu, Fedora |
| 보안/해킹 학습 | Kali Linux |
| 최신 패키지 | Arch Linux |
| 컨테이너 경량 OS | Alpine Linux |

---

## 5. 셸 (Shell)

### 셸이란?

> 사용자가 입력한 명령어를 해석하여 커널에 전달하는 **명령어 해석기**

```
사용자 → 터미널 → 셸 → 커널 → 하드웨어
            ◀── 결과 출력 ──
```

{{< callout type="info" >}}
셸은 2장에서 자세히 다룬다. 여기서는 "명령어를 해석해 커널에 전달하고 결과를 돌려주는 프로그램"이라는 역할만 기억하면 된다.
{{< /callout >}}

### 주요 셸 종류

| 셸 | 전체 이름 | 특징 |
|:-----|:-----|:-----|
| **bash** | Bourne Again Shell | 리눅스 기본 셸, 가장 널리 사용 |
| **zsh** | Z Shell | 강력한 자동완성, Oh-My-Zsh |
| **fish** | Friendly Interactive Shell | 친화적, 구문 강조 |
| **sh** | Bourne Shell | 기본 셸, 스크립트 호환성 |
| **dash** | Debian Almquist Shell | 경량, 스크립트 실행용 |

### 프롬프트 구조

```bash
user@hostname:~$
│    │        │ │
│    │        │ └ $ : 일반 사용자 (root는 #)
│    │        └── ~ : 현재 디렉터리 (홈)
│    └─────────── 호스트명
└──────────────── 사용자명
```

### 셸 확인 및 변경

```bash
# 현재 셸 확인
$ echo $SHELL
/bin/bash

# 사용 가능한 셸 목록
$ cat /etc/shells

# 셸 변경 (재로그인 필요)
$ chsh -s /bin/zsh
```

---

## 6. 로그인과 로그아웃

### 다중 사용자 시스템

> 리눅스는 여러 사용자가 동시에 사용하는 것을 전제로 설계된 **다중 사용자 시스템**

```
 사용자A   사용자B   사용자C   root
  (SSH)    (SSH)    (콘솔)   (콘솔)
    └────────┴────┬────┴────────┘
                  ▼
               커널

→ 각 사용자는 독립된 환경에서 작업
→ 파일 권한으로 서로의 파일을 보호
```

### 로그인 방법

```bash
# SSH 원격 로그인
$ ssh username@192.168.1.100

# 다른 사용자로 전환
$ su - username        # 해당 사용자로 (비밀번호 필요)
$ sudo -i              # 루트로 (본인 비밀번호)
```

### 로그아웃

```bash
$ exit          # 권장
$ logout        # 로그인 셸에서만
Ctrl + D        # 단축키
```

{{< callout type="warning" >}}
**로그아웃하지 않으면** 다른 사람이 내 계정으로 명령을 실행할 수 있고(보안 위험), 유휴 세션이 메모리·CPU를 점유하며 동시 접속 제한에 걸릴 수 있다. 작업이 끝나면 반드시 로그아웃하자.
{{< /callout >}}

---

## 7. 시스템 종료와 재부팅

### shutdown 명령어

```bash
# 문법: shutdown [옵션] [시간] [메시지]

$ sudo shutdown -h now              # 즉시 종료
$ sudo shutdown -h +10              # 10분 후 종료
$ sudo shutdown -h 23:30            # 지정 시간 종료
$ sudo shutdown -r now              # 재부팅
$ sudo shutdown -c                  # 예약 취소
$ sudo shutdown -h +5 "점검 종료"   # 메시지 알림
```

### shutdown 옵션

| 옵션 | 설명 | 예시 |
|:-----|:-----|:-----|
| `-h` | halt (종료) | `shutdown -h now` |
| `-r` | reboot (재부팅) | `shutdown -r now` |
| `-c` | cancel (예약 취소) | `shutdown -c` |
| `now` | 즉시 실행 | `shutdown -h now` |
| `+분` | N분 후 실행 | `shutdown -h +10` |
| `HH:MM` | 지정 시간 실행 | `shutdown -h 23:30` |

### 다른 종료/재부팅 명령어

```bash
# 종료
$ sudo poweroff
$ sudo systemctl poweroff    # systemd

# 재부팅
$ sudo reboot
$ sudo systemctl reboot      # systemd
```

### 런레벨 (Runlevel)

| 레벨 | 설명 |
|:----:|:-----|
| 0 | 시스템 종료 (halt) |
| 1 | 단일 사용자 모드 (복구) |
| 2 | 다중 사용자 (네트워크 없음) |
| 3 | 다중 사용자 + 네트워크 (CLI, 서버) |
| 4 | 사용자 정의 |
| 5 | 다중 사용자 + 네트워크 + GUI |
| 6 | 재부팅 (reboot) |

```bash
# 현재 런레벨 확인
$ runlevel
N 5

# systemd 기반
$ systemctl get-default
graphical.target
```

---

## 8. 리눅스 디렉터리 구조

### FHS (Filesystem Hierarchy Standard)

> 리눅스의 표준 디렉터리 구조

```
/                  # 루트 (최상위)
├── bin/           # 기본 명령어 (ls, cp)
├── sbin/          # 시스템 관리 명령어
├── etc/           # 시스템 설정 파일
│   ├── passwd     # 사용자 정보
│   ├── shadow     # 비밀번호 (암호화)
│   └── fstab      # 마운트 설정
├── home/          # 사용자 홈
├── root/          # root 홈
├── var/           # 가변 데이터
│   ├── log/       # 시스템 로그
│   └── www/       # 웹 서버 파일
├── tmp/           # 임시 파일
├── usr/           # 사용자 프로그램
├── opt/           # 추가 설치 프로그램
├── dev/           # 장치 파일
├── proc/          # 프로세스 정보 (가상)
├── sys/           # 시스템 정보 (가상)
├── mnt/, media/   # 마운트 지점
└── boot/          # 부트로더, 커널
```

### 주요 디렉터리

| 디렉터리 | 용도 | 주요 내용 |
|:-----|:-----|:-----|
| `/bin` | 필수 명령어 | ls, cp, mv, cat |
| `/sbin` | 시스템 관리 | shutdown, mount, fsck |
| `/etc` | 설정 파일 | passwd, fstab, hosts |
| `/home` | 사용자 홈 | 개인 파일, 설정 |
| `/var` | 가변 데이터 | 로그, 메일, 캐시 |
| `/tmp` | 임시 파일 | 재부팅 시 삭제됨 |
| `/usr` | 사용자 프로그램 | 응용프로그램, 라이브러리 |
| `/dev` | 장치 파일 | 디스크, USB, 터미널 |
| `/proc` | 프로세스 정보 | CPU, 메모리 정보 |

---

## 9. 기본 명령어

### 디렉터리 탐색

```bash
$ pwd                 # 현재 위치
$ cd /var/log         # 절대 경로 이동
$ cd ..               # 상위로
$ cd ~                # 홈으로
$ cd -                # 이전 위치로

$ ls                  # 목록
$ ls -l               # 상세 (권한·크기·날짜)
$ ls -a               # 숨김 파일 포함
$ ls -lh              # 읽기 쉬운 크기
$ ls -lt              # 시간순 정렬
```

### ls -l 출력 해석

```bash
-rw-r--r-- 1 user group 4096 Dec 25 file.txt
│├─┤├─┤├─┤ │  │    │     │    │      │
│ │  │  │  │  │    │     │    │      └ 파일명
│ │  │  │  │  │    │     │    └ 수정일시
│ │  │  │  │  │    │     └ 크기(byte)
│ │  │  │  │  │    └ 그룹
│ │  │  │  │  └ 소유자
│ │  │  │  └ 링크 수
│ │  │  └ 기타 권한 (r--)
│ │  └ 그룹 권한 (r--)
│ └ 소유자 권한 (rw-)
└ 유형 (- 파일, d 디렉터리, l 링크)
```

### 생성·삭제·복사·이동

```bash
# 생성
$ mkdir dir              # 디렉터리 생성
$ mkdir -p a/b/c         # 중첩 생성
$ touch file             # 빈 파일/시간 갱신

# 삭제
$ rm file                # 파일 삭제
$ rm -i file             # 확인 후 삭제
$ rmdir dir              # 빈 디렉터리 삭제
$ rm -r dir              # 디렉터리+내용 삭제

# 복사·이동
$ cp src dest            # 복사
$ cp -r srcdir destdir   # 디렉터리 복사
$ mv old new             # 이동/이름 변경
```

{{< callout type="warning" >}}
리눅스에는 휴지통이 없다. `rm`으로 삭제하면 복구가 매우 어렵고, 특히 `rm -rf`는 확인 없이 디렉터리를 통째로 지운다. 삭제 전에는 `-i` 옵션이나 `ls`로 대상을 먼저 확인하는 습관을 들이자.
{{< /callout >}}

### 파일 내용 보기

```bash
$ cat file            # 전체 출력
$ less file           # 페이지 단위 (q로 종료)
$ head file           # 앞 10줄
$ tail file           # 뒤 10줄
$ tail -f file        # 실시간 모니터링 (로그)
```

### 도움말 확인

```bash
$ man ls              # 매뉴얼 (상세)
$ ls --help           # 간단한 도움말
$ which python        # 명령어 위치
$ whatis ls           # 한 줄 설명
```

---

## 10. 사용자와 권한

### 사용자 종류

```
        root (슈퍼유저)
        UID 0, 모든 권한, 프롬프트 #
              │
   ┌──────────┼──────────┐
 일반유저    일반유저    시스템유저
 UID 1000+  UID 1001   UID 1~999
 프롬프트 $            (서비스용)
```

### sudo 사용

```bash
$ sudo command            # 관리자 권한으로 실행
$ sudo apt update         # 예: 패키지 목록 갱신
$ sudo -i                 # 루트 셸로 전환

$ whoami                  # 현재 사용자
$ id                      # uid/gid/그룹 확인
```

### 파일 권한

```bash
-rwxr-xr-x
│└┬┘└┬┘└┬┘
│ │  │  └ 기타(other): r-x
│ │  └ 그룹(group): r-x
│ └ 소유자(user): rwx
└ 유형 (- 파일, d 디렉터리)
```

권한은 숫자로도 표현한다. `r=4, w=2, x=1`을 더한다.

| 권한 | 계산 | 숫자 |
|:-----|:-----|:----:|
| `rwx` | 4+2+1 | 7 |
| `r-x` | 4+0+1 | 5 |
| `r--` | 4+0+0 | 4 |

> 예: `-rwxr-xr--` = **754**

### 권한 변경

```bash
# chmod: 권한 변경
$ chmod 755 script.sh     # rwxr-xr-x
$ chmod 644 file.txt      # rw-r--r--
$ chmod +x script.sh      # 실행 권한 추가
$ chmod u+x,g-w file      # 소유자 +x, 그룹 -w

# chown: 소유자 변경
$ sudo chown user:group file
$ sudo chown -R user:group dir/  # 재귀

# chgrp: 그룹 변경
$ sudo chgrp group file
```

---

## 요약

| 구분 | 핵심 내용 |
|:-----|:-----|
| **리눅스** | 오픈소스 OS, 서버/클라우드에서 압도적 점유율 |
| **커널** | OS의 핵심, 하드웨어와 소프트웨어 중재 |
| **배포판** | 커널 + 도구 + 앱 패키지 (Ubuntu, Rocky 등) |
| **셸** | 명령어 해석기 (bash가 기본) |
| **디렉터리 구조** | FHS 표준 (/, /home, /etc, /var 등) |
| **기본 명령어** | ls, cd, pwd, cp, mv, rm, mkdir |
| **사용자** | root(관리자), 일반, 시스템 사용자 |
| **권한** | rwx (읽기/쓰기/실행), 소유자/그룹/기타 |

### 자주 쓰는 명령어 빠른 참조

```bash
# 탐색
pwd                 # 현재 위치
ls -la              # 상세 목록
cd /path            # 이동

# 파일 조작
cp src dest         # 복사
mv old new          # 이동/이름변경
rm file             # 삭제
mkdir dir           # 디렉터리 생성

# 내용 보기
cat / less / tail -f file

# 시스템
sudo command        # 관리자 권한
shutdown -h now     # 종료
reboot              # 재부팅

# 도움말
man command / --help
```
