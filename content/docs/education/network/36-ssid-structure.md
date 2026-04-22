---
title: "36. SSID의 구조"
weight: 36
---

## 1. SSID란?

SSID(Service Set Identifier)는 무선 네트워크의 이름이다. 여러 AP가 공존하는 환경에서 클라이언트가 어느 네트워크에 연결할지 식별할 수 있게 해 준다.

- 길이: 0 ~ 32 바이트(UTF-8)
- 대소문자를 구분
- 공백·특수문자 사용 가능(호환성을 위해 단순한 이름 권장)

```
주변 네트워크:
┌────────────────────────┐
│ ◉ MyHomeWiFi     [WPA2]│
│ ○ CoffeeShop     [Open]│
│ ○ Office_5G      [WPA3]│
│ ○ Neighbor_WiFi  [WPA2]│
└────────────────────────┘
```

### BSS / ESS / BSSID

| 용어 | 의미 |
|:---|:---|
| BSS (Basic Service Set) | 하나의 AP와 연결된 클라이언트 집합 |
| BSSID | 해당 AP의 MAC 주소 (BSS 식별자) |
| ESS (Extended Service Set) | 같은 SSID를 쓰는 여러 AP의 집합 |
| IBSS | AP 없이 구성되는 애드혹 BSS |

ESS는 같은 SSID를 사용하는 여러 AP가 네트워크 전체를 덮어, 사용자가 이동해도 로밍이 자연스럽게 이뤄지는 구조를 가리킨다.

### 연결에 필요한 정보

```
1) SSID                (네트워크 이름)
2) 인증 방식           (WPA2/WPA3-PSK 등)
3) 암호화 방식         (AES)
4) 사전 공유 키(PSK)   (비밀번호)
```

---

## 2. 비콘 프레임

AP는 자신의 존재를 알리기 위해 일정 간격으로 비콘(Beacon) 프레임을 브로드캐스트한다. 비콘에는 SSID, 지원 속도, 채널, 보안 정보가 담긴다.

```
AP
 │ 약 100ms 간격
 ▼
))))))))))))))))))))))))
  ↓       ↓       ↓
노트북  스마트폰  태블릿
```

### 주요 필드

| 필드 | 내용 |
|:---|:---|
| 타임스탬프 | 시각 동기용 |
| 비콘 간격 | 기본 100 TU (약 102.4 ms) |
| Capability Info | 암호화, QoS 등 기능 |
| SSID | 네트워크 이름 (숨김 시 길이 0) |
| Supported Rates | 지원 속도 |
| DS Parameter | 채널 번호 |
| RSN | WPA2/WPA3 보안 정보 |

### 스캔 방식

- **Passive Scan**: 클라이언트가 비콘을 수신할 때까지 기다린다.
- **Active Scan**: 클라이언트가 Probe Request를 보내고, AP가 Probe Response로 답한다.

### SSID 숨김

비콘의 SSID 필드를 비우면 네트워크 목록에 나타나지 않지만, Probe Request/Response 단계에서 SSID가 노출되기 때문에 완전한 보안 수단은 아니다. 편의성만 떨어뜨리는 경우가 많아 강력한 WPA3 암호를 쓰는 편이 낫다.

---

## 3. 채널

무선 랜은 주파수 대역을 **채널**로 분할해 여러 기기를 수용한다.

### 2.4 GHz

채널 폭이 22 MHz인데 채널 간격은 5 MHz여서, 인접 채널끼리 서로 겹친다. 한국·미국에서는 **1, 6, 11**이 비중첩 채널이다.

```
채널: 1   6   11
      ▓▓▓ ▓▓▓ ▓▓▓
      └──┘└──┘└──┘
     서로 간섭 없음
```

### 5 GHz

채널이 넓고 많아 혼잡이 적다. 대신 UNII-2 대역(52~140)은 DFS(Dynamic Frequency Selection) 대상으로, AP가 기상 레이더를 감지하면 자동으로 채널을 바꿔야 한다.

| 대역 | 대표 채널 | 비고 |
|:---|:---|:---|
| UNII-1 | 36, 40, 44, 48 | DFS 없음 |
| UNII-2A | 52, 56, 60, 64 | DFS 필수 |
| UNII-2C | 100 ~ 140 | DFS 필수 |
| UNII-3 | 149 ~ 165 | DFS 없음 |

### 채널 폭과 속도

| 채널 폭 | 사용 표준 | 상대 속도 |
|:---|:---|:---|
| 20 MHz | 기본 | 1x |
| 40 MHz | 802.11n | 2x |
| 80 MHz | 802.11ac | 4x |
| 160 MHz | 802.11ac/ax | 8x |
| 320 MHz | 802.11be | 16x |

채널 폭이 넓어질수록 속도는 빨라지지만, 다른 AP와 부딪칠 가능성도 커진다. 혼잡한 2.4 GHz에서는 20 MHz, 5 GHz에서는 80 MHz가 일반적인 타협점이다.

---

## 4. 채널 계획과 로밍

### 다중 AP 배치

```
[AP1:ch 1] --- [AP2:ch 6] --- [AP3:ch 11]
     ─── 같은 SSID "Office" ───
```

같은 SSID를 여러 AP에 부여하면 클라이언트는 신호가 가장 강한 AP로 자동 전환한다(로밍). 각 AP의 채널은 서로 겹치지 않도록 1-6-11 패턴으로 분산 배치하거나, 5 GHz에서는 DFS를 포함한 여러 채널을 나눠 쓴다.

### 간섭 예시

```
[AP1:ch 1] ))))) [AP2:ch 1]
       전파 겹침 → 속도 저하
  해결: AP2를 ch 6 또는 ch 11로 변경
```

---

## 5. 보안

WEP부터 WPA3까지 무선 보안은 계속 강화되어 왔다. 가능하면 **WPA3**, 최소한 **WPA2-AES**를 사용하고 WEP·WPA(TKIP)는 쓰지 않는다.

| 방식 | 등장 | 암호 | 상태 |
|:---|:---|:---|:---|
| WEP | 1997 | RC4 40/104 비트 | 취약, 수분 내 해독 |
| WPA | 2003 | TKIP (RC4) | 과도기, 사용 금지 |
| WPA2 | 2004 | AES-CCMP | 현재 널리 사용 |
| WPA3 | 2018 | AES-GCMP + SAE | 최신, 권장 |

{{< callout type="warning" >}}
WEP와 WPA(TKIP)는 알려진 약점으로 실질적 보호력이 없다. 공유기 설정에서 이 옵션이 선택되어 있다면 즉시 WPA2-AES 이상으로 변경하고 비밀번호도 새로 설정해야 한다.
{{< /callout >}}

### 인증 방식

- **PSK (Personal)**: 모든 사용자가 같은 사전 공유 키 사용. 가정·소규모 사무실용.
- **Enterprise (802.1X)**: RADIUS 서버로 개별 계정 인증. 기업·학교용.

### 권장 설정

- WPA3 또는 WPA2-AES만 사용
- 사전 공유 키는 12자 이상의 고유 문자열
- SSID·관리자 계정의 기본값 변경
- WPS 비활성화
- 게스트 네트워크를 별도 SSID/VLAN으로 분리
- 공유기 펌웨어 최신화

---

## 6. 실무 도구

### Linux

```bash
# 주변 스캔
nmcli dev wifi list
sudo iw dev wlan0 scan | \
  grep -E "SSID|freq|signal"

# 현재 연결 정보
iw dev wlan0 link
iw dev wlan0 info
```

### Windows

```powershell
netsh wlan show networks mode=bssid
netsh wlan show interfaces
```

### 채널 분석

- Linux: `wavemon`, `iwlist wlan0 channel`
- Windows: Wi-Fi Analyzer(Microsoft Store)
- iOS/Android: Airport Utility, WiFiman 등

---

## 7. 다중 SSID 구성

기업 공유기는 하나의 물리 AP에서 여러 SSID를 동시에 제공할 수 있다. 일반적으로 내부·게스트·IoT를 별도 VLAN과 SSID로 분리해 네트워크 정책을 다르게 적용한다.

| SSID | 목적 | 보안 | VLAN |
|:---|:---|:---|:---|
| Company_Internal | 임직원 업무 | WPA3-Enterprise | 10 |
| Company_Guest | 방문자 | WPA2-PSK, 인터넷만 | 20 |
| Company_IoT | 센서·프린터 | WPA2-PSK, 격리 | 30 |

---

## 핵심 정리

| 항목 | 내용 |
|:---|:---|
| SSID | 무선 네트워크 이름, 32바이트 이내 |
| BSS/ESS | 한 AP의 집합(BSS), 같은 SSID의 여러 AP(ESS) |
| 비콘 | AP가 약 100ms 간격으로 SSID·보안 정보 방송 |
| 채널 | 2.4 GHz는 1/6/11, 5 GHz는 DFS 포함 다양한 채널 |
| 보안 | WPA3 권장, WPA2 최소, WEP/WPA 사용 금지 |

{{< callout type="info" >}}
**용어 정리**
- **SSID**: 무선 네트워크 이름
- **BSSID**: AP의 MAC 주소, BSS를 식별
- **ESS**: 같은 SSID를 공유하는 여러 AP의 집합
- **비콘**: AP가 주기적으로 보내는 네트워크 알림 프레임
- **DFS**: 기상 레이더 간섭을 피해 5 GHz 채널을 자동 변경하는 규정
- **SAE**: WPA3에서 사용하는 대등 인증 키 교환
{{< /callout >}}
