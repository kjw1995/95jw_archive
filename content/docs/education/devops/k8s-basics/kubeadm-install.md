---
title: "kubeadm Installation"
weight: 10
---

kubeadm을 사용한 Kubernetes 클러스터 설치 과정을 단계별로 다룹니다.

---

## 1. kubeadm 개요

### 1.1 kubeadm이란?

kubeadm은 Kubernetes 클러스터를 **베스트 프랙티스에 따라 부트스트래핑**하는 공식 도구입니다.

```
┌──────────────────────────────────────────────────────────────┐
│                    수동 설치 vs kubeadm                        │
├───────────────────────────┬──────────────────────────────────┤
│       수동 설치            │           kubeadm               │
├───────────────────────────┼──────────────────────────────────┤
│ 각 컴포넌트 개별 다운로드   │ 자동 설치                        │
│ 설정 파일 직접 작성        │ 자동 구성                        │
│ 인증서 수동 생성           │ PKI 자동 생성                    │
│ systemd 서비스 직접 구성   │ Static Pod로 자동 배포           │
│ 컴포넌트 간 연결 수동      │ 자동 연결                        │
│ 오류 발생 가능성 높음      │ 검증된 설정 적용                 │
└───────────────────────────┴──────────────────────────────────┘
```

### 1.2 설치 흐름

```
┌──────────────────────────────────────────────────────────────┐
│                    kubeadm 설치 흐름                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. 사전 준비                                                 │
│     ├── 시스템 요구사항 확인                                  │
│     ├── 네트워크 설정                                         │
│     └── 방화벽 포트 개방                                      │
│              │                                                │
│              ▼                                                │
│  2. Container Runtime 설치                                    │
│     └── containerd (권장)                                     │
│              │                                                │
│              ▼                                                │
│  3. kubeadm, kubelet, kubectl 설치                           │
│     └── 모든 노드에 설치                                      │
│              │                                                │
│              ▼                                                │
│  4. Control Plane 초기화                                      │
│     └── kubeadm init (Master 노드)                           │
│              │                                                │
│              ▼                                                │
│  5. CNI 플러그인 설치                                         │
│     └── Calico, Flannel, Weave 등                            │
│              │                                                │
│              ▼                                                │
│  6. Worker 노드 조인                                          │
│     └── kubeadm join (Worker 노드)                           │
│              │                                                │
│              ▼                                                │
│  7. 설치 검증                                                 │
│     └── 클러스터 상태 확인                                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 사전 요구사항

### 2.1 하드웨어 요구사항

| 역할 | CPU | 메모리 | 디스크 |
|:-----|:----|:-------|:-------|
| **Control Plane** | 2 코어 이상 | 2GB 이상 | 20GB 이상 |
| **Worker Node** | 1 코어 이상 | 1GB 이상 | 20GB 이상 |

{{< callout type="info" >}}
**권장 사양 (프로덕션):**
- Control Plane: 4 CPU, 8GB RAM, 100GB SSD
- Worker: 4 CPU, 16GB RAM, 100GB SSD
{{< /callout >}}

### 2.2 운영체제 요구사항

| 항목 | 요구사항 |
|:-----|:---------|
| **OS** | Linux (64-bit) |
| **배포판** | Ubuntu 20.04+, CentOS 7+, RHEL 7+, Debian 10+ |
| **커널** | 3.10 이상 |
| **cgroup** | cgroup v1 또는 v2 |

### 2.3 네트워크 요구사항

```
┌──────────────────────────────────────────────────────────────┐
│                    네트워크 요구사항                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  • 모든 노드 간 네트워크 연결 가능                             │
│  • 고유한 hostname, MAC 주소, product_uuid                    │
│  • 특정 포트 개방 필요                                        │
│  • 스왑 비활성화 필수                                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 필수 포트

#### Control Plane 노드

| 포트 | 프로토콜 | 용도 |
|:-----|:---------|:-----|
| 6443 | TCP | Kubernetes API Server |
| 2379-2380 | TCP | etcd server client API |
| 10250 | TCP | Kubelet API |
| 10259 | TCP | kube-scheduler |
| 10257 | TCP | kube-controller-manager |

#### Worker 노드

| 포트 | 프로토콜 | 용도 |
|:-----|:---------|:-----|
| 10250 | TCP | Kubelet API |
| 10256 | TCP | kube-proxy |
| 30000-32767 | TCP | NodePort Services |

### 2.5 사전 설정 스크립트

```bash
#!/bin/bash
# 모든 노드에서 실행

# 1. 스왑 비활성화
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# 2. 고유 식별자 확인
echo "Hostname: $(hostname)"
echo "MAC Address: $(ip link | grep ether | awk '{print $2}' | head -1)"
echo "Product UUID: $(sudo cat /sys/class/dmi/id/product_uuid)"

# 3. 필수 커널 모듈 로드
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# 4. 커널 파라미터 설정
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

# 5. 설정 확인
lsmod | grep br_netfilter
lsmod | grep overlay
sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward
```

### 2.6 방화벽 설정

```bash
# Ubuntu/Debian (UFW)
# Control Plane
sudo ufw allow 6443/tcp
sudo ufw allow 2379:2380/tcp
sudo ufw allow 10250/tcp
sudo ufw allow 10259/tcp
sudo ufw allow 10257/tcp

# Worker
sudo ufw allow 10250/tcp
sudo ufw allow 10256/tcp
sudo ufw allow 30000:32767/tcp

# CentOS/RHEL (firewalld)
# Control Plane
sudo firewall-cmd --permanent --add-port=6443/tcp
sudo firewall-cmd --permanent --add-port=2379-2380/tcp
sudo firewall-cmd --permanent --add-port=10250/tcp
sudo firewall-cmd --permanent --add-port=10259/tcp
sudo firewall-cmd --permanent --add-port=10257/tcp
sudo firewall-cmd --reload
```

---

## 3. Container Runtime 설치

### 3.1 containerd 설치 (권장)

Kubernetes 1.24부터 dockershim이 제거되어 **containerd**가 권장됩니다.

#### Ubuntu/Debian

```bash
# 1. 패키지 업데이트
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 2. Docker GPG 키 추가
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Docker 저장소 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. containerd 설치
sudo apt-get update
sudo apt-get install -y containerd.io

# 5. containerd 설정
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# 6. SystemdCgroup 활성화
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

# 7. containerd 재시작
sudo systemctl restart containerd
sudo systemctl enable containerd

# 8. 상태 확인
sudo systemctl status containerd
```

#### CentOS/RHEL

```bash
# 1. yum-utils 설치
sudo yum install -y yum-utils

# 2. Docker 저장소 추가
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 3. containerd 설치
sudo yum install -y containerd.io

# 4. containerd 설정
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# 5. SystemdCgroup 활성화
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

# 6. containerd 재시작
sudo systemctl restart containerd
sudo systemctl enable containerd
```

### 3.2 containerd 설정 파일

```toml
# /etc/containerd/config.toml 주요 설정

[plugins."io.containerd.grpc.v1.cri"]
  sandbox_image = "registry.k8s.io/pause:3.9"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
  runtime_type = "io.containerd.runc.v2"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true   # 중요: cgroup v2 사용 시 필수
```

### 3.3 CRI 소켓 확인

```bash
# containerd 소켓 경로
ls -la /run/containerd/containerd.sock

# crictl 설정
cat <<EOF | sudo tee /etc/crictl.yaml
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
debug: false
EOF

# crictl 테스트
sudo crictl info
```

---

## 4. kubeadm, kubelet, kubectl 설치

### 4.1 Ubuntu/Debian

```bash
# 1. 패키지 업데이트 및 필수 패키지 설치
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gpg

# 2. Kubernetes GPG 키 추가
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# 3. Kubernetes 저장소 추가
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# 4. kubeadm, kubelet, kubectl 설치
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl

# 5. 버전 고정 (자동 업그레이드 방지)
sudo apt-mark hold kubelet kubeadm kubectl

# 6. kubelet 활성화
sudo systemctl enable --now kubelet
```

### 4.2 CentOS/RHEL

```bash
# 1. SELinux 설정 (permissive 모드)
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

# 2. Kubernetes 저장소 추가
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

# 3. kubeadm, kubelet, kubectl 설치
sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes

# 4. kubelet 활성화
sudo systemctl enable --now kubelet
```

### 4.3 설치 확인

```bash
# 버전 확인
kubeadm version
kubectl version --client
kubelet --version

# 출력 예시
# kubeadm version: &version.Info{Major:"1", Minor:"29", ...}
# Client Version: v1.29.0
# kubelet v1.29.0
```

---

## 5. Control Plane 초기화

### 5.1 kubeadm init 실행

```bash
# 기본 초기화
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# 특정 API Server 주소 지정
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.10

# HA 구성용 (Load Balancer 사용)
sudo kubeadm init \
  --control-plane-endpoint "LOAD_BALANCER_IP:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16
```

### 5.2 kubeadm init 주요 옵션

| 옵션 | 설명 | 예시 |
|:-----|:-----|:-----|
| `--pod-network-cidr` | Pod 네트워크 CIDR | 10.244.0.0/16 (Flannel) |
| `--apiserver-advertise-address` | API Server 광고 주소 | 192.168.1.10 |
| `--control-plane-endpoint` | HA용 LB 엔드포인트 | lb.example.com:6443 |
| `--upload-certs` | 인증서 업로드 (HA) | - |
| `--service-cidr` | Service CIDR | 10.96.0.0/12 (기본값) |
| `--kubernetes-version` | 특정 버전 지정 | v1.29.0 |
| `--cri-socket` | CRI 소켓 경로 | unix:///run/containerd/containerd.sock |

### 5.3 초기화 과정

```
kubeadm init 실행 시 수행되는 작업:

[preflight]        사전 검사 실행
[certs]            PKI 인증서 생성
                   ├── CA 인증서
                   ├── API Server 인증서
                   ├── etcd 인증서
                   └── kubelet 인증서
[kubeconfig]       kubeconfig 파일 생성
                   ├── admin.conf
                   ├── kubelet.conf
                   ├── controller-manager.conf
                   └── scheduler.conf
[kubelet-start]    kubelet 시작
[control-plane]    Static Pod 매니페스트 생성
                   ├── kube-apiserver
                   ├── kube-controller-manager
                   └── kube-scheduler
[etcd]             etcd Static Pod 생성
[upload-config]    ConfigMap에 설정 저장
[kubelet]          kubelet 설정 ConfigMap 저장
[upload-certs]     인증서 업로드 (--upload-certs)
[mark-control]     Control Plane 노드 taint 적용
[bootstrap-token]  bootstrap 토큰 생성
[addons]           CoreDNS, kube-proxy 설치
```

### 5.4 kubectl 설정

```bash
# 일반 사용자 설정
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 또는 환경 변수 설정
export KUBECONFIG=/etc/kubernetes/admin.conf

# root 사용자
echo "export KUBECONFIG=/etc/kubernetes/admin.conf" >> ~/.bashrc
source ~/.bashrc
```

### 5.5 초기화 결과 저장

```bash
# kubeadm init 출력 예시 (저장 필수!)

Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml"

Then you can join any number of worker nodes by running the following
on each as root:

kubeadm join 192.168.1.10:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:abc123...
```

{{< callout type="warning" >}}
**중요:** `kubeadm join` 명령어와 토큰을 안전하게 저장하세요. Worker 노드 추가 시 필요합니다.
{{< /callout >}}

---

## 6. CNI 플러그인 설치

### 6.1 CNI 플러그인 비교

| CNI | 특징 | Pod CIDR |
|:----|:-----|:---------|
| **Calico** | 고성능, Network Policy 지원 | 192.168.0.0/16 |
| **Flannel** | 간단, 경량 | 10.244.0.0/16 |
| **Weave** | 암호화 지원 | 10.32.0.0/12 |
| **Cilium** | eBPF 기반, 고급 기능 | 10.0.0.0/8 |

### 6.2 Calico 설치

```bash
# Calico 설치 (권장)
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml

# 또는 Tigera Operator 사용
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/tigera-operator.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/custom-resources.yaml
```

### 6.3 Flannel 설치

```bash
# Flannel 설치 (kubeadm init 시 --pod-network-cidr=10.244.0.0/16 필요)
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### 6.4 Weave 설치

```bash
# Weave Net 설치
kubectl apply -f https://github.com/weaveworks/weave/releases/download/v2.8.1/weave-daemonset-k8s.yaml
```

### 6.5 설치 확인

```bash
# CNI Pod 상태 확인
kubectl get pods -n kube-system

# 예상 출력
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-xxx                1/1     Running   0          2m
calico-node-xxx                            1/1     Running   0          2m
coredns-xxx                                1/1     Running   0          5m
coredns-xxx                                1/1     Running   0          5m
etcd-master                                1/1     Running   0          5m
kube-apiserver-master                      1/1     Running   0          5m
kube-controller-manager-master             1/1     Running   0          5m
kube-proxy-xxx                             1/1     Running   0          5m
kube-scheduler-master                      1/1     Running   0          5m

# 노드 상태 확인 (CNI 설치 후 Ready 상태)
kubectl get nodes
# NAME     STATUS   ROLES           AGE   VERSION
# master   Ready    control-plane   5m    v1.29.0
```

---

## 7. Worker 노드 조인

### 7.1 조인 명령어 실행

```bash
# Worker 노드에서 실행 (kubeadm init 출력에서 복사)
sudo kubeadm join 192.168.1.10:6443 \
  --token abcdef.0123456789abcdef \
  --discovery-token-ca-cert-hash sha256:abc123...
```

### 7.2 토큰 관리

```bash
# 토큰 목록 확인
kubeadm token list

# 새 토큰 생성
kubeadm token create

# 토큰과 함께 전체 join 명령어 생성
kubeadm token create --print-join-command

# 인증서 해시 확인
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \
  openssl rsa -pubin -outform der 2>/dev/null | \
  openssl dgst -sha256 -hex | sed 's/^.* //'
```

### 7.3 조인 확인

```bash
# Control Plane에서 실행
kubectl get nodes

# 예상 출력
NAME      STATUS   ROLES           AGE     VERSION
master    Ready    control-plane   10m     v1.29.0
worker1   Ready    <none>          2m      v1.29.0
worker2   Ready    <none>          1m      v1.29.0

# Worker 노드에 역할 라벨 추가 (선택)
kubectl label node worker1 node-role.kubernetes.io/worker=worker
kubectl label node worker2 node-role.kubernetes.io/worker=worker
```

---

## 8. 설치 검증

### 8.1 클러스터 상태 확인

```bash
# 클러스터 정보
kubectl cluster-info

# 노드 상태
kubectl get nodes -o wide

# 시스템 Pod 상태
kubectl get pods -n kube-system

# 컴포넌트 상태
kubectl get componentstatuses  # deprecated but still works

# API Server 상태
kubectl get --raw='/healthz'
kubectl get --raw='/readyz'
kubectl get --raw='/livez'
```

### 8.2 테스트 배포

```bash
# nginx 배포
kubectl create deployment nginx --image=nginx

# 배포 확인
kubectl get deployments
kubectl get pods -o wide

# 서비스 노출
kubectl expose deployment nginx --port=80 --type=NodePort

# 서비스 확인
kubectl get services

# 접근 테스트
curl http://<NodeIP>:<NodePort>

# 정리
kubectl delete deployment nginx
kubectl delete service nginx
```

### 8.3 DNS 테스트

```bash
# DNS 테스트용 Pod 생성
kubectl run dnsutils --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 --command -- sleep infinity

# DNS 조회 테스트
kubectl exec -it dnsutils -- nslookup kubernetes
kubectl exec -it dnsutils -- nslookup kubernetes.default.svc.cluster.local

# 정리
kubectl delete pod dnsutils
```

---

## 9. 트러블슈팅

### 9.1 일반적인 문제

| 증상 | 원인 | 해결 방법 |
|:-----|:-----|:---------|
| `kubeadm init` 실패 | 스왑 활성화 | `swapoff -a` |
| kubelet 시작 실패 | cgroup 드라이버 불일치 | containerd 설정 확인 |
| 노드 NotReady | CNI 미설치 | CNI 플러그인 설치 |
| Pod Pending | 리소스 부족 | 노드 리소스 확인 |
| coredns Pending | CNI 미설치 | CNI 플러그인 설치 |

### 9.2 로그 확인

```bash
# kubelet 로그
sudo journalctl -u kubelet -f

# 컨테이너 로그 (containerd)
sudo crictl logs <container-id>

# Pod 로그
kubectl logs -n kube-system <pod-name>

# Pod 이벤트
kubectl describe pod -n kube-system <pod-name>

# 전체 이벤트
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

### 9.3 kubeadm reset

```bash
# 클러스터 리셋 (모든 설정 제거)
sudo kubeadm reset

# 추가 정리
sudo rm -rf /etc/cni/net.d
sudo rm -rf $HOME/.kube/config

# iptables 정리
sudo iptables -F
sudo iptables -t nat -F
sudo iptables -t mangle -F
sudo iptables -X

# containerd 정리 (선택)
sudo crictl rm -af
sudo crictl rmi -a
```

### 9.4 인증서 문제

```bash
# 인증서 만료 확인
kubeadm certs check-expiration

# 인증서 갱신
sudo kubeadm certs renew all

# kubelet 재시작
sudo systemctl restart kubelet
```

---

## 10. 설치 스크립트 예시

### 10.1 전체 설치 스크립트 (Ubuntu)

```bash
#!/bin/bash
# install-k8s.sh - Ubuntu용 Kubernetes 설치 스크립트

set -e

echo "=== Kubernetes Installation Script ==="

# 1. 사전 설정
echo "[1/6] Pre-configuration..."
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

# 2. containerd 설치
echo "[2/6] Installing containerd..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y containerd.io

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd

# 3. kubeadm, kubelet, kubectl 설치
echo "[3/6] Installing kubeadm, kubelet, kubectl..."
sudo apt-get install -y apt-transport-https ca-certificates curl gpg

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

echo "[4/6] Installation complete!"
echo ""
echo "Next steps:"
echo "  - Control Plane: sudo kubeadm init --pod-network-cidr=10.244.0.0/16"
echo "  - Worker Node: sudo kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>"
```

---

## 11. 명령어 요약

```bash
# 사전 설정
sudo swapoff -a
sudo modprobe overlay br_netfilter

# containerd
sudo systemctl status containerd
sudo crictl info

# kubeadm
kubeadm version
kubeadm init --pod-network-cidr=10.244.0.0/16
kubeadm join <master>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
kubeadm token create --print-join-command
kubeadm reset

# kubectl 설정
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 검증
kubectl cluster-info
kubectl get nodes
kubectl get pods -n kube-system

# 트러블슈팅
sudo journalctl -u kubelet -f
kubectl get events --all-namespaces
kubeadm certs check-expiration
```

{{< callout type="info" >}}
**핵심 포인트:**
- 스왑 비활성화와 커널 모듈 설정 필수
- containerd의 SystemdCgroup 설정 확인
- CNI 플러그인 설치 전까지 노드는 NotReady 상태
- `kubeadm token create --print-join-command`로 join 명령어 재생성 가능
- 문제 발생 시 `kubeadm reset`으로 초기화 후 재시도
{{< /callout >}}
