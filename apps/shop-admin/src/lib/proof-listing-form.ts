import type { AdminProofListingBody, AdminProofType } from "@auction/shop-contracts";
import { defaultProofOwner } from "@auction/shop-domain";
import { parseArtworkPrice } from "./artwork-form";

/*
 * "Create proof listing": which proofs, how many (up to those kept and not yet listed), who owns
 * them, the price, and for hors commerce proofs the shop admin's approval.
 */

export type ProofListingValues = {
  proofType: AdminProofType | null;
  countText: string;
  owner: "artist" | "lax";
  priceText: string;
  horsCommerceApproved: boolean;
};

export type ProofListingField = "proofType" | "count" | "price" | "approval";

export function emptyProofListingForm(): ProofListingValues {
  return {
    proofType: null,
    countText: "",
    owner: "artist",
    priceText: "",
    horsCommerceApproved: false,
  };
}

/** Choosing a type proposes all of its proofs and its usual owner (artist for AP, LAX for PP). */
export function withProofType(
  values: ProofListingValues,
  proofType: AdminProofType,
  available: Record<AdminProofType, number>,
): ProofListingValues {
  return {
    ...values,
    proofType,
    countText: String(available[proofType]),
    owner: defaultProofOwner(proofType),
    horsCommerceApproved: false,
  };
}

export function validateProofListingForm(
  values: ProofListingValues,
  available: Record<AdminProofType, number>,
  context: { canSetPrice: boolean },
): Partial<Record<ProofListingField, string>> {
  const errors: Partial<Record<ProofListingField, string>> = {};
  if (!values.proofType) {
    errors.proofType = "Choose which proofs to list";
    return errors;
  }
  const most = available[values.proofType];
  const count = /^\d+$/.test(values.countText.trim()) ? Number(values.countText.trim()) : null;
  if (count === null || count < 1 || count > most) {
    errors.count =
      most === 1
        ? "List the 1 proof kept"
        : `List 1 to ${most}, the proofs kept and not yet listed`;
  }
  if (context.canSetPrice) {
    const price = parseArtworkPrice(values.priceText);
    if (!price.ok) errors.price = price.message;
  }
  if (values.proofType === "hc" && !values.horsCommerceApproved) {
    errors.approval = "Approve listing a hors commerce proof, or choose another type";
  }
  return errors;
}

export function proofListingBody(
  values: ProofListingValues,
  context: { canSetPrice: boolean },
): AdminProofListingBody {
  const price = context.canSetPrice ? parseArtworkPrice(values.priceText) : null;
  return {
    proofType: values.proofType ?? "ap",
    count: Number(values.countText.trim()),
    owner: values.owner,
    ...(price?.ok && price.pence !== null ? { printPricePence: price.pence } : {}),
    ...(values.proofType === "hc" ? { horsCommerceApproved: values.horsCommerceApproved } : {}),
  };
}
