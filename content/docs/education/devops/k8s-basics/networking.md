---
title: "Networking"
weight: 8
---

Kubernetes 네트워킹의 기초부터 Ingress, Gateway API까지 다룹니다.

---

## 1. 네트워킹 기초

### 1.1 Linux 네트워킹 기본

**네트워크 구성 요소:**

```
Switch: 같은 네트워크 내 시스템 연결
Router: 서로 다른 네트워크 연결
Gateway: 외부 네트워크로의 출입구
```

**주요 명령어:**

```bash
# 인터페이스 확인
ip link
ip addr

# IP 주소 할당
ip addr add 192.168.1.10/24 dev eth0

# 라우팅 테이블 확인
ip route
route -n

# 라우트 추가
ip route add 192.168.2.0/24 via 192.168.1.1

# Default Gateway 설정
ip route add default via 192.168.1.1
```

**IP Forwarding (라우터 역할):**

```bash
# 임시 활성화
echo 1 > /proc/sys/net/ipv4/ip_forward

# 영구 활성화 (/etc/sysctl.conf)
net.ipv4.ip_forward = 1
```

### 1.2 DNS 기초

**주요 설정 파일:**

| 파일 | 용도 |
|:-----|:-----|
| `/etc/hosts` | 로컬 호스트명-IP 매핑 |
| `/etc/resolv.conf` | DNS 서버 지정, search domain |
| `/etc/nsswitch.conf` | name resolution 우선순위 |

**DNS Record 타입:**

| Type | 용도 | 예시 |
|:-----|:-----|:-----|
| A | IPv4 주소 매핑 | `web → 192.168.1.10` |
| AAAA | IPv6 주소 매핑 | IPv6 주소 |
| CNAME | 별칭 (이름→이름) | `www → web.example.com` |

**DNS 조회 도구:**

```bash
# DNS 서버만 조회 (hosts 파일 무시)
nslookup google.com
dig google.com

# hosts 파일 + DNS 모두 확인
ping google.com
```

---

## 2. Network Namespace

### 2.1 개념

Network Namespace는 **완전히 격리된 네트워크 스택**을 제공합니다.

```
Host (전체 네트워크 보임)
├── Namespace Red (독립된 인터페이스, 라우팅, ARP)
├── Namespace Blue (독립된 인터페이스, 라우팅, ARP)
└── Namespace Green (독립된 인터페이스, 라우팅, ARP)
```

### 2.2 Namespace 관리

```bash
# Namespace 생성
ip netns add red
ip netns add blue

# Namespace 목록
ip netns

# Namespace 내 명령 실행
ip netns exec red ip link
ip -n red link  # 간단한 형식
```

### 2.3 Namespace 간 연결

**1. Virtual Ethernet Pair (직접 연결):**

```bash
# veth pair 생성
ip link add veth-red type veth peer name veth-blue

# 각 namespace에 할당
ip link set veth-red netns red
ip link set veth-blue netns blue

# IP 할당 및 활성화
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n red link set veth-red up

ip -n blue addr add 192.168.15.2/24 dev veth-blue
ip -n blue link set veth-blue up
```

**2. Bridge를 통한 연결 (다수 namespace):**

```bash
# Bridge 생성
ip link add v-net-0 type bridge
ip link set v-net-0 up
ip addr add 192.168.15.5/24 dev v-net-0

# Namespace를 Bridge에 연결
ip link add veth-red type veth peer name veth-red-br
ip link set veth-red netns red
ip link set veth-red-br master v-net-0
```

### 2.4 외부 네트워크 연결

```bash
# Default Gateway 설정 (namespace 내부)
ip -n red route add default via 192.168.15.5

# NAT 설정 (Host에서)
iptables -t nat -A POSTROUTING -s 192.168.15.0/24 -j MASQUERADE

# 외부에서 namespace로 포트 포워딩
iptables -t nat -A PREROUTING -p tcp --dport 80 \
  -j DNAT --to-destination 192.168.15.2:80
```

---

## 3. Docker Networking

### 3.1 네트워크 모드

| 모드 | 명령어 | 특징 |
|:-----|:-------|:-----|
| none | `--network none` | 완전 격리, 네트워크 없음 |
| host | `--network host` | 호스트와 네트워크 공유 |
| bridge | (기본값) | 내부 사설 네트워크 |

### 3.2 Bridge Network 동작

```
Docker 설치 시:
├── docker0 Bridge 생성 (172.17.0.1)
└── 172.17.0.0/16 네트워크 할당

컨테이너 생성 시:
├── Network Namespace 생성
├── veth pair 생성
│   ├── 컨테이너 내부: eth0
│   └── 호스트: vethXXX → docker0 연결
└── IP 할당 (172.17.0.2, 172.17.0.3, ...)
```

### 3.3 Port Mapping

```bash
# 포트 매핑
docker run -p 8080:80 nginx

# 내부적으로 iptables NAT 규칙 생성
iptables -t nat -A DOCKER -p tcp --dport 8080 \
  -j DNAT --to-destination 172.17.0.3:80
```

---

## 4. Container Network Interface (CNI)

### 4.1 CNI 개념

**CNI**는 컨테이너 런타임과 네트워크 플러그인 간의 **표준 인터페이스**입니다.

```
Kubernetes 표준 인터페이스:
├── CRI (Container Runtime Interface) → containerd, CRI-O
├── CNI (Container Networking Interface) → Calico, Flannel, Weave
└── CSI (Container Storage Interface) → EBS, Azure Disk
```

### 4.2 책임 분담

**Container Runtime 책임:**
- Network Namespace 생성
- CNI 플러그인 호출 (ADD/DEL)
- JSON 형식으로 네트워크 구성 전달

**CNI Plugin 책임:**
- veth pair 생성
- IP 주소 할당
- 라우팅 설정
- 결과 반환

### 4.3 CNI 구성 파일

```
/opt/cni/bin/          # 플러그인 바이너리
├── bridge
├── flannel
├── calico
└── host-local

/etc/cni/net.d/        # 설정 파일 (알파벳 순 첫 번째 사용)
├── 10-flannel.conflist
└── 20-calico.conf
```

**설정 파일 예시:**

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
    "routes": [
      { "dst": "0.0.0.0/0" }
    ]
  }
}
```

---

## 5. 클러스터 네트워킹

### 5.1 필수 포트

**Master Node:**

| 포트 | 컴포넌트 | 용도 |
|:-----|:---------|:-----|
| 6443 | kube-apiserver | API 서버 접근 |
| 10250 | kubelet | 노드 에이전트 |
| 10259 | kube-scheduler | 스케줄러 |
| 10257 | kube-controller-manager | 컨트롤러 매니저 |
| 2379-2380 | etcd | etcd 서버/클러스터 통신 |

**Worker Node:**

| 포트 | 컴포넌트 | 용도 |
|:-----|:---------|:-----|
| 10250 | kubelet | 노드 에이전트 |
| 30000-32767 | NodePort Services | 외부 서비스 노출 |

### 5.2 네트워크 요구사항

```bash
# 기본 요구사항
- 각 노드: 고유한 IP, 호스트명, MAC 주소
- 노드 간 통신 가능
- 필수 포트 개방

# 진단 명령어
ip addr show          # 네트워크 인터페이스
netstat -plnt         # 포트 리스닝 상태
ss -tulpn             # 소켓 상태
iptables -L           # 방화벽 규칙
```

---

## 6. Pod Networking

### 6.1 Kubernetes 네트워킹 요구사항

```
1. 모든 Pod은 고유한 IP 주소 보유
2. 같은 노드 내 Pod 간 IP로 통신 가능
3. 다른 노드의 Pod과도 NAT 없이 IP로 통신 가능
```

### 6.2 Pod 네트워크 구조

```
전체 Pod Network: 10.244.0.0/16
├── Node1 Bridge (cni0): 10.244.1.0/24
│   ├── Pod1: 10.244.1.2
│   └── Pod2: 10.244.1.3
├── Node2 Bridge (cni0): 10.244.2.0/24
│   └── Pod3: 10.244.2.2
└── Node3 Bridge (cni0): 10.244.3.0/24
    └── Pod4: 10.244.3.2
```

### 6.3 CNI 플러그인들

| 플러그인 | 방식 | 특징 |
|:---------|:-----|:-----|
| Flannel | Overlay (VXLAN) | 간단, 기본 기능 |
| Calico | L3 라우팅 + BGP | Network Policy 지원 |
| Weave | Overlay (Mesh) | 자동 토폴로지 관리 |
| Cilium | eBPF 기반 | 고성능, 보안 기능 |

### 6.4 Weave 네트워킹

**동작 원리:**

```
1. Pod A (Node1) → Pod B (Node2) 패킷 전송
2. Node1의 Weave Agent가 패킷 가로채기
3. 캡슐화 (Encapsulation)
4. 네트워크를 통해 Node2로 전송
5. Node2의 Weave Agent가 역캡슐화
6. Pod B로 최종 전달
```

**배포:**

```bash
# DaemonSet으로 배포 (모든 노드에 자동 배포)
kubectl apply -f https://github.com/weaveworks/weave/releases/download/v2.8.1/weave-daemonset-k8s.yaml

# 확인
kubectl get pods -n kube-system | grep weave
kubectl logs -n kube-system weave-net-xxxxx
```

### 6.5 IPAM (IP Address Management)

**IPAM 플러그인:**

| Type | 설명 |
|:-----|:-----|
| host-local | 각 호스트에서 로컬로 IP 관리 |
| dhcp | 외부 DHCP 서버 활용 |

**CNI 솔루션별 기본 범위:**

| 솔루션 | 기본 범위 | 노드별 할당 |
|:-------|:----------|:------------|
| Flannel | 10.244.0.0/16 | /24 서브넷 |
| Calico | 192.168.0.0/16 | BGP 기반 |
| Weave | 10.32.0.0/12 | 자동 균등 분할 |

---

## 7. Service Networking

### 7.1 Service 특징

```
Service는 가상 객체:
- 실제 프로세스나 네임스페이스 없음
- iptables/IPVS 규칙으로만 존재
- 클러스터 전체에서 동일하게 동작
```

### 7.2 Service 유형

| 유형 | 특징 | 용도 |
|:-----|:-----|:-----|
| ClusterIP | 클러스터 내부 접근만 | 내부 서비스 |
| NodePort | ClusterIP + 모든 노드 포트 노출 | 외부 접근 (개발) |
| LoadBalancer | NodePort + 클라우드 LB | 외부 접근 (프로덕션) |

### 7.3 kube-proxy

**역할:**
- API 서버 모니터링으로 Service 변경 감지
- iptables/IPVS 규칙 생성
- Service IP → Pod IP 트래픽 포워딩

**Proxy 모드:**

| 모드 | 특징 |
|:-----|:-----|
| iptables | 기본값, 커널 수준 DNAT |
| IPVS | 고성능, 다양한 LB 알고리즘 |
| userspace | 레거시 (비권장) |

### 7.4 IP 범위 설정

```yaml
# kube-apiserver 설정
--service-cluster-ip-range=10.96.0.0/12   # Service IP
--cluster-cidr=10.244.0.0/16              # Pod IP

# 중요: 두 범위가 겹치면 안 됨
```

**iptables 규칙 예시:**

```bash
# Service: 10.103.132.104:3306 → Pod: 10.244.1.2:3306
iptables -t nat -A KUBE-SERVICES -d 10.103.132.104/32 -p tcp --dport 3306 \
  -j DNAT --to-destination 10.244.1.2:3306

# 규칙 확인
iptables -t nat -L -n | grep <service-name>
```

---

## 8. DNS in Kubernetes

### 8.1 Service DNS

**FQDN 구조:**

```
<service-name>.<namespace>.svc.cluster.local

예시:
web-service.default.svc.cluster.local
```

**접근 방법:**

```bash
# 같은 네임스페이스
curl web-service

# 다른 네임스페이스
curl web-service.apps
curl web-service.apps.svc.cluster.local  # FQDN
```

### 8.2 Pod DNS

```
<pod-ip-with-dashes>.<namespace>.pod.cluster.local

예시:
Pod IP: 10.244.2.5
DNS: 10-244-2-5.default.pod.cluster.local
```

### 8.3 DNS 계층 구조

```
cluster.local
├── svc (서비스 서브도메인)
│   ├── default
│   │   └── web-service
│   └── apps
│       └── api-service
└── pod (Pod 서브도메인)
    └── default
        └── 10-244-1-5
```

### 8.4 CoreDNS

**배포 구조:**

```
kube-system 네임스페이스
├── CoreDNS Pod (2개, 고가용성)
├── kube-dns Service (10.96.0.10)
└── ConfigMap (Corefile)
```

**Corefile 설정:**

```
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

**Pod의 DNS 설정 (자동 구성):**

```bash
# /etc/resolv.conf
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
```

**확인 명령어:**

```bash
# CoreDNS 확인
kubectl get pods -n kube-system | grep coredns
kubectl get svc -n kube-system kube-dns

# DNS 테스트
kubectl run test --image=busybox --rm -it -- nslookup web-service
```

---

## 9. Ingress

### 9.1 Ingress 필요성

```
기존 방식의 문제:
- NodePort: 직접 노출 (보안, 관리 어려움)
- LoadBalancer: 서비스마다 별도 LB (비용 증가)
- SSL 설정 위치 불명확
- URL 기반 라우팅 어려움

Ingress 해결:
- 단일 진입점
- URL/호스트 기반 라우팅
- SSL 종료
- Kubernetes 네이티브 관리
```

### 9.2 Ingress 구성 요소

| 구성 요소 | 역할 |
|:----------|:-----|
| Ingress Controller | 실제 로드밸런싱 수행 (Nginx, Traefik 등) |
| Ingress Resource | 라우팅 규칙 정의 |

### 9.3 Ingress Resource 예시

**경로 기반 라우팅:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
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
```

**호스트 기반 라우팅:**

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

**TLS 설정:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: tls-secret  # TLS 인증서 Secret
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
```

### 9.4 Ingress Controller 설치 (Nginx)

```bash
# Nginx Ingress Controller 설치
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# 확인
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

---

## 10. Gateway API

### 10.1 Ingress의 한계

| 문제점 | 설명 |
|:-------|:-----|
| 멀티테넌시 부족 | 단일 리소스를 여러 팀이 공유하면 충돌 |
| 제한된 프로토콜 | HTTP/HTTPS만 지원 |
| 컨트롤러 종속성 | 어노테이션이 특정 컨트롤러에만 동작 |
| 검증 불가 | Kubernetes가 어노테이션 설정 검증 못함 |

### 10.2 Gateway API 3계층 구조

```
GatewayClass (인프라 제공자)
    ↓
Gateway (클러스터 운영자)
    ↓
Routes (애플리케이션 개발자)
├── HTTPRoute
├── TCPRoute
├── UDPRoute
├── gRPCRoute
└── TLSRoute
```

### 10.3 Gateway API 리소스

**GatewayClass:**

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-class
spec:
  controllerName: example.com/gateway-controller
```

**Gateway:**

```yaml
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
```

**HTTPRoute:**

```yaml
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

### 10.4 트래픽 분할 (Canary)

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

### 10.5 Ingress vs Gateway API

| 기능 | Ingress | Gateway API |
|:-----|:--------|:------------|
| 프로토콜 | HTTP/HTTPS | HTTP, TCP, UDP, gRPC |
| 트래픽 분할 | 어노테이션 (컨트롤러별) | spec에 명시적 정의 |
| 멀티테넌시 | 미지원 | 3계층 역할 분리 |
| 설정 방식 | 어노테이션 의존 | 모든 설정 spec에 정의 |

---

## 11. 네트워킹 문제 해결

### 11.1 Pod 네트워킹 확인

```bash
# Pod IP 확인
kubectl get pods -o wide

# Pod 내부에서 네트워크 확인
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route
kubectl exec -it <pod> -- cat /etc/resolv.conf
```

### 11.2 Service 확인

```bash
# Service 및 Endpoints 확인
kubectl get svc
kubectl get endpoints <service-name>

# Service 상세 정보
kubectl describe svc <service-name>
```

### 11.3 DNS 확인

```bash
# DNS 조회 테스트
kubectl run test --image=busybox --rm -it -- nslookup <service-name>

# CoreDNS 로그 확인
kubectl logs -n kube-system -l k8s-app=kube-dns
```

### 11.4 CNI 확인

```bash
# CNI 설정 확인
ls -la /etc/cni/net.d/
cat /etc/cni/net.d/*.conf

# CNI 플러그인 Pod 확인
kubectl get pods -n kube-system | grep -E 'calico|flannel|weave'
```

### 11.5 kube-proxy 확인

```bash
# kube-proxy 로그
kubectl logs -n kube-system -l k8s-app=kube-proxy

# iptables 규칙 확인 (노드에서)
iptables -t nat -L -n | grep <service-name>
```

---

## 12. 요약

### 12.1 네트워킹 계층

| 계층 | 구성 요소 | 역할 |
|:-----|:----------|:-----|
| L2/L3 | CNI Plugin | Pod IP 할당, 노드 간 통신 |
| L4 | kube-proxy, Service | 서비스 디스커버리, 로드밸런싱 |
| L7 | Ingress, Gateway API | HTTP 라우팅, TLS 종료 |

### 12.2 IP 대역 정리

| 대상 | 기본 범위 | 설정 위치 |
|:-----|:----------|:----------|
| Service | 10.96.0.0/12 | kube-apiserver `--service-cluster-ip-range` |
| Pod | 10.244.0.0/16 | CNI 설정, `--cluster-cidr` |
| Node | 조직 네트워크 | 외부 IPAM |

### 12.3 핵심 개념

| 개념 | 설명 |
|:-----|:-----|
| CNI | 컨테이너 네트워크 표준 인터페이스 |
| kube-proxy | Service를 iptables/IPVS 규칙으로 구현 |
| CoreDNS | 클러스터 내부 DNS 서버 |
| Ingress | L7 로드밸런서 (HTTP/HTTPS) |
| Gateway API | 차세대 Ingress (멀티프로토콜, 멀티테넌시) |

{{< callout type="info" >}}
**모범 사례:**
- CNI 플러그인 선택 시 Network Policy 지원 여부 확인
- Service는 ClusterIP 기본, 외부 노출 시 Ingress 활용
- 프로덕션에서는 Ingress/Gateway API로 트래픽 관리
- CoreDNS 고가용성 유지 (최소 2개 Pod)
{{< /callout >}}
