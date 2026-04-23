---
title: "04. 워크로드 관리"
weight: 4
---

쿠버네티스 워크로드의 정의부터 무중단 배포, 설정 주입, 멀티 컨테이너 구성까지 다룬다.

## 1. kubectl 기본 흐름

모든 리소스 조작은 kubectl 명령어로 시작된다. 명령형과 선언형 두 가지 방식이 있으며 실무에서는 **선언형(apply)** 을 권장한다.

| 명령 | 방식 | 용도 |
|:---|:---|:---|
| `kubectl create` | 명령형 | 새 리소스 생성 (덮어쓰기 불가) |
| `kubectl apply -f` | 선언형 | 생성 + 변경 (권장) |
| `kubectl get` | 조회 | 리소스 목록/상태 |
| `kubectl describe` | 조회 | 상세 이벤트·원인 |
| `kubectl edit` | 변경 | 인라인 YAML 편집 |
| `kubectl delete` | 삭제 | 리소스 제거 |
| `kubectl exec -it` | 디버깅 | 컨테이너 접속 |

```bash
# 빠른 Deployment 생성과 확인
kubectl create deployment my-httpd --image=httpd --replicas=3 --port=80
kubectl get deployment
kubectl get pod -o wide         # IP, Node 포함
kubectl exec -it my-httpd-xxx -- /bin/bash
```

`kubectl get` 출력의 주요 컬럼은 다음과 같다.

| 컬럼 | 의미 |
|:---|:---|
| READY | 원하는 개수 대비 준비된 파드 |
| UP-TO-DATE | 최신 리비전 파드 수 |
| AVAILABLE | 사용 가능한 파드 수 |
| RESTARTS | 재시작 누적 횟수 |
| AGE | 생성 후 경과 시간 |

## 2. YAML 매니페스트

**매니페스트**는 원하는 상태를 선언한 파일이다. kubectl은 이 파일을 API 서버에 제출하고, 컨트롤러가 실제 상태를 원하는 상태에 맞춘다.

### 작성 규칙

| 규칙 | 설명 |
|:---|:---|
| `-` | 리스트 항목 표시 |
| `:` | 키-값 구분 (공백 필수) |
| `---` | 멀티 도큐먼트 구분자 |
| `#` | 주석 |
| 들여쓰기 | **스페이스만** 사용 (탭 금지) |

### 공통 4요소

모든 매니페스트는 `apiVersion`, `kind`, `metadata`, `spec`을 갖는다.

```yaml
apiVersion: apps/v1          # API 그룹/버전
kind: Deployment             # 오브젝트 종류
metadata:
  name: my-app               # 이름 (네임스페이스 내 유일)
  labels:
    app: my-app              # 셀렉터 매칭용 레이블
spec:
  replicas: 3                # 원하는 파드 수
  selector:
    matchLabels:
      app: my-app            # template 레이블과 일치해야 함
  template:                  # 파드 템플릿
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: nginx:1.25
        ports:
        - containerPort: 80
```

{{< callout type="info" >}}
`selector.matchLabels`는 `template.metadata.labels`와 **반드시 일치**해야 한다. 어긋나면 디플로이먼트가 자신의 파드를 찾지 못해 끝없이 생성한다.
{{< /callout >}}

## 3. 주요 워크로드 오브젝트

쿠버네티스는 용도별로 다양한 워크로드 리소스를 제공한다.

| 오브젝트 | 용도 | 특징 |
|:---|:---|:---|
| Pod | 단일/묶음 컨테이너 실행 | 최소 배포 단위, 단독 사용 비권장 |
| ReplicaSet | 파드 개수 유지 | 보통 Deployment가 감싼다 |
| Deployment | 상태 비저장 앱 배포·롤아웃 | 버전 관리, 롤백 지원 |
| StatefulSet | 상태 유지 앱 | 고정 이름·순서, PVC 결합 |
| DaemonSet | 모든 노드에 1개씩 | 로그 수집, 모니터링 에이전트 |
| Job | 1회성 작업 완주 | 성공까지 재시도 |
| CronJob | 주기 실행 Job | 스케줄 기반 배치 |

### Pod와 사이드카

Pod는 같은 네트워크 네임스페이스와 볼륨을 공유하는 컨테이너 묶음이다.

```
┌──────────────────────────────┐
│             Pod              │
│  ┌─────────┐  ┌──────────┐   │
│  │  Main   │  │ Sidecar  │   │
│  │  (앱)   │  │ (로그수집)│   │
│  └────┬────┘  └─────┬────┘   │
│       └──── 공유 ───┘         │
│       (네트워크·볼륨)          │
└──────────────────────────────┘
```

### ReplicaSet

지정한 개수의 파드를 항상 유지한다. 직접 작성하기보다 Deployment 내부에서 자동 생성되는 경우가 많다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: nginx
        image: nginx
```

```bash
kubectl scale rs/my-rs --replicas=5
kubectl delete rs my-rs --cascade=orphan  # RS만 제거, 파드 보존
```

### DaemonSet

모든 (혹은 선택된) 노드에 파드 1개씩 배치한다. 로그 수집기, 메트릭 에이전트에 사용한다.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      tier: monitoring
  template:
    metadata:
      labels:
        tier: monitoring
    spec:
      containers:
      - name: exporter
        image: prom/node-exporter
        ports:
        - containerPort: 9100
```

### Job과 CronJob

Job은 완주가 목표인 1회성 작업이고, CronJob은 Job을 주기적으로 만든다.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"        # 매일 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command: ["/bin/sh", "-c", "echo backup done"]
          restartPolicy: OnFailure
```

CronJob 스케줄은 표준 crontab 형식을 따른다.

```
┌───── 분 (0-59)
│ ┌─── 시 (0-23)
│ │ ┌─ 일 (1-31)
│ │ │ ┌─ 월 (1-12)
│ │ │ │ ┌─ 요일 (0-6)
│ │ │ │ │
* * * * *
```

## 4. Deployment 배포 전략

Deployment는 ReplicaSet을 통해 파드를 관리하면서 **새 버전으로의 전환 방식**을 지정할 수 있다.

```
┌──────────────┬──────────────┐
│   Recreate   │ RollingUpdate│
│  (재생성)    │  (기본값)     │
├──────────────┼──────────────┤
│ 전체 종료→생성│ 점진 교체    │
│ 다운타임 O   │ 무중단        │
│ 리소스 적음  │ 리소스 여유   │
└──────────────┴──────────────┘

  Blue/Green        Canary
  (서비스 전환)    (트래픽 분할)
```

### Recreate

모든 파드를 내린 뒤 새 파드를 띄운다. 다운타임이 허용되거나 같은 버전 동시 실행이 불가능한 경우 사용한다.

```yaml
spec:
  strategy:
    type: Recreate
```

### RollingUpdate (기본)

기존 파드를 조금씩 교체한다. **maxSurge**(추가 허용 개수)와 **maxUnavailable**(부족 허용 개수)로 속도와 가용성을 조절한다.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 추가로 띄울 수 있는 파드
      maxUnavailable: 0    # 동시에 내려도 되는 파드
```

교체 과정을 단순화하면 다음과 같다.

```
Step 1  [v1][v1][v1][v2*]
Step 2  [v1][v1][v2][v2*]
Step 3  [v1][v2][v2][v2*]
Step 4  [v2][v2][v2]
                (* 생성 중)
```

| maxSurge | maxUnavailable | 성격 |
|:---|:---|:---|
| 25% | 25% | 기본값, 균형 |
| 1 | 0 | 가용성 우선 |
| 0 | 1 | 자원 절약 |
| 50% | 0 | 빠른 배포 + 무중단 |

{{< callout type="warning" >}}
`maxSurge`와 `maxUnavailable`을 **둘 다 0으로 설정하면 롤아웃이 멈춘다.** 최소 한쪽은 0보다 커야 파드가 움직인다.
{{< /callout >}}

### Blue/Green과 Canary

- **Blue/Green**: v1(blue)과 v2(green)을 동시에 띄우고 Service `selector`만 바꿔 트래픽을 전환한다. 롤백이 빠르다.
- **Canary**: 일부 트래픽만 v2로 보내 검증한 뒤 점진 확대한다. Deployment 2개로 구성하거나 Ingress/Service Mesh로 트래픽 비율을 조절한다.

## 5. Rollout과 Rollback

Deployment 변경은 **Rollout**을 트리거하고, 각 변경은 새로운 **Revision**으로 기록된다.

```
Deploy v1 ─▶ Revision 1
  │ update
  ▼
Deploy v2 ─▶ Revision 2
  │ update
  ▼
Deploy v3 ─▶ Revision 3
```

### 상태와 이력 조회

```bash
kubectl rollout status deployment/my-app
kubectl rollout history deployment/my-app
kubectl rollout history deployment/my-app --revision=2
```

### 이미지 업데이트

```bash
# 이미지만 교체 (권장)
kubectl set image deployment/my-app nginx=nginx:1.25

# YAML 수정 후 반영
kubectl apply -f deployment.yaml

# 인라인 편집
kubectl edit deployment my-app
```

### 롤백과 일시 정지

```bash
# 바로 이전 리비전으로
kubectl rollout undo deployment/my-app

# 특정 리비전으로
kubectl rollout undo deployment/my-app --to-revision=2

# 롤아웃 제어
kubectl rollout pause  deployment/my-app
kubectl rollout resume deployment/my-app
```

보관 리비전 개수는 `revisionHistoryLimit`(기본 10)으로 조절한다.

```yaml
spec:
  revisionHistoryLimit: 5
```

## 6. Command와 Args

컨테이너 진입점은 Dockerfile의 `ENTRYPOINT`/`CMD`에 대응한다.

| Docker | Kubernetes | 역할 |
|:---|:---|:---|
| ENTRYPOINT | `command` | 실행 프로그램 |
| CMD | `args` | 인자 |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sleeper
spec:
  containers:
  - name: sleeper
    image: ubuntu
    command: ["sleep"]     # ENTRYPOINT 대체
    args: ["100"]          # CMD 대체
```

복잡한 셸 파이프라인은 `sh -c`와 함께 쓴다.

```yaml
containers:
- name: app
  image: busybox
  command: ["/bin/sh", "-c"]
  args:
  - |
    echo "Starting..."
    sleep 100
    echo "Done"
```

## 7. 환경변수 주입

### 직접 정의

```yaml
env:
- name: APP_ENV
  value: "production"
- name: PORT
  value: "8080"
```

### Downward API (파드 자신의 정보)

```yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
```

## 8. ConfigMap

설정값을 이미지에서 분리해 환경별로 교체 가능하게 한다.

```
┌──────────────┐      ┌──────────────┐
│  ConfigMap   │      │     Pod      │
│ ──────────── │ ───▶ │ env /        │
│ DB_HOST=...  │      │ volumeMount  │
│ LOG_LEVEL=.. │      │   주입       │
└──────────────┘      └──────────────┘
```

### 생성

```bash
# 리터럴
kubectl create configmap app-config \
  --from-literal=DB_HOST=mysql \
  --from-literal=LOG_LEVEL=info

# 파일
kubectl create configmap nginx-config \
  --from-file=nginx.conf=/etc/nginx/nginx.conf
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "mysql"
  LOG_LEVEL: "info"
  application.properties: |
    server.port=8080
    spring.profiles.active=prod
```

### 사용: 환경변수

```yaml
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DATABASE_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: DB_HOST
    envFrom:
    - configMapRef:
        name: app-config   # 모든 키를 한 번에
```

### 사용: 볼륨 마운트

```yaml
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: conf
      mountPath: /etc/nginx/conf.d
      readOnly: true
  volumes:
  - name: conf
    configMap:
      name: nginx-config
      items:
      - key: nginx.conf
        path: default.conf
```

- `env` 방식은 ConfigMap 수정 시 **파드 재시작 필요**
- 볼륨 방식은 kubelet sync 주기에 따라 **자동 반영**

## 9. Secret

패스워드·API 키 등 민감 정보를 저장한다. 값은 **Base64 인코딩**되어 전달된다.

{{< callout type="warning" >}}
**Base64는 암호화가 아니다.** 누구나 디코딩할 수 있으므로 Secret은 etcd 암호화, RBAC 제한, `.gitignore` 등록, HashiCorp Vault/AWS Secrets Manager 같은 외부 솔루션과 함께 보호해야 한다.
{{< /callout >}}

### 생성

```bash
# 일반 Secret
kubectl create secret generic db-secret \
  --from-literal=username=admin \
  --from-literal=password='S3cr3t!'

# TLS 인증서
kubectl create secret tls my-tls \
  --cert=tls.crt --key=tls.key

# Docker 레지스트리 자격증명
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=user --docker-password=pass \
  --docker-email=u@example.com
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:                 # 평문으로 작성 (자동 인코딩)
  username: admin
  password: S3cr3t!
```

### Secret 타입

| 타입 | 용도 |
|:---|:---|
| `Opaque` | 기본, 임의 키-값 |
| `kubernetes.io/tls` | TLS 인증서 |
| `kubernetes.io/dockerconfigjson` | 레지스트리 자격증명 |
| `kubernetes.io/basic-auth` | 기본 인증 |
| `kubernetes.io/ssh-auth` | SSH 키 |

### 사용

```yaml
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    volumeMounts:
    - name: tls
      mountPath: /etc/tls
      readOnly: true
  volumes:
  - name: tls
    secret:
      secretName: my-tls
      defaultMode: 0400
```

## 10. Init Container

메인 컨테이너 실행 **전에** 초기화를 수행하는 컨테이너다. 순차 실행되며, 모두 성공해야 메인이 시작된다.

```
┌──────────── Pod 시작 ───────────┐
│                                  │
│ [Init 1] ▶ [Init 2] ▶ [Init 3]  │
│                                  │
│              ▼ (모두 성공)        │
│        [Main Containers]         │
└──────────────────────────────────┘
```

| 특성 | Init Container | Sidecar |
|:---|:---|:---|
| 실행 시점 | 메인 이전 | 메인과 동시 |
| 지속성 | 완료 후 종료 | 계속 실행 |
| 용도 | 의존성 대기, 마이그레이션 | 로그/프록시/모니터링 |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  initContainers:
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c',
      'until nc -z mysql 3306; do sleep 2; done']
  - name: db-migrate
    image: my-app:migrate
    command: ['./migrate']
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url
  containers:
  - name: app
    image: my-app
```

```bash
kubectl describe pod app
kubectl logs app -c wait-for-db     # Init 컨테이너 로그
```

## 11. 멀티 컨테이너 패턴

한 Pod에 여러 컨테이너를 두는 구성은 세 가지 표준 패턴이 있다.

| 패턴 | 역할 | 예시 |
|:---|:---|:---|
| Sidecar | 보조 기능 추가 | Fluentd 로그 수집, Envoy 프록시 |
| Adapter | 출력 표준화 | 레거시 로그 → JSON 변환 |
| Ambassador | 외부 연결 프록시 | DB 커넥션 풀, 서비스 디스커버리 |

```yaml
# Sidecar 예: 앱 + 로그 수집기
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  - name: log-shipper
    image: fluent/fluentd
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
      readOnly: true
  volumes:
  - name: logs
    emptyDir: {}
```

같은 Pod 안에서는 `localhost`로 서로 통신할 수 있다.

## 12. 오토스케일링 개요

| 영역 | 수평 | 수직 |
|:---|:---|:---|
| 워크로드 | HPA (파드 수) | VPA (파드 리소스) |
| 클러스터 | Cluster Autoscaler (노드 추가) | 노드 리소스 증가 (비권장) |

```bash
# 수동 스케일링
kubectl scale deployment my-app --replicas=5

# 간단한 HPA 생성
kubectl autoscale deployment my-app \
  --cpu-percent=50 --min=2 --max=10
```

HPA/VPA의 상세 설정, 메트릭 종류, 동작 튜닝은 [09장. 관측성과 스케일링](09-observability)에서 다룬다.

## 13. 명령어 요약

```bash
# 배포·롤아웃
kubectl apply -f deployment.yaml
kubectl set image deployment/my-app nginx=nginx:1.25
kubectl rollout status  deployment/my-app
kubectl rollout history deployment/my-app
kubectl rollout undo    deployment/my-app --to-revision=2
kubectl rollout pause   deployment/my-app
kubectl rollout resume  deployment/my-app

# 스케일링
kubectl scale deployment my-app --replicas=5
kubectl autoscale deployment my-app --cpu-percent=50 --min=2 --max=10

# 설정·비밀
kubectl create configmap app-config --from-literal=KEY=VALUE
kubectl create secret generic db-secret --from-literal=password=secret
kubectl get configmap,secret

# 디버깅
kubectl describe pod my-pod
kubectl logs my-pod -c init-container
kubectl exec -it my-pod -- /bin/bash
kubectl get events --sort-by=.lastTimestamp
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Deployment | 상태 비저장 앱의 롤아웃·롤백 관리 |
| DaemonSet | 모든 노드에 1개씩 배치 (에이전트용) |
| CronJob | 스케줄 기반 Job 반복 실행 |
| RollingUpdate | maxSurge / maxUnavailable로 무중단 교체 |
| Rollback | `rollout undo`로 이전 Revision 복원 |
| ConfigMap | 일반 설정값을 이미지에서 분리 |
| Secret | 민감 정보, Base64 인코딩(암호화 아님) |
| Init Container | 의존성 대기·마이그레이션 등 선행 작업 |
| Sidecar | 메인과 함께 도는 보조 컨테이너 |

{{< callout type="info" >}}
**용어 정리**
- **Manifest**: 원하는 상태를 선언한 YAML 파일
- **Rollout / Revision**: Deployment 변경 단위 / 기록된 이력
- **maxSurge / maxUnavailable**: 롤링 업데이트의 속도·가용성 파라미터
- **ConfigMap**: 일반 설정값 저장 오브젝트
- **Secret**: 민감 정보 저장 오브젝트 (Base64 인코딩)
- **Downward API**: 파드 자신의 메타데이터를 컨테이너에 주입하는 방식
- **Init Container**: 메인 컨테이너보다 먼저 실행되어 완료되는 컨테이너
- **Sidecar / Adapter / Ambassador**: 대표적인 멀티 컨테이너 디자인 패턴
{{< /callout >}}
