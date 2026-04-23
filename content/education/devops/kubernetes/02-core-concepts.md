---
title: "02. 핵심 개념"
weight: 2
---

쿠버네티스 클러스터를 이루는 컴포넌트, 워크로드, 서비스, 네임스페이스와 기본 kubectl 사용법을 정리한다.

## 1. 클러스터 아키텍처

쿠버네티스 클러스터는 **Control Plane(Master Node)** 과 **Worker Node** 로 구성된다. Control Plane은 클러스터 상태를 관리하고, Worker Node는 실제 컨테이너를 실행한다.

```text
┌──────── Control Plane ─────────┐
│  API Server   Scheduler         │
│  Controller   etcd              │
└────────────────┬────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Worker 1│  │Worker 2│  │Worker 3│
│kubelet │  │kubelet │  │kubelet │
│kube-prx│  │kube-prx│  │kube-prx│
│Runtime │  │Runtime │  │Runtime │
│ [Pods] │  │ [Pods] │  │ [Pods] │
└────────┘  └────────┘  └────────┘
```

| 노드 | 역할 |
|:---|:---|
| Control Plane | 스케줄링, 상태 관리, API 게이트웨이 |
| Worker Node | 파드 실행, 네트워크 프록시, 런타임 운영 |

## 2. Control Plane 컴포넌트

### 2.1 etcd

**분산 키-값 저장소** 로 클러스터의 모든 상태 정보를 저장한다. Node, Pod, ConfigMap, Secret, Deployment 등 모든 리소스가 여기에 기록된다.

```bash
# 버전 확인
etcdctl version

# 키-값 저장/조회 (API v3)
ETCDCTL_API=3 etcdctl put key1 value1
ETCDCTL_API=3 etcdctl get key1

# 모든 키 조회
etcdctl get / --prefix --keys-only
```

{{< callout type="info" >}}
etcd에 업데이트가 완료되어야만 클러스터 변경이 완료된 것으로 간주된다. 모든 요청의 최종 기록은 etcd를 거친다.
{{< /callout >}}

### 2.2 kube-apiserver

**클러스터의 중앙 관리 컴포넌트** 로 모든 요청의 진입점(게이트웨이) 역할을 한다.

- 인증(Authentication) 및 검증(Validation)
- etcd와 **유일하게** 직접 통신
- 다른 컴포넌트 간 통신 중개

### 2.3 kube-scheduler

**파드를 어느 노드에 배치할지 결정** 한다. 실제 실행은 해당 노드의 kubelet이 수행한다.

```text
1단계: 필터링
  · 리소스 부족 노드 제외
  · Taints/Tolerations 체크
  · NodeSelector 확인

2단계: 순위 매기기
  · 리소스 활용도 점수
  · 부하 분산 점수
  · Affinity 규칙 점수
  → 최고 점수 노드 선택
```

### 2.4 kube-controller-manager

**여러 컨트롤러를 단일 프로세스로 실행** 하며, 선언된 상태와 실제 상태의 차이를 지속적으로 조정한다.

| 컨트롤러 | 역할 |
|:---|:---|
| Node Controller | 노드 상태 모니터링, 장애 처리 |
| Replication Controller | 파드 수 유지 |
| Deployment Controller | 배포 전략 관리 |
| Service Controller | 서비스 엔드포인트 관리 |
| Namespace Controller | 네임스페이스 생명주기 |

**Node Controller 설정 예시:**

```bash
--node-monitor-period=5s          # 노드 상태 체크 주기
--node-monitor-grace-period=40s   # Unreachable 판정 대기
--pod-eviction-timeout=5m         # 파드 제거 대기 시간
```

## 3. Worker Node 컴포넌트

### 3.1 kubelet

**각 Worker Node의 에이전트** 로 파드 생명주기를 관리한다.

- 노드를 클러스터에 등록
- 파드 생성/삭제 수행
- 컨테이너 런타임과 통신
- 상태를 API Server에 보고

{{< callout type="warning" >}}
kubelet은 `kubeadm`으로도 자동 설치되지 않는다. 각 Worker Node에 **수동 설치가 필요** 하다.
{{< /callout >}}

### 3.2 kube-proxy

**Service를 실제로 구현하는 컴포넌트** 로 각 노드에서 실행되며 iptables/IPVS 규칙을 관리한다.

| 모드 | 특징 |
|:---|:---|
| iptables | 기본값, 커널 수준 처리 |
| IPVS | 고성능, 다양한 로드밸런싱 알고리즘 |
| userspace | 레거시, 비권장 |

### 3.3 Container Runtime

컨테이너를 실제로 실행하는 런타임이다. 쿠버네티스 **1.24부터 dockershim이 제거** 되어 Docker 직접 지원이 중단되었다.

```text
Docker 구성요소:
├── Docker CLI
├── Docker API
├── Build Tools
├── runC (실제 런타임)
└── ContainerD (runC 관리)
```

| 도구 | 용도 | 비고 |
|:---|:---|:---|
| ctr | ContainerD 디버깅 | 사용 비권장 |
| nerdctl | 범용 컨테이너 관리 | Docker CLI 대체 |
| crictl | K8s 환경 디버깅 | CRI 런타임 표준 |

```bash
# Docker → nerdctl
docker run nginx     → nerdctl run nginx
docker ps            → nerdctl ps

# Docker → crictl (K8s 환경)
docker ps            → crictl ps
docker logs <id>     → crictl logs <id>
crictl pods          # 파드 목록 (Docker에 없음)
```

## 4. 파드 생성 워크플로우

```text
1. kubectl apply -f deployment.yaml
         │
         ▼
2. API Server: 인증·검증
         │
         ▼
3. etcd: 파드 객체 저장 (노드 미할당)
         │
         ▼
4. Scheduler: 적절한 노드 선택
         │
         ▼
5. API Server → kubelet 지시
         │
         ▼
6. kubelet: 컨테이너 실행
         │
         ▼
7. 상태를 etcd에 최종 업데이트
```

## 5. 워크로드

### 5.1 Pod

**쿠버네티스의 최소 배포 단위** 로 하나 이상의 컨테이너를 포함한다.

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
**멀티 컨테이너 특징**
- 같은 네트워크 네임스페이스 공유 (localhost 통신)
- 볼륨 공유 가능
- 함께 생성·삭제됨
{{< /callout >}}

**기본 명령어:**

```bash
# 생성
kubectl run nginx --image=nginx
kubectl apply -f pod.yaml

# 조회
kubectl get pods
kubectl get pods -o wide
kubectl describe pod nginx

# 로그·접속
kubectl logs nginx
kubectl logs nginx -c container-name
kubectl exec -it nginx -- /bin/bash

# 삭제
kubectl delete pod nginx
```

### 5.2 ReplicaSet

**지정된 수의 파드 복제본을 항상 유지** 한다.

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

```bash
# 파일 수정 후 적용
kubectl replace -f replicaset.yaml

# 명령어로 스케일링
kubectl scale --replicas=6 replicaset nginx-rs
```

{{< callout type="warning" >}}
Deployment가 ReplicaSet을 자동 관리하므로 일반적으로 ReplicaSet을 직접 사용하지 않는다.
{{< /callout >}}

### 5.3 Deployment

**ReplicaSet의 상위 객체** 로 롤링 업데이트와 롤백을 지원한다. stateless 앱 배포의 표준이다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
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
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"
          limits:
            memory: "128Mi"
            cpu: "500m"
```

**계층 구조:**

```text
Deployment
    └─→ ReplicaSet (자동 생성)
            └─→ Pods (자동 생성)
```

**운영 명령어:**

```bash
# 생성·조회
kubectl apply -f deployment.yaml
kubectl get deployments
kubectl get pods -l app=nginx

# 스케일링
kubectl scale deployment nginx-deployment --replicas=5

# 이미지 업데이트 (Rolling Update)
kubectl set image deployment/nginx-deployment nginx=nginx:1.22

# 배포 상태·히스토리
kubectl rollout status deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment

# 롤백
kubectl rollout undo deployment/nginx-deployment
kubectl rollout undo deployment/nginx-deployment --to-revision=2

# 일시정지·재개
kubectl rollout pause deployment/nginx-deployment
kubectl rollout resume deployment/nginx-deployment
```

### 5.4 Job & CronJob

**Job** 은 일회성 작업을, **CronJob** 은 예약 작업을 처리한다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: backup-job
spec:
  template:
    spec:
      containers:
      - name: backup
        image: busybox
        command: ["sh", "-c", "echo 'Backup completed' && sleep 10"]
      restartPolicy: Never
  backoffLimit: 3
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command: ["sh", "-c", "date; echo 'Daily backup'"]
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

**Cron 표현식:**

```text
┌──── 분   (0-59)
│ ┌── 시   (0-23)
│ │ ┌── 일 (1-31)
│ │ │ ┌── 월 (1-12)
│ │ │ │ ┌── 요일 (0-6, Sun=0)
│ │ │ │ │
* * * * *

*/5 * * * *      # 매 5분마다
0 */2 * * *      # 매 2시간마다
0 9-18 * * 1-5   # 평일 9~18시 정각
```

### 5.5 DaemonSet

**모든 노드에 파드를 하나씩 배포** 한다. 로그 수집, 모니터링 에이전트 용도로 사용한다.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-logging
spec:
  selector:
    matchLabels:
      name: fluentd
  template:
    metadata:
      labels:
        name: fluentd
    spec:
      tolerations:
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
      containers:
      - name: fluentd
        image: fluent/fluentd:latest
        volumeMounts:
        - name: varlog
          mountPath: /var/log
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
```

### 5.6 워크로드 비교

| 워크로드 | 용도 | 특징 |
|:---|:---|:---|
| Pod | 최소 배포 단위 | 직접 생성은 드묾 |
| ReplicaSet | 파드 개수 유지 | Deployment 내부 사용 |
| Deployment | 일반 앱 배포 | Rolling Update, 롤백 |
| Job | 일회성 작업 | 완료 시 종료 |
| CronJob | 예약 작업 | 주기적 실행 |
| DaemonSet | 노드별 배포 | 로그·모니터링 에이전트 |
| StatefulSet | Stateful 앱 | 순서·고유성 보장 (DB 등) |

## 6. 서비스 (Service)

파드 IP는 동적으로 바뀌기 때문에, 안정적인 네트워크 엔드포인트가 필요하다. Service는 라벨 셀렉터로 선택된 파드들에 대해 고정된 가상 IP와 DNS를 제공한다.

### 6.1 서비스 유형

```text
         External
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐
│  LB  │ │ Node │ │ Ing  │
│Cloud │ │ Port │ │ ress │
└──┬───┘ └──┬───┘ └──┬───┘
   └────────┼────────┘
            ▼
      ┌───────────┐
      │ ClusterIP │
      └─────┬─────┘
            ▼
         [Pods]
```

| 유형 | 용도 | 접근 범위 |
|:---|:---|:---|
| ClusterIP | 내부 통신 (기본값) | 클러스터 내부 |
| NodePort | 외부 노출 (개발) | NodeIP:포트 |
| LoadBalancer | 외부 노출 (프로덕션) | 클라우드 LB |
| Ingress | L7 라우팅 | HTTP(S) 호스트·경로 |

### 6.2 ClusterIP

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: ClusterIP        # 생략 가능 (기본값)
  selector:
    app: backend
  ports:
  - port: 80             # 서비스 포트
    targetPort: 8080     # 컨테이너 포트
```

```bash
# 같은 네임스페이스
curl http://backend-service:80

# 다른 네임스페이스
curl http://backend-service.other-ns.svc.cluster.local:80
```

### 6.3 NodePort

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
  - port: 80             # Service 포트
    targetPort: 80       # Pod 포트
    nodePort: 30080      # Node 포트 (30000-32767)
```

```text
[External] → [Node:30080] → [SVC:80] → [Pod:80]
```

### 6.4 LoadBalancer

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
LoadBalancer는 **클라우드 환경에서만** 자동 프로비저닝된다. 온프레미스에서는 EXTERNAL-IP가 `<pending>` 상태로 유지되며, MetalLB 같은 별도 솔루션이 필요하다.
{{< /callout >}}

### 6.5 Ingress

L7 계층에서 호스트·경로 기반 라우팅을 제공한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: app.example.com
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
```

## 7. 네트워크 통신

### 7.1 통신 레벨

| 레벨 | 경로 | 구현 |
|:---|:---|:---|
| 1 | 같은 파드 내 컨테이너 | localhost + 포트 |
| 2 | 같은 노드 내 파드 | 동일 브리지 네트워크 |
| 3 | 다른 노드의 파드 | CNI 플러그인 (오버레이) |
| 4 | 파드 ↔ 서비스 | netfilter/iptables |
| 5 | 외부 ↔ 클러스터 | NodePort/LB/Ingress |

### 7.2 CNI 플러그인

| 플러그인 | 특징 |
|:---|:---|
| Flannel | 간단한 오버레이, 입문용 |
| Calico | 네트워크 정책 지원, 성능 우수 |
| Cilium | eBPF 기반, 고급 모니터링 |
| Weave | 암호화 지원, 설치 간편 |

```bash
# Calico 설치 예시
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# CNI 상태 확인
kubectl get pods -n kube-system | grep calico
```

## 8. Taint & Toleration

특정 노드에 특정 파드만 배포하도록 제어한다. Taint는 노드에, Toleration은 파드에 설정한다.

```bash
# Taint 추가·제거·확인
kubectl taint nodes node1 gpu=true:NoSchedule
kubectl taint nodes node1 gpu=true:NoSchedule-
kubectl describe node node1 | grep Taint
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  tolerations:
  - key: "gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
  containers:
  - name: gpu-container
    image: nvidia/cuda:11.0-base
```

| Effect | 설명 |
|:---|:---|
| NoSchedule | 톨러레이션 없는 파드 배포 불가 |
| PreferNoSchedule | 가급적 배포 안 함 (리소스 부족 시 허용) |
| NoExecute | 기존 파드도 퇴거, 신규 배포 불가 |

## 9. 네임스페이스

### 9.1 기본 네임스페이스

| Namespace | 용도 |
|:---|:---|
| default | 사용자 기본 작업 공간 |
| kube-system | 쿠버네티스 시스템 컴포넌트 |
| kube-public | 모든 사용자 접근 가능 |

### 9.2 네임스페이스 관리

```bash
# 생성·조회
kubectl create namespace dev
kubectl get pods -n kube-system
kubectl get pods -A
kubectl get pods --all-namespaces

# 기본 네임스페이스 변경
kubectl config set-context --current --namespace=dev
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: dev
spec:
  containers:
  - name: nginx
    image: nginx
```

### 9.3 ResourceQuota

네임스페이스별 리소스 제한을 건다.

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

## 10. Imperative vs Declarative

### 10.1 Imperative (명령형)

"어떻게(How)"를 단계별로 지시한다.

```bash
kubectl run nginx --image=nginx
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80
kubectl scale deployment nginx --replicas=3
kubectl set image deployment/nginx nginx=nginx:1.21
```

- **장점**: 빠른 작업, 시험에서 시간 절약
- **단점**: 히스토리 없음, 협업 어려움

### 10.2 Declarative (선언형)

"무엇을(What)"만 선언하면 쿠버네티스가 차이를 조정한다.

```bash
kubectl apply -f nginx-deployment.yaml
kubectl apply -f ./configs/     # 디렉토리 전체
```

- **장점**: Git 버전 관리, 협업 용이, 변경 자동 감지
- **권장**: 프로덕션에서는 선언형 사용

### 10.3 kubectl apply 동작 원리

| 구성 요소 | 위치 |
|:---|:---|
| Local Configuration | 로컬 YAML 파일 |
| Live Object | 쿠버네티스 메모리 |
| Last Applied | annotation에 저장 |

```text
필드 삭제 감지:
  Local에 없고
  Last Applied에 있으면
  → 삭제로 판단하여 Live에서 제거
```

{{< callout type="warning" >}}
`create`, `replace`는 Last Applied를 저장하지 않는다. 선언형 관리를 위해서는 **`apply`만 일관되게** 사용해야 한다.
{{< /callout >}}

## 11. YAML 기본 구조

모든 쿠버네티스 매니페스트는 4개 최상위 필드로 구성된다.

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

| Kind | apiVersion |
|:---|:---|
| Pod, Service, ConfigMap, Secret | v1 |
| Deployment, ReplicaSet, DaemonSet | apps/v1 |
| Job, CronJob | batch/v1 |
| Ingress | networking.k8s.io/v1 |
| PersistentVolume, PVC | v1 |

## 12. kubectl 기본 사용법

### 12.1 리소스·필드 탐색

```bash
# 사용 가능한 리소스 목록
kubectl api-resources

# 리소스 필드 구조
kubectl explain pods
kubectl explain pods.spec
kubectl explain pods.spec.containers
kubectl explain pods.spec --recursive
```

### 12.2 조회·디버깅

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide

# 리소스 조회
kubectl get all
kubectl get pods,svc,deploy
kubectl get pods -A
kubectl get pods -o wide
kubectl get pods -o yaml
kubectl get events --sort-by='.lastTimestamp'

# 라벨 기반 조회
kubectl get pods -l app=nginx
kubectl get pods -l 'app in (nginx,web)'

# 상세 정보
kubectl describe pod <pod-name>
kubectl describe svc <service-name>

# 로그
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container>
kubectl logs -f <pod-name>
kubectl logs <pod-name> --previous

# 디버깅
kubectl exec -it <pod-name> -- /bin/sh
kubectl port-forward svc/nginx 8080:80
kubectl get endpoints
```

### 12.3 빠른 편집·템플릿

```bash
# 실행 중 리소스 편집
kubectl edit deployment nginx

# 특정 필드 패치
kubectl patch deployment nginx -p '{"spec":{"replicas":5}}'

# 이미지 변경
kubectl set image deployment/nginx nginx=nginx:1.21

# YAML 템플릿 생성
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml > deploy.yaml
kubectl expose deployment nginx --port=80 --dry-run=client -o yaml > svc.yaml

# 변경사항 미리보기
kubectl diff -f deployment.yaml
kubectl apply -f deployment.yaml --dry-run=client
kubectl apply -f deployment.yaml --dry-run=server

# 삭제
kubectl delete -f deployment.yaml
kubectl delete pod <pod-name> --grace-period=0 --force
```

## 핵심 정리

| 컴포넌트 | 역할 |
|:---|:---|
| etcd | 클러스터 상태 저장소 |
| kube-apiserver | API 게이트웨이, 유일한 etcd 접근점 |
| kube-scheduler | 파드 배치 결정 |
| kube-controller-manager | 컨트롤러 실행·조정 |
| kubelet | 노드 에이전트, 파드 관리 |
| kube-proxy | Service 네트워크 구현 |

| 워크로드 | 특징 |
|:---|:---|
| Pod | 최소 배포 단위 |
| ReplicaSet | 파드 복제 관리 |
| Deployment | 롤링 업데이트, 롤백 |
| Job/CronJob | 일회성·예약 작업 |
| DaemonSet | 노드별 배포 |

| Service 유형 | 용도 |
|:---|:---|
| ClusterIP | 내부 통신 (기본값) |
| NodePort | 외부 노출 (개발) |
| LoadBalancer | 외부 노출 (프로덕션) |
| Ingress | L7 호스트·경로 라우팅 |

{{< callout type="info" >}}
**용어 정리**
- **Control Plane**: Master Node의 다른 이름, 클러스터 관리 역할
- **etcd**: 분산 키-값 저장소, 클러스터의 "두뇌"
- **kubelet**: Node의 파드 관리 에이전트
- **CNI**: Container Network Interface, 파드 네트워킹 표준
- **Overlay Network**: 물리 네트워크 위 가상 네트워크
- **Stateless / Stateful**: 상태 없음 / 상태 보관 (DB 등)
- **Imperative / Declarative**: 명령형 / 선언형 관리 방식
{{< /callout >}}
