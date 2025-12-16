---
title: "Kubernetes 사용하기"
weight: 4
---

## 1. YAML 매니페스트

> **매니페스트**: 쿠버네티스 오브젝트 생성을 위한 메타 정보 파일

### YAML 작성 규칙

| 규칙 | 설명 |
|------|------|
| `-` | 리스트 항목 표시 |
| `:` | 키-값 구분 (공백 필수) |
| `---` | 문서 구분 (다중 오브젝트) |
| `#` | 주석 |
| 들여쓰기 | **Space** 사용 (Tab 불가) |

### 기본 구조

```yaml
apiVersion: apps/v1          # API 버전
kind: Deployment             # 오브젝트 종류
metadata:
  name: my-app               # 이름
  labels:
    app: my-app              # 레이블
spec:
  replicas: 3                # 파드 개수
  selector:
    matchLabels:
      app: my-app
  template:                  # 파드 템플릿
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app         # 리스트는 '-'로
        image: nginx:1.7.9
        ports:
        - containerPort: 80
```

---

## 2. 파드 생성과 관리

### kubectl 명령어

| 명령어 | 설명 |
|--------|------|
| `kubectl create` | 새 리소스 생성 |
| `kubectl apply` | 생성 + 변경 (권장) |
| `kubectl get` | 리소스 조회 |
| `kubectl describe` | 상세 정보 |
| `kubectl delete` | 리소스 삭제 |
| `kubectl exec` | 파드 접속 |

### 파드 생성 및 조회

```bash
# 디플로이먼트로 파드 생성
kubectl create deployment my-httpd --image=httpd --replicas=1 --port=80

# 상태 확인
kubectl get deployment
kubectl get pod
kubectl get pod -o wide      # 상세 정보 (IP, Node 등)

# 파드 접속
kubectl exec -it [파드명] -- /bin/bash
```

### get 출력 항목

| 항목 | 설명 |
|------|------|
| READY | 레플리카 개수 |
| UP-TO-DATE | 최신 상태 레플리카 |
| AVAILABLE | 사용 가능 레플리카 |
| RESTARTS | 재시작 횟수 |
| AGE | 실행 시간 |

### 사이드카 패턴

> 하나의 파드에 **기본 컨테이너 + 부가 컨테이너** 구성

```
┌─────────────────────────────────┐
│             Pod                  │
│  ┌───────────┐  ┌───────────┐   │
│  │   Main    │  │  Sidecar  │   │
│  │ Container │  │ Container │   │
│  │ (웹 서버)  │  │ (로그 수집) │   │
│  └───────────┘  └───────────┘   │
└─────────────────────────────────┘
```

---

## 3. 디플로이먼트 배포 전략

### 4가지 배포 방식

```
┌─────────────────────────────────────────────────────────────┐
│                      배포 전략 비교                           │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   롤링       │   재생성     │  블루/그린   │     카나리        │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ V1 ↓  V2 ↑  │ V1 삭제     │ V1 + V2    │  V1 90% + V2 10% │
│ 점진적 교체  │ V2 일괄 생성 │ 동시 운영   │  점진적 트래픽    │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ 안정적/느림  │ 빠름/위험   │ 안정/자원多 │  테스트 적합      │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

### 1. 롤링 업데이트 (기본)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 추가 생성 가능한 최대 파드
      maxUnavailable: 25%  # 사용 불가 허용 파드
```

### 2. 재생성 (Recreate)

```yaml
spec:
  strategy:
    type: Recreate
```

### 3. 블루/그린

```yaml
# 서비스에서 버전 선택
spec:
  selector:
    app: myapp
    version: v2.0.0  # 트래픽을 v2로 전환
```

### 4. 카나리

- 새 버전에 **점진적 트래픽 증가**
- 기능 테스트 후 전체 전환

---

## 4. 서비스 (Service)

> 파드를 **외부에 노출**시키는 오브젝트

### 디플로이먼트 + 서비스 구조

```
┌─────────────────────────────────────────────────────┐
│                    외부 사용자                       │
└───────────────────────┬─────────────────────────────┘
                        │ :31472 (NodePort)
┌───────────────────────▼─────────────────────────────┐
│                   Service                            │
│                  (nginx-svc)                         │
└───────────────────────┬─────────────────────────────┘
                        │ selector: app=nginx
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │  Pod 1  │    │  Pod 2  │    │  Pod 3  │
   │ (nginx) │    │ (nginx) │    │ (nginx) │
   └─────────┘    └─────────┘    └─────────┘
```

### 서비스 YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-svc
spec:
  type: NodePort           # 외부 노출 타입
  ports:
  - port: 8080             # 서비스 포트
    targetPort: 80         # 컨테이너 포트
    nodePort: 31472        # 외부 접속 포트
  selector:
    app: nginx             # 연결할 파드 레이블
```

```bash
kubectl apply -f nginx-svc.yaml
kubectl get svc
```

---

## 5. 레플리카셋 (ReplicaSet)

> 지정된 개수의 파드를 **항상 유지**

### YAML

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-replicaset
spec:
  replicas: 3              # 유지할 파드 개수
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

### 파드 개수 조정

```bash
# 스케일 조정
kubectl scale replicaset/my-replicaset --replicas=5

# 레플리카셋만 삭제 (파드 유지)
kubectl delete replicaset my-replicaset --cascade=orphan
```

---

## 6. 데몬셋 (DaemonSet)

> **모든 노드에 파드 배포** (모니터링, 로그 수집용)

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: prometheus-daemonset
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
      - name: prometheus
        image: prom/node-exporter
        ports:
        - containerPort: 80
```

---

## 7. 크론잡 (CronJob)

> **주기적 작업 실행** (백업, 배치 작업)

### 스케줄 형식

```
┌───────────── 분 (0-59)
│ ┌───────────── 시간 (0-23)
│ │ ┌───────────── 일 (1-31)
│ │ │ ┌───────────── 월 (1-12)
│ │ │ │ ┌───────────── 요일 (0-6, 0=일요일)
│ │ │ │ │
* * * * *
```

### YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-job
spec:
  schedule: "0 2 * * *"    # 매일 새벽 2시
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command: ["/bin/sh", "-c", "echo Backup completed"]
          restartPolicy: OnFailure
```

```bash
kubectl get cronjob -w    # 실시간 모니터링
```

---

## 8. CoreDNS

> 쿠버네티스 **내부 DNS** 서버

| 항목 | 설명 |
|------|------|
| 네임스페이스 | `kube-system` |
| 서비스명 | `kube-dns` |
| 포트 | 53 (표준 DNS) |
| 역할 | 서비스/파드 → IP 변환 |

- 새 서비스/파드 생성 시 **자동 DNS 등록**
- 파드의 `/etc/resolv.conf`에 자동 설정

---

## 9. 컨피그맵 & 시크릿

### 컨피그맵 (ConfigMap)

> **일반 설정값**을 외부 분리 관리

```bash
# 생성
kubectl create configmap my-config \
  --from-literal=JAVA_HOME=/usr/java \
  --from-literal=DB_URL=localhost:3306

# 파일에서 생성
kubectl create configmap my-config --from-file=config.properties

# 조회
kubectl get configmap my-config -o yaml
```

### 시크릿 (Secret)

> **민감한 정보** (비밀번호, 토큰 등) 저장

```bash
# 생성
kubectl create secret generic my-secret \
  --from-literal=password=mysecretpassword

# 조회
kubectl get secret my-secret -o yaml
```

### 파드에서 사용

```yaml
spec:
  containers:
  - name: app
    image: myapp
    envFrom:
    - configMapRef:
        name: my-config    # 컨피그맵 전체 주입
    - secretRef:
        name: my-secret    # 시크릿 전체 주입
```

---

## 요약

| 오브젝트 | 용도 |
|----------|------|
| **Deployment** | 파드 배포 및 버전 관리 |
| **Service** | 파드 외부 노출 |
| **ReplicaSet** | 파드 개수 유지 |
| **DaemonSet** | 모든 노드에 파드 배포 |
| **CronJob** | 주기적 작업 실행 |
| **ConfigMap** | 일반 설정 관리 |
| **Secret** | 민감 정보 관리 |

### 핵심 명령어

```bash
kubectl apply -f [yaml]      # 생성/수정
kubectl get [리소스]          # 조회
kubectl get [리소스] -o wide  # 상세 조회
kubectl describe [리소스명]   # 세부 정보
kubectl delete [리소스명]     # 삭제
kubectl scale --replicas=N   # 스케일 조정
kubectl exec -it [파드] -- /bin/bash  # 접속
```
