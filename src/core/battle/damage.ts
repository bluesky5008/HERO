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

/** 공격 한 번이 깎는 병력. 남은 병력을 넘지 않고 최소 데미지 아래로도 내려가지 않는다. */
export function physicalDamage(
  ctx: BattleContext,
  attacker: Unit,
  defender: Unit,
  rng: Rng,
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
