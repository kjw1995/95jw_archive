---
title: "11. Helm"
weight: 11
---

## 1. Helm의 개념

**Helm**은 Kubernetes의 패키지 매니저로, 여러 리소스를 하나의 Chart로 묶어 설치, 업그레이드, 롤백을 단일 명령으로 처리한다. `kubectl apply`를 반복하는 대신 `helm install`로 전체 애플리케이션 라이프사이클을 관리할 수 있다.

```text
[수동 배포]               [Helm]
kubectl apply -f a.yaml   helm install app ./chart
kubectl apply -f b.yaml   (Chart 하나로 통합 배포)
kubectl apply -f c.yaml
 → 버전·롤백 수동          → Revision으로 자동 추적
```

| 기능 | 설명 |
|:---|:---|
| 패키지 관리 | 여러 매니페스트를 하나의 Chart로 묶음 |
| 릴리스 관리 | Revision 기반 업그레이드·롤백 |
| 설정 중앙화 | values.yaml로 환경별 설정 분리 |
| 의존성 관리 | Subchart 자동 다운로드·배포 |

## 2. Helm 2 vs Helm 3

Helm 2는 클러스터 내부의 **Tiller** 서버를 거쳐 API와 통신해 보안 문제가 컸다. Helm 3에서 Tiller가 제거되고 CLI가 직접 Kubernetes API를 호출한다.

```text
[Helm 2]                  [Helm 3]
  CLI                       CLI
   │                         │
   ▼                         │
 Tiller (God mode)           │
   │                         ▼
   ▼                      K8s API
 K8s API                   (RBAC)
```

| 항목 | Helm 2 | Helm 3 |
|:---|:---|:---|
| 아키텍처 | CLI → Tiller → API | CLI → API 직접 |
| 권한 | Tiller 전역 권한 | 사용자 RBAC |
| Chart API | v1 | v2 (dependencies, type) |
| Merge 전략 | Two-way | Three-way (Live State 반영) |

Three-way Merge는 이전 Chart, 현재 Chart, 클러스터의 Live State를 함께 비교하므로 `kubectl`로 수동 변경된 내용도 인지하여 안전하게 롤백할 수 있다.

## 3. 핵심 구성요소

```text
┌────────────────────────────┐
│       Repository           │
│   (charts.bitnami.com)     │
└────────────┬───────────────┘
             │ pull
             ▼
┌────────────────────────────┐
│          Chart             │
│  Chart.yaml / values.yaml  │
│  templates/                │
└────────────┬───────────────┘
             │ install
             ▼
┌────────────────────────────┐
│         Release            │
│  Revision 1, 2, 3 ...      │
│  (Secret에 저장)            │
└────────────────────────────┘
```

| 용어 | 설명 | 비유 |
|:---|:---|:---|
| Chart | 애플리케이션 패키지 | 설치 프로그램 |
| Release | Chart의 실행 인스턴스 | 설치된 프로그램 |
| Revision | Release의 스냅샷 | 프로그램 버전 |
| Repository | Chart 저장소 | 앱스토어 |
| values.yaml | 설정 파일 | 설치 옵션 |

동일 Chart로 여러 Release를 독립적으로 만들 수 있다. 예: `prod-wordpress`, `dev-wordpress`는 서로 다른 Revision 이력을 갖는다.

## 4. 설치

```bash
# 공식 스크립트
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 패키지 매니저
brew install helm                # macOS
sudo dnf install helm            # RHEL 계열
choco install kubernetes-helm    # Windows

# 확인
helm version
```

## 5. Chart 구조

```text
my-chart/
├── Chart.yaml        # 메타데이터
├── values.yaml       # 기본 설정
├── charts/           # Subchart
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl  # 헬퍼 함수
│   ├── NOTES.txt     # 설치 후 안내
│   └── tests/        # helm test 대상
└── .helmignore
```

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
version: 1.0.0          # Chart 버전 (SemVer)
appVersion: "2.0.0"     # 애플리케이션 버전
type: application       # application | library
dependencies:
  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

| 필드 | 대상 | 변경 시점 |
|:---|:---|:---|
| version | Chart 자체 | 템플릿·values 수정 시 |
| appVersion | 배포 대상 앱 | 컨테이너 이미지 태그 변경 시 |

{{< callout type="info" >}}
**Chart versioning 규칙**
Chart 릴리스 시 `version`을 반드시 올려야 리포지토리에서 새 Chart로 인식한다. `appVersion`만 바꾸고 `version`을 그대로 두면 배포 이력이 혼란스러워진다. SemVer를 지켜 Breaking change는 Major를 올리자.
{{< /callout >}}

## 6. 템플릿 문법

Helm은 Go Template 엔진으로 Kubernetes 매니페스트를 렌더링한다.

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount | default 1 }}
  template:
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        ports:
        - containerPort: {{ .Values.service.port }}
```

### 내장 객체

| 객체 | 설명 | 예시 |
|:---|:---|:---|
| `.Values` | values.yaml 값 | `.Values.replicaCount` |
| `.Release` | 릴리스 정보 | `.Release.Name`, `.Release.Namespace` |
| `.Chart` | Chart.yaml 값 | `.Chart.Name`, `.Chart.AppVersion` |
| `.Capabilities` | 클러스터 기능 | `.Capabilities.KubeVersion` |

### 제어 구문

```yaml
# 조건
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
{{- end }}

# 반복
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}

# 필수값
image: {{ required "image.repository is required" .Values.image.repository }}

# 파이프라인
name: {{ .Values.name | lower | trunc 63 | trimSuffix "-" }}
```

### 헬퍼 템플릿

```yaml
# templates/_helpers.tpl
{{- define "myapp.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "myapp.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}
```

## 7. 값 오버라이드 우선순위

여러 경로로 값을 주입할 수 있고, 뒤쪽이 앞쪽을 덮어쓴다.

```text
낮음 ─────────────────────────► 높음
Chart values.yaml
  → -f values-default.yaml
    → -f values-production.yaml
      → --set key=value
        → --set-file key=@file
```

```bash
# 여러 -f 지정 시 뒤에 나온 파일이 우선
helm install app bitnami/nginx \
  -f values-default.yaml \
  -f values-production.yaml \
  --set replicaCount=5
```

{{< callout type="warning" >}}
**values.yaml 오버라이드 순서 주의**
`-f`로 여러 파일을 넘길 때 **왼쪽 → 오른쪽** 순서로 병합되므로, 환경별 파일을 뒤에 두어야 한다. `--set`은 항상 가장 마지막에 적용되므로 CI 파이프라인에서 실수로 덮어쓰이지 않도록 태그·시크릿만 `--set`으로 주입하는 규칙을 둔다.
{{< /callout >}}

### --set 문법

```bash
--set replicaCount=3
--set image.repository=nginx,image.tag=1.21
--set env[0].name=FOO,env[0].value=bar
--set password="my\,password"
```

## 8. 기본 명령어

### Repository

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm repo list
helm repo remove bitnami
```

### 검색·조회

```bash
helm search hub wordpress           # Artifact Hub 전체
helm search repo wordpress          # 로컬 등록 repo
helm show chart bitnami/wordpress
helm show values bitnami/wordpress
```

### 설치·삭제

```bash
helm install my-app bitnami/wordpress \
  -n prod --create-namespace \
  --version 15.0.0 \
  -f prod-values.yaml

helm uninstall my-app -n prod
```

### Release 조회

```bash
helm list -A           # 모든 네임스페이스
helm status my-app
helm history my-app
helm get values my-app
helm get manifest my-app
```

## 9. 업그레이드와 롤백

```bash
# 업그레이드 (없으면 설치)
helm upgrade --install my-app bitnami/nginx \
  -f values.yaml --version 15.1.0

# 이전 Revision으로 롤백
helm rollback my-app          # 직전 Revision
helm rollback my-app 2        # 특정 Revision
helm rollback my-app 2 --dry-run
```

```text
helm install  ──► Revision 1 (nginx:1.19)
helm upgrade  ──► Revision 2 (nginx:1.21)
helm upgrade  ──► Revision 3 (nginx:1.23)
helm rollback 1 ─► Revision 4 (nginx:1.19)
                   (Revision 1 복사로 신규 생성)
```

| 롤백으로 복구됨 | 복구되지 않음 |
|:---|:---|
| Deployment, Service 등 리소스 정의 | PersistentVolume 데이터 |
| ConfigMap, Secret 내용 | 외부 DB 레코드 |
| Pod 설정 | 앱이 쓴 파일 |

{{< callout type="warning" >}}
`helm rollback`은 Kubernetes 리소스 스펙만 되돌린다. DB 스키마 변경이나 볼륨 데이터는 별도 백업·마이그레이션 스크립트로 역전해야 한다.
{{< /callout >}}

## 10. Hooks와 Tests

Helm은 Release 라이프사이클의 특정 시점에 리소스를 실행하기 위한 **Hook** 메커니즘을 제공한다. 어노테이션으로 지정한다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: myapp/migrator:1.0
        command: ["./migrate.sh"]
```

| Hook | 실행 시점 |
|:---|:---|
| pre-install / post-install | install 전·후 |
| pre-upgrade / post-upgrade | upgrade 전·후 |
| pre-delete / post-delete | uninstall 전·후 |
| pre-rollback / post-rollback | rollback 전·후 |
| test | `helm test` 실행 시 |

### helm test

`templates/tests/` 하위에 `helm.sh/hook: test` 어노테이션이 달린 Pod를 두면, 설치 후 연결 검증을 수행할 수 있다.

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "myapp.fullname" . }}-test"
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: curl
      image: curlimages/curl
      command: ['curl']
      args: ['{{ include "myapp.fullname" . }}:{{ .Values.service.port }}']
```

```bash
helm test my-app
```

## 11. Helm vs Kustomize

두 도구 모두 Kubernetes 매니페스트를 재사용하지만 접근 방식이 다르다.

```text
[Helm]                    [Kustomize]
Go Template + values     Overlay 합성 (patch)
패키지 배포 (.tgz)         kubectl 내장
Release 이력 관리         이력 없음 (GitOps에 위임)
```

| 항목 | Helm | Kustomize |
|:---|:---|:---|
| 방식 | Template 렌더링 | Overlay + Patch |
| 학습 곡선 | Go Template, 함수 | YAML만 |
| 배포 아티팩트 | Chart (.tgz) | 소스 디렉터리 |
| 릴리스 이력 | Revision Secret | 별도 관리 필요 |
| 의존성 | Chart dependencies | components |
| 적합 | 재사용 패키지 배포 | 환경별 커스터마이즈 |

{{< callout type="info" >}}
**Helm vs Kustomize 선택 기준**
- 외부 배포·공유용 패키지라면 **Helm** (버저닝·Repository·Release 이력).
- 조직 내부에서 환경별로 같은 매니페스트를 조금씩 수정해 쓴다면 **Kustomize** (Template 문법 없이 patch만으로 충분).
- ArgoCD는 둘 다 지원하므로 **Helm Chart를 Kustomize로 감싸는 방식**도 현업에서 자주 쓴다 (`helm template` → `kustomize build`).
{{< /callout >}}

## 12. 디버깅과 검증

```bash
# 실제 설치 없이 렌더링 결과 확인
helm template my-app ./chart -f values.yaml

# 설치 시뮬레이션
helm install my-app ./chart --dry-run --debug

# Chart 문법 검사
helm lint ./chart

# 배포된 매니페스트·values 확인
helm get manifest my-app
helm get values my-app --all
```

## 13. Chart 생성과 패키징

```bash
helm create my-app                # 스캐폴딩
helm dependency update ./my-app   # Subchart 다운로드
helm package ./my-app             # my-app-1.0.0.tgz
helm package ./my-app -d ./dist --version 1.0.0
```

## 14. Chart 안티패턴

실전에서 자주 마주치는 Chart 설계 실수를 정리한다.

| 안티패턴 | 문제 | 개선 |
|:---|:---|:---|
| 이미지 태그를 `latest`로 고정 | Revision 롤백해도 이미지가 동일 | `appVersion` 또는 명시적 태그 사용 |
| values 없이 하드코딩 | 환경별 재사용 불가 | 모든 상수를 `.Values`로 노출 |
| Secret을 values.yaml 평문 저장 | Git 유출 위험 | Sealed Secrets / External Secrets 조합 |
| `version` 미증가 재배포 | Repository 캐시가 갱신되지 않음 | 반드시 SemVer 증가 |
| 거대 `_helpers.tpl` | 디버깅 어려움 | 역할별로 분리, 네이밍 일관성 |
| CRD를 `templates/`에 둠 | upgrade 시 Helm이 미갱신 | `crds/` 디렉터리 사용 |
| `helm.sh/hook-delete-policy` 누락 | Job이 누적 | `hook-succeeded` 지정 |

## 15. 실전 예제 - WordPress

```bash
# 1. Repository 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 2. 커스텀 values 작성
cat <<EOF > my-wordpress-values.yaml
wordpressUsername: admin
wordpressBlogName: "My Tech Blog"
mariadb:
  auth:
    rootPassword: mariadb-root-password
service:
  type: LoadBalancer
persistence:
  enabled: true
  size: 10Gi
EOF

# 3. 설치
helm install my-blog bitnami/wordpress \
  -f my-wordpress-values.yaml \
  -n wordpress --create-namespace

# 4. 검증
helm status my-blog -n wordpress
helm test my-blog -n wordpress
kubectl get pods,svc -n wordpress
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Helm | Kubernetes 패키지 매니저 |
| Chart / Release / Revision | 패키지 / 설치 인스턴스 / 버전 스냅샷 |
| values.yaml | 설정 중앙화, 환경별 `-f` 오버라이드 |
| 우선순위 | `-f 먼저 → -f 나중 → --set` 순 적용 |
| upgrade --install | 멱등성 있는 배포 명령 |
| rollback | K8s 리소스만 복구 (데이터 별도) |
| hooks | install/upgrade/delete/test 시점 훅 |
| Helm vs Kustomize | 패키지 배포 vs 환경별 Overlay |

{{< callout type="info" >}}
**용어 정리**
- **Chart**: Kubernetes 매니페스트를 템플릿화한 패키지 단위
- **Release**: 클러스터에 설치된 Chart 인스턴스 (이름으로 식별)
- **Revision**: Release의 버전 스냅샷, Secret으로 저장
- **Repository**: Chart 배포 저장소 (HTTP/OCI)
- **values.yaml**: Chart의 기본 설정 값
- **Hook**: 라이프사이클 특정 시점에 실행되는 리소스
- **Three-way Merge**: 이전·현재·Live 상태 비교 병합
- **Artifact Hub**: 공용 Helm Chart 검색 허브
{{< /callout >}}
