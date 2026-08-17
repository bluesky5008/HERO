import { applyCommand, attackableTiles, inAttackRange } from "../core/battle/commands";
import { damageRange } from "../core/battle/damage";
import type { BattleEvent } from "../core/battle/events";
import { reachableTiles } from "../core/battle/movement";
import type { BattleContext, BattleState, Unit } from "../core/battle/state";
import type { Pos } from "../core/data/schemas";
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
  /** 그 칸에 선 부대. */
  unitAt(pos: Pos): Unit | undefined;
  /** 칸을 결정한다(좌클릭·Z·Enter). 일어난 일을 돌려주며, 고를 수 없는 칸이면 아무 일도 하지 않는다. */
  confirm(pos: Pos): BattleEvent[];
  /** 행동을 고른다(메뉴). 고를 수 없는 행동이면 아무 일도 하지 않는다. */
  choose(action: "attack" | "wait"): BattleEvent[];
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
    // 남의 차례의 부대와 이미 행동을 마친 부대는 조작 대상이 아니다 — 커맨드 계층이 거부할 선택을 애초에 만들지 않는다.
    if (!unit || unit.side !== state.phase || unit.acted) return;

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
          return unit ? attack(unit, pos) : [];
        // 행동 메뉴가 열려 있는 동안 지도를 눌러도 무시한다 — 메뉴 밖 클릭이 이동을 확정해 버리면 취소할 기회가 사라진다.
        case "acting":
          return [];
      }
    },

    choose: (action) => {
      const unit = selected();
      if (!unit || mode !== "acting") return [];

      if (action === "wait") {
        const events = applyCommand(ctx, state, { type: "wait", officerId: unit.officerId }, rng);
        reset();
        return events;
      }

      // 칠 수 있는 적이 없으면 대상 선택으로 들어가지 않는다 — 들어가면 취소 말고는 나올 길이 없다.
      if (targets().length > 0) mode = "targeting";
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
