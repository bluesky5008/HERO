import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import { changeMorale, rollConfusion } from "./morale";
import { terrainAt, type BattleContext, type BattleState, type Unit } from "./state";

/**
 * 페이즈 교대·턴 시작 처리와 승패 판정([상세 스펙 §1.1], DES-01 → FR-02).
 */

export type Outcome = "victory" | "defeat";

/**
 * 거점 위 부대의 턴 시작 회복([상세 스펙 §1.7] — 턴 시작 ②).
 * 책략치의 자연 회복은 이 자리에서만 일어난다([상세 스펙 §1.5]).
 */
function recoverOnStronghold(ctx: BattleContext, unit: Unit): BattleEvent[] {
  if (!terrainAt(ctx, unit.pos)?.stronghold) return [];

  const { hpRatio, morale, mp } = ctx.data.combatConfig.strongholdRecovery;
  const healed = Math.min(Math.floor(unit.hpMax * hpRatio), unit.hpMax - unit.hp);
  unit.hp += healed;
  unit.mp = Math.min(unit.mp + mp, unit.mpMax);

  return [
    ...(healed > 0 ? [{ type: "healed" as const, officerId: unit.officerId, amount: healed }] : []),
    ...changeMorale(ctx, unit, morale),
  ];
}

/**
 * 차례를 받은 진영의 턴 시작 처리. 순서는 [상세 스펙 §1.1]의
 * ① 자동 저장 → ② 거점 회복 → ③ 자연 회복 아이템 → ④ 상태이상 판정 → ⑤ 턴 이벤트로 고정한다.
 * 단계를 나눠 두므로 뒤 작업(①은 M3, ③은 TASK-26, ⑤는 TASK-29)이 자리만 채우면 된다.
 * `endPhase` 다음과 전투 시작 직후에 부른다 — 이동·행동 기록이 초기화된 뒤여야 혼란이 그 턴을 소비한다.
 */
export function beginPhase(ctx: BattleContext, state: BattleState, rng: Rng): BattleEvent[] {
  const actors = state.units.filter((unit) => unit.side === state.phase);

  return [
    ...actors.flatMap((unit) => recoverOnStronghold(ctx, unit)),
    ...actors.flatMap((unit) => rollConfusion(ctx, unit, rng)),
  ];
}

/** 현재 페이즈 진영이 더 움직일 수 없으면 참. 부대가 하나도 없는 진영도 참이다(무한 대기 방지). */
export function isPhaseComplete(state: BattleState): boolean {
  return state.units.every((unit) => unit.side !== state.phase || unit.acted);
}

/**
 * 현재 페이즈를 끝내고 다음 진영에 차례를 넘긴다. 적 페이즈가 끝나면 턴이 오른다.
 * 행동 기록은 차례를 받는 진영의 것만 지운다 — 방금 움직인 진영의 부대는
 * 자기 차례가 돌아올 때까지 "행동을 마친" 모습으로 화면에 남아야 한다.
 */
export function endPhase(state: BattleState): void {
  state.phase = state.phase === "player" ? "enemy" : "player";
  if (state.phase === "player") state.turn += 1;

  for (const unit of state.units) {
    if (unit.side !== state.phase) continue;
    unit.moved = false;
    unit.acted = false;
  }
}

/**
 * 승패가 갈렸으면 그 결과, 아직이면 `null`.
 * 둘이 함께 성립하면 패배가 이긴다 — 필수 장수를 잃으면 게임 오버이므로([상세 스펙 §1.3])
 * 승리 연출이 그것을 덮어써서는 안 된다.
 */
export function outcome(ctx: BattleContext, state: BattleState): Outcome | null {
  const survivors = new Set(state.units.map((unit) => unit.officerId));

  if (ctx.stage.defeat.officerIds.some((officerId) => !survivors.has(officerId))) return "defeat";
  if (!state.units.some((unit) => unit.side === "enemy")) return "victory";

  return null;
}
