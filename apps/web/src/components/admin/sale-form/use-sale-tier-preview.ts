"use client";

import {
  type AdminSaleFormValues,
  buyerPremiumBandProblem,
  buyerPremiumPayloadFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import type { BuyerPremiumSchedule } from "@auction/types";
import { buyerPremiumWorkedExample, describeBuyerPremium } from "@auction/validators";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

/** The hammer the worked example uses: past the standard band edge, so both rates show. */
export const PREMIUM_EXAMPLE_HAMMER_MINOR = 60_000_000;

export type SaleTierBandPreview =
  | {
      ok: false;
      /** Why there is no example yet: a custom band is half-filled, or the premium does not parse. */
      reason?: "incomplete";
    }
  | {
      ok: true;
      /** "15% up to £500,000, then 10% on the part above". */
      terms: string;
      /** "On a £600,000 hammer the buyer's premium is £85,000." */
      example: string;
    };

/** The premium the form's choice would charge, in words and as a worked example. */
export function saleBuyerPremiumPreview(
  values: Pick<AdminSaleFormValues, "buyerPremiumMode" | "buyerPremiumRate" | "buyerPremiumTiers">,
): SaleTierBandPreview {
  // Half-filled bands are left out of what is saved, so an example from the rest would mislead.
  if (
    values.buyerPremiumMode === "bands" &&
    values.buyerPremiumTiers.some((row, index) => buyerPremiumBandProblem(row, index) !== null)
  ) {
    return { ok: false, reason: "incomplete" };
  }
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
  // The watched rows can be the same array mutated in place, so the memo keys on their content.
  const tiersKey = JSON.stringify(tiers ?? []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the rows' content (tiersKey).
  return useMemo(
    () =>
      saleBuyerPremiumPreview({
        buyerPremiumMode: mode,
        buyerPremiumRate: rate,
        buyerPremiumTiers: tiers,
      }),
    [mode, rate, tiersKey],
  );
}
