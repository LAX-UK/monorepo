import {
  MERCHANDISE_DESCRIPTION_MAX_LENGTH,
  MERCHANDISE_PRICE_MAX_PENCE,
  MERCHANDISE_SKU_IN_USE_MESSAGE,
  MERCHANDISE_SKU_MAX_LENGTH,
  MERCHANDISE_SLUG_IN_USE_MESSAGE,
  MERCHANDISE_SLUG_MAX_LENGTH,
  MERCHANDISE_SLUG_PATTERN,
  MERCHANDISE_STOCK_REASON_MAX_LENGTH,
  MERCHANDISE_TITLE_MAX_LENGTH,
} from "@auction/shop-contracts";
import { type FieldErrors, collectFieldErrors, parseWholeNumber } from "./form-validation";

const SLUG_PATTERN = new RegExp(MERCHANDISE_SLUG_PATTERN);
const MAX_PRICE_LABEL = formatPounds(MERCHANDISE_PRICE_MAX_PENCE);

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

function formatPounds(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

/** A URL slug from a title: lower case words joined by hyphens, accents dropped. */
export function slugFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MERCHANDISE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Pounds typed by staff ("12", "12.5", "£1,200.00") to whole pence. Read as text so no
 * floating-point rounding can change an amount.
 */
export function parsePoundsToPence(
  raw: string,
): { ok: true; pence: number } | { ok: false; message: string } {
  const message = `Enter a price in pounds, such as 12.50, up to ${MAX_PRICE_LABEL}.`;
  const text = raw.replace(/[£\s,]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, message };
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(pence) || pence > MERCHANDISE_PRICE_MAX_PENCE) {
    return { ok: false, message };
  }
  return { ok: true, pence };
}

/** Pence as the pounds text a price field shows, always with two decimals. */
export function penceToPoundsText(pence: number): string {
  return (pence / 100).toFixed(2);
}

function titleError(title: string): string | null {
  if (!title.trim()) return "Enter a title.";
  return title.trim().length > MERCHANDISE_TITLE_MAX_LENGTH
    ? `Title must be ${MERCHANDISE_TITLE_MAX_LENGTH} characters or fewer.`
    : null;
}

function slugError(slug: string): string | null {
  if (!slug.trim()) return "Enter a slug.";
  if (slug.trim().length > MERCHANDISE_SLUG_MAX_LENGTH) {
    return `Slug must be ${MERCHANDISE_SLUG_MAX_LENGTH} characters or fewer.`;
  }
  return SLUG_PATTERN.test(slug.trim())
    ? null
    : "Use lower case letters, numbers and single hyphens, such as tote-bag.";
}

function descriptionError(description: string): string | null {
  return description.trim().length > MERCHANDISE_DESCRIPTION_MAX_LENGTH
    ? `Description must be ${MERCHANDISE_DESCRIPTION_MAX_LENGTH} characters or fewer.`
    : null;
}

function skuError(sku: string): string | null {
  if (!sku.trim()) return "Enter a SKU.";
  return sku.trim().length > MERCHANDISE_SKU_MAX_LENGTH
    ? `SKU must be ${MERCHANDISE_SKU_MAX_LENGTH} characters or fewer.`
    : null;
}

export type ProductFieldsForm = { title: string; slug: string; description: string };
export type ProductFieldsPayload = { title: string; slug: string; description: string | null };

export function validateProductFields(form: ProductFieldsForm): Validated<ProductFieldsPayload> {
  const errors = collectFieldErrors({
    title: titleError(form.title),
    slug: slugError(form.slug),
    description: descriptionError(form.description),
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
    },
  };
}

export type VariantForm = { sku: string; price: string };
export type VariantPayload = { sku: string; pricePence: number };

export function validateVariant(form: VariantForm): Validated<VariantPayload> {
  const price = parsePoundsToPence(form.price);
  const errors = collectFieldErrors({
    sku: skuError(form.sku),
    price: price.ok ? null : price.message,
  });
  if (Object.keys(errors).length > 0 || !price.ok) return { ok: false, errors };
  return { ok: true, value: { sku: form.sku.trim(), pricePence: price.pence } };
}

export type NewProductForm = ProductFieldsForm & VariantForm & { onHand: string };
export type NewProductPayload = ProductFieldsPayload & VariantPayload & { onHand: number };

export function validateNewProduct(form: NewProductForm): Validated<NewProductPayload> {
  const fields = validateProductFields(form);
  const variant = validateVariant(form);
  const onHand = parseWholeNumber(form.onHand, { min: 0 }, "Enter a whole number, 0 or more.");
  const errors: FieldErrors = {
    ...(fields.ok ? {} : fields.errors),
    ...(variant.ok ? {} : variant.errors),
    ...(onHand.ok ? {} : { onHand: onHand.message }),
  };
  if (!fields.ok || !variant.ok || !onHand.ok) return { ok: false, errors };
  return { ok: true, value: { ...fields.value, ...variant.value, onHand: onHand.value } };
}

export type StockForm = { onHand: string; reason: string };
export type StockPayload = { onHand: number; reason: string };

/** A count below the units held for open checkouts is refused by the API; the form says so early. */
export function validateStockAdjustment(
  form: StockForm,
  reserved: number,
): Validated<StockPayload> {
  const onHand = parseWholeNumber(form.onHand, { min: 0 }, "Enter a whole number, 0 or more.");
  const reason = form.reason.trim();
  const errors = collectFieldErrors({
    onHand: !onHand.ok
      ? onHand.message
      : onHand.value < reserved
        ? `${reserved} ${reserved === 1 ? "unit is" : "units are"} held for open checkouts, so the count cannot go below ${reserved}.`
        : null,
    reason:
      reason.length < 3
        ? "Give a reason of at least 3 characters, such as “Recount after delivery”."
        : reason.length > MERCHANDISE_STOCK_REASON_MAX_LENGTH
          ? `Reason must be ${MERCHANDISE_STOCK_REASON_MAX_LENGTH} characters or fewer.`
          : null,
  });
  if (Object.keys(errors).length > 0 || !onHand.ok) return { ok: false, errors };
  return { ok: true, value: { onHand: onHand.value, reason } };
}

/** Which field a 409 without a version is about, read from the API's fixed messages. */
export function conflictField(message: string): "slug" | "sku" | null {
  if (message === MERCHANDISE_SLUG_IN_USE_MESSAGE) return "slug";
  if (message === MERCHANDISE_SKU_IN_USE_MESSAGE) return "sku";
  return null;
}
