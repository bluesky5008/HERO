import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import { runEvents } from "../campaign/eventRunner";
import { regenAmount } from "./items";
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

/** 자연 회복 아이템의 턴 시작 회복([상세 스펙 §1.1] — 턴 시작 ③). */
function recoverFromItems(ctx: BattleContext, unit: Unit): BattleEvent[] {
  const healed = Math.min(regenAmount(ctx, unit), unit.hpMax - unit.hp);
  if (healed <= 0) return [];

  unit.hp += healed;
  return [{ type: "healed", officerId: unit.officerId, amount: healed }];
}

/**
 * 동적 날씨의 전이([상세 스펙 §1.7]). 날씨는 진영이 아니라 전장 전체의 것이므로
 * 턴이 새로 시작할 때(플레이어 페이즈) 한 번만 판정한다 — 페이즈마다 바꾸면 한 턴에 두 번 바뀐다.
 */
function rollWeather(ctx: BattleContext, state: BattleState, rng: Rng): BattleEvent[] {
  const weather = ctx.stage.weather;
  if (typeof weather === "string" || state.phase !== "player") return [];

  if (state.weatherTurnsLeft > 0) {
    state.weatherTurnsLeft -= 1;
    if (state.weatherTurnsLeft > 0) return [];

    state.weather = "clear";
    return [{ type: "weatherChanged", to: "clear" }];
  }

  if (rng.range(0, 1) >= weather.rainChance) return [];

  state.weather = "rain";
  state.weatherTurnsLeft = weather.rainDuration;
  return [{ type: "weatherChanged", to: "rain" }];
}

/**
 * 차례를 받은 진영의 턴 시작 처리. 순서는 [상세 스펙 §1.1]의
 * ① 자동 저장 → ② 거점 회복 → ③ 자연 회복 아이템 → ④ 상태이상 판정 → ⑤ 턴 이벤트로 고정한다.
 * 단계를 나눠 두므로 뒤 작업(①은 M3, ⑤는 TASK-29)이 자리만 채우면 된다.
 * `endPhase` 다음과 전투 시작 직후에 부른다 — 이동·행동 기록이 초기화된 뒤여야 혼란이 그 턴을 소비한다.
 */
export function beginPhase(ctx: BattleContext, state: BattleState, rng: Rng): BattleEvent[] {
  const actors = state.units.filter((unit) => unit.side === state.phase);

  return [
    ...rollWeather(ctx, state, rng),
    ...actors.flatMap((unit) => recoverOnStronghold(ctx, unit)),
    ...actors.flatMap((unit) => recoverFromItems(ctx, unit)),
    ...actors.flatMap((unit) => rollConfusion(ctx, unit, rng)),
    // ⑤ 턴 이벤트. 턴이 새로 시작할 때(플레이어 페이즈)만 재는 것은 날씨와 같은 이유다.
    ...(state.phase === "player" ? runEvents(ctx, state, "turnStart", [], rng) : []),
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
 * 반대로 혼란은 차례를 마친 진영의 것을 지운다(아래 참조).
 */
export function endPhase(ctx: BattleContext, state: BattleState, rng: Rng): BattleEvent[] {
  // 턴 경계 이벤트는 턴 카운터가 오르기 전에 재야 "5턴 종료"가 5턴에 발동한다([상세 스펙 §3.4]).
  const events = state.phase === "enemy" ? runEvents(ctx, state, "turnEnd", [], rng) : [];

  // 혼란은 한 턴짜리다([상세 스펙 §1.4]) — 차례를 마친 진영의 혼란을 여기서 푼다.
  // 사기가 여전히 낮으면 다음 턴 시작 판정에서 다시 걸리고, 책략으로 걸린 혼란은 한 턴만 유효하다.
  for (const unit of state.units) {
    if (unit.side === state.phase) unit.confused = false;
  }

  state.phase = state.phase === "player" ? "enemy" : "player";
  if (state.phase === "player") state.turn += 1;

  for (const unit of state.units) {
    if (unit.side !== state.phase) continue;
    unit.moved = false;
    unit.acted = false;
  }

  return events;
}

/**
 * 승패가 갈렸으면 그 결과, 아직이면 `null`.
 * 둘이 함께 성립하면 패배가 이긴다 — 필수 장수를 잃으면 게임 오버이므로([상세 스펙 §1.3])
 * 승리 연출이 그것을 덮어써서는 안 된다.
 */
export function outcome(ctx: BattleContext, state: BattleState): Outcome | null {
  // 이벤트가 정한 승패는 조건 판정보다 앞선다([상세 스펙 §3.3]의 `endBattle`).
  if (state.forcedOutcome) return state.forcedOutcome;

  const survivors = new Set(state.units.map((unit) => unit.officerId));

  if (ctx.stage.defeat.officerIds.some((officerId) => !survivors.has(officerId))) return "defeat";
  if (!state.units.some((unit) => unit.side === "enemy")) return "victory";

  return null;
}
