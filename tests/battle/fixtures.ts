import { formatIssues, loadGameData, type GameData } from "../../src/core/data/loader";
import type { CombatConfig, Family, GameConfig, Pos, Stage } from "../../src/core/data/schemas";
import { hpMaxOf, mpMaxOf, type BattleContext, type BattleState, type Side, type Unit } from "../../src/core/battle/state";
import { validAnimationSet, validCombatConfig, validConfig, validSprite } from "../data/fixtures";

/**
 * 전투 로직 테스트용 소형 전장.
 * 맵은 한 글자 = 한 타일인 문자열 행으로 적는다 — 지형 배치가 테스트에서 바로 보이게.
 */

export const TILE_CHARS: Record<string, string> = {
  ".": "plain",
  f: "forest",
  "^": "mountain",
  v: "village", // 거점 — 턴 시작 회복과 공격 책략 무효가 걸린다([상세 스펙 §1.7])
  "?": "swamp", // terrain.json에 없는 지형 — 데이터 내성 확인용(NFR-03)
};

const moveCost = (
  base: number | "blocked",
  overrides: Partial<Record<Family, number | "blocked">> = {},
): Record<Family, number | "blocked"> => ({
  infantry: base,
  cavalry: base,
  archer: base,
  transport: base,
  band: base,
  sorcerer: base,
  special: base,
  ...overrides,
});

const TERRAIN = [
  { id: "plain", name: "평지", defenseBonus: 0, moveCost: moveCost(1) },
  // 기병 코스트를 1로 둔다 — 병과 이동 규칙과 지형표가 어긋날 때 어느 쪽이 이기는지 보려면 둘이 달라야 한다.
  { id: "forest", name: "숲", defenseBonus: 0.1, moveCost: moveCost(1, { band: 2 }) },
  { id: "mountain", name: "산", defenseBonus: 0.2, moveCost: moveCost("blocked") },
  { id: "village", name: "마을", defenseBonus: 0.15, moveCost: moveCost(1), stronghold: true },
].map((terrain) => ({ placeholderColor: "#7fa650", stronghold: false, ...terrain }));

// 병과별 사용 가능 책략은 [상세 스펙 §1.5]를 따른다 — 보병계=화계+병력회복, 궁병계=수계, 기병=공격 책략 없음, 군악대=사기회복.
const CLASSES = [
  { id: "sword_soldier", name: "단병", family: "infantry", movement: 5, attackMod: 8, defenseMod: 10, tactics: ["fire_arrow", "mend"] },
  { id: "spear_soldier", name: "장병", family: "infantry", movement: 5, attackMod: 12, defenseMod: 14, movementRules: { forbidden: [], halved: ["forest"] }, attackRange: { min: 1, max: 1, directions: 8 as const }, tactics: ["fire_arrow", "fire_dragon"] },
  { id: "light_cavalry", name: "경기병", family: "cavalry", movement: 7, attackMod: 12, defenseMod: 6, movementRules: { forbidden: ["forest"], halved: [] } },
  { id: "archer", name: "궁병", family: "archer", movement: 5, attackMod: 10, defenseMod: 6, attackRange: { min: 1, max: 2, directions: 4 as const }, tactics: ["flood"] },
  // 전 카테고리를 쓰는 유일한 병과([상세 스펙 §1.5]) — 지계 게이트를 시험하려면 이 병과가 있어야 한다.
  { id: "sorcerer", name: "주술사", family: "sorcerer", movement: 4, attackMod: 6, defenseMod: 6, tactics: ["fire_arrow", "fire_dragon", "flood", "quake", "taunt", "bewilder", "mend", "cheer"] },
  // 인접한 적을 칠 수 없는 병과 — 최소 사거리가 실제로 걸리는지 보려면 min > 1인 데이터가 있어야 한다.
  { id: "catapult", name: "발석차", family: "archer", movement: 4, attackMod: 16, defenseMod: 4, attackRange: { min: 2, max: 3, directions: 4 as const } },
  { id: "music_band", name: "군악대", family: "band", movement: 4, attackMod: 4, defenseMod: 8, tactics: ["cheer", "taunt", "bewilder"] },
].map((cls) => ({
  tier: 1,
  upgradesTo: null,
  upgradeLevel: null,
  attackRange: { min: 1, max: 1, directions: 4 as const },
  movementRules: { forbidden: [], halved: [] },
  tactics: [],
  flags: [],
  sprite: cls.id,
  ...cls,
}));

/**
 * 카테고리별 최소 샘플. 지형·날씨 게이트를 실제로 자극하려면 화계·수계·지계가 모두 있어야 한다
 * ([상세 스펙 §1.5]) — 게이트 판정 자체는 TASK-24가 구현한다.
 */
const TACTICS = [
  {
    id: "fire_arrow",
    name: "화시",
    category: "fire",
    cost: 4,
    baseDamage: 300,
    range: 3,
    terrainBonus: { forest: 1.25 },
    weatherForbidden: ["rain"],
  },
  {
    id: "fire_dragon",
    name: "화룡",
    category: "fire",
    cost: 8,
    baseDamage: 600,
    range: 4,
    area: "cross5" as const,
    terrainBonus: { forest: 1.25 },
    weatherForbidden: ["rain"],
  },
  {
    id: "flood",
    name: "수공",
    category: "water",
    cost: 6,
    baseDamage: 400,
    range: 3,
    terrainRequired: ["plain"],
    weatherBonus: { rain: 1.25 },
  },
  {
    id: "quake",
    name: "낙석",
    category: "earth",
    cost: 6,
    baseDamage: 400,
    range: 3,
    terrainRequired: ["mountain"],
  },
  { id: "taunt", name: "도발", category: "moraleDown", cost: 3, baseDamage: 30, range: 3, effect: "moraleDown" },
  { id: "bewilder", name: "교란", category: "moraleDown", cost: 5, range: 3, effect: "confuse" },
  { id: "mend", name: "치료", category: "heal", cost: 4, baseDamage: 300, range: 2, effect: "healHp" },
  { id: "cheer", name: "격려", category: "heal", cost: 3, baseDamage: 20, range: 2, effect: "healMorale" },
].map((tactic) => ({
  baseDamage: 0,
  area: "single" as const,
  terrainRequired: null,
  terrainBonus: {},
  weatherForbidden: [],
  weatherBonus: {},
  effect: "damage",
  ...tactic,
}));

/** 타입별 최소 샘플. 장비 보정(무기·병법서·이동)을 시험하는 데 필요한 것만 둔다. */
const ITEMS = [
  { id: "iron_sword", name: "철검", type: "weapon", value: 1.2 },
  { id: "great_sword", name: "대검", type: "weapon", value: 1.5 },
  { id: "war_manual", name: "병법서", type: "manual", value: 1.3 },
  { id: "swift_horse", name: "준마", type: "mount", value: 2 },
  { id: "herb", name: "약초", type: "regen", value: 100 },
  { id: "fire_scroll", name: "화계 두루마리", type: "consumable", tacticId: "fire_arrow" },
  { id: "spear_manual", name: "장창", type: "classUpgrade" },
  { id: "sword_book", name: "검술지침서", type: "classChange", classId: "sword_soldier" },
].map((item) => ({
  value: 0,
  tacticId: null,
  classId: null,
  price: null,
  forbiddenFor: [],
  ...item,
}));

/** 상성 고리: 기병 > 보병 > 궁병 > 기병(방어측 배수 — 유리 0.75 / 불리 1.25). */
const STRONG_AGAINST: Partial<Record<Family, Family>> = {
  cavalry: "infantry",
  infantry: "archer",
  archer: "cavalry",
};

const OFFICERS = [
  { id: "foot", name: "보병 장수", classId: "sword_soldier" },
  { id: "foot2", name: "보병 장수 2", classId: "sword_soldier" },
  { id: "spear", name: "장병 장수", classId: "spear_soldier" },
  { id: "horse", name: "기병 장수", classId: "light_cavalry" },
  { id: "bow", name: "궁병 장수", classId: "archer" },
  { id: "siege", name: "발석차 장수", classId: "catapult" },
  { id: "band", name: "군악대 장수", classId: "music_band" },
  { id: "mage", name: "주술사 장수", classId: "sorcerer" },
].map((officer) => ({
  war: 50,
  int: 50,
  ldr: 50,
  growth: { baseHp: 1000, hpPerLevel: 100 },
  ...officer,
}));

export interface UnitSpec {
  officerId: string;
  side: Side;
  pos: Pos;
  level?: number;
  morale?: number;
  hp?: number;
  confused?: boolean;
  exp?: number;
  mp?: number;
  items?: string[];
}

export interface BattleFixtureOptions {
  /** 무장 능력치를 테스트마다 바꾼다(무력·통솔 대조 등). */
  officers?: Partial<Record<string, { war?: number; int?: number; ldr?: number }>>;
  weather?: Stage["weather"];
  /** 전투 상수 일부만 바꾼다. 난수 폭을 1~1로 고정하면 공식만 남는다. */
  combatConfig?: Partial<CombatConfig>;
  /** 게임 설정 일부만 바꾼다(경험치 공유 토글 등). */
  config?: Partial<GameConfig>;
  /** 모든 상성 배수를 이 값으로 덮어쓴다. 상성이 빠졌을 때와 비교하기 위한 장치. */
  affinityModifier?: number;
}

function gameData(options: BattleFixtureOptions): GameData {
  const families = [...new Set(CLASSES.map((cls) => cls.family))] as Family[];
  const raw = {
    config: { ...validConfig, ...options.config },
    combatConfig: { ...validCombatConfig, ...options.combatConfig },
    terrain: TERRAIN,
    classes: CLASSES,
    tactics: TACTICS,
    items: ITEMS,
    officers: OFFICERS.map((officer) => ({ ...officer, ...options.officers?.[officer.id] })),
    affinity: families.flatMap((attacker) =>
      families.map((defender) => ({
        attacker,
        defender,
        modifier:
          options.affinityModifier ??
          (STRONG_AGAINST[attacker] === defender
            ? 0.75
            : STRONG_AGAINST[defender] === attacker
              ? 1.25
              : 1),
      })),
    ),
    sprites: Object.fromEntries(CLASSES.map((cls) => [cls.id, { ...validSprite }])),
    animations: Object.fromEntries(
      CLASSES.map((cls) => [cls.id, structuredClone(validAnimationSet)]),
    ),
    stages: {},
  };

  const { data, issues } = loadGameData(raw);
  if (!data || issues.length > 0) {
    throw new Error(`전투 픽스처 데이터가 유효하지 않다:\n${formatIssues(issues)}`);
  }
  return data;
}

function makeStage(rows: string[], weather: Stage["weather"]): Stage {
  const tiles = rows.map((row) =>
    [...row].map((char) => TILE_CHARS[char] ?? `알 수 없는 타일 문자 '${char}'`),
  );
  return {
    id: "stage-fixture",
    name: "테스트 전장",
    map: { width: tiles[0]?.length ?? 0, height: tiles.length, tiles },
    weather,
    deployment: { maxUnits: 1, zone: [[0, 0]] },
    enemies: [{ officerId: "foot", level: 1, morale: 100, pos: [0, 0] }],
    victory: { type: "annihilateEnemies" },
    defeat: { type: "officerLost", officerIds: ["foot"] },
  };
}

/**
 * 전장 하나를 만든다. `createBattleState`의 배치 규칙을 거치지 않고 상태를 직접 세워
 * 각 테스트가 필요한 배치만 정확히 표현하게 한다.
 */
export function makeBattle(
  rows: string[],
  specs: UnitSpec[],
  options: BattleFixtureOptions = {},
): { ctx: BattleContext; state: BattleState } {
  const data = gameData(options);
  const stage = makeStage(rows, options.weather ?? "clear");

  const units: Unit[] = specs.map((spec) => {
    const officer = data.officers.find((candidate) => candidate.id === spec.officerId);
    if (!officer) throw new Error(`픽스처에 없는 무장: ${spec.officerId}`);

    const level = spec.level ?? 5;
    const hpMax = hpMaxOf(officer, level);
    const mpMax = mpMaxOf(data.combatConfig, officer, level);
    return {
      officerId: officer.id,
      classId: officer.classId,
      side: spec.side,
      level,
      hp: spec.hp ?? hpMax,
      hpMax,
      morale: spec.morale ?? 100,
      pos: spec.pos,
      moved: false,
      acted: false,
      confused: spec.confused ?? false,
      exp: spec.exp ?? 0,
      mp: spec.mp ?? mpMax,
      mpMax,
      items: spec.items ?? [],
    };
  });

  return { ctx: { data, stage }, state: { units, turn: 1, phase: "player", weather: stage.weather } };
}

/** 좌표 집합 비교용 — 순서에 의존하지 않는다. */
export const asKeys = (positions: readonly Pos[]): string[] =>
  positions.map(([x, y]) => `${x},${y}`).sort();
