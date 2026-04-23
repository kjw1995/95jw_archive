---
title: "07. 네트워킹"
weight: 7
---

쿠버네티스 네트워크 모델부터 CNI, Service, Ingress, Gateway API, DNS까지 클러스터 트래픽 흐름을 다룹니다.

## 1. 쿠버네티스 네트워크 모델

### 1.1 네트워킹 요구사항

쿠버네티스는 **플랫 네트워크 모델**을 전제로 한다. 어떤 CNI 플러그인을 쓰더라도 다음 규칙을 지켜야 한다.

| 요구사항 | 설명 |
|:---|:---|
| Pod 고유 IP | 모든 Pod은 클러스터 전체에서 유일한 IP를 가진다 |
| Pod ↔ Pod | 같은/다른 노드 Pod과 NAT 없이 IP로 통신 가능 |
| Node ↔ Pod | 노드 에이전트(kubelet 등)가 해당 노드의 Pod과 통신 |
| Service | 가상 IP를 통한 안정적 엔드포인트 제공 |

```text
    클러스터 네트워크 (10.244.0.0/16)
  ┌────────────────────────────────┐
  │  Node 1 (cni0: 10.244.1.0/24)  │
  │   ├─ Pod: 10.244.1.2           │
  │   └─ Pod: 10.244.1.3           │
  │                                │
  │  Node 2 (cni0: 10.244.2.0/24)  │
  │   └─ Pod: 10.244.2.2           │
  └────────────────────────────────┘
```

### 1.2 IP 대역 설계

```yaml
# kube-apiserver 플래그
--service-cluster-ip-range=10.96.0.0/12   # Service 대역
--cluster-cidr=10.244.0.0/16              # Pod 대역
```

| 대상 | 기본 범위 | 설정 위치 |
|:---|:---|:---|
| Service | 10.96.0.0/12 | kube-apiserver `--service-cluster-ip-range` |
| Pod | 10.244.0.0/16 | CNI 설정, `--cluster-cidr` |
| Node | 조직 네트워크 | 외부 IPAM |

두 대역이 겹치면 라우팅 혼동이 발생하므로 반드시 분리한다.

### 1.3 필수 포트

| 노드 | 포트 | 컴포넌트 |
|:---|:---|:---|
| Master | 6443 | kube-apiserver |
| Master | 2379-2380 | etcd |
| Master | 10259 | kube-scheduler |
| Master | 10257 | kube-controller-manager |
| 공통 | 10250 | kubelet |
| Worker | 30000-32767 | NodePort 범위 |

---

## 2. CNI 아키텍처

### 2.1 CNI란

**CNI (Container Network Interface)** 는 컨테이너 런타임과 네트워크 플러그인 사이의 표준 인터페이스다. 런타임이 Pod을 띄울 때 CNI 플러그인을 호출해 네트워크를 구성한다.

```text
Kubernetes 표준 인터페이스
 ├─ CRI  : containerd, CRI-O
 ├─ CNI  : Calico, Flannel, Cilium
 └─ CSI  : EBS, Azure Disk
```

### 2.2 책임 분담

| 주체 | 책임 |
|:---|:---|
| Container Runtime | Network Namespace 생성, CNI 호출(ADD/DEL), JSON 전달 |
| CNI Plugin | veth 생성, IP 할당, 라우팅 설정, 결과 반환 |

### 2.3 설정 파일 위치

```text
/opt/cni/bin/          # 플러그인 바이너리
├── bridge
├── flannel
├── calico
└── host-local

/etc/cni/net.d/        # 알파벳 순 첫 파일 사용
├── 10-flannel.conflist
└── 20-calico.conf
```

```json
{
  "cniVersion": "0.3.0",
  "name": "mynet",
  "type": "bridge",
  "bridge": "cni0",
  "isGateway": true,
  "ipMasq": true,
  "ipam": {
    "type": "host-local",
    "subnet": "10.244.0.0/16",
    "routes": [ { "dst": "0.0.0.0/0" } ]
  }
}
```

### 2.4 주요 CNI 플러그인 비교

| 플러그인 | 방식 | 기본 대역 | 특징 |
|:---|:---|:---|:---|
| Flannel | Overlay (VXLAN) | 10.244.0.0/16 | 단순, 기본기 |
| Calico | L3 + BGP | 192.168.0.0/16 | NetworkPolicy, BGP 피어링 |
| Weave | Overlay (Mesh) | 10.32.0.0/12 | 자동 토폴로지 |
| Cilium | eBPF | 유연 | 고성능, L7 가시성, NetworkPolicy |

{{< callout type="info" >}}
**CNI 선택 기준**
- NetworkPolicy 필요: Calico, Cilium (Flannel 단독은 미지원)
- 고성능/관측성: Cilium (eBPF)
- 단순 구성/학습: Flannel
- 온프레미스 BGP 연동: Calico
{{< /callout >}}

### 2.5 IPAM

| Type | 설명 |
|:---|:---|
| host-local | 각 호스트에서 로컬로 IP 범위 관리 |
| dhcp | 외부 DHCP 서버 사용 |

---

## 3. Service 기본

### 3.1 왜 필요한가

Pod은 휘발성이며 재생성 시 IP가 바뀐다. Service는 Pod 앞에 **고정 가상 IP**와 DNS 이름을 제공해 안정적인 접점을 만든다.

```text
    Client
      │
      ▼
┌──────────────┐
│   Service    │  (ClusterIP: 10.96.0.100)
│  셀렉터 매칭  │
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
 Pod  Pod  Pod  (app: nginx)
```

### 3.2 동작 원리

- Service는 **가상 객체**다. 실제 프로세스나 namespace 없이 **iptables/IPVS 규칙**으로만 존재한다.
- **kube-proxy**가 API 서버를 감시하며 Service/Endpoint 변경을 iptables(기본) 또는 IPVS 규칙으로 반영한다.

```bash
# Service: 10.103.132.104:3306 → Pod: 10.244.1.2:3306
iptables -t nat -A KUBE-SERVICES \
  -d 10.103.132.104/32 -p tcp --dport 3306 \
  -j DNAT --to-destination 10.244.1.2:3306
```

| 모드 | 특징 |
|:---|:---|
| iptables | 기본값, 커널 DNAT |
| IPVS | 다양한 LB 알고리즘, 고성능 |
| userspace | 레거시 (비권장) |

### 3.3 Service 유형 개요

| 유형 | 용도 | 접근 범위 |
|:---|:---|:---|
| ClusterIP | 클러스터 내부 통신 | 내부 |
| NodePort | 노드 포트로 외부 노출 | 외부 → 내부 |
| LoadBalancer | 클라우드 LB 활용 | 외부 → 내부 |
| ExternalName | 외부 도메인 CNAME | 내부 → 외부 |

```text
           외부 (인터넷)
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
┌──────┐   ┌──────┐   ┌────────┐
│NodePt│   │ LB   │   │Ingress │
└──┬───┘   └──┬───┘   └───┬────┘
   └──────────┼───────────┘
              ▼
        ┌──────────┐
        │ClusterIP │
        └────┬─────┘
             │
       ┌─────┼─────┐
       ▼     ▼     ▼
      Pod   Pod   Pod
```

---

## 4. ClusterIP

### 4.1 기본 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: ClusterIP      # 기본값 (생략 가능)
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80           # Service 포트
    targetPort: 80     # Pod 포트
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
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
        image: nginx:latest
        ports:
        - containerPort: 80
```

### 4.2 명령형 생성

```bash
kubectl expose deployment nginx-deployment \
  --name=nginx-service \
  --port=80 --target-port=80 \
  --type=ClusterIP
```

### 4.3 셀렉터와 Endpoints

Service는 `selector`로 Pod `labels`를 매칭하고, 매칭된 Pod IP가 `Endpoints`에 자동 등록된다.

```bash
kubectl get endpoints nginx-service
# NAME            ENDPOINTS                                    AGE
# nginx-service   10.244.1.5:80,10.244.2.8:80,10.244.3.12:80   5m
```

### 4.4 Headless Service

`clusterIP: None`으로 지정하면 가상 IP 없이 DNS가 **모든 Pod IP**를 반환한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: headless-service
spec:
  clusterIP: None      # Headless
  selector:
    app: mysql
  ports:
  - port: 3306
```

```bash
# Headless: 모든 Pod IP 반환
nslookup headless-service.default.svc.cluster.local

# 일반 Service: ClusterIP 하나만 반환
nslookup nginx-service.default.svc.cluster.local
```

{{< callout type="info" >}}
**Headless Service 용도**
- **StatefulSet**: 각 Pod에 `pod-0.svc`, `pod-1.svc` 같은 고유 DNS 부여 (Kafka, MySQL, Cassandra 등)
- **클라이언트 사이드 LB**: gRPC처럼 클라이언트가 직접 Pod을 선택해야 하는 경우
- **로드밸런싱이 필요 없는 피어 디스커버리** (예: 분산 캐시 클러스터)
{{< /callout >}}

---

## 5. NodePort

### 5.1 개념

모든 워커 노드에 동일한 포트(30000-32767)를 열어 외부에서 접근할 수 있게 한다. 내부적으로는 ClusterIP도 함께 생성된다.

```text
 외부
  │  http://<node-ip>:30080
  ▼
┌────────────────────────────┐
│ Node1:30080  Node2:30080   │
│      └──────┬──────┘       │
│             ▼              │
│        ┌─────────┐         │
│        │ Service │         │
│        └────┬────┘         │
│     ┌──────┼──────┐        │
│     ▼      ▼      ▼        │
│    Pod    Pod    Pod       │
└────────────────────────────┘
```

### 5.2 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodeport-service
spec:
  type: NodePort
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
    nodePort: 30080       # 30000-32767
```

```bash
kubectl apply -f nodeport-service.yaml
kubectl get nodes -o wide
curl http://<NODE_IP>:30080
```

### 5.3 제약사항

| 제약 | 설명 |
|:---|:---|
| 포트 범위 | 30000-32767 |
| 포트당 단일 서비스 | 동일 포트에 둘 이상 배정 불가 |
| 노드 IP 의존 | 노드 교체 시 클라이언트 설정 변경 |
| 보안 | 모든 노드에 포트가 열림 |

---

## 6. LoadBalancer

### 6.1 개념

클라우드 프로바이더의 로드밸런서와 연동해 외부 IP를 자동 할당받는다. 내부적으로 NodePort + ClusterIP가 함께 생성된다.

```text
┌──────────────────────────┐
│  Cloud Load Balancer     │
│  EXTERNAL-IP             │
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│  LoadBalancer Service    │
│  (NodePort 자동 생성)     │
└───────────┬──────────────┘
            │
      ┌─────┼─────┐
      ▼     ▼     ▼
     Pod   Pod   Pod
```

### 6.2 예제

```yaml
apiVersion: v1
kind: Service
metadata:
  name: loadbalancer-service
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
```

```bash
kubectl get svc loadbalancer-service
# NAME                   TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)
# loadbalancer-service   LoadBalancer   10.96.45.123    203.0.113.10    80:31234/TCP
```

### 6.3 L4 vs L7

| 구분 | L4 (LoadBalancer) | L7 (Ingress) |
|:---|:---|:---|
| OSI 계층 | 전송 (TCP/UDP) | 애플리케이션 (HTTP) |
| 분산 기준 | IP, 포트 | URL, 헤더, 쿠키 |
| 사용 사례 | 일반 TCP 트래픽 | 웹 라우팅, SSL 종료 |

### 6.4 온프레미스: MetalLB

클라우드가 아닌 환경에서도 LoadBalancer 타입을 쓰려면 **MetalLB**를 설치해 L2/BGP로 외부 IP를 광고한다.

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
spec:
  ipAddressPools:
  - default-pool
```

또는 `externalIPs`를 직접 지정할 수도 있다.

```yaml
spec:
  type: ClusterIP
  externalIPs:
    - 192.168.1.100
```

---

## 7. ExternalName

외부 도메인으로 리다이렉트하는 **DNS CNAME** 레코드를 생성한다. 트래픽 프록시가 아닌 이름 해석 수준의 매핑이다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: database.external-provider.com
```

```bash
# Pod 내부에서
curl http://external-db    # database.external-provider.com 으로 해석
```

**사용 사례**: 외부 DB/API 참조, 마이그레이션 과도기, 환경별 엔드포인트 추상화.

---

## 8. Ingress

### 8.1 왜 필요한가

NodePort/LoadBalancer만으로는 서비스 개수만큼 LB가 늘어나고, URL 기반 라우팅과 SSL 종료 위치가 애매해진다. **Ingress**는 단일 진입점에서 L7 라우팅을 한다.

```text
        Ingress Controller
       (nginx / traefik)
              │
   ┌──────────┼──────────┐
 /api        /web      /admin
   ▼          ▼          ▼
 api-svc   web-svc   admin-svc
   │          │          │
  Pods      Pods      Pods
```

### 8.2 구성 요소

| 구성 | 역할 |
|:---|:---|
| Ingress Controller | 실제 L7 프록시 (Nginx, Traefik, HAProxy 등) |
| Ingress Resource | 라우팅 규칙 선언 |
| IngressClass | 여러 컨트롤러 구분 |

### 8.3 Controller 설치

```bash
# Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx

# 또는 manifest
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### 8.4 호스트 기반 라우팅

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
```

### 8.5 경로 기반 라우팅

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
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
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### 8.6 TLS 설정

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - secure.example.com
    secretName: tls-secret
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 80
```

```bash
kubectl create secret tls tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

---

## 9. Gateway API

### 9.1 Ingress의 한계

| 문제 | 설명 |
|:---|:---|
| 멀티테넌시 부족 | 단일 리소스를 여러 팀이 공유하면 충돌 |
| 프로토콜 제한 | HTTP/HTTPS 중심 |
| 어노테이션 종속 | 고급 기능이 컨트롤러별 annotation으로만 |
| 스키마 검증 부족 | 어노테이션 값은 Kubernetes가 검증 못함 |

### 9.2 3계층 구조

```text
 GatewayClass   (인프라 제공자)
      │
      ▼
 Gateway        (클러스터 운영자)
      │
      ▼
 Routes         (앱 개발자)
  ├─ HTTPRoute
  ├─ TCPRoute
  ├─ UDPRoute
  ├─ gRPCRoute
  └─ TLSRoute
```

### 9.3 리소스 예제

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-class
spec:
  controllerName: example.com/gateway-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: example-gateway
spec:
  gatewayClassName: example-class
  listeners:
  - name: http
    protocol: HTTP
    port: 80
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      certificateRefs:
      - name: tls-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
spec:
  parentRefs:
  - name: example-gateway
  hostnames:
  - "www.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-service
      port: 8080
```

### 9.4 트래픽 분할 (Canary)

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
  - name: example-gateway
  rules:
  - backendRefs:
    - name: app-v1
      port: 80
      weight: 80
    - name: app-v2
      port: 80
      weight: 20
```

### 9.5 Ingress vs Gateway API

| 기능 | Ingress | Gateway API |
|:---|:---|:---|
| 프로토콜 | HTTP/HTTPS | HTTP, TCP, UDP, gRPC, TLS |
| 트래픽 분할 | 컨트롤러별 어노테이션 | spec의 `weight`로 명시 |
| 멀티테넌시 | 미지원 | 3계층 역할 분리 |
| 설정 방식 | 어노테이션 의존 | spec 필드로 표준화 |
| 검증 | 어노테이션 불가 | 스키마 검증 |

{{< callout type="info" >}}
**Ingress vs Gateway API 선택**
- 기존 Ingress로 충분한 HTTP 라우팅/TLS면 그대로 유지 (생태계 성숙)
- TCP/UDP/gRPC, 멀티테넌시, 트래픽 분할을 spec으로 표현하고 싶다면 Gateway API
- Istio, Contour, Kong 등은 이미 Gateway API를 지원 — 새 프로젝트는 Gateway API를 우선 검토
{{< /callout >}}

---

## 10. DNS와 CoreDNS

### 10.1 Service DNS FQDN

```text
<service-name>.<namespace>.svc.cluster.local

예) web-service.default.svc.cluster.local
```

```bash
# 같은 네임스페이스
curl web-service

# 다른 네임스페이스
curl web-service.apps
curl web-service.apps.svc.cluster.local
```

### 10.2 Pod DNS

```text
<pod-ip-with-dashes>.<namespace>.pod.cluster.local

Pod IP: 10.244.2.5
→ 10-244-2-5.default.pod.cluster.local
```

### 10.3 DNS 계층

```text
cluster.local
 ├── svc
 │   ├── default/web-service
 │   └── apps/api-service
 └── pod
     └── default/10-244-1-5
```

### 10.4 CoreDNS 구성

```text
kube-system 네임스페이스
 ├── CoreDNS Pod × 2 (HA)
 ├── kube-dns Service (10.96.0.10)
 └── ConfigMap (Corefile)
```

```text
cluster.local {
    errors
    health
    kubernetes cluster.local {
        pods insecure
        fallthrough
    }
    forward . /etc/resolv.conf
    cache 30
}
```

### 10.5 Pod의 resolv.conf

```bash
# /etc/resolv.conf (자동 주입)
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
```

### 10.6 디버깅

```bash
kubectl get pods -n kube-system | grep coredns
kubectl get svc -n kube-system kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# DNS 테스트
kubectl run test --image=busybox --rm -it -- nslookup web-service
```

---

## 11. Service Mesh 개요

Service Mesh는 Pod 옆에 사이드카 프록시를 배치하거나 eBPF로 커널에서 트래픽을 가로채 **관측/보안/트래픽 제어**를 투명하게 제공하는 계층이다.

| 기능 | 제공 내용 |
|:---|:---|
| 상호 TLS (mTLS) | 서비스 간 자동 암호화 |
| 트래픽 정책 | 카나리, 재시도, 서킷 브레이커 |
| 관측성 | 분산 트레이싱, 메트릭, 로그 |
| 정책 | 인증 정책, 트래픽 권한 |

| 구현체 | 방식 | 특징 |
|:---|:---|:---|
| Istio | Envoy 사이드카 | 기능 풍부, 복잡도 높음 |
| Linkerd | Rust 경량 프록시 | 단순성, 성능 우선 |
| Cilium Service Mesh | eBPF | 사이드카 없음, 저오버헤드 |

Gateway API와 함께 쓰면 **클러스터 외부 트래픽(Gateway) + 내부 서비스 트래픽(Mesh)** 을 일관된 추상화로 관리할 수 있다.

---

## 12. 네트워킹 문제 해결

### 12.1 Pod 네트워크 확인

```bash
kubectl get pods -o wide
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route
kubectl exec -it <pod> -- cat /etc/resolv.conf
```

### 12.2 Service/Endpoints 확인

```bash
kubectl get svc
kubectl get endpoints <service-name>
kubectl describe svc <service-name>

# 내부 접속 테스트
kubectl run curl --image=curlimages/curl -it --rm -- curl http://my-service
```

### 12.3 DNS 확인

```bash
kubectl run test --image=busybox --rm -it -- nslookup <service-name>
kubectl logs -n kube-system -l k8s-app=kube-dns
```

### 12.4 CNI / kube-proxy

```bash
# CNI 설정
ls -la /etc/cni/net.d/
cat /etc/cni/net.d/*.conf

kubectl get pods -n kube-system | grep -E 'calico|flannel|weave|cilium'

# kube-proxy
kubectl logs -n kube-system -l k8s-app=kube-proxy
iptables -t nat -L -n | grep <service-name>
```

### 12.5 Ingress

```bash
kubectl describe ingress <ingress-name>
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

---

## 13. 요약

### 13.1 네트워킹 계층

| 계층 | 구성 요소 | 역할 |
|:---|:---|:---|
| L2/L3 | CNI Plugin | Pod IP 할당, 노드 간 통신 |
| L4 | kube-proxy, Service | 서비스 디스커버리, 로드밸런싱 |
| L7 | Ingress, Gateway API | HTTP 라우팅, TLS 종료 |
| L7+ | Service Mesh | mTLS, 트래픽 제어, 관측성 |

### 13.2 Service 유형 선택

| 상황 | 권장 유형 |
|:---|:---|
| 클러스터 내부 통신 | ClusterIP |
| StatefulSet, 클라이언트 LB | Headless (ClusterIP: None) |
| 개발/테스트 외부 접근 | NodePort |
| 프로덕션 외부 접근 | LoadBalancer |
| HTTP/HTTPS 라우팅 | Ingress / Gateway API |
| 외부 서비스 참조 | ExternalName |

### 13.3 핵심 개념

| 개념 | 설명 |
|:---|:---|
| CNI | 컨테이너 네트워크 표준 인터페이스 |
| kube-proxy | Service를 iptables/IPVS 규칙으로 구현 |
| CoreDNS | 클러스터 내부 DNS 서버 (10.96.0.10) |
| Ingress | L7 로드밸런서 (HTTP/HTTPS) |
| Gateway API | 차세대 Ingress, 멀티프로토콜·멀티테넌시 |
| Service Mesh | mTLS/트래픽 제어/관측성 투명 제공 |
