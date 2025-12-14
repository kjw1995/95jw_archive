---
title: Kubernetes 기본 개념
weight: 2
---

## 클러스터 구조

```
┌────────────────────── Kubernetes Cluster ──────────────────────┐
│                                                                 │
│  ┌─────────────── Master Node (Control Plane) ───────────────┐ │
│  │                                                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────┐ │ │
│  │  │API Server│ │Scheduler │ │ Controller │ │    etcd     │ │ │
│  │  │          │ │          │ │  Manager   │ │ (key-value) │ │ │
│  │  └──────────┘ └──────────┘ └────────────┘ └─────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│  │ Worker Node │      │ Worker Node │      │ Worker Node │    │
│  │ ┌─────────┐ │      │ ┌─────────┐ │      │ ┌─────────┐ │    │
│  │ │ kubelet │ │      │ │ kubelet │ │      │ │ kubelet │ │    │
│  │ ├─────────┤ │      │ ├─────────┤ │      │ ├─────────┤ │    │
│  │ │kube-prox│ │      │ │kube-prox│ │      │ │kube-prox│ │    │
│  │ ├─────────┤ │      │ ├─────────┤ │      │ ├─────────┤ │    │
│  │ │Container│ │      │ │Container│ │      │ │Container│ │    │
│  │ │ Runtime │ │      │ │ Runtime │ │      │ │ Runtime │ │    │
│  │ └─────────┘ │      │ └─────────┘ │      │ └─────────┘ │    │
│  │   [Pods]    │      │   [Pods]    │      │   [Pods]    │    │
│  └─────────────┘      └─────────────┘      └─────────────┘    │
│                                                                 │
│  ┌─────────────────── Persistent Storage ────────────────────┐ │
│  │                    (CSI 연결)                              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트 역할 요약

### Master Node 컴포넌트

| 컴포넌트 | 역할 | 비유 |
|----------|------|------|
| **API Server** | 모든 요청의 진입점, 인증/검증 | 안내 데스크 |
| **etcd** | 클러스터 상태 저장 (key-value) | 데이터베이스 |
| **Scheduler** | Pod를 어느 Node에 배치할지 결정 | 배치 담당자 |
| **Controller Manager** | 상태 모니터링 및 유지 | 관리자 |

### Worker Node 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| **kubelet** | Pod 생성/관리 에이전트 |
| **kube-proxy** | 네트워크 규칙 관리, 내외부 통신 담당 |
| **Container Runtime** | 컨테이너 실행 (Docker, containerd) |

---

## Pod 생성 흐름

```
1. kubectl apply -f deployment.yaml
         │
         ▼
2. [API Server] ─── 인증/검증 ───▶ [etcd] 상태 저장
         │
         ▼
3. [Scheduler] ─── 적절한 Node 선택 ───▶ [API Server] ───▶ [etcd] 업데이트
         │
         ▼
4. [kubelet] ─── Pod 생성 ───▶ [API Server] ───▶ [etcd] 최종 상태 저장
```

---

## 컨트롤러 종류

### Deployment (가장 많이 사용)

stateless 애플리케이션 배포의 표준

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3                    # Pod 개수
  selector:
    matchLabels:
      app: nginx                 # 관리할 Pod 선택
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

```bash
# Deployment 생성
kubectl apply -f deployment.yaml

# 조회
kubectl get deployments
kubectl get pods -l app=nginx

# 스케일링
kubectl scale deployment nginx-deployment --replicas=5

# 이미지 업데이트 (Rolling Update)
kubectl set image deployment/nginx-deployment nginx=nginx:1.22

# 롤백
kubectl rollout undo deployment/nginx-deployment

# 배포 상태 확인
kubectl rollout status deployment/nginx-deployment
```

### ReplicaSet

지정된 Pod 개수를 항상 유지

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: nginx-replicaset
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
        image: nginx:1.21
        ports:
        - containerPort: 80
```

> Deployment가 ReplicaSet을 자동 관리하므로, 일반적으로 ReplicaSet을 직접 사용하지 않음

### Job (일회성 작업)

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
  backoffLimit: 3                # 실패 시 재시도 횟수
```

```bash
# Job 실행 및 확인
kubectl apply -f job.yaml
kubectl get jobs
kubectl logs job/backup-job
```

### CronJob (예약 작업)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"          # 매일 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command: ["sh", "-c", "date; echo 'Daily backup executed'"]
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3  # 성공 기록 유지 개수
  failedJobsHistoryLimit: 1      # 실패 기록 유지 개수
```

**Cron 표현식:**
```
┌───────────── 분 (0-59)
│ ┌───────────── 시 (0-23)
│ │ ┌───────────── 일 (1-31)
│ │ │ ┌───────────── 월 (1-12)
│ │ │ │ ┌───────────── 요일 (0-6, 일요일=0)
│ │ │ │ │
* * * * *

# 예시
*/5 * * * *     # 매 5분마다
0 */2 * * *     # 매 2시간마다
0 9-18 * * 1-5  # 평일 9시~18시 정각마다
```

### DaemonSet (노드당 하나)

모든 노드에 Pod 하나씩 배포 (로그 수집, 모니터링 용도)

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
      tolerations:               # Master 노드에도 배포
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

---

## 컨트롤러 비교

| 컨트롤러 | 용도 | 특징 |
|----------|------|------|
| **Deployment** | 일반 앱 배포 | Rolling Update, 롤백 지원 |
| **ReplicaSet** | Pod 개수 유지 | Deployment가 내부적으로 사용 |
| **Job** | 일회성 작업 | 완료 시 종료 |
| **CronJob** | 예약 작업 | 주기적 실행 |
| **DaemonSet** | 노드별 배포 | 로그/모니터링 에이전트 |
| **StatefulSet** | Stateful 앱 | DB처럼 순서/고유성 필요 시 |

---

## 서비스 (Service)

Pod의 IP는 동적으로 변경되므로, 고정된 접근 방법 필요

### 서비스 타입

```
┌─────────────────────────────────────────────────────────────┐
│                        External                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │ LoadBalancer│  │  NodePort   │  │   Ingress   │
   │ (클라우드)   │  │ (Node IP)  │  │ (L7 라우팅) │
   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    ┌─────────────┐
                    │  ClusterIP  │
                    │ (내부 전용)  │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │    Pods     │
                    └─────────────┘
```

### ClusterIP (기본값, 내부 전용)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-clusterip
spec:
  type: ClusterIP              # 생략 가능 (기본값)
  selector:
    app: nginx
  ports:
  - port: 80                   # 서비스 포트
    targetPort: 80             # 컨테이너 포트
```

### NodePort (외부 노출)

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
  - port: 80
    targetPort: 80
    nodePort: 30080            # 30000-32767 범위
```

```bash
# 접근: http://<NODE_IP>:30080
```

### LoadBalancer (클라우드 환경)

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

```bash
# External IP 확인
kubectl get svc nginx-lb
```

### Ingress (L7 라우팅)

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

---

## 네트워크 통신

### 통신 레벨

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 같은 Pod 내 컨테이너: localhost + 다른 포트              │
├─────────────────────────────────────────────────────────────┤
│ 2. 같은 Node 내 Pod: 동일 네트워크 대역 (직접 통신)         │
├─────────────────────────────────────────────────────────────┤
│ 3. 다른 Node의 Pod: CNI 플러그인 필요 (오버레이 네트워크)   │
├─────────────────────────────────────────────────────────────┤
│ 4. Pod ↔ Service: netfilter/iptables (서비스 IP → Pod IP)  │
├─────────────────────────────────────────────────────────────┤
│ 5. 외부 ↔ 클러스터: NodePort / LoadBalancer / Ingress      │
└─────────────────────────────────────────────────────────────┘
```

### CNI 플러그인 비교

| 플러그인 | 특징 |
|----------|------|
| **Flannel** | 간단한 오버레이 네트워크, 입문용 |
| **Calico** | 네트워크 정책 지원, 성능 우수 |
| **Cilium** | eBPF 기반, 고급 모니터링 |
| **Weave** | 암호화 지원, 설치 간편 |

```bash
# Calico 설치 예시
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# CNI 상태 확인
kubectl get pods -n kube-system | grep calico
```

---

## Taint & Toleration

특정 노드에 특정 Pod만 배포하도록 제어

### Taint 설정

```bash
# Taint 추가
kubectl taint nodes node1 gpu=true:NoSchedule

# Taint 제거
kubectl taint nodes node1 gpu=true:NoSchedule-

# Taint 확인
kubectl describe node node1 | grep Taint
```

### Toleration 설정

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

### Effect 종류

| Effect | 설명 |
|--------|------|
| **NoSchedule** | 톨러레이션 없는 Pod 배포 불가 |
| **PreferNoSchedule** | 가급적 배포 안 함 (리소스 부족 시 허용) |
| **NoExecute** | 기존 Pod도 퇴거, 새 Pod 배포 불가 |

---

## 자주 사용하는 kubectl 명령어

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide

# 리소스 조회
kubectl get all                          # 모든 리소스
kubectl get pods -A                      # 모든 네임스페이스
kubectl get pods -o wide                 # 상세 정보 (IP, Node 등)
kubectl get events --sort-by='.lastTimestamp'

# 상세 정보
kubectl describe pod <pod-name>
kubectl describe svc <service-name>

# 로그
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container>   # 멀티 컨테이너
kubectl logs -f <pod-name>               # 실시간

# 디버깅
kubectl exec -it <pod-name> -- /bin/sh
kubectl port-forward svc/nginx 8080:80   # 로컬 포트포워딩

# 리소스 삭제
kubectl delete -f deployment.yaml
kubectl delete pod <pod-name> --grace-period=0 --force
```

---

## 핵심 용어

| 용어 | 설명 |
|------|------|
| **Control Plane** | Master Node의 다른 이름 |
| **etcd** | 분산 키-값 저장소 |
| **kubelet** | Node의 Pod 관리 에이전트 |
| **CNI** | Container Network Interface |
| **Overlay Network** | 물리 네트워크 위 가상 네트워크 |
| **netfilter** | Linux 커널의 패킷 처리 엔진 |
| **stateless** | 상태를 저장하지 않는 애플리케이션 |
| **stateful** | 상태를 저장하는 애플리케이션 (DB 등) |
