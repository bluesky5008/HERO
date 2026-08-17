import { describe, expect, it } from "vitest";
import { planUnitTurn, runAiPhase } from "../../src/core/battle/ai";
import { createRng } from "../../src/core/rng";
import type { BattleContext, BattleState, Unit } from "../../src/core/battle/state";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type UnitSpec } from "./fixtures";

/**
 * 1단계 적 AI([전체 설계 §3.4], DES-01 → FR-11).
 * 가장 가까운 상대에게 접근해 공격하고, 닿지 않으면 이동만 한다.
 * 어떤 배치에서도 페이즈가 유한하게 끝나야 한다.
 */

const PLAIN = Array.from({ length: 7 }, () => ".......");

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

/** 적 페이즈로 세운 전장. AI는 언제나 현재 페이즈 진영을 움직인다. */
function enemyPhase(
  rows: string[],
  specs: UnitSpec[],
): { ctx: BattleContext; state: BattleState; actor: (officerId: string) => Unit } {
  const { ctx, state } = makeBattle(rows, specs);
  state.phase = "enemy";

  return {
    ctx,
    state,
    actor: (officerId) => state.units.find((unit) => unit.officerId === officerId)!,
  };
}

describe("planUnitTurn", () => {
  it("사거리 안에 상대가 있으면 이동하지 않고 공격한다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("foot2", "enemy", [3, 3]),
      at("foot", "player", [4, 3]),
    ]);

    expect(planUnitTurn(ctx, state, actor("foot2"))).toEqual([
      { type: "attack", officerId: "foot2", targetId: "foot" },
    ]);
  });

  it("사거리 밖이면 공격할 수 있는 자리까지 이동한 뒤 공격한다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("foot2", "enemy", [0, 3]),
      at("foot", "player", [3, 3]),
    ]);

    // 공격 가능한 자리 중 가장 적게 움직이는 칸을 고른다.
    expect(planUnitTurn(ctx, state, actor("foot2"))).toEqual([
      { type: "move", officerId: "foot2", to: [2, 3] },
      { type: "attack", officerId: "foot2", targetId: "foot" },
    ]);
  });

  it("이번 페이즈에 닿지 않으면 가장 가까이 접근하고 대기한다", () => {
    // 군악대는 이동력 4 — [6,3]의 상대를 치려면 [5,3]까지 가야 하는데 코스트 5다.
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("band", "enemy", [0, 3]),
      at("foot", "player", [6, 3]),
    ]);

    expect(planUnitTurn(ctx, state, actor("band"))).toEqual([
      { type: "move", officerId: "band", to: [4, 3] },
      { type: "wait", officerId: "band" },
    ]);
  });

  it("가장 가까운 상대를 고른다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("band", "enemy", [0, 0]),
      at("foot", "player", [0, 3]), // 거리 3
      at("foot2", "player", [4, 0]), // 거리 4 — 둘 다 이번 페이즈에 칠 수 있다
    ]);

    expect(planUnitTurn(ctx, state, actor("band"))).toContainEqual({
      type: "attack",
      officerId: "band",
      targetId: "foot",
    });
  });

  it("거리가 같으면 무장 ID 순으로 골라 결정론을 지킨다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("band", "enemy", [2, 2]),
      at("foot2", "player", [4, 2]),
      at("foot", "player", [0, 2]),
    ]);

    expect(planUnitTurn(ctx, state, actor("band"))).toContainEqual({
      type: "attack",
      officerId: "band",
      targetId: "foot",
    });
  });

  it("갇혀서 접근할 수 없으면 대기한다", () => {
    const rows = ["^^^^^", "^.^^^", "^^^^^", ".....", "....."];
    const { ctx, state, actor } = enemyPhase(rows, [
      at("foot2", "enemy", [1, 1]),
      at("foot", "player", [0, 3]),
    ]);

    expect(planUnitTurn(ctx, state, actor("foot2"))).toEqual([
      { type: "wait", officerId: "foot2" },
    ]);
  });

  it("상대가 남아 있지 않으면 대기한다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [at("foot2", "enemy", [3, 3])]);

    expect(planUnitTurn(ctx, state, actor("foot2"))).toEqual([
      { type: "wait", officerId: "foot2" },
    ]);
  });
});

describe("runAiPhase", () => {
  it("현재 페이즈 진영의 부대를 모두 행동시킨다", () => {
    const { ctx, state } = enemyPhase(PLAIN, [
      at("foot2", "enemy", [2, 3]),
      at("horse", "enemy", [0, 0]),
      at("foot", "player", [3, 3]),
    ]);
    const target = state.units.find((unit) => unit.officerId === "foot")!;
    const before = target.hp;

    runAiPhase(ctx, state, createRng(1));

    expect(state.units.filter((unit) => unit.side === "enemy").every((unit) => unit.acted)).toBe(
      true,
    );
    expect(target.hp).toBeLessThan(before);
  });

  it("상대에게 닿을 수 없어도 페이즈가 끝난다", () => {
    // 산으로 완전히 갈린 전장 — 접근 경로가 없다.
    const rows = [".....", ".....", "^^^^^", ".....", "....."];
    const { ctx, state } = enemyPhase(rows, [
      at("foot2", "enemy", [0, 0]),
      at("band", "enemy", [4, 1]),
      at("foot", "player", [2, 4]),
    ]);

    runAiPhase(ctx, state, createRng(1));

    expect(state.units.filter((unit) => unit.side === "enemy").every((unit) => unit.acted)).toBe(
      true,
    );
  });

  it("이미 행동을 마친 부대는 다시 움직이지 않는다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("foot2", "enemy", [0, 3]),
      at("foot", "player", [6, 3]),
    ]);
    const enemy = actor("foot2");
    enemy.acted = true;

    runAiPhase(ctx, state, createRng(1));

    expect(enemy.pos).toEqual([0, 3]);
  });

  it("승패가 갈리면 남은 부대를 움직이지 않는다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("foot2", "enemy", [2, 3]),
      at("horse", "enemy", [4, 3]),
      { ...at("foot", "player", [3, 3]), hp: 1 }, // 격파되면 패배 조건이 성립한다
    ]);

    runAiPhase(ctx, state, createRng(1));

    expect(actor("foot2").acted).toBe(true);
    expect(actor("horse").acted).toBe(false);
  });
});
