import type { Pos, Tactic } from "../data/schemas";
import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import { attackExp, gainExp, grantDefeatExp } from "./experience";
import { changeMorale } from "./morale";
import { gridDistance } from "./movement";
import {
  classOf,
  officerOf,
  terrainAt,
  type BattleContext,
  type BattleState,
  type Unit,
} from "./state";

/**
 * 책략 실행([상세 스펙 §1.5], DES-01 → FR-04, AC-03).
 *
 * 지형·날씨 게이트는 이 파일의 분기가 아니라 `tactics.json`의 필드가 정한다
 * (`terrainRequired`·`terrainBonus`·`weatherForbidden`·`weatherBonus` — [전체 설계 §4.4]).
 * 새 책략이 코드 수정 없이 데이터만으로 들어와야 하기 때문이다(FR-13).
 * 명중·피해 상수는 전부 `combat-config.json`에서 읽는다(NFR-06).
 */

/** 대상 칸을 중심으로 실제로 효과가 닿는 칸들. `cross5`는 상하좌우를 더한 십자다. */
function areaTiles(tactic: Tactic, [x, y]: Pos): Pos[] {
  if (tactic.area === "single") return [[x, y]];
  return [
    [x, y],
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];
}

/** 책략 데이터를 ID로 찾는다. 없으면 데이터가 도중에 바뀐 것이므로 조용히 넘기지 않는다. */
export function tacticOf(ctx: BattleContext, tacticId: string): Tactic {
  const tactic = ctx.data.tactics.find((candidate) => candidate.id === tacticId);
  if (!tactic) throw new Error(`책략 '${tacticId}'가 데이터에 없다`);
  return tactic;
}

/**
 * 쓸 수 없는 이유. 쓸 수 있으면 `null`.
 * 커맨드 계층이 이 문자열을 그대로 오류로 던지고, 화면은 같은 판정으로 메뉴를 걸러낸다(TASK-32) —
 * "고를 수 있는 것"과 "실제로 통과하는 것"이 갈라지지 않게 판정을 한 곳에 둔다.
 */
export function tacticRejection(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  to: Pos,
): string | null {
  if (!classOf(ctx, caster).tactics.includes(tactic.id)) {
    return `${caster.officerId}의 병과는 '${tactic.id}'를 쓸 수 없다`;
  }
  if (caster.mp < tactic.cost) {
    return `${caster.officerId}의 책략치가 모자란다 (${caster.mp} < ${tactic.cost})`;
  }
  return tacticTargetRejection(ctx, state, caster, tactic, to);
}

/**
 * 대상 자리가 규칙에 맞는가 — 맵 안, 사거리 안, 날씨·지형 게이트 통과.
 * 시전자 조건(병과·책략치)은 보지 않으므로 소모품 아이템도 이 판정만 받는다([TASK-26](./items.ts)).
 */
export function tacticTargetRejection(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  to: Pos,
  from: Pos = caster.pos,
): string | null {
  const [x, y] = to;
  if (x < 0 || y < 0 || x >= ctx.stage.map.width || y >= ctx.stage.map.height) {
    return `[${x}, ${y}]는 맵 밖이다`;
  }
  if (gridDistance(from, to, classOf(ctx, caster).attackRange.directions) > tactic.range) {
    return `[${x}, ${y}]는 '${tactic.id}'의 사거리 밖이다`;
  }

  if (tactic.weatherForbidden.includes(state.weather)) {
    return `'${tactic.id}'는 ${state.weather} 날씨에 쓸 수 없다`;
  }

  const terrain = terrainAt(ctx, to);
  if (tactic.terrainRequired && !tactic.terrainRequired.includes(terrain?.id ?? "")) {
    return `'${tactic.id}'는 ${tactic.terrainRequired.join("·")} 위에만 쓸 수 있다`;
  }

  return null;
}

/** 회복계는 판정 없이 언제나 성공한다([상세 스펙 §1.5]). */
const alwaysHits = (tactic: Tactic): boolean => tactic.effect.startsWith("heal");

/** 명중률(백분율). 지력차가 클수록 잘 맞고, 설정한 상하한을 벗어나지 않는다. */
function hitChance(ctx: BattleContext, caster: Unit, target: Unit): number {
  const { hitBase, hitMin, hitMax } = ctx.data.combatConfig.tactic;
  const difference = officerOf(ctx, caster).int - officerOf(ctx, target).int;
  return Math.min(Math.max(hitBase + difference, hitMin), hitMax);
}

/** 지형·날씨 보정의 곱. 표에 없는 지형·날씨는 배수 1이다. */
function environmentMultiplier(ctx: BattleContext, tactic: Tactic, state: BattleState, to: Pos) {
  const terrainId = terrainAt(ctx, to)?.id ?? "";
  return (tactic.terrainBonus[terrainId] ?? 1) * (tactic.weatherBonus[state.weather] ?? 1);
}

/** 책략 한 번이 깎는 병력. 남은 병력을 넘지 않고 최소 데미지 아래로도 내려가지 않는다. */
function tacticDamage(
  ctx: BattleContext,
  caster: Unit,
  target: Unit,
  tactic: Tactic,
  state: BattleState,
  rng: Pick<Rng, "range">,
): number {
  const config = ctx.data.combatConfig;
  const difference = officerOf(ctx, caster).int - officerOf(ctx, target).int;

  const raw =
    tactic.baseDamage *
    (1 + difference / config.tactic.damageIntDivisor) *
    environmentMultiplier(ctx, tactic, state, target.pos);
  const rolled = Math.round(raw * rng.range(config.damageJitter.min, config.damageJitter.max));

  return Math.min(Math.max(rolled, config.minDamage), target.hp);
}

/** 회복량. 피해와 달리 지력차로 늘지 않는다 — 규칙이 정한 것은 피해 공식뿐이다([상세 스펙 §1.5]). */
const healAmount = (tactic: Tactic, limit: number): number =>
  Math.min(Math.round(tactic.baseDamage), limit);

/**
 * 대상 하나에 효과를 적용하고 얻은 성과(피해량 또는 회복량)를 함께 돌려준다.
 * 성과는 책략 성공 경험치의 근거가 된다([상세 스펙 §1.6]의 "책략 성공·회복량 비례").
 */
function applyToUnit(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  target: Unit,
  rng: Rng,
): { events: BattleEvent[]; amount: number } {
  // 거점 위 부대에게는 지정한 효과가 통하지 않는다([상세 스펙 §1.5]).
  if (
    ctx.data.combatConfig.tactic.strongholdBlocks.includes(tactic.effect) &&
    terrainAt(ctx, target.pos)?.stronghold
  ) {
    return { events: [], amount: 0 };
  }

  if (!alwaysHits(tactic) && rng.range(0, 100) >= hitChance(ctx, caster, target)) {
    return {
      events: [{ type: "tacticMissed", officerId: caster.officerId, targetId: target.officerId }],
      amount: 0,
    };
  }

  switch (tactic.effect) {
    case "damage": {
      const damage = tacticDamage(ctx, caster, target, tactic, state, rng);
      target.hp -= damage;

      const events: BattleEvent[] = [
        { type: "attacked", attackerId: caster.officerId, defenderId: target.officerId, damage },
      ];
      if (target.hp <= 0) {
        state.units.splice(state.units.indexOf(target), 1);
        events.push({ type: "defeated", officerId: target.officerId });
        events.push(...grantDefeatExp(ctx, state, caster));
      }
      return { events, amount: damage };
    }

    case "moraleDown":
      return { events: changeMorale(ctx, target, -tactic.baseDamage), amount: tactic.baseDamage };

    case "confuse": {
      target.confused = true;
      target.moved = true;
      target.acted = true;
      return { events: [{ type: "confused", officerId: target.officerId }], amount: 0 };
    }

    case "healHp":
    case "healMorale":
    case "healBoth": {
      const events: BattleEvent[] = [];
      let amount = 0;

      if (tactic.effect !== "healMorale") {
        const healed = healAmount(tactic, target.hpMax - target.hp);
        target.hp += healed;
        amount += healed;
        if (healed > 0) events.push({ type: "healed", officerId: target.officerId, amount: healed });
      }
      if (tactic.effect !== "healHp") {
        const before = target.morale;
        events.push(...changeMorale(ctx, target, tactic.baseDamage));
        amount += target.morale - before;
      }
      return { events, amount };
    }
  }
}

/**
 * 난수를 쓰지 않고 재는 기대 성과 — 명중률 × 평균 피해(회복은 회복량).
 * AI가 후보를 저울질할 때 실제 판정과 같은 공식을 쓰게 하려고 여기 둔다([상세 스펙 §5.2]).
 */
export function expectedTacticValue(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  target: Unit,
): number {
  if (tactic.effect === "healHp") return healAmount(tactic, target.hpMax - target.hp);
  if (tactic.effect !== "damage") return 0;

  const average = tacticDamage(ctx, caster, target, tactic, state, {
    range: (min, max) => (min + max) / 2,
  });
  const chance = alwaysHits(tactic) ? 100 : hitChance(ctx, caster, target);
  return (average * chance) / 100;
}

/**
 * 책략을 실제로 적용한다. 부르기 전에 [`tacticRejection`](#tacticRejection)이 `null`인지 확인해야 한다.
 * 책략치는 빗나가도 소비된다 — 소비되는 것은 결과가 아니라 시전이다.
 */
export function applyTactic(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  to: Pos,
  rng: Rng,
): BattleEvent[] {
  caster.mp -= tactic.cost;

  return [
    { type: "tacticUsed", officerId: caster.officerId, tacticId: tactic.id, to },
    ...applyTacticEffects(ctx, state, caster, tactic, to, rng),
  ];
}

/**
 * 책략의 효과만 적용한다. 책략치 소비와 사용 이벤트는 부르는 쪽이 정한다 —
 * 소모품 아이템은 같은 효과를 내면서 책략치를 쓰지 않는다([상세 스펙 §1.6]).
 */
export function applyTacticEffects(
  ctx: BattleContext,
  state: BattleState,
  caster: Unit,
  tactic: Tactic,
  to: Pos,
  rng: Rng,
): BattleEvent[] {
  const events: BattleEvent[] = [];

  // 대상 목록을 먼저 고정한다 — 적용 도중 격파로 `state.units`가 줄어도 남은 대상이 밀리지 않는다.
  const area = areaTiles(tactic, to);
  const targets = state.units.filter((unit) =>
    area.some(([x, y]) => unit.pos[0] === x && unit.pos[1] === y),
  );

  let total = 0;
  for (const target of targets) {
    const result = applyToUnit(ctx, state, caster, tactic, target, rng);
    events.push(...result.events);
    total += result.amount;
  }

  // 성과가 있으면 경험치를 얻는다. 성과를 수치로 남기지 않는 효과(혼란)도 성공했으면 최소치는 준다.
  const gained = total > 0 ? attackExp(ctx, total) : 0;
  events.push(...gainExp(ctx, caster, gained));

  return events;
}
