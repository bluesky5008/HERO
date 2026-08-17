import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import type { BattleContext, Unit } from "./state";

/**
 * 사기와 혼란([상세 스펙 §1.4], DES-01 → FR-05).
 * 사기는 실효 공격·방어에 직접 더해지는 항이므로([상세 스펙 §1.3]) 여기서 바뀐 값이 곧 전투력이다.
 * 임계값·확률·상한은 전부 `combat-config.json`에서 읽는다(NFR-06).
 */

/**
 * 사기를 `delta`만큼 옮기고 실제로 바뀌었으면 이벤트를 낸다. 0과 상한을 벗어나지 않는다.
 * 사기를 바꾸는 모든 경로(피격·거점 회복·책략·이벤트)가 이 함수를 지나므로
 * "임계값 이상으로 회복되면 혼란이 즉시 풀린다"는 규칙이 한 곳에만 있으면 된다.
 */
export function changeMorale(ctx: BattleContext, unit: Unit, delta: number): BattleEvent[] {
  const { moraleMax, confusion } = ctx.data.combatConfig;
  const from = unit.morale;

  unit.morale = Math.min(Math.max(from + delta, 0), moraleMax);
  if (unit.morale >= confusion.threshold) unit.confused = false;

  return unit.morale === from
    ? []
    : [{ type: "moraleChanged", officerId: unit.officerId, from, to: unit.morale }];
}

/**
 * 턴 시작의 혼란 판정([상세 스펙 §1.1]의 ④).
 *
 * 혼란에 빠진 부대는 그 턴의 이동·행동을 쓴 것으로 처리한다 — 제자리 대기가 기본 행동이고(§1.4),
 * 그래야 조작이 막힌 부대가 있어도 페이즈가 반드시 끝난다.
 *
 * 이미 혼란인 부대는 다시 판정하지 않고 그 턴을 잃는다. 사기가 낮아서가 아니라
 * 책략([TASK-24의 `confuse`](./tactics.ts))으로 걸린 혼란도 여기서 한 턴을 소비한다 —
 * 사기로만 판정하면 사기가 높은 대상에게 건 혼란이 아무 일도 하지 않은 채 조작만 막아 페이즈가 멈춘다.
 * 그 턴이 끝나면 [`endPhase`](./turn.ts)가 혼란을 푼다(§1.4의 "그 턴 조작 불가").
 */
export function rollConfusion(ctx: BattleContext, unit: Unit, rng: Rng): BattleEvent[] {
  const { threshold, chance } = ctx.data.combatConfig.confusion;
  const events: BattleEvent[] = [];

  if (!unit.confused) {
    if (unit.morale >= threshold) return [];
    if (rng.range(0, 1) >= chance) return [];

    unit.confused = true;
    events.push({ type: "confused", officerId: unit.officerId });
  }

  unit.moved = true;
  unit.acted = true;
  return events;
}
