---
title: Kubernetes 리소스 관리
weight: 8
---

쿠버네티스 클러스터의 모니터링과 리소스 관리 방법을 다룹니다.

## 모니터링 도구 비교

### Datadog vs Prometheus

| 구분 | Datadog | Prometheus |
|------|---------|------------|
| **구축 형태** | SaaS (클라우드) | 직접 구축 (On-premise) |
| **설치** | 간편함 | 상대적으로 복잡함 |
| **시각화** | 강력한 내장 그래프 | Grafana 연계 필요 |
| **이벤트 수집** | 기본 제공 | 별도 솔루션 필요 |
| **알람** | 제한적 | AlertManager로 유연함 |
| **비용** | 유료 (사용량 기반) | 무료 (오픈소스) |
| **데이터 위치** | 외부 클라우드 | 내부 서버 |

## Datadog

실시간 데이터 통합 플랫폼으로 클라우드 모니터링 서비스에서 시작해 종합 모니터링 플랫폼으로 발전했습니다.

### 주요 기능

```
┌─────────────────────────────────────────────────────────┐
│                    Datadog Cloud                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Dashboard  │  │   System    │  │    Logs     │     │
│  │  - 메트릭    │  │  - 인프라    │  │  - 애플리케이션│     │
│  │  - 임계치    │  │  - 네트워크  │  │  - 시스템    │     │
│  │  - 시각화    │  │  - 트래픽    │  │  - 검색     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ 데이터 수집
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Cluster Agent │  │ DaemonSet     │  │ DaemonSet     │
│   (프록시)     │  │ Agent (Node1) │  │ Agent (Node2) │
└───────────────┘  └───────────────┘  └───────────────┘
```

### 에이전트 유형

| 에이전트 | 역할 | 배포 위치 |
|----------|------|-----------|
| **Cluster Agent** | API 서버와 노드 에이전트 간 프록시 | 단일 배포 |
| **DaemonSet Agent** | 노드별 메트릭 수집 | 모든 워커 노드 |

### Datadog 설치 (Helm)

```bash
# Helm 저장소 추가
helm repo add datadog https://helm.datadoghq.com
helm repo update

# 네임스페이스 생성
kubectl create namespace datadog

# Datadog 설치
helm install datadog datadog/datadog \
  --namespace datadog \
  --set datadog.apiKey=<YOUR_API_KEY> \
  --set datadog.appKey=<YOUR_APP_KEY> \
  --set datadog.clusterName=<CLUSTER_NAME> \
  --set clusterAgent.enabled=true \
  --set clusterAgent.metricsProvider.enabled=true
```

## Prometheus

SoundCloud에서 개발하고 현재 CNCF 소속인 오픈소스 모니터링 솔루션입니다.

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                      Prometheus Stack                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │   Prometheus    │─────▶│    Grafana      │                   │
│  │     Server      │      │  (시각화/대시보드) │                   │
│  │  - 메트릭 저장    │      └─────────────────┘                   │
│  │  - PromQL 쿼리   │                                            │
│  └────────┬────────┘      ┌─────────────────┐                   │
│           │               │  AlertManager   │                   │
│           └──────────────▶│  - Slack 알림    │                   │
│                           │  - Email 알림    │                   │
│  Pull 방식 (scrape)        └─────────────────┘                   │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Targets (수집 대상)                         │
├───────────────┬───────────────┬───────────────┬──────────────────┤
│  Node         │  Kubernetes   │  Application  │  Custom          │
│  Exporter     │  Metrics      │  Metrics      │  Exporter        │
│  (노드 메트릭)  │  (API 서버)    │  (/metrics)   │  (DB, 캐시 등)    │
└───────────────┴───────────────┴───────────────┴──────────────────┘
```

### 특징

- **Pull 기반 수집**: 서버가 타겟에서 메트릭을 가져옴
- **시계열 데이터베이스**: 효율적인 메트릭 저장
- **PromQL**: 강력한 쿼리 언어
- **서비스 디스커버리**: 자동 타겟 감지

### Prometheus 설치 (Helm)

```bash
# Prometheus 스택 설치 (Prometheus + Grafana + AlertManager)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
```

### Prometheus 설정 예시

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093

    rule_files:
      - /etc/prometheus/rules/*.yml

    scrape_configs:
      # Kubernetes API Server
      - job_name: 'kubernetes-apiservers'
        kubernetes_sd_configs:
          - role: endpoints
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
            action: keep
            regex: default;kubernetes;https

      # Node Exporter
      - job_name: 'node-exporter'
        kubernetes_sd_configs:
          - role: endpoints
        relabel_configs:
          - source_labels: [__meta_kubernetes_endpoints_name]
            action: keep
            regex: node-exporter

      # Pod Metrics
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
```

### AlertManager 설정

```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
      slack_api_url: 'https://hooks.slack.com/services/xxx/xxx/xxx'

    route:
      group_by: ['alertname', 'namespace']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'slack-notifications'
      routes:
        - match:
            severity: critical
          receiver: 'slack-critical'
        - match:
            severity: warning
          receiver: 'slack-warnings'

    receivers:
      - name: 'slack-notifications'
        slack_configs:
          - channel: '#alerts'
            send_resolved: true

      - name: 'slack-critical'
        slack_configs:
          - channel: '#alerts-critical'
            send_resolved: true

      - name: 'slack-warnings'
        slack_configs:
          - channel: '#alerts-warning'
            send_resolved: true
```

### 알람 규칙 예시

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kubernetes-alerts
  namespace: monitoring
spec:
  groups:
    - name: kubernetes-resources
      rules:
        # 높은 CPU 사용률
        - alert: HighCPUUsage
          expr: |
            100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High CPU usage detected"
            description: "CPU usage is above 80% for more than 5 minutes"

        # 높은 메모리 사용률
        - alert: HighMemoryUsage
          expr: |
            (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High memory usage detected"
            description: "Memory usage is above 85%"

        # Pod 재시작
        - alert: PodRestartingTooMuch
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Pod is restarting frequently"
            description: "Pod {{ $labels.pod }} has restarted more than 5 times in the last hour"
```

## Grafana

다양한 데이터 소스를 지원하는 시각화 도구입니다.

### 지원 데이터 소스

| 카테고리 | 데이터 소스 |
|----------|-------------|
| **시계열 DB** | Prometheus, InfluxDB, OpenTSDB, Graphite |
| **클라우드** | AWS CloudWatch, Google Stackdriver, Azure Monitor |
| **검색 엔진** | Elasticsearch, Loki |
| **관계형 DB** | MySQL, PostgreSQL, MSSQL |

### Grafana 대시보드 설정

```yaml
# grafana-dashboard-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  kubernetes-cluster.json: |
    {
      "dashboard": {
        "title": "Kubernetes Cluster Overview",
        "panels": [
          {
            "title": "CPU Usage",
            "type": "graph",
            "datasource": "Prometheus",
            "targets": [
              {
                "expr": "sum(rate(container_cpu_usage_seconds_total{container!=\"\"}[5m])) by (namespace)",
                "legendFormat": "{{namespace}}"
              }
            ]
          },
          {
            "title": "Memory Usage",
            "type": "graph",
            "datasource": "Prometheus",
            "targets": [
              {
                "expr": "sum(container_memory_usage_bytes{container!=\"\"}) by (namespace)",
                "legendFormat": "{{namespace}}"
              }
            ]
          }
        ]
      }
    }
```

## 컨테이너 리소스 관리

### LimitRange

네임스페이스 내 컨테이너별 리소스 제한을 설정합니다.

```
┌─────────────────────────────────────────────────────────┐
│                    LimitRange 동작                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    Pod 생성 요청                                          │
│         │                                                │
│         ▼                                                │
│    ┌─────────────┐                                      │
│    │ Admission   │ ◀── LimitRange 검증                   │
│    │ Controller  │                                      │
│    └──────┬──────┘                                      │
│           │                                              │
│     ┌─────┴─────┐                                       │
│     ▼           ▼                                       │
│  [허용]       [거부]                                     │
│  min ≤ req   요청값이 범위를                             │
│  req ≤ limit  벗어남                                    │
│  limit ≤ max                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### LimitRange 설정

```yaml
# limitrange.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: default
spec:
  limits:
    # 컨테이너 제한
    - type: Container
      max:
        cpu: "2"
        memory: "2Gi"
      min:
        cpu: "100m"
        memory: "64Mi"
      default:        # 기본 limits (미지정 시 적용)
        cpu: "500m"
        memory: "512Mi"
      defaultRequest: # 기본 requests (미지정 시 적용)
        cpu: "200m"
        memory: "256Mi"
      maxLimitRequestRatio:  # limits/requests 최대 비율
        cpu: "4"
        memory: "4"

    # Pod 전체 제한
    - type: Pod
      max:
        cpu: "4"
        memory: "4Gi"

    # PVC 제한
    - type: PersistentVolumeClaim
      max:
        storage: "10Gi"
      min:
        storage: "1Gi"
```

### requests vs limits

```yaml
# pod-resources.yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
    - name: app
      image: nginx
      resources:
        requests:    # 최소 보장 리소스
          cpu: "500m"
          memory: "256Mi"
        limits:      # 최대 사용 가능 리소스
          cpu: "1000m"
          memory: "512Mi"
```

```
┌─────────────────────────────────────────────────────────┐
│                  리소스 할당 개념                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  노드 가용 CPU: 4000m                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│                                                          │
│  Pod A: requests=500m, limits=1000m                     │
│  ├─────┤ requests (보장)                                │
│  ├───────────┤ limits (최대)                            │
│                                                          │
│  Pod B: requests=1000m, limits=2000m                    │
│  ├───────────┤ requests (보장)                          │
│  ├───────────────────────┤ limits (최대)                │
│                                                          │
│  합계 requests: 1500m (스케줄링 기준)                    │
│  남은 가용량: 2500m                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

| 구분 | requests | limits |
|------|----------|--------|
| **의미** | 최소 보장 리소스 | 최대 사용 가능 리소스 |
| **스케줄링** | 기준으로 사용 | 사용하지 않음 |
| **초과 시** | - | CPU: 스로틀링, Memory: OOMKill |
| **QoS 영향** | 결정에 사용 | 결정에 사용 |

### QoS (Quality of Service) 클래스

```
┌──────────────────────────────────────────────────────────────────┐
│                       QoS Classes                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Guaranteed (최우선)                                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 모든 컨테이너가 CPU/Memory limits = requests 설정            │ │
│  │ 리소스 부족 시 가장 마지막에 종료                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Burstable (중간)                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 최소 하나의 컨테이너가 requests 또는 limits 설정              │ │
│  │ Guaranteed 조건 미충족                                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  BestEffort (최후순위)                                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 어떤 컨테이너도 requests/limits 미설정                        │ │
│  │ 리소스 부족 시 가장 먼저 종료                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

```yaml
# QoS: Guaranteed
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-pod
spec:
  containers:
    - name: app
      image: nginx
      resources:
        requests:
          cpu: "500m"
          memory: "256Mi"
        limits:
          cpu: "500m"      # requests와 동일
          memory: "256Mi"  # requests와 동일
---
# QoS: Burstable
apiVersion: v1
kind: Pod
metadata:
  name: burstable-pod
spec:
  containers:
    - name: app
      image: nginx
      resources:
        requests:
          cpu: "200m"
          memory: "128Mi"
        limits:
          cpu: "500m"      # requests와 다름
          memory: "256Mi"
---
# QoS: BestEffort
apiVersion: v1
kind: Pod
metadata:
  name: besteffort-pod
spec:
  containers:
    - name: app
      image: nginx
      # resources 미설정
```

## ResourceQuota

네임스페이스 전체의 리소스 총량을 제한합니다.

```yaml
# resourcequota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
  namespace: development
spec:
  hard:
    # 컴퓨팅 리소스
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"

    # 스토리지
    requests.storage: "100Gi"
    persistentvolumeclaims: "10"

    # 오브젝트 수
    pods: "50"
    services: "20"
    secrets: "50"
    configmaps: "50"
    replicationcontrollers: "20"
    services.loadbalancers: "5"
    services.nodeports: "10"
```

### LimitRange vs ResourceQuota

```
┌───────────────────────────────────────────────────────────────────┐
│                    LimitRange vs ResourceQuota                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LimitRange (개별 제한)              ResourceQuota (총량 제한)      │
│  ┌─────────────────────┐            ┌─────────────────────┐       │
│  │   Namespace: dev    │            │   Namespace: dev    │       │
│  │                     │            │                     │       │
│  │  Pod마다 적용:       │            │  전체 합계:          │       │
│  │  ┌───┐ max: 2CPU   │            │  ┌───┬───┬───┐     │       │
│  │  │Pod│ min: 100m   │            │  │   │   │   │     │       │
│  │  └───┘             │            │  └───┴───┴───┘     │       │
│  │                     │            │  총 10 CPU 제한     │       │
│  │  ┌───┐ max: 2CPU   │            │                     │       │
│  │  │Pod│ min: 100m   │            │                     │       │
│  │  └───┘             │            │                     │       │
│  └─────────────────────┘            └─────────────────────┘       │
│                                                                    │
│  용도: 단일 Pod/Container 제한       용도: 네임스페이스 총량 제한    │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

## 오토스케일링

### Metrics Server

오토스케일링의 기반이 되는 메트릭 수집 컴포넌트입니다.

```bash
# Metrics Server 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 확인
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
kubectl top pods
```

### HPA (Horizontal Pod Autoscaler)

파드 개수를 자동으로 조절합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      HPA 동작 흐름                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐                                             │
│   │ Metrics Server│ ◀─── 메트릭 수집 (CPU, Memory, Custom)       │
│   └───────┬───────┘                                             │
│           │                                                      │
│           ▼                                                      │
│   ┌───────────────┐                                             │
│   │      HPA      │ ◀─── 목표값과 비교                           │
│   │               │      desiredReplicas = ceil[currentReplicas │
│   │   계산 공식:   │       * (currentMetricValue / desiredValue)]│
│   └───────┬───────┘                                             │
│           │                                                      │
│           ▼                                                      │
│   ┌───────────────┐                                             │
│   │  Deployment   │                                             │
│   │   replicas    │ ◀─── Scale Up/Down                          │
│   └───────────────┘                                             │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     ▼     ▼     ▼                                               │
│   ┌───┐ ┌───┐ ┌───┐                                            │
│   │Pod│ │Pod│ │Pod│ ... (min ~ max)                            │
│   └───┘ └───┘ └───┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### HPA 설정

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    # CPU 기반 스케일링
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # Memory 기반 스케일링
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # Custom Metrics (예: 요청 수)
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 축소 전 안정화 시간
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
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### 대상 Deployment 예시

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: nginx
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

### HPA 명령어

```bash
# HPA 생성 (명령형)
kubectl autoscale deployment web-app \
  --min=2 --max=10 --cpu-percent=70

# HPA 상태 확인
kubectl get hpa
kubectl describe hpa web-app-hpa

# HPA 상세 정보
kubectl get hpa web-app-hpa -o yaml

# 부하 테스트 (별도 터미널)
kubectl run -it --rm load-generator --image=busybox -- /bin/sh
# while true; do wget -q -O- http://web-app; done
```

### VPA (Vertical Pod Autoscaler)

파드의 리소스 요청값을 자동으로 조절합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPA 구성요소                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Recommender │  │   Updater    │  │  Admission   │          │
│  │              │  │              │  │  Controller  │          │
│  │  메트릭 분석  │  │  Pod 축출    │  │  requests    │          │
│  │  권장값 계산  │  │  재시작 관리  │  │  값 주입     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# vpa.yaml
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
    updateMode: "Auto"  # Off, Initial, Recreate, Auto
  resourcePolicy:
    containerPolicies:
      - containerName: web-app
        minAllowed:
          cpu: "100m"
          memory: "128Mi"
        maxAllowed:
          cpu: "2"
          memory: "2Gi"
        controlledResources: ["cpu", "memory"]
```

### HPA vs VPA

| 구분 | HPA | VPA |
|------|-----|-----|
| **스케일링 방식** | 수평 (Pod 개수) | 수직 (리소스 크기) |
| **적용 대상** | Deployment, ReplicaSet | Pod |
| **재시작** | 불필요 | 필요 (리소스 변경 시) |
| **사용 사례** | Stateless 애플리케이션 | Stateful, 단일 인스턴스 |
| **동시 사용** | 가능 (주의 필요) | 가능 (주의 필요) |

### Cluster Autoscaler

노드 자체를 자동으로 추가/제거합니다.

```yaml
# cluster-autoscaler.yaml (AWS EKS 예시)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
        - name: cluster-autoscaler
          image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
          command:
            - ./cluster-autoscaler
            - --v=4
            - --stderrthreshold=info
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/<CLUSTER_NAME>
            - --balance-similar-node-groups
            - --scale-down-enabled=true
            - --scale-down-delay-after-add=10m
            - --scale-down-unneeded-time=10m
```

## 리소스 관리 모범 사례

### 1. 네임스페이스별 리소스 관리

```yaml
# 개발 환경
apiVersion: v1
kind: Namespace
metadata:
  name: development
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: development
spec:
  hard:
    requests.cpu: "5"
    requests.memory: "10Gi"
    limits.cpu: "10"
    limits.memory: "20Gi"
    pods: "20"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: development
spec:
  limits:
    - type: Container
      default:
        cpu: "200m"
        memory: "256Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
```

### 2. 프로덕션 환경 권장 설정

```yaml
# 프로덕션 환경
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: prod-quota
  namespace: production
spec:
  hard:
    requests.cpu: "50"
    requests.memory: "100Gi"
    limits.cpu: "100"
    limits.memory: "200Gi"
    pods: "100"
    services.loadbalancers: "5"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: prod-limits
  namespace: production
spec:
  limits:
    - type: Container
      max:
        cpu: "4"
        memory: "8Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "250m"
        memory: "256Mi"
```

### 유용한 명령어

```bash
# 리소스 사용량 확인
kubectl top nodes
kubectl top pods --all-namespaces
kubectl top pods --containers

# ResourceQuota 확인
kubectl get resourcequota -n development
kubectl describe resourcequota dev-quota -n development

# LimitRange 확인
kubectl get limitrange -n development
kubectl describe limitrange dev-limits -n development

# HPA 모니터링
kubectl get hpa -w
kubectl describe hpa web-app-hpa

# Pod QoS 클래스 확인
kubectl get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass

# 리소스 요청/제한 확인
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[*].resources.requests.cpu,\
CPU_LIM:.spec.containers[*].resources.limits.cpu,\
MEM_REQ:.spec.containers[*].resources.requests.memory,\
MEM_LIM:.spec.containers[*].resources.limits.memory
```

## 참고 자료

- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [VPA Documentation](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
