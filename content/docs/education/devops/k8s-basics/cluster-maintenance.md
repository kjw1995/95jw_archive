---
title: "Cluster Maintenance"
weight: 5
---

클러스터 유지보수를 위한 노드 관리, 버전 업그레이드, 백업 및 복원 방법을 다룹니다.

---

## 1. 노드 유지보수 (OS Upgrades)

### 노드 다운 시 발생하는 상황

노드가 다운되면 해당 노드의 Pod들이 영향을 받습니다.

```
정상 상태:
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Node 1  │  │ Node 2  │  │ Node 3  │
│ [Pod A] │  │ [Pod A] │  │ [Pod B] │
│ [Pod C] │  │ [Pod B] │  │         │
└─────────┘  └─────────┘  └─────────┘

Node 2 다운 시:
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Node 1  │  │ Node 2  │  │ Node 3  │
│ [Pod A] │  │   ❌    │  │ [Pod B] │
│ [Pod C] │  │  DOWN   │  │         │
└─────────┘  └─────────┘  └─────────┘
     │                          │
     └── Pod A: 다른 노드에서 ──┘
         서비스 계속 제공

Pod B (ReplicaSet): 5분 후 다른 노드에 재생성
Pod C (단독 Pod): 영구 손실 위험!
```

### Pod Eviction Timeout

노드가 다운되면 Kubernetes는 일정 시간 대기 후 조치를 취합니다.

| 설정 | 기본값 | 설명 |
|:-----|:-------|:-----|
| `pod-eviction-timeout` | 5분 | 노드 NotReady 후 Pod 퇴거 대기 시간 |

**동작 순서**:
1. 노드 상태가 NotReady로 변경
2. 5분간 복구 대기
3. 복구 안 되면 해당 노드의 Pod 종료 처리
4. ReplicaSet/Deployment Pod는 다른 노드에 재생성
5. **단독 Pod는 영구 손실**

### Drain - 안전한 노드 비우기

유지보수 전 노드의 워크로드를 안전하게 이전합니다.

```bash
# 기본 drain
kubectl drain <node-name>

# DaemonSet 무시 (필수 옵션인 경우가 많음)
kubectl drain <node-name> --ignore-daemonsets

# 로컬 데이터가 있는 Pod도 강제 삭제
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# ReplicaSet/DaemonSet이 아닌 Pod도 강제 삭제
kubectl drain <node-name> --ignore-daemonsets --force
```

**Drain 동작**:
1. 노드를 **SchedulingDisabled** (Cordon) 상태로 변경
2. 노드의 Pod를 **gracefully 종료**
3. ReplicaSet/Deployment Pod는 다른 노드에 **재생성**

```
Drain 전:                    Drain 후:
┌─────────┐                  ┌─────────┐
│ Node 1  │                  │ Node 1  │
│ [Pod A] │    drain         │ 비어있음 │
│ [Pod B] │  ─────────▶      │CordonedX│
└─────────┘                  └─────────┘
                                  │
┌─────────┐                  ┌─────────┐
│ Node 2  │                  │ Node 2  │
│ [Pod C] │                  │ [Pod A] │
│         │                  │ [Pod B] │
└─────────┘                  │ [Pod C] │
                             └─────────┘
```

### Cordon - 스케줄링만 차단

새 Pod 스케줄링을 차단하지만 기존 Pod는 유지합니다.

```bash
# 새 Pod 스케줄링 차단
kubectl cordon <node-name>

# 스케줄링 차단 해제
kubectl uncordon <node-name>
```

**Cordon vs Drain**:

| 명령어 | 기존 Pod | 새 Pod 스케줄링 |
|:-------|:---------|:----------------|
| `cordon` | 유지 | 차단 |
| `drain` | 이전 | 차단 |
| `uncordon` | 유지 | 허용 |

### 유지보수 완료 후 복구

```bash
# 노드 유지보수 완료 후
kubectl uncordon <node-name>
```

**주의**:
- 기존에 이전된 Pod들은 **자동으로 돌아오지 않음**
- 노드가 Schedulable 상태가 되어 새 Pod만 스케줄링 가능

### 노드 상태 확인

```bash
# 노드 상태 확인
kubectl get nodes

# 출력 예시
NAME     STATUS                     ROLES    AGE   VERSION
node-1   Ready                      master   10d   v1.28.0
node-2   Ready,SchedulingDisabled   worker   10d   v1.28.0
node-3   Ready                      worker   10d   v1.28.0
```

---

## 2. Kubernetes 버전 체계

### 버전 번호 구조

```
v1.28.3
 │  │  │
 │  │  └── Patch Version (버그 수정)
 │  └───── Minor Version (새 기능)
 └──────── Major Version (주요 변경)
```

| 버전 유형 | 주기 | 내용 |
|:----------|:-----|:-----|
| Major | 드물게 | 주요 아키텍처 변경 |
| Minor | 약 4개월 | 새 기능, API 추가 |
| Patch | 수시 | 버그/보안 수정 |

### 릴리스 단계

```
Alpha ────▶ Beta ────▶ Stable (GA)

v1.28.0-alpha.1    불안정, 기본 비활성화
v1.28.0-beta.1     테스트됨, 기본 활성화
v1.28.0            안정 버전, 운영 환경 사용
```

| 단계 | 안정성 | 기본 활성화 | 용도 |
|:-----|:-------|:-----------|:-----|
| Alpha | 낮음 | X | 개발/실험 |
| Beta | 중간 | O | 테스트 |
| Stable | 높음 | O | 운영 |

### 버전 지원 정책

Kubernetes는 **최신 3개 Minor 버전만 지원**합니다.

```
현재 최신: v1.28
지원 버전: v1.28, v1.27, v1.26
지원 종료: v1.25 이하

v1.29 릴리스 시:
지원 버전: v1.29, v1.28, v1.27
지원 종료: v1.26 이하
```

### 버전 확인

```bash
# 클러스터 버전 확인
kubectl version

# 노드별 버전 확인
kubectl get nodes

# 컴포넌트별 버전 확인
kubectl get pods -n kube-system -o custom-columns=\
'NAME:.metadata.name,IMAGE:.spec.containers[*].image'
```

---

## 3. 컴포넌트 버전 호환성

### 버전 스큐 정책 (Version Skew Policy)

kube-apiserver를 기준으로 다른 컴포넌트의 허용 버전 범위가 정해집니다.

```
kube-apiserver (기준: X)
        │
        ├── kube-controller-manager: X, X-1
        ├── kube-scheduler:          X, X-1
        ├── cloud-controller-manager: X, X-1
        │
        ├── kubelet:     X, X-1, X-2
        ├── kube-proxy:  X, X-1, X-2
        │
        └── kubectl:     X+1, X, X-1
```

**예시** (kube-apiserver가 1.28인 경우):

| 컴포넌트 | 허용 버전 |
|:---------|:----------|
| kube-apiserver | 1.28 |
| controller-manager | 1.28, 1.27 |
| scheduler | 1.28, 1.27 |
| kubelet | 1.28, 1.27, 1.26 |
| kube-proxy | 1.28, 1.27, 1.26 |
| kubectl | 1.29, 1.28, 1.27 |

### 외부 컴포넌트 버전

etcd와 CoreDNS는 **독립적인 버전 체계**를 가집니다.

```bash
# etcd 버전 확인
kubectl exec -n kube-system etcd-master -- etcd --version

# CoreDNS 버전 확인
kubectl get pods -n kube-system -l k8s-app=kube-dns -o yaml | grep image:
```

각 Kubernetes 릴리스 노트에서 **호환 버전**을 확인해야 합니다.

---

## 4. 클러스터 업그레이드 프로세스

### 업그레이드 원칙

1. **한 번에 한 Minor 버전씩** 업그레이드
2. **Control Plane 먼저**, Worker Node 나중에
3. **백업 필수** (etcd, 리소스 정의)

```
올바른 업그레이드 경로:
1.26 → 1.27 → 1.28 → 1.29

잘못된 업그레이드:
1.26 → 1.29 (건너뛰기 금지!)
```

### 업그레이드 전략

#### 전략 1: 모든 노드 동시 업그레이드

```
[Node 1 v1.27] [Node 2 v1.27] [Node 3 v1.27]
        │            │            │
        ▼            ▼            ▼
        ===== 다운타임 발생 =====
        │            │            │
        ▼            ▼            ▼
[Node 1 v1.28] [Node 2 v1.28] [Node 3 v1.28]
```

- 장점: 빠른 업그레이드
- 단점: **서비스 중단 발생**

#### 전략 2: 순차적 업그레이드 (Rolling)

```
단계 1: Node 1 drain & upgrade
[Node 1 upgrading] [Node 2 v1.27] [Node 3 v1.27]
                        └─ 워크로드 수용 ─┘

단계 2: Node 2 drain & upgrade
[Node 1 v1.28] [Node 2 upgrading] [Node 3 v1.27]
       └─ 워크로드 수용 ─────────────┘

단계 3: Node 3 drain & upgrade
[Node 1 v1.28] [Node 2 v1.28] [Node 3 v1.28]
```

- 장점: **무중단 서비스**
- 단점: 시간이 더 소요

#### 전략 3: 새 노드 교체 방식

```
단계 1: 새 노드 추가
[Node 1 v1.27] [Node 2 v1.27] [Node 3 v1.27] [Node 4 v1.28]

단계 2: 워크로드 이전 & 기존 노드 제거
[Node 4 v1.28] [Node 5 v1.28] [Node 6 v1.28]
```

- 장점: 가장 안전, 롤백 용이
- 단점: 추가 인프라 비용

### kubeadm을 사용한 업그레이드

#### 1단계: 업그레이드 계획 확인

```bash
# 업그레이드 가능 버전 확인
kubeadm upgrade plan
```

#### 2단계: Control Plane 노드 업그레이드

```bash
# 1. kubeadm 업그레이드
apt-mark unhold kubeadm
apt-get update
apt-get install -y kubeadm=1.28.0-00
apt-mark hold kubeadm

# 2. 버전 확인
kubeadm version

# 3. 클러스터 업그레이드 (첫 번째 Control Plane 노드)
kubeadm upgrade apply v1.28.0

# 추가 Control Plane 노드의 경우
kubeadm upgrade node

# 4. 노드 drain
kubectl drain <control-plane-node> --ignore-daemonsets

# 5. kubelet, kubectl 업그레이드
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.28.0-00 kubectl=1.28.0-00
apt-mark hold kubelet kubectl

# 6. kubelet 재시작
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# 7. 노드 uncordon
kubectl uncordon <control-plane-node>
```

#### 3단계: Worker 노드 업그레이드

```bash
# 각 Worker 노드에서 실행:

# 1. 노드 drain (Control Plane에서 실행)
kubectl drain <worker-node> --ignore-daemonsets --delete-emptydir-data

# 2. kubeadm 업그레이드
apt-mark unhold kubeadm
apt-get update
apt-get install -y kubeadm=1.28.0-00
apt-mark hold kubeadm

# 3. 노드 구성 업그레이드
kubeadm upgrade node

# 4. kubelet 업그레이드
apt-mark unhold kubelet
apt-get install -y kubelet=1.28.0-00
apt-mark hold kubelet

# 5. kubelet 재시작
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# 6. 노드 uncordon (Control Plane에서 실행)
kubectl uncordon <worker-node>
```

#### 업그레이드 검증

```bash
# 모든 노드 버전 확인
kubectl get nodes

# 컴포넌트 상태 확인
kubectl get pods -n kube-system

# 클러스터 상태 확인
kubectl cluster-info
```

---

## 5. 백업 대상

클러스터 백업 시 고려해야 할 세 가지 영역:

```
┌──────────────────────────────────────────────────────────┐
│                     백업 대상                             │
├──────────────────┬───────────────────┬───────────────────┤
│   리소스 구성     │      etcd         │   영구 스토리지    │
│ ──────────────── │ ───────────────── │ ───────────────── │
│ Deployments      │ 클러스터 상태      │ PersistentVolume │
│ Services         │ 모든 K8s 오브젝트  │ 애플리케이션 데이터│
│ ConfigMaps       │ Secret 데이터     │ 데이터베이스      │
│ Secrets          │ 설정 정보         │ 파일 스토리지     │
└──────────────────┴───────────────────┴───────────────────┘
```

---

## 6. 리소스 구성 백업

### 방법 1: 선언적 정의 파일 관리 (권장)

YAML 파일을 Git 저장소에서 버전 관리합니다.

```
repository/
├── namespaces/
│   ├── production.yaml
│   └── staging.yaml
├── deployments/
│   ├── frontend.yaml
│   └── backend.yaml
├── services/
│   ├── frontend-svc.yaml
│   └── backend-svc.yaml
└── configmaps/
    └── app-config.yaml
```

**장점**:
- 버전 이력 관리
- 코드 리뷰 가능
- 재배포 용이
- GitOps 파이프라인 구축 가능

### 방법 2: API Server에서 추출

명령형으로 생성된 리소스도 포함하여 백업합니다.

```bash
# 모든 리소스 백업
kubectl get all --all-namespaces -o yaml > all-resources.yaml

# 특정 리소스 타입별 백업
kubectl get deployments --all-namespaces -o yaml > deployments.yaml
kubectl get services --all-namespaces -o yaml > services.yaml
kubectl get configmaps --all-namespaces -o yaml > configmaps.yaml
kubectl get secrets --all-namespaces -o yaml > secrets.yaml
kubectl get pv -o yaml > persistent-volumes.yaml
kubectl get pvc --all-namespaces -o yaml > persistent-volume-claims.yaml

# Namespace별 백업
for ns in $(kubectl get ns -o jsonpath='{.items[*].metadata.name}'); do
  kubectl get all -n $ns -o yaml > backup-$ns.yaml
done
```

### 방법 3: Velero 사용 (권장)

Velero(구 Ark)는 Kubernetes 리소스와 PV를 모두 백업할 수 있습니다.

```bash
# Velero 설치
velero install \
  --provider aws \
  --bucket my-bucket \
  --secret-file ./credentials

# 백업 생성
velero backup create my-backup

# 특정 네임스페이스만 백업
velero backup create my-backup --include-namespaces production

# 스케줄 백업 생성 (매일 자정)
velero schedule create daily-backup --schedule="0 0 * * *"

# 백업 목록 확인
velero backup get

# 복원
velero restore create --from-backup my-backup
```

---

## 7. etcd 백업 및 복원

### etcd 데이터 위치

```bash
# etcd Pod에서 데이터 디렉토리 확인
kubectl describe pod etcd-master -n kube-system | grep data-dir
# --data-dir=/var/lib/etcd
```

### etcd 스냅샷 백업

```bash
# 환경 변수 설정 (인증 정보)
export ETCDCTL_API=3
export ETCD_ENDPOINTS="https://127.0.0.1:2379"
export ETCD_CACERT="/etc/kubernetes/pki/etcd/ca.crt"
export ETCD_CERT="/etc/kubernetes/pki/etcd/server.crt"
export ETCD_KEY="/etc/kubernetes/pki/etcd/server.key"

# 스냅샷 저장
etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=$ETCD_ENDPOINTS \
  --cacert=$ETCD_CACERT \
  --cert=$ETCD_CERT \
  --key=$ETCD_KEY

# 스냅샷 상태 확인
etcdctl snapshot status /backup/etcd-snapshot.db --write-out=table
```

**출력 예시**:
```
+----------+----------+------------+------------+
|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
+----------+----------+------------+------------+
| 3c5e7829 |   432156 |       1298 |     5.2 MB |
+----------+----------+------------+------------+
```

### etcd 복원

```bash
# 1. kube-apiserver 중지
# Static Pod의 경우 매니페스트 이동
mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/

# 2. etcd 복원 (새 데이터 디렉토리로)
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-restored \
  --endpoints=$ETCD_ENDPOINTS \
  --cacert=$ETCD_CACERT \
  --cert=$ETCD_CERT \
  --key=$ETCD_KEY

# 3. etcd 설정 업데이트 (Static Pod의 경우)
# /etc/kubernetes/manifests/etcd.yaml에서 data-dir 경로 변경
# volumes와 volumeMounts의 hostPath도 변경

# 4. 디렉토리 소유권 설정
chown -R etcd:etcd /var/lib/etcd-restored

# 5. kube-apiserver 재시작
mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/

# 6. 복원 확인
kubectl get nodes
kubectl get pods --all-namespaces
```

### etcd 복원 시 주의사항

1. **새 데이터 디렉토리 사용**: 기존 클러스터와의 충돌 방지
2. **클러스터 멤버 정보 초기화**: 복원 시 새 클러스터로 초기화됨
3. **모든 Control Plane 노드에서 동일 작업**: HA 구성의 경우

### 자동화된 백업 스크립트 예시

```bash
#!/bin/bash
# etcd-backup.sh

BACKUP_DIR="/backup/etcd"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/etcd-snapshot-$TIMESTAMP.db"

# 인증 정보
ETCDCTL_API=3
ETCD_ENDPOINTS="https://127.0.0.1:2379"
ETCD_CACERT="/etc/kubernetes/pki/etcd/ca.crt"
ETCD_CERT="/etc/kubernetes/pki/etcd/server.crt"
ETCD_KEY="/etc/kubernetes/pki/etcd/server.key"

# 디렉토리 생성
mkdir -p $BACKUP_DIR

# 스냅샷 생성
etcdctl snapshot save $BACKUP_FILE \
  --endpoints=$ETCD_ENDPOINTS \
  --cacert=$ETCD_CACERT \
  --cert=$ETCD_CERT \
  --key=$ETCD_KEY

# 오래된 백업 삭제 (7일 이상)
find $BACKUP_DIR -name "etcd-snapshot-*.db" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

**cron 설정**:
```bash
# 매일 새벽 2시 백업
0 2 * * * /usr/local/bin/etcd-backup.sh >> /var/log/etcd-backup.log 2>&1
```

---

## 8. 백업 전략 비교

| 방법 | 장점 | 단점 | 권장 환경 |
|:-----|:-----|:-----|:----------|
| **Git 기반** | 버전 관리, 협업 용이 | 명령형 생성 리소스 누락 | 모든 환경 |
| **API 쿼리** | etcd 접근 불필요 | 일부 상태 정보 누락 | 관리형 K8s |
| **etcd 스냅샷** | 완전한 클러스터 상태 | etcd 접근 권한 필요 | 자체 관리 |
| **Velero** | 통합 솔루션, PV 포함 | 추가 설정 필요 | 운영 환경 |

### 권장 백업 전략

```
┌─────────────────────────────────────────────────────────┐
│                  다층 백업 전략                          │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Git 저장소                                     │
│   - 모든 YAML 정의 파일 버전 관리                        │
│   - 변경 시마다 커밋                                     │
├─────────────────────────────────────────────────────────┤
│ Layer 2: etcd 스냅샷 (자체 관리 클러스터)                │
│   - 매일 자동 백업                                       │
│   - 7일치 보관                                          │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Velero (운영 환경)                             │
│   - 매일 전체 백업                                       │
│   - 30일치 보관                                         │
│   - PV 데이터 포함                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 명령어 요약

```bash
# 노드 유지보수
kubectl drain <node> --ignore-daemonsets
kubectl cordon <node>
kubectl uncordon <node>
kubectl get nodes

# 버전 확인
kubectl version
kubectl get nodes -o wide

# 업그레이드 (kubeadm)
kubeadm upgrade plan
kubeadm upgrade apply v1.28.0
kubeadm upgrade node

# 패키지 관리 (apt)
apt-mark unhold kubeadm kubelet kubectl
apt-get install -y kubeadm=1.28.0-00 kubelet=1.28.0-00 kubectl=1.28.0-00
apt-mark hold kubeadm kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet

# 리소스 백업
kubectl get all --all-namespaces -o yaml > backup.yaml

# etcd 백업/복원
etcdctl snapshot save snapshot.db
etcdctl snapshot status snapshot.db
etcdctl snapshot restore snapshot.db --data-dir=/var/lib/etcd-new

# Velero
velero backup create my-backup
velero backup get
velero restore create --from-backup my-backup
```
