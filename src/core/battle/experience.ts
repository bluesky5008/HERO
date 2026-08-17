import type { BattleEvent } from "./events";
import {
  hpMaxOf,
  mpMaxOf,
  officerOf,
  type BattleContext,
  type BattleState,
  type Unit,
} from "./state";

/**
 * 경험치와 레벨업([상세 스펙 §1.6], DES-01 → FR-06).
 *
 * 경험치는 진영을 가리지 않고 쌓이지만, **적 부대의 성장은 이 전투 안에서만 유효하다** —
 * 적 배치는 언제나 스테이지 데이터(`stage.enemies`)에서 새로 세워지므로 다음 스테이지로 이관되지 않는다.
 * 아군의 성장만 캠페인이 이어받는다(M3). 그 불변식은 `tests/battle/state.test.ts`가 지킨다.
 *
 * 나눗수·상하한·격파 보너스·레벨당 경험치는 전부 `combat-config.json`에서 읽는다(NFR-06).
 * 책략·회복·아이템·일기토의 경험치는 그 기능이 들어오는 뒤 작업에서 `gainExp`를 부른다.
 */

/** 공격 한 번이 주는 경험치. 데미지에 비례하되 상하한을 벗어나지 않는다. */
export function attackExp(ctx: BattleContext, damage: number): number {
  const { divisor, min, max } = ctx.data.combatConfig.exp;
  return Math.min(Math.max(Math.floor(damage / divisor), min), max);
}

/**
 * 경험치를 주고 임계에 닿을 때마다 레벨을 올린다. 잔여 경험치는 다음 레벨로 이월된다.
 * 레벨업은 병력 상한을 바꾸므로 [M1이 확정한 `hpMaxOf`](./state.ts)만을 계산 경로로 쓴다 —
 * 배치 시점과 전투 중의 상한식이 갈라지면 같은 부대가 화면마다 다른 값을 갖는다.
 */
export function gainExp(ctx: BattleContext, unit: Unit, amount: number): BattleEvent[] {
  if (amount <= 0) return [];

  const { maxLevel, exp } = ctx.data.combatConfig;
  const events: BattleEvent[] = [{ type: "expGained", officerId: unit.officerId, amount }];
  unit.exp += amount;

  while (unit.exp >= exp.perLevel && unit.level < maxLevel) {
    unit.exp -= exp.perLevel;
    unit.level += 1;

    // 상한이 오른 만큼 병력도 회복한다([상세 스펙 §1.6]).
    const officer = officerOf(ctx, unit);
    const hpMax = hpMaxOf(officer, unit.level);
    unit.hp += hpMax - unit.hpMax;
    unit.hpMax = hpMax;

    // 책략치는 상한만 재계산한다 — 규칙이 회복까지 정한 것은 병력뿐이다([상세 스펙 §1.6]).
    unit.mpMax = mpMaxOf(ctx.data.combatConfig, officer, unit.level);

    events.push({ type: "leveledUp", officerId: unit.officerId, level: unit.level });
  }

  // 더 오를 수 없으면 경험치를 쌓아 두지 않는다 — 임계를 넘은 채 남으면 화면의 경험치 막대가 늘 가득 찬다.
  if (unit.level >= maxLevel) unit.exp = Math.min(unit.exp, exp.perLevel - 1);

  return events;
}

/**
 * 격파 보너스를 나눠 준다([상세 스펙 §1.6]).
 * 기본은 막타 부대 독식(원작)이고, `shareExp`를 켜면 생존 아군이 똑같이 나눠 갖는다.
 * 격파된 부대는 이미 전장에서 빠진 뒤에 부르므로 `state.units`가 곧 생존 명단이다.
 */
export function grantDefeatExp(
  ctx: BattleContext,
  state: BattleState,
  killer: Unit,
): BattleEvent[] {
  const { defeatBonus } = ctx.data.combatConfig.exp;
  if (!ctx.data.config.shareExp) return gainExp(ctx, killer, defeatBonus);

  const allies = state.units.filter((unit) => unit.side === killer.side);
  const each = Math.floor(defeatBonus / allies.length);

  return allies.flatMap((unit) => gainExp(ctx, unit, each));
}
