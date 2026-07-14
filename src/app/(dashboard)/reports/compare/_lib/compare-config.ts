// Named configuration constants for the comparison view's mover filtering and
// dimming rules. These apply independently per hierarchy level.
export const COMPARE_CONFIG = {
  // Dimming threshold: a row is dimmed when BOTH conditions are true:
  // |Δ| < TRIVIAL_AMOUNT_CENTS AND |Δ%| < TRIVIAL_PCT
  // Otherwise it stays bright (notable on at least one axis).
  TRIVIAL_AMOUNT_CENTS: 2500, // $25.00 in cents
  TRIVIAL_PCT: 15, // 15%
} as const;
