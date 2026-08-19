import type { Pos, Tactic } from "../data/schemas";
import type { Rng } from "../rng";
import { applyCommand, inAttackRange, type Command } from "./commands";
import { damageRange } from "./damage";
import type { BattleEvent } from "./events";
import { reachableTiles } from "./movement";
import { classOf, officerOf, terrainAt, type BattleContext, type BattleState, type Unit } from "./state";
import { expectedTacticValue, tacticTargetRejection } from "./tactics";
import { outcome } from "./turn";

/**
 * 적 AI([상세 스펙 §5], DES-01 → FR-11, AC-12).
 *
 * 프로필이 무엇을 하려는지 정하고, `aggressive`는 후보를 전탐색해 가중치로 고른다(§5.2).
 * 가중치 `W1~W6`은 전부 `combat-config.json`에 있어 난이도 프리셋이 데이터 교체로 끝난다(NFR-06).
 *
 * 같은 상황이 언제나 같은 수를 내야 하므로(NFR-01) 점수가 같으면 무장 ID와 좌표로 순서를 고정한다.
 */

/** 이동은 4방향이므로 접근 거리는 걸음 수(맨해튼)로 잰다. 공격 사거리와는 다른 척도다. */
const steps = ([ax, ay]: Pos, [bx, by]: Pos): number => Math.abs(ax - bx) + Math.abs(ay - by);

const samePos = ([ax, ay]: Pos, [bx, by]: Pos): boolean => ax === bx && ay === by;

const opponentsOf = (state: BattleState, unit: Unit): Unit[] =>
  state.units.filter((other) => other.side !== unit.side);

const alliesOf = (state: BattleState, unit: Unit): Unit[] =>
  state.units.filter((other) => other.side === unit.side && other !== unit);

/** 그 자리에 섰을 때 어느 부대가 이번 후보의 대상이 되는가 — 점수와 함께 실행할 커맨드를 들고 다닌다. */
interface Candidate {
  score: number;
  commands: Command[];
  /** 동점일 때 순서를 고정하기 위한 키 */
  key: string;
}

/** 후보 하나의 점수([상세 스펙 §5.2]). 공격이 없는 후보는 지형·접근 항만 남는다. */
function scoreAt(
  ctx: BattleContext,
  state: BattleState,
  unit: Unit,
  tile: Pos,
  value: number,
  target: Unit | null,
): number {
  const weights = ctx.data.combatConfig.ai;
  const opponents = opponentsOf(state, unit);

  const finish = target && value >= target.hp ? 1 : 0;
  const threat = target ? officerOf(ctx, target).war + classOf(ctx, target).attackMod : 0;
  // 반격이 기본이 아니므로 "다음 턴에 맞을 위험"을 인접한 상대 수로 대신 잰다(§5.2).
  const risk = opponents.filter((other) => steps(tile, other.pos) <= 1).length;
  const terrain = terrainAt(ctx, tile)?.defenseBonus ?? 0;

  const nearest = opponents.reduce(
    (best, other) => Math.min(best, steps(tile, other.pos)),
    Number.POSITIVE_INFINITY,
  );
  const approach = Number.isFinite(nearest) ? -nearest : 0;

  return (
    value * weights.damage +
    finish * weights.finish +
    threat * weights.threat -
    risk * weights.risk +
    terrain * weights.terrain +
    approach * weights.approach
  );
}

/** 이동이 필요하면 이동 커맨드를 앞에 붙인다. */
const withMove = (unit: Unit, tile: Pos, action: Command): Command[] =>
  samePos(tile, unit.pos) ? [action] : [{ type: "move", officerId: unit.officerId, to: tile }, action];

/** 이 부대가 지금 쓸 수 있는 책략만 추린다 — 후보가 폭발하지 않게 미리 자른다. */
function affordableTactics(ctx: BattleContext, unit: Unit): Tactic[] {
  return classOf(ctx, unit)
    .tactics.map((id) => ctx.data.tactics.find((tactic) => tactic.id === id))
    .filter((tactic): tactic is Tactic => !!tactic && tactic.cost <= unit.mp);
}

/**
 * 모든 후보(이동 가능 타일 × (공격 타깃 ∪ 책략 타깃 ∪ 없음))를 평가해 가장 높은 것을 고른다.
 * `tiles`를 좁혀 주면 프로필별 제약(움직이지 않는 `guard` 등)을 그대로 표현할 수 있다.
 */
function bestPlan(
  ctx: BattleContext,
  state: BattleState,
  unit: Unit,
  tiles: Pos[],
  healOnly = false,
): Command[] {
  const opponents = opponentsOf(state, unit);
  const tactics = affordableTactics(ctx, unit);
  let best: Candidate | undefined;

  const consider = (candidate: Candidate): void => {
    const winner =
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.key < best.key);
    if (winner) best = candidate;
  };

  for (const tile of tiles) {
    for (const target of healOnly ? [] : opponents) {
      if (!inAttackRange(ctx, unit, target, tile)) continue;

      const [min, max] = damageRange(ctx, unit, target);
      const value = (min + max) / 2;
      consider({
        score: scoreAt(ctx, state, unit, tile, value, target),
        commands: withMove(unit, tile, {
          type: "attack",
          officerId: unit.officerId,
          targetId: target.officerId,
        }),
        key: `a:${target.officerId}:${tile}`,
      });
    }

    for (const tactic of tactics) {
      const heals = tactic.effect.startsWith("heal");
      if (healOnly && !heals) continue;

      // 회복은 아군에게, 나머지는 상대에게 건다.
      const targets = heals ? alliesOf(state, unit) : opponents;

      for (const target of targets) {
        if (tacticTargetRejection(ctx, state, unit, tactic, target.pos, tile)) continue;

        const value = expectedTacticValue(ctx, state, unit, tactic, target);
        if (value <= 0) continue;

        consider({
          score: scoreAt(ctx, state, unit, tile, value, tactic.effect === "damage" ? target : null),
          commands: withMove(unit, tile, {
            type: "useTactic",
            officerId: unit.officerId,
            tacticId: tactic.id,
            to: target.pos,
          }),
          key: `t:${tactic.id}:${target.officerId}:${tile}`,
        });
      }
    }

    // 아무것도 못 하는 자리 — 접근과 지형만으로 값을 매긴다.
    consider({
      score: scoreAt(ctx, state, unit, tile, 0, null),
      commands: withMove(unit, tile, { type: "wait", officerId: unit.officerId }),
      key: `w:${tile}`,
    });
  }

  return best ? best.commands : [{ type: "wait", officerId: unit.officerId }];
}

/** 상대에게서 가장 멀어지는 자리로 물러난다. 갈 곳이 없으면 제자리에서 기다린다. */
function retreat(state: BattleState, unit: Unit, tiles: Pos[]): Command[] {
  const opponents = opponentsOf(state, unit);
  const distance = (tile: Pos): number =>
    opponents.reduce((best, other) => Math.min(best, steps(tile, other.pos)), Number.POSITIVE_INFINITY);

  const spot = [...tiles].sort(
    (a, b) => distance(b) - distance(a) || steps(unit.pos, a) - steps(unit.pos, b),
  )[0];

  return !spot || samePos(spot, unit.pos)
    ? [{ type: "wait", officerId: unit.officerId }]
    : [{ type: "move", officerId: unit.officerId, to: spot }, { type: "wait", officerId: unit.officerId }];
}

/** 목표 지점에 가장 가까워지는 자리로 간다. */
function moveToward(unit: Unit, tiles: Pos[], goal: Pos): Command[] {
  const spot = [...tiles].sort(
    (a, b) => steps(a, goal) - steps(b, goal) || steps(unit.pos, a) - steps(unit.pos, b),
  )[0];

  return !spot || samePos(spot, unit.pos)
    ? [{ type: "wait", officerId: unit.officerId }]
    : [{ type: "move", officerId: unit.officerId, to: spot }, { type: "wait", officerId: unit.officerId }];
}

/**
 * 부대 하나가 이번 차례에 낼 커맨드 열.
 * 마지막 커맨드는 반드시 행동을 마치므로(공격·책략·대기) 페이즈가 반드시 끝난다.
 *
 * `defensive`의 각성은 상태 변화라 여기서 일어난다 — 한 번 깨어나면 되돌아가지 않는다([상세 스펙 §5.1]).
 */
export function planUnitTurn(ctx: BattleContext, state: BattleState, unit: Unit): Command[] {
  const wait: Command[] = [{ type: "wait", officerId: unit.officerId }];
  const config = ctx.data.combatConfig.ai;
  const opponents = opponentsOf(state, unit);
  if (opponents.length === 0) return wait;

  const tiles = unit.moved ? [unit.pos] : reachableTiles(ctx, state, unit);

  switch (unit.ai) {
    case "defensive": {
      const nearest = opponents.reduce((best, other) => Math.min(best, steps(unit.pos, other.pos)), Infinity);
      if (nearest > config.alertRange) return wait;

      unit.ai = "aggressive";
      return bestPlan(ctx, state, unit, tiles);
    }

    case "guard":
      // 자리를 지킨다 — 사거리 안의 상대만 친다([상세 스펙 §5.1]).
      return bestPlan(ctx, state, unit, [unit.pos]);

    case "flee": {
      const escape = unit.aiParams.escape;
      return escape ? moveToward(unit, tiles, escape) : retreat(state, unit, tiles);
    }

    case "support": {
      if (unit.hp < unit.hpMax * config.supportFleeRatio) return retreat(state, unit, tiles);

      const hurt = alliesOf(state, unit).some(
        (ally) => ally.hp < ally.hpMax * config.supportHealRatio,
      );
      // 다친 아군이 있으면 회복을 먼저 본다 — 회복 후보만 남기면 스코어링이 그대로 고른다.
      if (hurt) {
        // 회복 후보만 남겨 저울질한다 — 다친 아군이 있으면 공격보다 회복이 앞선다([상세 스펙 §5.1]).
        const healing = bestPlan(ctx, state, unit, tiles, true);
        if (healing.some((cmd) => cmd.type === "useTactic")) return healing;
      }
      return bestPlan(ctx, state, unit, tiles);
    }

    case "aggressive":
      return bestPlan(ctx, state, unit, tiles);
  }
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

/** 지금 이 부대가 노릴 만한 상대. 화면의 하이라이트가 AI와 같은 사거리 규칙을 쓰게 하려고 남겨 둔다. */
export function reachableTargets(ctx: BattleContext, state: BattleState, unit: Unit): Unit[] {
  return opponentsOf(state, unit).filter((target) => inAttackRange(ctx, unit, target));
}
