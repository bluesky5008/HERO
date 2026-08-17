import type { GameData } from "../data/integrity";
import type { Officer, Pos, Stage, StageUnit, UnitClass } from "../data/schemas";

/**
 * 전투 상태와 그 구성([전체 설계 §6.3], DES-01).
 * 상태는 순수 데이터이며 렌더·UI를 알지 못한다(NFR-02).
 */

export type Side = "player" | "enemy";

export interface Unit {
  officerId: string;
  classId: string;
  side: Side;
  level: number;
  /** 병력. 0이 되면 격파된다. */
  hp: number;
  /** 병력 상한 — 무장 성장값과 레벨에서 파생된다([상세 스펙 §1.6]) */
  hpMax: number;
  morale: number;
  pos: Pos;
  /** 이번 페이즈의 이동을 썼는가. 페이즈당 이동 1회 + 행동 1회다([상세 스펙 §1.1]). */
  moved: boolean;
  /** 이번 페이즈의 행동을 마쳤는가. 행동 후에는 이동도 할 수 없다. */
  acted: boolean;
}

export interface BattleState {
  units: Unit[];
  /** 1부터 시작하는 턴 수 */
  turn: number;
  phase: Side;
  weather: Stage["weather"];
}

/**
 * 전투 내내 바뀌지 않는 참조 자료.
 * `BattleState`는 세이브에 그대로 실리는 값이어야 하므로(M3) 데이터·스테이지를 담지 않고 따로 받는다.
 */
export interface BattleContext {
  data: GameData;
  stage: Stage;
}

/** 배치 규칙 위반. 데이터·UI가 막아야 할 상황이므로 조용히 넘기지 않는다. */
export class BattleSetupError extends Error {}

/** 부대를 지휘하는 무장. 배치 시점에 존재를 확인하므로 여기서 없으면 데이터가 도중에 바뀐 것이다. */
export function officerOf(ctx: BattleContext, unit: Unit): Officer {
  const officer = ctx.data.officers.find((candidate) => candidate.id === unit.officerId);
  if (!officer) throw new BattleSetupError(`무장 '${unit.officerId}'가 데이터에 없다`);
  return officer;
}

/** 부대의 병과. 배치 시점에 존재를 확인하므로 여기서 없으면 데이터가 도중에 바뀐 것이다. */
export function classOf(ctx: BattleContext, unit: Unit): UnitClass {
  const cls = ctx.data.classes.find((candidate) => candidate.id === unit.classId);
  if (!cls) throw new BattleSetupError(`병과 '${unit.classId}'가 데이터에 없다`);
  return cls;
}

/** 부대가 선 칸의 지형. 정의되지 않은 지형이면 `undefined`. */
export function terrainAt(ctx: BattleContext, [x, y]: Pos) {
  const id = ctx.stage.map.tiles[y]?.[x];
  return ctx.data.terrain.find((terrain) => terrain.id === id);
}

/** 레벨 1의 기준값에서 레벨업 횟수만큼 상한이 오른다([상세 스펙 §1.6]). */
export function hpMaxOf(officer: Officer, level: number): number {
  return officer.growth.baseHp + officer.growth.hpPerLevel * (level - 1);
}

const posKey = ([x, y]: Pos): string => `${x},${y}`;

/**
 * 스테이지 데이터와 출진 배치로 전투 시작 상태를 만든다.
 * 출진 명단은 M1에서 스테이지의 `deployment.roster`가, M3부터는 캠페인 편성이 공급한다.
 */
export function createBattleState(
  data: GameData,
  stage: Stage,
  party: readonly StageUnit[],
): BattleState {
  if (party.length > stage.deployment.maxUnits) {
    throw new BattleSetupError(
      `출진 부대가 최대 ${stage.deployment.maxUnits}개인데 ${party.length}개를 배치했다`,
    );
  }

  const zone = new Set(stage.deployment.zone.map(posKey));
  for (const placement of party) {
    if (!zone.has(posKey(placement.pos))) {
      throw new BattleSetupError(
        `${placement.officerId}의 배치 좌표 [${placement.pos}]가 배치 구역 밖이다`,
      );
    }
  }

  const officers = new Map(data.officers.map((officer) => [officer.id, officer]));
  const occupied = new Set<string>();
  const units: Unit[] = [];

  for (const [side, placements] of [
    ["player", party],
    ["enemy", stage.enemies],
  ] as const) {
    for (const placement of placements) {
      const officer = officers.get(placement.officerId);
      if (!officer) {
        throw new BattleSetupError(`무장 '${placement.officerId}'가 데이터에 없다`);
      }
      if (!data.classes.some((cls) => cls.id === officer.classId)) {
        throw new BattleSetupError(
          `무장 ${officer.id}의 병과 '${officer.classId}'가 데이터에 없다`,
        );
      }

      const [x, y] = placement.pos;
      if (x >= stage.map.width || y >= stage.map.height) {
        throw new BattleSetupError(
          `${officer.id}의 배치 좌표 [${x}, ${y}]가 맵(${stage.map.width}×${stage.map.height}) 밖이다`,
        );
      }
      if (occupied.has(posKey(placement.pos))) {
        throw new BattleSetupError(`배치 좌표 [${x}, ${y}]에 부대가 겹친다`);
      }
      occupied.add(posKey(placement.pos));

      if (units.some((unit) => unit.officerId === officer.id)) {
        throw new BattleSetupError(`무장 ${officer.id}가 두 번 출진했다`);
      }

      const hpMax = hpMaxOf(officer, placement.level);
      units.push({
        officerId: officer.id,
        classId: officer.classId,
        side,
        level: placement.level,
        hp: hpMax,
        hpMax,
        morale: placement.morale,
        pos: [x, y],
        moved: false,
        acted: false,
      });
    }
  }

  return { units, turn: 1, phase: "player", weather: stage.weather };
}
