---
title: "08. 보안"
date: 2026-04-23
weight: 8
---

앞 장까지는 클러스터를 세우고, 워크로드를 올리고, 서로 잇는 법이었다. 이 장은 그 클러스터에서 누가 무엇을 해도 되는지를 정하는 법이다. 원리는 셋이다. 첫째, **API 서버로 들어오는 모든 요청은 인증, 인가, 어드미션 세 문을 순서대로 지나고, 한 문에서 막히면 거기서 끝이다.** 인증은 누구인지, 인가는 그 사람이 그 동작을 해도 되는지, 어드미션은 그 요청이 클러스터의 정책에 맞는지를 본다. 둘째, **신원은 이름이 아니라 서명에서 온다.** 사람은 CA가 서명한 인증서의 CN과 O로, 파드는 API 서버가 서명한 토큰의 sub로 식별된다. 이름은 누구나 읽을 수 있지만 서명 없이는 한 글자도 못 바꾼다. 셋째, **권한은 0에서 시작해 필요한 만큼만 더한다.** RBAC에는 허용 규칙만 있고 거부 규칙이 없다. NetworkPolicy는 파드에 붙는 순간 명시한 트래픽만 남기고, Pod Security는 컨테이너가 리눅스에서 할 수 있는 일을 깎는다. 이 PC(Apple M4, macOS, OpenSSL 3.6)에는 클러스터가 없어서 kubectl로 잴 수 있는 것은 없다. 대신 kubeadm이 만드는 것과 같은 CA와 사용자 인증서를 openssl로 만들어 서명·만료·위조가 각각 어떻게 걸리는지, 클라이언트 인증서를 요구하는 TLS 서버가 인증서 없음·다른 CA·만료에 무슨 응답을 보내는지, ServiceAccount 토큰과 같은 구조의 JWT를 만들어 페이로드가 읽히는지와 한 값을 바꾸면 서명이 깨지는지, 그리고 Secret의 base64가 되돌려지는지를 봤다.

---

## 1. 세 개의 문: 인증, 인가, 어드미션

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
| 인증 (Authentication) | 누가 보냈나 | X.509 인증서, ServiceAccount 토큰, OIDC, 웹훅 | 누구인지 모르면 권한을 물을 수 없다 |
| 인가 (Authorization) | 그 사람이 그 동작을 해도 되나 | Node, RBAC, ABAC, 웹훅 | 신원이 정해진 뒤에야 규칙을 찾는다 |
| 어드미션 (Admission) | 요청 내용이 정책에 맞나 | PodSecurity, ResourceQuota, Mutating·Validating 웹훅 | 권한이 있어도 내용이 틀릴 수 있다. 여기서 고치거나(mutating) 거절한다(validating) |

첫째 원리다. [02](../02-core-concepts)장 2.2절의 kube-apiserver는 클러스터의 유일한 문이고, 그 문 안에 세 개의 검사가 줄지어 있다. 인증은 요청에 붙은 증명(인증서, 토큰)을 보고 "이 요청은 jane이다", "이 요청은 dev 네임스페이스의 app ServiceAccount다"로 바꾼다. 인가는 그 이름으로 "pods를 dev에서 list해도 되는가"를 규칙에 묻는다. 어드미션은 통과한 요청의 본문을 보고 "이 파드는 root로 돌려고 하는데 이 네임스페이스는 그것을 금한다"처럼 정책을 댄다. 셋 중 하나라도 거절하면 etcd에는 아무것도 안 쓰인다. 읽기 요청도 같은 문을 지난다.

| 계층 | 막는 것 | 도구 | 왜 따로 있는가 |
|:-----|:------|:-----|:-----------|
| 호스트 | 노드 자체로의 접근 | SSH 키, root 로그인 차단 | 노드에 들어오면 kubelet 인증서와 컨테이너가 다 보인다 |
| 전송 | 도청·위조 | 모든 컴포넌트 사이 TLS | etcd, API 서버, kubelet이 네트워크로 말한다 |
| API 서버 | 잘못된 요청 | 위의 세 문 | 클러스터 상태를 바꾸는 유일한 길 |
| 워크로드 | 파드가 할 수 있는 일 | Pod Security, NetworkPolicy | 통과한 파드도 컨테이너 안에서 무엇이든 하면 안 된다 |

---

## 2. 인증: 서명된 이름

### 2.1 계정의 두 종류

| 종류 | 누구 | 어디서 관리 | 왜 |
|:-----|:----|:---------|:---|
| 사용자 (User) | 사람. 관리자, 개발자 | 클러스터 밖. 인증서, LDAP, OIDC | 쿠버네티스에는 User 오브젝트가 없다. 증명에 적힌 이름이 곧 사용자다 |
| ServiceAccount | 파드. 애플리케이션, 컨트롤러 | 클러스터 안의 API 리소스 | 파드가 API 서버에 말을 걸려면 파드용 신원이 필요하다 |

쿠버네티스는 사용자를 저장하지 않는다. `kubectl get users`는 없다. 사용자는 인증서의 CN, 토큰의 sub 같은 **증명에 적힌 문자열**로만 존재하고, 그 문자열이 RBAC의 주체가 된다. 그래서 인증 방식이 곧 사용자 관리 방식이다.

### 2.2 인증 방식

| 방식 | 증명 | 권장 | 왜 |
|:-----|:----|:----|:---|
| X.509 클라이언트 인증서 | CA가 서명한 인증서. CN이 이름, O가 그룹 | 표준 | kubeadm이 관리자·컴포넌트 전부에 쓰는 방식. 서명 검증만으로 신원이 선다 |
| ServiceAccount 토큰 | API 서버가 서명한 JWT | 파드의 표준 | 파드에 자동으로 꽂힌다 (4절) |
| OIDC | 외부 IdP가 서명한 JWT | 사람이 많을 때 | 회사 SSO로 로그인하고 그룹을 IdP에서 받는다 |
| 인증 웹훅 | 외부 서비스에 토큰 검증 위임 | 특수 | 자체 토큰 체계를 붙일 때 |
| 정적 토큰·비밀번호 파일 | API 서버 플래그로 넘긴 평문 파일 | 비권장 | 바꾸려면 API 서버를 재시작해야 하고, 파일이 곧 비밀이다 |

### 2.3 X.509: CN이 사용자, O가 그룹

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

| 이 PC에서 만든 것 | 결과 | 왜 |
|:--------------|:-----|:---|
| CA (`CN=kubernetes`, 10년) | subject와 issuer가 둘 다 `CN=kubernetes` | 자기 서명. kubeadm의 `/etc/kubernetes/pki/ca.crt`가 이것이고, 클러스터 신뢰의 뿌리다 |
| jane (`/CN=jane/O=developers/O=qa`, 365일) | subject `CN=jane, O=developers, O=qa`, issuer `CN=kubernetes`, 2027-09-29 만료 | CN이 사용자 이름, O가 그룹. O는 여러 개 쓸 수 있고 RBAC의 Group 주체가 된다 |
| 파일 크기 | ca.crt 1,115 B, jane.key 1,700 B, jane.crt 1,131 B | kubeconfig에 base64로 박히는 크기가 이 정도다 |

| 검증 | 이 PC 결과 | 왜 |
|:-----|:--------|:---|
| 클러스터 CA로 검증 | OK | 서명이 CA 개인키로 만들어졌다 |
| 다른 CA로 검증 | error 20 unable to get local issuer certificate | 서명한 CA가 신뢰 목록에 없다 |
| 364일 뒤 시각으로 검증 | OK | notAfter 안이다 |
| 366일 뒤 시각으로 검증 | error 10 certificate has expired | 만료. 유효 기간도 서명 안에 있다 |
| subject의 j를 k로 바꿈 (jane → kane) | error 7 certificate signature failure | 서명은 인증서 내용 전체의 해시다. 한 비트만 달라도 깨진다 |

둘째 원리다. 인증서에 적힌 `CN=jane`은 평문이라 누구나 읽고 누구나 흉내 낼 수 있다. API 서버가 그 이름을 믿는 근거는 이름이 아니라 **CA의 서명**이다. 위 표의 마지막 줄이 그것이다. 인증서의 j 한 글자를 k로 바꾸면 서명 검증이 실패한다. 서명이 내용 전체의 해시 위에 찍혀 있어서다. 다른 CA가 `CN=jane`으로 서명한 인증서도 똑같이 거절된다. 그래서 클러스터에서 `ca.key`는 가장 무거운 파일이다. 그 키를 가진 사람은 어떤 이름의 사용자든 만들 수 있다.

```bash
# 클라이언트 인증서를 요구하는 서버
openssl s_server -accept 6443 \
  -cert server.crt -key server.key \
  -CAfile ca.crt -Verify 1 \
  -verify_return_error -www

# 인증서를 내고 접속
openssl s_client \
  -connect localhost:6443 \
  -CAfile ca.crt \
  -cert jane.crt -key jane.key
```

| 클라이언트가 낸 것 | 인증서를 요구하는 서버의 응답 (이 PC) | 왜 |
|:--------------|:------------------------------|:---|
| 인증서 없음 | alert 116 certificate required, 연결 끊김 | 익명 요청은 문 앞에서 끝난다 |
| 클러스터 CA가 서명한 jane.crt | HTTP 200, 서버 로그에 `depth=0 CN=jane, O=developers, O=qa` | 이 문자열이 그대로 사용자 jane, 그룹 developers·qa가 된다 |
| 다른 CA가 서명한 `CN=jane` | alert 48 unknown ca | 이름이 같아도 서명자가 다르면 남이다 |
| 만료된 인증서 | alert 45 certificate expired | 날짜 검사는 TLS 핸드셰이크 안에서 끝난다 |
| 핸드셰이크 반복 | 5초에 3,786회 (초당 760회, 회당 1.3 ms. 클라이언트 CPU만 치면 0.57 ms) | 서버와 클라이언트가 같은 PC에서 RSA 2048 검증을 한 번씩. 인증서 인증은 싸다 |

API 서버는 TLS 핸드셰이크에서 클라이언트 인증서를 요구하고, 서명과 날짜를 검사한 뒤 subject를 꺼내 사용자와 그룹으로 삼는다. 이 PC에서 같은 일을 하는 TLS 서버를 띄우고 네 가지를 내밀었다. 인증서가 없으면 "인증서를 내라"는 알림과 함께 끊기고, 다른 CA의 서명이면 "모르는 CA", 만료면 "만료"다. 클러스터 CA가 서명한 것만 통과하고, 그때 서버가 본 문자열 `CN=jane, O=developers, O=qa`가 곧 신원이다. 인가는 이 문자열에서 시작한다.

| 작업 | 이 PC (프로세스 시작 포함, 5회 중앙값) | 왜 |
|:-----|:----------------------------|:---|
| RSA 2048 키 생성 | 37 ms (20~57 ms) | 소수 두 개를 찾는다. 운에 따라 세 배 차이 |
| RSA 4096 키 생성 | 183 ms | 비트가 두 배면 시간은 다섯 배 |
| ECDSA P-256 키 생성 | 7.6 ms | 소수 탐색이 없다. kubeadm은 기본 RSA, 옵션으로 ECDSA |
| CSR 만들기 | 8 ms | 공개키와 이름에 자기 서명 한 번 |
| CA 서명 | 12 ms | CA 개인키 연산 한 번 |
| 검증 | 7 ms | 공개키 연산은 싸다. 그래서 핸드셰이크 한 번이 1.3 ms다 |

### 2.4 Certificates API로 발급

CA 키를 꺼내지 않고 클러스터 안에서 서명받는 길이다. CSR을 오브젝트로 올리면 관리자가 승인하고, 컨트롤러 매니저가 CA 키로 서명해 `status.certificate`에 넣어 준다.

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <base64로 인코딩한 CSR>
  signerName: >-
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
| CSR 제출 | 사용자 | 개인키는 사용자 손을 떠나지 않는다. 공개키만 보낸다 |
| 승인 | 관리자 (`certificates` 리소스의 approve 권한) | 서명은 곧 사용자 생성이라 사람이 본다 |
| 서명 | kube-controller-manager | CA 키를 가진 유일한 컴포넌트 |
| 꺼내기 | 사용자 | `status.certificate`에 base64로 들어 있다 |

### 2.5 kubeconfig: 어디에, 누구로

```yaml
apiVersion: v1
kind: Config
current-context: jane@dev
clusters:
- name: dev
  cluster:
    server: https://10.0.0.10:6443
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
| cluster | API 서버 주소와 그 서버를 검증할 CA | 서버가 진짜인지 클라이언트도 확인한다 (양방향 TLS) |
| user | 내 인증서와 키, 또는 토큰 | 같은 사람이 여러 클러스터에 같은 신원을 쓴다 |
| context | cluster + user + 기본 namespace | `use-context` 하나로 통째로 갈아탄다 |

```bash
kubectl config get-contexts
kubectl config use-context jane@prod
kubectl config view --minify
```

{{< callout type="info" >}}
**인증서는 취소가 안 된다.** 쿠버네티스 API 서버는 CRL이나 OCSP를 보지 않는다. 발급한 인증서는 만료일까지 유효하고, 퇴사자의 인증서를 "지우는" 방법은 없다. 그래서 유효 기간을 짧게 잡거나, 사람은 OIDC로 붙여 IdP에서 끊거나, 인증서가 새어 나갔으면 그 이름의 RBAC 바인딩을 지우는 수밖에 없다. 이름은 남아도 권한이 0이면 아무것도 못 한다.
{{< /callout >}}

---

## 3. 인가: 허용 규칙만 있는 세계

### 3.1 인가 모듈 사슬

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
| Node | kubelet이 자기 노드의 파드·시크릿만 | kubelet 인증서(`system:node:이름`)로 다른 노드의 비밀을 못 읽게 |
| RBAC | Role·ClusterRole과 바인딩 | 표준. 클러스터 안의 오브젝트로 관리된다 |
| ABAC | 정책 파일의 속성 규칙 | 레거시. 파일을 바꾸면 API 서버 재시작 |
| Webhook | 외부 서비스의 판단 | OPA 같은 정책 엔진을 붙일 때 |
| AlwaysAllow / AlwaysDeny | 전부 통과 / 전부 거부 | 테스트용 |

모듈은 순서대로 "허용", "거부", "의견 없음" 중 하나를 말한다. 허용이나 거부가 나오면 거기서 끝이고, 의견 없음이면 다음 모듈로 간다. 끝까지 의견이 없으면 거부다. RBAC은 거부를 말할 줄 모르고 허용 아니면 의견 없음만 말한다. 셋째 원리의 첫 조각이다. 기본이 0이고, 규칙은 더하기만 한다.

### 3.2 RBAC의 네 오브젝트

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
| ClusterRole | 클러스터 전체, 또는 nodes·namespaces처럼 네임스페이스가 없는 리소스 | ClusterRoleBinding | 노드를 읽는 권한은 네임스페이스에 속하지 않는다 |
| RoleBinding | 네임스페이스 하나 | Role 또는 ClusterRole | ClusterRole을 한 네임스페이스에만 주는 데도 쓴다. 정의는 한 번, 바인딩은 네임스페이스마다 |
| ClusterRoleBinding | 클러스터 전체 | ClusterRole | 모든 네임스페이스에 한꺼번에 |

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: dev
  name: pod-reader
rules:
- apiGroups: [""]        # core
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

```yaml
# 이름을 찍어 그 리소스만
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get"]
  resourceNames: ["blue", "green"]
```

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

2.3절의 인증서가 여기서 만난다. `CN=jane`은 `kind: User, name: jane`에, `O=developers`는 `kind: Group, name: developers`에 붙는다. 바인딩의 `roleRef`는 만든 뒤 못 바꾼다. 다른 Role을 주려면 바인딩을 지우고 새로 만든다. 권한을 준 기록이 조용히 다른 권한으로 바뀌는 일을 막기 위해서다.

### 3.3 동사

| 동사 | 뜻 | 왜 따로인가 |
|:-----|:--|:---------|
| get | 이름을 알고 하나 읽기 | 이름을 아는 사람만 |
| list | 목록 읽기 | 목록에는 오브젝트 전체가 들어 있다. list는 사실상 모든 get이다 |
| watch | 변경 스트림 받기 | 컨트롤러가 쓰는 동사. list와 함께 준다 |
| create / update / patch | 만들기 / 통째로 바꾸기 / 일부 바꾸기 | 쓰기 권한을 셋으로 쪼갠다 |
| delete / deletecollection | 하나 지우기 / 셀렉터로 여럿 지우기 | `kubectl delete pods --all`은 뒤의 것이다 |
| 서브리소스 `pods/exec`, `pods/log` | 컨테이너에 들어가기, 로그 읽기 | pods의 get과 별개. exec는 컨테이너 안의 모든 것이다 |

### 3.4 확인

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
**최소 권한과 와일드카드.** `resources: ["*"]`, `verbs: ["*"]`는 지금 있는 리소스뿐 아니라 앞으로 생길 리소스까지 허용한다. 그리고 몇몇 권한은 겉보기보다 무겁다. `pods`의 create는 그 네임스페이스의 어떤 ServiceAccount든 파드에 붙일 수 있다는 뜻이라, 그 네임스페이스에 있는 모든 ServiceAccount의 권한을 합친 것과 같다. `secrets`의 list는 모든 시크릿의 내용을 준다. 그래서 pods create와 secrets get·list, pods/exec는 관리자급 권한으로 다루고, `kubectl auth can-i --list`로 주기적으로 누가 무엇을 갖는지 본다.
{{< /callout >}}

---

## 4. ServiceAccount: 파드의 신원

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

| 이 PC에서 sa.key로 같은 구조의 토큰을 만들어 | 결과 | 왜 |
|:--------------------------------|:-----|:---|
| 헤더.페이로드.서명 세 부분으로 조립 | 866 바이트, 점 두 개로 나뉜다 | JWT 구조. 서명은 RS256, 헤더의 `kid`로 어느 키인지 |
| 페이로드를 base64로 풀기 | `sub: system:serviceaccount:development:pod-reader-sa`, `aud`, `exp`(1시간 뒤), 네임스페이스, 파드 이름이 그대로 보인다 | 인코딩이지 암호화가 아니다. 토큰을 로그에 남기면 이름이 다 보인다 |
| sa.pub으로 서명 검증 | Verified OK | API 서버가 요청마다 하는 일 |
| 페이로드의 namespace를 production으로 바꾼 뒤 검증 | Verification failure | 서명이 페이로드 전체를 덮는다. 인증서의 j → k와 같은 이유 |

| 토큰 | 만료 | 대상(aud) | 묶임 | 왜 바뀌었나 |
|:-----|:----|:--------|:----|:---------|
| 레거시 Secret 토큰 (1.24 전) | 없음 | 없음 | ServiceAccount에만 | 새어 나가면 영원히 유효하다. 1.24부터 자동 생성이 끊겼다 |
| Projected 토큰 (TokenRequest, 1.22부터 기본) | 있음 (기본 1시간, kubelet이 갱신) | 있음 | ServiceAccount + 파드 | 파드가 죽으면 토큰도 죽는다. 다른 서비스에 내밀어도 aud가 달라 안 먹는다 |

```bash
kubectl create serviceaccount app
# 손에 쥐는 단기 토큰 (1.24+)
kubectl create token app --duration=1h
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

```yaml
# API 서버에 말할 일이 없는 파드
spec:
  automountServiceAccountToken: false
  containers:
  - name: web
    image: nginx
```

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

```yaml
# 파드 하나의 권한 한 벌
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

## 5. NetworkPolicy: 붙는 순간 허용 목록

```text
정책 없음: 모두 ↔ 모두
 A ◀──▶ B ◀──▶ C

B에 정책 (from: A, port 3306)
 A ──▶ B    C ──X──▶ B
 A만 남고 C는 막힌다
```

쿠버네티스의 기본 네트워크는 [07](../07-networking)장 1.1절대로 모든 파드가 모든 파드와 통한다. NetworkPolicy는 `podSelector`로 고른 파드에 붙고, 붙는 순간 그 파드는 **정책에 적힌 트래픽만** 주고받는다. 정책이 여러 개면 합집합이다. 거부 규칙은 없고, 허용을 하나도 안 적은 정책이 곧 전면 차단이다. 셋째 원리의 둘째 조각이다.

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
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `podSelector` | 정책이 붙는 파드 | `{}`면 네임스페이스의 모든 파드 |
| `policyTypes` | Ingress, Egress 중 무엇을 다루나 | 적은 방향만 제한한다. Egress를 안 적으면 나가는 것은 그대로 |
| `ingress.from` / `egress.to` | 상대 | podSelector, namespaceSelector, ipBlock 셋 중 조합 |
| `ports` | 포트와 프로토콜 | 안 적으면 모든 포트 |

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
      cidr: 192.168.5.10/32
```

| 셀렉터 | 고르는 것 | 왜 |
|:-----|:-------|:---|
| `podSelector` | 같은 네임스페이스의 파드 | 네임스페이스를 안 적으면 내 네임스페이스다 |
| `namespaceSelector` | 다른 네임스페이스의 모든 파드 | 네임스페이스에 레이블이 있어야 한다. `kubernetes.io/metadata.name`이 자동으로 붙는다 |
| 둘을 한 항목에 | 그 네임스페이스의 그 파드 | `-`가 하나면 AND, 둘이면 OR. YAML 들여쓰기 한 칸이 뜻을 바꾼다 |
| `ipBlock` | CIDR. `except`로 뺀다 | 클러스터 밖의 상대. 파드 IP는 바뀌니 파드에는 안 쓴다 |

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

| CNI | NetworkPolicy | 왜 |
|:----|:-------------|:---|
| Calico | 지원 | iptables·eBPF로 규칙을 만든다 |
| Cilium | 지원, L7까지 | eBPF. HTTP 경로 단위 정책도 된다 |
| Weave Net | 지원 | |
| Flannel | 미지원 | 오버레이만 한다. 정책을 만들어도 조용히 무시된다 |
| kindnet (kind 기본) | 미지원 | 로컬 클러스터에서 정책이 안 먹는 첫 이유 |

{{< callout type="warning" >}}
**정책은 CNI가 집행한다.** NetworkPolicy 오브젝트는 API 서버에 저장될 뿐이고, 그것을 방화벽 규칙으로 바꾸는 것은 [07](../07-networking)장 2.4절의 CNI 플러그인이다. 미지원 CNI에서는 `kubectl get networkpolicy`에 멀쩡히 보이면서 아무것도 안 막는다. 정책을 만들었으면 반드시 다른 파드에서 `nc -zv`로 막혔는지 확인한다. 이 PC에는 클러스터가 없어 그 확인은 못 했다.
{{< /callout >}}

---

## 6. Pod Security: 컨테이너가 리눅스에서 할 수 있는 일

### 6.1 securityContext

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
| `allowPrivilegeEscalation` | setuid 등으로 부모보다 높은 권한을 못 얻게 | `no_new_privs` 플래그. 컨테이너 안에서 root가 되는 길을 끊는다 |
| `readOnlyRootFilesystem` | `/`를 읽기 전용으로 | 프로그램을 바꿔치거나 도구를 내려받을 자리를 없앤다. 쓸 곳은 emptyDir로 |
| `capabilities` | 리눅스 capability를 빼고 더하기 | root의 권한은 40개 남짓의 조각이다. 다 빼고 80번 포트를 열 하나만 더한다 |
| `fsGroup` | 볼륨의 그룹 소유 | 비root 프로세스가 마운트된 볼륨에 쓸 수 있게 |
| `seccompProfile` | 허용 시스템 콜 목록 | `RuntimeDefault`면 위험한 시스템 콜 수십 개가 막힌다 |

파드 레벨 값은 컨테이너의 기본이고, 컨테이너 레벨이 덮어쓴다. 컨테이너는 격리된 프로세스이지 가상 머신이 아니다. 같은 커널을 쓰고, 컨테이너 안의 UID 0은 커널이 보기에 호스트의 UID 0이다. 그래서 `runAsNonRoot`와 `capabilities.drop: ALL`이 사실상 기본값이어야 하고, 셋째 원리의 셋째 조각이 이것이다. 컨테이너가 할 수 있는 일을 0 가까이 깎고 필요한 조각만 돌려준다.

### 6.2 Pod Security Admission

PodSecurityPolicy는 1.25에서 없어졌고, 그 자리를 **Pod Security Admission**이 맡았다. 1절 세 번째 문의 어드미션 플러그인이고, 네임스페이스의 레이블로 세 단계 프로파일을 건다.

| 프로파일 | 막는 것 | 왜 |
|:-------|:------|:---|
| privileged | 없음 | CNI, 스토리지 드라이버, 모니터링 에이전트처럼 호스트를 만져야 하는 것 |
| baseline | 알려진 권한 상승 경로. hostNetwork, hostPID, privileged 컨테이너, 위험한 capability | 대부분의 이미지가 고치지 않고 통과한다 |
| restricted | baseline에 더해 root 금지, `allowPrivilegeEscalation: false`, `capabilities.drop: ALL`, seccomp 필수 | 위 6.1절의 파드가 이 모양이다. 새 워크로드의 기본으로 삼는다 |

| 모드 | 위반 파드에 | 왜 셋인가 |
|:-----|:---------|:-------|
| enforce | 거부 | 진짜 막는 것 |
| audit | 통과시키되 감사 로그에 남김 | 무엇이 걸릴지 먼저 본다 |
| warn | 통과시키되 kubectl에 경고 | 개발자가 바로 보게 |

```bash
kubectl label ns prod \
  pod-security.kubernetes.io/enforce\
=restricted \
  pod-security.kubernetes.io/warn\
=restricted
```

| 레이블 | 값 | 왜 |
|:-----|:--|:---|
| `pod-security.kubernetes.io/enforce` | privileged, baseline, restricted | 거부할 기준 |
| `pod-security.kubernetes.io/enforce-version` | `latest` 또는 `v1.31` | 프로파일 정의는 버전마다 조금씩 세진다. 고정하면 업그레이드에 안 깨진다 |
| `.../audit`, `.../warn` | 같은 셋 | enforce는 baseline, warn은 restricted로 두고 차츰 올리는 식으로 쓴다 |

{{< callout type="info" >}}
**기존 네임스페이스에 restricted를 거는 순서.** 먼저 `warn=restricted`와 `audit=restricted`만 붙여 무엇이 걸리는지 본다. `kubectl label --dry-run=server --overwrite ns prod pod-security.kubernetes.io/enforce=restricted`로 지금 도는 파드 중 무엇이 거부될지 미리 볼 수도 있다. 걸리는 파드를 고친 뒤 enforce를 올린다. enforce는 새로 만들어지는 파드에만 적용되고 이미 도는 파드는 안 죽이지만, 다음 롤아웃에서 걸린다.
{{< /callout >}}

---

## 7. 이미지와 시크릿

### 7.1 이미지의 출처

```text
[레지스트리]/[소유자]/[이미지]:[태그]

nginx
 → docker.io/library/nginx:latest
myco/app:v1.0
 → docker.io/myco/app:v1.0
gcr.io/proj/app:v1.0
 → 그대로
```

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

| 수단 | 하는 일 | 왜 |
|:-----|:------|:---|
| 레지스트리를 붙여 쓰기 | `docker.io`가 기본이라는 것을 이름에 드러낸다 | `nginx`만 쓰면 어디서 오는지 매니페스트만 봐서는 모른다 |
| 태그 대신 다이제스트 (`@sha256:...`) | 같은 태그에 다른 내용이 올라와도 안 바뀐다 | `latest`는 어제와 오늘이 다른 이미지다 |
| imagePullSecrets | 사설 레지스트리 자격 증명 | ServiceAccount에 붙여 두면 파드마다 안 적어도 된다 |
| 서명 (Sigstore cosign) | 이미지 다이제스트에 서명하고 어드미션에서 검증 | 레지스트리가 뚫려도 서명 없는 이미지는 안 돈다. Kyverno, Gatekeeper, Connaisseur가 검증한다 |
| 취약점 스캔 (Trivy, Grype, Clair) | 이미지 안의 패키지 CVE 목록 | 빌드 파이프라인에서 걸러야 클러스터에 안 들어온다 |

```bash
cosign sign --key cosign.key \
  reg.example.com/myco/app:v1.0
cosign verify --key cosign.pub \
  reg.example.com/myco/app:v1.0
trivy image \
  reg.example.com/myco/app:v1.0
```

### 7.2 Secret은 인코딩일 뿐이다

| 이 PC에서 | 결과 | 왜 |
|:--------|:-----|:---|
| `printf p@ssw0rd \| base64` | `cEBzc3cwcmQ=` | [04](../04-workloads)장 9절의 Secret `data`에 들어가는 모양 |
| `base64 -d` | `p@ssw0rd` | 키가 없다. 누구나 되돌린다 |

Secret의 base64는 바이너리를 YAML에 담기 위한 인코딩이지 보호가 아니다. `kubectl get secret -o yaml`을 볼 수 있는 사람은 값을 다 본 것이고, etcd 파일을 읽을 수 있는 사람도 마찬가지다. 그래서 Secret의 보안은 두 군데서 온다. 3절의 RBAC로 secrets의 get·list를 좁히는 것과, etcd에 쓰일 때 암호화하는 것이다.

{{< callout type="info" >}}
**etcd 암호화.** API 서버에 `--encryption-provider-config`로 EncryptionConfiguration을 주면 Secret이 etcd에 저장될 때 암호화된다. `aescbc`·`aesgcm`은 키를 API 서버가 파일로 들고, `kms`는 클라우드 KMS나 Vault에 키를 맡긴다. 설정을 켠 뒤 `kubectl get secrets -A -o json | kubectl replace -f -`로 기존 Secret을 한 번 다시 써야 암호화된 채로 저장된다. 비밀 자체를 클러스터 밖에 두고 싶으면 External Secrets Operator나 Vault Agent로 필요할 때 끌어온다.
{{< /callout >}}

---

## 8. 명령어 요약

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
kubectl label ns prod \
  pod-security.kubernetes.io/enforce\
=restricted
```

---

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 세 개의 문 | 인증 → 인가 → 어드미션, 하나라도 막히면 끝 | 누구인지, 해도 되는지, 내용이 맞는지는 다른 질문이다 |
| 사용자 | 오브젝트가 아니라 증명에 적힌 문자열 | 인증 방식이 곧 사용자 관리 |
| X.509 | CN이 사용자, O가 그룹, CA 서명이 근거 | 이 PC에서 j → k 한 글자에 서명 검증 실패 |
| 인증서 인증 | TLS 핸드셰이크에서 끝난다 | 없음 116, 다른 CA 48, 만료 45. 초당 760회 |
| CSR API | CA 키를 안 꺼내고 서명받는다 | 승인은 사람, 서명은 컨트롤러 매니저 |
| kubeconfig | cluster + user + context | 서버도 검증하고 나도 증명한다 |
| 인가 사슬 | 허용·거부·의견 없음, 끝까지 없으면 거부 | RBAC은 허용만 말한다 |
| RBAC | Role·ClusterRole을 Binding으로 주체에 | 네임스페이스 안과 밖, 정의와 부여를 나눈다 |
| 무거운 동사 | pods create, secrets list, pods/exec | 겉보기보다 넓다 |
| ServiceAccount | 파드의 신원. API 서버가 서명한 JWT | 페이로드는 읽히고, 한 값을 바꾸면 서명이 깨진다 |
| Projected 토큰 | 만료·대상·파드에 묶인다 | 새어 나가도 오래 못 쓴다 |
| NetworkPolicy | 붙는 순간 허용 목록, 합집합 | CNI가 집행한다. Flannel·kindnet은 무시 |
| securityContext | 비root, 권한 상승 금지, 읽기 전용 /, capability 다 빼기 | 컨테이너의 UID 0은 호스트의 UID 0 |
| Pod Security Admission | 네임스페이스 레이블로 privileged·baseline·restricted | warn·audit로 보고 enforce로 막는다 |
| Secret | base64는 인코딩 | RBAC로 좁히고 etcd를 암호화한다 |

{{< callout type="info" >}}
**용어 정리**
- **인증 (Authentication)**: 요청이 누구인지 정하는 것. 인증서, 토큰
- **인가 (Authorization)**: 그 사람이 그 동작을 해도 되는지. RBAC
- **어드미션 (Admission)**: 통과한 요청의 내용을 정책으로 고치거나 거절하는 플러그인
- **CA**: 인증서에 서명하는 키. 클러스터 신뢰의 뿌리, `ca.key`
- **CN / O**: 인증서 subject의 이름 / 조직. 쿠버네티스는 사용자 / 그룹으로 읽는다
- **CSR**: 공개키와 이름을 담아 서명을 요청하는 문서
- **kubeconfig**: cluster, user, context를 담은 kubectl 설정 파일
- **RBAC**: Role-Based Access Control. Role과 Binding으로 권한을 더하는 방식
- **Role / ClusterRole**: 네임스페이스 안 / 클러스터 전체의 권한 정의
- **RoleBinding / ClusterRoleBinding**: 권한 정의를 주체에 붙이는 것
- **ServiceAccount**: 파드의 신원. 토큰이 파드에 파일로 꽂힌다
- **JWT**: 헤더.페이로드.서명. 페이로드는 읽히고 서명은 못 만든다
- **Projected 토큰**: 만료와 대상이 있고 파드에 묶인 ServiceAccount 토큰
- **NetworkPolicy**: 파드 단위 허용 목록. CNI가 집행
- **securityContext**: 컨테이너 프로세스의 UID, capability, 파일 시스템 제한
- **Pod Security Admission**: 네임스페이스 레이블로 securityContext 기준을 강제하는 어드미션
- **capability**: 리눅스 root 권한의 조각. `NET_BIND_SERVICE`가 1024 아래 포트
- **EncryptionConfiguration**: Secret을 etcd에 암호화해 쓰게 하는 API 서버 설정
{{< /callout >}}

---

## 참고 자료

- Kubernetes 공식 문서: Authenticating, Using RBAC Authorization, Managing Service Accounts, Network Policies, Pod Security Standards, Pod Security Admission, Encrypting Confidential Data at Rest
- CKA 커리큘럼: Security 영역 (Authentication, Authorization, RBAC, NetworkPolicy, Pod Security)
- Sigstore 문서: cosign sign / verify
