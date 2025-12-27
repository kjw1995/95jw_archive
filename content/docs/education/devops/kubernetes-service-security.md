---
title: "Kubernetes 서비스와 보안"
description: "쿠버네티스의 서비스 유형과 RBAC 기반 보안 설정을 상세히 알아본다"
summary: "ClusterIP, NodePort, LoadBalancer, Ingress, RBAC, ServiceAccount"
date: 2025-01-06
weight: 6
draft: false
toc: true
---

## 서비스(Service)의 필요성

### 파드의 동적 IP 문제

쿠버네티스에서 파드는 **휘발성**이며, 언제든지 다른 노드로 이동하거나 재생성될 수 있다. 이때 파드의 IP가 변경되면 외부에서 접근하기 어렵다.

```
문제 상황:
┌──────────────────┐     ┌──────────────────┐
│     Node 1       │     │     Node 2       │
│  ┌────────────┐  │     │  ┌────────────┐  │
│  │   Pod A    │  │     │  │   Pod A    │  │
│  │ IP: 10.1.1.5│ │ ──▶ │  │ IP: 10.2.1.8│ │  ← IP 변경!
│  └────────────┘  │     │  └────────────┘  │
└──────────────────┘     └──────────────────┘
         │
    클라이언트: 어디로 접속해야 하지?
```

### 서비스로 해결

**서비스(Service)**는 파드에 **고정된 접점**을 제공한다. 파드의 IP가 변경되더라도 서비스를 통해 안정적으로 접근할 수 있다.

```
서비스를 통한 접근:
                    ┌──────────────────────────────────────────┐
                    │              Service                     │
                    │         (고정 IP: 10.96.0.100)            │
                    └────────────────┬─────────────────────────┘
                                     │ 셀렉터로 파드 선택
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
       ┌────────────┐         ┌────────────┐         ┌────────────┐
       │   Pod A    │         │   Pod B    │         │   Pod C    │
       │ app: nginx │         │ app: nginx │         │ app: nginx │
       └────────────┘         └────────────┘         └────────────┘

클라이언트 → Service IP → 파드들로 로드밸런싱
```

---

## 서비스 유형 개요

| 유형 | 용도 | 접근 범위 |
|------|------|----------|
| **ClusterIP** | 클러스터 내부 통신 | 클러스터 내부만 |
| **NodePort** | 외부에서 노드 포트로 접근 | 외부 → 내부 |
| **LoadBalancer** | 외부 로드밸런서 사용 | 외부 → 내부 |
| **ExternalName** | 외부 도메인으로 리다이렉트 | 내부 → 외부 |
| **Ingress** | HTTP/HTTPS 라우팅 | 외부 → 내부 |

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           외부 (인터넷)                                   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
   ┌─────────┐            ┌─────────┐            ┌─────────────┐
   │NodePort │            │ LoadBal │            │   Ingress   │
   │:30080   │            │  ancer  │            │  Controller │
   └────┬────┘            └────┬────┘            └──────┬──────┘
        │                      │                        │
        └──────────────────────┼────────────────────────┘
                               │
                        ┌──────▼──────┐
                        │  ClusterIP  │
                        │  (Service)  │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         ┌────────┐       ┌────────┐       ┌────────┐
         │  Pod   │       │  Pod   │       │  Pod   │
         └────────┘       └────────┘       └────────┘
```

---

## ClusterIP

### 개념

**ClusterIP**는 기본 서비스 타입으로, 클러스터 **내부에서만** 접근 가능한 가상 IP를 제공한다.

```yaml
# ClusterIP 서비스 (기본값)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: ClusterIP    # 생략해도 기본값
  selector:
    app: nginx       # 이 레이블을 가진 파드로 트래픽 전달
  ports:
  - protocol: TCP
    port: 80         # 서비스 포트
    targetPort: 80   # 파드 포트
```

### 완전한 예제: Nginx 배포

```yaml
# 1. Deployment 생성
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
---
# 2. ClusterIP Service 생성
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
```

### 서비스 생성 방법

**방법 1: 매니페스트 파일**
```bash
kubectl apply -f service.yaml
```

**방법 2: kubectl expose 명령어**
```bash
# Deployment를 서비스로 노출
kubectl expose deployment nginx-deployment \
  --name=nginx-service \
  --port=80 \
  --target-port=80 \
  --type=ClusterIP
```

### 서비스와 엔드포인트

서비스는 **셀렉터(Selector)**와 파드의 **레이블(Labels)**을 매칭하여 트래픽을 전달한다.

```yaml
# Service의 셀렉터
spec:
  selector:
    app: nginx    # ← 이 레이블을 가진 파드 선택

# Pod의 레이블
metadata:
  labels:
    app: nginx    # ← 매칭!
```

```bash
# 엔드포인트 확인
kubectl get endpoints nginx-service

# 출력 예시
NAME            ENDPOINTS                                      AGE
nginx-service   10.244.1.5:80,10.244.2.8:80,10.244.3.12:80   5m
```

### Headless Service

**ClusterIP: None**으로 설정하면 ClusterIP 없이 서비스가 생성된다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: headless-service
spec:
  clusterIP: None    # Headless Service
  selector:
    app: mysql
  ports:
  - port: 3306
```

**Headless Service 사용 사례**:
- StatefulSet과 함께 사용 (각 파드에 고유한 DNS 이름 부여)
- 클라이언트가 직접 파드 선택 필요
- 로드밸런싱 불필요

```bash
# Headless Service DNS 조회 시 모든 파드 IP 반환
nslookup headless-service.default.svc.cluster.local

# 일반 Service DNS 조회 시 ClusterIP 반환
nslookup nginx-service.default.svc.cluster.local
```

---

## ExternalName

### 개념

**ExternalName**은 클러스터 **내부에서 외부**로 접근할 때 사용한다. DNS CNAME 레코드를 생성하여 외부 도메인으로 리다이렉트한다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          클러스터 내부                                   │
│                                                                          │
│   ┌─────────┐     external-service     ┌─────────────────────────────┐  │
│   │   Pod   │ ─────────────────────────▶│  외부: api.external.com    │  │
│   └─────────┘     (CNAME 리다이렉트)     └─────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 예제

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
# 파드 내에서 접근
curl http://external-db    # → database.external-provider.com으로 리다이렉트
```

**ExternalName 사용 사례**:
- 외부 데이터베이스 연결
- 외부 API 서비스 호출
- 마이그레이션 시 외부 리소스 참조

---

## NodePort

### 개념

**NodePort**는 모든 워커 노드에 특정 포트를 열어 외부에서 접근 가능하게 한다.

```
외부 사용자 요청:
                    ┌─────────────────────────────────────────────────┐
                    │                  클러스터                        │
                    │                                                  │
  http://node-ip    │  ┌─────────────┐      ┌─────────────┐          │
  :30080            │  │   Node 1    │      │   Node 2    │          │
        │           │  │  :30080     │      │  :30080     │          │
        ▼           │  └──────┬──────┘      └──────┬──────┘          │
  ┌───────────┐     │         │                    │                 │
  │ Any Node  │────▶│         └────────┬───────────┘                 │
  │  :30080   │     │                  ▼                             │
  └───────────┘     │         ┌───────────────┐                      │
                    │         │    Service    │                      │
                    │         │  (NodePort)   │                      │
                    │         └───────┬───────┘                      │
                    │                 │                              │
                    │    ┌────────────┼────────────┐                 │
                    │    ▼            ▼            ▼                 │
                    │ ┌──────┐    ┌──────┐    ┌──────┐              │
                    │ │ Pod  │    │ Pod  │    │ Pod  │              │
                    │ └──────┘    └──────┘    └──────┘              │
                    └─────────────────────────────────────────────────┘
```

### 예제

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
    port: 80          # 서비스 포트 (ClusterIP에서 사용)
    targetPort: 80    # 파드 포트
    nodePort: 30080   # 노드 포트 (30000-32767)
```

```bash
# 서비스 생성
kubectl apply -f nodeport-service.yaml

# 노드 IP 확인
kubectl get nodes -o wide

# 접속 테스트
curl http://<NODE_IP>:30080
```

### NodePort 제약사항

| 제약 | 설명 |
|------|------|
| **포트 범위** | 30000 ~ 32767만 사용 가능 |
| **포트당 하나의 서비스** | 동일 포트에 여러 서비스 불가 |
| **노드 IP 의존** | 노드 IP 변경 시 클라이언트 설정 변경 필요 |
| **보안** | 모든 노드에 포트가 열림 |

### kubectl expose로 NodePort 생성

```bash
kubectl expose deployment nginx-deployment \
  --name=nginx-nodeport \
  --port=80 \
  --target-port=80 \
  --type=NodePort
```

---

## LoadBalancer

### 개념

**LoadBalancer**는 클라우드 프로바이더의 로드밸런서를 사용하여 외부 IP를 할당받는다.

```
                    ┌─────────────────────────────────────────────────┐
                    │              클라우드 로드밸런서                  │
                    │            (External IP: 203.0.113.10)          │
                    └───────────────────────┬─────────────────────────┘
                                            │
                    ┌───────────────────────▼─────────────────────────┐
                    │                   클러스터                       │
                    │                                                  │
                    │   ┌────────────────────────────────────────┐    │
                    │   │         LoadBalancer Service           │    │
                    │   │         (NodePort 자동 생성)            │    │
                    │   └────────────────────┬───────────────────┘    │
                    │                        │                        │
                    │         ┌──────────────┼──────────────┐         │
                    │         ▼              ▼              ▼         │
                    │    ┌────────┐     ┌────────┐     ┌────────┐    │
                    │    │  Pod   │     │  Pod   │     │  Pod   │    │
                    │    └────────┘     └────────┘     └────────┘    │
                    └─────────────────────────────────────────────────┘
```

### 예제

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
# 서비스 생성
kubectl apply -f loadbalancer-service.yaml

# External IP 확인 (클라우드 환경)
kubectl get svc loadbalancer-service

# 출력 예시
NAME                   TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)
loadbalancer-service   LoadBalancer   10.96.45.123    203.0.113.10    80:31234/TCP
```

### L4 vs L7 로드밸런서

| 구분 | L4 로드밸런서 | L7 로드밸런서 |
|------|-------------|-------------|
| **OSI 계층** | 전송 계층 (TCP/UDP) | 애플리케이션 계층 (HTTP/HTTPS) |
| **분산 기준** | IP, 포트 | URL, 헤더, 쿠키 |
| **쿠버네티스** | LoadBalancer Service | Ingress |
| **사용 사례** | 일반 TCP 트래픽 | 웹 애플리케이션 라우팅 |

### 온프레미스에서 External IP 사용

온프레미스 환경에서는 `externalIPs`를 직접 지정할 수 있다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-ip-service
spec:
  type: ClusterIP
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
  externalIPs:
    - 192.168.1.100    # 외부에서 접근 가능한 IP
```

### MetalLB (온프레미스 로드밸런서)

온프레미스 환경에서 LoadBalancer 타입을 사용하려면 **MetalLB**를 설치한다.

```yaml
# MetalLB 설정 예제
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.250    # 할당할 IP 범위
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

---

## Ingress

### 개념

**Ingress**는 HTTP/HTTPS 트래픽을 **URL 경로** 기반으로 라우팅하는 규칙 모음이다. 실제 라우팅은 **Ingress Controller**가 수행한다.

```
                             ┌───────────────────────────────────────────┐
                             │              Ingress Controller           │
                             │           (nginx, traefik, etc.)          │
                             └─────────────────────┬─────────────────────┘
                                                   │
              ┌────────────────────────────────────┼────────────────────────────────────┐
              │                                    │                                    │
    /api/*    │                          /web/*   │                         /admin/*  │
              ▼                                    ▼                                    ▼
       ┌─────────────┐                      ┌─────────────┐                      ┌─────────────┐
       │ api-service │                      │ web-service │                      │admin-service│
       └──────┬──────┘                      └──────┬──────┘                      └──────┬──────┘
              │                                    │                                    │
         ┌────┴────┐                          ┌────┴────┐                          ┌────┴────┐
         ▼         ▼                          ▼         ▼                          ▼         ▼
      ┌─────┐  ┌─────┐                     ┌─────┐  ┌─────┐                     ┌─────┐  ┌─────┐
      │ Pod │  │ Pod │                     │ Pod │  │ Pod │                     │ Pod │  │ Pod │
      └─────┘  └─────┘                     └─────┘  └─────┘                     └─────┘  └─────┘
```

### Ingress Controller 설치

```bash
# Nginx Ingress Controller 설치 (Helm)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx

# 또는 kubectl로 직접 설치
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.0/deploy/static/provider/cloud/deploy.yaml
```

### Ingress 리소스 예제

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  # 호스트 기반 라우팅
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

### 경로 기반 라우팅

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      # /api/* → api-service
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80

      # /web/* → web-service
      - path: /web
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80

      # / → frontend-service (기본)
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### TLS/HTTPS 설정

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
    secretName: tls-secret    # TLS 인증서가 저장된 Secret
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
---
# TLS Secret 생성
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
```

```bash
# TLS Secret 생성 명령어
kubectl create secret tls tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

---

## 명령형 vs 선언형

### 비교

| 구분 | 명령형 (Imperative) | 선언형 (Declarative) |
|------|---------------------|----------------------|
| **방식** | 어떻게 할지 지시 | 원하는 결과만 명시 |
| **명령어** | `kubectl create`, `kubectl replace` | `kubectl apply` |
| **히스토리** | 파일 기반 추적 | 애노테이션에 자동 저장 |
| **사용 환경** | 개발/테스트 | **프로덕션 권장** |

```bash
# 명령형
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80 --type=NodePort

# 선언형
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 애노테이션 (Annotation)

애노테이션은 오브젝트에 메타데이터를 추가하는 키-값 쌍이다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  annotations:
    # 빌드 정보
    build.version: "1.2.3"
    build.commit: "abc123"

    # 관리 정보
    owner: "team-platform"
    contact: "platform@example.com"

    # Ingress 설정
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  # ...
```

**레이블 vs 애노테이션**:

| 구분 | 레이블 (Labels) | 애노테이션 (Annotations) |
|------|----------------|-------------------------|
| **용도** | 선택/식별 | 메타데이터 저장 |
| **검색** | 가능 (셀렉터) | 불가능 |
| **사용 예** | 서비스 셀렉터 | 빌드 정보, 설정 |

---

## 쿠버네티스 보안

### 보안 권고사항 (NSA/CISA)

| 영역 | 권고 사항 |
|------|----------|
| **컨테이너/파드** | 취약점 스캔, 최소 권한 실행 |
| **네트워크** | 네트워크 분리, 방화벽 설정 |
| **접근 제어** | 강력한 인증/권한 부여 (RBAC) |
| **모니터링** | 로그 검사, 활동 모니터링 |
| **유지보수** | 정기적 설정 검토, 보안 패치 적용 |

---

## RBAC (Role-Based Access Control)

### 개념

**RBAC**은 역할 기반으로 쿠버네티스 리소스에 대한 접근 권한을 관리한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RBAC 구조                                       │
│                                                                              │
│   ┌────────────┐                                    ┌────────────────────┐  │
│   │   User     │                                    │       Role         │  │
│   │  (사용자)   │                                    │   (권한 정의)       │  │
│   └─────┬──────┘                                    └──────────┬─────────┘  │
│         │                                                      │            │
│         │         ┌────────────────────────┐                  │            │
│         └────────▶│     RoleBinding        │◀─────────────────┘            │
│                   │  (사용자 + 역할 연결)    │                               │
│                   └────────────────────────┘                               │
│                              │                                              │
│                              ▼                                              │
│                   ┌────────────────────────┐                               │
│                   │      Resources         │                               │
│                   │  (pods, services, etc.)│                               │
│                   └────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Role vs ClusterRole

| 구분 | Role | ClusterRole |
|------|------|-------------|
| **범위** | 특정 네임스페이스 | 클러스터 전체 |
| **바인딩** | RoleBinding | ClusterRoleBinding |
| **사용 사례** | 네임스페이스별 권한 | 클러스터 전역 권한 |

### Role 정의

```yaml
# 네임스페이스 범위의 Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development    # 이 네임스페이스에만 적용
  name: pod-reader
rules:
- apiGroups: [""]           # "" = core API group
  resources: ["pods"]       # 접근 가능한 리소스
  verbs: ["get", "list", "watch"]    # 허용되는 동작
```

### ClusterRole 정의

```yaml
# 클러스터 전체에 적용되는 ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]

- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "delete"]
```

### 동작(Verbs) 종류

| Verb | 설명 |
|------|------|
| `get` | 단일 리소스 조회 |
| `list` | 리소스 목록 조회 |
| `watch` | 리소스 변경 감시 |
| `create` | 리소스 생성 |
| `update` | 리소스 수정 |
| `patch` | 리소스 부분 수정 |
| `delete` | 리소스 삭제 |
| `deletecollection` | 리소스 일괄 삭제 |

### RoleBinding / ClusterRoleBinding

```yaml
# RoleBinding: 특정 네임스페이스에서 Role 연결
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: development
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: my-service-account
  namespace: development
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
---
# ClusterRoleBinding: 클러스터 전체에서 ClusterRole 연결
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-nodes-global
subjects:
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## ServiceAccount

### 개념

**ServiceAccount**는 파드가 쿠버네티스 API에 접근할 때 사용하는 계정이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ServiceAccount 동작                                 │
│                                                                              │
│   ┌─────────────┐                           ┌─────────────────────────────┐ │
│   │     Pod     │                           │    Kubernetes API Server    │ │
│   │             │        API 호출           │                             │ │
│   │  (SA 토큰   │  ────────────────────────▶│  토큰 검증                   │ │
│   │   마운트됨)  │                           │       ↓                     │ │
│   │             │                           │  RBAC 권한 확인              │ │
│   └─────────────┘                           │       ↓                     │ │
│         │                                   │  요청 처리                   │ │
│         │                                   └─────────────────────────────┘ │
│         ▼                                                                    │
│   /var/run/secrets/kubernetes.io/serviceaccount/                            │
│   ├── token        (API 인증 토큰)                                          │
│   ├── ca.crt       (클러스터 CA 인증서)                                      │
│   └── namespace    (파드의 네임스페이스)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ServiceAccount 생성

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-service-account
  namespace: default
```

### Pod에서 ServiceAccount 사용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  serviceAccountName: my-service-account    # ServiceAccount 지정
  containers:
  - name: my-container
    image: my-image
```

### 완전한 예제: 파드 리더 권한

```yaml
# 1. ServiceAccount 생성
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-reader-sa
  namespace: development
---
# 2. Role 생성
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader-role
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
# 3. RoleBinding 생성
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: development
subjects:
- kind: ServiceAccount
  name: pod-reader-sa
  namespace: development
roleRef:
  kind: Role
  name: pod-reader-role
  apiGroup: rbac.authorization.k8s.io
---
# 4. Pod에서 ServiceAccount 사용
apiVersion: v1
kind: Pod
metadata:
  name: pod-reader-pod
  namespace: development
spec:
  serviceAccountName: pod-reader-sa
  containers:
  - name: kubectl-container
    image: bitnami/kubectl
    command: ["sleep", "infinity"]
```

```bash
# 파드 내에서 API 호출 테스트
kubectl exec -it pod-reader-pod -n development -- /bin/sh
$ kubectl get pods    # 성공!
$ kubectl get nodes   # 실패 (권한 없음)
```

---

## 네임스페이스 (Namespace)

### 개념

**네임스페이스**는 클러스터 내의 **논리적 분리 단위**이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Kubernetes Cluster                                │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │   NS: default     │  │ NS: development   │  │  NS: production   │       │
│  │                   │  │                   │  │                   │       │
│  │  ┌─────┐ ┌─────┐ │  │  ┌─────┐ ┌─────┐ │  │  ┌─────┐ ┌─────┐ │       │
│  │  │Pod A│ │Pod B│ │  │  │Pod C│ │Pod D│ │  │  │Pod E│ │Pod F│ │       │
│  │  └─────┘ └─────┘ │  │  └─────┘ └─────┘ │  │  └─────┘ └─────┘ │       │
│  │                   │  │                   │  │                   │       │
│  │  CPU: 2코어       │  │  CPU: 4코어       │  │  CPU: 8코어       │       │
│  │  Memory: 2Gi     │  │  Memory: 4Gi     │  │  Memory: 16Gi    │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 네임스페이스 관리

```bash
# 네임스페이스 목록
kubectl get namespaces

# 네임스페이스 생성
kubectl create namespace development

# 네임스페이스에서 리소스 조회
kubectl get pods -n development

# 모든 네임스페이스의 리소스 조회
kubectl get pods --all-namespaces
```

```yaml
# YAML로 네임스페이스 생성
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    env: dev
```

### 리소스 쿼터

```yaml
# 네임스페이스별 리소스 제한
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: development
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "10"
```

---

## kubectl 명령어 정리

### 서비스 관련

```bash
# 서비스 목록
kubectl get svc

# 서비스 상세 정보
kubectl describe svc <service-name>

# 서비스 생성
kubectl expose deployment <deployment-name> --port=80 --type=NodePort

# 서비스 삭제
kubectl delete svc <service-name>

# 엔드포인트 확인
kubectl get endpoints <service-name>
```

### RBAC 관련

```bash
# ServiceAccount 목록
kubectl get serviceaccount

# Role/ClusterRole 목록
kubectl get roles
kubectl get clusterroles

# RoleBinding/ClusterRoleBinding 목록
kubectl get rolebindings
kubectl get clusterrolebindings

# 권한 확인
kubectl auth can-i get pods --as=system:serviceaccount:default:my-sa
kubectl auth can-i create deployments --as=jane
```

### 디버깅

```bash
# 서비스 접속 테스트 (파드 내에서)
kubectl run curl --image=curlimages/curl -it --rm -- curl http://my-service

# 서비스 DNS 확인
kubectl run busybox --image=busybox -it --rm -- nslookup my-service

# Ingress 상태 확인
kubectl describe ingress <ingress-name>

# Ingress Controller 로그
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

---

## 정리

### 서비스 유형 선택 가이드

| 상황 | 권장 서비스 유형 |
|------|-----------------|
| 클러스터 내부 통신 | ClusterIP |
| 외부에서 직접 접근 (개발) | NodePort |
| 외부에서 접근 (프로덕션) | LoadBalancer |
| HTTP/HTTPS URL 라우팅 | Ingress |
| 외부 서비스 참조 | ExternalName |

### RBAC 핵심 개념

| 개념 | 설명 |
|------|------|
| **Role** | 네임스페이스 내 권한 정의 |
| **ClusterRole** | 클러스터 전체 권한 정의 |
| **RoleBinding** | 사용자/SA에 Role 연결 |
| **ClusterRoleBinding** | 사용자/SA에 ClusterRole 연결 |
| **ServiceAccount** | 파드의 API 접근 계정 |

### 보안 체크리스트

- [ ] RBAC으로 최소 권한 원칙 적용
- [ ] 네임스페이스로 리소스 분리
- [ ] ServiceAccount별 적절한 권한 부여
- [ ] Ingress에 TLS/HTTPS 적용
- [ ] 네트워크 정책으로 파드 간 통신 제한

---

## 참고 자료

- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [NSA/CISA Kubernetes Hardening Guide](https://www.nsa.gov/Press-Room/News-Highlights/Article/Article/2716980/nsa-cisa-release-kubernetes-hardening-guidance/)
- 쉽게 시작하는 쿠버네티스 (조훈, 심근우)
