import { describe, expect, it } from "vitest";
import {
  applyCommand,
  attackableTiles,
  BattleCommandError,
  type Command,
} from "../../src/core/battle/commands";
import { createRng } from "../../src/core/rng";
import type { Pos } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * 커맨드 적용([상세 스펙 §1.1, §1.3], DES-01 → FR-02).
 * 페이즈당 이동 1회 + 행동 1회, 순서는 "이동 → 행동" 고정이고 반격은 없다.
 */

const PLAIN = Array.from({ length: 7 }, () => ".......");

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

/** 전장 하나와 그 위에서 커맨드를 적용할 도구. 난수는 고정 시드로 고정한다. */
function battle(specs: UnitSpec[], options: BattleFixtureOptions = {}) {
  const { ctx, state } = makeBattle(PLAIN, specs, options);
  const rng = createRng(1);

  return {
    state,
    unit: (officerId: string) => state.units.find((candidate) => candidate.officerId === officerId),
    apply: (cmd: Command) => applyCommand(ctx, state, cmd, rng),
  };
}

describe("applyCommand — 이동", () => {
  it("도달 가능한 칸으로 옮기고 이동 이벤트를 낸다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(b.apply({ type: "move", officerId: "foot", to: [3, 1] })).toEqual([
      { type: "moved", officerId: "foot", from: [1, 1], to: [3, 1] },
    ]);
    expect(b.unit("foot")?.pos).toEqual([3, 1]);
  });

  it("이동 범위 밖이면 거부하고 부대를 제자리에 둔다", () => {
    const b = battle([at("band", "player", [0, 0])]); // 군악대 이동력 4

    expect(() => b.apply({ type: "move", officerId: "band", to: [5, 0] })).toThrow(
      BattleCommandError,
    );
    expect(b.unit("band")?.pos).toEqual([0, 0]);
    expect(b.unit("band")?.moved).toBe(false);
  });

  it("한 페이즈에 두 번 이동할 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1])]);
    b.apply({ type: "move", officerId: "foot", to: [2, 1] });

    expect(() => b.apply({ type: "move", officerId: "foot", to: [3, 1] })).toThrow(
      BattleCommandError,
    );
    expect(b.unit("foot")?.pos).toEqual([2, 1]);
  });

  it("행동을 마친 부대는 이동할 수 없다 — 순서는 이동 → 행동 고정이다", () => {
    const b = battle([at("foot", "player", [1, 1])]);
    b.apply({ type: "wait", officerId: "foot" });

    expect(() => b.apply({ type: "move", officerId: "foot", to: [2, 1] })).toThrow(
      BattleCommandError,
    );
  });

  it("이동한 뒤에도 행동할 수 있다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [4, 1])]);
    b.apply({ type: "move", officerId: "foot", to: [3, 1] });

    expect(() => b.apply({ type: "attack", officerId: "foot", targetId: "foot2" })).not.toThrow();
    expect(b.unit("foot")?.acted).toBe(true);
  });
});

describe("applyCommand — 공격", () => {
  it("데미지만큼 병력을 깎고 공격 이벤트를 낸다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);
    const before = b.unit("foot2")!.hp;

    const events = b.apply({ type: "attack", officerId: "foot", targetId: "foot2" });
    const dealt = before - b.unit("foot2")!.hp;

    expect(dealt).toBeGreaterThan(0);
    expect(events).toEqual([
      { type: "attacked", attackerId: "foot", defenderId: "foot2", damage: dealt },
    ]);
  });

  it("사거리 밖이면 거부하고 아무것도 바꾸지 않는다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [3, 1])]);
    const before = b.unit("foot2")!.hp;

    expect(() => b.apply({ type: "attack", officerId: "foot", targetId: "foot2" })).toThrow(
      BattleCommandError,
    );
    expect(b.unit("foot2")?.hp).toBe(before);
    expect(b.unit("foot")?.acted).toBe(false);
  });

  it("최소 사거리 안쪽의 적은 칠 수 없다", () => {
    // 발석차는 사거리 2~3 — 인접한 적은 대상이 아니다.
    const b = battle([at("siege", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);

    expect(() => b.apply({ type: "attack", officerId: "siege", targetId: "foot2" })).toThrow(
      BattleCommandError,
    );
  });

  it("사거리 안이면 떨어진 적도 친다", () => {
    const b = battle([at("siege", "player", [1, 1]), at("foot2", "enemy", [4, 1])]);
    const before = b.unit("foot2")!.hp;

    b.apply({ type: "attack", officerId: "siege", targetId: "foot2" });
    expect(b.unit("foot2")!.hp).toBeLessThan(before);
  });

  it("4방향 병과는 대각선의 적을 칠 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 2])]);

    expect(() => b.apply({ type: "attack", officerId: "foot", targetId: "foot2" })).toThrow(
      BattleCommandError,
    );
  });

  it("8방향 병과는 대각선의 적을 친다", () => {
    const b = battle([at("spear", "player", [1, 1]), at("foot2", "enemy", [2, 2])]);
    const before = b.unit("foot2")!.hp;

    b.apply({ type: "attack", officerId: "spear", targetId: "foot2" });
    expect(b.unit("foot2")!.hp).toBeLessThan(before);
  });

  it("아군은 칠 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "player", [2, 1])]);

    expect(() => b.apply({ type: "attack", officerId: "foot", targetId: "foot2" })).toThrow(
      BattleCommandError,
    );
  });

  it("맞은 부대는 반격하지 않는다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);
    const attackerHp = b.unit("foot")!.hp;

    const events = b.apply({ type: "attack", officerId: "foot", targetId: "foot2" });

    expect(b.unit("foot")?.hp).toBe(attackerHp);
    expect(events).toHaveLength(1);
  });

  it("격파하면 부대를 전장에서 지우고 격파 이벤트를 낸다", () => {
    const b = battle([
      at("foot", "player", [1, 1]),
      { ...at("foot2", "enemy", [2, 1]), hp: 1 },
    ]);

    const events = b.apply({ type: "attack", officerId: "foot", targetId: "foot2" });

    expect(events).toEqual([
      { type: "attacked", attackerId: "foot", defenderId: "foot2", damage: 1 },
      { type: "defeated", officerId: "foot2" },
    ]);
    expect(b.unit("foot2")).toBeUndefined();
    expect(b.state.units.map((unit) => unit.officerId)).toEqual(["foot"]);
  });

  it("공격을 마친 부대는 다시 행동할 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])]);
    b.apply({ type: "attack", officerId: "foot", targetId: "foot2" });

    expect(() => b.apply({ type: "attack", officerId: "foot", targetId: "foot2" })).toThrow(
      BattleCommandError,
    );
    expect(() => b.apply({ type: "wait", officerId: "foot" })).toThrow(BattleCommandError);
  });
});

describe("applyCommand — 대기", () => {
  it("행동을 마친 것으로 표시하고 이벤트를 내지 않는다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(b.apply({ type: "wait", officerId: "foot" })).toEqual([]);
    expect(b.unit("foot")?.acted).toBe(true);
  });

  it("이동하지 않고도 대기할 수 있다", () => {
    const b = battle([at("foot", "player", [1, 1])]);
    b.apply({ type: "wait", officerId: "foot" });

    expect(b.unit("foot")?.pos).toEqual([1, 1]);
  });
});

describe("applyCommand — 공통 규칙", () => {
  it("전장에 없는 부대의 커맨드는 거부한다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(() => b.apply({ type: "wait", officerId: "no_such_officer" })).toThrow(
      BattleCommandError,
    );
  });

  it("전장에 없는 대상은 공격할 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1])]);

    expect(() =>
      b.apply({ type: "attack", officerId: "foot", targetId: "no_such_officer" }),
    ).toThrow(BattleCommandError);
  });

  it("지금 페이즈가 아닌 진영의 부대는 움직일 수 없다", () => {
    const b = battle([at("foot", "player", [1, 1]), at("foot2", "enemy", [4, 4])]);

    expect(() => b.apply({ type: "move", officerId: "foot2", to: [4, 3] })).toThrow(
      BattleCommandError,
    );

    b.state.phase = "enemy";
    expect(() => b.apply({ type: "move", officerId: "foot2", to: [4, 3] })).not.toThrow();
  });
});

describe("attackableTiles", () => {
  /** 부대 하나를 세우고 그 부대의 공격 범위를 좌표 키로 돌려준다. */
  const range = (officerId: string, pos: Pos, rows = PLAIN): string[] => {
    const { ctx, state } = makeBattle(rows, [at(officerId, "player", pos)]);
    return attackableTiles(ctx, state.units[0]!).map(([x, y]) => `${x},${y}`);
  };

  it("4방향 사거리 1이면 맞닿은 네 칸이다", () => {
    expect(range("foot", [3, 3]).sort()).toEqual(["2,3", "3,2", "3,4", "4,3"].sort());
  });

  it("8방향 사거리 1이면 둘러싼 여덟 칸이다", () => {
    expect(range("spear", [3, 3])).toHaveLength(8);
    expect(range("spear", [3, 3])).toContain("2,2"); // 대각
  });

  it("4방향 사거리 2면 마름모꼴이다", () => {
    const tiles = range("bow", [3, 3]);

    expect(tiles).toHaveLength(12);
    expect(tiles).toContain("1,3"); // 두 칸 직선
    expect(tiles).toContain("2,2"); // 두 칸 대각(맨해튼 2)
    expect(tiles).not.toContain("1,1"); // 맨해튼 4
  });

  it("최소 사거리 안쪽은 빠진다", () => {
    // 발석차는 사거리 2~3 — 맞닿은 칸과 제자리는 칠 수 없다.
    const tiles = range("siege", [3, 3]);

    expect(tiles).not.toContain("3,3");
    expect(tiles).not.toContain("2,3");
    expect(tiles).toContain("1,3");
  });

  it("맵 밖은 빠진다", () => {
    expect(range("foot", [0, 0]).sort()).toEqual(["0,1", "1,0"]);
  });

  it("(y, x) 순으로 정렬해 돌려준다 — 순서가 흔들리면 하이라이트도 흔들린다", () => {
    expect(range("foot", [3, 3])).toEqual(["3,2", "2,3", "4,3", "3,4"]);
  });
});

describe("applyCommand — 결정론 (VER-07)", () => {
  const SCRIPT: Command[] = [
    { type: "move", officerId: "foot", to: [2, 1] },
    { type: "attack", officerId: "foot", targetId: "foot2" },
    { type: "attack", officerId: "spear", targetId: "foot2" },
    { type: "wait", officerId: "horse" },
  ];

  /** 같은 배치에서 같은 커맨드 열을 돌리고 남은 상태를 돌려준다. */
  const run = (seed: number) => {
    const { ctx, state } = makeBattle(PLAIN, [
      at("foot", "player", [1, 1]),
      at("spear", "player", [3, 2]),
      at("horse", "player", [0, 0]),
      at("foot2", "enemy", [3, 1]),
    ]);
    const rng = createRng(seed);

    const events = SCRIPT.flatMap((cmd) => applyCommand(ctx, state, cmd, rng));
    return { state, events };
  };

  it("같은 시드에서 같은 커맨드 열은 같은 결과를 낸다", () => {
    expect(run(42)).toEqual(run(42));
  });

  it("다른 시드는 다른 결과를 낸다", () => {
    expect(run(42)).not.toEqual(run(43));
  });
});
