import { describe, expect, it } from "vitest";
import { beginPhase, endPhase, isPhaseComplete, outcome } from "../../src/core/battle/turn";
import type { BattleState } from "../../src/core/battle/state";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type UnitSpec } from "./fixtures";

/**
 * 페이즈 교대와 승패 판정([상세 스펙 §1.1], DES-01 → FR-02).
 * 픽스처 전장의 승리 조건은 적 전멸, 패배 조건은 무장 `foot`의 격파다.
 */

const PLAIN = Array.from({ length: 5 }, () => ".....");

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

/** 패배 조건 무장(foot)과 적 하나가 마주 선 전장. */
const skirmish = () =>
  makeBattle(PLAIN, [at("foot", "player", [1, 1]), at("foot2", "enemy", [3, 1])]);

const drop = (state: BattleState, officerId: string): void => {
  state.units = state.units.filter((unit) => unit.officerId !== officerId);
};

describe("endPhase", () => {
  it("플레이어 페이즈가 끝나면 적 페이즈가 되고 턴은 그대로다", () => {
    const { ctx, state } = skirmish();
    endPhase(ctx, state, createRng(1));

    expect(state.phase).toBe("enemy");
    expect(state.turn).toBe(1);
  });

  it("적 페이즈가 끝나면 플레이어 페이즈로 돌아오고 턴이 1 오른다", () => {
    const { ctx, state } = skirmish();
    endPhase(ctx, state, createRng(1));
    endPhase(ctx, state, createRng(1));

    expect(state.phase).toBe("player");
    expect(state.turn).toBe(2);
  });

  it("새 페이즈를 맞은 진영의 이동·행동 기록을 지운다", () => {
    const { ctx, state } = skirmish();
    const enemy = state.units[1]!;
    enemy.moved = true;
    enemy.acted = true;

    endPhase(ctx, state, createRng(1));

    expect(enemy.moved).toBe(false);
    expect(enemy.acted).toBe(false);
  });

  it("행동을 마친 진영의 기록은 자기 차례가 돌아올 때까지 남는다", () => {
    const { ctx, state } = skirmish();
    const player = state.units[0]!;
    player.moved = true;
    player.acted = true;

    endPhase(ctx, state, createRng(1)); // 적 페이즈 — 플레이어 부대는 아직 행동을 마친 상태로 보여야 한다
    expect(player.acted).toBe(true);

    endPhase(ctx, state, createRng(1)); // 다시 플레이어 페이즈
    expect(player.moved).toBe(false);
    expect(player.acted).toBe(false);
  });
});

describe("beginPhase — 턴 시작 처리 순서 ([상세 스펙 §1.1])", () => {
  /** 거점([3, 1])이 한 칸 있는 전장. 사기 26에서 거점 회복 +5를 받으면 혼란 임계값 30을 넘는다. */
  const VILLAGE_MAP = ["........", "...v....", "........"];

  it("거점 회복(②)이 혼란 판정(④)보다 먼저 일어난다", () => {
    const { ctx, state } = makeBattle(
      VILLAGE_MAP,
      [{ officerId: "foot", side: "player", pos: [3, 1], morale: 26 }],
      { combatConfig: { confusion: { threshold: 30, chance: 1 } } },
    );

    beginPhase(ctx, state, createRng(1));

    // 회복이 먼저라 사기가 31이 되고, 그래서 확률 1의 혼란 판정을 아예 받지 않는다.
    expect(state.units[0]!.morale).toBe(31);
    expect(state.units[0]!.confused).toBe(false);
  });

  it("거점 밖에서는 같은 사기가 혼란으로 이어진다", () => {
    const { ctx, state } = makeBattle(
      VILLAGE_MAP,
      [{ officerId: "foot", side: "player", pos: [1, 1], morale: 26 }],
      { combatConfig: { confusion: { threshold: 30, chance: 1 } } },
    );

    beginPhase(ctx, state, createRng(1));

    expect(state.units[0]!.confused).toBe(true);
  });
});

describe("isPhaseComplete", () => {
  it("현재 페이즈 진영이 모두 행동을 마치면 참이다", () => {
    const { state } = skirmish();
    state.units[0]!.acted = true;

    expect(isPhaseComplete(state)).toBe(true);
  });

  it("한 부대라도 행동이 남아 있으면 거짓이다", () => {
    const { state } = makeBattle(PLAIN, [
      at("foot", "player", [1, 1]),
      at("horse", "player", [2, 1]),
      at("foot2", "enemy", [3, 1]),
    ]);
    state.units[0]!.acted = true;

    expect(isPhaseComplete(state)).toBe(false);
  });

  it("상대 진영의 행동 여부는 보지 않는다", () => {
    const { ctx, state } = skirmish();
    state.units[0]!.acted = true; // 플레이어만 행동을 마쳤다

    expect(isPhaseComplete(state)).toBe(true);
    endPhase(ctx, state, createRng(1));
    expect(isPhaseComplete(state)).toBe(false);
  });

  it("현재 페이즈 진영에 부대가 없으면 참이다", () => {
    const { ctx, state } = skirmish();
    drop(state, "foot2");
    endPhase(ctx, state, createRng(1));

    expect(isPhaseComplete(state)).toBe(true);
  });
});

describe("outcome", () => {
  it("양쪽이 남아 있으면 아직 승패가 갈리지 않았다", () => {
    const { ctx, state } = skirmish();
    expect(outcome(ctx, state)).toBeNull();
  });

  it("적이 전멸하면 승리다", () => {
    const { ctx, state } = skirmish();
    drop(state, "foot2");

    expect(outcome(ctx, state)).toBe("victory");
  });

  it("패배 조건 무장이 격파되면 패배다", () => {
    const { ctx, state } = skirmish();
    drop(state, "foot");

    expect(outcome(ctx, state)).toBe("defeat");
  });

  it("승리와 패배가 함께 성립하면 패배가 이긴다", () => {
    const { ctx, state } = skirmish();
    drop(state, "foot");
    drop(state, "foot2");

    expect(outcome(ctx, state)).toBe("defeat");
  });
});
