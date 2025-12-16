---
title: "Kubernetes 설치 및 환경구성"
weight: 3
---

## 1. 쿠버네티스 설치 요구사항

### 운영체제

| OS | 최소 버전 |
|----|----------|
| Ubuntu | 16.04+ |
| Debian | 9+ |
| CentOS | 7+ |
| RHEL | 7+ |
| Fedora | 25+ |

### 하드웨어

| 항목 | 요구사항 |
|------|----------|
| **CPU** | 2개 이상 (필수) |
| **메모리** | 2GB 이상 |

### 네트워크

| 항목 | 설명 |
|------|------|
| 고유 MAC 주소 | `ifconfig -a` 또는 `ip link`로 확인 |
| 고유 product_uuid | `sudo cat /sys/class/dmi/id/product_uuid`로 확인 |

---

## 2. 포트 구성

### 마스터 노드

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| **6443** | TCP | API 서버 |
| **2379-2380** | TCP | etcd 클라이언트 API |
| **10250** | TCP | kubelet API |
| **10251** | TCP | 스케줄러 |
| **10252** | TCP | 컨트롤러 매니저 |

### 워커 노드

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| **10250** | TCP | kubelet API |
| **30000-32767** | TCP | 노드포트 서비스 |

### 방화벽 설정

```bash
# 마스터 노드
sudo firewall-cmd --permanent --add-port=6443/tcp
sudo firewall-cmd --permanent --add-port=2379-2380/tcp
sudo firewall-cmd --permanent --add-port=10250/tcp
sudo firewall-cmd --permanent --add-port=10251/tcp
sudo firewall-cmd --permanent --add-port=10252/tcp
sudo firewall-cmd --reload

# 워커 노드
sudo firewall-cmd --permanent --add-port=10250/tcp
sudo firewall-cmd --permanent --add-port=30000-32767/tcp
sudo firewall-cmd --reload
```

---

## 3. 설치 방법

### 경량 버전 (학습/개발용)

```
┌─────────────────────────────────────────────────────────────┐
│                     경량 쿠버네티스                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│    Minikube     │      k3s        │         kind            │
├─────────────────┼─────────────────┼─────────────────────────┤
│  단일 노드       │   경량 버전      │   Docker 기반           │
│  개인 PC용       │   Rancher사 개발 │   다중 노드 지원         │
│  학습용 최적     │   리소스 효율적   │   Kubernetes IN Docker  │
└─────────────────┴─────────────────┴─────────────────────────┘
```

| 도구 | 특징 | 노드 구성 |
|------|------|----------|
| **Minikube** | 개인 PC에서 간편 설치 | 단일 노드 |
| **k3s** | Rancher사 개발, 경량화 | 단일/다중 |
| **kind** | Docker 컨테이너 기반 | **다중 노드 지원** |

### 서버/데스크톱 설치

#### 방법 1: 가상화 툴 이용

| 도구 | 비용 |
|------|------|
| VMWare | 유료 |
| VirtualBox | 유료 |
| **Hyper-V** | **무료** (Windows 기본 제공) |

#### 방법 2: 직접 설치 (kubeadm)

> **kubeadm**: 쿠버네티스 공식 클러스터 구축 도구

```bash
# kubeadm으로 클러스터 초기화
sudo kubeadm init

# 워커 노드 조인
sudo kubeadm join <master-ip>:6443 --token <token> ...
```

---

## 4. 클라우드 서비스 (Managed Kubernetes)

> PaaS 형태로 제공되는 관리형 쿠버네티스

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Kubernetes Services                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│      AWS        │     Azure       │     Google Cloud        │
│      EKS        │      AKS        │        GKE              │
│                 │                 │                         │
│    Elastic      │     Azure       │      Google             │
│   Kubernetes    │   Kubernetes    │    Kubernetes           │
│    Service      │    Service      │      Engine             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

| 클라우드 | 서비스명 | 전체 이름 |
|----------|----------|-----------|
| **AWS** | EKS | Elastic Kubernetes Service |
| **Azure** | AKS | Azure Kubernetes Service |
| **GCP** | GKE | Google Kubernetes Engine |

### 클라우드 vs 직접 설치

| 구분 | 클라우드 (EKS/AKS/GKE) | 직접 설치 (kubeadm) |
|------|------------------------|---------------------|
| 마스터 노드 관리 | **자동** (클라우드 제공) | 직접 관리 |
| 업그레이드 | 간편 | 수동 |
| 비용 | 시간당 과금 | 서버 비용만 |
| 설정 복잡도 | 낮음 | 높음 |

---

## 5. Windows 환경 설정

### WSL (Windows Subsystem for Linux)

> Windows 10+ 에서 리눅스 환경 제공

```powershell
# PowerShell에서 WSL 설치
wsl --install

# Ubuntu 배포판 설치
wsl --install -d Ubuntu
```

### Docker Desktop

Windows/Mac에서 Docker + Kubernetes 간편 설치

```
Docker Desktop 설정 → Kubernetes → Enable Kubernetes ✓
```

---

## 6. 설치 옵션 선택 가이드

```
┌─────────────────────────────────────────────────────────────┐
│                    어떤 용도인가요?                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  학습용   │    │  개발용   │    │  운영용   │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Minikube │    │  kind    │    │ EKS/AKS  │
    │  Docker  │    │   k3s    │    │   GKE    │
    │ Desktop  │    │ kubeadm  │    │ kubeadm  │
    └──────────┘    └──────────┘    └──────────┘
```

| 용도 | 추천 도구 |
|------|-----------|
| **학습/입문** | Minikube, Docker Desktop |
| **로컬 개발** | kind, k3s |
| **팀 개발** | kubeadm, k3s |
| **프로덕션** | EKS, AKS, GKE, kubeadm |

---

## 요약

| 항목 | 핵심 |
|------|------|
| **최소 사양** | CPU 2개, 메모리 2GB |
| **마스터 포트** | 6443 (API), 2379-2380 (etcd), 10250-10252 |
| **워커 포트** | 10250, 30000-32767 (NodePort) |
| **경량 버전** | Minikube (단일), k3s (경량), kind (다중) |
| **직접 설치** | kubeadm (공식 도구) |
| **클라우드** | EKS (AWS), AKS (Azure), GKE (Google) |
| **Windows** | WSL, Docker Desktop |

### 빠른 시작 (Minikube)

```bash
# Minikube 설치 후
minikube start

# 상태 확인
minikube status

# kubectl 사용
kubectl get nodes
```

### 빠른 시작 (kind)

```bash
# kind 설치 후
kind create cluster

# 다중 노드 클러스터
kind create cluster --config kind-config.yaml

# 클러스터 삭제
kind delete cluster
```
