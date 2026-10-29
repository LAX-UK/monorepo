import { createTokenContrast } from "@/test/css-token-contrast";
import { INLINE_ACTION_MENU_TOKENS } from "@auction/ui";
import { describe, expect, it } from "vitest";

/**
 * A destructive row-menu item ("Remove", "Withdraw") is drawn in the kit's error colour. On Bid's
 * tokens its text must reach 4.5:1 on the menu, and on the item's focused surface, in both
 * themes.
 */
describe("row menu destructive item", () => {
  const contrast = createTokenContrast();
  const { destructiveText, surface, focusSurface } = INLINE_ACTION_MENU_TOKENS;

  it.each([
    ["light", surface],
    ["light", focusSurface],
    ["dark", surface],
    ["dark", focusSurface],
  ] as const)("reaches 4.5:1 in %s on %s", (theme, background) => {
    expect(contrast(destructiveText, background, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
