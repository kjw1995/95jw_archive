---
title: "04. 워크로드 관리"
date: 2026-04-23
weight: 4
---

[02. 핵심 개념](../02-core-concepts)에서 워크로드 종류를 훑고 Deployment가 ReplicaSet을 거쳐 파드를 다룬다는 것을 봤고, [03. 클러스터 구성](../03-cluster-setup)에서 그것을 돌릴 클러스터를 세웠다. 이 장은 그 위에서 애플리케이션을 배포하고, 바꾸고, 설정을 넣는 방법이다. 원리는 셋이다. 첫째, **매니페스트는 명령이 아니라 원하는 상태의 선언이고, 컨트롤러가 현재 상태를 거기에 맞춘다.** Deployment는 ReplicaSet에게 "몇 개"를 맡기고 ReplicaSet은 파드를 세며, 누가 누구 것인지는 라벨과 셀렉터가 정한다. 그래서 셀렉터와 템플릿 라벨이 어긋나면 API 서버가 받아 주지도 않는다. 둘째, **변경은 파드를 고치는 것이 아니라 새 파드로 바꾸는 것이다.** 파드 템플릿이 바뀌면 새 ReplicaSet이 생기고, 개수가 옛것에서 새것으로 옮겨 간다. 롤아웃, 롤백, 리비전이 모두 이 ReplicaSet 교체의 다른 이름이고, `maxSurge`와 `maxUnavailable`은 그 옮기는 속도다. 셋째, **설정과 비밀은 이미지 밖에 두고 파드가 뜰 때 주입한다.** 환경 변수는 시작할 때 한 번 읽히고, 볼륨은 kubelet이 계속 갱신하며, Secret은 base64로 적히고 메모리 파일 시스템에 놓인다. 이 PC의 Docker Desktop 위에 k3s 두 노드를 띄워 이 장의 롤아웃, 롤백, 일시 정지, 설정 갱신, 사이드카, 블루/그린과 카나리를 전부 실제로 돌려봤다.

---

## 1. kubectl 기본 흐름

모든 조작은 kubectl이 API 서버에 요청을 보내는 것이고, 명령형과 선언형 두 갈래가 있다(02장 10절). 실무는 **선언형 `apply`** 를 기본으로 두고, 명령형은 확인과 디버깅과 응급 조치에 쓴다.

| 명령 | 방식 | 용도 | 왜 이 명령인가 |
|:-----|:-----|:-----|:-------------|
| `kubectl create` | 명령형 | 새 자원 생성 | 이미 있으면 실패한다. 그래서 두 번 실행해도 안전한 apply와 다르다 |
| `kubectl apply -f` | 선언형 | 생성과 변경 | 파일이 진실이다. 없으면 만들고 있으면 차이만 반영한다 |
| `kubectl get` | 조회 | 목록과 상태 | 컨트롤러가 적어 둔 status를 읽는다 |
| `kubectl describe` | 조회 | 상세와 이벤트 | 파드가 왜 안 뜨는지는 이벤트에 있다 |
| `kubectl edit` | 변경 | 편집기에서 바로 수정 | 급할 때. 파일과 어긋나므로 나중에 파일에 반영한다 |
| `kubectl delete` | 삭제 | 자원 제거 | Deployment를 지우면 ReplicaSet과 파드가 따라 지워진다 |
| `kubectl exec -it` | 디버깅 | 컨테이너 안에서 명령 | kubelet의 10250 포트를 API 서버가 중계한다(03장) |

```bash
# 빠른 Deployment 생성과 확인
kubectl create deployment web \
  --image=nginx:1.27-alpine \
  --replicas=3 --port=80
kubectl get deployment web
kubectl get pod -o wide   # IP, 노드
kubectl exec -it web-xxx -- sh
```

명령형으로 시작해도 선언형으로 넘어갈 수 있다. `--dry-run=client -o yaml`을 붙이면 자원을 만들지 않고 매니페스트만 찍어 주므로, 골격을 받아 파일로 저장한 뒤 apply로 관리한다.

이 PC에서 `kubectl get deployment web`이 보여 준 열이다.

```text
NAME  READY  UP-TO-DATE  AVAILABLE  AGE
web   3/3    3           3          28s
```

| 열 | 뜻 | 왜 따로 있나 |
|:---|:---|:-----------|
| READY | 준비된 파드 / 원하는 파드 | 준비 검사(readiness)를 통과한 것만 센다 |
| UP-TO-DATE | 최신 템플릿으로 뜬 파드 수 | 롤아웃 진행률. 8절의 잘못된 이미지에서는 READY 3/3인데 UP-TO-DATE 1이었다 |
| AVAILABLE | 사용 가능한 파드 수 | READY에서 `minReadySeconds`를 넘긴 것 |
| AGE | 생성 후 경과 시간 | |

파드 목록(`kubectl get pod`)의 READY는 다른 뜻이다. `1/1`처럼 **준비된 컨테이너 수 / 파드의 컨테이너 수**이고, RESTARTS는 컨테이너 재시작 누계다. 같은 이름의 열이 자원마다 다른 것을 세니 헷갈리기 쉽다.

---

## 2. YAML 매니페스트

**매니페스트**는 원하는 상태를 적은 파일이다. kubectl이 API 서버에 제출하면 etcd에 저장되고, 컨트롤러가 실제 상태를 거기에 맞춘다. 첫째 원리 그대로다.

### 작성 규칙

| 규칙 | 설명 | 왜 |
|:-----|:-----|:---|
| `-` | 리스트 항목 | `containers`, `env`, `volumes`는 여러 개라 리스트다 |
| `:` | 키-값 구분, 뒤에 공백 | `key:value`는 문자열 하나로 읽힌다 |
| `---` | 문서 구분자 | 파일 하나에 Deployment와 Service를 함께 둔다 |
| `#` | 주석 | |
| 들여쓰기 | **스페이스만**, 탭 금지 | YAML 규격이 탭을 들여쓰기로 인정하지 않는다 |

### 공통 4요소

모든 매니페스트는 `apiVersion`, `kind`, `metadata`, `spec`을 갖는다. 02장 11절에서 본 구조다.

```yaml
apiVersion: apps/v1     # API 그룹/버전
kind: Deployment        # 오브젝트 종류
metadata:
  name: web   # 네임스페이스 안 유일
  labels:
    app: web
spec:
  replicas: 3           # 원하는 파드 수
  selector:
    matchLabels:
      app: web    # 템플릿 라벨과 일치
  template:             # 파드 템플릿
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-alpine
        ports:
        - containerPort: 80
```

`selector`가 소유권이다. Deployment는 이 라벨을 가진 파드를 자기 것으로 세고, 템플릿은 그 라벨을 달고 파드를 만든다. 둘이 어긋나면 만든 파드를 자기 것으로 못 세니 성립할 수 없는 선언이고, API 서버는 그것을 받아 주지 않는다. 이 PC에서 셀렉터는 `app: bad`, 템플릿은 `app: other`로 apply하자 이렇게 거절됐다.

```text
The Deployment "bad" is invalid:
spec.template.metadata.labels:
Invalid value: {"app":"other"}:
`selector` does not match
template `labels`
```

{{< callout type="info" >}}
원문은 어긋나면 "파드를 끝없이 생성한다"고 했는데, 그 일은 일어나지 않는다. `apps/v1`의 Deployment는 생성 시점에 검증에 걸리고, 이미 있는 Deployment의 `spec.selector`를 바꾸려 하면 `field is immutable`로 거절된다(이 PC에서 확인). 셀렉터를 바꾸고 싶으면 새 Deployment를 만든다. 끝없는 생성에 가까운 일은 다른 곳에서 난다. 돌고 있는 파드의 라벨을 손으로 바꾸면 ReplicaSet은 그 파드를 잃은 것으로 보고 하나를 더 만들고, 라벨을 뗀 파드는 고아로 남는다.
{{< /callout >}}

---

## 3. 주요 워크로드 오브젝트

02장 5절의 표를 "몇 개를 언제 어디에"의 규칙으로 다시 본다.

| 오브젝트 | 규칙 | 특징 | 왜 따로 있나 |
|:--------|:-----|:-----|:-----------|
| Pod | 컨테이너 묶음 하나 | 최소 배포 단위. 단독 사용은 피한다 | 죽으면 아무도 다시 만들지 않는다(02장) |
| ReplicaSet | 항상 N개 | 보통 Deployment가 만든다 | 개수만 아는 단순한 컨트롤러 |
| Deployment | N개 + 템플릿 교체 방법 | 롤아웃, 롤백, 일시 정지 | ReplicaSet을 갈아 끼우는 상위 컨트롤러 |
| StatefulSet | 순서와 이름이 있는 N개 | 고정 이름, 순서 기동, 파드마다 PVC | DB처럼 "내가 누구인지"가 중요한 앱([06](../06-storage)장 6절) |
| DaemonSet | 노드마다 1개 | 노드가 늘면 따라 늘어난다 | 로그 수집기, 모니터링 에이전트([05](../05-scheduling)장 8절) |
| Job | 성공 N번까지 | 실패하면 재시도 | 끝이 있는 일 |
| CronJob | 스케줄마다 Job 생성 | crontab 형식 | 주기 배치 |

### Pod와 사이드카

파드는 같은 네트워크 네임스페이스와 볼륨을 나눠 쓰는 컨테이너 묶음이다. 02장에서 사이드카가 `127.0.0.1`로 옆 컨테이너의 nginx에 닿는 것을 봤다.

```text
┌──────────── Pod ────────────┐
│ ┌────────┐    ┌──────────┐  │
│ │  Main  │    │ Sidecar  │  │
│ │  (앱)  │    │ (로그)   │  │
│ └───┬────┘    └────┬─────┘  │
│     └─── 공유 ─────┘        │
│      (네트워크·볼륨)         │
└─────────────────────────────┘
```

### ReplicaSet

지정한 개수의 파드를 유지한다. 직접 쓰는 일은 드물고 Deployment가 만든다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-alpine
```

```bash
kubectl scale rs/my-rs --replicas=5
kubectl delete rs my-rs \
  --cascade=orphan   # RS만 지우고 보존
```

`--cascade=orphan`이 첫째 원리를 보여 준다. 이 PC에서 파드 2개짜리 ReplicaSet을 고아 삭제하자 파드 `rs-demo-rccqc`, `rs-demo-sqg4w`는 그대로 돌았고, 같은 셀렉터의 ReplicaSet을 다시 만들자 새 파드를 하나도 만들지 않고 그 둘을 다시 자기 것으로 셌다(READY 2/2). 소유는 이름이 아니라 라벨이 정하고, 컨트롤러는 "라벨이 맞는 파드가 몇 개인가"만 본다. 이 성질 덕에 Deployment를 지웠다가 다시 만들어도 파드를 이어받을 수 있다.

### DaemonSet

모든(또는 셀렉터로 고른) 노드에 파드 1개씩 둔다. 이 PC의 두 노드에서 DaemonSet 하나가 파드 2개가 됐고, 02장에서는 컨트롤 플레인 노드에 올리려면 toleration이 필요한 것도 봤다.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      tier: monitoring
  template:
    metadata:
      labels:
        tier: monitoring
    spec:
      containers:
      - name: exporter
        image: prom/node-exporter
        ports:
        - containerPort: 9100
```

### Job과 CronJob

Job은 완주가 목표다. `completions`는 성공해야 하는 횟수, `parallelism`은 동시에 돌릴 파드 수, `backoffLimit`은 실패 허용 횟수(기본 6)다. 파드의 `restartPolicy`는 `Never`나 `OnFailure`만 허용된다. `Always`면 성공해도 다시 시작해 끝이 없기 때문이다.

이 PC에서 두 Job을 돌렸다.

| Job | 설정 | 결과 |
|:----|:-----|:-----|
| batch | `completions: 3`, `parallelism: 2`, 5초 잠자기 | 파드 2개가 먼저, 1개가 뒤에 돌아 3/3 완료, 36초 |
| failing | `exit 1`, `backoffLimit: 2` | 파드 3개(첫 시도 + 재시도 2회)가 모두 Error, 54초 뒤 `Failed`, 이유 `BackoffLimitExceeded` |

재시도 파드의 시작 시각은 0초, 28초, 50초였다. 실패할수록 간격을 두는 지수 백오프(문서상 10초, 20초, 40초, 최대 6분)에 파드 기동 시간이 얹힌 값이다. 끝난 Job은 남아 있으므로 `ttlSecondsAfterFinished`를 주면 지정 시간 뒤 파드와 함께 지워진다.

CronJob은 Job을 스케줄마다 만든다. 02장에서 1분마다 도는 CronJob이 실제로 Job을 만드는 것을 봤다.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"   # 매일 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox:1.36
            command: ["sh", "-c"]
            args: ["echo backup done"]
          restartPolicy: OnFailure
```

```text
┌───── 분 (0-59)
│ ┌─── 시 (0-23)
│ │ ┌─ 일 (1-31)
│ │ │ ┌─ 월 (1-12)
│ │ │ │ ┌─ 요일 (0-6, 0=일)
│ │ │ │ │
* * * * *
```

스케줄의 시간대는 컨트롤러 매니저의 시간대(보통 UTC)이고, `timeZone` 필드로 따로 지정할 수 있다. "매일 02:00"이 한국 시간 11시에 도는 사고가 여기서 난다.

---

## 4. Deployment 배포 전략

둘째 원리다. Deployment는 파드를 고치지 않는다. 템플릿이 바뀌면 새 ReplicaSet을 만들고 개수를 옮긴다. `strategy`는 그 옮기는 방식이다.

```text
┌──────────────┬──────────────┐
│   Recreate   │ RollingUpdate│
├──────────────┼──────────────┤
│ 전부 내리고  │ 하나씩 교체  │
│ 새로 띄움    │ (기본값)     │
│ 다운타임 있음│ 무중단       │
│ 자원 그대로  │ 자원 더 필요 │
└──────────────┴──────────────┘

  Blue/Green        Canary
  (서비스 전환)     (트래픽 분할)
```

### Recreate

모든 파드를 내린 뒤 새 파드를 띄운다. 두 버전이 동시에 돌면 안 되는 앱(스키마 잠금, 단일 리더)에 쓴다.

```yaml
spec:
  strategy:
    type: Recreate
```

이 PC에서 파드 3개짜리 Deployment의 이미지를 바꾸며 1초마다 준비된 파드 수를 셌다.

```text
t+1s  [v1×][v1×][v1×]   ready 0
t+3s  [v2*][v2*][v2*]   ready 0
t+5s  [v2][v2][v2]      ready 3
(×: 종료 중, *: 준비 중)
```

약 4초 동안 응답할 파드가 하나도 없었다. 이미지가 이미 노드에 있고 nginx가 1초 만에 뜨는 조건에서도 그렇고, 이미지를 새로 받아야 하면 그 시간이 그대로 다운타임이 된다.

### RollingUpdate (기본)

옛 파드를 조금씩 새 파드로 바꾼다. **maxSurge**는 원하는 개수보다 더 띄울 수 있는 수, **maxUnavailable**은 원하는 개수보다 모자라도 되는 수다.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 더 띄울 수
      maxUnavailable: 0  # 모자라도 됨
```

이 PC에서 `maxSurge: 1`, `maxUnavailable: 0`, 파드 3개, 준비 검사 2초 조건으로 nginx 1.27을 1.28로 바꾸며 관찰한 것이다.

```text
t+1s   [v1][v1][v1] + [v2*]      4
t+15s  [v1][v1][v1×][v2][v2*]    5
t+17s  [v1][v1][v2][v2*]         4
t+27s  [v1][v1×][v2][v2][v2*]    5
t+31s  [v2][v2][v2]              3
(*: 준비 중, ×: 종료 중)
```

준비된 파드는 45초 동안 한 번도 3 아래로 내려가지 않았다. `maxUnavailable: 0`이 지켜진 것이다. 목록에 5개가 보인 순간은 종료 중인 파드가 아직 사라지지 않았을 때인데, 종료 중인 파드는 surge 계산에 들어가지 않으므로 규칙 위반이 아니다. 첫 새 파드가 준비되기까지 14초가 걸린 것은 노드가 1.28 이미지를 받는 시간이고, 그 뒤로는 한 개씩 12초 간격으로 교체됐다. 세 개를 바꾸는 데 31초, 하나당 이미지 기동과 준비 검사 두 번이 든 값이다.

| maxSurge | maxUnavailable | 성격 | 왜 |
|:---------|:--------------|:-----|:---|
| 25% | 25% | 기본값, 균형 | 절대 수는 surge가 올림, unavailable이 내림이라 파드 3개면 surge 1, unavailable 0이 된다 |
| 1 | 0 | 가용성 우선 | 위 실측. 항상 원하는 수 이상이 준비돼 있다 |
| 0 | 1 | 자원 절약 | 노드에 여유 자원이 없을 때. 하나는 항상 비어 있다 |
| 50% | 0 | 빠른 배포 + 무중단 | 절반씩 교체. 자원이 1.5배 필요 |

`kubectl explain`이 알려 주는 반올림 규칙이 중요하다. 백분율을 절대 수로 바꿀 때 `maxUnavailable`은 **내림**, `maxSurge`는 **올림**이다. 그래서 기본값 25%는 파드 3개에서 `unavailable 0, surge 1`이 되어 사실상 무중단이고, 파드 1개에서도 surge 1이라 새것이 준비된 뒤 옛것이 내려간다.

{{< callout type="warning" >}}
`maxSurge`와 `maxUnavailable`을 **둘 다 0으로 두면 롤아웃이 멈춘다.** 더 띄울 수도, 내릴 수도 없어서다. 이것도 API 서버가 거절한다. `kubectl explain`의 설명에 "MaxSurge가 0이면 0일 수 없다"고 적혀 있다. 또 `maxUnavailable: 0`은 준비 검사가 있어야 뜻이 있다. 검사가 없으면 컨테이너가 시작만 하면 준비된 것으로 치므로, 아직 요청을 못 받는 파드로 트래픽이 간다.
{{< /callout >}}

### Blue/Green과 Canary

둘 다 Deployment 하나의 전략이 아니라 Deployment 둘과 Service로 만드는 구성이다. 트래픽을 나누는 것은 Service의 셀렉터([07](../07-networking)장 3절)다.

- **Blue/Green**: v1(blue)과 v2(green)을 다 띄워 놓고 Service의 `selector`만 바꿔 트래픽을 한 번에 옮긴다. 이 PC에서 `version: blue`를 가리키던 Service를 `green`으로 패치하자 다음 요청부터 여섯 번 모두 green이 답했다. 엔드포인트가 즉시 바뀌므로 돌아가는 것도 패치 한 번이다. 대가는 두 배의 자원이다.
- **Canary**: 일부 트래픽만 v2로 보내 본다. 같은 라벨 `app: cn`에 stable 3개, canary 1개를 두고 Service가 `app: cn`을 고르게 하자 40번 요청 중 29번이 stable, 11번이 canary였다. 비율이 파드 수로 정해지므로 1%를 보내려면 파드 100개가 필요하다. 정밀한 비율은 Ingress나 Gateway API(07장 8절과 9절), 서비스 메시(07장 11절)가 한다.

```bash
kubectl patch service bg -p \
  '{"spec":{"selector":
    {"app":"bg","version":"green"}}}'
```

---

## 5. Rollout과 Rollback

Deployment의 템플릿이 바뀔 때마다 **Rollout**이 일어나고 **Revision** 번호가 하나 오른다. 리비전의 실체는 ReplicaSet이다. 옛 ReplicaSet을 0개로 줄여 남겨 두었다가 롤백하면 그것을 다시 키운다. 스케일링은 템플릿을 바꾸지 않으므로 롤아웃도 리비전도 아니다.

```text
rev1 v1.27 ─set image─► rev2 v1.28
rev2 v1.28 ─오타 이미지─► rev3 v9.99
undo ──────────► rev4 (=rev2 템플릿)
undo --to-revision=1 ► rev5 (=rev1)
```

### 상태와 이력 조회

```bash
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout history deployment/web \
  --revision=2
```

이력의 CHANGE-CAUSE 열은 Deployment의 `kubernetes.io/change-cause` 어노테이션을 ReplicaSet에 복사한 것이다. 예전의 `--record` 플래그는 도움말에서 사라진 숨은 플래그라 쓰지 않고, 어노테이션을 직접 단다. 순서에 함정이 있다. 어노테이션은 **그 순간 최신인 ReplicaSet**에 복사되므로, 어노테이션을 먼저 달고 이미지를 바꾸면 옛 리비전에 새 설명이 붙는다. 이 PC에서 그렇게 했더니 리비전 1과 2가 둘 다 "nginx 1.28"로 찍혔다. 이미지와 어노테이션을 파일에서 함께 바꿔 한 번에 apply하는 것이 맞다.

### 이미지 업데이트

```bash
# 이미지만 교체
kubectl set image deployment/web \
  nginx=nginx:1.28-alpine

# 파일 수정 후 반영 (권장)
kubectl apply -f deployment.yaml

# 편집기에서 바로
kubectl edit deployment web
```

### 잘못된 이미지를 배포하면

둘째 원리가 롤아웃을 안전하게 만든다. 이 PC에서 존재하지 않는 `nginx:9.99-alpine`으로 바꾸고 `progressDeadlineSeconds: 45`를 두었다.

| 시점 | 관찰 |
|:-----|:-----|
| 12초 | 파드 4개: Running 3(옛 1.28) + ErrImagePull 1. `kubectl get deployment`는 READY 3/3, UP-TO-DATE 1, AVAILABLE 3 |
| 내내 | Service로 보낸 요청은 전부 옛 파드가 정상 응답 |
| 52초 | `rollout status`가 "exceeded its progress deadline"으로 끝남. 조건은 `Available=True`, `Progressing=False, ProgressDeadlineExceeded` |

`maxUnavailable: 0`이라 옛 파드는 새 파드가 준비되기 전까지 하나도 내려가지 않았고, 새 파드는 준비될 수 없으니 롤아웃이 거기서 멈췄다. 서비스는 멀쩡했다. `progressDeadlineSeconds`(기본 600)는 이 멈춤을 "실패"로 보고하는 시한이고, 컨트롤러는 그 뒤에도 계속 시도한다. 사람이 `undo`를 하거나 파일을 고쳐 apply하면 된다. 이미지 이름 오타는 [14](../14-troubleshooting)장 5절의 ImagePullBackOff가 된다.

### 롤백과 일시 정지

```bash
# 바로 이전 리비전으로
kubectl rollout undo deployment/web

# 특정 리비전으로
kubectl rollout undo deployment/web \
  --to-revision=2

# 롤아웃 제어
kubectl rollout pause  deployment/web
kubectl rollout resume deployment/web
```

이 PC의 롤백 기록이다. 9.99에서 `undo`하자 이미지가 1.28로 돌아왔고 이력에서 리비전 2가 사라지고 4가 생겼다. 다시 `--to-revision=1`로 가자 1.27이 되며 리비전 1이 사라지고 5가 생겼다. 롤백한 리비전은 새 리비전이 되고, 그 템플릿의 ReplicaSet은 하나뿐이니 옛 번호가 사라지는 것이다. 보관하는 옛 ReplicaSet 개수는 `revisionHistoryLimit`(기본 10)이고, 이 PC에서 5로 두어 ReplicaSet 3개(1.27, 1.28, 9.99)가 남았다.

```yaml
spec:
  revisionHistoryLimit: 5
```

`undo`는 경고를 하나 찍었다. 롤백은 `kubectl.kubernetes.io/last-applied-configuration` 어노테이션을 건드리지 않으므로, 다음 `kubectl apply`가 파일과 클러스터의 차이를 잘못 계산할 수 있다는 것이다. 파일로 관리하는 클러스터라면 롤백도 파일을 되돌려 apply하는 것이 맞고, `undo`는 응급용이다.

일시 정지도 봤다. `pause` 뒤에 이미지를 1.28로 바꾸고 4개로 늘리자, 스케일은 즉시 적용되어 옛 이미지 파드가 4개가 됐지만 UP-TO-DATE는 0이었고 조건은 `DeploymentPaused`였다. `resume`하자 그때 롤아웃이 시작됐다. 여러 필드를 고치면서 롤아웃을 한 번만 일으키고 싶을 때 쓴다.

---

## 6. Command와 Args

컨테이너의 진입점은 이미지의 `ENTRYPOINT`와 `CMD`에서 오고, 매니페스트의 `command`와 `args`가 그것을 덮는다.

| Docker | Kubernetes | 역할 |
|:-------|:-----------|:-----|
| ENTRYPOINT | `command` | 실행 프로그램 |
| CMD | `args` | 인자 |

네 경우를 이 PC에서 파드 넷으로 확인했다.

| command | args | 실행되는 것 | 실측 |
|:--------|:-----|:-----------|:-----|
| 없음 | 없음 | 이미지의 ENTRYPOINT + CMD | nginx가 그냥 뜬다 |
| 없음 | `["nginx", "-v"]` | 이미지 ENTRYPOINT + 내 args | nginx 이미지의 진입 스크립트가 먼저 돌고 `nginx -v`를 실행했다 |
| `["sh", "-c", "echo hi"]` | 없음 | 내 command만, CMD는 버려진다 | `hi from command` |
| `["echo"]` | `["from", "args"]` | 내 command + 내 args | `from args` |

busybox처럼 ENTRYPOINT가 없는 이미지에서 `args`만 주면 그 args가 곧 명령이 된다(`echo busybox args only`가 그대로 출력됐다). 그래서 "args만 주면 안전하다"는 이미지에 따라 다르다. 만들어진 뒤에는 둘 다 바꿀 수 없다. 파드는 불변이고 바꾸려면 새 파드다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sleeper
spec:
  containers:
  - name: sleeper
    image: ubuntu
    command: ["sleep"]  # ENTRYPOINT
    args: ["100"]         # CMD 대체
```

여러 명령이나 파이프는 셸에 맡긴다.

```yaml
containers:
- name: app
  image: busybox:1.36
  command: ["/bin/sh", "-c"]
  args:
  - |
    echo "Starting..."
    sleep 100
    echo "Done"
```

---

## 7. 환경변수 주입

셋째 원리의 첫 방식이다. 환경 변수는 컨테이너가 시작할 때 한 번 만들어지고 그 뒤로는 바뀌지 않는다.

### 직접 정의

```yaml
env:
- name: APP_ENV
  value: "production"
- name: PORT
  value: "8080"
```

### Downward API (파드 자신의 정보)

파드는 자기 이름이나 IP를 미리 알 수 없다. 스케줄러가 노드를 정하고 CNI가 IP를 준 뒤에야 정해지기 때문이다. Downward API는 그 값을 kubelet이 시작 직전에 채워 넣는 통로다.

```yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: MEM_LIMIT
  valueFrom:
    resourceFieldRef:
      resource: limits.memory
```

이 PC의 파드가 찍은 값이다.

```text
POD_NAME=envdemo
POD_IP=10.42.0.14
NODE_NAME=k3s-lab
MEM_LIMIT=67108864
```

`MEM_LIMIT`은 `64Mi`가 바이트로 온 것이다. `resourceFieldRef`에 `divisor: 1Mi`를 주면 64로 받는다. 로그에 자기 파드 이름을 찍거나, JVM 힙을 limit에 맞춰 잡을 때 쓴다.

---

## 8. ConfigMap

설정값을 이미지에서 떼어 내 환경마다 바꿀 수 있게 한다. 같은 이미지가 개발과 운영에서 다른 DB를 보는 방법이다.

### 생성

```bash
# 리터럴
kubectl create configmap app-config \
  --from-literal=DB_HOST=mysql \
  --from-literal=LOG_LEVEL=info

# 파일 (키 = 파일 이름)
kubectl create configmap nginx-config \
  --from-file=nginx.conf=./nginx.conf
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "mysql"
  LOG_LEVEL: "info"
  application.properties: |
    server.port=8080
    spring.profiles.active=prod
```

한 ConfigMap의 데이터는 1MiB까지다. etcd의 객체 크기 한계 안에서 정한 값이고, 그보다 크면 설정이 아니라 파일이니 볼륨이나 외부 저장소에 둔다.

### 사용: 환경변수

```yaml
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DATABASE_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: DB_HOST
    envFrom:
    - configMapRef:
        name: app-config   # 모든 키
```

`envFrom`은 키 이름이 곧 변수 이름이다. 이 PC에서 위 ConfigMap을 `envFrom`으로 넣자 `DB_HOST`, `LOG_LEVEL`과 함께 `application.properties=server.port=8080`까지 변수로 들어왔다. 1.34에서 GA가 된 완화된 이름 검증 덕에 점이 든 키도 거절되지 않는 것인데, 셸에서는 `$application.properties`로 읽을 수 없는 이름이라 쓸모는 없다. 파일 성격의 키는 볼륨으로 넣는다.

### 사용: 볼륨 마운트

```yaml
spec:
  containers:
  - name: app
    image: nginx:1.27-alpine
    volumeMounts:
    - name: conf
      mountPath: /etc/nginx/conf.d
      readOnly: true
  volumes:
  - name: conf
    configMap:
      name: nginx-config
      items:
      - key: nginx.conf
        path: default.conf
```

| 주입 방식 | ConfigMap을 바꾸면 | 왜 |
|:---------|:-----------------|:---|
| `env`, `envFrom` | 바뀌지 않는다. 파드 재시작 필요 | 환경 변수는 프로세스 시작 시 한 번 만들어지는 것이라 커널이 바꿀 길이 없다 |
| 볼륨 | kubelet이 갱신한다. 이 PC에서 30초 | kubelet이 주기 동기화마다 확인하고, 파일을 새 디렉터리에 쓴 뒤 심볼릭 링크를 바꿔 원자적으로 교체한다 |
| 볼륨 + `subPath` | 바뀌지 않는다 | 링크 교체 대신 파일 하나를 직접 마운트해서 링크가 바뀌어도 옛 파일을 본다 |
| `immutable: true` | 바꿀 수 없다(다시 만들어야) | kubelet이 지켜보지 않아도 되므로 API 서버 부하가 줄고, 실수로 바뀌는 일이 없다 |

이 PC에서 같은 ConfigMap을 세 방식으로 넣은 파드에 `msg: v1`을 `v2`로 패치했다. 30초 뒤 볼륨의 파일은 v2가 됐고, `subPath` 파일과 환경 변수는 끝까지 v1이었다. 마운트 디렉터리 안을 보면 `msg -> ..data/msg`처럼 파일이 링크이고, `..data`가 타임스탬프 디렉터리를 가리킨다. 갱신은 새 디렉터리를 만들고 `..data` 링크를 옮기는 것이라 앱이 읽는 도중에 반쪽 파일을 보는 일이 없다. 지연은 kubelet 동기화 주기(기본 1분)에 캐시 전파 시간이 더해진 값이라 "즉시"는 아니다. 앱이 파일 변경을 감지해 다시 읽는 코드가 없으면 갱신돼도 소용없다는 점도 기억한다.

---

## 9. Secret

패스워드, API 키, 인증서 같은 민감 정보를 담는다. 값은 **base64로 인코딩**되어 저장되고 전달된다.

{{< callout type="warning" >}}
**base64는 암호화가 아니다.** 이 PC에서 `S3cr3t!`를 넣은 Secret을 `kubectl get secret -o jsonpath`로 읽으니 `UzNjcjN0IQ==`였고 `base64 -d` 한 줄로 원문이 나왔다. 공식 문서도 Secret이 기본으로는 etcd에 **암호화 없이** 저장된다고 적는다. 그래서 etcd 저장 시 암호화(kubeadm의 EncryptionConfiguration, k3s의 `--secrets-encryption`), Secret에 대한 RBAC 최소 권한([08](../08-security)장 4절), 저장소에 커밋하지 않기, Vault나 클라우드 시크릿 매니저 같은 외부 저장소를 함께 쓴다. base64를 쓰는 이유는 보안이 아니라 인증서 파일 같은 바이너리를 JSON에 담기 위해서다.
{{< /callout >}}

### 생성

```bash
# 일반 Secret
kubectl create secret generic \
  db-secret \
  --from-literal=username=admin \
  --from-literal=password='S3cr3t!'

# TLS 인증서
kubectl create secret tls my-tls \
  --cert=tls.crt --key=tls.key

# 컨테이너 레지스트리 자격증명
kubectl create secret docker-registry \
  regcred \
  --docker-server=registry.example.io \
  --docker-username=user \
  --docker-password=pass
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:      # 평문, 자동 인코딩
  username: admin
  password: S3cr3t!
```

`stringData`는 쓰기 전용 편의 필드다. 저장될 때 `data`로 인코딩되어 합쳐지고, 다시 읽으면 `data`의 base64만 보인다. `kubectl create secret ... --dry-run=client -o yaml`로 뽑아도 `password: UzNjcjN0IQ==`처럼 인코딩된 채로 나온다.

### Secret 타입

| 타입 | 용도 | 왜 타입이 있나 |
|:-----|:-----|:-------------|
| `Opaque` | 기본, 임의 키-값 | 검증 없음 |
| `kubernetes.io/tls` | TLS 인증서 | `tls.crt`, `tls.key` 키가 있는지 API 서버가 검사한다. Ingress가 이 형식을 기대한다 |
| `kubernetes.io/dockerconfigjson` | 레지스트리 자격증명 | `imagePullSecrets`가 이 형식을 읽는다(08장 8절) |
| `kubernetes.io/basic-auth` | 아이디와 비밀번호 | `username`, `password` 키 |
| `kubernetes.io/ssh-auth` | SSH 키 | `ssh-privatekey` 키 |
| `kubernetes.io/service-account-token` | 서비스 계정 토큰 | 1.24부터는 자동 생성되지 않고 필요할 때만 만든다(08장 5절) |
| `bootstrap.kubernetes.io/token` | 노드 조인 토큰 | 03장의 부트스트랩 토큰이 `kube-system`에 이 타입으로 있다 |

### 사용

```yaml
spec:
  containers:
  - name: app
    image: my-app
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    volumeMounts:
    - name: tls
      mountPath: /etc/tls
      readOnly: true
  volumes:
  - name: tls
    secret:
      secretName: my-tls
      defaultMode: 0400
```

이 PC의 파드 안에서 확인한 것이다. 환경 변수 `DB_PASSWORD`와 파일 `/etc/sec/password`에 모두 평문 `S3cr3t!`가 있었고, 파일 권한은 `-r--------`(0400), 마운트의 파일 시스템은 **tmpfs**였다. Secret 볼륨은 메모리에만 놓여 노드 디스크에 남지 않는다. 그래서 파드가 떠 있는 노드의 메모리 덤프가 아니면 디스크에서 비밀을 건질 수 없다. 갱신 규칙은 ConfigMap과 같다. 환경 변수는 재시작 전까지 옛 값, 볼륨은 kubelet이 갱신, `subPath`는 갱신 없음, 크기는 1MiB까지.

---

## 10. Init Container

메인 컨테이너 **전에** 순서대로 실행되는 컨테이너다. 하나가 끝나야 다음이 시작하고, 모두 성공해야 메인이 뜬다. 실패하면 파드의 `restartPolicy`에 따라 그 init부터 다시 한다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ["sh", "-c"]
    args:
    - |
      until nc -z web 80; do
        sleep 1
      done
  - name: db-migrate
    image: my-app:migrate
    command: ["./migrate"]
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url
  containers:
  - name: app
    image: my-app
```

이 PC에서 init 둘(서비스 대기, 3초짜리 마이그레이션 흉내)을 가진 파드의 STATUS 열을 1초마다 봤다.

```text
t+0s  0/1  Init:0/2   wait-db 실행 중
t+2s  0/1  Init:1/2   migrate 실행 중
t+7s  1/1  Running    app 시작
```

`Init:1/2`는 "init 2개 중 1개 끝남"이다. 메인이 뜨기 전 준비 조건을 파드 안에서 푸는 것이 요점인데, 왜 메인 컨테이너의 시작 스크립트에 넣지 않는가. init은 메인과 다른 이미지를 쓸 수 있어 앱 이미지에 `nc`나 마이그레이션 도구를 넣지 않아도 되고, 실패가 `Init:Error`로 따로 보여 원인이 분리되기 때문이다.

```bash
kubectl describe pod app
kubectl logs app -c wait-for-db  # init
```

| 특성 | Init Container | Sidecar | 왜 |
|:-----|:--------------|:--------|:---|
| 실행 시점 | 메인 이전, 순서대로 | 메인과 함께 | init은 준비, 사이드카는 동반 |
| 지속성 | 끝나면 종료 | 계속 실행 | |
| 용도 | 의존성 대기, 마이그레이션, 파일 준비 | 로그, 프록시, 모니터링 | |
| 실패 | 파드가 `Init:Error`, 재시도 | 컨테이너만 재시작 | |

---

## 11. 멀티 컨테이너 패턴

한 파드에 컨테이너를 여럿 두는 이유는 하나다. 네트워크와 볼륨을 나눠 쓰면서 이미지와 수명은 따로 가지기 위해서다.

| 패턴 | 역할 | 예시 | 왜 같은 파드인가 |
|:-----|:-----|:-----|:---------------|
| Sidecar | 보조 기능 추가 | Fluent Bit 로그 수집, Envoy 프록시 | 앱의 파일과 localhost를 그대로 본다 |
| Adapter | 출력 표준화 | 옛 로그 형식을 JSON으로 | 앱을 고치지 않고 출력만 바꾼다 |
| Ambassador | 외부 연결 대리 | DB 커넥션 풀, 서비스 디스커버리 | 앱은 localhost만 알면 된다 |

### 사이드카를 쓰는 두 가지 방법

원문의 방식은 `containers`에 컨테이너를 하나 더 두는 것이다. 이 PC의 02장 실험이 그것이다. 1.33에서 GA가 된 **네이티브 사이드카**는 `initContainers`에 두고 `restartPolicy: Always`를 준다. 이름과 달리 끝나지 않는 init이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  initContainers:
  - name: log-shipper
    image: busybox:1.36
    restartPolicy: Always    # 사이드카
    command: ["sh", "-c"]
    args: ["tail -F /logs/app.log"]
    volumeMounts:
    - {name: logs, mountPath: /logs}
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c"]
    args:
    - |
      while true; do
        date >> /logs/app.log
        sleep 2
      done
    volumeMounts:
    - {name: logs, mountPath: /logs}
  volumes:
  - name: logs
    emptyDir: {}
```

| 방식 | 시작 순서 | 종료 순서 | Job에서 | 왜 |
|:-----|:---------|:---------|:-------|:---|
| `containers`에 추가 | 메인과 동시(순서 보장 없음) | 동시 | 사이드카가 안 끝나면 Job이 끝나지 않는다 | 파드의 컨테이너는 대등하다 |
| `initContainers` + `restartPolicy: Always` | 메인보다 먼저, 준비되면 메인 시작 | 메인이 끝난 뒤 | 메인이 끝나면 함께 내려가 Job이 완료된다 | init 순서 규칙을 빌려 "먼저 뜨고 나중에 내려가는" 컨테이너를 만든 것 |

이 PC에서 네이티브 사이드카 파드는 READY `2/2`로 떴고, `initContainerStatuses`의 상태가 `running`이었으며, `kubectl logs -c log-shipper`에 앱이 `emptyDir`에 쓴 줄이 그대로 흘러나왔다. 프록시 사이드카가 앱보다 늦게 떠서 앱의 첫 요청이 실패하는 옛 문제가 이 순서 보장으로 풀린다. 같은 파드 안에서는 `localhost`로 서로 부른다.

---

## 12. 오토스케일링 개요

| 영역 | 수평 | 수직 |
|:-----|:-----|:-----|
| 워크로드 | HPA(파드 수) | VPA(파드의 requests) |
| 클러스터 | Cluster Autoscaler(노드 추가) | 노드 스펙 증가(비권장) |

```bash
# 수동 스케일링
kubectl scale deployment web \
  --replicas=5

# HPA 생성
kubectl autoscale deployment web \
  --cpu=50% --min=2 --max=5
```

`--cpu-percent`는 deprecated이고 `--cpu=50%`를 쓴다(이 PC의 kubectl 1.36이 경고했다). HPA는 메트릭 API가 있어야 돈다. 이 PC의 k3s에는 metrics-server가 있어서 만들고 17초 뒤 `TARGETS`가 `cpu: 2%/50%`로 나왔다. 백분율의 분모는 컨테이너의 `resources.requests.cpu`라 requests가 없는 파드는 계산에서 빠진다. 원하는 개수는 `ceil(현재 개수 × 현재값 / 목표값)`이라 이 경우 `ceil(3 × 2/50) = 1`이지만 `--min=2`에 걸리고, 줄이는 쪽은 안정화 창 5분을 기다리므로 17초 뒤에도 3개였다. 상세 설정, 메트릭 종류, 튜닝은 [09](../09-observability)장 5절과 6절에서 본다.

---

## 13. 명령어 요약

```bash
# 배포·롤아웃
kubectl apply -f deployment.yaml
kubectl set image deployment/web \
  nginx=nginx:1.28-alpine
kubectl rollout status  deployment/web
kubectl rollout history deployment/web
kubectl rollout undo    deployment/web \
  --to-revision=2
kubectl rollout pause   deployment/web
kubectl rollout resume  deployment/web

# 스케일링
kubectl scale deployment web \
  --replicas=5
kubectl autoscale deployment web \
  --cpu=50% --min=2 --max=5

# 설정·비밀
kubectl create configmap app-config \
  --from-literal=KEY=VALUE
kubectl create secret generic \
  db-secret \
  --from-literal=password=secret
kubectl get configmap,secret
kubectl get secret db-secret \
  -o jsonpath='{.data.password}' \
  | base64 -d

# 디버깅
kubectl describe pod my-pod
kubectl logs my-pod -c init-container
kubectl exec -it my-pod -- sh
kubectl get events \
  --sort-by=.lastTimestamp
```

---

## 핵심 정리

| 개념 | 설명 | 왜 |
|:-----|:-----|:---|
| 매니페스트 | 원하는 상태의 선언. `apply`가 기본 | 컨트롤러가 맞추는 것이라 두 번 적용해도 같다 |
| 셀렉터 | 소유권. 템플릿 라벨과 일치해야 하고 바꿀 수 없다 | 어긋나면 API 서버가 거절한다. 고아 파드도 라벨로 다시 거둔다 |
| Deployment | ReplicaSet을 갈아 끼우며 롤아웃·롤백 | 파드는 고치지 않고 바꾼다 |
| RollingUpdate | `maxSurge`/`maxUnavailable`로 속도와 가용성 | 이 PC에서 준비 파드가 3 아래로 내려간 적이 없다 |
| Recreate | 전부 내리고 새로 | 약 4초의 빈 시간을 실측 |
| Rollback | `rollout undo`, 롤백한 리비전은 새 번호 | 리비전은 ReplicaSet이고 템플릿마다 하나다 |
| 잘못된 이미지 | 옛 파드가 남고 새 파드만 멈춘다 | `maxUnavailable`이 옛것을 지킨다. `progressDeadlineSeconds`가 실패를 보고 |
| ConfigMap | 설정을 이미지 밖으로 | env는 재시작 전까지 고정, 볼륨은 30초 뒤 갱신, subPath는 갱신 없음 |
| Secret | base64 + tmpfs, 암호화는 아님 | etcd 암호화와 RBAC은 따로 |
| Init / 사이드카 | 먼저 끝나는 것 / 먼저 떠서 나중에 내려가는 것 | 1.33부터 `restartPolicy: Always`인 init이 사이드카 |
| Blue/Green, Canary | Service 셀렉터 전환 / 파드 수 비율 | 40번 중 11번이 카나리로 갔다 |

{{< callout type="warning" >}}
**검증하지 못한 것**
- 모든 실측은 k3s 두 노드, nginx와 busybox 같은 작은 이미지에서 한 것이다. 이미지가 크거나 준비 검사가 길면 롤아웃 시간과 Recreate의 빈 시간은 그만큼 늘어난다.
- ConfigMap 볼륨 갱신 30초는 이 PC의 k3s 기본 설정(동기화 1분, watch 캐시)에서 한 번 잰 값이다. 클러스터 설정에 따라 최대 2분 가까이 걸릴 수 있다.
- StatefulSet, VPA, Cluster Autoscaler, Ingress와 서비스 메시의 트래픽 분할, 외부 시크릿 저장소는 실행하지 않았고 해당 장으로 미룬다.
- Job의 재시도 간격은 문서의 10초, 20초, 40초와 달리 28초, 22초로 잡혔다. 파드 기동 시간이 섞인 값이라 지수 증가를 직접 확인한 것은 아니다.
{{< /callout >}}

{{< callout type="info" >}}
**용어 정리**
- **Manifest**: 원하는 상태를 선언한 YAML 파일
- **Selector / Label**: 컨트롤러가 자기 파드를 고르는 조건과 파드에 붙은 표
- **Rollout / Revision**: 템플릿 변경으로 일어나는 ReplicaSet 교체 / 그 기록. 리비전의 실체는 ReplicaSet
- **maxSurge / maxUnavailable**: 원하는 수보다 더 띄울 수 있는 수 / 모자라도 되는 수. 백분율은 올림 / 내림
- **progressDeadlineSeconds**: 롤아웃이 이 시간 동안 진전이 없으면 실패로 보고(기본 600초)
- **ConfigMap**: 일반 설정값 저장 오브젝트, 1MiB까지
- **Secret**: 민감 정보 저장 오브젝트. base64, tmpfs, 기본은 비암호화
- **Downward API**: 파드 자신의 메타데이터와 자원 한도를 컨테이너에 주입
- **Init Container**: 메인보다 먼저 순서대로 실행되고 끝나는 컨테이너
- **Native Sidecar**: `restartPolicy: Always`인 init 컨테이너. 먼저 뜨고 나중에 내려간다
- **Sidecar / Adapter / Ambassador**: 멀티 컨테이너 디자인 패턴
- **HPA**: 메트릭에 따라 파드 수를 조절하는 컨트롤러. metrics-server가 필요
{{< /callout >}}
