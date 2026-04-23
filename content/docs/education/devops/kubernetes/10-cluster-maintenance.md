---
title: "10. 클러스터 유지보수"
weight: 10
---

클러스터 운영에서 가장 사고가 잦은 영역은 노드 교체, 버전 업그레이드, 백업/복원이다. 이 세 가지는 서로 얽혀 있으며, 순서와 원칙을 지키지 않으면 데이터 손실이나 장기 다운타임으로 이어진다.

## 1. 노드 유지보수의 기본 동작

노드가 `NotReady` 상태로 빠지면 쿠버네티스는 즉시 Pod를 옮기지 않고 일정 시간 기다린다. 기본 대기 시간 안에 복구되지 않으면 해당 노드의 Pod를 퇴거(evict)한다.

```text
정상 상태
┌────────┐ ┌────────┐ ┌────────┐
│ Node 1 │ │ Node 2 │ │ Node 3 │
│ Pod A  │ │ Pod A' │ │ Pod B  │
│ Pod C  │ │ Pod B' │ │        │
└────────┘ └────────┘ └────────┘

Node 2 다운 → 5분 대기 → 퇴거
┌────────┐ ┌────────┐ ┌────────┐
│ Node 1 │ │  DOWN  │ │ Node 3 │
│ Pod A  │ │  X X   │ │ Pod B  │
│ Pod C  │ │        │ │ Pod A' │
└────────┘ └────────┘ └────────┘
```

| 설정 | 기본값 | 설명 |
|:---|:---|:---|
| `pod-eviction-timeout` | 5분 | NotReady 이후 퇴거 대기 시간 |
| ReplicaSet/Deployment | 재생성 | 다른 노드에 자동 재스케줄 |
| 단독 Pod | 영구 손실 | 컨트롤러가 없으면 복구 불가 |

{{< callout type="warning" >}}
단독 Pod(bare pod)는 노드 장애 시 **영구 손실**된다. 운영 워크로드는 반드시 Deployment/StatefulSet/DaemonSet 등 컨트롤러로 감싸야 한다.
{{< /callout >}}

## 2. Drain과 Cordon

### Cordon - 스케줄링만 차단

새 Pod가 노드에 할당되지 않도록 막지만, **기존 Pod는 그대로 둔다**.

```bash
kubectl cordon <node>
kubectl uncordon <node>
```

### Drain - 안전한 워크로드 이전

노드를 `cordon` 하고, 기존 Pod까지 우아하게 종료해 다른 노드로 옮긴다.

```bash
# 기본 drain
kubectl drain <node> --ignore-daemonsets

# 로컬 emptyDir 데이터 있는 Pod까지 축출
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

# 컨트롤러가 없는 Pod도 강제 삭제
kubectl drain <node> --ignore-daemonsets --force
```

```text
Drain 전                  Drain 후
┌────────┐                ┌────────┐
│ Node 1 │                │ Node 1 │
│ Pod A  │  ── drain ──▶  │ (비움) │
│ Pod B  │                │ cordon │
└────────┘                └────────┘
┌────────┐                ┌────────┐
│ Node 2 │                │ Node 2 │
│ Pod C  │                │ Pod A  │
│        │                │ Pod B  │
└────────┘                │ Pod C  │
                          └────────┘
```

{{< callout type="info" >}}
**cordon vs drain 한 줄 요약**
- `cordon`: 신규 스케줄만 차단 (기존 Pod 유지)
- `drain`: cordon + 기존 Pod까지 축출
- `uncordon`: 스케줄 허용 (이전된 Pod는 자동으로 돌아오지 않음)
{{< /callout >}}

| 명령 | 기존 Pod | 새 Pod 스케줄 | 용도 |
|:---|:---|:---|:---|
| `cordon` | 유지 | 차단 | 관찰·점검만 필요 |
| `drain` | 이전 | 차단 | OS 패치·재부팅·업그레이드 |
| `uncordon` | 유지 | 허용 | 유지보수 종료 후 |

## 3. Kubernetes 버전 체계

```text
v1.28.3
 │  │  │
 │  │  └── Patch (버그·보안)
 │  └───── Minor (기능·API)
 └──────── Major (아키텍처)
```

| 유형 | 주기 | 내용 |
|:---|:---|:---|
| Major | 드물게 | 주요 구조 변경 |
| Minor | 약 4개월 | 새 기능, API 추가 |
| Patch | 수시 | 버그/보안 수정 |

### 릴리스 단계

| 단계 | 안정성 | 기본 활성화 | 용도 |
|:---|:---|:---|:---|
| Alpha | 낮음 | X | 실험·피드백 |
| Beta | 중간 | O (1.24 이후 일부 예외) | 통합 테스트 |
| Stable (GA) | 높음 | O | 운영 |

쿠버네티스는 **최신 3개 Minor만 공식 지원**한다. 현재 최신이 `v1.28`이라면 `v1.28 / v1.27 / v1.26`까지만 패치가 제공된다.

## 4. 버전 스큐 정책 (Version Skew)

kube-apiserver를 기준(`X`)으로 다른 컴포넌트의 허용 버전 범위가 정해진다.

```text
        kube-apiserver (X)
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
controller  scheduler  cloud-ctrl
 X, X-1     X, X-1     X, X-1
   │
   ├─ kubelet      X, X-1, X-2
   ├─ kube-proxy   X, X-1, X-2
   └─ kubectl      X+1, X, X-1
```

| 컴포넌트 | apiserver 1.28 기준 허용 |
|:---|:---|
| kube-apiserver | 1.28 |
| controller-manager | 1.28, 1.27 |
| scheduler | 1.28, 1.27 |
| kubelet | 1.28, 1.27, 1.26 |
| kube-proxy | 1.28, 1.27, 1.26 |
| kubectl | 1.29, 1.28, 1.27 |

{{< callout type="warning" >}}
**한 번에 한 Minor 씩만** 업그레이드한다. `1.26 → 1.29` 처럼 건너뛰면 kubelet/apiserver 스큐 허용 범위를 벗어나 Pod 스케줄링이 거부될 수 있다.
{{< /callout >}}

## 5. 업그레이드 사전 체크리스트

업그레이드 작업을 시작하기 전에 반드시 다음을 확인한다.

| 항목 | 확인 내용 | 명령/위치 |
|:---|:---|:---|
| 버전 경로 | 한 번에 한 Minor 차이인가 | `kubeadm upgrade plan` |
| etcd 백업 | 최신 스냅샷이 있는가 | `etcdctl snapshot status` |
| 리소스 백업 | YAML/Velero 백업 완료 | Git, Velero |
| Deprecated API | 사용 중인 API가 제거되지 않는가 | Release Notes, `kubectl convert` |
| 노드 여유 | drain 시 워크로드를 수용 가능한가 | `kubectl top node` |
| PDB | PodDisruptionBudget 충돌 없는가 | `kubectl get pdb -A` |
| CNI/CSI | 플러그인의 호환 버전인가 | 벤더 문서 |
| 롤백 계획 | 복원 절차와 담당자 정해졌는가 | 런북 |

## 6. 업그레이드 전략 비교

### 전략 1: 일괄 업그레이드

```text
[N1 v1.27] [N2 v1.27] [N3 v1.27]
     │          │          │
     ▼          ▼          ▼
   ======= 다운타임 =======
     │          │          │
     ▼          ▼          ▼
[N1 v1.28] [N2 v1.28] [N3 v1.28]
```

빠르지만 **서비스 중단**이 발생한다.

### 전략 2: 롤링 업그레이드

```text
[N1 upgrade] [N2 v1.27 ] [N3 v1.27 ]
             └ 워크로드 수용 ────┘

[N1 v1.28  ] [N2 upgrade] [N3 v1.27 ]
 └ 워크로드 수용 ───────────────┘

[N1 v1.28  ] [N2 v1.28  ] [N3 upgrade]
```

무중단이지만 시간이 오래 걸린다. 운영 환경의 기본 전략.

### 전략 3: 블루-그린 (새 노드 교체)

```text
[N1 v1.27] [N2 v1.27] [N3 v1.27] + [N4 v1.28]
                                    │
                             워크로드 이전
                                    ▼
[N4 v1.28] [N5 v1.28] [N6 v1.28]
```

가장 안전하고 롤백이 쉽지만, 추가 인프라 비용이 든다.

## 7. kubeadm 업그레이드 절차

### 7.1 Control Plane 먼저

{{< callout type="warning" >}}
업그레이드 순서는 **반드시 Control Plane → Worker**다. apiserver가 먼저 신버전이어야 하위 컴포넌트가 스큐 정책 안에 들어온다. Worker를 먼저 올리면 kubelet이 apiserver보다 높은 버전이 되어 거부된다.
{{< /callout >}}

```bash
# 1) 업그레이드 가능 버전 확인
kubeadm upgrade plan

# 2) kubeadm 패키지 업그레이드
apt-mark unhold kubeadm
apt-get update
apt-get install -y kubeadm=1.28.0-00
apt-mark hold kubeadm

# 3) 첫 Control Plane에 적용
kubeadm upgrade apply v1.28.0

# 4) 추가 Control Plane 노드
kubeadm upgrade node

# 5) drain → kubelet/kubectl 업그레이드 → 재시작 → uncordon
kubectl drain <cp-node> --ignore-daemonsets
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.28.0-00 kubectl=1.28.0-00
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon <cp-node>
```

### 7.2 Worker 노드 업그레이드

```bash
# Control Plane에서
kubectl drain <worker> --ignore-daemonsets --delete-emptydir-data

# Worker 노드에서
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.28.0-00
apt-mark hold kubeadm
kubeadm upgrade node

apt-mark unhold kubelet
apt-get install -y kubelet=1.28.0-00
apt-mark hold kubelet
systemctl daemon-reload
systemctl restart kubelet

# Control Plane에서
kubectl uncordon <worker>
```

### 7.3 검증

```bash
kubectl get nodes                     # VERSION 모두 신버전?
kubectl get pods -n kube-system       # 컴포넌트 Running?
kubectl cluster-info                  # API 엔드포인트 정상?
```

## 8. 롤백 절차

업그레이드 도중 문제가 발견되면 아래 흐름으로 원복한다.

```text
       업그레이드 실패 감지
              │
              ▼
   ┌──────────────────────┐
   │ apiserver 정지        │
   │ (manifest 이동)       │
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ etcd 스냅샷 restore   │
   │ (신규 data-dir)       │
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ kubeadm / kubelet    │
   │ 이전 버전으로 다운그레│
   │ 이드 (apt install)    │
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ apiserver manifest    │
   │ 복귀 → 컴포넌트 기동  │
   └──────────┬───────────┘
              ▼
      kubectl get nodes
      (이전 버전 확인)
```

| 단계 | 명령 | 주의 |
|:---|:---|:---|
| 1. apiserver 정지 | `mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/` | Static Pod 중지 |
| 2. etcd 복원 | `etcdctl snapshot restore ... --data-dir=/var/lib/etcd-old` | 새 디렉토리 사용 |
| 3. 패키지 다운그레이드 | `apt-get install -y kubeadm=1.27.x-00 kubelet=1.27.x-00` | hold 재설정 |
| 4. apiserver 복귀 | `mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/` | 모든 CP 노드 |
| 5. 검증 | `kubectl get nodes`, `kubectl get pods -A` | 버전/상태 확인 |

## 9. 백업 대상

```text
┌──────────────────────────────────┐
│           백업 3 레이어           │
├─────────┬─────────┬──────────────┤
│ 리소스  │  etcd   │  영속 볼륨   │
│ 정의    │ 스냅샷  │  (PV)        │
├─────────┼─────────┼──────────────┤
│ YAML,   │ 클러스  │ PersistentV- │
│ Deploy, │ 터 상태 │ olume 데이터 │
│ Service,│ 전체,   │ DB, 파일,    │
│ CM,     │ Secret  │ 객체 스토리지│
│ Secret  │ 포함    │              │
└─────────┴─────────┴──────────────┘
```

## 10. 리소스 구성 백업

### 방법 1. Git 선언적 관리 (권장)

```text
repo/
├── namespaces/
├── deployments/
├── services/
├── configmaps/
└── secrets/  (암호화 필수)
```

버전 이력, 코드 리뷰, GitOps까지 한 번에 해결된다.

### 방법 2. API Server 추출

```bash
kubectl get all --all-namespaces -o yaml > all-resources.yaml

for ns in $(kubectl get ns -o jsonpath='{.items[*].metadata.name}'); do
  kubectl get all -n $ns -o yaml > backup-$ns.yaml
done
```

### 방법 3. Velero

```bash
velero install \
  --provider aws \
  --bucket my-backup-bucket \
  --secret-file ./credentials

velero backup create full-$(date +%F)
velero schedule create daily --schedule="0 2 * * *"
velero restore create --from-backup full-2026-04-22
```

## 11. etcd 스냅샷 백업과 복원

{{< callout type="warning" >}}
**etcd 백업은 선택이 아니라 필수**다. etcd가 손상되면 클러스터 상태(Deployment, Service, Secret 등)가 모두 사라진다. Git에 YAML이 있어도 실행 중인 Pod의 실제 상태와 일치한다는 보장이 없다. **자동화된 스냅샷 + 원격 저장소 보관**을 반드시 세팅한다.
{{< /callout >}}

### 11.1 스냅샷 저장

```bash
export ETCDCTL_API=3

etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

etcdctl snapshot status /backup/etcd-snapshot.db --write-out=table
```

```text
+----------+----------+------------+------------+
|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
+----------+----------+------------+------------+
| 3c5e7829 |   432156 |       1298 |     5.2 MB |
+----------+----------+------------+------------+
```

### 11.2 복원

```bash
# 1) apiserver 정지 (static pod)
mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/

# 2) 새 data-dir로 복원
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-restored

# 3) etcd manifest의 data-dir, volume hostPath 수정
#    /etc/kubernetes/manifests/etcd.yaml

# 4) 권한 설정
chown -R etcd:etcd /var/lib/etcd-restored

# 5) apiserver 복귀
mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/

# 6) 확인
kubectl get nodes
kubectl get pods -A
```

복원 시 주의:
- **새 data-dir을 사용**해 기존 클러스터와 충돌을 피한다.
- HA 구성이면 **모든 Control Plane 노드에서 동일 작업**을 수행한다.
- 복원은 새 클러스터로 초기화되므로 멤버 정보가 리셋된다.

### 11.3 자동화 스크립트

```bash
#!/bin/bash
# etcd-backup.sh
BACKUP_DIR="/backup/etcd"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/etcd-$TS.db"

mkdir -p "$BACKUP_DIR"
ETCDCTL_API=3 etcdctl snapshot save "$FILE" \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# 7일 이상 지난 파일 정리
find "$BACKUP_DIR" -name "etcd-*.db" -mtime +7 -delete
```

```bash
# crontab: 매일 새벽 2시
0 2 * * * /usr/local/bin/etcd-backup.sh >> /var/log/etcd-backup.log 2>&1
```

## 12. 백업 전략 비교

| 방법 | 장점 | 단점 | 권장 환경 |
|:---|:---|:---|:---|
| Git 기반 | 버전 관리, 협업 | 명령형 리소스 누락 | 모든 환경 |
| API 쿼리 | etcd 접근 불필요 | 일부 상태 누락 | 관리형 K8s (EKS 등) |
| etcd 스냅샷 | 완전한 클러스터 상태 | etcd 접근 필요 | 자체 관리 |
| Velero | PV까지 통합 | 별도 구축 비용 | 운영 환경 |

### 다층 백업 권장안

```text
┌────────────────────────────────┐
│   Layer 1. Git (YAML 정의)     │
│   - 모든 변경을 커밋            │
├────────────────────────────────┤
│   Layer 2. etcd 스냅샷          │
│   - 매일 자동, 7일 보관         │
├────────────────────────────────┤
│   Layer 3. Velero (운영)        │
│   - 매일 전체, 30일 보관        │
│   - PV 데이터 포함              │
└────────────────────────────────┘
```

## 13. 명령어 요약

```bash
# 노드 유지보수
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl cordon <node>
kubectl uncordon <node>
kubectl get nodes -o wide

# 업그레이드
kubeadm upgrade plan
kubeadm upgrade apply v1.28.0
kubeadm upgrade node

# 패키지 (apt)
apt-mark unhold kubeadm kubelet kubectl
apt-get install -y kubeadm=1.28.0-00 kubelet=1.28.0-00 kubectl=1.28.0-00
apt-mark hold kubeadm kubelet kubectl
systemctl daemon-reload && systemctl restart kubelet

# 리소스 백업
kubectl get all -A -o yaml > backup.yaml

# etcd 백업/복원
etcdctl snapshot save snap.db
etcdctl snapshot status snap.db --write-out=table
etcdctl snapshot restore snap.db --data-dir=/var/lib/etcd-new

# Velero
velero backup create my-backup
velero restore create --from-backup my-backup
```

## 핵심 정리

| 개념 | 설명 |
|:---|:---|
| cordon | 신규 스케줄만 차단, 기존 Pod 유지 |
| drain | cordon + 기존 Pod 축출 |
| eviction timeout | NotReady 후 Pod 퇴거 대기 (기본 5분) |
| Version Skew | apiserver 기준 ±1~2 Minor 허용 |
| 업그레이드 순서 | Control Plane → Worker, 한 Minor 씩 |
| etcd 백업 | 필수, 스냅샷 + 원격 보관 |
| 복원 원칙 | 새 data-dir, apiserver 정지 상태 |
| 다층 백업 | Git + etcd snapshot + Velero |

{{< callout type="info" >}}
**용어 정리**
- **Cordon**: 노드에 새 Pod가 스케줄되지 않도록 표시
- **Drain**: cordon 후 Pod를 다른 노드로 옮기는 작업
- **Eviction**: 스케줄러/컨트롤러가 Pod를 강제 종료·이전하는 동작
- **Version Skew**: 컴포넌트 간 허용되는 버전 차이 규칙
- **kubeadm**: 클러스터 부트스트랩·업그레이드 도구
- **etcd**: 쿠버네티스의 분산 키-값 저장소 (클러스터 상태 보관)
- **Snapshot**: 특정 시점의 etcd 상태를 파일로 저장한 것
- **Velero**: 쿠버네티스 리소스와 PV를 백업·복원하는 도구
- **Static Pod**: kubelet이 매니페스트 파일을 읽어 직접 띄우는 Pod
{{< /callout >}}
