import { Container, Graphics, Text } from "pixi.js";
import type { BattleContext, BattleState, Unit } from "../core/battle/state";

/**
 * 부대 레이어. 스프라이트 시트가 아직 없으므로 sprites.json의 `placeholderColor`와
 * 병과명으로 그린다(플레이스홀더 우선 전략 — [전체 설계 §5]의 스프라이트 계약).
 */

/** 스프라이트·병과 매핑이 없어도 앱을 죽이지 않고 눈에 띄게 드러낸다(NFR-03, VER-08). */
const UNKNOWN_COLOR = "#ff00ff";
const UNKNOWN_NAME = "?";

/** 진영은 테두리 색으로 구분한다 — 플레이스홀더 색은 병과가 이미 쓰고 있다. */
const SIDE_COLOR: Record<Unit["side"], number> = { player: 0x4fc3f7, enemy: 0xef5350 };

const HP_COLOR = 0x66bb6a;
const HP_BACKGROUND = 0x1a1a1a;
/** 행동을 마친 부대는 흐리게 — 누구를 아직 움직일 수 있는지 한눈에 보여야 한다. */
const ACTED_ALPHA = 0.45;

function drawUnit(ctx: BattleContext, unit: Unit, size: number): Container {
  const cls = ctx.data.classes.find((candidate) => candidate.id === unit.classId);
  const sprite = cls ? ctx.data.sprites[cls.sprite] : undefined;

  const inset = Math.round(size * 0.14);
  const inner = size - inset * 2;
  const barHeight = Math.max(2, Math.round(size * 0.09));

  const body = new Graphics()
    .rect(inset, inset, inner, inner)
    .fill(sprite?.placeholderColor ?? UNKNOWN_COLOR)
    .stroke({ width: 2, color: SIDE_COLOR[unit.side] });

  const label = new Text({
    text: cls?.name ?? UNKNOWN_NAME,
    style: {
      fontFamily: '"Malgun Gothic", system-ui, sans-serif',
      fontSize: Math.round(size * 0.3),
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
    },
  });
  label.anchor.set(0.5);
  label.position.set(size / 2, size / 2 - barHeight / 2);

  const hp = new Graphics()
    .rect(inset, size - inset - barHeight, inner, barHeight)
    .fill(HP_BACKGROUND)
    .rect(inset, size - inset - barHeight, inner * (unit.hp / unit.hpMax), barHeight)
    .fill(HP_COLOR);

  const view = new Container();
  view.addChild(body, label, hp);
  view.position.set(unit.pos[0] * size, unit.pos[1] * size);
  view.alpha = unit.acted ? ACTED_ALPHA : 1;
  return view;
}

/** 부대 레이어를 현재 상태로 다시 그린다. 부대 수가 한 자리라 통째로 새로 그리는 편이 짧다. */
export function drawUnits(layer: Container, ctx: BattleContext, state: BattleState): void {
  for (const child of layer.removeChildren()) child.destroy({ children: true });

  for (const unit of state.units) {
    layer.addChild(drawUnit(ctx, unit, ctx.data.config.tileSize));
  }
}
