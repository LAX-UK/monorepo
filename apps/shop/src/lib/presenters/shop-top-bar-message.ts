import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";

/** "£15", or "£15.50" when the amount has pence. */
function poundsLabel(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

/**
 * The note on the right of Shop's LAX top bar, built from the surcharges checkout charges so the
 * bar and checkout never disagree: "Free collection from our Marylebone gallery · Insured UK
 * delivery £15".
 */
export function shopTopBarMessage(): string {
  const collection = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  const delivery = FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery;
  const collect =
    collection === 0
      ? "Free collection from our Marylebone gallery"
      : `Collection from our Marylebone gallery ${poundsLabel(collection)}`;
  return `${collect} · Insured UK delivery ${poundsLabel(delivery)}`;
}
