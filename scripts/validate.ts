import { formatIssues, loadGameData } from "../src/core/data/loader";
import { DataReadError, readGameData } from "./readGameData";

/**
 * `npm run validate` — 데이터 파일 전수 검사.
 * 문제가 있으면 목록을 출력하고 0이 아닌 코드로 종료한다(AC-01).
 * 종료 코드는 릴리스 빌드의 게이트이기도 하다(ADR-006).
 */

const dataDir = process.argv[2] ?? "data";

try {
  const { data, issues } = loadGameData(readGameData(dataDir));

  const errors = issues.filter((issue) => issue.severity !== "warning");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  // 경고는 데이터를 막지 않는다 — 개조 확장용 필드에 값이 든 것처럼 사람이 봐야 하지만
  // 게임을 실행할 수는 있는 문제다(FR-07의 `forbiddenFor`).
  if (warnings.length > 0) {
    console.warn(`경고 ${warnings.length}건 (${dataDir}/)\n`);
    console.warn(formatIssues(warnings));
    console.warn("");
  }

  if (errors.length > 0) {
    console.error(`데이터 검증 실패 — 문제 ${errors.length}건 (${dataDir}/)\n`);
    console.error(formatIssues(errors));
    process.exit(1);
  }

  const stageCount = data?.stages.length ?? 0;
  const classCount = data?.classes.length ?? 0;
  const officerCount = data?.officers.length ?? 0;
  const terrainCount = data?.terrain.length ?? 0;
  const tacticCount = data?.tactics.length ?? 0;
  const itemCount = data?.items.length ?? 0;
  console.log(
    `데이터 검증 통과 (${dataDir}/) — 병과 ${classCount}, 책략 ${tacticCount}, 아이템 ${itemCount}, 무장 ${officerCount}, 지형 ${terrainCount}, 스테이지 ${stageCount}`,
  );
} catch (error) {
  if (error instanceof DataReadError) {
    console.error(`데이터 검증 실패\n  ${error.message}`);
    process.exit(1);
  }
  throw error;
}
