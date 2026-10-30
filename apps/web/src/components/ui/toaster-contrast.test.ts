import { createTokenContrast } from "@/test/css-token-contrast";
import { TOAST_SUCCESS_COLOURS } from "@auction/ui";
import { describe, expect, it } from "vitest";

/**
 * The success toast (the Undo toast after a role change, and every other confirmation) reads its
 * colours from the Bid theme's success tokens. Its text must reach 4.5:1 on its background in
 * light and dark.
 */

/** The colour token a toast colour points at, without `--color-`: "success-container". */
function referenced(value: string | undefined): string {
  const match = value?.match(/^var\(--color-([\w-]+)\)$/);
  if (!match?.[1]) throw new Error(`not a colour token reference: ${value}`);
  return match[1];
}

describe("success toast colours", () => {
  const contrast = createTokenContrast();
  const text = referenced(TOAST_SUCCESS_COLOURS["--success-text"]);
  const background = referenced(TOAST_SUCCESS_COLOURS["--success-bg"]);

  it.each(["light", "dark"] as const)("give its text 4.5:1 or more in %s", (theme) => {
    expect(contrast(text, background, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
