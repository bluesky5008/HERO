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
- 현재 결론 또는 상태: **구현 진행 중 (8/14)**. 작업 14건(TASK-21~34)과 검증 7건(VER-09~15)을 [PLAN](../../plan.md#m2-사이클-진행-중)에 정의했고, [TASK-21](../../plan.md#task-21-사기혼란과-턴-시작-처리)(사기·혼란과 턴 시작 처리)·[TASK-22](../../plan.md#task-22-경험치레벨업)(경험치·레벨업, 적 성장의 전투 범위 한정 포함)·[TASK-23](../../plan.md#task-23-책략-데이터-계약과-책략치mp)(책략 데이터 계약과 책략치)·[TASK-24](../../plan.md#task-24-책략-실행-커맨드)(책략 실행 커맨드)·[TASK-25](../../plan.md#task-25-아이템-데이터-계약과-장비-효과)(아이템 데이터 계약과 장비 효과)·[TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환)(아이템 사용과 승급·계열 전환)·[TASK-27](../../plan.md#task-27-병과-플래그와-반격)(병과 플래그와 반격)·[TASK-28](../../plan.md#task-28-보물군량고-조사와-날씨)(보물·군량고 조사와 날씨)을 완료했다. 자동 게이트 4종이 모두 성공한다(테스트 391건 — M1 기준선 184건 + 신규 207건).
- 다음 행동: [TASK-29 전투 이벤트 DSL 인터프리터](../../plan.md#task-29-전투-이벤트-dsl-인터프리터)의 선행 테스트 `tests/campaign/eventRunner.test.ts`를 작성해 실패를 확인한 뒤 구현한다.

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

- 진행 중인 작업: 없음
- 마지막 완료 작업: [TASK-28 보물·군량고 조사와 날씨](../../plan.md#task-28-보물군량고-조사와-날씨) (2026-08-18)
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

### 2026-08-18 — TASK-21 사기·혼란과 턴 시작 처리

- 수행 내용: [TASK-21](../../plan.md#task-21-사기혼란과-턴-시작-처리)을 [wf-implement §3.3의 TDD 사이클](#수행-기록)로 구현했다. 선행 테스트(`tests/battle/morale.test.ts` 신규 24건, `tests/battle/turn.test.ts` 2건)를 먼저 작성해 `beginPhase is not a function`·`morale.ts` 모듈 없음으로 실패(Red)를 확인한 뒤 최소 구현으로 통과시켰다(Green). 사기 변화·혼란 판정·거점 턴 시작 회복·피격 사기 감소·혼란 부대 조작 차단을 코어에 넣고, 턴 시작 처리를 `beginPhase` 파이프라인 하나로 모아 전투 화면에 배선했다.
- 변경 파일:
  - 신규 — `src/core/battle/morale.ts`(`changeMorale`·`rollConfusion`), `tests/battle/morale.test.ts`
  - 코어 — `src/core/battle/turn.ts`(`beginPhase`·거점 회복), `state.ts`(`Unit.confused`), `commands.ts`(혼란 조작 거부·피격 사기 감소), `events.ts`(`moraleChanged`·`healed`·`confused`)
  - 데이터 계약 — `src/core/data/schemas.ts`(`CombatConfig` 상수 6종), `data/config/combat-config.json`
  - 화면 — `src/scenes/BattleScene.ts`(`beginPhase` 배선), `BattleInteraction.ts`(혼란 부대 선택 차단)
  - 테스트 — `tests/battle/{fixtures,turn,commands}.test.ts`, `tests/data/{fixtures,schemas.test}.ts`, `tests/scenes/interaction.test.ts`
- 발견 사항:
  - **새 PC(맥미니, macOS)로 이관해 재개했다.** 이전 세션은 Windows 11이었다. `git clone` 후 HEAD가 `3793985`로 일치했고, `npm ci` 후 기준선(테스트 184건·`npm run validate`·`npm run build`)이 모두 통과해 기준선과 코드가 여전히 정합함을 확인했다(wf-implement §3.1). 실행 환경은 Node.js v26.7.0 / npm 11.19.0이다. `reference/`(원작 대조용 개인 자료)는 `.gitignore` 대상이라 이 PC에 없다 — M2 후반의 원작 대조([TASK-33](../../plan.md#task-33-m2-검증-스테이지와-원작-대조-튜닝))에서 필요해지면 별도로 옮겨야 한다.
  - **혼란이 페이즈 종료를 막을 수 있었다.** 혼란 부대는 조작이 불가한데 `isPhaseComplete`는 `acted`만 본다. 아무 처리도 하지 않으면 플레이어 전원이 혼란일 때 입력을 기다린 채 화면이 멈춘다. `rollConfusion`이 혼란 시 `moved`·`acted`를 함께 세우고(제자리 대기 = [상세 스펙 §1.4]의 기본 `confusionBehavior`), `BattleScene`이 적 페이즈 뒤 `render()` 대신 `afterCommand()`를 불러 그 판정을 다시 거치게 했다.
  - **M1 테스트 3건이 공격 이벤트 목록을 정확히 일치로 단언하고 있었다.** 피격 사기 감소가 `moraleChanged`를 더하면서 깨졌는데, 동작 회귀가 아니라 [FR-05](../../requirements.md#기능-요구사항)가 규정한 규칙 확장이다. 각 테스트의 의도(데미지가 이벤트에 실린다 / 반격이 없다 / 공격이 일어나고 선택이 풀린다)를 유지하면서 새 이벤트를 금지하지 않도록 단언을 고쳤다 — "반격 없음"은 `attacked` 이벤트가 1건임을 세는 방식으로 바꿔 의도가 더 정확해졌다.
- 결정과 이유:
  - **`src/core/battle/morale.ts`를 새로 만들었다.** [계획의 변경 대상](../../plan.md#task-21-사기혼란과-턴-시작-처리)에는 없던 파일이다. 사기·혼란 규칙을 `state.ts`(상태 구성)나 `turn.ts`(페이즈)에 섞는 대신 `damage.ts`·`movement.ts`와 같은 "규칙 영역 하나 = 파일 하나" 구조를 따랐다. 계획의 변경 대상은 주요 파일 안내이고 이 결정은 승인 범위 안의 내부 구현 세부사항이므로(wf-implement §4.1) 계획으로 되돌리지 않았다.
  - **사기를 바꾸는 모든 경로가 `changeMorale`을 지나게 했다.** "사기가 임계값 이상으로 회복되면 혼란이 즉시 해제된다"([상세 스펙 §1.4])는 규칙이 한 곳에만 있게 하려는 것이다. 기각한 대안은 해제를 턴 시작 판정에서만 처리하는 것 — 그러면 책략·아이템([TASK-24](../../plan.md#task-24-책략-실행-커맨드)·[TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환))으로 사기를 올려도 다음 턴까지 혼란이 남아 규칙과 어긋난다.
  - **`endPhase`의 시그니처를 바꾸지 않고 `beginPhase`를 따로 두었다.** `endPhase`가 턴 시작 처리까지 하게 하면 `ctx`·`rng`를 받아야 해 M1이 확정한 계약과 기존 테스트가 함께 움직인다. 전투 시작 직후의 첫 플레이어 페이즈는 `endPhase`를 거치지 않으므로 어느 쪽이든 호출 지점이 하나 남는다. 대신 화면 쪽에 `handOver()`를 두어 "페이즈 교대와 턴 시작 처리는 항상 붙어 있다"를 한 자리에 고정했다.
  - **턴 시작 처리를 단계별 전체 순회로 짰다.** 부대마다 ②→④를 도는 대신 모든 부대의 ②를 끝내고 ④로 넘어간다. [상세 스펙 §1.1]의 ①~⑤가 전역 순서이고, 뒤 작업이 채울 ③(자연 회복 아이템)·⑤(턴 이벤트)가 부대 단위가 아니기 때문이다.
  - **`confusion.chance` 초기값 0.5는 미확정이다.** [상세 스펙 §1.4]는 "확률 판정"이라고만 적고 값을 주지 않는다([검증] 항목). [TASK-33](../../plan.md#task-33-m2-검증-스테이지와-원작-대조-튜닝)의 원작 대조 대상이며([RISK-M2-01](../../plan.md#위험)), 값을 지어내지 않았음을 여기 남긴다.
  - **혼란 부대의 UI 선택도 막았다.** `BattleInteraction`의 선택 규칙은 "커맨드 계층이 거부할 선택을 애초에 만들지 않는다"였고, `applyCommand`가 혼란을 거부하게 되었으므로 그 불변식을 지키려면 선택 규칙도 같이 넓혀야 한다. 지금은 혼란 시 `acted`가 서므로 결과가 겹치지만, 이벤트 액션이 혼란을 거는 [TASK-29](../../plan.md#task-29-전투-이벤트-dsl-인터프리터) 이후에는 겹치지 않는다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run tests/battle/morale.test.ts tests/battle/turn.test.ts` | 의도한 실패 | `TypeError: beginPhase is not a function`, `morale.ts` 모듈 미존재로 수집 실패 |
  | 선행 테스트 통과 (Green) | 같은 명령 | 성공 | 38건 통과(morale 24 + turn 14) |
  | 결정론 (NFR-01) | `npm test` | 성공 | `같은 시드는 같은 판정을 낸다` — 시드 1의 앞 세 난수(0.092/0.506/0.888)에서 확률 0.5가 `[true, false, false]`로 갈리고 재실행이 같은 값을 낸다 |
  | 전체 테스트 | `npm test` | 성공 | 11파일 215건 통과 (M1 기준선 184건 + 신규 31건) |
  | 타입 검사 | `npx tsc --noEmit` | 성공 | 출력 없음 |
  | 데이터 검증 | `npm run validate` | 성공 | `데이터 검증 통과 (data/) — 병과 6, 무장 6, 지형 9, 스테이지 1` |
  | 빌드 | `npm run build` | 성공 | `✓ built in 1.00s` |
  | 로직·렌더 분리 (NFR-02) | `grep -rn 'from "pixi.js"\|from "node:" src/core/` | 성공 | 일치 없음 |
  | 상수 외부화 (NFR-06) | `src/core/battle/{morale,turn}.ts` 숫자 리터럴 정적 확인 | 성공 | 튜닝 대상 값은 전부 `combatConfig`에서 읽는다. 남은 리터럴은 사기 하한 `0`, 확률 정규화 `rng.range(0, 1)`, 회복량 판정 `healed > 0`뿐이며 셋 다 튜닝 값이 아니라 정의역이다 |

- 결과: 사기·혼란·거점 회복·턴 시작 파이프라인이 코어에 들어가고 화면에 배선되었다. `combat-config.json`에 상수 6종(`moraleMax`·`moraleLossOnHit`·`confusion.threshold`·`confusion.chance`·`strongholdRecovery.hpRatio`·`strongholdRecovery.morale`)이 추가되어 [TASK-21의 완료 조건](../../plan.md#task-21-사기혼란과-턴-시작-처리)("새 상수 5종 이상")을 충족한다. 화면 확인(혼란·거점 회복 연출과 상태이상 표시)은 [TASK-32](../../plan.md#task-32-전투-ui-확장)가 표시 요소를 만든 뒤 [VER-09](../../plan.md#검증-계획)에서 한다.

### 2026-08-18 — TASK-22 경험치·레벨업

- 수행 내용: [TASK-22](../../plan.md#task-22-경험치레벨업)를 TDD 사이클로 구현했다. 선행 테스트 `tests/battle/experience.test.ts`(신규 16건)를 먼저 작성해 `experience.ts` 모듈 미존재로 실패(Red)를 확인한 뒤 구현했다. 공격 경험치·격파 보너스·누적 레벨업(파생치 재계산 포함)·경험치 공유 토글을 넣고 `applyCommand`의 공격 경로에 배선했다.
- 변경 파일:
  - 신규 — `src/core/battle/experience.ts`(`attackExp`·`gainExp`·`grantDefeatExp`), `tests/battle/experience.test.ts`
  - 코어 — `state.ts`(`Unit.exp`), `commands.ts`(공격·격파 경험치 지급), `events.ts`(`expGained`·`leveledUp`)
  - 데이터 계약 — `schemas.ts`(`CombatConfig.maxLevel`·`exp` 5종, `GameConfig.shareExp`), `data/config/{combat,game}-config.json`
  - 테스트 — `tests/battle/{fixtures,commands}.test.ts`, `tests/data/{fixtures,schemas.test}.ts`
- 발견 사항:
  - **M1 테스트 1건이 또 정확히 일치 단언으로 깨졌다.** `격파하면 부대를 전장에서 지우고 격파 이벤트를 낸다`가 새 `expGained`로 실패했다. TASK-21과 같은 성질(규칙 확장이지 회귀가 아님)이며, 포함 단언으로 바꾸면서 "격파 이벤트는 공격 이벤트 뒤에 온다"는 연출 순서를 새로 명시했다 — 기존 배열 단언이 암묵적으로 지키던 성질이라 잃지 않게 옮겼다.
  - **적 부대도 경험치를 얻고 레벨이 오른다.** 현재 구현은 진영을 가리지 않는다([미완료 항목](#미완료-항목)의 미확정 규칙 참조).
- 결정과 이유:
  - **`shareExp`는 격파 보너스에만 적용한다.** [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)의 해당 문장이 "적 격파 경험치는 막타 부대가 독식(원작 재현). 낮은 레벨 부대 육성 편의 옵션(경험치 공유)은 …토글로 제공"으로, 토글이 "막타 독식"의 반대 개념으로 제시된다. 기각한 대안은 공격 경험치까지 전부 나누는 것 — 그러면 토글을 켠 순간 주력 부대의 성장이 인원수만큼 느려져 "육성 편의"라는 목적과 어긋난다. 기본값은 [FR-06](../../requirements.md#기능-요구사항)이 규정한 대로 OFF(원작 동작)다.
  - **공격 경험치는 내림으로 정수화한다.** [상세 스펙 §1.6]의 `clamp(dmg/expDivisor, 1, 40)`은 정수화 방식을 정하지 않는다. 내림을 골라 "낸 데미지보다 많이 받는" 경우를 없앴고, 하한이 1이라 적은 데미지도 0이 되지 않는다.
  - **최대 레벨에서 경험치를 임계 직전으로 묶었다.** 올릴 레벨이 없는데 누적만 계속하면 [TASK-32](../../plan.md#task-32-전투-ui-확장)의 경험치 표시가 영구히 가득 찬 상태가 된다. 규칙이 정한 것은 "레벨 99에서 더 오르지 않는다"뿐이므로 그 안에서 상태를 온전하게 유지하는 선택이다.
  - **`maxLevel`을 `combat-config.json`에 두었다.** `RosterEntrySchema`의 `level` 상한 99와 값이 같지만 의미가 다르다 — 스키마 쪽은 데이터 입력 시점의 출진 레벨 한계이고, `maxLevel`은 전투 중 성장의 천장이다. `moraleMax`와 `RosterEntry.morale` 상한의 관계도 같다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run tests/battle/experience.test.ts` | 의도한 실패 | `Failed to load url ../../src/core/battle/experience` |
  | 선행 테스트 통과 (Green) | 같은 명령 | 성공 | 16건 통과 |
  | 전체 테스트 | `npm test` | 성공 | 12파일 236건 통과 (TASK-21 시점 215건 + 신규 21건) |
  | 타입 검사 | `npx tsc --noEmit` | 성공 | 출력 없음 |
  | 데이터 검증 | `npm run validate` | 성공 | `데이터 검증 통과 (data/) — 병과 6, 무장 6, 지형 9, 스테이지 1` |
  | 빌드 | `npm run build` | 성공 | `✓ built in 1.05s` |
  | 상수 외부화 (NFR-06) | `src/core/battle/experience.ts` 숫자 리터럴 정적 확인 | 성공 | 남은 리터럴은 지급액 가드 `amount <= 0`, 레벨 증분 `+= 1`, config 파생 `perLevel - 1`뿐이며 튜닝 값이 아니다 |

- 결과: 경험치·레벨업이 코어에 들어가고 공격 경로에 배선되었다. `combat-config.json`에 상수 6종(`maxLevel`·`exp.divisor`·`exp.min`·`exp.max`·`exp.defeatBonus`·`exp.perLevel`), `game-config.json`에 `shareExp`가 추가되었다. 레벨업의 병력 상한 재계산은 [M1이 확정한 `hpMaxOf`](../20260817-m1-battle-prototype/work-log.md#재개-지점)만을 경로로 쓰므로 배치 시점 값과 갈라지지 않는다([TASK-22의 위험](../../plan.md#task-22-경험치레벨업) 완화).

### 2026-08-18 — TASK-22 후속: 적 부대 경험치 규칙 확정

- 수행 내용: TASK-22가 미확정으로 남겼던 "적 부대도 경험치를 얻는가"를 사용자 결정으로 두 차례에 걸쳐 확정했다. 각 단계마다 재현 테스트를 먼저 작성해 실패(Red)를 확인한 뒤 고쳤다.
  1. **1차(적 성장 금지)**: "적 부대는 경험치를 얻어 레벨이 오르면 안 된다" → `gainExp`에 진영 조건을 넣어 아군만 성장하게 했다.
  2. **2차(현행 규칙)**: "이번 스테이지에서 얻는 경험치는 누적되지만 다음 스테이지로 이관되지 않는다" → 진영 조건을 걷어내고, 이관되지 않는다는 성질을 테스트로 못박았다.
- 변경 파일: `src/core/battle/experience.ts`, `src/core/battle/state.ts`(주석), `tests/battle/experience.test.ts`, `tests/battle/state.test.ts`
- 결정과 이유:
  - **현행 규칙: 경험치는 진영을 가리지 않고 쌓이되, 적의 성장은 그 전투 안에서만 유효하다.** 적 부대도 전투 중에는 경험치를 얻고 레벨이 올라 병력·책략치 상한이 커진다. 다음 스테이지에서는 `stage.enemies`가 정한 레벨로 다시 시작한다.
  - **"누적된다"를 레벨업까지 포함하는 것으로 읽었다.** [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)에서 누적 경험치가 임계에 닿으면 레벨이 오르는 것이 경험치의 정의이고, 레벨로 전환되지 않는 누적은 아무 효과가 없어 "누적"이라 부를 이유가 없다. 사용자가 "약간 수정"이라 한 것도 1차의 "경험치를 아예 얻지 않음"을 완화하는 방향이다. 다르게 원한다면 `gainExp`의 레벨업 루프에 진영 조건 한 줄을 더하는 수정이다.
  - **이관 방지는 코드가 아니라 구조가 보장한다.** 적 배치는 언제나 `createBattleState`가 `stage.enemies`에서 새로 세우므로 이전 전투의 성장이 흘러들 경로 자체가 없다. 별도 초기화 코드를 더하지 않고(YAGNI) 그 불변식을 `tests/battle/state.test.ts`의 "적 부대의 성장은 다음 전투로 이관되지 않는다"로 고정했다 — [M3 캠페인](../../plan.md#범위-밖과-그-이유)이 편성을 공급할 때 이 성질을 조용히 깨면 그 테스트가 먼저 실패한다.
  - **`shareExp`는 진영을 가리지 않는다.** 규칙이 대칭이 되었으므로 격파 보너스 분배에 진영 조건을 따로 두지 않는다. 조건을 두 곳에 적지 않는다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 1차 재현 테스트 (Red→Green) | `npx vitest run tests/battle/experience.test.ts` | 성공 | 적 부대가 경험치·레벨·병력 상한을 얻던 4건이 실패 → 진영 조건 후 통과 |
  | 2차 재현 테스트 (Red→Green) | 같은 명령 | 성공 | "적 부대도 전투 중에는 경험치를 얻는다" 등 3건 실패 → 조건 제거 후 통과 |
  | 이관 방지 불변식 | `npx vitest run tests/battle/state.test.ts` | 성공 | 앞 전투에서 레벨업시킨 적이 새 전투에서 `stage.enemies`의 레벨·경험치 0으로 돌아온다 |
  | 전체 테스트 | `npm test` | 성공 | 12파일 262건 통과 |
  | 타입 검사·데이터 검증·빌드 | `npx tsc --noEmit` / `npm run validate` / `npm run build` | 성공 | 출력 없음 / `데이터 검증 통과` / `✓ built in 1.03s` |

- 결과: 적 부대의 성장이 전투 범위로 한정되었다. [미완료 항목](#미완료-항목)의 미확정 규칙 하나가 해소되어 TASK-33의 원작 대조 항목에서 빠지고, M3 캠페인이 지켜야 할 불변식 하나가 테스트로 남았다.

### 2026-08-18 — TASK-23 책략 데이터 계약과 책략치(MP)

- 수행 내용: [TASK-23](../../plan.md#task-23-책략-데이터-계약과-책략치mp)을 TDD 사이클로 구현했다. 선행 테스트(스키마 10건·무결성 4건·`mpMax` 파생 2건·거점 책략치 회복 3건·레벨업 재계산 2건)를 먼저 작성해 `TacticSchema` 미존재와 `mpMaxOf` 미존재로 실패(Red)를 확인한 뒤 구현했다. `tactics.json` 계약을 세우고 로더·validate CLI·브라우저 3경로에 배선했으며, 부대에 책략치를 넣고 거점 회복·레벨업과 연결했다.
- 변경 파일:
  - 데이터 계약 — `src/core/data/schemas.ts`(`TacticSchema`·`WeatherSchema`·`CombatConfig.mpIntDivisor`·`strongholdRecovery.mp`), `data/tactics.json`(신규 8종), `data/classes.json`(병과별 `tactics`), `data/config/combat-config.json`
  - 3경로 — `src/core/data/loader.ts`, `scripts/readGameData.ts`, `src/browserData.ts`
  - 무결성 — `src/core/data/integrity.ts`(책략 ID 중복·병과→책략 참조·책략→지형 참조), `scripts/validate.ts`(요약에 책략 수)
  - 코어 — `state.ts`(`Unit.mp`·`mpMax`, `mpMaxOf`), `turn.ts`(거점 책략치 회복), `experience.ts`(레벨업 시 상한 재계산)
  - 테스트 — `tests/data/{fixtures,schemas.test,integrity.test}.ts`, `tests/battle/{fixtures,state.test,morale.test,experience.test}.ts`
- 발견 사항:
  - **`Stage.weather`가 인라인 enum이었다.** 책략의 `weatherForbidden`·`weatherBonus`가 같은 값 집합을 쓰므로 `WeatherSchema`로 뽑아 두 곳이 함께 움직이게 했다. 값은 그대로여서 기존 스테이지 데이터와 M1 테스트는 영향이 없다.
  - **자체 리뷰에서 병과별 카테고리 배정이 스펙과 어긋난 것을 잡았다.** 처음에 연노병(`crossbow`)에 지계(`quake`)를 줬는데, [상세 스펙 §1.5](../../../yeonggeoljeon-remake-spec-detail.md)는 "궁병계=수계"이고 전 카테고리를 쓰는 것은 주술사뿐이다. `classes.json`을 수계만으로 되돌렸다.
- 결정과 이유:
  - **게이트를 코드 분기가 아니라 데이터로 표현했다.** [전체 설계 §4.4](../../../yeonggeoljeon-remake-design.md)의 계약대로 `terrainRequired`·`terrainBonus`·`weatherForbidden`·`weatherBonus`를 필드로 두었다. 기각한 대안은 `category`로 코드에서 분기하는 것 — 그러면 새 책략이 [FR-13](../../requirements.md#기능-요구사항)이 요구하는 "코드 수정 없이 데이터만으로" 들어오지 못하고, 콘솔판 풍계 확장도 코드 변경이 된다. `category`는 병과가 무엇을 배우는지 묶는 계열로만 남겼다.
  - **`mpMaxOf(config, officer, level)`을 `hpMaxOf`와 같은 자리에 두었다.** 배치·레벨업이 한 식만 쓰게 하는 것이 목적이며, 상한식 상수 `mpIntDivisor`가 config에 있어야 하므로(NFR-06) `hpMaxOf`와 달리 설정을 받는다.
  - **레벨업은 책략치 상한만 재계산하고 현재값을 채우지 않는다.** [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)이 "병력도 동량 회복"을 병력에만 적기 때문이다. 없는 규칙을 지어내지 않았다.
  - **테스트 픽스처에 주술사 병과를 더했다.** 지계 게이트를 시험하려면 그 카테고리를 쓰는 병과가 있어야 하는데, 시드 `classes.json`에는 주술사가 없다(원작 콘텐츠 입력은 M4). 시드 데이터를 늘리는 대신 테스트 픽스처에만 두어 [TASK-24](../../plan.md#task-24-책략-실행-커맨드)의 게이트 전 조합 테스트가 가능하게 했다. 그 결과 `quake`는 시드 병과 중 아무도 배우지 않는 책략으로 남는다 — 무결성 검사가 요구하는 방향은 "병과→책략"이므로 문제가 아니며, 카탈로그에 있는 것과 배우는 병과가 있는 것은 다른 문제다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run` | 의도한 실패 | `TacticSchema` 10건, 책략 참조 무결성 4건, `mpMaxOf` 미존재로 전투 픽스처를 쓰는 파일 전량 실패 |
  | 통과 (Green) | `npm test` | 성공 | 12파일 261건 통과 (TASK-22 시점 240건 + 신규 21건) |
  | 타입 검사 | `npx tsc --noEmit` | 성공 | 출력 없음 |
  | 데이터 검증 (정상) | `npm run validate` | 성공 | `데이터 검증 통과 (data/) — 병과 6, 책략 8, 무장 6, 지형 9, 스테이지 1` |
  | **VER-13 일부**(AC-01, 손상 데이터) | `tactics.json`의 `terrainBonus`를 없는 지형으로 바꾸고 `npm run validate` | 성공 | `exit=1`, `책략 fire_arrow가 참조한 지형 'no_such_terrain'가 terrain.json에 없다`. 원본 복원 후 재실행하여 exit 0 확인 |
  | 브라우저 로드 경로 | `npm run build` | 성공 | `✓ built in 1.00s` — `browserData.ts`가 `tactics.json`을 번들에 포함한 채 컴파일된다 |

- 결과: `tactics.json`이 스키마·무결성 검사와 함께 존재하고 3경로 모두에서 읽힌다. 부대가 `mp`·`mpMax`를 갖고 거점에서 자연 회복하며 레벨업 시 상한이 재계산된다. [TASK-23의 위험](../../plan.md#task-23-책략-데이터-계약과-책략치mp)(3경로 중 하나를 빠뜨리면 브라우저에서만 깨짐)은 경로별 증거를 각각 남겨 해소했다 — 로더는 단위 테스트, CLI는 실행 확인, 브라우저는 빌드다.

### 2026-08-18 — TASK-24 책략 실행 커맨드

- 수행 내용: [TASK-24](../../plan.md#task-24-책략-실행-커맨드)를 TDD 사이클로 구현했다. 선행 테스트 `tests/battle/tactics.test.ts`(신규 45건 — 게이트 15조합 전수 포함)를 먼저 작성해 `tactics.ts` 모듈 미존재로 실패(Red)를 확인한 뒤 구현했다. 사용 조건·지형/날씨 게이트·거점 무효·명중 판정·피해/회복/사기저하/혼란 효과·`cross5` 범위·책략치 소비·성공 경험치를 넣고 `useTactic` 커맨드로 배선했다.
- 변경 파일:
  - 신규 — `src/core/battle/tactics.ts`(`tacticOf`·`tacticRejection`·`applyTactic`), `tests/battle/tactics.test.ts`
  - 코어 — `commands.ts`(`useTactic` 분기), `events.ts`(`tacticUsed`·`tacticMissed`), `movement.ts`(`gridDistance` 이관), `morale.ts`·`turn.ts`(혼란 수명 정리)
  - 데이터 계약 — `schemas.ts`(`CombatConfig.tactic` 5종), `data/config/combat-config.json`
  - 테스트 — `tests/battle/{fixtures,morale.test}.ts`, `tests/data/fixtures.ts`
- 발견 사항:
  - **혼란 책략이 페이즈를 멈출 수 있었다.** `bewilder`로 사기가 높은 부대를 혼란에 빠뜨리면, 턴 시작 판정이 사기만 보고 넘어가 `acted`가 서지 않는데 커맨드 계층과 UI는 혼란을 막는다 — 그 부대는 영원히 행동할 수 없고 `isPhaseComplete`도 참이 되지 않아 화면이 멈춘다. 적 페이즈에서는 `runAiPhase`가 그 부대에 커맨드를 만들어 `BattleCommandError`가 잡히지 않은 채 올라간다. 재현 테스트 3건을 먼저 만들어 실패를 확인하고 고쳤다.
  - **`attackDistance`를 `commands.ts`에서 `movement.ts`로 옮겼다.** `commands.ts`가 `tactics.ts`를 부르므로 `tactics.ts`가 사거리 계산을 위해 `commands.ts`를 도로 부르면 순환 참조가 된다. 좌표 기하는 `movement.ts`가 이미 다루던 영역이라 `gridDistance`로 옮겨 공격 사거리와 책략 사거리가 같은 자를 쓰게 했다.
- 결정과 이유:
  - **혼란을 한 턴짜리 상태로 정리했다.** [상세 스펙 §1.4](../../../yeonggeoljeon-remake-spec-detail.md)는 "혼란 상태 부대는 **그 턴** 조작 불가"라고 적고 해제 규칙으로 사기 회복만 든다. 책략으로 걸린 혼란의 지속 시간은 규정이 없다. 사기 기준으로만 풀면 사기가 높은 대상의 혼란이 영원히 남고(위 결함), 사기가 높다고 판정을 건너뛰면 책략이 아무 일도 하지 않는다. 그래서 ① 턴 시작에 이미 혼란이면 판정 없이 그 턴을 잃고, ② 차례를 마칠 때 `endPhase`가 혼란을 푼다. 사기가 여전히 낮으면 다음 턴 시작 판정에서 다시 걸리므로 §1.4의 "턴 시작마다 확률 판정"도 그대로다. 기각한 대안은 `Unit`에 지속 턴 수 필드를 더하는 것 — 규칙에 없는 값을 세이브 포맷(M3)에 밀어 넣게 된다.
  - **거점이 막는 효과를 설정 목록으로 뺐다.** §1.5는 "거점 위 부대에게 공격 책략 무효"라고 하면서 사기저하·혼란 포함 여부를 `[검증]`으로 남겼다. 코드에 어느 쪽이든 박으면 원작 대조 결과가 코드 수정이 되므로 `tactic.strongholdBlocks`에 두었다(초기값 `["damage"]`). [TASK-33](../../plan.md#task-33-m2-검증-스테이지와-원작-대조-튜닝)은 데이터만 고치면 된다(NFR-06).
  - **게이트를 데이터가 정하게 유지했다.** `tacticRejection`은 `weatherForbidden`·`terrainRequired`를 읽을 뿐 카테고리로 분기하지 않는다. 새 책략이 코드 수정 없이 들어와야 하기 때문이다(FR-13). 게이트 15조합을 표로 만들어 전수 테스트했다([TASK-24의 위험](../../plan.md#task-24-책략-실행-커맨드) 완화).
  - **판정과 실행을 `tacticRejection`/`applyTactic`으로 나눴다.** 커맨드 계층이 거부 사유를 그대로 오류로 던지고, 화면([TASK-32](../../plan.md#task-32-전투-ui-확장))은 같은 함수로 메뉴를 걸러낸다 — "고를 수 있는 것"과 "실제로 통과하는 것"이 갈라지지 않게 한 곳에 뒀다. `tactics.ts`가 `BattleCommandError`를 던지지 않으므로 순환 참조도 생기지 않는다.
  - **책략치는 빗나가도 소비된다.** 소비되는 것은 결과가 아니라 시전이다. 규정이 없어 명시적으로 테스트에 고정했다.
  - **피해 난수는 `damageJitter`를 그대로 쓴다.** §1.5의 `rng(0.9~1.1)`이 물리 데미지와 같은 폭이라 상수를 새로 만들지 않았다. 둘이 갈라져야 할 근거가 나오면 그때 나눈다(YAGNI).
  - **회복량은 지력차로 늘지 않는다.** §1.5가 지력차 보정을 준 것은 피해 공식뿐이다. 없는 규칙을 지어내지 않았다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run tests/battle/tactics.test.ts` | 의도한 실패 | `tactics.ts` 모듈 미존재로 수집 실패 |
  | 게이트 전 조합 (Red→Green) | 같은 명령 | 성공 | 화계 5·수계 4·지계 4·제한 없음 2 = 15조합 전수 통과 |
  | 혼란 결함 재현 (Red→Green) | `npx vitest run tests/battle/morale.test.ts` | 성공 | "사기가 높아도 혼란이면 그 턴을 잃는다"·"전원이 혼란이어도 페이즈가 끝난다"·"차례를 마치면 혼란이 풀린다" 3건이 실패 → 수정 후 통과 |
  | 결정론 (NFR-01, VER-12 일부) | `npm test` | 성공 | 같은 시드에서 같은 명중·피해가 재현된다 |
  | 전체 테스트 | `npm test` | 성공 | 13파일 311건 통과 (TASK-23 시점 262건 + 신규 49건) |
  | 타입 검사·데이터 검증·빌드 | `npx tsc --noEmit` / `npm run validate` / `npm run build` | 성공 | 출력 없음 / `데이터 검증 통과 (data/) — 병과 6, 책략 8, 무장 6, 지형 9, 스테이지 1` / `✓ built in 1.03s` |
  | 상수 외부화 (NFR-06) | `tactics.ts` 숫자 리터럴 정적 확인 | 성공 | 명중 기준·상하한·지력 계수·거점 차단 목록이 전부 `combatConfig.tactic`에서 온다. 남은 리터럴은 배수식의 `1`과 백분율 정규화 `rng.range(0, 100)`뿐이다 |

- 결과: 화면 배선을 뺀 책략 규칙이 전부 코어에 들어갔다. 조작·표시는 [TASK-32](../../plan.md#task-32-전투-ui-확장)가, 적 AI의 책략 사용 판단은 [TASK-31](../../plan.md#task-31-2단계-적-ai)이 이 함수들을 불러 쓴다.

### 2026-08-18 — TASK-25 아이템 데이터 계약과 장비 효과

- 수행 내용: [TASK-25](../../plan.md#task-25-아이템-데이터-계약과-장비-효과)를 TDD 사이클로 구현했다. 선행 테스트(스키마 7건·무결성 5건·장비 데미지 6건·이동 4건·소지품 1건)를 먼저 작성해 `ItemSchema` 미존재로 실패(Red)를 확인한 뒤 구현했다. `items.json` 계약을 세우고 3경로에 배선했으며, 무기·병법서 배수와 탈것 이동력을 전투에 상시 반영했다.
- 변경 파일:
  - 데이터 계약 — `schemas.ts`(`ItemSchema` 7종·`CombatConfig.itemSlots`), `data/items.json`(신규 8종), `data/config/combat-config.json`
  - 3경로 — `loader.ts`, `scripts/readGameData.ts`, `browserData.ts`
  - 무결성 — `integrity.ts`(아이템 ID 중복·소모품→책략·전환서→병과 참조, `forbiddenFor` 경고와 `DataIssue.severity`), `scripts/validate.ts`(경고/오류 분리, 요약에 아이템 수)
  - 코어 — `state.ts`(`Unit.items`), `damage.ts`(`itemMultiplier`), `movement.ts`(`mountBonus`)
  - 테스트 — `tests/data/{fixtures,schemas.test,integrity.test}.ts`, `tests/battle/{fixtures,state.test,damage.test,movement.test}.ts`
- 발견 사항:
  - **`DataIssue`에 심각도가 없었다.** [FR-07](../../requirements.md#기능-요구사항)과 [전체 설계 §4.5](../../../yeonggeoljeon-remake-design.md)는 `forbiddenFor`를 "**경고** 항목으로 체크"하라고 정하는데, 기존 모델은 문제가 하나라도 있으면 `npm run validate`가 exit 1이었다. 개조 확장용 필드에 값이 들었다고 게임을 못 돌리게 하는 것은 설계와 다르므로 `severity?: "warning"`을 더하고 CLI가 경고와 오류를 나눠 다루게 했다.
  - **테스트 두 건이 구현이 아니라 테스트 설계 때문에 실패했다.** ① 배수 검증을 `Math.round(bare * 1.2)`로 적었는데 공식은 끝에서 한 번만 반올림하므로 1 어긋난다 — 검증하려는 것이 "배수만큼 오른다"이므로 비율(`toBeCloseTo`)로 바꿨다. ② 이동력 누적 테스트를 7×7 맵에서 했는데 이동력 6이면 이미 전 칸에 닿아 차이가 드러나지 않았다 — 13×13으로 넓혔다.
- 결정과 이유:
  - **`value` 한 필드에 유형별 의미를 담았다.** [전체 설계 §4.5](../../../yeonggeoljeon-remake-design.md)가 `weapon`(공격%)·`mount`(이동+n)처럼 유형마다 효과를 하나씩 주므로, 유형별 필드를 따로 두면 대부분 `null`인 열이 늘어난다. 의미는 스키마 주석이 정하고 미사용 유형은 기본값 0이다.
  - **`itemSlots`를 설정으로 뺐다.** FR-07의 "부대당 8개 한도"는 튜닝 대상 상수이므로 `combat-config.json`에 두었다(NFR-06). 실제 획득·사용 시 상한 판정은 [TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환)·[TASK-28](../../plan.md#task-28-보물군량고-조사와-날씨)이 이 값을 읽어 한다 — 지금은 아이템을 늘리는 경로가 없어 판정할 자리가 없다(YAGNI).
  - **장비 배수를 곱셈 항으로만 더했다.** [M1이 고정한 데미지 공식](../20260817-m1-battle-prototype/work-log.md#수행-기록)에 `itemMultiplier`를 곱하되 소지품이 비면 1이므로 M1 결과가 그대로 나온다. 이것이 [TASK-25의 위험](../../plan.md#task-25-아이템-데이터-계약과-장비-효과)이 말한 회귀 판정 기준이라 "장비가 없으면 M1이 고정한 값 그대로다"를 테스트로 명시했다.
  - **`forbiddenFor` 경고는 병과 변경·승급 아이템에만 건다.** FR-07이 막은 것은 그 두 유형이고, 장비 아이템의 장수 제한까지 경고하면 설계가 하지 않은 말을 하게 된다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run` | 의도한 실패 | `ItemSchema` 미존재 등 17건 실패 |
  | **VER-10**(AC-04, 상성 × 지형 × 아이템) | `npm test` | 성공 | 무기·병법서 배수가 공격·방어에 곱해지고, 상성(기병→보병)·지형(숲 +10%) 보정과 함께 걸리며, 장비가 없으면 M1 값 그대로다 |
  | **VER-13 일부**(AC-01, 손상 데이터) | `items.json`의 `tacticId`를 없는 책략으로 바꾸고 `npm run validate` | 성공 | `exit=1`, `소모품이 복제할 책략 'no_such_tactic'가 tactics.json에 없다` |
  | 경고는 데이터를 막지 않는다 (FR-07) | `forbiddenFor`에 값을 넣고 `npm run validate` | 성공 | `exit=0`, `경고 1건 (data/)`과 해당 메시지 출력. 원본 복원 후 재실행하여 경고 없이 통과 |
  | 전체 테스트 | `npm test` | 성공 | 13파일 334건 통과 (TASK-24 시점 311건 + 신규 23건) |
  | 타입 검사·빌드 | `npx tsc --noEmit` / `npm run build` | 성공 | 출력 없음 / `✓ built in 1.03s` — 브라우저 경로가 `items.json`을 포함해 컴파일된다 |
  | M1 회귀 없음 | `npm test` | 성공 | M1 데미지·이동 테스트가 한 건도 바뀌지 않고 통과 |

- 결과: `items.json`이 스키마·무결성 검사와 함께 존재하고 3경로에서 읽힌다. 장비가 데미지와 이동에 상시 반영되며 [VER-10](../../plan.md#검증-계획)이 충족되어 [AC-04](../../requirements.md#인수-조건)가 완결됐다(M1의 상성·지형에 아이템 항이 더해졌다). 사용·승급은 [TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환)이, 전투맵 획득은 [TASK-28](../../plan.md#task-28-보물군량고-조사와-날씨)이 잇는다.

### 2026-08-18 — TASK-26 아이템 사용과 승급·계열 전환

- 수행 내용: [TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환)을 TDD 사이클로 구현했다. 선행 테스트 `tests/battle/items.test.ts`(신규 26건)를 먼저 작성해 `items.ts` 미존재로 22건 실패(Red)를 확인한 뒤 구현했다. `useItem` 커맨드가 소모품·승급·계열 전환을 적용하고, 자연 회복이 턴 시작 ③에 들어갔다.
- 변경 파일:
  - 신규 — `src/core/battle/items.ts`(`carriedItem`·`itemRejection`·`useItem`·`regenAmount`), `tests/battle/items.test.ts`
  - 코어 — `commands.ts`(`useItem` 분기), `turn.ts`(턴 시작 ③), `events.ts`(`itemUsed`·`classChanged`), `tactics.ts`(판정·효과 분리)
  - 데이터 — `data/items.json`(승급 아이템에 적용 병과 지정)
  - 테스트 — `tests/battle/fixtures.ts`(승급 사슬·FR-07 확인용 아이템, 경고 허용)
- 발견 사항:
  - **승급이 파생치를 어긋나게 할 위험은 현재 데이터 모델에서 성립하지 않는다.** [계획의 위험](../../plan.md#task-26-아이템-사용과-승급계열-전환)은 "병과 교체 후 파생치를 다시 계산하지 않으면 상태가 데이터와 어긋난다"였고, 계획의 검증 방법도 `hpMax`·`mpMax`가 새 병과 기준으로 갱신되기를 기대했다. 그러나 `hpMaxOf(officer, level)`는 무장 성장값과 레벨에서, `mpMaxOf(config, officer, level)`는 지력과 레벨에서 나오므로 **둘 다 병과에 의존하지 않는다**. 병과에서 오는 값(공격·방어 보정, 사거리, 이동, 상성 계열)은 `classId`로 매번 조회하므로 캐시가 없어 어긋날 자리도 없다. 그래서 무의미한 재계산 코드를 넣는 대신, 승급 직후 새 병과의 사거리 규칙이 곧바로 적용되는지를 테스트로 고정했다(단병 4방향 → 장병 8방향으로 대각선 대상이 사거리에 들어온다).
  - **픽스처가 경고 때문에 막혔다.** FR-07 확인용으로 `forbiddenFor`에 값이 든 전환서를 픽스처에 넣자 `makeBattle`이 예외를 던졌다 — `loadGameData`의 문제를 전부 오류로 취급하고 있었기 때문이다. [TASK-25가 도입한 심각도](#2026-08-18--task-25-아이템-데이터-계약과-장비-효과)에 맞춰 경고는 픽스처를 막지 않게 고쳤다.
- 결정과 이유:
  - **책략 모듈을 판정과 효과로 나눴다.** 소모품은 "책략 효과를 복제하되 책략치를 쓰지 않고 병과 조건도 받지 않는" 것이므로, `applyTactic`(책략치 소비 + 사용 이벤트 + 효과)에서 `applyTacticEffects`(효과만)를 떼어내고 `tacticRejection`(병과·책략치 + 대상)에서 `tacticTargetRejection`(맵·사거리·날씨·지형)을 떼어냈다. 기각한 대안은 `applyTactic`에 "비용 없음" 플래그를 넘기는 것 — 한 함수가 두 규칙을 품게 되고 호출부마다 어느 규칙인지 읽어야 한다.
  - **소모품도 책략의 지형·날씨 게이트를 받는다.** 규정이 없지만 "책략 효과 복제"이므로 효과가 성립하는 조건도 함께 복제하는 편이 일관된다(우천에 화계 두루마리가 통하면 게이트가 무의미해진다). 반대로 병과·책략치 조건은 아이템이 대신 시전하는 것이므로 받지 않는다.
  - **승급 아이템에 적용 병과를 지정했다.** [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)의 "단병→장병: 장창"처럼 아이템과 병과가 짝이므로, `classId`가 있으면 그 병과에만 쓰이게 했다. 지정하지 않으면 제한이 없다. 기각한 대안은 병과의 `upgradesTo`만 보는 것 — 그러면 장창을 기병에게 써도 기병이 승급해 원작과 어긋난다.
  - **`forbiddenFor`를 코드가 보지 않는다.** [FR-07](../../requirements.md#기능-요구사항)이 "장수별 사용 제한을 두어서는 안 된다"고 못박았으므로 규칙이 그 필드를 읽지 않는다. 값이 든 전환서를 지닌 부대가 그대로 전환되는 것을 테스트로 고정했다.
  - **장비·자연 회복은 사용 커맨드로 쓸 수 없다.** 지니는 것만으로 걸리거나 턴 시작에 저절로 발동하므로 "쓰는" 행동이 없다. 행동 한 번을 헛되이 소비하지 않도록 거부한다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run tests/battle/items.test.ts` | 의도한 실패 | 26건 중 22건 실패(`items.ts` 미존재) |
  | 통과 (Green) | 같은 명령 | 성공 | 26건 통과 |
  | 전체 테스트 | `npm test` | 성공 | 14파일 360건 통과 (TASK-25 시점 334건 + 신규 26건) |
  | 타입 검사·데이터 검증·빌드 | `npx tsc --noEmit` / `npm run validate` / `npm run build` | 성공 | 출력 없음 / `데이터 검증 통과` / `✓ built in 1.03s` |

- 결과: 아이템의 전투 내 사용이 완결됐다. 남은 것은 전투맵 획득([TASK-28](../../plan.md#task-28-보물군량고-조사와-날씨))과 화면 조작([TASK-32](../../plan.md#task-32-전투-ui-확장))이며, 상점 구매·자금은 M3 범위다.

### 2026-08-18 — TASK-27 병과 플래그와 반격

- 수행 내용: [TASK-27](../../plan.md#task-27-병과-플래그와-반격)을 TDD 사이클로 구현했다. 선행 테스트(반격 8건·이동 플래그 4건)를 먼저 작성해 실패(Red)를 확인한 뒤 구현했다. M1이 미뤄 둔 반격과 이동 플래그 2종이 동작하고, 플래그를 가진 병과가 시드 데이터에 들어갔다.
- 변경 파일: `commands.ts`(`counterAttack` 함수), `movement.ts`(`mountainMove`·`noTerrainPenalty`), `events.ts`(`countered`), `data/classes.json`(적병 추가), `data/affinity.json`·`data/assets-map/*.json`, `tests/battle/{fixtures,commands.test,movement.test}.ts`
- 발견 사항:
  - **`noTerrainPenalty`는 데미지에 손댈 자리가 없다.** [계획의 변경 대상](../../plan.md#task-27-병과-플래그와-반격)은 `damage.ts`에서 "지형 보정 무시 범위 확정"을 요구했다. 그런데 현재 공식에서 지형은 **방어측에게 주는 보너스**일 뿐 어느 쪽에도 페널티가 아니다([상세 스펙 §1.3]). 플래그 이름이 말하는 "페널티"가 데미지 공식에 존재하지 않으므로, 없는 규칙을 지어내는 대신 이동 코스트에만 적용하고 그 판단을 여기 남긴다. 스펙·설계 어디에도 이 플래그의 정의가 없어([상세 스펙 §10]의 스키마 열거가 유일한 언급) [TASK-33](../../plan.md#task-33-m2-검증-스테이지와-원작-대조-튜닝)의 원작 대조 항목으로 올린다.
  - **시드 데이터의 특수계는 플래그 없이도 산을 지난다.** [상세 스펙 §1.2](../../../yeonggeoljeon-remake-spec-detail.md)의 지형표가 `특수(적병)`에게 산 코스트 1을 이미 주기 때문이다. 그래서 처음 쓴 테스트는 플래그가 아니라 계열 표를 재고 있었다 — 보병계에 플래그를 단 병과를 픽스처에 따로 두어 플래그 자체를 시험하도록 고쳤다.
  - **새 계열을 데이터에 더하니 무결성 검사가 상성 누락을 잡았다.** 적병(`special` 계열)을 넣자 `npm run validate`가 `special → special` 조합이 없다고 실패했다. 검사가 의도대로 동작한 것이며, 특수계의 상성은 자료가 없어 지어내지 않고 전부 동등(1.0)으로 채웠다.
- 결정과 이유:
  - **`mountainMove`는 "지형표가 막은 칸을 연다"로 구현했다.** 코드에 `"mountain"`이라는 지형 ID를 박으면 지형이 데이터인데 규칙이 코드에 남아 FR-13과 어긋난다. 대신 `blocked`를 여는 일반 규칙으로 두고, 그래도 막아야 하는 칸(강)은 병과의 `movementRules.forbidden`이 걸러내게 했다 — `stepCost`가 이미 문서화한 "좁은 규칙(병과)이 넓은 규칙(지형표)을 이긴다" 원칙의 연장이다.
  - **반격을 `commands.ts`의 함수 하나로 모았다.** 공격 한 번이 데미지·격파 판정을 두 번 낳는 지점이므로([TASK-27의 위험](../../plan.md#task-27-병과-플래그와-반격)) 순서를 한 곳에 고정했다 — 방어측이 살아남았을 때만 반격하고, 반격으로 원 공격자가 쓰러지면 그 자리에서 전장을 떠난다. 격파·사거리 밖·플래그 없음 세 경우를 각각 테스트로 못박았다.
  - **반격도 보통 공격과 같은 뒤처리를 받는다.** 반격한 부대는 경험치를 얻고, 반격을 맞은 부대는 사기를 잃는다. 반격만 다른 규칙을 쓸 근거가 스펙에 없다.
  - **`counterAttack`을 가진 시드 병과는 두지 않았다.** [상세 스펙 §1.1](../../../yeonggeoljeon-remake-spec-detail.md)이 "대상 병과 확인 필요"를 `[검증]`으로 남겼다. 규칙은 구현하고 테스트 픽스처(친위대)로 검증하되, 어느 원작 병과가 반격하는지는 지어내지 않고 TASK-33으로 넘긴다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run tests/battle/{commands,movement}.test.ts` | 의도한 실패 | 반격 5건·이동 플래그 2건 실패 |
  | 통과 (Green) | 같은 명령 | 성공 | 53건 통과 |
  | 전체 테스트 | `npm test` | 성공 | 14파일 372건 통과 (TASK-26 시점 360건 + 신규 12건) |
  | M1 회귀 없음 | `npm test` | 성공 | 플래그 없는 병과의 이동·공격이 M1 그대로임을 명시 테스트로 고정했다 |
  | 데이터 검증 | `npm run validate` | 성공 | 적병 추가 후 상성 누락을 잡아 채운 뒤 `병과 7, 책략 8, 아이템 8, 무장 6, 지형 9, 스테이지 1` |
  | 타입 검사·빌드 | `npx tsc --noEmit` / `npm run build` | 성공 | 출력 없음 / `✓ built in 1.02s` |

- 결과: M1이 남긴 연결 지점([M1 후속 작업](../20260817-m1-battle-prototype/work-log.md#후속-작업))이 해소됐다. 반격과 이동 플래그가 동작하고 플래그를 가진 병과가 데이터에 존재한다.

### 2026-08-18 — TASK-28 보물·군량고 조사와 날씨

- 수행 내용: [TASK-28](../../plan.md#task-28-보물군량고-조사와-날씨)을 TDD 사이클로 구현했다. 선행 테스트 `tests/battle/treasure.test.ts`(신규 15건)와 무결성 4건을 먼저 작성해 실패(Red)를 확인한 뒤 구현했다. 조사 커맨드로 보물을 1회성 획득하고, 스테이지가 고정 또는 동적 날씨를 정하며 그 결과가 책략 게이트에 반영된다.
- 변경 파일: `schemas.ts`(`StageWeatherSchema`·`Stage.treasures`), `state.ts`(`treasuresTaken`·`weatherTurnsLeft`·`initialWeather`), `commands.ts`(`investigate`), `turn.ts`(`rollWeather`), `events.ts`(`treasureFound`·`weatherChanged`), `integrity.ts`(보물 검사), `data/scenario/stages/stage-test.json`, `src/ui/BattleHud.ts`, 테스트 4파일
- 발견 사항:
  - **날씨 스키마를 넓히자 HUD가 타입 오류로 걸렸다.** `BattleHud`가 표시 이름을 `Record<Stage["weather"], string>`으로 잡고 있어, 그 타입이 객체까지 포함하게 되자 컴파일이 막혔다. HUD가 그려야 하는 것은 스테이지가 **정한 형태**가 아니라 전투 상태의 **지금 날씨**이므로 `Weather`로 좁혔다 — 타입 검사가 개념 혼동을 정확히 짚어 준 경우다.
  - **테스트 두 건이 규칙이 아니라 시나리오 설계 때문에 실패했다.** ① 보물 재획득 테스트에서 다른 부대를 보물 칸으로 옮기려 했는데 아군이 서 있는 칸에는 멈출 수 없다(M1 규칙) — 같은 부대가 다음 턴에 다시 조사하는 방식으로 바꿔 규칙만 남겼다. ② 비 지속 테스트가 2턴 뒤 잔여 턴 0을 기대했으나, 비가 1·2턴에 내리고 3턴 시작에 그치는 것이 `rainDuration: 2`의 올바른 해석이다 — 3턴째를 확인하도록 고쳤다.
- 결정과 이유:
  - **날씨를 유니온으로 넓혀 M1 표기를 그대로 읽는다.** `weather: "clear"`(문자열)와 `{ initial, rainChance, rainDuration }`(객체)를 모두 받는다. [TASK-28의 위험](../../plan.md#task-28-보물군량고-조사와-날씨)이 정확히 이것이었고, M1 스테이지 데이터를 고치지 않고도 로드되는 것을 테스트로 고정했다.
  - **날씨 판정을 턴 단위로 두었다.** `beginPhase`는 페이즈마다 도는데 날씨는 진영이 아니라 전장 전체의 것이다. 플레이어 페이즈에서만 판정해 한 턴에 두 번 바뀌지 않게 했다.
  - **조사는 선 자리에서만 한다.** [상세 스펙 §1.7](../../../yeonggeoljeon-remake-spec-detail.md)이 "위에서 조사 행동"이라 적었고, "진입 시 자동"은 `[검증]`으로 남긴 대안이다. 지어내지 않고 명시된 쪽만 구현했다.
  - **`treasuresTaken`을 좌표 키 배열로 두었다.** 인덱스는 스테이지 데이터가 바뀌면 의미가 달라지지만 좌표는 맵에 붙어 있다. 세이브(M3)에 그대로 실릴 값이라 안정적인 키가 필요하다.
  - **소지품 상한이 여기서 처음 판정된다.** [TASK-25](#2026-08-18--task-25-아이템-데이터-계약과-장비-효과)가 설정으로 뺀 `itemSlots`를 조사 획득이 읽는다. 가득 차면 거부하고 보물은 맵에 남는다 — 잃어버리면 되돌릴 방법이 없기 때문이다.
- 실행한 검증:

  | 검증 | 명령 | 결과 | 증거 |
  |---|---|---|---|
  | 선행 테스트 실패 확인 (Red) | `npx vitest run` | 의도한 실패 | `investigate` 커맨드·`treasures` 옵션 미존재 |
  | 통과 (Green) | `npm test` | 성공 | 15파일 391건 통과 (TASK-27 시점 372건 + 신규 19건) |
  | M1 데이터 형식 유지 | `npm test` | 성공 | 문자열 날씨가 그대로 읽히고, 보물을 적지 않은 스테이지는 빈 목록이 된다 |
  | 결정론 (NFR-01) | `npm test` | 성공 | 같은 시드가 같은 날씨 열을 내고, 확률 0.5에서 값이 갈린다 |
  | **VER-13 일부**(AC-01) | 보물을 맵 밖·없는 아이템으로 바꾸고 `npm run validate` | 성공 | `exit=1`, `보물 좌표 [99, 99]가 맵(20×15) 밖이다`·`보물이 가리킨 아이템 'no_such'가 items.json에 없다`. 원본 복원 후 exit 0 |
  | 타입 검사·빌드 | `npx tsc --noEmit` / `npm run build` | 성공 | 출력 없음 / `✓ built in 1.03s` |

- 결과: 전투맵 보물 획득과 날씨가 들어가 [VER-13](../../plan.md#검증-계획)의 남은 대상 중 보물이 채워졌다(이벤트는 TASK-29). 조사 행동의 화면 조작은 [TASK-32](../../plan.md#task-32-전투-ui-확장)가 잇는다.

## 검증 범위와 환경

- 대상 기준선 또는 구현: [REQ-ygj-remake](../../requirements.md) v1 / [DESIGN-ygj-remake](../../design.md) v1의 M2 범위. TASK-21~28 완료, TASK-29~34 미착수.
- 실행 환경: **macOS(Darwin 25.4.0, 맥미니), Node.js v26.7.0 / npm 11.19.0**(2026-08-18 이관). 계획 수립까지는 Windows 11 / Node.js v24.19.0 / npm 11.17.0이었다. 화면 확인은 `npm run dev` + Chrome 헤드리스 CDP 하네스([M1 재개 지점](../20260817-m1-battle-prototype/work-log.md#재개-지점) 7번).
- 제외 항목: 화면 확인(연출·상태이상 표시)은 표시 요소를 만드는 [TASK-32](../../plan.md#task-32-전투-ui-확장) 이후 [VER-09](../../plan.md#검증-계획)에서 한다. TASK-21은 판정 가능한 규칙을 전부 단위 테스트로 고정했다([RISK-M0-01](../../plan.md#위험)의 완화 방식과 같다).

## 결과 요약

- 성공: TASK-21~28의 선행 테스트(각 26건·19건·21건·48건·23건·26건·12건·19건, Red→Green)와 자동 게이트 4종 — `npm test` 391건, `npx tsc --noEmit`, `npm run validate`, `npm run build`. M1 기준선 184건이 한 건도 깨지지 않았다(단언 4건은 규칙 확장에 맞춰 의도를 유지한 채 고쳤다 — 각 [TASK-21](#2026-08-18--task-21-사기혼란과-턴-시작-처리)·[TASK-22](#2026-08-18--task-22-경험치레벨업) 수행 기록).
- 실패: 없음
- 미수행: VER-09·11·12·14·15. **VER-10**(AC-04)은 [TASK-25](#2026-08-18--task-25-아이템-데이터-계약과-장비-효과)에서 충족했다 — 상성 3×3 × 지형 × 아이템 보정이 단위 테스트로 고정되어 AC-04가 완결됐다. **VER-13**(AC-01)은 `tactics.json`·`items.json` 참조에 대해 부분 충족했고, 남은 대상(보물·이벤트)은 TASK-28·29에서 채운다.

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

- **NFR-01(결정론)**: TASK-21의 혼란 판정을 고정 시드 재현 테스트로 고정했다(`같은 시드는 같은 판정을 낸다`). 사이클 단위 검증인 [VER-12](../../plan.md#검증-계획)는 책략·날씨·일기토·AI가 들어온 뒤 TASK-24·28·30·31에서 완결한다.
- **NFR-02(로직·렌더 분리)**: `src/core/`가 PixiJS·`node:` 모듈을 import하지 않음을 정적 확인했다(TASK-21 시점). 사이클 단위 재확인은 [TASK-34](../../plan.md#task-34-자체-리뷰전체-검증통합)가 맡는다.
- **NFR-06(튜닝 가능성)**: TASK-21이 더한 상수 6종이 전부 `combat-config.json`에 있고 코어에 튜닝 대상 리터럴이 없음을 확인했다. 사이클 단위 검증은 VER-14(TASK-33)다.
- **NFR-04(AI 성능)**: 아직 없음 — VER-11(TASK-31)이 맡는다.

## 남은 위험

- [RISK-M2-01~04](../../plan.md#위험)이 계획에 등록되어 있다(원작 실측값 확보, 규칙 간 회귀, 연출 의존 검증, AI 성능). M1에서 이월된 [RISK-M0-01·02](../../plan.md#위험)도 유효하다.

## 재검증 조건

- 계획 자체를 바꾸면(작업 추가·제거, 의존 변경) 같은 변경에서 [계획 트리](../../plan.md#계획-트리)를 재생성한다.
- 구현 중 [기준선을 바꿔야 하는 차이](../../plan.md#기준선)를 발견하면 영향받는 구현을 보류하고 DCR 초안과 함께 wf-design으로 반환한다.
- M1의 재검증 조건([M1 기록](../20260817-m1-battle-prototype/work-log.md#재검증-조건))은 M2에서도 그대로 유효하다 — `src/core/battle/`나 `data/config/combat-config.json`이 바뀌면 `npm test`·`npm run validate`, 화면 코드가 바뀌면 `npm run build`와 화면 확인.

## 설계와 달라진 점

- **승인된 설계·요구사항과 달라진 점은 없다.** TASK-21의 구현은 [DES-01](../../design.md#컴포넌트와-책임)이 전투 코어에 배정한 사기·혼란을 [상세 스펙 §1.1·§1.4·§1.7](../../../yeonggeoljeon-remake-spec-detail.md) 그대로 실현했다.
- **계획의 변경 대상과 달라진 점 하나**: 계획에 없던 `src/core/battle/morale.ts`를 새로 만들었다. 승인 범위 안의 내부 구현 세부사항이며(wf-implement §4.1) 이유는 [TASK-21 수행 기록](#2026-08-18--task-21-사기혼란과-턴-시작-처리)의 결정과 이유에 있다. TASK-22는 계획의 변경 대상 그대로 손댔다.

## 미완료 항목

- TASK-29~34(6건), VER-09·11·12·14·15(VER-10 충족, VER-12·13은 부분 충족).
- **미확정 상수**(전부 [상세 스펙](../../../yeonggeoljeon-remake-spec-detail.md)의 `[검증]` 항목이라 값을 지어내지 않고 [TASK-33](../../plan.md#task-33-m2-검증-스테이지와-원작-대조-튜닝)의 원작 대조 대상으로 남긴다 — [RISK-M2-01](../../plan.md#위험)):
  - `confusion.chance` 0.5 — §1.4가 "확률 판정"이라고만 적고 값을 주지 않는다.
  - `exp.divisor` 10 — §1.6이 `expDivisor`를 `[검증]`으로 남겼다.
  - `exp.defeatBonus` 45 — §1.6이 준 "40~50" 범위 안의 값이며 실측 확정은 아니다.
  - `counterAttack`을 가진 원작 병과 — §1.1이 "대상 병과 확인 필요"로 남겼다. 규칙은 구현했고 시드 데이터에는 아직 지정하지 않았다.
  - `noTerrainPenalty`의 정의 — 스펙·설계 어디에도 없어 이동 코스트 무효화로만 구현했다([TASK-27 기록](#2026-08-18--task-27-병과-플래그와-반격)).
- ~~미확정 규칙 — 적 부대의 경험치·레벨업~~ → **확정됨**(2026-08-18, 사용자 결정): 전투 중에는 진영을 가리지 않고 쌓이되 적의 성장은 다음 스테이지로 이관되지 않는다. [수행 기록](#2026-08-18--task-22-후속-적-부대-경험치-규칙-확정) 참조.
- **TASK-21·22가 뒤 작업에 남긴 자리**: `beginPhase`의 ③ 자연 회복 아이템([TASK-26](../../plan.md#task-26-아이템-사용과-승급계열-전환))·⑤ 턴 이벤트([TASK-29](../../plan.md#task-29-전투-이벤트-dsl-인터프리터)), 거점 회복과 레벨업의 책략치 항([TASK-23](../../plan.md#task-23-책략-데이터-계약과-책략치mp)), 책략·회복·아이템·일기토의 경험치 지급(TASK-24·26·30 — 각자 `gainExp`를 부른다), 혼란·경험치의 화면 표시([TASK-32](../../plan.md#task-32-전투-ui-확장)).

## 재개 지점

- 다음 작업: [TASK-29 전투 이벤트 DSL 인터프리터](../../plan.md#task-29-전투-이벤트-dsl-인터프리터)
- 먼저 확인할 사항:
  1. 착수 시 TASK-29의 상태를 `in-progress`로 바꾸고 같은 변경에서 [계획 트리](../../plan.md#계획-트리)를 재생성한다.
  2. 턴 시작 처리 순서는 [상세 스펙 §1.1](../../../yeonggeoljeon-remake-spec-detail.md)의 ① 자동 저장(M3) → ② 거점 회복 → ③ 자연 회복 아이템 → ④ 상태이상 판정 → ⑤ 턴 이벤트로 이미 고정되어 있다(`src/core/battle/turn.ts`의 `beginPhase`). ③은 TASK-26, ⑤는 TASK-29가 채운다.
  3. **TASK-23·24가 세운 책략 계약** — 지형·날씨 게이트는 코드 분기가 아니라 `tactics.json`의 필드가 표현하고, 판정은 `tacticRejection`(사용 가능 여부)과 `applyTactic`(적용)으로 나뉜다. 화면과 AI는 같은 `tacticRejection`을 불러 후보를 걸러야 한다. 혼란은 한 턴짜리 상태이며 `endPhase`가 차례를 마친 진영의 것을 푼다.
  4. **TASK-21·22가 확정한 계약** — 사기를 바꾸는 모든 경로는 `changeMorale(ctx, unit, delta)`을, 경험치를 주는 모든 경로는 `gainExp(ctx, unit, amount)`을 지난다(혼란 해제와 레벨업이 각각 그 안에 있다). 혼란 부대는 `moved`·`acted`가 함께 서서 그 턴을 소비한다. 새 전투 상수는 `CombatConfigSchema`에 넣고 `data/config/combat-config.json`·`tests/data/fixtures.ts`의 `validCombatConfig` 두 곳을 함께 갱신한다(게임 설정은 `game-config.json`·`validConfig`).
  5. **M1 테스트의 정확히 일치 단언에 주의한다.** `tests/battle/commands.test.ts`에서 공격 이벤트 배열을 `toEqual`로 단언하던 3건이 TASK-21·22의 새 이벤트로 깨졌다. 커맨드에 이벤트를 더하는 작업(TASK-24·26·27)에서 같은 일이 또 생기면, 회귀가 아니라 규칙 확장인지 먼저 판단하고 원래 테스트의 의도를 유지한 채 포함 단언으로 바꾼다.
  6. M1이 확정한 계약은 [M1 재개 지점](../20260817-m1-battle-prototype/work-log.md#재개-지점)에 정리되어 있다 — 코어 API 시그니처 `(ctx: BattleContext, state, ...)`, `BattleState`는 세이브 가능한 값만, 전투 테스트는 `tests/battle/fixtures.ts`의 `makeBattle`, 병력 상한식 `hpMaxOf(officer, level)`, 상성 방향, 사거리 척도.
  7. **TASK-25가 세운 아이템 계약** — 장비 효과는 `damage.ts`의 `itemMultiplier`와 `movement.ts`의 `mountBonus`가 소지품에서 읽는다. 소지품 상한은 `combatConfig.itemSlots`이며, 아이템을 늘리는 경로(사용·보물)가 생기는 TASK-26·28이 그 값으로 판정한다. 데이터를 막지 않는 문제는 `DataIssue.severity: "warning"`으로 보고하면 `npm run validate`가 실패하지 않는다.
- 필요한 명령 또는 파일: `npm test` / `npm run validate` / `npm run dev` / `npm run build`. **현재 개발 PC는 맥미니(macOS)이며 Node.js v26.7.0이 PATH에 있다** — 이전 Windows PC의 `$env:Path += ";$env:LOCALAPPDATA\Programs\nodejs"` 절차는 이 환경에서 필요 없다. `node_modules/`는 커밋되지 않으므로 새 체크아웃에서는 `npm ci`를 먼저 실행한다.

## 인계

- 다음 단계 또는 워크플로우: wf-implement §3.3(구현) — TASK-29부터 계획 순서대로 TDD 사이클로 진행한다.
- 시작 조건: 충족 — 기준선 v1 승인, M0·M1 완료, TASK-21~28 완료, 자동 게이트 4종 통과 상태.
- 입력 문서와 기준선: [PLAN-ygj-remake](../../plan.md), [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, [상세 스펙](../../../yeonggeoljeon-remake-spec-detail.md), [결정 등록부](../../decisions.md)
- 완료된 항목: M2 계획 수립(TASK-21~34, VER-09~15, 계획 트리 재생성), **TASK-21 사기·혼란과 턴 시작 처리**, **TASK-22 경험치·레벨업**, **TASK-23 책략 데이터 계약과 책략치(MP)**, **TASK-24 책략 실행 커맨드**, **TASK-25 아이템 데이터 계약과 장비 효과**, **TASK-26 아이템 사용과 승급·계열 전환**, **TASK-27 병과 플래그와 반격**, **TASK-28 보물·군량고 조사와 날씨**
- 미완료 항목: TASK-29~34, VER-09·11·12·14·15(VER-10 충족, VER-12·13은 부분 충족)
- 차단 요인: 없음
- 다음 행동: TASK-29의 선행 테스트 `tests/campaign/eventRunner.test.ts`(트리거 9종·`once` 재발동 방지·동시 발동 순서·액션 적용)를 작성해 의도한 이유로 실패하는지 확인한 뒤 최소 구현으로 통과시킨다.
- 미커밋 변경: 없음 — `95c3569`(TASK-21·22), `0d19b76`(TASK-23), `9e0d79b`(적 성장 범위 한정), `253cf1b`(TASK-24), `e4d2091`(TASK-25), `95a1c60`(TASK-26), `bc1fc69`(TASK-27), TASK-28 커밋까지 `origin/main`에 push했다.
- 재개 프롬프트: 작업 20260818-m2-battle-complete의 TASK-28까지 끝났다. docs/plan.md의 M2 사이클과 이 기록의 재개 지점을 읽고 TASK-29부터 구현하라.
