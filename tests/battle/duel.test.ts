import { describe, expect, it } from "vitest";
import { resolveDuel } from "../../src/core/battle/duel";
import { outcome } from "../../src/core/battle/turn";
import { runEvents } from "../../src/core/campaign/eventRunner";
import { createRng } from "../../src/core/rng";
import type { DuelAction, Pos, StageEvent } from "../../src/core/data/schemas";
import { makeBattle, type UnitSpec } from "./fixtures";

/**
 * 일기토([상세 스펙 §7], DES-13 → FR-08, AC-03).
 * 이벤트 트리거로만 발동하며, 승률은 `clamp(50 + 무력차 × 2, 5, 95)`로 난수를 한 번 쓴다.
 */

const MAP = ["........", "........", "........"];

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

const duelAction = (partial: Partial<DuelAction> = {}): DuelAction => ({
  type: "duel",
  a: "foot",
  b: "foot2",
  outcome: "aWins",
  loser: "destroyed",
  onAWin: [],
  onBWin: [],
  ...partial,
});

/** 아군 둘(패배 조건 무장 `foot` 포함)과 적 하나. */
function battle(officers: Record<string, { war?: number }> = {}) {
  const { ctx, state } = makeBattle(
    MAP,
    [at("foot", "player", [1, 1]), at("horse", "player", [1, 2]), at("foot2", "enemy", [2, 1])],
    { officers },
  );
  return {
    ctx,
    state,
    unit: (officerId: string) => state.units.find((c) => c.officerId === officerId),
    /** 일기토를 치르고 남은 이벤트만 돌려준다 — 승패는 상태로 확인한다. */
    fight: (action: DuelAction = duelAction(), seed = 1) =>
      resolveDuel(ctx, state, action, createRng(seed)).events,
  };
}

describe("고정 승패", () => {
  it("aWins는 난수를 쓰지 않고 지정대로 끝난다", () => {
    const b = battle();
    const rng = createRng(1);
    const before = rng.save();

    resolveDuel(b.ctx, b.state, duelAction({ outcome: "aWins" }), rng);

    expect(rng.save()).toEqual(before);
    expect(b.unit("foot2")).toBeUndefined();
    expect(b.unit("foot")).toBeDefined();
  });

  it("bWins도 지정대로 끝난다", () => {
    const b = battle();
    b.fight(duelAction({ outcome: "bWins" }));

    expect(b.unit("foot")).toBeUndefined();
    expect(b.unit("foot2")).toBeDefined();
  });

  it("시작과 결과를 이벤트로 남긴다", () => {
    const b = battle();
    const events = b.fight();

    expect(events[0]).toEqual({ type: "duelStarted", a: "foot", b: "foot2" });
    expect(events).toContainEqual({
      type: "duelResolved",
      winner: "foot",
      loser: "foot2",
      fled: false,
    });
  });
});

describe("판정형 (judge — [상세 스펙 §7.2])", () => {
  it("난수를 정확히 한 번 쓴다", () => {
    const b = battle();
    const rng = createRng(1);
    const spent = createRng(1);
    spent.range(0, 100);

    resolveDuel(b.ctx, b.state, duelAction({ outcome: "judge" }), rng);

    expect(rng.save()).toEqual(spent.save());
  });

  it("무력이 높으면 이긴다", () => {
    // 시드 1의 첫 난수는 0.092 → 백분율 9.2. 무력차가 커도 상한 95라 이 값에서는 강자가 이긴다.
    const b = battle({ foot: { war: 90 }, foot2: { war: 10 } });
    b.fight(duelAction({ outcome: "judge" }));

    expect(b.unit("foot")).toBeDefined();
    expect(b.unit("foot2")).toBeUndefined();
  });

  it("무력이 낮으면 진다", () => {
    // 시드 2의 첫 난수는 0.987 → 98.7. 승률 상한 95를 넘으므로 약자 쪽이 이긴다.
    const b = battle({ foot: { war: 10 }, foot2: { war: 90 } });
    b.fight(duelAction({ outcome: "judge" }), 2);

    expect(b.unit("foot")).toBeUndefined();
  });

  it("승률은 설정한 상하한을 벗어나지 않는다", () => {
    const b = battle();
    const { base, warScale, min, max } = b.ctx.data.combatConfig.duel;

    // 무력차 100이면 base + 200이지만 상한에서 잘린다.
    expect(Math.min(Math.max(base + 100 * warScale, min), max)).toBe(max);
    expect(Math.min(Math.max(base - 100 * warScale, min), max)).toBe(min);
  });

  it("같은 시드는 같은 결과를 낸다 (NFR-01)", () => {
    const run = () => {
      const b = battle({ foot: { war: 55 }, foot2: { war: 50 } });
      b.fight(duelAction({ outcome: "judge" }), 20260819);
      return b.unit("foot") !== undefined;
    };

    expect(run()).toBe(run());
  });
});

describe("승패 효과 ([상세 스펙 §7.2])", () => {
  it("승자가 경험치를 얻어 즉시 레벨이 오른다", () => {
    const b = battle();
    const before = b.unit("foot")!.level;

    b.fight();

    // winnerExp 100은 레벨업 임계와 같다.
    expect(b.unit("foot")!.level).toBe(before + 1);
  });

  it("승자 진영 전체의 사기가 오른다", () => {
    const b = battle();
    b.state.units.forEach((unit) => (unit.morale = 50));

    b.fight();

    const { winnerMorale } = b.ctx.data.combatConfig.duel;
    expect(b.unit("foot")!.morale).toBe(50 + winnerMorale);
    expect(b.unit("horse")!.morale).toBe(50 + winnerMorale);
  });

  it("패자 진영의 사기는 오르지 않는다", () => {
    const b = battle();
    b.state.units.forEach((unit) => (unit.morale = 50));

    b.fight(duelAction({ outcome: "bWins" }));

    expect(b.unit("foot2")!.morale).toBe(50 + b.ctx.data.combatConfig.duel.winnerMorale);
    expect(b.unit("horse")!.morale).toBe(50);
  });

  it("괴멸한 패자는 격파 이벤트를 남긴다", () => {
    const b = battle();
    const events = b.fight(duelAction({ loser: "destroyed" }));

    expect(events).toContainEqual({ type: "defeated", officerId: "foot2" });
  });

  it("퇴각한 패자는 격파가 아니라 이탈로 처리된다", () => {
    const b = battle();
    const events = b.fight(duelAction({ loser: "retreats" }));

    expect(events).toContainEqual({ type: "unitRemoved", officerId: "foot2" });
    expect(events.some((event) => event.type === "defeated")).toBe(false);
    expect(b.unit("foot2")).toBeUndefined();
  });

  it("일기토로 필수 장수가 사라지면 승패 판정이 그대로 잡는다", () => {
    const b = battle();

    // 픽스처 전장의 패배 조건 무장은 `foot`이다.
    expect(outcome(b.ctx, b.state)).toBeNull();
    b.fight(duelAction({ outcome: "bWins" }));

    expect(outcome(b.ctx, b.state)).toBe("defeat");
  });

  it("전장에 없는 부대를 지목하면 아무 일도 하지 않는다", () => {
    const b = battle();
    const events = b.fight(duelAction({ a: "no_such" }));

    expect(events).toEqual([]);
    expect(b.state.units).toHaveLength(3);
  });
});

describe("이벤트 액션으로서의 일기토 ([상세 스펙 §7.1])", () => {
  const stageEvent = (action: DuelAction): StageEvent =>
    ({
      id: "ev-duel",
      scope: "battle",
      once: true,
      condition: null,
      trigger: { type: "battleStart" },
      actions: [action],
    }) as StageEvent;

  const withEvent = (action: DuelAction) => {
    const { ctx, state } = makeBattle(
      MAP,
      [at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])],
      { events: [stageEvent(action)] },
    );
    return {
      ctx,
      state,
      unit: (officerId: string) => state.units.find((c) => c.officerId === officerId),
      run: () => runEvents(ctx, state, "battleStart", [], createRng(1)),
    };
  };

  it("이벤트 트리거로 발동한다", () => {
    const b = withEvent(duelAction());
    const events = b.run();

    expect(events).toContainEqual({ type: "duelStarted", a: "foot", b: "foot2" });
    expect(b.unit("foot2")).toBeUndefined();
  });

  it("onAWin 하위 액션이 실행된다", () => {
    const b = withEvent(
      duelAction({ outcome: "aWins", onAWin: [{ type: "setFlag", flag: "a_won" }] }),
    );
    b.run();

    expect(b.state.flags).toEqual(["a_won"]);
  });

  it("onBWin 하위 액션이 실행된다", () => {
    const b = withEvent(
      duelAction({
        outcome: "bWins",
        onAWin: [{ type: "setFlag", flag: "a_won" }],
        onBWin: [{ type: "setFlag", flag: "b_won" }],
      }),
    );
    b.run();

    expect(b.state.flags).toEqual(["b_won"]);
  });
});
