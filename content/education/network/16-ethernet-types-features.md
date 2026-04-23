---
title: "16. 이더넷의 종류와 특징"
weight: 16
---

## 1. 이더넷 규격 개요

이더넷은 IEEE 802.3 표준 아래 다양한 규격이 존재한다. 규격 이름에 **속도·전송 방식·매체 정보**가 담겨 있어 이름만 보고도 특성을 짐작할 수 있다.

---

## 2. 명명 규칙

### 기본 형식

```
10BASE-T
│   │   │
│   │   └── 매체 종류
│   └────── 전송 방식
└────────── 속도(Mbps)
```

| 구성 요소 | 의미 | 예 |
|:---|:---|:---|
| 숫자 (앞) | 속도 (Mbps) | 10, 100, 1000, 10G |
| BASE | Baseband (디지털 단일 채널) | BASE |
| 문자 (뒤) | 매체/파장 | T, F, S, L 등 |

### 뒤 문자 의미

| 문자 | 의미 |
|:---|:---|
| T | Twisted Pair (UTP) |
| F, FX | Fiber (광케이블) |
| S, SX, SR | Short wavelength / Short range |
| L, LX, LR | Long wavelength / Long range |
| ER | Extended Range (초장거리) |
| 숫자 (10BASE5 등) | 동축 케이블 길이 ×100m |

---

## 3. 주요 규격 정리표

| 규격 | 속도 | 매체 | 최대 거리 | 연도 |
|:---|:---|:---|:---|:---|
| 10BASE5 | 10 Mbps | 동축(Thick) | 500 m | 1982 |
| 10BASE2 | 10 Mbps | 동축(Thin) | 185 m | 1985 |
| 10BASE-T | 10 Mbps | UTP Cat3+ | 100 m | 1990 |
| 100BASE-TX | 100 Mbps | UTP Cat5+ | 100 m | 1995 |
| 100BASE-FX | 100 Mbps | MMF 광 | 2 km | 1995 |
| 1000BASE-T | 1 Gbps | UTP Cat5e+ | 100 m | 1999 |
| 1000BASE-SX | 1 Gbps | MMF 광 | 550 m | 1998 |
| 1000BASE-LX | 1 Gbps | SMF 광 | 5 km | 1998 |
| 10GBASE-T | 10 Gbps | UTP Cat6a+ | 100 m | 2006 |
| 10GBASE-SR | 10 Gbps | MMF 광 | 300 m | 2002 |
| 10GBASE-LR | 10 Gbps | SMF 광 | 10 km | 2002 |

---

## 4. 초기 이더넷 (10 Mbps)

### 10BASE5 / 10BASE2

동축 케이블을 쓰는 버스 토폴로지 방식의 초기 이더넷이다. 유지보수가 어렵고 장애 지점 하나가 전체 네트워크에 영향을 주는 구조라 현재는 사용하지 않는다.

### 10BASE-T

UTP 케이블과 RJ-45 커넥터, 허브/스위치 기반 스타 토폴로지를 도입한 첫 규격이다. 설치·관리가 쉬워 이더넷 대중화의 전환점이 되었다.

{{< callout type="info" >}}
10BASE-T 등장 이전에는 네트워크를 하나의 굵은 동축 케이블에 트랜시버로 연결했다. 케이블 한 곳만 끊겨도 전체가 다운되었다. UTP + 허브 구조로 바뀌면서 단일 장애점이 사라지고 설치 비용이 크게 낮아졌다.
{{< /callout >}}

---

## 5. Fast Ethernet (100 Mbps)

### 100BASE-TX

| 항목 | 내용 |
|:---|:---|
| 매체 | UTP Cat5 이상 |
| 거리 | 100 m |
| 쌍 사용 | 1,2(TX) / 3,6(RX) |

10BASE-T와 동일한 케이블·커넥터를 사용해 기존 인프라를 그대로 활용할 수 있었다.

### 100BASE-FX

멀티모드 광케이블 기반 100 Mbps 규격으로 건물 간 연결, 전자기 간섭이 많은 환경에서 사용한다.

---

## 6. Gigabit Ethernet (1 Gbps)

### 1000BASE-T

4쌍 모두 사용하고 각 쌍이 양방향 250 Mbps씩 분담하여 총 1 Gbps를 구현한다. 에코 캔슬레이션으로 동시 송·수신을 지원한다.

| 항목 | 내용 |
|:---|:---|
| 매체 | UTP Cat5e 이상 (Cat6 권장) |
| 거리 | 100 m |
| 쌍 사용 | 4쌍 전부 양방향 |

### 광케이블 1G

| 규격 | 파장 | 매체 | 거리 |
|:---|:---|:---|:---|
| 1000BASE-SX | 850 nm | MMF | 550 m |
| 1000BASE-LX | 1310 nm | SMF | 5 km |
| 1000BASE-LH | 1550 nm | SMF | 70 km |

---

## 7. 10 Gigabit Ethernet

### 10GBASE-T

| 항목 | 내용 |
|:---|:---|
| 매체 | Cat6a 이상 (Cat6은 55 m 한정) |
| 거리 | 100 m |
| 표준 | IEEE 802.3an (2006) |

### 광케이블 10G

| 규격 | 매체 | 거리 | 용도 |
|:---|:---|:---|:---|
| 10GBASE-SR | MMF | 300~400 m | 데이터센터 내부 |
| 10GBASE-LR | SMF | 10 km | 캠퍼스/WAN |
| 10GBASE-ER | SMF | 40 km | 메트로/WAN |

---

## 8. 40G / 100G 이상

| 규격 | 속도 | 매체 | 거리 |
|:---|:---|:---|:---|
| 40GBASE-SR4 | 40 G | MMF | 100 m |
| 40GBASE-LR4 | 40 G | SMF | 10 km |
| 100GBASE-SR10 | 100 G | MMF | 100 m |
| 100GBASE-LR4 | 100 G | SMF | 10 km |
| 400GBASE-SR16 | 400 G | MMF | 100 m |
| 400GBASE-LR8 | 400 G | SMF | 10 km |

주로 데이터센터 스파인-리프 구조나 백본 네트워크에서 사용된다.

---

## 9. 카테고리와 규격 매칭

| 카테고리 | 대역폭 | 지원 규격 |
|:---|:---|:---|
| Cat 5 | 100 MHz | 100BASE-TX (단종) |
| Cat 5e | 100 MHz | 1000BASE-T |
| Cat 6 | 250 MHz | 1G 전용, 10G는 55 m |
| Cat 6a | 500 MHz | 10GBASE-T (100 m) |
| Cat 7 | 600 MHz | 10GBASE-T + 실드 |
| Cat 8 | 2000 MHz | 25/40GBASE-T |

---

## 10. 환경별 권장 규격

| 환경 | 엔드포인트 | 백본 |
|:---|:---|:---|
| 가정·SOHO | 1000BASE-T | - |
| 중소기업 | 1000BASE-T | 10GBASE-T/SR |
| 데이터센터 | 10/25GBASE-T | 40/100G 광 |
| 하이퍼스케일 | 25/100G | 100/400G 광 |

{{< callout type="info" >}}
속도는 약 10년 주기로 10배씩 증가해 왔다. 현재는 800G·1.6T 이더넷이 표준화 단계에 있으며, 데이터센터에서는 더 이상 구리(UTP)만으로 감당하기 어렵기에 광 트랜시버(SFP/QSFP)와 트윈액스 DAC 케이블이 널리 사용된다.
{{< /callout >}}

---

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 이더넷 규격 | 속도·전송 방식·매체로 분류 |
| BASE | Baseband (디지털 단일 채널) |
| 10BASE-T | UTP + 스타 토폴로지 시대 개막 |
| 1000BASE-T | 현재 LAN 표준, 4쌍 사용 |
| 10GBASE-T | Cat6a, 데이터센터 표준 |
| 40/100G+ | 광케이블 중심 초고속 규격 |

{{< callout type="info" >}}
**용어 정리**
- **BASE / BROAD**: Baseband / Broadband 전송 방식
- **UTP**: Unshielded Twisted Pair
- **MMF / SMF**: Multi-Mode / Single-Mode Fiber
- **Fast Ethernet**: 100 Mbps 이더넷
- **Gigabit Ethernet**: 1 Gbps 이더넷
- **SFP / QSFP**: 광 트랜시버 모듈 규격
{{< /callout >}}
