import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(join(import.meta.dirname, "../lax/theme.css"), "utf8");

describe("the chip row's hold", () => {
  it("ends once the page is ready, so a sale outside London does not keep a gap", () => {
    expect(theme).toContain("html.tz-away:not(.tz-ready) .tz-chip-slot:empty");
    expect(theme).toContain("html.tz-away:not(.tz-ready) .tz-chip-slot--inline:empty");
    expect(theme).not.toMatch(/html\.tz-away \.tz-chip-slot/);
  });
});
