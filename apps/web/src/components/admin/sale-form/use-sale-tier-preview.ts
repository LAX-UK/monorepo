"use client";

import {
  type AdminSaleFormValues,
  buyerPremiumPayloadFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import type { BuyerPremiumSchedule } from "@auction/types";
import { buyerPremiumWorkedExample, describeBuyerPremium } from "@auction/validators";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

/** The hammer the worked example uses: past the standard band edge, so both rates show. */
export const PREMIUM_EXAMPLE_HAMMER_MINOR = 60_000_000;

export type SaleTierBandPreview =
  | { ok: false }
  | {
      ok: true;
      /** "15% up to £500,000, then 10% on the part above". */
      terms: string;
      /** "On a £600,000 hammer the buyer pays £85,000 premium". */
      example: string;
    };

/** The premium the form's choice would charge, in words and as a worked example. */
export function saleBuyerPremiumPreview(
  values: Pick<AdminSaleFormValues, "buyerPremiumMode" | "buyerPremiumRate" | "buyerPremiumTiers">,
): SaleTierBandPreview {
  const payload = buyerPremiumPayloadFromForm(values);
  if (!payload.ok) return { ok: false };
  const { buyerPremiumRate, buyerPremiumTiers } = payload.data;
  let schedule: BuyerPremiumSchedule;
  if (buyerPremiumTiers && buyerPremiumTiers.length > 0) {
    schedule = { kind: "bands", bands: buyerPremiumTiers };
  } else if (buyerPremiumRate) {
    schedule = { kind: "flat", rate: buyerPremiumRate };
  } else {
    return { ok: false };
  }
  return {
    ok: true,
    terms: describeBuyerPremium(schedule),
    example: buyerPremiumWorkedExample(schedule, PREMIUM_EXAMPLE_HAMMER_MINOR),
  };
}

export function useSaleTierBandPreview(
  form: UseFormReturn<AdminSaleFormValues>,
): SaleTierBandPreview {
  const mode = form.watch("buyerPremiumMode");
  const rate = form.watch("buyerPremiumRate");
  const tiers = form.watch("buyerPremiumTiers");
  return useMemo(
    () =>
      saleBuyerPremiumPreview({
        buyerPremiumMode: mode,
        buyerPremiumRate: rate,
        buyerPremiumTiers: tiers,
      }),
    [mode, rate, tiers],
  );
}
