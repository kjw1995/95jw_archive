---
title: "35. 무선 랜의 구조"
weight: 35
---

## 1. 무선 랜이란?

무선 랜(Wireless LAN, WLAN)은 케이블 대신 전파를 이용해 기기들을 네트워크에 연결하는 기술로, Wi-Fi라는 이름으로 널리 알려져 있다. 이동성이 뛰어난 대신 유선보다 속도가 느리고 간섭에 취약하다.

```
유선:
 PC ── 케이블 ── 스위치 ── 라우터

무선:
 PC ))) 전파 ))) AP ── 스위치 ── 라우터
```

| 장점 | 단점 |
|:---|:---|
| 케이블 불필요, 이동성 | 유선보다 느림 |
| 설치·재구성 용이 | 간섭·장애물 영향 |
| 여러 기기 동시 연결 | 범위 제한, 보안 고려 필수 |

---

## 2. 구성 요소

### AP (Access Point)

AP(Access Point)는 무선 클라이언트를 유선 네트워크에 연결해 주는 장비다. 비콘(Beacon) 프레임으로 SSID를 알리고, 클라이언트 인증·관리·프레임 중계를 수행한다.

### 무선 클라이언트와 어댑터

무선 랜 어댑터(내장 M.2, PCIe, USB 등)가 달린 기기가 AP와 통신한다.

### 무선 공유기

가정용 공유기는 AP, 라우터, 스위치, DHCP 서버 기능을 하나의 장비에 합친 형태다.

```
┌─────────────────────────┐
│      무선 공유기        │
│  ┌───────────────────┐  │
│  │ AP (SSID, 인증)   │  │
│  ├───────────────────┤  │
│  │ 라우터 (NAT, FW)  │  │
│  ├───────────────────┤  │
│  │ 스위치 (LAN 4포트)│  │
│  └───────────────────┘  │
└─────────────────────────┘
```

---

## 3. 연결 방식

### 인프라스트럭처 모드

가장 일반적인 방식. 모든 통신이 AP를 경유한다.

```
[클라이언트 A] ))) [AP] ))) [클라이언트 B]
                    │
                 유선 네트워크
                    │
                  인터넷
```

연결 절차:

```
1) AP가 비콘으로 SSID 브로드캐스트
2) 클라이언트 스캔 (Probe)
3) 인증(Authentication)
4) 연결(Association)
5) DHCP로 IP 획득
6) 데이터 통신 시작
```

### 애드혹 모드 (IBSS)

AP 없이 클라이언트끼리 P2P로 연결. 임시 네트워크에 적합하지만 범위·성능·보안이 제한적이다. 현대에는 Wi-Fi Direct가 이 역할을 대체하는 경우가 많다.

{{< callout type="info" >}}
유무선 전환은 같은 네트워크라도 특성이 다르다. 유선은 전이중·CSMA/CD, 무선은 반이중·CSMA/CA를 쓰며 전파 간섭·RSSI에 따라 실효 속도가 크게 변한다. 혼잡한 환경이라면 스트리밍·회의는 유선, 이동 기기는 무선으로 나눠 쓰는 편이 안정적이다.
{{< /callout >}}

---

## 4. IEEE 802.11 표준

무선 랜은 IEEE 802.11 계열 표준을 따른다. 최근 버전은 Wi-Fi 6/6E/7이다.

| 표준 | 별칭 | 주파수 | 최대 속도 |
|:---|:---|:---|:---|
| 802.11a | - | 5 GHz | 54 Mbps |
| 802.11b | - | 2.4 GHz | 11 Mbps |
| 802.11g | - | 2.4 GHz | 54 Mbps |
| 802.11n | Wi-Fi 4 | 2.4/5 GHz | 600 Mbps |
| 802.11ac | Wi-Fi 5 | 5 GHz | 6.9 Gbps |
| 802.11ax | Wi-Fi 6/6E | 2.4/5/6 GHz | 9.6 Gbps |
| 802.11be | Wi-Fi 7 | 2.4/5/6 GHz | 46 Gbps |

### 주파수 대역 비교

| 항목 | 2.4 GHz | 5 GHz | 6 GHz |
|:---|:---|:---|:---|
| 속도 | 낮음 | 높음 | 매우 높음 |
| 범위 | 넓음 | 중간 | 좁음 |
| 장애물 투과 | 강함 | 약함 | 매우 약함 |
| 간섭 | 많음 | 적음 | 거의 없음 |
| 비중첩 채널 | 3개 (1, 6, 11) | 다수 | 다수 |

2.4 GHz는 전자레인지, 블루투스, 무선 전화기 등과 주파수를 공유하기 때문에 혼잡한 환경에서는 5 GHz 또는 6 GHz 사용이 권장된다.

---

## 5. 매체 접근 제어: CSMA/CA

무선은 전송 중 수신이 불가능(반이중)하고 숨겨진 노드 문제가 있어 유선의 CSMA/CD 대신 **CSMA/CA(Collision Avoidance)**를 쓴다.

```
1) 캐리어 센싱 (채널이 비었나?)
2) 비어있음 → DIFS 대기
3) 랜덤 백오프 (0 ~ CW)
4) 데이터 전송
5) 수신자 ACK 반환
   └ ACK 없음 → 재전송
```

### 숨겨진 노드 문제와 RTS/CTS

```
[A] ))) [AP] ((( [B]
 A와 B는 서로를 인식 못함
 → 동시에 전송 시 AP에서 충돌
```

AP가 RTS(Request to Send)를 받고 CTS(Clear to Send)를 브로드캐스트하면, 주변 노드는 해당 시간 동안 전송을 유보해 충돌을 줄인다.

---

## 6. 무선 랜 보안

| 방식 | 암호 알고리즘 | 상태 |
|:---|:---|:---|
| Open | 없음 | 공개 Wi-Fi, 권장 안 함 |
| WEP | RC4 | 취약, 사용 금지 |
| WPA | TKIP/RC4 | 구형, 사용 금지 |
| WPA2 | AES-CCMP | 현재 일반적 |
| WPA3 | AES-GCMP + SAE | 최신, 권장 |

### WPA2 4-Way Handshake

```
클라이언트           AP
    │  ANonce         │
    │◀────────────────┤
    │  SNonce+MIC     │
    ├────────────────▶│
    │  GTK+MIC        │
    │◀────────────────┤
    │  ACK            │
    ├────────────────▶│
    │  암호화 통신 시작│
```

WPA3는 SAE(Simultaneous Authentication of Equals)로 사전 공격에 강하고 Forward Secrecy를 제공한다.

{{< callout type="warning" >}}
공공 Wi-Fi에서는 HTTPS, VPN 없이 민감한 작업을 하지 않는 것이 좋다. Open 네트워크는 같은 AP에 접속한 다른 사용자가 트래픽을 엿볼 수 있다.
{{< /callout >}}

---

## 7. 실무 도구

### Linux

```bash
# 인터페이스/현재 연결
iwconfig
iw dev wlan0 link
iw dev wlan0 info

# 스캔
sudo iw dev wlan0 scan | grep SSID
nmcli dev wifi list

# 연결
nmcli dev wifi connect "MyWiFi" \
  password "secret"

# 모니터링
sudo apt install wavemon
wavemon
```

### Windows

```powershell
netsh wlan show interfaces
netsh wlan show networks mode=bssid
netsh wlan show profiles
netsh wlan show profile name="MyWiFi" key=clear
```

### 신호 강도(RSSI) 해석

| RSSI (dBm) | 상태 |
|:---|:---|
| -30 ~ -50 | 매우 좋음 |
| -50 ~ -67 | 좋음 (스트리밍 가능) |
| -67 ~ -70 | 보통 |
| -70 ~ -80 | 약함, 끊김 가능 |
| -80 이하 | 사용 곤란 |

---

## 핵심 정리

| 항목 | 내용 |
|:---|:---|
| 표준 | IEEE 802.11 계열, 현재 Wi-Fi 6/6E 보편, Wi-Fi 7 도입 |
| 주파수 | 2.4 / 5 / 6 GHz, 대역별 범위와 간섭 특성 상이 |
| 매체 접근 | CSMA/CA + RTS/CTS |
| 보안 | WPA3 권장, WPA2는 최소 기준, WEP/WPA는 금지 |

{{< callout type="info" >}}
**용어 정리**
- **AP**: 무선 클라이언트를 유선 네트워크에 연결하는 장비
- **SSID**: 무선 네트워크의 이름 (다음 장에서 상세)
- **CSMA/CA**: 충돌을 미리 회피하는 무선 매체 접근 방식
- **WPA3**: 최신 무선 보안 표준, SAE 키 교환 사용
- **RSSI**: 수신 신호 강도(dBm), 절댓값이 작을수록 강함
{{< /callout >}}
