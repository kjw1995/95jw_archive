---
title: "09. 관측성"
date: 2026-04-23
weight: 9
---

[05. 스케줄링](../05-scheduling) 7절에서 requests와 limits, LimitRange와 ResourceQuota를 봤고 "자원 요청의 관측과 튜닝"을 이 장으로 미뤘다. [04. 워크로드 관리](../04-workloads) 12절은 `kubectl autoscale` 한 줄로 HPA를 만들고 상세 설정과 메트릭 종류를 이 장으로 넘겼고, [01. 입문](../01-introduction) 9절은 HPA가 보는 측정값이 어디서 오는지를 물었다. [08. 보안](../08-security)이 클러스터에 들어오는 요청을 다뤘다면, 이 장은 클러스터가 밖으로 내는 신호를 다룬다. 원리는 셋이다. 첫째, **클러스터는 답을 먼저 말하지 않는다. 메트릭, 로그, 트레이스 세 신호를 밖으로 꺼내야 안을 볼 수 있다.** 쿠버네티스가 내장한 것은 kubelet의 리소스 메트릭, 컨테이너의 표준 출력을 받아 적은 노드의 로그 파일, 그리고 이벤트뿐이고 나머지는 그 위에 얹는다. 둘째, **자원은 requests로 약속하고 limits로 자른다.** 스케줄러는 requests만 보고 자리를 정하며, 커널은 limits로 CPU를 조이고 메모리를 죽인다. QoS 클래스와 축출 순서가 이 약속에서 나오고, LimitRange와 ResourceQuota가 약속을 강제한다. 셋째, **오토스케일링은 측정값으로 개수와 크기와 노드 수를 대신 적는 컨트롤러다.** HPA는 `replicas`를, VPA는 `resources`를, Cluster Autoscaler와 Karpenter는 노드를 적고, 셋 다 Metrics API에서 시작한다.

---

## 1. 관측성 3요소

관측성(Observability)은 시스템 밖으로 나온 신호로 안의 상태를 추론하는 능력이다. 쿠버네티스에서는 메트릭, 로그, 트레이스 세 축으로 구성한다.

```text
┌──────────────────────────────┐
│        Observability         │
├──────────┬──────────┬────────┤
│  Metrics │   Logs   │ Traces │
│   (수치)  │  (텍스트) │ (요청) │
└────┬─────┴─────┬────┴───┬────┘
     ▼           ▼        ▼
  경보·대시보드  검색·분석  성능 추적
```

| 신호 | 모양 | 쿠버네티스가 내장한 것 | 위에 얹는 것 | 왜 셋인가 |
|:-----|:----|:----------------|:----------|:-------|
| 메트릭 (Metrics) | 시각마다의 숫자. 시계열 | kubelet의 `/metrics/resource`, 컴포넌트마다 있는 `/metrics`, Metrics API | Metrics Server(4절), Prometheus(10절) | 숫자라 집계와 경보가 싸다. "CPU가 80%다"는 알지만 왜인지는 모른다 |
| 로그 (Logs) | 사건마다의 한 줄 | 컨테이너의 stdout·stderr를 노드 파일로 (7절) | Fluent Bit, Alloy, Loki, Elasticsearch(8절) | 원인이 적혀 있다. 대신 양이 많고 검색이 비싸다 |
| 트레이스 (Traces) | 요청 하나가 지나간 경로와 구간별 시간 | kube-apiserver(베타)와 kubelet(1.34 GA)이 OTLP로 내보내는 스팬 | OpenTelemetry Collector, Jaeger, Tempo | 서비스 여럿을 지나는 요청의 어디가 느린지는 트레이스만 안다 |
| 이벤트 (Events) | 오브젝트에 일어난 일 | API 서버가 저장하는 Event 오브젝트 (9절) | | 스케줄 실패, 이미지 풀 실패, OOM 같은 "쿠버네티스가 한 일"의 기록 |

첫째 원리다. 클러스터는 세 신호를 조금씩 내장하고 있을 뿐이다. kubelet은 컨테이너의 CPU·메모리를 15초마다 재고, 컨테이너 런타임은 stdout을 파일로 받아 적고, API 서버는 컨트롤러들이 남긴 이벤트를 한 시간 동안 보관한다. 이 셋으로 `kubectl top`, `kubectl logs`, `kubectl describe`가 돌아가고, 여기까지가 "설치하면 있는 것"이다. 히스토리, 검색, 경보, 대시보드는 전부 그 위에 얹는 물건이고, 얹지 않으면 없다.

{{< callout type="info" >}}
**모니터링 vs 관측성.** 모니터링은 알고 있는 문제를 감시한다. "CPU 80%를 넘으면 알려라." 관측성은 모르던 문제를 찾아낸다. "이 요청은 왜 느렸나." 앞의 것은 메트릭과 경보로 충분하고, 뒤의 것은 로그와 트레이스가 있어야 한다. 두 개념은 배타적이지 않고, 경보가 울린 뒤 로그와 트레이스로 파고드는 순서로 같이 쓴다.
{{< /callout >}}

---

## 2. 리소스 requests와 limits

### 2.1 약속과 상한

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        cpu: "500m"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "512Mi"
```

| 구분 | requests | limits | 왜 둘인가 |
|:-----|:--------|:------|:-------|
| 뜻 | 이만큼은 준다는 약속 | 이 이상은 못 쓴다는 상한 | 약속은 배치를 위해, 상한은 이웃을 지키기 위해 |
| 누가 보나 | 스케줄러. 노드의 남은 양에서 requests를 뺀다 | 커널. cgroup에 적힌다 | 스케줄러는 실제 사용량을 보지 않는다. requests의 합이 노드 용량을 넘지 않게 할 뿐이다 |
| 초과하면 | 초과라는 개념이 없다. 더 쓸 수 있다 | CPU는 조이고 메모리는 죽인다 (2.2절) | |
| 안 적으면 | limits가 있으면 limits와 같게, 둘 다 없으면 0 | 없음. 노드가 허락하는 만큼 | 0이면 어느 노드에든 들어가고, 압박이 오면 가장 먼저 쫓겨난다 (2.3절) |
| 단위 | CPU `m`(밀리코어, `0.5` = `500m`), 메모리 `Mi`·`Gi`(2진), `M`·`G`(10진) | 같다 | `1Gi`는 1,073,741,824바이트, `1G`는 1,000,000,000바이트다 |

둘째 원리다. requests는 스케줄러에게 하는 약속이고, limits는 커널에게 주는 상한이다. [05](../05-scheduling)장 1.1절의 스케줄러는 노드의 할당 가능량에서 그 노드에 있는 파드들의 requests 합을 뺀 값이 새 파드의 requests보다 크면 후보로 삼는다. 실제 사용량은 안 본다. 그래서 requests를 실제보다 크게 적으면 노드가 놀면서도 `Insufficient cpu`가 나고, 작게 적으면 파드가 몰려 서로 조인다. limits는 그 파드가 아무리 원해도 넘지 못하는 벽이라, 하나가 폭주해도 옆 파드의 몫은 남는다. 관측이 필요한 이유가 여기 있다. 약속을 얼마로 적을지는 실제 사용량을 봐야 알 수 있고, 4절의 `kubectl top`과 6절의 VPA가 그 값을 준다.

### 2.2 CPU는 조이고 메모리는 죽인다

```text
CPU limit 1 (cgroup cpu.max)
100ms마다 100ms어치만 허락
├──────┤▓▓▓▓▓▓▓▓│▁▁▁│▓▓▓▓▓▓│▁▁▁▁│
        쓴다    막힘  쓴다   막힘
        → 느려질 뿐 죽지 않는다

memory limit 512Mi (memory.max)
사용량 ──▶ 512Mi 도달 ──▶ OOM kill
        exit 137, 컨테이너 재시작
```

| 자원 | limits를 넘으면 | 겉으로 보이는 것 | 왜 다르게 다루나 |
|:-----|:-------------|:-------------|:------------|
| CPU | CFS 쿼터가 조인다. 100ms 주기마다 limit만큼만 실행하고 나머지는 대기 | 지연이 늘어난다. `container_cpu_cfs_throttled_seconds_total`이 오른다 | CPU는 시간이라 나눠 줄 수 있다. 잠깐 못 쓰게 해도 데이터는 안 깨진다 |
| 메모리 | 커널 OOM killer가 컨테이너 안 프로세스를 죽인다 | 종료 코드 137, `OOMKilled`, 재시작 횟수 증가 | 메모리는 이미 쓴 것을 뺏을 수 없다. 죽이는 것 말고 선택지가 없다 |

메모리 limits는 반응형이다. 커널이 압박을 느낄 때 죽이므로 잠깐 넘는 순간에 바로 죽지는 않을 수 있다. 반대로 limits 안이어도 노드 전체가 모자라면 2.3절의 축출로 쫓겨난다. CPU limits는 다르게 골칫거리다. 요청이 몰리는 순간마다 100ms 안에서 조여서 지연이 튀므로, 지연에 민감한 서비스는 CPU limits를 두지 않고 requests만 정확히 적는 운영도 많다. 이 조임과 죽임은 cgroup v2의 `cpu.max`, `memory.max`로 구현되고, cgroup v1은 1.31부터 유지보수 모드다.

### 2.3 QoS 클래스와 축출

| 클래스 | 조건 | 노드가 모자랄 때 | 왜 |
|:-----|:----|:------------|:---|
| Guaranteed | 모든 컨테이너가 CPU·메모리 requests = limits | 마지막에 쫓겨난다 | 약속한 만큼만 쓰니 남의 몫을 침범할 수 없다 |
| Burstable | 하나라도 requests나 limits가 있고 Guaranteed는 아님 | requests를 넘게 쓰고 있으면 먼저, 안이면 나중에 | 약속보다 더 쓰는 순간이 문제다 |
| BestEffort | 어느 컨테이너에도 requests·limits가 없음 | 가장 먼저 | 약속이 0이라 어떤 사용량도 약속 초과다 |

kubelet은 노드의 `memory.available`이 100Mi 아래로, 디스크(`nodefs.available`)가 10% 아래로, 이미지 파일 시스템이 15% 아래로 내려가면 파드를 골라 쫓아낸다. 고르는 순서는 클래스 이름이 아니라 세 가지 기준이다. 사용량이 requests를 넘는가, 파드의 우선순위([05](../05-scheduling)장 10절), 그리고 requests 대비 사용량이다. BestEffort는 requests가 0이라 자동으로 첫째 줄에 서고, Guaranteed는 requests = limits라 넘을 수가 없어 마지막 줄에 선다. 쫓겨난 파드는 `Failed` 단계에 `Evicted` 이유로 남고, Deployment 뒤의 파드면 컨트롤러가 다른 노드에 다시 만든다. 축출은 파드의 limits가 아니라 노드의 남은 양이 기준이므로, limits 안에서 얌전히 쓰던 파드도 이웃이 먹어 치우면 쫓겨날 수 있다.

{{< callout type="warning" >}}
**requests가 없으면 BestEffort다.** 자원을 아예 적지 않은 파드는 어느 노드에든 들어가고, 노드가 모자라는 순간 첫째로 쫓겨난다. 프로덕션에서는 requests를 반드시 적고, 3절의 LimitRange로 안 적은 파드에 기본값을 채운다. Guaranteed가 필요한 것은 지연이 튀면 안 되는 서비스와, 정수 CPU를 통째로 받는 static CPU 관리 정책을 쓰는 파드 정도다. 대부분은 requests를 정확히 적은 Burstable로 충분하다.
{{< /callout >}}

### 2.4 제자리 크기 조정

```bash
kubectl patch pod web \
  --subresource resize \
  -p '{"spec":{"containers":[{
    "name":"app","resources":{
    "requests":{"cpu":"1"},
    "limits":{"cpu":"2"}}}]}}'
```

| 항목 | 동작 | 왜 |
|:-----|:----|:---|
| 제자리 조정 (1.35 GA) | 파드를 다시 만들지 않고 `resources`를 바꾼다. `resize` 서브리소스로만 | 지금까지 크기를 바꾸려면 파드를 죽였다 죽여야 했다. 6절의 VPA가 이것을 쓴다 |
| `resizePolicy` | 컨테이너마다 `NotRequired`(재시작 없이) 또는 `RestartContainer` | CPU는 재시작 없이 되고, 메모리는 프로그램이 힙 크기를 시작 때 정하는 경우가 많아 재시작이 필요할 수 있다 |
| 못 하는 것 | 메모리 limits 줄이기, QoS 클래스가 바뀌는 변경, 노드에 없는 양 | 이미 쓴 메모리는 못 뺏고, 클래스는 파드의 축출 위치라 중간에 못 바꾼다 |
| 상태 | `PodResizePending`(Infeasible, Deferred), `PodResizeInProgress` 조건 | 노드에 자리가 없으면 대기하고, 스케줄러가 낮은 우선순위 파드를 비켜 주는 선점은 1.37 알파 |
| 파드 단위 자원 (1.34 베타) | `spec.resources`에 파드 전체의 requests·limits | 사이드카 여럿의 합을 한 번에 적고, 컨테이너끼리 남는 몫을 나눠 쓴다 |

---

## 3. LimitRange와 ResourceQuota

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: dev
spec:
  limits:
  - type: Container
    max:
      cpu: "2"
      memory: "2Gi"
    min:
      cpu: "100m"
      memory: "64Mi"
    default:            # limits 기본값
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:   # requests 기본값
      cpu: "200m"
      memory: "256Mi"
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: dev
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    pods: "50"
    persistentvolumeclaims: "10"
    count/deployments.apps: "20"
```

| 항목 | LimitRange | ResourceQuota | 왜 둘 다 필요한가 |
|:-----|:----------|:-------------|:-------------|
| 대상 | 컨테이너·파드·PVC 하나하나 | 네임스페이스의 총량 | 하나의 극단값과 전체의 합은 다른 문제다 |
| 하는 일 | 최소·최대를 검사하고, 안 적은 값을 채운다 | requests·limits의 합, 오브젝트 개수의 상한 | 총량을 세려면 모든 파드에 값이 있어야 한다 |
| 누가 | 어드미션의 LimitRanger (Mutating + Validating) | 어드미션의 ResourceQuota (Validating) | 둘 다 [05](../05-scheduling)장 13.3절의 어드미션 컨트롤러다. 고치는 것이 먼저라 LimitRange가 채운 값을 Quota가 센다 |
| 넘으면 | 파드 생성 거절 | 생성 거절. 컨트롤러는 `exceeded quota` 이벤트를 남기며 계속 재시도 | [02](../02-core-concepts)장 9절의 "한도를 올리는 순간 셋째가 생긴다"가 이것이다 |

[05](../05-scheduling)장 7.5절과 7.6절이 이 장으로 미룬 조합이다. Quota가 `requests.cpu`를 세는 네임스페이스에서는 requests를 안 적은 파드가 아예 거절되므로, LimitRange의 `defaultRequest`가 그 값을 채워 줘야 사용자가 아무것도 안 적어도 파드가 뜬다. Quota는 `scopeSelector`로 특정 PriorityClass나 BestEffort 파드만 따로 셀 수도 있고, `count/<리소스>.<그룹>` 형식으로 어떤 오브젝트든 개수를 제한한다. 값을 얼마로 잡을지는 관측에서 온다. 10절의 kube-state-metrics가 `kube_resourcequota` 시계열로 사용량과 한도를 내보내니, 한도의 80%에 경보를 걸어 두면 거절이 나기 전에 안다.

---

## 4. Metrics Server

```text
kubectl top ─┐   ┌─ HPA / VPA
             ▼   ▼
      metrics.k8s.io API
             │ (aggregation layer)
     ┌───────┴────────┐
     │ Metrics Server │ 메모리에만
     └───────┬────────┘
             │ 15초, /metrics/resource
     ┌───────┼───────┐
     ▼       ▼       ▼
  kubelet  kubelet  kubelet
  cAdvisor cAdvisor cAdvisor
```

```bash
# 설치 (0.9.x는 1.34+ 지원)
kubectl apply -f https://github.com/\
kubernetes-sigs/metrics-server/\
releases/latest/download/components.yaml

# kubelet 인증서를 클러스터 CA가
# 서명하지 않은 환경 (테스트용)
P=/spec/template/spec/containers/0/args
kubectl patch deploy metrics-server \
  -n kube-system --type json -p "[{
  \"op\":\"add\",\"path\":\"$P/-\",
  \"value\":
  \"--kubelet-insecure-tls\"}]"

kubectl get apiservice \
  v1beta1.metrics.k8s.io
```

| 항목 | 값 | 왜 |
|:-----|:--|:---|
| 제공하는 API | `metrics.k8s.io/v1beta1`의 nodes, pods | API 서버의 aggregation layer 뒤에 붙어 `kubectl top`과 HPA가 같은 길로 읽는다 |
| 데이터 출처 | 각 kubelet의 `/metrics/resource` (cAdvisor가 cgroup에서 읽은 값) | 파드 안에 에이전트가 없어도 된다. kubelet이 이미 알고 있다 |
| 주기 | 15초 | HPA의 동기화 주기와 같다. 그보다 자주 잴 이유가 없다 |
| 저장 | 메모리에 최신 값만. 히스토리 없음 | 용도가 지금의 사용량뿐이라 가볍다. 100노드에 CPU 100m, 메모리 200MiB |
| 아닌 것 | 정확한 사용량 측정기, 모니터링 시스템 | 15초 표본이고 지난 값이 없다. 그래프와 경보는 10절 |

첫째 원리의 첫 조각이다. kubelet은 cAdvisor로 컨테이너의 cgroup 통계를 늘 읽고 있고, Metrics Server는 그것을 모아 API 하나로 낸다. 설치 직후 `kubectl top`이 `Metrics API not available`을 내면 이 컴포넌트가 없거나, kubelet의 서버 인증서를 클러스터 CA가 서명하지 않아 Metrics Server가 kubelet을 못 믿는 것이다. kubeadm 클러스터는 후자가 흔해서 위의 `--kubelet-insecure-tls`나 kubelet 서버 인증서 서명([08](../08-security)장 2.4절의 `kubelet-serving` signer)으로 푼다.

### kubectl top

```bash
kubectl top node
kubectl top pod
kubectl top pod -A --sort-by=cpu
kubectl top pod --sort-by=memory
kubectl top pod web --containers
kubectl top pod -l app=web --sum
```

| 열 | 단위 | 뜻 | 왜 |
|:---|:----|:--|:---|
| CPU(cores) | `m` | 최근 구간의 평균 사용량. `166m` = 코어 0.166개 | 순간값이 아니라 두 표본 사이의 사용 시간 나누기 구간이다 |
| MEMORY(bytes) | `Mi` | working set. 캐시 중 회수 못 하는 부분까지 | 커널이 OOM 판단에 쓰는 값과 같아서, limits와 바로 비교할 수 있다 |
| 노드의 CPU% | | 사용량 ÷ 할당 가능량 | 할당 가능량은 용량에서 system·kube 예약분을 뺀 것 |

---

## 5. HPA (Horizontal Pod Autoscaler)

```text
metrics.k8s.io (Metrics Server)
custom / external metrics
            │ 15초마다
            ▼
┌────────────────────────────┐
│ HPA 컨트롤러               │
│ desired = ceil(current ×   │
│   현재값 / 목표값)          │
│ ±10% 안이면 아무것도 안 함 │
└─────────────┬──────────────┘
              │ scale 서브리소스
              ▼
   Deployment.spec.replicas
```

셋째 원리다. [01](../01-introduction)장 9절에서 HPA는 `replicas`를 측정값에서 계산하는 컨트롤러라 했다. 그 측정값이 4절의 Metrics API에서 온다. 15초마다 대상 파드들의 사용량을 읽어 requests 대비 백분율을 내고, 목표와 비교해 개수를 다시 적는다.

| 항목 | 기본값 | 왜 |
|:-----|:-----|:---|
| 계산 | `ceil(현재 개수 × 현재값 ÷ 목표값)` | 목표 50%에 현재 3개가 평균 100%면 6개. 비례식이라 한 번에 맞춘다 |
| 사용률의 분모 | 컨테이너 `resources.requests` | requests가 없는 컨테이너가 하나라도 있으면 그 파드는 계산 불가라 HPA가 움직이지 않는다 |
| 허용 오차 | ±10% (`--horizontal-pod-autoscaler-tolerance` 0.1) | 목표 근처에서 매번 오르내리지 않게 |
| 주기 | 15초 | Metrics Server의 표본 주기와 같다 |
| 줄이기 안정화 창 | 300초. 그동안 계산된 값 중 최대를 쓴다 | 트래픽이 잠깐 빠졌다고 바로 줄이면 플래핑이다 |
| 늘리기 안정화 창 | 0초 | 스파이크에는 바로 늘려야 한다 |
| 기본 정책 | 늘리기는 15초에 4개 또는 100% 중 큰 쪽, 줄이기는 15초에 100% | 작을 때는 4개씩, 클 때는 두 배씩 |
| 준비 안 된 파드 | 늘릴 때는 0%로, 줄일 때는 100%로 센다 | 어느 쪽이든 보수적으로. 새 파드가 뜨는 동안 과잉 확장을 막는다 |

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

| 메트릭 종류 | 예 | 누가 API로 내주나 | 왜 |
|:---------|:---|:-------------|:---|
| Resource | 파드 평균 CPU·메모리 사용률 | Metrics Server (`metrics.k8s.io`) | 가장 흔하다. 메모리는 GC 언어에서 잘 안 내려가 CPU보다 덜 쓴다 |
| ContainerResource | 파드 안 특정 컨테이너의 사용률 | 같다 | 사이드카의 사용량이 섞이지 않게 |
| Pods | 파드당 초당 요청 수 | Prometheus Adapter, KEDA (`custom.metrics.k8s.io`) | 애플리케이션 메트릭으로 늘린다 |
| Object | Ingress의 초당 요청 수처럼 오브젝트 하나의 값 | 같다 | 파드 수와 무관한 값 |
| External | 큐 길이, 클라우드 지표 | KEDA (`external.metrics.k8s.io`) | 클러스터 밖의 신호로 늘린다 |

메트릭이 여럿이면 각각 계산한 개수 중 **가장 큰 것**을 쓴다. 명령형은 [04](../04-workloads)장 12절대로 `kubectl autoscale deployment web --cpu=70% --min=2 --max=10`이고, `--cpu-percent`는 deprecated다. `kubectl get hpa`의 `TARGETS`가 `<unknown>`이면 Metrics API가 없거나 requests가 없는 것이다. 0개까지 줄였다가 첫 요청에 다시 띄우는 `HPAScaleToZero`는 1.37에서 베타가 됐고, 늘리는 방향과 줄이는 방향의 허용 오차를 `behavior`에 따로 적는 필드도 있다.

{{< callout type="warning" >}}
**플래핑과 쿨다운.** 줄이기의 안정화 창 300초는 "지난 5분 동안 계산된 개수 중 최대"를 쓴다는 뜻이라, 트래픽이 급락해도 5분은 파드를 유지한다. 늘리기는 0초라 스파이크에 바로 반응한다. 그런데 새 파드가 뜨는 데 30초가 걸리면 그 30초 동안 사용률은 여전히 높고, HPA는 준비 안 된 파드를 0%로 세어 과잉 확장을 막는다. 그래도 부족하면 `scaleUp.policies`로 15초에 몇 개까지만 늘리게 상한을 둔다. 목표 사용률은 파드 하나가 죽어도 나머지가 받아 낼 여유를 남겨 50~70%로 잡는다.
{{< /callout >}}

---

## 6. VPA와 Cluster Autoscaler

| 구분 | HPA | VPA | Cluster Autoscaler | Karpenter | 왜 나뉘는가 |
|:-----|:----|:----|:------------------|:---------|:---------|
| 적는 것 | `replicas` (개수) | `resources` (크기) | 노드 그룹의 크기 | 노드 자체 | 늘릴 축이 다르다 |
| 신호 | 사용률, 사용자 메트릭 | 사용량 히스토리 | Pending 파드 | Pending 파드 | 개수는 부하로, 크기는 과거로, 노드는 못 뜬 파드로 |
| 재시작 | 없음 | 제자리 조정이 안 되면 파드 재생성 | 없음 | 노드 통합 때 파드 이동 | |
| 맞는 곳 | 상태 없는 서비스 | 단일 인스턴스, 크기를 모르는 워크로드 | 클라우드 노드 그룹 | AWS·Azure 등 API로 노드를 바로 만드는 곳 | |

### VPA

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  updatePolicy:
    updateMode: InPlaceOrRecreate
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "2"
        memory: "2Gi"
      controlledResources:
      - cpu
      - memory
```

| updateMode | 하는 일 | 왜 |
|:----------|:------|:---|
| Off | 권장값만 `status`에 적는다 | 가장 안전하다. `kubectl describe vpa`로 보고 사람이 requests를 고친다 |
| Initial | 파드가 새로 만들어질 때만 권장값을 넣는다 | 도는 파드는 건드리지 않는다 |
| Recreate | 권장값이 많이 다르면 파드를 쫓아내 다시 만든다 | 재시작을 감수한다. `Auto`는 지금 이것과 같다 |
| InPlaceOrRecreate (VPA 1.6 GA, 쿠버네티스 1.33+) | 2.4절의 제자리 조정을 먼저 시도하고 안 되면 재생성 | 재시작 없이 크기를 바꾸는 길이 생겨 VPA가 실전에 쓸 만해졌다 |

VPA는 세 조각이다. recommender가 사용량 히스토리(Metrics Server, 또는 Prometheus)로 권장값을 계산하고, updater가 현재 값과 많이 다른 파드를 골라 조정하거나 쫓아내며, admission controller가 새로 만들어지는 파드에 권장값을 써 넣는다. 시작 직후만 CPU를 더 주는 CPU startup boost는 VPA 1.7 알파다.

### Cluster Autoscaler와 Karpenter

```yaml
# Cluster Autoscaler (AWS 예)
args:
- --cloud-provider=aws
- --expander=least-waste
- "--node-group-auto-discovery=\
  asg:tag=k8s.io/\
  cluster-autoscaler/enabled"
- --balance-similar-node-groups
- --scale-down-unneeded-time=10m
```

| 도구 | 늘리는 때 | 줄이는 때 | 왜 |
|:-----|:-------|:-------|:---|
| Cluster Autoscaler | 파드가 `Insufficient cpu`로 Pending이면 그 파드가 들어갈 노드 그룹의 크기를 올린다 | 노드 사용률이 낮고 파드를 다른 노드로 옮길 수 있으면 10분 뒤 뺀다 | 노드 그룹(ASG 등)이 미리 있어야 한다. `expander`가 어느 그룹을 키울지 고른다 |
| Karpenter (kubernetes-sigs) | Pending 파드의 requests·셀렉터를 보고 딱 맞는 노드를 클라우드 API로 바로 만든다 | 통합(consolidation). 파드를 모아 빈 노드를 없애고, 더 싼 노드로 바꾼다 | 노드 그룹이 없다. `NodePool`에 허용 범위만 적으면 크기와 종류를 스스로 고른다 |

[05](../05-scheduling)장 14.2절이 이 절로 미룬 것이다. 스케줄러가 `Insufficient cpu`로 파드를 못 놓으면 그 이벤트가 노드 오토스케일러의 신호가 된다. 둘 다 기준은 실제 사용량이 아니라 **requests**다. requests를 부풀린 파드는 노드를 낭비하며 늘리고, 줄인 파드는 노드를 꽉 채워 서로 조인다.

{{< callout type="info" >}}
**HPA와 VPA를 같은 축에 쓰지 않는다.** 둘 다 CPU 사용률을 보면 HPA는 개수를 늘려 파드당 사용률을 낮추고, VPA는 requests를 올려 사용률을 낮추려 들어 서로의 계산을 망친다. HPA는 요청 수 같은 사용자 메트릭으로, VPA는 CPU·메모리로 축을 나누거나, VPA를 `Off`로 두고 권장값만 받아 requests를 손으로 맞춘다. 그리고 세 오토스케일러는 사슬이다. HPA가 파드를 늘리면 어느 순간 노드가 모자라 Pending이 생기고, 그것을 Cluster Autoscaler가 받는다. 노드가 뜨는 1~2분을 버틸 여유가 `minReplicas`와 목표 사용률에 들어 있어야 한다.
{{< /callout >}}

---

## 7. 로그 조회

```text
컨테이너 stdout / stderr
        │ 런타임이 받아 적음
        ▼
/var/log/pods/<ns>_<pod>_<uid>/
  <container>/0.log  (CRI 형식)
        │ kubelet이 읽음
        ▼
API 서버 ◀── kubectl logs
  (pods/log 서브리소스)
```

첫째 원리의 둘째 조각이다. 컨테이너가 stdout과 stderr에 쓴 것을 런타임이 노드의 파일로 받아 적고, `kubectl logs`는 API 서버를 거쳐 그 노드의 kubelet에게 파일을 읽어 달라고 한다. 파일에 쓰는 프로그램의 로그는 이 길에 안 오르므로, 컨테이너 안의 프로그램은 stdout에 쓰는 것이 규칙이다.

```bash
kubectl logs web
kubectl logs -f web          # 스트리밍
kubectl logs web --tail=100
kubectl logs web --since=1h
kubectl logs web --timestamps
kubectl logs web --previous    # 죽기 전

# 여러 컨테이너
kubectl logs web -c app
kubectl logs web --all-containers

# 레이블·워크로드 단위
kubectl logs -l app=web --prefix
kubectl logs deploy/web --all-pods
```

| 옵션 | 뜻 | 왜 |
|:-----|:--|:---|
| `-f` | 새 줄이 생기는 대로 흘려 준다 | 재현하면서 본다 |
| `-c` | 컨테이너 지정 | 컨테이너가 둘 이상이면 필수. 안 적으면 아래 오류 |
| `--previous` | 재시작되기 전 컨테이너의 로그 | CrashLoopBackOff의 원인은 죽은 쪽에 있다 |
| `--tail=N`, `--since=1h` | 최근 N줄, 최근 1시간 | 셀렉터로 여럿을 볼 때는 `--tail` 기본이 10줄이다 |
| `-l`, `--all-pods`, `--prefix` | 레이블로 여러 파드, 워크로드의 모든 파드, 줄마다 출처 | 동시에 따라가는 파드는 기본 5개(`--max-log-requests`) |
| `--timestamps` | 줄마다 kubelet이 받은 시각 | 프로그램이 시각을 안 찍어도 순서를 맞춘다 |

{{< callout type="warning" >}}
**컨테이너가 둘 이상인데 `-c`를 빼면** 다음 오류가 난다.
```text
error: a container name must be
specified for pod web, choose one
of: [app log-agent]
```
사이드카가 붙은 파드에서 흔하다. `--all-containers`로 전부 보거나 `-c`로 하나를 고른다.
{{< /callout >}}

### 노드 저장 위치

| 로그 | 어디에 | 왜 |
|:-----|:-----|:---|
| 컨테이너 | `/var/log/pods/<ns>_<pod>_<uid>/<container>/0.log`, `/var/log/containers/`의 심볼릭 링크 | CRI 형식(시각, 스트림, 플래그, 내용). 파일이 10Mi를 넘으면 회전해 5개까지 남긴다(kubelet의 `containerLogMaxSize`, `containerLogMaxFiles`) |
| `kubectl logs`가 보는 것 | 회전된 파일 중 **최신 하나** | 40MiB를 썼어도 10MiB만 나온다. 전부 필요하면 8절의 수집이 답이다 |
| 컨트롤 플레인 (kubeadm) | static pod라 같은 길. `kubectl logs -n kube-system kube-apiserver-cp1` | 컨테이너다 |
| kubelet, 런타임 | systemd 저널. `journalctl -u kubelet -f` | 컨테이너가 아니라 노드의 프로세스다 |
| 이전 컨테이너 | 같은 디렉터리의 이전 파일. `--previous` | 재시작해도 파일은 남는다. 파드가 지워지면 디렉터리도 지워진다 |

```bash
journalctl -u kubelet -f
journalctl -u kubelet \
  --since "1 hour ago"
journalctl -u containerd -n 100
```

---

## 8. 중앙 로그 수집

파드가 지워지면 노드의 로그 파일도 지워지고, 파드는 노드를 옮겨 다닌다. 그래서 검색과 보존은 로그를 노드 밖으로 내보낸 뒤의 일이다.

```text
┌──────────── Node ─────────────┐
│  Pod   Pod   Pod              │
│   └─────┼─────┘ stdout        │
│         ▼                     │
│  /var/log/pods/*              │
│         │ 읽어서 붙인다        │
│  ┌──────┴────────────────┐    │
│  │ DaemonSet 수집 에이전트 │    │
│  │ Fluent Bit / Alloy     │    │
│  └──────┬────────────────┘    │
└─────────┼─────────────────────┘
          ▼ 파드 레이블을 붙여 전송
    Loki · Elasticsearch · 클라우드
```

| 패턴 | 어떻게 | 왜 고르나 |
|:-----|:-----|:-------|
| 노드 에이전트 (DaemonSet) | 노드마다 하나가 `/var/log/pods`를 읽어 보낸다. 파일 이름의 네임스페이스·파드·컨테이너를 레이블로 붙인다 | 기본. 파드에 손대지 않고, 노드당 하나라 싸다 |
| 사이드카 + 에이전트 | 파드 안 둘째 컨테이너가 앱의 로그를 직접 보낸다 | 앱마다 다른 형식·목적지가 필요할 때. 파드마다 에이전트 하나가 값이다 |
| 사이드카 → stdout | 앱이 파일에 쓰면 사이드카가 그 파일을 `tail`해 자기 stdout으로 낸다 | 고칠 수 없는 앱을 노드 에이전트의 길에 올린다 |
| 앱이 직접 전송 | 라이브러리로 백엔드에 바로 | 형식을 완전히 제어한다. 앱이 백엔드에 묶인다 |

```yaml
# 사이드카 → stdout
spec:
  initContainers:
  - name: log-tail
    image: busybox
    restartPolicy: Always  # 사이드카
    command: ["sh", "-c",
      "tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  volumes:
  - name: logs
    emptyDir: {}
```

사이드카는 [04](../04-workloads)장 11절의 네이티브 사이드카(`initContainers` + `restartPolicy: Always`)로 두면 앱보다 먼저 뜨고 앱이 끝난 뒤 내려간다.

| 도구 | 역할 | 왜 |
|:-----|:----|:---|
| Fluent Bit, Fluentd | 수집·변환·전송 에이전트. Fluent Bit이 경량판 | CNCF 졸업 프로젝트. 어느 백엔드로든 보낸다 |
| Grafana Alloy | 로그·메트릭·트레이스를 한 에이전트로 | Loki의 Promtail은 2026년 3월 2일로 지원이 끝났고 Alloy가 그 자리다 |
| OpenTelemetry Collector | 세 신호를 표준 형식(OTLP)으로 받아 보낸다 | 트레이스까지 한 파이프라인으로 |
| Loki | 레이블만 인덱스하는 로그 저장소 | 인덱스가 작아 싸다. 본문 검색은 레이블로 좁힌 뒤 훑는다 |
| Elasticsearch, OpenSearch | 본문까지 인덱스 | 전문 검색이 강하고 비싸다 |

---

## 9. 이벤트와 디버깅

```bash
kubectl events --for pod/web
kubectl events -A --types Warning -w
kubectl get events \
  --sort-by=.lastTimestamp
kubectl describe pod web   # 끝에 Events

kubectl exec -it web -- sh
kubectl exec web -c app -- ps aux
kubectl port-forward pod/web 8080:80
kubectl debug web -it --image=busybox
```

첫째 원리의 셋째 조각이다. 이벤트는 컨트롤러와 kubelet과 스케줄러가 "내가 이 오브젝트에 이런 일을 했다"고 남기는 오브젝트다. 스케줄 실패(`FailedScheduling`), 이미지 풀 실패(`Failed`, `BackOff`), 프로브 실패(`Unhealthy`), OOM 뒤 재시작(`BackOff`), 쿼터 초과(`FailedCreate`)가 다 여기 있다. API 서버가 기본 한 시간(`--event-ttl`) 보관하고 지우므로, 어제의 이벤트는 8절의 수집기나 이벤트 익스포터로 내보낸 것에만 남는다. `kubectl events`는 시각순으로 정렬해 주고 `--for`로 오브젝트 하나를 고른다. `kubectl describe`의 마지막 Events 단이 같은 것을 그 오브젝트만 걸러 보여 준다.

프로브는 [01](../01-introduction)장 9절의 것이다. readiness가 실패한 파드는 Service의 EndpointSlice에서 빠지고([07](../07-networking)장 12.2절), liveness가 실패하면 kubelet이 컨테이너를 다시 띄우며, 둘 다 `Unhealthy` 이벤트를 남긴다. [07](../07-networking)장 10.4절의 CoreDNS `health`와 `ready` 플러그인이 그 프로브가 두드리는 엔드포인트이고, `prometheus` 플러그인의 9153 포트는 10절이 긁어 가는 메트릭이다.

### 상태별 진단 플로우

```text
1. kubectl get pods        상태
2. kubectl describe pod    이벤트·조건
3. kubectl logs            앱 로그
4. kubectl logs --previous 죽기 전
5. kubectl exec / debug    안에서
6. kubectl top             사용량
```

| 상태 | 먼저 볼 것 | 왜 | 자세히 |
|:-----|:--------|:---|:-----|
| Pending | `describe`의 `FailedScheduling` 이벤트 | requests가 노드에 안 맞거나, 셀렉터·taint에 걸렸다 | [14](../14-troubleshooting)장 4절 |
| ImagePullBackOff | 이미지 이름, 레지스트리 자격 증명, 노드의 네트워크 | 이벤트에 레지스트리의 응답이 그대로 적힌다 | [14](../14-troubleshooting)장 5절 |
| CrashLoopBackOff | `logs --previous` | 원인은 죽은 컨테이너가 남긴 마지막 줄에 있다 | [14](../14-troubleshooting)장 6절 |
| OOMKilled | `describe`의 `Last State: Terminated, Reason: OOMKilled`, 종료 코드 137 | limits를 넘었다. 2.2절. 올리거나 누수를 잡는다 | |
| Running인데 이상 | `logs`, `exec`로 안에서 헬스 체크, `top`으로 조임 여부 | 살아 있다는 것과 일한다는 것은 다르다 | [14](../14-troubleshooting)장 12절의 `kubectl debug` |
| Evicted | 노드의 `describe`에서 `MemoryPressure`, `DiskPressure` | 2.3절. 파드가 아니라 노드가 모자랐다 | |

---

## 10. Prometheus와 Grafana

```text
┌────────────────────────────┐
│ Prometheus  ──▶ Grafana    │
│  (TSDB)         대시보드   │
│    │                       │
│    └──▶ Alertmanager       │
│          Slack, PagerDuty  │
│  pull: 15초~1분마다 scrape │
└──────┬─────────────────────┘
       ▼ /metrics (텍스트 형식)
 kubelet·cAdvisor  kube-state-metrics
 node-exporter     앱, CoreDNS 9153
```

Metrics Server가 "지금"만 안다면 Prometheus는 "언제부터 얼마나"를 안다. 대상들의 `/metrics` 엔드포인트를 주기적으로 긁어(pull) 시계열로 저장하고, PromQL로 묻고, 규칙이 맞으면 Alertmanager가 알린다.

| 대상 | 내주는 것 | 왜 |
|:-----|:-------|:---|
| kubelet, cAdvisor | 컨테이너의 CPU 시간, 메모리 working set, CFS 조임 횟수, 네트워크 | 2절의 requests·limits를 실제와 비교하는 재료 |
| kube-state-metrics | 오브젝트의 상태를 숫자로. 파드 단계, 재시작 횟수, Deployment의 사용 가능 개수, `kube_resourcequota` | API 서버는 상태를 숫자로 안 낸다. 이것이 번역한다 |
| node-exporter | 노드의 CPU, 메모리, 디스크, 네트워크 | 파드 밖, 노드 전체의 그림 |
| 컴포넌트의 `/metrics` | API 서버 요청 지연, etcd fsync 시간, 스케줄러 대기 시간, CoreDNS 9153 | 컨트롤 플레인이 느린지는 여기서만 안다 |
| 앱의 `/metrics` | 요청 수, 지연 히스토그램, 큐 길이 | 5절 HPA의 사용자 메트릭이 여기서 나온다 |

### 설치 (Helm)

```bash
helm repo add prometheus-community \
  https://prometheus-community\
.github.io/helm-charts
helm repo update
kubectl create namespace monitoring
helm install prom \
  prometheus-community/\
kube-prometheus-stack \
  -n monitoring \
  --set prometheus.prometheusSpec\
.retention=15d
```

kube-prometheus-stack은 Prometheus Operator, Prometheus, Alertmanager, Grafana, kube-state-metrics, node-exporter를 한 번에 깔고, 컨트롤 플레인 대시보드와 기본 경보 규칙까지 넣는다. 긁을 대상은 `ServiceMonitor`·`PodMonitor` 오브젝트로 선언하고, 규칙은 `PrometheusRule`로 둔다.

### 경보 규칙 예시

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: k8s-alerts
  namespace: monitoring
spec:
  groups:
  - name: kubernetes
    rules:
    - alert: TargetDown
      expr: up == 0
      for: 5m
      labels:
        severity: warning
    - alert: PodPendingLong
      expr: |
        sum by (namespace, pod) (
          kube_pod_status_phase{
            phase="Pending"}) > 0
      for: 10m
      labels:
        severity: warning
    - alert: NodeMemoryLow
      expr: |
        node_memory_MemAvailable_bytes
          / node_memory_MemTotal_bytes
          < 0.1
      for: 10m
      labels:
        severity: critical
```

| 규칙 | 뜻 | 왜 |
|:-----|:--|:---|
| `up == 0` | 긁을 대상이 응답하지 않는다 | 모든 경보의 바닥. 대상이 죽었는데 다른 경보가 조용한 것이 가장 위험하다 |
| Pending 10분 | 스케줄 못 한 파드 | 3절의 Quota나 6절의 노드 부족. 이벤트는 한 시간이면 사라지니 메트릭으로 잡는다 |
| 노드 메모리 10% 미만 | 남은 메모리 ÷ 전체가 0.1 아래 | 2.3절의 축출이 시작되기 전에 안다. kubelet의 기준은 100Mi라 그보다 훨씬 앞이다 |
| `for` | 그 시간 동안 계속 참일 때만 | 15초짜리 스파이크로 사람을 깨우지 않게 |

### 모니터링 도구 비교

| 도구 | 형태 | 강점 | 약점 | 왜 고르나 |
|:-----|:----|:----|:----|:-------|
| Metrics Server | 내장 API | 설치 한 줄, HPA·`top` | 히스토리·경보 없음 | 오토스케일링에는 이것이면 된다 |
| Prometheus + Grafana + Alertmanager | 오픈소스 | PromQL, 생태계, 익스포터 | 직접 운영. 장기 보관은 Thanos·Mimir·Cortex를 얹는다 | 사실상 표준. 대부분의 대시보드가 이 형식이다 |
| Loki + Alloy | 오픈소스 | 로그를 메트릭과 같은 레이블로 | 전문 검색 약함 | Grafana 한 화면에서 메트릭과 로그를 오간다 |
| OpenTelemetry | 규격과 Collector | 세 신호 한 파이프라인, 벤더 중립 | 저장소는 따로 | 트레이스가 필요해지는 순간 |
| Datadog, New Relic, 클라우드 관리형 | SaaS | 통합 화면, 운영 없음 | 비용, 데이터가 밖으로 | 운영 인력이 없을 때 |

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 관측성 3요소 | 메트릭·로그·트레이스, 그리고 이벤트 | 내장은 셋의 조각뿐. 나머지는 얹는다 |
| requests | 스케줄러에게 하는 약속 | 배치는 requests의 합으로만 정해진다 |
| limits | 커널이 지키는 상한 | CPU는 조이고 메모리는 죽인다(137) |
| QoS와 축출 | 사용량이 requests를 넘는가, 우선순위, 초과량 순 | BestEffort는 약속이 0이라 첫째 줄 |
| 제자리 조정 | `resize` 서브리소스 (1.35 GA) | 크기를 바꾸는 데 파드를 죽이지 않는다 |
| LimitRange / ResourceQuota | 하나의 범위와 기본값 / 네임스페이스의 총량 | 총량을 세려면 모두에 값이 있어야 한다 |
| Metrics Server | kubelet을 15초마다 긁어 `metrics.k8s.io`로 | `kubectl top`과 HPA의 출처. 히스토리 없음 |
| HPA | `ceil(현재 × 현재값 ÷ 목표값)`, ±10%, 줄이기 5분 창 | 분모는 requests. 없으면 안 움직인다 |
| VPA | 히스토리로 requests 권장, `InPlaceOrRecreate`로 제자리 적용 | HPA와 같은 축을 보게 하지 않는다 |
| Cluster Autoscaler / Karpenter | Pending 파드가 신호. 노드 그룹 / 노드 직접 | 기준은 requests다 |
| `kubectl logs` | stdout → 노드 파일 → kubelet → API | 최신 회전 파일 하나만. `--previous`, `-c` |
| 중앙 수집 | DaemonSet 에이전트가 `/var/log/pods`를 백엔드로 | 파드가 지워지면 파일도 지워진다 |
| 이벤트 | 컨트롤러가 남긴 기록. 기본 한 시간 | `kubectl events --for`, `describe`의 끝 |
| Prometheus | pull, PromQL, `for`가 있는 경보 | kube-state-metrics가 상태를 숫자로 번역한다 |

{{< callout type="info" >}}
**용어 정리**
- **관측성**: 밖으로 나온 신호로 안을 추론하는 능력. 메트릭·로그·트레이스
- **requests / limits**: 스케줄러에게 하는 약속 / 커널이 지키는 상한
- **CFS 조임 (throttling)**: CPU limits를 100ms 주기의 쿼터로 강제하는 것
- **OOMKilled**: 메모리 limits를 넘어 커널이 죽인 상태. 종료 코드 137
- **QoS 클래스**: Guaranteed·Burstable·BestEffort. requests와 limits의 관계로 정해지는 축출 위치
- **축출 (eviction)**: 노드가 모자랄 때 kubelet이 파드를 쫓아내는 것. 노드 기준
- **제자리 조정**: 파드를 다시 만들지 않고 `resources`를 바꾸는 `resize` 서브리소스
- **LimitRange / ResourceQuota**: 컨테이너 단위 범위와 기본값 / 네임스페이스 총량
- **Metrics API**: `metrics.k8s.io`. Metrics Server가 채운다
- **cAdvisor**: kubelet 안의 컨테이너 통계 수집기
- **HPA / VPA**: 개수 / 크기를 측정값으로 적는 컨트롤러
- **안정화 창**: 줄이기 전 지난 값 중 최대를 쓰는 시간. 기본 300초
- **Cluster Autoscaler / Karpenter**: 노드 그룹 크기 / 노드 자체를 Pending 파드로 조절
- **CRI 로그 형식**: 런타임이 `/var/log/pods`에 쓰는 시각·스트림·내용 한 줄
- **로그 회전**: 10Mi마다 파일을 바꾸고 5개를 남기는 kubelet 설정
- **Fluent Bit / Alloy / OpenTelemetry Collector**: 노드에서 신호를 모아 보내는 에이전트
- **Loki**: 레이블만 인덱스하는 로그 저장소
- **이벤트**: 컨트롤러가 오브젝트에 남긴 기록. 기본 한 시간 보관
- **kube-state-metrics**: 오브젝트 상태를 시계열로 번역하는 익스포터
- **PromQL / Alertmanager**: Prometheus 질의 언어 / 경보를 묶어 보내는 컴포넌트
{{< /callout >}}
