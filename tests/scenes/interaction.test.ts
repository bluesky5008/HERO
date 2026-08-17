import { describe, expect, it } from "vitest";
import { reachableTiles } from "../../src/core/battle/movement";
import type { BattleState } from "../../src/core/battle/state";
import { createRng } from "../../src/core/rng";
import { createInteraction } from "../../src/scenes/BattleInteraction";
import { asKeys, makeBattle, type UnitSpec } from "../battle/fixtures";

/**
 * 전투 입력 상태 기계(TASK-19).
 * idle(부대 선택) → moving(이동) → acting(공격·대기) → targeting(대상 선택).
 * 이동은 확정 전까지 되돌릴 수 있고, 행동을 확정하면 되돌릴 수 없다([상세 스펙 §1.1]).
 */

const MAP = ["......", "......", "......", "......"];

const SPECS: UnitSpec[] = [
  { officerId: "foot", side: "player", pos: [1, 1] },
  { officerId: "spear", side: "player", pos: [1, 3] },
  { officerId: "horse", side: "enemy", pos: [4, 1] },
];

const setup = (specs: UnitSpec[] = SPECS) => {
  const { ctx, state } = makeBattle(MAP, specs);
  return { ctx, state, ui: createInteraction(ctx, state, createRng(7)) };
};

const unitAt = (state: BattleState, officerId: string) => {
  const unit = state.units.find((candidate) => candidate.officerId === officerId);
  if (!unit) throw new Error(`부대 ${officerId}가 전장에 없다`);
  return unit;
};

describe("선택", () => {
  it("아군 부대를 고르면 이동 모드로 들어간다", () => {
    const { ui } = setup();

    ui.confirm([1, 1]);

    expect(ui.mode).toBe("moving");
    expect(ui.selected?.officerId).toBe("foot");
  });

  it("빈 칸과 적 부대는 고를 수 없다", () => {
    const { ui } = setup();

    ui.confirm([3, 3]);
    expect(ui.mode).toBe("idle");

    ui.confirm([4, 1]);
    expect(ui.mode).toBe("idle");
  });

  it("이번 페이즈의 행동을 마친 부대는 고를 수 없다", () => {
    const { state, ui } = setup();
    unitAt(state, "foot").acted = true;

    ui.confirm([1, 1]);

    expect(ui.mode).toBe("idle");
  });

  it("혼란에 빠진 부대는 고를 수 없다 ([상세 스펙 §1.4])", () => {
    const { state, ui } = setup();
    unitAt(state, "foot").confused = true;

    ui.confirm([1, 1]);

    expect(ui.mode).toBe("idle");
  });

  it("이동 범위는 코어의 계산을 그대로 내준다", () => {
    const { ctx, state, ui } = setup();

    ui.confirm([1, 3]);

    // 화면과 규칙이 갈라지면 못 가는 칸이 파랗게 칠해진다.
    expect(asKeys(ui.moveTiles())).toEqual(
      asKeys(reachableTiles(ctx, state, unitAt(state, "spear"))),
    );
  });
});

describe("이동", () => {
  it("이동 범위 안의 칸을 고르면 부대가 움직이고 행동 메뉴로 넘어간다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    const events = ui.confirm([2, 1]);

    expect(unitAt(state, "foot").pos).toEqual([2, 1]);
    expect(unitAt(state, "foot").moved).toBe(true);
    expect(events).toEqual([{ type: "moved", officerId: "foot", from: [1, 1], to: [2, 1] }]);
    expect(ui.mode).toBe("acting");
  });

  it("제자리를 고르면 움직이지 않고 행동 메뉴로 넘어간다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([1, 1]);

    expect(unitAt(state, "foot").pos).toEqual([1, 1]);
    expect(ui.mode).toBe("acting");
  });

  it("이동 범위 밖의 칸은 무시한다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    const events = ui.confirm([5, 3]);

    expect(events).toEqual([]);
    expect(unitAt(state, "foot").pos).toEqual([1, 1]);
    expect(ui.mode).toBe("moving");
  });

  it("이동 모드에서 취소하면 선택이 풀린다", () => {
    const { ui } = setup();

    ui.confirm([1, 1]);
    ui.cancel();

    expect(ui.mode).toBe("idle");
    expect(ui.selected).toBeUndefined();
  });
});

describe("행동 확정 전 취소", () => {
  it("행동 메뉴에서 취소하면 이동을 되돌린다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([2, 1]);
    ui.cancel();

    const foot = unitAt(state, "foot");
    expect(foot.pos).toEqual([1, 1]);
    expect(foot.moved).toBe(false);
    expect(foot.acted).toBe(false);
    expect(ui.mode).toBe("idle");
  });

  it("대상 선택에서 취소하면 행동 메뉴로 돌아가고 이동은 유지된다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");
    ui.cancel();

    expect(ui.mode).toBe("acting");
    expect(unitAt(state, "foot").pos).toEqual([3, 1]);
  });
});

describe("공격", () => {
  it("사거리 안의 적을 고르면 공격하고 선택이 풀린다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");
    const events = ui.confirm([4, 1]);

    expect(events.map((event) => event.type)).toContain("attacked");
    const horse = unitAt(state, "horse");
    expect(horse.hp).toBeLessThan(horse.hpMax);
    expect(unitAt(state, "foot").acted).toBe(true);
    expect(ui.mode).toBe("idle");
  });

  it("대상이 없는 칸을 고르면 아무 일도 일어나지 않는다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");
    const events = ui.confirm([3, 3]);

    expect(events).toEqual([]);
    const horse = unitAt(state, "horse");
    expect(horse.hp).toBe(horse.hpMax);
    expect(ui.mode).toBe("targeting");
  });

  it("칠 수 있는 적이 없으면 공격을 고를 수 없다", () => {
    const { ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([1, 1]);

    expect(ui.targets()).toEqual([]);
    expect(ui.choose("attack")).toEqual([]);
    expect(ui.mode).toBe("acting");
  });

  it("대상 선택 중에는 공격 범위와 칠 수 있는 적을 내준다", () => {
    const { ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");

    expect(ui.mode).toBe("targeting");
    expect(ui.targets().map((unit) => unit.officerId)).toEqual(["horse"]);
    expect(asKeys(ui.attackTiles())).toContain("4,1");
  });

  it("칠 수 없는 부대에는 예상 데미지를 내지 않는다", () => {
    // 사거리 안이지만 아군이라 고를 수 없는 부대. 값을 띄우면 눌러도 아무 일이 없는 화면이 된다.
    const { state, ui } = setup([
      { officerId: "foot", side: "player", pos: [3, 1] },
      { officerId: "spear", side: "player", pos: [3, 2] },
      { officerId: "horse", side: "enemy", pos: [4, 1] },
    ]);

    ui.confirm([3, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");

    expect(ui.mode).toBe("targeting");
    expect(ui.forecast(unitAt(state, "horse"))).toBeDefined();
    expect(ui.forecast(unitAt(state, "spear"))).toBeUndefined();
  });

  it("예상 데미지는 실제 공격이 낸 데미지를 감싼다", () => {
    const { ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([3, 1]);
    ui.choose("attack");
    const horse = ui.targets()[0]!;
    const [min, max] = ui.forecast(horse)!;
    const events = ui.confirm([4, 1]);

    const attacked = events.find((event) => event.type === "attacked");
    expect(attacked).toBeDefined();
    expect(attacked?.type === "attacked" && attacked.damage).toBeGreaterThanOrEqual(min);
    expect(attacked?.type === "attacked" && attacked.damage).toBeLessThanOrEqual(max);
  });
});

describe("대기", () => {
  it("대기하면 행동을 마치고 선택이 풀린다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([2, 1]);
    ui.choose("wait");

    expect(unitAt(state, "foot").acted).toBe(true);
    expect(ui.mode).toBe("idle");
  });

  it("행동을 마친 뒤에는 되돌릴 수 없다", () => {
    const { state, ui } = setup();

    ui.confirm([1, 1]);
    ui.confirm([2, 1]);
    ui.choose("wait");
    ui.cancel();

    expect(unitAt(state, "foot").pos).toEqual([2, 1]);
    expect(unitAt(state, "foot").acted).toBe(true);
  });
});

describe("적 페이즈", () => {
  it("적 페이즈에는 부대를 고를 수 없다", () => {
    const { state, ui } = setup();
    state.phase = "enemy";

    ui.confirm([1, 1]);

    expect(ui.mode).toBe("idle");
  });
});
