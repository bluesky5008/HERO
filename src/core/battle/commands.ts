import type { Pos } from "../data/schemas";
import type { Rng } from "../rng";
import { physicalDamage } from "./damage";
import type { BattleEvent } from "./events";
import { attackExp, gainExp, grantDefeatExp } from "./experience";
import { changeMorale } from "./morale";
import { gridDistance, reachableTiles } from "./movement";
import { classOf, posKey, type BattleContext, type BattleState, type Unit } from "./state";
import { carriedItem, itemRejection, useItem } from "./items";
import { applyTactic, tacticRejection } from "./tactics";

/**
 * 커맨드 적용([상세 스펙 §1.1, §1.3], DES-01).
 * 모든 행동을 커맨드로 표현해 로그·리플레이·테스트가 같은 경로를 쓴다([전체 설계 §6.3]).
 * 상태 변경은 이 함수 안에서 완결된다 — 저장은 언제나 커맨드 사이에서만 일어나므로
 * `BattleState`는 항상 직렬화 가능한 일관 상태여야 한다([상세 스펙 §2.2], M3).
 */
export type Command =
  | { type: "move"; officerId: string; to: Pos }
  | { type: "attack"; officerId: string; targetId: string }
  | { type: "useTactic"; officerId: string; tacticId: string; to: Pos }
  | { type: "useItem"; officerId: string; itemId: string; to?: Pos }
  | { type: "investigate"; officerId: string }
  | { type: "wait"; officerId: string };

/**
 * 규칙을 어긴 커맨드. UI와 AI가 유효한 커맨드만 만들어야 하므로 여기까지 온 위반은 버그다 —
 * 조용히 무시하면 플레이어가 "왜 안 되는지" 알 수 없는 화면이 남는다.
 */
export class BattleCommandError extends Error {}

/**
 * 공격측 병과의 사거리 안에 대상이 있는가. 최소 사거리 안쪽(너무 가까움)도 밖으로 본다.
 * `from`을 주면 그 자리에 섰다고 가정한다 — AI가 이동 후보를 평가할 때 쓴다.
 */
export function inAttackRange(
  ctx: BattleContext,
  attacker: Unit,
  target: Unit,
  from: Pos = attacker.pos,
): boolean {
  const { min, max, directions } = classOf(ctx, attacker).attackRange;
  const distance = gridDistance(from, target.pos, directions);
  return distance >= min && distance <= max;
}

/**
 * 그 자리에서 공격이 닿는 맵 안의 칸들((y, x) 순).
 * UI의 공격 범위 하이라이트와 AI가 같은 사거리 규칙을 쓰게 하려고 여기 둔다.
 */
export function attackableTiles(ctx: BattleContext, unit: Unit, from: Pos = unit.pos): Pos[] {
  const { min, max, directions } = classOf(ctx, unit).attackRange;
  const { width, height } = ctx.stage.map;
  const tiles: Pos[] = [];

  for (let y = from[1] - max; y <= from[1] + max; y += 1) {
    for (let x = from[0] - max; x <= from[0] + max; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;

      const distance = gridDistance(from, [x, y], directions);
      if (distance >= min && distance <= max) tiles.push([x, y]);
    }
  }
  return tiles;
}

/**
 * 피격 직후의 반격([상세 스펙 §1.1]). 기본은 반격 없음이고 `counterAttack` 플래그를 가진 병과만,
 * 상대가 자기 사거리 안에 있을 때, 한 번 되친다.
 *
 * 공격 한 번이 데미지·격파 판정을 두 번 낳는 지점이라 순서를 여기 한 곳에 고정한다 —
 * 반격은 방어측이 살아남았을 때만 일어나고, 반격으로 원 공격자가 쓰러지면 그 자리에서 전장을 떠난다.
 */
function counterAttack(
  ctx: BattleContext,
  state: BattleState,
  defender: Unit,
  attacker: Unit,
  rng: Rng,
): BattleEvent[] {
  if (!classOf(ctx, defender).flags.includes("counterAttack")) return [];
  if (!inAttackRange(ctx, defender, attacker)) return [];

  const damage = physicalDamage(ctx, defender, attacker, rng);
  attacker.hp -= damage;

  const events: BattleEvent[] = [
    { type: "countered", attackerId: defender.officerId, defenderId: attacker.officerId, damage },
  ];
  events.push(...gainExp(ctx, defender, attackExp(ctx, damage)));

  if (attacker.hp <= 0) {
    state.units.splice(state.units.indexOf(attacker), 1);
    events.push({ type: "defeated", officerId: attacker.officerId });
    events.push(...grantDefeatExp(ctx, state, defender));
    return events;
  }

  events.push(...changeMorale(ctx, attacker, -ctx.data.combatConfig.moraleLossOnHit));
  return events;
}

function unitOf(state: BattleState, officerId: string): Unit {
  const unit = state.units.find((candidate) => candidate.officerId === officerId);
  if (!unit) throw new BattleCommandError(`부대 '${officerId}'가 전장에 없다`);
  return unit;
}

/**
 * 커맨드 하나를 적용하고 일어난 일을 돌려준다.
 * 규칙 검사를 모두 통과한 뒤에만 상태를 건드리므로, 거부된 커맨드는 상태를 바꾸지 않는다.
 */
export function applyCommand(
  ctx: BattleContext,
  state: BattleState,
  cmd: Command,
  rng: Rng,
): BattleEvent[] {
  const unit = unitOf(state, cmd.officerId);
  if (unit.side !== state.phase) {
    throw new BattleCommandError(`${unit.officerId}는 지금 ${state.phase} 페이즈에 움직일 수 없다`);
  }
  // 혼란은 그 턴의 조작 자체를 막는다([상세 스펙 §1.4]). `acted`보다 먼저 봐서 이유가 화면에 그대로 뜨게 한다.
  if (unit.confused) {
    throw new BattleCommandError(`${unit.officerId}는 혼란에 빠져 이번 턴 움직일 수 없다`);
  }
  // 행동을 마치면 이동도 끝난다 — 순서는 "이동 → 행동" 고정이다([상세 스펙 §1.1]).
  if (unit.acted) throw new BattleCommandError(`${unit.officerId}는 이번 페이즈의 행동을 마쳤다`);

  switch (cmd.type) {
    case "move": {
      if (unit.moved) {
        throw new BattleCommandError(`${unit.officerId}는 이번 페이즈에 이미 이동했다`);
      }
      const [x, y] = cmd.to;
      if (!reachableTiles(ctx, state, unit).some(([tx, ty]) => tx === x && ty === y)) {
        throw new BattleCommandError(`${unit.officerId}는 [${x}, ${y}]까지 이동할 수 없다`);
      }

      const from = unit.pos;
      unit.pos = cmd.to;
      unit.moved = true;
      return [{ type: "moved", officerId: unit.officerId, from, to: cmd.to }];
    }

    case "attack": {
      const target = unitOf(state, cmd.targetId);
      if (target.side === unit.side) {
        throw new BattleCommandError(`아군 ${target.officerId}는 공격할 수 없다`);
      }
      if (!inAttackRange(ctx, unit, target)) {
        throw new BattleCommandError(`${target.officerId}는 ${unit.officerId}의 사거리 밖이다`);
      }

      const damage = physicalDamage(ctx, unit, target, rng);
      target.hp -= damage;
      unit.acted = true;

      const events: BattleEvent[] = [
        { type: "attacked", attackerId: unit.officerId, defenderId: target.officerId, damage },
      ];
      events.push(...gainExp(ctx, unit, attackExp(ctx, damage)));

      if (target.hp <= 0) {
        state.units.splice(state.units.indexOf(target), 1);
        events.push({ type: "defeated", officerId: target.officerId });
        events.push(...grantDefeatExp(ctx, state, unit));
        // 격파된 부대는 반격하지 않는다 — 전장을 떠난 뒤다.
        return events;
      }

      // 살아남은 부대만 사기를 잃는다 — 전장을 떠난 부대의 사기는 남는 상태가 아니다([상세 스펙 §1.4]).
      events.push(...changeMorale(ctx, target, -ctx.data.combatConfig.moraleLossOnHit));
      events.push(...counterAttack(ctx, state, target, unit, rng));
      return events;
    }

    case "useTactic": {
      const tactic = ctx.data.tactics.find((candidate) => candidate.id === cmd.tacticId);
      if (!tactic) throw new BattleCommandError(`책략 '${cmd.tacticId}'가 데이터에 없다`);

      // 규칙 판정은 전부 `tactics.ts`가 한다 — 화면도 같은 함수로 메뉴를 걸러낸다(TASK-32).
      const rejection = tacticRejection(ctx, state, unit, tactic, cmd.to);
      if (rejection) throw new BattleCommandError(rejection);

      const events = applyTactic(ctx, state, unit, tactic, cmd.to, rng);
      unit.acted = true;
      return events;
    }

    case "useItem": {
      const item = carriedItem(ctx, unit, cmd.itemId);
      if (!item) throw new BattleCommandError(`${unit.officerId}는 '${cmd.itemId}'를 지니고 있지 않다`);

      const rejection = itemRejection(ctx, state, unit, item, cmd.to);
      if (rejection) throw new BattleCommandError(rejection);

      const events = useItem(ctx, state, unit, item, cmd.to, rng);
      unit.acted = true;
      return events;
    }

    case "investigate": {
      // 보물은 선 자리에서만, 그리고 한 번만 얻는다([상세 스펙 §1.7]).
      const here = posKey(unit.pos);
      const treasure = ctx.stage.treasures.find((candidate) => posKey(candidate.pos) === here);
      if (!treasure || state.treasuresTaken.includes(here)) {
        throw new BattleCommandError(`[${unit.pos}]에는 조사할 것이 없다`);
      }
      if (unit.items.length >= ctx.data.combatConfig.itemSlots) {
        throw new BattleCommandError(
          `${unit.officerId}의 소지품이 가득 찼다 (${ctx.data.combatConfig.itemSlots}개)`,
        );
      }

      unit.items.push(treasure.itemId);
      state.treasuresTaken.push(here);
      unit.acted = true;
      return [
        {
          type: "treasureFound",
          officerId: unit.officerId,
          itemId: treasure.itemId,
          pos: treasure.pos,
        },
      ];
    }

    case "wait": {
      unit.acted = true;
      return [];
    }
  }
}
