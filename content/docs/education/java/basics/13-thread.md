---
title: "Chapter 13. 쓰레드 (Thread)"
weight: 13
---

# 쓰레드 (Thread)

**쓰레드(Thread)**는 프로세스 내에서 실제로 작업을 수행하는 실행 흐름의 단위다. 모든 프로세스는 최소 하나 이상의 쓰레드를 가진다.

---

## 1. 프로세스와 쓰레드

### 1.1 기본 개념

| 용어 | 설명 |
|:-----|:-----|
| 프로세스(Process) | 실행 중인 프로그램. OS로부터 메모리를 할당받아 동작 |
| 쓰레드(Thread) | 프로세스의 자원을 이용해 실제 작업을 수행하는 실행 단위 |
| 멀티쓰레드 프로세스 | 둘 이상의 쓰레드를 가진 프로세스 |

```
┌─────────────────────────────────────────────────────┐
│                    프로세스 (Process)                │
├─────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ 쓰레드1  │  │ 쓰레드2  │  │ 쓰레드3  │  ...       │
│  │(호출스택)│  │(호출스택)│  │(호출스택)│             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                     │
│  공유 자원: 메모리(Heap), 코드, 데이터               │
└─────────────────────────────────────────────────────┘
```

### 1.2 멀티태스킹과 멀티쓰레딩

```
멀티태스킹 (Multi-tasking)
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 프로세스1 │  │ 프로세스2 │  │ 프로세스3 │
│  (크롬)   │  │  (IDE)   │  │ (음악앱)  │
└──────────┘  └──────────┘  └──────────┘
      ↓             ↓             ↓
━━━━━━━━━━━━━━━━━ CPU ━━━━━━━━━━━━━━━━━
  (OS가 시간을 분배하여 동시 실행처럼 보이게 함)


멀티쓰레딩 (Multi-threading)
┌─────────────────────────────────────┐
│           하나의 프로세스            │
│  ┌───────┐  ┌───────┐  ┌───────┐  │
│  │ 채팅   │  │ 다운로드 │  │ 알림   │  │
│  │ 쓰레드 │  │ 쓰레드  │  │ 쓰레드 │  │
│  └───────┘  └───────┘  └───────┘  │
└─────────────────────────────────────┘
```

### 1.3 멀티쓰레딩의 장단점

**장점:**
- CPU 사용률 향상
- 자원의 효율적 사용
- 사용자 응답성 향상
- 작업 분리로 코드 간결화

**단점:**
- 동기화(Synchronization) 문제
- 교착상태(Deadlock) 발생 가능성
- 디버깅 어려움
- 컨텍스트 스위칭 오버헤드

{{< callout type="info" >}}
**경량 프로세스:** 쓰레드는 LWP(Light-Weight Process)라고도 불린다. 프로세스보다 생성/전환 비용이 적다.
{{< /callout >}}

---

## 2. 쓰레드의 구현과 실행

### 2.1 구현 방법 비교

| 방법 | 장점 | 단점 |
|:-----|:-----|:-----|
| Thread 클래스 상속 | 구현이 간단, 직접 Thread 메서드 접근 | 다른 클래스 상속 불가 |
| Runnable 인터페이스 구현 | 다른 클래스 상속 가능, 재사용성 좋음 | Thread 메서드 접근 시 `currentThread()` 필요 |

{{< callout type="info" >}}
**권장:** Java는 단일 상속만 지원하므로, Runnable 인터페이스 구현 방식을 권장한다.
{{< /callout >}}

### 2.2 Thread 클래스 상속

```java
class MyThread extends Thread {
    @Override
    public void run() {
        for (int i = 0; i < 5; i++) {
            // Thread 클래스의 getName() 직접 호출 가능
            System.out.println(getName() + ": " + i);
        }
    }
}

// 사용
MyThread t = new MyThread();
t.start();  // 쓰레드 실행
```

### 2.3 Runnable 인터페이스 구현

```java
class MyRunnable implements Runnable {
    @Override
    public void run() {
        for (int i = 0; i < 5; i++) {
            // Thread.currentThread()로 현재 쓰레드 참조 얻기
            System.out.println(Thread.currentThread().getName() + ": " + i);
        }
    }
}

// 사용
Runnable r = new MyRunnable();
Thread t = new Thread(r);       // Runnable을 Thread 생성자에 전달
t.start();

// 익명 클래스로 간단히
Thread t2 = new Thread(() -> {
    System.out.println("Lambda로 구현한 쓰레드");
});
t2.start();
```

### 2.4 쓰레드 실행 흐름

```java
public class ThreadExample {
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 3; i++) {
                System.out.println("Thread-1: " + i);
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 3; i++) {
                System.out.println("Thread-2: " + i);
            }
        });

        t1.start();
        t2.start();

        // 실행 결과는 매번 달라질 수 있음 (스케줄러에 의해 결정)
    }
}
```

{{< callout type="warning" >}}
**한 번만 start():** 하나의 쓰레드에 대해 `start()`는 한 번만 호출 가능하다. 두 번 호출하면 `IllegalThreadStateException`이 발생한다.
```java
Thread t = new Thread(() -> System.out.println("실행"));
t.start();
t.start();  // IllegalThreadStateException 발생!
```
{{< /callout >}}

---

## 3. start()와 run()의 차이

### 3.1 호출 스택 비교

```
run() 직접 호출 시:                  start() 호출 시:
┌─────────────┐                     ┌─────────────┐  ┌─────────────┐
│    run()    │                     │   main()    │  │    run()    │
├─────────────┤                     ├─────────────┤  ├─────────────┤
│   main()    │                     │   (끝)      │  │   (계속)    │
└─────────────┘                     └─────────────┘  └─────────────┘
  main 스택에서 실행                  main 스택        새로운 호출 스택
  (단일 쓰레드)                      (main 쓰레드)      (새 쓰레드)
```

### 3.2 비교 예제

```java
class MyThread extends Thread {
    @Override
    public void run() {
        throwException();
    }

    private void throwException() {
        try {
            throw new Exception();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

public class StartVsRun {
    public static void main(String[] args) {
        MyThread t = new MyThread();

        // run() 직접 호출 - 호출 스택에 main이 보임
        t.run();
        /*
        java.lang.Exception
            at MyThread.throwException(StartVsRun.java:10)
            at MyThread.run(StartVsRun.java:5)
            at StartVsRun.main(StartVsRun.java:18)  ← main 있음
        */

        // start() 호출 - 별도의 호출 스택
        t = new MyThread();  // 새로 생성 필요
        t.start();
        /*
        java.lang.Exception
            at MyThread.throwException(StartVsRun.java:10)
            at MyThread.run(StartVsRun.java:5)  ← main 없음 (별도 스택)
        */
    }
}
```

### 3.3 main 쓰레드

```java
public class MainThreadExample {
    public static void main(String[] args) {
        Thread mainThread = Thread.currentThread();
        System.out.println("현재 쓰레드: " + mainThread.getName());  // main

        Thread t = new Thread(() -> {
            try {
                Thread.sleep(3000);  // 3초 대기
                System.out.println("자식 쓰레드 종료");
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        });
        t.start();

        System.out.println("main 메서드 종료");
        // main 메서드가 끝나도 다른 쓰레드가 실행 중이면 프로그램은 종료되지 않음
    }
}
```

{{< callout type="info" >}}
**프로그램 종료 조건:** 실행 중인 **사용자 쓰레드**가 하나도 없을 때 프로그램이 종료된다. 데몬 쓰레드는 포함되지 않는다.
{{< /callout >}}

---

## 4. 싱글쓰레드와 멀티쓰레드

### 4.1 성능 비교

```java
public class SingleVsMulti {
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();

        // 싱글 쓰레드: 순차 실행
        for (int i = 0; i < 300; i++) {
            System.out.print("-");
        }
        for (int i = 0; i < 300; i++) {
            System.out.print("|");
        }

        long singleTime = System.currentTimeMillis() - startTime;
        System.out.println("\n싱글 쓰레드 소요시간: " + singleTime + "ms");

        // 멀티 쓰레드: 동시 실행
        startTime = System.currentTimeMillis();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 300; i++) {
                System.out.print("-");
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 300; i++) {
                System.out.print("|");
            }
        });

        t1.start();
        t2.start();

        try {
            t1.join();  // t1 종료 대기
            t2.join();  // t2 종료 대기
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        long multiTime = System.currentTimeMillis() - startTime;
        System.out.println("\n멀티 쓰레드 소요시간: " + multiTime + "ms");
    }
}
```

### 4.2 컨텍스트 스위칭

```
CPU 시간 분배 (싱글 코어 기준)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쓰레드1: ████████        ████████        ████████
쓰레드2:         ████████        ████████
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ↑컨텍스트 스위칭  ↑컨텍스트 스위칭

저장/복원되는 정보:
- 프로그램 카운터(PC): 다음 실행할 명령어 위치
- 레지스터 값들
- 스택 포인터
```

### 4.3 언제 멀티쓰레드가 유리한가?

| 상황 | 권장 |
|:-----|:-----|
| CPU 연산만 수행 (싱글 코어) | 싱글 쓰레드 |
| CPU 연산만 수행 (멀티 코어) | 멀티 쓰레드 |
| I/O 작업(파일, 네트워크) 포함 | 멀티 쓰레드 |
| 사용자 입력 대기 필요 | 멀티 쓰레드 |

```java
// 멀티쓰레드가 효과적인 예: I/O 대기 시간 활용
public class IOExample {
    public static void main(String[] args) {
        // 사용자 입력을 받는 동안 다른 작업 수행
        Thread inputThread = new Thread(() -> {
            Scanner sc = new Scanner(System.in);
            System.out.print("입력: ");
            String input = sc.nextLine();
            System.out.println("입력값: " + input);
        });

        Thread workThread = new Thread(() -> {
            for (int i = 10; i > 0; i--) {
                System.out.println("카운트다운: " + i);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {}
            }
        });

        inputThread.start();
        workThread.start();
        // 입력을 기다리는 동안 카운트다운이 진행됨
    }
}
```

{{< callout type="info" >}}
**병행 vs 병렬:**
- **병행(Concurrent):** 여러 쓰레드가 번갈아가며 작업 (싱글 코어)
- **병렬(Parallel):** 여러 쓰레드가 동시에 작업 (멀티 코어)
{{< /callout >}}

---

## 5. 쓰레드의 우선순위

### 5.1 우선순위 설정

```java
void setPriority(int newPriority)  // 우선순위 설정 (1~10)
int getPriority()                   // 우선순위 반환

// 상수
Thread.MIN_PRIORITY   = 1
Thread.NORM_PRIORITY  = 5  (기본값)
Thread.MAX_PRIORITY   = 10
```

### 5.2 예제

```java
public class PriorityExample {
    public static void main(String[] args) {
        Thread high = new Thread(() -> {
            for (int i = 0; i < 1000; i++) {
                System.out.print("H");
            }
        }, "HighPriority");

        Thread low = new Thread(() -> {
            for (int i = 0; i < 1000; i++) {
                System.out.print("L");
            }
        }, "LowPriority");

        // 우선순위는 start() 전에 설정해야 함
        high.setPriority(Thread.MAX_PRIORITY);  // 10
        low.setPriority(Thread.MIN_PRIORITY);   // 1

        high.start();
        low.start();
    }
}
```

{{< callout type="warning" >}}
**주의:** 우선순위는 OS의 스케줄러에 대한 **힌트**일 뿐이다. 멀티코어 환경에서는 우선순위 차이가 크게 나타나지 않을 수 있다. 확실한 순서 보장이 필요하면 동기화 기법을 사용해야 한다.
{{< /callout >}}

### 5.3 대안: PriorityQueue 활용

```java
import java.util.PriorityQueue;

class Task implements Comparable<Task> {
    private int priority;
    private String name;

    public Task(int priority, String name) {
        this.priority = priority;
        this.name = name;
    }

    @Override
    public int compareTo(Task other) {
        return Integer.compare(other.priority, this.priority);  // 높은 우선순위 먼저
    }

    public void execute() {
        System.out.println(name + " 실행 (우선순위: " + priority + ")");
    }
}

// 사용
PriorityQueue<Task> queue = new PriorityQueue<>();
queue.add(new Task(3, "낮은 우선순위 작업"));
queue.add(new Task(10, "높은 우선순위 작업"));
queue.add(new Task(5, "중간 우선순위 작업"));

while (!queue.isEmpty()) {
    queue.poll().execute();
}
// 출력: 높은 → 중간 → 낮은 순서
```

---

## 6. 쓰레드 그룹 (Thread Group)

### 6.1 개념

쓰레드 그룹은 관련된 쓰레드들을 묶어서 관리하기 위한 것이다.

```
JVM 쓰레드 그룹 구조:
┌─────────────────────────────────────────┐
│               system 그룹               │
│  ┌───────────────────────────────────┐  │
│  │           main 그룹               │  │
│  │  ┌─────────┐  ┌───────────────┐  │  │
│  │  │ main    │  │ 사용자정의그룹 │  │  │
│  │  │ 쓰레드  │  │   - 쓰레드1   │  │  │
│  │  └─────────┘  │   - 쓰레드2   │  │  │
│  │               └───────────────┘  │  │
│  └───────────────────────────────────┘  │
│  GC 쓰레드, Finalizer 쓰레드 등         │
└─────────────────────────────────────────┘
```

### 6.2 사용 예제

```java
public class ThreadGroupExample {
    public static void main(String[] args) {
        // 현재 쓰레드의 그룹 확인
        ThreadGroup mainGroup = Thread.currentThread().getThreadGroup();
        System.out.println("현재 그룹: " + mainGroup.getName());  // main

        // 새 쓰레드 그룹 생성
        ThreadGroup myGroup = new ThreadGroup("MyGroup");
        myGroup.setMaxPriority(7);  // 그룹의 최대 우선순위 설정

        // 그룹에 속한 쓰레드 생성
        Thread t1 = new Thread(myGroup, () -> {
            try {
                Thread.sleep(5000);
            } catch (InterruptedException e) {}
        }, "Thread-1");

        Thread t2 = new Thread(myGroup, () -> {
            try {
                Thread.sleep(5000);
            } catch (InterruptedException e) {}
        }, "Thread-2");

        t1.start();
        t2.start();

        // 그룹 정보 출력
        System.out.println("활성 쓰레드 수: " + myGroup.activeCount());
        myGroup.list();  // 그룹 내 쓰레드 목록 출력

        // 그룹 내 모든 쓰레드 인터럽트
        myGroup.interrupt();
    }
}
```

{{< callout type="info" >}}
쓰레드 그룹을 지정하지 않으면 자동으로 **생성한 쓰레드와 같은 그룹**에 속한다. main 메서드에서 생성한 쓰레드는 main 그룹에 속한다.
{{< /callout >}}

---

## 7. 데몬 쓰레드 (Daemon Thread)

### 7.1 개념

데몬 쓰레드는 일반 쓰레드(사용자 쓰레드)의 보조 역할을 수행하는 쓰레드다.

| 구분 | 사용자 쓰레드 | 데몬 쓰레드 |
|:-----|:-------------|:-----------|
| 역할 | 주요 작업 수행 | 보조 작업 (GC, 자동저장 등) |
| 종료 조건 | run() 완료 | 모든 사용자 쓰레드 종료 시 자동 종료 |
| 예시 | main, 사용자 생성 쓰레드 | GC, 화면 갱신, 자동 저장 |

### 7.2 사용 방법

```java
public class DaemonExample {
    public static void main(String[] args) {
        Thread daemon = new Thread(() -> {
            while (true) {
                System.out.println("데몬 쓰레드 실행 중...");
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    break;
                }
            }
        });

        // start() 전에 setDaemon(true) 호출
        daemon.setDaemon(true);
        daemon.start();

        System.out.println("isDaemon: " + daemon.isDaemon());  // true

        try {
            Thread.sleep(3000);  // 3초 후
        } catch (InterruptedException e) {}

        System.out.println("main 종료");
        // main 종료 시 데몬 쓰레드도 자동 종료
    }
}
```

### 7.3 자동 저장 예제

```java
public class AutoSaveThread extends Thread {
    private boolean running = true;

    public AutoSaveThread() {
        setDaemon(true);  // 데몬 쓰레드로 설정
        setName("AutoSaveThread");
    }

    @Override
    public void run() {
        while (running) {
            try {
                Thread.sleep(30000);  // 30초마다
                autoSave();
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    private void autoSave() {
        System.out.println(LocalDateTime.now() + " - 자동 저장 완료");
    }

    public void stopSaving() {
        running = false;
        interrupt();
    }
}

// 사용
AutoSaveThread autoSave = new AutoSaveThread();
autoSave.start();
// 메인 프로그램 종료 시 자동으로 함께 종료됨
```

{{< callout type="warning" >}}
**setDaemon()은 start() 전에 호출해야 한다.** 이미 실행 중인 쓰레드에 호출하면 `IllegalThreadStateException`이 발생한다.
{{< /callout >}}

---

## 8. 쓰레드의 실행 제어

### 8.1 쓰레드의 상태

```java
Thread.State getState()  // 쓰레드 상태 반환
```

| 상태 | 설명 |
|:-----|:-----|
| NEW | 쓰레드 생성됨, start() 호출 전 |
| RUNNABLE | 실행 중 또는 실행 대기 |
| BLOCKED | 동기화 블록 진입 대기 (lock 대기) |
| WAITING | wait(), join() 등으로 무기한 대기 |
| TIMED_WAITING | sleep(), wait(시간) 등으로 제한 시간 대기 |
| TERMINATED | 실행 완료 |

```
쓰레드 생명주기:
                         ┌─────────────────┐
                         │    RUNNABLE     │
                    ┌───→│ (실행/실행대기)  │←──┐
    start()         │    └────────┬────────┘   │
┌─────────┐   ┌────┴────┐        │            │
│   NEW   │──→│ 실행대기 │        │ yield()   │ notify()
└─────────┘   └─────────┘        │ 시간만료   │ interrupt()
                                  ↓            │
                         ┌─────────────────┐   │
                         │ WAITING/BLOCKED │───┘
                         │ TIMED_WAITING   │
                         └────────┬────────┘
                                  │ run() 종료
                                  ↓
                         ┌─────────────────┐
                         │   TERMINATED    │
                         └─────────────────┘
```

### 8.2 주요 메서드

#### sleep() - 일정 시간 대기

```java
static void sleep(long millis)
static void sleep(long millis, int nanos)
```

```java
public class SleepExample {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            for (int i = 5; i > 0; i--) {
                System.out.println("카운트: " + i);
                try {
                    Thread.sleep(1000);  // 1초 대기
                } catch (InterruptedException e) {
                    System.out.println("인터럽트됨!");
                    return;
                }
            }
            System.out.println("완료!");
        });

        t.start();
    }
}
```

{{< callout type="warning" >}}
**sleep()은 static 메서드다!** `t.sleep(1000)`으로 호출해도 t가 아닌 **현재 실행 중인 쓰레드**가 잠든다.
```java
Thread t = new Thread(() -> { ... });
t.start();
t.sleep(1000);  // t가 아닌 main 쓰레드가 잠듦!
```
{{< /callout >}}

#### interrupt() - 작업 취소 요청

```java
void interrupt()              // interrupted 상태를 true로 변경
boolean isInterrupted()       // interrupted 상태 반환
static boolean interrupted()  // 현재 쓰레드의 interrupted 상태 반환 후 false로 초기화
```

```java
public class InterruptExample {
    public static void main(String[] args) {
        Thread download = new Thread(() -> {
            try {
                for (int i = 0; i < 100; i++) {
                    System.out.println("다운로드 중: " + i + "%");
                    Thread.sleep(100);
                }
            } catch (InterruptedException e) {
                System.out.println("다운로드 취소됨!");
                return;
            }
            System.out.println("다운로드 완료!");
        });

        download.start();

        try {
            Thread.sleep(500);  // 0.5초 후 취소
        } catch (InterruptedException e) {}

        download.interrupt();  // 다운로드 취소 요청
    }
}
```

```java
// sleep 없이 interrupt 확인
public class InterruptCheck {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            int count = 0;
            while (!Thread.currentThread().isInterrupted()) {
                count++;
                // 작업 수행
            }
            System.out.println("작업 종료, count: " + count);
        });

        t.start();

        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {}

        t.interrupt();  // interrupted 상태를 true로
    }
}
```

#### join() - 다른 쓰레드 대기

```java
void join()                     // 해당 쓰레드 종료까지 대기
void join(long millis)          // 최대 millis ms 대기
void join(long millis, int nanos)
```

```java
public class JoinExample {
    public static void main(String[] args) {
        Thread calc = new Thread(() -> {
            int sum = 0;
            for (int i = 1; i <= 100; i++) {
                sum += i;
            }
            System.out.println("계산 결과: " + sum);
        });

        calc.start();

        try {
            calc.join();  // calc 쓰레드 종료까지 대기
        } catch (InterruptedException e) {}

        System.out.println("계산 완료 후 실행됨");
    }
}
```

```java
// 타임아웃과 함께 사용
Thread t = new Thread(() -> {
    try {
        Thread.sleep(10000);  // 10초 작업
    } catch (InterruptedException e) {}
});

t.start();

try {
    t.join(3000);  // 최대 3초만 대기
} catch (InterruptedException e) {}

if (t.isAlive()) {
    System.out.println("작업이 아직 진행 중, 타임아웃됨");
    t.interrupt();
} else {
    System.out.println("작업 완료");
}
```

#### yield() - 실행 양보

```java
static void yield()  // 다른 쓰레드에게 실행 기회 양보
```

```java
public class YieldExample {
    private volatile boolean suspended = false;
    private volatile boolean stopped = false;

    public void run() {
        while (!stopped) {
            if (suspended) {
                Thread.yield();  // 일시정지 상태면 양보
                continue;
            }
            // 작업 수행
            System.out.println("작업 중...");
        }
    }

    public void suspend() { suspended = true; }
    public void resume() { suspended = false; }
    public void stop() { stopped = true; }
}
```

{{< callout type="info" >}}
**yield()는 힌트일 뿐이다.** OS 스케줄러가 이 요청을 무시할 수 있다. 확실한 제어가 필요하면 wait/notify를 사용하자.
{{< /callout >}}

### 8.3 deprecated된 메서드들

`suspend()`, `resume()`, `stop()`은 교착상태를 유발할 수 있어 deprecated되었다.

```java
// 권장하지 않음 (deprecated)
t.suspend();
t.resume();
t.stop();

// 대안: 플래그 사용
class SafeThread extends Thread {
    private volatile boolean running = true;
    private volatile boolean suspended = false;

    @Override
    public void run() {
        while (running) {
            if (suspended) {
                Thread.yield();
                continue;
            }
            // 작업 수행
        }
    }

    public void suspendThread() { suspended = true; }
    public void resumeThread() { suspended = false; }
    public void stopThread() { running = false; }
}
```

---

## 9. 쓰레드의 동기화

### 9.1 동기화의 필요성

```java
// 동기화 없이 공유 자원 접근 시 문제 발생
class Counter {
    private int count = 0;

    public void increment() {
        count++;  // 이 연산은 원자적이지 않음!
        // 1. count 읽기
        // 2. count + 1 계산
        // 3. 결과 저장
    }

    public int getCount() {
        return count;
    }
}

public class RaceCondition {
    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) {
                counter.increment();
            }
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) {
                counter.increment();
            }
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();

        System.out.println("예상: 20000, 실제: " + counter.getCount());
        // 실제 값은 20000보다 작을 수 있음!
    }
}
```

### 9.2 synchronized 키워드

#### 메서드 동기화

```java
class SyncCounter {
    private int count = 0;

    // 메서드 전체를 임계 영역으로 설정
    public synchronized void increment() {
        count++;
    }

    public synchronized int getCount() {
        return count;
    }
}
```

#### 블록 동기화

```java
class SyncCounter {
    private int count = 0;
    private final Object lock = new Object();

    public void increment() {
        // 필요한 부분만 동기화 (더 효율적)
        synchronized (lock) {
            count++;
        }
    }

    // this를 락으로 사용할 수도 있음
    public void increment2() {
        synchronized (this) {
            count++;
        }
    }
}
```

### 9.3 동기화 예제: 은행 계좌

```java
class BankAccount {
    private int balance;

    public BankAccount(int balance) {
        this.balance = balance;
    }

    public synchronized void withdraw(int amount) {
        if (balance >= amount) {
            try {
                Thread.sleep(1);  // 처리 시간 시뮬레이션
            } catch (InterruptedException e) {}
            balance -= amount;
            System.out.println("출금: " + amount + ", 잔액: " + balance);
        } else {
            System.out.println("잔액 부족! 요청: " + amount + ", 잔액: " + balance);
        }
    }

    public synchronized void deposit(int amount) {
        balance += amount;
        System.out.println("입금: " + amount + ", 잔액: " + balance);
    }

    public synchronized int getBalance() {
        return balance;
    }
}

public class BankExample {
    public static void main(String[] args) throws InterruptedException {
        BankAccount account = new BankAccount(1000);

        Thread withdraw = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                account.withdraw(300);
            }
        });

        Thread deposit = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                account.deposit(200);
            }
        });

        withdraw.start();
        deposit.start();
        withdraw.join();
        deposit.join();

        System.out.println("최종 잔액: " + account.getBalance());
    }
}
```

### 9.4 wait()과 notify()

특정 조건이 충족될 때까지 대기하고, 조건이 충족되면 알림을 받는 방식이다.

```java
// Object 클래스의 메서드
void wait()                 // 락을 반납하고 대기
void wait(long timeout)     // 최대 timeout ms 대기
void notify()               // 대기 중인 쓰레드 하나를 깨움
void notifyAll()            // 대기 중인 모든 쓰레드를 깨움
```

```java
class SharedBuffer {
    private int data;
    private boolean hasData = false;

    public synchronized void produce(int value) {
        while (hasData) {
            try {
                wait();  // 데이터가 소비될 때까지 대기
            } catch (InterruptedException e) {}
        }
        data = value;
        hasData = true;
        System.out.println("생산: " + value);
        notify();  // 소비자에게 알림
    }

    public synchronized int consume() {
        while (!hasData) {
            try {
                wait();  // 데이터가 생산될 때까지 대기
            } catch (InterruptedException e) {}
        }
        hasData = false;
        System.out.println("소비: " + data);
        notify();  // 생산자에게 알림
        return data;
    }
}

public class ProducerConsumer {
    public static void main(String[] args) {
        SharedBuffer buffer = new SharedBuffer();

        Thread producer = new Thread(() -> {
            for (int i = 1; i <= 5; i++) {
                buffer.produce(i);
            }
        });

        Thread consumer = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                buffer.consume();
            }
        });

        producer.start();
        consumer.start();
    }
}
```

{{< callout type="warning" >}}
**wait()과 notify()는 synchronized 블록 안에서만 사용 가능하다.** 그렇지 않으면 `IllegalMonitorStateException`이 발생한다.
{{< /callout >}}

### 9.5 기아 현상과 경쟁 상태

```java
// 기아 현상(Starvation): 특정 쓰레드가 락을 계속 얻지 못함
// 해결: notify() 대신 notifyAll() 사용

// 경쟁 상태(Race Condition): 여러 쓰레드가 락을 얻으려 경쟁
// 해결: Lock과 Condition으로 쓰레드 구분
```

---

## 10. Lock과 Condition

### 10.1 ReentrantLock

`synchronized`보다 유연한 동기화 제어가 가능하다.

```java
import java.util.concurrent.locks.ReentrantLock;

class Counter {
    private int count = 0;
    private final ReentrantLock lock = new ReentrantLock();

    public void increment() {
        lock.lock();  // 락 획득
        try {
            count++;
        } finally {
            lock.unlock();  // 반드시 해제! (finally에서)
        }
    }

    public int getCount() {
        lock.lock();
        try {
            return count;
        } finally {
            lock.unlock();
        }
    }
}
```

### 10.2 tryLock - 락 획득 시도

```java
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.TimeUnit;

ReentrantLock lock = new ReentrantLock();

// 즉시 반환 (블로킹 없음)
if (lock.tryLock()) {
    try {
        // 임계 영역
    } finally {
        lock.unlock();
    }
} else {
    System.out.println("락을 얻지 못함, 다른 작업 수행");
}

// 타임아웃과 함께
try {
    if (lock.tryLock(1, TimeUnit.SECONDS)) {
        try {
            // 임계 영역
        } finally {
            lock.unlock();
        }
    }
} catch (InterruptedException e) {
    // 대기 중 인터럽트됨
}
```

### 10.3 Condition - 조건별 대기

```java
import java.util.concurrent.locks.*;
import java.util.LinkedList;
import java.util.Queue;

class BoundedBuffer<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;

    private final Lock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();   // 생산자용
    private final Condition notEmpty = lock.newCondition();  // 소비자용

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (queue.size() == capacity) {
                notFull.await();  // 버퍼가 가득 차면 대기
            }
            queue.add(item);
            System.out.println("생산: " + item);
            notEmpty.signal();  // 소비자에게 알림
        } finally {
            lock.unlock();
        }
    }

    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await();  // 버퍼가 비면 대기
            }
            T item = queue.poll();
            System.out.println("소비: " + item);
            notFull.signal();  // 생산자에게 알림
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

### 10.4 Lock 클래스 비교

| Lock | 특징 |
|:-----|:-----|
| ReentrantLock | 가장 일반적인 배타적 락 |
| ReentrantReadWriteLock | 읽기는 공유, 쓰기는 배타적 |
| StampedLock | 낙관적 읽기 지원 (Java 8+) |

```java
import java.util.concurrent.locks.ReentrantReadWriteLock;

class ReadWriteCounter {
    private int count = 0;
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    public void increment() {
        rwLock.writeLock().lock();
        try {
            count++;
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public int getCount() {
        rwLock.readLock().lock();
        try {
            return count;  // 여러 쓰레드가 동시에 읽기 가능
        } finally {
            rwLock.readLock().unlock();
        }
    }
}
```

---

## 11. Fork/Join 프레임워크

### 11.1 개념

Java 7에 추가된 Fork/Join은 작업을 작은 단위로 나누어(fork) 병렬 처리하고 결과를 합치는(join) 프레임워크다.

```
                    [큰 작업]
                        │
            ┌───────────┼───────────┐
            ↓           ↓           ↓
        [작업1]     [작업2]     [작업3]
            ↓           ↓           ↓
        [결과1]     [결과2]     [결과3]
            └───────────┼───────────┘
                        ↓
                   [최종 결과]
```

### 11.2 RecursiveTask vs RecursiveAction

| 클래스 | 반환값 | 용도 |
|:-------|:-------|:-----|
| RecursiveTask\<V\> | 있음 | 합계, 개수 등 결과가 필요한 작업 |
| RecursiveAction | 없음 | 정렬, 변환 등 부작용만 있는 작업 |

### 11.3 예제: 배열 합계

```java
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.RecursiveTask;

class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 1000;  // 분할 기준
    private final long[] array;
    private final int start, end;

    public SumTask(long[] array, int start, int end) {
        this.array = array;
        this.start = start;
        this.end = end;
    }

    @Override
    protected Long compute() {
        int size = end - start;

        // 작업이 충분히 작으면 직접 계산
        if (size <= THRESHOLD) {
            long sum = 0;
            for (int i = start; i < end; i++) {
                sum += array[i];
            }
            return sum;
        }

        // 작업을 반으로 나눔
        int mid = start + size / 2;
        SumTask left = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);

        left.fork();  // 비동기로 왼쪽 작업 실행
        Long rightResult = right.compute();  // 오른쪽은 직접 계산
        Long leftResult = left.join();  // 왼쪽 결과 대기

        return leftResult + rightResult;
    }
}

public class ForkJoinExample {
    public static void main(String[] args) {
        long[] array = new long[10_000_000];
        for (int i = 0; i < array.length; i++) {
            array[i] = i + 1;
        }

        ForkJoinPool pool = ForkJoinPool.commonPool();
        SumTask task = new SumTask(array, 0, array.length);

        long start = System.currentTimeMillis();
        long result = pool.invoke(task);
        long end = System.currentTimeMillis();

        System.out.println("합계: " + result);
        System.out.println("소요시간: " + (end - start) + "ms");
    }
}
```

### 11.4 작업 훔치기 (Work Stealing)

```
쓰레드1 작업 큐: [A1][A2][A3][A4]
쓰레드2 작업 큐: []  ← 비어있음

작업 훔치기 발생:
쓰레드1 작업 큐: [A1][A2][A3]
쓰레드2 작업 큐: [A4]  ← 훔쳐옴

→ 쓰레드 간 작업 부하를 자동으로 분배
```

### 11.5 fork()와 join() 비교

| 메서드 | 특성 | 설명 |
|:-------|:-----|:-----|
| fork() | 비동기 | 작업을 큐에 넣고 즉시 반환 |
| join() | 동기 | 작업 완료까지 대기 후 결과 반환 |

---

## 12. 실전 예제

### 12.1 쓰레드 풀 (ExecutorService)

```java
import java.util.concurrent.*;

public class ThreadPoolExample {
    public static void main(String[] args) {
        // 고정 크기 쓰레드 풀 생성
        ExecutorService executor = Executors.newFixedThreadPool(4);

        // 작업 제출
        for (int i = 0; i < 10; i++) {
            final int taskId = i;
            executor.submit(() -> {
                System.out.println("Task " + taskId + " - " +
                    Thread.currentThread().getName());
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {}
            });
        }

        // 종료
        executor.shutdown();
        try {
            executor.awaitTermination(60, TimeUnit.SECONDS);
        } catch (InterruptedException e) {}
    }
}
```

### 12.2 Callable과 Future

```java
import java.util.concurrent.*;

public class CallableExample {
    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();

        // Callable: 결과를 반환하는 작업
        Callable<Integer> task = () -> {
            Thread.sleep(2000);
            return 42;
        };

        Future<Integer> future = executor.submit(task);

        System.out.println("작업 제출 완료");

        // 결과 대기 (블로킹)
        Integer result = future.get();  // 또는 get(timeout, unit)
        System.out.println("결과: " + result);

        executor.shutdown();
    }
}
```

### 12.3 CompletableFuture (Java 8+)

```java
import java.util.concurrent.CompletableFuture;

public class CompletableFutureExample {
    public static void main(String[] args) {
        CompletableFuture<String> future = CompletableFuture
            .supplyAsync(() -> {
                // 비동기 작업
                try { Thread.sleep(1000); } catch (Exception e) {}
                return "Hello";
            })
            .thenApply(s -> s + " World")  // 결과 변환
            .thenApply(String::toUpperCase);

        // 비블로킹 콜백
        future.thenAccept(System.out::println);

        // 또는 블로킹 대기
        // String result = future.get();

        // 메인 쓰레드가 먼저 끝나지 않도록
        try { Thread.sleep(2000); } catch (Exception e) {}
    }
}
```

---

## 13. 요약

### 주요 개념

| 개념 | 설명 |
|:-----|:-----|
| 쓰레드 | 프로세스 내 실행 흐름 단위 |
| start() vs run() | start()는 새 호출 스택 생성, run()은 현재 스택에서 실행 |
| 동기화 | 공유 자원의 일관성 보장 |
| 데몬 쓰레드 | 사용자 쓰레드 종료 시 함께 종료 |

### 동기화 방법 비교

| 방법 | 특징 |
|:-----|:-----|
| synchronized | 간단, 자동 락 해제 |
| ReentrantLock | tryLock, 공정성 옵션 |
| Condition | 조건별 wait/notify |

### 쓰레드 상태 메서드

| 메서드 | 설명 |
|:-------|:-----|
| sleep(ms) | 지정 시간 대기 |
| join() | 다른 쓰레드 종료 대기 |
| interrupt() | 인터럽트 요청 |
| yield() | 실행 양보 |
| wait()/notify() | 조건 대기/알림 |

{{< callout type="info" >}}
**핵심 포인트:**
- 쓰레드는 자원을 공유하므로 동기화가 필수
- synchronized로 임계 영역 최소화
- wait()/notify()는 synchronized 블록 내에서만 사용
- Lock/Condition으로 더 세밀한 제어 가능
- ExecutorService로 쓰레드 풀 관리 권장
{{< /callout >}}
