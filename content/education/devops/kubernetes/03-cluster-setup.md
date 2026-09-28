---
title: "03. 클러스터 구성"
date: 2026-04-23
weight: 3
---

[01. 입문](../01-introduction)에서 컨트롤 플레인과 워커의 역할을, [02. 핵심 개념](../02-core-concepts)에서 모든 컴포넌트가 API 서버 하나만 바라보며 각자 제 몫을 한다는 것을 봤다. 이 장은 그 구조를 실제 기계 위에 세우는 절차다. 원리는 셋이다. 첫째, **클러스터를 세운다는 것은 노드마다 런타임과 kubelet을 두고, 인증서와 kubeconfig로 API 서버에 등록시키는 일이다.** kubeadm의 init과 join은 그 절차의 자동화이고, 무슨 도구를 쓰든 결과물은 같다. PKI 디렉터리 하나, kubeconfig 몇 개, 정적 파드 매니페스트 네 개, 그리고 조인 토큰. 둘째, **고가용성은 상태와 결정을 따로 본다.** 상태는 etcd에 있고 과반수가 살아야 쓸 수 있다. 결정은 컨트롤러와 스케줄러가 하는데 리스로 한 대만 일한다. API 서버는 상태가 없어 몇 대를 두어도 상관없다. 셋째, **설치 방법의 선택은 "컨트롤 플레인을 누가 운영하는가"의 문제다.** 학습이면 컨테이너 하나가 컨트롤 플레인이고, 운영이면 kubeadm으로 세 대를 세우거나 클라우드에 맡긴다. 이 PC의 Docker Desktop 위에서 k3s로 서버 1대와 에이전트 1대, 서버 3대와 HAProxy, 그리고 etcd 3대를 실제로 띄우고 죽여 봤고, kubeadm v1.34.1은 컨테이너 안에서 오프라인 단계만 돌려 인증서와 kubeconfig와 매니페스트를 직접 열어 봤다.

---

## 1. 설치 방법 선택

쿠버네티스에는 "설치 방법"이 하나가 아니다. 컨트롤 플레인을 어디에 두고 누가 운영하는가에 따라 도구가 갈린다. 01장 끝에서 미뤄 둔 "무엇으로 시작할까"의 답이 이 절이다.

### 1.1 배포 환경 분류

```text
┌─────────────┬─────────────────┐
│  로컬/학습  │   프로덕션      │
├─────────────┼─────────────────┤
│ Minikube    │ kubeadm         │
│ kind        │ Kops (AWS)      │
│ k3s         │ Rancher/RKE2    │
│ Docker      │ OpenShift       │
│  Desktop    ├─────────────────┤
│ kubeadm     │ 관리형 서비스    │
│  (1노드)    │ GKE / EKS / AKS │
└─────────────┴─────────────────┘
```

왼쪽은 컨트롤 플레인이 내 노트북 안에 있고, 오른쪽은 여러 대의 기계 또는 클라우드에 있다. 셋째 원리대로 갈린 것이다. 같은 kubeadm이 양쪽에 다 있는 이유는, 노드 한 대로 세우면 학습용이고 세 대로 세우면 운영용이기 때문이다.

### 1.2 경량 배포 도구 비교

| 도구 | 어떻게 동작하나 | 노드 | 왜 고르나 |
|:-----|:---------------|:-----|:---------|
| **Minikube** | VM 또는 Docker 드라이버 위에 노드 하나 | 단일(다중 가능) | 공식 학습 도구, 애드온 명령이 많다 |
| **kind** | Docker 컨테이너 하나가 노드 하나(Kubernetes IN Docker) | 단일/다중 | 노드 여러 개를 설정 파일 하나로, CI에서 쓰기 좋다 |
| **k3s** | 컨트롤 플레인 전체가 바이너리 하나, 기본 저장소는 SQLite | 단일/다중 | 가장 가볍다. 이 PC에서 서버 502MB, 에이전트 158MB |
| **Docker Desktop** | 설정의 토글 하나로 켜는 단일 노드 | 단일 | 이미 Docker를 쓰면 설치가 없다 |

이 시리즈가 k3s를 고른 이유는 셋째 원리의 학습 쪽 극단이기 때문이다. 컨테이너 하나가 노드 하나여서 `docker run` 두 번이면 2노드 클러스터가 되고, `docker stop`으로 노드 장애를 흉내 낼 수 있다. 02장에서 컨테이너 하나가 13초 만에 Ready가 됐고, 이 장에서는 에이전트 노드가 서버에 붙는 데 9초가 걸렸다. 무엇을 골라도 결과물은 첫째 원리의 그것이다. kubeconfig 하나를 받아 `kubectl`이 붙으면 그 뒤의 장들은 도구와 무관하다.

### 1.3 자체 운영 vs 관리형

| 항목 | 직접 운영(kubeadm, Kops, RKE2) | 관리형(GKE/EKS/AKS) | 왜 갈리나 |
|:-----|:-----------------------------|:-------------------|:---------|
| 컨트롤 플레인 운영 | 직접 | 프로바이더 | etcd 백업과 API 서버 가용성의 책임이 어디 있나 |
| 업그레이드 | 수동([10](../10-cluster-maintenance)장) | 자동 또는 원클릭 | 버전 스큐(10장) 관리를 누가 하나 |
| 보안 패치 | 직접 | 프로바이더 | 컨트롤 플레인 OS와 바이너리를 누가 갱신하나 |
| 비용 | 인프라만 | 인프라 + 관리 요금 | 운영 인력 대신 요금을 낸다 |
| 유연성 | 높음(플래그·버전 자유) | 지원 범위 안에서만 | 프로바이더가 보증하는 조합만 허용한다 |
| 요구 전문성 | 높음 | 낮음 | 장애 때 etcd와 인증서를 직접 다룰 수 있어야 한다 |

관리형이라도 워커 노드와 그 위의 워크로드는 내 것이다. 이 장의 12절까지가 다루는 것은 "컨트롤 플레인 세 대를 어떻게 세우고 지키는가"이고, 관리형은 바로 그 부분을 사 오는 것이다.

### 1.4 클라우드 프로바이더

| 프로바이더 | 서비스 | 강점 | 왜/주의 |
|:----------|:------|:-----|:-------|
| **GCP** | GKE | 가장 오래됐고 Autopilot은 노드까지 맡는다 | 쿠버네티스의 출신지라 새 기능 반영이 빠르다 |
| **AWS** | EKS | IAM, VPC 등 AWS 서비스와 통합 | VPC CNI 등 네트워킹 선택지가 많아 복잡하다 |
| **Azure** | AKS | Entra ID(AD) 통합, 무료 티어 | 리전마다 기능 편차가 있다 |
| **Oracle** | OKE | 비용 | 점유율과 자료가 적다 |
| **온프레미스** | kubeadm, RKE2, OpenShift | 완전한 제어 | 운영 부담이 전부 내 것이다 |

요금과 무료 티어는 자주 바뀌므로 표를 믿지 말고 요금표를 본다.

### 1.5 선택 가이드

```text
목적?
 ├─ 학습 ─► Docker Desktop
 │          Minikube / kind / k3s
 ├─ 개발 ─► kind / k3s
 │          kubeadm 1~3노드
 └─ 운영
     ├─ 운영 역량 ─► kubeadm HA
     │               RKE2 / Kops
     └─ 빠른 시작 ─► GKE / EKS / AKS
```

{{< callout type="info" >}}
초보자는 **Docker Desktop 또는 Minikube**로 시작하고, 팀 개발은 **kind나 k3s**, 프로덕션은 **관리형 서비스**를 기본값으로 놓고 이유가 있을 때만 직접 운영을 택한다. kubeadm은 "언제든 손으로 풀어쓸 수 있어야 하는" CKA 관점의 학습에 가장 맞는데, 이 장의 2~9절이 바로 그 절차다.
{{< /callout >}}

---

## 2. kubeadm 개요

**kubeadm**은 공식 부트스트랩 도구다. 하는 일은 첫째 원리 그대로다. 인증서를 만들고, kubeconfig를 만들고, 컨트롤 플레인을 정적 파드로 띄우고, 조인 토큰을 발급한다. 하지 않는 일도 분명하다. kubelet과 런타임 설치, CNI, 로드밸런서, 노드 프로비저닝은 kubeadm 밖이다. 노드 OS마다 패키지가 다르고, 네트워크는 선택지이며, 로드밸런서는 인프라의 것이기 때문이다.

### 2.1 수동 설치와의 차이

| 작업 | 수동 설치 | kubeadm | 왜 kubeadm이 쉬운가 |
|:-----|:---------|:--------|:------------------|
| 바이너리 배치 | 컴포넌트별로 받아 systemd 유닛 작성 | 패키지 셋(kubeadm, kubelet, kubectl)과 컨테이너 이미지 | 컨트롤 플레인은 이미지로 받는다(2.3) |
| 설정 파일 | 플래그 수십 개를 직접 | `kubeadm config print init-defaults`로 기본값 생성 | 검증된 기본값에서 바꿀 것만 바꾼다 |
| PKI 인증서 | CA, 서버, 클라이언트를 손으로 | `certs` 단계가 15개 파일을 만든다 | 이름, SAN, 만료를 규칙대로 |
| 컴포넌트 기동 | systemd 유닛 4개 | 정적 파드 매니페스트 4개를 kubelet이 띄운다 | 서비스는 kubelet 하나면 되고 나머지는 파드다 |
| 검증 | 없음 | preflight 검사 | 스왑, 포트, cgroup, 커널 모듈을 먼저 본다 |

### 2.2 설치 흐름

```text
┌──────────────────────────┐
│ 1. 사전 준비             │
│    (스왑·모듈·포트)      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 2. 컨테이너 런타임       │
│    (containerd)          │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 3. kubeadm, kubelet,     │
│    kubectl (모든 노드)   │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 4. kubeadm init          │
│    (컨트롤 플레인)       │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 5. CNI 플러그인          │
│    (Flannel/Calico/Cilium)│
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 6. kubeadm join (워커)   │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 7. 클러스터 검증         │
└──────────────────────────┘
```

순서에 이유가 있다. kubelet은 런타임이 있어야 컨테이너를 띄우고(2), kubeadm은 kubelet이 있어야 정적 파드를 맡길 수 있고(3→4), CNI가 있어야 노드가 Ready가 되고(5), 노드가 Ready여야 워커를 붙일 의미가 있다(6). 3절부터 9절이 이 상자 하나씩이다.

### 2.3 이 PC에서 본 kubeadm

kubeadm은 클러스터 없이도 많은 단계를 실행할 수 있다. alpine 컨테이너에 v1.34.1 바이너리를 받아 돌려 봤다. `kubeadm config images list`가 보여 준 것은 컨트롤 플레인이 "이미지 일곱 개"라는 사실이다.

| 이미지 | 태그(실측) | 왜 필요한가 |
|:------|:----------|:-----------|
| kube-apiserver, kube-controller-manager, kube-scheduler | v1.34.11 | 컨트롤 플레인 세 개는 정적 파드로 뜬다 |
| kube-proxy | v1.34.11 | 노드마다 DaemonSet으로 뜬다(02장) |
| coredns/coredns | v1.12.1 | 클러스터 DNS 애드온 |
| pause | 3.10.1 | 파드의 네트워크 네임스페이스를 잡아 두는 샌드박스 컨테이너(02장) |
| etcd | 3.6.4-0 | 스택 토폴로지의 로컬 etcd(10장) |

바이너리는 v1.34.1인데 이미지 태그가 v1.34.11인 이유가 있다. `--kubernetes-version`을 주지 않으면 kubeadm은 그 마이너의 최신 패치를 온라인으로 물어본다. 그래서 오프라인 설치는 버전을 반드시 고정해야 하고, `init-defaults`가 찍어 준 `kubernetesVersion: 1.34.0`은 조회에 실패했을 때의 정적 기본값일 뿐이다.

---

## 3. 사전 요구사항

### 3.1 하드웨어

| 역할 | 공식 최소 | 현실적 권장 | 왜 |
|:-----|:---------|:-----------|:---|
| 컨트롤 플레인 | 2 CPU, 2GB | 4 CPU, 8GB, SSD | etcd가 디스크 fsync 지연에 민감하고(11장), API 서버 부하는 노드와 파드 수에 비례한다 |
| 워커 | 2GB(그보다 적으면 앱 자리가 없다) | 워크로드에 따라 | kubelet, kube-proxy, 런타임이 먼저 수백 MB를 쓴다 |

공식 문서의 최소값은 "2GB 이상, 컨트롤 플레인은 2 CPU 이상"이다. 실측은 훨씬 아래에서도 돈다. 이 PC의 k3s 서버 컨테이너는 파드 여덟 개를 얹은 채 502MiB, 에이전트는 158MiB였고, 3대 HA의 서버들은 370~490MiB, HAProxy는 76MiB였다. k3s가 컴포넌트를 한 프로세스에 묶고 저장소를 내장한 결과지 kubeadm 클러스터의 수치는 아니다. 사이징의 나머지는 13절에서 본다.

### 3.2 노드 요구사항

| 항목 | 확인 | 왜 |
|:-----|:-----|:---|
| 고유 hostname | `hostname` | 노드 객체의 이름이고 kubelet 인증서의 CN(`system:node:<이름>`)이다 |
| 고유 MAC 주소 | `ip link` | VM을 복제하면 겹치기 쉽고, 일부 CNI와 DHCP가 MAC으로 노드를 구분한다 |
| 고유 product_uuid | `sudo cat /sys/class/dmi/id/product_uuid` | 복제 VM 판별용. 일부 클라우드 컨트롤러가 노드 식별에 쓴다 |
| 포트 개방 | 3.3 표 | 컴포넌트 사이의 모든 통신이 TCP 포트다 |
| 스왑 | `swapon --show` | kubelet 기본값 `failSwapOn: true`라 스왑이 있으면 시작을 거부한다 |

스왑은 원문의 "반드시 비활성화"에서 한 발 물러났다. 왜 원래 금지였는지부터 보자. 스케줄러는 메모리 requests로 배치를 정하고 kubelet은 limits를 넘긴 컨테이너를 OOM으로 죽이는데, 스왑이 끼면 "메모리가 모자란다"는 신호가 늦어져 그 계산이 어긋난다. 그래서 kubelet은 스왑을 보면 시작하지 않는 것이 기본값이다. 다만 1.22에 알파로 들어온 NodeSwap이 1.34에서 GA가 되어, cgroup v2 노드에서는 `failSwapOn: false`와 `swapBehavior: LimitedSwap`을 주고 스왑을 쓰는 것이 공식 지원이 됐다. 기본값 `NoSwap`은 kubelet은 뜨되 파드는 스왑을 못 쓰게 한다. 이 PC의 WSL2 커널에는 4GB 스왑(`/dev/sdc`)이 있었고, k3s는 kubelet 설정에 `failSwapOn: false`를 넣어 두기 때문에 그 위에서 아무 불평 없이 떴다. kubeadm 클러스터라면 3.4의 `swapoff`를 하거나 kubelet 설정을 바꿔야 한다.

### 3.3 필수 포트

**컨트롤 플레인**

| 포트 | 용도 | 누가 접속하나 | 왜 열어야 하나 |
|:-----|:-----|:------------|:-------------|
| 6443 | kube-apiserver | 모두 | 모든 컴포넌트와 kubectl이 여기로만 말한다 |
| 2379-2380 | etcd 클라이언트 / 피어 | kube-apiserver, etcd | 2379는 API 서버가, 2380은 etcd 멤버끼리 Raft를 위해 |
| 10250 | kubelet API | 자기 자신, 컨트롤 플레인 | `kubectl logs`, `exec`가 API 서버를 거쳐 kubelet으로 간다 |
| 10257 | kube-controller-manager | 자기 자신 | 헬스체크와 메트릭 |
| 10259 | kube-scheduler | 자기 자신 | 헬스체크와 메트릭 |

**워커**

| 포트 | 용도 | 누가 접속하나 | 왜 열어야 하나 |
|:-----|:-----|:------------|:-------------|
| 10250 | kubelet API | 자기 자신, 컨트롤 플레인 | 로그, exec, 메트릭 |
| 10256 | kube-proxy 헬스체크 | 자기 자신, 로드밸런서 | 외부 LB가 노드의 건강을 묻는다 |
| 30000-32767 | NodePort(TCP/UDP) | 모두 | 서비스를 노드 포트로 노출할 때 |

여기에 CNI가 쓰는 포트가 더해진다. Flannel과 Cilium의 VXLAN은 UDP 8472, Calico의 BGP는 TCP 179다. 기본 포트는 전부 바꿀 수 있고, API 서버 앞에 443으로 듣는 로드밸런서를 두는 구성도 흔하다.

이 PC의 k3s 노드에서 LISTEN 상태의 TCP 포트를 `/proc/net/tcp`로 읽어 보니 표와 맞았다.

| 노드 | 실측 LISTEN 포트 | 뜻 |
|:-----|:---------------|:---|
| k3s 서버(단일) | 6443, 10250, 10257, 10259, 10256, 10248, 10249, 10010, 6444 | API 서버, kubelet, controller-manager, scheduler, kube-proxy 헬스체크, kubelet 헬스체크, kube-proxy 메트릭, containerd 스트리밍, k3s 내부 포트 |
| k3s 에이전트 | 10250, 10256, 10248, 10249, 10010, 6444 | 컨트롤 플레인 포트가 하나도 없다 |
| k3s HA 서버 | 위에 2379, 2380과 메트릭 포트 두 개 추가 | 내장 etcd |

단일 서버 k3s에 2379가 없는 이유는 02장에서 봤다. etcd 대신 SQLite를 kine으로 감싸 쓰기 때문이고, 3대로 세우면 내장 etcd가 켜져 2379/2380이 나타난다.

### 3.4 사전 설정 스크립트

```bash
# 모든 노드에서
# 1. 스왑 끄기 (failSwapOn 기본값용)
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' \
  /etc/fstab

# 2. 커널 모듈
cat <<EOF | sudo tee \
  /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# 3. 커널 파라미터
cat <<EOF | sudo tee \
  /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
```

| 설정 | 왜 |
|:-----|:---|
| `overlay` | containerd가 이미지 레이어를 겹치는 overlayfs 스냅샷터를 쓴다 |
| `br_netfilter` + `bridge-nf-call-iptables=1` | 같은 노드의 파드끼리 브리지(Flannel의 `cni0`)로 오가는 트래픽도 iptables를 지나야 kube-proxy 규칙과 NetworkPolicy가 먹는다 |
| `ip_forward=1` | 노드가 파드의 veth와 바깥 NIC 사이에서 패킷을 중계하는 라우터다 |

이 PC의 k3s 노드 안에서 `ip_forward`와 `bridge-nf-call-iptables`는 둘 다 1이었다. k3s가 켜 준 것이 아니라 WSL2 커널이 그렇게 떠 있었는데, 어느 쪽이든 없으면 파드 통신이 끊긴다.

---

## 4. Container Runtime 설치

01장 4절에서 봤듯 1.24부터 dockershim이 빠져 kubelet은 CRI로 런타임과 말하고, 사실상의 표준은 containerd다. 이 PC의 Docker Desktop은 containerd v2.2.5, k3s가 내장한 것은 v2.1.4였다. 2.x가 이제 보통이라는 뜻이고, 설정 파일의 키 이름이 1.x와 다르다는 뜻이기도 하다.

### 4.1 containerd 설치 (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates curl gnupg
sudo install -m 0755 -d \
  /etc/apt/keyrings
U=https://download.docker.com
K=/etc/apt/keyrings/docker.gpg
L=/etc/apt/sources.list.d
curl -fsSL $U/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o $K

A=$(dpkg --print-architecture)
. /etc/os-release
C=$VERSION_CODENAME
echo "deb [arch=$A signed-by=$K] \
  $U/linux/ubuntu $C stable" \
  | sudo tee $L/docker.list
sudo apt-get update
sudo apt-get install -y containerd.io
```

Docker 저장소의 `containerd.io` 패키지를 쓰는 이유는 배포판 패키지보다 최신 2.x가 오기 때문이다. Docker 엔진 자체는 설치하지 않는다. kubelet에게 필요한 것은 CRI 소켓 `/run/containerd/containerd.sock` 하나다.

### 4.2 cgroup 드라이버와 SystemdCgroup

```bash
sudo mkdir -p /etc/containerd
containerd config default \
  | sudo tee /etc/containerd/config.toml
sudo sed -i \
  '/SystemdCgroup/s/false/true/' \
  /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
```

```toml
# containerd 2.x: version = 3
# plugins.'io.containerd.cri.v1.images'
#   .pinned_images 아래
sandbox = 'registry.k8s.io/pause:3.10.1'
# plugins.'io.containerd.cri.v1.runtime'
#   .containerd.runtimes.runc.options
SystemdCgroup = true
```

| 항목 | containerd 1.x | containerd 2.x | 왜 |
|:-----|:--------------|:--------------|:---|
| 설정 버전 | `version = 2` | `version = 3` | 플러그인 이름 체계가 바뀌었다 |
| CRI 플러그인 키 | `plugins."io.containerd.grpc.v1.cri"` | `plugins.'io.containerd.cri.v1.runtime'`와 `...cri.v1.images` | 런타임 설정과 이미지 설정이 갈라졌다 |
| 샌드박스 이미지 | `sandbox_image = "registry.k8s.io/pause:3.9"` | `pinned_images` 아래 `sandbox = '...pause:3.10.1'` | kubeadm 1.34가 쓰는 pause와 맞추면 경고가 사라진다 |
| cgroup 드라이버 | runc options의 `SystemdCgroup` | 같은 키, 위치만 다름 | 아래 설명 |

cgroup 드라이버는 "누가 cgroup 트리를 관리하나"의 문제다. systemd로 부팅한 호스트는 systemd가 cgroup을 관리하므로 kubelet과 런타임도 systemd 드라이버를 써야 자원 계산이 한 곳에서 이뤄진다. 공식 문서는 systemd 호스트에서 둘을 cgroupfs로 두면 부하 상황에서 노드가 불안정해진다고 적는다. 그런데 containerd의 기본 설정은 아직 `SystemdCgroup = false`다. 이 PC의 Docker Desktop containerd 2.2.5에 `containerd config default`를 시키자 `version = 3`, `sandbox = 'registry.k8s.io/pause:3.10.1'`, 그리고 `SystemdCgroup = false`가 나왔다. 위 `sed`가 그 줄을 바꾼다. k3s가 내장한 2.1.4 빌드는 그 줄을 아예 찍지 않았으므로, 없으면 직접 넣는다.

kubelet 쪽은 사정이 바뀌었다. kubeadm은 1.22부터 kubelet 기본값을 `cgroupDriver: systemd`로 두었고, 1.31부터는(1.34에서 GA) kubelet이 CRI의 RuntimeConfig 호출로 런타임에게 드라이버를 물어보고 그것을 따른다. 그래서 containerd 2.x와 1.34 이상의 조합에서는 "둘이 어긋나서 kubelet이 죽는" 옛 사고가 구조적으로 사라졌다. 이 PC의 k3s 노드는 systemd가 없는 컨테이너라 둘 다 cgroupfs였다. containerd의 `config.toml`에 `SystemdCgroup = false`, kubelet 설정 드롭인에 `cgroupDriver: cgroupfs`, `crictl info`에도 `"SystemdCgroup": false`. 어느 쪽이든 짝이 맞는 것이 요점이다.

{{< callout type="warning" >}}
containerd 1.x처럼 RuntimeConfig를 지원하지 않는 런타임에서는 kubelet이 자기 설정값(kubeadm 기본 systemd)을 쓰므로, 런타임이 `SystemdCgroup = false`면 여전히 어긋난다. 증상은 kubelet 시작 실패나 파드가 뜨자마자 죽는 반복이다. systemd 호스트에서는 `SystemdCgroup = true`로 바꾸고 `systemctl restart containerd`를 한 뒤에 kubeadm을 돌린다. 이미 도는 노드의 드라이버를 바꾸는 것은 노드를 비우고(10장) 다시 조인하는 일이다.
{{< /callout >}}

---

## 5. kubeadm, kubelet, kubectl 설치

| 패키지 | 무엇 | 어디에 | 왜 |
|:------|:-----|:------|:---|
| kubeadm | 부트스트랩 CLI | 모든 노드 | init, join, upgrade가 그 노드 위에서 실행된다 |
| kubelet | 노드 에이전트(systemd 서비스) | 모든 노드 | 파드로 돌 수 없다(02장). init 전에는 설정이 없어 몇 초마다 재시작하며 kubeadm을 기다린다 |
| kubectl | 클라이언트 | 컨트롤 플레인 또는 작업 PC | 워커에는 필요 없다. 서버와 마이너 버전 ±1 안에서만 지원 |

02장에서 "kubelet은 노드마다 패키지로 먼저 설치해야 한다"고 미뤄 둔 이유가 여기 있다. kubeadm은 kubelet을 설치하지 않고, 설치된 kubelet에게 설정을 써 주고 재시작시킬 뿐이다.

### 5.1 Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y \
  apt-transport-https ca-certificates \
  curl gpg

V=v1.34   # 설치할 마이너 버전
R=https://pkgs.k8s.io/core:/stable:/$V
K=/etc/apt/keyrings/k8s.gpg
L=/etc/apt/sources.list.d
sudo mkdir -p /etc/apt/keyrings
curl -fsSL $R/deb/Release.key \
  | sudo gpg --dearmor -o $K
echo "deb [signed-by=$K] $R/deb/ /" \
  | sudo tee $L/kubernetes.list

sudo apt-get update
sudo apt-get install -y \
  kubelet kubeadm kubectl
sudo apt-mark hold \
  kubelet kubeadm kubectl
sudo systemctl enable --now kubelet
```

저장소 주소에 마이너 버전이 들어가는 이유는 pkgs.k8s.io가 마이너마다 별도 저장소이기 때문이다. 다른 마이너로 올라가려면 이 주소부터 바꿔야 하고, 그래서 `apt-mark hold`로 세 패키지를 자동 업그레이드에서 뺀다. 쿠버네티스 업그레이드는 순서가 있는 일이지 `apt upgrade`가 할 일이 아니다(10장). 이 글의 실측은 v1.34.1로 했고 공식 문서의 현재 버전은 v1.37이다. 주소의 버전은 "설치하려는 마이너"로 고른다.

`systemctl enable --now kubelet` 직후 kubelet은 몇 초마다 죽고 다시 뜬다. 정상이다. `/var/lib/kubelet/config.yaml`이 아직 없어서 kubeadm이 써 줄 때까지 기다리는 것이고, 6절의 `kubelet-start` 단계가 그 파일을 만든다.

### 5.2 CentOS/RHEL

```bash
# SELinux permissive
sudo setenforce 0
sudo sed -i \
  's/=enforcing$/=permissive/' \
  /etc/selinux/config

V=v1.34
R=https://pkgs.k8s.io/core:/stable:/$V
sudo tee /etc/yum.repos.d/k8s.repo <<EOF
[kubernetes]
name=Kubernetes
baseurl=$R/rpm/
enabled=1
gpgcheck=1
gpgkey=$R/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl
EOF
sudo yum install -y \
  kubelet kubeadm kubectl \
  --disableexcludes=kubernetes
sudo systemctl enable --now kubelet
```

`exclude=`가 apt의 hold와 같은 역할이다. 공식 문서는 `cri-tools`와 `kubernetes-cni`까지 같은 줄에 넣는다. SELinux를 permissive로 두는 이유는 컨테이너가 호스트 파일 시스템에 닿을 때(볼륨, CNI 설정) 정책이 막는 경우가 있어서인데, 정책을 제대로 쓰는 환경이면 enforcing으로 되돌린다.

### 5.3 버전 스큐

kubectl은 서버와 마이너 버전 하나까지만 차이를 지원한다. 이 PC의 kubectl은 Docker Desktop이 넣어 준 1.36.1이고 k3s 서버는 1.34.1이어서 명령마다 경고가 붙었다.

```text
Client Version: v1.36.1
Server Version: v1.34.1+k3s1
Warning: version difference between
client (1.36) and server (1.34)
exceeds the supported minor version
skew of +/-1
```

동작은 했지만 보증 밖이다. kubelet은 API 서버보다 세 마이너까지 낮아도 되고, 절대 높으면 안 된다. 규칙 전체는 [10](../10-cluster-maintenance)장 4절에서 본다.

---

## 6. Control Plane 초기화

### 6.1 단일 Control Plane

```bash
# 단일 컨트롤 플레인
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16

# NIC이 여럿이면 광고 주소를 지정
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address \
    10.0.0.10
```

### 6.2 주요 옵션

`kubeadm config print init-defaults`가 찍어 준 기본값과 함께 본다.

| 옵션 | 기본값(실측) | 왜 |
|:-----|:-----------|:---|
| `--pod-network-cidr` | 없음(Flannel은 10.244.0.0/16을 기대) | 컨트롤러 매니저가 노드마다 /24를 잘라 주는 원본 대역. 7절에서 실물을 본다 |
| `--service-cidr` | 10.96.0.0/12 | Service 가상 IP 대역. 첫 IP 10.96.0.1이 `kubernetes` Service다 |
| `--apiserver-advertise-address` | 기본 라우트 NIC의 IP | 인증서 SAN과 etcd 광고 주소에 박힌다. NIC이 둘이면 반드시 지정 |
| `--control-plane-endpoint` | 없음 | HA용 LB 주소. 나중에 붙일 수 없다(12절) |
| `--upload-certs` | 꺼짐 | 다른 컨트롤 플레인이 CA 키를 받도록 Secret으로 올린다 |
| `--kubernetes-version` | stable-1.34를 온라인 조회 | 오프라인이면 필수. 이미지 태그를 정한다 |
| `--cri-socket` | `unix:///var/run/containerd/containerd.sock` | 런타임 소켓이 하나면 자동 감지 |
| `--service-dns-domain` | cluster.local | Service DNS 접미사 |
| `--image-repository` | registry.k8s.io | 사설 미러를 쓸 때 |
| 토큰 TTL | 24h | 조인 토큰은 노드 등록용 임시 자격이다 |

### 6.3 init 내부 수행 단계

`kubeadm init --help`가 보여 주는 실행 순서다.

```text
preflight          사전 검사
certs              PKI 인증서 생성
kubeconfig         *.conf 5개
etcd               etcd 정적 파드
control-plane      정적 파드 3개
kubelet-start      kubelet 설정과 시작
wait-control-plane 컨트롤 플레인 대기
upload-config      설정 ConfigMap 저장
upload-certs       인증서 Secret (HA)
mark-control-plane 라벨·taint
bootstrap-token    조인 토큰
kubelet-finalize   kubelet 인증서 정리
addon              CoreDNS, kube-proxy
show-join-command  join 명령 출력
```

순서가 첫째 원리다. 인증서가 먼저고, 그것으로 kubeconfig를 만들고, 매니페스트를 쓴 다음에야 kubelet을 시작한다. 5절에서 재시작을 반복하던 kubelet은 이 `kubelet-start`에서 설정 파일을 받아 제대로 뜨고, `/etc/kubernetes/manifests`에 있는 정적 파드 매니페스트 네 개를 읽어 컨트롤 플레인을 띄운다. 이 PC의 컨테이너에서 `certs`, `kubeconfig`, `control-plane`, `etcd` 단계만 따로 돌렸을 때 나온 결과물이 다음이다.

```text
/etc/kubernetes/manifests/
  etcd.yaml
  kube-apiserver.yaml
  kube-controller-manager.yaml
  kube-scheduler.yaml
  (전부 kind: Pod)

/etc/kubernetes/
  admin.conf  super-admin.conf
  kubelet.conf  controller-manager.conf
  scheduler.conf
```

정적 파드는 API 서버 없이 kubelet이 디렉터리를 보고 직접 띄우는 파드다([05](../05-scheduling)장 9절). API 서버 자신을 파드로 띄우려면 API 서버 없이도 뜨는 파드가 필요하고, 그것이 정적 파드인 것이다. 매니페스트 안의 플래그도 읽어 봤다. API 서버는 `--etcd-servers=https://127.0.0.1:2379`로 같은 노드의 etcd를 보고, `--service-cluster-ip-range=10.96.0.0/12`, `--authorization-mode=Node,RBAC`, `--secure-port=6443`이었다. 스케줄러에는 `--leader-elect=true`가 있었다. 10절의 리더 선출이 기본으로 켜져 있다는 뜻이다.

인증서는 CA 셋과 잎 인증서들로 나뉜다.

```text
pki/
  ca.crt, ca.key         클러스터 CA
  apiserver.crt          API 서버 서빙
  apiserver-kubelet-client  kubelet 호출
  front-proxy-ca, -client  집계 계층
  etcd/ca, server, peer
  etcd/healthcheck-client
  apiserver-etcd-client
  sa.key, sa.pub         SA 토큰 서명 키
```

| 인증서 | 만료(실측) | 왜 |
|:------|:----------|:---|
| CA 셋(ca, etcd-ca, front-proxy-ca) | 10년 | 갈아 끼우려면 모든 노드의 신뢰를 바꿔야 하므로 길게 |
| 잎 인증서 전부와 *.conf 안의 클라이언트 인증서 | 1년 | 유출 피해를 제한하고, `kubeadm upgrade`가 매년 자동 갱신한다(14절) |

`apiserver.crt`의 SAN에는 `kubernetes`, `kubernetes.default`, `kubernetes.default.svc`, `kubernetes.default.svc.cluster.local`, 노드 이름, 그리고 IP 10.96.0.1과 광고 주소가 들어 있었다. 10.96.0.1이 있는 이유는 파드 안에서 API 서버를 부를 때 `kubernetes` Service의 ClusterIP로 가기 때문이다. 이름이 하나라도 빠지면 그 경로의 TLS가 깨진다.

### 6.4 kubectl 설정

```bash
# 일반 사용자
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf \
  $HOME/.kube/config
sudo chown $(id -u):$(id -g) \
  $HOME/.kube/config

# root는 파일을 그대로 가리킨다
KUBECONFIG=/etc/kubernetes/admin.conf
export KUBECONFIG
```

`admin.conf` 안의 클라이언트 인증서 주체는 `O=kubeadm:cluster-admins, CN=kubernetes-admin`이었고, 옆에 `super-admin.conf`가 하나 더 있었다. 1.29부터의 구조다. 일상용 admin은 ClusterRoleBinding으로 권한을 받는 보통 그룹이어서 필요하면 회수할 수 있고, `system:masters` 그룹인 super-admin은 RBAC로도 막을 수 없는 비상 열쇠라 따로 둔다. k3s의 `k3s.yaml`은 아직 `O=system:masters, CN=system:admin`이었다. 인증서로 사람을 인증하는 이 방식은 [08](../08-security)장 2절에서 본다.

{{< callout type="warning" >}}
`kubeadm init` 출력 끝의 **join 명령과 토큰은 안전한 곳에 보관**한다. 토큰 기본 수명은 24시간이고, 지나면 `kubeadm token create --print-join-command`로 새로 받는다. CA 해시는 바뀌지 않으므로 그대로 쓴다(8절).
{{< /callout >}}

---

## 7. CNI 플러그인

CNI를 깔기 전까지 노드는 **NotReady**고 CoreDNS는 Pending이다. kubelet은 런타임에 "네트워크 준비됐나"를 묻는데, `/etc/cni/net.d`에 설정이 없으면 NetworkReady가 false여서 노드 상태를 Ready로 올리지 않기 때문이다. CoreDNS는 파드 네트워크가 있어야 IP를 받을 수 있으니 그때까지 스케줄이 미뤄진다. 02장에서 CNI가 "파드가 생길 때 이 설정의 플러그인을 불러 네트워크를 붙여라"는 규격이라고 했다. 규격만 있고 구현이 없는 상태가 NotReady다.

### 7.1 주요 CNI 비교

| CNI | 방식 | 기본 파드 CIDR | NetworkPolicy | 왜 고르나 |
|:----|:-----|:-------------|:--------------|:---------|
| **Calico** | BGP 또는 VXLAN/IPIP, 정책 엔진 | 192.168.0.0/16 | 지원 | 정책, 규모, 성숙도 |
| **Flannel** | VXLAN 오버레이, 노드마다 /24 | 10.244.0.0/16 | 미지원 | 가장 단순하다. k3s의 기본값 |
| **Cilium** | eBPF, kube-proxy 대체 가능, L7 정책 | 10.0.0.0/8 | 지원 | 관측성과 성능, 서비스 메시까지 |
| **Weave Net** | (단종) | 10.32.0.0/12 | 지원 | 2024년 6월 저장소가 보관 상태가 됐다. 새 클러스터에는 쓰지 않는다 |

원문 표에 있던 Weave는 개발사 Weaveworks가 문을 닫으며 저장소가 읽기 전용이 됐다. 셋 중 무엇을 고르든 6.2의 `--pod-network-cidr`과 CNI의 대역이 같아야 한다. 따로 놀면 파드는 뜨는데 노드 사이 통신이 안 되는 식으로 조용히 깨진다.

### 7.2 이 PC의 Flannel

k3s가 Flannel을 VXLAN으로 깔아 준 2노드 클러스터에서 실물을 봤다.

| 확인한 것 | 값 | 뜻 |
|:---------|:---|:---|
| 노드별 podCIDR | k3s-lab 10.42.1.0/24, k3s-agent 10.42.0.0/24 | 컨트롤러 매니저가 클러스터 대역 10.42.0.0/16을 노드마다 /24로 잘라 준다 |
| 노드의 인터페이스 | `cni0`, `flannel.1`, veth 다섯 개 | 파드는 veth로 브리지 cni0에, 다른 노드행은 VXLAN 장치 flannel.1로 |
| 파드 IP | 10.42.1.3 ~ 10.42.1.6(서버), 10.42.0.3 ~ 10.42.0.4(에이전트) | 어느 노드인지 IP만 봐도 안다 |
| 노드 간 파드 통신 | 에이전트의 파드에서 서버의 nginx 파드로 HTTP 성공 | 오버레이가 두 노드의 /24를 이어 준다 |

```text
$ ip route  (k3s 서버 노드)
10.42.0.0/24 via 10.42.0.0 dev flannel.1
10.42.1.0/24 dev cni0 src 10.42.1.1
```

라우팅 테이블이 CNI가 한 일의 전부를 말해 준다. 자기 /24는 브리지로, 남의 /24는 VXLAN으로. 이 대역이 `--pod-network-cidr`에서 나왔고, 3.4의 `ip_forward`가 이 두 줄을 실제로 작동하게 한다. 동작 원리는 [07](../07-networking)장 2절이다.

### 7.3 설치와 확인

Flannel은 릴리스마다 고정 주소 `https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml`을 `kubectl apply -f`로 적용하고, Calico는 `https://raw.githubusercontent.com/projectcalico/calico/<버전>/manifests/calico.yaml`의 버전을 골라 적용하거나 Tigera 오퍼레이터를 쓴다. 원문의 v3.26.1처럼 버전을 박아 두면 금방 낡으니 릴리스 페이지에서 고른다.

```bash
kubectl get pods -n kube-system
kubectl get nodes
```

```text
NAME      STATUS ROLES          VERSION
k3s-agent Ready  <none>         v1.34.1
k3s-lab   Ready  control-plane  v1.34.1
```

CNI 파드가 Running이 되면 몇 초 안에 노드가 Ready로 바뀌고 CoreDNS가 뜬다. 이 PC의 2노드에서는 CoreDNS가 에이전트 노드에 배치됐다. k3s는 서버 노드에 taint를 걸지 않아 어디든 갈 수 있다.

---

## 8. Worker 노드 조인

### 8.1 조인 명령

```bash
sudo kubeadm join 10.0.0.10:6443 \
  --token abcdef.0123456789abcdef \
  --discovery-token-ca-cert-hash \
    sha256:778a57fa...
```

join에는 비밀이 둘 들어간다. 각각 방향이 다르다.

| 값 | 누가 누구를 믿게 하나 | 왜 |
|:---|:-------------------|:---|
| `--token` | 클러스터가 새 노드를 | 부트스트랩 토큰은 `system:bootstrappers` 그룹으로 인증되어 인증서 서명 요청(CSR)을 낼 권한만 있다. 24시간 뒤 사라지는 임시 자격 |
| `--discovery-token-ca-cert-hash` | 새 노드가 클러스터를 | 노드는 `kube-public`의 cluster-info를 인증 없이 받아 오는데, 그 안의 CA 공개키 해시가 이 값과 다르면 가짜 API 서버다 |

토큰 형식은 `[a-z0-9]{6}.[a-z0-9]{16}`이고, `kubeadm token generate`가 이 PC에서 만든 것은 `wx01fj.x5ok8u84w5u7dcf6`였다. 앞 여섯 자는 토큰 ID로 공개되고 뒤 열여섯 자가 비밀이다. 조인이 끝나면 kubelet은 토큰으로 CSR을 내고, 컨트롤러 매니저의 승인 컨트롤러가 자동 승인하며, `O=system:nodes, CN=system:node:<이름>`인 1년짜리 클라이언트 인증서를 받아 그 뒤로는 인증서로만 말한다. 이 PC에서 kubeadm이 만든 `kubelet.conf` 안의 인증서 주체가 정확히 그것이었다. `kubeadm join --help`의 단계는 다섯 개다. preflight, control-plane-prepare, kubelet-start, control-plane-join, wait-control-plane. 워커는 이 중 preflight와 kubelet-start만 지난다.

k3s도 같은 두 가지를 한 문자열에 담는다. 서버의 `/var/lib/rancher/k3s/server/node-token`은 108자였고 구조가 이렇다.

```text
K10<sha256(server-ca.crt)>::server:<pw>
```

`K10` 뒤 64자가 서버 CA 인증서 파일의 SHA-256인지 직접 계산해 맞춰 봤고, 정확히 일치했다. 이름만 다를 뿐 kubeadm의 CA 해시와 같은 물건이다. 이 토큰으로 에이전트 컨테이너를 띄우자 9초 뒤 두 노드가 Ready였고, 에이전트 노드의 이벤트가 순서대로 남았다.

```text
Starting → NodeHasSufficientMemory
→ NodeHasNoDiskPressure
→ NodeHasSufficientPID
→ NodeAllocatableEnforced
→ NodeReady → RegisteredNode
```

앞의 것들은 kubelet이 자기 노드에 대해 쓴 것이고, 마지막 RegisteredNode는 컨트롤러 매니저의 노드 컨트롤러가 쓴 것이다. 02장의 "모두 API 서버만 본다"가 노드 등록에서도 그대로다.

### 8.2 토큰 관리

```bash
kubeadm token list
kubeadm token create \
  --print-join-command

# CA 해시 직접 계산 (RSA CA)
openssl x509 -pubkey \
  -in /etc/kubernetes/pki/ca.crt \
  | openssl rsa -pubin -outform der \
  | openssl dgst -sha256 -hex \
  | sed 's/^.* //'
```

해시는 CA 인증서가 아니라 **CA 공개키의 DER 인코딩**을 SHA-256한 값이다. 그래서 인증서를 갱신해도 키가 같으면 해시가 같다. kubeadm의 CA는 RSA라 `openssl rsa`가 맞지만, k3s처럼 EC 키(이 PC의 k3s CA는 `id-ecPublicKey`)면 `openssl pkey -pubin -outform der`를 쓴다.

### 8.3 라벨과 taint

```bash
kubectl label node worker1 \
  node-role.kubernetes.io/worker=worker
kubectl get nodes
```

`ROLES` 열은 `node-role.kubernetes.io/<역할>` 라벨을 보여 주는 것뿐이다. kubeadm은 `mark-control-plane` 단계에서 컨트롤 플레인 노드에 라벨과 함께 `node-role.kubernetes.io/control-plane:NoSchedule` taint를 걸어 워크로드가 올라가지 못하게 한다. 컨트롤 플레인의 CPU를 etcd와 API 서버에 남겨 두려는 것이다(taint는 02장 8절, [05](../05-scheduling)장 3절). 워커에는 아무 라벨이 없어 `<none>`으로 보이고, 위 명령은 보기 좋게 이름을 붙이는 관례다. k3s는 반대다. 서버 노드에 taint가 없어서(`taints=` 빈 값) 이 PC의 파드 여섯 개 중 넷이 서버 노드에 올라갔다. 한 대짜리 클러스터가 기본 시나리오라서다.

---

## 9. 설치 검증

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get --raw /healthz
kubectl get --raw '/readyz?verbose'

kubectl create deployment web \
  --image=nginx:1.27-alpine
kubectl expose deployment web \
  --port=80 --type=NodePort
kubectl get svc web

kubectl run dns --image=busybox:1.36 \
  --restart=Never -- \
  nslookup kubernetes.default
```

| 확인 | 무엇을 증명하나 | 이 PC 실측 |
|:-----|:--------------|:----------|
| `/healthz`, `/livez`, `/readyz` | API 서버가 살아 있고(livez) 요청을 받을 준비가 됐나(readyz). readyz에는 etcd 검사가 들어 있다 | 셋 다 `ok`, `readyz?verbose`에 `[+]etcd ok` |
| `get nodes -o wide` | 노드 전부 Ready, 버전과 런타임 | 두 노드 Ready, v1.34.1+k3s1, containerd 2.1.4, 커널 6.18.33(WSL2) |
| 배포 + NodePort | 스케줄러, kubelet, kube-proxy가 모두 돈다 | web 파드 2개를 서버 노드에 고정해 두고, **파드가 없는 에이전트 노드**의 30080으로 요청해 nginx 응답을 받았다 |
| 노드 간 파드 통신 | CNI | 에이전트의 파드에서 서버의 파드 IP로 HTTP 성공 |
| DNS | CoreDNS와 Service | 02장에서 `web`과 `kubernetes.default`가 10.43.0.10으로 풀렸다 |

파드가 없는 노드의 NodePort가 응답한 것이 kube-proxy의 증명이다. 노드마다 같은 규칙이 있어 어느 노드로 들어와도 파드가 있는 노드로 보내 준다([07](../07-networking)장 5절). `kubectl get nodes`가 나오면 API 서버와 etcd가, 노드가 Ready면 kubelet과 CNI가, NodePort가 답하면 kube-proxy가, DNS가 풀리면 CoreDNS가 정상이다. 2절의 상자 일곱 개가 이 표 한 장으로 검증된다.

---

## 10. HA 토폴로지

컨트롤 플레인이 한 대면 단일 장애점이다. 죽으면 kubectl, 새 파드, 스케일링, 자동 복구가 전부 멈춘다. 기존 파드는 계속 돈다. kubelet은 API 서버가 없어도 이미 받은 파드를 지키기 때문이다(01장). 둘째 원리대로 컴포넌트마다 "여러 대를 어떻게 두는가"의 답이 다르다.

### 10.1 컴포넌트별 HA 전략

| 컴포넌트 | 모드 | 왜 |
|:--------|:-----|:---|
| **kube-apiserver** | Active-Active | 상태가 없다. 모든 상태는 etcd에 있으므로 몇 대가 동시에 응답해도 된다 |
| **controller-manager** | Active-Standby | 같은 Deployment를 두 대가 조정하면 파드가 두 배로 생긴다 |
| **scheduler** | Active-Standby | 같은 파드를 두 노드에 배치하는 사고를 막는다 |
| **etcd** | Raft 다수결 | 쓰기는 과반수 동의로만 커밋된다(11절) |

이 PC의 k3s 3대 클러스터에서 `kubernetes` Service의 EndpointSlice에 API 서버 IP 세 개가 다 들어 있었다. 세 대가 동시에 활성이라는 뜻이다. 반면 컨트롤러와 스케줄러는 리스 하나씩만 있었다.

### 10.2 API Server Load Balancing

```text
          kubectl
             │
             ▼
     ┌───────────────┐
     │ Load Balancer │
     │ HAProxy :6443 │
     └───────┬───────┘
      ┌──────┼──────┐
      ▼      ▼      ▼
   ┌─────┐┌─────┐┌─────┐
   │ API ││ API ││ API │
   │:6443││:6443││:6443│
   └─────┘└─────┘└─────┘
    cp1    cp2    cp3
```

```text
frontend k8s-api
    bind *:6443
    mode tcp
    default_backend control-plane

backend control-plane
    mode tcp
    balance roundrobin
    option tcp-check
    option redispatch
    retries 3
    server cp1 10.0.0.11:6443 check
    server cp2 10.0.0.12:6443 check
    server cp3 10.0.0.13:6443 check
```

TCP 모드인 이유는 TLS를 API 서버가 직접 끝내야 하기 때문이다. 클라이언트 인증서로 사람과 kubelet을 인증하는데(8절, 08장) LB가 TLS를 풀면 그 인증서가 API 서버에 닿지 않는다. 헬스체크는 6443 TCP 연결 확인으로 충분하고, `redispatch`와 `retries`가 있으면 방금 죽은 서버로 배정된 연결을 다른 서버로 다시 보낸다. 이 PC에서 HAProxy 뒤의 cp1을 `docker stop`으로 죽인 직후 kubectl은 한 번도 실패하지 않았고, HAProxy 로그에는 "Server control-plane/cp1 is DOWN, reason: Layer4 timeout"이 1초 간격 검사 두 번 뒤에 찍혔다.

### 10.3 Leader Election

```yaml
# kube-controller-manager.yaml
spec:
  containers:
  - command:
    - kube-controller-manager
    - --leader-elect=true
    - --leader-elect-lease-duration=15s
    - --leader-elect-renew-deadline=10s
    - --leader-elect-retry-period=2s
```

컨트롤러 매니저와 스케줄러는 `kube-system`의 Lease 객체 하나를 두고 다툰다. 리더는 2초마다 갱신을 시도하고, 10초 안에 갱신하지 못하면 스스로 리더를 포기하고 프로세스를 끝낸다. 다른 인스턴스는 리스가 15초 동안 갱신되지 않은 것을 보고 인수한다. 리더가 "포기하면서 죽는" 이유는 둘이 동시에 리더라고 믿는 순간을 없애기 위해서다. 정적 파드라면 kubelet이 곧 다시 띄우고, 새 프로세스는 후보로 돌아간다.

이 PC의 3대 클러스터에서 실물을 봤다.

| 리스(kube-system) | 3대 정상 | cp1 정지 뒤 | 뜻 |
|:-----------------|:--------|:-----------|:---|
| kube-controller-manager | cp1 | cp3 | 컨트롤러는 언제나 한 대 |
| kube-scheduler | cp1 | cp2 | 스케줄러도 한 대. 컨트롤러와 같은 노드일 필요는 없다 |
| k3s, k3s-etcd, k3s-cloud-controller-manager | cp1 | cp2, cp3, cp3 | k3s 자체 컨트롤러들도 같은 장치를 쓴다 |
| apiserver-… 세 개 | 각자 | 각자 | API 서버는 선출이 없다. 존재를 알리는 신원 리스다 |

첫 서버가 처음엔 전부 쥐고 있다가 죽자 리스가 남은 두 대로 흩어졌다. 단일 서버 k3s에는 kube-controller-manager와 kube-scheduler 리스가 아예 없었다. 후보가 하나면 선출을 생략하기 때문이고, 3대가 되자 나타났다. 리더 인수를 실제로 본 것은 12절에서 cp1이 죽은 뒤에도 새 Deployment가 정상 배포된 장면이다. 반대 방향도 봤다. 12절에서 etcd 쿼럼이 사라지자 리더였던 cp3의 컨트롤러 매니저가 갱신에 실패했고, 로그에 `failed to renew lease kube-system/kube-controller-manager`와 `leaderelection lost`를 남기며 정확히 11초 뒤 종료했다. renew-deadline 10초가 그대로 보인 것이다.

### 10.4 etcd 토폴로지

**Stacked(통합형)**: 컨트롤 플레인 노드마다 etcd를 함께 둔다.

```text
┌── cp1 ───┐┌── cp2 ───┐┌── cp3 ───┐
│API/CM/Sch││API/CM/Sch││API/CM/Sch│
│  etcd ◄──┼┼─► etcd ◄─┼┼─► etcd   │
└──────────┘└──────────┘└──────────┘
```

**External(분리형)**: etcd 클러스터를 따로 운영한다.

```text
┌─ cp1 ─┐ ┌─ cp2 ─┐ ┌─ cp3 ─┐
│  API  │ │  API  │ │  API  │
└───┬───┘ └───┬───┘ └───┬───┘
    └─────────┼─────────┘
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│ etcd1 │ │ etcd2 │ │ etcd3 │
└───────┘ └───────┘ └───────┘
```

| 항목 | Stacked | External | 왜 |
|:-----|:--------|:---------|:---|
| 기계 수 | 컨트롤 플레인 3대 | 컨트롤 플레인 3대 + etcd 3대 | External은 두 클러스터를 운영하는 것이다 |
| 장애 결합 | 노드 하나가 죽으면 API 서버와 etcd 멤버가 같이 준다 | API 서버 장애가 etcd 쿼럼에 영향 없음 | 장애 범위를 분리하는 대가가 기계 3대 |
| 설정 | kubeadm 기본. `--etcd-servers=https://127.0.0.1:2379` | API 서버에 외부 주소 셋과 클라이언트 인증서 | 아래 플래그 |
| 용도 | 소규모, 기본 선택 | 대규모, etcd를 따로 튠하고 싶을 때 | etcd 디스크를 전용으로 줄 수 있다 |

이 PC의 실험은 전부 Stacked였다. kubeadm이 만든 `etcd.yaml`에는 `--listen-client-urls=https://127.0.0.1:2379,https://<노드IP>:2379`와 `--initial-cluster=<호스트>=https://<노드IP>:2380`이 있었고, API 서버는 `127.0.0.1:2379`의 자기 옆 etcd만 봤다. k3s 3대도 서버마다 내장 etcd가 떠서 2379/2380이 열렸고 데이터는 `/var/lib/rancher/k3s/server/db/etcd`에 있었다.

External이면 API 서버 플래그가 이렇게 바뀐다.

```text
kube-apiserver
  --etcd-servers=https://etcd1:2379,
                 https://etcd2:2379,
                 https://etcd3:2379
  --etcd-cafile=pki/etcd/ca.crt
  --etcd-certfile=
      pki/apiserver-etcd-client.crt
  --etcd-keyfile=
      pki/apiserver-etcd-client.key
```

`apiserver-etcd-client`가 6.3의 인증서 목록에 있던 이유다. API 서버가 etcd에 대해서는 클라이언트고, etcd의 CA가 따로 있다.

---

## 11. etcd 쿼럼과 노드 수

etcd는 **Raft**로 합의한다. 쓰기는 리더가 받아 로그에 적고 팔로워에게 복제해, 과반수가 받았다고 답한 순간 커밋된다. 그래서 과반수가 살아 있어야 쓸 수 있고, 과반수가 죽으면 읽기만 남는다.

### 11.1 Write 처리 흐름

```text
Client ─► put foo=bar
            │
       ┌────▼───┐
       │ Leader │  로그에 기록
       └──┬─┬───┘
   복제   │ │   복제
   ┌──────┘ └──────┐
   ▼               ▼
┌──────┐        ┌──────┐
│ Flw1 │ ACK    │ Flw2 │ 느림
└──────┘        └──────┘
과반수(리더+Flw1) ACK → 커밋 → 응답
```

이 PC에서 etcd v3.5.21 컨테이너 세 개로 클러스터를 만들고 하나씩 죽여 봤다.

| 단계 | 살아 있는 멤버 | put | 선형(기본) get | 직렬화 get | 리더 / term |
|:-----|:-------------|:----|:-------------|:----------|:-----------|
| 시작 | 3/3 | OK | OK | OK | etcd1, term 2 |
| 리더 정지 | 2/3 | OK | OK | OK | 4초 안에 etcd2로, term 3 |
| 하나 더 정지 | 1/3 | 실패(`context deadline exceeded`) | 실패 | 마지막 값 반환 | 리더 없음 |
| 하나 복구 | 2/3 | OK | OK | OK | term 4 |

기본 `get`이 1/3에서 실패한 이유는 etcd가 읽기도 기본으로 선형화(linearizable)하기 때문이다. "내가 진짜 리더인가"를 과반수에게 확인한 뒤 답하므로 쿼럼이 없으면 못 답한다. `--consistency=s`(serializable)는 그 확인을 건너뛰고 자기 복제본을 그대로 주니 값이 나오지만 낡았을 수 있다. term이 한 번 죽을 때마다 하나씩 오르는 것은 선출이 한 번씩 일어났다는 기록이다. 리더가 죽은 뒤 새 리더가 서기까지 걸리는 시간은 하트비트 100ms와 선출 타임아웃 1000ms(기본값)로 정해지고, 디스크 fsync가 느려 하트비트를 놓치면 멀쩡한 클러스터에서도 리더가 바뀐다. 3.1에서 SSD를 권한 이유다.

### 11.2 쿼럼 공식

`Quorum = floor(N / 2) + 1`

| 멤버 수 | 쿼럼 | 허용 장애 | 왜 |
|:-------|:-----|:---------|:---|
| 1 | 1 | 0 | HA 아님. 단일 서버 k3s와 kubeadm 기본이 이것 |
| 2 | 2 | 0 | 하나 죽으면 쿼럼을 잃는다. 1대보다 나은 게 없다 |
| **3** | **2** | **1** | 최소 HA. 이 PC에서 1대 정지는 정상, 2대 정지는 쓰기 불가 |
| 4 | 3 | 1 | 3과 같은 허용치에 복제 비용만 늘어난다 |
| **5** | **3** | **2** | 운영 권장. 하나가 유지보수 중일 때 하나가 더 죽어도 된다 |
| 6 | 4 | 2 | 5와 같다 |
| **7** | **4** | **3** | etcd가 권하는 상한. 그 이상은 복제 지연으로 쓰기가 느려진다 |

### 11.3 왜 홀수인가

짝수 하나를 더하면 허용 장애 수는 그대로인데 쿼럼만 커진다. 네트워크가 갈릴 때 차이가 난다.

```text
[6노드가 3:3으로 갈릴 때]
A: 3노드, 필요 4 → 쓰기 불가
B: 3노드, 필요 4 → 쓰기 불가

[5노드가 3:2로 갈릴 때]
A: 3노드, 필요 3 → 정상
B: 2노드, 필요 3 → 읽기(직렬화)만
```

{{< callout type="warning" >}}
**etcd 멤버는 홀수(3 또는 5)** 로 둔다. 짝수는 허용 장애 수가 같으면서 정확히 반으로 갈릴 때 양쪽 다 멈출 위험만 더한다. 4대가 3대보다 나쁘다는 것이 직관에 어긋나지만 표를 보면 그 이유가 보인다. 그리고 "2대가 죽어도 된다"는 5대의 이야기다. 3대 클러스터에서 한 대를 업그레이드로 내렸다면 그동안은 장애 허용치가 0이다.
{{< /callout >}}

### 11.4 etcdctl 운영 명령

```bash
export ETCDCTL_API=3
E=/etc/kubernetes/pki/etcd
etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=$E/ca.crt \
  --cert=$E/server.crt \
  --key=$E/server.key \
  endpoint health

# 멤버와 리더 (같은 인증 옵션 생략)
etcdctl member list -w table
etcdctl endpoint status -w table
etcdctl endpoint health --cluster

# 알람(디스크 부족 등)·성능
etcdctl alarm list
etcdctl check perf
```

`endpoint status -w table`이 이 PC에서 보여 준 열은 엔드포인트, 멤버 ID, 버전, DB 크기(빈 클러스터에 20kB), 리더 여부, Raft term, Raft index였다. 리더를 죽이기 전 term 2였고 죽인 뒤 term 3, 하나 더 죽였다 살린 뒤 term 4였다. 운영에서 term이 이유 없이 오르면 네트워크나 디스크를 의심한다. kubeadm 클러스터에서 인증서 경로는 위와 같고, 백업과 복원은 [10](../10-cluster-maintenance)장 11절에서 본다.

---

## 12. kubeadm HA 클러스터 구성

### 12.1 첫 Control Plane 초기화

```bash
# 첫 컨트롤 플레인
sudo kubeadm init \
  --control-plane-endpoint \
    lb.example.com:6443 \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16
```

`--control-plane-endpoint`는 반드시 로드밸런서의 주소여야 하고 노드 하나의 IP면 안 된다. 이 값이 API 서버 인증서의 SAN과 모든 kubeconfig의 서버 주소에 박히기 때문에, 나중에 노드가 바뀌어도 이름은 그대로여야 한다. IP보다 DNS 이름을 권하는 이유도 그것이다. `--upload-certs`는 CA 키들을 `kubeadm-certs` Secret에 암호화해 올린다. 다른 컨트롤 플레인이 같은 CA로 인증서를 만들려면 키가 필요한데, 파일을 scp로 옮기는 대신 클러스터 안에 잠깐 두는 것이다. 암호화 키(`--certificate-key`)와 Secret은 **2시간** 뒤 사라진다.

### 12.2 추가 Control Plane 조인

```bash
# 추가 컨트롤 플레인 (2시간 안에)
sudo kubeadm join lb.example.com:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash \
    sha256:<hash> \
  --control-plane \
  --certificate-key <key>

# 인증서 키가 만료됐으면 다시 올린다
sudo kubeadm init phase upload-certs \
  --upload-certs
```

`--control-plane`이 붙으면 8절의 다섯 단계 중 control-plane-prepare와 control-plane-join이 실행된다. 인증서를 내려받아 자기 것을 만들고, 정적 파드 매니페스트를 쓰고, 로컬 etcd를 기존 클러스터에 멤버로 추가한다. 이 마지막 단계가 Stacked 토폴로지가 자동으로 만들어지는 지점이다.

### 12.3 Worker 조인

```bash
sudo kubeadm join lb.example.com:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash \
    sha256:<hash>
```

워커의 join 주소도 LB다. kubelet이 API 서버에 말하는 경로가 노드 하나에 묶이면 그 노드가 죽을 때 워커가 전부 NotReady가 된다.

### 12.4 이 PC에서 3대를 세우고 죽여 본 기록

kubeadm은 systemd가 있는 기계가 세 대 필요해 이 PC에서 끝까지 돌리지 못했다. 대신 같은 구조를 k3s로 만들었다. 첫 서버를 `--cluster-init`으로, 나머지 둘을 첫 서버의 토큰으로 붙이면 내장 etcd 3대의 Stacked 클러스터가 되고, 앞에 HAProxy 컨테이너를 뒀다.

```bash
# k3s로 같은 것을 만들면
k3s server --cluster-init        # cp1
k3s server --server https://cp1:6443 \
  --token <node-token>    # cp2, cp3
```

| 시점 | 한 일 | 결과(실측) |
|:-----|:-----|:----------|
| 0초 | cp1 기동 | 21초 뒤 토큰 발급 |
| | cp2, cp3 조인, HAProxy 기동 | 37~53초 뒤 3대 Ready(`control-plane,etcd`), 각 370~490MiB |
| | Deployment 3개 배포 | 노드마다 하나씩 |
| A | cp1 정지(2/3) | kubectl은 한 번도 실패하지 않았고, `readyz`의 etcd는 ok. 60초 뒤 cp1이 NotReady. 리스는 cp2, cp3로 이동. 새 Deployment 2개가 cp2, cp3에 정상 배포. `kubernetes` 엔드포인트가 3개에서 2개로 |
| B | cp2 정지(1/3) | kubectl은 EOF. LB 뒤에 남은 cp3는 응답하지 못했다. 리더였던 cp3의 컨트롤러 매니저가 리스 갱신에 실패해 11초 뒤 `leaderelection lost`로 종료 |
| B' | 같은 실험을 다시 하되 리스를 cp1이 쥔 상태에서 cp1, cp2를 연달아 정지 | cp3는 후보라 종료하지 않고 150초 넘게 선출을 반복 |
| C | cp2를 다시 기동(2/3) | 36초 뒤 API 응답, 37초 뒤 두 노드 Ready, `readyz`의 etcd ok |

한 대가 죽었을 때와 두 대가 죽었을 때의 차이가 둘째 원리다. 2/3에서는 etcd가 쓸 수 있으니 컨트롤러가 새 파드를 만들고 스케줄러가 배치해 아무 일도 없던 것처럼 돌았다. 1/3에서는 API 서버가 답을 못 하고, 리더였던 컨트롤러 매니저는 자기 리스를 못 갱신해 물러났다. 복구는 쿼럼을 되찾는 순간부터 시작되고 이 PC에서는 36초였다. 두 실험에서 cp3의 운명이 갈린 것도 그 원리다. 리더는 "갱신 못 하면 물러난다"는 규칙이 있어 죽었고, 후보는 기다리는 것이 일이라 살아 있었다.

k3s는 컴포넌트가 한 프로세스라 컨트롤러 매니저가 물러나자 서버 전체가 내려갔고, 이 실험은 컨테이너 안이라 그 노드의 파드도 함께 사라졌다. 실제 기계에서는 systemd가 k3s를 다시 올리고 containerd 아래의 파드는 그대로 돈다. kubeadm 클러스터라면 컨트롤러 매니저 정적 파드 하나만 재시작 루프에 들어가고 API 서버 파드는 남는다. 정지한 서버를 다시 올렸을 때 API가 돌아오는 데 36초가 걸린 것은 etcd 멤버 재합류와 API 서버의 readyz가 돌아오는 시간이다.

---

## 13. 노드 사이징과 규모 제한

### 13.1 Kubernetes 최대 규모

| 항목 | 공식 상한(v1.37 문서) | 현실 | 왜 |
|:-----|:-------------------|:-----|:---|
| 노드 수 | 5,000 | 1,000 미만이 보통 | 노드마다 kubelet이 API 서버에 상태를 보고하고 리스를 갱신한다 |
| 전체 파드 | 150,000 | | etcd 크기와 watch 이벤트 양 |
| 전체 컨테이너 | 300,000 | | |
| 노드당 파드 | 110 | 30~50 | kubelet의 `maxPods` 기본값이 110이다. 이 PC의 k3s 노드도 allocatable pods가 110이었다 |

원문의 "노드당 100"은 110으로 고쳤고, 근거를 찾지 못한 "네임스페이스당 Service 5,000"은 뺐다. 노드당 파드 수는 파드마다 IP가 필요하다는 사실과도 묶여 있다. 7.2의 노드당 /24는 주소 254개이고, 그중 110개를 파드가 쓰는 계산이다. 상한은 "이 조건을 전부 만족하는 구성을 지원한다"는 뜻이지 "여기까지 빠르다"는 뜻이 아니다. 문서는 큰 클러스터에서 컨트롤 플레인을 장애 영역마다 한두 대씩 두고 먼저 수직으로 키우라고 권하며, Event 객체를 별도 etcd로 빼는 방법을 소개한다.

### 13.2 규모별 사이징

경험적인 기준이지 공식 표가 아니다.

| 클러스터 규모 | 컨트롤 플레인 노드 스펙 | 용도 | 왜 |
|:-----------|:-------------------|:-----|:---|
| 1~5 노드 | 2 CPU, 4GB | 학습, 개인 | 3.1의 공식 최소값 위로 약간의 여유 |
| 6~100 노드 | 4 CPU, 16GB | 팀, 중소 서비스 | API 서버의 watch 캐시와 etcd가 메모리를 먹는다 |
| 101~500 노드 | 8 CPU, 32GB | 중대형 | 컨트롤러 매니저의 조정 루프가 객체 수에 비례 |
| 500+ 노드 | 16+ CPU, 64GB+ | 엔터프라이즈 | 여기부터 External etcd와 전용 디스크를 고려 |

### 13.3 프로덕션 체크리스트

| 항목 | 최소 | 권장 | 왜 |
|:-----|:-----|:-----|:---|
| 컨트롤 플레인 | 3 노드 | 3 노드 | 11절의 쿼럼. 3이면 유지보수 중 장애 허용이 0이니 5도 고려 |
| etcd | 3 멤버 | 5 멤버, 필요하면 External | 두 대 장애 허용 |
| 워커 | 2 노드 | 3+ 노드 | 노드 하나를 비워도(10장) 나머지가 파드를 받아야 한다 |
| 로드밸런서 | 1대 | 2대(VIP나 DNS 페일오버) | 12절의 LB가 단일 장애점이 되면 컨트롤 플레인 3대가 무의미하다 |

---

## 14. 트러블슈팅

### 14.1 자주 겪는 증상

| 증상 | 원인 | 왜 그렇게 되나 | 해결 |
|:-----|:-----|:-------------|:-----|
| kubelet이 안 뜬다, `kubeadm init` preflight 실패 | 스왑 켜짐 | `failSwapOn` 기본값 true(3.2) | `swapoff -a` 또는 kubelet 설정에 `failSwapOn: false` |
| kubelet 반복 재시작(init 전) | 정상 | 설정 파일이 없어 kubeadm을 기다린다(5절) | 그냥 init |
| kubelet 반복 재시작(init 후), 파드가 뜨자마자 죽음 | cgroup 드라이버 불일치 | containerd 1.x 등 RuntimeConfig 미지원 런타임(4.2) | containerd `SystemdCgroup = true` |
| 노드 NotReady, CoreDNS Pending | CNI 미설치 | NetworkReady가 false(7절) | CNI 매니페스트 적용 |
| 파드끼리 통신 안 됨 | 파드 CIDR 불일치, `ip_forward` 0 | CNI와 `--pod-network-cidr`이 다르거나 커널이 중계를 안 한다(3.4, 7.1) | 대역 통일, sysctl |
| join 실패 | 토큰 만료(24h), 해시 불일치, 6443 차단 | 8절의 두 비밀 중 하나가 틀렸다 | `token create --print-join-command`, 방화벽 |
| 1년 뒤 갑자기 `x509: certificate has expired` | 잎 인증서 만료 | 6.3의 1년 수명. 업그레이드를 1년 넘게 안 했다 | 14.3 |
| API 서버 접근 불가(HA) | LB 장애, 인증서 SAN에 LB 이름 없음 | 12.1의 endpoint를 뒤늦게 바꿨다 | LB 이중화, 인증서 재발급 |
| etcd 쓰기 실패, API 서버 503/EOF | 쿼럼 손실 | 11절. 2/3 이하가 살아 있다 | 멤버 복구. 이 PC에서 복구 뒤 36초 |
| 리더가 자주 바뀐다 | 네트워크 지연, 디스크 fsync 지연 | 하트비트 100ms를 놓친다(11.1) | SSD, `--heartbeat-interval`과 `--election-timeout` 조정 |

### 14.2 로그 및 디버깅

```bash
# kubelet (systemd)
sudo journalctl -u kubelet -f

# 컨테이너 (CRI)
sudo crictl ps -a
sudo crictl logs <container-id>

# 컨트롤 플레인 파드
kubectl -n kube-system logs \
  kube-apiserver-cp1
kubectl -n kube-system get pods -o wide

# 이벤트 전체
kubectl get events -A \
  --sort-by=.lastTimestamp
```

kubelet 로그가 첫째인 이유는 첫째 원리다. 컨트롤 플레인 파드를 띄우는 것이 kubelet이므로 API 서버가 안 뜨는 상황에서 `kubectl logs`는 쓸 수 없고, kubelet 로그와 `crictl`만 남는다. 진단 순서 전체는 [14](../14-troubleshooting)장 8절과 9절에서 본다.

### 14.3 인증서 관리

```bash
kubeadm certs check-expiration
sudo kubeadm certs renew all
# 정적 파드는 매니페스트를 옮겨 재시작
M=/etc/kubernetes/manifests
sudo mkdir -p /root/m
sudo mv $M/*.yaml /root/m/
sleep 20   # kubelet이 파드를 내린다
sudo mv /root/m/*.yaml $M/
```

이 PC에서 kubeadm이 만든 인증서 디렉터리에 `check-expiration`을 돌리자 잎 인증서 열한 개(admin.conf, apiserver, apiserver-etcd-client, apiserver-kubelet-client, controller-manager.conf, etcd-healthcheck-client, etcd-peer, etcd-server, front-proxy-client, scheduler.conf, super-admin.conf)가 전부 `364d`, CA 셋이 `9y`였다. `renew apiserver`를 하니 만료일이 그날부터 1년으로 다시 찍혔다. `kubeadm upgrade`가 매번 갱신해 주므로 1년 안에 한 번은 업그레이드하는 클러스터에서는 만료를 볼 일이 없고, 그러지 못한 클러스터가 1년째 되는 날 깨진다. 갱신 뒤 컨트롤 플레인 파드를 다시 띄워야 하는 이유는 프로세스가 인증서 파일을 시작할 때만 읽기 때문이다. 정적 파드는 `kubectl delete`로 지울 수 없어 매니페스트를 잠시 치우는 방법을 쓴다. kubelet 자신의 클라이언트 인증서는 이 목록에 없다. kubelet은 만료 전에 스스로 CSR을 내 갱신한다(`rotateCertificates`).

### 14.4 클러스터 리셋

```bash
sudo kubeadm reset
# reset이 지우지 않는 것들
sudo rm -rf /etc/cni/net.d
rm -rf $HOME/.kube/config
sudo iptables -F
sudo iptables -t nat -F
sudo iptables -t mangle -F
sudo iptables -X
sudo crictl rm -af
sudo crictl rmi -a
```

`kubeadm reset`의 단계는 preflight, remove-etcd-member, cleanup-node 셋이다. 컨트롤 플레인이면 로컬 etcd를 클러스터에서 탈퇴시키고, 매니페스트와 `/var/lib/kubelet`, `/etc/kubernetes`를 지운다. CNI 설정과 iptables 규칙은 kubeadm이 만든 것이 아니라서 남는다. 워커를 지울 때는 먼저 `kubectl drain`으로 파드를 옮기고 `kubectl delete node`를 한 뒤 그 노드에서 reset한다. 이 PC에서 에이전트 노드를 `drain`하니 파드 세 개가 서버 노드로 옮겨 가고 노드는 `Ready,SchedulingDisabled`가 됐으며, `delete node`를 하자 목록에서 사라졌지만 컨테이너 안의 k3s 프로세스는 그대로 돌고 있었다. 노드 객체 삭제는 등록 해제일 뿐 기계를 끄는 것이 아니다. 절차 전체는 [10](../10-cluster-maintenance)장 2절이다.

---

## 15. 명령어 요약

```bash
# 사전 설정
sudo swapoff -a
sudo modprobe overlay br_netfilter

# 부트스트랩
kubeadm config images pull
kubeadm init --pod-network-cidr=...
kubeadm init --control-plane-endpoint \
  LB:6443 --upload-certs
kubeadm join LB:6443 --token T \
  --discovery-token-ca-cert-hash \
    sha256:H
kubeadm token create \
  --print-join-command
kubeadm reset

# kubectl
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf \
  $HOME/.kube/config

# 상태
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get --raw '/readyz?verbose'

# HA 상태
kubectl -n kube-system get lease
kubectl -n kube-system get lease \
  kube-controller-manager

# etcd
etcdctl endpoint health --cluster
etcdctl member list -w table
etcdctl endpoint status -w table

# 인증서
kubeadm certs check-expiration
kubeadm certs renew all
```

---

## 핵심 정리

| 개념 | 설명 | 왜 |
|:-----|:-----|:---|
| 설치 선택 | 학습은 Docker Desktop, Minikube, kind, k3s. 팀은 kind나 k3s. 운영은 관리형 또는 kubeadm HA | 컨트롤 플레인을 누가 운영하는가의 문제다 |
| kubeadm | 인증서, kubeconfig, 정적 파드, 토큰을 만드는 부트스트랩 도구 | kubelet, 런타임, CNI, LB는 밖이다 |
| 사전 준비 | 스왑(기본값은 off), `overlay`와 `br_netfilter`, `ip_forward=1`, 포트 | kubelet이 거부하거나 파드 통신이 끊긴다 |
| 런타임 | containerd 2.x, systemd 호스트면 `SystemdCgroup = true` | 1.34부터 kubelet이 런타임의 드라이버를 따라가지만 짝은 맞아야 한다 |
| init 순서 | certs → kubeconfig → 매니페스트 → kubelet-start → 토큰 → 애드온 | 인증서가 있어야 나머지가 있다 |
| CNI | 설치 전까지 NotReady. `--pod-network-cidr`과 대역을 맞춘다 | 노드마다 /24를 잘라 주고 그 사이를 이어 주는 것이 CNI다 |
| join | 토큰(24h)은 클러스터가 노드를, CA 해시는 노드가 클러스터를 믿게 한다 | 두 방향의 신뢰 |
| HA | API 서버는 LB 뒤에 여러 대, 컨트롤러와 스케줄러는 리스로 한 대, etcd는 과반수 | 상태와 결정을 따로 본다 |
| etcd 쿼럼 | `floor(N/2)+1`, 홀수 3 또는 5. 2/3은 정상, 1/3은 쓰기 불가 | 이 PC에서 그대로 재현 |
| 인증서 | 잎 1년, CA 10년. 업그레이드가 갱신한다 | 1년 넘게 방치한 클러스터가 깨지는 이유 |

{{< callout type="warning" >}}
**검증하지 못한 것**
- kubeadm은 컨테이너 안에서 preflight, certs, kubeconfig, control-plane, etcd, check-expiration, renew 단계만 돌렸다. systemd가 있는 기계에서의 실제 `init`과 `join`, CSR 자동 승인, 워커 조인은 문서와 k3s의 동작으로 대신했다.
- 3대 HA는 k3s의 내장 etcd로 재현했다. kubeadm의 Stacked 토폴로지와 구조는 같지만 프로세스 배치가 다르다. 컨트롤러 매니저가 물러날 때 k3s는 서버 전체가 내려갔고, 컨테이너 실험이라 그 노드의 파드도 함께 사라졌다.
- Calico와 Cilium 설치, External etcd, keepalived 같은 LB 이중화, 관리형 서비스의 동작과 요금은 직접 확인하지 않았다.
- 노드당 110개 파드나 5,000 노드 같은 상한은 공식 문서 값이고, 13.2의 사이징 표는 경험적 기준이다.
{{< /callout >}}

{{< callout type="info" >}}
**용어 정리**
- **kubeadm**: 공식 클러스터 부트스트랩 CLI. init, join, upgrade, reset, certs, token
- **Control Plane**: API 서버, 스케줄러, 컨트롤러 매니저, etcd. 옛 이름 Master
- **정적 파드(Static Pod)**: API 서버 없이 kubelet이 매니페스트 디렉터리를 보고 띄우는 파드. 컨트롤 플레인이 이것이다
- **부트스트랩 토큰**: `id.secret` 형식의 24시간짜리 조인 자격. `system:bootstrappers` 그룹
- **CA 해시(discovery-token-ca-cert-hash)**: 새 노드가 클러스터의 CA 공개키를 확인하는 SHA-256 값
- **CNI**: 파드에 네트워크를 붙이는 플러그인 규격. Flannel, Calico, Cilium
- **cgroup 드라이버**: kubelet과 런타임이 cgroup을 다루는 방식. systemd 또는 cgroupfs
- **Stacked etcd**: 컨트롤 플레인 노드에 etcd를 함께 두는 토폴로지. kubeadm 기본
- **External etcd**: etcd 클러스터를 따로 운영하는 토폴로지
- **Quorum**: Raft 합의에 필요한 과반수, `floor(N/2)+1`
- **Lease**: 컨트롤러 매니저와 스케줄러가 리더 한 대를 정하는 객체. 15초 수명, 10초 갱신 기한
- **Managed Kubernetes**: 클라우드가 컨트롤 플레인을 운영하는 서비스(GKE, EKS, AKS)
- **Turnkey**: 직접 설치하고 운영하는 방식(kubeadm, Kops, RKE2, OpenShift)
{{< /callout >}}
