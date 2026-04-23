---
title: "03. 클러스터 구성"
weight: 3
---

쿠버네티스 클러스터를 설치하는 여러 방법과 운영 환경에서 필요한 고가용성(HA) 토폴로지, etcd 쿼럼 설계, 노드 사이징을 정리한다.

## 1. 설치 방법 선택

쿠버네티스는 하나의 "설치 방법"이 존재하지 않는다. 목적(학습·개발·운영)과 인프라(로컬·온프레·클라우드)에 따라 도구가 달라진다.

### 1.1 배포 환경 분류

```text
┌─────────────────────────────────┐
│        배포 환경 선택            │
├────────────────┬────────────────┤
│  로컬/학습      │   프로덕션      │
├────────────────┼────────────────┤
│ Minikube       │ kubeadm        │
│ kind           │ Kops (AWS)     │
│ k3s            │ Rancher        │
│ Docker Desktop │ OpenShift      │
│ kubeadm (1노드)│ ──────────────│
│                │ Managed 서비스 │
│                │ GKE / EKS / AKS│
└────────────────┴────────────────┘
```

### 1.2 경량 배포 도구 비교

| 도구 | 특징 | 노드 구성 |
|:---|:---|:---|
| **Minikube** | 개인 PC에서 간편 설치, 단일 노드 | 단일 |
| **kind** | Docker 컨테이너 기반, Kubernetes IN Docker | 단일/다중 |
| **k3s** | Rancher 경량 버전, 리소스 효율 | 단일/다중 |
| **Docker Desktop** | Windows/Mac GUI, 토글로 활성화 | 단일 |

### 1.3 자체 운영 vs 관리형

| 항목 | Turnkey (kubeadm, Kops) | Managed (GKE/EKS/AKS) |
|:---|:---|:---|
| Control Plane 운영 | 직접 | 프로바이더 |
| 업그레이드 | 수동 | 자동 또는 원클릭 |
| 보안 패치 | 직접 | 프로바이더 |
| 비용 | 인프라만 | 인프라 + 관리비 |
| 유연성 | 높음 | 제한적 |
| 전문성 요구 | 높음 | 낮음 |

### 1.4 클라우드 프로바이더

| 프로바이더 | 서비스 | 장점 | 단점 |
|:---|:---|:---|:---|
| **GCP** | GKE | 가장 성숙, 자동 업그레이드 | 비용 높음 |
| **AWS** | EKS | AWS 생태계 통합 | 네트워킹 복잡 |
| **Azure** | AKS | AD 통합, Control Plane 무료 | 리전 제한 |
| **Oracle** | OKE | 저비용 | 점유율 낮음 |
| **On-prem** | kubeadm | 완전한 제어 | 운영 부담 |

### 1.5 선택 가이드

```text
목적이 무엇인가?
    │
    ├─ 학습 ──────► Minikube / kind / Docker Desktop
    │
    ├─ 개발 ──────► kind / k3s / kubeadm (소규모)
    │
    └─ 프로덕션
           │
           ├─ 관리 역량 있음 ──► kubeadm / Kops
           │
           └─ 빠른 시작 ───────► GKE / EKS / AKS
```

{{< callout type="info" >}}
초보자는 **Docker Desktop 또는 Minikube**로 시작하고, 팀 개발은 **kind/k3s**, 프로덕션은 **관리형 서비스**를 기본으로 고려한다. kubeadm은 "언제든 손으로 풀어쓸 수 있어야 하는" CKA 관점의 학습에도 가장 적합하다.
{{< /callout >}}

## 2. kubeadm 개요

**kubeadm** 은 Kubernetes 공식 부트스트래핑 도구로, 베스트 프랙티스에 따라 Control Plane을 자동 구성한다.

### 2.1 수동 설치와의 차이

| 작업 | 수동 설치 | kubeadm |
|:---|:---|:---|
| 바이너리 배치 | 각 컴포넌트 개별 다운로드 | 패키지 설치 |
| 설정 파일 | 직접 작성 | 자동 생성 |
| PKI 인증서 | 수동 생성 | 자동 생성 |
| 컴포넌트 기동 | systemd 직접 구성 | Static Pod 자동 배포 |
| 검증 | 오류 가능성 높음 | 검증된 설정 |

### 2.2 설치 흐름

```text
┌────────────────────────────┐
│  1. 사전 준비                │
│     (스왑 off, 커널 모듈)    │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  2. Container Runtime       │
│     (containerd 권장)       │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  3. kubeadm/kubelet/kubectl │
│     (모든 노드)              │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  4. kubeadm init            │
│     (Control Plane)         │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  5. CNI 플러그인             │
│     (Calico/Flannel/Cilium) │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  6. kubeadm join            │
│     (Worker 노드)           │
└──────────────┬─────────────┘
               ▼
┌────────────────────────────┐
│  7. 클러스터 검증            │
└────────────────────────────┘
```

## 3. 사전 요구사항

### 3.1 하드웨어

| 역할 | CPU | 메모리 | 디스크 |
|:---|:---|:---|:---|
| Control Plane (최소) | 2 코어 | 2GB | 20GB |
| Worker (최소) | 1 코어 | 1GB | 20GB |
| Control Plane (권장) | 4 코어 | 8GB | 100GB SSD |
| Worker (권장) | 4 코어 | 16GB | 100GB SSD |

### 3.2 네트워크 요구사항

| 항목 | 확인 방법 |
|:---|:---|
| 고유 hostname | `hostname` |
| 고유 MAC 주소 | `ip link` |
| 고유 product_uuid | `sudo cat /sys/class/dmi/id/product_uuid` |
| 노드 간 통신 | 모든 포트 접근 가능 |
| 스왑 비활성화 | `sudo swapoff -a` |

### 3.3 필수 포트

**Control Plane**

| 포트 | 프로토콜 | 용도 |
|:---|:---|:---|
| 6443 | TCP | Kubernetes API Server |
| 2379-2380 | TCP | etcd client/peer API |
| 10250 | TCP | Kubelet API |
| 10257 | TCP | kube-controller-manager |
| 10259 | TCP | kube-scheduler |

**Worker**

| 포트 | 프로토콜 | 용도 |
|:---|:---|:---|
| 10250 | TCP | Kubelet API |
| 10256 | TCP | kube-proxy |
| 30000-32767 | TCP | NodePort Services |

### 3.4 사전 설정 스크립트

```bash
# 모든 노드에서 실행
# 1. 스왑 비활성화
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# 2. 커널 모듈 로드
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# 3. 커널 파라미터
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
```

## 4. Container Runtime 설치

Kubernetes 1.24부터 **dockershim이 제거**되어 containerd를 권장한다.

### 4.1 containerd 설치 (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
   https://download.docker.com/linux/ubuntu \
   $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list

sudo apt-get update
sudo apt-get install -y containerd.io
```

### 4.2 SystemdCgroup 활성화

```bash
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' \
  /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
```

```toml
# /etc/containerd/config.toml 핵심 설정
[plugins."io.containerd.grpc.v1.cri"]
  sandbox_image = "registry.k8s.io/pause:3.9"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true   # cgroup v2 환경 필수
```

{{< callout type="warning" >}}
**SystemdCgroup = false** 로 두면 kubelet과 containerd의 cgroup 드라이버가 불일치해 `kubelet` 시작 실패 또는 무한 재시작이 발생한다. 설치 직후 반드시 `true`로 바꾸고 `systemctl restart containerd`로 적용한다.
{{< /callout >}}

## 5. kubeadm, kubelet, kubectl 설치

### 5.1 Ubuntu/Debian

```bash
sudo apt-get install -y apt-transport-https ca-certificates curl gpg

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] \
  https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl   # 자동 업그레이드 방지
sudo systemctl enable --now kubelet
```

### 5.2 CentOS/RHEL

```bash
# SELinux permissive
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
sudo systemctl enable --now kubelet
```

## 6. Control Plane 초기화

### 6.1 단일 Control Plane

```bash
# 기본 초기화
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# 광고 IP 지정
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.10
```

### 6.2 주요 옵션

| 옵션 | 설명 | 예시 |
|:---|:---|:---|
| `--pod-network-cidr` | Pod 네트워크 대역 | 10.244.0.0/16 (Flannel) |
| `--apiserver-advertise-address` | API Server 광고 IP | 192.168.1.10 |
| `--control-plane-endpoint` | HA용 LB 엔드포인트 | lb.example.com:6443 |
| `--upload-certs` | 인증서 업로드 (HA) | - |
| `--service-cidr` | Service 대역 | 10.96.0.0/12 (기본) |
| `--kubernetes-version` | 특정 버전 | v1.29.0 |
| `--cri-socket` | CRI 소켓 경로 | unix:///run/containerd/containerd.sock |

### 6.3 init 내부 수행 단계

```text
[preflight]        사전 검사
[certs]            PKI 인증서 생성
                   ├─ CA
                   ├─ API Server
                   ├─ etcd
                   └─ kubelet
[kubeconfig]       admin/kubelet/controller/scheduler.conf
[kubelet-start]    kubelet 시작
[control-plane]    Static Pod 매니페스트
                   ├─ kube-apiserver
                   ├─ kube-controller-manager
                   └─ kube-scheduler
[etcd]             etcd Static Pod
[upload-config]    ConfigMap 저장
[mark-control]     Control Plane taint
[bootstrap-token]  조인 토큰 생성
[addons]           CoreDNS, kube-proxy
```

### 6.4 kubectl 설정

```bash
# 일반 사용자
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# root 사용자
echo "export KUBECONFIG=/etc/kubernetes/admin.conf" >> ~/.bashrc
source ~/.bashrc
```

{{< callout type="warning" >}}
`kubeadm init` 출력의 **join 명령어와 토큰은 반드시 안전한 곳에 보관**한다. 토큰 기본 수명은 24시간이며, 분실 시 `kubeadm token create --print-join-command`로 새로 발급할 수 있다.
{{< /callout >}}

## 7. CNI 플러그인

CNI를 설치하기 전까지 노드 상태는 **NotReady**이며 CoreDNS는 Pending에 머문다.

### 7.1 주요 CNI 비교

| CNI | 특징 | Pod CIDR | Network Policy |
|:---|:---|:---|:---|
| **Calico** | 고성능, 표준에 가까움 | 192.168.0.0/16 | 지원 |
| **Flannel** | 간단, 경량 | 10.244.0.0/16 | 미지원 |
| **Weave** | 암호화 지원 | 10.32.0.0/12 | 지원 |
| **Cilium** | eBPF 기반, L7 정책 | 10.0.0.0/8 | 지원 |

### 7.2 설치 예시

```bash
# Calico (권장)
kubectl apply -f \
  https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml

# Flannel
kubectl apply -f \
  https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### 7.3 설치 확인

```bash
kubectl get pods -n kube-system
kubectl get nodes
# NAME     STATUS   ROLES           AGE   VERSION
# master   Ready    control-plane   5m    v1.29.0
```

## 8. Worker 노드 조인

### 8.1 조인 명령

```bash
sudo kubeadm join 192.168.1.10:6443 \
  --token abcdef.0123456789abcdef \
  --discovery-token-ca-cert-hash sha256:abc123...
```

### 8.2 토큰 관리

```bash
# 토큰 목록
kubeadm token list

# 새 토큰과 join 명령 즉시 생성
kubeadm token create --print-join-command

# 인증서 해시 수동 계산
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt \
  | openssl rsa -pubin -outform der 2>/dev/null \
  | openssl dgst -sha256 -hex | sed 's/^.* //'
```

### 8.3 라벨 부여

```bash
kubectl label node worker1 node-role.kubernetes.io/worker=worker
kubectl label node worker2 node-role.kubernetes.io/worker=worker
kubectl get nodes
# NAME      STATUS   ROLES    AGE   VERSION
# master    Ready    control-plane  10m   v1.29.0
# worker1   Ready    worker         2m    v1.29.0
```

## 9. 설치 검증

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system

# API 헬스체크
kubectl get --raw='/healthz'
kubectl get --raw='/readyz'

# 테스트 배포
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80 --type=NodePort
kubectl get svc

# DNS 동작 테스트
kubectl run dnsutils \
  --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 \
  --command -- sleep infinity
kubectl exec -it dnsutils -- nslookup kubernetes.default
```

## 10. HA 토폴로지

단일 Master는 SPOF(Single Point of Failure)다. Master가 죽으면 kubectl 명령, 새 Pod 생성, 스케일링, 자동 복구 모두 불가능하다(단, 기존 Pod는 계속 동작).

### 10.1 컴포넌트별 HA 전략

| 컴포넌트 | 모드 | 이유 |
|:---|:---|:---|
| **kube-apiserver** | Active-Active | 무상태, 모두 동시 활성 가능 |
| **controller-manager** | Active-Standby | 중복 작업 방지 |
| **scheduler** | Active-Standby | 중복 스케줄링 방지 |
| **etcd** | Active-Active | 분산 합의 (Raft) |

### 10.2 API Server Load Balancing

```text
             kubectl
                │
                ▼
      ┌──────────────────┐
      │  Load Balancer   │
      │ HAProxy / nginx  │
      └────────┬─────────┘
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
   ┌─────┐ ┌─────┐ ┌─────┐
   │ API │ │ API │ │ API │
   │:6443│ │:6443│ │:6443│
   └─────┘ └─────┘ └─────┘
    Mst1    Mst2    Mst3
```

**HAProxy 설정**

```bash
# /etc/haproxy/haproxy.cfg
frontend kubernetes-api
    bind *:6443
    mode tcp
    default_backend kubernetes-api-backend

backend kubernetes-api-backend
    mode tcp
    option tcp-check
    balance roundrobin
    server master1 192.168.1.11:6443 check fall 3 rise 2
    server master2 192.168.1.12:6443 check fall 3 rise 2
    server master3 192.168.1.13:6443 check fall 3 rise 2
```

### 10.3 Leader Election

Controller Manager와 Scheduler는 Lease 오브젝트를 통해 단일 Leader를 선출한다.

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

동작 원리는 `renew-deadline` 내 Lease 갱신 실패 시 `lease-duration` 경과 후 다른 인스턴스가 Leader를 인수한다.

### 10.4 etcd 토폴로지

**Stacked (통합형)** — Control Plane 노드에 etcd 통합

```text
┌──────────────────────────┐
│      Master Node          │
│  ┌───────────────────┐    │
│  │ API/Scheduler/CM  │    │
│  └───────────────────┘    │
│  ┌───────────────────┐    │
│  │       etcd        │    │
│  └───────────────────┘    │
└──────────────────────────┘

장점: 관리 간단, 노드 최소화
단점: 노드 장애 시 etcd도 손실
용도: 소규모 클러스터
```

**External (분리형)** — etcd 클러스터 분리 운영

```text
┌──────┐  ┌──────┐  ┌──────┐
│Mst 1 │  │Mst 2 │  │Mst 3 │
│ API  │  │ API  │  │ API  │
└───┬──┘  └───┬──┘  └───┬──┘
    │         │         │
    └─────────┼─────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌──────┐  ┌──────┐  ┌──────┐
│etcd 1│  │etcd 2│  │etcd 3│
└──────┘  └──────┘  └──────┘

장점: Control Plane 장애가 etcd에 무관
단점: 노드 수 증가, 설정 복잡
용도: 대규모·고가용성 클러스터
```

```yaml
# API Server → 외부 etcd 연결
spec:
  containers:
  - command:
    - kube-apiserver
    - --etcd-servers=https://etcd1:2379,https://etcd2:2379,https://etcd3:2379
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key
```

## 11. etcd 쿼럼과 노드 수

etcd는 **Raft** 합의 알고리즘을 사용해 과반수(Quorum) 동의가 있어야 Write가 커밋된다.

### 11.1 Write 처리 흐름

```text
Client ──► Write (foo=bar)
              │
              ▼
         ┌────────┐
         │ Leader │
         └────┬───┘
              │  복제
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐
│ Flw  │ │ Flw  │ │ Flw  │
│ ACK  │ │ ACK  │ │ 느림  │
└──────┘ └──────┘ └──────┘
    │         │
    └────┬────┘
         ▼
과반수 ACK → Write 커밋 → Client 응답
```

### 11.2 쿼럼 공식

`Quorum = floor(N / 2) + 1`

| 노드 수 | Quorum | 허용 장애 | 권장 |
|:---|:---|:---|:---|
| 1 | 1 | 0 | HA 불가 |
| 2 | 2 | 0 | 무의미 |
| **3** | **2** | **1** | 최소 HA |
| 4 | 3 | 1 | 3과 동일 |
| **5** | **3** | **2** | 권장 |
| 6 | 4 | 2 | 5와 동일 |
| **7** | **4** | **3** | 고가용성 |

### 11.3 왜 홀수인가

네트워크 분할이 일어나면 짝수 구성은 양쪽 모두 쿼럼을 잃을 수 있다.

```text
[짝수 6노드 분할]
A: 3노드, Quorum=4 → ❌
B: 3노드, Quorum=4 → ❌
→ 양쪽 모두 Write 불가

[홀수 5노드 분할]
A: 3노드, Quorum=3 → ✅
B: 2노드, Quorum=3 → ❌ (읽기만)
→ 한쪽은 클러스터 유지
```

{{< callout type="warning" >}}
**etcd 노드는 반드시 홀수(3 또는 5)** 로 구성한다. 짝수 노드는 장애 허용 수는 동일한데 네트워크 분할 시 스플릿 브레인 위험만 커진다. 4노드가 3노드보다 나쁘다는 사실은 직관에 반하지만, 쿼럼 공식을 보면 명확하다.
{{< /callout >}}

### 11.4 etcdctl 운영 명령

```bash
export ETCDCTL_API=3

# 엔드포인트 헬스
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# 멤버 목록과 리더
etcdctl member list -w table
etcdctl endpoint status -w table

# 알람(디스크 부족 등)
etcdctl alarm list
etcdctl check perf
```

## 12. kubeadm HA 클러스터 구성

### 12.1 첫 Control Plane 초기화

```bash
sudo kubeadm init \
  --control-plane-endpoint "LOAD_BALANCER_IP:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16

# 출력 예시
# kubeadm join LOAD_BALANCER_IP:6443 --token <token> \
#   --discovery-token-ca-cert-hash sha256:<hash> \
#   --control-plane --certificate-key <cert-key>
```

### 12.2 추가 Control Plane 조인

```bash
sudo kubeadm join LOAD_BALANCER_IP:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane \
  --certificate-key <cert-key>
```

### 12.3 Worker 조인

```bash
sudo kubeadm join LOAD_BALANCER_IP:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

## 13. 노드 사이징과 규모 제한

### 13.1 Kubernetes 최대 규모

| 항목 | 최대값 | 권장값 |
|:---|:---|:---|
| 노드 수 | 5,000 | 1,000 미만 |
| 전체 Pod | 150,000 | 100,000 미만 |
| 노드당 Pod | 100 | 30~50 |
| 네임스페이스당 Service | 5,000 | - |

### 13.2 규모별 사이징

| 클러스터 규모 | 노드 스펙 | 용도 |
|:---|:---|:---|
| 1~5 노드 | 2 CPU, 4GB | 학습/개인 |
| 6~100 노드 | 4 CPU, 16GB | 팀/중소 서비스 |
| 101~500 노드 | 8 CPU, 32GB | 중대형 서비스 |
| 500+ 노드 | 16+ CPU, 64GB+ | 엔터프라이즈 |

### 13.3 프로덕션 체크리스트

| 항목 | 최소 | 권장 |
|:---|:---|:---|
| Control Plane | 3 노드 | 3 노드 (홀수) |
| etcd | 3 노드 | 5 노드 (External) |
| Worker | 2 노드 | 3+ 노드 |
| Load Balancer | 1 대 | 2 대 (HA) |

## 14. 트러블슈팅

### 14.1 자주 겪는 증상

| 증상 | 원인 | 해결 |
|:---|:---|:---|
| `kubeadm init` 실패 | 스왑 활성 | `swapoff -a` |
| kubelet 반복 재시작 | cgroup 드라이버 불일치 | containerd SystemdCgroup=true |
| 노드 NotReady | CNI 미설치 | CNI 매니페스트 적용 |
| CoreDNS Pending | CNI 미설치 | CNI 매니페스트 적용 |
| Pod Pending | 리소스/taint | `kubectl describe pod` |
| API Server 접근 불가 | LB 장애 | LB 헬스·백업 LB 확인 |
| etcd Write 실패 | 쿼럼 손실 | 노드 복구·재구성 |
| Leader 잦은 변경 | 네트워크 불안정 | 타임아웃 조정 |

### 14.2 로그 및 디버깅

```bash
# kubelet
sudo journalctl -u kubelet -f

# containerd 컨테이너 로그
sudo crictl ps
sudo crictl logs <container-id>

# Control Plane Pod 로그
kubectl logs -n kube-system kube-apiserver-master1
kubectl logs -n kube-system kube-controller-manager-master1
kubectl logs -n kube-system kube-scheduler-master1

# 전체 이벤트
kubectl get events -A --sort-by='.lastTimestamp'
```

### 14.3 인증서 관리

```bash
# 만료 확인
kubeadm certs check-expiration

# 전체 갱신
sudo kubeadm certs renew all
sudo systemctl restart kubelet
```

### 14.4 클러스터 리셋

```bash
sudo kubeadm reset
sudo rm -rf /etc/cni/net.d $HOME/.kube/config
sudo iptables -F && sudo iptables -t nat -F \
  && sudo iptables -t mangle -F && sudo iptables -X
sudo crictl rm -af
sudo crictl rmi -a
```

## 15. 명령어 요약

```bash
# 사전 설정
sudo swapoff -a
sudo modprobe overlay br_netfilter

# 클러스터 부트스트랩
kubeadm init --pod-network-cidr=10.244.0.0/16
kubeadm init --control-plane-endpoint "LB:6443" --upload-certs
kubeadm join <master>:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
kubeadm token create --print-join-command
kubeadm reset

# kubectl 설정
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 상태 확인
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system

# HA 상태
kubectl get lease -n kube-system kube-controller-manager
kubectl get lease -n kube-system kube-scheduler

# etcd
etcdctl endpoint health --cluster
etcdctl member list -w table
etcdctl endpoint status -w table

# 인증서
kubeadm certs check-expiration
kubeadm certs renew all
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 설치 선택 | 학습은 Minikube/kind, 팀은 kubeadm/k3s, 운영은 Managed 또는 kubeadm HA |
| kubeadm | 공식 부트스트랩 도구, Static Pod로 Control Plane 자동 배포 |
| 사전 준비 | 스왑 off, `br_netfilter`/`overlay` 모듈, `ip_forward=1` |
| Runtime | containerd 권장, **SystemdCgroup=true** 필수 |
| CNI | 설치 전까지 NotReady, Calico/Flannel/Cilium 택1 |
| HA 구성 | API Active-Active + Controller/Scheduler Active-Standby + etcd 분산 |
| etcd 쿼럼 | `N/2 + 1`, 반드시 홀수 (3 또는 5) |
| 토폴로지 | Stacked(소규모) vs External(대규모) |
| 토큰 | 기본 24h, `kubeadm token create --print-join-command`로 재발급 |

{{< callout type="info" >}}
**용어 정리**
- **kubeadm**: 공식 클러스터 부트스트랩 CLI
- **Control Plane**: API/Scheduler/Controller/etcd를 포함한 마스터 평면
- **CNI**: Pod 네트워크를 구성하는 플러그인 인터페이스
- **Stacked etcd**: Control Plane 노드에 etcd를 함께 두는 토폴로지
- **External etcd**: etcd를 분리 운영하는 토폴로지
- **Quorum**: Raft 합의에 필요한 과반수, `floor(N/2)+1`
- **Leader Election**: Lease를 이용한 단일 활성 인스턴스 선출
- **Managed Kubernetes**: 클라우드가 Control Plane을 운영해주는 서비스 (GKE/EKS/AKS)
- **Turnkey**: 직접 설치·운영하는 자체 관리형 (kubeadm, Kops, Rancher)
{{< /callout >}}
