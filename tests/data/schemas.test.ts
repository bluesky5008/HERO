import { describe, expect, it } from "vitest";
import {
  AnimationSetSchema,
  ClassSchema,
  StageSchema,
  TerrainSchema,
} from "../../src/core/data/schemas";
import { validAnimationSet, validClass, validStage, validTerrain } from "./fixtures";

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
    stage.map.tiles = [["plain", "plain"]];
    expect(StageSchema.safeParse(stage).success).toBe(false);
  });

  it("타일 열 수가 width와 다르면 거부한다", () => {
    const stage = structuredClone(validStage);
    stage.map.tiles = [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ];
    expect(StageSchema.safeParse(stage).success).toBe(false);
  });
});
