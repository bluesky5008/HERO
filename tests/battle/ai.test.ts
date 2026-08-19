import { describe, expect, it } from "vitest";
import { planUnitTurn, runAiPhase } from "../../src/core/battle/ai";
import { createRng } from "../../src/core/rng";
import type { BattleContext, BattleState, Unit } from "../../src/core/battle/state";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 적 AI([상세 스펙 §5], DES-01 → FR-11, AC-12).
 * 프로필과 가중치 스코어링으로 행동을 고르고, 어떤 배치에서도 페이즈가 유한하게 끝난다.
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

  it("칠 수 있는 상대가 있으면 공격을 고른다", () => {
    const { ctx, state, actor } = enemyPhase(PLAIN, [
      at("band", "enemy", [0, 0]),
      at("foot", "player", [0, 3]),
      at("foot2", "player", [4, 0]),
    ]);

    const commands = planUnitTurn(ctx, state, actor("band"));

    // 어느 쪽을 고르는지는 가중치가 정한다([상세 스펙 §5.2]) — 여기서 고정하는 것은 "공격한다"까지다.
    expect(commands.some((cmd) => cmd.type === "attack")).toBe(true);
  });

  it("같은 배치는 언제나 같은 수를 낸다 (NFR-01)", () => {
    const setup = () =>
      enemyPhase(PLAIN, [
        at("band", "enemy", [2, 2]),
        at("foot2", "player", [4, 2]),
        at("foot", "player", [0, 2]),
      ]);

    const first = setup();
    const second = setup();

    // 점수가 같은 후보가 여럿이어도 순서를 고정해 같은 수가 나와야 한다.
    expect(planUnitTurn(first.ctx, first.state, first.actor("band"))).toEqual(
      planUnitTurn(second.ctx, second.state, second.actor("band")),
    );
  });

  it("갇혀서 접근할 수 없으면 대기한다", () => {
    // 기병은 배우는 책략이 없어 갇히면 정말 할 일이 없다([상세 스펙 §1.5]).
    const rows = ["^^^^^", "^.^^^", "^^^^^", ".....", "....."];
    const { ctx, state, actor } = enemyPhase(rows, [
      at("horse", "enemy", [1, 1]),
      at("foot", "player", [0, 3]),
    ]);

    expect(planUnitTurn(ctx, state, actor("horse"))).toEqual([
      { type: "wait", officerId: "horse" },
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

describe("프로필별 행동 ([상세 스펙 §5.1])", () => {
  const WIDE = Array.from({ length: 12 }, () => "............");

  const plan = (specs: UnitSpec[], officerId: string, options: BattleFixtureOptions = {}) => {
    const { ctx, state } = makeBattle(WIDE, specs, options);
    state.phase = "enemy";
    const unit = state.units.find((candidate) => candidate.officerId === officerId)!;
    return { ctx, state, unit, commands: planUnitTurn(ctx, state, unit) };
  };

  it("defensive는 경계 거리 밖에서는 대기한다", () => {
    const b = plan(
      [
        { officerId: "foot2", side: "enemy", pos: [1, 1], ai: "defensive" },
        { officerId: "foot", side: "player", pos: [11, 11] },
      ],
      "foot2",
    );

    expect(b.commands).toEqual([{ type: "wait", officerId: "foot2" }]);
    expect(b.unit.ai).toBe("defensive");
  });

  it("defensive는 경계 거리 안에 들어오면 영구히 aggressive로 바뀐다", () => {
    const b = plan(
      [
        { officerId: "foot2", side: "enemy", pos: [1, 1], ai: "defensive" },
        { officerId: "foot", side: "player", pos: [4, 1] },
      ],
      "foot2",
    );

    expect(b.unit.ai).toBe("aggressive");
    expect(b.commands.some((cmd) => cmd.type === "move")).toBe(true);
  });

  it("guard는 지정한 자리를 벗어나지 않는다", () => {
    const b = plan(
      [
        { officerId: "foot2", side: "enemy", pos: [1, 1], ai: "guard" },
        { officerId: "foot", side: "player", pos: [8, 1] },
      ],
      "foot2",
    );

    expect(b.commands.some((cmd) => cmd.type === "move")).toBe(false);
  });

  it("guard도 사거리 안의 상대는 친다", () => {
    const b = plan(
      [
        { officerId: "foot2", side: "enemy", pos: [1, 1], ai: "guard" },
        { officerId: "foot", side: "player", pos: [2, 1] },
      ],
      "foot2",
    );

    expect(b.commands).toContainEqual({ type: "attack", officerId: "foot2", targetId: "foot" });
  });

  it("flee는 지정한 탈출점으로 향한다", () => {
    const b = plan(
      [
        {
          officerId: "foot2",
          side: "enemy",
          pos: [5, 5],
          ai: "flee",
          aiParams: { escape: [11, 5] },
        },
        { officerId: "foot", side: "player", pos: [4, 5] },
      ],
      "foot2",
    );

    const move = b.commands.find((cmd) => cmd.type === "move");
    expect(move).toBeDefined();
    // 탈출점 쪽으로 가까워져야 한다.
    expect(move && move.type === "move" && move.to[0]).toBeGreaterThan(5);
  });

  it("support는 다친 아군을 회복시킨다", () => {
    const b = plan(
      [
        { officerId: "mage", side: "enemy", pos: [5, 5], ai: "support" },
        { officerId: "foot2", side: "enemy", pos: [5, 6], hp: 100 },
        { officerId: "foot", side: "player", pos: [1, 1] },
      ],
      "mage",
    );

    const tactic = b.commands.find((cmd) => cmd.type === "useTactic");
    expect(tactic).toBeDefined();
    expect(tactic && tactic.type === "useTactic" && tactic.tacticId).toBe("mend");
  });

  it("support는 자기 병력이 위험하면 물러난다", () => {
    const b = plan(
      [
        { officerId: "mage", side: "enemy", pos: [5, 5], ai: "support", hp: 100 },
        { officerId: "foot", side: "player", pos: [4, 5] },
      ],
      "mage",
    );

    const move = b.commands.find((cmd) => cmd.type === "move");
    expect(move).toBeDefined();

    // 어느 방향이든 상대에게서 멀어지기만 하면 된다.
    const distance = ([x, y]: [number, number]) => Math.abs(x - 4) + Math.abs(y - 5);
    expect(move && move.type === "move" && distance(move.to)).toBeGreaterThan(distance([5, 5]));
  });
});

describe("책략 사용 판단 ([상세 스펙 §5.2])", () => {
  const WIDE = Array.from({ length: 12 }, () => "............");

  it("기대 피해가 통상 공격을 넘고 책략치가 넉넉하면 책략을 고른다", () => {
    const { ctx, state } = makeBattle(WIDE, [
      { officerId: "mage", side: "enemy", pos: [5, 5] },
      { officerId: "foot", side: "player", pos: [6, 5] },
    ]);
    state.phase = "enemy";
    const mage = state.units[0]!;

    const commands = planUnitTurn(ctx, state, mage);

    expect(commands.some((cmd) => cmd.type === "useTactic")).toBe(true);
  });

  it("책략치가 모자라면 통상 공격으로 돌아간다", () => {
    const { ctx, state } = makeBattle(WIDE, [
      { officerId: "mage", side: "enemy", pos: [5, 5], mp: 0 },
      { officerId: "foot", side: "player", pos: [6, 5] },
    ]);
    state.phase = "enemy";
    const mage = state.units[0]!;

    const commands = planUnitTurn(ctx, state, mage);

    expect(commands.some((cmd) => cmd.type === "useTactic")).toBe(false);
    expect(commands.some((cmd) => cmd.type === "attack")).toBe(true);
  });
});
