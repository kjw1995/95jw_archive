---
title: "Storage"
weight: 7
---

Kubernetes 스토리지 시스템의 개념과 실전 활용법을 다룹니다.

---

## 1. 컨테이너 스토리지 기초

### 1.1 Docker 레이어드 아키텍처

Docker 이미지는 **읽기 전용 레이어**의 스택으로 구성됩니다.

```
이미지 빌드 과정:
┌─────────────────────────────────┐
│ Layer 5: ENTRYPOINT (설정)       │ ← 읽기 전용
├─────────────────────────────────┤
│ Layer 4: COPY app.py (소스코드)  │ ← 읽기 전용
├─────────────────────────────────┤
│ Layer 3: pip install (의존성)    │ ← 읽기 전용
├─────────────────────────────────┤
│ Layer 2: apt-get (시스템 패키지) │ ← 읽기 전용
├─────────────────────────────────┤
│ Layer 1: Ubuntu Base (OS)       │ ← 읽기 전용
└─────────────────────────────────┘
```

**레이어 공유의 장점:**

```
App 1 이미지         App 2 이미지
┌──────────────┐    ┌──────────────┐
│ App1 Code    │    │ App2 Code    │
├──────────────┤    ├──────────────┤
│ Python Deps  │←──→│ (공유)       │
├──────────────┤    ├──────────────┤
│ Ubuntu Base  │←──→│ (공유)       │
└──────────────┘    └──────────────┘

→ 디스크 공간 절약 + 빌드 시간 단축
```

### 1.2 읽기/쓰기 레이어 (Container Layer)

컨테이너 실행 시 **Copy-on-Write** 방식으로 파일을 수정합니다.

```
컨테이너 실행 구조:
┌─────────────────────────────────┐
│ Container Layer (읽기/쓰기)      │ ← 컨테이너별 독립
│ - 런타임 데이터                   │
│ - 수정된 파일의 복사본            │
├─────────────────────────────────┤
│ Image Layers (읽기 전용)         │ ← 모든 컨테이너 공유
│ - 변경 불가                      │
│ - docker build로만 수정          │
└─────────────────────────────────┘
```

**Copy-on-Write 동작:**

```bash
# 원본 파일: 이미지 레이어에 존재
/app/config.yaml  (읽기 전용)

# 컨테이너에서 수정 시도
echo "new: value" >> /app/config.yaml

# 실제 동작:
# 1. /app/config.yaml을 Container Layer로 복사
# 2. 복사본을 수정
# 3. 원본은 그대로 유지
```

{{< callout type="warning" >}}
**핵심 문제:** Container Layer는 컨테이너 삭제 시 함께 삭제됩니다. 데이터 영속성을 위해서는 **Volume**이 필요합니다.
{{< /callout >}}

### 1.3 Docker Volume

```bash
# 볼륨 생성
docker volume create data_volume

# 볼륨 마운트 (Volume Mount)
docker run -v data_volume:/var/lib/mysql mysql

# 호스트 경로 마운트 (Bind Mount)
docker run -v /data/mysql:/var/lib/mysql mysql

# 최신 문법 (--mount)
docker run --mount type=volume,source=data_volume,target=/var/lib/mysql mysql
docker run --mount type=bind,source=/data/mysql,target=/var/lib/mysql mysql
```

**Volume Mount vs Bind Mount:**

| 구분 | Volume Mount | Bind Mount |
|:-----|:-------------|:-----------|
| 경로 | Docker 관리 (`/var/lib/docker/volumes/`) | 사용자 지정 |
| 관리 | Docker가 생명주기 관리 | 수동 관리 |
| 이식성 | 높음 | 낮음 |
| 용도 | 데이터베이스, 영속 데이터 | 개발 환경, 설정 파일 |

### 1.4 Storage Driver vs Volume Driver

```
┌──────────────────────────────────────────────────────────┐
│                    Storage Driver                         │
│  - 이미지/컨테이너 레이어 관리                              │
│  - Copy-on-Write 구현                                      │
│  - 종류: overlay2, aufs, devicemapper, btrfs, zfs        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    Volume Driver                          │
│  - 볼륨(데이터 영속성) 관리                                 │
│  - 외부 스토리지 연동                                       │
│  - 종류: local, rexray/ebs, azure-file, portworx         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Container Storage Interface (CSI)

### 2.1 CSI 등장 배경

```
Kubernetes 표준 인터페이스:
├── CRI (Container Runtime Interface)
│   └── Docker, containerd, CRI-O
├── CNI (Container Networking Interface)
│   └── Calico, Flannel, Weave
└── CSI (Container Storage Interface)
    └── EBS, Azure Disk, Ceph, Longhorn
```

**CSI 이전의 문제:**
- 스토리지 드라이버가 Kubernetes 소스코드에 내장
- 새로운 스토리지 추가 시 Kubernetes 수정 필요
- 릴리즈 주기에 종속

**CSI의 해결:**
- 표준 인터페이스로 분리
- 벤더별 독립적 개발/배포
- 다양한 오케스트레이션 도구 지원

### 2.2 CSI 아키텍처

```
CSI 핵심 서비스:
┌────────────────────────────────────────────┐
│ Identity Service                            │
│ - GetPluginInfo: 드라이버 정보               │
│ - GetPluginCapabilities: 지원 기능           │
│ - Probe: 상태 확인                           │
├────────────────────────────────────────────┤
│ Controller Service                          │
│ - CreateVolume / DeleteVolume               │
│ - ControllerPublishVolume (노드에 연결)       │
│ - ControllerUnpublishVolume (노드에서 분리)   │
├────────────────────────────────────────────┤
│ Node Service                                │
│ - NodeStageVolume (노드 준비)                │
│ - NodePublishVolume (파드에 마운트)           │
│ - NodeUnpublishVolume (언마운트)             │
└────────────────────────────────────────────┘
```

### 2.3 CSI 볼륨 생성 워크플로우

```
PVC 생성 → CreateVolume → ControllerPublishVolume
                              ↓
Pod 스케줄링 → NodeStageVolume → NodePublishVolume
                                      ↓
                              Pod에 볼륨 마운트 완료
```

### 2.4 주요 CSI Driver

| Provider | CSI Driver | 특징 |
|:---------|:-----------|:-----|
| AWS | ebs.csi.aws.com | EBS 블록 스토리지 |
| Azure | disk.csi.azure.com | Azure Managed Disk |
| GCP | pd.csi.storage.gke.io | Persistent Disk |
| Ceph | cephfs.csi.ceph.com | 분산 파일 시스템 |
| Longhorn | driver.longhorn.io | 클라우드 네이티브 |
| Portworx | pxd.portworx.com | 엔터프라이즈급 |

---

## 3. Kubernetes Volumes

### 3.1 데이터 영속성 문제

```yaml
# 문제 상황: 데이터 손실
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: processor
    image: alpine
    command: ["/bin/sh", "-c"]
    args: ["shuf -i 1-100 -n 1 >> /opt/result.txt; sleep 3600"]
    # Pod 삭제 시 /opt/result.txt 손실
```

### 3.2 hostPath Volume

**단일 노드 환경에서만 사용:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: processor
    image: alpine
    command: ["/bin/sh", "-c"]
    args: ["shuf -i 1-100 -n 1 >> /opt/result.txt; sleep 3600"]
    volumeMounts:
    - name: data-volume
      mountPath: /opt
  volumes:
  - name: data-volume
    hostPath:
      path: /data
      type: DirectoryOrCreate
```

**hostPath type 옵션:**

| Type | 설명 |
|:-----|:-----|
| DirectoryOrCreate | 없으면 생성 (권한: 0755) |
| Directory | 반드시 존재해야 함 |
| FileOrCreate | 파일 없으면 생성 |
| File | 반드시 존재해야 함 |
| Socket | Unix 소켓 |

{{< callout type="warning" >}}
**hostPath 한계:** 멀티 노드 환경에서는 Pod가 다른 노드로 스케줄링되면 데이터에 접근할 수 없습니다.
{{< /callout >}}

### 3.3 emptyDir Volume

**Pod 수명 동안만 유지되는 임시 볼륨:**

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
    args: ["while true; do date >> /cache/timestamp.log; sleep 5; done"]
    volumeMounts:
    - name: cache
      mountPath: /cache
  - name: reader
    image: busybox
    command: ["/bin/sh", "-c"]
    args: ["tail -f /cache/timestamp.log"]
    volumeMounts:
    - name: cache
      mountPath: /cache
  volumes:
  - name: cache
    emptyDir:
      sizeLimit: 500Mi  # 크기 제한
      # medium: Memory  # RAM 기반 (tmpfs)
```

**emptyDir 사용 사례:**
- 컨테이너 간 파일 공유
- 빌드/컴파일 임시 파일
- 캐시 데이터

### 3.4 클라우드 스토리지 Volume

```yaml
# AWS EBS
volumes:
- name: aws-volume
  awsElasticBlockStore:
    volumeID: vol-0123456789abcdef0
    fsType: ext4

# Azure Disk
volumes:
- name: azure-volume
  azureDisk:
    diskName: myDataDisk
    diskURI: /subscriptions/.../myDataDisk

# GCP Persistent Disk
volumes:
- name: gcp-volume
  gcePersistentDisk:
    pdName: my-data-disk
    fsType: ext4

# NFS
volumes:
- name: nfs-volume
  nfs:
    server: nfs-server.example.com
    path: /exports/data
```

---

## 4. Persistent Volume (PV)

### 4.1 PV 개념

**기존 방식의 문제:**

```yaml
# 모든 Pod에 스토리지 설정 반복
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  volumes:
  - name: data
    awsElasticBlockStore:    # 매번 설정 필요
      volumeID: vol-xxx
      fsType: ext4
```

**PV 도입으로 해결:**

```
역할 분리:
├── 관리자: PV 생성 (스토리지 풀 프로비저닝)
└── 사용자: PVC 생성 (필요한 만큼 요청)
```

### 4.2 PV 생성

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-volume
  labels:
    type: local
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
```

**Access Modes:**

| Mode | 약어 | 설명 |
|:-----|:-----|:-----|
| ReadWriteOnce | RWO | 단일 노드에서 읽기/쓰기 |
| ReadOnlyMany | ROX | 여러 노드에서 읽기 전용 |
| ReadWriteMany | RWX | 여러 노드에서 읽기/쓰기 |
| ReadWriteOncePod | RWOP | 단일 Pod에서만 읽기/쓰기 (K8s 1.22+) |

**Reclaim Policy:**

| Policy | 동작 |
|:-------|:-----|
| Retain | PVC 삭제 후 PV 유지 (수동 삭제 필요) |
| Delete | PVC 삭제 시 PV와 스토리지 자동 삭제 |
| Recycle | 데이터 삭제 후 재사용 (deprecated) |

### 4.3 클라우드 스토리지 PV 예시

```yaml
# AWS EBS PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: aws-ebs-pv
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: gp3
  awsElasticBlockStore:
    volumeID: vol-0123456789abcdef0
    fsType: ext4
---
# NFS PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany  # NFS는 RWX 지원
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100
    path: /exports/data
```

---

## 5. Persistent Volume Claim (PVC)

### 5.1 PVC 개념

```
PV와 PVC의 관계:
┌────────────────────────────────────────────┐
│                PV (관리자 생성)              │
│  - 실제 스토리지 정의                        │
│  - 클러스터 전체 리소스                       │
└────────────────────────────────────────────┘
         ↑ 바인딩 (1:1 관계)
┌────────────────────────────────────────────┐
│               PVC (사용자 생성)              │
│  - 스토리지 요청 명세                        │
│  - 네임스페이스 리소스                        │
└────────────────────────────────────────────┘
```

### 5.2 PVC 생성

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
  # selector:  # 특정 PV 선택 (선택적)
  #   matchLabels:
  #     type: local
```

### 5.3 바인딩 프로세스

```
Kubernetes의 자동 매칭:
1. 요청 용량 확인 (sufficient capacity)
2. Access Mode 일치 확인
3. Storage Class 확인
4. Selector/Label 확인 (설정된 경우)

바인딩 규칙:
- 하나의 PVC는 하나의 PV에만 바인딩 (1:1)
- 작은 PVC도 큰 PV에 바인딩 가능 (남은 용량 사용 불가)
- 매칭되는 PV 없으면 Pending 상태 유지
```

**바인딩 예시:**

```yaml
# PV: 10Gi, RWO, manual class
# PVC: 5Gi 요청, RWO, manual class
# 결과: 바인딩 성공 (5Gi 사용, 5Gi 낭비)
```

### 5.4 Pod에서 PVC 사용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: web-storage
      mountPath: /usr/share/nginx/html
  volumes:
  - name: web-storage
    persistentVolumeClaim:
      claimName: my-pvc
```

### 5.5 PV/PVC 상태

```bash
# PV 상태
kubectl get pv
# STATUS: Available → Bound → Released

# PVC 상태
kubectl get pvc
# STATUS: Pending → Bound

# 상세 정보
kubectl describe pv pv-volume
kubectl describe pvc my-pvc
```

---

## 6. Storage Class (동적 프로비저닝)

### 6.1 Static vs Dynamic Provisioning

```
Static Provisioning (수동):
1. 관리자: 클라우드에서 디스크 생성
2. 관리자: PV 정의 파일 작성
3. 사용자: PVC 생성 → PV 바인딩
4. 사용자: Pod에서 PVC 사용

Dynamic Provisioning (자동):
1. 관리자: StorageClass 정의
2. 사용자: PVC 생성 (storageClassName 지정)
3. 자동: 스토리지 생성 → PV 생성 → 바인딩
```

### 6.2 StorageClass 생성

```yaml
# 기본 StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-standard
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
---
# 고성능 StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

**volumeBindingMode:**

| Mode | 설명 |
|:-----|:-----|
| Immediate | PVC 생성 즉시 볼륨 프로비저닝 |
| WaitForFirstConsumer | Pod 스케줄링 시점에 프로비저닝 (토폴로지 고려) |

### 6.3 주요 Provisioner

| 클라우드 | Provisioner | 비고 |
|:---------|:------------|:-----|
| AWS EBS | ebs.csi.aws.com | CSI 권장 |
| Azure Disk | disk.csi.azure.com | CSI 권장 |
| GCP PD | pd.csi.storage.gke.io | CSI 권장 |
| NFS | nfs.csi.k8s.io | 동적 프로비저닝 |
| Longhorn | driver.longhorn.io | 오픈소스 |
| Portworx | pxd.portworx.com | 엔터프라이즈 |

### 6.4 StorageClass별 파라미터 예시

```yaml
# AWS EBS CSI
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
---
# Azure Disk CSI
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-premium
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
  kind: Managed
reclaimPolicy: Delete
---
# Local Path (개발용)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

### 6.5 PVC에서 StorageClass 사용

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: database-pvc
spec:
  storageClassName: fast-ssd  # StorageClass 지정
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

### 6.6 기본 StorageClass 설정

```bash
# 기본 StorageClass 확인
kubectl get sc

# 기본 StorageClass 설정
kubectl patch storageclass fast-ssd -p \
  '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# storageClassName 생략 시 기본 StorageClass 사용
```

---

## 7. 실전 예제

### 7.1 StatefulSet과 볼륨

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
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: password
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:  # 각 Pod에 개별 PVC 생성
  - metadata:
      name: mysql-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

### 7.2 다중 볼륨 구성

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-volume-pod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: config
      mountPath: /etc/nginx/conf.d
      readOnly: true
    - name: logs
      mountPath: /var/log/nginx
    - name: data
      mountPath: /usr/share/nginx/html
    - name: cache
      mountPath: /var/cache/nginx
  volumes:
  - name: config
    configMap:
      name: nginx-config
  - name: logs
    emptyDir: {}
  - name: data
    persistentVolumeClaim:
      claimName: web-content-pvc
  - name: cache
    emptyDir:
      medium: Memory
      sizeLimit: 256Mi
```

### 7.3 볼륨 스냅샷 (VolumeSnapshot)

```yaml
# VolumeSnapshotClass 정의
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-snapclass
driver: ebs.csi.aws.com
deletionPolicy: Delete
---
# 스냅샷 생성
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: mysql-snapshot
spec:
  volumeSnapshotClassName: csi-snapclass
  source:
    persistentVolumeClaimName: mysql-pvc
---
# 스냅샷에서 PVC 복원
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
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### 7.4 볼륨 확장

```yaml
# StorageClass에서 확장 허용
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: expandable-sc
provisioner: ebs.csi.aws.com
allowVolumeExpansion: true  # 필수
---
# PVC 크기 수정으로 확장
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: expandable-pvc
spec:
  storageClassName: expandable-sc
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi  # 10Gi → 20Gi로 수정
```

---

## 8. kubectl 명령어

### 8.1 PV/PVC 관리

```bash
# PV 조회
kubectl get pv
kubectl get pv -o wide

# PVC 조회
kubectl get pvc
kubectl get pvc -A  # 모든 네임스페이스

# 상세 정보
kubectl describe pv pv-volume
kubectl describe pvc my-pvc

# PVC 삭제 (PV는 reclaimPolicy에 따라 처리)
kubectl delete pvc my-pvc
```

### 8.2 StorageClass 관리

```bash
# StorageClass 조회
kubectl get sc
kubectl get storageclass

# 기본 StorageClass 확인
kubectl get sc -o wide

# StorageClass 상세
kubectl describe sc fast-ssd
```

### 8.3 디버깅

```bash
# 바인딩 안 되는 PVC 확인
kubectl describe pvc pending-pvc
# Events 섹션에서 원인 확인

# PV 용량 확인
kubectl get pv --sort-by=.spec.capacity.storage

# 특정 StorageClass의 PV만 조회
kubectl get pv -l storageclass=fast-ssd

# 볼륨 마운트 확인
kubectl exec -it pod-name -- df -h
kubectl exec -it pod-name -- mount | grep /data
```

---

## 9. 요약

### 9.1 볼륨 타입 비교

| 타입 | 영속성 | 노드 공유 | 용도 |
|:-----|:-------|:----------|:-----|
| emptyDir | Pod 수명 | 같은 Pod 내 | 임시 캐시, 컨테이너 간 공유 |
| hostPath | 노드 수명 | 같은 노드 | 개발/테스트 |
| PV/PVC | 영구 | 클러스터 전체 | 프로덕션 데이터 |
| ConfigMap/Secret | 영구 | 클러스터 전체 | 설정, 인증 정보 |

### 9.2 스토리지 선택 가이드

```
환경별 권장 구성:
├── 개발/테스트
│   ├── emptyDir (임시 데이터)
│   └── hostPath (로컬 테스트)
├── 프로덕션
│   ├── StorageClass + Dynamic Provisioning
│   └── CSI Driver (클라우드 스토리지)
└── 상태 유지 애플리케이션
    ├── StatefulSet + volumeClaimTemplates
    └── ReadWriteOnce (RWO)
```

### 9.3 핵심 개념 정리

| 개념 | 설명 |
|:-----|:-----|
| Volume | Pod 수준의 스토리지 추상화 |
| PV | 클러스터 수준의 스토리지 리소스 |
| PVC | 사용자의 스토리지 요청 |
| StorageClass | 동적 프로비저닝 템플릿 |
| CSI | 스토리지 시스템 표준 인터페이스 |

{{< callout type="info" >}}
**모범 사례:**
- 프로덕션에서는 항상 StorageClass와 동적 프로비저닝 사용
- WaitForFirstConsumer로 토폴로지 인식 프로비저닝
- 데이터 보호를 위해 VolumeSnapshot 활용
- allowVolumeExpansion으로 확장 가능한 스토리지 구성
{{< /callout >}}
