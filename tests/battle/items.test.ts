import { describe, expect, it } from "vitest";
import { applyCommand, BattleCommandError, inAttackRange } from "../../src/core/battle/commands";
import { beginPhase } from "../../src/core/battle/turn";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 아이템 사용과 승급·계열 전환([상세 스펙 §1.6], DES-01 → FR-06, FR-07, AC-03).
 *
 * 픽스처 병과: 단병(sword_soldier)은 레벨 15에 장병(spear_soldier)으로 승급한다.
 * 픽스처 아이템: spear_manual(승급, 단병 전용)·bow_book(궁병 전환서)
 * ·restricted_book(장수 제한이 걸린 전환서 — FR-07 확인용)·fire_scroll(화계 소모품)·herb(자연 회복).
 */

const MAP = ["........", "........", "........"];

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

function battle(specs: UnitSpec[], options: BattleFixtureOptions = {}) {
  const { ctx, state } = makeBattle(MAP, specs, options);
  return {
    ctx,
    state,
    unit: (officerId: string) => state.units.find((c) => c.officerId === officerId)!,
    // `to`는 소모품에만 필요하다 — 없을 때는 아예 넣지 않는다(exactOptionalPropertyTypes).
    use: (itemId: string, to?: Pos, officerId = "foot") =>
      applyCommand(
        ctx,
        state,
        to ? { type: "useItem", officerId, itemId, to } : { type: "useItem", officerId, itemId },
        createRng(3),
      ),
  };
}

describe("승급 (classUpgrade)", () => {
  const soldier = (level: number, items: string[] = ["spear_manual"]) =>
    battle([{ ...at("foot", "player", [1, 1]), level, items }]);

  it("승급 레벨에 못 미치면 거부하고 아무것도 바꾸지 않는다", () => {
    const b = soldier(14);

    expect(() => b.use("spear_manual")).toThrow(BattleCommandError);
    expect(b.unit("foot").classId).toBe("sword_soldier");
    expect(b.unit("foot").items).toEqual(["spear_manual"]);
  });

  it("승급 레벨에 닿으면 병과가 데이터가 정한 대상으로 바뀐다", () => {
    const b = soldier(15);
    const events = b.use("spear_manual");

    expect(b.unit("foot").classId).toBe("spear_soldier");
    expect(events).toContainEqual({
      type: "classChanged",
      officerId: "foot",
      from: "sword_soldier",
      to: "spear_soldier",
    });
  });

  it("레벨은 그대로 유지된다", () => {
    const b = soldier(15);
    b.use("spear_manual");

    expect(b.unit("foot").level).toBe(15);
  });

  it("새 병과의 사거리 규칙이 바로 적용된다", () => {
    const b = battle([
      { ...at("foot", "player", [1, 1]), level: 15, items: ["spear_manual"] },
      at("foot2", "enemy", [2, 2]),
    ]);

    // 단병은 4방향이라 대각선이 사거리 밖, 장병은 8방향이라 안이다.
    expect(inAttackRange(b.ctx, b.unit("foot"), b.unit("foot2"))).toBe(false);
    b.use("spear_manual");
    expect(inAttackRange(b.ctx, b.unit("foot"), b.unit("foot2"))).toBe(true);
  });

  it("쓴 아이템은 소지품에서 사라진다", () => {
    const b = soldier(15, ["spear_manual", "herb"]);
    b.use("spear_manual");

    expect(b.unit("foot").items).toEqual(["herb"]);
  });

  it("승급 대상이 없는 병과는 거부한다", () => {
    const b = battle([{ ...at("spear", "player", [1, 1]), level: 30, items: ["spear_manual"] }]);

    expect(() => b.use("spear_manual", undefined, "spear")).toThrow(BattleCommandError);
  });

  it("아이템이 지정한 병과가 아니면 거부한다", () => {
    const b = battle([{ ...at("bow", "player", [1, 1]), level: 30, items: ["spear_manual"] }]);

    expect(() => b.use("spear_manual", undefined, "bow")).toThrow(BattleCommandError);
  });
});

describe("계열 전환 (classChange)", () => {
  it("병과를 바꾸고 레벨을 유지한다 ([상세 스펙 §1.6])", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 7, items: ["bow_book"] }]);
    b.use("bow_book");

    expect(b.unit("foot").classId).toBe("archer");
    expect(b.unit("foot").level).toBe(7);
  });

  it("승급과 달리 레벨 조건이 없다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 1, items: ["bow_book"] }]);
    b.use("bow_book");

    expect(b.unit("foot").classId).toBe("archer");
  });

  it("어떤 장수에게도 사용 제한이 걸리지 않는다 (FR-07의 설계 결정)", () => {
    // `restricted_book`은 forbiddenFor에 이 무장이 들어 있지만 규칙은 그것을 보지 않는다.
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, items: ["restricted_book"] }]);
    b.use("restricted_book");

    expect(b.unit("foot").classId).toBe("archer");
  });
});

describe("소모품 (consumable)", () => {
  const caster = (items: string[] = ["fire_scroll"]) =>
    battle([
      { ...at("foot", "player", [1, 1]), items },
      at("foot2", "enemy", [2, 1]),
    ]);

  it("책략 효과를 복제한다", () => {
    const b = caster();
    const before = b.unit("foot2").hp;

    b.use("fire_scroll", [2, 1]);

    expect(b.unit("foot2").hp).toBeLessThan(before);
  });

  it("책략치를 쓰지 않는다", () => {
    const b = caster();
    const before = b.unit("foot").mp;

    b.use("fire_scroll", [2, 1]);

    expect(b.unit("foot").mp).toBe(before);
  });

  it("병과가 그 책략을 배우지 않아도 쓸 수 있다", () => {
    const b = battle([
      { ...at("horse", "player", [1, 1]), items: ["fire_scroll"] },
      at("foot2", "enemy", [2, 1]),
    ]);
    const before = b.unit("foot2").hp;

    // 기병은 공격 책략을 배우지 않는다([상세 스펙 §1.5]).
    b.use("fire_scroll", [2, 1], "horse");

    expect(b.unit("foot2").hp).toBeLessThan(before);
  });

  it("쓰고 나면 소지품에서 사라진다", () => {
    const b = caster(["fire_scroll", "fire_scroll"]);
    b.use("fire_scroll", [2, 1]);

    expect(b.unit("foot").items).toEqual(["fire_scroll"]);
  });

  it("책략의 지형·날씨 게이트를 그대로 받는다", () => {
    const b = battle(
      [{ ...at("foot", "player", [1, 1]), items: ["fire_scroll"] }, at("foot2", "enemy", [2, 1])],
      { weather: "rain" },
    );

    // 화계는 우천에 쓸 수 없다([상세 스펙 §1.5]).
    expect(() => b.use("fire_scroll", [2, 1])).toThrow(BattleCommandError);
  });

  it("대상 좌표가 없으면 거부한다", () => {
    const b = caster();

    expect(() => b.use("fire_scroll")).toThrow(BattleCommandError);
  });
});

describe("자연 회복 (regen — 턴 시작 ③)", () => {
  it("턴 시작에 병력을 회복한다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), hp: 500, items: ["herb"] }]);

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(600);
  });

  it("여러 개를 지니면 더해진다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), hp: 500, items: ["herb", "herb"] }]);

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(700);
  });

  it("병력 상한을 넘지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), items: ["herb"] }]);

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(b.unit("foot").hpMax);
  });

  it("차례를 받지 않은 진영은 회복하지 않는다", () => {
    const b = battle([{ ...at("foot2", "enemy", [2, 1]), hp: 500, items: ["herb"] }]);

    beginPhase(b.ctx, b.state, createRng(1)); // 플레이어 페이즈

    expect(b.unit("foot2").hp).toBe(500);
  });

  it("사용 커맨드로는 쓸 수 없다 — 저절로 발동하는 아이템이다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), hp: 500, items: ["herb"] }]);

    expect(() => b.use("herb")).toThrow(BattleCommandError);
  });
});

describe("useItem 커맨드", () => {
  it("사용은 행동 한 번을 소비한다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 15, items: ["spear_manual"] }]);
    const events = b.use("spear_manual");

    expect(b.unit("foot").acted).toBe(true);
    expect(events[0]).toEqual({ type: "itemUsed", officerId: "foot", itemId: "spear_manual" });
  });

  it("지니지 않은 아이템은 거부한다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(() => b.use("spear_manual")).toThrow(BattleCommandError);
  });

  it("장비 아이템은 사용 커맨드로 쓸 수 없다 — 지니는 것만으로 걸린다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), items: ["iron_sword"] }]);

    expect(() => b.use("iron_sword")).toThrow(BattleCommandError);
  });

  it("없는 아이템 ID는 거부한다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(() => b.use("no_such_item")).toThrow(BattleCommandError);
  });

  it("거부된 사용은 행동을 소비하지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 14, items: ["spear_manual"] }]);

    expect(() => b.use("spear_manual")).toThrow(BattleCommandError);
    expect(b.unit("foot").acted).toBe(false);
  });
});
