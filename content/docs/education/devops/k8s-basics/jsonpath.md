---
title: "JSONPath"
weight: 14
---

kubectl에서 JSONPath를 활용한 데이터 추출 및 포매팅 방법을 다룹니다.

---

## 1. JSONPath 개요

### 1.1 왜 JSONPath를 사용하는가?

프로덕션 환경에서 수백 개의 노드와 수천 개의 오브젝트에서 원하는 정보만 추출하기 위해 사용합니다.

```
┌──────────────────────────────────────────────────────────────┐
│                    kubectl과 JSON의 관계                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  kubectl get pods                                             │
│       │                                                       │
│       ▼                                                       │
│  kube-apiserver ◄──── JSON 통신                              │
│       │                                                       │
│       ▼                                                       │
│  kubectl (JSON → 사람이 읽기 쉬운 테이블로 변환)              │
│       │                                                       │
│       ▼                                                       │
│  NAME        READY   STATUS    RESTARTS   AGE                │
│  nginx-xxx   1/1     Running   0          5m                 │
│                                                               │
│  * 기본 출력으로는 많은 정보가 숨겨져 있음                    │
│  * -o wide로도 모든 정보를 볼 수 없음                         │
│  * JSONPath로 원하는 정보만 정확히 추출 가능                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 JSONPath 사용 4단계

```
1. 기본 명령어 파악
   kubectl get pods
        │
        ▼
2. JSON 형식으로 출력하여 구조 확인
   kubectl get pods -o json
        │
        ▼
3. JSONPath 쿼리 작성
   .items[0].spec.containers[0].image
        │
        ▼
4. kubectl에 JSONPath 적용
   kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'
```

---

## 2. 기본 문법

### 2.1 JSON 구조 확인

```bash
# JSON 형식으로 출력
kubectl get nodes -o json
kubectl get pods -o json

# 특정 리소스 JSON
kubectl get pod nginx -o json
kubectl get node node1 -o json
```

### 2.2 JSONPath 쿼리 기본

```bash
# 기본 형식
kubectl get <resource> -o jsonpath='{<query>}'

# 쿼리는 작은따옴표와 중괄호로 감싸야 함
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'
```

### 2.3 주요 연산자

| 연산자 | 설명 | 예시 |
|:-------|:-----|:-----|
| `.` | 하위 요소 접근 | `.metadata.name` |
| `[]` | 배열 인덱스 | `.items[0]` |
| `[*]` | 모든 배열 요소 | `.items[*]` |
| `[n:m]` | 배열 슬라이스 | `.items[0:3]` |
| `[?()]` | 필터 표현식 | `[?(@.status=="Running")]` |
| `@` | 현재 객체 | `[?(@.name=="nginx")]` |

---

## 3. 기본 쿼리

### 3.1 단일 값 추출

```bash
# 첫 번째 노드 이름
kubectl get nodes -o jsonpath='{.items[0].metadata.name}'

# 첫 번째 Pod의 이미지
kubectl get pods -o jsonpath='{.items[0].spec.containers[0].image}'

# 특정 Pod의 IP (단일 리소스는 .items 없이)
kubectl get pod nginx -o jsonpath='{.status.podIP}'
```

### 3.2 모든 값 추출

```bash
# 모든 노드 이름
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'

# 모든 Pod 이미지
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# 모든 노드 CPU 용량
kubectl get nodes -o jsonpath='{.items[*].status.capacity.cpu}'
```

### 3.3 여러 필드 추출

```bash
# 노드 이름과 CPU (공백 없이 연결됨)
kubectl get nodes -o jsonpath='{.items[*].metadata.name}{.items[*].status.capacity.cpu}'

# 출력: node1node2node348
```

---

## 4. 포매팅

### 4.1 줄바꿈과 탭

```bash
# 줄바꿈 추가
kubectl get nodes -o jsonpath='{.items[*].metadata.name}{"\n"}{.items[*].status.capacity.cpu}'

# 탭 추가
kubectl get nodes -o jsonpath='{.items[*].metadata.name}{"\t"}{.items[*].status.capacity.cpu}'

# 출력:
# node1 node2 node3
# 4 8 4
```

### 4.2 Range (반복문)

원하는 형식:
```
node1    4
node2    8
node3    4
```

```bash
# Range 문법
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'
```

**구조 분석:**
```
{range .items[*]}           # 각 항목에 대해 반복 시작
  {.metadata.name}          # 노드 이름
  {"\t"}                    # 탭
  {.status.capacity.cpu}    # CPU 수
  {"\n"}                    # 줄바꿈
{end}                       # 반복 종료
```

### 4.3 복잡한 Range 예시

```bash
# Pod 이름, 네임스페이스, 상태
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'

# 노드 이름, 내부 IP, CPU, 메모리
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.addresses[?(@.type=="InternalIP")].address}{"\t"}{.status.capacity.cpu}{"\t"}{.status.capacity.memory}{"\n"}{end}'
```

---

## 5. Custom Columns

### 5.1 기본 사용법

Range보다 간단하게 테이블 형식으로 출력합니다.

```bash
# 기본 형식
kubectl get <resource> -o custom-columns=<COLUMN>:<jsonpath>

# 노드 이름과 CPU
kubectl get nodes -o custom-columns=NODE:.metadata.name,CPU:.status.capacity.cpu
```

**장점:**
- `.items[*]` 생략 가능 (자동으로 각 항목에 적용)
- 열 이름 지정 가능
- 더 간결하고 읽기 쉬움

### 5.2 다양한 예시

```bash
# Pod 이름, 이미지, 상태
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image,STATUS:.status.phase

# 노드 이름, IP, OS
kubectl get nodes -o custom-columns=NAME:.metadata.name,IP:.status.addresses[0].address,OS:.status.nodeInfo.osImage

# Deployment 이름, replicas
kubectl get deploy -o custom-columns=NAME:.metadata.name,DESIRED:.spec.replicas,AVAILABLE:.status.availableReplicas

# Service 이름, 타입, ClusterIP
kubectl get svc -o custom-columns=NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP
```

### 5.3 파일에서 컬럼 정의

```bash
# columns.txt 파일 작성
# NAME          JSONPATH
# NODE          .metadata.name
# CPU           .status.capacity.cpu
# MEMORY        .status.capacity.memory

kubectl get nodes -o custom-columns-file=columns.txt
```

---

## 6. 필터링

### 6.1 조건부 필터

```bash
# 특정 상태의 Pod만
kubectl get pods -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}'

# 특정 노드의 Pod
kubectl get pods -o jsonpath='{.items[?(@.spec.nodeName=="node1")].metadata.name}'

# 특정 이미지를 사용하는 컨테이너
kubectl get pods -o jsonpath='{.items[*].spec.containers[?(@.image=="nginx")].name}'
```

### 6.2 복합 조건

```bash
# 특정 레이블을 가진 리소스
kubectl get pods -l app=nginx -o jsonpath='{.items[*].metadata.name}'

# 여러 조건 조합 (kubectl 필터 + JSONPath)
kubectl get pods --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}'
```

### 6.3 배열 내 특정 요소 찾기

```bash
# InternalIP 타입의 주소만 추출
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'

# Ready 상태의 조건만 추출
kubectl get nodes -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}'
```

---

## 7. 정렬

### 7.1 --sort-by 옵션

```bash
# 이름으로 정렬
kubectl get nodes --sort-by=.metadata.name

# 생성 시간으로 정렬
kubectl get pods --sort-by=.metadata.creationTimestamp

# CPU 용량으로 정렬
kubectl get nodes --sort-by=.status.capacity.cpu

# 메모리 용량으로 정렬
kubectl get nodes --sort-by=.status.capacity.memory

# 재시작 횟수로 정렬
kubectl get pods --sort-by=.status.containerStatuses[0].restartCount
```

### 7.2 정렬과 JSONPath 조합

```bash
# 정렬 후 특정 필드만 출력
kubectl get pods --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[*].metadata.name}'

# 정렬 후 Custom Columns
kubectl get nodes --sort-by=.status.capacity.cpu -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu
```

---

## 8. 실전 예제

### 8.1 노드 정보

```bash
# 노드 이름, IP, 상태
kubectl get nodes -o custom-columns=NAME:.metadata.name,IP:.status.addresses[0].address,STATUS:.status.conditions[-1].type

# 노드별 할당 가능 리소스
kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory

# 노드 Taints
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints[*].key

# kubelet 버전
kubectl get nodes -o custom-columns=NAME:.metadata.name,VERSION:.status.nodeInfo.kubeletVersion
```

### 8.2 Pod 정보

```bash
# Pod 이름, 노드, IP
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP

# Pod 이미지와 재시작 횟수
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image,RESTARTS:.status.containerStatuses[*].restartCount

# Pod 리소스 요청/제한
kubectl get pods -o custom-columns=NAME:.metadata.name,CPU_REQ:.spec.containers[*].resources.requests.cpu,MEM_REQ:.spec.containers[*].resources.requests.memory

# Running 상태의 Pod만
kubectl get pods --field-selector=status.phase=Running -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName
```

### 8.3 PV/PVC 정보

```bash
# PV 이름, 용량, 상태
kubectl get pv -o custom-columns=NAME:.metadata.name,CAPACITY:.spec.capacity.storage,STATUS:.status.phase

# PVC 이름, 상태, 볼륨
kubectl get pvc -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,VOLUME:.spec.volumeName
```

### 8.4 Secret/ConfigMap 정보

```bash
# Secret 이름과 타입
kubectl get secrets -o custom-columns=NAME:.metadata.name,TYPE:.type

# ConfigMap 키 목록
kubectl get configmap <name> -o jsonpath='{.data}' | jq 'keys'
```

---

## 9. CKA 시험 유용 쿼리

### 9.1 자주 사용되는 쿼리

```bash
# 모든 네임스페이스의 Pod 이미지 목록
kubectl get pods -A -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u

# 특정 레이블의 Pod 수
kubectl get pods -l app=nginx --no-headers | wc -l

# Ready 상태가 아닌 노드
kubectl get nodes -o jsonpath='{.items[?(@.status.conditions[-1].status!="True")].metadata.name}'

# 특정 노드에서 실행 중인 Pod
kubectl get pods -A --field-selector spec.nodeName=node1 -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name

# Service의 Endpoints
kubectl get endpoints -o custom-columns=NAME:.metadata.name,ENDPOINTS:.subsets[*].addresses[*].ip
```

### 9.2 빠른 정보 추출

```bash
# 클러스터 내 모든 이미지
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# 모든 네임스페이스
kubectl get ns -o jsonpath='{.items[*].metadata.name}'

# 모든 Service 타입
kubectl get svc -A -o custom-columns=NAME:.metadata.name,TYPE:.spec.type

# etcd 버전
kubectl get pods -n kube-system -l component=etcd -o jsonpath='{.items[*].spec.containers[*].image}'
```

---

## 10. 고급 기법

### 10.1 jq와 함께 사용

```bash
# jq로 JSON 처리 (더 강력한 필터링)
kubectl get pods -o json | jq '.items[].metadata.name'

# 조건 필터링
kubectl get pods -o json | jq '.items[] | select(.status.phase=="Running") | .metadata.name'

# 특정 필드만 추출
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, cpu: .status.capacity.cpu}'
```

### 10.2 스크립트 활용

```bash
# 모든 Pod의 이미지를 환경변수로
IMAGES=$(kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}')

# 반복문에서 사용
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'); do
  echo "Node: $node"
  kubectl describe node $node | grep -A5 "Allocated resources"
done
```

### 10.3 출력을 파일로 저장

```bash
# JSON 저장
kubectl get pods -o json > pods.json

# 특정 정보만 저장
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image > pods-images.txt
```

---

## 11. 명령어 요약

```bash
# 기본 JSONPath
kubectl get <resource> -o jsonpath='{<query>}'

# 모든 항목
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'

# 단일 리소스 (.items 없이)
kubectl get pod nginx -o jsonpath='{.status.podIP}'

# Range (반복)
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'

# Custom Columns
kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu

# 필터
kubectl get pods -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}'

# 정렬
kubectl get pods --sort-by=.metadata.creationTimestamp

# 조합
kubectl get pods --sort-by=.metadata.creationTimestamp -o custom-columns=NAME:.metadata.name,AGE:.metadata.creationTimestamp
```

---

## 12. 요약

{{< callout type="info" >}}
**핵심 포인트:**
- `-o json`으로 먼저 구조 확인
- 단일 리소스는 `.items` 없이, 목록은 `.items[*]` 사용
- Custom Columns가 Range보다 간편 (테이블 형식)
- `[?(@.field=="value")]`로 필터링
- `--sort-by`로 정렬
- CKA 시험에서 빠른 정보 추출에 필수
{{< /callout >}}

### 빠른 참조

| 목적 | 명령어 |
|:-----|:-------|
| 모든 노드 이름 | `kubectl get nodes -o jsonpath='{.items[*].metadata.name}'` |
| 모든 Pod 이미지 | `kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'` |
| 노드별 CPU | `kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu` |
| Running Pod만 | `kubectl get pods -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}'` |
| 생성순 정렬 | `kubectl get pods --sort-by=.metadata.creationTimestamp` |
