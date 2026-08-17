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
- 현재 결론 또는 상태: **구현 중(5/11).** TASK-10~14(결정론적 RNG·전투 데이터·전투 상태·이동 범위·데미지 공식) 완료 — 테스트 110건 통과, 타입 검사·데이터 검증 성공. TASK-15~20이 남았다. 계획이 미결로 남긴 3건(병력 상한식·이동 제약 우선순위·상성 방향)은 모두 결정하고 테스트로 고정했다.
- 다음 행동: TASK-15(커맨드 적용)를 선행 테스트부터 구현한다.

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

- 진행 중인 작업: 없음
- 마지막 완료 작업: TASK-14 데미지 공식과 상성
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

### 2026-08-17 — TASK-10 결정론적 RNG (TDD)

- 수행 내용: `tests/rng.test.ts`를 먼저 작성해 Red를 확인한 뒤 `src/core/rng.ts`에 xoshiro128**와 상태 직렬화·복원을 구현했다.
- 변경 파일: `tests/rng.test.ts`, `src/core/rng.ts`
- 결정과 이유(모두 승인 범위 안의 내부 구현 세부사항):
  - **공개 API를 `range`·`save`·`createRng`·`restoreRng`로 한정했다.** M1이 실제로 쓰는 난수는 데미지 산포 `rng.range(0.9, 1.1)`([상세 스펙 §1.3](../../../yeonggeoljeon-remake-spec-detail.md)) 하나뿐이다. 정수 추첨·확률 판정(`nextInt`·`chance`)은 책략 명중과 AI가 들어오는 M2에서 필요해질 때 추가한다(결정 사다리 1단계 — YAGNI). 원시 32bit 출력은 노출하지 않아 구현 교체 여지를 남겼다.
  - **상태 스냅숏 형식은 세이브 포맷 `{ algo, state[4] }`([상세 스펙 §2.3](../../../yeonggeoljeon-remake-spec-detail.md))를 그대로 쓴다.** M3 세이브 계층이 변환 없이 그대로 담을 수 있고, `algo` 필드가 있어야 [ADR-003](../20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md)이 예고한 알고리즘 교체 시 마이그레이션을 판별할 수 있다.
  - **`restoreRng`는 이미 설치된 zod로 상태를 검사한다**(결정 사다리 5단계). 세이브 파일은 사용자가 직접 고치는 것이 전제이므로 신뢰 경계 입력이며, 이는 최소 구현 원칙의 예외 영역이다. 특히 상태가 전부 0이면 xoshiro는 영원히 0만 내놓는데, 이 고장은 화면에서 "운이 나쁜 전투"로 보일 뿐 조용히 재현성을 무너뜨린다(계획이 지목한 TASK-10 위험). 던져서 즉시 드러낸다.
  - **시드 확장에 splitmix32를 썼다.** 32bit 시드 하나를 128bit 상태에 그대로 채우면 시드 0이 전부 0인 금지 상태가 되고, 작은 시드끼리 초기 수열이 서로 닮는다. 시드 0을 테스트로 고정했다.
  - `save()`는 내부 상태를 배열 리터럴로 복사해 돌려준다. 스냅숏을 넘긴 뒤 난수를 더 소비해도 이미 저장한 값이 따라 바뀌지 않아야 한다(M3 자동 저장의 전제).
- 실행한 검증: 구현 전 `npm test` → `tests/rng.test.ts` 스위트 로드 실패(`Failed to load url ../src/core/rng`) = 의도한 Red. 구현 후 `npm test` 40건 통과(신규 9건), `npx tsc --noEmit` exit 0.
- 결과: 성공. NFR-01 결정론과 상태 왕복이 테스트로 고정되었다([VER-07](../../plan.md#검증-계획)의 절반 — 나머지 데미지 결정론은 TASK-14).

### 2026-08-17 — TASK-11 전투 데이터 확장 (TDD)

- 수행 내용: 스키마·무결성 테스트 25건을 먼저 작성해 Red를 확인한 뒤 `OfficerSchema`·`CombatConfigSchema`와 스테이지의 배치·적·승패 조건을 구현하고 시드 데이터를 채웠다.
- 변경 파일: `tests/data/fixtures.ts`, `tests/data/schemas.test.ts`, `tests/data/integrity.test.ts`, `src/core/data/schemas.ts`, `src/core/data/loader.ts`, `src/core/data/integrity.ts`, `scripts/readGameData.ts`, `scripts/validate.ts`, `src/browserData.ts`, `data/officers.json`, `data/config/combat-config.json`, `data/scenario/stages/stage-test.json`
- 결정과 이유:
  - **병력 상한식을 `growth.baseHp + growth.hpPerLevel × (level - 1)`로 정했다**(계획이 미결로 남긴 항목 1). [상세 스펙 §1.6](../../../yeonggeoljeon-remake-spec-detail.md)은 "레벨업 시 상한 +`hpPerLevel`"만 규정하고 레벨 1의 값을 정하지 않아, 그 기준값 `growth.baseHp`를 무장 데이터에 추가했다. 기준값을 전역 상수로 두지 않고 무장별로 둔 이유는 원작에서 장수마다 병력 규모가 다르고, [스키마 정본은 코드](../../design.md#데이터와-인터페이스)이므로 확장이 승인 범위 안이기 때문이다. 계획은 이 결정을 TASK-12에 배정했으나 데이터 형태가 식에 딸려 있어 TASK-11에서 확정했다(식을 실제로 계산하는 코드는 TASK-12).
  - **스키마를 M1이 읽는 필드로 한정했다.** 무장은 `id·name·war·int·ldr·classId·growth`만 둔다 — 초상·`essential`·`joinStage`·일기토·`mpCurve`는 해당 기능이 들어오는 M2 이후에 추가한다(계획이 지목한 YAGNI 위험). `int`는 M1이 쓰지 않지만 무/지/통은 한 덩어리의 능력치이고 검증 규칙이 같아 함께 넣었다.
  - **승패 조건을 `{ type, ... }` 객체로 두었다.** M1은 `annihilateEnemies`·`officerLost` 두 유형뿐이라 문자열로도 충분하지만, M2가 도달·생존 조건(매개변수 있음)을 더할 때 `z.discriminatedUnion`으로 자연스럽게 넓어지는 형태다. 필드 하나 값의 비용으로 확장 지점을 명시했다.
  - **출진 명단(`deployment.roster`)을 스테이지에 선택 필드로 넣었다.** M1에는 캠페인 편성(M3)이 없어 출진 명단의 출처가 없는데, 이를 코드에 박으면 [FR-13](../../requirements.md) 데이터 주도 원칙이 깨진다. M3에서 `CampaignState`가 이 자리를 대신하면 스테이지는 필드를 비우면 된다.
  - **전투 상수 초기값은 `baseDamage: 300`, `minDamage: 1`, `damageJitter: 0.9~1.1`.** 시드 무장·병과 기준으로 관우(Lv5)가 등무를 3~4대에, 등무가 관우를 7대 이상에 격파하는 수치가 되도록 역산했다 — 프로토타입에서 전투 한 판이 지루하지도 즉사하지도 않는 길이. 전부 [상세 스펙](../../../yeonggeoljeon-remake-spec-detail.md)의 `[검증]` 항목이며 M2 원작 대조 튜닝에서 교체된다.
  - **시드 무장 이름에 "(프로토타입 값)"을 붙였다.** JSON에는 주석을 달 수 없어 화면에 그대로 드러나는 이름에 표시했다([RISK-M0-02](../../plan.md#위험) — 시드 데이터를 원작 값으로 오인하는 것을 막는다). M4 데이터 입력에서 교체한다.
  - 무결성 검사에 무장 ID 중복·`classId` 참조·적/명단/패배 조건의 `officerId` 참조·배치 좌표의 맵 범위·적 부대 겹침을 추가했다. 지형 진입 가능 여부는 검사하지 않는다 — 이동 규칙의 우선순위가 TASK-13에서 정해지기 전에 판정하면 규칙이 두 곳으로 갈라진다.
- 실행한 검증: 구현 전 `npm test` → 25건 실패(`CombatConfigSchema`·`OfficerSchema` 미존재, 새 무결성 규칙 미구현) = 의도한 Red. 구현 후 `npm test` 65건 통과, `npx tsc --noEmit` exit 0, `npm run validate` → `병과 6, 무장 6, 지형 9, 스테이지 1` 통과, `npm run build` 성공.
- 결과: 성공.

### 2026-08-17 — TASK-12 전투 상태 구성 (TDD)

- 수행 내용: `tests/battle/state.test.ts` 13건을 먼저 작성해 Red를 확인한 뒤 `src/core/battle/state.ts`에 `BattleState`·`Unit`과 `createBattleState`를 구현했다.
- 변경 파일: `tests/battle/state.test.ts`, `tests/data/fixtures.ts`, `tests/data/schemas.test.ts`, `tests/data/integrity.test.ts`, `src/core/battle/state.ts`, `src/core/data/schemas.ts`
- 결정과 이유:
  - **`Unit`을 M1이 쓰는 필드로 한정했다.** [전체 설계 §6.3](../../../yeonggeoljeon-remake-design.md)의 `Unit`에서 `mp`·`items`·`status`를, `BattleState`에서 `flags`를 뺐다 — 책략·아이템·혼란·전투 이벤트가 모두 M2 범위여서 지금 넣으면 아무도 읽지 않는 필드가 세이브 포맷(M3)까지 따라간다. 해당 기능이 들어오는 마일스톤에서 그 기능과 함께 추가한다.
  - **`side`와 `hpMax`를 `Unit`에 더했다.** 설계의 발췌에는 없지만 진영 구분 없이는 아군·적군을 나눌 수 없고, 병력 상한은 격파 판정과 데미지 상한([상세 스펙 §1.3]의 `clamp(..., def.hp)`)이 매번 참조한다. 발췌가 생략한 항목의 보충이지 계약 변경이 아니다.
  - **부대 식별자는 `officerId`를 그대로 쓴다.** 한 무장이 한 부대를 지휘하고 같은 무장이 두 번 출진할 수 없으므로(테스트로 고정) 별도 `unitId`는 중복 개념이다.
  - **배치 규칙 위반은 예외로 던진다.** 스테이지 데이터는 `npm run validate`가, 플레이어 배치는 UI가 이미 막는 층이라 여기까지 온 위반은 버그다. 조용한 폴백은 잘못된 좌표의 부대를 화면에 남긴다.
  - **사기 기본값(100)을 `RosterEntrySchema`로 옮겼다.** 적 배치와 출진 명단이 같은 기본값을 쓰는데 코드에 한 번 더 적으면 데이터와 코드 두 곳에 같은 상수가 생긴다.
  - 배치 좌표가 배치 구역(`deployment.zone`) 안인지도 검사한다. 구역을 데이터로 정의해 두고 강제하지 않으면 그 데이터는 장식이 된다.
- 실행한 검증: 구현 전 `npm test` → `tests/battle/state.test.ts` 로드 실패(모듈 없음) = 의도한 Red. 구현 후 `npm test` 78건 통과(신규 13건), `npx tsc --noEmit` exit 0.
- 결과: 성공. 계획이 미결로 남긴 병력 상한식은 TASK-11에서 결정하고 여기서 `hpMaxOf()`로 구현했다.

### 2026-08-17 — TASK-13 이동 범위 계산 (TDD)

- 수행 내용: 전투 테스트용 소형 전장 픽스처와 `tests/battle/movement.test.ts` 9건을 먼저 작성해 Red를 확인한 뒤 `src/core/battle/movement.ts`를 구현했다.
- 변경 파일: `tests/battle/fixtures.ts`, `tests/battle/movement.test.ts`, `tests/battle/state.test.ts`, `src/core/battle/movement.ts`, `src/core/battle/state.ts`
- 결정과 이유:
  - **이동 제약의 우선순위를 확정했다**(계획이 미결로 남긴 항목 2, [M0 후속 작업](../20260817-m0-skeleton/work-log.md#후속-작업)): **`terrain.moveCost`가 계열별 기본값이고 병과의 `movementRules`가 그 위를 덮어쓴다.** 근거는 [상세 스펙 §1.2](../../../yeonggeoljeon-remake-spec-detail.md)가 지형표를 "기본표"로 부르고 계열 단위로 적으며, `movementRules`는 병과 단위라는 점이다. 좁은 규칙(병과)이 넓은 규칙(계열)을 이겨야 예외를 표현할 수 있고, 반대로 두면 병과별 예외를 적을 방법이 사라진다. 두 값이 서로 다른 상황을 픽스처(숲의 기병 코스트 1 vs 경기병 `forbidden: ["forest"]`)로 만들어 테스트로 고정했다.
  - **이동은 상하좌우 4방향으로 확정했다.** 원작과 [상세 스펙 §1.2](../../../yeonggeoljeon-remake-spec-detail.md)의 코스트 표가 격자 이동을 전제한다. 공격 방향(4/8)은 병과 데이터가 따로 정하므로 이동과 섞지 않았다.
  - **정의되지 않은 지형은 진입 불가로 다룬다.** 크래시 없이 길만 막고, 문제 자체는 `npm run validate`가 별도로 보고한다(NFR-03 — M0 렌더의 마젠타 폴백과 같은 태도).
  - **우선순위 큐 없이 최솟값 훑기로 다익스트라를 돌린다.** 이동 범위는 최대 이동력 7 기준 수십 칸이라 힙을 들이면 코드만 길어진다.
  - **결과를 (y, x) 순으로 정렬해 돌려준다.** AI가 이 목록에서 목적지를 고르므로(TASK-17) 순서가 흔들리면 결정론(NFR-01)이 깨진다.
  - **`BattleContext { data, stage }`를 도입했다.** [전체 설계 §6.3](../../../yeonggeoljeon-remake-design.md)의 `applyCommand(state, cmd, rng)`에는 데이터 인자가 없지만, `BattleState`는 세이브에 그대로 실리는 값이어야 해서(M3, [상세 스펙 §2.3](../../../yeonggeoljeon-remake-spec-detail.md)) 정적 참조 자료를 상태에 담을 수 없다. 전투 함수들이 컨텍스트를 별도 인자로 받는다.
  - 병과가 없는 부대는 `classOf`가 던지고, 배치 시점(`createBattleState`)에 미리 확인한다 — 전투 도중이 아니라 시작 전에 드러나야 한다.
- 실행한 검증: 구현 전 `npm test` → `tests/battle/movement.test.ts` 로드 실패(모듈 없음) = 의도한 Red. 구현 후 `npm test` 88건 통과(신규 10건), `npx tsc --noEmit` exit 0.
- 결과: 성공.

### 2026-08-17 — TASK-14 데미지 공식과 상성 (TDD, VER-06·VER-07)

- 수행 내용: `tests/battle/damage.test.ts` 22건을 먼저 작성해 Red를 확인한 뒤 `src/core/battle/damage.ts`를 구현했다.
- 변경 파일: `tests/battle/damage.test.ts`, `tests/battle/fixtures.ts`, `src/core/battle/damage.ts`, `src/core/battle/state.ts`
- 결정과 이유:
  - **상성 방향을 테스트로 고정했다**(계획이 미결로 남긴 항목 3): **배수 0.75가 유리**다. 방어측 방어력에 곱하므로 배수가 작을수록 데미지가 커진다. 기병→보병(0.75)이 보병→기병(1.25)보다 큰 피해를 준다는 테스트와, 계열 3×3 전 조합에서 배수가 실제로 적용되는지 보는 테스트로 묶었다. M0가 [문서 우선순위 규칙](../../requirements.md#제약과-의존성)에 따라 채택한 [상세 스펙 §1.3](../../../yeonggeoljeon-remake-spec-detail.md)의 방향 그대로다.
  - **상성 3×3 검증을 "배수를 1로 덮어쓴 같은 조합"과의 비교로 짰다.** 기대 데미지를 테스트에서 다시 계산하면 공식을 두 번 적으므로 회귀를 잡지 못한다. 대신 상성만 지운 대조군을 만들어 방향과 조합별 조회를 확인한다.
  - **난수 폭을 1~1로 고정한 픽스처로 공식 테스트를 짰다.** 상수가 데이터에 있으므로(NFR-06) 난수를 제거하면 공식만 남아 정확한 값을 고정할 수 있다. 결정론 자체는 고정 시드 수열 비교로 따로 확인했다(VER-07).
  - **아이템 보정 항(`itemAtkMul`·`itemDefMul`)을 넣지 않았다.** 아이템은 M2 범위이고 지금 넣으면 항상 1을 곱하는 죽은 항이 된다. 곱셈 항이라 M2에서 그 자리에 붙이면 된다.
  - **데미지 상한을 남은 병력으로 잘라 마지막에 적용한다.** `clamp` 순서상 최소 데미지가 남은 병력보다 클 수 있는데(병력 3, 최소 데미지 10), 그때는 남은 병력이 이겨야 초과 격파가 안 생긴다.
  - `officerOf`를 `state.ts`에 두어 무장 조회를 한 곳으로 모았다 — 데미지·UI·AI가 같은 조회를 반복하게 두지 않는다.
- 실행한 검증: 구현 전 `npm test` → `tests/battle/damage.test.ts` 로드 실패(모듈 없음) = 의도한 Red. 구현 후 `npm test` 110건 통과(신규 22건), `npx tsc --noEmit` exit 0, `npm run validate` 통과.
- 결과: 성공. [VER-06](../../plan.md#검증-계획)(AC-04 상성)과 [VER-07](../../plan.md#검증-계획)(NFR-01 결정론)의 단위 테스트 부분을 충족했다. VER-07의 "같은 커맨드 열 → 같은 결과"는 커맨드가 생기는 TASK-15 이후에 완결한다.

## 설계와 달라진 점

- **전투 함수 시그니처에 `BattleContext` 인자를 더했다.** [전체 설계 §6.3](../../../yeonggeoljeon-remake-design.md) 발췌의 `applyCommand(state, cmd, rng)`는 데이터 접근 경로를 적지 않았다. 상태를 직렬화 가능한 값으로 유지하려면(세이브 요구 FR-12) 데이터·스테이지를 상태 밖에서 받아야 한다. 공개 동작·데이터 모델·인수 조건은 그대로이므로 승인 범위 안의 구현 세부사항으로 판단했다.
- 그 밖에는 없음. 위 결정은 모두 승인된 [DES-04](../../design.md#컴포넌트와-책임)·[DES-12](../../design.md#컴포넌트와-책임)·[ADR-003](../20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md) 범위 안의 구현 세부사항이다. 스키마 확장은 설계가 "스키마는 코드가 원본"으로 규정한 범위 안이다.

## 미완료 항목

- TASK-15~20. 검증 VER-05(AC-02 화면 완주)·VER-08(유닛 스프라이트 폴백). VER-06은 충족, VER-07은 단위 테스트까지 충족하고 커맨드 열 재현은 TASK-15 이후.

## 재개 지점

- 다음 작업: TASK-15 커맨드 적용
- 먼저 확인할 사항:
  1. [PLAN의 M1 사이클](../../plan.md#m1-사이클-진행-중) — 작업별 목표·검증 방법·의존성
  2. 지금까지 확정한 규칙: 병력 상한 `baseHp + hpPerLevel × (level-1)`, 이동 제약은 병과 `movementRules`가 지형표를 덮어씀, 상성 배수 0.75가 유리
  3. 코어 함수는 `(ctx: BattleContext, state, ...)` 형태를 따른다 — `BattleState`는 세이브 가능한 값만 담는다
  4. 전투 테스트는 `tests/battle/fixtures.ts`의 `makeBattle(맵 문자열, 부대 목록, 옵션)`으로 전장을 만든다
- 필요한 명령 또는 파일: PowerShell에서 `$env:Path += ";$env:LOCALAPPDATA\Programs\nodejs"` 후 `npm test` / `npm run validate` / `npm run dev` / `npm run build`. 사용자가 새로 여는 터미널에는 사용자 PATH가 이미 적용되어 있다.

## 인계

- 다음 단계 또는 워크플로우: wf-implement 계속 — M1 사이클 TASK-10부터 구현
- 시작 조건: 충족 — 기준선 v1 승인, M0 완료, M1 계획 수립 완료. TASK-10~14 구현이 원격 `f8668ad`까지 push됨(작업 트리 청결)
- 입력 문서와 기준선: [REQ-ygj-remake](../../requirements.md) v1, [DESIGN-ygj-remake](../../design.md) v1, [PLAN-ygj-remake](../../plan.md), [결정 등록부](../../decisions.md)
- 완료된 항목: M1 계획 수립, 계획 트리 생성, TASK-10~14. 검증 VER-06 충족, VER-07 단위 테스트 충족
- 미완료 항목: TASK-15~20 구현, VER-05·VER-08 검증
- 차단 요인: 없음
- 다음 행동: TASK-15(커맨드 적용)를 선행 테스트(이동 후 행동 순서 강제, 행동 완료 유닛의 재행동 거부, 사거리·방향 밖 공격 거부, 격파 시 유닛 제거, 반격 없음)부터 작성해 Red를 확인한 뒤 `applyCommand(ctx, state, cmd, rng) → BattleEvent[]`를 구현한다
- 재개 프롬프트: 작업 20260817-m1-battle-prototype 재개 — docs/work/20260817-m1-battle-prototype/work-log.md의 인계 절을 읽고 "다음 행동"부터 진행하라.
