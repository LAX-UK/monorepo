import type { AdminOfferAtAuctionBody } from "@auction/shop-contracts";

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

export function validateOfferAtAuctionForm(
  form: OfferAtAuctionForm,
): Partial<Record<OfferAtAuctionField, string>> {
  const errors: Partial<Record<OfferAtAuctionField, string>> = {};
  if (!form.saleId) errors.saleId = "Choose a sale";
  if (form.priceText.trim() === "") errors.price = "Enter a starting price";
  else if (startingPriceText(form.priceText) === null) {
    errors.price = "Enter a price above £0, such as 250 or 250.00";
  }
  if (!form.consignorAgreed) errors.consignorAgreed = "Confirm the consignor agreed";
  return errors;
}

/** The request body for a form that passed validation. */
export function offerAtAuctionBody(form: OfferAtAuctionForm): AdminOfferAtAuctionBody | null {
  const startingPrice = startingPriceText(form.priceText);
  if (!form.saleId || !startingPrice || !form.consignorAgreed) return null;
  return { saleId: form.saleId, startingPrice, consignorAgreed: true };
}

/** "Starts 1 Dec 2026, 10:00": how a sale reads in the chooser. */
export function saleOptionLabel(title: string, startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return title;
  const when = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
  return `${title} · ${when}`;
}
