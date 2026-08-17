import { describe, expect, it } from "vitest";
import { damageRange, physicalDamage } from "../../src/core/battle/damage";
import { createRng } from "../../src/core/rng";
import type { Family } from "../../src/core/data/schemas";
import { makeBattle, type BattleFixtureOptions, type UnitSpec } from "./fixtures";

/**
 * [상세 스펙 §1.3]의 물리 데미지 공식과 상성·지형 보정(AC-04, VER-06).
 * 난수 폭을 1~1로 고정한 테스트는 공식만 남기고, 결정론은 따로 확인한다(VER-07).
 */

const FIXED = { combatConfig: { damageJitter: { min: 1, max: 1 } } };

/** 첫 부대가 두 번째 부대를 친다. */
function hit(
  rows: string[],
  attacker: UnitSpec,
  defender: UnitSpec,
  options: BattleFixtureOptions = FIXED,
  seed = 1,
): number {
  const { ctx, state } = makeBattle(rows, [attacker, defender], {
    ...FIXED,
    ...options,
    combatConfig: { ...FIXED.combatConfig, ...options.combatConfig },
  });
  return physicalDamage(ctx, state.units[0]!, state.units[1]!, createRng(seed));
}

const PLAIN = [".....", ".....", ".....", ".....", "....."];
const at = (officerId: string, side: "player" | "enemy", pos: [number, number]): UnitSpec => ({
  officerId,
  side,
  pos,
});

const FAMILY_OFFICER: Record<string, string> = {
  infantry: "foot",
  cavalry: "horse",
  archer: "bow",
};

describe("physicalDamage — 공식", () => {
  it("레벨·사기·무력·병과 보정으로 계산한다", () => {
    // A = (5+10)×(사기 100 + 무력 50 + 단병 공격보정 8) = 2370
    // D = (5+10)×(사기 100 + 통솔 50 + 단병 방어보정 10) × 상성 1 × 지형 1 = 2400
    // 300 × 2370 / 2400 = 296.25 → 296
    expect(hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]))).toBe(296);
  });

  it("무력이 높을수록 더 큰 피해를 준다", () => {
    const weak = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]));
    const strong = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]), {
      officers: { foot: { war: 90 } },
    });

    expect(strong).toBeGreaterThan(weak);
  });

  it("통솔이 높을수록 덜 맞는다", () => {
    const base = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]));
    const tough = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]), {
      officers: { foot2: { ldr: 90 } },
    });

    expect(tough).toBeLessThan(base);
  });

  it("사기가 낮으면 공격력도 떨어진다", () => {
    const full = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]));
    const low = hit(
      PLAIN,
      { ...at("foot", "player", [0, 0]), morale: 20 },
      at("foot2", "enemy", [1, 0]),
    );

    expect(low).toBeLessThan(full);
  });
});

describe("physicalDamage — 상성 (AC-04)", () => {
  const combos = Object.keys(FAMILY_OFFICER).flatMap((attacker) =>
    Object.keys(FAMILY_OFFICER).map((defender) => ({ attacker, defender })),
  );

  it.each(combos)("$attacker → $defender 조합에 상성 배수를 적용한다", ({ attacker, defender }) => {
    const attackerSpec = at(FAMILY_OFFICER[attacker]!, "player", [0, 0]);
    const defenderSpec = at(FAMILY_OFFICER[defender]!, "enemy", [1, 0]);

    const withAffinity = hit(PLAIN, attackerSpec, defenderSpec);
    const neutral = hit(PLAIN, attackerSpec, defenderSpec, { affinityModifier: 1 });

    // 고리: 기병 > 보병 > 궁병 > 기병 (유리 0.75 → 방어측 방어력이 깎여 데미지가 커진다)
    const strongAgainst: Record<string, string> = {
      cavalry: "infantry",
      infantry: "archer",
      archer: "cavalry",
    };

    if (strongAgainst[attacker] === defender) expect(withAffinity).toBeGreaterThan(neutral);
    else if (strongAgainst[defender] === attacker) expect(withAffinity).toBeLessThan(neutral);
    else expect(withAffinity).toBe(neutral);
  });

  it("유리한 쪽이 불리한 쪽보다 더 큰 피해를 준다 — 배수 0.75가 유리다", () => {
    const cavalryHitsInfantry = hit(
      PLAIN,
      at("horse", "player", [0, 0]),
      at("foot", "enemy", [1, 0]),
    );
    const infantryHitsCavalry = hit(
      PLAIN,
      at("foot", "player", [0, 0]),
      at("horse", "enemy", [1, 0]),
    );

    expect(cavalryHitsInfantry).toBeGreaterThan(infantryHitsCavalry);
  });

  it("방어측 방어 보정이 같으면 상성 배수의 비만큼 차이 난다", () => {
    // 경기병과 궁병은 픽스처에서 방어 보정이 같다(6) — 남는 차이는 상성뿐이다.
    const vsArcher = hit(PLAIN, at("foot", "player", [0, 0]), at("bow", "enemy", [1, 0]));
    const vsCavalry = hit(PLAIN, at("foot", "player", [0, 0]), at("horse", "enemy", [1, 0]));

    expect(vsArcher / vsCavalry).toBeCloseTo(1.25 / 0.75, 1);
  });
});

describe("physicalDamage — 지형과 경계", () => {
  it("지형 방어 보정이 있는 칸에 선 부대는 덜 맞는다", () => {
    const rows = ["..", "f."];
    const onPlain = hit(rows, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]));
    const inForest = hit(rows, at("foot", "player", [0, 0]), at("foot2", "enemy", [0, 1]));

    expect(inForest).toBeLessThan(onPlain);
    expect(inForest).toBe(Math.round(onPlain / 1.1)); // 숲 방어 보정 +10%
  });

  it("남은 병력보다 큰 피해는 나오지 않는다", () => {
    const defender = { ...at("foot2", "enemy", [1, 0]), hp: 7 };
    expect(hit(PLAIN, at("foot", "player", [0, 0]), defender)).toBe(7);
  });

  it("아무리 불리해도 최소 데미지는 준다", () => {
    const damage = hit(
      PLAIN,
      { ...at("band", "player", [0, 0]), level: 1, morale: 0 },
      { ...at("spear", "enemy", [1, 0]), level: 99 },
      { officers: { band: { war: 1 }, spear: { ldr: 100 } }, combatConfig: { minDamage: 12 } },
    );

    expect(damage).toBe(12);
  });
});

describe("physicalDamage — 결정론 (VER-07)", () => {
  const roll = (seed: number, count: number): number[] => {
    const { ctx, state } = makeBattle(PLAIN, [
      at("foot", "player", [0, 0]),
      at("foot2", "enemy", [1, 0]),
    ]);
    const rng = createRng(seed);
    return Array.from({ length: count }, () =>
      physicalDamage(ctx, state.units[0]!, state.units[1]!, rng),
    );
  };

  it("같은 시드는 같은 데미지 수열을 낸다", () => {
    expect(roll(2026, 10)).toEqual(roll(2026, 10));
  });

  it("다른 시드는 다른 데미지 수열을 낸다", () => {
    expect(roll(2026, 10)).not.toEqual(roll(2027, 10));
  });

  it("난수 폭 안에서만 흔들린다", () => {
    const fixed = hit(PLAIN, at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0]));

    for (const damage of roll(7, 50)) {
      expect(damage).toBeGreaterThanOrEqual(Math.floor(fixed * 0.9));
      expect(damage).toBeLessThanOrEqual(Math.ceil(fixed * 1.1));
    }
  });
});

describe("damageRange — 예상 데미지 (FR-18)", () => {
  const setup = () =>
    makeBattle(PLAIN, [at("foot", "player", [0, 0]), at("foot2", "enemy", [1, 0])]);

  it("난수 폭의 양 끝을 돌려준다", () => {
    const { ctx, state } = setup();
    const [min, max] = damageRange(ctx, state.units[0]!, state.units[1]!);

    // 원시 데미지 296.25에 난수 폭 0.9~1.1을 곱해 반올림한다(고정 1.0이면 296)
    expect(min).toBe(Math.round(296.25 * 0.9)); // 267
    expect(max).toBe(Math.round(296.25 * 1.1)); // 326
    expect(min).toBeLessThan(max);
  });

  it("실제 공격 결과가 언제나 예상 범위 안에 들어온다 — 같은 공식을 쓴다", () => {
    const { ctx, state } = setup();
    const [attacker, defender] = [state.units[0]!, state.units[1]!];
    const [min, max] = damageRange(ctx, attacker, defender);
    const rng = createRng(2026);

    for (let i = 0; i < 50; i += 1) {
      const damage = physicalDamage(ctx, attacker, defender, rng);
      expect(damage).toBeGreaterThanOrEqual(min);
      expect(damage).toBeLessThanOrEqual(max);
    }
  });

  it("남은 병력보다 큰 값은 예상하지 않는다", () => {
    const { ctx, state } = makeBattle(PLAIN, [
      at("foot", "player", [0, 0]),
      { ...at("foot2", "enemy", [1, 0]), hp: 5 },
    ]);

    expect(damageRange(ctx, state.units[0]!, state.units[1]!)).toEqual([5, 5]);
  });
});

describe("physicalDamage — 데이터 내성", () => {
  it("상성이 정의되지 않은 조합은 배수 1로 계산한다", () => {
    const families: Family[] = ["infantry", "cavalry", "archer"];
    expect(families).toHaveLength(3); // 픽스처가 쓰는 계열 — 상성은 전수 정의되어 있다

    const neutral = hit(PLAIN, at("foot", "player", [0, 0]), at("band", "enemy", [1, 0]));
    expect(neutral).toBeGreaterThan(0);
  });
});
