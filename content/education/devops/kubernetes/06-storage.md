---
title: "06. 스토리지"
date: 2026-04-23
weight: 6
---

[04. 워크로드 관리](../04-workloads)에서 파드는 고치지 않고 새로 만든다고 했고, [05. 스케줄링](../05-scheduling)에서 새 파드는 어느 노드로든 갈 수 있다고 했다. 둘을 합치면 곤란한 결론이 나온다. 파드 안에 쓴 데이터는 파드가 바뀔 때 사라지고, 노드에 쓴 데이터는 파드가 다른 노드로 가면 닿지 않는다. 스토리지는 이 두 문제를 푸는 계층이다. 원리는 셋이다. 첫째, **컨테이너의 쓰기 계층은 컨테이너와 함께 사라지므로, 남겨야 할 데이터는 컨테이너 밖의 볼륨에 두고 마운트로 붙인다.** 볼륨의 수명이 어디에 묶이는가, 즉 파드인가 노드인가 클러스터 바깥인가가 볼륨의 종류를 정한다. 둘째, **영구 스토리지는 "무엇이 있는가"(PV)와 "무엇이 필요한가"(PVC)를 따로 선언하고 컨트롤러가 짝을 맞춘다.** StorageClass는 그 PV를 요청이 올 때 만들어 내는 템플릿이고, CSI는 만들고 붙이고 마운트하는 일을 외부 드라이버에 맡기는 표준 인터페이스다. 셋째, **볼륨은 노드에 붙는 물리적 사건이라 스케줄링과 얽힌다.** 어느 노드에서 마운트할 수 있는가가 파드의 배치를 제약하고, 그래서 접근 모드, PV의 노드 어피니티, 첫 소비자를 기다리는 바인딩 같은 규칙이 있다. StatefulSet은 파드와 볼륨의 짝을 이름으로 고정해 이 얽힘을 다스린다.

---

## 1. 스토리지의 필요성

컨테이너는 **휘발성(ephemeral)** 이다. 컨테이너가 지워지면 그 위에 쌓인 쓰기 계층이 함께 사라지고, 파드가 다른 노드로 다시 스케줄되면 로그, 업로드 파일, DB 데이터 같은 런타임 데이터가 전부 증발한다. 쿠버네티스의 스토리지는 이 휘발성 위에서 **상태를 파드 바깥에 보관**하기 위한 추상화다.

### 컨테이너 레이어와 Copy-on-Write

```text
┌──────────────────────────┐
│ Container Layer (RW)     │ 소멸
│  - 런타임에 쓴 파일      │
├──────────────────────────┤
│ Image Layers (RO)        │ 공유
│  - 앱 코드, 의존성       │
│  - Base OS               │
└──────────────────────────┘
```

이미지는 읽기 전용 레이어의 스택이다([01](../01-introduction)장 3절). 컨테이너가 파일을 고치면 런타임은 그 파일을 맨 위의 쓰기 계층으로 복사한 뒤 고친다(Copy-on-Write). 이미지 레이어를 여러 컨테이너가 공유할 수 있는 이유이자, 쓰기 계층이 컨테이너마다 따로 있고 컨테이너와 수명을 같이하는 이유다. 04장에서 롤아웃은 컨테이너를 고치는 것이 아니라 새로 만드는 것이라고 했다. 그 새 컨테이너의 쓰기 계층은 비어 있다.

{{< callout type="warning" >}}
쓰기 계층은 컨테이너 삭제와 함께 삭제된다. MySQL, Redis, Kafka 같은 상태 있는 애플리케이션을 그대로 올리면 파드 재시작 한 번에 데이터가 전부 사라진다. 데이터가 살아야 하는 경로는 반드시 **볼륨**으로 빼야 하고, 볼륨의 수명은 컨테이너가 아니라 아래에서 고르는 범위에 묶인다.
{{< /callout >}}

### Stateful vs Stateless

| 구분 | Stateful | Stateless | 왜 다르게 다루나 |
|:-----|:---------|:----------|:---------------|
| 데이터 | 요청 사이에 남아야 한다 | 요청마다 완결된다 | 상태가 있으면 "어느 복제본인가"가 중요해진다 |
| 예시 | MySQL, Redis, Kafka, etcd | Nginx, API 서버 | |
| 스케일링 | 신중(복제, 동기화, 리더) | 자유로운 수평 확장 | 상태 없는 복제본은 서로 구별할 필요가 없다 |
| 스토리지 | PV/PVC, 복제본마다 별도 볼륨 | emptyDir 정도 | 04장의 Deployment가 전자에 맞지 않는 이유가 6절이다 |

---

## 2. 볼륨 수명에 따른 분류

첫째 원리다. 볼륨은 `spec.volumes`에 선언하고 컨테이너의 `volumeMounts`로 경로에 붙인다. 같은 파드의 컨테이너들은 같은 볼륨을 다른 경로에 붙일 수 있다. 종류를 고르는 기준은 "이 데이터가 무엇과 함께 죽어도 되는가"다.

| 수명 범위 | 대표 타입 | 데이터가 사라지는 때 | 용도 | 왜 이 범위인가 |
|:---------|:--------|:------------------|:-----|:-------------|
| 파드 | emptyDir, generic ephemeral | 파드 삭제 | 캐시, 컨테이너 간 공유, 스크래치 | 파드와 함께 없어져도 되는 중간 산출물 |
| 노드 | hostPath, local | 노드 장애, 다른 노드로 이동 | 노드 로그 수집, 로컬 디스크 DB | 노드에 물리적으로 묶인 자원 |
| 클러스터 밖 | PV + CSI(클라우드 디스크, NFS, Ceph) | 명시적 삭제 | DB, 업로드 파일 | 파드와 노드보다 오래 살아야 한다 |
| API 객체 | configMap, secret, downwardAPI, projected | 객체 삭제 | 설정, 비밀, 자기 정보 | 저장소가 아니라 API 서버의 객체를 파일로 보여 주는 것(04장) |

```text
┌────────────────────────────┐
│         Worker Node        │
│  ┌──────────────────────┐  │
│  │ Pod                  │  │
│  │  └ emptyDir (파드)    │  │
│  └──────────────────────┘  │
│  hostPath / local (노드)   │
└─────────────┬──────────────┘
              │ attach / mount
              ▼
┌────────────────────────────┐
│  외부 스토리지 (EBS, NFS)   │
│  └ PersistentVolume (영구) │
└────────────────────────────┘
```

### 2.1 emptyDir

파드가 노드에 배정될 때 **빈 디렉터리**로 만들어지고 파드가 노드에서 지워질 때 함께 지워진다. 컨테이너가 죽고 다시 떠도 남는다. 수명이 컨테이너가 아니라 파드이기 때문이다. 같은 파드 안의 컨테이너들이 파일을 나눠 쓰는 가장 쉬운 방법이고, 04장의 사이드카가 앱의 로그를 읽은 것이 이것이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container
spec:
  containers:
  - name: writer
    image: busybox:1.36
    command: ["/bin/sh", "-c"]
    args:
    - |
      while true; do
        date >> /cache/log
        sleep 5
      done
    volumeMounts:
    - name: cache
      mountPath: /cache
  - name: reader
    image: busybox:1.36
    command: ["tail", "-f"]
    args: ["/cache/log"]
    volumeMounts:
    - name: cache
      mountPath: /cache
  volumes:
  - name: cache
    emptyDir:
      sizeLimit: 500Mi
      # medium: Memory  # RAM(tmpfs)
```

| 옵션 | 뜻 | 왜 |
|:-----|:---|:---|
| 기본 | 노드의 kubelet 디렉터리(보통 루트 디스크)에 만든다 | 노드의 임시 스토리지(ephemeral-storage)를 쓴다 |
| `sizeLimit` | 넘으면 kubelet이 파드를 **퇴거**한다 | 임시 디렉터리가 노드 디스크를 채워 다른 파드까지 죽이는 것을 막는다. 퇴거 메시지는 `Usage of EmptyDir volume "cache" exceeds the limit "500Mi"` 형식이다 |
| `medium: Memory` | tmpfs, 즉 RAM에 만든다 | 디스크 I/O 없는 캐시. 쓴 만큼 **컨테이너의 메모리 limit에서 차감**되고, 노드가 재부팅되면 사라진다 |

`medium: Memory`의 tmpfs 크기는 `sizeLimit`이 있으면 그 값, 없으면 노드 allocatable 메모리다. 메모리 limit 64Mi인 컨테이너가 tmpfs에 40Mi를 쓰면 프로세스가 쓸 메모리는 24Mi밖에 남지 않는다. 용도는 중간 빌드 산출물, 업로드 버퍼, 사이드카와 메인 컨테이너의 로그 릴레이 같은 것이다.

### 2.2 hostPath

노드의 파일 시스템 경로를 파드에 그대로 붙인다. 파드가 지워져도 노드에는 남지만, 파드가 다른 노드로 가면 그 데이터는 거기 없다. 그래서 파드 수명보다 길지만 노드에 묶인 두 번째 범위다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: node-logger
spec:
  containers:
  - name: collector
    image: busybox:1.36
    volumeMounts:
    - name: host-logs
      mountPath: /logs
      readOnly: true
  volumes:
  - name: host-logs
    hostPath:
      path: /var/log
      type: Directory
```

| type | 뜻 | 왜 검사하나 |
|:-----|:---|:-----------|
| `""` | 검사 없음(기본) | 하위 호환. 없는 경로면 디렉터리를 만든다 |
| `DirectoryOrCreate` | 없으면 0755로 만든다 | |
| `Directory` | 반드시 있어야 한다 | 오타로 빈 디렉터리를 만들어 놓고 "로그가 없다"고 헤매는 일을 막는다 |
| `FileOrCreate` / `File` | 파일 버전 | |
| `Socket` | UNIX 소켓이 있어야 한다 | 런타임 소켓 마운트에 쓴다 |
| `CharDevice` / `BlockDevice` | 장치 파일 | |

{{< callout type="warning" >}}
**hostPath는 보안 경계를 뚫는 볼륨이다.** `/`, `/etc`, `/var/lib/kubelet`, 컨테이너 런타임 소켓을 마운트한 파드는 노드 전체를 장악할 수 있다. 그래서 [08](../08-security)장 7절의 Pod Security Standards `restricted`는 hostPath를 금지한다. 노드 자원에 닿아야 하는 DaemonSet([05](../05-scheduling)장 8절)에서만, 필요한 최소 경로를 가능하면 `readOnly`로 마운트한다. 쿠버네티스가 관리하지 않는 경로라서 용량도 백업도 사람 몫이다.
{{< /callout >}}

### 2.3 local

`local`은 hostPath의 영구 볼륨 버전이다. 노드의 디스크나 파티션을 PV로 등록하되, **PV에 노드 어피니티를 반드시 적어** 스케줄러가 그 노드로만 파드를 보내게 한다. hostPath 파드가 다른 노드로 가서 빈 디렉터리를 보는 사고가 구조적으로 막힌다. 로컬 NVMe의 성능이 필요한 DB에 쓰고, 노드가 죽으면 데이터도 같이 죽는다는 점은 그대로다.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv-1
spec:
  capacity:
    storage: 100Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values: ["node-1"]
```

### 2.4 파드 수명의 PVC: generic ephemeral volume

emptyDir은 노드 디스크만 쓴다. 클라우드 디스크처럼 "PV로만 제공되는 스토리지"를 파드 수명으로 쓰고 싶을 때가 generic ephemeral volume이다(1.23 GA). 파드 안에 PVC 템플릿을 적으면 파드가 만들어질 때 `<파드 이름>-<볼륨 이름>`이라는 PVC가 파드를 소유자로 해서 생기고, 파드가 지워지면 가비지 컬렉션으로 함께 지워진다.

```yaml
volumes:
- name: scratch
  ephemeral:
    volumeClaimTemplate:
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 10Gi
```

3절 이후의 PVC와 동작이 같고 수명만 파드에 묶인 것이다. 노드 디스크보다 큰 스크래치 공간, 또는 emptyDir보다 빠른 스토리지가 필요한 임시 작업에 쓴다. CSI 드라이버가 직접 파드 수명의 볼륨을 만들어 주는 CSI ephemeral volume(1.25 GA)도 있는데, 비밀 저장소 연동처럼 드라이버가 그 용도로 만들어진 경우다.

### 2.5 API 객체를 파일로: projected, image

configMap, secret, downwardAPI 볼륨은 04장에서 봤다. `projected`는 이 셋과 ServiceAccount 토큰, 클러스터 신뢰 번들을 **한 디렉터리에 합쳐** 보여 준다. 컨테이너가 설정 파일과 인증서와 토큰을 한 곳에서 읽게 하려는 것이다.

```yaml
volumes:
- name: all-in-one
  projected:
    sources:
    - configMap:
        name: app-config
    - secret:
        name: tls
        items:
        - key: tls.crt
          path: cert.pem
    - serviceAccountToken:
        audience: api
        expirationSeconds: 3600
        path: token
```

`serviceAccountToken`은 kubelet이 만료 전에 알아서 갈아 끼우는 짧은 수명의 토큰이다. 1.24부터 ServiceAccount의 영구 토큰 Secret이 자동 생성되지 않는 대신 파드마다 이 방식으로 토큰을 받는다([08](../08-security)장 5절). 컨테이너 이미지 자체를 읽기 전용 볼륨으로 붙이는 `image` 볼륨(1.36 GA)도 있다. 모델 파일이나 정적 자산을 앱 이미지와 분리해 배포할 때 쓴다.

### 2.6 클라우드 / 네트워크 볼륨

NFS, iSCSI, FC처럼 파드 스펙에 직접 적는 네트워크 볼륨 타입은 남아 있지만, 클라우드 디스크는 사정이 바뀌었다. 예전에는 `awsElasticBlockStore`, `gcePersistentDisk`, `azureDisk`를 파드에 바로 적을 수 있었으나, 그 드라이버들은 쿠버네티스 소스 트리 밖의 CSI 드라이버로 옮겨졌고 트리 안의 코드는 제거됐다. AWS EBS와 Azure Disk는 1.27에서, GCE PD는 1.28에서 사라졌고 다른 드라이버들도 같은 길을 갔다. 이유는 5절에서 본다. 지금 클라우드 디스크를 쓰는 표준은 파드에 직접 적는 것이 아니라 StorageClass로 PVC를 만드는 것이다.

```yaml
volumes:
- name: nfs-data
  nfs:
    server: nfs.example.internal
    path: /exports/data
    readOnly: false
- name: data     # 클라우드 디스크
  persistentVolumeClaim:
    claimName: data
```

---

## 3. PV / PVC 동작 원리

둘째 원리다. 스토리지를 **공급하는 쪽**과 **쓰는 쪽**의 선언을 나누고, 컨트롤러가 둘을 짝짓는다.

### 3.1 역할 분리

```text
┌──────────────┐        ┌──────────────┐
│   관리자     │        │   개발자     │
│ 스토리지 준비│        │ 용량 요청    │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
  ┌─────────┐  바인딩    ┌─────────┐
  │   PV    │◄──────────►│   PVC   │
  └─────────┘   (1:1)    └────┬────┘
                              │
                              ▼
                          ┌───────┐
                          │  Pod  │
                          └───────┘
```

| 객체 | 범위 | 누가 만드나 | 무엇을 적나 | 왜 나눴나 |
|:-----|:-----|:----------|:-----------|:---------|
| **PV** (PersistentVolume) | 클러스터 | 관리자 또는 프로비저너 | 실제 백엔드(어느 디스크, 어느 NFS 경로), 용량, 접근 모드, 회수 정책 | 백엔드의 세부를 아는 쪽 |
| **PVC** (PersistentVolumeClaim) | 네임스페이스 | 개발자 | 필요한 용량, 접근 모드, StorageClass | 백엔드를 몰라도 "10Gi 읽기쓰기"만 말하면 된다 |

파드는 PVC만 가리킨다. 파드 매니페스트에 디스크 ID가 들어가지 않으므로 같은 매니페스트가 AWS에서도 온프레미스에서도 돈다. 네임스페이스 범위인 PVC가 클러스터 범위인 PV를 가리키는 구조라서, 팀은 자기 네임스페이스의 클레임만 보고 관리자는 클러스터의 볼륨 전체를 본다.

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
  volumeMode: Filesystem
  hostPath:
    path: /mnt/mysql-data
```

`hostPath` 자리가 백엔드다. 운영에서는 `csi:`(드라이버 이름과 볼륨 핸들), `nfs:`, `local:`이 온다. `volumeMode`는 기본 `Filesystem`이고, 파일 시스템 없이 장치 자체를 컨테이너에 넘기는 `Block`을 고를 수 있다. 자기만의 방식으로 디스크를 다루는 DB나 가상화 워크로드가 쓴다.

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

PV 컨트롤러가 바인딩되지 않은 PVC를 보고 맞는 PV를 찾는다.

| 조건 | 규칙 | 왜 |
|:-----|:-----|:---|
| 용량 | PV capacity ≥ PVC request | 요청보다 작은 볼륨은 뜻이 없다 |
| accessModes | PVC가 요청한 모드를 PV가 전부 지원 | 3.5 |
| storageClassName | 문자열이 정확히 같아야 한다 | 클래스가 다른 볼륨은 성격이 다르다 |
| selector | PVC에 있으면 PV 라벨과 매칭 | 특정 볼륨 집합만 고르고 싶을 때 |
| volumeMode | 같아야 한다 | Block과 Filesystem은 호환되지 않는다 |
| 크기 선택 | 조건을 만족하는 PV 중 **가장 작은 것** | 큰 볼륨을 작은 요청에 낭비하지 않기 위해 |

바인딩은 **1:1**이고 배타적이다. PV의 `claimRef`가 PVC를, PVC의 `volumeName`이 PV를 가리키는 양방향 참조가 생기고, 한 PV가 두 클레임을 받을 수 없다. 3Gi 요청에 5Gi와 20Gi PV가 있으면 5Gi에 묶이고, 10Gi 요청은 20Gi에 묶이며 남는 10Gi는 다른 클레임이 쓸 수 없다. 사용자는 요청한 만큼은 반드시 받지만 그 이상을 받을 수도 있다는 문서의 표현이 이것이다. 맞는 PV가 없고 동적 프로비저닝도 없으면 PVC는 `Pending`으로 무한히 기다린다.

**미리 짝을 정하기.** 특정 PV를 특정 PVC에 예약하려면 PVC에 `volumeName`을 적거나 PV에 `claimRef`를 미리 적는다. 3.6에서 Retain된 볼륨을 다시 쓰는 방법과 이어진다.

### 3.5 Access Modes

접근 모드는 "몇 개의 **노드**가 동시에 붙을 수 있는가"다. 셋째 원리의 첫 번째 얼굴이다.

| 모드 | 약어 | 뜻 | 왜 노드 단위인가 |
|:-----|:-----|:---|:---------------|
| ReadWriteOnce | RWO | 노드 하나에서 읽기/쓰기 | 블록 디스크(EBS, Azure Disk, PD)는 한 번에 한 서버에만 attach된다 |
| ReadOnlyMany | ROX | 여러 노드에서 읽기 전용 | 쓰는 쪽이 없으면 여러 곳에서 붙어도 안전하다 |
| ReadWriteMany | RWX | 여러 노드에서 읽기/쓰기 | NFS, CephFS처럼 파일 시스템 자체가 동시 쓰기를 조정하는 스토리지만 가능 |
| ReadWriteOncePod | RWOP | 클러스터 전체에서 **파드 하나**만 | 1.29 GA. 노드가 아니라 파드 단위의 배타성 |

{{< callout type="warning" >}}
**RWO는 "파드 하나"가 아니다.** 노드 하나다. 같은 노드에 스케줄된 파드 여럿이 하나의 RWO 볼륨을 동시에 마운트할 수 있고, 두 파드가 같은 파일을 쓰면 데이터가 깨진다. 정확히 파드 하나로 제한하려면 **ReadWriteOncePod**를 쓴다. 스케줄러가 두 번째 파드를 `PersistentVolumeClaim with ReadWriteOncePod access mode already in-use by another pod`로 거절한다. 블록 스토리지는 RWO까지만 되므로 여러 노드에서 함께 써야 하는 데이터는 NFS나 CephFS 같은 파일 스토리지를 고른다.
{{< /callout >}}

접근 모드는 스토리지의 능력을 적는 것이지 강제하는 것이 아니다. 백엔드가 지원하지 않는 모드를 PV에 적어도 API 서버는 받아 준다. 무엇을 지원하는지는 드라이버 문서를 본다.

### 3.6 Reclaim Policy와 상태

PVC를 지웠을 때 PV와 그 뒤의 데이터를 어떻게 할지가 회수 정책이다.

| Policy | 동작 | 왜 |
|:-------|:-----|:---|
| Retain | PV는 `Released`로 남고 데이터도 남는다. 사람이 정리한다 | 실수로 클레임을 지워도 데이터가 살아 있어야 하는 DB |
| Delete | PV와 백엔드 스토리지(클라우드 디스크)까지 지운다 | 동적 프로비저닝의 기본값. 쓰고 버리는 볼륨의 청소 자동화 |
| Recycle | `rm -rf` 뒤 재사용 | deprecated. 지우는 것이 완전하지 않고 동적 프로비저닝이 그 자리를 대신한다 |

```text
Available ──바인딩──► Bound
    ▲                  │ PVC 삭제
    │ claimRef 정리     ▼
    └────────────── Released ──► Failed
                  (Retain)  (회수 실패)
```

| 상태 | 뜻 |
|:-----|:---|
| Available | 아무 클레임에도 묶이지 않은 빈 볼륨 |
| Bound | 클레임에 묶임 |
| Released | 클레임은 지워졌지만 아직 회수되지 않음. `claimRef`가 남아 있어 새 클레임이 묶이지 않는다 |
| Failed | 자동 회수(Delete)가 실패함 |

`Released`가 함정이다. Retain 정책의 PV는 클레임을 지워도 옛 클레임의 `claimRef`를 그대로 쥐고 있어서, 같은 이름으로 PVC를 다시 만들어도 `Pending`에 머문다. 데이터를 보호하려는 의도된 동작이다. 문서가 권하는 절차는 PV 객체를 지우고, 데이터를 확인하거나 정리하고, 같은 백엔드를 가리키는 PV를 새로 만드는 것이다. 데이터를 그대로 다시 쓰려면 PV의 `spec.claimRef`를 비워 `Available`로 되돌리면 된다.

```bash
kubectl patch pv mysql-pv \
  -p '{"spec":{"claimRef":null}}'
```

```bash
kubectl get pv
# NAME      CAP   MODES  RECLAIM  STATUS
# mysql-pv  20Gi  RWO    Retain   Bound
```

### 3.7 사용 중 보호

파드가 쓰고 있는 PVC를 지우면 어떻게 될까. PVC에는 `kubernetes.io/pvc-protection`, PV에는 `kubernetes.io/pv-protection` 파이널라이저가 붙어 있어서, 삭제 요청은 받아들이되 파드가 그것을 쓰는 동안은 객체가 `Terminating`으로 남고 실제로 지워지지 않는다. 파드는 계속 돌고 데이터도 읽힌다. 마지막 파드가 사라지면 그때 PVC가 지워지고 회수 정책이 실행된다. [05](../05-scheduling)장 13절의 admission 컨트롤러 StorageObjectInUseProtection이 이 파이널라이저를 붙인다. 지워지지 않는 PVC를 만났다면 어떤 파드가 아직 쓰고 있는지 먼저 본다.

---

## 4. StorageClass와 동적 프로비저닝

정적 프로비저닝은 관리자가 PV를 미리 만들어 두는 것이다. 클레임이 늘수록 관리자의 손이 든다. **StorageClass**는 "이런 스펙의 볼륨을 클레임이 생길 때 자동으로 만들어라"라는 템플릿이고, 그것을 실행하는 것이 프로비저너다.

```text
Static
1. 관리자: 디스크 생성
2. 관리자: PV 작성
3. 사용자: PVC 생성
4. 사용자: Pod에서 사용

Dynamic
1. 관리자: StorageClass 정의
2. 사용자: PVC 생성
3. 자동: PV 생성 + 바인딩
4. 사용자: Pod에서 사용
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
mountOptions:
  - noatime
```

| 필드 | 뜻 | 왜 |
|:-----|:---|:---|
| `provisioner` | 볼륨을 만들 드라이버 이름 | CSI 드라이버가 자기 이름으로 클레임을 지켜본다 |
| `parameters` | 드라이버에 넘기는 옵션. 디스크 종류, IOPS, 암호화 | 쿠버네티스는 해석하지 않고 그대로 전달한다 |
| `reclaimPolicy` | 만들어진 PV의 회수 정책. 기본 `Delete` | 3.6 |
| `allowVolumeExpansion` | PVC 크기를 늘릴 수 있게 | 7.2 |
| `volumeBindingMode` | 언제 만들고 묶는가 | 아래 |
| `mountOptions` | PV에 적힐 마운트 옵션 | 검증되지 않으므로 틀리면 마운트가 실패한다 |
| `allowedTopologies` | 어느 존에 만들 수 있는가 | 존을 제한하고 싶을 때 |

**volumeBindingMode**가 셋째 원리의 핵심이다.

| 모드 | 동작 | 왜 |
|:-----|:-----|:---|
| Immediate(기본) | PVC가 생기면 바로 볼륨을 만들고 묶는다 | 단순하다. 하지만 어느 존에 만들지 스토리지 쪽이 먼저 정한다 |
| WaitForFirstConsumer | 그 PVC를 쓰는 **파드가 스케줄될 때** 만들고 묶는다 | 클라우드 디스크는 존에 묶인다. 디스크를 A존에 먼저 만들면 파드는 A존으로만 갈 수 있고, 그 존에 자리가 없으면 영원히 Pending이다. 파드의 노드를 먼저 정하고 그 존에 디스크를 만들면 이 문제가 없다 |

WaitForFirstConsumer 모드의 PVC는 파드가 없는 동안 `Pending`이고 이벤트에 `waiting for first consumer to be created before binding`이 남는다. 이것은 오류가 아니라 정상이다. 05장의 스케줄러에 VolumeBinding 플러그인이 있는 이유가 이것이다. 스케줄러는 파드의 다른 제약과 볼륨의 토폴로지를 함께 보고 노드를 고른 뒤 프로비저너에게 "이 노드가 있는 곳에 만들어라"라고 알린다. 노드에 묶인 `local` 볼륨과 그 프로비저너 `kubernetes.io/no-provisioner`는 이 모드가 **필수**다.

### 4.2 만들어진 PV의 모습

프로비저너가 만든 PV는 이름이 `pvc-<PVC의 UID>`이고, 누가 만들었는지(`pv.kubernetes.io/provisioned-by`)와 노드에 묶인 볼륨이면 어느 노드인지가 어노테이션과 `nodeAffinity`로 적힌다. 그 PVC를 쓰는 파드를 다른 노드에 강제로 보내면 스케줄러가 `node(s) didn't match PersistentVolume's node affinity`로 거절한다. 볼륨이 파드의 배치를 제약하는 것이 이렇게 보인다.

### 4.3 주요 Provisioner

| 플랫폼 | Provisioner | Access Modes | 성격 |
|:------|:-----------|:-------------|:-----|
| AWS EBS | ebs.csi.aws.com | RWO | 존에 묶인 블록 디스크 |
| Azure Disk | disk.csi.azure.com | RWO | 블록 디스크 |
| GCP PD | pd.csi.storage.gke.io | RWO, ROX | 블록 디스크, 리전 PD |
| AWS EFS / Azure File | efs.csi.aws.com / file.csi.azure.com | RWX | 관리형 파일 스토리지 |
| NFS | nfs.csi.k8s.io | RWO/ROX/RWX | 기존 NFS 서버를 동적으로 나눠 준다 |
| Ceph | rbd.csi.ceph.com / cephfs.csi.ceph.com | RWO / RWX | 온프레미스 분산 스토리지 |
| Longhorn | driver.longhorn.io | RWO/RWX | 노드 디스크를 묶어 복제하는 클러스터 내장 스토리지 |
| Local | kubernetes.io/no-provisioner | RWO | 동적 생성 없음. 정적 local PV용 클래스 |

경량 배포판에는 노드 디스크 위의 디렉터리를 PV로 만들어 주는 간단한 프로비저너가 들어 있는 경우가 많다. k3s의 `rancher.io/local-path`가 그 예로, WaitForFirstConsumer 모드로 파드가 배정된 노드에 디렉터리를 만들고 PV에 그 노드의 어피니티를 적는다. 학습에는 충분하지만 노드가 죽으면 데이터도 없어지는 노드 범위 스토리지다.

### 4.4 기본 StorageClass

```bash
kubectl get sc

# 기본 StorageClass 지정
A=storageclass.kubernetes.io
kubectl annotate sc fast-ssd \
  $A/is-default-class=true --overwrite
```

| PVC의 `storageClassName` | 뜻 | 왜 |
|:------------------------|:---|:---|
| 생략 | 기본 StorageClass가 채워진다 | admission의 DefaultStorageClass가 넣는다(05장 13절). 기본 클래스가 나중에 생기면 이미 있던 클레임에도 소급 적용된다(1.28 GA) |
| `""` (빈 문자열) | 동적 프로비저닝을 **끈다** | 클래스 없는 정적 PV와만 묶인다. "기본값을 쓰지 않겠다"를 적는 유일한 방법 |
| 이름 | 그 클래스의 프로비저너가 만든다 | |

기본 클래스가 둘 이상이면 가장 최근에 만든 것이 쓰이지만, 하나만 두는 것이 맞다.

---

## 5. CSI 아키텍처

예전에는 스토리지 드라이버가 쿠버네티스 소스 트리 안에 있었다(in-tree). 새 벤더가 들어오려면 쿠버네티스 릴리스에 코드를 얹어야 했고, 드라이버의 버그 수정이 쿠버네티스 업그레이드에 묶였으며, 벤더 코드가 kubelet과 같은 권한으로 돌았다. **Container Storage Interface(CSI)** 는 이 결합을 gRPC 인터페이스로 끊은 표준이다. 드라이버는 별도 컨테이너로 배포되고, 쿠버네티스는 그 인터페이스만 부른다. 2.6에서 본 in-tree 플러그인 제거가 이 전환의 마무리다.

```text
표준 인터페이스
├─ CRI  (컨테이너 런타임)  01·03장
│   └─ containerd, CRI-O
├─ CNI  (네트워크)         03·07장
│   └─ Calico, Cilium, Flannel
└─ CSI  (스토리지)
    └─ EBS, Azure Disk, Ceph, NFS
```

### 5.1 CSI 3대 서비스

| 서비스 | 책임 | 대표 RPC | 어디서 도나 |
|:------|:-----|:--------|:----------|
| Identity | 드라이버 이름과 능력 알림 | GetPluginInfo, GetPluginCapabilities, Probe | 컨트롤러와 노드 양쪽 |
| Controller | 볼륨 생성·삭제, 노드에 attach·detach, 스냅샷, 확장 | CreateVolume, ControllerPublishVolume, CreateSnapshot, ControllerExpandVolume | 클러스터에 하나(Deployment) |
| Node | 노드에서 장치 마운트 | NodeStageVolume, NodePublishVolume, NodeExpandVolume | 노드마다(DaemonSet) |

Controller 서비스는 클라우드 API를 부르는 일이라 클러스터에 한 벌이면 되고, Node 서비스는 마운트라는 노드 안의 일이라 노드마다 있어야 한다. 05장 8절의 DaemonSet 용도에 CSI 노드 플러그인이 있었던 이유다.

### 5.2 사이드카와 API 객체

드라이버는 gRPC만 구현하고 쿠버네티스 API는 몰라도 된다. 그 사이를 표준 **사이드카** 컨테이너들이 잇는다. 사이드카는 API 객체를 지켜보다 드라이버의 RPC를 부른다.

| 사이드카 | 지켜보는 것 | 부르는 RPC | 왜 따로 있나 |
|:--------|:----------|:----------|:-----------|
| external-provisioner | PVC | CreateVolume, DeleteVolume | 드라이버마다 PVC 감시 코드를 쓰지 않게 |
| external-attacher | VolumeAttachment | ControllerPublish/Unpublish | attach는 노드와 볼륨의 관계라 별도 객체로 적는다 |
| external-resizer | PVC 크기 변경 | ControllerExpandVolume | 7.2 |
| external-snapshotter | VolumeSnapshot | CreateSnapshot, DeleteSnapshot | 7.1 |
| node-driver-registrar | | kubelet 플러그인 등록 소켓 | kubelet이 노드의 드라이버를 발견하는 길 |
| livenessprobe | 드라이버 소켓 | Probe | 드라이버 컨테이너의 헬스체크 |

이 과정에서 생기는 API 객체들이 있다. `CSIDriver`는 드라이버의 능력(attach가 필요한가, 파드 정보를 넘기나)을, `CSINode`는 노드마다 어떤 드라이버가 등록됐는지를, `VolumeAttachment`는 "이 볼륨을 이 노드에 붙여라"라는 요청을, `CSIStorageCapacity`는 토폴로지별 남은 용량을 적는다. `kubectl get csidrivers,csinodes,volumeattachments`로 볼 수 있다.

### 5.3 볼륨 프로비저닝 흐름

```text
PVC 생성 (+ 파드 스케줄)
   │
   ▼
CreateVolume      Controller
   │  디스크가 생기고 PV가 만들어진다
   ▼
ControllerPublishVolume
   │  노드에 attach (VolumeAttachment)
   ▼
NodeStageVolume   Node
   │  노드 전역 경로에 한 번 마운트
   ▼
NodePublishVolume
   │  파드 경로에 bind mount
   ▼
컨테이너에서 사용
```

Stage와 Publish가 둘로 나뉜 이유가 있다. Stage는 노드에 장치를 한 번 마운트하는 것이고(`/var/lib/kubelet/plugins/...` 아래의 전역 경로), Publish는 그 마운트를 파드마다 `/var/lib/kubelet/pods/<파드 UID>/volumes/...`에 bind mount로 붙이는 것이다. 같은 노드의 파드 여럿이 하나의 볼륨을 쓸 때 장치 마운트는 한 번만 하고 파드마다 경로만 늘리면 된다. 3.5의 "RWO는 노드 단위"가 구현 수준에서는 이 구조다. 정리는 역순으로 `NodeUnpublish → NodeUnstage → ControllerUnpublish → DeleteVolume`이다. 파드가 죽으면 Unpublish까지만 일어나고, 클레임이 지워질 때 Delete 정책이면 마지막까지 간다.

### 5.4 주요 CSI Driver

| Provider | Driver | 비고 |
|:--------|:-------|:-----|
| AWS | ebs.csi.aws.com, efs.csi.aws.com | gp3, io2 / 파일 스토리지 |
| Azure | disk.csi.azure.com, file.csi.azure.com | Premium/Standard |
| GCP | pd.csi.storage.gke.io | Regional PD |
| Ceph | rbd.csi.ceph.com, cephfs.csi.ceph.com | 블록 / 분산 파일(RWX) |
| Longhorn | driver.longhorn.io | 노드 디스크 복제 |
| Portworx | pxd.portworx.com | 엔터프라이즈 |
| NFS | nfs.csi.k8s.io | 기존 NFS 서버 재활용 |

---

## 6. StatefulSet과 VolumeClaimTemplate

Deployment에 PVC를 연결하면 모든 복제본이 **같은 PVC**를 가리킨다. RWO 볼륨이면 첫 파드가 있는 노드로만 파드가 갈 수 있고, 갈 수 있어도 같은 파일에 여러 프로세스가 쓰게 된다. 복제본마다 자기 데이터가 있어야 하는 DB에는 맞지 않는다. **StatefulSet**은 파드에 고정된 번호를 주고, `volumeClaimTemplates`로 번호마다 PVC를 만들어 그 짝을 유지하는 컨트롤러다. 02장과 04장에서 미뤄 둔 "내가 누구인지가 중요한 앱"의 답이다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None        # headless
  selector:
    app: mysql
  ports:
  - port: 3306
---
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
      accessModes: ["ReadWriteOncePod"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

### 6.1 세 가지 고정

| 고정되는 것 | 형태 | 왜 |
|:----------|:-----|:---|
| 이름 | `mysql-0`, `mysql-1`, `mysql-2`. 지워져도 같은 번호로 다시 뜬다 | 복제본이 "나는 1번"임을 알아야 리더 선출과 복제 설정이 된다 |
| 스토리지 | PVC `data-mysql-0`, `data-mysql-1`, … (`<템플릿>-<파드>`) | 1번 파드가 다시 떠도 1번 데이터를 다시 받는다 |
| 네트워크 이름 | `mysql-0.mysql.<네임스페이스>.svc.cluster.local` | 파드 IP는 바뀌지만 이름은 남는다 |

네트워크 이름은 `serviceName`이 가리키는 **headless Service**(`clusterIP: None`)가 준다. 보통 Service는 가상 IP 하나로 파드들을 숨기지만, headless Service는 DNS가 파드 IP들을 그대로 돌려주고 파드마다 `<파드>.<서비스>` 이름을 만든다([07](../07-networking)장 10절). 복제본이 서로를 이름으로 찾아야 하는 클러스터형 DB에 필요한 것이 바로 이것이다. 이 Service는 StatefulSet이 만들어 주지 않으므로 사람이 만든다.

### 6.2 순서 보장

| 동작 | 규칙 | 왜 |
|:-----|:-----|:---|
| 생성 | 0번부터 차례로. 앞 파드가 Running이고 Ready여야 다음을 만든다 | 0번이 리더로 초기화된 뒤 1번이 붙어야 하는 시스템이 많다 |
| 삭제·축소 | 큰 번호부터 역순으로 | 마지막에 들어온 것이 먼저 나간다 |
| 업데이트 | 큰 번호부터 하나씩 | 리더(보통 0번)를 마지막에 건드린다 |

이 규칙은 `podManagementPolicy: OrderedReady`(기본)의 것이고, 순서가 필요 없으면 `Parallel`로 한 번에 띄운다. 업데이트 전략 `RollingUpdate`의 `partition`을 주면 그 번호 이상만 새 버전으로 바뀌어 카나리를 만들 수 있다. `partition: 2`면 3개 중 `mysql-2`만 새 템플릿을 받는다. `OnDelete`는 사람이 파드를 지울 때만 바꾼다. 어느 쪽이든 파드는 자기 번호의 PVC를 다시 마운트하므로 데이터는 그대로다. StatefulSet 객체를 지우는 것은 순서를 보장하지 않으므로 순서가 중요하면 `replicas: 0`으로 줄인 뒤 지운다.

### 6.3 PVC 보존 정책

StatefulSet을 지우거나 줄여도 PVC는 기본으로 **남는다.** 데이터 보호가 기본값인 것이다. 대신 방치된 PVC가 쌓이므로 정책으로 정한다(1.32 GA).

```yaml
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain   # 삭제 시
    whenScaled: Delete    # 축소 시
```

| 상황 | Retain | Delete |
|:-----|:-------|:-------|
| `whenScaled` | 3개에서 1개로 줄여도 `data-mysql-1`, `data-mysql-2`가 남고, 다시 늘리면 그 데이터로 뜬다 | 줄어든 번호의 PVC를 지운다. 캐시처럼 다시 만들 수 있는 데이터 |
| `whenDeleted` | StatefulSet을 지워도 PVC 전부 보존 | 함께 지운다. 테스트 환경 |

{{< callout type="info" >}}
파드 `mysql-1`을 `kubectl delete`해도 같은 이름의 파드가 같은 `data-mysql-1`을 마운트해 돌아온다. 파드 삭제는 재시작에 가깝고 데이터는 건드리지 않는다. 데이터를 지우는 것은 PVC 삭제이고, 그것을 자동으로 하는 것은 위 정책만이다. 시작 번호를 0 대신 다른 값으로 두는 `.spec.ordinals.start`(1.31 GA)는 StatefulSet을 클러스터 사이로 옮길 때 번호 충돌을 피하는 용도다.
{{< /callout >}}

---

## 7. 고급 기능

### 7.1 VolumeSnapshot

동작 중인 PVC의 시점 사본을 만들고, 그 사본에서 새 PVC를 만든다. PV/PVC/StorageClass와 같은 삼각 구조다.

| 스냅샷 객체 | 대응 | 뜻 |
|:----------|:-----|:---|
| VolumeSnapshotContent | PV | 실제 만들어진 스냅샷 |
| VolumeSnapshot | PVC | 사용자의 스냅샷 요청 |
| VolumeSnapshotClass | StorageClass | 어느 드라이버로 어떻게 찍나, `deletionPolicy` |

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

세 객체는 코어 API가 아니라 CRD다. 스냅샷 컨트롤러와 CRD는 배포판이나 관리자가 따로 설치하고, 드라이버 쪽에는 external-snapshotter 사이드카가 있어야 한다. 설치되지 않은 클러스터에서는 `kubectl api-resources`에 `volumesnapshots`가 없다. 스냅샷은 디스크 수준의 복사라 **크래시 일관성**만 보장한다. 쓰는 도중의 DB를 찍으면 전원이 나간 순간의 디스크와 같으므로, 정합성이 필요하면 애플리케이션을 잠시 멈추거나 플러시한 뒤 찍는다. `dataSource`에는 스냅샷뿐 아니라 다른 PVC를 적어 볼륨을 복제할 수도 있다. etcd 백업은 별개의 주제로 [10](../10-cluster-maintenance)장 11절에서 다룬다.

### 7.2 볼륨 확장

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: expandable
provisioner: ebs.csi.aws.com
allowVolumeExpansion: true
```

PVC의 `resources.requests.storage`를 늘려 저장하면 확장이 시작된다. 조건과 순서가 있다.

| 조건·단계 | 내용 | 왜 |
|:---------|:-----|:---|
| 조건 | 동적으로 만들어진 PVC이고, 그 StorageClass에 `allowVolumeExpansion: true` | 아니면 API 서버가 `only dynamically provisioned pvc can be resized and the storageclass that provisions the pvc must support resize`로 거절한다 |
| 조건 | 늘리기만 된다 | 줄이면 파일 시스템의 데이터가 잘린다 |
| 1단계 | external-resizer가 ControllerExpandVolume을 불러 디스크를 키운다 | 클라우드 API의 일 |
| 2단계 | 노드의 kubelet이 NodeExpandVolume으로 파일 시스템을 키운다 | 마운트된 노드에서만 할 수 있는 일. 그동안 PVC 조건이 `FileSystemResizePending`이다 |

파일 시스템 확장을 온라인으로 하는 드라이버가 많지만, 파드를 다시 띄워야 2단계가 실행되는 드라이버도 있다. 잘못된 크기로 확장을 요청해 실패했을 때 되돌리는 것은 오래 불가능했는데, 1.34부터는 실패한 확장 요청을 더 작은 값으로 다시 적어 회복할 수 있다(RecoverVolumeExpansionFailure GA).

### 7.3 VolumeAttributesClass

용량이 아니라 **성능 속성**을 바꾸는 장치다(1.34 GA). StorageClass의 `parameters`는 만들 때 한 번 쓰이고 바꿀 수 없지만, VolumeAttributesClass는 IOPS나 처리량 같은 드라이버의 가변 속성을 묶은 클래스이고, PVC의 `volumeAttributesClassName`을 바꾸면 드라이버가 ModifyVolume으로 볼륨을 다시 설정한다. 낮에는 `gold`, 밤에는 `silver`로 바꾸는 식의 운영이 파드 재시작 없이 된다. 드라이버가 ModifyVolume을 구현해야 한다.

```yaml
apiVersion: storage.k8s.io/v1
kind: VolumeAttributesClass
metadata:
  name: silver
driverName: ebs.csi.aws.com
parameters:
  iops: "3000"
  throughput: "125"
```

### 7.4 마운트 세부: fsGroup, subPath, mountPropagation

| 설정 | 하는 일 | 왜 필요한가 |
|:-----|:-------|:-----------|
| `securityContext.fsGroup` | 볼륨의 소유 그룹을 바꾸고 디렉터리에 setgid를 건다 | 컨테이너가 root가 아닐 때 볼륨에 쓸 수 있게. 파일이 많은 볼륨은 소유권 변경이 오래 걸리므로 `fsGroupChangePolicy: OnRootMismatch`로 루트만 볼 수 있다 |
| `volumeMounts.subPath` | 볼륨의 하위 경로만 붙인다 | 볼륨 하나를 여러 컨테이너가 다른 디렉터리로 나눠 쓴다. 단, 04장에서 본 대로 ConfigMap 갱신이 전달되지 않는다 |
| `subPathExpr` | 환경 변수로 하위 경로를 만든다 | `$(POD_NAME)`별 디렉터리 |
| `mountPropagation` | `None`(기본), `HostToContainer`, `Bidirectional` | 컨테이너가 마운트한 것을 호스트나 다른 컨테이너에 보이게. CSI 노드 플러그인이 `Bidirectional`을 쓴다 |
| `readOnly` | 읽기 전용 마운트 | hostPath와 설정 볼륨은 기본으로 이것 |

### 7.5 다중 볼륨 Pod

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

설정은 ConfigMap으로, 캐시는 tmpfs로, 데이터는 PVC로. 한 파드에 세 범위의 볼륨이 함께 있는 것이 보통이다. 각각의 수명이 다르다는 것을 알고 붙이면 된다.

---

## 8. kubectl 명령어

```bash
# PV / PVC
kubectl get pv
kubectl get pvc -A
kubectl describe pvc my-pvc

# StorageClass
kubectl get sc
kubectl describe sc fast-ssd

# CSI 객체
kubectl get csidrivers,csinodes
kubectl get volumeattachments

# 바인딩 실패 디버깅
kubectl describe pvc my-pvc   # Events
kubectl get events \
  --field-selector \
    reason=FailedScheduling

# 파드 안에서 마운트 확인
kubectl exec -it mysql-0 -- df -h
kubectl exec -it mysql-0 -- \
  mount | grep /var/lib/mysql

# Retain된 PV 되살리기
kubectl patch pv mysql-pv \
  -p '{"spec":{"claimRef":null}}'
```

Pending인 PVC의 원인은 `describe pvc`의 이벤트에 있다. `waiting for first consumer`는 정상 대기, `no persistent volumes available for this claim and no storage class is set`은 정적 PV가 없고 클래스도 없는 것, 프로비저너 오류는 드라이버의 메시지가 그대로 붙는다. 파드가 Pending이면 스케줄러 이벤트를 본다. `didn't match PersistentVolume's node affinity`는 볼륨이 있는 노드로 갈 수 없는 것이고, `ReadWriteOncePod ... already in-use`는 3.5다. 진단 순서 전체는 [14](../14-troubleshooting)장 11절이다.

---

## 9. 실무 선택 가이드

### 9.1 용도별 권장 구성

| 시나리오 | 권장 | 왜 |
|:--------|:-----|:---|
| 컨테이너 간 임시 공유 | emptyDir | 파드와 함께 없어져도 된다 |
| 캐시, RAM 디스크 | emptyDir + `medium: Memory` + `sizeLimit` | 메모리 limit에서 차감되니 한도를 적는다 |
| 노드 로그·메트릭 수집 | hostPath(DaemonSet, readOnly) | 노드 자원이 목적이다 |
| 노드 디스크 성능이 필요한 DB | local PV + WaitForFirstConsumer | 노드 어피니티로 안전하게 노드에 묶는다 |
| 단일 파드 DB(클라우드) | StorageClass(gp3 등) + PVC + RWOP | 동적 프로비저닝, 파드 하나로 배타 |
| 클러스터형 DB(MySQL 복제, Kafka) | StatefulSet + volumeClaimTemplates | 복제본마다 데이터와 이름 |
| 여러 파드 공용 파일 저장소 | RWX 파일 스토리지(NFS, EFS, CephFS) | 블록 디스크는 노드 하나뿐 |
| 파드 수명의 큰 스크래치 | generic ephemeral volume | 노드 디스크보다 큰 임시 공간 |
| 백업·복제 | VolumeSnapshot + 정합성 확보 | 크래시 일관성의 한계 |

### 9.2 체크리스트

- 상태가 남아야 하는가 → PV/PVC. 복제본마다 다른 데이터인가 → StatefulSet
- 여러 노드에서 동시에 써야 하는가 → RWX 스토리지. 파드 하나로 막아야 하는가 → RWOP
- 클라우드인가 → StorageClass + WaitForFirstConsumer로 존 문제를 피한다
- 데이터가 클레임보다 중요한가 → `reclaimPolicy: Retain`, 그리고 Released 상태의 되살리기 절차를 알아 둔다
- 커질 수 있는가 → `allowVolumeExpansion: true`. 줄이는 것은 안 된다
- 규정이 있는가 → 암호화 파라미터, `readOnly`, 비 root 컨테이너와 `fsGroup`, hostPath 금지 정책

---

## 핵심 정리

| 개념 | 설명 | 왜 |
|:-----|:-----|:---|
| Volume | 파드의 컨테이너들이 붙이는 스토리지 추상화 | 쓰기 계층은 컨테이너와 함께 사라진다 |
| emptyDir / hostPath / local | 파드 수명 / 노드 수명 / 노드에 묶인 PV | 데이터가 무엇과 함께 죽어도 되는가 |
| PV / PVC | 공급의 선언 / 요구의 선언. 1:1 바인딩, 가장 작은 적합 볼륨 | 관리자와 개발자의 관심사 분리 |
| Access Mode | RWO는 노드 하나, RWX는 여러 노드, RWOP는 파드 하나 | attach는 노드 단위의 사건 |
| Reclaim Policy | Retain은 Released로 남고 `claimRef`를 비워야 재사용, Delete는 백엔드까지 삭제 | 데이터 보호가 기본 |
| StorageClass | 요청 시점에 PV를 만드는 템플릿. WaitForFirstConsumer로 파드 배치 뒤 생성 | 존에 묶인 디스크와 스케줄링의 충돌을 피한다 |
| CSI | Controller(생성·attach)와 Node(마운트) 서비스, 사이드카가 API와 잇는다 | 드라이버를 쿠버네티스 밖으로 |
| StatefulSet | 번호 고정, 번호별 PVC, headless DNS 이름, 순서 보장 | 복제본마다 자기 데이터와 정체성 |
| Snapshot / Expansion / VolumeAttributesClass | 시점 복사 / 늘리기만 / 성능 속성 변경 | 운영 중 볼륨을 다루는 세 가지 길 |

{{< callout type="info" >}}
**용어 정리**
- **Copy-on-Write 쓰기 계층**: 컨테이너가 고친 파일이 쌓이는 최상위 레이어. 컨테이너와 함께 소멸
- **emptyDir**: 파드 수명의 빈 디렉터리. `medium: Memory`면 tmpfs
- **hostPath / local**: 노드 경로 마운트 / 노드 어피니티가 있는 노드 디스크 PV
- **PV (PersistentVolume)**: 클러스터 범위의 실제 스토리지 선언
- **PVC (PersistentVolumeClaim)**: 네임스페이스 범위의 스토리지 요청
- **claimRef / volumeName**: PV와 PVC의 양방향 참조. 미리 적으면 예약
- **Access Mode**: RWO, ROX, RWX, RWOP
- **Reclaim Policy**: Retain / Delete / Recycle(deprecated)
- **Released**: 클레임은 사라졌지만 `claimRef`가 남은 PV 상태
- **StorageClass / Provisioner**: 동적 프로비저닝 템플릿 / 그것을 실행하는 드라이버
- **volumeBindingMode**: Immediate / WaitForFirstConsumer
- **CSI**: Identity, Controller, Node 서비스로 이루어진 스토리지 드라이버 표준
- **VolumeAttachment / CSIDriver / CSINode**: attach 요청 / 드라이버 능력 / 노드별 등록 정보
- **volumeClaimTemplates**: StatefulSet이 파드 번호마다 PVC를 만드는 템플릿
- **headless Service**: `clusterIP: None`. 파드마다 DNS 이름을 만든다
- **persistentVolumeClaimRetentionPolicy**: StatefulSet 삭제·축소 시 PVC 처리
- **VolumeSnapshot / VolumeAttributesClass**: 시점 복사 / 가변 성능 속성 클래스
- **generic ephemeral volume**: 파드가 소유하는 PVC. 파드와 함께 생성·삭제
{{< /callout >}}
