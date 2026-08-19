import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/core/battle/commands";
import { beginPhase, endPhase, outcome } from "../../src/core/battle/turn";
import { runEvents } from "../../src/core/campaign/eventRunner";
import { createRng } from "../../src/core/rng";
import type { Pos, StageEvent } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "../battle/fixtures";

/**
 * 전투 이벤트 DSL([상세 스펙 §3], DES-13 → FR-09, VER-15).
 * M2는 `scope: "battle"`만 실행하고, 평가는 커맨드 직후와 턴 경계에 한 번씩 한다(§3.4).
 */

const MAP = ["........", "........", "........"];

const at = (officerId: string, side: "player" | "enemy", pos: Pos): UnitSpec => ({
  officerId,
  side,
  pos,
});

/** 이벤트 하나를 최소 형태로 적는다 — 스키마 기본값(scope battle, once true)에 기댄다. */
const event = (partial: Partial<StageEvent> & Pick<StageEvent, "trigger">): StageEvent =>
  ({
    id: "ev-test",
    scope: "battle",
    once: true,
    condition: null,
    actions: [{ type: "setFlag", flag: "fired" }],
    ...partial,
  }) as StageEvent;

function battle(specs: UnitSpec[], events: StageEvent[], options: BattleFixtureOptions = {}) {
  const { ctx, state } = makeBattle(MAP, specs, { ...options, events });
  return {
    ctx,
    state,
    unit: (officerId: string) => state.units.find((c) => c.officerId === officerId)!,
    run: (moment: "battleStart" | "turnStart" | "turnEnd" | "command" = "command") =>
      runEvents(ctx, state, moment, [], createRng(1)),
    fired: () => state.flags.includes("fired"),
  };
}

const duo = (): UnitSpec[] => [at("foot", "player", [1, 1]), at("foot2", "enemy", [2, 1])];

describe("트리거 9종 — 자기 조건에서만 발동한다 ([상세 스펙 §3.2])", () => {
  it("battleStart는 전투 개시에만 발동한다", () => {
    const b = battle(duo(), [event({ trigger: { type: "battleStart" } })]);

    b.run("turnStart");
    expect(b.fired()).toBe(false);

    b.run("battleStart");
    expect(b.fired()).toBe(true);
  });

  it("turnStart는 지정한 턴에만 발동한다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "turnStart", turn: 3, fromTurn: null } }),
    ]);

    b.run("turnStart");
    expect(b.fired()).toBe(false);

    b.state.turn = 3;
    b.run("turnStart");
    expect(b.fired()).toBe(true);
  });

  it("fromTurn은 그 턴부터 계속 성립한다", () => {
    const b = battle(duo(), [
      event({ once: false, trigger: { type: "turnStart", turn: null, fromTurn: 2 } }),
    ]);

    b.run("turnStart");
    expect(b.fired()).toBe(false);

    b.state.turn = 5;
    b.run("turnStart");
    expect(b.fired()).toBe(true);
  });

  it("turnEnd는 턴이 끝날 때만 발동한다", () => {
    const b = battle(duo(), [event({ trigger: { type: "turnEnd", turn: null, fromTurn: null } })]);

    b.run("turnStart");
    expect(b.fired()).toBe(false);

    b.run("turnEnd");
    expect(b.fired()).toBe(true);
  });

  it("unitAttacks는 지정한 공격자가 지정한 대상을 칠 때 발동한다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "unitAttacks", attacker: "foot", target: "foot2" } }),
    ]);

    const events = applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot", targetId: "foot2" },
      createRng(1),
    );

    expect(b.fired()).toBe(true);
    expect(events).toContainEqual({ type: "eventFired", eventId: "ev-test" });
  });

  it("unitAdjacent는 상하좌우로 맞닿을 때 발동한다", () => {
    const apart = battle(
      [at("foot", "player", [1, 1]), at("foot2", "enemy", [4, 1])],
      [event({ trigger: { type: "unitAdjacent", unit: "foot", target: "foot2" } })],
    );
    apart.run();
    expect(apart.fired()).toBe(false);

    const close = battle(duo(), [
      event({ trigger: { type: "unitAdjacent", unit: "foot", target: "foot2" } }),
    ]);
    close.run();
    expect(close.fired()).toBe(true);
  });

  it("unitHpBelow는 병력이 비율 아래로 떨어질 때 발동한다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "unitHpBelow", unit: "foot2", ratio: 0.5 } }),
    ]);

    b.run();
    expect(b.fired()).toBe(false);

    b.unit("foot2").hp = Math.floor(b.unit("foot2").hpMax * 0.4);
    b.run();
    expect(b.fired()).toBe(true);
  });

  it("unitDestroyed는 그 부대가 쓰러질 때 발동하고 가해자도 가릴 수 있다", () => {
    const b = battle(
      [at("foot", "player", [1, 1]), { ...at("foot2", "enemy", [2, 1]), hp: 1 }],
      [event({ trigger: { type: "unitDestroyed", unit: "foot2", by: "foot" } })],
    );

    applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot", targetId: "foot2" },
      createRng(1),
    );

    expect(b.fired()).toBe(true);
  });

  it("unitDestroyed의 가해자가 다르면 발동하지 않는다", () => {
    const b = battle(
      [at("foot", "player", [1, 1]), { ...at("foot2", "enemy", [2, 1]), hp: 1 }],
      [event({ trigger: { type: "unitDestroyed", unit: "foot2", by: "horse" } })],
    );

    applyCommand(
      b.ctx,
      b.state,
      { type: "attack", officerId: "foot", targetId: "foot2" },
      createRng(1),
    );

    expect(b.fired()).toBe(false);
  });

  it("unitReaches는 지정한 영역에 들어설 때 발동한다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "unitReaches", unit: "foot", area: [5, 0, 7, 2] } }),
    ]);

    b.run();
    expect(b.fired()).toBe(false);

    b.unit("foot").pos = [6, 1];
    b.run();
    expect(b.fired()).toBe(true);
  });

  it("unitsRemaining은 진영의 남은 부대가 기준 이하일 때 발동한다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "unitsRemaining", side: "enemy", count: 0 } }),
    ]);

    b.run();
    expect(b.fired()).toBe(false);

    b.state.units = b.state.units.filter((unit) => unit.side === "player");
    b.run();
    expect(b.fired()).toBe(true);
  });
});

describe("실행 규칙 ([상세 스펙 §3.4])", () => {
  it("once 이벤트는 발동 기록 뒤 다시 돌지 않는다", () => {
    const b = battle(duo(), [event({ trigger: { type: "battleStart" } })]);

    expect(b.run("battleStart")).toContainEqual({ type: "eventFired", eventId: "ev-test" });
    expect(b.state.firedEvents).toEqual(["ev-test"]);
    expect(b.run("battleStart")).toEqual([]);
  });

  it("once가 아니면 조건이 성립할 때마다 돈다", () => {
    const b = battle(duo(), [event({ once: false, trigger: { type: "battleStart" } })]);

    expect(b.run("battleStart")).not.toEqual([]);
    expect(b.run("battleStart")).not.toEqual([]);
    expect(b.state.firedEvents).toEqual([]);
  });

  it("동시에 성립하면 스테이지 배열 순서대로 실행한다", () => {
    const b = battle(duo(), [
      event({ id: "first", trigger: { type: "battleStart" }, actions: [{ type: "setFlag", flag: "a" }] }),
      event({ id: "second", trigger: { type: "battleStart" }, actions: [{ type: "setFlag", flag: "b" }] }),
    ]);

    const events = b.run("battleStart");
    const ids = events.filter((e) => e.type === "eventFired").map((e) => e.eventId);

    expect(ids).toEqual(["first", "second"]);
    expect(b.state.flags).toEqual(["a", "b"]);
  });

  it("플래그 조건이 맞지 않으면 액션을 실행하지 않는다", () => {
    const b = battle(duo(), [
      event({
        trigger: { type: "battleStart" },
        condition: { flag: "gate", isSet: true },
      }),
    ]);

    b.run("battleStart");
    expect(b.fired()).toBe(false);

    b.state.flags.push("gate");
    b.run("battleStart");
    expect(b.fired()).toBe(true);
  });

  it("플래그가 없어야 한다는 조건도 쓸 수 있다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "battleStart" }, condition: { flag: "gate", isSet: false } }),
    ]);

    b.run("battleStart");
    expect(b.fired()).toBe(true);
  });

  it("camp 스코프 이벤트는 전투 중 평가하지 않는다", () => {
    const b = battle(duo(), [event({ scope: "camp", trigger: { type: "battleStart" } })]);

    b.run("battleStart");
    expect(b.fired()).toBe(false);
  });

  it("평가는 배열을 한 바퀴 도는 것으로 끝난다 — 지나간 이벤트를 다시 재지 않는다", () => {
    // 뒤에 있는 `opener`가 세우는 플래그를 앞에 있는 `follower`가 조건으로 요구한다.
    // 한 바퀴만 돌므로 `follower`를 지날 때는 아직 플래그가 없어 이번 평가에서는 발동하지 않는다.
    const b = battle(duo(), [
      event({
        id: "follower",
        trigger: { type: "unitAdjacent", unit: "foot", target: "foot2" },
        condition: { flag: "gate", isSet: true },
      }),
      event({
        id: "opener",
        trigger: { type: "battleStart" },
        actions: [{ type: "setFlag", flag: "gate" }],
      }),
    ]);

    b.run("battleStart");
    expect(b.state.firedEvents).toEqual(["opener"]);

    // 다음 평가 시점에는 플래그가 이미 서 있으므로 그때 발동한다.
    b.run("command");
    expect(b.state.firedEvents).toEqual(["opener", "follower"]);
  });

  it("앞선 이벤트가 바꾼 상태는 같은 바퀴의 뒤 이벤트가 본다 — 배열 순서가 곧 실행 순서다", () => {
    const b = battle(duo(), [
      event({
        id: "opener",
        trigger: { type: "battleStart" },
        actions: [{ type: "setFlag", flag: "gate" }],
      }),
      event({
        id: "follower",
        trigger: { type: "battleStart" },
        condition: { flag: "gate", isSet: true },
      }),
    ]);

    b.run("battleStart");

    expect(b.state.firedEvents).toEqual(["opener", "follower"]);
  });
});

describe("액션 ([상세 스펙 §3.3])", () => {
  const withAction = (action: StageEvent["actions"][number], specs = duo()) =>
    battle(specs, [event({ trigger: { type: "battleStart" }, actions: [action] })]);

  it("spawnUnits가 증원을 전장에 세운다", () => {
    const b = withAction({
      type: "spawnUnits",
      side: "enemy",
      units: [
        {
          officerId: "horse",
          level: 5,
          morale: 100,
          pos: [6, 1],
          ai: "aggressive",
          aiParams: { anchor: null, escape: null },
        },
      ],
    });

    b.run("battleStart");

    expect(b.unit("horse").side).toBe("enemy");
    expect(b.unit("horse").pos).toEqual([6, 1]);
    expect(b.unit("horse").hp).toBe(b.unit("horse").hpMax);
  });

  it("이미 있는 부대나 찬 자리에는 증원하지 않는다", () => {
    const b = withAction({
      type: "spawnUnits",
      side: "enemy",
      units: [
        {
          officerId: "foot",
          level: 5,
          morale: 100,
          pos: [6, 1],
          ai: "aggressive",
          aiParams: { anchor: null, escape: null },
        },
      ],
    });

    b.run("battleStart");

    expect(b.state.units.filter((unit) => unit.officerId === "foot")).toHaveLength(1);
  });

  it("removeUnit이 부대를 전장에서 지운다", () => {
    const b = withAction({ type: "removeUnit", unit: "foot2" });
    b.run("battleStart");

    expect(b.state.units.map((unit) => unit.officerId)).toEqual(["foot"]);
  });

  it("moveUnit이 부대를 옮긴다", () => {
    const b = withAction({ type: "moveUnit", unit: "foot", pos: [7, 2] });
    b.run("battleStart");

    expect(b.unit("foot").pos).toEqual([7, 2]);
  });

  it("changeMorale이 진영 전체의 사기를 옮긴다", () => {
    const b = withAction({ type: "changeMorale", unit: null, side: "player", delta: -30 });
    b.run("battleStart");

    expect(b.unit("foot").morale).toBe(70);
    expect(b.unit("foot2").morale).toBe(100);
  });

  it("changeMorale이 부대 하나만 겨눌 수도 있다", () => {
    const b = withAction({ type: "changeMorale", unit: "foot2", side: null, delta: -10 });
    b.run("battleStart");

    expect(b.unit("foot2").morale).toBe(90);
    expect(b.unit("foot").morale).toBe(100);
  });

  it("giveItem이 소지품에 아이템을 넣는다", () => {
    const b = withAction({ type: "giveItem", unit: "foot", itemId: "iron_sword" });
    b.run("battleStart");

    expect(b.unit("foot").items).toEqual(["iron_sword"]);
  });

  it("소지품이 가득 차면 이벤트 보상도 들어가지 않는다 (FR-07)", () => {
    const full = Array.from({ length: 8 }, () => "herb");
    const b = withAction({ type: "giveItem", unit: "foot", itemId: "iron_sword" }, [
      { ...at("foot", "player", [1, 1]), items: full },
      at("foot2", "enemy", [2, 1]),
    ]);
    b.run("battleStart");

    expect(b.unit("foot").items).toHaveLength(8);
  });

  it("giveExp가 경험치를 주고 레벨업까지 이어진다", () => {
    const b = withAction({ type: "giveExp", unit: "foot", amount: 100 });
    const before = b.unit("foot").level;

    b.run("battleStart");

    expect(b.unit("foot").level).toBe(before + 1);
  });

  it("setWeather가 날씨를 바꾼다", () => {
    const b = withAction({ type: "setWeather", weather: "rain" });
    b.run("battleStart");

    expect(b.state.weather).toBe("rain");
  });

  it("setAiProfile이 적 부대의 행동 프로필을 바꾼다 ([상세 스펙 §5.3])", () => {
    const b = withAction({ type: "setAiProfile", unit: "foot2", profile: "guard" });
    b.run("battleStart");

    expect(b.unit("foot2").ai).toBe("guard");
  });

  it("endBattle이 승패 판정을 덮어쓴다", () => {
    const b = withAction({ type: "endBattle", result: "defeat" });

    // 조건만 보면 아직 승패가 갈리지 않았다.
    expect(outcome(b.ctx, b.state)).toBeNull();
    b.run("battleStart");

    expect(outcome(b.ctx, b.state)).toBe("defeat");
  });

  it("dialogue가 연출용 이벤트를 낸다", () => {
    const lines = [{ speaker: "유비", text: "물러서지 마라" }];
    const b = withAction({ type: "dialogue", lines });

    expect(b.run("battleStart")).toContainEqual({ type: "dialogue", lines });
  });
});

describe("평가 시점 배선 ([상세 스펙 §3.4])", () => {
  it("턴 시작 이벤트는 beginPhase가 재고, 플레이어 페이즈에서만 돈다", () => {
    const b = battle(duo(), [
      event({ trigger: { type: "turnStart", turn: null, fromTurn: null } }),
    ]);

    b.state.phase = "enemy";
    beginPhase(b.ctx, b.state, createRng(1));
    expect(b.fired()).toBe(false);

    b.state.phase = "player";
    beginPhase(b.ctx, b.state, createRng(1));
    expect(b.fired()).toBe(true);
  });

  it("턴 종료 이벤트는 턴 카운터가 오르기 전에 재므로 그 턴 번호로 걸린다", () => {
    const b = battle(duo(), [event({ trigger: { type: "turnEnd", turn: 1, fromTurn: null } })]);

    endPhase(b.ctx, b.state, createRng(1)); // 플레이어 → 적: 아직 턴이 끝나지 않았다
    expect(b.fired()).toBe(false);

    endPhase(b.ctx, b.state, createRng(1)); // 적 → 플레이어: 1턴이 끝난다
    expect(b.fired()).toBe(true);
    expect(b.state.turn).toBe(2);
  });

  it("이벤트가 없는 스테이지는 아무 일도 하지 않는다 (M1 데이터 형식)", () => {
    const b = battle(duo(), []);

    expect(b.run("battleStart")).toEqual([]);
    expect(beginPhase(b.ctx, b.state, createRng(1))).toEqual([]);
  });
});
