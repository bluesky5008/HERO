import { z } from "zod";

/**
 * 결정론적 난수원([ADR-003], DES-04).
 * 코어 안에서는 `Math.random()`을 쓰지 않고 이 인터페이스만 주입해 쓴다 —
 * 그래야 세이브 복원과 테스트가 같은 수열을 재현한다(NFR-01).
 */

export const RNG_ALGO = "xoshiro128ss";

const uint32 = z.number().int().min(0).max(0xffffffff);

/** 세이브 포맷의 `rng` 필드(상세 스펙 §2.3). 세이브 파일은 사용자가 고칠 수 있으므로 복원 시 검사한다. */
export const RngStateSchema = z.object({
  algo: z.literal(RNG_ALGO),
  state: z
    .tuple([uint32, uint32, uint32, uint32])
    .refine((words) => words.some((word) => word !== 0), {
      message: "xoshiro는 상태가 전부 0이면 0만 내놓는다",
    }),
});
export type RngState = z.infer<typeof RngStateSchema>;

export interface Rng {
  /** [min, max) 균등 실수. min === max이면 그 값. */
  range(min: number, max: number): number;
  /** 현재 상태의 스냅숏 — 이후 소비의 영향을 받지 않는다. */
  save(): RngState;
}

const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));

function xoshiro128ss(seed: RngState["state"]): Rng {
  let [s0, s1, s2, s3] = seed;

  /** xoshiro128** 한 걸음. 32bit 부호 없는 정수를 낸다. */
  const next = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    return result;
  };

  return {
    range: (min, max) => min + (max - min) * (next() / 0x1_0000_0000),
    save: () => ({ algo: RNG_ALGO, state: [s0, s1, s2, s3] }),
  };
}

/** 32bit 시드 하나를 128bit 상태로 펼친다(splitmix32) — 시드 0도 편향되지 않게. */
function expandSeed(seed: number): RngState["state"] {
  let a = seed | 0;
  const nextWord = (): number => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
  return [nextWord(), nextWord(), nextWord(), nextWord()];
}

export function createRng(seed: number): Rng {
  return xoshiro128ss(expandSeed(seed));
}

/** 세이브에서 읽은 상태를 복원한다. 알고리즘·상태가 어긋나면 조용히 넘기지 않고 던진다. */
export function restoreRng(state: unknown): Rng {
  return xoshiro128ss(RngStateSchema.parse(state).state);
}
