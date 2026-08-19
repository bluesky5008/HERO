import { z } from "zod";

/**
 * 게임 데이터의 정본 스키마([DESIGN §데이터와 인터페이스]).
 * 데이터 파일이 아니라 이 코드가 스키마의 원본이며, validate와 런타임 로더가 함께 쓴다.
 */

export const FAMILIES = [
  "infantry",
  "cavalry",
  "archer",
  "transport",
  "band",
  "sorcerer",
  "special",
] as const;

export const FamilySchema = z.enum(FAMILIES);
export type Family = z.infer<typeof FamilySchema>;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "6자리 hex 색상이어야 한다 (예: #7fa650)");

export const GameConfigSchema = z.object({
  tileSize: z.number().int().positive(),
  logicalWidth: z.number().int().positive(),
  logicalHeight: z.number().int().positive(),
  /**
   * 격파 경험치를 생존 아군이 나눠 갖는가([상세 스펙 §1.6]).
   * 기본 OFF가 원작 동작(막타 독식)이며, 켜는 것은 낮은 레벨 부대 육성 편의 옵션이다.
   * 설정 화면은 M3에서 만든다 — M2는 값만 읽는다.
   */
  shareExp: z.boolean().default(false),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

/**
 * 전투 공식의 상수([상세 스펙 §1.3]). 코드에 숫자를 박지 않고 전부 여기서 읽는다(NFR-06) —
 * M2의 원작 대조 튜닝이 데이터 수정만으로 끝나야 한다.
 */
export const CombatConfigSchema = z.object({
  /** 물리 데미지 = baseDamage × 실효공격 / 실효방어 × 난수 */
  baseDamage: z.number().positive(),
  /** 아무리 불리해도 이 값 아래로는 내려가지 않는다 */
  minDamage: z.number().int().nonnegative(),
  /** 데미지에 곱하는 난수 폭(초기 0.9~1.1) */
  damageJitter: z
    .object({ min: z.number().positive(), max: z.number().positive() })
    .refine((jitter) => jitter.min <= jitter.max, {
      message: "난수 폭의 최솟값은 최댓값 이하여야 한다",
    }),
  /** 사기 상한. 사기 범위는 0~이 값이다([상세 스펙 §1.4]) */
  moraleMax: z.number().int().positive(),
  /** 공격을 한 번 받을 때 잃는 사기(초기 2) */
  moraleLossOnHit: z.number().int().nonnegative(),
  /** 혼란([상세 스펙 §1.4]) */
  confusion: z.object({
    /** 사기가 이 값 미만이면 턴 시작마다 혼란 판정을 받는다(초기 30) */
    threshold: z.number().int().nonnegative(),
    /** 그 판정이 혼란으로 이어질 확률 0~1 */
    chance: z.number().min(0).max(1),
  }),
  /** 거점 위 부대의 턴 시작 회복([상세 스펙 §1.7]) */
  strongholdRecovery: z.object({
    /** 병력 상한 대비 회복 비율(초기 0.1 = +10%) */
    hpRatio: z.number().nonnegative(),
    morale: z.number().int().nonnegative(),
    /** 책략치의 자연 회복은 거점 위에서만 일어난다([상세 스펙 §1.5]) */
    mp: z.number().int().nonnegative(),
  }),
  /** 책략치 상한식 `floor(지력 / 이 값) + 레벨`([상세 스펙 §1.5]) */
  mpIntDivisor: z.number().int().positive(),
  /** 부대 하나가 지닐 수 있는 아이템 수([FR-07] — 초기 8) */
  itemSlots: z.number().int().positive(),
  /** 책략 판정([상세 스펙 §1.5]) */
  tactic: z.object({
    /** 명중률 `clamp(hitBase + 지력차, hitMin, hitMax)` (백분율) */
    hitBase: z.number().nonnegative(),
    hitMin: z.number().nonnegative(),
    hitMax: z.number().nonnegative(),
    /** 피해 배수 `1 + 지력차 / 이 값` */
    damageIntDivisor: z.number().positive(),
    /**
     * 거점 위 부대에게 무효인 효과([상세 스펙 §1.5]).
     * 사기저하·혼란까지 막는지는 원작 대조가 필요한 `[검증]` 항목이라 코드가 아니라 이 목록이 정한다.
     */
    strongholdBlocks: z.array(z.string().min(1)),
  }),
  /**
   * 적 AI 스코어링 가중치([상세 스펙 §5.2]의 W1~W6).
   * 난이도 프리셋은 이 세트를 통째로 바꿔 만든다 — 코드가 아니라 데이터가 난이도를 정한다.
   */
  ai: z.object({
    /** W1 예상 데미지 */
    damage: z.number(),
    /** W2 격파 가능 보너스 */
    finish: z.number(),
    /** W3 대상 위협도 */
    threat: z.number(),
    /** W4 받을 위험(인접한 상대 수로 잰다 — 반격이 기본이 아니라 다음 턴 피격 예상이다) */
    risk: z.number(),
    /** W5 내가 설 칸의 지형 방어 보정 */
    terrain: z.number(),
    /** W6 접근도(칠 수 없을 때 얼마나 가까워지는가) */
    approach: z.number(),
    /** `defensive`가 깨어나는 거리(기본 6) */
    alertRange: z.number().int().positive(),
    /** `support`가 아군을 회복시키기 시작하는 병력 비율 */
    supportHealRatio: z.number().min(0).max(1),
    /** `support`가 후퇴를 시작하는 자기 병력 비율 */
    supportFleeRatio: z.number().min(0).max(1),
  }),
  /** 일기토([상세 스펙 §7.2]) */
  duel: z.object({
    /** 승률 `clamp(base + 무력차 × warScale, min, max)` (백분율) */
    base: z.number().nonnegative(),
    warScale: z.number(),
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    /** 승자가 얻는 경험치(초기 100 — 레벨업 임계와 같아 즉시 한 단계 오른다) */
    winnerExp: z.number().int().nonnegative(),
    /** 승자 진영 전체가 얻는 사기 */
    winnerMorale: z.number().int(),
  }),
  /** 레벨 상한([상세 스펙 §1.6]). 출진 명단의 레벨 상한과 달리 전투 중 성장의 천장이다. */
  maxLevel: z.number().int().positive(),
  /** 경험치([상세 스펙 §1.6]) */
  exp: z
    .object({
      /** 공격 경험치 = 데미지 / 이 값 (내림) */
      divisor: z.number().positive(),
      /** 공격 한 번이 주는 경험치의 하한·상한(초기 1~40) */
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
      /** 격파 보너스(초기 45 — [상세 스펙 §1.6]의 40~50 범위) */
      defeatBonus: z.number().int().nonnegative(),
      /** 이만큼 쌓일 때마다 레벨이 1 오른다(초기 100) */
      perLevel: z.number().int().positive(),
    })
    .refine((exp) => exp.min <= exp.max, {
      message: "공격 경험치의 하한은 상한 이하여야 한다",
      path: ["min"],
    }),
});
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

/** 날씨. 스테이지가 정하고 책략 게이트가 읽는다([상세 스펙 §1.5·§1.7]). */
export const WeatherSchema = z.enum(["clear", "rain"]);
export type Weather = z.infer<typeof WeatherSchema>;

/**
 * 스테이지의 날씨([상세 스펙 §1.7]).
 * 문자열이면 전투 내내 그 날씨로 고정된다 — M1 스테이지 데이터가 쓰던 표기를 그대로 읽는다.
 * 객체면 턴 시작마다 확률로 비가 오고 정해진 턴 수만큼 유지된다.
 */
export const StageWeatherSchema = z.union([
  WeatherSchema,
  z.object({
    initial: WeatherSchema,
    /** 턴 시작마다 비가 시작될 확률 0~1 */
    rainChance: z.number().min(0).max(1),
    /** 비가 한 번 시작되면 유지되는 턴 수 */
    rainDuration: z.number().int().positive(),
  }),
]);
export type StageWeather = z.infer<typeof StageWeatherSchema>;

/** 지형·날씨별 효과 배수. 적히지 않은 키는 배수 1로 본다. */
const BonusTableSchema = z.record(z.string().min(1), z.number().nonnegative());

/**
 * 책략([전체 설계 §4.4], [상세 스펙 §1.5]).
 * 지형·날씨 게이트를 코드의 분기가 아니라 데이터로 표현한다 — 새 책략이 코드 수정 없이 들어와야 한다(FR-13).
 * `category`는 병과가 무엇을 배우는지 묶는 계열이고, 실제 판정은 아래 게이트 필드가 한다.
 * 콘솔판 풍계는 v1 범위 밖이며 카테고리를 늘리는 것만으로 지원된다.
 */
export const TacticSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["fire", "water", "earth", "moraleDown", "heal"]),
  /** 소비 책략치 */
  cost: z.number().int().nonnegative(),
  /** 피해·회복량의 기준값. 사기 변화처럼 양을 쓰지 않는 효과는 0이다. */
  baseDamage: z.number().nonnegative(),
  range: z.number().int().positive(),
  /** `cross5`는 대상 타일과 상하좌우 5타일([상세 스펙 §1.5]의 "대" 계열) */
  area: z.enum(["single", "cross5"]),
  /** 이 지형 위의 대상에게만 쓸 수 있다(지계). `null`이면 지형 제한 없음. */
  terrainRequired: z.array(z.string().min(1)).min(1).nullable(),
  terrainBonus: BonusTableSchema,
  weatherForbidden: z.array(WeatherSchema),
  weatherBonus: BonusTableSchema,
  effect: z.enum(["damage", "moraleDown", "confuse", "healHp", "healMorale", "healBoth"]),
});
export type Tactic = z.infer<typeof TacticSchema>;

export const ITEM_TYPES = [
  "weapon",
  "manual",
  "mount",
  "regen",
  "classChange",
  "classUpgrade",
  "consumable",
] as const;

/**
 * 아이템([전체 설계 §4.5], [상세 스펙 §1.6]).
 * `value`의 의미는 `type`이 정한다 — `weapon`·`manual`은 데미지에 곱하는 배수,
 * `mount`는 이동력 증가, `regen`은 턴 회복량이다. 나머지 유형은 `value`를 쓰지 않는다.
 */
export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  value: z.number().nonnegative().default(0),
  /** `consumable`이 복제하는 책략 */
  tacticId: z.string().min(1).nullable().default(null),
  /** `classChange`가 바꿀 병과 */
  classId: z.string().min(1).nullable().default(null),
  /** 상점 가격. 전투맵 보물로만 얻는 아이템은 `null`이다. */
  price: z.number().int().nonnegative().nullable(),
  /**
   * 사용할 수 없는 무장. **개조 확장용으로만 남겨 둔 필드다** —
   * 병과 변경·승급 아이템에 값을 넣지 않는 것이 [FR-07]의 설계 결정이고,
   * 값이 들어가면 참조 무결성 검사가 경고한다.
   */
  forbiddenFor: z.array(z.string().min(1)).default([]),
});
export type Item = z.infer<typeof ItemSchema>;

/** 진입 불가는 숫자 코스트 대신 "blocked"로 표기한다. */
const MoveCostSchema = z.union([z.number().int().positive(), z.literal("blocked")]);

const moveCostShape = Object.fromEntries(
  FAMILIES.map((family) => [family, MoveCostSchema]),
) as Record<Family, typeof MoveCostSchema>;

export const MoveCostTableSchema = z.object(moveCostShape);

export const TerrainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 방어 보정 비율. 0.1 = +10% */
  defenseBonus: z.number(),
  moveCost: MoveCostTableSchema,
  placeholderColor: hexColor,
  /** 마을·성문·성내 등 턴 회복과 공격 책략 무효가 적용되는 거점 */
  stronghold: z.boolean().default(false),
});
export type Terrain = z.infer<typeof TerrainSchema>;

export const ClassSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    family: FamilySchema,
    tier: z.number().int().min(1).max(3),
    upgradesTo: z.string().min(1).nullable(),
    upgradeLevel: z.number().int().positive().nullable(),
    attackMod: z.number(),
    defenseMod: z.number(),
    movement: z.number().int().positive(),
    attackRange: z
      .object({
        min: z.number().int().nonnegative(),
        max: z.number().int().positive(),
        directions: z.union([z.literal(4), z.literal(8)]),
      })
      .refine((range) => range.min <= range.max, {
        message: "사거리 최솟값은 최댓값 이하여야 한다",
      }),
    movementRules: z.object({
      forbidden: z.array(z.string().min(1)),
      halved: z.array(z.string().min(1)),
    }),
    tactics: z.array(z.string().min(1)),
    flags: z.array(z.enum(["counterAttack", "mountainMove", "noTerrainPenalty"])),
    sprite: z.string().min(1),
  })
  .refine((cls) => (cls.upgradesTo === null) === (cls.upgradeLevel === null), {
    message: "승급 대상과 승급 레벨은 함께 지정하거나 함께 비워야 한다",
    path: ["upgradeLevel"],
  });
export type UnitClass = z.infer<typeof ClassSchema>;

/**
 * 무장([상세 스펙 §9]). M1 전투가 실제로 읽는 필드로 한정한다 —
 * 초상·합류 스테이지·일기토·책략치 성장은 해당 기능이 들어오는 마일스톤에서 추가한다.
 */
export const OfficerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 무력 — 실효 공격에 더해진다 */
  war: z.number().int().min(1).max(100),
  /** 지력 — 책략(M2)에서 쓴다 */
  int: z.number().int().min(1).max(100),
  /** 통솔 — 실효 방어에 더해진다 */
  ldr: z.number().int().min(1).max(100),
  classId: z.string().min(1),
  growth: z.object({
    /** 레벨 1의 병력 상한 */
    baseHp: z.number().int().positive(),
    /** 레벨업 1회당 병력 상한 증가량 ([상세 스펙 §1.6]) */
    hpPerLevel: z.number().int().positive(),
  }),
});
export type Officer = z.infer<typeof OfficerSchema>;

export const AffinitySchema = z.object({
  attacker: FamilySchema,
  defender: FamilySchema,
  /** 방어측 방어력에 곱하는 배수. 공격측 유리 0.75 / 동등 1.0 / 불리 1.25 (상세 스펙 §1.3) */
  modifier: z.number().positive(),
});
export type Affinity = z.infer<typeof AffinitySchema>;

export const SpriteSchema = z.object({
  sheet: z.string().min(1),
  frameSize: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  baseRow: z.number().int().nonnegative(),
  /** 시트를 아직 만들지 않았을 때 대체 렌더에 쓰는 색 */
  placeholderColor: hexColor,
});
export type Sprite = z.infer<typeof SpriteSchema>;

const AnimationClipSchema = z.object({
  frames: z.array(z.number().int().nonnegative()).min(1),
  fps: z.number().positive(),
  once: z.boolean().optional(),
  flash: z.boolean().optional(),
});

/** 스프라이트 계약: 모든 병과는 아래 4개 애니메이션을 갖는다(프레임 수·속도는 자유). */
export const AnimationSetSchema = z.object({
  idle: AnimationClipSchema,
  move: AnimationClipSchema,
  attack: AnimationClipSchema,
  damaged: AnimationClipSchema,
});
export type AnimationSet = z.infer<typeof AnimationSetSchema>;

/** 맵 좌표 `[x, y]`. 맵 안인지는 스테이지 크기를 알아야 하므로 참조 무결성 검사가 본다. */
export const PosSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
export type Pos = z.infer<typeof PosSchema>;

/** 출진 명단 한 줄. 좌표는 배치 단계에서 정해진다. */
export const RosterEntrySchema = z.object({
  officerId: z.string().min(1),
  level: z.number().int().min(1).max(99),
  /** 사기 초기값([상세 스펙 §1.4] — 기본 100) */
  morale: z.number().int().min(0).max(100).default(100),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const AI_PROFILES = ["aggressive", "defensive", "guard", "support", "flee"] as const;
export const AiProfileSchema = z.enum(AI_PROFILES);
export type AiProfile = z.infer<typeof AiProfileSchema>;

/** 좌표까지 정해진 부대. 스테이지의 적 배치와 플레이어 출진 배치가 같은 형태다. */
export const StageUnitSchema = RosterEntrySchema.extend({
  pos: PosSchema,
  /** 적 부대의 행동 프로필([상세 스펙 §5.1]). 플레이어 부대는 쓰지 않는다. */
  ai: AiProfileSchema.default("aggressive"),
  /** `guard`가 지킬 자리와 `flee`가 향할 탈출점 */
  aiParams: z
    .object({ anchor: PosSchema.nullable().default(null), escape: PosSchema.nullable().default(null) })
    .default({ anchor: null, escape: null }),
});
export type StageUnit = z.infer<typeof StageUnitSchema>;


export const SideSchema = z.enum(["player", "enemy"]);

/** 값을 적지 않으면 `null`인 양의 정수. 트리거 파라미터처럼 "있으면 쓴다"는 필드에 쓴다. */
const optionalTurn = z.number().int().positive().nullable().default(null);
const optionalId = z.string().min(1).nullable().default(null);

/**
 * 이벤트 트리거([상세 스펙 §3.2]).
 * `battleStart`·`turnStart`·`turnEnd`는 시점이 오면 재고, 나머지는 상태나 방금 일어난 일을 본다.
 * `stageEnter`·`stageClear`는 전투 밖(`camp` 스코프) 트리거라 M3에서 더한다.
 */
export const EventTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("battleStart") }),
  z.object({ type: z.literal("turnStart"), turn: optionalTurn, fromTurn: optionalTurn }),
  z.object({ type: z.literal("turnEnd"), turn: optionalTurn, fromTurn: optionalTurn }),
  /** `target`을 적지 않으면 누구를 쳤든 발동한다. */
  z.object({ type: z.literal("unitAttacks"), attacker: z.string().min(1), target: optionalId }),
  z.object({ type: z.literal("unitAdjacent"), unit: z.string().min(1), target: z.string().min(1) }),
  z.object({
    type: z.literal("unitHpBelow"),
    unit: z.string().min(1),
    /** 병력 상한 대비 비율. 0.3이면 30% 미만일 때 발동한다. */
    ratio: z.number().min(0).max(1),
  }),
  z.object({ type: z.literal("unitDestroyed"), unit: z.string().min(1), by: optionalId }),
  z.object({
    type: z.literal("unitReaches"),
    unit: z.string().min(1),
    /** `[x1, y1, x2, y2]` 사각 영역(양 끝 포함) */
    area: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
  }),
  /** 그 진영의 남은 부대가 `count` 이하일 때 */
  z.object({ type: z.literal("unitsRemaining"), side: SideSchema, count: z.number().int().nonnegative() }),
]);
export type EventTrigger = z.infer<typeof EventTriggerSchema>;

/**
 * 이벤트 액션([상세 스펙 §3.3]). M2는 전투 안에서 끝나는 것만 구현한다 —
 * `choice`·`giveGold`·`joinOfficer`·`gameOver`는 캠페인(M3), `duel`은 M2 TASK-30이 더한다.
 */
const SimpleEventActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("dialogue"),
    lines: z.array(z.object({ speaker: z.string().min(1), text: z.string().min(1) })).min(1),
  }),
  z.object({ type: z.literal("spawnUnits"), side: SideSchema, units: z.array(StageUnitSchema).min(1) }),
  z.object({ type: z.literal("removeUnit"), unit: z.string().min(1) }),
  z.object({ type: z.literal("moveUnit"), unit: z.string().min(1), pos: PosSchema }),
  z.object({ type: z.literal("setFlag"), flag: z.string().min(1) }),
  z.object({ type: z.literal("clearFlag"), flag: z.string().min(1) }),
  z.object({ type: z.literal("giveItem"), unit: z.string().min(1), itemId: z.string().min(1) }),
  z.object({ type: z.literal("giveExp"), unit: z.string().min(1), amount: z.number().int().positive() }),
  z.object({ type: z.literal("setWeather"), weather: WeatherSchema }),
  /** `unit`을 적으면 그 부대만, `side`를 적으면 그 진영 전체의 사기를 옮긴다. */
  z.object({
    type: z.literal("changeMorale"),
    unit: optionalId,
    side: SideSchema.nullable().default(null),
    delta: z.number().int(),
  }),
  z.object({ type: z.literal("endBattle"), result: z.enum(["victory", "defeat"]) }),
  /** 원작의 "성문 앞 대기" 같은 스크립트성 행동은 프로필 교체로 재현한다([상세 스펙 §5.3]). */
  z.object({ type: z.literal("setAiProfile"), unit: z.string().min(1), profile: AiProfileSchema }),
]);
export type SimpleEventAction = z.infer<typeof SimpleEventActionSchema>;

/**
 * 일기토([상세 스펙 §7]). 이벤트 트리거로만 발동한다.
 * 승패 뒤에 이어지는 액션은 다시 일기토를 부르지 않는다 — 중첩할 이유가 없어 계약을 재귀로 넓히지 않았다.
 */
const DuelActionSchema = z.object({
  type: z.literal("duel"),
  a: z.string().min(1),
  b: z.string().min(1),
  /** `judge`는 무력차로 판정하고 난수를 한 번 쓴다. 나머지는 스크립트가 정한 승패다. */
  outcome: z.enum(["aWins", "bWins", "judge"]),
  /** 패자가 전장을 떠나는 방식. 괴멸은 격파와 같고, 퇴각은 잃은 것으로 치지 않는다. */
  loser: z.enum(["destroyed", "retreats"]).default("destroyed"),
  onAWin: z.array(SimpleEventActionSchema).default([]),
  onBWin: z.array(SimpleEventActionSchema).default([]),
});

export const EventActionSchema = z.union([SimpleEventActionSchema, DuelActionSchema]);
export type EventAction = z.infer<typeof EventActionSchema>;
export type DuelAction = z.infer<typeof DuelActionSchema>;

/** 스테이지 이벤트 하나([상세 스펙 §3.1]). */
export const StageEventSchema = z.object({
  id: z.string().min(1),
  /** `camp`은 전투 밖에서 도는 이벤트라 전투 중에는 평가하지 않는다(M3). */
  scope: z.enum(["battle", "camp"]).default("battle"),
  once: z.boolean().default(true),
  trigger: EventTriggerSchema,
  /** 플래그 조건. 맞지 않으면 트리거가 성립해도 액션을 실행하지 않는다. */
  condition: z
    .object({ flag: z.string().min(1), isSet: z.boolean().default(true) })
    .nullable()
    .default(null),
  actions: z.array(EventActionSchema).min(1),
});
export type StageEvent = z.infer<typeof StageEventSchema>;

/** M1은 적 전멸 승리와 지정 무장 격파 패배만 다룬다. 도달·생존 조건은 M2에서 유형을 늘린다. */
const VictoryConditionSchema = z.object({ type: z.literal("annihilateEnemies") });
const DefeatConditionSchema = z.object({
  type: z.literal("officerLost"),
  officerIds: z.array(z.string().min(1)).min(1),
});

export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  map: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      /** [y][x] 순서의 지형 ID 행렬 */
      tiles: z.array(z.array(z.string().min(1))),
    })
    .superRefine((map, ctx) => {
      if (map.tiles.length !== map.height) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiles"],
          message: `타일 행 수(${map.tiles.length})가 height(${map.height})와 다르다`,
        });
      }
      map.tiles.forEach((row, y) => {
        if (row.length !== map.width) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tiles", y],
            message: `타일 열 수(${row.length})가 width(${map.width})와 다르다`,
          });
        }
      });
    }),
  weather: StageWeatherSchema,
  deployment: z
    .object({
      maxUnits: z.number().int().positive(),
      /** 플레이어가 부대를 놓을 수 있는 칸 */
      zone: z.array(PosSchema).min(1),
      /** M1 프로토타입의 출진 가능 명단. M3에서 캠페인 편성이 이 자리를 대신한다. */
      roster: z.array(RosterEntrySchema).min(1).optional(),
    })
    .refine((deployment) => deployment.maxUnits <= deployment.zone.length, {
      message: "출진 가능 수가 배치 가능한 칸 수보다 많다",
      path: ["maxUnits"],
    }),
  enemies: z.array(StageUnitSchema).min(1),
  /** 맵에 묻힌 보물·군량고. 조사로 한 번만 얻는다([상세 스펙 §1.7]). */
  treasures: z.array(z.object({ pos: PosSchema, itemId: z.string().min(1) })).default([]),
  /** 스테이지 이벤트. 동시에 성립하면 이 배열 순서대로 실행한다([상세 스펙 §3.4]). */
  events: z.array(StageEventSchema).default([]),
  victory: VictoryConditionSchema,
  defeat: DefeatConditionSchema,
});
export type Stage = z.infer<typeof StageSchema>;
