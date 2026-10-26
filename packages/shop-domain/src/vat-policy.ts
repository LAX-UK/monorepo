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

/** A line as sold: the VAT stored with it and the rate it was charged at. */
export type OrderVatLine = { vatPence: number | null; vatRateBp: number | null };

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
 * The VAT an order's delivery charge includes. Delivery is part of the same supply as the goods,
 * so it carries their rate; with lines at different rates, or none, it is recorded as unknown.
 */
export function deliveryVatPence(input: {
  lineRatesBp: readonly (number | null)[];
  deliveryPence: number;
}): number | null {
  const rates = new Set(input.lineRatesBp);
  const [rate] = [...rates];
  if (rates.size !== 1 || rate === null || rate === undefined || rate <= 0) return null;
  return vatIncludedIn(input.deliveryPence, rate);
}

/**
 * The VAT included in an order, as stored when it was sold: each line's VAT plus the delivery
 * charge's. Null when a line or the delivery has no stored VAT, which means the order was sold
 * with no VAT policy configured and there is no VAT figure to show.
 */
export function orderVatBreakdown(input: {
  lines: readonly OrderVatLine[];
  deliveryVatPence: number | null;
  totalPence: number;
}): OrderVatBreakdown | null {
  if (input.lines.length === 0 || input.deliveryVatPence === null) return null;
  if (input.lines.some((line) => line.vatPence === null || !line.vatRateBp)) return null;
  const rates = new Set(input.lines.map((line) => line.vatRateBp));
  const rateBp = rates.size === 1 ? (input.lines[0]?.vatRateBp ?? null) : null;
  const goodsVatPence = input.lines.reduce((sum, line) => sum + (line.vatPence ?? 0), 0);
  const vatPence = goodsVatPence + input.deliveryVatPence;
  return {
    rateBp,
    goodsVatPence,
    deliveryVatPence: input.deliveryVatPence,
    vatPence,
    netPence: input.totalPence - vatPence,
  };
}
