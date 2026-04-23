---
title: "06. 스토리지"
weight: 6
---

## 1. 스토리지의 필요성

컨테이너는 기본적으로 **휘발성(ephemeral)** 이다. 컨테이너가 삭제되면 그 위에 쌓인 Container Layer도 함께 사라지고, Pod가 재스케줄되면 로그·DB 파일 등 모든 런타임 데이터가 증발한다. 쿠버네티스 스토리지는 이 휘발성을 극복하고 **상태(state)를 파드 바깥에 보관**하기 위한 추상화 계층이다.

### 컨테이너 레이어와 Copy-on-Write

```text
┌──────────────────────────┐
│ Container Layer (RW)     │ ← Pod 삭제 시 증발
│  - 런타임에 수정된 파일    │
├──────────────────────────┤
│ Image Layers (RO)        │ ← 이미지 공유
│  - ENTRYPOINT, 앱 코드    │
│  - 의존성, Base OS         │
└──────────────────────────┘
```

이미지는 **읽기 전용 레이어**의 스택이며 컨테이너에서 파일을 수정하면 Copy-on-Write로 컨테이너 레이어에 복사본이 생긴다. 이 복사본은 컨테이너 수명과 함께 사라진다.

{{< callout type="warning" >}}
Container Layer는 컨테이너 삭제 시 함께 삭제된다. MySQL·Redis 같은 Stateful 애플리케이션을 그대로 올리면 Pod 재시작 한 번에 전 데이터가 사라질 수 있다. **Volume** 추상화가 필요한 이유다.
{{< /callout >}}

### Stateful vs Stateless

| 구분 | Stateful | Stateless |
|:---|:---|:---|
| 데이터 | 영속 저장 필요 | 요청마다 완결 |
| 예시 | MySQL, Redis, Kafka | Nginx, API 서버 |
| 스케일링 | 신중 (동기화) | 자유로운 수평 확장 |
| 스토리지 | PV/PVC 필수 | emptyDir 정도로 충분 |

## 2. 볼륨 수명에 따른 분류

쿠버네티스 볼륨은 **파드·노드·클러스터** 중 어느 수명에 묶이는지에 따라 선택이 달라진다.

| 수명 범위 | 대표 타입 | 데이터 보존 | 용도 |
|:---|:---|:---|:---|
| 파드 수명 | emptyDir | 파드 삭제 시 소실 | 캐시, 컨테이너 간 공유 |
| 노드 수명 | hostPath | 노드 사고 시 소실 | 노드 로그, DaemonSet |
| 클러스터/외부 | PV + CSI | 영구 보존 | DB, 업로드 파일 |

```text
┌────────────────────────────┐
│         Worker Node        │
│  ┌──────────────────────┐  │
│  │ Pod                  │  │
│  │  └ emptyDir (휘발)    │  │
│  └──────────────────────┘  │
│                            │
│  hostPath (노드 수명)       │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  외부 스토리지 (EBS, NFS)    │
│  └ PersistentVolume (영구)  │
└────────────────────────────┘
```

### 2.1 emptyDir

**파드 생성 시점에 빈 디렉터리**로 만들어지고 파드 종료와 함께 사라진다. 같은 파드 내 컨테이너 간 데이터 공유에 유용하다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container
spec:
  containers:
  - name: writer
    image: busybox
    command: ["/bin/sh", "-c"]
    args: ["while true; do date >> /cache/log; sleep 5; done"]
    volumeMounts:
    - name: cache
      mountPath: /cache
  - name: reader
    image: busybox
    command: ["tail", "-f", "/cache/log"]
    volumeMounts:
    - name: cache
      mountPath: /cache
  volumes:
  - name: cache
    emptyDir:
      sizeLimit: 500Mi
      # medium: Memory   # RAM 기반 tmpfs
```

사용 사례: 중간 빌드 산출물, 임시 업로드 버퍼, 사이드카-메인 컨테이너 로그 릴레이.

### 2.2 hostPath

노드의 **로컬 파일시스템**을 파드에 직접 마운트한다. 파드가 삭제돼도 노드에 데이터가 남지만, 파드가 다른 노드로 재스케줄되면 접근이 불가능하다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: node-logger
spec:
  containers:
  - name: collector
    image: busybox
    volumeMounts:
    - name: host-logs
      mountPath: /logs
  volumes:
  - name: host-logs
    hostPath:
      path: /var/log
      type: Directory
```

**type 옵션**:

| Type | 의미 |
|:---|:---|
| `""` | 검사 없음 (기본) |
| DirectoryOrCreate | 없으면 생성 |
| Directory | 반드시 존재 |
| FileOrCreate / File | 파일 버전 |
| Socket | UNIX 소켓 |

{{< callout type="warning" >}}
**hostPath 보안 주의**: `/` 나 `/etc`, `/var/run/docker.sock` 같은 경로를 마운트하면 파드가 노드 전체를 장악할 수 있다. 프로덕션 멀티 노드 클러스터에서는 DaemonSet(로그 수집기, 모니터링)처럼 노드 자원 접근이 필수인 경우에만, 필요한 최소 경로만 마운트한다.
{{< /callout >}}

### 2.3 클라우드 / 네트워크 볼륨

PV 없이 파드에 직접 외부 스토리지를 붙이는 것도 가능하지만, 관리상 PV/PVC를 거치는 편이 표준이다.

```yaml
volumes:
- name: nfs-data
  nfs:
    server: 192.168.1.100
    path: /exports/data
- name: ebs-data
  awsElasticBlockStore:
    volumeID: vol-0123456789abcdef0
    fsType: ext4
```

## 3. PV / PVC 동작 원리

### 3.1 역할 분리

PV/PVC는 **관리자와 개발자의 관심사를 분리**하기 위한 추상화다.

```text
┌──────────────┐        ┌──────────────┐
│   관리자      │        │   개발자      │
│  스토리지 준비 │        │  용량 요청    │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
  ┌─────────┐  바인딩    ┌─────────┐
  │   PV    │◄──────────►│   PVC   │
  └─────────┘            └────┬────┘
                              │
                              ▼
                          ┌───────┐
                          │  Pod  │
                          └───────┘
```

- **PV (PersistentVolume)**: 클러스터 범위 리소스. 실제 백엔드 스토리지를 정의한다.
- **PVC (PersistentVolumeClaim)**: 네임스페이스 범위 리소스. 용량·접근 모드·StorageClass를 요청한다.

### 3.2 PV 정의

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql-pv
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/mysql-data
```

### 3.3 PVC 정의 및 Pod 사용

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: mysql
spec:
  containers:
  - name: mysql
    image: mysql:8.0
    volumeMounts:
    - name: data
      mountPath: /var/lib/mysql
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: mysql-pvc
```

### 3.4 바인딩 규칙

쿠버네티스는 다음 순서로 적합한 PV를 찾는다.

| 조건 | 설명 |
|:---|:---|
| 용량 | PV capacity ≥ PVC request |
| accessModes | PVC 요청 모드를 PV가 지원 |
| storageClassName | 문자열 완전 일치 |
| selector | PVC에 지정 시 라벨 매칭 |

- PV ↔ PVC는 **1:1 바인딩**. 10Gi PV에 5Gi PVC가 바인딩되면 나머지 5Gi는 버려진다.
- 매칭되는 PV가 없고 StorageClass도 없으면 PVC는 `Pending` 상태로 대기한다.

### 3.5 Access Modes

| 모드 | 약어 | 의미 |
|:---|:---|:---|
| ReadWriteOnce | RWO | 단일 **노드**에서 읽기/쓰기 |
| ReadOnlyMany | ROX | 여러 노드에서 읽기 전용 |
| ReadWriteMany | RWX | 여러 노드에서 읽기/쓰기 |
| ReadWriteOncePod | RWOP | 단일 **Pod**에서만 (K8s 1.22+) |

{{< callout type="warning" >}}
**ReadWriteOnce 오해**: RWO는 "하나의 Pod만" 이 아니라 "하나의 **Node**에서만" 이다. 같은 노드에 스케줄된 여러 Pod가 하나의 RWO PVC를 동시에 마운트할 수 있다. 정확히 1개 Pod로 제한하려면 **ReadWriteOncePod(RWOP)** 를 사용한다. EBS·Azure Disk 같은 블록 스토리지는 RWO만 지원하므로 다중 노드 공유가 필요하면 NFS·CephFS 같은 파일 스토리지를 골라야 한다.
{{< /callout >}}

### 3.6 Reclaim Policy 와 상태

| Policy | 동작 |
|:---|:---|
| Retain | PVC 삭제 후 PV·데이터 유지, 수동 정리 |
| Delete | PVC 삭제 시 PV와 백엔드 스토리지까지 삭제 |
| Recycle | `rm -rf` 후 재사용 (Deprecated) |

PV 상태 흐름: `Available → Bound → Released → (재활용 or Failed)`

```bash
kubectl get pv
# NAME    CAPACITY  ACCESS MODES  RECLAIM  STATUS  CLAIM
# mysql   20Gi      RWO           Retain   Bound   default/mysql-pvc
```

## 4. StorageClass와 동적 프로비저닝

정적 프로비저닝은 관리자가 PV를 미리 만들어 두는 방식이다. PVC가 늘어날수록 관리자 손이 많이 간다. **StorageClass**는 "이런 스펙의 PV를 필요할 때 자동으로 만들어라"라고 선언하는 템플릿이다.

```text
Static                    Dynamic
1. 관리자: 디스크 생성      1. 관리자: StorageClass 정의
2. 관리자: PV 작성         2. 사용자: PVC 생성
3. 사용자: PVC 생성        3. 자동: PV 생성 + 바인딩
4. 사용자: Pod에서 사용     4. 사용자: Pod에서 사용
```

### 4.1 StorageClass 정의

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

**volumeBindingMode**:

| Mode | 설명 |
|:---|:---|
| Immediate | PVC 생성 즉시 볼륨 프로비저닝 |
| WaitForFirstConsumer | Pod가 스케줄된 후 동일 AZ에 프로비저닝 |

### 4.2 주요 Provisioner

| 플랫폼 | Provisioner | Access Modes |
|:---|:---|:---|
| AWS EBS | ebs.csi.aws.com | RWO |
| Azure Disk | disk.csi.azure.com | RWO |
| GCP PD | pd.csi.storage.gke.io | RWO, ROX |
| NFS | nfs.csi.k8s.io | RWO/ROX/RWX |
| Longhorn | driver.longhorn.io | RWO/RWX |
| Local | kubernetes.io/no-provisioner | RWO |

### 4.3 기본 StorageClass

```bash
kubectl get sc

# 기본 StorageClass 지정
kubectl patch sc fast-ssd \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

PVC에서 `storageClassName`을 생략하면 기본 StorageClass가 적용된다. `storageClassName: ""`로 비우면 "동적 프로비저닝 비활성화"라는 뜻이 되어 정적 PV와만 바인딩된다.

## 5. CSI 아키텍처

과거 쿠버네티스는 스토리지 드라이버를 **소스 트리에 내장(in-tree)** 했다. 새 벤더가 추가되려면 쿠버네티스 릴리즈에 코드를 얹어야 했고, 업그레이드 속도와 보안이 스토리지 커뮤니티를 제약했다.

**Container Storage Interface (CSI)** 는 이 결합을 표준 gRPC 인터페이스로 분리한 규격이다. CRI·CNI와 함께 쿠버네티스의 3대 외부 인터페이스를 이룬다.

```text
표준 인터페이스
├─ CRI (Container Runtime)
│   └─ containerd, CRI-O
├─ CNI (Networking)
│   └─ Calico, Cilium, Flannel
└─ CSI (Storage)
    └─ EBS, Azure Disk, Ceph
```

### 5.1 CSI 3대 서비스

| 서비스 | 책임 | 대표 RPC |
|:---|:---|:---|
| Identity | 드라이버 자기 소개 | GetPluginInfo, Probe |
| Controller | 볼륨 생성/연결 | CreateVolume, ControllerPublishVolume |
| Node | 노드 마운트 | NodeStageVolume, NodePublishVolume |

### 5.2 볼륨 프로비저닝 흐름

```text
PVC 생성
   │
   ▼
CreateVolume  (Controller)
   │
   ▼
ControllerPublishVolume
   │   (노드에 attach)
   ▼
NodeStageVolume
   │   (글로벌 마운트)
   ▼
NodePublishVolume
   │   (Pod 마운트 지점)
   ▼
Pod 컨테이너에서 사용
```

분리 삭제 시에는 역순으로 `NodeUnpublish → NodeUnstage → ControllerUnpublish → DeleteVolume` 가 실행된다.

### 5.3 주요 CSI Driver

| Provider | Driver | 비고 |
|:---|:---|:---|
| AWS | ebs.csi.aws.com | gp3, io2 지원 |
| Azure | disk.csi.azure.com | Premium/Standard |
| GCP | pd.csi.storage.gke.io | Regional PD |
| Ceph | cephfs.csi.ceph.com | 분산 FS, RWX |
| Longhorn | driver.longhorn.io | 클라우드 네이티브 |
| Portworx | pxd.portworx.com | 엔터프라이즈 |

## 6. StatefulSet과 VolumeClaimTemplate

Deployment에 PVC를 연결하면 모든 레플리카가 같은 PVC를 공유한다. DB처럼 **복제본마다 독립적인 데이터**가 필요하면 `StatefulSet` 과 `volumeClaimTemplates` 을 쓴다.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        volumeMounts:
        - name: data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

StatefulSet은 Pod마다 `data-mysql-0`, `data-mysql-1`, `data-mysql-2` PVC를 생성하고, Pod가 재생성돼도 동일 이름으로 재마운트한다.

{{< callout type="info" >}}
**volumeClaimTemplate은 편리하지만 주의할 점**: StatefulSet을 삭제해도 생성된 PVC와 PV는 자동으로 삭제되지 않는다(데이터 보호용 기본값). K8s 1.27+에서는 `persistentVolumeClaimRetentionPolicy` 로 `whenDeleted: Delete`, `whenScaled: Retain` 같은 정책을 직접 정할 수 있다. 또 replicas를 줄이면 PVC는 남는다—스케일 인 시 정리 자동화가 필요하다.
{{< /callout >}}

## 7. 고급 기능

### 7.1 VolumeSnapshot

운영 중인 PVC를 스냅샷으로 찍고, 그 스냅샷에서 새 PVC를 복원할 수 있다.

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: mysql-snapshot
spec:
  volumeSnapshotClassName: csi-snapclass
  source:
    persistentVolumeClaimName: mysql-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-restore
spec:
  storageClassName: fast-ssd
  dataSource:
    name: mysql-snapshot
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
```

### 7.2 볼륨 확장

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: expandable
provisioner: ebs.csi.aws.com
allowVolumeExpansion: true
```

PVC의 `resources.requests.storage` 값을 늘리고 저장하면 온라인 확장이 일어난다. 파일시스템 확장까지 Pod 재시작 없이 처리되는 드라이버도 있지만, 보수적으로 Pod 재생성을 계획하는 편이 안전하다.

### 7.3 다중 볼륨 Pod

```yaml
volumes:
- name: config
  configMap:
    name: nginx-config
- name: cache
  emptyDir:
    medium: Memory
    sizeLimit: 256Mi
- name: data
  persistentVolumeClaim:
    claimName: web-content
```

ConfigMap·Secret 도 Volume 소스로 다뤄지며, tmpfs 캐시와 영속 데이터를 하나의 Pod 안에서 함께 쓰는 구성이 흔하다.

## 8. kubectl 명령어

```bash
# PV / PVC
kubectl get pv
kubectl get pvc -A
kubectl describe pvc my-pvc

# StorageClass
kubectl get sc
kubectl describe sc fast-ssd

# 바인딩 실패 디버깅
kubectl describe pvc pending-pvc    # Events 섹션 확인
kubectl get events --sort-by=.lastTimestamp

# Pod 내부 마운트 확인
kubectl exec -it mysql-0 -- df -h
kubectl exec -it mysql-0 -- mount | grep /var/lib/mysql
```

## 9. 실무 선택 가이드

### 9.1 용도별 권장 구성

| 시나리오 | 권장 |
|:---|:---|
| 컨테이너 간 임시 공유 | emptyDir |
| 캐시/RAM 디스크 | emptyDir + medium: Memory |
| 노드 로그/메트릭 수집 | hostPath (DaemonSet) |
| 단일 Pod DB (AWS) | StorageClass(gp3) + PVC |
| 클러스터형 DB (MySQL, Kafka) | StatefulSet + volumeClaimTemplates |
| 여러 파드 공용 파일 저장소 | NFS / CephFS (RWX) |
| 백업/복제 | VolumeSnapshot + 별도 StorageClass |

### 9.2 체크리스트

- [ ] 상태 유지가 필요한가? → PV/PVC 필수, StatefulSet 검토
- [ ] 여러 노드에서 동시 쓰기가 필요한가? → RWX 지원 스토리지(NFS, CephFS)
- [ ] 클라우드 환경인가? → StorageClass 기반 동적 프로비저닝
- [ ] 데이터 보존이 중요한가? → `reclaimPolicy: Retain` + 스냅샷 정책
- [ ] 확장 가능성이 있는가? → `allowVolumeExpansion: true`
- [ ] 보안 규정이 있는가? → encrypted StorageClass, Pod SecurityContext

## 10. 핵심 정리

| 개념 | 설명 |
|:---|:---|
| Volume | Pod 수준 스토리지 추상화 |
| emptyDir | 파드 수명 임시 볼륨 |
| hostPath | 노드 로컬 디스크 마운트 |
| PV | 클러스터 범위 실제 스토리지 |
| PVC | 네임스페이스 범위 스토리지 요청 |
| StorageClass | 동적 프로비저닝 템플릿 |
| CSI | 스토리지 표준 인터페이스 (gRPC) |
| StatefulSet | Pod별 고유 PVC (volumeClaimTemplates) |
| VolumeSnapshot | PVC 스냅샷/복원 |

{{< callout type="info" >}}
**용어 정리**
- **PV (PersistentVolume)**: 클러스터 범위 스토리지 리소스
- **PVC (PersistentVolumeClaim)**: 스토리지 요청 객체
- **StorageClass**: 스토리지 프로파일 + 동적 프로비저닝 템플릿
- **Provisioner**: StorageClass에 연결된 드라이버 식별자
- **Access Mode**: RWO, ROX, RWX, RWOP
- **Reclaim Policy**: Retain / Delete / Recycle(Deprecated)
- **CSI**: Container Storage Interface, 스토리지 플러그인 표준
- **VolumeClaimTemplate**: StatefulSet이 Pod별로 PVC를 찍어내는 템플릿
- **VolumeSnapshot**: PVC를 시점 복사해 보관하는 객체
- **volumeBindingMode**: Immediate / WaitForFirstConsumer
{{< /callout >}}
