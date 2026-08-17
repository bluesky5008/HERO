import { z, type ZodError, type ZodTypeAny } from "zod";
import {
  AffinitySchema,
  AnimationSetSchema,
  ClassSchema,
  CombatConfigSchema,
  GameConfigSchema,
  OfficerSchema,
  SpriteSchema,
  StageSchema,
  TacticSchema,
  TerrainSchema,
} from "./schemas";
import { checkIntegrity, type DataIssue, type GameData } from "./integrity";

export type { DataIssue, GameData } from "./integrity";

/**
 * 아직 검증되지 않은 원본 JSON 묶음.
 * 파일을 어떻게 읽는지(Node fs / 브라우저 fetch)는 호출자가 정한다 — 코어는 순수하게 유지한다(NFR-02).
 */
export interface RawGameData {
  config: unknown;
  combatConfig: unknown;
  terrain: unknown;
  classes: unknown;
  tactics: unknown;
  officers: unknown;
  affinity: unknown;
  sprites: unknown;
  animations: unknown;
  /** 키는 오류 메시지에 쓸 출처 이름(보통 파일명) */
  stages: Record<string, unknown>;
}

export interface LoadResult {
  /** 스키마 검증을 모두 통과했을 때만 채워진다. 참조 무결성 문제는 데이터 반환을 막지 않는다. */
  data: GameData | null;
  issues: DataIssue[];
}

function toIssues(source: string, error: ZodError): DataIssue[] {
  return error.issues.map((zodIssue) => ({
    source,
    path: zodIssue.path.join(".") || "(root)",
    message: zodIssue.message,
  }));
}

function parse<T extends ZodTypeAny>(
  schema: T,
  source: string,
  value: unknown,
  issues: DataIssue[],
): z.infer<T> | null {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  issues.push(...toIssues(source, result.error));
  return null;
}

/**
 * 원본 JSON을 스키마로 검증하고 파일 간 참조 무결성까지 검사한다.
 * 스키마 위반이 있으면 참조 검사는 건너뛴다 — 형태가 깨진 데이터에서 나온 참조 오류는 오해를 부른다.
 */
export function loadGameData(raw: RawGameData): LoadResult {
  const issues: DataIssue[] = [];

  const config = parse(GameConfigSchema, "config/game-config.json", raw.config, issues);
  const combatConfig = parse(
    CombatConfigSchema,
    "config/combat-config.json",
    raw.combatConfig,
    issues,
  );
  const terrain = parse(TerrainSchema.array(), "terrain.json", raw.terrain, issues);
  const classes = parse(ClassSchema.array(), "classes.json", raw.classes, issues);
  const tactics = parse(TacticSchema.array(), "tactics.json", raw.tactics, issues);
  const officers = parse(OfficerSchema.array(), "officers.json", raw.officers, issues);
  const affinity = parse(AffinitySchema.array(), "affinity.json", raw.affinity, issues);
  const sprites = parse(
    z.record(z.string(), SpriteSchema),
    "assets-map/sprites.json",
    raw.sprites,
    issues,
  );
  const animations = parse(
    z.record(z.string(), AnimationSetSchema),
    "assets-map/animations.json",
    raw.animations,
    issues,
  );

  const stages: GameData["stages"] = [];
  let stagesOk = true;
  for (const [source, value] of Object.entries(raw.stages)) {
    const stage = parse(StageSchema, `scenario/stages/${source}`, value, issues);
    if (stage) stages.push(stage);
    else stagesOk = false;
  }

  if (
    !config ||
    !combatConfig ||
    !terrain ||
    !classes ||
    !tactics ||
    !officers ||
    !affinity ||
    !sprites ||
    !animations ||
    !stagesOk
  ) {
    return { data: null, issues };
  }

  const data: GameData = {
    config,
    combatConfig,
    terrain,
    classes,
    tactics,
    officers,
    affinity,
    sprites,
    animations,
    stages,
  };
  issues.push(...checkIntegrity(data));

  return { data, issues };
}

/** 사람이 읽는 오류 목록. CLI 출력과 테스트가 같은 형식을 공유한다. */
export function formatIssues(issues: DataIssue[]): string {
  return issues.map((i) => `  ${i.source} → ${i.path}\n    ${i.message}`).join("\n");
}
