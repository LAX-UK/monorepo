import type { FramingOption, FramingOptionBody } from "@auction/shop-contracts";
import {
  FRAMING_BAND_CODES,
  FRAMING_FRAMES,
  FRAMING_FRAME_LABELS,
  FRAMING_GLAZINGS,
  FRAMING_GLAZING_LABELS,
  FRAMING_HANGINGS,
  FRAMING_HANGING_LABELS,
  FRAMING_LEAD_TIME_MAX_DAYS,
  FRAMING_MOUNTS,
  FRAMING_MOUNT_LABELS,
  FRAMING_NAME_MAX_LENGTH,
  FRAMING_PRICE_MAX_PENCE,
  type FramingBandCode,
  type FramingBandPrices,
  type FramingFrame,
  type FramingGlazing,
  type FramingHanging,
  type FramingIssue,
  type FramingMount,
  type FramingPrices,
  framingBandLabel,
  framingSaveIssues,
  nextPlaceholderBands,
} from "@auction/shop-domain";
import type { EnumOption } from "@auction/staff-ui";
import { formatStaffNumber } from "@auction/staff-ui";
import { type FieldErrors, collectFieldErrors } from "./form-validation";

/*
 * The framing option form: what staff type, the rules from `@auction/shop-domain` that decide
 * whether it can be saved, and the words for each thing that can be wrong. The same rules run
 * again in shop-api on save.
 */

export type FramingFormValues = {
  name: string;
  frame: FramingFrame;
  mount: FramingMount;
  glazing: FramingGlazing;
  hanging: FramingHanging;
  /** Typed whole days, kept as text so a half-typed number is not lost. */
  leadTimeMinDays: string;
  leadTimeMaxDays: string;
  /** Whole pence including VAT, or null while empty. */
  prices: Record<FramingBandCode, number | null>;
  /** Placeholder bands whose current price staff have confirmed as right. */
  confirmedBands: FramingBandCode[];
  offered: boolean;
};

const optionsOf = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value): EnumOption<T> => ({ value, label: labels[value] }));

export const FRAME_OPTIONS = optionsOf(FRAMING_FRAMES, FRAMING_FRAME_LABELS);
export const MOUNT_OPTIONS = optionsOf(FRAMING_MOUNTS, FRAMING_MOUNT_LABELS);
export const GLAZING_OPTIONS = optionsOf(FRAMING_GLAZINGS, FRAMING_GLAZING_LABELS);
export const HANGING_OPTIONS = optionsOf(FRAMING_HANGINGS, FRAMING_HANGING_LABELS);

const MAX_PRICE_LABEL = `£${formatStaffNumber(FRAMING_PRICE_MAX_PENCE / 100)}`;

/** A form for a new option, or one filled from the option being edited. */
export function framingFormDefaults(option: FramingOption | null): FramingFormValues {
  if (!option) {
    return {
      name: "",
      frame: FRAMING_FRAMES[0],
      mount: FRAMING_MOUNTS[0],
      glazing: FRAMING_GLAZINGS[0],
      hanging: FRAMING_HANGINGS[0],
      leadTimeMinDays: "",
      leadTimeMaxDays: "",
      prices: { up_to_40x50: null, up_to_60x80: null, up_to_80x100: null },
      confirmedBands: [],
      offered: false,
    };
  }
  return {
    name: option.name,
    frame: option.frame,
    mount: option.mount,
    glazing: option.glazing,
    hanging: option.hanging,
    leadTimeMinDays: String(option.leadTimeMinDays),
    leadTimeMaxDays: String(option.leadTimeMaxDays),
    prices: { ...option.pricesPence },
    confirmedBands: [],
    offered: option.status === "active",
  };
}

/** Whole days from typed text; null when empty or not a whole number. */
function wholeDays(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function bodyOf(values: FramingFormValues): FramingOptionBody {
  return {
    name: values.name.trim(),
    frame: values.frame,
    mount: values.mount,
    glazing: values.glazing,
    hanging: values.hanging,
    leadTimeMinDays: wholeDays(values.leadTimeMinDays),
    leadTimeMaxDays: wholeDays(values.leadTimeMaxDays),
    pricesPence: values.prices,
    offered: values.offered,
    confirmedBands: values.confirmedBands,
  };
}

/** The option's price in each band with whether it is still a placeholder. */
function bandPricesOf(
  option: Pick<FramingOption, "pricesPence" | "placeholderBands">,
): FramingBandPrices {
  const bands = {} as FramingBandPrices;
  for (const band of FRAMING_BAND_CODES) {
    bands[band] = {
      pricePence: option.pricesPence[band],
      placeholder: option.placeholderBands.includes(band),
    };
  }
  return bands;
}

/**
 * The bands still waiting for the framer's real price, with the prices as typed: a band is real
 * once its price differs from the seeded one or staff have confirmed it. While a price is cleared
 * the band keeps its status, so clearing and retyping does not lose it.
 */
export function stillPlaceholderBands(
  previous: Pick<FramingOption, "pricesPence" | "placeholderBands"> | null,
  prices: Record<FramingBandCode, number | null>,
  confirmed: readonly FramingBandCode[],
): FramingBandCode[] {
  if (!previous) return [];
  const typed = FRAMING_BAND_CODES.every((band) => prices[band] !== null);
  if (!typed) {
    return previous.placeholderBands.filter(
      (band) =>
        !confirmed.includes(band) &&
        (prices[band] === null || prices[band] === previous.pricesPence[band]),
    );
  }
  return nextPlaceholderBands(bandPricesOf(previous), prices as FramingPrices, confirmed);
}

/** The summary and field messages for one issue; each reads on its own, without the label. */
export function framingIssueMessage(issue: FramingIssue): string {
  switch (issue.reason) {
    case "name_required":
      return "Enter the name shoppers see";
    case "name_too_long":
      return `Use ${FRAMING_NAME_MAX_LENGTH} characters or fewer for the name`;
    case "lead_time_min_invalid":
      return `Enter the shortest lead time, from 1 to ${FRAMING_LEAD_TIME_MAX_DAYS} working days`;
    case "lead_time_max_invalid":
      return `Enter the longest lead time, from 1 to ${FRAMING_LEAD_TIME_MAX_DAYS} working days`;
    case "lead_time_order":
      return "The longest lead time cannot be shorter than the shortest";
    case "price_missing":
      return `Enter a price for ${bandOf(issue.field).toLowerCase()}`;
    case "price_invalid":
      return `Enter a price from £0.01 to ${MAX_PRICE_LABEL} for ${bandOf(issue.field).toLowerCase()}`;
    case "placeholder_price":
      return `Enter the framer's price for ${bandOf(issue.field).toLowerCase()}, or confirm the price shown, before offering this option`;
  }
}

function bandOf(field: string): string {
  const code = field.replace("price:", "") as FramingBandCode;
  return framingBandLabel(code);
}

export type FramingFormResult =
  | { ok: true; value: FramingOptionBody }
  | { ok: false; errors: FieldErrors };

/**
 * Checks the form against the domain rules. `previous` is the option being edited (null for a new
 * one), which decides whether untouched placeholder prices are still placeholders.
 */
export function validateFramingForm(
  values: FramingFormValues,
  previous: Pick<FramingOption, "placeholderBands" | "pricesPence"> | null,
): FramingFormResult {
  const body = bodyOf(values);
  const issues = framingSaveIssues(body, {
    offered: values.offered,
    placeholderBands: stillPlaceholderBands(previous, values.prices, values.confirmedBands),
  });
  if (issues.length === 0) return { ok: true, value: body };
  const checks: Record<string, string | null> = {};
  for (const issue of issues) {
    // The first thing wrong with a field is the one to fix first.
    checks[issue.field] ??= framingIssueMessage(issue);
  }
  return { ok: false, errors: collectFieldErrors(checks) };
}
