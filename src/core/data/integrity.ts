import type {
  Affinity,
  AnimationSet,
  CombatConfig,
  Family,
  GameConfig,
  Officer,
  Pos,
  Sprite,
  Stage,
  Terrain,
  UnitClass,
} from "./schemas";

/** 데이터 파일 하나가 아니라 파일 사이의 관계에서 발견된 문제까지 함께 표현한다. */
export interface DataIssue {
  /** 문제가 발견된 파일 또는 논리적 출처 */
  source: string;
  /** 파일 안에서의 위치 (예: `classes[2].sprite`) */
  path: string;
  message: string;
}

export interface GameData {
  config: GameConfig;
  combatConfig: CombatConfig;
  terrain: Terrain[];
  classes: UnitClass[];
  officers: Officer[];
  affinity: Affinity[];
  sprites: Record<string, Sprite>;
  animations: Record<string, AnimationSet>;
  stages: Stage[];
}

const issue = (source: string, path: string, message: string): DataIssue => ({
  source,
  path,
  message,
});

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * 파일 간 참조 무결성을 전수 검사한다(AC-01).
 * 첫 문제에서 멈추지 않고 발견한 문제를 모두 모아 돌려준다 — 한 번의 실행으로 전부 고칠 수 있게.
 */
export function checkIntegrity(data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];

  const terrainIds = new Set(data.terrain.map((t) => t.id));
  const classIds = new Set(data.classes.map((c) => c.id));

  for (const id of duplicateIds(data.terrain.map((t) => t.id))) {
    issues.push(issue("terrain.json", `id=${id}`, `지형 ID가 중복 정의되었다: ${id}`));
  }
  for (const id of duplicateIds(data.classes.map((c) => c.id))) {
    issues.push(issue("classes.json", `id=${id}`, `병과 ID가 중복 정의되었다: ${id}`));
  }
  for (const id of duplicateIds(data.officers.map((o) => o.id))) {
    issues.push(issue("officers.json", `id=${id}`, `무장 ID가 중복 정의되었다: ${id}`));
  }
  for (const id of duplicateIds(data.stages.map((s) => s.id))) {
    issues.push(issue("scenario/stages", `id=${id}`, `스테이지 ID가 중복 정의되었다: ${id}`));
  }

  data.classes.forEach((cls, index) => {
    const at = `classes[${index}] (${cls.id})`;

    if (!(cls.sprite in data.sprites)) {
      issues.push(
        issue(
          "assets-map/sprites.json",
          `${at}.sprite`,
          `병과 ${cls.id}의 스프라이트 매핑 '${cls.sprite}'가 sprites.json에 없다`,
        ),
      );
    }

    if (!(cls.id in data.animations)) {
      issues.push(
        issue(
          "assets-map/animations.json",
          `${at}`,
          `병과 ${cls.id}의 애니메이션 정의가 animations.json에 없다`,
        ),
      );
    }

    if (cls.upgradesTo !== null && !classIds.has(cls.upgradesTo)) {
      issues.push(
        issue(
          "classes.json",
          `${at}.upgradesTo`,
          `승급 대상 병과 '${cls.upgradesTo}'가 classes.json에 없다`,
        ),
      );
    }

    for (const [rule, ids] of [
      ["forbidden", cls.movementRules.forbidden],
      ["halved", cls.movementRules.halved],
    ] as const) {
      for (const terrainId of ids) {
        if (!terrainIds.has(terrainId)) {
          issues.push(
            issue(
              "classes.json",
              `${at}.movementRules.${rule}`,
              `이동 규칙이 참조한 지형 '${terrainId}'가 terrain.json에 없다`,
            ),
          );
        }
      }
    }
  });

  data.officers.forEach((officer, index) => {
    if (!classIds.has(officer.classId)) {
      issues.push(
        issue(
          "officers.json",
          `officers[${index}] (${officer.id}).classId`,
          `무장 ${officer.id}의 병과 '${officer.classId}'가 classes.json에 없다`,
        ),
      );
    }
  });

  issues.push(...checkAffinityCoverage(data));
  issues.push(...checkStageTiles(data, terrainIds));
  issues.push(...checkStageBattleSetup(data));

  return issues;
}

/** 실제로 쓰이는 계열 조합만 요구한다 — 정의하지 않은 계열까지 채우게 만들지 않는다. */
function checkAffinityCoverage(data: GameData): DataIssue[] {
  const usedFamilies = [...new Set(data.classes.map((c) => c.family))] as Family[];
  const defined = new Set(data.affinity.map((a) => `${a.attacker}>${a.defender}`));
  const issues: DataIssue[] = [];

  for (const attacker of usedFamilies) {
    for (const defender of usedFamilies) {
      if (!defined.has(`${attacker}>${defender}`)) {
        issues.push(
          issue(
            "affinity.json",
            `${attacker}>${defender}`,
            `상성 조합이 정의되지 않았다: 공격 ${attacker} → 방어 ${defender}`,
          ),
        );
      }
    }
  }
  return issues;
}

/** 배치·적·승패 조건이 실제로 존재하는 무장과 맵 안 좌표를 가리키는지 본다. */
function checkStageBattleSetup(data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];
  const officerIds = new Set(data.officers.map((o) => o.id));

  for (const stage of data.stages) {
    const source = `scenario/stages/${stage.id}`;
    const inMap = ([x, y]: Pos): boolean =>
      x < stage.map.width && y < stage.map.height;

    const requireOfficer = (path: string, officerId: string): void => {
      if (!officerIds.has(officerId)) {
        issues.push(issue(source, path, `무장 '${officerId}'가 officers.json에 없다`));
      }
    };

    stage.deployment.zone.forEach((pos, index) => {
      if (!inMap(pos)) {
        issues.push(
          issue(
            source,
            `deployment.zone[${index}]`,
            `배치 좌표 [${pos[0]}, ${pos[1]}]가 맵(${stage.map.width}×${stage.map.height}) 밖이다`,
          ),
        );
      }
    });

    stage.deployment.roster?.forEach((entry, index) => {
      requireOfficer(`deployment.roster[${index}].officerId`, entry.officerId);
    });

    const occupied = new Set<string>();
    stage.enemies.forEach((enemy, index) => {
      const at = `enemies[${index}]`;
      requireOfficer(`${at}.officerId`, enemy.officerId);

      if (!inMap(enemy.pos)) {
        issues.push(
          issue(
            source,
            `${at}.pos`,
            `배치 좌표 [${enemy.pos[0]}, ${enemy.pos[1]}]가 맵(${stage.map.width}×${stage.map.height}) 밖이다`,
          ),
        );
      }

      const key = `${enemy.pos[0]},${enemy.pos[1]}`;
      if (occupied.has(key)) {
        issues.push(
          issue(source, `${at}.pos`, `적 부대가 같은 칸 [${enemy.pos[0]}, ${enemy.pos[1]}]에 겹친다`),
        );
      }
      occupied.add(key);
    });

    stage.defeat.officerIds.forEach((officerId, index) => {
      requireOfficer(`defeat.officerIds[${index}]`, officerId);
    });
  }

  return issues;
}

function checkStageTiles(data: GameData, terrainIds: Set<string>): DataIssue[] {
  const issues: DataIssue[] = [];

  for (const stage of data.stages) {
    // 같은 오타가 수백 타일에 반복돼도 지형 종류당 한 번만 보고한다.
    const unknown = new Map<string, [number, number]>();

    stage.map.tiles.forEach((row, y) => {
      row.forEach((terrainId, x) => {
        if (!terrainIds.has(terrainId) && !unknown.has(terrainId)) {
          unknown.set(terrainId, [x, y]);
        }
      });
    });

    for (const [terrainId, [x, y]] of unknown) {
      issues.push(
        issue(
          `scenario/stages/${stage.id}`,
          `map.tiles[${y}][${x}]`,
          `정의되지 않은 지형 '${terrainId}'를 참조한다 (최초 발견 위치)`,
        ),
      );
    }
  }
  return issues;
}
