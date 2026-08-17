import { describe, expect, it } from "vitest";
import {
  AnimationSetSchema,
  ClassSchema,
  CombatConfigSchema,
  GameConfigSchema,
  OfficerSchema,
  StageSchema,
  TacticSchema,
  TerrainSchema,
} from "../../src/core/data/schemas";
import {
  validAnimationSet,
  validClass,
  validCombatConfig,
  validConfig,
  validOfficer,
  validStage,
  validTactic,
  validTerrain,
} from "./fixtures";

describe("TacticSchema", () => {
  it("유효한 책략을 통과시킨다", () => {
    expect(TacticSchema.safeParse(validTactic).success).toBe(true);
  });

  it("책략치 비용이 음수이면 거부한다", () => {
    expect(TacticSchema.safeParse({ ...validTactic, cost: -1 }).success).toBe(false);
  });

  it("알 수 없는 카테고리를 거부한다", () => {
    expect(TacticSchema.safeParse({ ...validTactic, category: "wind" }).success).toBe(false);
  });

  it("알 수 없는 효과를 거부한다", () => {
    expect(TacticSchema.safeParse({ ...validTactic, effect: "instantKill" }).success).toBe(false);
  });

  it("알 수 없는 범위 유형을 거부한다", () => {
    expect(TacticSchema.safeParse({ ...validTactic, area: "all" }).success).toBe(false);
  });

  it("십자 5타일 범위를 통과시킨다 ([상세 스펙 §1.5]의 \"대\" 계열)", () => {
    expect(TacticSchema.safeParse({ ...validTactic, area: "cross5" }).success).toBe(true);
  });

  it("사거리가 0 이하이면 거부한다", () => {
    expect(TacticSchema.safeParse({ ...validTactic, range: 0 }).success).toBe(false);
  });

  it("지형 요구를 지정하지 않으면 null이다 (지계만 값을 갖는다)", () => {
    const earth = { ...validTactic, category: "earth", terrainRequired: ["mountain", "wasteland"] };

    expect(TacticSchema.safeParse(earth).success).toBe(true);
    expect(TacticSchema.parse(validTactic).terrainRequired).toBeNull();
  });

  it("지형·날씨 보정 배수가 음수이면 거부한다", () => {
    const terrainBonus = { forest: -1 };
    expect(TacticSchema.safeParse({ ...validTactic, terrainBonus }).success).toBe(false);
  });

  it("알 수 없는 금지 날씨를 거부한다", () => {
    const weatherForbidden = ["snow"];
    expect(TacticSchema.safeParse({ ...validTactic, weatherForbidden }).success).toBe(false);
  });
});

describe("GameConfigSchema", () => {
  it("유효한 게임 설정을 통과시킨다", () => {
    expect(GameConfigSchema.safeParse(validConfig).success).toBe(true);
  });

  it("경험치 공유를 적지 않으면 원작 동작인 OFF가 된다 ([상세 스펙 §1.6])", () => {
    const { shareExp: _omitted, ...withoutShareExp } = validConfig;

    expect(GameConfigSchema.parse(withoutShareExp).shareExp).toBe(false);
  });
});

describe("ClassSchema", () => {
  it("유효한 병과를 통과시킨다", () => {
    expect(ClassSchema.safeParse(validClass).success).toBe(true);
  });

  it("알 수 없는 계열을 거부한다", () => {
    expect(ClassSchema.safeParse({ ...validClass, family: "dragon" }).success).toBe(false);
  });

  it("승급 단계가 범위를 벗어나면 거부한다", () => {
    expect(ClassSchema.safeParse({ ...validClass, tier: 0 }).success).toBe(false);
    expect(ClassSchema.safeParse({ ...validClass, tier: 4 }).success).toBe(false);
  });

  it("이동력이 0 이하이면 거부한다", () => {
    expect(ClassSchema.safeParse({ ...validClass, movement: 0 }).success).toBe(false);
  });

  it("공격 방향이 4 또는 8이 아니면 거부한다", () => {
    const range = { min: 1, max: 1, directions: 6 };
    expect(ClassSchema.safeParse({ ...validClass, attackRange: range }).success).toBe(false);
  });

  it("사거리 최솟값이 최댓값보다 크면 거부한다", () => {
    const range = { min: 3, max: 1, directions: 4 };
    expect(ClassSchema.safeParse({ ...validClass, attackRange: range }).success).toBe(false);
  });

  it("승급 대상이 있는데 승급 레벨이 없으면 거부한다", () => {
    const invalid = { ...validClass, upgradesTo: "spear_soldier", upgradeLevel: null };
    expect(ClassSchema.safeParse(invalid).success).toBe(false);
  });

  it("필수 필드가 빠지면 거부한다", () => {
    const withoutSprite: Record<string, unknown> = { ...validClass };
    delete withoutSprite.sprite;
    expect(ClassSchema.safeParse(withoutSprite).success).toBe(false);
  });
});

describe("TerrainSchema", () => {
  it("유효한 지형을 통과시킨다", () => {
    expect(TerrainSchema.safeParse(validTerrain).success).toBe(true);
  });

  it("이동 불가를 blocked로 표기할 수 있다", () => {
    const blocked = {
      ...validTerrain,
      moveCost: { ...validTerrain.moveCost, cavalry: "blocked" },
    };
    expect(TerrainSchema.safeParse(blocked).success).toBe(true);
  });

  it("계열별 이동 코스트가 빠지면 거부한다", () => {
    const partialCost: Record<string, unknown> = { ...validTerrain.moveCost };
    delete partialCost.cavalry;
    expect(TerrainSchema.safeParse({ ...validTerrain, moveCost: partialCost }).success).toBe(false);
  });

  it("플레이스홀더 색이 hex 형식이 아니면 거부한다", () => {
    expect(TerrainSchema.safeParse({ ...validTerrain, placeholderColor: "green" }).success).toBe(
      false,
    );
  });
});

describe("AnimationSetSchema", () => {
  it("4대 애니메이션이 모두 있으면 통과시킨다", () => {
    expect(AnimationSetSchema.safeParse(validAnimationSet).success).toBe(true);
  });

  it.each(["idle", "move", "attack", "damaged"] as const)(
    "%s 애니메이션이 없으면 거부한다",
    (missing) => {
      const incomplete = structuredClone(validAnimationSet) as Record<string, unknown>;
      delete incomplete[missing];
      expect(AnimationSetSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it("프레임 목록이 비어 있으면 거부한다", () => {
    const empty = structuredClone(validAnimationSet);
    empty.idle.frames = [];
    expect(AnimationSetSchema.safeParse(empty).success).toBe(false);
  });
});

describe("StageSchema", () => {
  it("유효한 스테이지를 통과시킨다", () => {
    expect(StageSchema.safeParse(validStage).success).toBe(true);
  });

  it("타일 행 수가 height와 다르면 거부한다", () => {
    const stage = structuredClone(validStage);
    stage.map.tiles = [["plain", "plain", "plain"]];
    expect(StageSchema.safeParse(stage).success).toBe(false);
  });

  it("타일 열 수가 width와 다르면 거부한다", () => {
    const stage = structuredClone(validStage);
    stage.map.tiles = [
      ["plain", "plain"],
      ["plain", "plain"],
      ["plain", "plain"],
    ];
    expect(StageSchema.safeParse(stage).success).toBe(false);
  });

  it("적 부대가 하나도 없으면 거부한다", () => {
    expect(StageSchema.safeParse({ ...validStage, enemies: [] }).success).toBe(false);
  });

  it("출진 가능 수가 배치 칸 수보다 많으면 거부한다", () => {
    const deployment = { ...validStage.deployment, maxUnits: 4 };
    expect(StageSchema.safeParse({ ...validStage, deployment }).success).toBe(false);
  });

  it("사기를 지정하지 않은 적 부대는 100으로 채운다", () => {
    const parsed = StageSchema.parse(validStage);
    expect(parsed.enemies[0]?.morale).toBe(100);
  });

  it("승패 조건이 빠지면 거부한다", () => {
    const withoutVictory: Record<string, unknown> = structuredClone(validStage);
    delete withoutVictory.victory;
    expect(StageSchema.safeParse(withoutVictory).success).toBe(false);
  });

  it("알 수 없는 승리 조건 유형을 거부한다", () => {
    const victory = { type: "surviveTurns" };
    expect(StageSchema.safeParse({ ...validStage, victory }).success).toBe(false);
  });

  it("패배 조건에 지목된 무장이 하나도 없으면 거부한다", () => {
    const defeat = { type: "officerLost", officerIds: [] };
    expect(StageSchema.safeParse({ ...validStage, defeat }).success).toBe(false);
  });
});

describe("OfficerSchema", () => {
  it("유효한 무장을 통과시킨다", () => {
    expect(OfficerSchema.safeParse(validOfficer).success).toBe(true);
  });

  it.each(["war", "int", "ldr"] as const)("%s이 1~100을 벗어나면 거부한다", (stat) => {
    expect(OfficerSchema.safeParse({ ...validOfficer, [stat]: 0 }).success).toBe(false);
    expect(OfficerSchema.safeParse({ ...validOfficer, [stat]: 101 }).success).toBe(false);
  });

  it("능력치가 정수가 아니면 거부한다", () => {
    expect(OfficerSchema.safeParse({ ...validOfficer, war: 73.5 }).success).toBe(false);
  });

  it("병력 상한 성장값이 0 이하이면 거부한다", () => {
    const growth = { ...validOfficer.growth, baseHp: 0 };
    expect(OfficerSchema.safeParse({ ...validOfficer, growth }).success).toBe(false);
  });

  it("병력 성장 정의가 빠지면 거부한다", () => {
    const withoutGrowth: Record<string, unknown> = { ...validOfficer };
    delete withoutGrowth.growth;
    expect(OfficerSchema.safeParse(withoutGrowth).success).toBe(false);
  });
});

describe("CombatConfigSchema", () => {
  it("유효한 전투 상수를 통과시킨다", () => {
    expect(CombatConfigSchema.safeParse(validCombatConfig).success).toBe(true);
  });

  it("기본 데미지가 0 이하이면 거부한다", () => {
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, baseDamage: 0 }).success).toBe(
      false,
    );
  });

  it("최소 데미지가 음수이면 거부한다", () => {
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, minDamage: -1 }).success).toBe(
      false,
    );
  });

  it("난수 폭의 최솟값이 최댓값보다 크면 거부한다", () => {
    const damageJitter = { min: 1.2, max: 1.1 };
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, damageJitter }).success).toBe(
      false,
    );
  });

  it("혼란 확률이 0~1 밖이면 거부한다", () => {
    const over = { confusion: { threshold: 30, chance: 1.5 } };
    const under = { confusion: { threshold: 30, chance: -0.1 } };

    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, ...over }).success).toBe(false);
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, ...under }).success).toBe(false);
  });

  it("피격 사기 감소가 음수이면 거부한다", () => {
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, moraleLossOnHit: -1 }).success).toBe(
      false,
    );
  });

  it("거점 회복 비율이 음수이면 거부한다", () => {
    const strongholdRecovery = { hpRatio: -0.1, morale: 5 };
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, strongholdRecovery }).success).toBe(
      false,
    );
  });

  it("사기·혼란 상수가 빠지면 거부한다", () => {
    const { moraleMax: _omitted, ...withoutMoraleMax } = validCombatConfig;
    expect(CombatConfigSchema.safeParse(withoutMoraleMax).success).toBe(false);
  });

  it("공격 경험치의 하한이 상한보다 크면 거부한다", () => {
    const exp = { ...validCombatConfig.exp, min: 41, max: 40 };
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, exp }).success).toBe(false);
  });

  it("경험치 나눗수가 0 이하이면 거부한다", () => {
    const exp = { ...validCombatConfig.exp, divisor: 0 };
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, exp }).success).toBe(false);
  });

  it("레벨 상한이 0 이하이면 거부한다", () => {
    expect(CombatConfigSchema.safeParse({ ...validCombatConfig, maxLevel: 0 }).success).toBe(false);
  });
});
