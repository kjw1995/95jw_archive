---
title: "10. 클러스터 유지보수"
date: 2026-04-23
weight: 10
---

[03. 클러스터 구성](../03-cluster-setup)에서 kubeadm으로 클러스터를 세우고, 5.3절에서 버전 스큐를 잠깐 보고, 14.4절에서 노드를 지우는 순서를 이 장으로 미뤘다. [02. 핵심 개념](../02-core-concepts) 2.1절은 etcd를 잃으면 클러스터를 잃는다고 했고, [05. 스케줄링](../05-scheduling) 3.5절은 죽은 노드의 파드가 300초 뒤 옮겨지는 이유를 taint로 설명했다. 이 장은 그 조각들을 운영의 세 가지 일, 노드 비우기, 버전 올리기, 백업과 복원으로 잇는다. 원리는 셋이다. 첫째, **노드는 언제든 사라질 수 있고, 클러스터는 그것을 전제로 움직인다.** 죽은 노드의 파드는 5분 뒤 다른 노드에 다시 만들어지고, 비울 노드의 파드는 drain으로 미리 옮긴다. 컨트롤러 없는 파드와 PDB 없는 워크로드가 그 전제를 깬다. 둘째, **업그레이드는 순서다. API 서버가 먼저, 한 번에 한 마이너, kubelet은 노드를 비운 뒤.** 버전 스큐 정책이 그 순서를 강제하고, kubeadm은 그 순서를 명령 세 개로 만든다. 셋째, **클러스터의 상태는 etcd에만 있고, 백업은 etcd 스냅샷, 선언 파일, 볼륨 데이터 세 층이다.** 스냅샷 복원은 시점을 되돌리는 일이라 그 뒤의 변경을 전부 잃는다. 그래서 복원은 마지막 수단이고, 자주 찍고 한 번은 실제로 되돌려 봐야 백업이다.

---

## 1. 노드 유지보수의 기본 동작

```text
kubelet ──Lease 10초마다──▶ API 서버
        (끊김)
        │ 50초 무응답
        ▼
노드 Ready=Unknown (NotReady)
        │ not-ready / unreachable
        │ NoExecute taint
        │ 파드의 toleration 300초
        ▼
파드 퇴거 → 컨트롤러가 다른 노드에
        (초당 0.1 노드씩)
```

| 단계 | 시간 | 누가 | 왜 이만큼인가 |
|:-----|:----|:----|:-----------|
| 심장 박동 | kubelet이 10초마다 `kube-node-lease`의 Lease를 갱신 | kubelet | 노드 상태 전체를 매번 쓰면 API 서버가 무겁다. Lease는 작다 |
| NotReady 판정 | 50초 동안 갱신이 없으면 (`--node-monitor-grace-period`) | kube-controller-manager의 노드 컨트롤러 | 5초마다 검사하며, 잠깐의 지연에 파드를 옮기지 않도록 여러 번 놓친 뒤에 판정한다 |
| taint | `node.kubernetes.io/not-ready` 또는 `unreachable`을 `NoExecute`로 | 노드 컨트롤러 | 퇴거를 taint로 표현하면 파드마다 견딜 시간을 다르게 둘 수 있다 |
| 퇴거 | 파드의 `tolerationSeconds` 300초 뒤 | taint 매니저 | [05](../05-scheduling)장 3.5절의 DefaultTolerationSeconds가 모든 파드에 넣는 값 |
| 다시 만들기 | 즉시 | ReplicaSet, StatefulSet 등 컨트롤러 | 컨트롤러가 없는 파드는 그대로 사라진다 |
| 속도 제한 | 초당 0.1 노드. 한 존의 55%가 NotReady면 초당 0.01 | 노드 컨트롤러 | 노드 수십 대가 한꺼번에 NotReady면 네트워크 쪽 문제일 가능성이 커서, 파드를 쏟아 옮기지 않는다 |

첫째 원리다. 노드가 죽었다는 것을 클러스터는 직접 알 수 없다. 심장 박동이 끊긴 것만 안다. 그래서 판정에 50초, 퇴거까지 300초를 더 기다린다. 옛 문서의 `pod-eviction-timeout` 5분이 지금은 이 toleration 300초다. 판정 뒤에도 노드 위의 kubelet이 실제로 파드를 죽였는지는 알 수 없으므로, 파드 오브젝트는 `Terminating`에 머물고 컨트롤러가 새 파드를 만든다. Deployment의 파드는 이름이 새로 나니 문제가 없지만, StatefulSet의 파드는 같은 이름을 다시 만들어야 해서 옛 파드가 지워질 때까지 기다린다. 노드가 영영 안 돌아오면 `kubectl delete node`로 노드를 지우거나, 노드에 `node.kubernetes.io/out-of-service` taint를 `NoExecute`로 걸어 강제 삭제와 볼륨 분리를 바로 일으킨다. 이것이 비정상 종료 처리(non-graceful node shutdown)다. 반대로 노드를 계획해서 끄는 경우에는 kubelet의 `shutdownGracePeriod: 30s`, `shutdownGracePeriodCriticalPods: 10s` 같은 설정으로 systemd가 끄기 전에 파드를 먼저 정상 종료시킨다.

| 노드에 있던 것 | 노드가 죽으면 | 왜 |
|:-----------|:----------|:---|
| Deployment의 파드 | 300초 뒤 다른 노드에 새 이름으로 | ReplicaSet이 개수를 맞춘다 |
| StatefulSet의 파드 | 옛 파드가 `Terminating`에 머무는 동안 새 파드가 못 뜬다 | 같은 이름과 같은 PVC를 써야 해서 둘이 동시에 있을 수 없다 |
| DaemonSet의 파드 | 그 노드 몫은 사라진다 | 노드마다 하나가 정의라 옮길 곳이 없다 |
| 컨트롤러 없는 파드 | 사라지고 끝 | 다시 만들 주체가 없다 |
| 노드 로컬 볼륨(emptyDir, hostPath, local) | 데이터가 노드에 남는다 | [06](../06-storage)장 2절. 파드는 옮겨도 데이터는 못 옮긴다 |

{{< callout type="warning" >}}
**컨트롤러 없는 파드(bare pod)는 노드와 함께 사라진다.** `kubectl run`으로 띄운 파드가 그렇다. 운영 워크로드는 Deployment, StatefulSet, DaemonSet, Job으로 감싼다. 그리고 옮겨지는 것은 파드 정의이지 데이터가 아니다. 노드에 붙은 볼륨에 쓴 것은 노드에 남고, 옮겨 가야 할 데이터는 [06](../06-storage)장의 PV 위에 있어야 한다.
{{< /callout >}}

---

## 2. Drain과 Cordon

### Cordon - 스케줄링만 차단

```bash
kubectl cordon node-2
kubectl get node node-2
# STATUS  Ready,SchedulingDisabled
kubectl uncordon node-2
```

cordon은 노드 객체에 `spec.unschedulable: true`를 적고, 노드 컨트롤러가 `node.kubernetes.io/unschedulable:NoSchedule` taint를 건다. 새 파드만 못 오고 도는 파드는 그대로다.

### Drain - 안전한 워크로드 이전

```bash
kubectl drain node-2 \
  --ignore-daemonsets \
  --delete-emptydir-data
```

```text
drain 전              drain 후
node-2                node-2 (cordon)
  web-1   ── 퇴거 ──▶   (비어 있음)
  api-3   ── 퇴거 ──▶
  fluent-bit (DaemonSet은 남는다)
node-3                node-3
  web-2                 web-2  web-1'
                        api-3'
```

drain은 cordon을 한 뒤 노드의 파드를 **퇴거(eviction) API**로 하나씩 내보낸다. 퇴거 API는 삭제와 달리 PodDisruptionBudget을 지키므로, 예산이 허락하지 않으면 그 파드는 `429 Too Many Requests`로 거절되고 drain은 기다렸다 다시 시도한다. 내보낸 파드는 컨트롤러가 다른 노드에 다시 만든다. 파드가 스스로 돌아오지는 않으므로, uncordon 뒤에도 이전된 파드는 새 노드에 남아 있다.

| 옵션 | 뜻 | 왜 필요한가 |
|:-----|:--|:---------|
| `--ignore-daemonsets` | DaemonSet 파드는 두고 진행 | DaemonSet 컨트롤러는 cordon을 무시하고 바로 다시 만드니 내보내 봐야 소용없다. 이 옵션이 없으면 drain이 멈춘다 |
| `--delete-emptydir-data` | emptyDir을 쓰는 파드도 내보낸다 | emptyDir의 내용은 파드와 함께 사라지므로 확인을 받는다 |
| `--force` | 컨트롤러 없는 파드도 지운다 | 다시 만들어질 수 없는 파드라 기본으로는 거부한다 |
| `--grace-period` | 파드마다 종료 유예(초). 기본 -1은 파드의 값 | 앱이 연결을 정리할 시간 |
| `--timeout` | 전체 제한 시간. 0이면 무한 | PDB에 막혀 영원히 기다리지 않게 |
| `--disable-eviction` | 퇴거 대신 삭제. PDB를 무시 | 비상용. 예산을 깨고 내보낸다 |
| `--pod-selector` | 레이블로 일부만 | 특정 워크로드만 옮길 때 |

### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2       # 또는
  # maxUnavailable: 25%
  selector:
    matchLabels:
      app: web
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `minAvailable` | 퇴거 뒤에도 남아 있어야 할 파드 수 또는 비율(올림) | 최소 서비스 능력 |
| `maxUnavailable` | 동시에 빠져도 되는 수 또는 비율(올림) | 롤링 업그레이드 속도 |
| `unhealthyPodEvictionPolicy` | `IfHealthyBudget`(기본)이면 건강하지 않은 파드는 예산이 지켜질 때만, `AlwaysAllow`면 늘 퇴거 | 이미 죽어 있는 파드가 drain을 막는 일을 없앤다 |

PDB는 drain과 퇴거 API 같은 **자발적 중단**에만 작동한다. 노드 장애나 OOM 같은 비자발적 중단은 못 막는다. 예산을 잘못 잡으면 반대로 클러스터 작업이 막힌다. 파드가 하나뿐인 Deployment에 `maxUnavailable: 0`을 두면 그 노드는 영원히 drain이 안 된다. 노드를 비울 수 있으려면 워크로드마다 파드가 둘 이상이고, 예산이 하나는 빠질 수 있게 열려 있어야 한다. [03](../03-cluster-setup)장 13.2절의 "워커 3대 이상"이 이 계산에서 나온다.

| 명령 | 도는 파드 | 새 파드 | 쓰는 때 | 왜 |
|:-----|:-------|:------|:------|:---|
| `cordon` | 그대로 | 막음 | 노드를 관찰하거나 문제를 격리할 때 | 파드를 흔들지 않고 새 것만 막는다 |
| `drain` | 내보냄 | 막음 | OS 패치, 재부팅, kubelet 마이너 업그레이드, 노드 제거 | 노드에서 손을 떼기 전에 파드를 안전하게 옮긴다 |
| `uncordon` | 그대로 | 허용 | 작업이 끝난 뒤 | 옮겨 간 파드는 돌아오지 않는다. 필요하면 롤아웃으로 재분배한다 |

노드를 아예 빼는 순서는 [03](../03-cluster-setup)장 14.4절에서 미룬 그것이다. `drain`으로 파드를 옮기고, `kubectl delete node`로 등록을 지우고, 그 기계에서 `kubeadm reset`을 한다. 순서를 바꿔 노드부터 지우면 파드가 갑자기 사라지고, reset부터 하면 API 서버는 노드가 살아 있는 줄 알고 50초를 더 기다린다.

---

## 3. Kubernetes 버전 체계

```text
v1.37.2
 │  │  │
 │  │  └── 패치: 버그·보안, 매달
 │  └───── 마이너: 기능·API, 1년에 셋
 └──────── 메이저: 1에서 안 바뀐다
```

| 유형 | 주기 | 담는 것 | 왜 |
|:-----|:----|:------|:---|
| 마이너 | 약 4개월(15주), 1년에 세 번 | 새 기능, API 승격·제거, 기본값 변경 | 릴리스마다 알파·베타·GA 단계가 움직인다 |
| 패치 | 매달, 새 마이너 직후는 1~2주 | 버그와 보안 수정만 | 같은 마이너 안에서는 동작이 안 바뀌어 바로 올려도 된다 |
| 지원 기간 | 마이너마다 약 14개월. 12개월 정식 + 2개월 유지보수 | 그동안만 패치가 나온다 | 1.37이 나온 지금 1.37·1.36·1.35가 정식 지원, 1.34는 2026년 10월 27일까지 유지보수 |

| 단계 | 기본 켜짐 | 뜻 | 왜 |
|:-----|:-------|:--|:---|
| 알파 | 아니오 | 실험. 다음 릴리스에 사라질 수 있다 | feature gate를 직접 켜야 한다 |
| 베타 | 기능 gate는 예, **새 베타 API는 1.24부터 아니오** | 잘 검증됐지만 세부가 바뀔 수 있다 | API 그룹 버전(`v1beta1`)을 켜지 않으면 안 보인다 |
| GA (stable) | 예 | 바뀌지 않는다 | 나중에 gate가 잠기고 제거된다 |

1년에 세 번 마이너가 나오고 지원이 14개월이니, 클러스터를 지원 안에 두려면 **1년에 최소 두 번**은 마이너를 올려야 한다. 이것이 유지보수가 일회성 작업이 아니라 주기인 이유다. [03](../03-cluster-setup)장 1.3절에서 관리형 서비스의 값에 이 주기가 들어 있다고 한 것이 이것이다.

---

## 4. 버전 스큐 정책 (Version Skew)

```text
        kube-apiserver 1.37
        (HA면 1.37, 1.36 섞여도 됨)
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
controller   scheduler   cloud-ctrl
  1.37, 1.36   (같다)      (같다)
   │
   ├─ kubelet     1.37 ~ 1.34
   ├─ kube-proxy  1.37 ~ 1.34
   └─ kubectl     1.38 ~ 1.36
```

| 컴포넌트 | API 서버 1.37 기준 허용 | 왜 |
|:-------|:------------------|:---|
| kube-apiserver (HA) | 1.37과 1.36 | 롤링 업그레이드 중에 한 마이너가 섞이는 것만 허용 |
| kube-controller-manager, kube-scheduler, cloud-controller-manager | 1.37, 1.36 | API 서버보다 새로우면 안 된다. 없는 API를 부를 수 있다 |
| kubelet | 1.37, 1.36, 1.35, 1.34 | 세 마이너까지 낮아도 된다(1.28부터). 노드는 많고 한꺼번에 못 올린다 |
| kube-proxy | 1.37 ~ 1.34. 같은 노드의 kubelet과는 ±3 | kubelet과 같은 이유 |
| kubectl | 1.38, 1.37, 1.36 | 한 마이너 앞뒤. 넘으면 명령마다 경고가 붙는다([01](../01-introduction)장 10절) |

| 올리는 순서 | 전제 | 왜 |
|:---------|:----|:---|
| 1. kube-apiserver | 다른 컨트롤 플레인 컴포넌트가 현재 버전, kubelet이 X-1 이상, 웹훅이 새 API 버전을 안다 | 모두가 API 서버에 맞추니 API 서버가 먼저 |
| 2. controller-manager, scheduler, cloud-controller-manager | API 서버가 새 버전 | 셋 사이의 순서는 없다 |
| 3. kubelet | API 서버가 새 버전. **마이너를 올릴 때는 노드를 먼저 비운다** | 제자리 마이너 업그레이드는 지원하지 않는다 |
| 4. kube-proxy | API 서버가 새 버전 | 미뤄도 된다. 세 마이너까지 |

둘째 원리다. [03](../03-cluster-setup)장 5.3절에서 "kubelet은 낮아도 되고 높으면 안 된다"고 한 규칙의 전체가 이것이다. 규칙은 하나의 방향을 가리킨다. 위(API 서버)가 먼저 올라가고 아래가 따라온다. 아래가 먼저 올라가면 API 서버가 모르는 필드를 kubelet이 보내는 일이 생긴다. kubelet이 세 마이너를 뒤처져도 되는 것은 노드가 수백 대일 때 한 번에 못 올리기 때문이고, 그 덕에 컨트롤 플레인만 먼저 올리고 워커는 몇 주에 걸쳐 올릴 수 있다.

{{< callout type="warning" >}}
**한 번에 한 마이너씩.** kubeadm은 마이너를 건너뛰는 업그레이드를 지원하지 않는다. `1.35 → 1.37`은 `1.35 → 1.36 → 1.37` 두 번이다. 컨트롤 플레인 사이의 스큐가 한 마이너까지만 허용되고, 제거된 API의 오브젝트를 옮길 기회가 마이너마다 있어서다. 대신 kubelet은 세 마이너까지 뒤처져도 되므로, 컨트롤 플레인을 두 번 올리는 동안 워커를 한 번만 올려도 규칙 안이다.
{{< /callout >}}

---

## 5. 업그레이드 사전 체크리스트

| 항목 | 확인 | 어떻게 | 왜 |
|:-----|:----|:-----|:---|
| 릴리스 노트 | 제거되는 API, 바뀌는 기본값, 필요한 feature gate | CHANGELOG, 폐기 가이드 | 제거된 API의 오브젝트는 업그레이드 뒤 읽히지 않는다 |
| 제거될 API 사용 여부 | 지금 클러스터가 옛 버전 API를 쓰는가 | API 서버 메트릭 `apiserver_requested_deprecated_apis`, `pluto`, `kubent` | 매니페스트를 새 버전으로 고쳐 두면 업그레이드가 아무 일도 아니게 된다 |
| etcd 스냅샷 | 방금 찍은 것이 있는가 | 11절 | 롤백의 유일한 확실한 길 |
| `/etc/kubernetes` 백업 | 매니페스트, 인증서, kubeconfig | `tar` | kubeadm도 `/etc/kubernetes/tmp`에 백업하지만 내 것이 따로 있어야 한다 |
| 패키지 저장소 | 새 마이너의 pkgs.k8s.io 경로로 바꿨는가 | [03](../03-cluster-setup)장 5.1절 | 저장소가 마이너마다 따로라 안 바꾸면 새 버전이 안 보인다 |
| 노드 여유 | 노드 하나를 비워도 파드가 들어가는가 | `kubectl top node`, requests 합 | drain이 Pending을 만들면 서비스가 준다 |
| PDB | 모든 워크로드가 하나는 빠질 수 있는가 | `kubectl get pdb -A` | 2절. 아니면 drain이 멈춘다 |
| 인증서 | 만료가 가까운가 | `kubeadm certs check-expiration` | `kubeadm upgrade`가 갱신하지만 이미 만료됐으면 명령 자체가 실패한다 |
| CNI, CSI, 인그레스 컨트롤러 | 새 마이너를 지원하는 버전인가 | 각 프로젝트의 호환표 | 이들은 쿠버네티스와 따로 릴리스된다 |
| kubectl | 새 서버 버전 ±1 안인가 | `kubectl version` | 4절 |
| 롤백 계획 | 어디까지 되돌리고 누가 하는가 | 8절 | 실패는 새벽 2시에 난다 |

```bash
# 옛 API를 부르는 클라이언트가 있는가
kubectl get --raw /metrics \
  | grep requested_deprecated_apis
kubeadm certs check-expiration
kubectl get pdb -A
```

---

## 6. 업그레이드 전략 비교

```text
일괄
[n1 1.36][n2 1.36][n3 1.36]
   ▼        ▼        ▼   (중단)
[n1 1.37][n2 1.37][n3 1.37]

롤링
[n1 →1.37][n2 1.36 ][n3 1.36 ]
[n1 1.37 ][n2 →1.37][n3 1.36 ]
[n1 1.37 ][n2 1.37 ][n3 →1.37]

교체 (블루-그린)
[n1 1.36][n2 1.36] + [n4 1.37]
      파드 이전 ─────▶ [n5 1.37]
[n1][n2] 제거          [n6 1.37]
```

| 전략 | 어떻게 | 중단 | 롤백 | 왜 고르나 |
|:-----|:-----|:----|:----|:-------|
| 일괄 | 모든 노드를 한 번에 | 있음 | 어렵다 | 개발 클러스터. 빠르고 단순하다 |
| 롤링 (제자리) | 노드 하나씩 drain → 업그레이드 → uncordon | 없음 | 노드 단위로 되돌린다 | 자체 운영의 기본. 노드 여유가 한 대분 필요하다 |
| 교체 (블루-그린) | 새 버전 노드를 만들어 붙이고 옛 노드를 drain해 뺀다 | 없음 | 옛 노드를 다시 붙이면 끝 | 클라우드·관리형. 노드를 고치지 않고 버린다. 비용은 잠깐 두 배 |

관리형 서비스의 노드 풀 업그레이드는 셋째 방식의 자동화다. 새 노드를 하나 더 띄우고(surge) 옛 노드를 하나 비우는 식으로 돈다. 그 안에서도 파드가 옮겨 다니는 것은 같아서, 2절의 PDB와 여유 용량이 없으면 어느 전략이든 파드가 Pending에 걸린다.

---

## 7. kubeadm 업그레이드 절차

### 7.1 Control Plane 먼저

{{< callout type="warning" >}}
**순서는 컨트롤 플레인 → 워커다.** 4절의 스큐 정책이 그 순서다. 워커를 먼저 올리면 kubelet이 API 서버보다 높아져 정책 밖이다. 그리고 첫 컨트롤 플레인 노드만 `kubeadm upgrade apply`이고, 나머지 컨트롤 플레인과 워커는 전부 `kubeadm upgrade node`다. `apply`는 클러스터 전체의 버전을 정하고, `node`는 그 노드를 거기에 맞춘다.
{{< /callout >}}

```bash
# 0) 저장소를 새 마이너로 (03장 5.1절)
# pkgs.k8s.io/core:/stable:/v1.37/deb/
apt-get update
apt-cache madison kubeadm | head -3

# 1) kubeadm 먼저
apt-mark unhold kubeadm
apt-get install -y kubeadm='1.37.2-*'
apt-mark hold kubeadm
kubeadm version

# 2) 계획 확인
kubeadm upgrade plan

# 3) 첫 컨트롤 플레인에 적용
kubeadm upgrade apply v1.37.2

# 4) 나머지 컨트롤 플레인에서는
kubeadm upgrade node

# 5) kubelet, kubectl
kubectl drain cp1 --ignore-daemonsets
apt-mark unhold kubelet kubectl
apt-get install -y \
  kubelet='1.37.2-*' kubectl='1.37.2-*'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon cp1
```

| `kubeadm upgrade apply`가 하는 일 | 왜 |
|:---------------------------|:---|
| 클러스터가 올릴 수 있는 상태인지 검사. API 서버 응답, 노드 Ready, 스큐 정책 | 반쯤 올라간 클러스터를 만들지 않으려고 |
| 컨트롤 플레인 이미지를 미리 받는다 | 받는 중에 컴포넌트가 죽어 있지 않게 |
| `/etc/kubernetes/tmp/kubeadm-backup-manifests-*`, `kubeadm-backup-etcd-*`에 백업 | 실패하면 자동으로 되돌린다(8절) |
| 정적 파드 매니페스트를 새 버전으로 바꿔 쓴다 | [05](../05-scheduling)장 9절대로 kubelet이 파일 변경을 보고 컴포넌트를 다시 띄운다 |
| 로컬 etcd도 올린다 | 기본 동작. etcd 재시작 동안 API 서버의 진행 중 요청이 멈춘다 |
| CoreDNS, kube-proxy 매니페스트와 RBAC를 갱신 | 애드온도 버전이 있다 |
| 이 노드의 인증서를 갱신 (`--certificate-renewal` 기본 true) | [03](../03-cluster-setup)장 14.3절의 1년짜리 인증서가 업그레이드마다 새로 1년이 된다 |

패키지 버전은 `1.37.2-*`처럼 적는다. pkgs.k8s.io의 패키지는 `1.37.2-1.1` 같은 접미가 붙고, 옛 저장소의 `-00` 형식은 2023년 9월에 멈춘 apt.kubernetes.io의 것이다. 컨트롤 플레인 노드의 drain은 선택이다. 컨트롤 플레인 컴포넌트는 정적 파드라 drain에 안 걸리고, kubelet의 마이너 업그레이드 규칙 때문에 하는 것이니, 일반 파드가 안 도는 컨트롤 플레인이면 건너뛰어도 된다.

### 7.2 Worker 노드 업그레이드

```bash
# 컨트롤 플레인에서
kubectl drain worker-1 \
  --ignore-daemonsets \
  --delete-emptydir-data

# worker-1에서
apt-mark unhold kubeadm
apt-get install -y kubeadm='1.37.2-*'
apt-mark hold kubeadm
kubeadm upgrade node
apt-mark unhold kubelet
apt-get install -y kubelet='1.37.2-*'
apt-mark hold kubelet
systemctl daemon-reload
systemctl restart kubelet

# 컨트롤 플레인에서
kubectl uncordon worker-1
```

워커의 `kubeadm upgrade node`는 kubelet 설정(`/var/lib/kubelet/config.yaml`)을 클러스터의 새 kubelet-config ConfigMap에서 받아 쓰는 일만 한다. 컴포넌트는 없다. 노드 수만큼 반복하되, 한 번에 비우는 노드 수는 여유 용량과 PDB가 정한다.

### 7.3 검증

```bash
kubectl get nodes          # VERSION
kubectl get pods -n kube-system
kubectl version
kubeadm upgrade plan       # 남은 것
```

| 볼 것 | 정상 | 왜 |
|:-----|:----|:---|
| `kubectl get nodes`의 VERSION | 전부 새 버전, 전부 Ready | kubelet이 올라갔는지는 여기서만 보인다 |
| kube-system 파드 | 컨트롤 플레인 셋, etcd, CoreDNS, kube-proxy 전부 Running | 정적 파드는 이름에 노드 이름이 붙는다 |
| `kubectl version` | 서버 버전이 새 버전 | API 서버가 실제로 새 바이너리인지 |
| 애플리케이션 | 롤아웃 상태, 인그레스 응답, 경보 없음 | 컴포넌트가 떴다고 서비스가 된 것은 아니다 |

---

## 8. 롤백 절차

```text
실패 감지 (apply 중 / 검증 중)
        │
        ▼
kubeadm이 자동 복구했나?
  예 → kubeadm upgrade apply --force
        로 다시 시도
  아니오 ▼
/etc/kubernetes/tmp/
  kubeadm-backup-manifests-*
  kubeadm-backup-etcd-*
        │ 되돌려 놓는다
        ▼
그래도 안 되면 etcd 스냅샷 복원(11절)
+ 패키지를 이전 버전으로
```

| 단계 | 명령 | 왜 |
|:-----|:----|:---|
| 1. 자동 롤백 확인 | `kubeadm upgrade apply`는 컴포넌트 업그레이드가 실패하면 스스로 되돌린다. 로그를 본다 | 대부분 여기서 끝난다 |
| 2. 다시 시도 | `kubeadm upgrade apply v1.37.2 --force` | 중간에 꺼진 경우처럼 되돌리지 못했으면 같은 버전으로 다시 돌린다 |
| 3. 매니페스트 복구 | `/etc/kubernetes/tmp/kubeadm-backup-manifests-<시각>/`의 파일을 `/etc/kubernetes/manifests/`에 되돌린다 | kubelet이 옛 버전 정적 파드를 다시 띄운다 |
| 4. etcd 복구 | `kubeadm-backup-etcd-<시각>/`의 데이터, 또는 11절의 스냅샷 복원 | etcd 버전이 같이 올라갔다면 데이터 형식이 달라졌을 수 있다 |
| 5. 패키지 되돌리기 | `apt-get install -y kubeadm='1.36.4-*' kubelet='1.36.4-*'` 뒤 hold, kubelet 재시작 | kubelet은 마이너를 내릴 때도 노드를 비운다 |
| 6. 검증 | `kubectl get nodes`, `kubectl get pods -A` | 7.3절과 같다 |

kubeadm에 다운그레이드 명령은 없다. 롤백은 "백업을 되돌려 놓는 것"이고, 그래서 5절의 백업이 롤백 계획의 전부다. 특히 etcd를 스냅샷으로 되돌리면 스냅샷 이후의 모든 변경, 그 사이에 만들어진 파드와 Secret과 스케일 값까지 사라진다. 워크로드는 kubeadm이 건드리지 않으므로, 컨트롤 플레인이 잠깐 죽어도 노드 위의 파드는 돌고 있다([14](../14-troubleshooting)장 8절). 그 시간 동안 새 파드가 안 뜨고 kubectl이 안 될 뿐이다.

---

## 9. 백업 대상

```text
백업 세 층
┌──────────┬──────────┬──────────┐
│ 선언 파일 │  etcd    │  볼륨    │
│ Git의    │  스냅샷  │  PV 안의 │
│ YAML     │  전체    │  데이터  │
│          │  상태    │          │
├──────────┼──────────┼──────────┤
│ 바라는 것│ 지금 것  │ 앱의 것  │
└──────────┴──────────┴──────────┘
```

| 층 | 담는 것 | 도구 | 왜 따로인가 |
|:---|:------|:----|:---------|
| 선언 파일 | 내가 적은 Deployment, Service, ConfigMap, RBAC | Git, GitOps([13](../13-cicd)장) | "이렇게 되어야 한다"의 원본. 클러스터를 새로 만들어도 다시 적용하면 된다 |
| etcd | 클러스터의 실제 상태 전부. 컨트롤러가 만든 ReplicaSet과 파드, Secret, 상태 필드, 사람이 `kubectl edit`로 고친 것 | `etcdctl snapshot save` (11절) | Git에 없는 것이 여기 있다. 명령형으로 만든 오브젝트, 자동 생성된 인증서, HPA가 적은 replicas |
| 볼륨 | PV 안의 DB 파일, 업로드 파일 | [06](../06-storage)장 7.1절의 VolumeSnapshot, Velero의 파일 시스템 백업 | 쿠버네티스 오브젝트가 아니다. etcd에는 PV라는 "주소"만 있다 |

셋째 원리다. 세 층은 서로를 대신하지 못한다. Git만 있으면 클러스터를 다시 세울 수는 있지만 사람이 손으로 고친 것과 Secret이 없고, etcd만 있으면 클러스터는 되살아나지만 DB 파일은 없다. 볼륨만 있으면 데이터는 있는데 그것을 붙일 파드 정의가 없다. 그리고 etcd 스냅샷에는 Secret이 들어 있다. [08](../08-security)장 8.4절의 etcd 암호화를 안 켰다면 스냅샷 파일은 평문 비밀번호 뭉치이므로 백업 파일 자체를 암호화해 보관한다.

---

## 10. 리소스 구성 백업

### 방법 1. Git 선언적 관리 (권장)

```text
repo/
├── base/           # 공통 정의
├── overlays/prod/  # 환경별 차이
├── rbac/
└── secrets/        # SOPS·Sealed
                    # Secrets로 암호화
```

모든 변경이 커밋이면 백업은 이미 되어 있다. 이력, 리뷰, 되돌리기가 Git의 것이고, [13](../13-cicd)장의 ArgoCD 같은 GitOps 도구가 저장소와 클러스터를 맞춰 주면 "클러스터에만 있고 Git에 없는 것"이 생기지 않는다. Secret은 평문으로 커밋하지 않고 SOPS나 Sealed Secrets로 암호화해 둔다.

### 방법 2. API Server 추출

```bash
# all은 전부가 아니다
kubectl get all -A -o yaml \
  > all.yaml

# 정말 전부: list가 되는 리소스 전부
for r in $(kubectl api-resources \
    --verbs=list -o name); do
  kubectl get "$r" -A -o yaml \
    > "backup-$r.yaml" 2>/dev/null
done
```

`kubectl get all`의 `all`은 파드, 서비스, Deployment, ReplicaSet, StatefulSet, Job 정도의 별칭이라 ConfigMap, Secret, PVC, Ingress, RBAC, CRD는 빠진다. 위 반복문처럼 `api-resources`로 목록을 받아 돌아야 전부다. 이렇게 뽑은 YAML에는 `status`, `uid`, `resourceVersion`처럼 다시 적용하면 안 되는 필드가 섞여 있어, 복원할 때는 지우거나 `kubectl apply`가 무시하게 둔다. etcd에 손댈 수 없는 관리형 클러스터에서 etcd 스냅샷을 대신하는 가장 가까운 방법이다.

### 방법 3. Velero

```bash
velero install \
  --provider aws \
  --bucket my-backup \
  --secret-file ./credentials \
  --use-node-agent

velero backup create full-$(date +%F)
velero schedule create daily \
  --schedule "0 2 * * *" --ttl 720h
velero backup get
velero restore create \
  --from-backup full-2026-09-29
```

| Velero가 하는 일 | 어떻게 | 왜 |
|:-------------|:-----|:---|
| 오브젝트 백업 | API 서버에서 리소스를 읽어 오브젝트 스토리지(S3 등)에 | etcd 접근 없이 방법 2를 자동화한다. 네임스페이스·레이블 단위 |
| 볼륨 백업 | CSI VolumeSnapshot, 또는 스냅샷 데이터를 오브젝트 스토리지로 옮기는 데이터 무버, 또는 노드 에이전트의 파일 시스템 백업(Kopia) | PV 안의 데이터까지 한 묶음으로 |
| 일정과 보존 | `schedule`과 `--ttl` | 매일 찍고 30일 지우기 |
| 복원 | 다른 네임스페이스나 다른 클러스터로도 | 클러스터 이전과 재해 복구가 같은 명령이다 |

Velero(v1.18)는 `velero install`이나 Helm 차트로 깔고, 대상 스토리지의 플러그인이 있어야 한다. etcd를 통째로 되돌리는 11절과 달리 오브젝트 단위라, 네임스페이스 하나만 어제로 되돌리는 일이 된다.

---

## 11. etcd 스냅샷 백업과 복원

{{< callout type="warning" >}}
**etcd 백업은 선택이 아니다.** [02](../02-core-concepts)장 2.1절대로 클러스터의 상태는 etcd에만 있다. 디스크가 깨지거나 업그레이드가 어긋나면 Deployment, Service, Secret, 인증서 승인 기록이 다 사라지고, Git에 YAML이 있어도 사람이 손으로 고친 것과 컨트롤러가 만든 것은 거기 없다. 자동 스냅샷과 클러스터 밖 보관, 그리고 한 번 이상의 복원 연습이 있어야 백업이다.
{{< /callout >}}

### 11.1 스냅샷 저장

```bash
P=/etc/kubernetes/pki/etcd
etcdctl snapshot save /backup/snap.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=$P/ca.crt \
  --cert=$P/server.crt \
  --key=$P/server.key

etcdutl snapshot status \
  /backup/snap.db -w table
```

```text
+---------+----------+-------+--------+
| HASH    | REVISION | KEYS  | SIZE   |
+---------+----------+-------+--------+
| 3c5e78  |   432156 |  1298 | 5.2 MB |
+---------+----------+-------+--------+
```

| 열 | 뜻 | 왜 본다 |
|:---|:--|:------|
| HASH | 파일의 해시 | 옮기다 깨졌는지 |
| REVISION | 스냅샷 시점의 etcd 리비전 | 클러스터의 모든 변경마다 하나씩 오른다. 어느 시점인지 |
| KEYS | 키 개수 | 오브젝트 수의 대략. 0이면 잘못 찍은 것 |
| SIZE | DB 크기 | 기본 상한 8GB의 어디쯤인지 |

스냅샷은 도는 멤버 하나에서 찍는다. [03](../03-cluster-setup)장 11.4절의 `etcdctl`이고, kubeadm 클러스터의 인증서 경로는 위와 같다. etcd 3.6부터 `etcdctl`은 찍는 일만 하고, 검사와 복원은 `etcdutl`이 한다. 호스트에 두 바이너리가 없으면 etcd 정적 파드 안의 것을 쓴다. `/var/lib/etcd`가 hostPath라 컨테이너 안에서 그 아래에 찍으면 호스트에 남는다.

```bash
kubectl -n kube-system exec etcd-cp1 \
  -- sh -c 'P=/etc/kubernetes/pki/etcd
  etcdctl snapshot save \
    /var/lib/etcd/snap.db \
    --endpoints=https://127.0.0.1:2379 \
    --cacert=$P/ca.crt \
    --cert=$P/server.crt \
    --key=$P/server.key'
```

### 11.2 복원

```bash
# 1) API 서버와 etcd 정적 파드를 멈춘다
cd /etc/kubernetes/manifests
mv kube-apiserver.yaml etcd.yaml /root/

# 2) 새 디렉터리로 복원
etcdutl snapshot restore \
  /backup/snap.db \
  --data-dir /var/lib/etcd-restored \
  --bump-revision 1000000000 \
  --mark-compacted

# 3) etcd.yaml의 hostPath와 --data-dir을
#    /var/lib/etcd-restored 로 고친다

# 4) 다시 띄운다
mv /root/etcd.yaml \
   /root/kube-apiserver.yaml .

# 5) 확인
kubectl get nodes
kubectl get pods -A
```

| 단계 | 왜 |
|:-----|:---|
| API 서버를 먼저 멈춘다 | 복원 중에 쓰기가 들어오면 옛 상태와 새 쓰기가 섞인다. 매니페스트를 옮기면 [05](../05-scheduling)장 9절의 정적 파드가 내려간다 |
| 새 data-dir로 복원한다 | 기존 `/var/lib/etcd`를 덮어쓰지 않아야 실패해도 돌아갈 곳이 있다 |
| `--bump-revision`, `--mark-compacted` | 복원된 etcd의 리비전이 복원 전보다 낮으면 API 서버와 컨트롤러의 watch 캐시가 옛 리비전을 들고 있어 어긋난다. 리비전을 크게 올리고 압축 표시를 해 캐시를 무효화한다 |
| 모든 멤버를 같은 스냅샷으로 | 복원은 멤버 ID와 클러스터 ID를 새로 만든다. 새 클러스터라 옛 멤버와 섞이면 안 된다 |
| 복원 뒤 몇 분 기다린다 | 스냅샷 이후 만들어진 파드는 오브젝트가 사라졌으니 kubelet이 지우고, 그 사이 사라졌던 것은 컨트롤러가 다시 만든다. 되돌린 시점과 실제 노드가 맞춰지는 데 몇 분 걸린다 |

```bash
# HA: 멤버마다 자기 이름·주소로
etcdutl snapshot restore \
  /backup/snap.db \
  --name cp1 \
  --data-dir /var/lib/etcd-restored \
  --initial-cluster \
    cp1=https://10.0.0.11:2380,\
cp2=https://10.0.0.12:2380,\
cp3=https://10.0.0.13:2380 \
  --initial-cluster-token restored-1 \
  --initial-advertise-peer-urls \
    https://10.0.0.11:2380
```

HA 클러스터([03](../03-cluster-setup)장 12절)에서는 세 컨트롤 플레인 모두에서 같은 스냅샷으로 각자 복원하고, 세 etcd를 동시에 내렸다 올린다. 한 멤버만 복원하면 그 멤버는 다른 클러스터 ID를 가진 남이 되어 나머지와 합류하지 못한다.

### 11.3 자동화

```bash
#!/bin/bash
# /usr/local/bin/etcd-snap.sh
D=/backup/etcd
P=/etc/kubernetes/pki/etcd
F=$D/etcd-$(date +%Y%m%d-%H%M%S).db
mkdir -p $D
etcdctl snapshot save $F \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=$P/ca.crt \
  --cert=$P/server.crt \
  --key=$P/server.key
etcdutl snapshot status $F -w table
# 클러스터 밖으로 복사
aws s3 cp $F s3://my-backup/etcd/
# 로컬은 7일만
find $D -name 'etcd-*.db' \
  -mtime +7 -delete
```

```bash
# crontab -e : 매일 02:00
0 2 * * * /usr/local/bin/etcd-snap.sh \
  >> /var/log/etcd-backup.log 2>&1
```

스냅샷은 찍은 노드에 두면 백업이 아니다. 노드가 죽으면 같이 죽는다. 오브젝트 스토리지나 다른 기계로 보내고, 파일 자체를 암호화하고, 한 달에 한 번은 별도 클러스터에 복원해 `kubectl get pods`가 나오는지 본다. 복원 연습 없는 백업은 처음 쓰는 날 실패한다.

---

## 12. 백업 전략 비교

| 방법 | 잡는 것 | 못 잡는 것 | 어디에 | 왜 |
|:-----|:------|:--------|:-----|:---|
| Git | 선언한 정의 | 명령형으로 만든 것, 상태, Secret | 모든 환경 | 원본. 이것 없이는 클러스터를 다시 세우지 못한다 |
| API 추출 | API로 보이는 오브젝트 전부 | 저장 시점 이후, 다시 적용 못 하는 상태 필드 | 관리형 클러스터 | etcd에 손 못 대는 곳의 차선 |
| etcd 스냅샷 | 클러스터 상태 전부 | PV 안의 데이터 | 자체 운영 | 컨트롤 플레인 재해의 유일한 답 |
| Velero | 오브젝트 + 볼륨 | 컨트롤 플레인 자체(인증서, etcd 멤버) | 운영 클러스터 | 네임스페이스 단위 복원, 클러스터 이전 |

```text
권장 조합
1. Git      모든 변경을 커밋. GitOps
2. etcd     매일 스냅샷, 밖에 보관, 7일
3. Velero   매일 오브젝트+볼륨, 30일
   +       분기마다 복원 연습
```

| 물음 | 정하는 것 | 왜 |
|:-----|:-------|:---|
| 얼마나 잃어도 되나 (RPO) | 스냅샷 주기 | 하루 한 번이면 최대 하루치를 잃는다. 자주 바뀌는 클러스터는 시간 단위로 |
| 얼마 만에 살아나야 하나 (RTO) | 복원 절차의 자동화와 연습 | 11.2절을 처음 해 보는 새벽에는 한 시간이 넘는다 |
| 어디까지가 클러스터 밖인가 | 보관 위치 | 같은 노드는 0점, 같은 데이터센터는 반, 다른 리전이 1점 |

---

## 13. 명령어 요약

```bash
# 노드 유지보수
kubectl cordon node-2
kubectl drain node-2 \
  --ignore-daemonsets \
  --delete-emptydir-data
kubectl uncordon node-2
kubectl get nodes -o wide
kubectl get pdb -A

# 업그레이드 (컨트롤 플레인)
apt-mark unhold kubeadm
apt-get install -y kubeadm='1.37.2-*'
apt-mark hold kubeadm
kubeadm upgrade plan
kubeadm upgrade apply v1.37.2   # 첫 CP
kubeadm upgrade node            # 나머지
apt-mark unhold kubelet kubectl
apt-get install -y \
  kubelet='1.37.2-*' kubectl='1.37.2-*'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet

# 검증
kubectl get nodes
kubectl get pods -n kube-system
kubeadm certs check-expiration

# etcd
etcdctl snapshot save snap.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=$P/ca.crt \
  --cert=$P/server.crt \
  --key=$P/server.key
etcdutl snapshot status snap.db -w table
etcdutl snapshot restore snap.db \
  --data-dir /var/lib/etcd-restored

# 리소스
kubectl get all -A -o yaml > all.yaml
velero backup create b1
velero restore create --from-backup b1
```

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| 노드 장애 | Lease 10초, 50초 뒤 NotReady, taint 300초 뒤 퇴거 | 심장 박동이 끊긴 것만 안다 |
| StatefulSet과 죽은 노드 | 옛 파드가 지워질 때까지 새 파드가 못 뜬다 | `out-of-service` taint 또는 노드 삭제 |
| cordon | 새 파드만 막는다 | `unschedulable` taint |
| drain | cordon + 퇴거 API. PDB를 지킨다 | DaemonSet은 남고, 컨트롤러 없는 파드는 `--force` |
| PDB | 자발적 중단에서 최소 가용을 지킨다 | 파드 하나에 `maxUnavailable: 0`이면 drain이 영원히 막힌다 |
| 릴리스 | 마이너 1년 세 번, 지원 14개월 | 1년에 두 번은 올려야 한다 |
| 스큐 | API 서버 먼저. kubelet은 세 마이너까지 뒤처져도 된다 | 위가 먼저, 아래가 따라온다 |
| 한 마이너씩 | kubeadm은 건너뛰지 못한다 | 컨트롤 플레인 스큐 한 마이너 |
| kubeadm 절차 | `apply`는 첫 CP, `node`는 나머지. kubelet은 drain 뒤 | 인증서도 이때 갱신된다 |
| 롤백 | 자동 복구 → `--force` 재시도 → tmp 백업 → 스냅샷 | 다운그레이드 명령은 없다 |
| 백업 세 층 | Git, etcd 스냅샷, 볼륨 | 서로를 대신하지 못한다 |
| etcd 스냅샷 | `etcdctl`로 찍고 `etcdutl`로 검사·복원 | 3.6부터 역할이 나뉘었다 |
| 복원 | API 서버 정지, 새 data-dir, 리비전 올리기, 모든 멤버 같은 스냅샷 | 시점을 되돌리는 일이라 그 뒤는 잃는다 |
| Velero | 오브젝트 + 볼륨을 네임스페이스 단위로 | 관리형과 클러스터 이전 |

{{< callout type="info" >}}
**용어 정리**
- **Lease**: kubelet이 10초마다 갱신하는 심장 박동 오브젝트. `kube-node-lease` 네임스페이스
- **node-monitor-grace-period**: 갱신이 끊긴 뒤 NotReady로 판정하기까지의 시간. 기본 50초
- **not-ready / unreachable taint**: 노드 컨트롤러가 거는 `NoExecute` taint. 파드는 300초를 견딘 뒤 퇴거
- **out-of-service taint**: 돌아오지 않는 노드의 파드를 강제 삭제하고 볼륨을 떼는 비정상 종료 처리
- **Cordon / Uncordon**: 노드에 새 파드 막기 / 풀기
- **Drain**: cordon 뒤 퇴거 API로 파드를 내보내는 것
- **퇴거 API (Eviction)**: PDB를 지키며 파드를 내보내는 요청. 삭제와 다르다
- **PDB (PodDisruptionBudget)**: 자발적 중단에서 지켜야 할 최소 가용 파드 수
- **버전 스큐**: 컴포넌트 사이에 허용되는 마이너 버전 차이
- **kubeadm upgrade plan / apply / node**: 계획 / 첫 컨트롤 플레인 적용 / 나머지 노드 맞추기
- **정적 파드 매니페스트**: `/etc/kubernetes/manifests`. 옮기면 내려가고 되돌리면 올라온다
- **etcdctl / etcdutl**: 도는 etcd에 말하는 도구 / 파일을 다루는 도구. 스냅샷 찍기 / 검사·복원
- **리비전**: etcd의 변경 일련번호. 복원 때 `--bump-revision`으로 올린다
- **Velero**: 오브젝트와 볼륨을 오브젝트 스토리지에 백업·복원하는 도구
- **RPO / RTO**: 잃어도 되는 시간 / 살아나야 하는 시간
{{< /callout >}}
