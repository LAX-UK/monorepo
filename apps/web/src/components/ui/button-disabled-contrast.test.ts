import { createTokenContrast } from "@/test/css-token-contrast";
import { describe, expect, it } from "vitest";

/** Labels an enabled button draws in Bid, on the surfaces it sits on. */
const ENABLED_LABELS = ["on-surface", "on-surface-variant", "primary"] as const;

describe("disabled button pair in Bid", () => {
  const contrast = createTokenContrast();

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it.each(["surface", "background", "disabled-bg"] as const)(
      "the disabled label reads at 3:1 or more on %s, WCAG's level for an inactive control",
      (bg) => {
        expect(contrast("disabled-fg", bg, theme)).toBeGreaterThanOrEqual(3);
      },
    );

    it.each(ENABLED_LABELS)(
      "the disabled label is clearly lighter than the enabled %s label",
      (label) => {
        expect(contrast(label, "disabled-fg", theme)).toBeGreaterThanOrEqual(1.4);
      },
    );

    it("the disabled edge is quieter than the enabled field edge", () => {
      expect(contrast("disabled-border", "surface", theme)).toBeLessThan(
        contrast("input-border", "surface", theme),
      );
    });

    it("the disabled fill is visible but quiet on the page", () => {
      const ratio = contrast("disabled-bg", "surface", theme);
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.5);
    });
  });
});
