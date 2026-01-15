---
title: "Helm Basics"
weight: 11
---

Kubernetes 패키지 매니저 Helm의 기본 개념, Chart 구조, 설치/업그레이드/롤백 방법을 다룹니다.

---

## 1. Helm 개요

### 1.1 Helm이란?

Helm은 **Kubernetes의 패키지 매니저**입니다. 여러 Kubernetes 리소스를 하나의 패키지(Chart)로 관리합니다.

```
┌──────────────────────────────────────────────────────────────┐
│                    수동 배포 vs Helm                          │
├───────────────────────────┬──────────────────────────────────┤
│       수동 배포            │           Helm                   │
├───────────────────────────┼──────────────────────────────────┤
│ 객체별 YAML 파일 관리      │ 하나의 Chart로 통합               │
│ kubectl apply 반복 실행    │ helm install 한 번               │
│ 수정 시 각 파일 개별 편집  │ values.yaml 한 곳에서 관리        │
│ 버전 관리 어려움           │ Revision으로 자동 추적            │
│ 롤백 수동 처리             │ helm rollback 명령어              │
│ 삭제 시 각 객체 개별 삭제  │ helm uninstall로 전체 제거        │
└───────────────────────────┴──────────────────────────────────┘
```

### 1.2 Helm의 주요 기능

| 기능 | 설명 |
|:-----|:-----|
| **패키지 관리** | 애플리케이션 설치/제거 자동화 |
| **릴리스 관리** | 버전 관리, 업그레이드, 롤백 |
| **설정 관리** | values.yaml로 중앙화된 설정 |
| **의존성 관리** | 복잡한 앱의 의존 Chart 자동 처리 |

### 1.3 비유로 이해하기

```
게임 설치 프로그램 = Helm
├── 수천 개의 파일 (실행파일, 오디오, 그래픽)
├── 설치 프로그램이 자동으로 올바른 위치에 배치
└── 사용자는 "설치" 버튼만 클릭

Kubernetes 애플리케이션 = 게임
├── 여러 YAML 파일 (Deployment, Service, ConfigMap...)
├── Helm이 자동으로 올바른 순서로 배포
└── 사용자는 "helm install" 명령어만 실행
```

---

## 2. Helm 2 vs Helm 3

### 2.1 주요 변경사항

```
Helm 2 (2016)              Helm 3 (2019)
┌─────────────┐            ┌─────────────┐
│  Helm CLI   │            │  Helm CLI   │
└──────┬──────┘            └──────┬──────┘
       │                          │
       ▼                          │
┌─────────────┐                   │
│   Tiller    │  ← 제거됨         │
│ (클러스터   │                   │
│  내부 구성  │                   │
│   요소)     │                   │
└──────┬──────┘                   │
       │                          │
       ▼                          ▼
┌─────────────┐            ┌─────────────┐
│ Kubernetes  │            │ Kubernetes  │
│     API     │            │     API     │
└─────────────┘            └─────────────┘
```

### 2.2 Tiller 제거

| 항목 | Helm 2 | Helm 3 |
|:-----|:-------|:-------|
| **아키텍처** | CLI → Tiller → API | CLI → API (직접) |
| **보안** | Tiller가 "God mode" 권한 | Kubernetes RBAC 직접 사용 |
| **설치** | Tiller 배포 필요 | CLI만 설치 |

### 2.3 Three-way Strategic Merge Patch

```
Helm 2 (Two-way):
┌──────────────┐     ┌──────────────┐
│ 이전 차트     │ ←→  │ 현재 차트     │
└──────────────┘     └──────────────┘
      │
      └── 문제: kubectl로 수동 변경한 내용 무시

Helm 3 (Three-way):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 이전 차트     │ ←→  │ 현재 차트     │ ←→  │  Live State  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                    수동 변경사항도 인식하여
                                    정확한 롤백 가능
```

### 2.4 Chart API 버전

| Helm 버전 | apiVersion | 특징 |
|:----------|:-----------|:-----|
| Helm 2 | v1 또는 없음 | 제한적 기능 |
| Helm 3 | **v2** | dependencies, type 필드 지원 |

---

## 3. Helm 구성요소

### 3.1 핵심 개념

```
┌──────────────────────────────────────────────────────────────┐
│                    Helm 구성요소 관계                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Repository ──────────────────────────────────────┐         │
│   (Chart 저장소)                                    │         │
│        │                                            │         │
│        ▼                                            │         │
│   ┌─────────┐    helm install    ┌─────────┐       │         │
│   │  Chart  │ ─────────────────► │ Release │       │         │
│   │ (패키지) │                    │ (인스턴스)│       │         │
│   └─────────┘                    └────┬────┘       │         │
│        │                              │            │         │
│        │ templates/                   │            │         │
│        │ values.yaml                  ▼            │         │
│        │                         ┌─────────┐      │         │
│        └────────────────────────►│Revision │      │         │
│                                  │ (버전)   │      │         │
│                                  └─────────┘      │         │
│                                       │           │         │
│                                       ▼           │         │
│                                  Kubernetes       │         │
│                                  Secret에 저장    │         │
│                                                   │         │
└───────────────────────────────────────────────────┘         │
```

### 3.2 용어 정리

| 용어 | 설명 | 비유 |
|:-----|:-----|:-----|
| **Chart** | 애플리케이션 패키지 | 설치 프로그램 |
| **Release** | Chart의 실행 인스턴스 | 설치된 프로그램 |
| **Revision** | Release의 스냅샷 | 프로그램 버전 |
| **Repository** | Chart 저장소 | 앱스토어 |
| **values.yaml** | 설정 파일 | 설치 옵션 |

### 3.3 Release와 Revision 관계

```bash
# 동일 Chart로 여러 Release 생성 가능
helm install prod-wordpress bitnami/wordpress
helm install dev-wordpress bitnami/wordpress

# 각 Release는 독립적으로 관리
# 각 Release는 자체 Revision 이력 보유
```

```
Release: prod-wordpress
├── Revision 1 (install)
├── Revision 2 (upgrade)
└── Revision 3 (rollback)

Release: dev-wordpress
├── Revision 1 (install)
└── Revision 2 (upgrade)
```

---

## 4. Helm 설치

### 4.1 스크립트 설치 (권장)

```bash
# 공식 스크립트로 설치
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 4.2 패키지 매니저로 설치

```bash
# macOS (Homebrew)
brew install helm

# Ubuntu/Debian
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update
sudo apt-get install helm

# CentOS/RHEL
sudo dnf install helm

# Windows (Chocolatey)
choco install kubernetes-helm
```

### 4.3 설치 확인

```bash
helm version

# 출력 예시
# version.BuildInfo{Version:"v3.14.0", GitCommit:"...", ...}
```

---

## 5. Chart 구조

### 5.1 디렉토리 구조

```
my-chart/
├── Chart.yaml          # Chart 메타데이터 (필수)
├── values.yaml         # 기본 설정값 (필수)
├── charts/             # 의존성 Chart (선택)
├── templates/          # 템플릿 파일들 (필수)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── _helpers.tpl    # 템플릿 헬퍼 함수
│   ├── NOTES.txt       # 설치 후 안내 메시지
│   └── tests/          # 테스트 파일
│       └── test-connection.yaml
├── LICENSE             # 라이선스 (선택)
├── README.md           # 문서 (선택)
└── .helmignore         # 무시할 파일 패턴 (선택)
```

### 5.2 Chart.yaml

```yaml
apiVersion: v2                    # Helm 3용 (필수)
name: my-app                      # Chart 이름 (필수)
version: 1.0.0                    # Chart 버전 (필수)
appVersion: "2.0.0"               # 애플리케이션 버전
description: My application chart
type: application                 # application 또는 library
keywords:
  - web
  - nginx
maintainers:
  - name: John Doe
    email: john@example.com
home: https://example.com
icon: https://example.com/icon.png
dependencies:                     # 의존 Chart
  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### 5.3 버전 구분

| 필드 | 대상 | 예시 |
|:-----|:-----|:-----|
| `version` | Chart 자체 | 1.2.3 (Chart 수정 시 변경) |
| `appVersion` | 배포되는 앱 | 5.9.0 (WordPress 버전) |

---

## 6. 템플릿 문법

### 6.1 기본 문법 (Go Template)

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
    release: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        ports:
        - containerPort: {{ .Values.service.port }}
```

```yaml
# values.yaml
replicaCount: 3
image:
  repository: nginx
  tag: "1.21"
service:
  port: 80
```

### 6.2 내장 객체

| 객체 | 설명 | 예시 |
|:-----|:-----|:-----|
| `.Values` | values.yaml 값 | `{{ .Values.replicaCount }}` |
| `.Release` | 릴리스 정보 | `{{ .Release.Name }}` |
| `.Chart` | Chart.yaml 정보 | `{{ .Chart.Name }}` |
| `.Capabilities` | 클러스터 기능 | `{{ .Capabilities.KubeVersion }}` |
| `.Template` | 템플릿 정보 | `{{ .Template.Name }}` |

### 6.3 조건문과 반복문

```yaml
# 조건문 (if)
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}-ingress
spec:
  rules:
  - host: {{ .Values.ingress.host }}
{{- end }}

# 반복문 (range)
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}

# 기본값 (default)
replicas: {{ .Values.replicaCount | default 1 }}

# 필수값 (required)
image: {{ required "image.repository is required" .Values.image.repository }}
```

### 6.4 파이프라인과 함수

```yaml
# 문자열 함수
name: {{ .Values.name | lower | trunc 63 }}
label: {{ .Values.label | quote }}
name: {{ .Values.name | default "myapp" }}

# 숫자 함수
port: {{ .Values.port | int }}

# 리스트/딕셔너리 함수
{{- toYaml .Values.resources | nindent 12 }}

# 인코딩
data:
  password: {{ .Values.password | b64enc }}
```

### 6.5 헬퍼 템플릿 (_helpers.tpl)

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

# 사용
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
```

---

## 7. Helm 기본 명령어

### 7.1 Repository 관리

```bash
# 저장소 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add stable https://charts.helm.sh/stable

# 저장소 목록
helm repo list

# 저장소 업데이트 (중요!)
helm repo update

# 저장소 제거
helm repo remove bitnami
```

### 7.2 Chart 검색

```bash
# Artifact Hub 검색 (전체)
helm search hub wordpress

# 로컬 저장소 검색
helm search repo wordpress

# 모든 버전 표시
helm search repo wordpress --versions
```

### 7.3 Chart 정보 확인

```bash
# Chart 정보
helm show chart bitnami/wordpress

# values.yaml 확인
helm show values bitnami/wordpress

# 전체 정보 (README 포함)
helm show all bitnami/wordpress
```

### 7.4 설치/삭제

```bash
# 기본 설치
helm install my-release bitnami/wordpress

# 네임스페이스 지정
helm install my-release bitnami/wordpress -n production

# 네임스페이스 생성과 함께 설치
helm install my-release bitnami/wordpress -n production --create-namespace

# 특정 버전 설치
helm install my-release bitnami/wordpress --version 15.0.0

# 삭제
helm uninstall my-release

# 네임스페이스와 함께 삭제
helm uninstall my-release -n production
```

### 7.5 Release 관리

```bash
# Release 목록
helm list
helm list -A  # 모든 네임스페이스
helm list -a  # 삭제 예정 포함

# Release 상태
helm status my-release

# Release 이력
helm history my-release
```

---

## 8. 값 커스터마이징

### 8.1 세 가지 방법

```
┌──────────────────────────────────────────────────────────────┐
│                    값 커스터마이징 방법                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  방법 1: --set 옵션 (1-2개 값 변경)                           │
│  ────────────────────────────────────                        │
│  helm install my-wp bitnami/wordpress \                      │
│    --set wordpressBlogName="My Blog" \                       │
│    --set replicaCount=3                                      │
│                                                               │
│  방법 2: --values 파일 (여러 값 변경)                         │
│  ──────────────────────────────────                          │
│  helm install my-wp bitnami/wordpress \                      │
│    --values custom-values.yaml                               │
│                                                               │
│  방법 3: Chart 수정 (완전한 제어)                             │
│  ──────────────────────────                                  │
│  helm pull bitnami/wordpress --untar                         │
│  vim wordpress/values.yaml                                   │
│  helm install my-wp ./wordpress                              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 우선순위

```
높음 ◄─────────────────────────────────────────────► 낮음

--set 옵션  >  --values 파일  >  Chart의 values.yaml
```

### 8.3 --set 문법

```bash
# 단일 값
--set replicaCount=3

# 중첩 값
--set image.repository=nginx
--set image.tag=1.21

# 배열
--set env[0].name=FOO,env[0].value=bar

# 문자열 (특수문자 포함)
--set password="my\,password"

# 여러 값
--set replicaCount=3,image.tag=1.21
```

### 8.4 --values 파일

```yaml
# custom-values.yaml
replicaCount: 3

image:
  repository: nginx
  tag: "1.21"
  pullPolicy: Always

service:
  type: LoadBalancer
  port: 80

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

```bash
# 여러 파일 지정 (나중 파일이 우선)
helm install my-release bitnami/nginx \
  --values values-default.yaml \
  --values values-production.yaml
```

### 8.5 Chart 다운로드 및 수정

```bash
# 압축 파일로 다운로드
helm pull bitnami/wordpress

# 압축 해제하여 다운로드
helm pull bitnami/wordpress --untar

# 로컬 Chart로 설치
helm install my-wp ./wordpress
```

---

## 9. Lifecycle 관리

### 9.1 업그레이드

```bash
# 기본 업그레이드 (최신 Chart)
helm upgrade my-release bitnami/nginx

# 특정 버전으로 업그레이드
helm upgrade my-release bitnami/nginx --version 15.0.0

# 값 변경과 함께 업그레이드
helm upgrade my-release bitnami/nginx --set replicaCount=5

# 값 파일로 업그레이드
helm upgrade my-release bitnami/nginx -f new-values.yaml

# 설치 또는 업그레이드 (없으면 설치)
helm upgrade --install my-release bitnami/nginx
```

### 9.2 롤백

```bash
# 이전 Revision으로 롤백
helm rollback my-release

# 특정 Revision으로 롤백
helm rollback my-release 2

# Dry-run으로 확인
helm rollback my-release 2 --dry-run
```

### 9.3 Revision 흐름

```
┌──────────────────────────────────────────────────────────────┐
│                    Revision 흐름 예시                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  helm install ───────────────────► Revision 1 (nginx:1.19)   │
│       │                                                       │
│       ▼                                                       │
│  helm upgrade ───────────────────► Revision 2 (nginx:1.21)   │
│       │                                                       │
│       ▼                                                       │
│  helm upgrade ───────────────────► Revision 3 (nginx:1.23)   │
│       │                                                       │
│       ▼                                                       │
│  helm rollback 1 ────────────────► Revision 4 (nginx:1.19)   │
│                                         │                     │
│                          Revision 1의 설정을 복사하여         │
│                          새 Revision 4로 생성                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 9.4 이력 확인

```bash
helm history my-release

# 출력 예시
REVISION  UPDATED                   STATUS      CHART         APP VERSION  DESCRIPTION
1         Mon Jan 15 10:00:00 2024  superseded  nginx-15.0.0  1.23.0       Install complete
2         Mon Jan 15 11:00:00 2024  superseded  nginx-15.1.0  1.24.0       Upgrade complete
3         Mon Jan 15 12:00:00 2024  deployed    nginx-15.0.0  1.23.0       Rollback to 1
```

### 9.5 롤백의 한계

| 복구되는 것 | 복구되지 않는 것 |
|:-----------|:---------------|
| Kubernetes 리소스 정의 | PersistentVolume 데이터 |
| ConfigMap, Secret | 외부 데이터베이스 내용 |
| Pod 설정 | 애플리케이션이 생성한 파일 |

{{< callout type="warning" >}}
**중요:** 롤백은 Kubernetes 리소스만 복구합니다. 데이터베이스나 영구 볼륨의 데이터는 별도 백업이 필요합니다.
{{< /callout >}}

---

## 10. 디버깅과 검증

### 10.1 템플릿 렌더링 확인

```bash
# 템플릿 렌더링 결과 출력 (설치 없이)
helm template my-release bitnami/nginx

# 특정 values로 렌더링
helm template my-release bitnami/nginx -f values.yaml

# 특정 템플릿만 렌더링
helm template my-release bitnami/nginx -s templates/deployment.yaml
```

### 10.2 Dry-run

```bash
# 설치 시뮬레이션
helm install my-release bitnami/nginx --dry-run

# 상세 출력
helm install my-release bitnami/nginx --dry-run --debug

# 업그레이드 시뮬레이션
helm upgrade my-release bitnami/nginx --dry-run
```

### 10.3 Chart 검증

```bash
# Chart 문법 검사
helm lint ./my-chart

# 출력 예시
==> Linting ./my-chart
[INFO] Chart.yaml: icon is recommended
[WARNING] templates/deployment.yaml: object name does not conform to Kubernetes naming requirements

1 chart(s) linted, 0 chart(s) failed
```

### 10.4 릴리스 정보 확인

```bash
# 배포된 매니페스트 확인
helm get manifest my-release

# 사용된 values 확인
helm get values my-release

# 모든 정보
helm get all my-release

# 릴리스 노트 확인
helm get notes my-release
```

---

## 11. Chart 생성

### 11.1 새 Chart 생성

```bash
# 기본 Chart 스캐폴딩
helm create my-app

# 생성된 구조
my-app/
├── Chart.yaml
├── values.yaml
├── charts/
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── serviceaccount.yaml
│   ├── _helpers.tpl
│   ├── NOTES.txt
│   └── tests/
│       └── test-connection.yaml
└── .helmignore
```

### 11.2 Chart 패키징

```bash
# Chart 패키징 (.tgz 생성)
helm package ./my-app

# 버전 지정
helm package ./my-app --version 1.0.0

# 출력 디렉토리 지정
helm package ./my-app -d ./charts
```

### 11.3 의존성 관리

```bash
# 의존성 다운로드
helm dependency update ./my-app

# 의존성 목록
helm dependency list ./my-app

# charts/ 폴더에 의존 Chart 다운로드됨
```

---

## 12. Repository 활용

### 12.1 주요 Public Repository

| Repository | URL | 특징 |
|:-----------|:----|:-----|
| **Bitnami** | charts.bitnami.com/bitnami | 가장 인기, 잘 관리됨 |
| **Artifact Hub** | artifacthub.io | 중앙 검색 허브 |

### 12.2 Artifact Hub 활용

```bash
# 웹에서 검색: https://artifacthub.io

# CLI에서 검색
helm search hub wordpress

# 공식/검증된 Chart 확인
# - Official: Kubernetes 프로젝트 공식
# - Verified Publisher: 검증된 게시자
```

---

## 13. 실전 예제

### 13.1 WordPress 배포

```bash
# 1. Repository 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 2. 기본값 확인
helm show values bitnami/wordpress > wordpress-values.yaml

# 3. 커스텀 values 작성
cat <<EOF > my-wordpress-values.yaml
wordpressUsername: admin
wordpressPassword: secretpassword
wordpressBlogName: "My Tech Blog"

mariadb:
  auth:
    rootPassword: mariadb-root-password
    password: mariadb-password

service:
  type: LoadBalancer

persistence:
  enabled: true
  size: 10Gi
EOF

# 4. 설치
helm install my-blog bitnami/wordpress \
  -f my-wordpress-values.yaml \
  -n wordpress --create-namespace

# 5. 상태 확인
helm status my-blog -n wordpress
kubectl get pods -n wordpress
kubectl get svc -n wordpress
```

### 13.2 NGINX Ingress Controller 배포

```bash
# 1. Repository 추가
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# 2. 설치
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2

# 3. 확인
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

---

## 14. 명령어 요약

```bash
# Repository
helm repo add <name> <url>
helm repo list
helm repo update
helm repo remove <name>

# 검색
helm search hub <keyword>
helm search repo <keyword>

# Chart 정보
helm show chart <chart>
helm show values <chart>
helm show all <chart>

# 설치/삭제
helm install <release> <chart> [--values <file>] [--set key=value]
helm uninstall <release>

# 업그레이드/롤백
helm upgrade <release> <chart>
helm upgrade --install <release> <chart>
helm rollback <release> [revision]

# 조회
helm list [-A]
helm status <release>
helm history <release>
helm get values <release>
helm get manifest <release>

# 디버깅
helm template <release> <chart>
helm install <release> <chart> --dry-run --debug
helm lint <chart-path>

# Chart 생성
helm create <name>
helm package <chart-path>
helm dependency update <chart-path>

# 다운로드
helm pull <chart>
helm pull <chart> --untar
```

---

## 15. 요약

{{< callout type="info" >}}
**핵심 포인트:**
- Helm은 Kubernetes의 패키지 매니저로 복잡한 앱을 단일 명령으로 관리
- Chart = 패키지, Release = 설치된 인스턴스, Revision = 버전
- values.yaml로 중앙화된 설정 관리
- `helm upgrade --install`로 설치/업그레이드 통합
- 롤백은 Kubernetes 리소스만 복구 (데이터는 별도 백업 필요)
- `helm template`과 `--dry-run`으로 배포 전 검증
{{< /callout >}}
