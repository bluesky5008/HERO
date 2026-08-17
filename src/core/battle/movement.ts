import type { Pos, Terrain, UnitClass } from "../data/schemas";
import { classOf, terrainAt, type BattleContext, type BattleState, type Unit } from "./state";

/**
 * 이동 범위 산출([상세 스펙 §1.2], DES-01).
 * 지형 코스트 합이 이동력 이하인 칸을 다익스트라로 모은다.
 */

/** 이동은 상하좌우 4방향이다(원작 동일). 공격 방향은 병과 데이터가 따로 정한다. */
const STEPS: readonly Pos[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const key = ([x, y]: Pos): string => `${x},${y}`;

/**
 * 한 칸에 들어가는 데 드는 코스트. `null`이면 진입 불가.
 *
 * 지형표(`terrain.moveCost`)가 계열별 기본값이고 병과의 `movementRules`가 그 위를 덮는다.
 * 두 값이 어긋날 때 병과 쪽을 택하는 이유는 지형표가 계열 전체에 걸리는 넓은 규칙이고
 * 이동 규칙은 특정 병과의 예외이기 때문이다 — 좁은 규칙이 넓은 규칙을 이겨야 예외를 표현할 수 있다.
 */
function stepCost(cls: UnitClass, terrain: Terrain | undefined): number | null {
  // 정의되지 않은 지형으로는 들어가지 않는다. 앱을 죽이는 대신 길을 막고, validate가 별도로 보고한다(NFR-03).
  if (!terrain) return null;
  if (cls.movementRules.forbidden.includes(terrain.id)) return null;

  const base = terrain.moveCost[cls.family];
  if (base === "blocked") return null;

  return cls.movementRules.halved.includes(terrain.id) ? base * 2 : base;
}

/**
 * 부대가 이번에 이동해 설 수 있는 칸의 목록(제자리 포함).
 * 적 부대가 선 칸은 지나갈 수 없고, 아군이 선 칸은 지나갈 수는 있으나 멈출 수 없다.
 */
export function reachableTiles(ctx: BattleContext, state: BattleState, unit: Unit): Pos[] {
  const cls = classOf(ctx, unit);
  const { width, height } = ctx.stage.map;

  const enemies = new Set(
    state.units.filter((other) => other.side !== unit.side).map((other) => key(other.pos)),
  );
  const allies = new Set(
    state.units
      .filter((other) => other.side === unit.side && other !== unit)
      .map((other) => key(other.pos)),
  );

  const best = new Map<string, number>([[key(unit.pos), 0]]);
  const frontier: { pos: Pos; cost: number }[] = [{ pos: unit.pos, cost: 0 }];
  const reached: Pos[] = [];

  while (frontier.length > 0) {
    // 이동 범위는 기껏해야 수십 칸이라 우선순위 큐 없이 최솟값을 훑는 편이 짧고 충분하다.
    let pick = 0;
    frontier.forEach((entry, index) => {
      if (entry.cost < frontier[pick]!.cost) pick = index;
    });
    const { pos, cost } = frontier.splice(pick, 1)[0]!;

    if (cost > (best.get(key(pos)) ?? Infinity)) continue;
    if (!allies.has(key(pos))) reached.push(pos);

    for (const [dx, dy] of STEPS) {
      const next: Pos = [pos[0] + dx, pos[1] + dy];
      if (next[0] < 0 || next[1] < 0 || next[0] >= width || next[1] >= height) continue;
      if (enemies.has(key(next))) continue;

      const step = stepCost(cls, terrainAt(ctx, next));
      if (step === null) continue;

      const total = cost + step;
      if (total > cls.movement || total >= (best.get(key(next)) ?? Infinity)) continue;

      best.set(key(next), total);
      frontier.push({ pos: next, cost: total });
    }
  }

  // 호출 순서에 따라 결과 순서가 흔들리지 않게 고정한다 — AI 선택도 결정론이어야 한다(NFR-01).
  return reached.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
