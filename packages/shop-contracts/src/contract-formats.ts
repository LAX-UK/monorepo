import { FormatRegistry } from "@sinclair/typebox";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
}

registerShopContractFormats();
