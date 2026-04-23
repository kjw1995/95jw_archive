---
title: "Chapter 06. 쿠버네티스 시작하기"
weight: 6
---

쿠버네티스의 핵심 오브젝트인 파드, 레플리카셋, 디플로이먼트, 서비스의 개념과 사용법을 다룬다.

---

## 1. 쿠버네티스를 시작하기 전에

### 모든 리소스는 오브젝트로 관리된다

쿠버네티스는 대부분의 리소스를 **오브젝트(Object)** 형태로 관리한다.

```bash
# 사용 가능한 오브젝트 목록 확인
kubectl api-resources

# 특정 오브젝트 설명 확인
kubectl explain pod
```

### YAML 파일 기반 관리

`kubectl` 명령어로도 쿠버네티스를 사용할 수 있지만, 실제 운영 환경에서는 **YAML 파일**로 리소스를 정의하고 적용하는 방식이 표준이다.

| 방식 | 특징 |
|:-----|:-----|
| kubectl 명령어 | 빠르고 간단, 일회성 작업에 적합 |
| YAML 파일 | 버전 관리 가능, 재현성 보장, 운영 환경 표준 |

### 쿠버네티스 컴포넌트

```
  마스터 노드
  ┌──────────────────┐
  │ kube-apiserver   │
  │ kube-scheduler   │
  │ kube-controller  │
  │ coreDNS          │
  └──────────────────┘

  모든 노드 공통
  ┌──────────────────┐
  │ kubelet          │
  │ kube-proxy       │
  │ 네트워크 플러그인  │
  │ 컨테이너 런타임   │
  └──────────────────┘
```

| 컴포넌트 | 역할 |
|:-----|:-----|
| kube-apiserver | 모든 요청의 진입점 |
| kube-scheduler | 파드를 어느 노드에 배치할지 결정 |
| kube-controller-manager | 오브젝트 상태 모니터링 및 유지 |
| kubelet | 컨테이너 생성/삭제, 마스터-워커 간 통신 |
| kube-proxy | 오버레이 네트워크 구성 |

{{< callout type="warning" >}}
**kubelet**이 정상 실행되지 않으면 해당 노드는 클러스터와 제대로 연결되지 않는다. kubelet은 컨테이너 관리와 노드 간 통신을 모두 담당하는 핵심 에이전트다.
{{< /callout >}}

{{< callout type="info" >}}
쿠버네티스는 OCI(Open Container Initiative) 표준을 구현한 컨테이너 런타임이면 어떤 것이든 사용할 수 있다. containerd, cri-o 등이 대표적이다.
{{< /callout >}}

---

## 2. 파드(Pod)

### 파드란

파드는 쿠버네티스에서 **컨테이너 애플리케이션의 기본 단위**다. 1개 이상의 컨테이너로 구성되며, 같은 파드 내 컨테이너들은 네트워크 네임스페이스를 공유한다.

| 플랫폼 | 기본 단위 |
|:-----|:-----|
| 도커 엔진 | 컨테이너 |
| 도커 스웜 | 서비스 |
| 쿠버네티스 | **파드(Pod)** |

### 파드 YAML 정의

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-nginx-pod
spec:
  containers:
  - name: my-nginx-container
    image: nginx:latest
    ports:
    - containerPort: 80
      protocol: TCP
```

### YAML 필수 항목

| 항목 | 설명 |
|:-----|:-----|
| apiVersion | 오브젝트의 API 버전 |
| kind | 리소스 종류 (Pod, Service 등) |
| metadata | 이름, 라벨, 주석 등 부가 정보 |
| spec | 리소스 생성을 위한 상세 정보 |

### 파드 관리 명령어

```bash
# 파드 생성
kubectl apply -f nginx-pod.yaml

# 파드 목록 조회
kubectl get pods

# 파드 상세 정보
kubectl describe pods my-nginx-pod

# 파드 내부 명령 실행
kubectl exec -it my-nginx-pod \
  -- /bin/bash

# 로그 확인
kubectl logs my-nginx-pod

# 파드 삭제
kubectl delete -f nginx-pod.yaml
```

### 한 파드에 여러 컨테이너

YAML의 `spec.containers` 항목에서 대시(`-`)로 여러 컨테이너를 정의할 수 있다. 같은 파드 내 컨테이너들은 **localhost로 서로 통신**할 수 있다.

```yaml
spec:
  containers:
  - name: nginx
    image: nginx:latest
    ports:
    - containerPort: 80
  - name: sidecar
    image: busybox
    command: ["sh", "-c", "while true; do sleep 3600; done"]
```

```bash
# 특정 컨테이너에 명령 실행
kubectl exec -it my-pod \
  -c sidecar -- /bin/sh
```

{{< callout type="info" >}}
파드에 정의된 부가적인 컨테이너를 **사이드카(Sidecar) 컨테이너**라 한다. 로그 수집, 프록시 등의 보조 역할을 담당하며, 메인 컨테이너와 같은 노드에서 실행된다.
{{< /callout >}}

{{< callout type="info" >}}
YAML의 `command`는 도커의 **Entrypoint**, `args`는 도커의 **Cmd**와 동일하다.
{{< /callout >}}

---

## 3. 레플리카셋(ReplicaSet)

### 레플리카셋이 필요한 이유

파드만 단독으로 사용하면 다음과 같은 한계가 있다.

| 한계 | 설명 |
|:-----|:-----|
| 자동 복구 불가 | 파드가 삭제되면 영원히 사라짐 |
| 스케일링 불가 | 수동으로 파드를 하나씩 생성해야 함 |
| 고가용성 불가 | 노드 장애 시 파드도 함께 사라짐 |

**레플리카셋의 역할:**
- 정해진 수의 동일한 파드가 **항상 실행되도록 유지**
- 노드 장애 시 **다른 노드에서 파드를 재생성**

### 레플리카셋 YAML

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: replicaset-nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-nginx-pods-label
  template:           # ← 파드 템플릿
    metadata:
      name: my-nginx-pod
      labels:
        app: my-nginx-pods-label
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
```

```
  레플리카셋 YAML 구조

  ┌──────────────────┐
  │ 레플리카셋 정의   │
  │ - replicas: 3    │
  │ - selector       │
  ├──────────────────┤
  │ 파드 템플릿      │
  │ (template)       │
  │ - metadata       │
  │ - spec           │
  └──────────────────┘
```

### 라벨과 셀렉터

레플리카셋은 파드와 **직접 연결되지 않고**, **라벨 셀렉터(Label Selector)** 를 통해 느슨한 연결을 유지한다.

```
  레플리카셋
  ┌──────────────────┐
  │ selector:        │
  │  app: my-nginx   │──┐
  └──────────────────┘  │
                         │ 라벨 매칭
  ┌─────┐ ┌─────┐ ┌─────┐
  │Pod A│ │Pod B│ │Pod C│
  │app: │ │app: │ │app: │
  │my-  │ │my-  │ │my-  │
  │nginx│ │nginx│ │nginx│
  └─────┘ └─────┘ └─────┘
```

```bash
# 라벨 확인
kubectl get pods --show-labels

# 파드 개수 변경 (replicas 수정)
kubectl scale rs replicaset-nginx \
  --replicas=5
```

{{< callout type="warning" >}}
레플리카셋의 목적은 **'파드를 생성하는 것'이 아니라 '일정 개수의 파드를 유지하는 것'** 이다. 파드가 부족하면 생성하고, 초과하면 삭제하여 `replicas` 수에 맞춘다.
{{< /callout >}}

### 레플리케이션 컨트롤러 vs 레플리카셋

| 구분 | 레플리케이션 컨트롤러 | 레플리카셋 |
|:-----|:-----|:-----|
| 상태 | Deprecated | 현재 사용 |
| 셀렉터 | 등호 기반만 가능 | **표현식(matchExpression)** 지원 |
| 연산자 | = 만 가능 | In, NotIn, Exists 등 |

---

## 4. 디플로이먼트(Deployment)

### 디플로이먼트란

디플로이먼트는 **레플리카셋의 상위 오브젝트**다. 디플로이먼트를 생성하면 레플리카셋과 파드가 자동으로 함께 생성된다. 실무에서 가장 많이 사용하는 오브젝트다.

```
  디플로이먼트 계층 구조

  Deployment
      │ 관리
      ▼
  ReplicaSet
      │ 관리
      ▼
  Pod  Pod  Pod
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-nginx
  template:
    metadata:
      labels:
        app: my-nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.10
        ports:
        - containerPort: 80
```

### 디플로이먼트를 사용하는 이유

핵심 이유는 **애플리케이션의 업데이트와 배포를 편하게 만들기 위해서**다.

```bash
# 이미지 업데이트
kubectl set image deployment \
  my-nginx-deployment \
  nginx=nginx:1.11

# 리비전 히스토리 확인
kubectl rollout history deployment

# 롤백 (이전 버전으로)
kubectl rollout undo deployment \
  my-nginx-deployment \
  --to-revision=1
```

### 리비전 관리

디플로이먼트는 파드 정보가 업데이트될 때 **이전 레플리카셋을 삭제하지 않고 보존**한다. 이를 **리비전(Revision)** 이라 하며, 언제든 이전 버전으로 롤백할 수 있다.

```
  리비전 관리

  Deployment
      │
  ┌───┴───────────┐
  │               │
  ReplicaSet v1   ReplicaSet v2
  (nginx:1.10)    (nginx:1.11)
  replicas: 0     replicas: 3
  ← 보존           ← 현재 활성
```

{{< callout type="info" >}}
`--record=true` 옵션으로 변경하면 어떤 명령어로 변경됐는지 **CHANGE-CAUSE** 항목에 기록된다. 리비전 관리에 유용하므로 가능하면 사용하는 것이 좋다.
{{< /callout >}}

{{< callout type="info" >}}
**pod-template-hash** 라벨이 각 레플리카셋에 자동으로 설정되어, 여러 레플리카셋이 겹치지 않는 라벨로 파드를 관리할 수 있다.
{{< /callout >}}

---

## 5. 서비스(Service)

### 서비스가 필요한 이유

파드의 IP는 **영속적이지 않아 항상 변할 수 있다**. 여러 디플로이먼트를 하나의 애플리케이션으로 연동하려면 파드 IP가 아닌 다른 방법이 필요하다. 이것이 서비스다.

| 기능 | 설명 |
|:-----|:-----|
| 고유 도메인 | 파드 그룹에 DNS 이름 부여 |
| 로드 밸런싱 | 요청을 여러 파드에 분산 |
| 외부 노출 | 클러스터 외부에서 파드 접근 가능 |

### 서비스 타입 비교

| 타입 | 접근 범위 | 용도 |
|:-----|:-----|:-----|
| ClusterIP | 클러스터 내부만 | 내부 통신 |
| NodePort | 노드 IP + 포트 | 외부 노출 (개발/테스트) |
| LoadBalancer | 클라우드 LB | 외부 노출 (운영) |
| ExternalName | 외부 도메인 | 외부 시스템 연동 |

```
  서비스 타입 포함 관계

  ┌──────────────────┐
  │ LoadBalancer     │
  │ ┌──────────────┐ │
  │ │ NodePort     │ │
  │ │ ┌──────────┐ │ │
  │ │ │ClusterIP │ │ │
  │ │ └──────────┘ │ │
  │ └──────────────┘ │
  └──────────────────┘
  각 상위 타입은 하위 타입의
  기능을 포함한다
```

### ClusterIP

클러스터 **내부에서만** 파드에 접근할 때 사용한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hostname-svc-clusterip
spec:
  type: ClusterIP
  selector:
    app: webserver
  ports:
  - name: web-port
    port: 8080        # 서비스 포트
    targetPort: 80    # 컨테이너 포트
```

| 항목 | 설명 |
|:-----|:-----|
| selector | 연결할 파드의 라벨 |
| port | 서비스에 접근할 포트 |
| targetPort | 파드의 containerPort |

```
  ClusterIP 동작

  클러스터 내부 Pod
       │
       │ svc-name:8080
       ▼
  ┌──────────────────┐
  │ Service          │
  │ (ClusterIP)      │
  │ 10.96.0.100:8080 │
  └────────┬─────────┘
           │ 로드 밸런싱
     ┌─────┼─────┐
     ▼     ▼     ▼
   Pod1  Pod2  Pod3
   :80   :80   :80
```

{{< callout type="info" >}}
쿠버네티스는 내부 DNS를 구동하고 있어, **서비스 이름 자체를 도메인처럼** 사용할 수 있다. 파드 간 통신 시 IP 대신 서비스 이름을 사용하는 것이 일반적이다.
{{< /callout >}}

{{< callout type="info" >}}
서비스의 라벨 셀렉터와 파드의 라벨이 매칭되면, 쿠버네티스는 **엔드포인트(Endpoint)** 오브젝트를 자동으로 생성한다. 엔드포인트는 서비스가 가리키는 파드 목록을 나타낸다.
{{< /callout >}}

### NodePort

클러스터 **외부에서** 파드에 접근할 때 사용한다. 모든 노드에 동일한 포트를 개방한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hostname-svc-nodeport
spec:
  type: NodePort
  selector:
    app: webserver
  ports:
  - name: web-port
    port: 8080
    targetPort: 80
```

```
  NodePort 동작

  외부 클라이언트
       │
       │ <NodeIP>:31514
       ▼
  ┌──────────┐  ┌──────────┐
  │ Worker1  │  │ Worker2  │
  │ :31514   │  │ :31514   │
  └────┬─────┘  └────┬─────┘
       │              │
       └──────┬───────┘
              │ 로드 밸런싱
        ┌─────┼─────┐
        ▼     ▼     ▼
      Pod1  Pod2  Pod3
```

{{< callout type="info" >}}
NodePort는 ClusterIP의 기능을 **포함**한다. 내부에서는 ClusterIP로, 외부에서는 NodePort로 모두 접근할 수 있다.
{{< /callout >}}

{{< callout type="warning" >}}
NodePort의 기본 포트 범위는 **30000~32768**이다. 80이나 443을 직접 사용하기 어렵고 SSL 설정도 복잡하므로, 운영 환경에서는 보통 **인그레스(Ingress)** 를 통해 간접적으로 사용한다.
{{< /callout >}}

### LoadBalancer

클라우드 플랫폼에서 **로드 밸런서를 자동 생성**하여 파드에 연결한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hostname-svc-lb
spec:
  type: LoadBalancer
  selector:
    app: webserver
  ports:
  - name: web-port
    port: 80
    targetPort: 80
```

```
  LoadBalancer 동작

  외부 클라이언트
       │
       │ EXTERNAL-IP:80
       ▼
  ┌──────────────────┐
  │ 클라우드 LB      │
  │ (자동 프로비저닝) │
  └────────┬─────────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
  Node1  Node2  Node3
  :32620 :32620 :32620
     │     │     │
     └─────┼─────┘
           ▼
    Pod (로드 밸런싱)
```

**LoadBalancer 동작 원리:**
1. 서비스 생성 시 모든 워커 노드에 **랜덤 포트 개방** (NodePort)
2. 클라우드 LB로 들어온 요청이 노드의 랜덤 포트로 전달
3. 노드에서 파드로 요청 전달

{{< callout type="info" >}}
AWS에서 NLB(Network Load Balancer)를 사용하려면 annotations에 `service.beta.kubernetes.io/aws-load-balancer-type: "nlb"` 를 추가한다.
{{< /callout >}}

{{< callout type="info" >}}
온프레미스 환경에서는 **MetalLB** 같은 오픈소스를 사용하면 LoadBalancer 타입을 활용할 수 있다.
{{< /callout >}}

### externalTrafficPolicy

서비스가 외부 트래픽을 어떻게 분배할지 결정하는 속성이다.

| 값 | 동작 | 장점 | 단점 |
|:-----|:-----|:-----|:-----|
| Cluster (기본) | 모든 노드에서 모든 파드로 분산 | 균등 분배 | 클라이언트 IP 보존 불가, 추가 네트워크 홉 |
| Local | 로컬 노드의 파드로만 전달 | 클라이언트 IP 보존, 홉 감소 | 파드 분포 불균등 시 부하 편중 |

```
  Cluster (기본)       Local

  LB                  LB
   │                   │
   ▼                   ▼
  Node1 ──→ Node2    Node1 (파드 있음)
   │         │         │
   ▼         ▼         ▼
  Pod(any) Pod(any)  Pod(로컬만)
  NAT 발생             IP 보존
```

### ExternalName

쿠버네티스 서비스가 **외부 도메인을 가리키도록** 설정한다. 레거시 시스템과의 연동에 유용하다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-svc
spec:
  type: ExternalName
  externalName: api.legacy-system.com
```

{{< callout type="info" >}}
ExternalName은 DNS의 **CNAME 레코드**를 생성한다. A 레코드(도메인→IP)와 달리 CNAME은 도메인→도메인 매핑이다.
{{< /callout >}}

---

## 요약

### 핵심 오브젝트 관계

```
  Deployment
      │ 생성/관리
      ▼
  ReplicaSet
      │ 생성/유지
      ▼
  Pod ← Service
       (접근 제공)
```

### 오브젝트별 역할

| 오브젝트 | 역할 | 핵심 포인트 |
|:-----|:-----|:-----|
| Pod | 컨테이너의 기본 단위 | 1개 이상의 컨테이너, 네임스페이스 공유 |
| ReplicaSet | 파드 개수 유지 | 라벨 셀렉터로 파드와 느슨한 연결 |
| Deployment | 배포 관리 | 리비전 관리, 롤백, 롤링 업데이트 |
| Service | 파드 접근 규칙 | DNS 이름, 로드 밸런싱, 외부 노출 |

### 서비스 타입 선택 가이드

| 상황 | 권장 타입 |
|:-----|:-----|
| 내부 파드 간 통신 | ClusterIP |
| 개발/테스트 환경 외부 접근 | NodePort |
| 운영 환경 외부 접근 (클라우드) | LoadBalancer |
| 외부 시스템 연동 | ExternalName |
| HTTP/HTTPS 라우팅 | Ingress + NodePort |
