---
title: "12. Kustomize"
weight: 12
---

Kustomize는 템플릿 없이 순수 YAML로 쿠버네티스 매니페스트를 환경별로 커스터마이징하는 도구다. Base + Overlay 패턴으로 DRY 원칙을 지키면서, kubectl에 내장되어 `kubectl apply -k`로 바로 쓸 수 있다.

## 1. Kustomize 개요

### 1.1 기존 방식의 한계

환경별로 디렉토리를 복제하면 공통 변경이 일어날 때마다 dev/stg/prod 모두에 동기화해야 하고, 누락·편차가 발생한다.

```text
   복제 방식           Kustomize 방식
┌──────────────┐   ┌────────────────┐
│ dev/*.yaml   │   │ base/*.yaml    │
│ stg/*.yaml   │   │   │            │
│ prod/*.yaml  │   │   ├─ dev       │
│ (3중 중복)    │   │   ├─ stg       │
└──────────────┘   │   └─ prod       │
                   └────────────────┘
```

### 1.2 Kustomize vs Helm

| 특성 | Kustomize | Helm |
|:---|:---|:---|
| 접근 방식 | Overlay (덮어쓰기) | 템플릿 변수 |
| 문법 | 순수 YAML | Go 템플릿 |
| 학습 곡선 | 낮음 | 높음 |
| 설치 | kubectl 내장 | 별도 설치 |
| 기능 범위 | 설정 커스터마이징 | 패키지 매니저 |
| 조건 로직 | 제한적 | if/else, loop 지원 |

{{< callout type="info" >}}
**선택 기준**: 단순한 환경 분리·사내 배포는 Kustomize, 외부 배포·파라미터가 많은 재사용 차트는 Helm. 두 도구는 병용 가능하며 `helm template | kustomize build` 패턴도 자주 쓴다.
{{< /callout >}}

## 2. 기본 구조

### 2.1 kustomization.yaml

모든 Kustomize 디렉토리에 필수인 설정 파일이다.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

namespace: production
namePrefix: prod-
```

### 2.2 디렉토리 레이아웃

```text
k8s/
├── kustomization.yaml
├── deployment.yaml
├── service.yaml
└── configmap.yaml
```

### 2.3 기본 명령어

```bash
# 결과 미리보기 (배포 X)
kustomize build k8s/

# 파이프로 배포
kustomize build k8s/ | kubectl apply -f -

# kubectl 내장 (권장)
kubectl apply -k k8s/
kubectl delete -k k8s/
```

## 3. 계층적 디렉토리 관리

복잡한 애플리케이션은 서브 디렉토리마다 kustomization.yaml을 두어 관리한다.

```text
k8s/
├── kustomization.yaml   (루트)
├── api/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── database/
│   └── ...
└── cache/
    └── ...
```

```yaml
# 루트 kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - api/        # 디렉토리 참조
  - database/
  - cache/
```

서브 디렉토리에서는 개별 파일을 `resources`로 참조한다. 루트에서 `kubectl apply -k k8s/`만 실행하면 모든 하위 리소스가 배포된다.

## 4. Common Transformers

모든 리소스에 공통 변환을 일괄 적용한다.

| Transformer | 기능 |
|:---|:---|
| `commonLabels` | 모든 리소스에 레이블 추가 |
| `commonAnnotations` | 모든 리소스에 주석 추가 |
| `namePrefix` / `nameSuffix` | 이름 접두/접미사 |
| `namespace` | 네임스페이스 고정 |
| `images` | 이미지 이름·태그 변경 |

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

commonLabels:
  app: my-app
  env: production

namePrefix: prod-
namespace: production
```

{{< callout type="warning" >}}
**commonLabels 위험**: `commonLabels`는 `spec.selector.matchLabels`와 Service `selector`까지 **immutable 필드**에 주입된다. 기존 Deployment에 나중에 추가하면 `field is immutable` 에러로 배포가 실패하고, 재생성이 필요하다. 변경 불가 필드에 주입되지 않는 `labels:` (with `includeSelectors: false`)를 우선 검토하라.
{{< /callout >}}

## 5. Image Transformer

### 5.1 이미지 교체

```yaml
images:
  - name: nginx       # 이미지 이름 (컨테이너 이름 아님)
    newTag: "1.21"

  - name: my-app
    newName: registry.internal/my-app
    newTag: v1.2.3
```

### 5.2 환경별 태그 전략

```yaml
# overlays/dev
images:
  - name: my-app
    newTag: dev-latest

# overlays/prod
images:
  - name: my-app
    newTag: v1.2.3   # 불변 태그 권장
```

{{< callout type="info" >}}
`newTag`는 `deployment.yaml`의 `image: nginx:X` 중 **이미지 이름(nginx)** 을 매칭한다. `containers[].name`과 혼동하지 말 것.
{{< /callout >}}

## 6. Patches

### 6.1 Strategic Merge vs JSON 6902

| 구분 | Strategic Merge | JSON 6902 |
|:---|:---|:---|
| 문법 | 쿠버네티스 YAML | RFC 6902 operation |
| 리스트 병합 | name 기반 merge | 인덱스 기반 |
| 가독성 | 높음 | 낮음 |
| 정밀 제어 | 제한적 | 매우 세밀 |
| 추천 용도 | 필드 덮어쓰기 | 배열 요소 정밀 수정 |

{{< callout type="info" >}}
**Strategic Merge를 기본으로, JSON 6902는 보완용**. 배열 요소를 인덱스로 정확히 지정해야 하거나, 필드를 제거(`remove`)해야 할 때만 JSON 6902를 선택하라. Strategic Merge는 `name` 키로 병합되어 순서 변경에 강하다.
{{< /callout >}}

### 6.2 JSON 6902 Patch

```yaml
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

경로(Path) 예시:

```text
/spec/replicas                         (필드)
/spec/template/spec/containers/0       (배열 인덱스)
/spec/template/spec/containers/-       (리스트 끝 추가)
```

### 6.3 Strategic Merge Patch

```yaml
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
            - name: nginx       # name으로 매칭
              resources:
                limits:
                  memory: "512Mi"
```

### 6.4 별도 파일 패치

```yaml
patches:
  - path: patches/replicas.yaml
  - path: patches/resources.yaml
```

## 7. Base와 Overlays

### 7.1 구조

```text
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        ├── kustomization.yaml
        └── monitoring.yaml
```

### 7.2 Base/Overlay 결정 트리

어떤 설정을 Base에 두고, 어떤 설정을 Overlay에 둘지 판단하는 기준이다.

```text
       설정 항목 판단
             │
             ▼
   모든 환경에서 동일?
        │      │
      Yes      No
        │      │
        ▼      ▼
     Base   환경마다 값만 달라?
              │       │
             Yes      No
              │       │
              ▼       ▼
       Overlay     일부 환경만
       (patch)       필요?
                   │      │
                  Yes     No
                   │      │
                   ▼      ▼
              Component  별도 리소스
                        (overlay resources)
```

### 7.3 Base 정의

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
  replicas: 1
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

### 7.4 Production Overlay

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - monitoring.yaml          # 프로덕션만 추가

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
                limits:
                  memory: "512Mi"
                  cpu: "1000m"
```

```bash
kubectl apply -k overlays/dev/
kubectl apply -k overlays/production/
kustomize build overlays/production/   # 미리보기
```

## 8. Components

### 8.1 개념

여러 Overlay에서 **선택적으로 재사용**할 수 있는 설정 블록이다. "caching은 premium + standalone만, external-db는 dev + premium만" 같은 **기능 조합**을 깔끔히 표현한다.

```text
k8s/
├── base/
├── components/
│   ├── caching/
│   │   ├── kustomization.yaml
│   │   └── redis-deployment.yaml
│   └── external-db/
│       └── ...
└── overlays/
    ├── dev/
    ├── premium/
    └── standalone/
```

### 8.2 Component 정의

```yaml
# components/caching/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component       # Kustomization 아님!

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

### 8.3 Overlay에서 import

```yaml
# overlays/premium/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

components:
  - ../../components/caching
  - ../../components/external-db
```

## 9. Generators

### 9.1 ConfigMap / Secret 생성

```yaml
configMapGenerator:
  - name: app-config
    literals:
      - DATABASE_HOST=localhost
      - DATABASE_PORT=5432
  - name: app-properties
    files:
      - application.properties

secretGenerator:
  - name: db-credentials
    literals:
      - username=admin
      - password=secret123
    type: Opaque
```

### 9.2 해시 접미사

생성된 ConfigMap/Secret 이름 뒤에 해시가 자동 추가되어, 값이 바뀌면 새 리소스가 만들어지고 참조하는 Pod가 자동으로 롤링 재시작된다.

```yaml
# 결과
metadata:
  name: app-config-k5h9m8c2df
```

해시를 끄면 이 자동 롤아웃 효과도 사라진다.

```yaml
generatorOptions:
  disableNameSuffixHash: true
```

{{< callout type="warning" >}}
**generators 미래 방향**: Kustomize는 `vars`와 같은 구 필드를 deprecate 중이며, 빌트인 generator도 향후 **KRM Function(플러그인)** 방식으로 일반화되는 방향이다. 당분간 `configMapGenerator` / `secretGenerator`는 안전하지만, 복잡한 치환·템플릿 요구에는 `replacements` 또는 외부 KRM function 사용을 검토하라 (`vars`는 신규 코드에서 사용 금지).
{{< /callout >}}

## 10. ArgoCD Kustomize 통합

ArgoCD는 Kustomize를 **네이티브로 지원**한다. `kustomization.yaml`이 있는 디렉토리를 소스로 지정하면 자동으로 `kustomize build` 결과를 Git 선언 상태로 사용한다.

```yaml
# Application CR
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-prod
spec:
  source:
    repoURL: https://github.com/org/k8s-manifests
    path: overlays/production
    kustomize:
      images:
        - my-app:v1.2.4      # 이미지 태그 오버라이드
      namePrefix: prod-
      commonLabels:
        argocd.argoproj.io/instance: my-app-prod
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```text
  Git (Kustomize)          ArgoCD            Cluster
 ┌─────────────┐       ┌──────────┐       ┌─────────┐
 │ overlays/   │──────▶│ build →  │──────▶│ apply   │
 │  production │  pull │  diff    │ sync  │ (prune) │
 └─────────────┘       └──────────┘       └─────────┘
                             ▲
                             │
                        self-heal
```

{{< callout type="info" >}}
CI 파이프라인에서 이미지 태그만 바꿔 커밋하면(GitOps), ArgoCD가 감지하여 자동 동기화한다. `kustomize edit set image my-app=my-app:v1.2.4` 명령으로 `kustomization.yaml`만 커밋하는 패턴이 일반적이다.
{{< /callout >}}

## 11. 안티패턴

Kustomize 도입 후 자주 발생하는 실수들이다.

| 안티패턴 | 증상 | 권장 |
|:---|:---|:---|
| Overlay에서 Base 필드 전체 재작성 | Base 변경이 전파되지 않음 | `patches`로 변경 필드만 |
| 동일 리소스를 여러 Overlay에 복붙 | 관리 폭증 | Base로 승격, Overlay는 차이만 |
| `commonLabels`를 기존 앱에 추가 | selector immutable 에러 | `labels` (includeSelectors: false) |
| `namespace` 값을 Base에 고정 | Overlay 재사용 불가 | Base는 생략, Overlay에서 지정 |
| 해시 suffix 일괄 off | 설정 변경해도 Pod 재시작 안 됨 | 기본값 유지 (해시 on) |
| 인덱스 기반 JSON 6902 남용 | 배열 순서 바뀌면 오작동 | Strategic Merge + name 매칭 |
| 여러 계층 깊은 Overlay 체인 | 빌드 결과 추적 불가 | 2단(Base→Overlay)로 유지 |
| `vars` 사용 | deprecated | `replacements` 필드 |

## 12. 명령어 요약

```bash
# 빌드 (미리보기)
kustomize build overlays/production/

# 배포 / 삭제
kubectl apply -k overlays/production/
kubectl delete -k overlays/production/

# diff 확인 (변경분만)
kustomize build overlays/production/ | kubectl diff -f -

# 이미지 태그 업데이트 후 커밋 (GitOps)
cd overlays/production
kustomize edit set image my-app=my-app:v1.2.4
git commit -am "bump my-app to v1.2.4"

# 파일 저장
kustomize build overlays/production/ > manifests.yaml
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Kustomize | 템플릿 없는 순수 YAML 커스터마이징 |
| Base | 모든 환경 공통 매니페스트 |
| Overlay | 환경별 차이 (patch, image, namespace) |
| Transformer | 모든 리소스에 일괄 적용 (labels, prefix) |
| Patch | 특정 리소스 정밀 수정 (SMP / JSON 6902) |
| Component | 여러 Overlay에서 재사용하는 기능 블록 |
| Generator | ConfigMap/Secret + 해시 자동 롤아웃 |
| ArgoCD | kustomize build 결과를 Git 선언 상태로 사용 |

{{< callout type="info" >}}
**용어 정리**
- **Base**: 환경 공통 매니페스트 집합
- **Overlay**: Base를 참조하며 환경별 차이를 적용하는 디렉토리
- **Transformer**: 리소스 전체에 공통 변환을 거는 필드
- **Strategic Merge Patch (SMP)**: 쿠버네티스 YAML 기반 병합 패치, name 키 매칭
- **JSON 6902 Patch**: RFC 6902 op/path/value 기반 정밀 패치
- **Component**: 여러 Overlay가 선택적으로 import하는 재사용 블록
- **Generator**: ConfigMap/Secret을 선언으로 생성, 해시 suffix로 롤아웃 유도
- **KRM Function**: Kustomize의 확장 플러그인, 빌드 파이프라인에 커스텀 변환 주입
{{< /callout >}}
