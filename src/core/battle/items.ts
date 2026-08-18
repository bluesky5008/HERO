import type { Item, Pos } from "../data/schemas";
import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import { classOf, type BattleContext, type BattleState, type Unit } from "./state";
import { applyTacticEffects, tacticOf, tacticTargetRejection } from "./tactics";

/**
 * 아이템 사용과 승급·계열 전환([상세 스펙 §1.6], DES-01 → FR-06, FR-07).
 *
 * 장비(`weapon`·`manual`·`mount`)는 지니는 것만으로 걸리고([damage.ts](./damage.ts)·[movement.ts](./movement.ts)),
 * 자연 회복(`regen`)은 턴 시작에 저절로 발동한다([turn.ts](./turn.ts)) — 여기서 다루는 것은 "쓰는" 아이템이다.
 *
 * **장수별 사용 제한은 두지 않는다([FR-07]의 설계 결정).** 데이터의 `forbiddenFor`는 개조 확장용으로만
 * 남아 있고 이 파일은 그 값을 보지 않는다. 참조 무결성 검사가 값이 든 것을 경고로 보고한다.
 */

/** 사용 커맨드로 쓸 수 있는 종류. 나머지는 지니고만 있어도 효과가 걸리거나 저절로 발동한다. */
const USABLE = ["consumable", "classChange", "classUpgrade"] as const;

/** 지닌 아이템을 ID로 찾는다. 데이터에 없거나 지니지 않았으면 `null`. */
export function carriedItem(ctx: BattleContext, unit: Unit, itemId: string): Item | null {
  if (!unit.items.includes(itemId)) return null;
  return ctx.data.items.find((candidate) => candidate.id === itemId) ?? null;
}

/**
 * 쓸 수 없는 이유. 쓸 수 있으면 `null`.
 * 책략과 같은 방식으로 판정을 한 곳에 모아 화면([TASK-32])과 커맨드가 같은 규칙을 쓰게 한다.
 */
export function itemRejection(
  ctx: BattleContext,
  state: BattleState,
  unit: Unit,
  item: Item,
  to?: Pos,
): string | null {
  if (!USABLE.includes(item.type as (typeof USABLE)[number])) {
    return `'${item.id}'는 사용하는 아이템이 아니다`;
  }

  if (item.type === "consumable") {
    if (!item.tacticId) return `소모품 '${item.id}'에 복제할 책략이 없다`;
    if (!to) return `'${item.id}'를 쓰려면 대상 좌표가 필요하다`;
    // 병과·책략치 조건은 보지 않는다 — 아이템이 대신 시전하기 때문이다.
    return tacticTargetRejection(ctx, state, unit, tacticOf(ctx, item.tacticId), to);
  }

  // 아이템이 적용 병과를 지정했으면 그 병과에만 쓴다([상세 스펙 §1.6]의 "단병→장병: 장창").
  if (item.type === "classUpgrade") {
    if (item.classId && item.classId !== unit.classId) {
      return `'${item.id}'는 ${item.classId} 병과의 승급 아이템이다`;
    }

    const cls = classOf(ctx, unit);
    if (cls.upgradesTo === null || cls.upgradeLevel === null) {
      return `${cls.id}는 더 승급할 수 없다`;
    }
    if (unit.level < cls.upgradeLevel) {
      return `승급하려면 레벨 ${cls.upgradeLevel}이 필요하다 (현재 ${unit.level})`;
    }
    return null;
  }

  if (!item.classId) return `전환서 '${item.id}'에 바꿀 병과가 없다`;
  return null;
}

/** 병과를 바꾸고 이벤트를 남긴다. 레벨은 유지된다([상세 스펙 §1.6]). */
function changeClass(unit: Unit, to: string): BattleEvent[] {
  const from = unit.classId;
  unit.classId = to;
  return [{ type: "classChanged", officerId: unit.officerId, from, to }];
}

/**
 * 아이템을 쓴다. 부르기 전에 [`itemRejection`](#itemRejection)이 `null`인지 확인해야 한다.
 * 쓴 아이템은 소지품에서 하나 사라진다.
 */
export function useItem(
  ctx: BattleContext,
  state: BattleState,
  unit: Unit,
  item: Item,
  to: Pos | undefined,
  rng: Rng,
): BattleEvent[] {
  unit.items.splice(unit.items.indexOf(item.id), 1);
  const events: BattleEvent[] = [{ type: "itemUsed", officerId: unit.officerId, itemId: item.id }];

  switch (item.type) {
    case "consumable":
      return [
        ...events,
        ...applyTacticEffects(ctx, state, unit, tacticOf(ctx, item.tacticId!), to!, rng),
      ];

    case "classUpgrade":
      return [...events, ...changeClass(unit, classOf(ctx, unit).upgradesTo!)];

    default:
      return [...events, ...changeClass(unit, item.classId!)];
  }
}

/**
 * 자연 회복 아이템이 턴 시작에 돌려주는 병력([상세 스펙 §1.1]의 ③).
 * 여럿 지니면 더해지고, 상한을 넘지 않는 것은 부르는 쪽이 자른다.
 */
export function regenAmount(ctx: BattleContext, unit: Unit): number {
  return unit.items.reduce((total, itemId) => {
    const item = ctx.data.items.find((candidate) => candidate.id === itemId);
    return item?.type === "regen" ? total + item.value : total;
  }, 0);
}
