---
title: "15. JSONPath"
date: 2026-04-23
weight: 15
---

[01. 입문](../01-introduction) 10절에서 kubectl의 명령은 전부 API 서버로 가는 REST 호출이라 했고, 자원이 많아지면 `-o jsonpath`로 원하는 값만 뽑는다며 그 문법을 이 장으로 미뤘다. [02. 핵심 개념](../02-core-concepts) 12절도 `--sort-by`와 `-o jsonpath`를 여기로 넘겼다. 앞의 열네 장에서 인증서를 꺼내고, 비밀번호를 읽고, 마지막 종료 이유를 찾을 때마다 한 줄씩 써 온 그것이다. 원리는 셋이다. 첫째, **kubectl이 보여 주는 표는 전체의 일부다.** API 서버가 돌려주는 것은 늘 오브젝트 전체이고, 출력 형식은 그것을 어떻게 볼지를 고르는 것이다. 그래서 먼저 `-o json`으로 구조를 보고, 그다음 경로를 적는다. 둘째, **경로는 구조를 따라 걷는 길이다.** 맵은 점으로 들어가고 목록은 대괄호로 들어간다. 목록을 만나면 하나를 고를지, 전부를 돌지, 조건으로 거를지를 정한다. 셋째, **어디서 거르는지가 다르다.** 셀렉터는 서버가 거르고 JSONPath의 필터는 다 받아 온 뒤 kubectl이 거른다. 그리고 kubectl의 JSONPath가 못 하는 것, 정규식과 계산과 여러 조건은 jq로 넘긴다.

---

## 1. JSONPath가 필요한 이유

```text
kubectl get pods
      │
      ▼
API 서버 ── 오브젝트 전체 (JSON)
      │
      ▼
kubectl의 출력기
  ├ 기본 표      몇 개의 열만
  ├ -o wide      열 몇 개 더
  ├ -o yaml/json 전체
  ├ -o jsonpath  경로로 고른 값
  └ -o custom-columns
                 경로로 만든 표
```

| 출력 형식 | 나오는 것 | 쓰는 때 | 왜 |
|:-------|:-------|:------|:---|
| 기본, `-o wide` | 서버가 정한 열의 표 | 눈으로 볼 때 | 열은 리소스 종류마다 서버가 정한다. 파드의 IP와 노드는 `wide`에만 있다 |
| `-o yaml`, `-o json` | 오브젝트 전체 | 구조를 볼 때, 백업 | 표에 없는 필드가 전부 여기 있다 |
| `-o name` | `종류/이름`만 | 다른 명령에 넘길 때 | `xargs`에 바로 물린다 |
| `-o jsonpath=` | 경로가 가리키는 값 | 스크립트, 값 하나 | 헤더도 정렬도 없는 날것 |
| `-o jsonpath-as-json=` | 같은 값을 JSON 배열로 | 결과를 다시 파싱할 때 | 공백이 든 값도 안 깨진다 |
| `-o custom-columns=` | 경로로 만든 표 | 사람이 볼 보고서 | 헤더가 있고 열이 맞춰진다 |
| `-o go-template=` | Go 템플릿 | 조건과 반복이 필요할 때 | [11](../11-helm)장의 그 문법 |
| `-o kyaml` | 엄격한 YAML 부분집합 | | 알파 단계 |

첫째 원리다. `kubectl get pods`의 표에는 열이 대여섯 개뿐이지만, API 서버가 가진 파드 오브젝트에는 필드가 수백 개다. taint, 할당 가능한 자원, 조건별 상태, 컨테이너마다의 마지막 종료 이유는 표에 없다. 표는 kubectl이 아니라 서버가 만들어 보내는 요약이고, 나머지를 보려면 오브젝트를 통째로 받아 필요한 곳을 짚어야 한다.

### 1.1 4단계 접근법

```text
1. 명령     kubectl get pods
2. 구조     kubectl get pods -o json
3. 경로     .items[0].spec
              .containers[0].image
4. 적용     -o jsonpath='{...}'
```

```bash
# 구조를 본다
kubectl get pod web -o json | less
kubectl get pod web -o yaml

# 필드 이름과 뜻을 본다
kubectl explain pod.spec.containers
kubectl explain pod.status \
  --recursive | less
```

| 단계 | 하는 일 | 왜 |
|:-----|:------|:---|
| 구조 확인 | `-o json`으로 실제 오브젝트를 본다 | 경로는 외우는 것이 아니라 보고 적는 것이다. 목록인지 맵인지는 봐야 안다 |
| `explain` | 스키마를 본다 | 지금 오브젝트에 비어 있는 필드는 `-o json`에 안 나온다 |
| 경로 작성 | 맨 위에서 값까지의 길 | 둘째 원리 |
| 적용 | 작은따옴표로 감싸 넘긴다 | 셸이 `$`, `*`, `[`, `"`를 건드리지 못하게 |

---

## 2. JSONPath 기본 문법

### 2.1 쿼리 구조

```bash
# 작은따옴표 안에 중괄호
kubectl get nodes -o \
  jsonpath='{.items[*].metadata.name}'

# 긴 쿼리는 변수에 이어 붙인다
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.capacity.cpu}{"\n"}'
Q=$Q'{end}'
kubectl get nodes -o jsonpath="$Q"
```

| 규칙 | 뜻 | 왜 |
|:-----|:--|:---|
| `{ }` | 중괄호 안이 경로, 밖은 그대로 찍히는 글자 | `이름: {.metadata.name}`처럼 섞어 쓴다 |
| 작은따옴표 | 쿼리 전체를 감싼다 | 셸이 해석하지 않는다. Windows의 cmd에서는 큰따옴표로 감싸고 안의 문자열을 작은따옴표로 |
| 큰따옴표 | 쿼리 안의 문자열. `"Ready"`, `"\n"` | |
| `$` | 뿌리. 생략한다 | kubectl은 늘 뿌리에서 시작한다 |
| 줄바꿈 | 쿼리 안의 줄바꿈은 그대로 출력된다 | 그래서 긴 쿼리를 여러 줄로 쪼개 적지 않고, 위처럼 변수에 이어 붙인다 |

이 장의 긴 쿼리는 전부 변수 `Q`에 조각을 이어 붙이는 식으로 적는다. 실제로 칠 때는 한 줄로 이어 써도 같다.

### 2.2 연산자 치트시트

| 연산자 | 뜻 | 예 | 왜 |
|:-----|:--|:---|:---|
| `.필드`, `['필드']` | 맵의 키로 들어간다 | `.metadata.name` | |
| `\.` | 키 안의 점 | `.metadata.labels.app\.kubernetes\.io/name` | 점은 구분자라 키에 든 점은 막아야 한다 |
| `[n]` | 목록의 n번째. 0부터 | `.items[0]` | |
| `[*]` | 목록의 전부 | `.items[*]` | |
| `[a:b]`, `[a:b:c]` | a부터 b 앞까지. c는 간격 | `.items[0:3]` | |
| `[-1:]` | 뒤에서부터 | `.items[-1:]` | 음수는 뒤에서 센다. 목록 길이를 넘으면 안 된다 |
| `[,]` | 여러 필드를 한 번에 | `['metadata.name','status.phase']` | |
| `..` | 깊이에 상관없이 그 이름을 전부 | `..image` | 어디에 있는지 모를 때. 뜻밖의 것까지 잡힌다 |
| `[?()]` | 조건에 맞는 원소만 | `[?(@.type=="Ready")]` | 6절 |
| `@` | 지금 보고 있는 원소 | `@.name` | 필터 안에서 |
| `{range}{end}` | 목록을 돌며 안의 것을 되풀이 | 4절 | |
| `{"\n"}`, `{"\t"}` | 글자 그대로 | | 구분자 |

{{< callout type="info" >}}
**kubectl의 JSONPath는 작다.** 필터에는 비교 하나만 쓸 수 있고, 정규식과 계산과 여러 조건을 묶는 일은 못 한다. 그런 것이 필요하면 `-o json`으로 받아 jq로 넘긴다(10.1절). 대신 kubectl의 것은 따로 깔 것이 없고, 표로 찍는 `custom-columns`와 정렬이 같은 경로 문법을 쓴다. 시험장이나 남의 서버처럼 jq가 없을 수 있는 곳에서는 JSONPath로 끝내는 법을 알아 두는 것이 안전하다.
{{< /callout >}}

### 2.3 단일 리소스 vs 목록

| 명령 | 돌아오는 것 | 경로의 시작 | 왜 |
|:-----|:--------|:--------|:---|
| `kubectl get pods` | `List`. `items` 아래에 파드들 | `.items[*]...` | 이름 없이 부르면 목록이다 |
| `kubectl get pod web` | 파드 하나 | `.metadata...` | 이름을 주면 오브젝트 그것 |
| `kubectl get pod a b` | `List` | `.items[*]...` | 이름을 둘 이상 주면 다시 목록 |
| `kubectl get pods -l app=web` | `List` | `.items[*]...` | 결과가 하나여도 목록이다 |

```bash
kubectl get pods -o \
  jsonpath='{.items[*].metadata.name}'
kubectl get pod web \
  -o jsonpath='{.status.podIP}'
```

둘째 원리의 첫 갈림이다. 결과가 비어 나오면 열에 아홉은 이것이다. 목록에 `.metadata.name`을 묻거나 하나에 `.items[*]`를 물으면 kubectl은 오류 없이 빈 줄을 돌려준다. 없는 경로는 오류가 아니라 빈 값이다.

---

## 3. 기본 추출 패턴

### 3.1 단일 값

```bash
kubectl get nodes -o \
  jsonpath='{.items[0].metadata.name}'

Q='{.items[0].spec'
Q=$Q'.containers[0].image}'
kubectl get pods -o jsonpath="$Q"
```

### 3.2 전체 값

```bash
kubectl get nodes -o \
  jsonpath='{.items[*].metadata.name}'
# node-1 node-2 node-3

Q='{.items[*].spec'
Q=$Q'.containers[*].image}'
kubectl get pods -A -o jsonpath="$Q" \
  | tr ' ' '\n' | sort -u
```

`[*]`의 결과는 공백으로 나뉜 한 줄이다. 줄마다 하나씩 보려면 `tr`로 바꾸거나 4절의 `range`를 쓴다. `[*]`가 두 번 나오면 파드마다의 컨테이너마다이고, 결과는 평평하게 펴진다. 어느 파드의 이미지인지는 사라진다.

### 3.3 여러 필드 직접 연결

```bash
Q='{.items[*].metadata.name}'
Q=$Q'{.items[*].status.capacity.cpu}'
kubectl get nodes -o jsonpath="$Q"
# node-1 node-2 node-348 4
```

| 쓰는 법 | 결과 | 왜 |
|:------|:----|:---|
| `{A}{B}` | A 전부가 나온 뒤 B 전부가 붙어 나온다 | 중괄호 하나가 통째로 평가된다. 짝이 안 맞는다 |
| `{A}{"\n"}{B}` | A 한 줄, B 한 줄 | 두 줄의 같은 자리가 같은 노드다. 눈으로 맞춰야 한다 |
| `{range}{A}{B}{end}` | 원소마다 A와 B | 짝이 맞는다. 4절 |

---

## 4. 포매팅과 Range

### 4.1 리터럴 문자

```bash
Q='{.items[*].metadata.name}{"\n"}'
Q=$Q'{.items[*].status.capacity.cpu}'
kubectl get nodes -o jsonpath="$Q"
# node-1 node-2 node-3
# 4 8 4
```

### 4.2 range 블록

```text
{range .items[*]}        되풀이 시작
  {.metadata.name}       이름
  {"\t"}                 탭
  {.status.capacity.cpu} CPU
  {"\n"}                 줄바꿈
{end}                    되풀이 끝
```

```bash
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.capacity.cpu}{"\n"}'
Q=$Q'{end}'
kubectl get nodes -o jsonpath="$Q"
# node-1  4
# node-2  8
# node-3  4
```

`range` 안에서는 경로의 시작이 바뀐다. `.items[*]`의 원소 하나가 새 뿌리가 되어, 안의 `.metadata.name`은 그 원소의 것이다. [11](../11-helm)장 6절의 Go 템플릿 `range`와 같은 생각이다.

### 4.3 복합 range

```bash
# 네임스페이스, 이름, 단계
Q='{range .items[*]}'
Q=$Q'{.metadata.namespace}{"\t"}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.phase}{"\n"}{end}'
kubectl get pods -A -o jsonpath="$Q"

# 노드 이름과 내부 IP
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.addresses'
Q=$Q'[?(@.type=="InternalIP")]'
Q=$Q'.address}{"\n"}{end}'
kubectl get nodes -o jsonpath="$Q"

# 파드마다 컨테이너 이미지 전부
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{": "}'
Q=$Q'{.spec.containers[*].image}'
Q=$Q'{"\n"}{end}'
kubectl get pods -o jsonpath="$Q"
```

| 모양 | 쓰는 때 | 왜 |
|:-----|:------|:---|
| 탭으로 나눈 줄 | `awk`, `cut`, `sort`에 넘길 때 | 탭은 값 안에 거의 없다. 공백은 있다 |
| `range` 안의 필터 | 원소마다 조건에 맞는 하위 값 | 위의 내부 IP. 노드마다 주소 목록에서 하나를 고른다 |
| `range` 안의 `[*]` | 원소마다 하위 목록 전부 | 위의 이미지. 어느 파드의 것인지가 남는다 |

---

## 5. Custom Columns

### 5.1 기본 사용법

```bash
kubectl get nodes -o custom-columns=\
NODE:.metadata.name,\
CPU:.status.capacity.cpu
# NODE     CPU
# node-1   4
# node-2   8
```

| 다른 점 | `range` (jsonpath) | custom-columns | 왜 |
|:------|:----------------|:--------------|:---|
| 목록 | `.items[*]`를 적는다 | 안 적는다. 줄마다 오브젝트 하나 | 표는 본래 목록을 위한 것이다 |
| 중괄호 | 있다 | 없다. `이름:경로` | |
| 헤더 | 없다 | 있다. `--no-headers`로 뺀다 | |
| 열 맞춤 | 직접 | 자동 | |
| 없는 값 | 빈칸 | `<none>` | 빈칸은 `awk`의 열을 밀리게 한다 |
| 하위 목록 | 공백으로 | 쉼표로 | |

### 5.2 다양한 예시

```bash
# 목록과 필터가 들면 따옴표로
C='NAME:.metadata.name'
C=$C',IMAGE:.spec.containers[*].image'
C=$C',STATUS:.status.phase'
kubectl get pods -o custom-columns="$C"

kubectl get deploy -o custom-columns=\
NAME:.metadata.name,\
WANT:.spec.replicas,\
READY:.status.readyReplicas

C='NAME:.metadata.name'
C=$C',READY:.status.conditions'
C=$C'[?(@.type=="Ready")].status'
kubectl get nodes -o custom-columns="$C"
```

경로에 `[*]`나 `[?()]`가 있으면 열 정의를 따옴표로 감싼다. 감싸지 않으면 셸이 대괄호를 파일 이름 패턴으로, 괄호를 문법으로 읽는다. bash는 맞는 파일이 없으면 그냥 넘겨 주지만 zsh는 `no matches found`로 멈춘다.

### 5.3 파일로 컬럼 정의

```text
NAME          CPU
metadata.name status.capacity.cpu
```

```bash
kubectl get nodes \
  -o custom-columns-file=cols.txt
```

| 줄 | 담는 것 | 왜 |
|:---|:------|:---|
| 첫 줄 | 열 이름들. 공백으로 나눈다 | 헤더 |
| 둘째 줄 | 경로들. 같은 순서로 | 열 이름과 경로가 자리로 짝지어진다 |

되풀이해 쓰는 보고서는 파일로 둔다. 열 정의가 저장소에 남고, 명령이 짧아진다.

### 5.4 Custom Columns vs JSONPath 선택 기준

| 상황 | 고를 것 | 왜 |
|:-----|:------|:---|
| 사람이 볼 표 | custom-columns | 헤더와 열 맞춤 |
| 값 하나를 변수에 | jsonpath | 헤더가 없다 |
| `awk`, `cut`으로 다시 가공 | jsonpath와 탭 | 구분자를 내가 정한다 |
| 필터 결과의 필드 하나 | jsonpath | |
| 되풀이하는 보고서 | custom-columns-file | |
| 정렬과 함께 | 둘 다. 7절 | `--sort-by`는 출력 형식과 따로 돈다 |
| 값에 공백이 든다 | jsonpath-as-json | 공백으로 나뉜 결과는 다시 못 나눈다 |

---

## 6. 필터링

### 6.1 조건부 필터 `[?()]`

```bash
# Running인 파드
Q='{.items[?(@.status.phase'
Q=$Q'=="Running")].metadata.name}'
kubectl get pods -o jsonpath="$Q"

# node-1에 있는 파드
Q='{.items[?(@.spec.nodeName'
Q=$Q'=="node-1")].metadata.name}'
kubectl get pods -A -o jsonpath="$Q"

# 레플리카가 3보다 많은 Deployment
Q='{.items[?(@.spec.replicas>3)]'
Q=$Q'.metadata.name}'
kubectl get deploy -o jsonpath="$Q"
```

| 비교 | 예 | 왜 |
|:-----|:---|:---|
| `==`, `!=` | `@.type=="Ready"` | 문자열은 큰따옴표 |
| `<`, `>`, `<=`, `>=` | `@.spec.replicas>3` | 숫자는 따옴표 없이 |
| 불리언 | `@.spec.unschedulable==true` | |
| 있는지 | `[?(@.spec.nodeName)]` | 비교 없이 경로만 적으면 그 필드가 있는 것만 |
| 못 하는 것 | 정규식, `&&`와 `\|\|`, 계산, 필터 안의 필터 | jq로 넘긴다 |

### 6.2 배열 내 조건 검색

```bash
# 노드의 내부 IP
Q='{.items[*].status.addresses'
Q=$Q'[?(@.type=="InternalIP")]'
Q=$Q'.address}'
kubectl get nodes -o jsonpath="$Q"

# 노드마다 Ready 조건의 값
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.conditions'
Q=$Q'[?(@.type=="Ready")].status}'
Q=$Q'{"\n"}{end}'
kubectl get nodes -o jsonpath="$Q"

# 그중 Ready가 아닌 것
kubectl get nodes -o jsonpath="$Q" \
  | awk '$2 != "True" {print $1}'
```

쿠버네티스의 오브젝트에는 "종류가 적힌 원소들의 목록"이 많다. 노드의 `addresses`와 `conditions`, 파드의 `conditions`와 `containerStatuses`가 그렇다. 이런 목록에서 원하는 것은 자리가 아니라 종류로 찾는다. `conditions[-1]`이나 `addresses[0]`처럼 자리로 찾으면 지금은 맞아도 목록의 순서는 약속된 것이 아니라서 다른 클러스터에서 틀린다. Ready가 아닌 노드를 고르는 것은 "노드를 조건 목록의 한 원소로 거른다"는 필터 안의 필터라 kubectl의 JSONPath 한 줄로는 안 되고, 위처럼 `range`로 뽑아 셸에서 거르거나 jq를 쓴다.

### 6.3 kubectl 셀렉터와 조합

```bash
# 레이블 셀렉터: 서버가 거른다
Q='{.items[*].metadata.name}'
kubectl get pods -l app=web,tier!=db \
  -o jsonpath="$Q"

# 필드 셀렉터: 서버가 거른다
kubectl get pods -A --field-selector \
  spec.nodeName=node-1,\
status.phase=Running \
  -o custom-columns=\
NS:.metadata.namespace,\
NAME:.metadata.name
```

| 거르는 곳 | 수단 | 걸 수 있는 것 | 왜 |
|:-------|:----|:----------|:---|
| 서버 | `-l` 레이블 셀렉터 | 레이블. `=`, `!=`, `in`, `notin`, 있음 | 색인이 있어 빠르다. 거른 것만 네트워크를 탄다 |
| 서버 | `--field-selector` | 종류마다 정해진 몇 필드. `=`, `!=`만 | 아래 표. 아무 필드나 되는 것이 아니다 |
| kubectl | JSONPath의 `[?()]` | 어떤 필드든. 비교 하나 | 전부 받아 온 뒤에 거른다. 파드가 수만 개면 느리다 |
| 셸 | `awk`, `grep`, jq | 무엇이든 | 마지막 수단이자 가장 자유로운 수단 |

| 종류 | 필드 셀렉터로 걸 수 있는 필드 | 왜 |
|:-----|:-------------------|:---|
| 전부 | `metadata.name`, `metadata.namespace` | |
| Pod | `spec.nodeName`, `status.phase`, `status.podIP`, `spec.serviceAccountName`, `spec.restartPolicy`, `spec.schedulerName`, `spec.hostNetwork` | kubelet이 "내 노드의 파드"를 이것으로 지켜본다 |
| Event | `involvedObject.kind`, `involvedObject.name`, `reason`, `type` 등 | `kubectl describe`가 이것으로 이벤트를 모은다 |
| Node | `spec.unschedulable` | |
| Secret | `type` | |
| Service | `spec.type`, `spec.clusterIP` | |
| 커스텀 리소스 | CRD의 `selectableFields`에 적은 것 | |

셋째 원리다. 같은 "Running인 파드"를 필드 셀렉터로 고르면 서버가 Running인 것만 보내고, JSONPath 필터로 고르면 전부 받은 뒤 kubectl이 버린다. 결과는 같고 비용이 다르다. 서버에서 거를 수 있는 것은 서버에서 거르고, 나머지를 JSONPath로 다듬는다.

---

## 7. 정렬 `--sort-by`

```bash
kubectl get nodes \
  --sort-by=.metadata.name
kubectl get pods \
  --sort-by=.metadata.creationTimestamp
S='.status.containerStatuses[0]'
kubectl get pods \
  --sort-by="{$S.restartCount}"
kubectl get events \
  --sort-by=.lastTimestamp

# 거꾸로
T=.metadata.creationTimestamp
kubectl get pods --no-headers \
  --sort-by=$T | tac
```

| 규칙 | 뜻 | 왜 |
|:-----|:--|:---|
| 경로 | JSONPath 식. 중괄호는 있어도 없어도 된다 | 목록의 원소 하나를 기준으로 적는다. `.items`는 안 붙인다 |
| 값의 종류 | 정수나 문자열 | 목록이나 맵을 가리키면 정렬할 수 없다. `containers[*]`는 안 되고 `containers[0]`은 된다 |
| 방향 | 오름차순뿐 | 거꾸로는 `tac`(Linux), `tail -r`(macOS). 헤더가 끝으로 가니 `--no-headers`와 함께 |
| 시각 | 문자열이지만 순서가 맞는다 | RFC 3339 형식은 글자 순서가 시간 순서다 |
| 어디서 | kubectl이 전부 받아 온 뒤 | 서버는 정렬해 주지 않는다 |
| 출력 형식 | 따로 돈다 | 표, custom-columns, jsonpath 어느 것과도 같이 쓴다 |

{{< callout type="warning" >}}
**정렬의 기준이 목록의 원소가 아니면 조용히 틀린다.** `--sort-by=.status.capacity.memory`처럼 단위가 붙은 값은 결과를 눈으로 확인한다. `8Gi`와 `16384Mi`는 같은 크기인데 글자로는 다르다. 재시작 횟수처럼 컨테이너마다 있는 값은 `[0]`으로 첫 컨테이너의 것을 기준으로 삼는 것이고, 컨테이너가 여럿인 파드에서는 그것이 원하는 기준인지 본다. `-A`와 함께 쓰면 네임스페이스를 넘어 전체가 한 줄로 정렬된다.
{{< /callout >}}

```bash
kubectl get nodes \
  --sort-by=.status.capacity.cpu \
  -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.capacity.cpu
```

---

## 8. 실전 예제 모음

### 8.1 노드 운영

```bash
# 이름, 내부 IP, Ready
C='NAME:.metadata.name'
C=$C',IP:.status.addresses'
C=$C'[?(@.type=="InternalIP")].address'
C=$C',READY:.status.conditions'
C=$C'[?(@.type=="Ready")].status'
kubectl get nodes -o custom-columns="$C"

# 할당 가능한 자원
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.allocatable.cpu,\
MEM:.status.allocatable.memory

# taint
C='NAME:.metadata.name'
C=$C',TAINTS:.spec.taints[*].key'
kubectl get nodes -o custom-columns="$C"

# kubelet과 런타임 버전
N=.status.nodeInfo
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
KUBELET:$N.kubeletVersion,\
RUNTIME:$N.containerRuntimeVersion
```

### 8.2 Pod 운영

```bash
# 이름, 노드, IP
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
NODE:.spec.nodeName,\
IP:.status.podIP

# 이미지와 재시작 횟수
S=.status.containerStatuses
C='NAME:.metadata.name'
C=$C',IMAGE:.spec.containers[*].image'
C=$C",RESTARTS:${S}[*].restartCount"
kubectl get pods -o custom-columns="$C"

# 마지막 종료 이유
C='NAME:.metadata.name'
C=$C",WHY:${S}[*].lastState"
C=$C'.terminated.reason'
kubectl get pods -o custom-columns="$C"

# requests
R='.spec.containers[*].resources'
C='NAME:.metadata.name'
C=$C",CPU:$R.requests.cpu"
C=$C",MEM:$R.requests.memory"
kubectl get pods -o custom-columns="$C"
```

### 8.3 스토리지 / 구성

```bash
kubectl get pv -o custom-columns=\
NAME:.metadata.name,\
SIZE:.spec.capacity.storage,\
STATUS:.status.phase,\
CLAIM:.spec.claimRef.name

kubectl get pvc -o custom-columns=\
NAME:.metadata.name,\
STATUS:.status.phase,\
VOLUME:.spec.volumeName

kubectl get secrets -o custom-columns=\
NAME:.metadata.name,TYPE:.type

# Secret의 값 하나
kubectl get secret db \
  -o jsonpath='{.data.password}' \
  | base64 -d

# ConfigMap의 키 목록
kubectl get configmap app-config \
  -o json | jq '.data | keys'
```

| 예 | 앞 장에서 | 왜 |
|:---|:-------|:---|
| 마지막 종료 이유 | [14](../14-troubleshooting)장 6절 | CrashLoopBackOff의 원인을 파드 여럿에서 한 번에 |
| requests | [09](../09-observability)장 2절 | 안 적은 파드는 `<none>`으로 드러난다 |
| 할당 가능한 자원 | [05](../05-scheduling)장 7절 | 스케줄러가 보는 값은 용량이 아니라 이것이다 |
| Secret의 값 | [04](../04-workloads)장 9절 | base64는 되돌릴 수 있다 |
| 인증서 꺼내기 | [08](../08-security)장 2.4절 | `{.status.certificate}` |

---

## 9. CKA 빈출 JSONPath 패턴

### 9.1 자주 나오는 질문 유형

| 물음 | 푸는 법 | 왜 |
|:-----|:------|:---|
| 클러스터의 이미지를 겹치지 않게 | `{.items[*].spec.containers[*].image}`를 `tr ' ' '\n' \| sort -u`로 | `[*]` 둘로 펴고 셸로 추린다 |
| Ready가 아닌 노드 | 6.2절의 `range`와 `awk` | 필터 안의 필터는 안 된다 |
| 특정 노드의 파드 | `--field-selector spec.nodeName=node-1` | 서버가 거른다 |
| Service 뒤의 주소 | `kubectl get endpointslices -l kubernetes.io/service-name=web`에 `{.items[*].endpoints[*].addresses[*]}` | Endpoints는 1.33에서 deprecated다([07](../07-networking)장 3.2절) |
| 가장 오래된 파드 | `--sort-by=.metadata.creationTimestamp`의 첫 줄 | 오름차순이라 맨 위가 가장 오래됐다 |
| etcd의 이미지 버전 | `kubectl get pods -n kube-system -l component=etcd`에 `{.items[*].spec.containers[*].image}` | 정적 파드도 API로 보인다 |
| 어떤 taint가 걸려 있나 | `{.items[*].spec.taints[*].key}` | |

### 9.2 CPU 용량 기준 정렬 후 이름 추출

```bash
# CPU가 큰 노드부터 이름
kubectl get nodes --no-headers \
  --sort-by=.status.capacity.cpu \
  -o custom-columns=\
NAME:.metadata.name \
  | tac > /tmp/answer.txt
```

### 9.3 컨텍스트/클러스터 정보

```bash
kubectl config view \
  -o jsonpath='{.contexts[*].name}'
kubectl config view \
  -o jsonpath='{.current-context}'

# dev 컨텍스트의 사용자
Q='{.contexts[?(@.name=="dev")]'
Q=$Q'.context.user}'
kubectl config view -o jsonpath="$Q"

# 클러스터 이름과 서버 주소
Q='{range .clusters[*]}'
Q=$Q'{.name}{"\t"}'
Q=$Q'{.cluster.server}{"\n"}{end}'
kubectl config view -o jsonpath="$Q"
```

kubeconfig([08](../08-security)장 2.5절)도 같은 문법으로 읽는다. 파드나 노드가 아니어도 kubectl이 JSON으로 다룰 수 있는 것이면 된다.

{{< callout type="info" >}}
**답을 파일로 내야 할 때.** 값만 내야 하면 `-o jsonpath`를 쓰거나 custom-columns에 `--no-headers`를 붙인다. 헤더가 한 줄 끼어 있으면 틀린 답이 된다. 거꾸로 정렬할 때도 헤더를 빼야 헤더가 맨 끝으로 가지 않는다. 쓰기 전에 `-o json`으로 구조를 한 번 보는 것이 경로를 기억해 내는 것보다 빠르다.
{{< /callout >}}

---

## 10. 고급 조합

### 10.1 jq 연동

```bash
# 원하는 모양으로 다시 짠다
kubectl get nodes -o json | jq \
  '.items[] | {name: .metadata.name,
    cpu: .status.capacity.cpu}'

# 조건 여럿
kubectl get pods -A -o json | jq -r \
  '.items[]
   | select(.status.phase=="Running"
       and .spec.nodeName=="node-1")
   | .metadata.name'

# 정규식
kubectl get pods -o json | jq -r \
  '.items[]
   | select(.metadata.name
       | test("^web-"))
   | .metadata.name'

# Ready가 아닌 노드 (필터 안의 필터)
kubectl get nodes -o json | jq -r \
  '.items[]
   | select(any(.status.conditions[];
       .type=="Ready"
       and .status!="True"))
   | .metadata.name'
```

| 필요한 것 | kubectl JSONPath | jq | 왜 |
|:-------|:---------------|:---|:---|
| 값 꺼내기, 되풀이 | 된다 | 된다 | |
| 비교 하나 | 된다 | 된다 | |
| 조건 여럿(`and`, `or`) | 안 된다 | 된다 | |
| 정규식 | 안 된다 | `test()` | |
| 필터 안의 필터 | 안 된다 | `any()`, `select()` | |
| 계산, 세기, 묶기 | 안 된다 | `length`, `group_by`, `add` | |
| 다른 모양의 JSON으로 | 안 된다 | 된다 | |
| 깔려 있나 | kubectl에 | 따로 | |

### 10.2 셸 스크립트

```bash
# 노드마다
Q='{.items[*].metadata.name}'
for n in $(kubectl get nodes \
    -o jsonpath="$Q"); do
  echo "== $n"
  kubectl describe node "$n" \
    | grep -A5 "Allocated resources"
done

# 값을 변수로
IP=$(kubectl get pod web \
  -o jsonpath='{.status.podIP}')
curl -s "http://$IP:8080/healthz"

# 조건이 될 때까지
kubectl wait pod/web \
  --for=condition=Ready --timeout=60s
kubectl wait pod/web --timeout=60s \
  --for \
  jsonpath='{.status.phase}'=Running
```

`kubectl wait`의 `--for=jsonpath=`는 경로의 값이 주어진 값이 될 때까지 기다린다. 스크립트에서 `sleep`을 돌며 상태를 묻는 반복문을 대신한다.

### 10.3 출력 저장

```bash
# 전체를 JSON으로
kubectl get pods -A -o json > pods.json

# 표로
kubectl get pods -A --no-headers \
  -o custom-columns=\
NS:.metadata.namespace,\
NAME:.metadata.name,\
NODE:.spec.nodeName > pods.txt

# 값에 공백이 있어도 안전하게
Q='{.items[*].metadata.name}'
kubectl get pods \
  -o jsonpath-as-json="$Q"
```

---

## 11. 명령어 요약

```bash
# 구조 보기
kubectl get pod web -o json
kubectl explain pod.status

# 하나, 전부
kubectl get pod web \
  -o jsonpath='{.status.podIP}'
kubectl get nodes -o \
  jsonpath='{.items[*].metadata.name}'

# range
Q='{range .items[*]}'
Q=$Q'{.metadata.name}{"\t"}'
Q=$Q'{.status.phase}{"\n"}{end}'
kubectl get pods -o jsonpath="$Q"

# 필터
Q='{.items[?(@.status.phase'
Q=$Q'=="Running")].metadata.name}'
kubectl get pods -o jsonpath="$Q"

# 표
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.capacity.cpu

# 서버에서 거르기
kubectl get pods -l app=web
kubectl get pods --field-selector \
  status.phase=Running

# 정렬
kubectl get pods \
  --sort-by=.metadata.creationTimestamp
```

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 표와 오브젝트 | 표는 서버가 고른 몇 열, 오브젝트는 전체 | 먼저 `-o json`으로 구조를 본다 |
| 경로 | 맵은 점, 목록은 대괄호 | 구조를 따라 걷는 길 |
| 목록과 하나 | 목록은 `.items[*]`로 시작 | 틀리면 오류 없이 빈 값이 나온다 |
| `[*]` | 전부. 결과는 공백으로 나뉜 한 줄 | 짝을 맞추려면 `range` |
| `range` | 원소마다 되풀이. 안에서는 원소가 뿌리 | 탭과 줄바꿈을 직접 넣는다 |
| custom-columns | `이름:경로`로 만든 표 | `.items`도 중괄호도 없다 |
| 필터 | `[?(@.필드=="값")]`. 비교 하나 | 종류가 적힌 목록은 자리가 아니라 종류로 찾는다 |
| 셀렉터 | 서버가 거른다 | JSONPath의 필터는 받아 온 뒤 거른다 |
| 필드 셀렉터 | 종류마다 정해진 필드만 | 아무 필드나 되지 않는다 |
| 정렬 | 오름차순뿐. 정수나 문자열 | kubectl이 받아 온 뒤 정렬한다 |
| jq | 조건 여럿, 정규식, 계산, 필터 안의 필터 | kubectl의 JSONPath가 못 하는 것 |

### 빠른 참조

| 목적 | 경로나 옵션 | 왜 |
|:-----|:--------|:---|
| 모든 노드 이름 | `{.items[*].metadata.name}` | |
| 파드의 IP | `{.status.podIP}` | 하나를 물을 때는 `.items` 없이 |
| 모든 이미지 | `{.items[*].spec.containers[*].image}` | |
| 노드의 내부 IP | `{.items[*].status.addresses[?(@.type=="InternalIP")].address}` | 자리가 아니라 종류로 |
| 레이블의 값 | `{.metadata.labels.app\.kubernetes\.io/name}` | 키 안의 점은 `\.` |
| 마지막 종료 이유 | `{.status.containerStatuses[0].lastState.terminated.reason}` | |
| Secret의 값 | `{.data.password}`에 `base64 -d` | |
| 생성순 | `--sort-by=.metadata.creationTimestamp` | |
| 특정 노드의 파드 | `--field-selector spec.nodeName=node-1` | |
| 헤더 없이 | `--no-headers` | |

{{< callout type="info" >}}
**용어 정리**
- **JSONPath**: JSON 안의 값을 가리키는 경로 표기. kubectl은 그 일부와 `range`를 지원한다
- **템플릿**: 중괄호 안의 경로와 밖의 글자가 섞인 출력 틀
- **뿌리 (`$`)**: 경로의 시작. kubectl에서는 생략한다
- **`.items`**: 목록 조회의 결과에서 오브젝트들이 든 자리
- **와일드카드 (`[*]`)**: 목록의 모든 원소
- **필터 (`[?()]`)**: 조건에 맞는 원소만 고르는 식. `@`가 지금의 원소
- **range / end**: 목록을 돌며 안의 템플릿을 되풀이하는 구문
- **custom-columns**: `이름:경로`의 목록으로 표를 만드는 출력 형식
- **레이블 셀렉터 / 필드 셀렉터**: 서버가 목록을 거르는 두 조건. 레이블 / 정해진 필드
- **`--sort-by`**: kubectl이 받아 온 목록을 경로의 값으로 정렬하는 옵션
- **jq**: JSON을 다루는 명령줄 도구. 조건, 정규식, 계산
- **`kubectl explain`**: 리소스의 필드와 설명을 스키마에서 보여 주는 명령
{{< /callout >}}
