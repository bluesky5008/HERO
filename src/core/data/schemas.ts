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
});
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

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
  weather: z.enum(["clear", "rain"]),
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
