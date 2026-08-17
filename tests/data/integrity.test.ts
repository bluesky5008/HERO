import { describe, expect, it } from "vitest";
import { formatIssues, loadGameData } from "../../src/core/data/loader";
import { validAnimationSet, validClass, validRawGameData, validSprite } from "./fixtures";

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
    raw.stages = {
      "stage-test.json": {
        id: "stage-test",
        name: "테스트 스테이지",
        map: { width: 2, height: 2, tiles: [["plain", "swamp"], ["plain", "plain"]] },
        weather: "clear",
      },
    };

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
