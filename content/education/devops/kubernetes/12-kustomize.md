---
title: "12. Kustomize"
date: 2026-04-23
weight: 12
---

[11. Helm](../11-helm) 11절에서 Helm은 틀에 값을 넣고 Kustomize는 완성된 YAML을 패치로 고친다고 하고, 어디에 무엇이 맞는지를 이 장으로 미뤘다. 이 장은 그 "완성된 YAML을 고친다"를 처음부터 끝까지 본다. 원리는 셋이다. 첫째, **원본은 고치지 않는다. 그 위에 무엇을 바꿀지를 따로 적는다.** base는 그대로 `kubectl apply` 할 수 있는 평범한 매니페스트이고, overlay는 환경마다의 차이만 담는다. 템플릿 문법이 없어서 base는 어느 도구로든 읽힌다. 둘째, **`kustomize build`는 순서가 있는 파이프라인이다. 모으고, 만들고, 바꾼다.** `resources`가 매니페스트를 모으고, 제너레이터가 ConfigMap과 Secret을 만들고, 패치와 트랜스포머가 그것들을 고친다. 나오는 것은 평범한 YAML 한 덩어리이고, 그것을 눈으로 보는 것이 디버깅의 전부다. 셋째, **기록과 적용과 정리는 Kustomize의 일이 아니다.** 릴리스도 리비전도 없고, 이름이 바뀐 ConfigMap의 옛것을 지우지도 않는다. 기록은 Git이, 적용과 정리는 kubectl과 [13. CI/CD](../13-cicd)의 ArgoCD가 맡는다.

---

## 1. Kustomize 개요

### 1.1 기존 방식의 한계

```text
복제                Kustomize
dev/*.yaml          base/*.yaml
stg/*.yaml            ▲  ▲  ▲
prod/*.yaml           │  │  │ 차이만
(같은 것 세 벌)      dev stg prod
```

| 방식 | 공통 변경이 생기면 | 환경의 차이는 | 왜 |
|:-----|:--------------|:----------|:---|
| 디렉터리 복제 | 세 곳을 다 고친다. 하나를 빠뜨리면 환경이 어긋난다 | 파일 전체를 비교해야 보인다 | 같은 내용이 세 벌이다 |
| 템플릿(Helm) | 틀 하나를 고친다 | 값 파일에 | 틀은 `{{ }}`가 섞여 그대로는 YAML이 아니다 |
| Kustomize | base 하나를 고친다 | overlay에 차이만 | base는 그대로 쓸 수 있는 YAML이고, 차이가 곧 overlay의 내용이다 |

첫째 원리다. Kustomize는 원본을 건드리지 않는다. base의 `deployment.yaml`은 `kubectl apply -f`로 그대로 적용할 수 있는 파일이고, 운영 환경이 레플리카 10개를 원하면 그 사실만 overlay에 적는다. 그래서 overlay를 읽으면 "이 환경이 기본과 무엇이 다른가"가 곧바로 보인다.

### 1.2 Kustomize vs Helm

| 특성 | Kustomize | Helm | 왜 다른가 |
|:-----|:---------|:-----|:-------|
| 접근 | 완성된 YAML에 패치 | 템플릿에 값 | Kustomize는 어디든 고칠 수 있고, Helm은 만든 사람이 열어 둔 값만 바꾼다 |
| 문법 | YAML만 | Go 템플릿과 함수 | |
| 조건과 반복 | 없다. 컴포넌트(8절)로 조합 | `if`, `range` | 선택지가 많은 패키지는 템플릿이 낫다 |
| 설치 | kubectl에 내장(`-k`) | 바이너리 따로 | |
| 나누는 단위 | 디렉터리, Git 주소 | 버전 찍힌 차트 | 남에게 줄 패키지는 차트가 맞다 |
| 기록 | 없다 | 릴리스와 리비전 | 셋째 원리. Kustomize는 Git에 맡긴다 |
| 의존성 | 다른 디렉터리나 원격 저장소를 `resources`로 | 하위 차트 | |

{{< callout type="info" >}}
**선택 기준.** 남이 만든 애플리케이션을 설치하거나 옵션이 많은 패키지를 나눠 줄 때는 Helm, 우리 매니페스트를 환경마다 조금씩 다르게 쓸 때는 Kustomize다. 둘은 같이 쓴다. 남의 차트가 열어 두지 않은 곳을 고쳐야 하면 `helm template`의 출력을 base로 삼거나, `kustomization.yaml`의 `helmCharts` 필드로 차트를 렌더링해 그 위에 패치한다. `helmCharts`는 `kustomize build --enable-helm`으로 켜야 하고 helm 바이너리가 있어야 하며, Helm 기능의 일부만 지원한다.
{{< /callout >}}

---

## 2. 기본 구조

### 2.1 kustomization.yaml

```yaml
apiVersion:
  kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:          # 모은다
- deployment.yaml
- service.yaml

configMapGenerator: # 만든다
- name: app-config
  literals:
  - LOG_LEVEL=info

namespace: prod     # 바꾼다
namePrefix: prod-
images:
- name: my-app
  newTag: v1.2.3
```

```text
resources        매니페스트를 모은다
   ▼             (파일, 디렉터리, 원격)
generators       ConfigMap·Secret 생성
   ▼
patches          고른 리소스를 고친다
   ▼
transformers     namespace, 접두사,
   ▼             레이블, 이미지, 개수
replacements     값을 다른 곳에 복사
   ▼
평범한 YAML (정렬되어 나온다)
```

| 단계 | 필드 | 하는 일 | 왜 이 순서인가 |
|:-----|:----|:------|:-----------|
| 모으기 | `resources`, `components` | 파일, 디렉터리, 원격 주소의 매니페스트를 읽는다. 디렉터리면 그 안의 kustomization을 먼저 빌드한다 | 고칠 대상이 먼저 있어야 한다 |
| 만들기 | `configMapGenerator`, `secretGenerator`, `helmCharts` | 파일과 값에서 오브젝트를 만든다 | 만든 것도 뒤 단계에서 고쳐질 수 있게 |
| 고치기 | `patches` | 대상을 골라 필드를 바꾼다 | 이름이 바뀌기 전에 고른다. 같은 파일 안의 패치 대상은 접두사가 붙기 전의 이름이다 |
| 일괄 변환 | `namespace`, `namePrefix`, `nameSuffix`, `labels`, `commonAnnotations`, `images`, `replicas` | 모든 리소스에 같은 변환 | 이름이 바뀌면 그 이름을 가리키는 참조도 같이 바뀐다 |
| 복사 | `replacements` | 한 필드의 값을 다른 필드들에 | 앞의 변환이 끝난 값을 옮긴다 |
| 정렬 | `sortOptions` | Namespace, CRD가 앞에, 웹훅 설정이 뒤에 | 적용 순서의 의존을 맞춘다. `fifo`로 바꾸면 적은 순서 그대로 |

둘째 원리다. `kustomization.yaml`은 설정 파일이라기보다 파이프라인의 선언이다. 필드를 어떤 순서로 적든 실행 순서는 위와 같다. 그래서 결과가 기대와 다르면 "어느 단계가 무엇을 했는가"를 물으면 되고, 답은 `kustomize build`가 찍어 주는 YAML에 있다.

### 2.2 디렉토리 레이아웃

```text
k8s/
├── kustomization.yaml
├── deployment.yaml
├── service.yaml
└── configmap.yaml
```

파일 이름은 `kustomization.yaml`, `kustomization.yml`, `Kustomization` 셋 중 하나여야 하고, 디렉터리마다 하나다. `resources`에 적지 않은 YAML 파일은 같은 디렉터리에 있어도 읽히지 않는다.

### 2.3 기본 명령어

```bash
# 결과만 본다 (적용 안 함)
kustomize build k8s/
kubectl kustomize k8s/

# 클러스터와 견준다
kubectl diff -k k8s/

# 적용, 조회, 삭제
kubectl apply -k k8s/
kubectl get -k k8s/
kubectl delete -k k8s/
```

| 실행 파일 | 버전 | 왜 |
|:-------|:----|:---|
| `kustomize` (독립) | 최신 5.8 | 새 필드와 수정이 먼저 들어온다 |
| `kubectl -k`, `kubectl kustomize` | kubectl에 묶인 버전. 1.31의 kubectl에는 5.4.2 | kubectl 릴리스마다 그때의 Kustomize를 넣는다. `kubectl version`이 보여 준다 |
| ArgoCD 안의 것 | ArgoCD에 묶인 버전. 바꿀 수 있다 | 10절 |

세 곳의 버전이 다르면 같은 디렉터리가 다른 결과를 낼 수 있다. 로컬에서는 되는데 파이프라인에서 필드를 모른다고 하면 버전부터 본다.

---

## 3. 계층적 디렉토리 관리

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
apiVersion:
  kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- api/          # 디렉터리
- database/
- cache/
- "https://github.com/org/infra\
  //monitoring?ref=v1.4.0"
```

| `resources`에 적는 것 | 예 | 어떻게 읽나 | 왜 |
|:----------------|:---|:--------|:---|
| 파일 | `deployment.yaml` | 그대로 | 가장 작은 단위 |
| 디렉터리 | `api/`, `../../base` | 그 안의 kustomization을 빌드한 결과 | 디렉터리가 곧 모듈이다. base와 overlay도 이것으로 만든다 |
| 원격 저장소 | `https://github.com/org/repo//경로?ref=v1.4.0` | 저장소를 받아 그 경로를 빌드 | 공통 base를 여러 저장소가 나눠 쓴다. `//` 뒤가 저장소 안의 경로 |
| 원격 파일 | 원시 파일의 URL | 그대로 | 남이 배포한 매니페스트 하나 |

원격 주소에는 `ref`로 태그나 커밋을 박는다. `ref`가 없으면 기본 브랜치의 그 순간 내용이 들어와, 같은 커밋을 다시 빌드해도 결과가 달라질 수 있다. 받는 데 걸리는 제한 시간은 기본 27초이고 `timeout`으로 늘린다. 옛 필드 `bases`는 `resources`에 합쳐졌으므로 디렉터리든 파일이든 `resources`에 적는다.

---

## 4. Common Transformers

| 필드 | 하는 일 | 왜 |
|:-----|:------|:---|
| `namespace` | 네임스페이스가 있는 리소스 전부에 네임스페이스를 넣는다 | base에는 네임스페이스를 적지 않고 overlay가 정한다 |
| `namePrefix`, `nameSuffix` | 이름 앞뒤에 붙인다. 그 이름을 가리키는 참조도 같이 | 같은 클러스터에 `dev-`와 `stg-`를 나란히 |
| `labels` | 레이블을 붙인다. 셀렉터에 넣을지는 고른다 | 아래 |
| `commonAnnotations` | 어노테이션을 붙인다 | 담당 팀, 저장소 주소 |
| `images` | 이미지의 이름·태그·다이제스트를 바꾼다 | 5절 |
| `replicas` | 이름으로 고른 워크로드의 개수 | 패치 없이 한 줄로 |
| `commonLabels` | 레이블을 셀렉터까지 넣는다 | v5.0.0에서 폐기 예고. `labels`를 쓴다 |

```yaml
apiVersion:
  kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml

namespace: prod
namePrefix: prod-
labels:
- pairs:
    env: prod
    team: platform
  includeSelectors: false
  includeTemplates: true
commonAnnotations:
  owner: team-platform
replicas:
- name: my-app
  count: 5
```

| `labels`의 옵션 | 기본 | 붙는 곳 | 왜 |
|:------------|:----|:------|:---|
| `pairs` | | `metadata.labels` | 붙일 레이블 |
| `includeSelectors` | false | 거기에 더해 `spec.selector`와 파드 템플릿, Service의 `selector` | 셀렉터는 만든 뒤 못 바꾼다. 새로 만드는 것에만 켠다 |
| `includeTemplates` | false | `metadata.labels`와 파드 템플릿의 레이블 | 파드에도 레이블이 붙어야 비용 집계와 로그 검색에 쓴다. 셀렉터는 안 건드린다 |

이름이 바뀌면 참조도 따라간다. `namePrefix: prod-`가 ConfigMap `app-config`를 `prod-app-config`로 바꾸면, Deployment의 `configMapKeyRef`, `envFrom`, 볼륨의 `configMap.name`도 같은 이름으로 바뀐다. Service 이름을 가리키는 Ingress의 백엔드, ServiceAccount 이름, PVC 이름도 같다. Kustomize가 내장 리소스의 "이름을 가리키는 필드" 목록을 알고 있어서이고, 커스텀 리소스의 필드는 그 목록에 없어 따라가지 않는다.

{{< callout type="warning" >}}
**이미 도는 워크로드의 셀렉터에 레이블을 넣지 않는다.** `commonLabels`와 `includeSelectors: true`는 Deployment의 `spec.selector.matchLabels`와 Service의 `selector`에도 레이블을 넣는다. Deployment의 셀렉터는 만든 뒤 바꿀 수 없어 `field is immutable`로 적용이 실패하고, Service의 셀렉터는 바뀌긴 하지만 옛 파드를 놓친다. 기존 애플리케이션에 레이블을 더할 때는 `labels`에 `includeSelectors: false`(기본)로 두고, 파드에도 필요하면 `includeTemplates: true`를 쓴다.
{{< /callout >}}

---

## 5. Image Transformer

### 5.1 이미지 교체

```yaml
images:
- name: nginx        # 이미지 이름
  newTag: "1.27"
- name: my-app
  newName: reg.example.com/my-app
  newTag: v1.2.3
- name: redis
  digest: sha256:24a0c4b4a4c0...
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `name` | 바꿀 대상. 매니페스트의 `image:`에서 태그를 뗀 이름 | 컨테이너의 `name`이 아니다. `image: nginx:1.25`의 `nginx`다 |
| `newName` | 이름(레지스트리와 경로)을 바꾼다 | base는 짧은 이름으로 두고 환경마다 사내 레지스트리로 돌린다 |
| `newTag` | 태그를 바꾼다 | 배포마다 바뀌는 유일한 값인 경우가 많다 |
| `digest` | `@sha256:`로 고정 | [08](../08-security)장 8.1절. 태그는 움직이고 다이제스트는 안 움직인다 |

### 5.2 환경별 태그 전략

```yaml
# overlays/dev
images:
- name: my-app
  newTag: main-4f2a9c1   # 커밋마다

# overlays/prod
images:
- name: my-app
  newTag: v1.2.3         # 릴리스 태그
```

```bash
cd overlays/prod
kustomize edit set image \
  my-app=reg.example.com/my-app:v1.2.4
git commit -am "my-app v1.2.4"
```

`kustomize edit set image`는 `kustomization.yaml`의 `images` 항목을 고쳐 쓰는 명령이다. CI가 이미지를 빌드한 뒤 이 한 줄로 overlay를 고치고 커밋하면, 배포 이력이 Git 커밋으로 남는다. 셋째 원리가 이 모양이다. 되돌리기는 `git revert`다.

{{< callout type="info" >}}
**`name`은 이미지 이름이다.** `images`의 `name: nginx`는 모든 리소스의 모든 컨테이너에서 `image`가 `nginx`로 시작하는 것을 찾는다. `containers[].name`과 헷갈리기 쉽다. 같은 이미지를 쓰는 컨테이너가 여럿이면 전부 바뀐다. 초기화 컨테이너와 CronJob 안의 컨테이너도 찾아 준다. 커스텀 리소스 안의 이미지 필드는 위치를 모르므로 안 바뀐다.
{{< /callout >}}

---

## 6. Patches

### 6.1 Strategic Merge vs JSON 6902

| 구분 | Strategic Merge | JSON 6902 | 왜 |
|:-----|:--------------|:---------|:---|
| 모양 | 고칠 부분만 남긴 매니페스트 | `op`, `path`, `value`의 목록 | 앞의 것은 읽으면 무엇이 바뀌는지 보인다 |
| 목록 | 병합 키(컨테이너는 `name`)로 찾아 합친다 | 인덱스로 찾는다 | 순서가 바뀌어도 앞의 것은 맞는 원소를 찾는다 |
| 지우기 | 값을 `null`로, 목록 원소는 `$patch: delete` | `op: remove` | |
| 대상 | 패치에 적힌 종류와 이름, 또는 `target` | `target`이 필수 | JSON 6902에는 대상을 말하는 필드가 없다 |
| 커스텀 리소스 | 병합 키를 몰라 목록이 통째로 바뀐다 | 내장 리소스와 같다 | 스키마를 `openapi` 필드로 알려 주면 앞의 것도 된다 |
| 맞는 곳 | 필드 덮어쓰기와 추가. 기본 | 목록의 특정 자리, 필드 제거, 커스텀 리소스 | |

옛 필드 `patchesStrategicMerge`와 `patchesJson6902`는 폐기 예고됐고 둘 다 `patches` 하나로 쓴다. 패치가 둘 중 어느 형식인지는 Kustomize가 내용을 보고 안다.

### 6.2 JSON 6902 Patch

```yaml
patches:
- target:
    kind: Deployment
    name: my-app
  path: patches/tune.yaml
```

```yaml
# patches/tune.yaml
- op: replace
  path: /spec/replicas
  value: 5
- op: add
  path: /metadata/labels/version
  value: v2
- op: remove
  path: /metadata/annotations/old
```

| 경로 | 가리키는 것 | 왜 |
|:-----|:--------|:---|
| `/spec/replicas` | 필드 | 맵의 키를 `/`로 잇는다 |
| `/spec/template/spec/containers/0` | 목록의 첫 원소 | 인덱스는 0부터 |
| `/spec/template/spec/containers/-` | 목록의 끝. `add`로 덧붙일 때 | |
| `/metadata/annotations/example.com~1owner` | 키가 `example.com/owner`인 어노테이션 | 키 안의 `/`는 `~1`, `~`는 `~0`으로 적는다 |

| `op` | 하는 일 | 왜 |
|:-----|:------|:---|
| `add` | 없으면 만들고 있으면 바꾼다. 목록이면 끼워 넣는다 | |
| `replace` | 있는 것을 바꾼다. 없으면 실패 | 오타 난 경로가 조용히 새 필드를 만들지 않는다 |
| `remove` | 지운다. 없으면 실패 | |
| `test` | 값이 같은지 확인. 다르면 패치 전체가 실패 | base가 바뀐 것을 알아채는 안전장치 |

### 6.3 Strategic Merge Patch

```yaml
patches:
- target:
    kind: Deployment
    name: my-app
  patch: |-
    spec:
      replicas: 5
      template:
        spec:
          containers:
          - name: app  # 이름으로 찾음
            resources:
              limits:
                memory: 512Mi
          - name: debug
            $patch: delete
```

| `target`의 필드 | 고르는 것 | 왜 |
|:------------|:-------|:---|
| `group`, `version`, `kind` | API 종류 | `kind: Deployment`만 적으면 모든 Deployment |
| `name`, `namespace` | 이름. 정규식이고 앞뒤가 고정된다 | `name: web-.*`로 여럿을 한 번에 |
| `labelSelector`, `annotationSelector` | 레이블, 어노테이션 | 패치 하나를 조건에 맞는 전부에 |
| 적지 않으면 | Strategic Merge 패치는 패치 안의 `kind`와 `name`으로 | JSON 6902는 안 된다 |

`target`의 조건은 전부 맞아야 하고, 맞는 리소스가 하나도 없으면 빌드가 실패한다. 조용히 넘어가지 않으므로, base에서 이름을 바꾸면 그 이름을 가리키던 overlay의 패치가 바로 드러난다.

### 6.4 별도 파일 패치

```yaml
patches:
- path: patches/replicas.yaml
- path: patches/resources.yaml
  target:
    kind: Deployment
    labelSelector: tier=backend
```

패치가 열 줄을 넘으면 파일로 뺀다. 파일 하나가 관심사 하나(레플리카, 자원, 노드 선택)이면 overlay를 읽는 사람이 파일 이름만으로 무엇이 다른지 안다.

{{< callout type="info" >}}
**Strategic Merge를 기본으로 하고 JSON 6902는 보완으로 쓴다.** 컨테이너를 이름으로 찾는 앞의 방식은 base에 컨테이너가 하나 더 끼어들어도 맞는 것을 고친다. 인덱스로 찾는 뒤의 방식은 그때 엉뚱한 컨테이너를 고친다. JSON 6902는 목록의 정확한 자리에 끼워 넣어야 할 때, 필드를 지워야 할 때, 커스텀 리소스를 고칠 때 쓴다.
{{< /callout >}}

---

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
        ├── patches/
        └── monitoring.yaml
```

base와 overlay는 Kustomize의 문법이 아니라 관례다. 다른 디렉터리를 `resources`로 읽는 kustomization이 overlay이고, 읽히는 쪽이 base다. 그래서 overlay가 다시 다른 overlay의 base가 될 수 있지만, 층이 깊어지면 어느 층이 무엇을 바꿨는지 찾기 어렵다.

### 7.2 Base/Overlay 결정 트리

```text
이 설정은 모든 환경에서 같은가?
 ├─ 예  → base
 └─ 아니오
     값만 다른가?
      ├─ 예  → overlay의 patch,
      │        images, replicas
      └─ 아니오
          몇몇 환경에만 있는가?
           ├─ 기능 묶음 → component
           └─ 오브젝트 하나
               → overlay의 resources
```

| 놓는 곳 | 담는 것 | 왜 |
|:------|:------|:---|
| base | 모든 환경에 있는 오브젝트와 공통 필드. 네임스페이스, 환경 이름, 레플리카 수는 적지 않거나 가장 작은 값 | base가 환경을 알면 다른 환경이 그것을 되돌려야 한다 |
| overlay의 변환 | 네임스페이스, 접두사, 이미지 태그, 레플리카 | 환경마다 다른 값 |
| overlay의 패치 | 자원, 노드 선택, 환경 변수 | 값이 아니라 필드가 다른 것 |
| overlay의 `resources` | 그 환경에만 있는 오브젝트 | 운영에만 있는 PodDisruptionBudget, ServiceMonitor |
| component | 여러 환경이 골라 쓰는 기능 | 8절 |

### 7.3 Base 정의

```yaml
# base/kustomization.yaml
apiVersion:
  kustomize.config.k8s.io/v1beta1
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
        image: my-app
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
```

### 7.4 Production Overlay

```yaml
# overlays/production/kustomization.yaml
apiVersion:
  kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
- monitoring.yaml     # 운영에만

namespace: production
namePrefix: prod-
labels:
- pairs:
    env: production
  includeTemplates: true
images:
- name: my-app
  newName: reg.example.com/my-app
  newTag: v1.2.3
replicas:
- name: my-app
  count: 10
patches:
- path: patches/resources.yaml
```

```yaml
# .../production/patches/resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app        # base의 이름
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            memory: 512Mi
```

```bash
kustomize build overlays/production
kubectl diff -k overlays/production
kubectl apply -k overlays/production
```

패치의 `name: my-app`은 base의 이름이다. 결과의 이름은 `prod-my-app`이지만, 2.1절의 순서대로 패치가 접두사보다 먼저 적용되기 때문이다. overlay 전체가 스무 줄 남짓이고, 그 스무 줄이 "운영은 기본과 이것이 다르다"의 전부다.

---

## 8. Components

### 8.1 개념

```text
k8s/
├── base/
├── components/
│   ├── caching/
│   │   ├── kustomization.yaml
│   │   └── redis.yaml
│   └── external-db/
│       └── ...
└── overlays/
    ├── dev/         external-db
    ├── premium/    caching+external-db
    └── standalone/  caching
```

| 문제 | overlay만으로 | component로 | 왜 |
|:-----|:-----------|:----------|:---|
| 기능 둘을 환경 셋이 다르게 조합 | 같은 패치를 overlay마다 복사 | 기능마다 component 하나, overlay는 고르기만 | overlay는 한 줄기로만 상속한다. 조합은 상속으로 표현이 안 된다 |
| 기능을 하나 더하면 | 모든 overlay에 복사 | component 하나를 더하고 필요한 곳에서 고른다 | |

Kustomize에는 조건문이 없다. 그 자리를 component가 맡는다. "캐시를 켠다"는 것은 Redis Deployment를 더하고 앱에 `REDIS_HOST`를 넣는 일의 묶음이고, 그 묶음을 overlay가 목록에 적으면 켜지고 안 적으면 꺼진다.

### 8.2 Component 정의

```yaml
# components/caching/kustomization.yaml
apiVersion:
  kustomize.config.k8s.io/v1alpha1
kind: Component     # Kustomization 아님

resources:
- redis.yaml

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
apiVersion:
  kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
components:
- ../../components/caching
- ../../components/external-db
```

| 다른 점 | base (디렉터리를 `resources`로) | component | 왜 |
|:------|:------------------------|:---------|:---|
| 종류 | `Kustomization` | `Component` | |
| 빌드 | 혼자 빌드된 뒤 결과가 합쳐진다 | 그때까지 모인 리소스 위에서 적용된다 | component의 패치는 자기가 선언하지 않은 `my-app`을 고칠 수 있다. base의 패치는 자기 안의 것만 고친다 |
| 순서 | | `resources`가 다 모인 뒤, 적은 순서대로 | 뒤의 component가 앞의 것이 만든 것을 고칠 수 있다 |
| 혼자 빌드 | 된다 | 안 된다 | 고칠 대상이 밖에 있다 |

---

## 9. Generators

### 9.1 ConfigMap / Secret 생성

```yaml
configMapGenerator:
- name: app-config
  literals:
  - DATABASE_HOST=db
  - DATABASE_PORT=5432
- name: app-files
  files:
  - application.properties
  - nginx.conf=conf/nginx-prod.conf
- name: app-env
  envs:
  - app.env

secretGenerator:
- name: db-credentials
  envs:
  - secrets.env      # Git에 넣지 않는다
  type: Opaque
```

| 출처 | 만들어지는 키 | 왜 |
|:-----|:---------|:---|
| `literals` | `키=값`마다 하나 | 몇 개 안 되는 설정 |
| `files` | 파일 이름이 키, 내용이 값. `키=경로`로 키를 바꾼다 | 설정 파일을 통째로 |
| `envs` | 파일 안의 `키=값` 줄마다 하나 | `.env` 파일을 그대로 |
| `behavior: merge` | base의 제너레이터가 만든 것에 키를 더하거나 덮는다. `replace`면 통째로 | overlay가 base의 ConfigMap에 값 하나만 바꿀 때. 이름이 같아야 한다 |

### 9.2 해시 접미사

```yaml
# 빌드 결과
kind: ConfigMap
metadata:
  name: app-config-k5h9m8c2df
---
kind: Deployment
spec:
  template:
    spec:
      containers:
      - envFrom:
        - configMapRef:
            name: app-config-k5h9m8c2df
```

제너레이터가 만든 ConfigMap과 Secret의 이름에는 내용의 해시가 붙고, 그것을 가리키는 워크로드의 참조도 같은 이름으로 바뀐다. 값이 바뀌면 해시가 바뀌고, 이름이 바뀌니 새 ConfigMap이 만들어지고, Deployment의 파드 템플릿이 달라졌으니 롤아웃이 일어난다. [04](../04-workloads)장 8절의 "환경 변수로 읽은 ConfigMap은 파드를 다시 띄워야 바뀐다"를 이름으로 푼 것이고, [11](../11-helm)장 6절의 `checksum/config` 어노테이션과 같은 목적의 다른 방법이다.

| 옵션 | 뜻 | 왜 |
|:-----|:--|:---|
| 해시 (기본) | 내용이 바뀌면 이름이 바뀐다 | 설정 변경이 롤아웃을 일으키고, 롤백하면 옛 ConfigMap이 그대로 있어 설정도 같이 돌아간다 |
| `disableNameSuffixHash: true` | 이름을 고정 | 이름을 밖에서 아는 경우(다른 도구가 이 이름으로 읽는다). 자동 롤아웃은 사라진다 |
| `immutable: true` | 만든 뒤 못 바꾸는 ConfigMap | 해시와 짝이 맞다. 어차피 새 이름으로 새로 만든다 |
| `generatorOptions` | 모든 제너레이터에 공통으로 | 레이블, 어노테이션, 해시 끄기 |

셋째 원리의 한 조각이다. 이름이 바뀔 때마다 새 ConfigMap이 생기는데, `kubectl apply -k`는 옛것을 지우지 않는다. 옛 ConfigMap은 옛 ReplicaSet이 가리키고 있어 롤백에 쓸모가 있지만 끝없이 쌓인다. 정리는 적용하는 쪽의 일이라, ArgoCD의 prune(10절)이나 주기적인 삭제로 한다.

{{< callout type="warning" >}}
**`secretGenerator`의 값을 Git에 넣지 않는다.** `literals`에 비밀번호를 적으면 그것이 저장소에 평문으로 남는다. Kustomize는 Secret을 만들 뿐 암호화하지 않는다. `envs`나 `files`로 읽되 그 파일은 Git에 넣지 않고 배포 시점에 만들어 주거나, 비밀은 Kustomize 밖에서 [13](../13-cicd)장 7절의 External Secrets, Sealed Secrets로 다룬다.
{{< /callout >}}

### 9.3 replacements

```yaml
replacements:
- source:
    kind: Service
    name: db
    fieldPath: metadata.name
  targets:
  - select:
      kind: Deployment
      name: my-app
    fieldPaths:
    - "spec.template.spec.\
      containers.[name=app].\
      env.[name=DB_HOST].value"
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `source` | 값을 가져올 리소스와 필드. 기본은 `metadata.name` | 접두사가 붙은 뒤의 실제 이름을 가져온다 |
| `targets.select`, `reject` | 값을 넣을 리소스 | 여럿에 한 번에 |
| `fieldPaths` | 넣을 자리. 목록은 `[name=app]`처럼 키로, 숫자로, `*`로 | 인덱스에 묶이지 않게 |
| `options.delimiter`, `index` | 값을 구분자로 잘라 그 조각만 바꾼다 | `host:port`에서 호스트만 |
| `options.create` | 자리가 없으면 만든다 | 기본은 있는 자리만 |

`replacements`는 옛 `vars`의 자리다. `vars`는 매니페스트 안에 `$(NAME)`을 적어 두는 방식이라 base가 Kustomize 없이는 뜻이 없는 YAML이 됐고, 첫째 원리에 어긋났다. `replacements`는 자리 표시 없이 "이 필드의 값을 저 필드에 넣어라"만 적는다. 옛 필드들은 `kustomize edit fix`가 새 필드로 옮겨 적어 준다.

위 예의 `fieldPaths`는 경로가 길어 큰따옴표로 감싸고 줄 끝의 `\`로 이었다. YAML의 큰따옴표 문자열에서 줄 끝의 `\`는 줄바꿈과 다음 줄의 들여쓰기를 없애므로, 세 줄이 점으로 이어진 경로 하나로 읽힌다.

---

## 10. ArgoCD Kustomize 통합

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL:
      https://github.com/org/manifests
    targetRevision: main
    path: overlays/production
    kustomize:
      images:
      - my-app:v1.2.4
      namePrefix: prod-
  destination:
    server:
      https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```text
Git (overlays/production)
        │ 변경 감지
        ▼
ArgoCD: kustomize build
        │ 결과와 클러스터를 견줌
        ▼
클러스터에 적용, 없어진 것은 prune
        ▲
        └ 누가 손으로 고치면 되돌림
```

ArgoCD는 `path`에 `kustomization.yaml`이 있으면 Kustomize 디렉터리로 보고 `kustomize build`를 돌려, 그 결과를 "있어야 할 상태"로 삼는다. [13](../13-cicd)장 5절의 Application이 이것이다. 셋째 원리의 빈자리를 채우는 것이 여기다. 기록은 Git의 커밋이, 적용은 동기화가, 9.2절의 옛 ConfigMap 정리는 `prune`이 한다.

| `spec.source.kustomize`의 필드 | 하는 일 | 왜 |
|:-------------------------|:------|:---|
| `images` | `이름:태그`나 `이름=새이름:태그` 형식으로 이미지를 덮는다 | Git을 안 고치고 태그만 바꿀 때. 다만 Git에 기록이 안 남는다 |
| `namePrefix`, `nameSuffix`, `namespace` | 같은 이름의 변환 | Application마다 다르게 |
| `commonLabels`, `labelWithoutSelector: true` | 레이블. 뒤의 것을 켜면 셀렉터에 안 넣는다 | 4절의 셀렉터 문제 |
| `replicas`, `patches`, `components` | 같은 이름의 필드 | overlay를 만들지 않고 Application에서 조금만 바꿀 때 |
| `version` | 쓸 Kustomize 버전 | 2.3절. `argocd-cm`에 등록한 버전 중에서 |

`helmCharts`를 쓰는 디렉터리는 ArgoCD의 `argocd-cm`에 `kustomize.buildOptions: --enable-helm`을 적어야 빌드된다. 원격 base가 비공개 저장소면 Application의 저장소와 같은 자격 증명일 때만 받아진다.

{{< callout type="info" >}}
**태그는 Git에서 바꾼다.** CI가 이미지를 빌드한 뒤 5.2절의 `kustomize edit set image`로 overlay를 고쳐 커밋하면, ArgoCD가 그 커밋을 보고 동기화한다. 배포가 곧 커밋이라 누가 언제 무엇을 올렸는지가 Git에 남고, 되돌리기는 `git revert`다. Application의 `kustomize.images`로 덮으면 빠르지만 그 사실은 Git에 없다.
{{< /callout >}}

---

## 11. 안티패턴

| 안티패턴 | 생기는 일 | 고치는 법 | 왜 |
|:-------|:-------|:------|:---|
| overlay에 base의 파일을 통째로 복사 | base를 고쳐도 그 환경에 안 간다 | 바뀌는 필드만 `patches`로 | 첫째 원리. overlay는 차이만 |
| 같은 패치를 overlay마다 복사 | 한 곳을 고치면 나머지가 어긋난다 | 전부 같으면 base로, 일부만 같으면 component로 | 7.2절 |
| 기존 앱에 `commonLabels` 추가 | `field is immutable`로 적용 실패 | `labels`, `includeSelectors: false` | 4절 |
| base에 `namespace`와 환경 이름 | 다른 환경이 그것을 되돌려야 한다 | base에는 적지 않는다 | base는 환경을 몰라야 한다 |
| 해시를 전부 끔 | 설정을 바꿔도 파드가 옛 값으로 돈다 | 기본(해시 켬)을 유지 | 9.2절 |
| 인덱스로 찾는 JSON 6902를 남발 | base의 목록 순서가 바뀌면 엉뚱한 원소를 고친다 | Strategic Merge로 이름을 찾는다. 꼭 필요하면 `op: test`를 앞에 | 6절 |
| overlay의 overlay의 overlay | 어느 층이 바꿨는지 찾지 못한다 | base와 overlay 두 층. 조합은 component로 | |
| `ref` 없는 원격 base | 같은 커밋이 어제와 오늘 다르게 빌드된다 | 태그나 커밋 해시를 박는다 | 3절 |
| `vars`, `patchesStrategicMerge`, `bases` | 폐기 예고. 새 버전에서 경고, 다음 API에서 제거 | `kustomize edit fix`로 옮긴다 | |
| `secretGenerator`에 평문 비밀 | 저장소에 비밀이 남는다 | 9.1절의 경고 | |
| 빌드 결과를 안 보고 적용 | 패치가 기대와 다르게 먹는다 | `kustomize build`와 `kubectl diff -k`를 먼저 | 둘째 원리 |

---

## 12. 명령어 요약

```bash
# 빌드 (보기만)
kustomize build overlays/production
kubectl kustomize overlays/production

# 클러스터와 차이
kubectl diff -k overlays/production

# 적용 / 삭제
kubectl apply -k overlays/production
kubectl delete -k overlays/production

# 이미지 태그를 고쳐 커밋 (GitOps)
cd overlays/production
kustomize edit set image \
  my-app=reg.example.com/my-app:v1.2.4
git commit -am "my-app v1.2.4"

# 그 밖의 edit
kustomize edit set namespace prod
kustomize edit add resource pdb.yaml
kustomize edit fix    # 옛 필드 옮기기

# Helm 차트를 품은 디렉터리
kustomize build --enable-helm .

# 파일로 저장
kustomize build overlays/production \
  > manifests.yaml
```

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Kustomize | 원본 YAML에 차이를 얹는다 | base는 그대로 쓸 수 있는 매니페스트 |
| 빌드 파이프라인 | 모으기 → 만들기 → 패치 → 일괄 변환 → 복사 → 정렬 | 필드를 적은 순서와 무관하다 |
| base / overlay | 공통 / 환경의 차이 | 문법이 아니라 관례. 두 층으로 |
| 변환 | `namespace`, `namePrefix`, `labels`, `images`, `replicas` | 이름이 바뀌면 참조도 따라간다 |
| `labels` | 셀렉터에 넣을지를 고른다 | `commonLabels`는 폐기 예고 |
| 패치 | Strategic Merge가 기본, JSON 6902는 보완 | 이름으로 찾기와 인덱스로 찾기 |
| 패치 대상 | 접두사가 붙기 전의 이름 | 패치가 변환보다 먼저다 |
| component | overlay가 골라 쓰는 기능 묶음 | 조건문의 자리 |
| 제너레이터 | ConfigMap·Secret을 만들고 이름에 해시 | 설정 변경이 롤아웃이 된다 |
| `replacements` | 한 필드의 값을 다른 필드들에 | `vars`의 자리. 자리 표시가 없다 |
| 버전 | 독립, kubectl 내장, ArgoCD 내장이 다를 수 있다 | 결과가 다르면 버전부터 |
| 기록과 정리 | Git과 ArgoCD | Kustomize에는 릴리스가 없다 |

{{< callout type="info" >}}
**용어 정리**
- **kustomization.yaml**: 디렉터리마다 하나 있는 빌드 선언
- **base**: 다른 kustomization이 `resources`로 읽는 공통 디렉터리
- **overlay**: base를 읽고 환경의 차이를 얹는 디렉터리
- **트랜스포머**: 모든 리소스에 같은 변환을 거는 필드. `namespace`, `labels`, `images`
- **이름 참조**: 이름이 바뀐 리소스를 가리키는 필드. Kustomize가 같이 바꾼다
- **Strategic Merge Patch**: 고칠 부분만 남긴 매니페스트. 목록은 병합 키로 합친다
- **JSON 6902 Patch**: `op`, `path`, `value`로 적는 패치. RFC 6902
- **component**: `kind: Component`. 여러 overlay가 골라 쓰는 리소스와 패치의 묶음
- **제너레이터**: 파일과 값에서 ConfigMap, Secret을 만드는 필드
- **해시 접미사**: 제너레이터가 이름 뒤에 붙이는 내용의 해시
- **replacements**: 한 필드의 값을 다른 필드에 복사하는 필드
- **helmCharts**: 차트를 렌더링해 리소스로 들이는 필드. `--enable-helm` 필요
- **prune**: Git에서 사라진 오브젝트를 클러스터에서 지우는 ArgoCD의 동작
{{< /callout >}}
