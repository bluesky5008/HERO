import type { Rng } from "../rng";
import { classOf, officerOf, terrainAt, type BattleContext, type Unit } from "./state";

/**
 * 물리 데미지 공식([상세 스펙 §1.3], DES-01 → FR-03, AC-04).
 * 상수는 전부 `combat-config.json`에서 읽는다 — 수치 조정에 코드를 고치지 않는다(NFR-06).
 * 장비 보정은 소지품에서 읽은 배수의 곱이다 — 장비가 없으면 1이므로 M1이 고정한 값이 그대로 나온다.
 */

/**
 * 방어측 방어력에 곱하는 상성 배수(유리 0.75 / 동등 1.0 / 불리 1.25).
 * 정의되지 않은 조합은 1로 본다 — 전투를 멈추는 대신 `npm run validate`가 누락을 보고한다(NFR-03).
 */
function affinityModifier(ctx: BattleContext, attacker: Unit, defender: Unit): number {
  const attackerFamily = classOf(ctx, attacker).family;
  const defenderFamily = classOf(ctx, defender).family;

  return (
    ctx.data.affinity.find(
      (entry) => entry.attacker === attackerFamily && entry.defender === defenderFamily,
    )?.modifier ?? 1
  );
}

/**
 * 지닌 장비가 데미지에 곱하는 배수([상세 스펙 §1.3]의 `itemAtkMul`·`itemDefMul`).
 * 같은 종류를 여럿 지니면 곱해지고, 장비가 아닌 아이템은 배수 1이라 결과를 바꾸지 않는다.
 */
function itemMultiplier(ctx: BattleContext, unit: Unit, type: "weapon" | "manual"): number {
  return unit.items.reduce((multiplier, itemId) => {
    const item = ctx.data.items.find((candidate) => candidate.id === itemId);
    return item?.type === type ? multiplier * item.value : multiplier;
  }, 1);
}

/** 데미지 계산이 난수원에서 실제로 쓰는 부분. 예상 데미지는 난수를 소비하지 않고 폭의 양 끝을 넣는다. */
type Roller = Pick<Rng, "range">;

/** 공격 한 번이 깎는 병력. 남은 병력을 넘지 않고 최소 데미지 아래로도 내려가지 않는다. */
export function physicalDamage(
  ctx: BattleContext,
  attacker: Unit,
  defender: Unit,
  rng: Roller,
): number {
  const config = ctx.data.combatConfig;
  const attackerOfficer = officerOf(ctx, attacker);
  const defenderOfficer = officerOf(ctx, defender);

  const attack =
    (attacker.level + 10) *
    (attacker.morale + attackerOfficer.war + classOf(ctx, attacker).attackMod) *
    itemMultiplier(ctx, attacker, "weapon");

  const defense =
    (defender.level + 10) *
    (defender.morale + defenderOfficer.ldr + classOf(ctx, defender).defenseMod) *
    itemMultiplier(ctx, defender, "manual") *
    affinityModifier(ctx, attacker, defender) *
    (1 + (terrainAt(ctx, defender.pos)?.defenseBonus ?? 0));

  const raw = (config.baseDamage * attack) / defense;
  const rolled = Math.round(raw * rng.range(config.damageJitter.min, config.damageJitter.max));

  return Math.min(Math.max(rolled, config.minDamage), defender.hp);
}

/** 난수를 소비하지 않고 폭의 한쪽 끝만 내는 고정 난수원. `0`이면 최솟값, `1`이면 최댓값. */
const fixedRoll = (fraction: number): Roller => ({
  range: (min, max) => min + (max - min) * fraction,
});

/**
 * 공격이 낼 수 있는 데미지의 폭 `[최소, 최대]`(FR-18의 예상 데미지 표시).
 * 실제 공격과 같은 `physicalDamage`를 부르므로 공식이 갈라질 수 없다 — 난수만 양 끝으로 고정한다.
 */
export function damageRange(ctx: BattleContext, attacker: Unit, defender: Unit): [number, number] {
  return [
    physicalDamage(ctx, attacker, defender, fixedRoll(0)),
    physicalDamage(ctx, attacker, defender, fixedRoll(1)),
  ];
}
