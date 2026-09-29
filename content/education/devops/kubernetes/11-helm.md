---
title: "11. Helm"
date: 2026-04-23
weight: 11
---

[07. 네트워킹](../07-networking) 8.3절에서 Traefik을, [09. 관측성](../09-observability) 10절에서 모니터링 스택을 `helm install` 한 줄로 깔았다. 그 한 줄 뒤에서 오브젝트 수십 개가 만들어졌는데, 무엇이 어떤 값으로 만들어졌고 어떻게 되돌리는지는 넘어갔다. 이 장이 그 한 줄을 푼다. 원리는 셋이다. 첫째, **차트는 매니페스트를 찍어 내는 틀이고, 값(values)이 그 틀에 들어가는 유일한 입력이다.** 템플릿에 값을 넣어 렌더링하면 평범한 YAML이 나오고, Helm이 클러스터에 보내는 것은 결국 그 YAML이다. 둘째, **릴리스는 "무엇을 어떤 값으로 설치했는가"의 기록이고, 리비전마다 Secret 하나로 클러스터 안에 남는다.** 업그레이드와 롤백은 그 기록 사이를 오가는 일이며, 롤백도 새 리비전을 만든다. 셋째, **Helm은 오브젝트를 적용할 뿐이고 데이터와 CRD와 훅이 만든 것은 돌보지 않는다.** 롤백은 스펙만 되돌리고, `crds/`의 CRD는 설치만 할 뿐 올리지도 지우지도 않으며, 훅이 만든 Job은 릴리스의 것이 아니다. Helm이 하는 일의 경계를 아는 것이 Helm을 쓰는 법의 절반이다.

---

## 1. Helm의 개념

```text
[손으로]
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f configmap.yaml
  버전과 롤백은 사람 몫

[Helm]
helm install app ./chart
  렌더링 → 한 번에 적용 → 리비전 1
  되돌리기: helm rollback
```

| 하는 일 | 뜻 | 왜 필요한가 |
|:-------|:--|:---------|
| 묶기 | Deployment, Service, ConfigMap, RBAC를 차트 하나로 | 애플리케이션 하나는 오브젝트 열 개쯤이다. 따로 적용하면 순서와 빠뜨림이 문제다 |
| 값 넣기 | 같은 틀에 환경마다 다른 값 | YAML을 환경 수만큼 복사하면 하나를 고칠 때 셋을 고쳐야 한다 |
| 기록하기 | 설치·업그레이드마다 리비전 | [04](../04-workloads)장 5절의 Deployment 리비전은 Deployment 하나의 이력이다. 릴리스 리비전은 애플리케이션 전체의 이력이다 |
| 의존성 | 차트가 다른 차트를 품는다 | 모니터링 스택은 Grafana, kube-state-metrics, node-exporter 차트를 하위 차트로 끌어온다 |
| 나누기 | 저장소나 OCI 레지스트리로 배포 | 남이 만든 애플리케이션을 버전을 찍어 받는다 |

첫째 원리다. Helm은 kubectl을 대신하는 것이 아니라 kubectl 앞에 선다. 차트의 템플릿에 값을 넣어 YAML을 만들고, 그것을 API 서버에 적용하고, 무엇을 적용했는지 적어 둔다. [08](../08-security)장의 세 문은 Helm이 보낸 요청에도 똑같이 적용되어, Helm을 돌리는 사람의 권한만큼만 만들어진다.

---

## 2. Helm 2 vs Helm 3

```text
[Helm 2]          [Helm 3, 4]
  CLI               CLI
   │                 │ kubeconfig의 신원
   ▼                 ▼
 Tiller           API 서버 (RBAC)
 (클러스터 안,
  전역 권한)
   │
   ▼
 API 서버
```

| 항목 | Helm 2 | Helm 3 | Helm 4 | 왜 바뀌었나 |
|:-----|:------|:------|:------|:--------|
| 구조 | CLI → Tiller → API | CLI → API | 같다 | Tiller는 클러스터 관리자 권한으로 돌아서, Tiller에 말할 수 있는 사람은 누구나 관리자였다 |
| 권한 | Tiller의 것 | 명령을 친 사람의 것 | 같다 | RBAC이 그대로 적용된다 |
| 릴리스 저장 | kube-system의 ConfigMap | 릴리스 네임스페이스의 Secret | 같다 | 네임스페이스 권한으로 릴리스를 가둔다 |
| 차트 API | v1 | v2 (`dependencies`, `type`) | v2. v3는 실험 단계 | 의존성을 Chart.yaml 하나에 |
| 적용 방식 | 2-way 병합 | 3-way 병합 | 새 릴리스는 서버 사이드 어플라이 | 클러스터에서 손으로 고친 것을 알아채기 위해. 아래 |
| 기다리기 | | 자체 판정 | kstatus 기반 | 커스텀 리소스의 준비 상태까지 표준으로 읽는다 |

### Helm 4

Helm 4.0은 2025년 11월에 나왔고, 6년 만의 메이저 버전이다. 지금의 최신은 4.3이고 쿠버네티스 1.37에서 1.34까지를 지원한다. Helm 3은 기능 추가와 버그 수정이 끝났고 2026년 11월 11일까지 보안 수정만 받는다. 차트는 그대로 쓴다. `apiVersion: v2` 차트는 Helm 4에서도 같은 차트다.

| 바뀐 것 | Helm 3 | Helm 4 | 왜 |
|:------|:------|:------|:---|
| 적용 방식 | 클라이언트가 세 쪽을 비교해 패치 | 새로 설치하는 릴리스는 서버 사이드 어플라이. `--server-side`는 `auto`가 기본 | 필드의 주인을 서버의 `managedFields`가 기억한다. Helm 3이 설치한 릴리스는 예전 방식을 이어 간다 |
| 실패 시 되돌리기 | `--atomic` | `--rollback-on-failure` | 이름이 하는 일을 말하게 |
| 강제 교체 | `--force` | `--force-replace`. 충돌을 누르는 것은 `--force-conflicts` | 둘은 다른 일이다 |
| 기다리기 | `--wait` | `--wait`만 쓰면 `watcher`, 값으로 `hookOnly`·`legacy`. 안 쓰면 `hookOnly` | kstatus로 리소스 종류마다의 준비 조건을 읽는다 |
| 플러그인 | 실행 파일 | 종류(CLI, getter, post-renderer)가 나뉘고 WebAssembly 런타임 추가 | 플러그인이 호스트에서 무엇이든 하지 못하게 |
| 포스트 렌더러 | 아무 실행 파일 | 플러그인 이름으로만 | 위와 같은 이유 |
| 레지스트리 로그인 | URL 허용 | 도메인만 | `helm registry login reg.example.com` |
| 차트 참조 | 태그 | 다이제스트(`@sha256:`)도 | [08](../08-security)장 8.1절의 이미지와 같은 이유 |

3-way 병합과 서버 사이드 어플라이는 [02](../02-core-concepts)장 10.3절의 `kubectl apply` 두 방식과 같은 것이다. 3-way는 지난 리비전의 매니페스트, 이번 매니페스트, 클러스터의 실제 상태 세 쪽을 견줘 "내가 지운 필드"와 "남이 붙인 필드"를 가른다. 그래서 누가 `kubectl edit`로 레플리카를 바꿔 놓았어도 Helm이 관리하지 않는 필드는 덮어쓰지 않는다. 서버 사이드 어플라이는 그 기억을 서버로 옮긴 것이다. 필드마다 주인이 적혀 있어서, HPA가 주인인 `replicas`를 Helm이 건드리려 하면 충돌로 거절되고, 그래도 가져오려면 `--force-conflicts`를 준다.

---

## 3. 핵심 구성요소

```text
저장소 / OCI 레지스트리
        │ pull
        ▼
차트 (Chart.yaml, values.yaml,
      templates/)
        │ + 값  → 렌더링
        ▼
릴리스 (이름, 네임스페이스)
  리비전 1, 2, 3 ...
  리비전마다 Secret 하나
```

| 용어 | 뜻 | 비유 | 왜 따로 있는가 |
|:-----|:--|:----|:-----------|
| 차트 (Chart) | 템플릿과 기본값의 묶음 | 설치 프로그램 | 버전을 찍어 나눌 수 있는 단위 |
| 값 (values) | 틀에 넣는 입력 | 설치 옵션 | 같은 차트를 환경마다 다르게 |
| 릴리스 (Release) | 차트를 설치한 하나의 인스턴스. 이름 + 네임스페이스 | 설치된 프로그램 | 같은 차트를 `blog-prod`, `blog-dev`로 둘 깔 수 있다 |
| 리비전 (Revision) | 릴리스의 어느 시점. 설치, 업그레이드, 롤백마다 하나 | 프로그램의 버전 | 되돌아갈 곳 |
| 저장소 (Repository) | 차트를 올려 두는 곳. HTTP 저장소 또는 OCI 레지스트리 | 앱 스토어 | 차트의 배포 경로 |

둘째 원리다. 릴리스의 기록은 클러스터 안에 있다. 릴리스가 설치된 네임스페이스에 `sh.helm.release.v1.<이름>.v<리비전>`이라는 Secret이 리비전마다 하나씩 생기고, 그 안에 차트와 그때 쓴 값과 렌더링된 매니페스트가 압축되어 들어 있다. `helm list`는 이 Secret들을 읽는 것이다. 그래서 다른 PC에서 같은 클러스터에 붙어도 릴리스가 보이고, 네임스페이스를 지우면 릴리스 기록도 같이 지워진다.

| 릴리스 저장 | 값 | 왜 |
|:---------|:--|:---|
| 어디에 | 릴리스 네임스페이스의 Secret (`type: helm.sh/release.v1`) | 네임스페이스의 Secret을 읽을 수 있는 사람은 릴리스의 값도 읽는다. 값에 비밀번호를 넣으면 거기 남는다([08](../08-security)장 4절) |
| 몇 개 | 릴리스마다 최근 10개 (`--history-max`) | 무한히 쌓이면 etcd를 채운다 |
| 크기 | Secret 하나의 한도 1MB | 매우 큰 차트는 SQL 저장(`HELM_DRIVER=sql`)을 쓴다 |
| 다른 저장 방식 | `HELM_DRIVER=configmap`, `sql` | ConfigMap은 값이 평문으로 보여 권하지 않는다 |

---

## 4. 설치

```bash
# 설치 스크립트 (Helm 4)
curl -fsSL -o get_helm.sh \
  https://raw.githubusercontent.com/\
helm/helm/main/scripts/get-helm-4
chmod 700 get_helm.sh && ./get_helm.sh

# 패키지 관리자
brew install helm            # macOS
sudo dnf install helm        # Fedora
sudo snap install helm --classic
winget install Helm.Helm     # Windows

helm version
```

| Helm | 지원하는 쿠버네티스 | 왜 |
|:-----|:--------------|:---|
| 4.3.x | 1.37 ~ 1.34 | 빌드할 때 쓴 클라이언트 라이브러리의 버전과 그 아래 세 마이너 |
| 4.2.x | 1.36 ~ 1.33 | |
| 4.1.x | 1.35 ~ 1.32 | |
| 4.0.x | 1.34 ~ 1.31 | |

Helm은 클러스터에 아무것도 깔지 않는다. 바이너리 하나이고, [08](../08-security)장 2.5절의 kubeconfig로 API 서버에 말한다. 클러스터를 [10](../10-cluster-maintenance)장대로 올렸으면 Helm도 그 버전을 지원하는 것으로 올린다. 자기보다 새로운 쿠버네티스에 쓰는 것은 지원 밖이다.

---

## 5. Chart 구조

```text
my-app/
├── Chart.yaml          메타데이터
├── Chart.lock          의존성 고정
├── values.yaml         기본값
├── values.schema.json  값 검증 (선택)
├── charts/             하위 차트
├── crds/               CRD, 템플릿 아님
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl    헬퍼 (출력 없음)
│   ├── NOTES.txt       설치 뒤 안내
│   └── tests/          helm test
└── .helmignore
```

| 경로 | 담는 것 | 왜 |
|:-----|:------|:---|
| `templates/` | Go 템플릿으로 쓴 매니페스트 | 값이 들어가 YAML이 된다 |
| `_`로 시작하는 파일 | 헬퍼 정의 | 매니페스트를 내지 않는다. 다른 템플릿이 불러 쓴다 |
| `values.yaml` | 모든 값의 기본값 | 차트의 "설정 가능한 것" 목록이기도 하다 |
| `values.schema.json` | 값의 JSON 스키마 | install, upgrade, lint, template 때 검사한다. 오타 난 키와 틀린 타입을 렌더링 전에 잡는다 |
| `charts/` | 하위 차트의 압축 파일 | `helm dependency update`가 받아 넣는다 |
| `crds/` | CRD의 평범한 YAML | 템플릿보다 먼저 설치된다. 템플릿을 못 쓰고, 업그레이드와 삭제가 없다(14절) |
| `NOTES.txt` | 설치 뒤 화면에 찍을 안내 | 접속 주소 같은 것을 값으로 만들어 보여 준다 |

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: 예시 애플리케이션
type: application     # 또는 library
version: 1.2.0        # 차트의 버전
appVersion: "2.0.1"   # 앱의 버전
kubeVersion: ">=1.34.0-0"
dependencies:
- name: cache
  version: "~3.1.0"
  repository:
    oci://reg.example.com/charts
  condition: cache.enabled
```

| 필드 | 가리키는 것 | 올리는 때 | 왜 |
|:-----|:--------|:-------|:---|
| `version` | 차트 자체. SemVer 2 | 템플릿이나 기본값을 고칠 때마다 | 저장소는 이름과 버전으로 차트를 구분한다 |
| `appVersion` | 차트가 배포하는 앱 | 이미지 태그가 바뀔 때 | 따옴표로 감싼다. `1.10`이 숫자 1.1로 읽히지 않게 |
| `type` | `application` 또는 `library` | | library 차트는 헬퍼만 담고 설치되지 않는다 |
| `kubeVersion` | 지원하는 쿠버네티스 범위 | | 맞지 않는 클러스터에는 설치를 거절한다 |
| `dependencies` | 하위 차트. `condition`으로 값에 따라 켜고 끈다 | | `cache.enabled: false`면 그 하위 차트는 렌더링되지 않는다 |

{{< callout type="info" >}}
**차트 버전은 고칠 때마다 올린다.** `version`을 그대로 두고 내용을 바꿔 올리면 저장소와 로컬 캐시가 같은 이름의 다른 차트를 갖게 되어, 누구는 옛것을 누구는 새것을 받는다. `appVersion`만 바꿔도 차트가 달라진 것이므로 `version`도 올린다. 호환이 깨지는 변경(값의 키 이름 변경 등)은 메이저를 올린다.
{{< /callout >}}

---

## 6. 템플릿 문법

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "app.fullname" . }}
  labels:
    {{- include "app.labels" .
        | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include
          (print $.Template.BasePath
            "/configmap.yaml") .
          | sha256sum }}
    spec:
      containers:
      - name: app
        image:
          {{ include "app.image" . }}
        ports:
        - containerPort:
            {{ .Values.service.port }}
```

`{{ }}` 안이 Go 템플릿이고 밖은 그대로 나간다. `.`은 지금의 문맥이고, 맨 위에서는 아래 내장 객체들을 담은 뿌리다. `{{-`와 `-}}`는 그쪽의 공백과 줄바꿈을 지운다. YAML은 들여쓰기가 뜻이라, 여러 줄을 끼워 넣을 때는 `nindent 4`처럼 줄마다 들여쓰기를 붙인다.

`checksum/config` 어노테이션은 ConfigMap 템플릿의 해시다. [04](../04-workloads)장 8절대로 환경 변수로 읽은 ConfigMap은 파드를 다시 띄우기 전까지 안 바뀌는데, 해시가 파드 템플릿에 들어 있으면 ConfigMap이 바뀔 때 해시가 바뀌고, 그것이 템플릿 변경이라 롤아웃이 일어난다.

### 내장 객체

| 객체 | 담는 것 | 예 | 왜 |
|:-----|:------|:---|:---|
| `.Values` | 합쳐진 값 | `.Values.replicaCount` | 유일한 입력 |
| `.Release` | 릴리스 정보 | `.Release.Name`, `.Release.Namespace`, `.Release.Revision`, `.Release.IsUpgrade` | 같은 차트의 여러 릴리스가 이름으로 안 겹치게 |
| `.Chart` | Chart.yaml | `.Chart.Name`, `.Chart.AppVersion` | 레이블과 이미지 태그의 기본값 |
| `.Capabilities` | 클러스터가 아는 것 | `.Capabilities.KubeVersion`, `.Capabilities.APIVersions.Has` | 클러스터 버전에 따라 다른 API 버전을 낸다 |
| `.Files` | 차트 안의 템플릿 아닌 파일 | `.Files.Get "conf/app.ini"` | 설정 파일을 ConfigMap에 넣는다 |
| `.Template` | 지금 렌더링하는 파일 | `.Template.BasePath` | 위의 체크섬처럼 다른 템플릿을 가리킬 때 |

### 제어 구문

```yaml
# 조건
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
{{- end }}

# 반복
env:
{{- range $k, $v := .Values.env }}
- name: {{ $k }}
  value: {{ $v | quote }}
{{- end }}

# 필수값
image: {{ required "repository 필요"
  .Values.image.repository }}

# 파이프라인
name: {{ .Values.name | lower
  | trunc 63 | trimSuffix "-" }}

# 블록을 통째로
resources:
  {{- toYaml .Values.resources
      | nindent 2 }}
```

| 구문 | 하는 일 | 왜 |
|:-----|:------|:---|
| `if` / `else` / `end` | 조건에 따라 내거나 뺀다 | 빈 값, 0, `false`, `nil`은 거짓이다 |
| `range` | 목록이나 맵을 돈다 | 안에서 `.`이 원소로 바뀐다. 뿌리는 `$`로 부른다 |
| `with` | 문맥을 좁힌다 | `.Values.a.b.c`를 반복해 쓰지 않게 |
| `\|` 파이프라인 | 앞의 결과를 뒤 함수의 마지막 인자로 | `quote`, `default`, `upper`, `b64enc`, `toYaml` 같은 Sprig 함수들 |
| `required` | 값이 없으면 메시지와 함께 실패 | 빠뜨린 값으로 반쯤 만들어진 매니페스트가 나가지 않게 |
| `quote` | 문자열에 따옴표 | 문자열은 감싸고 정수는 감싸지 않는다. 환경 변수의 값은 늘 문자열이다 |
| `lookup` | 클러스터의 오브젝트를 읽는다 | `helm template`과 클라이언트 드라이런에서는 빈 값이 온다. 클러스터에 안 물으니까 |

### 헬퍼 템플릿

```yaml
# templates/_helpers.tpl
{{- define "app.fullname" -}}
{{- printf "%s-%s" .Release.Name
    .Chart.Name | trunc 63
    | trimSuffix "-" }}
{{- end }}

{{- define "app.image" -}}
{{ .Values.image.repository }}:
{{- .Values.image.tag
    | default .Chart.AppVersion }}
{{- end }}

{{- define "app.labels" -}}
app.kubernetes.io/name:
  {{ .Chart.Name }}
app.kubernetes.io/instance:
  {{ .Release.Name }}
app.kubernetes.io/version:
  {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by:
  {{ .Release.Service }}
{{- end }}
```

`define`은 이름 붙은 조각을 만들고 `include`가 그것을 문자열로 돌려준다. 내장 `template`도 같은 일을 하지만 결과를 파이프라인에 넘길 수 없어, `nindent`를 붙이려면 `include`를 쓴다. 헬퍼의 이름은 전역이라 하위 차트와 겹치지 않게 차트 이름을 앞에 붙인다. 이름을 63자에서 자르는 것은 쿠버네티스 이름과 레이블 값의 한도가 63자여서다.

---

## 7. 값 오버라이드 우선순위

```text
낮음 ───────────────────────▶ 높음
차트의 values.yaml
 → 부모 차트의 values.yaml
   → -f a.yaml
     → -f b.yaml (뒤의 것이 이긴다)
       → --set, --set-string,
         --set-json, --set-file
```

```bash
helm install app ./my-app \
  -f values-common.yaml \
  -f values-prod.yaml \
  --set image.tag=2.0.1
```

| 출처 | 우선 | 왜 |
|:-----|:----|:---|
| 차트의 `values.yaml` | 가장 낮다 | 기본값 |
| 부모 차트의 값 | 하위 차트의 기본값을 덮는다 | 부모의 `cache:` 아래에 적은 것이 하위 차트 `cache`의 값이 된다. `global:` 아래는 모든 하위 차트가 같이 본다 |
| `-f` 파일 | 왼쪽에서 오른쪽으로 덮는다 | 공통 파일을 앞에, 환경 파일을 뒤에 |
| `--set` 계열 | 가장 높다 | 명령줄에서 마지막으로 끼워 넣는 값 |
| `null` | 그 키를 지운다 | 기본값에 있는 키를 없애는 유일한 방법 |

맵은 키 단위로 합쳐지고, 목록은 통째로 바뀐다. 기본값의 `env` 목록에 항목 셋이 있고 내 파일에 하나만 적으면 결과는 하나다. 그래서 환경마다 달라지는 것은 목록보다 맵으로 설계한다.

{{< callout type="warning" >}}
**`-f`의 순서가 곧 우선순위다.** 환경 파일을 뒤에 둔다. `--set`은 늘 마지막에 이기므로 CI에서는 이미지 태그처럼 실행마다 바뀌는 값에만 쓰고, 나머지는 파일에 두어 Git에 남긴다. `--set`으로 넣은 비밀번호는 셸 기록과 릴리스 Secret에 남는다. 비밀은 값으로 넣지 말고 이미 있는 Secret의 이름을 값으로 넣는다.
{{< /callout >}}

### --set 문법

```bash
--set replicaCount=3
--set image.tag=1.27,service.port=80
--set env[0].name=FOO
--set-string podAnnotations.rev=42
--set-json 'resources={"limits":
  {"cpu":"1"}}'
--set-file cert=./tls.crt
--set password='a\,b'
```

| 플래그 | 값을 어떻게 읽나 | 왜 |
|:-----|:-------------|:---|
| `--set` | 타입을 추측. `42`는 숫자, `true`는 불리언 | 짧다. 추측이 틀릴 수 있다 |
| `--set-string` | 늘 문자열 | 어노테이션 값처럼 문자열이어야 하는 숫자 |
| `--set-json` | JSON 그대로 | 맵과 목록을 한 번에 |
| `--set-file` | 파일의 내용 | 인증서, 스크립트 |
| `--set-literal` | 쉼표와 점을 해석하지 않은 문자열 | 이스케이프 없이 |

---

## 8. 기본 명령어

### Repository

```bash
helm repo add traefik \
  https://traefik.github.io/charts
helm repo update
helm repo list
helm repo remove traefik

# OCI는 등록이 없다. 주소로 바로
helm registry login reg.example.com
helm pull \
  oci://reg.example.com/charts/my-app \
  --version 1.2.0
```

| 방식 | 주소 | 찾기 | 왜 |
|:-----|:----|:----|:---|
| HTTP 저장소 | `helm repo add`로 이름을 붙인다 | `helm search repo` | `index.yaml` 하나에 모든 차트의 목록이 있다. 커지면 느리다 |
| OCI 레지스트리 | `oci://호스트/경로/차트` | 레지스트리의 화면 | 이미지와 같은 레지스트리, 같은 인증, 같은 서명을 쓴다. 다이제스트로 고정할 수 있다 |

### 검색·조회

```bash
helm search hub traefik   # Artifact Hub
helm search repo traefik -l
helm show chart traefik/traefik
helm show values traefik/traefik \
  > values-default.yaml
helm show readme traefik/traefik
```

### 설치·삭제

```bash
helm install my-app \
  oci://reg.example.com/charts/my-app \
  --version 1.2.0 \
  -n prod --create-namespace \
  -f values-prod.yaml \
  --wait --timeout 10m

helm uninstall my-app -n prod
helm uninstall my-app -n prod \
  --keep-history
```

### Release 조회

```bash
helm list -A
helm status my-app -n prod
helm history my-app -n prod
helm get values my-app -n prod
helm get values my-app -n prod --all
helm get manifest my-app -n prod
```

| 명령 | 보여 주는 것 | 왜 |
|:-----|:---------|:---|
| `helm show values` | 차트의 기본값 전부 | 설치 전에 무엇을 바꿀 수 있는지 본다 |
| `helm list` | 릴리스와 현재 리비전, 상태 | `deployed`, `failed`, `pending-upgrade` |
| `helm history` | 리비전마다의 시각, 상태, 차트 버전, 설명 | 어디로 되돌릴지 고른다 |
| `helm get values` | 내가 준 값. `--all`이면 기본값까지 합친 것 | "지금 무슨 값으로 돌고 있나" |
| `helm get manifest` | 렌더링되어 적용된 YAML | 클러스터의 실제 오브젝트와 견준다 |
| `helm uninstall --keep-history` | 오브젝트는 지우고 기록은 남긴다 | 지운 뒤에도 `rollback`으로 되살릴 수 있다 |

---

## 9. 업그레이드와 롤백

```bash
# 없으면 설치, 있으면 업그레이드
helm upgrade --install my-app \
  oci://reg.example.com/charts/my-app \
  --version 1.3.0 -n prod \
  -f values-prod.yaml \
  --rollback-on-failure \
  --wait --timeout 10m

helm rollback my-app -n prod
helm rollback my-app 2 -n prod
helm rollback my-app 2 -n prod \
  --dry-run=server
```

```text
install   → 리비전 1 (앱 2.0.0)
upgrade   → 리비전 2 (앱 2.0.1)
upgrade   → 리비전 3 (앱 2.1.0)
rollback 1 → 리비전 4 (= 1의 내용)
  기록은 지워지지 않고 앞으로만 간다
```

| 옵션 | 뜻 | 왜 |
|:-----|:--|:---|
| `--install` | 릴리스가 없으면 설치 | 같은 명령을 몇 번 돌려도 결과가 같다. CI의 기본 |
| `--rollback-on-failure` | 실패하면 직전 성공 리비전으로 자동 롤백 | 반쯤 올라간 상태로 남지 않게. Helm 3의 `--atomic` |
| `--wait` | 리소스가 준비될 때까지 기다린다 | 안 쓰면 API 서버가 받아 준 순간 성공이다. 파드가 뜨는지는 안 본다 |
| `--timeout` | 기다리는 한도. 기본 5분 | 이미지가 크거나 마이그레이션이 길면 늘린다 |
| `--reuse-values` | 지난 리비전의 값을 다시 쓰고 이번 것을 덮는다 | 차트의 새 기본값을 못 받는다. 차트 버전을 올릴 때는 피한다 |
| `--reset-then-reuse-values` | 새 차트의 기본값 위에 지난 값을 얹는다 | 위의 문제를 푼 것 |
| `--history-max` | 남길 리비전 수. 기본 10 | 3절 |
| `--take-ownership` | Helm이 만든 표시가 없는 기존 오브젝트를 가져온다 | 손으로 만든 것을 차트로 옮길 때 |

| 롤백으로 | 되돌아오는가 | 왜 |
|:-------|:--------|:---|
| Deployment, Service, ConfigMap, Secret의 스펙 | 예 | 그 리비전의 매니페스트를 다시 적용한다 |
| 그 리비전 뒤에 추가된 오브젝트 | 지워진다 | 옛 매니페스트에 없으니 |
| PV 안의 데이터, 외부 DB의 레코드 | 아니오 | 쿠버네티스 오브젝트가 아니다 |
| 훅이 바꿔 놓은 DB 스키마 | 아니오 | 훅은 실행일 뿐 상태가 아니다 |
| `crds/`의 CRD | 아니오 | Helm은 CRD를 올리지도 내리지도 않는다 |

둘째와 셋째 원리가 만나는 곳이다. 롤백은 과거로 가는 것이 아니라 과거의 내용으로 새 리비전을 만드는 것이라, 기록은 앞으로만 쌓인다. 그리고 되돌아오는 것은 오브젝트의 스펙뿐이다. 2.1.0이 DB 스키마를 바꿨다면 2.0.1의 코드는 새 스키마 위에서 돌게 되고, 그 역방향 마이그레이션은 Helm 밖의 일이다. [04](../04-workloads)장 5절의 `kubectl rollout undo`는 Deployment 하나의 파드 템플릿만 되돌리고, `helm rollback`은 릴리스의 오브젝트 전부를 되돌린다.

{{< callout type="warning" >}}
**`--wait` 없는 성공은 "받아 줬다"는 뜻이다.** 기본은 훅만 기다리므로, 이미지 이름이 틀려 파드가 ImagePullBackOff여도 `helm upgrade`는 성공으로 끝나고 리비전은 `deployed`가 된다. 배포 파이프라인에서는 `--wait`과 `--rollback-on-failure`를 같이 써서, 파드가 준비되지 않으면 실패로 끝나고 직전 리비전으로 돌아가게 한다.
{{< /callout >}}

---

## 10. Hooks와 Tests

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-migrate
  annotations:
    helm.sh/hook:
      pre-install,pre-upgrade
    helm.sh/hook-weight: "-5"
    helm.sh/hook-delete-policy:
     before-hook-creation,hook-succeeded
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image:
          {{ include "app.image" . }}
        command: ["./migrate.sh"]
```

| 훅 | 도는 때 | 왜 쓰나 |
|:---|:------|:------|
| `pre-install` | 렌더링 뒤, 오브젝트를 만들기 전 | 앱보다 먼저 있어야 하는 것 |
| `post-install` | 오브젝트가 다 올라간 뒤 | 초기 데이터 넣기 |
| `pre-upgrade` / `post-upgrade` | 업그레이드 전 / 뒤 | DB 마이그레이션, 캐시 비우기 |
| `pre-rollback` / `post-rollback` | 롤백 전 / 뒤 | 역방향 마이그레이션 |
| `pre-delete` / `post-delete` | 삭제 전 / 뒤 | 백업, 외부 자원 정리 |
| `test` | `helm test`를 칠 때 | 설치가 실제로 되는지 |

| 규칙 | 뜻 | 왜 |
|:-----|:--|:---|
| 순서 | 가중치(기본 0) 오름차순, 그다음 종류, 그다음 이름 | 음수 가중치가 먼저 돈다 |
| 기다림 | Job과 Pod 훅은 끝날 때까지 Helm이 멈춘다 | 마이그레이션이 끝나기 전에 앱이 뜨면 안 된다 |
| 실패 | 훅이 실패하면 릴리스가 실패한다 | `--rollback-on-failure`와 맞물린다 |
| 소유 | 훅이 만든 리소스는 릴리스가 관리하지 않는다 | `helm uninstall`로 안 지워진다. 그래서 삭제 정책이 있다 |
| 삭제 정책 | `before-hook-creation`(기본), `hook-succeeded`, `hook-failed` | 기본은 다음 훅을 만들기 직전에 옛것을 지운다. 성공한 것을 바로 지우고 실패한 것은 남겨 로그를 보려면 위 예처럼 둘을 같이 적는다 |

셋째 원리의 한 조각이다. 훅은 릴리스의 일부처럼 보이지만 릴리스의 오브젝트가 아니다. 매니페스트 목록(`helm get manifest`)에 없고, 롤백이 되돌리지 않고, 삭제도 정책대로만 된다. 훅 Job이 한 일, 예를 들어 바꿔 놓은 스키마는 Helm이 모른다.

### helm test

```yaml
# templates/tests/test-conn.yaml
apiVersion: v1
kind: Pod
metadata:
  name: {{ .Release.Name }}-test
  annotations:
    helm.sh/hook: test
spec:
  restartPolicy: Never
  containers:
  - name: curl
    image: curlimages/curl
    args:
    - {{ include "app.fullname" . }}:80
```

```bash
helm test my-app -n prod
helm test my-app -n prod --logs
```

`test` 훅은 설치나 업그레이드 때는 돌지 않고 `helm test`를 칠 때만 돈다. 컨테이너가 0으로 끝나면 성공이다. Service 이름으로 접속이 되는지, 로그인이 되는지 같은 "설치가 실제로 쓸 수 있는 상태인가"를 확인하는 자리이고, 배포 파이프라인의 마지막 단계로 넣는다.

---

## 11. Helm vs Kustomize

```text
[Helm]
 틀 + 값 → 렌더링
 차트(.tgz, OCI)로 나눈다
 릴리스와 리비전이 기록
 helm 바이너리

[Kustomize]
 원본 + 패치 → 합성
 디렉터리로 나눈다
 기록은 Git이
 kubectl -k 에 내장
```

| 항목 | Helm | Kustomize | 왜 다른가 |
|:-----|:-----|:---------|:-------|
| 방식 | 템플릿에 값을 넣는다 | 완성된 YAML을 패치로 고친다 | Helm은 "만드는 사람이 열어 둔 곳"만 바꾸고, Kustomize는 어디든 바꾼다 |
| 배우기 | Go 템플릿과 함수 | YAML만 | |
| 나누는 단위 | 버전 찍힌 차트 | 저장소의 디렉터리 | 남에게 주려면 차트, 우리끼리 쓰려면 디렉터리 |
| 기록 | 릴리스 Secret | 없음 | Kustomize는 기록을 Git과 GitOps 도구에 맡긴다 |
| 조건과 반복 | 있다 | 거의 없다 | 선택지가 많은 애플리케이션은 템플릿이 낫다 |
| 맞는 곳 | 남이 만든 애플리케이션을 설치, 옵션이 많은 패키지 | 같은 매니페스트를 환경마다 조금씩 | [12](../12-kustomize)장 1.2절 |

{{< callout type="info" >}}
**둘은 같이 쓴다.** 남의 차트를 쓰는데 차트가 열어 두지 않은 곳을 고쳐야 하면, Helm이 렌더링한 결과를 Kustomize로 패치한다. `helm template`의 출력을 `kustomize build`에 넣거나, Kustomize의 `helmCharts` 필드를 쓰거나, Helm의 포스트 렌더러(Helm 4에서는 플러그인)로 건다. [13](../13-cicd)장의 ArgoCD는 차트를 `helm template`으로 렌더링해 자기가 적용하므로, ArgoCD로 배포한 차트는 `helm list`에 나오지 않는다. 릴리스 기록 대신 Git과 ArgoCD의 이력이 그 자리를 맡는다.
{{< /callout >}}

---

## 12. 디버깅과 검증

```bash
# 문법과 관례 검사
helm lint ./my-app --strict \
  -f values-prod.yaml

# 클러스터 없이 렌더링
helm template my-app ./my-app \
  -f values-prod.yaml > out.yaml

# 서버에 물어보며 렌더링 (적용은 안 함)
helm install my-app ./my-app \
  --dry-run=server --debug

# 적용된 것 확인
helm get manifest my-app -n prod
helm get values my-app -n prod --all
helm status my-app -n prod
```

| 단계 | 명령 | 잡는 것 | 왜 단계가 나뉘나 |
|:-----|:----|:------|:------------|
| 정적 검사 | `helm lint` | Chart.yaml 오류, 템플릿 문법, 스키마 위반 | 클러스터가 없어도 된다 |
| 렌더링 | `helm template` | 값이 제대로 들어갔는지, 들여쓰기 | 나온 YAML을 눈으로 보고 `kubectl diff`에 넣을 수 있다 |
| 클라이언트 드라이런 | `--dry-run=client` | 위와 같다. `lookup`은 빈 값 | 클러스터에 안 묻는다 |
| 서버 드라이런 | `--dry-run=server` | API 서버의 검증, 어드미션 거절, `lookup`의 실제 값 | 적용 직전까지 간다. CRD는 드라이런이 안 된다 |
| 적용 뒤 | `helm get`, `helm status` | 실제로 무엇이 들어갔나 | |

| 증상 | 원인 | 푸는 법 | 왜 |
|:-----|:----|:------|:---|
| `another operation is in progress` | 앞의 명령이 중간에 끊겨 릴리스가 `pending-upgrade`에 남았다 | `helm rollback`으로 직전 리비전으로. 첫 설치였으면 `helm uninstall` | 릴리스마다 한 번에 한 작업만 허용한다 |
| `cannot re-use a name that is still in use` | 같은 이름의 릴리스가 있다. `failed` 상태일 수도 | `helm list -a`로 확인. `upgrade --install`을 쓴다 | `helm list`는 기본으로 실패한 것을 다 보여 주지 않는다 |
| `exists and cannot be imported` | 차트가 만들려는 오브젝트가 이미 있고 Helm의 표시가 없다 | 지우거나 `--take-ownership` | Helm은 남의 오브젝트를 덮어쓰지 않는다 |
| 서버 사이드 어플라이 충돌 | 다른 주인(HPA, kubectl)이 그 필드를 갖고 있다 | 차트에서 그 필드를 빼거나 `--force-conflicts` | 2절. HPA를 쓰면 템플릿에서 `replicas`를 뺀다 |
| 값이 안 먹는다 | 키 이름 오타, `-f` 순서, 목록이 통째로 바뀜 | `helm get values --all`, `values.schema.json` | 없는 키는 조용히 무시된다 |

---

## 13. Chart 생성과 패키징

```bash
helm create my-app
helm dependency update ./my-app
helm lint ./my-app
helm package ./my-app -d ./dist
# dist/my-app-1.2.0.tgz

helm push dist/my-app-1.2.0.tgz \
  oci://reg.example.com/charts
helm show chart \
  oci://reg.example.com/charts/my-app \
  --version 1.2.0
```

| 명령 | 하는 일 | 왜 |
|:-----|:------|:---|
| `helm create` | Deployment, Service, Ingress, HPA, ServiceAccount, 헬퍼, 테스트가 든 틀을 만든다 | 관례(레이블, 이름 짓기)가 이미 들어 있다. 필요 없는 것을 지우며 시작한다 |
| `helm dependency update` | Chart.yaml의 의존성을 받아 `charts/`에 넣고 `Chart.lock`에 버전을 고정 | `~3.1.0` 같은 범위가 빌드마다 다른 버전이 되지 않게 |
| `helm dependency build` | `Chart.lock`대로 받는다 | CI에서는 이것을 쓴다. 잠긴 버전 그대로 |
| `helm package` | 디렉터리를 `이름-버전.tgz`로 | 버전은 Chart.yaml의 것. `--version`, `--app-version`으로 덮을 수 있다 |
| `helm push` | OCI 레지스트리에 올린다 | 이름은 차트 이름, 태그는 차트 버전이 된다 |

---

## 14. Chart 안티패턴

| 안티패턴 | 생기는 일 | 고치는 법 | 왜 |
|:-------|:-------|:------|:---|
| 이미지 태그 `latest` | 롤백해도 같은 이미지가 돈다 | 태그를 값으로, 기본은 `appVersion` | 리비전이 달라도 매니페스트가 같으면 아무 일도 안 일어난다 |
| 값 없이 하드코딩 | 환경마다 차트를 복사한다 | 바뀔 수 있는 것은 `.Values`로 | 첫째 원리. 값이 유일한 입력이다 |
| 반대로 모든 것을 값으로 | values.yaml이 매니페스트보다 길다 | 실제로 바뀌는 것만 연다 | 값의 키는 공개 API다. 한번 열면 못 닫는다 |
| 비밀을 values에 평문으로 | Git과 릴리스 Secret에 남는다 | 이미 있는 Secret의 이름을 값으로. External Secrets, Sealed Secrets([13](../13-cicd)장 7절) | 3절. 릴리스 기록에 값이 통째로 들어간다 |
| `version`을 안 올리고 다시 올림 | 같은 버전의 다른 차트가 돌아다닌다 | 고칠 때마다 SemVer를 올린다 | 5절 |
| CRD를 `crds/`에 두고 업그레이드를 기대 | 차트를 올려도 CRD는 옛 버전이다 | CRD는 따로 적용하거나 CRD만의 차트로 나눈다 | Helm은 `crds/`를 설치만 한다. CRD를 지우면 그 종류의 오브젝트가 전부 지워져서, 실수를 막으려고 아예 안 건드린다 |
| CRD를 `templates/`에 | 같은 차트의 커스텀 리소스가 CRD보다 먼저 적용되어 실패, 삭제 때 CRD와 데이터가 같이 사라진다 | 위와 같다 | 템플릿의 오브젝트는 한꺼번에 적용되고 한꺼번에 지워진다 |
| 훅에 삭제 정책 없음 | 실패한 Job이 남아 다음 훅과 이름이 부딪히지는 않지만(기본 정책), 성공한 Job이 쌓인다 | `hook-succeeded`를 같이 적는다 | 10절 |
| `replicas`를 템플릿에 두고 HPA도 씀 | 업그레이드마다 개수가 값으로 되돌아가거나, 서버 사이드 어플라이에서 충돌 | `autoscaling.enabled`면 `replicas`를 내지 않는다 | [09](../09-observability)장 5절. 개수의 주인은 하나여야 한다 |
| 거대한 `_helpers.tpl` | 어디서 무엇이 만들어지는지 모른다 | 역할별 파일로 나누고 이름에 차트 이름을 붙인다 | 헬퍼 이름은 전역이다 |

---

## 15. 실전 예제 - 모니터링 스택

[09](../09-observability)장 10절에서 한 줄로 깔았던 kube-prometheus-stack을 값 파일을 두고 다시 깔아, 설치에서 삭제까지를 따라간다.

```bash
# 1. 저장소와 기본값
helm repo add prometheus-community \
  https://prometheus-community\
.github.io/helm-charts
helm repo update
C=prometheus-community
helm show values \
  $C/kube-prometheus-stack \
  > default-values.yaml
```

```yaml
# 2. prom-values.yaml: 바꿀 것만
grafana:
  enabled: true
  admin:
    existingSecret: grafana-admin
alertmanager:
  enabled: true
nodeExporter:
  enabled: true
prometheus:
  prometheusSpec:
    retention: 15d
    resources:
      requests:
        cpu: 500m
        memory: 2Gi
```

```bash
# 3. 렌더링해서 보고, 설치
helm template prom \
  $C/kube-prometheus-stack \
  -n monitoring -f prom-values.yaml \
  | grep -c '^kind:'
helm upgrade --install prom \
  $C/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f prom-values.yaml \
  --rollback-on-failure \
  --wait --timeout 15m

# 4. 확인
helm status prom -n monitoring
helm history prom -n monitoring
kubectl get pods -n monitoring
kubectl get secret -n monitoring \
  -l owner=helm

# 5. 보관 기간을 바꿔 업그레이드
helm upgrade prom \
  $C/kube-prometheus-stack \
  -n monitoring -f prom-values.yaml \
  --set prometheus.prometheusSpec\
.retention=30d --wait

# 6. 되돌리기
helm rollback prom 1 -n monitoring

# 7. 삭제, 그리고 남는 것
helm uninstall prom -n monitoring
kubectl get crd \
  | grep monitoring.coreos.com
kubectl get pvc -n monitoring
```

| 단계 | 보이는 것 | 왜 |
|:-----|:-------|:---|
| 2. 값 파일 | 기본값 수천 줄 중 바꿀 것만 적는다 | 7절. 나머지는 차트의 기본값이 채운다. 차트를 올릴 때 새 기본값을 받으려면 내 파일이 작아야 한다 |
| 2. `existingSecret` | 비밀번호 대신 Secret의 이름 | 14절. 값에는 이름만 남는다 |
| 2. `grafana.enabled` | 하위 차트를 켜고 끈다 | 5절의 `condition`. 이 차트는 Grafana, kube-state-metrics, node-exporter 차트를 품고 있다 |
| 3. `helm template` | 오브젝트가 백 개 넘게 나온다 | 한 줄 뒤에 무엇이 있는지 설치 전에 본다 |
| 4. `owner=helm` Secret | `sh.helm.release.v1.prom.v1` | 3절. 릴리스 기록 |
| 5. 업그레이드 | 리비전 2. Prometheus 오브젝트의 `retention`만 바뀐다 | 바뀐 오브젝트만 패치된다 |
| 6. 롤백 | 리비전 3이 생기고 내용은 1과 같다 | 9절 |
| 7. 삭제 뒤 | CRD(`prometheuses`, `servicemonitors` 등)와 PVC가 남는다 | 셋째 원리. CRD는 `crds/`에 있어 Helm이 지우지 않고, PVC는 StatefulSet이 만든 것이라 릴리스의 오브젝트가 아니다([06](../06-storage)장 6.3절) |

마지막 단계가 이 장의 셋째 원리를 한 번에 보여 준다. `helm uninstall`은 릴리스가 만든 오브젝트를 지우지만 CRD와 PVC는 남는다. CRD를 지우면 클러스터의 모든 ServiceMonitor가 같이 사라지고, PVC를 지우면 메트릭 데이터가 사라지므로 둘 다 사람이 결정해서 지우는 것이 맞다. 다음에 같은 차트의 새 버전을 깔 때 CRD가 옛 버전이라 새 필드가 거절되면, 차트의 릴리스 노트가 안내하는 대로 CRD를 먼저 `kubectl apply --server-side`로 올린다.

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| Helm | 틀에 값을 넣어 YAML을 만들고, 적용하고, 기록한다 | kubectl 앞에 서는 도구. 클러스터에 깔리는 것은 없다 |
| 차트 / 값 | 템플릿 묶음 / 유일한 입력 | 같은 차트를 환경마다 다르게 |
| 릴리스 / 리비전 | 설치된 인스턴스 / 그 시점 | 리비전마다 Secret 하나. 기본 10개 |
| Helm 4 | 새 릴리스는 서버 사이드 어플라이, `--rollback-on-failure`, kstatus 기다림 | Helm 3은 2026년 11월까지 보안 수정만 |
| 값 우선순위 | 차트 기본값 → 부모 → `-f` 왼쪽에서 오른쪽 → `--set` | 맵은 합치고 목록은 통째로 |
| 템플릿 | `{{ }}`, `include`와 `nindent`, `required`, `toYaml` | YAML은 들여쓰기가 뜻이다 |
| `upgrade --install` | 없으면 설치, 있으면 업그레이드 | 몇 번 돌려도 같다 |
| `--wait` | 준비될 때까지 기다린다 | 없으면 "받아 줬다"가 성공이다 |
| 롤백 | 옛 내용으로 새 리비전 | 스펙만. 데이터, 스키마, CRD는 아니다 |
| 훅 | 릴리스의 시점에 도는 Job | 릴리스가 관리하지 않는다. 삭제 정책 |
| CRD | `crds/`는 설치만 | 올리는 것과 지우는 것은 사람이 |
| OCI | `oci://`로 바로. 등록 없음 | 이미지와 같은 레지스트리와 서명 |
| Helm vs Kustomize | 틀과 값 vs 원본과 패치 | 남의 패키지는 Helm, 우리 매니페스트는 Kustomize |

{{< callout type="info" >}}
**용어 정리**
- **차트 (Chart)**: 템플릿, 기본값, 메타데이터의 묶음. 버전이 찍힌다
- **값 (values)**: 템플릿에 넣는 입력. `values.yaml`, `-f`, `--set`
- **릴리스 (Release)**: 차트를 설치한 인스턴스. 이름과 네임스페이스로 구분
- **리비전 (Revision)**: 릴리스의 한 시점. 설치, 업그레이드, 롤백마다 하나
- **저장소 / OCI 레지스트리**: 차트를 나누는 두 경로. `helm repo add` / `oci://`
- **하위 차트 (subchart)**: 차트가 의존하는 차트. `charts/`에 들어간다
- **library 차트**: 헬퍼만 담은 차트. 설치되지 않는다
- **3-way 병합**: 지난 매니페스트, 새 매니페스트, 실제 상태를 견줘 패치를 만드는 방식
- **서버 사이드 어플라이**: 필드의 주인을 서버가 기억하는 적용 방식. Helm 4의 새 릴리스 기본
- **훅 (Hook)**: 릴리스의 특정 시점에 도는 리소스. 어노테이션으로 표시
- **포스트 렌더러**: 렌더링된 매니페스트를 적용 전에 고치는 단계. Helm 4에서는 플러그인
- **`crds/`**: CRD를 두는 디렉터리. 설치만 되고 업그레이드와 삭제는 없다
- **kstatus**: 리소스 종류마다의 준비 상태를 읽는 표준 라이브러리
- **Artifact Hub**: 공개 차트를 찾는 검색 사이트
{{< /callout >}}
