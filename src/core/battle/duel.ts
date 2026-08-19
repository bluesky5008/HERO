import type { DuelAction } from "../data/schemas";
import type { Rng } from "../rng";
import type { BattleEvent } from "./events";
import { gainExp } from "./experience";
import { changeMorale } from "./morale";
import { officerOf, type BattleContext, type BattleState, type Unit } from "./state";

/**
 * 일기토([상세 스펙 §7], DES-13 → FR-08, AC-03).
 *
 * 이벤트 트리거로만 발동한다 — 자유 일기토는 v1 범위 밖이고, 여기서는 `judge` 판정으로 기반만 둔다(§7.1).
 * 승률·경험치·사기 상수는 전부 `combat-config.json`에서 읽는다(NFR-06).
 */

export interface DuelResult {
  events: BattleEvent[];
  /** `a`가 이겼는가. 부대가 전장에 없어 일기토가 성립하지 않으면 `null`. */
  aWon: boolean | null;
}

/** 승률(백분율). 무력차가 클수록 높고 설정한 상하한을 벗어나지 않는다([상세 스펙 §7.2]). */
function winChance(ctx: BattleContext, a: Unit, b: Unit): number {
  const { base, warScale, min, max } = ctx.data.combatConfig.duel;
  const difference = officerOf(ctx, a).war - officerOf(ctx, b).war;

  return Math.min(Math.max(base + difference * warScale, min), max);
}

/**
 * 일기토를 치르고 승패 효과까지 적용한다.
 * 하위 액션(`onAWin`·`onBWin`)은 이벤트 인터프리터가 결과를 보고 실행한다 —
 * 여기서 실행하면 [eventRunner](../campaign/eventRunner.ts)와 서로를 부르게 된다.
 */
export function resolveDuel(
  ctx: BattleContext,
  state: BattleState,
  duel: DuelAction,
  rng: Rng,
): DuelResult {
  const a = state.units.find((unit) => unit.officerId === duel.a);
  const b = state.units.find((unit) => unit.officerId === duel.b);
  // 스크립트가 이미 전장을 떠난 부대를 지목할 수 있다. 전투를 멈추는 대신 조용히 넘긴다(NFR-03).
  if (!a || !b) return { events: [], aWon: null };

  const events: BattleEvent[] = [{ type: "duelStarted", a: a.officerId, b: b.officerId }];

  // 고정 승패는 난수를 쓰지 않는다 — 같은 스크립트가 언제나 같은 이야기를 내야 한다(NFR-01).
  const aWon =
    duel.outcome === "judge" ? rng.range(0, 100) < winChance(ctx, a, b) : duel.outcome === "aWins";

  const winner = aWon ? a : b;
  const loser = aWon ? b : a;
  const fled = duel.loser === "retreats";

  state.units.splice(state.units.indexOf(loser), 1);
  events.push({
    type: "duelResolved",
    winner: winner.officerId,
    loser: loser.officerId,
    fled,
  });
  // 괴멸은 격파와 같고, 퇴각은 잃은 것으로 치지 않는다([상세 스펙 §7.2]).
  events.push(
    fled
      ? { type: "unitRemoved", officerId: loser.officerId }
      : { type: "defeated", officerId: loser.officerId },
  );

  const { winnerExp, winnerMorale } = ctx.data.combatConfig.duel;
  events.push(...gainExp(ctx, winner, winnerExp));
  for (const unit of state.units.filter((candidate) => candidate.side === winner.side)) {
    events.push(...changeMorale(ctx, unit, winnerMorale));
  }

  return { events, aWon };
}
