---
title: "Kubernetes CI/CD"
description: "쿠버네티스 환경에서의 CI/CD 파이프라인 구축과 Jenkins, ArgoCD 활용법을 상세히 알아본다"
summary: "CI/CD 개념, Jenkins 파이프라인, ArgoCD GitOps, 자동화 배포 전략"
date: 2025-01-06
weight: 7
draft: false
toc: true
---

## CI/CD란?

### 기본 용어 정리

| 용어 | 설명 |
|------|------|
| **커밋(Commit)** | 소스 코드 변경사항을 저장소에 반영 |
| **빌드(Build)** | 소스 코드를 실행 가능한 상태로 변환 |
| **테스트(Test)** | 단위 테스트, 통합 테스트로 품질 검증 |
| **배포(Deploy)** | 애플리케이션을 실행 환경에 설치 |
| **릴리스(Release)** | 사용자에게 새 버전 공개 |

### CI (Continuous Integration) - 지속적 통합

**CI**는 개발자들이 코드 변경사항을 자주 통합하고, 자동으로 빌드 및 테스트하는 프로세스이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI (Continuous Integration)                         │
│                                                                              │
│   개발자 A ──┐                                                               │
│             │     ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│   개발자 B ──┼────▶│  Commit │───▶│  Build  │───▶│  Test   │───▶│ Artifact│ │
│             │     │ (Git)   │    │(Compile)│    │(자동화)  │    │ (Image) │ │
│   개발자 C ──┘     └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│                                                                              │
│   핵심: 빠른 통합 + 자동화된 빌드/테스트                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**CI의 핵심 가치**:
1. **빠른 피드백**: 코드 변경 후 즉시 문제 발견
2. **자동화**: 빌드, 테스트 과정 자동 실행
3. **품질 향상**: 지속적인 테스트로 버그 조기 발견

### CD (Continuous Delivery/Deployment) - 지속적 배포

**CD**는 테스트를 통과한 코드를 자동으로 배포 환경에 반영하는 프로세스이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    CD                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              Continuous Delivery (지속적 제공)                        │   │
│  │                                                                       │   │
│  │   CI 완료 ───▶ Staging 배포 ───▶ [수동 승인] ───▶ Production 배포     │   │
│  │                                      ▲                                │   │
│  │                               사람의 승인 필요                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              Continuous Deployment (지속적 배포)                      │   │
│  │                                                                       │   │
│  │   CI 완료 ───▶ Staging 배포 ───▶ 자동 테스트 ───▶ Production 배포     │   │
│  │                                                                       │   │
│  │                          모든 과정 자동화                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 구분 | Continuous Delivery | Continuous Deployment |
|------|---------------------|----------------------|
| **배포 방식** | 수동 승인 후 배포 | 완전 자동 배포 |
| **사람 개입** | 필요 | 불필요 |
| **적합한 환경** | 규제가 있는 환경 | 빠른 릴리스 필요 |

---

## CI/CD 파이프라인 개요

### 전체 파이프라인 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI/CD Pipeline                                      │
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────┐   │
│  │  Code   │   │  Build  │   │  Test   │   │  Push   │   │   Deploy    │   │
│  │         │   │         │   │         │   │         │   │             │   │
│  │ GitHub  │──▶│ Jenkins │──▶│ Jenkins │──▶│ Docker  │──▶│   ArgoCD    │   │
│  │         │   │         │   │         │   │   Hub   │   │             │   │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────────┘   │
│                                                                              │
│       ▲              CI 영역                        CD 영역           ▼      │
│       │                                                              │      │
│       │                                                              │      │
│  ┌────┴────┐                                                  ┌──────▼──────┐
│  │ 개발자   │                                                  │ Kubernetes  │
│  └─────────┘                                                  │   Cluster   │
│                                                               └─────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

### 쿠버네티스 환경의 CI/CD

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Kubernetes CI/CD Architecture                            │
│                                                                              │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────────────┐  │
│  │  Source Repo  │         │  GitOps Repo  │         │   Kubernetes      │  │
│  │   (GitHub)    │         │   (GitHub)    │         │    Cluster        │  │
│  │               │         │               │         │                   │  │
│  │  - 애플리케이션 │         │  - Deployment │         │  ┌─────────────┐  │  │
│  │    소스 코드   │         │  - Service    │         │  │    Pod      │  │  │
│  │  - Dockerfile │         │  - ConfigMap  │         │  │   (nginx)   │  │  │
│  │               │         │  - Secret     │         │  └─────────────┘  │  │
│  └───────┬───────┘         └───────┬───────┘         └─────────▲─────────┘  │
│          │                         │                           │            │
│          │ Webhook                 │ Watch                     │ Sync       │
│          ▼                         ▼                           │            │
│  ┌───────────────┐         ┌───────────────┐                  │            │
│  │    Jenkins    │────────▶│    ArgoCD     │──────────────────┘            │
│  │   (CI Tool)   │  Push   │   (CD Tool)   │                               │
│  │               │ Image   │               │                               │
│  │  Build/Test   │         │  GitOps Sync  │                               │
│  └───────────────┘         └───────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## GitOps

### GitOps란?

**GitOps**는 Git 저장소를 **Single Source of Truth**로 사용하여 인프라와 애플리케이션을 관리하는 방법론이다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitOps 원칙                                     │
│                                                                              │
│   1. 선언적 정의 (Declarative)                                               │
│      - 시스템의 원하는 상태를 선언적으로 정의                                  │
│      - YAML 매니페스트로 인프라 정의                                          │
│                                                                              │
│   2. 버전 관리 (Versioned and Immutable)                                     │
│      - 모든 설정을 Git에 저장                                                 │
│      - 변경 이력 추적 가능                                                    │
│                                                                              │
│   3. 자동 적용 (Pulled Automatically)                                        │
│      - Git 변경사항을 자동으로 클러스터에 적용                                 │
│      - Pull 기반 동기화                                                      │
│                                                                              │
│   4. 지속적 조정 (Continuously Reconciled)                                   │
│      - 실제 상태와 원하는 상태를 지속적으로 비교                               │
│      - 차이 발생 시 자동 조정                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Push vs Pull 배포

| 방식 | Push 배포 | Pull 배포 |
|------|----------|----------|
| **동작** | CI 도구가 직접 클러스터에 배포 | 클러스터가 Git을 감시하고 동기화 |
| **트리거** | CI 파이프라인 완료 시 | Git 저장소 변경 감지 시 |
| **보안** | CI 도구에 클러스터 접근 권한 필요 | 클러스터 내부에서 외부로 Pull |
| **도구** | Jenkins, GitHub Actions | **ArgoCD**, Flux CD |

```
Push 방식:
  Jenkins ──────▶ Kubernetes Cluster
            (kubectl apply)

Pull 방식:
  Git Repo ◀────── ArgoCD (클러스터 내부)
              (watch & sync)
```

### GitOps 저장소 구조

```
gitops-repo/
├── apps/
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── database/
│       ├── statefulset.yaml
│       ├── service.yaml
│       └── pvc.yaml
├── infrastructure/
│   ├── monitoring/
│   │   ├── prometheus.yaml
│   │   └── grafana.yaml
│   └── ingress-controller/
│       └── nginx-ingress.yaml
└── environments/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

---

## Jenkins

### Jenkins란?

**Jenkins**는 가장 널리 사용되는 오픈소스 **CI/CD 자동화 서버**이다.

**Jenkins의 장점**:
- 프로젝트 빌드 및 컴파일 오류 검출
- 자동화된 테스트 실행
- 코딩 규약 준수 여부 체크
- 다양한 플러그인 생태계

### 빌드 도구 비교

| 빌드 도구 | 스크립트 | 특징 |
|----------|---------|------|
| **Ant** | XML | 간단하고 사용 쉬움, 대규모 프로젝트에서 복잡 |
| **Maven** | XML (pom.xml) | 생명주기(Lifecycle), POM 개념, 학습 곡선 높음 |
| **Gradle** | Groovy/Kotlin DSL | 의존성 관리 우수, 빌드 속도 빠름, **권장** |

### 쿠버네티스에 Jenkins 설치

```yaml
# jenkins-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jenkins
  namespace: jenkins
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jenkins
  template:
    metadata:
      labels:
        app: jenkins
    spec:
      serviceAccountName: jenkins
      containers:
      - name: jenkins
        image: jenkins/jenkins:lts
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 50000
          name: jnlp
        volumeMounts:
        - name: jenkins-home
          mountPath: /var/jenkins_home
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: jenkins-home
        persistentVolumeClaim:
          claimName: jenkins-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: jenkins
  namespace: jenkins
spec:
  type: NodePort
  ports:
  - port: 8080
    targetPort: 8080
    nodePort: 30080
    name: http
  - port: 50000
    targetPort: 50000
    name: jnlp
  selector:
    app: jenkins
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: jenkins-pvc
  namespace: jenkins
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: jenkins
```

```bash
# 네임스페이스 생성 및 배포
kubectl create namespace jenkins
kubectl apply -f jenkins-deployment.yaml

# 초기 비밀번호 확인
kubectl exec -it $(kubectl get pods -n jenkins -l app=jenkins -o jsonpath='{.items[0].metadata.name}') -n jenkins -- cat /var/jenkins_home/secrets/initialAdminPassword
```

### Jenkinsfile (Declarative Pipeline)

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_IMAGE = 'myuser/myapp'
        DOCKER_TAG = "${BUILD_NUMBER}"
        KUBECONFIG = credentials('kubeconfig')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Checked out branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Build') {
            steps {
                echo 'Building application...'
                sh './gradlew clean build'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                sh './gradlew test'
            }
            post {
                always {
                    junit '**/build/test-results/test/*.xml'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building Docker image...'
                sh """
                    docker build -t ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} .
                    docker tag ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:latest
                """
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin
                        docker push ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}
                        docker push ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:latest
                    """
                }
            }
        }

        stage('Update GitOps Repo') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-credentials',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sh """
                        git clone https://${GIT_USER}:${GIT_TOKEN}@github.com/myorg/gitops-repo.git
                        cd gitops-repo
                        sed -i 's|image: .*|image: ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}|' apps/myapp/deployment.yaml
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins"
                        git add .
                        git commit -m "Update image to ${DOCKER_TAG}"
                        git push
                    """
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
            // Slack 알림 등 추가 가능
        }
        failure {
            echo 'Pipeline failed!'
        }
        always {
            cleanWs()
        }
    }
}
```

### 멀티브랜치 파이프라인

```groovy
// Jenkinsfile for multi-branch
pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                sh './gradlew build'
            }
        }

        stage('Test') {
            steps {
                sh './gradlew test'
            }
        }

        stage('Deploy to Dev') {
            when {
                branch 'develop'
            }
            steps {
                echo 'Deploying to Development...'
                // dev 환경 배포
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'release/*'
            }
            steps {
                echo 'Deploying to Staging...'
                // staging 환경 배포
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                echo 'Deploying to Production...'
                // production 환경 배포
            }
        }
    }
}
```

---

## ArgoCD

### ArgoCD란?

**ArgoCD**는 쿠버네티스를 위한 **선언적 GitOps CD 도구**이다. Git 저장소의 매니페스트를 감시하고 쿠버네티스 클러스터와 자동으로 동기화한다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ArgoCD Architecture                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        ArgoCD Components                             │    │
│  │                                                                      │    │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │    │
│  │  │   API       │   │ Repository  │   │ Application │               │    │
│  │  │   Server    │   │   Server    │   │  Controller │               │    │
│  │  │             │   │             │   │             │               │    │
│  │  │  - UI/CLI   │   │  - Git 연결 │   │  - 상태 비교│               │    │
│  │  │  - Auth     │   │  - 캐싱     │   │  - 동기화   │               │    │
│  │  └─────────────┘   └──────┬──────┘   └──────┬──────┘               │    │
│  │                           │                 │                       │    │
│  └───────────────────────────┼─────────────────┼───────────────────────┘    │
│                              │                 │                            │
│                              ▼                 ▼                            │
│                       ┌─────────────┐   ┌─────────────────┐                │
│                       │  Git Repo   │   │   Kubernetes    │                │
│                       │  (GitOps)   │   │    Cluster      │                │
│                       └─────────────┘   └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ArgoCD 특징

| 특징 | 설명 |
|------|------|
| **자동 배포** | Git 변경 감지 후 자동 배포 |
| **멀티 클러스터** | 여러 클러스터 중앙 관리 |
| **RBAC** | 역할 기반 접근 제어 |
| **롤백** | Git 히스토리 기반 손쉬운 롤백 |
| **상태 분석** | 애플리케이션 상태 실시간 모니터링 |
| **동기화** | 원하는 상태와 실제 상태 자동 동기화 |

### ArgoCD 설치

```bash
# ArgoCD 네임스페이스 생성
kubectl create namespace argocd

# ArgoCD 설치
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# ArgoCD CLI 설치 (Linux)
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd-linux-amd64
sudo mv argocd-linux-amd64 /usr/local/bin/argocd

# 초기 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# ArgoCD Server 접근 (NodePort로 변경)
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort"}}'

# 또는 포트 포워딩
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### ArgoCD 로그인

```bash
# CLI 로그인
argocd login localhost:8080 --username admin --password <password> --insecure

# 비밀번호 변경
argocd account update-password

# 클러스터 등록 (외부 클러스터 사용 시)
argocd cluster add <context-name>
```

### Application 리소스

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  # 프로젝트
  project: default

  # 소스 (GitOps 저장소)
  source:
    repoURL: https://github.com/myorg/gitops-repo.git
    targetRevision: HEAD
    path: apps/myapp

  # 대상 클러스터
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp

  # 동기화 정책
  syncPolicy:
    automated:
      prune: true           # 삭제된 리소스 자동 제거
      selfHeal: true        # 수동 변경 시 자동 복구
      allowEmpty: false     # 빈 리소스 허용 안 함
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true

    # 재시도 정책
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

```bash
# Application 생성
kubectl apply -f argocd-application.yaml

# 또는 CLI로 생성
argocd app create myapp \
  --repo https://github.com/myorg/gitops-repo.git \
  --path apps/myapp \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace myapp \
  --sync-policy automated
```

### 동기화 상태

| 상태 | 설명 |
|------|------|
| **Synced** | Git 상태와 클러스터 상태 일치 |
| **OutOfSync** | Git 상태와 클러스터 상태 불일치 |
| **Unknown** | 상태 확인 불가 |

| 헬스 상태 | 설명 |
|----------|------|
| **Healthy** | 모든 리소스 정상 |
| **Progressing** | 배포 진행 중 |
| **Degraded** | 일부 리소스 문제 |
| **Suspended** | 일시 중지됨 |

### CLI 명령어

```bash
# 애플리케이션 목록
argocd app list

# 애플리케이션 상세 정보
argocd app get myapp

# 수동 동기화
argocd app sync myapp

# 롤백
argocd app rollback myapp <revision>

# 히스토리 확인
argocd app history myapp

# 애플리케이션 삭제
argocd app delete myapp

# 리소스 상태 확인
argocd app resources myapp

# 로그 확인
argocd app logs myapp
```

### Kustomize 사용

```yaml
# apps/myapp/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: myapp

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

images:
  - name: myapp
    newName: docker.io/myuser/myapp
    newTag: v1.2.3

commonLabels:
  app: myapp
  version: v1.2.3
```

```yaml
# ArgoCD Application with Kustomize
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-prod
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/myorg/gitops-repo.git
    targetRevision: HEAD
    path: apps/myapp
    kustomize:
      namePrefix: prod-
      commonLabels:
        env: production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
```

### Helm 차트 사용

```yaml
# ArgoCD Application with Helm
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-helm
  namespace: argocd
spec:
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: nginx
    targetRevision: 15.1.0
    helm:
      releaseName: nginx
      values: |
        replicaCount: 3
        service:
          type: LoadBalancer
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
  destination:
    server: https://kubernetes.default.svc
    namespace: nginx
  syncPolicy:
    automated:
      selfHeal: true
```

---

## 완전한 CI/CD 파이프라인 예제

### 프로젝트 구조

```
# 애플리케이션 저장소
myapp-repo/
├── src/
│   └── main/
│       └── java/
├── Dockerfile
├── Jenkinsfile
├── build.gradle
└── README.md

# GitOps 저장소
gitops-repo/
├── apps/
│   └── myapp/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── kustomization.yaml
└── argocd/
    └── application.yaml
```

### Dockerfile

```dockerfile
# Dockerfile
FROM openjdk:17-slim as builder

WORKDIR /app
COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle
COPY src ./src

RUN ./gradlew build -x test

FROM openjdk:17-slim

WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

### GitOps 매니페스트

```yaml
# gitops-repo/apps/myapp/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: docker.io/myuser/myapp:latest  # Jenkins가 업데이트
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
# gitops-repo/apps/myapp/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

### 파이프라인 흐름

```
1. 개발자가 코드 커밋 (myapp-repo)
           │
           ▼
2. GitHub Webhook → Jenkins 트리거
           │
           ▼
3. Jenkins: Build → Test → Docker Build → Push
           │
           ▼
4. Jenkins: GitOps 저장소의 이미지 태그 업데이트
           │
           ▼
5. ArgoCD: Git 변경 감지
           │
           ▼
6. ArgoCD: 자동 동기화 → 클러스터 배포
           │
           ▼
7. 새 버전 애플리케이션 실행
```

---

## 배포 전략

### ArgoCD Rollout (Blue-Green)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myuser/myapp:v2
        ports:
        - containerPort: 8080
  strategy:
    blueGreen:
      activeService: myapp-active
      previewService: myapp-preview
      autoPromotionEnabled: false
```

### ArgoCD Rollout (Canary)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myuser/myapp:v2
  strategy:
    canary:
      steps:
      - setWeight: 10      # 10% 트래픽
      - pause: {duration: 5m}
      - setWeight: 30      # 30% 트래픽
      - pause: {duration: 5m}
      - setWeight: 50      # 50% 트래픽
      - pause: {duration: 5m}
      - setWeight: 100     # 100% 트래픽
```

---

## 정리

### CI/CD 도구 비교

| 도구 | 역할 | 특징 |
|------|------|------|
| **Jenkins** | CI | 빌드, 테스트, 이미지 생성 |
| **ArgoCD** | CD | GitOps 기반 배포, 동기화 |
| **GitHub Actions** | CI/CD | GitHub 통합, 간편한 설정 |
| **GitLab CI** | CI/CD | GitLab 통합 파이프라인 |

### GitOps 핵심 개념

| 개념 | 설명 |
|------|------|
| **Source Repo** | 애플리케이션 소스 코드 저장소 |
| **GitOps Repo** | 쿠버네티스 매니페스트 저장소 |
| **Sync** | Git 상태와 클러스터 상태 일치화 |
| **Self-Heal** | 수동 변경 시 자동 복구 |

### 체크리스트

- [ ] CI 파이프라인 구성 (빌드 → 테스트 → 이미지 푸시)
- [ ] GitOps 저장소 구조 설계
- [ ] ArgoCD Application 설정
- [ ] 자동 동기화 정책 설정
- [ ] 롤백 전략 수립
- [ ] 모니터링 및 알림 설정

---

## 참고 자료

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitOps Principles](https://www.gitops.tech/)
- [Argo Rollouts](https://argoproj.github.io/argo-rollouts/)
- 쉽게 시작하는 쿠버네티스 (조훈, 심근우)
