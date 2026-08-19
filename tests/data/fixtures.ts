import { formatIssues, loadGameData, type GameData, type RawGameData } from "../../src/core/data/loader";

/** 스키마·무결성 테스트용 최소 유효 데이터. 각 테스트가 필요한 부분만 덮어써서 쓴다. */

export const validTerrain = {
  id: "plain",
  name: "평지",
  defenseBonus: 0,
  moveCost: {
    infantry: 1,
    cavalry: 1,
    archer: 1,
    transport: 1,
    band: 1,
    sorcerer: 1,
    special: 1,
  },
  placeholderColor: "#7fa650",
  stronghold: false,
};

export const validClass = {
  id: "sword_soldier",
  name: "단병",
  family: "infantry",
  tier: 1,
  upgradesTo: null,
  upgradeLevel: null,
  attackMod: 8,
  defenseMod: 10,
  movement: 5,
  attackRange: { min: 1, max: 1, directions: 4 },
  movementRules: { forbidden: [], halved: [] },
  tactics: [],
  flags: [],
  sprite: "sword_soldier",
};

export const validTactic = {
  id: "fire_arrow",
  name: "화시",
  category: "fire",
  cost: 4,
  baseDamage: 300,
  range: 3,
  area: "single",
  terrainRequired: null,
  terrainBonus: { forest: 1.25 },
  weatherForbidden: ["rain"],
  weatherBonus: {},
  effect: "damage",
};

export const validItem = {
  id: "iron_sword",
  name: "철검",
  type: "weapon",
  value: 1.2,
  tacticId: null,
  classId: null,
  price: 300,
  forbiddenFor: [],
};

export const validAnimationSet = {
  idle: { frames: [0, 1], fps: 2 },
  move: { frames: [2, 3, 4, 5], fps: 8 },
  attack: { frames: [6, 7, 8], fps: 10, once: true },
  damaged: { frames: [9], fps: 1, flash: true },
};

export const validSprite = {
  sheet: "units.png",
  frameSize: [32, 32],
  baseRow: 0,
  placeholderColor: "#c94f4f",
};

export const validOfficer = {
  id: "liu_bei",
  name: "유비",
  war: 73,
  int: 74,
  ldr: 78,
  classId: "sword_soldier",
  growth: { baseHp: 1200, hpPerLevel: 60 },
};

export const validStage = {
  id: "stage-test",
  name: "테스트 스테이지",
  map: {
    width: 3,
    height: 3,
    tiles: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  weather: "clear",
  deployment: {
    maxUnits: 2,
    zone: [[0, 2], [1, 2], [2, 2]],
    roster: [
      { officerId: "liu_bei", level: 5 },
      { officerId: "guan_yu", level: 5 },
    ],
  },
  enemies: [{ officerId: "deng_mao", level: 5, pos: [1, 0] }],
  victory: { type: "annihilateEnemies" },
  defeat: { type: "officerLost", officerIds: ["liu_bei"] },
};

export const validConfig = {
  tileSize: 32,
  logicalWidth: 1280,
  logicalHeight: 720,
  shareExp: false,
};

export const validCombatConfig = {
  baseDamage: 300,
  minDamage: 1,
  damageJitter: { min: 0.9, max: 1.1 },
  moraleMax: 100,
  moraleLossOnHit: 2,
  confusion: { threshold: 30, chance: 0.5 },
  strongholdRecovery: { hpRatio: 0.1, morale: 5, mp: 2 },
  mpIntDivisor: 4,
  itemSlots: 8,
  tactic: { hitBase: 50, hitMin: 10, hitMax: 100, damageIntDivisor: 200, strongholdBlocks: ["damage"] },
  duel: { base: 50, warScale: 2, min: 5, max: 95, winnerExp: 100, winnerMorale: 10 },
  maxLevel: 99,
  exp: { divisor: 10, min: 1, max: 40, defeatBonus: 45, perLevel: 100 },
};

/** 스키마와 참조 무결성을 모두 통과하는 최소 데이터 묶음. */
export function validRawGameData(): RawGameData {
  return {
    config: { ...validConfig },
    combatConfig: { ...validCombatConfig },
    // 책략의 지형 보정이 가리킬 두 번째 지형이 있어야 참조 검사가 실제로 동작한다.
    terrain: [{ ...validTerrain }, { ...validTerrain, id: "forest", name: "숲" }],
    classes: [{ ...validClass, tactics: ["fire_arrow"] }],
    tactics: [{ ...validTactic }],
    items: [{ ...validItem }],
    officers: [
      { ...validOfficer },
      { ...validOfficer, id: "guan_yu", name: "관우", war: 97, ldr: 95 },
      { ...validOfficer, id: "deng_mao", name: "등무", war: 55, ldr: 50 },
    ],
    affinity: [{ attacker: "infantry", defender: "infantry", modifier: 1 }],
    sprites: { sword_soldier: { ...validSprite } },
    animations: { sword_soldier: structuredClone(validAnimationSet) },
    stages: { "stage-test.json": structuredClone(validStage) },
  };
}

/** 검증을 통과한 형태의 데이터 묶음. 전투 로직 테스트가 로더를 거쳐 그대로 쓴다. */
export function validGameData(): GameData {
  const { data, issues } = loadGameData(validRawGameData());
  if (!data || issues.length > 0) {
    throw new Error(`픽스처가 유효하지 않다:\n${formatIssues(issues)}`);
  }
  return data;
}
