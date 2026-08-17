import type { Rng } from "../rng";
import { classOf, officerOf, terrainAt, type BattleContext, type Unit } from "./state";

/**
 * 물리 데미지 공식([상세 스펙 §1.3], DES-01 → FR-03, AC-04).
 * 상수는 전부 `combat-config.json`에서 읽는다 — 수치 조정에 코드를 고치지 않는다(NFR-06).
 * 아이템 보정은 아이템이 들어오는 M2에서 이 식의 곱셈 항으로 붙는다.
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
    (attacker.morale + attackerOfficer.war + classOf(ctx, attacker).attackMod);

  const defense =
    (defender.level + 10) *
    (defender.morale + defenderOfficer.ldr + classOf(ctx, defender).defenseMod) *
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
