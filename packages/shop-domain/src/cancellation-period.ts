import type { ShopFulfilmentOption } from "./fulfilment-options.js";

export type CancellationPeriodPolicy = {
  /** Days after possession when the buyer cancellation period ends. */
  daysAfterPossession: number;
  /** When true, personalised goods skip the cancellation period (legal config). */
  personalisedGoodsExempt: boolean;
};

export type CancellationPeriodInput = {
  fulfilmentOption: ShopFulfilmentOption;
  possessionAt: Date | null;
  policy: CancellationPeriodPolicy | null;
  isPersonalisedGoods: boolean;
};

export type CancellationPeriodResult =
  | { ok: true; endsAt: Date | null; pendingPossession: boolean }
  | { ok: false; reason: "policy_not_configured" };

export function computeCancellationPeriodEndsAt(
  input: CancellationPeriodInput,
): CancellationPeriodResult {
  if (input.policy === null) {
    return { ok: false, reason: "policy_not_configured" };
  }
  if (input.isPersonalisedGoods && input.policy.personalisedGoodsExempt) {
    return { ok: true, endsAt: null, pendingPossession: false };
  }
  if (input.possessionAt === null) {
    return { ok: true, endsAt: null, pendingPossession: true };
  }
  const endsAt = new Date(input.possessionAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + input.policy.daysAfterPossession);
  void input.fulfilmentOption;
  return { ok: true, endsAt, pendingPossession: false };
}
