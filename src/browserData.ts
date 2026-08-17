import type { RawGameData } from "./core/data/loader";
import affinity from "../data/affinity.json";
import animations from "../data/assets-map/animations.json";
import classes from "../data/classes.json";
import combatConfig from "../data/config/combat-config.json";
import config from "../data/config/game-config.json";
import officers from "../data/officers.json";
import sprites from "../data/assets-map/sprites.json";
import terrain from "../data/terrain.json";

/**
 * 브라우저용 데이터 공급.
 * Vite가 data/ 를 번들에 포함하므로 개발 중 JSON을 고치면 그대로 다시 반영된다.
 * (패키징 후 디스크에서 읽어 개조하는 경로는 M6에서 SaveStore·AssetStore와 함께 다룬다.)
 */

const stageModules = import.meta.glob("../data/scenario/stages/*.json", {
  eager: true,
  import: "default",
});

export function readBrowserGameData(): RawGameData {
  const stages: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(stageModules)) {
    stages[path.split("/").pop() ?? path] = value;
  }

  return { config, combatConfig, terrain, classes, officers, affinity, sprites, animations, stages };
}
