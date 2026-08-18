import { describe, expect, it } from "vitest";
import { reachableTiles } from "../../src/core/battle/movement";
import { asKeys, makeBattle, type UnitSpec } from "./fixtures";

/** 첫 번째로 적은 부대의 이동 범위를 좌표 키 집합으로 돌려준다. */
const reachable = (rows: string[], specs: UnitSpec[]): string[] => {
  const { ctx, state } = makeBattle(rows, specs);
  return asKeys(reachableTiles(ctx, state, state.units[0]!));
};

const PLAIN_7 = Array.from({ length: 7 }, () => ".......");
/** 산으로 막힌 1칸 통로 — 우회로가 없어 통과 규칙만 검사할 수 있다. */
const CORRIDOR = ["^^^^^", "^^^^^", ".....", "^^^^^", "^^^^^"];

describe("reachableTiles", () => {
  it("코스트 합이 이동력 이하인 칸을 모두, 그것만 포함한다", () => {
    // 군악대는 이동력 4, 평지 코스트 1 → 맨해튼 거리 4 이내
    const tiles = reachable(PLAIN_7, [{ officerId: "band", side: "player", pos: [3, 3] }]);

    const expected: string[] = [];
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        if (Math.abs(x - 3) + Math.abs(y - 3) <= 4) expected.push(`${x},${y}`);
      }
    }
    expect(tiles).toEqual(expected.sort());
  });

  it("자기 자리는 언제나 포함한다", () => {
    expect(reachable(PLAIN_7, [{ officerId: "band", side: "player", pos: [0, 0] }])).toContain(
      "0,0",
    );
  });

  it("진입 불가 지형은 제외하고 그 너머 경로도 막는다", () => {
    const rows = [".....", ".....", "^^^^^", ".....", "....."];
    const tiles = reachable(rows, [{ officerId: "band", side: "player", pos: [2, 1] }]);

    expect(tiles).not.toContain("2,2"); // 산 자체
    expect(tiles).not.toContain("2,3"); // 산 너머 — 우회로가 없다
    expect(tiles).toContain("2,0");
  });

  it("코스트 2인 지형은 이동력을 두 배로 먹는다", () => {
    // 군악대(band)는 숲 코스트 2, 이동력 4 → 숲에서는 두 칸까지
    const forest = Array.from({ length: 5 }, () => "fffff");
    const tiles = reachable(forest, [{ officerId: "band", side: "player", pos: [2, 2] }]);

    expect(tiles).toContain("0,2"); // 두 칸 = 코스트 4
    expect(tiles).toContain("1,1"); // 대각으로 두 칸 = 코스트 4
    expect(tiles).not.toContain("0,1"); // 세 칸 = 코스트 6
  });

  it("병과 이동 규칙의 진입 금지가 지형표를 덮어쓴다", () => {
    // 픽스처의 숲은 기병 코스트 1이지만 경기병의 movementRules.forbidden에 숲이 있다.
    const rows = [".....", "..f..", ".....", ".....", "....."];
    const tiles = reachable(rows, [{ officerId: "horse", side: "player", pos: [2, 2] }]);

    expect(tiles).not.toContain("2,1");
    expect(tiles).toContain("1,1"); // 숲을 우회한 칸은 그대로 갈 수 있다
  });

  it("병과 이동 규칙의 반감이 지형표를 덮어쓴다", () => {
    // 장병은 숲이 지형표상 코스트 1이지만 movementRules.halved에 있어 2가 된다.
    const forest = Array.from({ length: 5 }, () => "fffff");
    const tiles = reachable(forest, [{ officerId: "spear", side: "player", pos: [2, 2] }]);

    expect(tiles).toContain("0,2"); // 두 칸 = 코스트 4 ≤ 이동력 5
    expect(tiles).not.toContain("0,1"); // 세 칸 = 코스트 6 (반감이 없었다면 닿는다)
  });

  it("적 부대가 선 칸은 지날 수도 멈출 수도 없다", () => {
    const tiles = reachable(CORRIDOR, [
      { officerId: "band", side: "player", pos: [0, 2] },
      { officerId: "foot", side: "enemy", pos: [1, 2] },
    ]);

    expect(tiles).toEqual(["0,2"]);
  });

  it("아군 부대가 선 칸은 지날 수 있지만 멈출 수 없다", () => {
    const tiles = reachable(CORRIDOR, [
      { officerId: "band", side: "player", pos: [0, 2] },
      { officerId: "foot", side: "player", pos: [1, 2] },
    ]);

    expect(tiles).not.toContain("1,2");
    expect(tiles).toContain("2,2");
    expect(tiles).toContain("4,2"); // 아군을 지나 이동력 끝까지
  });

  it("정의되지 않은 지형은 진입 불가로 본다", () => {
    const rows = [".....", ".....", "?????", ".....", "....."];
    const tiles = reachable(rows, [{ officerId: "band", side: "player", pos: [2, 1] }]);

    expect(tiles).not.toContain("2,2");
    expect(tiles).not.toContain("2,3");
  });
});

describe("이동 아이템 (mount)", () => {
  it("탈것을 지니면 이동력이 그만큼 늘어난다", () => {
    const bare = reachable(PLAIN_7, [{ officerId: "band", side: "player", pos: [3, 3] }]);
    const mounted = reachable(PLAIN_7, [
      { officerId: "band", side: "player", pos: [3, 3], items: ["swift_horse"] },
    ]);

    // 군악대 이동력 4 + 준마 2 = 6
    expect(mounted.length).toBeGreaterThan(bare.length);
    expect(mounted).toContain("3,0");
  });

  it("여러 개를 지니면 더해진다", () => {
    // 7×7에서는 이동력 6이면 이미 전 칸에 닿아 차이가 드러나지 않는다 — 넓은 맵이 필요하다.
    const plain13 = Array.from({ length: 13 }, () => ".............");
    const one = reachable(plain13, [
      { officerId: "band", side: "player", pos: [6, 6], items: ["swift_horse"] },
    ]);
    const two = reachable(plain13, [
      { officerId: "band", side: "player", pos: [6, 6], items: ["swift_horse", "swift_horse"] },
    ]);

    expect(two.length).toBeGreaterThan(one.length);
  });

  it("탈것이 아닌 아이템은 이동력을 바꾸지 않는다", () => {
    const bare = reachable(PLAIN_7, [{ officerId: "band", side: "player", pos: [3, 3] }]);
    const carried = reachable(PLAIN_7, [
      { officerId: "band", side: "player", pos: [3, 3], items: ["iron_sword", "herb"] },
    ]);

    expect(carried).toEqual(bare);
  });

  it("진입 불가 지형은 이동력이 늘어도 그대로 막힌다", () => {
    const tiles = reachable(CORRIDOR, [
      { officerId: "band", side: "player", pos: [2, 2], items: ["swift_horse"] },
    ]);

    expect(tiles.every((key) => key.endsWith(",2"))).toBe(true);
  });
});

describe("병과 플래그 ([상세 스펙 §1.2])", () => {
  /** 가운데 한 줄만 평지인 통로. 산이 위아래를 막는다. */
  const MOUNTAINS = ["^^^^^", "^^^^^", ".....", "^^^^^", "^^^^^"];

  it("mountainMove는 지형표가 막은 칸도 지나게 한다", () => {
    const blocked = reachable(MOUNTAINS, [{ officerId: "foot", side: "player", pos: [2, 2] }]);
    const climber = reachable(MOUNTAINS, [{ officerId: "bandit1", side: "player", pos: [2, 2] }]);

    expect(blocked.every((key) => key.endsWith(",2"))).toBe(true);
    expect(climber).toContain("2,0");
  });

  it("mountainMove가 있어도 병과가 금지한 지형은 막힌다", () => {
    // 적병은 강을 건너지 못한다(movementRules.forbidden) — 지형표보다 병과 규칙이 우선한다.
    const river = ["#####", "#####", ".....", "#####", "#####"];
    const tiles = reachable(river, [{ officerId: "bandit1", side: "player", pos: [2, 2] }]);

    expect(tiles.every((key) => key.endsWith(",2"))).toBe(true);
  });

  it("noTerrainPenalty는 지형 코스트를 1로 만든다", () => {
    // 척후병은 숲 코스트가 2배(halved 규칙)지만 플래그가 그것을 무시한다.
    const forest = Array.from({ length: 9 }, () => "fffffffff");
    const scout = reachable(forest, [{ officerId: "scout1", side: "player", pos: [4, 4] }]);
    const band = reachable(forest, [{ officerId: "band", side: "player", pos: [4, 4] }]);

    // 둘 다 이동력 4다. 코스트가 1이면 맨해튼 4까지, 숲 코스트 2면 2칸까지 간다.
    expect(scout).toContain("4,0");
    expect(band).not.toContain("4,0");
    expect(band).toContain("4,2");
  });

  it("플래그가 없는 병과의 이동은 M1 그대로다", () => {
    const plain = reachable(PLAIN_7, [{ officerId: "foot", side: "player", pos: [3, 3] }]);

    const expected: string[] = [];
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        if (Math.abs(x - 3) + Math.abs(y - 3) <= 5) expected.push(`${x},${y}`);
      }
    }
    expect(plain).toEqual(expected.sort());
  });
});
