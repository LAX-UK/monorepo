export type VatPolicy = {
  standardRateBp: number;
};

export type LineVatInput = {
  /** What the shopper pays for one unit. Shop prices include VAT. */
  unitPricePence: number;
  quantity?: number;
};

export type LineVatResult =
  | { ok: true; vatTreatment: "standard"; vatRateBp: number; vatPence: number }
  | { ok: false; reason: "policy_not_configured" };

/** The VAT inside a VAT-inclusive amount: £120.00 at 20% includes £20.00. */
export function vatIncludedIn(grossPence: number, rateBp: number): number {
  if (rateBp <= 0 || grossPence <= 0) return 0;
  return Math.round((grossPence * rateBp) / (10_000 + rateBp));
}

/** The VAT a line's VAT-inclusive price contains, at the configured standard rate. */
export function computeLineVat(policy: VatPolicy | null, input: LineVatInput): LineVatResult {
  if (!policy || policy.standardRateBp <= 0) {
    return { ok: false, reason: "policy_not_configured" };
  }
  const qty = input.quantity ?? 1;
  const gross = input.unitPricePence * qty;
  return {
    ok: true,
    vatTreatment: "standard",
    vatRateBp: policy.standardRateBp,
    vatPence: vatIncludedIn(gross, policy.standardRateBp),
  };
}

export type OrderVatLine = { grossPence: number; vatRateBp: number | null };

export type OrderVatBreakdown = {
  /** The single rate every line was charged at; null when lines differ. */
  rateBp: number | null;
  /** VAT included in the goods. */
  goodsVatPence: number;
  /** VAT included in the delivery charge. */
  deliveryVatPence: number;
  /** Everything above: the VAT included in the order total. */
  vatPence: number;
  /** The order total without VAT. */
  netPence: number;
};

/**
 * The VAT included in an order, from the rate recorded on each line when it was sold. Delivery is
 * part of the same supply as the goods, so it carries their rate; with lines at different rates it
 * is left without VAT rather than guessed. Null when no line recorded a rate, which means the order
 * was sold with no VAT policy configured and there is no VAT figure to show.
 */
export function orderVatBreakdown(input: {
  lines: readonly OrderVatLine[];
  deliveryPence: number;
}): OrderVatBreakdown | null {
  const rated = input.lines.filter(
    (line): line is { grossPence: number; vatRateBp: number } =>
      line.vatRateBp !== null && line.vatRateBp > 0,
  );
  if (rated.length === 0 || rated.length !== input.lines.length) return null;
  const rates = new Set(rated.map((line) => line.vatRateBp));
  const rateBp = rates.size === 1 ? (rated[0]?.vatRateBp ?? null) : null;
  const goodsVatPence = rated.reduce(
    (sum, line) => sum + vatIncludedIn(line.grossPence, line.vatRateBp),
    0,
  );
  const deliveryVatPence = rateBp === null ? 0 : vatIncludedIn(input.deliveryPence, rateBp);
  const gross = rated.reduce((sum, line) => sum + line.grossPence, 0) + input.deliveryPence;
  const vatPence = goodsVatPence + deliveryVatPence;
  return { rateBp, goodsVatPence, deliveryVatPence, vatPence, netPence: gross - vatPence };
}
