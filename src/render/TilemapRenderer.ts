import { Container, Graphics } from "pixi.js";
import type { GameConfig, Stage, Terrain } from "../core/data/schemas";

/**
 * 지형 레이어. 타일 그래픽이 아직 없으므로 terrain.json의 placeholderColor로 그린다
 * (플레이스홀더 우선 전략 — 시트가 준비되면 이 레이어만 교체한다).
 */

/** 정의되지 않은 지형은 숨기지 않고 눈에 띄게 드러낸다 — 조용히 비워두면 개조 중 놓친다. */
const UNKNOWN_TERRAIN_COLOR = "#ff00ff";

const GRID_COLOR = 0x000000;
const GRID_ALPHA = 0.18;

export function createTilemapLayer(
  stage: Stage,
  terrain: Terrain[],
  config: GameConfig,
): Container {
  const colorById = new Map(terrain.map((t) => [t.id, t.placeholderColor]));
  const size = config.tileSize;

  // 타일 하나당 Graphics를 만들지 않고 한 번에 그린다 — 원작 맵은 40×40까지 커진다.
  const tiles = new Graphics();
  stage.map.tiles.forEach((row, y) => {
    row.forEach((terrainId, x) => {
      tiles
        .rect(x * size, y * size, size, size)
        .fill(colorById.get(terrainId) ?? UNKNOWN_TERRAIN_COLOR);
    });
  });

  const grid = new Graphics();
  for (let x = 0; x <= stage.map.width; x += 1) {
    grid.moveTo(x * size, 0).lineTo(x * size, stage.map.height * size);
  }
  for (let y = 0; y <= stage.map.height; y += 1) {
    grid.moveTo(0, y * size).lineTo(stage.map.width * size, y * size);
  }
  grid.stroke({ width: 1, color: GRID_COLOR, alpha: GRID_ALPHA });

  const layer = new Container();
  layer.addChild(tiles, grid);
  return layer;
}
