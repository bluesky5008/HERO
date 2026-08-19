import type { Pos } from "../data/schemas";

/**
 * 커맨드가 남긴 사실([전체 설계 §6.3], DES-01).
 * 렌더러가 이 목록을 구독해 연출을 재생한다 — 상태 변경은 커맨드가 이미 끝냈으므로
 * 이벤트는 "무엇이 일어났는가"만 담고 상태를 바꾸는 힘은 없다(NFR-02).
 * 책략·일기토는 해당 기능이 들어오는 M2의 뒤 작업에서 유형을 늘린다.
 */
export type BattleEvent =
  | { type: "moved"; officerId: string; from: Pos; to: Pos }
  | { type: "attacked"; attackerId: string; defenderId: string; damage: number }
  | { type: "defeated"; officerId: string }
  | { type: "moraleChanged"; officerId: string; from: number; to: number }
  | { type: "healed"; officerId: string; amount: number }
  | { type: "confused"; officerId: string }
  | { type: "expGained"; officerId: string; amount: number }
  | { type: "leveledUp"; officerId: string; level: number }
  | { type: "tacticUsed"; officerId: string; tacticId: string; to: Pos }
  | { type: "tacticMissed"; officerId: string; targetId: string }
  | { type: "itemUsed"; officerId: string; itemId: string }
  | { type: "classChanged"; officerId: string; from: string; to: string }
  | { type: "countered"; attackerId: string; defenderId: string; damage: number }
  | { type: "treasureFound"; officerId: string; itemId: string; pos: Pos }
  | { type: "weatherChanged"; to: "clear" | "rain" }
  | { type: "eventFired"; eventId: string }
  | { type: "dialogue"; lines: readonly { speaker: string; text: string }[] }
  | { type: "unitsSpawned"; officerIds: string[] }
  | { type: "unitRemoved"; officerId: string }
  | { type: "itemGained"; officerId: string; itemId: string }
  | { type: "duelStarted"; a: string; b: string }
  | { type: "duelResolved"; winner: string; loser: string; fled: boolean };
