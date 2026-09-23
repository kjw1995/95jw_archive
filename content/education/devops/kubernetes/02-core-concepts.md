---
title: "02. 핵심 개념"
date: 2026-04-23
weight: 2
---

[01. 입문](../01-introduction)에서 쿠버네티스는 원하는 상태로 현재 상태를 끌고 가는 제어 루프이고, 모든 것이 API 서버를 거치는 자원이라고 했다. 이 장은 그 루프를 돌리는 부품들과 자원의 종류를 하나씩 본다. 원리는 셋이다. 첫째, **상태는 한 곳에 있고, 그것을 바꾸는 문은 하나다.** 클러스터의 모든 상태는 etcd에 있고 etcd에 쓸 수 있는 것은 API 서버뿐이다. 스케줄러도 kubelet도 컨트롤러도 서로 말하지 않고 API 서버를 지켜보다 자기 몫을 한다. 둘째, **"몇 개여야 하는가"는 컨트롤러가, "어디에 놓는가"는 스케줄러가, "실제로 띄우는 것"은 kubelet이 맡는다.** Deployment, Job, DaemonSet 같은 워크로드 종류는 결국 "몇 개를 언제 어디에"의 규칙이 다른 컨트롤러들이다. 셋째, **파드는 죽고 IP는 바뀌므로 이름과 고정 주소로 붙는다.** Service가 가상 IP를, DNS가 이름을 주고, 그것을 실제 파드로 보내는 일은 노드마다 도는 kube-proxy의 규칙이 한다. 이 PC의 Docker Desktop 위에 k3s 클러스터를 띄워 이 장의 거의 모든 것을 실제로 확인했다.

---

## 1. 클러스터 아키텍처

```text
┌──────── Control Plane ─────────┐
│  API Server   Scheduler         │
│  Controller   etcd              │
└────────────────┬────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Worker 1│  │Worker 2│  │Worker 3│
│kubelet │  │kubelet │  │kubelet │
│kube-prx│  │kube-prx│  │kube-prx│
│Runtime │  │Runtime │  │Runtime │
│ [Pods] │  │ [Pods] │  │ [Pods] │
└────────┘  └────────┘  └────────┘
```

| 노드 | 역할 | 왜 나누나 |
|:-----|:-----|:---------|
| Control Plane | 상태를 저장하고 결정한다. API 서버, etcd, 스케줄러, 컨트롤러 | 결정은 한 곳에서 일관되게 |
| Worker Node | 결정된 파드를 실제로 띄운다. kubelet, kube-proxy, 런타임 | 실행은 여러 곳에서 나눠서 |

첫째 원리의 지도다. 옛 이름 Master가 지금은 Control Plane인데, 이름이 바뀐 이유는 실제로 "명령하는 주인"이 아니기 때문이다. 컨트롤 플레인은 상태를 저장하고 결정을 적을 뿐이고, 워커의 kubelet이 그것을 읽어 간다. 이 PC의 k3s는 이 둘을 한 노드, 한 프로세스에 묶어 13초 만에 Ready가 됐다.

---

## 2. Control Plane 컴포넌트

### 2.1 etcd

**분산 키-값 저장소**이고, 클러스터의 모든 상태가 여기 있다. 노드, 파드, ConfigMap, Secret, Deployment, 그리고 이 장에서 만들 모든 것이 키 하나씩으로 저장된다.

```bash
# 버전 확인
etcdctl version

# 키-값 저장/조회 (API v3)
ETCDCTL_API=3 etcdctl put key1 value1
ETCDCTL_API=3 etcdctl get key1

# 모든 키 조회
etcdctl get / --prefix --keys-only
```

| 성질 | 뜻 | 왜 etcd인가 |
|:-----|:---|:-----------|
| 키-값 | `/registry/pods/default/web-...` 같은 키에 객체 하나 | 스키마 없이 무엇이든 넣는다 |
| 분산 합의(Raft) | 홀수 대가 다수결로 쓴다 | 한 대가 죽어도 상태를 잃지 않는다 |
| watch | 키가 바뀌면 지켜보는 쪽에 알린다 | 컨트롤러들이 폴링하지 않는다 |
| resourceVersion | 쓸 때마다 오르는 번호 | 누가 먼저 썼는지, 무엇이 바뀌었는지 |

이 PC의 클러스터에서 Deployment 하나를 읽으니 `resourceVersion: 615`였고 잠시 뒤 파드 목록은 `672`였다. 이 번호가 etcd의 수정 번호이고, 클러스터가 바뀔 때마다 하나씩 오른다. k3s는 기본으로 etcd 대신 SQLite를 kine이라는 어댑터로 감싸 쓰는데, API 서버는 그것을 etcd로 알고 말한다. 준비 상태 점검 `/readyz?verbose`에 `[+]etcd ok`가 찍힌 이유다.

{{< callout type="info" >}}
etcd에 기록되어야 비로소 클러스터의 상태가 바뀐 것이다. `kubectl apply`가 돌아왔다는 것은 파드가 떴다는 뜻이 아니라 **"떠야 한다"가 저장됐다**는 뜻이고, 그 뒤의 일은 4절의 순서대로 다른 컴포넌트들이 한다. 그래서 etcd를 잃으면 클러스터를 잃는다. 백업은 [10](../10-cluster-maintenance)장에서 본다.
{{< /callout >}}

### 2.2 kube-apiserver

**모든 요청의 문**이다. kubectl도, 스케줄러도, kubelet도, 컨트롤러도 전부 이 문으로 들어오고, etcd와 직접 말하는 것은 이것뿐이다.

| 하는 일 | 뜻 | 왜 한 곳에서 |
|:-------|:---|:-----------|
| 인증, 인가 | 누구인지, 해도 되는지 | 문이 하나라야 지킬 곳도 하나. [08](../08-security)장 |
| 검증, 어드미션 | 스키마에 맞는지, 정책에 맞는지 | 잘못된 상태가 저장되지 않게 |
| 저장 | etcd에 쓰고 읽는다 | 유일한 etcd 클라이언트 |
| watch 중계 | 바뀐 것을 지켜보는 쪽에 흘려 준다 | 컴포넌트들이 서로 모르게 |

첫째 원리의 문이다. [01](../01-introduction)장에서 본 대로 이 문은 REST API이고, 이 PC에서 `/api/v1/namespaces/default/pods`를 날것으로 부르니 `PodList` JSON이 왔다. 컴포넌트들이 서로 직접 말하지 않고 전부 이 문을 거치므로, 하나를 바꿔 끼워도 나머지는 모른다.

### 2.3 kube-scheduler

**새 파드를 어느 노드에 놓을지** 정한다. 놓기만 정하고, 실제로 띄우는 것은 그 노드의 kubelet이다.

```text
1단계: 필터링
  · 리소스 부족 노드 제외
  · Taints/Tolerations 체크
  · NodeSelector 확인

2단계: 순위 매기기
  · 리소스 활용도 점수
  · 부하 분산 점수
  · Affinity 규칙 점수
  → 최고 점수 노드 선택
```

```text
$ kubectl describe pod big  (cpu 100)
Warning  FailedScheduling
  0/1 nodes are available:
  1 Insufficient cpu.
```

둘째 원리의 "어디에"다. 먼저 못 놓을 노드를 걸러 내고, 남은 노드에 점수를 매겨 하나를 고른다. 이 PC에서 CPU 100개를 요청하는 파드를 만드니 12코어짜리 노드 하나뿐인 클러스터에서 `Insufficient cpu`로 걸러져 Pending에 머물렀다. 스케줄러가 한 일은 파드의 `spec.nodeName`을 적는 것뿐이고, 못 적으면 파드는 영원히 Pending이다. 필터와 점수의 규칙은 [05](../05-scheduling)장에서 본다.

### 2.4 kube-controller-manager

**여러 컨트롤러를 한 프로세스로 돌린다.** 컨트롤러마다 자기 자원의 "원하는 상태"와 "현재 상태"를 비교해 차이를 줄인다.

| 컨트롤러 | 지키는 것 | 왜 따로인가 |
|:--------|:--------|:----------|
| Node | 노드가 살아 있나. 소식이 끊기면 NotReady | 노드의 생사는 파드와 다른 시간 단위 |
| ReplicaSet | 파드 수 | 5절의 개수 감시자 |
| Deployment | 어느 ReplicaSet이 몇 개 | 버전 교체의 순서 |
| Job, CronJob | 끝날 때까지, 시각마다 | 완료와 예약 |
| EndpointSlice | Service 뒤의 파드 IP 목록 | 파드가 바뀌면 목록도 |
| ServiceAccount | 네임스페이스마다 `default` 계정 | 모든 파드가 하나를 쓴다 |
| Namespace | 지울 때 안의 것을 다 지운다 | 정리의 순서 |

| Node 컨트롤러 | 기본값 | 뜻 |
|:-------------|:------|:---|
| node-monitor-period | 5초 | kubelet의 보고를 얼마나 자주 보나 |
| node-monitor-grace-period | 40초 | 이만큼 소식이 없으면 NotReady |
| NotReady 파드 퇴거 | 300초 | `not-ready` 테인트의 기본 tolerationSeconds |

둘째 원리의 "몇 개"가 이 프로세스 안에 있다. 이 PC에서 클러스터가 뜬 지 13초 만에 파드를 만들려 하니 `serviceaccount "default" not found`로 거절됐고, 몇 초 뒤에는 됐다. ServiceAccount 컨트롤러가 네임스페이스에 `default` 계정을 만들기 전이었던 것이다. 컨트롤러들은 각자의 속도로 도는 독립된 루프라, 클러스터가 "뜬" 것과 모든 컨트롤러가 한 바퀴 돈 것은 다르다.

---

## 3. Worker Node 컴포넌트

### 3.1 kubelet

**노드마다 하나 있는 에이전트**다. API 서버를 지켜보다 자기 노드에 배정된 파드가 생기면 런타임에게 띄우라고 시키고, 그 상태를 API 서버에 보고한다.

| 하는 일 | 왜 |
|:-------|:---|
| 노드를 클러스터에 등록 | 스케줄러가 놓을 자리를 알아야 |
| 자기 노드의 파드를 띄우고 지운다 | 둘째 원리의 "실제로" |
| 런타임과 CRI로 말한다 | 4절 |
| 프로브를 돌리고 상태를 보고 | [01](../01-introduction)장의 liveness, readiness |

kubelet은 파드를 만들지 않는다. API 서버에 "이 노드에 이 파드"가 적히면 그것을 읽어 띄울 뿐이다. 이 PC의 노드 이벤트 첫 줄이 `Starting kubelet`이었고, 그다음이 자기 자원을 보고하는 `NodeHasSufficientMemory`였다. 등록이 먼저다.

{{< callout type="warning" >}}
kubelet은 파드가 아니라 **노드의 시스템 서비스**다. 그래서 `kubeadm`이 클러스터를 만들어도 kubelet은 깔아 주지 않고, 노드마다 패키지로 먼저 설치해야 한다([03](../03-cluster-setup)장). 파드로 돌릴 수 없는 이유는 간단하다. 파드를 띄우는 것이 kubelet이다.
{{< /callout >}}

### 3.2 kube-proxy

**Service를 실제로 구현하는 것**이다. 노드마다 돌면서 "이 가상 IP로 오는 패킷은 이 파드들 중 하나로"라는 규칙을 커널에 적는다.

| 모드 | 어떻게 | 왜 |
|:-----|:------|:---|
| iptables | 규칙을 iptables 체인으로 | 오래된 기본값. 규칙이 많아지면 느리다 |
| IPVS | 커널의 로드밸런서를 쓴다 | 서비스가 수천이면 iptables보다 빠르다 |
| nftables | iptables의 후계 | 1.33에서 GA. 새 클러스터의 방향 |
| userspace | 프로세스가 중계 | 1.26에서 제거됐다 |

```text
$ iptables-save | grep -c KUBE-SVC
36
-A KUBE-SERVICES -d 10.43.23.190/32
   -p tcp --dport 80
   -m comment --comment "default/web"
   -j KUBE-SVC-LOLE4ISW44XBNF3G
```

셋째 원리의 손발이다. 이 PC의 노드 안에서 iptables를 덤프하니 Service용 체인이 36개 있었고, 6절에서 만든 `web` Service의 가상 IP 10.43.23.190으로 가는 패킷을 `KUBE-SVC-...` 체인으로 보내는 규칙이 보였다. 그 체인 안에서 파드 셋 중 하나가 확률로 골라진다. 가상 IP는 어느 인터페이스에도 없다. 커널의 규칙 안에만 있는 주소다.

### 3.3 Container Runtime

컨테이너를 실제로 띄우는 것이다. 쿠버네티스 **1.24부터 dockershim이 제거**되어 Docker 데몬을 직접 붙일 수 없고, CRI로 말하는 containerd나 CRI-O를 쓴다.

```text
Docker 구성요소:
├── Docker CLI
├── Docker API
├── Build Tools
├── runC (실제 런타임)
└── ContainerD (runC 관리)
```

| 도구 | 용도 | 왜 |
|:-----|:-----|:---|
| ctr | containerd의 저수준 디버깅 | 파드를 모른다. 평소엔 안 쓴다 |
| nerdctl | Docker CLI와 같은 문법 | Docker 없이 같은 손버릇으로 |
| crictl | CRI 런타임 디버깅 | 파드 단위로 본다. 노드 장애 때 |

```bash
# Docker → nerdctl
docker run nginx     → nerdctl run nginx
docker ps            → nerdctl ps

# Docker → crictl (K8s 환경)
docker ps            → crictl ps
docker logs <id>     → crictl logs <id>
crictl pods          # 파드 목록
```

Docker에서 쿠버네티스가 쓰는 부분은 containerd와 runc뿐이라, 그 둘만 남긴 것이 지금의 런타임이다. 이 PC의 k3s 노드 안에서 `crictl pods`를 치니 파드 6개, `ctr`로 컨테이너를 세니 13개였다. 파드보다 컨테이너가 많은 것은 파드마다 네트워크 네임스페이스를 붙들고 있는 `pause` 컨테이너가 하나씩 더 있기 때문이다. crictl에는 파드가 보이고 ctr에는 안 보이는 것이 두 도구의 층 차이다.

---

## 4. 파드 생성 워크플로우

```text
1. kubectl apply -f deployment.yaml
         │
         ▼
2. API Server: 인증·검증
         │
         ▼
3. etcd: 파드 객체 저장 (노드 미할당)
         │
         ▼
4. Scheduler: 노드 선택 → nodeName 기록
         │
         ▼
5. kubelet: 내 노드의 파드를 발견
         │
         ▼
6. kubelet → 런타임: 컨테이너 실행
         │
         ▼
7. 상태를 API Server에 보고 → etcd
```

```text
$ kubectl get events (web 파드 하나)
0s   Scheduled  → k3s-lab
5s   Pulling    nginx:1.27-alpine
25s  Pulled     (20초 걸림)
25s  Created    container nginx
25s  Started
```

세 원리가 한 줄로 이어지는 곳이다. 누구도 누구에게 명령하지 않는다. kubectl은 "떠야 한다"를 저장하고, 스케줄러는 노드가 비어 있는 파드를 지켜보다 `nodeName`을 적고, kubelet은 자기 이름이 적힌 파드를 지켜보다 띄우고, 띄운 결과를 다시 적는다. 이 PC에서 파드 하나의 이벤트를 시간순으로 보니 스케줄에 0초, 이미지 내려받기에 20초, 만들고 띄우는 데 1초 안팎이었다. 파드가 안 뜰 때 어느 단계에서 멈췄는지를 이 이벤트로 찾는 것이 [14](../14-troubleshooting)장이다.

---

## 5. 워크로드

### 5.1 Pod

**쿠버네티스의 최소 배포 단위**다. 컨테이너 하나 이상을 묶고, 묶인 것들은 IP 하나와 저장소를 나눠 쓴다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.27
    ports:
    - containerPort: 80
```

```yaml
spec:
  containers:
  - name: web
    image: nginx:1.27-alpine
  - name: sidecar
    image: busybox:1.36
    command: ["sh", "-c"]
    args:
    - |
      sleep 8
      wget -qO- http://127.0.0.1
      sleep 3600
```

```text
$ kubectl logs sidecar-demo -c sidecar
<!DOCTYPE html>
<html>
<head>
$ kubectl get pod sidecar-demo \
    -o jsonpath="{.status.podIP}"
10.42.0.4
```

컨테이너가 아니라 파드가 단위인 이유가 둘째 YAML에 있다. 이 PC에서 nginx와 busybox를 한 파드에 넣고 busybox에서 `127.0.0.1`을 부르니 nginx의 첫 페이지가 왔다. 두 컨테이너가 네트워크 네임스페이스를 나눠 써 localhost가 같고, 파드에 IP가 하나(10.42.0.4)뿐이다. 로그 수집기, 프록시처럼 앱 옆에 붙어야 하는 것을 같은 파드에 넣는 사이드카 패턴이 이것이다.

{{< callout type="info" >}}
**멀티 컨테이너 파드의 성질**
- 네트워크 네임스페이스를 나눠 쓴다. localhost로 서로 부르고, IP는 파드에 하나
- 볼륨을 나눠 쓸 수 있다. 한쪽이 쓴 파일을 다른 쪽이 읽는다
- 같이 만들어지고 같이 죽는다. 한 노드에 함께 놓인다
{{< /callout >}}

```bash
# 생성
kubectl run nginx --image=nginx
kubectl apply -f pod.yaml

# 조회
kubectl get pods
kubectl get pods -o wide
kubectl describe pod nginx

# 로그·접속
kubectl logs nginx
kubectl logs nginx -c sidecar
kubectl exec -it nginx -- /bin/sh

# 삭제
kubectl delete pod nginx
```

### 5.2 ReplicaSet

**지정한 수의 파드를 항상 유지**한다. 둘째 원리의 "몇 개"를 지키는 가장 단순한 컨트롤러다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: nginx-rs
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
        image: nginx:1.27
```

```bash
# 파일 수정 후 적용
kubectl replace -f replicaset.yaml

# 명령어로 스케일링
kubectl scale --replicas=6 rs nginx-rs
```

`selector`가 세는 기준이고 `template`이 모자랄 때 찍어 내는 틀이다. 라벨이 `app: nginx`인 파드를 세어 셋보다 적으면 틀로 하나 더 만들고, 많으면 하나 지운다. [01](../01-introduction)장에서 파드를 지우자 0초 뒤 새 파드가 생긴 것이 이 컨트롤러의 일이었다.

{{< callout type="warning" >}}
ReplicaSet을 직접 만드는 일은 거의 없다. Deployment가 만들고 갈아 끼우기 때문이다. 직접 만든 ReplicaSet은 이미지를 바꿔도 **기존 파드를 건드리지 않는다.** 개수만 세지 내용은 안 보기 때문이고, 그래서 버전 교체는 5.3절의 Deployment가 필요하다.
{{< /callout >}}

### 5.3 Deployment

**ReplicaSet 위의 컨트롤러**로, 롤링 업데이트와 롤백을 맡는다. 상태 없는 앱 배포의 표준이다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-alpine
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

```text
Deployment
    └─→ ReplicaSet (자동 생성)
            └─→ Pods (자동 생성)

$ kubectl get rs,deploy
replicaset.apps/web-75c8d59575  3 3 3
deployment.apps/web             3/3 3 3
```

Deployment는 파드를 직접 세지 않는다. 템플릿의 해시를 이름에 붙인 ReplicaSet(이 PC에서는 `web-75c8d59575`)을 만들고 그것에게 개수를 맡긴다. 이미지를 바꾸면 새 해시의 ReplicaSet을 하나 더 만들어 개수를 옮겨 간다. [01](../01-introduction)장에서 본 새 RS 3, 옛 RS 0이 그 결과이고, 옛 것을 남겨 두니 되돌리기가 된다. 전략의 종류는 [04](../04-workloads)장에서 본다.

```bash
# 생성·조회
kubectl apply -f deployment.yaml
kubectl get deployments
kubectl get pods -l app=web

# 스케일링
kubectl scale deployment web \
  --replicas=5

# 이미지 업데이트 (Rolling Update)
kubectl set image deployment/web \
  nginx=nginx:1.28-alpine

# 배포 상태·히스토리
kubectl rollout status deployment/web
kubectl rollout history deployment/web

# 롤백
kubectl rollout undo deployment/web
kubectl rollout undo deployment/web \
  --to-revision=2

# 일시정지·재개
kubectl rollout pause deployment/web
kubectl rollout resume deployment/web
```

### 5.4 Job & CronJob

**Job**은 끝나야 하는 일을, **CronJob**은 시각마다 Job을 만드는 일을 맡는다.

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
        image: busybox:1.36
        command:
        - sh
        - -c
        - echo backup done
      restartPolicy: Never
  backoffLimit: 3
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox:1.36
            command:
            - sh
            - -c
            - date
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

```text
$ kubectl get jobs
hello           Complete  1/1
tick-29835513   Complete  1/1
tick-29835514   Complete  1/1
$ kubectl logs job/hello
backup done
```

Deployment와 다른 점은 **끝**이 있다는 것이다. Job 컨트롤러는 파드가 성공으로 끝날 때까지 다시 띄우고(`backoffLimit`까지), 끝나면 그대로 둔다. 이 PC에서 만든 `hello` Job은 `Complete 1/1`로 남았고, 매분 도는 CronJob `tick`은 두 번 돌아 Job 둘을 남겼다. Job 이름 뒤의 29835513은 예정 시각을 1970년부터 센 분 수다. 같은 시각의 Job을 두 번 만들지 않기 위한 이름이다. `restartPolicy`가 Deployment와 달리 `Never`나 `OnFailure`인 이유도 끝이 있기 때문이다. 성공한 파드를 다시 띄우면 안 된다.

```text
┌──── 분   (0-59)
│ ┌── 시   (0-23)
│ │ ┌── 일 (1-31)
│ │ │ ┌── 월 (1-12)
│ │ │ │ ┌── 요일 (0-6, Sun=0)
│ │ │ │ │
* * * * *

*/5 * * * *      # 매 5분마다
0 */2 * * *      # 매 2시간마다
0 9-18 * * 1-5   # 평일 9~18시 정각
```

### 5.5 DaemonSet

**노드마다 파드를 하나씩** 둔다. 로그 수집, 모니터링, 네트워크 플러그인처럼 "모든 노드에 있어야 하는 것"의 자리다.

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
      tolerations:
      - operator: Exists  # 전부 허용
      containers:
      - name: fluentd
        image: fluent/fluentd:v1.17
        volumeMounts:
        - name: varlog
          mountPath: /var/log
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
```

`replicas`가 없다. 개수는 노드 수가 정하고, 노드가 늘면 컨트롤러가 거기에도 하나 놓는다. 이 PC의 노드 하나짜리 클러스터에서 DaemonSet은 `1/1`이었다. `tolerations`를 두는 이유는 컨트롤 플레인 노드처럼 보통 파드를 막아 둔 노드에도 에이전트는 있어야 하기 때문이다(8절). 옛 자료의 `node-role.kubernetes.io/master` 키는 1.25에서 `control-plane`으로 바뀌었다.

### 5.6 워크로드 비교

| 워크로드 | 지키는 것 | 왜 따로 있나 |
|:--------|:--------|:-----------|
| Pod | 컨테이너 묶음 하나 | 직접 만들면 죽어도 아무도 안 살린다 |
| ReplicaSet | 파드 N개 | 개수만 |
| Deployment | 어느 버전의 RS가 N개 | 버전 교체와 되돌리기 |
| Job | 성공할 때까지, 끝나면 그만 | 끝이 있는 일 |
| CronJob | 시각마다 Job 하나 | 예약 |
| DaemonSet | 노드마다 하나 | 노드에 붙는 일 |
| StatefulSet | 순서와 이름이 고정된 N개 | DB처럼 "누가 1번인가"가 중요할 때. [06](../06-storage)장 |

둘째 원리를 표로 편 것이다. 전부 "파드를 몇 개, 언제, 어디에"의 규칙이 다른 컨트롤러이고, 파드를 직접 만드는 일은 실험 말고는 없다.

---

## 6. 서비스 (Service)

파드의 IP는 파드가 다시 만들어질 때마다 바뀐다. 이 PC에서 파드 하나를 지우고 새로 생긴 파드의 IP가 달랐던 것이 그것이다. 셋째 원리대로 파드 앞에 **바뀌지 않는 가상 IP와 이름**을 두는 것이 Service이고, 라벨 셀렉터로 뒤에 붙을 파드를 고른다.

```text
         External
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐
│  LB  │ │ Node │ │ Ing  │
│Cloud │ │ Port │ │ ress │
└──┬───┘ └──┬───┘ └──┬───┘
   └────────┼────────┘
            ▼
      ┌───────────┐
      │ ClusterIP │
      └─────┬─────┘
            ▼
         [Pods]
```

| 유형 | 주소 | 누가 부르나 | 왜 |
|:-----|:-----|:----------|:---|
| ClusterIP | 클러스터 안의 가상 IP | 다른 파드 | 기본값. 밖에서는 안 보인다 |
| NodePort | 모든 노드의 같은 포트(30000~32767) | 노드 IP를 아는 밖 | 개발, 테스트 |
| LoadBalancer | 클라우드가 준 바깥 IP | 인터넷 | 운영. NodePort 위에 LB를 얹는다 |
| Ingress | 호스트와 경로 | HTTP 손님 | Service가 아니라 L7 규칙. 여러 Service를 하나의 진입점으로 |

```text
$ kubectl get svc
NAME   TYPE         PORT(S)   EXT-IP
web    ClusterIP    80        <none>
web-np NodePort     80:30080  <none>
web-lb LoadBalancer 80:30784  172.17.0.2
```

이 PC에서 같은 파드 셋에 세 유형을 붙인 결과다. 셋 다 ClusterIP를 갖고, NodePort는 거기에 노드 포트를, LoadBalancer는 거기에 바깥 IP를 더한 것이다. 유형은 층이지 종류가 아니다.

### 6.1 ClusterIP

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: ClusterIP        # 생략 가능
  selector:
    app: backend
  ports:
  - port: 80             # 서비스 포트
    targetPort: 8080     # 컨테이너 포트
```

```bash
# 같은 네임스페이스
curl http://backend-service:80

# 다른 네임스페이스
curl http://web.dev.svc.cluster.local
```

```text
$ nslookup web        (busybox 파드에서)
Server:   10.43.0.10
Name:     web.default.svc.cluster.local
Address:  10.43.155.197
```

이름은 CoreDNS가 준다. 이 PC의 파드 안에서 `web`을 물으니 클러스터 DNS 10.43.0.10이 `web.default.svc.cluster.local`로 풀어 Service의 가상 IP를 돌려줬다. 파드의 `/etc/resolv.conf`에 `default.svc.cluster.local`이 검색 도메인으로 들어 있어 짧은 이름이 되고, 다른 네임스페이스의 Service는 `이름.네임스페이스`로 부른다.

```text
$ kubectl get endpointslices
web-s7g7l  IPv4  80  10.42.0.6,10.42.0.7
```

Service 뒤에 누가 있는지는 EndpointSlice에 있다. 2.4절의 컨트롤러가 셀렉터에 맞는 파드의 IP를 여기 적어 두고, 3.2절의 kube-proxy가 이것을 읽어 규칙을 만든다. 옛 `Endpoints` 자원은 1.33부터 폐기 예고 상태라 `kubectl get endpoints`를 치면 경고가 뜬다.

### 6.2 NodePort

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
  - port: 80             # Service 포트
    targetPort: 80       # Pod 포트
    nodePort: 30080      # 30000-32767
```

```text
[External] → [Node:30080]
  → [SVC:80] → [Pod:80]
```

모든 노드의 30080번이 이 Service의 문이 된다. 이 PC에서 노드 안에서도, Docker가 열어 준 포트로 Windows 호스트에서도 `127.0.0.1:30080`을 부르니 nginx 페이지가 왔다. 어느 노드로 들어가든 kube-proxy의 규칙이 파드로 보내므로 파드가 없는 노드의 30080도 된다.

### 6.3 LoadBalancer

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

{{< callout type="warning" >}}
LoadBalancer는 **바깥 IP를 누군가 줘야** 완성된다. 클라우드에서는 cloud-controller-manager가 AWS나 GCP의 로드밸런서를 만들어 IP를 적어 주지만, 온프레미스에서는 적어 줄 것이 없어 `EXTERNAL-IP`가 `<pending>`에 머문다. MetalLB 같은 것이 그 자리를 채운다. 이 PC의 k3s는 노드 IP를 그대로 적어 주는 ServiceLB를 품고 있어 `172.17.0.2`가 바로 붙었다.
{{< /callout >}}

### 6.4 Ingress

L7, 곧 HTTP의 호스트와 경로로 여러 Service를 나눠 보낸다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
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

Ingress는 규칙일 뿐이고, 그 규칙을 읽어 실제로 트래픽을 나누는 것은 Ingress 컨트롤러(nginx, Traefik 등)라는 별도의 파드다. `ingressClassName`이 어느 컨트롤러의 것인지를 말한다. 이 PC의 k3s는 Traefik을 기본으로 품는데 실험에서는 꺼 두었다. Service마다 LoadBalancer를 붙이면 바깥 IP가 서비스 수만큼 필요하지만, Ingress 하나 뒤에 열 개를 두면 IP 하나로 된다. 후속 규격인 Gateway API까지 [07](../07-networking)장에서 본다.

---

## 7. 네트워크 통신

| 레벨 | 경로 | 구현 | 왜 |
|:-----|:-----|:-----|:---|
| 1 | 같은 파드의 컨테이너 | localhost + 포트 | 네임스페이스를 나눠 쓴다. 5.1절 |
| 2 | 같은 노드의 파드 | 노드의 브리지 | 파드마다 IP, 노드 안에서 스위치처럼 |
| 3 | 다른 노드의 파드 | CNI 플러그인(오버레이나 라우팅) | NAT 없이 파드 IP 그대로 |
| 4 | 파드 → Service | kube-proxy의 커널 규칙 | 3.2절 |
| 5 | 밖 → 클러스터 | NodePort, LB, Ingress | 6절 |

쿠버네티스의 네트워크 규칙은 하나다. **모든 파드는 NAT 없이 서로 IP로 통한다.** 그것을 어떻게 이루는지는 규격이 정하지 않고 CNI 플러그인에 맡긴다. 이 PC의 파드들이 10.42.0.x를 받은 것이 k3s의 기본 플러그인 Flannel의 일이다.

| 플러그인 | 방식 | 왜 고르나 |
|:--------|:-----|:---------|
| Flannel | 단순한 오버레이(VXLAN) | 설정이 거의 없다. k3s의 기본 |
| Calico | BGP 라우팅, 네트워크 정책 | 정책이 필요하고 규모가 크면 |
| Cilium | eBPF | 커널 규칙 대신 프로그램. 관측과 성능 |

```text
$ cat /var/lib/rancher/k3s/agent/etc/
      cni/net.d/10-flannel.conflist
{ "name": "cbr0",
  "cniVersion": "1.0.0",
  "plugins": [ { "type": "flannel",
    "delegate": { "hairpinMode": true,
      "isDefaultGateway": true } } ...
```

CNI는 "파드가 생길 때 이 설정 파일의 플러그인을 불러 네트워크를 붙여라"는 규격이다. 이 PC의 노드에는 Flannel의 설정 하나가 있었고, kubelet이 파드를 만들 때 이것을 읽어 IP를 받아 온다. 플러그인을 바꾸면 이 파일만 바뀐다. 설치와 선택은 [03](../03-cluster-setup)장, 동작은 [07](../07-networking)장에서 본다.

---

## 8. Taint & Toleration

특정 노드에 아무 파드나 못 오게 막는 것이 Taint(노드에), 그래도 와도 된다고 하는 것이 Toleration(파드에)이다.

```bash
# Taint 추가·제거·확인
kubectl taint nodes node1 \
  gpu=true:NoSchedule
kubectl taint nodes node1 \
  gpu=true:NoSchedule-
kubectl describe node node1 | grep Taint
```

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
    image: nvidia/cuda:12.4.1-base
```

```text
$ kubectl taint nodes k3s-lab \
    gpu=true:NoSchedule
notol  Pending   untolerated taint
tol    Running   (toleration 있음)
$ kubectl taint nodes k3s-lab \
    gpu=true:NoSchedule-
notol  Running
```

| Effect | 뜻 | 왜 |
|:-------|:---|:---|
| NoSchedule | 톨러레이션 없으면 새로 안 놓는다 | 있던 파드는 둔다 |
| PreferNoSchedule | 되도록 안 놓는다 | 자리가 없으면 놓는다 |
| NoExecute | 있던 파드도 내보낸다 | 노드 장애 때 컨트롤러가 이것을 붙인다 |

둘째 원리의 "어디에"를 거꾸로 쓴 것이다. 파드가 노드를 고르는 대신 노드가 파드를 거른다. 이 PC의 노드에 `gpu=true:NoSchedule`을 붙이니 톨러레이션 없는 파드는 `untolerated taint`로 Pending에 머물고 있는 파드는 바로 돌았으며, 테인트를 떼자 Pending이던 파드가 뜰 자리를 찾아 Running이 됐다. 컨트롤 플레인 노드에 보통 파드가 안 놓이는 것도 설치 때 붙는 테인트 때문이고, 노드가 NotReady가 되면 2.4절의 컨트롤러가 `NoExecute` 테인트를 붙여 파드를 내보낸다. 라벨과 어피니티까지 합친 배치 규칙은 [05](../05-scheduling)장에서 본다.

---

## 9. 네임스페이스

| Namespace | 용도 | 왜 미리 있나 |
|:----------|:-----|:-----------|
| default | 네임스페이스를 안 적으면 여기 | 시작점 |
| kube-system | 쿠버네티스 자신의 파드 | CoreDNS 같은 시스템 것을 섞지 않게 |
| kube-public | 누구나 읽는다 | 클러스터 정보 공개용 |
| kube-node-lease | 노드마다 하나씩 갱신하는 임대 객체 | kubelet의 생존 신고를 싸게 |

이 PC의 새 클러스터에 네임스페이스가 넷 있었다. 넷째가 kubelet의 심장 박동이다. 노드 객체 전체를 갱신하는 대신 작은 Lease 객체를 주기적으로 갱신하고, 2.4절의 Node 컨트롤러가 그것을 본다. 큰 클러스터에서 노드 수천 대의 박동이 etcd를 짓누르지 않게 하려는 설계다.

```bash
# 생성·조회
kubectl create namespace dev
kubectl get pods -n kube-system
kubectl get pods -A

# 기본 네임스페이스 변경
kubectl config set-context --current \
  --namespace=dev
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: dev
spec:
  containers:
  - name: nginx
    image: nginx:1.27
```

### ResourceQuota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 5Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

```text
dev 네임스페이스에 pods: "2"를 걸고
replicas: 3인 Deployment를 만들면
$ kubectl get pods -n dev | wc -l → 2
FailedCreate: exceeded quota: quota,
  requested: pods=1, used: pods=2,
  limited: pods=2
```

네임스페이스는 이름을 나누는 폴더이자 **한도를 거는 단위**다. 이 PC에서 `dev`에 파드 둘 한도를 걸고 셋을 선언하니 둘만 만들어졌고, ReplicaSet 컨트롤러는 셋째를 만들려다 `exceeded quota`로 계속 거절당하는 이벤트를 남겼다. 컨트롤러는 포기하지 않는다. 한도를 올리는 순간 셋째가 생긴다. 한도가 `requests.cpu`를 포함하면 requests를 안 적은 파드는 아예 거절되므로, 그때는 [09](../09-observability)장의 LimitRange로 기본값을 준다.

---

## 10. Imperative vs Declarative

### 10.1 Imperative (명령형)

"어떻게(How)"를 단계별로 지시한다.

```bash
kubectl run nginx --image=nginx
kubectl create deployment nginx \
  --image=nginx
kubectl expose deployment nginx \
  --port=80
kubectl scale deployment nginx \
  --replicas=3
kubectl set image deployment/nginx \
  nginx=nginx:1.27
```

| 장점 | 단점 |
|:-----|:-----|
| 빠르다. 시험과 실험에서 | 무엇을 했는지가 남지 않는다 |
| 파일이 필요 없다 | 두 사람이 같은 것을 다르게 만든다 |

### 10.2 Declarative (선언형)

"무엇을(What)"만 적으면 쿠버네티스가 차이를 맞춘다.

```bash
kubectl apply -f nginx-deployment.yaml
kubectl apply -f ./configs/   # 디렉토리
```

파일이 곧 원하는 상태라 Git에 두면 이력과 리뷰가 생기고, 같은 파일을 두 번 적용해도 결과가 같다. 운영은 이쪽이다.

### 10.3 kubectl apply 동작 원리

| 구성 요소 | 어디에 | 왜 |
|:---------|:------|:---|
| Local | 지금 적용하는 YAML | 원하는 상태 |
| Live | 서버에 있는 객체 | 현재 상태. 다른 컨트롤러가 덧붙인 필드도 있다 |
| Last Applied | 객체의 annotation | 지난번에 내가 적용한 것 |

```text
v1: data: {a: "1", b: "2"}  → apply
v2: data: {a: "1"}          → apply
결과: {"a":"1"}   (b가 지워졌다)
```

세 쪽을 견주는 이유는 **필드 삭제**를 알아채기 위해서다. 이 PC에서 키 둘짜리 ConfigMap을 적용한 뒤 키 하나짜리 파일을 다시 적용하니 `b`가 지워졌다. Local에 없는 `b`가 Last Applied에는 있으니 "내가 지웠다"로 판단한 것이고, Last Applied에도 없었다면 남이 붙인 필드로 보고 그냥 둔다. 그 기록이 객체의 `kubectl.kubernetes.io/last-applied-configuration` annotation에 JSON으로 들어 있는 것을 확인했다.

{{< callout type="warning" >}}
`create`와 `replace`는 Last Applied를 남기지 않는다. 그 뒤에 `apply`를 쓰면 삭제를 못 알아채므로, 선언형으로 관리할 객체는 **처음부터 끝까지 apply만** 쓴다. 최신 방식인 서버 사이드 apply(`--server-side`)는 annotation 대신 서버의 `managedFields`에 "어느 필드를 누가 관리하는가"를 적어 여러 도구가 한 객체를 나눠 관리할 수 있게 한다.
{{< /callout >}}

---

## 11. YAML 기본 구조

```yaml
apiVersion: v1      # API 버전
kind: Pod           # 리소스 종류
metadata:           # 이름, 라벨
  name: nginx
  labels:
    app: nginx
spec:               # 원하는 상태
  containers:
  - name: nginx
    image: nginx:1.27
```

| Kind | apiVersion | 왜 이 그룹인가 |
|:-----|:-----------|:-------------|
| Pod, Service, ConfigMap, Secret, Namespace, PV, PVC | v1 | 처음부터 있던 핵심 자원 |
| Deployment, ReplicaSet, DaemonSet, StatefulSet | apps/v1 | 앱 워크로드 그룹 |
| Job, CronJob | batch/v1 | 배치 그룹 |
| Ingress, NetworkPolicy | networking.k8s.io/v1 | 네트워크 그룹 |
| HorizontalPodAutoscaler | autoscaling/v2 | 확장 그룹 |

네 칸에 서버가 붙이는 다섯째 칸 `status`가 더해진다. `apiVersion`에 그룹이 붙는 것은 자원의 종류가 늘면서 한 바구니에 담을 수 없게 됐기 때문이고, 그룹마다 버전이 따로 오른다. 어느 그룹인지 모르면 `kubectl api-resources`가 알려 주고, 이 PC의 클러스터에는 66가지가 있었다.

---

## 12. kubectl 기본 사용법

### 12.1 리소스·필드 탐색

```bash
# 사용 가능한 리소스 목록
kubectl api-resources

# 리소스 필드 구조
kubectl explain pods
kubectl explain pods.spec
kubectl explain pods.spec.containers
kubectl explain pods.spec --recursive
```

### 12.2 조회·디버깅

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide

# 리소스 조회
kubectl get all
kubectl get pods,svc,deploy
kubectl get pods -A
kubectl get pods -o wide
kubectl get pods -o yaml
kubectl get events \
  --sort-by=.lastTimestamp

# 라벨 기반 조회
kubectl get pods -l app=nginx
kubectl get pods -l "app in (web,api)"

# 상세 정보
kubectl describe pod <pod>
kubectl describe svc <svc>

# 로그
kubectl logs <pod>
kubectl logs <pod> -c <container>
kubectl logs -f <pod>
kubectl logs <pod> --previous

# 디버깅
kubectl exec -it <pod> -- /bin/sh
kubectl port-forward svc/nginx 8080:80
kubectl get endpointslices
```

### 12.3 빠른 편집·템플릿

```bash
# 실행 중 리소스 편집
kubectl edit deployment nginx

# 특정 필드 패치
kubectl patch deployment nginx \
  -p '{"spec":{"replicas":5}}'

# YAML 템플릿 생성
kubectl run nginx --image=nginx \
  --dry-run=client -o yaml > pod.yaml
kubectl create deployment nginx \
  --image=nginx \
  --dry-run=client -o yaml > deploy.yaml
kubectl expose deployment nginx \
  --port=80 \
  --dry-run=client -o yaml > svc.yaml

# 변경사항 미리보기
kubectl diff -f deployment.yaml
kubectl apply -f deployment.yaml \
  --dry-run=server

# 삭제
kubectl delete -f deployment.yaml
kubectl delete pod <pod> \
  --grace-period=0 --force
```

`--dry-run=client`는 kubectl이 로컬에서 YAML만 만들고, `--dry-run=server`는 API 서버까지 보내 검증과 어드미션을 거치되 저장만 안 한다. 명령형으로 뼈대를 만들고 파일로 저장해 선언형으로 넘어가는 것이 두 방식을 잇는 흔한 길이다. `--sort-by`와 `-o jsonpath`로 값을 뽑는 법은 [15](../15-jsonpath)장에서 본다.

---

## 핵심 정리

| 컴포넌트 | 역할 | 왜 |
|:--------|:-----|:---|
| etcd | 모든 상태의 저장소 | resourceVersion이 곧 클러스터의 시계 |
| kube-apiserver | 유일한 문, 유일한 etcd 클라이언트 | 지킬 곳이 하나 |
| kube-scheduler | 어디에 | `nodeName`을 적는다. 못 적으면 Pending |
| kube-controller-manager | 몇 개 | 루프들의 묶음. 포기하지 않는다 |
| kubelet | 실제로 띄운다 | 자기 노드의 파드만 지켜본다 |
| kube-proxy | Service를 커널 규칙으로 | 가상 IP는 규칙 안에만 있다 |

| 워크로드 | 규칙 | 왜 |
|:--------|:-----|:---|
| ReplicaSet | N개 | 개수만 |
| Deployment | 어느 RS가 N개 | 버전 교체 |
| Job / CronJob | 끝날 때까지 / 시각마다 | 끝이 있는 일 |
| DaemonSet | 노드마다 하나 | 노드에 붙는 일 |

| Service | 주소 | 왜 |
|:--------|:-----|:---|
| ClusterIP | 안의 가상 IP와 DNS 이름 | 파드 IP는 바뀐다 |
| NodePort | 모든 노드의 같은 포트 | 밖에서 노드로 |
| LoadBalancer | 누군가 준 바깥 IP | 클라우드나 MetalLB |
| Ingress | 호스트·경로 규칙 | Service 여럿을 IP 하나로 |

{{< callout type="info" >}}
**용어 정리**
- **Control Plane**: 옛 Master. 상태를 저장하고 결정하는 쪽
- **etcd**: 클러스터 상태의 키-값 저장소. resourceVersion은 그 수정 번호
- **kubelet**: 노드마다 하나. 자기 노드의 파드를 띄우고 보고
- **kube-proxy**: Service의 가상 IP를 파드로 보내는 노드의 커널 규칙
- **CRI / crictl**: kubelet과 런타임의 규격 / 그 규격으로 노드 안을 들여다보는 도구
- **pause 컨테이너**: 파드의 네트워크 네임스페이스를 붙들고 있는 컨테이너
- **EndpointSlice**: Service 뒤의 파드 IP 목록. 옛 Endpoints의 후계
- **CoreDNS**: 클러스터 DNS. `이름.네임스페이스.svc.cluster.local`
- **CNI**: 파드에 네트워크를 붙이는 플러그인 규격. Flannel, Calico, Cilium
- **Taint / Toleration**: 노드가 파드를 거르는 표시 / 그래도 된다는 파드의 표시
- **Lease**: kubelet이 살아 있음을 싸게 알리는 작은 객체
- **Last Applied**: apply가 남기는 지난번 선언. 필드 삭제를 알아채는 근거
{{< /callout >}}
