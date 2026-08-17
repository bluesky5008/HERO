import { describe, expect, it } from "vitest";
import { createRng, restoreRng, type Rng } from "../src/core/rng";

/** 수열 비교용 — 원시 난수 대신 공개 API(`range`)로만 관찰한다. */
const draw = (rng: Rng, count: number): number[] =>
  Array.from({ length: count }, () => rng.range(0, 1));

describe("createRng", () => {
  it("같은 시드는 같은 수열을 낸다", () => {
    expect(draw(createRng(42), 20)).toEqual(draw(createRng(42), 20));
  });

  it("다른 시드는 다른 수열을 낸다", () => {
    expect(draw(createRng(42), 20)).not.toEqual(draw(createRng(43), 20));
  });

  it("시드 0에서도 상수 수열로 무너지지 않는다", () => {
    expect(new Set(draw(createRng(0), 20)).size).toBeGreaterThan(1);
  });
});

describe("range", () => {
  it("[min, max) 안에 머문다", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.range(0.9, 1.1);
      expect(value).toBeGreaterThanOrEqual(0.9);
      expect(value).toBeLessThan(1.1);
    }
  });

  it("폭이 0이면 그 값을 낸다", () => {
    expect(createRng(1).range(5, 5)).toBe(5);
  });
});

describe("상태 저장과 복원", () => {
  it("복원한 RNG는 저장 시점 이후의 수열을 그대로 이어 낸다", () => {
    const origin = createRng(2026);
    draw(origin, 5);
    const saved = origin.save();
    const expected = draw(origin, 10);
    expect(draw(restoreRng(saved), 10)).toEqual(expected);
  });

  it("상태는 JSON 왕복 후에도 같은 수열을 복원한다", () => {
    const rng = createRng(2026);
    draw(rng, 3);
    const saved = rng.save();
    const viaJson = restoreRng(JSON.parse(JSON.stringify(saved)) as unknown);
    expect(draw(viaJson, 5)).toEqual(draw(restoreRng(saved), 5));
  });

  it("저장한 상태는 이후 난수 소비의 영향을 받지 않는다", () => {
    const rng = createRng(3);
    const saved = rng.save();
    const snapshot = [...saved.state];
    draw(rng, 5);
    expect(saved.state).toEqual(snapshot);
  });

  it("알 수 없는 알고리즘이나 손상된 상태를 거부한다", () => {
    const valid = createRng(9).save();
    expect(() => restoreRng({ ...valid, algo: "mt19937" })).toThrow();
    expect(() => restoreRng({ ...valid, state: [0, 0, 0, 0] })).toThrow();
    expect(() => restoreRng({ ...valid, state: [1, 2, 3] })).toThrow();
    expect(() => restoreRng(null)).toThrow();
  });
});
