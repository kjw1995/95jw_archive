---
title: "14. 트러블슈팅"
weight: 14
---

Kubernetes 클러스터와 애플리케이션에서 발생하는 장애를 진단·복구하는 방법을 다룬다.

## 1. 트러블슈팅 접근법

문제가 어디에서 터졌는지부터 좁혀야 수많은 kubectl 명령이 의미를 가진다. 증상을 먼저 기술하고, 영향 범위(특정 Pod / 특정 노드 / 클러스터 전체)를 구분한 뒤, 로그와 이벤트를 살펴 원인을 특정하는 순서를 지킨다.

```text
   증상 파악
      │
      ▼
┌──────────────┐
│  범위 확인    │
├──────────────┤
│ Pod?  → App  │
│ Node? → 노드 │
│ All?  → CP   │
└──────┬───────┘
       │
       ▼
 로그 / 이벤트
       │
       ▼
   원인 / 복구
```

### 1.1 기본 진단 명령어

```bash
# 클러스터 전반
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A

# 최근 이벤트 (시간 정렬)
kubectl get events -A --sort-by='.lastTimestamp'

# 문제 Pod만 추림
kubectl get pods -A --field-selector=status.phase!=Running
```

{{< callout type="info" >}}
**describe 우선 원칙**
`kubectl logs` 보다 `kubectl describe`를 먼저 본다. Events 섹션에 스케줄러·kubelet·컨트롤러가 남긴 실패 사유(이미지 풀 실패, PVC 미바인딩, 리소스 부족 등)가 그대로 찍혀 있어 원인의 80%는 여기서 드러난다.
{{< /callout >}}

## 2. Pod Phase와 상태

`status.phase`는 Pod의 큰 흐름을, `status.containerStatuses[*].state`는 컨테이너 수준의 세부 사유를 알려준다.

| Phase | 의미 | 주요 원인 |
|:---|:---|:---|
| Pending | 아직 노드에 배정 안 됨 | 스케줄링 실패, 이미지 풀 중, PVC 미바인딩 |
| Running | 노드에서 실행 중 | 최소 한 컨테이너가 실행·시작 중 |
| Succeeded | 모든 컨테이너 정상 종료 | Job·CronJob 완료 |
| Failed | 컨테이너가 비정상 종료 | 앱 오류, OOMKilled, 시작 실패 |
| Unknown | 상태를 알 수 없음 | 노드-apiserver 통신 두절 |

컨테이너 state는 Running 외에 `Waiting(Reason)`과 `Terminated(Reason)`로 쪼개지며, 실제 원인은 Reason에 들어간다.

| Reason | 위치 | 의미 |
|:---|:---|:---|
| ContainerCreating | Waiting | 이미지 풀·볼륨 마운트 진행 중 |
| ImagePullBackOff | Waiting | 이미지 풀 실패(이름·권한·네트워크) |
| CrashLoopBackOff | Waiting | 컨테이너가 반복 종료되어 재시작 지연 |
| OOMKilled | Terminated | 메모리 limit 초과로 커널이 종료 |
| Error | Terminated | 비정상 종료 코드(≠0) |
| Completed | Terminated | 정상 종료(Job 등) |

## 3. 디버깅 의사결정 트리

무작정 describe/logs를 반복하기보다, 현재 Phase·Reason에서 가지를 치며 따라가면 빠르다.

```text
   kubectl get pods
         │
   ┌─────┴──────┐
Pending       Running/
   │          CrashLoop
   ▼              │
describe      ┌───┴────┐
 Events      logs    describe
   │          │        │
 스케줄?    앱 오류?  OOMKilled?
 PVC?       설정?    probe 실패?
 taint?     의존성?  리소스?
```

1. **Pending**: describe → Events → 스케줄러 메시지 확인
2. **ImagePullBackOff**: describe → 이미지 이름 / imagePullSecrets 확인
3. **CrashLoopBackOff**: `logs --previous` → 앱 스택트레이스 확인
4. **Running인데 접속 불가**: endpoints → service selector / probe 확인

## 4. Pending 트러블슈팅

```bash
kubectl describe pod <pod>
# Events 예시
# 0/3 nodes are available: insufficient memory
# 0/3 nodes are available: node(s) had taint {...}
# pod has unbound immediate PersistentVolumeClaims
```

| 메시지 | 원인 | 조치 |
|:---|:---|:---|
| insufficient cpu/memory | 리소스 부족 | requests 축소, 노드 추가, HPA/CA 확인 |
| didn't match node selector | nodeSelector/affinity 불일치 | 라벨·affinity 재확인 |
| had taint that the pod didn't tolerate | taint 미대응 | toleration 추가 |
| unbound PVC | 매칭 PV 없음 | StorageClass, 프로비저너 상태 확인 |

## 5. ImagePullBackOff

```bash
kubectl describe pod <pod>
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].image}'

# Private registry 인증 secret
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<pass>
```

```yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: private.registry.io/team/app:1.2.3
```

체크포인트는 이미지 이름 오타, 태그 미존재, 인증 Secret 누락, 노드-레지스트리 간 네트워크 차단 네 가지다.

## 6. CrashLoopBackOff

```bash
# 현재 컨테이너 로그
kubectl logs <pod>

# 재시작 직전 종료된 컨테이너 로그 (가장 중요)
kubectl logs <pod> --previous

# 멀티 컨테이너
kubectl logs <pod> -c <container>

# 재시작 횟수
kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[*].restartCount}'
```

{{< callout type="warning" >}}
**CrashLoopBackOff 진단 순서**
1. `describe` Events의 Last Termination Reason 확인 → OOMKilled인지, Error인지, StartupProbe 실패인지 구분
2. `logs --previous`로 재시작 직전 스택트레이스 확보(현재 로그는 이미 두 번째 실행이라 원인이 안 보일 수 있다)
3. ConfigMap/Secret·환경변수·의존 서비스·리소스 limit 순으로 범위 좁히기
{{< /callout >}}

OOMKilled 대응 예:

```yaml
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"   # 실제 피크 기준으로 상향
```

## 7. Service / DNS

### 7.1 Service-Endpoint 확인

```bash
kubectl get svc <svc>
kubectl get endpoints <svc>       # 비어 있으면 selector 불일치
kubectl describe svc <svc>
kubectl get pods --show-labels
```

Endpoints가 비면 99% selector-label 불일치 또는 Pod가 Ready가 아닌 경우다.

### 7.2 DNS 진단

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs  -n kube-system -l k8s-app=kube-dns

kubectl run dnsutils --rm -it \
  --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 \
  --command -- sh
# 내부: nslookup kubernetes.default
# 외부: nslookup google.com
```

| 증상 | 원인 | 조치 |
|:---|:---|:---|
| 내부 DNS 실패 | CoreDNS 장애 | CoreDNS Pod 재시작 |
| 외부 DNS 실패 | 업스트림 설정 | CoreDNS ConfigMap 확인 |
| 간헐적 타임아웃 | CoreDNS 부하 | replicas 증가, HPA |

## 8. Control Plane Failure

kubeadm 환경에서는 대부분 `/etc/kubernetes/manifests/*.yaml` 정적 Pod로 떠 있다.

```bash
kubectl get pods -n kube-system
kubectl logs -n kube-system kube-apiserver-<master>
kubectl logs -n kube-system etcd-<master>

# 정적 Pod 매니페스트
ls  /etc/kubernetes/manifests/
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 네이티브 서비스 배포일 때
sudo systemctl status kube-apiserver
sudo journalctl -u kube-apiserver -f
```

### 8.1 etcd 헬스체크

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health
```

{{< callout type="warning" >}}
**Control Plane 장애 시 kubectl 동작**
- kube-apiserver 다운: `kubectl` 자체가 실패(`connection refused`). 기존 워크로드는 당장은 계속 실행된다.
- kube-scheduler 다운: 새 Pod 스케줄링만 멈춤. 이미 떠 있는 Pod는 정상.
- kube-controller-manager 다운: ReplicaSet·Node 컨트롤러 등이 멈춰 롤아웃·재스케줄이 안 됨.
- etcd 다운: apiserver가 상태 저장/조회 불가 → 사실상 클러스터 전체 마비.
복구 우선순위는 etcd → apiserver → controller-manager / scheduler 순.
{{< /callout >}}

## 9. Worker Node Failure

```bash
kubectl get nodes
kubectl describe node <node>   # Conditions 섹션이 핵심
```

| Condition | True일 때 의미 | 조치 |
|:---|:---|:---|
| Ready | 정상 | - |
| MemoryPressure | 메모리 부족 | 워크로드 분산, limit 조정 |
| DiskPressure | 디스크 부족 | 이미지 GC, 로그 정리 |
| PIDPressure | PID 과다 | 좀비 프로세스 정리 |
| NetworkUnavailable | CNI 미구성 | CNI Pod/설정 확인 |

Ready가 `Unknown`으로 뜨면 노드 자체가 죽었거나 kubelet이 apiserver와 통신 불가한 상황이다.

### 9.1 kubelet / 런타임 점검

```bash
sudo systemctl status kubelet
sudo journalctl -u kubelet --since "10 minutes ago"

# 컨테이너 런타임 (containerd)
sudo systemctl status containerd
sudo crictl ps
sudo crictl pods

# 인증서 만료
sudo kubeadm certs check-expiration
sudo kubeadm certs renew all
```

## 10. 네트워크 트러블슈팅

```bash
# CNI 설정·바이너리
ls /etc/cni/net.d/
ls /opt/cni/bin/

# CNI Pod (Calico 예시)
kubectl get pods -n kube-system -l k8s-app=calico-node

# kube-proxy
kubectl get pods -n kube-system -l k8s-app=kube-proxy
kubectl logs    -n kube-system -l k8s-app=kube-proxy

# Pod 간 통신 테스트
kubectl run t1 --image=busybox --command -- sleep infinity
kubectl run t2 --image=busybox --command -- sleep infinity
kubectl get pods -o wide
kubectl exec -it t1 -- ping <t2-ip>
```

## 11. 스토리지 트러블슈팅

```bash
kubectl get pvc
kubectl describe pvc <pvc>
kubectl get pv
kubectl get storageclass
```

- PVC가 `Pending`이면 매칭되는 PV 없음 / StorageClass 미존재 / 프로비저너 장애
- 마운트 실패(`Unable to mount volumes`, `timeout waiting for condition`)면 노드-스토리지 네트워크, 권한, CSI 드라이버 Pod 상태 확인

## 12. kubectl debug와 Ephemeral Containers

기존 Pod 이미지가 `distroless`·`scratch` 같이 셸도 없으면 exec가 막힌다. 이때 `kubectl debug`로 **임시(ephemeral) 컨테이너**를 같은 Pod 네트워크/PID 네임스페이스에 주입한다.

```bash
# 실행 중 Pod에 디버그 컨테이너 붙이기 (K8s 1.25+ GA)
kubectl debug -it <pod> \
  --image=busybox \
  --target=<container>

# 이미지를 갈아끼운 '복사본' Pod로 디버그
kubectl debug <pod> -it \
  --copy-to=<pod>-debug \
  --container=<container> \
  --image=ubuntu

# 노드 자체 디버그 (호스트 루트 마운트된 Pod 생성)
kubectl debug node/<node> -it --image=busybox
```

| 기법 | 특징 | 용도 |
|:---|:---|:---|
| `exec` | 기존 컨테이너 진입 | 셸·툴이 있는 이미지 |
| `debug --target` | 같은 Pod에 임시 컨테이너 주입 | distroless 디버깅, 네트워크 공유 확인 |
| `debug --copy-to` | Pod 사본을 띄워 이미지 교체 | probe·CMD 변경 실험 |
| `debug node/` | 노드 호스트 네임스페이스 진입 | kubelet·CNI·디스크 점검 |

### 12.1 보조 도구

```bash
# 포트 포워딩 (로컬에서 curl)
kubectl port-forward pod/<pod> 8080:80
kubectl port-forward svc/<svc> 8080:80

# 리소스 사용량
kubectl top nodes
kubectl top pods -A --sort-by=memory
```

## 13. 빠른 진단 치트시트

```bash
# 전체 상태 한눈에
kubectl get nodes,pods,svc,deploy -A

# 문제 Pod만
kubectl get pods -A | grep -vE 'Running|Completed'

# 최근 이벤트 20건
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# 마지막 종료 이유 jsonpath
kubectl get pod <pod> \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
```

## 14. 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Phase | Pending/Running/Succeeded/Failed/Unknown |
| Reason | Waiting/Terminated의 세부 사유(ImagePullBackOff 등) |
| describe 우선 | Events 섹션이 원인의 80% |
| logs --previous | CrashLoop의 실제 원인은 이전 컨테이너 로그 |
| Endpoints | 비어 있으면 selector/Ready 문제 |
| Node Conditions | Ready 외 Memory/Disk/PID/Network Pressure 주목 |
| Control Plane | etcd → apiserver → controller/scheduler 순 복구 |
| kubectl debug | distroless·노드 디버깅용 임시 컨테이너 |

{{< callout type="info" >}}
**용어 정리**
- **Phase**: Pod의 상위 상태(Pending/Running/Succeeded/Failed/Unknown)
- **CrashLoopBackOff**: 컨테이너가 반복 종료되어 재시작을 지수 백오프로 지연시키는 상태
- **OOMKilled**: 메모리 limit 초과로 커널이 프로세스를 종료한 상태
- **Endpoints**: Service가 트래픽을 보내는 Ready 상태 Pod IP 목록
- **Static Pod**: kubelet이 `/etc/kubernetes/manifests/`에서 직접 띄우는 Pod
- **Node Condition**: 노드 상태 플래그(Ready, MemoryPressure 등)
- **Ephemeral Container**: 디버깅용으로 기존 Pod에 주입되는 임시 컨테이너
- **kubectl debug**: exec 불가 이미지·노드를 진단하기 위한 디버깅 서브커맨드
{{< /callout >}}
