import { describe, expect, it } from "vitest";
import { runAiPhase } from "../../src/core/battle/ai";
import type { BattleEvent } from "../../src/core/battle/events";
import { createBattleState, type BattleContext } from "../../src/core/battle/state";
import { beginPhase, endPhase, outcome } from "../../src/core/battle/turn";
import { runEvents } from "../../src/core/campaign/eventRunner";
import { loadGameData, formatIssues } from "../../src/core/data/loader";
import type { Stage, StageUnit } from "../../src/core/data/schemas";
import { createRng } from "../../src/core/rng";
import { createInteraction } from "../../src/scenes/BattleInteraction";
import { readGameData } from "../../scripts/readGameData";

/**
 * M2 검증 스테이지 완주(TASK-33 → AC-03).
 *
 * [VER-09](../../docs/plan.md#검증-계획)는 "화면에서 한 판 완주"라 자동화하지 않는 검증이다.
 * 이 파일은 그것을 대신하지 않는다 — 화면이 부르는 것과 **같은 조작 계층**(`BattleInteraction`)으로
 * 검증 스테이지를 돌려 M2가 더한 규칙이 실제로 하나씩 발동하는지를 자동으로 남긴다.
 * 그리기와 연출은 여전히 화면 확인의 몫이다([RISK-M0-01](../../docs/plan.md#위험)).
 */

const SEED = 7;

/** 저장소의 실제 데이터로 검증 스테이지를 세운다 — 픽스처가 아니라 배포될 값을 본다. */
function stageM2(): { ctx: BattleContext; stage: Stage } {
  const { data, issues } = loadGameData(readGameData("data"));
  if (!data) throw new Error(`데이터가 유효하지 않다:\n${formatIssues(issues)}`);

  const stage = data.stages.find((candidate) => candidate.id === "stage-m2");
  if (!stage) throw new Error("stage-m2를 찾을 수 없다");
  return { ctx: { data, stage }, stage };
}

/** 스테이지의 출진 명단을 배치 구역 앞에서부터 세운다(`BattleScene.deployRoster`와 같은 규칙). */
function deploy(stage: Stage): StageUnit[] {
  const party: StageUnit[] = [];
  for (const entry of stage.deployment.roster ?? []) {
    const pos = stage.deployment.zone[party.length];
    if (!pos || party.length >= stage.deployment.maxUnits) break;
    party.push({ ...entry, pos, ai: "aggressive", aiParams: { anchor: null, escape: null } });
  }
  return party;
}

describe("M2 검증 스테이지 — 규칙이 한 판 안에서 모두 발동한다", () => {
  it("전투를 완주하고 M2가 더한 규칙이 하나씩 일어난다", () => {
    const { ctx, stage } = stageM2();
    const state = createBattleState(ctx.data, stage, deploy(stage));
    const rng = createRng(SEED);
    const ui = createInteraction(ctx, state, rng);
    const log: BattleEvent[] = [];

    const record = (events: readonly BattleEvent[]): void => {
      log.push(...events);
    };

    record(runEvents(ctx, state, "battleStart", [], rng));
    record(beginPhase(ctx, state, rng));

    // 화면이 하는 것과 같은 순서로 조작한다 — 선택 → 이동 → 행동.
    const act = (officerId: string, action: () => BattleEvent[]): void => {
      const unit = state.units.find((candidate) => candidate.officerId === officerId);
      if (!unit || unit.acted || unit.confused || unit.side !== state.phase) return;

      ui.confirm(unit.pos); // 선택
      ui.confirm(unit.pos); // 제자리 이동 확정 → 행동 메뉴
      record(action());
      ui.cancel();
    };

    // 1턴: 유비가 보물을 밟고 조사 → 승급 아이템을 얻는다.
    const liuBei = state.units.find((unit) => unit.officerId === "liu_bei")!;
    ui.confirm(liuBei.pos);
    record(ui.confirm([4, 9])); // 장창이 묻힌 칸
    record(ui.choose("investigate"));
    expect(liuBei.items).toContain("long_spear");

    act("guan_yu", () => ui.choose("wait"));
    act("zhang_fei", () => ui.choose("wait"));

    // 페이즈를 넘겨 적이 움직이게 한다.
    const handOver = (): void => {
      record(endPhase(ctx, state, rng));
      record(beginPhase(ctx, state, rng));
    };

    handOver();
    record(runAiPhase(ctx, state, rng));
    handOver();

    // 2턴: 유비가 승급하고, 관우가 책략을 쓴다.
    ui.confirm(liuBei.pos);
    ui.confirm(liuBei.pos);
    record(ui.chooseItem("long_spear"));
    expect(liuBei.classId).toBe("spear_soldier");

    const guanYu = state.units.find((unit) => unit.officerId === "guan_yu")!;
    ui.confirm(guanYu.pos);
    ui.confirm(guanYu.pos);
    record(ui.chooseItem("herb") ?? []);
    ui.cancel();

    // 남은 전투는 양쪽 AI에 맡겨 승패가 날 때까지 돌린다.
    for (let turn = 0; turn < 40 && !outcome(ctx, state); turn += 1) {
      record(runAiPhase(ctx, state, rng));
      handOver();
    }

    const kinds = new Set(log.map((event) => event.type));

    // 승패가 났다 — 무한 루프 없이 전투가 끝난다.
    expect(outcome(ctx, state)).not.toBeNull();

    // M2가 더한 규칙의 발자국.
    expect(kinds).toContain("treasureFound"); // 보물 조사 (§1.7)
    expect(kinds).toContain("classChanged"); // 승급 (§1.6)
    expect(kinds).toContain("itemUsed"); // 아이템 사용 (§1.6)
    expect(kinds).toContain("eventFired"); // 이벤트 DSL (§3)
    expect(kinds).toContain("dialogue"); // 대화 연출 (§3.3)
    expect(kinds).toContain("attacked"); // 전투 (§1.3)
    expect(kinds).toContain("moraleChanged"); // 사기 변동 (§1.4)
    expect(kinds).toContain("expGained"); // 경험치 (§1.6)
    expect(kinds).toContain("leveledUp"); // 레벨업 (§1.6)
    expect(kinds).toContain("confused"); // 혼란 판정 (§1.4)
    expect(kinds).toContain("tacticUsed"); // 책략 (§1.5)
    expect(kinds).toContain("duelStarted"); // 일기토 (§7)
    expect(kinds).toContain("duelResolved");
    expect(kinds).toContain("healed"); // 거점·자연 회복 (§1.7)
    expect(kinds).toContain("weatherChanged"); // 동적 날씨 (§1.7)
  });

  it("검증 스테이지의 이벤트·보물·AI 프로필이 데이터에 실제로 있다", () => {
    const { stage } = stageM2();

    expect(stage.events.map((event) => event.id)).toEqual([
      "m2-open",
      "m2-duel",
      "m2-reinforce",
      "m2-highground",
    ]);
    expect(stage.treasures).toHaveLength(2);
    expect(stage.enemies.map((enemy) => enemy.ai).sort()).toEqual([
      "aggressive",
      "defensive",
      "guard",
    ]);
    // 동적 날씨라 우천이 화계를 막는 상황이 한 판 안에서 일어날 수 있다(§1.7).
    expect(typeof stage.weather).toBe("object");
  });
});
