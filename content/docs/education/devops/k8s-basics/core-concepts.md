---
title: "CKA Core Concepts"
weight: 1
---

Kubernetes Core Concepts

---

## 1. 클러스터 아키텍처

### 1.1 기본 구조

Kubernetes 클러스터는 **Master Node(Control Plane)**와 **Worker Node**로 구성됩니다.

```
┌─────────────────────────────────────┐
│         Master Node                 │
├─────────────────────────────────────┤
│ • etcd (클러스터 상태 저장소)         │
│ • kube-apiserver (API 게이트웨이)    │
│ • kube-scheduler (파드 배치)         │
│ • kube-controller-manager (컨트롤러) │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         Worker Node                 │
├─────────────────────────────────────┤
│ • kubelet (노드 에이전트)            │
│ • kube-proxy (네트워크 프록시)       │
│ • Container Runtime (containerd 등) │
└─────────────────────────────────────┘
```

### 1.2 etcd

**분산 키-값 저장소**로 클러스터의 모든 상태 정보를 저장합니다.

```
저장 데이터:
├── Nodes (노드 정보)
├── Pods (파드 상태)
├── ConfigMaps (설정 정보)
├── Secrets (비밀 정보)
├── Deployments, ReplicaSets...
└── 모든 Kubernetes 리소스
```

**주요 명령어:**

```bash
# etcdctl 버전 확인
etcdctl version

# 키-값 저장/조회 (API v3)
ETCDCTL_API=3 etcdctl put key1 value1
ETCDCTL_API=3 etcdctl get key1

# 모든 키 조회
etcdctl get / --prefix --keys-only
```

{{< callout type="info" >}}
**중요:** etcd에 업데이트가 완료되어야만 클러스터 변경이 완료된 것으로 간주됩니다.
{{< /callout >}}

### 1.3 kube-apiserver

**클러스터의 중앙 관리 컴포넌트**로 모든 요청의 게이트웨이 역할을 합니다.

**주요 기능:**
- 인증(Authentication) 및 검증(Validation)
- etcd와 **유일하게** 직접 통신
- 다른 컴포넌트들과의 통신 중개

**파드 생성 워크플로우:**

```
1. 사용자 요청 (kubectl create pod)
2. kube-apiserver: 인증 및 검증
3. 파드 객체 생성 (노드 미할당)
4. etcd에 정보 저장
5. Scheduler가 적절한 노드 선택
6. kube-apiserver → kubelet에 지시
7. kubelet이 컨테이너 실행
8. 상태를 etcd에 업데이트
```

### 1.4 kube-controller-manager

**여러 컨트롤러들을 단일 프로세스로 실행**합니다.

| 컨트롤러 | 역할 |
|:---------|:-----|
| Node Controller | 노드 상태 모니터링, 장애 처리 |
| Replication Controller | 파드 수 유지 |
| Deployment Controller | 배포 전략 관리 |
| Service Controller | 서비스 엔드포인트 관리 |
| Namespace Controller | 네임스페이스 생명주기 |

**Node Controller 설정:**

```bash
--node-monitor-period=5s      # 노드 상태 체크 주기
--node-monitor-grace-period=40s  # Unreachable 판정 대기
--pod-eviction-timeout=5m     # 파드 제거 대기 시간
```

### 1.5 kube-scheduler

**파드를 어느 노드에 배치할지 결정**합니다 (실제 배치는 kubelet이 수행).

**2단계 스케줄링:**

```
1단계: 필터링 (Filtering)
- 리소스 부족 노드 제외
- Taints/Tolerations 체크
- NodeSelector 확인

2단계: 순위 매기기 (Ranking)
- 리소스 활용도 점수
- 부하 분산 점수
- Affinity 규칙 점수
→ 최고 점수 노드 선택
```

### 1.6 kubelet

**각 Worker Node의 에이전트**로 파드 생명주기를 관리합니다.

**주요 기능:**
- 노드를 클러스터에 등록
- 파드 생성/삭제 수행
- 컨테이너 런타임과 통신
- 상태를 API Server에 보고

{{< callout type="warning" >}}
**중요:** kubelet은 kubeadm으로도 자동 설치되지 않습니다. 각 Worker Node에 수동 설치가 필요합니다.
{{< /callout >}}

### 1.7 kube-proxy

**Service를 실제로 구현하는 컴포넌트**입니다.

```
역할:
- 각 노드에서 실행
- 새로운 Service 감지
- iptables/IPVS 규칙 생성
- 서비스 IP → 파드 IP 트래픽 포워딩
```

**구현 모드:**

| 모드 | 특징 |
|:-----|:-----|
| iptables | 기본값, 커널 수준 처리 |
| IPVS | 고성능, 다양한 로드밸런싱 알고리즘 |
| userspace | 레거시, 비권장 |

---

## 2. 컨테이너 런타임

### 2.1 Docker vs ContainerD

**Kubernetes 1.24부터 dockershim이 제거**되어 Docker 런타임 직접 지원이 중단되었습니다.

```
Docker 구성요소:
├── Docker CLI
├── Docker API
├── Build Tools
├── runC (실제 런타임)
└── ContainerD (runC 관리)
```

**CLI 도구 비교:**

| 도구 | 용도 | 권장 사용 |
|:-----|:-----|:---------|
| ctr | ContainerD 디버깅 | 사용 비권장 |
| nerdctl | 범용 컨테이너 관리 | Docker CLI 대체 |
| crictl | K8s 환경 디버깅 | CRI 런타임 디버깅 |

**명령어 비교:**

```bash
# Docker → nerdctl
docker run nginx     → nerdctl run nginx
docker ps           → nerdctl ps

# Docker → crictl (K8s 환경)
docker ps           → crictl ps
docker logs <id>    → crictl logs <id>
crictl pods         # 파드 목록 (Docker에 없음)
```

---

## 3. 워크로드

### 3.1 Pod

**Kubernetes의 최소 배포 단위**로 하나 이상의 컨테이너를 포함합니다.

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
    image: nginx:1.20
    ports:
    - containerPort: 80
```

**멀티 컨테이너 파드:**

```yaml
spec:
  containers:
  - name: web-server
    image: nginx
  - name: log-processor
    image: busybox
    command: ['sh', '-c', 'while true; do echo processing; sleep 30; done']
```

{{< callout type="info" >}}
**멀티 컨테이너 특징:**
- 같은 네트워크 공유 (localhost 통신)
- 볼륨 공유 가능
- 함께 생성/삭제
{{< /callout >}}

**기본 명령어:**

```bash
# 파드 생성
kubectl run nginx --image=nginx
kubectl apply -f pod.yaml

# 파드 조회
kubectl get pods
kubectl get pods -o wide
kubectl describe pod nginx

# 파드 로그
kubectl logs nginx
kubectl logs nginx -c container-name  # 멀티 컨테이너

# 파드 접속
kubectl exec -it nginx -- /bin/bash

# 파드 삭제
kubectl delete pod nginx
```

### 3.2 ReplicaSet

**지정된 수의 파드 복제본을 유지**합니다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: nginx-rs
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
        image: nginx
```

**주요 특징:**
- 파드 장애 시 자동 복구
- 라벨 기반 파드 선택 (selector 필수)
- 스케일링 지원

**스케일링:**

```bash
# 파일 수정 후 적용
kubectl replace -f replicaset.yaml

# 명령어로 스케일링
kubectl scale --replicas=6 replicaset nginx-rs
```

### 3.3 Deployment

**ReplicaSet의 상위 객체**로 롤링 업데이트와 롤백을 지원합니다.

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
      maxSurge: 1
      maxUnavailable: 1
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
        image: nginx:1.20
```

**계층 구조:**

```
Deployment
    └─→ ReplicaSet (자동 생성)
            └─→ Pods (자동 생성)
```

**롤링 업데이트 명령어:**

```bash
# 이미지 업데이트
kubectl set image deployment/nginx nginx=nginx:1.21

# 배포 상태 확인
kubectl rollout status deployment/nginx

# 배포 히스토리
kubectl rollout history deployment/nginx

# 롤백
kubectl rollout undo deployment/nginx
kubectl rollout undo deployment/nginx --to-revision=2

# 일시정지/재개
kubectl rollout pause deployment/nginx
kubectl rollout resume deployment/nginx
```

---

## 4. 서비스

### 4.1 Service 개념

**파드에 대한 안정적인 네트워크 엔드포인트를 제공**합니다.

**필요한 이유:**
- 파드 IP는 동적으로 변경됨
- 여러 파드에 대한 로드밸런싱 필요
- 서비스 디스커버리 제공

### 4.2 Service 유형

| 유형 | 용도 | 접근 범위 |
|:-----|:-----|:---------|
| ClusterIP | 클러스터 내부 통신 | 클러스터 내부 |
| NodePort | 외부 노출 (개발용) | 노드 IP:포트 |
| LoadBalancer | 외부 노출 (프로덕션) | 클라우드 LB |

### 4.3 NodePort Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-nodeport
spec:
  type: NodePort
  selector:
    app: nginx
  ports:
  - port: 80         # Service 포트
    targetPort: 80   # Pod 포트
    nodePort: 30080  # Node 포트 (30000-32767)
```

**포트 구조:**

```
[External] → [Node:30080] → [Service:80] → [Pod:80]
```

### 4.4 ClusterIP Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: ClusterIP  # 기본값 (생략 가능)
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 8080
```

**내부 접근:**

```bash
# 같은 네임스페이스
curl http://backend-service:80

# 다른 네임스페이스
curl http://backend-service.other-ns.svc.cluster.local:80
```

### 4.5 LoadBalancer Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-lb
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
```

{{< callout type="warning" >}}
**클라우드 환경에서만 동작:** 온프레미스에서는 EXTERNAL-IP가 `<pending>` 상태로 유지됩니다.
{{< /callout >}}

---

## 5. 네임스페이스

### 5.1 기본 네임스페이스

| Namespace | 용도 |
|:----------|:-----|
| default | 사용자 기본 작업 공간 |
| kube-system | Kubernetes 시스템 컴포넌트 |
| kube-public | 모든 사용자 접근 가능 |

### 5.2 네임스페이스 관리

```bash
# 네임스페이스 생성
kubectl create namespace dev

# 특정 네임스페이스의 리소스 조회
kubectl get pods -n kube-system

# 모든 네임스페이스 조회
kubectl get pods -A
kubectl get pods --all-namespaces

# 기본 네임스페이스 변경
kubectl config set-context --current --namespace=dev
```

### 5.3 YAML에서 네임스페이스 지정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: dev  # 네임스페이스 지정
spec:
  containers:
  - name: nginx
    image: nginx
```

### 5.4 ResourceQuota

**네임스페이스별 리소스 제한:**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 5Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

---

## 6. Imperative vs Declarative

### 6.1 Imperative (명령형)

**"어떻게(How)"를 단계별로 지시:**

```bash
# 직접 명령어로 생성
kubectl run nginx --image=nginx
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80
kubectl scale deployment nginx --replicas=3
kubectl set image deployment/nginx nginx=nginx:1.21
```

**장점:** 빠른 작업, 시험에서 시간 절약
**단점:** 히스토리 없음, 협업 어려움

### 6.2 Declarative (선언형)

**"무엇을(What)"만 선언:**

```bash
# YAML 파일로 관리
kubectl apply -f nginx-deployment.yaml

# 디렉토리 전체 적용
kubectl apply -f ./configs/
```

**장점:** Git 버전 관리, 협업 용이, 자동 변경 감지
**권장:** 프로덕션 환경에서는 선언형 사용

### 6.3 kubectl apply 동작 원리

**3가지 비교:**

| 구성 요소 | 위치 |
|:----------|:-----|
| Local Configuration | 로컬 YAML 파일 |
| Live Object | Kubernetes 메모리 |
| Last Applied | annotation에 저장 |

```
필드 삭제 감지:
- Local에 없고
- Last Applied에 있으면
→ 삭제로 판단하여 Live에서 제거
```

{{< callout type="warning" >}}
**중요:** `create`, `replace` 명령은 Last Applied를 저장하지 않으므로, 선언형 관리를 위해서는 `apply`만 일관되게 사용해야 합니다.
{{< /callout >}}

---

## 7. kubectl 명령어

### 7.1 api-resources

**사용 가능한 리소스 목록 확인:**

```bash
kubectl api-resources

# 출력:
# NAME          SHORTNAMES   APIVERSION   NAMESPACED   KIND
# pods          po           v1           true         Pod
# services      svc          v1           true         Service
# deployments   deploy       apps/v1      true         Deployment
```

### 7.2 explain

**리소스 필드 구조 확인:**

```bash
# 최상위 필드
kubectl explain pods

# 하위 필드 탐색
kubectl explain pods.spec
kubectl explain pods.spec.containers
kubectl explain pods.spec.containers.env

# 전체 구조 (재귀적)
kubectl explain pods.spec --recursive
```

### 7.3 자주 사용하는 명령어

```bash
# 리소스 조회
kubectl get pods,svc,deploy
kubectl get all
kubectl get pods -o wide
kubectl get pods -o yaml

# 상세 정보
kubectl describe pod nginx

# 로그
kubectl logs nginx
kubectl logs nginx -f  # 실시간
kubectl logs nginx --previous  # 이전 컨테이너

# 실행 중인 파드 접속
kubectl exec -it nginx -- /bin/bash

# 포트 포워딩
kubectl port-forward pod/nginx 8080:80

# 라벨 기반 조회
kubectl get pods -l app=nginx
kubectl get pods -l 'app in (nginx,web)'

# 변경사항 미리보기
kubectl diff -f deployment.yaml

# Dry-run
kubectl apply -f deployment.yaml --dry-run=client
kubectl apply -f deployment.yaml --dry-run=server
```

---

## 8. YAML 파일 필수 구조

### 8.1 4개의 최상위 필드

```yaml
apiVersion: v1      # API 버전
kind: Pod           # 리소스 종류
metadata:           # 메타데이터 (이름, 라벨)
  name: nginx
  labels:
    app: nginx
spec:               # 상세 사양
  containers:
  - name: nginx
    image: nginx
```

### 8.2 주요 리소스 API 버전

| Kind | apiVersion |
|:-----|:-----------|
| Pod, Service, ConfigMap, Secret | v1 |
| Deployment, ReplicaSet, DaemonSet | apps/v1 |
| Ingress | networking.k8s.io/v1 |
| PersistentVolume, PersistentVolumeClaim | v1 |

---

## 9. 실전 팁

### 9.1 CKA 시험 전략

```bash
# 빠른 파드 생성
kubectl run nginx --image=nginx

# YAML 템플릿 생성
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml

# Deployment 템플릿
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml > deploy.yaml

# Service 템플릿
kubectl expose deployment nginx --port=80 --dry-run=client -o yaml > svc.yaml
```

### 9.2 디버깅

```bash
# 파드 상태 확인
kubectl get pods
kubectl describe pod nginx

# 이벤트 확인
kubectl get events --sort-by='.lastTimestamp'

# 노드 상태
kubectl get nodes
kubectl describe node node1

# 서비스 엔드포인트
kubectl get endpoints
```

### 9.3 빠른 편집

```bash
# 실행 중인 리소스 편집
kubectl edit deployment nginx

# 특정 필드만 수정
kubectl patch deployment nginx -p '{"spec":{"replicas":5}}'

# 이미지 변경
kubectl set image deployment/nginx nginx=nginx:1.21
```

---

## 10. 요약

| 컴포넌트 | 역할 |
|:---------|:-----|
| etcd | 클러스터 상태 저장소 |
| kube-apiserver | API 게이트웨이, 유일한 etcd 접근점 |
| kube-scheduler | 파드 배치 결정 |
| kube-controller-manager | 컨트롤러 실행 |
| kubelet | 노드 에이전트, 파드 관리 |
| kube-proxy | Service 네트워크 구현 |

| 워크로드 | 특징 |
|:---------|:-----|
| Pod | 최소 배포 단위 |
| ReplicaSet | 파드 복제 관리 |
| Deployment | 롤링 업데이트, 롤백 |

| Service 유형 | 용도 |
|:-------------|:-----|
| ClusterIP | 내부 통신 |
| NodePort | 외부 노출 (개발) |
| LoadBalancer | 외부 노출 (프로덕션) |

{{< callout type="info" >}}
**핵심 포인트:**
- etcd = 클러스터의 "두뇌"
- kube-apiserver = 모든 통신의 중심
- 선언형(Declarative) 관리 권장
- kubectl explain으로 필드 구조 확인
{{< /callout >}}
