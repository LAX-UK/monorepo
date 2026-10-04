export type PossessionBoundsResult =
  | { ok: true }
  | { ok: false; reason: "before_paid" | "in_future" };

export function validatePossessionTimestamp(input: {
  paidAt: Date;
  possessionAt: Date;
  now: Date;
}): PossessionBoundsResult {
  if (input.possessionAt.getTime() < input.paidAt.getTime()) {
    return { ok: false, reason: "before_paid" };
  }
  if (input.possessionAt.getTime() > input.now.getTime()) {
    return { ok: false, reason: "in_future" };
  }
  return { ok: true };
}
