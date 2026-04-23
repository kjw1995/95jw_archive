---
title: "09. 관측성"
weight: 9
---

쿠버네티스 클러스터의 리소스 관리, 모니터링, 로깅, 오토스케일링을 다룬다.

## 1. 관측성 3요소

관측성(Observability)은 시스템 내부 상태를 외부 신호로 추론하는 능력이다. 쿠버네티스에서는 메트릭·로그·트레이스 세 축으로 구성한다.

| 구분 | 설명 | 대표 도구 |
|:---|:---|:---|
| Metrics | 수치형 시계열, 집계·경보에 적합 | Metrics Server, Prometheus |
| Logs | 이벤트 단위 텍스트, 원인 분석 | Fluentd, Loki, ELK |
| Traces | 요청 단위 분산 추적, 지연 분석 | Jaeger, Tempo, OpenTelemetry |

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

{{< callout type="info" >}}
**모니터링 vs 관측성**: 모니터링은 "알고 있는 문제를 감시"하고, 관측성은 "모르던 문제를 찾아낸다". 두 개념은 배타적이지 않고 보완 관계다.
{{< /callout >}}

## 2. 리소스 requests와 limits

컨테이너가 쓸 CPU·메모리를 명시해 스케줄러가 배치를 결정하고 커널이 사용을 제한한다.

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
          cpu: "1000m"
          memory: "512Mi"
```

| 구분 | requests | limits |
|:---|:---|:---|
| 의미 | 최소 보장 리소스 | 최대 사용 가능 리소스 |
| 스케줄링 | 기준으로 사용 | 사용하지 않음 |
| 초과 시 | - | CPU 스로틀, Memory OOMKill |
| 단위 | CPU `m`(millicore), Memory `Mi`/`Gi` | 동일 |

```text
노드 가용 CPU 4000m
━━━━━━━━━━━━━━━━━━━━━━━━━━
Pod A  req 500m  lim 1000m
  │▇▇▇│▁▁▁▁▁│
Pod B  req 1000m lim 2000m
  │▇▇▇▇▇▇│▁▁▁▁▁▁▁▁▁▁│
합계 req 1500m (스케줄 기준)
```

{{< callout type="warning" >}}
**OOM Killer 동작**: 컨테이너가 memory limit을 초과하면 커널 OOM Killer가 프로세스를 즉시 종료한다(exit code 137). CPU는 throttle만 되지만, 메모리는 선택지가 없다.
{{< /callout >}}

### QoS 클래스

kubelet은 requests/limits 조합으로 Pod의 축출 우선순위를 결정한다.

| 클래스 | 조건 | 축출 순서 |
|:---|:---|:---|
| Guaranteed | 모든 컨테이너 requests = limits | 마지막 |
| Burstable | 하나 이상 requests/limits 설정 | 중간 |
| BestEffort | requests/limits 미설정 | 가장 먼저 |

{{< callout type="warning" >}}
**request 없으면 BestEffort**: 리소스를 아예 지정하지 않으면 BestEffort로 분류돼 노드 압박 시 1순위로 축출된다. 프로덕션에서는 최소 requests는 반드시 지정하자.
{{< /callout >}}

## 3. LimitRange와 ResourceQuota

개별 Pod와 네임스페이스 전체를 서로 다른 층위에서 제한한다.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: development
spec:
  limits:
    - type: Container
      max:
        cpu: "2"
        memory: "2Gi"
      min:
        cpu: "100m"
        memory: "64Mi"
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "200m"
        memory: "256Mi"
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: development
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    pods: "50"
    persistentvolumeclaims: "10"
```

| 항목 | LimitRange | ResourceQuota |
|:---|:---|:---|
| 대상 | 개별 Pod/Container | 네임스페이스 전체 |
| 효과 | 최소/최대·기본값 주입 | 총량 상한 |
| 용도 | 극단값 방지 | 팀·환경 분리 |

## 4. Metrics Server

`kubectl top`과 HPA의 기반이 되는 경량 메트릭 수집기다.

```text
┌──────────────────────────┐
│     Metrics Server       │
│  (인메모리, 클러스터 1개) │
└──────────────┬───────────┘
               │ /metrics/resource
       ┌───────┼───────┐
       ▼       ▼       ▼
  ┌────────┐┌────────┐┌────────┐
  │kubelet ││kubelet ││kubelet │
  │cAdvisor││cAdvisor││cAdvisor│
  │ Node1  ││ Node2  ││ Node3  │
  └────────┘└────────┘└────────┘
```

```bash
# 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 자체 서명 인증서 환경 (테스트용)
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# 확인
kubectl get deployment metrics-server -n kube-system
```

{{< callout type="info" >}}
**Heapster는 Deprecated**: 1.11부터 Metrics Server로 대체되었다. Metrics Server는 인메모리라 히스토리가 없으므로 장기 저장·복잡한 쿼리가 필요하면 Prometheus를 붙여야 한다.
{{< /callout >}}

### kubectl top

```bash
# 노드 메트릭
kubectl top node

# Pod 메트릭
kubectl top pod
kubectl top pod -A                  # 모든 네임스페이스
kubectl top pod --sort-by=cpu       # CPU 정렬
kubectl top pod --sort-by=memory    # Memory 정렬
kubectl top pod my-pod --containers # 컨테이너별
```

| 리소스 | 단위 | 예시 |
|:---|:---|:---|
| CPU | millicore (m) | 166m = 0.166 core |
| Memory | Mi, Gi | 1024Mi = 1Gi |

## 5. HPA (Horizontal Pod Autoscaler)

Pod 개수를 메트릭에 따라 자동으로 조절한다.

```text
┌─────────────────────────┐
│    Metrics Server       │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│         HPA             │
│ desired = ceil(current  │
│  * cur/target)          │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│     Deployment          │
│  replicas: min~max      │
└─────────────────────────┘
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
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

```bash
# 명령형 생성
kubectl autoscale deployment web-app --min=2 --max=10 --cpu-percent=70

# 상태 모니터링
kubectl get hpa -w
kubectl describe hpa web-app-hpa
```

{{< callout type="warning" >}}
**HPA 쿨다운**: scaleDown 기본 안정화 창(`stabilizationWindowSeconds`)은 300초다. 트래픽이 급락해도 5분은 Pod를 유지하면서 플래핑(scale up/down 반복)을 막는다. scaleUp은 기본 0초로, 스파이크에 빠르게 대응한다.
{{< /callout >}}

## 6. VPA와 Cluster Autoscaler

HPA가 Pod 수를 늘린다면, VPA는 Pod 크기를 늘리고 Cluster Autoscaler는 노드 수를 늘린다.

| 구분 | HPA | VPA | Cluster Autoscaler |
|:---|:---|:---|:---|
| 방향 | 수평 (Pod 개수) | 수직 (리소스 크기) | 노드 개수 |
| 적용 대상 | Deployment, RS | Pod | 노드 풀 |
| 재시작 | 불필요 | 필요 | 불필요 |
| 유스케이스 | Stateless | Stateful, 단일 인스턴스 | 리소스 부족 시 |

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "Auto"   # Off, Initial, Recreate, Auto
  resourcePolicy:
    containerPolicies:
      - containerName: web-app
        minAllowed:
          cpu: "100m"
          memory: "128Mi"
        maxAllowed:
          cpu: "2"
          memory: "2Gi"
```

```yaml
# Cluster Autoscaler (AWS EKS 예시)
- ./cluster-autoscaler
- --cloud-provider=aws
- --expander=least-waste
- --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled
- --balance-similar-node-groups
- --scale-down-delay-after-add=10m
- --scale-down-unneeded-time=10m
```

{{< callout type="info" >}}
**HPA + VPA 동시 사용**: CPU/Memory 메트릭에 대해 둘 다 동시 적용하면 충돌한다. HPA는 custom metric, VPA는 CPU/Memory로 축을 분리하거나, VPA `updateMode: "Off"`로 권장값만 받고 수동 반영하는 전략이 안전하다.
{{< /callout >}}

## 7. 로그 조회

쿠버네티스 로그는 stdout/stderr를 노드 파일로 수집한 뒤 `kubectl logs`가 API 서버를 거쳐 읽어온다.

```bash
# 기본
kubectl logs <pod>
kubectl logs -f <pod>                 # 실시간 스트리밍
kubectl logs <pod> --tail=100
kubectl logs <pod> --since=1h
kubectl logs <pod> --timestamps
kubectl logs <pod> --previous         # 재시작 전 컨테이너

# 다중 컨테이너
kubectl logs <pod> -c <container>
kubectl logs <pod> --all-containers

# 라벨·Deployment 단위
kubectl logs -l app=nginx --all-containers
kubectl logs deployment/nginx
```

| 옵션 | 설명 |
|:---|:---|
| `-f` | 실시간 스트리밍 |
| `-c <container>` | 다중 컨테이너 Pod에서 필수 |
| `--previous` | 크래시 이전 로그 (CrashLoopBackOff 분석) |
| `--tail=N` | 최근 N줄 |
| `--since=1h` | 최근 1시간 |

{{< callout type="warning" >}}
**다중 컨테이너 Pod에서 `-c` 누락 시 에러**:
```
error: a container name must be specified for pod multi-container-pod,
choose one of: [web-server log-agent sidecar]
```
{{< /callout >}}

### 노드 저장 위치

```bash
# 컨테이너 로그 (심볼릭 링크 → /var/log/pods)
/var/log/containers/<pod>_<ns>_<container>-<id>.log

# Control Plane (kubeadm Static Pod)
kubectl logs kube-apiserver-master -n kube-system
kubectl logs kube-scheduler-master -n kube-system

# Control Plane (systemd 서비스)
journalctl -u kubelet -f
journalctl -u kube-apiserver --since "1 hour ago"
```

## 8. 중앙 로그 수집

Pod는 재시작되면 로컬 로그가 사라진다. 장기 보존·검색을 위해 노드 레벨 에이전트나 사이드카로 외부 백엔드에 적재한다.

```text
┌──────────────── Node ─────────────┐
│  ┌───┐ ┌───┐ ┌───┐                │
│  │Pod│ │Pod│ │Pod│                │
│  └─┬─┘ └─┬─┘ └─┬─┘                │
│    └─────┼─────┘                  │
│          ▼                        │
│  ┌──────────────────────────┐     │
│  │ DaemonSet Log Agent      │     │
│  │ (Fluentd / Fluent Bit)   │     │
│  │ /var/log/containers/*    │     │
│  └──────────┬───────────────┘     │
└─────────────┼─────────────────────┘
              ▼
      ┌────────────────┐
      │  Log Backend   │
      │ Loki · ES · S3 │
      └────────────────┘
```

### 사이드카 패턴

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  containers:
    - name: app
      image: myapp:v1
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
    - name: log-collector
      image: fluentd
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
  volumes:
    - name: log-volume
      emptyDir: {}
```

| 패턴 | 장점 | 단점 |
|:---|:---|:---|
| Node-level DaemonSet | 리소스 효율, 배포 단순 | 파싱 표준화 필요 |
| Sidecar | 앱별 파싱·라우팅 자유 | Pod당 오버헤드 |
| 애플리케이션 직접 전송 | 포맷 제어 완벽 | 라이브러리 결합도 증가 |

## 9. 이벤트와 디버깅

`kubectl describe`와 이벤트 조회는 장애 분석의 출발점이다.

```bash
# 이벤트
kubectl get events --sort-by='.lastTimestamp'
kubectl get events -A --field-selector type=Warning
kubectl get events --field-selector involvedObject.name=nginx

# Pod 상세 (하단 Events 섹션)
kubectl describe pod <pod>

# 컨테이너 내부
kubectl exec -it <pod> -- /bin/sh
kubectl exec <pod> -c <container> -- ps aux

# 포트 포워딩
kubectl port-forward <pod> 8080:80
```

### 상태별 진단 플로우

| 상태 | 확인 방법 |
|:---|:---|
| Pending | `describe` 이벤트 → 스케줄링 실패 원인 (리소스·노드 셀렉터) |
| ImagePullBackOff | 이미지 이름, 레지스트리 인증, 네트워크 확인 |
| CrashLoopBackOff | `logs --previous`로 크래시 직전 로그 |
| Running 그러나 비정상 | `logs`, `exec`로 내부 헬스체크 수동 실행 |
| OOMKilled | `describe` → State.Reason 확인, limit 상향 검토 |

```text
1. kubectl get pods        → 상태
2. kubectl describe pod    → 이벤트·조건
3. kubectl logs            → 애플리케이션 로그
4. kubectl logs --previous → 크래시 전
5. kubectl exec            → 내부 확인
6. kubectl top             → 리소스 사용량
```

## 10. Prometheus와 Grafana

장기 저장·복잡한 쿼리·경보가 필요하면 Prometheus 스택으로 확장한다.

```text
┌──────────────────────────────────┐
│        Prometheus Stack          │
├──────────────────────────────────┤
│ ┌────────────┐   ┌────────────┐  │
│ │ Prometheus │──▶│  Grafana   │  │
│ │  (TSDB)    │   │  (대시보드) │  │
│ └─────┬──────┘   └────────────┘  │
│       │          ┌────────────┐  │
│       └─────────▶│AlertManager│  │
│                  │ Slack/Email│  │
│   Pull (scrape)  └────────────┘  │
└───────┬──────────────────────────┘
        ▼
┌──────────────────────────────────┐
│  Targets: Node Exporter · kube-  │
│  state-metrics · /metrics · DB   │
└──────────────────────────────────┘
```

### 설치 (Helm)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.retention=15d
```

### 알람 규칙 예시

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kubernetes-alerts
  namespace: monitoring
spec:
  groups:
    - name: kubernetes-resources
      rules:
        - alert: HighCPUUsage
          expr: |
            100 - (avg by(instance)
              (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High CPU usage detected"
        - alert: PodRestartingTooMuch
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
```

### 모니터링 도구 비교

| 도구 | 형태 | 강점 | 약점 |
|:---|:---|:---|:---|
| Metrics Server | 내장 | 설치 간편, HPA 연동 | 히스토리·알람 없음 |
| Prometheus + Grafana | OSS | 유연한 PromQL, 풍부한 생태계 | 직접 운영 부담 |
| Loki | OSS | 로그 인덱스 최소화, 저비용 | 풀텍스트 검색 약함 |
| Datadog / New Relic | SaaS | 통합 UI, 관리 불필요 | 비용, 데이터 외부화 |

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| 관측성 3요소 | Metrics·Logs·Traces |
| requests/limits | 보장/상한, QoS와 OOM 판단 |
| QoS | Guaranteed·Burstable·BestEffort |
| Metrics Server | 인메모리 메트릭, `kubectl top`·HPA 기반 |
| HPA | Pod 개수 자동 조절, 쿨다운으로 플래핑 방지 |
| VPA | Pod 리소스 값 자동 조절, 재시작 필요 |
| Cluster Autoscaler | 노드 수 자동 조절 |
| kubectl logs | `-f`·`-c`·`--previous` 옵션 숙지 |
| Prometheus | 장기 저장·PromQL·AlertManager |

{{< callout type="info" >}}
**용어 정리**
- **Metrics Server**: kubelet/cAdvisor에서 리소스 메트릭을 모아 API로 제공하는 경량 컴포넌트
- **cAdvisor**: kubelet에 내장된 컨테이너 메트릭 수집기
- **HPA / VPA**: Pod 수평/수직 자동 스케일러
- **Cluster Autoscaler**: 워크로드 압박 시 노드 풀을 조절
- **QoS Class**: 축출 우선순위 결정 (Guaranteed > Burstable > BestEffort)
- **OOMKilled**: memory limit 초과로 커널이 종료한 상태 (exit 137)
- **LimitRange / ResourceQuota**: 컨테이너 단위 / 네임스페이스 단위 제약
- **Fluentd / Loki**: 로그 수집 에이전트 / 경량 로그 저장소
- **PromQL**: Prometheus 시계열 쿼리 언어
{{< /callout >}}
