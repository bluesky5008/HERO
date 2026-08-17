import type { Graphics } from "pixi.js";
import type { GameConfig, Pos } from "../core/data/schemas";

/**
 * 이동 범위(청)·공격 범위(적) 하이라이트와 커서.
 * 커서를 움직일 때마다 다시 그리므로 자식을 새로 만들지 않고 한 장에 `clear()` 후 덧그린다.
 * 커서를 같은 레이어에 두는 이유도 같다 — 갱신 주기가 같은 그림을 두 장으로 나누면 지우기·그리기가 두 벌이 된다.
 */

const MOVE_COLOR = 0x4fc3f7;
const ATTACK_COLOR = 0xef5350;
/** 공격 범위가 이동 범위 위에 겹쳐도 색이 묻히지 않도록 더 진하게 덮는다. */
const MOVE_ALPHA = 0.3;
const ATTACK_ALPHA = 0.45;
const CURSOR_COLOR = 0xffffff;

export function drawHighlights(
  view: Graphics,
  config: GameConfig,
  move: readonly Pos[],
  attack: readonly Pos[],
  cursor: Pos | null = null,
): void {
  const size = config.tileSize;
  view.clear();

  // 이동 범위를 먼저 깔고 공격 범위를 위에 올린다 — 겹치는 칸에서는 "칠 수 있다"가 더 급한 정보다.
  for (const [color, alpha, tiles] of [
    [MOVE_COLOR, MOVE_ALPHA, move],
    [ATTACK_COLOR, ATTACK_ALPHA, attack],
  ] as const) {
    if (tiles.length === 0) continue;

    for (const [x, y] of tiles) view.rect(x * size, y * size, size, size);
    view.fill({ color, alpha });
  }

  // 커서는 칸을 칠하지 않고 테두리만 그린다 — 아래 깔린 범위 색을 가리면 "여기가 어떤 칸인지"가 사라진다.
  if (cursor) {
    view
      .rect(cursor[0] * size + 1, cursor[1] * size + 1, size - 2, size - 2)
      .stroke({ width: 2, color: CURSOR_COLOR, alpha: 0.9 });
  }
}
