---
title: "Logging & Monitoring"
weight: 3
---

Kubernetes 클러스터와 애플리케이션의 모니터링 및 로깅을 다룹니다.

---

## 1. 클러스터 모니터링

### 1.1 모니터링 대상

```
Node 레벨:
├── 노드 수 및 건강 상태
├── CPU 사용률
├── Memory 사용률
├── Network I/O
└── Disk 사용률

Pod 레벨:
├── Pod 수
├── 각 Pod의 CPU 사용량
├── 각 Pod의 Memory 사용량
└── 컨테이너 상태
```

### 1.2 모니터링 솔루션

| 유형 | 솔루션 | 특징 |
|:-----|:-------|:-----|
| 경량 | Metrics Server | 실시간 메트릭, 인메모리 |
| 오픈소스 | Prometheus + Grafana | 시계열 DB, 강력한 쿼리, 시각화 |
| 오픈소스 | Elastic Stack (ELK) | 로그 수집/분석 |
| 상용 | Datadog, Dynatrace, New Relic | 통합 모니터링 |

{{< callout type="info" >}}
**Heapster는 Deprecated되었다.** Kubernetes 1.11부터 Metrics Server로 대체되었다.
{{< /callout >}}

---

## 2. Metrics Server

### 2.1 개념

```
특징:
- 클러스터당 1개 배포
- 인메모리 저장 (디스크 저장 없음)
- 실시간 데이터만 제공 (히스토리 없음)
- kubectl top 명령어 지원
- HPA(Horizontal Pod Autoscaler)에서 사용
```

### 2.2 메트릭 수집 구조

```
┌─────────────────────────────────────────────┐
│                 Metrics Server              │
│         (메트릭 집계 및 메모리 저장)          │
└─────────────────────────────────────────────┘
                      ↑
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   kubelet   │ │   kubelet   │ │   kubelet   │
│  (Node 1)   │ │  (Node 2)   │ │  (Node 3)   │
├─────────────┤ ├─────────────┤ ├─────────────┤
│  cAdvisor   │ │  cAdvisor   │ │  cAdvisor   │
│ (컨테이너   │ │ (컨테이너   │ │ (컨테이너   │
│  메트릭)    │ │  메트릭)    │ │  메트릭)    │
└─────────────┘ └─────────────┘ └─────────────┘
```

**cAdvisor (Container Advisor):**
- kubelet에 내장된 컴포넌트
- 컨테이너 리소스 사용량 수집
- CPU, Memory, 네트워크, 파일시스템 메트릭

### 2.3 설치

**Minikube:**

```bash
minikube addons enable metrics-server
```

**일반 클러스터:**

```bash
# 공식 매니페스트로 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 설치 확인
kubectl get deployment metrics-server -n kube-system
kubectl get pods -n kube-system | grep metrics-server
```

**Self-signed 인증서 환경 (테스트용):**

```bash
# --kubelet-insecure-tls 옵션 추가 필요
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```

### 2.4 메트릭 조회

```bash
# 노드 메트릭
kubectl top node

# 출력 예시:
# NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
# master   166m         8%     1024Mi          40%
# worker1  234m         11%    2048Mi          65%
# worker2  89m          4%     512Mi           20%

# Pod 메트릭
kubectl top pod

# 네임스페이스 지정
kubectl top pod -n kube-system

# 모든 네임스페이스
kubectl top pod -A

# 정렬 (CPU 기준)
kubectl top pod --sort-by=cpu

# 정렬 (Memory 기준)
kubectl top pod --sort-by=memory

# 특정 Pod의 컨테이너별 메트릭
kubectl top pod my-pod --containers
```

### 2.5 메트릭 단위

| 리소스 | 단위 | 예시 |
|:-------|:-----|:-----|
| CPU | millicores (m) | 166m = 0.166 cores, 1000m = 1 core |
| Memory | Mi, Gi | 1024Mi = 1Gi |

### 2.6 제한사항

```
Metrics Server 제한:
❌ 히스토리 데이터 없음
❌ 알림/알람 기능 없음
❌ 복잡한 쿼리 불가
❌ 영구 저장 없음

고급 모니터링 필요 시:
✅ Prometheus: 시계열 데이터베이스, PromQL
✅ Grafana: 대시보드/시각화
✅ Alertmanager: 알림 관리
```

---

## 3. 애플리케이션 로깅

### 3.1 Docker 로깅 기본

```bash
# 포그라운드 실행 - stdout으로 로그 출력
docker run nginx

# 백그라운드 실행
docker run -d nginx

# 로그 확인
docker logs <container-id>

# 실시간 로그 스트리밍
docker logs -f <container-id>

# 최근 N줄만
docker logs --tail 100 <container-id>
```

### 3.2 Kubernetes Pod 로깅

**단일 컨테이너 Pod:**

```bash
# 기본 로그 조회
kubectl logs <pod-name>

# 실시간 스트리밍 (-f, --follow)
kubectl logs -f <pod-name>

# 이전 컨테이너 로그 (재시작된 경우)
kubectl logs <pod-name> --previous

# 최근 N줄만
kubectl logs <pod-name> --tail=100

# 특정 시간 이후 로그
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --since=30m
kubectl logs <pod-name> --since=10s

# 타임스탬프 포함
kubectl logs <pod-name> --timestamps

# 네임스페이스 지정
kubectl logs <pod-name> -n <namespace>
```

**다중 컨테이너 Pod:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  containers:
  - name: web-server
    image: nginx
  - name: log-agent
    image: fluentd
  - name: sidecar
    image: busybox
    command: ['sh', '-c', 'while true; do echo sidecar log; sleep 5; done']
```

```bash
# 컨테이너 지정 필수 (-c 옵션)
kubectl logs multi-container-pod -c web-server
kubectl logs multi-container-pod -c log-agent
kubectl logs multi-container-pod -c sidecar

# 실시간 스트리밍
kubectl logs -f multi-container-pod -c web-server

# 모든 컨테이너 로그 (--all-containers)
kubectl logs multi-container-pod --all-containers

# 이전 로그 + 컨테이너 지정
kubectl logs multi-container-pod -c web-server --previous
```

{{< callout type="warning" >}}
**다중 컨테이너 Pod에서 -c 옵션 없이 실행하면:**
```
error: a container name must be specified for pod multi-container-pod,
choose one of: [web-server log-agent sidecar]
```
{{< /callout >}}

### 3.3 명령어 비교

| Docker | Kubernetes | 설명 |
|:-------|:-----------|:-----|
| `docker logs <id>` | `kubectl logs <pod>` | 로그 조회 |
| `docker logs -f <id>` | `kubectl logs -f <pod>` | 실시간 스트리밍 |
| N/A | `kubectl logs <pod> -c <container>` | 컨테이너 지정 |
| N/A | `kubectl logs <pod> --previous` | 이전 컨테이너 로그 |

### 3.4 라벨 기반 로그 조회

```bash
# 라벨 셀렉터로 여러 Pod 로그
kubectl logs -l app=nginx

# 라벨 + 실시간 스트리밍 (여러 Pod)
kubectl logs -f -l app=nginx --all-containers

# 특정 Deployment의 모든 Pod 로그
kubectl logs deployment/nginx

# 최근 로그만
kubectl logs -l app=nginx --tail=50
```

---

## 4. 클러스터 컴포넌트 로그

### 4.1 Control Plane 컴포넌트 로그

**kubeadm 설치 환경 (Static Pod):**

```bash
# API Server 로그
kubectl logs kube-apiserver-master -n kube-system

# Controller Manager 로그
kubectl logs kube-controller-manager-master -n kube-system

# Scheduler 로그
kubectl logs kube-scheduler-master -n kube-system

# etcd 로그
kubectl logs etcd-master -n kube-system
```

**systemd 서비스 환경:**

```bash
# API Server
journalctl -u kube-apiserver

# Controller Manager
journalctl -u kube-controller-manager

# Scheduler
journalctl -u kube-scheduler

# kubelet
journalctl -u kubelet

# 실시간 스트리밍
journalctl -u kubelet -f

# 최근 로그만
journalctl -u kubelet --since "1 hour ago"
```

### 4.2 Worker Node 컴포넌트

```bash
# kubelet 로그
journalctl -u kubelet

# kube-proxy 로그 (DaemonSet)
kubectl logs -l k8s-app=kube-proxy -n kube-system

# Container Runtime 로그
journalctl -u containerd
journalctl -u docker  # Docker 사용 시
```

---

## 5. 이벤트 조회

### 5.1 클러스터 이벤트

```bash
# 모든 이벤트
kubectl get events

# 시간순 정렬
kubectl get events --sort-by='.lastTimestamp'

# 특정 네임스페이스
kubectl get events -n kube-system

# 모든 네임스페이스
kubectl get events -A

# Watch 모드
kubectl get events -w
```

### 5.2 특정 리소스 이벤트

```bash
# Pod 이벤트 (describe에 포함)
kubectl describe pod nginx

# 특정 리소스 관련 이벤트 필터
kubectl get events --field-selector involvedObject.name=nginx

# 특정 타입 이벤트
kubectl get events --field-selector type=Warning
kubectl get events --field-selector type=Normal

# 조합
kubectl get events --field-selector type=Warning,involvedObject.kind=Pod
```

---

## 6. 디버깅 시나리오

### 6.1 Pod 시작 실패

```bash
# 1. Pod 상태 확인
kubectl get pods
kubectl describe pod <pod-name>

# 2. 이벤트 확인 (describe 하단)
# Events:
#   Type     Reason     Age   From               Message
#   ----     ------     ----  ----               -------
#   Warning  Failed     5s    kubelet            Error: ImagePullBackOff

# 3. 로그 확인 (컨테이너가 시작된 경우)
kubectl logs <pod-name>

# 4. 이전 컨테이너 로그 (CrashLoopBackOff인 경우)
kubectl logs <pod-name> --previous
```

### 6.2 Pod 상태별 디버깅

| 상태 | 확인 방법 |
|:-----|:---------|
| Pending | `kubectl describe pod` - 스케줄링 실패 원인 확인 |
| ImagePullBackOff | 이미지 이름, 레지스트리 인증 확인 |
| CrashLoopBackOff | `kubectl logs --previous` - 크래시 원인 확인 |
| Running (but not working) | `kubectl logs`, `kubectl exec` 로 내부 상태 확인 |

### 6.3 컨테이너 내부 디버깅

```bash
# 컨테이너 접속
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec -it <pod-name> -- /bin/sh  # bash 없는 경우

# 다중 컨테이너
kubectl exec -it <pod-name> -c <container-name> -- /bin/bash

# 단일 명령 실행
kubectl exec <pod-name> -- ls /app
kubectl exec <pod-name> -- cat /var/log/app.log
kubectl exec <pod-name> -- env

# 프로세스 확인
kubectl exec <pod-name> -- ps aux

# 네트워크 확인
kubectl exec <pod-name> -- curl localhost:8080/health
```

### 6.4 리소스 문제 디버깅

```bash
# 노드 리소스 확인
kubectl top nodes
kubectl describe node <node-name>

# Pod 리소스 확인
kubectl top pods
kubectl describe pod <pod-name>

# 리소스 요청/제한 확인
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].resources}'
```

---

## 7. 로깅 아키텍처 패턴

### 7.1 Sidecar 패턴

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  containers:
  # 애플리케이션 컨테이너
  - name: app
    image: myapp:v1
    volumeMounts:
    - name: log-volume
      mountPath: /var/log/app

  # 로그 수집 사이드카
  - name: log-collector
    image: fluentd
    volumeMounts:
    - name: log-volume
      mountPath: /var/log/app
      readOnly: true

  volumes:
  - name: log-volume
    emptyDir: {}
```

### 7.2 Node-level 로깅

```
각 노드에 로그 에이전트 배포 (DaemonSet):

┌─────────────────────────────────────────┐
│                 Node                     │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  Pod 1  │  │  Pod 2  │  │  Pod 3  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       │            │            │       │
│       └────────────┼────────────┘       │
│                    ↓                     │
│  ┌─────────────────────────────────────┐│
│  │   Log Agent (Fluentd/Fluent Bit)   ││
│  │        /var/log/containers/         ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                    ↓
           ┌───────────────┐
           │ Log Backend   │
           │ (Elasticsearch│
           │  Loki, etc.)  │
           └───────────────┘
```

### 7.3 로그 저장 위치

```bash
# 컨테이너 로그 (노드에서)
/var/log/containers/*.log

# Pod 로그 (심볼릭 링크)
/var/log/pods/<namespace>_<pod-name>_<pod-uid>/<container-name>/

# 예시
/var/log/containers/nginx-deployment-abc123_default_nginx-def456.log
```

---

## 8. 실전 명령어 모음

### 8.1 모니터링

```bash
# 리소스 사용량 확인
kubectl top nodes
kubectl top pods -A --sort-by=memory
kubectl top pods -A --sort-by=cpu

# 노드 상태 확인
kubectl get nodes
kubectl describe node <node-name>

# Pod 상태 확인
kubectl get pods -o wide
kubectl describe pod <pod-name>
```

### 8.2 로그 조회

```bash
# 기본 로그
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container>
kubectl logs -f <pod-name>

# 고급 옵션
kubectl logs <pod-name> --tail=100
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --previous
kubectl logs <pod-name> --timestamps

# 라벨 기반
kubectl logs -l app=nginx --all-containers
```

### 8.3 이벤트/디버깅

```bash
# 이벤트
kubectl get events --sort-by='.lastTimestamp'
kubectl get events -A --field-selector type=Warning

# 디버깅
kubectl describe pod <pod-name>
kubectl exec -it <pod-name> -- /bin/sh
kubectl port-forward <pod-name> 8080:80
```

---

## 9. 요약

### 모니터링 도구

| 도구 | 용도 | 특징 |
|:-----|:-----|:-----|
| Metrics Server | 기본 메트릭 | 실시간, 인메모리 |
| kubectl top | CLI 조회 | 노드/Pod 리소스 |
| Prometheus | 고급 모니터링 | 시계열 DB, 알림 |

### 로그 명령어

| 명령어 | 설명 |
|:-------|:-----|
| `kubectl logs <pod>` | 로그 조회 |
| `kubectl logs -f <pod>` | 실시간 스트리밍 |
| `kubectl logs -c <container>` | 컨테이너 지정 |
| `kubectl logs --previous` | 이전 컨테이너 로그 |
| `kubectl logs --tail=N` | 최근 N줄 |
| `kubectl logs --since=1h` | 최근 1시간 |

### 디버깅 흐름

```
1. kubectl get pods          → 상태 확인
2. kubectl describe pod      → 이벤트/상세 정보
3. kubectl logs              → 애플리케이션 로그
4. kubectl logs --previous   → 크래시 전 로그
5. kubectl exec              → 컨테이너 내부 확인
6. kubectl top               → 리소스 사용량
```

{{< callout type="info" >}}
**핵심 포인트:**
- Metrics Server는 실시간 메트릭만 제공 (히스토리 없음)
- 다중 컨테이너 Pod에서는 -c 옵션으로 컨테이너 지정 필수
- --previous 옵션으로 재시작 전 로그 확인 가능
- journalctl로 노드 레벨 컴포넌트 로그 확인
{{< /callout >}}
