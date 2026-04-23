---
title: "08. 보안"
weight: 8
---

쿠버네티스의 인증/인가 모델과 RBAC, ServiceAccount, Network Policy, Pod Security, 이미지 보안을 다룹니다.

## 1. 쿠버네티스 보안 모델

쿠버네티스 API 서버는 모든 요청에 대해 세 단계를 순서대로 실행한다. **인증 → 인가 → Admission Control** 순서이며, 하나라도 거부하면 요청이 차단된다.

```
요청 흐름:
┌─────────────────────┐
│     Client          │
│  (kubectl, Pod)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  1. Authentication  │
│     누구인가?        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Authorization   │
│     무엇을 할 수?    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Admission Ctrl   │
│   정책/검증/변경     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      etcd 저장      │
└─────────────────────┘
```

| 단계 | 질문 | 구현 |
|:---|:---|:---|
| Authentication | 누가 요청했는가? | X.509, Token, ServiceAccount, OIDC |
| Authorization | 그 동작을 허용할 수 있는가? | Node, RBAC, ABAC, Webhook |
| Admission Control | 요청이 정책에 맞는가? | PodSecurity, ResourceQuota, MutatingWebhook |

### 보안 계층 구조

```
┌──────────────────────────────┐
│    호스트 레벨 보안           │
│  SSH 키 인증, root 차단       │
├──────────────────────────────┤
│    API Server 보안           │
│  Authn / Authz / Admission   │
├──────────────────────────────┤
│    전송 계층 (TLS)           │
│  모든 컴포넌트 간 암호화      │
├──────────────────────────────┤
│    워크로드/네트워크 보안     │
│  Pod Security, NetworkPolicy │
└──────────────────────────────┘
```

---

## 2. 인증 (Authentication)

### 계정 유형

| 유형 | 용도 | 관리 방식 |
|:---|:---|:---|
| User Account | 사람 (관리자, 개발자) | 외부 (인증서, LDAP, OIDC) |
| Service Account | 애플리케이션/봇 | 쿠버네티스 API 리소스 |

쿠버네티스는 **사용자 객체를 직접 관리하지 않는다.** 사용자는 항상 외부 자격 증명(인증서, 토큰)의 CN/주체로 식별된다.

### 인증 메커니즘

| 방식 | 특징 | 권장 여부 |
|:---|:---|:---|
| Static Password File | 평문 파일, `--basic-auth-file` | 비권장 (deprecated) |
| Static Token File | 평문 토큰 파일 | 비권장 |
| X.509 Client Certificate | CA 서명 인증서 | 권장 (표준) |
| Bearer Token | ServiceAccount, OIDC, Webhook | 권장 |

### X.509 클라이언트 인증서

```bash
# 1. 개인키 생성
openssl genrsa -out jane.key 2048

# 2. CSR 생성 (CN=사용자명, O=그룹)
openssl req -new -key jane.key \
  -subj "/CN=jane/O=developers" -out jane.csr

# 3. CA로 서명
openssl x509 -req -in jane.csr \
  -CA ca.crt -CAkey ca.key \
  -out jane.crt -days 365
```

```bash
# 인증서로 API 호출
curl https://kube-apiserver:6443/api/v1/pods \
  --cert jane.crt \
  --key jane.key \
  --cacert ca.crt
```

### Certificates API 기반 서명

쿠버네티스 내부에서 CSR을 승인하여 인증서를 발급할 수 있다.

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <base64-encoded-CSR>
  signerName: kubernetes.io/kube-apiserver-client
  usages:
  - client auth
```

```bash
# 승인 및 인증서 추출
kubectl certificate approve jane
kubectl get csr jane -o jsonpath='{.status.certificate}' \
  | base64 -d > jane.crt
```

### KubeConfig 구조

kubectl은 `~/.kube/config`에 저장된 **cluster, user, context** 세 요소로 API 서버에 접근한다.

```yaml
apiVersion: v1
kind: Config
current-context: dev@development

clusters:
- name: development
  cluster:
    server: https://dev-cluster:6443
    certificate-authority: /path/to/ca.crt

users:
- name: dev
  user:
    client-certificate: /path/to/dev.crt
    client-key: /path/to/dev.key

contexts:
- name: dev@development
  context:
    cluster: development
    user: dev
    namespace: default
```

```bash
kubectl config view
kubectl config get-contexts
kubectl config use-context prod@production
```

---

## 3. 인가 (Authorization)

### 인가 모드

API 서버는 `--authorization-mode` 플래그로 여러 모듈을 체인으로 구성한다. 하나라도 허용하면 통과한다.

| 모드 | 설명 |
|:---|:---|
| Node | kubelet이 자기 노드의 리소스에만 접근 |
| RBAC | 역할 기반 접근 제어 (표준) |
| ABAC | 속성 기반 (비권장, 레거시) |
| Webhook | 외부 서비스에 인가 위임 |
| AlwaysAllow | 모든 요청 허용 (테스트용) |

```bash
kube-apiserver --authorization-mode=Node,RBAC,Webhook
```

```
요청 → Node → RBAC → Webhook
       ↓      ↓       ↓
     거부    거부    최종 결정
      (다음 모듈로 전달)
```

---

## 4. RBAC

### 핵심 구성 요소

```
┌──────────────────────────────┐
│          RBAC 구조            │
│                               │
│   Subject                     │
│  (User/Group/SA)              │
│       │                       │
│       │ (Binding으로 연결)    │
│       ▼                       │
│   RoleBinding                 │
│       │                       │
│       ▼                       │
│   Role (권한 정의)            │
│    - apiGroups                │
│    - resources                │
│    - verbs                    │
└──────────────────────────────┘
```

| 리소스 | 범위 | 바인딩 |
|:---|:---|:---|
| Role | 네임스페이스 | RoleBinding |
| ClusterRole | 클러스터 전체 | ClusterRoleBinding |

### Verbs

| Verb | 의미 |
|:---|:---|
| get | 단일 리소스 조회 |
| list | 목록 조회 |
| watch | 변경 감시 |
| create | 생성 |
| update | 전체 수정 |
| patch | 부분 수정 |
| delete | 삭제 |
| deletecollection | 일괄 삭제 |

### Role 예시

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: pod-reader
rules:
- apiGroups: [""]            # core API
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

### 특정 리소스 이름만 허용

```yaml
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get"]
  resourceNames: ["blue-pod", "green-pod"]
```

### RoleBinding / ClusterRoleBinding

```yaml
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
  name: pod-reader-sa
  namespace: development
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```yaml
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

### 권한 확인

```bash
# 내 권한 확인
kubectl auth can-i create pods
kubectl auth can-i delete nodes

# 다른 사용자 권한 확인 (관리자만)
kubectl auth can-i create pods --as jane
kubectl auth can-i get secrets \
  --as=system:serviceaccount:default:my-sa
```

{{< callout type="warning" >}}
`resources: ["*"]`, `verbs: ["*"]` 같은 **와일드카드 RBAC**은 편리하지만 권한 상승(privilege escalation) 경로가 된다. `create pods` 권한만 있어도 다른 ServiceAccount의 토큰을 마운트해 권한을 훔칠 수 있으므로, 항상 **최소 권한 원칙**을 적용하고 정기적으로 `kubectl auth can-i --list`로 감사한다.
{{< /callout >}}

---

## 5. ServiceAccount

### 개념

ServiceAccount는 **파드가 API 서버에 접근할 때 사용하는 계정**이다. 파드가 생성되면 네임스페이스의 `default` SA가 자동 할당된다.

```
┌──────────────────────────────┐
│         Pod                   │
│  ┌────────────────────────┐  │
│  │  /var/run/secrets/     │  │
│  │  kubernetes.io/        │  │
│  │  serviceaccount/       │  │
│  │  ├── token             │  │
│  │  ├── ca.crt            │  │
│  │  └── namespace         │  │
│  └───────────┬────────────┘  │
└──────────────┼───────────────┘
               │ Bearer Token
               ▼
┌──────────────────────────────┐
│    Kubernetes API Server     │
│   토큰 검증 → RBAC 확인       │
└──────────────────────────────┘
```

### 생성과 사용

```bash
kubectl create serviceaccount dashboard-sa

# 단기 토큰 발급 (v1.24+)
kubectl create token dashboard-sa --duration=1h
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  serviceAccountName: dashboard-sa
  containers:
  - name: app
    image: my-app
```

### 자동 마운트 비활성화

```yaml
spec:
  automountServiceAccountToken: false
  containers:
  - name: app
    image: nginx
```

### TokenRequest API (Projected Volume)

v1.22부터 SA 토큰은 **기본적으로 만료 시간을 가진 projected token**으로 제공된다. 레거시 long-lived Secret 토큰 대신 자동 회전된다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: token-projection
spec:
  serviceAccountName: my-sa
  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: token
      mountPath: /var/run/secrets/tokens
  volumes:
  - name: token
    projected:
      sources:
      - serviceAccountToken:
          path: sa-token
          expirationSeconds: 3600      # 1시간
          audience: my-audience
```

### 완전한 예제: 파드 리더

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-reader-sa
  namespace: development
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
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
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

{{< callout type="warning" >}}
네임스페이스의 **default ServiceAccount를 그대로 쓰지 말자.** 여러 워크로드가 같은 SA를 공유하면 권한 분리가 불가능하다. 파드마다 전용 SA를 만들고, 불필요하면 `automountServiceAccountToken: false`로 토큰 마운트를 막는다.
{{< /callout >}}

---

## 6. Network Policy

### 기본 동작

쿠버네티스 기본 네트워크 모델은 **모든 파드가 모든 파드와 통신 가능**이다. NetworkPolicy를 적용한 파드는 **허용 목록에 명시된 트래픽만** 주고받는다.

```
NetworkPolicy 없음:
   Pod A ◀──────▶ Pod B ◀──────▶ Pod C
   (모두 통신 가능)

NetworkPolicy 적용:
   Pod A ──X──▶ Pod B ──✓──▶ Pod C
   (명시된 트래픽만 허용)
```

### 방향 (Ingress / Egress)

```
                Pod
    Ingress ──▶  ○  ──▶ Egress
    (들어오는)        (나가는)
```

### 기본 구조

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: api
    ports:
    - protocol: TCP
      port: 3306
  egress:
  - to:
    - ipBlock:
        cidr: 10.0.0.0/16
    ports:
    - protocol: TCP
      port: 5432
```

### Selector 유형

```yaml
# Pod 선택
- podSelector:
    matchLabels:
      app: api-server

# 네임스페이스 선택
- namespaceSelector:
    matchLabels:
      env: production

# IP 범위 (CIDR)
- ipBlock:
    cidr: 10.0.0.0/8
    except:
    - 10.0.1.0/24
```

### AND vs OR

```yaml
# AND: 같은 항목 내 (api Pod AND prod 네임스페이스)
ingress:
- from:
  - podSelector:
      matchLabels:
        app: api
    namespaceSelector:
      matchLabels:
        env: prod

# OR: 항목이 분리 (api Pod OR 192.168.5.10)
ingress:
- from:
  - podSelector:
      matchLabels:
        app: api
  - ipBlock:
      cidr: 192.168.5.10/32
```

### Default Deny

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}        # 모든 Pod
  policyTypes:
  - Ingress
  - Egress
  # 규칙 없음 = 모두 차단
```

### CNI 지원

NetworkPolicy는 **CNI 플러그인이 구현해야 동작한다.** 미지원 CNI에서는 정책을 생성해도 적용되지 않는다.

| CNI | NetworkPolicy |
|:---|:---|
| Calico | 지원 |
| Cilium | 지원 (L7까지 확장) |
| Weave Net | 지원 |
| Flannel | 미지원 |

---

## 7. Pod Security Standards

### SecurityContext

`securityContext`는 파드/컨테이너의 리눅스 보안 속성을 설정한다. Pod 레벨은 기본값, Container 레벨이 우선한다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:           # Pod 레벨 (기본값)
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: app
    image: nginx
    securityContext:         # Container 레벨 (우선)
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
```

### 주요 필드

| 필드 | 설명 |
|:---|:---|
| runAsUser | 실행할 UID (예: 1000) |
| runAsNonRoot | root(UID 0) 실행 금지 |
| allowPrivilegeEscalation | setuid 등 권한 상승 차단 |
| readOnlyRootFilesystem | `/` 파일시스템 읽기 전용 |
| capabilities | Linux capability 추가/제거 |

### Pod Security Admission

v1.25부터 PodSecurityPolicy가 제거되고 **Pod Security Admission**이 표준이 되었다. 네임스페이스 레이블로 3단계 프로파일을 강제한다.

| 프로파일 | 설명 |
|:---|:---|
| privileged | 제한 없음 (관리 워크로드용) |
| baseline | 알려진 위험만 차단 |
| restricted | 강화된 기본값 (권장) |

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

---

## 8. 이미지 보안

### 이미지 명명 규칙

```
[REGISTRY]/[USER]/[IMAGE]:[TAG]

nginx                   → docker.io/library/nginx:latest
mycompany/app:v1.0      → docker.io/mycompany/app:v1.0
gcr.io/proj/app:v1.0    → gcr.io/proj/app:v1.0
```

### 프라이빗 레지스트리 (ImagePullSecrets)

```bash
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

### 이미지 서명 (Sigstore / Cosign)

무결성 검증을 위해 이미지를 서명하고, Admission 단계에서 서명 여부를 강제한다.

```bash
# Cosign으로 서명
cosign sign --key cosign.key \
  myregistry.com/app:v1.0

# 검증
cosign verify --key cosign.pub \
  myregistry.com/app:v1.0
```

Kyverno, OPA Gatekeeper, Connaisseur 같은 Admission Controller로 **서명되지 않은 이미지를 거부**할 수 있다.

### 취약점 스캔

| 도구 | 용도 |
|:---|:---|
| Trivy | 이미지/IaC 취약점 스캔 |
| Grype | SBOM 기반 취약점 탐지 |
| Clair | 레지스트리 통합 스캔 |

```bash
trivy image myregistry.com/app:v1.0
```

{{< callout type="info" >}}
쿠버네티스 Secret은 기본적으로 **etcd에 base64 인코딩**으로만 저장된다. 암호화가 아니다. 프로덕션에서는 반드시 **EncryptionConfiguration**으로 etcd 암호화(aescbc, kms)를 설정하거나 **외부 시크릿 매니저**(HashiCorp Vault, AWS Secrets Manager, External Secrets Operator)를 연동한다.
{{< /callout >}}

---

## 9. 명령어 요약

```bash
# 인증서
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -subj "/CN=user" -out csr.pem
openssl x509 -req -in csr.pem -CA ca.crt -CAkey ca.key -out cert.crt
openssl x509 -in cert.crt -text -noout

# CSR
kubectl get csr
kubectl certificate approve <name>
kubectl certificate deny <name>

# KubeConfig
kubectl config view
kubectl config get-contexts
kubectl config use-context <context>
kubectl config current-context

# RBAC
kubectl create role pod-reader \
  --verb=get,list --resource=pods
kubectl create rolebinding read-pods \
  --role=pod-reader --user=jane
kubectl create clusterrole node-reader \
  --verb=get,list --resource=nodes
kubectl create clusterrolebinding read-nodes \
  --clusterrole=node-reader --user=jane
kubectl auth can-i <verb> <resource>
kubectl auth can-i <verb> <resource> --as <user>

# ServiceAccount
kubectl create serviceaccount <name>
kubectl create token <sa-name> --duration=1h

# NetworkPolicy
kubectl get networkpolicy
kubectl describe networkpolicy <name>

# Pod Security
kubectl label ns production \
  pod-security.kubernetes.io/enforce=restricted
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Authn/Authz/Admission | 모든 API 요청의 3단계 검증 |
| X.509 인증서 | 사용자 인증의 표준 방식 |
| RBAC | 역할 기반 권한 관리, 최소 권한 원칙 |
| ServiceAccount | 파드의 API 접근 계정, 토큰 자동 마운트 |
| NetworkPolicy | 파드 간 트래픽 화이트리스트 |
| Pod Security | securityContext + PSA로 런타임 격리 |
| 이미지 보안 | 서명(Cosign), 스캔(Trivy), 프라이빗 레지스트리 |

{{< callout type="info" >}}
**용어 정리**
- **Authentication**: 요청자가 누구인지 확인
- **Authorization**: 요청자가 그 동작을 할 권한이 있는지 확인
- **Admission Controller**: 요청을 검증/변형하는 플러그인
- **RBAC**: Role-Based Access Control, 역할 기반 접근 제어
- **ServiceAccount**: 파드가 사용하는 API 계정
- **NetworkPolicy**: 파드 레벨 방화벽 규칙
- **Pod Security Standards**: privileged/baseline/restricted 3단계 프로파일
- **Sigstore/Cosign**: 컨테이너 이미지 서명/검증 도구
{{< /callout >}}
