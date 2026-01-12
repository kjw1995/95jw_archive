---
title: "Security"
weight: 6
---

클러스터 보안의 인증, 인가, TLS, 네트워크 정책 및 보안 컨텍스트를 다룹니다.

---

## 1. 보안 기본 요소

### 보안 계층 구조

```
┌─────────────────────────────────────────────────────┐
│              호스트 수준 보안                         │
│  - SSH 키 기반 인증만 허용                           │
│  - 루트 접근 비활성화                                │
│  - 패스워드 인증 비활성화                            │
├─────────────────────────────────────────────────────┤
│              API Server 보안                         │
│  ┌─────────────────┬─────────────────────────────┐ │
│  │   인증 (Who?)   │      인가 (What?)           │ │
│  │  Authentication │     Authorization           │ │
│  └─────────────────┴─────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│              TLS 전송 암호화                         │
│  - 모든 컴포넌트 간 통신 암호화                      │
├─────────────────────────────────────────────────────┤
│              네트워크 정책                           │
│  - Pod 간 트래픽 제어                               │
└─────────────────────────────────────────────────────┘
```

### 핵심 보안 질문

1. **누가 접근할 수 있는가?** → 인증 (Authentication)
2. **무엇을 할 수 있는가?** → 인가 (Authorization)

---

## 2. 인증 (Authentication)

### 사용자 유형

| 유형 | 설명 | 관리 방식 |
|:-----|:-----|:----------|
| **User Account** | 관리자, 개발자 | 외부 소스 (인증서, LDAP 등) |
| **Service Account** | 애플리케이션, 봇 | Kubernetes API |

### 인증 메커니즘

```
┌─────────────────────────────────────────────────────┐
│                   kube-apiserver                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ 1. Static Password File   (비권장, 학습용)      ││
│  │ 2. Static Token File      (비권장, 학습용)      ││
│  │ 3. Certificates           (권장)                ││
│  │ 4. External Auth (LDAP, OIDC 등)               ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 인증서 기반 인증 (권장)

```bash
# API 호출 시 인증서 사용
curl https://kube-apiserver:6443/api/v1/pods \
  --key admin.key \
  --cert admin.crt \
  --cacert ca.crt
```

---

## 3. TLS 인증서 기초

### 암호화 방식

| 방식 | 특징 | 용도 |
|:-----|:-----|:-----|
| **대칭 암호화** | 같은 키로 암호화/복호화 | 데이터 전송 (빠름) |
| **비대칭 암호화** | 공개키/개인키 쌍 사용 | 키 교환, 인증 |

### 비대칭 암호화 원리

```
┌───────────┐                    ┌───────────┐
│  Client   │                    │  Server   │
├───────────┤                    ├───────────┤
│           │  ← 공개키 전송 ←   │ 공개키    │
│           │                    │ 개인키    │
│           │                    │           │
│  대칭키   │  → 공개키로 암호화 →│           │
│ (생성)    │                    │           │
│           │                    │ 개인키로  │
│           │                    │ 복호화    │
│           │  ← 대칭키 통신 →   │           │
└───────────┘                    └───────────┘
```

### 파일 명명 규칙

```
공개키/인증서:              개인키:
- server.crt               - server.key
- server.pem               - server-key.pem
- client.crt               - client.key

기억법: 'key' 포함 = 개인키
```

---

## 4. Kubernetes TLS 인증서

### 컴포넌트별 인증서

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Plane                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  kube-apiserver │  │      etcd       │                   │
│  │ ─────────────── │  │ ─────────────── │                   │
│  │ 서버: apiserver │  │ 서버: etcdserver│                   │
│  │ 클라이언트:     │  │                 │                   │
│  │  - etcd 접근용  │  └─────────────────┘                   │
│  │  - kubelet 접근용│                                        │
│  └─────────────────┘                                         │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │    scheduler    │  │ controller-mgr  │                   │
│  │ 클라이언트만    │  │ 클라이언트만    │                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│                    Worker Node                               │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │     kubelet     │  │   kube-proxy    │                   │
│  │ 서버+클라이언트 │  │ 클라이언트만    │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 인증서 생성 (OpenSSL)

#### CA 인증서 생성

```bash
# 1. CA 개인키 생성
openssl genrsa -out ca.key 2048

# 2. CA CSR 생성
openssl req -new -key ca.key -subj "/CN=KUBERNETES-CA" -out ca.csr

# 3. 자체 서명 인증서 생성
openssl x509 -req -in ca.csr -signkey ca.key -out ca.crt -days 1000
```

#### 클라이언트 인증서 생성 (Admin)

```bash
# 1. 개인키 생성
openssl genrsa -out admin.key 2048

# 2. CSR 생성 (그룹 포함)
openssl req -new -key admin.key \
  -subj "/CN=kube-admin/O=system:masters" -out admin.csr

# 3. CA로 서명
openssl x509 -req -in admin.csr -CA ca.crt -CAkey ca.key \
  -out admin.crt -days 1000
```

#### API Server 인증서 (SAN 포함)

```ini
# openssl.cnf
[req]
req_extensions = v3_req
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster.local
IP.1 = 10.96.0.1
IP.2 = 172.17.0.87
```

```bash
openssl req -new -key apiserver.key -subj "/CN=kube-apiserver" \
  -out apiserver.csr -config openssl.cnf
```

### 인증서 정보 확인

```bash
# 인증서 상세 정보
openssl x509 -in /path/to/cert.crt -text -noout

# 확인할 항목:
# - Subject (주체)
# - Subject Alternative Names (SAN)
# - Issuer (발급자)
# - Validity (유효기간)
```

---

## 5. Certificates API

### CSR 승인 프로세스

```
사용자                관리자              Kubernetes API
  │                     │                      │
  ├─ 개인키, CSR 생성   │                      │
  ├─ CSR 전송 ─────────▶│                      │
  │                     ├─ CSR 객체 생성 ─────▶│
  │                     ├─ 승인 ───────────────▶│
  │                     │                      ├─ 서명
  │◀─ 인증서 전달 ──────┤◀─ 인증서 추출 ───────┤
```

### CSR 객체 생성

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <Base64-encoded-CSR>
  signerName: kubernetes.io/kube-apiserver-client
  usages:
  - client auth
```

```bash
# CSR Base64 인코딩
cat jane.csr | base64 | tr -d "\n"

# CSR 승인
kubectl certificate approve jane

# 인증서 추출
kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt
```

---

## 6. KubeConfig

### 구조

```yaml
apiVersion: v1
kind: Config
current-context: dev-user@development

clusters:           # 접근할 클러스터 목록
- name: development
  cluster:
    server: https://dev-cluster:6443
    certificate-authority: /path/to/ca.crt

users:              # 사용자 인증 정보
- name: dev-user
  user:
    client-certificate: /path/to/dev.crt
    client-key: /path/to/dev.key

contexts:           # 클러스터 + 사용자 조합
- name: dev-user@development
  context:
    cluster: development
    user: dev-user
    namespace: default
```

### 컨텍스트 관리

```bash
# 현재 설정 확인
kubectl config view

# 컨텍스트 전환
kubectl config use-context prod-user@production

# 컨텍스트 목록
kubectl config get-contexts

# 현재 컨텍스트 확인
kubectl config current-context
```

---

## 7. API 그룹

### API 구조

```
Kubernetes API
├── /version                  # 버전 정보
├── /healthz                  # 헬스체크
├── /api/v1                   # Core API Group
│   ├── namespaces
│   ├── pods
│   ├── services
│   ├── configmaps
│   └── secrets
└── /apis                     # Named API Groups
    ├── apps/v1
    │   ├── deployments
    │   └── replicasets
    ├── networking.k8s.io/v1
    │   └── networkpolicies
    └── rbac.authorization.k8s.io/v1
        ├── roles
        └── rolebindings
```

### kubectl proxy

```bash
# 프록시 시작 (인증 자동 처리)
kubectl proxy --port=8001

# 프록시를 통한 API 접근
curl http://localhost:8001/api/v1/pods
```

---

## 8. 인가 (Authorization)

### 인가 모드

| 모드 | 설명 |
|:-----|:-----|
| **Node** | kubelet의 API 서버 접근 관리 |
| **ABAC** | 속성 기반 접근 제어 (비권장) |
| **RBAC** | 역할 기반 접근 제어 (권장) |
| **Webhook** | 외부 서비스로 인가 위임 |
| **AlwaysAllow** | 모든 요청 허용 (기본값) |
| **AlwaysDeny** | 모든 요청 거부 |

### 인가 체인

```bash
# API 서버 설정
kube-apiserver --authorization-mode=Node,RBAC,Webhook
```

```
요청 → Node Authorizer → RBAC → Webhook
       ↓ (거부)          ↓ (거부)   ↓
     다음으로 전달      다음으로    최종 결정
```

- 하나라도 **승인**하면 → 접근 허용
- 모두 **거부**하면 → 접근 차단

---

## 9. RBAC (Role-Based Access Control)

### 구성 요소

```
사용자/그룹 ──▶ RoleBinding ──▶ Role ──▶ 권한(Permissions)
                                         - resources
                                         - verbs
```

### Role 생성

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: default
rules:
- apiGroups: [""]           # Core API (빈 문자열)
  resources: ["pods"]
  verbs: ["get", "list", "create", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

### RoleBinding 생성

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-user-binding
  namespace: default
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

### 권한 확인

```bash
# 자신의 권한 확인
kubectl auth can-i create pods
kubectl auth can-i delete nodes

# 다른 사용자 권한 확인 (관리자)
kubectl auth can-i create pods --as dev-user
kubectl auth can-i create pods --as dev-user --namespace test
```

### 특정 리소스만 허용

```yaml
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
  resourceNames: ["blue-pod", "green-pod"]  # 특정 Pod만
```

---

## 10. ClusterRole과 ClusterRoleBinding

### Role vs ClusterRole

| 구분 | Role | ClusterRole |
|:-----|:-----|:------------|
| 범위 | 네임스페이스 | 클러스터 전체 |
| 대상 | pods, services 등 | nodes, PV, namespaces 등 |

### 클러스터 범위 리소스 확인

```bash
# 네임스페이스 범위 리소스
kubectl api-resources --namespaced=true

# 클러스터 범위 리소스
kubectl api-resources --namespaced=false
```

### ClusterRole 예시

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-admin-role
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "create", "delete"]
- apiGroups: [""]
  resources: ["persistentvolumes"]
  verbs: ["get", "list", "create", "delete"]
```

### 모든 네임스페이스 Pod 접근

```yaml
# ClusterRole로 모든 네임스페이스의 Pod 접근
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader-all
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-pods-global
subjects:
- kind: User
  name: monitor-user
roleRef:
  kind: ClusterRole
  name: pod-reader-all
```

---

## 11. Service Accounts

### User Account vs Service Account

| 구분 | User Account | Service Account |
|:-----|:-------------|:----------------|
| 사용자 | 사람 | 애플리케이션 |
| 관리 | 외부 소스 | Kubernetes API |
| 생성 | 불가능 | `kubectl create sa` |

### Service Account 생성 및 사용

```bash
# Service Account 생성
kubectl create serviceaccount dashboard-sa

# 토큰 생성 (v1.24+)
kubectl create token dashboard-sa

# 만료 시간 지정
kubectl create token dashboard-sa --duration=24h
```

### Pod에서 Service Account 사용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  serviceAccountName: dashboard-sa  # Service Account 지정
  containers:
  - name: app
    image: my-app
```

### 토큰 자동 마운트

```
마운트 경로: /var/run/secrets/kubernetes.io/serviceaccount/
├── ca.crt
├── namespace
└── token
```

### 자동 마운트 비활성화

```yaml
spec:
  automountServiceAccountToken: false
```

---

## 12. 이미지 보안

### 이미지 명명 규칙

```
전체 형식: [REGISTRY]/[USER]/[IMAGE]:[TAG]

예시:
nginx                    → docker.io/library/nginx:latest
mycompany/app:v1.0       → docker.io/mycompany/app:v1.0
gcr.io/project/app:v1.0  → gcr.io/project/app:v1.0
```

### ImagePullSecrets 설정

```bash
# Docker Registry Secret 생성
kubectl create secret docker-registry regcred \
  --docker-server=myregistry.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=user@example.com
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-app
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: myregistry.com/mycompany/app:v1.0
```

---

## 13. Security Context

### 적용 레벨

```
Pod 레벨: 모든 컨테이너에 적용
Container 레벨: 특정 컨테이너에만 적용 (우선순위 높음)
```

### Pod 레벨 설정

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: app
    image: nginx
```

### Container 레벨 설정

```yaml
spec:
  containers:
  - name: app
    image: nginx
    securityContext:
      runAsUser: 2000
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
```

### Linux Capabilities

```yaml
securityContext:
  capabilities:
    add:
    - NET_BIND_SERVICE   # 1024 미만 포트 바인딩
    - SYS_TIME           # 시스템 시간 변경
    drop:
    - ALL                # 모든 권한 제거
```

---

## 14. Network Policies

### 기본 동작

```
Kubernetes 기본: 모든 Pod가 모든 Pod와 통신 가능
Network Policy 적용 시: 명시된 트래픽만 허용
```

### 트래픽 방향

```
웹서버 ──▶ API서버 ──▶ DB서버
        Egress    Egress
        ◀──       ◀──
       Ingress   Ingress
```

### Network Policy 기본 구조

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:           # 정책 적용 대상 Pod
    matchLabels:
      role: db
  policyTypes:
  - Ingress              # Ingress 규칙 적용
  - Egress               # Egress 규칙 적용
  ingress:
  - from:
    - podSelector:       # 허용할 소스 Pod
        matchLabels:
          role: api
    ports:
    - protocol: TCP
      port: 3306
```

### Selector 유형

#### podSelector (Pod 선택)

```yaml
- podSelector:
    matchLabels:
      app: api-server
```

#### namespaceSelector (네임스페이스 선택)

```yaml
- namespaceSelector:
    matchLabels:
      environment: production
```

#### ipBlock (IP 범위)

```yaml
- ipBlock:
    cidr: 10.0.0.0/8
    except:
    - 10.0.1.0/24
```

### 규칙 조합 (AND vs OR)

```yaml
# AND 조합 (같은 항목 내)
ingress:
- from:
  - podSelector:
      matchLabels:
        app: api
    namespaceSelector:      # AND: api Pod AND prod 네임스페이스
      matchLabels:
        name: prod

# OR 조합 (별도 항목)
ingress:
- from:
  - podSelector:            # 규칙 1
      matchLabels:
        app: api
  - ipBlock:                # OR: 규칙 2
      cidr: 192.168.5.10/32
```

### 모든 트래픽 차단

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}     # 모든 Pod
  policyTypes:
  - Ingress
  - Egress
  # 규칙 없음 = 모든 트래픽 차단
```

### CNI 지원 여부

| CNI | Network Policy 지원 |
|:----|:--------------------|
| Calico | O |
| Cilium | O |
| Weave Net | O |
| Flannel | X |

---

## 15. CRD (Custom Resource Definition)

### CRD 개념

```
CRD: 새로운 리소스 타입을 Kubernetes에 정의
Custom Resource: CRD로 정의된 리소스의 인스턴스
Custom Controller: Custom Resource의 비즈니스 로직 처리
```

### CRD 생성

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: flighttickets.flights.com
spec:
  scope: Namespaced
  group: flights.com
  names:
    kind: FlightTicket
    singular: flightticket
    plural: flighttickets
    shortNames:
    - ft
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              from:
                type: string
              to:
                type: string
              number:
                type: integer
                minimum: 1
                maximum: 10
```

### Custom Resource 사용

```yaml
apiVersion: flights.com/v1
kind: FlightTicket
metadata:
  name: my-ticket
spec:
  from: Seoul
  to: Tokyo
  number: 2
```

```bash
kubectl get flighttickets
kubectl get ft  # 축약형
```

---

## 16. Operator Framework

### Operator 구성

```
Operator = CRD + Custom Controller + 운영 지식

배포 시 자동 생성:
- CRD 정의
- Controller Deployment
- RBAC 권한
- 부가 리소스 (ConfigMap, Secret 등)
```

### OperatorHub 활용

```bash
# OLM 설치
curl -sL https://github.com/operator-framework/operator-lifecycle-manager/releases/download/v0.22.0/install.sh | bash -s v0.22.0

# Operator 설치
kubectl apply -f https://operatorhub.io/install/prometheus.yaml

# Custom Resource로 배포
kubectl apply -f prometheus-instance.yaml
```

---

## 17. 명령어 요약

```bash
# 인증서
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out cert.csr
openssl x509 -req -in cert.csr -CA ca.crt -CAkey ca.key -out cert.crt
openssl x509 -in cert.crt -text -noout

# CSR
kubectl certificate approve <csr-name>
kubectl certificate deny <csr-name>
kubectl get csr

# KubeConfig
kubectl config view
kubectl config use-context <context>
kubectl config get-contexts
kubectl config current-context

# RBAC
kubectl create role <name> --verb=get,list --resource=pods
kubectl create rolebinding <name> --role=<role> --user=<user>
kubectl create clusterrole <name> --verb=get,list --resource=nodes
kubectl create clusterrolebinding <name> --clusterrole=<role> --user=<user>
kubectl auth can-i <verb> <resource>
kubectl auth can-i <verb> <resource> --as <user>

# Service Account
kubectl create serviceaccount <name>
kubectl create token <sa-name>

# Network Policy
kubectl get networkpolicy
kubectl describe networkpolicy <name>

# CRD
kubectl get crd
kubectl describe crd <name>
kubectl api-resources
```
