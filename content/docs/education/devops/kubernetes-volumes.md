---
title: "Kubernetes 영구 볼륨"
description: "쿠버네티스의 볼륨 개념과 영구 볼륨(PV), 영구 볼륨 클레임(PVC)을 상세히 알아본다"
summary: "emptyDir, hostPath, PV/PVC, StorageClass, 스테이트풀 애플리케이션을 위한 스토리지 관리"
date: 2025-01-06
weight: 5
draft: false
toc: true
---

## 스테이트풀 vs 스테이트리스

### 개념 이해

| 구분 | 스테이트풀 (Stateful) | 스테이트리스 (Stateless) |
|------|---------------------|------------------------|
| **정의** | 데이터를 저장소에 보관하는 애플리케이션 | 상태 정보를 저장하지 않는 애플리케이션 |
| **예시** | MySQL, PostgreSQL, MongoDB, Redis | Nginx, Apache, API 서버 |
| **파드 특성** | 데이터 영속성 필요 | 언제든 삭제/재생성 가능 |
| **스케일링** | 신중하게 (데이터 동기화 필요) | 자유롭게 수평 확장 가능 |

```
┌────────────────────────────────────────────────────────────────────┐
│                        스테이트리스 애플리케이션                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Pod A     │  │   Pod B     │  │   Pod C     │  ← 동일한 역할  │
│  │   (nginx)   │  │   (nginx)   │  │   (nginx)   │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                    │
│         어떤 파드가 요청을 처리해도 결과 동일                        │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                        스테이트풀 애플리케이션                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Pod A     │  │   Pod B     │  │   Pod C     │                │
│  │  (mysql-0)  │  │  (mysql-1)  │  │  (mysql-2)  │                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                │                │                        │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐                  │
│    │ Volume A│      │ Volume B│      │ Volume C│  ← 각각 고유 데이터│
│    └─────────┘      └─────────┘      └─────────┘                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 볼륨(Volume)이란?

### 볼륨의 필요성

쿠버네티스에서 **파드는 휘발성**이다. 파드가 종료되면 컨테이너 내부의 모든 데이터가 사라진다.

```
파드 삭제 시 데이터 손실 문제:

┌──────────────────────┐
│        Pod           │
│  ┌────────────────┐  │
│  │   Container    │  │
│  │  ┌──────────┐  │  │
│  │  │  Data    │  │  │  ← 파드 삭제 시 데이터도 함께 삭제!
│  │  └──────────┘  │  │
│  └────────────────┘  │
└──────────────────────┘
           │
           ▼ 파드 삭제

        데이터 손실!
```

**볼륨**을 사용하면 파드 외부에 데이터를 저장하여 영속성을 보장할 수 있다.

```
볼륨을 사용한 데이터 보존:

┌──────────────────────┐     ┌──────────────┐
│        Pod           │     │    Volume    │
│  ┌────────────────┐  │     │              │
│  │   Container    │──┼─────▶│    Data     │
│  │                │  │     │              │
│  └────────────────┘  │     └──────────────┘
└──────────────────────┘            │
           │                        │
           ▼ 파드 삭제              ▼ 볼륨은 유지

        ┌──────────────┐
        │    Volume    │
        │              │
        │    Data      │  ← 데이터 보존!
        │              │
        └──────────────┘
```

### 볼륨의 위치에 따른 분류

| 위치 | 특징 | 데이터 보존 범위 |
|------|------|-----------------|
| **파드 내** | 파드 종료 시 데이터 삭제 | 파드 생존 기간 |
| **워커 노드 내** | 파드 종료해도 유지, 노드 종료 시 삭제 | 노드 생존 기간 |
| **노드 외부** | 파드/노드 종료와 무관하게 영구 보존 | **영구 보존** |

```
┌──────────────────────────────────────────────────────────────────┐
│                         Worker Node                               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                          Pod                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │  emptyDir (임시 볼륨)                                    ││ │
│  │  │  - 파드 생성 시 생성, 파드 삭제 시 삭제                   ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  hostPath (로컬 볼륨)                                        │ │
│  │  - 노드의 로컬 디스크 사용                                   │ │
│  │  - 노드 삭제 시 데이터 손실                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    외부 스토리지 (NFS, EBS, etc.)                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  PersistentVolume (영구 볼륨)                                │ │
│  │  - 파드/노드와 독립적                                        │ │
│  │  - 데이터 영구 보존                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 볼륨 라이프사이클

볼륨의 라이프사이클은 기본적으로 **파드의 라이프사이클과 동일**하다.
- 파드 생성 → 볼륨 생성
- 파드 삭제 → 볼륨 삭제

> **주의**: 외부 저장소를 사용하는 경우, 파드가 삭제되어도 **실제 데이터는 외부 저장소에 보존**된다.

---

## 볼륨 유형

### 볼륨 유형 비교표

| 유형 | 종류 | 데이터 보존 | 사용 사례 |
|------|------|------------|----------|
| **임시 볼륨** | emptyDir | 파드와 함께 삭제 | 임시 캐시, 컨테이너 간 데이터 공유 |
| **로컬 볼륨** | hostPath | 노드와 함께 삭제 | 노드 로그, 개발/테스트 환경 |
| **외부 볼륨** | NFS, AWS EBS, Azure Disk, GCE PD | 영구 보존 | 데이터베이스, 파일 저장소 |

### 1. emptyDir (임시 볼륨)

**emptyDir**은 파드가 생성될 때 **빈 디렉터리**로 생성되는 임시 볼륨이다.

**특징**:
- 파드 생성 시 생성, 파드 삭제 시 삭제
- 같은 파드 내의 **컨테이너 간 데이터 공유**에 유용
- 메모리(tmpfs)를 사용할 수도 있음

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-pod
spec:
  containers:
  # 첫 번째 컨테이너: 데이터 생성
  - name: writer
    image: busybox
    command: ['sh', '-c', 'echo "Hello from writer" > /data/message.txt && sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data

  # 두 번째 컨테이너: 데이터 읽기
  - name: reader
    image: busybox
    command: ['sh', '-c', 'sleep 10 && cat /data/message.txt && sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data

  volumes:
  - name: shared-data
    emptyDir: {}  # 빈 디렉터리 생성
```

**메모리 기반 emptyDir** (더 빠르지만 휘발성):

```yaml
volumes:
- name: cache-volume
  emptyDir:
    medium: Memory      # RAM 디스크 사용
    sizeLimit: 100Mi    # 최대 크기 제한
```

**emptyDir 사용 사례**:
- 임시 캐시 데이터
- 컨테이너 간 데이터 공유
- 중간 처리 결과 저장

### 2. hostPath (로컬 볼륨)

**hostPath**는 워커 노드의 **로컬 파일 시스템**을 파드에 마운트한다.

**특징**:
- 파드가 삭제되어도 **노드에 데이터 유지**
- 같은 노드의 다른 파드와 **데이터 공유 가능**
- 노드가 삭제되면 **데이터 손실**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  containers:
  - name: nginx
    image: nginx:latest
    volumeMounts:
    - name: host-data
      mountPath: /usr/share/nginx/html  # 컨테이너 내 마운트 경로

  volumes:
  - name: host-data
    hostPath:
      path: /data/nginx    # 호스트(노드)의 경로
      type: DirectoryOrCreate  # 없으면 생성
```

**hostPath type 옵션**:

| Type | 설명 |
|------|------|
| `""` (빈 문자열) | 마운트 전 검사 없음 (기본값) |
| `DirectoryOrCreate` | 디렉터리가 없으면 생성 |
| `Directory` | 디렉터리가 반드시 존재해야 함 |
| `FileOrCreate` | 파일이 없으면 생성 |
| `File` | 파일이 반드시 존재해야 함 |
| `Socket` | UNIX 소켓이 존재해야 함 |
| `CharDevice` | 문자 디바이스가 존재해야 함 |
| `BlockDevice` | 블록 디바이스가 존재해야 함 |

**hostPath 사용 시 주의사항**:

```yaml
# ⚠️ 보안 위험: 루트 디렉터리 마운트
volumes:
- name: root-access
  hostPath:
    path: /   # 위험! 전체 노드 파일시스템 접근 가능

# ✅ 권장: 필요한 디렉터리만 마운트
volumes:
- name: logs
  hostPath:
    path: /var/log/myapp
    type: DirectoryOrCreate
```

**hostPath 사용 사례**:
- 노드의 시스템 로그 접근 (`/var/log`)
- 도커 소켓 접근 (`/var/run/docker.sock`)
- 개발/테스트 환경에서의 빠른 데이터 공유

### 3. 외부 볼륨

외부 저장소를 사용하여 **파드/노드와 독립적**으로 데이터를 영구 보존한다.

| 볼륨 유형 | 플랫폼 | 특징 |
|----------|--------|------|
| **NFS** | 온프레미스 | 네트워크 파일 시스템, 다중 노드 공유 가능 |
| **AWS EBS** | AWS | 단일 AZ, 단일 노드에서만 마운트 |
| **Azure Disk** | Azure | Azure VM에 연결 가능한 블록 스토리지 |
| **GCE PD** | GCP | Google Compute Engine Persistent Disk |
| **Ceph** | 온프레미스 | 분산 스토리지 시스템 |
| **iSCSI** | 온프레미스 | 블록 레벨 스토리지 |

**NFS 볼륨 예제**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nfs-pod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: nfs-storage
      mountPath: /data

  volumes:
  - name: nfs-storage
    nfs:
      server: 192.168.1.100   # NFS 서버 IP
      path: /exports/data      # NFS 공유 경로
      readOnly: false
```

**AWS EBS 볼륨 예제**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ebs-pod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: ebs-storage
      mountPath: /data

  volumes:
  - name: ebs-storage
    awsElasticBlockStore:
      volumeID: vol-0123456789abcdef0
      fsType: ext4
```

---

## 영구 볼륨(PV)과 영구 볼륨 클레임(PVC)

### PV/PVC의 필요성

개발자가 매번 스토리지 세부 사항을 알 필요 없이, **추상화된 방식**으로 스토리지를 요청할 수 있도록 한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              역할 분리                                       │
│                                                                              │
│  ┌────────────────────────────┐      ┌────────────────────────────────────┐ │
│  │       클러스터 관리자        │      │            개발자                  │ │
│  │                            │      │                                    │ │
│  │  - 물리 스토리지 관리        │      │  - 애플리케이션 개발                │ │
│  │  - PersistentVolume 생성   │      │  - PersistentVolumeClaim 생성      │ │
│  │  - 스토리지 유형/크기 설정   │      │  - 필요한 용량만 요청               │ │
│  │                            │      │                                    │ │
│  └─────────────┬──────────────┘      └───────────────┬────────────────────┘ │
│                │                                      │                      │
│                ▼                                      ▼                      │
│         ┌────────────┐                        ┌────────────┐                │
│         │     PV     │◄───── 바인딩 ──────────▶│    PVC     │                │
│         └────────────┘                        └────────────┘                │
│                                                       │                      │
│                                                       ▼                      │
│                                                ┌────────────┐                │
│                                                │    Pod     │                │
│                                                └────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PersistentVolume (PV)

**PV**는 클러스터 관리자가 프로비저닝한 **스토리지 리소스**이다.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
  labels:
    type: local
    app: mysql
spec:
  # 스토리지 클래스 (PVC와 매칭에 사용)
  storageClassName: manual

  # 용량
  capacity:
    storage: 10Gi

  # 접근 모드
  accessModes:
    - ReadWriteOnce

  # 회수 정책
  persistentVolumeReclaimPolicy: Retain

  # 실제 스토리지 정의
  hostPath:
    path: /mnt/data
    type: DirectoryOrCreate
```

**다양한 스토리지 백엔드 예제**:

```yaml
# NFS 기반 PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  storageClassName: nfs
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany   # NFS는 다중 노드 쓰기 지원
  nfs:
    server: nfs-server.example.com
    path: /exports/data
---
# AWS EBS 기반 PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: ebs-pv
spec:
  storageClassName: aws-ebs
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteOnce   # EBS는 단일 노드만 지원
  awsElasticBlockStore:
    volumeID: vol-0123456789abcdef0
    fsType: ext4
```

### PersistentVolumeClaim (PVC)

**PVC**는 개발자가 스토리지를 **요청**하는 방법이다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  # 스토리지 클래스 (PV와 매칭)
  storageClassName: manual

  # 접근 모드
  accessModes:
    - ReadWriteOnce

  # 요청 용량
  resources:
    requests:
      storage: 5Gi

  # 특정 PV 선택 (선택사항)
  selector:
    matchLabels:
      app: mysql
```

### Pod에서 PVC 사용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mysql-pod
spec:
  containers:
  - name: mysql
    image: mysql:8.0
    env:
    - name: MYSQL_ROOT_PASSWORD
      value: "password"
    ports:
    - containerPort: 3306
    volumeMounts:
    - name: mysql-storage
      mountPath: /var/lib/mysql   # MySQL 데이터 디렉터리

  volumes:
  - name: mysql-storage
    persistentVolumeClaim:
      claimName: my-pvc   # PVC 이름 참조
```

### 완전한 예제: MySQL 배포

```yaml
# 1. PersistentVolume 생성
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql-pv
spec:
  storageClassName: manual
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/mysql-data
---
# 2. PersistentVolumeClaim 생성
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
# 3. Deployment 생성
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mysql
spec:
  selector:
    matchLabels:
      app: mysql
  strategy:
    type: Recreate   # 롤링 업데이트 대신 재생성 (DB 권장)
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
        ports:
        - containerPort: 3306
        volumeMounts:
        - name: mysql-persistent-storage
          mountPath: /var/lib/mysql
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: mysql-persistent-storage
        persistentVolumeClaim:
          claimName: mysql-pvc
---
# 4. Service 생성
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  selector:
    app: mysql
  ports:
  - port: 3306
  clusterIP: None   # Headless Service
---
# 5. Secret 생성 (비밀번호)
apiVersion: v1
kind: Secret
metadata:
  name: mysql-secret
type: Opaque
data:
  password: cGFzc3dvcmQ=   # base64 encoded "password"
```

---

## 접근 모드 (Access Modes)

볼륨에 접근할 수 있는 방식을 정의한다.

| 모드 | 약어 | 설명 |
|------|------|------|
| **ReadWriteOnce** | RWO | **단일 노드**에서만 읽기/쓰기 |
| **ReadOnlyMany** | ROX | **여러 노드**에서 읽기 전용 |
| **ReadWriteMany** | RWX | **여러 노드**에서 읽기/쓰기 |
| **ReadWriteOncePod** | RWOP | **단일 파드**에서만 읽기/쓰기 (K8s 1.22+) |

**스토리지별 지원 모드**:

| 스토리지 | RWO | ROX | RWX |
|----------|-----|-----|-----|
| AWS EBS | ✅ | ❌ | ❌ |
| Azure Disk | ✅ | ❌ | ❌ |
| GCE PD | ✅ | ✅ | ❌ |
| NFS | ✅ | ✅ | ✅ |
| Ceph RBD | ✅ | ✅ | ❌ |
| CephFS | ✅ | ✅ | ✅ |
| hostPath | ✅ | ❌ | ❌ |

---

## 회수 정책 (Reclaim Policy)

PVC가 삭제될 때 PV와 데이터를 어떻게 처리할지 결정한다.

| 정책 | 설명 | 사용 사례 |
|------|------|----------|
| **Retain** | PVC 삭제 후에도 PV와 데이터 **보존** | 중요 데이터, 수동 정리 필요 |
| **Delete** | PVC 삭제 시 PV와 **스토리지 자체 삭제** | 동적 프로비저닝, 임시 데이터 |
| **Recycle** | PVC 삭제 시 데이터만 삭제 (`rm -rf /volume/*`) | **Deprecated** |

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: retain-pv
spec:
  persistentVolumeReclaimPolicy: Retain  # 보존 정책
  # ...

---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: delete-pv
spec:
  persistentVolumeReclaimPolicy: Delete  # 삭제 정책
  # ...
```

---

## 볼륨 상태 (Status)

PV의 현재 상태를 나타낸다.

| 상태 | 설명 |
|------|------|
| **Available** | PVC에 바인딩되지 않은 **사용 가능** 상태 |
| **Bound** | PVC에 **바인딩된** 상태 |
| **Released** | PVC가 삭제되었지만 리소스가 **아직 회수되지 않은** 상태 |
| **Failed** | 자동 회수 **실패** 상태 |

```bash
# PV 상태 확인
kubectl get pv

# 출력 예시
NAME       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM              STORAGECLASS
mysql-pv   20Gi       RWO            Retain           Bound       default/mysql-pvc  manual
nfs-pv     100Gi      RWX            Delete           Available                      nfs

# PV 상세 정보
kubectl describe pv mysql-pv
```

---

## StorageClass와 동적 프로비저닝

### StorageClass란?

**StorageClass**는 스토리지의 "클래스"를 정의하여 **동적으로 PV를 생성**할 수 있게 한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          동적 프로비저닝 흐름                                 │
│                                                                              │
│  1. StorageClass 정의 (관리자)                                               │
│         │                                                                    │
│         ▼                                                                    │
│  ┌────────────────┐                                                         │
│  │  StorageClass  │   "fast-ssd", "standard", "nfs" 등                      │
│  │  (스토리지 템플릿)│                                                        │
│  └────────┬───────┘                                                         │
│           │                                                                  │
│  2. PVC 생성 (개발자)                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────┐         ┌────────────────┐                             │
│  │      PVC       │────────▶│      PV        │   3. PV 자동 생성           │
│  │ (storageClass  │         │   (동적 생성)   │                             │
│  │   = fast-ssd)  │         └────────────────┘                             │
│  └────────────────┘                  │                                      │
│                                      ▼                                      │
│                              실제 스토리지 프로비저닝                         │
│                              (AWS EBS, GCE PD, Azure Disk 등)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### StorageClass 정의

```yaml
# AWS EBS 기반 StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs   # 프로비저너
parameters:
  type: gp3                          # EBS 볼륨 타입
  fsType: ext4
  encrypted: "true"
reclaimPolicy: Delete                # 회수 정책
allowVolumeExpansion: true           # 볼륨 확장 허용
volumeBindingMode: WaitForFirstConsumer  # 파드 스케줄링 후 바인딩
---
# NFS 기반 StorageClass (NFS Provisioner 필요)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
provisioner: nfs.csi.k8s.io
parameters:
  server: nfs-server.example.com
  share: /exports
reclaimPolicy: Retain
---
# 로컬 스토리지 기반 (개발/테스트용)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner  # 수동 프로비저닝
volumeBindingMode: WaitForFirstConsumer
```

### 동적 프로비저닝 사용

```yaml
# PVC에서 StorageClass 지정 → PV 자동 생성
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  storageClassName: fast-ssd   # StorageClass 이름
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi

# 이 PVC를 생성하면 50Gi의 gp3 EBS 볼륨이 자동으로 프로비저닝됨!
```

### 기본 StorageClass

```bash
# 기본 StorageClass 확인
kubectl get storageclass

# 기본 StorageClass 설정
kubectl patch storageclass fast-ssd -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

```yaml
# 기본 StorageClass가 설정되면 storageClassName 생략 가능
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: default-pvc
spec:
  # storageClassName 생략 → 기본 StorageClass 사용
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

---

## kubectl 명령어

### PV 관련 명령어

```bash
# PV 목록 조회
kubectl get pv

# PV 상세 조회
kubectl describe pv <pv-name>

# PV 생성
kubectl apply -f pv.yaml

# PV 삭제
kubectl delete pv <pv-name>

# PV YAML 출력
kubectl get pv <pv-name> -o yaml
```

### PVC 관련 명령어

```bash
# PVC 목록 조회
kubectl get pvc

# PVC 목록 조회 (모든 네임스페이스)
kubectl get pvc --all-namespaces

# PVC 상세 조회
kubectl describe pvc <pvc-name>

# PVC 생성
kubectl apply -f pvc.yaml

# PVC 삭제
kubectl delete pvc <pvc-name>
```

### StorageClass 관련 명령어

```bash
# StorageClass 목록 조회
kubectl get storageclass
kubectl get sc

# StorageClass 상세 조회
kubectl describe sc <sc-name>
```

---

## 정리

### 볼륨 유형 선택 가이드

| 사용 사례 | 권장 볼륨 유형 |
|----------|---------------|
| 임시 캐시, 컨테이너 간 공유 | emptyDir |
| 개발/테스트 환경 | hostPath |
| 프로덕션 데이터베이스 | PV/PVC + 외부 스토리지 |
| 다중 노드 공유 (RWX) | NFS, CephFS |
| 클라우드 환경 | StorageClass + 동적 프로비저닝 |

### 핵심 개념 요약

| 개념 | 설명 |
|------|------|
| **Volume** | 파드에 연결되는 스토리지 |
| **emptyDir** | 파드 수명과 동일한 임시 볼륨 |
| **hostPath** | 노드의 로컬 파일시스템 사용 |
| **PV** | 클러스터 관리자가 프로비저닝한 스토리지 |
| **PVC** | 개발자의 스토리지 요청 |
| **StorageClass** | 동적 프로비저닝을 위한 스토리지 템플릿 |
| **Access Modes** | RWO, ROX, RWX, RWOP |
| **Reclaim Policy** | Retain, Delete, Recycle |

### 체크리스트

- [ ] 스테이트풀 애플리케이션인가? → PV/PVC 필요
- [ ] 다중 노드에서 동시 접근 필요? → RWX 지원 스토리지 (NFS, CephFS)
- [ ] 데이터 영구 보존 필요? → Retain 정책 + 외부 스토리지
- [ ] 클라우드 환경? → StorageClass로 동적 프로비저닝
- [ ] 민감한 데이터? → 암호화 옵션 확인

---

## 참고 자료

- [Kubernetes Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- 쉽게 시작하는 쿠버네티스 (조훈, 심근우)
