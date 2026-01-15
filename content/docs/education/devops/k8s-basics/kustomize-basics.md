---
title: "Kustomize Basics"
weight: 12
---

Kubernetes 설정 관리 도구 Kustomize의 기본 개념, Base/Overlay 구조, Transformers, Patches를 다룹니다.

---

## 1. Kustomize 개요

### 1.1 Kustomize란?

Kustomize는 **템플릿 없이 Kubernetes 설정을 커스터마이징**하는 도구입니다. 순수 YAML을 유지하면서 환경별 설정을 관리합니다.

```
┌──────────────────────────────────────────────────────────────┐
│                    기존 방식의 문제점                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  환경별 디렉토리 복사:                                         │
│  dev/                  staging/              production/      │
│  ├── deployment.yaml   ├── deployment.yaml   ├── deployment.yaml
│  └── service.yaml      └── service.yaml      └── service.yaml │
│      (replicas: 1)         (replicas: 2)         (replicas: 5)│
│                                                               │
│  문제점:                                                       │
│  - 코드 중복 (DRY 원칙 위반)                                   │
│  - 변경사항 동기화 어려움                                      │
│  - 실수 가능성 증가                                            │
│  - 확장성 부족                                                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Kustomize의 해결책

```
Base (공통 설정) + Overlay (환경별 수정) = 최종 매니페스트

┌─────────────────┐
│      Base       │     공통 Deployment, Service
│  (모든 환경)     │     replicas: 1 (기본값)
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐
│  Dev  │ │Staging│ │ Prod  │
│rep: 1 │ │rep: 3 │ │rep: 10│
└───────┘ └───────┘ └───────┘
```

### 1.3 Kustomize vs Helm

| 특성 | Kustomize | Helm |
|:-----|:----------|:-----|
| **접근 방식** | Overlay (덮어쓰기) | 템플릿 변수 |
| **문법** | 순수 YAML | Go 템플릿 |
| **학습 곡선** | 낮음 | 높음 |
| **YAML 유효성** | 항상 유효한 YAML | 템플릿은 유효하지 않음 |
| **설치** | kubectl 내장 | 별도 설치 필요 |
| **기능 범위** | 설정 커스터마이징 | 완전한 패키지 매니저 |
| **복잡한 로직** | 제한적 | if/else, loops 지원 |

### 1.4 선택 기준

| 상황 | 추천 도구 |
|:-----|:---------|
| 단순한 환경별 커스터마이징 | Kustomize |
| 복잡한 조건부 로직 필요 | Helm |
| 팀이 YAML에 익숙 | Kustomize |
| 완전한 패키지 관리 필요 | Helm |
| 빠른 시작 | Kustomize |

---

## 2. 기본 구조

### 2.1 kustomization.yaml

Kustomize의 핵심 설정 파일입니다. 모든 Kustomize 디렉토리에 필수입니다.

```yaml
# kustomization.yaml 기본 구조
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 1. 관리할 리소스 목록
resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

# 2. 변환 (Transformations)
commonLabels:
  app: my-app

namespace: production

namePrefix: prod-
```

### 2.2 디렉토리 구조

```
k8s/
├── kustomization.yaml      # Kustomize 설정 파일
├── deployment.yaml         # Deployment 매니페스트
├── service.yaml            # Service 매니페스트
└── configmap.yaml          # ConfigMap 매니페스트
```

### 2.3 기본 명령어

```bash
# 결과 미리보기 (배포하지 않음)
kustomize build k8s/

# 실제 배포 (방법 1: 파이프)
kustomize build k8s/ | kubectl apply -f -

# 실제 배포 (방법 2: kubectl 내장, 권장)
kubectl apply -k k8s/

# 삭제
kubectl delete -k k8s/
```

---

## 3. 디렉토리 관리

### 3.1 계층적 구조

복잡한 애플리케이션은 계층적 kustomization.yaml로 관리합니다.

```
k8s/
├── kustomization.yaml          # 루트: 서브디렉토리 참조
├── api/
│   ├── kustomization.yaml      # 서브: 파일 참조
│   ├── deployment.yaml
│   └── service.yaml
├── database/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── cache/
    ├── kustomization.yaml
    ├── redis-deployment.yaml
    └── redis-service.yaml
```

### 3.2 루트 kustomization.yaml

```yaml
# k8s/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - api/          # 디렉토리 참조 (kustomization.yaml 자동 탐색)
  - database/
  - cache/
```

### 3.3 서브 kustomization.yaml

```yaml
# k8s/api/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml   # 파일 참조
  - service.yaml
```

### 3.4 적용

```bash
# 모든 서브디렉토리 리소스를 한 번에 배포
kubectl apply -k k8s/
```

---

## 4. Common Transformers

### 4.1 Transformer 종류

모든 리소스에 공통 설정을 적용합니다.

| Transformer | 기능 | 예시 |
|:------------|:-----|:-----|
| `commonLabels` | 모든 리소스에 레이블 추가 | 환경, 팀, 버전 표시 |
| `commonAnnotations` | 모든 리소스에 주석 추가 | 메타데이터, 설명 |
| `namePrefix` | 이름 앞에 접두사 추가 | `dev-`, `prod-` |
| `nameSuffix` | 이름 뒤에 접미사 추가 | `-v1`, `-blue` |
| `namespace` | 특정 네임스페이스 지정 | `production` |
| `images` | 컨테이너 이미지 변경 | 태그, 이름 변경 |

### 4.2 예제

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

# 모든 리소스에 레이블 추가
commonLabels:
  app: my-app
  env: production
  team: backend

# 모든 리소스에 주석 추가
commonAnnotations:
  managed-by: kustomize
  version: "1.0"

# 이름에 접두사/접미사 추가
namePrefix: prod-
nameSuffix: -v1

# 네임스페이스 지정
namespace: production
```

### 4.3 변환 결과

```yaml
# 원본 deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx

# 변환 후
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prod-nginx-v1           # prefix + suffix 적용
  namespace: production         # namespace 적용
  labels:
    app: my-app                 # commonLabels 적용
    env: production
    team: backend
  annotations:
    managed-by: kustomize       # commonAnnotations 적용
    version: "1.0"
```

---

## 5. Image Transformer

### 5.1 이미지 변경

```yaml
# kustomization.yaml
images:
  # 이미지 이름만 변경
  - name: nginx
    newName: haproxy

  # 태그만 변경
  - name: redis
    newTag: "7.0"

  # 이미지와 태그 모두 변경
  - name: mongo
    newName: postgres
    newTag: "15.0"
```

### 5.2 주의사항

```yaml
# deployment.yaml
spec:
  containers:
  - name: web           # 컨테이너 이름 (무관)
    image: nginx        # 이미지 이름 (이것을 찾음!)

# kustomization.yaml
images:
  - name: nginx         # 이미지 이름을 참조 (컨테이너 이름 아님!)
    newTag: "1.21"
```

{{< callout type="warning" >}}
**중요:** `images.name`은 컨테이너 이름이 아닌 **이미지 이름**을 참조합니다.
{{< /callout >}}

### 5.3 실무 활용

```yaml
# 환경별 이미지 태그
# overlays/dev/kustomization.yaml
images:
  - name: my-app
    newTag: "dev-latest"

# overlays/prod/kustomization.yaml
images:
  - name: my-app
    newTag: "v1.2.3"

# 내부 레지스트리로 변경
images:
  - name: nginx
    newName: registry.internal.com/nginx
    newTag: "1.21"
```

---

## 6. Patches

### 6.1 Patches vs Transformers

| 구분 | Transformers | Patches |
|:-----|:-------------|:--------|
| **범위** | 모든 리소스에 광범위 적용 | 특정 리소스만 정밀 타겟팅 |
| **예시** | 전체 레이블, 네임스페이스 | 특정 Deployment의 replicas |

### 6.2 Patch 방식

#### JSON 6902 Patch

RFC 6902 표준을 따르는 명시적 방식입니다.

```yaml
# kustomization.yaml
patches:
  - target:
      kind: Deployment
      name: nginx
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 5
      - op: add
        path: /metadata/labels/version
        value: v2
      - op: remove
        path: /metadata/annotations/deprecated
```

**Operation 종류:**
- `add`: 새 항목 추가
- `replace`: 기존 값 교체
- `remove`: 항목 제거

#### Strategic Merge Patch

일반 Kubernetes YAML 형식으로 작성합니다.

```yaml
# kustomization.yaml
patches:
  - target:
      kind: Deployment
      name: nginx
    patch: |-
      spec:
        replicas: 5
        template:
          spec:
            containers:
            - name: nginx
              resources:
                limits:
                  memory: "512Mi"
```

### 6.3 Path 구조 (JSON 6902)

```
/spec/replicas                              # replicas 값
/metadata/labels/app                        # app 레이블
/spec/template/spec/containers/0            # 첫 번째 컨테이너
/spec/template/spec/containers/0/image      # 첫 번째 컨테이너 이미지
/spec/template/spec/containers/-            # 컨테이너 리스트 끝에 추가
```

### 6.4 리스트(배열) 패치

#### JSON 6902

```yaml
# 첫 번째 컨테이너 교체 (인덱스 0)
- op: replace
  path: /spec/template/spec/containers/0
  value:
    name: nginx
    image: nginx:1.21

# 리스트 끝에 컨테이너 추가
- op: add
  path: /spec/template/spec/containers/-
  value:
    name: sidecar
    image: busybox

# 두 번째 컨테이너 삭제 (인덱스 1)
- op: remove
  path: /spec/template/spec/containers/1
```

#### Strategic Merge Patch

```yaml
# 이름으로 매칭하여 수정
spec:
  template:
    spec:
      containers:
      - name: nginx              # 이름으로 매칭
        image: nginx:1.21        # 이미지 변경
      - name: sidecar            # 새 컨테이너 추가
        image: busybox

# 컨테이너 삭제
spec:
  template:
    spec:
      containers:
      - $patch: delete
        name: sidecar            # 삭제할 컨테이너
```

### 6.5 별도 파일로 패치

```yaml
# kustomization.yaml
patches:
  - path: patches/replicas-patch.yaml
  - path: patches/resources-patch.yaml
```

```yaml
# patches/replicas-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 5
```

---

## 7. Base와 Overlays

### 7.1 구조

```
k8s/
├── base/                           # 공통 설정
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/                       # 환경별 설정
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        ├── kustomization.yaml
        └── monitoring.yaml         # 환경별 추가 리소스
```

### 7.2 Base 설정

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
```

```yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1                       # 기본값
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: my-app:latest
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
```

### 7.3 Overlay 설정

```yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base                      # Base 참조 (상대 경로)

namePrefix: dev-
namespace: development

images:
  - name: my-app
    newTag: dev-latest
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - monitoring.yaml                 # 프로덕션만 추가 리소스

namePrefix: prod-
namespace: production

images:
  - name: my-app
    newTag: v1.2.3

patches:
  - target:
      kind: Deployment
      name: my-app
    patch: |-
      spec:
        replicas: 10
        template:
          spec:
            containers:
            - name: app
              resources:
                requests:
                  memory: "256Mi"
                  cpu: "500m"
                limits:
                  memory: "512Mi"
                  cpu: "1000m"
```

### 7.4 배포

```bash
# 개발 환경 배포
kubectl apply -k overlays/dev/

# 스테이징 환경 배포
kubectl apply -k overlays/staging/

# 프로덕션 환경 배포
kubectl apply -k overlays/production/

# 결과 미리보기
kustomize build overlays/production/
```

---

## 8. Components

### 8.1 Components란?

여러 Overlay에서 **선택적으로 재사용**할 수 있는 설정 블록입니다.

```
문제 상황:
- Caching 기능: Premium + Standalone만 필요
- External DB: Dev + Premium만 필요

해결:
- 각 기능을 Component로 분리
- 필요한 Overlay에서만 import
```

### 8.2 구조

```
k8s/
├── base/
│   └── kustomization.yaml
├── components/
│   ├── caching/
│   │   ├── kustomization.yaml
│   │   └── redis-deployment.yaml
│   └── external-db/
│       ├── kustomization.yaml
│       └── db-secret.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── premium/
    │   └── kustomization.yaml
    └── standalone/
        └── kustomization.yaml
```

### 8.3 Component 정의

```yaml
# components/caching/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component                     # 일반 Kustomization과 다름!

resources:
  - redis-deployment.yaml

patches:
  - target:
      kind: Deployment
      name: my-app
    patch: |-
      spec:
        template:
          spec:
            containers:
            - name: app
              env:
              - name: REDIS_HOST
                value: redis
```

### 8.4 Component 사용

```yaml
# overlays/premium/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

components:                         # Component import
  - ../../components/caching
  - ../../components/external-db
```

```yaml
# overlays/standalone/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

components:
  - ../../components/caching        # caching만 사용
```

---

## 9. Generators

### 9.1 ConfigMap Generator

```yaml
# kustomization.yaml
configMapGenerator:
  # 리터럴 값
  - name: app-config
    literals:
      - DATABASE_HOST=localhost
      - DATABASE_PORT=5432

  # 파일에서 생성
  - name: app-properties
    files:
      - application.properties

  # 환경 파일에서 생성
  - name: env-config
    envs:
      - .env
```

### 9.2 Secret Generator

```yaml
# kustomization.yaml
secretGenerator:
  - name: db-credentials
    literals:
      - username=admin
      - password=secret123
    type: Opaque

  - name: tls-secret
    files:
      - tls.crt
      - tls.key
    type: kubernetes.io/tls
```

### 9.3 해시 접미사

Generator로 생성된 ConfigMap/Secret은 자동으로 해시 접미사가 추가됩니다.

```yaml
# 생성 결과
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-k5h9m8c2df    # 해시 접미사 추가
```

해시 접미사 비활성화:

```yaml
# kustomization.yaml
generatorOptions:
  disableNameSuffixHash: true
```

---

## 10. 실전 예제

### 10.1 전체 프로젝트 구조

```
my-project/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── components/
│   ├── monitoring/
│   │   ├── kustomization.yaml
│   │   └── prometheus-config.yaml
│   └── logging/
│       ├── kustomization.yaml
│       └── fluentd-daemonset.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── dev-config.yaml
    ├── staging/
    │   ├── kustomization.yaml
    │   └── staging-config.yaml
    └── production/
        ├── kustomization.yaml
        ├── prod-config.yaml
        └── ingress.yaml
```

### 10.2 Base

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

commonLabels:
  app: my-app
```

### 10.3 Production Overlay

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - ingress.yaml

components:
  - ../../components/monitoring
  - ../../components/logging

namespace: production
namePrefix: prod-

images:
  - name: my-app
    newTag: v1.2.3

patches:
  - target:
      kind: Deployment
      name: my-app
    patch: |-
      spec:
        replicas: 5

configMapGenerator:
  - name: app-config
    behavior: merge
    files:
      - prod-config.yaml
```

---

## 11. 명령어 요약

```bash
# 빌드 (미리보기)
kustomize build <directory>
kustomize build overlays/production/

# 배포
kubectl apply -k <directory>
kubectl apply -k overlays/production/

# 삭제
kubectl delete -k <directory>
kubectl delete -k overlays/production/

# 파이프 사용
kustomize build overlays/production/ | kubectl apply -f -
kustomize build overlays/production/ | kubectl diff -f -

# 결과를 파일로 저장
kustomize build overlays/production/ > manifests.yaml

# 특정 리소스만 확인
kustomize build overlays/production/ | grep -A 50 "kind: Deployment"
```

---

## 12. 요약

{{< callout type="info" >}}
**핵심 포인트:**
- Kustomize는 템플릿 없이 순수 YAML로 환경별 설정 관리
- Base + Overlay 구조로 DRY 원칙 준수
- kubectl에 내장되어 `kubectl apply -k` 사용 가능
- Transformers: 모든 리소스에 공통 변환 적용
- Patches: 특정 리소스만 정밀하게 수정
- Components: 여러 Overlay에서 선택적 재사용
- Generators: ConfigMap/Secret 자동 생성
{{< /callout >}}

### 선택 가이드

```
단순 환경 분리 → Base + Overlay
공통 설정 적용 → Transformers (commonLabels, namespace)
특정 리소스 수정 → Patches
선택적 기능 → Components
동적 ConfigMap/Secret → Generators
```
