---
title: "05. 스케줄링"
weight: 5
---

## 1. 스케줄링 기본 원리

쿠버네티스에서 **스케줄링**은 Pending 상태의 파드에 적합한 노드를 선택해 바인딩하는 과정이다. `kube-scheduler`가 이 일을 담당한다.

### 1.1 스케줄러 결정 흐름

```text
   Pending 파드
       │
       ▼
┌──────────────┐
│  Filtering   │  부적합 노드 제외
│  (Predicate) │
└──────┬───────┘
       │ 후보 노드
       ▼
┌──────────────┐
│   Scoring    │  점수 계산
│  (Priority)  │
└──────┬───────┘
       │ 최고점 선택
       ▼
┌──────────────┐
│   Binding    │  kubelet 실행
└──────────────┘
```

1. 파드 생성 요청 (nodeName 비어 있음)
2. scheduler가 Pending 파드 감지
3. Filtering → Scoring 2단계 평가
4. 최고 점수 노드에 바인딩
5. 해당 노드의 kubelet이 파드 실행

### 1.2 수동 스케줄링

스케줄러를 거치지 않고 직접 노드를 지정하려면 `nodeName`을 쓴다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  nodeName: worker-node-1
  containers:
  - name: nginx
    image: nginx
```

{{< callout type="warning" >}}
`nodeName`은 **파드 생성 시점에만** 지정할 수 있다. 이미 실행 중인 파드의 필드는 변경되지 않으므로, 기존 파드를 다른 노드로 옮기려면 Binding API를 호출하거나 파드를 재생성해야 한다.
{{< /callout >}}

**Binding API 예시**

```bash
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

## 2. Labels와 Selectors

**Label**은 객체에 붙는 키-값 메타데이터, **Selector**는 이를 기준으로 객체를 필터링하는 쿼리다. 스케줄링·서비스·네트워크 정책 등 쿠버네티스 전반에서 선택 기준으로 쓰인다.

### 2.1 Label 부여

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

### 2.2 Selector 조회

```bash
# 단일 조건
kubectl get pods -l app=ecommerce

# 여러 조건 (AND)
kubectl get pods -l app=ecommerce,tier=frontend

# IN / NOT
kubectl get pods -l 'environment in (production,staging)'
kubectl get pods -l 'environment!=development'

# 전체 라벨 표시
kubectl get pods --show-labels
```

### 2.3 ReplicaSet Selector

Selector와 template 라벨이 일치해야 ReplicaSet이 파드를 인식한다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend-rs
  labels:
    app: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: nginx
        image: nginx
```

### 2.4 matchExpressions

복잡한 조건을 표현할 때 쓴다.

```yaml
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
|:---|:---|
| In | 값 목록 중 하나와 일치 |
| NotIn | 값 목록에 없음 |
| Exists | 키 존재 (값 무관) |
| DoesNotExist | 키가 존재하지 않음 |

### 2.5 Annotations

Selector로 쓰이지 않는 정보성 메타데이터. 빌드 정보, 담당자, 도구용 힌트 등을 기록한다.

```yaml
metadata:
  annotations:
    buildVersion: "1.34.2"
    buildDate: "2026-04-01"
    kubernetes.io/created-by: "deployment-controller"
    description: "Main application pod"
```

## 3. Taints와 Tolerations

### 3.1 개념

```text
Taint      : 노드 → "견디지 못하면 오지 마라"
Toleration : 파드 → "나는 이 Taint를 견딘다"

Taint + 일치 Toleration → 배치 가능
Taint + 불일치          → 배치 불가
```

{{< callout type="warning" >}}
**Toleration은 "허락"이지 "배정"이 아니다.** Toleration을 단 파드가 반드시 해당 Taint 노드로 가는 것이 아니라, 갈 수 있게 될 뿐이다. 특정 노드로 **강제**하려면 Node Affinity나 `nodeSelector`를 함께 써야 한다.
{{< /callout >}}

### 3.2 Taint 관리

```bash
# 추가
kubectl taint nodes node1 app=blue:NoSchedule

# 제거 (뒤에 '-')
kubectl taint nodes node1 app=blue:NoSchedule-

# 확인
kubectl describe node node1 | grep Taint
```

### 3.3 Effect 종류

| Effect | 새 파드 | 기존 파드 |
|:---|:---|:---|
| NoSchedule | 차단 | 영향 없음 |
| PreferNoSchedule | 가능하면 회피 | 영향 없음 |
| NoExecute | 차단 | Toleration 없으면 Eviction |

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

**Operator 비교**

```yaml
# Equal: 값까지 정확히 일치
- key: "app"
  operator: "Equal"
  value: "blue"
  effect: "NoSchedule"

# Exists: 키만 존재하면 허용 (value 생략)
- key: "app"
  operator: "Exists"
  effect: "NoSchedule"
```

### 3.5 마스터 노드의 기본 Taint

```bash
kubectl describe node master | grep Taint
# node-role.kubernetes.io/control-plane:NoSchedule
```

컨트롤 플레인 노드에는 기본 Taint가 붙어 일반 파드 배치를 차단한다.

## 4. Node Selector

### 4.1 사용법

가장 단순한 노드 선택 방식.

```bash
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
    size: large
  containers:
  - name: processor
    image: data-processor:v1.0
```

### 4.2 한계

```text
× OR 조건 불가   ("large 또는 medium")
× NOT 조건 불가  ("small이 아닌 노드")
× 복합 조건 불가
```

복잡한 조건이 필요하면 Node Affinity로 전환한다.

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

### 5.2 타입

| 타입 | 스케줄링 | 실행 중 |
|:---|:---|:---|
| requiredDuringSchedulingIgnoredDuringExecution | 필수 | 무시 |
| preferredDuringSchedulingIgnoredDuringExecution | 선호 | 무시 |

`requiredDuringSchedulingRequiredDuringExecution`은 현재 미구현이다.

### 5.3 연산자

```yaml
# In / NotIn / Exists / DoesNotExist / Gt / Lt
- key: size
  operator: In
  values: ["large", "medium"]

- key: gpu
  operator: Exists

- key: temporary
  operator: DoesNotExist
```

### 5.4 OR 조건 (nodeSelectorTerms 배열)

`nodeSelectorTerms`는 OR, `matchExpressions`는 AND로 평가된다.

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: hardware
            operator: In
            values: ["gpu"]
        - matchExpressions:
          - key: cpu
            operator: In
            values: ["high-performance"]
```

### 5.5 Preferred (가중치)

```yaml
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["us-east-1a"]
      - weight: 50
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["us-east-1b"]
```

## 6. 배치 메커니즘 비교

배치 제어에 자주 쓰이는 세 메커니즘을 정리한다.

| 메커니즘 | 제어 방향 | 조건 표현력 | 위반 시 | 주 용도 |
|:---|:---|:---|:---|:---|
| nodeSelector | 파드 → 노드 | 단순 AND | Pending | 간단한 라벨 매칭 |
| Node Affinity | 파드 → 노드 | OR/AND/가중치 | Pending(required) / 감점(preferred) | 복합 조건, 선호 배치 |
| Taints/Tolerations | 노드 → 파드 | 매칭만 | 스케줄 차단/Eviction | 노드 격리, 전용화 |

### 6.1 완전한 노드 전용화

Taint와 Affinity를 **함께** 적용해야 진정한 전용 노드가 된다.

```bash
kubectl taint nodes blue-node color=blue:NoSchedule
kubectl label nodes blue-node color=blue
```

```yaml
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

```text
결과
  blue-pod → blue-node   (Affinity로 선택)
  그 외    → blue-node × (Taint로 거부)
  blue-pod → 다른 노드 × (Affinity로 제한)
```

## 7. Resource Requests와 Limits

### 7.1 기본 설정

```yaml
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:        # 스케줄링 기준
        cpu: "500m"
        memory: "512Mi"
      limits:          # 런타임 상한
        cpu: "1"
        memory: "1Gi"
```

### 7.2 단위

```text
CPU
  1    = 1 vCPU / 1 Core / 1 HT
  1m   = 0.001 CPU  (최소)
  500m = 0.5 CPU

Memory (이진 권장)
  Ki = 1,024 B
  Mi = 1,024 Ki
  Gi = 1,024 Mi
  (십진: K / M / G)
```

### 7.3 Limits 초과 시 동작

| 리소스 | 동작 |
|:---|:---|
| CPU | Throttling (성능 저하, 종료 없음) |
| Memory | OOM Kill (컨테이너 종료) |

### 7.4 LimitRange

네임스페이스 단위로 기본값·최댓값을 설정한다.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: default
spec:
  limits:
  - type: Container
    default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2"
      memory: "4Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
```

{{< callout type="info" >}}
`LimitRange`는 **새로 생성되는 파드**에만 적용된다. 이미 실행 중인 파드에는 영향을 주지 않으므로, 정책 도입 후에는 기존 워크로드를 롤링 업데이트해 재생성해야 한다.
{{< /callout >}}

### 7.5 ResourceQuota

네임스페이스 전체 총량을 제한한다.

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

## 8. DaemonSet

### 8.1 개념

모든 노드(또는 조건을 만족하는 노드)에 파드를 **1개씩** 배포한다.

- 노드 추가 → 파드 자동 생성
- 노드 제거 → 파드 자동 삭제
- 노드당 정확히 1개 보장

### 8.2 용도

| 용도 | 예시 |
|:---|:---|
| 모니터링 | Node Exporter, Datadog Agent |
| 로그 수집 | Fluentd, Fluent Bit |
| 네트워킹 | kube-proxy, Calico, Cilium |
| 스토리지 | CSI 드라이버 |

### 8.3 정의 예

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

### 8.4 DaemonSet vs ReplicaSet vs StatefulSet

{{< callout type="warning" >}}
DaemonSet과 Deployment/ReplicaSet은 **배치 모델이 완전히 다르다.** DaemonSet은 "노드 수 = 파드 수"이므로 `replicas` 필드가 없고, 대신 `nodeSelector`·`tolerations`로 대상 노드를 조절한다. "모든 노드에 배포되지 않네?"라는 혼선은 대부분 컨트롤 플레인 Taint나 라벨 조건을 놓쳐서 생긴다.
{{< /callout >}}

| 항목 | DaemonSet | ReplicaSet | StatefulSet |
|:---|:---|:---|:---|
| 파드 수 | 노드 수 | `replicas` | `replicas` |
| 스케줄링 | 노드당 1개 | scheduler가 선택 | scheduler가 선택 |
| 노드 추가 시 | 자동 생성 | 변화 없음 | 변화 없음 |
| 파드 식별 | 노드 기반 | 임의 | 순서 있는 안정적 ID |

## 9. Static Pods

### 9.1 개념

kubelet이 **API 서버 없이** 파일 시스템에서 직접 관리하는 파드.

- API 서버/컨트롤 플레인 없이도 기동 가능
- kubelet이 직접 재시작 보장
- Control Plane 부트스트래핑에 사용

### 9.2 설정

```bash
# kubelet 실행 인자
--pod-manifest-path=/etc/kubernetes/manifests
# 또는 config 파일
--config=/var/lib/kubelet/config.yaml
```

```yaml
# /var/lib/kubelet/config.yaml
staticPodPath: /etc/kubernetes/manifests
```

### 9.3 동작

```text
manifest 디렉토리 감시
  파일 추가 → 파드 생성
  파일 수정 → 파드 재생성
  파일 삭제 → 파드 삭제
```

### 9.4 Mirror Pod

| 항목 | 설명 |
|:---|:---|
| Mirror Object | API 서버에 읽기 전용 미러 생성 |
| 이름 규칙 | `<pod>-<node>` (예: `etcd-master`) |
| kubectl 조회 | 가능 |
| kubectl 수정/삭제 | 불가 (파일 직접 수정) |

### 9.5 Static Pod vs DaemonSet

| 구분 | Static Pod | DaemonSet |
|:---|:---|:---|
| 생성 주체 | kubelet | DaemonSet Controller |
| API 서버 의존 | 불필요 | 필요 |
| 관리 단위 | 파일 | 리소스 객체 |
| 용도 | Control Plane 구성 | 노드 전역 서비스 |

### 9.6 kubeadm 클러스터

kubeadm은 Control Plane 컴포넌트를 Static Pod로 배포한다.

```bash
ls /etc/kubernetes/manifests/
# etcd.yaml
# kube-apiserver.yaml
# kube-controller-manager.yaml
# kube-scheduler.yaml
```

## 10. Priority Classes

### 10.1 개념

파드에 우선순위 값을 부여해 **중요한 워크로드 우선 배치**와 **선점(Preemption)** 을 가능하게 한다.

### 10.2 값 범위

| 용도 | 범위 |
|:---|:---|
| 시스템 컴포넌트 | ~ 2,000,000,000 |
| 일반 애플리케이션 | -2,000,000,000 ~ 1,000,000,000 |
| 기본값 (미지정) | 0 |

### 10.3 PriorityClass 정의

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

### 10.4 Pod 적용

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
|:---|:---|
| PreemptLowerPriority (기본) | 낮은 우선순위 파드 제거 후 배치 |
| Never | 기존 파드 유지, 리소스 대기 |

### 10.6 시스템 기본 클래스

```bash
kubectl get priorityclass
# system-cluster-critical   (~20억)
# system-node-critical      (~20억)
```

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
    image: registry.k8s.io/kube-scheduler:v1.29.0
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
  leaderElect: false
```

### 11.3 파드에서 지정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  schedulerName: my-custom-scheduler
  containers:
  - name: nginx
    image: nginx
```

### 11.4 검증

```bash
kubectl get pods -n kube-system | grep scheduler
kubectl get events -o wide | grep Scheduled
```

## 12. Scheduler Profiles

### 12.1 스케줄링 단계

```text
Scheduling Queue
      │
      ▼  PrioritySort
   Filter   (NodeResourcesFit 등)
      │
      ▼
   Score    (ImageLocality 등)
      │
      ▼
    Bind    (DefaultBinder)
```

### 12.2 Extension Points

```text
QueueSort
   │
   ▼
PreFilter → Filter → PostFilter
   │
   ▼
PreScore → Score → Reserve
   │
   ▼
Permit → PreBind → Bind → PostBind
```

### 12.3 다중 프로파일

단일 바이너리에서 여러 스케줄러 동작을 정의할 수 있다.

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: default-scheduler
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

## 13. Admission Controllers

### 13.1 요청 처리 흐름

```text
kubectl
   │
   ▼
Authentication
   │
   ▼
Authorization (RBAC)
   │
   ▼
Admission Controllers
   │
   ▼
etcd 저장
```

### 13.2 유형

| 유형 | 기능 | 예시 |
|:---|:---|:---|
| Validating | 검증 및 거부 | NamespaceExists |
| Mutating | 요청 수정 | DefaultStorageClass |
| Both | 검증 + 수정 | NamespaceLifecycle |

### 13.3 실행 순서

```text
Mutating  (먼저, 요청 수정)
   │
   ▼
Validating (나중, 최종 검증)
```

### 13.4 주요 내장 컨트롤러

| Controller | 기능 |
|:---|:---|
| AlwaysPullImages | 이미지 Pull 강제 |
| DefaultStorageClass | PVC 기본 StorageClass 주입 |
| NamespaceLifecycle | 네임스페이스 생명주기 |
| LimitRanger | LimitRange 적용 |
| ResourceQuota | Quota 적용 |

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

### 13.6 Webhook

외부 서버로 위임해 커스텀 검증 로직을 실행한다.

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

## 14. 비용 기반 스케줄링의 현실

클라우드 비용 관점에서는 "가장 저렴한 노드에 최대한 밀어 넣는 것"이 이상적이지만, 실제로는 장애 내성과 성능이 충돌한다.

### 14.1 고려 축

| 축 | 절약 방향 | 충돌 이슈 |
|:---|:---|:---|
| Bin Packing | 고밀도 배치 | 노드 장애 시 영향 반경 확대 |
| Spot 인스턴스 | 비용 70% 절감 | 예고 없는 회수 → 재배치 |
| 가용 영역 분산 | 재해 복구 | 트래픽 cross-AZ 비용 증가 |
| 노드 풀 분리 | 워크로드별 최적화 | 풀마다 유휴 공간 필요 |

### 14.2 실전에서 쓰는 도구

- **Cluster Autoscaler**: Pending 파드에 맞춰 노드 추가/축소
- **Karpenter**: 파드 요구사항 기반으로 **즉시** 적합한 인스턴스 프로비저닝
- **Descheduler**: 밀도·제약 위반을 감지해 파드 재배치
- **Topology Spread Constraints**: AZ/Zone/Host별 균형 강제

```yaml
# 가용 영역별 균형 배치
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: web
```

{{< callout type="info" >}}
Spot 노드에는 `spot=true:NoSchedule` 형태의 Taint를 걸고, 일시 중단이 가능한 워크로드(배치 잡, stateless API)만 Toleration을 달아 올리는 패턴이 일반적이다. 결제·세션 같은 핵심 경로는 on-demand 풀에 남긴다.
{{< /callout >}}

## 15. 실전 활용

### 15.1 GPU 노드 전용화

```bash
kubectl taint nodes gpu-node hardware=gpu:NoSchedule
kubectl label nodes gpu-node hardware=gpu
```

```yaml
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

### 15.2 환경별 격리

```yaml
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

### 15.3 관찰 명령

```bash
# 노드/파드 리소스 사용량
kubectl top nodes
kubectl top pods

# 파드 상세 (Events 포함)
kubectl describe pod <pod-name>

# 최근 스케줄링 이벤트
kubectl get events --sort-by='.lastTimestamp'
```

## 16. 핵심 정리

| 메커니즘 | 용도 | 제어 방향 |
|:---|:---|:---|
| nodeSelector | 단순 노드 선택 | 파드 → 노드 |
| Node Affinity | 복잡한 선택·선호 | 파드 → 노드 |
| Taints/Tolerations | 노드 격리·보호 | 노드 → 파드 |
| Priority Classes | 우선순위·선점 | 파드 간 |
| Topology Spread | 가용 영역 분산 | 파드 간 |

| 워크로드 유형 | 권장 리소스 |
|:---|:---|
| 단일 실행 | Pod |
| 복제 관리 | Deployment / ReplicaSet |
| 노드 전역 | DaemonSet |
| 컨트롤 플레인 | Static Pod |
| 순서·고유 ID | StatefulSet |

| 범위 | 리소스 |
|:---|:---|
| 컨테이너 | requests / limits |
| 네임스페이스 기본값 | LimitRange |
| 네임스페이스 총량 | ResourceQuota |

{{< callout type="info" >}}
**기억할 것**
- `requests`는 스케줄링 기준, `limits`는 런타임 상한
- 완전한 노드 전용화는 **Taint + Affinity** 조합
- DaemonSet은 "노드당 1개", Static Pod는 kubelet이 파일로 직접 관리
- Admission Controller는 etcd 저장 전 마지막 검증·수정 단계
- 비용 최적화는 Spot + Taint/Toleration + Topology Spread 조합으로
{{< /callout >}}
