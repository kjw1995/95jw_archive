---
title: "08. 보안"
date: 2026-04-23
weight: 8
---

[02. 핵심 개념](../02-core-concepts)에서 kube-apiserver는 모든 요청의 유일한 문이라 했고, [03. 클러스터 구성](../03-cluster-setup)에서는 kubeadm이 만드는 인증서 묶음과 `admin.conf`의 인증서 주체를 봤다. [05. 스케줄링](../05-scheduling) 13절의 어드미션 컨트롤러 표는 PodSecurity와 ServiceAccount 두 줄을 이 장으로 미뤘다. 이 장은 그 문 안에서 누가 무엇을 해도 되는지가 어떻게 정해지는지를 처음부터 끝까지 잇는다. 원리는 셋이다. 첫째, **API 서버로 들어오는 모든 요청은 인증, 인가, 어드미션 세 문을 순서대로 지나고, 한 문에서 막히면 거기서 끝이다.** 인증은 누구인지, 인가는 그 사람이 그 동작을 해도 되는지, 어드미션은 그 요청의 내용이 클러스터의 정책에 맞는지를 본다. 둘째, **신원은 이름이 아니라 서명에서 온다.** 사람은 클러스터 CA가 서명한 인증서의 CN과 O로, 파드는 API 서버가 서명한 토큰의 sub로 식별된다. 이름은 누구나 읽을 수 있지만 서명 없이는 한 글자도 못 바꾼다. 셋째, **권한은 0에서 시작해 필요한 만큼만 더한다.** RBAC에는 허용 규칙만 있고 거부 규칙이 없다. NetworkPolicy는 파드에 붙는 순간 명시한 트래픽만 남기고, Pod Security는 컨테이너가 리눅스에서 할 수 있는 일을 깎는다.

---

## 1. 쿠버네티스 보안 모델

### 1.1 세 개의 문

```text
kubectl / 파드 ─▶ API 서버
        │
   ① 인증  누구인가
        │  인증서 CN·O, 토큰 sub
        ▼
   ② 인가  해도 되는가
        │  Node, RBAC, Webhook
        ▼
   ③ 어드미션  정책에 맞는가
        │  PodSecurity, Quota, Webhook
        ▼
      etcd 저장
```

| 문 | 묻는 것 | 구현 | 왜 이 순서인가 |
|:---|:-----|:-----|:-----------|
| 인증 (Authentication) | 누가 보냈나 | X.509 인증서, ServiceAccount 토큰, OIDC, 인증 웹훅 | 누구인지 모르면 권한을 물을 수 없다 |
| 인가 (Authorization) | 그 사람이 그 동작을 해도 되나 | Node, RBAC, ABAC, 웹훅 | 신원이 정해진 뒤에야 규칙을 찾는다 |
| 어드미션 (Admission) | 요청 내용이 정책에 맞나 | PodSecurity, ResourceQuota, Mutating·Validating 웹훅, ValidatingAdmissionPolicy | 권한이 있어도 내용이 틀릴 수 있다. 고치는 것(mutating)이 먼저, 검사(validating)가 나중이다 |

첫째 원리다. [02](../02-core-concepts)장 2.2절의 kube-apiserver는 클러스터의 유일한 문이고, 그 문 안에 세 개의 검사가 줄지어 있다. 인증은 요청에 붙은 증명(인증서, 토큰)을 보고 "이 요청은 jane이다", "이 요청은 dev 네임스페이스의 app ServiceAccount다"로 바꾼다. 인가는 그 이름으로 "pods를 dev에서 list해도 되는가"를 규칙에 묻는다. 어드미션은 통과한 요청의 본문을 보고 "이 파드는 root로 돌려고 하는데 이 네임스페이스는 그것을 금한다"처럼 정책을 댄다. 셋 중 하나라도 거절하면 etcd에는 아무것도 안 쓰인다. 읽기 요청도 같은 문을 지난다. 어드미션 컨트롤러의 종류와 순서는 [05](../05-scheduling)장 13절이고, 이 장은 그중 PodSecurity(7절)와 ServiceAccount(5절)를 받는다.

### 1.2 보안 계층

| 계층 | 막는 것 | 도구 | 왜 따로 있는가 |
|:-----|:------|:-----|:-----------|
| 호스트 | 노드 자체로의 접근 | SSH 키, root 로그인 차단, 최소 패키지 | 노드에 들어오면 kubelet 인증서와 컨테이너가 다 보인다 |
| 전송 | 도청·위조 | 모든 컴포넌트 사이 TLS | etcd, API 서버, kubelet이 네트워크로 말한다. [03](../03-cluster-setup)장 6.3절의 init 단계가 이 인증서들을 만든다 |
| API 서버 | 잘못된 요청 | 위의 세 문 | 클러스터 상태를 바꾸는 유일한 길 |
| 워크로드 | 파드가 할 수 있는 일 | Pod Security, NetworkPolicy | 통과한 파드도 컨테이너 안에서 무엇이든 하면 안 된다 |

---

## 2. 인증 (Authentication)

### 2.1 계정 유형

| 종류 | 누구 | 어디서 관리 | 왜 |
|:-----|:----|:---------|:---|
| 사용자 (User) | 사람. 관리자, 개발자 | 클러스터 밖. 인증서, OIDC, 회사 IdP | 쿠버네티스에는 User 오브젝트가 없다. 증명에 적힌 이름이 곧 사용자다 |
| ServiceAccount | 파드. 애플리케이션, 컨트롤러 | 클러스터 안의 API 리소스 | 파드가 API 서버에 말을 걸려면 파드용 신원이 필요하다 (5절) |

쿠버네티스는 사용자를 저장하지 않는다. `kubectl get users`는 없다. 사용자는 인증서의 CN, 토큰의 sub 같은 **증명에 적힌 문자열**로만 존재하고, 그 문자열이 RBAC의 주체가 된다. 그래서 인증 방식이 곧 사용자 관리 방식이다. 내가 API 서버에게 누구로 보이는지는 `kubectl auth whoami`(1.28 GA)로 확인한다.

### 2.2 인증 메커니즘

| 방식 | 증명 | 권장 | 왜 |
|:-----|:----|:----|:---|
| X.509 클라이언트 인증서 | 클러스터 CA가 서명한 인증서. CN이 이름, O가 그룹 | 표준 | kubeadm이 관리자·kubelet·컴포넌트 전부에 쓰는 방식. 서명 검증만으로 신원이 선다 |
| ServiceAccount 토큰 | API 서버가 서명한 JWT | 파드의 표준 | 파드에 자동으로 꽂힌다 (5절) |
| OIDC | 외부 IdP가 서명한 JWT | 사람이 많을 때 | 회사 SSO로 로그인하고 그룹을 IdP에서 받는다. 1.34 GA인 `AuthenticationConfiguration` 파일로 발급자 여러 개와 CEL 클레임 매핑을 적는다 |
| 인증 웹훅 | 외부 서비스에 토큰 검증 위임 | 특수 | 자체 토큰 체계를 붙일 때 |
| 정적 토큰 파일 | `--token-auth-file`로 넘긴 평문 파일 | 비권장 | 바꾸려면 API 서버를 재시작해야 하고, 파일이 곧 비밀이다. 비밀번호 파일(`--basic-auth-file`)은 1.19에서 제거됐다 |
| 익명 | 없음. `system:anonymous`, 그룹 `system:unauthenticated` | 헬스 체크 경로만 | 기본으로 켜져 있다. `AuthenticationConfiguration`의 `anonymous.conditions`(1.34 GA)로 `/healthz`, `/livez`, `/readyz`에만 허용한다 |

### 2.3 X.509 클라이언트 인증서

```bash
# 1. 개인키
openssl genrsa -out jane.key 2048

# 2. CSR: CN이 사용자, O가 그룹
openssl req -new -key jane.key \
  -subj "/CN=jane/O=developers" \
  -out jane.csr

# 3. 클러스터 CA가 서명
openssl x509 -req -in jane.csr \
  -CA ca.crt -CAkey ca.key \
  -days 365 -out jane.crt
```

| 인증서의 자리 | 쿠버네티스가 읽는 뜻 | 예 | 왜 |
|:-----------|:---------------|:---|:---|
| subject의 CN | 사용자 이름 | `CN=jane` | RBAC의 `kind: User`에 그대로 쓰인다 |
| subject의 O | 그룹. 여러 개 가능 | `O=developers`, `O=qa` | RBAC의 `kind: Group`. 사람 대신 그룹에 바인딩하면 사람이 바뀌어도 규칙은 그대로다 |
| issuer | 서명한 CA | `CN=kubernetes` | API 서버는 `--client-ca-file`의 CA가 서명한 것만 받는다 |
| notBefore, notAfter | 유효 기간 | 1년 | 만료도 서명 안에 있다. 만료된 인증서는 TLS 핸드셰이크에서 거절된다 |

[03](../03-cluster-setup)장 6.4절에서 본 `admin.conf`의 주체 `O=kubeadm:cluster-admins, CN=kubernetes-admin`이 바로 이 형식이다. 사용자 kubernetes-admin이 그룹 kubeadm:cluster-admins에 속하고, 그 그룹이 ClusterRoleBinding으로 cluster-admin을 받는다. 옆의 `super-admin.conf`는 그룹이 `system:masters`라 RBAC를 거치지 않고 통과하는 비상 열쇠다.

| 검사 | 결과 | 왜 |
|:-----|:----|:---|
| 클러스터 CA가 서명한 인증서 | 통과. subject가 사용자·그룹이 된다 | 서명이 CA 개인키로 만들어졌다 |
| 다른 CA가 서명한 같은 이름 | 거절 (unknown ca) | 이름이 같아도 서명자가 다르면 남이다 |
| 만료된 인증서 | 거절 (certificate expired) | 날짜 검사는 핸드셰이크 안에서 끝난다 |
| 인증서 없음 | 익명 요청. 인가에서 거의 다 막힌다 | 인증서를 요구하는 서버라면 핸드셰이크에서 끊긴다 |
| 인증서의 이름 한 글자를 고친 것 | 거절 (signature failure) | 서명은 인증서 내용 전체의 해시다. 한 비트만 달라도 깨진다 |

둘째 원리다. 인증서에 적힌 `CN=jane`은 평문이라 누구나 읽을 수 있다. API 서버가 그 이름을 믿는 근거는 이름이 아니라 **CA의 서명**이다. 이름 한 글자를 고치면 서명이 내용 전체의 해시 위에 찍혀 있어 검증이 실패하고, 다른 CA가 같은 이름으로 서명한 인증서는 서명자가 신뢰 목록에 없어 실패한다. 그래서 클러스터에서 `ca.key`는 가장 무거운 파일이다. 그 키를 가진 사람은 어떤 이름의 사용자든 만들 수 있다. 같은 이유로 API 서버 앞의 로드밸런서는 TLS를 끝내지 말고 TCP로 넘겨야 한다([03](../03-cluster-setup)장 10.2절). LB가 TLS를 풀면 클라이언트 인증서가 API 서버에 닿지 않는다.

{{< callout type="info" >}}
**인증서는 취소가 안 된다.** API 서버는 CRL이나 OCSP를 보지 않는다. 발급한 인증서는 만료일까지 유효하고, 퇴사자의 인증서를 지우는 방법은 없다. 그래서 유효 기간을 짧게 잡거나(kubeadm의 인증서는 1년이고 `kubeadm certs renew`로 갱신한다. [03](../03-cluster-setup)장 14.3절), 사람은 OIDC로 붙여 IdP에서 끊거나, 인증서가 새어 나갔으면 그 이름과 그룹의 RBAC 바인딩을 지운다. 이름은 남아도 권한이 0이면 아무것도 못 한다. 키는 RSA 2048이 기본이지만 kubeadm의 `encryptionAlgorithm`으로 ECDSA P-256을 고를 수 있고, 생성과 서명이 훨씬 빠르다.
{{< /callout >}}

### 2.4 Certificates API 기반 서명

CA 키를 꺼내지 않고 클러스터 안에서 서명받는 길이다. CSR을 오브젝트로 올리면 관리자가 승인하고, kube-controller-manager가 CA 키로 서명해 `status.certificate`에 넣어 준다.

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <base64로 인코딩한 CSR>
  signerName:
    kubernetes.io/kube-apiserver-client
  expirationSeconds: 31536000  # 1년
  usages:
  - client auth
```

```bash
kubectl get csr
kubectl certificate approve jane
kubectl get csr jane \
  -o jsonpath='{.status.certificate}' \
  | base64 -d > jane.crt
```

| 단계 | 누가 | 왜 |
|:-----|:----|:---|
| CSR 제출 | 사용자 | 개인키는 사용자 손을 떠나지 않는다. 공개키와 이름만 보낸다 |
| 승인 | `certificatesigningrequests/approval`을 update할 수 있는 사람 | 서명은 곧 사용자 생성이라 사람이 본다 |
| 서명 | kube-controller-manager의 서명 컨트롤러 | CA 키를 가진 유일한 컴포넌트 |
| 꺼내기 | 사용자 | `status.certificate`에 base64로 들어 있다 |

| 내장 signer | 용도 | 자동 승인 | 왜 |
|:----------|:----|:-------|:---|
| `kubernetes.io/kube-apiserver-client` | 사람·프로그램의 클라이언트 인증서 | 안 함 | 사용자 생성이라 사람이 승인한다 |
| `kubernetes.io/kube-apiserver-client-kubelet` | kubelet이 API 서버에 내는 인증서 | 부트스트랩 토큰이 맞으면 자동 | [03](../03-cluster-setup)장 8절의 `kubeadm join`이 이것을 쓴다 |
| `kubernetes.io/kubelet-serving` | kubelet의 서버 인증서 | 안 함 | 노드 이름과 IP를 사람이 확인해야 한다 |

`expirationSeconds`(1.22부터, 최소 600초)로 짧은 인증서를 요청할 수 있다. 신뢰할 CA 묶음을 클러스터 오브젝트로 배포하는 ClusterTrustBundle도 안정 단계에 있고, 파드에 인증서를 직접 발급하는 PodCertificateRequest가 들어와 있다.

### 2.5 KubeConfig 구조

```yaml
apiVersion: v1
kind: Config
current-context: jane@dev
clusters:
- name: dev
  cluster:
    server: https://192.0.2.10:6443
    certificate-authority: ca.crt
users:
- name: jane
  user:
    client-certificate: jane.crt
    client-key: jane.key
contexts:
- name: jane@dev
  context:
    cluster: dev
    user: jane
    namespace: dev
```

| 요소 | 담는 것 | 왜 나뉘어 있는가 |
|:-----|:------|:------------|
| cluster | API 서버 주소와 그 서버를 검증할 CA | 서버가 진짜인지 클라이언트도 확인한다. 양방향 TLS다 |
| user | 내 인증서와 키, 또는 토큰, 또는 OIDC 플러그인 | 같은 사람이 여러 클러스터에 같은 신원을 쓴다 |
| context | cluster + user + 기본 namespace | `use-context` 하나로 통째로 갈아탄다 |

```bash
kubectl config get-contexts
kubectl config use-context jane@prod
kubectl config view --minify
kubectl auth whoami
```

파일에 경로 대신 `certificate-authority-data`처럼 `-data` 접미사를 붙이면 인증서 내용을 base64로 박아 넣는다. kubeadm의 `admin.conf`가 그 모양이라 파일 하나만 옮기면 된다.

---

## 3. 인가 (Authorization)

### 3.1 인가 모드

```bash
kube-apiserver \
  --authorization-mode=Node,RBAC,Webhook
```

```text
요청 ─▶ Node ─▶ RBAC ─▶ Webhook
        의견   의견     의견
        없음   없음     없음 → 거부
   하나라도 "허용"이면 그 자리서 통과
```

| 모드 | 무엇을 보나 | 왜 |
|:-----|:---------|:---|
| Node | kubelet이 자기 노드의 파드·시크릿·볼륨만 | kubelet의 인증서(`system:node:이름`, 그룹 `system:nodes`)로 다른 노드의 비밀을 못 읽게. 어드미션의 NodeRestriction이 짝이다 |
| RBAC | Role·ClusterRole과 바인딩 | 표준. 클러스터 안의 오브젝트로 관리된다 (4절) |
| ABAC | 정책 파일의 속성 규칙 | 레거시. 파일을 바꾸면 API 서버 재시작 |
| Webhook | 외부 서비스의 판단 | OPA 같은 정책 엔진을 붙일 때. 1.32 GA인 `AuthorizationConfiguration` 파일로 웹훅 여러 개를 순서대로 둘 수 있다 |
| AlwaysAllow / AlwaysDeny | 전부 통과 / 전부 거부 | 테스트용 |

모듈은 순서대로 "허용", "거부", "의견 없음" 중 하나를 말한다. 허용이나 거부가 나오면 거기서 끝이고, 의견 없음이면 다음 모듈로 간다. 끝까지 의견이 없으면 거부다. RBAC은 거부를 말할 줄 모르고 허용 아니면 의견 없음만 말한다. 셋째 원리의 첫 조각이다. 기본이 0이고, 규칙은 더하기만 한다.

---

## 4. RBAC

### 4.1 핵심 구성 요소

```text
주체 (User, Group, ServiceAccount)
        │ RoleBinding이 잇는다
        ▼
Role: 어떤 리소스에 어떤 동사
  apiGroups / resources / verbs
```

| 오브젝트 | 범위 | 짝 | 왜 둘로 나뉘는가 |
|:-------|:----|:---|:------------|
| Role | 네임스페이스 하나 | RoleBinding | 팀 하나의 권한은 그 팀의 네임스페이스에 갇혀야 한다 |
| ClusterRole | 클러스터 전체, 또는 nodes·namespaces·persistentvolumes처럼 네임스페이스가 없는 리소스 | ClusterRoleBinding | 노드를 읽는 권한은 네임스페이스에 속하지 않는다 |
| RoleBinding | 네임스페이스 하나 | Role 또는 ClusterRole | ClusterRole을 한 네임스페이스에만 주는 데도 쓴다. 정의는 한 번, 바인딩은 네임스페이스마다 |
| ClusterRoleBinding | 클러스터 전체 | ClusterRole | 모든 네임스페이스에 한꺼번에 |

바인딩의 `roleRef`는 만든 뒤 못 바꾼다. 다른 Role을 주려면 바인딩을 지우고 새로 만든다. 권한을 준 기록이 조용히 다른 권한으로 바뀌는 일을 막기 위해서다.

### 4.2 Verbs

| 동사 | 뜻 | 왜 따로인가 |
|:-----|:--|:---------|
| get | 이름을 알고 하나 읽기 | 이름을 아는 사람만 |
| list | 목록 읽기 | 목록에는 오브젝트 전체가 들어 있다. list는 사실상 모든 get이다 |
| watch | 변경 스트림 받기 | 컨트롤러가 쓰는 동사. 역시 오브젝트 전체를 받는다 |
| create / update / patch | 만들기 / 통째로 바꾸기 / 일부 바꾸기 | 쓰기 권한을 셋으로 쪼갠다 |
| delete / deletecollection | 하나 지우기 / 셀렉터로 여럿 지우기 | `kubectl delete pods --all`은 뒤의 것이다 |
| 서브리소스 `pods/exec`, `pods/log`, `pods/portforward` | 컨테이너에 들어가기, 로그, 포트 전달 | pods의 get과 별개다. exec는 컨테이너 안의 모든 것이다 |
| `escalate`, `bind`, `impersonate` | 내가 없는 권한을 Role에 적기, 그 Role을 바인딩하기, 남으로 행동하기 | 이 셋이 있으면 권한의 울타리를 넘을 수 있어 따로 셀 수 있게 동사로 뺐다 |

### 4.3 Role과 Binding 예시

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: dev
  name: pod-reader
rules:
- apiGroups: [""]        # core
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

```yaml
# 이름을 찍어 그 리소스만
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "update"]
  resourceNames: ["app-config"]
```

`resourceNames`는 get, update, patch, delete처럼 이름이 있는 요청에만 걸린다. list, watch, create는 요청에 이름이 없어서 함께 쓸 수 없다.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: dev
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: app
  namespace: dev
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-nodes
subjects:
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
```

2.3절의 인증서가 여기서 만난다. `CN=jane`은 `kind: User, name: jane`에, `O=developers`는 `kind: Group, name: developers`에 붙는다. ServiceAccount는 `system:serviceaccount:네임스페이스:이름`이라는 사용자 이름과 `system:serviceaccounts:네임스페이스` 그룹으로 나타난다.

### 4.4 기본 ClusterRole

| ClusterRole | 주는 것 | 왜 |
|:-----------|:------|:---|
| cluster-admin | 모든 리소스에 모든 동사 | `system:masters` 그룹이 이것에 묶여 있다. 사람에게 직접 주지 않는다 |
| admin | 네임스페이스 안의 거의 전부, Role·RoleBinding 포함 | 네임스페이스 주인. 남에게 권한을 나눠 줄 수 있다 |
| edit | 네임스페이스 안의 읽기·쓰기. Role·RoleBinding 제외 | 개발자. 권한을 나눠 주지는 못한다 |
| view | 네임스페이스 안의 읽기. Secret 제외 | Secret을 빼야 읽기 전용이 안전하다 |

admin·edit·view는 **집계(aggregated) ClusterRole**이다. 레이블 `rbac.authorization.k8s.io/aggregate-to-edit: "true"`가 붙은 ClusterRole의 규칙을 컨트롤러가 모아 넣는다. CRD를 추가한 오퍼레이터가 이 레이블로 자기 리소스를 edit에 끼워 넣는 식이다.

### 4.5 권한 확인

```bash
kubectl auth can-i create pods
kubectl auth can-i delete nodes
kubectl auth can-i list secrets -n dev

# 남의 눈으로 (impersonate 권한 필요)
kubectl auth can-i create pods --as jane
kubectl auth can-i get secrets \
  --as system:serviceaccount:dev:app

# 내가 가진 전부
kubectl auth can-i --list -n dev
```

{{< callout type="warning" >}}
**최소 권한과 관리자급 권한.** `resources: ["*"]`, `verbs: ["*"]`는 지금 있는 리소스뿐 아니라 앞으로 생길 리소스까지 허용한다. 그리고 공식 문서가 cluster-admin과 같다고 경고하는 권한이 있다. `pods`의 create(그 네임스페이스의 어떤 ServiceAccount든 파드에 붙일 수 있으니 그 네임스페이스에 있는 모든 ServiceAccount의 권한을 합친 것과 같다), `secrets`의 읽기, `escalate`, `bind`, `impersonate`, CSR의 approve와 signer 권한이다. 이런 권한은 Role을 만들 때 관리자 권한을 주는 것으로 셈하고, `kubectl auth can-i --list`와 `kubectl auth reconcile`로 누가 무엇을 갖는지 주기적으로 맞춘다.
{{< /callout >}}

---

## 5. ServiceAccount

### 5.1 개념

```text
파드 안
/var/run/secrets/
  kubernetes.io/serviceaccount/
    ├── token      서명된 JWT
    ├── ca.crt     API 서버 검증용
    └── namespace
        │ Authorization: Bearer <token>
        ▼
API 서버: sa.pub로 서명 검증 → RBAC
```

파드는 인증서가 없다. 대신 네임스페이스마다 있는 `default` ServiceAccount가, 또는 `serviceAccountName`으로 고른 것이 파드에 붙고, kubelet이 그 계정의 토큰을 파일로 꽂아 준다. 파드 안의 프로그램은 그 토큰을 `Authorization: Bearer` 헤더에 실어 API 서버에 말한다. 토큰은 API 서버가 `sa.key`로 서명한 JWT이고, 검증은 짝 공개키 `sa.pub`으로 한다. 2.3절의 인증서와 같은 구조다. 서명자가 CA에서 API 서버로 바뀌었을 뿐이다.

| ServiceAccount 어드미션 컨트롤러가 파드 생성 때 하는 일 | 왜 |
|:------------------------------------|:---|
| `serviceAccountName`이 없으면 `default`를 채운다 | 모든 파드에 신원이 있어야 인가를 물을 수 있다 |
| 토큰·ca.crt·namespace를 projected 볼륨으로 붙인다 | 프로그램이 파일만 읽으면 되게. [06](../06-storage)장 2.5절의 `serviceAccountToken` 소스가 이것이다 |
| ServiceAccount의 `imagePullSecrets`를 파드에 복사한다 | 파드마다 레지스트리 자격 증명을 적지 않아도 되게 (8절) |

[05](../05-scheduling)장 13.3절이 이 장으로 미룬 ServiceAccount 컨트롤러가 이것이다. Mutating 컨트롤러라 요청을 고쳐 넣는다.

### 5.2 토큰의 구조

토큰은 `헤더.페이로드.서명` 세 부분을 점으로 이은 JWT다. 페이로드는 base64라 파드 안에서 그대로 읽힌다.

```bash
T=/var/run/secrets/kubernetes.io
cat $T/serviceaccount/token \
  | cut -d. -f2 | base64 -d | jq .
```

| 클레임 | 값 (예) | 왜 |
|:-----|:------|:---|
| `iss` | `https://kubernetes.default.svc.cluster.local` | 발급자. OIDC 발견 문서도 이 주소 아래에 있다 |
| `sub` | `system:serviceaccount:dev:app` | RBAC이 보는 사용자 이름 |
| `aud` | `["https://kubernetes.default.svc.cluster.local"]` | 이 토큰을 받아 줄 대상. 다른 서비스에 내밀어도 aud가 달라 안 먹는다 |
| `exp`, `iat`, `nbf` | 1시간 뒤, 발급 시각, 유효 시작 | 만료가 있어 새어 나가도 오래 못 쓴다 |
| `kubernetes.io.namespace`, `.serviceaccount`, `.pod`, `.node` | dev, app과 uid, 파드 이름과 uid, 노드 이름과 uid | 파드에 묶인 토큰. 파드가 사라지면 토큰도 죽는다 |

페이로드는 읽히지만 고칠 수는 없다. namespace 한 값을 바꾸면 서명 검증이 실패한다. 서명이 페이로드 전체를 덮기 때문이고, 2.3절 인증서의 이름 한 글자와 같은 이유다. 그래서 토큰을 로그에 남기면 이름은 다 보이되 위조는 안 되고, 대신 그 토큰을 그대로 쓰는 사람은 만료까지 그 파드로 행동할 수 있다. 외부 시스템이 이 토큰을 검증하려면 API 서버의 TokenReview에 물어보면 된다.

### 5.3 생성과 사용

```bash
kubectl create serviceaccount app
# 손에 쥐는 단기 토큰 (1.24+)
kubectl create token app --duration=1h
# 특정 파드에 묶인 토큰
kubectl create token app \
  --bound-object-kind Pod \
  --bound-object-name my-app
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  serviceAccountName: app
  containers:
  - name: app
    image: my-app
```

### 5.4 자동 마운트 비활성화

```yaml
# API 서버에 말할 일이 없는 파드
spec:
  automountServiceAccountToken: false
  containers:
  - name: web
    image: nginx
```

ServiceAccount 오브젝트에 같은 필드를 두면 그 계정을 쓰는 모든 파드에 적용되고, 파드의 값이 우선한다.

### 5.5 TokenRequest API와 Projected 토큰

| 토큰 | 만료 | 대상(aud) | 묶임 | 왜 바뀌었나 |
|:-----|:----|:--------|:----|:---------|
| 레거시 Secret 토큰 (`kubernetes.io/service-account-token`) | 없음 | 없음 | ServiceAccount에만 | 새어 나가면 영원히 유효하다. 1.24부터 자동 생성이 끊겼고, 1.30 GA인 정리 컨트롤러가 1년 동안 쓰이지 않은 토큰에 `kubernetes.io/legacy-token-invalid-since` 레이블을 붙여 무효로 만들고 다시 1년 뒤 지운다 |
| Projected 토큰 (TokenRequest, 1.22 GA) | 있음. kubelet이 만료 전에 갱신 | 있음 | ServiceAccount + 파드, 또는 노드(1.33 GA) | 파드가 죽으면 토큰도 죽는다. 60초 뒤 API 서버가 거절한다 |

[04](../04-workloads)장 9절의 Secret 타입 표에 있던 `kubernetes.io/service-account-token`이 위 표의 첫 줄이다. 지금은 파드가 토큰을 Secret에서 읽지 않고 kubelet이 TokenRequest API로 받아 projected 볼륨에 쓴다. 만료와 대상을 직접 정하려면 볼륨을 손으로 적는다.

```yaml
# 만료·대상을 직접 정한 토큰
spec:
  serviceAccountName: app
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
          expirationSeconds: 3600
          audience: vault
```

### 5.6 완전한 예제: 파드 리더

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app
  namespace: dev
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-reads-pods
  namespace: dev
subjects:
- kind: ServiceAccount
  name: app
  namespace: dev
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

{{< callout type="warning" >}}
**default ServiceAccount를 그대로 쓰지 않는다.** 네임스페이스의 모든 파드가 같은 `default`를 쓰면 권한을 나눌 방법이 없다. 하나에 준 권한이 전부의 권한이다. 워크로드마다 ServiceAccount를 만들고, API 서버에 말할 일이 없는 파드(대부분의 웹 서버가 그렇다)는 `automountServiceAccountToken: false`로 토큰 자체를 안 꽂는다. 토큰이 없으면 새어 나갈 것도 없다.
{{< /callout >}}

---

## 6. Network Policy

### 6.1 기본 동작

```text
정책 없음: 모두 ↔ 모두
 A ◀──▶ B ◀──▶ C

B에 정책 (from: A, port 3306)
 A ──▶ B    C ──X──▶ B
 A만 남고 C는 막힌다
```

쿠버네티스의 기본 네트워크는 [07](../07-networking)장 1.1절대로 모든 파드가 모든 파드와 통한다. NetworkPolicy는 `podSelector`로 고른 파드에 붙고, 붙는 순간 그 파드는 그 방향으로 **정책에 적힌 트래픽만** 주고받는다. 셋째 원리의 둘째 조각이다. 규칙은 다음 넷이다.

| 규칙 | 뜻 | 왜 |
|:-----|:--|:---|
| 정책이 없으면 전부 허용 | 어떤 정책에도 선택되지 않은 파드는 격리되지 않는다 | 기본이 열림이라 정책을 한 개라도 두는 것이 시작이다 |
| 정책은 합집합 | 한 파드에 정책이 여럿이면 허용의 합이다. 순서는 없다 | 거부 규칙이 없으니 충돌도 없다 |
| 양쪽이 다 허용해야 통한다 | 보내는 파드의 egress와 받는 파드의 ingress 둘 다 열려야 한다 | 한쪽만 닫아도 막힌다 |
| 자기 자신과 노드는 못 막는다 | 파드가 자기 IP로 오는 트래픽과 자기 노드에서 오는 트래픽은 늘 허용 | kubelet의 프로브가 그 길로 온다 |

### 6.2 기본 구조

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
  namespace: prod
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
      endPort: 5440
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `podSelector` | 정책이 붙는 파드. [05](../05-scheduling)장 2절의 레이블 셀렉터다 | `{}`면 네임스페이스의 모든 파드 |
| `policyTypes` | Ingress, Egress 중 무엇을 다루나 | 적은 방향만 격리한다. 생략하면 Ingress는 늘 들어가고, egress 규칙이 있을 때만 Egress가 들어간다 |
| `ingress.from` / `egress.to` | 상대 | podSelector, namespaceSelector, ipBlock 셋 중 조합 |
| `ports` | 포트와 프로토콜(TCP, UDP, SCTP). `endPort`로 범위 | 안 적으면 모든 포트 |

### 6.3 Selector 유형

| 셀렉터 | 고르는 것 | 왜 |
|:-----|:-------|:---|
| `podSelector` | 같은 네임스페이스의 파드 | 네임스페이스를 안 적으면 내 네임스페이스다 |
| `namespaceSelector` | 다른 네임스페이스의 모든 파드 | 네임스페이스에 레이블이 있어야 한다. `kubernetes.io/metadata.name`이 자동으로 붙어 이름으로 고를 수 있다 |
| 둘을 한 항목에 | 그 네임스페이스의 그 파드 | `-`가 하나면 AND, 둘이면 OR. YAML 들여쓰기 한 칸이 뜻을 바꾼다 |
| `ipBlock` | CIDR. `except`로 뺀다 | 클러스터 밖의 상대. 파드 IP는 바뀌니 파드에는 안 쓴다 |

### 6.4 AND vs OR

```yaml
# AND: 한 항목 안에 둘
ingress:
- from:
  - podSelector:
      matchLabels:
        app: api
    namespaceSelector:
      matchLabels:
        env: prod

# OR: 항목 둘
ingress:
- from:
  - podSelector:
      matchLabels:
        app: api
  - ipBlock:
      cidr: 192.0.2.10/32
```

### 6.5 Default Deny

```yaml
# 네임스페이스 전면 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

허용을 하나도 안 적은 정책이 곧 전면 차단이다. 여기서 시작해 필요한 짝만 위 6.2절 같은 정책으로 열어 준다. 전면 차단을 걸면 DNS도 막히므로 kube-system의 CoreDNS로 나가는 UDP·TCP 53을 여는 egress 정책을 함께 둔다.

### 6.6 CNI 지원

| CNI | NetworkPolicy | 왜 |
|:----|:-------------|:---|
| Calico | 지원 | iptables·eBPF로 규칙을 만든다 |
| Cilium | 지원, L7까지 | eBPF. HTTP 경로 단위 정책도 된다 |
| Flannel | 미지원 | 오버레이만 한다. 정책을 만들어도 조용히 무시된다 |
| kindnet (kind 기본) | 미지원 | 로컬 클러스터에서 정책이 안 먹는 첫 이유 |
| Weave Net | 지원했으나 저장소가 2024년 보관 상태 | 새 클러스터에는 쓰지 않는다 |

{{< callout type="warning" >}}
**정책은 CNI가 집행한다.** NetworkPolicy 오브젝트는 API 서버에 저장될 뿐이고, 그것을 방화벽 규칙으로 바꾸는 것은 [07](../07-networking)장 2.4절의 CNI 플러그인이다. 미지원 CNI에서는 `kubectl get networkpolicy`에 멀쩡히 보이면서 아무것도 안 막는다. 정책을 만들었으면 다른 파드에서 `nc -zv 상대 포트`로 막혔는지 확인한다. 클러스터 전체에 강제할 관리자 정책(AdminNetworkPolicy)은 network-policy-api 프로젝트에서 별도 CRD로 진행 중이다.
{{< /callout >}}

---

## 7. Pod Security Standards

### 7.1 SecurityContext

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:        # 파드 기본
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginx
    securityContext:  # 컨테이너 우선
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `runAsUser` / `runAsGroup` | 프로세스의 UID / GID | 컨테이너의 root는 호스트의 root와 같은 UID 0이다. 격리가 뚫리면 그대로 호스트 root다 |
| `runAsNonRoot` | UID 0이면 시작을 거부 | 이미지가 root로 돌게 만들어졌어도 막는다 |
| `allowPrivilegeEscalation` | setuid 등으로 부모보다 높은 권한을 못 얻게 | `no_new_privs` 플래그. 기본값이 true라 명시해서 끈다 |
| `readOnlyRootFilesystem` | `/`를 읽기 전용으로 | 프로그램을 바꿔치거나 도구를 내려받을 자리를 없앤다. 쓸 곳은 emptyDir로 |
| `capabilities` | 리눅스 capability를 빼고 더하기 | root의 권한은 40개 남짓의 조각이다. 다 빼고 1024 아래 포트를 열 하나만 더한다 |
| `fsGroup` | 볼륨의 그룹 소유 | 비root 프로세스가 마운트된 볼륨에 쓸 수 있게. [06](../06-storage)장 7.4절 |
| `seccompProfile` | 허용 시스템 콜 목록 | `RuntimeDefault`면 런타임의 기본 프로파일로 위험한 시스템 콜 수십 개가 막힌다 |
| `appArmorProfile` (1.31 GA) | AppArmor 프로파일 | 파일·네트워크 접근을 프로파일로 제한한다. 이전의 어노테이션 방식을 필드로 옮겼다 |
| `hostUsers: false` | 사용자 네임스페이스 | 컨테이너의 UID 0을 호스트의 다른 UID로 매핑해 root 격리 문제 자체를 푼다 |

파드 레벨 값은 컨테이너의 기본이고, 컨테이너 레벨이 덮어쓴다. 컨테이너는 격리된 프로세스이지 가상 머신이 아니다. 같은 커널을 쓰고, 컨테이너 안의 UID 0은 커널이 보기에 호스트의 UID 0이다. 그래서 `runAsNonRoot`와 `capabilities.drop: ALL`이 사실상 기본값이어야 하고, 셋째 원리의 셋째 조각이 이것이다. 컨테이너가 할 수 있는 일을 0 가까이 깎고 필요한 조각만 돌려준다.

### 7.2 세 프로파일

| 프로파일 | 막는 것 | 왜 |
|:-------|:------|:---|
| privileged | 없음 | CNI, 스토리지 드라이버, 모니터링 에이전트처럼 호스트를 만져야 하는 것 |
| baseline | hostNetwork·hostPID·hostIPC, privileged 컨테이너, hostPath 볼륨, hostPort, 목록 밖의 capability 추가, `Unconfined` seccomp, 기본이 아닌 procMount, 임의의 AppArmor·SELinux 값, 프로브·라이프사이클 훅의 host 필드(1.34부터) | 알려진 권한 상승 경로만 막는다. 대부분의 이미지가 고치지 않고 통과한다. [06](../06-storage)장 2.2절의 hostPath가 여기서 막힌다 |
| restricted | baseline에 더해 root 금지(`runAsNonRoot: true`), `allowPrivilegeEscalation: false`, `capabilities.drop: ALL`(더할 수 있는 것은 `NET_BIND_SERVICE`만), seccomp `RuntimeDefault` 또는 `Localhost` 필수, 볼륨은 configMap·secret·emptyDir·projected·downwardAPI·PVC·ephemeral·csi만 | 위 7.1절의 파드가 이 모양이다. 새 워크로드의 기본으로 삼는다 |

### 7.3 Pod Security Admission

PodSecurityPolicy는 1.25에서 없어졌고, 그 자리를 **Pod Security Admission**(1.25 GA)이 맡았다. 1절 세 번째 문의 어드미션 플러그인이고, 네임스페이스의 레이블로 세 프로파일을 건다.

| 모드 | 위반 파드에 | 왜 셋인가 |
|:-----|:---------|:-------|
| enforce | 거부 | 진짜 막는 것. 파드 오브젝트에만 걸린다 |
| audit | 통과시키되 감사 로그에 남김 | 무엇이 걸릴지 먼저 본다 |
| warn | 통과시키되 kubectl에 경고 | 개발자가 바로 보게. Deployment 같은 워크로드 오브젝트에는 warn·audit만 적용된다 |

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prod
  labels:
    pod-security.kubernetes.io/enforce:
      restricted
    pod-security.kubernetes.io/warn:
      restricted
```

| 레이블 | 값 | 왜 |
|:-----|:--|:---|
| `pod-security.kubernetes.io/enforce` | privileged, baseline, restricted | 거부할 기준 |
| `pod-security.kubernetes.io/enforce-version` | `latest` 또는 `v1.37` 같은 마이너 버전 | 프로파일 정의는 버전마다 조금씩 세진다. 고정하면 업그레이드에 안 깨진다 |
| `.../audit`, `.../warn`과 `-version` | 같은 셋 | enforce는 baseline, warn은 restricted로 두고 차츰 올리는 식으로 쓴다 |

```bash
L=pod-security.kubernetes.io
kubectl label ns prod \
  $L/enforce=restricted \
  $L/warn=restricted

# 지금 도는 파드 중 무엇이 걸릴지 미리
kubectl label --dry-run=server \
  --overwrite ns prod \
  $L/enforce=restricted
```

{{< callout type="info" >}}
**기존 네임스페이스에 restricted를 거는 순서.** 먼저 `warn`과 `audit`만 restricted로 붙여 무엇이 걸리는지 본다. `--dry-run=server`로 지금 도는 파드 중 거부될 것을 미리 볼 수도 있다. 걸리는 파드를 고친 뒤 enforce를 올린다. enforce는 새로 만들어지는 파드에만 적용되고 이미 도는 파드는 안 죽이지만, 다음 롤아웃에서 걸린다. 사용자 이름, RuntimeClass, 네임스페이스 단위의 면제는 어드미션 설정 파일에 적고, 컨트롤러의 ServiceAccount를 면제하면 그 컨트롤러로 파드를 만들 수 있는 모든 사람이 함께 면제되므로 하지 않는다.
{{< /callout >}}

---

## 8. 이미지 보안

### 8.1 이미지 이름과 태그

```text
[레지스트리]/[소유자]/[이미지]:[태그]

nginx
 → docker.io/library/nginx:latest
myco/app:v1.0
 → docker.io/myco/app:v1.0
registry.k8s.io/pause:3.10
 → 그대로
```

| 수단 | 하는 일 | 왜 |
|:-----|:------|:---|
| 레지스트리를 붙여 쓰기 | `docker.io`가 기본이라는 것을 이름에 드러낸다 | `nginx`만 쓰면 어디서 오는지 매니페스트만 봐서는 모른다 |
| 태그 대신 다이제스트 (`@sha256:...`) | 같은 태그에 다른 내용이 올라와도 안 바뀐다 | `latest`는 어제와 오늘이 다른 이미지다. 태그가 `latest`거나 없으면 `imagePullPolicy`가 `Always`로 바뀌어 매번 받아 온다 |
| 신뢰하는 레지스트리만 | 어드미션 정책으로 레지스트리 접두를 강제 | 누구나 올릴 수 있는 공개 저장소의 이미지가 그대로 도는 것을 막는다 |

### 8.2 프라이빗 레지스트리 (ImagePullSecrets)

```bash
kubectl create secret docker-registry \
  regcred \
  --docker-server=reg.example.com \
  --docker-username=me \
  --docker-password=...
```

```yaml
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: reg.example.com/myco/app:v1.0
```

[04](../04-workloads)장 9절의 `kubernetes.io/dockerconfigjson` 타입 Secret이 이것이다. 파드마다 적는 대신 ServiceAccount의 `imagePullSecrets`에 두면 5.1절의 어드미션 컨트롤러가 파드에 복사해 준다. 한 노드가 자격 증명으로 받아 둔 이미지를 자격 증명이 없는 다른 파드가 그대로 쓰는 일은 kubelet이 막는다(`KubeletEnsureSecretPulledImages`, 1.35부터 베타로 기본 켜짐).

### 8.3 서명과 스캔

| 수단 | 하는 일 | 왜 |
|:-----|:------|:---|
| 서명 (Sigstore cosign) | 이미지 다이제스트에 서명하고 어드미션에서 검증 | 레지스트리가 뚫려도 서명 없는 이미지는 안 돈다. Kyverno, Gatekeeper, Connaisseur, sigstore policy-controller가 검증한다 |
| 취약점 스캔 (Trivy, Grype, Clair) | 이미지 안의 패키지 CVE 목록 | 빌드 파이프라인에서 걸러야 클러스터에 안 들어온다 |
| 최소 베이스 이미지 (distroless, alpine) | 셸과 패키지 관리자를 뺀다 | 들어올 것도, 들어와서 할 것도 줄인다. `readOnlyRootFilesystem`과 짝 |

```bash
cosign sign --key cosign.key \
  reg.example.com/myco/app:v1.0
cosign verify --key cosign.pub \
  reg.example.com/myco/app:v1.0
trivy image \
  reg.example.com/myco/app:v1.0
```

### 8.4 Secret과 etcd 암호화

Secret의 base64는 바이너리를 YAML에 담기 위한 인코딩이지 보호가 아니다. [04](../04-workloads)장 9절대로 `base64 -d` 한 줄로 원문이 나온다. `kubectl get secret -o yaml`을 볼 수 있는 사람은 값을 다 본 것이고, etcd 파일을 읽을 수 있는 사람도 마찬가지다. 그래서 Secret의 보안은 두 군데서 온다. 4절의 RBAC로 secrets의 get·list·watch를 좁히는 것과, etcd에 쓰일 때 암호화하는 것이다.

| 제공자 | 방식 | 왜 |
|:-----|:----|:---|
| `identity` | 암호화 없음 | 기본값. 목록의 첫 제공자가 쓰기에 쓰이므로 이것이 첫째면 평문이다 |
| `aescbc`, `aesgcm`, `secretbox` | API 서버가 파일로 든 키 | 설정이 쉽다. 키가 API 서버 노드에 있다는 것이 한계 |
| `kms` v2 (1.29 GA) | 클라우드 KMS나 Vault에 키를 맡김 | 키가 클러스터 밖에 있고 회전이 된다. v1은 1.28에서 deprecated |

{{< callout type="info" >}}
**etcd 암호화.** API 서버에 `--encryption-provider-config`로 EncryptionConfiguration을 주면 Secret이 etcd에 저장될 때 암호화된다. 설정을 켠 뒤 `kubectl get secrets -A -o json | kubectl replace -f -`로 기존 Secret을 한 번 다시 써야 암호화된 채로 저장된다. 비밀 자체를 클러스터 밖에 두고 싶으면 External Secrets Operator나 Vault Agent로 필요할 때 끌어온다. 저장소에 커밋해야 한다면 Sealed Secrets나 SOPS로 암호화한 채 커밋한다.
{{< /callout >}}

---

## 9. 명령어 요약

```bash
# 인증서
openssl genrsa -out jane.key 2048
openssl req -new -key jane.key \
  -subj "/CN=jane/O=developers" \
  -out jane.csr
openssl x509 -req -in jane.csr \
  -CA ca.crt -CAkey ca.key \
  -days 365 -out jane.crt
openssl x509 -in jane.crt -noout \
  -subject -dates
openssl verify -CAfile ca.crt jane.crt

# CSR API
kubectl get csr
kubectl certificate approve jane
kubectl certificate deny jane

# kubeconfig
kubectl config get-contexts
kubectl config use-context jane@dev
kubectl config current-context
kubectl auth whoami

# RBAC
kubectl create role pod-reader \
  --verb=get,list --resource=pods
kubectl create rolebinding read-pods \
  --role=pod-reader --user=jane
kubectl create clusterrole node-reader \
  --verb=get,list --resource=nodes
kubectl create clusterrolebinding \
  read-nodes --clusterrole=node-reader \
  --group=developers
kubectl auth can-i list pods --as jane
kubectl auth can-i --list

# ServiceAccount
kubectl create serviceaccount app
kubectl create token app --duration=1h

# NetworkPolicy
kubectl get networkpolicy -n prod
kubectl describe networkpolicy db-policy

# Pod Security
L=pod-security.kubernetes.io
kubectl label ns prod \
  $L/enforce=restricted
```

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 세 개의 문 | 인증 → 인가 → 어드미션, 하나라도 막히면 끝 | 누구인지, 해도 되는지, 내용이 맞는지는 다른 질문이다 |
| 사용자 | 오브젝트가 아니라 증명에 적힌 문자열 | 인증 방식이 곧 사용자 관리 |
| X.509 | CN이 사용자, O가 그룹, CA 서명이 근거 | 이름 한 글자만 바꿔도 서명 검증 실패 |
| 인증서 인증 | TLS 핸드셰이크에서 끝난다. 취소는 없다 | LB는 TCP로 넘기고, 유효 기간은 짧게 |
| CSR API | CA 키를 안 꺼내고 서명받는다 | 승인은 사람, 서명은 컨트롤러 매니저 |
| kubeconfig | cluster + user + context | 서버도 검증하고 나도 증명한다 |
| 인가 사슬 | 허용·거부·의견 없음, 끝까지 없으면 거부 | RBAC은 허용만 말한다 |
| RBAC | Role·ClusterRole을 Binding으로 주체에. roleRef는 불변 | 네임스페이스 안과 밖, 정의와 부여를 나눈다 |
| 관리자급 권한 | pods create, secrets 읽기, escalate, bind, impersonate, CSR approve | 겉보기보다 넓다 |
| ServiceAccount | 파드의 신원. API 서버가 서명한 JWT | 페이로드는 읽히고, 한 값을 바꾸면 서명이 깨진다 |
| Projected 토큰 | 만료·대상·파드에 묶인다 | 레거시 Secret 토큰은 영원히 유효했다 |
| NetworkPolicy | 붙는 순간 허용 목록, 합집합, 양쪽 다 열려야 | CNI가 집행한다. Flannel·kindnet은 무시 |
| securityContext | 비root, 권한 상승 금지, 읽기 전용 /, capability 다 빼기, seccomp | 컨테이너의 UID 0은 호스트의 UID 0 |
| Pod Security Admission | 네임스페이스 레이블로 privileged·baseline·restricted | warn·audit로 보고 enforce로 막는다 |
| 이미지 | 레지스트리 명시, 다이제스트, 서명, 스캔 | `latest`는 어제와 오늘이 다르다 |
| Secret | base64는 인코딩 | RBAC로 좁히고 etcd를 암호화한다 |

{{< callout type="info" >}}
**용어 정리**
- **인증 (Authentication)**: 요청이 누구인지 정하는 것. 인증서, 토큰
- **인가 (Authorization)**: 그 사람이 그 동작을 해도 되는지. RBAC
- **어드미션 (Admission)**: 통과한 요청의 내용을 정책으로 고치거나 거절하는 플러그인
- **CA**: 인증서에 서명하는 키. 클러스터 신뢰의 뿌리, `ca.key`
- **CN / O**: 인증서 subject의 이름 / 조직. 쿠버네티스는 사용자 / 그룹으로 읽는다
- **CSR**: 공개키와 이름을 담아 서명을 요청하는 문서. 클러스터 안에서는 오브젝트
- **kubeconfig**: cluster, user, context를 담은 kubectl 설정 파일
- **RBAC**: Role-Based Access Control. Role과 Binding으로 권한을 더하는 방식
- **Role / ClusterRole**: 네임스페이스 안 / 클러스터 전체의 권한 정의
- **RoleBinding / ClusterRoleBinding**: 권한 정의를 주체에 붙이는 것
- **escalate / bind / impersonate**: 권한의 울타리를 넘는 세 동사
- **ServiceAccount**: 파드의 신원. 토큰이 파드에 파일로 꽂힌다
- **JWT**: 헤더.페이로드.서명. 페이로드는 읽히고 서명은 못 만든다
- **Projected 토큰**: 만료와 대상이 있고 파드에 묶인 ServiceAccount 토큰
- **NetworkPolicy**: 파드 단위 허용 목록. CNI가 집행
- **securityContext**: 컨테이너 프로세스의 UID, capability, 파일 시스템, 시스템 콜 제한
- **Pod Security Standards / Admission**: privileged·baseline·restricted 세 기준 / 그것을 네임스페이스 레이블로 강제하는 어드미션
- **capability**: 리눅스 root 권한의 조각. `NET_BIND_SERVICE`가 1024 아래 포트
- **seccomp / AppArmor**: 시스템 콜 목록 / 파일·네트워크 접근 프로파일로 컨테이너를 제한하는 커널 장치
- **EncryptionConfiguration**: Secret을 etcd에 암호화해 쓰게 하는 API 서버 설정
{{< /callout >}}
