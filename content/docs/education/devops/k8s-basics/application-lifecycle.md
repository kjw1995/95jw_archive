---
title: "Application Lifecycle Management"
weight: 4
---

애플리케이션의 배포, 업데이트, 설정 관리, 오토스케일링 등 전체 라이프사이클을 관리하는 방법을 다룹니다.

---

## 1. Rolling Updates와 Rollbacks

### Rollout 개념

Deployment를 생성하거나 업데이트하면 **Rollout**이 트리거됩니다. 각 Rollout은 새로운 **Revision**을 생성하여 변경 이력을 추적합니다.

```
Deployment v1 ──▶ Revision 1
     │
   Update
     │
     ▼
Deployment v2 ──▶ Revision 2
     │
   Update
     │
     ▼
Deployment v3 ──▶ Revision 3
```

### Rollout 상태 확인

```bash
# Rollout 상태 확인
kubectl rollout status deployment/my-app

# Revision 히스토리 조회
kubectl rollout history deployment/my-app

# 특정 Revision 상세 정보
kubectl rollout history deployment/my-app --revision=2
```

### 배포 전략

#### Recreate 전략

모든 기존 Pod를 먼저 종료한 후 새 Pod를 생성합니다. **다운타임이 발생**합니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  strategy:
    type: Recreate
  template:
    spec:
      containers:
      - name: app
        image: nginx:1.20
```

```
기존 상태:  [Pod v1] [Pod v1] [Pod v1]
                ↓ 모두 종료
중간 상태:  [ 없음 ] [ 없음 ] [ 없음 ]  ← 다운타임!
                ↓ 새로 생성
최종 상태:  [Pod v2] [Pod v2] [Pod v2]
```

#### RollingUpdate 전략 (기본값)

Pod를 점진적으로 교체하여 **무중단 배포**를 수행합니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 추가 Pod 수 (또는 비율)
      maxUnavailable: 1  # 최대 비가용 Pod 수 (또는 비율)
  template:
    spec:
      containers:
      - name: app
        image: nginx:1.21
```

```
단계 1:  [Pod v1] [Pod v1] [Pod v1] [Pod v2 생성중]
단계 2:  [Pod v1] [Pod v1] [Pod v2] [Pod v2 생성중]
단계 3:  [Pod v1] [Pod v2] [Pod v2] [Pod v2 생성중]
단계 4:  [Pod v2] [Pod v2] [Pod v2]
```

**maxSurge와 maxUnavailable 조합**:

| maxSurge | maxUnavailable | 설명 |
|:---------|:---------------|:-----|
| 25% | 25% | 기본값, 균형 잡힌 배포 |
| 1 | 0 | 가용성 우선 (항상 모든 Pod 유지) |
| 0 | 1 | 리소스 절약 (추가 Pod 없이 교체) |
| 50% | 0 | 빠른 배포 + 완전한 가용성 |

### 업데이트 방법

```bash
# 이미지 업데이트 (권장)
kubectl set image deployment/my-app nginx=nginx:1.21

# YAML 수정 후 적용
kubectl apply -f deployment.yaml

# 직접 편집
kubectl edit deployment my-app
```

### Rollback

```bash
# 바로 이전 버전으로 롤백
kubectl rollout undo deployment/my-app

# 특정 Revision으로 롤백
kubectl rollout undo deployment/my-app --to-revision=2

# Rollout 일시 중지/재개
kubectl rollout pause deployment/my-app
kubectl rollout resume deployment/my-app
```

### Rollout 히스토리 관리

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  revisionHistoryLimit: 10  # 보관할 ReplicaSet 수 (기본값 10)
```

---

## 2. 컨테이너 명령어 (Commands)

### Docker의 CMD와 ENTRYPOINT

#### CMD

컨테이너 시작 시 실행할 기본 명령어를 지정합니다. **전체 교체**가 가능합니다.

```dockerfile
# Shell form
CMD echo "Hello World"

# Exec form (권장)
CMD ["echo", "Hello World"]

# 파라미터만 지정 (ENTRYPOINT와 함께 사용)
CMD ["5"]
```

#### ENTRYPOINT

컨테이너의 **주 실행 프로그램**을 정의합니다. 인자만 추가/교체됩니다.

```dockerfile
# Exec form (권장)
ENTRYPOINT ["sleep"]

# Shell form
ENTRYPOINT sleep
```

#### 조합 예시

```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
CMD ["10"]
```

```bash
# 기본 실행: sleep 10
docker run sleeper

# CMD 덮어쓰기: sleep 20
docker run sleeper 20

# ENTRYPOINT 덮어쓰기: echo hello
docker run --entrypoint echo sleeper hello
```

**실행 우선순위**:

| ENTRYPOINT | CMD | 실행 결과 |
|:-----------|:----|:----------|
| 없음 | `["echo", "hi"]` | `echo hi` |
| `["sleep"]` | `["10"]` | `sleep 10` |
| `["sleep"]` | 없음 | `sleep` (인자 없음) |
| `["/app"]` | `["--config", "x"]` | `/app --config x` |

---

## 3. Kubernetes의 Command와 Args

### Docker와 Kubernetes 매핑

| Docker | Kubernetes | 설명 |
|:-------|:-----------|:-----|
| ENTRYPOINT | `command` | 실행 프로그램 |
| CMD | `args` | 인자 |

### 기본 사용법

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sleeper
spec:
  containers:
  - name: sleeper
    image: ubuntu
    command: ["sleep"]    # ENTRYPOINT 대체
    args: ["100"]         # CMD 대체
```

### 다양한 설정 예시

```yaml
# 예시 1: args만 지정 (이미지의 ENTRYPOINT 사용)
containers:
- name: app
  image: sleeper
  args: ["200"]

# 예시 2: command만 지정
containers:
- name: app
  image: ubuntu
  command: ["sleep", "300"]

# 예시 3: 복잡한 명령어
containers:
- name: app
  image: busybox
  command: ["/bin/sh", "-c"]
  args:
  - |
    echo "Starting..."
    sleep 100
    echo "Done"

# 예시 4: 환경변수 참조
containers:
- name: app
  image: busybox
  command: ["sleep"]
  args: ["$(SLEEP_DURATION)"]
  env:
  - name: SLEEP_DURATION
    value: "500"
```

---

## 4. 환경변수 (Environment Variables)

### 직접 정의

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: APP_ENV
      value: "production"
    - name: DEBUG
      value: "false"
    - name: PORT
      value: "8080"
```

### Pod 정보 참조 (Downward API)

```yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: CPU_LIMIT
  valueFrom:
    resourceFieldRef:
      containerName: app
      resource: limits.cpu
```

### ConfigMap에서 참조

```yaml
env:
- name: DATABASE_URL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: database_url
```

### Secret에서 참조

```yaml
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: password
```

---

## 5. ConfigMap

### ConfigMap 개념

설정 데이터를 Pod와 **분리**하여 관리합니다. 이미지를 수정하지 않고 환경별 설정을 적용할 수 있습니다.

```
┌─────────────────┐      ┌─────────────────┐
│    ConfigMap    │      │       Pod       │
│ ─────────────── │      │ ─────────────── │
│ DB_HOST=mysql   │─────▶│ env/volume으로  │
│ LOG_LEVEL=info  │      │ 주입            │
│ CACHE_SIZE=256  │      └─────────────────┘
└─────────────────┘
```

### ConfigMap 생성

#### 명령형 방식

```bash
# 리터럴 값으로 생성
kubectl create configmap app-config \
  --from-literal=DB_HOST=mysql \
  --from-literal=LOG_LEVEL=info

# 파일에서 생성
kubectl create configmap app-config --from-file=config.properties

# 디렉토리에서 생성
kubectl create configmap app-config --from-file=config/

# 특정 키로 파일 내용 저장
kubectl create configmap nginx-config --from-file=nginx.conf=/etc/nginx/nginx.conf
```

#### 선언형 방식

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  # 단순 키-값
  DB_HOST: "mysql"
  LOG_LEVEL: "info"

  # 파일 형태
  application.properties: |
    server.port=8080
    spring.profiles.active=prod

  nginx.conf: |
    server {
        listen 80;
        location / {
            proxy_pass http://backend:8080;
        }
    }
```

### ConfigMap 사용

#### 환경변수로 주입

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: my-app
    # 개별 키 참조
    env:
    - name: DATABASE_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: DB_HOST
    # 모든 키를 환경변수로 주입
    envFrom:
    - configMapRef:
        name: app-config
```

#### 볼륨으로 마운트

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/conf.d
      readOnly: true
  volumes:
  - name: config-volume
    configMap:
      name: nginx-config
      # 특정 키만 선택
      items:
      - key: nginx.conf
        path: default.conf
```

### ConfigMap 업데이트

```bash
# 직접 편집
kubectl edit configmap app-config

# YAML 적용
kubectl apply -f configmap.yaml
```

- **환경변수**: Pod 재시작 필요
- **볼륨 마운트**: 자동 업데이트 (kubelet sync 주기에 따라)

---

## 6. Secrets

### Secrets 개념

비밀번호, API 키, 인증서 등 **민감한 정보**를 저장합니다. 데이터는 **Base64 인코딩**되어 저장됩니다.

### Secret 생성

#### 명령형 방식

```bash
# 리터럴 값으로 생성
kubectl create secret generic db-secret \
  --from-literal=username=admin \
  --from-literal=password=S3cr3t!

# 파일에서 생성
kubectl create secret generic tls-secret \
  --from-file=tls.crt=/path/to/tls.crt \
  --from-file=tls.key=/path/to/tls.key

# TLS Secret 생성
kubectl create secret tls my-tls-secret \
  --cert=/path/to/tls.crt \
  --key=/path/to/tls.key

# Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=user \
  --docker-password=pass \
  --docker-email=user@example.com
```

#### 선언형 방식

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  # Base64 인코딩된 값
  username: YWRtaW4=      # admin
  password: UzNjcjN0IQ==  # S3cr3t!
---
# stringData는 평문으로 작성 (저장 시 자동 인코딩)
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  api-key: "my-api-key-12345"
  config.yaml: |
    database:
      password: secret123
```

### Base64 인코딩/디코딩

```bash
# 인코딩
echo -n "admin" | base64
# YWRtaW4=

# 디코딩
echo "YWRtaW4=" | base64 -d
# admin
```

### Secret 사용

#### 환경변수로 주입

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DB_USERNAME
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: username
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    # 모든 Secret 키를 환경변수로
    envFrom:
    - secretRef:
        name: db-secret
```

#### 볼륨으로 마운트

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secret-volume
    secret:
      secretName: db-secret
      defaultMode: 0400  # 파일 권한
```

### Secret 타입

| 타입 | 설명 |
|:-----|:-----|
| `Opaque` | 일반적인 시크릿 (기본값) |
| `kubernetes.io/tls` | TLS 인증서 |
| `kubernetes.io/dockerconfigjson` | Docker 레지스트리 인증 |
| `kubernetes.io/basic-auth` | 기본 인증 |
| `kubernetes.io/ssh-auth` | SSH 인증 |
| `kubernetes.io/service-account-token` | 서비스 계정 토큰 |

### Secret 보안 고려사항

1. **etcd 암호화**: Secret은 기본적으로 etcd에 평문 저장됨, 암호화 설정 필요
2. **RBAC**: Secret 접근 권한 제한
3. **Git 제외**: `.gitignore`에 Secret YAML 추가
4. **외부 솔루션**: HashiCorp Vault, AWS Secrets Manager 등 활용

---

## 7. 멀티 컨테이너 Pod

### 멀티 컨테이너 Pod 개념

하나의 Pod에 여러 컨테이너가 함께 실행됩니다. 같은 **네트워크 네임스페이스**와 **스토리지**를 공유합니다.

```
┌─────────────────────────────────────────┐
│                   Pod                   │
│  ┌───────────┐    ┌───────────┐        │
│  │   Main    │    │  Sidecar  │        │
│  │ Container │◀──▶│ Container │        │
│  └───────────┘    └───────────┘        │
│         │               │               │
│         └───────┬───────┘               │
│                 ▼                       │
│        ┌───────────────┐               │
│        │ Shared Volume │               │
│        └───────────────┘               │
└─────────────────────────────────────────┘
```

### 디자인 패턴

#### Sidecar 패턴

메인 컨테이너를 **보조**하는 기능을 제공합니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  containers:
  # 메인 애플리케이션
  - name: app
    image: my-app
    volumeMounts:
    - name: logs
      mountPath: /var/log/app

  # 로그 수집 Sidecar
  - name: log-shipper
    image: fluentd
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
      readOnly: true

  volumes:
  - name: logs
    emptyDir: {}
```

**사용 사례**:
- 로그 수집/전송 (Fluentd, Filebeat)
- 프록시 (Envoy, Istio sidecar)
- 설정 동기화
- 모니터링 에이전트

#### Adapter 패턴

메인 컨테이너의 출력을 **표준화/변환**합니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-adapter
spec:
  containers:
  - name: app
    image: legacy-app
    volumeMounts:
    - name: logs
      mountPath: /var/log/app

  # 로그 형식 변환 Adapter
  - name: log-adapter
    image: log-transformer
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
    - name: transformed-logs
      mountPath: /var/log/transformed

  volumes:
  - name: logs
    emptyDir: {}
  - name: transformed-logs
    emptyDir: {}
```

**사용 사례**:
- 로그 형식 변환 (레거시 → JSON)
- 메트릭 형식 변환 (Prometheus exporter)
- 데이터 정규화

#### Ambassador 패턴

메인 컨테이너의 네트워크 연결을 **프록시**합니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-ambassador
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DATABASE_HOST
      value: "localhost"  # Ambassador로 연결
    - name: DATABASE_PORT
      value: "5432"

  # DB 연결 Ambassador
  - name: db-ambassador
    image: haproxy
    ports:
    - containerPort: 5432
```

**사용 사례**:
- DB 커넥션 풀링
- 서비스 디스커버리
- 로드 밸런싱
- 인증/암호화 처리

### 컨테이너 간 통신

```yaml
# localhost로 통신 (같은 네트워크 네임스페이스)
containers:
- name: web
  image: nginx
  ports:
  - containerPort: 80
- name: metrics
  image: metrics-collector
  env:
  - name: TARGET_URL
    value: "http://localhost:80/metrics"
```

---

## 8. Init Containers

### Init Container 개념

메인 컨테이너 실행 **전에** 초기화 작업을 수행하는 컨테이너입니다.

```
┌─────────────────────────────────────────────────┐
│                    Pod 시작                      │
│                       │                          │
│    ┌──────────────────┼──────────────────┐      │
│    ▼                  ▼                  ▼      │
│ [Init 1] ────▶ [Init 2] ────▶ [Init 3]         │
│    │              │              │               │
│    └──────────────┴──────────────┘               │
│                       │                          │
│                       ▼ (모두 성공 시)            │
│              [Main Containers]                   │
└─────────────────────────────────────────────────┘
```

### 특징

- **순차 실행**: 정의된 순서대로 하나씩 실행
- **완료 필수**: 각 Init Container가 성공해야 다음으로 진행
- **재시도**: 실패 시 Pod의 restartPolicy에 따라 재시도
- **리소스 분리**: 메인 컨테이너와 다른 리소스 요청 가능

### 사용 예시

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  initContainers:
  # 1. 의존 서비스 대기
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c',
      'until nc -z mysql 3306; do echo waiting for mysql; sleep 2; done']

  # 2. 설정 파일 다운로드
  - name: download-config
    image: busybox
    command: ['wget', '-O', '/config/app.conf', 'http://config-server/app.conf']
    volumeMounts:
    - name: config
      mountPath: /config

  # 3. 데이터베이스 마이그레이션
  - name: db-migrate
    image: my-app:migrate
    command: ['./migrate', '--database', '$(DATABASE_URL)']
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url

  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: config
      mountPath: /etc/app

  volumes:
  - name: config
    emptyDir: {}
```

### Init Container vs Sidecar

| 특성 | Init Container | Sidecar |
|:-----|:---------------|:--------|
| 실행 시점 | 메인 컨테이너 전 | 메인과 동시 |
| 지속성 | 완료 후 종료 | 계속 실행 |
| 용도 | 초기화, 전제조건 확인 | 보조 기능 제공 |

### Init Container 상태 확인

```bash
# Pod 상태에서 Init Container 확인
kubectl get pod app

# 상세 정보
kubectl describe pod app

# Init Container 로그 확인
kubectl logs app -c wait-for-db
```

---

## 9. 오토스케일링 개요

### 스케일링 유형

```
┌─────────────────────────────────────────────────────────────┐
│                      스케일링 방식                           │
├─────────────────────────────┬───────────────────────────────┤
│      수직 (Vertical)         │      수평 (Horizontal)        │
│  리소스(CPU/메모리) 증가     │    인스턴스 수 증가           │
├─────────────────────────────┼───────────────────────────────┤
│  [Pod: 1 CPU]               │  [Pod] [Pod]                  │
│       ↓                     │       ↓                       │
│  [Pod: 4 CPU]               │  [Pod] [Pod] [Pod] [Pod]      │
└─────────────────────────────┴───────────────────────────────┘
```

### Kubernetes 스케일링 영역

| 영역 | 수평 스케일링 | 수직 스케일링 |
|:-----|:-------------|:-------------|
| **워크로드** | Pod 수 증가 (HPA) | Pod 리소스 증가 (VPA) |
| **클러스터** | 노드 추가 (Cluster Autoscaler) | 노드 리소스 증가 (비권장) |

### 스케일링 방법

#### 수동 스케일링

```bash
# 수평: 레플리카 수 조정
kubectl scale deployment my-app --replicas=5

# 수직: 리소스 제한 변경
kubectl edit deployment my-app
# resources.requests/limits 수정
```

#### 자동 스케일링

- **HPA (Horizontal Pod Autoscaler)**: CPU/메모리/커스텀 메트릭 기반 Pod 수 조정
- **VPA (Vertical Pod Autoscaler)**: 리소스 사용량 기반 Pod 리소스 조정
- **Cluster Autoscaler**: 클라우드 환경에서 노드 자동 추가/제거

---

## 10. Horizontal Pod Autoscaler (HPA)

### HPA 개념

CPU/메모리 사용량이나 커스텀 메트릭을 모니터링하여 **Pod 수를 자동 조절**합니다.

```
                    ┌──────────────────┐
                    │  Metrics Server  │
                    └────────┬─────────┘
                             │ 메트릭 수집
                             ▼
┌──────────────────────────────────────────────────┐
│                      HPA                          │
│  ┌─────────────────────────────────────────────┐ │
│  │ Target: 50% CPU                              │ │
│  │ Min Replicas: 2                              │ │
│  │ Max Replicas: 10                             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────┘
                      │ 스케일 결정
                      ▼
            ┌─────────────────────┐
            │     Deployment      │
            │  replicas: 2 → 5    │
            └─────────────────────┘
```

### HPA 생성

#### 명령형 방식

```bash
# CPU 기반 HPA 생성
kubectl autoscale deployment my-app \
  --cpu-percent=50 \
  --min=2 \
  --max=10
```

#### 선언형 방식 (v2)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  # CPU 기반
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  # 메모리 기반
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

### 다양한 메트릭 타입

```yaml
metrics:
# 1. Resource (CPU/Memory)
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 50

# 2. Pods (커스텀 메트릭)
- type: Pods
  pods:
    metric:
      name: packets-per-second
    target:
      type: AverageValue
      averageValue: 1k

# 3. Object (다른 K8s 오브젝트의 메트릭)
- type: Object
  object:
    metric:
      name: requests-per-second
    describedObject:
      apiVersion: networking.k8s.io/v1
      kind: Ingress
      name: main-route
    target:
      type: Value
      value: 10k

# 4. External (외부 메트릭 - Datadog, Prometheus 등)
- type: External
  external:
    metric:
      name: queue_messages_ready
      selector:
        matchLabels:
          queue: worker-tasks
    target:
      type: AverageValue
      averageValue: 30
```

### HPA 동작 제어

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  behavior:
    # 스케일 업 동작
    scaleUp:
      stabilizationWindowSeconds: 0  # 즉시 스케일 업
      policies:
      - type: Percent
        value: 100           # 최대 100% 증가
        periodSeconds: 15
      - type: Pods
        value: 4             # 또는 최대 4개 추가
        periodSeconds: 15
      selectPolicy: Max      # 더 많이 스케일하는 정책 선택

    # 스케일 다운 동작
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정화 기간
      policies:
      - type: Percent
        value: 10            # 최대 10% 감소
        periodSeconds: 60
```

### HPA 상태 확인

```bash
# HPA 목록
kubectl get hpa

# 상세 정보
kubectl describe hpa my-app-hpa

# 출력 예시
NAME         REFERENCE           TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
my-app-hpa   Deployment/my-app   45%/50%   2         10        4          1h
```

### HPA 전제 조건

1. **Metrics Server 설치**: 리소스 메트릭 수집
2. **Resource Requests 설정**: Pod에 CPU/메모리 requests 필수

```yaml
containers:
- name: app
  image: my-app
  resources:
    requests:
      cpu: "100m"      # HPA가 이 값 기준으로 사용률 계산
      memory: "128Mi"
```

---

## 11. In-place Pod 리사이징

### 개념

기존 방식에서는 Pod 리소스 변경 시 **Pod 재시작**이 필요했습니다. In-place 리사이징은 Pod를 **재시작하지 않고** 리소스를 조절합니다.

```
기존 방식:
[Pod v1: 1CPU] ──삭제──▶ [새 Pod v2: 2CPU]

In-place 리사이징:
[Pod: 1CPU] ──────────▶ [Pod: 2CPU] (동일 Pod)
```

### 현재 상태 (Kubernetes 1.32 기준)

- **알파 기능** (Kubernetes 1.27부터)
- 기본 비활성화
- 프로덕션 사용 비권장

### 활성화 방법

```bash
# kube-apiserver, kube-scheduler, kubelet에 feature gate 설정
--feature-gates=InPlacePodVerticalScaling=true
```

### 사용 예시

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "200m"
        memory: "256Mi"
    # 리소스별 재시작 정책
    resizePolicy:
    - resourceName: cpu
      restartPolicy: NotRequired  # CPU 변경 시 재시작 불필요
    - resourceName: memory
      restartPolicy: RestartContainer  # 메모리 변경 시 재시작
```

### 제한사항

- CPU와 메모리만 지원
- QoS 클래스 변경 불가
- Init/임시 컨테이너 미지원
- 메모리 제한은 현재 사용량 이하로 줄일 수 없음
- Windows 미지원

---

## 12. Vertical Pod Autoscaler (VPA)

### VPA 개념

Pod의 **CPU/메모리 리소스 요청/제한을 자동 조정**합니다. HPA가 Pod 수를 조절하는 반면, VPA는 개별 Pod의 리소스를 조절합니다.

### VPA 구성요소

```
┌─────────────────────────────────────────────────────────┐
│                         VPA                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Recommender │  │   Updater   │  │ Admission       │ │
│  │             │  │             │  │ Controller      │ │
│  │ 메트릭 분석  │  │ Pod 재시작   │  │ 리소스 값 주입  │ │
│  │ 추천값 계산  │  │ 트리거      │  │ (Pod 생성 시)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### VPA 설치

```bash
# VPA는 기본 제공되지 않음, GitHub에서 설치
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-up.sh
```

### VPA 생성

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "4"
        memory: "8Gi"
      controlledResources: ["cpu", "memory"]
```

### Update Mode

| 모드 | 동작 |
|:-----|:-----|
| `Off` | 추천값만 제공, 실제 변경 없음 (분석용) |
| `Initial` | Pod 생성 시에만 추천값 적용 |
| `Recreate` | 리소스 범위 초과 시 Pod 재생성 |
| `Auto` | 현재 Recreate와 동일, 향후 in-place 지원 예정 |

### VPA 추천값 확인

```bash
# VPA 상태 확인
kubectl describe vpa my-app-vpa

# 출력 예시
Recommendation:
  Container Recommendations:
    Container Name:  app
    Lower Bound:
      Cpu:     100m
      Memory:  262144k
    Target:
      Cpu:     500m
      Memory:  524288k
    Upper Bound:
      Cpu:     2
      Memory:  1Gi
```

### HPA vs VPA 비교

| 특성 | HPA | VPA |
|:-----|:----|:----|
| **스케일 방식** | Pod 수 증가 | Pod 리소스 증가 |
| **Pod 동작** | 기존 Pod 유지, 새 Pod 추가 | Pod 재시작 필요 |
| **트래픽 급증 대응** | 빠른 확장 가능 | 재시작 지연 발생 |
| **비용 최적화** | 유휴 Pod 방지 | 과잉 프로비저닝 방지 |
| **다운타임** | 없음 | 있음 (재시작 시) |

### 적합한 워크로드

**VPA 적합**:
- 상태 유지(Stateful) 워크로드
- 데이터베이스 (MySQL, PostgreSQL)
- JVM 기반 애플리케이션
- AI/ML 워크로드
- 배치 작업

**HPA 적합**:
- 상태 비저장(Stateless) 워크로드
- 웹 서버 (Nginx, Apache)
- API 서버
- 마이크로서비스
- 메시지 큐 컨슈머

### HPA + VPA 조합

일반적으로 동일 리소스에 대해 HPA와 VPA를 **함께 사용하지 않는 것**이 권장됩니다. 단, 다른 메트릭 사용 시 가능:

```yaml
# VPA: CPU/메모리 리소스 최적화 (Off 모드)
# HPA: 커스텀 메트릭 기반 스케일링
```

---

## 13. 명령어 요약

```bash
# Rollout
kubectl rollout status deployment/my-app
kubectl rollout history deployment/my-app
kubectl rollout undo deployment/my-app
kubectl rollout undo deployment/my-app --to-revision=2
kubectl rollout pause deployment/my-app
kubectl rollout resume deployment/my-app

# 스케일링
kubectl scale deployment my-app --replicas=5
kubectl autoscale deployment my-app --cpu-percent=50 --min=2 --max=10

# ConfigMap
kubectl create configmap app-config --from-literal=KEY=VALUE
kubectl create configmap app-config --from-file=config.properties
kubectl get configmap
kubectl describe configmap app-config

# Secret
kubectl create secret generic db-secret --from-literal=password=secret
kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key
kubectl get secret
kubectl describe secret db-secret

# HPA
kubectl get hpa
kubectl describe hpa my-app-hpa
kubectl delete hpa my-app-hpa

# VPA
kubectl get vpa
kubectl describe vpa my-app-vpa

# 디버깅
kubectl describe pod my-pod
kubectl logs my-pod -c init-container
kubectl get events
```
