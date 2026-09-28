---
title: "05. 스케줄링"
date: 2026-04-23
weight: 5
---

[02. 핵심 개념](../02-core-concepts)에서 "어디에 놓는가"는 스케줄러의 일이라고 했고, [04. 워크로드 관리](../04-workloads)에서 파드는 고치지 않고 새로 만든다고 했다. 이 장은 그 새 파드가 어느 노드로 가는지, 그리고 그것을 사람이 어떻게 조종하는지다. 원리는 셋이다. 첫째, **스케줄링은 못 갈 노드를 지우고 남은 노드에 점수를 매기는 두 단계이고, 결과는 파드의 `nodeName` 한 줄이다.** kubelet은 자기 이름이 적힌 파드만 띄우므로, 그 한 줄을 누가 적었는지는 상관없다. 스케줄러가 적어도, 사람이 처음부터 적어도, Binding API로 나중에 적어도 결과는 같다. 둘째, **제약에는 방향이 있다.** 파드가 노드를 고르는 것(nodeSelector, affinity), 노드가 파드를 거르는 것(taint), 파드끼리 서로 밀고 끄는 것(pod affinity, topology spread), 파드 사이의 서열(priority)이 다 다른 장치이고, 노드 하나를 완전히 전용으로 만들려면 두 방향을 합쳐야 한다. 셋째, **자원은 requests로 배치되고 limits로 다스려진다.** 스케줄러는 requests만 보고, 노드 위에서 limits를 지키는 것은 kubelet과 cgroup이며, 그 값들을 채우고 막는 것은 API 서버의 admission 단계다. 이 PC의 Docker Desktop 위 k3s 두 노드에서 이 장의 거의 모든 것을 실제로 돌려봤다. 수동 바인딩, 안티 어피니티로 남는 파드, NoExecute 퇴거, OOM과 CPU 스로틀링, 선점, 두 번째 스케줄러, CEL 정책까지다.

---

## 1. 스케줄링 기본 원리

**스케줄링**은 `nodeName`이 비어 있는 파드에 노드를 골라 적는 일이다. `kube-scheduler`가 API 서버를 지켜보다 그런 파드를 발견하면 아래 순서로 처리한다.

### 1.1 스케줄러 결정 흐름

```text
   Pending 파드 (nodeName 없음)
       │
       ▼
┌──────────────┐
│  Filtering   │ 못 갈 노드 제외
└──────┬───────┘
       │ 후보(feasible) 노드
       ▼
┌──────────────┐
│   Scoring    │ 점수 계산
└──────┬───────┘
       │ 최고점 (동점은 무작위)
       ▼
┌──────────────┐
│   Binding    │ nodeName 기록
└──────┬───────┘
       ▼
   그 노드의 kubelet이 띄운다
```

| 단계 | 하는 일 | 왜 나누나 |
|:-----|:-------|:---------|
| Filtering | 자원 부족, 라벨 불일치, taint, 포트 충돌 같은 이유로 못 가는 노드를 지운다 | 규칙 위반은 점수로 다룰 수 없다. 0점이 아니라 후보에서 빠져야 한다 |
| Scoring | 남은 노드마다 플러그인 점수를 합산한다 | 여러 후보 중 "더 좋은" 곳을 고르는 것은 선호의 문제다 |
| Binding | 파드의 `nodeName`을 채우는 API 호출 | 결정과 기록을 분리해 다른 것도 같은 API로 기록할 수 있다 |

이 PC에서 제약 없는 파드 하나를 만들자 이벤트가 순서대로 남았다.

```text
Scheduled  Successfully assigned
           default/plain to k3s-agent
Pulling → Pulled → Created → Started
```

첫 줄은 스케줄러가, 나머지는 노드의 kubelet이 쓴 것이다. 02장 4절의 파드 생성 순서가 이벤트 네 개로 보인다. Filtering의 결과가 비면 파드는 Pending으로 남고, 스케줄러는 클러스터가 바뀔 때마다 다시 시도한다. 4절과 5절의 Pending 메시지들이 그 기록이다.

### 1.2 수동 스케줄링

스케줄러를 거치지 않으려면 `nodeName`을 직접 적는다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: manual
spec:
  nodeName: k3s-agent
  containers:
  - name: nginx
    image: nginx:1.27-alpine
```

이 PC에서 이 파드의 이벤트는 `Pulling`부터 시작했다. `Scheduled`가 없다. 스케줄러가 한 일이 없기 때문이고, `nodeSelector`나 affinity가 있어도 무시된다. 첫째 원리다. kubelet은 `nodeName`이 자기 이름인 파드를 가져가 띄울 뿐이라 누가 적었는지 묻지 않는다. 그래서 위험도 있다. `nodeName: no-such-node`로 만든 파드는 이벤트 하나 없이 Pending에 머물렀다. 그 이름의 kubelet이 없으니 아무도 읽어 가지 않고, 스케줄러는 이미 노드가 적힌 파드라 손대지 않는다. 자원 검사도 없어서 노드가 꽉 차 있으면 kubelet이 띄우다 실패한다. 클라우드처럼 노드 이름이 자주 바뀌는 환경에서는 쓰지 않는다.

{{< callout type="warning" >}}
`nodeName`은 **파드가 만들어질 때 한 번** 정해진다. 돌고 있는 파드의 노드를 바꾸는 API는 없다. 옮기려면 파드를 지우고 다시 만든다(04장의 "파드는 고치지 않고 바꾼다"). 비어 있는 `nodeName`을 나중에 채우는 길이 하나 있는데 그것이 아래 Binding API고, 스케줄러 자신이 쓰는 문이다.
{{< /callout >}}

**Binding API**

이 PC에서 `schedulerName: nobody`로 만들어 아무 스케줄러도 집어 가지 않는 파드에 직접 Binding을 보냈다.

```json
{
  "apiVersion": "v1",
  "kind": "Binding",
  "metadata": {"name": "bindme"},
  "target": {
    "apiVersion": "v1",
    "kind": "Node",
    "name": "k3s-lab"
  }
}
```

```bash
P=/api/v1/namespaces/default/pods
kubectl create --raw $P/bindme/binding \
  -f binding.json
```

응답은 `"status":"Success","code":201`이었고, Pending이던 파드가 `k3s-lab`에서 Running이 됐다. 이벤트에는 역시 `Scheduled`가 없고 `Pulled`부터다. 스케줄러가 매 파드마다 하는 마지막 동작이 정확히 이 호출이다. 원문의 `curl` 예시는 `kubectl proxy`를 8001 포트에 띄운 뒤 같은 경로로 POST하는 것이고, 위 명령은 kubectl이 인증을 대신 처리해 준다.

---

## 2. Labels와 Selectors

**Label**은 객체에 붙는 키-값이고 **Selector**는 그것으로 객체를 고르는 질의다. 04장에서 ReplicaSet이 파드를 세는 기준이었고, 이 장에서는 파드가 노드를 고르는 기준이며, [07](../07-networking)장의 Service와 [08](../08-security)장의 NetworkPolicy도 같은 장치를 쓴다. 쿠버네티스에 "소속"이라는 개념이 따로 없고 전부 라벨 매칭인 이유는, 그래야 객체 사이에 고정된 참조 없이 느슨하게 묶을 수 있기 때문이다.

### 2.1 Label 부여

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
  labels:
    app: ecommerce
    tier: frontend
    env: prod
    version: v2.1
spec:
  containers:
  - name: nginx
    image: nginx:1.27-alpine
```

### 2.2 Selector 조회

```bash
# 단일 조건
kubectl get pods -l env=prod

# 여러 조건 (AND)
kubectl get pods -l app=demo,env=prod

# 집합 조건
kubectl get pods \
  -l 'env in (prod,staging)'
kubectl get pods -l 'env!=dev'
kubectl get pods -l tier      # 키 존재
kubectl get pods -l '!tier'   # 키 없음

# 라벨 표시
kubectl get pods --show-labels
kubectl get nodes -L size,disk
```

이 PC에서 `env` 라벨이 다른 파드 넷에 위 질의를 던지면 정확히 그 집합만 돌아왔다. `env in (prod,staging)`은 세 개, `env!=dev,app=demo`도 세 개, `!tier`는 tier가 없는 셋. 등호 조건은 AND로 묶이고 집합 조건은 괄호 안에서 OR다. 노드에도 같은 문법을 쓴다는 것이 이 장의 핵심이다. `kubectl get nodes -L size,disk`가 이 PC의 두 노드에 붙인 `size=large`, `disk=ssd`를 열로 보여 줬다.

### 2.3 ReplicaSet Selector

04장에서 본 대로 `selector`와 템플릿 라벨은 같아야 하고, 다르면 API 서버가 거절한다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend-rs
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
        image: nginx:1.27-alpine
```

### 2.4 matchExpressions

`matchLabels`는 등호만 쓴다. 집합 조건은 `matchExpressions`다.

```yaml
selector:
  matchExpressions:
  - key: app
    operator: In
    values: ["frontend", "backend"]
  - key: tier
    operator: NotIn
    values: ["cache"]
  - key: env
    operator: Exists
```

| 연산자 | 뜻 | 왜 필요한가 |
|:------|:---|:-----------|
| In | 값 목록 중 하나 | "large 또는 medium"처럼 OR가 필요할 때 |
| NotIn | 값 목록에 없음 | "cache가 아닌 것" |
| Exists | 키가 있음(값 무관) | 값이 무엇이든 그 종류의 노드면 된다 |
| DoesNotExist | 키가 없음 | "GPU 라벨이 없는 보통 노드" |
| Gt, Lt | 값이 정수로 크다/작다 | 노드 affinity에서만. `cores Gt 8` 같은 조건 |

항목들은 AND로 합쳐진다. `kubectl get -l`의 문법이 이 표현식을 한 줄로 쓴 것이다.

### 2.5 Annotations

Selector로는 쓰이지 않는 정보다. 빌드 번호, 담당자, 도구가 남기는 힌트를 적는다. 04장에서 `kubernetes.io/change-cause`와 `kubectl.kubernetes.io/last-applied-configuration`이 어노테이션이었다. 라벨과 나누는 이유는 라벨은 인덱스가 걸리는 선택 기준이라 짧고 정해진 값이어야 하고, 어노테이션은 길고 구조가 자유로운 메모이기 때문이다.

```yaml
metadata:
  annotations:
    buildVersion: "1.34.2"
    buildDate: "2026-04-01"
    owner: "payments-team"
    description: "Main application pod"
```

---

## 3. Taints와 Tolerations

둘째 원리의 "노드가 파드를 거르는" 방향이다.

### 3.1 개념

```text
Taint      (노드) "못 견디면 오지 마라"
Toleration (파드) "그 taint를 견딘다"

taint 있음 + 일치하는 toleration → 후보
taint 있음 + toleration 없음     → 제외
```

{{< callout type="warning" >}}
**Toleration은 허락이지 배정이 아니다.** 이 PC에서 에이전트 노드에 `team=blue:NoSchedule`을 걸고 두 Deployment를 4개씩 띄웠다. toleration이 없는 쪽은 4개가 전부 서버 노드로 갔고, toleration이 있는 쪽은 **2개씩 두 노드에 나뉘었다.** 견딜 수 있게 됐을 뿐 blue 노드로 가야 할 이유는 없어서다. 특정 노드로 **보내려면** 5절의 affinity나 `nodeSelector`를 함께 쓴다(6.1).
{{< /callout >}}

### 3.2 Taint 관리

```bash
# 추가
kubectl taint nodes node1 \
  team=blue:NoSchedule

# 제거 (뒤에 '-')
kubectl taint nodes node1 \
  team=blue:NoSchedule-

# 확인
kubectl describe node node1 | grep Taint
```

### 3.3 Effect 종류

| Effect | 새 파드 | 이미 도는 파드 | 왜 |
|:-------|:-------|:-------------|:---|
| NoSchedule | 제외 | 영향 없음 | 앞으로 올 것만 막는다. 있는 것을 쫓아내면 서비스가 흔들린다 |
| PreferNoSchedule | 되면 피한다 | 영향 없음 | Filtering이 아니라 Scoring에서 감점. 갈 곳이 없으면 온다 |
| NoExecute | 제외 | toleration 없으면 **퇴거** | 노드 점검이나 장애 때 파드를 비우는 장치. 노드 컨트롤러가 쓴다 |

이 PC에서 `maint=true:NoExecute`를 에이전트에 걸자 1초 안에 그 노드의 toleration 없는 파드들에 `TaintManagerEviction: Marking for deletion` 이벤트가 붙고 대체 파드가 서버 노드에 생겼다. `tolerationSeconds: 15`를 단 파드는 남아 있다가 46초 뒤 사라졌다. 15초를 견딘 뒤 삭제가 시작되고, 기본 종료 유예 30초가 지나야 객체가 없어지기 때문이다. 퇴거는 삭제이고, 삭제는 유예 기간을 지킨다.

### 3.4 Toleration 설정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: blue-pod
spec:
  tolerations:
  - key: "team"
    operator: "Equal"
    value: "blue"
    effect: "NoSchedule"
  containers:
  - name: nginx
    image: nginx:1.27-alpine
```

**Operator 비교**

```yaml
# Equal: 키와 값이 정확히 일치
- key: "team"
  operator: "Equal"
  value: "blue"
  effect: "NoSchedule"

# Exists: 키만 있으면 (value 생략)
- key: "team"
  operator: "Exists"
  effect: "NoSchedule"

# NoExecute를 15초만 견딘다
- key: "maint"
  operator: "Exists"
  effect: "NoExecute"
  tolerationSeconds: 15
```

`key`도 비우고 `operator: Exists`만 두면 모든 taint를 견딘다. 모니터링 에이전트처럼 어디든 가야 하는 파드에 쓴다.

### 3.5 자동으로 붙는 Taint와 Toleration

taint는 사람만 거는 것이 아니다. 노드 컨트롤러가 노드 상태에 따라 `node.kubernetes.io/not-ready`, `unreachable`, `memory-pressure`, `disk-pressure`, `pid-pressure`, `network-unavailable`, `unschedulable`을 자동으로 건다. 그리고 admission 단계의 DefaultTolerationSeconds가 모든 파드에 `not-ready`와 `unreachable`을 **300초** 견디는 toleration을 넣어 준다. 이 PC의 아무 제약 없는 파드에서 그것을 봤다.

```text
node.kubernetes.io/not-ready
  :NoExecute  tolerationSeconds=300
node.kubernetes.io/unreachable
  :NoExecute  tolerationSeconds=300
```

02장과 03장에서 "노드가 죽으면 5분 뒤 파드가 옮겨진다"고 한 것이 이 두 줄이다. 노드가 NotReady가 되면 컨트롤러가 `not-ready:NoExecute`를 걸고, 파드는 300초를 견딘 뒤 퇴거된다. 값을 줄이면 빨리 옮기고, 늘리면 잠깐의 네트워크 끊김에 파드가 쫓겨나지 않는다.

컨트롤 플레인 노드의 taint도 같은 장치다. kubeadm은 `node-role.kubernetes.io/control-plane:NoSchedule`을 걸어 일반 파드를 막고([03](../03-cluster-setup)장 8절), k3s는 걸지 않아 이 PC의 서버 노드 taint는 비어 있었다.

```bash
kubectl describe node cp1 | grep Taint
# node-role.kubernetes.io/control-plane
#   :NoSchedule
```

---

## 4. Node Selector

둘째 원리의 "파드가 노드를 고르는" 방향 중 가장 단순한 것이다.

### 4.1 사용법

```bash
kubectl label nodes k3s-agent size=large
kubectl label nodes k3s-lab disk=ssd
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

이 PC에서 `size: large`인 파드는 그 라벨이 있는 에이전트 노드로 갔고, `size: xlarge`인 파드는 Pending에 남으며 이유를 남겼다.

```text
0/2 nodes are available:
2 node(s) didn't match Pod's node
affinity/selector.
preemption: 0/2 nodes are available:
2 Preemption is not helpful for
scheduling.
```

메시지의 구조가 1절의 두 단계다. 앞부분은 Filtering이 노드 두 개를 왜 지웠는지, 뒷부분은 10절의 선점으로도 자리를 만들 수 없었다는 것이다. 라벨은 자원이 아니라서 다른 파드를 쫓아내도 생기지 않는다.

### 4.2 한계

```text
× OR 조건 불가   ("large 또는 medium")
× NOT 조건 불가  ("small이 아닌 노드")
× 선호 표현 불가 ("되면 ssd로")
```

`nodeSelector`는 등호의 AND만 된다. 나머지는 Node Affinity로 간다.

---

## 5. Node Affinity

`nodeSelector`의 표현력 있는 형태다. 반드시 지켜야 하는 조건(required)과 되면 좋은 조건(preferred)을 나눠 쓰고, 2.4의 연산자를 모두 쓴다.

{{< callout type="info" >}}
**표기 약속.** 필드 이름 `requiredDuringSchedulingIgnoredDuringExecution`과 `preferredDuringSchedulingIgnoredDuringExecution`은 이 블로그의 코드 폭 40자 안에 들어가지 않는다. 이 장의 YAML에서는 `required…Execution`, `preferred…Execution`으로 줄여 쓴다. 실제 파일에는 전체 이름을 적는다.
{{< /callout >}}

### 5.1 기본 구문

```yaml
spec:
  affinity:
    nodeAffinity:
      required…Execution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values:
            - large
            - medium
```

### 5.2 타입

| 타입 | 스케줄링 때 | 실행 중 | 왜 |
|:-----|:----------|:-------|:---|
| `requiredDuringSchedulingIgnoredDuringExecution` | 필수 | 무시 | 노드 라벨이 나중에 바뀌어도 도는 파드는 건드리지 않는다. 쫓아내는 것은 taint의 일이다 |
| `preferredDuringSchedulingIgnoredDuringExecution` | 선호(가중치) | 무시 | Scoring에만 관여한다 |

이름의 뒷부분 `IgnoredDuringExecution`이 "이미 배치된 파드는 무시한다"는 뜻이다. `RequiredDuringExecution`(라벨이 바뀌면 파드를 내보내는 것)은 계획만 있고 구현되지 않았다.

### 5.3 연산자

```yaml
# In / NotIn / Exists / DoesNotExist
# Gt / Lt (값을 정수로 비교)
- key: size
  operator: In
  values: ["large", "medium"]

- key: cores
  operator: Gt
  values: ["8"]

- key: temporary
  operator: DoesNotExist
```

이 PC에서 두 노드에 `cores=16`과 `cores=4`를 붙이고 `cores Gt 8`인 파드를 만들자 16인 노드로 갔다. 값은 문자열로 적지만 비교는 정수로 한다.

### 5.4 OR 조건 (nodeSelectorTerms 배열)

`nodeSelectorTerms`의 항목 사이는 OR, 한 항목 안의 `matchExpressions`는 AND다.

```yaml
spec:
  affinity:
    nodeAffinity:
      required…Execution:
        nodeSelectorTerms:
        - matchExpressions:  # 이거나
          - key: hardware
            operator: In
            values: ["gpu"]
        - matchExpressions:  # 저것
          - key: cpu
            operator: In
            values: ["high-perf"]
```

### 5.5 Preferred (가중치)

```yaml
spec:
  affinity:
    nodeAffinity:
      preferred…Execution:
      - weight: 100
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["ap-northeast-2a"]
      - weight: 50
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["ap-northeast-2b"]
```

가중치는 1~100이고, 노드가 만족하는 항목의 가중치를 더한 값이 그 노드의 이 플러그인 점수가 된다. 다른 플러그인의 점수(자원 여유, 이미지 유무, 분산)와 합쳐지므로 "선호"는 말 그대로 선호다. 이 PC에서 `disk=ssd`를 100으로 선호하는 파드 4개는 전부 ssd 노드로 갔다. 두 노드가 거의 비어 있어 다른 점수가 비슷했기 때문이고, ssd 노드가 꽉 차 있었다면 다른 노드로 갔을 것이다.

### 5.6 Pod Affinity와 Anti-Affinity

둘째 원리의 세 번째 방향, 파드끼리다. "저 파드가 있는 곳에 가라(affinity)" 또는 "저 파드가 있는 곳은 피하라(anti-affinity)"를 `topologyKey`가 가리키는 범위(노드, 존, 리전)로 말한다.

```yaml
spec:
  affinity:
    podAntiAffinity:
      required…Execution:
      - labelSelector:
          matchLabels:
            app: web
        topologyKey:
          kubernetes.io/hostname
```

이 PC에서 위와 같은 필수 안티 어피니티를 건 Deployment를 3개로 띄우자 두 노드에 하나씩 가고 **세 번째는 Pending**에 남았다.

```text
0/2 nodes are available:
2 node(s) didn't match pod
anti-affinity rules.
preemption: ... No preemption victims
found for incoming pod.
```

같은 규칙을 `preferred…Execution`으로 바꾸자 2개와 1개로 나뉘어 셋 다 떴다. 필수는 "노드당 최대 하나"이므로 노드 수보다 많은 복제본은 절대 뜨지 않고, 선호는 될 수 있는 한 나눈다. 복제본을 여러 노드에 흩어 놓아 노드 장애를 견디려는 것이 목적이면 대개 선호가 맞고, 정확한 개수 조절은 다음의 topology spread가 낫다. 문서는 파드 어피니티 계산이 무거워 수백 노드가 넘는 클러스터에서는 권하지 않는다고 적는다. 노드마다 다른 파드들을 다 살펴야 하기 때문이다.

### 5.7 Topology Spread Constraints

"이 라벨의 파드들이 이 범위 사이에서 `maxSkew` 이상 차이 나지 않게 하라"는 규칙이다.

```yaml
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: web
```

이 PC에서 4개는 2와 2로, 5개로 늘리자 3과 2로 갔다. 차이가 1을 넘지 않는다. `DoNotSchedule`은 지킬 수 없으면 Pending이고, `ScheduleAnyway`는 차이를 줄이는 노드를 우선하되 어디든 띄운다. 사실 아무 제약을 걸지 않은 04장의 파드들이 두 노드에 고르게 나뉜 것도 이 장치다. 스케줄러에는 호스트 사이 `maxSkew 3`, 존 사이 `maxSkew 5`의 `ScheduleAnyway` 기본 제약이 들어 있다. 명시적으로 쓰는 것은 그 기본값을 더 조이거나 필수로 바꾸는 일이다. 가용 영역 사이에 나누려면 `topologyKey`를 `topology.kubernetes.io/zone`으로 둔다(14절).

---

## 6. 배치 메커니즘 비교

| 메커니즘 | 방향 | 표현력 | 위반 시 | 왜 이것을 쓰나 |
|:--------|:-----|:------|:-------|:-------------|
| nodeSelector | 파드 → 노드 | 등호 AND | Pending | 조건이 하나면 가장 읽기 쉽다 |
| Node Affinity | 파드 → 노드 | In/NotIn/Exists/Gt/Lt, OR, 가중치 | Pending(required) / 감점(preferred) | 복합 조건과 선호 |
| Taints/Tolerations | 노드 → 파드 | 키·값·effect 일치 | 제외 또는 퇴거 | 노드를 비우거나 보호한다. 파드 쪽 설정을 몰라도 노드에서 막을 수 있다 |
| Pod (Anti-)Affinity | 파드 ↔ 파드 | 라벨 + topologyKey | Pending / 감점 | 같이 두거나 떨어뜨린다 |
| Topology Spread | 파드 ↔ 파드 | maxSkew | Pending / 감점 | 개수를 고르게. 어피니티보다 가볍다 |
| Priority | 파드 간 서열 | 정수 | 낮은 파드 선점 | 자리가 없을 때 누가 양보하나(10절) |

### 6.1 완전한 노드 전용화

taint만 걸면 다른 파드는 못 오지만 내 파드가 다른 노드로 갈 수 있고(3.1의 실측), affinity만 걸면 내 파드는 오지만 다른 파드도 온다. 둘을 **함께** 써야 "그 노드에는 그 파드만, 그 파드는 그 노드에만"이 된다.

```bash
kubectl taint nodes blue-node \
  color=blue:NoSchedule
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
      required…Execution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: color
            operator: In
            values: ["blue"]
  containers:
  - name: app
    image: nginx:1.27-alpine
```

```text
결과
  blue-pod → blue-node  (affinity 선택)
  그 외    → blue-node × (taint가 거름)
  blue-pod → 다른 노드 × (affinity 제한)
```

---

## 7. Resource Requests와 Limits

셋째 원리다. `requests`는 스케줄러가 노드에서 빼 두는 양이고, `limits`는 노드 위에서 kubelet과 cgroup이 지키는 상한이다.

### 7.1 기본 설정

```yaml
spec:
  containers:
  - name: app
    image: nginx:1.27-alpine
    resources:
      requests:        # 스케줄링 기준
        cpu: "500m"
        memory: "512Mi"
      limits:          # 런타임 상한
        cpu: "1"
        memory: "1Gi"
```

스케줄러가 보는 것은 노드의 allocatable에서 그 노드에 있는 파드들의 requests 합을 뺀 값이다. 실제 사용량이 아니다. 이 PC의 서버 노드는 CPU 12개 중 requests 합이 `200m (1%)`, 메모리 `140Mi (0%)`였고, `kubectl describe node`의 `Allocated resources`가 그 표다. 02장에서 CPU 100개를 요청한 파드가 `Insufficient cpu`로 Pending이 된 것도 이 계산이다.

| 값 | 누가 보나 | 무엇에 쓰나 | 왜 둘로 나눴나 |
|:---|:---------|:-----------|:-------------|
| requests | 스케줄러, kube-controller-manager(quota) | 노드 선택, cgroup의 CPU 가중치(`cpu.weight`), QoS | 배치는 약속한 양으로 해야 예측이 된다 |
| limits | kubelet, cgroup | CPU 스로틀링, 메모리 OOM | 한 컨테이너가 노드를 독차지하지 못하게 |

### 7.2 단위

```text
CPU
  1    = 1 vCPU / 1 코어 / 1 HT
  1m   = 0.001 CPU  (최소 단위)
  500m = 0.5 CPU

Memory (이진 접두어 권장)
  Ki = 1,024 B
  Mi = 1,024 Ki
  Gi = 1,024 Mi
  (십진: K / M / G = 1,000 배)
```

`64Mi`는 04장의 Downward API에서 `67108864` 바이트로 나왔다. `64M`이라고 적으면 64,000,000이라 6% 적다.

### 7.3 Limits 초과 시 동작

| 리소스 | 넘으면 | 왜 다른가 | 이 PC 실측 |
|:------|:------|:---------|:----------|
| CPU | **스로틀링**. 느려지지만 죽지 않는다 | CPU는 시간을 나누는 자원이라 기다리게 할 수 있다 | limit 100m인 무한 루프: `kubectl top` 101m, cgroup `cpu.max` = `10000 100000`(100ms마다 10ms), 25초 동안 302번 스로틀, 합 16.2초 |
| Memory | **OOM Kill**. 컨테이너가 죽고 재시작 | 메모리는 이미 쓴 것을 돌려받을 수 없다 | limit 32Mi에 100MB를 쥐자 `OOMKilled`, exit 137, RESTARTS 1, 곧 `CrashLoopBackOff` |

`cpu.max`의 두 숫자가 스로틀링의 실체다. 100ms 주기에 10ms만 쓸 수 있고, 다 쓰면 다음 주기까지 멈춘다. 25초 중 16초를 멈춰 있었으니 무한 루프가 실제로 얻은 CPU는 딱 100m다. exit 137은 128 + 9(SIGKILL)로, 커널의 OOM 킬러가 보낸 신호다.

파드가 뜬 뒤에도 값을 바꿀 수 있게 됐다. In-place resize는 1.33에서 베타(기본 켜짐), 1.35에서 GA다. 이 PC에서 돌고 있는 위 파드의 CPU limit을 300m으로 올렸다.

```bash
kubectl patch pod cpuhog \
  --subresource resize --patch \
  '{"spec":{"containers":[{"name":"c",
    "resources":{
      "limits":{"cpu":"300m"},
      "requests":{"cpu":"300m"}}}]}}'
```

RESTARTS는 0 그대로였고 `cpu.max`가 `30000 100000`으로, `kubectl top`이 294m으로 바뀌었다. 04장의 "파드는 고치지 않는다"의 예외가 자원 필드다. 메모리를 줄이는 것은 컨테이너 재시작이 필요할 수 있어 `resizePolicy`로 정한다.

### 7.4 QoS 클래스

requests와 limits의 조합이 파드의 QoS 클래스를 정하고, 노드가 메모리 압박을 받을 때 kubelet이 누구를 먼저 내보낼지의 순서가 된다. 이 PC에서 세 파드의 `.status.qosClass`를 읽었다.

| 클래스 | 조건 | 압박 때 | 왜 |
|:------|:-----|:-------|:---|
| Guaranteed | 모든 컨테이너의 requests = limits | 마지막에 | 약속한 만큼만 쓰니 예측 가능하다 |
| Burstable | requests가 있고 limits와 다르거나 일부만 | 중간 | 약속보다 더 쓸 수 있다 |
| BestEffort | requests도 limits도 없음 | 먼저 | 아무 약속이 없다 |

### 7.5 LimitRange

네임스페이스 안에서 컨테이너의 기본값과 상하한을 정한다. admission 단계(13절)에서 파드 생성 요청을 **고쳐** 넣고 **막는다.**

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: default
spec:
  limits:
  - type: Container
    default:           # limits 기본값
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:    # requests 기본값
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2"
      memory: "1Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
```

이 PC에서 위 LimitRange가 있는 네임스페이스에 자원을 안 적은 파드를 만들자 `requests cpu 100m, memory 128Mi / limits cpu 500m, memory 256Mi`가 채워져 있었고, CPU limit 3을 적은 파드는 거절됐다.

```text
pods "lr-toobig" is forbidden:
maximum cpu usage per Container is 2,
but limit is 3
```

{{< callout type="info" >}}
`LimitRange`는 **새로 만들어지는 파드**에만 적용된다. admission은 요청이 들어올 때 한 번 일하기 때문이다. 도입한 뒤 기존 워크로드에 먹이려면 롤링 업데이트로 파드를 다시 만든다(04장).
{{< /callout >}}

### 7.6 ResourceQuota

네임스페이스 전체의 총량을 막는다.

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

이 PC에서 `requests.cpu: "1"`, `pods: "5"`의 quota를 둔 네임스페이스에 파드 셋을 넣었다.

| 파드 | requests | 결과 |
|:-----|:--------|:-----|
| rq-a | cpu 600m | 생성. quota 사용량 `600m/1`, 파드 `1/5` |
| rq-b | cpu 600m | 거절. `exceeded quota: rq, requested: requests.cpu=600m, used: requests.cpu=600m, limited: requests.cpu=1` |
| rq-noreq | 없음 | 거절. `must specify requests.cpu` |

마지막 줄이 LimitRange와 ResourceQuota를 함께 쓰는 이유다. 총량을 세려면 모든 파드에 값이 있어야 하므로, quota가 있는 네임스페이스는 값이 없는 파드를 거절한다. LimitRange의 `defaultRequest`가 그 값을 채워 주면 사용자는 아무것도 안 적어도 파드가 뜬다. 자원 요청의 관측과 튜닝은 [09](../09-observability)장 2절과 3절이다.

---

## 8. DaemonSet

### 8.1 개념

모든 노드, 또는 조건을 만족하는 노드에 파드를 **1개씩** 둔다. 노드가 늘면 파드가 생기고 노드가 빠지면 사라진다. 04장 3절에서 워크로드로 봤고, 이 장에서는 그것이 어떻게 노드마다 하나씩 가는지를 본다.

### 8.2 용도

| 용도 | 예시 | 왜 DaemonSet인가 |
|:-----|:-----|:---------------|
| 모니터링 | Node Exporter, Datadog Agent | 노드의 지표는 그 노드에서만 읽힌다 |
| 로그 수집 | Fluentd, Fluent Bit | 노드의 컨테이너 로그 파일을 읽는다 |
| 네트워킹 | kube-proxy, Calico, Cilium | 노드의 iptables나 eBPF를 만진다(03장, 07장) |
| 스토리지 | CSI 노드 플러그인 | 노드에서 볼륨을 마운트한다([06](../06-storage)장 5절) |

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

### 8.4 노드마다 하나가 되는 방법

DaemonSet 컨트롤러는 스케줄러를 우회하지 않는다. 노드마다 파드를 하나 만들면서 그 파드에 **그 노드만 허용하는 node affinity**를 심어 두고, 배치는 기본 스케줄러가 한다. 이 PC의 DaemonSet 파드 하나를 열어 보니 이렇게 들어 있었다.

```text
nodeAffinity.required…Execution
  .nodeSelectorTerms[0].matchFields[0]
  = {key: metadata.name, operator: In,
     values: [k3s-agent]}
```

`matchFields`는 라벨이 아니라 노드 객체의 필드(`metadata.name`)를 보는 조건이다. 그리고 컨트롤러는 3.5의 자동 taint들을 견디는 toleration도 함께 넣는다. 이 PC의 파드에 `not-ready`, `unreachable`(NoExecute), `disk-pressure`, `memory-pressure`, `pid-pressure`, `unschedulable`(NoSchedule)이 들어 있었다. 노드가 아파도 로그 수집기는 남아 있어야 하기 때문이다. `nodeSelector: {size: large}`를 준 DaemonSet은 그 라벨의 노드 한 대에만 떴다.

{{< callout type="warning" >}}
DaemonSet과 Deployment는 **배치 모델이 다르다.** DaemonSet에는 `replicas`가 없고 "노드 수 = 파드 수"다. "모든 노드에 안 뜨네?"는 대개 컨트롤 플레인 taint나 라벨 조건 때문이다. 02장에서 컨트롤 플레인 taint를 견디는 toleration을 따로 준 이유가 그것이다. 자동으로 들어가는 toleration은 노드 **상태** taint들뿐이고, 사람이 건 taint는 직접 견뎌야 한다.
{{< /callout >}}

| 항목 | DaemonSet | ReplicaSet | StatefulSet |
|:-----|:----------|:-----------|:------------|
| 파드 수 | 노드 수 | `replicas` | `replicas` |
| 노드 선택 | 노드마다 하나, affinity로 고정 | 스케줄러 | 스케줄러 |
| 노드 추가 시 | 자동 생성 | 변화 없음 | 변화 없음 |
| 파드 식별 | 노드 | 임의 | 순서 있는 고정 이름(06장) |

---

## 9. Static Pods

### 9.1 개념

kubelet이 **API 서버 없이** 디렉터리의 파일을 보고 직접 띄우는 파드다. 첫째 원리의 극단이다. `nodeName`을 적는 사람도, 스케줄러도, admission도 없이 kubelet이 자기 노드에 그냥 띄운다. 그래서 컨트롤 플레인 자신을 띄우는 데 쓴다. API 서버를 파드로 띄우려면 API 서버 없이 뜨는 파드가 필요하다([03](../03-cluster-setup)장 6절).

### 9.2 설정

kubelet 설정 파일의 `staticPodPath`가 그 디렉터리다. 옛 플래그 `--pod-manifest-path`와 같다.

```yaml
# /var/lib/kubelet/config.yaml
staticPodPath: /etc/kubernetes/manifests
```

이 PC의 k3s는 `/var/lib/rancher/k3s/agent/pod-manifests`였다. 그 디렉터리에 nginx 파드 매니페스트를 넣자 **1초 뒤** API 서버에 `static-web-k3s-lab`이 나타났다.

### 9.3 동작

```text
디렉터리 감시 (inotify + 주기 20초)
  파일 추가 → 파드 생성 (실측 1초)
  파일 수정 → 파드 재생성
  파일 삭제 → 파드 삭제 (실측 3초)
```

### 9.4 Mirror Pod

kubelet은 자기가 띄운 정적 파드를 API 서버에 **미러 파드**로 올려 `kubectl get`에 보이게 한다. 이 PC의 미러 파드는 이름이 `<파드>-<노드>` 규칙대로 `static-web-k3s-lab`이었고, `ownerReferences`가 `Node/k3s-lab`, 어노테이션에 `kubernetes.io/config.mirror` 해시가 있었다.

| 항목 | 설명 | 왜 |
|:-----|:-----|:---|
| 미러 객체 | API 서버의 읽기 전용 사본 | 정적 파드도 `kubectl get`, `logs`로 보고 싶다 |
| 이름 | `<파드>-<노드>` | 같은 파일을 여러 노드에 두면 이름이 겹친다 |
| kubectl delete | 미러만 지워지고 kubelet이 다시 만든다 | 진실은 파일이다. 이 PC에서 지운 뒤 6초가 지나도 Terminating인 채 남아 있었다 |
| 수정·삭제 | 파일을 고치고 지운다 | 파일이 없어지자 3초 뒤 미러도 사라졌다 |

### 9.5 Static Pod vs DaemonSet

| 구분 | Static Pod | DaemonSet |
|:-----|:----------|:----------|
| 만드는 주체 | kubelet | DaemonSet 컨트롤러 + 스케줄러 |
| API 서버 | 없어도 된다 | 필요 |
| 관리 단위 | 노드의 파일 | 클러스터의 객체 |
| admission·quota | 우회 | 적용 |
| 용도 | 컨트롤 플레인 부트스트랩 | 노드 전역 에이전트 |

### 9.6 kubeadm 클러스터

```bash
ls /etc/kubernetes/manifests/
# etcd.yaml
# kube-apiserver.yaml
# kube-controller-manager.yaml
# kube-scheduler.yaml
```

03장에서 kubeadm이 만든 네 파일이다. 03장 14절의 "인증서 갱신 뒤 매니페스트를 잠시 치운다"는 방법이 9.3의 "파일 삭제 → 파드 삭제, 파일 추가 → 파드 생성"이다.

---

## 10. Priority Classes

둘째 원리의 마지막 방향, 파드 사이의 서열이다. 자리가 없을 때 누가 양보하는가.

### 10.1 개념

우선순위가 높은 파드가 갈 곳이 없으면 스케줄러는 낮은 파드를 **선점(preempt)** 해 자리를 만든다. 선점은 낮은 파드를 삭제하는 것이고, 삭제는 종료 유예를 지킨다.

### 10.2 값 범위

| 용도 | 값 | 왜 |
|:-----|:---|:---|
| 사용자 정의 | 10억(1,000,000,000) 이하의 32비트 정수 | 그 위는 시스템용으로 예약 |
| `system-cluster-critical` | 2,000,000,000 | CoreDNS, metrics-server처럼 클러스터에 꼭 필요한 것 |
| `system-node-critical` | 2,000,001,000 | kube-proxy, CNI처럼 노드에 꼭 필요한 것. 클러스터용보다 높다 |
| 미지정 | `globalDefault: true`인 클래스가 있으면 그 값, 없으면 0 | |

이 PC의 `kubectl get priorityclass`에 시스템 클래스 둘이 그 값으로 있었다.

### 10.3 PriorityClass 정의

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: "critical apps"
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

### 10.5 이 PC에서 본 선점

CPU 12개인 노드 둘에 CPU 11개를 요청하는 낮은 우선순위(100) 파드를 하나씩 두어 두 노드를 채운 뒤, 같은 11개를 요청하는 높은 우선순위(1000) 파드를 만들었다.

```text
FailedScheduling  0/2 nodes are
  available: 2 Insufficient cpu.
Preempted  low-...-z6w7l by pod high
  on node k3s-agent
FailedScheduling  ... preemption: not
  eligible due to a terminating pod on
  the nominated node.
Scheduled  assigned default/high
  to k3s-agent           (34초 뒤)
```

첫 시도는 자원 부족으로 실패했고, 스케줄러가 에이전트의 낮은 파드를 희생자로 골라 삭제하며 높은 파드에 `nominatedNodeName`을 적어 두었다. 희생자가 30초 유예를 다 쓰고 사라진 뒤 높은 파드가 그 자리에 떴다. 34초는 그 유예다. 낮은 파드의 Deployment는 대체 파드를 만들었지만 갈 곳이 없어 Pending에 남았다. 선점은 자리를 **바꾸는** 것이지 만드는 것이 아니다.

### 10.6 Preemption Policy

| 정책 | 동작 | 왜 |
|:-----|:-----|:---|
| `PreemptLowerPriority`(기본) | 낮은 파드를 내보내고 들어간다 | 중요한 것이 먼저 돌아야 한다 |
| `Never` | 내보내지 않고 자원이 나기를 기다린다. 대기열에서는 앞에 선다 | 중요하지만 남을 죽일 만큼은 아닌 배치 작업 |

이 PC에서 `preemptionPolicy: Never`인 1000짜리 파드는 같은 상황에서 Pending에 남았고 메시지가 그 이유를 적었다. `preemption: not eligible due to preemptionPolicy=Never`. 선점된 파드에 PodDisruptionBudget이 있어도 선점은 그것을 최선으로만 존중한다는 점도 기억한다.

---

## 11. Multiple Schedulers

`spec.schedulerName`은 "이 파드는 누가 배치하나"다. 기본값 `default-scheduler`가 아닌 이름을 적으면 기본 스케줄러는 그 파드를 건드리지 않는다. 이 PC에서 `schedulerName: nobody`인 파드가 이벤트 하나 없이 Pending에 남아 있던 것이 그 증거다(1.2). 그 이름의 스케줄러를 띄우면 그때 배치된다.

### 11.1 두 번째 스케줄러 배포

kube-scheduler 이미지를 그대로 쓰되 설정으로 이름을 바꾼다. 스케줄러는 API 서버에 파드를 읽고 Binding을 쓸 권한이 필요해서 ServiceAccount와 RBAC이 따라온다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-scheduler-config
  namespace: kube-system
data:
  cfg.yaml: |
    apiVersion:
      kubescheduler.config.k8s.io/v1
    kind: KubeSchedulerConfiguration
    profiles:
    - schedulerName: my-scheduler
    leaderElection:
      leaderElect: false
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-scheduler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels: {app: my-scheduler}
  template:
    metadata:
      labels: {app: my-scheduler}
    spec:
      serviceAccountName: my-scheduler
      containers:
      - name: scheduler
        image: "registry.k8s.io/\
          kube-scheduler:v1.34.1"
        command:
        - kube-scheduler
        - --config=/etc/sched/cfg.yaml
        volumeMounts:
        - name: cfg
          mountPath: /etc/sched
      volumes:
      - name: cfg
        configMap:
          name: my-scheduler-config
```

이미지 이름의 `\`는 YAML 큰따옴표 문자열의 줄 이음이다. ServiceAccount `my-scheduler`에는 ClusterRole `system:kube-scheduler`와 `system:volume-scheduler`를 ClusterRoleBinding으로, `kube-system`의 Role `extension-apiserver-authentication-reader`를 RoleBinding으로 묶는다. 이 PC에서 이 구성이 뜬 뒤 `schedulerName: my-scheduler`인 파드가 곧 Running이 됐다. 03장 10절의 리더 선출을 끄는 이유는 인스턴스가 하나라 선출할 상대가 없기 때문이고, 둘 이상 띄우면 켜서 한 대만 일하게 한다.

### 11.2 파드에서 지정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.27-alpine
```

### 11.3 검증

```bash
kubectl get pods -n kube-system \
  | grep scheduler
kubectl get events \
  --field-selector reason=Scheduled
kubectl logs -n kube-system \
  deploy/my-scheduler
```

스케줄러를 따로 두는 것은 "GPU 파드는 이 알고리즘으로, 나머지는 기본으로"처럼 규칙이 완전히 다를 때다. 같은 바이너리 안에서 규칙만 다르게 하려면 다음 절의 프로파일이 더 가볍다.

---

## 12. Scheduler Framework와 Profiles

1절의 두 단계는 실제로는 플러그인이 끼어드는 확장점의 사슬이다.

### 12.1 확장점

```text
[스케줄링 사이클: 한 파드씩 순서대로]
QueueSort (PrioritySort)
   │
   ▼
PreFilter → Filter → PostFilter(선점)
   │
   ▼
PreScore → Score → NormalizeScore
   │
   ▼
Reserve → Permit
   │
[바인딩 사이클: 병렬]
   ▼
PreBind → Bind → PostBind
```

| 확장점 | 하는 일 | 왜 이 자리인가 |
|:------|:-------|:-------------|
| QueueSort | 대기열 정렬. 기본은 우선순위 순 | 10절의 "대기열에서 앞에 선다"가 여기 |
| Filter | 못 갈 노드 제외 | 1절의 Filtering |
| PostFilter | 후보가 없을 때만. 기본 구현이 선점 | 자리를 만드는 마지막 수단 |
| Score, NormalizeScore | 점수와 0~100 정규화 | 플러그인마다 척도가 달라 맞춘다 |
| Reserve, Permit | 자원 예약, 승인·보류 | 갱 스케줄링처럼 여러 파드를 함께 띄울 때 보류한다 |
| Bind | 1.2의 Binding API 호출 | 결정의 기록 |

스케줄링 사이클은 한 번에 한 파드씩 돌고, 바인딩 사이클은 여러 개가 동시에 돈다. 결정은 순서가 있어야 하고 기록은 기다릴 필요가 없기 때문이다.

### 12.2 기본 플러그인

| 플러그인 | 확장점 | 하는 일 |
|:--------|:------|:-------|
| NodeResourcesFit | PreFilter, Filter, Score | requests가 들어가는가. 점수 전략은 기본 `LeastAllocated` |
| NodeAffinity, NodeName, NodeUnschedulable | Filter(, Score) | 4~5절과 1.2, cordon |
| TaintToleration | Filter, Score | 3절. `PreferNoSchedule`은 Score에서 |
| PodTopologySpread | PreFilter, Filter, Score | 5.7과 그 기본 제약 |
| InterPodAffinity | PreFilter, Filter, Score | 5.6 |
| NodeResourcesBalancedAllocation | Score | CPU와 메모리 사용 비율이 비슷한 노드 선호 |
| ImageLocality | Score | 이미지가 이미 있는 노드 선호 |
| VolumeBinding, VolumeRestrictions, VolumeZone | Filter 등 | 볼륨이 그 노드에서 붙는가(06장) |
| DefaultPreemption | PostFilter | 10절 |
| PrioritySort, DefaultBinder | QueueSort, Bind | |

이 표가 이 장 전체의 목차다. 사람이 쓰는 필드 하나하나가 플러그인 하나에 대응한다. 큰 클러스터에서도 빠른 이유가 하나 더 있다. 스케줄러는 모든 노드를 점수 매기지 않고 `percentageOfNodesToScore`만큼만 본다. 기본값은 100노드에서 50%, 5,000노드에서 10%로 줄어드는 선형식이고 최소 5%다. 후보가 100개 미만이면 전부 본다.

### 12.3 다중 프로파일

바이너리 하나에 이름이 다른 규칙 셋을 여러 개 둘 수 있다. 파드는 `schedulerName`으로 고른다. 모든 프로파일은 같은 QueueSort를 써야 한다. 대기열이 하나이기 때문이다.

```yaml
apiVersion:
  kubescheduler.config.k8s.io/v1
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
- schedulerName: bin-packing
  pluginConfig:
  - name: NodeResourcesFit
    args:
      scoringStrategy:
        type: MostAllocated
        resources:
        - name: cpu
          weight: 1
        - name: memory
          weight: 1
```

세 번째 프로파일이 14절의 빈 패킹이다. 기본 `LeastAllocated`는 비어 있는 노드를 선호해 파드를 흩고, `MostAllocated`는 이미 찬 노드를 선호해 모은다.

---

## 13. Admission Controllers

셋째 원리의 마지막 조각이다. 7.5와 7.6에서 파드 요청을 고치고 막은 것, 3.5에서 toleration을 넣어 준 것이 전부 이 단계였다.

### 13.1 요청 처리 흐름

```text
kubectl / 컨트롤러
   │
   ▼
Authentication   누구인가 (08장)
   │
   ▼
Authorization    할 수 있는가 (RBAC)
   │
   ▼
Admission        고치고(Mutating)
                 검사한다(Validating)
   │
   ▼
etcd 저장
```

### 13.2 유형과 순서

```text
Mutating   (먼저, 요청을 고친다)
   │        기본값 채움, toleration 추가
   ▼
Validating (나중, 최종 검사)
            한도 초과, 정책 위반 거절
```

고치는 것이 먼저인 이유는 검사가 고쳐진 최종 모습을 봐야 하기 때문이다. LimitRange가 requests를 채운 뒤에 ResourceQuota가 그 값을 더해 본다. 어느 단계에서든 하나가 거절하면 요청 전체가 거절되고 etcd에는 아무것도 남지 않는다.

### 13.3 주요 내장 컨트롤러

| 컨트롤러 | 유형 | 하는 일 | 이 장에서 |
|:--------|:-----|:-------|:---------|
| LimitRanger | Mutating + Validating | 기본값 주입, 상하한 검사 | 7.5 |
| ResourceQuota | Validating | 네임스페이스 총량 | 7.6 |
| DefaultTolerationSeconds | Mutating | not-ready, unreachable 300초 toleration | 3.5 |
| TaintNodesByCondition | Mutating | 노드 상태를 taint로 | 3.5 |
| Priority | Mutating + Validating | `priorityClassName`을 값으로 변환, 시스템 클래스 보호 | 10 |
| NodeRestriction | Validating | kubelet이 자기 노드와 파드만 고치게 | 03장의 `--authorization-mode=Node` 짝 |
| PodSecurity | Validating | Pod Security Standards | 08장 7절 |
| ServiceAccount | Mutating | SA 토큰 볼륨 주입 | 08장 5절 |
| DefaultStorageClass | Mutating | PVC에 기본 StorageClass | 06장 4절 |
| NamespaceLifecycle | Validating | 삭제 중인 네임스페이스에 생성 금지 | |
| ValidatingAdmissionPolicy | Validating | CEL 규칙, 웹훅 없는 정책 | 13.6 |

원문 표의 `NamespaceExists`는 deprecated고 `NamespaceLifecycle`이 그 일을 한다. 1.37 문서의 기본 활성 목록은 위 표 대부분에 `CertificateApproval`, `CertificateSigning`, `CertificateSubjectRestriction`, `DefaultIngressClass`, `PersistentVolumeClaimResize`, `RuntimeClass`, `StorageObjectInUseProtection`, `MutatingAdmissionPolicy`, 웹훅 둘을 더한 것이다. 이 PC의 k3s는 여기에 `--enable-admission-plugins=NodeRestriction`을 명시해 뜨고 있었다.

### 13.4 활성화/비활성화

kube-apiserver 플래그다. kubeadm이면 03장의 정적 파드 매니페스트를 고친다.

```text
# kube-apiserver 플래그
--enable-admission-plugins=
    NodeRestriction,PodSecurity
--disable-admission-plugins=
    DefaultTolerationSeconds
```

### 13.5 Webhook

내장 컨트롤러로 표현할 수 없는 규칙은 외부 서버에 묻는다. API 서버가 요청을 HTTP로 보내고 허용·거절 또는 수정안을 받는다.

```yaml
apiVersion:
  admissionregistration.k8s.io/v1
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
    caBundle: <base64 CA>
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE"]
    resources: ["pods"]
  admissionReviewVersions: ["v1"]
  sideEffects: None
```

웹훅은 강력하지만 그 서버가 죽으면 파드 생성이 막히거나(`failurePolicy: Fail`) 정책이 뚫린다(`Ignore`). 그래서 서버 없이 규칙만 적는 방법이 생겼다.

### 13.6 ValidatingAdmissionPolicy (CEL)

1.30에서 GA가 된 방식이다. 규칙을 CEL 표현식으로 API 서버 안에서 평가하고, 바인딩으로 적용 범위를 정한다. 이 PC에서 "파드에 `team` 라벨이 있어야 한다"를 특정 네임스페이스에 걸었다.

```yaml
apiVersion:
  admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-team-label
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE"]
      resources: ["pods"]
  validations:
  - expression: >-
      has(object.metadata.labels) &&
      'team' in object.metadata.labels
    message: "team label required"
---
apiVersion:
  admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: require-team-label
spec:
  policyName: require-team-label
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        policy: team-label
```

라벨 없는 파드는 이렇게 거절됐고, 라벨이 있는 파드는 만들어졌다.

```text
The pods "no-team" is invalid:
ValidatingAdmissionPolicy
'require-team-label' with binding
'require-team-label' denied request:
pods must carry a team label
```

수정 쪽의 짝인 MutatingAdmissionPolicy는 1.34에서 베타(기본 꺼짐), 1.36에서 GA다. 정책 엔진(Kyverno, Gatekeeper)이 웹훅으로 하던 일의 상당 부분이 이 둘로 내장되고 있다.

---

## 14. 비용 기반 스케줄링의 현실

클라우드 비용만 보면 "가장 싼 노드에 최대한 밀어 넣는 것"이 답이지만, 장애 내성과 성능이 그것과 충돌한다.

### 14.1 고려 축

| 축 | 절약 방향 | 충돌 | 왜 충돌하나 |
|:---|:---------|:-----|:-----------|
| Bin Packing | 고밀도 배치(`MostAllocated`, 12.3) | 노드 하나가 죽을 때 영향 범위 | 모아 두면 비우기 쉽지만 한 번에 많이 죽는다 |
| Spot 인스턴스 | 요금 대폭 절감 | 예고 없는 회수 | 회수는 노드가 사라지는 것이라 파드가 다시 배치돼야 한다 |
| 가용 영역 분산 | 재해 복구 | 영역 간 트래픽 요금 | 07장의 Service는 영역을 가리지 않고 파드를 고른다 |
| 노드 풀 분리 | 워크로드별 최적화 | 풀마다 남는 자리 | 풀이 많을수록 빈 조각도 많다 |

### 14.2 실전에서 쓰는 도구

- **Cluster Autoscaler**: Pending 파드가 생기면 노드를 추가하고, 비면 뺀다. 이 장의 `Insufficient cpu`가 그 신호다([09](../09-observability)장 6절).
- **Karpenter**: 파드의 requests와 제약을 읽어 맞는 인스턴스 종류를 **바로** 만든다. 노드 풀을 미리 짜지 않는다.
- **Descheduler**: 시간이 지나 깨진 균형이나 제약 위반을 찾아 파드를 지운다. 스케줄러는 새 파드만 보고 이미 배치된 것을 옮기지 않으므로(5.2의 `IgnoredDuringExecution`) 누군가 지워 줘야 다시 배치된다.
- **Topology Spread Constraints**: 5.7. 영역 사이 균형을 필수로 건다.

```yaml
# 가용 영역별 균형 배치
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey:
      topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: web
```

{{< callout type="info" >}}
Spot 노드에는 `spot=true:NoSchedule` taint를 걸고, 중단을 견디는 워크로드(배치 Job, 상태 없는 API)에만 toleration을 달아 올리는 것이 일반적인 패턴이다. 결제나 세션처럼 끊기면 안 되는 경로는 on-demand 풀에 남긴다. 3절의 "toleration은 허락"이 여기서 정확히 원하는 동작이다. 견디는 파드는 spot에도 갈 수 있고 on-demand에도 갈 수 있다.
{{< /callout >}}

---

## 15. 실전 활용

### 15.1 GPU 노드 전용화

6.1의 조합에 확장 자원을 더한 것이다. `nvidia.com/gpu`는 디바이스 플러그인이 노드에 등록하는 자원이라 requests와 limits가 같아야 하고, 스케줄러는 그것도 7절의 CPU처럼 센다.

```bash
kubectl taint nodes gpu-node \
  hardware=gpu:NoSchedule
kubectl label nodes gpu-node \
  hardware=gpu
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
      required…Execution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: hardware
            operator: In
            values: ["gpu"]
  containers:
  - name: trainer
    image: ml-training:gpu
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
      required…Execution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: environment
            operator: In
            values: ["production"]
  containers:
  - name: app
    image: myapp:prod
```

네임스페이스가 API 수준의 격리라면([02](../02-core-concepts)장 9절), 이것은 노드 수준의 격리다. 운영 파드와 개발 파드가 같은 커널을 나누지 않게 하려면 이 방법밖에 없다.

### 15.3 관찰 명령

```bash
# 노드/파드 실제 사용량 (metrics-server)
kubectl top nodes
kubectl top pods

# 노드의 requests 합계와 taint
kubectl describe node <node> \
  | grep -A6 -E 'Taints|Allocated'

# 파드가 왜 Pending인가
kubectl describe pod <pod>
kubectl get events \
  --field-selector \
    reason=FailedScheduling

# 우선순위와 지명 노드
kubectl get pods -o wide
```

이 PC의 `kubectl top nodes`는 서버 노드 `211m 1% / 576Mi 3%`, 에이전트 `68m 0% / 153Mi 0%`였다. 실제 사용량이고, 스케줄러가 보는 requests 합계(7.1의 `200m`)와는 다른 숫자다. Pending의 원인은 `FailedScheduling` 이벤트 메시지가 4절과 5절의 형식으로 알려 준다. `kubectl get pods -o wide`의 `NOMINATED NODE` 열은 10절의 선점이 진행 중인 파드에 채워진다.

---

## 핵심 정리

| 메커니즘 | 용도 | 방향 | 왜 |
|:--------|:-----|:-----|:---|
| Filtering → Scoring → Binding | 스케줄러의 결정 | | 규칙은 거르고 선호는 점수로. 결과는 `nodeName` 한 줄 |
| nodeName / Binding API | 스케줄러 우회 | 사람 → 파드 | kubelet은 누가 적었는지 묻지 않는다 |
| nodeSelector | 단순 노드 선택 | 파드 → 노드 | 등호 AND만 |
| Node Affinity | 복합 조건, 선호 | 파드 → 노드 | OR, Gt/Lt, 가중치 1~100 |
| Taints/Tolerations | 노드 보호, 비우기 | 노드 → 파드 | toleration은 허락. NoExecute는 퇴거(유예 30초) |
| Pod Anti-Affinity, Topology Spread | 흩기, 모으기 | 파드 ↔ 파드 | 필수 안티 어피니티는 노드 수를 넘지 못한다 |
| Priority | 자리 양보 | 파드 간 | 선점은 삭제라 유예를 기다린다. 이 PC에서 34초 |
| Admission | 요청 고치고 검사 | API 서버 | LimitRange, Quota, toleration 주입, CEL 정책 |

| 워크로드 유형 | 권장 리소스 | 왜 |
|:-----------|:-----------|:---|
| 단일 실행 | Pod | 죽으면 끝(04장) |
| 복제 관리 | Deployment | 템플릿 교체(04장) |
| 노드 전역 | DaemonSet | 노드마다 하나, 자동 toleration |
| 컨트롤 플레인 | Static Pod | API 서버 없이 뜬다 |
| 순서·고유 ID | StatefulSet | 06장 |

| 범위 | 리소스 | 왜 |
|:-----|:------|:---|
| 컨테이너 | requests / limits | 배치 기준 / 런타임 상한 |
| 네임스페이스 기본값과 상하한 | LimitRange | 값이 없는 파드에 채우고 큰 파드를 막는다 |
| 네임스페이스 총량 | ResourceQuota | 팀 단위 예산. LimitRange와 함께 |

{{< callout type="warning" >}}
**검증하지 못한 것**
- 모든 실측은 노드 둘, CPU 12개짜리 k3s에서 했다. 노드가 수백 대일 때의 어피니티 계산 비용, `percentageOfNodesToScore`의 효과, 존 단위 topology spread는 노드 라벨이 없어 확인하지 못했다.
- `PreferNoSchedule`의 감점 크기, preferred affinity의 가중치가 다른 점수와 합쳐지는 비율은 문서 서술에 따랐다.
- 정적 파드의 `kubectl delete` 뒤 재생성은 6초 안에 관찰되지 않았고(Terminating으로 남아 있었다), 문서의 "kubelet이 다시 만든다"는 서술로 대신했다.
- Spot 회수, Karpenter, Descheduler, GPU 디바이스 플러그인은 이 PC에서 돌릴 수 없어 문서 기준이다.
- In-place resize는 1.34 베타(기본 켜짐)에서 CPU만 확인했고 메모리 축소와 `resizePolicy`는 시험하지 않았다.
{{< /callout >}}

{{< callout type="info" >}}
**용어 정리**
- **Filtering / Scoring**: 못 갈 노드를 지우는 단계 / 남은 노드에 점수를 매기는 단계
- **Binding**: 파드의 `nodeName`을 채우는 API. 스케줄러의 마지막 동작
- **nodeSelector / Node Affinity**: 파드가 노드 라벨을 고르는 조건. 후자가 표현력이 크다
- **Taint / Toleration**: 노드가 거르는 표시 / 파드가 견딘다는 선언. `NoSchedule`, `PreferNoSchedule`, `NoExecute`
- **tolerationSeconds**: NoExecute를 견디는 시간. 기본 toleration은 300초
- **Pod Affinity / Anti-Affinity**: 다른 파드가 있는 범위(`topologyKey`)로 가거나 피하는 조건
- **Topology Spread**: 범위 사이의 파드 수 차이를 `maxSkew` 안으로
- **requests / limits**: 배치 기준 / 런타임 상한. 초과는 CPU 스로틀링, 메모리 OOM Kill
- **QoS 클래스**: Guaranteed, Burstable, BestEffort. 메모리 압박 때 퇴거 순서
- **LimitRange / ResourceQuota**: 네임스페이스의 기본값과 상하한 / 총량
- **Static Pod / Mirror Pod**: kubelet이 파일로 띄우는 파드 / 그것의 API 서버 사본
- **PriorityClass / Preemption**: 파드의 서열 / 낮은 파드를 내보내 자리를 만드는 것
- **Scheduling Framework**: PreFilter부터 PostBind까지의 확장점 사슬. 필드마다 플러그인 하나
- **Admission Controller**: 인증·인가 뒤, 저장 전에 요청을 고치고 검사하는 단계
- **ValidatingAdmissionPolicy**: 웹훅 서버 없이 CEL로 적는 admission 규칙
{{< /callout >}}
