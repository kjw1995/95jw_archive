---
title: "14. 트러블슈팅"
date: 2026-04-23
weight: 14
---

[02. 핵심 개념](../02-core-concepts) 4절에서 파드 하나가 뜨기까지 누구도 누구에게 명령하지 않고, 저마다 자기 차례를 지켜보다 일하고 결과를 적는다고 했다. [09. 관측성](../09-observability) 9절은 그 기록인 이벤트를 보는 법과 상태별 첫 확인을 적고 자세한 것을 이 장으로 미뤘다. [03. 클러스터 구성](../03-cluster-setup)과 [07. 네트워킹](../07-networking)과 [06. 스토리지](../06-storage)도 각자의 진단 순서를 이 장으로 넘겼다. 이 장은 그것들을 한 순서로 묶는다. 원리는 셋이다. 첫째, **증상이 아니라 멈춘 단계를 찾는다.** 파드는 선언에서 트래픽을 받기까지 정해진 단계를 차례로 지나고, 어느 단계에서 멈췄는지가 원인이 있을 범위를 정한다. 둘째, **단계마다 기록을 남기는 주인이 있다.** 이벤트는 스케줄러와 kubelet과 컨트롤러가 무엇을 하려다 막혔는지를 말하고, 로그는 프로그램이 왜 죽었는지를 말한다. 그래서 describe가 먼저고 logs가 다음이다. 셋째, **범위를 넓혀 가며 본다. 파드 하나, 노드 하나, 클러스터 전체.** 범위가 넓을수록 아래 계층이 원인이다. 그리고 API 서버가 죽어 kubectl이 안 되면 노드로 내려가 kubelet의 로그와 crictl을 본다.

---

## 1. 트러블슈팅 접근법

```text
증상: 무엇이 안 되는가
        │
        ▼
범위: 어디까지 안 되는가
  파드 하나      → 그 앱 (4~6절)
  서비스 하나    → 연결 (7, 10절)
  노드 하나의 것 → 노드 (9절)
  전부           → 컨트롤 플레인 (8절)
        │
        ▼
단계: 어디서 멈췄는가
  이벤트 → 로그 → 안에 들어가기
        │
        ▼
원인 → 고치고 → 다시 확인
```

| 단계 | 주인 | 여기서 멈추면 보이는 것 | 볼 곳 | 왜 |
|:-----|:----|:-----------------|:-----|:---|
| 오브젝트 만들기 | API 서버, 어드미션, 컨트롤러 | 파드 자체가 없다. ReplicaSet에 `FailedCreate` | Deployment와 ReplicaSet의 이벤트 | 쿼터, Pod Security, 웹훅이 거절하면 파드가 만들어지지도 않는다 |
| 스케줄 | 스케줄러 | `Pending`, `FailedScheduling` | 4절 | 들어갈 노드가 없다 |
| 이미지 받기 | kubelet, 런타임 | `ErrImagePull`, `ImagePullBackOff` | 5절 | 받을 수 없다 |
| 볼륨과 네트워크 붙이기 | kubelet, CSI, CNI | `ContainerCreating`에 오래 머문다 | 10, 11절 | 샌드박스나 볼륨이 준비가 안 됐다 |
| 컨테이너 시작 | 런타임 | `CreateContainerConfigError`, `RunContainerError` | 6절 | 없는 ConfigMap, 틀린 명령 |
| 실행 | 프로그램 | `CrashLoopBackOff`, `OOMKilled` | 6절 | 떴다가 죽는다 |
| 준비 | kubelet의 프로브 | `Running`인데 `READY 0/1` | 6, 7절 | 프로브가 실패한다 |
| 트래픽 | kube-proxy, DNS, 인그레스 | 파드는 멀쩡한데 접속이 안 된다 | 7, 10절 | 길이 끊겼다 |

첫째 원리다. 위 표가 파드의 일생이고, [02](../02-core-concepts)장 4절의 순서를 증상 쪽에서 다시 적은 것이다. 파드가 안 뜬다는 말은 이 여덟 단계 중 하나에서 멈췄다는 말이고, `kubectl get pods`의 STATUS 열이 그 단계를 거의 그대로 말해 준다. 단계를 알면 볼 기록이 정해진다.

### 1.1 기본 진단 명령어

```bash
# 클러스터 전반
kubectl get nodes -o wide
kubectl get pods -A -o wide
kubectl get --raw='/readyz?verbose'

# 최근 이벤트
kubectl events -A --types Warning
kubectl get events -A \
  --sort-by=.lastTimestamp | tail -20

# 멀쩡하지 않은 파드만
kubectl get pods -A \
  --field-selector=status.phase!=Running

# 하나를 자세히
kubectl describe pod web-7d4f
kubectl logs web-7d4f --previous
```

| 명령 | 보여 주는 것 | 왜 |
|:-----|:---------|:---|
| `get pods -o wide` | STATUS, READY, RESTARTS, 노드, IP | 멈춘 단계와 범위(한 노드에 몰려 있나)를 한 번에 |
| `describe` | 스펙, 조건, 컨테이너의 상태와 마지막 종료, 끝에 이벤트 | 둘째 원리. 쿠버네티스가 하려다 막힌 일은 여기 있다 |
| `events` | 시각순 이벤트. `--for`로 오브젝트 하나 | 기본 한 시간만 남는다([09](../09-observability)장 9절). 늦으면 없다 |
| `logs`, `logs --previous` | 프로그램의 출력. 죽기 전 것 | 프로그램이 스스로 말한 이유 |
| `get --raw /readyz?verbose` | API 서버의 검사 항목마다 통과 여부 | etcd에 닿는지, 시작 훅이 끝났는지 |

{{< callout type="info" >}}
**describe가 먼저다.** 로그는 컨테이너가 한 번이라도 떠야 생긴다. 스케줄이 안 됐거나 이미지를 못 받았거나 볼륨을 못 붙였으면 로그는 비어 있고, 이유는 이벤트에만 있다. 이벤트는 "누가, 무엇을 하려다, 왜 못 했는지"를 한 줄로 적는다. `Reason` 열이 단계를, `From` 열이 주인을, `Message`가 원인을 말한다.
{{< /callout >}}

---

## 2. Pod Phase와 상태

| Phase | 뜻 | 흔한 원인 | 왜 |
|:------|:--|:-------|:---|
| Pending | 클러스터가 받아들였지만 컨테이너가 아직 다 준비되지 않았다 | 스케줄 대기, 이미지 받는 중, 볼륨 붙이는 중 | 스케줄 전과 후를 다 포함한다. 노드가 정해졌는지는 `-o wide`의 NODE 열로 가른다 |
| Running | 노드에 묶였고 컨테이너가 다 만들어졌으며 적어도 하나가 돌거나 시작·재시작 중 | | 재시작을 되풀이해도 Running이다. 멀쩡하다는 뜻이 아니다 |
| Succeeded | 모든 컨테이너가 0으로 끝났고 다시 안 뜬다 | Job | |
| Failed | 모든 컨테이너가 끝났고 적어도 하나가 실패로 끝났다 | 0이 아닌 종료 코드, 시스템이 죽임, 축출 | `restartPolicy`가 다시 띄우지 않을 때만 |
| Unknown | 상태를 알 수 없다 | 노드와 통신 두절 | [10](../10-cluster-maintenance)장 1절 |

`kubectl get pods`의 STATUS 열은 Phase가 아니다. Phase와 컨테이너의 상태와 삭제 여부를 합쳐 kubectl이 만든 한 단어다. `CrashLoopBackOff`도 `Terminating`도 `Init:0/2`도 Phase에는 없는 말이다.

| STATUS | 실제 상태 | 멈춘 단계 | 왜 |
|:-------|:-------|:-------|:---|
| `Pending` | 노드가 안 정해졌다 | 스케줄 | 4절 |
| `ContainerCreating`, `PodInitializing` | Waiting. 노드는 정해졌다 | 이미지, 볼륨, 샌드박스 | 오래 머물면 이벤트를 본다 |
| `Init:1/3`, `Init:Error` | 초기화 컨테이너가 도는 중이거나 실패 | 시작 | `logs -c <초기화 컨테이너>` |
| `ErrImagePull`, `ImagePullBackOff` | Waiting | 이미지 | 5절 |
| `CreateContainerConfigError` | Waiting. 참조한 ConfigMap, Secret, 키가 없다 | 시작 | 이름 오타이거나 아직 안 만들었다 |
| `CrashLoopBackOff` | Waiting. 죽고 다시 띄우기를 기다리는 중 | 실행 | 6절 |
| `OOMKilled`, `Error`, `Completed` | Terminated | 실행 | 종료 코드와 함께 본다 |
| `Terminating` | 삭제 요청을 받았다 | | 파이널라이저나 노드 두절로 오래 남을 수 있다 |
| `Evicted` | Failed. kubelet이 쫓아냈다 | | [09](../09-observability)장 2.3절 |

| 종료 코드 | 뜻 | 왜 |
|:-------|:--|:---|
| 0 | 정상 종료 | 오래 돌아야 할 서버가 0으로 끝나면 그것도 문제다 |
| 1 | 프로그램이 오류로 끝났다 | 로그에 이유가 있다 |
| 126, 127 | 실행 권한 없음, 명령 없음 | `command`의 오타, 이미지에 없는 바이너리 |
| 137 | 128 + 9. SIGKILL | OOM이거나 종료 유예를 넘겨 강제로 죽었다. `Reason`이 `OOMKilled`인지 본다 |
| 139 | 128 + 11. 세그먼테이션 폴트 | 프로그램이나 라이브러리의 결함, 아키텍처가 다른 이미지 |
| 143 | 128 + 15. SIGTERM | 정상적인 종료 요청을 받았다. 롤아웃, 축출, 노드 비우기 |

| 파드 조건 | True가 되는 때 | False면 | 왜 |
|:--------|:-----------|:------|:---|
| `PodScheduled` | 노드가 정해졌다 | 4절 | |
| `PodReadyToStartContainers` | 샌드박스와 네트워크가 준비됐다 | 10절 | CNI가 IP를 줬는가 |
| `Initialized` | 초기화 컨테이너가 다 끝났다 | 초기화 컨테이너의 로그 | |
| `ContainersReady` | 모든 컨테이너가 준비됐다 | 프로브 | |
| `Ready` | 파드가 트래픽을 받을 수 있다 | 7절. EndpointSlice에서 빠진다 | |

---

## 3. 디버깅 의사결정 트리

```text
kubectl get pods
 │
 ├ 파드가 없다 → RS·Deployment 이벤트
 ├ Pending            → 4절
 ├ ImagePullBackOff   → 5절
 ├ ContainerCreating  → 10, 11절
 ├ CrashLoopBackOff   → 6절
 ├ Running, 0/1       → 6절 (프로브)
 ├ Running, 1/1
 │   접속 불가        → 7, 10절
 │   느리다           → 09장 (top, 조임)
 ├ Terminating        → 파이널라이저
 └ 여러 파드가 한 노드에서만
                      → 9절
```

| 물음 | 예 | 아니오 | 왜 이 순서인가 |
|:-----|:--|:-----|:-----------|
| 파드가 있는가 | 다음 | 컨트롤러의 이벤트 | 없는 파드는 describe할 수 없다 |
| 노드가 정해졌는가 | 다음 | 4절 | 스케줄 전에는 kubelet이 관여하지 않는다 |
| 컨테이너가 한 번이라도 떴는가 | 다음 | 5, 10, 11절 | 안 떴으면 로그가 없다 |
| 계속 떠 있는가 | 다음 | 6절 | |
| 준비됐는가 | 다음 | 프로브 | |
| 트래픽이 닿는가 | 앱의 문제 | 7, 10절 | 여기까지 오면 쿠버네티스는 제 일을 다 했다 |

---

## 4. Pending 트러블슈팅

```bash
kubectl describe pod web-7d4f
# Events:
#  Warning FailedScheduling
#  0/3 nodes are available:
#  2 Insufficient cpu,
#  1 node(s) had untolerated taint
#  {node-role.kubernetes.io/
#   control-plane: }.
#  preemption: 0/3 nodes are available:
#  3 No preemption victims found

kubectl describe node node-1 \
  | grep -A8 "Allocated resources"
```

| 메시지 | 원인 | 조치 | 왜 |
|:-----|:----|:----|:---|
| `Insufficient cpu`, `Insufficient memory` | requests를 받아 줄 노드가 없다 | requests를 실제에 맞게, 노드 추가, 노드 오토스케일러 확인 | 스케줄러는 실제 사용량이 아니라 requests의 합을 본다([09](../09-observability)장 2.1절). 노드가 한가해도 난다 |
| `didn't match Pod's node affinity/selector` | 조건에 맞는 레이블의 노드가 없다 | `kubectl get nodes --show-labels` | [05](../05-scheduling)장 4, 5절 |
| `had untolerated taint` | 노드의 taint를 파드가 못 견딘다 | toleration을 더하거나 taint를 뺀다 | [05](../05-scheduling)장 3절. 컨트롤 플레인 노드가 셈에 들어 있는 것은 정상이다 |
| `didn't match pod anti-affinity rules` | 같은 노드에 두지 말라는 파드가 이미 있다 | 노드 수보다 레플리카가 많은지 | |
| `pod has unbound immediate PersistentVolumeClaims` | PVC가 아직 PV를 못 얻었다 | 11절 | |
| `volume node affinity conflict` | 볼륨이 있는 영역의 노드로 갈 수 없다 | [06](../06-storage)장 3.4절. `WaitForFirstConsumer` | |
| `didn't have free ports` | `hostPort`를 다른 파드가 쓰고 있다 | `hostPort`를 빼고 Service를 쓴다 | 노드마다 한 파드만 그 포트를 쓴다 |
| `preemption: ... No preemption victims found` | 우선순위가 낮은 파드를 밀어내도 자리가 안 난다 | | 앞의 이유에 덧붙는 줄이다. 원인이 아니다 |

메시지는 "노드 몇 대 중 몇 대가 왜 안 되는지"의 셈이다. `0/3` 뒤에 이유별 대수가 나오고 합이 3이다. 이유가 여럿이면 노드마다 다른 이유로 탈락한 것이므로, 풀기 쉬운 하나를 풀면 된다. 파드가 아예 없고 Deployment의 READY만 모자라면 스케줄 문제가 아니다. ReplicaSet의 이벤트에 `exceeded quota`나 `violates PodSecurity`가 있는지 본다.

---

## 5. ImagePullBackOff

```bash
kubectl describe pod web-7d4f
kubectl get pod web-7d4f -o \
  jsonpath='{.spec.containers[*].image}'

# 노드에서 직접 받아 본다
crictl pull reg.example.com/app:1.2.3
```

| 이벤트의 메시지 | 원인 | 조치 | 왜 |
|:-----------|:----|:----|:---|
| `manifest unknown`, `not found` | 이름이나 태그가 없다 | 이름, 태그, 레지스트리 주소 | [04](../04-workloads)장 5절이 미룬 오타가 이것이다 |
| `unauthorized`, `pull access denied` | 자격 증명이 없거나 틀리다 | `imagePullSecrets`, Secret의 네임스페이스 | [08](../08-security)장 8.2절. Secret은 파드와 같은 네임스페이스에 있어야 한다 |
| `no such host`, `i/o timeout` | 노드가 레지스트리에 못 닿는다 | 노드의 DNS, 방화벽, 프록시 | 이미지를 받는 것은 파드가 아니라 노드다 |
| `x509: certificate signed by unknown authority` | 사설 레지스트리의 인증서를 노드가 못 믿는다 | 런타임에 CA 등록 | |
| `toomanyrequests` | 레지스트리의 받기 한도 | 자격 증명으로 받기, 미러 | |
| `exec format error` (시작 뒤) | 이미지의 아키텍처가 노드와 다르다 | 다중 아키텍처 이미지 | 받기는 되고 실행에서 죽는다 |

| STATUS | 뜻 | 왜 |
|:-------|:--|:---|
| `ErrImagePull` | 방금 받기에 실패했다 | 첫 실패 |
| `ImagePullBackOff` | 실패가 이어져 다음 시도를 미루는 중. 간격은 5분까지 늘어난다 | 고친 뒤에도 다음 시도까지 기다린다. 파드를 지워 다시 만들면 바로 시도한다 |
| `ErrImageNeverPull` | `imagePullPolicy: Never`인데 노드에 이미지가 없다 | |
| `InvalidImageName` | 이름의 형식이 틀렸다 | 대문자, 빈칸 |

```bash
kubectl create secret docker-registry \
  regcred -n prod \
  --docker-server=reg.example.com \
  --docker-username=me \
  --docker-password=...
```

```yaml
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: reg.example.com/app:1.2.3
```

둘째 원리가 가장 잘 드러나는 자리다. 이미지를 못 받는 이유는 넷 중 하나(이름, 자격 증명, 네트워크, 인증서)이고, 레지스트리가 돌려준 응답이 이벤트에 그대로 적힌다. 추측할 필요가 없다.

---

## 6. CrashLoopBackOff

```bash
kubectl describe pod web-7d4f
# Last State: Terminated
#   Reason:    Error
#   Exit Code: 1
# Restart Count: 5

kubectl logs web-7d4f --previous
kubectl logs web-7d4f -c app --previous

J='{.status.containerStatuses[0]'
J="$J.lastState.terminated.reason}"
kubectl get pod web-7d4f \
  -o jsonpath="$J"
```

| 증거 | 원인 | 조치 | 왜 |
|:-----|:----|:----|:---|
| `Reason: OOMKilled`, 종료 코드 137 | 메모리 limits를 넘었다 | limits를 올리거나 누수를 잡는다 | [09](../09-observability)장 2.2절. 로그에는 아무 말도 없다. 커널이 죽였으니까 |
| `Reason: Error`, 종료 코드 1, 로그에 예외 | 프로그램의 오류 | 로그의 마지막 줄 | 설정 누락, DB에 못 닿음, 마이그레이션 실패 |
| 종료 코드 127, `StartError` | 명령이 없다 | `command`, `args` | [04](../04-workloads)장 6절. 이미지의 ENTRYPOINT를 덮어쓴 것이 틀렸다 |
| 종료 코드 0이 되풀이 | 서버가 아니라 한 번 돌고 끝나는 프로그램 | Job으로 옮기거나 포그라운드로 돌게 | Deployment는 끝난 컨테이너를 다시 띄운다 |
| 이벤트에 `Unhealthy` 뒤 `Killing` | liveness 프로브가 실패해 kubelet이 죽였다 | 프로브의 경로·포트·시간, `startupProbe` | 프로그램은 멀쩡한데 프로브가 틀렸을 수 있다. 시작이 느린 앱은 startupProbe로 시간을 준다 |
| 종료 코드 143 | SIGTERM을 받았다 | 누가 보냈는지 이벤트에서 | 프로브, 축출, 롤아웃 |

| 재시작 | 값 | 왜 |
|:-----|:--|:---|
| 간격 | 10초, 20초, 40초로 두 배씩. 5분이 상한 | 죽는 프로그램을 쉬지 않고 다시 띄우면 노드가 그 일만 한다 |
| 초기화 | 10분 동안 문제없이 돌면 간격이 처음으로 돌아간다 | |
| 조정 | kubelet 설정으로 상한을 낮출 수 있다 | 노드 단위의 설정 |

CrashLoopBackOff는 원인이 아니라 상태다. "죽었고, 다시 띄우기를 기다리는 중"이라는 뜻이고, 왜 죽었는지는 마지막 종료 기록과 죽기 전의 로그에 있다. 지금 도는 컨테이너의 로그는 방금 다시 뜬 것이라 비어 있기 쉽고, `--previous`가 죽은 쪽의 로그다.

{{< callout type="warning" >}}
**진단 순서.** 먼저 `describe`의 `Last State`에서 `Reason`과 종료 코드를 본다. OOMKilled면 로그를 볼 것 없이 메모리다. 다음으로 `logs --previous`로 죽기 전의 마지막 줄을 본다. 그래도 모르면 이벤트에서 프로브 실패를 찾는다. 로그가 아예 없이 죽는 프로그램은 컨테이너에 `terminationMessagePolicy: FallbackToLogsOnError`를 적어 두면 마지막 출력의 끝부분이 `describe`의 `Message`에 남는다. 셸이 없는 이미지면 12절의 `kubectl debug --copy-to`로 명령을 `sleep`으로 바꾼 사본을 띄워 안에서 직접 실행해 본다.
{{< /callout >}}

---

## 7. Service / DNS

### 7.1 Service-Endpoint 확인

```bash
kubectl get svc web
kubectl describe svc web
kubectl get endpointslices \
  -l kubernetes.io/service-name=web
kubectl get pods -l app=web \
  --show-labels -o wide

# 클러스터 안에서 찔러 본다
kubectl run t --rm -it \
  --image=busybox:1.36 \
  --restart=Never -- \
  wget -qO- -T 3 http://web
```

| 순서 | 확인 | 실패하면 | 왜 |
|:-----|:----|:------|:---|
| 1 | Service가 있는가 | 만든다 | |
| 2 | 이름이 풀리는가. `nslookup web` | 7.2절 | DNS가 안 되면 IP로는 되는지로 가른다 |
| 3 | ClusterIP로 되는가 | 아래 | 이름은 되는데 IP가 안 되면 Service 뒤가 문제다 |
| 4 | `port`와 `targetPort`가 맞는가 | 고친다 | `targetPort`는 컨테이너가 실제로 듣는 포트다 |
| 5 | EndpointSlice에 주소가 있는가 | 셀렉터와 파드의 레이블, 파드의 Ready | 비어 있으면 뒤에 아무도 없다. 가장 흔한 원인 |
| 6 | 파드 IP로 직접은 되는가 | 앱이 그 포트를 안 듣는다. `0.0.0.0`이 아니라 `127.0.0.1`에 묶였다 | |
| 7 | kube-proxy가 도는가 | 그 노드의 kube-proxy 파드와 로그 | 규칙은 노드마다 따로 있다. 한 노드에서만 안 되면 이것이다 |
| 8 | NetworkPolicy가 막는가 | [08](../08-security)장 6절 | 파드끼리는 되는데 특정 출발지만 안 되면 |

[07](../07-networking)장 12절이 이 절로 넘긴 순서다. 위에서 아래로 가며 처음 실패하는 줄이 원인의 자리다. 이름은 Endpoints가 아니라 EndpointSlice로 본다. Endpoints API는 1.33에서 deprecated다. 파드가 자기 자신의 Service IP로 접속할 때만 안 되면 헤어핀 설정이고, 밖에서 특정 노드로만 안 되면 `externalTrafficPolicy: Local`이다.

### 7.2 DNS 진단

```bash
U=https://k8s.io/examples/admin/dns
kubectl apply -f $U/dnsutils.yaml
kubectl exec -it dnsutils -- \
  nslookup kubernetes.default
kubectl exec -it dnsutils -- \
  cat /etc/resolv.conf

kubectl get pods -n kube-system \
  -l k8s-app=kube-dns
kubectl logs -n kube-system \
  -l k8s-app=kube-dns
kubectl get endpointslices \
  -n kube-system \
  -l kubernetes.io/service-name=kube-dns
```

```text
# 파드의 /etc/resolv.conf
search default.svc.cluster.local
       svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

| 증상 | 원인 | 조치 | 왜 |
|:-----|:----|:----|:---|
| 안쪽 이름이 안 풀린다 | CoreDNS 파드가 없거나 준비가 안 됐다 | 파드 상태, `kube-dns` Service의 EndpointSlice | CoreDNS도 파드다. 4~6절의 순서로 본다 |
| `nameserver`가 `kube-dns`의 IP가 아니다 | 파드의 `dnsPolicy`, kubelet의 `clusterDNS` | [07](../07-networking)장 10.5절 | |
| 바깥 이름만 안 풀린다 | CoreDNS의 업스트림 | Corefile의 `forward`, 노드의 `/etc/resolv.conf` | CoreDNS는 모르는 이름을 노드의 DNS에 묻는다 |
| CoreDNS가 CrashLoopBackOff, 로그에 `Loop` | 노드의 resolv.conf가 `127.0.0.53`을 가리켜 자기에게 되묻는다 | kubelet의 `resolvConf`를 `/run/systemd/resolve/resolv.conf`로 | systemd-resolved를 쓰는 배포판에서 난다 |
| 가끔 느리다 | `ndots:5`로 바깥 이름마다 검색 목록을 먼저 돈다 | 이름 끝에 점, NodeLocal DNSCache | [07](../07-networking)장 10.5절 |
| 가끔 실패한다 | CoreDNS의 부하, conntrack 경쟁 | 레플리카, 캐시 | |

질의가 CoreDNS에 닿는지 모르겠으면 `kube-system`의 `coredns` ConfigMap에서 Corefile에 `log` 한 줄을 더한다. 1~2분 뒤부터 CoreDNS의 로그에 질의가 찍힌다. 끝나면 뺀다.

---

## 8. Control Plane Failure

| 죽은 것 | 안 되는 것 | 되는 것 | 왜 |
|:------|:--------|:------|:---|
| kube-apiserver | kubectl 전부, 새 파드, 변경 | 이미 도는 파드와 그 사이의 통신 | kubelet과 런타임은 API 서버 없이도 컨테이너를 돌린다. Service의 규칙도 노드에 이미 있다 |
| etcd | API 서버가 읽기·쓰기를 못 한다 | 위와 같다 | API 서버의 저장소다. 쿼럼을 잃으면 같다([03](../03-cluster-setup)장 11절) |
| kube-scheduler | 새 파드가 Pending에 머문다 | 나머지 전부 | 노드를 정해 주는 일만 한다 |
| kube-controller-manager | 죽은 파드가 다시 안 만들어진다. 롤아웃, 노드 장애 대응이 멈춘다 | 도는 파드, kubectl 조회 | "바라는 상태로 맞추는" 고리가 멈춘다 |
| 전부 | 위의 합 | 도는 파드 | [10](../10-cluster-maintenance)장 8절. 컨트롤 플레인은 조율을 하고 실행은 노드가 한다 |

셋째 원리다. 컨트롤 플레인이 죽어도 서비스는 당장 죽지 않는다. 대신 변화에 반응하지 못한다. 그 상태에서 파드나 노드가 하나 더 죽으면 그것은 다시 살아나지 않는다. 복구의 순서는 etcd, API 서버, 그다음 컨트롤러 매니저와 스케줄러다. 뒤의 것은 앞의 것이 있어야 뜬다.

```bash
# API 서버가 살아 있을 때
kubectl get pods -n kube-system
kubectl get --raw='/readyz?verbose'
kubectl logs -n kube-system \
  kube-apiserver-cp1

# API 서버가 죽었을 때: 노드에서
ls /etc/kubernetes/manifests/
journalctl -u kubelet --since -10m
crictl ps -a | grep kube-apiserver
crictl logs <컨테이너 ID>
```

| 증상 | 원인 | 조치 | 왜 |
|:-----|:----|:----|:---|
| `connection refused` | API 서버 컨테이너가 없다 | `crictl ps -a`로 죽은 컨테이너를 찾아 `crictl logs` | [03](../03-cluster-setup)장 14.2절. kubectl이 안 되면 kubelet과 crictl만 남는다 |
| 컨테이너가 아예 안 만들어진다 | 매니페스트의 YAML 오류, 없는 경로 | `journalctl -u kubelet`에 파싱 오류 | 정적 파드는 kubelet이 파일을 읽어 띄운다([05](../05-scheduling)장 9절) |
| 떴다 죽기를 되풀이 | 틀린 플래그, 없는 인증서, etcd에 못 닿음 | `crictl logs`의 마지막 줄 | |
| `x509: certificate has expired` | 인증서 만료 | `kubeadm certs check-expiration`, `renew` | [03](../03-cluster-setup)장 14.3절. 1년 |
| `/readyz`에 `[-]etcd failed` | etcd에 못 닿는다 | 8.1절 | |
| 느리고 타임아웃 | etcd의 디스크 지연, API 서버의 과부하 | etcd의 메트릭, 요청이 많은 클라이언트 | |

`/healthz`는 1.16에서 deprecated이고 `/livez`와 `/readyz`를 쓴다. `?verbose`를 붙이면 검사 항목마다 `[+]`와 `[-]`로 나오고, `/readyz/etcd`처럼 항목 하나만 물을 수도 있다.

### 8.1 etcd 헬스체크

```bash
P=/etc/kubernetes/pki/etcd
E="--endpoints=https://127.0.0.1:2379"
C="--cacert=$P/ca.crt"
C="$C --cert=$P/server.crt"
C="$C --key=$P/server.key"

etcdctl $E $C endpoint health
etcdctl $E $C endpoint status -w table
etcdctl $E $C member list -w table
etcdctl $E $C alarm list
```

| 출력 | 뜻 | 조치 | 왜 |
|:-----|:--|:----|:---|
| `is healthy` | 그 멤버가 쿼럼 안에서 응답한다 | | |
| `context deadline exceeded` | 응답이 없다 | etcd 컨테이너와 로그, 2379·2380 포트 | |
| 리더가 없다, term이 자꾸 오른다 | 쿼럼 손실이나 잦은 선거 | 과반수의 멤버를 살린다. 디스크와 네트워크 지연 | [03](../03-cluster-setup)장 11절 |
| `alarm:NOSPACE` | DB가 용량 한도에 닿았다. 읽기와 삭제만 된다 | 압축, 조각 모음(`defrag`), `alarm disarm` | 한도의 기본은 2GiB다. 지운 데이터의 자리는 조각 모음을 해야 파일 시스템으로 돌아온다 |
| DB SIZE가 계속 큰다 | 이벤트나 큰 오브젝트가 쌓인다 | 무엇이 쌓이는지, 조각 모음 | |

etcd를 되살릴 수 없으면 [10](../10-cluster-maintenance)장 11절의 스냅샷 복원이 마지막 길이다.

---

## 9. Worker Node Failure

```bash
kubectl get nodes
kubectl describe node node-2
kubectl get pods -A -o wide \
  --field-selector spec.nodeName=node-2
```

| 조건 | True면 | 조치 | 왜 |
|:-----|:-----|:----|:---|
| `Ready` | 정상. kubelet이 건강하고 파드를 받을 수 있다 | | False는 kubelet이 문제를 보고한 것, Unknown은 보고가 끊긴 것이다 |
| `MemoryPressure` | 노드의 메모리가 모자란다 | 축출이 시작됐다. requests를 맞추고 분산 | [09](../09-observability)장 2.3절 |
| `DiskPressure` | 디스크가 모자란다 | 안 쓰는 이미지, 로그, emptyDir | kubelet이 이미지를 지우기 시작하고 그래도 모자라면 파드를 쫓는다 |
| `PIDPressure` | 프로세스가 너무 많다 | 프로세스를 쏟아 내는 파드 | |
| `NetworkUnavailable` | 노드의 네트워크가 설정되지 않았다 | CNI 파드와 설정 | 10절 |

| `Ready`의 값 | 메시지 | 원인 | 왜 |
|:----------|:-----|:----|:---|
| False | `container runtime network not ready` | CNI가 없다 | [03](../03-cluster-setup)장 7절 |
| False | `PLEG is not healthy` | 런타임이 느리거나 멈췄다 | 컨테이너가 너무 많거나 디스크가 느리다 |
| Unknown | `Kubelet stopped posting node status` | kubelet이 죽었거나 노드가 죽었거나 네트워크가 끊겼다 | [10](../10-cluster-maintenance)장 1절. 50초 뒤 이렇게 되고 300초 뒤 파드가 옮겨진다 |

노드 하나의 파드만 이상하면 파드가 아니라 노드를 의심한다. 같은 Deployment의 파드가 다른 노드에서는 멀쩡한데 한 노드에서만 죽으면, 원인은 그 노드의 디스크, 네트워크, 런타임, 커널 중에 있다.

### 9.1 kubelet / 런타임 점검

```bash
# 노드에서
systemctl status kubelet
journalctl -u kubelet --since -10m
systemctl status containerd
crictl ps -a
crictl pods
df -h /var/lib/kubelet \
  /var/lib/containerd
free -m

# 노드에 못 들어가면
kubectl debug node/node-2 -it \
  --image=busybox:1.36
```

| kubelet 로그 | 원인 | 조치 | 왜 |
|:----------|:----|:----|:---|
| `running with swap on is not supported` | 스왑이 켜져 있다 | `swapoff -a`, fstab | [03](../03-cluster-setup)장 14.1절 |
| `failed to run Kubelet: ... cgroup driver` | kubelet과 런타임의 cgroup 드라이버가 다르다 | 둘 다 systemd로 | [03](../03-cluster-setup)장 4.2절 |
| `x509: certificate has expired` | kubelet의 클라이언트 인증서 만료 | 인증서 자동 갱신 설정, 다시 조인 | |
| `no space left on device` | 디스크가 찼다 | 이미지와 로그 정리 | |
| `Unable to register node` | API 서버에 못 닿거나 권한이 없다 | 6443 포트, kubeconfig | |
| `failed to create sandbox ... cni` | CNI가 파드에 네트워크를 못 붙인다 | 10절 | |

crictl은 `/etc/crictl.yaml`의 `runtime-endpoint`로 런타임을 찾는다. containerd면 `unix:///var/run/containerd/containerd.sock`이다. kubelet이 멈춰 있어도 런타임이 살아 있으면 컨테이너는 돌고 있고, `crictl ps`로 보인다.

---

## 10. 네트워크 트러블슈팅

```text
좁은 데서 넓은 데로
1. 파드 안        localhost
2. 같은 노드 파드  브리지
3. 다른 노드 파드  CNI (노드 사이 길)
4. Service IP     kube-proxy
5. 이름           CoreDNS
6. 밖에서         LB, 인그레스
```

```bash
kubectl get pods -o wide

# 파드 IP로 직접
kubectl exec -it t1 -- \
  ping -c 3 10.244.2.7
kubectl exec -it t1 -- \
  wget -qO- -T 3 10.244.2.7:8080

# CNI와 kube-proxy
ls /etc/cni/net.d/ /opt/cni/bin/
kubectl get pods -n kube-system \
  -o wide | grep -E \
  'calico|flannel|cilium|proxy'

# 정책
kubectl get networkpolicy -A
```

| 어디까지 되나 | 원인의 자리 | 확인 | 왜 |
|:----------|:--------|:----|:---|
| 같은 노드의 파드끼리도 안 된다 | 그 노드의 CNI, NetworkPolicy | CNI 파드, `/etc/cni/net.d` | |
| 같은 노드는 되고 다른 노드는 안 된다 | 노드 사이의 길 | 오버레이의 UDP 포트(VXLAN 8472)가 방화벽에 막혔는지, 파드 대역 겹침 | [07](../07-networking)장 2.4절 |
| 작은 요청은 되고 큰 응답에서 멈춘다 | MTU | 오버레이의 헤더만큼 MTU가 작아야 한다 | 캡슐화하면 패킷이 커진다 |
| 파드 IP는 되고 Service IP는 안 된다 | kube-proxy, EndpointSlice | 7.1절 | |
| IP는 되고 이름은 안 된다 | DNS | 7.2절 | |
| 안에서는 되고 밖에서는 안 된다 | LoadBalancer, 인그레스, 게이트웨이 | [07](../07-networking)장 12.5절 | |
| 특정 파드에서만 안 된다 | NetworkPolicy | [08](../08-security)장 6절. 출발지의 egress와 목적지의 ingress 둘 다 | 정책이 하나라도 붙으면 허용 목록이 된다. 전면 차단을 걸면 DNS도 막힌다 |

[07](../07-networking)장 12절이 이 절로 넘긴 순서의 나머지다. 원칙은 한 번에 한 계층씩이다. 파드 IP로 직접 되는지를 먼저 보면 Service와 DNS를 한꺼번에 용의선상에서 뺄 수 있다. 셸이 없는 이미지에서는 12절의 `kubectl debug`에 `--profile=netadmin`을 붙여 네트워크 도구가 든 이미지를 같은 네트워크 네임스페이스에 넣는다.

---

## 11. 스토리지 트러블슈팅

```bash
kubectl get pvc,pv
kubectl describe pvc data-db-0
kubectl get storageclass
kubectl get pods -n kube-system \
  | grep -i csi
kubectl get volumeattachment
```

| 증상 | 메시지 | 원인 | 조치 | 왜 |
|:-----|:-----|:----|:----|:---|
| PVC가 Pending | `waiting for first consumer to be created before binding` | 정상 | 파드를 만든다 | `WaitForFirstConsumer`는 파드가 노드를 정한 뒤에 볼륨을 만든다 |
| PVC가 Pending | `no persistent volumes available`, `storageclass ... not found` | 맞는 PV가 없고 클래스도 없다 | 클래스 이름, 기본 클래스 | [06](../06-storage)장 4.4절 |
| PVC가 Pending | 프로비저너의 오류 | 드라이버가 볼륨을 못 만든다. 권한, 할당량 | CSI 컨트롤러 파드의 로그 | |
| 파드가 Pending | `volume node affinity conflict` | 볼륨이 다른 영역에 있다 | 4절 | |
| ContainerCreating | `FailedAttachVolume`, `Multi-Attach error` | RWO 볼륨이 다른 노드에 아직 붙어 있다 | 옛 파드가 끝났는지, VolumeAttachment | 죽은 노드의 파드가 볼륨을 쥐고 있으면 [10](../10-cluster-maintenance)장 1절의 `out-of-service` taint |
| ContainerCreating | `FailedMount`, `timed out waiting for the condition` | 노드에서 마운트를 못 한다 | 노드의 CSI 파드, 없는 Secret·ConfigMap | 참조한 ConfigMap이 없어도 이 메시지가 난다 |
| 떴는데 쓰기 실패 | `permission denied` | 볼륨의 소유자가 컨테이너의 사용자와 다르다 | `fsGroup` | [06](../06-storage)장 7.4절 |
| 떴는데 쓰기 실패 | `no space left on device` | 볼륨이 찼다 | 볼륨 확장 | [06](../06-storage)장 7.2절 |

[06](../06-storage)장 8절이 이 절로 넘긴 순서다. 스토리지의 문제는 세 오브젝트 중 하나의 이벤트에 있다. PVC(볼륨을 얻었나), 파드(붙이고 마운트했나), 그리고 CSI 드라이버의 파드(왜 못 했나). 앞의 둘은 `describe`로, 셋째는 드라이버 파드의 로그로 본다.

---

## 12. kubectl debug와 Ephemeral Containers

```bash
# 도는 파드에 임시 컨테이너를 넣는다
kubectl debug -it web-7d4f \
  --image=busybox:1.36 --target=app

# 사본을 만들어 명령을 바꾼다
kubectl debug web-7d4f -it \
  --copy-to=web-debug \
  --container=app -- sh

# 사본의 이미지를 바꾼다
kubectl debug web-7d4f \
  --copy-to=web-debug \
  --set-image=app=my-app:debug

# 노드에 들어간다
kubectl debug node/node-2 -it \
  --image=busybox:1.36
```

| 기법 | 하는 일 | 쓰는 때 | 왜 |
|:-----|:------|:------|:---|
| `exec` | 도는 컨테이너 안에서 명령 | 이미지에 셸과 도구가 있을 때 | |
| `debug --target` | 같은 파드에 임시 컨테이너를 넣는다. 네트워크를 같이 쓰고, `--target`의 프로세스가 보인다 | distroless처럼 셸이 없는 이미지 | 파드를 다시 띄우지 않는다. 지금 그 상태를 본다 |
| `debug --copy-to` | 파드의 사본을 만들며 명령이나 이미지를 바꾼다 | 뜨자마자 죽어 들어갈 틈이 없을 때 | 사본에서는 프로브가 빠진다. `--keep-liveness` 등으로 남길 수 있다 |
| `debug node/` | 노드의 네임스페이스에서 도는 파드를 만든다. 노드의 파일 시스템이 `/host`에 | SSH가 안 되는 노드 | 9.1절 |

| 프로파일 | 주는 권한 | 왜 |
|:-------|:-------|:---|
| `general` (기본) | 디버깅에 무난한 설정 | 파드 디버깅이면 프로세스 추적 권한, 노드면 호스트 네임스페이스 |
| `baseline` | Pod Security의 baseline에 맞는 만큼만 | [08](../08-security)장 7절의 정책이 걸린 네임스페이스에서 |
| `restricted` | restricted에 맞는 만큼만. 루트가 아니다 | 위와 같다. 할 수 있는 일이 적다 |
| `netadmin` | 네트워크 관리 권한 | 패킷 캡처, 라우팅 확인 |
| `sysadmin` | 특권 | 노드의 `/host`로 `chroot`하려면 이것이 필요하다 |

임시 컨테이너(1.25 GA)는 파드에 나중에 더하는 컨테이너다. 포트도 프로브도 자원 보장도 없고, 한번 넣으면 뺄 수 없으며 다시 시작되지도 않는다. 파드가 사라질 때 같이 사라진다. 프로파일로 모자라면 `--custom`에 컨테이너 스펙의 일부를 적은 파일을 준다. 사본 파드와 노드 디버그 파드는 끝난 뒤 남으므로 직접 지운다.

### 12.1 보조 도구

```bash
# 로컬에서 찔러 본다
kubectl port-forward pod/web-7d4f \
  8080:80
kubectl port-forward svc/web 8080:80

# 자원
kubectl top nodes
kubectl top pods -A --sort-by=memory

# 권한과 스키마
kubectl auth can-i list pods \
  --as system:serviceaccount:prod:app
kubectl explain pod.spec.containers
```

| 도구 | 쓰는 때 | 왜 |
|:-----|:------|:---|
| `port-forward` | Service와 인그레스를 건너뛰고 파드에 직접 | 앱이 문제인지 길이 문제인지 가른다 |
| `top` | 느리거나 죽을 때 | limits에 닿았는지([09](../09-observability)장 4절) |
| `auth can-i` | 앱이 API 서버에서 `Forbidden`을 받을 때 | [08](../08-security)장 4.5절. 파드의 ServiceAccount로 물어본다 |
| `explain` | 필드 이름이 맞는지 | 오타 난 필드는 조용히 무시되기도 한다 |
| `stern`, `k9s` | 여러 파드의 로그를 한 번에, 화면으로 | [01](../01-introduction)장 10절 |

---

## 13. 빠른 진단 치트시트

```bash
# 한눈에
kubectl get nodes
kubectl get pods -A -o wide \
  | grep -vE 'Running|Completed'
kubectl events -A --types Warning \
  | tail -20

# 파드
kubectl describe pod <파드>
kubectl logs <파드> --previous
kubectl logs <파드> -c <컨테이너>
kubectl debug -it <파드> \
  --image=busybox:1.36 \
  --target=<컨테이너>

# 서비스
kubectl get endpointslices \
  -l kubernetes.io/service-name=<서비스>

# 노드 (노드에서)
journalctl -u kubelet --since -10m
crictl ps -a

# 컨트롤 플레인
kubectl get --raw='/readyz?verbose'
kubeadm certs check-expiration
```

| 증상 | 첫 명령 | 왜 |
|:-----|:------|:---|
| 파드가 안 뜬다 | `describe pod`의 이벤트 | 어느 단계인지 |
| 떴다 죽는다 | `logs --previous` | 죽은 쪽의 말 |
| 접속이 안 된다 | `get endpointslices` | 뒤에 누가 있는지 |
| 한 노드만 이상하다 | `describe node`의 조건 | 노드가 무엇을 호소하는지 |
| kubectl이 안 된다 | 노드에서 `crictl ps -a` | API 서버 컨테이너가 있는지 |

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 단계 | 만들기, 스케줄, 이미지, 볼륨·네트워크, 시작, 실행, 준비, 트래픽 | 멈춘 자리가 원인의 범위다 |
| STATUS | Phase가 아니라 kubectl이 합쳐 만든 한 단어 | Running이 멀쩡하다는 뜻은 아니다 |
| describe 먼저 | 이벤트가 쿠버네티스 쪽의 이유 | 컨테이너가 안 떴으면 로그가 없다 |
| `logs --previous` | 죽은 컨테이너의 로그 | CrashLoopBackOff는 상태지 원인이 아니다 |
| 종료 코드 | 137은 SIGKILL, 143은 SIGTERM, 127은 명령 없음 | 로그가 없어도 코드는 남는다 |
| Pending | `0/N nodes are available` 뒤의 이유별 셈 | 스케줄러는 requests를 본다 |
| ImagePullBackOff | 이름, 자격 증명, 네트워크, 인증서 | 레지스트리의 응답이 이벤트에 그대로 |
| 재시작 간격 | 10초에서 두 배씩, 5분까지 | 10분 멀쩡하면 초기화 |
| Service | 이름 → IP → 포트 → EndpointSlice → 파드 → kube-proxy | 처음 실패하는 줄이 원인 |
| 컨트롤 플레인 | 죽어도 도는 파드는 돈다. 변화에 반응을 못 한다 | 복구는 etcd, API 서버, 나머지 순 |
| 노드 | `Ready`가 False면 kubelet의 호소, Unknown이면 두절 | 한 노드의 파드만 이상하면 노드다 |
| 네트워크 | 파드 IP, Service IP, 이름, 밖의 순서로 | 한 번에 한 계층 |
| 스토리지 | PVC, 파드, CSI 드라이버의 이벤트와 로그 | |
| `kubectl debug` | 임시 컨테이너, 사본, 노드 | 셸 없는 이미지와 뜨자마자 죽는 파드 |

{{< callout type="info" >}}
**용어 정리**
- **Phase**: 파드의 큰 상태. Pending, Running, Succeeded, Failed, Unknown
- **컨테이너 상태**: Waiting, Running, Terminated. 이유는 `Reason`에
- **파드 조건**: PodScheduled, Initialized, ContainersReady, Ready 등 단계마다의 참·거짓
- **이벤트**: 컴포넌트가 오브젝트에 남긴 기록. 기본 한 시간
- **CrashLoopBackOff**: 죽은 컨테이너를 다시 띄우기 전 기다리는 상태
- **ImagePullBackOff**: 이미지 받기에 실패해 다음 시도를 미루는 상태
- **OOMKilled**: 메모리 limits를 넘어 커널이 죽인 것. 종료 코드 137
- **종료 메시지**: 컨테이너가 `/dev/termination-log`에 남기는 마지막 말
- **EndpointSlice**: Service 뒤의 준비된 파드 주소 목록
- **정적 파드**: kubelet이 `/etc/kubernetes/manifests`의 파일로 띄우는 파드
- **노드 조건**: Ready, MemoryPressure, DiskPressure, PIDPressure, NetworkUnavailable
- **crictl**: 노드에서 런타임에 직접 묻는 도구. kubectl이 안 될 때
- **`/livez`, `/readyz`**: API 서버의 건강 검사 주소
- **임시 컨테이너**: 도는 파드에 나중에 넣는 디버깅용 컨테이너
- **디버그 프로파일**: `kubectl debug`가 디버그 컨테이너에 주는 권한의 묶음
{{< /callout >}}
