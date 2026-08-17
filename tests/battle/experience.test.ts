import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/core/battle/commands";
import { attackExp, gainExp } from "../../src/core/battle/experience";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 경험치와 레벨업([상세 스펙 §1.6], DES-01 → FR-06).
 * 픽스처 무장의 성장값은 baseHp 1000 / hpPerLevel 100이므로 레벨 5의 병력 상한은 1400이다.
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
  };
}

describe("attackExp", () => {
  const { ctx } = battle([at("foot", "player", [1, 1])]);
  const { divisor, min, max } = ctx.data.combatConfig.exp;

  it("데미지에 비례해 얻는다", () => {
    expect(attackExp(ctx, divisor * 7)).toBe(7);
  });

  it("나머지는 버린다 — 경험치는 정수다", () => {
    expect(attackExp(ctx, divisor * 3 + divisor - 1)).toBe(3);
  });

  it("아무리 적은 데미지라도 최솟값은 준다", () => {
    expect(attackExp(ctx, 1)).toBe(min);
  });

  it("최댓값을 넘지 않는다", () => {
    expect(attackExp(ctx, divisor * (max + 50))).toBe(max);
  });
});

describe("gainExp — 누적과 레벨업", () => {
  it("임계에 못 미치면 누적만 하고 레벨은 그대로다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5 }]);
    const events = gainExp(b.ctx, b.unit("foot"), 30);

    expect(b.unit("foot").exp).toBe(30);
    expect(b.unit("foot").level).toBe(5);
    expect(events).toEqual([{ type: "expGained", officerId: "foot", amount: 30 }]);
  });

  it("누적이 임계에 닿으면 레벨이 오르고 잔여 경험치가 이월된다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, exp: 80 }]);
    const { perLevel } = b.ctx.data.combatConfig.exp;

    gainExp(b.ctx, b.unit("foot"), 35);

    expect(b.unit("foot").level).toBe(6);
    expect(b.unit("foot").exp).toBe(80 + 35 - perLevel);
  });

  it("레벨업으로 병력 상한이 hpPerLevel만큼 오르고 병력도 같은 양 회복된다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, exp: 99, hp: 500 }]);
    const before = b.unit("foot").hpMax;

    gainExp(b.ctx, b.unit("foot"), 1);

    expect(b.unit("foot").hpMax).toBe(before + 100);
    expect(b.unit("foot").hp).toBe(600);
  });

  it("레벨업으로 책략치 상한이 재계산된다 ([상세 스펙 §1.6])", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, exp: 99 }]);
    const before = b.unit("foot").mpMax;

    gainExp(b.ctx, b.unit("foot"), 1);

    // mpMax = floor(지력/4) + 레벨이므로 레벨 1당 1 오른다.
    expect(b.unit("foot").mpMax).toBe(before + 1);
  });

  it("레벨업이 현재 책략치를 채워 주지는 않는다 — 상한만 재계산한다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, exp: 99, mp: 2 }]);

    gainExp(b.ctx, b.unit("foot"), 1);

    expect(b.unit("foot").mp).toBe(2);
  });

  it("한 번에 여러 레벨이 오를 수 있다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5 }]);
    const { perLevel } = b.ctx.data.combatConfig.exp;

    gainExp(b.ctx, b.unit("foot"), perLevel * 3);

    expect(b.unit("foot").level).toBe(8);
    expect(b.unit("foot").exp).toBe(0);
  });

  it("레벨업을 이벤트로 남긴다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 5, exp: 99 }]);
    const events = gainExp(b.ctx, b.unit("foot"), 1);

    expect(events).toContainEqual({ type: "leveledUp", officerId: "foot", level: 6 });
  });

  it("최대 레벨에서는 더 오르지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), level: 99, exp: 99 }]);
    const { maxLevel, exp } = b.ctx.data.combatConfig;
    const before = b.unit("foot").hpMax;

    const events = gainExp(b.ctx, b.unit("foot"), exp.perLevel * 5);

    expect(b.unit("foot").level).toBe(maxLevel);
    expect(b.unit("foot").hpMax).toBe(before);
    // 오르지 못한 경험치가 무한정 쌓여 상태가 이상해지지 않게 임계 직전에서 멈춘다.
    expect(b.unit("foot").exp).toBe(exp.perLevel - 1);
    expect(events.some((event) => event.type === "leveledUp")).toBe(false);
  });

  it("얻은 경험치가 없으면 이벤트를 내지 않는다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(gainExp(b.ctx, b.unit("foot"), 0)).toEqual([]);
  });
});

describe("gainExp — 적 부대의 성장은 이 전투 안에서만 유효하다", () => {
  it("적 부대도 전투 중에는 경험치를 얻는다", () => {
    const b = battle([at("foot2", "enemy", [2, 1])]);

    expect(gainExp(b.ctx, b.unit("foot2"), 50)).toEqual([
      { type: "expGained", officerId: "foot2", amount: 50 },
    ]);
    expect(b.unit("foot2").exp).toBe(50);
  });

  it("적 부대도 전투 중에는 레벨이 오르고 병력 상한이 커진다", () => {
    const b = battle([{ ...at("foot2", "enemy", [2, 1]), level: 5, exp: 99 }]);
    const before = b.unit("foot2").hpMax;

    gainExp(b.ctx, b.unit("foot2"), 1);

    expect(b.unit("foot2").level).toBe(6);
    expect(b.unit("foot2").hpMax).toBeGreaterThan(before);
  });
});

describe("공격·격파 경험치 지급", () => {
  /** 난수 폭을 고정해 데미지가 공식대로만 나오게 한다. */
  const FIXED: BattleFixtureOptions = { combatConfig: { damageJitter: { min: 1, max: 1 } } };

  const strike = (specs: UnitSpec[], options: BattleFixtureOptions = {}) => {
    const b = battle(specs, { ...FIXED, ...options, combatConfig: { ...FIXED.combatConfig, ...options.combatConfig } });
    const events = applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot", targetId: "foot2" },
      createRng(1),
    );
    return { ...b, events };
  };

  it("공격한 부대가 데미지에 비례한 경험치를 얻는다", () => {
    const b = strike([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);
    const damage = b.events.find((event) => event.type === "attacked")!;

    expect(b.unit("foot").exp).toBe(attackExp(b.ctx, damage.damage));
  });

  it("맞은 부대는 경험치를 얻지 않는다", () => {
    const b = strike([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);

    expect(b.unit("foot2").exp).toBe(0);
  });

  it("격파하면 막타 부대가 보너스를 독식한다", () => {
    const b = strike([
      at("foot", "player", [1, 1]),
      { ...at("foot2", "enemy", [2, 1]), hp: 1 },
      at("horse", "player", [5, 1]),
    ]);
    const { defeatBonus } = b.ctx.data.combatConfig.exp;

    // 격파 데미지는 남은 병력 1로 잘리므로 공격 경험치는 최솟값이다.
    expect(b.unit("foot").exp).toBe(b.ctx.data.combatConfig.exp.min + defeatBonus);
    expect(b.unit("horse").exp).toBe(0);
  });

  it("경험치 공유를 켜면 격파 보너스를 생존 아군이 나눠 갖는다", () => {
    const b = strike(
      [
        at("foot", "player", [1, 1]),
        { ...at("foot2", "enemy", [2, 1]), hp: 1 },
        at("horse", "player", [5, 1]),
      ],
      { config: { shareExp: true } },
    );
    const { defeatBonus, min } = b.ctx.data.combatConfig.exp;
    const each = Math.floor(defeatBonus / 2); // 생존 아군 2부대

    expect(b.unit("foot").exp).toBe(min + each);
    expect(b.unit("horse").exp).toBe(each);
  });

  it("경험치 공유는 기본으로 꺼져 있다 (원작 동작)", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(b.ctx.data.config.shareExp).toBe(false);
  });

  it("적이 아군을 격파해도 같은 규칙으로 경험치를 얻는다", () => {
    const b = battle(
      [{ ...at("foot", "player", [1, 1]), hp: 1 }, at("foot2", "enemy", [2, 1])],
      FIXED,
    );
    b.state.phase = "enemy";

    applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot2", targetId: "foot" },
      createRng(1),
    );

    const { min, defeatBonus } = b.ctx.data.combatConfig.exp;
    expect(b.unit("foot2").exp).toBe(min + defeatBonus);
  });
});
