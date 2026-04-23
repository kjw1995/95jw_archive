---
title: "01. 입문"
weight: 1
---

## 1. 쿠버네티스란

**쿠버네티스(Kubernetes, K8s)** 는 다수의 컨테이너를 여러 서버에 걸쳐 자동으로 배포·확장·복구하는 **컨테이너 오케스트레이션 플랫폼**이다. 구글이 내부에서 운영하던 Borg 시스템을 기반으로 2014년에 공개했고, 현재 CNCF(Cloud Native Computing Foundation)가 관리한다.

컨테이너 하나를 띄우는 일은 Docker만으로도 충분하지만, 수십에서 수천 개의 컨테이너를 운영하려면 다음 문제가 생긴다.

- 어떤 서버에 어떤 컨테이너를 배치할 것인가 (스케줄링)
- 컨테이너가 죽으면 누가 다시 띄우는가 (자기 치유)
- 트래픽이 몰리면 어떻게 늘리는가 (스케일링)
- 배포 중에 서비스가 멈추지 않게 하려면 (무중단 배포)

쿠버네티스는 이 모든 것을 **선언적(declarative)** 으로 해결한다. 원하는 상태를 YAML로 기술하면, 컨트롤 플레인이 현재 상태를 그 방향으로 수렴시킨다.

## 2. IT 인프라의 진화

```text
메인프레임 → VM → 클라우드 → 컨테이너
```

| 시대 | 특징 | 확장 방식 |
|:---|:---|:---|
| 2000년대 | x86 가상화 (VMware) | 스케일 업/아웃 |
| 2010년대 | 퍼블릭 클라우드 | IaaS/PaaS/SaaS |
| 현재 | 컨테이너 오케스트레이션 | 쿠버네티스 |

### 클라우드 서비스 모델

```text
┌──────────────────────────┐
│  SaaS (Gmail, Notion)    │
├──────────────────────────┤
│  PaaS (Heroku, GAE)      │
├──────────────────────────┤
│  IaaS (EC2, GCE)         │
└──────────────────────────┘
  위로 갈수록 관리 범위 ↓
  아래로 갈수록 자유도 ↑
```

{{< callout type="info" >}}
쿠버네티스는 IaaS 위에 올라가는 **PaaS 성격의 플랫폼**에 가깝다. EKS, GKE, AKS 같은 관리형 서비스를 쓰면 마스터 노드를 클라우드가 운영해 주므로 사용자는 워크로드에만 집중할 수 있다.
{{< /callout >}}

## 3. 컨테이너 vs 가상머신

### 아키텍처 비교

```text
[ 가상머신 ]          [ 컨테이너 ]
┌────┐ ┌────┐         ┌────┐ ┌────┐
│App │ │App │         │App │ │App │
├────┤ ├────┤         ├────┴─┴────┤
│ OS │ │ OS │         │  Runtime  │
├────┴─┴────┤         ├───────────┤
│Hypervisor │         │  Host OS  │
├───────────┤         ├───────────┤
│  Host OS  │         │ Hardware  │
├───────────┤         └───────────┘
│ Hardware  │
└───────────┘
```

VM은 **하드웨어를 가상화**해 각자 게스트 OS를 갖는다. 컨테이너는 **호스트 커널을 공유**하고 프로세스를 네임스페이스와 cgroup으로 격리한다.

| 구분 | 가상머신 | 컨테이너 |
|:---|:---|:---|
| 가상화 수준 | 하드웨어 | 운영체제 |
| 크기 | GB 단위 | MB 단위 |
| 부팅 시간 | 분 단위 | 초 단위 |
| 커널 | 개별 커널 | 호스트 커널 공유 |
| 격리 수준 | 강함 | 상대적으로 약함 |
| 밀도 | 서버당 수십 개 | 서버당 수백 개 |

{{< callout type="warning" >}}
컨테이너는 커널을 공유하기 때문에 **커널 취약점이 그대로 노출**될 수 있다. 멀티테넌트 환경이라면 gVisor, Kata Containers 같은 샌드박스 런타임이나 별도 노드 그룹을 고려한다.
{{< /callout >}}

## 4. 컨테이너 런타임의 진화

초창기 Docker는 빌드부터 실행까지 모두 담당하는 **모놀리식 런타임**이었지만, 점차 표준화되면서 역할이 분리됐다.

| 세대 | 런타임 | 특징 |
|:---|:---|:---|
| 1세대 | Docker Engine | 빌드·실행·네트워크 통합 |
| 2세대 | containerd, CRI-O | OCI 표준 준수, 경량 |
| 저수준 | runc, crun | 실제 컨테이너 프로세스 생성 |

```text
kubelet
  │ CRI (gRPC)
  ▼
containerd / CRI-O
  │ OCI
  ▼
runc / crun
  │ namespaces, cgroups
  ▼
컨테이너 프로세스
```

쿠버네티스는 1.24부터 Docker Shim을 제거하고 **CRI(Container Runtime Interface)** 를 구현한 런타임만 지원한다. 대부분의 클러스터는 containerd를 기본으로 사용한다.

## 5. 컨테이너 / 도커 / 쿠버네티스 관계

```text
┌──────────────────────────────┐
│   Kubernetes (오케스트레이션)  │
│ ┌──────────────────────────┐ │
│ │ containerd (런타임)       │ │
│ │ ┌─────┐ ┌─────┐ ┌─────┐  │ │
│ │ │Cont │ │Cont │ │Cont │  │ │
│ │ └─────┘ └─────┘ └─────┘  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- **컨테이너**: 애플리케이션 + 실행 환경을 패키징한 단위
- **Docker / containerd**: 컨테이너 이미지를 실행하는 런타임
- **Kubernetes**: 여러 노드에 분산된 컨테이너를 관리

## 6. 왜 쿠버네티스가 승리했나

2015년 전후에는 Docker Swarm, Apache Mesos, Nomad 등 오케스트레이터가 경쟁했다. 쿠버네티스가 사실상 표준이 된 이유는 다음과 같다.

| 요인 | 설명 |
|:---|:---|
| 구글의 실전 경험 | Borg를 10년 이상 운영한 노하우 반영 |
| 선언적 API | YAML로 원하는 상태 기술, 자동 수렴 |
| 확장성 | CRD, Operator로 도메인 리소스 추가 |
| 벤더 중립 | CNCF 기증으로 락인 해소 |
| 풍부한 생태계 | Helm, Istio, Prometheus 등 통합 |

{{< callout type="tip" >}}
쿠버네티스의 핵심은 **컨트롤 루프(reconciliation loop)** 다. 컨트롤러가 "desired state"와 "current state"를 지속적으로 비교해 차이를 줄인다. 이 모델 덕분에 장애·지연이 있어도 결국 원하는 상태로 수렴한다.
{{< /callout >}}

## 7. 클러스터 구조

```text
┌──────── Kubernetes Cluster ────────┐
│                                    │
│ ┌────────────┐  ┌────────────┐    │
│ │ Control    │  │ Worker     │    │
│ │  Plane     │──│  Node      │    │
│ │            │  │ ┌────────┐ │    │
│ │ API Server │  │ │  Pod   │ │    │
│ │ Scheduler  │  │ │┌──────┐│ │    │
│ │ Controller │  │ ││Cont. ││ │    │
│ │ etcd       │  │ │└──────┘│ │    │
│ └────────────┘  │ └────────┘ │    │
│                 │ kubelet    │    │
│                 │ kube-proxy │    │
│                 └────────────┘    │
└────────────────────────────────────┘
```

### 컨트롤 플레인 구성요소

| 구성요소 | 역할 |
|:---|:---|
| kube-apiserver | 모든 요청의 진입점, REST API |
| etcd | 클러스터 상태 저장소 (KV) |
| kube-scheduler | Pod를 어느 노드에 배치할지 결정 |
| kube-controller-manager | 리소스 상태를 감시·조정 |
| cloud-controller-manager | 클라우드 프로바이더 연동 |

### 워커 노드 구성요소

| 구성요소 | 역할 |
|:---|:---|
| kubelet | API 서버 지시에 따라 컨테이너 관리 |
| kube-proxy | Service 가상 IP → Pod 라우팅 |
| container runtime | 실제 컨테이너 실행 (containerd 등) |

## 8. 핵심 오브젝트

| 오브젝트 | 설명 | 비유 |
|:---|:---|:---|
| **Pod** | 1개 이상의 컨테이너 묶음, 최소 배포 단위 | 공간을 공유하는 프로세스 그룹 |
| **ReplicaSet** | 지정한 수의 Pod 복제본 유지 | 개수 감시자 |
| **Deployment** | ReplicaSet 위의 선언적 배포 관리 | 버전 관리자 |
| **Service** | Pod 집합을 위한 네트워크 엔드포인트 | 로드밸런서 |
| **Ingress** | HTTP 트래픽 라우팅 규칙 | 리버스 프록시 |
| **ConfigMap / Secret** | 설정·민감 정보 주입 | 환경변수 저장소 |
| **Volume / PVC** | 영속 스토리지 | 디스크 마운트 |
| **Namespace** | 클러스터 내 논리적 분리 | 폴더 |

### Pod YAML 예제

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

## 9. 주요 기능

### 무중단 배포 (Rolling Update)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 추가 생성
      maxUnavailable: 0  # 최소 가용 유지
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
        image: nginx:1.25
```

```bash
# 이미지 교체 (무중단)
kubectl set image deployment/nginx-deployment \
  nginx=nginx:1.26

# 롤백
kubectl rollout undo deployment/nginx-deployment
```

### 오토스케일링 (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

### 자기 치유 (Self-Healing)

노드가 죽거나 Pod가 종료되면 컨트롤러가 자동으로 재생성한다. `livenessProbe`와 `readinessProbe`로 건강 상태를 정의할 수 있다.

```yaml
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    livenessProbe:
      httpGet:
        path: /healthz
        port: 80
      initialDelaySeconds: 10
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 80
      periodSeconds: 5
```

## 10. 자주 쓰는 kubectl

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide

# 리소스 조회
kubectl get pods -A
kubectl get svc,deploy,ing

# 상세 정보와 이벤트
kubectl describe pod nginx-pod
kubectl logs -f nginx-pod
kubectl logs --previous nginx-pod   # 이전 컨테이너 로그

# 생성 / 적용 / 삭제
kubectl apply -f nginx-pod.yaml
kubectl delete -f nginx-pod.yaml

# 디버깅
kubectl exec -it nginx-pod -- sh
kubectl port-forward pod/nginx-pod 8080:80

# 네임스페이스
kubectl get ns
kubectl create ns dev
kubectl config set-context --current --namespace=dev
```

{{< callout type="tip" >}}
실무에서는 `kubectl`을 매번 치기 번거로워 **alias**와 **kubectx/kubens**를 많이 쓴다. `alias k=kubectl`, `k9s` TUI, `stern` 멀티 로그 등도 필수 도구다.
{{< /callout >}}

## 11. 핵심 용어

| 용어 | 설명 |
|:---|:---|
| 오케스트레이션 | 다수 컨테이너의 배포·확장·복구 자동화 |
| 컨테이너 런타임 | 컨테이너를 실행하는 환경 (containerd, CRI-O) |
| CRI / OCI | 런타임 표준 인터페이스 / 이미지·실행 명세 |
| 선언적 API | 원하는 상태를 기술, 시스템이 수렴 |
| 컨트롤 루프 | desired와 current를 지속 비교·조정 |
| 스케일 아웃 | 서버 대수를 늘려 처리량 확대 |
| 스케일 업 | 단일 서버 성능 향상 |
| 하이퍼바이저 | 하드웨어를 가상화해 VM 실행 |
| 락인 (Lock-in) | 특정 벤더 종속 현상 |

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Kubernetes | 컨테이너 오케스트레이션 표준 플랫폼 |
| Pod | 최소 배포 단위, 1개 이상 컨테이너 |
| Deployment | 선언적 배포, ReplicaSet 관리 |
| Service | Pod 네트워크 추상화 |
| 컨트롤 플레인 | API·스케줄러·컨트롤러·etcd |
| 워커 노드 | kubelet·kube-proxy·런타임 |
| 자기 치유 | 프로브 기반 자동 재시작 |
| 선언적 모델 | YAML로 원하는 상태 기술 |

## 다음 단계

- 쿠버네티스 설치 (Minikube, kind, Docker Desktop)
- Docker 기초와 이미지 빌드
- YAML 문법과 Kustomize / Helm
