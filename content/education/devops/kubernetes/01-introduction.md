---
title: "01. 입문"
date: 2026-04-23
weight: 1
---

이 시리즈는 쿠버네티스를 개념부터 운영까지 열다섯 장에 걸쳐 본다. 첫 장은 "왜 이런 것이 필요했고, 무엇을 약속하는가"다. 원리는 셋이다. 첫째, **쿠버네티스는 원하는 상태를 받아 현재 상태를 그쪽으로 끌고 가는 제어 루프다.** "이 컨테이너를 셋 띄워라"가 아니라 "셋이 떠 있어야 한다"를 적으면, 하나가 죽든 노드가 죽든 시스템이 셋으로 되돌린다. 둘째, **컨테이너는 커널을 나눠 쓰는 격리된 프로세스이고, 쿠버네티스는 그 프로세스를 여러 컴퓨터에 걸쳐 놓는다.** 가상머신보다 가볍고 빠른 이유와 그 대가가 여기서 나오고, 컴퓨터가 여럿이 되는 순간 배치와 복구와 확장을 사람이 할 수 없어진다. 셋째, **모든 것은 API 서버를 거치는 자원이다.** 파드도 노드도 설정도 REST 자원이고, kubectl은 그 API의 클라이언트이며, 컨트롤러들은 그 API를 지켜보다 움직인다. 이 PC의 Docker Desktop 위에 k3s 클러스터를 잠깐 띄워 세 원리를 실제로 확인했다.

---

## 1. 쿠버네티스란

**쿠버네티스(Kubernetes, K8s)** 는 여러 서버에 걸쳐 많은 컨테이너를 자동으로 배치하고, 늘리고, 되살리는 **컨테이너 오케스트레이션** 플랫폼이다. 구글이 십 년 넘게 내부에서 쓰던 Borg의 경험을 담아 2014년에 공개했고, 2015년 1.0과 함께 CNCF(Cloud Native Computing Foundation)에 기증해 지금은 특정 회사의 것이 아니다.

| 컨테이너가 많아지면 생기는 일 | 사람이 하면 | 쿠버네티스가 하면 |
|:---------------------------|:----------|:---------------|
| 어느 서버에 놓을까 (스케줄링) | 표를 보고 고른다 | 남은 자원을 보고 스케줄러가 고른다 |
| 죽으면 누가 다시 띄우나 (자기 치유) | 새벽에 전화를 받는다 | 컨트롤러가 개수를 세다 하나 더 띄운다 |
| 몰리면 어떻게 늘리나 (스케일링) | 서버에 들어가 하나씩 | 숫자 하나를 바꾸거나 자동으로 |
| 배포 중에 안 멈추려면 (무중단) | 순서를 외워 한 대씩 | 새것을 띄우고 확인한 뒤 옛것을 내린다 |

컨테이너 하나는 Docker로 충분하다. 문제는 컨테이너가 수십, 수천이 되고 서버가 여럿이 될 때 생기고, 표의 네 가지가 그것이다. 쿠버네티스가 이것을 푸는 방식이 첫째 원리다. 어떻게 할지를 명령하지 않고 **어떤 상태여야 하는지**를 YAML로 적으면(선언적), 컨트롤 플레인이 현재 상태를 그 방향으로 수렴시킨다.

```text
$ kubectl create deployment web \
    --image=nginx:1.27-alpine \
    --replicas=3
deployment.apps/web created
  ... 28초 뒤 ...
web-...-47wcb  1/1  Running
web-...-ns5d6  1/1  Running
web-...-rg77w  1/1  Running
```

이 PC에 띄운 클러스터에 "nginx 셋"을 선언하니 28초 뒤 셋이 돌고 있었다(이미지 내려받기 포함). 어느 노드에, 어떤 순서로, 어떤 이름으로는 적지 않았다. 그것이 선언과 명령의 차이다.

---

## 2. IT 인프라의 진화

```text
메인프레임 → VM → 클라우드 → 컨테이너
```

| 시대 | 무엇을 나눴나 | 확장 | 왜 다음이 필요했나 |
|:-----|:------------|:-----|:----------------|
| 2000년대 | 서버 한 대를 VM 여럿으로(VMware) | 스케일 업, 아웃 | 서버는 샀는데 반은 놀았다 |
| 2010년대 | 남의 서버를 빌린다(퍼블릭 클라우드) | IaaS, PaaS, SaaS | 사기 전에 빌리고, 쓴 만큼만 |
| 지금 | 프로세스 단위로 나눈다(컨테이너) | 오케스트레이션 | VM은 켜는 데 분, 컨테이너는 초 |

```text
┌──────────────────────────┐
│  SaaS (Gmail, Notion)    │
├──────────────────────────┤
│  PaaS (Heroku, GAE)      │
├──────────────────────────┤
│  IaaS (EC2, GCE)         │
└──────────────────────────┘
  위로 갈수록 관리 범위 ↓
  아래로 갈수록 자유도 ↑
```

가상화는 늘 "무엇을 나눠 쓰는가"의 역사였다. 하드웨어를 나누던 VM에서, 남의 데이터센터를 나누던 클라우드로, 이제 운영체제 하나를 프로세스 단위로 나누는 컨테이너로 왔다. 나누는 단위가 작아질수록 켜고 끄는 값이 싸지고, 값이 싸지면 개수가 늘고, 개수가 늘면 사람이 못 다룬다. 쿠버네티스는 그 마지막 단계의 도구다.

{{< callout type="info" >}}
쿠버네티스는 IaaS 위에서 **PaaS를 만드는 재료**에 가깝다. 완성된 PaaS처럼 코드를 던지면 알아서 되지는 않지만, 배포·확장·복구·네트워크의 뼈대를 주므로 그 위에 회사마다 자기 플랫폼을 짓는다. EKS, GKE, AKS 같은 관리형 서비스는 7절의 컨트롤 플레인을 클라우드가 대신 운영해 주는 것이고, 사용자는 워크로드에만 집중한다.
{{< /callout >}}

---

## 3. 컨테이너 vs 가상머신

```text
[ 가상머신 ]          [ 컨테이너 ]
┌────┐ ┌────┐         ┌────┐ ┌────┐
│App │ │App │         │App │ │App │
├────┤ ├────┤         ├────┴─┴────┤
│ OS │ │ OS │         │  Runtime  │
├────┴─┴────┤         ├───────────┤
│Hypervisor │         │  Host OS  │
├───────────┤         ├───────────┤
│  Host OS  │         │ Hardware  │
├───────────┤         └───────────┘
│ Hardware  │
└───────────┘
```

둘째 원리다. VM은 **하드웨어를 흉내 내어** 그 위에 게스트 OS를 통째로 올린다. 컨테이너는 **호스트의 커널을 그대로 쓰고** 프로세스에 보이는 것만 격리한다. 파일 시스템, 프로세스 목록, 네트워크, 호스트 이름을 네임스페이스로 따로 보여 주고, CPU와 메모리를 cgroup으로 제한한다.

```text
$ docker run --rm alpine sh -c "..."
kernel=6.18.33.2-microsoft-standard-WSL2
ns: cgroup ipc mnt net pid time user uts
cgroup: 0::/
PID   USER  COMMAND
  1   root  ps
```

이 PC의 Docker Desktop에서 alpine 컨테이너를 띄워 본 것이다. 컨테이너 안의 `uname -r`은 호스트(WSL2)의 커널과 같은 6.18.33이다. 커널을 새로 띄운 것이 아니라 빌려 쓴다는 증거다. `/proc/self/ns`에 여덟 종류의 네임스페이스가 보이고, 컨테이너 안에서 `ps`를 치면 자기 자신이 PID 1이다. 밖에서는 수천 개 중 하나인 프로세스가 안에서는 세상에 혼자인 것처럼 보인다.

| 구분 | 가상머신 | 컨테이너 | 왜 |
|:-----|:--------|:--------|:---|
| 가상화 수준 | 하드웨어 | 운영체제 | 커널을 새로 띄우느냐 빌리느냐 |
| 크기 | GB | MB. alpine은 13MB | OS가 없으니 앱과 라이브러리뿐 |
| 시작 | 분 | 초. 이 PC에서 1초 | 부팅이 아니라 프로세스 시작 |
| 커널 | 각자 | 호스트와 공유 | 위의 uname |
| 격리 | 강하다 | 상대적으로 약하다 | 커널이 뚫리면 같이 뚫린다 |
| 밀도 | 서버당 수십 | 서버당 수백 | 그만큼 가벼우니까 |

`docker run --rm alpine true`가 이 PC에서 1.05초였다. Windows에서 WSL2 안의 데몬을 거치는 시간까지 포함한 값이고, 리눅스 위에서 직접 띄우면 수십 ms다. VM이 분 단위로 부팅하는 것과의 차이가 곧 "컨테이너를 수천 개 띄울 수 있는" 이유이고, 그 수천 개를 다룰 도구가 필요해진 이유다.

{{< callout type="warning" >}}
컨테이너는 커널을 나눠 쓰므로 **커널의 취약점이 모든 컨테이너에 그대로** 노출된다. 격리는 커널이 해 주는 것이라 커널이 뚫리면 벽이 없다. 서로 믿지 못하는 여러 고객의 컨테이너를 한 노드에 섞어야 한다면 gVisor나 Kata Containers처럼 커널을 따로 두는 샌드박스 런타임이나, 고객마다 노드 그룹을 나누는 것을 고려한다.
{{< /callout >}}

---

## 4. 컨테이너 런타임의 진화

| 세대 | 런타임 | 특징 | 왜 갈라졌나 |
|:-----|:------|:-----|:----------|
| 1세대 | Docker Engine | 빌드, 실행, 네트워크를 한 덩어리로 | 처음엔 하나면 됐다 |
| 2세대 | containerd, CRI-O | OCI 표준을 따르는 가벼운 실행기 | 쿠버네티스는 빌드가 필요 없다 |
| 저수준 | runc, crun | 네임스페이스와 cgroup으로 프로세스를 만든다 | 실제 일은 이 한 줄 |

```text
kubelet
  │ CRI (gRPC)
  ▼
containerd / CRI-O
  │ OCI
  ▼
runc / crun
  │ namespaces, cgroups
  ▼
컨테이너 프로세스
```

초창기 Docker는 이미지 빌드부터 실행, 네트워크까지 하나의 데몬이 다 했다. 쿠버네티스가 필요한 것은 그중 "이미지를 받아 프로세스로 띄우기"뿐이라, 그 부분이 containerd로 떨어져 나오고 실행의 맨 아래는 runc로 표준화됐다. 이 PC의 Docker Desktop을 들여다보면 Docker 29.6 밑에 containerd가 있고 그 밑의 기본 런타임이 runc 1.3이다. Docker 자신도 지금은 containerd 위에서 돈다.

쿠버네티스는 1.24(2022년)부터 Docker 전용 연결 고리(dockershim)를 걷어 내고, **CRI(Container Runtime Interface)** 로 말하는 런타임만 쓴다. 이 PC의 k3s 노드도 런타임이 `containerd://2.1.4`였다. Docker로 만든 이미지는 OCI 표준 이미지라 그대로 돌아가고, 바뀐 것은 kubelet과 런타임 사이의 대화 방식뿐이다.

---

## 5. 컨테이너 / 도커 / 쿠버네티스 관계

```text
┌──────────────────────────────┐
│ Kubernetes (오케스트레이션)  │
│ ┌──────────────────────────┐ │
│ │ containerd (런타임)      │ │
│ │ ┌─────┐ ┌─────┐ ┌─────┐  │ │
│ │ │Cont │ │Cont │ │Cont │  │ │
│ │ └─────┘ └─────┘ └─────┘  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

| 층 | 무엇 | 왜 따로인가 |
|:---|:-----|:----------|
| 컨테이너 | 앱과 실행 환경을 하나로 묶은 것 | 어디서나 같은 모양으로 돈다 |
| Docker, containerd | 이미지를 받아 컨테이너로 띄우는 런타임 | 한 컴퓨터 안의 일 |
| Kubernetes | 여러 컴퓨터의 컨테이너를 배치하고 지키는 것 | 컴퓨터가 여럿이 되면 생기는 일 |

셋은 경쟁이 아니라 층이다. Docker는 한 대에서 컨테이너를 만들고 띄우는 도구이고, 쿠버네티스는 여러 대의 런타임에게 "이것을 띄워라"를 시키는 관리자다. "Docker 대신 쿠버네티스"라는 말은 반만 맞다. 이미지는 여전히 Docker로 빌드하고, 노드 위에서 실제로 프로세스를 띄우는 것은 4절의 런타임이다.

---

## 6. 왜 쿠버네티스가 승리했나

| 요인 | 뜻 | 왜 이겼나 |
|:-----|:---|:---------|
| 구글의 경험 | Borg를 십 년 넘게 운영 | 실제로 수백만 컨테이너를 돌려 본 설계 |
| 선언적 API | 원하는 상태를 적으면 수렴 | 명령형 스크립트는 중간에 끊기면 상태를 모른다 |
| 확장성 | CRD와 Operator로 자원을 더한다 | DB도 인증서도 "쿠버네티스 자원"이 된다 |
| 벤더 중립 | CNCF에 기증 | 한 회사에 묶이지 않는다 |
| 생태계 | Helm, Istio, Prometheus | 도구가 모이면 더 모인다 |

2015년 전후에는 Docker Swarm, Apache Mesos, Nomad가 같은 자리를 놓고 경쟁했다. Swarm은 더 쉬웠고 Mesos는 더 크게 돌았지만, 쿠버네티스가 표준이 된 것은 첫째 원리 때문이다.

```text
$ kubectl delete pod web-...-47wcb
NAME           STATUS
web-...-47wcb  Terminating   (지운 것)
web-...-ns5d6  Running
web-...-nt9d2  ContainerCreating (0초)
web-...-rg77w  Running
  ... 2초 뒤 ...
web-...-nt9d2  Running
```

이 PC의 클러스터에서 셋 중 하나를 일부러 지웠다. 지운 파드가 아직 내려가는 중인 0초 시점에 이미 새 파드가 만들어지고 있었고, 2초 뒤 셋이 됐다. 누가 시킨 것이 아니다. ReplicaSet 컨트롤러가 "셋이어야 한다"와 "지금 둘이다"의 차이를 보고 하나를 더 만들었을 뿐이고, 이벤트에 `SuccessfulCreate`가 남았다.

{{< callout type="info" >}}
쿠버네티스의 핵심은 **제어 루프(reconciliation loop)** 다. 컨트롤러마다 자기가 맡은 자원의 "원하는 상태"와 "현재 상태"를 끊임없이 비교해 차이를 줄인다. 그래서 노드가 죽어도, 네트워크가 잠깐 끊겨도, 명령이 중간에 실패해도 결국 원하는 상태로 수렴한다. 스크립트는 한 번 돌고 끝나지만 루프는 영원히 돈다.
{{< /callout >}}

---

## 7. 클러스터 구조

```text
┌──────── Kubernetes Cluster ────────┐
│                                    │
│ ┌────────────┐  ┌────────────┐     │
│ │ Control    │  │ Worker     │     │
│ │  Plane     │──│  Node      │     │
│ │            │  │ ┌────────┐ │     │
│ │ API Server │  │ │  Pod   │ │     │
│ │ Scheduler  │  │ │┌──────┐│ │     │
│ │ Controller │  │ ││Cont. ││ │     │
│ │ etcd       │  │ │└──────┘│ │     │
│ └────────────┘  │ └────────┘ │     │
│                 │ kubelet    │     │
│                 │ kube-proxy │     │
│                 └────────────┘     │
└────────────────────────────────────┘
```

셋째 원리의 그림이다. 클러스터는 결정하는 쪽(컨트롤 플레인)과 실행하는 쪽(워커 노드)으로 나뉘고, 둘 사이의 모든 대화가 API 서버를 지난다.

| 컨트롤 플레인 | 역할 | 왜 있나 |
|:-------------|:-----|:-------|
| kube-apiserver | 모든 요청의 문. REST API | 상태를 바꾸는 길이 하나여야 검증과 인증을 한 곳에서 한다 |
| etcd | 클러스터 상태의 저장소(키-값) | API 서버는 기억하지 않는다. 기억은 여기 |
| kube-scheduler | 새 파드를 어느 노드에 놓을지 | 자원, 제약, 선호를 보고 고른다. [05](../05-scheduling)장 |
| kube-controller-manager | 컨트롤러들의 묶음 | 6절의 루프가 여기서 돈다 |
| cloud-controller-manager | 클라우드 연동 | 로드밸런서, 디스크를 클라우드 API로 |

| 워커 노드 | 역할 | 왜 있나 |
|:---------|:-----|:-------|
| kubelet | 이 노드의 파드를 API 서버가 적은 대로 띄우고 지킨다 | 노드마다 하나. 런타임에게 CRI로 시킨다 |
| kube-proxy | Service의 가상 IP를 실제 파드로 보낸다 | [07](../07-networking)장 |
| 컨테이너 런타임 | 실제 프로세스를 띄운다 | 4절의 containerd |

```text
$ kubectl get nodes -o wide
NAME     STATUS  ROLES          VERSION
k3s-lab  Ready   control-plane  v1.34.1
RUNTIME  containerd://2.1.4-k3s2
KERNEL   6.18.33.2-microsoft-…-WSL2
CPU 12   MEMORY 15.6Gi   PODS 110
```

이 PC의 클러스터다. k3s는 위 컴포넌트를 한 프로세스에 묶은 배포판이라 노드 하나가 컨트롤 플레인이자 워커이고, 컨테이너 하나로 13초 만에 Ready가 됐다. 노드의 커널이 3절의 alpine 컨테이너와 같은 6.18.33인 것에 주목하자. 호스트, 컨테이너, 쿠버네티스 노드가 전부 WSL2 커널 하나 위에 있다. `PODS 110`은 kubelet이 노드 하나에 두는 파드 수의 기본 상한이다. 컴포넌트 하나하나의 역할과 파드가 만들어지는 순서는 [02](../02-core-concepts)장에서, 클러스터를 손으로 세우는 법은 [03](../03-cluster-setup)장에서 본다.

```text
$ kubectl get --raw \
    /api/v1/namespaces/default
{"kind":"Namespace","apiVersion":"v1",
 "metadata":{"name":"default",
  "uid":"66201ffb-...",
  "creationTimestamp":
    "2026-09-23T02:03:07Z",
  ...
```

kubectl이 하는 일은 이 REST API를 부르는 것이 전부다. 네임스페이스 하나를 날것으로 물으니 [REST API 설계 01](../../../architecture/restful/01-basics)장에서 본 그 모양의 JSON이 왔고, `kubectl api-resources`로 세니 이 클러스터가 아는 자원의 종류가 66가지였다. 파드, 노드, 서비스, 시크릿이 전부 같은 문으로 들어가는 같은 모양의 자원이다.

---

## 8. 핵심 오브젝트

| 오브젝트 | 뜻 | 비유 | 왜 있나 |
|:--------|:---|:-----|:-------|
| **Pod** | 컨테이너 하나 이상의 묶음. 최소 배포 단위 | 한 방을 쓰는 프로세스들 | 네트워크와 저장소를 같이 쓸 컨테이너를 묶는다 |
| **ReplicaSet** | 파드를 정해진 수만큼 유지 | 개수 감시자 | 6절의 자기 치유 |
| **Deployment** | ReplicaSet 위의 선언적 배포 | 버전 관리자 | 새 버전으로 바꾸고 되돌린다 |
| **Service** | 파드 집합의 고정 주소 | 로드밸런서 | 파드는 죽고 IP가 바뀐다 |
| **Ingress** | HTTP 경로 규칙 | 리버스 프록시 | 도메인과 경로로 서비스를 나눈다 |
| **ConfigMap / Secret** | 설정과 비밀을 주입 | 환경변수 저장소 | 이미지에 설정을 굽지 않게 |
| **Volume / PVC** | 파드 밖에 남는 저장소 | 디스크 마운트 | 컨테이너의 파일은 컨테이너와 함께 사라진다 |
| **Namespace** | 클러스터 안의 논리적 구획 | 폴더 | 팀과 환경을 한 클러스터에 |

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
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

모든 자원이 같은 네 칸으로 되어 있다. 어느 API 그룹의(`apiVersion`) 어떤 종류이고(`kind`), 이름과 라벨은 무엇이며(`metadata`), 어떤 상태여야 하는가(`spec`). 서버는 여기에 다섯째 칸 `status`, 곧 현재 상태를 붙여 돌려준다. `spec`과 `status`의 차이가 첫째 원리의 "원하는 상태"와 "현재 상태"이고, 컨트롤러는 그 둘을 맞춘다. 파드에 직접 `requests`와 `limits`를 적는 이유는 스케줄러가 남은 자원을 보고 노드를 고르기 때문이다([05](../05-scheduling)장).

---

## 9. 주요 기능

### 무중단 배포 (Rolling Update)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 하나 더
      maxUnavailable: 0  # 줄이지 않음
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
```

```bash
# 이미지 교체 (무중단)
kubectl set image deployment/web \
  nginx=nginx:1.28-alpine

# 롤백
kubectl rollout undo deployment/web
```

```text
$ kubectl get rs -l app=web
NAME           DESIRED CURRENT READY AGE
web-755db55b9  3       3       3     13s
web-79ffc79c64 0       0       0     35s
```

이 PC의 클러스터에서 1.27을 1.28로 바꾼 뒤의 모습이다. Deployment는 이미지를 바꾸는 대신 **새 ReplicaSet을 하나 더 만들어** 새것을 하나 띄우고, 준비되면 옛것을 하나 내리는 일을 반복한다. 끝나면 새 ReplicaSet이 셋, 옛 ReplicaSet이 0이 되고, 옛것은 되돌리기를 위해 남겨 둔다. `maxSurge: 1`이 한 번에 하나만 더 띄우라는 뜻이고 `maxUnavailable: 0`이 준비된 셋 아래로는 내려가지 말라는 뜻이라, 배포 내내 서비스는 셋을 유지한다. 전략의 종류와 되돌리기는 [04](../04-workloads)장에서 본다.

### 오토스케일링 (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
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
        averageUtilization: 50
```

첫째 원리를 한 단계 더 올린 것이다. 사람이 `replicas`를 적는 대신 "CPU 사용률 50%를 유지하라"를 적으면, HPA 컨트롤러가 사용률을 보고 `replicas`를 대신 적는다. 이 PC에서 `kubectl scale deployment/web --replicas=5`로 숫자만 바꾸니 곧 5/5가 됐는데, HPA는 그 숫자를 측정값에서 계산하는 컨트롤러다. 측정값이 어디서 오는지는 [09](../09-observability)장에서 본다.

### 자기 치유 (Self-Healing)

```yaml
spec:
  containers:
  - name: nginx
    image: nginx:1.27-alpine
    livenessProbe:
      httpGet:
        path: /healthz
        port: 80
      initialDelaySeconds: 10
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 80
      periodSeconds: 5
```

6절에서 본 대로 파드가 사라지면 컨트롤러가 다시 만든다. 그런데 프로세스는 살아 있는데 멈춰 있는 경우가 있다. 그래서 kubelet이 주기적으로 묻는다. `livenessProbe`가 실패하면 "죽었다"고 보고 컨테이너를 다시 시작하고, `readinessProbe`가 실패하면 "아직 준비가 안 됐다"고 보고 Service의 목록에서 뺀다. 둘을 나눈 이유는 답이 다르기 때문이다. 죽은 것은 다시 띄워야 하고, 바쁜 것은 잠시 트래픽만 빼면 된다. 시작이 오래 걸리는 앱을 위한 `startupProbe`도 있다.

---

## 10. 자주 쓰는 kubectl

```bash
# 클러스터 정보
kubectl cluster-info
kubectl get nodes -o wide

# 리소스 조회
kubectl get pods -A
kubectl get svc,deploy,ing

# 상세 정보와 이벤트
kubectl describe pod web-pod
kubectl logs -f web-pod
kubectl logs --previous web-pod

# 생성 / 적용 / 삭제
kubectl apply -f pod.yaml
kubectl delete -f pod.yaml

# 디버깅
kubectl exec -it web-pod -- sh
kubectl port-forward pod/web 8080:80

# 네임스페이스
kubectl get ns
kubectl create ns dev
kubectl config set-context --current \
  --namespace=dev

# 스키마 문서
kubectl explain pod.spec.containers
```

| 명령 | 하는 일 | 왜 이것부터 |
|:-----|:-------|:----------|
| get | 자원 목록 | 무엇이 있는지 |
| describe | 자원 하나의 상태와 이벤트 | 왜 안 뜨는지는 이벤트에 있다 |
| logs | 컨테이너의 표준 출력 | `--previous`는 죽기 전 컨테이너의 것 |
| apply | 파일의 선언을 서버에 | 첫째 원리. 만들기도 고치기도 이것 하나 |
| exec | 컨테이너 안에서 명령 | 안에서 봐야 아는 것 |
| explain | 필드의 문서 | 서버가 아는 스키마 그대로 |

전부 셋째 원리의 REST 호출이다. `get`은 GET, `apply`는 PUT과 PATCH, `delete`는 DELETE이고, `explain`은 서버의 스키마를 물어 이 PC에서도 `livenessProbe <Probe>`처럼 필드의 문서를 바로 보여 줬다. 자원이 많아지면 `-o jsonpath`로 원하는 값만 뽑는데, 그 문법은 [15](../15-jsonpath)장에서, 파드가 안 뜰 때 보는 순서는 [14](../14-troubleshooting)장에서 본다.

{{< callout type="info" >}}
실무에서는 `alias k=kubectl`을 두고, 클러스터와 네임스페이스를 바꾸는 `kubectx`와 `kubens`, 화면으로 보는 `k9s`, 여러 파드의 로그를 한 번에 따라가는 `stern`을 같이 쓴다. 이 PC의 kubectl은 1.36이고 클러스터는 1.34였는데, 버전 차이가 1을 넘는다는 경고가 떴다. 클라이언트와 서버의 버전 차이 규칙은 [10](../10-cluster-maintenance)장에서 본다.
{{< /callout >}}

---

## 11. 핵심 용어

| 용어 | 뜻 | 왜 알아야 하나 |
|:-----|:---|:-------------|
| 오케스트레이션 | 많은 컨테이너의 배치, 확장, 복구를 자동으로 | 이 시리즈 전체의 주제 |
| 컨테이너 런타임 | 컨테이너를 실제로 띄우는 것(containerd, CRI-O) | 4절. Docker와 다른 층 |
| CRI / OCI | kubelet과 런타임의 대화 규격 / 이미지와 실행의 표준 | 어느 런타임이든 갈아 끼울 수 있는 이유 |
| 선언적 API | 원하는 상태를 적으면 시스템이 수렴 | 첫째 원리 |
| 제어 루프 | 원하는 상태와 현재 상태를 계속 비교해 맞춤 | 자기 치유의 정체 |
| 스케일 아웃 / 업 | 대수를 늘린다 / 한 대를 키운다 | 쿠버네티스는 아웃이 기본 |
| 하이퍼바이저 | 하드웨어를 흉내 내어 VM을 띄우는 층 | 3절. 컨테이너에는 없는 층 |
| 락인 | 특정 벤더에 묶이는 것 | CNCF 기증이 푼 문제 |

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Kubernetes | 여러 서버의 컨테이너를 선언대로 유지하는 플랫폼 | 수천 개는 사람이 못 다룬다 |
| 선언 | spec을 적으면 status가 따라온다 | 명령은 끊기지만 루프는 돈다 |
| 컨테이너 | 커널을 나눠 쓰는 격리된 프로세스 | 13MB, 1초. 대신 커널을 같이 쓴다 |
| 런타임 | kubelet → containerd → runc | Docker는 빌드, 실행은 표준 층 |
| 컨트롤 플레인 | API 서버, etcd, 스케줄러, 컨트롤러 | 결정하는 쪽 |
| 워커 노드 | kubelet, kube-proxy, 런타임 | 실행하는 쪽 |
| API 서버 | 모든 것이 지나는 REST 문 | kubectl도 컨트롤러도 클라이언트 |
| Pod | 최소 배포 단위 | 한 방을 쓰는 컨테이너들 |
| Deployment | ReplicaSet을 갈아 끼우는 배포 | 새 RS 셋, 옛 RS 0 |
| 자기 치유 | 지우면 0초 뒤 새로 만든다 | 개수가 선언과 다르니까 |
| 프로브 | 살아 있나 / 받을 수 있나 | 다시 띄울지, 트래픽만 뺄지 |

{{< callout type="info" >}}
**용어 정리**
- **Pod**: 컨테이너 하나 이상을 묶은 최소 배포 단위. 네트워크와 저장소를 공유
- **ReplicaSet / Deployment**: 파드 개수를 지키는 컨트롤러 / 그것을 버전별로 갈아 끼우는 컨트롤러
- **Service**: 바뀌는 파드 IP 앞에 두는 고정 주소
- **Namespace**: 한 클러스터 안의 논리적 구획
- **kubelet**: 노드마다 하나. API 서버의 선언대로 파드를 띄우고 지킨다
- **kube-proxy**: Service 주소를 파드로 보내는 노드의 규칙
- **etcd**: 클러스터의 모든 상태가 저장되는 키-값 저장소
- **CRI**: kubelet이 런타임에게 말하는 gRPC 규격
- **네임스페이스(커널) / cgroup**: 프로세스에 보이는 것을 가르는 것 / 쓸 수 있는 자원을 제한하는 것
- **Probe**: kubelet이 컨테이너에 묻는 건강 검사. liveness, readiness, startup
- **k3s**: 컨트롤 플레인을 한 프로세스에 묶은 가벼운 배포판. 이 PC의 실측에 썼다
{{< /callout >}}

다음 장 [02. 핵심 개념](../02-core-concepts)에서 컴포넌트 하나하나와 파드가 만들어지는 순서를 보고, [03](../03-cluster-setup)장에서 클러스터를 직접 세운다. Minikube, kind, Docker Desktop, k3s 중 무엇으로 시작할지는 03장의 첫 절이고, Docker 자체가 낯설면 [시작하세요! 도커/쿠버네티스 06](../../docker-k8s/06-kubernetes-start)장부터 보면 된다.
