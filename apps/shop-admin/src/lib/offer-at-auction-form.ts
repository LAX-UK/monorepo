import type { AdminOfferAtAuctionBody } from "@auction/shop-contracts";
import { formatStaffDate } from "@auction/staff-ui";

export type OfferAtAuctionForm = {
  saleId: string | null;
  /** The starting price as typed, in pounds. */
  priceText: string;
  consignorAgreed: boolean;
};

export type OfferAtAuctionField = "saleId" | "price" | "consignorAgreed";

export const emptyOfferAtAuctionForm = (): OfferAtAuctionForm => ({
  saleId: null,
  priceText: "",
  consignorAgreed: false,
});

/** Pounds as typed ("250", "1,250.5") to the two-decimal text LAX Bid takes, or null when invalid. */
export function startingPriceText(priceText: string): string | null {
  const cleaned = priceText.replace(/[£,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value.toFixed(2) : null;
}

/**
 * Whether the move still asks for the "The consignor agreed" checkbox: only while a work with no
 * consignor set falls back to it (ZI-5, owner decision Q2). A recorded agreement decides otherwise.
 */
export type OfferAtAuctionRules = { needsCheckbox: boolean };

export function validateOfferAtAuctionForm(
  form: OfferAtAuctionForm,
  rules: OfferAtAuctionRules,
): Partial<Record<OfferAtAuctionField, string>> {
  const errors: Partial<Record<OfferAtAuctionField, string>> = {};
  if (!form.saleId) errors.saleId = "Choose a sale";
  if (form.priceText.trim() === "") errors.price = "Enter a starting price";
  else if (startingPriceText(form.priceText) === null) {
    errors.price = "Enter a price above £0, such as 250 or 250.00";
  }
  if (rules.needsCheckbox && !form.consignorAgreed)
    errors.consignorAgreed = "Confirm the consignor agreed";
  return errors;
}

/** The request body for a form that passed validation. */
export function offerAtAuctionBody(
  form: OfferAtAuctionForm,
  rules: OfferAtAuctionRules,
): AdminOfferAtAuctionBody | null {
  const startingPrice = startingPriceText(form.priceText);
  if (!form.saleId || !startingPrice) return null;
  if (!rules.needsCheckbox) return { saleId: form.saleId, startingPrice };
  return form.consignorAgreed
    ? { saleId: form.saleId, startingPrice, consignorAgreed: true }
    : null;
}

/** Each field's control, for the error summary's links. */
export const OFFER_AT_AUCTION_FIELD_IDS: Record<OfferAtAuctionField, string> = {
  saleId: "offer-sale",
  price: "offer-price",
  consignorAgreed: "offer-consignor-agreed",
};

/**
 * The summary above the form: shown only when two or more fields are wrong; a single error is
 * shown on its field alone.
 */
export function offerAtAuctionErrorSummary(
  errors: Partial<Record<OfferAtAuctionField, string>>,
): Array<{ fieldId: string; message: string }> {
  const list = (["saleId", "price", "consignorAgreed"] as const).flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: OFFER_AT_AUCTION_FIELD_IDS[field], message }] : [];
  });
  return list.length >= 2 ? list : [];
}

/** The starting price as typed, in pence; null while it is not a valid amount. */
export function startingPricePence(priceText: string): number | null {
  const text = startingPriceText(priceText);
  return text === null ? null : Math.round(Number(text) * 100);
}

/** "Starts 1 Dec 2026, 10:00": how a sale reads in the chooser. */
export function saleOptionLabel(title: string, startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return title;
  return `${title} · ${formatStaffDate(date)}`;
}
