---
title: "Kubernetes"
weight: 1
sidebar:
  open: true
---

쿠버네티스 핵심 개념부터 운영·보안·배포 자동화까지 다룹니다.

---

| 주제 | 설명 |
|:-----|:-----|
| [입문](01-introduction) | 컨테이너의 발전과 쿠버네티스 등장 배경 |
| [핵심 개념](02-core-concepts) | 컴포넌트, 파드, 워크로드, 네임스페이스 |
| [클러스터 구성](03-cluster-setup) | kubeadm 설치, HA 설계, etcd 클러스터링 |
| [워크로드 관리](04-workloads) | Deployment, ConfigMap, Secret, 롤링 업데이트 |
| [스케줄링](05-scheduling) | Node Selector, Affinity, Taints, DaemonSet |
| [스토리지](06-storage) | Volume, PV/PVC, StorageClass, CSI |
| [네트워킹](07-networking) | Service, Ingress, CNI, DNS, Gateway API |
| [보안](08-security) | 인증, RBAC, ServiceAccount, Network Policy |
| [관측성](09-observability) | 로깅, 모니터링, Metrics Server, HPA/VPA |
| [클러스터 유지보수](10-cluster-maintenance) | 노드 유지보수, 업그레이드, etcd 백업·복원 |
| [Helm](11-helm) | 패키지 매니저, Chart 구조, 템플릿 |
| [Kustomize](12-kustomize) | Base/Overlay, Transformers, Patches |
| [CI/CD](13-cicd) | Jenkins, ArgoCD, GitOps |
| [트러블슈팅](14-troubleshooting) | Application, Control Plane, Worker Node 진단 |
| [JSONPath](15-jsonpath) | kubectl JSONPath 쿼리, Custom Columns |
