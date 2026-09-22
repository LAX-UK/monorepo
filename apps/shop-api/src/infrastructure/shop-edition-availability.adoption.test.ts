import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = import.meta.dirname;

describe("sellable edition SQL SSOT", () => {
  const adapters = [
    "drizzle-artwork-catalogue.repository.ts",
    "drizzle-artwork-interest.repository.ts",
    "shop-checkout-reservation.ts",
  ];

  for (const file of adapters) {
    it(`${file} uses shop-edition-availability`, () => {
      const text = readFileSync(join(dir, file), "utf8");
      expect(text).toContain("shop-edition-availability");
      expect(text).not.toMatch(
        /count\(\*\) filter \(where \$\{shopEdition\.ownerPartyId\} is not null/,
      );
    });
  }
});
