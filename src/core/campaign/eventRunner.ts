import type { EventAction, EventTrigger, Pos, StageEvent, StageUnit } from "../data/schemas";
import type { Rng } from "../rng";
import type { BattleEvent } from "../battle/events";
import { gainExp } from "../battle/experience";
import { changeMorale } from "../battle/morale";
import {
  makeUnit,
  posKey,
  type BattleContext,
  type BattleState,
  type Side,
  type Unit,
} from "../battle/state";

/**
 * 이벤트 스크립트 인터프리터([상세 스펙 §3], DES-02·DES-13 → FR-09, AC-03).
 *
 * M2는 `scope: "battle"`만 실행한다 — `camp` 스코프와 분기·선택지는 캠페인이 생기는 M3이 같은 파일에 붙인다.
 * 평가는 [`runEvents`](#runEvents) 한 번당 한 바퀴로 끝난다. 액션이 상태를 바꿔 다른 이벤트의 조건이
 * 성립하더라도 그 자리에서 다시 돌지 않는다 — 재진입은 발동 순서를 예측할 수 없게 만들고,
 * [상세 스펙 §3.4]가 정한 것은 "커맨드 적용 직후 + 턴 경계에 한 번, 배열 순서대로"이기 때문이다.
 */

/** 이벤트를 재는 시점. `command`는 커맨드 하나가 끝난 직후다([상세 스펙 §3.4]). */
export type EventMoment = "battleStart" | "turnStart" | "turnEnd" | "command";

const unitOf = (state: BattleState, officerId: string): Unit | undefined =>
  state.units.find((unit) => unit.officerId === officerId);

/** 방금 일어난 공격들. `unitAttacks` 트리거가 이 목록을 본다. */
function attacksIn(happened: readonly BattleEvent[]): { attacker: string; target: string }[] {
  return happened.flatMap((event) =>
    event.type === "attacked"
      ? [{ attacker: event.attackerId, target: event.defenderId }]
      : event.type === "countered"
        ? [{ attacker: event.attackerId, target: event.defenderId }]
        : [],
  );
}

/**
 * 방금 격파된 부대와 그것을 쓰러뜨린 부대.
 * `defeated`는 자기를 죽인 공격 바로 뒤에 오므로 앞쪽에서 가장 가까운 공격이 가해자다 —
 * 이벤트 목록의 순서가 곧 인과라서 별도 필드를 두지 않아도 짝을 지을 수 있다.
 */
function destructionsIn(happened: readonly BattleEvent[]): { unit: string; by: string | null }[] {
  const losses: { unit: string; by: string | null }[] = [];

  happened.forEach((event, index) => {
    if (event.type !== "defeated") return;

    let by: string | null = null;
    for (let before = index - 1; before >= 0 && by === null; before -= 1) {
      const earlier = happened[before]!;
      if (
        (earlier.type === "attacked" || earlier.type === "countered") &&
        earlier.defenderId === event.officerId
      ) {
        by = earlier.attackerId;
      }
    }
    losses.push({ unit: event.officerId, by });
  });
  return losses;
}

/** 상하좌우로 맞닿아 있는가. 대각선은 인접으로 보지 않는다(이동과 같은 척도). */
const adjacent = ([ax, ay]: Pos, [bx, by]: Pos): boolean =>
  Math.abs(ax - bx) + Math.abs(ay - by) === 1;

const inArea = ([x, y]: Pos, [x1, y1, x2, y2]: readonly number[]): boolean =>
  x >= Math.min(x1!, x2!) && x <= Math.max(x1!, x2!) && y >= Math.min(y1!, y2!) && y <= Math.max(y1!, y2!);

/** 턴 번호 조건. `turn`은 정확히, `fromTurn`은 그 턴부터다([상세 스펙 §3.2]). */
function turnMatches(
  trigger: { turn: number | null; fromTurn: number | null },
  turn: number,
): boolean {
  if (trigger.turn !== null) return turn === trigger.turn;
  if (trigger.fromTurn !== null) return turn >= trigger.fromTurn;
  return true;
}

function triggered(
  state: BattleState,
  trigger: EventTrigger,
  moment: EventMoment,
  happened: readonly BattleEvent[],
): boolean {
  switch (trigger.type) {
    case "battleStart":
      return moment === "battleStart";

    case "turnStart":
      return moment === "turnStart" && turnMatches(trigger, state.turn);

    case "turnEnd":
      return moment === "turnEnd" && turnMatches(trigger, state.turn);

    case "unitAttacks":
      return attacksIn(happened).some(
        (attack) =>
          attack.attacker === trigger.attacker &&
          (trigger.target === null || attack.target === trigger.target),
      );

    case "unitDestroyed":
      return destructionsIn(happened).some(
        (loss) => loss.unit === trigger.unit && (trigger.by === null || loss.by === trigger.by),
      );

    case "unitAdjacent": {
      const unit = unitOf(state, trigger.unit);
      const target = unitOf(state, trigger.target);
      return !!unit && !!target && adjacent(unit.pos, target.pos);
    }

    case "unitHpBelow": {
      const unit = unitOf(state, trigger.unit);
      return !!unit && unit.hp < unit.hpMax * trigger.ratio;
    }

    case "unitReaches": {
      const unit = unitOf(state, trigger.unit);
      return !!unit && inArea(unit.pos, trigger.area);
    }

    case "unitsRemaining":
      return state.units.filter((unit) => unit.side === trigger.side).length <= trigger.count;
  }
}

/** 배치할 칸이 비어 있는가. 증원이 남의 자리에 겹쳐 서면 상태가 깨진다. */
const isFree = (state: BattleState, pos: Pos): boolean =>
  !state.units.some((unit) => posKey(unit.pos) === posKey(pos));

function spawn(ctx: BattleContext, state: BattleState, side: Side, placements: StageUnit[]): void {
  for (const placement of placements) {
    const officer = ctx.data.officers.find((candidate) => candidate.id === placement.officerId);
    // 데이터가 어긋나면 증원을 건너뛴다 — 전투를 멈추는 대신 `npm run validate`가 미리 잡는다(NFR-03).
    if (!officer || unitOf(state, placement.officerId) || !isFree(state, placement.pos)) continue;

    state.units.push(makeUnit(ctx.data, officer, placement, side));
  }
}

function apply(
  ctx: BattleContext,
  state: BattleState,
  action: EventAction,
  rng: Rng,
): BattleEvent[] {
  void rng;

  switch (action.type) {
    case "dialogue":
      return [{ type: "dialogue", lines: action.lines }];

    case "spawnUnits":
      spawn(ctx, state, action.side, action.units);
      return [{ type: "unitsSpawned", officerIds: action.units.map((unit) => unit.officerId) }];

    case "removeUnit": {
      const index = state.units.findIndex((unit) => unit.officerId === action.unit);
      if (index < 0) return [];

      state.units.splice(index, 1);
      return [{ type: "unitRemoved", officerId: action.unit }];
    }

    case "moveUnit": {
      const unit = unitOf(state, action.unit);
      if (!unit) return [];

      const from = unit.pos;
      unit.pos = action.pos;
      return [{ type: "moved", officerId: unit.officerId, from, to: action.pos }];
    }

    case "setFlag":
      if (!state.flags.includes(action.flag)) state.flags.push(action.flag);
      return [];

    case "clearFlag":
      state.flags = state.flags.filter((flag) => flag !== action.flag);
      return [];

    case "giveItem": {
      const unit = unitOf(state, action.unit);
      // 소지품 상한은 이벤트 보상에도 그대로 걸린다([FR-07]).
      if (!unit || unit.items.length >= ctx.data.combatConfig.itemSlots) return [];

      unit.items.push(action.itemId);
      return [{ type: "itemGained", officerId: unit.officerId, itemId: action.itemId }];
    }

    case "giveExp": {
      const unit = unitOf(state, action.unit);
      return unit ? gainExp(ctx, unit, action.amount) : [];
    }

    case "setWeather":
      state.weather = action.weather;
      // 이벤트가 정한 날씨는 동적 전이보다 세다 — 남은 비 턴을 지워 다음 턴에 되돌아가지 않게 한다.
      state.weatherTurnsLeft = 0;
      return [{ type: "weatherChanged", to: action.weather }];

    case "changeMorale": {
      const targets = action.unit
        ? state.units.filter((unit) => unit.officerId === action.unit)
        : state.units.filter((unit) => action.side === null || unit.side === action.side);
      return targets.flatMap((unit) => changeMorale(ctx, unit, action.delta));
    }

    case "endBattle":
      state.forcedOutcome = action.result;
      return [];
  }
}

/** 이 이벤트를 지금 실행해야 하는가. */
function shouldRun(
  state: BattleState,
  event: StageEvent,
  moment: EventMoment,
  happened: readonly BattleEvent[],
): boolean {
  if (event.scope !== "battle") return false;
  if (event.once && state.firedEvents.includes(event.id)) return false;
  if (!triggered(state, event.trigger, moment, happened)) return false;

  if (event.condition) {
    const isSet = state.flags.includes(event.condition.flag);
    if (isSet !== event.condition.isSet) return false;
  }
  return true;
}

/**
 * 지금 성립하는 이벤트를 스테이지 배열 순서대로 실행한다([상세 스펙 §3.4]).
 * `happened`는 방금 적용된 커맨드가 낸 이벤트로, `unitAttacks`·`unitDestroyed`가 그것을 읽는다.
 */
export function runEvents(
  ctx: BattleContext,
  state: BattleState,
  moment: EventMoment,
  happened: readonly BattleEvent[],
  rng: Rng,
): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const event of ctx.stage.events) {
    if (!shouldRun(state, event, moment, happened)) continue;

    // 발동 즉시 기록한다 — 액션이 도중에 상태를 바꿔도 같은 바퀴에서 두 번 돌지 않는다([상세 스펙 §3.4]).
    if (event.once) state.firedEvents.push(event.id);
    events.push({ type: "eventFired", eventId: event.id });

    for (const action of event.actions) {
      events.push(...apply(ctx, state, action, rng));
    }
  }
  return events;
}
