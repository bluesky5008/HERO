import type { Pos } from "../data/schemas";
import type { Rng } from "../rng";
import { applyCommand, inAttackRange, type Command } from "./commands";
import type { BattleEvent } from "./events";
import { reachableTiles } from "./movement";
import type { BattleContext, BattleState, Unit } from "./state";
import { outcome } from "./turn";

/**
 * 1단계 적 AI([전체 설계 §3.4], DES-01 → FR-11).
 * 가장 가까운 상대에게 접근해 공격하고, 사거리에 닿지 않으면 이동만 한다.
 * 프로필(`aggressive`·`defensive`…)과 가중치 평가는 M2 범위다([상세 스펙 §5]).
 */

/** 이동은 4방향이므로 접근 거리는 걸음 수(맨해튼)로 잰다. 공격 사거리와는 다른 척도다. */
const steps = ([ax, ay]: Pos, [bx, by]: Pos): number => Math.abs(ax - bx) + Math.abs(ay - by);

/** 가까운 순, 같으면 무장 ID 순. 순서가 흔들리면 같은 상황이 다른 수를 낸다(NFR-01). */
function nearestFirst(unit: Unit, opponents: Unit[]): Unit[] {
  return [...opponents].sort(
    (a, b) =>
      steps(unit.pos, a.pos) - steps(unit.pos, b.pos) ||
      a.officerId.localeCompare(b.officerId),
  );
}

const samePos = ([ax, ay]: Pos, [bx, by]: Pos): boolean => ax === bx && ay === by;

/**
 * 부대 하나가 이번 차례에 낼 커맨드 열.
 * 마지막 커맨드는 반드시 행동을 마치므로(공격 또는 대기) 페이즈가 반드시 끝난다.
 */
export function planUnitTurn(ctx: BattleContext, state: BattleState, unit: Unit): Command[] {
  const wait: Command = { type: "wait", officerId: unit.officerId };
  const targets = nearestFirst(
    unit,
    state.units.filter((other) => other.side !== unit.side),
  );
  if (targets.length === 0) return [wait];

  const tiles = unit.moved ? [unit.pos] : reachableTiles(ctx, state, unit);

  // 가까운 상대부터, 그 상대를 칠 수 있는 자리 중 가장 적게 움직이는 칸을 찾는다.
  for (const target of targets) {
    const spot = tiles
      .filter((tile) => inAttackRange(ctx, unit, target, tile))
      .sort((a, b) => steps(unit.pos, a) - steps(unit.pos, b))[0];

    if (!spot) continue;

    const attack: Command = { type: "attack", officerId: unit.officerId, targetId: target.officerId };
    return samePos(spot, unit.pos)
      ? [attack]
      : [{ type: "move", officerId: unit.officerId, to: spot }, attack];
  }

  // 아무도 칠 수 없으면 가장 가까운 상대 쪽으로 붙는다.
  const goal = targets[0]!;
  const approach = [...tiles].sort(
    (a, b) => steps(a, goal.pos) - steps(b, goal.pos) || steps(unit.pos, a) - steps(unit.pos, b),
  )[0];

  return !approach || samePos(approach, unit.pos)
    ? [wait]
    : [{ type: "move", officerId: unit.officerId, to: approach }, wait];
}

/**
 * 현재 페이즈 진영의 부대를 모두 움직인다.
 * 움직일 부대 목록을 먼저 고정하므로 어떤 배치에서도 유한하게 끝난다 — 무한 루프가 없다.
 */
export function runAiPhase(ctx: BattleContext, state: BattleState, rng: Rng): BattleEvent[] {
  const actors = state.units
    .filter((unit) => unit.side === state.phase && !unit.acted)
    .map((unit) => unit.officerId);

  const events: BattleEvent[] = [];
  for (const officerId of actors) {
    // 승패가 갈리면 남은 부대는 움직이지 않는다 — 결과가 난 뒤의 공격은 화면에 나올 자리가 없다.
    if (outcome(ctx, state)) break;

    const unit = state.units.find((candidate) => candidate.officerId === officerId);
    if (!unit || unit.acted) continue;

    for (const cmd of planUnitTurn(ctx, state, unit)) {
      events.push(...applyCommand(ctx, state, cmd, rng));
    }
  }
  return events;
}
