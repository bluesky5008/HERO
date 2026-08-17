import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawGameData } from "../src/core/data/loader";

/**
 * Node에서 data/ 폴더를 읽어 검증되지 않은 원본 묶음을 만든다.
 * 파일 시스템 접근은 코어 밖에 둔다 — 코어는 브라우저에서도 그대로 돌아야 한다(NFR-02).
 */

export class DataReadError extends Error {}

function readJson(dataDir: string, relativePath: string): unknown {
  const full = join(dataDir, relativePath);
  let text: string;
  try {
    // 윈도우 편집기가 붙이는 BOM은 JSON.parse가 거부한다. 데이터 개조가 전제인
    // 프로젝트라 편집기 선택 때문에 검증이 깨지지 않도록 여기서 걷어낸다.
    text = readFileSync(full, "utf8").replace(/^﻿/, "");
  } catch {
    throw new DataReadError(`데이터 파일을 읽을 수 없다: ${relativePath}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DataReadError(
      `JSON 구문 오류: ${relativePath}\n    ${(error as Error).message}`,
    );
  }
}

export function readGameData(dataDir: string): RawGameData {
  const stagesDir = join(dataDir, "scenario", "stages");
  let stageFiles: string[];
  try {
    stageFiles = readdirSync(stagesDir).filter((name) => name.endsWith(".json"));
  } catch {
    throw new DataReadError(`스테이지 폴더를 읽을 수 없다: scenario/stages`);
  }

  const stages: Record<string, unknown> = {};
  for (const name of stageFiles) {
    stages[name] = readJson(dataDir, join("scenario", "stages", name));
  }

  return {
    config: readJson(dataDir, join("config", "game-config.json")),
    terrain: readJson(dataDir, "terrain.json"),
    classes: readJson(dataDir, "classes.json"),
    affinity: readJson(dataDir, "affinity.json"),
    sprites: readJson(dataDir, join("assets-map", "sprites.json")),
    animations: readJson(dataDir, join("assets-map", "animations.json")),
    stages,
  };
}
