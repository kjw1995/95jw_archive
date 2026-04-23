---
title: "15. JSONPath"
weight: 15
---

kubectl에서 JSONPath로 원하는 필드만 정밀 추출하고 포매팅하는 방법을 정리한다.

## 1. JSONPath가 필요한 이유

`kubectl`은 기본적으로 사람이 읽기 쉬운 테이블을 출력하지만, 내부적으로는 API 서버와 JSON으로 통신한다. 기본 출력이나 `-o wide`로는 다 드러나지 않는 필드(테인트, 할당 가능 리소스, 조건부 주소 등)를 꺼내려면 JSONPath가 필요하다.

```text
    kubectl get pods
          │
          ▼
┌──────────────────────┐
│   kube-apiserver     │
│   (JSON 응답)         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  kubectl 포매터       │
│  JSON → 테이블 변환   │
└──────────┬───────────┘
           │
           ▼
    NAME   READY   STATUS
    nginx  1/1     Running
```

기본 테이블은 전체 필드의 일부만 보여준다. `-o json`으로 전체 구조를 확인한 뒤 `-o jsonpath`나 `-o custom-columns`로 원하는 필드만 추출한다.

### 1.1 4단계 접근법

```text
1. 명령 파악        kubectl get pods
        │
        ▼
2. 구조 확인        kubectl get pods -o json
        │
        ▼
3. 쿼리 작성        .items[0].spec.containers[0].image
        │
        ▼
4. 쿼리 적용        -o jsonpath='{...}'
```

## 2. JSONPath 기본 문법

### 2.1 쿼리 구조

```bash
# 기본 형식: 작은따옴표 + 중괄호로 감싼다
kubectl get <resource> -o jsonpath='{<query>}'

# 예: 모든 노드 이름
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'
```

### 2.2 연산자 치트시트

| 연산자 | 의미 | 예시 |
|:---|:---|:---|
| `.field` | 하위 요소 접근 | `.metadata.name` |
| `[n]` | 배열 인덱스 | `.items[0]` |
| `[*]` | 모든 요소 | `.items[*]` |
| `[n:m]` | 슬라이스 | `.items[0:3]` |
| `[-1]` | 마지막 요소 | `.conditions[-1]` |
| `[?(@.k=="v")]` | 필터 표현식 | `[?(@.type=="Ready")]` |
| `@` | 현재 객체 참조 | `[?(@.name=="nginx")]` |
| `{range}...{end}` | 반복 블록 | `{range .items[*]}...{end}` |
| `{"\n"}`, `{"\t"}` | 리터럴 문자 | 포매팅 구분자 |

{{< callout type="info" >}}
**jq vs JSONPath**
- **JSONPath(kubectl 내장)**: 외부 의존성 없이 동작, `$` 루트 생략, `range`·`custom-columns` 등 kubectl 전용 기능 사용 가능. 단 산술·정규식·복잡한 변환은 불가.
- **jq**: 풍부한 함수, 타입 변환, 파이프 연산이 가능하지만 별도 설치 필요. CKA 시험 환경에서는 JSONPath로 끝내는 편이 안전하다.
{{< /callout >}}

### 2.3 단일 리소스 vs 목록

| 출력 대상 | 최상위 구조 | 쿼리 시작 |
|:---|:---|:---|
| `kubectl get pods` (목록) | `{items: [...]}` | `.items[*]...` |
| `kubectl get pod nginx` (단일) | `{metadata, spec, status}` | `.metadata...` |

```bash
# 목록: .items[*] 필요
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# 단일 리소스: .items 없이 바로 접근
kubectl get pod nginx -o jsonpath='{.status.podIP}'
```

## 3. 기본 추출 패턴

### 3.1 단일 값

```bash
# 첫 번째 노드 이름
kubectl get nodes \
  -o jsonpath='{.items[0].metadata.name}'

# 첫 번째 Pod의 컨테이너 이미지
kubectl get pods \
  -o jsonpath='{.items[0].spec.containers[0].image}'
```

### 3.2 전체 값

```bash
# 모든 노드 이름 (공백 구분)
kubectl get nodes \
  -o jsonpath='{.items[*].metadata.name}'

# 모든 Pod의 모든 컨테이너 이미지
kubectl get pods \
  -o jsonpath='{.items[*].spec.containers[*].image}'
```

### 3.3 여러 필드 직접 연결

```bash
# 주의: 연결자 없이 붙여 쓰면 값들이 이어 붙는다
kubectl get nodes \
  -o jsonpath='{.items[*].metadata.name}{.items[*].status.capacity.cpu}'
# 출력: node1node2node348
```

필드 사이 구분이 필요하면 `{"\t"}`, `{"\n"}` 리터럴을 넣거나 `range`를 사용한다.

## 4. 포매팅과 Range

### 4.1 리터럴 문자

```bash
# 이름과 CPU를 줄 단위로 병렬 출력
kubectl get nodes -o jsonpath=\
'{.items[*].metadata.name}{"\n"}{.items[*].status.capacity.cpu}'
```

이 방식은 두 배열이 같은 길이일 때만 의미가 있다. 항목별로 짝을 맞추려면 `range`가 필요하다.

### 4.2 range 블록

```bash
kubectl get nodes -o jsonpath=\
'{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'
```

**구조:**

```text
{range .items[*]}        # 반복 시작
  {.metadata.name}       # 노드 이름
  {"\t"}                 # 탭
  {.status.capacity.cpu} # CPU
  {"\n"}                 # 줄바꿈
{end}                    # 반복 종료
```

출력:

```text
node1   4
node2   8
node3   4
```

### 4.3 복합 range

```bash
# 네임스페이스 + Pod 이름 + 상태
kubectl get pods -A -o jsonpath=\
'{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'

# 노드 이름 + InternalIP + CPU + 메모리
kubectl get nodes -o jsonpath=\
'{range .items[*]}{.metadata.name}{"\t"}{.status.addresses[?(@.type=="InternalIP")].address}{"\t"}{.status.capacity.cpu}{"\t"}{.status.capacity.memory}{"\n"}{end}'
```

## 5. Custom Columns

### 5.1 기본 사용법

`range` 대신 열 헤더 기반 테이블이 필요하면 `-o custom-columns`가 더 간결하다.

```bash
kubectl get nodes \
  -o custom-columns=NODE:.metadata.name,CPU:.status.capacity.cpu
```

| 특성 | Range (jsonpath) | Custom Columns |
|:---|:---|:---|
| `.items[*]` 명시 | 필요 | 자동 적용 |
| 헤더 | 직접 출력해야 함 | 자동 생성 |
| 구분자 | `\t`, `\n` 수동 | 열 단위 정렬 |
| 셸 파이프 가공 | 자유로움 | 고정 포맷 |

### 5.2 다양한 예시

```bash
# Pod 이름/이미지/상태
kubectl get pods \
  -o custom-columns=\
NAME:.metadata.name,\
IMAGE:.spec.containers[*].image,\
STATUS:.status.phase

# Deployment 희망/가용 replicas
kubectl get deploy \
  -o custom-columns=\
NAME:.metadata.name,\
DESIRED:.spec.replicas,\
AVAILABLE:.status.availableReplicas
```

### 5.3 파일로 컬럼 정의

```text
# columns.txt
NAME       JSONPATH
NODE       .metadata.name
CPU        .status.capacity.cpu
MEMORY     .status.capacity.memory
```

```bash
kubectl get nodes -o custom-columns-file=columns.txt
```

### 5.4 Custom Columns vs JSONPath 선택 기준

| 상황 | 권장 |
|:---|:---|
| 테이블로 보기 좋게 출력 | Custom Columns |
| 헤더가 필요 없음 | JSONPath |
| 쉘 파이프로 후처리(`awk`, `tr`) | JSONPath |
| 필터링 결과의 단일 필드 추출 | JSONPath |
| 반복되는 운영 리포트 | custom-columns-file |
| `--sort-by` 사용 | 둘 다 가능 (Custom Columns이 더 읽기 쉬움) |

## 6. 필터링

### 6.1 조건부 필터 `[?()]`

```bash
# Running 상태의 Pod 이름
kubectl get pods -o jsonpath=\
'{.items[?(@.status.phase=="Running")].metadata.name}'

# 특정 노드에 스케줄된 Pod
kubectl get pods -o jsonpath=\
'{.items[?(@.spec.nodeName=="node1")].metadata.name}'

# nginx 이미지를 사용하는 컨테이너
kubectl get pods -o jsonpath=\
'{.items[*].spec.containers[?(@.image=="nginx")].name}'
```

### 6.2 배열 내 조건 검색

```bash
# InternalIP 주소만
kubectl get nodes -o jsonpath=\
'{.items[*].status.addresses[?(@.type=="InternalIP")].address}'

# Ready 조건의 상태만
kubectl get nodes -o jsonpath=\
'{.items[*].status.conditions[?(@.type=="Ready")].status}'
```

### 6.3 kubectl 셀렉터와 조합

```bash
# 라벨 셀렉터 + JSONPath
kubectl get pods -l app=nginx \
  -o jsonpath='{.items[*].metadata.name}'

# field-selector + custom-columns
kubectl get pods --field-selector=status.phase=Running \
  -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName
```

## 7. 정렬 `--sort-by`

```bash
# 이름 오름차순
kubectl get nodes --sort-by=.metadata.name

# 생성 시각 오름차순 (오래된 것부터)
kubectl get pods --sort-by=.metadata.creationTimestamp

# CPU 용량 오름차순
kubectl get nodes --sort-by=.status.capacity.cpu

# 재시작 횟수 오름차순
kubectl get pods --sort-by=.status.containerStatuses[0].restartCount
```

{{< callout type="warning" >}}
**`--sort-by` 동작 주의**
- 항상 **오름차순**이다. 내림차순이 필요하면 `| tac` 또는 `awk`로 뒤집는다.
- 경로는 **작은따옴표 없이** 그대로 쓴다. `{}` 중괄호도 붙이지 않는다.
- 문자열·숫자·타임스탬프만 정렬 가능하다. 배열 필드(`containers[*].image` 등)는 정렬 키로 사용할 수 없다.
- `-A`(모든 네임스페이스)와 같이 사용할 때 네임스페이스 경계를 넘어 전체 정렬된다는 점을 기억한다.
{{< /callout >}}

```bash
# 정렬 + Custom Columns
kubectl get nodes --sort-by=.status.capacity.cpu \
  -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu

# 내림차순이 필요한 경우
kubectl get pods --sort-by=.status.containerStatuses[0].restartCount | tac
```

## 8. 실전 예제 모음

### 8.1 노드 운영

```bash
# 이름 / IP / 마지막 조건
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
IP:.status.addresses[0].address,\
STATUS:.status.conditions[-1].type

# 할당 가능 리소스
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.allocatable.cpu,\
MEMORY:.status.allocatable.memory

# 노드 Taints 키만
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,TAINTS:.spec.taints[*].key

# kubelet 버전
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
VERSION:.status.nodeInfo.kubeletVersion
```

### 8.2 Pod 운영

```bash
# 이름 / 노드 / IP
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
NODE:.spec.nodeName,\
IP:.status.podIP

# 이미지와 재시작 횟수
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
IMAGE:.spec.containers[*].image,\
RESTARTS:.status.containerStatuses[*].restartCount

# Running 상태만
kubectl get pods --field-selector=status.phase=Running \
  -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName
```

### 8.3 스토리지 / 구성

```bash
# PV
kubectl get pv -o custom-columns=\
NAME:.metadata.name,\
CAPACITY:.spec.capacity.storage,\
STATUS:.status.phase

# PVC
kubectl get pvc -o custom-columns=\
NAME:.metadata.name,\
STATUS:.status.phase,\
VOLUME:.spec.volumeName

# Secret 타입
kubectl get secrets \
  -o custom-columns=NAME:.metadata.name,TYPE:.type

# ConfigMap 키 목록 (jq 필요)
kubectl get configmap <name> -o jsonpath='{.data}' | jq 'keys'
```

## 9. CKA 빈출 JSONPath 패턴

### 9.1 자주 나오는 질문 유형

| 유형 | 예시 쿼리 |
|:---|:---|
| 전체 이미지 유일 목록 | `kubectl get pods -A -o jsonpath='{.items[*].spec.containers[*].image}' \| tr ' ' '\n' \| sort -u` |
| NotReady 노드 | `kubectl get nodes -o jsonpath='{.items[?(@.status.conditions[-1].status!="True")].metadata.name}'` |
| 특정 노드의 Pod | `kubectl get pods -A --field-selector spec.nodeName=node1 -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name` |
| Service Endpoints | `kubectl get endpoints -o custom-columns=NAME:.metadata.name,EP:.subsets[*].addresses[*].ip` |
| 가장 오래된 Pod | `kubectl get pods --sort-by=.metadata.creationTimestamp \| head -2` |
| etcd 이미지 버전 | `kubectl get pods -n kube-system -l component=etcd -o jsonpath='{.items[*].spec.containers[*].image}'` |

### 9.2 CPU 용량 기준 정렬 후 이름 추출

```bash
# 문제: CPU 용량이 가장 큰 노드부터 이름을 적어라
kubectl get nodes \
  --sort-by=.status.capacity.cpu \
  -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu \
  | tac
```

### 9.3 컨텍스트/클러스터 정보

```bash
# 현재 kubeconfig의 컨텍스트 이름 목록
kubectl config view \
  -o jsonpath='{.contexts[*].name}'

# 사용자별 인증 모드
kubectl config view \
  -o jsonpath='{range .users[*]}{.name}{"\t"}{.user.client-certificate}{"\n"}{end}'
```

{{< callout type="info" >}}
**CKA 팁**: 답안을 제출해야 하는 문제는 `> /tmp/answer.txt`로 리다이렉트해 저장한다. Custom Columns는 헤더가 붙으므로 순수 값만 제출해야 할 때는 `--no-headers` 또는 `-o jsonpath`를 사용한다.
{{< /callout >}}

## 10. 고급 조합

### 10.1 jq 연동

```bash
# 원하는 구조로 재조립
kubectl get nodes -o json \
  | jq '.items[] | {name: .metadata.name, cpu: .status.capacity.cpu}'

# 조건 필터 후 이름만
kubectl get pods -o json \
  | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name'
```

### 10.2 셸 스크립트

```bash
# 노드 이름으로 반복
for node in $(kubectl get nodes \
                -o jsonpath='{.items[*].metadata.name}'); do
  echo "Node: $node"
  kubectl describe node "$node" | grep -A5 "Allocated resources"
done

# 모든 이미지를 환경변수로
IMAGES=$(kubectl get pods -A \
  -o jsonpath='{.items[*].spec.containers[*].image}')
```

### 10.3 출력 저장

```bash
# JSON 백업
kubectl get pods -A -o json > pods.json

# CSV 스타일 저장
kubectl get pods -A -o custom-columns=\
NS:.metadata.namespace,\
NAME:.metadata.name,\
IMAGE:.spec.containers[*].image > pods.tsv
```

## 11. 명령어 요약

```bash
# 기본
kubectl get <resource> -o jsonpath='{<query>}'

# 전체 항목
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'

# 단일 리소스
kubectl get pod nginx -o jsonpath='{.status.podIP}'

# range
kubectl get nodes -o jsonpath=\
'{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'

# Custom Columns
kubectl get nodes \
  -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu

# 필터
kubectl get pods -o jsonpath=\
'{.items[?(@.status.phase=="Running")].metadata.name}'

# 정렬
kubectl get pods --sort-by=.metadata.creationTimestamp

# 정렬 + Custom Columns
kubectl get pods --sort-by=.metadata.creationTimestamp \
  -o custom-columns=NAME:.metadata.name,AGE:.metadata.creationTimestamp
```

## 12. 핵심 정리

| 포인트 | 내용 |
|:---|:---|
| 구조 확인 | `-o json`으로 먼저 트리 파악 |
| 목록 vs 단일 | `.items[*]` 유무로 구분 |
| 포매팅 | `range`로 항목별 짝 맞추기 |
| 테이블 | Custom Columns가 가장 간결 |
| 필터 | `[?(@.field=="value")]` |
| 정렬 | `--sort-by`는 오름차순 고정 |
| 후처리 | 필요 시 jq·tr·awk와 조합 |

### 빠른 참조

| 목적 | 명령 |
|:---|:---|
| 모든 노드 이름 | `kubectl get nodes -o jsonpath='{.items[*].metadata.name}'` |
| 모든 Pod 이미지 | `kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'` |
| 노드별 CPU | `kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu` |
| Running Pod만 | `kubectl get pods -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}'` |
| 생성순 정렬 | `kubectl get pods --sort-by=.metadata.creationTimestamp` |
| NotReady 노드 | `kubectl get nodes -o jsonpath='{.items[?(@.status.conditions[-1].status!="True")].metadata.name}'` |
