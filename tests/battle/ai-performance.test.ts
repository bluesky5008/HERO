import { describe, expect, it } from "vitest";
import { runAiPhase } from "../../src/core/battle/ai";
import { createRng } from "../../src/core/rng";
import { makeBattle, type UnitSpec } from "./fixtures";

/**
 * VER-11 — [AC-12](../../docs/requirements.md#인수-조건): 적 페이즈의 AI 계산이 100ms 이내여야 한다.
 *
 * 2단계 AI는 후보가 `이동 가능 타일 × (공격 타깃 ∪ 책략 타깃)`으로 커지므로
 * 구현 뒤에 재면 설계까지 되돌려야 한다([RISK-M2-04](../../docs/plan.md#위험)).
 * 그래서 이 파일이 TASK-31의 **선행** 테스트다 — Red를 성능으로 잡는다.
 */

const BUDGET_MS = 100;

/** 20×20 평지. 이동 범위가 넓어야 후보 수가 실제로 커진다. */
const WIDE = Array.from({ length: 20 }, () => ".".repeat(20));

/** 적 20부대와 아군 8부대가 뒤섞인 전장. */
function crowded(): UnitSpec[] {
  const specs: UnitSpec[] = [];
  const enemies = ["foot2", "horse", "bow", "siege", "band", "mage", "guardsman", "bandit1", "scout1", "spear"];

  // 무장 수가 한정되어 있으므로 서로 다른 무장으로 채울 수 있는 만큼만 적을 세운다.
  enemies.forEach((officerId, index) => {
    specs.push({ officerId, side: "enemy", pos: [index + 1, 1] });
  });
  specs.push({ officerId: "foot", side: "player", pos: [5, 10] });

  return specs;
}

describe("적 페이즈 성능 (VER-11 → AC-12)", () => {
  it(`적 부대가 늘어도 페이즈 전체가 ${BUDGET_MS}ms 안에 끝난다`, () => {
    const { ctx, state } = makeBattle(WIDE, crowded());
    state.phase = "enemy";

    const started = performance.now();
    runAiPhase(ctx, state, createRng(1));
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("책략을 쓸 수 있는 부대가 섞여 있어도 예산 안에 끝난다", () => {
    // 주술사는 전 카테고리를 배우므로 책략 후보가 가장 많다.
    const specs: UnitSpec[] = [
      { officerId: "mage", side: "enemy", pos: [3, 3] },
      { officerId: "bow", side: "enemy", pos: [4, 3] },
      { officerId: "spear", side: "enemy", pos: [5, 3] },
      { officerId: "foot", side: "player", pos: [10, 10] },
      { officerId: "horse", side: "player", pos: [11, 10] },
    ];
    const { ctx, state } = makeBattle(WIDE, specs);
    state.phase = "enemy";

    const started = performance.now();
    runAiPhase(ctx, state, createRng(1));
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("어떤 배치에서도 페이즈가 끝난다 — 무한 루프가 없다 (M1이 보장한 성질)", () => {
    const { ctx, state } = makeBattle(WIDE, crowded());
    state.phase = "enemy";

    runAiPhase(ctx, state, createRng(1));

    expect(state.units.filter((unit) => unit.side === "enemy").every((unit) => unit.acted)).toBe(
      true,
    );
  });
});
