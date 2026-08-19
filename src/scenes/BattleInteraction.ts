import { applyCommand, attackableTiles, inAttackRange } from "../core/battle/commands";
import { damageRange } from "../core/battle/damage";
import type { BattleEvent } from "../core/battle/events";
import { carriedItem, itemRejection } from "../core/battle/items";
import { reachableTiles } from "../core/battle/movement";
import { classOf, posKey, type BattleContext, type BattleState, type Unit } from "../core/battle/state";
import { tacticRejection } from "../core/battle/tactics";
import type { Item, Pos, Tactic } from "../core/data/schemas";
import type { Rng } from "../core/rng";

/**
 * 전투 입력 상태 기계(DES-06 → FR-18, [상세 스펙 §1.1, §8.1]).
 *
 * idle(부대 선택) → moving(이동) → acting(공격·대기) → targeting(대상 선택).
 * 마우스·키보드 어느 쪽으로 조작하든 여기로 모인다 — 입력 장치마다 규칙을 다시 적으면
 * "마우스로는 되는데 키보드로는 안 되는" 차이가 생긴다.
 *
 * 규칙 판정과 상태 변경은 전부 코어의 커맨드 계층에 맡기고, 이 모듈은 "지금 무엇을 고를 수 있는가"만 정한다.
 * 그래서 PixiJS·DOM을 알지 못하며(NFR-02) 화면 없이 테스트할 수 있다.
 */

export type InteractionMode = "idle" | "moving" | "acting" | "targeting";

/** 행동 메뉴가 낼 수 있는 항목. 책략·아이템은 무엇을 쓸지까지 골라야 대상 지정으로 넘어간다. */
export type MenuAction = "attack" | "tactic" | "item" | "investigate" | "wait";

/** 대상 지정 중인 행동. 어느 칸을 눌렀을 때 무엇을 할지 이 값이 정한다. */
type Pending =
  | { kind: "attack" }
  | { kind: "tactic"; tactic: Tactic }
  | { kind: "item"; item: Item };

/** 메뉴 한 줄 — 쓸 수 없으면 이유가 붙는다. 화면은 이 이유를 그대로 보여 준다. */
export interface Choice<T> {
  value: T;
  name: string;
  /** 쓸 수 없는 이유. 쓸 수 있으면 `null`. */
  reason: string | null;
}

export interface BattleInteraction {
  readonly mode: InteractionMode;
  /** 지금 조작 중인 부대. 없으면 `undefined`. */
  readonly selected: Unit | undefined;
  /** 하이라이트할 이동 범위(이동 모드에서만). */
  moveTiles(): Pos[];
  /** 하이라이트할 공격 범위(행동·대상 선택 모드에서만). */
  attackTiles(): Pos[];
  /** 지금 칠 수 있는 적. */
  targets(): Unit[];
  /** 예상 데미지 `[최소, 최대]`. 칠 수 없는 대상이면 `undefined`. */
  forecast(target: Unit): [number, number] | undefined;
  /** 지금 고를 수 있는 행동 메뉴. 쓸 수 없는 항목도 이유와 함께 들어온다. */
  menu(): Choice<MenuAction>[];
  /** 선택한 부대가 배우는 책략과 각각의 사용 가능 여부([상세 스펙 §1.5]). */
  tactics(): Choice<Tactic>[];
  /** 선택한 부대의 소지품과 각각의 사용 가능 여부([상세 스펙 §1.6]). */
  items(): Choice<Item>[];
  /** 책략·아이템 대상 지정 중 고를 수 있는 칸. */
  targetTiles(): Pos[];
  /** 그 칸에 선 부대. */
  unitAt(pos: Pos): Unit | undefined;
  /** 칸을 결정한다(좌클릭·Z·Enter). 일어난 일을 돌려주며, 고를 수 없는 칸이면 아무 일도 하지 않는다. */
  confirm(pos: Pos): BattleEvent[];
  /** 행동을 고른다(메뉴). 고를 수 없는 행동이면 아무 일도 하지 않는다. */
  choose(action: MenuAction): BattleEvent[];
  /** 쓸 책략을 고른다. 대상 지정으로 넘어간다. */
  chooseTactic(tacticId: string): BattleEvent[];
  /** 쓸 아이템을 고른다. 대상이 필요한 소모품이면 대상 지정으로, 아니면 그 자리에서 쓴다. */
  chooseItem(itemId: string): BattleEvent[];
  /** 취소한다(우클릭·X·ESC). 행동 메뉴에서 취소하면 이동을 되돌린다. */
  cancel(): void;
}

const samePos = ([ax, ay]: Pos, [bx, by]: Pos): boolean => ax === bx && ay === by;

export function createInteraction(
  ctx: BattleContext,
  state: BattleState,
  rng: Rng,
): BattleInteraction {
  let mode: InteractionMode = "idle";
  let officerId: string | null = null;
  /** 대상 지정 중인 행동. `targeting` 모드에서만 값이 있다. */
  let pending: Pending = { kind: "attack" };
  /** 이동 전 좌표. 행동을 확정하기 전까지 여기로 되돌릴 수 있다([상세 스펙 §1.1]). */
  let origin: Pos = [0, 0];

  const selected = (): Unit | undefined =>
    officerId === null
      ? undefined
      : state.units.find((unit) => unit.officerId === officerId);

  const unitAt = (pos: Pos): Unit | undefined =>
    state.units.find((unit) => samePos(unit.pos, pos));

  const reset = (): void => {
    mode = "idle";
    officerId = null;
    pending = { kind: "attack" };
  };

  /** 이 부대가 배우는 책략과 지금 쓸 수 있는지. 판정은 코어의 `tacticRejection`이 한다. */
  const tacticChoices = (): Choice<Tactic>[] => {
    const unit = selected();
    if (!unit) return [];

    return classOf(ctx, unit)
      .tactics.map((id) => ctx.data.tactics.find((tactic) => tactic.id === id))
      .filter((tactic): tactic is Tactic => !!tactic)
      .map((tactic) => ({
        value: tactic,
        name: tactic.name,
        // 대상을 아직 고르지 않았으므로 자기 자리를 넣어 병과·책략치만 본다.
        reason: tacticRejection(ctx, state, unit, tactic, unit.pos),
      }));
  };

  /** 소지품과 지금 쓸 수 있는지. 장비·자연 회복은 "쓰는" 아이템이 아니라 이유가 붙는다. */
  const itemChoices = (): Choice<Item>[] => {
    const unit = selected();
    if (!unit) return [];

    return unit.items
      .map((id) => carriedItem(ctx, unit, id))
      .filter((item): item is Item => !!item)
      .map((item) => ({
        value: item,
        name: item.name,
        reason: itemRejection(ctx, state, unit, item, unit.pos),
      }));
  };

  /** 선 자리에 아직 가져가지 않은 보물이 있는가([상세 스펙 §1.7]). */
  const canInvestigate = (): boolean => {
    const unit = selected();
    if (!unit) return false;

    const here = posKey(unit.pos);
    return (
      ctx.stage.treasures.some((treasure) => posKey(treasure.pos) === here) &&
      !state.treasuresTaken.includes(here)
    );
  };

  const targets = (): Unit[] => {
    const unit = selected();
    if (!unit || mode === "idle" || mode === "moving") return [];

    return state.units.filter(
      (other) => other.side !== unit.side && inAttackRange(ctx, unit, other),
    );
  };

  const select = (pos: Pos): void => {
    const unit = unitAt(pos);
    // 남의 차례의 부대, 이미 행동을 마친 부대, 혼란에 빠진 부대는 조작 대상이 아니다 —
    // 커맨드 계층이 거부할 선택을 애초에 만들지 않는다([상세 스펙 §1.4]).
    if (!unit || unit.side !== state.phase || unit.acted || unit.confused) return;

    mode = "moving";
    officerId = unit.officerId;
    origin = unit.pos;
  };

  const move = (unit: Unit, pos: Pos): BattleEvent[] => {
    if (!reachableTiles(ctx, state, unit).some((tile) => samePos(tile, pos))) return [];

    const events = applyCommand(ctx, state, { type: "move", officerId: unit.officerId, to: pos }, rng);
    mode = "acting";
    return events;
  };

  const attack = (unit: Unit, pos: Pos): BattleEvent[] => {
    const target = targets().find((candidate) => samePos(candidate.pos, pos));
    if (!target) return [];

    const events = applyCommand(
      ctx,
      state,
      { type: "attack", officerId: unit.officerId, targetId: target.officerId },
      rng,
    );
    reset();
    return events;
  };

  /** 대상 지정 중 고른 칸을 지금 대기 중인 행동으로 처리한다. */
  const resolveTarget = (unit: Unit, pos: Pos): BattleEvent[] => {
    if (pending.kind === "attack") return attack(unit, pos);

    const cmd =
      pending.kind === "tactic"
        ? ({ type: "useTactic", officerId: unit.officerId, tacticId: pending.tactic.id, to: pos } as const)
        : ({ type: "useItem", officerId: unit.officerId, itemId: pending.item.id, to: pos } as const);

    // 고를 수 없는 칸은 아무 일도 하지 않는다 — 판정은 커맨드 계층과 같은 함수가 이미 했다.
    if (!targetTiles().some((tile) => samePos(tile, pos))) return [];

    const events = applyCommand(ctx, state, cmd, rng);
    reset();
    return events;
  };

  /** 대기 중인 행동이 지금 겨눌 수 있는 칸. */
  const targetTiles = (): Pos[] => {
    const unit = selected();
    const action = pending;
    if (!unit || mode !== "targeting") return [];
    if (action.kind === "attack") return targets().map((target) => target.pos);

    const tiles: Pos[] = [];
    for (let y = 0; y < ctx.stage.map.height; y += 1) {
      for (let x = 0; x < ctx.stage.map.width; x += 1) {
        const at: Pos = [x, y];
        // 화면이 고를 수 있는 칸과 커맨드가 받아들이는 칸이 갈라지지 않게 같은 판정을 쓴다.
        const rejection =
          action.kind === "tactic"
            ? tacticRejection(ctx, state, unit, action.tactic, at)
            : itemRejection(ctx, state, unit, action.item, at);
        if (!rejection) tiles.push(at);
      }
    }
    return tiles;
  };

  return {
    get mode() {
      return mode;
    },
    get selected() {
      return selected();
    },

    moveTiles: () => {
      const unit = selected();
      return unit && mode === "moving" ? reachableTiles(ctx, state, unit) : [];
    },

    attackTiles: () => {
      const unit = selected();
      return unit && (mode === "acting" || mode === "targeting")
        ? attackableTiles(ctx, unit)
        : [];
    },

    targets,

    forecast: (target) => {
      const unit = selected();
      // 지금 고를 수 있는 대상에만 값을 낸다 — 칠 수 없는 부대에 예상 데미지가 뜨면 눌러도 아무 일이 없는 화면이 된다.
      if (!unit || !targets().includes(target)) return undefined;
      // 실제 공격과 같은 공식을 쓰되 난수는 소비하지 않는다 — 값을 띄우는 것만으로 수열이 밀리면 결정론이 깨진다(NFR-01).
      return damageRange(ctx, unit, target);
    },

    unitAt,

    confirm: (pos) => {
      const unit = selected();

      switch (mode) {
        case "idle":
          select(pos);
          return [];
        case "moving":
          return unit ? move(unit, pos) : [];
        case "targeting":
          return unit ? resolveTarget(unit, pos) : [];
        // 행동 메뉴가 열려 있는 동안 지도를 눌러도 무시한다 — 메뉴 밖 클릭이 이동을 확정해 버리면 취소할 기회가 사라진다.
        case "acting":
          return [];
      }
    },

    menu: () => {
      const unit = selected();
      if (!unit || mode !== "acting") return [];

      const usable = <T,>(choices: Choice<T>[]): boolean => choices.some((c) => c.reason === null);
      return [
        {
          value: "attack",
          name: "공격",
          reason: targets().length > 0 ? null : "사거리 안에 적이 없다",
        },
        {
          value: "tactic",
          name: "책략",
          reason: usable(tacticChoices()) ? null : "지금 쓸 수 있는 책략이 없다",
        },
        {
          value: "item",
          name: "아이템",
          reason: usable(itemChoices()) ? null : "지금 쓸 수 있는 아이템이 없다",
        },
        {
          value: "investigate",
          name: "조사",
          reason: canInvestigate() ? null : "여기에는 조사할 것이 없다",
        },
        { value: "wait", name: "대기", reason: null },
      ];
    },

    tactics: tacticChoices,
    items: itemChoices,
    targetTiles,

    choose: (action) => {
      const unit = selected();
      if (!unit || mode !== "acting") return [];

      if (action === "wait") {
        const events = applyCommand(ctx, state, { type: "wait", officerId: unit.officerId }, rng);
        reset();
        return events;
      }

      if (action === "investigate") {
        if (!canInvestigate()) return [];

        const events = applyCommand(ctx, state, { type: "investigate", officerId: unit.officerId }, rng);
        reset();
        return events;
      }

      // 책략·아이템은 무엇을 쓸지 한 번 더 골라야 한다 — 목록은 화면이 `tactics()`·`items()`로 읽는다.
      if (action === "tactic" || action === "item") return [];

      // 칠 수 있는 적이 없으면 대상 선택으로 들어가지 않는다 — 들어가면 취소 말고는 나올 길이 없다.
      if (targets().length > 0) {
        pending = { kind: "attack" };
        mode = "targeting";
      }
      return [];
    },

    chooseTactic: (tacticId) => {
      const unit = selected();
      if (!unit || mode !== "acting") return [];

      const choice = tacticChoices().find((candidate) => candidate.value.id === tacticId);
      if (!choice || choice.reason !== null) return [];

      pending = { kind: "tactic", tactic: choice.value };
      mode = "targeting";
      return [];
    },

    chooseItem: (itemId) => {
      const unit = selected();
      if (!unit || mode !== "acting") return [];

      const choice = itemChoices().find((candidate) => candidate.value.id === itemId);
      if (!choice || choice.reason !== null) return [];

      // 소모품만 대상이 필요하다. 승급·전환서는 그 자리에서 끝난다([상세 스펙 §1.6]).
      if (choice.value.type !== "consumable") {
        const events = applyCommand(
          ctx,
          state,
          { type: "useItem", officerId: unit.officerId, itemId },
          rng,
        );
        reset();
        return events;
      }

      pending = { kind: "item", item: choice.value };
      mode = "targeting";
      return [];
    },

    cancel: () => {
      const unit = selected();

      switch (mode) {
        case "acting": {
          // 이동 확정 전 취소 — 되돌린 상태도 저장 가능한 일관 상태다(M3).
          if (unit) {
            unit.pos = origin;
            unit.moved = false;
          }
          reset();
          return;
        }
        case "targeting":
          pending = { kind: "attack" };
          mode = "acting";
          return;
        case "moving":
          reset();
          return;
        case "idle":
          return;
      }
    },
  };
}
