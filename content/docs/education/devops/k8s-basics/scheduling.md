---
title: "Scheduling"
weight: 2
---

Kubernetes 스케줄링 메커니즘과 파드 배치 전략을 다룹니다.

---

## 1. 스케줄링 기본 원리

### 1.1 스케줄러 동작 과정

```
1. 파드 생성 요청 (nodeName 필드 비어있음)
2. kube-scheduler가 Pending 파드 감지
3. 2단계 스케줄링 실행:
   ├── Filtering: 부적합 노드 제외
   └── Scoring: 적합 노드 점수 계산
4. 최고 점수 노드에 파드 바인딩
5. kubelet이 파드 실행
```

### 1.2 수동 스케줄링

스케줄러 없이 직접 노드를 지정하는 방법이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  nodeName: worker-node-1  # 직접 노드 지정
  containers:
  - name: nginx
    image: nginx
```

{{< callout type="warning" >}}
**nodeName은 생성 시에만 설정 가능하다.** 이미 실행 중인 파드의 nodeName은 변경할 수 없다. 기존 파드를 다른 노드로 옮기려면 Binding API를 사용해야 한다.
{{< /callout >}}

**Binding API를 사용한 파드 배치:**

```bash
# Binding 객체를 JSON으로 POST 요청
curl -X POST \
  http://localhost:8001/api/v1/namespaces/default/pods/nginx-pod/binding/ \
  -H 'Content-Type: application/json' \
  -d '{
    "apiVersion": "v1",
    "kind": "Binding",
    "metadata": { "name": "nginx-pod" },
    "target": {
      "apiVersion": "v1",
      "kind": "Node",
      "name": "worker-node-1"
    }
  }'
```

---

## 2. Labels와 Selectors

### 2.1 기본 개념

**Labels**: 객체에 붙이는 키-값 쌍의 메타데이터
**Selectors**: Labels를 기준으로 객체를 필터링하는 쿼리

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
  labels:
    app: ecommerce
    tier: frontend
    environment: production
    version: v2.1
spec:
  containers:
  - name: nginx
    image: nginx
```

### 2.2 Label 조회 및 필터링

```bash
# 특정 라벨로 필터링
kubectl get pods -l app=ecommerce
kubectl get pods --selector app=ecommerce

# 여러 조건 (AND)
kubectl get pods -l app=ecommerce,tier=frontend

# 라벨 포함 조회
kubectl get pods --show-labels

# IN 조건
kubectl get pods -l 'environment in (production,staging)'

# NOT 조건
kubectl get pods -l environment!=development
```

### 2.3 ReplicaSet에서의 Selector

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend-rs
  labels:
    app: frontend     # ReplicaSet 자체의 라벨
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend   # 관리할 파드 선택 조건
  template:
    metadata:
      labels:
        app: frontend # 생성될 파드의 라벨 (selector와 일치해야 함)
    spec:
      containers:
      - name: nginx
        image: nginx
```

### 2.4 matchExpressions

복잡한 조건 표현이 가능하다.

```yaml
spec:
  selector:
    matchExpressions:
    - key: app
      operator: In
      values: ["frontend", "backend"]
    - key: tier
      operator: NotIn
      values: ["cache"]
    - key: environment
      operator: Exists
```

| 연산자 | 설명 |
|:-------|:-----|
| In | 값 목록 중 하나와 일치 |
| NotIn | 값 목록에 없음 |
| Exists | 키가 존재함 (값 무관) |
| DoesNotExist | 키가 존재하지 않음 |

### 2.5 Annotations

Labels와 달리 Selector로 사용되지 않는 정보성 메타데이터다.

```yaml
metadata:
  annotations:
    buildVersion: "1.34.2"
    buildDate: "2024-01-15"
    kubernetes.io/created-by: "deployment-controller"
    description: "Main application pod"
```

---

## 3. Taints와 Tolerations

### 3.1 기본 개념

```
Taint: 노드에 설정 → "이 조건을 견디지 못하는 파드는 오지 마라"
Toleration: 파드에 설정 → "이 Taint를 견딜 수 있다"

매칭 결과:
✅ Taint + 일치하는 Toleration = 파드 배치 가능
❌ Taint + 불일치 = 파드 배치 불가
```

### 3.2 Taint 설정

```bash
# Taint 추가
kubectl taint nodes node1 app=blue:NoSchedule

# Taint 제거 (끝에 '-' 추가)
kubectl taint nodes node1 app=blue:NoSchedule-

# Taint 확인
kubectl describe node node1 | grep Taint
```

### 3.3 Taint Effects

| Effect | 새 파드 | 기존 파드 |
|:-------|:--------|:---------|
| NoSchedule | 스케줄링 차단 | 영향 없음 |
| PreferNoSchedule | 가능하면 피함 (soft) | 영향 없음 |
| NoExecute | 스케줄링 차단 | 조건 불일치 시 제거(Eviction) |

### 3.4 Toleration 설정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: blue-pod
spec:
  tolerations:
  - key: "app"
    operator: "Equal"
    value: "blue"
    effect: "NoSchedule"
  containers:
  - name: nginx
    image: nginx
```

**Operator 유형:**

```yaml
# Equal: 정확히 일치
tolerations:
- key: "app"
  operator: "Equal"
  value: "blue"
  effect: "NoSchedule"

# Exists: key만 존재하면 됨 (value 불필요)
tolerations:
- key: "app"
  operator: "Exists"
  effect: "NoSchedule"
```

### 3.5 마스터 노드의 기본 Taint

```bash
kubectl describe node master | grep Taint
# Taints: node-role.kubernetes.io/master:NoSchedule
```

마스터 노드에는 기본적으로 Taint가 적용되어 일반 파드가 스케줄링되지 않는다.

---

## 4. Node Selector

### 4.1 기본 사용법

가장 간단한 노드 선택 방법이다.

```bash
# 노드에 라벨 추가
kubectl label nodes node1 size=large
kubectl label nodes node2 hardware=gpu
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processing
spec:
  nodeSelector:
    size: large  # size=large 라벨을 가진 노드에만 배치
  containers:
  - name: processor
    image: data-processor:v1.0
```

### 4.2 한계점

```
❌ OR 조건 불가: "large 또는 medium"
❌ NOT 조건 불가: "small이 아닌 노드"
❌ 복합 조건 표현 제한
```

이러한 한계를 극복하려면 Node Affinity를 사용해야 한다.

---

## 5. Node Affinity

### 5.1 기본 구문

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values:
            - large
            - medium
```

### 5.2 Affinity 타입

| 타입 | 스케줄링 시 | 실행 중 |
|:-----|:-----------|:--------|
| requiredDuringSchedulingIgnoredDuringExecution | 필수 조건 | 무시 |
| preferredDuringSchedulingIgnoredDuringExecution | 선호 조건 | 무시 |

### 5.3 연산자

```yaml
# In: 값 목록 중 하나와 일치
- key: size
  operator: In
  values: ["large", "medium"]

# NotIn: 부정 조건
- key: size
  operator: NotIn
  values: ["small"]

# Exists: 키 존재 여부만 확인
- key: gpu
  operator: Exists

# DoesNotExist: 키가 없는 경우
- key: temporary
  operator: DoesNotExist
```

### 5.4 OR 조건 (nodeSelectorTerms 배열)

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:  # 조건 1: GPU 노드
          - key: hardware
            operator: In
            values: ["gpu"]
        - matchExpressions:  # 조건 2: 고성능 CPU 노드
          - key: cpu
            operator: In
            values: ["high-performance"]
        # 둘 중 하나만 만족하면 됨 (OR)
```

### 5.5 Preferred Affinity (가중치)

```yaml
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100  # 높은 우선순위
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["us-east-1a"]
      - weight: 50   # 낮은 우선순위
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["us-east-1b"]
```

---

## 6. Taints/Tolerations vs Node Affinity

### 6.1 비교

| 메커니즘 | 제어 방향 | 보장 내용 |
|:---------|:---------|:---------|
| Taints/Tolerations | 노드 → 파드 | 노드가 파드를 거부 |
| Node Affinity | 파드 → 노드 | 파드가 노드를 선택 |

### 6.2 완전한 노드 전용화

두 메커니즘을 조합해야 완전한 격리가 가능하다.

```bash
# 1. 노드에 Taint + Label 적용
kubectl taint nodes blue-node color=blue:NoSchedule
kubectl label nodes blue-node color=blue
```

```yaml
# 2. 파드에 Toleration + Affinity 모두 적용
apiVersion: v1
kind: Pod
metadata:
  name: blue-pod
spec:
  tolerations:
  - key: color
    value: blue
    effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: color
            operator: In
            values: ["blue"]
  containers:
  - name: app
    image: nginx
```

```
결과:
✅ blue-pod → blue-node (Affinity로 선택)
✅ 다른 파드 → blue-node 접근 차단 (Taint로 거부)
✅ blue-pod → 다른 노드 방지 (Affinity로 제한)
```

---

## 7. Resource Requests와 Limits

### 7.1 기본 설정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:        # 최소 보장량 (스케줄링 기준)
        cpu: "500m"
        memory: "512Mi"
      limits:          # 최대 사용량
        cpu: "1"
        memory: "1Gi"
```

### 7.2 CPU 단위

```
1 CPU = 1 vCPU (AWS) = 1 Core (GCP/Azure) = 1 Hyperthread
최소값: 1m (0.001 CPU)

표현법:
- 100m = 0.1 CPU
- 500m = 0.5 CPU
- 2 = 2 CPU
```

### 7.3 메모리 단위

```
이진 단위 (권장):
- Ki = 1,024 bytes
- Mi = 1,024 Ki
- Gi = 1,024 Mi

십진 단위:
- K = 1,000 bytes
- M = 1,000 K
- G = 1,000 M
```

### 7.4 Limits 초과 시 동작

| 리소스 | 초과 시 동작 |
|:-------|:------------|
| CPU | Throttling (성능 저하만, 종료 없음) |
| Memory | OOM Kill (컨테이너 종료) |

### 7.5 LimitRange

네임스페이스별 기본값과 제한 설정이다.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: default
spec:
  limits:
  - type: Container
    default:          # 기본 limits
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:   # 기본 requests
      cpu: "100m"
      memory: "128Mi"
    max:              # 최대 허용
      cpu: "2"
      memory: "4Gi"
    min:              # 최소 요구
      cpu: "50m"
      memory: "64Mi"
```

{{< callout type="info" >}}
**LimitRange는 새로 생성되는 파드에만 적용된다.** 기존 파드에는 영향을 주지 않는다.
{{< /callout >}}

### 7.6 ResourceQuota

네임스페이스 전체 리소스 총량 제한이다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: backend-team
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "50"
    limits.memory: "100Gi"
    pods: "50"
```

---

## 8. DaemonSet

### 8.1 개념

모든 노드에 파드 복사본을 하나씩 실행한다.

```
특징:
- 노드 추가 시 → 파드 자동 생성
- 노드 제거 시 → 파드 자동 삭제
- 각 노드당 정확히 1개 파드 보장
```

### 8.2 사용 사례

| 용도 | 예시 |
|:-----|:-----|
| 모니터링 | Prometheus Node Exporter, Datadog Agent |
| 로그 수집 | Fluentd, Fluent Bit |
| 네트워킹 | kube-proxy, CNI 플러그인 (Calico, Weave) |
| 스토리지 | 스토리지 드라이버 |

### 8.3 정의 파일

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: monitoring-daemon
spec:
  selector:
    matchLabels:
      app: monitoring-agent
  template:
    metadata:
      labels:
        app: monitoring-agent
    spec:
      containers:
      - name: agent
        image: monitoring-agent:v1.0
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
```

### 8.4 DaemonSet vs ReplicaSet

| 특징 | DaemonSet | ReplicaSet |
|:-----|:----------|:-----------|
| 배포 방식 | 노드당 1개 | 지정된 개수 |
| 스케줄링 | 모든 노드 자동 | 스케줄러가 결정 |
| 노드 추가 시 | 자동 파드 생성 | 변화 없음 |

---

## 9. Static Pods

### 9.1 개념

kubelet이 API 서버 없이 직접 관리하는 파드다.

```
특징:
- 마스터 노드나 클러스터 없이도 작동
- kubelet이 직접 감시하고 재시작
- Control Plane 컴포넌트 부트스트래핑에 사용
```

### 9.2 설정 방법

```bash
# kubelet 설정에서 manifest 경로 지정
--pod-manifest-path=/etc/kubernetes/manifests

# 또는 config 파일에서 지정
--config=/var/lib/kubelet/config.yaml
```

```yaml
# config.yaml
staticPodPath: /etc/kubernetes/manifests
```

### 9.3 동작

```
manifest 디렉토리 감시:
- 파일 추가 → 파드 생성
- 파일 수정 → 파드 재생성
- 파일 삭제 → 파드 삭제
```

### 9.4 클러스터 환경에서의 특징

| 항목 | 설명 |
|:-----|:-----|
| Mirror Object | API 서버에 읽기 전용 미러 생성 |
| Pod 이름 | 자동으로 노드명 추가 (예: etcd-master) |
| kubectl 조회 | 가능 (읽기만) |
| kubectl 수정/삭제 | 불가능 (파일 직접 수정 필요) |

### 9.5 Static Pod vs DaemonSet

| 구분 | Static Pod | DaemonSet |
|:-----|:-----------|:----------|
| 생성 주체 | kubelet 직접 | DaemonSet Controller |
| API 서버 의존성 | 불필요 | 필요 |
| 용도 | Control Plane 구성 | 모든 노드에 서비스 배포 |

### 9.6 kubeadm 클러스터

kubeadm은 Control Plane 컴포넌트를 Static Pod로 배포한다.

```bash
ls /etc/kubernetes/manifests/
# etcd.yaml
# kube-apiserver.yaml
# kube-controller-manager.yaml
# kube-scheduler.yaml
```

---

## 10. Priority Classes

### 10.1 개념

파드 우선순위를 설정하여 중요한 워크로드가 먼저 스케줄링되도록 한다.

### 10.2 우선순위 값 범위

| 용도 | 범위 |
|:-----|:-----|
| 시스템 컴포넌트 | ~20억 |
| 일반 애플리케이션 | -20억 ~ +10억 |
| 기본값 (미지정 시) | 0 |

### 10.3 PriorityClass 생성

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: "High priority for critical apps"
```

### 10.4 Pod에 적용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: critical-app
spec:
  priorityClassName: high-priority
  containers:
  - name: app
    image: critical-app:v1.0
```

### 10.5 Preemption Policy

| 정책 | 동작 |
|:-----|:-----|
| PreemptLowerPriority (기본) | 낮은 우선순위 파드 제거 후 배치 |
| Never | 기존 파드 유지, 리소스 대기 |

### 10.6 시스템 기본 클래스

```bash
kubectl get priorityclass
# system-cluster-critical  ~20억 (클러스터 핵심)
# system-node-critical     ~20억 (노드 핵심)
```

---

## 11. Multiple Schedulers

### 11.1 커스텀 스케줄러 배포

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-custom-scheduler
  namespace: kube-system
spec:
  containers:
  - name: scheduler
    image: k8s.gcr.io/kube-scheduler:v1.28.0
    command:
    - kube-scheduler
    - --config=/etc/kubernetes/my-scheduler-config.yaml
```

### 11.2 스케줄러 설정

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: my-custom-scheduler
leaderElection:
  leaderElect: false  # 단일 스케줄러일 때
```

### 11.3 Pod에서 스케줄러 지정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  schedulerName: my-custom-scheduler  # 커스텀 스케줄러 사용
  containers:
  - name: nginx
    image: nginx
```

### 11.4 검증

```bash
# 스케줄러 파드 확인
kubectl get pods -n kube-system | grep scheduler

# 이벤트에서 어떤 스케줄러가 처리했는지 확인
kubectl get events -o wide | grep Scheduled
```

---

## 12. Scheduler Profiles

### 12.1 스케줄링 단계

```
1. Scheduling Queue → PrioritySort
2. Filter → NodeResourcesFit, NodeName, NodeUnschedulable
3. Score → NodeResourcesFit, ImageLocality
4. Bind → DefaultBinder
```

### 12.2 Extension Points

```
QueueSort
    ↓
PreFilter → Filter → PostFilter
    ↓
PreScore → Score → Reserve
    ↓
Permit → PreBind → Bind → PostBind
```

### 12.3 다중 프로파일 설정

단일 바이너리로 여러 스케줄링 동작을 정의할 수 있다.

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: default-scheduler
  # 기본 설정

- schedulerName: no-scoring-scheduler
  plugins:
    preScore:
      disabled:
      - name: "*"
    score:
      disabled:
      - name: "*"

- schedulerName: custom-scheduler
  plugins:
    filter:
      disabled:
      - name: TaintToleration
    score:
      enabled:
      - name: MyCustomPlugin
```

---

## 13. Admission Controllers

### 13.1 API 요청 처리 흐름

```
kubectl 요청
    ↓
1. Authentication (인증)
    ↓
2. Authorization (RBAC)
    ↓
3. Admission Controllers ← 추가 검증/수정
    ↓
4. etcd 저장
```

### 13.2 Admission Controller 유형

| 유형 | 기능 | 예시 |
|:-----|:-----|:-----|
| Validating | 요청 검증 및 거부 | NamespaceExists |
| Mutating | 요청 내용 수정 | DefaultStorageClass |
| Both | 검증 + 수정 | NamespaceLifecycle |

### 13.3 실행 순서

```
1. Mutating Admission Controllers (먼저)
    ↓
2. Validating Admission Controllers (나중)
```

### 13.4 주요 Built-in Controllers

| Controller | 기능 |
|:-----------|:-----|
| AlwaysPullImages | 항상 이미지 pull 강제 |
| DefaultStorageClass | PVC에 기본 StorageClass 자동 추가 |
| NamespaceLifecycle | 네임스페이스 생명주기 관리 |
| LimitRanger | LimitRange 정책 적용 |
| ResourceQuota | 리소스 쿼터 적용 |

### 13.5 활성화/비활성화

```yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction,NamespaceAutoProvision
    - --disable-admission-plugins=DefaultTolerationSeconds
```

### 13.6 Webhook Admission Controllers

외부 서버에서 커스텀 로직을 실행할 수 있다.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: pod-policy
webhooks:
- name: pod-policy.example.com
  clientConfig:
    service:
      namespace: default
      name: webhook-service
      path: /validate
    caBundle: <base64-encoded-ca-cert>
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE"]
    resources: ["pods"]
```

---

## 14. 실전 활용

### 14.1 GPU 노드 전용화

```bash
# 노드 설정
kubectl taint nodes gpu-node hardware=gpu:NoSchedule
kubectl label nodes gpu-node hardware=gpu
```

```yaml
# GPU 워크로드 파드
apiVersion: v1
kind: Pod
metadata:
  name: ml-training
spec:
  tolerations:
  - key: hardware
    value: gpu
    effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: hardware
            operator: In
            values: ["gpu"]
  containers:
  - name: tensorflow
    image: tensorflow/tensorflow:latest-gpu
    resources:
      limits:
        nvidia.com/gpu: 1
```

### 14.2 환경별 격리

```yaml
# 프로덕션 전용 파드
apiVersion: v1
kind: Pod
metadata:
  name: prod-app
spec:
  tolerations:
  - key: environment
    value: production
    effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: environment
            operator: In
            values: ["production"]
  containers:
  - name: app
    image: myapp:prod
```

### 14.3 리소스 모니터링

```bash
# 노드별 리소스 사용량
kubectl top nodes

# 파드별 리소스 사용량
kubectl top pods

# 파드 리소스 상세
kubectl describe pod <pod-name>

# 스케줄링 이벤트
kubectl get events --sort-by='.lastTimestamp'
```

---

## 15. 요약

### 스케줄링 메커니즘 비교

| 메커니즘 | 용도 | 제어 방향 |
|:---------|:-----|:---------|
| nodeSelector | 간단한 노드 선택 | 파드 → 노드 |
| Node Affinity | 복잡한 노드 선택 | 파드 → 노드 |
| Taints/Tolerations | 노드 보호 | 노드 → 파드 |
| Priority Classes | 스케줄링 우선순위 | 파드 간 순서 |

### 워크로드 타입별 선택

| 워크로드 | 권장 리소스 |
|:---------|:-----------|
| 단일 실행 파드 | Pod |
| 복제 관리 필요 | Deployment, ReplicaSet |
| 모든 노드 실행 | DaemonSet |
| API 서버 없이 실행 | Static Pod |

### 리소스 관리 계층

| 범위 | 리소스 |
|:-----|:-------|
| 컨테이너 | requests, limits |
| 네임스페이스 기본값 | LimitRange |
| 네임스페이스 총량 | ResourceQuota |

{{< callout type="info" >}}
**핵심 포인트:**
- Node Affinity + Taints/Tolerations 조합으로 완전한 노드 전용화
- requests는 스케줄링 기준, limits는 런타임 제한
- DaemonSet은 노드당 1개, Static Pod는 kubelet 직접 관리
- Admission Controllers로 생성 전 검증/수정 가능
{{< /callout >}}
