import type { BattleContext, BattleState } from "./state";

/**
 * 페이즈 교대와 승패 판정([상세 스펙 §1.1], DES-01 → FR-02).
 * 턴 시작의 거점 회복·상태이상 판정·이벤트 트리거는 해당 기능이 들어오는 M2에서 여기에 붙는다.
 */

export type Outcome = "victory" | "defeat";

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
