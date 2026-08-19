import type { GameData } from "../data/integrity";
import type {
  AiProfile,
  CombatConfig,
  Officer,
  Pos,
  Stage,
  StageUnit,
  UnitClass,
  Weather,
} from "../data/schemas";

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
  /** 혼란 상태인가. 사기가 임계값 미만일 때 턴 시작 판정으로 걸리고 조작이 막힌다([상세 스펙 §1.4]). */
  confused: boolean;
  /** 다음 레벨까지의 누적 경험치. 임계에 닿을 때마다 레벨이 오르고 잔여분이 남는다([상세 스펙 §1.6]). */
  exp: number;
  /** 책략치. 책략을 쓰면 줄고 거점 위 턴 시작에만 자연 회복한다([상세 스펙 §1.5]). */
  mp: number;
  /** 책략치 상한 — 지력과 레벨에서 파생된다 */
  mpMax: number;
  /** 지닌 아이템 ID. `combatConfig.itemSlots`가 상한이다([FR-07]). */
  items: string[];
  /**
   * 행동 프로필([상세 스펙 §5.1]). 적 부대만 쓰며 이벤트로 바뀔 수 있다(`setAiProfile`).
   * 배치 데이터가 아니라 상태에 두는 것은 전투 중에 바뀌기 때문이다.
   */
  ai: AiProfile;
  /** `guard`가 지킬 자리와 `flee`가 향할 탈출점. 없으면 배치 좌표를 기준으로 삼는다. */
  aiParams: { anchor: Pos | null; escape: Pos | null };
}

export interface BattleState {
  units: Unit[];
  /** 1부터 시작하는 턴 수 */
  turn: number;
  phase: Side;
  /** 지금 날씨. 스테이지가 동적 날씨를 정했으면 턴 시작마다 바뀐다([상세 스펙 §1.7]). */
  weather: Weather;
  /** 비가 남은 턴 수. 고정 날씨 스테이지에서는 언제나 0이다. */
  weatherTurnsLeft: number;
  /** 이미 가져간 보물의 좌표 키(`"x,y"`). 보물은 1회성이다. */
  treasuresTaken: string[];
  /** 이미 발동한 `once` 이벤트의 ID([상세 스펙 §3.4]). */
  firedEvents: string[];
  /**
   * 이벤트가 세운 플래그. 캠페인 플래그의 전투 안 사본이며,
   * 캠페인이 생기는 M3에서 이 자리를 캠페인 상태가 대신한다([상세 스펙 §4.1]).
   */
  flags: string[];
  /** 이벤트가 강제로 정한 승패. 정해지면 조건 판정보다 앞선다([상세 스펙 §3.3]의 `endBattle`). */
  forcedOutcome: "victory" | "defeat" | null;
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

/**
 * 책략치 상한 `floor(지력 / mpIntDivisor) + 레벨`([상세 스펙 §1.5]).
 * 배치와 레벨업이 같은 식을 쓰도록 계산 경로를 하나로 둔다 — `hpMaxOf`와 같은 이유다.
 */
export function mpMaxOf(config: CombatConfig, officer: Officer, level: number): number {
  return Math.floor(officer.int / config.mpIntDivisor) + level;
}

export const posKey = ([x, y]: Pos): string => `${x},${y}`;

/**
 * 배치 하나를 전투 부대로 만든다. 파생치는 언제나 여기서 나온다 —
 * 배치와 이벤트 증원([eventRunner](../campaign/eventRunner.ts))이 같은 식을 쓰게 하려는 것이다.
 */
export function makeUnit(data: GameData, officer: Officer, placement: StageUnit, side: Side): Unit {
  const hpMax = hpMaxOf(officer, placement.level);
  const mpMax = mpMaxOf(data.combatConfig, officer, placement.level);

  return {
    officerId: officer.id,
    classId: officer.classId,
    side,
    level: placement.level,
    hp: hpMax,
    hpMax,
    morale: placement.morale,
    pos: placement.pos,
    moved: false,
    acted: false,
    confused: false,
    exp: 0,
    mp: mpMax,
    mpMax,
    items: [],
    ai: placement.ai,
    aiParams: placement.aiParams,
  };
}

/** 전투를 시작할 때의 날씨. 스테이지가 문자열로 적었으면 그 값, 동적이면 지정한 시작 날씨다. */
export function initialWeather(stage: Stage): Weather {
  return typeof stage.weather === "string" ? stage.weather : stage.weather.initial;
}

/**
 * 스테이지 데이터와 출진 배치로 전투 시작 상태를 만든다.
 * 출진 명단은 M1에서 스테이지의 `deployment.roster`가, M3부터는 캠페인 편성이 공급한다.
 *
 * 적 부대는 언제나 `stage.enemies`에서 새로 세워진다 — 전투 중 얻은 경험치·레벨은
 * 그 전투에서만 유효하고 다음 스테이지로 이관되지 않는다([상세 스펙 §1.6]의 성장은 아군 몫이다).
 * M3에서 캠페인이 명단을 공급할 때도 이 자리는 플레이어 편성만 받는다.
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

      units.push(makeUnit(data, officer, { ...placement, pos: [x, y] }, side));
    }
  }

  return {
    units,
    turn: 1,
    phase: "player",
    weather: initialWeather(stage),
    weatherTurnsLeft: 0,
    treasuresTaken: [],
    firedEvents: [],
    flags: [],
    forcedOutcome: null,
  };
}
