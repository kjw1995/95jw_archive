---
title: "07. 네트워킹"
date: 2026-04-23
weight: 7
---

[02. 핵심 개념](../02-core-concepts)에서 Service는 바뀌는 파드 IP 앞에 두는 고정 주소이고 kube-proxy가 그것을 커널 규칙으로 만든다고 했다. [03. 클러스터 구성](../03-cluster-setup)에서는 CNI를 깔기 전까지 노드가 NotReady라는 것과 노드마다 잘리는 /24 대역을 봤다. 이 장은 그 조각들을 처음부터 끝까지, 파드 하나가 IP를 받는 순간부터 인터넷의 요청이 그 파드에 닿는 순간까지 잇는다. 원리는 셋이다. 첫째, **모든 파드는 NAT 없이 서로 IP로 통하고, 그 약속을 어떻게 지킬지는 CNI 플러그인에 맡긴다.** 쿠버네티스가 정한 것은 규칙뿐이고, 브리지와 오버레이와 라우팅은 플러그인의 일이다. 둘째, **파드 IP는 바뀌므로 그 앞에 가상 IP와 이름을 두는데, 가상 IP는 어느 인터페이스에도 없고 노드마다 커널 규칙 안에만 있다.** Service 객체는 선언이고 EndpointSlice는 목록이며, kube-proxy가 그것을 iptables나 nftables나 IPVS 규칙으로 옮겨 적는다. 셋째, **클러스터 밖에서 들어오는 트래픽은 L4(노드 포트, 로드밸런서)와 L7(Ingress, Gateway API)로 나뉘고, 규칙은 API 객체지만 실제 일은 컨트롤러가 한다.** Ingress 객체를 만들어도 Ingress 컨트롤러가 없으면 아무 일도 일어나지 않고, Gateway API는 그 자리를 이어받는 후계 규격이다.

---

## 1. 쿠버네티스 네트워크 모델

### 1.1 네트워킹 요구사항

쿠버네티스는 **플랫 네트워크 모델**을 전제로 한다. 어떤 CNI 플러그인을 쓰든 다음을 지켜야 한다.

| 요구사항 | 설명 | 왜 |
|:--------|:-----|:---|
| 파드 고유 IP | 모든 파드는 클러스터 전체에서 유일한 IP를 가진다 | 컨테이너에 포트를 매핑하던 Docker 방식은 포트 충돌과 주소 변환을 낳는다 |
| 파드 ↔ 파드 | 같은 노드든 다른 노드든 NAT 없이 IP로 통한다 | 앱이 자기 IP를 상대에게 알려 줄 수 있어야 한다. NAT가 끼면 "내가 아는 내 주소"와 "남이 보는 내 주소"가 달라진다 |
| 노드 ↔ 파드 | kubelet 같은 노드의 에이전트가 그 노드의 파드와 통한다 | 프로브와 로그 수집이 파드 IP로 간다 |
| hostNetwork 파드 | 노드 네트워크를 쓰는 파드도 모든 파드와 NAT 없이 통한다 | 노드 에이전트를 파드로 배포할 수 있게 |

쿠버네티스가 푸는 네트워킹 문제는 넷이다. 한 파드 안의 컨테이너끼리(localhost), 파드와 파드, 파드와 Service, 바깥과 Service. 첫째는 파드가 네트워크 네임스페이스를 나눠 쓰는 것으로 끝나고(02장), 둘째가 1~2절, 셋째가 3~4절과 10절, 넷째가 5~9절이다.

```text
    파드 네트워크 (10.244.0.0/16)
  ┌────────────────────────────────┐
  │  Node 1 (cni0: 10.244.1.0/24)  │
  │   ├─ Pod: 10.244.1.2           │
  │   └─ Pod: 10.244.1.3           │
  │                                │
  │  Node 2 (cni0: 10.244.2.0/24)  │
  │   └─ Pod: 10.244.2.2           │
  └────────────────────────────────┘
```

### 1.2 IP 대역 설계

클러스터에는 세 종류의 주소가 산다. 노드의 주소는 회사 네트워크나 클라우드 VPC가 주고, 파드와 Service의 주소는 쿠버네티스가 관리하는 사설 대역이다.

| 대상 | 기본 범위 | 누가 나눠 주나 | 왜 따로인가 |
|:-----|:---------|:-------------|:-----------|
| Service | 10.96.0.0/12 | kube-apiserver `--service-cluster-ip-range` | 가상 IP라 실제 라우팅되지 않는다. 노드의 커널 규칙 안에서만 뜻이 있다 |
| 파드 | 10.244.0.0/16 (kubeadm + Flannel 관례) | kube-controller-manager `--cluster-cidr`, 노드마다 /24 | 실제 패킷이 흐르는 대역. CNI의 IPAM이 노드 조각에서 하나씩 준다 |
| 노드 | 조직 네트워크 | 외부 | 쿠버네티스 밖의 세계 |

```text
# kube-apiserver
--service-cluster-ip-range=10.96.0.0/12
# kube-controller-manager
--cluster-cidr=10.244.0.0/16
--allocate-node-cidrs=true
--node-cidr-mask-size=24
```

노드마다 /24를 잘라 주는 것은 컨트롤러 매니저의 노드 IPAM 컨트롤러이고, 그 값이 노드 객체의 `spec.podCIDR`에 적힌다. 03장에서 본 `10.42.1.0/24` 같은 값이 그것이다. CNI 플러그인은 그 조각 안에서 파드에 IP를 주고, "이 /24는 저 노드에 있다"는 라우팅을 노드 사이에 퍼뜨린다. 세 대역이 겹치면 커널이 어느 규칙을 탈지 모르므로 반드시 분리하고, 회사 네트워크와도 겹치지 않게 잡는다. 나중에 바꾸는 것은 클러스터를 다시 세우는 일에 가깝다.

Service 대역은 1.33부터 `ServiceCIDR` 객체로 관리되고 `IPAddress` 객체가 할당을 기록한다. `kubectl get servicecidrs`로 대역을 보고 `kubectl get ipaddresses`로 어느 Service가 어느 IP를 쥐고 있는지 볼 수 있으며, 대역이 모자라면 ServiceCIDR을 추가해 넓힌다. IPv4와 IPv6를 함께 쓰는 듀얼 스택은 두 대역을 나란히 두고 Service의 `ipFamilyPolicy`로 고른다.

### 1.3 필수 포트

컴포넌트 사이의 통신은 전부 TCP 포트이고 목록은 [03](../03-cluster-setup)장 3절에 있다. 이 장과 직접 관계된 것만 다시 적는다.

| 노드 | 포트 | 컴포넌트 | 왜 |
|:-----|:-----|:--------|:---|
| 컨트롤 플레인 | 6443 | kube-apiserver | kube-proxy와 CoreDNS도 여기서 Service 목록을 받는다 |
| 모든 노드 | 10250 | kubelet | 파드 IP가 아니라 노드 IP로 온다 |
| 모든 노드 | 10256 | kube-proxy 헬스체크 | 로드밸런서가 노드의 건강을 묻는다 |
| 워커 | 30000-32767 | NodePort | 5절 |
| 모든 노드 | UDP 8472 / TCP 179 | Flannel·Cilium VXLAN / Calico BGP | 2절의 오버레이와 라우팅 |

---

## 2. CNI 아키텍처

### 2.1 CNI란

**CNI(Container Network Interface)** 는 컨테이너 런타임과 네트워크 플러그인 사이의 규격이다. 규격 버전 1.1.0 기준으로 플러그인은 실행 파일이고, 런타임은 파드의 네트워크 네임스페이스를 만든 뒤 환경 변수와 표준 입력의 JSON으로 플러그인을 부른다.

```text
Kubernetes 표준 인터페이스
 ├─ CRI : containerd, CRI-O   (01·03장)
 ├─ CNI : Calico, Flannel, Cilium
 └─ CSI : EBS, Ceph, NFS       (06장)
```

| 동작 | 뜻 | 왜 |
|:-----|:---|:---|
| ADD | 컨테이너를 네트워크에 붙인다 | 파드 생성 때. veth, IP, 라우트 |
| DEL | 뗀다 | 파드 삭제 때. IP를 IPAM에 돌려준다 |
| CHECK | 붙어 있는 상태가 기대와 같은지 본다 | 런타임이 주기적으로 |
| GC, STATUS | 남은 자원 정리, 플러그인 준비 여부 | kubelet이 "네트워크 준비됐나"를 묻는 근거 |
| VERSION | 지원하는 규격 버전 | |

플러그인이 받는 환경 변수는 `CNI_COMMAND`(동작), `CNI_CONTAINERID`, `CNI_NETNS`(네임스페이스 경로), `CNI_IFNAME`(만들 인터페이스 이름, 보통 `eth0`), `CNI_ARGS`, `CNI_PATH`(플러그인 실행 파일을 찾을 경로)다. 규격이 실행 파일과 JSON이라는 낮은 수준인 이유는 어떤 언어로든 플러그인을 쓸 수 있고, 플러그인을 사슬로 이을 수 있기 때문이다.

### 2.2 책임 분담

| 주체 | 책임 | 왜 |
|:-----|:-----|:---|
| kubelet | 파드를 만들 때 런타임에 "네트워크 붙여라"를 시킨다 | 파드 생성의 주인 |
| 컨테이너 런타임 | 네트워크 네임스페이스 생성, CNI 호출(ADD/DEL), 결과 보관 | 네임스페이스를 만드는 쪽이 붙이기도 한다 |
| CNI 플러그인 | veth 생성, IPAM에서 IP 받기, 라우팅과 브리지 설정, 결과 JSON 반환 | 네트워크의 구현 |
| CNI 데몬(플러그인마다) | 노드 사이 라우팅 정보 교환(VXLAN, BGP), 정책 적용 | 한 노드 안의 일과 노드 사이의 일은 다르다 |

### 2.3 설정 파일 위치

```text
/opt/cni/bin/      # 플러그인 파일
├── bridge  flannel  calico
├── host-local  portmap  bandwidth
└── loopback

/etc/cni/net.d/    # 알파벳 순 첫 파일
├── 10-flannel.conflist
└── 20-calico.conflist
```

```json
{
  "cniVersion": "1.0.0",
  "name": "cbr0",
  "plugins": [
    {
      "type": "flannel",
      "delegate": {
        "hairpinMode": true,
        "isDefaultGateway": true
      }
    },
    {
      "type": "portmap",
      "capabilities": {
        "portMappings": true
      }
    },
    {
      "type": "bandwidth",
      "capabilities": {
        "bandwidth": true
      }
    }
  ]
}
```

`.conflist`의 `plugins`는 **사슬**이다. 첫 플러그인이 인터페이스와 IP를 만들고, `portmap`이 `hostPort`를 위한 포트 매핑을, `bandwidth`가 대역폭 제한을 덧붙인다. Flannel 플러그인은 실제 일을 `bridge` 플러그인에 위임(delegate)해 `cni0` 브리지를 만들고, IP는 `host-local` IPAM이 그 노드의 `podCIDR` 안에서 준다. 03장에서 본 라우팅 테이블, 곧 자기 /24는 `cni0`로, 남의 /24는 `flannel.1`(VXLAN)로 보내는 두 줄이 이 사슬의 결과다. `/etc/cni/net.d`가 비어 있으면 kubelet은 런타임의 STATUS에서 "네트워크 준비 안 됨"을 받아 노드를 NotReady로 둔다.

### 2.4 주요 CNI 플러그인 비교

| 플러그인 | 노드 간 방식 | 기본 파드 대역 | 정책 | 왜 고르나 |
|:--------|:-----------|:-------------|:-----|:---------|
| Flannel | VXLAN 오버레이(UDP 8472) | 10.244.0.0/16 | 없음 | 설정이 거의 없다. 경량 배포판의 기본 |
| Calico | BGP 라우팅 또는 VXLAN/IPIP | 192.168.0.0/16 | NetworkPolicy, 자체 정책 | 오버레이 없이 라우팅하면 성능이 좋고, 정책 엔진이 성숙하다 |
| Cilium | eBPF, VXLAN 또는 네이티브 라우팅 | 유연 | L3/L4/L7 정책 | 커널 규칙 대신 프로그램. kube-proxy를 대체하고 관측성을 준다 |
| Weave Net | 메시 오버레이 | 10.32.0.0/12 | 지원 | 2024년 저장소가 보관 상태가 됐다. 새 클러스터에는 쓰지 않는다 |

오버레이는 파드 패킷을 노드 사이의 UDP 패킷에 싸서 보내므로 물리 네트워크가 파드 대역을 몰라도 되지만, 캡슐화 비용이 든다. BGP 라우팅은 물리 라우터에 파드 대역을 광고해 캡슐화 없이 보내므로 빠르지만 네트워크 팀과의 협의가 필요하다. eBPF는 iptables 규칙을 커널 안의 프로그램으로 바꿔 규칙 수가 늘어도 성능이 유지된다.

{{< callout type="info" >}}
**CNI 선택 기준**
- NetworkPolicy가 필요하면 Calico나 Cilium. Flannel 단독은 정책이 없다([08](../08-security)장 6절)
- 큰 클러스터와 관측성이면 Cilium(eBPF). kube-proxy 없이 Service까지 처리한다
- 단순 구성과 학습이면 Flannel
- 온프레미스에서 라우터와 BGP로 붙이면 Calico
{{< /callout >}}

### 2.5 IPAM

| Type | 설명 | 왜 |
|:-----|:-----|:---|
| host-local | 노드마다 자기 조각(`podCIDR`) 안에서 파일로 관리 | 노드 사이에 조정이 필요 없다. 노드가 죽으면 조각째 회수 |
| dhcp | 외부 DHCP 서버에 묻는다 | 파드가 물리 네트워크의 주소를 받아야 할 때 |
| static | 고정 IP | 특수 목적 |
| 플러그인 자체 IPAM | Calico IPAM, Cilium cluster-pool | 노드 조각보다 유연한 블록 할당 |

IPAM이 위임 플러그인인 이유는 "어디서 IP를 받나"와 "어떻게 붙이나"가 다른 문제이기 때문이다. `bridge` 플러그인은 IP를 어디서 받든 veth를 브리지에 꽂는 일만 한다.

---

## 3. Service 기본

### 3.1 왜 필요한가

파드는 죽고 새로 만들어질 때마다 IP가 바뀐다. 04장의 롤아웃은 파드 셋을 통째로 갈아 끼우는 일이었다. 그 앞에 **바뀌지 않는 가상 IP와 이름**을 두고, 라벨 셀렉터로 뒤의 파드를 고르는 것이 Service다. 둘째 원리다.

```text
    Client
      │
      ▼
┌──────────────┐
│   Service    │  ClusterIP 10.96.0.100
│  셀렉터 매칭  │
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
 Pod  Pod  Pod  (app: nginx)
```

### 3.2 EndpointSlice

Service는 선언이고, 그 뒤에 지금 누가 있는지는 **EndpointSlice**가 적는다. 컨트롤러 매니저의 EndpointSlice 컨트롤러가 셀렉터에 맞는 파드의 IP와 준비 상태를 슬라이스에 쓰고, kube-proxy는 Service와 EndpointSlice를 지켜보다 규칙을 만든다.

```text
$ kubectl get endpointslices \
    -l kubernetes.io/service-name=web
NAME       TYPE  PORTS  ENDPOINTS
web-9k5n2  IPv4  80     10.244.1.6,
                        10.244.1.7
```

| 항목 | 뜻 | 왜 |
|:-----|:---|:---|
| 슬라이스당 100개 | 엔드포인트가 많으면 여러 슬라이스로 나뉜다(`--max-endpoints-per-slice`, 최대 1000) | 파드 하나가 바뀔 때 목록 전체가 아니라 슬라이스 하나만 모든 노드에 전파된다 |
| `ready` / `serving` / `terminating` | 트래픽을 받아도 되나 / 응답하고 있나 / 종료 중인가 | 04장의 롤아웃에서 종료 중인 파드가 목록에서 먼저 빠지는 이유 |
| `nodeName`, `zone` | 엔드포인트의 위치 | 4절의 토폴로지 기반 라우팅 |
| `kubernetes.io/service-name` 라벨 | 어느 Service의 것인가 | 조회 키 |

옛 `Endpoints` 객체는 Service 하나에 목록 전체를 담아서, 엔드포인트 하나가 바뀔 때마다 큰 객체 전체가 모든 노드의 kube-proxy로 전파됐다. 1.33부터 `Endpoints` API는 deprecated이고 `kubectl get endpoints`는 경고를 찍는다. 듀얼 스택과 토폴로지 정보 같은 새 기능은 EndpointSlice에만 있다.

### 3.3 kube-proxy와 동작 원리

Service는 **가상 객체**다. 프로세스도 인터페이스도 없고, 노드마다 도는 kube-proxy가 커널에 적은 규칙으로만 존재한다.

| 모드 | 어떻게 | 왜 |
|:-----|:------|:---|
| iptables | Service마다 체인, 엔드포인트마다 DNAT 규칙 | 기본값. 규칙이 수만 개가 되면 갱신과 조회가 느려진다 |
| nftables | 같은 일을 nftables의 맵과 verdict map으로 | 1.33 GA. 규칙 수와 무관하게 조회가 빠르고, 앞으로의 기본값 |
| ipvs | 커널의 L4 로드밸런서(해시 테이블) | 서비스가 수천이면 빠르고, rr·lc·sh 같은 알고리즘을 고른다 |
| kernelspace | Windows 커널 | Windows 노드 전용 |
| userspace | 프로세스가 중계 | 제거됐다 |

iptables 모드에서 ClusterIP 10.96.0.100:80의 패킷이 지나는 길은 이렇다.

```text
KUBE-SERVICES
  -d 10.96.0.100/32 -p tcp --dport 80
  -j KUBE-SVC-MCKPZ...
KUBE-SVC-MCKPZ...      (엔드포인트 3개)
  -m statistic --mode random
     --probability 0.3333 -j KUBE-SEP-A
  -m statistic --mode random
     --probability 0.5    -j KUBE-SEP-B
  -j KUBE-SEP-C
KUBE-SEP-A
  -s 10.244.1.8/32 -j KUBE-MARK-MASQ
  -p tcp -j DNAT
     --to-destination 10.244.1.8:80
```

| 단계 | 하는 일 | 왜 이렇게 |
|:-----|:-------|:---------|
| KUBE-SERVICES | 목적지 가상 IP와 포트로 Service 체인을 고른다 | 모든 나가는 패킷이 이 체인을 먼저 지난다 |
| KUBE-SVC | 엔드포인트 하나를 확률로 고른다 | 첫 규칙 1/3, 둘째 규칙 남은 것의 1/2, 마지막은 나머지. 합치면 균등 |
| KUBE-SEP | 목적지를 파드 IP로 바꾼다(DNAT) | 가상 IP는 여기서 사라진다. 응답은 conntrack이 기억한 매핑으로 되돌린다 |
| KUBE-MARK-MASQ | 파드가 자기 자신이 속한 Service를 부를 때 출발지도 바꾼다 | 헤어핀. 그러지 않으면 자기가 보낸 패킷의 응답을 자기가 받아 버린다 |

가상 IP는 어느 인터페이스에도 없다. `ping`이 안 되고, `arp`에도 없다. 커널이 나가는 패킷의 목적지를 규칙에서 바꿔치기할 뿐이다. 그래서 kube-proxy가 죽어도 이미 적힌 규칙은 남아 기존 Service는 계속 동작하고, 새 파드나 새 Service만 반영되지 않는다. 노드마다 같은 규칙이 있으므로 어느 노드의 파드든 같은 가상 IP를 쓴다.

### 3.4 Service 유형 개요

| 유형 | 용도 | 접근 범위 | 왜 층인가 |
|:-----|:-----|:---------|:---------|
| ClusterIP | 클러스터 안의 통신 | 안 | 기본. 가상 IP 하나 |
| NodePort | 노드 포트로 밖에 노출 | 밖 → 안 | ClusterIP에 노드 포트를 더한다 |
| LoadBalancer | 바깥 IP를 받는다 | 밖 → 안 | NodePort에 로드밸런서를 더한다 |
| ExternalName | 바깥 이름으로 보낸다 | 안 → 밖 | 규칙이 아니라 DNS CNAME |

```text
           외부 (인터넷)
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
┌──────┐   ┌──────┐   ┌────────┐
│NodePt│   │ LB   │   │Ingress │
└──┬───┘   └──┬───┘   └───┬────┘
   └──────────┼───────────┘
              ▼
        ┌──────────┐
        │ClusterIP │
        └────┬─────┘
             │
       ┌─────┼─────┐
       ▼     ▼     ▼
      Pod   Pod   Pod
```

NodePort와 LoadBalancer는 ClusterIP를 **포함**한다. LoadBalancer Service를 만들면 ClusterIP와 NodePort가 함께 생기고 바깥의 로드밸런서는 노드 포트로 트래픽을 넣는다. Ingress는 Service 유형이 아니라 그 앞의 L7 규칙이다.

---

## 4. ClusterIP

### 4.1 기본 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: ClusterIP      # 기본값
  selector:
    app: nginx
  ports:
  - name: http       # 여러 포트면 필수
    protocol: TCP
    port: 80           # Service 포트
    targetPort: http  # 파드 포트 이름
    appProtocol: http
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-alpine
        ports:
        - name: http
          containerPort: 80
```

`targetPort`에 숫자 대신 파드의 포트 **이름**을 적으면 컨테이너 포트가 바뀌어도 Service는 그대로다. 포트가 둘 이상이면 각각 `name`이 있어야 하고, 그 이름은 10절의 SRV 레코드에도 쓰인다. `appProtocol`은 kube-proxy에게는 뜻이 없고 Ingress나 메시가 프로토콜을 알아채는 힌트다.

### 4.2 명령형 생성

```bash
kubectl expose deploy nginx-deployment \
  --name=nginx-service \
  --port=80 --target-port=80 \
  --type=ClusterIP
```

### 4.3 셀렉터가 없는 Service

셀렉터를 비우면 EndpointSlice가 자동으로 생기지 않으므로 직접 쓴다. 클러스터 밖의 DB나 다른 클러스터의 IP를 Service 이름으로 부르고 싶을 때 쓰는 방법이고, 7절의 ExternalName이 못 하는 "IP 주소로 보내기"를 이렇게 한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ext-db
spec:
  ports:
  - port: 5432
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ext-db-1
  labels:
    kubernetes.io/service-name: ext-db
addressType: IPv4
ports:
- name: ""
  protocol: TCP
  port: 5432
endpoints:
- addresses: ["192.0.2.10"]
  conditions:
    ready: true
```

### 4.4 Headless Service

`clusterIP: None`이면 가상 IP가 없고, DNS가 **파드 IP들을 그대로** 돌려준다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None      # headless
  selector:
    app: mysql
  ports:
  - port: 3306
```

```text
$ nslookup mysql        (headless)
Address: 10.244.1.3
Address: 10.244.2.8
Address: 10.244.1.2

$ nslookup nginx-service.default.svc...
Address: 10.96.0.100      (가상 IP 하나)
```

kube-proxy 규칙이 없으므로 로드밸런싱은 클라이언트의 몫이다. 06장의 StatefulSet이 파드마다 `mysql-0.mysql` 같은 이름을 갖는 것이 이 Service 덕이다.

{{< callout type="info" >}}
**Headless Service 용도**
- **StatefulSet**: 파드마다 `pod-0.svc`, `pod-1.svc` 같은 고유 이름. Kafka, MySQL 복제, Cassandra
- **클라이언트 사이드 LB**: gRPC처럼 연결을 오래 유지하는 프로토콜. 가상 IP를 쓰면 연결 하나가 한 파드에 붙어 버리므로 클라이언트가 IP 목록을 받아 직접 나눈다
- **피어 디스커버리**: 분산 캐시나 합의 클러스터가 서로를 찾을 때
{{< /callout >}}

### 4.5 세션 유지와 토폴로지

| 필드 | 값 | 왜 |
|:-----|:---|:---|
| `sessionAffinity: ClientIP` | 같은 클라이언트 IP는 같은 파드로. `timeoutSeconds` 기본 10800 | 세션을 메모리에 두는 앱. kube-proxy가 `recent` 모듈로 출발지를 기억한다 |
| `internalTrafficPolicy: Local` | 클러스터 안에서 온 요청은 같은 노드의 파드로만 | 노드 간 트래픽 비용을 줄인다. 그 노드에 파드가 없으면 실패한다 |
| `trafficDistribution: PreferClose` | 같은 존의 엔드포인트를 우선 | 1.33 GA. 존 간 요금과 지연을 줄이되 없으면 다른 존으로 |
| `PreferSameZone`, `PreferSameNode` | 존 우선 / 노드 우선 | 1.35 GA. `PreferClose`보다 뜻이 분명한 이름 |
| `publishNotReadyAddresses: true` | 준비 안 된 파드도 목록에 | StatefulSet 부트스트랩처럼 준비되기 전에 서로 찾아야 할 때 |

`sessionAffinity`는 headless Service에서는 뜻이 없다. 규칙이 없기 때문이고, API 서버가 경고를 남긴다.

---

## 5. NodePort

### 5.1 개념

모든 노드에 같은 포트(30000-32767)를 열어 밖에서 들어오게 한다. 노드에 파드가 있든 없든 kube-proxy의 규칙이 파드가 있는 노드로 보낸다. 03장에서 파드가 없는 노드의 NodePort가 응답한 것이 그것이다.

```text
 외부
  │  http://<node-ip>:30080
  ▼
┌────────────────────────────┐
│ Node1:30080  Node2:30080   │
│      └──────┬──────┘       │
│             ▼              │
│        ┌─────────┐         │
│        │ Service │         │
│        └────┬────┘         │
│     ┌──────┼──────┐        │
│     ▼      ▼      ▼        │
│    Pod    Pod    Pod       │
└────────────────────────────┘
```

포트를 여는 프로세스는 없다. 노드에 들어온 패킷의 목적지 포트가 30080이면 `KUBE-NODEPORTS` 체인이 그것을 Service 체인으로 보내고, 3.3의 DNAT가 일어난다. 그래서 `ss -lntp`에는 30080이 보이지 않는데 요청은 된다.

### 5.2 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodeport-service
spec:
  type: NodePort
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
    nodePort: 30080   # 없으면 자동 배정
```

```bash
kubectl apply -f nodeport-service.yaml
kubectl get nodes -o wide
curl http://<NODE_IP>:30080
```

### 5.3 externalTrafficPolicy

밖에서 온 패킷이 파드가 없는 노드로 들어오면 다른 노드로 넘겨야 하는데, 그때 kube-proxy는 출발지를 노드 주소로 바꾼다(SNAT). 응답이 돌아올 길이 그 노드뿐이기 때문이다. 대가는 파드가 클라이언트의 진짜 IP를 못 보는 것이다.

| 값 | 동작 | 클라이언트 IP | 왜 |
|:---|:-----|:------------|:---|
| `Cluster`(기본) | 어느 노드로 들어와도 모든 파드로 분산 | 노드 주소로 바뀐다 | 홉이 하나 늘지만 어느 노드든 응답한다 |
| `Local` | 그 노드에 있는 파드로만 | 보존된다 | 파드가 없는 노드는 패킷을 버린다. LB가 `healthCheckNodePort`로 파드 있는 노드만 고르게 한다 |

`Local`은 로드밸런서와 짝이다. LoadBalancer Service에 `Local`을 주면 `healthCheckNodePort`가 자동 배정되고, 클라우드 LB는 그 포트에 `/healthz`를 물어 파드가 있는 노드에만 트래픽을 보낸다. 노드 자신에서 자기 NodePort로 보낸 요청은 "안에서 온 것"으로 취급되어 `Local`이어도 클러스터 정책을 탄다.

### 5.4 제약사항

| 제약 | 설명 | 왜 |
|:-----|:-----|:---|
| 포트 범위 | 30000-32767, `--service-node-port-range`로 변경 | 노드의 다른 서비스와 겹치지 않게 |
| 포트당 하나 | 같은 포트에 Service 둘 불가 | 노드 하나에 포트는 하나 |
| 노드 IP 의존 | 노드가 바뀌면 클라이언트 설정도 | 노드는 소모품이다. 그래서 6절의 LB가 필요하다 |
| 보안 | 모든 노드에 포트가 열린다 | 방화벽으로 출발지를 제한한다 |

---

## 6. LoadBalancer

### 6.1 개념

클라우드의 로드밸런서를 만들어 바깥 IP를 받는다. 내부적으로는 NodePort와 ClusterIP가 함께 생기고, 로드밸런서는 노드들의 그 포트로 트래픽을 넣는다. 만드는 주체는 cloud-controller-manager의 Service 컨트롤러다. 쿠버네티스 자신은 로드밸런서를 모르고, 클라우드 연동 컨트롤러가 Service를 지켜보다 클라우드 API를 부른다.

```text
┌──────────────────────────┐
│  Cloud Load Balancer     │
│  EXTERNAL-IP             │
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│  LoadBalancer Service    │
│  (NodePort 자동 생성)     │
└───────────┬──────────────┘
            │
      ┌─────┼─────┐
      ▼     ▼     ▼
     Pod   Pod   Pod
```

### 6.2 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: loadbalancer-service
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  externalTrafficPolicy: Local
  loadBalancerSourceRanges:
  - 203.0.113.0/24
```

```text
$ kubectl get svc loadbalancer-service
TYPE          CLUSTER-IP   EXTERNAL-IP
LoadBalancer  10.96.45.12  203.0.113.10
PORT(S)  80:31234/TCP
```

| 필드 | 뜻 | 왜 |
|:-----|:---|:---|
| `status.loadBalancer.ingress` | 컨트롤러가 적어 주는 바깥 IP나 호스트 이름 | `<pending>`이면 적어 줄 컨트롤러가 없는 것 |
| `loadBalancerClass` | 어느 구현이 맡을지 | 한 클러스터에 LB 구현이 둘일 때 |
| `allocateLoadBalancerNodePorts: false` | NodePort를 만들지 않는다 | LB가 파드에 직접 보내는 구현(클라우드 VPC CNI)에서 포트 낭비를 막는다 |
| `loadBalancerSourceRanges` | 허용할 출발지 대역 | 클라우드 방화벽 규칙으로 옮겨진다 |
| `externalTrafficPolicy: Local` | 5.3. 클라이언트 IP 보존 | LB가 `healthCheckNodePort`로 노드를 고른다 |

### 6.3 L4 vs L7

| 구분 | L4 (LoadBalancer) | L7 (Ingress, Gateway) | 왜 |
|:-----|:-----------------|:---------------------|:---|
| OSI 계층 | 전송(TCP/UDP) | 애플리케이션(HTTP) | L4는 내용을 모른다 |
| 분산 기준 | IP, 포트 | 호스트, 경로, 헤더, 쿠키 | L7은 요청을 읽는다 |
| TLS | 통과(passthrough) 또는 종료 | 종료가 보통 | 요청을 읽으려면 풀어야 한다 |
| 사용 사례 | DB, gRPC, 일반 TCP, API 서버 앞(03장) | 웹 라우팅, 여러 서비스를 도메인 하나로 | |
| 비용 | Service마다 LB 하나 | LB 하나 뒤에 여러 서비스 | 8절이 필요한 이유 |

### 6.4 온프레미스: MetalLB와 그 밖

클라우드가 아니면 바깥 IP를 적어 줄 컨트롤러가 없어 `EXTERNAL-IP`가 `<pending>`에 머문다. **MetalLB**가 그 자리를 채운다. IP 풀에서 하나를 골라 Service에 적고, L2 모드면 노드 하나가 그 IP의 ARP에 답하며, BGP 모드면 라우터에 경로를 광고한다.

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
spec:
  ipAddressPools:
  - default-pool
```

| 구현 | 방식 | 왜 |
|:-----|:-----|:---|
| MetalLB | L2(ARP/NDP) 또는 BGP | 온프레미스의 표준 |
| kube-vip | VIP를 노드에 띄운다. 컨트롤 플레인 VIP도 | 03장의 API 서버 LB까지 한 도구로 |
| k3s ServiceLB | 노드마다 프록시 파드를 띄우고 노드 IP를 바깥 IP로 적는다 | 학습용. `EXTERNAL-IP`에 노드 IP들이 그대로 온다 |
| `externalIPs` | 사람이 IP를 적는다 | 그 IP를 가진 노드로 들어오면 kube-proxy가 받는다. 광고는 하지 않는다 |

```yaml
spec:
  type: ClusterIP
  externalIPs:
  - 192.168.1.100
```

---

## 7. ExternalName

바깥 도메인을 가리키는 **DNS CNAME**을 만든다. 프록시가 아니라 이름 해석 수준의 매핑이다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: db.provider.example
```

```text
$ nslookup external-db     (파드 안에서)
external-db.default.svc.cluster.local
  canonical name = db.provider.example
```

| 주의 | 왜 |
|:-----|:---|
| IP 주소를 적을 수 없다 | CNAME은 이름만 가리킨다. IP는 4.3의 셀렉터 없는 Service로 |
| HTTP `Host` 헤더는 바뀌지 않는다 | 클라이언트는 `external-db`로 요청하므로 상대 서버가 그 이름을 모르면 거절한다 |
| TLS 인증서 이름이 다르다 | 인증서는 `db.provider.example`인데 클라이언트가 검증하는 이름은 `external-db` |
| HTTP가 아닌 프로토콜은 대개 괜찮다 | DB 드라이버는 이름을 풀어 IP로 붙을 뿐이다 |

**사용 사례**: 외부 DB나 API를 클러스터 이름으로 추상화, 마이그레이션 과도기(바깥 DB를 안으로 옮길 때 Service 종류만 바꾼다), 환경별 엔드포인트 통일.

---

## 8. Ingress

### 8.1 왜 필요한가

NodePort와 LoadBalancer만으로는 서비스 수만큼 로드밸런서와 IP가 늘고, URL 라우팅과 TLS 종료가 각 서비스에 흩어진다. **Ingress**는 진입점 하나에서 호스트와 경로로 나누는 L7 규칙이다. 셋째 원리의 첫 얼굴이다.

```text
        Ingress Controller
       (traefik / haproxy)
              │
   ┌──────────┼──────────┐
 /api        /web      /admin
   ▼          ▼          ▼
 api-svc   web-svc   admin-svc
   │          │          │
  Pods      Pods       Pods
```

### 8.2 구성 요소

| 구성 | 역할 | 왜 |
|:-----|:-----|:---|
| Ingress 리소스 | 라우팅 규칙 선언 | 규칙일 뿐 스스로는 아무것도 못 한다 |
| Ingress 컨트롤러 | 규칙을 읽어 실제 L7 프록시를 설정하는 파드 | 프록시(Traefik, HAProxy, Envoy)가 트래픽을 받는다 |
| IngressClass | 여러 컨트롤러 중 누가 맡나 | `ingressclass.kubernetes.io/is-default-class` 어노테이션이 기본 클래스 |
| 컨트롤러의 Service | 컨트롤러 파드 앞의 LoadBalancer나 NodePort | 결국 트래픽은 6절로 들어온다 |

Ingress 리소스만 만들면 아무 일도 일어나지 않는다. 컨트롤러가 그 클래스의 Ingress를 지켜보다 자기 프록시 설정을 다시 쓰고, 상태의 `ADDRESS`에 자기 LB 주소를 적어 준다.

{{< callout type="warning" >}}
**Ingress API는 동결됐고, ingress-nginx는 은퇴했다.** 쿠버네티스는 Ingress API를 더 발전시키지 않고(제거 계획은 없다) 새 기능은 Gateway API에만 넣는다. 가장 널리 쓰이던 컨트롤러 ingress-nginx는 2025년 11월 은퇴가 공지되어 **2026년 3월 이후 릴리스도, 버그 수정도, 보안 패치도 없다.** 프로젝트는 "아직 쓰지 않는다면 배포하지 말고 Gateway API 구현을 골라라"라고 적었다. 기존 클러스터의 ingress-nginx는 동작하지만 취약점이 고쳐지지 않으므로, Gateway API 구현(9절)이나 유지되는 다른 컨트롤러(Traefik, HAProxy Ingress, Contour, 클라우드 자체 컨트롤러, NGINX Gateway Fabric)로 옮긴다. `ingress2gateway` 도구가 Ingress 리소스를 Gateway API 리소스로 바꿔 준다.
{{< /callout >}}

### 8.3 컨트롤러 설치

컨트롤러는 보통 Helm 차트([11](../11-helm)장)나 매니페스트로 깔고, 그 Service 유형이 환경에 맞아야 한다. 클라우드면 LoadBalancer, 온프레미스면 MetalLB나 NodePort다.

```bash
# 예: Traefik
helm repo add traefik \
  https://traefik.github.io/charts
helm install traefik traefik/traefik \
  -n traefik --create-namespace
kubectl get ingressclass
```

### 8.4 호스트 기반 라우팅

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host-ingress
spec:
  ingressClassName: traefik
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
```

호스트 라우팅은 HTTP의 `Host` 헤더(HTTPS면 SNI)로 나눈다. IP 하나로 도메인 여럿을 받는 것이 이것이고, 규칙에 없는 호스트로 오면 컨트롤러가 404를 돌려준다. `*.example.com` 같은 와일드카드 호스트도 된다.

### 8.5 경로 기반 라우팅

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
spec:
  ingressClassName: traefik
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
      - path: /web
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

| pathType | 뜻 | 왜 |
|:---------|:---|:---|
| `Prefix` | `/`로 나뉜 조각 단위의 앞부분 일치. `/api`는 `/api/v1`과 맞고 `/apix`와는 안 맞는다 | 가장 흔한 라우팅 |
| `Exact` | 문자 그대로 일치. 끝의 `/` 유무도 다르다 | 헬스체크 경로 하나만 |
| `ImplementationSpecific` | 컨트롤러가 정한다(정규식 등) | 이식성이 없다 |

경로는 **그대로 전달**된다. `/api/users`가 `api-service`로 갈 때 백엔드도 `/api/users`를 받는다. 백엔드가 `/users`만 안다면 경로를 고쳐 써야 하는데, Ingress 규격에는 그 기능이 없어 컨트롤러마다 다른 어노테이션(rewrite-target 같은)을 쓴다. 이것이 9절에서 Gateway API가 필터로 표준화한 첫 번째 것이다.

### 8.6 TLS 설정

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - secure.example.com
    secretName: tls-secret
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 80
```

```bash
kubectl create secret tls tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

TLS는 **Ingress 컨트롤러에서 끝난다.** 컨트롤러가 `kubernetes.io/tls` 타입 Secret(04장 9절)의 인증서로 클라이언트와 TLS를 맺고, 백엔드로는 평문 HTTP를 보낸다. `hosts`의 이름이 인증서의 이름(SAN)과 맞아야 브라우저가 경고하지 않는다. 인증서 발급과 갱신은 cert-manager가 Let's Encrypt 같은 CA와 자동으로 하고, Secret을 갈아 끼우면 컨트롤러가 다시 읽는다.

---

## 9. Gateway API

### 9.1 Ingress의 한계

| 문제 | 설명 | 왜 |
|:-----|:-----|:---|
| 역할 구분 없음 | 리소스 하나에 인프라(어느 LB, 어느 포트)와 앱 라우팅이 섞인다 | 팀마다 다른 권한을 줄 수 없다 |
| 프로토콜 | HTTP/HTTPS만 | TCP, UDP, gRPC, TLS 패스스루는 규격 밖 |
| 어노테이션 종속 | 재작성, 가중치, 타임아웃이 컨트롤러별 어노테이션 | 컨트롤러를 바꾸면 규칙을 다시 쓴다 |
| 검증 없음 | 어노테이션 값은 API 서버가 검증하지 못한다 | 오타가 배포 뒤에 드러난다 |

### 9.2 3계층 구조

```text
 GatewayClass   (인프라 제공자)
      │  어떤 구현, 어떤 컨트롤러
      ▼
 Gateway        (클러스터 운영자)
      │  리스너: 포트, 프로토콜, TLS
      ▼
 Routes         (앱 개발자)
  ├─ HTTPRoute   GA
  ├─ GRPCRoute   GA
  ├─ TCPRoute    GA (v1.6)
  ├─ UDPRoute    GA (v1.6)
  └─ TLSRoute    실험 채널
```

셋째 원리의 역할 분리다. 인프라 제공자가 GatewayClass로 "이 구현을 쓴다"를 정하고, 운영자가 Gateway로 리스너와 인증서를 열고, 개발자는 자기 네임스페이스의 Route를 그 Gateway에 붙인다. 다른 네임스페이스의 Service를 가리키려면 `ReferenceGrant`로 허락을 받아야 한다. 리소스는 코어 API가 아니라 CRD라 `standard-install.yaml`을 적용해 설치하고, 구현체(Traefik, Envoy Gateway 등)가 함께 깔아 주기도 한다.

### 9.3 리소스 예제

```yaml
apiVersion:
  gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-class
spec:
  controllerName:
    example.com/gateway-controller
---
apiVersion:
  gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: example-gateway
spec:
  gatewayClassName: example-class
  listeners:
  - name: http
    protocol: HTTP
    port: 80
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      certificateRefs:
      - name: tls-secret
    allowedRoutes:
      namespaces:
        from: All
---
apiVersion:
  gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
spec:
  parentRefs:
  - name: example-gateway
  hostnames:
  - "www.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
    backendRefs:
    - name: api-service
      port: 8080
```

| 요소 | 뜻 | Ingress와의 차이 |
|:-----|:---|:---------------|
| `listeners` | Gateway가 여는 포트와 프로토콜, TLS | Ingress는 컨트롤러 설정에 숨어 있었다 |
| `matches` | 경로, 헤더, 메서드, 쿼리로 매칭 | Ingress는 호스트와 경로뿐 |
| `filters` | 헤더 수정, 리다이렉트, URL 재작성, 요청 미러링 | 어노테이션이 표준 필드가 됐다 |
| `backendRefs` | 여러 백엔드와 가중치 | 9.4 |

### 9.4 트래픽 분할 (Canary)

```yaml
apiVersion:
  gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
  - name: example-gateway
  rules:
  - backendRefs:
    - name: app-v1
      port: 80
      weight: 80
    - name: app-v2
      port: 80
      weight: 20
```

04장의 카나리는 파드 수의 비율이었다. 여기서는 `weight`가 요청의 비율이라 파드 하나로도 1%를 보낼 수 있고, 헤더 매칭과 합치면 "특정 사용자만 v2로"도 된다.

### 9.5 Ingress vs Gateway API

| 기능 | Ingress | Gateway API | 왜 |
|:-----|:--------|:------------|:---|
| 프로토콜 | HTTP/HTTPS | HTTP, gRPC, TCP, UDP, TLS | Route 종류가 나뉘어 있다 |
| 트래픽 분할 | 컨트롤러별 어노테이션 | `weight` 필드 | 표준 |
| 역할 분리 | 없음 | GatewayClass, Gateway, Route | 팀별 권한 |
| 설정 방식 | 어노테이션 | spec 필드와 필터 | 스키마 검증 |
| 상태 | 동결 | 활발히 발전. 표준 채널과 실험 채널 | 새 기능은 여기만 |
| 메시 | 없음 | GAMMA: 같은 HTTPRoute를 Service에 붙여 클러스터 안 트래픽도 | 11절 |

{{< callout type="info" >}}
**선택 기준**
- 새 프로젝트는 Gateway API를 먼저 검토한다. Envoy Gateway, Istio, Cilium, Traefik, kgateway, NGINX Gateway Fabric, Contour와 주요 클라우드가 구현한다
- 기존 Ingress가 HTTP 라우팅과 TLS로 충분하고 컨트롤러가 유지되고 있다면 급하게 옮길 필요는 없다. 단 ingress-nginx는 예외다(8.2)
- 표준 채널에 없는 기능(TLSRoute 등)은 구현체마다 지원이 다르므로 확인한다
{{< /callout >}}

---

## 10. DNS와 CoreDNS

Service의 이름을 IP로 바꿔 주는 것은 클러스터 안의 DNS 서버 CoreDNS다. 파드는 kubelet이 써 준 `/etc/resolv.conf`로 그것을 찾는다.

### 10.1 Service DNS FQDN

```text
<service>.<namespace>.svc.cluster.local

예) web.default.svc.cluster.local
```

```bash
# 같은 네임스페이스
curl web-service

# 다른 네임스페이스
curl web-service.apps
curl web-service.apps.svc.cluster.local
```

| 레코드 | 대상 | 값 | 왜 |
|:------|:-----|:---|:---|
| A / AAAA | 보통 Service | ClusterIP | 이름이 가상 IP로 |
| A / AAAA | headless Service | 파드 IP 전부 | 4.4 |
| SRV | 이름 있는 포트 `_http._tcp.web.default.svc.cluster.local` | 포트 번호와 호스트 | 포트까지 이름으로 찾을 때 |
| CNAME | ExternalName | 바깥 이름 | 7절 |

### 10.2 Pod DNS

```text
<ip-dashed>.<ns>.pod.cluster.local

Pod IP 10.244.2.5
→ 10-244-2-5.default.pod.cluster.local
```

파드 IP를 이름으로 바꾼 것이라 쓸모는 적다. 파드에 진짜 이름을 주는 것은 `hostname`과 `subdomain` 필드다. `subdomain`과 같은 이름의 headless Service가 있으면 `<hostname>.<subdomain>.<ns>.svc.cluster.local`이 A 레코드를 받고, StatefulSet의 `mysql-0.mysql`이 바로 이 규칙으로 만들어진다.

### 10.3 DNS 계층

```text
cluster.local
 ├── svc
 │   ├── default/web-service
 │   └── apps/api-service
 └── pod
     └── default/10-244-1-5
```

### 10.4 CoreDNS 구성

```text
kube-system 네임스페이스
 ├── CoreDNS 파드 × 2 (Deployment)
 ├── kube-dns Service (10.96.0.10)
 └── ConfigMap coredns (Corefile)
```

```text
.:53 {
    errors
    health
    ready
    kubernetes cluster.local {
      pods insecure
      fallthrough in-addr.arpa ip6.arpa
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
    loadbalance
}
```

| 플러그인 | 하는 일 | 왜 |
|:--------|:-------|:---|
| `kubernetes` | Service와 파드 레코드를 API 서버에서 만든다 | CoreDNS도 API 서버를 지켜보는 클라이언트일 뿐이다 |
| `forward . /etc/resolv.conf` | 클러스터 이름이 아니면 노드의 상위 DNS로 | 파드가 인터넷 이름을 풀 수 있는 이유 |
| `cache 30` | 30초 캐시 | 파드 수천 개의 질의를 API 서버 대신 흡수 |
| `loop`, `reload`, `loadbalance` | 순환 감지, Corefile 변경 반영, 응답 순서 섞기 | headless 응답의 순서를 돌려 클라이언트 분산 |
| `health`, `ready`, `prometheus` | 프로브와 메트릭 | 09장 |

Service 이름은 `kube-dns`인데 파드는 CoreDNS다. 옛 구현의 이름을 Service가 물려받아 kubelet의 `--cluster-dns`(보통 Service 대역의 열 번째 주소)가 그대로 쓰인다.

### 10.5 파드의 resolv.conf

```text
# /etc/resolv.conf (kubelet이 주입)
# search는 실제로 한 줄이다
nameserver 10.96.0.10
search default.svc.cluster.local
       svc.cluster.local cluster.local
options ndots:5
```

`ndots:5`가 짧은 이름이 되는 이유이자 성능 함정이다. 점이 다섯 개 미만인 이름은 검색 목록을 먼저 붙여 본다. `web`은 `web.default.svc.cluster.local`로 한 번에 풀리지만, `api.example.com`(점 둘)도 `api.example.com.default.svc.cluster.local`, `...svc.cluster.local`, `...cluster.local`을 차례로 물어 세 번 실패한 뒤에야 원래 이름을 묻는다. 바깥 이름을 자주 부르는 파드는 이름 끝에 점을 찍어 `api.example.com.`으로 쓰거나 `dnsConfig`로 `ndots`를 줄인다.

| `dnsPolicy` | 뜻 | 왜 |
|:-----------|:---|:---|
| `ClusterFirst`(기본) | 클러스터 이름은 CoreDNS, 나머지는 상위로 | 보통의 파드 |
| `ClusterFirstWithHostNet` | hostNetwork 파드도 클러스터 DNS를 | hostNetwork면 기본이 `Default`로 떨어지기 때문 |
| `Default` | 노드의 resolv.conf 그대로 | 클러스터 이름이 필요 없는 노드 에이전트 |
| `None` | `dnsConfig`만 | 완전히 직접 지정 |

### 10.6 디버깅

```bash
kubectl get pods -n kube-system \
  -l k8s-app=kube-dns
kubectl get svc -n kube-system kube-dns
kubectl logs -n kube-system \
  -l k8s-app=kube-dns

# DNS 테스트
kubectl run test --image=busybox:1.36 \
  --rm -it --restart=Never -- \
  nslookup web-service
```

노드 수가 많으면 노드마다 캐시 DNS를 두는 NodeLocal DNSCache로 CoreDNS의 부하와 conntrack 경합을 줄인다.

---

## 11. Service Mesh 개요

Service Mesh는 서비스 사이의 트래픽을 애플리케이션 코드 밖에서 가로채 **암호화, 정책, 관측**을 투명하게 붙이는 계층이다. 가로채는 방법이 둘이다.

| 방식 | 어떻게 | 왜 |
|:-----|:------|:---|
| 사이드카 | 파드마다 Envoy 같은 프록시를 넣고 iptables로 트래픽을 우회시킨다 | 파드 단위의 완전한 제어. 대신 파드마다 프록시의 메모리와 지연 |
| 사이드카 없음 | 노드마다 L4 프록시(Istio ambient의 ztunnel)나 eBPF(Cilium)로 처리하고, L7이 필요한 곳에만 waypoint 프록시 | 앱 파드를 건드리지 않고 자원이 적게 든다. Istio ambient는 2024년 11월 GA |

| 기능 | 제공 내용 | 왜 메시가 하나 |
|:-----|:---------|:-------------|
| 상호 TLS(mTLS) | 서비스 사이 자동 암호화와 신원 | 앱마다 인증서를 다루지 않게 |
| 트래픽 정책 | 카나리, 재시도, 타임아웃, 서킷 브레이커 | 코드가 아니라 설정으로 |
| 관측성 | 분산 추적, 요청 메트릭, 접근 로그 | 모든 호출이 프록시를 지나니 다 보인다 |
| 정책 | 어느 서비스가 어느 서비스를 부를 수 있나 | NetworkPolicy보다 세밀한 L7 인가 |

| 구현체 | 방식 | 특징 |
|:------|:-----|:-----|
| Istio | Envoy 사이드카 또는 ambient(ztunnel + waypoint) | 기능이 가장 많고 복잡하다 |
| Linkerd | Rust로 쓴 경량 프록시 | 단순함과 낮은 오버헤드 |
| Cilium Service Mesh | eBPF | 사이드카 없이 CNI가 곧 메시 |

Gateway API의 GAMMA는 같은 HTTPRoute를 Gateway 대신 Service에 붙여 클러스터 안 트래픽의 라우팅을 적는 방식이다. 바깥 트래픽(Gateway)과 안 트래픽(메시)을 한 규격으로 다루려는 것이고, 새 메시 기능은 이 방향으로 모인다. 메시는 공짜가 아니다. 서비스 수십 개 미만이면 NetworkPolicy와 Ingress로 충분한 경우가 많다.

---

## 12. 네트워킹 문제 해결

### 12.1 파드 네트워크 확인

```bash
kubectl get pods -o wide
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route
kubectl exec -it <pod> -- \
  cat /etc/resolv.conf
# 셸이 없는 이미지면
kubectl debug -it <pod> \
  --image=busybox:1.36 --target=<ctr>
```

### 12.2 Service / EndpointSlice 확인

```bash
kubectl get svc
kubectl get endpointslices \
  -l kubernetes.io/service-name=<svc>
kubectl describe svc <svc>

# 안에서 접속 테스트
kubectl run curl \
  --image=curlimages/curl \
  -it --rm --restart=Never -- \
  curl -sv http://<svc>
```

| 증상 | 확인 | 왜 |
|:-----|:-----|:---|
| EndpointSlice가 비어 있다 | Service의 `selector`와 파드의 라벨 | 라벨이 다르면 뒤에 아무도 없다 |
| 엔드포인트는 있는데 `ready: false` | 파드의 readinessProbe | 준비 안 된 파드는 목록에서 빠진다 |
| 연결은 되는데 거절 | `targetPort`와 컨테이너가 실제로 듣는 포트 | 이름으로 적었으면 파드 포트 이름과 일치하는지 |
| 어떤 노드에서만 안 된다 | 그 노드의 kube-proxy와 CNI 파드 | 규칙은 노드마다 따로 있다 |
| 밖에서 특정 노드로만 안 된다 | `externalTrafficPolicy: Local` | 파드 없는 노드는 버린다 |
| 파드 사이가 막힌다 | NetworkPolicy | 08장 6절 |

### 12.3 DNS 확인

```bash
kubectl run test --image=busybox:1.36 \
  --rm -it --restart=Never -- \
  nslookup <svc>
kubectl logs -n kube-system \
  -l k8s-app=kube-dns
```

이름이 안 풀리면 순서대로 본다. 파드의 `nameserver`가 `kube-dns` Service IP인가, 그 Service의 EndpointSlice에 CoreDNS 파드가 있나, CoreDNS 로그에 오류가 있나, `ndots`로 인한 지연인가.

### 12.4 CNI / kube-proxy

```bash
# CNI 설정과 플러그인 파드
ls -la /etc/cni/net.d/
kubectl get pods -n kube-system \
  | grep -E 'calico|flannel|cilium'

# kube-proxy 모드와 규칙
kubectl logs -n kube-system \
  -l k8s-app=kube-proxy
iptables-save -t nat | grep <svc>
nft list ruleset | grep <svc>
ipvsadm -Ln
```

### 12.5 Ingress / Gateway

```bash
kubectl describe ingress <name>
kubectl get gateway,httproute -A
kubectl describe httproute <name>
kubectl logs -n <ctrl-ns> \
  -l app.kubernetes.io/name=traefik
```

Ingress의 `ADDRESS`가 비어 있으면 컨트롤러가 그 클래스를 맡지 않은 것이고, HTTPRoute의 상태 조건(`Accepted`, `ResolvedRefs`)이 False면 parentRef나 backendRef가 잘못된 것이다. 진단 순서 전체는 [14](../14-troubleshooting)장 7절과 10절에서 본다.

---

## 핵심 정리

| 계층 | 구성 요소 | 역할 | 왜 |
|:-----|:---------|:-----|:---|
| L2/L3 | CNI 플러그인 | 파드 IP 할당, 노드 간 통신 | 규칙은 쿠버네티스, 구현은 플러그인 |
| L4 | kube-proxy, Service, EndpointSlice | 가상 IP를 파드로 | 가상 IP는 커널 규칙 안에만 있다 |
| L7 | Ingress, Gateway API | HTTP 라우팅, TLS 종료 | 규칙은 객체, 일은 컨트롤러 |
| L7+ | Service Mesh | mTLS, 트래픽 제어, 관측 | 코드 밖에서 |
| 이름 | CoreDNS | 이름을 IP로 | `ndots:5`와 검색 목록 |

| 상황 | 권장 유형 | 왜 |
|:-----|:---------|:---|
| 클러스터 안 통신 | ClusterIP | 가상 IP와 이름이면 충분 |
| StatefulSet, 클라이언트 LB | Headless | 파드 IP를 그대로 |
| 개발·테스트 외부 접근 | NodePort | 노드 IP만 알면 된다 |
| 프로덕션 L4 외부 접근 | LoadBalancer + `externalTrafficPolicy: Local` | 바깥 IP와 클라이언트 IP 보존 |
| HTTP/HTTPS 라우팅 | Gateway API(새 프로젝트), Ingress(유지되는 컨트롤러) | ingress-nginx는 은퇴 |
| 외부 서비스 참조 | ExternalName(이름), 셀렉터 없는 Service(IP) | CNAME과 EndpointSlice의 차이 |

{{< callout type="info" >}}
**용어 정리**
- **CNI**: 런타임이 파드에 네트워크를 붙일 때 부르는 플러그인 규격. ADD/DEL/CHECK/GC/STATUS
- **podCIDR**: 노드마다 잘린 파드 대역(/24). 컨트롤러 매니저가 배정
- **오버레이 / BGP**: 노드 사이를 UDP 캡슐화로 잇는 방식 / 라우터에 파드 대역을 광고하는 방식
- **Service / ClusterIP**: 파드 앞의 고정 가상 IP. 인터페이스 없이 커널 규칙으로만 존재
- **EndpointSlice**: Service 뒤의 파드 IP 목록. 100개 단위, ready/serving/terminating
- **kube-proxy**: Service를 iptables, nftables, IPVS 규칙으로 옮겨 적는 노드 에이전트
- **DNAT / conntrack**: 목적지를 파드 IP로 바꾸는 것 / 그 매핑을 기억해 응답을 되돌리는 커널 표
- **NodePort / LoadBalancer / ExternalName**: 노드 포트 / 바깥 IP / DNS CNAME
- **externalTrafficPolicy**: `Cluster`는 SNAT 뒤 분산, `Local`은 클라이언트 IP 보존
- **Ingress / IngressClass**: L7 규칙 / 누가 맡나. API 동결
- **Gateway API**: GatewayClass, Gateway, Route의 3계층 후계 규격. 표준·실험 채널
- **CoreDNS / kube-dns**: 클러스터 DNS 파드 / 그 Service 이름
- **ndots**: 이 수보다 점이 적은 이름은 검색 목록을 먼저 붙여 본다. 기본 5
- **Service Mesh / GAMMA**: 서비스 간 트래픽 계층 / Gateway API로 메시를 적는 방식
{{< /callout >}}
