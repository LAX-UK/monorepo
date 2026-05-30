"use client";

import { normalizeAdminFormTiersToApi } from "@/lib/forms/schemas/admin-sale-form";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

export type SaleTierBandPreview =
  | { ok: false }
  | {
      ok: true;
      kind: "tiered" | "flat";
      at250k: { hammer: string; premium: string };
      at600k: { hammer: string; premium: string };
    };

export function useSaleTierBandPreview(
  form: UseFormReturn<AdminSaleFormValues>,
): SaleTierBandPreview {
  const tierRowsWatch = form.watch("buyerPremiumTiers");
  const buyerPremiumRateWatch = form.watch("buyerPremiumRate");

  return useMemo(() => {
    const parsed = normalizeAdminFormTiersToApi(tierRowsWatch);
    if (!parsed.ok) return { ok: false as const };
    const policy = buildBuyerPremiumPolicy({
      saleTiers: parsed.data,
      lotRate: buyerPremiumRateWatch.trim() || "0.25",
    });
    const exLow = "250000";
    const exHigh = "600000";
    const kind = parsed.data && parsed.data.length > 0 ? ("tiered" as const) : ("flat" as const);
    return {
      ok: true as const,
      kind,
      at250k: { hammer: exLow, premium: policy.computePremiumMajor(exLow) },
      at600k: { hammer: exHigh, premium: policy.computePremiumMajor(exHigh) },
    };
  }, [tierRowsWatch, buyerPremiumRateWatch]);
}
