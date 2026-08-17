# WORK-20260817-m1-battle-prototype: M1 전투 프로토타입 작업 기록

> 문서 유형: `work-log`, `verification`, `completion`
> 작업 ID: `20260817-m1-battle-prototype`
> 상태: `in-progress`
> 기준선: `v1` (2026-08-17 승인)
> 작성일: 2026-08-17
> 최종 갱신: 2026-08-17
> 관련 문서: [PLAN-ygj-remake: 구현 계획](../../plan.md), [REQ-ygj-remake: 요구사항](../../requirements.md), [DESIGN-ygj-remake: 설계](../../design.md), [WORK-20260817-m0-skeleton: M0 기록](../20260817-m0-skeleton/work-log.md)

## 요약

- 목적: 기준선 v1의 M1 범위(전투 프로토타입 — 이동·공격·상성·턴 교대·1단계 AI·승패 판정)를 구현하고 [AC-02](../../requirements.md#인수-조건)를 증거와 함께 충족한다.
- 현재 결론 또는 상태: **계획 수립 완료, 구현 미착수.** TASK-10~20이 [PLAN](../../plan.md#m1-사이클-진행-중)에 정의되어 있고 작업 트리가 동기화되었다. 코드 변경은 아직 없다.
- 다음 행동: TASK-10(결정론적 RNG)부터 TDD로 구현한다.

## 문서 연결

| 방향 | 관계 | 대상 문서 | 대상 항목 | 비고 |
|---|---|---|---|---|
| input | baseline | [REQ-ygj-remake: 요구사항](../../requirements.md) | FR-02, FR-03, FR-11, FR-18, NFR-01, NFR-06, AC-02, AC-04 | 승인된 입력 기준선 |
| input | baseline | [DESIGN-ygj-remake: 설계](../../design.md) | DES-01, DES-04, DES-05, DES-06 | 구현 대상 설계 요소 |
| input | decision | [ADR-003: 결정론적 RNG와 세이브 포함 정책](../20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md) | document | TASK-10의 근거 |
| input | implementation | [PLAN-ygj-remake: 구현 계획](../../plan.md) | TASK-10~20, VER-05~08 | 이 기록이 수행하는 계획 |
| input | result | [WORK-20260817-m0-skeleton: M0 기록](../20260817-m0-skeleton/work-log.md) | 후속 작업 | M1에서 확정할 미결 사항의 출처 |

## 기준선과 현재 계획

- 기준선: [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, ADR-001~006([결정 등록부](../../decisions.md)).
- 현재 계획: [PLAN-ygj-remake](../../plan.md)의 M1 사이클 TASK-10~20.
- 작업 ID 발행 근거: M0와 같다 — 마일스톤 단위로 계획·검증·완료되는 구현 사이클이므로 wf-implement가 `20260817-m1-battle-prototype`을 발행했다. 기준선의 의미는 바뀌지 않았다.

## 현재 상태

- 진행 중인 작업: 없음(계획 수립까지 완료)
- 마지막 완료 작업: M1 계획 수립 및 계획 트리 생성
- 차단 요인: 없음

## 수행 기록

### 2026-08-17 — M1 계획 수립

- 수행 내용: 기준선의 M1 범위를 작업 11건(TASK-10~20)과 검증 4건(VER-05~08)으로 분해하고 [PLAN](../../plan.md)에 기록했다. 의존 관계를 포함한 계획 트리를 생성했다.
- 변경 파일: `docs/plan.md`, 본 기록
- 발견 사항: M1 구현에 앞서 기준선이 명시하지 않아 이 사이클에서 결정해야 할 항목이 세 가지 있다.
  - **병력(HP) 상한 산출 규칙**: [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)은 레벨업 시 `growth.hpPerLevel`만큼 상한이 오른다고만 규정하고 초기 병력 산출식을 정하지 않았다. 데미지 공식과 격파 판정에 필요하므로 TASK-12에서 결정하고 근거를 남긴다. `OfficerSchema`의 `growth`에 기준값을 추가하는 방향이 유력하다(설계가 "스키마는 코드가 원본"이라고 규정하므로 확장은 승인 범위 안이다).
  - **이동 제약의 우선순위**: `terrain.moveCost`(계열별 코스트, [상세 스펙 §1.2](../../../yeonggeoljeon-remake-spec-detail.md))와 `classes.movementRules`([전체 설계 §4.1](../../../yeonggeoljeon-remake-design.md))가 같은 제약을 이중으로 표현할 수 있다. M0 시드에서는 두 값을 일치시켜 두었고, 어느 쪽이 우선하는지는 TASK-13에서 확정한다.
  - **상성 배수 방향**: M0에서 문서 우선순위 규칙에 따라 "유리 0.75"(상세 스펙 §1.3)를 채택했다. TASK-14에서 테스트로 고정한다.
- 결정과 이유: 테스트 작업을 별도 TASK로 분리하지 않고 각 작업의 검증 방법에 선행 테스트(Red 시작점)를 명시했다. M1은 작업 수가 11건이라 테스트 노드를 따로 두면 트리가 22건으로 불어나 가독성이 떨어진다. TDD 순서 자체는 [wf-implement §3.3](../../plan.md)대로 지킨다.
- 실행한 검증: 없음(계획 단계 — 코드 변경 없음).
- 결과: 계획 수립 완료.

## 설계와 달라진 점

- 없음(아직 구현 전).

## 미완료 항목

- TASK-10~20 전부. 검증 VER-05~08 전부.

## 재개 지점

- 다음 작업: TASK-10 결정론적 RNG
- 먼저 확인할 사항:
  1. [PLAN의 M1 사이클](../../plan.md#m1-사이클-진행-중) — 작업별 목표·검증 방법·의존성
  2. 위 [수행 기록](#2026-08-17--m1-계획-수립)의 미결 항목 3건(병력 상한식, 이동 제약 우선순위, 상성 방향) — 해당 TASK에서 결정하고 근거를 남긴다
  3. [M0 기록의 후속 작업](../20260817-m0-skeleton/work-log.md#후속-작업)
- 필요한 명령 또는 파일: PowerShell에서 `$env:Path += ";$env:LOCALAPPDATA\Programs\nodejs"` 후 `npm test` / `npm run validate` / `npm run dev` / `npm run build`. 사용자가 새로 여는 터미널에는 사용자 PATH가 이미 적용되어 있다.

## 인계

- 다음 단계 또는 워크플로우: wf-implement 계속 — M1 사이클 TASK-10부터 구현
- 시작 조건: 충족 — 기준선 v1 승인, M0 완료(원격 `498d4c3`까지 push됨), M1 계획 수립 완료
- 입력 문서와 기준선: [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, [PLAN-ygj-remake](../../plan.md), [결정 등록부](../../decisions.md)
- 완료된 항목: M1 계획 수립, 계획 트리 생성
- 미완료 항목: TASK-10~20 구현, VER-05~08 검증
- 차단 요인: 없음
- 다음 행동: TASK-10(결정론적 RNG)을 선행 테스트(같은 시드→같은 수열, 상태 저장·복원 왕복, `range` 경계)부터 작성해 Red를 확인한 뒤 구현한다
- 재개 프롬프트: 작업 20260817-m1-battle-prototype 재개 — docs/work/20260817-m1-battle-prototype/work-log.md의 인계 절을 읽고 "다음 행동"부터 진행하라.
