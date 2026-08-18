import { describe, expect, it } from "vitest";
import { applyCommand, BattleCommandError } from "../../src/core/battle/commands";
import { changeMorale } from "../../src/core/battle/morale";
import { beginPhase, endPhase, isPhaseComplete } from "../../src/core/battle/turn";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 사기와 혼란([상세 스펙 §1.4], 거점 회복 §1.7, 턴 시작 처리 §1.1, DES-01 → FR-05).
 * 사기는 데미지 공식에 직접 들어가는 항이므로(§1.3) 여기서 고정하는 값이 전투력에 그대로 반영된다.
 */

/** 가운데 한 칸([3, 1])만 거점인 전장. */
const MAP = ["........", "...v....", "........"];

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

const VILLAGE: Pos = [3, 1];

function battle(specs: UnitSpec[], options: BattleFixtureOptions = {}) {
  const { ctx, state } = makeBattle(MAP, specs, options);
  return {
    ctx,
    state,
    unit: (officerId: string) => state.units.find((c) => c.officerId === officerId)!,
  };
}

describe("changeMorale", () => {
  it("사기를 옮기고 변화를 이벤트로 남긴다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 50 }]);

    expect(changeMorale(b.ctx, b.unit("foot"), -8)).toEqual([
      { type: "moraleChanged", officerId: "foot", from: 50, to: 42 },
    ]);
    expect(b.unit("foot").morale).toBe(42);
  });

  it("사기는 0 미만으로 내려가지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 3 }]);
    changeMorale(b.ctx, b.unit("foot"), -10);

    expect(b.unit("foot").morale).toBe(0);
  });

  it("사기는 상한을 넘지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 96 }]);
    changeMorale(b.ctx, b.unit("foot"), 10);

    expect(b.unit("foot").morale).toBe(100);
  });

  it("사기가 그대로면 이벤트를 내지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 100 }]);

    expect(changeMorale(b.ctx, b.unit("foot"), 5)).toEqual([]);
  });

  it("사기가 임계값 이상으로 회복되면 혼란이 즉시 해제된다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 25, confused: true }]);
    changeMorale(b.ctx, b.unit("foot"), 10);

    expect(b.unit("foot").confused).toBe(false);
  });

  it("임계값에 못 미치게 회복하면 혼란이 남는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 25, confused: true }]);
    changeMorale(b.ctx, b.unit("foot"), 2);

    expect(b.unit("foot").confused).toBe(true);
  });
});

describe("피격 사기 감소", () => {
  /** 공격 한 번을 적용하고 방어측을 돌려준다. 방어측이 버티도록 병력을 넉넉히 둔다. */
  function trade(options: BattleFixtureOptions = {}) {
    const b = battle(
      [at("foot", "player", [1, 1]), { ...at("foot2", "enemy", [2, 1]), morale: 100 }],
      options,
    );
    const events = applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot", targetId: "foot2" },
      createRng(1),
    );
    return { ...b, events };
  }

  it("피격측이 moraleLossOnHit만큼 사기를 잃는다", () => {
    const b = trade();

    expect(b.unit("foot2").morale).toBe(100 - b.ctx.data.combatConfig.moraleLossOnHit);
  });

  it("사기 변화를 이벤트로 남긴다", () => {
    const b = trade({ combatConfig: { moraleLossOnHit: 3 } });

    expect(b.events).toContainEqual({
      type: "moraleChanged",
      officerId: "foot2",
      from: 100,
      to: 97,
    });
  });

  it("공격측의 사기는 바뀌지 않는다", () => {
    const b = trade();

    expect(b.unit("foot").morale).toBe(100);
  });
});

describe("beginPhase — 혼란 판정 (턴 시작 ④)", () => {
  /** 반드시 혼란에 걸리는 설정과 절대 걸리지 않는 설정. */
  const ALWAYS: BattleFixtureOptions = { combatConfig: { confusion: { threshold: 30, chance: 1 } } };
  const NEVER: BattleFixtureOptions = { combatConfig: { confusion: { threshold: 30, chance: 0 } } };

  it("사기가 임계값 미만이면 혼란에 빠지고 이벤트를 낸다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 29 }], ALWAYS);
    const events = beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").confused).toBe(true);
    expect(events).toContainEqual({ type: "confused", officerId: "foot" });
  });

  it("혼란에 빠진 부대는 그 턴의 행동을 쓴 것으로 처리해 페이즈가 끝난다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 29 }], ALWAYS);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").acted).toBe(true);
    expect(b.unit("foot").moved).toBe(true);
  });

  it("사기가 임계값 이상이면 판정하지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 30 }], ALWAYS);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").confused).toBe(false);
    expect(b.unit("foot").acted).toBe(false);
  });

  it("확률이 0이면 사기가 낮아도 혼란에 빠지지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 5 }], NEVER);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").confused).toBe(false);
  });

  it("이미 혼란인 부대는 사기가 낮은 동안 계속 조작할 수 없다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 5, confused: true }], NEVER);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").confused).toBe(true);
    expect(b.unit("foot").acted).toBe(true);
  });

  it("차례를 받지 않은 진영은 판정하지 않는다", () => {
    const b = battle([{ ...at("foot2", "enemy", [2, 1]), morale: 5 }], ALWAYS);
    beginPhase(b.ctx, b.state, createRng(1)); // 플레이어 페이즈

    expect(b.unit("foot2").confused).toBe(false);
  });

  it("같은 시드는 같은 판정을 낸다 (NFR-01)", () => {
    const half: BattleFixtureOptions = {
      combatConfig: { confusion: { threshold: 30, chance: 0.5 } },
    };
    const run = () => {
      const b = battle(
        [
          { ...at("foot", "player", [1, 1]), morale: 10 },
          { ...at("horse", "player", [4, 1]), morale: 10 },
          { ...at("bow", "player", [5, 1]), morale: 10 },
        ],
        half,
      );
      beginPhase(b.ctx, b.state, createRng(1));
      return b.state.units.map((unit) => unit.confused);
    };

    // 시드 1의 앞 세 난수는 0.092 / 0.506 / 0.888이므로 확률 0.5에서 첫 부대만 걸린다.
    // 값이 갈리는 시드를 골랐다 — 전부 같은 결과라면 난수가 판정에 쓰이지 않아도 통과한다.
    expect(run()).toEqual([true, false, false]);
    expect(run()).toEqual(run());
  });
});

describe("혼란은 한 턴짜리 상태다 ([상세 스펙 §1.4]의 \"그 턴 조작 불가\")", () => {
  /** 사기와 무관하게 혼란이 걸린 상태 — 교란 책략이 만드는 상황이다. */
  const struck = () =>
    battle([
      { ...at("foot", "player", [1, 1]), morale: 100, confused: true },
      at("foot2", "enemy", [2, 1]),
    ]);

  it("사기가 높아도 혼란이면 그 턴을 잃는다", () => {
    const b = struck();
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").acted).toBe(true);
  });

  it("그래서 전원이 혼란이어도 페이즈가 끝난다", () => {
    const b = struck();
    beginPhase(b.ctx, b.state, createRng(1));

    expect(isPhaseComplete(b.state)).toBe(true);
  });

  it("차례를 마치면 혼란이 풀려 다음 턴에는 움직인다", () => {
    const b = struck();
    beginPhase(b.ctx, b.state, createRng(1));

    endPhase(b.ctx, b.state, createRng(1)); // 플레이어 → 적: 차례를 마친 진영의 혼란이 풀린다
    expect(b.unit("foot").confused).toBe(false);

    endPhase(b.ctx, b.state, createRng(1)); // 적 → 플레이어
    beginPhase(b.ctx, b.state, createRng(1));
    expect(b.unit("foot").acted).toBe(false);
  });

  it("사기가 낮으면 턴마다 다시 판정하므로 혼란이 이어질 수 있다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 5 }], {
      combatConfig: { confusion: { threshold: 30, chance: 1 } },
    });

    beginPhase(b.ctx, b.state, createRng(1));
    expect(b.unit("foot").confused).toBe(true);

    endPhase(b.ctx, b.state, createRng(1));
    endPhase(b.ctx, b.state, createRng(1));
    beginPhase(b.ctx, b.state, createRng(1));
    expect(b.unit("foot").confused).toBe(true);
  });
});

describe("beginPhase — 거점 회복 (턴 시작 ②)", () => {
  it("거점 위 부대는 병력 상한의 비율만큼 회복하고 사기를 얻는다", () => {
    const b = battle([{ ...at("foot", "player", VILLAGE), morale: 50, hp: 1000 }]);
    const { strongholdRecovery } = b.ctx.data.combatConfig;
    const before = b.unit("foot").hpMax;

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(1000 + Math.floor(before * strongholdRecovery.hpRatio));
    expect(b.unit("foot").morale).toBe(50 + strongholdRecovery.morale);
  });

  it("회복한 병력과 사기는 상한을 넘지 않는다", () => {
    const b = battle([{ ...at("foot", "player", VILLAGE), morale: 98 }]);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(b.unit("foot").hpMax);
    expect(b.unit("foot").morale).toBe(100);
  });

  it("회복을 이벤트로 남긴다", () => {
    const b = battle([{ ...at("foot", "player", VILLAGE), morale: 50, hp: 1000 }]);
    const events = beginPhase(b.ctx, b.state, createRng(1));

    expect(events).toContainEqual({ type: "healed", officerId: "foot", amount: 140 });
  });

  it("거점 위 부대는 책략치도 회복한다 ([상세 스펙 §1.5] — 자연 회복은 거점에서만)", () => {
    const b = battle([{ ...at("foot", "player", VILLAGE), mp: 0 }]);
    const { mp } = b.ctx.data.combatConfig.strongholdRecovery;

    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").mp).toBe(mp);
  });

  it("회복한 책략치는 상한을 넘지 않는다", () => {
    const b = battle([at("foot", "player", VILLAGE)]);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").mp).toBe(b.unit("foot").mpMax);
  });

  it("거점 밖 부대는 책략치를 회복하지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), mp: 0 }]);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").mp).toBe(0);
  });

  it("거점 밖 부대는 회복하지 않는다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 50, hp: 1000 }]);
    beginPhase(b.ctx, b.state, createRng(1));

    expect(b.unit("foot").hp).toBe(1000);
    expect(b.unit("foot").morale).toBe(50);
  });

  it("차례를 받지 않은 진영은 회복하지 않는다", () => {
    const b = battle([{ ...at("foot2", "enemy", VILLAGE), morale: 50, hp: 1000 }]);
    beginPhase(b.ctx, b.state, createRng(1)); // 플레이어 페이즈

    expect(b.unit("foot2").hp).toBe(1000);
  });
});

describe("혼란 부대의 조작", () => {
  const confused = () =>
    battle([
      { ...at("foot", "player", [1, 1]), morale: 5, confused: true },
      at("foot2", "enemy", [2, 1]),
    ]);

  it("이동 커맨드를 거부한다", () => {
    const b = confused();

    expect(() =>
      applyCommand(b.ctx, b.state, { type: "move", officerId: "foot", to: [1, 2] }, createRng(1)),
    ).toThrow(BattleCommandError);
    expect(b.unit("foot").pos).toEqual([1, 1]);
  });

  it("공격 커맨드를 거부한다", () => {
    const b = confused();

    expect(() =>
      applyCommand(
        b.ctx,
        b.state,
        { type: "attack", officerId: "foot", targetId: "foot2" },
        createRng(1),
      ),
    ).toThrow(BattleCommandError);
    expect(b.unit("foot2").hp).toBe(b.unit("foot2").hpMax);
  });

  it("혼란이 아니면 그대로 움직인다", () => {
    const b = battle([{ ...at("foot", "player", [1, 1]), morale: 5 }]);
    applyCommand(b.ctx, b.state, { type: "move", officerId: "foot", to: [1, 2] }, createRng(1));

    expect(b.unit("foot").pos).toEqual([1, 2]);
  });
});
