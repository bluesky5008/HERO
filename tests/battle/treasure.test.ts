import { describe, expect, it } from "vitest";
import { applyCommand, BattleCommandError } from "../../src/core/battle/commands";
import { tacticOf, tacticRejection } from "../../src/core/battle/tactics";
import { beginPhase, endPhase } from "../../src/core/battle/turn";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 보물·군량고 조사와 날씨([상세 스펙 §1.7], DES-12 → FR-07, FR-04, AC-03).
 * 보물은 1회성이고, 날씨는 스테이지가 고정하거나 턴 시작마다 바뀐다.
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
    investigate: (officerId = "foot") =>
      applyCommand(ctx, state, { type: "investigate", officerId }, createRng(1)),
  };
}

/** [2, 1]에 철검, [4, 1]에 약초가 묻힌 전장. */
const TREASURES: BattleFixtureOptions["treasures"] = [
  { pos: [2, 1], itemId: "iron_sword" },
  { pos: [4, 1], itemId: "herb" },
];

describe("보물 조사", () => {
  it("보물 칸에서 조사하면 아이템이 소지품에 들어간다", () => {
    const b = battle([at("foot", "player", [2, 1])], { treasures: TREASURES });
    const events = b.investigate();

    expect(b.unit("foot").items).toEqual(["iron_sword"]);
    expect(events).toContainEqual({
      type: "treasureFound",
      officerId: "foot",
      itemId: "iron_sword",
      pos: [2, 1],
    });
  });

  it("가져간 보물은 상태에 기록된다", () => {
    const b = battle([at("foot", "player", [2, 1])], { treasures: TREASURES });
    b.investigate();

    expect(b.state.treasuresTaken).toEqual(["2,1"]);
  });

  it("같은 보물을 두 번 얻을 수 없다", () => {
    const b = battle([at("foot", "player", [2, 1])], { treasures: TREASURES });
    b.investigate();

    // 다음 턴이 와서 행동이 되살아나도 이미 가져간 자리는 비어 있다.
    endPhase(b.state);
    endPhase(b.state);

    expect(() => b.investigate()).toThrow(BattleCommandError);
    expect(b.unit("foot").items).toEqual(["iron_sword"]);
  });

  it("보물이 없는 칸에서는 거부한다", () => {
    const b = battle([at("foot", "player", [1, 1])], { treasures: TREASURES });

    expect(() => b.investigate()).toThrow(BattleCommandError);
  });

  it("소지품이 가득 차면 거부하고 보물을 남긴다", () => {
    const full = Array.from({ length: 8 }, () => "herb");
    const b = battle([{ ...at("foot", "player", [2, 1]), items: full }], { treasures: TREASURES });

    expect(() => b.investigate()).toThrow(BattleCommandError);
    expect(b.state.treasuresTaken).toEqual([]);
    expect(b.unit("foot").items).toHaveLength(8);
  });

  it("조사는 행동 한 번을 소비한다", () => {
    const b = battle([at("foot", "player", [2, 1])], { treasures: TREASURES });
    b.investigate();

    expect(b.unit("foot").acted).toBe(true);
  });

  it("보물이 없는 스테이지에서는 언제나 거부한다", () => {
    const b = battle([at("foot", "player", [2, 1])]);

    expect(() => b.investigate()).toThrow(BattleCommandError);
  });
});

describe("날씨 — 고정", () => {
  it("스테이지가 문자열로 적은 날씨를 그대로 쓴다 (M1 데이터 형식)", () => {
    expect(battle([at("foot", "player", [1, 1])], { weather: "clear" }).state.weather).toBe("clear");
    expect(battle([at("foot", "player", [1, 1])], { weather: "rain" }).state.weather).toBe("rain");
  });

  it("고정 날씨는 턴이 지나도 바뀌지 않는다", () => {
    const b = battle([at("foot", "player", [1, 1])], { weather: "clear" });

    for (let turn = 0; turn < 5; turn += 1) {
      beginPhase(b.ctx, b.state, createRng(1));
      endPhase(b.state);
      endPhase(b.state);
    }

    expect(b.state.weather).toBe("clear");
  });
});

describe("날씨 — 동적", () => {
  /** 반드시 비가 오고 2턴 유지되는 설정. */
  const ALWAYS_RAIN: BattleFixtureOptions = {
    weather: { initial: "clear", rainChance: 1, rainDuration: 2 },
  };
  const NEVER_RAIN: BattleFixtureOptions = {
    weather: { initial: "clear", rainChance: 0, rainDuration: 2 },
  };

  it("확률에 걸리면 비가 시작된다", () => {
    const b = battle([at("foot", "player", [1, 1])], ALWAYS_RAIN);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.state.weather).toBe("rain");
  });

  it("확률이 0이면 개인 채로 남는다", () => {
    const b = battle([at("foot", "player", [1, 1])], NEVER_RAIN);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.state.weather).toBe("clear");
  });

  it("정해진 턴 수만큼 유지되고 그친다", () => {
    const b = battle([at("foot", "player", [1, 1])], {
      weather: { initial: "clear", rainChance: 1, rainDuration: 2 },
    });

    const nextTurn = () => {
      beginPhase(b.ctx, b.state, createRng(1));
      endPhase(b.state);
      endPhase(b.state);
    };

    nextTurn(); // 1턴 시작: 비가 내리기 시작한다
    expect(b.state.weather).toBe("rain");
    nextTurn(); // 2턴 시작: 지속 턴이 남아 그대로 비다
    expect(b.state.weather).toBe("rain");
    nextTurn(); // 3턴 시작: 지속 턴이 다해 그친다

    expect(b.state.weather).toBe("clear");
    expect(b.state.weatherTurnsLeft).toBe(0);
  });

  it("적 페이즈에는 날씨가 바뀌지 않는다 — 날씨는 턴 단위다", () => {
    const b = battle([at("foot2", "enemy", [2, 1])], ALWAYS_RAIN);
    b.state.phase = "enemy";

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.state.weather).toBe("clear");
  });

  it("같은 시드는 같은 날씨를 낸다 (NFR-01)", () => {
    const run = () => {
      const b = battle([at("foot", "player", [1, 1])], {
        weather: { initial: "clear", rainChance: 0.5, rainDuration: 2 },
      });
      const rng = createRng(20260818);
      const seen: string[] = [];
      for (let turn = 0; turn < 6; turn += 1) {
        beginPhase(b.ctx, b.state, rng);
        seen.push(b.state.weather);
        endPhase(b.state);
        endPhase(b.state);
      }
      return seen;
    };

    expect(run()).toEqual(run());
    // 확률 0.5가 실제로 갈린다 — 전부 같으면 난수가 판정에 쓰이지 않아도 통과한다.
    expect(new Set(run()).size).toBeGreaterThan(1);
  });

  it("비가 오면 화계를 쓸 수 없다 (TASK-24 게이트와 연결)", () => {
    const b = battle([at("mage", "player", [1, 1])], ALWAYS_RAIN);
    beginPhase(b.ctx, b.state, createRng(1));

    const reason = tacticRejection(
      b.ctx,
      b.state,
      b.unit("mage"),
      tacticOf(b.ctx, "fire_arrow"),
      [2, 1],
    );

    expect(reason).not.toBeNull();
  });
});
