import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(join(import.meta.dirname, "../lax/theme.css"), "utf8");

describe("the chip row's hold", () => {
  it("ends once the row has settled, so a sale outside London does not keep a gap", () => {
    expect(theme).toContain("html.tz-away .tz-chip-slot:empty:not([data-settled])");
    expect(theme).toContain("html.tz-away .tz-chip-slot--inline:empty:not([data-settled])");
  });
});
