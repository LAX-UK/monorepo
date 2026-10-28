import { type AdminStockBatchBody, STOCK_BATCH_MAX } from "@auction/shop-contracts";
import { proposedBatch, stockRefLabel } from "./edition-run-form";

/*
 * The "Add prints" dialog of an open edition: how many, how they split between the artist and
 * LAX (proposed from the run's default split, changeable), whether they are printed yet, and
 * where printed stock is kept.
 */

export type StockBatchFormValues = {
  quantityText: string;
  artistText: string;
  laxText: string;
  /** False until staff change a count by hand; until then the split follows the quantity. */
  splitEdited: boolean;
  custody: "unprinted" | "stored";
  storageLocation: string;
};

export type StockBatchField = "quantity" | "split" | "storageLocation";

function whole(value: string): number | null {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function emptyStockBatchForm(defaultArtistPct: number): StockBatchFormValues {
  return withQuantity(
    {
      quantityText: "",
      artistText: "",
      laxText: "",
      splitEdited: false,
      custody: "unprinted",
      storageLocation: "",
    },
    "10",
    defaultArtistPct,
  );
}

/** Typing how many re-proposes the split from the default until staff change it themselves. */
export function withQuantity(
  values: StockBatchFormValues,
  quantityText: string,
  defaultArtistPct: number,
): StockBatchFormValues {
  const quantity = whole(quantityText);
  if (values.splitEdited || quantity === null) return { ...values, quantityText };
  const split = proposedBatch(quantity, { artistPct: defaultArtistPct });
  return { ...values, quantityText, artistText: String(split.artist), laxText: String(split.lax) };
}

export function validateStockBatchForm(
  values: StockBatchFormValues,
): Partial<Record<StockBatchField, string>> {
  const errors: Partial<Record<StockBatchField, string>> = {};
  const quantity = whole(values.quantityText);
  if (quantity === null || quantity < 1 || quantity > STOCK_BATCH_MAX) {
    errors.quantity = `Enter how many prints, 1 to ${STOCK_BATCH_MAX}`;
  } else {
    const artist = whole(values.artistText);
    const lax = whole(values.laxText);
    if (artist === null || lax === null) {
      errors.split = "Enter whole numbers for the artist and LAX";
    } else if (artist + lax !== quantity) {
      errors.split = `The artist's and LAX's prints must add up to ${quantity}`;
    }
  }
  if (values.custody === "stored" && !values.storageLocation.trim()) {
    errors.storageLocation = "Say where the printed stock is stored";
  }
  return errors;
}

export function stockBatchBody(values: StockBatchFormValues): AdminStockBatchBody {
  return {
    artistCount: whole(values.artistText) ?? 0,
    laxCount: whole(values.laxText) ?? 0,
    custody: values.custody,
    ...(values.custody === "stored" ? { storageLocation: values.storageLocation.trim() } : {}),
  };
}

/** "Creates OE-0041 to OE-0050. LAX prints go on sale now; the artist's go on sale when they offer them." */
export function stockBatchOutcome(
  values: StockBatchFormValues,
  nextStockRef: number,
): string | null {
  const quantity = whole(values.quantityText);
  if (quantity === null || quantity < 1) return null;
  const range =
    quantity === 1
      ? stockRefLabel(nextStockRef)
      : `${stockRefLabel(nextStockRef)} to ${stockRefLabel(nextStockRef + quantity - 1)}`;
  return `Creates ${range}. LAX prints go on sale now; the artist's go on sale when they offer them.`;
}

/** "Add 10 prints", the dialog's confirm button. */
export function addPrintsLabel(values: StockBatchFormValues): string {
  const quantity = whole(values.quantityText);
  if (quantity === null || quantity < 1) return "Add prints";
  return quantity === 1 ? "Add 1 print" : `Add ${quantity} prints`;
}
