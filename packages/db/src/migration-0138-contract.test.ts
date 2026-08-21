import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(__dirname, "../drizzle/0138_buyer_interest_categories.sql"),
  "utf8",
);

describe("migration 0138 buyer interest categories contract", () => {
  it.each(["jewellery", "antiques", "memorabilia"])(
    "creates the %s category idempotently",
    (slug) => {
      expect(migration).toContain(`'${slug}'`);
      expect(migration).toContain('ON CONFLICT ("slug") DO UPDATE');
    },
  );
});
