---
title: "Troubleshooting"
weight: 13
---

Kubernetes 클러스터와 애플리케이션의 트러블슈팅 방법을 다룹니다.

---

## 1. 트러블슈팅 접근법

### 1.1 체계적 접근 순서

```
┌──────────────────────────────────────────────────────────────┐
│                    트러블슈팅 흐름도                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. 증상 파악                                                 │
│     └── 무엇이 동작하지 않는가?                               │
│              │                                                │
│              ▼                                                │
│  2. 범위 확인                                                 │
│     ├── 특정 Pod만? → Application 문제                       │
│     ├── 특정 노드만? → Node 문제                             │
│     └── 클러스터 전체? → Control Plane 문제                  │
│              │                                                │
│              ▼                                                │
│  3. 로그 및 이벤트 분석                                       │
│     ├── kubectl logs                                         │
│     ├── kubectl describe                                     │
│     └── kubectl get events                                   │
│              │                                                │
│              ▼                                                │
│  4. 원인 파악 및 해결                                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 기본 진단 명령어

```bash
# 클러스터 상태 확인
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A

# 이벤트 확인 (최신순)
kubectl get events --sort-by='.lastTimestamp'
kubectl get events -A --sort-by='.lastTimestamp'

# 특정 네임스페이스 이벤트
kubectl get events -n <namespace>

# 리소스 상태 확인
kubectl get all -A
```

---

## 2. Application Failure

### 2.1 Pod 상태별 원인과 해결

| 상태 | 원인 | 해결 방법 |
|:-----|:-----|:---------|
| **Pending** | 스케줄링 실패 | 리소스, nodeSelector, taints 확인 |
| **ContainerCreating** | 이미지 풀링 또는 볼륨 마운트 중 | 대기 또는 describe로 확인 |
| **ImagePullBackOff** | 이미지 풀링 실패 | 이미지 이름, 레지스트리 인증 확인 |
| **CrashLoopBackOff** | 컨테이너 반복 충돌 | 로그 확인, 앱 오류 수정 |
| **Error** | 컨테이너 오류 종료 | 로그 확인 |
| **Terminating** | 삭제 중 멈춤 | finalizers 확인, 강제 삭제 |
| **Unknown** | 노드 통신 두절 | 노드 상태 확인 |

### 2.2 Pending 상태 트러블슈팅

```bash
# Pod 상태 확인
kubectl describe pod <pod-name>

# Events 섹션에서 원인 확인
# 예시 메시지:
# - "0/3 nodes are available: insufficient memory"
# - "0/3 nodes are available: node(s) had taint that the pod didn't tolerate"
# - "pod has unbound immediate PersistentVolumeClaims"
```

**일반적인 원인:**
- 리소스 부족 (CPU, Memory)
- NodeSelector 조건 불일치
- Taints/Tolerations 불일치
- PVC 바인딩 실패
- 스케줄러 장애

### 2.3 ImagePullBackOff 트러블슈팅

```bash
# 이벤트 확인
kubectl describe pod <pod-name>

# 일반적인 원인:
# - 이미지 이름 오타
# - 이미지 태그 미존재
# - Private registry 인증 실패
# - 네트워크 문제
```

**해결 방법:**

```bash
# 이미지 이름 확인
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].image}'

# Private registry Secret 확인
kubectl get secrets
kubectl get pod <pod-name> -o jsonpath='{.spec.imagePullSecrets}'

# Secret 생성 (필요시)
kubectl create secret docker-registry regcred \
  --docker-server=<registry-server> \
  --docker-username=<username> \
  --docker-password=<password>
```

### 2.4 CrashLoopBackOff 트러블슈팅

```bash
# 현재 로그 확인
kubectl logs <pod-name>

# 이전 컨테이너 로그 확인 (재시작된 경우)
kubectl logs <pod-name> --previous

# 멀티 컨테이너 Pod
kubectl logs <pod-name> -c <container-name>

# 실시간 로그 모니터링
kubectl logs <pod-name> -f

# 재시작 횟수 확인
kubectl get pods
```

**일반적인 원인:**
- 애플리케이션 오류
- 잘못된 설정 (ConfigMap, Secret)
- 의존성 서비스 미가용
- 리소스 제한 (OOMKilled)

### 2.5 OOMKilled 확인

```bash
# Pod 상태 확인
kubectl describe pod <pod-name>

# Last State 확인
# Reason: OOMKilled → 메모리 부족

# 리소스 사용량 확인
kubectl top pod <pod-name>

# 해결: 리소스 제한 증가
resources:
  limits:
    memory: "512Mi"  # 증가
  requests:
    memory: "256Mi"
```

---

## 3. Service 연결 문제

### 3.1 Service-Pod 연결 확인

```bash
# Service 확인
kubectl get svc <service-name>

# Endpoints 확인 (Pod와 연결 확인)
kubectl get endpoints <service-name>

# Endpoints가 비어있으면 selector 불일치
kubectl describe svc <service-name>
kubectl get pods --show-labels
```

### 3.2 연결 테스트

```bash
# 디버그 Pod에서 테스트
kubectl run debug --image=busybox -it --rm -- sh

# Service DNS 확인
nslookup <service-name>
nslookup <service-name>.<namespace>.svc.cluster.local

# Service 연결 테스트
wget -qO- http://<service-name>:<port>
```

### 3.3 NodePort 접근 문제

```bash
# NodePort 확인
kubectl get svc <service-name> -o jsonpath='{.spec.ports[0].nodePort}'

# 노드 IP 확인
kubectl get nodes -o wide

# 외부에서 접근 테스트
curl http://<NodeIP>:<NodePort>

# 방화벽 확인 (노드에서)
sudo iptables -L -n | grep <NodePort>
```

---

## 4. DNS 문제

### 4.1 CoreDNS 상태 확인

```bash
# CoreDNS Pod 상태
kubectl get pods -n kube-system -l k8s-app=kube-dns

# CoreDNS 로그
kubectl logs -n kube-system -l k8s-app=kube-dns

# CoreDNS ConfigMap
kubectl get configmap coredns -n kube-system -o yaml
```

### 4.2 DNS 테스트

```bash
# 테스트 Pod 생성
kubectl run dnsutils --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 --command -- sleep infinity

# DNS 조회 테스트
kubectl exec -it dnsutils -- nslookup kubernetes
kubectl exec -it dnsutils -- nslookup kubernetes.default.svc.cluster.local

# 외부 DNS 테스트
kubectl exec -it dnsutils -- nslookup google.com

# 정리
kubectl delete pod dnsutils
```

### 4.3 일반적인 DNS 문제

| 문제 | 원인 | 해결 |
|:-----|:-----|:-----|
| 내부 DNS 실패 | CoreDNS 장애 | CoreDNS Pod 재시작 |
| 외부 DNS 실패 | 업스트림 DNS 설정 | CoreDNS ConfigMap 확인 |
| 간헐적 실패 | CoreDNS 리소스 부족 | replicas 증가 |

---

## 5. Control Plane Failure

### 5.1 Control Plane 컴포넌트

```
Control Plane 컴포넌트:
├── kube-apiserver        # API 서버
├── kube-controller-manager  # 컨트롤러 관리자
├── kube-scheduler        # 스케줄러
└── etcd                  # 데이터 저장소
```

### 5.2 kubeadm 배포 환경

```bash
# Control Plane Pod 상태
kubectl get pods -n kube-system

# 컴포넌트 로그 확인
kubectl logs -n kube-system kube-apiserver-<master-name>
kubectl logs -n kube-system kube-controller-manager-<master-name>
kubectl logs -n kube-system kube-scheduler-<master-name>
kubectl logs -n kube-system etcd-<master-name>

# Pod 상세 정보
kubectl describe pod -n kube-system kube-apiserver-<master-name>
```

### 5.3 Static Pod 매니페스트 확인

```bash
# Static Pod 매니페스트 위치
ls /etc/kubernetes/manifests/

# 매니페스트 확인
cat /etc/kubernetes/manifests/kube-apiserver.yaml
cat /etc/kubernetes/manifests/kube-controller-manager.yaml
cat /etc/kubernetes/manifests/kube-scheduler.yaml
cat /etc/kubernetes/manifests/etcd.yaml

# 설정 오류 확인
# - 잘못된 이미지
# - 잘못된 인증서 경로
# - 잘못된 명령어 인자
```

### 5.4 네이티브 서비스 배포 환경

```bash
# 서비스 상태 확인
sudo systemctl status kube-apiserver
sudo systemctl status kube-controller-manager
sudo systemctl status kube-scheduler
sudo systemctl status etcd

# 서비스 로그
sudo journalctl -u kube-apiserver -f
sudo journalctl -u kube-controller-manager -f
sudo journalctl -u kube-scheduler -f
sudo journalctl -u etcd -f

# 서비스 재시작
sudo systemctl restart kube-apiserver
```

### 5.5 etcd 트러블슈팅

```bash
# etcd 상태 확인
kubectl get pods -n kube-system -l component=etcd

# etcd 로그
kubectl logs -n kube-system etcd-<master-name>

# etcdctl로 상태 확인
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# etcd 멤버 목록
ETCDCTL_API=3 etcdctl member list \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

### 5.6 API Server 접근 불가

```bash
# API Server 프로세스 확인
ps aux | grep kube-apiserver

# 포트 리스닝 확인
sudo netstat -tlnp | grep 6443
sudo ss -tlnp | grep 6443

# 인증서 확인
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A2 "Validity"

# kubectl 설정 확인
kubectl config view
cat ~/.kube/config
```

---

## 6. Worker Node Failure

### 6.1 노드 상태 확인

```bash
# 노드 상태
kubectl get nodes

# 노드 상세 정보
kubectl describe node <node-name>

# Conditions 섹션 확인
```

### 6.2 Node Conditions

| Condition | True일 때 의미 | 조치 |
|:----------|:--------------|:-----|
| **Ready** | 노드 정상 | 정상 |
| **MemoryPressure** | 메모리 부족 | 메모리 확보 또는 노드 추가 |
| **DiskPressure** | 디스크 공간 부족 | 디스크 정리 |
| **PIDPressure** | 프로세스 과다 | 프로세스 정리 |
| **NetworkUnavailable** | 네트워크 미설정 | CNI 설정 확인 |

**Unknown 상태:** Master와 통신 두절 → 노드 크래시 가능성

### 6.3 노드 리소스 확인

```bash
# 노드 접속 후 확인
ssh <node-ip>

# CPU 사용량
top
htop

# 메모리 확인
free -h
cat /proc/meminfo

# 디스크 확인
df -h
du -sh /var/lib/docker
du -sh /var/lib/containerd

# 프로세스 확인
ps aux | wc -l
```

### 6.4 Kubelet 트러블슈팅

```bash
# Kubelet 상태
sudo systemctl status kubelet

# Kubelet 로그
sudo journalctl -u kubelet -f
sudo journalctl -u kubelet --since "10 minutes ago"

# Kubelet 설정
cat /var/lib/kubelet/config.yaml
cat /etc/kubernetes/kubelet.conf

# Kubelet 재시작
sudo systemctl restart kubelet

# Kubelet 활성화 (부팅 시)
sudo systemctl enable kubelet
```

### 6.5 인증서 문제

```bash
# 인증서 만료 확인
sudo kubeadm certs check-expiration

# 인증서 갱신
sudo kubeadm certs renew all

# Kubelet 인증서 확인
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -text -noout | grep -A2 "Validity"
```

### 6.6 Container Runtime 문제

```bash
# containerd 상태
sudo systemctl status containerd

# containerd 로그
sudo journalctl -u containerd -f

# crictl로 상태 확인
sudo crictl info
sudo crictl ps
sudo crictl pods

# containerd 재시작
sudo systemctl restart containerd
```

---

## 7. 네트워크 트러블슈팅

### 7.1 CNI 문제

```bash
# CNI 플러그인 확인
ls /etc/cni/net.d/
cat /etc/cni/net.d/*.conf

# CNI 바이너리 확인
ls /opt/cni/bin/

# CNI Pod 상태 (Calico 예시)
kubectl get pods -n kube-system -l k8s-app=calico-node
kubectl logs -n kube-system -l k8s-app=calico-node
```

### 7.2 Pod 간 통신 테스트

```bash
# 테스트 Pod 생성
kubectl run test1 --image=busybox --command -- sleep infinity
kubectl run test2 --image=busybox --command -- sleep infinity

# Pod IP 확인
kubectl get pods -o wide

# Pod 간 ping 테스트
kubectl exec -it test1 -- ping <test2-pod-ip>

# 정리
kubectl delete pod test1 test2
```

### 7.3 kube-proxy 문제

```bash
# kube-proxy Pod 상태
kubectl get pods -n kube-system -l k8s-app=kube-proxy

# kube-proxy 로그
kubectl logs -n kube-system -l k8s-app=kube-proxy

# kube-proxy 설정
kubectl get configmap kube-proxy -n kube-system -o yaml

# iptables 규칙 확인 (노드에서)
sudo iptables -t nat -L -n | grep <service-name>
```

---

## 8. 스토리지 트러블슈팅

### 8.1 PVC Pending 상태

```bash
# PVC 상태 확인
kubectl get pvc

# PVC 상세 정보
kubectl describe pvc <pvc-name>

# PV 확인
kubectl get pv

# StorageClass 확인
kubectl get storageclass
```

**일반적인 원인:**
- 매칭되는 PV 없음
- StorageClass 미존재
- 프로비저너 장애

### 8.2 볼륨 마운트 실패

```bash
# Pod Events 확인
kubectl describe pod <pod-name>

# 일반적인 메시지:
# - "Unable to mount volumes"
# - "timeout waiting for condition"
```

---

## 9. 디버깅 기법

### 9.1 임시 디버그 컨테이너

```bash
# 실행 중인 Pod에 디버그 컨테이너 추가 (K8s 1.25+)
kubectl debug -it <pod-name> --image=busybox --target=<container-name>

# 노드 디버깅
kubectl debug node/<node-name> -it --image=busybox
```

### 9.2 Pod 내부 접속

```bash
# bash 셸 접속
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec -it <pod-name> -- /bin/sh

# 특정 컨테이너 접속
kubectl exec -it <pod-name> -c <container-name> -- /bin/sh

# 명령어 실행
kubectl exec <pod-name> -- cat /etc/config/app.conf
kubectl exec <pod-name> -- env
```

### 9.3 포트 포워딩

```bash
# Pod 포트 포워딩
kubectl port-forward pod/<pod-name> 8080:80

# Service 포트 포워딩
kubectl port-forward svc/<service-name> 8080:80

# 백그라운드 실행
kubectl port-forward pod/<pod-name> 8080:80 &
```

### 9.4 리소스 사용량 확인

```bash
# 노드 리소스
kubectl top nodes

# Pod 리소스
kubectl top pods
kubectl top pods -A
kubectl top pods --containers

# 정렬
kubectl top pods --sort-by=memory
kubectl top pods --sort-by=cpu
```

---

## 10. 유용한 명령어 모음

### 10.1 빠른 진단

```bash
# 전체 상태 확인
kubectl get nodes,pods,svc,deploy -A

# 문제 있는 Pod만 표시
kubectl get pods -A | grep -v Running
kubectl get pods -A --field-selector=status.phase!=Running

# 최근 이벤트
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# 리소스 사용량
kubectl top nodes && kubectl top pods -A
```

### 10.2 상세 정보 추출

```bash
# Pod 상태 이유
kubectl get pod <pod-name> -o jsonpath='{.status.containerStatuses[0].state}'

# 마지막 종료 이유
kubectl get pod <pod-name> -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'

# 노드 Conditions
kubectl get node <node-name> -o jsonpath='{.status.conditions[*].type}'

# 모든 이미지 목록
kubectl get pods -A -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u
```

### 10.3 로그 관련

```bash
# 최근 로그 (라인 수 제한)
kubectl logs <pod-name> --tail=100

# 시간 범위 로그
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --since=30m

# 모든 컨테이너 로그
kubectl logs <pod-name> --all-containers

# 라벨로 로그 조회
kubectl logs -l app=nginx
```

---

## 11. 트러블슈팅 체크리스트

### 11.1 Application 문제

```
□ kubectl get pods - Pod 상태 확인
□ kubectl describe pod - Events 확인
□ kubectl logs - 애플리케이션 로그 확인
□ kubectl logs --previous - 이전 컨테이너 로그
□ kubectl get endpoints - Service-Pod 연결 확인
□ kubectl get events - 클러스터 이벤트 확인
```

### 11.2 Control Plane 문제

```
□ kubectl get nodes - 노드 상태 확인
□ kubectl get pods -n kube-system - 시스템 Pod 확인
□ kubectl logs -n kube-system - 컴포넌트 로그
□ systemctl status kubelet - Kubelet 상태
□ /etc/kubernetes/manifests/ - Static Pod 매니페스트
□ 인증서 만료 확인
```

### 11.3 Worker Node 문제

```
□ kubectl describe node - Conditions 확인
□ systemctl status kubelet - Kubelet 상태
□ journalctl -u kubelet - Kubelet 로그
□ top, free -h, df -h - 리소스 확인
□ systemctl status containerd - 런타임 상태
□ 인증서 확인
```

---

## 12. 명령어 요약

```bash
# 기본 진단
kubectl get nodes,pods,svc -A
kubectl get events -A --sort-by='.lastTimestamp'
kubectl describe pod <pod-name>
kubectl logs <pod-name> [--previous]

# Control Plane
kubectl get pods -n kube-system
kubectl logs -n kube-system <component-pod>
journalctl -u kube-apiserver

# Worker Node
kubectl describe node <node-name>
systemctl status kubelet
journalctl -u kubelet

# 네트워크
kubectl get endpoints
kubectl run debug --image=busybox -it --rm -- sh

# 리소스
kubectl top nodes
kubectl top pods

# 디버깅
kubectl exec -it <pod-name> -- /bin/sh
kubectl port-forward pod/<pod-name> 8080:80
kubectl debug -it <pod-name> --image=busybox
```

{{< callout type="info" >}}
**핵심 포인트:**
- **체계적 접근**: 증상 → 범위 확인 → 로그/이벤트 분석 → 해결
- **kubectl describe**: Events 섹션에서 대부분의 원인 파악 가능
- **kubectl logs --previous**: 재시작된 컨테이너의 이전 로그 확인
- **Pod 상태**: Pending, ImagePullBackOff, CrashLoopBackOff 각각 다른 원인
- **노드 Conditions**: Ready 외에 MemoryPressure, DiskPressure 등 확인
- **Kubelet**: Worker Node 문제의 가장 흔한 원인
{{< /callout >}}
