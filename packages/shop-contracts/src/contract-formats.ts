import { FormatRegistry } from "@sinclair/typebox";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects impossible dates such as 2026-02-30, which `Date` would otherwise roll forward. */
function isCalendarDate(value: unknown): boolean {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Registers TypeBox string formats used by Shop public contracts. Idempotent. */
export function registerShopContractFormats(): void {
  if (!FormatRegistry.Has("uuid")) {
    FormatRegistry.Set("uuid", (value) => typeof value === "string" && UUID_PATTERN.test(value));
  }
  if (!FormatRegistry.Has("date-time")) {
    FormatRegistry.Set(
      "date-time",
      (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)),
    );
  }
  // Admin write bodies use these; shop-api validates them with Ajv, which brings its own.
  if (!FormatRegistry.Has("email")) {
    FormatRegistry.Set("email", (value) => typeof value === "string" && EMAIL_PATTERN.test(value));
  }
  if (!FormatRegistry.Has("date")) {
    FormatRegistry.Set("date", isCalendarDate);
  }
}

registerShopContractFormats();
