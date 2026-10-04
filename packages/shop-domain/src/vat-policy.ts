export type VatPolicy = {
  standardRateBp: number;
};

export type LineVatInput = {
  unitPricePence: number;
  quantity?: number;
};

export type LineVatResult =
  | { ok: true; vatTreatment: "standard"; vatRateBp: number; vatPence: number }
  | { ok: false; reason: "policy_not_configured" };

export function computeLineVat(policy: VatPolicy | null, input: LineVatInput): LineVatResult {
  if (!policy || policy.standardRateBp <= 0) {
    return { ok: false, reason: "policy_not_configured" };
  }
  const qty = input.quantity ?? 1;
  const net = input.unitPricePence * qty;
  const vatPence = Math.round((net * policy.standardRateBp) / 10_000);
  return {
    ok: true,
    vatTreatment: "standard",
    vatRateBp: policy.standardRateBp,
    vatPence,
  };
}
