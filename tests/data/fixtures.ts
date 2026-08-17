import type { RawGameData } from "../../src/core/data/loader";

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

export const validStage = {
  id: "stage-test",
  name: "테스트 스테이지",
  map: {
    width: 2,
    height: 2,
    tiles: [
      ["plain", "plain"],
      ["plain", "plain"],
    ],
  },
  weather: "clear",
};

export const validConfig = {
  tileSize: 32,
  logicalWidth: 1280,
  logicalHeight: 720,
};

/** 스키마와 참조 무결성을 모두 통과하는 최소 데이터 묶음. */
export function validRawGameData(): RawGameData {
  return {
    config: { ...validConfig },
    terrain: [{ ...validTerrain }],
    classes: [{ ...validClass }],
    affinity: [{ attacker: "infantry", defender: "infantry", modifier: 1 }],
    sprites: { sword_soldier: { ...validSprite } },
    animations: { sword_soldier: structuredClone(validAnimationSet) },
    stages: { "stage-test.json": structuredClone(validStage) },
  };
}
