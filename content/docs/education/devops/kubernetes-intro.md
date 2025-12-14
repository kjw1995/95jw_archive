1---
title: Kubernetes 입문
weight: 1
---

## IT 인프라의 진화

```
메인프레임 → 가상화(VM) → 클라우드 → 컨테이너
```

| 시대 | 특징 | 확장 방식 |
|------|------|-----------|
| 2000년대 | x86 가상화 환경 | 스케일 아웃 (서버 대수 증가) |
| 2010년대 | 퍼블릭 클라우드 | IaaS / PaaS / SaaS |
| 현재 | 컨테이너 오케스트레이션 | 쿠버네티스 |

### 클라우드 서비스 모델 비교

```
┌─────────────────────────────────────────────────────┐
│                      SaaS                           │
│              (Gmail, Slack, Notion)                 │
├─────────────────────────────────────────────────────┤
│                      PaaS                           │
│            (Heroku, Google App Engine)              │
├─────────────────────────────────────────────────────┤
│                      IaaS                           │
│              (AWS EC2, GCP Compute)                 │
└─────────────────────────────────────────────────────┘
        ↑ 관리 범위 증가 / 자유도 감소 ↑
```

---

## 컨테이너 vs 가상머신

### 아키텍처 비교

```
[ 가상머신 ]                    [ 컨테이너 ]
┌─────────┐ ┌─────────┐        ┌─────────┐ ┌─────────┐
│  App A  │ │  App B  │        │  App A  │ │  App B  │
├─────────┤ ├─────────┤        ├─────────┴─┴─────────┤
│ Guest OS│ │ Guest OS│        │   Container Runtime │
├─────────┴─┴─────────┤        │       (Docker)      │
│     Hypervisor      │        ├─────────────────────┤
├─────────────────────┤        │      Host OS        │
│      Host OS        │        ├─────────────────────┤
├─────────────────────┤        │     Hardware        │
│     Hardware        │        └─────────────────────┘
└─────────────────────┘
```

| 구분 | 가상머신 | 컨테이너 |
|------|----------|----------|
| 가상화 수준 | 하드웨어 | 운영체제 |
| 크기 | GB 단위 | MB 단위 |
| 부팅 시간 | 분 단위 | 초 단위 |
| 커널 | 개별 커널 | 호스트 커널 공유 |
| 격리 수준 | 강함 | 상대적으로 약함 |

---

## 컨테이너 / 도커 / 쿠버네티스 관계

```
┌─────────────────────────────────────────────────┐
│              Kubernetes (오케스트레이션)          │
│  ┌───────────────────────────────────────────┐  │
│  │           Docker (컨테이너 런타임)          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │  │
│  │  │Container│  │Container│  │Container│   │  │
│  │  └─────────┘  └─────────┘  └─────────┘   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

- **컨테이너**: 애플리케이션 + 실행 환경을 패키징한 단위
- **Docker**: 컨테이너를 생성/실행하는 런타임 (필수)
- **Kubernetes**: 다수의 컨테이너를 관리하는 오케스트레이션 도구 (선택)

---

## 쿠버네티스 클러스터 구조

```
┌─────────────────── Kubernetes Cluster ───────────────────┐
│                                                          │
│  ┌──────────────┐    ┌──────────────┐  ┌──────────────┐ │
│  │ Master Node  │    │ Worker Node  │  │ Worker Node  │ │
│  │              │    │              │  │              │ │
│  │ - API Server │    │ ┌──────────┐ │  │ ┌──────────┐ │ │
│  │ - Scheduler  │────│ │   Pod    │ │  │ │   Pod    │ │ │
│  │ - Controller │    │ │┌────────┐│ │  │ │┌────────┐│ │ │
│  │ - etcd       │    │ ││Container││ │  │ ││Container││ │ │
│  │              │    │ │└────────┘│ │  │ │└────────┘│ │ │
│  │              │    │ └──────────┘ │  │ └──────────┘ │ │
│  └──────────────┘    └──────────────┘  └──────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Master Node**: 클러스터 전체 관리 (API 서버, 스케줄러, 컨트롤러)
- **Worker Node**: 실제 컨테이너가 실행되는 노드
- **Cluster**: Master + Worker 노드들의 집합

---

## 쿠버네티스 핵심 오브젝트

### 기본 오브젝트

| 오브젝트 | 설명 | 예시 |
|----------|------|------|
| **Pod** | 가장 작은 배포 단위, 1개 이상의 컨테이너 포함 | nginx pod |
| **Service** | Pod를 외부에 노출시키는 네트워크 추상화 | LoadBalancer |
| **Volume** | 컨테이너 간 공유 가능한 스토리지 | PersistentVolume |
| **Namespace** | 클러스터 내 논리적 분리 단위 | dev, staging, prod |

### Pod YAML 예제

```yaml
# nginx-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
```

### 자주 사용하는 kubectl 명령어

```bash
# 클러스터 정보 확인
kubectl cluster-info
kubectl get nodes

# Pod 관리
kubectl apply -f nginx-pod.yaml    # Pod 생성
kubectl get pods                    # Pod 목록 조회
kubectl describe pod nginx-pod      # Pod 상세 정보
kubectl logs nginx-pod              # Pod 로그 확인
kubectl delete pod nginx-pod        # Pod 삭제

# 네임스페이스 관리
kubectl get namespaces
kubectl create namespace dev

# 서비스 확인
kubectl get services
kubectl get svc
```

---

## 쿠버네티스 핵심 장점

### 1. 무중단 배포 (Rolling Update)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 추가 Pod 수
      maxUnavailable: 0  # 최소 가용 Pod 수
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
        image: nginx:1.21
```

```bash
# 이미지 업데이트 (무중단)
kubectl set image deployment/nginx-deployment nginx=nginx:1.22
```

### 2. 오토스케일링 (HPA)

```yaml
# hpa.yaml
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

### 3. 자원 제한 설정

```yaml
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    resources:
      requests:          # 최소 보장 자원
        memory: "128Mi"
        cpu: "250m"
      limits:            # 최대 사용 가능 자원
        memory: "256Mi"
        cpu: "500m"
```

---

## 핵심 용어 정리

| 용어 | 설명 |
|------|------|
| 컨테이너 런타임 | 컨테이너를 실행하는 환경 (Docker, containerd) |
| 오케스트레이션 | 다수의 컨테이너를 자동으로 배포, 확장, 관리 |
| 스케일 아웃 | 서버 대수를 늘려 처리량 증가 |
| 스케일 업 | 단일 서버 성능을 향상 |
| 락인 (Lock-in) | 특정 벤더에 종속되는 현상 |
| 하이퍼바이저 | 하드웨어를 가상화하여 VM을 실행하는 소프트웨어 |

---

## 다음 단계

- [Chapter 2: 쿠버네티스 설치](/docs/education/devops/kubernetes-setup)
- Docker 기초 학습
- YAML 문법 익히기
