// lib/time.ts
export const CONFIG = {
  ROUND_DURATION_SEC: 300,     // 5:00
  WRONG_PENALTY_SEC: 30,       // -30s per fel
  INPUT_COOLDOWN_SEC: 3        // 3s cooldown efter fel
};

export function computeTimeLeft(
  now: number,
  startedAt: number,
  penaltiesSec: number
) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const left = CONFIG.ROUND_DURATION_SEC - elapsed - penaltiesSec;
  return Math.max(0, left);
}
