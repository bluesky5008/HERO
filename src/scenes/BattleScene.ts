import { Container, Graphics, type Application, type FederatedPointerEvent } from "pixi.js";
import { classOf, createBattleState, officerOf, type BattleContext } from "../core/battle/state";
import { endPhase, isPhaseComplete, outcome, type Outcome } from "../core/battle/turn";
import { runAiPhase } from "../core/battle/ai";
import type { GameData } from "../core/data/loader";
import type { Pos, Stage, StageUnit } from "../core/data/schemas";
import { createRng } from "../core/rng";
import { drawHighlights } from "../render/HighlightRenderer";
import { createTilemapLayer } from "../render/TilemapRenderer";
import { drawUnits } from "../render/UnitRenderer";
import { createBattleHud, type MenuItem } from "../ui/BattleHud";
import { createInteraction } from "./BattleInteraction";

/**
 * 전투 화면(DES-06 → FR-18, [AC-02]).
 * 입력 → 상태 기계([BattleInteraction](./BattleInteraction.ts)) → 코어 커맨드 → 다시 그리기의 한 방향 흐름만 만든다.
 * 규칙 판정은 전부 코어에 있고, 이 파일은 무엇을 언제 그리고 언제 적에게 차례를 넘길지만 정한다.
 */

/**
 * 적 페이즈를 바로 처리하면 플레이어가 무엇이 일어났는지 볼 틈이 없다.
 * 부대별 연출은 M2 범위이므로, 지금은 페이즈 전환을 눈으로 좇을 만큼만 쉰다.
 */
const ENEMY_PHASE_DELAY_MS = 450;

/**
 * M1에는 캠페인이 없어 전투 시드를 공급할 곳이 없다([ADR-003]의 캠페인 시드+스테이지 ID+진입 횟수).
 * 고정 시드를 쓰면 같은 조작이 언제나 같은 전투가 되어 프로토타입을 재현할 수 있다. M3에서 캠페인이 이 자리를 대신한다.
 */
const BATTLE_SEED = 20260817;

export interface BattleSceneOptions {
  app: Application;
  data: GameData;
  stage: Stage;
  /** HUD를 얹을 DOM 요소. 캔버스와 같은 크기·위치여야 한다. */
  hudParent: HTMLElement;
}

export function startBattleScene({ app, data, stage, hudParent }: BattleSceneOptions): void {
  const ctx: BattleContext = { data, stage };
  const state = createBattleState(data, stage, deployRoster(stage));
  const rng = createRng(BATTLE_SEED);
  const ui = createInteraction(ctx, state, rng);

  const size = data.config.tileSize;
  const battlefield = new Container();
  battlefield.x = Math.round((data.config.logicalWidth - stage.map.width * size) / 2);
  battlefield.y = Math.round((data.config.logicalHeight - stage.map.height * size) / 2);

  const highlights = new Graphics();
  const units = new Container();
  battlefield.addChild(createTilemapLayer(stage, data.terrain, data.config), highlights, units);
  app.stage.addChild(battlefield);

  const hud = createBattleHud(hudParent, (action) => {
    if (locked()) return;
    ui.choose(action);
    afterCommand();
  });

  let cursor: Pos = state.units.find((unit) => unit.side === "player")?.pos ?? [0, 0];
  let menuIndex = 0;
  let busy = false;
  let result: Outcome | null = null;

  /** 승패가 갈렸거나 적이 움직이는 동안에는 입력을 받지 않는다. */
  const locked = (): boolean => busy || result !== null;

  function menu(): { items: MenuItem[]; index: number } | null {
    if (ui.mode !== "acting") return null;

    return {
      items: [
        { action: "attack", label: "공격", enabled: ui.targets().length > 0 },
        { action: "wait", label: "대기", enabled: true },
      ],
      index: menuIndex,
    };
  }

  function render(): void {
    drawUnits(units, ctx, state);
    drawHighlights(highlights, data.config, ui.moveTiles(), ui.attackTiles(), cursor);

    const hovered = ui.unitAt(cursor) ?? ui.selected;
    const target = ui.mode === "targeting" ? ui.unitAt(cursor) : undefined;
    const forecast = target && ui.forecast(target);

    hud.render({
      turn: state.turn,
      phase: state.phase,
      weather: state.weather,
      // 무장·병과 이름은 반드시 데이터에서 읽는다(FR-13) — 화면 문자열을 코드에 박으면 데이터 교체가 화면에 반영되지 않는다.
      unit: hovered
        ? {
            officerName: officerOf(ctx, hovered).name,
            className: classOf(ctx, hovered).name,
            side: hovered.side,
            hp: hovered.hp,
            hpMax: hovered.hpMax,
            morale: hovered.morale,
          }
        : null,
      menu: menu(),
      forecast:
        target && forecast
          ? { targetName: officerOf(ctx, target).name, min: forecast[0], max: forecast[1] }
          : null,
      outcome: result,
      busy,
    });
  }

  /** 커맨드가 하나 적용될 때마다 승패와 페이즈 종료를 확인한다. */
  function afterCommand(): void {
    menuIndex = 0;
    result = outcome(ctx, state);

    if (!result && isPhaseComplete(state)) {
      runEnemyPhase();
      return;
    }
    render();
  }

  function runEnemyPhase(): void {
    endPhase(state);
    busy = true;
    render();

    window.setTimeout(() => {
      runAiPhase(ctx, state, rng);
      result = outcome(ctx, state);
      if (!result) endPhase(state);

      busy = false;
      render();
    }, ENEMY_PHASE_DELAY_MS);
  }

  function tileAt(event: FederatedPointerEvent): Pos | null {
    const local = battlefield.toLocal(event.global);
    const pos: Pos = [Math.floor(local.x / size), Math.floor(local.y / size)];

    const inside =
      pos[0] >= 0 && pos[1] >= 0 && pos[0] < stage.map.width && pos[1] < stage.map.height;
    return inside ? pos : null;
  }

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  app.stage.on("pointermove", (event: FederatedPointerEvent) => {
    const pos = tileAt(event);
    if (!pos || (pos[0] === cursor[0] && pos[1] === cursor[1])) return;

    cursor = pos;
    render();
  });

  app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
    if (locked()) return;

    // 오른쪽 버튼은 취소다. 브라우저 메뉴는 캔버스 위에서만 막는다(문서 전체를 막으면 개발 중 불편하다).
    if (event.button === 2) {
      ui.cancel();
      render();
      return;
    }

    const pos = tileAt(event);
    if (!pos) return;

    cursor = pos;
    ui.confirm(pos);
    afterCommand();
  });

  app.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    if (locked()) return;
    if (handleKey(event.key)) event.preventDefault();
  });

  /** [상세 스펙 §8.1]에서 M1이 쓰는 키만 구현한다. 수동 턴 종료는 두지 않는다 — 모두 행동하면 페이즈가 저절로 끝난다. */
  function handleKey(key: string): boolean {
    const step: Record<string, Pos> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };

    const moved = step[key];
    if (moved) {
      // 행동 메뉴가 열려 있으면 방향키는 메뉴를 고른다 — 커서를 움직이면 확정 직전의 자리를 잃는다.
      const items = menu()?.items;
      if (items) {
        menuIndex = (menuIndex + (moved[1] || moved[0]) + items.length) % items.length;
      } else {
        cursor = [
          Math.min(Math.max(cursor[0] + moved[0], 0), stage.map.width - 1),
          Math.min(Math.max(cursor[1] + moved[1], 0), stage.map.height - 1),
        ];
      }
      render();
      return true;
    }

    if (key === "z" || key === "Z" || key === "Enter") {
      const item = menu()?.items[menuIndex];
      if (item) {
        if (item.enabled) ui.choose(item.action);
      } else {
        ui.confirm(cursor);
      }
      afterCommand();
      return true;
    }

    if (key === "x" || key === "X" || key === "Escape") {
      ui.cancel();
      menuIndex = 0;
      render();
      return true;
    }

    return false;
  }

  render();
  console.info(
    `${stage.name} — 부대 ${state.units.length}개(아군 ${state.units.filter((unit) => unit.side === "player").length})로 전투 시작`,
  );
}

/**
 * 출진 명단을 배치 구역 앞에서부터 채운다.
 * M1에는 편성·배치 화면이 없어(M3 범위) 스테이지 데이터가 정한 명단을 그대로 세운다.
 */
function deployRoster(stage: Stage): StageUnit[] {
  const party: StageUnit[] = [];

  for (const entry of stage.deployment.roster ?? []) {
    const pos = stage.deployment.zone[party.length];
    if (!pos || party.length >= stage.deployment.maxUnits) break;
    party.push({ ...entry, pos });
  }
  return party;
}
