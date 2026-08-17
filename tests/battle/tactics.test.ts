import { describe, expect, it } from "vitest";
import { applyCommand, BattleCommandError } from "../../src/core/battle/commands";
import { applyTactic, tacticOf, tacticRejection } from "../../src/core/battle/tactics";
import { beginPhase, endPhase, isPhaseComplete } from "../../src/core/battle/turn";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 책략 실행([상세 스펙 §1.5], DES-01 → FR-04, AC-03).
 * 게이트(카테고리 × 지형 × 날씨 × 거점)는 코드 분기가 아니라 `tactics.json`의 필드가 정한다.
 *
 * 픽스처 책략: fire_arrow(화계 단일)·fire_dragon(화계 cross5)·flood(수계, 평지만)
 * ·quake(지계, 산만)·taunt(사기저하 30)·bewilder(혼란)·mend(회복 300)·cheer(사기회복 20).
 * `mage`(주술사)만 전 카테고리를 배운다.
 */

/** [2,1]=숲, [3,1]=산, [4,1]=거점. 나머지는 평지. */
const MAP = ["........", "..f^v...", "........"];

const FOREST: Pos = [2, 1];
const MOUNTAIN: Pos = [3, 1];
const VILLAGE: Pos = [4, 1];

/** 난수 폭을 1로 고정하면 데미지 공식만 남는다. */
const FIXED: BattleFixtureOptions = { combatConfig: { damageJitter: { min: 1, max: 1 } } };

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

function battle(specs: UnitSpec[], options: BattleFixtureOptions = {}) {
  const { ctx, state } = makeBattle(MAP, specs, {
    ...options,
    combatConfig: { ...FIXED.combatConfig, ...options.combatConfig },
  });
  return {
    ctx,
    state,
    unit: (officerId: string) => state.units.find((c) => c.officerId === officerId)!,
    /** 거부 사유(쓸 수 있으면 null) */
    reject: (tacticId: string, to: Pos, casterId = "mage") =>
      tacticRejection(
        ctx,
        state,
        state.units.find((c) => c.officerId === casterId)!,
        tacticOf(ctx, tacticId),
        to,
      ),
    cast: (tacticId: string, to: Pos, seed = 1, casterId = "mage") =>
      applyTactic(
        ctx,
        state,
        state.units.find((c) => c.officerId === casterId)!,
        tacticOf(ctx, tacticId),
        to,
        createRng(seed),
      ),
  };
}

/** 주술사 하나와 대상 하나. 지력을 맞춰 명중률을 기준값으로 고정한다. */
const duel = (targetPos: Pos, options: BattleFixtureOptions = {}) =>
  battle([at("mage", "player", [0, 1]), at("foot2", "enemy", targetPos)], options);

describe("tacticRejection — 사용 조건", () => {
  it("병과가 배우지 않은 책략은 거부한다", () => {
    const b = battle([at("foot", "player", [0, 1]), at("foot2", "enemy", [1, 1])]);

    // 단병은 fire_arrow·mend만 배운다.
    expect(b.reject("flood", [1, 1], "foot")).toContain("flood");
    expect(b.reject("fire_arrow", [1, 1], "foot")).toBeNull();
  });

  it("책략치가 모자라면 거부한다", () => {
    const b = duel([1, 1]);
    b.unit("mage").mp = 0;

    expect(b.reject("fire_arrow", [1, 1])).toContain("책략치");
  });

  it("사거리 밖이면 거부한다", () => {
    const b = duel([1, 1]);

    // fire_arrow 사거리 3, 주술사는 4방향 척도 → [0,1]에서 [4,1]까지 거리 4
    expect(b.reject("fire_arrow", [3, 1])).toBeNull();
    expect(b.reject("fire_arrow", [4, 1])).toContain("사거리");
  });

  it("맵 밖은 거부한다", () => {
    const b = duel([1, 1]);

    expect(b.reject("fire_arrow", [0, 9])).toContain("맵");
  });
});

describe("tacticRejection — 지형·날씨 게이트 전 조합 ([상세 스펙 §1.5])", () => {
  /** 게이트만 보는 표. 대상 칸에 부대가 없어도 게이트는 칸으로 판정한다. */
  const CASES: { tactic: string; weather: "clear" | "rain"; to: Pos; allowed: boolean }[] = [
    // 화계 — 우천 사용 불가, 지형 제한 없음
    { tactic: "fire_arrow", weather: "clear", to: [1, 1], allowed: true },
    { tactic: "fire_arrow", weather: "clear", to: FOREST, allowed: true },
    { tactic: "fire_arrow", weather: "clear", to: MOUNTAIN, allowed: true },
    { tactic: "fire_arrow", weather: "rain", to: [1, 1], allowed: false },
    { tactic: "fire_arrow", weather: "rain", to: FOREST, allowed: false },
    // 수계 — 평지 계열만, 날씨 제한 없음
    { tactic: "flood", weather: "clear", to: [1, 1], allowed: true },
    { tactic: "flood", weather: "rain", to: [1, 1], allowed: true },
    { tactic: "flood", weather: "clear", to: FOREST, allowed: false },
    { tactic: "flood", weather: "clear", to: MOUNTAIN, allowed: false },
    // 지계 — 산·황무지만, 날씨 무관
    { tactic: "quake", weather: "clear", to: MOUNTAIN, allowed: true },
    { tactic: "quake", weather: "rain", to: MOUNTAIN, allowed: true },
    { tactic: "quake", weather: "clear", to: [1, 1], allowed: false },
    { tactic: "quake", weather: "clear", to: FOREST, allowed: false },
    // 지형·날씨 제한이 없는 계열은 어디서든 쓴다
    { tactic: "taunt", weather: "rain", to: MOUNTAIN, allowed: true },
    { tactic: "mend", weather: "rain", to: FOREST, allowed: true },
  ];

  for (const { tactic, weather, to, allowed } of CASES) {
    it(`${tactic} / ${weather} / [${to}] → ${allowed ? "사용 가능" : "사용 불가"}`, () => {
      const b = battle([at("mage", "player", [1, 1])], { weather });
      const reason = b.reject(tactic, to);

      if (allowed) expect(reason).toBeNull();
      else expect(reason).not.toBeNull();
    });
  }
});

describe("거점 위 부대에게 공격 책략이 무효다 ([상세 스펙 §1.5])", () => {
  it("거점 위 부대는 피해를 입지 않는다", () => {
    const b = duel(VILLAGE);
    const before = b.unit("foot2").hp;

    b.cast("fire_arrow", VILLAGE);

    expect(b.unit("foot2").hp).toBe(before);
  });

  it("거점 밖 같은 부대는 피해를 입는다", () => {
    const b = duel([3, 0]);
    const before = b.unit("foot2").hp;

    b.cast("fire_arrow", [3, 0]);

    expect(b.unit("foot2").hp).toBeLessThan(before);
  });

  it("거점이 막는 효과는 설정이 정한다 — 회복은 막히지 않는다", () => {
    const b = battle([at("mage", "player", [3, 1]), at("foot", "player", VILLAGE)]);
    b.unit("foot").hp = 100;

    b.cast("mend", VILLAGE);

    expect(b.unit("foot").hp).toBeGreaterThan(100);
  });
});

describe("명중 판정 ([상세 스펙 §1.5])", () => {
  it("지력이 같으면 기준 명중률이다", () => {
    const b = duel([1, 1]);
    const { hitBase } = b.ctx.data.combatConfig.tactic;

    expect(hitBase).toBe(50);
  });

  it("지력차가 명중률을 올리고 내린다", () => {
    // 시드 2의 첫 난수는 0.987 → 백분율 98.7. 명중률 100은 맞고 10은 빗나가는 지점이다.
    const smart = duel([1, 1], { officers: { mage: { int: 100 }, foot2: { int: 1 } } });
    const dull = duel([1, 1], { officers: { mage: { int: 1 }, foot2: { int: 100 } } });

    expect(smart.cast("fire_arrow", [1, 1], 2).some((e) => e.type === "tacticMissed")).toBe(false);
    expect(dull.cast("fire_arrow", [1, 1], 2).some((e) => e.type === "tacticMissed")).toBe(true);
  });

  it("명중률은 설정한 상하한을 벗어나지 않는다", () => {
    const b = duel([1, 1], { officers: { mage: { int: 1 }, foot2: { int: 100 } } });
    const { hitMin } = b.ctx.data.combatConfig.tactic;

    // 지력차 -99여도 하한만큼은 맞는다 — 난수 0.0x를 내는 시드에서 성공해야 한다.
    const events = b.cast("fire_arrow", [1, 1], 7);
    expect(hitMin).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "tacticMissed")).toBe(false);
  });

  it("회복계는 판정 없이 언제나 성공한다", () => {
    const b = battle([at("mage", "player", [0, 1]), at("foot", "player", [1, 1])], {
      officers: { mage: { int: 1 } },
    });
    b.unit("foot").hp = 100;

    const events = b.cast("mend", [1, 1]);

    expect(events.some((e) => e.type === "tacticMissed")).toBe(false);
    expect(b.unit("foot").hp).toBeGreaterThan(100);
  });

  it("빗나가면 대상이 아무 영향도 받지 않는다", () => {
    const b = duel([1, 1], { officers: { mage: { int: 1 }, foot2: { int: 100 } } });
    const before = b.unit("foot2").hp;

    const events = b.cast("fire_arrow", [1, 1], 2);

    expect(events.some((e) => e.type === "tacticMissed")).toBe(true);
    expect(b.unit("foot2").hp).toBe(before);
  });
});

describe("데미지 보정 ([상세 스펙 §1.5])", () => {
  const dealt = (b: ReturnType<typeof battle>, tactic: string, to: Pos, seed = 3) => {
    const before = b.unit("foot2").hp;
    b.cast(tactic, to, seed);
    return before - b.unit("foot2").hp;
  };

  it("숲에 있는 대상은 화계 피해가 커진다", () => {
    const plain = dealt(duel([2, 0]), "fire_arrow", [2, 0]);
    const forest = dealt(duel(FOREST), "fire_arrow", FOREST);

    expect(forest).toBe(Math.round(plain * 1.25));
  });

  it("우천이면 수계 피해가 커진다", () => {
    const clear = dealt(duel([1, 1]), "flood", [1, 1]);
    const rain = dealt(duel([1, 1], { weather: "rain" }), "flood", [1, 1]);

    expect(rain).toBe(Math.round(clear * 1.25));
  });

  it("시전자의 지력이 높으면 피해가 커진다", () => {
    const even = dealt(duel([1, 1]), "flood", [1, 1]);
    const smart = dealt(
      duel([1, 1], { officers: { mage: { int: 100 }, foot2: { int: 50 } } }),
      "flood",
      [1, 1],
    );

    expect(smart).toBeGreaterThan(even);
  });

  it("남은 병력보다 많이 깎지 않는다", () => {
    const b = duel([1, 1]);
    b.unit("foot2").hp = 5;

    const events = b.cast("fire_dragon", [1, 1], 3);

    // 병력 5에 기본 피해 600짜리 책략을 맞아도 깎이는 값은 5다.
    expect(events).toContainEqual({
      type: "attacked",
      attackerId: "mage",
      defenderId: "foot2",
      damage: 5,
    });
    expect(b.state.units.map((u) => u.officerId)).toEqual(["mage"]);
  });
});

describe("효과별 적용 ([상세 스펙 §1.5])", () => {
  it("사기저하는 책략의 값만큼 사기를 깎는다", () => {
    const b = duel([1, 1]);

    b.cast("taunt", [1, 1], 3);

    expect(b.unit("foot2").morale).toBe(100 - 30);
  });

  it("혼란은 대상을 혼란 상태로 만든다", () => {
    const b = duel([1, 1], { officers: { foot2: { int: 1 } } });
    b.unit("foot2").morale = 10;

    b.cast("bewilder", [1, 1], 3);

    expect(b.unit("foot2").confused).toBe(true);
  });

  it("혼란에 걸린 적은 사기가 높아도 다음 자기 턴을 잃는다", () => {
    const b = duel([1, 1], { officers: { mage: { int: 100 }, foot2: { int: 1 } } });

    b.cast("bewilder", [1, 1], 3);
    endPhase(b.state); // 플레이어 → 적
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot2").acted).toBe(true);
    expect(isPhaseComplete(b.state)).toBe(true);
  });

  it("병력 회복은 상한을 넘지 않는다", () => {
    const b = battle([at("mage", "player", [0, 1]), at("foot", "player", [1, 1])]);

    b.cast("mend", [1, 1]);

    expect(b.unit("foot").hp).toBe(b.unit("foot").hpMax);
  });

  it("사기 회복은 상한을 넘지 않는다", () => {
    const b = battle([at("mage", "player", [0, 1]), at("foot", "player", [1, 1])]);
    b.unit("foot").morale = 95;

    b.cast("cheer", [1, 1]);

    expect(b.unit("foot").morale).toBe(100);
  });
});

describe("범위 — cross5 ([상세 스펙 §1.5]의 \"대\" 계열)", () => {
  it("대상 칸과 상하좌우 5칸의 부대에 적용된다", () => {
    const b = battle(
      [
        at("mage", "player", [0, 0]),
        at("foot2", "enemy", [2, 0]), // 위
        at("bow", "enemy", [1, 1]), // 왼쪽
        at("horse", "enemy", [2, 2]), // 아래 — 중심 [2,1]에서 십자 안
        at("siege", "enemy", [0, 2]), // 십자 밖
      ],
      // 명중률을 상한으로 올려 범위 판정만 남긴다.
      { officers: { mage: { int: 100 } } },
    );
    const before = Object.fromEntries(b.state.units.map((u) => [u.officerId, u.hp]));

    b.cast("fire_dragon", [2, 1], 3);

    expect(b.unit("foot2").hp).toBeLessThan(before.foot2!);
    expect(b.unit("bow").hp).toBeLessThan(before.bow!);
    expect(b.unit("horse").hp).toBeLessThan(before.horse!);
    expect(b.unit("siege").hp).toBe(before.siege!);
  });

  it("아군도 오폭에 휘말린다", () => {
    const b = battle([at("mage", "player", [0, 0]), at("foot", "player", [1, 1])], {
      officers: { mage: { int: 100 } },
    });
    const before = b.unit("foot").hp;

    b.cast("fire_dragon", [1, 1], 3);

    expect(b.unit("foot").hp).toBeLessThan(before);
  });
});

describe("applyTactic — 비용과 성과", () => {
  it("성공하든 빗나가든 책략치를 소비한다", () => {
    const hit = duel([1, 1]);
    const miss = duel([1, 1], { officers: { mage: { int: 1 }, foot2: { int: 100 } } });
    const cost = tacticOf(hit.ctx, "fire_arrow").cost;

    // 지력이 다르면 책략치 상한도 다르므로 각 전장의 시작값과 비교한다.
    const hitBefore = hit.unit("mage").mp;
    const missBefore = miss.unit("mage").mp;
    hit.cast("fire_arrow", [1, 1], 2);
    miss.cast("fire_arrow", [1, 1], 2);

    expect(hit.unit("mage").mp).toBe(hitBefore - cost);
    expect(miss.unit("mage").mp).toBe(missBefore - cost);
  });

  it("책략을 쓴 부대가 경험치를 얻는다", () => {
    const b = duel([1, 1]);

    b.cast("flood", [1, 1], 3);

    expect(b.unit("mage").exp).toBeGreaterThan(0);
  });

  it("격파하면 전장에서 지우고 격파 이벤트를 낸다", () => {
    const b = duel([1, 1]);
    b.unit("foot2").hp = 1;

    const events = b.cast("fire_arrow", [1, 1], 3);

    expect(events).toContainEqual({ type: "defeated", officerId: "foot2" });
    expect(b.state.units.map((u) => u.officerId)).toEqual(["mage"]);
  });

  it("같은 시드는 같은 결과를 낸다 (NFR-01)", () => {
    const run = () => {
      const b = duel([1, 1]);
      b.cast("fire_arrow", [1, 1], 20260818);
      return b.unit("foot2").hp;
    };

    expect(run()).toBe(run());
  });
});

describe("useTactic 커맨드", () => {
  const cmd = (tacticId: string, to: Pos) =>
    ({ type: "useTactic", officerId: "mage", tacticId, to }) as const;

  it("행동을 소비하고 이벤트를 낸다", () => {
    const b = duel([1, 1]);
    const events = applyCommand(b.ctx, b.state, cmd("fire_arrow", [1, 1]), createRng(3));

    expect(events[0]).toEqual({
      type: "tacticUsed",
      officerId: "mage",
      tacticId: "fire_arrow",
      to: [1, 1],
    });
    expect(b.unit("mage").acted).toBe(true);
  });

  it("쓸 수 없는 책략은 거부하고 상태를 바꾸지 않는다", () => {
    const b = duel([1, 1], { weather: "rain" });
    const before = b.unit("mage").mp;

    expect(() => applyCommand(b.ctx, b.state, cmd("fire_arrow", [1, 1]), createRng(3))).toThrow(
      BattleCommandError,
    );
    expect(b.unit("mage").mp).toBe(before);
    expect(b.unit("mage").acted).toBe(false);
  });

  it("없는 책략 ID는 거부한다", () => {
    const b = duel([1, 1]);

    expect(() => applyCommand(b.ctx, b.state, cmd("no_such", [1, 1]), createRng(3))).toThrow(
      BattleCommandError,
    );
  });
});
