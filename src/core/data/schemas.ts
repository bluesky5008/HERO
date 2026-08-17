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

/** 좌표까지 정해진 부대. 스테이지의 적 배치와 플레이어 출진 배치가 같은 형태다. */
export const StageUnitSchema = RosterEntrySchema.extend({ pos: PosSchema });
export type StageUnit = z.infer<typeof StageUnitSchema>;

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
  weather: WeatherSchema,
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
  victory: VictoryConditionSchema,
  defeat: DefeatConditionSchema,
});
export type Stage = z.infer<typeof StageSchema>;
