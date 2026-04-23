---
title: "13. CI/CD"
weight: 13
---

## 1. CI/CD 개념

**CI (Continuous Integration)** 는 개발자들의 코드 변경을 자주 통합하여 자동으로 빌드·테스트하는 과정이고, **CD (Continuous Delivery/Deployment)** 는 테스트를 통과한 산출물을 실행 환경으로 자동 배포하는 과정이다. 쿠버네티스 환경에서는 Jenkins(CI) + ArgoCD(CD) 조합이 사실상 표준처럼 쓰인다.

### 용어 정리

| 용어 | 설명 |
|:---|:---|
| 커밋 | 소스 코드 변경사항을 저장소에 반영 |
| 빌드 | 소스 코드를 실행 가능한 형태로 변환 |
| 테스트 | 단위·통합 테스트로 품질 검증 |
| 아티팩트 | 빌드 결과물 (JAR, 컨테이너 이미지 등) |
| 배포 | 실행 환경에 아티팩트를 설치 |
| 릴리스 | 사용자에게 새 버전을 공개 |

### Continuous Delivery vs Deployment

| 구분 | Delivery | Deployment |
|:---|:---|:---|
| 배포 방식 | 수동 승인 후 배포 | 완전 자동 배포 |
| 사람 개입 | 필요 | 불필요 |
| 적합 환경 | 규제·감사가 엄격한 도메인 | 빠른 릴리스가 필요한 서비스 |

## 2. 전체 파이프라인 흐름

```text
개발자 ──▶ Source Repo
            │  webhook
            ▼
       ┌──────────┐
       │ Jenkins  │  CI
       │ build    │
       │ test     │
       │ docker   │
       └────┬─────┘
            │ push image
            ▼
       Container Registry
            │
            │ update manifest
            ▼
       GitOps Repo
            │ watch
            ▼
       ┌──────────┐
       │ ArgoCD   │  CD
       │ sync     │
       └────┬─────┘
            │ apply
            ▼
       K8s Cluster
```

CI 영역은 **코드 → 이미지**까지 책임지고, CD 영역은 **매니페스트 → 클러스터 상태**를 책임진다. 두 영역이 GitOps 저장소를 경계로 깔끔히 분리된다.

## 3. GitOps 원칙

**GitOps** 는 Git을 **Single Source of Truth** 로 삼아 인프라와 애플리케이션 상태를 선언적으로 관리하는 방법론이다.

| 원칙 | 설명 |
|:---|:---|
| Declarative | 원하는 상태를 YAML로 선언 |
| Versioned & Immutable | 모든 변경을 Git 커밋으로 추적 |
| Pulled Automatically | 클러스터가 Git을 감시하고 자동 적용 |
| Continuously Reconciled | 실제 상태와 원하는 상태를 지속 비교·교정 |

### Push vs Pull 배포

| 방식 | Push | Pull |
|:---|:---|:---|
| 동작 | CI 도구가 직접 클러스터에 배포 | 클러스터가 Git을 감시하며 동기화 |
| 트리거 | 파이프라인 완료 시 | Git 변경 감지 시 |
| 보안 | CI 도구에 클러스터 자격 증명 필요 | 클러스터 내부에서 외부로 Pull만 |
| 도구 | Jenkins, GitHub Actions | ArgoCD, Flux CD |

```text
[Push]
Jenkins ──kubectl apply──▶ Cluster

[Pull]
Cluster(ArgoCD) ──watch──▶ Git Repo
                ◀──sync───
```

{{< callout type="info" >}}
**Push 는 외부에서 클러스터를 조작**하므로 Jenkins 측에 kubeconfig·토큰 유출 위험이 크다. **Pull(GitOps) 는 클러스터가 외부로 나가서 가져오는 방향**이라 인바운드 통로를 열지 않아도 되어 보안이 우수하다. 운영 클러스터일수록 Pull 방식을 권장한다.
{{< /callout >}}

### GitOps 저장소 구조

```text
gitops-repo/
├── apps/
│   ├── frontend/
│   ├── backend/
│   └── database/
├── infrastructure/
│   ├── monitoring/
│   └── ingress/
└── environments/
    ├── dev/
    ├── staging/
    └── production/
```

애플리케이션 매니페스트와 환경별 오버레이(kustomization)를 분리해 두면, 환경 단위 롤백과 동기화 범위 제어가 쉬워진다.

## 4. Jenkins

**Jenkins** 는 가장 널리 쓰이는 오픈소스 CI/CD 자동화 서버로, 풍부한 플러그인 생태계와 Pipeline-as-Code(Groovy DSL)를 제공한다.

### 빌드 도구 비교

| 도구 | 스크립트 | 특징 |
|:---|:---|:---|
| Ant | XML | 간단, 대규모에서 복잡 |
| Maven | XML (pom.xml) | Lifecycle·POM, 학습 곡선 |
| Gradle | Groovy/Kotlin DSL | 의존성 관리·빌드 속도 우수 |

### Jenkins를 쿠버네티스에 배포

```yaml
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
        - containerPort: 50000
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
```

```bash
kubectl create namespace jenkins
kubectl apply -f jenkins-deployment.yaml

# 초기 비밀번호
kubectl exec -n jenkins \
  deploy/jenkins -- \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

### Declarative Pipeline

```groovy
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_IMAGE = 'myuser/myapp'
        DOCKER_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Build') {
            steps { sh './gradlew clean build' }
        }

        stage('Test') {
            steps { sh './gradlew test' }
            post {
                always {
                    junit '**/build/test-results/test/*.xml'
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                      docker build -t ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} .
                      echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin
                      docker push ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}
                    """
                }
            }
        }

        stage('Update GitOps') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github',
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
        always { cleanWs() }
    }
}
```

### 멀티브랜치 조건 배포

```groovy
stage('Deploy to Production') {
    when { branch 'main' }
    steps {
        input message: 'Deploy to production?', ok: 'Deploy'
        echo 'Deploying to Production...'
    }
}
```

{{< callout type="warning" >}}
Jenkins Controller에 `agent any` 로 직접 빌드하면, 워크스페이스 충돌·보안 취약점·리소스 경합이 발생하기 쉽다. 쿠버네티스 환경에서는 **Kubernetes plugin 을 사용한 Pod Agent(동적 빌드 Pod)** 방식을 권장한다. 빌드마다 깨끗한 Pod가 생겼다가 종료되므로 환경이 격리되고, 노드 자원을 탄력적으로 사용할 수 있다.
{{< /callout >}}

## 5. ArgoCD

**ArgoCD** 는 쿠버네티스를 위한 **선언적 GitOps CD 도구**로, Git 저장소의 매니페스트를 감시해 클러스터와 자동 동기화한다.

### 아키텍처

```text
┌─────────────────────────┐
│      ArgoCD             │
│                         │
│  API ─ Repo ─ Controller│
│   │    │       │        │
└───┼────┼───────┼────────┘
    │    │       │
    ▼    ▼       ▼
   UI  Git     Cluster
       Repo    (sync)
```

- **API Server**: UI·CLI·인증
- **Repository Server**: Git 연결·매니페스트 캐싱
- **Application Controller**: 원하는 상태와 실제 상태 비교·동기화

### 설치

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 초기 admin 비밀번호
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# 포트 포워딩
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### Application 리소스

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/gitops-repo.git
    targetRevision: HEAD
    path: apps/myapp
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp
  syncPolicy:
    automated:
      prune: true       # 삭제된 리소스 자동 제거
      selfHeal: true    # 수동 변경 시 Git 상태로 복구
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### 동기화·헬스 상태

| Sync 상태 | 설명 |
|:---|:---|
| Synced | Git 상태와 클러스터 상태 일치 |
| OutOfSync | 두 상태가 다름 |
| Unknown | 확인 불가 |

| Health 상태 | 설명 |
|:---|:---|
| Healthy | 모든 리소스 정상 |
| Progressing | 배포 진행 중 |
| Degraded | 일부 리소스 문제 |
| Suspended | 일시 중지 |

### 자주 쓰는 CLI

```bash
argocd app list
argocd app get myapp
argocd app sync myapp
argocd app rollback myapp <revision>
argocd app history myapp
argocd app diff myapp
```

{{< callout type="warning" >}}
`selfHeal: true` 는 강력하지만 위험도 크다. 장애 상황에서 현장 담당자가 `kubectl edit` 로 긴급 수정한 내용을 **ArgoCD가 Git 상태로 즉시 되돌려 버릴 수 있다**. 운영 환경에서는 긴급 hot-fix 절차를 "Git 변경 → 자동 sync"로 통일하거나, 필요시 해당 Application을 일시적으로 `syncPolicy.automated` 해제한 뒤 수정하는 운영 표준을 세워야 한다.
{{< /callout >}}

### Kustomize·Helm 통합

```yaml
# Kustomize
spec:
  source:
    path: apps/myapp
    kustomize:
      namePrefix: prod-
      commonLabels:
        env: production

# Helm
spec:
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: nginx
    targetRevision: 15.1.0
    helm:
      releaseName: nginx
      values: |
        replicaCount: 3
```

## 6. ArgoCD vs Flux

ArgoCD 외에 또 다른 GitOps 표준 도구로 **Flux CD**가 있다. 둘 다 CNCF Graduated 프로젝트이며 Pull 방식 GitOps를 구현한다.

| 항목 | ArgoCD | Flux CD |
|:---|:---|:---|
| UI | 공식 Web UI 제공 | UI 별도 (Weave GitOps 등) |
| 구성 단위 | Application CRD | Kustomization·HelmRelease CRD |
| 멀티테넌시 | AppProject 기반 RBAC | 네임스페이스·테넌트 단위 |
| 이미지 자동 업데이트 | Argo Image Updater 별도 설치 | Flux 내장(Image Automation) |
| 알림 | Argo Notifications | Flux Notification Controller |
| 학습 곡선 | UI 중심, 진입 쉬움 | CLI·CRD 중심, GitOps 친화 |
| 배포 전략 | Argo Rollouts 연계 | Flagger 연계 |

선택 기준은 대략 "**시각적 대시보드·운영자 UX 중시 → ArgoCD**, **CLI·선언형 단일화·경량성 중시 → Flux**"로 정리된다.

## 7. 시크릿 관리

GitOps 는 **"모든 것이 Git에"** 가 원칙이지만, 비밀번호·토큰 같은 시크릿을 평문으로 커밋할 수는 없다. 두 가지 패턴이 표준처럼 쓰인다.

### Sealed Secrets (Bitnami)

클러스터에 설치된 Controller의 공개키로 시크릿을 **암호화한 CRD(`SealedSecret`)** 를 Git에 커밋한다. Controller가 이를 복호화해 일반 `Secret` 으로 변환한다.

```bash
# kubeseal로 암호화
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# Git 커밋 가능
git add sealed-secret.yaml
```

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-password
spec:
  encryptedData:
    password: AgBy8hCi9...  # 암호화된 값
```

### External Secrets Operator (ESO)

AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager 같은 **외부 시크릿 저장소와 쿠버네티스 Secret을 동기화**한다. 실제 값은 외부에 두고 Git에는 참조만 커밋한다.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secret-store
    kind: SecretStore
  target:
    name: db-credentials
  data:
  - secretKey: password
    remoteRef:
      key: prod/db
      property: password
```

| 비교 | Sealed Secrets | External Secrets |
|:---|:---|:---|
| 저장 위치 | Git(암호화 상태) | 외부 Vault·Cloud KMS |
| 회전 | 재암호화·재커밋 | 외부에서 회전, 자동 반영 |
| 의존성 | Controller 키 분실 시 복구 불가 | 외부 저장소 가용성 의존 |
| 적합 | 소규모, 온프레미스 | 멀티클라우드, 대규모 조직 |

## 8. 배포 전략

### Blue-Green

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 3
  strategy:
    blueGreen:
      activeService: myapp-active
      previewService: myapp-preview
      autoPromotionEnabled: false
```

### Canary

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - setWeight: 30
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100
```

Blue-Green 은 전체 트래픽을 한 번에 전환하므로 롤백이 즉시 가능하고, Canary 는 일부 트래픽부터 서서히 전환해 위험을 분산시킨다.

## 9. 핵심 정리

| 도구 | 역할 | 특징 |
|:---|:---|:---|
| Jenkins | CI | 빌드·테스트·이미지 생성 |
| ArgoCD | CD | GitOps 기반 동기화 |
| Flux | CD | CRD 중심 GitOps |
| Sealed Secrets | 시크릿 | Git 커밋 가능한 암호화 |
| External Secrets | 시크릿 | 외부 Vault·KMS 연계 |

{{< callout type="info" >}}
**용어 정리**
- **CI**: 코드 통합 → 자동 빌드·테스트
- **CD**: 자동 배포 (Delivery는 수동 승인, Deployment는 완전 자동)
- **GitOps**: Git을 단일 진실 공급원으로 쓰는 운영 방식
- **Push vs Pull**: 외부에서 Apply vs 클러스터가 Git을 당겨오기
- **Self-Heal**: Git 상태와 다른 수동 변경을 자동 복구
- **Prune**: Git에서 삭제된 리소스를 클러스터에서도 제거
- **Rollout**: Argo의 고급 배포 전략 CRD (Blue-Green, Canary)
- **Sealed Secrets**: 암호화된 Secret을 Git에 커밋 가능한 형태로 관리
- **External Secrets**: 외부 Vault·KMS와 쿠버네티스 Secret 동기화
{{< /callout >}}
