import { describe, expect, it } from "vitest";
import { BattleSetupError, createBattleState } from "../../src/core/battle/state";
import type { StageUnit } from "../../src/core/data/schemas";
import { validGameData } from "../data/fixtures";

const data = validGameData();
const stage = data.stages[0]!;

/** 기본 출진: 유비를 배치 구역 왼쪽 끝에 놓는다. */
const party = (...overrides: Partial<StageUnit>[]): StageUnit[] =>
  overrides.map((override) => ({
    officerId: "liu_bei",
    level: 5,
    morale: 100,
    pos: [0, 2],
    ai: "aggressive" as const,
    aiParams: { anchor: null, escape: null },
    ...override,
  }));

const build = (...units: Partial<StageUnit>[]) =>
  createBattleState(data, stage, party(...units));

describe("createBattleState", () => {
  it("출진 부대와 스테이지의 적을 모두 배치한다", () => {
    const state = build({});

    expect(state.units.map((u) => u.officerId)).toEqual(["liu_bei", "deng_mao"]);
    expect(state.units.map((u) => u.side)).toEqual(["player", "enemy"]);
  });

  it("병력 상한을 무장의 성장값과 레벨로 계산하고 가득 채워 시작한다", () => {
    const liuBei = build({}).units[0]!;

    // growth: baseHp 1200 + hpPerLevel 60 × (레벨 5 - 1)
    expect(liuBei.hpMax).toBe(1440);
    expect(liuBei.hp).toBe(liuBei.hpMax);
  });

  it("레벨 1이면 병력 상한이 기준값 그대로다", () => {
    expect(build({ level: 1 }).units[0]?.hpMax).toBe(1200);
  });

  it("적 부대의 성장은 다음 전투로 이관되지 않는다", () => {
    // 앞선 전투에서 적이 레벨업했다고 가정한다.
    const previous = build({});
    const grown = previous.units[1]!;
    grown.level += 3;
    grown.exp = 80;
    grown.hpMax += 300;

    // 같은 스테이지로 전투를 다시 세우면 적은 스테이지 데이터가 정한 값에서 다시 시작한다.
    const enemy = build({}).units[1]!;

    expect(enemy.level).toBe(stage.enemies[0]!.level);
    expect(enemy.exp).toBe(0);
    expect(enemy.hpMax).toBeLessThan(grown.hpMax);
  });

  it("소지품은 비어 있고 상한이 설정에 있다 (FR-07)", () => {
    const state = build({});

    expect(state.units.map((unit) => unit.items)).toEqual([[], []]);
    expect(data.combatConfig.itemSlots).toBe(8);
  });

  it("모든 부대는 경험치 0에서 시작한다", () => {
    expect(build({}).units.map((unit) => unit.exp)).toEqual([0, 0]);
  });

  it("책략치 상한을 지력과 레벨로 계산하고 가득 채워 시작한다 ([상세 스펙 §1.5])", () => {
    const liuBei = build({}).units[0]!;

    // mpMax = floor(지력 74 / 4) + 레벨 5 = 18 + 5
    expect(liuBei.mpMax).toBe(23);
    expect(liuBei.mp).toBe(liuBei.mpMax);
  });

  it("지력이 같아도 레벨이 오르면 책략치 상한이 함께 오른다", () => {
    const low = build({ level: 1 }).units[0]!;
    const high = build({ level: 9 }).units[0]!;

    expect(high.mpMax - low.mpMax).toBe(8);
  });

  it("병과는 무장 데이터에서 가져온다", () => {
    expect(build({}).units[0]?.classId).toBe("sword_soldier");
  });

  it("사기는 배치 정보의 값을 쓴다", () => {
    expect(build({ morale: 70 }).units[0]?.morale).toBe(70);
  });

  it("턴 1, 플레이어 페이즈, 스테이지 날씨로 시작한다", () => {
    const state = build({});

    expect(state.turn).toBe(1);
    expect(state.phase).toBe("player");
    expect(state.weather).toBe(stage.weather);
  });

  it("모든 부대가 아직 행동하지 않은 상태로 시작한다", () => {
    expect(build({}).units.every((unit) => !unit.acted)).toBe(true);
  });

  it("배치 좌표가 맵 밖이면 거부한다", () => {
    expect(() => build({ pos: [0, 9] })).toThrow(BattleSetupError);
  });

  it("배치 좌표가 배치 구역 밖이면 거부한다", () => {
    expect(() => build({ pos: [0, 0] })).toThrow(BattleSetupError);
  });

  it("출진 부대끼리 같은 칸에 겹치면 거부한다", () => {
    expect(() => build({}, { officerId: "guan_yu" })).toThrow(BattleSetupError);
  });

  it("출진 수가 최대치를 넘으면 거부한다", () => {
    const three = party(
      { pos: [0, 2] },
      { officerId: "guan_yu", pos: [1, 2] },
      { officerId: "deng_mao", pos: [2, 2] },
    );
    expect(() => createBattleState(data, stage, three)).toThrow(BattleSetupError);
  });

  it("존재하지 않는 무장을 출진시키면 거부한다", () => {
    expect(() => build({ officerId: "no_such_officer" })).toThrow(BattleSetupError);
  });

  it("무장의 병과가 데이터에 없으면 거부한다", () => {
    const broken = validGameData();
    broken.officers = broken.officers.map((officer) => ({ ...officer, classId: "no_such_class" }));

    expect(() => createBattleState(broken, stage, party({}))).toThrow(BattleSetupError);
  });

  it("같은 무장을 두 번 출진시키면 거부한다", () => {
    expect(() => build({ pos: [0, 2] }, { pos: [1, 2] })).toThrow(BattleSetupError);
  });
});
