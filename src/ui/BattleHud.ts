import type { Side } from "../core/battle/state";
import type { Outcome } from "../core/battle/turn";
import type { Stage } from "../core/data/schemas";

/**
 * 전투 HUD(DES-06 → FR-18). PixiJS 캔버스 위에 얹는 DOM 오버레이다.
 *
 * 이 모듈은 게임 데이터를 알지 못한다 — 무장·병과 이름처럼 데이터에서 읽어야 하는 값(FR-13)은
 * 씬이 조회해 문자열로 넘긴다. HUD가 데이터 조회를 겸하면 표시할 것이 늘 때마다 데이터 접근이 화면 곳곳으로 번진다.
 * Zustand 스토어는 화면이 전투 하나뿐인 M1에서는 도입하지 않는다([전체 설계 §6.2], M3에서 도입).
 */

export type MenuAction = "attack" | "wait";

export interface MenuItem {
  action: MenuAction;
  label: string;
  /** 고를 수 없는 항목도 감추지 않고 흐리게 남긴다 — 사라지면 왜 못 하는지 알 수 없다. */
  enabled: boolean;
}

export interface HudView {
  turn: number;
  phase: Side;
  weather: Stage["weather"];
  /** 커서 아래 부대. 없으면 정보창을 비운다. */
  unit: {
    officerName: string;
    className: string;
    side: Side;
    hp: number;
    hpMax: number;
    morale: number;
  } | null;
  /** 행동 메뉴. `null`이면 감춘다. */
  menu: { items: MenuItem[]; index: number } | null;
  /** 예상 데미지([최소, 최대])와 대상 이름. 대상 선택 중에만 채운다. */
  forecast: { targetName: string; min: number; max: number } | null;
  outcome: Outcome | null;
  /** 적 페이즈처럼 입력을 받지 않는 동안 참. */
  busy: boolean;
}

export interface BattleHud {
  render(view: HudView): void;
}

/** 날씨는 데이터 파일이 아니라 스키마의 열거값이므로(코드가 정본) 표시 이름만 여기서 붙인다. */
const WEATHER_LABEL: Record<Stage["weather"], string> = { clear: "맑음", rain: "비" };
const SIDE_LABEL: Record<Side, string> = { player: "아군", enemy: "적군" };
const OUTCOME_LABEL: Record<Outcome, string> = { victory: "승리", defeat: "패배" };

function element(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

export function createBattleHud(
  parent: HTMLElement,
  onChoose: (action: MenuAction) => void,
): BattleHud {
  const root = element("div", "hud", parent);
  const status = element("div", "hud-status", root);
  const info = element("div", "hud-info", root);
  const forecast = element("div", "hud-forecast", root);
  const menu = element("div", "hud-menu", root);
  const result = element("div", "hud-result", root);
  element("div", "hud-help", root).textContent =
    "좌클릭·Z 결정 / 우클릭·X 취소 / 방향키 커서";

  // 버튼은 메뉴가 열릴 때마다 새로 만들지 않고 한 번 만들어 두고 감춘다 — 클릭 핸들러가 쌓이지 않는다.
  const buttons = new Map<MenuAction, HTMLButtonElement>();
  for (const action of ["attack", "wait"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hud-menu-item";
    button.addEventListener("click", () => onChoose(action));
    menu.appendChild(button);
    buttons.set(action, button);
  }

  return {
    render(view) {
      status.textContent = `${view.turn}턴 · ${SIDE_LABEL[view.phase]} 페이즈 · 날씨 ${WEATHER_LABEL[view.weather]}`;

      info.textContent = view.unit
        ? `${view.unit.officerName} (${view.unit.className}) · 병력 ${view.unit.hp}/${view.unit.hpMax} · 사기 ${view.unit.morale}`
        : "";
      info.dataset["side"] = view.unit?.side ?? "";

      forecast.textContent = view.forecast
        ? `${view.forecast.targetName}에게 예상 데미지 ${view.forecast.min}~${view.forecast.max}`
        : "";

      menu.hidden = view.menu === null;
      for (const [action, button] of buttons) {
        const item = view.menu?.items.find((candidate) => candidate.action === action);
        button.hidden = !item;
        if (!item) continue;

        button.textContent = item.label;
        button.disabled = !item.enabled;
        // 키보드 커서 위치를 화면에도 드러낸다 — 마우스와 키보드가 같은 메뉴를 가리켜야 한다.
        button.classList.toggle(
          "is-cursor",
          view.menu?.items.indexOf(item) === view.menu?.index,
        );
      }

      result.textContent = view.outcome ? OUTCOME_LABEL[view.outcome] : "";
      result.hidden = view.outcome === null;
      root.dataset["busy"] = String(view.busy);
    },
  };
}
