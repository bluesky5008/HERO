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
});
export type Stage = z.infer<typeof StageSchema>;
