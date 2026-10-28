import {
  type AdminEditionRunSpec,
  type AdminMainRunInput,
  type AdminProofsKept,
  type AdminStockBatchInput,
  EDITION_RUN_MAX_SIZE,
  EDITION_RUN_MIN_SIZE,
  STOCK_BATCH_MAX,
} from "@auction/shop-contracts";
import {
  LAX_STANDARD_ALLOCATION,
  SHOP_EDITION_COUNT,
  allocationNumbering,
  defaultCustomAllocation,
} from "@auction/shop-domain";

/*
 * The run step of the create flow and the editor's run section: which run, the allocation of a
 * custom run, the default split and first batch of an open edition, and the proofs kept. Kept
 * apart from the components so the rules and wording are tested without rendering. Numbers are
 * held as typed text and read on validation.
 */

export const RUN_TEMPLATES = ["lax_standard", "custom_limited", "open"] as const;
export type RunTemplate = (typeof RUN_TEMPLATES)[number];

export type AllocationText = { buyer: string; artist: string; lax: string };
export type ProofsKeptText = { ap: string; pp: string; hc: string; bat: string };

export type RunFormValues = {
  template: RunTemplate;
  sizeText: string;
  allocation: AllocationText;
  /** The artist's share of new open edition stock, in percent; LAX holds the rest. */
  openArtistPctText: string;
  /** Open editions: the prints to start with. Blank adds none yet. */
  firstBatchText: string;
  firstBatchCustody: "unprinted" | "stored";
  firstBatchLocation: string;
  proofsKept: ProofsKeptText;
};

export const RUN_FORM_FIELDS = [
  "template",
  "size",
  "allocation",
  "original",
  "openSplit",
  "firstBatch",
  "firstBatchLocation",
  "proofsKept",
] as const;
export type RunFormField = (typeof RUN_FORM_FIELDS)[number];

export function runFieldId(field: RunFormField): string {
  return `run-${field}`;
}

const text = (value: number) => String(value);

function allocationText(allocation: { buyer: number; artist: number; lax: number }) {
  return {
    buyer: text(allocation.buyer),
    artist: text(allocation.artist),
    lax: text(allocation.lax),
  };
}

const NO_PROOFS: ProofsKeptText = { ap: "", pp: "", hc: "", bat: "" };

/** LAX standard is the default; switching to custom starts from the standard split. */
export function emptyRunForm(): RunFormValues {
  return {
    template: "lax_standard",
    sizeText: text(SHOP_EDITION_COUNT),
    allocation: allocationText(LAX_STANDARD_ALLOCATION),
    openArtistPctText: "50",
    firstBatchText: "",
    firstBatchCustody: "unprinted",
    firstBatchLocation: "",
    proofsKept: { ...NO_PROOFS },
  };
}

function proofsText(kept: AdminProofsKept): ProofsKeptText {
  const show = (value: number) => (value > 0 ? text(value) : "");
  return { ap: show(kept.ap), pp: show(kept.pp), hc: show(kept.hc), bat: show(kept.bat) };
}

/** The editor's starting values for a stored main run (or a companion's run). */
export function runFormValues(spec: AdminEditionRunSpec, kept: AdminProofsKept): RunFormValues {
  const base = { ...emptyRunForm(), proofsKept: proofsText(kept) };
  const main = spec.type === "companion" ? spec.run : spec;
  switch (main.type) {
    case "lax_standard":
      return base;
    case "custom_limited":
      return {
        ...base,
        template: "custom_limited",
        sizeText: text(main.size),
        allocation: allocationText(main.allocation),
      };
    case "open":
      return { ...base, template: "open", openArtistPctText: text(main.defaultSplit.artistPct) };
    case "proof":
      return base;
  }
}

/** Whole numbers only; blank reads as 0 where 0 is allowed. */
function wholeNumber(value: string, blank: number | null = 0): number | null {
  const trimmed = value.trim();
  if (!trimmed) return blank;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** The size typed for a custom run, or null while it is not a whole number. */
export function typedSize(values: RunFormValues): number | null {
  return wholeNumber(values.sizeText, null);
}

/** Choosing a template; custom starts from the standard split scaled to the size typed. */
export function withTemplate(values: RunFormValues, template: RunTemplate): RunFormValues {
  if (template !== "custom_limited" || values.template === "custom_limited") {
    return { ...values, template };
  }
  const size = typedSize(values) ?? SHOP_EDITION_COUNT;
  return { ...values, template, allocation: allocationText(defaultCustomAllocation(size)) };
}

export type AllocationTotals = {
  size: number | null;
  allocated: number;
  /** Positive when prints are left, negative when too many are allocated. */
  left: number | null;
};

export function allocationTotals(values: RunFormValues): AllocationTotals {
  const size = typedSize(values);
  const counts = [values.allocation.buyer, values.allocation.artist, values.allocation.lax].map(
    (value) => wholeNumber(value) ?? 0,
  );
  const allocated = counts.reduce((sum, count) => sum + count, 0);
  return { size, allocated, left: size === null ? null : size - allocated };
}

/** "24 of 24 allocated", "22 of 24 allocated: 2 left" or "26 of 24 allocated: 2 too many". */
export function allocationTotalText(totals: AllocationTotals): {
  text: string;
  complete: boolean;
} {
  if (totals.size === null) return { text: `${totals.allocated} allocated`, complete: false };
  const base = `${totals.allocated} of ${totals.size} allocated`;
  if (totals.left === 0) return { text: base, complete: true };
  if ((totals.left ?? 0) > 0) return { text: `${base}: ${totals.left} left`, complete: false };
  return { text: `${base}: ${-(totals.left ?? 0)} too many`, complete: false };
}

const RANGE_NAMES = {
  original_buyer_entitlement: "buyers",
  artist: "artist",
  lax: "LAX",
} as const;

/** "Numbering: 1–10 buyers · 11–20 artist · 21–24 LAX"; null until the numbers add up. */
export function numberingText(allocation: { buyer: number; artist: number; lax: number }) {
  const ranges = allocationNumbering(allocation);
  if (ranges.length === 0) return null;
  const parts = ranges.map((range) => {
    const span = range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`;
    return `${span} ${RANGE_NAMES[range.allocation]}`;
  });
  return `Numbering: ${parts.join(" · ")}`;
}

/** The numbering of the run being edited, once its allocation adds up. */
export function formNumberingText(values: RunFormValues): string | null {
  if (values.template === "open") return null;
  if (values.template === "lax_standard") return numberingText(LAX_STANDARD_ALLOCATION);
  const totals = allocationTotals(values);
  if (totals.left !== 0) return null;
  const read = (value: string) => wholeNumber(value) ?? 0;
  return numberingText({
    buyer: read(values.allocation.buyer),
    artist: read(values.allocation.artist),
    lax: read(values.allocation.lax),
  });
}

/** Percent of new open edition stock, artist then LAX. */
export function openSplit(values: RunFormValues): { artistPct: number; laxPct: number } | null {
  const artistPct = wholeNumber(values.openArtistPctText, null);
  if (artistPct === null || artistPct > 100) return null;
  return { artistPct, laxPct: 100 - artistPct };
}

/** How a batch of `quantity` prints divides between the artist and LAX by the default split. */
export function proposedBatch(quantity: number, split: { artistPct: number }) {
  const artist = Math.round((quantity * split.artistPct) / 100);
  return { artist, lax: quantity - artist };
}

/** "OE-0001": how unnumbered open edition prints are identified. */
export function stockRefLabel(ref: number): string {
  return `OE-${String(ref).padStart(4, "0")}`;
}

/** "20 prints: 10 artist, 10 LAX. Stock references OE-0001 to OE-0020." */
export function batchSummaryText(input: {
  quantity: number;
  artist: number;
  lax: number;
  firstStockRef: number;
}): string {
  const { quantity, artist, lax, firstStockRef } = input;
  const prints = quantity === 1 ? "1 print" : `${quantity} prints`;
  const refs =
    quantity === 1
      ? `Stock reference ${stockRefLabel(firstStockRef)}.`
      : `Stock references ${stockRefLabel(firstStockRef)} to ${stockRefLabel(firstStockRef + quantity - 1)}.`;
  return `${prints}: ${artist} artist, ${lax} LAX. ${refs}`;
}

export type RunFormContext = {
  /** Whether the artwork is linked to an original on lax.art; buyer prints need one. */
  linkedToOriginal: boolean;
};

const BUYER_NEEDS_ORIGINAL =
  "Buyer prints need an original on lax.art. Link the original or set buyers to 0";

/**
 * Every problem with the run step, keyed by field, in the wording staff see beside the field and
 * in the summary. Mirrors the shop domain's rules, which the API applies again.
 */
export function validateRunForm(
  values: RunFormValues,
  context: RunFormContext,
): Partial<Record<RunFormField, string>> {
  const errors: Partial<Record<RunFormField, string>> = {};
  if (values.template === "custom_limited") {
    const size = typedSize(values);
    if (size === null || size < EDITION_RUN_MIN_SIZE || size > EDITION_RUN_MAX_SIZE) {
      errors.size = `The size must be between ${EDITION_RUN_MIN_SIZE} and ${EDITION_RUN_MAX_SIZE}`;
    }
    const counts = [values.allocation.buyer, values.allocation.artist, values.allocation.lax].map(
      (value) => wholeNumber(value),
    );
    if (counts.some((count) => count === null)) {
      errors.allocation = "Enter whole numbers of prints, 0 or more";
    } else if (size !== null && !errors.size) {
      const [buyer = 0, artist = 0, lax = 0] = counts as number[];
      const left = size - (buyer + artist + lax);
      if (left > 0) errors.allocation = `Allocate every print: ${left} are not allocated`;
      else if (left < 0)
        errors.allocation = `Too many prints are allocated: ${-left} over the size`;
      else if (artist + lax < 1) {
        errors.allocation = "At least one print must belong to the artist or LAX";
      }
      if (buyer > 0 && !context.linkedToOriginal) errors.original = BUYER_NEEDS_ORIGINAL;
    }
  }
  if (values.template === "open") {
    if (!openSplit(values))
      errors.openSplit = "Enter the artist's share as a whole percent, 0 to 100";
    const batch = wholeNumber(values.firstBatchText);
    if (batch === null || batch > STOCK_BATCH_MAX) {
      errors.firstBatch = `Enter how many prints to start with, up to ${STOCK_BATCH_MAX}, or leave it blank`;
    } else if (
      batch > 0 &&
      values.firstBatchCustody === "stored" &&
      !values.firstBatchLocation.trim()
    ) {
      errors.firstBatchLocation = "Say where the printed stock is stored";
    }
  }
  const kept = Object.values(values.proofsKept).map((value) => wholeNumber(value));
  if (kept.some((count) => count === null || count > EDITION_RUN_MAX_SIZE)) {
    errors.proofsKept = "Enter whole numbers of proofs kept, or leave them blank";
  }
  return errors;
}

/** The errors in page order with the id each control renders, for `FormErrorSummary`. */
export function runErrorSummary(errors: Partial<Record<RunFormField, string>>) {
  return RUN_FORM_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: runFieldId(field), message }] : [];
  });
}

/** The run as the API takes it. Call only once `validateRunForm` finds nothing. */
export function runSpecInput(values: RunFormValues): AdminMainRunInput {
  switch (values.template) {
    case "lax_standard":
      return { type: "lax_standard" };
    case "custom_limited":
      return {
        type: "custom_limited",
        size: typedSize(values) ?? 0,
        allocation: {
          buyer: wholeNumber(values.allocation.buyer) ?? 0,
          artist: wholeNumber(values.allocation.artist) ?? 0,
          lax: wholeNumber(values.allocation.lax) ?? 0,
        },
      };
    case "open":
      return { type: "open", defaultArtistPct: openSplit(values)?.artistPct ?? 50 };
  }
}

export function proofsKeptInput(values: RunFormValues): AdminProofsKept {
  const read = (value: string) => wholeNumber(value) ?? 0;
  return {
    ap: read(values.proofsKept.ap),
    pp: read(values.proofsKept.pp),
    hc: read(values.proofsKept.hc),
    bat: read(values.proofsKept.bat),
  };
}

/** The first batch of an open edition, split by the default; null when none is added yet. */
export function firstBatchInput(values: RunFormValues): AdminStockBatchInput | null {
  if (values.template !== "open") return null;
  const quantity = wholeNumber(values.firstBatchText) ?? 0;
  const split = openSplit(values);
  if (quantity === 0 || !split) return null;
  const { artist, lax } = proposedBatch(quantity, split);
  return {
    artistCount: artist,
    laxCount: lax,
    custody: values.firstBatchCustody,
    ...(values.firstBatchCustody === "stored"
      ? { storageLocation: values.firstBatchLocation.trim() }
      : {}),
  };
}

/** The run in the shop domain's terms, for the facts preview while it is being chosen. */
export function previewSpec(
  values: RunFormValues,
  context: RunFormContext,
): AdminEditionRunSpec | null {
  if (Object.keys(validateRunForm(values, context)).length > 0) return null;
  const input = runSpecInput(values);
  switch (input.type) {
    case "lax_standard":
      return input;
    case "custom_limited":
      return { ...input, linkedToOriginal: context.linkedToOriginal };
    case "open":
      return {
        type: "open",
        defaultSplit: { artistPct: input.defaultArtistPct, laxPct: 100 - input.defaultArtistPct },
      };
  }
}
