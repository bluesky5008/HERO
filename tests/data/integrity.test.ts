import { describe, expect, it } from "vitest";
import { formatIssues, loadGameData } from "../../src/core/data/loader";
import {
  validAnimationSet,
  validClass,
  validOfficer,
  validRawGameData,
  validSprite,
  validItem,
  validStage,
  validTactic,
} from "./fixtures";

/**
 * AC-01 인수 테스트: 존재하지 않는 ID 참조 또는 스프라이트 매핑 누락을 데이터에 넣으면
 * 해당 항목이 에러 목록으로 보고되어야 한다.
 * (0이 아닌 종료 코드는 CLI 계층인 scripts/validate.ts가 책임진다 — TASK-07.)
 */

/** 계열 3종을 쓰는 병과 묶음. 상성 커버리지 검사를 실제로 자극하기 위한 준비. */
function threeFamilyData() {
  const raw = validRawGameData();
  raw.classes = [
    { ...validClass, id: "sword_soldier", family: "infantry", sprite: "sword_soldier" },
    { ...validClass, id: "light_cavalry", family: "cavalry", sprite: "light_cavalry" },
  ];
  raw.sprites = {
    sword_soldier: { ...validSprite },
    light_cavalry: { ...validSprite },
  };
  raw.animations = {
    sword_soldier: structuredClone(validAnimationSet),
    light_cavalry: structuredClone(validAnimationSet),
  };
  raw.affinity = [
    { attacker: "infantry", defender: "infantry", modifier: 1 },
    { attacker: "infantry", defender: "cavalry", modifier: 1.25 },
    { attacker: "cavalry", defender: "infantry", modifier: 0.75 },
    { attacker: "cavalry", defender: "cavalry", modifier: 1 },
  ];
  return raw;
}

/** AC-01이 요구하는 "에러 목록 출력"을 그대로 검사한다 — CLI가 찍는 문자열과 같은 형식이다. */
const report = formatIssues;

describe("loadGameData — 정상 데이터", () => {
  it("문제를 보고하지 않고 데이터를 반환한다", () => {
    const result = loadGameData(validRawGameData());
    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
  });

  it("계열이 여럿이어도 상성이 모두 정의되어 있으면 통과한다", () => {
    expect(loadGameData(threeFamilyData()).issues).toEqual([]);
  });
});

describe("loadGameData — 스키마 위반", () => {
  it("데이터를 반환하지 않고 위반 위치를 보고한다", () => {
    const raw = validRawGameData();
    raw.classes = [{ ...validClass, movement: -1 }];

    const result = loadGameData(raw);

    expect(result.data).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(report(result.issues)).toContain("movement");
  });
});

describe("loadGameData — 아이템 참조 무결성 (AC-01)", () => {
  it("아이템 ID가 중복 정의되면 보고한다", () => {
    const raw = validRawGameData();
    raw.items = [{ ...validItem }, { ...validItem, name: "철검 사본" }];

    expect(report(loadGameData(raw).issues)).toContain("iron_sword");
  });

  it("소모품이 없는 책략을 가리키면 보고한다", () => {
    const raw = validRawGameData();
    raw.items = [{ ...validItem, type: "consumable", tacticId: "no_such_tactic" }];

    expect(report(loadGameData(raw).issues)).toContain("no_such_tactic");
  });

  it("전환서가 없는 병과를 가리키면 보고한다", () => {
    const raw = validRawGameData();
    raw.items = [{ ...validItem, type: "classChange", classId: "no_such_class" }];

    expect(report(loadGameData(raw).issues)).toContain("no_such_class");
  });

  it("병과 변경·승급 아이템에 장수 제한이 있으면 경고한다 (FR-07)", () => {
    const raw = validRawGameData();
    raw.items = [
      { ...validItem, id: "sword_book", type: "classChange", classId: "sword_soldier", forbiddenFor: ["liu_bei"] },
    ];

    const issues = loadGameData(raw).issues;

    expect(report(issues)).toContain("liu_bei");
    // 개조 확장용 필드이므로 데이터를 막지는 않는다 — 경고로만 남는다.
    expect(issues.every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("장비 아이템의 장수 제한은 경고하지 않는다 — 설계가 막은 것은 변경·승급 아이템이다", () => {
    const raw = validRawGameData();
    raw.items = [{ ...validItem, forbiddenFor: ["liu_bei"] }];

    expect(loadGameData(raw).issues).toEqual([]);
  });
});

describe("loadGameData — 책략 참조 무결성 (AC-01)", () => {
  it("병과가 없는 책략 ID를 가리키면 보고한다", () => {
    const raw = validRawGameData();
    raw.classes = [{ ...validClass, tactics: ["no_such_tactic"] }];

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("no_such_tactic");
  });

  it("책략 ID가 중복 정의되면 보고한다", () => {
    const raw = validRawGameData();
    raw.tactics = [{ ...validTactic }, { ...validTactic, name: "화시 사본" }];

    const issues = loadGameData(raw).issues;

    expect(report(issues)).toContain("fire_arrow");
  });

  it("책략의 지형 요구가 없는 지형을 가리키면 보고한다", () => {
    const raw = validRawGameData();
    raw.tactics = [{ ...validTactic, terrainRequired: ["no_such_terrain"] }];

    const issues = loadGameData(raw).issues;

    expect(report(issues)).toContain("no_such_terrain");
  });

  it("책략의 지형 보정이 없는 지형을 가리키면 보고한다", () => {
    const raw = validRawGameData();
    raw.tactics = [{ ...validTactic, terrainBonus: { no_such_terrain: 1.25 } }];

    const issues = loadGameData(raw).issues;

    expect(report(issues)).toContain("no_such_terrain");
  });
});

describe("loadGameData — 참조 무결성 (AC-01)", () => {
  it("존재하지 않는 병과 ID를 승급 대상으로 참조하면 보고한다", () => {
    const raw = validRawGameData();
    raw.classes = [{ ...validClass, upgradesTo: "no_such_class", upgradeLevel: 15 }];

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("no_such_class");
  });

  it("스프라이트 매핑이 누락되면 보고한다", () => {
    const raw = validRawGameData();
    raw.sprites = {};

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("sword_soldier");
  });

  it("애니메이션 정의가 누락되면 보고한다", () => {
    const raw = validRawGameData();
    raw.animations = {};

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("sword_soldier");
  });

  it("상성 행렬에 빠진 계열 조합이 있으면 보고한다", () => {
    const raw = threeFamilyData();
    raw.affinity = [
      { attacker: "infantry", defender: "infantry", modifier: 1 },
      { attacker: "infantry", defender: "cavalry", modifier: 1.25 },
      { attacker: "cavalry", defender: "cavalry", modifier: 1 },
      // cavalry → infantry 누락
    ];

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("cavalry");
  });

  it("스테이지 타일이 정의되지 않은 지형을 참조하면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.map.tiles[0] = ["plain", "swamp", "plain"];
    raw.stages = { "stage-test.json": stage };

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("swamp");
  });

  it("이동 규칙이 정의되지 않은 지형을 참조하면 보고한다", () => {
    const raw = validRawGameData();
    raw.classes = [
      { ...validClass, movementRules: { forbidden: ["swamp"], halved: [] } },
    ];

    const issues = loadGameData(raw).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(report(issues)).toContain("swamp");
  });

  it("문제를 하나만 보고하고 멈추지 않는다", () => {
    const raw = validRawGameData();
    raw.sprites = {};
    raw.animations = {};

    expect(loadGameData(raw).issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("loadGameData — 전투 데이터 참조 무결성", () => {
  it("무장이 존재하지 않는 병과를 참조하면 보고한다", () => {
    const raw = validRawGameData();
    raw.officers = [{ ...validOfficer, classId: "no_such_class" }];

    const issues = loadGameData(raw).issues;

    expect(report(issues)).toContain("no_such_class");
  });

  it("무장 ID가 중복되면 보고한다", () => {
    const raw = validRawGameData();
    raw.officers = [{ ...validOfficer }, { ...validOfficer, name: "다른 이름" }];

    expect(report(loadGameData(raw).issues)).toContain("liu_bei");
  });

  it("적 부대가 존재하지 않는 무장을 참조하면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.enemies = [{ officerId: "no_such_officer", level: 5, pos: [1, 0] }];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("no_such_officer");
  });

  it("출진 명단이 존재하지 않는 무장을 참조하면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.deployment.roster = [{ officerId: "no_such_officer", level: 5 }];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("no_such_officer");
  });

  it("패배 조건이 존재하지 않는 무장을 지목하면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.defeat.officerIds = ["no_such_officer"];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("no_such_officer");
  });

  it("패배 조건 무장이 출진 명단에 없으면 보고한다", () => {
    // 출진할 수 없는 무장을 패배 조건에 두면 전투가 시작하자마자 패배로 판정된다.
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.defeat.officerIds = ["deng_mao"]; // 적 무장 — 출진 명단에 없다
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("출진 명단");
  });

  it("적 부대 좌표가 맵 밖이면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.enemies = [{ officerId: "deng_mao", level: 5, pos: [9, 0] }];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("enemies[0]");
  });

  it("배치 구역 좌표가 맵 밖이면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.deployment.zone[0] = [0, 9];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("deployment.zone[0]");
  });

  it("적 부대가 같은 칸에 겹치면 보고한다", () => {
    const raw = validRawGameData();
    const stage = structuredClone(validStage);
    stage.enemies = [
      { officerId: "deng_mao", level: 5, pos: [1, 0] },
      { officerId: "liu_bei", level: 5, pos: [1, 0] },
    ];
    raw.stages = { "stage-test.json": stage };

    expect(report(loadGameData(raw).issues)).toContain("[1, 0]");
  });
});
