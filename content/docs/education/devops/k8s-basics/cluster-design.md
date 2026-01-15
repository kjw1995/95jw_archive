---
title: "Cluster Design & HA"
weight: 9
---

Kubernetes 클러스터 설계, 인프라 선택, 고가용성(HA) 구성, etcd 클러스터링을 다룹니다.

---

## 1. 클러스터 설계 원칙

### 1.1 설계 전 핵심 질문

클러스터를 설계하기 전에 다음 질문에 답해야 합니다.

| 영역 | 질문 | 고려사항 |
|:-----|:-----|:---------|
| **목적** | 무엇을 위한 클러스터인가? | 학습/개발/테스트/프로덕션 |
| **인프라** | 어디에 구축할 것인가? | 클라우드/온프레미스/하이브리드 |
| **규모** | 얼마나 큰 클러스터가 필요한가? | 노드 수, Pod 수, 트래픽 양 |
| **가용성** | 얼마나 안정적이어야 하는가? | 다운타임 허용치, SLA 요구사항 |
| **예산** | 비용 제약이 있는가? | 인프라 비용, 운영 인력 |

### 1.2 목적별 클러스터 구성

#### 학습 환경

```
구성: 단일 노드
도구: Minikube, kind, k3s
리소스: 2 CPU, 4GB RAM
```

```bash
# Minikube로 학습 환경 구축
minikube start --cpus=2 --memory=4096

# kind로 로컬 클러스터 생성
kind create cluster --name learning

# k3s 단일 노드 설치
curl -sfL https://get.k3s.io | sh -
```

#### 개발/테스트 환경

```
구성: 1 Master + 2~3 Worker
도구: kubeadm, 관리형 서비스 (개발 티어)
리소스: Master 2 CPU/4GB, Worker 4 CPU/8GB
```

```yaml
# 개발 환경 노드 구성 예시
Master Node:
  - CPU: 2 cores
  - Memory: 4GB
  - Disk: 50GB SSD

Worker Nodes (x2):
  - CPU: 4 cores
  - Memory: 8GB
  - Disk: 100GB SSD
```

#### 프로덕션 환경

```
구성: 3+ Master (HA) + 3+ Worker + Load Balancer
도구: kubeadm, Kops, 관리형 서비스
특징: HA 필수, 모니터링, 백업 구성
```

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────────────────────────────┐                 │
│    │         Load Balancer (HA)           │                 │
│    │       HAProxy / nginx / Cloud LB     │                 │
│    └─────────────┬────────────────────────┘                 │
│                  │                                           │
│    ┌─────────────┼─────────────┬─────────────┐              │
│    ▼             ▼             ▼             │              │
│ ┌────────┐  ┌────────┐  ┌────────┐          │              │
│ │Master 1│  │Master 2│  │Master 3│   Control Plane         │
│ │ etcd   │  │ etcd   │  │ etcd   │          │              │
│ └────────┘  └────────┘  └────────┘          │              │
│    │             │             │             │              │
│    └─────────────┴─────────────┴─────────────┘              │
│                       │                                      │
│    ┌──────────────────┼──────────────────┐                  │
│    ▼                  ▼                  ▼                  │
│ ┌────────┐       ┌────────┐       ┌────────┐               │
│ │Worker 1│       │Worker 2│       │Worker 3│   Data Plane  │
│ │ Pods   │       │ Pods   │       │ Pods   │               │
│ └────────┘       └────────┘       └────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 클러스터 규모 제한

Kubernetes 클러스터의 최대 규모는 다음과 같습니다.

| 항목 | 최대값 | 권장값 |
|:-----|:-------|:-------|
| 노드 수 | 5,000개 | 1,000개 미만 |
| 전체 Pod | 150,000개 | 100,000개 미만 |
| 전체 컨테이너 | 300,000개 | - |
| 노드당 Pod | 100개 | 30~50개 |
| 네임스페이스당 Service | 5,000개 | - |

{{< callout type="info" >}}
**규모별 노드 사이징 가이드:**
- 1~5 노드: Small (2 CPU, 4GB)
- 6~100 노드: Medium (4 CPU, 16GB)
- 101~500 노드: Large (8 CPU, 32GB)
- 500+ 노드: Extra Large (16+ CPU, 64GB+)
{{< /callout >}}

---

## 2. 인프라 선택

### 2.1 배포 환경 분류

```
┌─────────────────────────────────────────────────────────────┐
│                    배포 환경 선택                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐        ┌─────────────────┐            │
│  │   로컬 환경      │        │   프로덕션 환경   │            │
│  │  (학습/개발)     │        │                  │            │
│  ├─────────────────┤        ├─────────────────┤            │
│  │ • Minikube      │        │ Turnkey         │            │
│  │ • kind          │        │ (자체 관리형)    │            │
│  │ • k3s           │        │ ─────────────── │            │
│  │ • kubeadm       │        │ • OpenShift     │            │
│  │ • Docker Desktop│        │ • Kops (AWS)    │            │
│  └─────────────────┘        │ • Rancher       │            │
│                             │ • VMware Tanzu  │            │
│                             ├─────────────────┤            │
│                             │ Managed         │            │
│                             │ (관리형 서비스)  │            │
│                             │ ─────────────── │            │
│                             │ • GKE (Google)  │            │
│                             │ • EKS (AWS)     │            │
│                             │ • AKS (Azure)   │            │
│                             │ • OKE (Oracle)  │            │
│                             └─────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Turnkey vs Managed 비교

| 항목 | Turnkey (자체 관리) | Managed (관리형) |
|:-----|:-------------------|:-----------------|
| **인프라 관리** | 직접 | 프로바이더 |
| **Control Plane 운영** | 직접 | 프로바이더 |
| **업그레이드** | 직접 | 자동/관리형 |
| **보안 패치** | 직접 | 프로바이더 |
| **비용** | 인프라만 | 인프라 + 관리비 |
| **유연성** | 높음 | 제한적 |
| **전문성 요구** | 높음 | 낮음 |

### 2.3 클라우드 프로바이더별 특징

| 프로바이더 | 서비스 | 장점 | 단점 |
|:-----------|:-------|:-----|:-----|
| **GCP** | GKE | 가장 성숙, 자동 업그레이드 | 비용 높음 |
| **AWS** | EKS | AWS 생태계 통합 | 복잡한 네트워킹 |
| **Azure** | AKS | AD 통합, 무료 Control Plane | 제한적인 리전 |
| **On-prem** | kubeadm | 완전한 제어 | 운영 부담 |

### 2.4 선택 가이드

```bash
# 의사결정 트리
if (학습 목적) {
    → Minikube, kind, k3s
} else if (소규모 팀 + 빠른 시작) {
    → 관리형 서비스 (GKE/EKS/AKS)
} else if (엔터프라이즈 + 보안 요구사항) {
    → OpenShift, Tanzu
} else if (비용 최적화 + 전문 팀 보유) {
    → kubeadm + 자체 운영
} else if (AWS 전용) {
    → Kops 또는 EKS
}
```

---

## 3. High Availability (HA) 구성

### 3.1 단일 장애점(SPOF) 문제

단일 Master 노드 구성의 위험성:

```
정상 상태:                    Master 장애 시:

┌─────────┐                  ┌─────────┐
│ Master  │                  │ Master  │
│ ───────►│                  │   ❌    │
│ • API   │                  │  DOWN   │
│ • etcd  │                  └─────────┘
│ • Sched │                       │
└────┬────┘                       │
     │                            ▼
┌────┴────┐               영향:
│         │               • kubectl 명령 불가
│ Workers │               • 새 Pod 생성 불가
│ (계속   │               • 스케일링 불가
│  동작)  │               • 자동 복구 불가
└─────────┘               • 기존 Pod는 동작 유지
```

### 3.2 Control Plane 컴포넌트별 HA 전략

| 컴포넌트 | HA 모드 | 이유 |
|:---------|:--------|:-----|
| **kube-apiserver** | Active-Active | 상태 없음, 모두 동시 활성 가능 |
| **kube-controller-manager** | Active-Standby | 중복 작업 방지 |
| **kube-scheduler** | Active-Standby | 중복 스케줄링 방지 |
| **etcd** | Active-Active | 분산 합의 알고리즘 |

### 3.3 API Server Load Balancing

```
                     ┌─────────────────────┐
   kubectl ─────────►│   Load Balancer     │
   외부 요청          │  (HAProxy/nginx)    │
                     └──────────┬──────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │ API Server │   │ API Server │   │ API Server │
       │   :6443    │   │   :6443    │   │   :6443    │
       │  Master 1  │   │  Master 2  │   │  Master 3  │
       └────────────┘   └────────────┘   └────────────┘
```

#### HAProxy 설정 예시

```bash
# /etc/haproxy/haproxy.cfg
frontend kubernetes-api
    bind *:6443
    mode tcp
    option tcplog
    default_backend kubernetes-api-backend

backend kubernetes-api-backend
    mode tcp
    option tcp-check
    balance roundrobin
    server master1 192.168.1.11:6443 check fall 3 rise 2
    server master2 192.168.1.12:6443 check fall 3 rise 2
    server master3 192.168.1.13:6443 check fall 3 rise 2
```

#### nginx 설정 예시

```nginx
# /etc/nginx/nginx.conf
stream {
    upstream kubernetes_api {
        least_conn;
        server 192.168.1.11:6443 max_fails=3 fail_timeout=30s;
        server 192.168.1.12:6443 max_fails=3 fail_timeout=30s;
        server 192.168.1.13:6443 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 6443;
        proxy_pass kubernetes_api;
        proxy_timeout 10m;
        proxy_connect_timeout 1s;
    }
}
```

### 3.4 Leader Election 메커니즘

Controller Manager와 Scheduler는 Leader Election을 통해 하나만 활성화됩니다.

```
┌──────────────────────────────────────────────────────────────┐
│                    Leader Election 과정                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  시간 ───────────────────────────────────────────────────►   │
│                                                               │
│  ┌─────────────────┐                                         │
│  │  Controller 1   │──┐                                      │
│  │  (시작)         │  │                                      │
│  └─────────────────┘  │    ┌──────────────┐                  │
│                       ├───►│ Lease 획득    │                  │
│  ┌─────────────────┐  │    │ (kube-system │                  │
│  │  Controller 2   │──┘    │  endpoint)   │                  │
│  │  (시작)         │       └──────┬───────┘                  │
│  └─────────────────┘              │                          │
│                                   ▼                          │
│                          Controller 1 → Leader (Active)      │
│                          Controller 2 → Follower (Standby)   │
│                                   │                          │
│                                   │ 10초마다 갱신            │
│                                   ▼                          │
│                          [ Leader 장애 발생 ]                 │
│                                   │                          │
│                                   │ 15초 후                  │
│                                   ▼                          │
│                          Controller 2 → 새 Leader            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Leader Election 설정

```yaml
# kube-controller-manager 설정
spec:
  containers:
  - command:
    - kube-controller-manager
    - --leader-elect=true              # 기본값: true
    - --leader-elect-lease-duration=15s  # Lease 유효 시간
    - --leader-elect-renew-deadline=10s  # 갱신 마감 시간
    - --leader-elect-retry-period=2s     # 재시도 주기
```

**동작 원리:**

1. 각 컨트롤러가 시작 시 Lease 획득 시도
2. 첫 번째 획득자가 Leader가 됨
3. Leader는 `renew-deadline` 내에 Lease 갱신 필요
4. 갱신 실패 시 `lease-duration` 후 다른 컨트롤러가 인수

### 3.5 etcd 토폴로지

#### Stacked (통합형)

```
┌─────────────────────────────────────────┐
│              Master Node                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │       Control Plane              │   │
│  │  ┌──────────┬──────────┐        │   │
│  │  │API Server│Scheduler │        │   │
│  │  └──────────┴──────────┘        │   │
│  │  ┌──────────────────────┐       │   │
│  │  │ Controller Manager   │       │   │
│  │  └──────────────────────┘       │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │           etcd                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

장점: 관리 간단, 노드 수 최소화
단점: 노드 장애 시 etcd도 함께 손실
용도: 소규모 클러스터, 비용 최적화
```

#### External (분리형)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Master 1   │  │  Master 2   │  │  Master 3   │
│ ──────────  │  │ ──────────  │  │ ──────────  │
│ API Server  │  │ API Server  │  │ API Server  │
│ Scheduler   │  │ Scheduler   │  │ Scheduler   │
│ Controller  │  │ Controller  │  │ Controller  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   etcd 1    │  │   etcd 2    │  │   etcd 3    │
└─────────────┘  └─────────────┘  └─────────────┘

장점: Control Plane 장애가 etcd에 영향 없음
단점: 노드 수 증가, 설정 복잡
용도: 대규모 클러스터, 높은 가용성 요구
```

#### API Server - etcd 연결 설정

```yaml
# kube-apiserver 설정
spec:
  containers:
  - command:
    - kube-apiserver
    - --etcd-servers=https://etcd1:2379,https://etcd2:2379,https://etcd3:2379
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key
```

---

## 4. etcd HA 구성

### 4.1 Raft 합의 알고리즘

etcd는 **Raft** 분산 합의 알고리즘을 사용합니다.

```
┌──────────────────────────────────────────────────────────────┐
│                      Raft 알고리즘 개요                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  노드 상태:                                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                   │
│  │ Leader  │    │Follower │    │Candidate│                   │
│  │ (리더)  │    │(팔로워) │    │ (후보)  │                   │
│  └─────────┘    └─────────┘    └─────────┘                   │
│      │               │               │                        │
│      │   정상 상태    │   투표 대기    │   선출 시도           │
│      │   Write 처리  │   복제 수신    │   투표 요청           │
│      ▼               ▼               ▼                        │
│                                                               │
│  상태 전이:                                                    │
│  Follower ──(timeout)──► Candidate ──(과반수)──► Leader      │
│      ▲                        │                   │           │
│      │                        │                   │           │
│      └───(새 Leader 발견)─────┘                   │           │
│      └────────────(heartbeat)─────────────────────┘           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Leader Election 과정

```
시간 ─────────────────────────────────────────────────────────►

Node 1   [─────Timer────]─► 투표 요청 ─► Leader 당선
Node 2   [───────Timer───────]           투표 (Node 1에게)
Node 3   [────────Timer────────]         투표 (Node 1에게)

         Random Timer 시작    가장 먼저 완료된
                              Node가 후보가 됨

Node 1 Leader 선출:
  • 과반수 투표 획득 (2/3)
  • 다른 노드에 heartbeat 전송 시작
  • 모든 Write 요청 처리
```

#### Write 처리 과정

```
┌──────────────────────────────────────────────────────────────┐
│                     Write 요청 처리 과정                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Client ───► Write 요청 (key=foo, value=bar)                 │
│                        │                                      │
│                        ▼                                      │
│                  ┌──────────┐                                │
│                  │  Leader  │                                │
│                  │ (Node 1) │                                │
│                  └────┬─────┘                                │
│                       │                                       │
│         ┌─────────────┼─────────────┐                        │
│         │             │             │                        │
│         ▼             ▼             ▼                        │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│    │Follower │  │Follower │  │Follower │                    │
│    │(Node 2) │  │(Node 3) │  │(Node 4) │                    │
│    │  ACK ✓  │  │  ACK ✓  │  │ (느림)  │                    │
│    └─────────┘  └─────────┘  └─────────┘                    │
│         │             │                                       │
│         └──────┬──────┘                                      │
│                │                                              │
│                ▼                                              │
│    과반수(3/5) ACK 수신 → Write 완료 → Client에 응답          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Quorum (쿼럼) 계산

**공식:** `Quorum = floor(N/2) + 1`

| 노드 수 (N) | Quorum | 허용 장애 | 권장 여부 |
|:------------|:-------|:----------|:----------|
| 1 | 1 | 0 | ❌ HA 불가 |
| 2 | 2 | 0 | ❌ 의미 없음 |
| **3** | **2** | **1** | ✅ 최소 HA |
| 4 | 3 | 1 | ❌ 3과 동일 |
| **5** | **3** | **2** | ✅ 권장 |
| 6 | 4 | 2 | ❌ 5와 동일 |
| **7** | **4** | **3** | ✅ 고가용성 |

### 4.3 홀수 노드가 권장되는 이유

**네트워크 분할 시나리오:**

```
짝수 노드 (6개) - 문제 발생:
┌─────────────────┐    │    ┌─────────────────┐
│   Network A     │    │    │   Network B     │
│  ┌───┐ ┌───┐   │   분할   │   ┌───┐ ┌───┐  │
│  │ 1 │ │ 2 │   │    │    │   │ 4 │ │ 5 │  │
│  └───┘ └───┘   │    │    │   └───┘ └───┘  │
│     ┌───┐      │    │    │      ┌───┐     │
│     │ 3 │      │    │    │      │ 6 │     │
│     └───┘      │    │    │      └───┘     │
│  (3노드)       │    │    │   (3노드)      │
│  Quorum=4 불충족│    │    │  Quorum=4 불충족│
└─────────────────┘    │    └─────────────────┘
         ↓                          ↓
    클러스터 실패!              클러스터 실패!


홀수 노드 (5개) - 생존 가능:
┌─────────────────┐    │    ┌─────────────────┐
│   Network A     │    │    │   Network B     │
│  ┌───┐ ┌───┐   │   분할   │   ┌───┐ ┌───┐  │
│  │ 1 │ │ 2 │   │    │    │   │ 4 │ │ 5 │  │
│  └───┘ └───┘   │    │    │   └───┘ └───┘  │
│     ┌───┐      │    │    │                 │
│     │ 3 │      │    │    │                 │
│     └───┘      │    │    │                 │
│  (3노드)       │    │    │   (2노드)       │
│  Quorum=3 충족 ✓│    │    │  Quorum=3 불충족│
└─────────────────┘    │    └─────────────────┘
         ↓                          ↓
    클러스터 유지!              읽기 전용 모드
```

### 4.4 etcd 클러스터 설정

#### 초기 클러스터 구성

```bash
# Node 1
etcd --name etcd1 \
  --initial-advertise-peer-urls https://192.168.1.11:2380 \
  --listen-peer-urls https://192.168.1.11:2380 \
  --listen-client-urls https://192.168.1.11:2379,https://127.0.0.1:2379 \
  --advertise-client-urls https://192.168.1.11:2379 \
  --initial-cluster-token etcd-cluster-1 \
  --initial-cluster etcd1=https://192.168.1.11:2380,etcd2=https://192.168.1.12:2380,etcd3=https://192.168.1.13:2380 \
  --initial-cluster-state new \
  --data-dir=/var/lib/etcd
```

#### etcdctl 명령어

```bash
# API v3 설정
export ETCDCTL_API=3

# 클러스터 상태 확인
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# 멤버 목록
etcdctl member list --write-out=table

# 키-값 저장/조회
etcdctl put name "kubernetes"
etcdctl get name
etcdctl get / --prefix --keys-only

# 클러스터 리더 확인
etcdctl endpoint status --write-out=table
```

---

## 5. kubeadm HA 클러스터 구성

### 5.1 사전 요구사항

```bash
# 모든 노드에서 실행
# 1. 스왑 비활성화
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# 2. 필수 모듈 로드
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# 3. 커널 파라미터 설정
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

### 5.2 첫 번째 Control Plane 노드 초기화

```bash
# Load Balancer 주소로 초기화
sudo kubeadm init \
  --control-plane-endpoint "LOAD_BALANCER_IP:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16

# 출력 예시:
# kubeadm join LOAD_BALANCER_IP:6443 --token <token> \
#   --discovery-token-ca-cert-hash sha256:<hash> \
#   --control-plane --certificate-key <cert-key>
```

### 5.3 추가 Control Plane 노드 조인

```bash
# 다른 Master 노드에서 실행
sudo kubeadm join LOAD_BALANCER_IP:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane \
  --certificate-key <cert-key>
```

### 5.4 Worker 노드 조인

```bash
# Worker 노드에서 실행
sudo kubeadm join LOAD_BALANCER_IP:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

### 5.5 CNI 설치

```bash
# Calico 설치 예시
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Flannel 설치 예시
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

---

## 6. 프로덕션 체크리스트

### 6.1 필수 구성

| 항목 | 최소 요구사항 | 권장 사항 |
|:-----|:-------------|:----------|
| **Control Plane** | 3 노드 | 3 노드 (홀수) |
| **etcd** | 3 노드 | 5 노드 |
| **Worker** | 2 노드 | 3+ 노드 |
| **Load Balancer** | 1 대 | 2 대 (HA) |

### 6.2 보안 체크리스트

```bash
# 인증서 만료 확인
kubeadm certs check-expiration

# RBAC 활성화 확인
kubectl api-versions | grep rbac

# Network Policy 지원 확인
kubectl get networkpolicies --all-namespaces

# Secret 암호화 확인
kubectl get secrets -o yaml | grep -i encryption
```

### 6.3 모니터링 구성

```yaml
# 필수 모니터링 대상
Control Plane:
  - API Server 응답 시간
  - etcd 지연 시간
  - Scheduler 큐 깊이
  - Controller 워크 큐

Worker Node:
  - CPU/메모리 사용률
  - 디스크 I/O
  - 네트워크 대역폭
  - Pod 상태

etcd:
  - 리더 변경 횟수
  - Raft 제안 실패율
  - 디스크 fsync 지연
  - DB 크기
```

---

## 7. 트러블슈팅

### 7.1 일반적인 HA 문제

| 증상 | 원인 | 해결 방법 |
|:-----|:-----|:---------|
| API Server 접근 불가 | Load Balancer 장애 | LB 상태 확인, 백업 LB 전환 |
| etcd 쓰기 실패 | 쿼럼 손실 | 노드 복구 또는 재구성 |
| Leader 빈번한 변경 | 네트워크 불안정 | 네트워크 점검, 타임아웃 조정 |
| 스케줄링 지연 | Scheduler 장애 | Leader Election 확인 |

### 7.2 etcd 트러블슈팅

```bash
# etcd 클러스터 상태 확인
etcdctl endpoint health --cluster

# 멤버 목록 및 리더 확인
etcdctl member list -w table
etcdctl endpoint status -w table

# 알람 확인 (디스크 부족 등)
etcdctl alarm list

# 성능 확인
etcdctl check perf

# 디버그 로그
journalctl -u etcd -f
```

### 7.3 Control Plane 복구

```bash
# API Server 상태 확인
kubectl get componentstatuses

# 컴포넌트 로그 확인
kubectl logs -n kube-system kube-apiserver-master1
kubectl logs -n kube-system kube-controller-manager-master1
kubectl logs -n kube-system kube-scheduler-master1

# kubelet 상태 확인
systemctl status kubelet
journalctl -u kubelet -f
```

---

## 8. 명령어 요약

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide
kubectl get componentstatuses

# HA 상태 확인
kubectl get endpoints -n kube-system kube-controller-manager -o yaml
kubectl get endpoints -n kube-system kube-scheduler -o yaml

# etcd 상태
etcdctl endpoint health --cluster
etcdctl member list
etcdctl endpoint status -w table

# kubeadm HA 구성
kubeadm init --control-plane-endpoint "LB_IP:6443" --upload-certs
kubeadm join LB_IP:6443 --control-plane --certificate-key <key>
kubeadm join LB_IP:6443 --token <token>

# 인증서 관리
kubeadm certs check-expiration
kubeadm certs renew all
```

---

## 9. 설계 결정 가이드

```
┌──────────────────────────────────────────────────────────────┐
│                    클러스터 설계 의사결정                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Q1. 목적이 무엇인가?                                         │
│      └─ 학습 → 단일 노드 (Minikube, kind)                    │
│      └─ 개발 → 단일 Master + 2 Worker                        │
│      └─ 프로덕션 → HA 구성 (3 Master)                        │
│                                                               │
│  Q2. 운영 역량이 있는가?                                      │
│      └─ 예 → Turnkey (kubeadm, Kops)                         │
│      └─ 아니오 → Managed (GKE, EKS, AKS)                     │
│                                                               │
│  Q3. etcd를 분리할 필요가 있는가?                             │
│      └─ 소규모 → Stacked (통합형)                            │
│      └─ 대규모/고가용성 → External (분리형)                  │
│                                                               │
│  Q4. 예산 제약이 있는가?                                      │
│      └─ 있음 → 3노드 etcd                                    │
│      └─ 없음 → 5노드 etcd (권장)                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

{{< callout type="info" >}}
**핵심 포인트:**
- 프로덕션에서는 반드시 HA 구성 (최소 3 Control Plane 노드)
- etcd 노드는 홀수 개 유지 (3 또는 5)
- API Server는 Load Balancer로 분산
- Controller/Scheduler는 Leader Election으로 단일 활성화
- 정기적인 백업과 복구 테스트 필수
{{< /callout >}}
