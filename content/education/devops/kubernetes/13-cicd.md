---
title: "13. CI/CD"
date: 2026-04-23
weight: 13
---

[12. Kustomize](../12-kustomize)는 기록과 적용과 정리를 자기 일이 아니라며 Git과 ArgoCD에 넘겼고, [11. Helm](../11-helm)은 값에 넣으면 안 되는 비밀을 이 장 7절로 미뤘다. [10. 클러스터 유지보수](../10-cluster-maintenance) 10절은 모든 변경이 커밋이면 백업은 이미 되어 있다고 했다. 이 장은 그 커밋이 어떻게 만들어지고 어떻게 클러스터의 상태가 되는지를 잇는다. 원리는 셋이다. 첫째, **CI는 코드를 이미지로 바꾸고 CD는 매니페스트를 클러스터의 상태로 바꾼다. 둘의 경계는 Git 저장소다.** CI가 끝나는 곳은 레지스트리에 올라간 이미지 하나와 매니페스트 저장소의 커밋 하나이고, CD는 그 커밋에서 시작한다. 둘째, **GitOps에서 배포는 커밋이고, 클러스터가 Git을 당겨 와 스스로 맞춘다.** 밖에서 클러스터로 밀어 넣지 않으니 클러스터의 자격 증명이 밖에 없고, 되돌리기는 `git revert`다. 셋째, **Git에 넣을 수 없는 것과 Deployment가 못 하는 것은 따로 푼다.** 비밀은 암호화해서 넣거나 밖에 두고 참조만 넣으며, 트래픽을 조금씩 옮기는 배포는 그 일을 하는 컨트롤러가 맡는다.

---

## 1. CI/CD 개념

| 단계 | 하는 일 | 끝나는 곳 | 왜 나누는가 |
|:-----|:------|:-------|:--------|
| CI (지속적 통합) | 코드 변경마다 빌드하고 테스트하고 이미지를 만든다 | 레지스트리의 이미지 | 통합을 미루면 충돌이 쌓인다. 작은 변경을 자주 합쳐 일찍 깨지게 한다 |
| CD (지속적 전달·배포) | 검증된 이미지를 실행 환경에 올린다 | 클러스터의 상태 | 배포가 사람 손의 절차면 드물고 위험해진다. 자주 하려면 기계가 해야 한다 |

첫째 원리다. CI와 CD는 다른 것을 다룬다. CI의 입력은 소스 코드이고 출력은 이미지다. CD의 입력은 매니페스트이고 출력은 클러스터의 상태다. CI 도구는 Jenkins, GitHub Actions, GitLab CI, Tekton 가운데 무엇이든 되고, CD는 ArgoCD나 Flux가 맡는다. 어느 조합이든 둘이 만나는 곳은 같다. CI가 매니페스트 저장소에 "이미지 태그를 이것으로 바꾼다"는 커밋을 남기는 자리다.

### 용어 정리

| 용어 | 뜻 | 왜 구분하나 |
|:-----|:--|:--------|
| 커밋 | 저장소에 남긴 변경 하나 | 파이프라인을 일으키는 사건이자 되돌릴 단위 |
| 빌드 | 소스를 실행할 수 있는 형태로 | 컴파일과 패키징 |
| 테스트 | 단위·통합 테스트로 검증 | 통과해야 다음으로 간다 |
| 아티팩트 | 빌드의 결과물. 여기서는 컨테이너 이미지 | 한 번 만든 것을 모든 환경에 그대로 쓴다. 환경마다 다시 빌드하지 않는다 |
| 배포 (deploy) | 아티팩트를 환경에 올리는 것 | 기술적인 사건 |
| 릴리스 (release) | 사용자에게 새 버전을 여는 것 | 사업적인 사건. 배포해 놓고 트래픽을 안 주면 아직 릴리스가 아니다. 8절의 카나리가 이 틈을 쓴다 |

### Continuous Delivery vs Deployment

| 구분 | Delivery (전달) | Deployment (배포) | 왜 |
|:-----|:-------------|:---------------|:---|
| 운영 반영 | 사람이 승인한 뒤 | 자동 | 앞의 것은 언제든 배포할 수 있는 상태를 유지하고, 버튼은 사람이 누른다 |
| 사람 | 승인자 | 없음 | 승인은 검증이 아니다. 테스트가 못 잡는 것을 승인자가 잡지는 못한다 |
| 맞는 곳 | 규제와 감사가 있는 곳, 배포 시각을 맞춰야 하는 곳 | 하루에도 여러 번 내보내는 서비스 | |
| GitOps에서는 | 매니페스트 변경을 풀 리퀘스트로 올리고 사람이 병합 | CI가 바로 커밋 | 승인이 Git의 리뷰가 된다. 누가 승인했는지가 저장소에 남는다 |

---

## 2. 전체 파이프라인 흐름

```text
개발자 ─push─▶ 앱 저장소
                 │ webhook
                 ▼
        CI (Jenkins 등)
        빌드 · 테스트 · 이미지
                 │ push
                 ▼
        컨테이너 레지스트리
                 │ 태그를 적어 커밋
                 ▼
        매니페스트 저장소  ◀─ 경계
                 │ 당겨 감
                 ▼
        CD (ArgoCD)
        비교 · 동기화
                 │
                 ▼
        쿠버네티스 클러스터
```

| 단계 | 누가 | 산출물 | 왜 |
|:-----|:----|:-----|:---|
| 빌드와 테스트 | CI | 테스트 결과 | 깨진 코드는 이미지가 되지 못한다 |
| 이미지 빌드와 푸시 | CI | 태그와 다이제스트가 있는 이미지 | 태그는 커밋 해시나 버전으로. `latest`는 무엇이 도는지 말해 주지 않는다 |
| 검사와 서명 | CI | 취약점 보고, 서명 | [08](../08-security)장 8.3절. 클러스터에 들어오기 전에 거른다 |
| 매니페스트 갱신 | CI | 매니페스트 저장소의 커밋 | [12](../12-kustomize)장 5.2절의 `kustomize edit set image`. 여기까지가 CI다 |
| 동기화 | CD | 클러스터의 오브젝트 | 저장소와 클러스터를 견줘 다른 것을 맞춘다 |
| 점진 배포 | 배포 컨트롤러 | 트래픽 비율 | 8절. 새 버전에 트래픽을 조금씩 준다 |
| 관측 | [09](../09-observability)장의 도구 | 메트릭, 로그 | 배포가 성공인지는 파드가 뜬 것이 아니라 오류율이 말한다 |

---

## 3. GitOps 원칙

| 원칙 (OpenGitOps 1.0) | 뜻 | 왜 |
|:------------------|:--|:---|
| 선언적 (Declarative) | 바라는 상태를 선언으로 적는다 | 절차(무엇을 실행하라)는 비교할 수 없지만 상태(이렇게 되어 있어야 한다)는 비교할 수 있다 |
| 버전 관리되고 불변 (Versioned and Immutable) | 바라는 상태를 이력이 남고 바뀌지 않는 곳에 둔다 | 누가 언제 무엇을 바꿨는지, 어제는 어땠는지 |
| 자동으로 당겨 옴 (Pulled Automatically) | 에이전트가 저장소에서 선언을 스스로 가져온다 | 밖에서 밀어 넣지 않는다 |
| 끊임없이 조정 (Continuously Reconciled) | 에이전트가 실제 상태를 지켜보며 바라는 상태로 맞춘다 | 한 번 적용하고 끝이 아니다. 어긋나면 되돌린다 |

둘째 원리다. 쿠버네티스 자체가 "바라는 상태를 적으면 컨트롤러가 맞춘다"로 돌아간다([02](../02-core-concepts)장 1절). GitOps는 그 고리를 한 단 바깥으로 넓힌 것이다. 바라는 상태의 원본을 etcd가 아니라 Git에 두고, Git과 클러스터를 맞추는 컨트롤러를 하나 더 둔다.

### Push vs Pull 배포

```text
[Push]
CI ──kubectl apply──▶ 클러스터
     (CI가 클러스터 자격 증명을 든다)

[Pull]
클러스터 안의 에이전트
   │ 지켜봄          ▲ 적용
   ▼                 │
 Git 저장소 ─────────┘
     (자격 증명이 밖으로 안 나간다)
```

| 구분 | Push | Pull | 왜 |
|:-----|:-----|:-----|:---|
| 누가 적용하나 | CI가 밖에서 | 클러스터 안의 에이전트가 | |
| 자격 증명 | CI에 클러스터 관리 권한을 준다 | 에이전트가 Git 읽기 권한만 갖는다 | CI 서버가 뚫리면 앞의 것은 클러스터가 뚫린다 |
| 네트워크 | 클러스터 API가 CI에서 닿아야 한다 | 클러스터에서 Git으로 나가기만 | 사설망의 클러스터에 구멍을 안 낸다 |
| 어긋남 | 다음 파이프라인까지 모른다 | 계속 견줘서 안다 | 누가 손으로 고친 것을 알아챈다 |
| 도구 | Jenkins, GitHub Actions의 배포 단계 | ArgoCD, Flux | |

{{< callout type="info" >}}
**Push는 클러스터의 열쇠를 밖에 맡긴다.** CI가 `kubectl apply`를 하려면 CI 서버에 kubeconfig나 토큰이 있어야 하고, 그 권한은 보통 넓다. Pull은 방향이 반대다. 클러스터 안의 에이전트가 밖으로 나가 가져오므로 클러스터로 들어오는 길을 열 필요가 없다. CI에 남는 권한은 레지스트리에 올리는 것과 매니페스트 저장소에 커밋하는 것뿐이다.
{{< /callout >}}

### GitOps 저장소 구조

```text
my-app/            앱 저장소 (코드)
├── src/
├── Dockerfile
└── Jenkinsfile

manifests/         매니페스트 저장소
├── apps/
│   └── my-app/
│       ├── base/
│       └── overlays/
│           ├── dev/
│           ├── staging/
│           └── production/
└── infrastructure/
    ├── monitoring/
    └── ingress/
```

| 결정 | 권하는 쪽 | 왜 |
|:-----|:-------|:---|
| 코드와 매니페스트 | 저장소를 나눈다 | 매니페스트 커밋이 CI를 다시 일으키는 고리를 끊는다. 권한도 나뉜다. 개발자는 코드에, 배포는 매니페스트에 |
| 환경 | 브랜치가 아니라 디렉터리(overlay)로 | 브랜치로 나누면 환경 사이의 차이가 병합 충돌 속에 숨는다. 디렉터리면 `diff`로 보인다 |
| 승격 | dev의 태그를 staging, production overlay로 옮기는 커밋 | 같은 이미지가 환경을 차례로 지난다. 환경마다 다시 빌드하지 않는다 |
| 인프라 | 앱과 따로 | 모니터링, 인그레스 컨트롤러는 앱보다 먼저 있어야 하고 주기가 다르다 |

---

## 4. Jenkins

Jenkins는 가장 오래 쓰인 오픈소스 자동화 서버다. 플러그인이 많고, 파이프라인을 저장소의 `Jenkinsfile`로 적는다. 쿠버네티스에서는 컨트롤러 하나가 떠 있고, 빌드마다 에이전트 파드가 만들어졌다 사라진다.

| CI 도구 | 어디서 도나 | 파이프라인 정의 | 왜 고르나 |
|:-------|:--------|:-----------|:-------|
| Jenkins | 직접 운영. 클러스터 안이나 밖 | `Jenkinsfile` (Groovy) | 플러그인과 자유도. 운영이 몫이다 |
| GitHub Actions, GitLab CI | 저장소 서비스가 운영 | 저장소의 YAML | 저장소와 붙어 있어 설정이 적다 |
| Tekton | 클러스터 안. CRD | Task, Pipeline 오브젝트 | 파이프라인 자체가 쿠버네티스 오브젝트다 |

### 빌드 도구 비교

| 도구 | 스크립트 | 특징 | 왜 |
|:-----|:------|:----|:---|
| Ant | XML | 절차를 하나하나 적는다 | 규칙이 없어 프로젝트마다 다르다. 남은 곳은 유지보수뿐 |
| Maven | `pom.xml` | 정해진 생명주기와 디렉터리 구조 | 관례를 따르면 설정이 거의 없다 |
| Gradle | Groovy, Kotlin DSL | 증분 빌드와 빌드 캐시 | 바뀐 것만 다시 빌드해서 CI 시간이 준다 |

### Jenkins를 쿠버네티스에 배포

```bash
helm repo add jenkinsci \
  https://charts.jenkins.io
helm repo update
helm upgrade --install jenkins \
  jenkinsci/jenkins \
  -n jenkins --create-namespace \
  -f jenkins-values.yaml --wait

# 초기 관리자 비밀번호
J='{.data.jenkins-admin-password}'
kubectl get secret jenkins -n jenkins \
  -o jsonpath="$J" | base64 -d
```

| 구성 | 뜻 | 왜 |
|:-----|:--|:---|
| 컨트롤러 | 파이프라인을 조율하고 화면을 내는 파드 하나. PVC에 `/var/jenkins_home` | 작업 정의와 이력이 디스크에 있다. [06](../06-storage)장의 PVC 없이는 재시작마다 사라진다 |
| 이미지 | `jenkins/jenkins:lts-jdk21` | 운영에서는 움직이는 태그 대신 버전을 박는다 |
| 포트 | 8080(화면과 API), 50000(에이전트 접속) | 에이전트가 WebSocket으로 붙으면 50000은 필요 없다 |
| 에이전트 | 빌드마다 만들어지는 파드. Kubernetes 플러그인 | 빌드가 끝나면 파드가 사라져 환경이 매번 깨끗하다 |
| ServiceAccount | 컨트롤러가 에이전트 파드를 만들 권한 | [08](../08-security)장 4절. 에이전트 네임스페이스의 pods에 대한 권한만 |

### Declarative Pipeline

```groovy
pipeline {
  agent {
    kubernetes {
      yamlFile 'ci/build-pod.yaml'
      defaultContainer 'gradle'
    }
  }
  environment {
    IMAGE = 'reg.example.com/my-app'
    TAG = "${GIT_COMMIT.take(7)}"
  }
  stages {
    stage('Test') {
      steps {
        sh './gradlew clean test'
      }
      post {
        always {
          junit '**/TEST-*.xml'
        }
      }
    }
    stage('Image') {
      steps {
        container('buildkit') {
          sh 'ci/build-image.sh'
        }
      }
    }
    stage('Deploy commit') {
      when { branch 'main' }
      steps {
        sh 'ci/bump-manifest.sh'
      }
    }
  }
}
```

```yaml
# ci/build-pod.yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: ci-agent
  containers:
  - name: gradle
    image: gradle:8-jdk21
    command: ["sleep", "infinity"]
  - name: buildkit
    image: moby/buildkit:rootless
    command: ["sleep", "infinity"]
    env:
    - name: BUILDKITD_FLAGS
      value:
        --oci-worker-no-process-sandbox
    securityContext:
      runAsUser: 1000
      seccompProfile:
        type: Unconfined
```

```bash
# ci/build-image.sh
buildctl-daemonless.sh build \
  --frontend dockerfile.v0 \
  --local context=. \
  --local dockerfile=. \
  --output \
  type=image,name=$IMAGE:$TAG,push=true
```

```bash
# ci/bump-manifest.sh
git clone "$GITOPS_REPO" gitops
cd gitops/apps/my-app/overlays/dev
kustomize edit set image \
  my-app=$IMAGE:$TAG
git commit -am "my-app $TAG"
git push
```

| 단계 | 하는 일 | 왜 이렇게 |
|:-----|:------|:-------|
| `agent { kubernetes }` | 빌드마다 위 파드를 만든다. `jnlp` 컨테이너는 플러그인이 넣는다 | 컨테이너마다 도구 하나. Gradle과 이미지 빌더를 한 이미지에 욱여넣지 않는다 |
| Test | `gradle` 컨테이너에서 테스트 | 결과는 실패해도 모은다(`always`) |
| Image | `buildkit` 컨테이너에서 이미지를 만들어 올린다 | 파드 안에는 Docker 데몬이 없다. 노드의 소켓을 마운트하면 노드 전체를 내주는 것이다([06](../06-storage)장 2.2절) |
| Deploy commit | 매니페스트 저장소의 태그를 고쳐 커밋 | 첫째 원리의 경계. CI는 클러스터에 손대지 않는다 |
| 태그 | 커밋 해시 앞 일곱 자 | 이미지에서 코드를 찾을 수 있다. 빌드 번호는 Jenkins를 다시 깔면 겹친다 |

이미지를 파드 안에서 만드는 도구는 Docker 데몬 없이 도는 것이어야 한다. 오래 쓰이던 Kaniko는 2025년 6월에 보관 처리되어 더는 관리되지 않는다. 지금은 BuildKit의 루트 없는 모드나 Buildah를 쓴다. BuildKit의 루트 없는 모드는 `unshare`와 `mount` 시스템 콜이 필요해 seccomp을 `Unconfined`로 둬야 하고, 그래서 [08](../08-security)장 7.2절의 restricted 프로파일을 건 네임스페이스에서는 뜨지 못한다. CI 에이전트의 네임스페이스는 baseline으로 두고 다른 워크로드와 떼어 놓는다.

### 멀티브랜치 조건 배포

```groovy
stage('Promote to production') {
  when { branch 'main' }
  steps {
    input message: '운영에 올릴까요?',
          ok: '승격'
    sh 'ci/promote.sh production'
  }
}
```

| 구문 | 뜻 | 왜 |
|:-----|:--|:---|
| `when { branch 'main' }` | 그 브랜치의 빌드에서만 돈다 | 기능 브랜치는 테스트까지만 |
| `input` | 사람이 누를 때까지 멈춘다 | 1절의 Delivery. 다만 승인 기록이 Jenkins에만 남는다. 풀 리퀘스트로 승인하면 Git에 남는다 |
| 멀티브랜치 파이프라인 | 저장소의 브랜치와 풀 리퀘스트마다 작업이 자동으로 생긴다 | 브랜치를 만들면 CI가 따라온다 |

{{< callout type="warning" >}}
**컨트롤러에서 빌드하지 않는다.** `agent any`로 컨트롤러가 직접 빌드하면 빌드 스크립트가 컨트롤러의 파일과 자격 증명을 볼 수 있고, 빌드끼리 작업 공간과 자원을 다툰다. 쿠버네티스에서는 빌드마다 파드를 만들어 쓰고 버린다. 컨트롤러의 실행기 수는 0으로 두고, 에이전트 파드에는 [09](../09-observability)장 2절대로 requests와 limits를 적어 빌드가 노드를 굶기지 않게 한다.
{{< /callout >}}

---

## 5. ArgoCD

### 아키텍처

```text
 사람 (UI, CLI)      Git, 차트 저장소
      │                   │
      ▼                   ▼
 ┌──────────┐      ┌──────────────┐
 │API 서버  │─────▶│ 저장소 서버  │
 └──────────┘      │ 받아서 렌더링│
      │            └──────┬───────┘
      ▼                   │ 매니페스트
 ┌─────────────────────────────────┐
 │ 애플리케이션 컨트롤러           │
 │ 바라는 상태 ⇄ 실제 상태 비교   │
 └──────────────┬──────────────────┘
                ▼
            클러스터
```

| 컴포넌트 | 하는 일 | 왜 나뉘어 있나 |
|:-------|:------|:-----------|
| API 서버 | UI, CLI, CI가 부르는 API. 인증, RBAC, 저장소와 클러스터의 자격 증명 관리, Git 웹훅 수신 | 사람과 닿는 면 |
| 저장소 서버 | Git을 받아 캐시하고, Kustomize나 Helm으로 매니페스트를 만든다 | 렌더링은 남의 코드(차트, 플러그인)를 돌리는 일이라 클러스터 권한이 있는 쪽과 떼어 놓는다 |
| 애플리케이션 컨트롤러 | 바라는 상태와 실제 상태를 계속 견주고, 다르면 동기화한다 | 클러스터 권한을 가진 유일한 쪽 |
| ApplicationSet 컨트롤러 | 틀 하나로 Application 여럿을 찍어 낸다 | 클러스터나 디렉터리마다 Application을 손으로 만들지 않게 |
| Redis, Dex, 알림 컨트롤러 | 캐시, SSO, 알림 | |

### 설치

```bash
kubectl create namespace argocd
U=https://raw.githubusercontent.com
U=$U/argoproj/argo-cd/stable
kubectl apply -n argocd \
  --server-side --force-conflicts \
  -f $U/manifests/install.yaml

argocd admin initial-password -n argocd
kubectl port-forward -n argocd \
  svc/argocd-server 8080:443
argocd login localhost:8080
```

설치에 `--server-side`가 필요한 것은 CRD가 커서다. 클라이언트 쪽 `kubectl apply`는 [02](../02-core-concepts)장 10.3절대로 지난번 적용한 내용을 어노테이션에 통째로 적는데, 어노테이션의 한도가 262KB이고 ApplicationSet의 CRD가 그것을 넘는다. 지금의 최신은 3.5다. 운영에서는 `stable` 대신 버전 태그의 매니페스트를 쓰거나 Helm 차트로 깐다.

### Application 리소스

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL:
      https://github.com/org/manifests
    targetRevision: main
    path:
      apps/my-app/overlays/production
  destination:
    server:
      https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

| 필드 | 뜻 | 기본 | 왜 |
|:-----|:--|:----|:---|
| `source` | 어느 저장소의 어느 경로, 어느 리비전 | | 바라는 상태의 출처. 경로에 `kustomization.yaml`이 있으면 Kustomize, `Chart.yaml`이 있으면 Helm으로 렌더링한다 |
| `destination` | 어느 클러스터의 어느 네임스페이스 | | ArgoCD 하나가 클러스터 여럿을 돌볼 수 있다 |
| `project` | AppProject. 쓸 수 있는 저장소, 클러스터, 리소스 종류의 울타리 | `default` | 팀마다 나눠 남의 네임스페이스에 배포하지 못하게 |
| `automated` | 어긋나면 사람 없이 동기화 | 꺼짐 | 없으면 어긋남을 보여 주기만 한다 |
| `prune` | Git에서 사라진 오브젝트를 지운다 | 꺼짐 | 안전장치. 저장소 경로를 잘못 고쳐 전부 "사라진 것"이 되는 사고를 막는다 |
| `selfHeal` | 클러스터에서 손으로 고친 것을 되돌린다 | 꺼짐 | 꺼져 있으면 Git이 바뀔 때만 동기화한다 |
| `syncOptions` | `CreateNamespace`, `ServerSideApply`, `PruneLast`, `ApplyOutOfSyncOnly` 등 | | 오브젝트 하나에만 걸려면 `argocd.argoproj.io/sync-options` 어노테이션 |
| `retry` | 실패한 동기화를 다시 | 없음 | CRD가 아직 안 깔린 것 같은 일시적 실패 |

[12](../12-kustomize)장 10절이 이 절로 미룬 Application이 이것이다. Application은 "이 저장소의 이 경로가 저 클러스터의 저 네임스페이스에 있어야 한다"는 선언 하나이고, 그 자체가 쿠버네티스 오브젝트라 Git에 둘 수 있다. Application들을 담은 디렉터리를 가리키는 Application 하나를 두면(앱의 앱) 새 앱을 더하는 일도 커밋이 된다.

### 동기화·헬스 상태

| Sync 상태 | 뜻 | 왜 |
|:--------|:--|:---|
| Synced | 렌더링한 매니페스트와 클러스터가 같다 | |
| OutOfSync | 다르다 | Git이 바뀌었거나 클러스터를 누가 고쳤다 |
| Unknown | 견줄 수 없다 | 저장소에 못 닿거나 렌더링이 실패했다 |

| Health 상태 | 뜻 | 왜 |
|:----------|:--|:---|
| Healthy | 정상 | Deployment라면 갱신된 레플리카가 바라는 수와 같다 |
| Progressing | 아직 아니지만 나아가는 중 | 롤아웃 중 |
| Degraded | 실패 | 파드가 못 뜬다 |
| Suspended | 멈춰 있다 | 일시 정지된 롤아웃, 멈춘 CronJob |
| Missing | 클러스터에 없다 | |
| Unknown | 판정 불가 | |

두 상태는 다른 질문이다. Sync는 "Git과 같은가", Health는 "제대로 도는가"다. Synced이면서 Degraded일 수 있다. 매니페스트는 적용됐는데 이미지가 없어 파드가 못 뜨는 경우다. Application의 Health는 자식 리소스 가운데 가장 나쁜 것을 따른다.

| 조정 | 값 | 왜 |
|:-----|:--|:---|
| Git 확인 주기 | 120초에 지터 60초. 최대 3분 | 바로 반영하려면 저장소의 웹훅을 API 서버에 건다 |
| 자가 치유 지연 | 5초 | |
| 실패한 동기화 | 같은 커밋과 같은 매개변수로는 다시 시도하지 않는다 | 깨진 매니페스트를 끝없이 적용하지 않는다. `retry`를 적으면 그만큼은 한다 |
| 순서 | 단계(PreSync, Sync, PostSync) → 웨이브(낮은 수 먼저) → 종류 → 이름 | `argocd.argoproj.io/sync-wave` 어노테이션. CRD와 네임스페이스를 먼저, 그것을 쓰는 것을 나중에 |
| 훅 | `argocd.argoproj.io/hook: PreSync` 같은 어노테이션을 단 Job | DB 마이그레이션. 실패하면 동기화가 멈춘다 |

### 자주 쓰는 CLI

```bash
argocd app list
argocd app get my-app
argocd app diff my-app
argocd app sync my-app
argocd app history my-app
argocd app rollback my-app 12
argocd app set my-app \
  --sync-policy none
```

{{< callout type="warning" >}}
**`selfHeal`은 급한 손질도 되돌린다.** 장애 중에 누가 `kubectl edit`로 고친 것을 ArgoCD가 5초 뒤 Git의 상태로 되돌린다. 급한 수정도 Git에 커밋해서 하는 것을 원칙으로 하고, 그럴 수 없을 때는 그 Application의 자동 동기화를 잠시 끈 뒤 고친다. 그리고 자동 동기화가 켜진 Application은 `argocd app rollback`이 안 된다. 되돌린 상태를 ArgoCD가 곧바로 Git의 최신으로 다시 맞추기 때문이다. GitOps에서 되돌리기는 `git revert`다.
{{< /callout >}}

### Kustomize·Helm 통합

```yaml
# Kustomize 디렉터리
spec:
  source:
    repoURL:
      https://github.com/org/manifests
    path:
      apps/my-app/overlays/production
    kustomize:
      images:
      - my-app:v1.2.4
---
# Helm 차트 (OCI 레지스트리)
spec:
  source:
    repoURL: reg.example.com/charts
    chart: my-app
    targetRevision: 1.2.0
    helm:
      releaseName: my-app
      valuesObject:
        replicaCount: 3
```

| 렌더링 | ArgoCD가 하는 일 | 왜 알아야 하나 |
|:-----|:-------------|:-----------|
| Kustomize | `kustomize build` | [12](../12-kustomize)장 10절. 묶인 버전이 로컬과 다를 수 있다 |
| Helm | `helm template`. 3.5부터는 Helm 4 바이너리 | [11](../11-helm)장 11절이 미룬 것. 차트를 렌더링만 하고 적용은 ArgoCD가 하므로 릴리스 Secret이 안 생기고 `helm list`에 안 나온다. 이력은 ArgoCD와 Git에 있다 |
| Helm 훅 | ArgoCD 훅으로 바꿔 읽는다. `pre-install`·`pre-upgrade`는 PreSync, `post-install`·`post-upgrade`는 PostSync | 의미가 조금 다르다. 설치와 업그레이드를 구분하지 않는다 |
| 무작위 값 | `randAlphaNum`을 쓰는 차트는 늘 OutOfSync | 견줄 때마다 다시 렌더링하니 값이 매번 다르다 |
| OCI 차트 | `repoURL`에 `oci://` 없이 레지스트리 주소만 | |
| 값 파일을 다른 저장소에서 | `sources` 여럿과 `ref` | 남의 차트에 우리 값 파일을 얹는다. 차트는 차트 저장소에서, 값은 매니페스트 저장소에서 |

---

## 6. ArgoCD vs Flux

| 항목 | ArgoCD | Flux | 왜 다른가 |
|:-----|:------|:-----|:-------|
| 모양 | API 서버와 UI를 가진 애플리케이션 | 컨트롤러 묶음. source, kustomize, helm, notification, image | ArgoCD는 사람이 보는 도구로, Flux는 클러스터의 부품으로 출발했다 |
| 단위 | `Application` | `GitRepository` 같은 소스 + `Kustomization`, `HelmRelease` | Flux는 "어디서 가져오나"와 "어떻게 적용하나"를 다른 오브젝트로 나눈다 |
| UI | 기본 제공 | 기본에 없다. Headlamp 플러그인, Capacitor, Flux Operator의 화면 등을 붙인다 | |
| Helm | `helm template`으로 렌더링만 | helm-controller가 실제 릴리스를 만든다. `helm list`에 보인다 | Helm의 훅과 롤백을 그대로 쓰느냐, GitOps 도구의 것으로 바꾸느냐 |
| 이미지 자동 갱신 | Image Updater를 따로 | image 컨트롤러가 레지스트리를 보고 Git에 커밋 | |
| 여러 팀 | AppProject와 자체 RBAC | 쿠버네티스 RBAC과 ServiceAccount 흉내 | Flux는 쿠버네티스의 권한 체계를 그대로 쓴다 |
| 점진 배포 | Argo Rollouts | Flagger | 8절 |
| 버전 | 3.5 | 2.9 | 둘 다 CNCF 졸업 프로젝트 |

고르는 기준은 누가 쓰느냐다. 개발자가 화면에서 자기 앱의 상태를 보고 동기화를 누르게 하려면 ArgoCD이고, 플랫폼 팀이 클러스터의 부품으로 조용히 돌리려면 Flux다. Flux의 `Kustomization` 오브젝트는 [12](../12-kustomize)장의 `kustomization.yaml`과 이름만 같고 다른 것이다. 앞의 것은 "이 경로를 이 주기로 적용하라"는 Flux의 CRD이고, 뒤의 것은 Kustomize의 빌드 선언이다.

---

## 7. 시크릿 관리

셋째 원리의 첫 조각이다. GitOps는 모든 것을 Git에 두자고 하지만 Secret은 그럴 수 없다. [08](../08-security)장 8.4절대로 Secret의 base64는 인코딩이지 암호화가 아니라, 커밋하는 순간 저장소를 읽을 수 있는 모든 사람이 읽는다. 길은 둘이다. 암호화해서 넣거나, 넣지 않고 참조만 넣는다.

### Sealed Secrets

```bash
# 클러스터의 공개키로 암호화
kubeseal --format yaml \
  < secret.yaml > sealed.yaml
git add sealed.yaml

# 공개키를 받아 두고 오프라인으로
kubeseal --fetch-cert > pub.pem
kubeseal --cert pub.pem --format yaml \
  < secret.yaml > sealed.yaml
```

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-password
  namespace: production
spec:
  encryptedData:
    password: AgBy8hCi9...
```

| 항목 | 동작 | 왜 |
|:-----|:----|:---|
| 구조 | 클러스터의 컨트롤러가 키 쌍을 갖고, `kubeseal`이 공개키로 암호화한다. 복호화는 컨트롤러만 | 암호화는 누구나, 복호화는 그 클러스터만. 그래서 암호문을 Git에 둘 수 있다 |
| 범위 | `strict`(기본)는 이름과 네임스페이스에 묶인다. `namespace-wide`, `cluster-wide`로 풀 수 있다 | 이름과 네임스페이스가 암호화에 들어간다. 남의 SealedSecret을 자기 네임스페이스로 복사해도 풀리지 않는다 |
| 키 갱신 | 30일마다 새 키. 옛 키는 남는다 | 옛 SealedSecret도 계속 풀린다. 키 갱신은 재암호화가 아니고, 비밀번호 자체의 교체도 아니다 |
| 키 백업 | 컨트롤러의 키 Secret을 클러스터 밖에 보관 | 클러스터를 새로 만들면 새 키가 생겨 저장소의 SealedSecret을 전부 못 푼다 |

```bash
L=sealedsecrets.bitnami.com
kubectl get secret -n kube-system \
  -l $L/sealed-secrets-key \
  -o yaml > sealing-keys.yaml
```

### External Secrets Operator (ESO)

```yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-store
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-store
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: password
    remoteRef:
      key: prod/db
      property: password
```

| 필드 | 뜻 | 왜 |
|:-----|:--|:---|
| `SecretStore`, `ClusterSecretStore` | 어느 외부 저장소에 어떻게 붙나 | 저장소 접속과 비밀 하나하나를 나눈다. 앞의 것은 네임스페이스 안, 뒤의 것은 클러스터 전체 |
| `remoteRef` | 외부 저장소의 어느 키, 어느 속성 | Git에 남는 것은 이 주소뿐이다 |
| `target` | 만들 Secret의 이름 | 파드는 평범한 Secret으로 읽는다. ESO를 몰라도 된다 |
| `refreshInterval` | 다시 읽는 주기 | 밖에서 비밀번호를 바꾸면 이 주기 안에 Secret이 바뀐다 |
| `creationPolicy` | `Owner`(기본)는 ExternalSecret이 지워지면 Secret도 지워진다. `Merge`, `Orphan` | |

| 비교 | Sealed Secrets | External Secrets | SOPS | 왜 |
|:-----|:------------|:--------------|:-----|:---|
| 비밀의 원본 | Git(암호문) | 외부 저장소(Vault, 클라우드의 비밀 관리자) | Git(암호문) | |
| 키 | 클러스터 안의 컨트롤러 | 외부 저장소의 것 | KMS, age, PGP | SOPS는 파일을 암호화하는 도구이고 Flux가 풀어 준다. ArgoCD에서는 플러그인이 필요하다 |
| 교체 | 다시 암호화해 커밋 | 밖에서 바꾸면 따라온다 | 다시 암호화해 커밋 | |
| 약점 | 키를 잃으면 전부 못 푼다 | 외부 저장소가 죽으면 새 Secret을 못 만든다(있는 것은 남는다) | 키 관리가 몫 | |
| 맞는 곳 | 작은 팀, 외부 저장소가 없는 곳 | 비밀 관리자가 이미 있는 조직, 여러 클러스터 | Flux를 쓰는 곳 | |

{{< callout type="info" >}}
**어느 길이든 클러스터 안에는 평범한 Secret이 생긴다.** SealedSecret도 ExternalSecret도 결국 컨트롤러가 Secret 오브젝트를 만들어 주는 것이고, 그 Secret은 etcd에 있다. Git에서 비밀을 뺐다고 끝이 아니라, [08](../08-security)장 4절의 RBAC로 secrets 읽기를 좁히고 8.4절의 etcd 암호화를 켜야 한다. [11](../11-helm)장과 [12](../12-kustomize)장이 값과 제너레이터에 비밀을 넣지 말라고 한 것도, 그 자리에 이 절의 Secret 이름을 넣으라는 뜻이다.
{{< /callout >}}

---

## 8. 배포 전략

| 전략 | 트래픽을 옮기는 법 | 자원 | 되돌리기 | 왜 고르나 |
|:-----|:-------------|:----|:------|:-------|
| RollingUpdate (Deployment 기본) | 파드를 조금씩 바꾼다 | 조금 더 | 다시 롤아웃 | 대부분의 경우. [04](../04-workloads)장 4절 |
| Blue-Green | 새 버전을 다 띄운 뒤 한 번에 전환 | 두 배 | Service를 되돌리면 즉시 | 두 버전이 섞여 돌면 안 될 때. 전환 전에 새 버전을 시험해 볼 수 있다 |
| Canary | 일부 트래픽부터 조금씩 | 조금 더 | 비율을 0으로 | 실제 트래픽으로 검증하며 위험을 작게 나눈다 |

셋째 원리의 둘째 조각이다. [04](../04-workloads)장 4절에서 Blue-Green과 Canary는 Deployment 하나의 전략이 아니라 Deployment 둘과 Service로 손수 만드는 구성이라고 했다. 그 손작업을 컨트롤러로 만든 것이 Argo Rollouts다. `Rollout`은 Deployment와 같은 모양의 오브젝트인데 `strategy`에 단계가 있고, 컨트롤러가 그 단계대로 ReplicaSet과 Service와 트래픽 비율을 옮긴다. Flux 쪽에는 같은 일을 하는 Flagger가 있다.

### Blue-Green

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:        # Deployment와 같다
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: reg.example.com/my-app:v2
  strategy:
    blueGreen:
      activeService: my-app-active
      previewService: my-app-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
```

| 순서 | 일어나는 일 | 왜 |
|:-----|:--------|:---|
| 1 | 새 ReplicaSet이 만들어지고 `previewService`가 그것을 가리킨다 | 운영 트래픽은 아직 옛 버전. 새 버전은 미리보기 주소로 시험한다 |
| 2 | 새 ReplicaSet이 다 뜬다. `prePromotionAnalysis`가 있으면 돈다 | 전환 전에 검증 |
| 3 | `autoPromotionEnabled: false`면 멈춘다 | 사람이 `promote`를 칠 때까지 |
| 4 | `activeService`의 셀렉터가 새 ReplicaSet의 해시로 바뀐다 | 전환은 Service 하나의 셀렉터 변경이라 한순간이다 |
| 5 | `scaleDownDelaySeconds`(기본 30초) 뒤 옛 ReplicaSet을 줄인다 | 그사이 문제가 보이면 되돌릴 곳이 남아 있다. 아직 옛 파드로 가던 연결도 끝난다 |

### Canary

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: my-app-canary
      stableService: my-app-stable
      trafficRouting:
        plugins:
          argoproj-labs/gatewayAPI:
            httpRoute: my-app
            namespace: production
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - analysis:
          templates:
          - templateName: success-rate
      - setWeight: 50
      - pause: {}       # 사람을 기다림
      - setWeight: 100
```

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
  - name: success-rate
    interval: 1m
    failureLimit: 3
    successCondition: result[0] >= 0.99
    provider:
      prometheus:
        address: http://prom:9090
        query: |
          sum(rate(http_requests_total{
            app="my-app",code!~"5.."
          }[5m])) /
          sum(rate(http_requests_total{
            app="my-app"}[5m]))
```

| 단계 | 뜻 | 왜 |
|:-----|:--|:---|
| `setWeight: 10` | 트래픽의 10%를 새 버전으로 | |
| `pause: {duration: 5m}` | 5분 기다린다. 시간이 없으면 사람이 풀 때까지 | 메트릭이 쌓일 시간 |
| `analysis` | 메트릭을 재서 조건을 어기면 롤아웃을 중단하고 되돌린다 | 사람이 그래프를 보는 일을 기계가 한다. [09](../09-observability)장 10절의 Prometheus가 출처 |
| `trafficRouting` | 비율을 실제 트래픽에 건다. Gateway API, 인그레스 컨트롤러, 서비스 메시 | [07](../07-networking)장 9.4절의 HTTPRoute `weight`를 컨트롤러가 대신 고친다 |
| 트래픽 라우터가 없으면 | 비율을 파드 수로 흉내 낸다. 10개 중 1개 | [04](../04-workloads)장의 한계 그대로. 1%는 파드 100개가 있어야 한다 |

```bash
kubectl argo rollouts get rollout \
  my-app --watch
kubectl argo rollouts promote my-app
kubectl argo rollouts abort my-app
kubectl argo rollouts undo my-app
```

1절의 배포와 릴리스의 구분이 여기서 쓰인다. 새 버전의 파드가 뜬 것은 배포이고, 트래픽의 비율이 올라가는 것이 릴리스다. 카나리는 배포를 먼저 하고 릴리스를 천천히 하는 방법이며, 그 속도를 오류율이 정하게 하는 것이 `analysis`다. Rollout도 Git에 있는 오브젝트라 ArgoCD가 동기화하고, 이미지 태그가 바뀐 커밋이 들어오면 Rollout 컨트롤러가 단계를 밟는다. CI는 커밋까지, ArgoCD는 적용까지, Rollouts는 트래픽까지다.

## 핵심 정리

| 개념 | 핵심 | 왜 |
|:-----|:-----|:---|
| CI / CD | 코드를 이미지로 / 매니페스트를 클러스터 상태로 | 경계는 매니페스트 저장소의 커밋 |
| 배포와 릴리스 | 올리는 것 / 트래픽을 주는 것 | 카나리는 그 틈을 쓴다 |
| GitOps | 선언, 버전 관리, 자동으로 당겨 옴, 끊임없는 조정 | 쿠버네티스의 조정 고리를 Git까지 넓힌 것 |
| Push와 Pull | 밖에서 밀기 / 안에서 당기기 | Pull은 클러스터의 열쇠가 밖에 없다 |
| 저장소 | 코드와 매니페스트를 나눈다. 환경은 디렉터리로 | CI의 고리를 끊고, 차이가 보이게 |
| Jenkins | 컨트롤러 하나, 빌드마다 에이전트 파드 | 컨트롤러에서 빌드하지 않는다 |
| 이미지 빌드 | 데몬 없는 빌더. BuildKit 루트 없는 모드, Buildah | Kaniko는 보관 처리됐다 |
| ArgoCD | 저장소 서버가 렌더링, 컨트롤러가 견주고 맞춘다 | `prune`과 `selfHeal`은 기본이 꺼짐 |
| Sync와 Health | Git과 같은가 / 제대로 도는가 | 같으면서 아플 수 있다 |
| 되돌리기 | `git revert` | 자동 동기화에서는 `rollback`이 안 된다 |
| ArgoCD와 Helm | `helm template`만 | 릴리스 Secret이 없다 |
| ArgoCD와 Flux | 사람이 보는 도구 / 클러스터의 부품 | Flux는 실제 Helm 릴리스를 만든다 |
| 비밀 | 암호화해 넣거나(Sealed Secrets, SOPS) 참조만 넣는다(ESO) | 클러스터 안에는 어차피 평범한 Secret |
| Argo Rollouts | 단계가 있는 Deployment | 분석이 실패하면 스스로 되돌린다 |

{{< callout type="info" >}}
**용어 정리**
- **CI (지속적 통합)**: 변경마다 빌드, 테스트, 이미지 생성
- **CD (지속적 전달 / 배포)**: 검증된 것을 환경에 올리기. 전달은 사람이 승인, 배포는 자동
- **아티팩트**: 빌드의 결과물. 한 번 만들어 모든 환경에 쓴다
- **GitOps**: 바라는 상태를 Git에 두고 에이전트가 당겨 와 맞추는 방식
- **조정 (reconcile)**: 실제 상태를 바라는 상태에 맞추는 일을 되풀이하는 것
- **에이전트 파드**: 빌드마다 만들어졌다 사라지는 Jenkins의 작업 파드
- **BuildKit**: Docker 데몬 없이 이미지를 만드는 빌더. 루트 없는 모드가 있다
- **Application**: ArgoCD의 단위. 출처와 목적지와 동기화 정책
- **ApplicationSet**: Application을 틀로 찍어 내는 오브젝트
- **prune / selfHeal**: Git에서 사라진 것을 지우기 / 손으로 고친 것을 되돌리기
- **동기화 웨이브**: 동기화 안에서의 적용 순서. 낮은 수가 먼저
- **SealedSecret**: 클러스터의 공개키로 암호화해 Git에 둘 수 있는 Secret
- **ExternalSecret**: 외부 비밀 저장소의 값을 Secret으로 가져오는 선언
- **Rollout**: Argo Rollouts의 워크로드. Blue-Green과 Canary의 단계를 가진다
- **AnalysisTemplate**: 롤아웃 중에 잴 메트릭과 성공 조건
{{< /callout >}}
