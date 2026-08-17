# WORK-20260818-m2-battle-complete: M2 전투 완성 작업 기록

> 문서 유형: `work-log`
> 작업 ID: `20260818-m2-battle-complete`
> 상태: `in-progress`
> 기준선: `v1` (2026-08-17 승인)
> 작성일: 2026-08-18
> 최종 갱신: 2026-08-18
> 관련 문서: [PLAN-ygj-remake: 구현 계획](../../plan.md), [REQ-ygj-remake: 요구사항](../../requirements.md), [DESIGN-ygj-remake: 설계](../../design.md), [결정 등록부](../../decisions.md), [WORK-20260817-m1-battle-prototype: 작업 기록](../20260817-m1-battle-prototype/work-log.md)

## 요약

- 목적: M2(전투 완성) 사이클의 수행 내용·결정·검증 증거를 남기고, 세션이 끊겨도 다음 세션이 대화 기록 없이 재개할 수 있게 한다.
- 현재 결론 또는 상태: **계획 수립 완료, 구현 미착수**. 작업 14건(TASK-21~34)과 검증 7건(VER-09~15)을 [PLAN](../../plan.md#m2-사이클-진행-중)에 정의하고 계획 트리를 재생성했다. 코드·데이터 변경은 아직 없다.
- 다음 행동: [TASK-21](../../plan.md#task-21-사기혼란과-턴-시작-처리)의 선행 테스트를 작성해 실패를 확인한 뒤 구현한다.

## 문서 연결

| 방향 | 관계 | 대상 문서 | 대상 항목 | 비고 |
|---|---|---|---|---|
| input | plan | [PLAN-ygj-remake: 구현 계획](../../plan.md) | TASK-21~34, VER-09~15 | 수행할 M2 사이클 계획 |
| input | baseline | [REQ-ygj-remake: 요구사항](../../requirements.md) | FR-04~09, FR-11, FR-13, FR-18, NFR-01·03·04·06, AC-01, AC-03, AC-04, AC-12 | 충족할 승인된 요구사항 |
| input | baseline | [DESIGN-ygj-remake: 설계](../../design.md) | DES-01, DES-03, DES-05, DES-06, DES-12, DES-13 | 구현할 설계 요소 |
| input | implementation | [WORK-20260817-m1-battle-prototype: 작업 기록](../20260817-m1-battle-prototype/work-log.md) | 후속 작업, 재개 지점 | M2가 이어받은 연결 지점과 코어 API 계약 |
| output | verification | 본 문서 | VER-09~15 | 검증 결과를 이 문서에 합쳐 기록한다(wf-implement §7) |

## 기준선과 현재 계획

- 기준선: [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, ADR-001~006([결정 등록부](../../decisions.md)). 규칙·수치의 정본은 [상세 스펙](../../../yeonggeoljeon-remake-spec-detail.md) §1.4~§1.7·§3·§5·§7이다.
- 현재 계획: [PLAN-ygj-remake](../../plan.md)의 M2 사이클 TASK-21~34.
- 작업 ID 발행 근거: M0·M1과 같다 — 마일스톤 단위로 계획·검증·완료되는 구현 사이클이므로 wf-implement가 `20260818-m2-battle-complete`를 발행했다. 기준선의 의미는 바뀌지 않았다.

## 현재 상태

- 진행 중인 작업: 없음 (계획 수립만 완료)
- 마지막 완료 작업: M2 계획 수립 (2026-08-18)
- 차단 요인: 없음

## 수행 기록

### 2026-08-18 — M2 계획 수립

- 수행 내용: [M2 착수 전 조사](../../plan.md#m2-착수-전-조사-2026-08-17-wf-implement-3132)와 [M1 후속 작업](../20260817-m1-battle-prototype/work-log.md#후속-작업)을 입력으로 M2 범위를 작업 14건(TASK-21~34)과 검증 7건(VER-09~15)으로 분해해 [PLAN](../../plan.md)에 기록했다. TASK를 처음 적는 같은 변경에서 계획 트리(ASCII·mermaid)를 재생성했다.
- 변경 파일: `docs/plan.md`, 본 기록
- 발견 사항:
  - **계획 직전 상태 재확인**(wf-implement §3.1): 작업 트리가 깨끗하고(`git status` 무변경) HEAD는 `59178fc`다. M1 이후 저장소가 바뀌지 않았으므로 기준선과 코드가 여전히 정합한다.
  - 현재 코드에서 M2가 확장할 지점을 확인했다 — `CombatConfig`는 상수 3종(`baseDamage`·`minDamage`·`damageJitter`)만 갖고, `Unit`에는 `mp`·`exp`·`items`·`confused`가 없으며, `turn.ts`에는 턴 시작 처리 자리가 아직 없다(주석으로 M2를 가리킨다). `ai.ts`는 1단계 최근접 접근이고 프로필 개념이 없다. `data/`에는 `tactics.json`·`items.json`이 없다.
  - 데이터 파일이 늘면 로더·validate CLI·브라우저 로드의 3경로(`loader.ts`·`scripts/readGameData.ts`·`browserData.ts`)를 모두 고쳐야 한다. TASK-23·TASK-25의 위험에 반영했다.
- 결정과 이유:
  - **기준선 반환 없이 계획을 확정했다.** M2 범위 전체가 승인된 기준선 v1(FR-04~09, FR-11, DES-01·DES-12·DES-13, AC-03·AC-12)에 이미 규정되어 있어 새 제품 결정이 필요하지 않다. 근거는 [M2 착수 전 조사](../../plan.md#m2-착수-전-조사-2026-08-17-wf-implement-3132)에 있다.
  - **반격과 병과 플래그 3종을 M2 범위에 넣었다**([TASK-27](../../plan.md#task-27-병과-플래그와-반격)). M1이 "플래그를 가진 병과 데이터가 들어오는 마일스톤에서 함께 구현"하기로 미뤘고, 그 데이터가 M2 원작 대조에서 들어온다. 기각한 대안은 M4까지 미루는 것 — 그러면 M2 완료 기준인 "규칙 누락 없이 재현"에 [FR-02](../../requirements.md#기능-요구사항)가 명시한 반격 예외가 빠진 채로 판정하게 된다.
  - **승패 조건 유형 확장을 범위 밖으로 두었다.** M1 스키마 주석은 "도달·생존 조건은 M2에서 유형을 늘린다"고 적었으나, [TASK-29](../../plan.md#task-29-전투-이벤트-dsl-인터프리터)의 `endBattle` 액션이 특수 승패를 이벤트로 표현하므로 원작 1장 수준에는 새 조건 유형이 필요하지 않다. 조건 유형을 늘리는 것은 새 데이터 계약이므로 필요성이 확인될 때 넣는다(최소 구현 원칙 1단계 YAGNI). 스키마 주석은 해당 작업에서 현재 판단에 맞게 고친다.
  - **이벤트 인터프리터를 `src/core/campaign/eventRunner.ts`에 둔다.** [상세 스펙 §3](../../../yeonggeoljeon-remake-spec-detail.md)과 [DES-02](../../design.md#컴포넌트와-책임)가 그 위치를 지정했다. M2는 `scope: "battle"`만 구현하고 `camp` 스코프는 M3에서 같은 파일에 붙인다 — 파일을 전투 쪽에 새로 만들었다가 M3에서 옮기면 설계와 어긋나고 이동 비용만 생긴다.
  - **AI 성능 테스트(VER-11)를 선행 테스트로 지정했다.** 2단계 AI는 후보 공간이 `이동 가능 타일 × 타깃`으로 커져 [AC-12](../../requirements.md#인수-조건)의 100ms를 넘길 위험이 실재한다([RISK-M2-04](../../plan.md#위험)). 구현 후 측정하면 설계까지 되돌려야 하므로 Red를 성능으로 잡는다.
  - **M1 축약표의 `상위` 열을 `의존`으로 고쳤다.** M1 작업은 모두 형제였고 분해가 없었으며 [완료 시점 트리 스냅숏](../20260817-m1-battle-prototype/work-log.md#계획-트리)이 같은 값을 `depends:`로 렌더했다. 스냅숏에 맞춘 열 이름 정정이며 기록된 관계·완료 판정은 바뀌지 않았다. M0 표의 `상위`는 실제 분해(선행 테스트가 구현 작업의 자식)이므로 그대로 두었다.
  - **계획 트리에서 작업별 `test`·`review` 자식을 펼치지 않는다.** wf-tree의 분기 템플릿 제안은 채택하되, 14개 작업 × 2자식이면 트리가 42노드가 되어 "지금 어디"가 보이지 않는다. 선행 테스트는 각 작업의 `검증 방법`에, 자체 리뷰는 TASK-34에 모았다. 생략이 아니라 표현 위치의 선택이다.
- 실행한 검증: 없음(계획 수립 단계). 상태 재확인으로 `git status`·`git log`와 `src/`·`data/`·`tests/` 파일 목록을 확인했다.
- 결과: [PLAN](../../plan.md)에 M2 사이클 절, 검증 계획 VER-09~15, 위험 RISK-M2-01~04이 추가되고 계획 트리가 M2 14개 노드를 포함하도록 재생성되었다. 구현은 아직 시작하지 않았다.

## 검증 범위와 환경

- 대상 기준선 또는 구현: [REQ-ygj-remake](../../requirements.md) v1 / [DESIGN-ygj-remake](../../design.md) v1의 M2 범위. 구현 미착수.
- 실행 환경: Windows 11, Node.js v24.19.0 / npm 11.17.0(사용자 영역 설치). 화면 확인은 `npm run dev` + Chrome 헤드리스 CDP 하네스([M1 재개 지점](../20260817-m1-battle-prototype/work-log.md#재개-지점) 7번).
- 제외 항목: 없음(계획 단계이므로 아직 실행한 검증이 없다).

## 결과 요약

- 성공: 없음 — 아직 검증을 실행하지 않았다.
- 실패: 없음
- 미수행: VER-09~15 전부. 대상 작업(TASK-21~34)이 미착수이기 때문이다.

## 인수 조건별 결과

| 검증 ID | 인수 조건 | 방법·명령 | 결과 | 증거 |
|---|---|---|---|---|
| VER-09 | [AC-03](../../requirements.md#인수-조건) | M2 검증 스테이지 화면 완주 | 미수행 | TASK-33 미착수 |
| VER-10 | [AC-04](../../requirements.md#인수-조건) | 상성×지형×아이템 보정 단위 테스트 | 미수행 | TASK-25 미착수 |
| VER-11 | [AC-12](../../requirements.md#인수-조건) | 적 20부대 AI 페이즈 100ms 측정 | 미수행 | TASK-31 미착수 |
| VER-12 | [NFR-01](../../requirements.md#비기능-요구사항) | 고정 시드 재현 테스트 | 미수행 | TASK-24·28·30·31 미착수 |
| VER-13 | [AC-01](../../requirements.md#인수-조건) | 손상 데이터로 `npm run validate` exit 1 | 미수행 | TASK-23·25·28·29 미착수 |
| VER-14 | [NFR-06](../../requirements.md#비기능-요구사항) | 상수 외부화 정적 확인 + config 변경 반영 확인 | 미수행 | TASK-33 미착수 |
| VER-15 | [FR-09](../../requirements.md#기능-요구사항)·[DES-13](../../design.md#컴포넌트와-책임) | 이벤트 DSL 단위 테스트 | 미수행 | TASK-29 미착수 |

## 실패와 미수행 분석

- 미수행 7건은 전부 "대상 작업 미착수"가 이유다. 구현 환경이나 외부 의존성 문제가 아니며, 각 대상 작업이 끝나는 시점에 실행한다.

## 비기능 검증

- 아직 없음. NFR-01(결정론)은 VER-12, NFR-04(AI 성능)는 VER-11, NFR-06(튜닝 가능성)은 VER-14, NFR-02(로직·렌더 분리)는 [TASK-34](../../plan.md#task-34-자체-리뷰전체-검증통합)의 정적 확인이 맡는다.

## 남은 위험

- [RISK-M2-01~04](../../plan.md#위험)이 계획에 등록되어 있다(원작 실측값 확보, 규칙 간 회귀, 연출 의존 검증, AI 성능). M1에서 이월된 [RISK-M0-01·02](../../plan.md#위험)도 유효하다.

## 재검증 조건

- 계획 자체를 바꾸면(작업 추가·제거, 의존 변경) 같은 변경에서 [계획 트리](../../plan.md#계획-트리)를 재생성한다.
- 구현 중 [기준선을 바꿔야 하는 차이](../../plan.md#기준선)를 발견하면 영향받는 구현을 보류하고 DCR 초안과 함께 wf-design으로 반환한다.
- M1의 재검증 조건([M1 기록](../20260817-m1-battle-prototype/work-log.md#재검증-조건))은 M2에서도 그대로 유효하다 — `src/core/battle/`나 `data/config/combat-config.json`이 바뀌면 `npm test`·`npm run validate`, 화면 코드가 바뀌면 `npm run build`와 화면 확인.

## 설계와 달라진 점

- 아직 없음(구현 미착수). 계획 수립 단계의 판단은 전부 승인된 기준선 안이며, 위 [결정과 이유](#2026-08-18--m2-계획-수립)에 근거를 남겼다.

## 미완료 항목

- TASK-21~34 전부(0/14), VER-09~15 전부(0/7).

## 재개 지점

- 다음 작업: [TASK-21 사기·혼란과 턴 시작 처리](../../plan.md#task-21-사기혼란과-턴-시작-처리)
- 먼저 확인할 사항:
  1. 착수 시 TASK-21의 상태를 `in-progress`로 바꾸고 같은 변경에서 [계획 트리](../../plan.md#계획-트리)를 재생성한다.
  2. 턴 시작 처리 순서는 [상세 스펙 §1.1](../../../yeonggeoljeon-remake-spec-detail.md)의 ① 자동 저장(M3) → ② 거점 회복 → ③ 자연 회복 아이템 → ④ 상태이상 판정 → ⑤ 턴 이벤트 그대로 고정한다. TASK-23·26·28·29가 이 파이프라인의 빈자리를 차례로 채운다.
  3. M1이 확정한 계약은 [M1 재개 지점](../20260817-m1-battle-prototype/work-log.md#재개-지점)에 정리되어 있다 — 코어 API 시그니처 `(ctx: BattleContext, state, ...)`, `BattleState`는 세이브 가능한 값만, 전투 테스트는 `tests/battle/fixtures.ts`의 `makeBattle`, 병력 상한식, 상성 방향, 사거리 척도.
  4. **문서 편집에 PowerShell `Get-Content`/`Set-Content`를 쓰지 않는다** — PowerShell 5.1이 UTF-8 문서를 ANSI로 읽어 한글이 깨진다. Read/Edit/Write 도구만 쓴다.
- 필요한 명령 또는 파일: PowerShell에서 `$env:Path += ";$env:LOCALAPPDATA\Programs\nodejs"` 후 `npm test` / `npm run validate` / `npm run dev` / `npm run build`. 사용자가 새로 여는 터미널에는 사용자 PATH가 이미 적용되어 있다.

## 인계

- 다음 단계 또는 워크플로우: wf-implement §3.3(구현) — TASK-21부터 계획 순서대로 TDD 사이클로 진행한다.
- 시작 조건: 충족 — 기준선 v1 승인, M0·M1 완료, 작업 트리 깨끗함, 자동 게이트 4종 통과 상태.
- 입력 문서와 기준선: [PLAN-ygj-remake](../../plan.md), [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, [상세 스펙](../../../yeonggeoljeon-remake-spec-detail.md), [결정 등록부](../../decisions.md)
- 완료된 항목: M2 계획 수립(TASK-21~34, VER-09~15, 계획 트리 재생성)
- 미완료 항목: M2 구현 전부
- 차단 요인: 없음
- 다음 행동: TASK-21의 선행 테스트 `tests/battle/morale.test.ts`를 작성해 의도한 이유로 실패하는지 확인한 뒤 최소 구현으로 통과시킨다.
- 미커밋 변경: 없음 — 사용자 요청으로 계획 수립 결과(`docs/plan.md`, 본 기록)를 커밋해 `origin/main`에 push했다(2026-08-18). 다른 PC에서 체크아웃해 이어받는 것이 전제다.
- 재개 프롬프트: 작업 20260818-m2-battle-complete의 계획 수립이 끝났다. docs/plan.md의 M2 사이클과 이 기록의 재개 지점을 읽고 TASK-21부터 구현하라.
