import type {
  AdminEditionFraming,
  AdminEditionFramingOption,
  AdminEditionFramingSaveBody,
} from "@auction/shop-contracts";
import {
  type EditionFramingIssue,
  FRAMED_BY_ARTIST_MAX_LENGTH,
  FRAMING_MODE_LABELS,
  FRAMING_PRICE_MAX_PENCE,
  type FramingBandCode,
  type FramingMode,
  editionFramingIssues,
  framingBandLabel,
  parseSheetSizeCm,
} from "@auction/shop-domain";
import { formatStaffMoney } from "@auction/staff-ui";
import type { FieldErrors } from "./form-validation";

/*
 * The Framing card's form: how an edition is sold, which catalogue options it offers and its own
 * price for each. The rules are the domain's, which shop-api runs again on save; this file adds
 * the words for what can be wrong and the preview of what shoppers will see.
 */

export type EditionFramingFormValues = {
  mode: FramingMode;
  framedByArtist: string;
  /** Per catalogue option: offered here, and the edition's own price in pence or null. */
  offers: Record<string, { offered: boolean; overridePence: number | null }>;
};

export const FRAMING_MODE_CHOICES: ReadonlyArray<{
  value: FramingMode;
  label: string;
  description: string;
}> = [
  {
    value: "unframed_or_framed",
    label: FRAMING_MODE_LABELS.unframed_or_framed,
    description: "The default. Unframed prints ship flat in archival packing.",
  },
  {
    value: "framed_only",
    label: FRAMING_MODE_LABELS.framed_only,
    description: "Shoppers must choose one of the options below.",
  },
  {
    value: "framed_by_artist",
    label: FRAMING_MODE_LABELS.framed_by_artist,
    description: "No choice. Describe the frame below.",
  },
];

export function editionFramingFormValues(framing: AdminEditionFraming): EditionFramingFormValues {
  return {
    mode: framing.mode,
    framedByArtist: framing.framedByArtist,
    offers: Object.fromEntries(
      framing.options.map((option) => [
        option.optionId,
        { offered: option.offered, overridePence: option.overridePence },
      ]),
    ),
  };
}

export function isEditionFramingDirty(
  values: EditionFramingFormValues,
  baseline: EditionFramingFormValues,
): boolean {
  if (values.mode !== baseline.mode) return true;
  if (values.framedByArtist.trim() !== baseline.framedByArtist.trim()) return true;
  return Object.keys({ ...baseline.offers, ...values.offers }).some((id) => {
    const now = values.offers[id] ?? { offered: false, overridePence: null };
    const before = baseline.offers[id] ?? { offered: false, overridePence: null };
    return (
      now.offered !== before.offered || (now.offered && now.overridePence !== before.overridePence)
    );
  });
}

/** The save body, in catalogue order. A print framed by the artist offers no options. */
export function editionFramingBody(
  values: EditionFramingFormValues,
  framing: AdminEditionFraming,
): AdminEditionFramingSaveBody {
  const byArtist = values.mode === "framed_by_artist";
  return {
    mode: values.mode,
    framedByArtist: byArtist ? values.framedByArtist.trim() : "",
    offers: byArtist
      ? []
      : framing.options.flatMap((option) => {
          const offer = values.offers[option.optionId];
          return offer?.offered
            ? [{ optionId: option.optionId, overridePence: offer.overridePence }]
            : [];
        }),
    expectedVersion: framing.version,
  };
}

const MAX_PRICE_LABEL = formatStaffMoney(FRAMING_PRICE_MAX_PENCE);

export function editionFramingIssueMessage(issue: EditionFramingIssue): string {
  switch (issue.reason) {
    case "framed_only_needs_option":
      return "Offer at least one option, or sell this edition another way";
    case "description_required":
      return "Describe the artist's frame";
    case "description_too_long":
      return `Use ${FRAMED_BY_ARTIST_MAX_LENGTH} characters or fewer`;
    case "offers_not_allowed":
      return "A print framed by the artist offers no options";
    case "no_size_band":
      return "Add the sheet size, up to 80 × 100 cm, on the Edition card to offer framing";
    case "option_not_offerable":
      return "This option cannot be offered until the catalogue has the framer's prices for it";
    case "option_listed_twice":
      return "This option is listed twice";
    case "override_invalid":
      return `Enter a price from £0.01 to ${MAX_PRICE_LABEL}`;
  }
}

export type EditionFramingFormResult =
  | { ok: true; body: AdminEditionFramingSaveBody }
  | { ok: false; errors: FieldErrors };

/** Checks the form with the domain rules; the keys are `offers`, `framedByArtist` and `option:<id>`. */
export function validateEditionFramingForm(
  values: EditionFramingFormValues,
  framing: AdminEditionFraming,
): EditionFramingFormResult {
  const body = editionFramingBody(values, framing);
  const issues = editionFramingIssues(
    { mode: body.mode, framedByArtist: body.framedByArtist, offers: body.offers },
    {
      band: framing.band,
      options: new Map(
        framing.options.map((option) => [
          option.optionId,
          { status: option.catalogueStatus, placeholderBands: option.placeholderBands },
        ]),
      ),
      savedOptionIds: new Set(
        framing.options.filter((option) => option.offered).map((option) => option.optionId),
      ),
    },
  );
  if (issues.length === 0) return { ok: true, body };
  const errors: FieldErrors = {};
  const unreadable = sheetSizeProblem(framing) === "unreadable";
  for (const issue of issues) {
    errors[issue.field] ??=
      issue.reason === "no_size_band" && unreadable
        ? UNREADABLE_SHEET_SIZE
        : editionFramingIssueMessage(issue);
  }
  return { ok: false, errors };
}

/** Why a catalogue option cannot be switched on for an edition right now; null when it can. */
export function optionUnavailableReason(option: AdminEditionFramingOption): string | null {
  if (option.offerable) return null;
  if (option.catalogueStatus === "paused") return "Paused in the catalogue";
  if (option.placeholderBands.length > 0) {
    return "Waiting for the framer's prices in the catalogue";
  }
  return "Not offered in the catalogue";
}

/** Why an edition has no size band, so the card can say the right thing. */
export type SheetSizeProblem = "none" | "unreadable" | "too_large";

export function sheetSizeProblem(
  framing: Pick<AdminEditionFraming, "band" | "sheetSize">,
): SheetSizeProblem | null {
  if (framing.band) return null;
  if (!framing.sheetSize) return "none";
  return parseSheetSizeCm(framing.sheetSize) ? "too_large" : "unreadable";
}

/** True when the sheet size was typed without a unit and is read as centimetres. */
export function sheetSizeReadAsCm(sheetSize: string | null): boolean {
  return sheetSize !== null && parseSheetSizeCm(sheetSize) !== null && !/cm|centi/i.test(sheetSize);
}

export const UNREADABLE_SHEET_SIZE =
  "We could not read the sheet size. Write it as 50 × 70 cm on the Edition card.";

/** "Up to 60 × 80 cm, from the 50 × 70 cm sheet", or what is wrong with the sheet size. */
export function sizeBandSentence(framing: Pick<AdminEditionFraming, "band" | "sheetSize">): string {
  const problem = sheetSizeProblem(framing);
  if (problem === "none") {
    return "No sheet size yet: add it on the Edition card, for example 50 × 70 cm";
  }
  if (problem === "unreadable") return UNREADABLE_SHEET_SIZE;
  if (problem === "too_large") {
    return `The ${framing.sheetSize} sheet is larger than 80 × 100 cm: framing is quoted`;
  }
  const base = `Size band: ${framingBandLabel(framing.band as FramingBandCode).toLowerCase()}, from the ${framing.sheetSize} sheet`;
  return sheetSizeReadAsCm(framing.sheetSize) ? `${base}. Read as cm` : base;
}

/** The price a shopper pays for an option here: the edition's own, else the catalogue's. */
export function optionPricePence(
  option: AdminEditionFramingOption,
  offer: { overridePence: number | null } | undefined,
): number | null {
  return offer?.overridePence ?? option.cataloguePricePence;
}

/** The lines of "Shoppers will see": the print, then each option that will show, with its price. */
export function shoppersWillSee(
  framing: AdminEditionFraming,
  values: EditionFramingFormValues,
  printPricePence: number | null,
): string[] {
  if (values.mode === "framed_by_artist") {
    const text = values.framedByArtist.trim();
    return text ? [`Comes framed: ${text}`] : [];
  }
  const shown = framing.options.filter((option) => {
    const offer = values.offers[option.optionId];
    return offer?.offered && option.offerable;
  });
  if (shown.length === 0) return [];
  const lines: string[] = [];
  if (values.mode === "unframed_or_framed") {
    lines.push(
      `Unframed${printPricePence === null ? "" : ` ${formatStaffMoney(printPricePence)}`}`,
    );
  }
  for (const option of shown) {
    const offer = values.offers[option.optionId];
    const price = optionPricePence(option, offer);
    const own = offer?.overridePence != null ? " (edition price)" : "";
    lines.push(`${option.name}${price === null ? "" : ` +${formatStaffMoney(price)}`}${own}`);
  }
  return lines;
}
